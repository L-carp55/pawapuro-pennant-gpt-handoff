// 得能が基礎能力値をどれだけ押し下げ／押し上げているかを、パワプロ実装から実測する。
//
// なぜ（オーナー提案 2026-08-04）:
//   仕様05 §2は「得能が平均より多い→基礎能力を下げる／少ない→上げる」と方向だけ定め、
//   「点数寄与は未校正。過去の+5〜7等は仮説であり確定値ではない」として**点数をOPENのまま**にしている。
//   今日の得能付与Phase3bでも、点数を決められないので係数を作らない迂回をした。
//   パワプロ実装の得能を3,229人分集めたので、**その点数を実測で決められる**。
//
// 測り方:
//   同じ成績帯・同じ守備位置の選手を比べ、「得能を持つ群」と「持たない群」で基礎能力に差があるかを見る。
//   成績で層別しないと「上手い選手ほど得能も能力も高い」という当たり前の相関を拾ってしまうため、
//   **プロEYE球の実成績で層を作ってから**比べる（同じ打率帯・同じ本塁打帯の中で比較）。
//
// 注意（本スクリプトの位置づけ）:
//   これは**パワプロの内部規則を測っている**のであって、自作査定の採否を決めるものではない。
//   採否の物差しは configs/ratings.json の special_abilities.base_reflection._judging_criterion が正本。
//   ここで得た数字は「ゲームの目盛りではこう扱われている」という参照情報。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
/** 2群のt値（Welch）。|t|>2 で「偶然では説明しにくい」目安 */
function tstat(a, b) {
  if (a.length < 3 || b.length < 3) return null;
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
  return (mean(a) - mean(b)) / Math.sqrt(va + vb);
}

const rows = db.prepare(`SELECT rowid, work, team, name, name_norm, trajectory, meet, power, speed, arm,
  fielding, catching, ranked_json, plus_json, minus_json, n_ranked, n_plus, n_minus
  FROM pawapuro_full`).all().map(r => ({
    ...r,
    ranked: JSON.parse(r.ranked_json), plus: JSON.parse(r.plus_json), minus: JSON.parse(r.minus_json),
  }));

console.log(`対象: ${rows.length}人（パワプロ8作品の野手）\n`);

// ---- 1. 得能の出現頻度（何を測れるかの確認） ----
const freqPlus = {}, freqMinus = {}, freqRanked = {};
for (const r of rows) {
  for (const a of r.plus) freqPlus[a] = (freqPlus[a] ?? 0) + 1;
  for (const a of r.minus) freqMinus[a] = (freqMinus[a] ?? 0) + 1;
  for (const k of Object.keys(r.ranked)) freqRanked[k] = (freqRanked[k] ?? 0) + 1;
}
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
console.log('=== よく出る得能（測定対象になりうるもの） ===');
console.log('ランク付き:', top(freqRanked, 8).map(([k, v]) => `${k}(${v})`).join(' '));
console.log('青・金    :', top(freqPlus, 10).map(([k, v]) => `${k}(${v})`).join(' '));
console.log('赤        :', top(freqMinus, 8).map(([k, v]) => `${k}(${v})`).join(' '));

// ---- 2. 得能の有無で基礎能力に差が出るか（成績で層別してから比較） ----
// パワプロの選手をプロEYE球の実成績へ名寄せし、同じ成績帯の中で比べる
// 2026-08-04: pawapuro_link は2024-2025版のみで47人しか当たらなかったため、
// 全8作品を名寄せした pawapuro_full_link（1,879人）を使う
const link = db.prepare(`SELECT pawa_rowid, proeye_id FROM pawapuro_full_link`).all();
const idByRowid = new Map(link.map(l => [l.pawa_rowid, l.proeye_id]));

// 各作品の年に対応する実成績（パワプロ2024-2025なら2024年の成績）
const statOf = db.prepare(`SELECT ab, h, hr, so, bb, sb FROM v_batting WHERE player_id=? AND season=? AND ab>=100`);

const withStats = [];
for (const r of rows) {
  const pid = idByRowid.get(r.rowid);
  if (!pid) continue;
  const season = Number(r.work);
  const s = statOf.get(pid, season);
  if (!s) continue;
  withStats.push({ ...r, avg: s.h / s.ab, hrRate: s.hr / s.ab, ab: s.ab, soRate: s.so / s.ab, sb: s.sb });
}
console.log(`\n実成績へ名寄せできた: ${withStats.length}人（同一年の実成績があるもの）`);

if (withStats.length < 30) {
  console.log('※名寄せが少なく層別比較ができない。pawapuro_link は2024-2025版のみを対象に作られているため。');
  console.log('  全作品を名寄せするには link を作り直す必要がある（次の工程）。');
}

/** 成績帯で層別し、得能の有無で能力に差があるかを見る */
function compare(label, ability, has, statKey, binWidth) {
  const g = withStats.filter(r => r[ability] != null);
  if (g.length < 20) return;
  // 成績帯（binWidth刻み）ごとに、持つ群/持たない群の能力平均を出し、差を集める
  const bins = new Map();
  for (const r of g) {
    const b = Math.round(r[statKey] / binWidth);
    if (!bins.has(b)) bins.set(b, { yes: [], no: [] });
    (has(r) ? bins.get(b).yes : bins.get(b).no).push(r[ability]);
  }
  const diffs = [], allYes = [], allNo = [];
  for (const [, v] of bins) {
    if (v.yes.length >= 3 && v.no.length >= 3) diffs.push(mean(v.yes) - mean(v.no));
    allYes.push(...v.yes); allNo.push(...v.no);
  }
  if (!diffs.length) { console.log(`  ${label}: 比較できる成績帯が無い（yes ${allYes.length} / no ${allNo.length}）`); return; }
  const t = tstat(allYes, allNo);
  console.log(`  ${label}: 成績帯${diffs.length}区間で平均 ${mean(diffs) >= 0 ? '+' : ''}${mean(diffs).toFixed(1)}点`
    + `（持つ ${allYes.length}人 / 持たない ${allNo.length}人${t != null ? ` / t=${t.toFixed(2)}` : ''}）`);
}

if (withStats.length >= 30) {
  console.log('\n=== 同じ成績帯の中で、得能の有無が基礎能力に与える差 ===');
  console.log('（マイナスなら「得能を持つ選手ほど基礎能力が低い」＝仕様05 §2の方向と一致）\n');
  console.log('ミート:');
  compare('チャンス持ち', 'meet', r => 'チャンス' in r.ranked, 'avg', 0.02);
  compare('カット打ち', 'meet', r => r.plus.includes('カット打ち'), 'avg', 0.02);
  compare('広角打法', 'meet', r => r.plus.includes('広角打法'), 'avg', 0.02);
  compare('三振(赤)', 'meet', r => r.minus.includes('三振'), 'avg', 0.02);
  console.log('パワー:');
  compare('パワーヒッター', 'power', r => r.plus.includes('パワーヒッター'), 'hrRate', 0.01);
  compare('アーチスト', 'power', r => r.plus.includes('アーチスト'), 'hrRate', 0.01);
  console.log('走力:');
  compare('盗塁持ち', 'speed', r => '盗塁' in r.ranked, 'avg', 0.02);
  compare('内野安打○', 'speed', r => r.plus.includes('内野安打○'), 'avg', 0.02);
}
db.close();

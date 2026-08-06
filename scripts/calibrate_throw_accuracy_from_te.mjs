// 送球（精度）を「送球失策（TE）」から判定する。全守備位置・2014-2026年。
//
// 出典: 1.02 / DELTA の Standard守備成績（Codexが収集、2026-08-05）
//
// なぜ差し替えるか:
//   同じ日に1球データの悪送球から送球精度を作ったが、走者なしの内野ゴロに限ったため
//   **276件・判定できたのは64人中2人**しかなかった。
//   その後 DELTA が失策を **TE（送球失策）と FE（送球以外の失策）に分けて公開している**
//   ことが分かり、13,421件・2,096人・2014-2026年が手に入った。桁が違う。
//
// 検品（2026-08-05実施）:
//   TE + FE が既存の守備成績（プロEYE球）の失策数と一致するかを突合。
//   **7,681件中7,665件が一致（99.8%）**。不一致16件は集計元の違いによる微差。
//
// 判定の型は捕手・内野ゴロ版と同じ:
//   守備位置ごとに「守備機会あたりの送球失策率」の平均を出し、
//   二項分布で「偶然ではこうならない」と言える選手だけに得能を付ける。
//   ★連続値にしないのは事象が稀だから。1〜2件の差を能力差として読まない。
//
// 使い方: node scripts/calibrate_throw_accuracy_from_te.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const raw = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'web_collected_measurements.json'), 'utf8'));
const recs = Array.isArray(raw) ? raw : (raw.records ?? []);

const MIN_CHANCES = 300;   // 守備機会がこれ未満は判定しない
const ALPHA = 0.05;

/** 二項分布の累積確率（k以下になる確率） */
function binomCdf(k, n, p) {
  if (k < 0) return 0;
  if (k >= n) return 1;
  let logC = 0, sum = 0;
  const lp = Math.log(p), lq = Math.log(1 - p);
  for (let i = 0; i <= k; i++) {
    if (i > 0) logC += Math.log((n - i + 1) / i);
    sum += Math.exp(logC + i * lp + (n - i) * lq);
  }
  return Math.min(1, sum);
}

const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const POS_JA = { '投手': '投', '捕手': '捕', '一塁手': '一', '二塁手': '二', '三塁手': '三', '遊撃手': '遊', '左翼手': '左', '中堅手': '中', '右翼手': '右' };

// TE を選手×年×守備位置で集める
const te = new Map();
for (const r of recs) {
  if (r.metric !== 'TE' || !Number.isFinite(r.value)) continue;
  const jp = POS_JA[r.position];
  if (!jp) continue;
  te.set(`${norm(r.player)}|${r.season}|${jp}`, r.value);
}
console.log(`送球失策（TE）: ${te.size}件`);

// 守備機会は既存の守備成績から取る（刺殺＋補殺＋失策）
const fld = db.prepare(`SELECT name, season, position, po, a, e FROM v_fielding`).all();
const byPlayer = new Map();
let matched = 0, unmatched = 0;
for (const f of fld) {
  const k = `${norm(f.name)}|${f.season}|${f.position}`;
  const t = te.get(k);
  if (t == null) { unmatched++; continue; }
  matched++;
  const chances = (f.po ?? 0) + (f.a ?? 0) + (f.e ?? 0);
  if (!(chances > 0)) continue;
  const pk = `${norm(f.name)}|${f.position}`;
  if (!byPlayer.has(pk)) byPlayer.set(pk, { name: f.name, pos: f.position, chances: 0, te: 0, seasons: [] });
  const v = byPlayer.get(pk);
  v.chances += chances; v.te += t; v.seasons.push(f.season);
}
console.log(`守備成績と結べた: ${matched}件（結べなかった ${unmatched}件＝TEが無い年・選手）`);

// 守備位置ごとの基準（送球の距離も頻度も位置で違う）
const byPos = new Map();
for (const v of byPlayer.values()) {
  if (!byPos.has(v.pos)) byPos.set(v.pos, { chances: 0, te: 0 });
  const b = byPos.get(v.pos); b.chances += v.chances; b.te += v.te;
}
console.log('\n守備位置ごとの送球失策率（これを基準にする）');
for (const [p, b] of [...byPos].sort((a, c) => c[1].chances - a[1].chances)) {
  console.log(`  ${p}  ${String(b.chances).padStart(7)}機会  ${String(b.te).padStart(4)}件  ${(b.te / b.chances * 100).toFixed(3)}%`);
}

const judged = [];
for (const [k, v] of byPlayer) {
  if (v.chances < MIN_CHANCES) continue;
  const b = byPos.get(v.pos);
  const p = b.te / b.chances;
  const pLow = binomCdf(v.te, v.chances, p);
  const pHigh = 1 - binomCdf(v.te - 1, v.chances, p);
  let ability = null;
  if (pLow < ALPHA / 2) ability = '送球◎';
  else if (pHigh < ALPHA / 2) ability = '送球×';
  judged.push({
    key: k, name: v.name, pos: v.pos, chances: v.chances, te: v.te,
    rate: v.te / v.chances, expected: v.chances * p,
    seasons: [Math.min(...v.seasons), Math.max(...v.seasons)],
    p_low: pLow, p_high: pHigh, ability,
  });
}
judged.sort((a, b) => a.rate - b.rate);
const withAbility = judged.filter(j => j.ability);
console.log(`\n判定した選手×守備位置: ${judged.length}件（${MIN_CHANCES}機会以上）`);
console.log(`得能が付いた: ${withAbility.length}件（◎${withAbility.filter(j => j.ability === '送球◎').length} / ×${withAbility.filter(j => j.ability === '送球×').length}）`);
console.log('\n送球◎（上位10件）');
for (const j of withAbility.filter(x => x.ability === '送球◎').slice(0, 10)) {
  console.log(`  ${j.name.replace(/　/g, ' ').padEnd(10)} ${j.pos}  ${j.te}件/${j.chances}機会 (${(j.rate * 100).toFixed(3)}%)  期待${j.expected.toFixed(1)}件  ${j.seasons[0]}-${j.seasons[1]}`);
}
console.log('\n送球×（下位10件）');
for (const j of withAbility.filter(x => x.ability === '送球×').slice(-10).reverse()) {
  console.log(`  ${j.name.replace(/　/g, ' ').padEnd(10)} ${j.pos}  ${j.te}件/${j.chances}機会 (${(j.rate * 100).toFixed(3)}%)  期待${j.expected.toFixed(1)}件  ${j.seasons[0]}-${j.seasons[1]}`);
}

const out = path.join(ROOT, 'outputs', 'derived', 'throw_accuracy_from_te.json');
writeFileSync(out, JSON.stringify({
  _source: '1.02 / DELTA Standard守備成績（送球失策TE）× プロEYE球（守備機会）',
  _method: '守備位置ごとの送球失策率を基準に、二項分布で偶然と区別できる選手だけに得能を付ける',
  _validation: 'TE+FE と既存の失策数の突合で7,681件中7,665件（99.8%）が一致',
  _caution: [
    '事象が稀なので連続値にしない（1〜2件の差を能力差として読まない）',
    'TEは2014年から。それ以前は判定できない',
    '複数年を合算している（送球の正確さは年で大きく変わらないという前提）',
  ],
  min_chances: MIN_CHANCES, alpha: ALPHA,
  position_baseline: Object.fromEntries([...byPos].map(([p, b]) => [p, { chances: b.chances, te: b.te, rate: b.te / b.chances }])),
  judged,
}, null, 2), 'utf8');
console.log(`\n保存: ${path.relative(ROOT, out)}`);
db.close();

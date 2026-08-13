// 走力オーナーレビュー表を作る。
//
// 何のためか（2026-08-12 オーナー指摘）:
//   「貴方の査定した走力とその根拠、パワプロの査定した能力と過去の査定の推移、
//     差が大きいものはどうしてそのような差が生まれたかの根拠も考えたうえでテーブルに
//     まとめてから、差が大きいものとあなたの査定信頼度が低いものについて私がレビューする」
//
// つまりオーナーが見るのは全100人ではなく、
//   (a) パワプロとの差が大きい選手  (b) こちらの査定信頼度が低い選手
//   の和集合だけ。それ以外は説明責任だけ果たして通す。
//
// 入力:
//   - GPT/Codex側の成果物（差分handoff経由。branch: agent/claude-speed-redteam-20260812）
//       speed_2026_powerpro_discrepancy_register.json  … 100人・パワプロ2026値・残差
//       speed_2026_100_master_evidence.csv             … NPB+速度・出場・物理証拠の有無
//       pawapuro_speed_history_player_summary_2015_2026.csv … パワプロ査定の推移（stale検出用）
//   - 自作の査定パイプライン（src/cards/pipeline.mjs、2021-2025を5年プール）
//
// 出力:
//   outputs/speed_owner_review_table_2026.md   … オーナーが読む表
//   outputs/derived/speed_owner_review_table_2026.csv … 全100人・機械可読
//
// 使い方: node scripts/build_speed_owner_review_table.mjs <GPT成果物のディレクトリ>

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) { console.error('GPT成果物のディレクトリを渡す'); process.exit(1); }

const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

function parseCSV(t) {
  const rows = []; let f = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; }
      else if (ch === '\n') { f.push(c); rows.push(f); f = []; c = ''; } else if (ch !== '\r') c += ch; } }
  if (c || f.length) { f.push(c); rows.push(f); }
  return rows;
}
const toObjs = (txt) => { const r = parseCSV(txt); const H = r[0];
  return r.slice(1).filter(x => x.length > 3).map(x => Object.fromEntries(H.map((h, i) => [h, x[i]]))); };

// ── 入力 ───────────────────────────────────────────────────────────
const reg = JSON.parse(readFileSync(path.join(SRC, 'speed_2026_powerpro_discrepancy_register.json'), 'utf8'));
const master = toObjs(readFileSync(path.join(SRC, 'speed_2026_100_master_evidence.csv'), 'utf8'));
const ppHist = toObjs(readFileSync(path.join(SRC, 'pawapuro_speed_history_player_summary_2015_2026.csv'), 'utf8'));

const masterBy = new Map(master.map(r => [norm(r.player), r]));
const histBy = new Map();
for (const h of ppHist) {
  for (const k of [norm(h.player), norm(h.player_name)]) if (k && !histBy.has(k)) histBy.set(k, h);
}

// ── 自作DBの名寄せ（外国人は「Ｏ．カリステ」形式） ────────────────────
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const dbNames = db.prepare(
  'SELECT DISTINCT name FROM v_batting WHERE season BETWEEN 2021 AND 2025').all().map(r => r.name);
const dbByNorm = new Map(dbNames.map(n => [norm(n), n]));
function resolveDbName(p) {
  const k = norm(p);
  if (dbByNorm.has(k)) return dbByNorm.get(k);
  // 「Ｏ．カリステ」のように姓の前に頭文字が付く形
  const hit = dbNames.filter(n => norm(n).endsWith(k) || norm(n).includes(k));
  return hit.length === 1 ? hit[0] : null;
}

const ctx = makeContext(db, cfg);
const num = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };

// ── 1人分を組み立てる ──────────────────────────────────────────────
const rows = [];
for (const r of reg.rows) {
  const m = masterBy.get(norm(r.player)) ?? {};
  const h = histBy.get(norm(r.player)) ?? null;
  const dbName = resolveDbName(r.player);

  // 自作査定（2021-2025を5年プール）
  let mine = null, mineStat = null, npbUsed = null, years = null, seasons = null, err = null;
  if (dbName) {
    try {
      const card = appraiseCard(ctx, { name: dbName, mode: '2025', cfg, rv, runNorm, fldNorm }).card;
      const B = card?.abilities?.基礎能力?.走力, R = card?.calc_log?.running;
      mine = B?.value ?? null;
      mineStat = B?.statistical_value ?? B?.value ?? null;   // 実測を混ぜる前の統計値
      npbUsed = B?.measured ?? null;
      years = R?.speed_years ?? null;
      seasons = R?.speed_seasons ?? null;
    } catch (e) { err = e.message; }
  } else err = 'DB名寄せ不可';

  const pp = num(r.powerpro_2026_speed);
  const diff = (mine != null && pp != null) ? mine - pp : null;

  // パワプロ側の実測値から換算した走力（統計値と比べて材料の食い違いを見る）
  const npbDerived = (npbUsed != null && cfg.npb_plus_direct?.models?.top_speed_kmh)
    ? cfg.npb_plus_direct.models.top_speed_kmh.intercept
      + cfg.npb_plus_direct.models.top_speed_kmh.slope * npbUsed : null;
  const materialGap = (mineStat != null && npbDerived != null) ? Math.abs(mineStat - npbDerived) : null;

  const games = num(m.games), pa = num(m.PA);
  const ppUnchanged = h ? num(h.longest_unchanged_days) : null;
  const ppChanges = h ? num(h.num_changes) : null;
  const ppFirst = h ? num(h.first_speed) : null;
  const ppLast = h ? num(h.last_speed) : null;
  const ppTotal = h ? num(h.total_change) : null;
  const ppObs = h ? num(h.num_observations) : null;

  // ── 信頼度（自作査定側）──────────────────────────────────────
  // 低くなる条件を数え上げる。閾値は恣意的に置かず、根拠を各項目に書く。
  const lowFlags = [];
  if (years != null && years <= 1) lowFlags.push('プール1年のみ');
  if (games != null && games < 40) lowFlags.push(`出場${games}試合と少ない`);
  if (materialGap != null && materialGap >= 20) lowFlags.push(`統計値とNPB+実測が${materialGap.toFixed(0)}点食い違う`);
  if (mine == null) lowFlags.push('査定不能');
  const midFlags = [];
  if (years != null && years >= 2 && years <= 2) midFlags.push('プール2年');
  if (games != null && games >= 40 && games < 80) midFlags.push(`出場${games}試合`);
  if (materialGap != null && materialGap >= 10 && materialGap < 20) midFlags.push(`統計値とNPB+が${materialGap.toFixed(0)}点差`);
  const confidence = lowFlags.length ? '低' : (midFlags.length ? '中' : '高');

  // ── パワプロ側の据え置き疑い ─────────────────────────────────
  const staleFlags = [];
  if (ppUnchanged != null && ppUnchanged >= 1095) staleFlags.push(`${Math.round(ppUnchanged / 365)}年以上据え置き`);
  if (ppChanges != null && ppChanges === 0 && ppObs != null && ppObs >= 5) staleFlags.push('一度も変更なし');

  rows.push({
    player: r.player, team: r.team,
    mine, mineStat, npbUsed, npbDerived, materialGap,
    pp, diff, years, seasons, games, pa,
    ppFirst, ppLast, ppTotal, ppChanges, ppUnchanged, ppObs,
    confidence, lowFlags, midFlags, staleFlags,
    directT90: num(m.direct_t90_current_count) ?? 0,
    shortDist: num(m.standardized_short_distance_count) ?? 0,
    err,
  });
}
db.close();

// ── 目盛りのずれと、選手個別の食い違いを分ける ──────────────────────
//
// ★これをやらないとレビュー対象が82人になり、レビューが成立しない。
//   実測: 順序の一致は相関0.83と良いのに、こちらの幅がパワプロの1/1.67しかない。
//   幅が違うだけで、上位の選手は低く・下位の選手は高く出て「差」になる。
//   その分を引いた残りが、本当に食い違っている量。
//
//   ※これは目盛りを直したのではなく**差を分解しただけ**。
//     目盛りの正本はオーナー裁定のアンカー（speed_anchors）で作る。
//     ここでパワプロへ合わせて固定してはいけない（それは参考チェックの物差し化＝禁止）。
const paired = rows.filter(r => r.mine != null && r.pp != null);
const stat = a => { const N = a.length, mu = a.reduce((x, y) => x + y, 0) / N;
  return { N, mu, sd: Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / N) }; };
const SM = stat(paired.map(r => r.mine)), SP = stat(paired.map(r => r.pp));
const corr = (() => { const x = paired.map(r => r.mine), y = paired.map(r => r.pp);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - SM.mu) * (y[i] - SP.mu); sxx += (x[i] - SM.mu) ** 2; syy += (y[i] - SP.mu) ** 2; }
  return sxy / Math.sqrt(sxx * syy); })();

for (const r of rows) {
  r.adj = (r.mine != null && r.pp != null)
    ? ((r.mine - SM.mu) / SM.sd) * SP.sd + SP.mu - r.pp : null;
  const A = r.adj == null ? null : Math.abs(r.adj);

  // ── 差の理由（データから決まるものだけ。憶測は書かない）──
  const reasons = [];
  if (A != null && A >= 8) {
    if (r.materialGap != null && r.materialGap >= 15)
      reasons.push(`こちらの材料が割れている（プレー結果由来${r.mineStat.toFixed(1)} vs NPB+実測由来${r.npbDerived.toFixed(1)}）`);
    if (r.staleFlags.length) reasons.push(`パワプロ側が${r.staleFlags.join('・')}`);
    if (r.years != null && r.years <= 1) reasons.push('こちらは1年分しか材料が無い');
    if (r.games != null && r.games < 40)
      reasons.push(`2026年の出場が${r.games}試合と少なく最高速度を観測しきれていない可能性`);
    if (r.directT90 > 0) reasons.push('直接計測(T90)あり＝物理的な裏付けはこちらにある');
    if (!reasons.length) reasons.push('原因未特定（材料・出場・パワプロ推移のいずれにも異常が見当たらない）');
  }
  r.reasons = reasons;

  // ── レビューの段 ──────────────────────────────────────────
  //   1段目: 本当に食い違いが大きい / 食い違い中程度かつこちらの信頼度が低い
  //   2段目: それ以外で食い違いか信頼度に引っかかるもの
  if (r.mine == null) r.tier = 1;
  else if (A >= 12 || (A >= 8 && r.confidence === '低')) r.tier = 1;
  else if (A >= 8 || r.confidence === '低') r.tier = 2;
  else r.tier = 3;
  r.needReview = r.tier <= 2;
}

// ── 出力 ───────────────────────────────────────────────────────────
const f1 = v => v == null ? '-' : (typeof v === 'number' ? v.toFixed(1) : v);
const sg = v => v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(1);
rows.sort((a, b) => (a.tier - b.tier) || (Math.abs(b.adj ?? 0) - Math.abs(a.adj ?? 0)));

const t1 = rows.filter(r => r.tier === 1);
const t2 = rows.filter(r => r.tier === 2);
const t3 = rows.filter(r => r.tier === 3);

const L = [];
const push = s => L.push(s);
push('# 走力 オーナーレビュー表 — 2026年 100人\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);

push('## 先に読んでほしい診断\n');
push('100人をこちらで査定し、パワプロ2026と突き合わせた結果:\n');
push('```text');
push(`順序の一致（相関）      : ${corr.toFixed(3)}   ← 良い。誰が速いかの並びはほぼ合っている`);
push(`中心のずれ              : ${(SM.mu - SP.mu).toFixed(1)}点   ← 小さい`);
push(`幅（ばらつき）の比      : ${(SP.sd / SM.sd).toFixed(2)}倍   ← ★こちらの幅が狭すぎる`);
push(`  こちらの幅 ${SM.sd.toFixed(1)} / パワプロの幅 ${SP.sd.toFixed(1)}`);
push('```\n');
push('**差の大半は選手個別の問題ではなく、目盛りの幅が違うことの機械的な結果です。**');
push('幅が狭いと、速い選手は自動的に低く・遅い選手は自動的に高く出ます。');
push('この分を引かずにレビューすると、82人分の「差」を1人ずつ見ることになり、');
push('**目盛りの問題を選手ごとに手で直す**ことになってしまいます。\n');
push('そこで下の表では差を2つに分けました。\n');
push('- **生の差** = 私の査定 − パワプロ（目盛りのずれを含む）');
push('- **本当の食い違い** = 幅を揃えたうえで残った差。**こちらがレビューの対象**\n');
push('※ 幅を揃えたのは差を分解するためで、パワプロに合わせて確定したわけではありません。');
push('目盛りの正本はアンカー（別途裁定いただく目安表）で作ります。\n');

push('## 読み方\n');
push('- **私の査定** = 実際のプレー結果（三塁打割合・併殺回避・内野安打・進塁・走塁貢献）を');
push('  2021-2025年でまとめた値に、NPB+アプリの実測（最高速度）を確からしさに応じて混ぜたもの');
push('- **内訳** = 「プレー結果だけの値 / NPB+実測だけの値」。**この2つが離れているほど材料が割れている**');
push('- **パワプロの推移** = 2015-2026年の査定履歴。長く据え置きなら「実力が変わったのに直していない」疑い');
push('- **信頼度** = こちらの査定の確からしさ（出場量・使えた年数・材料の食い違いから判定）\n');
push(`**1段目（優先してレビュー）: ${t1.length}人** / 2段目（余力があれば）: ${t2.length}人 / 通す: ${t3.length}人\n`);
push('---\n');

const table = (list) => {
  push('| 選手 | 私の査定 | 内訳(プレー結果/NPB+) | パワプロ | 生の差 | **本当の食い違い** | 信頼度 | パワプロの推移 | 差が生まれた理由 |');
  push('|---|---|---|---|---|---|---|---|---|');
  for (const r of list) {
    const trend = r.ppFirst != null
      ? `${f1(r.ppFirst)}→${f1(r.ppLast)}（${r.ppChanges ?? '-'}回変更${r.ppUnchanged != null ? `・最長${(r.ppUnchanged / 365).toFixed(1)}年据置` : ''}）`
      : '履歴なし';
    const conf = r.confidence + (r.lowFlags.length ? `（${r.lowFlags.join('・')}）`
      : r.midFlags.length ? `（${r.midFlags.join('・')}）` : '');
    const reason = r.reasons.length ? r.reasons.join('／')
      : (r.confidence === '低' ? 'こちらの信頼度が低い' : (r.mine == null ? `査定不能（${r.err}）` : '-'));
    push(`| ${r.player} | ${f1(r.mine)} | ${f1(r.mineStat)} / ${f1(r.npbDerived)} | ${f1(r.pp)} | ${sg(r.diff)} | **${sg(r.adj)}** | ${conf} | ${trend} | ${reason} |`);
  }
  push('');
};

push('## 1段目 — 優先してレビューしてほしい選手\n');
table(t1);
push('### 記入欄（1段目）\n');
push('**気になる選手だけ**、あなたの点数か「こちらでよい」を書いてください。全部埋める必要はありません。\n');
push('| 選手 | 私の査定 | パワプロ | あなたの判断 |');
push('|---|---|---|---|');
for (const r of t1) push(`| ${r.player} | ${f1(r.mine)} | ${f1(r.pp)} | |`);
push('');
push('---\n');
push('## 2段目 — 余力があれば\n');
table(t2);
push('---\n');
push('## 通す選手（レビュー不要・参考）\n');
push('| 選手 | 私の査定 | パワプロ | 生の差 | 本当の食い違い | 信頼度 |');
push('|---|---|---|---|---|---|');
for (const r of t3) push(`| ${r.player} | ${f1(r.mine)} | ${f1(r.pp)} | ${sg(r.diff)} | ${sg(r.adj)} | ${r.confidence} |`);

writeFileSync(path.join(ROOT, 'outputs', 'speed_owner_review_table_2026.md'), L.join('\n'), 'utf8');

// CSV（全100人・機械可読）
const cols = ['player', 'team', 'mine', 'mineStat', 'npbUsed', 'npbDerived', 'materialGap', 'pp', 'diff', 'adj', 'tier',
  'years', 'games', 'pa', 'ppFirst', 'ppLast', 'ppTotal', 'ppChanges', 'ppUnchanged', 'ppObs',
  'confidence', 'directT90', 'shortDist', 'bigDiff', 'needReview'];
const csv = [cols.join(',')];
for (const r of rows) csv.push(cols.map(c => {
  const v = r[c]; if (v == null) return '';
  return typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}).join(','));
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_owner_review_table_2026.csv'), csv.join('\n'), 'utf8');

console.log(`1段目 ${t1.length}人 / 2段目 ${t2.length}人 / 通す ${t3.length}人 / 合計 ${rows.length}人`);
console.log(`相関 ${corr.toFixed(3)} 中心差 ${(SM.mu-SP.mu).toFixed(1)} 幅比 ${(SP.sd/SM.sd).toFixed(2)}`);
console.log('査定できなかった:', rows.filter(r => r.mine == null).map(r => `${r.player}(${r.err})`).join(', ') || 'なし');

// 内野手の肩力の代替指標を実データから導く（Sol仕様 04 §4.3 の空白を埋める）。
//
// 問題: NPB Basement は ARM（送球による失点抑止）を外野手と捕手にしか出していない。
//       内野 2,367 件すべてが arm=null で、内野手の肩が未査定のまま（2026-08-01 audit_coverage で検出）。
//       日本には内野手の送球速度の公開データが無い。
//
// オーナー裁定（2026-08-01）: 守れる位置から推定する＋その位置を守れること自体を下限の証拠にする。
//
// 恣意的な係数を置かないための測定設計:
//   「外野も内野も守った選手」の**外野で実測された ARM** を、その選手が守った内野位置ごとに集計する。
//   ある内野位置を守っている選手の肩が実際どれくらいかを、実測値だけで推定できる。
//   1選手1観測（複数季は守備イニングで合算）にして疑似反復を避ける。
//
// 出力: configs/fielding_norms.json の infieldArmPrior（本スクリプトが書き込む）
//       outputs/derived/infield_arm_prior.json（測定の生結果）

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const q = s => db.prepare(s).all();

const ORDER = ['SS', '3B', '2B', '1B']; // 肩の要求が高い順（仮説。データで検証する）
const MIN_OF_INN = 100;   // 外野ARMの信頼に足る守備イニング
const MIN_INF_INN = 100;  // 「その位置を守った」と認める守備イニング

// --- 1) 外野で ARM が実測されている選手（1選手1観測） ---
const ofRows = q(`
  select player_id, sum(inn) inn, sum(arm) arm
  from bm_fld
  where farm=0 and arm is not null and pos in ('LF','RF','CF')
  group by player_id having sum(inn) >= ${MIN_OF_INN}
`);

// --- 2) 各選手が守った内野位置 ---
const infRows = q(`
  select player_id, pos, sum(inn) inn
  from bm_fld
  where farm=0 and pos in ('1B','2B','3B','SS') and inn > 0
  group by player_id, pos
`);
const infByPlayer = new Map();
for (const r of infRows) {
  if (!infByPlayer.has(r.player_id)) infByPlayer.set(r.player_id, {});
  infByPlayer.get(r.player_id)[r.pos] = r.inn;
}

// --- 3) 「最も肩を要求される位置」ごとに外野ARM率を集める ---
const buckets = {};
const noInfield = [];
for (const r of ofRows) {
  const rate = (r.arm / r.inn) * 1000;
  const played = infByPlayer.get(r.player_id);
  if (!played) { noInfield.push(rate); continue; }
  const top = ORDER.find(p => (played[p] || 0) >= MIN_INF_INN);
  if (top) (buckets[top] ??= []).push(rate);
}

const stat = a => {
  const n = a.length;
  const mean = a.reduce((x, y) => x + y, 0) / n;
  const sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, se: n > 1 ? sd / Math.sqrt(n) : null };
};

const raw = {};
for (const p of ORDER) if (buckets[p]?.length >= 3) raw[p] = stat(buckets[p]);
const baseline = stat(noInfield); // 内野経験なしの外野手＝スケールの基準

// --- 4) 単調化（PAVA）。推定ブレによる順序の逆転をならす ---
// 2026-07-31 の水準別gammaで採った手続きと同じ。標本の小さい位置が順序を壊すのを防ぐ。
const blocks = ORDER.filter(p => raw[p]).map(p => ({ pos: [p], sum: raw[p].mean * raw[p].n, w: raw[p].n }));
for (let i = 0; i < blocks.length - 1;) {
  const a = blocks[i], b = blocks[i + 1];
  if (a.sum / a.w >= b.sum / b.w) { i++; continue; }
  blocks.splice(i, 2, { pos: [...a.pos, ...b.pos], sum: a.sum + b.sum, w: a.w + b.w });
  if (i > 0) i--;
}
const iso = {};
for (const b of blocks) for (const p of b.pos) iso[p] = b.sum / b.w;

// --- 5) zスケールへ。分母は「内野経験なしの外野手」の選手間ばらつき ---
const scaleSd = baseline.sd;
const prior = {};
for (const p of ORDER) if (iso[p] != null) prior[p] = { z: iso[p] / scaleSd, arm_per_1000inn: iso[p] };

// --- 6) 検定（最も肩を要求される位置 vs 最も要求されない位置） ---
const hi = raw[ORDER[0]], lo = raw[ORDER[ORDER.length - 1]];
const diff = hi.mean - lo.mean;
const seDiff = Math.hypot(hi.se, lo.se);

const out = {
  method: '外野で実測されたARMを、同じ選手が守った内野位置ごとに集計（1選手1観測）',
  measured_at: '2026-08-01',
  thresholds: { min_of_innings: MIN_OF_INN, min_infield_innings: MIN_INF_INN },
  raw_by_position: raw,
  baseline_no_infield: baseline,
  isotonic: iso,
  prior_z: prior,
  test: {
    contrast: `${ORDER[0]} - ${ORDER.at(-1)}`,
    diff, se: seDiff, t: diff / seDiff,
    ordering_by_chance: '4位置が仮説どおりの順に並ぶ確率 = 1/24 = 4.2%',
  },
  caveats: [
    '標本は「外野も内野も守った選手」＝ユーティリティ寄りに偏る。純粋な遊撃手は含まれない',
    '三塁と二塁は識別できず（二塁 n が小さい）、単調化で同値に併合された',
    '推定値であり実測ではない。カード上は is_estimated=true を立てる',
  ],
};

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'infield_arm_prior.json'), JSON.stringify(out, null, 2), 'utf8');

// configs/fielding_norms.json へ書き戻す
const normPath = path.join(ROOT, 'configs', 'fielding_norms.json');
const norms = JSON.parse(readFileSync(normPath, 'utf8'));
norms.infieldArmPrior = {
  _basis: out.method,
  _measured_at: out.measured_at,
  _test: out.test,
  _caveats: out.caveats,
  scale_sd: scaleSd,
  byPos: prior,
};
writeFileSync(normPath, JSON.stringify(norms, null, 2), 'utf8');

console.log(JSON.stringify(out, null, 2));

// パワー査定に長打率(ISO)をどれだけ混ぜるかを実測で決める（Sol仕様 02 §6.4「本塁打だけで決めない」）。
//
// 考え方: 能力の真値に近い推定ほど、翌年の成績をよく予測する。
//   今年の推定（本塁打のみ / ISOのみ / 両者のブレンド）で、翌年の環境補正済み本塁打率を予測し、
//   予測誤差が最小になる混ぜ方を選ぶ。
//   ブレンド: w = HR / (HR + K)。K=0なら本塁打のみ、K=∞ならISOのみ。
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_AB = Number(process.argv[2] || 300);
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lg = {};
for (const r of db.prepare(`SELECT season,SUM(h) h,SUM(ab) ab,SUM(hr) hr FROM v_batting WHERE 1=1 GROUP BY season`).all()) {
  lg[r.season] = { avg: r.h / r.ab, hr: r.hr / r.ab };
}
const REF = lg[cfg.environment.reference_season];
const GH = cfg.environment.gamma_hr;

const rows = db.prepare(`
  SELECT season, player_id, name, ab, h, b2, b3, hr
  FROM v_batting WHERE ab >= ?`).all(MIN_AB);

const envFactor = s => Math.pow(REF.hr / lg[s].hr, GH);
// 三塁打は脚力寄与が大きいので二塁打相当として扱う（Sol仕様 §6.4「2B/3Bの脚力寄与をパワーへ過剰に入れない」）
const iso2 = r => (r.b2 + r.b3 + 3 * r.hr) / r.ab;

const recs = rows.map(r => ({
  ...r,
  hrEnv: (r.hr / r.ab) * envFactor(r.season),
  isoEnv: iso2(r) * Math.pow(envFactor(r.season), 0.5),
  xbh: r.b2 + r.b3 + r.hr,
}));

// ISO → 本塁打率 の対応。
// 線形回帰だと切片が負になり低ISO領域が0に潰れて識別できないため、べき乗則で当てる:
//   HR率 = a × ISO^b  （両対数の直線回帰）。ISO>0なら必ず正の値を返し単調。
const n = recs.length;
const fit = recs.filter(r => r.hrEnv > 0 && r.isoEnv > 0);
const lx = fit.map(r => Math.log(r.isoEnv)), ly = fit.map(r => Math.log(r.hrEnv));
const mlx = lx.reduce((a, b) => a + b, 0) / lx.length;
const mly = ly.reduce((a, b) => a + b, 0) / ly.length;
let sxy = 0, sxx = 0;
for (let i = 0; i < lx.length; i++) { sxy += (lx[i] - mlx) * (ly[i] - mly); sxx += (lx[i] - mlx) ** 2; }
const b = sxy / sxx;
const a = Math.exp(mly - b * mlx);
const hrFromIso = iso => (iso > 0 ? a * Math.pow(iso, b) : 0);

// 連続2年ペアを作る
const byPlayer = new Map();
for (const r of recs) {
  if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, new Map());
  byPlayer.get(r.player_id).set(r.season, r);
}
const pairs = [];
for (const [, ss] of byPlayer) for (const [s, cur] of ss) {
  const nxt = ss.get(s + 1);
  if (nxt) pairs.push([cur, nxt]);
}

function evaluate(K) {
  let se = 0;
  for (const [cur, nxt] of pairs) {
    // K=0 は「本塁打のみ」。本塁打0本でも 0/0 にならないよう w=1 に落とす
    const w = K === Infinity ? 0 : (K === 0 ? 1 : cur.hr / (cur.hr + K));
    const est = w * cur.hrEnv + (1 - w) * hrFromIso(cur.isoEnv);
    se += (est - nxt.hrEnv) ** 2;
  }
  return Math.sqrt(se / pairs.length);
}

console.log(`\n=== パワー査定へのISO混合率を実測 (打数${MIN_AB}以上, 連続2年ペア ${pairs.length}件) ===\n`);
console.log(`ISO→本塁打率の回帰（べき乗則）: HR率 = ${a.toFixed(5)} × ISO^${b.toFixed(3)}  (n=${fit.length})`);
console.log('\nK      混合の意味                          翌年予測のRMSE');
const candidates = [0, 1, 2, 3, 5, 8, 12, 20, 40, Infinity];
const results = candidates.map(K => ({ K, rmse: evaluate(K) }));
for (const { K, rmse } of results) {
  const label = K === 0 ? '本塁打のみ' : K === Infinity ? 'ISOのみ' : `HR/(HR+${K})`;
  console.log(String(K === Infinity ? '∞' : K).padEnd(7) + label.padEnd(36) + rmse.toExponential(4));
}
const best = results.reduce((a, b) => (b.rmse < a.rmse ? b : a));
console.log(`\n最良: K = ${best.K === Infinity ? '∞（ISOのみ）' : best.K}  RMSE=${best.rmse.toExponential(4)}`);
const onlyHr = results.find(r => r.K === 0).rmse;
console.log(`本塁打のみ(K=0)に対する改善: ${((1 - best.rmse / onlyHr) * 100).toFixed(1)}%`);
db.close();

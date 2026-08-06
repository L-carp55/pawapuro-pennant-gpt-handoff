// 環境補正の効き具合（gamma_HR）を能力帯別に実測する。
//
// 背景: プール回帰では gamma_HR=0.91 だが、これはリーグ全体の平均的な追随度。
// 強打者はボールの変化に左右されにくい（自力で柵越えできる）ため、
// 能力帯によって追随度が違う可能性がある。オーナー指摘（2026-07-31）を受けて能力帯別に測る。
//
// 方法: 同一選手の連続2年ペアで log(個人の本塁打率変化) を log(リーグ変化) に回帰する。
// 前年の本塁打水準で層別し、層ごとの傾きを出す。
import { DatabaseSync } from 'node:sqlite';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_AB = Number(process.argv[2] || 200);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lg = {};
for (const r of db.prepare(`SELECT season, SUM(hr) hr, SUM(ab) ab FROM v_batting GROUP BY season`).all()) {
  lg[r.season] = r.hr / r.ab;
}

const rows = db.prepare(`
  SELECT player_id, season, ab, hr FROM v_batting WHERE ab >= ? AND position <> '投'`).all(MIN_AB);
const by = new Map();
for (const r of rows) {
  if (!by.has(r.player_id)) by.set(r.player_id, new Map());
  by.get(r.player_id).set(r.season, r);
}

const SMOOTH = 1.0;
const hrRate = p => (p.hr + SMOOTH) / (p.ab + SMOOTH / 0.02);
// 能力帯の判定には「前年の500打席相当本塁打」を使う（打数の差を除くため）
const AB_REF = 490;
const eqHr = p => (p.hr / p.ab) * AB_REF;

const pairs = [];
for (const [, ss] of by) {
  for (const [s, cur] of ss) {
    const prev = ss.get(s - 1);
    if (!prev || !lg[s] || !lg[s - 1]) continue;
    const x = Math.log(lg[s] / lg[s - 1]);
    const y = Math.log(hrRate(cur) / hrRate(prev));
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) < 1e-6) continue;
    pairs.push({ x, y, tier: eqHr(prev), ab: cur.ab });
  }
}

function regress(ps) {
  let sxy = 0, sxx = 0;
  for (const p of ps) { sxy += p.x * p.y; sxx += p.x * p.x; }
  const slope = sxy / sxx;
  // 標準誤差
  let ss = 0;
  for (const p of ps) ss += (p.y - slope * p.x) ** 2;
  const se = Math.sqrt(ss / (ps.length - 1) / sxx);
  return { slope, se, n: ps.length };
}

const all = regress(pairs);
console.log(`=== 環境補正の効き具合を能力帯別に実測 (打数${MIN_AB}以上、${pairs.length}ペア) ===\n`);
console.log(`全体: gamma = ${all.slope.toFixed(3)} ± ${all.se.toFixed(3)}\n`);

// 前年の換算本塁打で層別
const TIERS = [[0, 5], [5, 10], [10, 20], [20, 30], [30, 99]];
console.log('前年の換算本塁打  n     gamma   標準誤差');
const tierResults = [];
for (const [lo, hi] of TIERS) {
  const g = pairs.filter(p => p.tier >= lo && p.tier < hi);
  if (g.length < 30) { console.log(`${lo}-${hi}本`.padEnd(16) + String(g.length).padStart(5) + '   （サンプル不足）'); continue; }
  const r = regress(g);
  tierResults.push({ lo, hi, ...r });
  console.log(`${lo}-${hi}本`.padEnd(16) + String(r.n).padStart(5) + r.slope.toFixed(3).padStart(9) + r.se.toFixed(3).padStart(10));
}

console.log('\n解釈: gammaが小さいほど、その層はリーグ環境の変化に流されにくい');
const strong = tierResults.filter(t => t.lo >= 20);
const weak = tierResults.filter(t => t.hi <= 10);
if (strong.length && weak.length) {
  const sAvg = strong.reduce((a, t) => a + t.slope * t.n, 0) / strong.reduce((a, t) => a + t.n, 0);
  const wAvg = weak.reduce((a, t) => a + t.slope * t.n, 0) / weak.reduce((a, t) => a + t.n, 0);
  console.log(`強打者層(20本以上) gamma=${sAvg.toFixed(3)} / 非力層(10本未満) gamma=${wAvg.toFixed(3)}`);
  console.log(sAvg < wAvg ? '→ 強打者ほど環境に流されにくい。能力帯別gammaに根拠あり'
    : '→ 強打者の方が流されやすい。能力帯別gammaの根拠は弱い');
}

await writeFile(path.join(ROOT, 'outputs', 'derived', 'gamma_by_tier.json'),
  JSON.stringify({ minAb: MIN_AB, abRef: AB_REF, overall: all, tiers: tierResults }, null, 2), 'utf8');
console.log('\n→ outputs/derived/gamma_by_tier.json');
db.close();

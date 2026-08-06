// Sol仕様 03 §5.2 の gamma_HR（環境補正の効き具合）を実データから実測する。
// 仕様では未校正（PROVISIONAL、旧値0.45-0.60）。
//
// 考え方: リーグ全体の本塁打率が変わった時、個人の本塁打率がどれだけ追随するか。
//   log(個人HR率_t / 個人HR率_{t-1}) = gamma × log(リーグHR率_t / リーグHR率_{t-1}) + 誤差
// 同一選手の連続2年ペアを大量に集め、この傾きを最小二乗で求める。
// gamma=1 なら環境変化に完全比例、gamma<1 なら部分的にしか追随しない。
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_AB = Number(process.argv[2] || 200);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lg = {};
for (const r of db.prepare(`
  SELECT season, SUM(hr) hr, SUM(ab) ab, SUM(h) h FROM v_batting
  WHERE 1=1 GROUP BY season`).all()) {
  lg[r.season] = { hr: r.hr / r.ab, avg: r.h / r.ab };
}

const players = db.prepare(`
  SELECT player_id, season, SUM(ab) ab, SUM(hr) hr, SUM(h) h
  FROM v_batting WHERE ab >= ?
  GROUP BY player_id, season`).all(MIN_AB);

const byPlayer = new Map();
for (const p of players) {
  if (!byPlayer.has(p.player_id)) byPlayer.set(p.player_id, new Map());
  byPlayer.get(p.player_id).set(p.season, p);
}

// 本塁打0本だと対数が取れないため、打数に応じた平滑化を入れる（Laplace補正）
const SMOOTH = 1.0;
const hrRate = p => (p.hr + SMOOTH) / (p.ab + SMOOTH / 0.02);

function regress(pairs) {
  // 原点を通る回帰（環境が変わらなければ個人も変わらない、という制約）
  let sxy = 0, sxx = 0;
  for (const [x, y] of pairs) { sxy += x * y; sxx += x * x; }
  const slope = sxy / sxx;
  // 決定係数
  let ssRes = 0, ssTot = 0;
  const meanY = pairs.reduce((a, [, y]) => a + y, 0) / pairs.length;
  for (const [x, y] of pairs) { ssRes += (y - slope * x) ** 2; ssTot += (y - meanY) ** 2; }
  return { slope, r2: 1 - ssRes / ssTot, n: pairs.length };
}

const hrPairs = [], avgPairs = [];
for (const [, seasons] of byPlayer) {
  for (const [season, cur] of seasons) {
    const prev = seasons.get(season - 1);
    if (!prev) continue;
    if (!lg[season] || !lg[season - 1]) continue;

    const xHr = Math.log(lg[season].hr / lg[season - 1].hr);
    const yHr = Math.log(hrRate(cur) / hrRate(prev));
    if (Number.isFinite(xHr) && Number.isFinite(yHr) && Math.abs(xHr) > 1e-6) hrPairs.push([xHr, yHr]);

    const xAvg = Math.log(lg[season].avg / lg[season - 1].avg);
    const yAvg = Math.log((cur.h / cur.ab) / (prev.h / prev.ab));
    if (Number.isFinite(xAvg) && Number.isFinite(yAvg) && Math.abs(xAvg) > 1e-6) avgPairs.push([xAvg, yAvg]);
  }
}

const hr = regress(hrPairs);
const avg = regress(avgPairs);

console.log(`\n=== 環境補正の効き具合を実測 (打数${MIN_AB}以上の連続2年ペア) ===\n`);
console.log(`本塁打  gamma_HR  = ${hr.slope.toFixed(3)}   (ペア数 ${hr.n}, R²=${hr.r2.toFixed(3)})`);
console.log(`打率    gamma_AVG = ${avg.slope.toFixed(3)}   (ペア数 ${avg.n}, R²=${avg.r2.toFixed(3)})`);
console.log(`\nSol仕様の旧値(未校正): gamma_HR = 0.45〜0.60`);

// 参考: 打数の下限を変えたときの安定性
console.log('\n打数下限を変えたときの gamma_HR:');
for (const minAb of [100, 150, 200, 300, 400]) {
  const ps = db.prepare(`
    SELECT player_id, season, SUM(ab) ab, SUM(hr) hr FROM v_batting
    WHERE ab >= ? GROUP BY player_id, season`).all(minAb);
  const bp = new Map();
  for (const p of ps) { if (!bp.has(p.player_id)) bp.set(p.player_id, new Map()); bp.get(p.player_id).set(p.season, p); }
  const pairs = [];
  for (const [, ss] of bp) for (const [s, cur] of ss) {
    const prev = ss.get(s - 1); if (!prev || !lg[s] || !lg[s - 1]) continue;
    const x = Math.log(lg[s].hr / lg[s - 1].hr), y = Math.log(hrRate(cur) / hrRate(prev));
    if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) > 1e-6) pairs.push([x, y]);
  }
  const r = regress(pairs);
  console.log(`  打数${String(minAb).padStart(3)}以上: gamma=${r.slope.toFixed(3)} (n=${r.n})`);
}
db.close();

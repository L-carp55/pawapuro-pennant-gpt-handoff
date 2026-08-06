// 環境変化に対する追随度が「分位点によって違うか」を実測する。
//
// オーナーの問い（2026-07-31）:
//   「gamma値と同様に変化するのは中央値で、極端な値の押し上げられ方・押し下げられ方は
//     中央値と比べるとマイルドになる、が統計的に証明できればそうしてほしい」
//
// 方法A（分位点回帰）: 各年のリーグ本塁打率と、各年の選手分布の分位点(50%,80%,90%,95%,99%)を対応させ、
//   log(分位点) を log(リーグ率) に回帰する。傾きが分位点ごとに違うかを見る。
//   ※ これは「その水準の選手が何本打つか」を年をまたいで追う見方（反実仮想に近い）。
//
// 方法B（同一選手の層別）: 前年の水準で層別した gamma（calibrate_gamma_tiered.mjs）。
//   こちらは「同じ選手が翌年どう動くか」で、平均回帰の影響を受ける。
import { DatabaseSync } from 'node:sqlite';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_PA = Number(process.argv[2] || 350);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const seasons = db.prepare(`SELECT DISTINCT season FROM v_batting ORDER BY season`).all().map(r => r.season);
const AB_REF = 490;

const rows = [];
for (const s of seasons) {
  const lgRow = db.prepare(`SELECT SUM(hr) hr, SUM(ab) ab FROM v_batting WHERE season=?`).get(s);
  const players = db.prepare(`
    SELECT hr, ab FROM v_batting WHERE season=? AND pa>=? AND position<>'投'`).all(s, MIN_PA);
  if (players.length < 30) continue;
  const eq = players.map(p => (p.hr / p.ab) * AB_REF).sort((a, b) => a - b);
  const q = f => eq[Math.min(eq.length - 1, Math.floor(eq.length * f))];
  rows.push({
    season: s, lg: lgRow.hr / lgRow.ab, n: eq.length,
    p50: q(0.50), p80: q(0.80), p90: q(0.90), p95: q(0.95), p99: q(0.99), max: eq[eq.length - 1],
  });
}

function regress(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const slope = sxy / sxx;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (ys[i] - (my + slope * (xs[i] - mx))) ** 2;
  return { slope, se: Math.sqrt(ss / (n - 2) / sxx), r2: (sxy / Math.sqrt(sxx * syy)) ** 2, n };
}

const lx = rows.map(r => Math.log(r.lg));
console.log(`=== 分位点ごとの環境追随度 (規定打席${MIN_PA}以上、${rows.length}シーズン) ===\n`);
console.log('各年の選手分布の分位点が、リーグ本塁打率の変化にどれだけ追随するか\n');
console.log('分位点    gamma   標準誤差    R²    中央値との差');
const base = regress(lx, rows.map(r => Math.log(r.p50)));
const results = {};
for (const [key, label] of [['p50', '中央値'], ['p80', '上位20%'], ['p90', '上位10%'], ['p95', '上位5%'], ['p99', '上位1%']]) {
  const r = regress(lx, rows.map(x => Math.log(x[key])));
  results[key] = r;
  const diff = r.slope - base.slope;
  console.log(label.padEnd(9) + r.slope.toFixed(3).padStart(7) + r.se.toFixed(3).padStart(10) + r.r2.toFixed(3).padStart(8)
    + (key === 'p50' ? '   —' : ('   ' + (diff >= 0 ? '+' : '') + diff.toFixed(3) + (Math.abs(diff) > 2 * Math.sqrt(r.se ** 2 + base.se ** 2) ? ' *有意' : ' (誤差内)'))));
}

console.log('\n判定:');
const upper = ['p90', 'p95', 'p99'].map(k => results[k].slope);
const upperAvg = upper.reduce((a, b) => a + b, 0) / upper.length;
if (upperAvg < base.slope) {
  const se = Math.sqrt(results.p95.se ** 2 + base.se ** 2);
  const t = (base.slope - results.p95.slope) / se;
  console.log(`  上位層の平均gamma=${upperAvg.toFixed(3)} < 中央値gamma=${base.slope.toFixed(3)}`);
  console.log(`  上位5%と中央値の差: ${(base.slope - results.p95.slope).toFixed(3)} (t=${t.toFixed(2)})`);
  console.log(t > 2 ? '  → 統計的に有意。強打者ほど環境に流されにくいと言える'
    : '  → 方向は仮説と一致するが有意でない（t<2）。誤差の範囲');
} else {
  console.log(`  上位層の平均gamma=${upperAvg.toFixed(3)} >= 中央値gamma=${base.slope.toFixed(3)}`);
  console.log('  → 仮説（極端な値ほどマイルド）は支持されない');
}

console.log('\n各年の実測値（参考）');
console.log('年    リーグ率   中央値  上位20%  上位10%   上位5%   上位1%');
for (const r of rows) {
  console.log(String(r.season).padEnd(6) + (r.lg * 1000).toFixed(1).padStart(8)
    + r.p50.toFixed(1).padStart(9) + r.p80.toFixed(1).padStart(9) + r.p90.toFixed(1).padStart(9)
    + r.p95.toFixed(1).padStart(9) + r.p99.toFixed(1).padStart(9));
}

await writeFile(path.join(ROOT, 'outputs', 'derived', 'gamma_by_quantile.json'),
  JSON.stringify({ minPa: MIN_PA, abRef: AB_REF, seasons: rows, regressions: results }, null, 2), 'utf8');
console.log('\n→ outputs/derived/gamma_by_quantile.json');
db.close();

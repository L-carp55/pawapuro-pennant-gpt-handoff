// 「アウトのうちのフライ率／ゴロ率」から「全打球のうちの割合」への変換式を較正する。
//
// 出典: プロ野球ヌルデータ置き場f3（アウト内容の割合、2006-2022）
//       NPB Basement（全打球に対する構成比、2020-2026）
//
// オーナー承認（2026-08-05）: 打球構成比の変換式を較正して弾道を2006年まで広げる。
//
// なぜ変換が要るか:
//   弾道は打球の構成（ゴロ／ライナー／外野フライ／内野フライ）から逆算している。
//   その構成比は NPB Basement の2020年以降しか無く、**2019年以前は弾道が査定できない**。
//   一方、ヌルデータ置き場は2006年から「アウトになった打球のうちフライが何割か」を持っている。
//   これは分母が違う（安打になった打球が抜けている）ので、そのままでは使えない。
//
// 較正のしかた:
//   両方がある2020-2022年で突き合わせ、片方からもう片方を予測する式を作る。
//   ★これは**推定**なので、査定側では推定フラグを立てて扱う（実測と混ぜない）。
//
// 使い方: node scripts/calibrate_batted_ball_conversion.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const raw = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'web_collected_measurements.json'), 'utf8'));
const recs = Array.isArray(raw) ? raw : (raw.records ?? []);
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const fo = new Map(), go = new Map();
for (const r of recs) {
  const k = `${norm(r.player)}|${r.season}`;
  if (r.metric === 'fly_out_pct') fo.set(k, r.value);
  if (r.metric === 'ground_out_pct') go.set(k, r.value);
}

// 重複する2020-2022で突合（IDの体系が違うので player_link を経由する）
const bm = db.prepare(`
  SELECT b.name, m.season, m.gb_pct, m.ld_pct, m.offb_pct, m.iffb_pct
  FROM v_bm_bat m
  JOIN player_link l ON l.bm_id = m.player_id
  JOIN v_batting b ON b.player_id = l.proeye_id AND b.season = m.season
  WHERE m.season BETWEEN 2020 AND 2022 AND m.offb_pct IS NOT NULL AND m.farm = 0 AND b.pa >= 200`).all();

function fit(xs, ys) {                     // 最小二乗（y = a + b x）
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const u = xs[i] - mx, v = ys[i] - my; sxy += u * v; sxx += u * u; syy += v * v; }
  const b = sxy / sxx, a = my - b * mx;
  const r = sxy / Math.sqrt(sxx * syy);
  // 予測の外し具合（実測との差の絶対値の平均）
  let mae = 0;
  for (let i = 0; i < n; i++) mae += Math.abs(ys[i] - (a + b * xs[i]));
  return { intercept: a, slope: b, r, mae: mae / n, n };
}

const rows = [];
for (const r of bm) {
  const k = `${norm(r.name)}|${r.season}`;
  const f = fo.get(k), g = go.get(k);
  if (f == null || g == null) continue;
  rows.push({
    flyOut: f, groundOut: g,
    fly: (r.offb_pct ?? 0) + (r.iffb_pct ?? 0),     // 全打球のうちフライ（外野＋内野）
    gb: r.gb_pct, ld: r.ld_pct, offb: r.offb_pct, iffb: r.iffb_pct,
  });
}
console.log(`突合できた: ${rows.length}人年（2020-2022）\n`);

// 2つの説明変数（アウトのうちのフライ率・ゴロ率）で当てる。
// 単回帰では**ライナー率だけ相関0.151**と当たらなかった——ライナーは安打になりやすく、
// 「アウトの内容」にほとんど現れないため。ライナーは弾道に効くので、ここを外すと結果が壊れる。
function fit2(rows2, target) {
  const n = rows2.length;
  const X = rows2.map(r => [1, r.flyOut, r.groundOut]);
  const y = rows2.map(r => r[target]);
  // 3x3 の正規方程式を解く（説明変数2つ＋切片）
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 3; j++) {
      b[j] += X[i][j] * y[i];
      for (let k = 0; k < 3; k++) A[j][k] += X[i][j] * X[i][k];
    }
  }
  // ガウスの消去法
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < 3; i++) {
    let piv = i;
    for (let r2 = i + 1; r2 < 3; r2++) if (Math.abs(M[r2][i]) > Math.abs(M[piv][i])) piv = r2;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let r2 = 0; r2 < 3; r2++) {
      if (r2 === i || M[i][i] === 0) continue;
      const f = M[r2][i] / M[i][i];
      for (let c = i; c < 4; c++) M[r2][c] -= f * M[i][c];
    }
  }
  const coef = [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  let mae = 0, ssr = 0, sst = 0;
  const my = y.reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i++) {
    const pred = coef[0] + coef[1] * X[i][1] + coef[2] * X[i][2];
    mae += Math.abs(y[i] - pred); ssr += (y[i] - pred) ** 2; sst += (y[i] - my) ** 2;
  }
  return { intercept: coef[0], slope_fly: coef[1], slope_ground: coef[2], mae: mae / n, r: Math.sqrt(Math.max(0, 1 - ssr / sst)), n };
}

const models = {};
for (const [label, target] of [['gb_pct', 'gb'], ['ld_pct', 'ld'], ['offb_pct', 'offb'], ['iffb_pct', 'iffb']]) {
  models[label] = { ...fit2(rows, target), from: 'fly_out_pct + ground_out_pct' };
  console.log(`${label.padEnd(10)} 相関 ${models[label].r.toFixed(3)}  外し具合 ±${models[label].mae.toFixed(2)}ポイント`);
}

// 変換した値で弾道を出すと、実測から作った弾道とどれだけ違うか（これが最終的な物差し）
const { trajectoryFromShares } = await import('../src/engine/batted_ball.mjs');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
let diffs = [];
for (const r of rows) {
  const pred = {};
  for (const [label, key] of [['gb_pct', 'gb'], ['ld_pct', 'ld'], ['offb_pct', 'offb'], ['iffb_pct', 'iffb']]) {
    const m = models[label];
    pred[key] = m.intercept + m.slope_fly * r.flyOut + m.slope_ground * r.groundOut;
  }
  // ★ここは100で割る。設定側の想定構成は小数（0.55）、実測はパーセント（55.0）で単位が違う
  const actual = trajectoryFromShares({ gb: r.gb/100, ld: r.ld/100, offb: r.offb/100, iffb: r.iffb/100 }, cfg);
  const estimated = trajectoryFromShares({ gb: pred.gb/100, ld: pred.ld/100, offb: pred.offb/100, iffb: pred.iffb/100 }, cfg);
  if (actual != null && estimated != null) diffs.push(Math.abs(actual - estimated));
}
if (diffs.length) {
  diffs.sort((a, b) => a - b);
  const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  console.log(`\n弾道そのものの外し具合（${diffs.length}人年）`);
  console.log(`  平均 ${mean.toFixed(3)} / 中央 ${diffs[Math.floor(diffs.length / 2)].toFixed(3)} / 90% ${diffs[Math.floor(diffs.length * 0.9)].toFixed(3)}`);
  console.log(`  ※弾道は1〜4の4段階。0.5未満なら「たいてい同じ段階に落ちる」と言える`);
}

const p = path.join(ROOT, 'configs', 'ratings.json');
const conf = JSON.parse(readFileSync(p, 'utf8'));
conf.batted_ball_conversion = {
  _purpose: 'アウト内容の割合（2006-2022）から全打球の構成比を推定し、2019年以前の弾道を出す',
  _source_x: 'プロ野球ヌルデータ置き場f3（アウト内容の割合）',
  _source_y: 'NPB Basement（全打球の構成比、2020-2026）',
  _calibrated_on: '2020-2022の重複期間',
  _is_estimate: true,
  _note: '推定値。実測（NPB Basement）がある年はそちらを優先し、この式は使わない',
  models,
};
writeFileSync(p, JSON.stringify(conf, null, 2), 'utf8');
console.log(`\n保存: configs/ratings.json（batted_ball_conversion）`);
db.close();

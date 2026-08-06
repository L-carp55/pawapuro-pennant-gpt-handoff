// 内野手が「深い位置から一塁へ刺せるか」を測る（T-0101）。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//
// 考え方:
//   同じ場所に飛んだゴロを、誰がアウトにできて誰ができなかったかを比べる。
//   打球の位置ごとに「平均ならどれくらいアウトになるか」を出し、そこからの上振れ・下振れを
//   選手の差として取り出す。深い位置ほど強い送球が要るので、肩に効く。
//
//   3つが混ざるので、同時に解いて分ける（捕手の盗塁阻止で使ったのと同じやり方）:
//     アウトになりやすさ = 打球位置の難しさ ＋ 野手の差 ＋ 打者走者の足
//   打者の足を入れないと、足の速い打者と多く当たった野手が不当に低く出る。
//
//   守備位置（一塁手か遊撃手か）は**入れない**。位置を入れると、いま査定が
//   「位置だけで決めている」のと同じ情報しか取り出せなくなる。位置の違いは
//   打球位置の難しさとして自然に入る（遊撃の打球はもともと一塁から遠い）。
//
// 出す値:
//   肩そのものではなく「送球を含む処理の差」。捕る速さ・持ち替え・正確さも混ざる。
//   肩に寄せるため、**深い打球だけに絞った版**も併せて出す（浅い打球は肩が要らない）。
//
// 使い方: node scripts/calibrate_infield_throw.mjs

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const rows = db.prepare(`SELECT * FROM infield_grounder_events`).all();
console.log(`内野ゴロ ${rows.length.toLocaleString()}件\n`);

// ---- 打球位置の格子 --------------------------------------------------------
// hc_x は左右（小さいほど三塁側）、hc_y は本塁からの遠さ（小さいほど深い＝画面座標）。
// マス目は「1マスに十分な件数が入る」大きさにする。細かすぎるとマスごとの平均が
// その選手自身の成績になってしまい、差が消える。
const xs = rows.map(r => r.hc_x).sort((a, b) => a - b);
const ys = rows.map(r => r.hc_y).sort((a, b) => a - b);
const q = (arr, p) => arr[Math.floor(arr.length * p)];
console.log(`打球位置の広がり  x: ${q(xs, 0.02)}〜${q(xs, 0.98)}  y: ${q(ys, 0.02)}〜${q(ys, 0.98)}`);

const NX = 12, NY = 8;
const xMin = q(xs, 0.005), xMax = q(xs, 0.995), yMin = q(ys, 0.005), yMax = q(ys, 0.995);
const cellOf = r => {
  const ix = Math.min(NX - 1, Math.max(0, Math.floor((r.hc_x - xMin) / (xMax - xMin) * NX)));
  const iy = Math.min(NY - 1, Math.max(0, Math.floor((r.hc_y - yMin) / (yMax - yMin) * NY)));
  return `${ix},${iy}`;
};
for (const r of rows) r._cell = cellOf(r);

// ---- 交互推定 --------------------------------------------------------------
// logit(アウト) = マスの難しさ + 野手の差 + 打者の足
// 各項を順番に、他を固定して更新する。少ない件数の人は0へ引き戻す（縮小）。
const logit = p => Math.log(p / (1 - p));
const sigmoid = z => 1 / (1 + Math.exp(-z));
const clamp = (p, e = 1e-6) => Math.min(1 - e, Math.max(e, p));

const cells = new Map(), fielders = new Map(), batters = new Map();
for (const r of rows) {
  for (const [m, k] of [[cells, r._cell], [fielders, r.fielder_norm], [batters, r.batter_norm]]) {
    if (!m.has(k)) m.set(k, { n: 0, out: 0, eff: 0 });
    const v = m.get(k); v.n++; v.out += r.is_out;
  }
}
const base = logit(clamp(rows.reduce((s, r) => s + r.is_out, 0) / rows.length));

// 縮小の強さ。「何件あれば個人差を信じるか」。捕手の較正と同じ考え方で、
// 件数がこの値と同じなら効果を半分に縮める
const K_CELL = 30, K_FIELD = 120, K_BAT = 150;

function updateGroup(map, keyOf, kappa) {
  const acc = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    const pred = sigmoid(base + cells.get(r._cell).eff + fielders.get(r.fielder_norm).eff
      + batters.get(r.batter_norm).eff - map.get(k).eff);   // 自分の効果を抜いた予測
    if (!acc.has(k)) acc.set(k, { obs: 0, exp: 0, n: 0 });
    const a = acc.get(k); a.obs += r.is_out; a.exp += pred; a.n++;
  }
  let maxMove = 0;
  for (const [k, a] of acc) {
    const obsP = clamp((a.obs + kappa * (a.exp / a.n)) / (a.n + kappa));   // 少数は期待値へ寄せる
    const expP = clamp(a.exp / a.n);
    const next = logit(obsP) - logit(expP);
    maxMove = Math.max(maxMove, Math.abs(next - map.get(k).eff));
    map.get(k).eff = next;
  }
  return maxMove;
}

for (let it = 0; it < 60; it++) {
  const m = Math.max(
    updateGroup(cells, r => r._cell, K_CELL),
    updateGroup(fielders, r => r.fielder_norm, K_FIELD),
    updateGroup(batters, r => r.batter_norm, K_BAT));
  if (m < 1e-5) { console.log(`収束: ${it + 1}回`); break; }
}

// ---- モデルが妥当かの確認 --------------------------------------------------
// 打者側の効果が「足の速さ」を拾えているなら、走力の査定と一致するはず。
// 名前を一切教えていないので、一致すれば外部からの裏取りになる。
const runner = [...batters].filter(([, v]) => v.n >= 60).sort((a, b) => a[1].eff - b[1].eff);
console.log('\n打者側の効果（アウトにされにくい＝足が速いはず）');
console.log('  上位:', runner.slice(0, 8).map(([k, v]) => `${k}(${v.n})`).join(' '));
console.log('  下位:', runner.slice(-6).map(([k, v]) => `${k}(${v.n})`).join(' '));

// マスの難しさが「深いほど難しい」向きになっているか
const byDepth = new Map();
for (const [k, v] of cells) {
  const iy = Number(k.split(',')[1]);
  if (!byDepth.has(iy)) byDepth.set(iy, { n: 0, sum: 0 });
  const d = byDepth.get(iy); d.n += v.n; d.sum += v.eff * v.n;
}
console.log('\n打球の深さ別の難しさ（数字が小さいほどアウトにしにくい）');
for (const [iy, d] of [...byDepth].sort((a, b) => a[0] - b[0])) {
  const depth = yMin + (iy + 0.5) * (yMax - yMin) / NY;
  console.log(`  y≒${depth.toFixed(0)}（${iy === 0 ? '最も深い' : iy === NY - 1 ? '最も浅い' : ''}）  ${String(d.n).padStart(5)}件  ${(d.sum / d.n >= 0 ? '+' : '') + (d.sum / d.n).toFixed(3)}`);
}

// ---- 深い打球だけに絞った版（肩に寄せる）-----------------------------------
// 浅いゴロは軽く投げても間に合うので、肩の差が出ない。深い打球だけで測り直す。
const deepCut = q(ys, 0.35);                    // 深い側3割5分
const deepRows = rows.filter(r => r.hc_y <= deepCut);
console.log(`\n深い打球だけ（y ≦ ${deepCut}）: ${deepRows.length.toLocaleString()}件`);

function soloEffect(subset, kappa = 60) {
  // マスの難しさは全体で作ったものを流用し、野手の差だけを測り直す
  const acc = new Map();
  for (const r of subset) {
    const pred = sigmoid(base + cells.get(r._cell).eff + batters.get(r.batter_norm).eff);
    const k = r.fielder_norm;
    if (!acc.has(k)) acc.set(k, { obs: 0, exp: 0, n: 0, name: r.fielder });
    const a = acc.get(k); a.obs += r.is_out; a.exp += pred; a.n++;
  }
  const out = new Map();
  for (const [k, a] of acc) {
    const obsP = clamp((a.obs + kappa * (a.exp / a.n)) / (a.n + kappa));
    const eff = logit(obsP) - logit(clamp(a.exp / a.n));
    out.set(k, { eff, n: a.n, name: a.name, rawOut: a.obs / a.n, expOut: a.exp / a.n });
  }
  return out;
}
const deep = soloEffect(deepRows);

const shown = [...deep].filter(([, v]) => v.n >= 80).sort((a, b) => b[1].eff - a[1].eff);
console.log(`\n深い打球での差（80件以上の${shown.length}人）`);
console.log('野手           件数  実際   平均なら   差');
for (const [, v] of shown.slice(0, 10)) {
  console.log(`  ${v.name.padEnd(10)} ${String(v.n).padStart(5)}  ${(v.rawOut * 100).toFixed(1)}%  ${(v.expOut * 100).toFixed(1)}%   ${(v.eff >= 0 ? '+' : '') + v.eff.toFixed(3)}`);
}
console.log('  …');
for (const [, v] of shown.slice(-5)) {
  console.log(`  ${v.name.padEnd(10)} ${String(v.n).padStart(5)}  ${(v.rawOut * 100).toFixed(1)}%  ${(v.expOut * 100).toFixed(1)}%   ${(v.eff >= 0 ? '+' : '') + v.eff.toFixed(3)}`);
}

// ---- 保存 ------------------------------------------------------------------
const outPath = path.join(ROOT, 'outputs', 'derived', 'infield_throw_rating.json');
writeFileSync(outPath, JSON.stringify({
  _source: 'Nippon Baseball Data Repository (MIT License)',
  _method: '走者なしの内野ゴロで、打球位置の難しさと打者走者の足を差し引いた野手の差',
  _caution: [
    '肩そのものではない。捕る速さ・持ち替え・送球の正確さも混ざる',
    '深い打球に絞った版（deep）の方が肩に近いが、件数が減る',
    '守備位置は説明変数に入れていない（位置で決める現行査定と同じ情報しか出なくなるため）',
  ],
  seasons: [...new Set(rows.map(r => r.season))].sort(),
  grid: { NX, NY, xMin, xMax, yMin, yMax },
  shrinkage: { K_CELL, K_FIELD, K_BAT, deep: 60 },
  deep_cut_y: deepCut,
  all: [...fielders].map(([k, v]) => ({ fielder: k, n: v.n, effect: v.eff })).filter(x => x.n >= 30),
  deep: [...deep].map(([k, v]) => ({ fielder: k, name: v.name, n: v.n, effect: v.eff, out_rate: v.rawOut, expected: v.expOut })).filter(x => x.n >= 30),
}, null, 2), 'utf8');
console.log(`\n保存: ${path.relative(ROOT, outPath)}`);
db.close();

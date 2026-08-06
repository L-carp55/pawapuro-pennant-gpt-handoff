// 内野ゴロから「送球の速さ」（＝肩に近い成分）を取り出せるか試す。
//
// オーナー指示（2026-08-05）:
//   「守備力の要素を切り分けられたら、肩力の要素も切り分けられるかもしれませんね」
//
// 考え方:
//   内野安打になる（間に合わない）原因は3つ混ざっている。
//     ① 打球への到達が遅い（守備範囲）
//     ② 送球が遅い（肩の強さ・持ち替えの速さ）
//     ③ 打者走者が速い（打者の足）
//   ③は**自作の走塁指標で分離できるようになった**（22,459件・再現性0.61）。
//   ①は打球の位置で揃えられる。残りが②になる、というのがこの試みの筋。
//
//   さらに、一塁から遠い打球ほど②が効く。近い打球では誰が投げても間に合う。
//   そこで「一塁からの距離」で層を分け、遠い層でだけ出る差を見る。
//
// ★距離の測り方（前回の反省）:
//   座標の意味を確かめずに「y が小さい＝深い」と仮定して失敗した（2026-08-05）。
//   今回は**一塁の位置をデータから推定する**——一塁手が処理した打球の重心を一塁付近とみなし、
//   そこからの距離を使う。推定であることを明示し、妥当性は「距離が伸びるほど
//   アウト率が下がるか」で確かめる（下がらなければ距離の定義が間違っている）。
//
// 使い方: node scripts/try_infield_arm_from_grounders.mjs

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ev = db.prepare(`SELECT * FROM infield_grounder_events WHERE has_runner = 0`).all();

function pearson(a, b) {
  const n = a.length; if (n < 5) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let p = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; p += u * v; da += u * u; dbb += v * v; }
  return da > 0 && dbb > 0 ? p / Math.sqrt(da * dbb) : null;
}

// ---- 一塁の位置をデータから推定する ----------------------------------------
// 一塁手が処理した打球のうち、最も一塁寄り（アウト率が最も高い層）の重心を使う。
// 一塁手はベースの近くで捕ることが多いので、その重心はベースの近くにあるはず。
const firstBase = ev.filter(e => e.pos === '1B');
const fx = firstBase.reduce((s, e) => s + e.hc_x, 0) / firstBase.length;
const fy = firstBase.reduce((s, e) => s + e.hc_y, 0) / firstBase.length;
console.log(`一塁付近と推定した点: x=${fx.toFixed(1)} y=${fy.toFixed(1)}（一塁手の打球${firstBase.length}件の重心）`);

const dist = e => Math.hypot(e.hc_x - fx, e.hc_y - fy);
const ds = ev.map(dist).sort((a, b) => a - b);
const q = p => ds[Math.floor(ds.length * p)];
console.log(`距離の広がり: 10% ${q(0.1).toFixed(0)} / 中央 ${q(0.5).toFixed(0)} / 90% ${q(0.9).toFixed(0)}`);

// ---- 妥当性の確認: 距離が伸びるほどアウト率が下がるか ----------------------
console.log('\n距離の層ごとのアウト率（下がらなければ距離の定義が間違っている）');
const bands = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.0]];
const cut = bands.map(([a, b]) => [q(a), b === 1 ? Infinity : q(b)]);
for (let i = 0; i < cut.length; i++) {
  const [lo, hi] = cut[i];
  const sub = ev.filter(e => { const d = dist(e); return d >= lo && d < hi; });
  const outRate = sub.reduce((s, e) => s + e.is_out, 0) / sub.length;
  const ihRate = sub.filter(e => e.kind === 'infield_hit').length / sub.length;
  console.log(`  ${String(Math.round(lo)).padStart(3)}〜${hi === Infinity ? '  ' : String(Math.round(hi)).padStart(3)}  ${String(sub.length).padStart(6)}件  アウト ${(outRate * 100).toFixed(1)}%  内野安打 ${(ihRate * 100).toFixed(1)}%`);
}

// ---- 打者の足を明示的に調整する --------------------------------------------
// 自作の走塁指標を打者ごとの足の速さの代わりに使う（無い打者は平均扱い）
const brRaw = db.prepare(`SELECT runner_norm, kind, success, hc_x, hc_y, outs FROM baserunning_advances WHERE hc_x IS NOT NULL`).all();
const brCell = new Map();
const brKey = e => `${e.kind}|${Math.floor(e.hc_x / 12)},${Math.floor(e.hc_y / 12)}|${e.outs}`;
for (const e of brRaw) { const k = brKey(e); if (!brCell.has(k)) brCell.set(k, { n: 0, s: 0 }); const c = brCell.get(k); c.n++; c.s += e.success; }
const speedOf = new Map();
for (const e of brRaw) {
  if (!speedOf.has(e.runner_norm)) speedOf.set(e.runner_norm, { n: 0, d: 0 });
  const v = speedOf.get(e.runner_norm); const c = brCell.get(brKey(e));
  v.n++; v.d += e.success - c.s / c.n;
}
const runnerSpeed = new Map();
for (const [k, v] of speedOf) if (v.n >= 30) runnerSpeed.set(k, v.d / v.n);
console.log(`\n打者の足を調整できる選手: ${runnerSpeed.size}人（走塁30機会以上）`);

// 打球位置 × 打者の足 で「間に合わない確率」を説明し、残差を野手の値にする
const cellKey = e => `${Math.floor(e.hc_x / 10)},${Math.floor(e.hc_y / 10)}`;
const cell = new Map();
for (const e of ev) {
  const k = cellKey(e);
  if (!cell.has(k)) cell.set(k, { n: 0, h: 0 });
  const c = cell.get(k); c.n++; c.h += (e.kind === 'infield_hit' ? 1 : 0);
}
// 足の速さ1単位あたり、内野安打率がどれだけ上がるかを実測して係数にする
let sxy = 0, sxx = 0;
for (const e of ev) {
  const s = runnerSpeed.get(e.batter_norm);
  if (s == null) continue;
  const base = cell.get(cellKey(e));
  const resid = (e.kind === 'infield_hit' ? 1 : 0) - base.h / base.n;
  sxy += s * resid; sxx += s * s;
}
const beta = sxx > 0 ? sxy / sxx : 0;
console.log(`打者の足の効き方: 走塁の差1単位につき内野安打率 ${(beta * 100).toFixed(1)}ポイント（実測）`);

function fielderValues(minDist) {
  const m = new Map();
  for (const e of ev) {
    if (dist(e) < minDist) continue;
    const base = cell.get(cellKey(e));
    const s = runnerSpeed.get(e.batter_norm) ?? 0;
    const expected = base.h / base.n + beta * s;          // 位置と打者の足で説明できる分
    const resid = (e.kind === 'infield_hit' ? 1 : 0) - expected;
    if (!m.has(e.fielder_norm)) m.set(e.fielder_norm, { n: 0, d: 0, name: e.fielder });
    const v = m.get(e.fielder_norm); v.n++; v.d += resid;
  }
  return m;
}

console.log('\n遠い打球だけに絞った時、野手の差が再現するか（前半3年 vs 後半3年）');
console.log('絞り込み          件数     再現性');
for (const [label, minD] of [['すべて', 0], [`中央より遠い(${q(0.5).toFixed(0)}以上)`, q(0.5)], [`上位3割(${q(0.7).toFixed(0)}以上)`, q(0.7)]]) {
  const A = new Map(), B = new Map();
  for (const e of ev) {
    if (dist(e) < minD) continue;
    const t = e.season <= 2022 ? A : (e.season <= 2025 ? B : null);
    if (!t) continue;
    const base = cell.get(cellKey(e));
    const s = runnerSpeed.get(e.batter_norm) ?? 0;
    const resid = (e.kind === 'infield_hit' ? 1 : 0) - (base.h / base.n + beta * s);
    if (!t.has(e.fielder_norm)) t.set(e.fielder_norm, { n: 0, d: 0 });
    const v = t.get(e.fielder_norm); v.n++; v.d += resid;
  }
  const xs = [], ys = [];
  for (const [k, v] of A) { const w = B.get(k); if (!w || v.n < 80 || w.n < 80) continue; xs.push(v.d / v.n); ys.push(w.d / w.n); }
  const total = [...A.values()].reduce((s, v) => s + v.n, 0) + [...B.values()].reduce((s, v) => s + v.n, 0);
  console.log(`${label.padEnd(22)}${String(total).padStart(6)}   ${xs.length < 5 ? '判定できない' : (pearson(xs, ys) ?? 0).toFixed(3) + `（${xs.length}人）`}`);
}

// 送球の正確さ（悪送球）と、この値が別物かを見る。同じなら分けた意味がない
{
  const far = fielderValues(q(0.5));
  const te = new Map();
  for (const e of ev) {
    if (!te.has(e.fielder_norm)) te.set(e.fielder_norm, { n: 0, e: 0 });
    const v = te.get(e.fielder_norm); v.n++; v.e += (e.kind === 'throw_error' ? 1 : 0);
  }
  const xs = [], ys = [];
  for (const [k, v] of far) { const w = te.get(k); if (!w || v.n < 100) continue; xs.push(v.d / v.n); ys.push(w.e / w.n); }
  console.log(`\n遠い打球での差 vs 悪送球の割合: n=${xs.length}人  相関 ${(pearson(xs, ys) ?? 0).toFixed(3)}`);
  console.log('  ※0に近い＝別の成分（速さと正確さは別物）');
  const sorted = [...far].filter(([, v]) => v.n >= 100).sort((a, b) => a[1].d / a[1].n - (b[1].d / b[1].n));
  console.log('  間に合わせている順:', sorted.slice(0, 6).map(([, v]) => v.name).join(' '));
  console.log('  間に合っていない順:', sorted.slice(-6).map(([, v]) => v.name).join(' '));
}
db.close();

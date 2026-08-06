// 内野守備を成分に分けて、それぞれが個人の技量として再現するかを測る。
//
// オーナー指示（2026-08-05）:
//   「守備力に使ってみたいし、守備力の要素を切り分けられたら、肩力の要素も切り分けられるかもしれない」
//
// 直前の誤り: 総合値（アウトにできた割合の残差）だけで年またぎ再現性を測り 0.007 だったので
//   「使えない」と結論した。**成分に分ける前に閉じていた**。
//   さらに、抽出条件の不備で**悪送球が丸ごと落ちていた**（表記が「◯◯(遊)の悪送球により出塁する」で
//   「ゴロ」も「失策」も含まないため）。悪送球は送球の正確さそのもので、切り分けの中心だった。
//
// 成分:
//   間に合わない（infield_hit）… 守備範囲・打球への到達・送球の速さ・打者の足
//   送球が逸れる（throw_error）… 送球の正確さ ← 肩の成分に最も近い
//   総合（out）                … 上の2つの合計の裏返し
//
// 使い方: node scripts/check_infield_components.mjs

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const evAll = db.prepare(`SELECT season, fielder_norm, fielder, pos, kind, hc_x, hc_y, has_runner FROM infield_grounder_events`).all();
const ev = evAll.filter(e => !e.has_runner);

function pearson(a, b) {
  const n = a.length; if (n < 5) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let p = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; p += u * v; da += u * u; dbb += v * v; }
  return da > 0 && dbb > 0 ? p / Math.sqrt(da * dbb) : null;
}

// 打球位置ごとの「その事象が起きる平均の割合」を出し、そこからの差を選手の値にする。
// 位置を揃えないと、難しい打球が多く飛んでくる選手が不当に低く出る。
const cellKey = e => `${Math.floor(e.hc_x / 10)},${Math.floor(e.hc_y / 10)}`;
function residualsFor(kind, rows) {
  const cell = new Map();
  for (const e of rows) {
    const k = cellKey(e);
    if (!cell.has(k)) cell.set(k, { n: 0, h: 0 });
    const c = cell.get(k); c.n++; c.h += (e.kind === kind ? 1 : 0);
  }
  return e => {
    const c = cell.get(cellKey(e));
    return (e.kind === kind ? 1 : 0) - (c.h / c.n);
  };
}

// 前半3年 vs 後半3年で、同じ選手の値が再現するかを見る（1年ずつだと件数が足りない）
function splitHalf(kind, minN, src = ev) {
  const resid = residualsFor(kind, src);
  const A = new Map(), B = new Map();
  for (const e of src) {
    const t = e.season <= 2022 ? A : (e.season >= 2023 && e.season <= 2025 ? B : null);
    if (!t) continue;
    if (!t.has(e.fielder_norm)) t.set(e.fielder_norm, { n: 0, s: 0 });
    const v = t.get(e.fielder_norm); v.n++; v.s += resid(e);
  }
  const xs = [], ys = [], names = [];
  for (const [f, v] of A) {
    const w = B.get(f);
    if (!w || v.n < minN || w.n < minN) continue;
    xs.push(v.s / v.n); ys.push(w.s / w.n); names.push(f);
  }
  return { r: pearson(xs, ys), n: xs.length, xs, ys, names };
}

console.log('成分ごとの「前半3年 vs 後半3年」の一致（個人の技量なら再現するはず）\n');
console.log('成分                    100件以上        150件以上        200件以上');
for (const [label, kind] of [['アウトにできた（総合）', 'out'],
  ['間に合わない（範囲・足）', 'infield_hit'], ['送球が逸れる（正確さ）', 'throw_error']]) {
  const cells = [100, 150, 200].map(m => {
    const s = splitHalf(kind, m);
    return `${s.r === null ? '  —  ' : (s.r >= 0 ? '+' : '') + s.r.toFixed(3)}(${s.n}人)`.padEnd(16);
  });
  console.log(`${label.padEnd(24)}${cells.join('')}`);
}

// 送球の正確さは、そもそも起きる回数が少ない。年あたり何件かを出す
const te = ev.filter(e => e.kind === 'throw_error');
const byF = new Map();
for (const e of ev) {
  if (!byF.has(e.fielder_norm)) byF.set(e.fielder_norm, { n: 0, te: 0, name: e.fielder });
  const v = byF.get(e.fielder_norm); v.n++; v.te += (e.kind === 'throw_error' ? 1 : 0);
}
const many = [...byF.values()].filter(v => v.n >= 200).sort((a, b) => (b.te / b.n) - (a.te / a.n));
console.log(`\n悪送球は全体で${te.length}件（1件あたり${(ev.length / te.length).toFixed(0)}打球に1回）`);
console.log('200打球以上を処理した野手の、悪送球の割合');
console.log('  多い順:', many.slice(0, 6).map(v => `${v.name}${(v.te / v.n * 100).toFixed(1)}%(${v.te}/${v.n})`).join(' '));
console.log('  少ない順:', many.slice(-6).map(v => `${v.name}${(v.te / v.n * 100).toFixed(1)}%(${v.te}/${v.n})`).join(' '));

// 「間に合わない」と「送球が逸れる」が別のものを測っているか（同じなら分ける意味がない）
{
  const rIH = residualsFor('infield_hit', ev), rTE = residualsFor('throw_error', ev);
  const m = new Map();
  for (const e of ev) {
    if (!m.has(e.fielder_norm)) m.set(e.fielder_norm, { n: 0, ih: 0, te: 0 });
    const v = m.get(e.fielder_norm); v.n++; v.ih += rIH(e); v.te += rTE(e);
  }
  const sub = [...m.values()].filter(v => v.n >= 200);
  const r = pearson(sub.map(v => v.ih / v.n), sub.map(v => v.te / v.n));
  console.log(`\n2つの成分どうしの関係: n=${sub.length}人  相関 ${r === null ? '—' : (r >= 0 ? '+' : '') + r.toFixed(3)}`);
  console.log('  ※0に近い＝別のものを測っている（分ける意味がある）');
}
db.close();

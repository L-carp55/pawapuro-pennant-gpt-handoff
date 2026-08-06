// 内野手の肩力の査定が当たっているかを、DELTAの送球評価で答え合わせする。
//
// なぜ要るか（2026-08-05）:
//   内野手の肩力は、パワプロ実装値との順位相関が **-0.043**（当てずっぽう）。
//   原因は分かっている——内野手には送球速度の実測が無く、「どの位置を守れるか」からの
//   推定だけで作っているため（2026-08-01の裁定、T-0101が未着手）。
//   ところが、内野手の送球を直接測ったデータが手元にあった（Webから収集済み、未使用）。
//
// 何と比べるか:
//   DELTAの「遠投アウト割合」＝一塁から遠い位置で捕った打球を、アウトにできた割合。
//   同じ難しさの打球で比べる作りになっており、**肩の強さに最も近い指標**（記事自身がそう説明している）。
//   「送球の速さ（俊敏性）」「正確性」は肩の強さとは別物なので、区別して見る。
//
// 限界（先に書く）:
//   遊撃手6人・2017年のみ。これで較正はできない。**今の推定が当たっているかの確認**にだけ使う。
//   6人での順位相関は偶然でも大きく振れる（乱数で±0.5程度は普通に出る）ので、
//   並べ替え検定で「偶然どのくらいか」を出す。
//
// 出典: DELTA（1.02 Essence of Baseball）の分析記事。収集は web_collected_measurements.json
// 使い方: node scripts/check_infield_arm_vs_delta.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'web_collected_measurements.json'), 'utf8'));
const recs = Array.isArray(raw) ? raw : (raw.records ?? []);
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

// 2017年・表3（全遊撃手を同じ表で並べたもの）だけを使う。
// 選手ごとの個別表（表4〜表16）は集計の作り方が違い、同じ表の中でも値が食い違う例がある
// （京田: 表6と表16で数字が異なる。収集時に両方残してある）。混ぜない。
const pick = (metric) => {
  const m = new Map();
  for (const r of recs) {
    if (r.metric !== metric || r.season !== 2017) continue;
    if (!/表3/.test(r.context ?? '')) continue;
    m.set(norm(r.player), r.value);
  }
  return m;
};
const longThrow = pick('long_throw_out_rate');       // 遠投＝肩の強さに最も近い
const quickness = pick('throw_quickness_out_rate');  // 送球の速さ＝肩とは別
const accuracy = pick('throw_accuracy_out_rate');    // 正確性＝肩とは別

function spearman(a, b) {
  const rank = xs => {
    const idx = xs.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const r = new Array(xs.length);
    for (let i = 0; i < idx.length;) {          // 同値は平均順位
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a), rb = rank(b), n = a.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n, mb = rb.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const u = ra[i] - ma, v = rb[i] - mb; num += u * v; da += u * u; dbb += v * v; }
  return da > 0 && dbb > 0 ? num / Math.sqrt(da * dbb) : null;
}

// 並べ替え検定: 片方の並びを総当たりで入れ替え、今の一致がどのくらい珍しいかを出す
function permP(a, b, observed) {
  const perms = [];
  const go = (arr, cur) => {
    if (!arr.length) { perms.push(cur); return; }
    for (let i = 0; i < arr.length; i++) go([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, arr[i]]);
  };
  go(b, []);
  const rs = perms.map(p => spearman(a, p)).filter(r => r !== null);
  return rs.filter(r => Math.abs(r) >= Math.abs(observed)).length / rs.length;
}

// ★2017年の肩力は査定できない——守備の高度指標（ARM）が2020年以降しか無いため。
//   肩の強さは年でほとんど変わらない（仕様04 §1、査定側も複数年で均している）ので、
//   同じ選手の**査定できる最も早い年**を代わりに使う。何年ずれたかは表に出す。
const names = [...longThrow.keys()];
const rows = [];
for (const k of names) {
  const p = db.prepare(`SELECT player_id, name FROM v_batting
    WHERE replace(replace(name,' ',''),char(12288),'')=? AND season=2017`).get(k);
  if (!p) { console.log(`（名寄せできず: ${k}）`); continue; }
  let arm = null, usedSeason = null;
  const cands = db.prepare(`SELECT season FROM v_batting WHERE player_id=? AND season>=2020 AND pa>=100 ORDER BY season`).all(p.player_id);
  for (const c of cands) {
    const r = appraiseCard(ctx, { name: p.name, mode: String(c.season), cfg, rv, runNorm, fldNorm });
    const v = r.error ? null : r.card.abilities?.基礎能力?.肩力?.value;
    if (Number.isFinite(v)) { arm = v; usedSeason = c.season; break; }
  }
  if (arm == null) { console.log(`（肩力が出る年が無い: ${p.name}）`); continue; }
  rows.push({ name: p.name, arm, usedSeason, long: longThrow.get(k), quick: quickness.get(k), acc: accuracy.get(k) });
}

console.log('2017年の遊撃手（DELTA表3）と自作の肩力査定\n');
console.log('選手          自作の肩力 (何年の査定)  遠投アウト率  送球の速さ  正確性');
for (const r of rows.sort((a, b) => b.arm - a.arm)) {
  console.log(`${r.name.replace(/　/g, ' ').padEnd(12)} ${r.arm.toFixed(1).padStart(8)}  (${r.usedSeason}年)  ${(r.long != null ? r.long.toFixed(1) + '%' : '   —').padStart(11)} ${(r.quick != null ? r.quick.toFixed(1) + '%' : '  —').padStart(10)} ${(r.acc != null ? r.acc.toFixed(1) + '%' : '  —').padStart(8)}`);
}
console.log('※DELTAの計測は2017年、査定は上の年。肩の強さは年でほとんど変わらないという前提を置いている');

console.log('\n順位の一致（自作の肩力 vs DELTAの各指標）');
for (const [label, key] of [['遠投アウト率（肩の強さに最も近い）', 'long'],
  ['送球の速さ（肩とは別物）', 'quick'], ['正確性（肩とは別物）', 'acc']]) {
  const sub = rows.filter(r => r[key] != null);
  if (sub.length < 4) { console.log(`  ${label}: n=${sub.length} で判定しない`); continue; }
  const a = sub.map(r => r.arm), b = sub.map(r => r[key]);
  const rho = spearman(a, b);
  const p = permP(a, b, rho);
  console.log(`  ${label}: n=${sub.length}  順位相関 ${(rho >= 0 ? '+' : '') + rho.toFixed(3)}  偶然でこれ以上になる確率 ${(p * 100).toFixed(0)}%`);
}
console.log('\n※6人なので、順位相関が大きく出ても偶然の範囲に収まる。較正の材料にはしない。');
console.log('※内野手の肩を実測から作るには打球位置つきの1球データが要る（T-0101、未着手）。');
db.close();

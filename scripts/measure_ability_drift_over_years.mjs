// 能力値は年でどれだけ変わるのか。プロ入り前の計測を何年ぶん信じてよいかの目安にする。
//
// オーナー指示（2026-08-05）:
//   「50m走と遠投距離はプロ入り前の計測なので、入団前の記録を能力の根拠にしてよいかは設計の判断。
//     パワプロの能力値の年度ごとの変化を参照してどのくらい変わっているかを見るのは一つの手。
//     パワプロの値そのものだけを見てバイアスをかけるのはよくないが、
//     批判的な視点から参考材料にするのは大いにあり」
//
// この道具の位置づけ:
//   パワプロの値を**正解として使わない**（採否の物差しにしない、2026-07-31オーナー確定）。
//   ここで使うのは「同じ選手の値が年でどう動くか」という**変化の大きさだけ**で、
//   値そのものの当否は問わない。KONAMIが毎年見直している中で走力・肩力がどれだけ動くかは、
//   「身体能力は年で変わらない」という当プロジェクトの前提を外から点検する材料になる。
//
//   ★注意: パワプロの値が動かないことは「実際に変わっていない」ことの証明ではない。
//   査定側が前年の値を引き継いでいるだけかもしれない（KONAMIの査定手順は非公開）。
//   したがってここから言えるのは**上限**——「パワプロですら年N点動く」であって、
//   「実際の変化はN点」ではない。
//
// 使い方: node scripts/measure_ability_drift_over_years.mjs

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const rows = db.prepare(`SELECT work, name_norm, trajectory, meet, power, speed, arm, fielding, catching
  FROM pawapuro_full WHERE name_norm IS NOT NULL AND name_norm <> ''`).all();

const byPlayer = new Map();
for (const r of rows) {
  if (!byPlayer.has(r.name_norm)) byPlayer.set(r.name_norm, new Map());
  byPlayer.get(r.name_norm).set(Number(r.work), r);
}

const ABILITIES = [['走力', 'speed'], ['肩力', 'arm'], ['守備力', 'fielding'],
  ['捕球', 'catching'], ['ミート', 'meet'], ['パワー', 'power']];

// 何年離れているかごとに、値がどれだけ動いたかを集める
const gaps = new Map();
for (const [, works] of byPlayer) {
  const ys = [...works.keys()].sort((a, b) => a - b);
  for (let i = 0; i < ys.length; i++) {
    for (let j = i + 1; j < ys.length; j++) {
      const gap = ys[j] - ys[i];
      if (!gaps.has(gap)) gaps.set(gap, new Map());
      const g = gaps.get(gap);
      for (const [label, key] of ABILITIES) {
        const a = works.get(ys[i])[key], b = works.get(ys[j])[key];
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        if (!g.has(label)) g.set(label, []);
        g.get(label).push(b - a);
      }
    }
  }
}

console.log('同じ選手の能力値が、何年でどれだけ動くか（パワプロ 2013-2026・8作品）\n');
console.log('間隔    人数   ' + ABILITIES.map(([l]) => l.padEnd(12)).join(''));
console.log('              ' + ABILITIES.map(() => '平均差 動く幅  ').join(''));
for (const gap of [...gaps.keys()].sort((a, b) => a - b)) {
  const g = gaps.get(gap);
  const cells = ABILITIES.map(([label]) => {
    const d = g.get(label) ?? [];
    if (d.length < 20) return '  —          ';
    const mean = d.reduce((s, v) => s + v, 0) / d.length;
    const mad = d.reduce((s, v) => s + Math.abs(v), 0) / d.length;
    return `${(mean >= 0 ? '+' : '') + mean.toFixed(1)}  ${mad.toFixed(1).padStart(4)}     `;
  });
  const n = g.get('走力')?.length ?? 0;
  console.log(`${String(gap).padStart(2)}年  ${String(n).padStart(5)}   ${cells.join('')}`);
}
console.log('\n「平均差」＝後の年 − 前の年（マイナスなら年とともに落ちる）');
console.log('「動く幅」＝差の絶対値の平均（向きを問わずどれだけ動いたか）');

// 走力・肩力が「動かない」選手の割合。プロ入り前の記録の使える期間の目安になる
console.log('\n何年経っても値が変わらない選手の割合');
console.log('間隔    走力          肩力          ミート        パワー');
for (const gap of [...gaps.keys()].sort((a, b) => a - b)) {
  const g = gaps.get(gap);
  const cells = [['走力'], ['肩力'], ['ミート'], ['パワー']].map(([label]) => {
    const d = g.get(label) ?? [];
    if (d.length < 20) return '  —          ';
    const same = d.filter(v => v === 0).length / d.length;
    const near = d.filter(v => Math.abs(v) <= 5).length / d.length;
    return `${(same * 100).toFixed(0)}% / ±5内${(near * 100).toFixed(0)}%  `;
  });
  console.log(`${String(gap).padStart(2)}年  ${cells.join('')}`);
}
console.log('\n※この表から言えるのは上限だけ。パワプロ側が前年の値を引き継いでいる可能性を');
console.log('  排除できないので、「実際にこれだけしか変わらない」とは読まない。');
db.close();

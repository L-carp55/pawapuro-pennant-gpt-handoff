// MLB The Show の「実測（Statcast）→ ゲーム能力値」変換を測る。
//
// なぜこれを測るか:
//   自作査定は走力・肩力を「走塁の成果」（UBR・三塁打率など＝仕様の第3階層）から逆算している。
//   仕様が第1階層に置く直接計測（Sprint Speed・送球速度）は受け皿（ability_evidence.direct_measurement）
//   まで実装済みだがデータが入っていない。The Show は同じ問題を「実測を直接使う」形で解いている
//   外部の実例なので、その変換の傾き・切片を測れば、自作の目盛りを当てる時の独立の参照になる。
//
// ホールドアウト規律（重要）:
//   configs/holdout_mlb_bridge.json の test_players は答え合わせ用に封印してある。
//   本スクリプトは train_players だけで式を作り、**test側の値は読み書きも表示もしない**。
//   答え合わせは変換式を査定へ組み込んだ後に、別スクリプトで1度だけ行う。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** ピアソン相関 */
export function corr(a, b) {
  const n = a.length;
  if (n < 3) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null;
}

/** 最小二乗の直線当てはめ */
export function linearFit(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); den += (x[i] - mx) ** 2; }
  if (!(den > 0)) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  // 残差の標準偏差（当てはめの粗さ）
  let ss = 0;
  for (let i = 0; i < n; i++) { const e = y[i] - (slope * x[i] + intercept); ss += e * e; }
  return { slope, intercept, residualSd: Math.sqrt(ss / (n - 2)), n };
}

if ((process.argv[1] ?? '').endsWith('calibrate_the_show_mapping.mjs')) {
  const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
  const holdout = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'holdout_mlb_bridge.json'), 'utf8'));
  const trainIds = new Set(holdout.train_players.map(p => p.proeye_id));

  const rows = db.prepare(`
    SELECT b.proeye_id, b.npb_name, b.sprint_speed_avg, b.sprint_years, b.arm_mph_avg, b.arm_years,
           s.speed_avg, s.arm_strength_avg, s.editions
    FROM mlb_bridge b JOIN the_show_bridge s ON s.proeye_id = b.proeye_id`)
    .all()
    .filter(r => trainIds.has(r.proeye_id)); // ★testは構造的に落とす

  const build = (label, xs, ys, xUnit) => {
    const x = [], y = [];
    for (let i = 0; i < xs.length; i++) if (xs[i] != null && ys[i] != null) { x.push(xs[i]); y.push(ys[i]); }
    const fit = linearFit(x, y);
    if (!fit) return { label, n: x.length, note: '当てはめに足りる人数がない' };
    return {
      label, unit: xUnit, n: fit.n, r: corr(x, y),
      slope: fit.slope, intercept: fit.intercept, residual_sd: fit.residualSd,
      x_range: [Math.min(...x), Math.max(...x)],
      y_range: [Math.min(...y), Math.max(...y)],
    };
  };

  // 自作スケール（パワプロ405人ラベルで較正済み）での当てはめ。
  // The Show は0-125スケールなので傾きをそのまま使えない。査定へ入れる係数はこちらを使う
  const pw = db.prepare(`
    SELECT b.proeye_id, b.sprint_speed_avg, b.arm_mph_avg,
           AVG(r.speed) pw_speed, AVG(r.arm) pw_arm
    FROM mlb_bridge b
    JOIN pawapuro_link l ON l.proeye_id = b.proeye_id
    JOIN pawapuro_rating r ON r.name_norm = l.name_norm
    GROUP BY b.proeye_id`)
    .all()
    .filter(r => trainIds.has(r.proeye_id)); // ★testは構造的に落とす

  const result = {
    _purpose: 'MLB The Show の「実測→ゲーム能力値」変換。自作査定の目盛りを当てる時の独立参照',
    _source: 'Statcast実測(mlb_bridge) × The Show公式API(the_show_bridge、Liveシリーズの野手のみ・年度平均)',
    _holdout: `train ${trainIds.size}人のみ使用。test ${holdout.test_players.length}人は封印（本スクリプトは読まない）`,
    _generated_at_note: '生成日時は実行時のgitログを参照（スクリプト内で日時を埋めない）',
    _caveat: 'The Showの能力値は0-125スケール（Liveは実質0-99帯）。自作は0-100なので、傾きをそのまま流用せず「レンジ何点ぶんに相当するか」で読む',
    mappings: [
      build('走力: Sprint Speed → speed rating',
        rows.map(r => r.sprint_speed_avg), rows.map(r => r.speed_avg), 'ft/s'),
      build('肩力: Arm Strength(実測) → arm_strength rating',
        rows.map(r => r.arm_mph_avg), rows.map(r => r.arm_strength_avg), 'mph'),
    ],
    // 査定へ入れるのはこちら（自作と同じ0-100スケール）
    own_scale: [
      build('走力: Sprint Speed → パワプロ走力(0-100)',
        pw.map(r => r.sprint_speed_avg), pw.map(r => r.pw_speed), 'ft/s'),
      build('肩力: Arm(mph) → パワプロ肩力(0-100)',
        pw.map(r => r.arm_mph_avg), pw.map(r => r.pw_arm), 'mph'),
    ],
  };
  // 2系統の傾きを並べて、独立した系が同じ形に収束しているかを見えるようにする
  result._cross_check = result.mappings.map((m, i) => ({
    ability: i === 0 ? '走力' : '肩力',
    the_show: m.note ? null : { n: m.n, r: m.r, slope: m.slope },
    own_scale: result.own_scale[i].note ? null : { n: result.own_scale[i].n, r: result.own_scale[i].r, slope: result.own_scale[i].slope },
  }));

  const out = path.join(ROOT, 'outputs', 'derived', 'the_show_mapping.json');
  writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');

  console.log(`train ${rows.length}人で測定（test ${holdout.test_players.length}人は封印のまま）\n`);
  for (const m of [...result.mappings, ...result.own_scale]) {
    if (m.note) { console.log(`${m.label}: ${m.note}（n=${m.n}）`); continue; }
    console.log(`${m.label}`);
    console.log(`  n=${m.n}  相関 r=${m.r.toFixed(3)}`);
    console.log(`  rating = ${m.slope.toFixed(2)} × (${m.unit}) + ${m.intercept.toFixed(1)}   残差sd=${m.residual_sd.toFixed(1)}点`);
    console.log(`  実測 ${m.x_range[0].toFixed(1)}〜${m.x_range[1].toFixed(1)} ${m.unit}`
      + ` が rating ${m.y_range[0].toFixed(0)}〜${m.y_range[1].toFixed(0)} に対応`);
    console.log(`  → 実測レンジ全体で rating ${(m.slope * (m.x_range[1] - m.x_range[0])).toFixed(0)} 点ぶんの差になる\n`);
  }
  console.log('【独立2系の突き合わせ】同じ実測を、別々のゲームが何点の差として扱っているか');
  for (const c of result._cross_check) {
    if (!c.the_show || !c.own_scale) { console.log(`  ${c.ability}: 片側が測れず突き合わせ不可`); continue; }
    console.log(`  ${c.ability}: The Show ${c.the_show.slope.toFixed(2)}点(n=${c.the_show.n}, r=${c.the_show.r.toFixed(2)})`
      + `  vs  パワプロ ${c.own_scale.slope.toFixed(2)}点(n=${c.own_scale.n}, r=${c.own_scale.r.toFixed(2)})`);
  }
  console.log(`\n保存: ${path.relative(ROOT, out)}`);
  db.close();
}

// 捕手の守備力（＝捕球からリリースまでの速さ）を能力値1-100へ載せる目盛りを作る。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//   This uses data sourced from the Nippon Baseball Data Repository.
//
// 前段（scripts/calibrate_catcher_defense.mjs）で、盗塁8,867件から
//   logit(p) = base + 捕手効果 + 投手効果 + 走者効果
// を解き、投手のクイックと走者の足を取り除いた「捕手効果」を得た。
//
// ★ここで肩を引く理由（二重計上の回避）:
//   捕手効果には **肩の強さも含まれている**。肩力は別途 NPB+ の送球速度から査定しているので、
//   捕手効果をそのまま守備力にすると**同じ肩を2か所で数える**（開発原則「同じ情報を能力と
//   特殊能力に二重計上しない」に抵触。2026-08-05に文脈階層で1度踏んだ誤りと同型）。
//   捕手効果を送球速度で回帰し、**その残差**を守備力の素点にする。
//   実測: 捕手効果と送球速度の相関は 0.183 しかない＝肩で説明できるのは一部だけで、
//   残りが仕様04 §10.2 の言う「捕球からリリースまでの速さ、動作」。
//
// 目盛りの合わせ方:
//   他の能力と同じく、パワプロの捕手の守備力ラベルの分布（平均52.9・最小36・最大74）へ
//   中心と幅だけを合わせる（順序は変えない）。
//   ★パワプロは**採否の物差しではない**（2026-07-31オーナー確定）。ここで使うのは
//   「100段階のどのあたりに置くか」という目盛りの取り方だけで、誰が上か下かは実測が決める。
//
// 使い方: node scripts/calibrate_catcher_fielding_scale.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const norm = s => (s ?? '').replace(/[\s　]/g, '');

const effects = JSON.parse(readFileSync(
  path.join(ROOT, 'outputs', 'derived', 'catcher_defense_effect.json'), 'utf8'));

// 送球速度（NPB+実測）
const throwRows = db.prepare(
  `SELECT name, throw_speed_kmh v FROM npb_plus_measurement WHERE throw_speed_kmh IS NOT NULL`).all();
const throwOf = new Map(throwRows.map(r => [norm(r.name), r.v]));

const withThrow = effects.catchers
  .map(c => ({ ...c, throw_speed: throwOf.get(norm(c.catcher)) }))
  .filter(c => c.throw_speed != null);

if (withThrow.length < 5) {
  console.error(`送球速度と突合できた捕手が ${withThrow.length}人しかない。較正できない`);
  process.exit(1);
}

// ① 捕手効果を送球速度で回帰 → 残差＝肩以外（捕球からリリースまでの速さ）
const n = withThrow.length;
const mx = withThrow.reduce((s, c) => s + c.throw_speed, 0) / n;
const my = withThrow.reduce((s, c) => s + c.effect, 0) / n;
let num = 0, den = 0;
for (const c of withThrow) { num += (c.throw_speed - mx) * (c.effect - my); den += (c.throw_speed - mx) ** 2; }
const armSlope = num / den, armIntercept = my - armSlope * mx;

for (const c of withThrow) {
  c.arm_explained = armSlope * c.throw_speed + armIntercept;
  c.residual = c.effect - c.arm_explained;
}

// ② 残差の分布を、パワプロの捕手守備力ラベルの分布へ合わせる（中心と幅だけ）
const catcherNames = new Set(
  db.prepare(`SELECT name FROM npb_usage_2026 WHERE primary_pos='捕'`).all().map(r => norm(r.name)));
const labels = db.prepare(`SELECT name, fielding FROM pawapuro_rating WHERE fielding IS NOT NULL`).all()
  .filter(r => catcherNames.has(norm(r.name))).map(r => r.fielding);

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };

const resid = withThrow.map(c => c.residual);
const rMean = mean(resid), rSd = sd(resid);
const lMean = mean(labels), lSd = sd(labels);

// 能力値 = ラベル平均 + (残差 - 残差平均)/残差sd × ラベルsd
const scale = { center: lMean, spread: lSd, resid_mean: rMean, resid_sd: rSd };

for (const c of withThrow) {
  c.rating = scale.center + ((c.residual - scale.resid_mean) / scale.resid_sd) * scale.spread;
}

const out = {
  _meta: {
    purpose: '捕手の守備力（捕球からリリースまでの速さ）を能力値1-100へ載せる目盛り',
    spec: 'docs/satei_handoff/04_RUNNING_DEFENSE_CATCHER.md §10.2',
    source: 'Nippon Baseball Data Repository（MIT License）の1球データ 2020-2026 ＋ NPB+の送球速度',
    attribution: 'This uses data sourced from the Nippon Baseball Data Repository.',
    n: withThrow.length,
    _why_subtract_arm:
      '捕手効果には肩の強さも含まれる。肩力は別途 NPB+ の送球速度から査定しているので、'
      + 'そのまま守備力にすると同じ肩を2か所で数える（開発原則の二重計上に抵触）。'
      + `捕手効果を送球速度で回帰し（傾き ${armSlope.toFixed(4)}／相関は0.183と弱い）、その残差を使う。`
      + '残差が仕様の言う「捕球からリリースまでの速さ、動作」',
    _scale_policy:
      'パワプロの捕手守備力ラベルの分布へ中心と幅だけを合わせる（順序は変えない）。'
      + '★パワプロは採否の物差しではない（2026-07-31オーナー確定）。使うのは'
      + '「100段階のどのあたりに置くか」だけで、誰が上か下かは実測が決める',
    _status: '★暫定。採否の正式な物差し（エンジンでのリーグ分布一致）は未実装。'
      + `また n=${withThrow.length} と少ない（送球速度の実測がある捕手に限られる）`,
  },
  arm_regression: { slope: armSlope, intercept: armIntercept, n },
  scale,
  catchers: withThrow
    .map(c => ({
      catcher: c.catcher, events: c.events,
      raw_rate: c.raw_rate, adjusted_rate: c.adjusted_rate,
      throw_speed: c.throw_speed,
      effect: c.effect, arm_explained: c.arm_explained, residual: c.residual,
      rating: Math.round(c.rating * 10) / 10,
    }))
    .sort((a, b) => b.rating - a.rating),
};

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'catcher_fielding_rating.json'),
  JSON.stringify(out, null, 2), 'utf8');

console.log(`捕手 ${n}人の守備力を算出（送球速度の実測がある捕手）`);
console.log(`  肩の回帰: 捕手効果 = ${armSlope.toFixed(4)} × 送球速度 + ${armIntercept.toFixed(3)}`);
console.log(`  目盛り: 中心 ${scale.center.toFixed(1)} / 幅 ${scale.spread.toFixed(1)}（パワプロの捕手ラベル ${labels.length}人の分布）`);
console.log('\n  捕手         送球速度  肩以外の残差  守備力');
for (const c of out.catchers) {
  console.log(`  ${c.catcher.padEnd(12)}${String(c.throw_speed).padStart(6)}  `
    + `${(c.residual >= 0 ? '+' : '') + c.residual.toFixed(3).padStart(6)}      ${c.rating.toFixed(1).padStart(5)}`);
}
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

// 縮小（少打席選手を平均へ寄せる処理）が、リーグ全体の打率を押し上げていないかを調べる。
//
// 発端（2026-08-05）:
//   エンジンで12球団×143試合を回した時の打率が、**6年すべてで実績より高い**（+0.39〜+1.40%）。
//   年ごとの偶然ではなく構造的な偏りなので、原因を辿った。
//
// 分かったこと:
//   (1) 縮小はリーグ打率を +0.14〜+0.39ポイント押し上げている（全年でプラス）
//   (2) その理由は、**少打席の選手ほど実際の打率が低い**こと。
//       30-100打席の選手は .1965、500打席以上は .2751（差は8分6厘）。
//       打てないから出番が減るので当然だが、縮小はこの層をリーグ平均へ引き上げる。
//   (3) 個人の推定としては正しくても、**リーグ合計は保存されない**。
//       仕様の答え合わせは「リーグ全体の分布が実績と一致するか」なので、ここが効く。
//
// 対策は設計の判断（オーナー判断）:
//   案A 少打席選手のPriorを「同じ打席帯の平均」にする（選択効果を織り込む）
//   案B 縮小後にリーグ加重平均が縮小前と一致するよう全員を一律にスケールする（相対関係は保つ）
//   案C 許容する（個人の推定精度を優先し、リーグ合計のずれは受け入れる）
//
// 使い方: node scripts/check_shrinkage_league_bias.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

console.log('1. 縮小の前と後で、リーグ全体の打率・本塁打率がどう動くか');
console.log('   （どちらも環境補正後の値なので直接比べられる）\n');
console.log('年     縮小前打率 縮小後打率   差        縮小前HR  縮小後HR   差');
for (const y of YEARS) {
  const p = path.join(ROOT, 'outputs', `appraisal_${y}.json`);
  if (!existsSync(p)) { console.log(`${y}   （査定ファイルが無い）`); continue; }
  const a = JSON.parse(readFileSync(p, 'utf8'));
  let ab = 0, pre = 0, post = 0, preH = 0, postH = 0;
  for (const r of a) {
    const o = r.observed;
    if (!o?.preShrink) continue;
    ab += r.ab; pre += o.preShrink.avg * r.ab; post += o.avg * r.ab;
    preH += o.preShrink.hrPer500 * r.ab; postH += o.hrPer500 * r.ab;
  }
  const d = (post - pre) / ab, dh = (postH - preH) / preH;
  console.log(`${y}    ${(pre / ab).toFixed(4)}    ${(post / ab).toFixed(4)}   `
    + `${(d >= 0 ? '+' : '') + (d * 100).toFixed(3)}pt (${(d >= 0 ? '+' : '') + (d / (pre / ab) * 100).toFixed(2)}%)   `
    + `${(preH / ab).toFixed(2)}     ${(postH / ab).toFixed(2)}    ${(dh >= 0 ? '+' : '') + (dh * 100).toFixed(1)}%`);
}

console.log('\n2. なぜ押し上がるのか — 打席数と打率の関係');
console.log('   打てない選手ほど出番が少ない。その層を平均へ寄せれば全体が上がる\n');
const all = db.prepare(`SELECT SUM(h)*1.0/SUM(ab) a FROM v_batting
  WHERE season BETWEEN ? AND ? AND position<>'投' AND pa>=30`).get(YEARS[0], YEARS.at(-1)).a;
console.log('打席        人数   打率     リーグ平均との差');
for (const [lo, hi] of [[30, 100], [100, 200], [200, 350], [350, 500], [500, 9999]]) {
  const r = db.prepare(`SELECT COUNT(*) n, SUM(h)*1.0/SUM(ab) a FROM v_batting
    WHERE season BETWEEN ? AND ? AND position<>'投' AND pa>=? AND pa<?`).get(YEARS[0], YEARS.at(-1), lo, hi);
  console.log(`${(lo + '-' + (hi > 9000 ? '' : hi)).padEnd(11)} ${String(r.n).padStart(4)}   ${r.a.toFixed(4)}   `
    + `${((r.a - all) >= 0 ? '+' : '') + ((r.a - all) * 1000).toFixed(1)}厘`);
}
console.log(`\n全体: ${all.toFixed(4)}`);

console.log('\n3. 押し上げの大きさと、エンジンで出た打率のずれの比較');
console.log('   （エンジン側の数字は scripts/run_phase3_test.mjs の実行結果。2026-08-05時点）');
const phase3 = { 2020: 1.38, 2021: 1.40, 2022: 1.08, 2023: 0.72, 2024: 0.39, 2025: 0.51 };
console.log('年     縮小の押し上げ   エンジンで出たずれ');
for (const y of YEARS) {
  const p = path.join(ROOT, 'outputs', `appraisal_${y}.json`);
  if (!existsSync(p)) continue;
  const a = JSON.parse(readFileSync(p, 'utf8'));
  let ab = 0, pre = 0, post = 0;
  for (const r of a) { const o = r.observed; if (!o?.preShrink) continue; ab += r.ab; pre += o.preShrink.avg * r.ab; post += o.avg * r.ab; }
  const rel = (post - pre) / pre * 100;
  console.log(`${y}    ${(rel >= 0 ? '+' : '') + rel.toFixed(2)}%          ${(phase3[y] >= 0 ? '+' : '') + phase3[y].toFixed(2)}%`);
}
console.log('\n※両者は同じ桁だが年ごとの動きは一致しない。縮小だけが原因とは言い切れず、');
console.log('  他の要因（環境補正の基準年からの距離、エンジン側の打球処理）も混ざっている可能性がある。');
db.close();

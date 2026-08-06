// 縮小がリーグ打率を押し上げる問題に対して、対処案の効果を実測する（適用はしない）。
//
// 背景（2026-08-05）:
//   エンジンで回すと打率が6年すべて実績より高い。原因は縮小（少打席の選手を基準へ寄せる処理）が
//   リーグ打率を +0.14〜+0.39ポイント押し上げること。
//
// ★どの基準が押し上げているかを分けたら、当初の推奨が外れていた:
//   self_recent（本人の近年成績）が全体への寄与 +2.45〜+2.56厘で主因。
//   league（リーグ平均）は人数が少なく +0.05〜+0.18厘しか効かない。
//   → 「少打席選手のleague基準を打席帯別にする」（案A）は**ほとんど効かない**。
//
//   self_recent が押し上げる理由: 少打席の年は本人の平均より悪い成績になりやすい
//   （調子が悪いから使われない）。それを本人の平均へ戻すと上がる。
//
// この道具がすること:
//   縮小後のリーグ加重平均が縮小前と一致するよう、全員の打率を一律の比率で戻す（案B）。
//   選手どうしの序列は変わらない。効果を数字で出すだけで、査定本体には何も書き込まない。
//
// 使い方: node scripts/try_shrinkage_rescale.mjs [年...]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YEARS = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [2021, 2024];

console.log('案B: 縮小後のリーグ打率が縮小前に戻るよう、全員を一律の比率で調整する\n');
console.log('年     縮小前    縮小後    調整の比率   調整後   個人の値が動く幅');

for (const y of YEARS) {
  const p = path.join(ROOT, 'outputs', `appraisal_${y}.json`);
  if (!existsSync(p)) { console.log(`${y}   （査定ファイルが無い）`); continue; }
  const a = JSON.parse(readFileSync(p, 'utf8'));

  let ab = 0, pre = 0, post = 0;
  for (const r of a) {
    const o = r.observed;
    if (!o?.preShrink) continue;
    ab += r.ab; pre += o.preShrink.avg * r.ab; post += o.avg * r.ab;
  }
  const preAvg = pre / ab, postAvg = post / ab;
  const k = preAvg / postAvg;                       // これを掛ければ合計が戻る

  // 個人がどれだけ動くか（打率の変化量）
  const moves = [];
  for (const r of a) {
    const o = r.observed;
    if (!o?.preShrink) continue;
    moves.push(Math.abs(o.avg * k - o.avg));
  }
  moves.sort((x, y2) => x - y2);
  console.log(`${y}   ${preAvg.toFixed(4)}   ${postAvg.toFixed(4)}   ×${k.toFixed(5)}   `
    + `${(postAvg * k).toFixed(4)}   中央${(moves[Math.floor(moves.length / 2)] * 1000).toFixed(2)}厘 / 最大${(moves.at(-1) * 1000).toFixed(2)}厘`);
}

console.log('\n案ごとの見込み（2026-08-05の実測にもとづく）');
console.log('  案A 出場量別の基準値にする    … **ほとんど効かない**。押し上げの主因は本人の近年成績で、');
console.log('                                  リーグ平均を基準にしている選手は3〜6人しかいない');
console.log('  案B 縮小後に一律で戻す        … リーグ打率は定義上ぴったり戻る。個人の序列は変わらない。');
console.log('                                  ただし「能力値は個人の実力」という建て付けに、合計を合わせる');
console.log('                                  ための後付けの調整が入る');
console.log('  案C そのまま                  … 打率が6年すべて +0.66〜+2.03% 高いまま残る');
console.log('\n※この道具は数字を出すだけで、査定には何も書き込まない。採否はオーナー判断。');

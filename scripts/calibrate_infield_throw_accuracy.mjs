// 内野手の「送球」（精度）を得能として判定する。捕手（calibrate_catcher_throw_accuracy.mjs）と同じ型。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//
// 仕様の位置づけ（04 §4.3・§10.2）:
//   肩力＝送球の速度・遠投／**送球＝精度**／守備力＝捕球からリリースまでの速さ・範囲。
//   3つは別の能力で、混ぜてはいけない。
//
// オーナー指示（2026-08-05）:
//   「守備力に使ってみたいし、守備力の要素を切り分けられたら、肩力の要素も切り分けられるかもしれない」
//   → 切り分けた3成分のうち、**送球の正確さ**が最も独立している（守備範囲との相関 -0.13）。
//     守備力（RngRベース）とは重ならないので、二重計上にならずに足せる。
//
// 材料:
//   走者なしの内野ゴロ30,716件のうち、悪送球で打者を出塁させたもの276件。
//   表記は「◯◯(遊)の悪送球により出塁する」。1件あたり112打球に1回の稀な事象。
//
// ★なぜ100段階でなく得能（有無）なのか:
//   捕手の送球精度と同じ理由。事象が稀で、最多の野手でも11件しかない。
//   連続値にすると偶然のばらつきを能力差として読む。
//   二項分布で「リーグ平均から偶然ではこうならない」と言える野手だけに印を付ける。
//
// 難易度の調整:
//   守備位置ごとに悪送球の起きやすさが違う（三塁は一塁まで遠く、一塁手はほぼ投げない）。
//   位置ごとの平均を基準にする。位置を無視すると三塁手が一律に悪く出る。
//
// 使い方: node scripts/calibrate_infield_throw_accuracy.mjs

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 捕手側（calibrate_catcher_throw_accuracy.mjs）と同じ式。
// ★あちらから import すると、あちらの本体まで走ってしまう（実行部分がトップレベルにあるため）ので
//   ここで定義する。式を変える時は両方を直すこと。
/** 二項分布の累積確率（k以下になる確率）。対数で漸化させて桁あふれを避ける */
function binomCdf(k, n, p) {
  if (k < 0) return 0;
  if (k >= n) return 1;
  let logC = 0, sum = 0;
  const lp = Math.log(p), lq = Math.log(1 - p);
  for (let i = 0; i <= k; i++) {
    if (i > 0) logC += Math.log((n - i + 1) / i);
    sum += Math.exp(logC + i * lp + (n - i) * lq);
  }
  return Math.min(1, sum);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

const MIN_EVENTS = 150;    // これ未満は判定しない（悪送球は112打球に1回なので、150打球で期待1.3件）
const ALPHA = 0.05;

const rows = db.prepare(`SELECT fielder, fielder_norm, pos, kind FROM infield_grounder_events
  WHERE has_runner = 0`).all();

// 守備位置ごとの平均（位置で難しさが違う）
const byPos = new Map();
for (const r of rows) {
  if (!byPos.has(r.pos)) byPos.set(r.pos, { n: 0, e: 0 });
  const v = byPos.get(r.pos); v.n++; v.e += (r.kind === 'throw_error' ? 1 : 0);
}
console.log('守備位置ごとの悪送球の割合（これを基準にする）');
for (const [p, v] of [...byPos].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${p}  ${String(v.n).padStart(6)}打球  ${v.e}件  ${(v.e / v.n * 100).toFixed(2)}%`);
}

// 選手ごと（主に守った位置で判定する。複数位置なら最多の位置）
const byPlayer = new Map();
for (const r of rows) {
  if (!byPlayer.has(r.fielder_norm)) byPlayer.set(r.fielder_norm, { name: r.fielder, n: 0, e: 0, pos: new Map() });
  const v = byPlayer.get(r.fielder_norm);
  v.n++; v.e += (r.kind === 'throw_error' ? 1 : 0);
  v.pos.set(r.pos, (v.pos.get(r.pos) ?? 0) + 1);
}

const judged = [];
for (const [k, v] of byPlayer) {
  if (v.n < MIN_EVENTS) continue;
  const mainPos = [...v.pos].sort((a, b) => b[1] - a[1])[0][0];
  const base = byPos.get(mainPos);
  const p = base.e / base.n;
  const expected = v.n * p;
  // 少ない方（正確）／多い方（逸れやすい）の両側で判定
  const pLow = binomCdf(v.e, v.n, p);                    // これ以下になる確率
  const pHigh = 1 - binomCdf(v.e - 1, v.n, p);           // これ以上になる確率
  let ability = null;
  if (pLow < ALPHA / 2) ability = '送球◎';
  else if (pHigh < ALPHA / 2) ability = '送球×';
  judged.push({
    fielder: k, name: v.name, pos: mainPos, chances: v.n, errors: v.e,
    rate: v.e / v.n, expected, p_low: pLow, p_high: pHigh, ability,
  });
}
judged.sort((a, b) => a.rate - b.rate);

console.log(`\n判定した野手: ${judged.length}人（${MIN_EVENTS}打球以上）`);
const withAbility = judged.filter(j => j.ability);
console.log(`得能が付いた: ${withAbility.length}人`);
for (const j of withAbility) {
  console.log(`  ${j.ability}  ${j.name.padEnd(8)} ${j.pos}  ${j.errors}件/${j.chances}打球 (${(j.rate * 100).toFixed(2)}%)  期待${j.expected.toFixed(1)}件`);
}
console.log('\n参考（得能は付かないが端にいる人）');
console.log('  少ない方:', judged.slice(0, 5).map(j => `${j.name}${j.errors}/${j.chances}`).join(' '));
console.log('  多い方  :', judged.slice(-5).map(j => `${j.name}${j.errors}/${j.chances}`).join(' '));

const out = path.join(ROOT, 'outputs', 'derived', 'infield_throw_accuracy.json');
writeFileSync(out, JSON.stringify({
  _source: 'Nippon Baseball Data Repository (MIT License)',
  _method: '走者なしの内野ゴロで、悪送球により打者を出塁させた割合。守備位置ごとの平均を基準に二項分布で判定',
  _caution: [
    '事象が稀（112打球に1回）。連続値にせず得能（有無）で扱う',
    '守備力（守備範囲）とは別の成分。相関 -0.13 で重ならない＝二重計上にならない',
    '1球データは2020年からしか無いので、それ以前の年は判定できない',
  ],
  min_events: MIN_EVENTS, alpha: ALPHA,
  position_baseline: Object.fromEntries([...byPos].map(([p, v]) => [p, { chances: v.n, errors: v.e, rate: v.e / v.n }])),
  judged,
}, null, 2), 'utf8');
console.log(`\n保存: ${path.relative(ROOT, out)}`);
db.close();

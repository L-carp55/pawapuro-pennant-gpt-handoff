// 捕手の「送球」（精度）を得能として判定する。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//   This uses data sourced from the Nippon Baseball Data Repository.
//
// 仕様の位置づけ（04 §4.3・§10.2）:
//   肩力＝送球の速度・遠投／**送球＝精度**／守備力＝捕球からリリースまでの速さ。
//   3つは別の能力で、混ぜてはいけない。
//
// これまで送球が null だった理由と、今回それが変わった点:
//   実装は「送球エラーだけを取り出したデータが公開されていない」として恒久 null にしていた。
//   確かに守備記録の失策は捕球失策と送球失策を分けていない。
//   だが1球データには**盗塁を許したうえで走者がさらに進塁した**記録が残っており、
//   これは「二塁へ投げた球が逸れて余分な塁を与えた」＝**送球精度そのもの**。
//   実測（二盗8,867件・2020-2026）: リーグ全体で2.38%、捕手ごとに 0.0%〜4.1% の差がある。
//
// ★なぜ100段階でなく得能（有無）なのか（2026-08-05 オーナー裁定）:
//   事象が稀で、最多の捕手でも14件しかない。連続値にすると**偶然のばらつきを能力差として読む**。
//   二項分布で「リーグ平均から偶然ではこうならない」と言える捕手だけに印を付ける。
//   実測では50件以上の28人中**2人しか判別できなかった**（海野隆司=正確／佐藤都志也=逸れやすい）。
//   残りは中間＝得能なし。これは材料の限界を正直に反映した結果で、
//   「全員に何かを付ける」ために基準を緩めることはしない。
//
// 使い方: node scripts/calibrate_catcher_throw_accuracy.mjs

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const MIN_EVENTS = 50;     // これ未満は判定しない
const ALPHA = 0.05;        // 両側。偶然でこうなる確率がこれ未満なら印を付ける

/** 二項分布の累積確率（k以下になる確率）。対数で漸化させて桁あふれを避ける */
export function binomCdf(k, n, p) {
  if (k < 0) return 0;
  if (k >= n) return 1;
  let sum = 0, logC = 0;
  for (let i = 0; i <= k; i++) {
    if (i > 0) logC += Math.log((n - i + 1) / i);
    sum += Math.exp(logC + i * Math.log(p) + (n - i) * Math.log(1 - p));
  }
  return Math.min(1, sum);
}

const rows = db.prepare(`
  SELECT catcher, description FROM catcher_steal_event
  WHERE second_base_only = 1 AND from_pickoff = 0`).all();

// 「盗塁を許したうえに、さらに進塁された」＝送球が逸れた
const isWild = d => /さらに|悪送球/.test(d ?? '');

const by = {};
for (const r of rows) {
  (by[r.catcher] ??= { n: 0, wild: 0 });
  by[r.catcher].n++;
  if (isWild(r.description)) by[r.catcher].wild++;
}

const leagueRate = rows.filter(r => isWild(r.description)).length / rows.length;

const judged = [];
for (const [name, v] of Object.entries(by)) {
  if (v.n < MIN_EVENTS) continue;
  const rate = v.wild / v.n;
  const pLow = binomCdf(v.wild, v.n, leagueRate);          // これ以下になる確率
  const pHigh = 1 - binomCdf(v.wild - 1, v.n, leagueRate); // これ以上になる確率

  let ability = null, p = null;
  if (pLow < ALPHA) { ability = '送球○'; p = pLow; }
  else if (pHigh < ALPHA) { ability = '送球△'; p = pHigh; }

  judged.push({
    catcher: name, events: v.n, wild_throws: v.wild, wild_rate: rate,
    ability, p_value: p,
    basis: ability
      ? `盗塁を許した後の余分な進塁 ${v.wild}/${v.n}件（${(rate * 100).toFixed(1)}%）。`
        + `リーグ平均${(leagueRate * 100).toFixed(2)}%に対し、偶然でこうなる確率は${(p * 100).toFixed(2)}%`
      : `${v.n}件中${v.wild}件（${(rate * 100).toFixed(1)}%）。リーグ平均と偶然の範囲で区別できない`,
  });
}
judged.sort((a, b) => a.wild_rate - b.wild_rate);

const out = {
  _meta: {
    purpose: '捕手の送球（精度）を得能として判定する',
    spec: 'docs/satei_handoff/04_RUNNING_DEFENSE_CATCHER.md §4.3「精度: 送球得能」／§10.2',
    source: 'Nippon Baseball Data Repository（MIT License）の1球データ 2020-2026',
    attribution: 'This uses data sourced from the Nippon Baseball Data Repository.',
    metric: '盗塁を許したうえで走者がさらに進塁した割合（＝二塁への送球が逸れた）',
    league_rate: leagueRate,
    total_events: rows.length,
    min_events: MIN_EVENTS,
    alpha: ALPHA,
    _why_ability_not_scale:
      '★事象が稀（リーグ全体2.38%、最多の捕手でも14件）。100段階の連続値にすると'
      + '偶然のばらつきを能力差として読む。二項分布で「偶然ではこうならない」と言える'
      + '両端だけに印を付ける（2026-08-05 オーナー裁定）',
    _honest_limit:
      `50件以上の${judged.length}人のうち、判別できたのは${judged.filter(j => j.ability).length}人だけ。`
      + '残りは中間＝得能なし。**全員に何かを付けるために基準を緩めることはしない**',
    _not_double_counted:
      '肩力（送球速度）・守備力（捕球からリリースまでの速さ）とは別の材料を使っている。'
      + '仕様04 §4.3が3つを別能力と定めているとおりに分離した',
  },
  judged,
};

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'catcher_throw_accuracy.json'),
  JSON.stringify(out, null, 2), 'utf8');

const withAbility = judged.filter(j => j.ability);
console.log(`盗塁 ${rows.length}件から送球精度を判定（リーグ平均 ${(leagueRate * 100).toFixed(2)}%）`);
console.log(`  判定対象（${MIN_EVENTS}件以上）: ${judged.length}人`);
console.log(`  ★得能が付いたのは ${withAbility.length}人だけ（残りは偶然と区別できない）\n`);
for (const j of withAbility) {
  console.log(`  ${j.ability}  ${j.catcher.padEnd(12)}`
    + `${String(j.events).padStart(4)}件中${String(j.wild_throws).padStart(3)}件 = ${(j.wild_rate * 100).toFixed(1)}%`
    + `  （偶然でこうなる確率 ${(j.p_value * 100).toFixed(2)}%）`);
}
console.log('\n参考（判定に届かなかった上位・下位）:');
for (const j of judged.filter(x => !x.ability).slice(0, 3))
  console.log(`  ―     ${j.catcher.padEnd(12)}${String(j.events).padStart(4)}件中${String(j.wild_throws).padStart(3)}件 = ${(j.wild_rate * 100).toFixed(1)}%`);
for (const j of judged.filter(x => !x.ability).slice(-3))
  console.log(`  ―     ${j.catcher.padEnd(12)}${String(j.events).padStart(4)}件中${String(j.wild_throws).padStart(3)}件 = ${(j.wild_rate * 100).toFixed(1)}%`);
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

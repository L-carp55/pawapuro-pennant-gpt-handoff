// 捕手の守備力を、盗塁阻止から「投手のクイック」と「走者の足」を差し引いて作る。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//   This uses data sourced from the Nippon Baseball Data Repository.
//
// なぜこの形か（仕様04 §10.2/§10.3、2026-08-05 オーナー裁定）:
//   仕様は捕手の守備力を「**捕球からリリースまでの速さ、動作**」と定め、
//   §10.3 で `CS_result ~ catcher_arm + catcher_exchange + pitcher_quick + runner_speed` の形を挙げている。
//   また §10 は「**阻止率をそのまま肩へ変換しない**」と明示している。
//
//   その理由を実データで確かめた（二盗8,867件・2020-2026）。阻止率のばらつき（標準偏差）:
//     投手による差 0.103（高橋宏斗65.6% 〜 宮西尚生16.2%）
//     走者による差 0.097（甲斐65.6% 〜 和田18.0%）
//     捕手による差 0.056（岸田行倫49.6% 〜 會澤翼25.6%）
//   ＝**投手と走者の影響が捕手の約2倍**。素の阻止率を捕手の能力とすると、
//   測っているものの大半が捕手以外になる。オーナー裁定で両方を同時に調整する。
//
// 調整のやり方（MLBのOAAや本プロジェクトのRngRと同じ考え方）:
//   盗塁1件ごとに「この投手・この走者なら、平均的な捕手は何%刺せるか」を出し、
//   実際の結果との差を足し上げる。加法モデルを反復で解く（交互に推定して収束させる）。
//     logit(p) = 捕手効果 + 投手効果 + 走者効果 + 全体平均
//   多くの投手・走者は観測が少ないので、効果は観測数で縮約する（少ない相手ほど平均へ寄せる）。
//
// 出てくるもの:
//   catcher_effect  … 投手・走者を揃えた後に残る捕手の力（＝肩＋持ち替え＋送球精度の合成）
//   ★これはまだ「守備力」ではない。ここから**送球速度で説明できる分（肩の強さ）を引いた残り**が
//     仕様の言う「捕球からリリースまでの速さ」＝守備力。分離は次の工程。
//
// 使い方: node scripts/calibrate_catcher_defense.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const MIN_EVENTS_CATCHER = 50;   // これ未満の捕手は効果を出さない（率が暴れる）
const KAPPA = 60;                // 縮約の強さ（観測数がこれと同じ時、効果は半分に縮む）
const ITERATIONS = 30;

/** 記述から走者名を取り出す（盗塁の行は走者の列が空になるため） */
const runnerOf = d => {
  const m = (d ?? '').match(/一塁走者([^:：はがも、。]+)/);
  return m ? m[1].trim() : null;
};

const rows = db.prepare(`
  SELECT catcher, pitcher, caught, description, season
  FROM catcher_steal_event
  WHERE second_base_only = 1 AND from_pickoff = 0 AND catcher IS NOT NULL`).all();

for (const r of rows) r.runner = runnerOf(r.description);
const events = rows.filter(r => r.pitcher && r.runner);
console.error(`盗塁 ${events.length}件（投手・走者とも特定できたもの / 全${rows.length}件）`);

const logit = p => Math.log(p / (1 - p));
const sigmoid = z => 1 / (1 + Math.exp(-z));

const overall = events.filter(e => e.caught).length / events.length;
const base = logit(overall);

// 加法モデルを交互に解く。各主体の効果は「実際 − 他の要因で説明できる分」の平均
const eff = { catcher: new Map(), pitcher: new Map(), runner: new Map() };
const count = { catcher: new Map(), pitcher: new Map(), runner: new Map() };
for (const e of events) {
  for (const k of ['catcher', 'pitcher', 'runner']) {
    count[k].set(e[k], (count[k].get(e[k]) ?? 0) + 1);
    if (!eff[k].has(e[k])) eff[k].set(e[k], 0);
  }
}

for (let it = 0; it < ITERATIONS; it++) {
  for (const target of ['catcher', 'pitcher', 'runner']) {
    const others = ['catcher', 'pitcher', 'runner'].filter(k => k !== target);
    const sum = new Map(), n = new Map();
    for (const e of events) {
      // この1件で、対象以外の要因から予測される阻止確率
      const z = base + others.reduce((s, k) => s + (eff[k].get(e[k]) ?? 0), 0);
      const p = Math.min(0.99, Math.max(0.01, sigmoid(z)));
      // 実際との差を、対象の効果として集める（logit のスケールへ戻す）
      const resid = (e.caught - p) / (p * (1 - p));
      sum.set(e[target], (sum.get(e[target]) ?? 0) + resid);
      n.set(e[target], (n.get(e[target]) ?? 0) + 1);
    }
    for (const [k, s] of sum) {
      const cnt = n.get(k);
      // 観測数で縮約する（少ない相手ほど0＝平均へ寄せる）
      eff[target].set(k, (s / cnt) * (cnt / (cnt + KAPPA)));
    }
  }
}

// 収束の確認: モデルの当てはまりを素の平均と比べる
const ll = (fn) => events.reduce((s, e) => {
  const p = Math.min(0.999, Math.max(0.001, fn(e)));
  return s + (e.caught ? Math.log(p) : Math.log(1 - p));
}, 0);
const llBase = ll(() => overall);
const llModel = ll(e => sigmoid(base + eff.catcher.get(e.catcher) + eff.pitcher.get(e.pitcher) + eff.runner.get(e.runner)));

const catchers = [...eff.catcher.entries()]
  .filter(([k]) => count.catcher.get(k) >= MIN_EVENTS_CATCHER)
  .map(([k, v]) => {
    const n = count.catcher.get(k);
    const raw = events.filter(e => e.catcher === k);
    const rawRate = raw.filter(e => e.caught).length / raw.length;
    // 効果を「平均的な相手のときの阻止率」へ戻す（読みやすさのため）
    const adjusted = sigmoid(base + v);
    return { catcher: k, events: n, raw_rate: rawRate, adjusted_rate: adjusted, effect: v };
  })
  .sort((a, b) => b.effect - a.effect);

const out = {
  _meta: {
    purpose: '盗塁阻止から投手のクイックと走者の足を差し引き、捕手に帰属する分を取り出す',
    spec: 'docs/satei_handoff/04_RUNNING_DEFENSE_CATCHER.md §10.2/§10.3',
    source: 'Nippon Baseball Data Repository（MIT License）の1球データ 2020-2026',
    attribution: 'This uses data sourced from the Nippon Baseball Data Repository.',
    events_used: events.length,
    league_rate: overall,
    model: 'logit(p) = base + 捕手効果 + 投手効果 + 走者効果。交互推定30回、観測数で縮約（kappa=60）',
    _why_adjust: '実測のばらつき（標準偏差）は 投手0.103 / 走者0.097 / 捕手0.056。'
      + '投手と走者の影響が捕手の約2倍あるため、調整しないと捕手の能力を測れない。'
      + '仕様04 §10「阻止率をそのまま肩へ変換しない」の実装',
    _not_yet_defense: '★ここで出るのは肩＋持ち替え＋送球精度の合成。'
      + 'ここから送球速度で説明できる分（肩の強さ）を引いた残りが、'
      + '仕様の言う「捕球からリリースまでの速さ」＝守備力。分離は次の工程',
    fit: {
      log_likelihood_baseline: llBase,
      log_likelihood_model: llModel,
      improvement: llModel - llBase,
    },
    min_events_catcher: MIN_EVENTS_CATCHER,
    kappa: KAPPA,
  },
  catchers,
  // 参考: 投手・走者の効果も残す（後で使えるように。捕手の査定には直接使わない）
  pitchers_top: [...eff.pitcher.entries()]
    .filter(([k]) => count.pitcher.get(k) >= 30)
    .map(([k, v]) => ({ pitcher: k, events: count.pitcher.get(k), effect: v }))
    .sort((a, b) => b.effect - a.effect).slice(0, 15),
  runners_top: [...eff.runner.entries()]
    .filter(([k]) => count.runner.get(k) >= 30)
    .map(([k, v]) => ({ runner: k, events: count.runner.get(k), effect: v }))
    .sort((a, b) => a.effect - b.effect).slice(0, 15),
};

mkdirSync(path.join(ROOT, 'outputs', 'derived'), { recursive: true });
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'catcher_defense_effect.json'),
  JSON.stringify(out, null, 2), 'utf8');

console.log(`\n盗塁 ${events.length}件でモデルを解いた（リーグ全体の阻止率 ${(overall * 100).toFixed(1)}%）`);
console.log(`当てはまりの改善: ${(llModel - llBase).toFixed(1)}（対数尤度。0より大きければ素の平均より説明できている）`);
console.log(`\n捕手 ${catchers.length}人（${MIN_EVENTS_CATCHER}件以上）:`);
console.log('  捕手         件数   素の阻止率  調整後   差');
for (const c of catchers) {
  const d = (c.adjusted_rate - c.raw_rate) * 100;
  console.log(`  ${c.catcher.padEnd(12)}${String(c.events).padStart(4)}  `
    + `${(c.raw_rate * 100).toFixed(1).padStart(6)}%  ${(c.adjusted_rate * 100).toFixed(1).padStart(6)}%  `
    + `${d >= 0 ? '+' : ''}${d.toFixed(1)}`);
}
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

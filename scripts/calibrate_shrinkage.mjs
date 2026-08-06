// Sol仕様 02 §5.2 / 03 §4.3 の経験ベイズ縮小パラメータ kappa を実測する。
// 仕様では「kappa_Mは校正対象。ハードコード禁止」とされ、値は未決。
//
// 考え方: 縮小の目的は「観測値のうち運の成分を落として真の実力に近づける」こと。
//   真の実力に近い推定ほど翌年の成績をよく予測する。
//   今年の観測を kappa で Prior へ引き戻した推定値で翌年を予測し、RMSE最小の kappa を選ぶ。
//
// 縮小式（仕様 03 §4.3 の実装しやすい代替形）:
//   post = (AB × observed + kappa × prior) / (AB + kappa)
//   kappa は「Prior何打数ぶんの重み」を意味する。
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lg = {};
for (const r of db.prepare(`SELECT season,SUM(h) h,SUM(ab) ab,SUM(hr) hr FROM v_batting WHERE 1=1 GROUP BY season`).all()) {
  lg[r.season] = { avg: r.h / r.ab, hr: r.hr / r.ab };
}
const REF = lg[cfg.environment.reference_season];
const envAvg = s => Math.pow(REF.avg / lg[s].avg, cfg.environment.gamma_avg);
const envHr = s => Math.pow(REF.hr / lg[s].hr, cfg.environment.gamma_hr);

// 打数の下限を設けず全選手を取る（少打席こそ縮小の対象）
const rows = db.prepare(`
  SELECT season, player_id, ab, h, hr FROM v_batting
  WHERE ab >= 20`).all();

const byPlayer = new Map();
for (const r of rows) {
  if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, new Map());
  byPlayer.get(r.player_id).set(r.season, {
    ...r,
    avgEnv: (r.h / r.ab) * envAvg(r.season),
    hrEnv: (r.hr / r.ab) * envHr(r.season),
  });
}

// 評価用ペア: 今年(cur)で推定し、翌年(nxt)の環境補正済み実測を予測する。
// 翌年は十分な打数がある場合のみ（評価側のノイズを抑える）
const pairs = [];
for (const [, ss] of byPlayer) {
  for (const [s, cur] of ss) {
    const nxt = ss.get(s + 1);
    if (!nxt || nxt.ab < 200) continue;
    // Prior: 当年より前の本人実績（あれば直近3年の打数加重）。無ければリーグ平均
    let pAb = 0, pH = 0, pHr = 0;
    for (let k = 1; k <= 3; k++) {
      const p = ss.get(s - k);
      if (p) { pAb += p.ab; pH += p.h * envAvg(p.season) ; pHr += p.hr * envHr(p.season); }
    }
    const prior = pAb >= 50
      ? { avg: pH / pAb, hr: pHr / pAb, kind: 'self' }
      : { avg: REF.avg, hr: REF.hr, kind: 'league' };
    pairs.push({ cur, nxt, prior });
  }
}

function rmse(kappa, key, priorKey) {
  let se = 0;
  for (const { cur, nxt, prior } of pairs) {
    const obs = cur[key];
    const post = (cur.ab * obs + kappa * prior[priorKey]) / (cur.ab + kappa);
    se += (post - nxt[key]) ** 2;
  }
  return Math.sqrt(se / pairs.length);
}

function scan(key, priorKey, label) {
  const cands = [0, 25, 50, 100, 150, 200, 300, 400, 600, 900, 1500];
  const res = cands.map(k => ({ k, e: rmse(k, key, priorKey) }));
  const best = res.reduce((a, b) => (b.e < a.e ? b : a));
  console.log(`\n${label}`);
  console.log('kappa   翌年予測RMSE   (kappa=0は縮小なし)');
  for (const { k, e } of res) {
    console.log(String(k).padStart(5) + '   ' + e.toExponential(4) + (k === best.k ? '   ← 最良' : ''));
  }
  const noShrink = res.find(r => r.k === 0).e;
  console.log(`改善: ${((1 - best.e / noShrink) * 100).toFixed(1)}%  (縮小なし ${noShrink.toExponential(4)} → ${best.e.toExponential(4)})`);
  return best.k;
}

console.log(`=== 経験ベイズ縮小の強さを実測 ===`);
console.log(`評価ペア ${pairs.length}件（今年の打数20以上→翌年200以上）`);
const bySelf = pairs.filter(p => p.prior.kind === 'self').length;
console.log(`Prior内訳: 本人の過去実績 ${bySelf}件 / リーグ平均 ${pairs.length - bySelf}件`);

const kM = scan('avgEnv', 'avg', '【打率】');
const kP = scan('hrEnv', 'hr', '【本塁打率】');

console.log(`\n採用候補: kappa_M = ${kM} 打数相当 / kappa_P = ${kP} 打数相当`);
console.log(`意味: 打数${kM}の選手は観測とPriorが半々。それ未満はPrior寄り。`);
db.close();

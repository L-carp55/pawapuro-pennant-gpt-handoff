// 指定年の全打者を査定する（Tier C: 総合成績のみ）。
// 4層分離のうち第1層（補正成績＝環境補正＋経験ベイズ縮小）と第2層（平均得能込み基準）まで。
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitLogDist } from '../src/ratings/scale.mjs';
import { durabilityRate } from '../src/ratings/shrinkage.mjs';
import { makeContext } from '../src/cards/pipeline.mjs';
import { appraiseCardT90 } from '../src/cards/t90_pipeline_adapter.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const MIN_PA = Number(process.argv[3] || 30);

const J = async f => JSON.parse(await readFile(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = await J('ratings.json');
const rv = (await J('run_values.json')).values;
const runNorm = await J('running_norms.json');
const fldNorm = await J('fielding_norms.json');
const scoutingLedger = loadLedger(await J('scouting.json'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lgOf = s => {
  const r = db.prepare(`SELECT SUM(h) h,SUM(ab) ab,SUM(hr) hr FROM v_batting WHERE season=?`).get(s);
  return r?.ab ? { avg: r.h / r.ab, hr: r.hr / r.ab } : null;
};
const lgCache = {};
const lg = s => (lgCache[s] ??= lgOf(s));
const REF = lg(cfg.environment.reference_season);
const env = { lgAvg: lg(SEASON).avg, lgHrRate: lg(SEASON).hr, refAvg: REF.avg, refHrRate: REF.hr };

const envAvg = s => Math.pow(REF.avg / lg(s).avg, cfg.environment.gamma_avg);
const envHr = s => Math.pow(REF.hr / lg(s).hr, cfg.environment.gamma_hr);

// 対象年の打者。投手は除外する（Sol仕様 02 §1.2「投手は別仕様。野手v2.0で投手を査定してはならない」）
const rows = db.prepare(`
  SELECT player_id, name, team, position, pa, ab, h, b2, b3, hr, bb, hbp, so, sh, sf
  FROM v_batting WHERE season=? AND pa >= ? AND position <> '投'`).all(SEASON, MIN_PA);
const excludedPitchers = db.prepare(`
  SELECT COUNT(*) n FROM v_batting WHERE season=? AND pa >= ? AND position = '投'`).get(SEASON, MIN_PA).n;

// 能力値スケールの基準分布は、十分な打席がある層から作る（少打席の外れ値で歪めない）
const base = rows.filter(r => r.pa >= 200);
const dists = {
  contact: fitLogDist(base.map(r => r.so / r.pa)),
  eye: fitLogDist(base.map(r => r.bb / r.pa)),
};

// 各選手の他年度履歴（一軍=プロEYE球、二軍=NPB Basement経由）
const histRows = db.prepare(`
  SELECT player_id, season, ab, h, hr FROM v_batting
  WHERE season BETWEEN ? AND ? AND ab > 0 AND position <> '投'`).all(SEASON - 3, SEASON + 3);
const hist = new Map();
const pushHist = (id, rec) => { if (!hist.has(id)) hist.set(id, []); hist.get(id).push(rec); };
for (const h of histRows) {
  if (!lg(h.season)) continue;
  pushHist(h.player_id, {
    season: h.season, ab: h.ab, isFarm: false,
    avgEnv: (h.h / h.ab) * envAvg(h.season),
    hrEnv: (h.hr / h.ab) * envHr(h.season),
  });
}

// 二軍成績（NPB Basement）を Prior 候補に加える（Sol仕様 §8.4 新人・ブレイク初年度）。
// 制約: bm_bat は率のみで生カウントが無い。打率は SLG−ISO で復元でき、
// 打数は PA×(1−BB%−HBP相当) で近似する。本塁打の生数は復元できないため
// HR/FB%×FB%×インプレー打数 で推定する（この経路は推定値としてフラグを立てる）。
const farmRows = db.prepare(`
  SELECT l.proeye_id, b.season, b.pa, b.slg, b.iso, b.bb_pct, b.k_pct, b.hr_fb_pct, b.offb_pct
  FROM v_bm_bat b
  JOIN player_link l ON l.bm_id = b.player_id
  WHERE b.farm = 1 AND b.season BETWEEN ? AND ? AND b.pa >= 50
  GROUP BY l.proeye_id, b.season`).all(SEASON - 3, SEASON + 3);
let farmUsed = 0;
for (const f of farmRows) {
  if (!lg(f.season) || f.slg == null || f.iso == null) continue;
  const avg = f.slg - f.iso;
  const ab = Math.round(f.pa * (1 - (f.bb_pct ?? 0) / 100 - 0.01));
  if (!(ab > 0) || !(avg >= 0)) continue;
  // 本塁打率の推定: インプレーの外野フライのうち HR/FB% が本塁打
  const inplay = ab * (1 - (f.k_pct ?? 20) / 100);
  const hrEst = inplay * ((f.offb_pct ?? 0) / 100) * ((f.hr_fb_pct ?? 0) / 100);
  pushHist(f.proeye_id, {
    season: f.season, ab, isFarm: true,
    avgEnv: avg * envAvg(f.season),
    hrEnv: (hrEst / ab) * envHr(f.season),
    estimated: true,
  });
  farmUsed++;
}

// ★2026-08-05: 査定の経路をカード査定（src/cards/pipeline.mjs）へ統一した。
//   それまでは、ここで appraiseBatting を直接呼んでおり、カード査定が渡している材料
//   （球場補正・ミートの文脈打率）を渡していなかった。同じ選手に2つの値が存在し、
//   **エンジンの分布合わせはこちら側で判定していた**ため、カード側の改善が判定に入らなかった。
//   実測した食い違い（2021年250人）: ミート平均1.76点・パワー平均4.52点、最大31.6点。
//   主力は球場補正のぶんカードが低く（村上-12.3・岡本-11.6）、少打席は縮小の扱いの違いで高く出ていた。
const ctx = makeContext(db, cfg);
const results = [];
const failures = [];
for (const r of rows) {
  // 名前ではなく選手IDで引く。同姓同名（大和・Ａ．ジョーンズ等）が名前では解決できず落ちるため
  const res = appraiseCardT90(ctx, { playerId: r.player_id, mode: String(SEASON), cfg, rv, runNorm, fldNorm, scoutingLedger });
  if (res.error || !res.batting) { failures.push({ name: r.name, reason: res.error ?? '打撃査定なし' }); continue; }
  const b = res.batting;
  results.push({
    name: r.name, team: r.team, pa: r.pa, ab: r.ab, h: r.h, hr: r.hr,
    meet: b.meet, power: b.power, contact: b.contact, eye: b.eye,
    observed: b.observed,
    durability: durabilityRate(r.pa, 143, cfg.shrinkage),
    // どの材料が効いたかを残す（後から「なぜこの値か」を追えるように）
    park_factor: res.card?.calc_log?.power?.park?.factor ?? null,
    context_tier: res.meta?.contextTier ?? null,
  });
}
if (failures.length) {
  console.log(`\n査定できなかった選手 ${failures.length}人（穴を空けたまま出す。実成績で埋めるのは消費側の判断）`);
  for (const f of failures.slice(0, 5)) console.log(`  ${f.name} — ${f.reason}`);
  if (failures.length > 5) console.log(`  …他${failures.length - 5}人`);
}

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
console.log(`\n=== ${SEASON}年 全打者査定 (${MIN_PA}打席以上 ${results.length}人) ===\n`);
console.log(`投手を除外: ${excludedPitchers}人（Sol仕様 02 §1.2）  二軍Prior候補: ${farmUsed}件`);
console.log('Prior内訳: ' + ['self_recent', 'farm', 'league'].map(k =>
  `${k}=${results.filter(r => r.observed.priorKind === k).length}`).join(' / '));

for (const k of ['meet', 'power', 'contact', 'eye']) {
  const v = results.map(r => r[k]);
  console.log(`${k.padEnd(8)} 最小${q(v, 0).toFixed(1).padStart(6)} 25%${q(v, .25).toFixed(1).padStart(6)} 中央${q(v, .5).toFixed(1).padStart(6)} 75%${q(v, .75).toFixed(1).padStart(6)} 最大${q(v, .999).toFixed(1).padStart(6)}`);
}

// 縮小の効果が最も大きい選手（少打席）
console.log('\n少打席選手での縮小の効き方（打席数の少ない順）');
console.log('選手'.padEnd(13) + '打席'.padStart(5) + '打率'.padStart(7) + '本'.padStart(3) + '  ミート 縮小前→後   Prior');
for (const r of [...results].sort((a, b) => a.pa - b.pa).slice(0, 8)) {
  const preM = r.observed.preShrink.avg;
  console.log(r.name.replace(/　/g, ' ').padEnd(13) + String(r.pa).padStart(5) + (r.h / r.ab).toFixed(3).padStart(7) + String(r.hr).padStart(3)
    + ('  ' + preM.toFixed(3) + '→' + r.observed.avg.toFixed(3)).padStart(16) + '   ' + (r.observed.priorKind ?? '-'));
}

await writeFile(path.join(ROOT, 'outputs', `appraisal_${SEASON}.json`), JSON.stringify(results, null, 1), 'utf8');
console.log(`\n→ outputs/appraisal_${SEASON}.json`);
db.close();

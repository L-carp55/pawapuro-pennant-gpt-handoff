// 仕様02 §6.4のパワー補助指標を、KONAMI値を使わず実データで測る。
//
// 評価の物差し:
//   今年の現行 blendedHrRate で翌年の環境補正済み実本塁打率を予測する。
//   補助指標を1つ足した線形モデルが、現行値だけのモデルより年度外検証RMSEを下げるかを見る。
//   係数は各学習fold内で推定し、実装値としてハードコードしない。

import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blendedHrRate, applyEnvironment, gammaForLevel, playerParkFactor } from '../src/ratings/from_rates.mjs';
import { loadSplits } from '../src/ratings/nf3_splits.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_AB = 200;
const DB_PATH = path.join(ROOT, 'data', 'pennant.db');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const parkFactors = JSON.parse(await readFile(path.join(ROOT, 'outputs', 'derived', 'park_factors.json'), 'utf8'));
const sourceDbSha256 = createHash('sha256').update(await readFile(DB_PATH)).digest('hex');
const db = new DatabaseSync(DB_PATH, { readOnly: true });

const leagueRows = db.prepare(
  'SELECT season, SUM(ab) ab, SUM(hr) hr FROM v_batting GROUP BY season',
).all();
const league = new Map(leagueRows.map(r => [r.season, { hrRate: r.hr / r.ab }]));
const refHrRate = league.get(cfg.environment.reference_season).hrRate;

function envHr(rate, season) {
  if (!(rate >= 0)) return null;
  const gamma = gammaForLevel(rate * cfg.ab_ref.value, cfg);
  return applyEnvironment(rate, league.get(season)?.hrRate, refHrRate, gamma);
}

function pearson(rows, xKey, yKey) {
  const a = rows.filter(r => Number.isFinite(r[xKey]) && Number.isFinite(r[yKey]));
  if (a.length < 3) return null;
  const mx = a.reduce((s, r) => s + r[xKey], 0) / a.length;
  const my = a.reduce((s, r) => s + r[yKey], 0) / a.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const r of a) {
    const dx = r[xKey] - mx, dy = r[yKey] - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

function solve(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const div = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      for (let j = col; j <= n; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map(row => row[n]);
}

function fitLinear(rows, featureKeys) {
  const cols = ['_intercept', ...featureKeys];
  const k = cols.length;
  const xtx = Array.from({ length: k }, () => Array(k).fill(0));
  const xty = Array(k).fill(0);
  for (const r of rows) {
    const x = [1, ...featureKeys.map(key => r[key])];
    for (let i = 0; i < k; i++) {
      xty[i] += x[i] * r.outcome;
      for (let j = 0; j < k; j++) xtx[i][j] += x[i] * x[j];
    }
  }
  return solve(xtx, xty);
}

function predict(row, keys, beta) {
  return beta[0] + keys.reduce((s, key, i) => s + beta[i + 1] * row[key], 0);
}

function compareFeature(rows, featureKey, isoKey = 'iso') {
  const usable = rows.filter(r => Number.isFinite(r.baseline)
    && Number.isFinite(r[featureKey]) && Number.isFinite(r.outcome));
  const targetYears = [...new Set(usable.map(r => r.targetSeason))].sort();
  let seBase = 0, sePlus = 0, tested = 0, folds = 0;
  const foldChanges = [];
  for (const year of targetYears) {
    const train = usable.filter(r => r.targetSeason !== year);
    const test = usable.filter(r => r.targetSeason === year);
    if (train.length < 10 || !test.length) continue;
    const betaBase = fitLinear(train, ['baseline']);
    const betaPlus = fitLinear(train, ['baseline', featureKey]);
    if (!betaBase || !betaPlus) continue;
    folds++;
    let foldSeBase = 0, foldSePlus = 0;
    for (const r of test) {
      const errBase = predict(r, ['baseline'], betaBase) - r.outcome;
      const errPlus = predict(r, ['baseline', featureKey], betaPlus) - r.outcome;
      seBase += errBase ** 2;
      sePlus += errPlus ** 2;
      foldSeBase += errBase ** 2;
      foldSePlus += errPlus ** 2;
      tested++;
    }
    const foldBase = Math.sqrt(foldSeBase / test.length);
    const foldPlus = Math.sqrt(foldSePlus / test.length);
    foldChanges.push((foldPlus / foldBase - 1) * 100);
  }
  const baselineRmse = tested ? Math.sqrt(seBase / tested) : null;
  const augmentedRmse = tested ? Math.sqrt(sePlus / tested) : null;
  return {
    n: tested,
    held_out_target_seasons: folds,
    baseline_rmse: baselineRmse,
    augmented_rmse: augmentedRmse,
    rmse_change_pct: baselineRmse && augmentedRmse
      ? (augmentedRmse / baselineRmse - 1) * 100
      : null,
    improves: baselineRmse != null && augmentedRmse < baselineRmse,
    improved_folds: foldChanges.filter(v => v < 0).length,
    worsened_or_equal_folds: foldChanges.filter(v => v >= 0).length,
    median_fold_rmse_change_pct: foldChanges.length
      ? [...foldChanges].sort((a, b) => a - b)[Math.floor(foldChanges.length / 2)]
      : null,
    correlation_with_iso: pearson(usable, featureKey, isoKey),
  };
}

const coreRows = db.prepare(
  "SELECT season, player_id, name, pa, ab, h, b2, b3, hr, tb, bb, hbp, so, sh, sf "
  + "FROM v_batting WHERE season BETWEEN 2006 AND 2025 AND position <> '投' AND ab >= ?",
).all(MIN_AB);
const coreByPlayer = new Map();
for (const r of coreRows) {
  if (!coreByPlayer.has(r.player_id)) coreByPlayer.set(r.player_id, new Map());
  coreByPlayer.get(r.player_id).set(r.season, r);
}

const corePairs = [];
for (const seasons of coreByPlayer.values()) {
  for (const [season, cur] of seasons) {
    const nxt = seasons.get(season + 1);
    if (!nxt) continue;
    const line = {
      PA: cur.pa, AB: cur.ab, H: cur.h, B2: cur.b2, B3: cur.b3, HR: cur.hr,
      BB: cur.bb, HBP: cur.hbp, SO: cur.so, SH: cur.sh, SF: cur.sf,
    };
    const currentBlend = blendedHrRate(line, cfg);
    corePairs.push({
      player_id: cur.player_id,
      season,
      targetSeason: season + 1,
      baseline: envHr(currentBlend, season),
      outcome: envHr(nxt.hr / nxt.ab, season + 1),
      iso: (cur.b2 + 2 * cur.b3 + 3 * cur.hr) / cur.ab,
      slg: cur.tb / cur.ab,
      extra_base_rate: (cur.b2 + cur.b3) / cur.ab,
    });
  }
}

const advancedRows = db.prepare(
  'SELECT l.proeye_id player_id, b.season, b.iso, b.slg, b.hr_fb_pct, b.offb_pct, b.iffb_pct '
  + 'FROM v_bm_bat b JOIN player_link l ON l.bm_id=b.player_id AND l.season=b.season '
  + 'WHERE b.farm=0 AND b.season BETWEEN 2020 AND 2025',
).all();
const advanced = new Map(advancedRows.map(r => [r.player_id + '|' + r.season, r]));
const advancedPairs = corePairs.map(r => {
  const a = advanced.get(r.player_id + '|' + r.season);
  return a ? {
    ...r,
    hr_fb_pct: a.hr_fb_pct,
    fb_pct: a.offb_pct != null && a.iffb_pct != null ? a.offb_pct + a.iffb_pct : null,
  } : null;
}).filter(Boolean);

const parkRows = [];
for (const r of corePairs.filter(x => x.season === 2023 || x.season === 2024)) {
  const splits = loadSplits(db, r.player_id, r.season);
  const nextSplits = loadSplits(db, r.player_id, r.targetSeason);
  const park = playerParkFactor(splits?.park, parkFactors.hr);
  const nextPark = playerParkFactor(nextSplits?.park, parkFactors.hr);
  const minCoverage = cfg.environment.park_min_coverage ?? 0.5;
  if (!park || park.coverage < minCoverage || !nextPark || nextPark.coverage < minCoverage) continue;
  parkRows.push({
    ...r,
    park_factor: park.factor,
    park_adjusted: r.baseline / park.factor,
    outcome_park_adjusted: r.outcome / nextPark.factor,
    coverage: park.coverage,
    next_coverage: nextPark.coverage,
  });
}
const parkRawRmse = parkRows.length
  ? Math.sqrt(parkRows.reduce((s, r) => s + (r.baseline - r.outcome) ** 2, 0) / parkRows.length)
  : null;
const parkAdjustedRmse = parkRows.length
  ? Math.sqrt(parkRows.reduce((s, r) => s + (r.park_adjusted - r.outcome_park_adjusted) ** 2, 0) / parkRows.length)
  : null;

const plusRows = db.prepare('SELECT * FROM npb_plus_measurement').all();
const bm2026 = db.prepare(
  'SELECT p.name_ja, b.iso, b.hrfb_dummy, b.hr_fb_pct '
  + 'FROM bm_player p JOIN (SELECT player_id, iso, hr_fb_pct, hr_fb_pct hrfb_dummy '
  + 'FROM v_bm_bat WHERE season=2026 AND farm=0) b ON b.player_id=p.player_id '
  + 'WHERE p.season=2026 AND p.farm=0',
).all();
const normalizeName = value => (value ?? '').normalize('NFKC').replace(/\s+/g, '');
const bmByName = new Map();
for (const r of bm2026) {
  const key = normalizeName(r.name_ja);
  if (!bmByName.has(key)) bmByName.set(key, []);
  bmByName.get(key).push(r);
}
const plusMatched = plusRows.map(r => {
  const hits = bmByName.get(normalizeName(r.name)) ?? [];
  return hits.length === 1 ? { ...r, iso: hits[0].iso, hr_fb_pct: hits[0].hr_fb_pct } : null;
}).filter(Boolean);
const plusMetrics = [
  'barrel_pct', 'hard_hit_pct', 'exit_velo_avg', 'exit_velo_max', 'launch_angle_avg',
];
const plusCorrelations = Object.fromEntries(plusMetrics.map(key => [key, {
  n: plusMatched.filter(r => Number.isFinite(r[key]) && Number.isFinite(r.iso)).length,
  correlation_with_iso: pearson(plusMatched, key, 'iso'),
  correlation_with_hr_fb: pearson(plusMatched, key, 'hr_fb_pct'),
  accuracy_verdict: '判定不能（2026途中の1時点のみで翌年実績がまだ無い）',
}]));

const coverage = {
  batting_non_pitchers: db.prepare(
    "SELECT COUNT(*) rows, COUNT(DISTINCT player_id) players, MIN(season) minSeason, MAX(season) maxSeason, "
    + "SUM(ab>0 AND b2 IS NOT NULL AND b3 IS NOT NULL AND hr IS NOT NULL) extraBaseParts, "
    + "SUM(ab>0 AND slg IS NOT NULL) slg FROM batting WHERE position<>'投'",
  ).get(),
  bm_bat_one_gun: db.prepare(
    'SELECT COUNT(*) rows, COUNT(DISTINCT player_id) players, MIN(season) minSeason, MAX(season) maxSeason, '
    + 'SUM(iso IS NOT NULL) iso, SUM(slg IS NOT NULL) slg, SUM(hr_fb_pct IS NOT NULL) hrFb, '
    + 'SUM(offb_pct IS NOT NULL AND iffb_pct IS NOT NULL) fbParts FROM bm_bat WHERE farm=0',
  ).get(),
  npb_plus: db.prepare(
    'SELECT COUNT(*) rows, SUM(barrel_pct IS NOT NULL) barrel, SUM(hard_hit_pct IS NOT NULL) hardHit, '
    + 'SUM(exit_velo_avg IS NOT NULL) evAvg, SUM(exit_velo_max IS NOT NULL) evMax, '
    + 'SUM(launch_angle_avg IS NOT NULL) launch FROM npb_plus_measurement',
  ).get(),
  park_split: db.prepare(
    "SELECT COUNT(*) rows, MIN(season) minSeason, MAX(season) maxSeason FROM nf3_split WHERE section='park'",
  ).get(),
  xslg_columns: 0,
};

const result = {
  _meta: {
    source_db: 'data/pennant.db',
    source_db_sha256: sourceDbSha256,
    specification: 'docs/satei_handoff/02_CURRENT_SPEC_V2.md §6.4',
    evaluation_target: '翌年の環境補正済み実本塁打率',
    eligibility: '当年・翌年ともAB>=200',
    validation: '目的年を丸ごと1年ずつ除外して学習するleave-one-target-season-out',
    coefficient_policy: '係数は各学習fold内で推定。production設定へは書かない',
    adoption_policy: '採否は決めず測定結果のみ',
    konami_values_used: false,
  },
  availability: {
    ISO: '取得可: v_batting.b2,b3,hr,abから全期間で導出。bm_bat.isoにも直接列あり',
    SLG: '取得可: batting.slg / v_batting.tb,ab',
    '2B/3B': '取得可: v_batting.b2,b3',
    'Barrel%': '限定取得可: npb_plus_measurement.barrel_pct（2026途中のみ）',
    'Hard-Hit%': '限定取得可: npb_plus_measurement.hard_hit_pct（2026途中のみ）',
    'EV/Max EV': '限定取得可: npb_plus_measurement.exit_velo_avg,exit_velo_max（2026途中のみ）',
    xSLG: '取得不可: DB全表・ビューに該当列なし',
    'HR/FB': '取得可: bm_bat.hr_fb_pct（2020-2026）',
    'FB%': '導出可: bm_bat.offb_pct + bm_bat.iffb_pct（2020-2026）',
    'Launch Angle': '限定取得可: npb_plus_measurement.launch_angle_avg（2026途中のみ）',
    'Park Factor': '導出可: nf3_split.section=park のab,hrとoutputs/derived/park_factors.json（2023-2025）',
  },
  coverage,
  next_year_prediction: {
    core_pairs: corePairs.length,
    core: {
      ISO: compareFeature(corePairs, 'iso'),
      SLG: compareFeature(corePairs, 'slg'),
      '2B/3B': compareFeature(corePairs, 'extra_base_rate'),
    },
    advanced_pairs: advancedPairs.length,
    advanced: {
      'HR/FB': compareFeature(advancedPairs, 'hr_fb_pct'),
      'FB%': compareFeature(advancedPairs, 'fb_pct'),
    },
    park_factor: {
      n: parkRows.length,
      seasons: [2023, 2024],
      unadjusted_rmse: parkRawRmse,
      adjusted_rmse: parkAdjustedRmse,
      rmse_change_pct: parkRawRmse && parkAdjustedRmse
        ? (parkAdjustedRmse / parkRawRmse - 1) * 100
        : null,
      improves: parkRawRmse != null && parkAdjustedRmse < parkRawRmse,
      correlation_with_iso: pearson(parkRows, 'park_factor', 'iso'),
      note: '既にpipelineで適用済み。未補正同士と、当年・翌年をそれぞれの球場係数で補正した値同士を比較',
    },
  },
  current_only_2026: {
    rows_in_source: plusRows.length,
    uniquely_linked_to_bm_2026: plusMatched.length,
    correlations: plusCorrelations,
  },
};

db.close();
const outDir = path.join(ROOT, 'outputs', 'derived');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'power_auxiliary_measurement.json');
await writeFile(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result.next_year_prediction, null, 2));
console.log('2026打球計測の一意リンク: ' + plusMatched.length + '/' + plusRows.length);
console.log('→ ' + path.relative(ROOT, outPath));

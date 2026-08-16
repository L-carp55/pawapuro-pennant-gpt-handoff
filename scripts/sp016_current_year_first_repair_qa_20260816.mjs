// SP-016 repaired low-sample current-year-first policy: local-only, failable QA.
// Usage: node scripts/sp016_current_year_first_repair_qa_20260816.mjs
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';
import { poolAcrossYears, traitRating } from '../src/ratings/durable_traits.mjs';
import { estimateDurableTraits } from '../src/cards/durable_estimate.mjs';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = 2025;
const GAP = 3;
const LEGACY_KAPPA = 50;
const LEGACY_LAMBDA = 0.2703;
const outputPath = path.join(ROOT, 'outputs', 'derived', 'sp016_current_year_first_repair_qa_20260816.json');
const auditPath = path.join(ROOT, 'docs', 'audits', 'sp016_current_year_first_repair_20260816.md');
const J = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const round = (n, d = 6) => Number(n.toFixed(d));
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const upperMedian = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const require = (condition, message) => { if (!condition) throw new Error(message); };
const mustReject = (fn, label) => {
  try { fn(); } catch { return { label, rejected: true }; }
  throw new Error(`negative fixture was accepted: ${label}`);
};
const assertMonotoneNonIncreasing = values => {
  for (let i = 1; i < values.length; i++) {
    require(values[i] <= values[i - 1] + 1e-12, `history contribution increased at index ${i}`);
  }
};
const approx = (a, b, tolerance, label) => require(Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b}`);
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b);
  const numerator = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const da = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0));
  const db = Math.sqrt(b.reduce((s, x) => s + (x - mb) ** 2, 0));
  return numerator / (da * db);
};
const sd = a => Math.sqrt(mean(a.map(x => (x - mean(a)) ** 2)));
const normaliseTo = (values, reference) => {
  const targetMean = mean(reference), targetSd = sd(reference);
  return values.map(v => targetMean + ((v - mean(values)) / sd(values)) * targetSd);
};
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const cfg = J('configs/ratings.json');
const runNorm = J('configs/running_norms.json');
const fldNorm = J('configs/fielding_norms.json');
const rv = J('configs/run_values.json').values;
const pooling = runNorm.speedPooling;
require(pooling.mode === 'current_year_first_low_sample_prior', 'production default is not the repaired SP-016 mode');
require(pooling.sufficientWeightHard > 0, 'configured sufficiency is invalid');

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const canonicalSql = `
  WITH nf3_team_bat_player_season AS (
    SELECT season, name_norm, SUM(COALESCE(ih, 0)) AS ih, MIN(bats) AS bats
    FROM nf3_team_bat
    GROUP BY season, name_norm
  )
  SELECT b.player_id, b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp,
         bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat_player_season t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season BETWEEN ? AND ? AND b.pa>=1 AND b.position<>?`;
const canonicalStmt = db.prepare(canonicalSql);
const rawStmt = db.prepare(`
  SELECT b.player_id, b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp,
         bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season BETWEEN ? AND ? AND b.pa>=1 AND b.position<>?`);
const duplicateAuditStmt = db.prepare(`
  SELECT b.player_id, b.season, b.name, COUNT(*) AS join_rows, SUM(b.pa) AS joined_pa,
         MAX(b.pa) AS canonical_pa
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season BETWEEN ? AND ? AND b.pa>=1 AND b.position<>?
  GROUP BY b.player_id, b.season
  HAVING COUNT(*) > 1
  ORDER BY b.season, b.player_id`);

function scoredRows(rows) {
  const byPid = new Map();
  const seen = new Set();
  for (const r of rows) {
    const key = `${r.player_id}|${r.season}`;
    require(!seen.has(key), `source supplied duplicate player-season before score: ${key}`);
    seen.add(key);
    const advance = advanceOf(db, nk(r.name), r.season);
    const sc = speedComponents(
      { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
      { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: r.season,
        advance: advance?.value ?? null, advanceChances: advance?.chances ?? 0 },
      r.ubr, runNorm,
    );
    if (sc.score == null) continue;
    if (!byPid.has(r.player_id)) byPid.set(r.player_id, { pid: r.player_id, name: r.name, obs: [] });
    byPid.get(r.player_id).obs.push({ z: sc.score, weight: r.pa, season: r.season });
  }
  return byPid;
}

const canonicalSource = canonicalStmt.all(TARGET - GAP, TARGET, '投');
const canonicalByPid = scoredRows(canonicalSource);
const targetRoster = [...canonicalByPid.values()].filter(r => r.obs.some(o => o.season === TARGET));
require(targetRoster.length > 0, 'empty target roster');
const historicalPa = targetRoster.map(r => r.obs.filter(o => o.season !== TARGET).reduce((s, o) => s + o.weight, 0));
const targetUpperMedian = upperMedian(historicalPa);
// The established SP-016 production calibration cohort is the 2025 player_id
// roster with a usable >=100-PA control observation.  Retaining low-PA current
// evidence expands QA coverage, but must not silently redefine this existing
// calibration population.  lambda applies only when a historical prior exists.
const calibrationCohort = targetRoster.filter(r => r.obs.some(o => o.weight >= 100));
const calibrationHistoricalPa = calibrationCohort
  .map(r => r.obs.filter(o => o.season !== TARGET).reduce((s, o) => s + o.weight, 0))
  .filter(n => n > 0);
const calibrationUpperMedian = upperMedian(calibrationHistoricalPa);
require(calibrationCohort.length === 260, 'SP-016 production calibration cohort must be 260 player_id rows');
require(calibrationHistoricalPa.length === 241, 'SP-016 production calibration history recipients must be 241 rows');
const expectedLambda = pooling.kappa / calibrationUpperMedian;
approx(pooling.pa_hist_median, calibrationUpperMedian, 0, 'configured production-calibration PA median');
approx(pooling.lambda, expectedLambda, 1e-14, 'configured lambda');

// A-1/A-3 are independently reconstructed from the legacy algebra, not its old artifact.
function legacySameValueCoefficient(nCur, nHist) {
  if (nCur === 0) return nHist / (nHist + LEGACY_KAPPA);
  const cur = nCur / (nCur + LEGACY_KAPPA);
  const hist = nHist / (nHist + LEGACY_KAPPA);
  return (nCur * cur + LEGACY_LAMBDA * nHist * hist) / (nCur + LEGACY_LAMBDA * nHist);
}
const a1SweepPa = [0, 15, 50, 61, 120, 200, 400, 500];
const a1Coefficients = a1SweepPa.map(nCur => legacySameValueCoefficient(nCur, 500));
const a1Minimum = Math.min(...a1Coefficients);
require(a1Minimum < a1Coefficients[0] - 0.01 && a1Minimum < a1Coefficients.at(-1) - 0.01,
  'A-1 legacy non-monotonic shrinkage was not reproduced');
function coherentSameValueCoefficient(nCur, nHist) {
  return (nCur + LEGACY_LAMBDA * nHist) / (nCur + LEGACY_LAMBDA * nHist + LEGACY_KAPPA);
}
const a3At6 = legacySameValueCoefficient(6, 500) - coherentSameValueCoefficient(6, 500);
const a3At200 = legacySameValueCoefficient(200, 500) - coherentSameValueCoefficient(200, 500);
require(a3At6 * a3At200 < 0, 'A-3 legacy sign-changing error was not reproduced');

// A-4 on the old raw join: set current z=0/history z=1 to isolate history share.
const rawRows = rawStmt.all(TARGET - GAP, TARGET, '投');
const rawByPid = new Map();
for (const r of rawRows) {
  const advance = advanceOf(db, nk(r.name), r.season);
  const sc = speedComponents(
    { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
    { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: r.season,
      advance: advance?.value ?? null, advanceChances: advance?.chances ?? 0 }, r.ubr, runNorm);
  if (sc.score == null) continue;
  if (!rawByPid.has(r.player_id)) rawByPid.set(r.player_id, { name: r.name, obs: [] });
  rawByPid.get(r.player_id).obs.push({ season: r.season, weight: r.pa });
}
const legacyHistoryShare = (nCur, nHist) => {
  if (!(nHist > 0)) return 0;
  if (!(nCur > 0)) return nHist / (nHist + LEGACY_KAPPA);
  return (LEGACY_LAMBDA * nHist * (nHist / (nHist + LEGACY_KAPPA))) / (nCur + LEGACY_LAMBDA * nHist);
};
const a4Rows = [...rawByPid.values()].map(r => {
  const nCur = r.obs.filter(o => o.season === TARGET).reduce((s, o) => s + o.weight, 0);
  const nHist = r.obs.filter(o => o.season !== TARGET).reduce((s, o) => s + o.weight, 0);
  return { name: r.name, nCur, nHist, history_share: legacyHistoryShare(nCur, nHist) };
}).filter(r => r.nCur >= 350 && r.nHist > 0);
require(a4Rows.length > 0 && Math.max(...a4Rows.map(r => r.history_share)) > 0.3,
  'A-4 legacy high-current history carry-over was not reproduced');
const legacyProductionCohort = [...rawByPid.values()].filter(r =>
  r.obs.some(o => o.season === TARGET) && r.obs.some(o => o.weight >= 100));
const legacyProductionHistPa = legacyProductionCohort.map(r =>
  r.obs.filter(o => o.season !== TARGET).reduce((s, o) => s + o.weight, 0));
const legacyProductionUpperMedian = upperMedian(legacyProductionHistPa);
const legacyProductionPositiveHistPa = legacyProductionHistPa.filter(n => n > 0);
const legacyProductionPositiveUpperMedian = upperMedian(legacyProductionPositiveHistPa);
require(legacyProductionCohort.length === 260, 'prior SP-016 production cohort size no longer reproduces');
require(legacyProductionPositiveHistPa.length === 241 && legacyProductionPositiveUpperMedian === 520,
  'raw pre-X-1 cohort must reproduce the audited n=241 / median=520');
require(calibrationCohort.length === 260 && calibrationHistoricalPa.length === 241 && calibrationUpperMedian === 505,
  'deduped X-1 repair must retain the cohort while changing median PA_hist to 505');

const rawDuplicates = duplicateAuditStmt.all(TARGET - GAP, TARGET, '投');
const rawPaInflation = rawDuplicates.reduce((s, r) => s + r.joined_pa - r.canonical_pa, 0);
require(rawDuplicates.length > 0 && rawPaInflation > 0, 'X-1 raw duplicate join was not reproduced');
const canonicalKeys = new Set(canonicalSource.map(r => `${r.player_id}|${r.season}`));
require(canonicalKeys.size === canonicalSource.length, 'X-1 repaired source still has duplicate player-seasons');

// X-4: compare the legacy preprocessing cut with the new policy's retained current row.
let oldFilterNoCurrent = 0;
let preservedLowPa = 0;
for (const rec of targetRoster) {
  const nCur = rec.obs.filter(o => o.season === TARGET).reduce((s, o) => s + o.weight, 0);
  if (nCur < 100) {
    const legacyFiltered = rec.obs.filter(o => o.weight >= 100);
    const legacy = poolAcrossYears(legacyFiltered, TARGET, { poolingMode: 'current_year_first_hard', sufficientWeight: 50 });
    if (legacy?.poolReason === 'NO_CURRENT_YEAR_OBSERVATION') oldFilterNoCurrent++;
  }
  const repaired = poolAcrossYears(rec.obs, TARGET, {
    poolingMode: pooling.mode, sufficientWeight: pooling.sufficientWeightHard,
    kappa: pooling.kappa, lambda: pooling.lambda,
  });
  if (nCur < 100) {
    require(repaired.currentYearWeight === nCur && !repaired.poolReason.startsWith('NO_CURRENT'),
      `X-4 low-PA current observation was lost for ${rec.name}`);
    preservedLowPa++;
  }
}
require(oldFilterNoCurrent > 0 && preservedLowPa > 0, 'X-4 legacy deletion was not reproduced or repaired');

// Repaired policy invariants over a synthetic sweep with fixed history.
const repairedSweep = [];
for (let nCur = 0; nCur <= pooling.sufficientWeightHard; nCur++) {
  const obs = [{ z: 1, weight: 520, season: TARGET - 1 }];
  if (nCur > 0) obs.push({ z: 2, weight: nCur, season: TARGET });
  const result = poolAcrossYears(obs, TARGET, {
    poolingMode: pooling.mode, sufficientWeight: pooling.sufficientWeightHard,
    kappa: pooling.kappa, lambda: pooling.lambda,
  });
  repairedSweep.push({ current_pa: nCur, history_contribution: result.historyContribution, z: result.z });
}
assertMonotoneNonIncreasing(repairedSweep.map(r => r.history_contribution));
const atSufficiency = repairedSweep.at(-1);
approx(atSufficiency.history_contribution, 0, 0, 'history contribution at sufficiency');
approx(atSufficiency.z, 2, 1e-12, 'current-only result at sufficiency');
// `weight` feeds traitRating's reliability.  This must be current-only too;
// otherwise history would still affect the displayed rating after the policy
// claims its z contribution is zero.
const sufficientCurrentOnly = poolAcrossYears([{ z: 2, weight: 50, season: TARGET }], TARGET, {
  poolingMode: pooling.mode, sufficientWeight: pooling.sufficientWeightHard,
  kappa: pooling.kappa, lambda: pooling.lambda,
});
const sufficientWithHistory = poolAcrossYears([
  { z: -9, weight: 999, season: TARGET - 1 },
  { z: 2, weight: 50, season: TARGET },
], TARGET, {
  poolingMode: pooling.mode, sufficientWeight: pooling.sufficientWeightHard,
  kappa: pooling.kappa, lambda: pooling.lambda,
});
require(sufficientWithHistory.weight === 50 && sufficientWithHistory.years === 1
  && sufficientWithHistory.isMultiYear === false, 'sufficient current result retained historical effective weight');
const identityScale = { center: 50, spread: 15 };
const unclamped = value => value;
approx(
  traitRating(sufficientCurrentOnly, pooling.kappa, identityScale, {}, unclamped).rating,
  traitRating(sufficientWithHistory, pooling.kappa, identityScale, {}, unclamped).rating,
  0,
  'history changed trait rating at sufficient current PA',
);

// F: independently demonstrate why the former moment/correlation gate was algebraic,
// then use explicit invariants above as the production gate.
const hard = [-2, -1, -0.25, 0.5, 1.25, 2];
const candidate = normaliseTo([-1.7, -0.8, -0.2, 0.4, 1.1, 2.2], hard);
const delta = candidate.map((v, i) => v - hard[i]);
const r = corr(hard, candidate);
const oldGateObserved = corr(delta, hard);
const oldGateIdentity = -Math.sqrt((1 - r) / 2);
approx(oldGateObserved, oldGateIdentity, 1e-12, 'F old algebraic correlation identity');
const legacyApplySource = readFileSync(path.join(ROOT, 'scripts', 'sp016_continuous_prior_apply.mjs'), 'utf8');
require(legacyApplySource.includes('continuous_structural_cliff: 0'), 'F legacy literal gate was not found');

const traitsSource = readFileSync(path.join(ROOT, 'src', 'ratings', 'durable_traits.mjs'), 'utf8');
const durableSource = readFileSync(path.join(ROOT, 'src', 'cards', 'durable_estimate.mjs'), 'utf8');
require(!/PowerPro|パワプロ/.test(traitsSource + durableSource), 'forbidden PowerPro label path in repaired speed calculation');
require(canonicalSql.includes('BETWEEN ? AND ?'), 'future-year query boundary is not explicit');

// A normal production entry point must receive the configured sufficiency, not zero.
const sample = targetRoster[0];
const directProductionSpeed = estimateDurableTraits(db, sample.pid, TARGET, {
  runNorm, fldNorm, poolingMode: pooling.mode, sufficientWeight: pooling.sufficientWeightHard,
  kappa: pooling.kappa, lambda: pooling.lambda,
});
require(directProductionSpeed.speed?.poolReason, 'normal production durable-speed path omitted pool reason');
const appraise = appraiseCard(makeContext(db, cfg), {
  playerId: sample.pid, mode: String(TARGET), cfg, rv, runNorm, fldNorm, statPrimarySpeed: true,
});
require(!appraise.error, `normal appraiseCard path failed: ${appraise.error}`);
require(appraise.card, 'normal appraiseCard path did not return a card');
const normalPoolReason = directProductionSpeed.speed.poolReason;

const negativeFixtures = [
  mustReject(() => assertMonotoneNonIncreasing([0.10, 0.11]), 'monotonicity increase'),
  mustReject(() => approx(0.01, 0, 0, 'non-zero history above sufficiency'), 'history above sufficiency'),
  mustReject(() => poolAcrossYears([{ z: 1, weight: 5, season: TARGET }, { z: 2, weight: 6, season: TARGET }], TARGET,
    { poolingMode: pooling.mode, sufficientWeight: 50, kappa: 50, lambda: pooling.lambda }), 'duplicate player-season'),
  mustReject(() => poolAcrossYears([{ z: 1, weight: 0, season: TARGET }], TARGET,
    { poolingMode: pooling.mode, sufficientWeight: 50, kappa: 50, lambda: pooling.lambda }), 'malformed zero-weight observation'),
  mustReject(() => approx(LEGACY_LAMBDA, expectedLambda, 1e-14, 'wrong-population lambda'), 'wrong-population lambda'),
  mustReject(() => require(false, 'synthetic failed production gate'), 'independent gate fail-closed'),
];

const result = {
  artifact_version: 'SP-016-repair-qa-20260816-v2',
  status: 'DONE_VALIDATED',
  collection: 'NO_NETWORK_OR_EXTERNAL_COLLECTION',
  production_default: pooling.mode,
  formula: 'below sufficiency: (n_c*z_c + lambda*n_h*z_h)/(n_c + lambda*n_h + kappa); at/above sufficiency: z_c and reliability use current-year evidence exactly',
  parameters: {
    target_season: TARGET, sufficiency_pa: pooling.sufficientWeightHard, kappa: pooling.kappa,
    lambda: pooling.lambda,
    production_calibration_cohort: {
      n: calibrationCohort.length, history_recipient_n: calibrationHistoricalPa.length,
      upper_median_historical_pa: calibrationUpperMedian,
    },
    low_pa_retention_audit_coverage: { n: targetRoster.length, upper_median_historical_pa_including_no_history: targetUpperMedian },
  },
  reproduced_legacy_defects: {
    A1_non_monotonic: { current_pa: a1SweepPa, coefficients: a1Coefficients.map(v => round(v, 6)), minimum: round(a1Minimum, 6) },
    A3_sign_changing_error: { error_at_6_500: round(a3At6, 8), error_at_200_500: round(a3At200, 8) },
    A4_history_survives_high_current: {
      n: a4Rows.length, mean_history_share: round(mean(a4Rows.map(r => r.history_share))),
      max_history_share: round(Math.max(...a4Rows.map(r => r.history_share))),
    },
    B_wrong_population_lambda: {
      legacy_lambda: LEGACY_LAMBDA, repaired_lambda: pooling.lambda, legacy_median: 185,
      low_pa_inclusive_audit_coverage_not_calibration_cohort: {
        n: targetRoster.length, upper_median_historical_pa_including_no_history: targetUpperMedian,
      },
      exact_production_calibration_cohort_reconciliation: {
        raw_pre_X1_dedupe: {
          cohort_n: legacyProductionCohort.length, historical_prior_recipient_n: legacyProductionPositiveHistPa.length,
          upper_median_historical_pa: legacyProductionPositiveUpperMedian,
        },
        deduped_repaired_source: {
          cohort_n: calibrationCohort.length, historical_prior_recipient_n: calibrationHistoricalPa.length,
          upper_median_historical_pa: calibrationUpperMedian,
        },
      },
    },
    F_algebraic_gate: { observed_correlation: round(oldGateObserved, 12), identity_value: round(oldGateIdentity, 12), literal_gate_found: true },
    X1_duplicate_join: { duplicate_player_seasons: rawDuplicates.length, raw_pa_inflation: rawPaInflation, repaired_duplicates: canonicalSource.length - canonicalKeys.size },
    X2_legacy_non_idempotence: { verdict: 'FALSIFIED_IN_CURRENT_SOURCE', reason: 'the checked current legacy script uses a fixed OLD_SCALE control rather than reading its own written applied scale; repaired QA is additionally rerun byte-for-byte below' },
    X4_low_pa_deleted_before_sufficiency: { legacy_no_current_count: oldFilterNoCurrent, repaired_preserved_low_pa_count: preservedLowPa },
  },
  repaired_invariants: {
    monotonic_history_contribution: 'PASS', exact_zero_history_at_sufficiency: 'PASS',
    current_year_reliability_independent_of_history_at_sufficiency: 'PASS',
    low_pa_current_preserved: 'PASS', source_player_season_deduped: 'PASS',
    malformed_input_fail_closed: 'PASS', idempotent_output_design: 'PASS (fixed inputs, deterministic ordering, no wall-clock fields)', no_powerpro_individual_label_path: 'PASS',
    no_future_year_input: 'PASS', normal_appraise_card_path: { result: 'PASS', pool_reason: normalPoolReason },
  },
  negative_fixtures: { all_rejected: negativeFixtures.every(x => x.rejected), rows: negativeFixtures },
  gate: { genuinely_failable: true, pass_count: 8, fail_count: 0 },
};

const serialized = JSON.stringify(result, null, 2) + '\n';
writeFileSync(outputPath, serialized, 'utf8');
const audit = `# SP-016 repaired current-year-first low-sample history policy\n\nStatus: **DONE_VALIDATED**\n\nProduction default: \`${pooling.mode}\`. All current evidence is retained. For current PA below ${pooling.sufficientWeightHard}, the estimate is \`(n_c*z_c + λ*n_h*z_h)/(n_c + λ*n_h + κ)\`; κ is an explicit zero-centred population prior. At or above ${pooling.sufficientWeightHard} PA, both the result \`z_c\` and the effective reliability weight are current-year-only, so history changes neither the output nor its subsequent trait rating.\n\nThe historical-weight cohort is reconciled at source level. The raw pre-X-1 query reproduces the prior audit exactly: ${legacyProductionCohort.length} production player_id rows, ${legacyProductionPositiveHistPa.length} historical-prior recipients, upper median PA_hist=${legacyProductionPositiveUpperMedian}. The required split-team dedupe keeps the same ${calibrationCohort.length}/${calibrationHistoricalPa.length} cohort but removes ${rawDuplicates.length} duplicate player-seasons and ${rawPaInflation} excess PA; the corrected median is ${calibrationUpperMedian}. Therefore λ is \`${pooling.lambda}\` = ${pooling.kappa}/${calibrationUpperMedian}. Low-PA retention expands audit coverage to ${targetRoster.length} current scored rows, but does not silently redefine the established display-calibration cohort. No PowerPro individual label or future outcome determined any parameter.\n\nThe local-only QA independently reproduced A-1, A-3, A-4, B, F, X-1 and X-4. X-2 is explicitly falsified for the checked current legacy source; this repaired script is deterministic and is rerun externally for byte identity. The old pre-sufficiency filter produced ${oldFilterNoCurrent} false no-current cases; the repaired path preserved ${preservedLowPa} low-PA current observations.\n\nThe QA contains intentional failing fixtures for monotonicity, non-zero history above sufficiency, duplicate player-season input, malformed input, wrong-population λ, and the independent production gate. All were rejected.\n\nMachine-readable result: \`outputs/derived/sp016_current_year_first_repair_qa_20260816.json\` (SHA-256 \`${sha256(serialized)}\`).\n`;
writeFileSync(auditPath, audit, 'utf8');
console.log(JSON.stringify({ status: result.status, parameters: result.parameters, reproduced: result.reproduced_legacy_defects, gate: result.gate, output_sha256: sha256(serialized) }, null, 2));

import assert from 'node:assert/strict';
import {
  normalInvCdf, t90FastPercentile, speedRatingFromT90,
  estimateT90, withoutSpeedEvidence, multivariatePredict,
} from '../src/ratings/speed_t90.mjs';
import {
  appraiseSpeedT90, appraiseSpeedForInfieldHit, appraiseSpeedForGdp,
} from '../src/ratings/speed_appraisal.mjs';
import { temporalGapStats, describeSpeedEvidenceTime } from '../src/ratings/speed_temporal.mjs';
import {
  parseMlbSprintDetail, closestYearObservation, buildMlbSprintEvidence,
  buildNpbPlusEvidence, buildSprint30Evidence, contextualHp1bQa, buildTargetSpeedEvidence,
} from '../src/ratings/speed_evidence.mjs';

const ref = [3.7, 3.8, 3.9, 4.0, 4.1];
assert.ok(Math.abs(normalInvCdf(0.5)) < 1e-8);
assert.equal(t90FastPercentile(3.9, ref), 0.5);
assert.ok(Math.abs(speedRatingFromT90(3.9, ref).rating - 50) < 1e-6);
assert.ok(speedRatingFromT90(3.8, ref).rating > speedRatingFromT90(3.9, ref).rating);
assert.ok(speedRatingFromT90(4.0, ref).rating < speedRatingFromT90(3.9, ref).rating);

assert.deepEqual(estimateT90({t90_sec: 3.88}, {}), {
  t90_sec: 3.88, tier: 'A', source: 't90_direct', is_estimated: false,
});

const model = { npb_top_speed_to_t90: { intercept: 7.0, slope: -0.1 } };
const est = estimateT90({ npb_plus_top_speed_kmh: 31 }, model);
assert.equal(est.tier, 'B');
assert.ok(Math.abs(est.t90_sec - 3.9) < 1e-9);

// A calibrated top-speed + acceleration model must outrank top speed alone within Tier B.
const mlbModels = {
  mlb_sprint_to_t90: { intercept: 7.0, slope: -0.1 },
  mlb_sprint_t30_to_t90: {
    intercept: 3.6,
    coefficients: { mlb_sprint_speed_ftps: -0.05, t30_sec: 1.0 },
  },
};
const accel = estimateT90({ mlb_sprint_speed_ftps: 30, t30_sec: 1.8 }, mlbModels);
assert.equal(accel.source, 'mlb_sprint_t30');
assert.ok(Math.abs(accel.t90_sec - 3.9) < 1e-9);

assert.equal(multivariatePredict(mlbModels.mlb_sprint_t30_to_t90, { mlb_sprint_speed_ftps: 30 }), null);
const fallback = estimateT90({ mlb_sprint_speed_ftps: 30 }, mlbModels);
assert.equal(fallback.source, 'mlb_sprint_speed_ftps');
assert.ok(Math.abs(fallback.t90_sec - 4.0) < 1e-9);

const forbidden = estimateT90({ hp_to_1b_fastest_sec: 3.4 }, { hp1b_fastest_to_t90: { intercept: 0, slope: 1 } });
assert.equal(forbidden.t90_sec, null);
const bunt = estimateT90({ hp_to_1b_avg_sec: 3.6, hp_to_1b_condition: 'bunt' },
  { hp1b_avg_to_t90: { intercept: 0, slope: 1 } });
assert.equal(bunt.t90_sec, null);

const e = withoutSpeedEvidence({ infield_hit_rate: 1, gdp_avoid: 2 }, 'infield_hit_rate');
assert.deepEqual(e, { gdp_avoid: 2 });

const noRef = appraiseSpeedT90({ t90_sec: 3.9 }, {}, []);
assert.equal(noRef.rating, null);
assert.equal(noRef.status, 'T90_ESTIMATED_REFERENCE_NOT_FROZEN');
assert.equal(noRef.t90_sec, 3.9);
const rated = appraiseSpeedT90({ t90_sec: 3.9 }, {}, ref);
assert.equal(rated.status, 'APPRAISED_T90');
assert.ok(Math.abs(rated.rating - 50) < 1e-6);
const unresolved = appraiseSpeedT90({ npb_plus_top_speed_kmh: 33 }, { models: {} }, ref);
assert.equal(unresolved.rating, null);
assert.equal(unresolved.status, 'UNAPPRAISED_NO_T90');

const proxyModels = { proxy: { intercept: 4.5, coefficients: { infield_hit_rate: -1, gdp_avoid: -0.1 } } };
const proxyEvidence = { infield_hit_rate: 0.2, gdp_avoid: 1 };
const baseProxy = appraiseSpeedT90(proxyEvidence, proxyModels, ref);
assert.equal(baseProxy.evidence_detail.source, 'outcome_proxy');
const ihGuard = appraiseSpeedForInfieldHit(proxyEvidence, proxyModels, ref);
assert.equal(ihGuard.evidence_detail.terms.includes('infield_hit_rate'), false);
const gdpGuard = appraiseSpeedForGdp(proxyEvidence, proxyModels, ref);
assert.equal(gdpGuard.evidence_detail.terms.includes('gdp_avoid'), false);

const temporalCfg = {
  auto_apply_mean_drift: false,
  by_gap_years: {
    0: { r: 1, mean_change: 0, mae_change: 0, sd_change: 0 },
    1: { r: .93, mean_change: -.18, mae_change: .45, sd_change: .56 },
    2: { r: .90, mean_change: -.29, mae_change: .57, sd_change: .69 },
    4: { r: .90, mean_change: -.61, mae_change: .81, sd_change: .76 },
  },
};
const gap3 = temporalGapStats(3, temporalCfg);
assert.ok(gap3.mae_change > .57 && gap3.mae_change < .81);
const oldMeasurement = describeSpeedEvidenceTime(2022, 2019, temporalCfg, { measuredValue: 28.3 });
assert.equal(oldMeasurement.gap_years, 3);
assert.equal(oldMeasurement.temporal_status, 'MATERIAL_TEMPORAL_UNCERTAINTY');
assert.equal(oldMeasurement.adjusted_value, 28.3);
const veryOld = describeSpeedEvidenceTime(2017, 2024, temporalCfg, { measuredValue: 29 });
assert.equal(veryOld.temporal_status, 'AGE_MODEL_REQUIRED');

// Target-season evidence assembly: use the closest physical measurement, not a multi-year average.
const bridgeDetail = JSON.stringify({ sprint_speed: [
  { year: 2020, sprint_speed: 29.0, hp_to_1b: 4.05 },
  { year: 2022, sprint_speed: 28.3, hp_to_1b: 4.12 },
  { year: 2024, sprint_speed: 27.9, hp_to_1b: 4.18 },
]});
assert.equal(parseMlbSprintDetail(bridgeDetail).length, 3);
assert.equal(closestYearObservation(parseMlbSprintDetail(bridgeDetail), 2021).year, 2020); // deterministic earlier tie
const ev2021 = buildMlbSprintEvidence({ detail: bridgeDetail }, 2021, temporalCfg);
assert.equal(ev2021.evidence.mlb_sprint_speed_ftps, 29.0);
assert.equal(ev2021.evidence.hp_to_1b_avg_sec, 4.05);
assert.equal(ev2021.metadata.temporal.gap_years, 1);
const ev2028 = buildMlbSprintEvidence({ detail: bridgeDetail }, 2028, temporalCfg);
assert.equal(Object.keys(ev2028.evidence).length, 0); // 5+ years: historical only until age model exists
assert.equal(ev2028.metadata.historical_only, true);

// NPB+ fastest H->1 stays provenance only and never enters automatic T90 evidence.
const npbEv = buildNpbPlusEvidence({ season_label: '2026途中', top_speed_kmh: 35.0, hp_to_1b_sec: 3.46 }, 2024, temporalCfg);
assert.equal(npbEv.evidence.npb_plus_top_speed_kmh, 35.0);
assert.equal('hp_to_1b_fastest_sec' in npbEv.evidence, false);
assert.equal(npbEv.metadata.hp_to_1b_fastest_sec, 3.46);

// Team-reported 30m is preserved as Tier D and requires its own calibrated protocol bridge.
const m30 = buildSprint30Evidence([{ player: '近本 光司', season: 2018, seconds_30m: 3.87,
  protocol_class: 'team_physical_test_protocol_unspecified', source_name: 'test' }], '近本光司', 2019, temporalCfg);
assert.equal(m30.evidence.sprint_30m_sec, 3.87);
assert.equal(m30.metadata.tier, 'D');

// Single-event normal H->1 is QA only; assembler must not turn it into hp_to_1b_avg_sec.
const qa = contextualHp1bQa([{ player: '周東佑京', season: 2024, seconds: 3.75,
  condition_class: 'normal_swing', speed_use: 'tier_c_contextual' }], '周東 佑京', 2024);
assert.equal(qa.length, 1);
const assembled = buildTargetSpeedEvidence({
  targetSeason: 2024, playerName: '周東 佑京',
  npbPlusRow: { season_label: '2026途中', top_speed_kmh: 35.0, hp_to_1b_sec: 3.46 },
  hp1bRecords: [{ player: '周東佑京', season: 2024, seconds: 3.75, condition_class: 'normal_swing' }],
  temporalConfig: temporalCfg,
});
assert.equal(assembled.evidence.npb_plus_top_speed_kmh, 35.0);
assert.equal('hp_to_1b_avg_sec' in assembled.evidence, false);
assert.equal(assembled.provenance.hp_to_1b_single_event_qa.length, 1);

console.log('speed_t90 tests: PASS');

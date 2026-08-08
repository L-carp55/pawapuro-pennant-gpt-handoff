import assert from 'node:assert/strict';
import {
  normalInvCdf, t90FastPercentile, speedRatingFromT90,
  estimateT90, withoutSpeedEvidence, multivariatePredict,
} from '../src/ratings/speed_t90.mjs';

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

// If one required feature is missing, the multivariate equation must not silently degrade;
// fallback to the separately calibrated one-variable model instead.
assert.equal(multivariatePredict(mlbModels.mlb_sprint_t30_to_t90, { mlb_sprint_speed_ftps: 30 }), null);
const fallback = estimateT90({ mlb_sprint_speed_ftps: 30 }, mlbModels);
assert.equal(fallback.source, 'mlb_sprint_speed_ftps');
assert.ok(Math.abs(fallback.t90_sec - 4.0) < 1e-9);

// Fastest H->1 must never become a speed anchor.
const forbidden = estimateT90({ hp_to_1b_fastest_sec: 3.4 }, { hp1b_fastest_to_t90: { intercept: 0, slope: 1 } });
assert.equal(forbidden.t90_sec, null);

// Bunt-contaminated average time is also rejected.
const bunt = estimateT90({ hp_to_1b_avg_sec: 3.6, hp_to_1b_condition: 'bunt' },
  { hp1b_avg_to_t90: { intercept: 0, slope: 1 } });
assert.equal(bunt.t90_sec, null);

const e = withoutSpeedEvidence({ infield_hit_rate: 1, gdp_avoid: 2 }, 'infield_hit_rate');
assert.deepEqual(e, { gdp_avoid: 2 });

console.log('speed_t90 tests: PASS');

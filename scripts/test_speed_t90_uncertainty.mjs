import assert from 'node:assert/strict';
import {
  describeT90Uncertainty,
  v3RatingMaeFloor,
  ratingSensitivityAtMaeFloor,
} from '../src/ratings/speed_t90_uncertainty.mjs';

const cfg = {
  v3_evaluation_scale: { rating_points_per_sec: 88.39285714285714, production_final_scale: false },
  source_floors: {
    mlb_sprint_t30: {
      mae_floor_sec: 0.021111541769587728,
      unquantified_components: ['measurement_noise'],
    },
    mlb_sprint_speed_ftps: {
      mae_floor_sec: 0.04463374331109772,
      unquantified_components: ['acceleration_profile', 'measurement_noise'],
    },
    npb_plus_sprint_speed_kmh: {
      mae_floor_sec: null,
      status: 'NPB_BRIDGE_UNCALIBRATED',
      mlb_reference_sprint_only_loyo_mae_sec: 0.04463374331109772,
      reference_value_is_not_npb_error_floor: true,
      unquantified_components: ['npb_plus_vs_mlb_metric_definition_bridge', 'acceleration_profile'],
    },
    sprint_50m_sec: { mae_floor_sec: null, unquantified_components: ['timing_protocol'] },
  },
};

// Full-MLB Sprint-only model now has a validated multi-year LOYO MAE floor.
const mlb = describeT90Uncertainty({ source: 'mlb_sprint_speed_ftps', t90_sec: 3.826618 }, cfg);
assert.equal(mlb.status, 'PARTIALLY_QUANTIFIED');
assert.ok(Math.abs(mlb.mae_floor_sec - 0.044634) < 1e-6);
assert.equal(mlb.full_uncertainty_quantified, false);
assert.ok(mlb.unquantified_components.includes('acceleration_profile'));

const v3Mlb = v3RatingMaeFloor(mlb, cfg);
assert.ok(Math.abs(v3Mlb.rating_mae_floor_points - 3.945327) < 5e-5);
assert.equal(v3Mlb.confidence_interval, false);
assert.equal(v3Mlb.production_final_scale, false);

// Adding T30 materially reduces the validated MLB error floor.
const withT30 = describeT90Uncertainty({ source: 'mlb_sprint_t30', t90_sec: 3.9 }, cfg);
assert.ok(Math.abs(withT30.mae_floor_sec - 0.021112) < 1e-6);
assert.ok(withT30.mae_floor_sec < mlb.mae_floor_sec);

// Crucial boundary: MLB error must NOT be presented as an NPB+ numeric floor while metric/bridge
// equivalence is uncalibrated.
const npb = describeT90Uncertainty({ source: 'npb_plus_sprint_speed_kmh', t90_sec: 3.9 }, cfg);
assert.equal(npb.status, 'UNQUANTIFIED');
assert.equal(npb.mae_floor_sec, null);
assert.equal(npb.full_uncertainty_quantified, false);
assert.ok(npb.unquantified_components.includes('npb_plus_vs_mlb_metric_definition_bridge'));
assert.equal(v3RatingMaeFloor(npb, cfg), null);

const prior = describeT90Uncertainty({ source: 'sprint_50m_sec', t90_sec: 4.0 }, cfg);
assert.equal(prior.status, 'UNQUANTIFIED');
assert.equal(prior.mae_floor_sec, null);

const missing = describeT90Uncertainty({}, cfg);
assert.equal(missing.status, 'UNQUANTIFIED_NO_T90_SOURCE');

const sensitivity = ratingSensitivityAtMaeFloor(
  { t90_sec: 4.0 },
  { mae_floor_sec: 0.04 },
  t => 100 - 50 * (t - 3.5),
);
assert.equal(sensitivity.status, 'SENSITIVITY_NOT_CONFIDENCE_INTERVAL');
assert.equal(sensitivity.center_rating, 75);
assert.equal(sensitivity.rating_if_faster_by_mae, 77);
assert.equal(sensitivity.rating_if_slower_by_mae, 73);

console.log('speed_t90_uncertainty tests: PASS');

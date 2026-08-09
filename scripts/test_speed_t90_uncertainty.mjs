import assert from 'node:assert/strict';
import {
  describeT90Uncertainty,
  v3RatingMaeFloor,
  ratingSensitivityAtMaeFloor,
} from '../src/ratings/speed_t90_uncertainty.mjs';

const cfg = {
  v3_evaluation_scale: { rating_points_per_sec: 88.39285714285714, production_final_scale: false },
  source_floors: {
    mlb_sprint_t30: { mae_floor_sec: 0.0212, unquantified_components: ['multi_year_generalization'] },
    mlb_sprint_speed_ftps: { mae_floor_sec: 0.0387, unquantified_components: ['acceleration_profile'] },
    npb_plus_top_speed_kmh: {
      mae_floor_sec: 0.0387,
      floor_transfer_only: true,
      unquantified_components: ['npb_plus_vs_mlb_metric_definition_bridge', 'acceleration_profile'],
    },
    sprint_50m_sec: { mae_floor_sec: null, unquantified_components: ['timing_protocol'] },
  },
};

const top = describeT90Uncertainty({ source: 'npb_plus_top_speed_kmh', t90_sec: 3.826618 }, cfg);
assert.equal(top.status, 'PARTIALLY_QUANTIFIED');
assert.equal(top.mae_floor_sec, 0.0387);
assert.equal(top.floor_transfer_only, true);
assert.equal(top.full_uncertainty_quantified, false);
assert.ok(top.unquantified_components.includes('acceleration_profile'));

const v3 = v3RatingMaeFloor(top, cfg);
assert.ok(Math.abs(v3.rating_mae_floor_points - 3.420804) < 1e-6);
assert.equal(v3.confidence_interval, false);
assert.equal(v3.production_final_scale, false);

const withT30 = describeT90Uncertainty({ source: 'mlb_sprint_t30', t90_sec: 3.9 }, cfg);
assert.equal(withT30.mae_floor_sec, 0.0212);
assert.ok(withT30.mae_floor_sec < top.mae_floor_sec);

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

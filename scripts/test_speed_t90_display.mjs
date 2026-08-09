import assert from 'node:assert/strict';
import { buildT90Display } from '../src/ratings/speed_t90_display.mjs';

const topOnly = buildT90Display({
  pointRating: 85.272,
  pointT90Sec: 3.826618,
  uncertainty: {
    mae_floor_sec: 0.0387,
    full_uncertainty_quantified: false,
    unquantified_components: ['npb_plus_vs_mlb_metric_definition_bridge', 'acceleration_profile'],
  },
  v3Uncertainty: { rating_mae_floor_points: 3.420804 },
});
assert.equal(topOnly.mode, 'POINT_WITH_PARTIAL_UNCERTAINTY');
assert.equal(topOnly.point_rating, 85.3);
assert.equal(topOnly.automatic_correction_applied, false);
assert.equal(topOnly.rating_range, null);

const disagree = buildT90Display({
  pointRating: 69.117,
  pointT90Sec: 4.009385,
  candidateEnvelope: {
    status: 'PROFILE_DISAGREEMENT',
    t90_low_sec: 3.915914,
    t90_high_sec: 4.009385,
    profile: 'acceleration_favored',
  },
  candidateRatingRange: {
    rating_low: 69.116862,
    rating_high: 77.379030,
    representative_rating: null,
  },
});
assert.equal(disagree.mode, 'DISAGREEMENT_RANGE');
assert.deepEqual(disagree.rating_range, [69.1, 77.4]);
assert.equal(disagree.representative_rating, null);
assert.equal(disagree.automatic_correction_applied, false);

const consistent = buildT90Display({
  pointRating: 75.399,
  pointT90Sec: 3.938309,
  candidateEnvelope: {
    status: 'CONSISTENT_EVIDENCE',
    t90_low_sec: 3.938309,
    t90_high_sec: 3.957333,
    profile: 'consistent',
  },
  candidateRatingRange: {
    rating_low: 73.717887,
    rating_high: 75.399472,
    representative_rating: 74.558680,
  },
});
assert.equal(consistent.mode, 'CORROBORATED_RANGE');
assert.deepEqual(consistent.rating_range, [73.7, 75.4]);
assert.equal(consistent.representative_rating, 74.6);

console.log('speed_t90_display tests: PASS');

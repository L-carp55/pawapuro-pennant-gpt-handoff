import assert from 'node:assert/strict';
import {
  shortDistanceEvidenceUse,
  ownerBandGap,
} from '../src/ratings/speed_profile_evidence_policy.mjs';

// Recent standardized/electronic evidence may enter numeric candidate work.
const standardized = shortDistanceEvidenceUse({
  measurement_year: 2022,
  protocol_class: 'electronic_photoelectric',
}, 2026);
assert.equal(standardized.numeric_t90_allowed, true);
assert.equal(standardized.status, 'STANDARDIZED_RECENT');

// A recent time under an unspecified TV/scouting protocol stays a hint only.
const namikiNormal = shortDistanceEvidenceUse({
  measurement_year: 2022,
  protocol_class: 'tv_50m_protocol_unspecified',
}, 2026);
assert.equal(namikiNormal.numeric_t90_allowed, false);
assert.ok(namikiNormal.blocks.includes('UNCALIBRATED_PROTOCOL'));

// A first-step-start record is explicitly incompatible with the standardized numeric path.
const namikiSpecial = shortDistanceEvidenceUse({
  measurement_year: 2019,
  protocol_class: 'special_first_step_start',
  start_rule_mismatch: true,
}, 2026);
assert.equal(namikiSpecial.numeric_t90_allowed, false);
assert.ok(namikiSpecial.blocks.includes('PROTOCOL_MISMATCH'));
assert.ok(namikiSpecial.blocks.includes('STALE_FOR_NUMERIC_T90'));

// Even a standardized protocol becomes historical-only when too far from the target season.
const staleStandardized = shortDistanceEvidenceUse({
  measurement_year: 2015,
  protocol_class: 'electronic_photoelectric',
}, 2026);
assert.equal(staleStandardized.use, 'HISTORICAL_PROFILE_HINT');
assert.ok(staleStandardized.blocks.includes('STALE_FOR_NUMERIC_T90'));

// Unknown-year scouting values can be retained but never fabricated into current T90.
const scouting = shortDistanceEvidenceUse({
  measurement_year: null,
  protocol_class: 'scouting_profile_protocol_unspecified',
}, 2026);
assert.equal(scouting.numeric_t90_allowed, false);
assert.ok(scouting.blocks.includes('UNCALIBRATED_PROTOCOL'));
assert.ok(scouting.blocks.includes('UNKNOWN_MEASUREMENT_YEAR'));

// Owner bands are QA only; helper merely measures disagreement.
const n = ownerBandGap(85.272, [90, 100]);
assert.equal(n.direction, 'model_low');
assert.ok(Math.abs(n.gap_points - 4.728) < 1e-9);
assert.equal(ownerBandGap(75.399, [60, 69]).direction, 'model_high');
assert.equal(ownerBandGap(77.2, [70, 89]).direction, 'within_band');

console.log('speed_profile_evidence_policy tests: PASS');

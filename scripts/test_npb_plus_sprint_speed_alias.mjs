import assert from 'node:assert/strict';
import { buildNpbPlusEvidence } from '../src/ratings/speed_evidence.mjs';
import { appraiseSpeedT90 } from '../src/ratings/speed_appraisal.mjs';

const row = {
  season_label: '2026',
  top_speed_kmh: 33.4, // legacy DB storage column
  hp_to_1b_sec: 4.12,
};
const built = buildNpbPlusEvidence(row, 2026, null);
assert.equal(built.evidence.npb_plus_sprint_speed_kmh, 33.4);
assert.equal(built.evidence.npb_plus_top_speed_kmh, 33.4);
assert.equal(built.metadata.metric_name, 'Sprint Speed');
assert.equal(built.metadata.public_formula_equivalent_to_mlb_statcast_verified, false);
assert.equal(built.metadata.cross_system_numeric_equivalence_assumed, false);
assert.equal(built.metadata.hp_to_1b_fastest_sec, 4.12);
assert.equal(built.metadata.fastest_hp1b_excluded_from_model, true);

const canonicalModel = {
  models: {
    npb_sprint_speed_to_t90: {
      enabled: true,
      intercept: 7,
      slope: -0.09,
    },
  },
};
const reference = [3.8, 3.9, 4.0, 4.1, 4.2];

// Canonical evidence + canonical model works through the high-level appraisal boundary.
const canonical = appraiseSpeedT90(
  { npb_plus_sprint_speed_kmh: 33.4 },
  canonicalModel,
  reference,
);
assert.equal(canonical.status, 'APPRAISED_T90');
assert.equal(canonical.source, 'npb_plus_sprint_speed_kmh');

// Legacy-only evidence is accepted and canonicalized to the same public source name.
const legacy = appraiseSpeedT90(
  { npb_plus_top_speed_kmh: 33.4 },
  canonicalModel,
  reference,
);
assert.equal(legacy.status, 'APPRAISED_T90');
assert.equal(legacy.source, 'npb_plus_sprint_speed_kmh');
assert.ok(Math.abs(legacy.t90_sec - canonical.t90_sec) < 1e-12);
assert.ok(Math.abs(legacy.rating - canonical.rating) < 1e-12);

// If both are present but disagree, canonical evidence wins.
const conflict = appraiseSpeedT90(
  { npb_plus_sprint_speed_kmh: 33.4, npb_plus_top_speed_kmh: 20.0 },
  canonicalModel,
  reference,
);
assert.ok(Math.abs(conflict.t90_sec - canonical.t90_sec) < 1e-12);

console.log('npb_plus_sprint_speed_alias tests: PASS');

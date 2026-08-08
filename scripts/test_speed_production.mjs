import assert from 'node:assert/strict';
import { resolveProductionSpeed } from '../src/ratings/speed_production.mjs';

// Clean T90 outranks everything else.
let r = resolveProductionSpeed({
  t90Appraisal: { rating: 82.34, tier: 'B', source: 'mlb_sprint_t30', t90_sec: 3.78, status: 'APPRAISED_T90' },
  existingSpeed: { value: 70, from_scouting: true },
});
assert.equal(r.status, 'T90_PRIMARY');
assert.equal(r.value, 82.3);
assert.equal(r.clean_base_speed, true);
assert.equal(r.legacy_fallback, false);

// Scouting outranks a Tier-E outcome proxy.
r = resolveProductionSpeed({
  t90Appraisal: { rating: 68, tier: 'E', source: 'outcome_proxy', t90_sec: 4.02, status: 'APPRAISED_T90' },
  existingSpeed: { value: 75, from_scouting: true },
});
assert.equal(r.status, 'SCOUTING_FALLBACK_PENDING_T90');
assert.equal(r.value, 75);

// Missing T90 keeps the current value, but it MUST be explicitly marked as legacy/provisional.
r = resolveProductionSpeed({
  t90Appraisal: { rating: null, tier: null, status: 'UNAPPRAISED_NO_T90' },
  existingSpeed: { value: 64.7 },
});
assert.equal(r.status, 'LEGACY_FALLBACK_PENDING_T90');
assert.equal(r.value, 64.7);
assert.equal(r.provisional, true);
assert.equal(r.clean_base_speed, false);
assert.equal(r.legacy_fallback, true);

// Old direct-scale measurements are not silently rebranded as T90.
r = resolveProductionSpeed({
  t90Appraisal: { rating: null, status: 'T90_ESTIMATED_REFERENCE_NOT_FROZEN', t90_sec: 3.9 },
  existingSpeed: { value: 80, from_direct_measurement: true },
});
assert.equal(r.status, 'LEGACY_FALLBACK_PENDING_T90');
assert.equal(r.source, 'legacy_direct_scale');
assert.equal(r.t90_sec, 3.9);

// Strict mode can expose a true missing value instead of falling back.
r = resolveProductionSpeed({
  t90Appraisal: { rating: null, status: 'UNAPPRAISED_NO_T90' },
  existingSpeed: { value: 60 },
  allowLegacyFallback: false,
});
assert.equal(r.status, 'UNAPPRAISED_SPEED');
assert.equal(r.value, null);

console.log('speed_production tests: PASS');

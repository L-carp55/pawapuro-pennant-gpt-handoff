import assert from 'node:assert/strict';
import { t90CandidateEnvelope, ratingRangeFromT90Envelope } from '../src/ratings/speed_acceleration_candidate.mjs';

const rating = t => Math.max(1, Math.min(100, 100 - 99 * (t - 3.66) / (4.78 - 3.66)));

const hayashi = t90CandidateEnvelope(4.009385, 3.915914, { profile_threshold_sec: 0.05 });
assert.equal(hayashi.profile, 'acceleration_favored');
assert.equal(hayashi.representative_t90_sec, null);
const hr = ratingRangeFromT90Envelope(hayashi, rating);
assert.ok(Math.abs(hr.rating_low - 69.116862) < 1e-6);
assert.ok(Math.abs(hr.rating_high - 77.379030) < 1e-6);
assert.equal(hr.representative_rating, null);

const tomosugi = t90CandidateEnvelope(3.938309, 3.957333, { profile_threshold_sec: 0.05 });
assert.equal(tomosugi.profile, 'consistent');
assert.ok(Number.isFinite(tomosugi.representative_t90_sec));
const tr = ratingRangeFromT90Envelope(tomosugi, rating);
assert.ok(Math.abs(tr.rating_low - 73.717887) < 1e-6);
assert.ok(Math.abs(tr.rating_high - 75.399472) < 1e-6);
assert.ok(Math.abs(tr.representative_rating - 74.558680) < 1e-6);

const narama = t90CandidateEnvelope(4.039846, 4.036405, { profile_threshold_sec: 0.05 });
assert.equal(narama.profile, 'consistent');
const nr = ratingRangeFromT90Envelope(narama, rating);
assert.ok(nr.rating_high - nr.rating_low < 0.31);

const single = t90CandidateEnvelope(4.05, null);
assert.equal(single.status, 'SINGLE_SOURCE_ONLY');
assert.equal(single.affects_production_rating, false);

console.log('speed_acceleration_candidate tests: PASS');

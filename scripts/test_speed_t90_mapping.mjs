import assert from 'node:assert/strict';
import {
  normalCdf, normalInvCdf, normalizeT90Reference,
  t90FastPercentile, t90WeightedQuantile,
  speedRatingFromT90, t90FromSpeedRating,
} from '../src/ratings/speed_t90.mjs';

// Normal CDF and inverse agree on the rating-relevant range.
for (const z of [-2.5, -1, 0, 1, 2.5]) {
  const p = normalCdf(z);
  assert.ok(Math.abs(normalInvCdf(p) - z) < 2e-4);
}

const ref = [3.7, 3.8, 3.9, 4.0, 4.1];
assert.equal(normalizeT90Reference(ref).length, 5);
assert.equal(t90FastPercentile(3.9, ref), 0.5);
assert.equal(t90WeightedQuantile(ref, 0.5), 3.9);
assert.ok(speedRatingFromT90(3.8, ref).rating > 50);
assert.ok(speedRatingFromT90(4.0, ref).rating < 50);

// Engine inverse: rating 50 is the median T90.
const mid = t90FromSpeedRating(50, ref);
assert.ok(Math.abs(mid.t90_sec - 3.9) < 1e-9);

// Round-trip is close where the empirical quantile is interpolated rather than clipped.
for (const rating of [35, 50, 65]) {
  const t = t90FromSpeedRating(rating, ref);
  const back = speedRatingFromT90(t.t90_sec, ref);
  assert.ok(Math.abs(back.rating - rating) < 2.0, `${rating} -> ${t.t90_sec} -> ${back.rating}`);
}

// Equal-season weighting: a shortened season with fewer players must still contribute the same total mass.
const weighted = [
  // season A: two players, total weight 1
  { t90_sec: 3.8, weight: 0.5, season: 2020 },
  { t90_sec: 4.0, weight: 0.5, season: 2020 },
  // season B: four players, total weight 1
  { t90_sec: 3.7, weight: 0.25, season: 2021 },
  { t90_sec: 3.9, weight: 0.25, season: 2021 },
  { t90_sec: 4.1, weight: 0.25, season: 2021 },
  { t90_sec: 4.2, weight: 0.25, season: 2021 },
];
const total2020 = weighted.filter(x => x.season === 2020).reduce((s,x) => s+x.weight,0);
const total2021 = weighted.filter(x => x.season === 2021).reduce((s,x) => s+x.weight,0);
assert.equal(total2020, total2021);
const q50 = t90WeightedQuantile(weighted, 0.5);
assert.ok(q50 >= 3.9 && q50 <= 4.05);

// Faster rating must map to smaller physical T90.
assert.ok(t90FromSpeedRating(80, weighted).t90_sec < t90FromSpeedRating(50, weighted).t90_sec);
assert.ok(t90FromSpeedRating(50, weighted).t90_sec < t90FromSpeedRating(20, weighted).t90_sec);

console.log('speed_t90_mapping tests: PASS');

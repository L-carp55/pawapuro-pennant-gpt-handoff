import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  standardized50Z, t90PriorFromStandardized50, comparePhysicalProfiles,
} from '../src/ratings/speed_acceleration_prior.mjs';

const cfg = JSON.parse(readFileSync(new URL('../configs/speed_acceleration_prior.json', import.meta.url), 'utf8'));

assert.ok(Math.abs(standardized50Z(cfg.standardized_50m.mean_sec, cfg)) < 1e-12);
assert.ok(Math.abs(
  t90PriorFromStandardized50(cfg.standardized_50m.mean_sec, cfg).t90_sec
  - cfg.position_player_t90_prior.mean_sec,
) < 1e-12);

// 林琢真 2022 standardized electronic 50m = 5.99s.
const hayashi = t90PriorFromStandardized50(5.99, cfg);
assert.ok(hayashi.t90_sec > 3.90 && hayashi.t90_sec < 3.93);
assert.equal(hayashi.tier, 'D');
assert.equal(hayashi.production_eligible, false);
assert.equal(comparePhysicalProfiles({
  topSpeedT90: 4.009385,
  standardized50T90: hayashi.t90_sec,
}).profile, 'acceleration_favored');

// Nearly identical physical estimates must remain consistent, not be forced into a profile label.
assert.equal(comparePhysicalProfiles({ topSpeedT90: 4.040, standardized50T90: 4.041 }).profile, 'consistent');
assert.equal(comparePhysicalProfiles({ topSpeedT90: 3.93, standardized50T90: 4.01 }).profile, 'top_speed_favored');

console.log('speed_acceleration_prior tests: PASS');

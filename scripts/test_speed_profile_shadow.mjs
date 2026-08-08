import assert from 'node:assert/strict';
import {
  standardized50mPrior,
  sameTrial90ftInterval,
  classifySpeedProfile,
  buildSpeedProfileShadow,
} from '../src/ratings/speed_profile_shadow.mjs';

const cfg = {
  standardized_50m: { mean_sec: 6.3660225454545465, sd_sec: 0.2675713712220164 },
  position_player_t90_prior: { mean_sec: 4.0575, sd_sec: 0.100750285 },
  profile_shadow: { threshold_sec: 0.05, target_distance_m: 27.432 },
};

// PowerPro-independent overlap values after adding the independent 2026 standardized cohort.
// The profile verdicts remain unchanged: Hayashi acceleration-favored; Tomosugi/Narama consistent.
const hayashi = standardized50mPrior(5.99, cfg);
assert.ok(Math.abs(hayashi.t90_prior_sec - 3.915914) < 1e-6);
assert.equal(classifySpeedProfile(hayashi.t90_prior_sec, 4.009385, 0.05).profile, 'acceleration_favored');
const tomosugi = standardized50mPrior(6.10, cfg);
assert.ok(Math.abs(tomosugi.t90_prior_sec - 3.957333) < 1e-6);
assert.equal(classifySpeedProfile(tomosugi.t90_prior_sec, 3.938309, 0.05).profile, 'consistent');
const narama = standardized50mPrior(6.31, cfg);
assert.ok(Math.abs(narama.t90_prior_sec - 4.036405) < 1e-6);
assert.equal(classifySpeedProfile(narama.t90_prior_sec, 4.039846, 0.05).profile, 'consistent');
assert.equal(classifySpeedProfile(4.12, 4.00, 0.05).profile, 'top_speed_favored');

// 2026 university-camp same-trial examples: 30m and 50m can create protocol-local 90ft bounds,
// but the output explicitly refuses to claim Statcast-T90 equivalence.
for (const x of [
  { player: '鈴木湧陽', t30: 3.85, t50: 5.78 },
  { player: '岡田啓吾', t30: 3.89, t50: 5.83 },
]) {
  const b = sameTrial90ftInterval(x.t30, x.t50);
  assert.ok(b.lower_sec < b.upper_sec, x.player);
  assert.equal(b.protocol_local_only, true);
  assert.equal(b.comparable_to_statcast_t90_without_bridge, false);
}

const shadow = buildSpeedProfileShadow({
  standardized_30m_sec: 3.85,
  standardized_50m_sec: 5.78,
  same_trial: true,
  protocol: 'photoelectric_same_trial',
  measurement_date: '2026-06-22',
  top_speed_t90_sec: 4.00,
}, cfg);
assert.equal(shadow.status, 'SHADOW_ONLY');
assert.equal(shadow.affects_speed_rating, false);
assert.ok(shadow.same_trial_90ft_interval);
assert.ok(shadow.split_30_to_50_sec > 0);

// Missing / partial evidence must stay descriptive and never fabricate a profile.
assert.equal(buildSpeedProfileShadow({ standardized_50m_sec: 6.1 }, cfg).profile_flag, 'insufficient');
assert.equal(buildSpeedProfileShadow({}, cfg).affects_speed_rating, false);

console.log('speed_profile_shadow tests: PASS');

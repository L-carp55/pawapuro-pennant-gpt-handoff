// Shadow-only acceleration / top-speed profile diagnostics for the T90 speed model.
//
// This module MUST NOT change production T90 or the 1-100 speed rating.
// It preserves standardized 30m/50m and top-speed evidence side-by-side so a later
// calibration can distinguish acceleration-favored and top-speed-favored athletes.

const finite = Number.isFinite;
const r6 = v => finite(v) ? Math.round(v * 1e6) / 1e6 : null;

/** Candidate 50m -> T90 prior from an explicitly supplied calibration config. */
export function standardized50mPrior(seconds50m, cfg = {}) {
  const ref = cfg?.standardized_50m;
  const target = cfg?.position_player_t90_prior;
  if (!finite(seconds50m) || !finite(ref?.mean_sec) || !(ref?.sd_sec > 0)
      || !finite(target?.mean_sec) || !(target?.sd_sec > 0)) return null;
  const z50 = (seconds50m - ref.mean_sec) / ref.sd_sec;
  return {
    z50: r6(z50),
    t90_prior_sec: r6(target.mean_sec + target.sd_sec * z50),
    status: 'SHADOW_PRIOR_ONLY',
    affects_speed_rating: false,
    method: 'standardized_50m_quantile_style_prior',
  };
}

/**
 * Bound elapsed time to 90 ft (27.432m) from a same-trial 30m/50m pair without
 * fitting a regression coefficient.
 *
 * Assumption: running speed is non-decreasing from 0 through 50m.
 * This produces a protocol-local interval only. It is NOT automatically equivalent
 * to MLB Statcast T90 because start/timing definitions can differ.
 */
export function sameTrial90ftInterval(seconds30m, seconds50m, opts = {}) {
  const targetM = opts.target_distance_m ?? 27.432;
  const d30 = opts.first_split_m ?? 30;
  const d50 = opts.finish_m ?? 50;
  if (!finite(seconds30m) || !finite(seconds50m) || !(seconds30m > 0)
      || !(seconds50m > seconds30m) || !(targetM > 0 && targetM < d30 && d50 > d30)) return null;

  const tail = d30 - targetM;
  // v(last target->30m) >= average v(0->30m) => tail time <= tail * T30 / 30.
  const lower = seconds30m - tail * seconds30m / d30;
  // v(last target->30m) <= average v(30->50m) under non-decreasing velocity
  // => tail time >= tail * (T50-T30)/(50-30).
  const upper = seconds30m - tail * (seconds50m - seconds30m) / (d50 - d30);
  const valid = lower <= upper + 1e-9;
  return {
    lower_sec: r6(Math.min(lower, upper)),
    upper_sec: r6(Math.max(lower, upper)),
    valid_under_assumption: valid,
    assumption: 'nondecreasing_velocity_0_to_50m',
    target_distance_m: targetM,
    protocol_local_only: true,
    comparable_to_statcast_t90_without_bridge: false,
  };
}

/** Compare the shadow 50m prior with an independently derived top-speed T90. */
export function classifySpeedProfile(t90From50mPrior, t90FromTopSpeed, thresholdSec) {
  if (!finite(t90From50mPrior) || !finite(t90FromTopSpeed)) {
    return { profile: 'insufficient', delta_sec: null, threshold_sec: finite(thresholdSec) ? thresholdSec : null };
  }
  const delta = t90From50mPrior - t90FromTopSpeed;
  if (!(finite(thresholdSec) && thresholdSec > 0)) {
    return { profile: 'uncalibrated', delta_sec: r6(delta), threshold_sec: null };
  }
  const profile = delta <= -thresholdSec ? 'acceleration_favored'
    : delta >= thresholdSec ? 'top_speed_favored'
      : 'consistent';
  return { profile, delta_sec: r6(delta), threshold_sec: thresholdSec };
}

/** Build a single provenance-friendly shadow object. */
export function buildSpeedProfileShadow(args = {}, cfg = {}) {
  const t30 = finite(args.standardized_30m_sec) ? args.standardized_30m_sec : null;
  const t50 = finite(args.standardized_50m_sec) ? args.standardized_50m_sec : null;
  const prior50 = t50 == null ? null : standardized50mPrior(t50, cfg);
  const topT90 = finite(args.top_speed_t90_sec) ? args.top_speed_t90_sec : null;
  const profile = classifySpeedProfile(
    prior50?.t90_prior_sec ?? null,
    topT90,
    cfg?.profile_shadow?.threshold_sec,
  );
  const sameTrial = t30 != null && t50 != null && args.same_trial === true
    ? sameTrial90ftInterval(t30, t50, { target_distance_m: cfg?.profile_shadow?.target_distance_m ?? 27.432 })
    : null;

  return {
    status: 'SHADOW_ONLY',
    affects_speed_rating: false,
    standardized_30m_sec: t30,
    standardized_50m_sec: t50,
    split_30_to_50_sec: t30 != null && t50 != null ? r6(t50 - t30) : null,
    same_trial: args.same_trial === true,
    protocol: args.protocol ?? null,
    measurement_date: args.measurement_date ?? null,
    t90_from_50m_prior_sec: prior50?.t90_prior_sec ?? null,
    z50: prior50?.z50 ?? null,
    top_speed_t90_sec: topT90,
    profile_flag: profile.profile,
    profile_delta_sec: profile.delta_sec,
    profile_threshold_sec: profile.threshold_sec,
    same_trial_90ft_interval: sameTrial,
    provenance: args.provenance ?? [],
    _guardrail: 'shadow evidence is descriptive only; production estimateT90/speed rating must ignore this object',
  };
}

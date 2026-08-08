// Candidate-only integration of independent top-speed and standardized short-distance evidence.
//
// Design goal: reflect acceleration evidence without inventing an unsupported mixing weight.
// This module therefore returns an evidence envelope/range, not a new production point estimate.
// Production T90/rating must not be overwritten by this output.

const finite = Number.isFinite;
const r6 = v => finite(v) ? Math.round(v * 1e6) / 1e6 : null;

export function t90CandidateEnvelope(topSpeedT90, shortDistanceT90, opts = {}) {
  const threshold = finite(opts.profile_threshold_sec) ? opts.profile_threshold_sec : 0.05;
  if (!finite(topSpeedT90) && !finite(shortDistanceT90)) {
    return {
      status: 'INSUFFICIENT',
      affects_production_rating: false,
      t90_low_sec: null,
      t90_high_sec: null,
      profile: 'insufficient',
    };
  }
  if (!finite(topSpeedT90) || !finite(shortDistanceT90)) {
    const only = finite(topSpeedT90) ? topSpeedT90 : shortDistanceT90;
    return {
      status: 'SINGLE_SOURCE_ONLY',
      affects_production_rating: false,
      t90_low_sec: r6(only),
      t90_high_sec: r6(only),
      profile: 'insufficient',
      source_available: finite(topSpeedT90) ? 'top_speed' : 'short_distance',
    };
  }

  const delta = shortDistanceT90 - topSpeedT90;
  const profile = delta <= -threshold ? 'acceleration_favored'
    : delta >= threshold ? 'top_speed_favored'
      : 'consistent';

  return {
    status: profile === 'consistent' ? 'CONSISTENT_EVIDENCE' : 'PROFILE_DISAGREEMENT',
    affects_production_rating: false,
    top_speed_t90_sec: r6(topSpeedT90),
    short_distance_t90_sec: r6(shortDistanceT90),
    delta_short_minus_top_sec: r6(delta),
    t90_low_sec: r6(Math.min(topSpeedT90, shortDistanceT90)),
    t90_high_sec: r6(Math.max(topSpeedT90, shortDistanceT90)),
    width_sec: r6(Math.abs(delta)),
    profile,
    profile_threshold_sec: threshold,
    representative_t90_sec: profile === 'consistent' ? r6((topSpeedT90 + shortDistanceT90) / 2) : null,
    representative_rule: profile === 'consistent'
      ? 'midpoint_for_QA_only_when_independent_estimates_agree_within_threshold'
      : 'no_point_estimate_when_sources_materially_disagree',
    _guardrail: 'Do not promote representative/envelope values to production until source reliabilities or a calibrated joint model are available.',
  };
}

export function ratingRangeFromT90Envelope(envelope, ratingFromT90) {
  if (!envelope || typeof ratingFromT90 !== 'function'
      || !finite(envelope.t90_low_sec) || !finite(envelope.t90_high_sec)) return null;
  // Smaller T90 => higher rating, so rating bounds reverse the T90 bounds.
  const fast = ratingFromT90(envelope.t90_low_sec);
  const slow = ratingFromT90(envelope.t90_high_sec);
  if (!finite(fast) || !finite(slow)) return null;
  const representative = finite(envelope.representative_t90_sec)
    ? ratingFromT90(envelope.representative_t90_sec) : null;
  return {
    rating_low: r6(Math.min(fast, slow)),
    rating_high: r6(Math.max(fast, slow)),
    representative_rating: finite(representative) ? r6(representative) : null,
    affects_production_rating: false,
  };
}

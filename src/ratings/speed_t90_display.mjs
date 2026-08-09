// Presentation policy for T90 speed estimates.
// Keeps point estimates, validated error floors, and candidate envelopes distinct.

const finite = Number.isFinite;
const r1 = v => finite(v) ? Math.round(v * 10) / 10 : null;

export function buildT90Display({
  pointRating = null,
  pointT90Sec = null,
  uncertainty = null,
  v3Uncertainty = null,
  candidateEnvelope = null,
  candidateRatingRange = null,
} = {}) {
  const hasEnvelope = candidateEnvelope
    && finite(candidateEnvelope.t90_low_sec)
    && finite(candidateEnvelope.t90_high_sec)
    && candidateEnvelope.status !== 'SINGLE_SOURCE_ONLY';

  if (hasEnvelope) {
    return {
      mode: candidateEnvelope.profile === 'consistent' ? 'CORROBORATED_RANGE' : 'DISAGREEMENT_RANGE',
      point_rating: r1(pointRating),
      point_t90_sec: pointT90Sec,
      rating_range: candidateRatingRange ? [
        r1(candidateRatingRange.rating_low),
        r1(candidateRatingRange.rating_high),
      ] : null,
      representative_rating: candidateEnvelope.profile === 'consistent'
        ? r1(candidateRatingRange?.representative_rating) : null,
      profile: candidateEnvelope.profile,
      automatic_correction_applied: false,
      reason: candidateEnvelope.profile === 'consistent'
        ? 'Independent physical evidence agrees; show a corroborated range and QA representative.'
        : 'Independent physical evidence materially disagrees; do not collapse to one corrected rating.',
    };
  }

  return {
    mode: finite(pointRating) ? 'POINT_WITH_PARTIAL_UNCERTAINTY' : 'UNAPPRAISED',
    point_rating: r1(pointRating),
    point_t90_sec: pointT90Sec,
    rating_range: null,
    representative_rating: null,
    profile: 'unknown_without_clean_short_distance_evidence',
    mae_floor_sec: uncertainty?.mae_floor_sec ?? null,
    v3_rating_mae_floor_points: v3Uncertainty?.rating_mae_floor_points ?? null,
    full_uncertainty_quantified: uncertainty?.full_uncertainty_quantified ?? false,
    unquantified_components: uncertainty?.unquantified_components ?? [],
    automatic_correction_applied: false,
    reason: finite(pointRating)
      ? 'Top-speed-only point estimate is retained; no safe player-specific correction exists without clean acceleration evidence.'
      : 'No numeric T90/rating available.',
    _warning: 'MAE floor is not a confidence interval and must not be rendered as ±95% or ±1σ.',
  };
}

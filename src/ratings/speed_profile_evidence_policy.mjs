// Policy for deciding how short-distance evidence may affect T90 speed appraisal.
//
// Important separation:
// - recent standardized/electronic measurements may enter candidate numeric T90 work;
// - stale or protocol-unknown measurements remain profile hints only;
// - protocol-mismatched starts (e.g. timing begins after first step) never enter numeric T90.
//
// This module does NOT infer a correction amount and does NOT use owner/Pawapuro QA bands as training targets.

const finite = Number.isFinite;

export function shortDistanceEvidenceUse(record = {}, targetSeason, opts = {}) {
  const maxNumericGapYears = finite(opts.max_numeric_gap_years)
    ? opts.max_numeric_gap_years : 4;
  const numericProtocols = new Set(opts.numeric_protocol_classes ?? [
    'electronic_photoelectric',
    'photoelectric',
    'photoelectric_same_trial',
    'electronic_photoelectric_shared_session',
  ]);

  const measuredYear = finite(record.measurement_year)
    ? record.measurement_year
    : finite(record.season) ? record.season : null;
  const gapYears = measuredYear != null && finite(targetSeason)
    ? Math.abs(targetSeason - measuredYear) : null;
  const protocol = record.protocol_class ?? 'unknown';

  if (record.start_rule_mismatch === true || protocol === 'special_first_step_start') {
    return {
      use: 'PROFILE_HINT_ONLY',
      status: 'PROTOCOL_MISMATCH',
      numeric_t90_allowed: false,
      gap_years: gapYears,
      reason: 'start/timing rule is not compatible with the standardized T90/50m path',
    };
  }

  if (!numericProtocols.has(protocol)) {
    return {
      use: 'PROFILE_HINT_ONLY',
      status: 'UNCALIBRATED_PROTOCOL',
      numeric_t90_allowed: false,
      gap_years: gapYears,
      reason: 'timing/start protocol is not standardized against the project short-distance reference',
    };
  }

  if (gapYears == null) {
    return {
      use: 'PROFILE_HINT_ONLY',
      status: 'UNKNOWN_MEASUREMENT_YEAR',
      numeric_t90_allowed: false,
      gap_years: null,
      reason: 'measurement year is unknown',
    };
  }

  if (gapYears > maxNumericGapYears) {
    return {
      use: 'HISTORICAL_PROFILE_HINT',
      status: 'STALE_FOR_NUMERIC_T90',
      numeric_t90_allowed: false,
      gap_years: gapYears,
      reason: `measurement is ${gapYears} years from target; age/trajectory model required`,
    };
  }

  return {
    use: 'NUMERIC_CANDIDATE',
    status: 'STANDARDIZED_RECENT',
    numeric_t90_allowed: true,
    gap_years: gapYears,
    reason: null,
  };
}

/** QA helper only. Owner bands are validation labels, never model inputs. */
export function ownerBandGap(rating, band) {
  if (!finite(rating) || !Array.isArray(band) || band.length !== 2
      || !finite(band[0]) || !finite(band[1])) return null;
  const [lo, hi] = band;
  if (rating < lo) return { direction: 'model_low', gap_points: lo - rating };
  if (rating > hi) return { direction: 'model_high', gap_points: rating - hi };
  return { direction: 'within_band', gap_points: 0 };
}

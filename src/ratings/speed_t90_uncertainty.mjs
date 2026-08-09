// Uncertainty descriptor for T90 appraisals.
//
// It intentionally separates:
// 1) a validated MAE floor (where one exists), and
// 2) structural components that are still unquantified.
//
// MAE is NOT a confidence interval. Never render it as ±1σ/95% without a calibrated error model.

const finite = Number.isFinite;
const r6 = v => finite(v) ? Math.round(v * 1e6) / 1e6 : null;

export function describeT90Uncertainty(t90Appraisal = {}, cfg = {}) {
  const source = t90Appraisal?.source ?? null;
  const spec = source ? cfg?.source_floors?.[source] : null;
  const mae = finite(spec?.mae_floor_sec) ? Number(spec.mae_floor_sec) : null;
  const unquantified = Array.isArray(spec?.unquantified_components)
    ? [...spec.unquantified_components] : [];

  if (!source) {
    return {
      status: 'UNQUANTIFIED_NO_T90_SOURCE',
      source: null,
      mae_floor_sec: null,
      full_uncertainty_quantified: false,
      unquantified_components: ['t90_source_missing'],
      affects_point_estimate: false,
    };
  }

  const full = mae != null && unquantified.length === 0;
  return {
    status: mae == null ? 'UNQUANTIFIED'
      : full ? 'QUANTIFIED_FLOOR_ONLY_NO_EXTRA_COMPONENTS'
        : 'PARTIALLY_QUANTIFIED',
    source,
    mae_floor_sec: r6(mae),
    floor_basis: spec?.basis ?? spec?.status ?? null,
    floor_transfer_only: spec?.floor_transfer_only === true,
    full_uncertainty_quantified: full,
    unquantified_components: unquantified,
    affects_point_estimate: false,
    _warning: mae == null
      ? 'No validated numeric error floor is available for this source.'
      : 'MAE floor is expected absolute error, not a symmetric confidence interval. Full error may be larger when unquantified components remain.',
  };
}

/** V3 evaluation-scale sensitivity only. Not valid for the future production NPB CDF. */
export function v3RatingMaeFloor(uncertainty, cfg = {}) {
  const mae = uncertainty?.mae_floor_sec;
  const slope = cfg?.v3_evaluation_scale?.rating_points_per_sec;
  if (!finite(mae) || !finite(slope)) return null;
  return {
    rating_mae_floor_points: r6(mae * slope),
    status: 'V3_EVALUATION_SENSITIVITY_ONLY',
    confidence_interval: false,
    production_final_scale: cfg?.v3_evaluation_scale?.production_final_scale === true,
  };
}

/**
 * Optional helper for a future final empirical CDF: show how much the rating changes
 * when T90 is shifted by one validated MAE floor in either direction. This is a
 * sensitivity calculation, not a confidence interval.
 */
export function ratingSensitivityAtMaeFloor(t90Appraisal, uncertainty, ratingFromT90) {
  const t90 = t90Appraisal?.t90_sec;
  const mae = uncertainty?.mae_floor_sec;
  if (!finite(t90) || !finite(mae) || typeof ratingFromT90 !== 'function') return null;
  const center = ratingFromT90(t90);
  const faster = ratingFromT90(t90 - mae);
  const slower = ratingFromT90(t90 + mae);
  if (![center, faster, slower].every(finite)) return null;
  return {
    center_rating: r6(center),
    rating_if_faster_by_mae: r6(faster),
    rating_if_slower_by_mae: r6(slower),
    status: 'SENSITIVITY_NOT_CONFIDENCE_INTERVAL',
  };
}

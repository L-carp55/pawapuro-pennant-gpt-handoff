// Temporal uncertainty for physical speed evidence.
//
// Source-quality tier and measurement-year gap are separate axes.
// A 3-year-old Sprint Speed is still a physical measurement; it does not become a scouting note.
// The gap instead widens uncertainty. Any mean drift adjustment is opt-in and config-driven.

const finite = Number.isFinite;

function interp(a, b, t) { return a + (b - a) * t; }

/** Interpolate empirical gap statistics. */
export function temporalGapStats(gapYears, config) {
  if (!finite(gapYears) || gapYears < 0 || !config?.by_gap_years) return null;
  const points = Object.entries(config.by_gap_years)
    .map(([g, v]) => ({ gap: Number(g), ...v }))
    .filter(x => finite(x.gap))
    .sort((a, b) => a.gap - b.gap);
  if (!points.length) return null;
  if (gapYears <= points[0].gap) return { ...points[0], gap_requested: gapYears };
  for (let i = 1; i < points.length; i++) {
    if (gapYears <= points[i].gap) {
      const lo = points[i - 1], hi = points[i];
      const t = (gapYears - lo.gap) / (hi.gap - lo.gap);
      const out = { gap: gapYears, gap_requested: gapYears };
      for (const k of ['r', 'mean_change', 'mae_change', 'sd_change']) {
        out[k] = finite(lo[k]) && finite(hi[k]) ? interp(lo[k], hi[k], t) : null;
      }
      return out;
    }
  }
  // Do not extrapolate empirical error beyond the measured maximum gap.
  const last = points.at(-1);
  return { ...last, gap_requested: gapYears, extrapolation_blocked: true };
}

/**
 * Describe temporal reliability without changing the evidence's physical source tier.
 * `measuredYear` can be before or after targetYear.
 */
export function describeSpeedEvidenceTime(measuredYear, targetYear, config, opts = {}) {
  if (!finite(measuredYear) || !finite(targetYear)) return {
    gap_years: null,
    temporal_status: 'UNKNOWN_YEAR',
    uncertainty: null,
    adjusted_value: null,
  };
  const signedGap = targetYear - measuredYear;
  const gap = Math.abs(signedGap);
  const stats = temporalGapStats(gap, config);
  const applyDrift = opts.applyMeanDrift === true && config?.auto_apply_mean_drift === true;
  const measuredValue = opts.measuredValue;
  let adjusted = finite(measuredValue) ? measuredValue : null;
  // Forward mean change is stored in by-gap stats. For a target earlier than the measurement,
  // reverse the sign. This is disabled by default until age dependence is modelled.
  if (applyDrift && adjusted != null && stats && finite(stats.mean_change)) {
    const direction = Math.sign(signedGap);
    adjusted += stats.mean_change * direction;
  }
  let status = 'SAME_YEAR';
  if (gap > 0 && gap <= 2) status = 'NEAR_YEAR';
  else if (gap <= 4) status = 'MATERIAL_TEMPORAL_UNCERTAINTY';
  else if (gap >= 5) status = 'AGE_MODEL_REQUIRED';
  return {
    measured_year: measuredYear,
    target_year: targetYear,
    signed_gap_years: signedGap,
    gap_years: gap,
    temporal_status: status,
    uncertainty: stats ? {
      expected_abs_change: stats.mae_change ?? null,
      sd_change: stats.sd_change ?? null,
      rank_correlation: stats.r ?? null,
      empirical_gap_used: stats.gap ?? null,
      extrapolation_blocked: stats.extrapolation_blocked ?? false,
    } : null,
    mean_drift_applied: applyDrift,
    adjusted_value: adjusted,
  };
}

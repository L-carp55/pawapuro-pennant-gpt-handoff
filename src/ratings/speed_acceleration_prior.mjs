// PowerPro-free acceleration/short-distance prior for T90.
//
// This module intentionally contains no calibration constants. All population values live in
// configs/speed_acceleration_prior.json. The standardized 50m path is Tier D / candidate-only:
// it maps a player's within-protocol 50m z-score to the same relative position in a baseball-
// specific 27.43m distribution. It does NOT convert 50m seconds directly into 27.43m seconds.

const finite = Number.isFinite;

export function standardized50Z(t50Sec, cfg) {
  if (!finite(t50Sec)) return null;
  const mean = Number(cfg?.standardized_50m?.mean_sec);
  const sd = Number(cfg?.standardized_50m?.sd_sec);
  if (!finite(mean) || !(sd > 0)) return null;
  return (t50Sec - mean) / sd;
}

export function t90PriorFromStandardized50(t50Sec, cfg) {
  const z50 = standardized50Z(t50Sec, cfg);
  if (!finite(z50)) return null;
  const mean = Number(cfg?.position_player_t90_prior?.mean_sec);
  const sd = Number(cfg?.position_player_t90_prior?.sd_sec);
  if (!finite(mean) || !(sd > 0)) return null;
  return {
    t90_sec: mean + sd * z50,
    z50,
    tier: 'D',
    source: 'standardized_50m_quantile_prior',
    is_estimated: true,
    production_eligible: cfg?.status === 'production',
  };
}

/**
 * Compare independent physical profiles without referring to PowerPro.
 * Negative diff means standardized 50m implies a faster T90 than the top-speed-only model:
 * acceleration/short-distance ability appears favorable relative to maximum-speed ability.
 */
export function comparePhysicalProfiles({ topSpeedT90 = null, standardized50T90 = null }, opts = {}) {
  if (!finite(topSpeedT90) || !finite(standardized50T90)) return null;
  const threshold = Number(opts.thresholdSec ?? 0.05);
  if (!finite(threshold) || threshold < 0) return null;
  const diff = standardized50T90 - topSpeedT90;
  const profile = diff <= -threshold ? 'acceleration_favored'
    : diff >= threshold ? 'top_speed_favored'
      : 'consistent';
  return { profile, t90_diff_sec: diff, threshold_sec: threshold };
}

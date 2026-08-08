// T90-based speed model foundation.
//
// Core definition:
//   speed = physical ability to cover a standardized 90 ft from the first running step.
//
// This module intentionally does NOT contain NPB<->MLB bridge coefficients.
// Those coefficients must be calibrated from data and supplied via `models`.
// In particular, fastest home-to-first time is NEVER accepted as a direct speed input
// because safety bunts / batting side / swing-to-run transition can move it by tenths.

const finite = v => Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Inverse standard-normal CDF (Acklam rational approximation). */
export function normalInvCdf(p) {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    return NaN;
  }
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;
  let q, r;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
      ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1-p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
      ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  q = p - 0.5;
  r = q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
    (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

/**
 * Faster-side percentile in an empirical T90 reference distribution.
 * Smaller T90 is faster. Ties use mid-rank.
 */
export function t90FastPercentile(t90Sec, referenceTimes, opts = {}) {
  if (!finite(t90Sec) || !Array.isArray(referenceTimes)) return null;
  const xs = referenceTimes.filter(finite);
  if (!xs.length) return null;
  let faster = 0, equal = 0, slower = 0;
  const eps = opts.tieEpsilon ?? 1e-9;
  for (const x of xs) {
    if (Math.abs(x - t90Sec) <= eps) equal++;
    else if (x < t90Sec) faster++;
    else slower++;
  }
  // percentile from the fast side: more players slower than target => higher percentile.
  return (slower + 0.5 * equal) / xs.length;
}

/** Convert physical T90 to the project's 1-100 speed scale via empirical CDF. */
export function speedRatingFromT90(t90Sec, referenceTimes, opts = {}) {
  const p0 = t90FastPercentile(t90Sec, referenceTimes, opts);
  if (p0 == null) return null;
  const probabilityClip = opts.probabilityClip ?? 0.0005;
  const center = opts.center ?? 50;
  const spread = opts.spread ?? 15;
  const min = opts.min ?? 1;
  const max = opts.max ?? 100;
  const p = clamp(p0, probabilityClip, 1 - probabilityClip);
  const z = normalInvCdf(p);
  return {
    rating: clamp(center + spread * z, min, max),
    percentile_fast: p0,
    z,
    t90_sec: t90Sec,
  };
}

export const SPEED_EVIDENCE_TIERS = Object.freeze({
  A: 't90_direct',
  B: 'physical_speed_direct',
  C: 'contextual_running_time',
  D: 'physical_test_prior',
  E: 'outcome_proxy',
});

/**
 * Remove a feature before estimating speed for a downstream ability that uses the same feature.
 * Example: infield-hit ability must estimate T90 with infield_hit_rate removed.
 */
export function withoutSpeedEvidence(evidence, keys) {
  const drop = new Set(Array.isArray(keys) ? keys : [keys]);
  return Object.fromEntries(Object.entries(evidence ?? {}).filter(([k]) => !drop.has(k)));
}

function linearPredict(model, x) {
  if (!model || model.enabled === false || !finite(x)) return null;
  if (!finite(model.intercept) || !finite(model.slope)) return null;
  return model.intercept + model.slope * x;
}

/**
 * Estimate T90 from the best available evidence without hard-coded bridge coefficients.
 * `models` is deliberately external/config-driven.
 *
 * Important safety rule:
 *   hp_to_1b_fastest_sec is ignored even if present. It can be safety-bunt contaminated.
 */
export function estimateT90(evidence = {}, models = {}) {
  if (finite(evidence.t90_sec)) {
    return { t90_sec: evidence.t90_sec, tier: 'A', source: 't90_direct', is_estimated: false };
  }

  const candidates = [];
  const add = (tier, source, value, detail = {}) => {
    if (finite(value)) candidates.push({ tier, source, t90_sec: value, is_estimated: true, ...detail });
  };

  // Tier B: direct physical-speed measurements.
  add('B', 'mlb_sprint_speed_ftps', linearPredict(models.mlb_sprint_to_t90, evidence.mlb_sprint_speed_ftps));
  add('B', 'npb_plus_top_speed_kmh', linearPredict(models.npb_top_speed_to_t90, evidence.npb_plus_top_speed_kmh));
  add('B', 'acceleration_direct', linearPredict(models.acceleration_to_t90, evidence.acceleration_direct));

  // Tier C: average / condition-controlled running times only. Fastest H->1 is intentionally absent.
  if (evidence.hp_to_1b_condition !== 'bunt' && evidence.hp_to_1b_condition !== 'unknown') {
    add('C', 'hp_to_1b_avg_sec', linearPredict(models.hp1b_avg_to_t90, evidence.hp_to_1b_avg_sec));
  }

  // Tier D: generic physical tests are priors, not direct anchors.
  for (const [key, modelKey] of [
    ['sprint_30m_sec', 'sprint30_to_t90'],
    ['sprint_50m_sec', 'sprint50_to_t90'],
    ['sprint_60m_sec', 'sprint60_to_t90'],
  ]) add('D', key, linearPredict(models[modelKey], evidence[key]));

  // Tier E: outcome proxies, only when nothing physical is available.
  if (!candidates.length && models.proxy) {
    const terms = [];
    let pred = finite(models.proxy.intercept) ? models.proxy.intercept : null;
    if (pred != null) {
      for (const [key, coef] of Object.entries(models.proxy.coefficients ?? {})) {
        if (!finite(evidence[key]) || !finite(coef)) continue;
        pred += coef * evidence[key];
        terms.push(key);
      }
      if (terms.length) add('E', 'outcome_proxy', pred, { terms });
    }
  }

  if (!candidates.length) {
    return { t90_sec: null, tier: null, source: null, is_estimated: true,
      reason: 'T90を推定できる材料または較正済みモデルがない' };
  }

  // Strict tier priority. We do not average lower-tier evidence into higher-tier evidence.
  candidates.sort((a, b) => a.tier.localeCompare(b.tier));
  return candidates[0];
}

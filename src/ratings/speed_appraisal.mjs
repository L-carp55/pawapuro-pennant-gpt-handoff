// High-level appraisal API for the T90 speed redesign.
//
// This file is intentionally NOT wired into the live card pipeline yet.
// It is the replacement boundary that the pipeline will call only after:
//   1) a calibrated T90 bridge model exists for the available evidence, and
//   2) an NPB reference T90 distribution has been frozen.
//
// Missing calibration must remain visible. Do not fall back to the legacy Pawapuro-calibrated speed scale.

import { estimateT90, speedRatingFromT90, withoutSpeedEvidence } from './speed_t90.mjs';

/**
 * Appraise base speed through T90.
 *
 * @param {object} evidence speed evidence object
 * @param {object} modelConfig full configs/speed_t90_models.json object OR its `models` block
 * @param {number[]} referenceTimes NPB reference T90 distribution. Empty until frozen.
 * @returns {object} always returns a structured result; unresolved state is explicit.
 */
export function appraiseSpeedT90(evidence = {}, modelConfig = {}, referenceTimes = []) {
  const models = modelConfig?.models ?? modelConfig ?? {};
  const est = estimateT90(evidence, models);

  if (est.t90_sec == null) {
    return {
      rating: null,
      t90_sec: null,
      tier: est.tier ?? null,
      source: est.source ?? null,
      is_estimated: true,
      status: 'UNAPPRAISED_NO_T90',
      unresolved: est.reason ?? 'T90を推定できる較正済みモデルがない',
    };
  }

  if (!Array.isArray(referenceTimes) || !referenceTimes.some(Number.isFinite)) {
    return {
      rating: null,
      t90_sec: est.t90_sec,
      tier: est.tier,
      source: est.source,
      is_estimated: est.is_estimated,
      status: 'T90_ESTIMATED_REFERENCE_NOT_FROZEN',
      unresolved: 'T90は得られたが、NPB reference CDFが未凍結のため走力1-100へ変換しない',
      evidence_detail: est,
    };
  }

  const rated = speedRatingFromT90(est.t90_sec, referenceTimes);
  if (!rated) {
    return {
      rating: null,
      t90_sec: est.t90_sec,
      tier: est.tier,
      source: est.source,
      is_estimated: est.is_estimated,
      status: 'UNAPPRAISED_REFERENCE_INVALID',
      unresolved: 'NPB reference CDFが空または不正',
      evidence_detail: est,
    };
  }

  return {
    rating: rated.rating,
    t90_sec: est.t90_sec,
    percentile_fast: rated.percentile_fast,
    z: rated.z,
    tier: est.tier,
    source: est.source,
    is_estimated: est.is_estimated,
    status: 'APPRAISED_T90',
    evidence_detail: est,
  };
}

/**
 * Downstream infield-hit ability must not use a T90 estimate that was itself inferred from infield hits.
 */
export function appraiseSpeedForInfieldHit(evidence = {}, modelConfig = {}, referenceTimes = []) {
  return appraiseSpeedT90(withoutSpeedEvidence(evidence, 'infield_hit_rate'), modelConfig, referenceTimes);
}

/**
 * Same circularity guard for a future GDP-related ability.
 */
export function appraiseSpeedForGdp(evidence = {}, modelConfig = {}, referenceTimes = []) {
  return appraiseSpeedT90(withoutSpeedEvidence(evidence, 'gdp_avoid'), modelConfig, referenceTimes);
}

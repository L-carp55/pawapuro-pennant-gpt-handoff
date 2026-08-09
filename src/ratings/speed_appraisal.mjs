// High-level appraisal API for the T90 speed redesign.
//
// Missing calibration must remain visible. Do not fall back to the legacy Pawapuro-calibrated speed scale.
// NPB+ officially names its running metric Sprint Speed. The old internal `top_speed` keys are accepted
// only as compatibility aliases at this boundary; new calibration/evidence should use canonical
// `npb_plus_sprint_speed_kmh` / `npb_sprint_speed_*` names.

import { estimateT90, speedRatingFromT90, withoutSpeedEvidence } from './speed_t90.mjs';

const finite = Number.isFinite;

function normalizeNpbSprintEvidenceAliases(evidence = {}) {
  const out = { ...evidence };
  const canonical = finite(out.npb_plus_sprint_speed_kmh) ? out.npb_plus_sprint_speed_kmh : null;
  const legacy = finite(out.npb_plus_top_speed_kmh) ? out.npb_plus_top_speed_kmh : null;
  // Canonical value wins if both exist; the low-level estimator still consumes the legacy key.
  if (canonical != null) out.npb_plus_top_speed_kmh = canonical;
  else if (legacy != null) out.npb_plus_sprint_speed_kmh = legacy;
  return out;
}

function normalizeNpbSprintModelAliases(models = {}) {
  const out = { ...models };
  // Canonical model contracts win when present. Copy them into the legacy low-level slots until
  // estimateT90 itself is migrated in a future compatibility cleanup.
  if (out.npb_sprint_speed_to_t90) out.npb_top_speed_to_t90 = out.npb_sprint_speed_to_t90;
  if (out.npb_sprint_speed_acceleration_to_t90) {
    out.npb_top_speed_acceleration_to_t90 = out.npb_sprint_speed_acceleration_to_t90;
  }
  return out;
}

function canonicalizeNpbSprintSource(source) {
  if (source === 'npb_plus_top_speed_kmh') return 'npb_plus_sprint_speed_kmh';
  if (source === 'npb_top_speed_acceleration') return 'npb_sprint_speed_acceleration';
  return source;
}

/**
 * Appraise base speed through T90.
 *
 * @param {object} evidence speed evidence object
 * @param {object} modelConfig full configs/speed_t90_models.json object OR its `models` block
 * @param {number[]} referenceTimes NPB reference T90 distribution. Empty until frozen.
 * @returns {object} always returns a structured result; unresolved state is explicit.
 */
export function appraiseSpeedT90(evidence = {}, modelConfig = {}, referenceTimes = []) {
  const rawModels = modelConfig?.models ?? modelConfig ?? {};
  const models = normalizeNpbSprintModelAliases(rawModels);
  const normalizedEvidence = normalizeNpbSprintEvidenceAliases(evidence);
  const rawEst = estimateT90(normalizedEvidence, models);
  const est = { ...rawEst, source: canonicalizeNpbSprintSource(rawEst.source) };

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

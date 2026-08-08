// Production resolver for the T90 speed redesign.
//
// Scope-control decision (2026-08-09): wire the new model now, but do not block
// completion on perfect T90 coverage. If T90 cannot yet produce a rating, preserve
// the existing displayed speed as an explicit provisional fallback. Never disguise
// that fallback as a T90 appraisal.

const finite = Number.isFinite;
const r1 = v => finite(v) ? Math.round(v * 10) / 10 : null;

const cleanT90Tier = tier => ['A', 'B', 'C', 'D'].includes(tier);

/**
 * Resolve the speed value shown/consumed by production cards.
 * Priority:
 *   1) appraised T90 from physical/contextual evidence (Tier A-D)
 *   2) explicit scouting value already selected by the card pipeline
 *   3) appraised Tier-E proxy T90
 *   4) existing legacy speed as a clearly marked temporary fallback
 *   5) null
 *
 * `existingSpeed` is the current ability-sheet speed object, not the old raw
 * `ratings.speed`, so an already-selected scouting value is preserved correctly.
 */
export function resolveProductionSpeed({
  t90Appraisal = null,
  existingSpeed = null,
  allowLegacyFallback = true,
} = {}) {
  const t90Rating = finite(t90Appraisal?.rating) ? r1(t90Appraisal.rating) : null;
  const tier = t90Appraisal?.tier ?? null;

  if (t90Rating != null && cleanT90Tier(tier)) {
    return {
      value: t90Rating,
      status: 'T90_PRIMARY',
      source: t90Appraisal.source ?? 't90',
      tier,
      t90_sec: t90Appraisal.t90_sec ?? null,
      provisional: false,
      clean_base_speed: true,
      legacy_fallback: false,
    };
  }

  if (finite(existingSpeed?.value) && existingSpeed?.from_scouting === true) {
    return {
      value: r1(existingSpeed.value),
      status: 'SCOUTING_FALLBACK_PENDING_T90',
      source: 'scouting',
      tier: null,
      t90_sec: t90Appraisal?.t90_sec ?? null,
      provisional: true,
      clean_base_speed: null,
      legacy_fallback: false,
      unresolved_t90_status: t90Appraisal?.status ?? null,
    };
  }

  if (t90Rating != null) {
    return {
      value: t90Rating,
      status: 'T90_PROXY_FALLBACK',
      source: t90Appraisal.source ?? 'outcome_proxy',
      tier,
      t90_sec: t90Appraisal.t90_sec ?? null,
      provisional: true,
      clean_base_speed: false,
      legacy_fallback: false,
      note: 'Tier-E outcome proxy. Physical T90 evidence is still preferred.',
    };
  }

  if (allowLegacyFallback && finite(existingSpeed?.value)) {
    return {
      value: r1(existingSpeed.value),
      status: 'LEGACY_FALLBACK_PENDING_T90',
      source: existingSpeed?.from_direct_measurement ? 'legacy_direct_scale'
        : existingSpeed?.from_scouting ? 'scouting' : 'legacy_running_model',
      tier: null,
      t90_sec: t90Appraisal?.t90_sec ?? null,
      provisional: true,
      clean_base_speed: false,
      legacy_fallback: true,
      unresolved_t90_status: t90Appraisal?.status ?? null,
      note: '旧走力モデルは成果指標を含むため、T90較正・基準CDFの完成までの暫定fallback。',
    };
  }

  return {
    value: null,
    status: 'UNAPPRAISED_SPEED',
    source: null,
    tier: t90Appraisal?.tier ?? null,
    t90_sec: t90Appraisal?.t90_sec ?? null,
    provisional: true,
    clean_base_speed: null,
    legacy_fallback: false,
    unresolved_t90_status: t90Appraisal?.status ?? null,
  };
}

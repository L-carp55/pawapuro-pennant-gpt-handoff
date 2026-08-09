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
  const protocolMismatch = record.start_rule_mismatch === true || protocol === 'special_first_step_start';
  const protocolCalibrated = numericProtocols.has(protocol) && !protocolMismatch;
  const temporalKnown = gapYears != null;
  const temporallyRecent = temporalKnown && gapYears <= maxNumericGapYears;
  const blocks = [];
  if (protocolMismatch) blocks.push('PROTOCOL_MISMATCH');
  else if (!protocolCalibrated) blocks.push('UNCALIBRATED_PROTOCOL');
  if (!temporalKnown) blocks.push('UNKNOWN_MEASUREMENT_YEAR');
  else if (!temporallyRecent) blocks.push('STALE_FOR_NUMERIC_T90');

  if (!blocks.length) {
    return {
      use: 'NUMERIC_CANDIDATE',
      status: 'STANDARDIZED_RECENT',
      numeric_t90_allowed: true,
      gap_years: gapYears,
      protocol_class: protocol,
      blocks: [],
      reason: null,
    };
  }

  const use = blocks.includes('STALE_FOR_NUMERIC_T90') && protocolCalibrated
    ? 'HISTORICAL_PROFILE_HINT'
    : 'PROFILE_HINT_ONLY';
  const reasonParts = [];
  if (blocks.includes('PROTOCOL_MISMATCH')) reasonParts.push('start/timing rule is incompatible with standardized T90/50m');
  if (blocks.includes('UNCALIBRATED_PROTOCOL')) reasonParts.push('timing/start protocol is not standardized against the project short-distance reference');
  if (blocks.includes('UNKNOWN_MEASUREMENT_YEAR')) reasonParts.push('measurement year is unknown');
  if (blocks.includes('STALE_FOR_NUMERIC_T90')) reasonParts.push(`measurement is ${gapYears} years from target; age/trajectory model required`);

  return {
    use,
    status: blocks[0],
    numeric_t90_allowed: false,
    gap_years: gapYears,
    protocol_class: protocol,
    blocks,
    reason: reasonParts.join('; '),
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

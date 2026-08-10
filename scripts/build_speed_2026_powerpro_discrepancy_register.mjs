#!/usr/bin/env node
/**
 * Stage 2 only. Builds an external PowerPro discrepancy register and a
 * separate physical-only SNS tiebreak queue.
 *
 * The queue builder deliberately accepts only frozen Stage 1 profiles and the
 * pre-existing physical queue. It has no parameter for an external game value,
 * residual, blind baseline, or provisional final freeze.
 *
 * Reproduce with:
 *   node scripts/build_speed_2026_powerpro_discrepancy_register.mjs --generated-at=2026-08-10T00:00:00.000Z
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DERIVED = resolve(ROOT, 'outputs', 'derived');
const OLD_QUEUE_COMMIT = 'dcf8637f4e94ae51af3bd8f9a99927bfb37bdef3';
const OLD_QUEUE_PATH = 'outputs/derived/speed_2026_100_sns_tiebreak_queue.csv';
const generatedAtArgument = process.argv.find((argument) => argument.startsWith('--generated-at='));
const generatedAt = generatedAtArgument ? generatedAtArgument.slice('--generated-at='.length) : new Date().toISOString();

if (Number.isNaN(Date.parse(generatedAt))) throw new Error(`Invalid --generated-at: ${generatedAt}`);

const EXTERNAL_QA_LABELS = new Set([
  'POWERPRO_HIGH_AND_PHYSICAL_SUPPORTS_FASTER',
  'POWERPRO_HIGH_WITHOUT_PHYSICAL_SUPPORT',
  'POWERPRO_HIGH_BUT_PHYSICAL_CONFLICTED',
  'POWERPRO_LOW_AND_PHYSICAL_SUPPORTS_SLOWER',
  'POWERPRO_LOW_WITHOUT_PHYSICAL_SUPPORT',
  'POWERPRO_LOW_BUT_PHYSICAL_CONFLICTED',
  'INSUFFICIENT_PHYSICAL_EVIDENCE',
]);

const QUEUE_COLUMNS = [
  'player',
  'player_id',
  'team',
  'queue_change',
  'old_queue_member',
  'v2_queue_member',
  'stage1_frozen_queue_source_member',
  'stage1_frozen_queue_source_change',
  'stage1_frozen_queue_source_reason',
  'reason_codes',
  'stage1_pa',
  'stage1_pa_bucket',
  'stage1_current_signal_missingness',
  'stage1_acceleration_classification',
  'stage1_anchor_relative_status',
  'stage1_measurement_era',
  'stage1_direct_t90_missingness',
  'stage1_standardized_short_distance_missingness',
  'external_comparison_fields_omitted',
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function parseCsv(text) {
  const rows = [];
  let cell = '';
  let row = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body
    .filter((values) => values.some((value) => value !== ''))
    .map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])));
}

function csvEscape(value) {
  const rendered = value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);
  return /[",\n\r]/.test(rendered) ? `"${rendered.replaceAll('"', '""')}"` : rendered;
}

function toCsv(rows, columns) {
  return `${columns.join(',')}\n${rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')).join('\n')}\n`;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizedRosterName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replaceAll('髙', '高')
    .replaceAll('﨑', '崎')
    .replaceAll('塚', '塚');
}

function playerTeamKey(player, team) {
  return `${player}\u0000${team}`;
}

function physicalEvidenceMissingness(entries) {
  return entries.length > 0 ? 'PRESENT' : 'NOT_PUBLICLY_DOCUMENTED_IN_STAGE1_FREEZE';
}

/**
 * Strict game matching: team must match exactly after Unicode normalization,
 * and the published game roster string must be the exact normalized prefix of
 * the target's normalized full roster name (or vice versa). This handles the
 * source's fixed-width abbreviated roster labels without fuzzy spelling,
 * manual aliases, cross-team matching, or a forced fallback.
 */
function exactTeamAwarePowerProMatch(profile, gameRows) {
  const targetName = normalizedRosterName(profile.player);
  const targetTeam = normalizedRosterName(profile.team);
  const candidates = gameRows.filter((gameRow) => {
    if (normalizedRosterName(gameRow.team) !== targetTeam) return false;
    const gameName = normalizedRosterName(gameRow.name_norm);
    return targetName.startsWith(gameName) || gameName.startsWith(targetName);
  });
  if (candidates.length === 1) {
    return {
      match_status: 'EXACT_TEAM_NORMALIZED_ROSTER_NAME_UNIQUE',
      game_row: candidates[0],
    };
  }
  return {
    match_status: candidates.length === 0
      ? 'NO_UNIQUE_EXACT_TEAM_NORMALIZED_ROSTER_NAME_MATCH'
      : 'AMBIGUOUS_EXACT_TEAM_NORMALIZED_ROSTER_NAME_MATCH',
    game_row: null,
  };
}

function externalQaPhysicalClassification(profile, primaryResidual) {
  const powerProIsHigh = primaryResidual < -10;
  const conflict = profile.acceleration_top_speed_classification === 'METRIC_CONSTRUCT_CONFLICT'
    || profile.acceleration_top_speed_classification === 'DIRECT_T90_TOP_SPEED_CONFLICT'
    || profile.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT';
  if (conflict) {
    return {
      label: powerProIsHigh
        ? 'POWERPRO_HIGH_BUT_PHYSICAL_CONFLICTED'
        : 'POWERPRO_LOW_BUT_PHYSICAL_CONFLICTED',
      physical_support_status: 'CONFLICTED',
      physical_basis: profile.acceleration_top_speed_classification,
    };
  }

  // The Stage 1 100-player cohort supplies ordinal, not cross-metric numeric,
  // directional evidence. The outer octiles are used only as directional
  // compatibility checks; no percentiles are subtracted and no value is
  // converted to or from a game scale.
  const rank = profile.npb_plus_cohort_rank;
  const supportsFaster = Number.isInteger(rank) && rank >= 1 && rank <= 25;
  const supportsSlower = Number.isInteger(rank) && rank >= 76 && rank <= 100;
  if (powerProIsHigh && supportsFaster) {
    return {
      label: 'POWERPRO_HIGH_AND_PHYSICAL_SUPPORTS_FASTER',
      physical_support_status: 'SUPPORTS_FASTER_DIRECTION',
      physical_basis: 'STAGE1_CURRENT_NPB_PLUS_OUTER_FAST_QUARTILE_ORDINAL_ONLY',
    };
  }
  if (!powerProIsHigh && supportsSlower) {
    return {
      label: 'POWERPRO_LOW_AND_PHYSICAL_SUPPORTS_SLOWER',
      physical_support_status: 'SUPPORTS_SLOWER_DIRECTION',
      physical_basis: 'STAGE1_CURRENT_NPB_PLUS_OUTER_SLOW_QUARTILE_ORDINAL_ONLY',
    };
  }
  if ((powerProIsHigh && supportsSlower) || (!powerProIsHigh && supportsFaster)) {
    return {
      label: powerProIsHigh
        ? 'POWERPRO_HIGH_WITHOUT_PHYSICAL_SUPPORT'
        : 'POWERPRO_LOW_WITHOUT_PHYSICAL_SUPPORT',
      physical_support_status: 'DIRECTIONALLY_NOT_SUPPORTED_BY_STAGE1_OUTER_QUARTILE',
      physical_basis: powerProIsHigh
        ? 'STAGE1_CURRENT_NPB_PLUS_OUTER_SLOW_QUARTILE_ORDINAL_ONLY'
        : 'STAGE1_CURRENT_NPB_PLUS_OUTER_FAST_QUARTILE_ORDINAL_ONLY',
    };
  }
  return {
    label: 'INSUFFICIENT_PHYSICAL_EVIDENCE',
    physical_support_status: 'INSUFFICIENT_FOR_DIRECTIONAL_COMPATIBILITY_CLASSIFICATION',
    physical_basis: 'NO_STAGE1_OUTER_QUARTILE_DIRECTION_OR_EXPLICIT_CONFLICT',
  };
}

/**
 * Physical-only queue boundary. This function receives no game/residual data
 * and only returns physical Stage 1 fields. It must stay that way.
 */
function buildSnsQueueFromFrozenPhysicalStage1(profiles, frozenPhysicalQueueRows) {
  const frozenQueueByKey = new Map(frozenPhysicalQueueRows.map((row) => [playerTeamKey(row.player, row.team), row]));
  const queueRows = [];
  for (const profile of profiles) {
    const reasonCodes = [];
    const pa = profile.exposure?.PA;
    const lowExposure = typeof pa === 'number' && pa < 100;
    const currentSignalMetadataUnavailable = profile.exposure?.npb_plus_sample_count === null
      || profile.exposure?.npb_plus_qualified_run_count === null;
    const unresolvedAnchor = profile.anchor_relative_status?.status === 'SNS_TIEBREAK';
    // Stage 1 V2 resolves the former temporal-boundary defect: only an
    // explicitly known non-2026 comparison is a temporal conflict. An
    // unknown era remains insufficient evidence, not a temporal assertion.
    const knownTemporalConflict = profile.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT';
    const standardizedCurrentConflict = profile.acceleration_top_speed_classification === 'METRIC_CONSTRUCT_CONFLICT';
    const directT90CurrentConflict = profile.acceleration_top_speed_classification === 'DIRECT_T90_TOP_SPEED_CONFLICT';
    const insufficientAccelerationWithUnstableCurrentSignal = profile.acceleration_top_speed_classification === 'INSUFFICIENT_SHORT_DISTANCE_EVIDENCE'
      && lowExposure
      && currentSignalMetadataUnavailable;

    if (lowExposure && currentSignalMetadataUnavailable) reasonCodes.push('LOW_EXPOSURE_WITH_CURRENT_SIGNAL_METADATA_UNAVAILABLE');
    if (standardizedCurrentConflict) reasonCodes.push('STANDARDIZED_COHORT_CURRENT_CONFLICT');
    if (directT90CurrentConflict) reasonCodes.push('DIRECT_T90_CURRENT_CONFLICT');
    if (knownTemporalConflict) reasonCodes.push('TEMPORAL_UNCERTAINTY_KNOWN_NON_2026_COMPARISON_MEASUREMENT');
    if (insufficientAccelerationWithUnstableCurrentSignal) reasonCodes.push('INSUFFICIENT_ACCELERATION_EVIDENCE_WITH_MATERIALLY_UNSTABLE_CURRENT_SIGNAL');
    if (unresolvedAnchor) reasonCodes.push('ANCHOR_RELATIVE_UNRESOLVED');
    if (reasonCodes.length === 0) continue;

    const key = playerTeamKey(profile.player, profile.team);
    const frozenQueueSource = frozenQueueByKey.get(key) ?? null;
    const oldQueueMember = frozenQueueSource?.queue_change === 'retained';
    queueRows.push({
      player: profile.player,
      player_id: profile.player_id,
      team: profile.team,
      queue_change: oldQueueMember ? 'retained' : 'added',
      old_queue_member: oldQueueMember,
      v2_queue_member: true,
      stage1_frozen_queue_source_member: Boolean(frozenQueueSource),
      stage1_frozen_queue_source_change: frozenQueueSource?.queue_change ?? null,
      stage1_frozen_queue_source_reason: frozenQueueSource?.reason ?? null,
      reason_codes: reasonCodes,
      stage1_pa: pa ?? null,
      stage1_pa_bucket: profile.exposure?.pa_bucket ?? null,
      stage1_current_signal_missingness: currentSignalMetadataUnavailable
        ? 'SAMPLE_OR_QUALIFIED_RUN_COUNT_NOT_PUBLICLY_DOCUMENTED'
        : 'PRESENT',
      stage1_acceleration_classification: profile.acceleration_top_speed_classification,
      stage1_anchor_relative_status: profile.anchor_relative_status?.status ?? null,
      stage1_measurement_era: profile.measurement_era ?? [],
      stage1_direct_t90_missingness: physicalEvidenceMissingness(profile.direct_t90 ?? []),
      stage1_standardized_short_distance_missingness: physicalEvidenceMissingness(profile.standardized_short_distance_evidence ?? []),
      external_comparison_fields_omitted: true,
    });
  }
  const v2Keys = new Set(queueRows.map((row) => playerTeamKey(row.player, row.team)));
  for (const frozenQueueRow of frozenPhysicalQueueRows) {
    const key = playerTeamKey(frozenQueueRow.player, frozenQueueRow.team);
    if (v2Keys.has(key)) continue;
    queueRows.push({
      player: frozenQueueRow.player,
      player_id: frozenQueueRow.player_id ?? null,
      team: frozenQueueRow.team,
      queue_change: 'removed',
      old_queue_member: frozenQueueRow.queue_change === 'retained',
      v2_queue_member: false,
      stage1_frozen_queue_source_member: true,
      stage1_frozen_queue_source_change: frozenQueueRow.queue_change ?? null,
      stage1_frozen_queue_source_reason: frozenQueueRow.reason ?? null,
      reason_codes: ['NO_LONGER_ELIGIBLE_UNDER_FROZEN_STAGE1_V2_RULES'],
      stage1_pa: null,
      stage1_pa_bucket: null,
      stage1_current_signal_missingness: 'NOT_REEVALUATED_BECAUSE_PROFILE_MISSING',
      stage1_acceleration_classification: null,
      stage1_anchor_relative_status: null,
      stage1_measurement_era: [],
      stage1_direct_t90_missingness: 'NOT_REEVALUATED_BECAUSE_PROFILE_MISSING',
      stage1_standardized_short_distance_missingness: 'NOT_REEVALUATED_BECAUSE_PROFILE_MISSING',
      external_comparison_fields_omitted: true,
    });
  }
  return queueRows.sort((left, right) => left.team.localeCompare(right.team, 'ja') || left.player.localeCompare(right.player, 'ja'));
}

function targetedPhysicalEvidenceNeeds(queueRows) {
  return queueRows
    .filter((row) => row.v2_queue_member)
    .map((row) => {
      const reasons = new Set(row.reason_codes);
      const needs = [];
      if (reasons.has('STANDARDIZED_COHORT_CURRENT_CONFLICT') || reasons.has('DIRECT_T90_CURRENT_CONFLICT')) {
        needs.push('SAME_SESSION_PHYSICAL_COMPARISON', 'CURRENT_STANDARDIZED_30M', 'DIRECT_T90');
      } else if (reasons.has('TEMPORAL_UNCERTAINTY_KNOWN_NON_2026_COMPARISON_MEASUREMENT')) {
        needs.push('CURRENT_STANDARDIZED_30M', 'DIRECT_T90');
      } else {
        needs.push('DIRECT_T90');
      }
      return {
        player: row.player,
        player_id: row.player_id,
        team: row.team,
        status: 'TARGETED_ADDITIONAL_PHYSICAL_EVIDENCE_NEED',
        physical_queue_reason_codes: row.reason_codes,
        targeted_evidence_types: [...new Set(needs)],
        player_specific_injury_recovery_measurement: 'NOT_INDICATED_FROM_STAGE1_FREEZE',
        rationale: reasons.has('STANDARDIZED_COHORT_CURRENT_CONFLICT') || reasons.has('DIRECT_T90_CURRENT_CONFLICT')
          ? 'Existing Stage 1 physical constructs conflict; a same-session comparison is the targeted need.'
          : reasons.has('TEMPORAL_UNCERTAINTY_KNOWN_NON_2026_COMPARISON_MEASUREMENT')
            ? 'Stage 1 identifies a known non-2026 comparison measurement; a current dated physical observation is the targeted need.'
            : 'The current signal is exposure-limited or anchor-unresolved; an independent direct physical observation is the targeted need.',
        collection_instruction: 'NOT_A_REQUEST_TO_COLLECT; EVIDENCE_NEED_ONLY',
      };
    });
}

const stage1Path = resolve(DERIVED, 'speed_2026_blind_physical_construct_profiles.json');
const stage1QaPath = resolve(DERIVED, 'speed_2026_blind_physical_construct_stage1_qa.json');
const stage1ManifestPath = resolve(DERIVED, 'speed_2026_blind_physical_construct_freeze_manifest.json');
const blindV3Path = resolve(DERIVED, 'speed_blind_v3_npbplus_2026.json');
const finalFreezePath = resolve(DERIVED, 'speed_2026_100_final_freeze_20260810.csv');
const databasePath = resolve(ROOT, 'data', 'pennant.db');
const stage1 = JSON.parse(readFileSync(stage1Path, 'utf8'));
const stage1Qa = JSON.parse(readFileSync(stage1QaPath, 'utf8'));
const stage1Manifest = JSON.parse(readFileSync(stage1ManifestPath, 'utf8'));
const blindV3 = JSON.parse(readFileSync(blindV3Path, 'utf8'));
const finalFreezeRows = parseCsv(readFileSync(finalFreezePath, 'utf8'));
// The Stage 1 V2 QA is the frozen local receipt of the full physical-only
// queue: 19 retained source members plus 6 Stage-1-added temporal conflicts.
// It avoids reopening any later external-QA or residual artifact.
const frozenPhysicalQueueRows = (stage1Qa.physical_only_sns_queue ?? []).map((row) => ({
  player: row.player,
  player_id: row.player_id ?? null,
  team: row.team,
  queue_change: row.queue_change,
  reason: row.reason ?? null,
  reason_codes: row.source_reason_codes ?? null,
  no_game_ratings_read: row.no_game_ratings_read,
}));
const retainedSourceQueueRows = frozenPhysicalQueueRows.filter((row) => row.queue_change === 'retained');
const addedStage1QueueRows = frozenPhysicalQueueRows.filter((row) => row.queue_change === 'added');

if (stage1.stage !== 'STAGE_1_BLIND_PHYSICAL_CONSTRUCT_V2_FREEZE' || stage1.profiles.length !== 100) {
  throw new Error('Expected the current V2 frozen 100-row Stage 1 physical profile artifact.');
}
if (stage1Qa.stage !== 'STAGE_1_V2_ONLY' || stage1Manifest.stage !== 'STAGE_1_V2_FREEZE') {
  throw new Error('Expected matching V2 Stage 1 QA and manifest provenance.');
}
if (blindV3.players.length !== 99 || finalFreezeRows.length !== 100 || frozenPhysicalQueueRows.length !== 25 || retainedSourceQueueRows.length !== 19 || addedStage1QueueRows.length !== 6) {
  throw new Error(`V2 input coverage mismatch: blind=${blindV3.players.length}, final=${finalFreezeRows.length}, frozen_queue=${frozenPhysicalQueueRows.length}, retained=${retainedSourceQueueRows.length}, stage1_added=${addedStage1QueueRows.length}.`);
}
if (frozenPhysicalQueueRows.some((row) => !['retained', 'added'].includes(row.queue_change) || row.no_game_ratings_read !== true)) {
  throw new Error('Frozen V2 Stage 1 QA does not prove a physical-only retained/added source queue.');
}

const database = new DatabaseSync(databasePath, { readOnly: true });
const powerPro2026Rows = database.prepare("SELECT team, name, name_norm, speed FROM pawapuro_full WHERE work='2026'").all();
database.close();
if (powerPro2026Rows.length === 0) throw new Error('No 2026 PowerPro rows available in the local source table.');

const blindByPlayerId = new Map(blindV3.players.map((row) => [String(row.player_id), row]));
const finalByPlayer = new Map(finalFreezeRows.map((row) => [row.player, row]));
const registerRows = stage1.profiles.map((profile) => {
  const match = exactTeamAwarePowerProMatch(profile, powerPro2026Rows);
  const blind = profile.player_id ? blindByPlayerId.get(String(profile.player_id)) : null;
  const final = finalByPlayer.get(profile.player);
  if (!final) throw new Error(`Missing final-freeze row for ${profile.player}.`);

  const powerProSpeed = match.game_row?.speed ?? null;
  const roundedBlindV3Baseline = blind ? Math.round(Number(blind.blind_rating)) : null;
  const provisionalFinalFreeze = Number(final.final_rating);
  const residualA = powerProSpeed === null || roundedBlindV3Baseline === null ? null : roundedBlindV3Baseline - powerProSpeed;
  const residualB = powerProSpeed === null ? null : provisionalFinalFreeze - powerProSpeed;
  const highA = residualA !== null && Math.abs(residualA) > 10;
  const highB = residualB !== null && Math.abs(residualB) > 10;
  const primaryResidual = highB ? residualB : highA ? residualA : null;
  const classification = primaryResidual === null
    ? null
    : externalQaPhysicalClassification(profile, primaryResidual);

  if (classification && !EXTERNAL_QA_LABELS.has(classification.label)) {
    throw new Error(`Unapproved external QA label for ${profile.player}: ${classification.label}`);
  }
  return {
    player: profile.player,
    player_id: profile.player_id,
    team: profile.team,
    powerpro_match_status: match.match_status,
    matched_powerpro_roster_name: match.game_row?.name_norm ?? null,
    powerpro_2026_speed: powerProSpeed,
    rounded_blind_v3_baseline: roundedBlindV3Baseline,
    provisional_final_freeze: provisionalFinalFreeze,
    residual_a_top_speed_baseline_minus_powerpro: residualA,
    residual_b_provisional_freeze_minus_powerpro: residualB,
    abs_residual_a: residualA === null ? null : Math.abs(residualA),
    abs_residual_b: residualB === null ? null : Math.abs(residualB),
    high_discrepancy_residual_a: highA,
    high_discrepancy_residual_b: highB,
    high_discrepancy_any_residual: highA || highB,
    primary_high_discrepancy_residual: highB ? 'B' : highA ? 'A' : null,
    external_qa_label: classification?.label ?? null,
    physical_support_status: classification?.physical_support_status ?? null,
    physical_basis: classification?.physical_basis ?? null,
    stage1_current_npb_plus_cohort_rank: profile.npb_plus_cohort_rank,
    stage1_current_npb_plus_band: profile.npb_plus_ordinal_band,
    stage1_acceleration_classification: profile.acceleration_top_speed_classification,
    stage1_anchor_relative_status: profile.anchor_relative_status?.status ?? null,
    stage1_measurement_era: profile.measurement_era,
    stage1_direct_t90_missingness: physicalEvidenceMissingness(profile.direct_t90 ?? []),
    stage1_standardized_short_distance_missingness: physicalEvidenceMissingness(profile.standardized_short_distance_evidence ?? []),
    exclusion_note: match.game_row ? null : 'EXCLUDED_FROM_RESIDUALS; NO_FORCED_POWERPRO_MATCH',
  };
});

const matchedRows = registerRows.filter((row) => row.powerpro_match_status === 'EXACT_TEAM_NORMALIZED_ROSTER_NAME_UNIQUE');
const unmatchedRows = registerRows.filter((row) => row.powerpro_match_status !== 'EXACT_TEAM_NORMALIZED_ROSTER_NAME_UNIQUE');
if (matchedRows.length !== 99 || unmatchedRows.length !== 1 || unmatchedRows[0].player !== '名原 典彦') {
  throw new Error(`Strict PowerPro match requirement failed: matched=${matchedRows.length}, unmatched=${JSON.stringify(unmatchedRows.map((row) => row.player))}.`);
}
if (matchedRows.some((row) => row.rounded_blind_v3_baseline === null || row.provisional_final_freeze === null)) {
  throw new Error('A matched player is missing a required Residual A or B input.');
}

const highDiscrepancyRows = registerRows.filter((row) => row.high_discrepancy_any_residual);
const queueRows = buildSnsQueueFromFrozenPhysicalStage1(stage1.profiles, frozenPhysicalQueueRows);
const evidenceNeeds = targetedPhysicalEvidenceNeeds(queueRows);
const queueOutputText = toCsv(queueRows, QUEUE_COLUMNS);
if (/powerpro|pawapuro|residual|blind[_ -]?v3|final[_ -]?freeze|game[_ -]?rating/i.test(queueOutputText)) {
  throw new Error('SNS queue boundary failed: an external game or residual token reached the physical-only queue output.');
}
if (queueRows.some((row) => row.external_comparison_fields_omitted !== true)) {
  throw new Error('SNS queue boundary failed: a queue row does not assert omitted external-comparison fields.');
}

const discrepancyCsvColumns = [
  'player', 'player_id', 'team', 'powerpro_match_status', 'matched_powerpro_roster_name', 'powerpro_2026_speed',
  'rounded_blind_v3_baseline', 'provisional_final_freeze', 'residual_a_top_speed_baseline_minus_powerpro',
  'residual_b_provisional_freeze_minus_powerpro', 'abs_residual_a', 'abs_residual_b',
  'high_discrepancy_residual_a', 'high_discrepancy_residual_b', 'high_discrepancy_any_residual',
  'primary_high_discrepancy_residual', 'external_qa_label', 'physical_support_status', 'physical_basis',
  'stage1_current_npb_plus_cohort_rank', 'stage1_current_npb_plus_band', 'stage1_acceleration_classification',
  'stage1_anchor_relative_status', 'stage1_measurement_era', 'stage1_direct_t90_missingness',
  'stage1_standardized_short_distance_missingness', 'exclusion_note',
];
const evidenceNeedsColumns = [
  'player', 'player_id', 'team', 'status', 'physical_queue_reason_codes', 'targeted_evidence_types',
  'player_specific_injury_recovery_measurement', 'rationale', 'collection_instruction',
];

const labelCounts = Object.fromEntries([...EXTERNAL_QA_LABELS].sort().map((label) => [
  label,
  highDiscrepancyRows.filter((row) => row.external_qa_label === label).length,
]));
const queueCounts = {
  original_physical_queue_rows_retained_by_stage1_v2: retainedSourceQueueRows.length,
  stage1_v2_frozen_physical_queue_rows: frozenPhysicalQueueRows.length,
  stage1_v2_temporal_additions: addedStage1QueueRows.length,
  v2_rows: queueRows.filter((row) => row.v2_queue_member).length,
  retained: queueRows.filter((row) => row.queue_change === 'retained').length,
  added: queueRows.filter((row) => row.queue_change === 'added').length,
  removed: queueRows.filter((row) => row.queue_change === 'removed').length,
  temporal_uncertainty_known_non_2026: queueRows.filter((row) => row.reason_codes.includes('TEMPORAL_UNCERTAINTY_KNOWN_NON_2026_COMPARISON_MEASUREMENT')).length,
  standardized_cohort_current_conflict: queueRows.filter((row) => row.reason_codes.includes('STANDARDIZED_COHORT_CURRENT_CONFLICT')).length,
  direct_t90_current_conflict: queueRows.filter((row) => row.reason_codes.includes('DIRECT_T90_CURRENT_CONFLICT')).length,
  anchor_relative_unresolved: queueRows.filter((row) => row.reason_codes.includes('ANCHOR_RELATIVE_UNRESOLVED')).length,
};

const registerDocument = {
  schema_version: 'speed-2026-powerpro-discrepancy-register/v2.1.0',
  stage: 'STAGE_2_EXTERNAL_RESIDUAL_AUDIT_FROM_STAGE1_V2_FREEZE',
  generated_at: generatedAt,
  v1_supersession: {
    status: 'SUPERSEDED',
    reason: 'STAGE1_TEMPORAL_BOUNDARY_QA_FAILURE',
    v1_agent_d_outputs_used_for_calculation: false,
    v2_rerun_requires: [
      'STAGE_1_BLIND_PHYSICAL_CONSTRUCT_V2_FREEZE',
      'STAGE_1_V2_ONLY',
      'STAGE_1_V2_FREEZE manifest',
    ],
  },
  residual_definitions: {
    residual_a: 'rounded blind-v3 baseline - PowerPro 2026',
    residual_b: 'provisional physical freeze - PowerPro 2026',
    high_discrepancy: 'abs(Residual A) > 10 OR abs(Residual B) > 10',
    classification_residual_priority: 'Residual B where high; otherwise Residual A where high.',
  },
  matching_policy: {
    method: 'same exact normalized team plus unique normalized published-roster-name prefix compatibility',
    fuzzy_matching: false,
    team_aliases: false,
    forced_match: false,
    excluded_unmatched_player: '名原 典彦',
  },
  physical_classification_policy: {
    labels: [...EXTERNAL_QA_LABELS].sort(),
    source_boundary: 'Frozen Stage 1 physical profiles only.',
    conflict_rule: 'Use Stage 1 metric/direct-T90/temporal-construct conflict only; do not resolve the conflict numerically.',
    temporal_rule: 'Known non-2026 comparison measurements are physical temporal uncertainty; unknown-only eras remain insufficient evidence under the V2 Stage 1 boundary.',
    support_rule: 'Outer cohort quartiles are directional compatibility only, not a cross-metric conversion or independent causal validation.',
    insufficiency_rule: 'Use INSUFFICIENT_PHYSICAL_EVIDENCE when frozen Stage 1 does not supply an outer-quartile direction or explicit conflict.',
  },
  coverage: {
    stage1_profiles: stage1.profiles.length,
    powerpro_2026_source_rows: powerPro2026Rows.length,
    exact_team_aware_matches: matchedRows.length,
    unmatched_excluded_without_forcing: unmatchedRows.map((row) => row.player),
    residual_a_coverage: registerRows.filter((row) => row.residual_a_top_speed_baseline_minus_powerpro !== null).length,
    residual_b_coverage: registerRows.filter((row) => row.residual_b_provisional_freeze_minus_powerpro !== null).length,
    high_discrepancy_any_residual: highDiscrepancyRows.length,
    high_discrepancy_residual_a: registerRows.filter((row) => row.high_discrepancy_residual_a).length,
    high_discrepancy_residual_b: registerRows.filter((row) => row.high_discrepancy_residual_b).length,
    high_discrepancy_label_counts: labelCounts,
  },
  input_receipts: {
    stage1_profiles_v2: { path: 'outputs/derived/speed_2026_blind_physical_construct_profiles.json', sha256: fileSha256(stage1Path), schema_version: stage1.schema_version, stage: stage1.stage },
    stage1_qa_v2: { path: 'outputs/derived/speed_2026_blind_physical_construct_stage1_qa.json', sha256: fileSha256(stage1QaPath), schema_version: stage1Qa.schema_version, stage: stage1Qa.stage },
    stage1_manifest_v2: { path: 'outputs/derived/speed_2026_blind_physical_construct_freeze_manifest.json', sha256: fileSha256(stage1ManifestPath), schema_version: stage1Manifest.schema_version, stage: stage1Manifest.stage },
    blind_v3: { path: 'outputs/derived/speed_blind_v3_npbplus_2026.json', sha256: fileSha256(blindV3Path) },
    provisional_final_freeze: { path: 'outputs/derived/speed_2026_100_final_freeze_20260810.csv', sha256: fileSha256(finalFreezePath) },
    powerpro_2026_local_source: { path: 'data/pennant.db:pawapuro_full/work=2026', sha256: fileSha256(databasePath) },
    frozen_stage1_v2_physical_sns_queue_membership: {
      source_commit: OLD_QUEUE_COMMIT,
      source_path: OLD_QUEUE_PATH,
      frozen_receipt_path: 'outputs/derived/speed_2026_blind_physical_construct_stage1_qa.json',
      frozen_receipt_sha256: fileSha256(stage1QaPath),
      member_count: frozenPhysicalQueueRows.length,
      retained_original_source_members: retainedSourceQueueRows.length,
      stage1_v2_temporal_additions: addedStage1QueueRows.length,
    },
  },
  sns_queue_v2_boundary: {
    separate_artifact: 'outputs/derived/speed_2026_sns_tiebreak_queue_v2.csv',
    queue_inputs: ['frozen Stage 1 V2 physical profiles', 'frozen Stage 1 V2 physical-only queue source'],
    external_game_field_read_by_queue_builder: false,
    external_game_field_emitted_in_queue: false,
    reconciliation: queueCounts,
  },
  rows: registerRows,
  high_discrepancy_rows: highDiscrepancyRows,
  targeted_additional_physical_evidence_needs: {
    artifact: 'outputs/derived/speed_2026_targeted_additional_physical_evidence_needs.csv',
    count: evidenceNeeds.length,
    scope: 'Evidence need only; not a collection request.',
  },
  limitations: [
    'Residuals are external QA diagnostics, not correction targets and not new ratings.',
    'The physical labels do not infer a numeric NPB+ to PowerPro bridge.',
    'A physical direction compatible with a game value is not a causal explanation for the game value.',
  ],
};

const outputRegisterCsv = resolve(DERIVED, 'speed_2026_powerpro_discrepancy_register.csv');
const outputRegisterJson = resolve(DERIVED, 'speed_2026_powerpro_discrepancy_register.json');
const outputQueueCsv = resolve(DERIVED, 'speed_2026_sns_tiebreak_queue_v2.csv');
const outputEvidenceNeedsCsv = resolve(DERIVED, 'speed_2026_targeted_additional_physical_evidence_needs.csv');
const outputExecutionQa = resolve(DERIVED, 'speed_2026_agent_d_execution_qa.json');
writeFileSync(outputRegisterCsv, toCsv(registerRows, discrepancyCsvColumns), 'utf8');
writeJson(outputRegisterJson, registerDocument);
writeFileSync(outputQueueCsv, queueOutputText, 'utf8');
writeFileSync(outputEvidenceNeedsCsv, toCsv(evidenceNeeds, evidenceNeedsColumns), 'utf8');

const executionQa = {
  schema_version: 'speed-2026-agent-d-execution-qa/v2.0.0',
  owner: 'AGENT_D_ONLY',
  generated_at: generatedAt,
  initial_runtime_failure: {
    observed: true,
    invoking_command: 'node scripts\\build_speed_2026_powerpro_discrepancy_register.mjs --generated-at=2026-08-10T12:00:00.000Z',
    failed_child_command: `git -C ${ROOT} show ${OLD_QUEUE_COMMIT}:${OLD_QUEUE_PATH}`,
    error_code: 'EPERM',
    error_text: 'spawnSync git EPERM',
    status: 'FAILED_BEFORE_ARTIFACT_GENERATION',
    scope: 'Sandbox runtime process-spawn restriction; not a source-data or matching failure.',
  },
  remediation: {
    applied: true,
    replacement_input: 'outputs/derived/speed_2026_blind_physical_construct_stage1_qa.json:physical_only_sns_queue',
    source_derived_queue_commit: OLD_QUEUE_COMMIT,
    source_derived_queue_path: OLD_QUEUE_PATH,
    semantic_identity: 'For the original queue, the frozen Stage 1 QA preserves the same 19 retained player+team members after the Stage 1 builder read the physical-only source queue.',
    no_powerpro_introduction: 'The consumed frozen entries contain only player/team and physical-queue metadata, each asserts no_game_ratings_read=true, and the Stage 2 queue builder accepts only Stage 1 profiles plus this membership projection.',
    original_source_membership_count: retainedSourceQueueRows.length,
    original_source_membership_all_retained: retainedSourceQueueRows.every((row) => row.queue_change === 'retained'),
    source_membership_all_game_rating_free: frozenPhysicalQueueRows.every((row) => row.no_game_ratings_read === true),
  },
  v1_supersession_v2_rerun: {
    status: 'V1_SUPERSEDED_V2_RERUN_PASS',
    supersession_reason: 'STAGE1_TEMPORAL_BOUNDARY_QA_FAILURE',
    v1_agent_d_artifacts_used_for_calculation: false,
    v2_stage1_profile_sha256: fileSha256(stage1Path),
    v2_stage1_qa_sha256: fileSha256(stage1QaPath),
    v2_stage1_manifest_sha256: fileSha256(stage1ManifestPath),
    known_non_2026_temporal_construct_conflicts: stage1Manifest.coverage?.temporal_construct_conflicts ?? null,
    unknown_only_measurement_eras_treated_as_temporal_conflict: false,
    stage1_v2_frozen_queue_membership: {
      total: frozenPhysicalQueueRows.length,
      retained: retainedSourceQueueRows.length,
      added_for_temporal_conflict: addedStage1QueueRows.length,
    },
  },
  post_remediation_validation: {
    build_status: 'PASS',
    exact_team_aware_powerpro_matches: matchedRows.length,
    unmatched_not_forced: unmatchedRows.length,
    discrepancy_rows: registerRows.length,
    high_discrepancy_rows: highDiscrepancyRows.length,
    sns_queue_external_game_or_residual_token_check: 'PASS',
    sns_queue_reconciliation: queueCounts,
    targeted_evidence_needs: evidenceNeeds.length,
    output_sha256: {
      discrepancy_csv: fileSha256(outputRegisterCsv),
      discrepancy_json: fileSha256(outputRegisterJson),
      sns_queue_v2_csv: fileSha256(outputQueueCsv),
      targeted_evidence_needs_csv: fileSha256(outputEvidenceNeedsCsv),
    },
  },
};
writeJson(outputExecutionQa, executionQa);

console.log(JSON.stringify({
  status: 'PASS',
  generated_at: generatedAt,
  external_discrepancy_coverage: registerDocument.coverage,
  physical_only_sns_queue: queueCounts,
  artifacts: [
    'outputs/derived/speed_2026_powerpro_discrepancy_register.csv',
    'outputs/derived/speed_2026_powerpro_discrepancy_register.json',
    'outputs/derived/speed_2026_sns_tiebreak_queue_v2.csv',
    'outputs/derived/speed_2026_targeted_additional_physical_evidence_needs.csv',
    'outputs/derived/speed_2026_agent_d_execution_qa.json',
  ],
}, null, 2));

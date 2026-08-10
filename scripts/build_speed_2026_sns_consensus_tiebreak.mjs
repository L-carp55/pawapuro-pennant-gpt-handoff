#!/usr/bin/env node
/**
 * Build the bounded 2026 NPB SNS / qualitative speed-consensus tie-break.
 *
 * This builder is evidence integration only. It never creates a final game
 * ability value, converts 50m / 30m into 90ft, uses PA as a score correction,
 * or uses PowerPro, Prospi, or MLB The Show as evidence.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const AS_OF = '2026-08-10';
const SCHEMA_VERSION = 'speed-2026-sns-consensus-tiebreak/v1.0.0';

const INPUTS = {
  packets: 'outputs/derived/speed_2026_100_anchor_relative_packets.json',
  queue: 'outputs/derived/speed_2026_100_sns_tiebreak_queue.csv',
  reviewedEvidence: 'data/manual/speed_2026_sns_consensus_reviewed_evidence_20260810.json'
};

const OUTPUTS = {
  rawCsv: 'data/normalized/speed_2026_sns_consensus_sources.csv',
  rawJson: 'data/normalized/speed_2026_sns_consensus_sources.json',
  consensusJson: 'outputs/derived/speed_2026_sns_tiebreak_consensus.json',
  consensusCsv: 'outputs/derived/speed_2026_sns_tiebreak_consensus.csv',
  postSns: 'outputs/derived/speed_2026_100_post_sns_decision_support.json',
  videoQueue: 'outputs/derived/speed_2026_video_tiebreak_queue.csv',
  audit: 'docs/audits/speed_2026_sns_consensus_tiebreak_20260810.md',
  qa: 'outputs/derived/speed_2026_sns_consensus_qa.json'
};

const CLASSIFICATIONS = new Set([
  'SUPPORTS_CURRENT_ORDINAL',
  'SUGGESTS_FASTER',
  'SUGGESTS_SLOWER',
  'TEMPORAL_CHANGE_SUPPORTED',
  'METRIC_CONSTRUCT_CONFLICT',
  'MIXED_CONSENSUS',
  'INSUFFICIENT_SNS_EVIDENCE'
]);

const CONSTRAINTS = new Set([
  'retain current band',
  'lean one band faster',
  'lean one band slower',
  'widen uncertainty',
  'historical conflict resolved directionally',
  'still unresolved'
]);

const SOURCE_COLUMNS = [
  'source_id',
  'player',
  'team',
  'source_platform',
  'source_class',
  'author_account',
  'source_title',
  'source_url',
  'post_date',
  'post_date_precision',
  'retrieved_at',
  'language',
  'source_year',
  'observation_period',
  'exact_observation_subject',
  'quote_excerpt',
  'paraphrased_claim',
  'directness',
  'independence_group',
  'evidence_strength',
  'supports_faster_current_slower_mixed',
  'temporal_relevance',
  'physical_speed_only',
  'is_repost',
  'is_syndicated_copy',
  'acceptance_status',
  'exclusion_reason'
];

const CONSENSUS_COLUMNS = [
  'player',
  'team',
  'packet_id',
  'case_type',
  'current_npb_plus_sprint_speed_kmh',
  'current_band',
  'reason_codes',
  'minimum_independent_source_count',
  'accepted_raw_source_count',
  'rejected_raw_source_count',
  'accepted_independent_source_count',
  'accepted_independent_sns_source_count',
  'strict_sns_minimum_met',
  'consensus_classification',
  'decision_constraint',
  'video_tiebreak_recommended',
  'weighted_evidence_reason',
  'short_reason',
  'accepted_source_record_ids',
  'rejected_source_record_ids'
];

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readText(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file)) throw new Error('Missing required input: ' + relativePath);
  return fs.readFileSync(file, 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function sha256File(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absolute(relativePath))).digest('hex');
}

function ensureParent(relativePath) {
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
}

function writeText(relativePath, text) {
  ensureParent(relativePath);
  const target = absolute(relativePath);
  const temp = target + '.tmp';
  fs.writeFileSync(temp, text, 'utf8');
  fs.renameSync(temp, target);
}

function writeJson(relativePath, value) {
  writeText(relativePath, JSON.stringify(value, null, 2) + '\n');
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/u.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

function writeCsv(relativePath, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  writeText(relativePath, lines.join('\n') + '\n');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/u, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field.replace(/\r$/u, ''));
  if (row.some((value) => value !== '')) rows.push(row);
  if (!rows.length) return [];
  const header = rows.shift();
  return rows.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}

function readCsv(relativePath) {
  return parseCsv(readText(relativePath));
}

function assert(condition, message) {
  if (!condition) throw new Error('BUILD_ASSERTION_FAILED: ' + message);
}

function countBy(rows, selector) {
  const result = {};
  for (const row of rows) {
    const raw = typeof selector === 'function' ? selector(row) : row[selector];
    const key = raw === null || raw === undefined || raw === '' ? 'NULL_OR_UNKNOWN' : String(raw);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right, 'ja')));
}

function unique(values) {
  return [...new Set(values)];
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function isPlausibleSourceYear(value) {
  return Number.isInteger(value) && value >= 1900 && value <= Number(AS_OF.slice(0, 4));
}

function sourceIsSocial(source) {
  return source.source_class === 'SNS';
}

function sourceIsAccepted(source) {
  return source.acceptance_status === 'ACCEPTED';
}

function sourceIsQualifying(source) {
  return sourceIsAccepted(source) && source.physical_speed_only === true;
}

function sourceDirectionCounts(sources) {
  const counts = { faster: 0, current: 0, slower: 0, mixed: 0, not_directional: 0 };
  for (const source of sources) {
    const direction = source.supports_faster_current_slower_mixed;
    counts[direction] = (counts[direction] ?? 0) + 1;
  }
  return counts;
}

function sourceHasForbiddenGameReference(source) {
  const text = [
    source.source_title,
    source.quote_excerpt,
    source.paraphrased_claim,
    source.exact_observation_subject
  ].join(' ').toLowerCase();
  return /パワプロ|プロスピ|powerpro|prospi|the show|game rating|ゲーム能力/u.test(text);
}

const packetRoot = readJson(INPUTS.packets);
const packets = packetRoot.packets;
const queue = readCsv(INPUTS.queue);
const reviewed = readJson(INPUTS.reviewedEvidence);

assert(Array.isArray(packets) && packets.length === 100, 'packet input must retain exactly 100 players');
assert(Array.isArray(queue) && queue.length === 19, 'canonical SNS queue must retain exactly 19 rows');
assert(Array.isArray(reviewed.sources), 'reviewed evidence must contain sources[]');
assert(Array.isArray(reviewed.decisions), 'reviewed evidence must contain decisions[]');

const packetByPlayer = new Map(packets.map((packet) => [packet.player, packet]));
const queueByPlayer = new Map(queue.map((row, index) => [row.player, { ...row, queue_index: index }]));
const queuePlayers = queue.map((row) => row.player);

assert(new Set(queuePlayers).size === 19, 'canonical SNS queue must have 19 unique players');
assert(queuePlayers.every((player) => packetByPlayer.has(player)), 'every canonical queue player must exist in packet input');

const sourceAllowedPlatforms = new Set(['X_TWITTER', 'BLUESKY', 'YOUTUBE', 'SPORTS_ARTICLE', 'PUBLIC_WEB_POST']);
const sourceAllowedClasses = new Set(['SNS', 'SUPPLEMENTAL_SPORTS_ARTICLE', 'REJECTED_CANDIDATE']);
const sourceAllowedStatus = new Set(['ACCEPTED', 'REJECTED']);
const sourceAllowedDirections = new Set(['faster', 'current', 'slower', 'mixed', 'not_directional']);
const prohibitedAcceptedDirectness = new Set([
  'documented_running_event',
  'qualitative_observation_of_running',
  'game_outcome_context',
  'home_to_first_outcome',
  'baserunning_outcome',
  'stolen_base_outcome',
  'same_event_measurement'
]);
const sourceRequiredFields = [
  'player',
  'source_platform',
  'source_class',
  'author_account',
  'source_title',
  'source_url',
  'retrieved_at',
  'language',
  'observation_period',
  'exact_observation_subject',
  'quote_excerpt',
  'paraphrased_claim',
  'directness',
  'independence_group',
  'evidence_strength',
  'supports_faster_current_slower_mixed',
  'temporal_relevance',
  'acceptance_status'
];

const sourceSeeds = reviewed.sources.map((seed) => ({ ...seed }));
for (const source of sourceSeeds) {
  for (const field of sourceRequiredFields) assert(isNonEmptyString(source[field]), 'source field missing: ' + field + ' for ' + String(source.player));
  assert(queueByPlayer.has(source.player), 'source is outside canonical 19-player queue: ' + source.player);
  assert(sourceAllowedPlatforms.has(source.source_platform), 'unsupported platform for ' + source.player);
  assert(sourceAllowedClasses.has(source.source_class), 'unsupported source class for ' + source.player);
  assert(sourceAllowedStatus.has(source.acceptance_status), 'unsupported acceptance status for ' + source.player);
  assert(sourceAllowedDirections.has(source.supports_faster_current_slower_mixed), 'unsupported source direction for ' + source.player);
  assert(/^https?:\/\//u.test(source.source_url), 'source URL must be http(s) for ' + source.player);
  assert(source.post_date === null || source.post_date === undefined || isIsoDate(source.post_date), 'post date must be YYYY-MM-DD or null for ' + source.player);
  assert(isIsoDate(source.retrieved_at), 'retrieved date must be YYYY-MM-DD for ' + source.player);
  const sourceYear = source.source_year ?? (isIsoDate(source.post_date) ? Number(source.post_date.slice(0, 4)) : null);
  assert(isPlausibleSourceYear(sourceYear), 'source year must be explicit even when post date is unavailable for ' + source.player);
  if (isIsoDate(source.post_date)) assert(Number(source.post_date.slice(0, 4)) === sourceYear, 'source year and post date disagree for ' + source.player);
  if (!isIsoDate(source.post_date)) assert(isNonEmptyString(source.post_date_precision), 'missing post_date_precision for a source with unavailable day-level date: ' + source.player);
  assert(typeof source.physical_speed_only === 'boolean', 'physical_speed_only must be boolean for ' + source.player);
  assert(typeof source.is_repost === 'boolean', 'is_repost must be boolean for ' + source.player);
  assert(typeof source.is_syndicated_copy === 'boolean', 'is_syndicated_copy must be boolean for ' + source.player);
  if (sourceIsAccepted(source)) {
    assert(source.physical_speed_only, 'accepted source is not physical-speed-only for ' + source.player);
    assert(!source.is_repost, 'accepted repost is prohibited for ' + source.player);
    assert(!source.is_syndicated_copy, 'accepted syndicated copy is prohibited for ' + source.player);
    assert(source.source_class !== 'REJECTED_CANDIDATE', 'accepted source cannot be rejected candidate for ' + source.player);
    assert(!prohibitedAcceptedDirectness.has(source.directness), 'accepted source is a game-result or baserunning construct for ' + source.player);
    assert(!sourceHasForbiddenGameReference(source), 'accepted source contains a forbidden game-rating reference for ' + source.player);
  } else {
    assert(isNonEmptyString(source.exclusion_reason), 'rejected source needs exclusion_reason for ' + source.player);
  }
}

sourceSeeds.sort((left, right) => (
  queueByPlayer.get(left.player).queue_index - queueByPlayer.get(right.player).queue_index
  || left.source_url.localeCompare(right.source_url)
  || left.author_account.localeCompare(right.author_account)
));

const sources = sourceSeeds.map((source, index) => ({
  source_id: 'SNSR' + String(index + 1).padStart(3, '0'),
  team: packetByPlayer.get(source.player).team,
  source_year: source.source_year ?? Number(source.post_date.slice(0, 4)),
  post_date: source.post_date ?? null,
  post_date_precision: source.post_date_precision ?? 'DAY',
  exclusion_reason: source.exclusion_reason ?? null,
  ...source
}));

const decisionByPlayer = new Map();
for (const decision of reviewed.decisions) {
  assert(isNonEmptyString(decision.player), 'decision missing player');
  assert(queueByPlayer.has(decision.player), 'decision is outside canonical 19-player queue: ' + decision.player);
  assert(!decisionByPlayer.has(decision.player), 'duplicate decision for ' + decision.player);
  assert(CLASSIFICATIONS.has(decision.consensus_classification), 'invalid consensus classification for ' + decision.player);
  assert(CONSTRAINTS.has(decision.decision_constraint), 'invalid decision constraint for ' + decision.player);
  assert(typeof decision.video_tiebreak_recommended === 'boolean', 'video flag must be boolean for ' + decision.player);
  assert(isNonEmptyString(decision.weighted_evidence_reason), 'weighted evidence reason missing for ' + decision.player);
  assert(isNonEmptyString(decision.short_reason), 'short reason missing for ' + decision.player);
  decisionByPlayer.set(decision.player, { ...decision });
}

assert(decisionByPlayer.size === 19, 'exactly one decision is required for every canonical queue player');
assert(queuePlayers.every((player) => decisionByPlayer.has(player)), 'every canonical queue player needs a decision');

const consensus = queue.map((queueRow) => {
  const player = queueRow.player;
  const packet = packetByPlayer.get(player);
  const decision = decisionByPlayer.get(player);
  const playerSources = sources.filter((source) => source.player === player);
  const accepted = playerSources.filter(sourceIsQualifying);
  const rejected = playerSources.filter((source) => !sourceIsQualifying(source));
  const acceptedGroups = unique(accepted.map((source) => source.independence_group));
  const acceptedSocialGroups = unique(accepted
    .filter(sourceIsSocial)
    .map((source) => source.independence_group));
  const minimum = Number(queueRow.minimum_independent_source_count);
  const type = String(queueRow.reason_codes).includes('COHORT_ORDER_CONFLICT_WITH_CURRENT_NPB_ORDINAL')
    ? 'TYPE_B_PHYSICAL_ORDER_CONFLICT'
    : 'TYPE_A_CURRENT_SAMPLE_INSTABILITY';
  const directions = sourceDirectionCounts(accepted);
  const strictSnsMinimumMet = acceptedSocialGroups.length >= minimum;
  const totalMinimumMet = acceptedGroups.length >= minimum;

  if (decision.consensus_classification === 'INSUFFICIENT_SNS_EVIDENCE') {
    assert(!strictSnsMinimumMet, 'INSUFFICIENT_SNS_EVIDENCE cannot claim a satisfied strict SNS minimum for ' + player);
    assert(
      decision.decision_constraint === 'widen uncertainty' || decision.decision_constraint === 'still unresolved',
      'insufficient SNS evidence must not force a directional constraint for ' + player
    );
  }
  if (['SUPPORTS_CURRENT_ORDINAL', 'SUGGESTS_FASTER', 'SUGGESTS_SLOWER', 'TEMPORAL_CHANGE_SUPPORTED', 'MIXED_CONSENSUS'].includes(decision.consensus_classification)) {
    assert(strictSnsMinimumMet, 'directional or mixed classification requires independent SNS minimum for ' + player);
  }
  if (decision.consensus_classification === 'SUGGESTS_FASTER') {
    assert(directions.faster > directions.slower, 'faster classification must have a faster directional plurality for ' + player);
  }
  if (decision.consensus_classification === 'SUGGESTS_SLOWER') {
    assert(directions.slower > directions.faster, 'slower classification must have a slower directional plurality for ' + player);
  }
  if (decision.consensus_classification === 'MIXED_CONSENSUS') {
    assert(directions.faster > 0 && directions.slower > 0, 'mixed classification needs both faster and slower evidence for ' + player);
    assert(decision.video_tiebreak_recommended, 'mixed consensus must recommend a video tie-break for ' + player);
  }
  if (decision.consensus_classification === 'METRIC_CONSTRUCT_CONFLICT') {
    assert(type === 'TYPE_B_PHYSICAL_ORDER_CONFLICT', 'metric construct conflict must be a Type B case for ' + player);
    assert(totalMinimumMet, 'metric construct conflict needs at least the full independent minimum for ' + player);
    assert(decision.video_tiebreak_recommended, 'metric construct conflict must recommend a video tie-break for ' + player);
  }
  if (decision.consensus_classification === 'INSUFFICIENT_SNS_EVIDENCE') {
    assert(decision.video_tiebreak_recommended, 'insufficient SNS evidence must recommend a video tie-break for ' + player);
  }

  return {
    player,
    team: queueRow.team,
    packet_id: packet.packet_id,
    case_type: type,
    current_npb_plus_sprint_speed_kmh: Number(queueRow.current_npb_plus_sprint_speed_kmh),
    current_band: queueRow.current_band,
    reason_codes: queueRow.reason_codes,
    confirmation_target: queueRow.confirmation_target,
    decision_hypothesis: queueRow.decision_hypothesis,
    comparison_anchors: JSON.parse(queueRow.comparison_anchors),
    recommended_period: queueRow.recommended_period,
    minimum_independent_source_count: minimum,
    all_source_record_ids: playerSources.map((source) => source.source_id),
    accepted_source_record_ids: accepted.map((source) => source.source_id),
    rejected_source_record_ids: rejected.map((source) => source.source_id),
    accepted_raw_source_count: accepted.length,
    rejected_raw_source_count: rejected.length,
    accepted_independent_source_count: acceptedGroups.length,
    accepted_independent_sns_source_count: acceptedSocialGroups.length,
    strict_sns_minimum_met: strictSnsMinimumMet,
    full_source_minimum_met: totalMinimumMet,
    source_evidence_status: strictSnsMinimumMet ? 'STRICT_SNS_MINIMUM_MET' : 'INSUFFICIENT_SNS_EVIDENCE',
    direction_counts: directions,
    consensus_classification: decision.consensus_classification,
    decision_constraint: decision.decision_constraint,
    video_tiebreak_recommended: decision.video_tiebreak_recommended,
    weighted_evidence_reason: decision.weighted_evidence_reason,
    short_reason: decision.short_reason,
    limitations: decision.limitations ?? 'SNS and public-web collection is directional evidence only. It is not a numerical speed conversion or a final game ability value.'
  };
});

const consensusByPlayer = new Map(consensus.map((row) => [row.player, row]));
const videoQueueRows = consensus
  .filter((row) => row.video_tiebreak_recommended)
  .map((row) => ({
    player: row.player,
    team: row.team,
    packet_id: row.packet_id,
    case_type: row.case_type,
    consensus_classification: row.consensus_classification,
    decision_constraint: row.decision_constraint,
    reason: row.short_reason,
    accepted_independent_sns_source_count: row.accepted_independent_sns_source_count,
    minimum_independent_source_count: row.minimum_independent_source_count,
    comparison_anchors: row.comparison_anchors
  }));

const postSnsPlayers = packets.map((packet) => {
  const isSnsTarget = consensusByPlayer.has(packet.player);
  return {
    packet_id: packet.packet_id,
    player: packet.player,
    player_id: packet.player_id,
    team: packet.team,
    target_season: packet.target_season,
    source_lane: isSnsTarget ? 'SNS_TIEBREAK' : 'NON_SNS_BASELINE',
    base_anchor_status: packet.status,
    base_anchor_status_reasons: packet.status_reasons,
    current_npb_plus_anchor: packet.current_npb_plus_anchor,
    faster_anchor: packet.faster_anchor,
    slower_anchor: packet.slower_anchor,
    same_band_anchors: packet.same_band_anchors,
    exposure_receipt: packet.exposure_receipt,
    sns_tiebreak_consensus: isSnsTarget ? consensusByPlayer.get(packet.player) : null,
    decision_support_boundary: isSnsTarget
      ? 'SNS result is an ordinal constraint only; no final game ability value is generated.'
      : 'Retained unchanged from the pre-existing non-SNS anchor-relative packet; this bounded task did not research this player.'
  };
});

assert(postSnsPlayers.length === 100, 'post-SNS decision support must retain 100 players');
assert(postSnsPlayers.filter((row) => row.source_lane === 'SNS_TIEBREAK').length === 19, 'post-SNS support must contain 19 SNS target rows');
assert(postSnsPlayers.filter((row) => row.source_lane === 'NON_SNS_BASELINE').length === 81, 'post-SNS support must contain 81 non-SNS rows');

const internalChecks = [];
function addCheck(name, passed, detail) {
  internalChecks.push({ name, passed: Boolean(passed), detail });
}

const acceptedSources = sources.filter(sourceIsQualifying);
const socialPlatforms = new Set(['X_TWITTER', 'BLUESKY', 'YOUTUBE', 'PUBLIC_WEB_POST']);
const acceptedSocialPlatformSources = acceptedSources.filter((source) => socialPlatforms.has(source.source_platform));
const rejectedSocialPlatformSources = sources.filter((source) => !sourceIsQualifying(source) && socialPlatforms.has(source.source_platform));
const acceptedGroupKeys = acceptedSources.map((source) => source.player + '|' + source.independence_group);
const acceptedUrls = acceptedSources.map((source) => source.source_url);
const nonInsufficientRows = consensus.filter((row) => !['INSUFFICIENT_SNS_EVIDENCE', 'METRIC_CONSTRUCT_CONFLICT'].includes(row.consensus_classification));
const serializedNoRatings = JSON.stringify({ consensus, postSnsPlayers, videoQueueRows });

addCheck('canonical_target_exactly_19', consensus.length === 19 && unique(consensus.map((row) => row.player)).length === 19, 'consensus=' + consensus.length);
addCheck('canonical_target_matches_queue', queuePlayers.every((player) => consensusByPlayer.has(player)), 'queue and consensus player sets are identical');
addCheck('minimum_source_requirement_handled', consensus.every((row) => row.strict_sns_minimum_met || row.consensus_classification === 'INSUFFICIENT_SNS_EVIDENCE' || row.consensus_classification === 'METRIC_CONSTRUCT_CONFLICT'), 'all records either meet the strict SNS threshold or retain a constrained exception');
addCheck('no_accepted_reposts', acceptedSources.every((source) => !source.is_repost), 'accepted=' + acceptedSources.length);
addCheck('no_accepted_syndicated_copies', acceptedSources.every((source) => !source.is_syndicated_copy), 'accepted=' + acceptedSources.length);
addCheck('one_accepted_vote_per_player_origin', unique(acceptedGroupKeys).length === acceptedGroupKeys.length, 'accepted groups=' + acceptedGroupKeys.length);
addCheck('no_duplicate_accepted_source_urls', unique(acceptedUrls).length === acceptedUrls.length, 'accepted urls=' + acceptedUrls.length);
addCheck('accepted_sources_are_physical_speed_only', acceptedSources.every((source) => source.physical_speed_only), 'accepted=' + acceptedSources.length);
addCheck('no_accepted_game_or_baserunning_construct', acceptedSources.every((source) => !prohibitedAcceptedDirectness.has(source.directness)), 'accepted=' + acceptedSources.length);
addCheck('no_game_rating_input_in_accepted_sources', acceptedSources.every((source) => !sourceHasForbiddenGameReference(source)), 'accepted=' + acceptedSources.length);
addCheck('all_source_dates_and_periods_saved', sources.every((source) => (isIsoDate(source.post_date) || (source.post_date === null && isNonEmptyString(source.post_date_precision))) && isIsoDate(source.retrieved_at) && isNonEmptyString(source.observation_period)), 'sources=' + sources.length + '; unavailable day-level dates retain explicit precision');
addCheck('current_and_historical_are_explicit', sources.every((source) => Number.isInteger(source.source_year) && isNonEmptyString(source.temporal_relevance)), 'sources=' + sources.length);
addCheck('type_a_type_b_alignment', consensus.every((row) => row.case_type === 'TYPE_A_CURRENT_SAMPLE_INSTABILITY' || row.case_type === 'TYPE_B_PHYSICAL_ORDER_CONFLICT'), 'all 19 cases classified');
addCheck('no_final_speed_rating_generated', !/final_rating|speed_rating|game_rating|ability_value|走力査定/u.test(serializedNoRatings), 'decision-support output has ordinal constraints only');
addCheck('directional_classifications_match_raw_direction', consensus.every((row) => {
  if (row.consensus_classification === 'SUGGESTS_FASTER') return row.direction_counts.faster > row.direction_counts.slower;
  if (row.consensus_classification === 'SUGGESTS_SLOWER') return row.direction_counts.slower > row.direction_counts.faster;
  if (row.consensus_classification === 'MIXED_CONSENSUS') return row.direction_counts.faster > 0 && row.direction_counts.slower > 0;
  return true;
}), 'directional decisions are reconciled to raw accepted-source directions');
addCheck('insufficient_not_forced_directional', consensus.filter((row) => row.consensus_classification === 'INSUFFICIENT_SNS_EVIDENCE').every((row) => row.decision_constraint === 'widen uncertainty' || row.decision_constraint === 'still unresolved'), 'insufficient cases preserve uncertainty');
addCheck('all_urls_preserved', sources.every((source) => /^https?:\/\//u.test(source.source_url)), 'sources=' + sources.length);
addCheck('post_sns_support_100_of_100', postSnsPlayers.length === 100 && unique(postSnsPlayers.map((row) => row.player)).length === 100, 'players=' + postSnsPlayers.length);
addCheck('post_sns_lane_counts_81_19', postSnsPlayers.filter((row) => row.source_lane === 'NON_SNS_BASELINE').length === 81 && postSnsPlayers.filter((row) => row.source_lane === 'SNS_TIEBREAK').length === 19, '81 non-SNS and 19 SNS');
addCheck('video_queue_matches_flags', videoQueueRows.length === consensus.filter((row) => row.video_tiebreak_recommended).length, 'video=' + videoQueueRows.length);
addCheck('reproducible_input_fingerprints_present', [INPUTS.packets, INPUTS.queue, INPUTS.reviewedEvidence].every((input) => /^[a-f0-9]{64}$/u.test(sha256File(input))), 'all input SHA-256 values computed');

const internalPassed = internalChecks.every((check) => check.passed);
assert(internalPassed, 'internal QA failed: ' + internalChecks.filter((check) => !check.passed).map((check) => check.name).join(', '));

const independentReview = reviewed.independent_review && typeof reviewed.independent_review === 'object'
  ? reviewed.independent_review
  : {
      status: 'PENDING',
      reviewer: 'not yet performed',
      checks: [],
      summary: 'Independent QA must inspect the generated artifacts before publication.'
    };
assert(['PENDING', 'PASS', 'FAIL'].includes(independentReview.status), 'independent review status must be PENDING, PASS, or FAIL');

const classificationCounts = countBy(consensus, 'consensus_classification');
const sourceLedger = {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  purpose: 'Raw public SNS and qualitative source ledger for only the canonical 19-player speed tie-break queue. Accepted sources are physical-speed-only; rejected candidates remain with reasons.',
  source_policy: {
    primary: ['independent X/Twitter', 'Bluesky or other public SNS', 'public YouTube post or comment with a concrete speed observation', 'player/team/reporter public SNS'],
    supplemental_only_when_sns_insufficient: 'contemporaneous independent sports article or interview',
    independence_rule: 'unique observer / unique origin',
    prohibited: ['steal skill', 'lead or start judgment', 'baserunning judgment', 'game ratings', 'PowerPro', 'Prospi', 'MLB The Show']
  },
  source_records: sources
};

const consensusArtifact = {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  target_scope: {
    canonical_queue: INPUTS.queue,
    player_count: 19,
    restriction: 'No player outside the canonical SNS_TIEBREAK queue is researched or assigned a new consensus.'
  },
  source_ledger: {
    path_json: OUTPUTS.rawJson,
    path_csv: OUTPUTS.rawCsv,
    accepted_raw_source_count: acceptedSources.length,
    rejected_raw_source_count: sources.length - acceptedSources.length,
    accepted_sns_platform_source_count: acceptedSocialPlatformSources.length,
    rejected_sns_platform_source_count: rejectedSocialPlatformSources.length,
    accepted_platform_counts: countBy(acceptedSources, 'source_platform'),
    accepted_source_class_counts: countBy(acceptedSources, 'source_class'),
    source_year_counts: countBy(sources, 'source_year')
  },
  consensus
};

const postSnsArtifact = {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  purpose: '100-player decision support after bounded SNS tie-break integration. This is not a final game-rating output.',
  counts: {
    total_players: postSnsPlayers.length,
    non_sns_baseline: postSnsPlayers.filter((row) => row.source_lane === 'NON_SNS_BASELINE').length,
    sns_tiebreak: postSnsPlayers.filter((row) => row.source_lane === 'SNS_TIEBREAK').length
  },
  source_inputs: {
    packets: INPUTS.packets,
    packets_sha256: sha256File(INPUTS.packets),
    canonical_queue: INPUTS.queue,
    queue_sha256: sha256File(INPUTS.queue),
    reviewed_evidence: INPUTS.reviewedEvidence,
    reviewed_evidence_sha256: sha256File(INPUTS.reviewedEvidence),
    builder: 'scripts/build_speed_2026_sns_consensus_tiebreak.mjs',
    builder_sha256: sha256File('scripts/build_speed_2026_sns_consensus_tiebreak.mjs')
  },
  players: postSnsPlayers
};

const qa = {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  independent: false,
  passed: internalPassed && independentReview.status === 'PASS',
  internal: {
    passed: internalPassed,
    checks: internalChecks
  },
  independent_review: independentReview,
  counts: {
    canonical_targets: consensus.length,
    accepted_raw_sources: acceptedSources.length,
    rejected_raw_sources: sources.length - acceptedSources.length,
    accepted_sns_platform_sources: acceptedSocialPlatformSources.length,
    rejected_sns_platform_sources: rejectedSocialPlatformSources.length,
    accepted_independent_source_2_or_more: consensus.filter((row) => row.accepted_independent_source_count >= 2).length,
    accepted_independent_source_3_or_more: consensus.filter((row) => row.accepted_independent_source_count >= 3).length,
    accepted_independent_sns_source_2_or_more: consensus.filter((row) => row.accepted_independent_sns_source_count >= 2).length,
    classification_counts: classificationCounts,
    video_tiebreak_recommended: videoQueueRows.length
  },
  reproducibility: {
    inputs: {
      packets: { path: INPUTS.packets, sha256: sha256File(INPUTS.packets) },
      queue: { path: INPUTS.queue, sha256: sha256File(INPUTS.queue) },
      reviewed_evidence: { path: INPUTS.reviewedEvidence, sha256: sha256File(INPUTS.reviewedEvidence) }
    },
    builder: {
      path: 'scripts/build_speed_2026_sns_consensus_tiebreak.mjs',
      sha256: sha256File('scripts/build_speed_2026_sns_consensus_tiebreak.mjs')
    },
    deterministic_order: 'canonical queue order for player outputs; queue order then URL then author for source records'
  }
};

const auditLines = [
  '# 2026 NPB 走力 SNS Consensus Tie-break',
  '',
  '## 範囲と結論',
  '',
  'Historical High-Confidence Anchor BankでSNS_TIEBREAKとなったcanonical 19人だけを再確認した。SNS・定性根拠はordinal constraintだけに使い、最終走力値、50m/30mから90ftへの換算、年齢の固定減衰、盗塁・走塁技術、ゲーム能力値は一切使っていない。',
  '',
  '## カバレッジ',
  '',
  '- SNS target: ' + consensus.length + '/19',
  '- 100-player decision support: ' + postSnsPlayers.length + '/100 (81 non-SNS baseline + 19 SNS tie-break)',
  '- accepted raw source: ' + acceptedSources.length,
  '- rejected source: ' + (sources.length - acceptedSources.length),
  '- accepted SNS-platform source: ' + acceptedSocialPlatformSources.length,
  '- rejected SNS-platform source: ' + rejectedSocialPlatformSources.length,
  '- accepted source platform counts: ' + JSON.stringify(countBy(acceptedSources, 'source_platform')),
  '- all source year counts: ' + JSON.stringify(countBy(sources, 'source_year')),
  '- independent accepted source >=2: ' + consensus.filter((row) => row.accepted_independent_source_count >= 2).length,
  '- independent accepted source >=3: ' + consensus.filter((row) => row.accepted_independent_source_count >= 3).length,
  '- independent SNS source >=2: ' + consensus.filter((row) => row.accepted_independent_sns_source_count >= 2).length,
  '- classification counts: ' + JSON.stringify(classificationCounts),
  '- VIDEO_TIEBREAK_RECOMMENDED: ' + videoQueueRows.length,
  '',
  '## 19人の結論',
  ''
];

for (const row of consensus) {
  auditLines.push('- ' + row.player + ' (' + row.case_type + '): ' + row.consensus_classification + ' / ' + row.decision_constraint + '。' + row.short_reason);
}

auditLines.push(
  '',
  '## ソース上の制約',
  '',
  '- X/Twitterは公開検索画面が安定して取得できず、Blueskyもこの実行環境では閲覧接続が成立しなかった。したがって、SNS本文を確認できないものを推測で票にしていない。',
  '- スポーツ記事はSNS不足時の補助sourceとしてのみ明示区別した。記事だけの集積をSNS consensusとは呼んでいない。',
  '- 2026、2025、2024を優先し、Type Bの測定差だけは測定時代の直接資料を残した。古い投稿・資料は2026 current abilityを自動的に決める根拠ではない。',
  '- SNSで見つからなかったことは、遅い、またはcurrent NPB+が正しいという証拠ではない。',
  '',
  '## 棄却した証拠の扱い',
  '',
  '- repost、転載、同一origin、盗塁・走塁判断、game rating、physical speedを直接示さない記事は独立票に数えない。',
  '- rejected source records remain in the raw ledger with exclusion_reason so that the negative finding is reproducible.',
  '',
  '## QA',
  '',
  '- internal QA: ' + (qa.internal.passed ? 'PASS' : 'FAIL') + ' (' + qa.internal.checks.length + ' checks)',
  '- independent QA: ' + independentReview.status,
  '- publication QA status: ' + (qa.passed ? 'PASS' : 'PENDING_OR_FAIL'),
  '',
  '## 成果物',
  '',
  '- ' + OUTPUTS.rawCsv,
  '- ' + OUTPUTS.rawJson,
  '- ' + OUTPUTS.consensusJson,
  '- ' + OUTPUTS.consensusCsv,
  '- ' + OUTPUTS.postSns,
  '- ' + OUTPUTS.videoQueue,
  '- ' + OUTPUTS.qa
);

writeJson(OUTPUTS.rawJson, sourceLedger);
writeCsv(OUTPUTS.rawCsv, sources, SOURCE_COLUMNS);
writeJson(OUTPUTS.consensusJson, consensusArtifact);
writeCsv(OUTPUTS.consensusCsv, consensus, CONSENSUS_COLUMNS);
writeJson(OUTPUTS.postSns, postSnsArtifact);
writeCsv(OUTPUTS.videoQueue, videoQueueRows, [
  'player',
  'team',
  'packet_id',
  'case_type',
  'consensus_classification',
  'decision_constraint',
  'reason',
  'accepted_independent_sns_source_count',
  'minimum_independent_source_count',
  'comparison_anchors'
]);
writeJson(OUTPUTS.qa, qa);
writeText(OUTPUTS.audit, auditLines.join('\n') + '\n');

console.log(JSON.stringify({
  status: 'ok',
  canonical_targets: consensus.length,
  accepted_raw_sources: acceptedSources.length,
  rejected_raw_sources: sources.length - acceptedSources.length,
  classification_counts: classificationCounts,
  video_tiebreak_recommended: videoQueueRows.length,
  internal_qa_passed: internalPassed,
  independent_qa_status: independentReview.status,
  publication_qa_passed: qa.passed
}, null, 2));

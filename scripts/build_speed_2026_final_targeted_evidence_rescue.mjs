#!/usr/bin/env node
/**
 * Deterministically builds the 2026 final targeted-evidence rescue artifacts.
 *
 * This script deliberately keeps the pre-existing 100-player decision-support
 * records byte-for-byte semantically unchanged.  New conclusions are carried in
 * separate overlays; no PowerPro value, cross-metric conversion, age adjustment,
 * or numeric game rating is created here.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AS_OF = '2026-08-11';
const ROOT = process.cwd();

const INPUT = {
  postSnsSupport: 'outputs/derived/speed_2026_100_post_sns_decision_support.json',
  anchorPackets: 'outputs/derived/speed_2026_100_anchor_relative_packets.json',
  snsV2: 'outputs/derived/speed_2026_sns_tiebreak_consensus_v2.json',
  existingSnsLedger: 'data/normalized/speed_2026_sns_consensus_sources_v2.json',
  historicalPhysical: 'data/normalized/speed_historical_physical_measurements_2015_2026.json',
  anchorBank: 'outputs/derived/speed_high_confidence_anchor_bank_2015_2026.json',
  residualScope: 'outputs/derived/speed_2026_targeted_additional_physical_evidence_needs.csv',
  old12Physical: 'data/manual/speed_2026_old12_current_physical_research_20260811.json',
  new6Physical: 'data/manual/speed_2026_new6_current_physical_and_t90_provenance_research_20260811.json',
  new6GrokResearch: 'data/manual/speed_2026_new6_grok_x_temporal_research_20260811.json'
};

const OUTPUT = {
  physicalJson: 'data/normalized/speed_2026_final_targeted_physical_evidence.json',
  physicalCsv: 'data/normalized/speed_2026_final_targeted_physical_evidence.csv',
  grokSources: 'data/normalized/speed_2026_new6_grok_x_temporal_sources.json',
  packets: 'outputs/derived/speed_2026_final_targeted_evidence_packets.json',
  resolutionCsv: 'outputs/derived/speed_2026_final_targeted_evidence_resolution.csv',
  videoQueue: 'outputs/derived/speed_2026_final_video_tiebreak_queue.csv',
  preVideoSupport: 'outputs/derived/speed_2026_100_pre_video_decision_support.json',
  audit: 'docs/audits/speed_2026_final_targeted_evidence_rescue.md'
};

function abs(path) { return resolve(ROOT, path); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function sha256(path) { return createHash('sha256').update(readFileSync(abs(path))).digest('hex'); }
function writeText(path, text) {
  const destination = abs(path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text, 'utf8');
}
function writeJson(path, data) { writeText(path, `${JSON.stringify(data, null, 2)}\n`); }
function nameKey(value) { return String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/gu, ''); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function oneLine(value) { return String(value ?? '').replace(/[\r\n]+/gu, ' ').replace(/\s+/gu, ' ').trim(); }
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}
function writeCsv(path, rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(','));
  writeText(path, `${lines.join('\r\n')}\r\n`);
}
function countBy(values) {
  return values.reduce((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}
function unique(values) { return [...new Set(values)]; }
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ',') { row.push(cell); cell = ''; }
    else if (character === '\n') { row.push(cell.replace(/\r$/u, '')); rows.push(row); row = []; cell = ''; }
    else cell += character;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/u, '')); rows.push(row); }
  const [headers, ...body] = rows;
  return body.filter((fields) => fields.some((field) => field !== '')).map((fields) => Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ''])));
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function compactEvidence(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(compactEvidence);
  if (typeof value !== 'object') return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (['source_payload', 'raw_response_text', 'stderr', 'returned_contexts'].includes(key)) continue;
    output[key] = compactEvidence(entry);
  }
  return output;
}
function normaliseCurrentHistorical(value) {
  const text = String(value ?? 'UNKNOWN');
  if (/^HISTORICAL_202[456]$/u.test(text)) return text.replace(/^HISTORICAL_/u, 'CURRENT_WINDOW_');
  return text;
}
function directT90StatusFor(player, t90Audit) {
  const playerKey = nameKey(player);
  if (nameKey(t90Audit.tsutsugo_explicit_verdict?.player) === playerKey) {
    return compactEvidence(t90Audit.tsutsugo_explicit_verdict);
  }
  const match = (t90Audit.other_five_spot_checks ?? []).find((record) => nameKey(record.player) === playerKey);
  return match ? compactEvidence(match) : {
    direct_t90_status: 'NOT_REVALIDATED_IN_FINAL_NEW6_T90_AUDIT',
    note: 'The explicit live T90 provenance audit was deliberately scoped to the six additional canonical players.'
  };
}
function oldPhysicalSummary(record) {
  if (!record) return { status: 'NOT_RESEARCHED_IN_THIS_PHASE', evidence: [], negative_finding: null };
  return {
    status: record.status,
    accepted_evidence: compactEvidence(record.accepted_evidence ?? []),
    rejected_candidate_count: (record.candidate_sources ?? []).length,
    search_route_count: (record.search_routes ?? []).length,
    negative_finding: record.negative_finding ?? null
  };
}
function newPhysicalSummary(record) {
  if (!record) return { status: 'NOT_RESEARCHED_IN_THIS_PHASE', current_physical_evidence: null, negative_finding: null };
  return {
    status: record.current_physical_status,
    current_physical_evidence: compactEvidence(record.accepted_current_candidate),
    rejected_candidate_count: (record.rejected_candidates ?? []).length,
    negative_finding: record.negative_finding ?? null
  };
}
function existingClassificationToResolution(classification) {
  const mapping = {
    SUPPORTS_CURRENT_ORDINAL: 'RESOLVED_CURRENT_ORDINAL',
    TEMPORAL_CHANGE_SUPPORTED: 'RESOLVED_TEMPORAL_CHANGE',
    METRIC_CONSTRUCT_CONFLICT: 'METRIC_CONSTRUCT_CONFLICT_REMAINS',
    MIXED_CONSENSUS: 'MIXED_EVIDENCE_REMAINS',
    INSUFFICIENT_SNS_EVIDENCE: 'INSUFFICIENT_EVIDENCE_REMAINS'
  };
  return mapping[classification] ?? 'INSUFFICIENT_EVIDENCE_REMAINS';
}
function resolutionNeedsVideo(classification) {
  return ['METRIC_CONSTRUCT_CONFLICT_REMAINS', 'MIXED_EVIDENCE_REMAINS', 'INSUFFICIENT_EVIDENCE_REMAINS'].includes(classification);
}
function normaliseGrokCandidate(candidate, index, receiptById) {
  const sourceId = candidate.source_id ?? candidate.id ?? `N6GXS${String(index + 1).padStart(3, '0')}`;
  const xPostId = String(candidate.x_post_id ?? candidate.post_id ?? candidate.id_on_x ?? '');
  const postUrl = candidate.post_url ?? candidate.x_post_url ?? null;
  const receiptIds = unique([
    ...(candidate.receipt_ids ?? []),
    candidate.receipt_id,
    candidate.grok_x_search_receipt,
    candidate.grok_x_search_receipt_id
  ].filter(Boolean));
  const receipt = receiptIds.map((id) => receiptById.get(id)).find(Boolean) ?? null;
  return {
    source_id: sourceId,
    player: candidate.player,
    player_key: nameKey(candidate.player),
    x_post_id: xPostId,
    post_id: xPostId,
    post_url: postUrl,
    author: candidate.author ?? candidate.author_handle ?? candidate.author_handle_from_url ?? null,
    author_id: candidate.author_id ?? null,
    posted_at: candidate.posted_at ?? null,
    query: candidate.query ?? receipt?.query ?? null,
    retrieved_at: candidate.retrieved_at ?? receipt?.retrieved_at ?? null,
    text_or_minimal_excerpt: candidate.text_or_minimal_excerpt ?? candidate.text_or_excerpt ?? candidate.text ?? candidate.minimal_excerpt ?? candidate.excerpt ?? null,
    paraphrased_physical_speed_claim: candidate.paraphrased_physical_speed_claim ?? candidate.physical_speed_claim ?? candidate.claim ?? null,
    current_or_historical: normaliseCurrentHistorical(candidate.current_or_historical ?? candidate.temporal_status ?? null),
    evidence_direction: candidate.evidence_direction ?? candidate.direction ?? 'NON_DIRECTIONAL',
    directness: candidate.directness ?? 'UNSPECIFIED',
    evidence_strength: candidate.evidence_strength ?? candidate.strength ?? 'UNSPECIFIED',
    independence_group: candidate.independence_group ?? null,
    source_origin: candidate.source_origin ?? null,
    physical_speed_only: candidate.physical_speed_only !== false,
    accepted: Boolean(candidate.accepted),
    rejected: Boolean(candidate.rejected ?? !candidate.accepted),
    accepted_for_classification: Boolean(candidate.accepted_for_classification),
    qualifies_for_strict_consensus: Boolean(candidate.qualifies_for_strict_consensus),
    rejection_reason: candidate.rejection_reason ?? (candidate.accepted ? null : 'NOT_ACCEPTED_BY_REVIEW'),
    inaccessible_or_deleted: Boolean(candidate.inaccessible_or_deleted),
    grok_x_search_receipt_ids: receiptIds,
    grok_x_search_provenance: candidate.grok_x_search_provenance ?? candidate.grok_x_search_receipt_or_provenance ?? 'GROK_X_SUPPLEMENT',
    grok_x_search_receipt_or_provenance: candidate.grok_x_search_receipt_or_provenance ?? { provenance: 'GROK_X_SUPPLEMENT', receipt_ids: receiptIds }
  };
}
function sourceRecordIsUsableForResolution(record) {
  return record.accepted
    && record.accepted_for_classification
    && record.qualifies_for_strict_consensus
    && !record.inaccessible_or_deleted
    && /^\d+$/u.test(record.x_post_id)
    && Boolean(record.post_url)
    && record.post_url.includes(record.x_post_id)
    && record.grok_x_search_receipt_ids.length > 0;
}
function acceptedGrokResult(playerResult, sourceRecords) {
  const records = sourceRecords.filter((record) => nameKey(record.player) === nameKey(playerResult.player));
  const strictGroups = unique(records.filter(sourceRecordIsUsableForResolution).map((record) => record.independence_group || `post:${record.x_post_id}`));
  const declaredQualifying = Number(playerResult.independent_qualifying_x_count ?? playerResult.qualifying_independent_x_count ?? 0);
  const qualifyingCount = Math.min(declaredQualifying, strictGroups.length);
  const proposed = playerResult.proposed_final_classification
    ?? playerResult.proposed_classification
    ?? playerResult.temporal_ordinal_constraint
    ?? 'INSUFFICIENT_EVIDENCE_REMAINS';
  let resolution = 'INSUFFICIENT_EVIDENCE_REMAINS';
  if (qualifyingCount >= 2 && ['RESOLVED_CURRENT_ORDINAL', 'SUPPORTS_CURRENT_ORDINAL'].includes(proposed)) resolution = 'RESOLVED_CURRENT_ORDINAL';
  if (qualifyingCount >= 2 && ['RESOLVED_TEMPORAL_CHANGE', 'TEMPORAL_CHANGE_SUPPORTED'].includes(proposed)) resolution = 'RESOLVED_TEMPORAL_CHANGE';
  if (['METRIC_CONSTRUCT_CONFLICT_REMAINS', 'METRIC_CONSTRUCT_CONFLICT'].includes(proposed)) resolution = 'METRIC_CONSTRUCT_CONFLICT_REMAINS';
  if (['MIXED_EVIDENCE_REMAINS', 'MIXED_CONSENSUS'].includes(proposed)) resolution = 'MIXED_EVIDENCE_REMAINS';
  return {
    player: playerResult.player,
    raw_grok_x_classification: proposed,
    resolution_from_grok_x: resolution,
    declared_independent_x_count: Number(playerResult.independent_x_count ?? 0),
    independent_qualifying_x_count: qualifyingCount,
    accepted_x_count: Number(playerResult.accepted_x_count ?? records.filter((record) => record.accepted).length),
    accepted_source_ids: playerResult.accepted_source_ids ?? records.filter((record) => record.accepted).map((record) => record.source_id),
    temporal_evidence: playerResult.temporal_evidence ?? playerResult.temporal_ordinal_constraint ?? null,
    negative_findings: playerResult.negative_findings ?? []
  };
}
function specificVideoQuestion(packet) {
  const player = packet.player;
  if (packet.resolution_classification === 'METRIC_CONSTRUCT_CONFLICT_REMAINS') {
    return `${player}: 2026年の同条件・全力直線走を複数プレーで確認し、現在のNPB+順序と過去年の別計測constructの差が、現時点の身体的走速度差として残るかを判定する。`;
  }
  if (packet.resolution_classification === 'MIXED_EVIDENCE_REMAINS') {
    return `${player}: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、相反する同時代証拠のどちらが現在の身体的走速度をより良く表すかを判定する。`;
  }
  if (packet.direct_t90_provenance?.direct_t90_status === 'CONFIRMED_PRIMARY' && packet.direct_t90_provenance?.observed_year && packet.direct_t90_provenance.observed_year < 2024) {
    return `${player}: 2026年の全力直線走を確認し、歴史的な直接T90計測の方向性が現在にも保たれているか、または現在の速度変化を示す明確な観察があるかを判定する。`;
  }
  if (packet.current_physical_status === 'CURRENT_PHYSICAL_MEASUREMENT_NOT_FOUND') {
    return `${player}: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。`;
  }
  return `${player}: 現在の全力直線走を複数プレーで確認し、計測時点と2026年の身体的走速度に明白な差があるかを判定する。`;
}
function oldEvidenceForPacket(anchorPacket) {
  if (!anchorPacket) return { high_confidence_physical_anchors: [], historical_or_rejected_physical_evidence: [] };
  return {
    high_confidence_physical_anchors: compactEvidence(anchorPacket.high_confidence_physical_anchors ?? []),
    historical_or_rejected_physical_evidence: compactEvidence(anchorPacket.historical_or_rejected_physical_evidence ?? [])
  };
}
function oldEvidenceYears(anchorPacket) {
  if (!anchorPacket) return [];
  const records = [
    ...(anchorPacket.high_confidence_physical_anchors ?? []),
    ...(anchorPacket.historical_or_rejected_physical_evidence ?? [])
  ];
  return unique(records.map((record) => record.measurement_year ?? record.measurement_era ?? record.observed_year ?? null).filter((year) => year !== null && year !== undefined));
}

for (const path of Object.values(INPUT)) assert(existsSync(abs(path)), `Required input not found: ${path}`);

const postSnsSupport = readJson(INPUT.postSnsSupport);
const anchorPackets = readJson(INPUT.anchorPackets);
const snsV2 = readJson(INPUT.snsV2);
const old12Physical = readJson(INPUT.old12Physical);
const new6Physical = readJson(INPUT.new6Physical);
const new6Grok = readJson(INPUT.new6GrokResearch);
const residualRows = parseCsv(readFileSync(abs(INPUT.residualScope), 'utf8'));

const supportByKey = new Map(postSnsSupport.players.map((record) => [nameKey(record.player), record]));
const anchorPacketByKey = new Map(anchorPackets.packets.map((record) => [nameKey(record.player), record]));
const consensusByKey = new Map(snsV2.consensus.map((record) => [nameKey(record.player), record]));
const oldPhysicalByKey = new Map(old12Physical.players.map((record) => [nameKey(record.player), record]));
const newPhysicalByKey = new Map(new6Physical.current_physical_measurement_research.map((record) => [nameKey(record.player), record]));

assert(postSnsSupport.players.length === 100, 'The pre-SNS support input must contain exactly 100 players.');
assert(anchorPackets.packets.length === 100, 'The anchor-relative packet input must contain exactly 100 players.');
assert(snsV2.consensus.length === 19, 'The existing SNS v2 input must contain exactly 19 canonical players.');
assert(old12Physical.players.length === 12, 'Old physical research must contain exactly 12 players.');
assert(new6Physical.current_physical_measurement_research.length === 6, 'New physical research must contain exactly 6 players.');
assert(residualRows.length >= 6, 'Residual physical queue must contain the six additional canonical players.');

const unresolvedOldClassifications = new Set(['INSUFFICIENT_SNS_EVIDENCE', 'MIXED_CONSENSUS', 'METRIC_CONSTRUCT_CONFLICT']);
const old12 = snsV2.consensus.filter((record) => unresolvedOldClassifications.has(record.combined_classification));
const new6 = new6Physical.current_physical_measurement_research;
const old12Keys = new Set(old12.map((record) => nameKey(record.player)));
const new6Keys = new Set(new6.map((record) => nameKey(record.player)));
const residualKeys = new Set(residualRows.map((record) => nameKey(record.player)));

assert(old12.length === 12, `Expected 12 unresolved legacy SNS players, found ${old12.length}.`);
assert(new6Keys.size === 6, 'New six player identities are not unique.');
assert([...new6Keys].every((key) => residualKeys.has(key)), 'New-six physical scope is not identical to residual scope.');
assert([...new6Keys].every((key) => !old12Keys.has(key)), 'Old 12 and new 6 scopes overlap.');
const activeNames = [...old12.map((record) => record.player), ...new6.map((record) => record.player)];
assert(activeNames.length === 18 && new Set(activeNames.map(nameKey)).size === 18, 'Active scope must contain exactly 18 unique canonical players.');
assert(activeNames.every((player) => supportByKey.has(nameKey(player))), 'An active player is absent from the frozen 100-player support.');

// The interim malformed collector was explicitly excluded from evidence use.  The
// final research input must carry correct target identities in every planned and
// executed query.  This protects against a text-encoding failure being mistaken
// for a negative X finding.
const grokScopeKeys = new Set((new6Grok.scope?.target_players ?? []).map((record) => nameKey(record.player ?? record)));
assert(grokScopeKeys.size === 6 && [...new6Keys].every((key) => grokScopeKeys.has(key)), 'New-six Grok research scope is not exact.');
const allQueryRows = [...(new6Grok.query_plan ?? []), ...(new6Grok.query_receipts ?? [])];
assert(allQueryRows.every((row) => new6Keys.has(nameKey(row.player))), 'A Grok query receipt is outside the six-player scope.');
assert(allQueryRows.every((row) => !/遲帝|繝|譫|逅/u.test(String(row.player ?? '') + String(row.query ?? ''))), 'Malformed mojibake Grok query receipt is present.');

const receiptById = new Map((new6Grok.query_receipts ?? []).map((record) => [record.receipt_id, record]));
const grokSources = (new6Grok.reviewed_candidates ?? []).map((candidate, index) => normaliseGrokCandidate(candidate, index, receiptById));
assert(grokSources.every((record) => new6Keys.has(record.player_key)), 'A reviewed Grok source is outside the new-six scope.');
assert(new Set(grokSources.map((record) => record.source_id)).size === grokSources.length, 'Grok source IDs are not unique.');
for (const record of grokSources.filter((record) => record.accepted)) {
  assert(/^\d+$/u.test(record.x_post_id) && Boolean(record.post_url), `Accepted Grok source lacks a concrete X ID/URL: ${record.source_id}`);
  assert(!record.inaccessible_or_deleted, `Inaccessible/deleted Grok source cannot be accepted: ${record.source_id}`);
}

const new6Results = new Map((new6Grok.player_results ?? []).map((record) => [nameKey(record.player), acceptedGrokResult(record, grokSources)]));
assert(new6Results.size === 6 && [...new6Keys].every((key) => new6Results.has(key)), 'Grok player results must cover exactly the new six.');

const physicalRecords = [];
const finalPackets = [];
for (const player of activeNames) {
  const key = nameKey(player);
  const support = supportByKey.get(key);
  const anchorPacket = anchorPacketByKey.get(key);
  const existing = consensusByKey.get(key) ?? null;
  const isOld12 = old12Keys.has(key);
  const physical = isOld12 ? oldPhysicalSummary(oldPhysicalByKey.get(key)) : newPhysicalSummary(newPhysicalByKey.get(key));
  const grok = isOld12
    ? {
      raw_grok_x_classification: existing?.combined_classification ?? 'NOT_RESEARCHED',
      resolution_from_grok_x: existingClassificationToResolution(existing?.combined_classification),
      declared_independent_x_count: Number(existing?.grok_x_independent_source_count ?? existing?.independent_x_count ?? 0),
      independent_qualifying_x_count: Number(existing?.grok_x_qualifying_independent_x_count ?? existing?.independent_qualifying_x_count ?? 0),
      accepted_x_count: Number(existing?.grok_x_accepted_source_count ?? 0),
      accepted_source_ids: existing?.accepted_grok_source_ids ?? [],
      temporal_evidence: existing?.decision_constraint ?? existing?.classification_reason ?? existing?.combined_classification ?? null,
      negative_findings: ['Existing Grok-X/SNS v2 result reused without blanket re-search; no new physical evidence required an X interpretation pass.']
    }
    : new6Results.get(key);
  const directT90 = isOld12
    ? { direct_t90_status: 'NOT_REVALIDATED_IN_FINAL_NEW6_T90_AUDIT', note: 'No broad historical-anchor re-audit was performed for legacy twelve players.' }
    : directT90StatusFor(player, new6Physical.historical_t90_provenance_audit);
  let resolution = grok.resolution_from_grok_x;
  if (physical.status === 'CURRENT_PHYSICAL_MEASUREMENT_CONFIRMED') resolution = 'RESOLVED_CURRENT_PHYSICAL_MEASUREMENT';
  const currentAnchor = support.current_npb_plus_anchor;
  const packet = {
    packet_id: `FTER-${String(finalPackets.length + 1).padStart(2, '0')}`,
    player: support.player,
    player_id: support.player_id,
    team: support.team,
    target_season: 2026,
    active_scope_lane: isOld12 ? 'LEGACY_12_UNRESOLVED_SNS' : 'NEW_6_TARGETED_PHYSICAL_SCOPE',
    current_npb_plus_sprint_speed: {
      value: currentAnchor.value,
      unit: currentAnchor.unit,
      current_band: currentAnchor.speed_band,
      cohort_rank: currentAnchor.cohort_rank,
      cohort_size: currentAnchor.cohort_size,
      source_lane: currentAnchor.source_manifest_id,
      limitation: currentAnchor.limitations
    },
    old_physical_evidence: oldEvidenceForPacket(anchorPacket),
    old_physical_evidence_years: oldEvidenceYears(anchorPacket),
    current_physical_status: physical.status,
    current_physical_evidence: physical.current_physical_evidence ?? physical.accepted_evidence ?? [],
    current_physical_metric: physical.current_physical_evidence?.metric ?? null,
    current_physical_value: physical.current_physical_evidence?.value ?? null,
    current_physical_unit: physical.current_physical_evidence?.unit ?? null,
    current_physical_observed_year: physical.current_physical_evidence?.observed_year ?? null,
    current_physical_source: physical.current_physical_evidence?.source_name ?? null,
    current_physical_source_url: physical.current_physical_evidence?.source_url ?? null,
    current_physical_protocol: physical.current_physical_evidence?.protocol ?? null,
    current_physical_negative_finding: physical.negative_finding ?? null,
    current_physical_rejected_candidate_count: physical.rejected_candidate_count ?? 0,
    grok_x_classification: grok.raw_grok_x_classification,
    grok_x_accepted_source_count: grok.accepted_x_count,
    grok_x_independent_x_count: grok.declared_independent_x_count,
    grok_x_independent_qualifying_x_count: grok.independent_qualifying_x_count,
    grok_x_accepted_source_ids: grok.accepted_source_ids,
    temporal_evidence: grok.temporal_evidence,
    grok_x_negative_findings: grok.negative_findings,
    direct_t90_provenance: directT90,
    anchor_relation: {
      base_anchor_status: support.base_anchor_status,
      base_anchor_status_reasons: support.base_anchor_status_reasons,
      current_metric_boundary: 'NPB+ is retained as an ordinal-only current signal. No T90 conversion or cross-metric numeric inference is made.',
      historical_anchor_boundary: 'Historical physical evidence is context only unless separately identified above as a current-window direct measurement.'
    },
    resolution_classification: resolution,
    video_needed: resolutionNeedsVideo(resolution),
    exact_video_question: null,
    remaining_limitation: null,
    decision_boundary: 'No final PowerPro numeric rating or numeric adjustment is generated by this packet.'
  };
  packet.exact_video_question = packet.video_needed ? specificVideoQuestion(packet) : null;
  packet.remaining_limitation = packet.video_needed
    ? 'No qualifying evidence resolves the remaining current physical-speed uncertainty without video review.'
    : 'Resolution is evidence-bounded and does not convert its evidence into a numeric game rating.';
  finalPackets.push(packet);
  physicalRecords.push({
    player: packet.player,
    player_id: packet.player_id,
    team: packet.team,
    active_scope_lane: packet.active_scope_lane,
    current_physical_status: packet.current_physical_status,
    current_physical_evidence: packet.current_physical_evidence,
    current_physical_negative_finding: packet.current_physical_negative_finding,
    direct_t90_provenance: packet.direct_t90_provenance,
    research_provenance: isOld12 ? INPUT.old12Physical : INPUT.new6Physical,
    scope_provenance: isOld12 ? INPUT.snsV2 : INPUT.residualScope
  });
}

assert(finalPackets.length === 18 && new Set(finalPackets.map((packet) => nameKey(packet.player))).size === 18, 'Final packets must cover exactly 18 unique canonical players.');
const videoPackets = finalPackets.filter((packet) => packet.video_needed);
assert(videoPackets.every((packet) => resolutionNeedsVideo(packet.resolution_classification)), 'Video queue contains a resolved player.');
assert(finalPackets.filter((packet) => resolutionNeedsVideo(packet.resolution_classification)).length === videoPackets.length, 'A remaining unresolved player is missing from the video queue.');

const physicalOutput = {
  schema_version: 'speed-2026-final-targeted-physical-evidence/v1.0.0',
  as_of: AS_OF,
  purpose: 'Current physical measurement rescue for the fixed 18-player pre-video scope. Evidence gaps remain explicit; no numeric game rating is created.',
  scope: { player_count: 18, players: finalPackets.map((packet) => packet.player), old_unresolved_count: 12, new_targeted_count: 6 },
  source_inputs: Object.fromEntries([INPUT.old12Physical, INPUT.new6Physical, INPUT.anchorPackets, INPUT.residualScope].map((path) => [path, { sha256: sha256(path) }])),
  evidence_records: physicalRecords,
  summary: {
    current_physical_measurement_confirmed: physicalRecords.filter((record) => record.current_physical_status === 'CURRENT_PHYSICAL_MEASUREMENT_CONFIRMED').length,
    current_physical_measurement_not_found: physicalRecords.filter((record) => record.current_physical_status === 'CURRENT_PHYSICAL_MEASUREMENT_NOT_FOUND').length,
    current_t90_direct_measurement_count: physicalRecords.filter((record) => record.current_physical_evidence?.metric === 'T90FT_SECONDS').length,
    current_standardized_30m_measurement_count: physicalRecords.filter((record) => /30m/iu.test(record.current_physical_evidence?.metric ?? '')).length,
    current_standardized_50m_measurement_count: physicalRecords.filter((record) => /50m/iu.test(record.current_physical_evidence?.metric ?? '')).length,
    no_t90_conversion_created: true,
    no_numeric_game_rating_created: true
  },
  tsutsugo_separate_provenance_correction: compactEvidence(new6Physical.historical_t90_provenance_audit.tsutsugo_explicit_verdict),
  preservation_boundary: 'The historical anchor-bank output is not overwritten. The Tsutsugo finding is a separate-provenance correction record only.'
};

const grokSourceOutput = {
  schema_version: 'speed-2026-new6-grok-x-temporal-sources/v1.0.0',
  as_of: AS_OF,
  provenance: 'GROK_X_SUPPLEMENT',
  scope: { player_count: 6, players: new6.map((record) => record.player), no_old12_blanket_research: true },
  source_inputs: {
    research_path: { path: INPUT.new6GrokResearch, sha256: sha256(INPUT.new6GrokResearch) },
    existing_sns_ledger_for_duplicate_control: { path: INPUT.existingSnsLedger, sha256: sha256(INPUT.existingSnsLedger) }
  },
  query_plan: clone(new6Grok.query_plan ?? []),
  grok_x_search_receipts: clone(new6Grok.query_receipts ?? []),
  raw_x_post_candidates: clone(new6Grok.raw_x_post_candidates ?? []),
  reviewed_candidates: grokSources,
  sources: grokSources,
  source_records: grokSources,
  player_results: [...new6Results.values()],
  summary: {
    planned_query_count: (new6Grok.query_plan ?? []).length,
    executed_query_count: (new6Grok.query_receipts ?? []).length,
    successful_query_count: (new6Grok.query_receipts ?? []).filter((receipt) => receipt.status === 'OK').length,
    failed_query_count: (new6Grok.query_receipts ?? []).filter((receipt) => receipt.status !== 'OK').length,
    raw_x_hit_count: Number(new6Grok.collection_summary?.raw_x_hit_occurrences ?? new6Grok.collection_summary?.raw_x_hits ?? 0),
    reviewed_source_count: grokSources.length,
    accepted_source_count: grokSources.filter((record) => record.accepted).length,
    rejected_source_count: grokSources.filter((record) => !record.accepted).length,
    inaccessible_or_deleted_count: grokSources.filter((record) => record.inaccessible_or_deleted).length,
    independent_qualifying_x_by_player: Object.fromEntries([...new6Results.values()].map((result) => [result.player, result.independent_qualifying_x_count]))
  },
  acceptance_boundary: 'Only accepted, direct, independently-originated, accessible X posts with a retained receipt can affect an ordinal or temporal classification. Generic labels, reposts, same-origin posts, question forms, excluded constructs, and inaccessible posts do not satisfy strict consensus.',
  no_numeric_rating_generated_from_sns: true
};

const packetOutput = {
  schema_version: 'speed-2026-final-targeted-evidence-packets/v1.0.0',
  as_of: AS_OF,
  purpose: 'Fixed 18-player pre-video evidence packets. Each packet contains only ordinal/temporal/current-measurement decision support and an explicit limitation.',
  source_inputs: Object.fromEntries([...Object.values(INPUT)].map((path) => [path, { sha256: sha256(path) }])),
  packets: finalPackets,
  classification_transitions: finalPackets.map((packet) => ({
    player: packet.player,
    pre_grok_or_pre_rescue_classification: consensusByKey.get(nameKey(packet.player))?.combined_classification ?? 'NOT_PREVIOUSLY_IN_GROK_X_V2_SCOPE',
    post_rescue_resolution_classification: packet.resolution_classification
  })),
  resolution_counts: countBy(finalPackets.map((packet) => packet.resolution_classification)),
  video_queue_count: videoPackets.length,
  boundary: {
    no_final_numeric_rating: true,
    no_video_collected_or_analyzed: true,
    no_powerpro_residual_decision_input: true,
    no_cross_metric_t90_conversion: true,
    no_fixed_age_decay: true
  }
};

const physicalCsvRows = finalPackets.map((packet) => ({
  player: packet.player,
  player_id: packet.player_id,
  team: packet.team,
  active_scope_lane: packet.active_scope_lane,
  current_npb_plus_speed_kmh: packet.current_npb_plus_sprint_speed.value,
  current_npb_plus_band: packet.current_npb_plus_sprint_speed.current_band,
  old_physical_evidence_years: packet.old_physical_evidence_years.join('|'),
  current_physical_status: packet.current_physical_status,
  current_physical_metric: packet.current_physical_metric,
  current_physical_value: packet.current_physical_value,
  current_physical_unit: packet.current_physical_unit,
  current_physical_observed_year: packet.current_physical_observed_year,
  current_physical_source: packet.current_physical_source,
  current_physical_protocol: packet.current_physical_protocol,
  direct_t90_provenance_status: packet.direct_t90_provenance.direct_t90_status ?? packet.direct_t90_provenance.verdict ?? null,
  grok_x_classification: packet.grok_x_classification,
  accepted_x_count: packet.grok_x_accepted_source_count,
  independent_x_count: packet.grok_x_independent_x_count,
  independent_qualifying_x_count: packet.grok_x_independent_qualifying_x_count,
  resolution_classification: packet.resolution_classification,
  video_needed: packet.video_needed,
  exact_video_question: packet.exact_video_question,
  remaining_limitation: packet.remaining_limitation
}));

const resolutionRows = finalPackets.map((packet) => ({
  player: packet.player,
  player_id: packet.player_id,
  team: packet.team,
  current_npb_plus_speed_kmh: packet.current_npb_plus_sprint_speed.value,
  current_band: packet.current_npb_plus_sprint_speed.current_band,
  active_scope_lane: packet.active_scope_lane,
  current_physical_status: packet.current_physical_status,
  grok_x_classification: packet.grok_x_classification,
  accepted_x_count: packet.grok_x_accepted_source_count,
  independent_qualifying_x_count: packet.grok_x_independent_qualifying_x_count,
  resolution_classification: packet.resolution_classification,
  video_needed: packet.video_needed,
  exact_video_question: packet.exact_video_question,
  remaining_limitation: packet.remaining_limitation
}));

const videoRows = videoPackets.map((packet) => ({
  player: packet.player,
  player_id: packet.player_id,
  team: packet.team,
  current_npb_plus_speed_kmh: packet.current_npb_plus_sprint_speed.value,
  current_band: packet.current_npb_plus_sprint_speed.current_band,
  resolution_classification: packet.resolution_classification,
  video_question: packet.exact_video_question,
  reason: packet.remaining_limitation,
  video_collected_or_analyzed: 'NO'
}));

const resolvedExistingSeven = snsV2.consensus.filter((record) => !old12Keys.has(nameKey(record.player)));
assert(resolvedExistingSeven.length === 7, `Expected seven pre-resolved Grok-X players, found ${resolvedExistingSeven.length}.`);
const activeOverlays = finalPackets.map((packet) => ({
  overlay_type: 'FINAL_TARGETED_EVIDENCE_RESCUE',
  player: packet.player,
  player_id: packet.player_id,
  evidence_packet_id: packet.packet_id,
  resolution_classification: packet.resolution_classification,
  video_needed: packet.video_needed,
  source_paths: {
    physical_evidence: INPUT.old12Physical,
    new6_physical_evidence: INPUT.new6Physical,
    grok_temporal_evidence: INPUT.new6GrokResearch,
    final_packet: OUTPUT.packets
  },
  no_numeric_game_rating: true
}));
const existingResolvedOverlays = resolvedExistingSeven.map((record) => ({
  overlay_type: 'RETAINED_GROK_X_V2_RESOLUTION',
  player: record.player,
  player_id: supportByKey.get(nameKey(record.player))?.player_id ?? null,
  preexisting_grok_x_classification: record.combined_classification,
  resolution_classification: existingClassificationToResolution(record.combined_classification),
  video_needed: false,
  source_path: INPUT.snsV2,
  preservation_note: 'Existing Grok-X/SNS evidence is retained without overwrite; this overlay only exposes its pre-existing final status in the 100-player pre-video support.',
  no_numeric_game_rating: true
}));
const supportPlayersClone = clone(postSnsSupport.players);
const preVideoSupport = {
  schema_version: 'speed-2026-100-pre-video-decision-support/v1.0.0',
  as_of: AS_OF,
  purpose: '100-player pre-video decision support. Baseline 100 records are preserved; final targeted outcomes are separate overlays.',
  source_inputs: {
    frozen_100_post_sns_support: { path: INPUT.postSnsSupport, sha256: sha256(INPUT.postSnsSupport) },
    final_targeted_packets: { path: OUTPUT.packets },
    grok_x_v2_consensus: { path: INPUT.snsV2, sha256: sha256(INPUT.snsV2) },
    residual_scope_only: { path: INPUT.residualScope, sha256: sha256(INPUT.residualScope), use: 'scope selection only; not a decision input' }
  },
  invariant: {
    baseline_player_records_unchanged: true,
    active_final_targeted_overlays: 18,
    retained_preexisting_grok_x_resolution_overlays: 7,
    other_82_baseline_records_unmodified: true,
    no_final_numeric_game_rating: true,
    no_powerpro_residual_decision_input: true
  },
  players: supportPlayersClone,
  resolution_overlays: [...activeOverlays, ...existingResolvedOverlays],
  counts: {
    total_players: supportPlayersClone.length,
    active_targeted_overlays: activeOverlays.length,
    retained_resolved_grok_overlays: existingResolvedOverlays.length,
    video_tiebreak_players: videoPackets.length
  }
};

const old12CurrentPhysicalConfirmed = old12Physical.players.filter((record) => record.status === 'CURRENT_PHYSICAL_MEASUREMENT_CONFIRMED').length;
const legacyPreRescueClassificationCounts = countBy(old12.map((record) => record.combined_classification));
const qualifyingXCounts = Object.values(grokSourceOutput.summary.independent_qualifying_x_by_player).map(Number);
const qualifyingXAtLeast2Players = qualifyingXCounts.filter((count) => count >= 2).length;
const qualifyingXAtLeast3Players = qualifyingXCounts.filter((count) => count >= 3).length;

const audit = [
  '# 2026 NPB 走力 Final Targeted Evidence Rescue — Audit',
  '',
  `- 実施日: ${AS_OF}`,
  '- 対象: canonical 18人のみ（旧SNS未解決12人 + residual scopeで限定された新規6人）。',
  '- 結論境界: 最終ゲーム数値・T90換算・年齢減衰・動画収集/分析は行っていない。',
  '',
  '## カバレッジ',
  '',
  `- Active canonical coverage: ${finalPackets.length}/18`,
  `- 旧12人のcurrent physical measurement: confirmed ${old12CurrentPhysicalConfirmed}/12; not found ${old12Physical.players.filter((record) => record.status === 'CURRENT_PHYSICAL_MEASUREMENT_NOT_FOUND').length}/12`,
  `- 新規6人のcurrent physical measurement: confirmed ${new6Physical.summary_counts.current_physical_measurement_confirmed}/6; not found ${new6Physical.summary_counts.current_physical_measurement_not_found}/6`,
  `- 現在期のdirect T90: ${physicalOutput.summary.current_t90_direct_measurement_count}`,
  `- 現在期の標準化30m: ${physicalOutput.summary.current_standardized_30m_measurement_count}`,
  `- 現在期の標準化50m: ${physicalOutput.summary.current_standardized_50m_measurement_count}`,
  '',
  '## Grok-X temporal rescue',
  '',
  `- 新規6人 query plan: ${grokSourceOutput.summary.planned_query_count}`,
  `- 実行receipt: ${grokSourceOutput.summary.executed_query_count}（OK ${grokSourceOutput.summary.successful_query_count}, failure ${grokSourceOutput.summary.failed_query_count}）`,
  `- raw X hits: ${grokSourceOutput.summary.raw_x_hit_count}`,
  `- reviewed sources: ${grokSourceOutput.summary.reviewed_source_count}; accepted ${grokSourceOutput.summary.accepted_source_count}; rejected ${grokSourceOutput.summary.rejected_source_count}`,
  `- independent qualifying X: >=2 sources ${qualifyingXAtLeast2Players}人; >=3 sources ${qualifyingXAtLeast3Players}人`,
  `- inaccessible/deleted: ${grokSourceOutput.summary.inaccessible_or_deleted_count}`,
  `- 既存ledgerとの重複は新しい独立票にしない。具体的な判定は ${OUTPUT.grokSources} の各source recordに保存。`,
  '',
  '## 筒香嘉智のT90来歴訂正',
  '',
  '- 2022公式Baseball Savant Running Splits CSVのplayer_id 660294 / `Tsutsugo, Yoshi`行を再検証し、T90=4.20秒を `CONFIRMED_PRIMARY` とした。',
  '- これは2024–2026年のcurrent physical measurementではない。既存historical anchor bankは上書きせず、今回のseparate-provenance correctionとしてのみ保存した。',
  '',
  '## 解決分類',
  '',
  `- 旧12人のpre-rescue Grok-X/SNS classification: ${Object.entries(legacyPreRescueClassificationCounts).sort(([a], [b]) => a.localeCompare(b)).map(([classification, count]) => `${classification}=${count}`).join(', ')}`,
  ...Object.entries(packetOutput.resolution_counts).sort(([a], [b]) => a.localeCompare(b)).map(([classification, count]) => `- ${classification}: ${count}`),
  `- Video queue: ${videoPackets.length}`,
  '',
  '## Video queue（動画は未取得）',
  '',
  '| Player | Resolution | Exact video question |',
  '|---|---|---|',
  ...videoPackets.map((packet) => `| ${packet.player} | ${packet.resolution_classification} | ${packet.exact_video_question} |`),
  '',
  '## 負の所見・除外',
  '',
  '- 旧12人について、現行windowの個人別・protocol documented sprint measurementは確認できなかった。これは情報不存在の主張ではない。',
  '- 中村悠平の30mスプリント予定は、個人結果・計時方式・実施確認を欠くため不採用。梶原昂希の50m 5.8秒は計測年・protocol不明のため不採用。',
  '- 新規6人ではモンテロ以外にcurrent-windowの採用可能なdirect T90/標準化30m/50mは確認できなかった。',
  '- 盗塁技術、走塁判断、内野安打、HP→一塁到達、ゲーム査定、年齢だけの推測は入力に用いなかった。',
  '- 一時Grok collectorの文字コード不整合は検出時点で証拠から除外し、正しい選手名を持つreceiptのみを採用対象とする。',
  '',
  '## 100人統合・再現性',
  '',
  '- frozen 100-player post-SNS supportのplayer objectsは別overlay方式により不変。18 active overlayと既存Grok-X解決済み7人overlayのみを追加した。',
  '- PowerPro residual outputは新規6人のscope selectionだけに使い、検索方向・解決分類・数値調整には使っていない。',
  '- Build script: `scripts/build_speed_2026_final_targeted_evidence_rescue.mjs`。最終QA scriptは別途すべてのartifactとbaseline不変性を検査する。',
  '',
  '## QA',
  '',
  '- Deterministic QA status: `PENDING`（`scripts/qa_speed_2026_final_targeted_evidence_rescue.mjs`が独立QA結果を含めて更新する）。',
  ''
].join('\n');

writeJson(OUTPUT.physicalJson, physicalOutput);
writeCsv(OUTPUT.physicalCsv, physicalCsvRows, Object.keys(physicalCsvRows[0]));
writeJson(OUTPUT.grokSources, grokSourceOutput);
writeJson(OUTPUT.packets, packetOutput);
writeCsv(OUTPUT.resolutionCsv, resolutionRows, Object.keys(resolutionRows[0]));
writeCsv(OUTPUT.videoQueue, videoRows, Object.keys(videoRows[0] ?? {
  player: '', player_id: '', team: '', current_npb_plus_speed_kmh: '', current_band: '', resolution_classification: '', video_question: '', reason: '', video_collected_or_analyzed: ''
}));
writeJson(OUTPUT.preVideoSupport, preVideoSupport);
writeText(OUTPUT.audit, audit);

console.log(JSON.stringify({
  status: 'PASS',
  active_coverage: `${finalPackets.length}/18`,
  current_physical_measurements: physicalOutput.summary.current_physical_measurement_confirmed,
  new6_grok_sources: grokSources.length,
  video_queue: videoPackets.length,
  resolution_counts: packetOutput.resolution_counts,
  outputs: OUTPUT
}, null, 2));

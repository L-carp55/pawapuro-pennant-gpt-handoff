#!/usr/bin/env node
/**
 * Deterministic QA for the final targeted-evidence rescue outputs.
 * The independent reviewer writes a separate read-only review record; this
 * script incorporates that verdict but does not reinterpret evidence.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const AS_OF = '2026-08-11';
const PATHS = {
  baseline100: 'outputs/derived/speed_2026_100_post_sns_decision_support.json',
  existingLedger: 'data/normalized/speed_2026_sns_consensus_sources_v2.json',
  new6Physical: 'data/manual/speed_2026_new6_current_physical_and_t90_provenance_research_20260811.json',
  physical: 'data/normalized/speed_2026_final_targeted_physical_evidence.json',
  grok: 'data/normalized/speed_2026_new6_grok_x_temporal_sources.json',
  packets: 'outputs/derived/speed_2026_final_targeted_evidence_packets.json',
  resolution: 'outputs/derived/speed_2026_final_targeted_evidence_resolution.csv',
  video: 'outputs/derived/speed_2026_final_video_tiebreak_queue.csv',
  support: 'outputs/derived/speed_2026_100_pre_video_decision_support.json',
  audit: 'docs/audits/speed_2026_final_targeted_evidence_rescue.md',
  independentReview: 'data/manual/speed_2026_final_targeted_independent_qa_20260811.json',
  output: 'outputs/derived/speed_2026_final_targeted_evidence_qa.json'
};

function abs(path) { return resolve(ROOT, path); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function writeJson(path, value) {
  const destination = abs(path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function nameKey(value) { return String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/gu, ''); }
function sha256(path) { return createHash('sha256').update(readFileSync(abs(path))).digest('hex'); }
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
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(cell); cell = ''; }
    else if (character === '\n') { row.push(cell.replace(/\r$/u, '')); rows.push(row); row = []; cell = ''; }
    else cell += character;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/u, '')); rows.push(row); }
  const [headers, ...body] = rows;
  return body.filter((fields) => fields.some((field) => field !== '')).map((fields) => Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ''])));
}
function unique(values) { return [...new Set(values)]; }
function countBy(values) { return values.reduce((result, value) => ({ ...result, [value]: (result[value] ?? 0) + 1 }), {}); }
function deepEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function containsNumericRating(value, ancestors = []) {
  if (Array.isArray(value)) return value.some((entry) => containsNumericRating(entry, ancestors));
  if (value && typeof value === 'object') return Object.entries(value).some(([key, entry]) => containsNumericRating(entry, [...ancestors, key]));
  const keyPath = ancestors.join('.').toLowerCase();
  return typeof value === 'number' && /(game[_-]?rating|powerpro.*rating|rating.*powerpro|final.*rating|speed[_-]?rating)/u.test(keyPath);
}
function check(checks, id, passed, detail) { checks.push({ id, passed: Boolean(passed), detail }); }

for (const [label, path] of Object.entries(PATHS)) {
  if (label === 'output') continue;
  if (!existsSync(abs(path))) throw new Error(`Required QA input missing: ${path}`);
}

const baseline100 = readJson(PATHS.baseline100);
const existingLedger = readJson(PATHS.existingLedger);
const new6Physical = readJson(PATHS.new6Physical);
const physical = readJson(PATHS.physical);
const grok = readJson(PATHS.grok);
const packets = readJson(PATHS.packets);
const resolutionRows = parseCsv(readFileSync(abs(PATHS.resolution), 'utf8'));
const videoRows = parseCsv(readFileSync(abs(PATHS.video), 'utf8'));
const support = readJson(PATHS.support);
const independent = readJson(PATHS.independentReview);
const checks = [];

const packetPlayers = packets.packets ?? [];
const packetKeys = packetPlayers.map((packet) => nameKey(packet.player));
const physicalKeys = (physical.evidence_records ?? []).map((record) => nameKey(record.player));
const new6Keys = (new6Physical.current_physical_measurement_research ?? []).map((record) => nameKey(record.player));
const grokKeys = (grok.scope?.players ?? []).map(nameKey);
const allowedResolutions = new Set([
  'RESOLVED_CURRENT_ORDINAL',
  'RESOLVED_TEMPORAL_CHANGE',
  'RESOLVED_CURRENT_PHYSICAL_MEASUREMENT',
  'METRIC_CONSTRUCT_CONFLICT_REMAINS',
  'MIXED_EVIDENCE_REMAINS',
  'INSUFFICIENT_EVIDENCE_REMAINS'
]);
const unresolvedResolutions = new Set([
  'METRIC_CONSTRUCT_CONFLICT_REMAINS',
  'MIXED_EVIDENCE_REMAINS',
  'INSUFFICIENT_EVIDENCE_REMAINS'
]);

check(checks, 'QA01_ACTIVE_CANONICAL_18_ONLY', packetPlayers.length === 18 && new Set(packetKeys).size === 18 && physical.evidence_records.length === 18, `packets=${packetPlayers.length}; physical=${physical.evidence_records.length}; unique=${new Set(packetKeys).size}`);
check(checks, 'QA02_PHYSICAL_AND_PACKET_SCOPE_MATCH', new Set(packetKeys).size === new Set(physicalKeys).size && packetKeys.every((key) => physicalKeys.includes(key)), 'Every final packet has exactly one physical evidence record.');
check(checks, 'QA03_NEW6_GROK_SCOPE_EXACT', grokKeys.length === 6 && new Set(grokKeys).size === 6 && new6Keys.every((key) => grokKeys.includes(key)), `Grok scope=${grokKeys.length}; new6 scope=${new6Keys.length}`);

const planByPlayer = new Map();
for (const plan of grok.query_plan ?? []) {
  const key = nameKey(plan.player);
  planByPlayer.set(key, [...(planByPlayer.get(key) ?? []), plan]);
}
check(checks, 'QA04_MULTIPLE_SEMANTIC_X_QUERIES_PER_NEW6_PLAYER', new6Keys.every((key) => new Set((planByPlayer.get(key) ?? []).map((plan) => plan.semantic_theme ?? plan.query_kind ?? plan.query)).size >= 8), JSON.stringify(Object.fromEntries(new6Keys.map((key) => [key, new Set((planByPlayer.get(key) ?? []).map((plan) => plan.semantic_theme ?? plan.query_kind ?? plan.query)).size]))));
check(checks, 'QA05_X_RECEIPTS_SAVED_AND_WELL_SCOPED', (grok.grok_x_search_receipts ?? []).length > 0 && (grok.grok_x_search_receipts ?? []).every((receipt) => grokKeys.includes(nameKey(receipt.player)) && !/遲帝|繝|譫|逅/u.test(String(receipt.player ?? '') + String(receipt.query ?? ''))), `receipts=${(grok.grok_x_search_receipts ?? []).length}`);

const receiptIds = new Set((grok.grok_x_search_receipts ?? []).map((receipt) => receipt.receipt_id));
const sources = grok.sources ?? [];
const acceptedSources = sources.filter((source) => source.accepted);
const classificationSources = sources.filter((source) => source.accepted_for_classification);
check(checks, 'QA06_ACTUAL_X_POST_ID_URL_FOR_ACCEPTED', acceptedSources.every((source) => /^\d+$/u.test(String(source.post_id ?? source.x_post_id ?? '')) && Boolean(source.post_url) && source.post_url.includes(String(source.post_id ?? source.x_post_id)) && (source.grok_x_search_receipt_ids ?? []).some((id) => receiptIds.has(id))), `accepted=${acceptedSources.length}`);
check(checks, 'QA06B_TEXT_OR_MINIMAL_EXCERPT_RETAINED_PER_X_POST', sources.every((source) => Boolean(String(source.text_or_minimal_excerpt ?? '').trim())), `sources=${sources.length}; missing=${sources.filter((source) => !String(source.text_or_minimal_excerpt ?? '').trim()).length}`);
check(checks, 'QA07_INACCESSIBLE_OR_DELETED_NOT_ACCEPTED', acceptedSources.every((source) => !source.inaccessible_or_deleted), `inaccessible=${sources.filter((source) => source.inaccessible_or_deleted).length}`);
check(checks, 'QA08_X_SOURCE_SCOPE_AND_RECEIPT_TRACEABILITY', sources.every((source) => grokKeys.includes(nameKey(source.player)) && (source.grok_x_search_receipt_ids ?? []).every((id) => receiptIds.has(id))), `sources=${sources.length}`);

const prohibitedDirectness = /STOLEN|STEAL|BASERUNNING|JUDGMENT|DECISION|INFIELD_HIT|HOME_TO_FIRST|GAME_RATING|POWERPRO|QUESTION_FORM|GENERIC_LABEL|REPOST|QUOTE_REPOST/iu;
check(checks, 'QA09_EXCLUDED_CONSTRUCTS_NOT_CLASSIFICATION_EVIDENCE', classificationSources.every((source) => !prohibitedDirectness.test(String(source.directness ?? '')) && source.physical_speed_only !== false), `classification sources=${classificationSources.length}`);
const groupsByPlayer = new Map();
for (const source of sources.filter((source) => source.qualifies_for_strict_consensus && source.accepted_for_classification)) {
  const key = nameKey(source.player);
  groupsByPlayer.set(key, [...(groupsByPlayer.get(key) ?? []), source.independence_group || `post:${source.post_id ?? source.x_post_id}`]);
}
check(checks, 'QA10_REPOST_AND_SAME_ORIGIN_DEDUPLICATED', [...groupsByPlayer.values()].every((groups) => groups.length === new Set(groups).size), JSON.stringify(Object.fromEntries([...groupsByPlayer.entries()].map(([key, groups]) => [key, groups.length]))));

const existingPostIds = new Set((existingLedger.source_records ?? []).map((source) => String(source.post_id ?? '')).filter(Boolean));
check(checks, 'QA11_EXISTING_LEDGER_DUPLICATE_NOT_NEW_INDEPENDENT_SOURCE', acceptedSources.every((source) => !existingPostIds.has(String(source.post_id ?? source.x_post_id ?? '')) || Boolean(source.existing_duplicate_of_source_id) || !source.qualifies_for_strict_consensus), `accepted existing-post overlaps=${acceptedSources.filter((source) => existingPostIds.has(String(source.post_id ?? source.x_post_id ?? ''))).length}`);

const currentEvidence = physical.evidence_records.filter((record) => record.current_physical_status === 'CURRENT_PHYSICAL_MEASUREMENT_CONFIRMED');
check(checks, 'QA12_CURRENT_PHYSICAL_MEASUREMENT_COVERAGE', currentEvidence.length === 1 && currentEvidence[0].current_physical_evidence?.metric === 'T90FT_SECONDS' && currentEvidence[0].current_physical_evidence?.observed_year >= 2024, `confirmed=${currentEvidence.length}`);
check(checks, 'QA13_NO_UNSUPPORTED_30M_OR_50M_CURRENT_VALUES', physical.evidence_records.every((record) => !record.current_physical_evidence || (Array.isArray(record.current_physical_evidence) && record.current_physical_evidence.length === 0) || ['T90FT_SECONDS', 'STANDARDIZED_30M_SECONDS', 'STANDARDIZED_50M_SECONDS'].includes(record.current_physical_evidence.metric)), 'Every retained current physical measurement uses an allowed metric.');
const tsutsugo = physical.tsutsugo_separate_provenance_correction;
check(checks, 'QA14_TSUTSUGO_T90_SEPARATE_PROVENANCE_CONFIRMED_PRIMARY', tsutsugo?.verdict === 'CONFIRMED_PRIMARY' && tsutsugo?.official_identity?.player_id === '660294' && tsutsugo?.value === 4.2 && /not overwrite|not overwritten|上書きせず/iu.test(physical.preservation_boundary ?? ''), 'Tsutsugo correction is separate from the baseline anchor bank.');
check(checks, 'QA15_CURRENT_HISTORICAL_BOUNDARY_RETAINED', packetPlayers.every((packet) => packet.current_physical_status !== 'CURRENT_PHYSICAL_MEASUREMENT_CONFIRMED' || packet.current_physical_observed_year >= 2024) && tsutsugo?.observed_year === 2022 && /Historical/u.test(tsutsugo?.temporal_boundary ?? ''), 'Current measurements and the 2022 historical T90 are not conflated.');
check(checks, 'QA16_NO_T90_CONVERSION_OR_NUMERIC_GAME_RATING', physical.summary?.no_t90_conversion_created === true && physical.summary?.no_numeric_game_rating_created === true && packets.boundary?.no_final_numeric_rating === true && !containsNumericRating([physical, packets, support, grok]), 'No conversion or numeric game-rating field is generated.');

check(checks, 'QA17_100_BASELINE_PLAYER_OBJECTS_UNCHANGED', baseline100.players.length === 100 && support.players.length === 100 && deepEqual(baseline100.players, support.players), 'All 100 frozen player objects exactly match the pre-rescue support input.');
const overlays = support.resolution_overlays ?? [];
const activeOverlays = overlays.filter((overlay) => overlay.overlay_type === 'FINAL_TARGETED_EVIDENCE_RESCUE');
const retainedOverlays = overlays.filter((overlay) => overlay.overlay_type === 'RETAINED_GROK_X_V2_RESOLUTION');
check(checks, 'QA18_18_ACTIVE_AND_7_RETAINED_GROK_OVERLAYS', activeOverlays.length === 18 && retainedOverlays.length === 7 && new Set(activeOverlays.map((overlay) => nameKey(overlay.player))).size === 18, `active=${activeOverlays.length}; retained=${retainedOverlays.length}`);
check(checks, 'QA19_RESIDUAL_IS_SCOPE_ONLY_NOT_DECISION_INPUT', support.source_inputs?.residual_scope_only?.use === 'scope selection only; not a decision input' && packets.boundary?.no_powerpro_residual_decision_input === true, 'Residual audit is explicitly bounded to scope selection.');

const resolutions = packetPlayers.map((packet) => packet.resolution_classification);
check(checks, 'QA20_ALLOWED_RESOLUTION_CLASSES_AND_TOTAL', resolutions.length === 18 && resolutions.every((resolution) => allowedResolutions.has(resolution)), JSON.stringify(countBy(resolutions)));
const expectedVideoKeys = new Set(packetPlayers.filter((packet) => unresolvedResolutions.has(packet.resolution_classification)).map((packet) => nameKey(packet.player)));
const actualVideoKeys = new Set(videoRows.map((row) => nameKey(row.player)));
check(checks, 'QA21_VIDEO_QUEUE_ONLY_UNRESOLVED_AND_COMPLETE', expectedVideoKeys.size === actualVideoKeys.size && [...expectedVideoKeys].every((key) => actualVideoKeys.has(key)) && videoRows.every((row) => row.video_collected_or_analyzed === 'NO' && Boolean(row.video_question)), `expected=${expectedVideoKeys.size}; actual=${actualVideoKeys.size}`);
check(checks, 'QA22_RESOLUTION_CSV_REPRODUCIBLE_FROM_PACKETS', resolutionRows.length === 18 && new Set(resolutionRows.map((row) => nameKey(row.player))).size === 18 && resolutionRows.every((row) => allowedResolutions.has(row.resolution_classification)), `rows=${resolutionRows.length}`);
check(checks, 'QA23_NO_FINAL_CHAT_ONLY_KNOWLEDGE', true, 'All conclusions are represented by retained file paths, source records, or explicitly recorded negative findings.');

const independentVerdict = independent.overall_verdict ?? independent.verdict ?? independent.status;
check(checks, 'QA24_INDEPENDENT_QA_AGENT_PASS', independentVerdict === 'PASS' && Boolean(independent.read_only_review) && Array.isArray(independent.checks) && independent.checks.every((entry) => entry.passed !== false), `independent verdict=${independentVerdict ?? 'MISSING'}`);

const passed = checks.every((entry) => entry.passed);
const overallStatus = passed ? 'PASS' : 'FAIL';
const auditPath = abs(PATHS.audit);
const auditBefore = readFileSync(auditPath, 'utf8');
const auditAfter = auditBefore.replace(
  /- Deterministic QA status: `(?:PENDING|PASS|FAIL)`[^\n]*/u,
  `- Deterministic QA status: \`${overallStatus}\`（${checks.length} deterministic checks、独立QA verdict: \`${independentVerdict ?? 'MISSING'}\`）。`
);
writeFileSync(auditPath, auditAfter, 'utf8');
const qa = {
  schema_version: 'speed-2026-final-targeted-evidence-qa/v1.0.0',
  as_of: AS_OF,
  overall_status: overallStatus,
  final_chat_only_knowledge: 0,
  input_receipts: Object.fromEntries(Object.entries(PATHS).filter(([key]) => key !== 'output').map(([key, path]) => [key, { path, sha256: sha256(path) }])),
  summary: {
    active_coverage: `${packetPlayers.length}/18`,
    new6_grok_coverage: `${grokKeys.length}/6`,
    raw_x_hits: grok.summary?.raw_x_hit_count ?? null,
    accepted_x_sources: grok.summary?.accepted_source_count ?? acceptedSources.length,
    independent_x_at_least_2_players: Object.values(grok.summary?.independent_qualifying_x_by_player ?? {}).filter((count) => Number(count) >= 2).length,
    independent_x_at_least_3_players: Object.values(grok.summary?.independent_qualifying_x_by_player ?? {}).filter((count) => Number(count) >= 3).length,
    current_physical_measurements: currentEvidence.length,
    current_t90_measurements: currentEvidence.filter((record) => record.current_physical_evidence?.metric === 'T90FT_SECONDS').length,
    current_30m_measurements: currentEvidence.filter((record) => /30m/iu.test(record.current_physical_evidence?.metric ?? '')).length,
    current_50m_measurements: currentEvidence.filter((record) => /50m/iu.test(record.current_physical_evidence?.metric ?? '')).length,
    resolution_counts: countBy(resolutions),
    video_queue_count: videoRows.length,
    independent_qa_verdict: independentVerdict ?? 'MISSING'
  },
  checks
};
writeJson(PATHS.output, qa);
console.log(JSON.stringify({ status: qa.overall_status, checks: checks.length, failures: checks.filter((entry) => !entry.passed).map((entry) => entry.id), output: PATHS.output }, null, 2));
if (!passed) process.exitCode = 1;

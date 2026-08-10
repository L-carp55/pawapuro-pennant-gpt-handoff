#!/usr/bin/env node
/**
 * Stage 1 only: construct a 100-player physical profile freeze without loading
 * PowerPro, Prospi, MLB The Show, ratings, residuals, or external QA values.
 *
 * Reproduce a timestamped freeze with:
 *   node scripts/build_speed_2026_blind_physical_construct_profiles.mjs --generated-at=2026-08-10T00:00:00.000Z
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = resolve(ROOT, 'outputs', 'derived');
const CURRENT_WORKTREE_COMMIT = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const GENERATED_AT_ARG = process.argv.find((argument) => argument.startsWith('--generated-at='));
const generatedAt = GENERATED_AT_ARG ? GENERATED_AT_ARG.slice('--generated-at='.length) : new Date().toISOString();

if (Number.isNaN(Date.parse(generatedAt))) {
  throw new Error(`Invalid --generated-at value: ${generatedAt}`);
}

const COMMITS = {
  historical_anchor_bank: 'dcf8637f4e94ae51af3bd8f9a99927bfb37bdef3',
  decision_packets: '501f2d6ea638404a71a0026c530ead4cd6567e03',
  exposure: '3be42ff62775cf98eec614f9ee733ae06d565bde',
};

const SOURCES = {
  appraisal_policy: { commit: CURRENT_WORKTREE_COMMIT, path: 'CLAUDE.md', mode: 'read_and_hash' },
  appraisal_addendum: { commit: CURRENT_WORKTREE_COMMIT, path: 'docs/satei_handoff/12_APPRAISAL_PRINCIPLES_20260809.md', mode: 'read_and_hash' },
  critical_path: { commit: CURRENT_WORKTREE_COMMIT, path: 'docs/satei_handoff/13_CURRENT_CRITICAL_PATH_20260809.md', mode: 'read_and_hash' },
  historical_anchor_audit: { commit: COMMITS.historical_anchor_bank, path: 'docs/audits/speed_historical_high_confidence_anchor_bank_2015_2026.md', mode: 'read_and_hash' },
  historical_measurements: { commit: COMMITS.historical_anchor_bank, path: 'data/normalized/speed_historical_physical_measurements_2015_2026.json', mode: 'json' },
  historical_anchor_bank: { commit: COMMITS.historical_anchor_bank, path: 'outputs/derived/speed_high_confidence_anchor_bank_2015_2026.json', mode: 'json' },
  historical_anchor_graph: { commit: COMMITS.historical_anchor_bank, path: 'outputs/derived/speed_high_confidence_anchor_pairwise_graph_2015_2026.json', mode: 'json' },
  anchor_relative_packets: { commit: COMMITS.historical_anchor_bank, path: 'outputs/derived/speed_2026_100_anchor_relative_packets.json', mode: 'json' },
  physical_sns_queue: { commit: COMMITS.historical_anchor_bank, path: 'outputs/derived/speed_2026_100_sns_tiebreak_queue.csv', mode: 'csv' },
  master_evidence_physical_projection: { commit: COMMITS.decision_packets, path: 'outputs/derived/speed_2026_100_master_evidence.json', mode: 'sanitized_json' },
  npb_plus_exposure: { commit: COMMITS.exposure, path: 'outputs/derived/npb_plus_sprint_exposure_2026.json', mode: 'sanitized_json' },
};

// These artifacts are deliberately not opened because they contain post-freeze
// appraisal/rating or external-QA material outside the Stage 1 information barrier.
const EXCLUDED_ARTIFACTS = [
  {
    commit: COMMITS.decision_packets,
    path: 'outputs/derived/speed_2026_100_decision_packets.json',
    reason: 'Composite packet contains external-QA and provisional appraisal fields; equivalent physical fields are read from the sanitized master-evidence projection.',
  },
  {
    commit: COMMITS.decision_packets,
    path: 'outputs/derived/speed_2026_anchor_pairwise_graph.json',
    reason: 'Not needed after the physical-only historical anchor graph and frozen 2026 anchor-relative packets were loaded.',
  },
  {
    commit: COMMITS.decision_packets,
    path: 'docs/audits/speed_2026_100_decision_packet_audit.md',
    reason: 'Composite audit may discuss external-QA outputs; Stage 1 uses its cited physical source artifacts directly.',
  },
  {
    commit: COMMITS.exposure,
    path: 'outputs/derived/speed_blind_v3_npbplus_2026.json',
    reason: 'Contains a blind-rating/T90 projection and is not a raw physical input for this construct audit.',
  },
  {
    commit: COMMITS.exposure,
    path: 'outputs/derived/speed_blind_v3_powerpro_qa_2026.json',
    reason: 'External game-QA artifact; prohibited until after the Stage 1 freeze.',
  },
];

const CLASSIFICATIONS = new Set([
  'SHORT_DISTANCE_FASTER_THAN_TOP_SPEED_SIGNAL',
  'SHORT_DISTANCE_SLOWER_THAN_TOP_SPEED_SIGNAL',
  'SHORT_DISTANCE_AND_TOP_SPEED_AGREE',
  'DIRECT_T90_TOP_SPEED_CONFLICT',
  'TEMPORAL_CONSTRUCT_CONFLICT',
  'METRIC_CONSTRUCT_CONFLICT',
  'INSUFFICIENT_SHORT_DISTANCE_EVIDENCE',
]);

const SENSITIVE_KEY_PATTERN = /powerpro|pawapuro|the_show|rating|blind_v3|temporal_candidate/i;
const MASTER_NONPHYSICAL_KEYS = new Set([
  'history',
  'temporal',
  'evidence',
  'reason',
  'recommended_review_status',
  'human_judgment_required',
  '_pairwisePhysicalAgreement',
  'source_artifact_references',
  'flags',
  'injury_status',
  'human_review_necessity',
  'evidence_strength',
  'exposure_confidence',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readGitSource(commit, path) {
  return execFileSync('git', ['-C', ROOT, 'show', `${commit}:${path}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function skipWhitespace(text, index) {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

function readJsonString(text, index) {
  if (text[index] !== '"') throw new Error(`Expected JSON string at ${index}`);
  const start = index;
  index += 1;
  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2;
      continue;
    }
    if (text[index] === '"') return [text.slice(start, index + 1), index + 1];
    index += 1;
  }
  throw new Error('Unterminated JSON string while sanitizing a blind-barrier input.');
}

function skipJsonValue(text, index) {
  index = skipWhitespace(text, index);
  if (text[index] === '"') return readJsonString(text, index)[1];
  if (text[index] === '{' || text[index] === '[') {
    const opening = text[index];
    const closing = opening === '{' ? '}' : ']';
    let depth = 0;
    for (; index < text.length; index += 1) {
      if (text[index] === '"') {
        index = readJsonString(text, index)[1] - 1;
        continue;
      }
      if (text[index] === opening) depth += 1;
      if (text[index] === closing && --depth === 0) return index + 1;
    }
    throw new Error('Unterminated JSON container while sanitizing a blind-barrier input.');
  }
  while (index < text.length && !/[\s,}\]]/.test(text[index])) index += 1;
  return index;
}

/**
 * Remove sensitive properties before JSON.parse. skipJsonValue deliberately
 * advances over removed values without converting, retaining, emitting, or
 * hashing those values. The raw file hash identifies the frozen source file.
 */
function sanitizeJsonBeforeParse(raw, shouldOmitKey) {
  const omittedKeyCounts = new Map();

  function sanitizeValue(index) {
    index = skipWhitespace(raw, index);
    if (raw[index] === '"') return readJsonString(raw, index);
    if (raw[index] === '{') {
      let output = '{';
      let first = true;
      index = skipWhitespace(raw, index + 1);
      while (raw[index] !== '}') {
        const [rawKey, afterKey] = readJsonString(raw, index);
        const key = JSON.parse(rawKey);
        index = skipWhitespace(raw, afterKey);
        if (raw[index] !== ':') throw new Error(`Expected ':' after key ${key}.`);
        index += 1;
        if (shouldOmitKey(key)) {
          omittedKeyCounts.set(key, (omittedKeyCounts.get(key) ?? 0) + 1);
          index = skipWhitespace(raw, skipJsonValue(raw, index));
          if (raw[index] === ',') index = skipWhitespace(raw, index + 1);
          continue;
        }
        const [value, afterValue] = sanitizeValue(index);
        output += `${first ? '' : ','}${rawKey}:${value}`;
        first = false;
        index = skipWhitespace(raw, afterValue);
        if (raw[index] === ',') index = skipWhitespace(raw, index + 1);
        else if (raw[index] !== '}') throw new Error(`Expected ',' or '}' after key ${key}.`);
      }
      return [`${output}}`, index + 1];
    }
    if (raw[index] === '[') {
      let output = '[';
      let first = true;
      index = skipWhitespace(raw, index + 1);
      while (raw[index] !== ']') {
        const [value, afterValue] = sanitizeValue(index);
        output += `${first ? '' : ','}${value}`;
        first = false;
        index = skipWhitespace(raw, afterValue);
        if (raw[index] === ',') index = skipWhitespace(raw, index + 1);
        else if (raw[index] !== ']') throw new Error("Expected ',' or ']' in JSON array.");
      }
      return [`${output}]`, index + 1];
    }
    const afterPrimitive = skipJsonValue(raw, index);
    return [raw.slice(index, afterPrimitive), afterPrimitive];
  }

  const [sanitized, ending] = sanitizeValue(0);
  if (skipWhitespace(raw, ending) !== raw.length) throw new Error('Unexpected trailing JSON content after sanitization.');
  return {
    sanitized,
    omitted_key_counts: Object.fromEntries([...omittedKeyCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}

function assertNoForbiddenKeys(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) throw new Error(`Blind barrier failed: parsed forbidden key at ${path}.${key}`);
    assertNoForbiddenKeys(nested, `${path}.${key}`);
  }
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
  if (cell !== '' || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.filter((values) => values.some((value) => value !== '')).map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])));
}

function csvEscape(value) {
  const rendered = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return /[",\n\r]/.test(rendered) ? `"${rendered.replaceAll('"', '""')}"` : rendered;
}

function toCsv(rows, columns) {
  return `${columns.join(',')}\n${rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')).join('\n')}\n`;
}

function nonEmpty(value) {
  return value === undefined || value === null || value === '' ? null : value;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))];
}

function projectPhysicalEvidence(evidence) {
  return {
    metric: nonEmpty(evidence.metric),
    seconds: nonEmpty(evidence.seconds),
    value: nonEmpty(evidence.value),
    unit: nonEmpty(evidence.unit),
    measurement_year: nonEmpty(evidence.effective_measurement_year ?? evidence.measurement_year ?? evidence.source_measurement_year),
    measurement_date: nonEmpty(evidence.measurement_date),
    measurement_year_inferred: nonEmpty(evidence.measurement_year_inferred),
    cohort: nonEmpty(evidence.cohort),
    timing_method: nonEmpty(evidence.timing_method),
    start_protocol: nonEmpty(evidence.start_protocol),
    source_tier: nonEmpty(evidence.source_tier),
    usage_class: nonEmpty(evidence.usage_class_preserved ?? evidence.usage_class),
    numeric_t90_usable: nonEmpty(evidence.numeric_t90_usable_preserved ?? evidence.numeric_t90_usable),
    same_measurement_cluster_id: nonEmpty(evidence.same_measurement_cluster_id),
    source_name: nonEmpty(evidence.source_name),
    source_url: nonEmpty(evidence.source_url),
    reason: nonEmpty(evidence.reason),
  };
}

function scrubRestrictedOutputText(value) {
  if (typeof value === 'string') {
    return SENSITIVE_KEY_PATTERN.test(value) ? '[REDACTED_NONPHYSICAL_SOURCE_TEXT]' : value;
  }
  if (Array.isArray(value)) return value.map(scrubRestrictedOutputText);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, scrubRestrictedOutputText(nested)]));
}

function metricMatches(evidence, metres) {
  const metric = String(evidence.metric ?? '').toUpperCase().replaceAll(' ', '');
  return metric.includes(`${metres}M`);
}

function selectMetricEvidence(evidence, metres) {
  return evidence.filter((entry) => metricMatches(entry, metres)).map(projectPhysicalEvidence);
}

function explicitMeasurementYear(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 2100) return value;
  const normalized = String(value ?? '').trim();
  if (/^(?:19|20)\d{2}$/.test(normalized)) return Number(normalized);
  const embeddedYear = normalized.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return embeddedYear ? Number(embeddedYear[1]) : null;
}

function comparisonTemporalBoundary(comparisonRelevantEvidence) {
  const knownYears = unique(comparisonRelevantEvidence.map((entry) => explicitMeasurementYear(entry.measurement_year))).sort((left, right) => left - right);
  const unknownEraCount = comparisonRelevantEvidence.filter((entry) => explicitMeasurementYear(entry.measurement_year) === null).length;
  const knownNon2026Years = knownYears.filter((year) => year !== 2026);
  return {
    current_signal_year: 2026,
    comparison_relevant_evidence_count: comparisonRelevantEvidence.length,
    known_measurement_years: knownYears,
    known_non_2026_measurement_years: knownNon2026Years,
    unknown_measurement_era_count: unknownEraCount,
    has_known_non_2026_measurement: knownNon2026Years.length > 0,
    has_unknown_measurement_era: unknownEraCount > 0,
    all_comparison_relevant_measurements_current_2026: comparisonRelevantEvidence.length > 0
      && knownNon2026Years.length === 0
      && unknownEraCount === 0
      && knownYears.includes(2026),
  };
}

function classifyPhysicalConstruct(masterRow, comparisonRelevantEvidence) {
  const agreement = masterRow.conflict_classification?.evidence_agreement ?? null;
  const temporalBoundary = comparisonTemporalBoundary(comparisonRelevantEvidence);
  if (temporalBoundary.has_known_non_2026_measurement) {
    return {
      acceleration_top_speed_classification: 'TEMPORAL_CONSTRUCT_CONFLICT',
      physical_conflict_flags: ['TEMPORAL_CONSTRUCT_CONFLICT'],
      classification_basis: 'V2_KNOWN_NON_2026_COMPARISON_MEASUREMENT',
      temporal_boundary: temporalBoundary,
    };
  }
  if (comparisonRelevantEvidence.length === 0 || temporalBoundary.has_unknown_measurement_era) {
    return {
      acceleration_top_speed_classification: 'INSUFFICIENT_SHORT_DISTANCE_EVIDENCE',
      physical_conflict_flags: ['INSUFFICIENT_SHORT_DISTANCE_EVIDENCE'],
      classification_basis: comparisonRelevantEvidence.length === 0
        ? 'NO_DIRECTIONALLY_COMPARABLE_SHORT_DISTANCE_EVIDENCE'
        : 'V2_UNKNOWN_COMPARISON_MEASUREMENT_ERA',
      temporal_boundary: temporalBoundary,
    };
  }
  if (agreement === 'DIRECTIONALLY_AGREES_WITH_SHARED_STANDARDIZED_COHORT') {
    return {
      acceleration_top_speed_classification: 'SHORT_DISTANCE_AND_TOP_SPEED_AGREE',
      physical_conflict_flags: ['SHORT_DISTANCE_AND_TOP_SPEED_AGREE'],
      classification_basis: agreement,
      temporal_boundary: temporalBoundary,
    };
  }
  if (agreement === 'DIRECTIONAL_CONFLICT_IN_SHARED_STANDARDIZED_COHORT') {
    return {
      acceleration_top_speed_classification: 'METRIC_CONSTRUCT_CONFLICT',
      physical_conflict_flags: ['METRIC_CONSTRUCT_CONFLICT'],
      classification_basis: agreement,
      temporal_boundary: temporalBoundary,
    };
  }
  return {
    acceleration_top_speed_classification: 'INSUFFICIENT_SHORT_DISTANCE_EVIDENCE',
    physical_conflict_flags: ['INSUFFICIENT_SHORT_DISTANCE_EVIDENCE'],
    classification_basis: agreement ?? 'NO_DIRECTIONALLY_COMPARABLE_SHORT_DISTANCE_EVIDENCE',
    temporal_boundary: temporalBoundary,
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function sourceReceipt(source, raw, extra = {}) {
  return {
    commit: source.commit,
    path: source.path,
    raw_source_sha256: sha256(raw),
    raw_source_bytes: Buffer.byteLength(raw),
    ...extra,
  };
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const sourceRaw = {};
const sourceReceipts = {};
for (const [name, source] of Object.entries(SOURCES)) {
  sourceRaw[name] = readGitSource(source.commit, source.path);
  sourceReceipts[name] = sourceReceipt(source, sourceRaw[name]);
}

const historicalMeasurements = JSON.parse(sourceRaw.historical_measurements);
const historicalAnchorBank = JSON.parse(sourceRaw.historical_anchor_bank);
const historicalAnchorGraph = JSON.parse(sourceRaw.historical_anchor_graph);
const anchorPackets = JSON.parse(sourceRaw.anchor_relative_packets);
const physicalSnsQueue = parseCsv(sourceRaw.physical_sns_queue);

const masterSanitized = sanitizeJsonBeforeParse(
  sourceRaw.master_evidence_physical_projection,
  (key) => SENSITIVE_KEY_PATTERN.test(key) || MASTER_NONPHYSICAL_KEYS.has(key),
);
const masterEvidence = JSON.parse(masterSanitized.sanitized);
assertNoForbiddenKeys(masterEvidence);
sourceReceipts.master_evidence_physical_projection = {
  ...sourceReceipts.master_evidence_physical_projection,
  sanitized_source_sha256: sha256(masterSanitized.sanitized),
  omitted_before_parse: masterSanitized.omitted_key_counts,
};

const exposureSanitized = sanitizeJsonBeforeParse(
  sourceRaw.npb_plus_exposure,
  (key) => key === 'pawapuro_2026_speed' || SENSITIVE_KEY_PATTERN.test(key),
);
const exposureAudit = JSON.parse(exposureSanitized.sanitized);
assertNoForbiddenKeys(exposureAudit);
sourceReceipts.npb_plus_exposure = {
  ...sourceReceipts.npb_plus_exposure,
  sanitized_source_sha256: sha256(exposureSanitized.sanitized),
  omitted_before_parse: exposureSanitized.omitted_key_counts,
};

if (anchorPackets.packets.length !== 100) throw new Error(`Expected 100 anchor-relative packets; received ${anchorPackets.packets.length}.`);
if (masterEvidence.rows.length !== 100) throw new Error(`Expected 100 sanitized master-evidence rows; received ${masterEvidence.rows.length}.`);
if (exposureAudit.players.length !== 100) throw new Error(`Expected 100 sanitized exposure rows; received ${exposureAudit.players.length}.`);

const masterByPlayerId = new Map(masterEvidence.rows.map((row) => [String(row.player_id), row]));
const exposureByPlayerId = new Map(exposureAudit.players.map((row) => [String(row.player_id), row]));
const physicalMeasurementsByPlayer = new Map();
for (const record of historicalMeasurements.records) {
  const key = String(record.player_key ?? record.player ?? '');
  if (!key) continue;
  const current = physicalMeasurementsByPlayer.get(key) ?? [];
  current.push(record);
  physicalMeasurementsByPlayer.set(key, current);
}

const queueByPlayerTeam = new Map(physicalSnsQueue.map((row) => [`${row.player}\u0000${row.team}`, row]));
const profiles = anchorPackets.packets.map((packet) => {
  const playerId = String(packet.player_id);
  const master = masterByPlayerId.get(playerId);
  const exposure = exposureByPlayerId.get(playerId);
  if (!master) throw new Error(`Missing sanitized master-evidence row for player_id=${playerId}.`);
  if (!exposure) throw new Error(`Missing sanitized exposure row for player_id=${playerId}.`);

  const directT90Evidence = (master.direct_t90_evidence ?? []).map(projectPhysicalEvidence);
  const standardizedEvidence = master.standardized_short_distance_evidence ?? [];
  const standardizedShortDistanceEvidence = standardizedEvidence.map(projectPhysicalEvidence);
  const standardized30mEvidence = selectMetricEvidence(standardizedEvidence, 30);
  const standardized50mEvidence = selectMetricEvidence(standardizedEvidence, 50);
  const historicalEvidence = (master.historical_profile_evidence ?? []).map(projectPhysicalEvidence);
  const contextOnlyEvidence = (master.context_only_evidence ?? []).map(projectPhysicalEvidence);
  const physicalMeasurementReceipts = physicalMeasurementsByPlayer.get(String(packet.current_npb_plus_anchor?.player_key ?? '').trim()) ?? [];
  const comparisonRelevantEvidence = [...directT90Evidence, ...standardizedShortDistanceEvidence];
  const classification = classifyPhysicalConstruct(master, comparisonRelevantEvidence);
  if (!CLASSIFICATIONS.has(classification.acceleration_top_speed_classification)) {
    throw new Error(`Unapproved Stage 1 classification: ${classification.acceleration_top_speed_classification}`);
  }

  const measurementEras = unique([
    ...directT90Evidence.map((entry) => entry.measurement_year),
    ...standardizedShortDistanceEvidence.map((entry) => entry.measurement_year),
    ...standardized30mEvidence.map((entry) => entry.measurement_year),
    ...standardized50mEvidence.map((entry) => entry.measurement_year),
    ...historicalEvidence.map((entry) => entry.measurement_year),
  ]);
  const existingQueue = queueByPlayerTeam.get(`${packet.player}\u0000${packet.team}`);
  const requiresPhysicalSnsQueue = Boolean(existingQueue)
    || classification.acceleration_top_speed_classification === 'METRIC_CONSTRUCT_CONFLICT'
    || classification.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT'
    || packet.status === 'SNS_TIEBREAK';

  return {
    stage: 'STAGE_1_BLIND_PHYSICAL_CONSTRUCT_V2',
    player: packet.player,
    player_id: playerId,
    team: packet.team,
    position: null,
    age: null,
    handedness: null,
    npb_plus_sprint_speed_kmh: nonEmpty(packet.current_npb_plus_anchor?.value),
    npb_plus_ordinal_band: nonEmpty(packet.current_npb_plus_anchor?.speed_band),
    npb_plus_cohort_rank: nonEmpty(packet.current_npb_plus_anchor?.cohort_rank),
    npb_plus_cohort_size: nonEmpty(packet.current_npb_plus_anchor?.cohort_size),
    exposure: {
      PA: nonEmpty(exposure.PA),
      games: nonEmpty(exposure.games),
      pa_bucket: nonEmpty(exposure.pa_bucket),
      full_effort_run_proxy_count: nonEmpty(exposure.full_effort_run_proxy_count),
      npb_plus_sample_count: nonEmpty(exposure.npb_plus_sample_count),
      npb_plus_qualified_run_count: nonEmpty(exposure.npb_plus_qualified_run_count),
      data_completeness: nonEmpty(exposure.data_completeness),
    },
    direct_t90: directT90Evidence,
    direct_t90_measurement_year: unique(directT90Evidence.map((entry) => entry.measurement_year)),
    standardized_short_distance_evidence: standardizedShortDistanceEvidence,
    standardized_30m: standardized30mEvidence,
    standardized_50m: standardized50mEvidence,
    cohort: unique([
      packet.current_npb_plus_anchor?.cohort_id,
      ...directT90Evidence.map((entry) => entry.cohort),
      ...standardized30mEvidence.map((entry) => entry.cohort),
      ...standardized50mEvidence.map((entry) => entry.cohort),
    ]),
    cohort_ordinal: {
      current_npb_plus_rank: nonEmpty(packet.current_npb_plus_anchor?.cohort_rank),
      current_npb_plus_size: nonEmpty(packet.current_npb_plus_anchor?.cohort_size),
      current_npb_plus_band: nonEmpty(packet.current_npb_plus_anchor?.speed_band),
      basis: 'WITHIN_SAME_METRIC_SAME_COHORT_ONLY',
    },
    historical_physical_evidence: historicalEvidence,
    measurement_era: measurementEras,
    anchor_relative_status: {
      status: packet.status,
      status_reasons: packet.status_reasons ?? [],
      high_confidence_anchor_count: (packet.high_confidence_physical_anchors ?? []).length,
      same_cohort_order_conflict_count: (packet.same_cohort_order_conflicts ?? []).length,
    },
    acceleration_top_speed_classification: classification.acceleration_top_speed_classification,
    classification_basis: classification.classification_basis,
    physical_conflict_flags: classification.physical_conflict_flags,
    temporal_comparison_boundary: classification.temporal_boundary,
    context_only_hp_to_1b: contextOnlyEvidence,
    context_only_statement: 'HP_TO_1B_CONTEXT_ONLY_NOT_USED_FOR_STAGE_1_ACCELERATION_CLASSIFICATION',
    physical_source_receipts: {
      historical_measurement_record_count: physicalMeasurementReceipts.length,
      historical_measurement_record_ids: physicalMeasurementReceipts.map((record) => record.raw_id).filter(Boolean),
      master_physical_join_status: master.identity?.physical_join_status ?? null,
      anchor_packet_id: packet.packet_id,
    },
    physical_only_sns_queue_status: requiresPhysicalSnsQueue
      ? (existingQueue
        ? 'RETAINED_FROM_EXISTING_PHYSICAL_QUEUE'
        : classification.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT'
          ? 'ADDED_FOR_TEMPORAL_CONSTRUCT_CONFLICT'
          : 'ADDED_FOR_METRIC_CONSTRUCT_CONFLICT')
      : 'NOT_QUEUED',
  };
});

const playerIds = new Set(profiles.map((profile) => profile.player_id));
if (profiles.length !== 100 || playerIds.size !== 100) throw new Error(`Profile uniqueness check failed: rows=${profiles.length}, unique_player_ids=${playerIds.size}.`);

const CURRENT_COMPARABLE_ACCELERATION_CLASSES = new Set([
  'SHORT_DISTANCE_FASTER_THAN_TOP_SPEED_SIGNAL',
  'SHORT_DISTANCE_SLOWER_THAN_TOP_SPEED_SIGNAL',
  'SHORT_DISTANCE_AND_TOP_SPEED_AGREE',
  'METRIC_CONSTRUCT_CONFLICT',
]);
const accelerationEvidenceSubset = profiles.filter((profile) => (
  profile.standardized_short_distance_evidence.length > 0
  && CURRENT_COMPARABLE_ACCELERATION_CLASSES.has(profile.acceleration_top_speed_classification)
  && profile.temporal_comparison_boundary.all_comparison_relevant_measurements_current_2026
));
const physicalOnlySnsQueue = profiles.filter((profile) => profile.physical_only_sns_queue_status !== 'NOT_QUEUED').map((profile) => {
  const sourceQueueRow = queueByPlayerTeam.get(`${profile.player}\u0000${profile.team}`);
  return {
    player: profile.player,
    player_id: profile.player_id,
    team: profile.team,
    queue_change: sourceQueueRow ? 'retained' : 'added',
    reason: sourceQueueRow
      ? 'RETAINED_FROM_EXISTING_PHYSICAL_QUEUE'
      : profile.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT'
        ? 'ADDED_FOR_TEMPORAL_CONSTRUCT_CONFLICT'
        : 'ADDED_FOR_METRIC_CONSTRUCT_CONFLICT',
    source_reason_codes: sourceQueueRow?.reason_codes || null,
    confirmation_target: sourceQueueRow?.confirmation_target || null,
    source_status: sourceQueueRow?.status || null,
    classification: profile.acceleration_top_speed_classification,
    no_game_ratings_read: true,
  };
});

const classificationCounts = Object.fromEntries([...CLASSIFICATIONS].sort().map((classification) => [
  classification,
  profiles.filter((profile) => profile.acceleration_top_speed_classification === classification).length,
]));
const frozenProfiles = profiles.map(scrubRestrictedOutputText);
const frozenAccelerationEvidenceSubset = frozenProfiles.filter((profile) => (
  profile.standardized_short_distance_evidence.length > 0
  && CURRENT_COMPARABLE_ACCELERATION_CLASSES.has(profile.acceleration_top_speed_classification)
  && profile.temporal_comparison_boundary.all_comparison_relevant_measurements_current_2026
));
const frozenPhysicalOnlySnsQueue = physicalOnlySnsQueue.map(scrubRestrictedOutputText);

const outputProfilesJson = resolve(OUTPUT_DIR, 'speed_2026_blind_physical_construct_profiles.json');
const outputProfilesCsv = resolve(OUTPUT_DIR, 'speed_2026_blind_physical_construct_profiles.csv');
const outputAccelerationCsv = resolve(OUTPUT_DIR, 'speed_2026_acceleration_evidence_subset.csv');
const outputManifest = resolve(OUTPUT_DIR, 'speed_2026_blind_physical_construct_freeze_manifest.json');
const outputQa = resolve(OUTPUT_DIR, 'speed_2026_blind_physical_construct_stage1_qa.json');

const profileCsvRows = frozenProfiles.map((profile) => ({
  player: profile.player,
  player_id: profile.player_id,
  team: profile.team,
  position: profile.position,
  age: profile.age,
  handedness: profile.handedness,
  npb_plus_sprint_speed_kmh: profile.npb_plus_sprint_speed_kmh,
  npb_plus_ordinal_band: profile.npb_plus_ordinal_band,
  npb_plus_cohort_rank: profile.npb_plus_cohort_rank,
  npb_plus_cohort_size: profile.npb_plus_cohort_size,
  exposure: profile.exposure,
  direct_t90: profile.direct_t90,
  direct_t90_measurement_year: profile.direct_t90_measurement_year,
  standardized_short_distance_evidence: profile.standardized_short_distance_evidence,
  standardized_30m: profile.standardized_30m,
  standardized_50m: profile.standardized_50m,
  cohort: profile.cohort,
  cohort_ordinal: profile.cohort_ordinal,
  historical_physical_evidence: profile.historical_physical_evidence,
  measurement_era: profile.measurement_era,
  anchor_relative_status: profile.anchor_relative_status,
  acceleration_top_speed_classification: profile.acceleration_top_speed_classification,
  classification_basis: profile.classification_basis,
  physical_conflict_flags: profile.physical_conflict_flags,
  temporal_comparison_boundary: profile.temporal_comparison_boundary,
  context_only_hp_to_1b: profile.context_only_hp_to_1b,
  physical_only_sns_queue_status: profile.physical_only_sns_queue_status,
}));

const accelerationCsvRows = frozenAccelerationEvidenceSubset.map((profile) => ({
  player: profile.player,
  player_id: profile.player_id,
  team: profile.team,
  npb_plus_sprint_speed_kmh: profile.npb_plus_sprint_speed_kmh,
  npb_plus_ordinal_band: profile.npb_plus_ordinal_band,
  exposure: profile.exposure,
  standardized_short_distance_evidence: profile.standardized_short_distance_evidence,
  standardized_30m: profile.standardized_30m,
  standardized_50m: profile.standardized_50m,
  direct_t90: profile.direct_t90,
  measurement_era: profile.measurement_era,
  acceleration_top_speed_classification: profile.acceleration_top_speed_classification,
  classification_basis: profile.classification_basis,
  physical_conflict_flags: profile.physical_conflict_flags,
  temporal_comparison_boundary: profile.temporal_comparison_boundary,
}));

const profileCsvColumns = Object.keys(profileCsvRows[0]);
const accelerationCsvColumns = Object.keys(accelerationCsvRows[0] ?? {
  player: null,
  player_id: null,
  team: null,
  npb_plus_sprint_speed_kmh: null,
  npb_plus_ordinal_band: null,
  exposure: null,
  standardized_short_distance_evidence: null,
  standardized_30m: null,
  standardized_50m: null,
  direct_t90: null,
  measurement_era: null,
  acceleration_top_speed_classification: null,
  classification_basis: null,
  physical_conflict_flags: null,
  temporal_comparison_boundary: null,
});

const profileDocument = {
  schema_version: 'speed-2026-stage1-blind-physical-construct/v2.0.0',
  stage: 'STAGE_1_BLIND_PHYSICAL_CONSTRUCT_V2_FREEZE',
  generated_at: generatedAt,
  target_roster_count: 100,
  profile_count: profiles.length,
  classification_counts: classificationCounts,
  barrier: {
    no_external_game_values_read: true,
    no_cross_metric_percentile_subtraction_or_conversion: true,
    no_fixed_age_decay: true,
    hp_to_1b_context_only: true,
    known_non_2026_comparison_measurements_are_temporal_conflicts: true,
    unknown_comparison_measurement_era_is_insufficient: true,
  },
  profiles: frozenProfiles,
};

writeJson(outputProfilesJson, profileDocument);
writeFileSync(outputProfilesCsv, toCsv(profileCsvRows, profileCsvColumns), 'utf8');
writeFileSync(outputAccelerationCsv, toCsv(accelerationCsvRows, accelerationCsvColumns), 'utf8');

const builderRelativePath = relative(ROOT, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const manifest = {
  schema_version: 'speed-2026-stage1-blind-physical-construct-freeze/v2.0.0',
  stage: 'STAGE_1_V2_FREEZE',
  generated_at: generatedAt,
  source_commits: COMMITS,
  source_inputs: sourceReceipts,
  excluded_artifacts_to_preserve_blind_barrier: EXCLUDED_ARTIFACTS,
  blind_barrier_proof: {
    removal_happened_before_json_parse: true,
    raw_source_hash_is_file_level_only: true,
    npb_plus_exposure_sensitive_field_rule: 'Exclude pawapuro_2026_speed before parsing; do not retain, emit, or derive from its values.',
    composite_master_sensitive_key_rule: 'Exclude keys matching powerpro|pawapuro|the_show|rating|blind_v3|temporal_candidate and nonphysical composite blocks before parsing.',
    parsed_forbidden_key_self_test: 'PASS',
    output_game_rating_or_residual_self_test: 'PASS',
  },
  classification_policy: {
    allowed_labels: [...CLASSIFICATIONS].sort(),
    temporal_precedence_rule: 'For the current 2026 signal, any comparably relevant direct-T90 or standardized-short-distance measurement explicitly dated other than 2026 is TEMPORAL_CONSTRUCT_CONFLICT.',
    unknown_era_rule: 'Unknown comparison-measurement era is INSUFFICIENT_SHORT_DISTANCE_EVIDENCE unless an explicitly known non-2026 measurement independently triggers temporal precedence.',
    directional_agreement_rule: 'Use SHORT_DISTANCE_AND_TOP_SPEED_AGREE only for existing shared-standardized-cohort directional agreement when all comparison-relevant measurements are explicitly 2026.',
    directional_conflict_rule: 'Use METRIC_CONSTRUCT_CONFLICT only for existing shared-standardized-cohort directional conflict when all comparison-relevant measurements are explicitly 2026.',
    fallback_rule: 'Use INSUFFICIENT_SHORT_DISTANCE_EVIDENCE where the available physical evidence does not support a direction without a prohibited cross-metric bridge.',
    prohibited: [
      'NO_CROSS_METRIC_PERCENTILE_SUBTRACTION',
      'NO_50M_TO_T90_CONVERSION',
      'NO_NPB_PLUS_TO_T90_CONVERSION',
      'NO_FIXED_AGE_DECAY',
      'NO_HP_TO_1B_ACCELERATION_INPUT',
    ],
  },
  coverage: {
    profiles: profiles.length,
    unique_player_ids: playerIds.size,
    direct_t90_available: profiles.filter((profile) => profile.direct_t90.length > 0).length,
    standardized_short_distance_available: accelerationEvidenceSubset.length,
    standardized_30m_available: profiles.filter((profile) => profile.standardized_30m.length > 0).length,
    standardized_50m_available: profiles.filter((profile) => profile.standardized_50m.length > 0).length,
    temporal_construct_conflicts: profiles.filter((profile) => profile.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT').length,
    known_non_2026_comparison_measurements: profiles.filter((profile) => profile.temporal_comparison_boundary.has_known_non_2026_measurement).length,
    unknown_comparison_measurement_eras: profiles.filter((profile) => profile.temporal_comparison_boundary.has_unknown_measurement_era).length,
    physical_only_sns_queue_current: physicalOnlySnsQueue.length,
    physical_only_sns_queue_retained: physicalOnlySnsQueue.filter((entry) => entry.queue_change === 'retained').length,
    physical_only_sns_queue_added: physicalOnlySnsQueue.filter((entry) => entry.queue_change === 'added').length,
    physical_only_sns_queue_removed: 0,
    classification_counts: classificationCounts,
  },
  v1_supersession: {
    record_id: 'STAGE1_TEMPORAL_BOUNDARY_QA_FAIL_002',
    state: 'V1_SUPERSEDED_BY_V2',
    finding: 'The prior freeze did not enforce the current-signal temporal boundary for explicitly dated non-current comparison evidence.',
    remediation: 'V2 retains measurement years, assigns known non-2026 comparison evidence to TEMPORAL_CONSTRUCT_CONFLICT, and excludes temporal-conflict rows from the usable acceleration subset.',
    affected_artifacts_overwritten_in_place: [
      'scripts/build_speed_2026_blind_physical_construct_profiles.mjs',
      'outputs/derived/speed_2026_blind_physical_construct_profiles.json',
      'outputs/derived/speed_2026_blind_physical_construct_profiles.csv',
      'outputs/derived/speed_2026_acceleration_evidence_subset.csv',
      'outputs/derived/speed_2026_blind_physical_construct_freeze_manifest.json',
      'outputs/derived/speed_2026_blind_physical_construct_stage1_qa.json',
    ],
  },
  frozen_artifact_sha256: {
    [builderRelativePath]: fileSha256(fileURLToPath(import.meta.url)),
    'outputs/derived/speed_2026_blind_physical_construct_profiles.json': fileSha256(outputProfilesJson),
    'outputs/derived/speed_2026_blind_physical_construct_profiles.csv': fileSha256(outputProfilesCsv),
    'outputs/derived/speed_2026_acceleration_evidence_subset.csv': fileSha256(outputAccelerationCsv),
  },
  manifest_self_hash_note: 'The manifest cannot contain its own final SHA-256 without a circular rewrite. Its final SHA-256 is recorded in the Stage-1-only QA companion.',
};
writeJson(outputManifest, manifest);

const outputTexts = [
  readFileSync(outputProfilesJson, 'utf8'),
  readFileSync(outputProfilesCsv, 'utf8'),
  readFileSync(outputAccelerationCsv, 'utf8'),
];
if (outputTexts.some((text) => /powerpro|pawapuro|the_show|residual|blind_rating/i.test(text))) {
  throw new Error('Blind barrier failed: a Stage 1 profile artifact contains a prohibited game/rating/residual token.');
}
if (profiles.some((profile) => !CLASSIFICATIONS.has(profile.acceleration_top_speed_classification))) {
  throw new Error('Stage 1 class-label validation failed.');
}
if (accelerationEvidenceSubset.some((profile) => profile.standardized_short_distance_evidence.length === 0)) {
  throw new Error('Acceleration evidence subset contains a row without standardized short-distance evidence.');
}
const nonTemporalClassesForbiddenForKnownNon2026 = new Set([
  'SHORT_DISTANCE_AND_TOP_SPEED_AGREE',
  'SHORT_DISTANCE_FASTER_THAN_TOP_SPEED_SIGNAL',
  'SHORT_DISTANCE_SLOWER_THAN_TOP_SPEED_SIGNAL',
  'DIRECT_T90_TOP_SPEED_CONFLICT',
  'METRIC_CONSTRUCT_CONFLICT',
]);
if (profiles.some((profile) => (
  profile.temporal_comparison_boundary.has_known_non_2026_measurement
  && nonTemporalClassesForbiddenForKnownNon2026.has(profile.acceleration_top_speed_classification)
))) {
  throw new Error('V2 temporal boundary failed: a known non-2026 comparison measurement received a forbidden non-temporal classification.');
}
if (profiles.some((profile) => (
  profile.temporal_comparison_boundary.has_unknown_measurement_era
  && !profile.temporal_comparison_boundary.has_known_non_2026_measurement
  && profile.acceleration_top_speed_classification !== 'INSUFFICIENT_SHORT_DISTANCE_EVIDENCE'
))) {
  throw new Error('V2 temporal boundary failed: an unknown-only comparison era received a non-insufficient classification.');
}
if (accelerationEvidenceSubset.some((profile) => (
  profile.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT'
  || !profile.temporal_comparison_boundary.all_comparison_relevant_measurements_current_2026
))) {
  throw new Error('V2 acceleration subset failed: it includes a temporal conflict or non-current comparison evidence.');
}

const qa = {
  schema_version: 'speed-2026-stage1-blind-physical-construct-qa/v2.0.0',
  stage: 'STAGE_1_V2_ONLY',
  generated_at: generatedAt,
  checks: {
    exact_100_profiles: profiles.length === 100,
    unique_100_player_ids: playerIds.size === 100,
    anchor_packet_roster_100: anchorPackets.packets.length === 100,
    sanitized_master_roster_100: masterEvidence.rows.length === 100,
    sanitized_exposure_roster_100: exposureAudit.players.length === 100,
    only_allowed_class_labels: profiles.every((profile) => CLASSIFICATIONS.has(profile.acceleration_top_speed_classification)),
    acceleration_subset_has_only_standardized_short_distance_evidence: accelerationEvidenceSubset.every((profile) => profile.standardized_short_distance_evidence.length > 0),
    forbidden_keys_removed_before_parse: true,
    profile_outputs_have_no_game_rating_or_residual_tokens: true,
    no_cross_metric_conversion_or_percentile_subtraction: true,
    no_fixed_age_decay: true,
    hp_to_1b_context_only: true,
    known_non_2026_comparison_measurement_is_always_temporal: profiles.every((profile) => (
      !profile.temporal_comparison_boundary.has_known_non_2026_measurement
      || profile.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT'
    )),
    unknown_only_comparison_measurement_era_is_insufficient: profiles.every((profile) => (
      !profile.temporal_comparison_boundary.has_unknown_measurement_era
      || profile.temporal_comparison_boundary.has_known_non_2026_measurement
      || profile.acceleration_top_speed_classification === 'INSUFFICIENT_SHORT_DISTANCE_EVIDENCE'
    )),
    no_known_non_2026_measurement_has_forbidden_non_temporal_classification: profiles.every((profile) => (
      !profile.temporal_comparison_boundary.has_known_non_2026_measurement
      || !nonTemporalClassesForbiddenForKnownNon2026.has(profile.acceleration_top_speed_classification)
    )),
    acceleration_subset_excludes_temporal_conflicts: accelerationEvidenceSubset.every((profile) => profile.acceleration_top_speed_classification !== 'TEMPORAL_CONSTRUCT_CONFLICT'),
    acceleration_subset_is_explicitly_current_2026_only: accelerationEvidenceSubset.every((profile) => profile.temporal_comparison_boundary.all_comparison_relevant_measurements_current_2026),
  },
  counts: {
    classification_counts: classificationCounts,
    direct_t90_available: profiles.filter((profile) => profile.direct_t90.length > 0).length,
    standardized_short_distance_available: accelerationEvidenceSubset.length,
    standardized_short_distance_observed_before_temporal_boundary: profiles.filter((profile) => profile.standardized_short_distance_evidence.length > 0).length,
    temporal_construct_conflicts: profiles.filter((profile) => profile.acceleration_top_speed_classification === 'TEMPORAL_CONSTRUCT_CONFLICT').length,
    known_non_2026_comparison_measurements: profiles.filter((profile) => profile.temporal_comparison_boundary.has_known_non_2026_measurement).length,
    unknown_comparison_measurement_eras: profiles.filter((profile) => profile.temporal_comparison_boundary.has_unknown_measurement_era).length,
    physical_only_sns_queue: {
      existing_source_rows: physicalSnsQueue.length,
      retained: physicalOnlySnsQueue.filter((entry) => entry.queue_change === 'retained').length,
      added: physicalOnlySnsQueue.filter((entry) => entry.queue_change === 'added').length,
      removed: 0,
    },
  },
  physical_only_sns_queue: frozenPhysicalOnlySnsQueue,
  guard_history: [
    {
      guard_id: 'STAGE1_TEMPORAL_BOUNDARY_QA_FAIL_002',
      state: 'V1_SUPERSEDED_AND_V2_VALIDATED',
      detection: 'The V1 freeze did not apply the explicit current-signal temporal boundary to all dated comparison evidence.',
      game_value_handling: 'No external game value was read or used while repairing this Stage 1 boundary.',
      remediation: 'V2 preserves physical measurement years, makes known non-2026 comparison evidence temporal-conflicted, and removes such rows from the usable acceleration subset.',
      rerun_status: 'PASS_ON_THIS_V2_FREEZE',
    },
    {
      guard_id: 'STAGE1_OUTPUT_TEXT_GUARD_TRIP_001',
      state: 'DETECTED_AND_REMEDIATED',
      detection: 'A pre-finalization lexical self-test stopped the first Stage 1 build after restricted nonphysical source text reached a provisional output.',
      game_value_handling: 'No prohibited game value was parsed, retained, emitted, or used for a Stage 1 classification.',
      remediation: 'All Stage 1 output free-text fields are scrubbed before serialization; only physical evidence and neutral classifications remain.',
      rerun_status: 'PASS_ON_THIS_FREEZE',
    },
  ],
  negative_findings: [
    'No numeric NPB_PLUS-to-T90 bridge was used or created.',
    'No 50m-to-T90 conversion was used or created.',
    'No fixed age-decay adjustment was used or created.',
    'No HP-to-1B evidence was used in acceleration/top-speed classification.',
    'No directional acceleration/top-speed signal was forced where a shared standardized-cohort directional comparison was unavailable.',
  ],
  manifest_sha256: fileSha256(outputManifest),
};
writeJson(outputQa, qa);

console.log(JSON.stringify({
  status: 'PASS',
  generated_at: generatedAt,
  profile_count: profiles.length,
  acceleration_evidence_subset_count: accelerationEvidenceSubset.length,
  classification_counts: classificationCounts,
  physical_only_sns_queue_count: physicalOnlySnsQueue.length,
  artifacts: [
    relative(ROOT, outputProfilesJson).replaceAll('\\', '/'),
    relative(ROOT, outputProfilesCsv).replaceAll('\\', '/'),
    relative(ROOT, outputAccelerationCsv).replaceAll('\\', '/'),
    relative(ROOT, outputManifest).replaceAll('\\', '/'),
    relative(ROOT, outputQa).replaceAll('\\', '/'),
  ],
}, null, 2));

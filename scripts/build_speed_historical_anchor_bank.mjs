#!/usr/bin/env node
/**
 * Build the historical physical-speed anchor bank.
 *
 * This is an evidence-normalisation and comparison-support builder only.
 * It intentionally never creates a game ability value, converts 50m/30m to
 * 90ft, applies age decay, or reads a game rating field from an input source.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const AS_OF = '2026-08-10';
const SCHEMA_VERSION = 'speed-historical-anchor-bank/v1.0.0';

const INPUTS = {
  standard50: 'data/manual/standardized_50m_electronic_reference.json',
  standard2026: 'data/manual/standardized_30m50m_photoelectric_2026.json',
  physicalInventory: 'data/manual/npb_speed_physical_evidence_full_20260809.json',
  curated30: 'data/manual/sprint_30m_measurements_curated.json',
  hpTo1b: 'data/manual/hp_to_1b_measurements_curated.json',
  outliers: 'data/manual/speed_outlier_short_distance_evidence_20260809.json',
  historyQa: 'data/manual/historical_speed_qa.json',
  dateResolution: 'outputs/derived/npb_speed_measurement_date_resolution_20260809.json',
  npbPlus: 'outputs/derived/npb_plus_sprint_exposure_2026.json',
  supplement: 'data/manual/speed_historical_anchor_supplement_2015_2026.json',
  accelerationPrior: 'configs/speed_acceleration_prior.json'
};

const OUTPUTS = {
  manifest: 'data/manifests/speed_historical_anchor_source_manifest_2015_2026.json',
  rawCsv: 'data/normalized/speed_historical_physical_measurements_2015_2026.csv',
  rawJson: 'data/normalized/speed_historical_physical_measurements_2015_2026.json',
  anchorCsv: 'outputs/derived/speed_high_confidence_anchor_bank_2015_2026.csv',
  anchorJson: 'outputs/derived/speed_high_confidence_anchor_bank_2015_2026.json',
  rejectedCsv: 'outputs/derived/speed_anchor_rejected_candidates_2015_2026.csv',
  coverage: 'outputs/derived/speed_anchor_band_coverage_2015_2026.json',
  graph: 'outputs/derived/speed_high_confidence_anchor_pairwise_graph_2015_2026.json',
  packets: 'outputs/derived/speed_2026_100_anchor_relative_packets.json',
  snsQueue: 'outputs/derived/speed_2026_100_sns_tiebreak_queue.csv',
  buildQa: 'outputs/derived/speed_historical_anchor_build_qa_2015_2026.json',
  audit: 'docs/audits/speed_historical_high_confidence_anchor_bank_2015_2026.md',
  independentQa: 'outputs/derived/speed_historical_anchor_independent_qa_2015_2026.json'
};

function abs(rel) {
  return path.join(ROOT, rel);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(abs(rel), 'utf8'));
}

function sha256File(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(abs(rel))).digest('hex');
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function ensureParent(rel) {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
}

function writeText(rel, text) {
  ensureParent(rel);
  const tmp = `${abs(rel)}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, abs(rel));
}

function writeJson(rel, value) {
  writeText(rel, stableJson(value));
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(rel, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  writeText(rel, `${lines.join('\n')}\n`);
}

function nameKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s　・・\-‐‑‒–—―]/gu, '')
    .toLowerCase();
}

const NAME_ALIASES = new Map([
  ['orlandocalixte', 'カリステ'],
  ['domingosantana', 'サンタナ'],
  ['shogoakiyama', '秋山翔吾'],
  ['gregorypolanco', 'ポランコ'],
  ['elehurismontero', 'モンテロ'],
  ['yoshitomotsutsugo', '筒香嘉智']
]);

function canonicalPlayer(player) {
  return NAME_ALIASES.get(nameKey(player)) ?? player;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function yearFromDate(value) {
  const match = /^([0-9]{4})/.exec(String(value ?? ''));
  return match ? Number(match[1]) : null;
}

function metricDirection(metric) {
  if (metric === 'NPB_PLUS_SPRINT_SPEED_KMH' || metric === 'MLB_SPRINT_SPEED_FTPS' || metric === 'EVENT_MAX_SPEED_FTPS') return 'HIGHER_IS_FASTER';
  return 'LOWER_IS_FASTER';
}

function assert(condition, message) {
  if (!condition) throw new Error(`BUILD_ASSERTION_FAILED: ${message}`);
}

const standard50 = readJson(INPUTS.standard50);
const standard2026 = readJson(INPUTS.standard2026);
const physicalInventory = readJson(INPUTS.physicalInventory);
const curated30 = readJson(INPUTS.curated30);
const hpTo1b = readJson(INPUTS.hpTo1b);
const outliers = readJson(INPUTS.outliers);
const historyQa = readJson(INPUTS.historyQa);
const dateResolution = readJson(INPUTS.dateResolution);
const npbPlus = readJson(INPUTS.npbPlus);
const supplement = readJson(INPUTS.supplement);
// The acceleration prior is deliberately read only for a hash/provenance receipt.
// Its values never enter a normalised metric or anchor calculation.
const accelerationPriorSha256 = sha256File(INPUTS.accelerationPrior);

assert(Array.isArray(npbPlus.players) && npbPlus.players.length === 100, 'NPB+ source must contain exactly 100 roster rows');
assert(Array.isArray(standard50.records) && standard50.records.length === 57, 'standardized 50m reference must retain 57 records');
assert(Array.isArray(standard2026.records) && standard2026.records.length === 31, '2026 standardized reference must retain 31 records');

const dateResolutionByCluster = new Map(
  (dateResolution.records ?? []).map((record) => [record.measurement_cluster_id, record])
);

const raw = [];
const rawById = new Map();
const candidateSeeds = [];
let rawSerial = 0;

function addRaw(input) {
  const canonical = canonicalPlayer(input.player);
  const record = {
    raw_id: `R${String(++rawSerial).padStart(5, '0')}`,
    player: canonical,
    player_display: input.player ?? canonical,
    player_key: nameKey(canonical),
    team_or_affiliation: input.team_or_affiliation ?? null,
    measurement_date: input.measurement_date ?? null,
    measurement_year: input.measurement_year ?? yearFromDate(input.measurement_date),
    measurement_era: input.measurement_year ?? yearFromDate(input.measurement_date) ?? 'UNKNOWN',
    metric: input.metric,
    value: numberOrNull(input.value),
    unit: input.unit ?? null,
    timing_method: input.timing_method ?? 'unknown',
    start_protocol: input.start_protocol ?? 'unknown',
    surface_or_conditions: input.surface_or_conditions ?? 'unknown',
    cohort_id: input.cohort_id ?? null,
    cohort_completeness: input.cohort_completeness ?? 'UNKNOWN',
    source_manifest_id: input.source_manifest_id,
    source_tier: input.source_tier ?? 'UNKNOWN',
    source_name: input.source_name ?? null,
    source_url: input.source_url ?? null,
    source_urls: input.source_urls ?? null,
    evidence_class: input.evidence_class,
    original_usage_class: input.original_usage_class ?? null,
    canonicality: input.canonicality ?? 'CANONICAL_SOURCE_RECORD',
    high_confidence_candidate: Boolean(input.high_confidence_candidate),
    bank_acceptance_status: input.bank_acceptance_status ?? 'REJECTED_OR_CONTEXT_ONLY',
    rejection_reason: input.rejection_reason ?? null,
    same_measurement_cluster_id: input.same_measurement_cluster_id ?? null,
    temporal_resolution_status: input.temporal_resolution_status ?? 'EXACT_OR_NOT_APPLICABLE',
    temporal_resolution_note: input.temporal_resolution_note ?? null,
    source_payload: input.source_payload ?? null,
    selected_as_anchor: false,
    selected_anchor_id: null,
    notes: input.notes ?? null
  };
  raw.push(record);
  rawById.set(record.raw_id, record);
  return record;
}

function addHighSeed(rawRecord, extra = {}) {
  candidateSeeds.push({
    raw_id: rawRecord.raw_id,
    player: rawRecord.player,
    player_key: rawRecord.player_key,
    value: rawRecord.value,
    metric: rawRecord.metric,
    unit: rawRecord.unit,
    measurement_date: rawRecord.measurement_date,
    measurement_year: rawRecord.measurement_year,
    measurement_era: rawRecord.measurement_era,
    cohort_id: rawRecord.cohort_id,
    cohort_completeness: rawRecord.cohort_completeness,
    source_manifest_id: rawRecord.source_manifest_id,
    source_tier: rawRecord.source_tier,
    source_url: rawRecord.source_url,
    source_urls: rawRecord.source_urls,
    timing_method: rawRecord.timing_method,
    start_protocol: rawRecord.start_protocol,
    source_name: rawRecord.source_name,
    bank_acceptance_status: rawRecord.bank_acceptance_status,
    anchor_confidence: extra.anchor_confidence ?? 'HIGH',
    selection_group: extra.selection_group ?? rawRecord.same_measurement_cluster_id ?? rawRecord.raw_id,
    selection_method: extra.selection_method ?? 'single_observed_value',
    selection_direction: extra.selection_direction ?? metricDirection(rawRecord.metric),
    use_scope: extra.use_scope ?? 'WITHIN_COHORT_PHYSICAL_ORDINAL_ONLY',
    limitations: extra.limitations ?? null
  });
}

const official2022TopFive = new Set(['矢澤宏太', '林琢真', '松浦佑星', '友杉篤輝', '蛭間拓哉'].map(nameKey));

for (const record of standard50.records) {
  const date = record.measurement_date;
  const is2022 = date === '2022-06-19';
  const isOfficialTopFive = is2022 && official2022TopFive.has(nameKey(record.player));
  const accepted = date === '2024-11-30' || isOfficialTopFive;
  const rawRecord = addRaw({
    player: record.player,
    measurement_date: date,
    measurement_year: yearFromDate(date),
    metric: '50M_STANDING_START_SECONDS',
    value: record.seconds_50m,
    unit: 'seconds',
    timing_method: record.protocol ?? 'electronic_photoelectric',
    start_protocol: 'not_publicly_documented',
    surface_or_conditions: 'not_publicly_documented',
    cohort_id: `samurai_university_${date}`,
    cohort_completeness: date === '2024-11-30' ? 'FULL_PUBLISHED_TABLE_27' : (isOfficialTopFive ? 'OFFICIAL_TOP_FIVE_ONLY' : 'THIRD_PARTY_FULL_TABLE_NOT_INDEPENDENTLY_VERIFIED'),
    source_manifest_id: date === '2024-11-30' ? 'samurai_university_2024_11_30' : 'samurai_university_2022_06_19',
    source_tier: date === '2024-11-30' ? 'A_PROTOCOL_B_FULL_VALUES' : (isOfficialTopFive ? 'A_OFFICIAL_VALUE' : 'C_UNVERIFIED_FULL_TABLE'),
    source_name: date === '2024-11-30' ? '侍ジャパン公式 + 高校野球ドットコム' : 'Existing standardized 50m reference',
    source_url: date === '2024-11-30'
      ? 'https://www.hb-nippon.com/articles/2163'
      : (isOfficialTopFive ? 'https://www.japan-baseball.jp/jp/news/press/20220619_1.html' : 'https://www.youtube.com/watch?v=fC8_8iA7Cao'),
    source_urls: date === '2024-11-30'
      ? ['https://www.japan-baseball.jp/jp/news/press/20241130_1.html', 'https://www.hb-nippon.com/articles/2163']
      : ['https://www.japan-baseball.jp/jp/news/press/20220619_1.html', 'https://www.youtube.com/watch?v=fC8_8iA7Cao'],
    evidence_class: 'STANDARDIZED_SHORT_DISTANCE',
    high_confidence_candidate: accepted,
    bank_acceptance_status: accepted ? 'ACCEPTED_HIGH_CONFIDENCE' : 'REJECTED_SOURCE_TIER',
    rejection_reason: accepted ? null : 'REJECTED_TIER_C_FULL_TABLE_NOT_INDEPENDENTLY_VERIFIED',
    same_measurement_cluster_id: `standardized_50m_${date}_${nameKey(record.player)}`,
    notes: accepted
      ? 'Comparable only within this measured cohort. This 50m result is never converted to T90.'
      : 'Raw value retained; only the official 2022 top five are admitted from this otherwise third-party full table.'
  });
  if (accepted) addHighSeed(rawRecord, {
    selection_group: rawRecord.same_measurement_cluster_id,
    use_scope: 'WITHIN_MEASURED_COHORT_ORDINAL_ONLY',
    limitations: rawRecord.cohort_completeness === 'OFFICIAL_TOP_FIVE_ONLY'
      ? 'Only the official top five are visible; no complete-cohort distribution is claimed.'
      : 'Full published participant table; values remain 50m test results, not T90 values.'
  });
}

for (const record of standard2026.records) {
  const base = {
    player: record.player,
    measurement_date: standard2026.measurement_date,
    measurement_year: yearFromDate(standard2026.measurement_date),
    timing_method: standard2026.protocol,
    start_protocol: 'not_publicly_documented',
    surface_or_conditions: 'not_publicly_documented',
    cohort_id: 'samurai_university_2026_06_22',
    cohort_completeness: 'FULL_PUBLISHED_50M_TABLE_31',
    source_manifest_id: 'samurai_university_2026_06_22',
    source_tier: 'A_PROTOCOL_B_FULL_VALUES',
    source_name: '侍ジャパン公式 + 高校野球ドットコム',
    source_url: 'https://www.hb-nippon.com/articles/14003',
    evidence_class: 'STANDARDIZED_SHORT_DISTANCE'
  };
  const fifty = addRaw({
    ...base,
    metric: '50M_STANDING_START_SECONDS',
    value: record.seconds_50m,
    unit: 'seconds',
    high_confidence_candidate: true,
    bank_acceptance_status: 'ACCEPTED_HIGH_CONFIDENCE',
    same_measurement_cluster_id: `standardized_50m_2026-06-22_${nameKey(record.player)}`,
    notes: 'Photoelectric 50m within a common 2026 camp cohort; never converted to T90.'
  });
  addHighSeed(fifty, {
    use_scope: 'WITHIN_MEASURED_COHORT_ORDINAL_ONLY',
    limitations: 'Full published 50m table; 30m values exist only for a public subset and are retained separately.'
  });
  if (numberOrNull(record.seconds_30m) !== null) {
    addRaw({
      ...base,
      metric: '30M_STANDING_START_SECONDS',
      value: record.seconds_30m,
      unit: 'seconds',
      cohort_completeness: 'PUBLIC_30M_SUBSET_2_OF_31',
      high_confidence_candidate: false,
      bank_acceptance_status: 'RETAINED_SUPPORT_ONLY',
      rejection_reason: 'RETAINED_SUPPORT_ONLY_PUBLIC_30M_SUBSET_NOT_A_FULL_COHORT',
      same_measurement_cluster_id: `standardized_30m_2026-06-22_${nameKey(record.player)}`,
      notes: 'Same photoelectric trial per official report; not made into a broad 30m comparison cohort because only two 30m values are public.'
    });
  }
}

for (const source of supplement.sources) {
  for (const record of source.records ?? []) {
    const trials = Array.isArray(record.raw_trials_seconds) ? record.raw_trials_seconds : [record.seconds_50m];
    for (let index = 0; index < trials.length; index += 1) {
      const accepted = Boolean(source.accepted_for_high_confidence);
      const rawRecord = addRaw({
        player: record.player,
        team_or_affiliation: record.affiliation ?? null,
        measurement_date: source.measurement_date,
        measurement_year: yearFromDate(source.measurement_date),
        metric: '50M_STANDING_START_SECONDS',
        value: trials[index],
        unit: 'seconds',
        timing_method: source.timing_method,
        start_protocol: 'not_publicly_documented',
        surface_or_conditions: 'not_publicly_documented',
        cohort_id: source.source_id,
        cohort_completeness: source.participants
          ? `PUBLISHED_PARTICIPANT_COHORT_${source.participants}`
          : 'OFFICIAL_REPORTED_VALUES_ONLY',
        source_manifest_id: source.source_id,
        source_tier: source.source_tier,
        source_name: source.event,
        source_url: source.source_urls?.[0] ?? null,
        source_urls: source.source_urls ?? null,
        evidence_class: source.evidence_class,
        high_confidence_candidate: accepted,
        bank_acceptance_status: accepted ? 'ACCEPTED_HIGH_CONFIDENCE' : 'REJECTED_PROTOCOL_CONFLICT',
        rejection_reason: accepted ? null : source.rejection_reason,
        same_measurement_cluster_id: `${source.source_id}_${nameKey(record.player)}`,
        notes: accepted
          ? (trials.length > 1 ? 'All displayed trials retained; representative anchor selects the session minimum without any distance conversion.' : 'Official published photoelectric 50m value; never converted to T90.')
          : source.rejection_reason,
        source_payload: { affiliation: record.affiliation ?? null, trial_index: index + 1, trials }
      });
      if (accepted) {
        addHighSeed(rawRecord, {
          selection_group: rawRecord.same_measurement_cluster_id,
          selection_method: trials.length > 1 ? 'minimum_of_published_same_session_trials' : 'single_published_value',
          use_scope: 'WITHIN_MEASURED_COHORT_ORDINAL_ONLY',
          limitations: trials.length > 1
            ? 'Session-minimum selection is descriptive; no cross-session precision or performance adjustment is assumed.'
            : 'Small published result set; usable only as a same-session physical ordinal anchor.'
        });
      }
    }
  }
}

for (const record of supplement.direct_running_revalidation.records) {
  const player = canonicalPlayer(record.player);
  const common = {
    player,
    player_display: record.player,
    team_or_affiliation: `${record.team} / MLB`,
    measurement_year: record.measurement_year,
    measurement_date: `${record.measurement_year}-season`,
    timing_method: 'Statcast official CSV',
    start_protocol: 'Statcast 90ft running-split definition; initial step to 90ft',
    surface_or_conditions: 'MLB game tracking; qualified seasonal aggregate',
    cohort_id: `mlb_statcast_${record.measurement_year}_${record.team}`,
    cohort_completeness: 'PLAYER_SEASON_OFFICIAL_CSV_ROW',
    source_manifest_id: supplement.direct_running_revalidation.source_id,
    source_tier: 'A_FIRST_PARTY_LIVE_REVERIFIED',
    source_name: 'Baseball Savant / MLB Statcast',
    source_url: supplement.direct_running_revalidation.running_splits_csv_template.replace('{year}', record.measurement_year),
    source_urls: [
      supplement.direct_running_revalidation.running_splits_csv_template.replace('{year}', record.measurement_year),
      supplement.direct_running_revalidation.sprint_speed_csv_template.replace('{year}', record.measurement_year),
      supplement.direct_running_revalidation.definition_url
    ],
    evidence_class: 'ABSOLUTE_DIRECT_STATCAST'
  };
  const accepted = Boolean(record.accepted_for_high_confidence);
  const directT90 = addRaw({
    ...common,
    metric: 'T90FT_SECONDS',
    value: record.t90ft_seconds,
    unit: 'seconds',
    high_confidence_candidate: accepted,
    bank_acceptance_status: accepted ? 'ACCEPTED_HIGH_CONFIDENCE' : 'REJECTED_LIVE_REVALIDATION',
    rejection_reason: record.rejection_reason ?? null,
    same_measurement_cluster_id: `mlb_statcast_t90_${record.measurement_year}_${nameKey(player)}`,
    notes: accepted
      ? 'Official direct 90ft split retained as an absolute historical observation; not numerically bridged to NPB+ or 50m.'
      : record.rejection_reason
  });
  if (accepted) addHighSeed(directT90, {
    selection_group: directT90.same_measurement_cluster_id,
    use_scope: 'ABSOLUTE_DIRECT_HISTORICAL_OBSERVATION_ONLY',
    limitations: 'Different player-season eras are not treated as a current NPB equivalence class.'
  });
  for (const [metric, value] of [
    ['T10FT_SECONDS', record.t10ft_seconds],
    ['T30FT_SECONDS', record.t30ft_seconds],
    ['MLB_SPRINT_SPEED_FTPS', record.sprint_speed_ft_per_sec]
  ]) {
    addRaw({
      ...common,
      metric,
      value,
      unit: metric === 'MLB_SPRINT_SPEED_FTPS' ? 'ft_per_second' : 'seconds',
      high_confidence_candidate: false,
      bank_acceptance_status: accepted ? 'RETAINED_SUPPORT_ONLY' : 'REJECTED_LIVE_REVALIDATION',
      rejection_reason: accepted ? 'RETAINED_METRIC_SUPPORT_NOT_A_SECOND_ANCHOR' : record.rejection_reason,
      same_measurement_cluster_id: `mlb_statcast_${metric.toLowerCase()}_${record.measurement_year}_${nameKey(player)}`,
      notes: metric === 'MLB_SPRINT_SPEED_FTPS'
        ? 'Official seasonal Sprint Speed retained as a separate unit and aggregation; it is not equated to NPB+.'
        : 'Supporting split retained separately; it is not converted to metres or a game ability.'
    });
  }
}

for (const directional of supplement.additional_directional_records ?? []) {
  addRaw({
    player: directional.player,
    measurement_date: directional.measurement_date,
    measurement_year: yearFromDate(directional.measurement_date),
    metric: directional.metric === '50m' ? '50M_MANUAL_SECONDS' : directional.metric,
    value: directional.value,
    unit: directional.unit,
    timing_method: directional.protocol,
    start_protocol: directional.protocol,
    surface_or_conditions: 'not_publicly_documented',
    cohort_id: directional.source_id,
    cohort_completeness: 'DISCOVERY_ONLY',
    source_manifest_id: directional.source_id,
    source_tier: 'C_DIRECTIONAL',
    source_name: 'University historical profile discovery',
    evidence_class: 'HISTORICAL_PROFILE_DIRECTIONAL',
    high_confidence_candidate: false,
    bank_acceptance_status: 'REJECTED_PROTOCOL',
    rejection_reason: directional.rejection_reason,
    same_measurement_cluster_id: `${directional.source_id}_${nameKey(directional.player)}`,
    notes: 'Retained only to preserve a discovered historical value and its protocol incompatibility.'
  });
}

for (const playerRow of physicalInventory.players ?? []) {
  for (const record of playerRow.records ?? []) {
    const metric = String(record.metric ?? 'UNKNOWN_METRIC');
    const directLegacy = ['T90ft', 'T10ft', 'T30ft', 'MLB_Sprint_Speed'].includes(metric);
    const standardDuplicate = record.usage_class === 'STANDARDIZED_PRIOR' && (metric === '50m' || metric === '30m');
    const resolution = dateResolutionByCluster.get(record.same_measurement_cluster_id);
    const originalValue = numberOrNull(record.seconds) ?? numberOrNull(record.value);
    const player = canonicalPlayer(playerRow.player);
    let rejectionReason = 'REJECTED_UNSTANDARDIZED_OR_CONTEXTUAL_INVENTORY_RECORD';
    let canonicality = 'ARCHIVAL_INVENTORY_RECORD';
    if (directLegacy) {
      canonicality = 'SUPERSEDED_BY_LIVE_DIRECT_REVALIDATION';
      rejectionReason = nameKey(player) === nameKey('筒香嘉智')
        ? 'REJECTED_LIVE_OFFICIAL_CSV_NOT_FOUND_NO_PRESERVED_SNAPSHOT'
        : 'SUPERSEDED_BY_LIVE_REVALIDATION_CANONICAL_RECORD';
    } else if (standardDuplicate) {
      canonicality = 'DUPLICATE_OF_CANONICAL_STANDARDIZED_SOURCE';
      rejectionReason = 'DUPLICATE_OF_CANONICAL_STANDARDIZED_SOURCE_RECORD';
    } else if (record.usage_class === 'CONTEXT_ONLY' || metric === 'hp_to_1b') {
      rejectionReason = 'REJECTED_CONTACT_TO_RUN_TRANSITION_OR_GAME_CONTEXT';
    } else if (record.usage_class === 'HISTORICAL_PROFILE_HINT') {
      rejectionReason = 'REJECTED_PROTOCOL_OR_DATE_NOT_PUBLICLY_DOCUMENTED';
    }
    addRaw({
      player,
      team_or_affiliation: playerRow.team ?? record.affiliation ?? null,
      measurement_date: resolution?.measurement_date ?? null,
      measurement_year: record.measurement_year,
      metric: metric === 'T90ft' ? 'T90FT_SECONDS'
        : metric === 'T10ft' ? 'T10FT_SECONDS'
          : metric === 'T30ft' ? 'T30FT_SECONDS'
            : metric === 'MLB_Sprint_Speed' ? 'MLB_SPRINT_SPEED_FTPS'
              : metric === 'hp_to_1b' ? 'HP_TO_1B_SECONDS'
                : metric === '50m' ? '50M_PROFILE_SECONDS'
                  : metric === '30m' ? '30M_PROFILE_SECONDS'
                    : metric,
      value: originalValue,
      unit: metric === 'MLB_Sprint_Speed' ? 'ft_per_second' : (metric === 'event_max_speed' ? 'ft_per_second' : 'seconds'),
      timing_method: record.timing_method,
      start_protocol: record.start_protocol,
      surface_or_conditions: record.surface,
      cohort_id: record.cohort ?? null,
      cohort_completeness: 'NOT_PUBLICLY_DOCUMENTED_OR_ARCHIVAL_DUPLICATE',
      source_manifest_id: 'existing_npb_physical_inventory_20260809',
      source_tier: record.source_tier ?? 'UNKNOWN',
      source_name: record.source_name,
      source_url: record.source_url,
      evidence_class: record.usage_class ?? 'HISTORICAL_INVENTORY',
      original_usage_class: record.usage_class ?? null,
      canonicality,
      high_confidence_candidate: false,
      bank_acceptance_status: 'REJECTED_OR_CONTEXT_ONLY',
      rejection_reason: rejectionReason,
      same_measurement_cluster_id: record.same_measurement_cluster_id,
      temporal_resolution_status: resolution?.resolution_status ?? 'UNRESOLVED_OR_SOURCE_STATED',
      temporal_resolution_note: resolution?.inference_basis ?? null,
      source_payload: record,
      notes: record.reason ?? null
    });
  }
}

for (const record of curated30.records ?? []) {
  addRaw({
    player: record.player,
    team_or_affiliation: record.team,
    measurement_year: record.season,
    metric: '30M_CURATED_SECONDS',
    value: record.seconds_30m,
    unit: 'seconds',
    timing_method: record.timing_device,
    start_protocol: record.start_protocol,
    surface_or_conditions: record.surface,
    cohort_id: record.context,
    cohort_completeness: 'PROTOCOL_UNKNOWN',
    source_manifest_id: 'curated_30m_measurements_20260809',
    source_tier: record.confidence ?? 'UNKNOWN',
    source_name: record.source_name,
    source_url: record.source_url,
    evidence_class: 'HISTORICAL_PROFILE_DIRECTIONAL',
    original_usage_class: record.speed_use,
    high_confidence_candidate: false,
    bank_acceptance_status: 'REJECTED_PROTOCOL',
    rejection_reason: 'REJECTED_PROTOCOL_NOT_FULLY_PUBLICLY_DOCUMENTED',
    same_measurement_cluster_id: `curated30_${nameKey(record.player)}_${record.season}_${record.seconds_30m}`,
    source_payload: record,
    notes: record.note
  });
}

for (const record of hpTo1b.records ?? []) {
  addRaw({
    player: record.player,
    team_or_affiliation: record.team,
    measurement_year: record.season,
    metric: 'HP_TO_1B_SECONDS',
    value: record.seconds,
    unit: 'seconds',
    timing_method: record.timing_origin,
    start_protocol: 'swing_or_bunt_to_run',
    surface_or_conditions: record.condition_class,
    cohort_id: record.context,
    cohort_completeness: 'GAME_CONTEXT_NOT_COHORT',
    source_manifest_id: 'curated_homeplate_to_first_20260809',
    source_tier: record.confidence ?? 'UNKNOWN',
    source_name: record.source_name,
    source_url: record.source_url,
    evidence_class: 'CONTEXT_ONLY',
    original_usage_class: record.speed_use,
    high_confidence_candidate: false,
    bank_acceptance_status: 'REJECTED_CONTEXT_ONLY',
    rejection_reason: 'REJECTED_CONTACT_TO_RUN_TRANSITION_OR_GAME_CONTEXT',
    same_measurement_cluster_id: `hp_to_1b_${nameKey(record.player)}_${record.season}_${record.seconds}`,
    source_payload: record,
    notes: record.reason
  });
}

for (const record of outliers.records ?? []) {
  addRaw({
    player: record.player,
    measurement_year: record.measurement_year,
    metric: String(record.metric).includes('30') ? '30M_OUTLIER_SECONDS' : String(record.metric),
    value: record.seconds,
    unit: 'seconds',
    timing_method: record.protocol_class,
    start_protocol: record.start_rule_mismatch ? 'protocol_mismatch' : 'not_publicly_documented',
    surface_or_conditions: record.context,
    cohort_id: 'outlier_context_20260809',
    cohort_completeness: 'NOT_COMPARABLE',
    source_manifest_id: 'outlier_short_distance_context_20260809',
    source_tier: 'B_OR_C_CONTEXTUAL',
    source_name: record.source_name,
    source_url: record.source_url,
    evidence_class: 'EXCLUDED_OUTLIER_OR_PROTOCOL_MISMATCH',
    high_confidence_candidate: false,
    bank_acceptance_status: 'REJECTED_PROTOCOL',
    rejection_reason: 'REJECTED_PROTOCOL_OR_DISTANCE_MISMATCH',
    same_measurement_cluster_id: `outlier_${nameKey(record.player)}_${record.measurement_year}_${record.seconds}`,
    source_payload: record,
    notes: record.numeric_t90_use
  });
}

for (const qaCase of historyQa.cases ?? []) {
  for (const evidence of qaCase.evidence ?? []) {
    const value = numberOrNull(evidence.value);
    if (value === null) continue;
    addRaw({
      player: qaCase.player,
      measurement_year: evidence.season ?? null,
      metric: String(evidence.metric ?? evidence.kind ?? 'QA_CONTEXT').toUpperCase(),
      value,
      unit: String(evidence.metric ?? '').includes('speed') ? 'ft_per_second_or_kmh_as_published' : 'seconds',
      timing_method: evidence.condition ?? evidence.context ?? 'qa_context',
      start_protocol: 'not_anchor_eligible',
      surface_or_conditions: evidence.condition ?? evidence.context ?? 'not_publicly_documented',
      cohort_id: qaCase.qa_id,
      cohort_completeness: 'QA_ONLY',
      source_manifest_id: 'historical_speed_qa_20260809',
      source_tier: evidence.speed_use ?? 'QA_ONLY',
      source_name: evidence.source_name ?? null,
      source_url: evidence.source_url ?? null,
      evidence_class: 'QA_CONTEXT_ONLY',
      high_confidence_candidate: false,
      bank_acceptance_status: 'REJECTED_QA_ONLY',
      rejection_reason: 'REJECTED_HISTORICAL_QA_CONTEXT_NOT_ANCHOR',
      same_measurement_cluster_id: `${qaCase.qa_id}_${nameKey(qaCase.player)}_${evidence.metric ?? evidence.kind ?? value}`,
      source_payload: evidence,
      notes: evidence.reason ?? null
    });
  }
}

for (const player of npbPlus.players) {
  const value = numberOrNull(player.npb_plus_sprint_speed_kmh);
  assert(value !== null, `NPB+ speed missing for ${player.player}`);
  const rawRecord = addRaw({
    player: player.player,
    team_or_affiliation: player.team,
    measurement_date: player.npb_plus_measurement_period ?? '2026 season snapshot',
    measurement_year: 2026,
    metric: 'NPB_PLUS_SPRINT_SPEED_KMH',
    value,
    unit: 'km_per_hour',
    timing_method: 'NPB+ published sprint-speed field',
    start_protocol: 'NPB+ public definition; detailed qualified-run count not published',
    surface_or_conditions: 'in-game tracking aggregate',
    cohort_id: 'npb_plus_2026_current_roster_100',
    cohort_completeness: '100_OF_100_TARGET_ROSTER_ROWS',
    source_manifest_id: 'npb_plus_sprint_exposure_2026',
    source_tier: 'B_CURRENT_ORDINAL_SAMPLE_COUNT_NOT_PUBLISHED',
    source_name: player.source ?? 'NPB+ manual collection',
    source_url: player.source_url ?? null,
    evidence_class: 'CURRENT_BASEBALL_SPEED',
    high_confidence_candidate: false,
    bank_acceptance_status: 'ACCEPTED_MODERATE_CURRENT_ORDINAL',
    same_measurement_cluster_id: `npb_plus_2026_${nameKey(player.player)}`,
    source_payload: {
      player_id: player.player_id,
      npb_plus_sample_count: player.npb_plus_sample_count,
      npb_plus_qualified_run_count: player.npb_plus_qualified_run_count,
      npb_plus_measurement_period: player.npb_plus_measurement_period,
      PA: player.PA,
      pa_bucket: player.pa_bucket,
      full_effort_run_proxy_count: player.full_effort_run_proxy_count,
      data_completeness: player.data_completeness
    },
    notes: 'Current 2026 ordinal anchor only. Missing published sample and qualified-run counts prevent high-confidence calibration or a cross-system unit bridge.'
  });
  addHighSeed(rawRecord, {
    anchor_confidence: 'MODERATE',
    selection_group: rawRecord.same_measurement_cluster_id,
    use_scope: 'CURRENT_NPB_PLUS_ORDINAL_WITHIN_100_ONLY',
    limitations: 'The public source does not publish per-player run sample counts or qualified-run counts. This is never converted or treated as an MLB-equivalent metric.'
  });
}

assert(raw.length > 250, 'raw bank should preserve a broad inventory, not only accepted anchors');

const anchorSeedsByGroup = new Map();
for (const seed of candidateSeeds) {
  const key = `${seed.anchor_confidence}|${seed.selection_group}`;
  if (!anchorSeedsByGroup.has(key)) anchorSeedsByGroup.set(key, []);
  anchorSeedsByGroup.get(key).push(seed);
}

const anchors = [];
let anchorSerial = 0;
for (const seeds of anchorSeedsByGroup.values()) {
  const direction = seeds[0].selection_direction;
  const selected = [...seeds].sort((a, b) => direction === 'LOWER_IS_FASTER' ? a.value - b.value : b.value - a.value)[0];
  const rawRecords = seeds.map((seed) => rawById.get(seed.raw_id));
  const anchor = {
    anchor_id: `A${String(++anchorSerial).padStart(4, '0')}`,
    player: selected.player,
    player_key: selected.player_key,
    measurement_era: selected.measurement_era,
    measurement_date: selected.measurement_date,
    metric: selected.metric,
    value: selected.value,
    unit: selected.unit,
    direction: direction,
    cohort_id: selected.cohort_id,
    cohort_completeness: selected.cohort_completeness,
    source_manifest_id: selected.source_manifest_id,
    source_tier: selected.source_tier,
    source_url: selected.source_url,
    source_urls: selected.source_urls,
    source_name: selected.source_name,
    timing_method: selected.timing_method,
    start_protocol: selected.start_protocol,
    anchor_confidence: selected.anchor_confidence,
    bank_acceptance_status: selected.bank_acceptance_status,
    raw_record_ids: rawRecords.map((record) => record.raw_id),
    raw_trial_count: rawRecords.length,
    selection_method: selected.selection_method,
    selection_scope: selected.use_scope,
    speed_band: 'NOT_ASSIGNED_YET',
    band_basis: 'NOT_ASSIGNED_YET',
    cohort_rank: null,
    cohort_size: null,
    limitations: selected.limitations,
    integration_boundary: 'NO_T90_CONVERSION_NO_AGE_DECAY_NO_GAME_RATING'
  };
  anchors.push(anchor);
  for (const rawRecord of rawRecords) {
    rawRecord.selected_as_anchor = true;
    rawRecord.selected_anchor_id = anchor.anchor_id;
  }
}

function rankBand(position, size) {
  const bin = Math.min(8, Math.max(1, Math.ceil((position / size) * 8)));
  return `B${bin}_${['FASTEST', 'UPPER', 'UPPER_MID', 'MID_UPPER', 'MID_LOWER', 'LOWER_MID', 'LOWER', 'SLOWEST'][bin - 1]}_COHORT_OCTILE`;
}

const graphGroups = new Map();
for (const anchor of anchors) {
  const isPhysicalCohort = anchor.anchor_confidence === 'HIGH' && anchor.metric === '50M_STANDING_START_SECONDS';
  const isCurrentNpb = anchor.anchor_confidence === 'MODERATE' && anchor.metric === 'NPB_PLUS_SPRINT_SPEED_KMH';
  if (isPhysicalCohort || isCurrentNpb) {
    const key = `${anchor.metric}|${anchor.cohort_id}`;
    if (!graphGroups.has(key)) graphGroups.set(key, []);
    graphGroups.get(key).push(anchor);
  }
}

for (const group of graphGroups.values()) {
  group.sort((a, b) => a.direction === 'LOWER_IS_FASTER' ? a.value - b.value : b.value - a.value);
  for (let index = 0; index < group.length; index += 1) {
    const anchor = group[index];
    anchor.cohort_rank = index + 1;
    anchor.cohort_size = group.length;
    anchor.speed_band = rankBand(index + 1, group.length);
    anchor.band_basis = 'WITHIN_SAME_METRIC_SAME_COHORT_OCTILE_ONLY';
  }
}

for (const anchor of anchors.filter((anchor) => anchor.speed_band === 'NOT_ASSIGNED_YET')) {
  if (anchor.metric === 'T90FT_SECONDS') {
    anchor.speed_band = 'ABSOLUTE_DIRECT_UNBANDED_CROSS_ERA';
    anchor.band_basis = 'No cross-era T90 band: direct observations are retained without an assumed current equivalence class.';
  } else {
    anchor.speed_band = 'UNBANDED';
    anchor.band_basis = 'No complete comparable cohort is available.';
  }
}

const pairwiseEdges = [];
let edgeSerial = 0;
for (const [groupKey, group] of graphGroups.entries()) {
  for (let index = 0; index < group.length - 1; index += 1) {
    const faster = group[index];
    const slower = group[index + 1];
    const sameBand = faster.speed_band === slower.speed_band;
    pairwiseEdges.push({
      edge_id: `E${String(++edgeSerial).padStart(4, '0')}`,
      group_key: groupKey,
      metric: faster.metric,
      cohort_id: faster.cohort_id,
      faster_anchor_id: faster.anchor_id,
      slower_anchor_id: slower.anchor_id,
      faster_player: faster.player,
      slower_player: slower.player,
      faster_value: faster.value,
      slower_value: slower.value,
      unit: faster.unit,
      relation: sameBand ? 'SAME_BAND_ADJACENT_ORDINAL' : 'ORDERED_FASTER_WITHIN_SAME_COHORT',
      confidence: faster.anchor_confidence === 'HIGH' ? 'HIGH' : 'MODERATE',
      source_refs: [...new Set([faster.source_manifest_id, slower.source_manifest_id])],
      temporal_scope: faster.anchor_confidence === 'HIGH'
        ? 'same measured physical cohort'
        : 'same 2026 NPB+ target-roster snapshot only',
      limitation: faster.anchor_confidence === 'HIGH'
        ? 'This is a same-cohort ordinal edge, not a 90ft conversion or current player rating.'
        : 'Public NPB+ sample and qualified-run counts are not published; edge is moderate and ordinal only.'
    });
  }
}

const anchorsByPlayerKey = new Map();
for (const anchor of anchors) {
  if (!anchorsByPlayerKey.has(anchor.player_key)) anchorsByPlayerKey.set(anchor.player_key, []);
  anchorsByPlayerKey.get(anchor.player_key).push(anchor);
}
const currentNpbAnchors = anchors
  .filter((anchor) => anchor.metric === 'NPB_PLUS_SPRINT_SPEED_KMH')
  .sort((a, b) => b.value - a.value);
const currentNpbIndex = new Map(currentNpbAnchors.map((anchor, index) => [anchor.anchor_id, index]));

const physicalConflictPlayers = new Map();
for (const group of graphGroups.values()) {
  if (group[0]?.anchor_confidence !== 'HIGH') continue;
  const currentMembers = group.filter((anchor) => anchorsByPlayerKey.has(anchor.player_key) && anchorsByPlayerKey.get(anchor.player_key).some((x) => x.metric === 'NPB_PLUS_SPRINT_SPEED_KMH'));
  for (let i = 0; i < currentMembers.length; i += 1) {
    for (let j = i + 1; j < currentMembers.length; j += 1) {
      const physicalA = currentMembers[i];
      const physicalB = currentMembers[j];
      const currentA = anchorsByPlayerKey.get(physicalA.player_key).find((x) => x.metric === 'NPB_PLUS_SPRINT_SPEED_KMH');
      const currentB = anchorsByPlayerKey.get(physicalB.player_key).find((x) => x.metric === 'NPB_PLUS_SPRINT_SPEED_KMH');
      const physicalOrder = physicalA.value - physicalB.value;
      const currentOrder = currentA.value - currentB.value;
      if (physicalOrder !== 0 && currentOrder !== 0 && Math.sign(physicalOrder) === Math.sign(currentOrder)) {
        for (const [anchor, peer, currentAnchor, peerCurrent] of [[physicalA, physicalB, currentA, currentB], [physicalB, physicalA, currentB, currentA]]) {
          if (!physicalConflictPlayers.has(anchor.player_key)) physicalConflictPlayers.set(anchor.player_key, []);
          physicalConflictPlayers.get(anchor.player_key).push({
            physical_anchor_id: anchor.anchor_id,
            peer_physical_anchor_id: peer.anchor_id,
            physical_cohort: anchor.cohort_id,
            physical_value: anchor.value,
            peer_physical_value: peer.value,
            current_anchor_id: currentAnchor.anchor_id,
            peer_current_anchor_id: peerCurrent.anchor_id,
            current_value: currentAnchor.value,
            peer_current_value: peerCurrent.value,
            reason: 'Historical same-cohort 50m ordering and current 2026 NPB+ ordering run in opposite directions; units are not equated.'
          });
        }
      }
    }
  }
}

function currentNeighbors(anchor) {
  const index = currentNpbIndex.get(anchor.anchor_id);
  const sameBand = currentNpbAnchors.filter((candidate) => candidate.anchor_id !== anchor.anchor_id && candidate.speed_band === anchor.speed_band).slice(0, 3);
  return {
    faster_anchor: index > 0 ? currentNpbAnchors[index - 1] : null,
    slower_anchor: index < currentNpbAnchors.length - 1 ? currentNpbAnchors[index + 1] : null,
    same_band_anchors: sameBand
  };
}

const packets = [];
for (const player of npbPlus.players) {
  const playerKey = nameKey(player.player);
  const playerAnchors = anchorsByPlayerKey.get(playerKey) ?? [];
  const currentAnchor = playerAnchors.find((anchor) => anchor.metric === 'NPB_PLUS_SPRINT_SPEED_KMH');
  assert(currentAnchor, `missing current NPB+ anchor for ${player.player}`);
  const highPhysical = playerAnchors.filter((anchor) => anchor.anchor_confidence === 'HIGH');
  const conflicts = physicalConflictPlayers.get(playerKey) ?? [];
  const lowExposure = Number(player.PA ?? 0) < 100;
  const hasRecentHighPhysical = highPhysical.some((anchor) => Number(anchor.measurement_era) >= 2024);
  let status = 'ANCHOR_RESOLVED_MODERATE';
  const statusReasons = [];
  if (conflicts.length > 0) {
    status = 'SNS_TIEBREAK';
    statusReasons.push('COHORT_ORDER_CONFLICT_WITH_CURRENT_NPB_ORDINAL');
  }
  if (lowExposure) {
    status = 'SNS_TIEBREAK';
    statusReasons.push('SOURCE_PA_UNDER_100_AND_QUALIFIED_RUN_COUNT_NOT_PUBLISHED');
  }
  if (status === 'ANCHOR_RESOLVED_MODERATE' && hasRecentHighPhysical) {
    status = 'ANCHOR_CONTEXT_HIGH_EVIDENCE';
    statusReasons.push('RECENT_STANDARDIZED_OR_DIRECT_PHYSICAL_RECORD_AVAILABLE');
  }
  if (statusReasons.length === 0) statusReasons.push('CURRENT_NPB_PLUS_ORDINAL_HAS_FULL_100_ROSTER_BRACKETING_BUT_PUBLIC_SAMPLE_COUNTS_ARE_NOT_PUBLISHED');
  const neighbors = currentNeighbors(currentAnchor);
  const historicalRaw = raw.filter((record) => record.player_key === playerKey && record.metric !== 'NPB_PLUS_SPRINT_SPEED_KMH' && record.selected_as_anchor !== true)
    .map((record) => ({
      raw_id: record.raw_id,
      metric: record.metric,
      value: record.value,
      unit: record.unit,
      measurement_era: record.measurement_era,
      evidence_class: record.evidence_class,
      bank_acceptance_status: record.bank_acceptance_status,
      rejection_reason: record.rejection_reason,
      source_manifest_id: record.source_manifest_id
    }));
  packets.push({
    packet_id: `P${String(packets.length + 1).padStart(3, '0')}`,
    player: player.player,
    player_id: player.player_id,
    team: player.team,
    target_season: 2026,
    status,
    status_reasons: statusReasons,
    current_npb_plus_anchor: currentAnchor,
    faster_anchor: neighbors.faster_anchor,
    slower_anchor: neighbors.slower_anchor,
    same_band_anchors: neighbors.same_band_anchors,
    high_confidence_physical_anchors: highPhysical,
    historical_or_rejected_physical_evidence: historicalRaw,
    same_cohort_order_conflicts: conflicts,
    exposure_receipt: {
      PA: player.PA,
      pa_bucket: player.pa_bucket,
      full_effort_run_proxy_count: player.full_effort_run_proxy_count,
      npb_plus_sample_count: player.npb_plus_sample_count,
      npb_plus_qualified_run_count: player.npb_plus_qualified_run_count,
      data_completeness: player.data_completeness
    },
    allowed_use: 'human relative-anchor review only; no final game ability value is generated',
    prohibited_use: ['no_50m_to_t90_conversion', 'no_age_decay', 'no_steal_or_baserun_outcome_input', 'no_game_rating_input'],
    limitations: 'NPB+ is retained only as a 2026 same-dataset ordinal. It is not declared metrically equivalent to MLB Sprint Speed or direct Statcast 90ft splits.'
  });
}

assert(packets.length === 100, 'must produce 100/100 packets');
assert(new Set(packets.map((packet) => packet.player)).size === 100, 'must produce one packet per unique roster player');

const snsQueue = packets.filter((packet) => packet.status === 'SNS_TIEBREAK').map((packet) => ({
  player: packet.player,
  team: packet.team,
  current_npb_plus_sprint_speed_kmh: packet.current_npb_plus_anchor.value,
  current_band: packet.current_npb_plus_anchor.speed_band,
  reason_codes: packet.status_reasons.join('|'),
  confirmation_target: packet.status_reasons.includes('COHORT_ORDER_CONFLICT_WITH_CURRENT_NPB_ORDINAL')
    ? 'Resolve whether the current NPB+ ordinal and the historical same-cohort physical order can be reconciled without a unit conversion.'
    : 'Obtain a second independent current-season speed observation or published NPB+ sample/qualified-run count.',
  decision_hypothesis: packet.status_reasons.includes('COHORT_ORDER_CONFLICT_WITH_CURRENT_NPB_ORDINAL')
    ? 'Historical 50m and current in-game NPB+ may reflect different eras or measurement constructs; do not force a numerical bridge.'
    : 'The public current NPB+ rank may be unstable because PA is under 100 and run-count metadata are not published.',
  comparison_anchors: JSON.stringify({
    faster: packet.faster_anchor ? { player: packet.faster_anchor.player, value: packet.faster_anchor.value, band: packet.faster_anchor.speed_band } : null,
    slower: packet.slower_anchor ? { player: packet.slower_anchor.player, value: packet.slower_anchor.value, band: packet.slower_anchor.speed_band } : null,
    same_band: packet.same_band_anchors.map((anchor) => ({ player: anchor.player, value: anchor.value }))
  }),
  recommended_period: '2026 regular season; retain source date and measurement definition with every check',
  minimum_independent_source_count: 2,
  status: 'SNS_TIEBREAK'
}));

const highAnchors = anchors.filter((anchor) => anchor.anchor_confidence === 'HIGH');
const moderateAnchors = anchors.filter((anchor) => anchor.anchor_confidence === 'MODERATE');
const rejected = raw.filter((record) => ['REJECTED_OR_CONTEXT_ONLY', 'REJECTED_SOURCE_TIER', 'REJECTED_PROTOCOL_CONFLICT', 'REJECTED_LIVE_REVALIDATION', 'REJECTED_PROTOCOL', 'REJECTED_CONTEXT_ONLY', 'REJECTED_QA_ONLY'].includes(record.bank_acceptance_status));

function countBy(rows, key) {
  const result = {};
  for (const row of rows) {
    const value = typeof key === 'function' ? key(row) : row[key];
    const label = value ?? 'NULL_OR_UNKNOWN';
    result[label] = (result[label] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

const highPhysicalBands = highAnchors.filter((anchor) => anchor.metric === '50M_STANDING_START_SECONDS');
const coverageByYear = {};
for (let year = 2015; year <= 2026; year += 1) coverageByYear[year] = { raw_measurements: 0, high_confidence_anchors: 0, moderate_current_anchors: 0 };
for (const record of raw) {
  const year = Number(record.measurement_year);
  if (coverageByYear[year]) coverageByYear[year].raw_measurements += 1;
}
for (const anchor of highAnchors) {
  const year = Number(anchor.measurement_era);
  if (coverageByYear[year]) coverageByYear[year].high_confidence_anchors += 1;
}
for (const anchor of moderateAnchors) {
  const year = Number(anchor.measurement_era);
  if (coverageByYear[year]) coverageByYear[year].moderate_current_anchors += 1;
}

const sourceManifest = {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  purpose: 'Source manifest for a player-by-measurement-era physical speed evidence bank. This is not a ratings manifest.',
  non_negotiable_boundaries: [
    'No final game ability values are generated.',
    'No 50m or 30m value is proportionally converted to 90ft.',
    'No age decay or retrospective performance adjustment is applied.',
    'Steals, baserunning outcomes, contact-to-first times, and event anecdotes are context-only or rejected.',
    'No PowerPro, Prospi, MLB The Show, or other game value is read or used for anchor selection.',
    'MLB Sprint Speed, NPB+ sprint-speed, and Statcast 90ft splits retain separate metric definitions and aggregation labels.'
  ],
  source_inventory: [
    {
      source_manifest_id: 'samurai_university_2022_06_19',
      source_file: INPUTS.standard50,
      source_tier: 'A_OFFICIAL_TOP_FIVE_PLUS_C_UNVERIFIED_FULL_TABLE',
      primary_urls: ['https://www.japan-baseball.jp/jp/news/press/20220619_1.html', 'https://www.youtube.com/watch?v=fC8_8iA7Cao'],
      protocol: 'Electronic/photoelectric 50m stated in retained reference; only official top-five values admitted.',
      disposition: 'Five official values accepted; 25 third-party full-table values retained raw and rejected from high-confidence anchors.'
    },
    {
      source_manifest_id: 'samurai_university_2024_11_30',
      source_file: INPUTS.standard50,
      source_tier: 'A_PROTOCOL_B_FULL_VALUES',
      primary_urls: ['https://www.japan-baseball.jp/jp/news/press/20241130_1.html', 'https://www.hb-nippon.com/articles/2163'],
      protocol: 'Photoelectric 50m, common university national-team candidate camp cohort.',
      disposition: 'Full 27-player published values accepted as same-cohort physical ordinal anchors.'
    },
    {
      source_manifest_id: 'samurai_university_2026_06_22',
      source_file: INPUTS.standard2026,
      source_tier: 'A_PROTOCOL_B_FULL_VALUES',
      primary_urls: ['https://www.japan-baseball.jp/jp/news/press/20260622_2.html', 'https://www.hb-nippon.com/articles/14003'],
      protocol: 'Photoelectric 50m with an intermediate 30m on the same trial.',
      disposition: 'Full 31-player 50m cohort accepted; public 30m subset retained as support only.'
    },
    ...supplement.sources.map((source) => ({
      source_manifest_id: source.source_id,
      source_file: INPUTS.supplement,
      source_tier: source.source_tier,
      primary_urls: source.source_urls,
      protocol: source.protocol,
      disposition: source.accepted_for_high_confidence ? 'Accepted at source-record level; repeated session trials reduce to a documented session minimum.' : source.rejection_reason
    })),
    {
      source_manifest_id: supplement.direct_running_revalidation.source_id,
      source_file: INPUTS.supplement,
      source_tier: 'A_FIRST_PARTY_LIVE_REVERIFIED',
      primary_urls: [supplement.direct_running_revalidation.definition_url, supplement.direct_running_revalidation.running_splits_csv_template, supplement.direct_running_revalidation.sprint_speed_csv_template],
      protocol: 'Official Statcast 90ft running splits start at the initial step and are standardised to 90ft. Seasonal Sprint Speed remains a distinct metric.',
      disposition: 'Five player-season direct T90 records accepted after live CSV confirmation; 2022 Yoshitomo Tsutsugo rejected because both current official CSVs did not contain the row and no preserved snapshot was available.'
    },
    {
      source_manifest_id: 'existing_npb_physical_inventory_20260809',
      source_file: INPUTS.physicalInventory,
      source_tier: 'MIXED_ARCHIVAL',
      primary_urls: [],
      protocol: 'Existing repository player-by-player physical inventory.',
      disposition: 'All rows preserved raw; duplicate direct/standard rows are superseded by canonical sources and contextual/profile records remain non-anchor evidence.'
    },
    {
      source_manifest_id: 'curated_30m_measurements_20260809',
      source_file: INPUTS.curated30,
      source_tier: 'MIXED_PROTOCOL_UNKNOWN',
      primary_urls: [],
      protocol: 'Curated 30m reporting with incomplete protocol metadata.',
      disposition: 'Retained as directional historical evidence only.'
    },
    {
      source_manifest_id: 'curated_homeplate_to_first_20260809',
      source_file: INPUTS.hpTo1b,
      source_tier: 'CONTEXT_ONLY',
      primary_urls: [],
      protocol: 'Game contact-to-first timings.',
      disposition: 'Retained and explicitly rejected as anchor input.'
    },
    {
      source_manifest_id: 'outlier_short_distance_context_20260809',
      source_file: INPUTS.outliers,
      source_tier: 'PROTOCOL_MISMATCH',
      primary_urls: [],
      protocol: 'Short-distance or mismatched-start outlier investigation.',
      disposition: 'Retained and explicitly rejected as anchor input.'
    },
    {
      source_manifest_id: 'historical_speed_qa_20260809',
      source_file: INPUTS.historyQa,
      source_tier: 'QA_ONLY',
      primary_urls: [],
      protocol: 'Historical comparator and contextual QA cases.',
      disposition: 'Retained as QA context only; no outcome, steal, or game-event evidence creates an anchor.'
    },
    {
      source_manifest_id: 'npb_plus_sprint_exposure_2026',
      source_file: INPUTS.npbPlus,
      source_tier: 'B_CURRENT_ORDINAL_SAMPLE_COUNT_NOT_PUBLISHED',
      primary_urls: npbPlus.sources?.map((source) => source.url).filter(Boolean) ?? [],
      protocol: 'Current 2026 NPB+ sprint-speed field; public row-level sample and qualified-run counts are unavailable.',
      disposition: 'All 100 target-roster rows become moderate same-dataset ordinal anchors for human review packets only.'
    },
    {
      source_manifest_id: 'measurement_date_resolution_20260809',
      source_file: INPUTS.dateResolution,
      source_tier: 'TEMPORAL_METADATA',
      primary_urls: [],
      protocol: 'Existing explicit/inferred/unknown measurement-date resolution.',
      disposition: 'Preserved as temporal metadata only; an inferred year never promotes a weak source to high confidence.'
    },
    {
      source_manifest_id: 'speed_acceleration_prior_guardrail',
      source_file: INPUTS.accelerationPrior,
      source_sha256: accelerationPriorSha256,
      source_tier: 'AGGREGATE_GUARDRAIL_ONLY',
      primary_urls: [],
      protocol: 'Aggregate acceleration prior retained in repository.',
      disposition: 'Hash receipt only. No value is read into raw records, anchors, bands, edges, or packets.'
    }
  ],
  negative_discovery_register: [
    {
      discovery_id: 'kanoya_university_photoelectric_30m_2024_2025',
      urls: ['https://blog.nifs-k.ac.jp/baseball/?p=3968', 'https://blog.nifs-k.ac.jp/baseball/?p=4408', 'https://blog.nifs-k.ac.jp/baseball/?p=4642'],
      finding: 'Official university-team reports provide named photoelectric 30m values, but no current NPB-100 or later-NPB identity overlap was verified in this bounded task.',
      disposition: 'NON_NPB_COHORT_CANDIDATE_NOT_ADDED_TO_NPB_CENTRIC_ANCHOR_BANK'
    },
    {
      discovery_id: 'bc_league_photoelectric_30m_2025_2026',
      urls: ['https://straightpress.jp/company_news/detail?pr=000000078.000033224'],
      finding: 'League reporting confirms a large photoelectric-test cohort, but does not publish named player-level values usable for anchors.',
      disposition: 'REJECTED_VALUES_NOT_PUBLIC'
    },
    {
      discovery_id: 'keio_college_baseball_photocell_50m_aggregate_study',
      urls: ['https://koara.lib.keio.ac.jp/xoonips/modules/xoonips/download.php/2022000011-20220042.pdf?file_id=184060'],
      finding: 'An academic report confirms a 111-player dual-beam photocell 50m test but provides no named player-level values and reports a unit/format ambiguity.',
      disposition: 'REJECTED_AGGREGATE_ONLY_NO_NAMED_VALUES'
    },
    {
      discovery_id: 'witty_2018_anonymized_30m_study',
      urls: ['https://www.jstage.jst.go.jp/article/cpjssct/2018/0/2018_28/_article/-char/ja'],
      finding: 'An anonymized university-baseball 30m study was found; player identity cannot be joined.',
      disposition: 'REJECTED_ANONYMIZED_NO_PLAYER_IDENTITY'
    }
  ],
  input_sha256: Object.fromEntries(Object.entries(INPUTS).map(([name, rel]) => [name, sha256File(rel)])),
  generated_artifacts: OUTPUTS,
  counts: {
    raw_measurements: raw.length,
    high_confidence_anchors: highAnchors.length,
    moderate_current_ordinal_anchors: moderateAnchors.length,
    rejected_or_context_rows: rejected.length,
    packets: packets.length,
    sns_queue_rows: snsQueue.length
  },
  coverage_by_measurement_year: coverageByYear
};

const coverage = {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  band_definition: {
    name: 'Within-cohort octile label',
    rule: 'For a same-metric, same-cohort ordered list, B1 is fastest and B8 slowest. A band is ordinal support, not a game rating and not a cross-metric conversion.',
    comparable_groups: 'High-confidence 50m cohorts and the separate 2026 NPB+ 100-player snapshot. Direct T90 player-seasons are intentionally unbanded across eras.'
  },
  accepted_anchor_counts: {
    high_confidence: highAnchors.length,
    moderate_current_ordinal: moderateAnchors.length,
    by_metric_high_confidence: countBy(highAnchors, 'metric'),
    by_source_high_confidence: countBy(highAnchors, 'source_manifest_id')
  },
  high_confidence_physical_band_coverage: countBy(highPhysicalBands, 'speed_band'),
  current_npb_plus_2026_band_coverage: countBy(moderateAnchors, 'speed_band'),
  cohort_coverage: Object.fromEntries([...graphGroups.entries()].map(([key, rows]) => [key, {
    count: rows.length,
    confidence: rows[0].anchor_confidence,
    metric: rows[0].metric,
    bands: countBy(rows, 'speed_band'),
    completeness: rows[0].cohort_completeness
  }])),
  coverage_by_measurement_year: coverageByYear,
  direct_absolute_t90: {
    accepted_count: highAnchors.filter((anchor) => anchor.metric === 'T90FT_SECONDS').length,
    band_status: 'UNBANDED_CROSS_ERA_BY_DESIGN',
    reason: 'Direct values are real 90ft observations but different player-season eras are not treated as one current physical cohort.'
  }
};

const graph = {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  purpose: 'Sparse relative comparison graph. No edge creates a game rating or a cross-unit equivalence.',
  edge_counts: {
    total: pairwiseEdges.length,
    high: pairwiseEdges.filter((edge) => edge.confidence === 'HIGH').length,
    moderate: pairwiseEdges.filter((edge) => edge.confidence === 'MODERATE').length,
    same_band_adjacencies: pairwiseEdges.filter((edge) => edge.relation === 'SAME_BAND_ADJACENT_ORDINAL').length
  },
  unconnected_high_confidence_anchors: highAnchors.filter((anchor) => anchor.metric === 'T90FT_SECONDS').map((anchor) => ({
    anchor_id: anchor.anchor_id,
    player: anchor.player,
    measurement_era: anchor.measurement_era,
    reason: 'No cross-era direct-T90 graph edge is emitted; that comparison would overstate current equivalence.'
  })),
  edges: pairwiseEdges
};

const statusCounts = countBy(packets, 'status');
const qaChecks = [];
function check(name, passed, detail) {
  qaChecks.push({ name, passed: Boolean(passed), detail });
}
check('raw_inventory_preserved', raw.length > 250, `raw=${raw.length}`);
check('exact_100_packets', packets.length === 100 && new Set(packets.map((packet) => packet.player)).size === 100, `packets=${packets.length}`);
check('five_live_direct_t90_accepted', highAnchors.filter((anchor) => anchor.metric === 'T90FT_SECONDS').length === 5, `direct_t90=${highAnchors.filter((anchor) => anchor.metric === 'T90FT_SECONDS').length}`);
check('tsutsugo_live_rejection', !highAnchors.some((anchor) => anchor.player_key === nameKey('筒香嘉智')), 'Tsutsugo has no accepted high-confidence direct anchor');
check('2021_protocol_conflict_rejected', !highAnchors.some((anchor) => anchor.source_manifest_id === 'samurai_university_2021_12_03_protocol_conflict'), '2021 source has no accepted anchor');
check('no_proportional_50m_to_t90_conversion', !raw.some((record) => String(record.notes ?? '').toLowerCase().includes('proportional conversion')), 'no converted records emitted');
check('no_game_rating_output_fields', !JSON.stringify({ raw, anchors, packets, graph }).match(/pawapuro|powerpro|prospi|the show/iu), 'generated evidence artifacts have no game-rating field or value');
check('all_sns_rows_exactly_status_sns', snsQueue.length === packets.filter((packet) => packet.status === 'SNS_TIEBREAK').length, `queue=${snsQueue.length}`);
check('packet_statuses_exhaustive', Object.values(statusCounts).reduce((sum, count) => sum + count, 0) === 100, JSON.stringify(statusCounts));
check('edge_direction_invariant', pairwiseEdges.every((edge) => edge.metric === 'NPB_PLUS_SPRINT_SPEED_KMH' ? edge.faster_value >= edge.slower_value : edge.faster_value <= edge.slower_value), `edges=${pairwiseEdges.length}`);
check('all_high_physical_anchor_records_have_source', highAnchors.every((anchor) => anchor.source_manifest_id && anchor.source_tier), `high=${highAnchors.length}`);
check('no_unknown_high_confidence_measurement_era', highAnchors.every((anchor) => anchor.measurement_era !== 'UNKNOWN'), 'all high anchors have a stated measurement era');
check('no_current_npb_anchor_without_bracket_or_boundary', packets.every((packet) => packet.current_npb_plus_anchor && packet.allowed_use.includes('human relative-anchor')), 'all packets retain current anchor and scope');
check('source_manifest_raw_count_match', sourceManifest.counts.raw_measurements === raw.length, `manifest=${sourceManifest.counts.raw_measurements}, raw=${raw.length}`);
check('no_final_rating_language', !JSON.stringify({ anchors, packets }).match(/final_rating|rating_value|走力査定/iu), 'no rating output concept emitted');
const buildQa = {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  independent: false,
  passed: qaChecks.every((item) => item.passed),
  checks: qaChecks,
  counts: {
    raw: raw.length,
    high_confidence_anchors: highAnchors.length,
    moderate_anchors: moderateAnchors.length,
    edges: pairwiseEdges.length,
    packets: packets.length,
    sns_queue: snsQueue.length
  }
};
assert(buildQa.passed, `internal QA failed: ${qaChecks.filter((item) => !item.passed).map((item) => item.name).join(', ')}`);

const independentQa = fs.existsSync(abs(OUTPUTS.independentQa)) ? readJson(OUTPUTS.independentQa) : null;
const independentQaClause = independentQa
  ? `独立QAファイルも検出: ${independentQa.passed ? 'PASS' : 'FAIL'}。`
  : '独立QAは別担当で実施後、この監査を再生成します。';
const auditLines = [
  '# 走力 Historical High-Confidence Anchor Bank — 2015–2026',
  '',
  '## 結論',
  '',
  'この成果物は、選手×計測年代を崩さずに保存した身体計測・直接90ft・現在NPB+の比較補助台帳です。最終的な走力値は一切出力していません。',
  '',
  '## 固定した境界',
  '',
  '- 50m/30mを90ftへ比例変換していません。',
  '- 年齢減衰、盗塁数、走塁結果、打撃から一塁までの到達、イベント単発速度をアンカー選択に使っていません。',
  '- PowerPro、プロスピ、MLB The Showを参照・入力・選択に使っていません。',
  '- MLB Sprint Speed、NPB+、Statcast 90ftは別定義・別集計のまま保持し、数値橋渡しをしていません。',
  '',
  '## 生データとソース発見',
  '',
  `- 生データ行: ${raw.length}`,
  `- 高信頼アンカー: ${highAnchors.length}`,
  `- 現在NPB+の中信頼・同一データ集合アンカー: ${moderateAnchors.length}`,
  `- 棄却／文脈のみ行: ${rejected.length}`,
  `- 侍ジャパン大学候補の光電管50mは、公式の「2022年以降」表現を安全な開始点に採用しました。2021年は公式記事の光電管記載と2025年公式説明が衝突するため、全${(supplement.sources.find((source) => source.source_id === 'samurai_university_2021_12_03_protocol_conflict')?.records ?? []).length}件を保留棄却しました。`,
  '- 2022年6月の既存30人表は、公式で確認できた上位5人のみ採用し、残り25人は生データに残して高信頼から外しました。',
  '- 2025年12月は35人・表示62試技を保持し、同一セッション複数試技の代表値は最小値です。この選び方は補正や別日比較を意味しません。',
  '',
  '## 絶対直接値',
  '',
  '公式Statcast CSVをライブ再検証できたT90は5選手年代です（カリステ2017、サンタナ2020、秋山翔吾2021、ポランコ2021、モンテロ2024）。筒香嘉智2022は現在の公式running-splitsとSprint Speed CSVで行が見つからず、保存済みスナップショットもないため棄却しました。',
  '',
  '## アンカー・バンド・年代',
  '',
  'バンドは同一指標・同一コホート内の8分位ラベルです。速さの最終評価ではなく、比較の位置を示すだけです。直接T90の異年代5件は意図的にバンド化・相互エッジ化していません。',
  '',
  `- 高信頼50m物理アンカーのバンド分布: ${JSON.stringify(coverage.high_confidence_physical_band_coverage)}`,
  `- 2026 NPB+ 100人の中信頼バンド分布: ${JSON.stringify(coverage.current_npb_plus_2026_band_coverage)}`,
  `- 年代別の生データ／高信頼／中信頼: ${JSON.stringify(coverageByYear)}`,
  '',
  '## 比較グラフ',
  '',
  `- エッジ総数: ${graph.edge_counts.total}`,
  `- 高信頼エッジ: ${graph.edge_counts.high}`,
  `- 中信頼エッジ: ${graph.edge_counts.moderate}`,
  `- 同一バンド隣接エッジ: ${graph.edge_counts.same_band_adjacencies}`,
  '',
  '高信頼エッジは同日・同形式の光電管コホート内だけです。中信頼エッジは2026 NPB+ 100人の同一スナップショット内だけで、公開サンプル数／qualified-run数がないことを保持しています。',
  '',
  '## 100人相対パケット',
  '',
  `- 参加: ${packets.length}/100`,
  `- 状態内訳: ${JSON.stringify(statusCounts)}`,
  `- SNS再確認待ち: ${snsQueue.length}`,
  `- 動画レビュー待ち: ${statusCounts.VIDEO_REVIEW ?? 0}`,
  `- 情報不足: ${statusCounts.INSUFFICIENT ?? 0}`,
  '',
  'SNSキューに入れるのは、PAが100未満で現行NPB+の公開ラン数がない者、または同じ過去物理コホート順位と2026 NPB+順位が逆向きになる者だけです。全P1扱いにはしていません。',
  '',
  '## 主な不確実性と否定的発見',
  '',
  '1. 2015–2020は高信頼のNPB系光電管大規模コホートを確認できず、空白を埋める推定をしていません。',
  '2. 2022年6月の25人、2021年12月の4人、手動計測・方式不明の30m/50m、home-to-first、盗塁・走塁結果は保持したうえでアンカーから外しました。',
  '3. MLB直接90ftは実測定義上の絶対値ですが、年代差・リーグ差を越えて現在NPB+へ数値変換していません。',
  '4. 2026 NPB+は100/100結合できましたが、選手別サンプル数とqualified-run数は公開されていません。',
  '5. 鹿屋体育大の光電管30m、BCリーグの大規模測定、慶應の111人研究、匿名30m研究も発見しましたが、NPB中心の名寄せ可能な個人値という要件を満たさず、source manifestのnegative discovery registerに明記して採用していません。',
  '',
  '## QA',
  '',
  `内部QAは ${buildQa.passed ? 'PASS' : 'FAIL'}（${buildQa.checks.length}件）です。${independentQaClause}`,
  '',
  '## 次の安全な作業',
  '',
  'SNSキューだけを、同一測定定義・日付・独立ソース数を明記して再確認してください。未確認の候補をゲーム能力値へ直結させないでください。',
  '',
  '## 成果物',
  '',
  `- ${OUTPUTS.manifest}`,
  `- ${OUTPUTS.rawJson} / ${OUTPUTS.rawCsv}`,
  `- ${OUTPUTS.anchorJson} / ${OUTPUTS.anchorCsv}`,
  `- ${OUTPUTS.rejectedCsv}`,
  `- ${OUTPUTS.coverage}`,
  `- ${OUTPUTS.graph}`,
  `- ${OUTPUTS.packets} / ${OUTPUTS.snsQueue}`,
  `- ${OUTPUTS.buildQa}`
];
const audit = `${auditLines.join('\n')}\n`;

const rawCsvColumns = ['raw_id', 'player', 'player_display', 'team_or_affiliation', 'measurement_date', 'measurement_year', 'measurement_era', 'metric', 'value', 'unit', 'timing_method', 'start_protocol', 'surface_or_conditions', 'cohort_id', 'cohort_completeness', 'source_manifest_id', 'source_tier', 'source_name', 'source_url', 'evidence_class', 'original_usage_class', 'canonicality', 'high_confidence_candidate', 'bank_acceptance_status', 'rejection_reason', 'same_measurement_cluster_id', 'temporal_resolution_status', 'selected_as_anchor', 'selected_anchor_id', 'notes'];
const anchorCsvColumns = ['anchor_id', 'player', 'measurement_era', 'measurement_date', 'metric', 'value', 'unit', 'direction', 'cohort_id', 'cohort_completeness', 'source_manifest_id', 'source_tier', 'anchor_confidence', 'bank_acceptance_status', 'raw_trial_count', 'selection_method', 'selection_scope', 'speed_band', 'band_basis', 'cohort_rank', 'cohort_size', 'integration_boundary', 'limitations'];
const rejectedCsvColumns = ['raw_id', 'player', 'measurement_era', 'metric', 'value', 'unit', 'evidence_class', 'source_manifest_id', 'source_tier', 'canonicality', 'bank_acceptance_status', 'rejection_reason', 'source_url', 'notes'];
const snsCsvColumns = ['player', 'team', 'current_npb_plus_sprint_speed_kmh', 'current_band', 'reason_codes', 'confirmation_target', 'decision_hypothesis', 'comparison_anchors', 'recommended_period', 'minimum_independent_source_count', 'status'];

writeJson(OUTPUTS.manifest, sourceManifest);
writeJson(OUTPUTS.rawJson, {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  purpose: 'Normalised raw physical-speed inventory. Every record retains a measurement era, evidence class, source tier, and explicit acceptance or rejection status.',
  source_manifest: OUTPUTS.manifest,
  records: raw
});
writeCsv(OUTPUTS.rawCsv, raw, rawCsvColumns);
writeJson(OUTPUTS.anchorJson, {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  purpose: 'Accepted high-confidence physical anchors plus explicitly labelled moderate current-ordinal anchors required for the 2026 100-player relative packets. Not a ratings output.',
  high_confidence_count: highAnchors.length,
  moderate_current_ordinal_count: moderateAnchors.length,
  anchors
});
writeCsv(OUTPUTS.anchorCsv, anchors, anchorCsvColumns);
writeCsv(OUTPUTS.rejectedCsv, rejected, rejectedCsvColumns);
writeJson(OUTPUTS.coverage, coverage);
writeJson(OUTPUTS.graph, graph);
writeJson(OUTPUTS.packets, {
  schema_version: SCHEMA_VERSION,
  as_of: AS_OF,
  target_roster_count: 100,
  status_counts: statusCounts,
  packets
});
writeCsv(OUTPUTS.snsQueue, snsQueue, snsCsvColumns);
writeJson(OUTPUTS.buildQa, buildQa);
writeText(OUTPUTS.audit, audit);

console.log(JSON.stringify({
  status: 'ok',
  raw_measurements: raw.length,
  high_confidence_anchors: highAnchors.length,
  moderate_current_ordinal_anchors: moderateAnchors.length,
  rejected_rows: rejected.length,
  edges: graph.edge_counts,
  packets: packets.length,
  packet_statuses: statusCounts,
  sns_queue: snsQueue.length,
  qa_passed: buildQa.passed
}, null, 2));

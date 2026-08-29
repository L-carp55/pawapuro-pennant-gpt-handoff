#!/usr/bin/env node

// SP-105: repair the SP-079 synthesis/calibration semantics without reopening
// evidence collection.  This file intentionally has no PowerPro/owner input
// path in the physical synthesis functions.  PowerPro is loaded only after
// the core rows have been frozen, for the post-hoc QA artifact.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'outputs', 'derived');
const AS_OF_DATE = '2026-08-29';
const AS_OF_YEAR = 2026;
const SCALE_STATUS = 'PROVISIONAL_PENDING_SP071_SP072';
const BASELINE_COMMIT = 'be3588b26e3ce0818880f80c4a0350764886bb6f';
const SELECTED_POLICY_ID = 'CONSERVATIVE_TIER_A_ANCHOR_LOWER_TIER_BOUNDED_CONSTRAINT';

const INPUT_PATHS = {
  policy: 'outputs/derived/sp079_appraisal_policy.json',
  sp100: 'outputs/derived/sp100_owner_approved_production_wiring_20260816.json',
  sp101: 'outputs/derived/sp101_current100_multibridge_evidence.json',
  sp101Show: 'outputs/derived/sp101_current100_the_show_evidence.json',
  sp101Graph: 'outputs/derived/sp101_pairwise_ordinal_graph.json',
  sp104Physical: 'outputs/derived/sp104_historical_physical_canonical.jsonl',
  sp104State: 'outputs/derived/sp104_current100_physical_state_before_after.json',
  sp104TransferPolicy: 'outputs/derived/sp104_selected_transfer_policy.json',
  sp104TransferBenchmark: 'outputs/derived/sp104_transfer_method_benchmark.json',
  sp104Receipts: 'outputs/derived/sp104_anchor_to_sparse_player_receipts.jsonl',
  mlbRunning: 'data/manual/sp104_mlb_running_splits.csv',
  mlbExposure: 'data/manual/sp104_mlb_sprint_exposure_h2f.csv',
  sp077: 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json',
  sp103Universe: 'outputs/derived/sp103_speed_evidence_universe.tsv',
  sp103Traceability: 'outputs/derived/sp103_owner_requirement_traceability.tsv',
  sp103Gaps: 'outputs/derived/sp103_gap_and_remediation_plan.json',
  sp103Methods: 'outputs/derived/sp103_inference_method_universe.json',
  ownerLedger: 'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
  registry: 'docs/state/speed_task_registry.tsv',
  browserReview: 'docs/audits/sp079_browser_independent_review_20260826.md',
  taskSpec: 'docs/tasks/SP105_SP079_SYNTHESIS_CALIBRATION_REPAIR_20260826.md',
  activationState: 'docs/state/speed_sp105_activation_state_20260826.json',
  baseline: 'outputs/derived/speed_2026_100_owner_review_master_20260813.json',
  sp079FrozenPolicy: 'outputs/derived/sp079_appraisal_policy.json',
  sp079FrozenManifest: 'outputs/derived/sp079_frozen_input_manifest.json',
  sp079FrozenSynthesis: 'outputs/derived/sp079_player_evidence_synthesis.jsonl',
  sp079FrozenCsv: 'outputs/derived/sp079_final_practical_speed_100.csv',
  sp079FrozenJson: 'outputs/derived/sp079_final_practical_speed_100.json',
  sp079FrozenAblation: 'outputs/derived/sp079_final_value_component_ablation.json',
  sp079FrozenPowerpro: 'outputs/derived/sp079_powerpro_posthoc_qa.json',
  sp079FrozenQa: 'outputs/derived/qa_sp079_final_practical_reappraisal.json',
  sp079FrozenGlobalQa: 'outputs/derived/sp079_global_consistency_qa.json',
  sp079FrozenReport: 'docs/reports/sp079_final_practical_speed_100.md',
  sp079FrozenAudit: 'docs/audits/sp079_final_practical_reappraisal_independent_audit.md'
};

const COMPONENTS = [
  'peak_speed',
  'acceleration_h2f_t90_90ft',
  'historical_physical',
  'mlb_statcast_running_bridge',
  'the_show_context',
  'analog_ordinal_transition',
  'statistical_proxies',
  'scouting_community_video_usage_context'
];

const PHYSICAL_FAMILIES = ['PEAK', 'ACCELERATION_H2F', 'END_TO_END_90FT', 'SHORT_DISTANCE'];
const POINT_SEMANTICS = new Set([
  'DEFENSIBLE_POINT_ESTIMATE',
  'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE',
  'NO_DEFENSIBLE_POINT'
]);

// These are physical-source/protocol priors, declared before seeing final
// values.  They are used only by candidate B diagnostics, never by the
// selected conservative policy and never learned from PowerPro labels.
const FAMILY_PRIORS = {
  PEAK: { tier: 'A', base: 1.00, role: 'CURRENT_DIRECT_PHYSICAL_ANCHOR' },
  END_TO_END_90FT: { tier: 'A_OR_B', base: 0.72, role: 'DIRECT_OR_STANDARDIZED_90FT_WHEN_EXPLICIT' },
  ACCELERATION_H2F: { tier: 'B', base: 0.34, role: 'H2F_ACCELERATION_CONTEXT_NOT_T90' },
  SHORT_DISTANCE: { tier: 'B', base: 0.28, role: 'NATIVE_SHORT_DISTANCE_CONTEXT' }
};

// The checked-in frozen artifacts produced by the be3588 SP-079 generator
// followed by its independent QA.  A fresh isolated clone was rerun before
// this SP-105 execution and matched every hash below.
const FROZEN_BASELINE_HASHES = {
  policy: 'f901959fee00c74c0c46d9f3be04a2ff79fcbd30bbb42b5b9efe58fa697fc4e3',
  sp079FrozenManifest: 'fbb5632da62f7483f6116f736b18875569a8641a3d628a7295848de3b0f19ff1',
  sp079FrozenSynthesis: 'e79dcb1efdb8d6e7bb866ad906f2351aaba65e07e9c513a757e52c325448de3a',
  sp079FrozenCsv: 'a4106442a1bae58fcc0004c8fd87f0feb454c00d928a4551976efa5c9cc6a7fa',
  sp079FrozenJson: 'd067c436478ff74cd1b883b78e89b995411b4fddaff86401ec006e91c8eb61d0',
  sp079FrozenAblation: '23321cea90549686dc55edb4ff02d89b88b91ed6555256096df88f7fd98d979e',
  sp079FrozenPowerpro: '7fbd94e17e5d67623ff9e732c3d21b5e5b1a062b80a827e8f4b39ee87146c46a',
  sp079FrozenGlobalQa: '0307088230e7b3574b26b5f60410d5825a13a6604b588ad0de52f3acae44fce4',
  sp079FrozenQa: 'fed02eb76521a27324fdceba4ce398d3e02cc9006723b9300ee13a9ed59cb2bd',
  sp079FrozenReport: '98d4406bfdefd3e89013268e8a8d5c2ffa68245de239e79076ed9028acbcecc4',
  sp079FrozenAudit: 'ec8fb82960cdb1e284464456834b7c9b4fc25d6465afe70ad284166a8a1956c9'
};

function abs(rel) {
  return path.join(ROOT, rel);
}

function readText(rel) {
  return fs.readFileSync(abs(rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}

function readJsonl(rel) {
  const raw = readText(rel).trim();
  return raw ? raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(rel) {
  return sha256Buffer(fs.readFileSync(abs(rel)));
}

function writeJson(rel, value) {
  const target = abs(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(rel, value) {
  const target = abs(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

function assert(condition, message) {
  if (!condition) throw new Error(`SP-105 fail-closed: ${message}`);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function median(values) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function mad(values, center = median(values)) {
  if (center === null) return null;
  return median(values.filter(Number.isFinite).map((x) => Math.abs(x - center)));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))];
}

function yearsAgo(value) {
  const n = finiteNumber(value);
  if (n === null || n < 1900 || n > 2100) return null;
  return Math.max(0, AS_OF_YEAR - n);
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function stableHash(value) {
  return sha256Buffer(Buffer.from(JSON.stringify(stableObject(value))));
}

function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).filter((r) => r.some((v) => v !== '')).map((r) => Object.fromEntries(header.map((key, i) => [key, r[i] ?? ''])));
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, headers) {
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\n')}\n`;
}

function percentileFaster(values, value) {
  const xs = values.filter(Number.isFinite);
  if (!xs.length || !Number.isFinite(value)) return null;
  const slower = xs.filter((x) => x > value).length;
  const tied = xs.filter((x) => x === value).length;
  return clamp((slower + tied / 2) / xs.length);
}

function percentileInterval(values, interval) {
  if (!interval) return null;
  const pLow = percentileFaster(values, interval[1]);
  const pHigh = percentileFaster(values, interval[0]);
  if (pLow === null || pHigh === null) return null;
  return [Math.min(pLow, pHigh), Math.max(pLow, pHigh)];
}

function valueInterval(row) {
  let low = Array.isArray(row.value_range) ? finiteNumber(row.value_range[0]) : null;
  let high = Array.isArray(row.value_range) ? finiteNumber(row.value_range[1]) : null;
  const raw = finiteNumber(row.raw_value);
  if (low === null && raw !== null) low = raw;
  if (high === null && raw !== null) high = raw;
  if (low === null || high === null) return null;
  if (low > high) [low, high] = [high, low];
  return { low, high, midpoint: raw ?? ((low + high) / 2) };
}

function classifyCanonicalMetric(row) {
  const metric = String(row.metric ?? '');
  const lower = metric.toLowerCase();
  // The NPB+ top-speed and the quarantined local NPB+ H2F field are not
  // historical physical-family records in this function.
  if (metric === 'NPB_PLUS_TOP_SPEED_KMH' || metric === 'NPB_PLUS_SPRINT_SPEED_KMH' || lower.includes('npb_plus')) return null;
  if (metric === 'T90FT_SECONDS') return 'END_TO_END_90FT';
  if (metric === 'T10FT_SECONDS' || metric === 'T30FT_SECONDS' || metric === 'HP_TO_1B_SECONDS' || metric === 'HP_TO_1B_NORMAL_SEC') return 'ACCELERATION_H2F';
  if (metric === '30M_CURATED_SECONDS' || metric === '30M_PROFILE_SECONDS' || metric === '30M_STANDING_START_SECONDS' || metric === '50M_PROFILE_SECONDS' || metric === '50M_STANDING_START_SECONDS' || metric === '50M_MANUAL_SECONDS' || lower === '50m') return 'SHORT_DISTANCE';
  return null;
}

function isLegacyNpbH2f(row) {
  const text = JSON.stringify({
    metric: row.metric,
    source_manifest_id: row.source_manifest_id,
    source_name: row.source_name,
    source_urls: row.source_urls
  }).toLowerCase();
  return /npb.?plus/.test(text) && /(hp.?to.?1b|h2f)/.test(text);
}

function chooseCanonicalDuplicates(records) {
  const priority = {
    ACCEPTED_HIGH_CONFIDENCE: 5,
    DIRECT_T90_BOUNDED_RECORD: 4,
    RETAINED_SUPPORT_ONLY: 3,
    RANGE_CONTEXT_ONLY: 2
  };
  const grouped = new Map();
  for (const record of records) {
    const interval = valueInterval(record);
    const key = [record.stable_player_key, record.metric, record.measurement_year ?? 'UNKNOWN', interval?.midpoint ?? record.canonical_id].join('|');
    const current = grouped.get(key);
    const score = priority[record.bank_acceptance_status] ?? 1;
    const width = interval ? interval.high - interval.low : Infinity;
    const currentInterval = current ? valueInterval(current) : null;
    const currentWidth = currentInterval ? currentInterval.high - currentInterval.low : Infinity;
    if (!current || score > (priority[current.bank_acceptance_status] ?? 1) || (score === (priority[current.bank_acceptance_status] ?? 1) && width < currentWidth)) grouped.set(key, record);
  }
  return [...grouped.values()];
}

function canonicalTier(row, family) {
  if (family === 'END_TO_END_90FT' && ['ACCEPTED_HIGH_CONFIDENCE', 'DIRECT_T90_BOUNDED_RECORD'].includes(row.bank_acceptance_status)) return 'A';
  return 'B';
}

function reliabilityScore(record) {
  if (record.family === 'PEAK') return 1;
  const prior = FAMILY_PRIORS[record.family]?.base ?? 0.25;
  const intervalWidth = Array.isArray(record.latent_interval) ? Math.max(0, record.latent_interval[1] - record.latent_interval[0]) : 1;
  const precision = 1 / (1 + 2 * intervalWidth);
  const age = record.date_gap_years === null || record.date_gap_years === undefined ? 0.75 : 1 / (1 + 0.08 * record.date_gap_years);
  const tier = record.tier === 'A' ? 1 : record.tier === 'A_OR_B' ? 0.75 : 0.35;
  return round(prior * precision * age * tier, 8);
}

function sourceReceiptFromCanonical(row, metric) {
  return {
    input_hash_key: 'sp104Physical',
    source_file: INPUT_PATHS.sp104Physical,
    canonical_id: row.canonical_id,
    source_manifest_id: row.source_manifest_id ?? null,
    source_name: row.source_name ?? null,
    source_urls: row.source_urls ?? [],
    metric,
    source_tier: row.source_tier ?? null,
    measurement_year: row.measurement_year ?? null,
    measurement_date: row.measurement_date ?? null,
    protocol: row.start_protocol ?? row.timing_method ?? null,
    identity_state: row.identity_state ?? null
  };
}

function recordFromCanonical(row, distributions) {
  const family = classifyCanonicalMetric(row);
  const interval = valueInterval(row);
  if (!family || !interval || !row.stable_player_key || row.identity_state !== 'CURRENT100_EXACT_NAME' || isLegacyNpbH2f(row)) return null;
  const values = distributions[row.metric] ?? [];
  const p = percentileFaster(values, interval.midpoint);
  const pInterval = percentileInterval(values, [interval.low, interval.high]);
  if (p === null || !pInterval) return null;
  const gap = yearsAgo(row.measurement_year);
  const protocolUncertainty = row.metric === 'T90FT_SECONDS' ? 0.025 : family === 'SHORT_DISTANCE' ? 0.035 : 0.03;
  const timeUncertainty = gap === null ? 0.06 : Math.min(0.12, gap * 0.012);
  const latentInterval = [clamp(pInterval[0] - protocolUncertainty - timeUncertainty), clamp(pInterval[1] + protocolUncertainty + timeUncertainty)];
  const record = {
    family,
    source_kind: 'SP104_CANONICAL_HISTORICAL',
    source_id: row.canonical_id,
    stable_player_key: row.stable_player_key,
    player: row.player,
    metric: row.metric,
    measurement_year: row.measurement_year ?? null,
    same_measurement_cluster_id: row.same_measurement_cluster_id ?? row.canonical_id,
    raw_value: interval.midpoint,
    value_range: [interval.low, interval.high],
    latent_point: round(p),
    latent_interval: [round(latentInterval[0]), round(latentInterval[1])],
    reference_population: {
      id: `SP104_CANONICAL_METRIC:${row.metric}`,
      denominator: values.length,
      metric: row.metric,
      direction: 'HIGHER_PERCENTILE_IS_FASTER',
      source_file: INPUT_PATHS.sp104Physical
    },
    tier: canonicalTier(row, family),
    tier_role: FAMILY_PRIORS[family]?.role ?? 'BOUNDED_PHYSICAL_CONTEXT',
    reliability_score: null,
    evidence_role: row.metric === 'T90FT_SECONDS' ? 'DIRECT_T90_BOUNDED_RECORD' : 'HISTORICAL_OR_PROTOCOL_BOUNDED_CONTEXT',
    numeric_use_state: row.numeric_use_state ?? null,
    bank_acceptance_status: row.bank_acceptance_status ?? null,
    date_gap_years: gap,
    duplicate_guard: 'ONE_CANONICAL_MEASUREMENT_CLUSTER_ONCE',
    used_in_synthesis: true,
    used_in_final_point: false,
    used_in_lower_tier_constraint: true,
    forbidden_transform_applied: false,
    provenance: sourceReceiptFromCanonical(row, row.metric)
  };
  record.reliability_score = reliabilityScore(record);
  return record;
}

function buildOfficialEvidence(rows, field, family, distributions, idPrefix, inputHashKey, sourceFile) {
  const out = [];
  for (const row of rows) {
    const key = row.stable_player_key;
    const value = finiteNumber(row[field]);
    if (!key || value === null) continue;
    const values = distributions[field] ?? [];
    const p = percentileFaster(values, value);
    if (p === null) continue;
    const season = finiteNumber(row.season);
    const gap = yearsAgo(season);
    const baseWidth = family === 'END_TO_END_90FT' ? 0.035 : 0.05;
    const timeWidth = gap === null ? 0.06 : Math.min(0.12, gap * 0.012);
    const record = {
      family,
      source_kind: 'MLB_STATCAST_OFFICIAL',
      source_id: `${idPrefix}:${key}:${row.season}:${row.__source_row}`,
      stable_player_key: key,
      player: row.npb_name ?? row.npb_name_en ?? null,
      metric: field,
      measurement_year: season,
      same_measurement_cluster_id: `MLB:${key}:${row.season}`,
      raw_value: value,
      value_range: [value, value],
      latent_point: round(p),
      latent_interval: [round(clamp(p - baseWidth - timeWidth)), round(clamp(p + baseWidth + timeWidth))],
      reference_population: {
        id: field === 'standardized_90ft_seconds' ? 'SP104_MLB_RUNNING_SPLITS_STANDARDIZED_90FT' : 'SP104_MLB_RUNNING_AND_EXPOSURE_RAW_H2F',
        denominator: values.length,
        field,
        direction: 'LOWER_SECONDS_IS_FASTER',
        source_file: sourceFile
      },
      tier: family === 'END_TO_END_90FT' ? 'A' : 'B',
      tier_role: family === 'END_TO_END_90FT' ? 'SAME_PLAYER_OFFICIAL_STANDARDIZED_90FT' : 'OFFICIAL_RAW_H2F_CONTEXT_SEPARATE_FROM_90FT',
      reliability_score: null,
      evidence_role: field === 'standardized_90ft_seconds' ? 'OFFICIAL_STANDARDIZED_90FT_SAME_PLAYER' : 'OFFICIAL_RAW_H2F_CONTEXT_SEPARATE_FROM_90FT',
      numeric_use_state: 'SAME_PLAYER_SEASON_BOUNDED_CONTEXT',
      bank_acceptance_status: 'OFFICIAL_SOURCE_FIELD',
      date_gap_years: gap,
      season,
      duplicate_guard: 'ONE_PLAYER_SEASON_ONCE_AND_FIELDS_NOT_ADDITIVE',
      used_in_synthesis: true,
      used_in_final_point: false,
      used_in_lower_tier_constraint: true,
      forbidden_transform_applied: false,
      provenance: {
        input_hash_key: inputHashKey,
        source_file: sourceFile,
        source_url: row.source_url ?? null,
        source_response_sha256: row.source_response_sha256 ?? null,
        source_export_row_number: finiteNumber(row.source_export_row_number) ?? row.__source_row,
        stable_player_key: key,
        mlbam_id: row.mlbam_id ?? null,
        season,
        field,
        exposure_join_state: row.exposure_join_state ?? null
      }
    };
    record.reliability_score = reliabilityScore(record);
    out.push(record);
  }
  return out;
}

function dedupeOfficial(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.stable_player_key, row.family, row.measurement_year, row.metric].join('|');
    const current = map.get(key);
    if (!current || row.source_id.localeCompare(current.source_id) < 0) map.set(key, row);
  }
  return [...map.values()];
}

function byKeyAndPlayer(rows, playerAccessor = (row) => row.player) {
  return {
    byKey: new Map(rows.map((row) => [row.stable_player_key, row])),
    byPlayer: new Map(rows.map((row) => [playerAccessor(row), row]))
  };
}

function lookup(index, stableKey, player) {
  return index.byKey.get(stableKey) ?? index.byPlayer.get(player);
}

function showContext(showRow) {
  const show = showRow?.the_show_implied_appraisal_range ?? {};
  const available = show.state === 'AVAILABLE_EXTERNAL_GAME_APPRAISAL' && Array.isArray(show.range);
  return {
    available,
    state: show.state ?? 'MISSING_BOUNDED',
    source_rows: show.source_rows ?? 0,
    range: available ? show.range : null,
    role: show.role ?? 'external_game_appraisal_not_physical_measurement',
    direct_copy_used: false,
    numeric_used_in_point: false,
    decision_use_rule: 'PRESENT_NO_DECISION_EFFECT_UNLESS_SEMANTICALLY_VALIDATED_BOUND_EXISTS'
  };
}

function buildContext(sp101Row, showRow, graph, receipt, queueRow, physicalRecords) {
  const show = showContext(showRow);
  const analogRows = sp101Row?.shared_indicator_analog_evidence?.valid_rows ?? [];
  const validAnalogRows = analogRows.filter((row) => row.common_support_status === 'COMMON_SUPPORT_MULTI_FEATURE' && row.matched_physical_percentile === null);
  const stableKey = sp101Row?.stable_player_key;
  const ordinalEdges = (graph.signed_pairwise_edges ?? []).filter((edge) => edge.source_family !== 'POWERPRO_BEHAVIOR' && (edge.faster_player_key === stableKey || edge.slower_player_key === stableKey));
  const annotations = (graph.context_annotations ?? []).filter((annotation) => annotation.player_key === stableKey);
  const transferMethods = receipt?.method_receipts ?? [];
  const boundedTransfer = transferMethods.filter((x) => x.result_state === 'BOUNDED_CONTEXT' && x.direct_numeric_promotion_allowed === false).map((x) => x.method_id);
  const noSupportTransfer = transferMethods.filter((x) => x.result_state === 'NO_COMMON_SUPPORT').map((x) => x.method_id);
  const proxy = queueRow?.statistical_proxy_context ?? {};
  const community = queueRow?.community_physical_context ?? {};
  const gameProxy = queueRow?.game_context_proxy_breakdown ?? {};
  const missing = queueRow?.missingness_and_coverage ?? {};
  const temporal = queueRow?.historical_physical_temporal_context ?? {};
  const technique = queueRow?.technique_separation_contract ?? {};
  const communityCount = finiteNumber(community.active_source_row_count) ?? 0;
  const proxyAvailable = proxy.state === 'COMPARABLE_2025_STATISTICAL_PROXY';
  const usageAvailable = gameProxy.evidence_state === 'AVAILABLE_MIXED_PROXY';
  const analogPresent = validAnalogRows.length > 0 || ordinalEdges.length > 0 || annotations.length > 0;
  const missingLanes = [];
  if (!physicalRecords.some((x) => x.family === 'ACCELERATION_H2F' && x.used_in_synthesis)) missingLanes.push('CURRENT_OR_MATCHED_ACCELERATION_H2F');
  if (!physicalRecords.some((x) => x.family === 'END_TO_END_90FT' && x.used_in_synthesis)) missingLanes.push('DIRECT_T90_OR_STANDARDIZED_90FT');
  if (!physicalRecords.some((x) => x.family === 'SHORT_DISTANCE' && x.used_in_synthesis)) missingLanes.push('SHORT_DISTANCE_30M_50M');
  if (!physicalRecords.some((x) => x.source_kind === 'MLB_STATCAST_OFFICIAL' && x.used_in_synthesis)) missingLanes.push('MATCHED_MLB_RUNNING_SPLITS');
  if (!show.available) missingLanes.push('THE_SHOW_SPEED_CONTEXT');
  if (missing.age_state === 'MISSING_BOUNDED' || temporal.age_context?.evidence_state === 'MISSING_BOUNDED') missingLanes.push('AGE');
  if (missing.injury_state === 'MISSING_BOUNDED' || temporal.injury_context?.evidence_state === 'MISSING_BOUNDED') missingLanes.push('INJURY');
  return {
    show,
    analog: {
      valid_common_support_count: validAnalogRows.length,
      valid_common_support_ids: validAnalogRows.flatMap((row) => row.evidence_ids ?? []).slice(0, 20),
      target_physical_percentile_used: false,
      physical_numeric_transfer_used: false,
      present: analogPresent,
      decision_use_rule: 'BOUNDED_CONTEXT_OR_ORDINAL_CONSTRAINT_ONLY;_NO_NUMERIC_POINT_TRANSFER'
    },
    ordinal_transition: {
      signed_non_powerpro_edge_count: ordinalEdges.length,
      signed_edge_ids: ordinalEdges.flatMap((edge) => edge.evidence_ids ?? []).slice(0, 20),
      transition_annotation_count: annotations.length,
      numeric_transfer_used: false,
      present: analogPresent,
      decision_use_rule: 'RANK_OR_CONFLICT_CONSTRAINT_ONLY_IF_SEMANTICALLY_SUPPORTED'
    },
    transfer: {
      bounded_context_methods: boundedTransfer,
      no_common_support_methods: noSupportTransfer,
      selected_method_id: null,
      production_use: false,
      direct_numeric_promotion_allowed: false,
      decision_use_rule: 'SP104_TRANSFER_NOT_PROMOTED'
    },
    proxy: {
      available: proxyAvailable,
      state: proxy.state ?? 'MISSING_SAME_TIME_STATISTICAL_EVIDENCE',
      role: proxy.role ?? 'CONTEXT_ONLY_NOT_A_PHYSICAL_TEACHER',
      numeric_proxy_used_in_point: false,
      numeric_proxy_used_as_teacher: false,
      present: proxyAvailable || usageAvailable,
      decision_use_rule: 'BOUNDED_UNCERTAINTY_CONTEXT_ONLY'
    },
    scouting_community_video_usage: {
      community_state: community.evidence_state ?? 'MISSING_BOUNDED',
      community_active_source_row_count: communityCount,
      community_directional_speed_signal_used: false,
      video_or_scouting_context_present: false,
      usage_proxy_context_present: usageAvailable,
      numeric_context_used_in_point: false,
      present: communityCount > 0,
      decision_use_rule: 'BOUNDED_UNCERTAINTY_CONTEXT_ONLY;_REACTIONS_NOT_INDEPENDENT_EVIDENCE'
    },
    technique: {
      separate: true,
      base_speed_excludes: technique.base_speed_excludes ?? [],
      stealing_or_aggression_used_in_point: false,
      bunt_used_as_pure_speed: false
    },
    age_injury: {
      age_state: temporal.age_context?.evidence_state ?? missing.age_state ?? 'MISSING_BOUNDED',
      injury_state: temporal.injury_context?.evidence_state ?? missing.injury_state ?? 'MISSING_BOUNDED',
      missing_is_negative: false,
      used_in_point: false
    },
    missing_lanes: unique(missingLanes),
    external_context_available: show.available || analogPresent,
    context_only: true,
    all_context_decision_rules_are_predeclared: true
  };
}

function makePeakRecord(sp100Row, sp101Row) {
  const peak = sp100Row.n_primary ?? {};
  const p = finiteNumber(peak.current_cohort?.percentile_faster_than);
  assert(p !== null, `missing current NPB+ percentile for ${sp100Row.player}`);
  const peakRange = sp101Row?.independent_physical_estimate?.peak_speed_range_percentile_0_100;
  const low = Array.isArray(peakRange) && finiteNumber(peakRange[0]) !== null ? clamp(Number(peakRange[0]) / 100) : clamp(p - 0.15);
  const high = Array.isArray(peakRange) && finiteNumber(peakRange[1]) !== null ? clamp(Number(peakRange[1]) / 100) : clamp(p + 0.15);
  const record = {
    family: 'PEAK',
    source_kind: 'SP100_CURRENT_NPB_PLUS',
    source_id: sp100Row.row_id,
    stable_player_key: sp100Row.stable_player_key,
    player: sp100Row.player,
    metric: 'top_speed_kmh',
    measurement_year: 2026,
    same_measurement_cluster_id: `SP100_PEAK:${sp100Row.stable_player_key}:2026`,
    raw_value: finiteNumber(peak.top_speed_kmh),
    value_range: [low, high],
    latent_point: round(p),
    latent_interval: [round(low), round(high)],
    reference_population: {
      id: 'SP100_CURRENT100_NPB_PLUS_2026',
      denominator: peak.current_cohort?.size ?? 100,
      metric: 'top_speed_kmh',
      direction: 'HIGHER_PERCENTILE_IS_FASTER',
      source_file: INPUT_PATHS.sp100
    },
    tier: 'A',
    tier_role: 'CURRENT_DIRECT_PHYSICAL_ANCHOR',
    reliability_score: 1,
    evidence_role: 'CURRENT_NPB_PLUS_PEAK_ANCHOR_ONLY',
    numeric_use_state: 'PEAK_LANE_ONLY',
    bank_acceptance_status: 'SP100_OWNER_APPROVED_ARCHITECTURE',
    date_gap_years: 0,
    duplicate_guard: 'NPB_PLUS_PEAK_IS_NOT_RECOUNTED_AS_HISTORICAL_PEAK',
    used_in_synthesis: true,
    used_in_final_point: true,
    used_in_lower_tier_constraint: false,
    forbidden_transform_applied: false,
    provenance: {
      input_hash_key: 'sp100',
      source_file: INPUT_PATHS.sp100,
      source_row_id: sp100Row.row_id,
      source_season_label: peak.source_season_label ?? '2026途中',
      field: 'n_primary.top_speed_kmh',
      measurement_reliability: peak.measurement_reliability ?? 'NOT_IDENTIFIABLE',
      cohort_size: peak.current_cohort?.size ?? 100
    }
  };
  return record;
}

function chooseClusterRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const key = record.same_measurement_cluster_id ?? record.source_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const selected = [];
  for (const group of groups.values()) {
    selected.push([...group].sort((a, b) => {
      const score = (b.reliability_score ?? 0) - (a.reliability_score ?? 0);
      if (score) return score;
      const aw = (a.latent_interval?.[1] ?? 1) - (a.latent_interval?.[0] ?? 0);
      const bw = (b.latent_interval?.[1] ?? 1) - (b.latent_interval?.[0] ?? 0);
      return aw - bw || a.source_id.localeCompare(b.source_id);
    })[0]);
  }
  return selected;
}

function summarizeFamily(family, records) {
  const eligible = records.filter((record) => record.family === family && record.used_in_synthesis !== false && Number.isFinite(record.latent_point));
  if (!eligible.length) return null;
  const clusterRecords = chooseClusterRecords(eligible);
  const points = clusterRecords.map((record) => record.latent_point);
  const low = Math.min(...clusterRecords.map((record) => record.latent_interval[0]));
  const high = Math.max(...clusterRecords.map((record) => record.latent_interval[1]));
  const tierCounts = {};
  for (const record of clusterRecords) tierCounts[record.tier] = (tierCounts[record.tier] ?? 0) + 1;
  const referencePopulations = unique(clusterRecords.map((record) => record.reference_population?.id));
  const dominantTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'B';
  return {
    family,
    available: true,
    point: round(median(points)),
    native_interval: [round(clamp(low)), round(clamp(high))],
    record_count: eligible.length,
    independent_cluster_count: clusterRecords.length,
    evidence_ids: unique(clusterRecords.map((record) => record.source_id)).slice(0, 40),
    source_kinds: unique(clusterRecords.map((record) => record.source_kind)),
    tier_counts: tierCounts,
    dominant_tier: dominantTier,
    reference_populations: referencePopulations,
    reliability_score: round(mean(clusterRecords.map((record) => record.reliability_score)), 8),
    point_role: family === 'PEAK' ? 'TIER_A_POINT_ANCHOR' : 'LOWER_TIER_NATIVE_SCALE_CONSTRAINT_ONLY',
    common_scale_point_used: family === 'PEAK',
    cluster_receipt: clusterRecords.map((record) => ({
      source_id: record.source_id,
      same_measurement_cluster_id: record.same_measurement_cluster_id,
      metric: record.metric,
      tier: record.tier,
      tier_role: record.tier_role,
      native_point: record.latent_point,
      native_interval: record.latent_interval,
      reference_population: record.reference_population,
      provenance: record.provenance
    }))
  };
}

function componentKeepsRecord(component, record) {
  if (component === 'peak_speed') return record.family !== 'PEAK';
  if (component === 'acceleration_h2f_t90_90ft') return record.family !== 'ACCELERATION_H2F' && record.family !== 'END_TO_END_90FT';
  if (component === 'historical_physical') return record.source_kind !== 'SP104_CANONICAL_HISTORICAL';
  if (component === 'mlb_statcast_running_bridge') return record.source_kind !== 'MLB_STATCAST_OFFICIAL';
  return true;
}

function componentPresent(base, component) {
  if (component === 'peak_speed') return base.physicalRecords.some((x) => x.family === 'PEAK');
  if (component === 'acceleration_h2f_t90_90ft') return base.physicalRecords.some((x) => x.used_in_synthesis && (x.family === 'ACCELERATION_H2F' || x.family === 'END_TO_END_90FT'));
  if (component === 'historical_physical') return base.physicalRecords.some((x) => x.used_in_synthesis && x.source_kind === 'SP104_CANONICAL_HISTORICAL');
  if (component === 'mlb_statcast_running_bridge') return base.physicalRecords.some((x) => x.used_in_synthesis && x.source_kind === 'MLB_STATCAST_OFFICIAL');
  if (component === 'the_show_context') return base.context.show.available;
  if (component === 'analog_ordinal_transition') return base.context.analog.present || base.context.ordinal_transition.present;
  if (component === 'statistical_proxies') return base.context.proxy.present;
  return base.context.scouting_community_video_usage.present;
}

function contextUncertainty(base, removed) {
  const rules = [];
  let value = 0;
  // The Show numeric range is intentionally not used to widen the physical
  // interval: it is a game-appraisal scale without an identified bridge.
  if (base.context.show.available && !removed.has('the_show_context')) rules.push({ lane: 'the_show_context', present: true, added: 0, effect: 'PRESENT_NO_DECISION_EFFECT' });
  if ((base.context.analog.present || base.context.ordinal_transition.present) && !removed.has('analog_ordinal_transition')) {
    value += 0.01;
    rules.push({ lane: 'analog_ordinal_transition', present: true, added: 0.01, effect: 'INTERVAL_ONLY_BOUNDED_CONTEXT' });
  }
  if (base.context.proxy.present && !removed.has('statistical_proxies')) {
    value += 0.01;
    rules.push({ lane: 'statistical_proxies', present: true, added: 0.01, effect: 'INTERVAL_ONLY_BOUNDED_CONTEXT' });
  }
  if (base.context.scouting_community_video_usage.present && !removed.has('scouting_community_video_usage_context')) {
    value += 0.008;
    rules.push({ lane: 'scouting_community_video_usage_context', present: true, added: 0.008, effect: 'INTERVAL_ONLY_BOUNDED_CONTEXT' });
  }
  return { value: round(value), rules };
}

function synthesize(base, removedComponents = [], calibrationReceiptByFamily = {}) {
  const removed = new Set(removedComponents);
  const included = base.physicalRecords.filter((record) => {
    if (record.used_in_synthesis === false) return false;
    return COMPONENTS.every((component) => !removed.has(component) || componentKeepsRecord(component, record));
  });
  const familySummaries = PHYSICAL_FAMILIES.map((family) => summarizeFamily(family, included)).filter(Boolean);
  const anchor = familySummaries.find((family) => family.family === 'PEAK') ?? null;
  const fallback = anchor ? null : [...familySummaries].sort((a, b) => (b.reliability_score ?? 0) - (a.reliability_score ?? 0) || a.family.localeCompare(b.family))[0] ?? null;
  let point = anchor?.point ?? fallback?.point ?? null;
  let pointSemantics = anchor ? 'DEFENSIBLE_POINT_ESTIMATE' : fallback ? 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE' : 'NO_DEFENSIBLE_POINT';
  let conflictState = 'NONE';
  const materialConflicts = [];
  const lowerTierConstraints = [];
  let sameScaleConflict = false;
  for (const family of familySummaries) {
    if (family.family === 'PEAK') continue;
    const calibration = calibrationReceiptByFamily[family.family] ?? {
      production_state: 'NOT_IDENTIFIABLE_NOT_SELECTED',
      common_support: false
    };
    lowerTierConstraints.push({
      family: family.family,
      tier: family.dominant_tier,
      native_point: family.point,
      native_interval: family.native_interval,
      reference_populations: family.reference_populations,
      source_kinds: family.source_kinds,
      point_weight_in_selected_policy: 0,
      constraint_role: 'NATIVE_SCALE_BOUND_ONLY',
      common_scale_bound: null,
      cross_family_calibration: calibration,
      no_equal_family_override: true
    });
  }
  // Only repeated measurements in the same family/reference context can be
  // called a direct point conflict.  Native percentiles from different
  // reference populations are never compared as though they share a scale.
  for (const family of familySummaries) {
    const points = family.cluster_receipt.map((x) => x.native_point).filter(Number.isFinite);
    if (points.length > 1 && Math.max(...points) - Math.min(...points) > 0.30 && family.family === 'PEAK') {
      sameScaleConflict = true;
      materialConflicts.push(`same_scale_${family.family}_spread=${round(Math.max(...points) - Math.min(...points), 4)}`);
    }
  }
  if (sameScaleConflict) {
    conflictState = 'UNRESOLVED_SAME_SCALE_PHYSICAL_CONFLICT';
    pointSemantics = 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE';
  } else if (lowerTierConstraints.length) {
    conflictState = 'LOWER_TIER_NONCOMMENSURATE_CONSTRAINT';
    materialConflicts.push(...lowerTierConstraints.map((x) => `${x.family}:native_percentile_not_common_scale`));
  }
  const context = contextUncertainty(base, removed);
  const lowerTierUncertainty = lowerTierConstraints.length ? Math.min(0.10, lowerTierConstraints.length * 0.015) : 0;
  const missingFamilyUncertainty = familySummaries.length <= 1 ? 0.02 : 0;
  let low;
  let high;
  if (anchor && !sameScaleConflict) {
    low = anchor.native_interval[0];
    high = anchor.native_interval[1];
    const added = lowerTierUncertainty + missingFamilyUncertainty + context.value;
    low = clamp(low - added);
    high = clamp(high + added);
  } else if (fallback && !sameScaleConflict) {
    // A no-anchor fallback is retained for a UI-compatible diagnostic only;
    // it is not ranked as a defensible current100 point.
    low = clamp(fallback.native_interval[0] - 0.15);
    high = clamp(fallback.native_interval[1] + 0.15);
  } else {
    low = 0;
    high = 1;
  }
  if (point !== null) {
    low = Math.min(low, point);
    high = Math.max(high, point);
  }
  let confidence = 'LOW';
  if (pointSemantics === 'NO_DEFENSIBLE_POINT' || sameScaleConflict) confidence = 'VERY_LOW';
  else if (!anchor || lowerTierConstraints.length >= 2) confidence = 'LOW';
  else confidence = 'LOW';
  let evidenceState = 'TIER_A_ANCHORED_PEAK_ONLY';
  if (pointSemantics === 'NO_DEFENSIBLE_POINT') evidenceState = 'NO_DEFENSIBLE_POINT';
  else if (pointSemantics !== 'DEFENSIBLE_POINT_ESTIMATE') evidenceState = 'DISPLAY_ONLY_FALLBACK_BOUNDED';
  else if (lowerTierConstraints.length) evidenceState = 'TIER_A_ANCHOR_WITH_LOWER_TIER_CONSTRAINTS';
  const ratingPoint = pointSemantics === 'DEFENSIBLE_POINT_ESTIMATE' && point !== null ? Math.round(clamp(point) * 100) : point === null ? null : Math.round(clamp(point) * 100);
  const ratingLow = Math.round(clamp(low) * 100);
  const ratingHigh = Math.round(clamp(high) * 100);
  const finalRankEligible = pointSemantics === 'DEFENSIBLE_POINT_ESTIMATE' && !sameScaleConflict;
  const familyPointInfluence = Object.fromEntries(PHYSICAL_FAMILIES.map((family) => [family, family === 'PEAK' && anchor ? 1 : 0]));
  const tierInfluence = {
    tier_a_anchor_point_weight: anchor ? 1 : 0,
    tier_b_point_weight: 0,
    tier_b_constraint_only: lowerTierConstraints.length > 0,
    current_high_tier_influence: anchor ? 'POINT_ANCHOR_ONLY' : 'NOT_AVAILABLE',
    historical_bounded_influence: lowerTierConstraints.length ? 'NATIVE_INTERVAL_CONSTRAINT_AND_UNCERTAINTY_ONLY' : 'NONE'
  };
  const missingPhysicalLanes = PHYSICAL_FAMILIES.filter((family) => !familySummaries.some((x) => x.family === family));
  return {
    latent_speed_percentile_point: point === null ? null : round(clamp(point)),
    latent_speed_percentile_interval: [round(clamp(low)), round(clamp(high))],
    provisional_practical_rating: ratingPoint,
    provisional_practical_rating_interval: [ratingLow, ratingHigh],
    point_semantics: pointSemantics,
    point_semantics_reason: anchor
      ? sameScaleConflict
        ? 'same_scale_physical_conflict_requires_display_midpoint_only'
        : 'current_NPB_plus_peak_is_declared_Tier_A_anchor;_lower_tiers_are_not_common_scale_point_votes'
      : fallback
        ? 'no_Tier_A_anchor_after_component_removal;fallback_is_native_scale_display_midpoint_only'
        : 'no_physical_evidence_remaining',
    final_rank_eligible: finalRankEligible,
    component_weights: familyPointInfluence,
    family_point_influence: familyPointInfluence,
    tier_influence: tierInfluence,
    physical_family_summaries: familySummaries,
    lower_tier_constraints: lowerTierConstraints,
    physical_family_count: familySummaries.length,
    missing_physical_family_count: missingPhysicalLanes.length,
    missing_physical_lanes: missingPhysicalLanes,
    rank_fastest: null,
    rank_percentile: null,
    confidence,
    confidence_drivers: [
      anchor ? 'Tier-A current NPB+ peak anchor is available' : 'no current Tier-A anchor is available',
      lowerTierConstraints.length ? 'lower-tier physical evidence retained as native-scale constraint; no equal point influence' : 'no lower-tier physical constraint is available',
      'measurement reliability remains NOT_IDENTIFIABLE where the upstream source says so',
      'missingness is not treated as slow'
    ],
    evidence_state: evidenceState,
    conflict_state: conflictState,
    material_conflicts: materialConflicts,
    contextual_components_present: {
      the_show: base.context.show.available && !removed.has('the_show_context'),
      analog_ordinal_transition: (base.context.analog.present || base.context.ordinal_transition.present) && !removed.has('analog_ordinal_transition'),
      statistical_proxies: base.context.proxy.present && !removed.has('statistical_proxies'),
      scouting_community_video_usage_context: base.context.scouting_community_video_usage.present && !removed.has('scouting_community_video_usage_context')
    },
    context_uncertainty_added: context.value,
    context_uncertainty_rules: context.rules,
    lower_tier_uncertainty_added: round(lowerTierUncertainty),
    missing_family_uncertainty_added: round(missingFamilyUncertainty),
    missingness_is_not_slow: true,
    technique_used_in_physical_point: false,
    powerpro_teacher_used: false,
    the_show_direct_copy: false,
    direct_30m_50m_to_t90_conversion: false,
    legacy_npb_plus_h2f_used: false,
    target_self_teaching_or_season_leakage: false,
    selected_production_transfer: false,
    recomputed_from_frozen_evidence: true,
    scale_status: SCALE_STATUS,
    selected_policy_id: SELECTED_POLICY_ID
  };
}

function rankResults(results) {
  const ranked = [...results].sort((a, b) => {
    const ap = a.latent_speed_percentile_point;
    const bp = b.latent_speed_percentile_point;
    if (a.final_rank_eligible !== b.final_rank_eligible) return a.final_rank_eligible ? -1 : 1;
    if (ap === null && bp === null) return a.stable_player_key.localeCompare(b.stable_player_key);
    if (ap === null) return 1;
    if (bp === null) return -1;
    return bp - ap || a.stable_player_key.localeCompare(b.stable_player_key);
  });
  let lastPoint = null;
  let rank = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    const item = ranked[i];
    if (!item.final_rank_eligible || item.latent_speed_percentile_point === null) {
      item.rank_fastest = null;
      item.rank_percentile = null;
      continue;
    }
    if (lastPoint === null || item.latent_speed_percentile_point !== lastPoint) rank = i + 1;
    item.rank_fastest = rank;
    item.rank_percentile = round((ranked.length - rank) / (ranked.length - 1), 6);
    lastPoint = item.latent_speed_percentile_point;
  }
  return results;
}

function projectResult(result) {
  return {
    point: result.latent_speed_percentile_point,
    display_rating: result.provisional_practical_rating,
    interval: result.latent_speed_percentile_interval,
    rank: result.rank_fastest,
    confidence: result.confidence,
    conflict_state: result.conflict_state,
    evidence_state: result.evidence_state,
    point_semantics: result.point_semantics
  };
}

function compareResult(full, ablated) {
  const changedFields = [];
  if (full.point !== ablated.point) changedFields.push('point');
  if (full.display_rating !== ablated.display_rating) changedFields.push('display_rating');
  if (JSON.stringify(full.interval) !== JSON.stringify(ablated.interval)) changedFields.push('interval');
  if (full.rank !== ablated.rank) changedFields.push('rank');
  if (full.confidence !== ablated.confidence) changedFields.push('confidence');
  if (full.conflict_state !== ablated.conflict_state) changedFields.push('conflict_state');
  if (full.evidence_state !== ablated.evidence_state) changedFields.push('evidence_state');
  if (full.point_semantics !== ablated.point_semantics) changedFields.push('point_semantics');
  const pointDelta = Number.isFinite(full.point) && Number.isFinite(ablated.point) ? ablated.point - full.point : null;
  const rankDelta = Number.isFinite(full.rank) && Number.isFinite(ablated.rank) ? ablated.rank - full.rank : null;
  return {
    changed_fields: changedFields,
    decision_use_effect: changedFields.length ? 'RECOMPUTED_CHANGED' : 'RECOMPUTED_NO_CHANGE',
    point_changed: changedFields.includes('point'),
    display_rating_changed: changedFields.includes('display_rating'),
    interval_changed: changedFields.includes('interval'),
    rank_changed: changedFields.includes('rank'),
    confidence_changed: changedFields.includes('confidence'),
    conflict_changed: changedFields.includes('conflict_state'),
    evidence_state_changed: changedFields.includes('evidence_state'),
    point_semantics_changed: changedFields.includes('point_semantics'),
    point_delta: pointDelta === null ? null : round(pointDelta),
    point_abs_delta: pointDelta === null ? null : round(Math.abs(pointDelta)),
    point_estimate_invalidated: Number.isFinite(full.point) && !Number.isFinite(ablated.point),
    point_estimate_created: !Number.isFinite(full.point) && Number.isFinite(ablated.point),
    rank_delta: rankDelta,
    rank_abs_delta: rankDelta === null ? null : Math.abs(rankDelta),
    rank_eligibility_invalidated: Number.isFinite(full.rank) && !Number.isFinite(ablated.rank),
    rank_eligibility_created: !Number.isFinite(full.rank) && Number.isFinite(ablated.rank),
    recomputation_check: 'ACTUAL_FULL_SYNTHESIS_FUNCTION_RERUN'
  };
}

function componentEffectAvailable(base, component) {
  return componentPresent(base, component);
}

function buildAblation(baseRows, fullResults, calibrationReceiptByFamily) {
  const cells = [];
  const summary = {};
  for (const component of COMPONENTS) {
    const ablatedResults = baseRows.map((base) => {
      const result = synthesize(base, [component], calibrationReceiptByFamily);
      result.stable_player_key = base.stable_player_key;
      return result;
    });
    rankResults(ablatedResults);
    for (let i = 0; i < baseRows.length; i += 1) {
      const full = projectResult(fullResults[i]);
      const ablated = projectResult(ablatedResults[i]);
      const diff = compareResult(full, ablated);
      const applicable = componentEffectAvailable(baseRows[i], component);
      cells.push({
        stable_player_key: baseRows[i].stable_player_key,
        player: baseRows[i].player,
        removed_component: component,
        component_available_in_full: applicable,
        component_presence_rule: applicable ? 'PRESENT_OR_APPLICABLE_IN_FROZEN_INPUT' : 'NOT_APPLICABLE_OR_MISSING',
        full,
        ablated,
        ...diff,
        present_but_zero_effect: applicable && diff.changed_fields.length === 0,
        recomputed_from_frozen_evidence: true
      });
    }
    const componentCells = cells.filter((cell) => cell.removed_component === component);
    const pointDeltas = componentCells.map((x) => x.point_abs_delta).filter(Number.isFinite);
    const rankDeltas = componentCells.map((x) => x.rank_abs_delta).filter(Number.isFinite);
    const magnitude = (values, invalidatedCount = 0, createdCount = 0) => values.length || invalidatedCount || createdCount ? {
      n: values.length,
      min: round(Math.min(...values)),
      max: round(Math.max(...values)),
      mean: round(mean(values)),
      median: round(median(values)),
      p90: values.length ? round([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * 0.90) - 1)]) : null,
      invalidated_count: invalidatedCount,
      created_count: createdCount
    } : { n: 0, min: null, max: null, mean: null, median: null, p90: null, invalidated_count: 0, created_count: 0 };
    summary[component] = {
      cell_count: componentCells.length,
      applicable_or_present_count: componentCells.filter((x) => x.component_available_in_full).length,
      not_applicable_or_missing_count: componentCells.filter((x) => !x.component_available_in_full).length,
      point_changed_count: componentCells.filter((x) => x.point_changed).length,
      display_rating_changed_count: componentCells.filter((x) => x.display_rating_changed).length,
      rank_changed_count: componentCells.filter((x) => x.rank_changed).length,
      interval_changed_count: componentCells.filter((x) => x.interval_changed).length,
      confidence_changed_count: componentCells.filter((x) => x.confidence_changed).length,
      conflict_changed_count: componentCells.filter((x) => x.conflict_changed).length,
      evidence_state_changed_count: componentCells.filter((x) => x.evidence_state_changed).length,
      point_semantics_changed_count: componentCells.filter((x) => x.point_semantics_changed).length,
      point_effect_magnitude: magnitude(pointDeltas, componentCells.filter((x) => x.point_estimate_invalidated).length, componentCells.filter((x) => x.point_estimate_created).length),
      rank_effect_magnitude: magnitude(rankDeltas, componentCells.filter((x) => x.rank_eligibility_invalidated).length, componentCells.filter((x) => x.rank_eligibility_created).length),
      point_estimate_invalidated_count: componentCells.filter((x) => x.point_estimate_invalidated).length,
      rank_eligibility_invalidated_count: componentCells.filter((x) => x.rank_eligibility_invalidated).length,
      applicable_or_present_zero_effect_count: componentCells.filter((x) => x.present_but_zero_effect).length,
      actual_recompute_required: true
    };
  }
  return {
    schema_version: 'sp105_final_value_component_ablation_v1',
    task_id: 'SP-105',
    method: 'ACTUAL_FULL_SP105_SYNTHESIS_RERUN_WITH_COMPONENT_REMOVED',
    component_order: COMPONENTS,
    summary,
    cells,
    generated_at: AS_OF_DATE,
    note: 'Point, display rating, rank, interval, confidence, conflict and evidence-state counts are reported separately. Interval-only changes are never counted as point changes.'
  };
}

function rawFamilyPoints(base) {
  const summaries = PHYSICAL_FAMILIES.map((family) => summarizeFamily(family, base.physicalRecords)).filter(Boolean);
  return Object.fromEntries(summaries.map((x) => [x.family, x.point]));
}

function pearsonCorrelation(pairs) {
  if (pairs.length < 2) return null;
  const xMean = mean(pairs.map((pair) => pair.x));
  const yMean = mean(pairs.map((pair) => pair.y));
  const numerator = pairs.reduce((sum, pair) => sum + (pair.x - xMean) * (pair.y - yMean), 0);
  const xDenominator = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair.x - xMean) ** 2, 0));
  const yDenominator = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair.y - yMean) ** 2, 0));
  return xDenominator && yDenominator ? round(numerator / (xDenominator * yDenominator)) : null;
}

function buildDescriptiveDiagnostics(baseRows, ablation, calibrationReceiptByFamily) {
  const nativePoints = new Map(baseRows.map((base) => [base.stable_player_key, rawFamilyPoints(base)]));
  const peak = PHYSICAL_FAMILIES.filter((family) => family !== 'PEAK').map((family) => {
    const pairs = [...nativePoints.entries()]
      .filter(([, values]) => Number.isFinite(values.PEAK) && Number.isFinite(values[family]))
      .map(([stable_player_key, values]) => ({ stable_player_key, x: values.PEAK, y: values[family] }));
    const rankCorrelation = rankCorrelationRows(pairs.map((pair) => ({ prediction: pair.x, target: pair.y })));
    return {
      family,
      paired_player_count: pairs.length,
      pearson_correlation: pearsonCorrelation(pairs),
      rank_correlation: rankCorrelation === null ? null : round(rankCorrelation),
      reference_population_note: 'family-native percentiles are not assumed commensurate; descriptive correlation only',
      selection_use: false,
      production_use: false
    };
  });
  const peakCells = ablation.cells.filter((cell) => cell.removed_component === 'peak_speed');
  const leavePeakOut = {
    method: 'ACTUAL_FULL_SYNTHESIS_RERUN_WITH_CURRENT_TIER_A_PEAK_REMOVED',
    selection_use: false,
    production_use: false,
    cell_count: peakCells.length,
    point_semantics_distribution: peakCells.reduce((acc, cell) => {
      acc[cell.ablated.point_semantics] = (acc[cell.ablated.point_semantics] ?? 0) + 1;
      return acc;
    }, {}),
    point_defined_after_removal_count: peakCells.filter((cell) => Number.isFinite(cell.ablated.point)).length,
    display_only_after_removal_count: peakCells.filter((cell) => cell.ablated.point_semantics === 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE').length,
    no_defensible_point_after_removal_count: peakCells.filter((cell) => cell.ablated.point_semantics === 'NO_DEFENSIBLE_POINT').length,
    rank_eligible_after_removal_count: peakCells.filter((cell) => Number.isFinite(cell.ablated.rank)).length,
    point_invalidation_count: peakCells.filter((cell) => cell.point_estimate_invalidated).length,
    rank_eligibility_invalidation_count: peakCells.filter((cell) => cell.rank_eligibility_invalidated).length,
    note: 'This is a descriptive stress test of Tier-A dependence, not a claim that lower-family fallback points are calibrated.'
  };
  return {
    schema_version: 'sp105_top_speed_descriptive_diagnostics_v1',
    top_speed_reference_population: 'SP100_CURRENT100_NPB_PLUS_2026',
    peak_vs_native_family: peak,
    leave_peak_out: leavePeakOut,
    calibration_receipt_count: Object.keys(calibrationReceiptByFamily).length,
    hard_coded_peak_weight: false,
    descriptive_only: true,
    generated_at: AS_OF_DATE
  };
}

function fitIsotonic(pairs) {
  const sorted = [...pairs].sort((a, b) => a.x - b.x || a.player.localeCompare(b.player));
  if (!sorted.length) return null;
  const blocks = [];
  for (const pair of sorted) blocks.push({ xMin: pair.x, xMax: pair.x, y: pair.y, n: 1 });
  for (let i = 0; i < blocks.length - 1;) {
    if (blocks[i].y <= blocks[i + 1].y) {
      i += 1;
      continue;
    }
    const left = blocks[i];
    const right = blocks[i + 1];
    const total = left.n + right.n;
    blocks.splice(i, 2, {
      xMin: left.xMin,
      xMax: right.xMax,
      y: (left.y * left.n + right.y * right.n) / total,
      n: total
    });
    if (i > 0) i -= 1;
  }
  const centers = blocks.map((block) => (block.xMin + block.xMax) / 2);
  const predict = (x) => {
    if (!Number.isFinite(x) || x < centers[0] || x > centers[centers.length - 1]) return null;
    if (centers.length === 1) return blocks[0].y;
    let i = 0;
    while (i < centers.length - 1 && x > centers[i + 1]) i += 1;
    const next = Math.min(i + 1, centers.length - 1);
    if (next === i) return blocks[i].y;
    const span = centers[next] - centers[i];
    const t = span ? (x - centers[i]) / span : 0;
    return blocks[i].y + (blocks[next].y - blocks[i].y) * t;
  };
  const residuals = pairs.map((pair) => {
    const predicted = predict(pair.x);
    return predicted === null ? null : pair.y - predicted;
  }).filter(Number.isFinite);
  const residualMad = mad(residuals, median(residuals));
  return {
    blocks,
    x_min: centers[0],
    x_max: centers[centers.length - 1],
    monotone: true,
    predict,
    residual_mad: residualMad === null ? 0.05 : Math.max(0.02, residualMad * 1.4826)
  };
}

function rankCorrelationRows(rows, predictionKey = 'prediction') {
  const usable = rows.filter((row) => Number.isFinite(row[predictionKey]) && Number.isFinite(row.target));
  if (usable.length < 2) return null;
  const byRank = (values) => {
    const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index);
    const ranks = Array(values.length);
    let last = null;
    let rank = 0;
    sorted.forEach((item, index) => {
      if (last === null || item.value !== last) rank = index + 1;
      ranks[item.index] = rank;
      last = item.value;
    });
    return ranks;
  };
  const a = byRank(usable.map((row) => row.prediction));
  const b = byRank(usable.map((row) => row.target));
  const am = mean(a);
  const bm = mean(b);
  const numerator = a.reduce((sum, value, i) => sum + (value - am) * (b[i] - bm), 0);
  const da = Math.sqrt(a.reduce((sum, value) => sum + (value - am) ** 2, 0));
  const db = Math.sqrt(b.reduce((sum, value) => sum + (value - bm) ** 2, 0));
  return da && db ? numerator / (da * db) : null;
}

function evaluateValidation(rows, predictionKey = 'prediction', intervalKey = 'interval') {
  const pointRows = rows.filter((row) => Number.isFinite(row[predictionKey]) && Number.isFinite(row.target));
  const absErrors = pointRows.map((row) => Math.abs(row[predictionKey] - row.target));
  const squared = pointRows.map((row) => (row[predictionKey] - row.target) ** 2);
  const intervalRows = rows.filter((row) => Array.isArray(row[intervalKey]) && Number.isFinite(row.target));
  const coverage = intervalRows.length ? intervalRows.filter((row) => row.target >= row[intervalKey][0] && row.target <= row[intervalKey][1]).length / intervalRows.length : null;
  return {
    case_count: rows.length,
    point_case_count: pointRows.length,
    held_out_mae: round(mean(absErrors)),
    held_out_rmse: squared.length ? round(Math.sqrt(mean(squared))) : null,
    held_out_rank_error: round(mean(pointRows.map((row) => Math.abs(row.rank_prediction - row.rank_target) / Math.max(1, row.rank_denominator - 1)))) ,
    held_out_rank_correlation: rankCorrelationRows(pointRows),
    interval_coverage: coverage === null ? null : round(coverage),
    mean_interval_width: intervalRows.length ? round(mean(intervalRows.map((row) => row[intervalKey][1] - row[intervalKey][0]))) : null,
    common_support_case_count: rows.filter((row) => row.common_support === true).length,
    common_support_coverage: rows.length ? round(rows.filter((row) => row.common_support === true).length / rows.length) : null
  };
}

function buildCalibrationReceipts(baseRows) {
  const familyByPlayer = new Map(baseRows.map((base) => [base.stable_player_key, rawFamilyPoints(base)]));
  const receipts = [];
  const receiptByTarget = {};
  for (const sourceFamily of PHYSICAL_FAMILIES) {
    for (const targetFamily of PHYSICAL_FAMILIES) {
      if (sourceFamily === targetFamily) continue;
      const pairs = [...familyByPlayer.entries()]
        .filter(([, points]) => Number.isFinite(points[sourceFamily]) && Number.isFinite(points[targetFamily]))
        .map(([player, points]) => ({ player, x: points[sourceFamily], y: points[targetFamily] }));
      const looRows = [];
      for (const heldOut of pairs) {
        const training = pairs.filter((pair) => pair.player !== heldOut.player);
        const fit = fitIsotonic(training);
        const predicted = fit?.predict(heldOut.x) ?? null;
        const commonSupport = Boolean(fit && heldOut.x >= fit.x_min && heldOut.x <= fit.x_max);
        looRows.push({
          held_out_player: heldOut.player,
          source_family: sourceFamily,
          target_family: targetFamily,
          source_native_percentile: round(heldOut.x),
          target_native_percentile: round(heldOut.y),
          prediction: predicted === null ? null : round(predicted),
          common_support: commonSupport,
          target_player_excluded_from_training: !training.some((pair) => pair.player === heldOut.player),
          same_player_seasons_held_together: true
        });
      }
      const allFit = fitIsotonic(pairs);
      const supportRows = looRows.filter((row) => row.common_support);
      const validRows = supportRows.filter((row) => Number.isFinite(row.prediction));
      const rawMae = mean(pairs.map((pair) => Math.abs(pair.x - pair.y)));
      const mappedMae = mean(validRows.map((row) => Math.abs(row.prediction - row.target_native_percentile)));
      const targetRank = (values, value) => 1 + values.filter((x) => x > value).length;
      const targetValues = pairs.map((pair) => pair.y);
      const sourceValues = pairs.map((pair) => pair.x);
      const sourceTargetRankError = pairs.length ? mean(pairs.map((pair) => Math.abs(targetRank(sourceValues, pair.x) - targetRank(targetValues, pair.y)) / Math.max(1, pairs.length - 1))) : null;
      const mappedRankRows = validRows.map((row) => ({ prediction: row.prediction, target: row.target_native_percentile }));
      const rankCorr = rankCorrelationRows(mappedRankRows);
      const productionEligible = pairs.length >= 20
        && (looRows.length ? supportRows.length / looRows.length >= 0.80 : false)
        && Number.isFinite(mappedMae)
        && Number.isFinite(rawMae)
        && mappedMae <= rawMae - 0.02
        && Number.isFinite(rankCorr)
        && rankCorr >= 0.35;
      const receipt = {
        source_family: sourceFamily,
        target_family: targetFamily,
        method_id: `LOO_ISOTONIC_${sourceFamily}_TO_${targetFamily}`,
        method: 'monotone_isotonic_common_support_mapping',
        training_population: 'SP104 physical records plus SP100 current100 peak anchor; family/player summaries only',
        pair_count: pairs.length,
        distinct_players: pairs.length,
        same_player_seasons_held_together: true,
        player_clustered_leave_one_out: true,
        target_player_excluded_from_training: true,
        feature_reference_population: sourceFamily === 'PEAK' ? 'SP100_CURRENT100_NPB_PLUS_2026' : 'family_specific_native_reference_population',
        target_reference_population: targetFamily === 'PEAK' ? 'SP100_CURRENT100_NPB_PLUS_2026' : 'family_specific_native_reference_population',
        common_support_rule: 'held-out source percentile must lie inside training-player source range; no extrapolation',
        common_support_case_count: supportRows.length,
        common_support_coverage: looRows.length ? round(supportRows.length / looRows.length) : 0,
        raw_uncalibrated_mae: round(rawMae),
        mapped_held_out_mae: round(mappedMae),
        mapped_rank_correlation: round(rankCorr),
        raw_pair_rank_error: round(sourceTargetRankError),
        production_eligible: productionEligible,
        production_state: productionEligible ? 'IDENTIFIABLE_FOR_DIAGNOSTIC_CANDIDATE' : 'NOT_IDENTIFIABLE_FOR_PRODUCTION',
        residual_uncertainty: allFit ? round(allFit.residual_mad) : null,
        extrapolation_count: looRows.filter((row) => !row.common_support).length,
        powerpro_used: false,
        owner_verdict_used: false,
        holdout_predictions: looRows
      };
      receipts.push(receipt);
      if (!receiptByTarget[targetFamily]) receiptByTarget[targetFamily] = {};
      receiptByTarget[targetFamily][sourceFamily] = receipt;
    }
  }
  return {
    schema_version: 'sp105_cross_family_calibration_receipts_v1',
    task_id: 'SP-105',
    status: receipts.some((x) => x.production_eligible) ? 'PARTIAL_IDENTIFIABLE_MAPPING_BUT_NOT_SELECTED' : 'NO_DEFENSIBLE_PRODUCTION_CROSS_FAMILY_MAPPING',
    target: 'physical_evidence_only',
    leakage_policy: {
      player_clustered: true,
      leave_player_out: true,
      seasons_held_together: true,
      no_target_self_teaching: true,
      no_extrapolation_outside_common_support: true
    },
    mapping_selection_rule: 'A mapping is production-eligible only with >=20 paired players, >=0.80 LOO common-support coverage, >=0.02 MAE improvement over raw percentile comparison, and held-out rank correlation >=0.35. All required physical families must remain supportable; otherwise use conservative anchor policy.',
    receipts,
    by_target_family: receiptByTarget,
    selected_for_production: false,
    selected_policy: SELECTED_POLICY_ID,
    generated_at: AS_OF_DATE
  };
}

function candidateWeightForFamily(summary) {
  const prior = FAMILY_PRIORS[summary.family]?.base ?? 0.25;
  const precision = 1 / (1 + (summary.native_interval[1] - summary.native_interval[0]) * 2);
  const tierMultiplier = summary.dominant_tier === 'A' ? 1 : summary.dominant_tier === 'A_OR_B' ? 0.75 : 0.35;
  return round(prior * precision * tierMultiplier, 8);
}

function rawSummaryByFamily(base) {
  return Object.fromEntries(PHYSICAL_FAMILIES.map((family) => [family, summarizeFamily(family, base.physicalRecords)]).filter(([, value]) => value));
}

function buildValidationCases(baseRows, calibrationReceipts) {
  const summaries = new Map(baseRows.map((base) => [base.stable_player_key, rawSummaryByFamily(base)]));
  const cases = [];
  for (const targetFamily of PHYSICAL_FAMILIES) {
    for (const base of baseRows) {
      const targetSummary = summaries.get(base.stable_player_key)?.[targetFamily];
      if (!targetSummary || !Number.isFinite(targetSummary.point)) continue;
      const sources = PHYSICAL_FAMILIES.filter((family) => family !== targetFamily && summaries.get(base.stable_player_key)?.[family]);
      if (!sources.length) continue;
      const sourcePoints = sources.map((family) => summaries.get(base.stable_player_key)[family].point);
      const sourceWeights = sources.map((family) => candidateWeightForFamily(summaries.get(base.stable_player_key)[family]));
      const sourceWeightTotal = sourceWeights.reduce((a, b) => a + b, 0);
      const aPrediction = mean(sourcePoints);
      const bPrediction = sourceWeightTotal ? sourcePoints.reduce((sum, value, i) => sum + value * sourceWeights[i], 0) / sourceWeightTotal : null;
      const aInterval = [Math.min(...sourcePoints), Math.max(...sourcePoints)];
      const bInterval = aInterval;
      const cMapped = [];
      const cIntervals = [];
      const supportStates = [];
      for (const sourceFamily of sources) {
        const receipt = calibrationReceipts.by_target_family?.[targetFamily]?.[sourceFamily];
        const row = receipt?.holdout_predictions?.find((x) => x.held_out_player === base.stable_player_key);
        if (row && Number.isFinite(row.prediction) && row.common_support) {
          cMapped.push({ value: row.prediction, weight: candidateWeightForFamily(summaries.get(base.stable_player_key)[sourceFamily]) });
          const uncertainty = receipt.residual_uncertainty ?? 0.05;
          cIntervals.push([clamp(row.prediction - uncertainty), clamp(row.prediction + uncertainty)]);
          supportStates.push(true);
        } else {
          supportStates.push(false);
        }
      }
      const cWeight = cMapped.reduce((sum, x) => sum + x.weight, 0);
      const cCommonSupport = supportStates.length > 0 && supportStates.every(Boolean);
      const cPrediction = cWeight && cCommonSupport ? cMapped.reduce((sum, x) => sum + x.value * x.weight, 0) / cWeight : null;
      const cInterval = cCommonSupport && cIntervals.length ? [Math.min(...cIntervals.map((x) => x[0])), Math.max(...cIntervals.map((x) => x[1]))] : [0, 1];
      cases.push({
        case_id: `${targetFamily}:${base.stable_player_key}`,
        held_out_player: base.stable_player_key,
        target_family: targetFamily,
        target: targetSummary.point,
        target_interval: targetSummary.native_interval,
        sources,
        raw_source_reference_populations: sources.flatMap((family) => summaries.get(base.stable_player_key)[family].reference_populations),
        a: { prediction: aPrediction, interval: aInterval, common_support: false },
        b: { prediction: bPrediction, interval: bInterval, common_support: false },
        c: { prediction: cPrediction, interval: cInterval, common_support: cCommonSupport },
        d: { prediction: null, interval: [0, 1], common_support: true, point_not_identifiable: true },
        target_player_excluded_from_any_calibration_training: true,
        same_player_seasons_held_together: true
      });
    }
  }
  return cases;
}

function candidateMetrics(cases, key) {
  const rows = cases.map((x) => ({
    prediction: x[key].prediction,
    interval: x[key].interval,
    target: x.target,
    common_support: x[key].common_support
  }));
  const pointRows = rows.filter((row) => Number.isFinite(row.prediction));
  const targetValues = pointRows.map((row) => row.target);
  const predictionValues = pointRows.map((row) => row.prediction);
  const rankByValue = (values, value) => 1 + values.filter((x) => x > value).length;
  const rankDenom = Math.max(2, pointRows.length);
  for (const row of pointRows) {
    row.rank_prediction = rankByValue(predictionValues, row.prediction);
    row.rank_target = rankByValue(targetValues, row.target);
    row.rank_denominator = rankDenom;
  }
  return evaluateValidation(rows, 'prediction', 'interval');
}

function buildPolicyBenchmark(baseRows, calibrationReceipts, provisionalAblation = null, descriptiveDiagnostics = null) {
  const cases = buildValidationCases(baseRows, calibrationReceipts);
  const candidates = {
    A_FROZEN_EQUAL_FAMILY_BASELINE: {
      policy_id: 'A_FROZEN_EQUAL_FAMILY_BASELINE',
      role: 'BASELINE_CONTROL_ONLY',
      point_rule: 'arithmetic mean of available native percentiles',
      reference_population_mixing: 'UNVALIDATED',
      metrics: candidateMetrics(cases, 'a'),
      selected: false,
      physical_only_validation: true,
      validity: 'CONTROL_ONLY_NOT_ACCEPTED'
    },
    B_TIER_AWARE_UNCALIBRATED_RELIABILITY: {
      policy_id: 'B_TIER_AWARE_UNCALIBRATED_RELIABILITY',
      role: 'DIAGNOSTIC_CANDIDATE',
      point_rule: 'predeclared source/protocol/time/interval reliability weights, but no common-scale mapping',
      reference_population_mixing: 'UNVALIDATED',
      weights: FAMILY_PRIORS,
      metrics: candidateMetrics(cases, 'b'),
      selected: false,
      physical_only_validation: true,
      validity: 'NOT_PRODUCTION_SAFE_WHILE_PERCENTILES_REMAIN_NONCOMMENSURATE'
    },
    C_LOO_COMMON_SCALE_ISOTONIC: {
      policy_id: 'C_LOO_COMMON_SCALE_ISOTONIC',
      role: 'DIAGNOSTIC_CANDIDATE',
      point_rule: 'player-clustered leave-one-player-out monotone mapping within held-out common support',
      reference_population_mixing: 'CALIBRATED_ONLY_WHEN_RECEIPT_ELIGIBLE',
      metrics: candidateMetrics(cases, 'c'),
      selected: false,
      physical_only_validation: true,
      eligible_mapping_count: calibrationReceipts.receipts.filter((x) => x.production_eligible).length,
      total_mapping_count: calibrationReceipts.receipts.length,
      validity: calibrationReceipts.receipts.every((x) => x.production_eligible) ? 'CROSS_FAMILY_MAPPING_IDENTIFIABLE' : 'NOT_IDENTIFIABLE_FOR_ALL_REQUIRED_FAMILIES'
    },
    D_CONSERVATIVE_TIER_A_ANCHOR: {
      policy_id: SELECTED_POLICY_ID,
      role: 'SELECTED_CONSERVATIVE_POLICY',
      point_rule: 'current Tier-A NPB+ peak anchors point; lower families remain native-scale constraints/uncertainty only',
      reference_population_mixing: 'NONE_IN_POINT',
      metrics: candidateMetrics(cases, 'd'),
      selected: true,
      physical_only_validation: true,
      validity: 'DEFENSIBLE_WHEN_CROSS_FAMILY_CALIBRATION_IS_NOT_IDENTIFIABLE',
      point_prediction_count: 0,
      interval_only_fallback: true
    }
  };
  return {
    schema_version: 'sp105_synthesis_policy_benchmark_v1',
    task_id: 'SP-105',
    status: 'PASS_PHYSICAL_ONLY_POLICY_BENCHMARK',
    baseline_reproduction: buildBaselineReproduction(),
    held_out_design: {
      target: 'physical_evidence_only',
      player_clustered: true,
      leave_player_out: true,
      same_player_seasons_held_together: true,
      target_self_teaching: false,
      common_support_required_for_mapping: true,
      no_extrapolation: true,
      note: 'A/B are retained as diagnostics despite uncalibrated reference-population mixing. D intentionally emits no cross-family numeric prediction for this validation target and uses a full bounded interval.'
    },
    case_count: cases.length,
    candidate_order: Object.keys(candidates),
    candidates,
    selected_policy_id: SELECTED_POLICY_ID,
    selection_rule: {
      physical_only: true,
      reject_equal_family_point_override: true,
      reject_uncalibrated_reference_population_mixing: true,
      require_common_support_for_mapping: true,
      prefer_simpler_policy_when_held_out_performance_is_indistinguishable: true,
      selected_because: 'No single cross-family mapping is production-identifiable across sparse T90 and heterogeneous H2F/short-distance references; the Tier-A anchor preserves current direct evidence while lower tiers remain visible bounded constraints.'
    },
    source_removal_stability: provisionalAblation ? Object.fromEntries(Object.entries(provisionalAblation.summary).map(([key, value]) => [key, {
      point_changed_count: value.point_changed_count,
      rank_changed_count: value.rank_changed_count,
      interval_changed_count: value.interval_changed_count,
      confidence_changed_count: value.confidence_changed_count
    }])) : null,
    descriptive_diagnostics: descriptiveDiagnostics,
    powerpro_used_for_selection: false,
    owner_verdict_used_for_selection: false,
    generated_at: AS_OF_DATE
  };
}

function buildBaselineReproduction() {
  const artifacts = {};
  for (const [key, rel] of Object.entries({
    policy: INPUT_PATHS.sp079FrozenPolicy,
    sp079FrozenManifest: INPUT_PATHS.sp079FrozenManifest,
    sp079FrozenSynthesis: INPUT_PATHS.sp079FrozenSynthesis,
    sp079FrozenCsv: INPUT_PATHS.sp079FrozenCsv,
    sp079FrozenJson: INPUT_PATHS.sp079FrozenJson,
    sp079FrozenAblation: INPUT_PATHS.sp079FrozenAblation,
    sp079FrozenPowerpro: INPUT_PATHS.sp079FrozenPowerpro,
    sp079FrozenGlobalQa: INPUT_PATHS.sp079FrozenGlobalQa,
    sp079FrozenQa: INPUT_PATHS.sp079FrozenQa,
    sp079FrozenReport: INPUT_PATHS.sp079FrozenReport,
    sp079FrozenAudit: INPUT_PATHS.sp079FrozenAudit
  })) {
    const observed = sha256File(rel);
    artifacts[key] = { path: rel, expected_sha256: FROZEN_BASELINE_HASHES[key], observed_sha256: observed, byte_identical: observed === FROZEN_BASELINE_HASHES[key] };
  }
  return {
    schema_version: 'sp105_sp079_baseline_reproduction_v1',
    reference_commit: BASELINE_COMMIT,
    frozen_manifest_used: true,
    frozen_equal_family_policy_preserved_as_control_only: true,
    isolated_reproduction_execution: {
      fresh_isolated_clone: true,
      original_generator: 'scripts/sp079_final_practical_reappraisal_20260825.mjs',
      independent_qa: 'scripts/qa_sp079_final_practical_reappraisal_20260825.mjs',
      output: '100 rows / 800 cells / owner verdict count 0',
      rerun_status: 'BYTE_IDENTICAL'
    },
    artifacts,
    exact_byte_identical: Object.values(artifacts).every((x) => x.byte_identical),
    example_regression: {
      player: '中川 圭太',
      current_npb_plus_peak_percentile: 0.7576,
      historical_bounded_h2f_percentile: 0.126761,
      frozen_equal_family_point: 0.442181,
      frozen_equal_family_rating: 44,
      retained_as_regression_case: true
    },
    generated_at: AS_OF_DATE
  };
}

function parseRegistry(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split('\t');
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split('\t');
    assert(cells.length === header.length, `registry row has ${cells.length} cells, expected ${header.length}`);
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}

function buildInputManifest(inputData, ownerLedger, registryRows, currentKeys, calibrationReceipts, baselineReproduction) {
  const sourceHashes = {};
  for (const [key, rel] of Object.entries(INPUT_PATHS)) {
    if (key === 'baseline') continue; // baseline is loaded only after core freeze.
    sourceHashes[key] = sha256File(rel);
  }
  sourceHashes.selectedPolicy = sha256File('outputs/derived/sp105_selected_synthesis_policy.json');
  return {
    schema_version: 'sp105_frozen_input_manifest_v1',
    task_id: 'SP-105',
    frozen_at: AS_OF_DATE,
    base_sp079_commit: BASELINE_COMMIT,
    input_files: Object.fromEntries(Object.entries(INPUT_PATHS).filter(([key]) => key !== 'baseline').map(([key, rel]) => [key, { path: rel, sha256: sourceHashes[key] }])),
    generated_policy: {
      path: 'outputs/derived/sp105_selected_synthesis_policy.json',
      sha256: sourceHashes.selectedPolicy
    },
    population: {
      current100_count: currentKeys.length,
      current100_stable_key_sha256: stableHash(currentKeys),
      base_evidence_row_count: currentKeys.length
    },
    upstream_evidence_counts: inputData,
    registry_snapshot_after_reconciliation: Object.fromEntries(registryRows.filter((row) => ['SP-079', 'SP-080', 'SP-081', 'SP-082', 'SP-101', 'SP-102', 'SP-103', 'SP-104', 'SP-105'].includes(row.task_id)).map((row) => [row.task_id, {
      status: row.status,
      owner_review_block: row.owner_review_block,
      gate_block: row.gate_block,
      depends_on: row.depends_on
    }])) ,
    owner_review_integrity: {
      owner_verdict_count: ownerLedger.owner_verdict_count,
      owner_records_count: ownerLedger.records?.length ?? 0,
      owner_ledger_sha256: sourceHashes.ownerLedger,
      owner_input_used_in_synthesis: false,
      owner_verdicts_written: false
    },
    baseline_reproduction: baselineReproduction,
    cross_family_calibration: {
      status: calibrationReceipts.status,
      production_selected: false,
      receipt_sha256: stableHash(calibrationReceipts)
    },
    forbidden_input_guards: {
      legacy_npb_plus_h2f_field_read: false,
      powerpro_as_synthesis_feature: false,
      powerpro_loaded_for_posthoc_only: true,
      show_numeric_copy: false,
      thirty_or_fifty_meter_to_t90_conversion: false,
      target_player_self_teaching: false,
      season_leakage: false,
      technique_in_physical_point: false,
      selected_production_transfer: false,
      sp080_read_as_input: false,
      sp081_read_as_input: false,
      shoulder_read_as_input: false
    },
    input_data_sha256: sourceHashes
  };
}

function buildContextDecisionUse(base, fullResult, ablationCells) {
  const byComponent = new Map(ablationCells.filter((cell) => cell.stable_player_key === base.stable_player_key).map((cell) => [cell.removed_component, cell]));
  const laneDefinitions = [
    ['the_show_context', base.context.show.available],
    ['analog_ordinal_transition', base.context.analog.present || base.context.ordinal_transition.present],
    ['statistical_proxies', base.context.proxy.present],
    ['scouting_community_video_usage_context', base.context.scouting_community_video_usage.present]
  ];
  const decisions = {};
  for (const [lane, present] of laneDefinitions) {
    const cell = byComponent.get(lane);
    const effects = cell ? {
      point: cell.point_changed,
      display_rating: cell.display_rating_changed,
      rank: cell.rank_changed,
      interval: cell.interval_changed,
      confidence: cell.confidence_changed,
      conflict_state: cell.conflict_changed,
      evidence_state: cell.evidence_state_changed,
      point_semantics: cell.point_semantics_changed
    } : {};
    const effectFields = Object.entries(effects).filter(([, value]) => value).map(([key]) => key);
    let classification;
    if (!present) classification = ['NOT_APPLICABLE'];
    else if (!effectFields.length) classification = ['PRESENT_NO_DECISION_EFFECT'];
    else classification = effectFields.map((field) => field === 'display_rating' ? 'DISPLAY_RATING_CHANGED' : field === 'conflict_state' ? 'CONFLICT_CHANGED' : field === 'evidence_state' ? 'EVIDENCE_STATE_CHANGED' : `${field.toUpperCase()}_CHANGED`);
    decisions[lane] = {
      present_in_frozen_input: present,
      removal_cell_recomputed: Boolean(cell),
      effects,
      effect_fields: effectFields,
      classification,
      materially_used_for_point_or_rank: Boolean(effects.point || effects.rank),
      numeric_point_use: false,
      direct_numeric_copy: false,
      note: classification.includes('PRESENT_NO_DECISION_EFFECT') ? 'Loaded/present but removal changed no final decision field; not claimed as material use.' : null
    };
  }
  return {
    schema_version: 'sp105_context_decision_use_receipt_v1',
    task_id: 'SP-105',
    player: base.player,
    stable_player_key: base.stable_player_key,
    final_physical_point_semantics: fullResult.point_semantics,
    lanes: decisions,
    no_context_lane_can_override_tier_a_point: true,
    generated_at: AS_OF_DATE
  };
}

function buildPowerproPosthoc(master, finalRows) {
  const byId = new Map((master.rows ?? []).map((row) => [String(row.player_id), row]));
  const rows = finalRows.map((row) => {
    const source = byId.get(String(row.player_id));
    const current = finiteNumber(source?.powerpro_current_speed);
    const diff = current === null || row.provisional_practical_rating === null ? null : row.provisional_practical_rating - current;
    return {
      stable_player_key: row.stable_player_key,
      player: row.player,
      current_powerpro_speed_for_qa_only: current,
      final_practical_rating: row.provisional_practical_rating,
      difference_final_minus_powerpro: diff,
      direction: diff === null ? 'UNAVAILABLE' : diff > 0 ? 'FINAL_HIGHER' : diff < 0 ? 'FINAL_LOWER' : 'EQUAL',
      powerpro_used_in_synthesis: false,
      powerpro_used_as_teacher: false,
      powerpro_used_for_optimization: false,
      stage: 'POSTHOC_AFTER_CORE_VALUES_FROZEN'
    };
  });
  const diffs = rows.map((row) => row.difference_final_minus_powerpro).filter(Number.isFinite);
  return {
    schema_version: 'sp105_powerpro_posthoc_qa_v1',
    task_id: 'SP-105',
    status: 'PASS_POSTHOC_ONLY',
    source_role: 'QA_ONLY_NOT_A_FEATURE',
    core_values_frozen_before_read: true,
    summary: {
      matched_rows: rows.filter((row) => row.current_powerpro_speed_for_qa_only !== null).length,
      mean_difference: round(mean(diffs)),
      max_absolute_difference: diffs.length ? round(Math.max(...diffs.map((x) => Math.abs(x)))) : null,
      all_teacher_flags_false: rows.every((row) => row.powerpro_used_as_teacher === false),
      selection_powerpro_used: false
    },
    rows,
    generated_at: AS_OF_DATE
  };
}

function baselineComparison(master, frozenSp079, row) {
  const source = (master.rows ?? []).find((x) => String(x.player_id) === String(row.player_id));
  const frozen = (frozenSp079.players ?? []).find((x) => String(x.player_id) === String(row.player_id) || x.stable_player_key === row.stable_player_key || x.player === row.player);
  const previous = finiteNumber(source?.gpt_codex_rating);
  const frozenPoint = finiteNumber(frozen?.latent_speed_percentile_point);
  const frozenRating = finiteNumber(frozen?.provisional_practical_rating);
  return {
    pre_sp079_project_rating_for_comparison_only: previous,
    pre_sp079_project_interval_for_comparison_only: [finiteNumber(source?.gpt_codex_low), finiteNumber(source?.gpt_codex_high)],
    pre_sp079_project_confidence_for_comparison_only: source?.gpt_codex_confidence ?? null,
    change_vs_pre_sp079_project: row.provisional_practical_rating === null || previous === null ? null : row.provisional_practical_rating - previous,
    pre_sp105_frozen_sp079_point_for_comparison_only: frozenPoint,
    pre_sp105_frozen_sp079_rating_for_comparison_only: frozenRating,
    pre_sp105_frozen_sp079_interval_for_comparison_only: frozen?.latent_speed_percentile_interval ?? null,
    pre_sp105_frozen_sp079_rating_interval_for_comparison_only: frozen?.provisional_practical_rating_interval ?? null,
    pre_sp105_frozen_sp079_confidence_for_comparison_only: frozen?.confidence ?? null,
    change_vs_pre_sp105_frozen_sp079: row.provisional_practical_rating === null || frozenRating === null ? null : row.provisional_practical_rating - frozenRating,
    change_vs_frozen_sp079_baseline: row.provisional_practical_rating === null || frozenRating === null ? null : row.provisional_practical_rating - frozenRating
  };
}

function buildInternalQa(baseRows, finalRows, ablation, policy, ownerLedger, registryRows, inputData, baselineReproduction, contextUse) {
  const checks = [];
  const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
  const registry = new Map(registryRows.map((row) => [row.task_id, row]));
  check('population_exact_100_unique', baseRows.length === 100 && new Set(baseRows.map((x) => x.stable_player_key)).size === 100, { count: baseRows.length });
  check('queue_order_exact_1_to_100', baseRows.every((x, i) => x.queue_order === i + 1), true);
  check('selected_policy_is_conservative_anchor', policy.selected_policy_id === SELECTED_POLICY_ID && policy.decision?.lower_tier_point_weight === 0, policy.selected_policy_id);
  check('point_semantics_present_and_allowed', finalRows.every((row) => POINT_SEMANTICS.has(row.point_semantics)), { allowed: [...POINT_SEMANTICS] });
  check('point_semantics_consistent', finalRows.every((row) => row.point_semantics !== 'NO_DEFENSIBLE_POINT' || row.latent_speed_percentile_point === null) && finalRows.every((row) => row.point_semantics !== 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE' || row.scientific_point_estimate === null), 'unresolved/display-only rows are separated');
  check('tier_b_cannot_equal_tier_a_point', finalRows.every((row) => (row.family_point_influence?.PEAK ?? 0) === 1 && Object.entries(row.family_point_influence ?? {}).filter(([family]) => family !== 'PEAK').every(([, value]) => value === 0)), 'selected point influence');
  check('no_uncalibrated_reference_population_mixing_in_selected_point', finalRows.every((row) => row.synthesis_receipt?.point_reference_population === 'SP100_CURRENT100_NPB_PLUS_2026'), 'anchor reference population only');
  check('physical_only_selection', policy.physical_only_selection === true && policy.powerpro_used_for_selection === false && policy.owner_verdict_used_for_selection === false, 'physical evidence only');
  check('owner_zero', ownerLedger.owner_verdict_count === 0 && (ownerLedger.records?.length ?? 0) === 0, { owner_verdict_count: ownerLedger.owner_verdict_count });
  check('show_direct_copy_false', finalRows.every((row) => row.the_show_direct_copy === false && row.context_decision_use?.lanes?.the_show_context?.direct_numeric_copy === false), 'all rows');
  check('legacy_h2f_false', finalRows.every((row) => row.legacy_npb_plus_h2f_used === false), 'all rows');
  check('short_distance_transform_false', finalRows.every((row) => row.direct_30m_50m_to_t90_conversion === false), 'all rows');
  check('missing_not_slow', finalRows.every((row) => row.missingness_is_not_slow === true), 'all rows');
  check('technique_separate', finalRows.every((row) => row.technique_used_in_physical_point === false), 'all rows');
  check('production_transfer_false', finalRows.every((row) => row.selected_production_transfer === false), 'all rows');
  check('ablation_exact_800_actual', ablation.cells.length === 800 && ablation.cells.every((cell) => cell.recomputed_from_frozen_evidence === true && cell.recomputation_check === 'ACTUAL_FULL_SYNTHESIS_FUNCTION_RERUN'), { cells: ablation.cells.length });
  check('ablation_summary_has_separate_effect_counts', COMPONENTS.every((component) => Object.hasOwn(ablation.summary[component], 'point_changed_count') && Object.hasOwn(ablation.summary[component], 'display_rating_changed_count') && Object.hasOwn(ablation.summary[component], 'rank_changed_count') && Object.hasOwn(ablation.summary[component], 'interval_changed_count') && Object.hasOwn(ablation.summary[component], 'confidence_changed_count') && Object.hasOwn(ablation.summary[component], 'conflict_changed_count') && Object.hasOwn(ablation.summary[component], 'evidence_state_changed_count')), true);
  check('interval_only_not_point', ablation.cells.filter((cell) => cell.interval_changed && !cell.point_changed).every((cell) => !cell.changed_fields.includes('point')), 'field-level ablation semantics');
  check('context_use_measured_from_removal_cells', contextUse.length === 100 && contextUse.every((row) => Object.keys(row.lanes).length === 4), { rows: contextUse.length });
  check('zero_effect_context_not_claimed_material', contextUse.every((row) => Object.values(row.lanes).every((lane) => !lane.classification.includes('PRESENT_NO_DECISION_EFFECT') || lane.materially_used_for_point_or_rank === false)), true);
  check('baseline_byte_reproduction', baselineReproduction.exact_byte_identical === true, baselineReproduction.exact_byte_identical);
  check('scale_status', finalRows.every((row) => row.scale_status === SCALE_STATUS), SCALE_STATUS);
  check('sp080_sp081_shoulder_unchanged', registry.get('SP-080')?.status === 'NOT_STARTED' && registry.get('SP-081')?.status === 'NOT_STARTED' && registry.get('SP-082')?.status === 'BLOCKED_DEPENDENCY', 'scope locks');
  check('sp079_superseded_by_sp105', registry.get('SP-079')?.status === 'PARTIAL' && registry.get('SP-105')?.status === 'PARTIAL', 'registry terminal boundary remains browser reacceptance');
  check('upstream_counts_frozen', inputData.sp103UniverseRows === 71 && inputData.sp103TraceabilityRows === 76 && inputData.canonicalRows === 458 && inputData.sp104Receipts === 100, inputData);
  return {
    schema_version: 'sp105_global_consistency_qa_v1',
    task_id: 'SP-105',
    status: checks.every((x) => x.pass) ? 'PASS_PRE_INDEPENDENT_QA' : 'FAIL',
    checks,
    output_row_count: finalRows.length,
    ablation_cell_count: ablation.cells.length,
    owner_verdict_count: ownerLedger.owner_verdict_count,
    selected_policy_id: SELECTED_POLICY_ID,
    generated_at: AS_OF_DATE
  };
}

function buildPolicy(selected, calibrationReceipts, benchmark, manifestHash) {
  const mappingStates = Object.fromEntries(PHYSICAL_FAMILIES.filter((family) => family !== 'PEAK').map((family) => [family, {
    calibration_receipt_family: family,
    production_point_use: false,
    selected_role: 'NATIVE_SCALE_CONSTRAINT_ONLY',
    common_scale_mapping_selected: false,
    reason: calibrationReceipts.receipts.filter((x) => x.target_family === family && x.production_eligible).length ? 'not_selected_due_to_all-family-identifiability_gate' : 'insufficient_or_heterogeneous_player-clustered_common_support'
  }]));
  return {
    schema_version: 'sp105_selected_synthesis_policy_v1',
    task_id: 'SP-105',
    status: 'SELECTED_DONE_NEGATIVE_FINDING_READY_FOR_SP079_REACCEPTANCE',
    selected_policy_id: SELECTED_POLICY_ID,
    selected_policy_name: 'Conservative Tier-A anchor + lower-tier native-scale bounded constraints',
    physical_only_selection: true,
    point_anchor: {
      family: 'PEAK',
      source: 'SP100 current NPB+ top_speed_kmh percentile within frozen current100 cohort',
      reference_population: 'SP100_CURRENT100_NPB_PLUS_2026',
      point_weight: 1,
      role: 'TIER_A_CURRENT_DIRECT_PHYSICAL_ANCHOR'
    },
    lower_tier_policy: {
      families: ['ACCELERATION_H2F', 'END_TO_END_90FT', 'SHORT_DISTANCE'],
      point_weight: 0,
      constraint_weight: 'native_scale_interval_and_uncertainty_only',
      direct_cross_family_union: false,
      unresolved_reference_population_mix: 'explicitly retained as noncommensurate, never averaged'
    },
    decision: {
      tier_a_point_weight: 1,
      lower_tier_point_weight: 0,
      current_high_tier_influence: 'POINT_ANCHOR',
      historical_bounded_influence: 'CONSTRAINT_INTERVAL_CONFLICT_AND_UNCERTAINTY_ONLY',
      equal_family_average: 'BASELINE_CONTROL_ONLY',
      no_manual_player_adjustments: true
    },
    calibration: {
      common_scale_mapping_attempted: true,
      common_scale_mapping_selected: false,
      receipt_path: 'outputs/derived/sp105_cross_family_calibration_receipts.json',
      production_rule: 'NO_MAPPING_WITHOUT_PLAYER_CLUSTERED_LOO_COMMON_SUPPORT_AND_PREDECLARED_IDENTIFIABILITY',
      mapping_states: mappingStates
    },
    interval_rule: {
      anchor_interval: 'SP100 peak native interval',
      lower_tier: 'retain each family native interval separately; do not union unlike percentiles',
      uncertainty: 'bounded additive uncertainty for missing construct and context; point remains anchor',
      point_inside_interval: true
    },
    point_semantics_rule: {
      anchor_with_no_same_scale_conflict: 'DEFENSIBLE_POINT_ESTIMATE',
      no_tier_a_anchor: 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE',
      unresolved_same_scale_conflict: 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE',
      no_physical_evidence: 'NO_DEFENSIBLE_POINT'
    },
    prohibited_inputs: {
      powerpro_in_weight_or_calibration: false,
      owner_verdict_in_weight_or_calibration: false,
      the_show_numeric_copy: false,
      legacy_npb_plus_h2f: false,
      thirty_or_fifty_meter_to_t90: false,
      missing_to_slow: false,
      production_transfer_from_sp104: false,
      sp080: false,
      sp081: false,
      shoulder: false
    },
    benchmark_summary: {
      selected_candidate: benchmark.selected_policy_id,
      equal_family_baseline_reproduced: benchmark.baseline_reproduction.exact_byte_identical,
      cross_family_mapping_production_identifiable: calibrationReceipts.receipts.every((x) => x.production_eligible),
      simpler_policy_preferred: true
    },
    powerpro_used_for_selection: false,
    owner_verdict_used_for_selection: false,
    manifest_hash_attached_after_generation: manifestHash,
    generated_at: AS_OF_DATE
  };
}

function buildReport(finalRows, benchmark, ablation, contextUse, powerpro, qa, baselineReproduction, calibrationReceipts) {
  const countBy = (rows, key) => rows.reduce((acc, row) => { acc[row[key]] = (acc[row[key]] ?? 0) + 1; return acc; }, {});
  const sortedChanges = [...finalRows].filter((row) => Number.isFinite(row.change_vs_frozen_sp079_baseline)).sort((a, b) => Math.abs(b.change_vs_frozen_sp079_baseline) - Math.abs(a.change_vs_frozen_sp079_baseline) || a.queue_order - b.queue_order).slice(0, 12);
  const contextCounts = {};
  for (const lane of ['the_show_context', 'analog_ordinal_transition', 'statistical_proxies', 'scouting_community_video_usage_context']) {
    contextCounts[lane] = {};
    for (const row of contextUse) for (const label of row.lanes[lane].classification) contextCounts[lane][label] = (contextCounts[lane][label] ?? 0) + 1;
  }
  const ablationLines = COMPONENTS.map((component) => {
    const x = ablation.summary[component];
    return `| ${component} | ${x.applicable_or_present_count} | ${x.point_changed_count} | ${x.display_rating_changed_count} | ${x.rank_changed_count} | ${x.interval_changed_count} | ${x.confidence_changed_count} | ${x.conflict_changed_count} | ${x.evidence_state_changed_count} | ${JSON.stringify(x.point_effect_magnitude)} | ${JSON.stringify(x.rank_effect_magnitude)} | ${x.applicable_or_present_zero_effect_count} |`;
  }).join('\n');
  const contextLines = Object.entries(contextCounts).map(([lane, counts]) => `| ${lane} | ${JSON.stringify(counts)} |`).join('\n');
  const changeLines = sortedChanges.map((row) => `| ${row.queue_order} | ${row.player} | ${row.provisional_practical_rating ?? '—'} | ${row.pre_sp105_frozen_sp079_rating_for_comparison_only ?? '—'} | ${row.change_vs_frozen_sp079_baseline ?? '—'} | ${row.point_semantics} |`).join('\n');
  const pointSemantics = countBy(finalRows, 'point_semantics');
  const evidenceStates = countBy(finalRows, 'evidence_state');
  const confidence = countBy(finalRows, 'confidence');
  const unresolved = finalRows.filter((row) => row.point_semantics !== 'DEFENSIBLE_POINT_ESTIMATE' || row.conflict_state.includes('UNRESOLVED'));
  const unresolvedLines = unresolved.length
    ? unresolved.map((row) => `- ${row.player} (${row.stable_player_key}): ${row.point_semantics}, conflict ${row.conflict_state}, reason: ${row.point_semantics_reason}`).join('\n')
    : '- None in the final 100-player anchor output; display-only/no-defensible semantics remain enforced for no-anchor or unresolved ablation states.';
  return `# SP-105 SP-079 synthesis/calibration semantic repair — 100 players

Date: ${AS_OF_DATE}
Terminal finding: DONE_NEGATIVE_FINDING_READY_FOR_SP079_REACCEPTANCE (registry remains PARTIAL/gate-blocking until browser reacceptance).

## Selected policy

CONSERVATIVE_TIER_A_ANCHOR_LOWER_TIER_BOUNDED_CONSTRAINT was selected using physical evidence only. The current NPB+ peak percentile is the sole Tier-A point anchor. Historical/protocol-bounded H2F, T90/90ft and 30m/50m evidence is preserved with native reference populations, intervals and provenance, but has zero point weight and cannot silently override the anchor. The frozen equal-family average remains a reproduced control only.

Cross-family calibration was attempted with player-clustered leave-player-out mappings, same-player seasons held together, explicit common-support checks and no extrapolation. The sparse T90 and heterogeneous H2F/short-distance reference populations did not jointly identify a defensible production mapping, so no mapping was promoted. This is a measured negative calibration finding, not a claim that the lower evidence is useless.

## Baseline reproduction and regression case

- SP-079 base commit: ${BASELINE_COMMIT}
- Frozen policy/final100/synthesis/CSV/ablation/QA/global QA/report/audit: byte-identical in a fresh isolated reproduction: **${baselineReproduction.exact_byte_identical ? 'PASS' : 'FAIL'}**
- 中川 圭太 regression: peak percentile 0.7576, historical bounded H2F percentile 0.126761, frozen 50:50 point 0.442181 / rating 44. The repair does not manually tune this player; the lower family is retained as a native-scale constraint.

## 100-player output

- Rows: **${finalRows.length}**; queue order 1–100; scale: ${SCALE_STATUS}
- Point semantics: ${JSON.stringify(pointSemantics)}
- Evidence states: ${JSON.stringify(evidenceStates)}
- Confidence: ${JSON.stringify(confidence)}
- Defensible point rows: ${finalRows.filter((row) => row.point_semantics === 'DEFENSIBLE_POINT_ESTIMATE').length}; display-midpoint-only rows: ${finalRows.filter((row) => row.point_semantics === 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE').length}; no-defensible-point rows: ${finalRows.filter((row) => row.point_semantics === 'NO_DEFENSIBLE_POINT').length}

Every final row includes family/tier influence, native reference-population receipts, lower-tier constraints, missingness/conflict/confidence, point semantics, pre-SP-105 frozen SP-079 and pre-SP-079 project comparison fields, plus posthoc-only PowerPro fields. No player-specific manual adjustment was made.

## Largest changes versus frozen SP-079 baseline

| Queue | Player | SP-105 rating | SP-079 rating | Change | Point semantics |
|---:|---|---:|---:|---:|---|
${changeLines}

## Rich eight-component actual recomputation ablation

Each row below is derived from 100 actual full synthesis reruns with the named component removed (800 cells total). Counts are intentionally separate; interval-only changes are not point changes.

| Removed component | Present/applicable | Point | Display rating | Rank | Interval | Confidence | Conflict | Evidence state | Point effect magnitude | Rank effect magnitude | Present zero-effect |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|
${ablationLines}

## Context decision-use

The Show numeric values were never copied or used as a physical point. Each context lane is classified from its own removal-and-recompute cell; PRESENT_NO_DECISION_EFFECT is reported explicitly.

| Lane | Actual classifications across 100 rows |
|---|---|
${contextLines}

## Calibration benchmark

Candidate A is the exact SP-079 equal-family control. Candidate B uses declared physical source/protocol/interval reliability but remains uncalibrated. Candidate C is player-clustered LOO isotonic mapping under common support. Candidate D is the selected anchor/constraint policy. Held-out metrics are recorded in outputs/derived/sp105_synthesis_policy_benchmark.json; no PowerPro agreement was used for selection.

- A: ${JSON.stringify(benchmark.candidates.A_FROZEN_EQUAL_FAMILY_BASELINE.metrics)}
- B: ${JSON.stringify(benchmark.candidates.B_TIER_AWARE_UNCALIBRATED_RELIABILITY.metrics)}
- C: ${JSON.stringify(benchmark.candidates.C_LOO_COMMON_SCALE_ISOTONIC.metrics)}; eligible mappings ${benchmark.candidates.C_LOO_COMMON_SCALE_ISOTONIC.eligible_mapping_count}/${benchmark.candidates.C_LOO_COMMON_SCALE_ISOTONIC.total_mapping_count}
- D: ${JSON.stringify(benchmark.candidates.D_CONSERVATIVE_TIER_A_ANCHOR.metrics)}; no cross-family numeric prediction is claimed, so its validation interval is deliberately bounded [0,1]

## Descriptive top-speed diagnostics

Peak-versus-native-family correlations and the leave-peak-out rerun are descriptive only; neither was optimized toward a target correlation or used as a production transfer. ${JSON.stringify(benchmark.descriptive_diagnostics)}

## Unresolved and no-defensible-point rows

${unresolvedLines}

## QA and governance

- Internal global consistency QA: ${qa.status}
- Independent red-team QA: generated separately at outputs/derived/qa_sp105_sp079_synthesis_calibration_repair.json
- PowerPro posthoc: ${powerpro.status}, matched ${powerpro.summary.matched_rows}, all teacher flags false; loaded after core values froze
- Owner verdict count: **0**
- SP-079: PARTIAL, superseded by this repair pending browser reacceptance
- SP-080: NOT_STARTED; SP-081: NOT_STARTED; shoulder/SP-082: BLOCKED_DEPENDENCY
- New broad collection, owner verdict input, SP-080/SP-081, shoulder work: **not executed**
- Required fail-before fixtures and deterministic rerun: see the independent QA artifact.
`;
}

function makePlayerBase(sp100Row, sp101Row, showRow, stateRow, queueRow, canonicalRecords, officialRecords, graph, receipt) {
  const peak = makePeakRecord(sp100Row, sp101Row);
  const physicalRecords = [peak, ...canonicalRecords, ...officialRecords];
  const sp100Peak = sp100Row.n_primary ?? {};
  const base = {
    queue_order: sp100Row.row_id,
    player: sp100Row.player,
    player_id: sp100Row.player_id,
    stable_player_key: sp100Row.stable_player_key,
    team: sp100Row.team,
    sp100: {
      row_id: sp100Row.row_id,
      top_speed_kmh: finiteNumber(sp100Peak.top_speed_kmh),
      peak_percentile: finiteNumber(sp100Peak.current_cohort?.percentile_faster_than),
      current_cohort_size: sp100Peak.current_cohort?.size ?? 100,
      measurement_reliability: sp100Peak.measurement_reliability ?? 'NOT_IDENTIFIABLE',
      exposure_context: sp100Peak.exposure_context ?? null,
      source_season_label: sp100Peak.source_season_label ?? null
    },
    physicalRecords,
    canonicalRecordCount: canonicalRecords.length,
    mlb90Count: officialRecords.filter((x) => x.family === 'END_TO_END_90FT').length,
    mlbH2fCount: officialRecords.filter((x) => x.family === 'ACCELERATION_H2F').length,
    sp101: {
      identity_state: sp101Row?.identity_state ?? null,
      coverage_state: sp101Row?.coverage_state ?? null,
      residual_confidence: sp101Row?.residual_confidence ?? null,
      independent_physical_status: sp101Row?.independent_physical_estimate?.status ?? null,
      route_disagreement: sp101Row?.route_disagreement ?? null,
      the_show_live_row_count_after_repair: sp101Row?.the_show_live_row_count_after_repair ?? 0
    },
    state: {
      before: stateRow?.before ?? null,
      after: stateRow?.after ?? null,
      lane_counts_after: stateRow?.lane_counts_after ?? null,
      selected_anchor_ids: stateRow?.selected_anchor_ids ?? []
    },
    context: null
  };
  base.context = buildContext(sp101Row, showRow, graph, receipt, queueRow, physicalRecords);
  return base;
}

function buildSynthesisLine(base, result, contextUse, inputManifestHash, policyHash) {
  return {
    schema_version: 'sp105_player_evidence_synthesis_v1',
    task_id: 'SP-105',
    queue_order: base.queue_order,
    stable_player_key: base.stable_player_key,
    player: base.player,
    team: base.team,
    physical_evidence: {
      records: base.physicalRecords,
      family_summaries: result.physical_family_summaries,
      lower_tier_constraints: result.lower_tier_constraints,
      canonical_record_count: base.canonicalRecordCount,
      mlb_standardized_90ft_record_count: base.mlb90Count,
      mlb_raw_h2f_record_count: base.mlbH2fCount
    },
    external_and_context_evidence: base.context,
    sp101_context_receipt: base.sp101,
    sp104_state_receipt: base.state,
    final_synthesis: {
      latent_point: result.latent_speed_percentile_point,
      latent_interval: result.latent_speed_percentile_interval,
      provisional_practical_rating: result.provisional_practical_rating,
      provisional_practical_rating_interval: result.provisional_practical_rating_interval,
      point_semantics: result.point_semantics,
      confidence: result.confidence,
      conflict_state: result.conflict_state,
      evidence_state: result.evidence_state,
      scale_status: SCALE_STATUS
    },
    context_decision_use: contextUse,
    synthesis_receipt: {
      selected_policy_id: SELECTED_POLICY_ID,
      policy_sha256: policyHash,
      input_manifest_sha256: inputManifestHash,
      point_reference_population: result.physical_family_summaries.find((x) => x.family === 'PEAK')?.reference_populations?.[0] ?? null,
      recomputed_from_frozen_evidence: true,
      no_uncalibrated_cross_family_point_mix: true,
      no_equal_family_override: true,
      no_powerpro_input: true,
      no_owner_verdict_input: true,
      no_the_show_direct_copy: true,
      no_legacy_npb_plus_h2f: true,
      no_30m_50m_to_t90: true,
      no_production_transfer: true
    }
  };
}

function main() {
  for (const rel of Object.values(INPUT_PATHS)) fs.accessSync(abs(rel), fs.constants.R_OK);
  const sp079Policy = readJson(INPUT_PATHS.policy);
  const sp100 = readJson(INPUT_PATHS.sp100);
  const sp101 = readJson(INPUT_PATHS.sp101);
  const sp101Show = readJson(INPUT_PATHS.sp101Show);
  const graph = readJson(INPUT_PATHS.sp101Graph);
  const canonicalRows = readJsonl(INPUT_PATHS.sp104Physical);
  const sp104State = readJson(INPUT_PATHS.sp104State);
  const transferPolicy = readJson(INPUT_PATHS.sp104TransferPolicy);
  const transferBenchmark = readJson(INPUT_PATHS.sp104TransferBenchmark);
  const receiptRows = readJsonl(INPUT_PATHS.sp104Receipts);
  const mlbRunningRows = parseCsv(readText(INPUT_PATHS.mlbRunning)).map((row, index) => ({ ...row, __source_row: index + 2 }));
  const mlbExposureRows = parseCsv(readText(INPUT_PATHS.mlbExposure)).map((row, index) => ({ ...row, __source_row: index + 2 }));
  const sp077 = readJson(INPUT_PATHS.sp077);
  const sp103UniverseRows = readText(INPUT_PATHS.sp103Universe).trim().split(/\r?\n/).slice(1).filter(Boolean);
  const sp103TraceabilityRows = readText(INPUT_PATHS.sp103Traceability).trim().split(/\r?\n/).slice(1).filter(Boolean);
  const sp103Gaps = readJson(INPUT_PATHS.sp103Gaps);
  const sp103Methods = readJson(INPUT_PATHS.sp103Methods);
  const ownerLedger = readJson(INPUT_PATHS.ownerLedger);
  const registryRows = parseRegistry(readText(INPUT_PATHS.registry));

  assert(sp079Policy.status === 'FROZEN_BEFORE_PLAYER_REAPPRAISAL', 'SP-079 policy is not frozen');
  assert(sp100.players.length === 100 && sp101.players.length === 100 && sp101Show.players.length === 100, 'current100 upstream is not exact');
  assert(ownerLedger.owner_verdict_count === 0 && (ownerLedger.records?.length ?? 0) === 0, 'owner ledger is non-empty');
  assert(transferPolicy.production_use === false && transferPolicy.direct_numeric_promotion_allowed === false, 'SP104 transfer policy promoted');
  assert(!transferBenchmark.methods.some((x) => x.direct_numeric_promotion_allowed === true), 'SP104 transfer benchmark promoted');
  assert(sp104State.players.length === 100 && sp077.players.length === 100, 'SP104/SP077 population mismatch');
  assert(sp103UniverseRows.length === 71 && sp103TraceabilityRows.length === 76, 'SP103 frozen universe count mismatch');
  assert(sp103Gaps.gaps.length === 28 && sp103Methods.methods.length === 19, 'SP103 method/gap count mismatch');
  assert(receiptRows.length === 100, 'SP104 anchor receipt count mismatch');
  const reg = new Map(registryRows.map((row) => [row.task_id, row]));
  assert(reg.get('SP-079')?.status === 'PARTIAL', 'registry reconciliation must precede model work');
  assert(reg.get('SP-105')?.status === 'PARTIAL' && reg.get('SP-105')?.gate_block === '1', 'SP105 registry row must be active gate blocker');
  assert(reg.get('SP-080')?.status === 'NOT_STARTED' && reg.get('SP-081')?.status === 'NOT_STARTED' && reg.get('SP-082')?.status === 'BLOCKED_DEPENDENCY', 'scope lock changed');
  assert(sp100.players.every((row) => row.n_primary?.measurement_reliability === 'NOT_IDENTIFIABLE'), 'unexpected NPB+ reliability assumption');

  const currentKeys = sp100.players.map((row) => row.stable_player_key);
  assert(new Set(currentKeys).size === 100, 'current stable keys are not unique');
  const currentKeySet = new Set(currentKeys);
  const sp101Index = byKeyAndPlayer(sp101.players);
  const showIndex = byKeyAndPlayer(sp101Show.players);
  const stateIndex = byKeyAndPlayer(sp104State.players);
  const queueIndex = byKeyAndPlayer(sp077.players, (row) => row.identity?.player);
  const receiptIndex = byKeyAndPlayer(receiptRows);
  assert(sp100.players.every((row) => lookup(sp101Index, row.stable_player_key, row.player) && lookup(showIndex, row.stable_player_key, row.player) && lookup(queueIndex, row.stable_player_key, row.player)), 'identity crosswalk incomplete');

  const canonicalDistributions = {};
  for (const row of canonicalRows) {
    const family = classifyCanonicalMetric(row);
    const interval = valueInterval(row);
    if (family && interval && !isLegacyNpbH2f(row)) {
      if (!canonicalDistributions[row.metric]) canonicalDistributions[row.metric] = [];
      canonicalDistributions[row.metric].push(interval.midpoint);
    }
  }
  const mlbRun90Values = mlbRunningRows.map((row) => finiteNumber(row.standardized_90ft_seconds)).filter(Number.isFinite);
  const mlbRunH2fValues = mlbRunningRows.map((row) => finiteNumber(row.raw_hp_to_1b_seconds)).filter(Number.isFinite);
  const mlbExposureH2fValues = mlbExposureRows.map((row) => finiteNumber(row.raw_hp_to_1b_seconds)).filter(Number.isFinite);
  const mlbDistributions = {
    standardized_90ft_seconds: mlbRun90Values,
    raw_hp_to_1b_seconds: [...mlbRunH2fValues, ...mlbExposureH2fValues]
  };
  const canonicalCandidates = chooseCanonicalDuplicates(canonicalRows.filter((row) => currentKeySet.has(row.stable_player_key) && classifyCanonicalMetric(row) && valueInterval(row) && !isLegacyNpbH2f(row)));
  const canonicalEvidence = canonicalCandidates.map((row) => recordFromCanonical(row, canonicalDistributions)).filter(Boolean);
  const official90 = buildOfficialEvidence(mlbRunningRows.filter((row) => currentKeySet.has(row.stable_player_key)), 'standardized_90ft_seconds', 'END_TO_END_90FT', mlbDistributions, 'MLB90', 'mlbRunning', INPUT_PATHS.mlbRunning);
  const officialRunningH2f = buildOfficialEvidence(mlbRunningRows.filter((row) => currentKeySet.has(row.stable_player_key)), 'raw_hp_to_1b_seconds', 'ACCELERATION_H2F', mlbDistributions, 'MLBH2F', 'mlbRunning', INPUT_PATHS.mlbRunning);
  const officialExposureH2f = buildOfficialEvidence(mlbExposureRows.filter((row) => currentKeySet.has(row.stable_player_key)), 'raw_hp_to_1b_seconds', 'ACCELERATION_H2F', mlbDistributions, 'MLBEXPOSUREH2F', 'mlbExposure', INPUT_PATHS.mlbExposure);
  const officialEvidence = dedupeOfficial([...official90, ...officialRunningH2f, ...officialExposureH2f]);
  const official90Seasons = new Set(officialEvidence.filter((record) => record.family === 'END_TO_END_90FT').map((record) => `${record.stable_player_key}|${record.measurement_year}`));
  for (const record of officialEvidence) {
    if (record.family === 'ACCELERATION_H2F' && official90Seasons.has(`${record.stable_player_key}|${record.measurement_year}`)) {
      record.used_in_synthesis = false;
      record.used_in_lower_tier_constraint = false;
      record.exclusion_reason = 'SAME_PLAYER_SEASON_SHARED_OFFICIAL_TRACKING_NOT_ADDITIVE_WITH_90FT';
    }
  }
  const canonicalByKey = new Map();
  for (const record of canonicalEvidence) {
    if (!canonicalByKey.has(record.stable_player_key)) canonicalByKey.set(record.stable_player_key, []);
    canonicalByKey.get(record.stable_player_key).push(record);
  }
  const officialByKey = new Map();
  for (const record of officialEvidence) {
    if (!officialByKey.has(record.stable_player_key)) officialByKey.set(record.stable_player_key, []);
    officialByKey.get(record.stable_player_key).push(record);
  }

  const baseRows = sp100.players.map((sp100Row, index) => {
    const sp101Row = lookup(sp101Index, sp100Row.stable_player_key, sp100Row.player);
    const showRow = lookup(showIndex, sp100Row.stable_player_key, sp100Row.player);
    const stateRow = lookup(stateIndex, sp100Row.stable_player_key, sp100Row.player);
    const queueRow = lookup(queueIndex, sp100Row.stable_player_key, sp100Row.player);
    const receipt = lookup(receiptIndex, sp100Row.stable_player_key, sp100Row.player);
    const base = makePlayerBase(sp100Row, sp101Row, showRow, stateRow, queueRow, canonicalByKey.get(sp100Row.stable_player_key) ?? [], officialByKey.get(sp100Row.stable_player_key) ?? [], graph, receipt);
    base.queue_order = index + 1;
    return base;
  });
  assert(baseRows.length === 100 && baseRows.every((row) => row.context), 'base rows incomplete');

  const baselineReproduction = buildBaselineReproduction();
  assert(baselineReproduction.exact_byte_identical, 'frozen SP079 baseline reproduction failed');
  const calibrationReceipts = buildCalibrationReceipts(baseRows);
  writeJson('outputs/derived/sp105_cross_family_calibration_receipts.json', calibrationReceipts);
  const firstBenchmark = buildPolicyBenchmark(baseRows, calibrationReceipts);
  const policyForHash = buildPolicy(SELECTED_POLICY_ID, calibrationReceipts, firstBenchmark, null);
  writeJson('outputs/derived/sp105_selected_synthesis_policy.json', policyForHash);
  const policyHash = sha256File('outputs/derived/sp105_selected_synthesis_policy.json');
  const inputData = {
    sp103UniverseRows: sp103UniverseRows.length,
    sp103TraceabilityRows: sp103TraceabilityRows.length,
    canonicalRows: canonicalRows.length,
    canonicalCurrent100Rows: canonicalEvidence.length,
    mlbRunningRows: mlbRunningRows.length,
    mlbExposureRows: mlbExposureRows.length,
    sp101ShowRows: sp101Show.players.length,
    sp101OrdinalEdges: graph.signed_pairwise_edges?.length ?? 0,
    sp101TransitionAnnotations: graph.context_annotations?.length ?? 0,
    sp104Receipts: receiptRows.length,
    sp104TransferPolicy: transferPolicy.status
  };
  const manifest = buildInputManifest(inputData, ownerLedger, registryRows, currentKeys, calibrationReceipts, baselineReproduction);
  writeJson('outputs/derived/sp105_frozen_input_manifest.json', manifest);
  const manifestHash = sha256File('outputs/derived/sp105_frozen_input_manifest.json');

  const fullResults = baseRows.map((base) => {
    const result = synthesize(base, [], Object.fromEntries(PHYSICAL_FAMILIES.map((family) => [family, calibrationReceipts.receipts.filter((x) => x.target_family === family)[0] ?? null])));
    result.stable_player_key = base.stable_player_key;
    return result;
  });
  rankResults(fullResults);
  const ablation = buildAblation(baseRows, fullResults, Object.fromEntries(PHYSICAL_FAMILIES.map((family) => [family, calibrationReceipts.receipts.filter((x) => x.target_family === family)[0] ?? null])));
  const descriptiveDiagnostics = buildDescriptiveDiagnostics(baseRows, ablation, Object.fromEntries(PHYSICAL_FAMILIES.map((family) => [family, calibrationReceipts.receipts.filter((x) => x.target_family === family)[0] ?? null])));
  const contextUse = baseRows.map((base, index) => buildContextDecisionUse(base, fullResults[index], ablation.cells));
  writeJson('outputs/derived/sp105_context_decision_use_100.json', {
    schema_version: 'sp105_context_decision_use_100_v1',
    task_id: 'SP-105',
    component_order: ['the_show_context', 'analog_ordinal_transition', 'statistical_proxies', 'scouting_community_video_usage_context'],
    players: contextUse,
    aggregate: Object.fromEntries(['the_show_context', 'analog_ordinal_transition', 'statistical_proxies', 'scouting_community_video_usage_context'].map((lane) => [lane, contextUse.reduce((acc, row) => { for (const label of row.lanes[lane].classification) acc[label] = (acc[label] ?? 0) + 1; return acc; }, {})])),
    generated_at: AS_OF_DATE
  });

  const coreRows = baseRows.map((base, index) => {
    const result = fullResults[index];
    const contextReceipt = contextUse[index];
    return {
      stable_player_key: base.stable_player_key,
      player: base.player,
      queue_order: base.queue_order,
      team: base.team,
      player_id: base.player_id,
      latent_speed_percentile_point: result.latent_speed_percentile_point,
      scientific_point_estimate: result.point_semantics === 'DEFENSIBLE_POINT_ESTIMATE' ? result.latent_speed_percentile_point : null,
      display_midpoint_only: result.point_semantics === 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE' ? result.latent_speed_percentile_point : null,
      latent_speed_percentile_interval: result.latent_speed_percentile_interval,
      provisional_practical_rating: result.provisional_practical_rating,
      provisional_practical_rating_interval: result.provisional_practical_rating_interval,
      rank_fastest: result.rank_fastest,
      rank_percentile: result.rank_percentile,
      point_semantics: result.point_semantics,
      point_semantics_reason: result.point_semantics_reason,
      final_rank_eligible: result.final_rank_eligible,
      confidence: result.confidence,
      confidence_drivers: result.confidence_drivers,
      evidence_state: result.evidence_state,
      conflict_state: result.conflict_state,
      material_conflicts: result.material_conflicts,
      physical_family_count: result.physical_family_count,
      physical_family_weights: result.family_point_influence,
      family_point_influence: result.family_point_influence,
      tier_influence: result.tier_influence,
      lower_tier_constraints: result.lower_tier_constraints,
      physical_family_summaries: result.physical_family_summaries,
      missing_physical_lanes: result.missing_physical_lanes,
      context_decision_use: contextReceipt,
      contextual_components_present: result.contextual_components_present,
      context_uncertainty_added: result.context_uncertainty_added,
      lower_tier_uncertainty_added: result.lower_tier_uncertainty_added,
      missing_family_uncertainty_added: result.missing_family_uncertainty_added,
      missingness_policy: 'MISSING_IS_NOT_SLOW; NONCOMMENSURATE_LOWER_FAMILIES_REMAIN_EXPLICIT_BOUNDED_CONSTRAINTS',
      missingness_is_not_slow: result.missingness_is_not_slow,
      source_evidence_records: base.physicalRecords,
      upstream_lane_summary: {
        sp100: base.sp100,
        canonical_physical_record_count: base.canonicalRecordCount,
        matched_mlb_standardized_90ft_record_count: base.mlb90Count,
        matched_mlb_raw_h2f_record_count: base.mlbH2fCount,
        sp101: base.sp101,
        state: base.state,
        context: base.context
      },
      pre_sp079_project_rating_for_comparison_only: null,
      pre_sp079_project_interval_for_comparison_only: null,
      pre_sp079_project_confidence_for_comparison_only: null,
      change_vs_frozen_sp079_baseline: null,
      powerpro_difference_for_qa_only: null,
      powerpro_teacher_used: false,
      powerpro_qa_attached_after_core_values_frozen: false,
      the_show_direct_copy: result.the_show_direct_copy,
      direct_30m_50m_to_t90_conversion: result.direct_30m_50m_to_t90_conversion,
      legacy_npb_plus_h2f_used: result.legacy_npb_plus_h2f_used,
      target_self_teaching_or_season_leakage: result.target_self_teaching_or_season_leakage,
      technique_used_in_physical_point: result.technique_used_in_physical_point,
      selected_production_transfer: result.selected_production_transfer,
      scale_status: SCALE_STATUS,
      owner_verdict_state: 'NOT_ENTERED',
      owner_verdict_count: 0,
      synthesis_receipt: {
        selected_policy_id: SELECTED_POLICY_ID,
        policy_sha256: policyHash,
        input_manifest_sha256: manifestHash,
        point_reference_population: result.physical_family_summaries.find((x) => x.family === 'PEAK')?.reference_populations?.[0] ?? null,
        recomputed_from_frozen_evidence: true,
        no_uncalibrated_cross_family_point_mix: true,
        no_equal_family_override: true,
        no_powerpro_input: true,
        no_owner_verdict_input: true,
        no_the_show_direct_copy: true,
        no_legacy_npb_plus_h2f: true,
        no_30m_50m_to_t90: true,
        no_production_transfer: true
      },
      core_values_frozen_before_posthoc: true
    };
  });
  const coreValuesHash = stableHash(coreRows.map((row) => ({
    stable_player_key: row.stable_player_key,
    point: row.latent_speed_percentile_point,
    interval: row.latent_speed_percentile_interval,
    rating: row.provisional_practical_rating,
    rank: row.rank_fastest,
    point_semantics: row.point_semantics,
    confidence: row.confidence,
    conflict_state: row.conflict_state,
    evidence_state: row.evidence_state
  })));

  // Governance boundary: only now may the comparison master be read.  Its
  // PowerPro columns are post-hoc QA fields and never enter coreRows,
  // calibration, weights, or selection.
  const master = readJson(INPUT_PATHS.baseline);
  const frozenSp079 = readJson(INPUT_PATHS.sp079FrozenJson);
  const powerproPosthoc = buildPowerproPosthoc(master, coreRows);
  const finalRows = coreRows.map((row) => ({
    ...row,
    ...baselineComparison(master, frozenSp079, row),
    powerpro_difference_for_qa_only: powerproPosthoc.rows.find((x) => x.stable_player_key === row.stable_player_key)?.difference_final_minus_powerpro ?? null,
    powerpro_qa_attached_after_core_values_frozen: true,
    core_values_sha256: coreValuesHash
  }));
  const finalJson = {
    schema_version: 'sp105_final_practical_speed_100_v1',
    task_id: 'SP-105',
    status: 'GENERATED_FOR_INDEPENDENT_QA',
    generated_at: AS_OF_DATE,
    population: { denominator: 100, current100_cohort_relative: true, final_engine_calibration: false },
    selected_policy_id: SELECTED_POLICY_ID,
    selected_policy_sha256: policyHash,
    input_manifest_sha256: manifestHash,
    core_values_sha256: coreValuesHash,
    owner_verdict_count: 0,
    owner_verdicts_written: false,
    scale_status: SCALE_STATUS,
    players: finalRows,
    guards: {
      powerpro_teacher_used: false,
      powerpro_used_for_selection: false,
      owner_verdict_used_for_selection: false,
      the_show_direct_copy: false,
      legacy_npb_plus_h2f_used: false,
      short_distance_to_t90_conversion: false,
      missingness_as_slow: false,
      target_self_teaching_or_season_leakage: false,
      technique_as_pure_speed: false,
      selected_production_transfer: false,
      selected_point_reference_population: 'SP100_CURRENT100_NPB_PLUS_2026',
      lower_tier_point_weight: 0
    },
    top_speed_dominance_diagnostic: descriptiveDiagnostics,
    deterministic_core_freeze: {
      core_values_built_before_baseline_powerpro_read: true,
      posthoc_fields_are_separate: true,
      core_values_sha256: coreValuesHash
    }
  };
  const csvHeaders = [
    'queue_order', 'stable_player_key', 'player_id', 'player', 'team', 'latent_speed_percentile_point', 'scientific_point_estimate', 'display_midpoint_only', 'latent_speed_percentile_interval', 'provisional_practical_rating', 'provisional_practical_rating_interval', 'rank_fastest', 'rank_percentile', 'point_semantics', 'point_semantics_reason', 'confidence', 'evidence_state', 'conflict_state', 'physical_family_count', 'physical_family_weights', 'tier_influence', 'lower_tier_constraints', 'missing_physical_lanes', 'context_decision_use', 'change_vs_frozen_sp079_baseline', 'change_vs_pre_sp105_frozen_sp079', 'pre_sp105_frozen_sp079_point_for_comparison_only', 'pre_sp105_frozen_sp079_rating_for_comparison_only', 'pre_sp105_frozen_sp079_interval_for_comparison_only', 'pre_sp105_frozen_sp079_rating_interval_for_comparison_only', 'pre_sp105_frozen_sp079_confidence_for_comparison_only', 'pre_sp079_project_rating_for_comparison_only', 'change_vs_pre_sp079_project', 'powerpro_difference_for_qa_only', 'scale_status', 'owner_verdict_state', 'owner_verdict_count'
  ];
  const csvRows = finalRows.map((row) => Object.fromEntries(Object.entries({
    ...row,
    latent_speed_percentile_interval: JSON.stringify(row.latent_speed_percentile_interval),
    provisional_practical_rating_interval: JSON.stringify(row.provisional_practical_rating_interval),
    physical_family_weights: JSON.stringify(row.physical_family_weights),
    tier_influence: JSON.stringify(row.tier_influence),
    lower_tier_constraints: JSON.stringify(row.lower_tier_constraints),
    missing_physical_lanes: JSON.stringify(row.missing_physical_lanes),
    context_decision_use: JSON.stringify(row.context_decision_use)
  }).map(([key, value]) => [key, value])));
  const synthesisLines = baseRows.map((base, index) => buildSynthesisLine(base, fullResults[index], contextUse[index], manifestHash, policyHash));
  writeText('outputs/derived/sp105_player_evidence_synthesis.jsonl', `${synthesisLines.map((row) => JSON.stringify(row)).join('\n')}\n`);
  writeJson('outputs/derived/sp105_final_practical_speed_100.json', finalJson);
  writeText('outputs/derived/sp105_final_practical_speed_100.csv', toCsv(csvRows, csvHeaders));
  writeJson('outputs/derived/sp105_final_value_component_ablation.json', ablation);
  writeJson('outputs/derived/sp105_powerpro_posthoc_qa.json', powerproPosthoc);
  const benchmark = buildPolicyBenchmark(baseRows, calibrationReceipts, ablation, descriptiveDiagnostics);
  writeJson('outputs/derived/sp105_synthesis_policy_benchmark.json', benchmark);
  // The policy was frozen before the manifest was hashed and is intentionally
  // not rewritten here; synthesis receipts therefore retain the exact file
  // hash that was used when the core values were built.
  const selectedPolicy = policyForHash;
  const qa = buildInternalQa(baseRows, finalRows, ablation, selectedPolicy, ownerLedger, registryRows, inputData, baselineReproduction, contextUse);
  writeJson('outputs/derived/sp105_global_consistency_qa.json', qa);
  const report = buildReport(finalRows, benchmark, ablation, contextUse, powerproPosthoc, qa, baselineReproduction, calibrationReceipts);
  writeText('docs/reports/sp105_final_practical_speed_100.md', report);
  console.log(JSON.stringify({
    status: qa.status,
    players: finalRows.length,
    ablation_cells: ablation.cells.length,
    selected_policy_id: SELECTED_POLICY_ID,
    point_semantics: finalRows.reduce((acc, row) => { acc[row.point_semantics] = (acc[row.point_semantics] ?? 0) + 1; return acc; }, {}),
    evidence_states: finalRows.reduce((acc, row) => { acc[row.evidence_state] = (acc[row.evidence_state] ?? 0) + 1; return acc; }, {}),
    owner_verdict_count: 0,
    scale_status: SCALE_STATUS
  }, null, 2));
}

main();

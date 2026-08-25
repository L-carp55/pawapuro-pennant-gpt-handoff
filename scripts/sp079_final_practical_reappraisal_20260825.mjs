#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'outputs', 'derived');
const DOCS_REPORT = path.join(ROOT, 'docs', 'reports', 'sp079_final_practical_speed_100.md');
const POLICY_PATH = path.join(OUT, 'sp079_appraisal_policy.json');
const AS_OF_YEAR = 2026;
const SCALE_STATUS = 'PROVISIONAL_PENDING_SP071_SP072';

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
  baseline: 'outputs/derived/speed_2026_100_owner_review_master_20260813.json',
  ownerLedger: 'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
  registry: 'docs/state/speed_task_registry.tsv'
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
  return readText(rel).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
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
  if (!condition) throw new Error(`SP-079 fail-closed: ${message}`);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function round(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function median(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function mean(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
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

function classifyCanonicalMetric(row) {
  const metric = String(row.metric ?? '');
  const lower = metric.toLowerCase();
  if (metric === 'T90FT_SECONDS') return 'END_TO_END_90FT';
  if (metric === 'T10FT_SECONDS' || metric === 'T30FT_SECONDS') return 'ACCELERATION_H2F';
  if (metric === 'HP_TO_1B_SECONDS' || metric === 'HP_TO_1B_NORMAL_SEC') return 'ACCELERATION_H2F';
  if (metric === '30M_CURATED_SECONDS' || metric === '30M_PROFILE_SECONDS' || metric === '30M_STANDING_START_SECONDS' || metric === '50M_PROFILE_SECONDS' || metric === '50M_STANDING_START_SECONDS' || metric === '50M_MANUAL_SECONDS' || lower === '50m') return 'SHORT_DISTANCE';
  return null;
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

function percentileFaster(values, value) {
  const xs = values.filter(Number.isFinite);
  if (!xs.length || !Number.isFinite(value)) return null;
  const slower = xs.filter((x) => x > value).length;
  const tied = xs.filter((x) => x === value).length;
  return clamp((slower + tied / 2) / xs.length);
}

function buildDistribution(records, valueAccessor) {
  const values = records.map(valueAccessor).filter(Number.isFinite);
  return values;
}

function percentileInterval(values, interval) {
  if (!interval) return null;
  const pLow = percentileFaster(values, interval.high);
  const pHigh = percentileFaster(values, interval.low);
  if (pLow === null || pHigh === null) return null;
  return { low: Math.min(pLow, pHigh), high: Math.max(pLow, pHigh) };
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
    const width = valueInterval(record);
    const currentWidth = current ? valueInterval(current) : null;
    if (!current || score > (priority[current.bank_acceptance_status] ?? 1) || (score === (priority[current.bank_acceptance_status] ?? 1) && (width?.high - width?.low ?? Infinity) < (currentWidth?.high - currentWidth?.low ?? Infinity))) grouped.set(key, record);
  }
  return [...grouped.values()];
}

function recordFromCanonical(row, distributions) {
  const family = classifyCanonicalMetric(row);
  const interval = valueInterval(row);
  if (!family || !interval || !row.stable_player_key || row.identity_state !== 'CURRENT100_EXACT_NAME') return null;
  const values = distributions[row.metric] ?? [];
  const p = percentileFaster(values, interval.midpoint);
  const pInterval = percentileInterval(values, interval);
  if (p === null || !pInterval) return null;
  const gap = yearsAgo(row.measurement_year);
  const protocolUncertainty = row.metric === 'T90FT_SECONDS' ? 0.025 : family === 'SHORT_DISTANCE' ? 0.035 : 0.03;
  const timeUncertainty = gap === null ? 0.06 : Math.min(0.12, gap * 0.012);
  const low = clamp(pInterval.low - protocolUncertainty - timeUncertainty);
  const high = clamp(pInterval.high + protocolUncertainty + timeUncertainty);
  return {
    source_kind: 'SP104_CANONICAL_HISTORICAL',
    source_id: row.canonical_id,
    source_family: family,
    stable_player_key: row.stable_player_key,
    player: row.player,
    metric: row.metric,
    measurement_year: row.measurement_year ?? null,
    same_measurement_cluster_id: row.same_measurement_cluster_id ?? row.canonical_id,
    raw_value: interval.midpoint,
    value_range: [interval.low, interval.high],
    latent_point: round(p, 6),
    latent_interval: [round(low, 6), round(high, 6)],
    evidence_role: row.metric === 'T90FT_SECONDS' ? 'DIRECT_T90_BOUNDED_RECORD' : 'HISTORICAL_OR_PROTOCOL_BOUNDED_CONTEXT',
    numeric_use_state: row.numeric_use_state ?? null,
    bank_acceptance_status: row.bank_acceptance_status ?? null,
    date_gap_years: gap,
    duplicate_guard: 'ONE_CANONICAL_MEASUREMENT_CLUSTER_ONCE',
    forbidden_transform_applied: false,
    used_in_point: true
  };
}

function officialRowsFromCsv(rel, kind) {
  const rows = parseCsv(readText(rel));
  return rows.map((row, index) => ({ ...row, __source_kind: kind, __source_row: index + 2 }));
}

function buildOfficialEvidence(rows, field, family, distributions, idPrefix) {
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
    out.push({
      source_kind: 'MLB_STATCAST_OFFICIAL',
      source_id: `${idPrefix}:${key}:${row.season}:${row.__source_row}`,
      source_family: family,
      stable_player_key: key,
      player: row.npb_name ?? row.npb_name_en ?? null,
      metric: field,
      measurement_year: season,
      same_measurement_cluster_id: `MLB:${key}:${row.season}`,
      raw_value: value,
      value_range: [value, value],
      latent_point: round(p, 6),
      latent_interval: [round(clamp(p - baseWidth - timeWidth), 6), round(clamp(p + baseWidth + timeWidth), 6)],
      evidence_role: field === 'standardized_90ft_seconds' ? 'OFFICIAL_STANDARDIZED_90FT_SAME_PLAYER' : 'OFFICIAL_RAW_H2F_CONTEXT_SEPARATE_FROM_90FT',
      numeric_use_state: 'SAME_PLAYER_SEASON_BOUNDED_CONTEXT',
      bank_acceptance_status: 'OFFICIAL_SOURCE_FIELD',
      date_gap_years: gap,
      season: season,
      duplicate_guard: 'ONE_PLAYER_SEASON_ONCE_AND_FIELDS_NOT_ADDITIVE',
      forbidden_transform_applied: false,
      used_in_point: true
    });
  }
  return out;
}

function dedupeOfficial(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.stable_player_key, row.source_family, row.measurement_year, row.metric].join('|');
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function rankResults(results) {
  const ranked = [...results].sort((a, b) => {
    const ap = a.latent_speed_percentile_point;
    const bp = b.latent_speed_percentile_point;
    if (ap === null && bp === null) return a.stable_player_key.localeCompare(b.stable_player_key);
    if (ap === null) return 1;
    if (bp === null) return -1;
    return bp - ap || a.stable_player_key.localeCompare(b.stable_player_key);
  });
  let lastPoint = null;
  let rank = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    const item = ranked[i];
    if (item.latent_speed_percentile_point === null) {
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

function showContext(showRow) {
  const show = showRow?.the_show_implied_appraisal_range ?? {};
  const available = show.state === 'AVAILABLE_EXTERNAL_GAME_APPRAISAL' && Array.isArray(show.range);
  return {
    available,
    state: show.state ?? 'MISSING_BOUNDED',
    source_rows: show.source_rows ?? 0,
    range: available ? show.range : null,
    speed_percentile_context_present: finiteNumber(show.speed_percentile_context) !== null,
    role: show.role ?? 'external_game_appraisal_not_physical_measurement',
    direct_copy_used: false
  };
}

function buildContext(base, showRow, graph, sp104Receipt, queueRow) {
  const show = showContext(showRow);
  const analogRows = base.sp101.shared_indicator_analog_evidence?.valid_rows ?? [];
  const validAnalogRows = analogRows.filter((row) => row.common_support_status === 'COMMON_SUPPORT_MULTI_FEATURE' && row.matched_physical_percentile === null);
  const ordinalEdges = graph.signed_pairwise_edges.filter((edge) => edge.source_family !== 'POWERPRO_BEHAVIOR' && (edge.faster_player_key === base.stable_player_key || edge.slower_player_key === base.stable_player_key));
  const transitionCount = (graph.context_annotations ?? []).filter((annotation) => annotation.player_key === base.stable_player_key).length;
  const transferMethods = sp104Receipt?.method_receipts ?? [];
  const boundedTransfer = transferMethods.filter((receipt) => receipt.result_state === 'BOUNDED_CONTEXT' && receipt.direct_numeric_promotion_allowed === false).map((receipt) => receipt.method_id);
  const noSupportTransfer = transferMethods.filter((receipt) => receipt.result_state === 'NO_COMMON_SUPPORT').map((receipt) => receipt.method_id);
  const proxy = queueRow?.statistical_proxy_context ?? {};
  const community = queueRow?.community_physical_context ?? {};
  const gameProxy = queueRow?.game_context_proxy_breakdown ?? {};
  const missing = queueRow?.missingness_and_coverage ?? {};
  const temporal = queueRow?.historical_physical_temporal_context ?? {};
  const technique = queueRow?.technique_separation_contract ?? {};
  const externalContextAvailable = show.available || validAnalogRows.length > 0 || ordinalEdges.length > 0 || transitionCount > 0;
  const communityCount = finiteNumber(community.active_source_row_count) ?? 0;
  const proxyAvailable = proxy.state === 'COMPARABLE_2025_STATISTICAL_PROXY';
  const usageAvailable = gameProxy.evidence_state === 'AVAILABLE_MIXED_PROXY';
  const missingLanes = [];
  if (!base.physicalFamilies.some((x) => x.family === 'ACCELERATION_H2F')) missingLanes.push('CURRENT_ACCELERATION_H2F');
  if (!base.physicalFamilies.some((x) => x.family === 'END_TO_END_90FT')) missingLanes.push('DIRECT_T90_OR_STANDARDIZED_90FT');
  if (!base.physicalFamilies.some((x) => x.family === 'SHORT_DISTANCE')) missingLanes.push('SHORT_DISTANCE_30M_50M');
  if (!base.mlb90Count && !base.mlbH2fCount) missingLanes.push('MATCHED_MLB_RUNNING_SPLITS');
  if (!show.available) missingLanes.push('THE_SHOW_SPEED_CONTEXT');
  if (missing.age_state === 'MISSING_BOUNDED' || temporal.age_context?.evidence_state === 'MISSING_BOUNDED') missingLanes.push('AGE');
  if (missing.injury_state === 'MISSING_BOUNDED' || temporal.injury_context?.evidence_state === 'MISSING_BOUNDED') missingLanes.push('INJURY');
  return {
    show,
    analog: {
      valid_common_support_count: validAnalogRows.length,
      valid_common_support_ids: validAnalogRows.flatMap((row) => row.evidence_ids ?? []).slice(0, 12),
      target_physical_percentile_used: false,
      physical_numeric_transfer_used: false
    },
    ordinal_transition: {
      signed_non_powerpro_edge_count: ordinalEdges.length,
      signed_edge_ids: ordinalEdges.flatMap((edge) => edge.evidence_ids ?? []).slice(0, 12),
      transition_annotation_count: transitionCount,
      numeric_transfer_used: false
    },
    transfer: {
      bounded_context_methods: boundedTransfer,
      no_common_support_methods: noSupportTransfer,
      selected_method_id: null,
      production_use: false,
      direct_numeric_promotion_allowed: false
    },
    proxy: {
      available: proxyAvailable,
      state: proxy.state ?? 'MISSING_SAME_TIME_STATISTICAL_EVIDENCE',
      role: proxy.role ?? 'CONTEXT_ONLY_NOT_A_PHYSICAL_TEACHER',
      numeric_proxy_used_in_point: false,
      numeric_proxy_used_as_teacher: false
    },
    scouting_community_video_usage: {
      community_state: community.evidence_state ?? 'MISSING_BOUNDED',
      community_active_source_row_count: communityCount,
      community_directional_speed_signal_used: false,
      video_or_scouting_context_present: false,
      usage_proxy_context_present: usageAvailable,
      numeric_context_used_in_point: false
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
    external_context_available: externalContextAvailable,
    context_only: true,
    context_uncertainty_flags: {
      show: show.available,
      analog: validAnalogRows.length > 0,
      ordinal: ordinalEdges.length > 0,
      transition: transitionCount > 0,
      proxy: proxyAvailable,
      community: communityCount > 0,
      usage: usageAvailable
    }
  };
}

function componentIncludesRecord(component, record) {
  if (component === 'peak_speed') return record.family !== 'PEAK';
  if (component === 'acceleration_h2f_t90_90ft') return record.family !== 'ACCELERATION_H2F' && record.family !== 'END_TO_END_90FT';
  if (component === 'historical_physical') return record.source_kind !== 'SP104_CANONICAL_HISTORICAL';
  if (component === 'mlb_statcast_running_bridge') return record.source_kind !== 'MLB_STATCAST_OFFICIAL';
  return true;
}

function synthesize(base, removedComponents = []) {
  const removed = new Set(removedComponents);
  const included = [];
  for (const record of base.physicalRecords) {
    if (record.used_in_point === false) continue;
    let keep = true;
    for (const component of ['peak_speed', 'acceleration_h2f_t90_90ft', 'historical_physical', 'mlb_statcast_running_bridge']) {
      if (removed.has(component) && !componentIncludesRecord(component, record)) keep = false;
    }
    if (keep) included.push(record);
  }
  const families = new Map();
  for (const record of included) {
    if (!families.has(record.family)) families.set(record.family, []);
    families.get(record.family).push(record);
  }
  const familySummaries = [];
  for (const family of PHYSICAL_FAMILIES) {
    const records = families.get(family) ?? [];
    if (!records.length) continue;
    const point = median(records.map((record) => record.latent_point));
    const low = Math.min(...records.map((record) => record.latent_interval[0]));
    const high = Math.max(...records.map((record) => record.latent_interval[1]));
    familySummaries.push({
      family,
      available: true,
      point: round(point, 6),
      interval: [round(clamp(low), 6), round(clamp(high), 6)],
      record_count: records.length,
      independent_cluster_count: unique(records.map((record) => record.same_measurement_cluster_id)).length,
      evidence_ids: unique(records.map((record) => record.source_id)).slice(0, 20),
      source_kinds: unique(records.map((record) => record.source_kind)),
      direct_or_bounded: records.some((record) => record.source_family === 'END_TO_END_90FT') ? 'DIRECT_OR_STANDARDIZED_90FT' : 'BOUNDED_CONTEXT'
    });
  }
  const familyPoints = familySummaries.map((family) => family.point).filter(Number.isFinite);
  const weights = {};
  for (const family of familySummaries) weights[family.family] = round(1 / familySummaries.length, 6);
  const point = familyPoints.length ? mean(familyPoints) : null;
  let low = familySummaries.length ? Math.min(...familySummaries.map((family) => family.interval[0])) : 0;
  let high = familySummaries.length ? Math.max(...familySummaries.map((family) => family.interval[1])) : 1;
  const directSpread = familyPoints.length > 1 ? Math.max(...familyPoints) - Math.min(...familyPoints) : 0;
  const directConflict = directSpread > 0.3;
  let conflictState = directConflict ? 'MATERIAL_DIRECT_CONFLICT' : 'NONE';
  const materialConflicts = [];
  if (directConflict) materialConflicts.push(`physical_family_spread=${round(directSpread, 4)}`);

  const context = base.context;
  const contextOnly = {
    show: !removed.has('the_show_context') && context.show.available,
    analog: !removed.has('analog_ordinal_transition') && context.analog.valid_common_support_count > 0,
    ordinal: !removed.has('analog_ordinal_transition') && context.ordinal_transition.signed_non_powerpro_edge_count > 0,
    transition: !removed.has('analog_ordinal_transition') && context.ordinal_transition.transition_annotation_count > 0,
    proxy: !removed.has('statistical_proxies') && context.proxy.available,
    community: !removed.has('scouting_community_video_usage_context') && context.scouting_community_video_usage.community_active_source_row_count > 0,
    usage: !removed.has('statistical_proxies') && context.scouting_community_video_usage.usage_proxy_context_present
  };
  let contextualWiden = 0;
  if (contextOnly.show) contextualWiden += 0.015;
  if (contextOnly.analog || contextOnly.ordinal || contextOnly.transition) contextualWiden += 0.005;
  if (contextOnly.proxy) contextualWiden += 0.01;
  if (contextOnly.community || contextOnly.usage) contextualWiden += 0.01;
  if (context.transfer.no_common_support_methods.length && !contextOnly.analog && !contextOnly.ordinal) contextualWiden += 0.04;
  if (familySummaries.length === 1) contextualWiden += 0.035;
  if (familySummaries.length === 0) {
    conflictState = 'IDENTITY_OR_PROTOCOL_UNRESOLVED';
    materialConflicts.push('no_included_physical_family');
  }
  if (directConflict) contextualWiden += 0.05;
  low = clamp(low - contextualWiden);
  high = clamp(high + contextualWiden);
  if (point !== null) {
    low = Math.min(low, point);
    high = Math.max(high, point);
  }
  const missingFamilyCount = PHYSICAL_FAMILIES.length - familySummaries.length;
  let confidence = 'LOW';
  if (directConflict || familySummaries.length === 0) confidence = 'VERY_LOW';
  else if (familySummaries.length >= 3 && !contextualWiden) confidence = 'HIGH';
  else if (familySummaries.length >= 2) confidence = 'MEDIUM';
  else if (familySummaries.length === 1) confidence = 'LOW';
  if (contextualWiden >= 0.05 && confidence === 'HIGH') confidence = 'MEDIUM';
  let evidenceState = 'DIRECT_PEAK_ONLY_WITH_CONTEXT';
  const hasNonPeak = familySummaries.some((family) => family.family !== 'PEAK');
  if (directConflict) evidenceState = 'UNRESOLVED';
  else if (familySummaries.length === 0) evidenceState = 'UNRESOLVED';
  else if (familySummaries.length >= 2) evidenceState = 'DIRECT_MULTI_CONSTRUCT';
  else if (hasNonPeak) evidenceState = 'DIRECT_PEAK_PLUS_BOUNDED_OTHER';
  else if (context.analog.valid_common_support_count > 0 && !removed.has('analog_ordinal_transition')) evidenceState = 'SUPPORTED_ANALOG_OR_ORDINAL_RANGE';
  else if (context.transfer.no_common_support_methods.length && !contextOnly.analog && !contextOnly.ordinal) evidenceState = 'NO_COMMON_SUPPORT_WIDE_INTERVAL';
  const ratingPoint = point === null ? null : Math.round(clamp(point) * 100);
  const ratingLow = Math.round(clamp(low) * 100);
  const ratingHigh = Math.round(clamp(high) * 100);
  return {
    latent_speed_percentile_point: point === null ? null : round(clamp(point), 6),
    latent_speed_percentile_interval: [round(clamp(low), 6), round(clamp(high), 6)],
    provisional_practical_rating: ratingPoint,
    provisional_practical_rating_interval: [ratingLow, ratingHigh],
    component_weights: weights,
    physical_family_summaries: familySummaries,
    physical_family_count: familySummaries.length,
    missing_physical_family_count: missingFamilyCount,
    rank_fastest: null,
    rank_percentile: null,
    confidence,
    evidence_state: evidenceState,
    conflict_state: conflictState,
    material_conflicts: materialConflicts,
    contextual_components_present: contextOnly,
    context_uncertainty_added: round(contextualWiden, 6),
    missingness_is_not_slow: true,
    technique_used_in_physical_point: false,
    powerpro_teacher_used: false,
    the_show_direct_copy: false,
    direct_30m_50m_to_t90_conversion: false,
    target_self_teaching_or_season_leakage: false,
    recomputed_from_frozen_evidence: true,
    scale_status: SCALE_STATUS
  };
}

function projectForAblation(result) {
  return {
    point: result.latent_speed_percentile_point,
    interval: result.latent_speed_percentile_interval,
    rank: result.rank_fastest,
    confidence: result.confidence,
    conflict_state: result.conflict_state,
    evidence_state: result.evidence_state
  };
}

function compareAblation(full, ablated) {
  const changedFields = [];
  if (full.point !== ablated.point) changedFields.push('point');
  if (JSON.stringify(full.interval) !== JSON.stringify(ablated.interval)) changedFields.push('interval');
  if (full.rank !== ablated.rank) changedFields.push('rank');
  if (full.confidence !== ablated.confidence) changedFields.push('confidence');
  if (full.conflict_state !== ablated.conflict_state) changedFields.push('conflict_state');
  if (full.evidence_state !== ablated.evidence_state) changedFields.push('evidence_state');
  return {
    changed_fields: changedFields,
    decision_use_effect: changedFields.length ? 'RECOMPUTED_CHANGED' : 'RECOMPUTED_NO_CHANGE',
    recomputation_check: 'ACTUAL_FULL_SYNTHESIS_FUNCTION_RERUN'
  };
}

function makeEvidenceReason(result, base) {
  const reasons = [];
  if (result.physical_family_summaries.some((family) => family.family === 'PEAK')) reasons.push('current NPB+ peak speed is retained as a distinct peak lane');
  if (result.physical_family_summaries.some((family) => family.family === 'ACCELERATION_H2F')) reasons.push('bounded acceleration/H2F evidence is present without treating H2F as T90');
  if (result.physical_family_summaries.some((family) => family.family === 'END_TO_END_90FT')) reasons.push('direct or standardized 90ft evidence is present');
  if (result.physical_family_summaries.some((family) => family.family === 'SHORT_DISTANCE')) reasons.push('native 30m/50m short-distance evidence is retained without distance conversion');
  if (base.mlb90Count || base.mlbH2fCount) reasons.push('same-player official MLB running evidence is used as season-bounded context');
  if (base.context.show.available) reasons.push('The Show is retained as external ordinal/context evidence only');
  if (base.context.analog.valid_common_support_count) reasons.push('valid analog common support is retained as bounded context only');
  if (base.context.proxy.available) reasons.push('mixed statistical proxies are retained only as uncertainty/confounder context');
  if (base.context.scouting_community_video_usage.community_active_source_row_count) reasons.push('community physical observations are bounded context only');
  if (result.missing_physical_family_count) reasons.push('missing physical lanes widen the interval; missingness is not interpreted as slow');
  return reasons;
}

function makePlayerBase(sp100Row, sp101Row, showRow, stateRow, queueRow, canonicalRecords, mlbRecords, graph, receipt, baseline) {
  const peak = sp100Row.n_primary ?? {};
  const p = finiteNumber(peak.current_cohort?.percentile_faster_than);
  assert(p !== null, `missing current NPB+ percentile for ${sp100Row.player}`);
  const peakRange = sp101Row.independent_physical_estimate?.peak_speed_range_percentile_0_100;
  const peakLow = Array.isArray(peakRange) && finiteNumber(peakRange[0]) !== null ? clamp(Number(peakRange[0]) / 100) : clamp(p - 0.15);
  const peakHigh = Array.isArray(peakRange) && finiteNumber(peakRange[1]) !== null ? clamp(Number(peakRange[1]) / 100) : clamp(p + 0.15);
  const peakRecord = {
    family: 'PEAK',
    source_kind: 'SP100_CURRENT_NPB_PLUS',
    source_id: sp100Row.row_id,
    source_family: 'PEAK_SPEED',
    stable_player_key: sp100Row.stable_player_key,
    player: sp100Row.player,
    metric: 'top_speed_kmh',
    measurement_year: peak.source_season_label ?? 2026,
    same_measurement_cluster_id: `SP100_PEAK:${sp100Row.stable_player_key}:2026`,
    raw_value: finiteNumber(peak.top_speed_kmh),
    value_range: [peakLow, peakHigh],
    latent_point: round(p, 6),
    latent_interval: [round(peakLow, 6), round(peakHigh, 6)],
    evidence_role: 'CURRENT_NPB_PLUS_PEAK_ONLY',
    numeric_use_state: 'PEAK_LANE_ONLY',
    bank_acceptance_status: 'SP100_OWNER_APPROVED_ARCHITECTURE',
    date_gap_years: 0,
    duplicate_guard: 'NPB_PLUS_PEAK_IS_NOT_RECOUNTED_AS_HISTORICAL_PEAK',
    forbidden_transform_applied: false,
    family: 'PEAK'
  };
  const allPhysicalRecords = [peakRecord, ...canonicalRecords, ...mlbRecords];
  const base = {
    queue_order: sp100Row.row_id,
    player: sp100Row.player,
    player_id: sp100Row.player_id,
    stable_player_key: sp100Row.stable_player_key,
    team: sp100Row.team,
    sp100: {
      row_id: sp100Row.row_id,
      top_speed_kmh: finiteNumber(peak.top_speed_kmh),
      npb_top_speed_z: finiteNumber(peak.npb_top_speed_z),
      peak_percentile: p,
      current_cohort_size: peak.current_cohort?.size ?? 100,
      measurement_reliability: peak.measurement_reliability ?? 'NOT_IDENTIFIABLE',
      exposure_context: peak.exposure_context ?? null,
      source_season_label: peak.source_season_label ?? null
    },
    physicalRecords: allPhysicalRecords,
    physicalFamilies: allPhysicalRecords.map((record) => ({ family: record.family, source_id: record.source_id })),
    canonicalRecordCount: canonicalRecords.length,
    mlb90Count: mlbRecords.filter((record) => record.source_family === 'END_TO_END_90FT').length,
    mlbH2fCount: mlbRecords.filter((record) => record.source_family === 'ACCELERATION_H2F').length,
    context: null,
    sp101: {
      identity_state: sp101Row.identity_state,
      coverage_state: sp101Row.coverage_state,
      residual_confidence: sp101Row.residual_confidence,
      independent_physical_status: sp101Row.independent_physical_estimate?.status ?? null,
      shared_indicator_analog_evidence: sp101Row.shared_indicator_analog_evidence ?? {},
      route_disagreement: sp101Row.route_disagreement ?? null,
      the_show_live_row_count_after_repair: sp101Row.the_show_live_row_count_after_repair ?? 0
    },
    state: {
      before_after: stateRow ? { before: stateRow.before, after: stateRow.after } : null,
      lane_counts_after: stateRow?.lane_counts_after ?? null,
      selected_anchor_ids: stateRow?.selected_anchor_ids ?? []
    },
    baseline: {
      pre_sp079_project_rating: baseline?.gpt_codex_rating ?? null,
      pre_sp079_project_interval: [baseline?.gpt_codex_low ?? null, baseline?.gpt_codex_high ?? null],
      pre_sp079_project_confidence: baseline?.gpt_codex_confidence ?? null
    }
  };
  base.context = buildContext(base, showRow, graph, receipt, queueRow);
  return base;
}

function parseRegistry(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split('\t');
  return lines.slice(1).filter(Boolean).map((line) => Object.fromEntries(line.split('\t').map((value, i) => [header[i], value])));
}

function buildManifest(inputData, ownerLedger, registryRows, currentKeys, baseRows) {
  const sourceHashes = {};
  for (const [key, rel] of Object.entries(INPUT_PATHS)) sourceHashes[key] = sha256File(rel);
  return {
    schema_version: 'sp079_frozen_input_manifest_v1',
    task_id: 'SP-079',
    frozen_at: '2026-08-25',
    policy_sha256: sourceHashes.policy,
    input_files: Object.fromEntries(Object.entries(INPUT_PATHS).map(([key, rel]) => [key, { path: rel, sha256: sourceHashes[key] }])),
    population: {
      current100_count: currentKeys.length,
      current100_stable_key_sha256: stableHash(currentKeys),
      base_evidence_row_count: baseRows.length
    },
    upstream_evidence_counts: {
      sp103_evidence_universe_rows: inputData.sp103UniverseRows,
      sp103_traceability_rows: inputData.sp103TraceabilityRows,
      sp104_canonical_rows: inputData.canonicalRows,
      sp104_mlb_running_rows: inputData.mlbRunningRows,
      sp104_mlb_exposure_rows: inputData.mlbExposureRows,
      sp101_the_show_rows: inputData.sp101ShowRows,
      sp104_anchor_receipts: inputData.sp104Receipts
    },
    registry_snapshot_before_finalization: Object.fromEntries(registryRows.filter((row) => ['SP-079', 'SP-080', 'SP-081', 'SP-082', 'SP-103', 'SP-104'].includes(row.task_id)).map((row) => [row.task_id, { status: row.status, owner_review_block: row.owner_review_block, gate_block: row.gate_block }])) ,
    owner_review_integrity: {
      owner_verdict_count: ownerLedger.owner_verdict_count,
      owner_records_count: ownerLedger.records?.length ?? 0,
      owner_ledger_sha256: sourceHashes.ownerLedger,
      owner_input_used_in_synthesis: false,
      owner_verdicts_written: false
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

function buildInternalQa(baseRows, fullResults, ablationCells, policy, ownerLedger, registryRows, inputData) {
  const checks = [];
  const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
  check('population_exact_100', baseRows.length === 100 && new Set(baseRows.map((row) => row.stable_player_key)).size === 100, { count: baseRows.length });
  check('policy_frozen_before_rows', policy.status === 'FROZEN_BEFORE_PLAYER_REAPPRAISAL', policy.status);
  check('owner_verdict_count_zero', ownerLedger.owner_verdict_count === 0 && (ownerLedger.records?.length ?? 0) === 0, { owner_verdict_count: ownerLedger.owner_verdict_count });
  check('powerpro_teacher_false', fullResults.every((row) => row.powerpro_teacher_used === false), 'all final rows');
  check('show_copy_false', fullResults.every((row) => row.the_show_direct_copy === false), 'all final rows');
  check('short_distance_guard', fullResults.every((row) => row.direct_30m_50m_to_t90_conversion === false), 'all final rows');
  check('missing_not_slow', fullResults.every((row) => row.missingness_is_not_slow === true), 'all final rows');
  check('technique_guard', fullResults.every((row) => row.technique_used_in_physical_point === false), 'all final rows');
  check('actual_ablation_cells', ablationCells.length === 800 && ablationCells.every((cell) => cell.recomputed_from_frozen_evidence === true), { cells: ablationCells.length });
  check('component_weight_rule', fullResults.every((row) => row.physical_family_weights && Object.values(row.physical_family_weights).every((weight) => weight > 0)), 'equal available family weights');
  check('registry_scope', registryRows.find((row) => row.task_id === 'SP-080')?.status === 'NOT_STARTED' && registryRows.find((row) => row.task_id === 'SP-081')?.status === 'NOT_STARTED' && registryRows.find((row) => row.task_id === 'SP-082')?.status === 'BLOCKED_DEPENDENCY', 'SP-080/SP-081/shoulder unchanged');
  check('sp103_universe_present', inputData.sp103UniverseRows === 71, inputData.sp103UniverseRows);
  check('sp104_effective_ready', inputData.sp104TransferPolicy.direct_numeric_promotion_allowed === false && inputData.sp104TransferPolicy.production_use === false, inputData.sp104TransferPolicy.status);
  return {
    schema_version: 'sp079_global_consistency_qa_v1',
    task_id: 'SP-079',
    status: checks.every((item) => item.pass) ? 'PASS_PRE_INDEPENDENT_QA' : 'FAIL',
    checks,
    output_row_count: fullResults.length,
    ablation_cell_count: ablationCells.length,
    generated_at: '2026-08-25'
  };
}

function correlation(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) return null;
  const xm = mean(pairs.map(([x]) => x));
  const ym = mean(pairs.map(([, y]) => y));
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - xm) * (y - ym), 0);
  const denX = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - xm) ** 2, 0));
  const denY = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - ym) ** 2, 0));
  return denX && denY ? numerator / (denX * denY) : null;
}

function ranks(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index);
  const result = Array(values.length);
  let rank = 0;
  let last = null;
  for (let i = 0; i < sorted.length; i += 1) {
    if (last === null || sorted[i].value !== last) rank = i + 1;
    result[sorted[i].index] = rank;
    last = sorted[i].value;
  }
  return result;
}

function buildAblation(baseRows, fullResults) {
  const cells = [];
  const summary = {};
  for (const component of COMPONENTS) {
    const ablated = baseRows.map((base) => {
      const result = synthesize(base, [component]);
      result.stable_player_key = base.stable_player_key;
      return { base, result };
    });
    rankResults(ablated.map((entry) => entry.result));
    let changed = 0;
    for (let i = 0; i < baseRows.length; i += 1) {
      const full = projectForAblation(fullResults[i]);
      const noComponent = projectForAblation(ablated[i].result);
      const diff = compareAblation(full, noComponent);
      if (diff.changed_fields.length) changed += 1;
      cells.push({
        stable_player_key: baseRows[i].stable_player_key,
        player: baseRows[i].player,
        removed_component: component,
        full,
        ablated: noComponent,
        ...diff,
        component_available_in_full: component === 'peak_speed' ? true : component === 'acceleration_h2f_t90_90ft' ? baseRows[i].physicalRecords.some((r) => r.family === 'ACCELERATION_H2F' || r.family === 'END_TO_END_90FT') : component === 'historical_physical' ? baseRows[i].physicalRecords.some((r) => r.source_kind === 'SP104_CANONICAL_HISTORICAL') : component === 'mlb_statcast_running_bridge' ? baseRows[i].physicalRecords.some((r) => r.source_kind === 'MLB_STATCAST_OFFICIAL') : component === 'the_show_context' ? baseRows[i].context.show.available : component === 'analog_ordinal_transition' ? (baseRows[i].context.analog.valid_common_support_count > 0 || baseRows[i].context.ordinal_transition.signed_non_powerpro_edge_count > 0 || baseRows[i].context.ordinal_transition.transition_annotation_count > 0) : component === 'statistical_proxies' ? baseRows[i].context.proxy.available || baseRows[i].context.scouting_community_video_usage.usage_proxy_context_present : baseRows[i].context.scouting_community_video_usage.community_active_source_row_count > 0,
        recomputed_from_frozen_evidence: true
      });
    }
    summary[component] = { cell_count: baseRows.length, changed_player_count: changed, changed_fraction: round(changed / baseRows.length, 6) };
  }
  return { schema_version: 'sp079_final_value_component_ablation_v1', task_id: 'SP-079', method: 'ACTUAL_FULL_SYNTHESIS_RERUN_WITH_COMPONENT_REMOVED', component_order: COMPONENTS, summary, cells, generated_at: '2026-08-25' };
}

function buildPowerproPosthoc(master, finalRows) {
  const byId = new Map(master.rows.map((row) => [String(row.player_id), row]));
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
      stage: 'POSTHOC_AFTER_FINAL_VALUES_FROZEN'
    };
  });
  const diffs = rows.map((row) => row.difference_final_minus_powerpro).filter(Number.isFinite);
  return {
    schema_version: 'sp079_powerpro_posthoc_qa_v1',
    task_id: 'SP-079',
    status: 'PASS_POSTHOC_ONLY',
    source_role: 'QA_ONLY_NOT_A_FEATURE',
    summary: {
      matched_rows: rows.filter((row) => row.current_powerpro_speed_for_qa_only !== null).length,
      mean_difference: round(mean(diffs), 6),
      max_absolute_difference: diffs.length ? round(Math.max(...diffs.map((x) => Math.abs(x))), 6) : null,
      all_teacher_flags_false: rows.every((row) => row.powerpro_used_as_teacher === false)
    },
    rows,
    generated_at: '2026-08-25'
  };
}

function buildReport(fullRows, ablation, powerpro, qa, inputManifest) {
  const states = {};
  const confidence = {};
  for (const row of fullRows) {
    states[row.evidence_state] = (states[row.evidence_state] ?? 0) + 1;
    confidence[row.confidence] = (confidence[row.confidence] ?? 0) + 1;
  }
  const changedSummary = Object.entries(ablation.summary).map(([component, value]) => `| ${component} | ${value.cell_count} | ${value.changed_player_count} | ${value.changed_fraction} |`).join('\n');
  const rowLines = fullRows.slice(0, 12).map((row) => `| ${row.rank_fastest ?? '—'} | ${row.player} | ${row.provisional_practical_rating ?? '—'} | ${row.provisional_practical_rating_interval.join('–')} | ${row.evidence_state} | ${row.confidence} |`).join('\n');
  return `# SP-079 Final Practical Speed Reappraisal — 100 Players

As of 2026-08-25, this is a provisional, baseball-relevant running-speed appraisal for the frozen current NPB+ 100-player denominator. The current NPB+ top speed is retained as the peak lane; acceleration/H2F, direct or standardized 90ft, historical short-distance, official MLB, ordinal/analog, and bounded context lanes remain semantically separate.

## Decision status

- Scale status: \`${SCALE_STATUS}\`
- Owner verdict input: none; \`owner_verdict_count=0\`
- PowerPro: posthoc QA only, never a feature or teacher
- The Show: full SP101 universe used as external context/trajectory/ordinal evidence; no direct numeric copy
- 30m/50m: native short-distance context only; no T90 conversion
- Current NPB+ H2F: unavailable; missingness is not treated as slow
- SP104 transfer: no production transfer; TF056/060/062 bounded context, TF057/058/059/061 no common support
- SP-080, SP-081, and shoulder work: not executed

## Frozen input and synthesis rules

Input manifest SHA-256 for the policy is \`${inputManifest.policy_sha256}\`. Physical construct families receive equal weight only among families with usable evidence. A peak-only result is therefore a transparent missingness state, not a hard-coded peak-dominant target. Every interval is rule-bounded and the 0–100 display is a monotone percentile mapping, not an engine-final calibration.

## Population summary

Evidence states: \`${JSON.stringify(states)}\`

Confidence: \`${JSON.stringify(confidence)}\`

## Component ablation

The following cells were actual reruns of the full synthesis function with one component removed; they are not relabel-only comparisons.

| Removed component | Cells | Changed players | Changed fraction |
|---|---:|---:|---:|
${changedSummary}

## First twelve rows by rank

| Rank | Player | Rating | Interval | Evidence state | Confidence |
|---:|---|---:|---:|---|---|
${rowLines}

## QA handoff

Generator preflight status: \`${qa.status}\`. The independent red-team audit is recorded separately in \`docs/audits/sp079_final_practical_reappraisal_independent_audit.md\`. The frozen manifest records source hashes, identity denominator, no-owner-write state, and all prohibited-input guards.
`;
}

function main() {
  fs.accessSync(POLICY_PATH, fs.constants.R_OK);
  const policy = readJson(INPUT_PATHS.policy);
  assert(policy.task_id === 'SP-079', 'policy task id mismatch');
  assert(policy.status === 'FROZEN_BEFORE_PLAYER_REAPPRAISAL', 'policy must be materialized before synthesis');
  assert(policy.synthesis?.weighting_rule === 'EQUAL_AVAILABLE_CONSTRUCT_FAMILIES', 'peak weighting policy is not frozen');
  assert(policy.qa_contract?.owner_verdict_count === 0, 'policy owner count is not zero');

  const sp100 = readJson(INPUT_PATHS.sp100);
  const sp101 = readJson(INPUT_PATHS.sp101);
  const sp101Show = readJson(INPUT_PATHS.sp101Show);
  const graph = readJson(INPUT_PATHS.sp101Graph);
  const canonicalRows = readJsonl(INPUT_PATHS.sp104Physical);
  const sp104State = readJson(INPUT_PATHS.sp104State);
  const transferPolicy = readJson(INPUT_PATHS.sp104TransferPolicy);
  const transferBenchmark = readJson(INPUT_PATHS.sp104TransferBenchmark);
  const receiptRows = readJsonl(INPUT_PATHS.sp104Receipts);
  const mlbRunningRows = officialRowsFromCsv(INPUT_PATHS.mlbRunning, 'RUNNING_SPLITS');
  const mlbExposureRows = officialRowsFromCsv(INPUT_PATHS.mlbExposure, 'SPRINT_EXPOSURE');
  const sp077 = readJson(INPUT_PATHS.sp077);
  const sp103UniverseRows = readText(INPUT_PATHS.sp103Universe).trim().split(/\r?\n/).slice(1).filter(Boolean);
  const sp103TraceabilityRows = readText(INPUT_PATHS.sp103Traceability).trim().split(/\r?\n/).slice(1).filter(Boolean);
  const sp103Gaps = readJson(INPUT_PATHS.sp103Gaps);
  const sp103Methods = readJson(INPUT_PATHS.sp103Methods);
  const ownerLedger = readJson(INPUT_PATHS.ownerLedger);
  const registryRows = parseRegistry(readText(INPUT_PATHS.registry));
  const master = readJson(INPUT_PATHS.baseline);

  assert(ownerLedger.owner_verdict_count === 0 && (ownerLedger.records?.length ?? 0) === 0, 'owner verdict ledger is non-empty');
  assert(sp100.players.length === 100 && sp101.players.length === 100 && sp101Show.players.length === 100, 'upstream current100 universe is not exact');
  assert(transferPolicy.production_use === false && transferPolicy.direct_numeric_promotion_allowed === false, 'SP104 production transfer guard failed');
  assert(!transferBenchmark.methods.some((method) => method.direct_numeric_promotion_allowed === true), 'SP104 benchmark promoted a transfer method');
  assert(sp104State.players.length === 100, 'SP104 before/after state is not exact current100');
  assert(sp077.players.length === 100, 'SP077 context universe is not exact current100');
  assert(sp103UniverseRows.length === 71, `SP103 evidence universe expected 71 rows, got ${sp103UniverseRows.length}`);
  assert(sp103TraceabilityRows.length === 76, `SP103 traceability expected 76 rows (61 requirements + 15 owner feedback), got ${sp103TraceabilityRows.length}`);
  assert(Array.isArray(sp103Gaps.gaps) && sp103Gaps.gaps.length === 28, 'SP103 gap plan count mismatch');
  assert(Array.isArray(sp103Methods.methods) && sp103Methods.methods.length === 19, 'SP103 inference method universe count mismatch');

  const sp100ByKey = new Map(sp100.players.map((row) => [row.stable_player_key, row]));
  const sp101ByKey = new Map(sp101.players.map((row) => [row.stable_player_key, row]));
  const showByKey = new Map(sp101Show.players.map((row) => [row.stable_player_key, row]));
  const stateByKey = new Map(sp104State.players.map((row) => [row.stable_player_key, row]));
  const queueByKey = new Map(sp077.players.map((row) => [row.identity.stable_player_key, row]));
  const receiptByKey = new Map(receiptRows.map((row) => [row.stable_player_key, row]));
  const byPlayer = (rows, playerAccessor = (row) => row.player) => new Map(rows.map((row) => [playerAccessor(row), row]));
  const sp101ByPlayer = byPlayer(sp101.players);
  const showByPlayer = byPlayer(sp101Show.players);
  const stateByPlayer = byPlayer(sp104State.players);
  const queueByPlayer = byPlayer(sp077.players, (row) => row.identity.player);
  const receiptByPlayer = byPlayer(receiptRows);
  const lookup = (byKey, byName, key, player) => byKey.get(key) ?? byName.get(player);
  const currentKeys = sp100.players.map((row) => row.stable_player_key);
  assert(sp100.players.every((row) => row.stable_player_key && lookup(sp101ByKey, sp101ByPlayer, row.stable_player_key, row.player) && lookup(showByKey, showByPlayer, row.stable_player_key, row.player) && lookup(queueByKey, queueByPlayer, row.stable_player_key, row.player)), 'current100 identity crosswalk incomplete');
  assert(new Set(currentKeys).size === 100, 'current100 stable keys are not unique');
  assert(sp100.players.every((row) => row.n_primary?.measurement_reliability === 'NOT_IDENTIFIABLE'), 'unexpected NPB+ reliability assumption');

  const canonicalByMetric = {};
  for (const row of canonicalRows) {
    const family = classifyCanonicalMetric(row);
    const interval = valueInterval(row);
    if (family && interval) {
      if (!canonicalByMetric[row.metric]) canonicalByMetric[row.metric] = [];
      canonicalByMetric[row.metric].push(interval.midpoint);
    }
  }
  const mlbRun90Values = mlbRunningRows.map((row) => finiteNumber(row.standardized_90ft_seconds)).filter(Number.isFinite);
  const mlbRunH2fValues = mlbRunningRows.map((row) => finiteNumber(row.raw_hp_to_1b_seconds)).filter(Number.isFinite);
  const mlbExposureH2fValues = mlbExposureRows.map((row) => finiteNumber(row.raw_hp_to_1b_seconds)).filter(Number.isFinite);
  const mlbDistributions = {
    standardized_90ft_seconds: mlbRun90Values,
    raw_hp_to_1b_seconds: [...mlbRunH2fValues, ...mlbExposureH2fValues]
  };
  const canonicalCandidates = chooseCanonicalDuplicates(canonicalRows.filter((row) => currentKeys.includes(row.stable_player_key) && classifyCanonicalMetric(row) && valueInterval(row)));
  const canonicalEvidence = canonicalCandidates.map((row) => recordFromCanonical(row, canonicalByMetric)).filter(Boolean);
  const runningEvidence = buildOfficialEvidence(mlbRunningRows, 'standardized_90ft_seconds', 'END_TO_END_90FT', mlbDistributions, 'MLB90');
  const runningH2fEvidence = buildOfficialEvidence(mlbRunningRows, 'raw_hp_to_1b_seconds', 'ACCELERATION_H2F', mlbDistributions, 'MLBH2F');
  const exposureH2fEvidence = buildOfficialEvidence(mlbExposureRows, 'raw_hp_to_1b_seconds', 'ACCELERATION_H2F', mlbDistributions, 'MLBEXPOSUREH2F');
  const officialEvidence = dedupeOfficial([...runningEvidence, ...runningH2fEvidence, ...exposureH2fEvidence].filter((record) => currentKeys.includes(record.stable_player_key)));
  const official90Seasons = new Set(officialEvidence.filter((record) => record.source_family === 'END_TO_END_90FT').map((record) => `${record.stable_player_key}|${record.measurement_year}`));
  for (const record of officialEvidence) {
    if (record.source_family === 'ACCELERATION_H2F' && official90Seasons.has(`${record.stable_player_key}|${record.measurement_year}`)) {
      record.used_in_point = false;
      record.evidence_role = 'OFFICIAL_RAW_H2F_CONTEXT_SEPARATE_FROM_90FT_SAME_PLAY_NOT_ADDITIVE';
      record.duplicate_guard = 'SAME_PLAYER_SEASON_SHARED_PLAY_NOT_ADDITIVE_WITH_90FT';
    }
  }
  const canonicalByKey = new Map();
  for (const row of canonicalEvidence) {
    if (!canonicalByKey.has(row.stable_player_key)) canonicalByKey.set(row.stable_player_key, []);
    canonicalByKey.get(row.stable_player_key).push({ ...row, family: row.source_family });
  }
  const officialByKey = new Map();
  for (const row of officialEvidence) {
    if (!officialByKey.has(row.stable_player_key)) officialByKey.set(row.stable_player_key, []);
    officialByKey.get(row.stable_player_key).push({ ...row, family: row.source_family });
  }

  const baselineById = new Map(master.rows.map((row) => [String(row.player_id), {
    gpt_codex_rating: finiteNumber(row.gpt_codex_rating),
    gpt_codex_low: finiteNumber(row.gpt_codex_low),
    gpt_codex_high: finiteNumber(row.gpt_codex_high),
    gpt_codex_confidence: row.gpt_codex_confidence ?? null
  }]));

  const baseRows = sp100.players.map((sp100Row) => makePlayerBase(
    sp100Row,
    lookup(sp101ByKey, sp101ByPlayer, sp100Row.stable_player_key, sp100Row.player),
    lookup(showByKey, showByPlayer, sp100Row.stable_player_key, sp100Row.player),
    lookup(stateByKey, stateByPlayer, sp100Row.stable_player_key, sp100Row.player),
    lookup(queueByKey, queueByPlayer, sp100Row.stable_player_key, sp100Row.player),
    canonicalByKey.get(sp100Row.stable_player_key) ?? [],
    officialByKey.get(sp100Row.stable_player_key) ?? [],
    graph,
    lookup(receiptByKey, receiptByPlayer, sp100Row.stable_player_key, sp100Row.player),
    baselineById.get(String(sp100Row.player_id))
  ));
  assert(baseRows.length === 100 && baseRows.every((row) => row.context), 'base evidence synthesis incomplete');

  const fullResults = baseRows.map((base) => {
    const result = synthesize(base);
    result.stable_player_key = base.stable_player_key;
    return result;
  });
  rankResults(fullResults);
  const ablation = buildAblation(baseRows, fullResults);
  const ablationCells = ablation.cells;
  assert(ablationCells.length === 800, 'ablation grid is not exactly 100 x 8');

  const fullRows = baseRows.map((base, index) => {
    const result = fullResults[index];
    const baseline = base.baseline;
    const preRows = {
      stable_player_key: base.stable_player_key,
      player: base.player,
      queue_order: index + 1,
      team: base.team,
      player_id: base.player_id,
      latent_speed_percentile_point: result.latent_speed_percentile_point,
      latent_speed_percentile_interval: result.latent_speed_percentile_interval,
      provisional_practical_rating: result.provisional_practical_rating,
      provisional_practical_rating_interval: result.provisional_practical_rating_interval,
      rank_fastest: result.rank_fastest,
      rank_percentile: result.rank_percentile,
      confidence: result.confidence,
      evidence_state: result.evidence_state,
      conflict_state: result.conflict_state,
      physical_family_count: result.physical_family_count,
      physical_family_weights: result.component_weights,
      missing_physical_lanes: base.context.missing_lanes,
      material_evidence_ids: unique(result.physical_family_summaries.flatMap((family) => family.evidence_ids)).slice(0, 40),
      reasons: makeEvidenceReason(result, base),
      material_conflicts: result.material_conflicts,
      missingness_policy: 'MISSING_IS_NOT_SLOW; MISSING_LANES_WIDEN_INTERVAL',
      missingness_is_not_slow: result.missingness_is_not_slow,
      change_vs_pre_sp079_project: result.provisional_practical_rating === null || baseline.pre_sp079_project_rating === null ? null : result.provisional_practical_rating - baseline.pre_sp079_project_rating,
      pre_sp079_project_rating_for_comparison_only: baseline.pre_sp079_project_rating,
      pre_sp079_project_interval_for_comparison_only: baseline.pre_sp079_project_interval,
      pre_sp079_project_confidence_for_comparison_only: baseline.pre_sp079_project_confidence,
      powerpro_difference_for_qa_only: null,
      powerpro_teacher_used: result.powerpro_teacher_used,
      the_show_direct_copy: result.the_show_direct_copy,
      direct_30m_50m_to_t90_conversion: result.direct_30m_50m_to_t90_conversion,
      target_self_teaching_or_season_leakage: result.target_self_teaching_or_season_leakage,
      technique_used_in_physical_point: result.technique_used_in_physical_point,
      scale_status: SCALE_STATUS,
      owner_verdict_state: 'NOT_ENTERED',
      owner_verdict_count: 0,
      upstream_lane_summary: {
        sp100_peak: base.sp100,
        canonical_physical_record_count: base.canonicalRecordCount,
        matched_mlb_standardized_90ft_record_count: base.mlb90Count,
        matched_mlb_raw_h2f_record_count: base.mlbH2fCount,
        the_show: base.context.show,
        analog: base.context.analog,
        transfer: base.context.transfer,
        technique: base.context.technique,
        age_injury: base.context.age_injury
      },
      synthesis_receipt: {
        recomputed_from_frozen_evidence: true,
        physical_family_summaries: result.physical_family_summaries,
        contextual_components_present: result.contextual_components_present,
        context_uncertainty_added: result.context_uncertainty_added,
        no_arithmetic_n_s_blend: true,
        no_powerpro_input: true,
        no_the_show_direct_copy: true,
        no_legacy_npb_plus_h2f: true,
        no_production_transfer: true
      }
    };
    return preRows;
  });

  const synthesisLines = baseRows.map((base, index) => ({
    schema_version: 'sp079_player_evidence_synthesis_v1',
    task_id: 'SP-079',
    queue_order: index + 1,
    stable_player_key: base.stable_player_key,
    player: base.player,
    team: base.team,
    physical_evidence: {
      sp100: base.sp100,
      records: base.physicalRecords,
      family_summaries: fullResults[index].physical_family_summaries,
      canonical_record_count: base.canonicalRecordCount,
      mlb_standardized_90ft_record_count: base.mlb90Count,
      mlb_raw_h2f_record_count: base.mlbH2fCount
    },
    external_and_context_evidence: base.context,
    sp101_context_receipt: base.sp101,
    sp104_state_receipt: base.state,
    final_synthesis: fullRows[index],
    excluded_from_point: [
      'PowerPro current/history',
      'The Show direct numeric copy',
      'legacy NPB+ H2F field',
      'stealing/BR aggression/lead/technique',
      '30m/50m to T90 transform',
      'owner verdict'
    ]
  }));

  const csvHeaders = [
    'queue_order', 'stable_player_key', 'player_id', 'player', 'team', 'latent_speed_percentile_point', 'latent_speed_percentile_interval', 'provisional_practical_rating', 'provisional_practical_rating_interval', 'rank_fastest', 'rank_percentile', 'confidence', 'evidence_state', 'conflict_state', 'physical_family_count', 'physical_family_weights', 'missing_physical_lanes', 'material_evidence_ids', 'reasons', 'material_conflicts', 'change_vs_pre_sp079_project', 'pre_sp079_project_rating_for_comparison_only', 'powerpro_difference_for_qa_only', 'scale_status', 'owner_verdict_state', 'owner_verdict_count'
  ];
  const csvRows = fullRows.map((row, index) => ({
    ...row,
    queue_order: index + 1,
    latent_speed_percentile_interval: JSON.stringify(row.latent_speed_percentile_interval),
    provisional_practical_rating_interval: JSON.stringify(row.provisional_practical_rating_interval),
    physical_family_weights: JSON.stringify(row.physical_family_weights),
    missing_physical_lanes: JSON.stringify(row.missing_physical_lanes),
    material_evidence_ids: JSON.stringify(row.material_evidence_ids),
    reasons: JSON.stringify(row.reasons),
    material_conflicts: JSON.stringify(row.material_conflicts)
  }));

  const inputData = {
    sp103UniverseRows: sp103UniverseRows.length,
    sp103TraceabilityRows: sp103TraceabilityRows.length,
    canonicalRows: canonicalRows.length,
    mlbRunningRows: mlbRunningRows.length,
    mlbExposureRows: mlbExposureRows.length,
    sp101ShowRows: sp101Show.players.length,
    sp104Receipts: receiptRows.length,
    sp104TransferPolicy: transferPolicy
  };
  const inputManifest = buildManifest(inputData, ownerLedger, registryRows, currentKeys, baseRows);
  const internalQa = buildInternalQa(baseRows, fullRows, ablationCells, policy, ownerLedger, registryRows, inputData);
  assert(internalQa.status === 'PASS_PRE_INDEPENDENT_QA', 'internal QA failed before writing canonical outputs');

  writeJson('outputs/derived/sp079_frozen_input_manifest.json', inputManifest);
  writeText('outputs/derived/sp079_player_evidence_synthesis.jsonl', `${synthesisLines.map((row) => JSON.stringify(row)).join('\n')}\n`);
  writeJson('outputs/derived/sp079_final_practical_speed_100.json', {
    schema_version: 'sp079_final_practical_speed_100_v1',
    task_id: 'SP-079',
    status: 'GENERATED_FOR_INDEPENDENT_QA',
    generated_at: '2026-08-25',
    population: { denominator: 100, current100_cohort_relative: true, final_engine_calibration: false },
    policy_sha256: inputManifest.policy_sha256,
    owner_verdict_count: 0,
    owner_verdicts_written: false,
    scale_status: SCALE_STATUS,
    players: fullRows,
    guards: {
      powerpro_teacher_used: false,
      the_show_direct_copy: false,
      legacy_npb_plus_h2f_used: false,
      short_distance_to_t90_conversion: false,
      missingness_as_slow: false,
      target_self_teaching_or_season_leakage: false,
      technique_as_pure_speed: false,
      selected_production_transfer: false,
      peak_weighting: 'EQUAL_AVAILABLE_CONSTRUCT_FAMILIES'
    }
  });
  writeJson('outputs/derived/sp079_final_value_component_ablation.json', ablation);
  const powerproPosthoc = buildPowerproPosthoc(master, fullRows);
  writeJson('outputs/derived/sp079_powerpro_posthoc_qa.json', powerproPosthoc);
  const posthocByKey = new Map(powerproPosthoc.rows.map((row) => [row.stable_player_key, row.difference_final_minus_powerpro]));
  const frozenFinalJson = readJson('outputs/derived/sp079_final_practical_speed_100.json');
  frozenFinalJson.players = frozenFinalJson.players.map((row) => ({
    ...row,
    powerpro_difference_for_qa_only: posthocByKey.get(row.stable_player_key) ?? null,
    powerpro_qa_attached_after_core_values_frozen: true
  }));
  writeJson('outputs/derived/sp079_final_practical_speed_100.json', frozenFinalJson);
  for (const row of csvRows) row.powerpro_difference_for_qa_only = posthocByKey.get(row.stable_player_key) ?? null;
  writeText('outputs/derived/sp079_final_practical_speed_100.csv', toCsv(csvRows, csvHeaders));
  writeJson('outputs/derived/sp079_global_consistency_qa.json', internalQa);
  writeText('docs/reports/sp079_final_practical_speed_100.md', buildReport(fullRows, ablation, powerproPosthoc, internalQa, inputManifest));

  const peak = baseRows.map((base) => base.sp100.peak_percentile);
  const finalPoint = fullRows.map((row) => row.latent_speed_percentile_point);
  const peakOnlyCount = fullRows.filter((row) => row.physical_family_count === 1).length;
  const nonPeakEligible = fullRows.filter((row) => row.physical_family_count > 1).length;
  const nonPeakChangedByPeakRemoval = ablation.cells.filter((cell) => cell.removed_component === 'peak_speed' && cell.component_available_in_full && cell.changed_fields.length > 0).length;
  const diagnostic = {
    current100_peak_correlation_pearson: correlation(peak, finalPoint),
    current100_peak_correlation_spearman: correlation(ranks(peak), ranks(finalPoint)),
    final_rank_peak_correlation_spearman: correlation(ranks(peak), ranks(finalPoint)),
    peak_only_player_count: peakOnlyCount,
    peak_removal_non_peak_eligible_count: nonPeakEligible,
    peak_removal_changed_player_count: nonPeakChangedByPeakRemoval,
    hard_coded_peak_weight: false,
    interpretation: 'Descriptive diagnostics only; no target correlation or peak-dominance objective was optimized.'
  };
  const finalJson = readJson('outputs/derived/sp079_final_practical_speed_100.json');
  finalJson.top_speed_dominance_diagnostic = diagnostic;
  writeJson('outputs/derived/sp079_final_practical_speed_100.json', finalJson);
  writeJson('outputs/derived/sp079_global_consistency_qa.json', { ...internalQa, top_speed_dominance_diagnostic: diagnostic });

  console.log(JSON.stringify({
    status: 'GENERATED_FOR_INDEPENDENT_QA',
    players: fullRows.length,
    ablation_cells: ablationCells.length,
    physical_family_counts: fullRows.reduce((acc, row) => { acc[row.physical_family_count] = (acc[row.physical_family_count] ?? 0) + 1; return acc; }, {}),
    evidence_states: fullRows.reduce((acc, row) => { acc[row.evidence_state] = (acc[row.evidence_state] ?? 0) + 1; return acc; }, {}),
    peak_only_count: peakOnlyCount,
    peak_removal_changed_count: nonPeakChangedByPeakRemoval,
    owner_verdict_count: 0,
    scale_status: SCALE_STATUS
  }, null, 2));
}

main();

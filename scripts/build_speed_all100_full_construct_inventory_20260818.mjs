// Build a compact, review-only inventory for all 100 SP-077 speed rows.
// This script never creates an owner verdict or an SP-079 final rating.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json';
const LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';
const OUT_JSON = 'outputs/derived/speed_all100_full_construct_inventory_20260818.json';
const OUT_SUMMARY = 'docs/reports/speed_all100_full_construct_inventory_20260818.md';
const PART_PREFIX = 'docs/reports/speed_all100_full_construct_inventory_20260818_part';

const full = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(full(rel), 'utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const asArray = value => Array.isArray(value) ? value : [];
const val = value => value == null ? null : value;
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const fmt = value => value == null ? '—' : String(value);
const atomicWrite = (rel, body) => {
  const target = full(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temp, body, 'utf8');
  fs.renameSync(temp, target);
};

const queueBytes = fs.readFileSync(full(QUEUE));
const queue = JSON.parse(queueBytes.toString('utf8'));
const ledger = JSON.parse(read(LEDGER));
if (queue?.schema_version !== 'sp077_construct_complete_owner_review_queue_20260817') throw new Error('wrong queue schema');
if (!Array.isArray(queue.players) || queue.players.length !== 100) throw new Error('queue is not exact 100');
if (!Array.isArray(ledger.records) || ledger.records.length !== 0 || Number(ledger.owner_verdict_count) !== 0) {
  throw new Error('SP-078 is not empty; review inventory must not overwrite owner history');
}
if (ledger?.queue_source?.sha256 !== sha256(queueBytes)) throw new Error('SP-078 queue binding hash mismatch');

const compactPhysical = record => ({
  year: val(record?.measurement_year),
  temporal_distance_from_2026: val(record?.temporal_distance_years_from_2026),
  metric: val(record?.metric),
  seconds: val(record?.seconds),
  value: val(record?.value),
  unit: val(record?.unit),
  confidence: val(record?.confidence),
  usage_class: val(record?.usage_class),
  timing_method: val(record?.timing_method),
  start_protocol: val(record?.start_protocol),
  source_tier: val(record?.source_tier),
  source_name: val(record?.source_name),
  numeric_t90_usable: record?.numeric_t90_usable === true,
  carryover_role: val(record?.carryover_role),
});
const compactH2f = lane => lane ? ({
  seconds: val(lane.seconds),
  z: val(lane.z_within_sample_lower_is_faster),
  n_independent_records: val(lane.n_independent_records),
  n_raw_records: val(lane.n_raw_records),
  handedness: val(lane.handedness),
  confidence: val(lane.confidence),
  lane: val(lane.lane),
  sources: asArray(lane.sources),
}) : null;
const compactCommunity = row => ({
  record_id: val(row?.record_id),
  date: val(row?.source_date),
  disposition: val(row?.disposition),
  direction: val(row?.direction),
  speed_concept: val(row?.speed_concept),
  text: val(row?.text),
  url: val(row?.url),
  usable_for_current100: row?.usable_for_current100 === true,
});

function recordYearClass(record) {
  const year = num(record?.year);
  if (year == null) return 'UNKNOWN_YEAR';
  if (year >= 2024) return 'RECENT_2024_2026';
  if (year >= 2021) return 'INTERMEDIATE_2021_2023';
  return 'OLD_PRE_2021';
}
function metricKind(record) {
  const text = `${record?.metric ?? ''}`.toUpperCase();
  if (/T10|10FT|10 FT/.test(text)) return 'ACCELERATION_T10';
  if (/T30|30FT|30 FT/.test(text)) return 'ACCELERATION_T30';
  if (/T90|90FT|90 FT|HOME.*FIRST|一塁到達/.test(text)) return 'END_TO_END_T90';
  if (/30M|50M|10M|20M|40M|60YD|60-YARD/.test(text)) return 'SHORT_DISTANCE_PROFILE';
  if (/SPRINT_SPEED/.test(text)) return 'PEAK_OR_COMPLETE_RUN_CONTEXT';
  if (/HP_TO_1B|H2F/.test(text)) return 'END_TO_END_H2F';
  return 'OTHER_PHYSICAL';
}
function physicalRecordSummary(records) {
  return records.map(record => ({ ...record, kind: metricKind(record), year_class: recordYearClass(record) }));
}
function evidenceClass(row) {
  const hasNormalH2f = Boolean(row.acceleration_h2f_t90.normal_swing_h2f);
  const hasBuntH2f = Boolean(row.acceleration_h2f_t90.bunt_h2f);
  const t90 = row.acceleration_h2f_t90.direct_or_standardized_t90_records;
  const short = row.short_distance.records;
  const recentEndToEnd = t90.some(r => r.year_class === 'RECENT_2024_2026');
  const recentShort = short.some(r => r.year_class === 'RECENT_2024_2026');
  const anyEndToEnd = hasNormalH2f || hasBuntH2f || t90.length > 0;
  const anyShort = short.length > 0;
  const distinctPhysicalDimensions = 1 + (anyEndToEnd ? 1 : 0) + (anyShort ? 1 : 0);
  if (row.powerpro_review.raw_last == null) return {
    class: 'NO_CURRENT_POWERPRO_TARGET', distinct_physical_dimensions: distinctPhysicalDimensions,
    recent_non_peak_dimension: recentEndToEnd || recentShort,
  };
  if (recentEndToEnd || recentShort) return {
    class: 'CURRENT_PEAK_PLUS_RECENT_NON_PEAK_PHYSICAL', distinct_physical_dimensions: distinctPhysicalDimensions,
    recent_non_peak_dimension: true,
  };
  if (anyEndToEnd || anyShort) return {
    class: 'CURRENT_PEAK_PLUS_NONCURRENT_OR_UNKNOWN_NON_PEAK_PHYSICAL', distinct_physical_dimensions: distinctPhysicalDimensions,
    recent_non_peak_dimension: false,
  };
  return {
    class: 'CURRENT_PEAK_ONLY_DIRECT_PHYSICAL', distinct_physical_dimensions: 1,
    recent_non_peak_dimension: false,
  };
}
function compact(row) {
  const a = row.acceleration_h2f_t90_evidence ?? {};
  const short = row.short_distance_physical_evidence ?? {};
  const hist = row.historical_physical_temporal_context ?? {};
  const s = row.statistical_proxy_context ?? {};
  const game = row.game_context_proxy_breakdown ?? {};
  const community = row.community_physical_context ?? {};
  const pp = row.powerpro_review_context?.stale_detector ?? null;
  const t90Records = physicalRecordSummary(asArray(a.direct_or_standardized_t90_records).map(compactPhysical));
  const shortRecords = physicalRecordSummary(asArray(short.records).map(compactPhysical));
  const historicalRecords = physicalRecordSummary(asArray(hist.records).map(compactPhysical));
  const compacted = {
    queue_order: row.queue_order,
    queue_row_key: row.queue_row_key,
    player: row.identity?.player ?? null,
    team: row.identity?.team ?? null,
    stable_player_key: row.identity?.stable_player_key ?? null,
    identity_status: row.identity?.identity_status ?? null,
    batting_coverage: row.identity?.batting_coverage ?? null,
    top_speed: {
      state: row.top_speed_evidence?.evidence_state ?? null,
      kmh: num(row.top_speed_evidence?.npb_plus_top_speed_kmh),
      z: num(row.top_speed_evidence?.z),
      rank_current100: num(row.top_speed_evidence?.rank),
      exposure_context: row.top_speed_evidence?.exposure_context ?? null,
      reliability: row.top_speed_evidence?.reliability ?? null,
      role: row.top_speed_evidence?.role ?? null,
    },
    acceleration_h2f_t90: {
      state: a.evidence_state ?? null,
      normal_swing_h2f: compactH2f(a.normal_swing_h2f),
      bunt_h2f: compactH2f(a.bunt_h2f),
      direct_or_standardized_t90_records: t90Records,
      missingness: a.missingness ?? null,
    },
    short_distance: {
      state: short.evidence_state ?? null,
      records: shortRecords,
      missingness: short.missingness ?? null,
    },
    historical_physical: {
      state: hist.evidence_state ?? null,
      records: historicalRecords,
      current_carryover_policy: hist.current_carryover_policy ?? null,
      missingness: hist.missingness ?? null,
    },
    statistical_proxy: {
      state: s.state ?? null,
      value_z: num(s.value_z),
      reliability: num(s.reliability),
      pa_2025: num(s.pa_2025),
      quality: s.quality ?? null,
      role: s.role ?? null,
    },
    game_context_proxy: {
      state: game.evidence_state ?? null,
      legacy_composite_score_context_only: num(game.legacy_composite_score_context_only),
      components_z: game.z ?? null,
      sample: game.sample ?? null,
      role: game.role ?? null,
      missing_reason: game.missing_reason ?? null,
    },
    community: {
      state: community.evidence_state ?? null,
      physical: asArray(community.physical_observation_rows).map(compactCommunity),
      technique: asArray(community.technique_context_rows).map(compactCommunity),
      powerpro_rating: asArray(community.powerpro_rating_context_rows).map(compactCommunity),
      role: community.role ?? null,
    },
    powerpro_review: {
      state: row.powerpro_review_context?.evidence_state ?? null,
      raw_last: num(pp?.powerpro_raw_last),
      percentile: num(pp?.powerpro_pct),
      physical_percentile_reference: num(pp?.latent_physical_pct),
      percentile_gap: num(pp?.percentile_gap),
      changes: pp?.powerpro_raw_changes ?? null,
      years: pp?.powerpro_years ?? null,
      flag: pp?.flag ?? null,
      s1_internal_inertia: pp?.s1_internal_inertia ?? null,
      s2_external_disagreement: pp?.s2_external_disagreement ?? null,
      role: row.powerpro_review_context?.allowed_role ?? null,
    },
    lane_states: row.missingness_and_provenance_contract?.lane_states ?? null,
    owner_verdict: row.owner_verdict ?? null,
  };
  compacted.reviewability = evidenceClass(compacted);
  compacted.review_guard = compacted.reviewability.class === 'CURRENT_PEAK_ONLY_DIRECT_PHYSICAL'
    ? 'TOP_SPEED_ALONE_CANNOT_SUPPORT_STRONG_WHOLE_CONSTRUCT_VERDICT'
    : compacted.reviewability.class === 'NO_CURRENT_POWERPRO_TARGET'
      ? 'NO_POWERPRO_COMPARISON_VERDICT_AVAILABLE'
      : 'NON_PEAK_PHYSICAL_DIMENSION_PRESENT; TEMPORAL_RELEVANCE_STILL_REQUIRES_REVIEW';
  return compacted;
}

const rows = queue.players.map(compact).sort((a, b) => a.queue_order - b.queue_order);
if (rows.length !== 100 || new Set(rows.map(r => r.queue_row_key)).size !== 100) throw new Error('inventory population mismatch');
if (rows.some(r => r.owner_verdict?.verdict != null || r.owner_verdict?.status !== 'NOT_ENTERED')) {
  throw new Error('owner verdict contamination');
}

const classes = {};
for (const row of rows) classes[row.reviewability.class] = (classes[row.reviewability.class] ?? 0) + 1;
const output = {
  schema_version: 'speed_all100_full_construct_inventory_20260818',
  generated_at: '2026-08-18',
  source_queue: QUEUE,
  source_queue_sha256: sha256(queueBytes),
  owner_ledger: LEDGER,
  owner_verdict_count: 0,
  purpose: 'Compact all-100 evidence inventory for human full-construct review. No verdict and no final SP-079 rating.',
  construct_definition: 'physical running ability from first running step to about 90ft: initial acceleration + peak speed + speed maintenance/end-to-end performance',
  decision_guard: 'Current NPB+ peak speed alone cannot support a strong whole-construct verdict. Missing acceleration/maintenance is missingness, not negative evidence.',
  population: { expected: 100, emitted: rows.length, unique_queue_keys: new Set(rows.map(r => r.queue_row_key)).size },
  reviewability_class_counts: classes,
  players: rows,
};
atomicWrite(OUT_JSON, JSON.stringify(output, null, 2) + '\n');

const metricList = records => records.length
  ? records.slice(0, 6).map(r => `${r.year ?? '?'}:${r.metric ?? '?'}=${r.seconds ?? r.value ?? '?'}${r.unit ? r.unit : ''}[${r.confidence ?? '?'}]`).join(' / ') + (records.length > 6 ? ` / +${records.length - 6}` : '')
  : '—';
const h2fText = h => h ? `${fmt(h.seconds)}s${h.z == null ? '' : ` z=${Number(h.z).toFixed(2)}`}` : '—';
const communityText = rows => rows.length ? rows.slice(0, 3).map(r => `${r.date ?? '?'}:${r.text ?? ''}`).join(' / ') : '—';
function playerBlock(row) {
  return [
    `### ${row.queue_order}. ${row.player}（${row.team ?? '—'}）`,
    '',
    `- **PowerPro:** ${fmt(row.powerpro_review.raw_last)} / flag=${fmt(row.powerpro_review.flag)} / gap=${fmt(row.powerpro_review.percentile_gap)}`,
    `- **Peak speed:** ${fmt(row.top_speed.kmh)} km/h / rank ${fmt(row.top_speed.rank_current100)} / z=${row.top_speed.z == null ? '—' : row.top_speed.z.toFixed(3)} / exposure=${JSON.stringify(row.top_speed.exposure_context)}`,
    `- **Acceleration/end-to-end:** normal H2F=${h2fText(row.acceleration_h2f_t90.normal_swing_h2f)}; bunt=${h2fText(row.acceleration_h2f_t90.bunt_h2f)}; T10/T30/T90=${metricList(row.acceleration_h2f_t90.direct_or_standardized_t90_records)}`,
    `- **Short-distance:** ${metricList(row.short_distance.records)}`,
    `- **Historical physical:** ${metricList(row.historical_physical.records)}`,
    `- **S context:** state=${fmt(row.statistical_proxy.state)}, z=${fmt(row.statistical_proxy.value_z)}, reliability=${fmt(row.statistical_proxy.reliability)}, PA=${fmt(row.statistical_proxy.pa_2025)}`,
    `- **Game context:** state=${fmt(row.game_context_proxy.state)}, composite=${fmt(row.game_context_proxy.legacy_composite_score_context_only)}, components=${JSON.stringify(row.game_context_proxy.components_z)}`,
    `- **Community physical:** ${communityText(row.community.physical)}`,
    `- **Community technique:** ${communityText(row.community.technique)}`,
    `- **Reviewability:** ${row.reviewability.class}; physical dimensions=${row.reviewability.distinct_physical_dimensions}; guard=${row.review_guard}`,
    '',
  ];
}

const summary = [
  '# Speed all-100 full-construct review inventory — 2026-08-18',
  '',
  'Status: **EVIDENCE INVENTORY ONLY — NO OWNER VERDICTS**',
  '',
  `- Source queue: \`${QUEUE}\``,
  `- Queue SHA-256: \`${output.source_queue_sha256}\``,
  '- Population: 100/100 unique rows.',
  '- Construct: initial acceleration + peak speed + speed maintenance/end-to-end performance to about 90ft.',
  '- Current NPB+ peak speed alone cannot produce a strong high/low verdict.',
  '- S/game/Community are context only; technique remains separate.',
  '- SP-078 owner verdict count remains 0.',
  '',
  '## Reviewability classes',
  '',
  ...Object.entries(classes).sort().map(([key, count]) => `- ${key}: ${count}`),
  '',
  '## Parts',
  '',
  '- Part 1: queue order 1–25',
  '- Part 2: queue order 26–50',
  '- Part 3: queue order 51–75',
  '- Part 4: queue order 76–100',
  '',
].join('\n');
atomicWrite(OUT_SUMMARY, summary);

for (let part = 0; part < 4; part++) {
  const slice = rows.slice(part * 25, part * 25 + 25);
  const body = [
    `# Speed all-100 full-construct inventory — Part ${part + 1}`,
    '',
    `Queue order: ${part * 25 + 1}–${part * 25 + 25}`,
    '',
    '> Evidence only. No owner verdict. Peak speed is one dimension, not the whole construct.',
    '',
    ...slice.flatMap(playerBlock),
  ].join('\n');
  atomicWrite(`${PART_PREFIX}${part + 1}.md`, body + '\n');
}

console.log(JSON.stringify({
  status: 'PASS',
  players: rows.length,
  queue_sha256: output.source_queue_sha256,
  reviewability_class_counts: classes,
  outputs: [OUT_JSON, OUT_SUMMARY, ...[1,2,3,4].map(i => `${PART_PREFIX}${i}.md`)],
  owner_verdict_count: 0,
}, null, 2));

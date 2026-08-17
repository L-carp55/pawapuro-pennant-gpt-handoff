import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'data/normalized/speed_historical_physical_measurements_2015_2026.json';
const QUEUE = 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json';
const REPORT = 'docs/reports/sp077_construct_complete_owner_review_queue_20260817.md';
const full = p => path.join(ROOT, p);
const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const src = JSON.parse(fs.readFileSync(full(SOURCE), 'utf8'));
const q = JSON.parse(fs.readFileSync(full(QUEUE), 'utf8'));
if (q?.schema_version !== 'sp077_construct_complete_owner_review_queue_20260817' || q?.players?.length !== 100) {
  throw new Error('construct-complete queue missing or wrong schema');
}
const acceptedRaw = (src.records ?? []).filter(r => r.bank_acceptance_status === 'ACCEPTED_HIGH_CONFIDENCE');
const groups = new Map();
for (const r of acceptedRaw) {
  const key = r.selected_anchor_id || r.same_measurement_cluster_id || r.raw_id;
  if (!key) throw new Error(`accepted high-confidence row lacks dedup key: ${r.raw_id ?? 'unknown'}`);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}
if (acceptedRaw.length !== 140 || groups.size !== 113) {
  throw new Error(`SP-021 baseline drift: accepted_raw=${acceptedRaw.length}, dedup_anchors=${groups.size}; expected 140/113`);
}
const compact = r => ({
  raw_id: r.raw_id ?? null,
  player: r.player ?? null,
  measurement_date: r.measurement_date ?? null,
  measurement_year: r.measurement_year ?? null,
  metric: r.metric ?? null,
  value: r.value ?? null,
  unit: r.unit ?? null,
  timing_method: r.timing_method ?? null,
  start_protocol: r.start_protocol ?? null,
  evidence_class: r.evidence_class ?? null,
  source_tier: r.source_tier ?? null,
  source_name: r.source_name ?? null,
  source_url: r.source_url ?? null,
  same_measurement_cluster_id: r.same_measurement_cluster_id ?? null,
  bank_acceptance_status: r.bank_acceptance_status,
});
const byPlayer = new Map();
for (const [anchorId, rawRows] of groups) {
  const players = [...new Set(rawRows.map(r => norm(r.player)))];
  if (players.length !== 1) throw new Error(`cross-player high-confidence anchor ${anchorId}: ${players.join(',')}`);
  const k = players[0];
  if (!byPlayer.has(k)) byPlayer.set(k, []);
  byPlayer.get(k).push({
    anchor_id: anchorId,
    raw_record_count: rawRows.length,
    records: rawRows.map(compact),
  });
}
let current100AnchorCount = 0;
let current100PlayerCount = 0;
let current100RawRecordCount = 0;
for (const row of q.players) {
  const anchors = byPlayer.get(norm(row.identity?.player)) ?? [];
  current100AnchorCount += anchors.length;
  current100RawRecordCount += anchors.reduce((s,a)=>s+a.raw_record_count,0);
  if (anchors.length) current100PlayerCount += 1;
  row.sp021_high_confidence_anchor_context = anchors.length ? {
    evidence_state: 'AVAILABLE_HIGH_CONFIDENCE_HISTORICAL_ANCHOR',
    anchor_count: anchors.length,
    raw_record_count: anchors.reduce((s,a)=>s+a.raw_record_count,0),
    anchors,
    role: 'DIRECT_OR_STANDARDIZED_PHYSICAL_ANCHOR; CURRENT_CARRYOVER_NOT_AUTOMATIC',
    current_carryover_policy: 'Use for current appraisal only with explicit temporal bridge such as low current sample, injury/recovery, underperformance, or measurement-time reconciliation.',
    provenance: SOURCE,
  } : {
    evidence_state: 'MISSING_BOUNDED',
    anchor_count: 0,
    raw_record_count: 0,
    anchors: [],
    reason: 'NO_ACCEPTED_HIGH_CONFIDENCE_SP021_ANCHOR_FOR_THIS_CURRENT100_PLAYER',
    no_negative_inference: true,
    provenance: SOURCE,
  };
  row.missingness_and_provenance_contract ??= { lane_states: {} };
  row.missingness_and_provenance_contract.lane_states ??= {};
  row.missingness_and_provenance_contract.lane_states.sp021_high_confidence_anchor = anchors.length
    ? 'AVAILABLE_HIGH_CONFIDENCE_HISTORICAL_ANCHOR' : 'MISSING_BOUNDED';
}
if (current100AnchorCount !== 7 || current100PlayerCount !== 7 || current100RawRecordCount !== 7) {
  throw new Error(`current100 SP-021 overlap drift: anchors=${current100AnchorCount}, players=${current100PlayerCount}, raw=${current100RawRecordCount}; expected 7/7/7`);
}
q.required_lane_fields = [...new Set([...(q.required_lane_fields ?? []), 'sp021_high_confidence_anchor_context'])];
q.sp021_anchor_bank_summary = {
  source: SOURCE,
  raw_inventory_records: (src.records ?? []).length,
  accepted_high_confidence_raw_records: acceptedRaw.length,
  deduplicated_high_confidence_anchors: groups.size,
  current100_anchor_count: current100AnchorCount,
  current100_raw_record_count: current100RawRecordCount,
  current100_player_count: current100PlayerCount,
  current100_players: q.players.filter(r => r.sp021_high_confidence_anchor_context.anchor_count > 0).map(r => r.identity.player),
};
fs.writeFileSync(full(QUEUE), JSON.stringify(q, null, 2) + '\n');
let report = fs.readFileSync(full(REPORT), 'utf8').replace(/\n## SP-021 high-confidence anchors[\s\S]*$/m, '');
report += `\n## SP-021 high-confidence anchors\n\n- Source inventory: ${(src.records ?? []).length} records.\n- ACCEPTED_HIGH_CONFIDENCE: ${acceptedRaw.length} raw records.\n- Grouped by selected_anchor_id / measurement cluster: ${groups.size} anchors.\n- Current-100 overlap: ${current100AnchorCount} anchors / ${current100RawRecordCount} raw records / ${current100PlayerCount} players.\n- Multi-row anchors preserve every accepted raw record; no row is silently chosen or discarded.\n- These are historical/physical anchors, not automatic current-year carryover values.\n`;
fs.writeFileSync(full(REPORT), report);
console.log(JSON.stringify({sp021_augmented:true, accepted_raw:acceptedRaw.length, anchor_groups:groups.size, current100_anchors:current100AnchorCount, current100_raw:current100RawRecordCount, current100_players:current100PlayerCount}));

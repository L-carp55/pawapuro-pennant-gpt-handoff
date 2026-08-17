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
const dedup = new Map();
for (const r of acceptedRaw) {
  const key = r.selected_anchor_id || r.same_measurement_cluster_id || r.raw_id;
  if (!key) throw new Error(`accepted high-confidence row lacks dedup key: ${r.raw_id ?? 'unknown'}`);
  if (!dedup.has(key)) dedup.set(key, r);
  else {
    const a = dedup.get(key);
    if (norm(a.player) !== norm(r.player) || a.metric !== r.metric || Number(a.value) !== Number(r.value)) {
      throw new Error(`conflicting rows within anchor ${key}`);
    }
  }
}
if (acceptedRaw.length !== 140 || dedup.size !== 113) {
  throw new Error(`SP-021 baseline drift: accepted_raw=${acceptedRaw.length}, dedup_anchors=${dedup.size}; expected 140/113`);
}
const byPlayer = new Map();
for (const [anchorId, r] of dedup) {
  const k = norm(r.player);
  if (!byPlayer.has(k)) byPlayer.set(k, []);
  byPlayer.get(k).push({
    anchor_id: anchorId,
    raw_id: r.raw_id ?? null,
    player: r.player,
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
}
let current100AnchorCount = 0;
let current100PlayerCount = 0;
for (const row of q.players) {
  const rows = byPlayer.get(norm(row.identity?.player)) ?? [];
  current100AnchorCount += rows.length;
  if (rows.length) current100PlayerCount += 1;
  row.sp021_high_confidence_anchor_context = rows.length ? {
    evidence_state: 'AVAILABLE_HIGH_CONFIDENCE_HISTORICAL_ANCHOR',
    anchor_count: rows.length,
    records: rows,
    role: 'DIRECT_OR_STANDARDIZED_PHYSICAL_ANCHOR; CURRENT_CARRYOVER_NOT_AUTOMATIC',
    current_carryover_policy: 'Use for current appraisal only with explicit temporal bridge such as low current sample, injury/recovery, underperformance, or measurement-time reconciliation.',
    provenance: SOURCE,
  } : {
    evidence_state: 'MISSING_BOUNDED',
    anchor_count: 0,
    records: [],
    reason: 'NO_ACCEPTED_HIGH_CONFIDENCE_SP021_ANCHOR_FOR_THIS_CURRENT100_PLAYER',
    no_negative_inference: true,
    provenance: SOURCE,
  };
  row.missingness_and_provenance_contract ??= { lane_states: {} };
  row.missingness_and_provenance_contract.lane_states ??= {};
  row.missingness_and_provenance_contract.lane_states.sp021_high_confidence_anchor = rows.length
    ? 'AVAILABLE_HIGH_CONFIDENCE_HISTORICAL_ANCHOR' : 'MISSING_BOUNDED';
}
if (current100AnchorCount !== 7 || current100PlayerCount !== 7) {
  throw new Error(`current100 SP-021 overlap drift: anchors=${current100AnchorCount}, players=${current100PlayerCount}; expected 7/7`);
}
q.required_lane_fields = [...new Set([...(q.required_lane_fields ?? []), 'sp021_high_confidence_anchor_context'])];
q.sp021_anchor_bank_summary = {
  source: SOURCE,
  raw_inventory_records: (src.records ?? []).length,
  accepted_high_confidence_raw_records: acceptedRaw.length,
  deduplicated_high_confidence_anchors: dedup.size,
  current100_anchor_count: current100AnchorCount,
  current100_player_count: current100PlayerCount,
  current100_players: q.players.filter(r => r.sp021_high_confidence_anchor_context.anchor_count > 0).map(r => r.identity.player),
};
fs.writeFileSync(full(QUEUE), JSON.stringify(q, null, 2) + '\n');
let report = fs.readFileSync(full(REPORT), 'utf8').replace(/\n## SP-021 high-confidence anchors[\s\S]*$/m, '');
report += `\n## SP-021 high-confidence anchors\n\n- Source inventory: ${(src.records ?? []).length} records.\n- ACCEPTED_HIGH_CONFIDENCE: ${acceptedRaw.length} raw records.\n- Deduplicated by selected_anchor_id / measurement cluster: ${dedup.size} anchors.\n- Current-100 overlap: ${current100AnchorCount} anchors / ${current100PlayerCount} players.\n- These are historical/physical anchors, not automatic current-year carryover values.\n`;
fs.writeFileSync(full(REPORT), report);
console.log(JSON.stringify({sp021_augmented:true, accepted_raw:acceptedRaw.length, dedup_anchors:dedup.size, current100_anchors:current100AnchorCount, current100_players:current100PlayerCount}));

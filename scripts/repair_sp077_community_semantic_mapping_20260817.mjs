// Repair SP-077 Community semantic mapping to the canonical clean-X schema.
// Exact bounded source rewrite: replaces only splitCommunity().
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'scripts/build_sp077_construct_complete_owner_review_queue_20260817.mjs');
const before = fs.readFileSync(TARGET, 'utf8');
const start = before.indexOf('function splitCommunity(nameKey, oldCommunity) {');
const endMarker = '\n\nconst players = oldQueue.players.map(row => {';
const end = before.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('splitCommunity bounded replacement markers not found');
const replacement = `function splitCommunity(nameKey, oldCommunity) {
  const allRows = xByName.get(nameKey) ?? [];
  const ACTIVE = new Set(['CURRENT_POWERPRO_RATING', 'CURRENT_REALWORLD_SPEED_PHYSICAL', 'CURRENT_TECHNIQUE_CONTEXT']);
  // SP-075 active X policy: owner-filtered disposition + current-100 usable row.
  // Do not reactivate comparison-only/excluded rows merely because they exist in the clean file.
  const rows = allRows.filter(r => r.current_100 === true
    && r.usable_for_current100 === true
    && ACTIVE.has(String(r.owner_disposition ?? '')));
  const physicalRows = rows.filter(r => r.owner_disposition === 'CURRENT_REALWORLD_SPEED_PHYSICAL');
  const techniqueRows = rows.filter(r => r.owner_disposition === 'CURRENT_TECHNIQUE_CONTEXT');
  const ratingRows = rows.filter(r => r.owner_disposition === 'CURRENT_POWERPRO_RATING');
  const compact = r => ({
    record_id: r.record_id ?? null,
    source_record_id: r.source_record_id ?? null,
    source_date: r.published_at ?? r.temporal_context ?? null,
    disposition: r.owner_disposition ?? null,
    claim_lane: r.claim_lane ?? r.source_claim_lane ?? null,
    direction: r.direction ?? null,
    speed_concept: r.speed_concept ?? null,
    discourse: r.discourse ?? null,
    canonical_status: r.canonical_status ?? null,
    usable_for_current100: r.usable_for_current100 === true,
    text: r.text_or_excerpt ?? null,
    url: r.source_url ?? null,
  });
  return {
    evidence_state: rows.length ? 'AVAILABLE_BOUNDED' : 'MISSING_BOUNDED',
    active_source_row_count: rows.length,
    physical_observation_rows: physicalRows.map(compact),
    technique_context_rows: techniqueRows.map(compact),
    powerpro_rating_context_rows: ratingRows.map(compact),
    aggregate_source_counts: oldCommunity?.source_counts ?? null,
    role: 'OWNER_REVIEW_CONTEXT_ONLY',
    missing_is_negative: false,
    activation_rule: 'current_100=true AND usable_for_current100=true AND owner_disposition in SP-075 active dispositions',
    provenance: [F.xClean, 'outputs/derived/sp075_stale_conflict_rediagnosis_v4_20260816.json'],
  };
}`;
const after = before.slice(0, start) + replacement + before.slice(end);
if (after === before) throw new Error('repair produced no change');
fs.writeFileSync(TARGET, after, 'utf8');
console.log(JSON.stringify({ repaired: true, target: path.relative(ROOT, TARGET), canonical_fields: ['owner_disposition','claim_lane','text_or_excerpt','published_at','source_url','player_name'] }));

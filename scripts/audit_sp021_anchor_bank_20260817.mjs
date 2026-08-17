import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = 'data/normalized/speed_historical_physical_measurements_2015_2026.json';
const queuePath = 'outputs/derived/sp077_final_owner_review_queue_20260816.json';
const out = 'outputs/derived/sp021_anchor_bank_inventory_20260817.json';
const j = JSON.parse(fs.readFileSync(path.join(ROOT, src), 'utf8'));
const q = JSON.parse(fs.readFileSync(path.join(ROOT, queuePath), 'utf8'));
const rows = Array.isArray(j.records) ? j.records : [];
const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const current = new Set(q.players.map(r => norm(r.identity.player)));
const uniq = (xs, fn) => new Set(xs.map(fn).filter(v => v != null && String(v).trim() !== '')).size;
const countBy = (key) => Object.fromEntries([...rows.reduce((m,r)=>m.set(String(r[key] ?? 'null'),(m.get(String(r[key] ?? 'null'))??0)+1),new Map())].sort((a,b)=>b[1]-a[1]));
const selected = rows.filter(r => r.selected_as_anchor === true);
const high = rows.filter(r => r.high_confidence_candidate === true);
const acceptedHigh = rows.filter(r => r.bank_acceptance_status === 'ACCEPTED_HIGH_CONFIDENCE');
const currentOrdinal = rows.filter(r => r.bank_acceptance_status === 'ACCEPTED_MODERATE_CURRENT_ORDINAL');
const accepted = rows.filter(r => /ACCEPT|SELECT/i.test(String(r.bank_acceptance_status ?? '')) && !/REJECT/i.test(String(r.bank_acceptance_status ?? '')));
const compact = r => ({ raw_id:r.raw_id, player:r.player, measurement_date:r.measurement_date, measurement_year:r.measurement_year, metric:r.metric, value:r.value, unit:r.unit, evidence_class:r.evidence_class, source_tier:r.source_tier, timing_method:r.timing_method, start_protocol:r.start_protocol, bank_acceptance_status:r.bank_acceptance_status, high_confidence_candidate:r.high_confidence_candidate, selected_as_anchor:r.selected_as_anchor, selected_anchor_id:r.selected_anchor_id, same_measurement_cluster_id:r.same_measurement_cluster_id, source_url:r.source_url });
const currentSlice = xs => xs.filter(r=>current.has(norm(r.player)));
const summary = xs => ({
 records: xs.length,
 unique_normalized_players: uniq(xs, r=>norm(r.player)),
 unique_selected_anchor_ids: uniq(xs, r=>r.selected_anchor_id),
 unique_measurement_clusters: uniq(xs, r=>r.same_measurement_cluster_id),
});
const payload = {
 schema_version:'sp021_anchor_bank_inventory_20260817', generated_at:'2026-08-17',
 source:src, total_records:rows.length,
 counts:{ high_confidence_candidate:high.length, accepted_high_confidence:acceptedHigh.length, selected_as_anchor:selected.length, accepted_status_regex:accepted.length, current_ordinal:currentOrdinal.length },
 dedup_counts:{
   high_confidence: summary(acceptedHigh),
   selected_all: summary(selected),
   current_ordinal: summary(currentOrdinal),
   accepted_high_confidence_current100: summary(currentSlice(acceptedHigh)),
   selected_current100: summary(currentSlice(selected)),
 },
 bank_acceptance_status_counts:countBy('bank_acceptance_status'),
 evidence_class_counts:countBy('evidence_class'),
 source_tier_counts:countBy('source_tier'),
 selected_current100:{ records:currentSlice(selected).length, players:[...new Set(currentSlice(selected).map(r=>norm(r.player)))].sort(), rows:currentSlice(selected).map(compact)},
 high_confidence_current100:{ records:currentSlice(acceptedHigh).length, players:[...new Set(currentSlice(acceptedHigh).map(r=>norm(r.player)))].sort(), rows:currentSlice(acceptedHigh).map(compact)},
 high_confidence_all:acceptedHigh.map(compact),
 selected_all:selected.map(compact)
};
fs.writeFileSync(path.join(ROOT,out),JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({total:rows.length, counts:payload.counts, dedup_counts:payload.dedup_counts, status_counts:payload.bank_acceptance_status_counts}));

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = 'docs/state/speed_task_registry.tsv';
const abs = path.join(ROOT, rel);
const raw = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '').trimEnd();
const lines = raw.split(/\r?\n/);
const header = lines[0].split('\t');
const rows = lines.slice(1).filter(Boolean).map((line, i) => {
  const cells = line.split('\t');
  if (cells.length !== header.length) throw new Error(`${rel}:${i + 2}: expected ${header.length} cells, got ${cells.length}`);
  return Object.fromEntries(header.map((h, j) => [h, cells[j]]));
});
const byId = new Map(rows.map(r => [r.task_id, r]));
const requireTask = id => {
  const t = byId.get(id);
  if (!t) throw new Error(`missing task ${id}`);
  return t;
};

const sp077 = requireTask('SP-077');
sp077.status = 'PARTIAL';
sp077.requirement_ids = [
  'SR-002','SR-003','SR-004','SR-008','SR-009','SR-014','SR-019','SR-022',
  'SR-031','SR-032','SR-033','SR-038','SR-039','SR-040','SR-041','SR-043',
  'SR-052','SR-055','SR-058','SR-061',
].join(',');
sp077.owner_review_block = '1';
sp077.gate_block = '1';
sp077.depends_on = [
  'SP-001','SP-007','SP-015','SP-016','SP-017','SP-018','SP-019','SP-021','SP-022',
  'SP-041','SP-042','SP-046','SP-052','SP-053','SP-054','SP-055','SP-056','SP-074','SP-075','SP-098','SP-100',
].join(',');
sp077.title = 'Construct-complete final owner review queue';
sp077.next_action_or_blocker = 'INTEGRITY_LOCK=ACTIVE; the 2026-08-16 narrow queue is invalid for new owner verdicts. A 2026-08-17 construct-complete candidate now exposes top speed, acceleration/H2F/T90, short-distance evidence, historical physical anchors/context, statistical proxy, mixed game proxies, community physical context, technique separation, PowerPro review context, source-scope guards, and explicit missingness for all 100. Independent source-derived QA v2 passes 3255/3255. Re-close SP-077 only after the machine-readable traceability contract and global construct QA point to this candidate, CI passes, and an independent review confirms the immutable requirements plus 2026-08-11 gap-audit intent. Do not unlock owner review merely because this row is edited.';
sp077.artifacts = [
  'scripts/build_sp077_construct_complete_owner_review_queue_20260817.mjs',
  'scripts/augment_sp077_with_sp021_anchors_20260817.mjs',
  'scripts/qa_sp077_construct_complete_owner_review_queue_v2_20260817.mjs',
  'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json',
  'outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json',
  'docs/reports/sp077_construct_complete_owner_review_queue_20260817.md',
  'docs/audits/sp077_construct_complete_owner_review_independent_qa_v2_20260817.md',
  'docs/state/speed_owner_review_integrity_lock_20260817.json',
  'docs/state/speed_construct_traceability_contract_20260817.tsv',
].join(';');

const sp078 = requireTask('SP-078');
sp078.status = 'PARTIAL';
sp078.owner_review_block = '1';
sp078.gate_block = '1';
sp078.depends_on = 'SP-077';
sp078.next_action_or_blocker = 'INTEGRITY_LOCK=ACTIVE; append-only capture semantics remain valid and the ledger is still empty, but the ledger is bound to the superseded 2026-08-16 queue hash/schema. After SP-077 traceability is independently closed and the integrity lock is validly unlocked, adapt/rebind SP-078 to the construct-complete queue only while records=[] and owner_verdict_count=0, then rerun no-overwrite, queue-hash, and lock-bypass QA. No owner verdict may be captured before that.';
sp078.artifacts = [
  'scripts/sp078_owner_verdict_capture_20260816.mjs',
  'scripts/qa_sp078_integrity_lock_20260817.mjs',
  'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
  'docs/state/speed_owner_review_integrity_lock_20260817.json',
].join(';');

const sp079 = requireTask('SP-079');
sp079.next_action_or_blocker = 'BLOCKED: SP-078 is PARTIAL and the owner-review integrity lock is active. The construct-complete queue has not yet been unlocked/rebound for verdict capture and owner_verdict_count remains 0. Do not run SP-079 until SP-077 is revalidated under end-to-end traceability, the lock is legitimately released, SP-078 is rebound to the new queue hash with an empty ledger, and actual owner verdict input exists. Preserve physical/practical point+range+confidence+provenance and never use the retired PowerPro-mapped NPB+ blend as final.';
sp079.artifacts = 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json;outputs/derived/sp078_owner_verdict_ledger_20260816.json;docs/state/speed_owner_review_integrity_lock_20260817.json';

const out = [header.join('\t'), ...rows.map(r => header.map(h => r[h] ?? '').join('\t'))].join('\n') + '\n';
fs.writeFileSync(abs, out, 'utf8');
console.log(JSON.stringify({ updated: ['SP-077','SP-078','SP-079'], sp077_status: sp077.status, sp078_status: sp078.status, sp077_owner_review_block: sp077.owner_review_block, sp078_owner_review_block: sp078.owner_review_block, lock_expected: true }));

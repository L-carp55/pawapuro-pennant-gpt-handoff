// Reopen SP-077/SP-078 after Community semantic field-mapping defect was found.
// Requires the integrity lock already active and the owner ledger still empty.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REG = path.join(ROOT, 'docs/state/speed_task_registry.tsv');
const LOCK = path.join(ROOT, 'docs/state/speed_owner_review_integrity_lock_20260817.json');
const LEDGER = path.join(ROOT, 'outputs/derived/sp078_owner_verdict_ledger_20260816.json');
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
if (lock.locked !== true || lock.reason_code !== 'COMMUNITY_SEMANTIC_FIELD_MAPPING_DROPPED_CONTEXT') throw new Error('expected Community semantic integrity lock is not active');
if (!Array.isArray(ledger.records) || ledger.records.length !== 0 || Number(ledger.owner_verdict_count) !== 0) throw new Error('owner verdict ledger is not empty; automatic reopen forbidden');
const lines = fs.readFileSync(REG, 'utf8').replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
const header = lines.shift().split('\t');
const rows = lines.filter(Boolean).map((line, i) => {
  const cells = line.split('\t');
  if (cells.length !== header.length) throw new Error(`registry row ${i+2} column mismatch`);
  return Object.fromEntries(header.map((h,j)=>[h,cells[j]]));
});
const byId = new Map(rows.map(r=>[r.task_id,r]));
const s77=byId.get('SP-077'), s78=byId.get('SP-078'), s79=byId.get('SP-079');
if (!s77||!s78||!s79) throw new Error('SP-077/SP-078/SP-079 missing');
s77.status='PARTIAL'; s77.owner_review_block='1'; s77.gate_block='1';
s77.next_action_or_blocker='INTEGRITY_LOCK=ACTIVE: Community semantic field mapping defect. The construct queue structurally preserved the Community lane but read legacy disposition/text/date names instead of canonical owner_disposition/claim_lane/text_or_excerpt/published_at, so physical/technique/rating subrows could silently disappear. No owner verdict was recorded. Reclose only after canonical-field repair, source-derived per-player semantic multiset QA, regenerated priority packet, and full traceability QA.';
s78.status='PARTIAL'; s78.owner_review_block='1'; s78.gate_block='1';
s78.next_action_or_blocker='INTEGRITY_LOCK=ACTIVE: append-only semantics remain valid and ledger is empty, but the queue it is bound to is semantically superseded pending Community repair. Rebind only to a semantic-QA-passing regenerated construct queue while records=[] and owner_verdict_count=0.';
s79.status='NOT_STARTED'; s79.gate_block='1';
s79.next_action_or_blocker='BLOCKED: SP-077/SP-078 reopened under Community semantic integrity lock and owner_verdict_count remains 0. Do not run SP-079 until semantic propagation is validated, queue/ledger are rebound, lock is validly released, and actual owner verdict input exists.';
fs.writeFileSync(REG, [header.join('\t'),...rows.map(r=>header.map(h=>String(r[h]??'')).join('\t')),''].join('\n'));
console.log(JSON.stringify({status:'PASS',sp077:s77.status,sp078:s78.status,sp079:s79.status,owner_verdict_count:0}));

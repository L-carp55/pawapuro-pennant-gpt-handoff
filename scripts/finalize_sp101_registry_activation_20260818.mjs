// Idempotently align the canonical speed task registry with the already
// committed SP-101 owner clarification, lower-bound census and relock.
// This script changes only the registry. It never writes owner verdicts,
// never runs SP-079 and never starts shoulder work.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REG = 'docs/state/speed_task_registry.tsv';
const LOCK = 'docs/state/speed_owner_review_integrity_lock_20260817.json';
const LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';
const REQUIRED = [
  'docs/state/speed_owner_clarification_the_show_scope_20260818.md',
  'docs/tasks/SP101_EXPANDED_THE_SHOW_NPB_UNIVERSE_20260818.md',
  'outputs/derived/sp101_the_show_npb_universe_census_20260818.json',
  'outputs/derived/sp101_the_show_npb_universe_census_20260818.tsv',
  'docs/audits/sp101_the_show_npb_universe_census_20260818.md',
  'outputs/derived/sp078_proposal_supersession_receipt_sp101_20260818.json',
  'docs/audits/sp078_proposal_superseded_by_sp101_the_show_scope_20260818.md',
];
const full = p => path.join(ROOT, p);
const text = p => fs.readFileSync(full(p), 'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');
const list = s => String(s ?? '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
const one = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

for (const p of REQUIRED) {
  if (!fs.existsSync(full(p)) || fs.statSync(full(p)).size === 0) throw new Error(`missing/empty SP-101 artifact: ${p}`);
}
const lock = JSON.parse(text(LOCK));
const ledgerBefore = text(LEDGER);
const ledger = JSON.parse(ledgerBefore);
if (lock.locked !== true || lock.reason_code !== 'THE_SHOW_ELIGIBLE_UNIVERSE_UNDERCOUNT_AND_EVIDENCE_UTILIZATION_INCOMPLETE') {
  throw new Error('SP-101 relock is not active');
}
if (ledger.owner_verdict_count !== 0 || !Array.isArray(ledger.records) || ledger.records.length !== 0) {
  throw new Error('owner ledger is not empty');
}

const raw = text(REG).replace(/^\uFEFF/, '').trimEnd();
const lines = raw.split(/\r?\n/);
const header = lines[0].split('\t');
const expected = ['task_id','status','category','requirement_ids','owner_review_block','gate_block','depends_on','title','next_action_or_blocker','artifacts'];
if (JSON.stringify(header) !== JSON.stringify(expected)) throw new Error(`unexpected registry header: ${header.join('|')}`);
const rows = lines.slice(1).filter(Boolean).map((line, i) => {
  const cells = line.split('\t');
  if (cells.length !== header.length) throw new Error(`registry line ${i + 2}: ${cells.length} cells, expected ${header.length}`);
  return Object.fromEntries(header.map((h,j)=>[h,cells[j]]));
});
const byId = new Map(rows.map(r => [r.task_id, r]));
for (const dependency of ['SP-050','SP-051','SP-052','SP-077','SP-078','SP-098','SP-100']) {
  if (!byId.has(dependency)) throw new Error(`required existing dependency missing: ${dependency}`);
}
const sp079 = byId.get('SP-079');
if (!sp079) throw new Error('SP-079 missing');

sp079.status = 'BLOCKED_DEPENDENCY';
sp079.owner_review_block = '1';
sp079.gate_block = '1';
sp079.depends_on = [...new Set([...list(sp079.depends_on), 'SP-101'])].join(',');
sp079.next_action_or_blocker = 'BLOCKED by SP-101 expanded MLB The Show × NPB universe rebuild and refreshed all-100 requirements-to-decision utilization review. Do not run final practical reappraisal from the superseded SP-078 proposal. After SP-101 validation, rebuild the current-100 evidence packet, individual adjudication and owner-verdict proposal before capturing any verdict.';
sp079.artifacts = [...new Set([...list(sp079.artifacts), ...REQUIRED])].join(';');

const sp101 = {
  task_id: 'SP-101',
  status: 'PARTIAL',
  category: 'data',
  requirement_ids: 'SR-023,SR-024,SR-025,SR-026,SR-055,SR-058,SR-060',
  owner_review_block: '1',
  gate_block: '1',
  depends_on: 'SP-050,SP-051,SP-052,SP-077',
  title: 'Expanded MLB The Show × NPB eligible universe, identity crosswalk, transition panel and current-100 evidence integration',
  next_action_or_blocker: 'EVIDENCE_STATUS=MEASURED_BOUNDED. Existing 79-player MLB bridge / 47-player The Show bridge and 6-player/7-pair same-time sample are lower bounds, not the eligible universe. Execute the parallel Codex task in SP101_EXPANDED_THE_SHOW_NPB_UNIVERSE_20260818.md; enumerate all NPB-before-2026 × MLB-promotion × The Show cohorts, repair canonical identities, build time-indexed transition panels, and regenerate requirements-to-decision utilization receipts before any SP-078 approval.',
  artifacts: REQUIRED.join(';'),
};
const existing = byId.get('SP-101');
if (existing) {
  Object.assign(existing, sp101);
} else {
  rows.push(sp101);
}

const out = [header.join('\t'), ...rows.map(r => header.map(h => one(r[h])).join('\t')), ''].join('\n');
fs.writeFileSync(full(REG), out, 'utf8');

const verify = fs.readFileSync(full(REG), 'utf8').trimEnd().split(/\r?\n/).slice(1).map(x => x.split('\t'));
const check = verify.map(c => Object.fromEntries(header.map((h,i)=>[h,c[i]])));
const v101 = check.find(r => r.task_id === 'SP-101');
const v079 = check.find(r => r.task_id === 'SP-079');
if (!v101 || v101.status !== 'PARTIAL' || v101.owner_review_block !== '1' || v101.gate_block !== '1') throw new Error('SP-101 registry finalization failed');
if (!v079 || v079.status !== 'BLOCKED_DEPENDENCY' || !list(v079.depends_on).includes('SP-101')) throw new Error('SP-079 dependency rebind failed');
if (check.filter(r => r.task_id === 'SP-101').length !== 1) throw new Error('duplicate SP-101 rows');
if (sha(text(LEDGER)) !== sha(ledgerBefore)) throw new Error('owner ledger mutated');

console.log(JSON.stringify({
  status: 'PASS',
  sp101: {status:v101.status,owner_review_block:v101.owner_review_block,gate_block:v101.gate_block,depends_on:list(v101.depends_on)},
  sp079: {status:v079.status,owner_review_block:v079.owner_review_block,gate_block:v079.gate_block,depends_on:list(v079.depends_on)},
  owner_verdict_count: ledger.owner_verdict_count,
  owner_review_locked: lock.locked,
}));

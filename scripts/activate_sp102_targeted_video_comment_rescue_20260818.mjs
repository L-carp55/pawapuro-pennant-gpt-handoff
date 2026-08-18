// Idempotently activate SP-102 as a post-SP-101, low-confidence-only
// Community rescue lane. This script must not collect comments, write owner
// verdicts, run SP-079, or start shoulder work.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'docs/state/speed_task_registry.tsv';
const LOCK = 'docs/state/speed_owner_review_integrity_lock_20260817.json';
const LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';
const TASK = 'docs/tasks/SP102_TARGETED_2CH_VIDEO_COMMENT_RESCUE_20260818.md';
const CONTRACT = 'outputs/derived/sp102_target_selection_contract_20260818.json';
const STATE = 'docs/state/speed_sp102_activation_state_20260818.json';

const full = p => path.join(ROOT, p);
const read = p => fs.readFileSync(full(p), 'utf8');
const write = (p, s) => {
  fs.mkdirSync(path.dirname(full(p)), { recursive: true });
  fs.writeFileSync(full(p), s, 'utf8');
};
const sha = s => createHash('sha256').update(s).digest('hex');
const list = s => String(s ?? '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
const uniq = xs => [...new Set(xs)];
const one = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

for (const rel of [REGISTRY, LOCK, LEDGER, TASK, CONTRACT]) {
  if (!fs.existsSync(full(rel)) || fs.statSync(full(rel)).size === 0) throw new Error(`missing/empty prerequisite: ${rel}`);
}
const ledgerBefore = read(LEDGER);
const ledger = JSON.parse(ledgerBefore);
const lock = JSON.parse(read(LOCK));
const contract = JSON.parse(read(CONTRACT));
if (ledger.owner_verdict_count !== 0 || !Array.isArray(ledger.records) || ledger.records.length !== 0) throw new Error('owner ledger is not empty');
if (lock.locked !== true) throw new Error('owner review must remain locked');
if (contract.status !== 'CONTRACT_ONLY_WAITING_FOR_SP101') throw new Error('unexpected SP-102 contract state');

const raw = read(REGISTRY).replace(/^\uFEFF/, '').trimEnd();
const lines = raw.split(/\r?\n/);
const header = lines[0].split('\t');
const expected = ['task_id','status','category','requirement_ids','owner_review_block','gate_block','depends_on','title','next_action_or_blocker','artifacts'];
if (JSON.stringify(header) !== JSON.stringify(expected)) throw new Error(`unexpected registry header: ${header.join('|')}`);
const rows = lines.slice(1).filter(Boolean).map((line, i) => {
  const cells = line.split('\t');
  if (cells.length !== header.length) throw new Error(`registry line ${i + 2}: ${cells.length} cells, expected ${header.length}`);
  return Object.fromEntries(header.map((h, j) => [h, cells[j]]));
});
const byId = new Map(rows.map(r => [r.task_id, r]));
for (const id of ['SP-033','SP-035','SP-037','SP-039','SP-075','SP-079','SP-101']) {
  if (!byId.has(id)) throw new Error(`required task missing: ${id}`);
}

const taskArtifacts = [TASK, CONTRACT, STATE];
const sp102 = {
  task_id: 'SP-102',
  status: 'BLOCKED_DEPENDENCY',
  category: 'community',
  requirement_ids: 'SR-014,SR-016,SR-019,SR-020,SR-022,SR-041,SR-043,SR-052',
  owner_review_block: '1',
  gate_block: '1',
  depends_on: 'SP-033,SP-035,SP-037,SP-039,SP-075,SP-101',
  title: 'Targeted 2ch/5ch-style baseball video-comment rescue for residual low-confidence speed appraisals',
  next_action_or_blocker: 'BLOCKED until SP-101 is DONE_VALIDATED and outputs/derived/sp101_residual_low_confidence_target_set.json is frozen. Then search only the residual low-confidence/material-conflict targets, preserve video narration / quoted thread / comments / replies / linked primary sources as separate layers, deduplicate by event-origin clusters, and produce player-specific decision-use receipts. Do not perform a global all-100 comment crawl.',
  artifacts: taskArtifacts.join(';'),
};
const existing102 = byId.get('SP-102');
if (existing102) Object.assign(existing102, sp102);
else rows.push(sp102);

const sp101 = byId.get('SP-101');
sp101.next_action_or_blocker = one(`${sp101.next_action_or_blocker} SP-101 completion must also freeze outputs/derived/sp101_residual_low_confidence_target_set.json for downstream SP-102, with one explicit target-selection state for every current-100 player.`);
sp101.artifacts = uniq([...list(sp101.artifacts), TASK, CONTRACT]).join(';');

const sp079 = byId.get('SP-079');
sp079.status = 'BLOCKED_DEPENDENCY';
sp079.owner_review_block = '1';
sp079.gate_block = '1';
sp079.depends_on = uniq([...list(sp079.depends_on), 'SP-102']).join(',');
sp079.next_action_or_blocker = 'BLOCKED by SP-101 expanded multibridge evidence rebuild and SP-102 targeted residual low-confidence video-comment rescue. Do not generate final practical ratings or a new owner-verdict proposal until SP-101 is validated, the residual target set is frozen, SP-102 is DONE_VALIDATED or closes with a measured zero-target/zero-usable-evidence finding, and the all-100 consistency/decision-use QA is rerun.';
sp079.artifacts = uniq([...list(sp079.artifacts), TASK, CONTRACT, STATE]).join(';');

const registryOut = [header.join('\t'), ...rows.map(r => header.map(h => one(r[h])).join('\t')), ''].join('\n');
write(REGISTRY, registryOut);

lock.sp102_task = TASK;
lock.sp102_target_selection_contract = CONTRACT;
lock.sp102_activation_state = STATE;
lock.invalidated_actions = uniq([
  ...(lock.invalidated_actions ?? []),
  'generate a new SP-078 proposal before SP-102 closes after the SP-101 residual-target freeze',
  'crawl all 100 players through 2ch/5ch-style video comments before SP-101 identifies residual low-confidence targets',
  'treat comment volume, likes, replies, narration, quoted threads and comments as independent physical measurements',
]);
lock.sp102_unlock_conditions = [
  'SP-101 is DONE_VALIDATED and all mandatory P0 routes are executed or closed with measured negative findings',
  'outputs/derived/sp101_residual_low_confidence_target_set.json exists and assigns one selection state to all 100 players',
  'SP-102 is DONE_VALIDATED, or closes DONE_NEGATIVE_FINDING with measured zero targets or zero usable evidence and explicit search denominators',
  'video narration, quoted 2ch/5ch text, top-level comments, replies and linked primary sources remain separate source layers',
  'event-origin deduplication, sarcasm/template, title-priming, privacy and missingness QA pass',
  'no comment-only high-confidence or numeric verdict is produced',
  'affected-player and all-100 decision-use/consistency QA are rerun',
  'the canonical owner ledger remains empty before a rebuilt SP-078 proposal',
];
lock.unlock_conditions = uniq([
  ...(lock.unlock_conditions ?? []),
  'SP-102 targeted residual low-confidence Community rescue is DONE_VALIDATED or has a measured zero-target/zero-usable-evidence terminal finding after SP-101',
]);
write(LOCK, JSON.stringify(lock, null, 2) + '\n');

const state = {
  schema_version: 'speed_sp102_activation_state_20260818',
  generated_at: '2026-08-18',
  task_id: 'SP-102',
  status: 'BLOCKED_DEPENDENCY_WAITING_FOR_SP101',
  scope: 'speed_only',
  task_specification: TASK,
  target_selection_contract: CONTRACT,
  prerequisite_task: 'SP-101',
  required_target_file: 'outputs/derived/sp101_residual_low_confidence_target_set.json',
  sequence: [
    'complete SP-101',
    'freeze all-100 target-selection states',
    'collect only residual low-confidence/material-conflict targets',
    'separate and deduplicate source layers and event origins',
    'promote linked primary sources into proper lanes',
    'produce player-specific decision-use and before/after ablation receipts',
    'rerun all-100 consistency QA',
    'only then rebuild the SP-078 proposal'
  ],
  maximum_comment_only_influence: 'LOW_CONFIDENCE_DIRECTIONAL_RESCUE',
  prohibited: [
    'global all-100 crawl before target freeze',
    'comment volume as votes',
    'comment-only numeric rating',
    'comment-only high-confidence verdict',
    'persisting usernames or commenter profiles',
    'writing SP-078 owner verdicts',
    'running SP-079',
    'starting shoulder work'
  ],
  governance: {
    owner_review_locked: true,
    owner_verdict_count_expected: 0,
    sp079_blocked: true,
    shoulder_blocked: true
  },
  source_hashes: {
    task: sha(read(TASK)),
    contract: sha(read(CONTRACT)),
    ledger: sha(ledgerBefore)
  }
};
write(STATE, JSON.stringify(state, null, 2) + '\n');

if (sha(read(LEDGER)) !== sha(ledgerBefore)) throw new Error('owner ledger mutated');
const verifyLines = read(REGISTRY).trimEnd().split(/\r?\n/).map(x => x.split('\t'));
const verifyHead = verifyLines[0];
const verifyRows = verifyLines.slice(1).map(c => Object.fromEntries(verifyHead.map((h,i)=>[h,c[i]])));
const v102 = verifyRows.filter(r => r.task_id === 'SP-102');
const v079 = verifyRows.find(r => r.task_id === 'SP-079');
if (v102.length !== 1 || v102[0].status !== 'BLOCKED_DEPENDENCY') throw new Error('SP-102 registry activation failed');
if (!v079 || !list(v079.depends_on).includes('SP-102')) throw new Error('SP-079 not rebound to SP-102');

console.log(JSON.stringify({
  status: 'PASS',
  sp102: {status:v102[0].status,depends_on:list(v102[0].depends_on)},
  sp079: {status:v079.status,depends_on:list(v079.depends_on)},
  owner_review_locked: lock.locked,
  owner_verdict_count: ledger.owner_verdict_count,
  global_comment_crawl_allowed: false
}));

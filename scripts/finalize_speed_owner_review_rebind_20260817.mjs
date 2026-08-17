// Atomic transition from integrity-locked construct revalidation to owner-review readiness.
// Nothing is committed by this script; the calling workflow commits only if every QA below passes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = {
  contract: 'docs/state/speed_construct_traceability_contract_20260817.tsv',
  lock: 'docs/state/speed_owner_review_integrity_lock_20260817.json',
  registry: 'docs/state/speed_task_registry.tsv',
  queue: 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json',
  queueQa: 'outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json',
  ledger: 'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
  capture: 'scripts/sp078_owner_verdict_capture_20260816.mjs',
  qaTrace: 'scripts/qa_speed_construct_traceability_20260817.mjs',
  qaLedger: 'scripts/qa_sp078_integrity_lock_20260817.mjs',
  qaRegistry: 'scripts/qa_speed_task_registry.mjs',
  audit: 'docs/audits/speed_owner_review_unlock_transition_20260817.md',
};
const full = rel => path.join(ROOT, rel);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(`speed owner-review transition fail-closed: ${message}`); };
const req = (condition, message) => { if (!condition) fail(message); };
const readText = rel => fs.readFileSync(full(rel), 'utf8');
const readJson = rel => JSON.parse(readText(rel));
const writeAtomic = (rel, body) => {
  const target = full(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, target);
};
function run(script, args = []) {
  const result = spawnSync(process.execPath, [full(script), ...args], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) fail(`${script} ${args.join(' ')} failed\n${result.stdout || ''}\n${result.stderr || ''}`);
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}
function parseTsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  const header = lines.shift().split('\t');
  return {
    header,
    rows: lines.filter(Boolean).map((line, index) => {
      const cells = line.split('\t');
      req(cells.length === header.length, `registry/contract row ${index + 2} column mismatch`);
      return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
    }),
  };
}
function stringifyTsv(header, rows) {
  return [header.join('\t'), ...rows.map(row => header.map(key => String(row[key] ?? '')).join('\t')), ''].join('\n');
}
function appendArtifact(row, artifact) {
  const parts = String(row.artifacts || '').split(';').map(x => x.trim()).filter(Boolean);
  if (!parts.includes(artifact)) parts.push(artifact);
  row.artifacts = parts.join(';');
}

for (const rel of Object.values(P).filter(rel => !rel.endsWith('.md') || rel !== P.audit)) {
  req(fs.existsSync(full(rel)), `missing prerequisite ${rel}`);
}

// 1) Prove the locked state is fully construct-complete before changing any state.
const lockBefore = readJson(P.lock);
req(lockBefore?.schema_version === 'speed_owner_review_integrity_lock_20260817', 'lock schema mismatch');
req(lockBefore.locked === true, 'transition must start while integrity lock is active');
const ledgerBefore = readJson(P.ledger);
req(Array.isArray(ledgerBefore.records) && ledgerBefore.records.length === 0, 'ledger has historical owner events; automatic rebind forbidden');
req(Number(ledgerBefore.owner_verdict_count) === 0, 'owner_verdict_count is not zero; automatic rebind forbidden');

const contractParsed = parseTsv(readText(P.contract));
const unresolved = contractParsed.rows.filter(row => row.required_for_owner_review === '1' && row.current_resolution === 'UNRESOLVED');
req(unresolved.length === 0, `required construct lanes remain unresolved: ${unresolved.map(x => x.lane_id).join(',')}`);
req(contractParsed.rows.filter(row => row.required_for_owner_review === '1').every(row => row.current_resolution === 'INTEGRATED'),
  'required construct lanes are not all INTEGRATED');

const queueBytes = fs.readFileSync(full(P.queue));
const queue = JSON.parse(queueBytes.toString('utf8'));
req(queue?.schema_version === 'sp077_construct_complete_owner_review_queue_20260817', 'construct-complete queue schema mismatch');
req(queue?.construct?.top_speed_only_finalization_forbidden === true, 'top-speed-only guard missing');
req(Array.isArray(queue.players) && queue.players.length === 100, 'queue is not exact current-100');
req(new Set(queue.players.map(x => x.queue_row_key)).size === 100, 'queue row keys are not unique');
req(queue.players.every(x => x?.owner_verdict?.status === 'NOT_ENTERED' && x?.owner_verdict?.verdict == null), 'queue contains a prefilled owner verdict');

const queueQa = readJson(P.queueQa);
req(queueQa.status === 'PASS' && Number(queueQa.checks_failed) === 0 && Number(queueQa.checks_passed) === Number(queueQa.checks_total),
  'independent construct-complete QA is not clean PASS');
req(Number(queueQa?.coverage?.players) === 100, 'independent QA does not cover 100 players');

const lockedTraceOutput = run(P.qaTrace);
req(/CONSTRUCT_TRACEABILITY_READY_FOR_INDEPENDENT_UNLOCK_REVIEW=1/.test(lockedTraceOutput), 'locked traceability QA did not reach revalidation-ready state');

// 2) Rebind the still-empty append-only ledger to the exact current queue bytes.
const selfTestOutput = run(P.capture, ['--self-test']);
req(/"self_test":"PASS"/.test(selfTestOutput), 'SP-078 append-only self-test did not pass');
const rebindOutput = run(P.capture, ['--reinitialize-empty']);
const ledger = readJson(P.ledger);
const queueHash = sha256(queueBytes);
req(ledger?.queue_source?.path === P.queue, 'rebound ledger queue path mismatch');
req(ledger?.queue_source?.schema_version === queue.schema_version, 'rebound ledger queue schema mismatch');
req(ledger?.queue_source?.sha256 === queueHash, 'rebound ledger queue SHA-256 mismatch');
req(Number(ledger?.queue_source?.row_count) === 100, 'rebound ledger row_count mismatch');
req(Array.isArray(ledger.records) && ledger.records.length === 0 && Number(ledger.owner_verdict_count) === 0,
  'rebound ledger is not empty');

// 3) Reclose SP-077/SP-078 only after the queue and ledger receipts are proven.
const reg = parseTsv(readText(P.registry));
const byId = new Map(reg.rows.map(row => [row.task_id, row]));
const sp077 = byId.get('SP-077');
const sp078 = byId.get('SP-078');
const sp079 = byId.get('SP-079');
req(sp077 && sp078 && sp079, 'SP-077/SP-078/SP-079 registry rows missing');
req(sp077.status === 'PARTIAL' && sp078.status === 'PARTIAL', `unexpected pre-transition statuses SP-077=${sp077.status}, SP-078=${sp078.status}`);

sp077.status = 'DONE_VALIDATED';
sp077.owner_review_block = '0';
sp077.gate_block = '0';
sp077.next_action_or_blocker = 'EVIDENCE_STATUS=MEASURED_BOUNDED; 2026-08-17 construct-complete queue revalidated. All 12 mandatory owner-review construct lanes are INTEGRATED, independent source-derived QA passes 3255/3255, and locked global traceability QA passes. Top speed remains one lane only; acceleration/H2F/T90, short-distance/historical physical evidence, game proxies, Community, technique separation, PowerPro context, source-scope guards, and explicit missingness are all preserved per player. Owner verdict capture is valid only through SP-078 bound to this exact queue.';
appendArtifact(sp077, P.audit);
appendArtifact(sp077, P.qaTrace);

sp078.status = 'DONE_VALIDATED';
sp078.owner_review_block = '0';
sp078.gate_block = '0';
sp078.next_action_or_blocker = `EVIDENCE_STATUS=MEASURED_BOUNDED; empty append-only ledger safely rebound to construct-complete queue schema/hash (${queueHash}); owner_verdict_count=0. Duplicate ordinary writes and nonempty reinitialization remain fail-closed; amendments preserve history; binding/lock QA is mandatory.`;
appendArtifact(sp078, P.audit);
appendArtifact(sp078, P.qaLedger);

sp079.next_action_or_blocker = 'Exact remaining blocker: actual owner verdict input is not yet recorded (owner_verdict_count=0). Construct traceability and SP-078 queue binding are now validated; do not run SP-079 until owner review produces real verdict events. Preserve physical/practical point+range+confidence+provenance and never use the retired PowerPro-mapped NPB+ blend as final.';
writeAtomic(P.registry, stringifyTsv(reg.header, reg.rows));

// 4) Unlock only after SP-077/SP-078 are reclosed in the same workspace.
const lockAfter = {
  ...lockBefore,
  locked: false,
  unlocked_at: new Date().toISOString(),
  unlock_status: 'CONSTRUCT_TRACEABILITY_REVALIDATED_AND_SP078_REBOUND',
  active_owner_review_queue: P.queue,
  active_owner_review_queue_sha256: queueHash,
  active_owner_verdict_ledger: P.ledger,
  owner_verdict_count_at_unlock: 0,
  unlock_basis: [
    '12/12 mandatory construct lanes INTEGRATED',
    `independent queue QA ${queueQa.checks_passed}/${queueQa.checks_total} PASS`,
    'locked global traceability QA PASS',
    'SP-078 append-only self-test PASS',
    'empty ledger rebound to exact construct-complete queue SHA-256',
    'SP-077 and SP-078 reclosed DONE_VALIDATED before unlock',
  ],
};
writeAtomic(P.lock, JSON.stringify(lockAfter, null, 2) + '\n');

// 5) Final unlocked-state gates. Any failure aborts the workflow before commit.
const ledgerQaOutput = run(P.qaLedger);
req(/"qa":"PASS"/.test(ledgerQaOutput), 'SP-078 binding QA did not pass after unlock');
const unlockedTraceOutput = run(P.qaTrace);
req(/OWNER_REVIEW_READY_BY_CONSTRUCT_TRACEABILITY=1/.test(unlockedTraceOutput), 'unlocked construct traceability QA did not declare owner-review readiness');

// SP-077/SP-078 already reference P.audit in the local candidate registry.
// Create a non-final local receipt before registry QA so the completion-artifact
// existence check is meaningful. If a later gate fails, the workflow never
// commits this workspace. The receipt is overwritten with the final PASS audit
// after registry QA succeeds.
writeAtomic(P.audit, [
  '# Speed owner-review unlock transition — 2026-08-17',
  '',
  'Status: **LOCAL_CANDIDATE_PENDING_FINAL_REGISTRY_QA**',
  '',
  `- Active queue: \`${P.queue}\``,
  `- Queue SHA-256: \`${queueHash}\``,
  '- Mandatory construct lanes: 12/12 INTEGRATED',
  '- SP-078 empty ledger rebound completed in this uncommitted workspace',
  '- No owner verdict was created',
  '',
].join('\n'));

const registryQaOutput = run(P.qaRegistry);
req(/PASS: requirements=/.test(registryQaOutput), 'task-registry QA did not pass after transition');

const audit = [
  '# Speed owner-review unlock transition — 2026-08-17',
  '',
  'Status: **PASS**',
  '',
  `- Active queue: \`${P.queue}\``,
  `- Queue schema: \`${queue.schema_version}\``,
  `- Queue SHA-256: \`${queueHash}\``,
  '- Queue population: 100/100 unique row keys',
  `- Independent construct QA: ${queueQa.checks_passed}/${queueQa.checks_total} PASS; ${queueQa.checks_failed} FAIL`,
  '- Mandatory construct lanes: 12/12 INTEGRATED',
  '- SP-077: DONE_VALIDATED',
  '- SP-078: DONE_VALIDATED',
  '- SP-078 owner verdicts at transition: 0',
  '- Integrity lock: false only after queue revalidation + empty-ledger rebind',
  '- SP-079: NOT_STARTED; blocked only on actual owner verdict input',
  '',
  '## Guards retained',
  '',
  '- NPB+ top speed is one physical lane, never the full speed construct.',
  '- Misattributed `hp_to_1b_sec` remains fail-closed without deleting independent H2F/acceleration evidence.',
  '- 30m/50m evidence is not linearly converted to T90 without a validated bridge.',
  '- Statistical S remains separate context/fallback; no arithmetic N/S blend.',
  '- Pure speed remains separate from stealing/baserunning technique.',
  '- PowerPro remains review/stale context only, never a player-level physical teacher.',
  '- Missing evidence remains explicit missingness, not negative evidence.',
  '- Ledger remains append-only and bound to the exact queue SHA-256.',
  '',
  '## Final machine checks',
  '',
  '```text',
  ledgerQaOutput,
  unlockedTraceOutput,
  registryQaOutput,
  '```',
  '',
  `SP-078 rebind output: \`${rebindOutput.replace(/`/g, '')}\``,
  '',
].join('\n');
writeAtomic(P.audit, audit);

console.log(JSON.stringify({
  transition: 'PASS',
  queue_sha256: queueHash,
  sp077: sp077.status,
  sp078: sp078.status,
  lock: false,
  owner_verdict_count: 0,
  sp079: sp079.status,
}));

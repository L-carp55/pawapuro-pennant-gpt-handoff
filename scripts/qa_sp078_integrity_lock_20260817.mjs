// SP-078 integrity regression for the construct-complete owner-review queue.
// While locked: attempts a valid-looking verdict, requires rejection, and
// byte-compares the real ledger before/after.
// After unlock: verifies only that the ledger is still bound to the current
// construct-complete queue; it does not fabricate an owner verdict.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURE = path.join(ROOT, 'scripts/sp078_owner_verdict_capture_20260816.mjs');
const QUEUE = path.join(ROOT, 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json');
const LEDGER = path.join(ROOT, 'outputs/derived/sp078_owner_verdict_ledger_20260816.json');
const LOCK = path.join(ROOT, 'docs/state/speed_owner_review_integrity_lock_20260817.json');
const EXPECTED_QUEUE_SCHEMA = 'sp077_construct_complete_owner_review_queue_20260817';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = message => { console.error(`FAIL: ${message}`); process.exit(1); };
for (const abs of [CAPTURE, QUEUE, LEDGER, LOCK]) if (!fs.existsSync(abs)) fail(`missing fixture dependency: ${path.relative(ROOT, abs)}`);

const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const queueBytes = fs.readFileSync(QUEUE);
const queue = JSON.parse(queueBytes.toString('utf8'));
const ledgerBytes = fs.readFileSync(LEDGER);
const ledger = JSON.parse(ledgerBytes.toString('utf8'));
if (queue?.schema_version !== EXPECTED_QUEUE_SCHEMA) fail(`wrong queue schema: ${queue?.schema_version}`);
if (!Array.isArray(queue.players) || queue.players.length !== 100) fail('queue fixture is not 100 players');
if (queue?.construct?.top_speed_only_finalization_forbidden !== true) fail('queue lacks full-construct top-speed-only guard');
if (ledger?.queue_source?.path !== 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json') fail('ledger is not bound to the construct-complete queue path');
if (ledger?.queue_source?.schema_version !== EXPECTED_QUEUE_SCHEMA) fail('ledger is not bound to the construct-complete queue schema');
if (ledger?.queue_source?.sha256 !== sha256(queueBytes)) fail('ledger queue hash does not match the construct-complete queue bytes');
if (Number(ledger?.queue_source?.row_count) !== 100) fail('ledger queue row_count is not 100');

if (lock.locked === false) {
  console.log(JSON.stringify({
    qa: 'PASS',
    owner_review_locked: false,
    construct_complete_queue_binding_verified: true,
    owner_verdict_count: Number(ledger.owner_verdict_count),
    no_synthetic_owner_write_attempted: true,
  }));
  process.exit(0);
}
if (lock.locked !== true) fail('integrity lock must be boolean true/false');
if (Number(ledger.owner_verdict_count) !== 0 || ledger.records?.length !== 0) fail('locked transition requires the owner-verdict ledger to remain empty');
const queueRowKey = queue.players[0]?.queue_row_key;
if (!queueRowKey) fail('queue fixture has no first row key');

const before = fs.readFileSync(LEDGER);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp078-integrity-lock-'));
try {
  const input = path.join(tempDir, 'attempt.json');
  fs.writeFileSync(input, JSON.stringify({
    events: [{
      event_id: 'LOCK-FIXTURE-MUST-NOT-WRITE',
      queue_row_key: queueRowKey,
      verdict: 'UNRESOLVED',
      timestamp: '2026-08-17T00:00:00Z',
      source: 'qa_sp078_integrity_lock_20260817',
      reviewer: 'fixture',
      note: 'This event must never be persisted while the integrity lock is active.'
    }]
  }, null, 2) + '\n');

  const result = spawnSync(process.execPath, [CAPTURE, '--input', input], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status === 0) fail('SP-078 accepted a verdict while integrity lock was active');
  if (!/owner-review integrity lock is active/.test(output)) fail(`SP-078 failed for the wrong reason: ${output.trim()}`);

  const after = fs.readFileSync(LEDGER);
  if (!before.equals(after)) fail('rejected locked write mutated the real owner-verdict ledger');
  const afterLedger = JSON.parse(after.toString('utf8'));
  if (Number(afterLedger.owner_verdict_count) !== 0 || afterLedger.records?.length !== 0) fail('owner-verdict ledger is no longer empty');

  console.log(JSON.stringify({
    qa: 'PASS',
    owner_review_locked: true,
    construct_complete_queue_binding_verified: true,
    locked_write_rejected: true,
    ledger_byte_identical_after_rejection: true,
    owner_verdict_count: 0,
  }));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// Destructive-looking but non-mutating regression fixture for the 2026-08-17 owner-review lock.
// It attempts a valid-looking SP-078 owner verdict while the integrity lock is active,
// requires the capture command to fail, and byte-compares the real ledger before/after.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURE = path.join(ROOT, 'scripts/sp078_owner_verdict_capture_20260816.mjs');
const QUEUE = path.join(ROOT, 'outputs/derived/sp077_final_owner_review_queue_20260816.json');
const LEDGER = path.join(ROOT, 'outputs/derived/sp078_owner_verdict_ledger_20260816.json');
const LOCK = path.join(ROOT, 'docs/state/speed_owner_review_integrity_lock_20260817.json');

const fail = message => { console.error(`FAIL: ${message}`); process.exit(1); };
for (const abs of [CAPTURE, QUEUE, LEDGER, LOCK]) if (!fs.existsSync(abs)) fail(`missing fixture dependency: ${path.relative(ROOT, abs)}`);

const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
if (lock.locked !== true) fail('fixture requires the integrity lock to be active');
const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
if (!Array.isArray(queue.players) || queue.players.length !== 100) fail('queue fixture is not 100 players');
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
  const ledger = JSON.parse(after.toString('utf8'));
  if (Number(ledger.owner_verdict_count) !== 0 || ledger.records?.length !== 0) fail('owner-verdict ledger is no longer empty');

  console.log(JSON.stringify({
    qa: 'PASS',
    locked_write_rejected: true,
    ledger_byte_identical_after_rejection: true,
    owner_verdict_count: 0,
  }));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// SP-078 durable, append-only owner-verdict capture.
//
// Initialisation creates an empty ledger.  Capturing a verdict requires a
// queue row key plus timestamp/source/reviewer.  A second ordinary write to
// the same row is rejected; an explicit amendment appends an event and keeps
// the prior event intact, so regeneration cannot silently overwrite owner
// input.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = '2026-08-16';
const DEFAULT_QUEUE = 'outputs/derived/sp077_final_owner_review_queue_20260816.json';
const DEFAULT_LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';
const ALLOWED_VERDICTS = new Set([
  'POWERPRO_PLAUSIBLE', 'POWERPRO_TOO_HIGH_OR_STALE', 'POWERPRO_TOO_LOW',
  'PROJECT_TOO_HIGH', 'PROJECT_TOO_LOW', 'BOTH_QUESTIONABLE', 'UNRESOLVED', 'OTHER',
]);

const full = value => path.isAbsolute(value) ? value : path.join(ROOT, value);
const sha256 = value => createHash('sha256').update(value).digest('hex');
function fail(message) { throw new Error(`SP-078 fail-closed: ${message}`); }
function requireOk(condition, message) { if (!condition) fail(message); }
function readJson(abs) {
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch (error) { fail(`invalid JSON ${abs}: ${error.message}`); }
}
function writeAtomic(abs, body) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const temp = `${abs}.tmp-${process.pid}`;
  fs.writeFileSync(temp, body, 'utf8');
  fs.renameSync(temp, abs);
}
function argument(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  requireOk(value && !value.startsWith('--'), `${flag} needs a value`);
  return value;
}
function queueInfo(queuePath) {
  const queueText = fs.readFileSync(queuePath, 'utf8');
  const queue = JSON.parse(queueText);
  requireOk(queue?.schema_version === 'sp077_final_owner_review_queue_20260816', 'not an SP-077 final queue');
  requireOk(Array.isArray(queue.players) && queue.players.length === 100, 'queue does not contain the exact current-100 population');
  const rowKeys = new Set(queue.players.map(row => row.queue_row_key));
  requireOk(rowKeys.size === queue.players.length && !rowKeys.has(undefined), 'queue row keys are not unique');
  return { queue, rowKeys, sha256: sha256(queueText) };
}
function emptyLedger(queuePath, info) {
  return {
    schema_version: 'sp078_owner_verdict_ledger_20260816',
    created_at: DATE,
    queue_source: { path: path.relative(ROOT, queuePath).replace(/\\/g, '/'), sha256: info.sha256, row_count: info.queue.players.length },
    allowed_verdicts: [...ALLOWED_VERDICTS],
    required_event_fields: ['event_id', 'queue_row_key', 'verdict', 'timestamp', 'source', 'reviewer'],
    append_update_semantics: {
      ordinary_duplicate_write: 'REJECTED_NO_SILENT_OVERWRITE',
      amendment: 'APPEND_ONLY_REQUIRES_EXPLICIT_SUPERSEDES_EVENT_ID',
      historical_events_preserved: true,
    },
    records: [],
    owner_verdict_count: 0,
  };
}
function activeRecords(records) {
  const superseded = new Set(records.map(record => record.supersedes_event_id).filter(Boolean));
  return records.filter(record => !superseded.has(record.event_id));
}
function validateLedger(ledger, info) {
  requireOk(ledger?.schema_version === 'sp078_owner_verdict_ledger_20260816', 'ledger schema mismatch');
  requireOk(Array.isArray(ledger.records), 'ledger records are not an array');
  requireOk(ledger.queue_source?.sha256 === info.sha256, 'queue source changed; refuse to write verdicts against a different queue');
  const eventIds = new Set();
  for (const record of ledger.records) {
    requireOk(record && typeof record === 'object', 'ledger has invalid record');
    requireOk(typeof record.event_id === 'string' && record.event_id, 'record has no event_id');
    requireOk(!eventIds.has(record.event_id), `duplicate event_id ${record.event_id}`);
    eventIds.add(record.event_id);
    requireOk(info.rowKeys.has(record.queue_row_key), `record refers to unknown queue row ${record.queue_row_key}`);
    requireOk(ALLOWED_VERDICTS.has(record.verdict), `record has invalid verdict ${record.verdict}`);
    for (const field of ['timestamp', 'source', 'reviewer']) requireOk(typeof record[field] === 'string' && record[field].trim(), `record ${record.event_id} lacks ${field}`);
    if (record.supersedes_event_id != null) requireOk(eventIds.has(record.supersedes_event_id), `record ${record.event_id} supersedes unknown/prior event`);
  }
  requireOk(Number(ledger.owner_verdict_count) === activeRecords(ledger.records).length, 'ledger owner_verdict_count does not match active append-only records');
}
function normalizedEvent(raw, info, existing, isAmendment) {
  requireOk(raw && typeof raw === 'object', 'input event is not an object');
  const event = {
    event_id: String(raw.event_id ?? '').trim(),
    queue_row_key: String(raw.queue_row_key ?? '').trim(),
    verdict: String(raw.verdict ?? '').trim(),
    timestamp: String(raw.timestamp ?? '').trim(),
    source: String(raw.source ?? '').trim(),
    reviewer: String(raw.reviewer ?? '').trim(),
    note: raw.note == null ? null : String(raw.note),
    preferred_rating_optional: raw.preferred_rating_optional ?? null,
    supersedes_event_id: raw.supersedes_event_id == null ? null : String(raw.supersedes_event_id).trim(),
    event_type: isAmendment ? 'AMENDMENT' : 'INITIAL_OWNER_VERDICT',
  };
  for (const field of ['event_id', 'queue_row_key', 'timestamp', 'source', 'reviewer']) requireOk(event[field], `input event lacks ${field}`);
  requireOk(info.rowKeys.has(event.queue_row_key), `input event points to unknown queue row ${event.queue_row_key}`);
  requireOk(ALLOWED_VERDICTS.has(event.verdict), `input event has unsupported verdict ${event.verdict}`);
  requireOk(!existing.some(record => record.event_id === event.event_id), `event_id already exists: ${event.event_id}`);
  const activeForRow = activeRecords(existing).filter(record => record.queue_row_key === event.queue_row_key);
  if (!isAmendment) {
    requireOk(activeForRow.length === 0, `owner verdict already exists for ${event.queue_row_key}; use --amend with an explicit supersedes_event_id`);
    requireOk(event.supersedes_event_id == null, 'ordinary append must not set supersedes_event_id');
  } else {
    requireOk(activeForRow.length === 1, `amendment requires exactly one active prior verdict for ${event.queue_row_key}`);
    requireOk(event.supersedes_event_id === activeForRow[0].event_id, `amendment must explicitly supersede ${activeForRow[0].event_id}`);
  }
  return event;
}
function appendEvents(ledger, info, rawEvents, isAmendment) {
  validateLedger(ledger, info);
  requireOk(Array.isArray(rawEvents) && rawEvents.length > 0, 'input has no events');
  const next = JSON.parse(JSON.stringify(ledger));
  for (const raw of rawEvents) {
    const event = normalizedEvent(raw, info, next.records, isAmendment);
    next.records.push(event);
  }
  next.owner_verdict_count = activeRecords(next.records).length;
  validateLedger(next, info);
  return next;
}
function selfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp078-owner-verdict-'));
  try {
    const queuePath = path.join(temp, 'queue.json');
    const queue = { schema_version: 'sp077_final_owner_review_queue_20260816', players: Array.from({ length: 100 }, (_, index) => ({ queue_row_key: `SP077:fixture-${index + 1}` })) };
    fs.writeFileSync(queuePath, JSON.stringify(queue) + '\n', 'utf8');
    const info = queueInfo(queuePath);
    const original = emptyLedger(queuePath, info);
    const first = { event_id: 'fixture-1', queue_row_key: 'SP077:fixture-1', verdict: 'UNRESOLVED', timestamp: '2026-08-16T00:00:00Z', source: 'fixture', reviewer: 'fixture-reviewer' };
    const once = appendEvents(original, info, [first], false);
    const beforeAttempt = JSON.stringify(once);
    let duplicateRejected = false;
    try { appendEvents(once, info, [{ ...first, event_id: 'fixture-2', verdict: 'OTHER' }], false); }
    catch (error) { duplicateRejected = /already exists/.test(error.message); }
    requireOk(duplicateRejected, 'duplicate ordinary verdict fixture was not rejected');
    requireOk(JSON.stringify(once) === beforeAttempt, 'rejected overwrite mutated prior ledger');
    const amended = appendEvents(once, info, [{ ...first, event_id: 'fixture-3', verdict: 'OTHER', supersedes_event_id: 'fixture-1' }], true);
    requireOk(amended.records.length === 2 && amended.records[0].event_id === 'fixture-1', 'amendment did not preserve prior event');
    requireOk(amended.owner_verdict_count === 1, 'amendment active verdict count is incorrect');
    console.log(JSON.stringify({ self_test: 'PASS', duplicate_overwrite_rejected: true, explicit_amendment_preserves_history: true }));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv.includes('--self-test')) { selfTest(); process.exit(0); }

const queuePath = full(argument('--queue', DEFAULT_QUEUE));
const ledgerPath = full(argument('--ledger', DEFAULT_LEDGER));
const info = queueInfo(queuePath);
if (process.argv.includes('--initialize')) {
  requireOk(!fs.existsSync(ledgerPath), `ledger already exists: ${ledgerPath}`);
  const ledger = emptyLedger(queuePath, info);
  writeAtomic(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  console.log(JSON.stringify({ initialized: true, ledger: path.relative(ROOT, ledgerPath), owner_verdict_count: 0, queue_rows: 100 }));
  process.exit(0);
}

const inputPath = argument('--input');
requireOk(inputPath, 'use --initialize, --self-test, or supply --input <JSON>');
requireOk(fs.existsSync(ledgerPath), `ledger does not exist: ${ledgerPath}`);
const payload = readJson(full(inputPath));
const events = Array.isArray(payload) ? payload : payload.events;
const ledger = readJson(ledgerPath);
const next = appendEvents(ledger, info, events, process.argv.includes('--amend'));
writeAtomic(ledgerPath, JSON.stringify(next, null, 2) + '\n');
console.log(JSON.stringify({ captured: events.length, owner_verdict_count: next.owner_verdict_count, append_only: true }));

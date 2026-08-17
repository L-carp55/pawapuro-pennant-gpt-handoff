// Fail-closed QA for end-to-end speed-construct preservation.
// Validates the construct-complete SP-077 queue, not the superseded narrow queue.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = 'docs/state/speed_construct_traceability_contract_20260817.tsv';
const LOCK = 'docs/state/speed_owner_review_integrity_lock_20260817.json';
const REQ = 'docs/state/speed_requirements_baseline_20260813.tsv';
const REG = 'docs/state/speed_task_registry.tsv';
const QUEUE = 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json';
const QUEUE_QA = 'outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json';
const LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';

const REQUIRED_LANES = new Set([
  'SC-001','SC-002','SC-003','SC-004','SC-005','SC-006',
  'SC-007','SC-008','SC-009','SC-010','SC-011','SC-012',
]);
const ALLOWED_RESOLUTION = new Set(['INTEGRATED','BOUNDED_MISSING','SCOPED_EXCLUSION','UNRESOLVED']);
const CLOSED = new Set(['DONE_VALIDATED','DONE_NEGATIVE_FINDING','SUPERSEDED','OBSOLETE_DUPLICATE']);
const errors = [];
const warnings = [];
const err = message => errors.push(message);
const warn = message => warnings.push(message);
const list = value => String(value || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);

function parseTsv(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing TSV: ${rel}`);
  const raw = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) throw new Error(`empty/invalid TSV: ${rel}`);
  const header = lines[0].split('\t');
  return lines.slice(1).filter(Boolean).map((line, index) => {
    const cells = line.split('\t');
    if (cells.length !== header.length) throw new Error(`${rel}:${index + 2} has ${cells.length} cells; expected ${header.length}`);
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}
function readJson(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing JSON: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}
function hasPath(object, dottedPath) {
  const parts = String(dottedPath || '').split('.').filter(Boolean);
  let current = object;
  for (const part of parts) {
    if (current == null || typeof current !== 'object' || !(part in current)) return false;
    current = current[part];
  }
  return true;
}

let contract, requirements, tasks, lock, queue, queueQa, ledger;
try {
  contract = parseTsv(CONTRACT);
  requirements = parseTsv(REQ);
  tasks = parseTsv(REG);
  lock = readJson(LOCK);
  queue = readJson(QUEUE);
  queueQa = readJson(QUEUE_QA);
  ledger = readJson(LEDGER);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}

const requirementIds = new Set(requirements.map(row => row.requirement_id));
const taskById = new Map(tasks.map(row => [row.task_id, row]));
const laneById = new Map();
for (const row of contract) {
  if (!/^SC-\d+$/.test(row.lane_id)) err(`invalid lane_id: ${row.lane_id}`);
  if (laneById.has(row.lane_id)) err(`duplicate construct lane: ${row.lane_id}`);
  laneById.set(row.lane_id, row);
  if (row.required_for_owner_review !== '0' && row.required_for_owner_review !== '1') err(`${row.lane_id}: required_for_owner_review must be 0/1`);
  if (!ALLOWED_RESOLUTION.has(row.current_resolution)) err(`${row.lane_id}: invalid current_resolution ${row.current_resolution}`);
  if (!String(row.per_player_queue_field || '').trim()) err(`${row.lane_id}: missing per_player_queue_field`);
  if (!String(row.notes || '').trim()) err(`${row.lane_id}: missing explanatory notes`);
  for (const requirementId of list(row.requirement_refs)) {
    if (!requirementIds.has(requirementId)) err(`${row.lane_id}: unknown requirement ${requirementId}`);
  }
  const sourceTasks = list(row.source_tasks);
  if (!sourceTasks.length) err(`${row.lane_id}: has no source_tasks`);
  for (const taskId of sourceTasks) {
    if (!taskById.has(taskId)) err(`${row.lane_id}: unknown source task ${taskId}`);
  }
}
for (const laneId of REQUIRED_LANES) if (!laneById.has(laneId)) err(`missing mandatory construct lane ${laneId}`);
for (const laneId of laneById.keys()) if (!REQUIRED_LANES.has(laneId)) warn(`extra construct lane ${laneId}; review whether it should become mandatory`);

if (lock?.schema_version !== 'speed_owner_review_integrity_lock_20260817') err('integrity lock schema mismatch');
if (typeof lock?.locked !== 'boolean') err('integrity lock must contain boolean locked');
if (!Array.isArray(lock?.unlock_conditions) || lock.unlock_conditions.length < 5) err('integrity lock has insufficient unlock conditions');
if (!Array.isArray(queue?.players) || queue.players.length !== 100) err('construct-complete owner-review queue is not exact current-100 population');
if (!Array.isArray(ledger?.records)) err('SP-078 ledger records are not an array');

// Independent source-derived QA is mandatory; this prevents the contract itself
// from being edited merely to make traceability pass.
if (queueQa?.status !== 'PASS') err(`construct-complete independent QA status is ${queueQa?.status ?? 'MISSING'}, expected PASS`);
if (Number(queueQa?.checks_failed ?? NaN) !== 0) err(`construct-complete independent QA has ${queueQa?.checks_failed ?? 'unknown'} failures`);
if (Number(queueQa?.checks_passed ?? NaN) !== Number(queueQa?.checks_total ?? NaN)) err('construct-complete independent QA passed/total mismatch');
if (Number(queueQa?.coverage?.players ?? NaN) !== 100) err('construct-complete independent QA does not cover exactly 100 players');

const unresolved = contract.filter(row => row.required_for_owner_review === '1' && row.current_resolution === 'UNRESOLVED');
const resolvedRequired = contract.filter(row => row.required_for_owner_review === '1' && row.current_resolution !== 'UNRESOLVED');

// Any lane marked resolved must actually be represented on every queue row.
// A lane may hold explicit missingness, but the lane object itself must exist.
if (Array.isArray(queue?.players)) {
  for (const row of resolvedRequired) {
    const missingRows = queue.players.filter(player => !hasPath(player, row.per_player_queue_field));
    if (missingRows.length) {
      err(`${row.lane_id}: marked ${row.current_resolution} but queue field ${row.per_player_queue_field} is absent on ${missingRows.length}/100 rows`);
    }
  }
}

// All queue verdicts must still be blank at traceability-unlock time.
if (Array.isArray(queue?.players)) {
  const prefilled = queue.players.filter(player => player?.owner_verdict?.status !== 'NOT_ENTERED' || player?.owner_verdict?.verdict != null);
  if (prefilled.length) err(`construct-complete queue contains ${prefilled.length} prefilled owner verdict(s)`);
}

const ownerVerdictCount = Number(ledger?.owner_verdict_count ?? NaN);
if (!Number.isInteger(ownerVerdictCount) || ownerVerdictCount < 0) err('SP-078 owner_verdict_count is invalid');
if (Array.isArray(ledger?.records) && Number.isInteger(ownerVerdictCount) && ledger.records.length < ownerVerdictCount) err('SP-078 record count is smaller than owner_verdict_count');

const sp077 = taskById.get('SP-077');
const sp078 = taskById.get('SP-078');
const sp079 = taskById.get('SP-079');
if (!sp077) err('SP-077 missing from task registry');
if (!sp078) err('SP-078 missing from task registry');
if (!sp079) err('SP-079 missing from task registry');

if (lock?.locked === true) {
  if (ownerVerdictCount !== 0 || (Array.isArray(ledger.records) && ledger.records.length !== 0)) {
    err('OWNER REVIEW LOCKED but SP-078 contains owner verdict history');
  }
  if (sp079 && CLOSED.has(sp079.status)) err(`OWNER REVIEW LOCKED but SP-079 is ${sp079.status}`);
  if (!unresolved.length) warn('all required construct lanes are resolved while integrity lock remains true; independent review and explicit unlock transition are still required');
} else if (lock?.locked === false) {
  if (unresolved.length) err(`integrity lock is false with unresolved construct lanes: ${unresolved.map(row => row.lane_id).join(',')}`);
  if (Array.isArray(queue?.players)) {
    for (const row of contract.filter(x => x.required_for_owner_review === '1')) {
      const missingRows = queue.players.filter(player => !hasPath(player, row.per_player_queue_field));
      if (missingRows.length) err(`unlock invalid: ${row.lane_id} field ${row.per_player_queue_field} absent on ${missingRows.length}/100 rows`);
    }
  }
  if (sp077?.status !== 'DONE_VALIDATED') err(`unlock invalid: SP-077=${sp077?.status ?? 'MISSING'}, expected DONE_VALIDATED`);
  if (sp078?.status !== 'DONE_VALIDATED') err(`unlock invalid: SP-078=${sp078?.status ?? 'MISSING'}, expected DONE_VALIDATED`);
}

// Explicitly protect against the original conceptual collapse.
const topSpeed = laneById.get('SC-002');
const acceleration = laneById.get('SC-003');
const shortDistance = laneById.get('SC-004');
if (topSpeed?.current_resolution === 'INTEGRATED'
    && (acceleration?.current_resolution === 'UNRESOLVED' || shortDistance?.current_resolution === 'UNRESOLVED')
    && lock?.locked !== true) {
  err('single-lane collapse detected: top speed integrated while acceleration or short-distance lane unresolved, but owner review is not locked');
}

if (warnings.length) {
  console.warn('WARNINGS:');
  for (const message of warnings) console.warn(`- ${message}`);
}
if (errors.length) {
  console.error(`FAIL: construct traceability QA found ${errors.length} error(s)`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`PASS: construct_lanes=${contract.length}, unresolved_required=${unresolved.length}, owner_verdict_count=${ownerVerdictCount}, OWNER_REVIEW_LOCKED=${lock.locked ? 1 : 0}`);
if (lock.locked) {
  console.log('CONSTRUCT_TRACEABILITY_READY_FOR_INDEPENDENT_UNLOCK_REVIEW=1; OWNER REVIEW REMAINS BLOCKED until lock transition and SP-078 rebind complete.');
} else {
  console.log('OWNER_REVIEW_READY_BY_CONSTRUCT_TRACEABILITY=1; existing registry/exclusion QA must also pass before proceeding.');
}

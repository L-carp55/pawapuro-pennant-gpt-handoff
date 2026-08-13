// Fail-closed QA for the speed-rebuild task/requirement registry.
// Run before saying owner review is ready, before closing the Speed Gate,
// and before creating a new handoff/current-state document.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQ = 'docs/state/speed_requirements_baseline_20260813.tsv';
const REG = 'docs/state/speed_task_registry.tsv';
const LEGACY = 'docs/state/speed_legacy_open_item_map.tsv';
const ENTRYPOINTS = [
  'CLAUDE.md',
  'docs/satei_handoff/00_README_AND_HANDOFF.md',
  'docs/satei_handoff/MANIFEST.md',
  'docs/satei_handoff/22_CURRENT_STATE_AND_AUTONOMOUS_CONTINUATION_20260813.md',
];
const ALLOWED = new Set([
  'DONE_VALIDATED','DONE_NEGATIVE_FINDING','PARTIAL','NOT_STARTED',
  'BLOCKED_MISSING_DATA','BLOCKED_DEPENDENCY','WAITING_EXTERNAL',
  'SUPERSEDED','OBSOLETE_DUPLICATE',
]);
const CLOSED = new Set(['DONE_VALIDATED','DONE_NEGATIVE_FINDING','SUPERSEDED','OBSOLETE_DUPLICATE']);
const KNOWN_EMPTY_HISTORICAL = new Set([
  'docs/audits/2026-08-07_speed_fielding_catching_arm_redesign.md',
  '_codex_work_20260805/npb_merge_measurements_20260805.mjs',
]);

function parseTsv(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing registry file: ${rel}`);
  const raw = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) throw new Error(`empty/invalid TSV: ${rel}`);
  const head = lines[0].split('\t');
  return lines.slice(1).filter(Boolean).map((line, i) => {
    const cells = line.split('\t');
    if (cells.length !== head.length) throw new Error(`${rel}:${i+2} has ${cells.length} cells; expected ${head.length}`);
    return Object.fromEntries(head.map((h, j) => [h, cells[j]]));
  });
}
const list = s => (s || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
const existsNonempty = rel => {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.statSync(abs).size > 0;
};
const errors = [];
const warnings = [];
const err = s => errors.push(s);
const warn = s => warnings.push(s);

let reqs, tasks, legacy;
try {
  reqs = parseTsv(REQ);
  tasks = parseTsv(REG);
  legacy = parseTsv(LEGACY);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
}

// 1) Unique IDs + valid status.
const reqIds = new Set();
for (const r of reqs) {
  if (!/^SR-\d+$/.test(r.requirement_id)) err(`invalid requirement_id: ${r.requirement_id}`);
  if (reqIds.has(r.requirement_id)) err(`duplicate requirement: ${r.requirement_id}`);
  reqIds.add(r.requirement_id);
}
const taskIds = new Set();
const byId = new Map();
for (const t of tasks) {
  if (!/^SP-\d+$/.test(t.task_id)) err(`invalid task_id: ${t.task_id}`);
  if (taskIds.has(t.task_id)) err(`duplicate task: ${t.task_id}`);
  taskIds.add(t.task_id); byId.set(t.task_id, t);
  if (!ALLOWED.has(t.status)) err(`${t.task_id}: invalid status ${t.status}`);
}

// 2) Immutable requirements must never disappear from the current registry.
const covered = new Map([...reqIds].map(x => [x, []]));
for (const t of tasks) {
  for (const r of list(t.requirement_ids)) {
    if (!reqIds.has(r)) err(`${t.task_id}: unknown requirement ${r}`);
    else covered.get(r).push(t.task_id);
  }
}
for (const [r, xs] of covered) if (!xs.length) err(`UNMAPPED REQUIREMENT: ${r} disappeared from task registry`);

// 3) Open work must have an explicit next action/blocker. Closed work must have real, nonempty artifacts.
for (const t of tasks) {
  const arts = list(t.artifacts);
  if (!CLOSED.has(t.status) && !t.next_action_or_blocker.trim()) {
    err(`${t.task_id}: open task has no next action/blocker`);
  }
  if (CLOSED.has(t.status)) {
    if (!arts.length) err(`${t.task_id}: ${t.status} has no completion artifact`);
    for (const a of arts) {
      if (!existsNonempty(a)) err(`${t.task_id}: completion artifact missing/empty: ${a}`);
      if (KNOWN_EMPTY_HISTORICAL.has(a)) err(`${t.task_id}: historical empty placeholder cannot prove completion: ${a}`);
    }
  } else {
    for (const a of arts) {
      const abs = path.join(ROOT, a);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.statSync(abs).size === 0) {
        err(`${t.task_id}: active task references zero-byte artifact: ${a}`);
      }
    }
  }
}

// 4) Dependencies: a closed child cannot claim completion while a required dependency is still open.
for (const t of tasks) {
  const deps = list(t.depends_on);
  for (const d of deps) {
    if (!byId.has(d)) err(`${t.task_id}: unknown dependency ${d}`);
    else if (CLOSED.has(t.status) && !CLOSED.has(byId.get(d).status)) {
      err(`${t.task_id}: closed while dependency ${d} is ${byId.get(d).status}`);
    }
  }
}

// 5) Legacy migration map: every old open phase/item must map to current task IDs; source must still exist.
for (const m of legacy) {
  if (!fs.existsSync(path.join(ROOT, m.source))) err(`legacy map source missing: ${m.source}`);
  const xs = list(m.task_ids);
  if (!xs.length) err(`legacy map has no task mapping: ${m.source} :: ${m.section}`);
  for (const x of xs) if (!byId.has(x)) err(`legacy map references unknown task ${x}: ${m.source} :: ${m.section}`);
}

// 6) Hard gates: preliminary/final review or Gate cannot bypass unfinished prerequisites.
const ownerBlocks = tasks.filter(t => t.owner_review_block === '1' && !CLOSED.has(t.status));
const gateBlocks = tasks.filter(t => t.gate_block === '1' && !CLOSED.has(t.status));
const finalQueue = byId.get('SP-077');
if (finalQueue && CLOSED.has(finalQueue.status) && ownerBlocks.length) {
  err(`SP-077 owner queue closed with ${ownerBlocks.length} owner-review blockers open: ${ownerBlocks.map(x=>x.task_id).join(',')}`);
}
const gate = byId.get('SP-081');
if (gate && CLOSED.has(gate.status) && gateBlocks.length) {
  err(`SP-081 Speed Gate closed with ${gateBlocks.length} gate blockers open: ${gateBlocks.map(x=>x.task_id).join(',')}`);
}
const shoulder = byId.get('SP-082');
if (shoulder && CLOSED.has(shoulder.status) && (!gate || !CLOSED.has(gate.status))) {
  err('SP-082 shoulder handoff closed before Speed Gate');
}

// 7) Entrypoint convergence. No new session should be routed to stale prose as authority.
for (const rel of ENTRYPOINTS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { err(`missing entrypoint: ${rel}`); continue; }
  const s = fs.readFileSync(abs, 'utf8');
  if (!s.includes(REG)) err(`${rel}: does not point to canonical task registry ${REG}`);
  if (!s.includes(REQ)) err(`${rel}: does not point to immutable requirements baseline ${REQ}`);
}

// 8) Known empty historical artifacts are allowed only as explicit historical exceptions, never completion evidence.
for (const rel of KNOWN_EMPTY_HISTORICAL) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.statSync(abs).size !== 0) {
    warn(`known-empty historical file is no longer empty; remove from exception list after review: ${rel}`);
  }
}

// 9) Guardrail for stale owner queue: old queue must remain superseded until SP-077 is truly ready.
const oldQueue = byId.get('SP-076');
if (oldQueue && oldQueue.status !== 'SUPERSEDED') err('SP-076 preliminary owner queue must remain SUPERSEDED');

if (warnings.length) {
  console.warn('WARNINGS:');
  for (const w of warnings) console.warn(`- ${w}`);
}
if (errors.length) {
  console.error(`FAIL: speed task registry QA found ${errors.length} error(s)`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(`PASS: requirements=${reqs.length}, tasks=${tasks.length}, owner_review_blockers=${ownerBlocks.length}, gate_blockers=${gateBlocks.length}`);
console.log('Owner review and Speed Gate remain fail-closed until their blocker counts reach zero.');

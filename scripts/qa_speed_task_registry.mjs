// Fail-closed QA for the speed-rebuild task/requirement/exclusion registries.
// Run before saying owner review is ready, before closing the Speed Gate,
// and before creating a new handoff/current-state document.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQ = 'docs/state/speed_requirements_baseline_20260813.tsv';
const REG = 'docs/state/speed_task_registry.tsv';
const LEGACY = 'docs/state/speed_legacy_open_item_map.tsv';
const EXCL = 'docs/state/speed_exclusion_reason_ledger.tsv';
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
const EXCL_OPEN = new Set([
  'WRONG_AS_ZERO_REOPEN','OVERBROAD_REOPEN','WRONG_HARD_THRESHOLD_REOPEN',
  'WRONG_VALIDATION_TARGET_REOPEN','WRONG_ACCEPTANCE_CRITERION_REOPEN',
  'POLICY_CONFLICT_REOPEN','WRONG_LANE_REOPEN','OVERSTRICT_REOPEN',
  'SCOPE_OVERREACH_REOPEN','REASSESS_REQUIRED',
]);
// 検証を実施したが direct physical evidence では識別できなかった状態。
// ★2026-08-14 オーナー裁定で **正式な終端状態** として認められた
// （「無理に閉じず NOT_IDENTIFIABLE_PROVISIONAL を正式な状態としてよい」）。
// したがって:
//   - 是正タスクが全て閉じていてもエラーにしない（調査は完了し、答えが「識別不能」だった）
//   - 「妥当な除外(VALID_*)」とは別枠で数え、見えなくならないようにする
//   - 決着条件を corrected_policy に書くことを運用で要求する
const EXCL_UNRESOLVED_TERMINAL = new Set([
  'NOT_IDENTIFIABLE_PROVISIONAL_CURRENT_BEHAVIOR',
]);
const EXCL_VALID = new Set([
  'VALID_EXCLUSION_FROM_DIRECT_SPEED','VALID_TRANSFORMATION_EXCLUSION',
  'VALID_DOWNGRADE_NOT_ZERO','VALID_DEDUP','VALID_EXCLUSION','VALID_NUMERIC_EXCLUSION',
]);
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

let reqs, tasks, legacy, exclusions;
try {
  reqs = parseTsv(REQ);
  tasks = parseTsv(REG);
  legacy = parseTsv(LEGACY);
  exclusions = parseTsv(EXCL);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
}

// 1) Unique IDs + valid task status.
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

// 3b) 成果物の中身の検査（2026-08-14 追加）。
//   従来は existsSync && size>0 しか見ていなかったため、**文字列リテラルだけを書いた
//   0レコードの成果物**で DONE を主張できた（SP-062 / SP-045 / SP-090 が実際にそうなっていた）。
//   ここでは「列挙された証拠が1件以上あるか」を機械で見る。
//   列挙が無い成果物で閉じたい場合は、次の2つを明示する必要がある:
//     - 行の next_action_or_blocker に `EVIDENCE_STATUS=MEASURED_NEGATIVE`（探して0件だった）
//     - または `EVIDENCE_STATUS=NOT_COLLECTED`（探していない）→ この場合 DONE 系は名乗れない
function artifactSubstance(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  const bytes = fs.statSync(abs).size;
  if (/\.jsonl$/i.test(rel)) {
    const n = fs.readFileSync(abs, 'utf8').split(/\r?\n/).filter(Boolean).length;
    return { bytes, maxArray: n, text: '' };
  }
  if (!/\.json$/i.test(rel)) return { bytes, maxArray: null, text: '' };
  let j;
  try { j = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return { bytes, maxArray: null, text: '' }; }
  let maxArray = 0;
  const walk = (v, d) => {
    if (d > 6 || v == null) return;
    if (Array.isArray(v)) { if (v.length > maxArray) maxArray = v.length; v.slice(0, 50).forEach(x => walk(x, d + 1)); }
    else if (typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], d + 1);
  };
  walk(j, 0);
  return { bytes, maxArray, text: JSON.stringify(j) };
}
for (const t of tasks) {
  if (!CLOSED.has(t.status)) continue;
  const arts = list(t.artifacts).filter(a => /\.(json|jsonl)$/i.test(a));
  if (!arts.length) continue;                       // md のみの成果物はここでは判定しない
  const decl = /EVIDENCE_STATUS=([A-Z_]+)/.exec(t.next_action_or_blocker || '');
  const subs = arts.map(a => ({ a, s: artifactSubstance(a) })).filter(x => x.s);
  const best = subs.reduce((m, x) => (x.s.maxArray ?? 0) > (m?.s?.maxArray ?? -1) ? x : m, null);
  const enumerated = best ? (best.s.maxArray ?? 0) : 0;
  if (enumerated < 1) {
    if (!decl) {
      err(`${t.task_id}: ${t.status} だが成果物に列挙された証拠が0件（${arts.join(',')}）。`
        + `実測して0件なら next_action_or_blocker に EVIDENCE_STATUS=MEASURED_NEGATIVE を明記すること`);
    } else if (decl[1] === 'NOT_COLLECTED') {
      err(`${t.task_id}: EVIDENCE_STATUS=NOT_COLLECTED を DONE系(${t.status}) で閉じている。`
        + `取得不能を証拠不存在と混同しない（CLAUDE.md 絶対禁止）`);
    }
  }
  // 3c) DONE_NEGATIVE_FINDING は「探した」ことを成果物自身が示す必要がある
  if (t.status === 'DONE_NEGATIVE_FINDING') {
    const txt = subs.map(x => x.s.text).join(' ');
    const okNeg = /"evidence_status"\s*:\s*"(MEASURED_NEGATIVE|NOT_IDENTIFIABLE)"/.test(txt)
      || (decl && (decl[1] === 'MEASURED_NEGATIVE' || decl[1] === 'NOT_IDENTIFIABLE'));
    if (!okNeg) {
      err(`${t.task_id}: DONE_NEGATIVE_FINDING だが成果物に evidence_status=MEASURED_NEGATIVE の記録が無い。`
        + `「取得しなかった」と「探して0件だった」を成果物で区別すること`);
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

// 6) Exclusion-reason ledger. An invalid/overbroad exclusion may not silently disappear or be
// declared resolved while all of its corrective tasks are still open/absent.
const exclusionIds = new Set();
for (const x of exclusions) {
  if (!/^EX-\d+$/.test(x.exclusion_id)) err(`invalid exclusion_id: ${x.exclusion_id}`);
  if (exclusionIds.has(x.exclusion_id)) err(`duplicate exclusion: ${x.exclusion_id}`);
  exclusionIds.add(x.exclusion_id);
  if (!EXCL_OPEN.has(x.verdict) && !EXCL_VALID.has(x.verdict) && !EXCL_UNRESOLVED_TERMINAL.has(x.verdict)) err(`${x.exclusion_id}: invalid exclusion verdict ${x.verdict}`);

  const xs = list(x.task_ids);
  for (const taskId of xs) if (!byId.has(taskId)) err(`${x.exclusion_id}: references unknown task ${taskId}`);

  const evidence = list(x.evidence);
  if (!evidence.length) err(`${x.exclusion_id}: has no evidence/provenance artifact`);
  for (const a of evidence) if (!existsNonempty(a)) err(`${x.exclusion_id}: evidence artifact missing/empty: ${a}`);

  if (EXCL_OPEN.has(x.verdict)) {
    if (!xs.length) err(`${x.exclusion_id}: reopen/reassess verdict has no corrective task`);
    else if (xs.every(taskId => byId.has(taskId) && CLOSED.has(byId.get(taskId).status))) {
      err(`${x.exclusion_id}: still marked ${x.verdict} but all corrective tasks are closed; update verdict only after evidence review`);
    }
  }
}
// 6b) 循環クローズの検出（2026-08-14 追加）。
//   除外を「解決した」と宣言する時、corrected_policy が old_reason の言い換えに過ぎない事例が
//   実際に4件あった（EX-012/016/017/018）。除外理由をそのまま書き直しても解決ではない。
//   語彙の重なりが強すぎる閉じ方は、新しい測定を伴っていない徴候として落とす。
const tok = t => new Set(String(t || '')
  .replace(/[\s、。「」（）()・,\.:;\/]+/g, '')
  .match(/[\u3040-\u30ff\u4e00-\u9faf]{2}|[A-Za-z]{3,}/g) || []);
for (const x of exclusions) {
  if (!EXCL_VALID.has(x.verdict)) continue;
  const a = tok(x.old_reason), b = tok(x.corrected_policy);
  if (a.size < 4 || b.size < 4) continue;
  let inter = 0; for (const v of a) if (b.has(v)) inter++;
  const containment = inter / a.size;              // old_reason のどれだけが言い直されているか
  if (containment >= 0.8 && b.size <= a.size * 1.6) {
    err(`${x.exclusion_id}: ${x.verdict} だが corrected_policy が old_reason の言い換え`
      + `（語の重なり ${(containment * 100).toFixed(0)}%）。新しい測定・変更点を書くこと`);
  }
}

const openExclusions = exclusions.filter(x => EXCL_OPEN.has(x.verdict));
const unresolvedTerminal = exclusions.filter(x => EXCL_UNRESOLVED_TERMINAL.has(x.verdict));
for (const x of unresolvedTerminal) {
  if (!String(x.corrected_policy ?? '').trim()) {
    err(`${x.exclusion_id}: NOT_IDENTIFIABLE系は決着条件を corrected_policy へ書くこと`);
  }
}
const ownerExclusionBlocks = openExclusions.filter(x => x.owner_review_block === '1');
const gateExclusionBlocks = openExclusions.filter(x => x.gate_block === '1');

// 7) Hard gates: preliminary/final review or Gate cannot bypass unfinished prerequisites or unresolved exclusions.
const ownerBlocks = tasks.filter(t => t.owner_review_block === '1' && !CLOSED.has(t.status));
const gateBlocks = tasks.filter(t => t.gate_block === '1' && !CLOSED.has(t.status));
const finalQueue = byId.get('SP-077');
if (finalQueue && CLOSED.has(finalQueue.status) && ownerBlocks.length) {
  err(`SP-077 owner queue closed with ${ownerBlocks.length} owner-review task blockers open: ${ownerBlocks.map(x=>x.task_id).join(',')}`);
}
if (finalQueue && CLOSED.has(finalQueue.status) && ownerExclusionBlocks.length) {
  err(`SP-077 owner queue closed with ${ownerExclusionBlocks.length} unresolved exclusion blockers: ${ownerExclusionBlocks.map(x=>x.exclusion_id).join(',')}`);
}
const gate = byId.get('SP-081');
if (gate && CLOSED.has(gate.status) && gateBlocks.length) {
  err(`SP-081 Speed Gate closed with ${gateBlocks.length} task blockers open: ${gateBlocks.map(x=>x.task_id).join(',')}`);
}
if (gate && CLOSED.has(gate.status) && gateExclusionBlocks.length) {
  err(`SP-081 Speed Gate closed with ${gateExclusionBlocks.length} unresolved exclusion blockers: ${gateExclusionBlocks.map(x=>x.exclusion_id).join(',')}`);
}
const shoulder = byId.get('SP-082');
if (shoulder && CLOSED.has(shoulder.status) && (!gate || !CLOSED.has(gate.status))) {
  err('SP-082 shoulder handoff closed before Speed Gate');
}

// 8) Entrypoint convergence. No new session should be routed to stale prose as authority.
for (const rel of ENTRYPOINTS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { err(`missing entrypoint: ${rel}`); continue; }
  const s = fs.readFileSync(abs, 'utf8');
  if (!s.includes(REG)) err(`${rel}: does not point to canonical task registry ${REG}`);
  if (!s.includes(REQ)) err(`${rel}: does not point to immutable requirements baseline ${REQ}`);
}
const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
if (!claude.includes(EXCL)) err(`CLAUDE.md: does not point to exclusion-reason authority ${EXCL}`);

// 9) Known empty historical artifacts are allowed only as explicit historical exceptions, never completion evidence.
for (const rel of KNOWN_EMPTY_HISTORICAL) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.statSync(abs).size !== 0) {
    warn(`known-empty historical file is no longer empty; remove from exception list after review: ${rel}`);
  }
}

// 10) Guardrail for stale owner queue: old queue must remain superseded until SP-077 is truly ready.
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

console.log(`PASS: requirements=${reqs.length}, tasks=${tasks.length}, exclusions=${exclusions.length}, open_exclusions=${openExclusions.length}, unresolved_terminal=${unresolvedTerminal.length}, owner_review_task_blockers=${ownerBlocks.length}, owner_review_exclusion_blockers=${ownerExclusionBlocks.length}, gate_task_blockers=${gateBlocks.length}, gate_exclusion_blockers=${gateExclusionBlocks.length}`);
console.log('Owner review and Speed Gate remain fail-closed until task and exclusion blocker counts reach zero.');
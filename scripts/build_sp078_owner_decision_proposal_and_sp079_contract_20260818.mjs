// Prepare the next critical-path checkpoint without fabricating owner decisions.
//
// Inputs:
// - human-adjudicated, non-verdict recommendations for all 100 players
// - the still-empty, queue-bound SP-078 owner-verdict ledger
// - the unlocked construct-integrity receipt
//
// Outputs are proposals/contracts only. This script MUST NOT mutate SP-078,
// run SP-079, create a final 0-100 scale, or start shoulder work.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'outputs/derived/speed_all100_owner_review_adjudicated_20260818.json';
const LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';
const LOCK = 'docs/state/speed_owner_review_integrity_lock_20260817.json';
const PROPOSAL_JSON = 'outputs/derived/sp078_owner_verdict_proposal_20260818.json';
const PROPOSAL_TSV = 'outputs/derived/sp078_owner_verdict_proposal_20260818.tsv';
const PROPOSAL_MD = 'docs/reports/sp078_owner_verdict_proposal_20260818.md';
const CONTRACT_JSON = 'outputs/derived/sp079_preimplementation_contract_20260818.json';
const CONTRACT_MD = 'docs/audits/sp079_preimplementation_contract_20260818.md';

const full = p => path.join(ROOT, p);
const readText = p => fs.readFileSync(full(p), 'utf8');
const readJson = p => JSON.parse(readText(p));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const oneLine = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

const sourceText = readText(SOURCE);
const source = JSON.parse(sourceText);
const ledgerText = readText(LEDGER);
const ledger = JSON.parse(ledgerText);
const lock = readJson(LOCK);

if (source?.schema_version !== 'speed_all100_owner_review_adjudicated_20260818') throw new Error('wrong adjudication schema');
if (source.population !== 100 || source.players?.length !== 100) throw new Error('adjudication is not exact 100');
if (new Set(source.players.map(r => r.queue_row_key)).size !== 100) throw new Error('duplicate queue row key');
if (source.owner_verdict_count !== 0) throw new Error('adjudication contains owner verdicts');
if (ledger?.schema_version !== 'sp078_owner_verdict_ledger_20260816') throw new Error('wrong SP-078 ledger schema');
if (!Array.isArray(ledger.records) || ledger.records.length !== 0 || ledger.owner_verdict_count !== 0) throw new Error('SP-078 ledger is not empty');
if (ledger.queue_source?.row_count !== 100 || typeof ledger.queue_source?.sha256 !== 'string') throw new Error('SP-078 queue binding receipt is invalid');
if (lock?.schema_version !== 'speed_owner_review_integrity_lock_20260817' || lock.locked !== false) throw new Error('owner review is not unlocked');
if (lock.active_owner_review_queue_sha256 !== ledger.queue_source.sha256) throw new Error('lock/ledger queue hash mismatch');

const allowed = new Set(ledger.allowed_verdicts ?? []);
const expectedSourceCounts = {
  POWERPRO_PLAUSIBLE: 83,
  UNRESOLVED: 8,
  POWERPRO_TOO_HIGH_OR_STALE: 5,
  POWERPRO_TOO_LOW: 4,
};
for (const [key, value] of Object.entries(expectedSourceCounts)) {
  if (source.counts?.[key] !== value) throw new Error(`source ${key}=${source.counts?.[key]}, expected ${value}`);
}

function classifyBatch(row) {
  if (row.adjudicated_recommendation === 'POWERPRO_PLAUSIBLE') return 'A_BULK_COMPATIBLE_OR_NO_TARGET';
  if (row.adjudicated_recommendation === 'UNRESOLVED' && row.powerpro_current == null) return 'A_BULK_COMPATIBLE_OR_NO_TARGET';
  if (row.adjudicated_recommendation === 'POWERPRO_TOO_LOW' || row.adjudicated_recommendation === 'POWERPRO_TOO_HIGH_OR_STALE') return 'B_DIRECTIONAL_REVIEW';
  if (row.adjudicated_recommendation === 'UNRESOLVED') return 'C_MATERIAL_CONFLICT';
  throw new Error(`${row.player}: unsupported adjudicated recommendation ${row.adjudicated_recommendation}`);
}

const proposed = source.players
  .slice()
  .sort((a,b) => a.queue_order - b.queue_order)
  .map(row => {
    if (!allowed.has(row.adjudicated_recommendation)) throw new Error(`${row.player}: verdict not allowed by SP-078`);
    const batch = classifyBatch(row);
    return {
      proposal_id: `SP078-PROPOSAL-20260818-${String(row.queue_order).padStart(3, '0')}`,
      queue_order: row.queue_order,
      queue_row_key: row.queue_row_key,
      player: row.player,
      team: row.team,
      powerpro_current: row.powerpro_current,
      proposed_verdict: row.adjudicated_recommendation,
      proposed_strength: row.adjudicated_strength,
      proposed_confidence: row.adjudicated_confidence,
      proposed_reason_code: row.adjudicated_reason_code,
      proposed_note: row.adjudication_rationale,
      preferred_rating_optional: null,
      decision_batch: batch,
      human_directional_review_performed: row.human_directional_review_performed === true,
      owner_event_fields: {
        event_id: null,
        timestamp: null,
        source: null,
        reviewer: null,
      },
      capture_ready: false,
      source_artifact: SOURCE,
      retained_uncertainty: row.retained_uncertainty,
    };
  });

const batchCounts = {};
const verdictCounts = {};
for (const row of proposed) {
  batchCounts[row.decision_batch] = (batchCounts[row.decision_batch] ?? 0) + 1;
  verdictCounts[row.proposed_verdict] = (verdictCounts[row.proposed_verdict] ?? 0) + 1;
}
const expectedBatchCounts = {
  A_BULK_COMPATIBLE_OR_NO_TARGET: 88,
  B_DIRECTIONAL_REVIEW: 9,
  C_MATERIAL_CONFLICT: 3,
};
for (const [key, value] of Object.entries(expectedBatchCounts)) {
  if (batchCounts[key] !== value) throw new Error(`${key}=${batchCounts[key]}, expected ${value}`);
}
if (proposed.some(r => r.capture_ready || Object.values(r.owner_event_fields).some(v => v != null))) throw new Error('proposal accidentally became capture-ready');

const directional = proposed.filter(r => r.decision_batch === 'B_DIRECTIONAL_REVIEW');
const conflicts = proposed.filter(r => r.decision_batch === 'C_MATERIAL_CONFLICT');
const noTarget = proposed.filter(r => r.proposed_verdict === 'UNRESOLVED' && r.powerpro_current == null);
if (directional.length !== 9 || conflicts.length !== 3 || noTarget.length !== 5) throw new Error('decision-group population mismatch');

const proposal = {
  schema_version: 'sp078_owner_verdict_proposal_20260818',
  generated_at: '2026-08-18',
  status: 'PROPOSED_NOT_OWNER_APPROVED',
  source_adjudication: {
    path: SOURCE,
    sha256: sha256(sourceText),
    population: source.population,
  },
  target_ledger: {
    path: LEDGER,
    sha256_before_proposal: sha256(ledgerText),
    queue_source: ledger.queue_source,
    current_owner_verdict_count: 0,
  },
  owner_review_lock: {
    path: LOCK,
    locked: lock.locked,
    active_queue_sha256: lock.active_owner_review_queue_sha256,
  },
  owner_approval_required: true,
  capture_allowed: false,
  capture_block_reason: 'The user has not explicitly approved these 100 player-level verdicts as owner decisions. Generic continuation instructions are not rewritten as individual owner events.',
  decision_semantics: {
    POWERPRO_PLAUSIBLE: 'No material contradiction requiring a directional correction. This does not validate the exact PowerPro number and does not copy it into SP-079.',
    POWERPRO_TOO_LOW: 'Directional owner constraint only. It does not specify the replacement number unless preferred_rating_optional is explicitly supplied.',
    POWERPRO_TOO_HIGH_OR_STALE: 'Directional owner constraint only. It does not specify the replacement number unless preferred_rating_optional is explicitly supplied.',
    UNRESOLVED: 'Preserve conflict or missing comparison target; SP-079 must widen uncertainty and must not force a direction.',
  },
  approval_scope_recommendation: {
    mode: 'THREE_BATCH_SINGLE_CHECKPOINT',
    batches: [
      { id: 'A_BULK_COMPATIBLE_OR_NO_TARGET', count: 88, meaning: '83 compatible cases plus 5 objective no-current-PowerPro-target UNRESOLVED cases.' },
      { id: 'B_DIRECTIONAL_REVIEW', count: 9, meaning: 'Four TOO_LOW and five TOO_HIGH_OR_STALE cases; each has a preserved rationale and confidence.' },
      { id: 'C_MATERIAL_CONFLICT', count: 3, meaning: 'Evidence conflict remains after full-construct adjudication; retain UNRESOLVED.' },
    ],
    owner_can_approve_all_or_list_exceptions: true,
  },
  verdict_counts: verdictCounts,
  batch_counts: batchCounts,
  proposed_events: proposed,
};
fs.mkdirSync(path.dirname(full(PROPOSAL_JSON)), { recursive: true });
fs.writeFileSync(full(PROPOSAL_JSON), JSON.stringify(proposal, null, 2) + '\n');

const tsvHeaders = ['order','player','team','powerpro_current','proposed_verdict','batch','strength','confidence','reason_code','preferred_rating_optional','capture_ready','rationale'];
const tsv = [
  tsvHeaders.join('\t'),
  ...proposed.map(r => [r.queue_order,r.player,r.team,r.powerpro_current,r.proposed_verdict,r.decision_batch,r.proposed_strength,r.proposed_confidence,r.proposed_reason_code,r.preferred_rating_optional,r.capture_ready,r.proposed_note].map(oneLine).join('\t')),
  '',
].join('\n');
fs.writeFileSync(full(PROPOSAL_TSV), tsv);

const contract = {
  schema_version: 'sp079_preimplementation_contract_20260818',
  generated_at: '2026-08-18',
  status: 'PREIMPLEMENTATION_CONTRACT_ONLY_NOT_EXECUTED',
  task: 'SP-079',
  purpose: 'Define the consequence of owner verdicts before capturing them, then implement a traceable 100-player practical reappraisal without PowerPro-label leakage or top-speed substitution.',
  entry_conditions: [
    'speed_owner_review_integrity_lock_20260817.locked=false',
    'task-registry QA PASS',
    'construct-traceability QA PASS',
    'SP-078 ledger remains bound to the active 100-row construct queue',
    'exactly 100 active owner verdicts exist: one per queue_row_key',
    'every verdict has nonempty timestamp/source/reviewer and append-only history',
  ],
  owner_verdict_semantics: proposal.decision_semantics,
  required_inputs: [
    'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json',
    'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
    'outputs/derived/sp100_owner_approved_production_wiring_20260816.json',
    'outputs/derived/sp016_continuous_prior_apply_20260814.json and current-year-first repair QA',
    'docs/state/speed_requirements_baseline_20260813.tsv',
    'docs/state/speed_exclusion_reason_ledger.tsv',
  ],
  forbidden_inputs_or_shortcuts: [
    'retired NPB+ -> PowerPro label regression -> blend as final appraisal',
    'PowerPro current value as a physical teacher',
    'current NPB+ top speed as the entire speed construct',
    'automatic all-player historical pooling',
    'next-year repeatability as annual-appraisal acceptance or weighting evidence',
    'missing evidence converted to zero or negative evidence',
  ],
  required_player_output_fields: [
    'queue_row_key and stable identity',
    'owner_verdict event receipt',
    'physical latent/rank estimate',
    'practical provisional display point',
    'range_low and range_high',
    'confidence and explicit confidence drivers',
    'per-lane evidence values or bounded missingness',
    'historical carryover reason and weight when used',
    'technique-separation receipt',
    'PowerPro comparison result without teacher leakage',
    'source provenance and source hashes',
    'absolute_scale_status',
  ],
  verdict_application_rules: {
    POWERPRO_PLAUSIBLE: 'Do not anchor to PowerPro. Preserve the independent evidence estimate; record only that no forced directional correction is required.',
    POWERPRO_TOO_LOW: 'The independent practical range must not silently resolve below the current PowerPro comparison without an explicit conflict flag; preferred_rating_optional, when supplied, is a review constraint rather than physical evidence.',
    POWERPRO_TOO_HIGH_OR_STALE: 'The independent practical range must not silently resolve above the current PowerPro comparison without an explicit conflict flag; preferred_rating_optional, when supplied, is a review constraint rather than physical evidence.',
    UNRESOLVED: 'Do not force a point direction. Preserve a wider range, lower confidence, and the exact conflict/missing-target reason.',
  },
  scale_policy: {
    relative_and_practical_reappraisal_can_proceed_after_owner_verdicts: true,
    absolute_0_100_scale_final: false,
    required_status: 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE',
    reason: 'SP-071 remains blocked by the ability-to-engine-response bridge. SP-079 is not allowed to pretend that dependency is closed.',
  },
  minimum_qa: [
    '100/100 population and unique queue keys',
    '100/100 active owner-verdict coverage with exact queue hash binding',
    'deterministic byte-identical rerun',
    'no PowerPro current value in physical-estimation feature set',
    'no top-speed-only finalization',
    'all required construct lanes remain visible per player',
    'missingness is explicit and never negative evidence',
    'historical evidence used only with player-specific current-year exception reason',
    'directional verdict canaries: 山口航輝, 塩見泰隆, 村林一輝, 坂倉将吾',
    'conflict canaries remain unresolved unless amended by owner: 細川成也, 小園海斗, 古賀優大',
    'カリステ/矢野雅哉/京田陽太 regression guards against peak-speed overreach',
    'SP-078 ledger unchanged by SP-079 computation',
    'shoulder remains blocked',
  ],
  completion_boundary: {
    SP079_can_be_done_validated_when: '100-player physical/practical point+range+confidence+provenance exists and all contract QA passes.',
    SP080_still_waits_for: ['SP-071 engine bridge', 'SP-079 practical ratings'],
    SP081_gate_close_still_waits_for: ['SP-079', 'SP-080', 'explicit owner approval'],
  },
};
fs.writeFileSync(full(CONTRACT_JSON), JSON.stringify(contract, null, 2) + '\n');

const list = rows => rows.map(r => `- **${r.player}（PP ${r.powerpro_current ?? '—'}）** — \`${r.proposed_verdict}\` / ${r.proposed_strength} / ${r.proposed_confidence}. ${r.proposed_note}`);
const proposalMd = [
  '# SP-078 owner-verdict proposal — 2026-08-18',
  '',
  'Status: **PROPOSED / NOT OWNER-APPROVED / NOT CAPTURE-READY**',
  '',
  '## Why this is the next step',
  '',
  'SP-077/078 infrastructure and construct QA are complete, the integrity lock is open, and SP-079 is blocked only by real owner-verdict input. However, a generic instruction to continue is not equivalent to 100 explicit player-level owner decisions. This packet therefore freezes the exact proposed decisions and their SP-079 meaning without mutating the append-only ledger.',
  '',
  '## Three-batch checkpoint',
  '',
  `- **Batch A — bulk compatible/no target: ${batchCounts.A_BULK_COMPATIBLE_OR_NO_TARGET}** (83 POWERPRO_PLAUSIBLE + 5 no-current-target UNRESOLVED)`,
  `- **Batch B — directional review: ${batchCounts.B_DIRECTIONAL_REVIEW}**`,
  `- **Batch C — material conflict: ${batchCounts.C_MATERIAL_CONFLICT}**`,
  '',
  '### Batch B — directional review',
  '',
  ...list(directional),
  '',
  '### Batch C — keep unresolved because evidence conflicts',
  '',
  ...list(conflicts),
  '',
  '### No-current-PowerPro target (Batch A / objective UNRESOLVED)',
  '',
  ...list(noTarget),
  '',
  '## Meaning of approval',
  '',
  '- `POWERPRO_PLAUSIBLE` means compatible with retained evidence; it does **not** validate the exact PowerPro number.',
  '- `POWERPRO_TOO_LOW` / `POWERPRO_TOO_HIGH_OR_STALE` are directional constraints; they do **not** select a replacement number by themselves.',
  '- `UNRESOLVED` preserves conflict or missing comparison target; SP-079 must widen the range and must not force a direction.',
  '- PowerPro remains comparison context only and is never copied into the physical estimate.',
  '',
  '## What happens after explicit owner approval',
  '',
  '1. Materialize real SP-078 events with the actual owner-approval timestamp, source, and reviewer.',
  '2. Run append-only capture against the exact active queue hash.',
  '3. Require 100 active verdicts and rerun registry/construct/lock QA.',
  '4. Implement SP-079 under the separately committed preimplementation contract.',
  '',
  `Machine proposal: \`${PROPOSAL_JSON}\``,
  '',
].join('\n');
fs.mkdirSync(path.dirname(full(PROPOSAL_MD)), { recursive: true });
fs.writeFileSync(full(PROPOSAL_MD), proposalMd + '\n');

const contractMd = [
  '# SP-079 preimplementation contract — 2026-08-18',
  '',
  'Status: **CONTRACT ONLY / SP-079 NOT EXECUTED**',
  '',
  '## Decision',
  '',
  'Owner verdicts must be given a precise downstream meaning before they are captured. SP-079 will therefore require exactly one active append-only owner verdict for every current-100 queue row, but it will not use PowerPro as a physical teacher or treat a directional verdict as a replacement rating.',
  '',
  '## Entry gate',
  '',
  ...contract.entry_conditions.map(x => `- ${x}`),
  '',
  '## Verdict semantics',
  '',
  ...Object.entries(contract.verdict_application_rules).map(([k,v]) => `- **${k}:** ${v}`),
  '',
  '## Output contract',
  '',
  ...contract.required_player_output_fields.map(x => `- ${x}`),
  '',
  '## Absolute-scale boundary',
  '',
  'SP-079 may create a relative/practical estimate and a provisional display point after owner review. It may **not** claim that the absolute 0–100 scale is final. Every row must carry `PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE` until the ability-to-engine-response bridge and league-distribution calibration are complete.',
  '',
  '## Minimum QA',
  '',
  ...contract.minimum_qa.map(x => `- ${x}`),
  '',
  '## Critical-path consequence',
  '',
  '- SP-078 owner decisions are the immediate blocker.',
  '- SP-079 follows after 100/100 active verdict coverage.',
  '- SP-080 still waits for both SP-071 and SP-079.',
  '- SP-081 and shoulder remain blocked.',
  '',
  `Machine contract: \`${CONTRACT_JSON}\``,
  '',
].join('\n');
fs.mkdirSync(path.dirname(full(CONTRACT_MD)), { recursive: true });
fs.writeFileSync(full(CONTRACT_MD), contractMd + '\n');

// Prove this script did not touch the canonical owner ledger.
if (sha256(readText(LEDGER)) !== sha256(ledgerText)) throw new Error('SP-078 ledger changed during proposal generation');
console.log(JSON.stringify({
  status: 'PASS',
  population: proposed.length,
  verdictCounts,
  batchCounts,
  directional: directional.map(r => norm(r.player)),
  conflicts: conflicts.map(r => norm(r.player)),
  noTarget: noTarget.map(r => norm(r.player)),
  ownerVerdictCountStill: ledger.owner_verdict_count,
  captureAllowed: false,
  sp079Executed: false,
}));

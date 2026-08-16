// Independent QA for the SP-100 pre-owner-review decision packet.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNpbPlusMeasurements } from '../src/ratings/npb_plus_provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...parts) => path.join(ROOT, ...parts);
const read = file => readFileSync(rel(file), 'utf8');
const json = file => JSON.parse(read(file));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const checks = [];
function check(label, condition) {
  checks.push({ label, pass: Boolean(condition) });
  if (!condition) throw new Error(label);
}
function requireOwnerGate(packet) {
  if (packet.status !== 'PARTIAL') throw new Error('SP-100 must remain PARTIAL without owner approval');
  if (packet.production_behavior_changed !== false) throw new Error('production behavior must remain unchanged without owner approval');
  if (packet.implemented_architecture !== null) throw new Error('no architecture may be implemented without owner approval');
  if (packet.owner_ruling_after_v2_provenance_repair?.found !== false) throw new Error('owner ruling status cannot be inferred from recommendation');
  if (!packet.exact_one_line_owner_approval_required) throw new Error('exact owner approval line is missing');
}

const output = 'outputs/derived/sp100_production_wiring_decision_packet_20260816.json';
const report = 'docs/audits/sp100_production_wiring_decision_packet_20260816.md';
const packet = json(output);
const latent = json('outputs/derived/sp100_npb_raw_latent_speed.json');
const candidates = json('outputs/derived/sp100_wiring_candidates_20260814.json');
const enterprise = json('outputs/derived/npb_enterprise_article_lane_20260814.json');

check('packet schema', packet.schema_version === 'sp100_production_wiring_decision_packet_20260816');
check('human-readable report exists', read(report).includes('owner value judgment required'));
requireOwnerGate(packet);
check('owner-ruling search has three independent receipts', packet.owner_ruling_after_v2_provenance_repair?.search_receipts?.length === 3);
check('technical recommendation is evidence-quality asymmetric', packet.technical_recommendation === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK');
check('three admissible architectures are compared', packet.architectures?.length === 3);
for (const architecture of packet.architectures ?? []) {
  for (const criterion of ['annual_time_alignment', 'construct_directness', 'sampling_max_statistic_caveat', 'coverage', 'provenance_safety', 'circularity', 'arbitrary_unidentifiable_weight']) {
    check(`${architecture.id} has ${criterion}`, Boolean(architecture[criterion]));
  }
}
check('N uses top speed only', latent.inputs?.hp_to_1b_sec_used === 0);
check('generic reliability remains unknown', latent.measurement_reliability?.verdict === 'NOT_IDENTIFIABLE' && latent.measurement_reliability?.value === null);
check('exposure is not numerical shrinkage', latent.exposure_proxy?.applied_to_z === false);
check('candidate F remains non-point sensitivity', String(candidates.candidates?.F).includes('単一値にしない'));
check('candidate winner remains undeclared', candidates.winner === 'NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE');
check('Enterprise lane did not create reliability', enterprise.effect_on_sp100?.reliability_verdict_unchanged === 'NOT_IDENTIFIABLE');
check('N coverage is 100', packet.coverage_and_comparison?.N === 100);
check('S coverage is 93', packet.coverage_and_comparison?.S === 93);
check('N is not copied backward', packet.non_negotiable_guards?.no_2026_N_copy_to_earlier_years === true);
check('PowerPro individual path remains prohibited', packet.non_negotiable_guards?.no_individual_powerpro_teacher_or_weight === true);
check('future-year weighting remains prohibited', packet.non_negotiable_guards?.no_future_year_repeatability_weight === true);
check('display calibration remains provisional', packet.non_negotiable_guards?.absolute_display_scale === 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE');

let rawGuardFailed = false;
try { loadNpbPlusMeasurements(ROOT, ['hp_to_1b_sec']); } catch { rawGuardFailed = true; }
check('raw provenance guard rejects hp_to_1b_sec', rawGuardFailed);

const tampered = structuredClone(packet);
tampered.status = 'DONE_VALIDATED';
let tamperedRejected = false;
try { requireOwnerGate(tampered); } catch { tamperedRejected = true; }
check('deliberately false DONE fixture is rejected', tamperedRejected);

for (const [file, expected] of Object.entries(packet.source_hashes ?? {})) {
  check(`source hash matches: ${file}`, sha256(read(file)) === expected);
}

console.log(`SP-100 independent QA: ${checks.length} PASS / 0 FAIL`);

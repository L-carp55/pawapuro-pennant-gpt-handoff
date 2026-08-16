// Independent, fail-able QA for the owner-approved SP-100 decision packet.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNpbPlusMeasurements } from '../src/ratings/npb_plus_provenance.mjs';
import { resolveSp100ProductionPhysicalSpeed } from '../src/ratings/sp100_production_wiring.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const exactOwnerRuling = 'SP-100は N_PRIMARY_S_CONTEXT_OR_FALLBACK で承認します。Sはcontext/fallbackに留め、SとNを識別不能な重みでblendしません。';
const checks = [];
function check(label, condition) {
  checks.push({ label, pass: Boolean(condition) });
  if (!condition) throw new Error(label);
}
function requireApprovedPacket(packet) {
  if (packet.status !== 'DONE_VALIDATED') throw new Error('SP-100 must be DONE_VALIDATED after the explicit owner ruling');
  if (packet.decision_type !== 'EXPLICIT_OWNER_APPROVED_IMPLEMENTED') throw new Error('packet does not record explicit owner approval');
  if (packet.implemented_architecture !== 'N_PRIMARY_S_CONTEXT_OR_FALLBACK') throw new Error('implemented architecture does not match owner ruling');
  if (packet.production_behavior_changed !== true) throw new Error('packet does not record the limited production behavior change');
  if (packet.owner_ruling_after_v2_provenance_repair?.found !== true) throw new Error('owner ruling cannot be inferred or omitted');
  if (packet.owner_ruling_after_v2_provenance_repair?.exact_owner_ruling !== exactOwnerRuling) throw new Error('owner ruling text differs from the authorized decision');
  if (packet.owner_ruling_after_v2_provenance_repair?.owner_player_verdicts_written !== 0) throw new Error('architecture decision was misrepresented as player verdicts');
}
function requireLayer(layer) {
  if (layer.status !== 'DONE_VALIDATED'
    || layer.owner_approved_architecture !== 'N_PRIMARY_S_CONTEXT_OR_FALLBACK'
    || layer.production_behavior?.current_2026_n_is_primary_physical_rank_estimate !== true
    || layer.production_behavior?.S_role !== 'CONTEXT_OR_FALLBACK_ONLY'
    || layer.production_behavior?.arithmetic_N_S_blend !== false
    || layer.production_behavior?.final_practical_reappraisal_created !== false) {
    throw new Error('layer does not satisfy the approved limited architecture');
  }
  if (!Array.isArray(layer.players) || layer.players.length !== 100
    || new Set(layer.players.map(row => row.stable_player_key)).size !== 100) {
    throw new Error('layer does not cover the exact stable current-100 population');
  }
  for (const row of layer.players) {
    if (row.selection !== 'N_PRIMARY_CURRENT_2026'
      || row.no_arithmetic_n_s_blend !== true
      || row.n_primary?.measurement_reliability !== 'NOT_IDENTIFIABLE'
      || row.n_primary?.exposure_context?.applied_to_z !== false
      || row.n_primary?.display_scale_status !== 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE'
      || !Number.isFinite(row.n_primary?.top_speed_kmh)
      || !Number.isFinite(row.n_primary?.npb_top_speed_z)) {
      throw new Error(`invalid N-primary row: ${row.player ?? '(unknown)'}`);
    }
  }
}

const packet = json('outputs/derived/sp100_production_wiring_decision_packet_20260816.json');
const layer = json('outputs/derived/sp100_owner_approved_production_wiring_20260816.json');
const latent = json('outputs/derived/sp100_npb_raw_latent_speed.json');
const candidates = json('outputs/derived/sp100_wiring_candidates_20260814.json');
const cfg = json('configs/ratings.json');
const ownerDecision = read('docs/audits/sp100_owner_decision_20260816.md');
const directMeasurement = read('src/ratings/direct_measurement.mjs');

check('packet schema', packet.schema_version === 'sp100_production_wiring_decision_packet_20260816');
check('human report records implemented owner decision', read('docs/audits/sp100_production_wiring_decision_packet_20260816.md').includes('explicit owner ruling implemented'));
check('owner decision document has exact ruling', ownerDecision.includes(exactOwnerRuling));
requireApprovedPacket(packet);
check('three architectures remain explicitly compared', packet.architectures?.length === 3);
for (const architecture of packet.architectures ?? []) {
  for (const criterion of ['annual_time_alignment', 'construct_directness', 'sampling_max_statistic_caveat', 'coverage', 'provenance_safety', 'circularity', 'arbitrary_unidentifiable_weight']) {
    check(`${architecture.id} has ${criterion}`, Boolean(architecture[criterion]));
  }
}
check('only approved architecture is marked selected', packet.architectures?.filter(row => row.selected_by_explicit_owner_ruling).map(row => row.id).join(',') === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK');
check('N uses top speed only', latent.inputs?.hp_to_1b_sec_used === 0);
check('generic reliability remains unknown', latent.measurement_reliability?.verdict === 'NOT_IDENTIFIABLE' && latent.measurement_reliability?.value === null);
check('exposure is not numerical shrinkage', latent.exposure_proxy?.applied_to_z === false);
check('historical F remains sensitivity, not a production point', String(candidates.candidates?.F).includes('単一値にしない'));
check('historical candidate winner remains auditable rather than silently rewritten', candidates.winner === 'NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE');
check('generic legacy direct route excludes top speed', directMeasurement.includes("metric !== 'top_speed_kmh'"));
check('PowerPro individual path remains prohibited', packet.non_negotiable_guards?.no_individual_powerpro_teacher_or_weight === true);
check('future-year weighting remains prohibited', packet.non_negotiable_guards?.no_future_year_repeatability_weight === true);
check('no final practical reappraisal is created', packet.non_negotiable_guards?.no_sp079_final_practical_reappraisal === true);
check('display calibration remains provisional', packet.non_negotiable_guards?.absolute_display_scale === 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE');
requireLayer(layer);
check('layer reports exact 100 N-primary coverage', layer.summary?.current_target_population === 100 && layer.summary?.N_primary_count === 100 && layer.summary?.S_fallback_count === 0);

const shuto = resolveSp100ProductionPhysicalSpeed({
  root: ROOT,
  physicalEvidenceSeason: 2026,
  playerName: '周東 佑京',
  stablePlayerKey: 'PROEYE:21925136',
  cfg,
  statisticalContext: { marker: 'S remains visible', value_z: 1.2 },
});
check('explicit 2026 resolver selects N primary', shuto.selection === 'N_PRIMARY_CURRENT_2026' && shuto.n_primary?.top_speed_kmh === 35);
check('explicit 2026 resolver retains S separately', shuto.statistical_context?.marker === 'S remains visible' && shuto.statistical_context?.role === 'S_CONTEXT_OR_FALLBACK_ONLY_NOT_ARITHMETIC_BLEND');
check('explicit 2026 resolver has no arithmetic N/S blend', shuto.no_arithmetic_n_s_blend === true && !Object.hasOwn(shuto.n_primary ?? {}, 'blend_weight'));
const historical = resolveSp100ProductionPhysicalSpeed({
  root: ROOT,
  physicalEvidenceSeason: 2025,
  playerName: '周東 佑京',
  stablePlayerKey: 'PROEYE:21925136',
  cfg,
  statisticalContext: { marker: 'historical S' },
});
check('2026 N cannot copy backward to a 2025 physical layer', historical.selection === 'S_FALLBACK_NO_CURRENT_YEAR_N' && historical.n_primary == null);
const wrongKey = resolveSp100ProductionPhysicalSpeed({
  root: ROOT,
  physicalEvidenceSeason: 2026,
  playerName: '周東 佑京',
  stablePlayerKey: 'PROEYE:not-shuto',
  cfg,
});
check('wrong stable key cannot retrieve a same-name N record', wrongKey.selection === 'NO_CURRENT_YEAR_N_OR_S');

let rawGuardFailed = false;
try { loadNpbPlusMeasurements(ROOT, ['hp_to_1b_sec']); } catch { rawGuardFailed = true; }
check('raw provenance guard rejects hp_to_1b_sec', rawGuardFailed);

const tamperedOwner = structuredClone(packet);
tamperedOwner.owner_ruling_after_v2_provenance_repair.found = false;
let tamperedOwnerRejected = false;
try { requireApprovedPacket(tamperedOwner); } catch { tamperedOwnerRejected = true; }
check('missing owner ruling fixture is rejected', tamperedOwnerRejected);
const tamperedLayer = structuredClone(layer);
tamperedLayer.players[0].no_arithmetic_n_s_blend = false;
let tamperedBlendRejected = false;
try { requireLayer(tamperedLayer); } catch { tamperedBlendRejected = true; }
check('arithmetic-blend fixture is rejected', tamperedBlendRejected);

for (const [file, expected] of Object.entries(packet.source_hashes ?? {})) {
  check(`source hash matches: ${file}`, sha256(read(file)) === expected);
}

console.log(`SP-100 owner-approved packet QA: ${checks.length} PASS / 0 FAIL`);

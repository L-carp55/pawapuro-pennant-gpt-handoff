// SP-100 owner-approved production-wiring decision packet.
// Frozen repository evidence plus the explicit 2026-08-16 owner ruling only.
// It records an implemented current-2026 physical layer; it does not run SP-079.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(`[SP-100 decision packet] ${message}`); };
const exactOwnerRuling = 'SP-100は N_PRIMARY_S_CONTEXT_OR_FALLBACK で承認します。Sはcontext/fallbackに留め、SとNを識別不能な重みでblendしません。';

const INPUTS = [
  'docs/tasks/OPUS_SPEED_PRE_OWNER_REVIEW_WAVE_20260816.md',
  'docs/audits/sp100_owner_decision_20260816.md',
  'docs/audits/owner_policy_ruling_20260814.md',
  'docs/designs/sp046_powerpro_role_policy_v1.md',
  'configs/npb_plus_field_provenance.json',
  'src/ratings/npb_plus_provenance.mjs',
  'src/ratings/direct_measurement.mjs',
  'src/ratings/sp100_npb_primary_speed.mjs',
  'src/ratings/sp100_production_wiring.mjs',
  'scripts/sp100_npb_raw_latent_speed.mjs',
  'scripts/sp100_wiring_candidates_compare.mjs',
  'scripts/build_sp100_owner_approved_production_wiring_20260816.mjs',
  'outputs/derived/sp100_npb_raw_latent_speed.json',
  'outputs/derived/sp100_wiring_candidates_20260814.json',
  'outputs/derived/sp100_owner_approved_production_wiring_20260816.json',
  'docs/audits/sp100_owner_approved_production_wiring_20260816.md',
  'outputs/derived/sp098_identity_coverage_repair_20260813.json',
  'docs/state/speed_task_registry.tsv',
];
const source_hashes = Object.fromEntries(INPUTS.map(file => [file, sha256(read(file))]));
const latent = json('outputs/derived/sp100_npb_raw_latent_speed.json');
const candidates = json('outputs/derived/sp100_wiring_candidates_20260814.json');
const layer = json('outputs/derived/sp100_owner_approved_production_wiring_20260816.json');
const provenance = json('configs/npb_plus_field_provenance.json');
const ownerDecision = read('docs/audits/sp100_owner_decision_20260816.md');
const ownerPolicy = read('docs/audits/owner_policy_ruling_20260814.md');
const sp046 = read('docs/designs/sp046_powerpro_role_policy_v1.md');
const directMeasurement = read('src/ratings/direct_measurement.mjs');
const registry = read('docs/state/speed_task_registry.tsv');

if (!ownerDecision.includes(exactOwnerRuling)) fail('explicit owner ruling is missing or altered');
if (!ownerDecision.includes('after the SP-100 v2 provenance repair')) fail('owner-decision temporal relationship is not recorded');
if (latent.inputs?.hp_to_1b_sec_used !== 0) fail('contaminated hp_to_1b_sec is present in N');
if (latent.measurement_reliability?.verdict !== 'NOT_IDENTIFIABLE' || latent.measurement_reliability?.value !== null) fail('generic N reliability was fabricated');
if (latent.exposure_proxy?.applied_to_z !== false) fail('exposure numerically shrinks N');
if (provenance.fields?.top_speed_kmh?.class !== 'VERIFIED_NPB_PLUS') fail('top_speed_kmh is not verified NPB+');
if (provenance.fields?.hp_to_1b_sec?.class !== 'MISATTRIBUTED_SOURCE') fail('hp_to_1b_sec is not fail-closed');
if (candidates.winner !== 'NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE') fail('historical candidate evidence was silently rewritten');
if (candidates.policy?.no_powerpro_individual_weight !== true || candidates.policy?.no_next_year_repeatability !== true) fail('prohibited selection input present');
if (!sp046.includes('player-level teacher') || !sp046.includes('component weight')) fail('SP-046 policy did not load');
if (!ownerPolicy.includes('SP-100')) fail('owner-policy record did not load');
if (!registry.includes('SP-100\tDONE_VALIDATED')) fail('registry does not record approved SP-100 closure');
if (!directMeasurement.includes("metric !== 'top_speed_kmh'")) fail('generic PowerPro-scale direct route still accepts top speed');

if (layer.status !== 'DONE_VALIDATED'
  || layer.owner_approved_architecture !== 'N_PRIMARY_S_CONTEXT_OR_FALLBACK'
  || layer.production_behavior?.current_2026_n_is_primary_physical_rank_estimate !== true
  || layer.production_behavior?.S_role !== 'CONTEXT_OR_FALLBACK_ONLY'
  || layer.production_behavior?.arithmetic_N_S_blend !== false
  || layer.production_behavior?.physical_evidence_season !== 2026
  || layer.production_behavior?.final_practical_reappraisal_created !== false) {
  fail('current physical layer does not implement the approved limited architecture');
}
if (layer.summary?.current_target_population !== 100 || layer.summary?.N_primary_count !== 100 || layer.summary?.S_fallback_count !== 0) {
  fail('current physical layer does not cover the exact N-primary 100-player population');
}
if (!Array.isArray(layer.players) || layer.players.length !== 100
  || new Set(layer.players.map(row => row.stable_player_key)).size !== 100
  || !layer.players.every(row => row.selection === 'N_PRIMARY_CURRENT_2026'
    && row.no_arithmetic_n_s_blend === true
    && row.n_primary?.measurement_reliability === 'NOT_IDENTIFIABLE'
    && row.n_primary?.exposure_context?.applied_to_z === false
    && row.n_primary?.display_scale_status === 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE')) {
  fail('current physical layer violates N-primary/no-blend/provenance constraints');
}

const architectures = [
  {
    id: 'N_PRIMARY_S_CONTEXT_OR_FALLBACK',
    selected_by_explicit_owner_ruling: true,
    annual_time_alignment: '2026 N is the aligned current physical/rank evidence; 2025 S is context/fallback only and N is never copied backward.',
    construct_directness: 'N is verified NPB+ tracked top/max speed; S is a statistical proxy and remains a separate labelled lane.',
    sampling_max_statistic_caveat: 'N is not error-free; it is a maximum statistic. Exposure remains context only and does not numerically shrink N.',
    coverage: 'N covers the frozen current 100/100 population; S remains available as context/fallback where applicable.',
    provenance_safety: 'top_speed_kmh only; hp_to_1b_sec remains MISATTRIBUTED_SOURCE and fail-closed.',
    circularity: 'No individual PowerPro label or future-year outcome selects a component, weight, shrinkage, or point.',
    arbitrary_unidentifiable_weight: 'No: N and S are never arithmetically blended and no generic N reliability coefficient is created.',
    production_effect: 'Implemented as the explicit 2026 current physical/rank layer only; display remains provisional and no final practical rating is created.',
  },
  {
    id: 'S_PRIMARY_N_CONTEXT',
    selected_by_explicit_owner_ruling: false,
    annual_time_alignment: 'Weaker: primary S is 2025 while N is current 2026 evidence.',
    construct_directness: 'Weaker: it gives primary status to a proxy rather than aligned direct evidence.',
    sampling_max_statistic_caveat: 'Avoids operationalizing N but does not resolve the maximum-statistic caveat.',
    coverage: 'S has incomplete current-population coverage.',
    provenance_safety: 'Admissible only if the same top-speed-only guard remains.',
    circularity: 'No inherent circularity if PowerPro/future outcomes stay excluded.',
    arbitrary_unidentifiable_weight: 'No blend, but not owner-selected.',
    production_effect: 'Not implemented.',
  },
  {
    id: 'NO_SINGLE_POINT_OWNER_REVIEW_ONLY',
    selected_by_explicit_owner_ruling: false,
    annual_time_alignment: 'Conservative but leaves aligned 2026 evidence non-operational.',
    construct_directness: 'Preserves N only as review material.',
    sampling_max_statistic_caveat: 'Defers the caveat rather than quantifying it.',
    coverage: 'Could show all 100 but generates no physical/rank point.',
    provenance_safety: 'Admissible only with the same fail-closed provenance gate.',
    circularity: 'No inherent circularity.',
    arbitrary_unidentifiable_weight: 'No blend.',
    production_effect: 'Not implemented.',
  },
];

const packet = {
  schema_version: 'sp100_production_wiring_decision_packet_20260816',
  generated_at: '2026-08-16',
  scope: 'SP-100 approved 2026 physical/rank wiring only; frozen repository evidence; no external collection; no SP-079 final practical reappraisal.',
  status: 'DONE_VALIDATED',
  decision_type: 'EXPLICIT_OWNER_APPROVED_IMPLEMENTED',
  technical_recommendation: 'N_PRIMARY_S_CONTEXT_OR_FALLBACK',
  implemented_architecture: 'N_PRIMARY_S_CONTEXT_OR_FALLBACK',
  production_behavior_changed: true,
  owner_ruling_after_v2_provenance_repair: {
    found: true,
    source: 'docs/audits/sp100_owner_decision_20260816.md',
    exact_owner_ruling: exactOwnerRuling,
    v2_repair_commit: '3f42d9a7c4703e75bf9ee406524381611c6b733b',
    pre_v2_owner_policy_commit: '24a4388145dcbd607540a5a5c5c063eb5377e621',
    scope: '2026-only current physical/rank layer; not a player-level verdict and not SP-079.',
    owner_player_verdicts_written: 0,
  },
  evidence_facts: {
    N: '2026 NPB+ top_speed_kmh only; direct maximum-statistic physical evidence; exact frozen current cohort n=100; generic reliability NOT_IDENTIFIABLE.',
    S: '2025 statistical proxy/context or fallback only; never arithmetically blended with N.',
    F: 'Historical sensitivity only; no single N/S blend weight is used in production.',
    H2F: 'Separate low-confidence/context lane; never merged into NPB+ or used to manufacture generic reliability.',
    scale: 'The existing global display mapping is provisional pending SP-071 / engine bridge.',
  },
  architectures,
  non_negotiable_guards: {
    top_speed_only_npb_plus_direct_measurement: true,
    hp_to_1b_sec_fail_closed: true,
    generic_npb_reliability: 'NOT_IDENTIFIABLE',
    exposure_applied_to_N_z: false,
    no_individual_powerpro_teacher_or_weight: true,
    no_future_year_repeatability_weight: true,
    no_2026_N_copy_to_earlier_years: true,
    no_arithmetic_N_S_blend: true,
    h2f_separate_context_lane: true,
    absolute_display_scale: 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE',
    no_sp079_final_practical_reappraisal: true,
  },
  coverage_and_comparison: {
    N: layer.summary.N_primary_count,
    S: candidates.coverage.S,
    historical_both: candidates.coverage.F_both,
    H2F: candidates.coverage.h2f,
    caveat: 'N versus its own top speed is definitional/circular and is never a production-selection criterion.',
  },
  current_physical_layer: {
    path: 'outputs/derived/sp100_owner_approved_production_wiring_20260816.json',
    source_hash: source_hashes['outputs/derived/sp100_owner_approved_production_wiring_20260816.json'],
    current_target_population: layer.summary.current_target_population,
    n_primary_count: layer.summary.N_primary_count,
    final_practical_reappraisal_created: layer.production_behavior.final_practical_reappraisal_created,
  },
  source_hashes,
};

const markdown = `# SP-100 production-wiring decision packet

Date: 2026-08-16
Status: **DONE_VALIDATED — explicit owner ruling implemented**
Production behavior: **changed only for the explicit 2026 current physical/rank layer**

## Owner decision

> ${exactOwnerRuling}

The ruling was recorded after the v2 provenance repair and is implemented exactly as **N_PRIMARY_S_CONTEXT_OR_FALLBACK**. It is an architecture ruling only; it writes no player-level owner verdict and does not run SP-079.

## Implemented behavior

- NPB+ <code>top_speed_kmh</code> is N-primary for the frozen current 100-player 2026 physical/rank layer.
- S remains separately labelled 2025 statistical context/fallback only. No numeric N reliability or N/S blend weight exists, and no arithmetic N/S blend is calculated.
- The generic direct-measurement route no longer accepts <code>top_speed_kmh</code>, so a PowerPro-scale regression or 2026-to-2025 backward copy cannot be used by that legacy path.
- <code>hp_to_1b_sec</code> remains fail-closed; generic N reliability remains <code>NOT_IDENTIFIABLE</code>; exposure is context only and does not change N z.
- The display point is explicitly provisional pending SP-071 / engine bridge. This packet does not produce a final practical 100-player appraisal.

## Architecture comparison

| Architecture | Owner decision | Time/construct result | Unidentifiable blend weight | Production state |
|---|---|---|---|---|
${architectures.map(a => `| ${a.id} | ${a.selected_by_explicit_owner_ruling ? '**APPROVED**' : 'Not selected'} | ${a.annual_time_alignment} | ${a.arbitrary_unidentifiable_weight} | ${a.production_effect} |`).join('\n')}

## Validation receipt

- Current N-primary rows: **${layer.summary.N_primary_count}/100**.
- Stable player keys: **100/100**, including the repaired 名原 <code>BM_PLAYER:20230057</code> crosswalk.
- Production-layer content checks: **${layer.summary.checks_passed} pass / 0 fail**.
- Source hashes are in the JSON packet.
`;

function atomicWrite(file, content) {
  const target = path.join(ROOT, file);
  const temp = `${target}.tmp-${process.pid}`;
  writeFileSync(temp, content, 'utf8');
  renameSync(temp, target);
}

atomicWrite('outputs/derived/sp100_production_wiring_decision_packet_20260816.json', `${JSON.stringify(packet, null, 2)}\n`);
atomicWrite('docs/audits/sp100_production_wiring_decision_packet_20260816.md', markdown);
console.log('SP-100 packet written: DONE_VALIDATED; owner-approved N_PRIMARY_S_CONTEXT_OR_FALLBACK implemented; no SP-079 reappraisal.');

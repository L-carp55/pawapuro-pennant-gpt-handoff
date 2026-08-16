// SP-100 pre-owner-review production-wiring decision packet.
// This script reads frozen repository evidence only.  It deliberately never
// writes production configuration or rating outputs.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...parts) => path.join(ROOT, ...parts);
const read = file => readFileSync(rel(file), 'utf8');
const json = file => JSON.parse(read(file));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(`[SP-100 decision packet] ${message}`); };

const INPUTS = [
  'docs/tasks/OPUS_SPEED_PRE_OWNER_REVIEW_WAVE_20260816.md',
  'docs/audits/owner_policy_ruling_20260814.md',
  'docs/designs/sp046_powerpro_role_policy_v1.md',
  'docs/audits/luna_npb_plus_provenance_contamination_20260814.md',
  'docs/audits/sp100_npb_raw_latent_speed_20260814.md',
  'docs/audits/sp100_wiring_candidates_20260814.md',
  'docs/handoff/SPEED_HANDOFF_20260814_ADDENDUM_NPB_ENTERPRISE_SPEED_ARTICLE.md',
  'configs/npb_plus_field_provenance.json',
  'src/ratings/npb_plus_provenance.mjs',
  'scripts/sp100_npb_raw_latent_speed.mjs',
  'scripts/sp100_wiring_candidates_compare.mjs',
  'scripts/sp100_npb_enterprise_article_lane.mjs',
  'outputs/derived/sp100_npb_raw_latent_speed.json',
  'outputs/derived/sp100_wiring_candidates_20260814.json',
  'outputs/derived/npb_enterprise_article_lane_20260814.json',
  'data/manual/npb_enterprise_tracking_article_20260810.json',
  'docs/state/speed_task_registry.tsv',
];
const source_hashes = Object.fromEntries(INPUTS.map(file => [file, sha256(read(file))]));
const latent = json('outputs/derived/sp100_npb_raw_latent_speed.json');
const candidates = json('outputs/derived/sp100_wiring_candidates_20260814.json');
const enterprise = json('outputs/derived/npb_enterprise_article_lane_20260814.json');
const provenance = json('configs/npb_plus_field_provenance.json');
const ownerPolicy = read('docs/audits/owner_policy_ruling_20260814.md');
const sp046 = read('docs/designs/sp046_powerpro_role_policy_v1.md');
const registry = read('docs/state/speed_task_registry.tsv');

// Fail before writing if the decision is based on a pre-repair output or any
// constraint that makes a single F blend impermissible is no longer true.
if (latent.inputs?.hp_to_1b_sec_used !== 0) fail('contaminated hp_to_1b_sec is present in N');
if (latent.measurement_reliability?.verdict !== 'NOT_IDENTIFIABLE') fail('generic N reliability was fabricated');
if (latent.exposure_proxy?.applied_to_z !== false) fail('exposure numerically shrinks N');
if (provenance.fields?.top_speed_kmh?.class !== 'VERIFIED_NPB_PLUS') fail('top_speed_kmh is not verified NPB+');
if (provenance.fields?.hp_to_1b_sec?.class !== 'MISATTRIBUTED_SOURCE') fail('hp_to_1b_sec is not fail-closed');
if (candidates.winner !== 'NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE') fail('old candidate artifact no longer records unresolved winner');
if (candidates.policy?.no_powerpro_individual_weight !== true || candidates.policy?.no_next_year_repeatability !== true) fail('prohibited selection input present');
if (enterprise.effect_on_sp100?.reliability_verdict_unchanged !== 'NOT_IDENTIFIABLE') fail('selected article lane was used as generic reliability');
if (!sp046.includes('player-level teacher') || !sp046.includes('component weight')) fail('SP-046 policy did not load');
if (!ownerPolicy.includes('SP-100') || !registry.includes('SP-100\tPARTIAL')) fail('owner-policy/registry record did not load');

const approval_required = 'Approve N_PRIMARY_S_CONTEXT_OR_FALLBACK for 2026-only SP-100 production wiring; keep S as context/fallback and do not blend S and N by an unidentifiable weight.';
const architectures = [
  {
    id: 'N_PRIMARY_S_CONTEXT_OR_FALLBACK',
    technical_recommendation: true,
    annual_time_alignment: 'BEST FOR 2026: N is a 2026 snapshot. S is 2025 context or a fallback only when an appraisal-year direct N observation is unavailable; 2026 N is never copied backward.',
    construct_directness: 'BEST: N is direct tracked top/max speed. S is a statistical proxy, retained for sanity/context rather than treated as the same measurement.',
    sampling_max_statistic_caveat: 'RETAINED: N is not error-free. It is a maximum statistic; few opportunities can understate its level. Exposure is context/confidence only and never numerically shrinks N.',
    coverage: 'N covers 100/100; S covers 93/100. The observed 2026 N lane therefore supplies the complete current target population.',
    provenance_safety: 'PASS: only VERIFIED_NPB_PLUS top_speed_kmh is used; hp_to_1b_sec remains MISATTRIBUTED_SOURCE and fail-closed. H2F remains a separate low-confidence/context lane.',
    circularity: 'PASS: no individual PowerPro label, no PowerPro agreement winner rule, and no future-year repeatability are used.',
    arbitrary_unidentifiable_weight: 'NO: S and N are not arithmetically blended. No generic N reliability or F blend weight is invented.',
    production_effect_if_approved: 'Use N as the 2026 physical/rank estimate where present; preserve S as labelled context/fallback. Preserve provisional display calibration pending SP-071/engine bridge.',
  },
  {
    id: 'S_PRIMARY_N_CONTEXT',
    technical_recommendation: false,
    annual_time_alignment: 'WEAKER FOR 2026: primary S is a 2025 proxy while N is temporally aligned 2026 direct evidence.',
    construct_directness: 'WEAKER: it gives primary status to a proxy and relegates direct top/max-speed evidence to context.',
    sampling_max_statistic_caveat: 'AVOIDS operational dependence on N but does not resolve the caveat; it discards rather than models the stronger current evidence.',
    coverage: 'WEAKER: S covers 93/100 and therefore cannot be primary for seven current-target players without another fallback.',
    provenance_safety: 'PASS if it leaves N read through the same fail-closed guard; it does not repair the evidence-quality ordering.',
    circularity: 'PASS under existing SP-046/SP-015 restrictions, but it is not selected by PowerPro agreement or future outcomes.',
    arbitrary_unidentifiable_weight: 'NO new S/N blend weight, but the choice of ignoring N as primary is a value judgment rather than a reliability estimate.',
    production_effect_if_approved: 'Keep S primary and N contextual; this is admissible but not the evidence-quality recommendation.',
  },
  {
    id: 'NO_SINGLE_POINT_OWNER_REVIEW_ONLY',
    technical_recommendation: false,
    annual_time_alignment: 'CONSERVATIVE: avoids a production physical point despite aligned 2026 N.',
    construct_directness: 'PRESERVES direct evidence only as owner-review material; no operational primary estimate is produced.',
    sampling_max_statistic_caveat: 'FULLY DEFERRED rather than quantified. This correctly avoids invented reliability but leaves usable bounded direct evidence unoperationalized.',
    coverage: 'Owner review can show all 100 N observations, but there is no production physical point for any player.',
    provenance_safety: 'PASS if the same top_speed-only guard remains in force.',
    circularity: 'PASS: no label teacher, no winner fit, and no future-year selection input.',
    arbitrary_unidentifiable_weight: 'NO: no blend is produced.',
    production_effect_if_approved: 'Do not wire a production physical point until another direct-measure route exists; retain N/S/H2F only as labelled review evidence.',
  },
];

const packet = {
  schema_version: 'sp100_production_wiring_decision_packet_20260816',
  generated_at: '2026-08-16',
  scope: 'SP-100 only; frozen repository evidence only; no external collection; no production code/configuration write.',
  status: 'PARTIAL',
  decision_type: 'OWNER_VALUE_JUDGMENT_REQUIRED',
  technical_recommendation: 'N_PRIMARY_S_CONTEXT_OR_FALLBACK',
  implemented_architecture: null,
  production_behavior_changed: false,
  owner_ruling_after_v2_provenance_repair: {
    found: false,
    v2_repair_commit: '3f42d9a7c4703e75bf9ee406524381611c6b733b',
    pre_v2_owner_policy_commit: '24a4388145dcbd607540a5a5c5c063eb5377e621',
    repository_search_scope: [
      'Current tracked docs, configs, scripts, outputs, and data named in INPUTS',
      'Current SP-100 registry row and SP-046 owner-policy documents',
      'Post-v2 descendants that touched the relevant speed/registry scope: 1405e956, 0c9e475, 4f8721a, ec744fe, 18b070b, 0ed3135, 4022cc5',
    ],
    search_receipts: [
      {
        command: 'git log --all --ancestry-path 3f42d9a.. over the SP-100/provenance/policy/registry paths',
        result: 'Seven relevant descendants were examined. They are Community/owner-blocker integration work; none adds an SP-100 architecture ruling.',
      },
      {
        command: 'git grep in the current tracked repository for the three admissible architecture identifiers and owner/SP-100/wiring decision language',
        result: 'No pre-existing ratification of N_PRIMARY_S_CONTEXT_OR_FALLBACK, S_PRIMARY_N_CONTEXT, or NO_SINGLE_POINT_OWNER_REVIEW_ONLY was found.',
      },
      {
        command: 'manual re-read of docs/audits/owner_policy_ruling_20260814.md, docs/designs/sp046_powerpro_role_policy_v1.md, v2 SP-100 artifacts, provenance guard, and NPB Enterprise lane',
        result: 'They set constraints, record v2 remediation, and leave the wiring winner undeclared; none is an owner approval of an architecture.',
      },
    ],
    result: 'No repository artifact records an explicit post-v2 owner ratification of any admissible production architecture. The 2026-08-14 owner policy opened/constrained SP-100; it did not select a wiring architecture. The v2 candidate artifact explicitly records winner=NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE.',
    non_evidence: 'A technical recommendation, N coverage, the NPB Enterprise article, or an older pre-v2 policy constraint is not owner approval.',
  },
  exact_one_line_owner_approval_required: approval_required,
  evidence_facts: {
    N: '2026 NPB+ top_speed_kmh only; direct maximum-statistic physical evidence; 100 players; generic reliability NOT_IDENTIFIABLE.',
    S: '2025 statistical/proxy speed; 93 players; not a same-time direct measurement.',
    F: 'No single point: any N blend weight is unidentifiable, so existing F is sensitivity-only.',
    H2F: 'Separate VERIFIED_OTHER_SOURCE low-confidence/context lane; never merged into NPB+ and never used to manufacture generic reliability.',
    enterprise_article: 'Separate selected top-50 successful-steal lane. It adds a 周東-only repeated-elite context flag, not a universal reliability coefficient or blend weight.',
    scale: 'Absolute 0–100 display calibration remains provisional pending SP-071 and the engine bridge.',
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
    h2f_separate_context_lane: true,
    absolute_display_scale: 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE',
  },
  coverage_and_comparison: {
    N: candidates.coverage.N,
    S: candidates.coverage.S,
    both: candidates.coverage.F_both,
    H2F: candidates.coverage.h2f,
    S_vs_N_r_on_both: candidates.compare.S_vs_N.r,
    N_vs_H2F_n: candidates.compare.N_vs_H2F.n,
    N_vs_H2F_r: candidates.compare.N_vs_H2F.r,
    caveat: 'N versus NPB+ top speed is definitional/circular and is not a winner criterion.',
  },
  source_hashes,
};

const markdown = `# SP-100 production-wiring decision packet\n\nDate: 2026-08-16  \nStatus: **PARTIAL — owner value judgment required**  \nProduction behavior: **unchanged**\n\n## Decision\n\nTechnical recommendation: **N_PRIMARY_S_CONTEXT_OR_FALLBACK**. This is not owner approval and has not been wired into production.\n\nRequired owner approval (one line):\n\n> ${approval_required}\n\n## Evidence boundary\n\n- **N**: 2026 NPB+ <code>top_speed_kmh</code> only, a direct maximum-statistic measure for 100 players. It is not assumed error-free; generic reliability is **NOT_IDENTIFIABLE**.\n- <code>hp_to_1b_sec</code> is <code>MISATTRIBUTED_SOURCE</code> and remains fail-closed.\n- Exposure is contextual only: it cannot shrink N because it is correlated with the measured trait and N is opportunity-sensitive as a maximum statistic.\n- **S** is a 2025 statistical proxy (93 players), not a 2026 direct measure. H2F remains a separate low-confidence/context lane.\n- The NPB Enterprise article is a selected, separate lane; it adds only a 周東-specific repeated-elite context flag and cannot create generic reliability.\n- Absolute 0–100 calibration remains provisional pending SP-071/engine bridge.\n\n## Architecture comparison\n\n| Architecture | Annual-time alignment | Construct/directness | Coverage | Unidentifiable weight | Technical result |\n|---|---|---|---|---|---|\n${architectures.map(a => `| ${a.id} | ${a.annual_time_alignment} | ${a.construct_directness} | ${a.coverage} | ${a.arbitrary_unidentifiable_weight} | ${a.technical_recommendation ? '**RECOMMEND**' : 'Admissible but not recommended'} |`).join('\n')}\n\nAll three preserve the provenance, circularity, and no-future-outcome guards stated in the JSON packet. The detailed fields also record each sampling/max-statistic caveat.\n\n## Why the recommendation is asymmetric\n\nN is current-season direct physical/rank evidence and covers 100/100. S is an earlier statistical proxy and covers 93/100. Treating the two symmetrically would require a generic N reliability/blend weight that the repository explicitly cannot identify. The recommended architecture therefore does **not** blend them. It keeps S labelled as sanity/context or an appraisal-year fallback without copying 2026 N backward.\n\n## Owner-ruling search result\n\nNo explicit post-v2-provenance-repair owner ruling ratifying one of these architectures was found. The pre-v2 owner policy (commit <code>24a4388</code>) authorizes the constraints and opens SP-100; the v2 provenance repair (commit <code>3f42d9a</code>) explicitly retains <code>winner=NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE</code>. The subsequent owner-blocker/community commits do not record an SP-100 architecture verdict. A recommendation is therefore not treated as approval.\n\n## Source receipt\n\nThe machine-readable packet records SHA-256 hashes for every input, including the v2 N artifact, candidate comparison, provenance guard, SP-046 policy, NPB Enterprise lane, and current registry.\n`;

writeFileSync(rel('outputs/derived/sp100_production_wiring_decision_packet_20260816.json'), `${JSON.stringify(packet, null, 2)}\n`);
writeFileSync(rel('docs/audits/sp100_production_wiring_decision_packet_20260816.md'), markdown);
console.log('SP-100 packet written: PARTIAL; technical recommendation=N_PRIMARY_S_CONTEXT_OR_FALLBACK; production unchanged; owner approval required.');

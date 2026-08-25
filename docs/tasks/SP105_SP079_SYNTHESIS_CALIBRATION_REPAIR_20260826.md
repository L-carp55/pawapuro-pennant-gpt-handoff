# SP-105 — SP-079 synthesis/calibration semantic repair

Date: 2026-08-26
Scope: speed only
Parent: SP-079 browser independent review
Branch: `codex/speed-sp105-sp079-synthesis-calibration-repair-20260826`
Base SP-079 commit: `be3588b26e3ce0818880f80c4a0350764886bb6f`

## Purpose

Repair only the final synthesis/calibration semantics of SP-079. Do not reopen broad data collection. Preserve all validated SP-100 through SP-104 evidence, provenance, exclusion guards and 100-player identity state.

The failure is not that SP-079 omitted files. The failure is that its final point estimator treats heterogeneous percentile families as equally weighted and directly commensurate without an independently validated common calibration, while lower-tier context lanes are mostly non-point context and the ablation summary conflates point effects with interval/confidence/state effects.

Canonical browser review:
`docs/audits/sp079_browser_independent_review_20260826.md`

## Governance lock

Until SP-105 is independently validated:

- SP-079 effective state is `PARTIAL` / superseded by browser review;
- owner verdict ledger remains empty, expected count 0;
- do not run SP-080 or SP-081;
- do not start shoulder/SP-082;
- do not use current or historical PowerPro player labels as physical teacher/weight target;
- do not resurrect old local NPB+ `hp_to_1b_sec`;
- no new broad SNS/video/scouting/WBC/NPB+ collection wave.

## Phase 0 — freeze and reproduce baseline

1. Hash-bind the SP-079 policy, final100, synthesis JSONL, ablation, frozen manifest, SP-100 peak layer, SP-101 multibridge/The Show/ordinal artifacts, SP-103 universe, and SP-104 physical/MLB/transfer artifacts.
2. Reproduce the frozen SP-079 baseline exactly before repair.
3. Record the baseline semantics:
   - equal available family weights;
   - reference population used by each physical family;
   - family coverage counts;
   - point/rank/interval/confidence effects by component.

## Phase 1 — common-scale and weighting benchmark

Do not assume any one repaired estimator is correct. Compare at least these families of policies, subject to data support:

### A. Frozen SP-079 equal-family baseline

Retain unchanged as a control only.

### B. Tier-aware reliability/precision synthesis

A candidate policy where current/high-provenance Tier-A physical evidence has greater point influence than old/protocol-bounded Tier-B evidence, while Tier-B is retained as bounded information rather than discarded.

Weights must be predeclared from source/protocol/time/interval reliability or learned only from physical evidence. No PowerPro target may be used.

### C. Cross-family physical calibration

Where overlapping physical-rich players support it, calibrate each family to a common latent physical-rank scale using player-clustered / leave-player-out validation. Candidate mappings may include monotone/isotonic or hierarchical measurement approaches, but must remain simple enough to audit.

Requirements:
- same target player never calibrates itself;
- same-player seasons stay in one fold unless a predeclared forward-time holdout is used;
- reference population/era/protocol is explicit;
- no current100-only percentile is silently treated as equivalent to an MLB/historical percentile;
- no extrapolation outside common support without an explicit bounded result.

### D. Conservative Tier-A anchor + lower-tier constraint

If cross-family calibration is not identifiable, test a policy where the strongest current direct physical lane anchors the point, and lower-tier physical evidence constrains the interval/rank/conflict state rather than receiving equal point weight. For players without Tier-A evidence, use the strongest defensible available tier with explicit wider uncertainty.

This conservative policy is valid if the data do not identify a better cross-family mapping.

## Validation target

Select among policies using **physical evidence only**, never PowerPro agreement.

Use metrics appropriate to available direct/near-direct physical anchors:

- leave-player-out / player-clustered out-of-sample rank error;
- interval coverage for held-out physical evidence;
- monotonicity and calibration across families;
- stability under source-family removal;
- temporal/protocol sensitivity;
- common-support coverage.

Prefer a simpler policy when performance is statistically indistinguishable.

Do not optimize a desired PowerPro correlation or desired top-speed share.

## Phase 2 — context/ordinal decision-use semantics

Re-audit each nonphysical family separately:

- The Show current/trajectory/update/transition;
- analog/common-support;
- pairwise ordinal graph;
- transition/returnee context;
- statistical proxies;
- scouting/community/video/usage.

For each family and each player classify actual final decision effect as one or more of:

- `POINT_CHANGED`;
- `RANK_CHANGED`;
- `INTERVAL_CHANGED`;
- `CONFIDENCE_CHANGED`;
- `CONFLICT_CHANGED`;
- `EVIDENCE_STATE_CHANGED`;
- `PRESENT_NO_DECISION_EFFECT`;
- `NOT_APPLICABLE`.

A family with zero point/rank effect is not necessarily useless, but the final report must say so explicitly. Do not describe a lane as materially used merely because it was loaded or because it widened uncertainty.

### The Show

The Show remains forbidden as a direct numeric copy. However, validated SP-101 ordinal/trajectory/transition constraints may affect rank/range/conflict when semantically justified. If the full eligible universe still yields no decision effect after proper routing, record an explicit measured zero-effect result.

### Data-rich -> data-poor

Do not force numeric transfer when SP-104 found no production transfer. Use SP-101 validated common-support analog/ordinal information only in the roles actually supported. If no valid point transfer exists, it may affect bounds/rank/conflict only.

## Phase 3 — unresolved-point semantics

For every player distinguish:

- `DEFENSIBLE_POINT_ESTIMATE`;
- `DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE`;
- `NO_DEFENSIBLE_POINT`.

An unresolved direct conflict must not silently appear as an ordinary validated point rating simply because an arithmetic midpoint exists.

If a UI-compatible display number is required, preserve it in a separate field with explicit midpoint-only semantics and keep the scientific point field null when not defensible.

## Phase 4 — rematerialize 100-player appraisal

Produce exactly 100 rows with:

- repaired latent point/interval semantics;
- provisional 0–100 display mapping;
- `point_semantics` field;
- evidence hierarchy/tier receipts;
- per-family calibrated/uncalibrated state;
- actual context decision-use classifications;
- confidence/conflict/missingness;
- pre-SP105 and pre-SP079 comparison fields;
- PowerPro posthoc-only comparison;
- `scale_status=PROVISIONAL_PENDING_SP071_SP072`.

Do not manually tune individual players after seeing PowerPro values.

## Phase 5 — richer final-value ablation

Recompute actual final recommendation with the same eight SP-079 component removals.

For each component report separately:

- point-changed count;
- display-rating-changed count;
- rank-changed count;
- interval-changed count;
- confidence-changed count;
- conflict-changed count;
- evidence-state-changed count;
- point-effect magnitude distribution;
- rank-effect magnitude distribution;
- number applicable/present but zero-effect.

This replaces the ambiguous single `changed_player_count` summary.

Also retain peak-speed correlation/leave-peak-out diagnostics, but do not optimize to a target correlation.

## Independent QA

Independent QA must verify substantive semantics, not only status strings.

Fail-before fixtures must include at least:

1. equal-weight Tier-B row overriding Tier-A without calibration;
2. mixing two percentiles from different reference populations with no calibration tag;
3. PowerPro entering calibration/weight selection;
4. target player appearing in its own calibration fold;
5. same-player season leakage;
6. direct The Show numeric copy;
7. context family marked “materially used” when only loaded and zero-effect;
8. ablation summary that counts interval-only changes as point changes;
9. unresolved conflict emitted as `DEFENSIBLE_POINT_ESTIMATE` without supporting rule;
10. legacy NPB+ H2F use;
11. 30m/50m→T90 conversion;
12. missing source row→zero/slow;
13. owner verdict write or SP-080/SP-081/shoulder output.

Deterministic transforms must rerun byte-identically from frozen inputs.

## Required outputs

At minimum:

- `outputs/derived/sp105_synthesis_policy_benchmark.json`
- `outputs/derived/sp105_cross_family_calibration_receipts.json`
- `outputs/derived/sp105_selected_synthesis_policy.json`
- `outputs/derived/sp105_context_decision_use_100.json`
- `outputs/derived/sp105_final_practical_speed_100.json`
- `outputs/derived/sp105_final_practical_speed_100.csv`
- `outputs/derived/sp105_final_value_component_ablation.json`
- `outputs/derived/sp105_powerpro_posthoc_qa.json`
- `outputs/derived/sp105_global_consistency_qa.json`
- `outputs/derived/qa_sp105_sp079_synthesis_calibration_repair.json`
- `docs/reports/sp105_final_practical_speed_100.md`
- `docs/audits/sp105_sp079_synthesis_calibration_repair.md`

## Definition of Done

SP-105 may close only when:

1. the equal-weight SP-079 baseline is reproduced but not assumed valid;
2. heterogeneous family percentile scales are either empirically calibrated or explicitly kept noncommensurate;
3. selected point influence follows an independently validated physical-only rule;
4. Tier-B imperfect evidence is retained but cannot silently equal Tier-A influence without evidence;
5. context decision use is measured separately for point/rank/interval/confidence/state;
6. The Show/analog/proxy/community zero-effect or material-effect states are honest;
7. unresolved rows have explicit point semantics;
8. exactly 100 rows remain;
9. richer eight-component ablation is actual recomputation;
10. PowerPro remains posthoc-only;
11. owner verdict count remains 0;
12. SP-080/SP-081/shoulder remain untouched;
13. independent QA and fail-before fixtures pass.

Allowed terminal states:

- `DONE_VALIDATED_READY_FOR_SP079_REACCEPTANCE`
- `DONE_NEGATIVE_FINDING_READY_FOR_SP079_REACCEPTANCE`
- `PARTIAL/BLOCKED`

Even if validated, stop at SP-105. Browser GPT must independently review and explicitly reaccept SP-079 before SP-080 or later work.

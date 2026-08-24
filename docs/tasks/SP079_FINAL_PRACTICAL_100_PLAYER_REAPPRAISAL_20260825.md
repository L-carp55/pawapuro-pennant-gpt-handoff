# SP-079 — Final practical 100-player speed reappraisal

Date: 2026-08-25
Scope: 走力のみ
Branch: `codex/speed-sp079-final-practical-reappraisal-20260825`
Base: SP-104 browser acceptance commit `18b06ed78821a6f4658b30b1a9bc834fcf228a21`

## Purpose

Produce the first **final practical 100-player speed appraisal** that actually consumes the completed evidence universe and bounded remediation work. This is the appraisal step that was intentionally delayed while SP-101 through SP-104 repaired evidence scope, inference semantics, missing-source rescue, zero-based completeness, and top-speed dominance.

This task must not regress to the old production blend, must not optimize toward current PowerPro ratings, and must not turn NPB+ peak speed into the whole definition of speed.

## Upstream authority

Mandatory inputs include:

- SP-103 71-row evidence universe and owner-requirement traceability;
- SP-104 accepted browser review and readiness override;
- SP-104 historical physical canonical table;
- SP-104 MLB running splits / Sprint exposure-H2F collection;
- SP-104 all-100 physical states and six-lane ablation;
- SP-101 expanded The Show/MLB/NPB universe and 18-route decision-use receipts;
- SP-102 bounded negative finding;
- SP-100 PowerPro-free NPB+ peak-speed layer;
- SP-077 construct-complete owner-review queue only as an upstream context artifact, not as a frozen final answer.

Canonical browser acceptance:
- `docs/audits/sp104_browser_independent_review_20260825.md`
- `docs/state/speed_sp104_readiness_override_20260825.json`

## Governance locks

During SP-079:

- `owner_verdict_count` must remain 0.
- Do not write SP-078 owner verdicts.
- Do not start shoulder/SP-082.
- Do not run SP-080/SP-081 unless separately authorized after SP-079 review.
- Do not claim engine-calibrated absolute 0–100 scale: SP-071 remains separate.
- Any 0–100 value generated here is a **provisional practical display rating** derived from the evidence-state/rank construct and must carry scale status explicitly.
- PowerPro player-level values are never physical teacher labels and never an optimization target.

# Phase 0 — registry and frozen-input preflight

Before generating any rating:

1. Reconcile `docs/state/speed_task_registry.tsv` to the browser review:
   - SP-104 => `DONE_VALIDATED`, with the bounded NPB+ current-H2F gap explicitly preserved;
   - SP-079 => `PARTIAL` while this task is executing, with SP-103/SP-104 prerequisites satisfied;
   - preserve SP-101 `DONE_VALIDATED`, SP-102 `DONE_NEGATIVE_FINDING`, owner count 0, shoulder block.
2. Run canonical registry QA.
3. Hash-bind all mandatory SP-103/SP-104/SP-101 inputs used by appraisal.
4. Freeze the exact current100 identity set and verify 100/100 stable identities or explicit bounded missingness.

# Phase 1 — freeze the final appraisal construct and evidence hierarchy

Before computing player values, materialize a machine-readable appraisal policy.

## Construct

The target is **baseball-relevant physical running speed**, not track 50m alone and not baserunning/stealing skill.

Keep at least these constructs distinct:

1. peak/top speed;
2. initial acceleration / home-to-first;
3. standardized end-to-end / T90 / 90ft;
4. short-distance historical physical tests;
5. defensive burst/chase context;
6. age/injury/trajectory context;
7. external-game appraisal/trajectory context;
8. ordinal/analog/range constraints;
9. statistical outcome proxies;
10. baserunning/stealing technique/context;
11. community/scouting/video directional context.

Technique/context lanes may explain conflicting outcomes but must not automatically raise/lower pure physical speed.

## Evidence hierarchy

Predeclare a hierarchy rather than learning weights from PowerPro labels. At minimum distinguish:

- Tier A: current direct/near-direct physical evidence with strong provenance;
- Tier B: historical/protocol-bounded physical measurement ranges and validated same-system MLB running evidence;
- Tier C: leakage-safe ordinal/analog/transition/trajectory constraints that pass common support;
- Tier D: scouting/community/video/usage directional context;
- Tier E: mixed outcome proxies, only after double-count and technique guards.

No tier may be silently discarded because another tier is available. No low-tier lane may override contradictory high-tier physical evidence without an explicit conflict state.

## Missingness

Missing evidence is not slow, average, or zero. A player with one direct lane and many missing lanes must carry wider uncertainty rather than receive synthetic agreement.

# Phase 2 — per-player evidence synthesis

For all 100 players, produce an auditable synthesis row.

Mandatory per-player fields:

- stable identity;
- current NPB+ peak-speed evidence and exposure/reliability context;
- current/historical acceleration/H2F evidence;
- T90/90ft/end-to-end evidence;
- 30m/50m/historical timed-test ranges;
- MLB Statcast running evidence where eligible;
- The Show Speed / update trajectory / transition context where eligible;
- PowerPro trajectory/stale context, explicitly non-teacher;
- SP-101 analog/ordinal/transition/consensus routes with actual decision-use state;
- SP-104 transfer candidates, preserving `NO_COMMON_SUPPORT` and non-selected production policy;
- age/injury/scouting/community/video/usage context where available;
- statistical proxy evidence with double-count group;
- technique/baserunning fields separated from physical speed;
- missingness reasons;
- conflict state;
- evidence range/latent percentile interval;
- confidence tier;
- exact evidence IDs that materially affected the recommendation.

## The Show rule

The Show must be used across the full eligible MLB/NPB universe established by SP-101, not a tiny same-time subset, but only in roles supported by validated semantics:

- longitudinal trajectory;
- roster-update response;
- cross-league/returnee context;
- relative/ordinal/analog constraint;
- external appraisal consensus/conflict.

Do not directly convert a The Show Speed value into a current NPB/PowerPro speed number, and do not let PowerPro labels enter the physical path.

## Data-rich -> data-poor rule

Data-poor players must be explicitly compared against data-rich/reference players whenever a validated common-support route exists. Use SP-101/SP-104 analog/ordinal/range evidence only to the extent validated.

A player must end in one of:

- `DIRECT_MULTI_CONSTRUCT`;
- `DIRECT_PEAK_PLUS_BOUNDED_OTHER`;
- `DIRECT_PEAK_ONLY_WITH_CONTEXT`;
- `SUPPORTED_ANALOG_OR_ORDINAL_RANGE`;
- `NO_COMMON_SUPPORT_WIDE_INTERVAL`;
- `UNRESOLVED`.

Silent fallback to the old statistical model or existing PowerPro rating is forbidden.

# Phase 3 — final practical recommendation

For each of 100 players generate:

- `latent_speed_percentile_point` (only when defensible);
- `latent_speed_percentile_interval`;
- `practical_speed_rating_provisional_0_100`;
- `practical_rating_interval_0_100`;
- `confidence`;
- `evidence_state`;
- `primary_reasons`;
- `material_conflicts`;
- `missing_material_lanes`;
- `rating_change_vs_pre_sp079_project`;
- `difference_vs_current_powerpro_for_QA_only`;
- `scale_status = PROVISIONAL_PENDING_SP071_SP072`.

If a point value is not defensible, the row must still exist and may use an explicitly rule-bounded practical midpoint only if the rule is predeclared and the interval/confidence makes uncertainty visible. Do not fabricate precision.

PowerPro comparison is post-hoc QA only. It must not feed the appraisal formula or manual correction rule.

# Phase 4 — final-value ablation and anti-dominance QA

This is mandatory and must operate on the **actual final appraisal output**, not only evidence-state labels.

For each player remove and fully recompute:

1. NPB+ peak speed;
2. acceleration/H2F + T90/90ft physical lane;
3. historical physical tests;
4. MLB Statcast running bridge;
5. The Show context;
6. analog/ordinal/transition routes;
7. statistical proxies;
8. scouting/community/video/usage context.

Report changes in:

- point rating;
- interval;
- rank/percentile;
- confidence;
- conflict state.

## Top-speed dominance guard

Do not impose an arbitrary target share. Instead measure:

- correlation of final ratings/ranks with NPB+ peak speed;
- leave-peak-out rating/rank changes;
- players whose final value is effectively determined by peak speed because all other evidence is missing;
- players where independent non-peak evidence materially changes the result.

For `PEAK_ONLY` players, peak speed may legitimately dominate, but the reason must be **lack of defensible independent evidence**, not a hard-coded weighting architecture.

# Phase 5 — global consistency and sanity QA

At minimum:

- exact 100-player denominator;
- no duplicate identities;
- no missing row silently dropped;
- no PowerPro player-level leakage;
- no The Show direct-copy path;
- no contaminated legacy NPB+ H2F use;
- 30m/50m never proportionally converted to T90;
- missing MLB/NPB rows never interpreted as slow;
- transfer/self-teaching and same-player season leakage rejected;
- stealing/baserunning technique separated;
- double-count groups enforced;
- rating monotonicity with latent recommendation except documented bounded rounding/conflict rules;
- no normalization that uses only the current100 as if it were the entire baseball population unless explicitly labeled diagnostic;
- current PowerPro agreement/disagreement analyzed only after ratings are frozen;
- deterministic rerun byte-identical from frozen inputs for deterministic stages.

## Case review

Produce a human-readable review table for at least:

- highest and lowest final values;
- largest changes from pre-SP079 project estimate;
- largest differences vs current PowerPro (QA only);
- largest peak-speed-ablation changes;
- players with strong The Show/MLB bridge influence;
- players resolved via analog/ordinal constraints;
- players remaining peak-only;
- all `UNRESOLVED` or lowest-confidence players.

This table is diagnostic; do not manually tune values to look plausible.

# Independent QA / red-team

Independent QA must reproduce calculations and include fail-before fixtures that detect at minimum:

- PowerPro entering teacher/features/optimization;
- direct The Show→current rating copy;
- legacy quarantined NPB+ H2F use;
- 30m/50m→T90 conversion;
- missing source row→zero/slow;
- target self-teaching or same-player season leakage;
- baserunning/stealing technique leaking into physical score;
- same event double counted through multiple proxies;
- final-value ablation that edits labels without recomputing ratings;
- one of 100 players silently omitted;
- top-speed weight hard-coded to dominate independent evidence;
- owner verdict write or shoulder artifact creation.

# Required canonical outputs

At minimum:

- `outputs/derived/sp079_appraisal_policy.json`
- `outputs/derived/sp079_frozen_input_manifest.json`
- `outputs/derived/sp079_player_evidence_synthesis.jsonl`
- `outputs/derived/sp079_final_practical_speed_100.csv`
- `outputs/derived/sp079_final_practical_speed_100.json`
- `outputs/derived/sp079_final_value_component_ablation.json`
- `outputs/derived/sp079_powerpro_posthoc_qa.json`
- `outputs/derived/sp079_global_consistency_qa.json`
- `outputs/derived/qa_sp079_final_practical_reappraisal.json`
- `docs/reports/sp079_final_practical_speed_100.md`
- `docs/audits/sp079_final_practical_reappraisal_independent_audit.md`

# Definition of Done

SP-079 may close `DONE_VALIDATED` only when:

1. all 100 players have a final practical row;
2. SP-103/SP-104 evidence universe is consumed according to its classification rather than ignored;
3. every material evidence route has per-player decision-use receipts;
4. data-poor players have explicit analog/common-support/no-support state;
5. final values are recomputed under component ablations;
6. peak-speed dominance is measured on final values;
7. PowerPro and The Show leakage guards pass;
8. technique/double-count guards pass;
9. deterministic QA passes;
10. independent red-team passes;
11. `owner_verdict_count=0`;
12. shoulder/SP-080/SP-081 are not run in this task.

If the final appraisal cannot defensibly create a point rating for some players without violating these rules, do not force completion. Close `PARTIAL` with explicit rows/intervals and the smallest material blocker.

## Stop condition

Stop after SP-079 independent audit and push. Do not write owner verdicts, do not start SP-080/SP-081, and do not start shoulder. Browser GPT must independently review the 100-player output before the next transition.

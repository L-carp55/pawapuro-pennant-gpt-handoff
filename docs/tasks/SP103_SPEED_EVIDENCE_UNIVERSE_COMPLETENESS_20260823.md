# SP-103 — Speed Evidence Universe completeness audit

Date: 2026-08-23
Status: **NOT_STARTED / BLOCKS_SP079**
Scope: **走力のみ**

## Operating context

Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
Canonical workspace: `/mnt/c/Users/amila/Desktop/Claude Code/repos/pawapuro-pennant-gpt-handoff`
Branch: `codex/speed-sp103-evidence-universe-completeness-20260823`
Base commit: `a2808b080be0eaefe95ba41da47bbfe1cf93cacb`

Do not run SP-079, do not write an SP-078 owner verdict, and do not start shoulder appraisal while SP-103 is incomplete.

## Why SP-103 exists

The speed rebuild accumulated many useful data sources and inference ideas over multiple waves, but the project did not begin from one zero-based inventory of every potentially usable source, construct, transfer method, and decision role. Historical tasks themselves record omissions (for example 50m and defensive metrics), and several later requirements were added after owner feedback.

SP-103 therefore performs one explicit completeness pass before final practical appraisal. The goal is not to prove that every imaginable datum is useful. The goal is to ensure that every plausible evidence family is explicitly classified as implemented, partially implemented, collected-but-unused, not collected, source-confirmed-new, scoped-rejected, or measured-negative, with a reason and a next action.

## Core principles

1. Start from the latent construct: **baseball-relevant physical running speed**, not from whichever metric is easiest to collect.
2. Keep distinct constructs separate:
   - top speed;
   - initial acceleration / contact-to-first;
   - end-to-end / full-effort speed;
   - defensive straight-line burst/chase;
   - baserunning/stealing technique and decision-making;
   - historical trajectory / age / injury;
   - external game appraisal;
   - ordinal/range context;
   - scale/engine calibration.
3. Never treat missing data as slow or zero.
4. Never discard a directional source merely because it is imperfect; preserve range/confidence/protocol uncertainty where usable.
5. Do not double-count the same underlying event or outcome through multiple derived metrics.
6. Do not use PowerPro as physical ground truth.
7. Do not copy MLB The Show Speed directly into a current NPB/PowerPro rating.
8. Data-rich players may be used as reference/anchor populations for data-poor players only through explicit leakage-safe transfer methods with common-support and uncertainty checks.
9. A source being present in the repository is not proof that it is decision-effective. Decision use must be separately audited.
10. Negative findings are scoped to the tested route and must not invalidate adjacent uses.

## Mandatory inventory dimensions

Create a canonical evidence-universe table. Every row must contain at least:

- `evidence_id`
- `family`
- `source_or_metric`
- `construct`
- `directness` (`DIRECT_PHYSICAL`, `NEAR_DIRECT_PHYSICAL`, `OUTCOME_PROXY`, `EXTERNAL_APPRAISAL`, `CONTEXT`, `CALIBRATION_ONLY`)
- `time_role` (`CURRENT`, `HISTORICAL`, `CROSS_TIME`, `TRANSITION`, `TIME_INVARIANT`)
- `source_authority`
- `source_url_or_repo_artifact`
- `current_local_asset`
- `coverage_denominator`
- `existing_requirement_ids`
- `existing_sp_routes`
- `acquisition_status`
- `implementation_status`
- `decision_use_status`
- `independence_or_double_count_risk`
- `known_bias_or_confounding`
- `validation_needed`
- `next_action`

Allowed top-level status vocabulary:

- `IMPLEMENTED`
- `IMPLEMENTED_INCOMPLETE`
- `COLLECTED_UNUSED`
- `NOT_COLLECTED`
- `SOURCE_CONFIRMED_NEW`
- `REJECTED_SCOPED`
- `MEASURED_NEGATIVE`
- `BLOCKED_EXTERNAL`

## Mandatory evidence families to inspect

This is a floor, not a ceiling. Agents must actively search for additional candidates.

### A. Direct / near-direct physical running evidence

1. NPB+ Hawk-Eye **Sprint Speed / スプリントスピード**.
2. NPB+ Hawk-Eye **最速タイム（一塁到達）**.
   - Current official NPB+ product information explicitly lists Sprint Speed and fastest home-to-first as separate batter tracking fields.
   - Historical local `npb_plus_measurement.hp_to_1b_sec` was previously classified `MISATTRIBUTED_SOURCE`; do **not** silently resurrect it.
   - Reopen source availability only. Recollect exact per-player H2F from the current official source with provenance before use.
3. MLB Statcast Sprint Speed.
4. MLB Statcast **90-foot Running Splits**, including 5-foot cumulative splits where available.
   - Treat this as a potential acceleration-shape / standardized end-to-end lane, not merely another copy of Sprint Speed.
5. MLB Statcast Outfielder Jump **Burst** component.
   - Keep Burst separate from Reaction and Route.
   - It is defensive-context acceleration/burst evidence, not a universal running-speed measurement.
6. Historical home-to-first records from sourced articles/video timing.
7. Historical 30m / 50m physical tests.
8. Any directly timed T90 / basepath / full-effort run.
9. Any NPB tracking-derived event-level baserunning speed that can be reproduced from an official source.
10. Defensive straight-line tracking if a source can isolate physical chase speed from reaction/route/positioning.

### B. Outcome-derived proxies — never direct physical truth

11. Infield-hit rate / infield grounder outcomes.
12. GDP avoidance.
13. Triple rate.
14. Extra-base advancement / baserunning advances.
15. UBR / BsR-compatible measures.
16. DELTA / 1.02 `Spd (Speed Score)`.
   - 1.02 defines it from stolen-base success, stolen-base attempt frequency, triples, and scoring frequency.
   - Therefore it is a composite outcome proxy with major technique/opportunity overlap and double-count risk.
17. Stolen-base outcomes only as technique/context unless a model explicitly separates start/lead/opportunity from physical speed.
18. Statcast Baserunning Run Value or analogous outcome value, if available for eligible MLB players, as technique/context unless deconfounded.

For 11–18, test whether conditioning/residualization can recover additional physical information without turning another mixed proxy into a false direct measurement. Candidate conditioning variables include batter side, opportunity count, batted-ball type/location, exit velocity where available, outs/base state, and fielder/arm context.

### C. External appraisal / cross-game evidence

19. MLB The Show Live/base-roster Speed current and historical.
20. MLB The Show roster-update Speed deltas.
21. The Show Stealing and Baserunning Aggressiveness as **separate technique/context fields**, never collapsed into Speed.
22. NPB→MLB Japanese-player transitions.
23. MLB→NPB foreign-player transitions.
24. NPB→MLB→NPB returnees.
25. Multi-cycle MLB/NPB players.
26. Historical NPB players with The Show data even when not in current 100.
27. PowerPro current value as appraisal context only.
28. PowerPro longitudinal trajectory / inertia / stale-detection context.
29. Prospi A raw data retained under the existing owner ruling; do not silently promote it as an independent PowerPro stale teacher.
30. Console Prospi non-collection under the existing ruling unless new evidence shows genuine independent information.

### D. Human/context evidence

31. Official scouting reports.
32. Draft / amateur timed-test reporting.
33. Pinch-runner usage.
34. Video-frame timing / narration.
35. Ordinary web / X / YouTube physical observations.
36. Rating-opinion/community evidence kept separate from physical claims.
37. Injury / recovery.
38. Age and longitudinal physical decline.
39. Explicit player-vs-player faster/slower claims where both endpoints are actually supported.
40. Generic fast/slow labels retained as weak directional evidence rather than zeroed.

### E. Defensive movement context

41. Existing RngR / UZR / UZR_1200 / UZR_200 / range_runs assets.
42. Statcast Outfielder Jump Burst for MLB-experienced outfielders.
43. Any NPB tracking-derived fielder movement / straight-line speed that can be separated from reaction, route efficiency, positioning, and fielding skill.

Existing structured range metrics must be inventoried even if ultimately not used for base speed. Do not infer that `range` equals pure running speed.

### F. Data-rich → data-poor transfer / inference methods

Existing SP-101 methods must be audited for actual final-appraisal readiness, not just existence:

44. normalized L2 analog matching.
45. mutual kNN.
46. covariance-aware Mahalanobis matching.
47. optimal-transport distribution matching.
48. shared-indicator prediction with player-clustered holdout.
49. multi-trait latent measurement model.
50. within-player temporal delta.
51. league-transition model.
52. returnee synthetic controls.
53. pairwise/ordinal constraint graph.
54. independent-lane consensus/conflict synthesis.
55. route-removal ablation.

Also evaluate, rather than assume unnecessary, these transfer methods:

56. leakage-safe **anchor calibration**: use data-rich players with direct physical evidence to learn bounded mappings from sparse/common features to latent physical-speed percentile.
57. cross-fitted / leave-player-out transfer so an anchor player never teaches its own target estimate.
58. hierarchical partial pooling or interval transfer for sparse players, respecting the current-year-first owner rule.
59. rank/quantile mapping anchored only on physical-rich players, with PowerPro labels excluded from the physical teacher path.
60. multiple-imputation / interval propagation rather than forced point estimates when evidence families are missing.
61. handedness/protocol-aware H2F calibration; raw contact-to-first is not directly comparable across left/right batting sides without accounting for geometry and measurement protocol.
62. acceleration-shape features derived from MLB 5-foot splits to validate how H2F/T90/top-speed constructs relate; do not assume a universal conversion to NPB.

For each transfer method, record: training population, target population, features, target construct, common-support rule, leakage guard, holdout design, calibration error, uncertainty, and whether it is actually used by the final appraisal.

### G. Scale / engine calibration — not player evidence

63. provisional relative-to-display scale.
64. ability-value → custom-engine movement-response bridge.
65. league-distribution simulation QA.
66. current-100 vs non-100 full-roster scale consistency.

These may calibrate the final 0–100 scale but must not be confused with evidence that a specific player is physically faster or slower.

## Required source re-verification receipts

Persist independent receipts for at least:

- NPB+ official current tracking fields: Sprint Speed and fastest home-to-first are separate.
- MLB Statcast 90-foot Running Splits definition and available seasons/fields.
- MLB Statcast Outfielder Jump components, especially Burst vs Reaction vs Route.
- 1.02 Spd definition/formula and its outcome-proxy nature.
- prior NPB+ H2F provenance-contamination ruling and the fact that current official availability does not validate old local values.

## Mandatory repository-wide collected-but-unused audit

Do not limit the scan to files already named in speed tasks.

1. Enumerate relevant SQLite tables/views and columns.
2. Enumerate JSON/JSONL/CSV/TSV/Parquet derived/manual data with speed/running/baserunning/range/scouting/video/community/game-attribute signals.
3. Search field names and semantic descriptions, not only filenames.
4. For every discovered candidate, state whether it is used by any current speed route.
5. Measure counts/coverage where feasible.
6. Explicitly flag assets that are collected but not decision-effective.

Known local examples that must be checked include:

- `baserunning_advances` / play-by-play advancement events;
- `infield_grounder_events`;
- historical web-collected H2F / 30m / 50m records;
- structured range metrics discovered in prior audits;
- MLB bridge / The Show history;
- Community/X/YouTube corpora;
- age/injury assets.

## Owner-requirement traceability

Map every row of `docs/state/speed_requirements_baseline_20260813.tsv` relevant to evidence, inference, scale, or final appraisal into the universe. Then separately create a plain-language owner-feedback map covering ideas that entered the project after initial implementation, including at minimum:

- The Show for **all MLB-experienced eligible players**, not a tiny same-time sample;
- NPB→MLB, MLB→NPB, returnees and historical NPB players;
- PowerPro/The Show ability trajectories;
- data-rich players as anchors for data-poor players;
- imperfect evidence retained with bounded uncertainty;
- top-speed dominance must be audited rather than assumed acceptable;
- physical running speed must remain separate from stealing/baserunning technique.

No owner idea may be marked `COVERED` merely because a similarly named file exists. Point to the exact implemented route and a decision-use/ablation receipt.

## Red-team questions

The independent QA must be able to answer:

1. What useful source or derived field exists locally but is unused?
2. What official source is currently available but not collected?
3. Which route is implemented but cannot currently affect any player decision?
4. Which data-poor players have no explicit anchor/transfer path?
5. Does any proxy double-count the same stolen-base/triple/advance events?
6. Does any The Show use silently become a PowerPro teacher or direct copy?
7. Does any H2F use ignore handedness, contact timing, bunt/swing context, or protocol?
8. Does top speed dominate because other lanes are absent rather than because evidence supports that weighting?
9. Does removal of top speed, The Show, analogs, historical physical evidence, or proxies materially change the eventual appraisal state?
10. Are negative findings scoped narrowly enough that an adjacent valid use was not accidentally disabled?

## Required outputs

At minimum:

- `outputs/derived/sp103_speed_evidence_universe.tsv`
- `outputs/derived/sp103_local_asset_inventory.json`
- `outputs/derived/sp103_external_source_verification.json`
- `outputs/derived/sp103_collected_but_unused.json`
- `outputs/derived/sp103_inference_method_universe.json`
- `outputs/derived/sp103_owner_requirement_traceability.tsv`
- `outputs/derived/sp103_gap_and_remediation_plan.json`
- `outputs/derived/sp103_pre_sp079_readiness.json`
- `outputs/derived/qa_sp103_speed_evidence_universe.json`
- `docs/audits/sp103_speed_evidence_universe_completeness.md`

## Completion / decision rules

SP-103 may close only when:

1. The inventory is zero-based and not restricted to the existing 18 SP-101 routes.
2. Every mandatory candidate above has a measured status and source/provenance.
3. Repository-wide collected-but-unused scanning is evidenced with denominators.
4. Current official external opportunities are verified and acquisition gaps are explicit.
5. All owner requirements/feedback are mapped to exact implementation or an explicit gap.
6. Data-rich→data-poor transfer is proven for each eligible route or explicitly unavailable for a player.
7. No metric is promoted merely because it is named `speed`.
8. Double-counting and technique contamination risks are explicitly audited.
9. NPB+ H2F provenance conflict is resolved without reusing the invalid old values.
10. An independent QA/red-team suite checks computation and decision use, not only file existence.
11. Important negative findings are committed.
12. `owner_verdict_count` remains 0.
13. SP-079 remains blocked until SP-103 gives an explicit `READY_FOR_SP079` result.
14. No shoulder artifact is created.
15. Deterministic transforms rerun reproducibly from frozen inputs where applicable.

If gaps are found, **do not stretch SP-103 indefinitely**. Classify each gap by expected information gain and create a bounded remediation child task only for gaps likely to materially change final appraisal. Low-value or inaccessible gaps may be closed as measured missingness/negative findings.

## Stop condition

Stop after SP-103 completeness audit and bounded remediation plan. Do not start SP-079 automatically. Final practical ratings require a separate explicit transition after SP-103 independent review.

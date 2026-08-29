# SP-105 SP-079 synthesis/calibration semantic repair — 100 players

Date: 2026-08-29
Terminal finding: DONE_NEGATIVE_FINDING_READY_FOR_SP079_REACCEPTANCE (registry remains PARTIAL/gate-blocking until browser reacceptance).

## Selected policy

CONSERVATIVE_TIER_A_ANCHOR_LOWER_TIER_BOUNDED_CONSTRAINT was selected using physical evidence only. The current NPB+ peak percentile is the sole Tier-A point anchor. Historical/protocol-bounded H2F, T90/90ft and 30m/50m evidence is preserved with native reference populations, intervals and provenance, but has zero point weight and cannot silently override the anchor. The frozen equal-family average remains a reproduced control only.

Cross-family calibration was attempted with player-clustered leave-player-out mappings, same-player seasons held together, explicit common-support checks and no extrapolation. The sparse T90 and heterogeneous H2F/short-distance reference populations did not jointly identify a defensible production mapping, so no mapping was promoted. This is a measured negative calibration finding, not a claim that the lower evidence is useless.

## Baseline reproduction and regression case

- SP-079 base commit: be3588b26e3ce0818880f80c4a0350764886bb6f
- Frozen policy/final100/synthesis/CSV/ablation/QA/global QA/report/audit: byte-identical in a fresh isolated reproduction: **PASS**
- 中川 圭太 regression: peak percentile 0.7576, historical bounded H2F percentile 0.126761, frozen 50:50 point 0.442181 / rating 44. The repair does not manually tune this player; the lower family is retained as a native-scale constraint.

## 100-player output

- Rows: **100**; queue order 1–100; scale: PROVISIONAL_PENDING_SP071_SP072
- Point semantics: {"DEFENSIBLE_POINT_ESTIMATE":100}
- Evidence states: {"TIER_A_ANCHOR_WITH_LOWER_TIER_CONSTRAINTS":48,"TIER_A_ANCHORED_PEAK_ONLY":52}
- Confidence: {"LOW":100}
- Defensible point rows: 100; display-midpoint-only rows: 0; no-defensible-point rows: 0

Every final row includes family/tier influence, native reference-population receipts, lower-tier constraints, missingness/conflict/confidence, point semantics, pre-SP-105 frozen SP-079 and pre-SP-079 project comparison fields, plus posthoc-only PowerPro fields. No player-specific manual adjustment was made.

## Largest changes versus frozen SP-079 baseline

| Queue | Player | SP-105 rating | SP-079 rating | Change | Point semantics |
|---:|---|---:|---:|---:|---|
| 62 | 村林 一輝 | 99 | 60 | 39 | DEFENSIBLE_POINT_ESTIMATE |
| 29 | ポランコ | 32 | 69 | -37 | DEFENSIBLE_POINT_ESTIMATE |
| 54 | 並木 秀尊 | 98 | 63 | 35 | DEFENSIBLE_POINT_ESTIMATE |
| 1 | 中川 圭太 | 76 | 44 | 32 | DEFENSIBLE_POINT_ESTIMATE |
| 40 | 外崎 修汰 | 69 | 39 | 30 | DEFENSIBLE_POINT_ESTIMATE |
| 20 | 細川 成也 | 79 | 50 | 29 | DEFENSIBLE_POINT_ESTIMATE |
| 72 | 梶原 昂希 | 89 | 62 | 27 | DEFENSIBLE_POINT_ESTIMATE |
| 94 | 佐藤 輝明 | 66 | 41 | 25 | DEFENSIBLE_POINT_ESTIMATE |
| 10 | カリステ | 39 | 63 | -24 | DEFENSIBLE_POINT_ESTIMATE |
| 24 | 清宮 幸太郎 | 53 | 29 | 24 | DEFENSIBLE_POINT_ESTIMATE |
| 34 | 山口 航輝 | 61 | 37 | 24 | DEFENSIBLE_POINT_ESTIMATE |
| 97 | 小幡 竜平 | 82 | 58 | 24 | DEFENSIBLE_POINT_ESTIMATE |

## Rich eight-component actual recomputation ablation

Each row below is derived from 100 actual full synthesis reruns with the named component removed (800 cells total). Counts are intentionally separate; interval-only changes are not point changes.

| Removed component | Present/applicable | Point | Display rating | Rank | Interval | Confidence | Conflict | Evidence state | Point effect magnitude | Rank effect magnitude | Present zero-effect |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|
| peak_speed | 100 | 100 | 100 | 100 | 100 | 52 | 0 | 100 | {"n":48,"min":0.0133,"max":0.7774,"mean":0.28294,"median":0.242206,"p90":0.602393,"invalidated_count":52,"created_count":0} | {"n":0,"min":null,"max":null,"mean":null,"median":null,"p90":null,"invalidated_count":100,"created_count":0} | 0 |
| acceleration_h2f_t90_90ft | 22 | 0 | 0 | 0 | 22 | 0 | 12 | 12 | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | 0 |
| historical_physical | 48 | 0 | 0 | 0 | 45 | 0 | 42 | 42 | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | 3 |
| mlb_statcast_running_bridge | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | 6 |
| the_show_context | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | 4 |
| analog_ordinal_transition | 96 | 0 | 0 | 0 | 96 | 0 | 0 | 0 | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | 0 |
| statistical_proxies | 98 | 0 | 0 | 0 | 98 | 0 | 0 | 0 | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | 0 |
| scouting_community_video_usage_context | 18 | 0 | 0 | 0 | 18 | 0 | 0 | 0 | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | {"n":100,"min":0,"max":0,"mean":0,"median":0,"p90":0,"invalidated_count":0,"created_count":0} | 0 |

## Context decision-use

The Show numeric values were never copied or used as a physical point. Each context lane is classified from its own removal-and-recompute cell; PRESENT_NO_DECISION_EFFECT is reported explicitly.

| Lane | Actual classifications across 100 rows |
|---|---|
| the_show_context | {"NOT_APPLICABLE":96,"PRESENT_NO_DECISION_EFFECT":4} |
| analog_ordinal_transition | {"INTERVAL_CHANGED":96,"NOT_APPLICABLE":4} |
| statistical_proxies | {"INTERVAL_CHANGED":98,"NOT_APPLICABLE":2} |
| scouting_community_video_usage_context | {"INTERVAL_CHANGED":18,"NOT_APPLICABLE":82} |

## Calibration benchmark

Candidate A is the exact SP-079 equal-family control. Candidate B uses declared physical source/protocol/interval reliability but remains uncalibrated. Candidate C is player-clustered LOO isotonic mapping under common support. Candidate D is the selected anchor/constraint policy. Held-out metrics are recorded in outputs/derived/sp105_synthesis_policy_benchmark.json; no PowerPro agreement was used for selection.

- A: {"case_count":112,"point_case_count":112,"held_out_mae":0.272125,"held_out_rmse":0.335604,"held_out_rank_error":0.295849,"held_out_rank_correlation":0.20865568631452808,"interval_coverage":0.142857,"mean_interval_width":0.127381,"common_support_case_count":0,"common_support_coverage":0}
- B: {"case_count":112,"point_case_count":112,"held_out_mae":0.274077,"held_out_rmse":0.339664,"held_out_rank_error":0.290621,"held_out_rank_correlation":0.2395656026131218,"interval_coverage":0.142857,"mean_interval_width":0.127381,"common_support_case_count":0,"common_support_coverage":0}
- C: {"case_count":112,"point_case_count":80,"held_out_mae":0.216624,"held_out_rmse":0.259565,"held_out_rank_error":0.258544,"held_out_rank_correlation":0.4146108156337949,"interval_coverage":0.75,"mean_interval_width":0.668218,"common_support_case_count":80,"common_support_coverage":0.714286}; eligible mappings 1/12
- D: {"case_count":112,"point_case_count":0,"held_out_mae":null,"held_out_rmse":null,"held_out_rank_error":null,"held_out_rank_correlation":null,"interval_coverage":1,"mean_interval_width":1,"common_support_case_count":112,"common_support_coverage":1}; no cross-family numeric prediction is claimed, so its validation interval is deliberately bounded [0,1]

## Descriptive top-speed diagnostics

Peak-versus-native-family correlations and the leave-peak-out rerun are descriptive only; neither was optimized toward a target correlation or used as a production transfer. {"schema_version":"sp105_top_speed_descriptive_diagnostics_v1","top_speed_reference_population":"SP100_CURRENT100_NPB_PLUS_2026","peak_vs_native_family":[{"family":"ACCELERATION_H2F","paired_player_count":22,"pearson_correlation":-0.010353,"rank_correlation":-0.00511,"reference_population_note":"family-native percentiles are not assumed commensurate; descriptive correlation only","selection_use":false,"production_use":false},{"family":"END_TO_END_90FT","paired_player_count":6,"pearson_correlation":0.198131,"rank_correlation":0.257143,"reference_population_note":"family-native percentiles are not assumed commensurate; descriptive correlation only","selection_use":false,"production_use":false},{"family":"SHORT_DISTANCE","paired_player_count":36,"pearson_correlation":0.562616,"rank_correlation":0.555061,"reference_population_note":"family-native percentiles are not assumed commensurate; descriptive correlation only","selection_use":false,"production_use":false}],"leave_peak_out":{"method":"ACTUAL_FULL_SYNTHESIS_RERUN_WITH_CURRENT_TIER_A_PEAK_REMOVED","selection_use":false,"production_use":false,"cell_count":100,"point_semantics_distribution":{"DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE":48,"NO_DEFENSIBLE_POINT":52},"point_defined_after_removal_count":48,"display_only_after_removal_count":48,"no_defensible_point_after_removal_count":52,"rank_eligible_after_removal_count":0,"point_invalidation_count":52,"rank_eligibility_invalidation_count":100,"note":"This is a descriptive stress test of Tier-A dependence, not a claim that lower-family fallback points are calibrated."},"calibration_receipt_count":4,"hard_coded_peak_weight":false,"descriptive_only":true,"generated_at":"2026-08-29"}

## Unresolved and no-defensible-point rows

- None in the final 100-player anchor output; display-only/no-defensible semantics remain enforced for no-anchor or unresolved ablation states.

## QA and governance

- Internal global consistency QA: PASS_PRE_INDEPENDENT_QA
- Independent red-team QA: generated separately at outputs/derived/qa_sp105_sp079_synthesis_calibration_repair.json
- PowerPro posthoc: PASS_POSTHOC_ONLY, matched 99, all teacher flags false; loaded after core values froze
- Owner verdict count: **0**
- SP-079: PARTIAL, superseded by this repair pending browser reacceptance
- SP-080: NOT_STARTED; SP-081: NOT_STARTED; shoulder/SP-082: BLOCKED_DEPENDENCY
- New broad collection, owner verdict input, SP-080/SP-081, shoulder work: **not executed**
- Required fail-before fixtures and deterministic rerun: see the independent QA artifact.

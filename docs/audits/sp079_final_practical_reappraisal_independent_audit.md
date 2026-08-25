# SP-079 Independent Final Practical Reappraisal Audit

Date: 2026-08-25
Process: separate deterministic Node QA process after the synthesis generator
Result: **PASS_INDEPENDENT_RED_TEAM**

## Scope

This audit covers the frozen current100 100-player output, evidence-synthesis JSONL, eight-component actual ablation (800 cells), PowerPro posthoc QA, registry/owner locks, and fail-before red-team fixtures. It does not enter owner verdicts, run SP-080/SP-081, or touch shoulder work.

## Independent checks

50 checks passed; 0 checks failed.

| Check | Result | Detail |
|---|---|---|
| required:outputs/derived/sp079_appraisal_policy.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_frozen_input_manifest.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_player_evidence_synthesis.jsonl | PASS | exists and non-empty |
| required:outputs/derived/sp079_final_practical_speed_100.csv | PASS | exists and non-empty |
| required:outputs/derived/sp079_final_practical_speed_100.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_final_value_component_ablation.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_powerpro_posthoc_qa.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_global_consistency_qa.json | PASS | exists and non-empty |
| required:docs/reports/sp079_final_practical_speed_100.md | PASS | exists and non-empty |
| population:exact_100 | PASS | {"count":100} |
| population:queue_order | PASS | queue_order 1..100 |
| population:jsonl | PASS | {"count":100} |
| population:csv | PASS | {"count":100} |
| population:cross_format | PASS | JSON/CSV key order agrees |
| schema:required_player_fields | PASS | point/interval/confidence/state/scale |
| schema:monotone_mapping | PASS | rating is the declared monotone mapping |
| schema:point_inside_interval | PASS | latent point inside interval |
| schema:interval_clamped | PASS | latent interval [0,1] |
| policy:frozen | PASS | EQUAL_AVAILABLE_CONSTRUCT_FAMILIES |
| policy:scale | PASS | PROVISIONAL_PENDING_SP071_SP072 |
| policy:population_guard | PASS | {"denominator":100,"identity_source":"outputs/derived/sp100_owner_approved_production_wiring_20260816.json","ordering_source":"SP100 queue row order, with stable_player_key as deterministic tie-break","display_scope":"PROVISIONAL_CURRENT100_COHORT_RELATIVE_DIAGNOSTIC","display_scope_guard":"The current100 denominator is not a full baseball-population calibration and is not an engine-final scale."} |
| manifest:policy_hash | PASS | f901959fee00c74c0c46d9f3be04a2ff79fcbd30bbb42b5b9efe58fa697fc4e3 |
| manifest:owner_zero | PASS | {"owner_verdict_count":0,"owner_records_count":0,"owner_ledger_sha256":"f3fc60b93f2d258ce58e1b343a0259cce9ad294ce8731404e4acf937681f23d0","owner_input_used_in_synthesis":false,"owner_verdicts_written":false} |
| owner:ledger_zero | PASS | {"count":0} |
| owner:ledger_hash_unchanged | PASS | ledger hash matches frozen manifest |
| scope:sp079_closed | PASS | SP-079 registry close follows independent QA |
| scope:registry_locks | PASS | SP-080/SP-081/shoulder unchanged |
| guard:powerpro_teacher | PASS | PowerPro posthoc only |
| guard:show_copy | PASS | The Show direct copy false |
| guard:legacy_h2f | PASS | legacy NPB+ H2F absent |
| guard:short_distance | PASS | 30m/50m retained native |
| guard:missingness | PASS | missing is not slow |
| guard:self_teaching_season | PASS | no target leakage |
| guard:technique | PASS | technique separate |
| guard:production_transfer | PASS | no SP104 transfer promoted |
| source:synthesis_excludes_powerpro | PASS | synthesis function has no PowerPro reference |
| source:synthesis_excludes_show_numeric | PASS | synthesis function has no The Show numeric feature |
| source:equal_family_weight | PASS | no fixed peak coefficient |
| guard:proxy_not_physical_point | PASS | proxy context only |
| guard:shared_play_double_count | PASS | shared MLB play fields are context-only when overlapping |
| ablation:800_cells | PASS | {"cells":800,"components":8} |
| ablation:actual_recompute | PASS | not relabel-only |
| ablation:material_effect_exists | PASS | at least one actual component effect |
| ablation:summary_consistent | PASS | {"peak_speed":{"cell_count":100,"changed_player_count":100,"changed_fraction":1},"acceleration_h2f_t90_90ft":{"cell_count":100,"changed_player_count":68,"changed_fraction":0.68},"historical_physical":{"cell_count":100,"changed_player_count":94,"changed_fraction":0.94},"mlb_statcast_running_bridge":{"cell_count":100,"changed_player_count":17,"changed_fraction":0.17},"the_show_context":{"cell_count":100,"changed_player_count":0,"changed_fraction":0},"analog_ordinal_transition":{"cell_count":100,"changed_player_count":77,"changed_fraction":0.77},"statistical_proxies":{"cell_count":100,"changed_player_count":80,"changed_fraction":0.8},"scouting_community_video_usage_context":{"cell_count":100,"changed_player_count":0,"changed_fraction":0}} |
| diagnostic:peak_not_fixed_dominance | PASS | {"current100_peak_correlation_pearson":0.9141263638277773,"current100_peak_correlation_spearman":0.9127394363990148,"final_rank_peak_correlation_spearman":0.9127394363990148,"peak_only_player_count":52,"peak_removal_non_peak_eligible_count":48,"peak_removal_changed_player_count":100,"hard_coded_peak_weight":false,"interpretation":"Descriptive diagnostics only; no target correlation or peak-dominance objective was optimized."} |
| posthoc:attached_after_freeze | PASS | PASS_POSTHOC_ONLY |
| posthoc:diff_matches | PASS | posthoc diff is a copied QA field, not an input |
| determinism:rerun_exit_zero | PASS | {"status":0,"stderr":""} |
| determinism:byte_identical | PASS | [] |
| red_team:all_fail_before_fixtures | PASS | [{"id":"powerpro_teacher_leakage","detected":true,"pass":true,"detail":"a PowerPro feature in a teacher feature list must be detected"},{"id":"direct_show_copy","detected":true,"pass":true,"detail":"a direct The Show copy flag must be detected"},{"id":"legacy_h2f","detected":true,"pass":true,"detail":"the quarantined legacy H2F field marker must be detected"},{"id":"short_distance_to_t90","detected":true,"pass":true,"detail":"a 50m to T90 transform must be detected"},{"id":"missing_to_slow","detected":true,"pass":true,"detail":"missingness-as-slow must be detected"},{"id":"target_self_teaching_or_season_leakage","detected":true,"pass":true,"detail":"target/teacher overlap must be detected"},{"id":"technique_as_speed","detected":true,"pass":true,"detail":"technique in a pure-speed feature list must be detected"},{"id":"proxy_double_count","detected":true,"pass":true,"detail":"a repeated proxy source event must be detected"},{"id":"fake_ablation","detected":true,"pass":true,"detail":"a copied full result would be detected when the fixture component is removed"},{"id":"omitted_row","detected":true,"pass":true,"detail":"a 99-row output must be detected"},{"id":"hard_coded_peak_dominance","detected":true,"pass":true,"detail":"a fixed peak weighting policy must be detected"},{"id":"owner_write_or_shoulder","detected":true,"pass":true,"detail":"owner write or shoulder mutation must be detected"}] |

## Fail-before fixtures

Each fixture intentionally represents a prohibited construction and must be detected before it could become a production result.

| Fixture | Result | Detail |
|---|---|---|
| powerpro_teacher_leakage | PASS | a PowerPro feature in a teacher feature list must be detected |
| direct_show_copy | PASS | a direct The Show copy flag must be detected |
| legacy_h2f | PASS | the quarantined legacy H2F field marker must be detected |
| short_distance_to_t90 | PASS | a 50m to T90 transform must be detected |
| missing_to_slow | PASS | missingness-as-slow must be detected |
| target_self_teaching_or_season_leakage | PASS | target/teacher overlap must be detected |
| technique_as_speed | PASS | technique in a pure-speed feature list must be detected |
| proxy_double_count | PASS | a repeated proxy source event must be detected |
| fake_ablation | PASS | a copied full result would be detected when the fixture component is removed |
| omitted_row | PASS | a 99-row output must be detected |
| hard_coded_peak_dominance | PASS | a fixed peak weighting policy must be detected |
| owner_write_or_shoulder | PASS | owner write or shoulder mutation must be detected |

## Determinism

The generator was executed a second time in this isolated worktree. All deterministic canonical outputs had byte-identical SHA-256 hashes across runs. The QA JSON and this audit are written after that deterministic comparison.

## Interpretation and limits

The result remains `PROVISIONAL_PENDING_SP071_SP072`. Current100 percentile display is cohort-relative and provisional, not a full-population or engine-final calibration. Current NPB+ H2F remains unavailable; H2F, 90ft, 30m/50m, technique, proxies, The Show, analogs, and PowerPro are not interchangeable. PowerPro differences are attached only as posthoc QA fields after core values were frozen.

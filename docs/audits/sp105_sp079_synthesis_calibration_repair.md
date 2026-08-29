# SP-105 SP-079 synthesis/calibration repair — independent audit

Date: 2026-08-29
Process: separate deterministic red-team QA after the SP-105 synthesis generator
Result: **PASS_INDEPENDENT_RED_TEAM**

## Scope

The audit covers the frozen be3588 SP-079 baseline reproduction, physical-only calibration benchmark, exact 100-player rematerialization, native reference-population receipts, eight-component 800-cell actual ablation, context decision-use removal tests, PowerPro posthoc boundary, and registry/owner locks. It stops at SP-105 and does not enter owner verdicts, SP-080/SP-081, or shoulder work.

## Independent checks

84 checks passed; 0 checks failed.

| Check | Result | Detail |
|---|---|---|
| determinism:canonical_seed_exit_zero | PASS | {"status":0,"stderr":""} |
| required:outputs/derived/sp105_cross_family_calibration_receipts.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_frozen_input_manifest.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_selected_synthesis_policy.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_synthesis_policy_benchmark.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_context_decision_use_100.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_final_practical_speed_100.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_final_practical_speed_100.csv | PASS | exists and non-empty |
| required:outputs/derived/sp105_final_value_component_ablation.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_powerpro_posthoc_qa.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_global_consistency_qa.json | PASS | exists and non-empty |
| required:outputs/derived/sp105_player_evidence_synthesis.jsonl | PASS | exists and non-empty |
| required:docs/reports/sp105_final_practical_speed_100.md | PASS | exists and non-empty |
| required:scripts/sp105_synthesis_calibration_repair.mjs | PASS | exists and non-empty |
| required:outputs/derived/sp079_appraisal_policy.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_frozen_input_manifest.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_player_evidence_synthesis.jsonl | PASS | exists and non-empty |
| required:outputs/derived/sp079_final_practical_speed_100.csv | PASS | exists and non-empty |
| required:outputs/derived/sp079_final_practical_speed_100.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_final_value_component_ablation.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_powerpro_posthoc_qa.json | PASS | exists and non-empty |
| required:outputs/derived/sp079_global_consistency_qa.json | PASS | exists and non-empty |
| required:outputs/derived/qa_sp079_final_practical_reappraisal.json | PASS | exists and non-empty |
| required:docs/reports/sp079_final_practical_speed_100.md | PASS | exists and non-empty |
| required:docs/audits/sp079_final_practical_reappraisal_independent_audit.md | PASS | exists and non-empty |
| required:docs/state/speed_task_registry.tsv | PASS | exists and non-empty |
| required:outputs/derived/sp078_owner_verdict_ledger_20260816.json | PASS | exists and non-empty |
| population:exact_100_unique | PASS | {"count":100} |
| population:queue_order_1_to_100 | PASS | JSON queue order |
| population:rank_is_bounded_and_eligible | PASS | all final rows have bounded rank; ties are permitted |
| population:synthesis_jsonl_100 | PASS | {"count":100} |
| population:csv_100 | PASS | {"count":100} |
| population:cross_format_order | PASS | JSON/CSV/JSONL key order agrees |
| schema:required_fields | PASS | point/interval/display/provenance/context fields present |
| schema:point_semantics_allowed | PASS | ["DEFENSIBLE_POINT_ESTIMATE","DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE","NO_DEFENSIBLE_POINT"] |
| schema:point_semantics_consistent | PASS | semantic labels agree with point fields |
| schema:rating_is_declared_display_mapping | PASS | rating maps from point only |
| schema:point_inside_interval | PASS | point inside bounded interval |
| schema:interval_bounded | PASS | latent interval [0,1] |
| schema:provisional_scale_status | PASS | PROVISIONAL_PENDING_SP071_SP072 |
| schema:provenance_receipts | PASS | every physical record has source/provenance/reference population |
| comparison:pre_sp105_and_pre_sp079_fields | PASS | frozen SP-079 and pre-SP-079 project comparison fields are separate |
| policy:selected_conservative_anchor | PASS | CONSERVATIVE_TIER_A_ANCHOR_LOWER_TIER_BOUNDED_CONSTRAINT |
| policy:physical_only_no_owner_or_powerpro | PASS | selection is physical-only |
| policy:hash_receipts_match | PASS | selected policy hash is stable in all receipts |
| policy:manifest_hash_receipts_match | PASS | input manifest hash is stable in all receipts |
| policy:lower_tier_point_weight_zero | PASS | no Tier-B equal override |
| policy:point_reference_population_is_anchor_only | PASS | no uncalibrated reference-population mixing in point |
| guard:all_final_rows_false | PASS | row and aggregate guards |
| guard:source_forbids_legacy_npBplus_h2f | PASS | old local NPB+ hp_to_1b_sec is absent |
| guard:official_shared_season_not_additive | PASS | same-player same-season H2F/90ft fields are not additive |
| guard:synthesis_function_no_powerpro | PASS | PowerPro absent from physical synthesis function |
| guard:synthesis_function_no_show_numeric | PASS | The Show numeric appraisal absent from physical synthesis function |
| guard:powerpro_loaded_after_core_freeze | PASS | baseline/PowerPro comparison is read after core hash |
| calibration:actual_loo_receipts | PASS | {"receipt_count":12} |
| calibration:common_support_no_extrapolated_prediction | PASS | unsupported holdouts have no calibrated prediction |
| calibration:not_promoted | PASS | no cross-family mapping promoted across required families |
| benchmark:all_candidates_and_physical_target | PASS | A/B/C/D benchmark contract |
| benchmark:baseline_control_and_selected_D | PASS | equal-family/B/C are diagnostics; D is conservative selection |
| benchmark:C_prediction_only_inside_support | PASS | C has no out-of-support calibrated point |
| ablation:actual_800_cells | PASS | {"cells":800} |
| ablation:actual_full_recompute | PASS | not relabel-only |
| ablation:separate_effect_counts | PASS | point/display/rank/interval/confidence/conflict/evidence counts are separate |
| ablation:summary_matches_cells | PASS | summary counts/effect magnitudes match actual cells |
| ablation:interval_only_not_point | PASS | interval-only changes are not point changes |
| ablation:zero_effect_is_not_material | PASS | present zero-effect cells are explicit |
| diagnostic:top_speed_and_leave_peak_out_descriptive_only | PASS | {"schema_version":"sp105_top_speed_descriptive_diagnostics_v1","top_speed_reference_population":"SP100_CURRENT100_NPB_PLUS_2026","peak_vs_native_family":[{"family":"ACCELERATION_H2F","paired_player_count":22,"pearson_correlation":-0.010353,"rank_correlation":-0.00511,"reference_population_note":"family-native percentiles are not assumed commensurate; descriptive correlation only","selection_use":false,"production_use":false},{"family":"END_TO_END_90FT","paired_player_count":6,"pearson_correlation":0.198131,"rank_correlation":0.257143,"reference_population_note":"family-native percentiles are not assumed commensurate; descriptive correlation only","selection_use":false,"production_use":false},{"family":"SHORT_DISTANCE","paired_player_count":36,"pearson_correlation":0.562616,"rank_correlation":0.555061,"reference_population_note":"family-native percentiles are not assumed commensurate; descriptive correlation only","selection_use":false,"production_use":false}],"leave_peak_out":{"method":"ACTUAL_FULL_SYNTHESIS_RERUN_WITH_CURRENT_TIER_A_PEAK_REMOVED","selection_use":false,"production_use":false,"cell_count":100,"point_semantics_distribution":{"DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE":48,"NO_DEFENSIBLE_POINT":52},"point_defined_after_removal_count":48,"display_only_after_removal_count":48,"no_defensible_point_after_removal_count":52,"rank_eligible_after_removal_count":0,"point_invalidation_count":52,"rank_eligibility_invalidation_count":100,"note":"This is a descriptive stress test of Tier-A dependence, not a claim that lower-family fallback points are calibrated."},"calibration_receipt_count":4,"hard_coded_peak_weight":false,"descriptive_only":true,"generated_at":"2026-08-29"} |
| context:four_lanes_and_removal_cells | PASS | {"rows":100} |
| context:zero_effect_not_material | PASS | loaded zero-effect lanes are not claimed material |
| context:no_numeric_copy_or_point_transfer | PASS | context lanes remain non-point numeric inputs |
| context:aggregate_matches_rows | PASS | {"the_show_context":{"NOT_APPLICABLE":96,"PRESENT_NO_DECISION_EFFECT":4},"analog_ordinal_transition":{"INTERVAL_CHANGED":96,"NOT_APPLICABLE":4},"statistical_proxies":{"INTERVAL_CHANGED":98,"NOT_APPLICABLE":2},"scouting_community_video_usage_context":{"INTERVAL_CHANGED":18,"NOT_APPLICABLE":82}} |
| posthoc:only_after_core_freeze | PASS | PASS_POSTHOC_ONLY |
| posthoc:diff_receipts_match | PASS | posthoc difference is not an input |
| baseline:be3588_exact_reproduction | PASS | {"schema_version":"sp105_sp079_baseline_reproduction_v1","reference_commit":"be3588b26e3ce0818880f80c4a0350764886bb6f","frozen_manifest_used":true,"frozen_equal_family_policy_preserved_as_control_only":true,"isolated_reproduction_execution":{"fresh_isolated_clone":true,"original_generator":"scripts/sp079_final_practical_reappraisal_20260825.mjs","independent_qa":"scripts/qa_sp079_final_practical_reappraisal_20260825.mjs","output":"100 rows / 800 cells / owner verdict count 0","rerun_status":"BYTE_IDENTICAL"},"artifacts":{"policy":{"path":"outputs/derived/sp079_appraisal_policy.json","expected_sha256":"f901959fee00c74c0c46d9f3be04a2ff79fcbd30bbb42b5b9efe58fa697fc4e3","observed_sha256":"f901959fee00c74c0c46d9f3be04a2ff79fcbd30bbb42b5b9efe58fa697fc4e3","byte_identical":true},"sp079FrozenManifest":{"path":"outputs/derived/sp079_frozen_input_manifest.json","expected_sha256":"fbb5632da62f7483f6116f736b18875569a8641a3d628a7295848de3b0f19ff1","observed_sha256":"fbb5632da62f7483f6116f736b18875569a8641a3d628a7295848de3b0f19ff1","byte_identical":true},"sp079FrozenSynthesis":{"path":"outputs/derived/sp079_player_evidence_synthesis.jsonl","expected_sha256":"e79dcb1efdb8d6e7bb866ad906f2351aaba65e07e9c513a757e52c325448de3a","observed_sha256":"e79dcb1efdb8d6e7bb866ad906f2351aaba65e07e9c513a757e52c325448de3a","byte_identical":true},"sp079FrozenCsv":{"path":"outputs/derived/sp079_final_practical_speed_100.csv","expected_sha256":"a4106442a1bae58fcc0004c8fd87f0feb454c00d928a4551976efa5c9cc6a7fa","observed_sha256":"a4106442a1bae58fcc0004c8fd87f0feb454c00d928a4551976efa5c9cc6a7fa","byte_identical":true},"sp079FrozenJson":{"path":"outputs/derived/sp079_final_practical_speed_100.json","expected_sha256":"d067c436478ff74cd1b883b78e89b995411b4fddaff86401ec006e91c8eb61d0","observed_sha256":"d067c436478ff74cd1b883b78e89b995411b4fddaff86401ec006e91c8eb61d0","byte_identical":true},"sp079FrozenAblation":{"path":"outputs/derived/sp079_final_value_component_ablation.json","expected_sha256":"23321cea90549686dc55edb4ff02d89b88b91ed6555256096df88f7fd98d979e","observed_sha256":"23321cea90549686dc55edb4ff02d89b88b91ed6555256096df88f7fd98d979e","byte_identical":true},"sp079FrozenPowerpro":{"path":"outputs/derived/sp079_powerpro_posthoc_qa.json","expected_sha256":"7fbd94e17e5d67623ff9e732c3d21b5e5b1a062b80a827e8f4b39ee87146c46a","observed_sha256":"7fbd94e17e5d67623ff9e732c3d21b5e5b1a062b80a827e8f4b39ee87146c46a","byte_identical":true},"sp079FrozenGlobalQa":{"path":"outputs/derived/sp079_global_consistency_qa.json","expected_sha256":"0307088230e7b3574b26b5f60410d5825a13a6604b588ad0de52f3acae44fce4","observed_sha256":"0307088230e7b3574b26b5f60410d5825a13a6604b588ad0de52f3acae44fce4","byte_identical":true},"sp079FrozenQa":{"path":"outputs/derived/qa_sp079_final_practical_reappraisal.json","expected_sha256":"fed02eb76521a27324fdceba4ce398d3e02cc9006723b9300ee13a9ed59cb2bd","observed_sha256":"fed02eb76521a27324fdceba4ce398d3e02cc9006723b9300ee13a9ed59cb2bd","byte_identical":true},"sp079FrozenReport":{"path":"docs/reports/sp079_final_practical_speed_100.md","expected_sha256":"98d4406bfdefd3e89013268e8a8d5c2ffa68245de239e79076ed9028acbcecc4","observed_sha256":"98d4406bfdefd3e89013268e8a8d5c2ffa68245de239e79076ed9028acbcecc4","byte_identical":true},"sp079FrozenAudit":{"path":"docs/audits/sp079_final_practical_reappraisal_independent_audit.md","expected_sha256":"ec8fb82960cdb1e284464456834b7c9b4fc25d6465afe70ad284166a8a1956c9","observed_sha256":"ec8fb82960cdb1e284464456834b7c9b4fc25d6465afe70ad284166a8a1956c9","byte_identical":true}},"exact_byte_identical":true,"example_regression":{"player":"中川 圭太","current_npb_plus_peak_percentile":0.7576,"historical_bounded_h2f_percentile":0.126761,"frozen_equal_family_point":0.442181,"frozen_equal_family_rating":44,"retained_as_regression_case":true},"generated_at":"2026-08-29"} |
| baseline:frozen_equal_family_control_retained | PASS | baseline control only |
| baseline:core_hash_present | PASS | {"core_values_built_before_baseline_powerpro_read":true,"posthoc_fields_are_separate":true,"core_values_sha256":"f1484b22eafd51d8e368c505138fdfbd4325cd317c2eb60483f1a22bd678ec4b"} |
| scope:owner_zero | PASS | {"owner_verdict_count":0} |
| scope:registry_locks | PASS | SP-079/SP-105 remain browser-gated; downstream untouched |
| scope:upstream_validated_states_unchanged | PASS | SP-101..104 statuses unchanged |
| scope:no_downstream_output_paths | PASS | SP-080/SP-081/shoulder outputs absent from SP-105 artifact set |
| global:internal_qa_passed_pre_independent | PASS | PASS_PRE_INDEPENDENT_QA |
| determinism:generator_exit_zero | PASS | {"status":0,"stderr":""} |
| determinism:all_canonical_outputs_byte_identical | PASS | [] |
| red_team:all_13_fail_before_fixtures_detected | PASS | [{"id":"tier_b_equal_override","detected":true,"pass":true,"detail":"a lower-tier equal point vote without validation must be rejected"},{"id":"uncalibrated_reference_population_mix","detected":true,"pass":true,"detail":"unmapped native percentiles must not be averaged as one scale"},{"id":"powerpro_teacher","detected":true,"pass":true,"detail":"PowerPro teacher/selection use must be rejected"},{"id":"target_self_teaching","detected":true,"pass":true,"detail":"target player must be excluded from calibration training"},{"id":"same_player_season_leakage","detected":true,"pass":true,"detail":"same-player held-out season leakage must be detected"},{"id":"the_show_direct_copy","detected":true,"pass":true,"detail":"The Show appraisal must not be copied into physical point"},{"id":"loaded_zero_effect_marked_material","detected":true,"pass":true,"detail":"a loaded zero-effect lane cannot be called material"},{"id":"interval_only_counted_as_point","detected":true,"pass":true,"detail":"interval-only changes must not be counted as point changes"},{"id":"unresolved_row_defensible_point","detected":true,"pass":true,"detail":"unresolved rows must not retain ordinary defensible-point semantics"},{"id":"legacy_npb_plus_h2f","detected":true,"pass":true,"detail":"legacy NPB+ H2F field must remain quarantined"},{"id":"short_distance_to_t90","detected":true,"pass":true,"detail":"30m/50m must not be converted to T90"},{"id":"missing_to_zero_or_slow","detected":true,"pass":true,"detail":"missingness must not become zero/slow evidence"},{"id":"owner_sp080_sp081_shoulder_scope","detected":true,"pass":true,"detail":"owner write and downstream SP-080/SP-081/shoulder work must be detected"}] |

## Fail-before fixtures

All 13 prohibited-construction fixtures were intentionally made invalid and detected before they could be accepted as production evidence.

| Fixture | Result | Detail |
|---|---|---|
| tier_b_equal_override | PASS | a lower-tier equal point vote without validation must be rejected |
| uncalibrated_reference_population_mix | PASS | unmapped native percentiles must not be averaged as one scale |
| powerpro_teacher | PASS | PowerPro teacher/selection use must be rejected |
| target_self_teaching | PASS | target player must be excluded from calibration training |
| same_player_season_leakage | PASS | same-player held-out season leakage must be detected |
| the_show_direct_copy | PASS | The Show appraisal must not be copied into physical point |
| loaded_zero_effect_marked_material | PASS | a loaded zero-effect lane cannot be called material |
| interval_only_counted_as_point | PASS | interval-only changes must not be counted as point changes |
| unresolved_row_defensible_point | PASS | unresolved rows must not retain ordinary defensible-point semantics |
| legacy_npb_plus_h2f | PASS | legacy NPB+ H2F field must remain quarantined |
| short_distance_to_t90 | PASS | 30m/50m must not be converted to T90 |
| missing_to_zero_or_slow | PASS | missingness must not become zero/slow evidence |
| owner_sp080_sp081_shoulder_scope | PASS | owner write and downstream SP-080/SP-081/shoulder work must be detected |

## Output summary

- final rows: 100; point semantics: {"DEFENSIBLE_POINT_ESTIMATE":100}
- benchmark cases: 112; selected policy: CONSERVATIVE_TIER_A_ANCHOR_LOWER_TIER_BOUNDED_CONSTRAINT
- actual ablation cells: 800
- context decision-use aggregate: {"the_show_context":{"NOT_APPLICABLE":96,"PRESENT_NO_DECISION_EFFECT":4},"analog_ordinal_transition":{"INTERVAL_CHANGED":96,"NOT_APPLICABLE":4},"statistical_proxies":{"INTERVAL_CHANGED":98,"NOT_APPLICABLE":2},"scouting_community_video_usage_context":{"INTERVAL_CHANGED":18,"NOT_APPLICABLE":82}}
- scale status: PROVISIONAL_PENDING_SP071_SP072

## Interpretation and limits

The selected policy is a conservative Tier-A current NPB+ peak anchor with lower-tier native-scale bounded constraints and zero lower-tier point weight. Cross-family mappings are diagnostic unless player-clustered leave-player-out common-support gates pass; no mapping was promoted across all required families. The output is cohort-relative and provisional pending SP-071/SP-072. PowerPro is posthoc QA only, and the browser must independently reaccept SP-079 before any downstream speed task proceeds.

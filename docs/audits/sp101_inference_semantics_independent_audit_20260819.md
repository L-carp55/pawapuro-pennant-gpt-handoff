# SP-101 inference semantics independent audit — 2026-08-19

Status: **PASS_INFERENCE_SEMANTICS_INDEPENDENT_AUDIT**

This audit independently checks the repaired artifacts rather than trusting the prior PASS receipts.

## Fail-before discrimination

- `mb01_shared_nearest_candidate_under_three_labels`: DETECTED
- `mb02_row_order_overwrite`: DETECTED
- `mb07_arbitrary_partner_selection`: DETECTED
- `mb16_boolean_set_inversion`: DETECTED
- `mb18_receipt_not_recompute`: DETECTED

## Semantic checks

- PASS — `legacy_fail_before_canaries_detect_all_five_rejected_semantics`
- PASS — `all_required_semantic_outputs_exist`
- PASS — `mb01_honest_l2_baseline_named`
- PASS — `mb01_genuine_mutual_knn_declares_k`
- PASS — `mb01_mahalanobis_covariance_aware`
- PASS — `mb01_ot_real_coupling_or_measured_negative`
- PASS — `mb01_four_methods_x_current100`
- PASS — `mb01_method_specific_diagnostics_present`
- PASS — `mb02_target_policy_explicit_season_median`
- PASS — `mb02_no_silent_cross_time_training_fallback`
- PASS — `mb02_clustered_holdout_executed_predictions_and_errors`
- PASS — `mb02_clustered_holdout_zero_player_leakage`
- PASS — `mb02_forward_holdout_executed_or_measured_insufficient`
- PASS — `mb02_edition_update_effect_measured_or_negative`
- PASS — `mb02_feature_ablation_uses_heldout_metrics`
- PASS — `mb07_typed_graph_schema`
- PASS — `mb07_no_similarity_signed_direction`
- PASS — `mb07_transition_annotations_not_pairwise`
- PASS — `mb07_negative_guards_all_true`
- PASS — `mb07_old_arbitrary_next_pattern_absent`
- PASS — `semantic_synthetic_canaries_all_pass`
- PASS — `current100_exact_100`
- PASS — `mb16_explicit_lane_inventory_and_unsigned_analog`
- PASS — `mb16_consensus_states_from_comparable_lanes`
- PASS — `mb18_exact_100x18_cells`
- PASS — `mb18_full_and_ablated_state_recomputed`
- PASS — `mb18_present_evidence_can_have_zero_effect`
- PASS — `mb18_required_influence_vocabulary`
- PASS — `sp102_target_freeze_exact_100_one_state_each`
- PASS — `sp102_target_freeze_hash_bound_to_repaired_upstreams`
- PASS — `sp102_search_not_run_during_sp101`
- PASS — `prior_identity_repair_still_passes`
- PASS — `prior_identity_canaries_still_resolved`
- PASS — `mlb_appearance_axis_separate_from_show_year`
- PASS — `non_live_contamination_zero_in_primary_target`
- PASS — `powerpro_label_absent_from_physical_path`
- PASS — `sp078_owner_ledger_still_empty`
- PASS — `owner_review_lock_still_true`
- PASS — `sp079_remains_blocked`
- PASS — `shoulder_remains_blocked`
- PASS — `deterministic_rerun_byte_identical`

## Governance

- SP-078 owner verdict count: **0**
- owner-review lock: **True**
- SP-079: **BLOCKED_DEPENDENCY**
- shoulder handoff SP-082: **BLOCKED_DEPENDENCY**

No owner verdict, SP-079 rating, or shoulder work is authorized by this audit.

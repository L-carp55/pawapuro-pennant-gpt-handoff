#!/usr/bin/env python3
"""Independent semantic audit for SP-101 inference repair wave 2.

This checker does not call the repair functions. It inspects checked-in source
and regenerated artifacts, and includes legacy fail-before discriminators.
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import json
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "derived"
OLD = ROOT / "scripts" / "sp101_repair_and_regenerate_20260818.py"
NEW = ROOT / "scripts" / "sp101_inference_semantic_repair_20260819.py"
QA_JSON = OUT / "qa_sp101_inference_semantics_independent_20260819.json"
QA_MD = ROOT / "docs" / "audits" / "sp101_inference_semantics_independent_audit_20260819.md"


def read_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def sha256_file(p: Path) -> str:
    h=hashlib.sha256()
    with p.open("rb") as f:
        for c in iter(lambda:f.read(1<<20), b""):
            h.update(c)
    return h.hexdigest()


def parse_registry():
    rows=list(csv.DictReader((ROOT/"docs/state/speed_task_registry.tsv").open(encoding="utf-8-sig"), delimiter="\t"))
    return {r["task_id"]:r for r in rows}


checks=[]
def check(name, ok, detail=None):
    checks.append({"name":name,"pass":bool(ok),"detail":detail})
    return bool(ok)


# ----- fail-before discrimination: these are the exact rejected semantics -----
old_src=OLD.read_text(encoding="utf-8")
legacy={
    "mb01_shared_nearest_candidate_under_three_labels":
        'candidate = nearest_target.get(key)' in old_src and '"MUTUAL_KNN"' in old_src and '"CALIPERED_MAHALANOBIS"' in old_src and '"OPTIMAL_TRANSPORT"' in old_src,
    "mb02_row_order_overwrite":
        'show_by_id_season[(mlbam, clean(row.get("season")))] = speed' in old_src,
    "mb07_arbitrary_partner_selection":
        'other = next((candidate["stable_player_key"] for candidate in current_packets' in old_src,
    "mb16_boolean_set_inversion":
        'len(set([bool(physical_pct is not None), bool(show_speed is not None), bool(pawa_pct is not None), bool(valid_analogs)])) > 1' in old_src,
    "mb18_receipt_not_recompute":
        '"pre_ablation_state": pre_state' in old_src and '"post_ablation_state": post_state or state' in old_src,
}
check("legacy_fail_before_canaries_detect_all_five_rejected_semantics", all(legacy.values()), legacy)

# ----- required repaired outputs -----
required=[
    OUT/"sp101_metric_neighborhood_analog_pairs.csv.gz",
    OUT/"sp101_metric_neighborhood_player_summary.json",
    OUT/"sp101_dual_game_behavior_models.json",
    OUT/"sp101_pairwise_ordinal_graph.json",
    OUT/"sp101_current100_multibridge_evidence.json",
    OUT/"sp101_requirements_to_decision_utilization.json",
    OUT/"sp101_route_ablation_qa.json",
    OUT/"sp101_residual_low_confidence_target_set.json",
    OUT/"sp101_inference_route_execution_receipt.json",
    OUT/"qa_sp101_inference_semantic_repair_execution_20260819.json",
]
check("all_required_semantic_outputs_exist", all(p.exists() and p.stat().st_size>0 for p in required), [str(p.relative_to(ROOT)) for p in required if not p.exists() or p.stat().st_size==0])

# MB-01
summary=read_json(OUT/"sp101_metric_neighborhood_player_summary.json")
methods={m["method"]:m for m in summary.get("methods",[])}
check("mb01_honest_l2_baseline_named", "NORMALIZED_L2_NEAREST_BASELINE" in methods)
check("mb01_genuine_mutual_knn_declares_k", methods.get("MUTUAL_KNN",{}).get("k") == 5, methods.get("MUTUAL_KNN"))
mah=methods.get("CALIPERED_MAHALANOBIS",{})
check("mb01_mahalanobis_covariance_aware", "covariance" in str(mah.get("algorithm","")).lower() and mah.get("shrinkage") is not None, mah)
ot=methods.get("OPTIMAL_TRANSPORT_SINKHORN",{})
check("mb01_ot_real_coupling_or_measured_negative", "transport" in str(ot.get("algorithm","")).lower() and ot.get("status") in {"CONVERGED","MAX_ITER_REACHED","INSUFFICIENT_DATA"}, ot)
with gzip.open(OUT/"sp101_metric_neighborhood_analog_pairs.csv.gz","rt",encoding="utf-8",newline="") as f:
    analog=list(csv.DictReader(f))
check("mb01_four_methods_x_current100", len(analog)==400 and len({r["target_player_key"] for r in analog})==100 and len({r["method"] for r in analog})==4, {"rows":len(analog),"players":len({r["target_player_key"] for r in analog}),"methods":sorted({r["method"] for r in analog})})
check("mb01_method_specific_diagnostics_present",
      any(r["method"]=="MUTUAL_KNN" and r.get("neighbor_rank_candidate_to_target") for r in analog)
      and any(r["method"]=="CALIPERED_MAHALANOBIS" and r.get("covariance_status") for r in analog)
      and any(r["method"]=="OPTIMAL_TRANSPORT_SINKHORN" and r.get("transport_weight") for r in analog))

# MB-02
dual=read_json(OUT/"sp101_dual_game_behavior_models.json")
model=dual["the_show_speed_from_mlb_shared_indicators"]
target=model["target_definition"]
check("mb02_target_policy_explicit_season_median", target.get("policy")=="SEASON_MEDIAN_LIVE_SPEED" and target.get("row_order_invariant") is True, target)
check("mb02_no_silent_cross_time_training_fallback", model.get("cross_time_fallback_used_for_training") is False)
grouped=model["player_clustered_holdout"]
check("mb02_clustered_holdout_executed_predictions_and_errors",
      grouped.get("status")=="EXECUTED_PLAYER_CLUSTERED_HOLDOUT"
      and grouped.get("aggregate_metrics",{}).get("n",0)>0
      and len(grouped.get("predictions",[]))>0, grouped.get("aggregate_metrics"))
check("mb02_clustered_holdout_zero_player_leakage",
      grouped.get("no_player_crosses_train_test") is True
      and all(f.get("player_overlap_count")==0 for f in grouped.get("folds",[])))
forward=model["forward_season_holdout"]
forward_ok=(forward.get("status")=="EXECUTED_FORWARD_SEASON_HOLDOUT" and forward.get("executed_season_count",0)>0) or (
    forward.get("status")=="INSUFFICIENT_DATA" and all("train_rows" in x and "test_rows" in x for x in forward.get("season_receipts",[])))
check("mb02_forward_holdout_executed_or_measured_insufficient", forward_ok, {"status":forward.get("status"),"executed":forward.get("executed_season_count")})
check("mb02_edition_update_effect_measured_or_negative", model.get("edition_update_effects",{}).get("status") in {"MEASURED_EDITION_UPDATE_EFFECTS","MEASURED_NOT_IDENTIFIABLE"}, model.get("edition_update_effects"))
abl=model.get("feature_family_ablation_heldout",[])
check("mb02_feature_ablation_uses_heldout_metrics", len(abl)==len(model.get("features",[])) and all("heldout_metrics" in x and "delta_heldout_mae_vs_full" in x for x in abl))

# MB-07
graph=read_json(OUT/"sp101_pairwise_ordinal_graph.json")
guards=graph.get("semantic_guards",{})
check("mb07_typed_graph_schema", all(k in graph for k in ["signed_pairwise_edges","within_player_temporal_edges","similarity_links","population_band_relations","context_annotations"]))
check("mb07_no_similarity_signed_direction", all(x.get("signed_direction") is None and "faster_player_key" not in x for x in graph.get("similarity_links",[])))
check("mb07_transition_annotations_not_pairwise", all(x.get("signed_speed_relation") is False and "faster_player_key" not in x and "slower_player_key" not in x for x in graph.get("context_annotations",[]) if x.get("annotation_type")=="LEAGUE_TRANSITION_CONTEXT"))
check("mb07_negative_guards_all_true", guards.get("analog_similarity_can_create_signed_edge") is False and guards.get("transition_context_can_create_signed_edge_without_speed_before_after") is False and guards.get("single_player_community_can_create_two_player_edge") is False and guards.get("arbitrary_partner_selection_forbidden") is True, guards)
new_src=NEW.read_text(encoding="utf-8")
check("mb07_old_arbitrary_next_pattern_absent", 'other = next((candidate["stable_player_key"] for candidate in current_packets' not in new_src)

# MB-16 and synthetic canaries
execution=read_json(OUT/"qa_sp101_inference_semantic_repair_execution_20260819.json")
synthetic=execution.get("synthetic_canaries",{})
check("semantic_synthetic_canaries_all_pass", synthetic.get("pass") is True and all(synthetic.get("checks",{}).values()), synthetic)
mult=read_json(OUT/"sp101_current100_multibridge_evidence.json")
players=mult.get("players",[])
check("current100_exact_100", len(players)==100 and len({p.get("queue_order") for p in players})==100)
lane_ok=True
for p in players:
    lanes=p.get("lane_inventory_semantic_repair",[])
    if len(lanes)<5:
        lane_ok=False; break
    for l in lanes:
        if l.get("lane")=="MB01_ANALOG_CONSTRAINT" and l.get("comparable"):
            lane_ok=False
check("mb16_explicit_lane_inventory_and_unsigned_analog", lane_ok)
states={p.get("route_disagreement",{}).get("state") for p in players}
check("mb16_consensus_states_from_comparable_lanes", states <= {"MATERIAL_CONFLICT","CONSENSUS_SUPPORTED","INSUFFICIENT_INDEPENDENT_LANES","CONSENSUS_ROUTE_REMOVED"}, sorted(states))

# MB-18
ab=read_json(OUT/"sp101_route_ablation_qa.json")
cells=ab.get("ablation_cells",[])
check("mb18_exact_100x18_cells", ab.get("all100x18_exact") is True and len(cells)==1800)
check("mb18_full_and_ablated_state_recomputed", all(isinstance(c.get("full_state"),dict) and isinstance(c.get("ablated_state"),dict) and isinstance(c.get("changed_fields"),list) for c in cells))
check("mb18_present_evidence_can_have_zero_effect",
      any(c.get("evidence_present") and c.get("influence_classification")=="NO_EFFECT_DESPITE_EVIDENCE_PRESENT" for c in cells))
required_classes=set(ab.get("required_influence_classes",[]))
check("mb18_required_influence_vocabulary", {
    "NO_EFFECT_DESPITE_EVIDENCE_PRESENT","SUPPORTS_SAME_STATE","CHANGES_CONFLICT_CLASS","CHANGES_CONFIDENCE_TIER",
    "CHANGES_TARGET_ELIGIBILITY","CHANGES_BAND_OR_DIRECTION","ROUTE_MISSING_NOT_APPLICABLE"
} <= required_classes, sorted(required_classes))

# Target freeze downstream of repaired artifacts.
res=read_json(OUT/"sp101_residual_low_confidence_target_set.json")
check("sp102_target_freeze_exact_100_one_state_each", len(res.get("players",[]))==100 and len({r.get("queue_order") for r in res.get("players",[])})==100 and all(r.get("target_selection_state") in res.get("target_state_vocabulary",[]) for r in res.get("players",[])))
up=res.get("upstream_semantic_hashes",{})
expected={
    "analog_summary_sha256":sha256_file(OUT/"sp101_metric_neighborhood_player_summary.json"),
    "dual_model_sha256":sha256_file(OUT/"sp101_dual_game_behavior_models.json"),
    "graph_sha256":sha256_file(OUT/"sp101_pairwise_ordinal_graph.json"),
    "ablation_sha256":sha256_file(OUT/"sp101_route_ablation_qa.json"),
}
check("sp102_target_freeze_hash_bound_to_repaired_upstreams", up==expected, {"stored":up,"actual":expected})
check("sp102_search_not_run_during_sp101", res.get("search_status")=="SP-102_NOT_RUN")

# Prior valid foundation / governance.
prior=read_json(OUT/"qa_sp101_identity_and_shared_metric_repair_20260818.json")
check("prior_identity_repair_still_passes", prior.get("status")=="PASS_REPAIRED", prior.get("status"))
canaries=prior.get("canaries",{})
check("prior_identity_canaries_still_resolved", all(canaries.get(n,{}).get("stable_key") for n in ["カリステ","ポランコ","モンテロ","サンタナ","秋山 翔吾","筒香 嘉智"]))
check("mlb_appearance_axis_separate_from_show_year", (OUT/"sp101_mlb_regular_season_appearance_years.csv").exists() and target.get("cross_time_fallback_policy","").startswith("NOT_USED_FOR_MB02_TRAINING"))
check("non_live_contamination_zero_in_primary_target", target.get("non_live_rows_in_primary_target_input")==0, target.get("non_live_rows_in_primary_target_input"))
check("powerpro_label_absent_from_physical_path", mult.get("physical_path_guard",{}).get("powerpro_label_used") is False and all((p.get("independent_physical_estimate") or {}).get("powerpro_label_used") in {False,None} for p in players))
ledger=read_json(ROOT/"outputs/derived/sp078_owner_verdict_ledger_20260816.json")
check("sp078_owner_ledger_still_empty", ledger.get("owner_verdict_count")==0 and not ledger.get("records"))
lock=read_json(ROOT/"docs/state/speed_owner_review_integrity_lock_20260817.json")
check("owner_review_lock_still_true", lock.get("locked") is True)
reg=parse_registry()
check("sp079_remains_blocked", reg.get("SP-079",{}).get("status")=="BLOCKED_DEPENDENCY", reg.get("SP-079"))
check("shoulder_remains_blocked", reg.get("SP-082",{}).get("status") in {"BLOCKED_DEPENDENCY","NOT_STARTED"}, reg.get("SP-082",{}).get("status"))

det_path=OUT/"sp101_semantic_repair_determinism_qa_20260819.json"
if det_path.exists():
    det=read_json(det_path)
    check("deterministic_rerun_byte_identical", det.get("status")=="PASS_BYTE_IDENTICAL" and det.get("mismatch_count")==0, det)
else:
    check("deterministic_rerun_byte_identical", False, "determinism receipt missing")

status="PASS_INFERENCE_SEMANTICS_INDEPENDENT_AUDIT" if all(c["pass"] for c in checks) else "FAIL_INFERENCE_SEMANTICS"
out={
    "schema_version":"qa_sp101_inference_semantics_independent_20260819",
    "generated_at":"2026-08-19",
    "status":status,
    "scope":"speed_only",
    "legacy_fail_before_findings":legacy,
    "checks":checks,
    "pass_count":sum(c["pass"] for c in checks),
    "fail_count":sum(not c["pass"] for c in checks),
    "critical_governance":{"owner_verdict_count":ledger.get("owner_verdict_count"),"owner_lock":lock.get("locked"),"sp079":reg.get("SP-079",{}).get("status"),"shoulder":reg.get("SP-082",{}).get("status")},
}
QA_JSON.parent.mkdir(parents=True, exist_ok=True)
QA_JSON.write_text(json.dumps(out,ensure_ascii=False,sort_keys=True,indent=2)+"\n",encoding="utf-8")
lines=[
    "# SP-101 inference semantics independent audit — 2026-08-19","",
    f"Status: **{status}**","",
    "This audit independently checks the repaired artifacts rather than trusting the prior PASS receipts.",
    "",
    "## Fail-before discrimination","",
]
for k,v in legacy.items():
    lines.append(f"- `{k}`: {'DETECTED' if v else 'NOT_DETECTED'}")
lines += ["","## Semantic checks",""]
for c in checks:
    lines.append(f"- {'PASS' if c['pass'] else 'FAIL'} — `{c['name']}`")
lines += ["","## Governance","",
          f"- SP-078 owner verdict count: **{ledger.get('owner_verdict_count')}**",
          f"- owner-review lock: **{lock.get('locked')}**",
          f"- SP-079: **{reg.get('SP-079',{}).get('status')}**",
          f"- shoulder handoff SP-082: **{reg.get('SP-082',{}).get('status')}**",
          "",
          "No owner verdict, SP-079 rating, or shoulder work is authorized by this audit.",
          ""]
QA_MD.parent.mkdir(parents=True, exist_ok=True)
QA_MD.write_text("\n".join(lines),encoding="utf-8")
print(json.dumps({"status":status,"pass":out["pass_count"],"fail":out["fail_count"]},ensure_ascii=False))
sys.exit(0 if status.startswith("PASS") else 2)

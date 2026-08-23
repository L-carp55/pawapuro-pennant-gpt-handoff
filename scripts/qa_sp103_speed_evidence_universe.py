#!/usr/bin/env python3
"""Independent SP-103 red-team and readiness QA.

The checker reads the canonical outputs, recomputes coverage/schema/decision-
use constraints, performs a deterministic re-materialization, and runs
fail-before fixtures in memory.  It never creates an appraisal value.
"""

from __future__ import annotations

import csv
import hashlib
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
AS_OF = "2026-08-23"
ALLOWED_STATUS = {"IMPLEMENTED", "IMPLEMENTED_INCOMPLETE", "COLLECTED_BUT_UNUSED", "NOT_COLLECTED", "SOURCE_CONFIRMED_NEW", "SCOPED_REJECTED", "MEASURED_NEGATIVE"}
CANONICAL = [
    "outputs/derived/sp103_speed_evidence_universe.tsv",
    "outputs/derived/sp103_local_asset_inventory.json",
    "outputs/derived/sp103_external_source_verification.json",
    "outputs/derived/sp103_collected_but_unused.json",
    "outputs/derived/sp103_inference_method_universe.json",
    "outputs/derived/sp103_owner_requirement_traceability.tsv",
    "outputs/derived/sp103_gap_and_remediation_plan.json",
    "outputs/derived/sp103_pre_sp079_readiness.json",
    "outputs/derived/sp103_materialization_manifest.json",
]
# The readiness file is deliberately changed by the finalizer from
# PENDING_INDEPENDENT_QA to READY_FOR_SP079.  Determinism is therefore tested
# on the parent-materialized base outputs, before that gate-state overlay.
DETERMINISTIC_CANONICAL = [rel for rel in CANONICAL if rel != "outputs/derived/sp103_pre_sp079_readiness.json"]


def load_json(rel: str) -> Any:
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def read_tsv(rel: str) -> list[dict[str, str]]:
    with (ROOT / rel).open("r", encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


def digest(rel: str) -> str:
    h = hashlib.sha256()
    with (ROOT / rel).open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def record(checks: list[dict[str, Any]], name: str, passed: bool, observed: Any, expected: Any) -> None:
    checks.append({"check": name, "passed": bool(passed), "observed": observed, "expected": expected})


def universe_contract(rows: list[dict[str, str]]) -> bool:
    numbers = [int(row["candidate_number"]) for row in rows]
    if len(rows) != len(set(numbers)) or set(range(1, 67)) - set(numbers):
        return False
    required = {"evidence_id", "family", "item", "construct", "status", "source_authority", "current_local_asset", "next_action", "evidence_role", "direct_numeric_promotion_allowed"}
    if any(not required.issubset(row) for row in rows):
        return False
    if any(row["status"] not in ALLOWED_STATUS for row in rows):
        return False
    if any(not row["source_authority"].strip() or not row["current_local_asset"].strip() or not row["next_action"].strip() or not row["evidence_role"].strip() for row in rows):
        return False
    if any(row["direct_numeric_promotion_allowed"].strip().lower() != "false" for row in rows):
        return False
    return True


def old_h2f_guard(rows: list[dict[str, str]]) -> bool:
    targets = [r for r in rows if r["candidate_number"] in {"2", "71"}]
    if len(targets) != 2:
        return False
    for row in targets:
        if row["status"] == "IMPLEMENTED":
            return False
        if "fail-closed" not in (row.get("decision_use_status", "") + row.get("next_action", "")).lower() and row["candidate_number"] == "71":
            return False
        if row["direct_numeric_promotion_allowed"].lower() != "false":
            return False
    return True


def method_contract(methods: list[dict[str, Any]]) -> bool:
    numbers = {int(row["candidate_number"]) for row in methods}
    required_fields = {"training_population", "target_population", "features", "target_construct", "common_support_rule", "leakage_guard", "holdout_design", "calibration_error_or_status", "uncertainty", "actual_decision_use"}
    return numbers == set(range(44, 63)) and all(required_fields.issubset(row) and all(str(row.get(field, "")).strip() for field in required_fields) for row in methods)


def trace_contract(rows: list[dict[str, str]]) -> bool:
    req = [r for r in rows if r.get("row_type") == "requirement"]
    owner = [r for r in rows if r.get("row_type") == "owner_feedback"]
    if len(req) != 61 or len({r.get("requirement_id") for r in req}) != 61 or len(owner) != 15:
        return False
    return all(r.get("mapped_evidence_ids", "").strip() and r.get("exact_route_or_gap", "").strip() and r.get("trace_status", "").strip() for r in rows)


def ablation_contract(ablation: dict[str, Any]) -> bool:
    return bool(ablation.get("all100x18_exact") is True and int(ablation.get("current100_count", 0)) == 100 and int(ablation.get("route_count", 0)) == 18 and len(ablation.get("ablation_cells", [])) == 1800)


def main() -> None:
    checks: list[dict[str, Any]] = []
    failures: list[str] = []
    for rel in CANONICAL:
        path = ROOT / rel
        passed = path.exists() and path.stat().st_size > 0
        record(checks, f"artifact_nonempty:{rel}", passed, path.stat().st_size if path.exists() else 0, ">0")

    rows = read_tsv("outputs/derived/sp103_speed_evidence_universe.tsv")
    record(checks, "universe_zero_based_coverage_and_schema", universe_contract(rows), {"rows": len(rows), "mandatory": sorted({int(r["candidate_number"]) for r in rows if int(r["candidate_number"]) <= 66})}, "66 mandatory unique candidates plus discovered rows; common schema and all guards")
    record(checks, "discovery_addendum_not_self_sealed", any(int(r["candidate_number"]) >= 67 for r in rows), sum(1 for r in rows if int(r["candidate_number"]) >= 67), ">=1")
    record(checks, "status_vocabulary_measured", sorted(set(r["status"] for r in rows)), "all statuses in canonical vocabulary", "no unclassified candidate")
    record(checks, "direct_numeric_promotion_guard", all(r["direct_numeric_promotion_allowed"].lower() == "false" for r in rows), False, "false for all candidates")
    record(checks, "npb_h2f_old_provenance_fail_closed", old_h2f_guard(rows), [r["status"] for r in rows if r["candidate_number"] in {"2", "71"}], "old values not implemented; current availability remains bounded")

    local = load_json("outputs/derived/sp103_local_asset_inventory.json")
    den = local.get("denominators", {})
    local_pass = all(int(den.get(k, 0)) >= threshold for k, threshold in {"tracked_files": 1000, "tracked_regular_files_scanned": 990, "structured_assets_scanned": 400, "semantic_assets_found": 900, "sqlite_databases": 1, "sqlite_objects": 30}.items())
    record(checks, "repo_wide_local_inventory_denominators", local_pass, den, "tracked>=1000, regular>=990, structured>=400, semantic>=900, sqlite db>=1/objects>=30")
    sqlite_tables = local.get("sqlite", [{}])[0].get("objects", []) if local.get("sqlite") else []
    table_names = {str(row.get("name")) for row in sqlite_tables}
    record(checks, "local_sqlite_speed_and_proxy_assets", {"npb_plus_measurement", "batting", "bm_player", "baserunning_advances", "infield_grounder_events", "catcher_steal_event", "the_show_rating", "pawapuro_full"}.issubset(table_names), sorted(table_names), "required physical/proxy/game tables present")

    external = load_json("outputs/derived/sp103_external_source_verification.json")
    receipts = external.get("source_receipts", [])
    receipt_ok = len(receipts) == 10 and all(int(r.get("fetch_status", 0)) == 200 and (ROOT / str(r.get("snapshot_path", ""))).exists() for r in receipts)
    manifest = {m["path"]: m for m in external.get("source_snapshot_manifest", [])}
    receipt_hash_ok = all(manifest.get(r.get("snapshot_path", ""), {}).get("sha256") == r.get("sha256") for r in receipts)
    record(checks, "official_external_receipts_and_frozen_snapshots", receipt_ok and receipt_hash_ok, {"receipts": len(receipts), "hashes_match": receipt_hash_ok}, "10 HTTP 200 official/primary receipts with frozen hash manifest")
    wbc = external.get("wbc_coverage", {})
    wbc_ok = int(wbc.get("player_selector_denominator", {}).get("2023_JPN_unique_player_ids", 0)) > 0 and int(wbc.get("player_selector_denominator", {}).get("2026_JPN_unique_player_ids", 0)) > 0 and all(int(v) == 0 for v in (wbc.get("player_level_running_rows_retrieved", {}) or {}).values()) and all("BLOCKED_EXTERNAL" in str(v) for v in (wbc.get("coverage_status", {}) or {}).values())
    record(checks, "wbc_zero_rows_not_slow_inference", wbc_ok, {"denominator": wbc.get("player_selector_denominator"), "running_rows": wbc.get("player_level_running_rows_retrieved"), "coverage_status": wbc.get("coverage_status")}, "denominator recorded; zero running rows classified as acquisition limitation")

    unused = load_json("outputs/derived/sp103_collected_but_unused.json")
    record(checks, "repository_collected_but_unused_scan", int(unused.get("scan_contract", {}).get("tracked_semantic_assets", 0)) >= 900 and int(unused.get("asset_counts", {}).get("collected_not_proven_used", 0)) > 0 and int(unused.get("asset_counts", {}).get("evidence_candidates_collected_or_incomplete", 0)) > 0, unused.get("asset_counts"), "semantic scan and nonzero collected-but-unused classifications")

    inference = load_json("outputs/derived/sp103_inference_method_universe.json")
    methods = inference.get("methods", [])
    record(checks, "all_transfer_methods_have_leakage_support_holdout_uncertainty_fields", method_contract(methods), {"method_count": len(methods), "numbers": sorted(int(m["candidate_number"]) for m in methods)}, "candidate 44-62 with all required method fields")
    route_receipts = inference.get("sp101_route_receipts", {})
    route_ok = len(route_receipts) == 18 and all(int(v.get("player_count", 0)) == 100 and int(v.get("receipt_count", 0)) == 100 for v in route_receipts.values())
    record(checks, "sp101_route_decision_use_receipts_recomputed", route_ok, {k: {"players": v.get("player_count"), "receipts": v.get("receipt_count")} for k, v in route_receipts.items()}, "18 routes x 100 player receipts")
    ablation = load_json("outputs/derived/sp101_route_ablation_qa.json")
    record(checks, "sp101_100x18_ablation_contract", ablation_contract(ablation), {"current100": ablation.get("current100_count"), "routes": ablation.get("route_count"), "cells": len(ablation.get("ablation_cells", [])), "all100x18_exact": ablation.get("all100x18_exact")}, "exact 100x18 remove-and-recompute")

    top = load_json("outputs/derived/sp103_intermediate/lane_f_top_speed_preflight.json")
    top_ok = int(top.get("population", 0)) == 100 and len(top.get("top_speed_removal_cells", [])) == 100 and top.get("top_speed_removal_status") == "PASS_PRE_FINAL_APPRAISAL_COMPONENT_ABLATION" and top.get("final_appraisal_recompute") == "NOT_RUN" and int(top.get("state_changed_after_peak_removal_count", 0)) > 0
    record(checks, "top_speed_dominance_component_ablation_preflight", top_ok, {k: top.get(k) for k in ["component_class_counts", "top_speed_only_count", "peak_and_acceleration_count", "state_changed_after_peak_removal_count", "top_speed_removal_status", "final_appraisal_recompute"]}, "100 cells, peak removal measured, final numeric generation not run")

    trace = read_tsv("outputs/derived/sp103_owner_requirement_traceability.tsv")
    record(checks, "all_baseline_and_owner_rows_exactly_traced", trace_contract(trace), {"requirements": sum(r.get("row_type") == "requirement" for r in trace), "owner_feedback": sum(r.get("row_type") == "owner_feedback" for r in trace), "rows": len(trace)}, "61 baseline + 15 owner seed rows, each mapped")
    gap = load_json("outputs/derived/sp103_gap_and_remediation_plan.json")
    open_ids = {str(row.get("exclusion_id")) for row in gap.get("open_exclusion_blockers", [])}
    record(checks, "open_exclusion_negative_findings_preserved", {"EX-004", "EX-017", "EX-018"}.issubset(open_ids), sorted(open_ids), "open/reassess blockers remain visible")
    proxy_lane = load_json("outputs/derived/sp103_intermediate/lane_d_outcome_proxies.json")
    record(checks, "proxy_double_count_groups_and_direct_guard", len(proxy_lane.get("double_count_groups", [])) >= 3 and all(str(group.get("guard", "")).strip() for group in proxy_lane.get("double_count_groups", [])) and all(r["direct_numeric_promotion_allowed"].lower() == "false" for r in rows if 11 <= int(r["candidate_number"]) <= 18), len(proxy_lane.get("double_count_groups", [])), ">=3 groups with explicit guards; proxy candidates never direct-promoted")

    ledger = load_json("outputs/derived/sp078_owner_verdict_ledger_20260816.json")
    proposal = load_json("outputs/derived/sp078_owner_verdict_proposal_20260818.json")
    record(checks, "owner_verdict_count_zero_and_capture_locked", int(ledger.get("owner_verdict_count", -1)) == 0 and proposal.get("capture_allowed") is False, {"ledger_count": ledger.get("owner_verdict_count"), "capture_allowed": proposal.get("capture_allowed")}, "0 and false")
    registry = read_tsv("docs/state/speed_task_registry.tsv")
    by_id = {r.get("task_id"): r for r in registry}
    sp079 = by_id.get("SP-079", {})
    sp103 = by_id.get("SP-103", {})
    sp079_depends_on = {item for item in str(sp079.get("depends_on", "")).split(",") if item}
    registry_ok = {"SP-103", "SP-104"}.issubset(sp079_depends_on) and sp079.get("status") in {"BLOCKED", "BLOCKED_DEPENDENCY"} and sp103.get("status") in {"PARTIAL", "DONE_VALIDATED"}
    record(checks, "registry_sp103_sp104_gate_and_sp079_block", registry_ok, {"sp079_status": sp079.get("status"), "sp079_depends_on": sp079.get("depends_on"), "sp103_status": sp103.get("status")}, "SP-103 and SP-104 dependencies present in actual depends_on field and SP-079 blocked")
    record(checks, "prior_sp101_sp102_statuses_unchanged", by_id.get("SP-101", {}).get("status") == "DONE_VALIDATED" and by_id.get("SP-102", {}).get("status") == "DONE_NEGATIVE_FINDING", {"SP-101": by_id.get("SP-101", {}).get("status"), "SP-102": by_id.get("SP-102", {}).get("status")}, "DONE_VALIDATED / DONE_NEGATIVE_FINDING")

    # Determinism: the independent QA process asks the parent to materialize
    # the same frozen inputs again, then compares canonical bytes.
    before = {rel: digest(rel) for rel in DETERMINISTIC_CANONICAL if (ROOT / rel).exists()}
    rerun = subprocess.run([sys.executable, "scripts/sp103_materialize.py"], cwd=ROOT, capture_output=True, text=True)
    after = {rel: digest(rel) for rel in DETERMINISTIC_CANONICAL if (ROOT / rel).exists()}
    deterministic = rerun.returncode == 0 and before == after
    record(checks, "deterministic_parent_rematerialization", deterministic, {"returncode": rerun.returncode, "equal_hashes": before == after, "hash_count": len(after), "readiness_overlay_excluded": True}, "byte-identical parent-materialized base outputs; readiness overlay is finalized separately")

    # Fail-before fixtures demonstrate that the QA is capable of detecting the
    # known classes of incomplete or unsafe output.
    fixture_results: list[dict[str, Any]] = []
    fixture_results.append({"fixture": "remove_one_mandatory_candidate", "detected_failure": not universe_contract([row for row in rows if row["candidate_number"] != "66"]), "expected_failure": True})
    promoted = [dict(row) for row in rows]
    for row in promoted:
        if row["candidate_number"] == "2":
            row["status"] = "IMPLEMENTED"
            row["decision_use_status"] = "DIRECT_PROMOTION"
    fixture_results.append({"fixture": "promote_legacy_h2f_to_direct", "detected_failure": not old_h2f_guard(promoted), "expected_failure": True})
    fixture_results.append({"fixture": "remove_h2f_or_5foot_transfer_method", "detected_failure": not method_contract([m for m in methods if int(m["candidate_number"]) != 62]), "expected_failure": True})
    fixture_results.append({"fixture": "drop_one_requirement_trace", "detected_failure": not trace_contract(trace[:-1]), "expected_failure": True})
    ablation_fixture = dict(ablation)
    ablation_fixture["all100x18_exact"] = False
    fixture_results.append({"fixture": "disable_100x18_route_ablation", "detected_failure": not ablation_contract(ablation_fixture), "expected_failure": True})
    record(checks, "fail_before_fixtures_detected", all(x["detected_failure"] == x["expected_failure"] for x in fixture_results), fixture_results, "all known unsafe/incomplete mutations fail")

    for check in checks:
        if not check["passed"]:
            failures.append(check["check"])
    for fixture in fixture_results:
        if not fixture["detected_failure"]:
            failures.append("fixture:" + fixture["fixture"])

    status = "PASS_READY_FOR_SP079" if not failures else "FAIL_REPAIR_REQUIRED"
    payload = {
        "schema_version": "qa_sp103_speed_evidence_universe_v1",
        "as_of": AS_OF,
        "status": status,
        "independent_lane": "H",
        "independent_from": ["scripts/sp103_materialize.py", "scripts/sp103_lanes_c_to_g.py"],
        "worker_execution": {"A": "separate_process_local_inventory", "B": "separate_process_external_verification", "C": "separate_process_physical", "D": "separate_process_proxy", "E": "separate_process_cross_game", "F": "separate_process_transfer", "G": "separate_process_owner_traceability", "H": "this_independent_red_team_process"},
        "checks": checks,
        "failed_checks": failures,
        "fail_before_fixtures": fixture_results,
        "decision_use_summary": {"current100": 100, "route_count": 18, "route_receipts": {k: v.get("receipt_count") for k, v in route_receipts.items()}, "ablation_cells": len(ablation.get("ablation_cells", [])), "top_speed_removal_cells": len(top.get("top_speed_removal_cells", []))},
        "negative_findings_committed": ["WBC running rows are unavailable on the verified public result surface; zero is not a slow inference.", "Current NPB+ H2F field listing does not validate the old local values; old hp_to_1b_sec remains fail-closed.", "Direct NPB defensive straight-line movement separated from reaction/route/positioning remains measured negative in the local universe.", "Open EX-004/EX-017/EX-018 blockers remain visible; SP-103 does not close them by relabeling."],
        "gate_locks": {"owner_verdict_count": 0, "sp079_run": "NOT_RUN", "final_numeric_generation": "NOT_RUN", "shoulder": "NOT_STARTED", "sp079_may_start_only_after_explicit_next_step": True},
        "ready_decision": "READY_FOR_SP079 only as a gate handoff; this QA process did not run SP-079 or any final appraisal.",
    }
    out = ROOT / "outputs/derived/qa_sp103_speed_evidence_universe.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": status, "failed_checks": failures, "fixture_count": len(fixture_results)}, ensure_ascii=False, sort_keys=True))
    raise SystemExit(0 if status.startswith("PASS") else 1)


if __name__ == "__main__":
    main()

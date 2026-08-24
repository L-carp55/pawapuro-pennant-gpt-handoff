#!/usr/bin/env python3
"""Independent SP-104 red-team QA.

This process recomputes the material evidence counts from raw inputs, checks
the frozen official exports against the crosswalk, validates leakage and
source-separation guards, and proves that unsafe mutations fail closed.  It
does not run SP-079, owner review, final numeric generation, or shoulder work.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
H2F_METRICS = {
    "HP_TO_1B_SECONDS",
    "HP_TO_1B_FASTEST_SEC",
    "HP_TO_1B_AVG_SEC",
    "HP_TO_1B_NORMAL_SEC",
}
T90_METRICS = {"T90FT_SECONDS"}
CANONICAL_PATHS = [
    "outputs/derived/sp104_historical_physical_canonical.jsonl",
    "data/manual/sp104_mlb_running_splits.csv",
    "data/manual/sp104_mlb_sprint_exposure_h2f.csv",
    "outputs/derived/sp104_mlb_running_collection_manifest.json",
    "outputs/derived/sp104_mlb_npb_running_crosswalk_coverage.json",
    "outputs/derived/sp104_transfer_method_benchmark.json",
    "outputs/derived/sp104_anchor_to_sparse_player_receipts.jsonl",
    "outputs/derived/sp104_selected_transfer_policy.json",
    "outputs/derived/sp104_current100_physical_state_before_after.json",
    "outputs/derived/sp104_component_decision_use_ablation.json",
    "outputs/derived/sp104_npbplus_h2f_recollection_receipt.json",
    "outputs/derived/sp104_outfielder_jump_burst_context.json",
    "outputs/derived/qa_sp104_pre_sp079_remediation.json",
    "outputs/derived/sp104_pre_sp079_readiness.json",
    "docs/audits/sp104_pre_sp079_high_value_remediation.md",
]
DETERMINISTIC_PATHS = [path for path in CANONICAL_PATHS if not path.endswith("qa_sp104_pre_sp079_remediation.json")]


def load_json(rel: str) -> Any:
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def read_jsonl(rel: str) -> list[dict[str, Any]]:
    path = ROOT / rel
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def read_csv(rel: str) -> tuple[list[str], list[dict[str, str]]]:
    with (ROOT / rel).open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        return list(reader.fieldnames or []), list(reader)


def read_tsv(rel: str) -> list[dict[str, str]]:
    with (ROOT / rel).open("r", encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


def digest(rel: str) -> str:
    h = hashlib.sha256()
    with (ROOT / rel).open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def check(checks: list[dict[str, Any]], name: str, passed: bool, observed: Any, expected: Any) -> None:
    checks.append({"check": name, "passed": bool(passed), "observed": observed, "expected": expected})


def physical_lane(metric: str) -> str:
    if metric in H2F_METRICS:
        return "H2F"
    if "30M" in metric or "50M" in metric or metric == "50m":
        return "SHORT"
    if metric in T90_METRICS:
        return "T90"
    return "OTHER"


def normalize_name(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().lower()
    return re.sub(r"[\s\u3000・･,.，、'’\"()（）［］【】_\-]+", "", text)


def physical_guard(rows: list[dict[str, Any]]) -> bool:
    for row in rows:
        if physical_lane(str(row.get("metric", ""))) == "SHORT":
            if "30M_OR_50M_TO_T90_CONVERSION" not in row.get("forbidden_transforms", []):
                return False
            if any("derived_t90" in str(key).lower() for key in row):
                return False
        if row.get("powerpro_label_used") is not False:
            return False
    return True


def registry_gate_ok(rows: list[dict[str, str]]) -> bool:
    by_id = {row.get("task_id"): row for row in rows}
    sp079 = by_id.get("SP-079", {})
    deps = {item for item in str(sp079.get("depends_on", "")).split(",") if item}
    return (
        {"SP-103", "SP-104"}.issubset(deps)
        and sp079.get("status") in {"BLOCKED", "BLOCKED_DEPENDENCY"}
        and by_id.get("SP-104", {}).get("status") == "PARTIAL"
        and by_id.get("SP-103", {}).get("status") == "DONE_VALIDATED"
    )


def benchmark_guard(benchmark: dict[str, Any]) -> bool:
    required = {
        "training_population",
        "training_n",
        "distinct_players",
        "distinct_seasons",
        "features",
        "target",
        "target_construct",
        "holdout_design",
        "leakage_guard",
        "common_support",
        "calibration_mae",
        "interval_coverage",
        "uncertainty",
        "simple_baseline",
        "incremental_vs_frozen_state",
        "route_double_count_risk",
        "result_state",
    }
    expected_ids = {"TF-056", "TF-057", "TF-058", "TF-059", "TF-060", "TF-061", "TF-062"}
    methods = benchmark.get("methods", [])
    if {row.get("method_id") for row in methods} != expected_ids:
        return False
    for row in methods:
        if not required.issubset(row):
            return False
        if not isinstance(row.get("features"), list) or row.get("target") in row.get("features", []):
            return False
        if "leave-player-out" not in str(row.get("holdout_design", "")).lower():
            return False
        if "player" not in str(row.get("leakage_guard", "")).lower():
            return False
        if row.get("result_state") not in {"USED", "BOUNDED_CONTEXT", "MEASURED_NEGATIVE", "NO_COMMON_SUPPORT"}:
            return False
        if row.get("direct_numeric_promotion_allowed") is not False:
            return False
        if row.get("powerpro_teacher_used") is not False:
            return False
        feature_text = " ".join(str(value) for value in row.get("features", []))
        target_text = str(row.get("target", ""))
        if re.search(r"powerpro|the show|rating|0[- ]?100", feature_text + " " + target_text, re.I):
            return False
    policy = benchmark.get("teacher_policy", {})
    return (
        policy.get("powerpro_labels_in_teacher_features_or_targets") is False
        and policy.get("the_show_labels_in_teacher_features_or_targets") is False
        and policy.get("target_cannot_teach_itself") is True
        and policy.get("same_player_seasons_clustered") is True
    )


def missingness_guard(rows: list[dict[str, Any]]) -> bool:
    for row in rows:
        if row.get("missingness_policy") != "MISSING_LEADERBOARD_ROW_IS_MISSING_EXPOSURE_NOT_SLOW":
            return False
        if str(row.get("exposure_join_state", "")).startswith("NO_"):
            if row.get("sprint_speed_kmh") in {0, "0", 0.0}:
                return False
            if row.get("competitive_runs") in {0, "0", 0.0}:
                return False
    return True


def jump_guard(jump: dict[str, Any]) -> bool:
    if jump.get("used_in_physical_transfer") is not False:
        return False
    for row in jump.get("rows", []):
        if row.get("burst_use_scope") != "DEFENSIVE_CONTEXT_ONLY":
            return False
        if "Reaction and Route" not in str(row.get("reaction_route_separation", "")):
            return False
        if "burst_used_features" in row:
            return False
    return jump.get("components", {}).get("burst_is_universal_speed") is False


def no_final_numeric_guard(payloads: list[Any]) -> bool:
    forbidden_keys = {"final_speed", "final_speed_value", "final_rating", "owner_verdict", "shoulder_value"}
    for payload in payloads:
        if isinstance(payload, dict):
            if any(key in payload and payload[key] not in {False, None, "NOT_RUN", "NOT_STARTED"} for key in forbidden_keys):
                return False
            if not no_final_numeric_guard(list(payload.values())):
                return False
        elif isinstance(payload, list):
            if not no_final_numeric_guard(payload):
                return False
    return True


def main() -> None:
    checks: list[dict[str, Any]] = []
    failures: list[str] = []
    for rel in CANONICAL_PATHS:
        path = ROOT / rel
        if rel.endswith("qa_sp104_pre_sp079_remediation.json"):
            # This artifact is the file being produced by this process.  Its
            # existence and non-empty check is performed after serialization.
            continue
        check(checks, f"artifact_nonempty:{rel}", path.exists() and path.stat().st_size > 0, path.stat().st_size if path.exists() else 0, ">0")

    raw = load_json("data/normalized/speed_historical_physical_measurements_2015_2026.json")["records"]
    canonical = read_jsonl("outputs/derived/sp104_historical_physical_canonical.jsonl")
    raw_counts = Counter(physical_lane(str(row.get("metric", ""))) for row in raw)
    canonical_counts = Counter(physical_lane(str(row.get("metric", ""))) for row in canonical)
    check(
        checks,
        "recompute_p0a_raw_baseline_counts",
        raw_counts["H2F"] == 74 and raw_counts["SHORT"] == 232 and raw_counts["T90"] == 12,
        dict(raw_counts),
        {"H2F": 74, "SHORT": 232, "T90": 12},
    )
    canonical_raw_ids = [raw_id for row in canonical for raw_id in row.get("raw_record_ids", [])]
    check(
        checks,
        "p0a_canonical_raw_provenance_and_dedup",
        len(set(canonical_raw_ids)) == len(raw) and len({row.get("canonical_id") for row in canonical}) == len(canonical) and sum(row.get("raw_record_count", 0) for row in canonical) == len(raw),
        {"raw": len(raw), "canonical": len(canonical), "raw_id_union": len(set(canonical_raw_ids)), "dedup_groups": sum(row.get("raw_record_count", 0) > 1 for row in canonical)},
        "all raw IDs retained in unique canonical provenance groups",
    )
    check(
        checks,
        "p0a_canonical_counts_recomputed",
        canonical_counts["H2F"] == 74 and canonical_counts["SHORT"] == 231 and canonical_counts["T90"] == 12,
        dict(canonical_counts),
        {"H2F": 74, "SHORT": 231, "T90": 12},
    )
    required_physical_fields = {
        "stable_player_key",
        "identity_state",
        "measurement_date",
        "measurement_year",
        "value_range",
        "source_urls",
        "same_measurement_cluster_id",
        "metric",
        "raw_value",
        "raw_unit",
        "timing_method",
        "start_protocol",
        "batting_side",
        "swing_context",
        "confidence",
    }
    check(
        checks,
        "p0a_row_level_field_preservation",
        all(required_physical_fields.issubset(row) for row in canonical),
        sorted(required_physical_fields),
        "identity/date/year/range/source/cluster/metric/raw/protocol/start/side/context/confidence",
    )
    unknown_rows_bounded = all(
        row.get("range_state") != "EXACT_RETAINED_WITH_PROTOCOL_AND_DATE"
        for row in canonical
        if row.get("date_resolution_state") == "DATE_UNKNOWN_BOUNDED" or row.get("protocol_resolution_state") == "PROTOCOL_UNKNOWN_BOUNDED"
    )
    check(checks, "p0a_unknown_date_or_protocol_stays_bounded", unknown_rows_bounded, True, "no unknown row is treated as exact")
    check(checks, "p0a_no_30m50m_to_t90", physical_guard(canonical), True, "short-distance rows carry a hard no-conversion guard")

    manifest = load_json("outputs/derived/sp104_mlb_running_collection_manifest.json")
    coverage = load_json("outputs/derived/sp104_mlb_npb_running_crosswalk_coverage.json")
    running_headers, running = read_csv("data/manual/sp104_mlb_running_splits.csv")
    sprint_headers, sprint = read_csv("data/manual/sp104_mlb_sprint_exposure_h2f.csv")
    with (ROOT / "data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv").open(encoding="utf-8-sig", newline="") as fh:
        crosswalk = list(csv.DictReader(fh))
    eligible_ids = {
        mlbam_id
        for row in crosswalk
        for mlbam_id in re.findall(r"\d+", row.get("mlbam_ids", ""))
    }
    check(
        checks,
        "p0b_full_crosswalk_not_current100_only",
        coverage.get("eligible_mlbam_id_count") == len(eligible_ids) == 55
        and coverage.get("eligible_selection", {}).get("not_current100_only") is True
        and coverage.get("eligible_selection", {}).get("current100_stable_keys") == 100,
        {"eligible_ids": len(eligible_ids), "coverage": coverage.get("eligible_mlbam_id_count"), "current100": coverage.get("eligible_selection", {}).get("current100_stable_keys")},
        "all exact crosswalk MLBAM IDs, with current100 included but not used as the denominator",
    )
    anchor_universe = coverage.get("physical_rich_anchor_universe", {})
    recomputed_anchor_names = {normalize_name(row.get("player")) for row in raw if row.get("player")}
    anchor_rows = anchor_universe.get("rows", [])
    check(
        checks,
        "p0b_physical_rich_anchor_universe_recomputed",
        len(anchor_rows) == len(recomputed_anchor_names)
        and sum(int(row.get("raw_record_count", 0)) for row in anchor_rows) == len(raw)
        and all(mlbam_id in eligible_ids for row in anchor_rows for mlbam_id in row.get("mlbam_ids", []))
        and anchor_universe.get("name_only_match_allowed") is False,
        {"raw_names": len(recomputed_anchor_names), "coverage_names": len(anchor_rows), "raw_records": len(raw)},
        "full physical-rich anchor name universe with explicit unresolved/name-only guard",
    )
    required_running_fields = {
        "mlbam_id",
        "season",
        "standardized_90ft_seconds",
        "split_005_seconds",
        "split_085_seconds",
        "split_090_seconds",
        "batting_side",
        "competitive_runs",
        "bolts",
        "raw_hp_to_1b_seconds",
        "qualifier_value",
        "source_response_sha256",
    }
    required_sprint_fields = {
        "mlbam_id",
        "season",
        "sprint_speed_kmh",
        "competitive_runs",
        "bolts",
        "raw_hp_to_1b_seconds",
        "qualifier_value",
        "source_response_sha256",
    }
    check(checks, "p0b_export_schema_has_required_physical_fields", required_running_fields.issubset(running_headers) and required_sprint_fields.issubset(sprint_headers), {"running_missing": sorted(required_running_fields - set(running_headers)), "sprint_missing": sorted(required_sprint_fields - set(sprint_headers))}, "90ft/five-foot/side/exposure/Sprint/Bolts/H2F/id/source fields")
    check(checks, "p0b_exports_identity_joined_by_exact_id", all(row.get("mlbam_id") in eligible_ids for row in running + sprint) and coverage.get("identity_guards", {}).get("name_only_join_used") is False and coverage.get("identity_guards", {}).get("ambiguous_ids_forced") is False, {"running_ids": len({row.get("mlbam_id") for row in running}), "sprint_ids": len({row.get("mlbam_id") for row in sprint})}, "no name-only or ambiguous identity join")
    source_receipts = [
        receipt
        for group in manifest.get("raw_snapshot_receipts", {}).values()
        for receipt in group
    ]
    receipt_hash_ok = True
    for receipt in source_receipts:
        path = ROOT / receipt["snapshot_path"]
        receipt_hash_ok = receipt_hash_ok and path.exists() and digest(receipt["snapshot_path"]) == receipt.get("sha256") and receipt.get("fetch_status") == 200
    check(checks, "p0b_official_exports_frozen_with_receipts", len(source_receipts) == 36 and receipt_hash_ok, {"receipts": len(source_receipts), "hashes_ok": receipt_hash_ok}, "12 years x 3 official CSV surfaces with frozen hashes")
    check(checks, "p0b_missing_rows_not_slow", missingness_guard(running) and missingness_guard(sprint) and coverage.get("missingness_policy", {}).get("leaderboard_absence") == "MISSING_EXPOSURE_NOT_SLOW", {"missing_running_ids": len(manifest.get("filtered_unique_coverage", {}).get("missing_running_ids_not_slow", [])), "missing_sprint_ids": len(manifest.get("filtered_unique_coverage", {}).get("missing_sprint_ids_not_slow", []))}, "absence is missing exposure, never zero/slow")
    check(checks, "p0b_bolts_require_exposure", coverage.get("missingness_policy", {}).get("raw_bolts_without_competitive_runs") == 0 and all(not row.get("bolts") or row.get("competitive_runs") for row in sprint), coverage.get("missingness_policy", {}).get("raw_bolts_without_competitive_runs"), "Bolts are interpreted only with Competitive Runs")
    check(checks, "p0b_raw_h2f_distinct_from_standardized_90ft", coverage.get("missingness_policy", {}).get("raw_hp_to_1b_is_standardized_90ft") is False and all(row.get("hp_to_1b_semantics") == "RAW_H2F_LEADERBOARD_FIELD_NOT_STANDARDIZED_90FT" for row in running + sprint), True, "raw HP-to-1B is not silently treated as 90-foot")

    benchmark = load_json("outputs/derived/sp104_transfer_method_benchmark.json")
    check(checks, "p0c_seven_candidate_methods_and_leakage_contract", benchmark_guard(benchmark), [row.get("method_id") for row in benchmark.get("methods", [])], "TF-056..TF-062 with player-clustered holdout/common support/uncertainty")
    check(checks, "p0c_powerpro_absent_from_teacher_features_and_targets", benchmark.get("teacher_policy", {}).get("powerpro_labels_in_teacher_features_or_targets") is False and benchmark.get("teacher_policy", {}).get("the_show_labels_in_teacher_features_or_targets") is False and benchmark_guard(benchmark), {"powerpro": benchmark.get("teacher_policy", {}).get("powerpro_labels_in_teacher_features_or_targets"), "the_show": benchmark.get("teacher_policy", {}).get("the_show_labels_in_teacher_features_or_targets")}, "physical/range teacher only")
    receipts = read_jsonl("outputs/derived/sp104_anchor_to_sparse_player_receipts.jsonl")
    check(checks, "p0c_current100_anchor_receipts_exactly_100", len(receipts) == 100 and len({row.get("stable_player_key") for row in receipts}) == 100 and all(row.get("no_final_speed_value_created") is True for row in receipts), {"receipts": len(receipts)}, "one bounded receipt per current100 player")
    check(checks, "p0c_target_player_and_seasons_clustered", all(item.get("target_player_excluded_from_training") is True and item.get("all_player_seasons_clustered") is True for row in receipts for item in row.get("method_receipts", [])), True, "no same-player season leakage")

    before_after = load_json("outputs/derived/sp104_current100_physical_state_before_after.json")
    ablation = load_json("outputs/derived/sp104_component_decision_use_ablation.json")
    check(checks, "p0d_before_after_all100_lanes", before_after.get("population") == 100 and len(before_after.get("players", [])) == 100 and all({"peak_speed", "acceleration_h2f", "end_to_end_t90", "historical_range", "selected_anchor_transfer", "technique_context", "outcome_proxy_context", "missing_common_support"}.issubset(row.get("before", {})) and {"peak_speed", "acceleration_h2f", "end_to_end_t90", "historical_range", "selected_anchor_transfer", "technique_context", "outcome_proxy_context", "missing_common_support"}.issubset(row.get("after", {})) for row in before_after.get("players", [])), {"population": before_after.get("population"), "rows": len(before_after.get("players", []))}, "all 100 before/after lanes present and technique/proxy separate")
    check(checks, "p0d_component_ablation_all100x6", ablation.get("population") == 100 and ablation.get("all100x6_exact") is True and len(ablation.get("ablation_cells", [])) == 600 and all(cell.get("final_speed_value_created") is False for cell in ablation.get("ablation_cells", [])), {"population": ablation.get("population"), "cells": len(ablation.get("ablation_cells", []))}, "top/historical/MLB-transfer/selected/The-Show/proxy ablations without final values")

    npb = load_json("outputs/derived/sp104_npbplus_h2f_recollection_receipt.json")
    jump = load_json("outputs/derived/sp104_outfielder_jump_burst_context.json")
    check(checks, "p1a_current_npbplus_h2f_bounded_negative", npb.get("status") == "BLOCKED_EXTERNAL_CURRENT_VALUE_SURFACE" and npb.get("player_value_rows_retrieved") == 0 and npb.get("old_local_npplus_hp_to_1b_values_read") is False and npb.get("numeric_promotion_allowed") is False, {"status": npb.get("status"), "rows": npb.get("player_value_rows_retrieved")}, "current per-player surface unavailable; legacy values fail-closed")
    check(checks, "p1b_jump_reaction_burst_route_separation", jump_guard(jump), {"status": jump.get("status"), "rows": len(jump.get("rows", [])), "used": jump.get("used_in_physical_transfer")}, "Burst is defensive context; Reaction/Route cannot enter Burst")

    registry = read_tsv("docs/state/speed_task_registry.tsv")
    check(checks, "registry_sp079_actual_depends_on_contains_sp104", registry_gate_ok(registry), {row.get("task_id"): {"status": row.get("status"), "depends_on": row.get("depends_on")} for row in registry if row.get("task_id") in {"SP-079", "SP-103", "SP-104"}}, "SP-079 is blocked by actual SP-103 and SP-104 dependencies")
    old_qa_script = (ROOT / "scripts/qa_sp103_speed_evidence_universe.py").read_text(encoding="utf-8")
    check(checks, "old_sp103_diagnostic_uses_depends_on_field", "sp079_depends_on" in old_qa_script and 'get("dependencies")' not in old_qa_script, True, "diagnostic reads the registry depends_on field")
    sp103_qa = load_json("outputs/derived/qa_sp103_speed_evidence_universe.json")
    sp103_registry_check = next(
        (
            row
            for row in sp103_qa.get("checks", [])
            if row.get("check") == "registry_sp103_sp104_gate_and_sp079_block"
        ),
        {},
    )
    sp103_registry_observed = sp103_registry_check.get("observed", {})
    check(
        checks,
        "sp103_diagnostic_artifact_records_actual_depends_on",
        sp103_registry_check.get("passed") is True
        and bool(sp103_registry_observed.get("sp079_depends_on"))
        and "sp079_dependencies" not in sp103_registry_observed,
        sp103_registry_observed,
        "SP-103 QA diagnostic records depends_on, not nonexistent dependencies",
    )
    old_ledger = load_json("outputs/derived/sp078_owner_verdict_ledger_20260816.json")
    check(checks, "owner_verdict_count_zero_and_downstream_locks", old_ledger.get("owner_verdict_count") == 0 and load_json("outputs/derived/sp104_pre_sp079_readiness.json").get("sp079_run_status") == "NOT_RUN" and load_json("outputs/derived/sp104_pre_sp079_readiness.json").get("shoulder_status") == "NOT_STARTED", {"owner_verdict_count": old_ledger.get("owner_verdict_count"), "sp079": load_json("outputs/derived/sp104_pre_sp079_readiness.json").get("sp079_run_status")}, "owner 0, SP-079 not run, shoulder not started")
    payloads = [benchmark, load_json("outputs/derived/sp104_selected_transfer_policy.json"), before_after, ablation, npb, jump, load_json("outputs/derived/sp104_pre_sp079_readiness.json")]
    check(checks, "no_final_numeric_or_shoulder_payload", no_final_numeric_guard(payloads), True, "no final speed/rating/owner/shoulder value")

    fixture_results: list[dict[str, Any]] = []
    bad_registry = [dict(row) for row in registry]
    for row in bad_registry:
        if row.get("task_id") == "SP-079":
            row["depends_on"] = "SP-103"
    fixture_results.append({"fixture": "remove_sp104_from_actual_depends_on", "detected_failure": not registry_gate_ok(bad_registry), "expected_failure": True})
    bad_physical = [dict(row) for row in canonical]
    bad_physical[0] = dict(bad_physical[0])
    bad_physical[0]["metric"] = "50M_STANDING_START_SECONDS"
    bad_physical[0]["metric_lane"] = "HISTORICAL_SHORT_DISTANCE_RANGE"
    bad_physical[0]["derived_t90_seconds"] = 4.0
    fixture_results.append({"fixture": "inject_30m50m_to_t90_derived_field", "detected_failure": not physical_guard(bad_physical), "expected_failure": True})
    bad_benchmark = json.loads(json.dumps(benchmark))
    next(row for row in bad_benchmark["methods"] if row["method_id"] == "TF-062")["features"] = ["standardized_90ft_seconds (seconds_since_hit_090)"]
    fixture_results.append({"fixture": "allow_target_in_teacher_features", "detected_failure": not benchmark_guard(bad_benchmark), "expected_failure": True})
    bad_jump = json.loads(json.dumps(jump))
    if bad_jump.get("rows"):
        bad_jump["rows"][0]["burst_used_features"] = ["reaction", "burst", "route"]
    else:
        bad_jump["components"]["burst_used_features"] = ["reaction", "route"]
    fixture_results.append({"fixture": "merge_reaction_route_into_burst", "detected_failure": not jump_guard(bad_jump), "expected_failure": True})
    bad_missing = [dict(row) for row in running]
    if bad_missing:
        bad_missing[0]["exposure_join_state"] = "NO_SPRINT_EXPOSURE_ROW"
        bad_missing[0]["sprint_speed_kmh"] = "0"
    fixture_results.append({"fixture": "turn_missing_row_into_zero_speed", "detected_failure": not missingness_guard(bad_missing), "expected_failure": True})
    bad_powerpro = json.loads(json.dumps(benchmark))
    next(row for row in bad_powerpro["methods"] if row["method_id"] == "TF-056")["features"] = ["PowerPro_speed"]
    fixture_results.append({"fixture": "use_powerpro_as_physical_teacher", "detected_failure": not benchmark_guard(bad_powerpro), "expected_failure": True})
    check(checks, "fail_before_fixtures_detected", all(item["detected_failure"] == item["expected_failure"] for item in fixture_results), fixture_results, "unsafe mutations are rejected")

    before_hashes = {rel: digest(rel) for rel in DETERMINISTIC_PATHS if (ROOT / rel).exists()}
    rerun = subprocess.run(
        [sys.executable, "scripts/sp104_pre_sp079_remediation.py", "--offline"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    after_hashes = {rel: digest(rel) for rel in DETERMINISTIC_PATHS if (ROOT / rel).exists()}
    check(checks, "deterministic_offline_rematerialization", rerun.returncode == 0 and before_hashes == after_hashes, {"returncode": rerun.returncode, "equal_hashes": before_hashes == after_hashes, "hash_count": len(after_hashes)}, "byte-identical frozen-snapshot rerun")

    failures = [row["check"] for row in checks if not row["passed"]]
    status = "PASS_PARTIAL_BLOCKED" if not failures else "FAIL_REPAIR_REQUIRED"
    payload = {
        "schema_version": "qa_sp104_pre_sp079_remediation_v1",
        "as_of": "2026-08-24",
        "status": status,
        "independent_lane": "QA-2",
        "independent_from": [
            "scripts/sp104_pre_sp079_remediation.py",
            "scripts/qa_sp103_speed_evidence_universe.py",
            "SP-079",
            "SP-078 owner verdict",
        ],
        "checks": checks,
        "failed_checks": failures,
        "fail_before_fixtures": fixture_results,
        "summary": {
            "passed_checks": sum(1 for row in checks if row["passed"]),
            "total_checks": len(checks),
            "fixture_count": len(fixture_results),
        },
        "gate_locks": {
            "owner_verdict_count": 0,
            "sp079_run": "NOT_RUN",
            "final_speed_numeric_generation": "NOT_RUN",
            "shoulder": "NOT_STARTED",
        },
        "decision": "SP-079 remains blocked pending explicit downstream authorization; this QA did not run downstream work.",
    }
    (ROOT / "outputs/derived/qa_sp104_pre_sp079_remediation.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    # Re-materialize once after the QA payload exists so the audit/readiness
    # artifacts record the final QA status while remaining deterministic.
    finalizer = subprocess.run(
        [sys.executable, "scripts/sp104_pre_sp079_remediation.py", "--offline"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    payload["finalizer_returncode"] = finalizer.returncode
    payload["finalizer_stdout"] = finalizer.stdout.strip()
    if finalizer.returncode != 0:
        payload["status"] = "FAIL_REPAIR_REQUIRED"
        payload["failed_checks"] = sorted(set(payload["failed_checks"] + ["qa_final_audit_rematerialization"]))
    (ROOT / "outputs/derived/qa_sp104_pre_sp079_remediation.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": payload["status"], "failed_checks": payload["failed_checks"], "summary": payload["summary"]}, ensure_ascii=False, sort_keys=True))
    raise SystemExit(0 if payload["status"].startswith("PASS") else 1)


if __name__ == "__main__":
    main()

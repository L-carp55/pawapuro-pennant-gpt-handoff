#!/usr/bin/env python3
"""Independent QA for the SP-101 identity/shared-metric repair packet."""

from __future__ import annotations

import csv
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any


DATE = "2026-08-18"
ROOT = Path(__file__).resolve().parents[1]


def read_json(path: str) -> Any:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def read_csv(path: str) -> list[dict[str, str]]:
    with (ROOT / path).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def read_gzip_csv(path: str) -> list[dict[str, str]]:
    with gzip.open(ROOT / path, "rt", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def read_gzip_jsonl(path: str) -> list[dict[str, Any]]:
    with gzip.open(ROOT / path, "rt", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    queue = read_json("outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json")
    packet = read_json("outputs/derived/sp101_current100_multibridge_evidence.json")
    show_packet = read_json("outputs/derived/sp101_current100_the_show_evidence.json")
    appearance = read_csv("outputs/derived/sp101_mlb_regular_season_appearance_years.csv")
    shared = read_gzip_csv("outputs/derived/sp101_mlb_shared_indicator_player_seasons.csv.gz")
    analog = read_gzip_csv("outputs/derived/sp101_metric_neighborhood_analog_pairs.csv.gz")
    transitions = read_csv("outputs/derived/sp101_npb_mlb_transition_segments.csv")
    effects = read_json("outputs/derived/sp101_transition_effects.json")
    decisions = read_json("outputs/derived/sp101_requirements_to_decision_utilization.json")
    ablation = read_json("outputs/derived/sp101_route_ablation_qa.json")
    residual = read_json("outputs/derived/sp101_residual_low_confidence_target_set.json")
    graph = read_json("outputs/derived/sp101_pairwise_ordinal_graph.json")
    crosswalk = read_csv("data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv")
    panel = read_gzip_jsonl("outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz")
    ledger = read_json("outputs/derived/sp078_owner_verdict_ledger_20260816.json")

    checks: list[dict[str, Any]] = []

    def check(check_id: str, condition: bool, finding: str, details: Any = None) -> None:
        checks.append({"check_id": check_id, "status": "PASS" if condition else "FAIL", "finding": finding, "details": details})

    by_player = {row["player"]: row for row in packet["players"]}
    by_show_player = {row["player"]: row for row in show_packet["players"]}
    cross_by_name = {row["npb_name"]: row for row in crosswalk}
    panel_counts = Counter(row.get("npb_name") for row in panel)
    appearance_by_name: dict[str, list[dict[str, str]]] = {}
    for row in appearance:
        appearance_by_name.setdefault(row["npb_name"], []).append(row)

    check("current100_exact", len(packet.get("players", [])) == 100 and len({row.get("queue_order") for row in packet.get("players", [])}) == 100, "Current-100 packet has exactly one receipt per queue order.", {"players": len(packet.get("players", [])), "orders": len({row.get("queue_order") for row in packet.get("players", [])})})
    check("current100_show_exact", len(show_packet.get("players", [])) == 100 and len({row.get("queue_order") for row in show_packet.get("players", [])}) == 100, "Current-100 Show packet has exactly one receipt per queue order.")
    check("canary_calixte", by_player.get("カリステ", {}).get("coverage_state") == "THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH" and panel_counts["カリステ"] == 0, "カリステ is reconciled to current PROEYE and is not NO_MLB_PROMOTION_FOUND despite missing Live rows.", by_player.get("カリステ"))
    check("canary_polanco", panel_counts["ポランコ"] == 21 and by_player.get("ポランコ", {}).get("coverage_state") == "ELIGIBLE_MATCHED", "ポランコ retains all 21 repaired Live rows.", {"panel_rows": panel_counts["ポランコ"], "packet": by_player.get("ポランコ")})
    check("canary_montero", panel_counts["モンテロ"] == 120 and by_player.get("モンテロ", {}).get("coverage_state") == "ELIGIBLE_MATCHED", "モンテロ retains all 120 repaired Live rows.", {"panel_rows": panel_counts["モンテロ"], "packet": by_player.get("モンテロ")})
    check("canary_santana", by_player.get("サンタナ", {}).get("coverage_state") == "THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH" and panel_counts["サンタナ"] == 0, "サンタナ is not NO_MLB_PROMOTION_FOUND after verified MLB matching; missing Live data is explicit.", by_player.get("サンタナ"))
    check("positive_akiyama", by_player.get("秋山 翔吾", {}).get("coverage_state") == "ELIGIBLE_MATCHED" and by_player.get("秋山 翔吾", {}).get("the_show_live_row_count_after_repair") == 43, "秋山翔吾 remains matched with preserved Live evidence.", by_player.get("秋山 翔吾"))
    check("positive_tsutsugo", by_player.get("筒香 嘉智", {}).get("coverage_state") == "ELIGIBLE_MATCHED" and by_player.get("筒香 嘉智", {}).get("the_show_live_row_count_after_repair") == 43, "筒香嘉智 remains matched with preserved Live evidence.", by_player.get("筒香 嘉智"))
    check("negative_soto", by_player.get("ソト", {}).get("identity_state") == "AMBIGUOUS_SHORT_NPB_NAME_NOT_FORCED" and not appearance_by_name.get("ソト"), "ソト remains unresolved; no short-name MLB candidate was adopted.", by_player.get("ソト"))

    contradiction = []
    for row in packet["players"]:
        if row.get("coverage_state") == "NO_MLB_PROMOTION_FOUND" and (row.get("mlb_regular_season_appearance_years") or row.get("player") in {"カリステ", "ポランコ", "モンテロ", "サンタナ"}):
            contradiction.append(row.get("player"))
    check("no_current_mlb_contradiction", not contradiction, "No current packet claims NO_MLB_PROMOTION_FOUND when verified or curated MLB evidence is present.", contradiction)
    check("appearance_game_type", all(row.get("game_type") == "R" and row.get("evidence_state") == "VERIFIED_REGULAR_SEASON_APPEARANCE" for row in appearance), "Every MLB appearance row is regular-season evidence with explicit appearance state.")
    check("appearance_not_show_fixture", any(set(row.get("mlb_regular_season_appearance_years", [])) != set(row.get("the_show_years", [])) for row in transitions), "At least one transition proves actual MLB years are distinct from The Show fixture seasons.")
    check("foreign_cohort_represented", effects.get("cohort_denominators", {}).get("FOREIGN_MLB_TO_NPB", {}).get("screened") == 77 and effects.get("cohort_denominators", {}).get("FOREIGN_MLB_TO_NPB", {}).get("represented", 0) > 0, "The historical 77-name foreign cohort has non-zero actual transition representation.", effects.get("cohort_denominators", {}).get("FOREIGN_MLB_TO_NPB"))
    check("returnee_and_multicycle", effects.get("cohort_denominators", {}).get("RETURNEE", {}).get("represented", 0) > 0 and effects.get("cohort_denominators", {}).get("MULTI_CYCLE", {}).get("represented", 0) > 0, "Returnee and multi-cycle cohorts are represented or their bounded denominator is visible.", effects.get("cohort_denominators"))

    valid_analog = [row for row in analog if row.get("analog_state") == "VALID_MULTI_FEATURE_ANALOG"]
    check("mb01_multi_feature", len(valid_analog) > 0 and min(int(row.get("feature_count") or 0) for row in valid_analog) > 1, "MB-01 has a collection-backed valid subset with more than one common feature.", {"valid_rows": len(valid_analog), "minimum_feature_count": min((int(row.get("feature_count") or 0) for row in valid_analog), default=0)})
    check("mb01_no_raw_rate_match", all("raw_rate_matching_forbidden" in row.get("normalization", "") and "within_league_season_percentile" in row.get("normalization", "") for row in analog), "MB-01 records league-season normalization and forbids raw-rate cross-league matching.")
    mb02 = read_json("outputs/derived/sp101_dual_game_behavior_models.json")
    check("mb02_shared_model", (mb02.get("the_show_speed_from_mlb_shared_indicators", {}).get("rows") or 0) > 0 and mb02.get("legacy_show_speed_from_statcast_sprint_submodel", {}).get("not_replaced_by_shared_model") is True, "MB-02 contains a true MLB-shared-indicator Show model and preserves the separate Sprint submodel.", mb02.get("the_show_speed_from_mlb_shared_indicators", {}))
    check("mb02_ablation_holdout", bool(mb02.get("the_show_speed_from_mlb_shared_indicators", {}).get("ablation")) and bool(mb02.get("the_show_speed_from_mlb_shared_indicators", {}).get("player_clustered_holdout")), "MB-02 includes feature ablation and clustered/forward holdout receipts.")
    families = graph.get("source_family_counts", {})
    required_families = {"DIRECT_PHYSICAL", "THE_SHOW_LIVE", "POWERPRO_BEHAVIOR", "MB01_MULTI_FEATURE_ANALOG", "COMMUNITY_SCOUTING_ORDINAL", "TEMPORAL_TRANSITION"}
    check("mb07_source_families", required_families.issubset(families), "MB-07 contains direct physical, The Show, PowerPro, analog, Community/scouting and temporal/source-family edges.", families)
    check("mb07_edge_evidence", all(edge.get("evidence_ids") is not None and edge.get("temporal_scope") for edge in graph.get("edges", [])), "Every MB-07 edge has evidence IDs and temporal scope.")
    mb12_13 = []
    for player in decisions.get("players", []):
        for route in ["MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE", "MB-13_PINCH_RUNNER_AND_USAGE_ROLE_CONTEXT"]:
            value = player["decision_use"][route]
            mb12_13.append(value)
    check("mb12_mb13_not_unconditional", not any(value.get("state") == "USED_CONTEXT" for value in mb12_13), "MB-12/13 do not use unconditional USED_CONTEXT; each is explicit context, blocked, or not collected.")
    used = [value for player in decisions.get("players", []) for value in player.get("decision_use", {}).values() if value.get("state") in {"USED_DIRECTLY", "USED_CONTEXT"}]
    check("used_requires_evidence", all(value.get("evidence_count", 0) > 0 and value.get("evidence_ids") and value.get("consumed_source_rows") for value in used), "Every USED decision state includes evidence IDs, counts and consumed source rows.")
    check("mb16_separate_lanes", all("four_output_architecture_repair" in row and row.get("independent_physical_estimate", {}).get("powerpro_label_used") is False for row in packet["players"]), "MB-16 packets preserve separate physical, Show, PowerPro, context and repaired lanes.")
    check("mb18_ablation_matrix", ablation.get("cells") == 1800 and len(ablation.get("ablation_cells", [])) == 1800 and all("evidence_ids" in cell and "evidence_count" in cell and "pre_state" in cell and "post_state" in cell and "influence_classification" in cell for cell in ablation.get("ablation_cells", [])), "MB-18 has actual before/after evidence fields for all 100×18 cells.", {"cells": ablation.get("cells"), "ablation_cells": len(ablation.get("ablation_cells", []))})
    target_rows = residual.get("players", [])
    check("target_freeze_exact", len(target_rows) == 100 and len({row.get("queue_order") for row in target_rows}) == 100 and all(row.get("target_selection_state") in {"TARGETED_LOW_CONFIDENCE", "TARGETED_MATERIAL_CONFLICT", "TARGETED_OWNER_OVERRIDE", "NOT_TARGETED_SUFFICIENT_CONFIDENCE", "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN"} for row in target_rows), "SP-102 target freeze has exactly one valid state per current-100 row.")
    check("target_low_info_score", all(isinstance(row.get("expected_information_gain_score"), (int, float)) for row in target_rows if row.get("target_selection_state") == "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN"), "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN rows carry measurable numeric information gain.")
    check("sp102_not_run", residual.get("search_status") == "SP-102_NOT_RUN", "SP-102 body search was not run.")
    check("non_live_zero", sum(row.get("non_live_excluded") is not False for row in panel) == 0, "Primary Live panel has no non-Live rows.")
    check("owner_locked_ledger", read_json("docs/state/speed_owner_review_integrity_lock_20260817.json").get("locked") is True and ledger.get("owner_verdict_count") == 0, "Owner review remains locked and the SP-078 ledger remains empty.")

    passed = sum(item["status"] == "PASS" for item in checks)
    result = {"schema_version": "qa_sp101_identity_and_shared_metric_repair_independent_20260818", "generated_at": DATE, "status": "PASS" if passed == len(checks) else "FAIL", "passed": passed, "total": len(checks), "checks": checks, "important_negative_findings": ["MLB advanced opportunity-conditioned infield hits/advancement/UBR/BsR remain explicitly blocked.", "ソト short-name identity remains unresolved and was not promoted.", "The Show seasons are not used as MLB appearance years."]}
    out = ROOT / "outputs" / "derived" / "qa_sp101_identity_and_shared_metric_repair_independent_20260818.json"
    out.write_bytes((json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8"))
    audit = ROOT / "docs" / "audits" / "sp101_identity_and_shared_metric_repair_independent_qa_20260818.md"
    lines = ["# SP-101 identity/shared-metric independent QA", "", f"Date: {DATE}", f"Status: **{result['status']}** ({passed}/{len(checks)})", "", "| Check | Status | Finding |", "|---|---|---|"]
    lines.extend(f"| `{item['check_id']}` | `{item['status']}` | {item['finding']} |" for item in checks)
    lines.extend(["", "The historical identity-propagation failure receipt remains preserved separately. This QA validates the repaired packet and does not run SP-102, SP-079, owner verdict capture or shoulder work.", ""])
    audit.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"status": result["status"], "passed": passed, "total": len(checks)}, ensure_ascii=False, sort_keys=True))
    raise SystemExit(0 if result["status"] == "PASS" else 2)


if __name__ == "__main__":
    main()

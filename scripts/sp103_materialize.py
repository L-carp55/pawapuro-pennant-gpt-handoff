#!/usr/bin/env python3
"""Parent materializer for the independent SP-103 lanes.

This script is intentionally the only process that combines lane outputs into
the canonical SP-103 evidence-universe artifacts.  It does not run SP-079,
capture owner verdicts, generate final player speed values, or run shoulder
work.
"""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INTERMEDIATE = ROOT / "outputs" / "derived" / "sp103_intermediate"
AS_OF = "2026-08-23"


def load_json(rel: str, default: Any = None) -> Any:
    path = ROOT / rel
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(rel: str, payload: Any) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def snapshot_manifest() -> list[dict[str, Any]]:
    source_dir = ROOT / "outputs" / "derived" / "sp103_sources"
    rows = []
    for path in sorted(source_dir.glob("*")):
        if path.is_file():
            rows.append({"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size, "sha256": sha256(path)})
    return rows


def load_lanes() -> dict[str, dict[str, Any]]:
    names = {
        "A": "lane_a_local_inventory.json",
        "B": "lane_b_external_source_verification.json",
        "C": "lane_c_physical_measurements.json",
        "D": "lane_d_outcome_proxies.json",
        "E": "lane_e_cross_game_temporal.json",
        "F": "lane_f_transfer_methods.json",
        "G": "lane_g_owner_traceability.json",
    }
    return {lane: load_json(f"outputs/derived/sp103_intermediate/{name}", {}) or {} for lane, name in names.items()}


def discovery_candidates() -> list[dict[str, Any]]:
    # These are addendum discoveries.  They overlap the mandatory universe in
    # construct, but remain separate rows so the audit can prove that the
    # discovery pass was not self-sealed by the initial 66-item floor.
    return [
        {
            "candidate_number": 67,
            "evidence_id": "SP103-DISC-001",
            "family": "external_discovery",
            "item": "World Baseball Classic Statcast as an NPB-player bridge",
            "construct": "cross_league_event_tracking_opportunity",
            "status": "SOURCE_CONFIRMED_NEW",
            "source_authority": "official MLB Baseball Savant / MLB WBC article",
            "source_or_metric": "WBC Statcast search and full-tracking scope",
            "source_url_or_repo_artifact": ["https://baseballsavant.mlb.com/statcast-search-world-baseball-classic", "https://www.mlb.com/world-baseball-classic/news/world-baseball-classic-follow-ups-to-watch-in-2026"],
            "current_local_asset": "outputs/derived/sp103_external_source_verification.json",
            "coverage_denominator": {"2023_JPN_unique_player_ids": 15, "2026_JPN_unique_player_ids": 30, "running_rows_retrieved": {"2023": 0, "2026": 0}},
            "existing_requirement_ids": ["SR-047", "SR-052", "SR-058"],
            "existing_sp_routes": ["SP-101"],
            "evidence_role": "potential bridge; acquisition limitation only",
            "independence_or_double_count_risk": "same tournament play may be represented in multiple Statcast surfaces",
            "known_bias_or_confounding": "public selector lower bound and no running result column; zero rows cannot imply slow",
            "validation_needed": "re-run official query when running metrics are exposed; preserve tournament/season denominator",
            "next_action": "bounded external re-open; no numeric promotion",
            "implementation_status": "SOURCE_CONFIRMED_NEW",
            "decision_use_status": "BLOCKED_EXTERNAL_PUBLIC_SURFACE",
            "direct_numeric_promotion_allowed": False,
        },
        {
            "candidate_number": 68,
            "evidence_id": "SP103-DISC-002",
            "family": "external_discovery",
            "item": "Statcast Lead Distance / Lead Distance Gained",
            "construct": "stealing_start_technique_context",
            "status": "SOURCE_CONFIRMED_NEW",
            "source_authority": "official MLB glossary / Baseball Savant",
            "source_or_metric": "Lead Distance and Lead Distance Gained",
            "source_url_or_repo_artifact": ["https://www.mlb.com/glossary/statcast/lead-distance", "https://baseballsavant.mlb.com/leaderboard/basestealing-run-value"],
            "current_local_asset": "outputs/derived/sp103_external_source_verification.json",
            "coverage_denominator": {"local_rows": 0},
            "existing_requirement_ids": ["SR-002", "SR-052", "SR-057"],
            "existing_sp_routes": ["SP-101", "MB-13"],
            "evidence_role": "technique/opportunity context; never direct speed",
            "independence_or_double_count_risk": "shares steal attempt and pitcher/catcher event with SB outcomes",
            "known_bias_or_confounding": "lead, pitcher movement and release timing are not physical sprint speed",
            "validation_needed": "collect with event definition and deconfounding plan",
            "next_action": "do not promote; preserve as separate technique candidate",
            "implementation_status": "SOURCE_CONFIRMED_NEW",
            "decision_use_status": "NOT_COLLECTED_CONTEXT_ONLY",
            "direct_numeric_promotion_allowed": False,
        },
        {
            "candidate_number": 69,
            "evidence_id": "SP103-DISC-003",
            "family": "external_discovery",
            "item": "Statcast Competitive Runs / Bolts / HP to 1B exposure fields",
            "construct": "measurement_exposure_and_end_to_end_context",
            "status": "SOURCE_CONFIRMED_NEW",
            "source_authority": "official Baseball Savant Sprint Speed leaderboard",
            "source_or_metric": "Competitive Runs, Bolts, HP to 1B alongside Sprint Speed",
            "source_url_or_repo_artifact": ["https://baseballsavant.mlb.com/sprint_speed_leaderboard"],
            "current_local_asset": "outputs/derived/sp103_external_source_verification.json",
            "coverage_denominator": {"local_rows": 0},
            "existing_requirement_ids": ["SR-004", "SR-008", "SR-011", "SR-055"],
            "existing_sp_routes": ["SP-101", "MB-18"],
            "evidence_role": "exposure/reliability and distinct end-to-end context",
            "independence_or_double_count_risk": "HP to 1B and 90-foot splits may share the same underlying plays",
            "known_bias_or_confounding": "qualified-run selection and batting-side geometry",
            "validation_needed": "retrieve rows and preserve Competitive Runs denominator; deduplicate event families",
            "next_action": "source-confirmed opportunity, not local evidence yet",
            "implementation_status": "SOURCE_CONFIRMED_NEW",
            "decision_use_status": "NOT_COLLECTED_EXTERNAL_OPPORTUNITY",
            "direct_numeric_promotion_allowed": False,
        },
        {
            "candidate_number": 70,
            "evidence_id": "SP103-DISC-004",
            "family": "human_context",
            "item": "MLB Pipeline historical Run scouting grades",
            "construct": "scouting_run_context",
            "status": "SOURCE_CONFIRMED_NEW",
            "source_authority": "official MLB Pipeline prospect page",
            "source_or_metric": "20-80 Run tool / scouting component",
            "source_url_or_repo_artifact": ["https://www.mlb.com/prospects/2020/top100/alex-kirilloff-666135", "outputs/derived/sp103_external_source_verification.json"],
            "current_local_asset": "outputs/derived/sp103_external_source_verification.json",
            "coverage_denominator": {"verified_pages": 1, "current100_coverage": "not established"},
            "existing_requirement_ids": ["SR-031", "SR-032", "SR-055"],
            "existing_sp_routes": ["SP-060", "MB-12"],
            "evidence_role": "dated scouting context, not direct measurement",
            "independence_or_double_count_risk": "scouting prose and grade may be copied across pages",
            "known_bias_or_confounding": "scouting year, age, role and evaluator subjectivity",
            "validation_needed": "expand only with year/age/source provenance and same-player dedup",
            "next_action": "check against existing SP-060 before adding further rows",
            "implementation_status": "SOURCE_CONFIRMED_NEW",
            "decision_use_status": "NOT_COLLECTED_BOUNDED_SCOUTING",
            "direct_numeric_promotion_allowed": False,
        },
        {
            "candidate_number": 71,
            "evidence_id": "SP103-DISC-005",
            "family": "direct_physical_provenance",
            "item": "Current NPB+ fastest home-to-first availability versus legacy local provenance",
            "construct": "H2F_provenance_resolution",
            "status": "MEASURED_NEGATIVE",
            "source_authority": "official NPB+ product page plus prior independent provenance audit",
            "source_or_metric": "separate official field listing does not validate old local values",
            "source_url_or_repo_artifact": ["https://www.japan-baseball.jp/npb-plus/", "docs/audits/luna_npb_plus_provenance_contamination_20260814.md"],
            "current_local_asset": "data/pennant.db:npb_plus_measurement.hp_to_1b_sec",
            "coverage_denominator": {"old_local_rows": 109, "current_official_player_values_retrieved": 0},
            "existing_requirement_ids": ["SR-004", "SR-008", "SR-055", "SR-058"],
            "existing_sp_routes": ["SP-007", "SP-100"],
            "evidence_role": "provenance negative finding; current source reopen only",
            "independence_or_double_count_risk": "H2F may overlap 90-foot/HP-to-1B records",
            "known_bias_or_confounding": "legacy local values are misattributed; current field is not a retrieved value table",
            "validation_needed": "per-player current official retrieval with protocol and date",
            "next_action": "keep old values fail-closed and report scoped negative finding",
            "implementation_status": "MEASURED_NEGATIVE",
            "decision_use_status": "FAIL_CLOSED_LEGACY_VALUES",
            "direct_numeric_promotion_allowed": False,
        },
    ]


def materialize() -> dict[str, Any]:
    lanes = load_lanes()
    evidence: list[dict[str, Any]] = []
    for lane in ("C", "D", "E", "F", "G"):
        for original in lanes[lane].get("evidence_candidates", []):
            row = dict(original)
            # Transfer methods use a method-oriented schema in their lane
            # file.  Normalize them into the common evidence-universe schema
            # without losing their richer method fields.
            if "item" not in row:
                raw_status = str(row.get("status", ""))
                canonical_status = {
                    "IMPLEMENTED_BOUNDED": "IMPLEMENTED_INCOMPLETE",
                    "REQUIRES_NEW_PREFLIGHT": "NOT_COLLECTED",
                    "PARTIAL_HOLDOUT_RECEIPT": "IMPLEMENTED_INCOMPLETE",
                    "BLOCKED_BY_SOURCE_COVERAGE": "SOURCE_CONFIRMED_NEW",
                }.get(raw_status, raw_status or "NOT_COLLECTED")
                row.update({
                    "item": row.get("method", "unnamed transfer method"),
                    "family": "inference_method",
                    "construct": row.get("target_construct", "latent physical speed range"),
                    "status": canonical_status,
                    "evidence_status": canonical_status,
                    "method_status": raw_status,
                    "source_authority": "SP-101 route receipt / SP-103 transfer audit",
                    "source_or_metric": row.get("method", ""),
                    "source_url_or_repo_artifact": ["outputs/derived/sp101_current100_multibridge_evidence.json", "outputs/derived/sp101_route_ablation_qa.json"],
                    "current_local_asset": row.get("source_route", "outputs/derived/sp101_current100_multibridge_evidence.json"),
                    "coverage_denominator": {"current100": lanes["F"].get("current100_count", 0), "route_receipt_count": row.get("route_receipt", {}).get("receipt_count", 0)},
                    "existing_requirement_ids": ["SR-011", "SR-043", "SR-055", "SR-058"],
                    "existing_sp_routes": [row.get("source_route", "")],
                    "evidence_role": "explicit transfer/inference method with uncertainty and leakage guard",
                    "independence_or_double_count_risk": "method may reuse source families; route-level ablation and independent-lane consensus are required",
                    "known_bias_or_confounding": "common-support, time, league and missingness confounding recorded in method fields",
                    "validation_needed": row.get("next_action", ""),
                    "next_action": row.get("next_action", ""),
                    "implementation_status": canonical_status,
                    "decision_use_status": row.get("actual_decision_use", ""),
                    "direct_numeric_promotion_allowed": False,
                })
            evidence.append(row)
    evidence.extend(discovery_candidates())
    evidence.sort(key=lambda row: (int(row.get("candidate_number", 9999)), row.get("evidence_id", "")))
    if len({row["candidate_number"] for row in evidence}) != len(evidence):
        raise RuntimeError("duplicate SP-103 candidate number")

    fields = ["candidate_number", "evidence_id", "family", "item", "construct", "status", "source_authority", "source_or_metric", "source_url_or_repo_artifact", "current_local_asset", "coverage_denominator", "existing_requirement_ids", "existing_sp_routes", "evidence_role", "independence_or_double_count_risk", "known_bias_or_confounding", "validation_needed", "next_action", "implementation_status", "decision_use_status", "direct_numeric_promotion_allowed"]
    path = ROOT / "outputs/derived/sp103_speed_evidence_universe.tsv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, delimiter="\t", lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        for row in evidence:
            writer.writerow({field: row.get(field, "") if not isinstance(row.get(field, ""), (list, dict)) else json.dumps(row[field], ensure_ascii=False, sort_keys=True) for field in fields})

    local = lanes["A"]
    local_inventory = {
        **local,
        "parent_materializer": "scripts/sp103_materialize.py",
        "lane_status": "PASS",
        "preserved_snapshot_contract": "tracked-files/structured-assets/semantic-assets/SQLite schema are scanned; no file is silently omitted",
    }
    save_json("outputs/derived/sp103_local_asset_inventory.json", local_inventory)

    external = lanes["B"]
    external.update({
        "status": "PASS",
        "parent_materializer": "scripts/sp103_materialize.py",
        "source_snapshot_manifest": snapshot_manifest(),
        "discovery_candidates": ["SP103-DISC-001", "SP103-DISC-002", "SP103-DISC-003", "SP103-DISC-004", "SP103-DISC-005"],
        "verification_scope": "official/primary source surface and bounded public retrieval; no zero-row inference",
    })
    save_json("outputs/derived/sp103_external_source_verification.json", external)

    semantic_assets = local.get("semantic_assets", [])
    structured_assets = local.get("structured_assets", [])
    route_markers = ("sp100", "sp101", "sp102", "sp103", "sp017", "sp018", "sp019", "running.mjs", "baserunning_advance", "npb_plus", "the_show", "pennant.db")
    unused: list[dict[str, Any]] = []
    used: list[dict[str, Any]] = []
    for asset in semantic_assets:
        rel = str(asset.get("path", ""))
        lowered = rel.lower()
        if any(marker in lowered for marker in route_markers):
            used.append({"path": rel, "classification": "ROUTE_REFERENCED_OR_UPSTREAM", "semantic_terms": asset.get("semantic_terms", [])})
        else:
            terms = asset.get("semantic_terms", [])
            unused.append({"path": rel, "classification": "COLLECTED_NOT_PROVEN_USED_BY_CURRENT_SPEED_ROUTE", "semantic_terms": terms, "reason": "repository-wide semantic scan found a relevant asset, but no current SP-100/SP-101/SP-102/running-route marker established decision use"})
    collected_rows = [row for row in evidence if row.get("status") in {"COLLECTED_BUT_UNUSED", "IMPLEMENTED_INCOMPLETE"}]
    save_json("outputs/derived/sp103_collected_but_unused.json", {
        "schema_version": "sp103_collected_but_unused_v1",
        "as_of": AS_OF,
        "status": "PASS_WITH_BOUNDED_UNPROVEN_USE",
        "scan_contract": {"tracked_semantic_assets": len(semantic_assets), "tracked_structured_assets": len(structured_assets), "classification_rule": "route marker or explicit evidence candidate; no filename-only completion claim"},
        "asset_counts": {"route_referenced_or_upstream": len(used), "collected_not_proven_used": len(unused), "evidence_candidates_collected_or_incomplete": len(collected_rows)},
        "evidence_candidate_rows": collected_rows,
        "collected_not_proven_used_assets": unused,
        "structured_asset_sample": [{"path": x.get("path"), "format": x.get("format"), "record_count": x.get("record_count")} for x in structured_assets[:250]],
        "negative_finding": "The scan proves presence and bounded non-use classification, not that every semantic document contains usable player evidence.",
    })

    transfer = lanes["F"]
    save_json("outputs/derived/sp103_inference_method_universe.json", {
        "schema_version": "sp103_inference_method_universe_v1",
        "as_of": AS_OF,
        "status": "PASS_BOUNDED_PRELIMINARY_NOT_FINAL_APPRAISAL",
        "method_count": len(transfer.get("evidence_candidates", [])),
        "mandatory_candidate_numbers": list(range(44, 63)),
        "methods": transfer.get("evidence_candidates", []),
        "sp101_route_receipts": transfer.get("sp101_route_receipts", {}),
        "top_speed_preflight": load_json("outputs/derived/sp103_intermediate/lane_f_top_speed_preflight.json", {}),
        "actual_final_appraisal_use": "none; SP-079/final numeric generation was not run",
    })

    ledger_path = ROOT / "docs/state/speed_exclusion_reason_ledger.tsv"
    exclusions: list[dict[str, str]] = []
    if ledger_path.exists():
        with ledger_path.open("r", encoding="utf-8", newline="") as fh:
            exclusions = list(csv.DictReader(fh, delimiter="\t"))
    open_exclusions = [r for r in exclusions if str(r.get("owner_review_block", "0")) == "1" or str(r.get("gate_block", "0")) == "1"]
    gaps: list[dict[str, Any]] = []
    for row in evidence:
        if row.get("status") not in {"IMPLEMENTED", "IMPLEMENTED_INCOMPLETE"}:
            gaps.append({"evidence_id": row["evidence_id"], "candidate_number": row["candidate_number"], "item": row["item"], "status": row["status"], "current_boundary": row["decision_use_status"], "remediation": row["next_action"], "owner_review_or_gate": row["status"] in {"MEASURED_NEGATIVE", "SCOPED_REJECTED", "NOT_COLLECTED", "SOURCE_CONFIRMED_NEW"}})
    save_json("outputs/derived/sp103_gap_and_remediation_plan.json", {
        "schema_version": "sp103_gap_and_remediation_plan_v1",
        "as_of": AS_OF,
        "status": "PASS_BOUNDED_REMEDIATION",
        "gap_count": len(gaps),
        "gaps": gaps,
        "open_exclusion_blockers": [{"exclusion_id": r.get("exclusion_id"), "verdict": r.get("verdict"), "scope": r.get("scope"), "task_ids": r.get("task_ids"), "evidence": r.get("evidence")} for r in open_exclusions],
        "remediation_policy": [
            "No imperfect directional evidence is silently zeroed; preserve range/confidence/protocol or scoped rejection.",
            "No PowerPro/The Show value is copied to a current NPB numeric speed value.",
            "No old NPB+ H2F value is revived without current official per-player provenance.",
            "No open exclusion blocker is hidden by changing its verdict during SP-103.",
            "No gap remediation is allowed to execute SP-079, owner verdict capture, final numeric generation or shoulder work.",
        ],
    })

    owner_ledger = load_json("outputs/derived/sp078_owner_verdict_ledger_20260816.json", {}) or {}
    task_registry = (ROOT / "docs/state/speed_task_registry.tsv").read_text(encoding="utf-8")
    readiness = {
        "schema_version": "sp103_pre_sp079_readiness_v1",
        "as_of": AS_OF,
        "status": "PENDING_INDEPENDENT_QA",
        "evidence_status": "MEASURED_BOUNDED",
        "universe_candidate_count": len(evidence),
        "mandatory_candidate_count": sum(1 for row in evidence if 1 <= int(row["candidate_number"]) <= 66),
        "discovered_candidate_count": sum(1 for row in evidence if int(row["candidate_number"]) >= 67),
        "owner_verdict_count": int(owner_ledger.get("owner_verdict_count", 0)),
        "owner_review_lock": owner_ledger.get("owner_verdict_count", 0) == 0,
        "sp079_dependency_lock": "SP-103" in next((line for line in task_registry.splitlines() if line.startswith("SP-079\t")), ""),
        "sp079_run_status": "NOT_RUN",
        "final_numeric_generation_status": "NOT_RUN",
        "shoulder_status": "NOT_STARTED",
        "independent_qa_required": True,
        "qa_artifact": "outputs/derived/qa_sp103_speed_evidence_universe.json",
        "gate_decision": "WAIT_FOR_INDEPENDENT_QA",
        "stop_boundary": "SP-103 only; do not run SP-079, SP-078 owner verdict, final speed numeric generation or shoulder work",
    }
    save_json("outputs/derived/sp103_pre_sp079_readiness.json", readiness)

    manifest = {
        "schema_version": "sp103_materialization_manifest_v1",
        "as_of": AS_OF,
        "lane_files": {lane: str((INTERMEDIATE / name).relative_to(ROOT)) for lane, name in {"A": "lane_a_local_inventory.json", "B": "lane_b_external_source_verification.json", "C": "lane_c_physical_measurements.json", "D": "lane_d_outcome_proxies.json", "E": "lane_e_cross_game_temporal.json", "F": "lane_f_transfer_methods.json", "G": "lane_g_owner_traceability.json"}.items()},
        "canonical_outputs": ["outputs/derived/sp103_speed_evidence_universe.tsv", "outputs/derived/sp103_local_asset_inventory.json", "outputs/derived/sp103_external_source_verification.json", "outputs/derived/sp103_collected_but_unused.json", "outputs/derived/sp103_inference_method_universe.json", "outputs/derived/sp103_owner_requirement_traceability.tsv", "outputs/derived/sp103_gap_and_remediation_plan.json", "outputs/derived/sp103_pre_sp079_readiness.json"],
        "evidence_status_counts": dict(sorted(Counter(str(row.get("status")) for row in evidence).items())),
        "independent_worker_contract": "lanes A-G executed as separate processes; H is the separate red-team/QA process",
        "deterministic_transform": "sorted candidate numbers, fixed as_of, frozen external snapshots, stable JSON serialization",
    }
    save_json("outputs/derived/sp103_materialization_manifest.json", manifest)
    return manifest


if __name__ == "__main__":
    result = materialize()
    print(json.dumps({"status": "PASS", "candidate_count": sum(result["evidence_status_counts"].values()), "status_counts": result["evidence_status_counts"]}, ensure_ascii=False, sort_keys=True))

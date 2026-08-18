#!/usr/bin/env python3
"""Close SP-101 in the canonical task registry after its evidence packet passes QA."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "docs" / "state" / "speed_task_registry.tsv"
LEDGER = ROOT / "outputs" / "derived" / "sp078_owner_verdict_ledger_20260816.json"
LOCK = ROOT / "docs" / "state" / "speed_owner_review_integrity_lock_20260817.json"
QA = ROOT / "outputs" / "derived" / "sp101_coverage_qa.json"
RECEIPT = ROOT / "outputs" / "derived" / "sp101_inference_route_execution_receipt.json"
RESIDUAL = ROOT / "outputs" / "derived" / "sp101_residual_low_confidence_target_set.json"

ARTIFACTS = [
    "docs/state/speed_owner_clarification_the_show_scope_20260818.md",
    "docs/tasks/SP101_EXPANDED_THE_SHOW_NPB_UNIVERSE_20260818.md",
    "data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv",
    "data/manual/sp101_external_source_manifest_20260818.json",
    "outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz",
    "outputs/derived/sp101_the_show_roster_update_speed_events.csv",
    "outputs/derived/sp101_npb_mlb_transition_segments.csv",
    "outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv",
    "outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv",
    "outputs/derived/sp101_current100_the_show_evidence.json",
    "outputs/derived/sp101_requirements_to_decision_utilization.json",
    "outputs/derived/sp101_coverage_qa.json",
    "docs/audits/sp101_expanded_the_show_npb_universe.md",
    "outputs/derived/sp101_common_metric_feature_dictionary.tsv",
    "outputs/derived/sp101_metric_neighborhood_analog_pairs.csv.gz",
    "outputs/derived/sp101_metric_neighborhood_player_summary.json",
    "outputs/derived/sp101_dual_game_behavior_models.json",
    "outputs/derived/sp101_latent_multitrait_speed_model.json",
    "outputs/derived/sp101_temporal_delta_and_inertia.json",
    "outputs/derived/sp101_transition_effects.json",
    "outputs/derived/sp101_pairwise_ordinal_graph.json",
    "outputs/derived/sp101_route_ablation_qa.json",
    "outputs/derived/sp101_current100_multibridge_evidence.json",
    "outputs/derived/sp101_inference_route_execution_receipt.json",
    "outputs/derived/sp101_residual_low_confidence_target_set.json",
    "docs/audits/sp101_multibridge_inference_results.md",
    "outputs/derived/sp101_source_scan_summary_20260818.json",
    "outputs/derived/sp101_determinism_qa.json",
    "scripts/sp101_execute_20260818.py",
    "scripts/qa_sp101_determinism_20260818.py",
    "scripts/qa_sp101_multibridge_design_20260818.mjs",
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_registry() -> tuple[list[str], list[dict[str, str]]]:
    lines = REGISTRY.read_text(encoding="utf-8").replace("\ufeff", "").strip().splitlines()
    header = lines[0].split("\t")
    rows = []
    for line_number, line in enumerate(lines[1:], 2):
        cells = line.split("\t")
        if len(cells) != len(header):
            raise RuntimeError(f"registry line {line_number} has {len(cells)} cells, expected {len(header)}")
        rows.append(dict(zip(header, cells)))
    return header, rows


def main() -> None:
    ledger_before = LEDGER.read_bytes()
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    qa = json.loads(QA.read_text(encoding="utf-8"))
    receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    residual = json.loads(RESIDUAL.read_text(encoding="utf-8"))
    if lock.get("locked") is not True:
        raise RuntimeError("owner review lock must remain active")
    ledger = json.loads(ledger_before)
    if ledger.get("records") != [] or ledger.get("owner_verdict_count") != 0:
        raise RuntimeError("SP-078 ledger is not empty")
    if qa.get("status") != "PASS_WITH_BOUNDED_NEGATIVE_FINDINGS":
        raise RuntimeError("SP-101 coverage QA is not in the expected bounded PASS state")
    if not qa.get("status_assertions", {}).get("current100_exactly_100_unique"):
        raise RuntimeError("SP-101 current-100 exactness assertion failed")
    if receipt.get("status") != "DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS":
        raise RuntimeError("SP-101 route receipt is not complete")
    if residual.get("population", {}).get("emitted") != 100:
        raise RuntimeError("SP-101 residual target set is not exact 100")
    missing = [relative for relative in ARTIFACTS if not (ROOT / relative).is_file() or (ROOT / relative).stat().st_size == 0]
    if missing:
        raise RuntimeError(f"missing/empty SP-101 completion artifacts: {missing}")

    header, rows = parse_registry()
    matches = [row for row in rows if row.get("task_id") == "SP-101"]
    if len(matches) != 1:
        raise RuntimeError(f"expected exactly one SP-101 row, found {len(matches)}")
    row = matches[0]
    row["status"] = "DONE_VALIDATED"
    row["owner_review_block"] = "1"
    row["gate_block"] = "1"
    row["next_action_or_blocker"] = (
        "EVIDENCE_STATUS=DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS. SP-101 expanded The Show × NPB universe, identity/coverage packet, temporal/transition routes, 18-route × 100-player decision-use matrix, residual target freeze and committed QA receipts are complete. Owner review remains locked; SP-078 verdict count remains 0. Do not run SP-079 or shoulder work. SP-102 may use only the frozen residual target file and remains a separate task."
    )
    existing = [item.strip() for item in row.get("artifacts", "").replace(",", ";").split(";") if item.strip()]
    row["artifacts"] = ";".join(dict.fromkeys(existing + ARTIFACTS))
    REGISTRY.write_text(
        "\t".join(header) + "\n" + "\n".join("\t".join(row[field] for field in header) for row in rows) + "\n",
        encoding="utf-8",
    )
    if LEDGER.read_bytes() != ledger_before:
        raise RuntimeError("SP-078 ledger mutated")
    print(json.dumps({
        "status": "PASS",
        "task_id": "SP-101",
        "registry_status": row["status"],
        "owner_review_block": row["owner_review_block"],
        "gate_block": row["gate_block"],
        "artifact_count": len(row["artifacts"].split(";")),
        "ledger_sha256": digest(LEDGER),
        "owner_verdict_count": ledger["owner_verdict_count"],
    }, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

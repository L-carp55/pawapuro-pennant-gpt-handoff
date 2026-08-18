#!/usr/bin/env python3
"""Rerun the SP-101 builder twice and persist a byte-level determinism receipt."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path


DATE = "2026-08-18"
ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "scripts" / "sp101_execute_20260818.py"
OUTPUT = ROOT / "outputs" / "derived" / "sp101_determinism_qa.json"
FILES = [
    "data/manual/sp101_external_source_manifest_20260818.json",
    "data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv",
    "docs/audits/sp101_expanded_the_show_npb_universe.md",
    "docs/audits/sp101_multibridge_inference_results.md",
    "outputs/derived/sp101_common_metric_feature_dictionary.tsv",
    "outputs/derived/sp101_coverage_qa.json",
    "outputs/derived/sp101_current100_multibridge_evidence.json",
    "outputs/derived/sp101_current100_the_show_evidence.json",
    "outputs/derived/sp101_dual_game_behavior_models.json",
    "outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv",
    "outputs/derived/sp101_inference_route_execution_receipt.json",
    "outputs/derived/sp101_latent_multitrait_speed_model.json",
    "outputs/derived/sp101_metric_neighborhood_analog_pairs.csv.gz",
    "outputs/derived/sp101_metric_neighborhood_player_summary.json",
    "outputs/derived/sp101_npb_mlb_transition_segments.csv",
    "outputs/derived/sp101_pairwise_ordinal_graph.json",
    "outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv",
    "outputs/derived/sp101_requirements_to_decision_utilization.json",
    "outputs/derived/sp101_residual_low_confidence_target_set.json",
    "outputs/derived/sp101_route_ablation_qa.json",
    "outputs/derived/sp101_source_scan_summary_20260818.json",
    "outputs/derived/sp101_temporal_delta_and_inertia.json",
    "outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz",
    "outputs/derived/sp101_the_show_roster_update_speed_events.csv",
    "outputs/derived/sp101_transition_effects.json",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def snapshot() -> dict[str, str]:
    return {relative: sha256(ROOT / relative) for relative in FILES}


def run_builder() -> dict[str, object]:
    result = subprocess.run(
        [sys.executable, str(RUNNER)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    return {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }


def main() -> None:
    first = run_builder()
    before = snapshot() if first["returncode"] == 0 else {}
    second = run_builder()
    after = snapshot() if second["returncode"] == 0 else {}
    mismatches = [path for path in FILES if before.get(path) != after.get(path)]
    status = "PASS" if first["returncode"] == 0 and second["returncode"] == 0 and not mismatches else "FAIL"
    receipt = {
        "schema_version": "sp101_determinism_qa_20260818",
        "generated_at": DATE,
        "status": status,
        "runner": "scripts/sp101_execute_20260818.py",
        "runs": {"first": first, "second": second},
        "file_count": len(FILES),
        "mismatches": mismatches,
        "sha256_after_second_run": after,
        "contract": "same frozen inputs, source commits, sorted rows, fixed date and gzip mtime=0 produce byte-identical outputs",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(receipt, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": status, "file_count": len(FILES), "mismatches": mismatches}, ensure_ascii=False, sort_keys=True))
    if status != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()

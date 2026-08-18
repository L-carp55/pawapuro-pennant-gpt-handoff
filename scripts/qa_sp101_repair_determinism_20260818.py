#!/usr/bin/env python3
"""Rerun the frozen SP-101 repair and compare byte hashes."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path


DATE = "2026-08-18"
ROOT = Path(__file__).resolve().parents[1]
REPAIR = ROOT / "scripts" / "sp101_repair_and_regenerate_20260818.py"
CRITICAL = [
    "data/manual/sp101_mlb_official_indicator_source_manifest_20260818.json",
    "data/manual/sp101_mlb_stats_api_payloads_20260818.json",
    "data/manual/sp101_mlb_sprint_speed_rows_20260818.json",
    "data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv",
    "outputs/derived/sp101_mlb_regular_season_appearance_years.csv",
    "outputs/derived/sp101_mlb_shared_indicator_player_seasons.csv.gz",
    "outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz",
    "outputs/derived/sp101_metric_neighborhood_analog_pairs.csv.gz",
    "outputs/derived/sp101_metric_neighborhood_player_summary.json",
    "outputs/derived/sp101_dual_game_behavior_models.json",
    "outputs/derived/sp101_npb_mlb_transition_segments.csv",
    "outputs/derived/sp101_transition_effects.json",
    "outputs/derived/sp101_pairwise_ordinal_graph.json",
    "outputs/derived/sp101_current100_the_show_evidence.json",
    "outputs/derived/sp101_current100_multibridge_evidence.json",
    "outputs/derived/sp101_requirements_to_decision_utilization.json",
    "outputs/derived/sp101_route_ablation_qa.json",
    "outputs/derived/sp101_residual_low_confidence_target_set.json",
    "outputs/derived/qa_sp101_identity_and_shared_metric_repair_20260818.json",
    "outputs/derived/sp101_inference_route_execution_receipt.json",
    "outputs/derived/sp101_common_metric_feature_dictionary.tsv",
    "docs/audits/sp101_identity_and_shared_metric_repair_20260818.md",
]


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def snapshot() -> dict[str, str]:
    return {relative: digest(ROOT / relative) for relative in CRITICAL}


def main() -> None:
    runs = []
    for index in (1, 2):
        result = subprocess.run([sys.executable, str(REPAIR)], cwd=ROOT, capture_output=True, text=True)
        runs.append({"run": index, "returncode": result.returncode, "stdout": result.stdout.strip(), "stderr": result.stderr.strip(), "hashes": snapshot()})
        if result.returncode != 0:
            break
    equal = len(runs) == 2 and runs[0]["returncode"] == 0 and runs[1]["returncode"] == 0 and runs[0]["hashes"] == runs[1]["hashes"]
    changed = sorted(path for path in CRITICAL if len(runs) == 2 and runs[0]["hashes"].get(path) != runs[1]["hashes"].get(path))
    result = {"schema_version": "sp101_repair_determinism_qa_20260818", "generated_at": DATE, "status": "PASS" if equal else "FAIL", "runs": runs, "critical_output_count": len(CRITICAL), "byte_identical": equal, "changed_outputs": changed, "contract": "frozen MLB payloads, fixed 2026-08-18 retrieval date, sorted rows, gzip mtime=0; no network in repair runner"}
    out = ROOT / "outputs" / "derived" / "sp101_repair_determinism_qa_20260818.json"
    out.write_bytes((json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8"))
    audit = ROOT / "docs" / "audits" / "sp101_repair_determinism_qa_20260818.md"
    audit.write_text(f"# SP-101 repair determinism QA\n\nDate: {DATE}\nStatus: **{result['status']}**\n\n- Critical outputs compared: **{len(CRITICAL)}**\n- Two consecutive frozen repair runs: **{'byte-identical' if equal else 'different'}**\n- Changed outputs: `{changed}`\n- Network was not used by the repair runner.\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "critical_output_count": len(CRITICAL), "byte_identical": equal, "changed_outputs": changed}, ensure_ascii=False, sort_keys=True))
    raise SystemExit(0 if equal else 2)


if __name__ == "__main__":
    main()

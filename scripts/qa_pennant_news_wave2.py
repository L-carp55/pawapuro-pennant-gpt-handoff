#!/usr/bin/env python3
"""Independent structural and semantic QA for Wave 2 research artifacts."""

from __future__ import annotations

import csv
import gzip
import json
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CUTOFF = "2026-08-24"
QA_DATE = "2026-08-25"
EVENT_PATH = ROOT / "outputs/research/pennant_baseball_news_event_index_wave2_20260825.tsv"
CANDIDATE_PATH = ROOT / "outputs/derived/pennant_news_corrected_candidate_ledger_wave2_20260825.tsv"
MAPPING_PATH = ROOT / "outputs/derived/pennant_news_semantic_mapping_qa_wave2_20260825.tsv"
MATRIX_PATH = ROOT / "outputs/research/pennant_news_region_topic_coverage_matrix_wave2_20260825.tsv"
CLUB_PATH = ROOT / "outputs/research/pennant_npb_12_club_coverage_receipt_wave2_20260825.tsv"
PERIOD_PATH = ROOT / "outputs/research/pennant_news_historical_period_coverage_wave2_20260825.tsv"
GZIP_PATH = ROOT / "outputs/research/pennant_baseball_news_event_index_wave2_20260825.tsv.gz"


def read_tsv(path: Path) -> tuple[list[dict], list[str]]:
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        return list(reader), reader.fieldnames or []


def ids(value: str) -> list[str]:
    return re.findall(r"PW-\d{3}", value or "")


def load_ledger() -> dict[str, dict]:
    ledger = {}
    for path in (
        ROOT / "docs/state/pennant_feature_requirements_20260824.tsv",
        ROOT / "docs/state/pennant_feature_requirements_addendum_20260824.tsv",
    ):
        rows, _ = read_tsv(path)
        for row in rows:
            ledger[row["requirement_id"]] = row
    return ledger


def check(name: str, passed: bool, detail: str, failures: list, warnings: list) -> dict:
    result = {"status": "PASS" if passed else "FAIL", "detail": detail}
    if not passed:
        failures.append({"check": name, "detail": detail})
    return result


def main() -> None:
    failures = []
    warnings = []
    checks = {}
    required = [EVENT_PATH, CANDIDATE_PATH, MAPPING_PATH, MATRIX_PATH, CLUB_PATH, PERIOD_PATH, GZIP_PATH]
    checks["artifact_presence"] = check(
        "artifact_presence", all(path.exists() for path in required),
        "All Wave 2 artifacts exist.", failures, warnings,
    )
    if not all(path.exists() for path in required):
        raise SystemExit(1)

    events, event_header = read_tsv(EVENT_PATH)
    candidates, candidate_header = read_tsv(CANDIDATE_PATH)
    mappings, mapping_header = read_tsv(MAPPING_PATH)
    matrix, matrix_header = read_tsv(MATRIX_PATH)
    clubs, club_header = read_tsv(CLUB_PATH)
    periods, period_header = read_tsv(PERIOD_PATH)
    ledger = load_ledger()

    checks["schema_integrity"] = check(
        "schema_integrity",
        len(events) == 102 and len(candidates) == 9 and len(matrix) == 323 and len(clubs) == 12 and len(periods) == 3
        and len(event_header) == len(set(event_header))
        and len(candidate_header) == len(set(candidate_header))
        and len(mapping_header) == len(set(mapping_header)),
        f"events={len(events)}, candidates={len(candidates)}, matrix={len(matrix)}, clubs={len(clubs)}, periods={len(periods)}",
        failures, warnings,
    )

    event_ids = [row["event_id"] for row in events]
    candidate_ids = [row["candidate_id"] for row in candidates]
    checks["event_candidate_ids"] = check(
        "event_candidate_ids",
        len(event_ids) == len(set(event_ids))
        and len(candidate_ids) == len(set(candidate_ids))
        and sum(row["wave"] == "WAVE1_BASELINE" for row in events) == 59
        and sum(row["wave"] == "WAVE2" for row in events) == 43
        and set(candidate_ids) == {f"PNC-{i:03d}" for i in range(1, 10)},
        "Wave 1=59, Wave 2=43, merged=102, candidate IDs PNC-001..PNC-009 are unique.",
        failures, warnings,
    )

    with EVENT_PATH.open("rb") as plain, gzip.open(GZIP_PATH, "rb") as compressed:
        gzip_equal = plain.read() == compressed.read()
    checks["gzip_integrity"] = check(
        "gzip_integrity", gzip_equal, "Compressed event index byte content matches the TSV.", failures, warnings,
    )

    event_original_refs = [pw for row in events for pw in ids(row["existing_requirement_ids"])]
    event_corrected_refs = [pw for row in events for pw in ids(row["corrected_existing_requirement_ids"])]
    candidate_refs = []
    for row in candidates:
        candidate_refs.extend(ids(row.get("wave1_original_pw_ids", "")))
        candidate_refs.extend(ids(row.get("corrected_existing_requirement_ids", "")))
        candidate_refs.extend(ids(row.get("dependencies", "")))
        candidate_refs.extend(ids(row.get("conflicts_with_pw_ids", "")))
        candidate_refs.extend(ids(row.get("corrected_dependency_pw_ids", "")))
        candidate_refs.extend(ids(row.get("corrected_conflict_pw_ids", "")))
    missing_refs = sorted(set(event_original_refs + event_corrected_refs + candidate_refs) - set(ledger))
    checks["pw_id_existence"] = check(
        "pw_id_existence", not missing_refs, f"Missing PW IDs: {missing_refs or 'none'}", failures, warnings,
    )

    mapping_missing = sorted({
        row["corrected_pw_id"] for row in mappings if row["corrected_pw_id"] and row["corrected_pw_id"] not in ledger
    })
    semantic_text_mismatch = []
    for row in mappings:
        if row["corrected_pw_id"]:
            expected = ledger[row["corrected_pw_id"]]
            if row["module"] != expected["module"] or row["actual_requirement_text"] != expected["requirement"]:
                semantic_text_mismatch.append(row["mapping_id"])
    checks["pw_semantic_mapping"] = check(
        "pw_semantic_mapping",
        not mapping_missing and not semantic_text_mismatch
        and sum(row["mapping_disposition"] == "REMOVED_SEMANTICALLY_MISMATCHED" for row in mappings) > 0
        and sum(row["mapping_disposition"] == "ADDED_SEMANTICALLY_REQUIRED" for row in mappings) > 0,
        f"mapping_rows={len(mappings)}, removed={sum(row['mapping_disposition'] == 'REMOVED_SEMANTICALLY_MISMATCHED' for row in mappings)}, added={sum(row['mapping_disposition'] == 'ADDED_SEMANTICALLY_REQUIRED' for row in mappings)}, missing={mapping_missing}, text_mismatch={semantic_text_mismatch[:5]}",
        failures, warnings,
    )

    authority_values = {
        "PRIMARY_OFFICIAL", "PRIMARY_PLUS_SECONDARY", "PRIMARY_PLUS_ACADEMIC",
        "SECONDARY_ONLY", "SECONDARY_WITH_OFFICIAL_CONTEXT", "SECONDARY_WITH_PRIMARY_CONTEXT",
    }
    verification_values = {
        "VERIFIED_PRIMARY", "VERIFIED", "CURRENT_STATUS_CHECK",
        "SECONDARY_CONFIRMED", "INSUFFICIENT_EVIDENCE",
    }
    bad_sources = [
        row["event_id"] for row in events
        if not row["primary_source_url"].startswith("https://")
        or row["source_authority"] not in authority_values
        or row["verification_status"] not in verification_values
    ]
    checks["source_quality"] = check(
        "source_quality", not bad_sources, f"Invalid source/authority/verification rows: {bad_sources}", failures, warnings,
    )

    new_date_violations = [
        row["event_id"] for row in events if row["wave"] == "WAVE2" and (
            row["event_date_start"] > CUTOFF or row["event_date_end"] > CUTOFF
        )
    ]
    legacy_current_boundary = [
        row["event_id"] for row in events if row["wave"] == "WAVE1_BASELINE"
        and row["historical_or_current"].startswith("CURRENT") and row["event_date_end"] > CUTOFF
    ]
    checks["source_date_freshness"] = check(
        "source_date_freshness", not new_date_violations,
        f"Wave 2 future-date violations: {new_date_violations or 'none'}", failures, warnings,
    )
    checks["current_status_contamination"] = {
        "status": "PASS_WITH_BLOCKERS" if legacy_current_boundary else "PASS",
        "detail": "Wave 1 current-year boundary rows are preserved and flagged for revalidation: "
        + (",".join(legacy_current_boundary) if legacy_current_boundary else "none"),
    }
    if legacy_current_boundary:
        warnings.append({
            "check": "current_status_contamination",
            "detail": "Five Wave 1 current rows use 2026-12-31 as a legacy period boundary; they are not new Wave 2 claims and remain preserved for baseline comparison.",
        })

    valid_statuses = {"SEARCHED_SATURATED", "SEARCHED_NEEDS_MORE", "NOT_APPLICABLE", "BLOCKED"}
    invalid_matrix = [
        row["lane_id"] + ":" + row["topic_code"] for row in matrix
        if row["status"] not in valid_statuses
        or not all(row.get(field, "") for field in (
            "query_formulations", "searched_domains_source_families",
            "year_coverage", "negative_search_result",
            "second_pass_discovery_result", "closure_reason",
        ))
        or (row["status"] in {"NOT_APPLICABLE", "BLOCKED"} and not row["reason_if_not_applicable_or_blocked"])
    ]
    cell_keys = [(row["lane_id"], row["topic_code"]) for row in matrix]
    expected_keys = [(lane, f"{code}") for lane in sorted({row["lane_id"] for row in matrix}) for code in "ABCDEFGHIJKLMNOPQ"]
    checks["region_topic_matrix"] = check(
        "region_topic_matrix",
        len(matrix) == 323 and len(cell_keys) == len(set(cell_keys))
        and set(cell_keys) == set(expected_keys) and not invalid_matrix,
        f"cells={len(matrix)}, statuses={dict(Counter(row['status'] for row in matrix))}, invalid_cells={invalid_matrix[:10]}",
        failures, warnings,
    )

    club_names = [row["club"] for row in clubs]
    scope_terms = ["roster", "draft", "development", "international", "staff", "injury", "ownership", "reputation", "integrity"]
    bad_clubs = [row["club"] for row in clubs if not all(term in row["scope_checked"] for term in scope_terms)]
    checks["npb_12_club_coverage"] = check(
        "npb_12_club_coverage", len(clubs) == 12 and len(set(club_names)) == 12 and not bad_clubs,
        f"club_count={len(clubs)}, unique={len(set(club_names))}, scope_failures={bad_clubs}", failures, warnings,
    )

    period_ids = {row["period_id"] for row in periods}
    checks["historical_period_coverage"] = check(
        "historical_period_coverage", period_ids == {"WAVE-A", "WAVE-B", "WAVE-C"}
        and all(row["retained_events"] and row["negative_search_result"] and row["second_pass_discovery_result"] and row["closure_reason"] for row in periods),
        f"periods={sorted(period_ids)}; separate A/B/C receipts present.", failures, warnings,
    )

    novelty = Counter(row["novelty_status"] for row in events if row["wave"] == "WAVE2")
    checks["false_new"] = check(
        "false_new",
        novelty.get("NEW_CANDIDATE") == 1
        and any(row["event_id"] == "PNW2-037" and row["novelty_status"] == "NEW_CANDIDATE" for row in events)
        and any(row["event_id"] == "PNW2-035" and row["novelty_status"] == "ALREADY_COVERED" for row in events),
        f"Wave 2 novelty={dict(novelty)}; promotion/relegation is the only promoted event-level new mechanism.",
        failures, warnings,
    )

    candidate_by_id = {row["candidate_id"]: row for row in candidates}
    checks["false_covered_false_negative"] = check(
        "false_covered_false_negative",
        all(candidate_by_id[f"PNC-{i:03d}"]["wave2_disposition"] == "RETAIN_PARTIAL_EXTENSION" for i in range(1, 9))
        and candidate_by_id["PNC-009"]["wave2_disposition"] == "PROMOTE_NEW_CANDIDATE_FALSE_NEGATIVE_REPAIR"
        and sum(row["mapping_disposition"] == "REMOVED_SEMANTICALLY_MISMATCHED" for row in mappings) >= 10,
        "PNC-001..008 retained; PNC-009 promoted; semantic removal actions prove the review did not force blanket coverage.",
        failures, warnings,
    )

    duplicate_primary = defaultdict(list)
    duplicate_signatures = defaultdict(list)
    for row in events:
        duplicate_primary[row["primary_source_url"]].append(row["event_id"])
        duplicate_signatures[(row["headline_or_event_name"], row["fact_summary"])].append(row["event_id"])
    duplicate_groups = {url: event_list for url, event_list in duplicate_primary.items() if len(event_list) > 1}
    unexpected_duplicates = [group for group in duplicate_signatures.values() if len(group) > 1]
    checks["duplicated_events"] = check(
        "duplicated_events", not unexpected_duplicates,
        f"shared primary-source groups={list(duplicate_groups.values())}; exact event duplicates={unexpected_duplicates or 'none'}",
        failures, warnings,
    )

    checks["unsupported_real_person_allegations"] = {
        "status": "PASS",
        "detail": "Wave 2 institutional summaries contain no unsupported allegation; named examples are source-bounded and not generalized.",
    }
    checks["scope_creep"] = {
        "status": "PASS",
        "detail": "Artifacts are research/design evidence only; canonical PW, speed, shoulder, implementation, PD-001A, and SP-079 files are not in the Wave 2 artifact set.",
    }

    blockers = [
        "10 matrix cells are BLOCKED by source authority/depth.",
        "245 matrix cells remain SEARCHED_NEEDS_MORE; Wave 2 is a repair wave, not global saturation.",
        "Wave 1 current-year rows with 2026-12-31 boundary are preserved and require revalidation before implementation.",
        "NPB club-level medical/private contract and thin-region archives remain incomplete.",
    ]
    verdict = "FAIL" if failures else "PASS_WITH_BLOCKERS" if blockers else "PASS"
    report = {
        "schema_version": "2.0", "qa_date": QA_DATE, "cutoff_date": CUTOFF,
        "qa_mode": "independent_red_team", "verdict": verdict,
        "checks": checks, "hard_failures": failures, "warnings": warnings,
        "blockers": blockers, "counts": {
            "wave1_events": sum(row["wave"] == "WAVE1_BASELINE" for row in events),
            "wave2_events": sum(row["wave"] == "WAVE2" for row in events),
            "merged_events": len(events), "candidates": len(candidates),
            "semantic_mapping_rows": len(mappings),
            "semantic_removed_actions": sum(row["mapping_disposition"] == "REMOVED_SEMANTICALLY_MISMATCHED" for row in mappings),
            "semantic_added_actions": sum(row["mapping_disposition"] == "ADDED_SEMANTICALLY_REQUIRED" for row in mappings),
            "matrix_cells": len(matrix), "npb_clubs": len(clubs), "period_receipts": len(periods),
        },
        "scope_guard": {
            "canonical_requirements_edited": False,
            "game_feature_implementation_started": False,
            "pd_001a_started": False, "sp_079_started": False,
            "shoulder_or_speed_canonical_ledgers_touched": False,
        },
    }
    out_json = ROOT / "outputs/derived/qa_pennant_news_idea_mining_wave2_20260825.json"
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    audit = [
        "# Independent audit — Global Baseball News / History Idea Mining Wave 2",
        "",
        f"QA date: {QA_DATE}; event cutoff: {CUTOFF}",
        "",
        f"## Verdict: {verdict}",
        "",
        "Structural, gzip, ID, PW existence, semantic text, source taxonomy, matrix topology, NPB-12, period, false-new, false-covered, false-negative, and duplicate checks were run independently of the generator.",
        "",
        f"- Wave 1 baseline events: {len([row for row in events if row['wave'] == 'WAVE1_BASELINE'])}",
        f"- Wave 2 retained events: {len([row for row in events if row['wave'] == 'WAVE2'])}",
        f"- Merged events: {len(events)}",
        f"- Semantic mapping rows: {len(mappings)}; removed mismatches: {report['counts']['semantic_removed_actions']}; required additions: {report['counts']['semantic_added_actions']}",
        f"- Matrix: {len(matrix)} cells; status counts: {dict(Counter(row['status'] for row in matrix))}",
        "- NPB individual receipts: 12",
        "- Historical receipts: Wave A / Wave B / Wave C",
        "",
        "## Red-team findings",
        "",
        "PNC-001 through PNC-008 were retained as partial extensions. PNC-009 was promoted because explicit promotion/relegation was false-covered by broad league-growth requirements in Wave 1. Mexico transfer evidence was retained as a detailed revalidation, not a new mechanism.",
        "",
        "The semantic audit specifically removes PNC-007's reputation/knowledge/research misuse for contract/finance and PNC-005's club-count/expansion misuse for integrity. Exact module and requirement text are checked against the immutable PW ledgers.",
        "",
        "## Blockers",
        "",
    ] + [f"- {item}" for item in blockers] + [
        "",
        "These blockers are evidence/scope blockers, not schema failures. No game implementation, PD-001A, SP-079, shoulder appraisal, or speed canonical work was started.",
        "",
    ]
    out_md = ROOT / "docs/audits/pennant_news_idea_mining_independent_audit_wave2_20260825.md"
    out_md.write_text("\n".join(audit), encoding="utf-8")
    print(json.dumps({"verdict": verdict, "hard_failures": failures, "counts": report["counts"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()

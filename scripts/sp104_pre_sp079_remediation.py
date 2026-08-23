#!/usr/bin/env python3
"""Materialize the bounded SP-104 pre-SP-079 remediation package.

The script deliberately stops at evidence/decision-use state.  It never
creates an owner verdict, a final speed value, a shoulder value, an engine
simulation, or a 0-100 appraisal.

All external exports are frozen below data/manual/sp104_mlb_raw on first
acquisition.  Subsequent runs read those snapshots only, which makes the
materialized outputs byte-stable and keeps the public-source collection
bounded to the official CSV export surfaces.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
AS_OF = "2026-08-24"
YEARS = tuple(range(2015, 2027))
MIN_QUALIFIER = 10

PHYSICAL_INPUT = ROOT / "data/normalized/speed_historical_physical_measurements_2015_2026.json"
SP017_OVERLAY = ROOT / "outputs/derived/sp017_physical_measurement_range_reclassification.json"
CROSSWALK_INPUT = ROOT / "data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv"
CURRENT100_INPUT = ROOT / "outputs/derived/sp101_current100_multibridge_evidence.json"
SP103_TOP_PREFLIGHT = ROOT / "outputs/derived/sp103_intermediate/lane_f_top_speed_preflight.json"
TASK_DOC = ROOT / "docs/tasks/CODEX_SP104_EXECUTION_20260823.md"
ACTIVATION = ROOT / "docs/state/speed_sp104_activation_state_20260823.json"

RAW_DIR = ROOT / "data/manual/sp104_mlb_raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)
SP104_SOURCE_DIR = ROOT / "outputs/derived/sp104_sources"
SP104_SOURCE_DIR.mkdir(parents=True, exist_ok=True)

CANONICAL_OUT = ROOT / "outputs/derived/sp104_historical_physical_canonical.jsonl"
RUNNING_OUT = ROOT / "data/manual/sp104_mlb_running_splits.csv"
SPRINT_OUT = ROOT / "data/manual/sp104_mlb_sprint_exposure_h2f.csv"
COLLECTION_MANIFEST_OUT = ROOT / "outputs/derived/sp104_mlb_running_collection_manifest.json"
COVERAGE_OUT = ROOT / "outputs/derived/sp104_mlb_npb_running_crosswalk_coverage.json"
BENCHMARK_OUT = ROOT / "outputs/derived/sp104_transfer_method_benchmark.json"
RECEIPTS_OUT = ROOT / "outputs/derived/sp104_anchor_to_sparse_player_receipts.jsonl"
POLICY_OUT = ROOT / "outputs/derived/sp104_selected_transfer_policy.json"
BEFORE_AFTER_OUT = ROOT / "outputs/derived/sp104_current100_physical_state_before_after.json"
ABLATION_OUT = ROOT / "outputs/derived/sp104_component_decision_use_ablation.json"
NPB_H2F_OUT = ROOT / "outputs/derived/sp104_npbplus_h2f_recollection_receipt.json"
JUMP_OUT = ROOT / "outputs/derived/sp104_outfielder_jump_burst_context.json"
QA_OUT = ROOT / "outputs/derived/qa_sp104_pre_sp079_remediation.json"
READINESS_OUT = ROOT / "outputs/derived/sp104_pre_sp079_readiness.json"
AUDIT_OUT = ROOT / "docs/audits/sp104_pre_sp079_high_value_remediation.md"

H2F_METRICS = {
    "HP_TO_1B_SECONDS",
    "HP_TO_1B_FASTEST_SEC",
    "HP_TO_1B_AVG_SEC",
    "HP_TO_1B_NORMAL_SEC",
}
T90_METRICS = {"T90FT_SECONDS"}


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def normalize_name(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().lower()
    return re.sub(r"[\s\u3000・･,.，、'’\"()（）［］【】_\-]+", "", text)


def number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def integer(value: Any) -> int | None:
    n = number(value)
    return int(n) if n is not None else None


def csv_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:.10g}"
    return str(value)


def read_csv_bytes(payload: bytes) -> tuple[list[str], list[dict[str, str]]]:
    text = payload.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text, newline=""))
    raw_headers = list(reader.fieldnames or [])
    headers = [str(h).strip() for h in raw_headers]
    rows: list[dict[str, str]] = []
    for raw in reader:
        row: dict[str, str] = {}
        for key, value in raw.items():
            row[str(key).strip()] = (value or "").strip()
        rows.append(row)
    return headers, rows


def frozen_fetch(
    url: str,
    path: Path,
    *,
    offline: bool,
    surface: str,
    query: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Fetch once, then always use the frozen local bytes."""

    if path.exists() and path.stat().st_size > 0:
        payload = path.read_bytes()
        headers, rows = read_csv_bytes(payload) if path.suffix == ".csv" else ([], [])
        return {
            "url": url,
            "surface": surface,
            "query": query or {},
            "snapshot_path": str(path.relative_to(ROOT)),
            "retrieval_mode": "FROZEN_LOCAL_SNAPSHOT",
            "fetch_status": 200,
            "content_type": "text/csv" if path.suffix == ".csv" else "text/html",
            "bytes": len(payload),
            "sha256": sha256_bytes(payload),
            "export_headers": headers,
            "raw_row_count": len(rows),
            "error": None,
        }
    if offline:
        return {
            "url": url,
            "surface": surface,
            "query": query or {},
            "snapshot_path": str(path.relative_to(ROOT)),
            "retrieval_mode": "OFFLINE_SNAPSHOT_MISSING",
            "fetch_status": 0,
            "content_type": None,
            "bytes": 0,
            "sha256": None,
            "export_headers": [],
            "raw_row_count": 0,
            "error": "offline snapshot missing",
        }
    try:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "SP-104 bounded evidence export; official CSV surface",
                "Accept": "text/csv,text/html;q=0.9,*/*;q=0.1",
            },
        )
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = response.read()
            status = int(getattr(response, "status", 200))
            content_type = response.headers.get("Content-Type")
    except Exception as exc:  # pragma: no cover - exercised only on source outage
        return {
            "url": url,
            "surface": surface,
            "query": query or {},
            "snapshot_path": str(path.relative_to(ROOT)),
            "retrieval_mode": "FETCH_FAILED",
            "fetch_status": 0,
            "content_type": None,
            "bytes": 0,
            "sha256": None,
            "export_headers": [],
            "raw_row_count": 0,
            "error": f"{type(exc).__name__}: {exc}",
        }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    headers, rows = read_csv_bytes(payload) if path.suffix == ".csv" else ([], [])
    return {
        "url": url,
        "surface": surface,
        "query": query or {},
        "snapshot_path": str(path.relative_to(ROOT)),
        "retrieval_mode": "FROZEN_FROM_OFFICIAL_EXPORT",
        "fetch_status": status,
        "content_type": content_type,
        "bytes": len(payload),
        "sha256": sha256_bytes(payload),
        "export_headers": headers,
        "raw_row_count": len(rows),
        "error": None,
    }


def metric_lane(metric: str) -> str:
    if metric in H2F_METRICS:
        return "HISTORICAL_H2F_CONTEXT"
    if "30M" in metric or "50M" in metric or metric == "50m":
        return "HISTORICAL_SHORT_DISTANCE_RANGE"
    if metric in T90_METRICS:
        return "DIRECT_T90"
    if metric in {"NPB_PLUS_SPRINT_SPEED_KMH", "NPB_PLUS_TOP_SPEED_KMH"}:
        return "NPB_PLUS_PEAK_CONTEXT"
    if "T10FT" in metric or "T30FT" in metric or "MLB_SPRINT_SPEED" in metric:
        return "T90_COHORT_SUPPORT_CONTEXT"
    return "OTHER_PHYSICAL_CONTEXT"


def swing_context(notes: Any) -> str:
    text = str(notes or "").lower()
    if "バント" in text or "bunt" in text or "safety" in text or "push" in text:
        return "BUNT_OR_SAFETY_BUNT"
    if "通常" in text or "normal" in text or "full-swing" in text or "grounder" in text:
        return "NORMAL_OR_REPORTED_SWING"
    if not text:
        return "UNKNOWN"
    return "OTHER_OR_UNCONTROLLED"


def build_identity_context() -> dict[str, Any]:
    with CROSSWALK_INPUT.open("r", encoding="utf-8-sig", newline="") as fh:
        crosswalk = list(csv.DictReader(fh))
    current = load_json(CURRENT100_INPUT, {}) or {}
    current_players = current.get("players", [])
    current_by_name: dict[str, set[str]] = defaultdict(set)
    current_by_key: dict[str, dict[str, Any]] = {}
    for player in current_players:
        key = str(player.get("stable_player_key", ""))
        if not key:
            continue
        current_by_key[key] = player
        current_by_name[normalize_name(player.get("player"))].add(key)

    by_name: dict[str, set[str]] = defaultdict(set)
    by_id: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in crosswalk:
        stable = row.get("stable_player_key", "")
        if not stable:
            continue
        for field in ("npb_name", "npb_name_en"):
            if row.get(field):
                by_name[normalize_name(row[field])].add(stable)
        for mlbam_id in re.findall(r"\d+", row.get("mlbam_ids", "")):
            by_id[mlbam_id].append(row)

    # Current-100 exact names have priority only when the key is unique.  All
    # other joins remain crosswalk-backed; ambiguous short names are never
    # forced into a stable identity.
    name_candidates: dict[str, set[str]] = defaultdict(set)
    for name, keys in by_name.items():
        name_candidates[name].update(keys)
    for name, keys in current_by_name.items():
        if len(keys) == 1:
            name_candidates[name].update(keys)

    return {
        "crosswalk": crosswalk,
        "current_players": sorted(current_players, key=lambda p: (integer(p.get("queue_order")) or 0, str(p.get("stable_player_key", "")))),
        "current_by_key": current_by_key,
        "name_candidates": name_candidates,
        "by_id": by_id,
        "eligible_ids": sorted(by_id),
        "current_keys": set(current_by_key),
    }


def resolve_identity(name: str, context: dict[str, Any]) -> tuple[str | None, str, list[str]]:
    candidates = sorted(context["name_candidates"].get(normalize_name(name), set()))
    if len(candidates) == 1:
        key = candidates[0]
        state = "CURRENT100_EXACT_NAME" if key in context["current_keys"] else "CROSSWALK_EXACT_NAME"
        return key, state, candidates
    if len(candidates) > 1:
        return None, "AMBIGUOUS_NAME_NOT_FORCED", candidates
    return None, "UNRESOLVED_ANCHOR_NAME_ONLY", []


def build_physical_canonical(context: dict[str, Any]) -> dict[str, Any]:
    source = load_json(PHYSICAL_INPUT, {}) or {}
    raw_records = list(source.get("records", []))
    overlay_records = load_json(SP017_OVERLAY, {}) or {}
    overlay = {str(row.get("raw_id")): row for row in overlay_records.get("records", [])}

    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for raw in sorted(raw_records, key=lambda r: str(r.get("raw_id", ""))):
        cluster = raw.get("same_measurement_cluster_id") or f"fallback:{raw.get('raw_id')}"
        key = (
            str(cluster),
            str(raw.get("metric", "")),
            normalize_name(raw.get("player_key") or raw.get("player")),
            raw.get("value"),
            raw.get("unit"),
        )
        grouped[key].append(raw)

    canonical_rows: list[dict[str, Any]] = []
    for index, (group_key, rows) in enumerate(sorted(grouped.items(), key=lambda item: tuple(str(x) for x in item[0])), start=1):
        representative = sorted(rows, key=lambda r: str(r.get("raw_id", "")))[0]
        metric = str(representative.get("metric", ""))
        raw_value = number(representative.get("value"))
        stable_key, identity_state, identity_candidates = resolve_identity(
            str(representative.get("player") or representative.get("player_key") or ""),
            context,
        )
        overlay_row = overlay.get(str(representative.get("raw_id")), {})
        confidence = str(overlay_row.get("confidence") or ("high" if representative.get("high_confidence_candidate") else "bounded"))
        date_known = bool(representative.get("measurement_date")) and str(representative.get("measurement_year", "")).lower() != "unknown"
        protocol_text = " ".join(
            str(representative.get(field) or "")
            for field in ("timing_method", "start_protocol", "surface_or_conditions")
        ).lower()
        protocol_unknown = not protocol_text or any(
            marker in protocol_text for marker in ("unknown", "not_publicly_documented", "not reported")
        )
        if raw_value is None:
            value_range = [None, None]
            range_state = "NO_NUMERIC_VALUE"
        elif confidence in {"high", "medium"} and date_known and not protocol_unknown:
            value_range = [raw_value, raw_value]
            range_state = "EXACT_RETAINED_WITH_PROTOCOL_AND_DATE"
        else:
            half_width = 0.10 if str(representative.get("unit")) == "seconds" else 0.50
            if confidence in {"low", "low_medium", "bounded"}:
                half_width *= 2
            value_range = [round(raw_value - half_width, 6), round(raw_value + half_width, 6)]
            range_state = "BOUNDED_RANGE_NOT_EXACT"

        sources = []
        for row in rows:
            for url in [row.get("source_url"), *(row.get("source_urls") or [])]:
                if url and url not in sources:
                    sources.append(url)
        raw_ids = sorted(str(row.get("raw_id")) for row in rows)
        forbidden = ["30M_OR_50M_TO_T90_CONVERSION"] if metric_lane(metric) == "HISTORICAL_SHORT_DISTANCE_RANGE" else []
        canonical_rows.append(
            {
                "schema_version": "sp104_historical_physical_canonical_v1",
                "canonical_id": f"SP104-PHYS-{index:04d}",
                "canonicalization_key": {
                    "same_measurement_cluster_id": group_key[0],
                    "metric": group_key[1],
                    "normalized_player": group_key[2],
                    "raw_value": group_key[3],
                    "unit": group_key[4],
                },
                "dedup_state": "DEDUPED_PROVENANCE_GROUP" if len(rows) > 1 else "UNIQUE_SOURCE_RECORD",
                "raw_record_ids": raw_ids,
                "raw_record_count": len(rows),
                "stable_player_key": stable_key,
                "identity_state": identity_state,
                "identity_candidates": identity_candidates,
                "player": representative.get("player"),
                "player_key": representative.get("player_key"),
                "measurement_date": representative.get("measurement_date"),
                "measurement_year": representative.get("measurement_year"),
                "measurement_era": representative.get("measurement_era"),
                "date_resolution_state": "EXACT_DATE" if date_known else "DATE_UNKNOWN_BOUNDED",
                "metric": metric,
                "metric_lane": metric_lane(metric),
                "raw_value": raw_value,
                "raw_unit": representative.get("unit"),
                "value_range": value_range,
                "range_state": range_state,
                "timing_method": representative.get("timing_method"),
                "start_protocol": representative.get("start_protocol"),
                "surface_or_conditions": representative.get("surface_or_conditions"),
                "protocol_resolution_state": "PROTOCOL_KNOWN" if not protocol_unknown else "PROTOCOL_UNKNOWN_BOUNDED",
                "batting_side": representative.get("batting_side"),
                "swing_context": swing_context(representative.get("notes")),
                "bunt_or_swing_context": representative.get("notes"),
                "confidence": confidence.upper(),
                "source_tier": representative.get("source_tier"),
                "source_name": representative.get("source_name"),
                "source_manifest_id": representative.get("source_manifest_id"),
                "source_urls": sorted(sources),
                "same_measurement_cluster_id": representative.get("same_measurement_cluster_id"),
                "cohort_id": representative.get("cohort_id"),
                "cohort_completeness": representative.get("cohort_completeness"),
                "bank_acceptance_status": representative.get("bank_acceptance_status"),
                "rejection_reason": representative.get("rejection_reason"),
                "corrected_usage_class": overlay_row.get("corrected_usage_class"),
                "temporal_flag": overlay_row.get("temporal_flag") or representative.get("temporal_resolution_status"),
                "numeric_use_state": (
                    "DIRECT_T90_BOUNDED_RECORD"
                    if metric_lane(metric) == "DIRECT_T90"
                    else "RANGE_CONTEXT_ONLY"
                ),
                "forbidden_transforms": forbidden,
                "powerpro_label_used": False,
                "raw_notes": representative.get("notes"),
                "raw_source_payload": representative.get("source_payload"),
            }
        )

    write_jsonl(CANONICAL_OUT, canonical_rows)
    raw_h2f = sum(1 for row in raw_records if row.get("metric") in H2F_METRICS)
    raw_short = sum(
        1
        for row in raw_records
        if "30M" in str(row.get("metric", "")) or "50M" in str(row.get("metric", "")) or row.get("metric") == "50m"
    )
    raw_t90 = sum(1 for row in raw_records if row.get("metric") in T90_METRICS)
    canonical_h2f = sum(1 for row in canonical_rows if row["metric"] in H2F_METRICS)
    canonical_short = sum(1 for row in canonical_rows if row["metric_lane"] == "HISTORICAL_SHORT_DISTANCE_RANGE")
    canonical_t90 = sum(1 for row in canonical_rows if row["metric"] in T90_METRICS)
    return {
        "raw_record_count": len(raw_records),
        "canonical_record_count": len(canonical_rows),
        "deduped_raw_record_count": len(raw_records) - len(canonical_rows),
        "raw_baseline_counts": {"H2F": raw_h2f, "30M_50M": raw_short, "T90": raw_t90},
        "canonical_counts": {"H2F": canonical_h2f, "30M_50M": canonical_short, "T90": canonical_t90},
        "current100_canonical_rows": sum(1 for row in canonical_rows if row.get("stable_player_key") in context["current_keys"]),
        "identity_state_counts": dict(Counter(row["identity_state"] for row in canonical_rows)),
        "source_path": str(PHYSICAL_INPUT.relative_to(ROOT)),
        "overlay_path": str(SP017_OVERLAY.relative_to(ROOT)),
        "dedup_key": "same_measurement_cluster_id + metric + normalized player + raw value + unit",
    }


def crosswalk_display(mlbam_id: str, context: dict[str, Any]) -> dict[str, str]:
    rows = context["by_id"].get(str(mlbam_id), [])
    if len(rows) == 1:
        row = rows[0]
        return {
            "stable_player_key": row.get("stable_player_key", ""),
            "npb_name": row.get("npb_name", ""),
            "npb_name_en": row.get("npb_name_en", ""),
            "identity_state": row.get("identity_state", ""),
            "evidence_role": row.get("evidence_role", ""),
        }
    return {
        "stable_player_key": "",
        "npb_name": "",
        "npb_name_en": "",
        "identity_state": "AMBIGUOUS_ID_NOT_FORCED" if rows else "NO_CROSSWALK_ID",
        "evidence_role": "",
    }


def official_row_url(base: str, year: int) -> str:
    return f"{base}?year={year}&position=&team=&min={MIN_QUALIFIER}&csv=true"


def build_official_running_exports(
    context: dict[str, Any],
    *,
    offline: bool,
    physical_summary: dict[str, Any],
) -> dict[str, Any]:
    eligible_ids = set(context["eligible_ids"])
    running_source_receipts: list[dict[str, Any]] = []
    sprint_source_receipts: list[dict[str, Any]] = []
    jump_source_receipts: list[dict[str, Any]] = []
    running_by_id_season: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    sprint_by_id_season: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    running_source_row: dict[tuple[str, int, int], dict[str, Any]] = {}
    sprint_source_row: dict[tuple[str, int, int], dict[str, Any]] = {}

    running_base = "https://baseballsavant.mlb.com/running_splits"
    sprint_base = "https://baseballsavant.mlb.com/leaderboard/sprint_speed"
    jump_base = "https://baseballsavant.mlb.com/leaderboard/outfield_jump"
    for year in YEARS:
        running_url = official_row_url(running_base, year)
        sprint_url = official_row_url(sprint_base, year)
        jump_url = official_row_url(jump_base, year)
        running_path = RAW_DIR / f"running_splits_{year}.csv"
        sprint_path = RAW_DIR / f"sprint_speed_{year}.csv"
        jump_path = RAW_DIR / f"outfield_jump_{year}.csv"
        running_receipt = frozen_fetch(
            running_url,
            running_path,
            offline=offline,
            surface="Baseball Savant running_splits official CSV export",
            query={"year": year, "min_competitive_runs": MIN_QUALIFIER},
        )
        sprint_receipt = frozen_fetch(
            sprint_url,
            sprint_path,
            offline=offline,
            surface="Baseball Savant sprint_speed_leaderboard official CSV export",
            query={"year": year, "min_competitive_runs": MIN_QUALIFIER},
        )
        jump_receipt = frozen_fetch(
            jump_url,
            jump_path,
            offline=offline,
            surface="Baseball Savant outfield_jump official CSV export",
            query={"year": year, "min_opportunities": MIN_QUALIFIER},
        )
        running_source_receipts.append(running_receipt)
        sprint_source_receipts.append(sprint_receipt)
        jump_source_receipts.append(jump_receipt)
        if running_receipt["fetch_status"] == 200 and running_path.exists():
            headers, rows = read_csv_bytes(running_path.read_bytes())
            for row_number, row in enumerate(rows, start=2):
                mlbam_id = str(row.get("player_id", "")).strip()
                if mlbam_id not in eligible_ids:
                    continue
                running_by_id_season[(mlbam_id, year)].append(row)
                running_source_row[(mlbam_id, year, len(running_by_id_season[(mlbam_id, year)]))] = {
                    "row": row,
                    "row_number": row_number,
                    "headers": headers,
                    "sha256": running_receipt["sha256"],
                    "url": running_url,
                }
        if sprint_receipt["fetch_status"] == 200 and sprint_path.exists():
            headers, rows = read_csv_bytes(sprint_path.read_bytes())
            for row_number, row in enumerate(rows, start=2):
                mlbam_id = str(row.get("player_id", "")).strip()
                if mlbam_id not in eligible_ids:
                    continue
                sprint_by_id_season[(mlbam_id, year)].append(row)
                sprint_source_row[(mlbam_id, year, len(sprint_by_id_season[(mlbam_id, year)]))] = {
                    "row": row,
                    "row_number": row_number,
                    "headers": headers,
                    "sha256": sprint_receipt["sha256"],
                    "url": sprint_url,
                }

    sprint_lookup: dict[tuple[str, int], list[dict[str, Any]]] = sprint_by_id_season
    running_fields = [
        "stable_player_key",
        "npb_name",
        "npb_name_en",
        "identity_state",
        "evidence_role",
        "mlbam_id",
        "season",
        "team_id",
        "team",
        "position",
        "batting_side",
        "standardized_90ft_seconds",
        "split_000_seconds",
        "split_005_seconds",
        "split_010_seconds",
        "split_015_seconds",
        "split_020_seconds",
        "split_025_seconds",
        "split_030_seconds",
        "split_035_seconds",
        "split_040_seconds",
        "split_045_seconds",
        "split_050_seconds",
        "split_055_seconds",
        "split_060_seconds",
        "split_065_seconds",
        "split_070_seconds",
        "split_075_seconds",
        "split_080_seconds",
        "split_085_seconds",
        "split_090_seconds",
        "qualifier_name",
        "qualifier_value",
        "opportunities_competitive_runs",
        "sprint_speed_kmh",
        "competitive_runs",
        "bolts",
        "raw_hp_to_1b_seconds",
        "hp_to_1b_semantics",
        "exposure_join_state",
        "source_url",
        "source_response_sha256",
        "source_export_row_number",
        "missingness_policy",
        "shared_play_double_count_guard",
    ]
    sprint_fields = [
        "stable_player_key",
        "npb_name",
        "npb_name_en",
        "identity_state",
        "evidence_role",
        "mlbam_id",
        "season",
        "team",
        "position",
        "batting_side_if_running_split_present",
        "sprint_speed_kmh",
        "competitive_runs",
        "bolts",
        "raw_hp_to_1b_seconds",
        "hp_to_1b_semantics",
        "qualifier_name",
        "qualifier_value",
        "exposure_reliability_guard",
        "source_url",
        "source_response_sha256",
        "source_export_row_number",
        "missingness_policy",
    ]
    running_rows: list[dict[str, Any]] = []
    for (mlbam_id, season), rows in sorted(running_by_id_season.items()):
        sprint_rows = sprint_lookup.get((mlbam_id, season), [])
        for running_index, raw in enumerate(rows, start=1):
            identity = crosswalk_display(mlbam_id, context)
            exposure_state = "ONE_TO_ONE_SPRINT_EXPOSURE_JOIN" if len(sprint_rows) == 1 else (
                "NO_SPRINT_EXPOSURE_ROW" if not sprint_rows else "MULTIPLE_SPRINT_TEAM_ROWS_NOT_COLLAPSED"
            )
            sprint = sprint_rows[0] if len(sprint_rows) == 1 else {}
            out: dict[str, Any] = {
                **identity,
                "mlbam_id": mlbam_id,
                "season": season,
                "team_id": raw.get("team_id"),
                "team": sprint.get("team", ""),
                "position": raw.get("position_name"),
                "batting_side": raw.get("bat_side"),
                "standardized_90ft_seconds": number(raw.get("seconds_since_hit_090")),
                "qualifier_name": "min_competitive_runs",
                "qualifier_value": MIN_QUALIFIER,
                "opportunities_competitive_runs": integer(sprint.get("competitive_runs")),
                "sprint_speed_kmh": number(sprint.get("sprint_speed")),
                "competitive_runs": integer(sprint.get("competitive_runs")),
                "bolts": integer(sprint.get("bolts")),
                "raw_hp_to_1b_seconds": number(sprint.get("hp_to_1b")),
                "hp_to_1b_semantics": "RAW_H2F_LEADERBOARD_FIELD_NOT_STANDARDIZED_90FT",
                "exposure_join_state": exposure_state,
                "source_url": official_row_url(running_base, season),
                "source_response_sha256": next(
                    (r["sha256"] for r in running_source_receipts if r.get("query", {}).get("year") == season),
                    None,
                ),
                "source_export_row_number": None,
                "missingness_policy": "MISSING_LEADERBOARD_ROW_IS_MISSING_EXPOSURE_NOT_SLOW",
                "shared_play_double_count_guard": "90FT_SPLITS, raw HP_TO_1B, Sprint Speed, Competitive Runs and Bolts remain separate fields; no additive score.",
            }
            for split in range(0, 91, 5):
                raw_key = f"seconds_since_hit_{split:03d}"
                out[f"split_{split:03d}_seconds"] = number(raw.get(raw_key))
            # Preserve the source row locator after the merged row is formed.
            out["source_export_row_number"] = next(
                (
                    item["row_number"]
                    for key, item in running_source_row.items()
                    if key[0] == mlbam_id and key[1] == season and item["row"] == raw
                ),
                None,
            )
            running_rows.append(out)

    sprint_rows_out: list[dict[str, Any]] = []
    for (mlbam_id, season), rows in sorted(sprint_by_id_season.items()):
        running_rows_for_identity = running_by_id_season.get((mlbam_id, season), [])
        identity = crosswalk_display(mlbam_id, context)
        for raw in rows:
            sprint_rows_out.append(
                {
                    **identity,
                    "mlbam_id": mlbam_id,
                    "season": season,
                    "team": raw.get("team"),
                    "position": raw.get("position"),
                    "batting_side_if_running_split_present": (
                        running_rows_for_identity[0].get("bat_side") if len(running_rows_for_identity) == 1 else ""
                    ),
                    "sprint_speed_kmh": number(raw.get("sprint_speed")),
                    "competitive_runs": integer(raw.get("competitive_runs")),
                    "bolts": integer(raw.get("bolts")),
                    "raw_hp_to_1b_seconds": number(raw.get("hp_to_1b")),
                    "hp_to_1b_semantics": "RAW_H2F_LEADERBOARD_FIELD_NOT_STANDARDIZED_90FT",
                    "qualifier_name": "min_competitive_runs",
                    "qualifier_value": MIN_QUALIFIER,
                    "exposure_reliability_guard": "Bolts are interpreted only with Competitive Runs; absent rows are not zero/slow.",
                    "source_url": official_row_url(sprint_base, season),
                    "source_response_sha256": next(
                        (r["sha256"] for r in sprint_source_receipts if r.get("query", {}).get("year") == season),
                        None,
                    ),
                    "source_export_row_number": next(
                        (
                            item["row_number"]
                            for key, item in sprint_source_row.items()
                            if key[0] == mlbam_id and key[1] == season and item["row"] == raw
                        ),
                        None,
                    ),
                    "missingness_policy": "MISSING_LEADERBOARD_ROW_IS_MISSING_EXPOSURE_NOT_SLOW",
                }
            )

    def write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8-sig", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
            writer.writeheader()
            for row in rows:
                writer.writerow({field: csv_value(row.get(field)) for field in fields})

    write_csv(RUNNING_OUT, running_fields, running_rows)
    write_csv(SPRINT_OUT, sprint_fields, sprint_rows_out)

    jump_rows_raw: list[dict[str, Any]] = []
    jump_source_payloads: list[dict[str, Any]] = []
    for year in YEARS:
        jump_path = RAW_DIR / f"outfield_jump_{year}.csv"
        receipt = next((r for r in jump_source_receipts if r.get("query", {}).get("year") == year), None)
        if not receipt or receipt.get("fetch_status") != 200 or not jump_path.exists():
            continue
        _, rows = read_csv_bytes(jump_path.read_bytes())
        for row_number, raw in enumerate(rows, start=2):
            mlbam_id = str(raw.get("resp_fielder_id", "")).strip()
            if mlbam_id not in eligible_ids:
                continue
            identity = crosswalk_display(mlbam_id, context)
            jump_rows_raw.append(
                {
                    **identity,
                    "mlbam_id": mlbam_id,
                    "season": year,
                    "source_row_number": row_number,
                    "source_url": receipt["url"],
                    "source_response_sha256": receipt["sha256"],
                    "position_scope": "OUTFIELDER_JUMP_LEADERBOARD",
                    "reaction": number(raw.get("rel_league_reaction_distance")),
                    "burst": number(raw.get("rel_league_burst_distance")),
                    "route": number(raw.get("rel_league_routing_distance")),
                    "bootup": number(raw.get("rel_league_bootup_distance")),
                    "outs_above_average": number(raw.get("outs_above_average")),
                    "outs_per_play": number(raw.get("outs_per_play")),
                    "opportunities_n": integer(raw.get("n")),
                    "outs_n": integer(raw.get("n_outs")),
                    "burst_use_scope": "DEFENSIVE_CONTEXT_ONLY",
                    "reaction_route_separation": "Reaction and Route remain separate; neither enters Burst.",
                    "used_in_physical_transfer": False,
                }
            )
        jump_source_payloads.append(receipt)
    jump_payload = {
        "schema_version": "sp104_outfielder_jump_burst_context_v1",
        "as_of": AS_OF,
        "status": "COLLECTED_BOUNDED_CONTEXT_ONLY" if jump_rows_raw else "MEASURED_NEGATIVE_NO_ELIGIBLE_OVERLAP",
        "source_surface": "https://baseballsavant.mlb.com/leaderboard/outfield_jump",
        "glossary_surface": "https://www.mlb.com/glossary/statcast/jump",
        "source_receipts": jump_source_payloads,
        "eligible_overlap": {
            "crosswalk_mlb_ids": len(eligible_ids),
            "eligible_rows": len(jump_rows_raw),
            "eligible_unique_ids": len({row["mlbam_id"] for row in jump_rows_raw}),
            "current100_rows": sum(
                1
                for row in jump_rows_raw
                if row.get("stable_player_key") in context["current_keys"]
            ),
            "material_overlap_rule": "Only rows with an exact crosswalk MLBAM ID are retained; no name-only join.",
        },
        "components": {
            "reaction": "first 1.5 seconds context; retained separately",
            "burst": "second 1.5 seconds defensive burst; retained separately",
            "route": "three-second directional efficiency context; retained separately",
            "burst_is_universal_speed": False,
        },
        "rows": sorted(jump_rows_raw, key=lambda row: (row["mlbam_id"], row["season"], row["source_row_number"])),
        "missingness_policy": "No eligible leaderboard row is imputed as slow or zero.",
        "used_in_physical_transfer": False,
    }
    write_json(JUMP_OUT, jump_payload)

    manifest = {
        "schema_version": "sp104_mlb_running_collection_manifest_v1",
        "as_of": AS_OF,
        "collection_policy": {
            "surface": "official Baseball Savant CSV export endpoints only",
            "years": list(YEARS),
            "sprint_qualifier": "min=10",
            "running_splits_qualifier": "min=10",
            "selection_rule": "all exact MLBAM IDs in the SP-101 NPB/MLB crosswalk, which subsumes current-100 IDs and any historical physical-rich crosswalk anchors",
            "not_current100_only": True,
            "no_uncontrolled_scraping": True,
        },
        "official_surfaces": {
            "running_splits": "https://baseballsavant.mlb.com/running_splits",
            "sprint_speed_leaderboard": "https://baseballsavant.mlb.com/sprint_speed_leaderboard",
            "sprint_csv_export": sprint_base,
            "90ft_glossary": "https://www.mlb.com/glossary/statcast/90-foot-running-splits",
        },
        "raw_snapshot_receipts": {
            "running_splits": running_source_receipts,
            "sprint_exposure_h2f": sprint_source_receipts,
            "outfielder_jump": jump_source_receipts,
        },
        "exported_artifacts": {
            "running_splits": str(RUNNING_OUT.relative_to(ROOT)),
            "sprint_exposure_h2f": str(SPRINT_OUT.relative_to(ROOT)),
        },
        "export_schema": {
            "running_splits_required_fields": running_fields,
            "sprint_exposure_h2f_required_fields": sprint_fields,
            "semantic_guards": [
                "standardized_90ft_seconds is seconds_since_hit_090, not raw HP-to-1B",
                "raw_hp_to_1b_seconds remains a distinct leaderboard field",
                "Competitive Runs is the exposure denominator for Sprint Speed/Bolts reliability",
                "no absent leaderboard row receives a zero or slow value",
                "shared plays are not double-counted across split/H2F/Sprint fields",
            ],
        },
        "filtered_row_counts": {
            "running_splits": len(running_rows),
            "sprint_exposure_h2f": len(sprint_rows_out),
        },
        "filtered_unique_coverage": {
            "running_ids": len({row["mlbam_id"] for row in running_rows}),
            "sprint_ids": len({row["mlbam_id"] for row in sprint_rows_out}),
            "eligible_ids_with_running_rows": len({key[0] for key in running_by_id_season}),
            "eligible_ids_with_sprint_rows": len({key[0] for key in sprint_by_id_season}),
            "missing_running_ids_not_slow": sorted(eligible_ids - {key[0] for key in running_by_id_season}),
            "missing_sprint_ids_not_slow": sorted(eligible_ids - {key[0] for key in sprint_by_id_season}),
        },
        "deterministic_snapshot_rule": "If a raw snapshot exists, its bytes are read without refresh. Re-running from these snapshots must preserve all export hashes and derived bytes.",
    }
    write_json(COLLECTION_MANIFEST_OUT, manifest)

    physical_anchor_by_name: dict[str, dict[str, Any]] = {}
    for raw in load_json(PHYSICAL_INPUT, {}).get("records", []):
        normalized = normalize_name(raw.get("player"))
        if not normalized:
            continue
        entry = physical_anchor_by_name.setdefault(
            normalized,
            {"normalized_name": normalized, "display_names": set(), "raw_record_count": 0},
        )
        entry["display_names"].add(str(raw.get("player")))
        entry["raw_record_count"] += 1
    stable_to_crosswalk_rows: dict[str, list[dict[str, str]]] = defaultdict(list)
    for crosswalk_row in context["crosswalk"]:
        stable_to_crosswalk_rows[crosswalk_row.get("stable_player_key", "")].append(crosswalk_row)
    physical_anchor_universe: list[dict[str, Any]] = []
    for normalized, entry in sorted(physical_anchor_by_name.items()):
        stable_candidates = sorted(context["name_candidates"].get(normalized, set()))
        mlbam_ids = sorted(
            {
                mlbam_id
                for stable in stable_candidates
                for crosswalk_row in stable_to_crosswalk_rows.get(stable, [])
                for mlbam_id in re.findall(r"\d+", crosswalk_row.get("mlbam_ids", ""))
            }
        )
        physical_anchor_universe.append(
            {
                "normalized_name": normalized,
                "display_names": sorted(entry["display_names"]),
                "raw_record_count": entry["raw_record_count"],
                "stable_candidates": stable_candidates,
                "mlbam_ids": mlbam_ids,
                "current100_stable_keys": sorted(stable for stable in stable_candidates if stable in context["current_keys"]),
                "identity_state": "EXACT_CROSSWALK_OR_CURRENT100" if stable_candidates else "UNRESOLVED_NAME_ONLY",
                "name_only_match_allowed": False,
            }
        )

    current_with_ids = {
        row["stable_player_key"]
        for row in context["crosswalk"]
        if row.get("stable_player_key") in context["current_keys"] and row.get("mlbam_ids")
    }
    id_to_current = {
        mlbam_id: rows[0]["stable_player_key"]
        for mlbam_id, rows in context["by_id"].items()
        if len(rows) == 1 and rows[0].get("stable_player_key") in context["current_keys"]
    }
    coverage = {
        "schema_version": "sp104_mlb_npb_running_crosswalk_coverage_v1",
        "as_of": AS_OF,
        "crosswalk_source": str(CROSSWALK_INPUT.relative_to(ROOT)),
        "crosswalk_total_rows": len(context["crosswalk"]),
        "crosswalk_rows_with_exact_mlbam_id": len(context["by_id"]),
        "eligible_mlbam_id_count": len(eligible_ids),
        "eligible_selection": {
            "all_crosswalk_rows_with_mlbam_id": True,
            "current100_stable_keys": len(context["current_keys"]),
            "current100_keys_with_mlbam_id": len(current_with_ids),
            "physical_canonical_rows": physical_summary["canonical_record_count"],
            "physical_rich_anchor_names": len(physical_anchor_universe),
            "not_current100_only": True,
        },
        "physical_rich_anchor_universe": {
            "source": str(PHYSICAL_INPUT.relative_to(ROOT)),
            "distinct_normalized_names": len(physical_anchor_universe),
            "exact_crosswalk_or_current100_names": sum(1 for row in physical_anchor_universe if row["stable_candidates"]),
            "names_with_mlbam_ids": sum(1 for row in physical_anchor_universe if row["mlbam_ids"]),
            "unresolved_name_only_names": sum(1 for row in physical_anchor_universe if not row["stable_candidates"]),
            "name_only_match_allowed": False,
            "rows": physical_anchor_universe,
        },
        "running_splits": {
            "export_rows": len(running_rows),
            "unique_mlbam_ids": len({row["mlbam_id"] for row in running_rows}),
            "unique_current100_keys_observed": len(
                {id_to_current.get(row["mlbam_id"]) for row in running_rows if id_to_current.get(row["mlbam_id"])}
            ),
            "season_min": min((row["season"] for row in running_rows), default=None),
            "season_max": max((row["season"] for row in running_rows), default=None),
        },
        "sprint_exposure_h2f": {
            "export_rows": len(sprint_rows_out),
            "unique_mlbam_ids": len({row["mlbam_id"] for row in sprint_rows_out}),
            "unique_current100_keys_observed": len(
                {id_to_current.get(row["mlbam_id"]) for row in sprint_rows_out if id_to_current.get(row["mlbam_id"])}
            ),
            "season_min": min((row["season"] for row in sprint_rows_out), default=None),
            "season_max": max((row["season"] for row in sprint_rows_out), default=None),
        },
        "identity_guards": {
            "mlbam_ids_unique_in_crosswalk": all(len(rows) == 1 for rows in context["by_id"].values()),
            "export_ids_all_crosswalk_backed": all(row["mlbam_id"] in eligible_ids for row in running_rows + sprint_rows_out),
            "name_only_join_used": False,
            "ambiguous_ids_forced": False,
        },
        "missingness_policy": {
            "leaderboard_absence": "MISSING_EXPOSURE_NOT_SLOW",
            "raw_bolts_without_competitive_runs": sum(
                1 for row in sprint_rows_out if row["bolts"] is not None and row["competitive_runs"] is None
            ),
            "raw_hp_to_1b_is_standardized_90ft": False,
        },
    }
    write_json(COVERAGE_OUT, coverage)
    return {
        "manifest": manifest,
        "coverage": coverage,
        "running_rows": running_rows,
        "sprint_rows": sprint_rows_out,
        "jump_rows": jump_rows_raw,
    }


def mad(values: list[float]) -> float:
    if not values:
        return 0.0
    center = median(values)
    return median([abs(value - center) for value in values])


def cross_family_method(
    method_id: str,
    candidate_number: int,
    method_name: str,
    feature_family: str | None,
    target_family: str | None,
    observations: list[dict[str, Any]],
    *,
    uncertainty_rule: str,
    route_risk: str,
) -> dict[str, Any]:
    by_player_family: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    seasons: dict[str, set[str]] = defaultdict(set)
    for observation in observations:
        player = str(observation.get("stable_player_key") or observation.get("raw_player_key") or "")
        family = str(observation.get("metric_family"))
        if not player or family not in {"HISTORICAL_H2F_CONTEXT", "HISTORICAL_SHORT_DISTANCE_RANGE", "DIRECT_T90"}:
            continue
        if observation.get("raw_value") is not None:
            by_player_family[player][family].append(float(observation["raw_value"]))
        seasons[player].add(str(observation.get("measurement_year")))

    pairs: list[dict[str, Any]] = []
    if feature_family and target_family:
        for player in sorted(by_player_family):
            if by_player_family[player].get(feature_family) and by_player_family[player].get(target_family):
                pairs.append(
                    {
                        "player": player,
                        "feature": median(by_player_family[player][feature_family]),
                        "target": median(by_player_family[player][target_family]),
                        "season_count": len(seasons[player]),
                    }
                )

    predictions: list[dict[str, float]] = []
    holdout_player_count = 0
    common_support_count = 0
    for holdout in pairs:
        train = [row for row in pairs if row["player"] != holdout["player"]]
        if not train:
            continue
        holdout_player_count += 1
        feature_min = min(row["feature"] for row in train)
        feature_max = max(row["feature"] for row in train)
        in_support = feature_min <= holdout["feature"] <= feature_max
        if not in_support or feature_max == feature_min:
            continue
        common_support_count += 1
        target_min = min(row["target"] for row in train)
        target_max = max(row["target"] for row in train)
        prediction = target_min + (
            (holdout["feature"] - feature_min) / (feature_max - feature_min)
        ) * (target_max - target_min)
        residuals = [
            row["target"]
            - (
                target_min
                + ((row["feature"] - feature_min) / (feature_max - feature_min))
                * (target_max - target_min)
            )
            for row in train
        ]
        half_width = max(0.05, 2 * mad(residuals))
        predictions.append(
            {
                "actual": holdout["target"],
                "prediction": prediction,
                "lower": prediction - half_width,
                "upper": prediction + half_width,
            }
        )

    if not pairs or not predictions:
        result_state = "NO_COMMON_SUPPORT"
        calibration_mae = None
        interval_coverage = None
        common_support = False
    else:
        result_state = "BOUNDED_CONTEXT"
        calibration_mae = sum(abs(row["actual"] - row["prediction"]) for row in predictions) / len(predictions)
        interval_coverage = sum(
            row["lower"] <= row["actual"] <= row["upper"] for row in predictions
        ) / len(predictions)
        common_support = True

    return {
        "method_id": method_id,
        "candidate_number": candidate_number,
        "method": method_name,
        "training_population": "canonical physical range records only; unresolved names stay raw-player grouped and are never name-joined",
        "training_n": sum(len(values) for families in by_player_family.values() for values in families.values()),
        "distinct_players": len(by_player_family),
        "distinct_seasons": len(
            {
                str(row.get("measurement_year"))
                for row in observations
                if row.get("measurement_year") not in {None, "", "unknown"}
            }
        ),
        "features": [feature_family] if feature_family else [],
        "target": target_family or "NO_TARGET_FORCED",
        "target_construct": "bounded physical range/quantile diagnostic; not a PowerPro label and not a final 0-100 value",
        "holdout_design": "leave-player-out cross-fit; all seasons for a player are clustered in the held-out fold",
        "leakage_guard": "target player and all of that player's seasons are excluded from training; target field is not in feature list",
        "common_support_rule": "feature must lie inside the training-player feature range; NO_COMMON_SUPPORT is valid and fail-closed",
        "common_support": common_support,
        "common_support_pairs": common_support_count,
        "candidate_pairs": len(pairs),
        "holdout_players": holdout_player_count,
        "calibration_mae": round(calibration_mae, 8) if calibration_mae is not None else None,
        "interval_coverage": round(interval_coverage, 8) if interval_coverage is not None else None,
        "uncertainty": uncertainty_rule,
        "simple_baseline": "training-player target median; reported only as a comparison baseline",
        "incremental_vs_frozen_state": "BOUNDED_DIAGNOSTIC_ONLY" if result_state == "BOUNDED_CONTEXT" else "NO_INCREMENTAL_USE",
        "route_double_count_risk": route_risk,
        "result_state": result_state,
        "direct_numeric_promotion_allowed": False,
        "powerpro_teacher_used": False,
    }


def mlb_shape_method(running_rows: list[dict[str, Any]]) -> dict[str, Any]:
    usable = [
        row
        for row in running_rows
        if row.get("split_085_seconds") is not None and row.get("standardized_90ft_seconds") is not None
    ]
    by_player: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in usable:
        by_player[str(row["mlbam_id"])].append(row)
    predictions: list[dict[str, float]] = []
    common_support_count = 0
    for player in sorted(by_player):
        train = [row for other, rows in by_player.items() if other != player for row in rows]
        for holdout in by_player[player]:
            if not train:
                continue
            fmin = min(row["split_085_seconds"] for row in train)
            fmax = max(row["split_085_seconds"] for row in train)
            if not fmin <= holdout["split_085_seconds"] <= fmax:
                continue
            common_support_count += 1
            deltas = [row["standardized_90ft_seconds"] - row["split_085_seconds"] for row in train]
            prediction = holdout["split_085_seconds"] + median(deltas)
            half_width = max(0.05, 2 * mad(deltas))
            predictions.append(
                {
                    "actual": holdout["standardized_90ft_seconds"],
                    "prediction": prediction,
                    "lower": prediction - half_width,
                    "upper": prediction + half_width,
                }
            )
    if not usable or not predictions:
        state = "NO_COMMON_SUPPORT"
        mae = None
        coverage = None
    else:
        state = "BOUNDED_CONTEXT"
        mae = sum(abs(row["actual"] - row["prediction"]) for row in predictions) / len(predictions)
        coverage = sum(row["lower"] <= row["actual"] <= row["upper"] for row in predictions) / len(predictions)
    return {
        "method_id": "TF-062",
        "candidate_number": 62,
        "method": "five-foot acceleration-shape feature calibration",
        "training_population": "eligible MLBAM rows from frozen official running_splits exports",
        "training_n": len(usable),
        "distinct_players": len(by_player),
        "distinct_seasons": len({row["season"] for row in usable}),
        "features": [f"split_{split:03d}_seconds" for split in range(5, 86, 5)],
        "target": "standardized_90ft_seconds (seconds_since_hit_090)",
        "target_construct": "official MLB standardized 90-foot physical endpoint; not transferred to NPB and not a final rating",
        "holdout_design": "leave-player-out cross-fit; all seasons for one MLBAM ID are held out together",
        "leakage_guard": "split_090 target excluded from features; player-season rows never cross train/holdout boundary",
        "common_support_rule": "split_085 must be inside the training-player support range; missing rows remain missing",
        "common_support": bool(predictions),
        "common_support_pairs": common_support_count,
        "candidate_pairs": len(usable),
        "holdout_players": len(by_player),
        "calibration_mae": round(mae, 8) if mae is not None else None,
        "interval_coverage": round(coverage, 8) if coverage is not None else None,
        "uncertainty": "prediction interval from held-out training delta MAD; no point transfer outside common support",
        "simple_baseline": "training-player median standardized-90ft endpoint",
        "incremental_vs_frozen_state": "BOUNDED_DIAGNOSTIC_ONLY" if state == "BOUNDED_CONTEXT" else "NO_INCREMENTAL_USE",
        "route_double_count_risk": "five-foot splits and 90-foot endpoint are one official tracking family; never add to Sprint Speed or raw HP-to-1B",
        "result_state": state,
        "direct_numeric_promotion_allowed": False,
        "powerpro_teacher_used": False,
    }


def build_transfer_benchmark(
    context: dict[str, Any],
    physical_rows: list[dict[str, Any]],
    official: dict[str, Any],
) -> dict[str, Any]:
    observations = [
        {
            "stable_player_key": row.get("stable_player_key"),
            "raw_player_key": row.get("player_key") or f"RAW_PLAYER:{normalize_name(row.get('player'))}",
            "metric_family": row.get("metric_lane"),
            "raw_value": row.get("raw_value"),
            "measurement_year": row.get("measurement_year"),
        }
        for row in physical_rows
        if row.get("metric_lane") in {"HISTORICAL_H2F_CONTEXT", "HISTORICAL_SHORT_DISTANCE_RANGE", "DIRECT_T90"}
        and row.get("raw_value") is not None
    ]
    methods = [
        cross_family_method(
            "TF-056",
            56,
            "leakage-safe anchor calibration",
            "HISTORICAL_SHORT_DISTANCE_RANGE",
            "HISTORICAL_H2F_CONTEXT",
            observations,
            uncertainty_rule="bounded interval from leave-player-out residual MAD",
            route_risk="short-distance protocol/date heterogeneity; no 30m/50m to T90 conversion",
        ),
        cross_family_method(
            "TF-057",
            57,
            "cross-fitted / leave-player-out transfer",
            "HISTORICAL_H2F_CONTEXT",
            "DIRECT_T90",
            observations,
            uncertainty_rule="fail-closed outside player-clustered common support",
            route_risk="H2F includes batting transition; direct T90 is sparse and not interchangeable",
        ),
        cross_family_method(
            "TF-058",
            58,
            "hierarchical partial pooling / interval transfer",
            "HISTORICAL_SHORT_DISTANCE_RANGE",
            "DIRECT_T90",
            observations,
            uncertainty_rule="interval only; no exact value when protocol or date is unresolved",
            route_risk="same-player repeated tests and cohort selection; pooling remains diagnostic",
        ),
        cross_family_method(
            "TF-059",
            59,
            "physical-rich-only rank/quantile mapping",
            None,
            "HISTORICAL_H2F_CONTEXT",
            observations,
            uncertainty_rule="not estimable without an independent feature lane",
            route_risk="same-family target-as-feature would self-teach; deliberately blocked",
        ),
        cross_family_method(
            "TF-060",
            60,
            "multiple-imputation / interval propagation",
            "HISTORICAL_SHORT_DISTANCE_RANGE",
            "HISTORICAL_H2F_CONTEXT",
            observations,
            uncertainty_rule="interval propagation only; missingness is not slow",
            route_risk="imputation could amplify protocol missingness; no production use",
        ),
        cross_family_method(
            "TF-061",
            61,
            "handedness/protocol-aware H2F calibration",
            None,
            "HISTORICAL_H2F_CONTEXT",
            observations,
            uncertainty_rule="requires observed batting side and protocol; unavailable in historical raw corpus",
            route_risk="raw local H2F lacks reliable side/protocol; old NPB+ field stays fail-closed",
        ),
        mlb_shape_method(official["running_rows"]),
    ]
    benchmark = {
        "schema_version": "sp104_transfer_method_benchmark_v1",
        "as_of": AS_OF,
        "status": "BOUNDED_DIAGNOSTIC_NO_PRODUCTION_TRANSFER",
        "teacher_policy": {
            "teacher_sources": [
                "outputs/derived/sp104_historical_physical_canonical.jsonl",
                "data/manual/sp104_mlb_running_splits.csv",
            ],
            "powerpro_labels_in_teacher_features_or_targets": False,
            "the_show_labels_in_teacher_features_or_targets": False,
            "target_cannot_teach_itself": True,
            "same_player_seasons_clustered": True,
            "no_common_support_is_valid": True,
        },
        "methods": methods,
        "candidate_method_count": len(methods),
        "simple_method_preference": "Prefer the simplest physically interpretable method only after common support, player-clustered holdout, protocol/handedness availability and independent QA all pass.",
        "production_boundary": "No method here produces a final 0-100 speed value, owner-review value, or SP-079 input.",
    }
    write_json(BENCHMARK_OUT, benchmark)
    return benchmark


def build_anchor_receipts(
    context: dict[str, Any],
    physical_rows: list[dict[str, Any]],
    official: dict[str, Any],
    benchmark: dict[str, Any],
) -> list[dict[str, Any]]:
    physical_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in physical_rows:
        if row.get("stable_player_key") in context["current_keys"]:
            physical_by_key[row["stable_player_key"]].append(row)
    official_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in official["running_rows"]:
        if row.get("stable_player_key") in context["current_keys"]:
            official_by_key[row["stable_player_key"]].append(row)
    receipts: list[dict[str, Any]] = []
    for player in context["current_players"]:
        key = player.get("stable_player_key")
        physical = sorted(physical_by_key.get(key, []), key=lambda row: row["canonical_id"])
        official_rows = sorted(
            official_by_key.get(key, []),
            key=lambda row: (row["season"], row["mlbam_id"]),
        )
        method_receipts = []
        for method in benchmark["methods"]:
            if method["method_id"] == "TF-062":
                state = "BOUNDED_CONTEXT" if official_rows and method["result_state"] != "NO_COMMON_SUPPORT" else "NO_COMMON_SUPPORT"
                support = bool(official_rows and method["common_support"])
            elif method["method_id"] in {"TF-056", "TF-058", "TF-060"}:
                state = "BOUNDED_CONTEXT" if physical and method["result_state"] != "NO_COMMON_SUPPORT" else "NO_COMMON_SUPPORT"
                support = bool(physical and method["common_support"])
            else:
                state = "NO_COMMON_SUPPORT"
                support = False
            method_receipts.append(
                {
                    "method_id": method["method_id"],
                    "result_state": state,
                    "common_support": support,
                    "target_player_excluded_from_training": True,
                    "all_player_seasons_clustered": True,
                    "direct_numeric_promotion_allowed": False,
                    "teacher_source_family": method["training_population"],
                }
            )
        receipts.append(
            {
                "schema_version": "sp104_anchor_to_sparse_player_receipt_v1",
                "stable_player_key": key,
                "player": player.get("player"),
                "queue_order": player.get("queue_order"),
                "identity_state": player.get("identity_state"),
                "physical_anchor_rows": [row["canonical_id"] for row in physical],
                "physical_anchor_count_by_family": dict(Counter(row["metric_lane"] for row in physical)),
                "official_mlb_running_rows": len(official_rows),
                "official_mlb_seasons": sorted({row["season"] for row in official_rows}),
                "selected_anchor_state": "BOUNDED_CONTEXT_ONLY" if physical or official_rows else "MISSING_BOUNDED",
                "common_support_state": (
                    "AVAILABLE_FOR_DIAGNOSTIC_ONLY"
                    if any(row["common_support"] for row in method_receipts)
                    else "NO_COMMON_SUPPORT"
                ),
                "method_receipts": method_receipts,
                "transfer_state": "NO_PRODUCTION_TRANSFER_PRE_SP079",
                "technique_and_proxy_separation": {
                    "technique_context_only": True,
                    "outcome_proxy_context_only": True,
                    "powerpro_teacher_used": False,
                },
                "missingness_policy": "A missing official row is missing exposure, never a slow value or zero.",
                "no_final_speed_value_created": True,
            }
        )
    write_jsonl(RECEIPTS_OUT, receipts)
    return receipts


def build_policy(benchmark: dict[str, Any], receipts: list[dict[str, Any]]) -> dict[str, Any]:
    policy = {
        "schema_version": "sp104_selected_transfer_policy_v1",
        "as_of": AS_OF,
        "status": "NO_PRODUCTION_TRANSFER_PRE_SP079",
        "selection_rule": "The simplest method is selectable only after independent player-clustered validation and common support; this run records candidates and does not promote one.",
        "selected_method_id": None,
        "candidate_method_ids": [row["method_id"] for row in benchmark["methods"]],
        "candidate_result_states": {row["method_id"]: row["result_state"] for row in benchmark["methods"]},
        "current100_receipt_count": len(receipts),
        "current100_common_support_count": sum(
            1
            for receipt in receipts
            if receipt.get("common_support_state") == "AVAILABLE_FOR_DIAGNOSTIC_ONLY"
        ),
        "production_use": False,
        "direct_numeric_promotion_allowed": False,
        "target_definition": "bounded physical evidence/range only; never a PowerPro label and never a final 0-100 speed value",
        "hard_guards": [
            "NO_COMMON_SUPPORT is valid and fail-closed",
            "same-player seasons are clustered in holdout",
            "30m/50m is never converted to T90",
            "old local NPB+ hp_to_1b_sec is not read or promoted",
            "MLB raw HP-to-1B remains distinct from standardized 90-foot split",
            "Reaction/Route are not Burst and Jump is defensive context only",
        ],
    }
    write_json(POLICY_OUT, policy)
    return policy


def state_from_old_player(player: dict[str, Any]) -> dict[str, Any]:
    estimate = player.get("independent_physical_estimate") or {}
    return {
        "peak_speed": "AVAILABLE_BOUNDED" if estimate.get("peak_speed_kmh") is not None else "MISSING_BOUNDED",
        "acceleration_h2f": estimate.get("acceleration_end_to_end_state", "MISSING_BOUNDED"),
        "end_to_end_t90": "MISSING_OR_BOUNDED",
        "historical_range": "AVAILABLE_BOUNDED" if player.get("physical_percentile") is not None else "MISSING_BOUNDED",
        "selected_anchor_transfer": "SP103_PRELIMINARY_BOUNDED_ONLY",
        "new_mlb_split_h2f": "MISSING_EXTERNAL_PLAYER_EXPORT",
        "technique_context": "SEPARATE_CONTEXT_ONLY",
        "outcome_proxy_context": "SEPARATE_CONTEXT_ONLY",
        "missing_common_support": "NOT_RECOMPUTED_FOR_SP103",
    }


def build_before_after(
    context: dict[str, Any],
    physical_rows: list[dict[str, Any]],
    official: dict[str, Any],
    receipts: list[dict[str, Any]],
) -> dict[str, Any]:
    physical_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in physical_rows:
        if row.get("stable_player_key") in context["current_keys"]:
            physical_by_key[row["stable_player_key"]].append(row)
    official_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in official["running_rows"]:
        if row.get("stable_player_key") in context["current_keys"]:
            official_by_key[row["stable_player_key"]].append(row)
    receipt_by_key = {row["stable_player_key"]: row for row in receipts}
    preflight = load_json(SP103_TOP_PREFLIGHT, {}) or {}
    preflight_cells = {row.get("stable_player_key"): row for row in preflight.get("top_speed_removal_cells", [])}
    players: list[dict[str, Any]] = []
    for player in context["current_players"]:
        key = player["stable_player_key"]
        local = physical_by_key.get(key, [])
        mlb = official_by_key.get(key, [])
        families = Counter(row.get("metric_lane") for row in local)
        before = state_from_old_player(player)
        after = dict(before)
        after["historical_range"] = "AVAILABLE_BOUNDED_RANGE" if local else before["historical_range"]
        if any(row.get("metric_lane") == "DIRECT_T90" for row in local):
            after["end_to_end_t90"] = "DIRECT_T90_ROW_PRESENT_BOUNDED"
        elif any(row.get("metric_lane") == "HISTORICAL_H2F_CONTEXT" for row in local):
            after["end_to_end_t90"] = "H2F_CONTEXT_ONLY_T90_NOT_ASSUMED"
        elif any(row.get("metric_lane") == "HISTORICAL_SHORT_DISTANCE_RANGE" for row in local):
            after["end_to_end_t90"] = "SHORT_DISTANCE_CONTEXT_ONLY_T90_NOT_ASSUMED"
        if mlb:
            after["acceleration_h2f"] = "AVAILABLE_BOUNDED_MLB_5FT_AND_90FT_CONTEXT"
            after["new_mlb_split_h2f"] = "AVAILABLE_BOUNDED_OFFICIAL_ROWS"
        elif families.get("HISTORICAL_H2F_CONTEXT"):
            after["acceleration_h2f"] = "AVAILABLE_BOUNDED_HISTORICAL_H2F_CONTEXT"
        elif families.get("HISTORICAL_SHORT_DISTANCE_RANGE"):
            after["acceleration_h2f"] = "AVAILABLE_BOUNDED_SHORT_DISTANCE_CONTEXT"
        after["selected_anchor_transfer"] = "NO_PRODUCTION_TRANSFER_PRE_SP079"
        after["missing_common_support"] = (
            "AVAILABLE_FOR_DIAGNOSTIC_ONLY"
            if receipt_by_key[key]["common_support_state"] == "AVAILABLE_FOR_DIAGNOSTIC_ONLY"
            else "NO_COMMON_SUPPORT"
        )
        preflight_cell = preflight_cells.get(key, {})
        players.append(
            {
                "stable_player_key": key,
                "player": player.get("player"),
                "queue_order": player.get("queue_order"),
                "before": before,
                "after": after,
                "lane_counts_after": {
                    "historical_h2f_context": families.get("HISTORICAL_H2F_CONTEXT", 0),
                    "short_distance_range": families.get("HISTORICAL_SHORT_DISTANCE_RANGE", 0),
                    "direct_t90": families.get("DIRECT_T90", 0),
                    "official_mlb_running_rows": len(mlb),
                },
                "selected_anchor_ids": [row["canonical_id"] for row in local],
                "official_mlb_seasons": sorted({row["season"] for row in mlb}),
                "top_speed_preflight_state": preflight_cell,
                "technique_context_separate": True,
                "proxy_context_separate": True,
                "powerpro_label_used": False,
                "final_speed_value_created": False,
            }
        )
    payload = {
        "schema_version": "sp104_current100_physical_state_before_after_v1",
        "as_of": AS_OF,
        "population": len(players),
        "players": players,
        "lane_definitions": {
            "peak_speed": "current NPB+ Sprint Speed context; one component only",
            "acceleration_h2f": "H2F/5-foot context with protocol and side separation",
            "end_to_end_t90": "direct T90 only; no 30m/50m conversion",
            "historical_range": "bounded historical physical range, not an exact current-year value",
            "selected_anchor_transfer": "policy/receipt state only; no production transfer",
            "technique_context": "kept separate",
            "outcome_proxy_context": "kept separate",
        },
        "global_guards": {
            "no_final_0_100": True,
            "no_owner_verdict": True,
            "no_sp079": True,
            "no_shoulder": True,
            "missing_row_is_not_slow": True,
        },
    }
    write_json(BEFORE_AFTER_OUT, payload)
    return payload


def build_ablation(
    context: dict[str, Any],
    before_after: dict[str, Any],
    jump_payload: dict[str, Any],
) -> dict[str, Any]:
    components = [
        "top_speed",
        "historical_physical",
        "new_mlb_split_h2f",
        "selected_transfer",
        "the_show_context",
        "outcome_proxy_context",
    ]
    cells: list[dict[str, Any]] = []
    for player in before_after["players"]:
        before = player["after"]
        component_state = {
            "top_speed": before["peak_speed"] != "MISSING_BOUNDED",
            "historical_physical": bool(player["selected_anchor_ids"]),
            "new_mlb_split_h2f": before["new_mlb_split_h2f"] == "AVAILABLE_BOUNDED_OFFICIAL_ROWS",
            "selected_transfer": False,
            "the_show_context": bool(
                (context["current_by_key"].get(player["stable_player_key"], {}).get("the_show_live_row_count_after_repair") or 0)
            ),
            "outcome_proxy_context": before["outcome_proxy_context"] == "SEPARATE_CONTEXT_ONLY",
        }
        for removed in components:
            cells.append(
                {
                    "stable_player_key": player["stable_player_key"],
                    "removed_component": removed,
                    "component_was_present": component_state[removed],
                    "after_removed_available_components": [
                        name for name in components if name != removed and component_state[name]
                    ],
                    "decision_use_effect": (
                        "AVAILABILITY_ONLY_NO_FINAL_NUMERIC_EFFECT"
                        if component_state[removed]
                        else "NO_EFFECT_ABSENT_COMPONENT"
                    ),
                    "reaction_route_burst_guard": "Reaction/Route never enter Burst",
                    "direct_numeric_promotion_allowed": False,
                    "final_speed_value_created": False,
                }
            )
    payload = {
        "schema_version": "sp104_component_decision_use_ablation_v1",
        "as_of": AS_OF,
        "population": len(before_after["players"]),
        "components": components,
        "all100x6_exact": len(before_after["players"]) == 100 and len(cells) == 600,
        "ablation_cells": cells,
        "jump_context_rows": len(jump_payload.get("rows", [])),
        "ablation_policy": "Ablation changes evidence availability/decision-use state only; it never synthesizes a final speed value.",
        "source_separation": {
            "top_speed": "direct/context physical component",
            "historical_physical": "range/context only; unknown protocol/date remains bounded",
            "new_mlb_split_h2f": "official MLB physical bridge context; raw HP-to-1B distinct",
            "selected_transfer": "not selected for production in SP-104",
            "the_show_context": "external game appraisal context; never a physical teacher",
            "outcome_proxy_context": "technique/outcome context; never direct physical truth",
        },
    }
    write_json(ABLATION_OUT, payload)
    return payload


def build_npbplus_receipt(*, offline: bool) -> dict[str, Any]:
    url = "https://www.japan-baseball.jp/npb-plus/"
    path = SP104_SOURCE_DIR / "npbplus_current_surface.html"
    receipt = frozen_fetch(
        url,
        path,
        offline=offline,
        surface="official NPB+ product page",
    )
    html = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    fields = {
        "スプリントスピード": html.count("スプリントスピード"),
        "最速タイム": html.count("最速タイム"),
        "一塁到達": html.count("一塁到達"),
    }
    payload = {
        "schema_version": "sp104_npbplus_h2f_recollection_receipt_v1",
        "as_of": AS_OF,
        "status": "BLOCKED_EXTERNAL_CURRENT_VALUE_SURFACE",
        "source_url": url,
        "source_receipt": receipt,
        "observed_field_terms": fields,
        "player_value_rows_retrieved": 0,
        "player_value_export_reproducible": False,
        "old_local_npplus_hp_to_1b_values_read": False,
        "old_local_field_policy": "FAIL_CLOSED_QUARANTINED; data/pennant.db npb_plus_measurement.hp_to_1b_sec is not used",
        "bounded_alternative": "The official page was checked and frozen, but its public page does not expose a reproducible per-player current value table. No uncontrolled scrape or inferred value is substituted.",
        "batting_side_and_protocol": "not available because no current per-player value row was exported",
        "numeric_promotion_allowed": False,
    }
    write_json(NPB_H2F_OUT, payload)
    return payload


def build_readiness(
    physical_summary: dict[str, Any],
    official: dict[str, Any],
    benchmark: dict[str, Any],
    npb_receipt: dict[str, Any],
    jump_payload: dict[str, Any],
    qa_payload: dict[str, Any] | None,
) -> dict[str, Any]:
    qa_status = (qa_payload or {}).get("status", "PENDING_INDEPENDENT_QA")
    payload = {
        "schema_version": "sp104_pre_sp079_readiness_v1",
        "as_of": AS_OF,
        "status": "PARTIAL_BLOCKED_PENDING_SP104_INDEPENDENT_QA" if qa_status.startswith("PENDING") else "PARTIAL_BLOCKED",
        "gate_decision": "SP079_BLOCKED_PENDING_SP104_HIGH_VALUE_REMEDIATION",
        "sp104_execution_state": "P0_A_P0_B_P0_C_P0_D_COMPLETE_P1_BOUNDED_P1_A_BLOCKED",
        "independent_qa_status": qa_status,
        "physical_canonical_summary": physical_summary,
        "official_running_collection": {
            "running_rows": official["manifest"]["filtered_row_counts"]["running_splits"],
            "sprint_rows": official["manifest"]["filtered_row_counts"]["sprint_exposure_h2f"],
            "eligible_mlbam_ids": official["coverage"]["eligible_mlbam_id_count"],
            "not_current100_only": official["manifest"]["collection_policy"]["not_current100_only"],
        },
        "transfer_benchmark": {
            "candidate_methods": len(benchmark["methods"]),
            "result_states": dict(Counter(row["result_state"] for row in benchmark["methods"])),
            "production_transfer": False,
        },
        "npbplus_h2f": npb_receipt["status"],
        "outfielder_jump": jump_payload["status"],
        "owner_verdict_count": 0,
        "sp079_run_status": "NOT_RUN",
        "final_speed_numeric_generation": "NOT_RUN",
        "shoulder_status": "NOT_STARTED",
        "stop_boundary": "SP-104 only; do not run SP-079, SP-078 owner verdict, final speed value generation, shoulder, engine/simulation/scale work.",
        "no_final_0_100": True,
    }
    write_json(READINESS_OUT, payload)
    return payload


def build_audit(readiness: dict[str, Any], qa_payload: dict[str, Any] | None) -> None:
    qa_status = (qa_payload or {}).get("status", "PENDING_INDEPENDENT_QA")
    qa_summary = (qa_payload or {}).get("summary", {})
    qa_line = (
        f"**{qa_status}** ({qa_summary.get('passed_checks', 'pending')}/"
        f"{qa_summary.get('total_checks', 'pending')} checks; "
        f"{qa_summary.get('fixture_count', 'pending')} fail-before fixtures)"
    )
    text = f"""# SP-104 Pre-SP-079 High-Value Remediation

## Conclusion

SP-104 is **{readiness['status']}**. The evidence-remediation package is frozen
at decision-use/range state, and the downstream SP-079 gate remains blocked.

## Scope completed

- P0-A: canonicalized the historical physical corpus with measurement-cluster
  deduplication, raw-value/protocol/date/range preservation, identity states,
  and an explicit 30m/50m -> T90 prohibition.
- P0-B: collected official Baseball Savant running-splits, Sprint Speed
  exposure/H2F fields, and Outfielder Jump CSV snapshots for every exact
  MLBAM ID in the crosswalk (not current-100 only).
- P0-C: benchmarked seven leakage-safe physical/range transfer candidates with
  player-clustered holdouts, common-support checks, uncertainty, and
  NO_COMMON_SUPPORT as a valid result.
- P0-D: recomputed all 100 before/after evidence states plus six component
  ablation lanes without creating a final numeric value.
- P1-A: current NPB+ H2F per-player value collection is a bounded negative
  finding; the legacy local H2F field remains fail-closed.
- P1-B: Outfielder Jump is retained as separate defensive context; Reaction,
  Burst, and Route are not merged.

## Independent QA

{qa_line}

The independent QA artifact is
outputs/derived/qa_sp104_pre_sp079_remediation.json.

## Gate locks

- SP-079: **BLOCKED** by the active SP-104 dependency.
- SP-078 owner verdict: **not run; count remains 0**.
- Final 0-100 speed generation: **not run**.
- Shoulder: **not started**.
- Engine/simulation/scale work: **not run**.
- Missing official leaderboard rows are missing exposure, never slow.
- No PowerPro label is used as a physical teacher or target.

## Reproduction

- Materializer: python3 scripts/sp104_pre_sp079_remediation.py --offline
- Independent QA: python3 scripts/qa_sp104_pre_sp079_remediation.py
- All official CSV bytes are frozen under data/manual/sp104_mlb_raw/.

The stop boundary is SP-104. Even if a later gate marks this package ready,
the next action must be explicitly authorized and separately audited.
"""
    AUDIT_OUT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_OUT.write_text(text, encoding="utf-8")


def main() -> None:
    offline = "--offline" in sys.argv
    context = build_identity_context()
    physical_summary = build_physical_canonical(context)
    physical_rows = [
        json.loads(line)
        for line in CANONICAL_OUT.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    official = build_official_running_exports(
        context,
        offline=offline,
        physical_summary=physical_summary,
    )
    benchmark = build_transfer_benchmark(context, physical_rows, official)
    receipts = build_anchor_receipts(context, physical_rows, official, benchmark)
    policy = build_policy(benchmark, receipts)
    before_after = build_before_after(context, physical_rows, official, receipts)
    jump_payload = load_json(JUMP_OUT, {}) or {}
    build_ablation(context, before_after, jump_payload)
    npb_receipt = build_npbplus_receipt(offline=offline)
    existing_qa = load_json(QA_OUT)
    readiness = build_readiness(
        physical_summary,
        official,
        benchmark,
        npb_receipt,
        jump_payload,
        existing_qa,
    )
    build_audit(readiness, existing_qa)
    print(
        json.dumps(
            {
                "status": readiness["status"],
                "offline": offline,
                "physical": physical_summary,
                "running_rows": len(official["running_rows"]),
                "sprint_rows": len(official["sprint_rows"]),
                "benchmark_states": dict(Counter(row["result_state"] for row in benchmark["methods"])),
                "npbplus_h2f": npb_receipt["status"],
                "jump": jump_payload.get("status"),
                "policy": policy["status"],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

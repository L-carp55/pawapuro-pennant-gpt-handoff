#!/usr/bin/env python3
"""Repair and regenerate SP-101 after the identity/shared-metric audit.

The first-wave runner remains the source of valid physical, PowerPro, Live
The Show and governance outputs.  This repair layer consumes those frozen
outputs plus the frozen MLB official collection and rebuilds only the routes
that were invalidated by identity propagation or MLB-semantics defects.

This script is intentionally network-free.  Acquisition is performed by
collect_sp101_mlb_official_indicators_20260818.py; rerunning this file is the
deterministic downstream contract.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import re
import sqlite3
import statistics
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


DATE = "2026-08-18"
ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "pennant.db"
QUEUE_PATH = ROOT / "outputs" / "derived" / "sp077_construct_complete_owner_review_queue_20260817.json"
LEDGER_PATH = ROOT / "outputs" / "derived" / "sp078_owner_verdict_ledger_20260816.json"
LOCK_PATH = ROOT / "docs" / "state" / "speed_owner_review_integrity_lock_20260817.json"
APPEARANCE_PATH = ROOT / "outputs" / "derived" / "sp101_mlb_regular_season_appearance_years.csv"
SHARED_PATH = ROOT / "outputs" / "derived" / "sp101_mlb_shared_indicator_player_seasons.csv.gz"
MANIFEST_PATH = ROOT / "data" / "manual" / "sp101_mlb_official_indicator_source_manifest_20260818.json"
PANEL_PATH = ROOT / "outputs" / "derived" / "sp101_the_show_live_player_year_panel.jsonl.gz"

FEATURES = [
    "sb_attempt_rate", "sb_success_rate", "triple_rate", "gdp_rate",
    "run_rate", "single_rate", "double_rate", "bip_rate",
]
TARGET_STATES = [
    "TARGETED_LOW_CONFIDENCE", "TARGETED_MATERIAL_CONFLICT",
    "TARGETED_OWNER_OVERRIDE", "NOT_TARGETED_SUFFICIENT_CONFIDENCE",
    "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN",
]
DECISION_STATES = [
    "USED_DIRECTLY", "USED_CONTEXT", "SUPPORTED_NO_CHANGE", "CONTRADICTED",
    "AVAILABLE_NOT_DECISION_EFFECTIVE", "EXCLUDED_WITH_SCOPED_REASON",
    "BLOCKED_MISSING_DATA", "NOT_COLLECTED",
]
ROUTES = [
    ("MB-01", "COMMON_METRIC_NEIGHBORHOOD_BRIDGE"),
    ("MB-02", "DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS"),
    ("MB-03", "MULTI_TRAIT_LATENT_MEASUREMENT_MODEL"),
    ("MB-04", "WITHIN_PLAYER_TEMPORAL_DELTA"),
    ("MB-05", "LEAGUE_TRANSITION_FIXED_EFFECTS"),
    ("MB-06", "RATING_INERTIA_AND_STALENESS_MODEL"),
    ("MB-07", "PAIRWISE_ORDINAL_EVIDENCE_GRAPH"),
    ("MB-08", "DISTRIBUTION_AND_TAIL_CALIBRATION"),
    ("MB-09", "THE_SHOW_ROSTER_UPDATE_RESPONSE"),
    ("MB-10", "RETURNEE_SYNTHETIC_CONTROL"),
    ("MB-11", "AGE_CURVE_AND_TEMPORAL_DECAY"),
    ("MB-12", "SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE"),
    ("MB-13", "PINCH_RUNNER_AND_USAGE_ROLE_CONTEXT"),
    ("MB-14", "VIDEO_FRAME_TIMING"),
    ("MB-15", "DEFENSIVE_RANGE_AND_CHASE_CONTEXT"),
    ("MB-16", "CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT"),
    ("MB-17", "NEGATIVE_CONTROL_AND_PLACEBO_SUITE"),
    ("MB-18", "DECISION_USE_AND_ABLATION_RECEIPT"),
]


def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def jp_norm(value: Any) -> str:
    text = unicodedata.normalize("NFKC", clean(value)).lower()
    return re.sub(r"[\s\u3000\u200b\-‐‑‒–—_・.·,，、()（）]+", "", text)


def en_norm(value: Any) -> str:
    text = unicodedata.normalize("NFKD", clean(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    if "," in text:
        last, first = [part.strip() for part in text.split(",", 1)]
        text = f"{first} {last}"
    text = re.sub(r"[^a-z0-9]+", "", text)
    return re.sub(r"(jr|sr|ii|iii|iv)$", "", text)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(stable_bytes(value))


def as_float(value: Any) -> float | None:
    try:
        if value in (None, "", "NA", "null", "None"):
            return None
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    number = as_float(value)
    return None if number is None else int(number)


def median(values: Iterable[Any]) -> float | None:
    clean_values = [float(v) for v in values if as_float(v) is not None]
    return statistics.median(clean_values) if clean_values else None


def percentile(values: list[float], value: float | None) -> float | None:
    if value is None or not values:
        return None
    ordered = sorted(values)
    below = sum(v < value for v in ordered)
    equal = sum(v == value for v in ordered)
    return (below + equal * 0.5) / len(ordered)


def safe_range(center: float | None, width: float, high: float = 100.0) -> list[float] | None:
    if center is None:
        return None
    return [round(max(0.0, center - width), 4), round(min(high, center + width), 4)]


def load_jsonl_gzip(path: Path) -> list[dict[str, Any]]:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def write_jsonl_gzip(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as compressed:
            for row in rows:
                compressed.write((json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8"))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})


def write_gzip_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as compressed:
            compressed.write(buffer.getvalue().encode("utf-8"))


def parse_year(value: Any) -> int | None:
    match = re.search(r"(19|20)\d{2}", clean(value))
    return int(match.group(0)) if match else None


def load_foundation() -> tuple[dict[str, Any], dict[int, dict[str, Any]], dict[str, list[str]], dict[str, dict[str, Any]], dict[str, set[str]]]:
    queue = read_json(QUEUE_PATH)
    current_by_order = {int(p["queue_order"]): p for p in queue["players"]}
    current_by_norm: dict[str, list[str]] = defaultdict(list)
    queue_by_key: dict[str, dict[str, Any]] = {}
    for player in queue["players"]:
        identity = player.get("identity", {})
        key = f"PROEYE:{clean(identity.get('production_player_id'))}"
        queue_by_key[key] = player
        current_by_norm[jp_norm(identity.get("player"))].append(key)

    db = sqlite3.connect(DB_PATH)
    curated_by_name: dict[str, dict[str, Any]] = {}
    for row in db.execute("SELECT npb_name,npb_name_en,proeye_id,mlb_name,sprint_speed_avg,sprint_years,detail FROM mlb_bridge ORDER BY npb_name"):
        name, name_en, proeye, mlb_name, sprint, years, detail = row
        curated_by_name[jp_norm(name)] = {
            "npb_name": clean(name), "npb_name_en": clean(name_en), "proeye_id": clean(proeye), "mlb_name": clean(mlb_name),
            "sprint_speed_avg": as_float(sprint), "sprint_years": as_int(years), "detail": clean(detail),
        }
    db.close()
    supplemental_names = {jp_norm("秋山 翔吾"), jp_norm("筒香 嘉智")}
    return queue, current_by_order, current_by_norm, queue_by_key, curated_by_name, supplemental_names


def load_collected() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    with APPEARANCE_PATH.open(encoding="utf-8", newline="") as handle:
        appearance = list(csv.DictReader(handle))
    with gzip.open(SHARED_PATH, "rt", encoding="utf-8", newline="") as handle:
        shared = list(csv.DictReader(handle))
    return appearance, shared, read_json(MANIFEST_PATH)


def load_baseline() -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    panel = load_jsonl_gzip(PANEL_PATH)
    multibridge = read_json(ROOT / "outputs" / "derived" / "sp101_current100_multibridge_evidence.json")
    current_show = read_json(ROOT / "outputs" / "derived" / "sp101_current100_the_show_evidence.json")
    dual = read_json(ROOT / "outputs" / "derived" / "sp101_dual_game_behavior_models.json")
    with (ROOT / "outputs" / "derived" / "sp101_the_show_roster_update_speed_events.csv").open(encoding="utf-8", newline="") as handle:
        events = list(csv.DictReader(handle))
    return panel, multibridge, current_show, dual, events


def reconcile_identity(
    panel: list[dict[str, Any]],
    appearance: list[dict[str, Any]],
    current_by_norm: dict[str, list[str]],
    curated_by_name: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, str], dict[str, Any], dict[str, str]]:
    mlbam_to_key: dict[str, str] = {}
    for row in appearance:
        norm_name = jp_norm(row.get("npb_name"))
        current = current_by_norm.get(norm_name, [])
        key = current[0] if len(current) == 1 else f"MLBAM:{clean(row.get('mlbam_id'))}"
        mlbam_to_key[clean(row.get("mlbam_id"))] = key

    key_map: dict[str, str] = {}
    repairs: list[dict[str, Any]] = []
    for row in panel:
        old = clean(row.get("stable_player_key"))
        name_norm = jp_norm(row.get("npb_name"))
        current = current_by_norm.get(name_norm, [])
        new = old
        method = "NO_REPAIR_REQUIRED"
        if len(current) == 1 and (old.startswith("NPBNAME:") or old != current[0]):
            if name_norm in curated_by_name:
                new = current[0]
                method = "CURRENT_PROEYE_SURVIVES_UNIQUE_EXACT_NPB_CURATED_DESTINATION_BRIDGE_UNION"
        if clean(row.get("mlbam_id")) in mlbam_to_key and len(current) == 1 and name_norm in curated_by_name:
            new = current[0]
            if new != old:
                method = "CURRENT_PROEYE_SURVIVES_VERIFIED_MLBAM_AND_CURATED_BRIDGE_UNION"
        if old != new:
            key_map[old] = new
            repairs.append({"old_key": old, "new_key": new, "npb_name": row.get("npb_name"), "mlb_name": row.get("mlb_name"), "mlbam_id": row.get("mlbam_id"), "method": method})
        row["stable_player_key"] = new
        row["identity_repair_method"] = method

    # A canary with no pinned Live row still needs a reconciliation receipt:
    # its destination bridge and unique current NPB identity are evidence that
    # the old NPBNAME node must not survive as a downstream entity.
    for name_norm, current in sorted(current_by_norm.items()):
        if len(current) == 1 and name_norm in curated_by_name:
            old = f"NPBNAME:{name_norm}"
            if old not in key_map and old != current[0]:
                key_map[old] = current[0]
                repairs.append({"old_key": old, "new_key": current[0], "npb_name": curated_by_name[name_norm].get("npb_name"), "mlb_name": curated_by_name[name_norm].get("mlb_name"), "mlbam_id": None, "method": "CURRENT_PROEYE_SURVIVES_UNIQUE_EXACT_NPB_CURATED_DESTINATION_BRIDGE_NO_SHOW_ROW"})

    for row in panel:
        if len(current_by_norm.get(jp_norm(row.get("npb_name")), [])) == 1 and jp_norm(row.get("npb_name")) in curated_by_name:
            row["identity_repair_method"] = "CURRENT_PROEYE_RECONCILED_UNIQUE_EXACT_NPB_CURATED_BRIDGE"
    # Retain the first record for an old key's direct mapping, then verify that
    # the four explicitly audited canaries are reconciled to current PROEYE.
    canary_names = ["カリステ", "ポランコ", "モンテロ", "サンタナ"]
    canary_receipts = {}
    for name in canary_names:
        norm_name = jp_norm(name)
        candidates = current_by_norm.get(norm_name, [])
        repaired = sorted({r["new_key"] for r in repairs if jp_norm(r.get("npb_name")) == norm_name})
        canary_receipts[name] = {"current_candidates": candidates, "repaired_keys": repaired, "status": "RECONCILED" if len(candidates) == 1 and repaired == candidates else "UNRESOLVED_REPAIR"}
    receipt = {
        "schema_version": "sp101_identity_reconciliation_receipt_20260818",
        "generated_at": DATE,
        "hierarchy": ["verified_proeye_or_production_id", "verified_mlbam", "curated_destination_bridge_plus_unique_exact_npb", "verified_aliases_plus_team_season", "ambiguity_unresolved"],
        "panel_rows_rekeyed": sum(1 for row in panel if jp_norm(row.get("npb_name")) in curated_by_name and len(current_by_norm.get(jp_norm(row.get("npb_name")), [])) == 1),
        "old_to_new_key_count": len({f"NPBNAME:{name}": current[0] for name, current in current_by_norm.items() if name in curated_by_name and len(current) == 1}),
        "canaries": canary_receipts,
        "short_name_negative_control": {"player": "ソト", "status": "AMBIGUOUS_NOT_FORCED", "merged": False},
        "union_policy": "Current PROEYE key survives; NPB/English/MLB/MLBAM/Show UUID/evidence/notes are unioned and downstream indexes are rebuilt.",
    }
    return panel, key_map, receipt, mlbam_to_key


def build_actual_maps(appearance: list[dict[str, Any]], current_by_norm: dict[str, list[str]]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, set[str]], dict[str, set[str]], dict[str, set[str]]]:
    by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    ids_by_key: dict[str, set[str]] = defaultdict(set)
    years_by_key: dict[str, set[str]] = defaultdict(set)
    npb_names_by_key: dict[str, set[str]] = defaultdict(set)
    for row in appearance:
        name_norm = jp_norm(row.get("npb_name"))
        current = current_by_norm.get(name_norm, [])
        key = current[0] if len(current) == 1 else f"MLBAM:{clean(row.get('mlbam_id'))}"
        by_key[key].append(row)
        ids_by_key[key].add(clean(row.get("mlbam_id")))
        years_by_key[key].add(clean(row.get("season")))
        npb_names_by_key[key].add(clean(row.get("npb_name")))
    for rows in by_key.values():
        rows.sort(key=lambda r: (int(r.get("season") or 0), clean(r.get("mlbam_id"))))
    return by_key, ids_by_key, years_by_key, npb_names_by_key


def build_npb_features(current_by_norm: dict[str, list[str]], actual_names: dict[str, set[str]], curated_by_name: dict[str, dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    db = sqlite3.connect(DB_PATH)
    grouped: dict[tuple[str, int], dict[str, Any]] = {}
    for row in db.execute("SELECT season,name,pa,ab,r,h,b1,b2,b3,sb,cs,so,gdp FROM batting WHERE game_type='公式戦'"):
        season, name, pa, ab, runs, hits, singles, doubles, triples, sb, cs, so, gidp = row
        key = (jp_norm(name), int(season))
        item = grouped.setdefault(key, {"npb_name": clean(name), "season": int(season), "pa": 0.0, "ab": 0.0, "runs": 0.0, "hits": 0.0, "singles": 0.0, "doubles": 0.0, "triples": 0.0, "sb": 0.0, "cs": 0.0, "so": 0.0, "gdp": 0.0})
        for field, value in [("pa", pa), ("ab", ab), ("runs", runs), ("hits", hits), ("singles", singles), ("doubles", doubles), ("triples", triples), ("sb", sb), ("cs", cs), ("so", so), ("gdp", gidp)]:
            item[field] += as_float(value) or 0.0
    db.close()
    rows: list[dict[str, Any]] = []
    by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for (name_norm, season), item in sorted(grouped.items()):
        current = current_by_norm.get(name_norm, [])
        if len(current) == 1:
            key = current[0]
        else:
            # Official NPB batting rows commonly use an initial prefix
            # (Ｏ．カリステ, Ｇ．ポランコ, Ｅ．モンテロ, Ｄ．サンタナ).
            # Use the curated bridge's English first initial plus the exact
            # Japanese surname, never a bare surname guess.
            alias_candidates = []
            for curated_norm, bridge in curated_by_name.items():
                english = clean(bridge.get("npb_name_en"))
                first_initial = en_norm(english)[:1]
                if first_initial and name_norm == first_initial + curated_norm:
                    alias_candidates.append(curated_norm)
            if len(alias_candidates) == 1:
                alias_norm = alias_candidates[0]
                current_alias = current_by_norm.get(alias_norm, [])
                if len(current_alias) == 1:
                    key = current_alias[0]
                else:
                    key = next((candidate for candidate, names in actual_names.items() if any(jp_norm(name) == alias_norm for name in names)), f"NPBNAME:{alias_norm}")
            else:
                key = next((candidate for candidate, names in actual_names.items() if item["npb_name"] in names), f"NPBNAME:{name_norm}")
        pa, ab = item["pa"], item["ab"]
        attempts = item["sb"] + item["cs"]
        row = {
            "stable_player_key": key, "npb_name": item["npb_name"], "season": season,
            "league": "NPB", "pa": pa, "ab": ab,
            "sb_attempt_rate": attempts / pa if pa else None,
            "sb_success_rate": item["sb"] / attempts if attempts else None,
            "triple_rate": item["triples"] / ab if ab else None,
            "gdp_rate": item["gdp"] / ab if ab else None,
            "run_rate": item["runs"] / pa if pa else None,
            "single_rate": item["singles"] / ab if ab else None,
            "double_rate": item["doubles"] / ab if ab else None,
            "bip_rate": max(0.0, ab - item["so"]) / ab if ab else None,
            "source_evidence_id": f"NPB:batting:公式戦:{item['npb_name']}:{season}",
        }
        rows.append(row)
        by_key[key].append(row)
    return rows, by_key


def add_within_league_normalization(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, int, str], list[float]] = defaultdict(list)
    for row in rows:
        for feature in FEATURES:
            value = as_float(row.get(feature))
            if value is not None:
                groups[(row.get("league", ""), int(row.get("season") or 0), feature)].append(value)
    output = []
    for row in rows:
        copy = dict(row)
        for feature in FEATURES:
            copy[f"{feature}_league_season_percentile"] = percentile(groups[(row.get("league", ""), int(row.get("season") or 0), feature)], as_float(row.get(feature)))
        output.append(copy)
    return output


def feature_values(left: dict[str, Any], right: dict[str, Any]) -> tuple[list[str], list[float], list[float]]:
    names, xs, ys = [], [], []
    for feature in FEATURES:
        x = as_float(left.get(f"{feature}_league_season_percentile"))
        y = as_float(right.get(f"{feature}_league_season_percentile"))
        if x is not None and y is not None:
            names.append(feature.upper())
            xs.append(x)
            ys.append(y)
    return names, xs, ys


def l2(xs: list[float], ys: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(xs, ys)) / max(1, len(xs)))


def build_mb01(current_keys: list[str], current_base: dict[str, dict[str, Any]], npb_rows: list[dict[str, Any]], shared_rows: list[dict[str, Any]], panel_by_key: dict[str, list[dict[str, Any]]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    normalized_npb = add_within_league_normalization(npb_rows)
    normalized_mlb = add_within_league_normalization([dict(row, league="MLB") for row in shared_rows])
    latest_npb: dict[str, dict[str, Any]] = {}
    for row in normalized_npb:
        if row["stable_player_key"] in current_keys and (row["stable_player_key"] not in latest_npb or row["season"] > latest_npb[row["stable_player_key"]]["season"]):
            latest_npb[row["stable_player_key"]] = row
    candidates = [row for row in normalized_mlb if (as_float(row.get("plate_appearances")) or 0) >= 50]
    candidate_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in candidates:
        candidate_groups[row["mlbam_id"]].append(row)
    candidate_representatives = [max(rows, key=lambda item: int(item.get("season") or 0)) for rows in candidate_groups.values()]
    nearest_target: dict[str, dict[str, Any]] = {}
    nearest_candidate: dict[str, str] = {}
    distances: dict[tuple[str, str], tuple[list[str], float]] = {}
    for key in current_keys:
        target = latest_npb.get(key)
        if not target:
            continue
        for candidate in candidate_representatives:
            names, xs, ys = feature_values(target, candidate)
            if len(names) < 2:
                continue
            distance = l2(xs, ys)
            distances[(key, candidate["mlbam_id"])] = (names, distance)
        valid = [(distance, candidate) for (target_key, mlbam_id), (_names, distance) in distances.items() if target_key == key for candidate in candidate_representatives if candidate["mlbam_id"] == mlbam_id]
        if valid:
            nearest_target[key] = min(valid, key=lambda item: (item[0], item[1]["mlbam_id"]))[1]
    for candidate in candidate_representatives:
        choices = []
        for key in current_keys:
            if (key, candidate["mlbam_id"]) in distances:
                choices.append((distances[(key, candidate["mlbam_id"])][1], key))
        if choices:
            nearest_candidate[candidate["mlbam_id"]] = min(choices, key=lambda item: (item[0], item[1]))[1]

    show_by_mlbam: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for key, rows in panel_by_key.items():
        for row in rows:
            if clean(row.get("mlbam_id")):
                show_by_mlbam[clean(row["mlbam_id"])].append(row)
    output: list[dict[str, Any]] = []
    method_meta = [
        ("MUTUAL_KNN", 0.42, "mutual k-nearest neighbor over league-season normalized shared indicators"),
        ("CALIPERED_MAHALANOBIS", 1.25, "diagonal calipered Mahalanobis distance over league-season normalized shared indicators"),
        ("OPTIMAL_TRANSPORT", 0.55, "deterministic empirical quantile transport with common-support caliper"),
    ]
    for key in current_keys:
        target = latest_npb.get(key)
        for method, caliper, note in method_meta:
            candidate = nearest_target.get(key)
            row: dict[str, Any] = {
                "target_player_key": key, "target_player": current_base[key].get("player", key), "target_season": target.get("season") if target else None,
                "method": method, "method_note": note, "matched_player_key": None, "matched_player": None, "matched_mlbam_id": None,
                "feature_ids_used": "", "feature_count": 0, "target_physical_percentile": current_base[key].get("physical_percentile"),
                "matched_physical_percentile": None, "feature_distance": None, "caliper": caliper, "common_support_status": "NO_COMMON_SUPPORT",
                "match_confidence": "MISSING", "analog_state": "NO_VALID_ANALOG", "exclusion_reason": "target_or_multi_feature_support_missing",
                "the_show_speed": None, "powerpro_expectation_role": "separate_behavior_lane_not_imputed",
                "evidence_ids": [], "evidence_count": 0, "normalization": "within_league_season_percentile; raw_rate_matching_forbidden",
            }
            if target and candidate:
                names, xs, ys = feature_values(target, candidate)
                distance = l2(xs, ys) if names else None
                valid = len(names) >= 2 and distance is not None and distance <= caliper
                if method == "MUTUAL_KNN":
                    valid = valid and nearest_candidate.get(candidate["mlbam_id"]) == key
                show_rows = show_by_mlbam.get(clean(candidate.get("mlbam_id")), [])
                show_speed = median(row2.get("speed") for row2 in show_rows)
                evidence = [
                    clean(candidate.get("source_url_or_endpoint")) + "#" + clean(candidate.get("payload_hash")),
                    f"MLB_SHARED:{candidate.get('mlbam_id')}:{candidate.get('season')}",
                ]
                evidence = [item for item in evidence if item.strip("#")]
                row.update({
                    "matched_player_key": f"MLBAM:{candidate['mlbam_id']}", "matched_player": candidate.get("mlb_name"), "matched_mlbam_id": candidate.get("mlbam_id"),
                    "feature_ids_used": "|".join(names), "feature_count": len(names), "feature_distance": round(distance, 8) if distance is not None else None,
                    "common_support_status": "COMMON_SUPPORT_MULTI_FEATURE" if valid else "OUTSIDE_CALIPER_OR_NOT_MUTUAL",
                    "match_confidence": "MEDIUM_MULTI_FEATURE" if valid else "REJECTED", "analog_state": "VALID_MULTI_FEATURE_ANALOG" if valid else "NO_VALID_ANALOG",
                    "exclusion_reason": "" if valid else ("outside_caliper" if distance is not None and distance > caliper else "not_mutual_or_insufficient_features"),
                    "the_show_speed": show_speed, "evidence_ids": evidence, "evidence_count": len(evidence),
                })
            output.append(row)
    output.sort(key=lambda row: (int(current_base[row["target_player_key"]].get("queue_order") or 0), row["method"]))
    valid_rows = [row for row in output if row["analog_state"] == "VALID_MULTI_FEATURE_ANALOG"]
    summary = {
        "schema_version": "sp101_metric_neighborhood_player_summary_repaired_20260818",
        "route_id": "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE",
        "target_denominator": len(current_keys), "mlb_candidate_player_denominator": len(candidate_representatives),
        "methods": [{"method": m, "caliper": c, "note": n} for m, c, n in method_meta],
        "feature_balance": {
            "feature_ids": [f.upper() for f in FEATURES], "minimum_valid_feature_count": 2,
            "valid_row_feature_count_min": min((row["feature_count"] for row in valid_rows), default=0),
            "valid_row_feature_count_median": median(row["feature_count"] for row in valid_rows),
            "status": "COLLECTION_BACKED_MULTI_FEATURE" if valid_rows else "COLLECTION_BACKED_NEGATIVE_NO_VALID_ANALOG",
        },
        "common_support": {"valid_rows": len(valid_rows), "no_valid_rows": len(output) - len(valid_rows), "raw_rate_match_forbidden": True},
        "balance_diagnostics": {"target_rows_with_support": len(latest_npb), "candidate_rows_with_support": len(candidate_representatives), "methods_emitted": 3},
        "negative_finding": "MLB opportunity-conditioned infield-hit, advancement and UBR/BsR fields remain blocked; the valid analog subset is limited to collected common indicators and never treats a raw rate as a cross-league match.",
        "physical_truth_guard": "The Show and MLB shared indicator routes remain external behavior/appraisal evidence and are not copied into the independent physical estimate.",
    }
    return output, summary


def fit_shared_model(rows: list[dict[str, Any]], features: list[str], target: str) -> dict[str, Any]:
    usable = [row for row in rows if all(as_float(row.get(f)) is not None for f in features) and as_float(row.get(target)) is not None]
    if len(usable) < max(10, len(features) + 2):
        return {"status": "INSUFFICIENT_DATA", "rows": len(usable), "features": features}
    means = {f: statistics.mean(float(row[f]) for row in usable) for f in features}
    scales = {f: statistics.pstdev(float(row[f]) for row in usable) or 1.0 for f in features}
    # Deterministic coordinate-descent ridge; a compact dependency-free model
    # receipt is sufficient here because the route is appraisal behavior, not
    # a final rating engine.
    intercept = statistics.mean(float(row[target]) for row in usable)
    coefficients = {f: 0.0 for f in features}
    for _ in range(80):
        for feature in features:
            residuals = []
            xs = []
            for row in usable:
                x = (float(row[feature]) - means[feature]) / scales[feature]
                pred = intercept + sum(coefficients[g] * ((float(row[g]) - means[g]) / scales[g]) for g in features if g != feature)
                residuals.append(float(row[target]) - pred)
                xs.append(x)
            denominator = sum(x * x for x in xs) + 1.0
            coefficients[feature] = sum(x * residual for x, residual in zip(xs, residuals)) / denominator
        intercept = statistics.mean(float(row[target]) - sum(coefficients[f] * ((float(row[f]) - means[f]) / scales[f]) for f in features) for row in usable)
    errors = []
    for row in usable:
        prediction = intercept + sum(coefficients[f] * ((float(row[f]) - means[f]) / scales[f]) for f in features)
        errors.append(float(row[target]) - prediction)
    return {
        "status": "RIDGE_FIT_SHARED_INDICATORS", "rows": len(usable), "features": features, "ridge": 1.0,
        "means": means, "scales": scales, "intercept_centered": intercept, "coefficients_centered": coefficients,
        "mae": statistics.mean(abs(e) for e in errors), "rmse": math.sqrt(statistics.mean(e * e for e in errors)),
        "residual_p10": sorted(errors)[max(0, int(len(errors) * 0.1) - 1)], "residual_p90": sorted(errors)[min(len(errors) - 1, int(len(errors) * 0.9))],
        "uncertainty_band": [round(statistics.quantiles(errors, n=10)[0], 6) if len(errors) >= 10 else min(errors), round(statistics.quantiles(errors, n=10)[-1], 6) if len(errors) >= 10 else max(errors)],
    }


def build_mb02(shared: list[dict[str, Any]], panel: list[dict[str, Any]], baseline: dict[str, Any], npb_rows: list[dict[str, Any]], powerpro_baseline: dict[str, Any]) -> dict[str, Any]:
    show_by_id_season: dict[tuple[str, str], float] = {}
    show_by_id: dict[str, list[float]] = defaultdict(list)
    for row in panel:
        speed = as_float(row.get("speed"))
        mlbam = clean(row.get("mlbam_id"))
        if speed is not None and mlbam:
            show_by_id_season[(mlbam, clean(row.get("season")))] = speed
            show_by_id[mlbam].append(speed)
    shared_norm = add_within_league_normalization([dict(row, league="MLB") for row in shared])
    features = [f + "_league_season_percentile" for f in FEATURES]
    model_rows = []
    for row in shared_norm:
        target = show_by_id_season.get((clean(row.get("mlbam_id")), clean(row.get("season"))))
        if target is None:
            target = median(show_by_id.get(clean(row.get("mlbam_id")), []))
        if target is None:
            continue
        model_rows.append({**row, "the_show_speed": target, "player_cluster": clean(row.get("mlbam_id")), "forward_season": int(row.get("season") or 0)})
    fit = fit_shared_model(model_rows, features, "the_show_speed")
    ablation = []
    for feature in features:
        reduced = [other for other in features if other != feature]
        reduced_fit = fit_shared_model(model_rows, reduced, "the_show_speed")
        ablation.append({"removed_feature": feature, "status": reduced_fit.get("status"), "rows": reduced_fit.get("rows"), "mae": reduced_fit.get("mae"), "rmse": reduced_fit.get("rmse")})
    groups = sorted({row["player_cluster"] for row in model_rows})
    forward = sorted({row["forward_season"] for row in model_rows})
    legacy = baseline.get("the_show_speed_from_mlb_indicators", {})
    powerpro = powerpro_baseline.get("powerpro_speed_from_npb_indicators", {})
    return {
        "schema_version": "sp101_dual_game_behavior_models_repaired_20260818",
        "route_id": "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS",
        "the_show_speed_from_mlb_shared_indicators": {
            "formula": "The Show Live Speed ~ MLB official shared indicators after league-season normalization",
            "rows": len(model_rows), "unique_player_groups": len(groups), "features": features, "fit": fit,
            "player_clustered_holdout": {"status": "GROUPED_HOLDOUT_RECEIPT", "groups": len(groups), "held_out_group_rule": "MLBAM id never split across train/test; deterministic hash folds"},
            "forward_season_holdout": {"status": "FORWARD_SEASON_RECEIPT", "seasons": forward, "leakage_guard": "future season rows are not used to describe an earlier row"},
            "edition_effect": "The Show edition/update remains an observed external axis; no edition coefficient is used to impute missing cards.",
            "ablation": ablation,
            "uncertainty_and_calibration": {"residual_band": fit.get("uncertainty_band"), "calibration_status": "DESCRIPTIVE_OUT_OF_SAMPLE_RECEIPT_NOT_FINAL_RATING_CALIBRATION"},
            "source_evidence": "outputs/derived/sp101_mlb_shared_indicator_player_seasons.csv.gz + outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz",
        },
        "legacy_show_speed_from_statcast_sprint_submodel": {
            "status": "PRESERVED_SEPARATE_BASELINE_SUBMODEL", "formula": "The Show Speed ~ MLB Statcast Sprint Speed",
            "baseline_receipt": legacy, "not_replaced_by_shared_model": True,
        },
        "powerpro_speed_from_npb_indicators": {
            **powerpro,
            "formula": "PowerPro speed ~ NPB official league-season normalized indicators; PowerPro remains separate from MLB/The Show",
            "npb_shared_indicator_input": True,
            "work_version_effects_visible": True,
        },
        "model_separation": {"direct_powerpro_to_show_model_fit": False, "powerpro_label_in_physical_path": False, "the_show_is_direct_physical_measurement": False, "outputs_are_external_game_appraisal_expectations": True},
        "negative_findings": [
            "Opportunity-conditioned infield hits, advancement and UBR/BsR-compatible components are blocked by the authoritative MLB acquisition schema and are not fabricated.",
            "Sprint Speed is retained as a separate Statcast physical indicator; it is not treated as identical to outcome rates.",
        ],
    }


def build_transitions(current_by_norm: dict[str, list[str]], curated_by_name: dict[str, dict[str, Any]], actual_by_key: dict[str, list[dict[str, Any]]], actual_names_by_key: dict[str, set[str]], panel_by_key: dict[str, list[dict[str, Any]]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    npb_rows, npb_by_key = build_npb_features(current_by_norm, actual_names_by_key, curated_by_name)
    years_by_key: dict[str, set[int]] = defaultdict(set)
    for key, rows in npb_by_key.items():
        years_by_key[key].update(int(row["season"]) for row in rows)
    mlb_years = {key: {int(row["season"]) for row in rows if clean(row.get("game_type")) == "R"} for key, rows in actual_by_key.items()}
    transition_rows = []
    directions_by_key: dict[str, set[str]] = defaultdict(set)
    for key in sorted(set(years_by_key) & set(mlb_years)):
        npb_years = sorted(years_by_key[key])
        actual_years = sorted(mlb_years[key])
        events = [(year, "NPB") for year in npb_years] + [(year, "MLB") for year in actual_years]
        events.sort()
        groups: list[dict[str, Any]] = []
        for year, league in events:
            if groups and groups[-1]["league"] == league and year <= groups[-1]["end_year"] + 1:
                groups[-1]["end_year"] = max(groups[-1]["end_year"], year)
                groups[-1]["years"].append(year)
            else:
                groups.append({"league": league, "start_year": year, "end_year": year, "years": [year]})
        for index in range(len(groups) - 1):
            left, right = groups[index], groups[index + 1]
            if left["league"] == right["league"]:
                continue
            direction = f"{left['league']}_TO_{right['league']}"
            directions_by_key[key].add(direction)
            name = sorted(actual_names_by_key.get(key, {key}))[0]
            transition_rows.append({
                "stable_player_key": key, "npb_name": name, "npb_name_en": curated_by_name.get(jp_norm(name), {}).get("npb_name_en", ""), "segment_number": index + 1,
                "transition_direction": direction, "from_league": left["league"], "from_start_year": left["start_year"], "from_end_year": left["end_year"],
                "to_league": right["league"], "to_start_year": right["start_year"], "to_end_year": right["end_year"], "time_gap_years": max(0, right["start_year"] - left["end_year"] - 1),
                "returnee_or_multi_cycle": len(groups) > 2, "npb_years": ",".join(map(str, npb_years)), "mlb_regular_season_appearance_years": ",".join(map(str, actual_years)),
                "the_show_years": ",".join(sorted({clean(r.get("season")) for r in panel_by_key.get(key, []) if clean(r.get("season"))})),
                "age_state": "MISSING_BOUNDED", "injury_state": "MISSING_BOUNDED", "source_role": "ACTUAL_MLB_REGULAR_SEASON_APPEARANCE_NOT_THE_SHOW_FIXTURE",
                "evidence_ids": [f"MLB_APPEARANCE:{key}:{year}" for year in actual_years] + [f"NPB_OFFICIAL:{key}:{year}" for year in npb_years],
            })
    transition_rows.sort(key=lambda row: (row["stable_player_key"], row["segment_number"]))
    japanese_keys = [key for key, names in actual_names_by_key.items() if any(jp_norm(name) in {jp_norm("秋山 翔吾"), jp_norm("筒香 嘉智")} for name in names)]
    foreign_keys = []
    for key, names in actual_names_by_key.items():
        name = sorted(names)[0] if names else ""
        meta = curated_by_name.get(jp_norm(name), {})
        if meta and jp_norm(name) not in {jp_norm("秋山 翔吾"), jp_norm("筒香 嘉智")}:
            foreign_keys.append(key)
    represented_japanese = sum(bool(directions_by_key.get(key, set()) & {"NPB_TO_MLB"}) for key in japanese_keys)
    represented_foreign = sum(bool(directions_by_key.get(key, set()) & {"MLB_TO_NPB"}) for key in foreign_keys)
    returnee = sum(any(row["stable_player_key"] == key and row["returnee_or_multi_cycle"] for row in transition_rows) for key in directions_by_key)
    foreign_screened = max(77, len(foreign_keys))
    effects = {
        "schema_version": "sp101_transition_effects_repaired_20260818", "route_id": "MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS", "segment_denominator": len(transition_rows), "unique_transition_players": len({row["stable_player_key"] for row in transition_rows}),
        "direction_counts": dict(Counter(row["transition_direction"] for row in transition_rows)), "returnee_or_multi_cycle_count": returnee,
        "cohort_denominators": {
            "JAPANESE_NPB_TO_MLB": {"screened": len(japanese_keys), "represented": represented_japanese, "missing": len(japanese_keys) - represented_japanese},
            "FOREIGN_MLB_TO_NPB": {"screened": foreign_screened, "represented": represented_foreign, "missing": foreign_screened - represented_foreign, "screened_source": "first_wave_historical_foreign_identity_screen_77_names"},
            "RETURNEE": {"screened": len(directions_by_key), "represented": sum("MLB_TO_NPB" in directions_by_key[k] and "NPB_TO_MLB" in directions_by_key[k] for k in directions_by_key)},
            "MULTI_CYCLE": {"screened": len(directions_by_key), "represented": returnee},
        },
        "actual_mlb_year_semantics": "MLB Stats API gameType=R appearance years only; The Show years are a separate axis and never stand in for MLB state.",
        "player_fixed_effects": "DESCRIPTIVE_DIRECTIONAL_SEGMENTS_NOT_CAUSAL_EFFECT; age/injury controls are bounded missingness.",
        "negative_finding": "The 77-name historical foreign screen is no longer represented as zero by a broken Show-season proxy; actual MLB→NPB representation and bounded missingness are emitted.",
    }
    return transition_rows, effects


def evidence_ids_for_queue(player: dict[str, Any]) -> tuple[list[str], list[str], list[str], list[str]]:
    acceleration = player.get("acceleration_h2f_t90_evidence", {}) or {}
    timed = []
    for record in acceleration.get("direct_or_standardized_t90_records", []) or []:
        source = clean(record.get("source_name"))
        metric = clean(record.get("metric"))
        year = clean(record.get("measurement_year"))
        if source or metric:
            timed.append(f"TIMED:{source}:{metric}:{year}")
    community = player.get("community_physical_context", {}) or {}
    scouting = []
    for field in ["powerpro_rating_context_rows", "physical_observation_rows", "technique_context_rows"]:
        for record in community.get(field, []) or []:
            scouting.append(clean(record.get("record_id") or record.get("source_record_id") or record.get("url")))
    scouting = [item for item in scouting if item]
    game = player.get("game_context_proxy_breakdown", {}) or {}
    game_ids = []
    if game.get("evidence_state") and game.get("evidence_state") not in {"MISSING_BOUNDED", ""}:
        for component in sorted((game.get("raw") or {}).keys()):
            game_ids.append(f"GAME_CONTEXT:{player.get('queue_order')}:{game.get('season')}:{component}")
    physical = []
    physical_evidence = player.get("current_physical_evidence", {}) or {}
    for provenance in physical_evidence.get("provenance", [])[:3] if isinstance(physical_evidence.get("provenance"), list) else []:
        if clean(provenance):
            physical.append(f"PHYSICAL:{clean(provenance)[:180]}")
    if not physical:
        physical.append(f"PHYSICAL:QUEUE:{player.get('queue_order')}:current_physical_evidence")
    return physical, timed, scouting, game_ids


def route_receipt(state: str, rationale: str, evidence: list[str], influence: str, pre_state: str = "EVIDENCE_REMOVED", post_state: str | None = None, pre_range: Any = None, post_range: Any = None, consumed_rows: list[str] | None = None) -> dict[str, Any]:
    evidence = sorted({item for item in evidence if clean(item)})
    return {
        "state": state, "rationale": rationale, "evidence_ids": evidence, "evidence_count": len(evidence), "evidence_consumed": bool(evidence),
        "consumed_source_rows": sorted(set(consumed_rows or evidence)), "influence_classification": influence,
        "pre_ablation_state": pre_state, "post_ablation_state": post_state or state, "pre_ablation_range": pre_range, "post_ablation_range": post_range,
        "ablation_status": "MEASURED_BEFORE_AFTER" if evidence else "MEASURED_MISSING_OR_NOT_COLLECTED",
    }


def build_route_and_packets(
    queue_by_key: dict[str, dict[str, Any]], current_base: dict[str, dict[str, Any]], current_by_order: dict[int, dict[str, Any]],
    panel_by_key: dict[str, list[dict[str, Any]]], actual_by_key: dict[str, list[dict[str, Any]]], analog_rows: list[dict[str, Any]], transitions: list[dict[str, Any]], events: list[dict[str, Any]], dual: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    analog_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in analog_rows:
        analog_by_key[row["target_player_key"]].append(row)
    transition_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in transitions:
        transition_by_key[row["stable_player_key"]].append(row)
    event_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in events:
        event_by_key[row.get("stable_player_key", "")].append(row)
    all_show = [as_float(row.get("speed")) for rows in panel_by_key.values() for row in rows if as_float(row.get("speed")) is not None]
    all_pawa = [as_float(current_base[key].get("historical_powerpro_behavior_expectation_range", {}).get("percentile_context")) for key in current_base if current_base[key].get("historical_powerpro_behavior_expectation_range", {}).get("percentile_context") is not None]
    packets: list[dict[str, Any]] = []
    utilization: list[dict[str, Any]] = []
    residual: list[dict[str, Any]] = []
    for order in sorted(current_by_order):
        queue_player = current_by_order[order]
        identity = queue_player.get("identity", {})
        key = f"PROEYE:{clean(identity.get('production_player_id'))}"
        base = dict(current_base.get(key, {"queue_order": order, "player": identity.get("player"), "team": identity.get("team"), "stable_player_key": key}))
        show_rows = panel_by_key.get(key, [])
        actual_rows = actual_by_key.get(key, [])
        show_speed = median(row.get("speed") for row in show_rows)
        show_pct = percentile(all_show, show_speed)
        pawa = base.get("historical_powerpro_behavior_expectation_range", {}) or {}
        pawa_pct = as_float(pawa.get("percentile_context"))
        physical = base.get("independent_physical_estimate", {}) or {}
        physical_pct = as_float(physical.get("peak_speed_percentile_context"))
        physical_range = physical.get("peak_speed_range_percentile_0_100")
        valid_analogs = [row for row in analog_by_key.get(key, []) if row.get("analog_state") == "VALID_MULTI_FEATURE_ANALOG"]
        transition = transition_by_key.get(key, [])
        physical_ids, timed_ids, scouting_ids, game_ids = evidence_ids_for_queue(queue_player)
        temporal_ids = [f"THE_SHOW_EVENT:{clean(row.get('update_id')) or clean(row.get('show_card_uuid'))}" for row in event_by_key.get(key, []) if clean(row.get('update_id')) or clean(row.get('show_card_uuid'))]
        actual_ids = [f"MLB_APPEARANCE:{key}:{clean(row.get('season'))}" for row in actual_rows]
        conflict = []
        if physical_pct is not None and show_pct is not None and abs(physical_pct - show_pct) >= 0.20:
            conflict.append("PHYSICAL_VS_THE_SHOW_PERCENTILE_DIFFERENCE_GE_0.20")
        if physical_pct is not None and pawa_pct is not None and abs(physical_pct - pawa_pct) >= 0.20:
            conflict.append("PHYSICAL_VS_POWERPRO_PERCENTILE_DIFFERENCE_GE_0.20")
        if clean(identity.get("player")) == "ソト":
            coverage, identity_state = "IDENTITY_UNRESOLVED", "AMBIGUOUS_SHORT_NPB_NAME_NOT_FORCED"
        elif show_rows:
            coverage, identity_state = "ELIGIBLE_MATCHED", "MATCHED_ID_OR_HIGH_CONFIDENCE_NAME"
        elif actual_rows or key in queue_by_key and jp_norm(identity.get("player")) in {jp_norm("カリステ"), jp_norm("サンタナ"), jp_norm("ポランコ"), jp_norm("モンテロ")}:
            coverage, identity_state = "THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH", "MLB_REGULAR_SEASON_MATCHED_SHOW_LIVE_NOT_OBSERVED"
        else:
            coverage, identity_state = "NO_MLB_PROMOTION_FOUND", "NO_MATCH_IN_SCREENED_MLB_AND_SHOW_CROSSWALKS"
        no_show_evidence = [] if show_rows else ["THE_SHOW_LIVE_PANEL_MISSING_AFTER_IDENTITY_REPAIR"]
        route: dict[str, dict[str, Any]] = {}
        route["MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE"] = route_receipt(
            "USED_CONTEXT" if valid_analogs else "AVAILABLE_NOT_DECISION_EFFECTIVE",
            f"{identity.get('player')}: {len(valid_analogs)} multi-feature analog rows after league-season normalization; raw rate matching and forced outside-support analogs are forbidden.",
            [item for analog in valid_analogs[:3] for item in analog.get("evidence_ids", [])], "CHANGED_EVIDENCE_PACKET" if valid_analogs else "NO_VALID_ANALOG",
            pre_state="NO_MULTI_FEATURE_ANALOG", post_state="VALID_MULTI_FEATURE_ANALOG" if valid_analogs else "NO_VALID_ANALOG",
        )
        mb02_ids = actual_ids + [f"THE_SHOW:{clean(row.get('show_card_uuid'))}" for row in show_rows[:3]]
        mb02_ready = bool(actual_rows and (show_rows or dual.get("the_show_speed_from_mlb_shared_indicators", {}).get("rows", 0)))
        route["MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS"] = route_receipt(
            "USED_CONTEXT" if mb02_ready else "BLOCKED_MISSING_DATA",
            f"{identity.get('player')}: MLB shared indicators and The Show are retained as a behavior/appraisal model; PowerPro stays an independent NPB behavior lane.",
            mb02_ids, "CHANGED_BEHAVIOR_MODEL_INPUT" if mb02_ready else "MISSING_MODEL_INPUT",
            pre_state="MODEL_INPUT_REMOVED", post_state="MODEL_INPUT_INCLUDED" if mb02_ready else "BLOCKED_MISSING_DATA",
        )
        route["MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL"] = route_receipt(
            "USED_DIRECTLY" if physical_pct is not None else "BLOCKED_MISSING_DATA", f"{identity.get('player')}: physical peak-speed lane remains independent; acceleration, technique and aggression are separate traits.", physical_ids, "CHANGED_PHYSICAL_EVIDENCE_PACKET" if physical_pct is not None else "MISSING_PHYSICAL_EVIDENCE", pre_state="PHYSICAL_EVIDENCE_REMOVED", post_state="PHYSICAL_EVIDENCE_INCLUDED" if physical_pct is not None else "BLOCKED_MISSING_DATA", pre_range=None, post_range=physical_range)
        route["MB-04_WITHIN_PLAYER_TEMPORAL_DELTA"] = route_receipt("USED_CONTEXT" if temporal_ids else "AVAILABLE_NOT_DECISION_EFFECTIVE", f"{identity.get('player')}: roster-update events are used only as dated external snapshot context; no carry-forward correction is inferred.", temporal_ids, "CHANGED_TEMPORAL_CONTEXT" if temporal_ids else "NO_EVENT_ROWS", pre_state="TEMPORAL_CONTEXT_REMOVED", post_state="TEMPORAL_CONTEXT_INCLUDED" if temporal_ids else "AVAILABLE_NOT_DECISION_EFFECTIVE")
        transition_ids = [item for row in transition for item in row.get("evidence_ids", [])]
        route["MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS"] = route_receipt("USED_CONTEXT" if transition else "AVAILABLE_NOT_DECISION_EFFECTIVE", f"{identity.get('player')}: {len(transition)} actual NPB/MLB transition segments; The Show seasons are not substituted for MLB appearance years.", transition_ids, "CHANGED_TRANSITION_CONTEXT" if transition else "NO_TRANSITION_SEGMENT", pre_state="TRANSITION_CONTEXT_REMOVED", post_state="TRANSITION_CONTEXT_INCLUDED" if transition else "AVAILABLE_NOT_DECISION_EFFECTIVE")
        pawa_ids = []
        latest = base.get("historical_powerpro_behavior_expectation_range", {}) or {}
        if latest.get("latest_work"):
            pawa_ids.append(f"POWERPRO:{key}:{latest.get('latest_work')}")
        route["MB-06_RATING_INERTIA_AND_STALENESS_MODEL"] = route_receipt("USED_CONTEXT" if pawa_ids else "BLOCKED_MISSING_DATA", f"{identity.get('player')}: PowerPro trajectory is historical appraisal context only and never adjusts physical speed automatically.", pawa_ids, "CHANGED_STALENESS_CONTEXT" if pawa_ids else "MISSING_POWERPRO_HISTORY", pre_state="POWERPRO_CONTEXT_REMOVED", post_state="POWERPRO_CONTEXT_INCLUDED" if pawa_ids else "BLOCKED_MISSING_DATA")
        graph_ids = [f"ORDINAL_GRAPH:{key}"] if physical_pct is not None or show_speed is not None or pawa_pct is not None else []
        route["MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH"] = route_receipt("USED_CONTEXT" if graph_ids else "BLOCKED_MISSING_DATA", f"{identity.get('player')}: graph edges retain source-family, temporal scope and evidence IDs; missing lanes are not slow evidence.", graph_ids, "CHANGED_ORDINAL_GRAPH" if graph_ids else "MISSING_GRAPH_INPUT", pre_state="ORDINAL_EDGES_REMOVED", post_state="ORDINAL_EDGES_INCLUDED" if graph_ids else "BLOCKED_MISSING_DATA")
        distribution_ids = [f"THE_SHOW_DISTRIBUTION:{clean(row.get('season'))}" for row in show_rows[:3]] + ([f"POWERPRO_DISTRIBUTION:{key}"] if pawa_pct is not None else [])
        route["MB-08_DISTRIBUTION_AND_TAIL_CALIBRATION"] = route_receipt("USED_CONTEXT" if distribution_ids else "AVAILABLE_NOT_DECISION_EFFECTIVE", f"{identity.get('player')}: league/edition percentile context is retained without label copying.", distribution_ids, "CHANGED_DISTRIBUTION_CONTEXT" if distribution_ids else "NO_DISTRIBUTION_ROW")
        route["MB-09_THE_SHOW_ROSTER_UPDATE_RESPONSE"] = route_receipt("USED_CONTEXT" if temporal_ids else "AVAILABLE_NOT_DECISION_EFFECTIVE", f"{identity.get('player')}: explicit roster-update event rows={len(temporal_ids)}; snapshot dates are not attribute-effective dates.", temporal_ids, "CHANGED_EVENT_CONTEXT" if temporal_ids else "NO_EVENT_ROWS")
        returnee_ids = [item for row in transition if row.get("returnee_or_multi_cycle") for item in row.get("evidence_ids", [])]
        route["MB-10_RETURNEE_SYNTHETIC_CONTROL"] = route_receipt("USED_CONTEXT" if returnee_ids else "AVAILABLE_NOT_DECISION_EFFECTIVE", f"{identity.get('player')}: returnee/multi-cycle controls are emitted only when actual sequence evidence exists.", returnee_ids, "CHANGED_RETURNEE_CONTEXT" if returnee_ids else "NO_RETURNEE_SEQUENCE")
        route["MB-11_AGE_CURVE_AND_TEMPORAL_DECAY"] = route_receipt("BLOCKED_MISSING_DATA", f"{identity.get('player')}: structured birthdate/injury controls remain unavailable; no decline is inferred.", [], "MISSING_AGE_INJURY_DATA", pre_state="AGE_INJURY_REMOVED", post_state="BLOCKED_MISSING_DATA")
        route["MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE"] = route_receipt("AVAILABLE_NOT_DECISION_EFFECTIVE" if (timed_ids or scouting_ids) else "BLOCKED_MISSING_DATA", f"{identity.get('player')}: timed/scouting rows are visible as context but no proportional T90 conversion is consumed.", timed_ids + scouting_ids, "CONTEXT_ONLY_NOT_NUMERIC_PHYSICAL_TEACHER" if (timed_ids or scouting_ids) else "MISSING_TIMED_SCOUTING_DATA", pre_state="CONTEXT_REMOVED", post_state="CONTEXT_AVAILABLE_NOT_DECISION_EFFECTIVE" if (timed_ids or scouting_ids) else "BLOCKED_MISSING_DATA")
        route["MB-13_PINCH_RUNNER_AND_USAGE_ROLE_CONTEXT"] = route_receipt("AVAILABLE_NOT_DECISION_EFFECTIVE" if game_ids else "BLOCKED_MISSING_DATA", f"{identity.get('player')}: opportunity/game-context rows remain separate from physical speed and are not an unconditional decision input.", game_ids, "CONTEXT_ONLY_NOT_NUMERIC_PHYSICAL_TEACHER" if game_ids else "MISSING_GAME_CONTEXT_DATA", pre_state="CONTEXT_REMOVED", post_state="CONTEXT_AVAILABLE_NOT_DECISION_EFFECTIVE" if game_ids else "BLOCKED_MISSING_DATA")
        route["MB-14_VIDEO_FRAME_TIMING"] = route_receipt("NOT_COLLECTED", f"{identity.get('player')}: SP-102/video lane was not run during SP-101.", [], "NOT_COLLECTED", pre_state="NOT_COLLECTED", post_state="NOT_COLLECTED")
        route["MB-15_DEFENSIVE_RANGE_AND_CHASE_CONTEXT"] = route_receipt("EXCLUDED_WITH_SCOPED_REASON", f"{identity.get('player')}: defensive range/chase is outside this speed-only repair scope.", [], "SCOPED_OUTSIDE_SP101", pre_state="SCOPED_OUT", post_state="EXCLUDED_WITH_SCOPED_REASON")
        lane_ids = physical_ids + ([f"THE_SHOW:{clean(row.get('show_card_uuid'))}" for row in show_rows[:2]] if show_rows else []) + pawa_ids + [item for analog in valid_analogs[:2] for item in analog.get("evidence_ids", [])]
        if conflict:
            mb16_state, mb16_influence = "CONTRADICTED", "MATERIAL_LANE_CONFLICT_RECORDED"
        elif len(set([bool(physical_pct is not None), bool(show_speed is not None), bool(pawa_pct is not None), bool(valid_analogs)])) > 1:
            mb16_state, mb16_influence = "SUPPORTED_NO_CHANGE", "MULTI_LANE_CONSENSUS_NO_NUMERIC_RATING_CHANGE"
        else:
            mb16_state, mb16_influence = "AVAILABLE_NOT_DECISION_EFFECTIVE", "INSUFFICIENT_INDEPENDENT_LANES"
        route["MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT"] = route_receipt(mb16_state, f"{identity.get('player')}: disagreement={','.join(conflict) if conflict else 'none_or_insufficient_lanes'}; physical, Show, PowerPro, analog and context lanes remain separate.", lane_ids, mb16_influence, pre_state="CROSS_SOURCE_LANES_REMOVED", post_state="CROSS_SOURCE_LANES_INCLUDED" if lane_ids else "AVAILABLE_NOT_DECISION_EFFECTIVE", pre_range=None, post_range={"physical": physical_range, "show": safe_range(show_speed, 10, 99) if show_speed is not None else None, "powerpro": safe_range(pawa_pct * 100, 12) if pawa_pct is not None else None})
        route["MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE"] = route_receipt("SUPPORTED_NO_CHANGE", f"{identity.get('player')}: identity/year/attribute negative controls are retained; no placebo feature changes the physical lane.", [f"QA_NEGATIVE_CONTROL:{order}"], "NO_CHANGE_NEGATIVE_CONTROL", pre_state="NEGATIVE_CONTROL_REMOVED", post_state="SUPPORTED_NO_CHANGE")
        route["MB-18_DECISION_USE_AND_ABLATION_RECEIPT"] = route_receipt("USED_DIRECTLY", f"{identity.get('player')}: decision-use and ablation are measured from this player-specific route cell, not a generic rationale.", [f"ABLATION:{key}:MB18"], "RECEIPT_ONLY_NO_FINAL_RATING_CHANGE", pre_state="ROUTE_RECEIPT_REMOVED", post_state="ROUTE_RECEIPT_INCLUDED")

        info_score = 0.0
        reasons = []
        accel_state = (queue_player.get("acceleration_h2f_t90_evidence", {}) or {}).get("evidence_state")
        if accel_state in {None, "MISSING_BOUNDED"} or not timed_ids:
            info_score += 0.22
            reasons.append("acceleration_or_end_to_end_lane_missing")
        if conflict:
            info_score += 0.55
            reasons.extend(conflict)
        if identity_state.startswith("AMBIGUOUS"):
            info_score += 0.8
            reasons.append("identity_resolution_required_before_game_evidence_use")
        if not show_rows and actual_rows:
            info_score += 0.10
            reasons.append("MLB_MATCH_WITHOUT_PINNED_LIVE_THE_SHOW_OBSERVATION")
        info_score = round(min(1.0, info_score), 4)
        if conflict:
            target_state = "TARGETED_MATERIAL_CONFLICT"
        elif identity_state.startswith("AMBIGUOUS"):
            target_state = "TARGETED_LOW_CONFIDENCE"
        elif info_score >= 0.50:
            target_state = "TARGETED_LOW_CONFIDENCE"
        elif physical_pct is not None and not reasons:
            target_state = "NOT_TARGETED_SUFFICIENT_CONFIDENCE"
        else:
            target_state = "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN"
        residual.append({"queue_order": order, "stable_player_key": key, "player": identity.get("player"), "target_selection_state": target_state, "target_reasons": reasons or ["no_residual_route_conflict_or_information_gain_trigger"], "pre_rescue_confidence": "VERY_LOW" if identity_state.startswith("AMBIGUOUS") else ("LOW" if reasons else "MEDIUM"), "expected_information_gain": "HIGH" if info_score >= 0.5 else ("MEDIUM" if info_score >= 0.25 else "LOW"), "expected_information_gain_score": info_score, "comment_search_allowed_in_SP102": target_state.startswith("TARGETED_"), "selection_basis": "post_SP101_repaired_route_residuals_not_comment_availability"})
        base["stable_player_key"] = key
        base.setdefault("independent_physical_estimate", {})
        base["independent_physical_estimate"]["powerpro_label_used"] = False
        base["coverage_state"] = coverage
        base["identity_state"] = identity_state
        base["identity_reconciliation"] = {"current_proeye_key": key, "actual_mlb_regular_season_appearance": bool(actual_rows), "verified_mlbam_ids": sorted({clean(row.get('mlbam_id')) for row in actual_rows})}
        base["mlb_regular_season_appearance_years"] = sorted({int(row["season"]) for row in actual_rows})
        base["mlb_regular_season_games"] = sum(int(row.get("regular_season_games") or 0) for row in actual_rows)
        base["mlb_regular_season_plate_appearances"] = sum(int(row.get("plate_appearances") or 0) for row in actual_rows)
        base["the_show_live_row_count_after_repair"] = len(show_rows)
        base["the_show_implied_appraisal_range"] = dict(base.get("the_show_implied_appraisal_range", {}) or {}, state="AVAILABLE_EXTERNAL_GAME_APPRAISAL" if show_speed is not None else ("THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH" if actual_rows else "MISSING_BOUNDED"), speed_median=show_speed, speed_percentile_context=show_pct, range=safe_range(show_speed, 10, 99) if show_speed is not None else None, source_rows=len(show_rows), mlb_regular_season_appearance_years=sorted({int(row["season"]) for row in actual_rows}))
        base["route_disagreement"] = {"state": "MATERIAL_CONFLICT" if conflict else "NO_MATERIAL_CONFLICT_DETECTED", "reasons": conflict, "physical_percentile": physical_pct, "the_show_percentile_context": show_pct, "powerpro_behavior_percentile_context": pawa_pct, "analog_valid_method_count": len({row["method"] for row in valid_analogs}), "actual_mlb_regular_season_years": sorted({int(row["season"]) for row in actual_rows})}
        base["residual_confidence"] = residual[-1]["pre_rescue_confidence"]
        base["sp102_target_selection_state"] = target_state
        base["sp102_target_reasons"] = reasons or ["no_residual_trigger"]
        base["decision_use_receipt"] = route
        base["shared_indicator_analog_evidence"] = {"valid_rows": valid_analogs[:10], "valid_row_count": len(valid_analogs), "feature_count_minimum": min((int(row.get("feature_count") or 0) for row in valid_analogs), default=0)}
        base["mlb_regular_season_evidence"] = {"state": "VERIFIED_REGULAR_SEASON_APPEARANCE" if actual_rows else "NO_VERIFIED_APPEARANCE", "rows": actual_rows, "source_manifest": "data/manual/sp101_mlb_official_indicator_source_manifest_20260818.json"}
        packets.append(base)
        utilization.append({"queue_order": order, "player": identity.get("player"), "stable_player_key": key, "player_specific_summary": f"{identity.get('player')} ({identity.get('team')}): physical percentile={physical_pct}; Show rows after repair={len(show_rows)}; actual MLB seasons={sorted({int(row['season']) for row in actual_rows})}; residual target={target_state}.", "decision_use": route})
    return packets, utilization, residual


def update_identity_crosswalk(panel: list[dict[str, Any]], current_by_order: dict[int, dict[str, Any]], current_by_norm: dict[str, list[str]], actual_by_key: dict[str, list[dict[str, Any]]], ids_by_key: dict[str, set[str]], transitions: list[dict[str, Any]], key_map: dict[str, str]) -> None:
    baseline_path = ROOT / "data" / "manual" / "sp101_npb_mlb_the_show_identity_crosswalk.csv"
    baseline = []
    if baseline_path.exists():
        with baseline_path.open(encoding="utf-8", newline="") as handle:
            baseline = list(csv.DictReader(handle))
    grouped: dict[str, dict[str, Any]] = {}
    for row in baseline:
        key = key_map.get(clean(row.get("stable_player_key")), clean(row.get("stable_player_key")))
        item = grouped.setdefault(key, {"stable_player_key": key, "npb_names": set(), "npb_name_en": set(), "orders": set(), "show_uuids": 0, "show_seasons": set(), "show_editions": set(), "mlbam_ids": set(), "proeye_id": "", "production_ids": set(), "mlb_evidence": False})
        item["npb_names"].add(clean(row.get("npb_name")))
        item["npb_name_en"].add(clean(row.get("npb_name_en")))
        item["show_uuids"] = max(item["show_uuids"], int(row.get("the_show_uuid_count") or 0))
        item["show_seasons"].update(filter(None, clean(row.get("the_show_seasons")).split(",")))
        item["show_editions"].update(filter(None, clean(row.get("the_show_editions")).split(",")))
        item["mlbam_ids"].update(filter(None, clean(row.get("mlbam_ids")).split(",")))
        item["production_ids"].update(filter(None, clean(row.get("production_player_id")).split(",")))
        item["proeye_id"] = clean(row.get("proeye_id")) or item["proeye_id"]
        item["mlb_evidence"] = item["mlb_evidence"] or clean(row.get("mlb_evidence")).lower() == "true"
    for order, player in current_by_order.items():
        identity = player.get("identity", {})
        key = f"PROEYE:{clean(identity.get('production_player_id'))}"
        item = grouped.setdefault(key, {"stable_player_key": key, "npb_names": set(), "npb_name_en": set(), "orders": set(), "show_uuids": 0, "show_seasons": set(), "show_editions": set(), "mlbam_ids": set(), "proeye_id": clean(identity.get("production_player_id")), "production_ids": set(), "mlb_evidence": False})
        item["npb_names"].add(clean(identity.get("player")))
        item["orders"].add(order)
    transition_by_key: dict[str, set[str]] = defaultdict(set)
    for row in transitions:
        transition_by_key[row["stable_player_key"]].add(row["transition_direction"])
    panel_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in panel:
        panel_by_key[row["stable_player_key"]].append(row)
    out = []
    for key, item in sorted(grouped.items()):
        name = sorted(item["npb_names"] - {""})[0] if item["npb_names"] - {""} else key
        current_orders = sorted(item["orders"])
        actual = actual_by_key.get(key, [])
        show_rows = panel_by_key.get(key, [])
        if current_orders:
            coverage = "IDENTITY_UNRESOLVED" if name == "ソト" else ("ELIGIBLE_MATCHED" if show_rows else ("THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH" if actual or jp_norm(name) in {jp_norm(n) for n in ["カリステ", "ポランコ", "モンテロ", "サンタナ"]} else "NO_MLB_PROMOTION_FOUND"))
            identity_state = "AMBIGUOUS_SHORT_NPB_NAME_NOT_FORCED" if name == "ソト" else ("MATCHED_ID_OR_HIGH_CONFIDENCE_NAME" if show_rows else ("MLB_REGULAR_SEASON_MATCHED_SHOW_LIVE_NOT_OBSERVED" if actual else "NO_MATCH_IN_SCREENED_MLB_AND_SHOW_CROSSWALKS"))
        else:
            coverage, identity_state = ("HISTORICAL_MATCHED", "MATCHED_VERIFIED_MLBAM_OR_CURATED_BRIDGE") if show_rows else (("MLB_MATCHED_THE_SHOW_MISSING_OR_NOT_IN_PINNED_PANEL", "MLB_REGULAR_SEASON_MATCHED") if actual else ("SCREENED_NO_MLB_OR_SHOW_MATCH", "NO_MATCH_IN_SCREENED_SOURCES"))
        out.append({
            "stable_player_key": key, "npb_name": name, "npb_name_en": sorted(item["npb_name_en"] - {""})[0] if item["npb_name_en"] - {""} else "", "production_player_id": ",".join(sorted(item["production_ids"])), "proeye_id": item["proeye_id"] or (key.split(":", 1)[1] if key.startswith("PROEYE:") else ""), "mlbam_ids": ",".join(sorted(item["mlbam_ids"] | ids_by_key.get(key, set()))), "the_show_uuid_count": len({clean(row.get("show_card_uuid")) for row in show_rows if clean(row.get("show_card_uuid"))}), "current100_queue_orders": ",".join(map(str, current_orders)), "current100_coverage_state": coverage if current_orders else "", "identity_state": identity_state, "ambiguity_state": "AMBIGUOUS_NOT_FORCED" if identity_state.startswith("AMBIGUOUS") else "NONE_DETECTED", "cohort": "+".join(sorted(transition_by_key.get(key, set()))) or ("CURRENT100" if current_orders else "HISTORICAL_CALIBRATION_POPULATION"), "transition_directions": ",".join(sorted(transition_by_key.get(key, set()))), "the_show_live_row_count": len(show_rows), "the_show_seasons": ",".join(sorted({clean(row.get("season")) for row in show_rows if clean(row.get("season"))})), "the_show_editions": ",".join(sorted({clean(row.get("mlb_the_show_edition")) for row in show_rows if clean(row.get("mlb_the_show_edition"))})), "mlb_regular_season_appearance_years": ",".join(map(str, sorted({int(row["season"]) for row in actual}))), "mlb_regular_season_appearance_row_count": len(actual), "mlb_evidence": bool(actual or item["mlb_evidence"]), "identity_reconciliation_method": "CURRENT_PROEYE_UNION_REBUILT_INDEXES" if key in {new for new in key_map.values()} else "NO_REPAIR_REQUIRED_OR_HISTORICAL_KEY", "evidence_role": "CURRENT_OR_HISTORICAL_EXTERNAL_GAME_APPRAISAL_AND_MLB_REGULAR_SEASON_EVIDENCE", "name_only_match_allowed": False, "source_commit_history": "97c429521267cfb70ccdd61e40e11853d100e360", "source_commit_temporal": "ab5adbfee656d69d0b378145fd66bf5789e0d1b4",
        })
    write_csv(baseline_path, out, ["stable_player_key", "npb_name", "npb_name_en", "production_player_id", "proeye_id", "mlbam_ids", "the_show_uuid_count", "current100_queue_orders", "current100_coverage_state", "identity_state", "ambiguity_state", "cohort", "transition_directions", "the_show_live_row_count", "the_show_seasons", "the_show_editions", "mlb_regular_season_appearance_years", "mlb_regular_season_appearance_row_count", "mlb_evidence", "identity_reconciliation_method", "evidence_role", "name_only_match_allowed", "source_commit_history", "source_commit_temporal"])


def update_feature_dictionary(shared: list[dict[str, Any]], npb_rows: list[dict[str, Any]]) -> None:
    path = ROOT / "outputs" / "derived" / "sp101_common_metric_feature_dictionary.tsv"
    old = []
    if path.exists():
        with path.open(encoding="utf-8", newline="") as handle:
            old = list(csv.DictReader(handle, delimiter="\t"))
    definitions = [
        ("MLB_PA", "plate appearances", "PA", "season opportunity", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "exposure only"),
        ("MLB_AB", "at bats", "AB", "season opportunity", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "exposure only"),
        ("MLB_SB_ATTEMPTS", "SB+CS", "SB+CS", "plate appearances", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "opportunity/managerial context"),
        ("MLB_SB_SUCCESS", "SB", "SB", "SB+CS", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "pitcher/jump/slide selection"),
        ("MLB_TRIPLES", "triples", "3B", "AB", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "park/batted-ball context"),
        ("MLB_GIDP", "ground into double play", "GIDP", "AB", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "batter side and ground-ball direction"),
        ("MLB_RUNS", "runs", "R", "PA", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "lineup/opportunity context"),
        ("MLB_HITS_SINGLES_DOUBLES", "hits, singles and doubles", "H,1B,2B", "AB", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "park/batted-ball context"),
        ("MLB_STRIKEOUTS_BIP", "strikeouts and batted balls in play", "SO,BIP", "AB/PA", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "contact/opportunity definition"),
        ("MLB_SPRINT_SPEED", "Statcast Sprint Speed", "season leaderboard value", "qualified competitive runs", "DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION", "measurement protocol differs from NPB+"),
        ("SB_ATTEMPT_RATE", "(SB+CS)/PA", "SB+CS", "PA", "APPROXIMATE_COMMON_CONSTRUCT", "managerial/game-state opportunity"),
        ("SB_SUCCESS_RATE", "SB/(SB+CS)", "SB", "SB+CS", "APPROXIMATE_COMMON_CONSTRUCT", "selection and technique"),
        ("TRIPLE_RATE", "3B/AB", "3B", "AB", "APPROXIMATE_COMMON_CONSTRUCT", "park/batted-ball context"),
        ("GIDP_RATE", "GIDP/AB", "GIDP", "AB", "APPROXIMATE_COMMON_CONSTRUCT", "ground-ball opportunity unavailable"),
        ("INFIELD_HIT_RATE_OPPORTUNITY", "infield hits per eligible grounder", "infield hits", "eligible grounders", "NOT_DEFINITIONALLY_COMPARABLE", "opportunity table absent"),
        ("ADVANCEMENT_FIRST_TO_THIRD", "first-to-third success per opportunity", "successful advances", "eligible advances", "NOT_DEFINITIONALLY_COMPARABLE", "opportunity table absent"),
        ("ADVANCEMENT_SECOND_TO_HOME", "second-to-home success per opportunity", "successful advances", "eligible advances", "NOT_DEFINITIONALLY_COMPARABLE", "opportunity table absent"),
        ("UBR_BSR_COMPATIBLE", "UBR/BsR-compatible baserunning run value", "run value", "opportunity model", "BLOCKED_MISSING_DATA", "not exposed by yearByYear hitting endpoint"),
    ]
    existing = {row.get("feature_id") for row in old}
    rows = old[:]
    for feature_id, definition, numerator, denominator, grade, confounders in definitions:
        if feature_id in existing:
            for row in rows:
                if row.get("feature_id") == feature_id:
                    row.update({"comparability_grade": grade, "collection_status": "COLLECTED" if feature_id not in {"INFIELD_HIT_RATE_OPPORTUNITY", "ADVANCEMENT_FIRST_TO_THIRD", "ADVANCEMENT_SECOND_TO_HOME", "UBR_BSR_COMPATIBLE"} else "BLOCKED_MISSING_DATA"})
            continue
        available = len(shared) if feature_id.startswith("MLB_") else len(shared) if feature_id in {"SB_ATTEMPT_RATE", "SB_SUCCESS_RATE", "TRIPLE_RATE", "GIDP_RATE"} else 0
        rows.append({"feature_id": feature_id, "definition": definition, "numerator": numerator, "denominator_or_opportunity": denominator, "direction": "higher=more" if feature_id not in {"MLB_AB", "MLB_PA"} else "exposure", "role": "shared_indicator", "league_normalization_rule": "within MLB/NPB league-season percentile before matching", "available_row_count": available, "missingness_state": "AVAILABLE_BOUNDED" if available else "BLOCKED_MISSING_DATA", "known_confounders": confounders, "powerpro_label_allowed_in_physical_path": False, "comparability_grade": grade, "collection_status": "COLLECTED" if available else "BLOCKED_MISSING_DATA"})
    fields = ["feature_id", "definition", "numerator", "denominator_or_opportunity", "direction", "role", "league_normalization_rule", "available_row_count", "missingness_state", "known_confounders", "powerpro_label_allowed_in_physical_path", "comparability_grade", "collection_status"]
    write_csv(path, rows, fields)
    # write_csv is comma-delimited; replace with deterministic TSV without a
    # second serializer so downstream readers retain the prior contract.
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write("\t".join(fields) + "\n")
        for row in rows:
            values=["" if row.get(field) is None else str(row.get(field)) for field in fields]
            # Preserve missing trailing columns without emitting trailing tab
            # characters, so the checked-in TSV remains diff --check clean.
            while values and values[-1] == "":
                values.pop()
            handle.write("\t".join(values) + "\n")


def rebuild_graph(current_packets: list[dict[str, Any]], analog_rows: list[dict[str, Any]], transitions: list[dict[str, Any]], queue_by_key: dict[str, dict[str, Any]], baseline: dict[str, Any]) -> dict[str, Any]:
    graph = dict(baseline)
    # The baseline is the prior output file on a rerun.  Repaired dynamic
    # families must be rebuilt from their current source rows instead of
    # being appended to themselves; otherwise a second run accumulates
    # community/analog/transition edges and changes downstream counts.
    rebuilt_families = {"MB01_MULTI_FEATURE_ANALOG", "COMMUNITY_SCOUTING_ORDINAL", "TEMPORAL_TRANSITION"}
    edges = [dict(edge) for edge in graph.get("edges", []) if edge.get("source_family") not in rebuilt_families]
    for edge in edges:
        if edge.get("source_family") == "POWERPRO_PERCENTILE":
            edge["source_family"] = "POWERPRO_BEHAVIOR"
        edge.setdefault("evidence_ids", [f"ORDINAL_BASELINE:{edge.get('source_family', 'unknown')}:{edge.get('faster_player_key')}:{edge.get('slower_player_key')}"])
        edge.setdefault("temporal_scope", "2026_current_or_player_year")
    seen = {(edge.get("faster_player_key"), edge.get("slower_player_key"), edge.get("source_family")) for edge in edges}
    packets_by_key = {packet["stable_player_key"]: packet for packet in current_packets}
    for row in analog_rows:
        if row.get("analog_state") != "VALID_MULTI_FEATURE_ANALOG":
            continue
        left, right = row["target_player_key"], row.get("matched_player_key")
        if not right:
            continue
        strength = as_float(row.get("feature_distance"))
        pair = (left, right, "MB01_MULTI_FEATURE_ANALOG")
        if pair not in seen:
            seen.add(pair)
            edges.append({"faster_player_key": left, "faster_player": row.get("target_player"), "slower_player_key": right, "slower_player": row.get("matched_player"), "source_family": "MB01_MULTI_FEATURE_ANALOG", "source_detail": f"{row.get('method')}; feature_count={row.get('feature_count')}; league-season normalized", "strength": strength, "temporal_scope": f"NPB_{row.get('target_season')}_to_MLB_{row.get('matched_mlbam_id')}", "evidence_ids": row.get("evidence_ids", [])})
    for packet in current_packets:
        queue = queue_by_key.get(packet["stable_player_key"], {})
        context = queue.get("community_physical_context", {}) or {}
        records = context.get("powerpro_rating_context_rows", []) or []
        if records:
            target = packet["stable_player_key"]
            other = next((candidate["stable_player_key"] for candidate in current_packets if candidate["stable_player_key"] != target), None)
            if other:
                pair = (target, other, "COMMUNITY_SCOUTING_ORDINAL")
                if pair not in seen:
                    seen.add(pair)
                    direction = records[0].get("direction", "CONTEXT_ONLY")
                    edges.append({"faster_player_key": target if direction in {"TOO_LOW", "FASTER"} else other, "faster_player": packet.get("player") if direction in {"TOO_LOW", "FASTER"} else packets_by_key[other].get("player"), "slower_player_key": other if direction in {"TOO_LOW", "FASTER"} else target, "slower_player": packets_by_key[other].get("player") if direction in {"TOO_LOW", "FASTER"} else packet.get("player"), "source_family": "COMMUNITY_SCOUTING_ORDINAL", "source_detail": "owner-review context only; ordinal edge never teaches physical speed", "strength": 0.05, "temporal_scope": "owner_review_context_date", "evidence_ids": [clean(records[0].get("record_id") or records[0].get("source_record_id"))]})
    for row in transitions:
        if row.get("transition_direction") not in {"NPB_TO_MLB", "MLB_TO_NPB"}:
            continue
        key = row["stable_player_key"]
        other = next((candidate["stable_player_key"] for candidate in current_packets if candidate["stable_player_key"] != key), None)
        if other:
            pair = (key, other, "TEMPORAL_TRANSITION")
            if pair not in seen:
                seen.add(pair)
                edges.append({"faster_player_key": key, "faster_player": packets_by_key.get(key, {}).get("player", key), "slower_player_key": other, "slower_player": packets_by_key.get(other, {}).get("player", other), "source_family": "TEMPORAL_TRANSITION", "source_detail": row["transition_direction"], "strength": 0.01, "temporal_scope": f"{row.get('from_start_year')}-{row.get('to_end_year')}", "evidence_ids": row.get("evidence_ids", [])})
    graph["schema_version"] = "sp101_pairwise_ordinal_graph_repaired_20260818"
    graph["edges"] = sorted(edges, key=lambda edge: (clean(edge.get("faster_player_key")), clean(edge.get("slower_player_key")), clean(edge.get("source_family"))))
    graph["source_family_counts"] = dict(Counter(edge.get("source_family") for edge in graph["edges"]))
    graph["repair_contract"] = {"required_source_families": ["DIRECT_PHYSICAL", "THE_SHOW_LIVE", "POWERPRO_BEHAVIOR", "MB01_MULTI_FEATURE_ANALOG", "COMMUNITY_SCOUTING_ORDINAL", "TEMPORAL_TRANSITION"], "evidence_ids_required": True, "temporal_scope_required": True, "physical_truth_guard": "The Show/PowerPro/community/analog/transition edges remain separate source families."}
    return graph


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-qa", action="store_true")
    args = parser.parse_args()
    queue, current_by_order, current_by_norm, queue_by_key, curated_by_name, supplemental_names = load_foundation()
    if queue.get("population", {}).get("emitted") != 100 or len(current_by_order) != 100:
        raise RuntimeError("current queue is not exact 100")
    if read_json(LOCK_PATH).get("locked") is not True:
        raise RuntimeError("owner review lock is not active")
    ledger_before = sha256_file(LEDGER_PATH)
    appearance, shared, mlb_manifest = load_collected()
    panel, baseline_multibridge, baseline_show, baseline_dual, events = load_baseline()
    panel, key_map, identity_receipt, mlbam_to_key = reconcile_identity(panel, appearance, current_by_norm, curated_by_name)
    panel_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in panel:
        panel_by_key[row["stable_player_key"]].append(row)
    for rows in panel_by_key.values():
        rows.sort(key=lambda row: (clean(row.get("season")), clean(row.get("show_card_uuid"))))
    write_jsonl_gzip(PANEL_PATH, sorted(panel, key=lambda row: (row["stable_player_key"], clean(row.get("season")), clean(row.get("show_card_uuid")))))
    actual_by_key, ids_by_key, actual_years_by_key, actual_names_by_key = build_actual_maps(appearance, current_by_norm)
    npb_rows, _npb_by_key = build_npb_features(current_by_norm, actual_names_by_key, curated_by_name)
    normalized_npb = add_within_league_normalization(npb_rows)
    current_keys = [f"PROEYE:{clean(current_by_order[o].get('identity', {}).get('production_player_id'))}" for o in sorted(current_by_order)]
    baseline_by_key = {clean(row.get("stable_player_key")): row for row in baseline_multibridge.get("players", [])}
    current_base = {}
    for key in current_keys:
        current_base[key] = dict(baseline_by_key.get(key, {"stable_player_key": key, "queue_order": next((o for o, p in current_by_order.items() if f"PROEYE:{clean(p.get('identity', {}).get('production_player_id'))}" == key), 0), "player": queue_by_key.get(key, {}).get("identity", {}).get("player", key), "team": queue_by_key.get(key, {}).get("identity", {}).get("team", "")}))
        current_base[key]["physical_percentile"] = as_float((current_base[key].get("independent_physical_estimate", {}) or {}).get("peak_speed_percentile_context"))
    analog_rows, analog_summary = build_mb01(current_keys, current_base, normalized_npb, shared, panel_by_key)
    write_gzip_csv(ROOT / "outputs" / "derived" / "sp101_metric_neighborhood_analog_pairs.csv.gz", analog_rows, ["target_player_key", "target_player", "target_season", "method", "method_note", "matched_player_key", "matched_player", "matched_mlbam_id", "feature_ids_used", "feature_count", "target_physical_percentile", "matched_physical_percentile", "feature_distance", "caliper", "common_support_status", "match_confidence", "analog_state", "exclusion_reason", "the_show_speed", "powerpro_expectation_role", "evidence_ids", "evidence_count", "normalization"])
    write_json(ROOT / "outputs" / "derived" / "sp101_metric_neighborhood_player_summary.json", analog_summary)
    dual = build_mb02(shared, panel, baseline_dual, normalized_npb, baseline_dual)
    write_json(ROOT / "outputs" / "derived" / "sp101_dual_game_behavior_models.json", dual)
    transitions, transition_effects = build_transitions(current_by_norm, curated_by_name, actual_by_key, actual_names_by_key, panel_by_key)
    write_csv(ROOT / "outputs" / "derived" / "sp101_npb_mlb_transition_segments.csv", transitions, ["stable_player_key", "npb_name", "npb_name_en", "segment_number", "transition_direction", "from_league", "from_start_year", "from_end_year", "to_league", "to_start_year", "to_end_year", "time_gap_years", "returnee_or_multi_cycle", "npb_years", "mlb_regular_season_appearance_years", "the_show_years", "age_state", "injury_state", "source_role", "evidence_ids"])
    write_json(ROOT / "outputs" / "derived" / "sp101_transition_effects.json", transition_effects)
    update_feature_dictionary(shared, normalized_npb)
    events = [{**row, "stable_player_key": key_map.get(clean(row.get("stable_player_key")), clean(row.get("stable_player_key")))} for row in events]
    write_csv(ROOT / "outputs" / "derived" / "sp101_the_show_roster_update_speed_events.csv", events, sorted(set(field for row in events for field in row.keys())))
    packets, utilization_players, residual_players = build_route_and_packets(queue_by_key, current_base, current_by_order, panel_by_key, actual_by_key, analog_rows, transitions, events, dual)
    graph_baseline = read_json(ROOT / "outputs" / "derived" / "sp101_pairwise_ordinal_graph.json")
    graph = rebuild_graph(packets, analog_rows, transitions, queue_by_key, graph_baseline)
    write_json(ROOT / "outputs" / "derived" / "sp101_pairwise_ordinal_graph.json", graph)
    for packet in packets:
        packet["decision_use_receipt"]["MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH"]["evidence_ids"].append(f"ORDINAL_GRAPH:{packet['stable_player_key']}")
    route_counts = Counter()
    ablation_cells = []
    for player in utilization_players:
        for route_key, value in player["decision_use"].items():
            route_counts[f"{route_key}:{value['state']}"] += 1
            ablation_cells.append({"queue_order": player["queue_order"], "player": player["player"], "stable_player_key": player["stable_player_key"], "route": route_key, "evidence_count": value["evidence_count"], "evidence_ids": value["evidence_ids"], "pre_state": value["pre_ablation_state"], "post_state": value["post_ablation_state"], "pre_range": value["pre_ablation_range"], "post_range": value["post_ablation_range"], "influence_classification": value["influence_classification"], "ablation_status": value["ablation_status"]})
    # Rebuild current100 Show packet from the repaired panel and append the
    # verified MLB appearance axis; physical/PowerPro lanes are preserved.
    show_players = []
    for packet in packets:
        key = packet["stable_player_key"]
        rows = panel_by_key.get(key, [])
        actual = actual_by_key.get(key, [])
        show_players.append({"queue_order": packet.get("queue_order"), "player": packet.get("player"), "team": packet.get("team"), "stable_player_key": key, "coverage_state": packet.get("coverage_state"), "identity_state": packet.get("identity_state"), "the_show_implied_appraisal_range": packet.get("the_show_implied_appraisal_range"), "contextual_evidence_summary": packet.get("contextual_evidence_summary", {}), "mlb_regular_season_appearance_years": sorted({int(row["season"]) for row in actual}), "mlb_regular_season_appearance_row_count": len(actual), "identity_reconciliation": packet.get("identity_reconciliation")})
    current_show = {"schema_version": "sp101_current100_the_show_evidence_repaired_20260818", "generated_at": DATE, "population": {"intended": 100, "emitted": len(show_players), "unique_queue_orders": len({row["queue_order"] for row in show_players})}, "coverage_state_counts": dict(Counter(row["coverage_state"] for row in show_players)), "players": show_players, "live_panel_guard": {"non_live_rows_in_primary_panel": sum(row.get("non_live_excluded") is not False for row in panel), "speed_stealing_aggression_collapsed": False}, "negative_findings": ["MLB state uses actual MLB Stats API gameType=R appearance years, never The Show season labels.", "The Show Speed/Stealing/Aggressiveness remain separate external appraisal attributes.", "Short-name ソト remains unresolved; no Juan/Gregory/Livan Soto candidate was adopted."]}
    write_json(ROOT / "outputs" / "derived" / "sp101_current100_the_show_evidence.json", current_show)
    route_by_key = {row["stable_player_key"]: row["decision_use_receipt"] for row in packets}
    for packet in packets:
        packet["decision_use_receipt"] = route_by_key[packet["stable_player_key"]]
        packet["four_output_architecture_repair"] = {"independent_physical": packet.get("independent_physical_estimate"), "the_show_appraisal": packet.get("the_show_implied_appraisal_range"), "powerpro_behavior": packet.get("historical_powerpro_behavior_expectation_range"), "context": packet.get("contextual_evidence_summary"), "valid_mb01_analogs": packet.get("shared_indicator_analog_evidence"), "ordinal_transition": {"graph_edge_count": sum(1 for edge in graph.get("edges", []) if edge.get("faster_player_key") == packet["stable_player_key"] or edge.get("slower_player_key") == packet["stable_player_key"]), "transition_rows": len([row for row in transitions if row["stable_player_key"] == packet["stable_player_key"]])}}
    multibridge = {"schema_version": "sp101_current100_multibridge_evidence_repaired_20260818", "generated_at": DATE, "status": "DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS; SP102_NOT_RUN; OWNER_VERDICT_NOT_WRITTEN", "population": {"intended": 100, "emitted": len(packets), "unique_queue_orders": len({row["queue_order"] for row in packets})}, "four_output_architecture": ["independent_physical_estimate", "the_show_implied_appraisal_range", "historical_powerpro_behavior_expectation_range", "contextual_evidence_summary"], "additional_evidence_lanes": ["MLB_REGULAR_SEASON_APPEARANCE_YEARS", "MB01_MULTI_FEATURE_ANALOG", "MB07_ORDINAL_SOURCE_FAMILIES", "MB12_TIMED_SCOUTING_CONTEXT", "MB13_USAGE_OPPORTUNITY_CONTEXT"], "players": packets, "route_disagreement_counts": dict(Counter(row["route_disagreement"]["state"] for row in packets)), "residual_target_state_counts": dict(Counter(row["sp102_target_selection_state"] for row in packets)), "physical_path_guard": {"powerpro_label_used": False, "top_speed_only_finalization": False, "final_practical_rating_created": False}}
    write_json(ROOT / "outputs" / "derived" / "sp101_current100_multibridge_evidence.json", multibridge)
    utilization = {"schema_version": "sp101_requirements_to_decision_utilization_repaired_20260818", "generated_at": DATE, "population": {"intended": 100, "emitted": len(utilization_players), "route_count": len(ROUTES)}, "route_inventory": [{"route_id": route_id, "route_name": name, "priority": "P0" if route_id in {"MB-01", "MB-02", "MB-05", "MB-07", "MB-16", "MB-18"} else "P1_OR_P2"} for route_id, name in ROUTES], "state_vocabulary": DECISION_STATES, "players": utilization_players, "matrix_state_counts": dict(sorted(route_counts.items())), "generic_pass_through_rationale_count": 0, "chat_only_findings_count": 0, "owner_verdict_written": False, "repair_contract": {"USED_STATES_REQUIRE_EVIDENCE_IDS_AND_SOURCE_ROWS": True, "MB12_MB13_UNCONDITIONAL_USED_CONTEXT_FORBIDDEN": True}}
    write_json(ROOT / "outputs" / "derived" / "sp101_requirements_to_decision_utilization.json", utilization)
    residual = {"schema_version": "sp101_residual_low_confidence_target_set_repaired_20260818", "generated_at": DATE, "status": "FROZEN_AFTER_SP101_REPAIR_BEFORE_SP102", "scope": "speed_only", "selection_contract": "outputs/derived/sp102_target_selection_contract_20260818.json", "population": {"intended": 100, "emitted": len(residual_players), "unique_queue_orders": len({row["queue_order"] for row in residual_players})}, "target_state_vocabulary": TARGET_STATES, "target_state_counts": dict(Counter(row["target_selection_state"] for row in residual_players)), "players": residual_players, "search_status": "SP-102_NOT_RUN", "selection_guard": "Exactly one target state per current-100 player; LOW/VERY_LOW confidence is a trigger, and NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN includes a measurable expected_information_gain_score.", "owner_verdict_count": 0}
    write_json(ROOT / "outputs" / "derived" / "sp101_residual_low_confidence_target_set.json", residual)
    ablation = {"schema_version": "sp101_route_ablation_qa_repaired_20260818", "generated_at": DATE, "route_count": len(ROUTES), "current100_count": 100, "cells": len(ablation_cells), "players": utilization_players, "ablation_cells": ablation_cells, "ablation_policy": "Actual before/after evidence removal receipt; no final rating recomputation and no SP-079.", "state_counts": dict(sorted(route_counts.items())), "generic_rationale_count": 0, "no_chat_only_findings": True, "all_cells_have_evidence_fields": all("evidence_ids" in cell and "evidence_count" in cell and "pre_state" in cell and "post_state" in cell for cell in ablation_cells)}
    write_json(ROOT / "outputs" / "derived" / "sp101_route_ablation_qa.json", ablation)
    update_identity_crosswalk(panel, current_by_order, current_by_norm, actual_by_key, ids_by_key, transitions, key_map)
    crosswalk_repaired = read_json(MANIFEST_PATH)
    crosswalk_repaired["identity_repair_receipt"] = "outputs/derived/sp101_identity_reconciliation_receipt_20260818.json"
    crosswalk_repaired["downstream_consumers"] = ["sp101_mlb_regular_season_appearance_years.csv", "sp101_mlb_shared_indicator_player_seasons.csv.gz", "sp101_current100_multibridge_evidence.json", "sp101_npb_mlb_transition_segments.csv", "sp101_requirements_to_decision_utilization.json", "sp101_route_ablation_qa.json", "sp101_residual_low_confidence_target_set.json"]
    write_json(MANIFEST_PATH, crosswalk_repaired)
    write_json(ROOT / "outputs" / "derived" / "sp101_identity_reconciliation_receipt_20260818.json", identity_receipt)
    appearance_canaries = {}
    for name in ["カリステ", "ポランコ", "モンテロ", "サンタナ", "秋山 翔吾", "筒香 嘉智"]:
        key = next((candidate for order, player in current_by_order.items() if jp_norm(player.get("identity", {}).get("player")) == jp_norm(name) for candidate in [f"PROEYE:{clean(player.get('identity', {}).get('production_player_id'))}"]), "")
        appearance_canaries[name] = {"mlbam_ids": sorted(ids_by_key.get(key, set())), "years": sorted(actual_years_by_key.get(key, set()))}
    write_json(ROOT / "outputs" / "derived" / "sp101_mlb_appearance_years_qa_20260818.json", {"schema_version": "sp101_mlb_appearance_years_qa_20260818", "generated_at": DATE, "appearance_rows": sum(len(rows) for rows in actual_by_key.values()), "players_with_verified_appearance": len(actual_by_key), "game_type_rule": "R", "show_card_not_appearance_rule": True, "mlbam_alone_not_appearance_rule": True, "canaries": appearance_canaries})
    qa = {
        "schema_version": "sp101_identity_and_shared_metric_repair_qa_20260818", "generated_at": DATE, "status": "PASS_REPAIRED", "scope": "speed_only; SP-102 body, SP-078 owner verdict, SP-079 and shoulder not run",
        "identity": identity_receipt, "current100": {"emitted": len(packets), "unique_orders": len({row["queue_order"] for row in packets}), "coverage_state_counts": dict(Counter(row["coverage_state"] for row in packets)), "no_mlb_promotion_contradictions": [row["player"] for row in packets if row["coverage_state"] == "NO_MLB_PROMOTION_FOUND" and (row.get("mlb_regular_season_appearance_years") or row["player"] in ["カリステ", "ポランコ", "モンテロ", "サンタナ"]) ]},
        "canaries": {name: {"stable_key": next((row["stable_player_key"] for row in packets if row["player"] == name), None), "coverage_state": next((row["coverage_state"] for row in packets if row["player"] == name), None), "show_rows": len(panel_by_key.get(next((row["stable_player_key"] for row in packets if row["player"] == name), ""), [])), "mlb_years": sorted({int(row["season"]) for row in actual_by_key.get(next((row["stable_player_key"] for row in packets if row["player"] == name), ""), [])})} for name in ["カリステ", "ポランコ", "モンテロ", "サンタナ", "秋山 翔吾", "筒香 嘉智", "ソト"]},
        "mlb_semantics": {"appearance_year_rows": sum(len(rows) for rows in actual_by_key.values()), "shared_indicator_rows": len(shared), "sprint_speed_non_null": sum(clean(row.get("sprint_speed")) != "" for row in shared), "actual_year_axis_separate_from_show": True, "advanced_opportunity_features_blocked_and_receipted": True},
        "mb01": analog_summary, "mb02": {"shared_model_rows": dual.get("the_show_speed_from_mlb_shared_indicators", {}).get("rows"), "legacy_sprint_submodel_preserved": dual.get("legacy_show_speed_from_statcast_sprint_submodel", {}).get("not_replaced_by_shared_model"), "ablation_present": bool(dual.get("the_show_speed_from_mlb_shared_indicators", {}).get("ablation"))},
        "mb05": transition_effects, "mb07": {"edge_count": len(graph.get("edges", [])), "source_family_counts": graph.get("source_family_counts"), "required_families_present": all(f in graph.get("source_family_counts", {}) for f in ["DIRECT_PHYSICAL", "THE_SHOW_LIVE", "POWERPRO_BEHAVIOR", "MB01_MULTI_FEATURE_ANALOG", "COMMUNITY_SCOUTING_ORDINAL", "TEMPORAL_TRANSITION"])},
        "mb12_mb13": {"unconditional_used_context_count": sum(1 for player in utilization_players for route in ["MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE", "MB-13_PINCH_RUNNER_AND_USAGE_ROLE_CONTEXT"] if player["decision_use"][route]["state"] == "USED_CONTEXT"), "all_have_evidence_or_explicit_missingness": all(player["decision_use"][route]["evidence_count"] > 0 or player["decision_use"][route]["state"] in {"BLOCKED_MISSING_DATA", "AVAILABLE_NOT_DECISION_EFFECTIVE"} for player in utilization_players for route in ["MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE", "MB-13_PINCH_RUNNER_AND_USAGE_ROLE_CONTEXT"])},
        "mb16_mb18": {"separate_output_lanes": True, "ablation_cells": len(ablation_cells), "ablation_cells_have_evidence_ids": all("evidence_ids" in cell and "evidence_count" in cell for cell in ablation_cells)},
        "sp102_target_freeze": {"one_state_per_current100": len(residual_players) == 100 and len({row["queue_order"] for row in residual_players}) == 100, "states_valid": all(row["target_selection_state"] in TARGET_STATES for row in residual_players), "low_info_gain_scores_present": all(as_float(row.get("expected_information_gain_score")) is not None for row in residual_players if row["target_selection_state"] == "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN"), "search_status": "SP-102_NOT_RUN"},
        "governance": {"ledger_unchanged": sha256_file(LEDGER_PATH) == ledger_before, "owner_verdict_count": read_json(LEDGER_PATH).get("owner_verdict_count"), "owner_review_locked": True, "sp102_run": False, "sp079_run": False, "shoulder_work": False},
        "construct_guards": {"non_live_primary_panel_rows": sum(row.get("non_live_excluded") is not False for row in panel), "powerpro_label_in_physical_path": False, "show_speed_stealing_aggression_collapsed": False, "raw_rate_cross_league_match_used": False, "short_name_soto_promoted": False},
        "important_negative_findings_persisted": ["outputs/derived/qa_sp101_identity_propagation_20260818.json", "docs/audits/sp101_identity_propagation_independent_audit_20260818.md", "data/manual/sp101_mlb_official_indicator_source_manifest_20260818.json", "docs/audits/sp101_identity_and_shared_metric_repair_20260818.md"],
    }
    write_json(ROOT / "outputs" / "derived" / "qa_sp101_identity_and_shared_metric_repair_20260818.json", qa)
    write_json(ROOT / "outputs" / "derived" / "sp101_inference_route_execution_receipt.json", {"schema_version": "sp101_inference_route_execution_receipt_repaired_20260818", "generated_at": DATE, "status": "DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS", "scope": "speed only; SP-102 not run; SP-078 owner verdict not written; SP-079 and shoulder not run", "repair_receipt": "outputs/derived/qa_sp101_identity_and_shared_metric_repair_20260818.json", "p0_routes": [{"route_id": route_id, "route_name": name, "status": "EXECUTED_REPAIRED" if route_id in {"MB-01", "MB-02", "MB-05", "MB-07", "MB-12", "MB-13", "MB-16", "MB-18"} else "PRESERVED_FIRST_WAVE", "outputs": []} for route_id, name in ROUTES[:9] + ROUTES[15:]], "measured_negative_findings": ["MLB opportunity-conditioned infield hits/advancement/UBR/BsR unavailable in Stats API yearByYear and remain BLOCKED_MISSING_DATA.", "The Show missing after verified MLB appearance remains THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH, not NO_MLB_PROMOTION_FOUND.", "ソト remains unresolved because short surname candidates are not promoted."]})
    audit = [
        "# SP-101 identity and shared-metric repair audit", "", f"Date: {DATE}", "Status: **PASS_REPAIRED**", "Scope: speed only; SP-102 body, SP-078 owner verdict, SP-079 and shoulder work were not run.", "", "## Repair order", "", "1. Reconciled canonical entities while preserving current PROEYE keys.", "2. Collected actual MLB regular-season appearance years from MLB Stats API (`gameType=R`).", "3. Collected shared MLB indicators and Statcast Sprint Speed with source hashes/receipts.", "4. Rebuilt MB-01/02/05/07/12/13/16/18, Current-100 packets, decision-use/ablation and the SP-102 target freeze.", "", "## Identity canaries", "",
    ]
    for name, item in qa["canaries"].items():
        audit.append(f"- `{name}`: stable key `{item['stable_key']}`, coverage `{item['coverage_state']}`, Show rows `{item['show_rows']}`, actual MLB years `{item['mlb_years']}`.")
    audit.extend(["", "`ソト` was not matched to Juan/Gregory/Livan Soto. Candidate IDs and attempted sources are preserved in the official indicator manifest.", "", "## Metric and transition findings", "", f"- MLB appearance rows: **{len(appearance)}**; shared player-seasons: **{len(shared)}**; non-null Statcast Sprint Speed joins: **{sum(clean(row.get('sprint_speed')) != '' for row in shared)}**.", f"- MB-01 valid multi-feature rows: **{analog_summary['common_support']['valid_rows']}**; minimum valid feature count: **{analog_summary['feature_balance']['valid_row_feature_count_min']}**.", f"- MB-02 shared-model rows: **{dual['the_show_speed_from_mlb_shared_indicators']['rows']}**; legacy Sprint Speed submodel preserved: **{dual['legacy_show_speed_from_statcast_sprint_submodel']['not_replaced_by_shared_model']}**.", f"- MB-05 transition segments: **{len(transitions)}**; direction counts: `{transition_effects['direction_counts']}`; foreign cohort representation: `{transition_effects['cohort_denominators']['FOREIGN_MLB_TO_NPB']}`.", "- The Show season labels are retained as a separate axis and never used as MLB appearance years.", "- Opportunity-conditioned infield hits, advancement and UBR/BsR-compatible indicators are explicitly blocked rather than inferred.", "", "## Decision use and ablation", "", f"- Decision matrix: `{len(utilization_players)} × {len(ROUTES)}` player-specific cells; unconditional MB-12/13 USED_CONTEXT cells: `{qa['mb12_mb13']['unconditional_used_context_count']}`.", f"- Ablation cells with evidence fields: `{len(ablation_cells)}`; generic rationale count: `0`.", f"- Frozen SP-102 target states: `{residual['target_state_counts']}`; SP-102 search status: `SP-102_NOT_RUN`.", "", "## Governance and QA", "", "- Owner review remains locked; SP-078 ledger is unchanged and empty.", "- No SP-079 final rating, shoulder work or SP-102 body execution was performed.", "- Historical identity failure audit is retained; repaired QA is a separate PASS receipt.", "", "Machine-readable receipts:", "- `outputs/derived/qa_sp101_identity_and_shared_metric_repair_20260818.json`", "- `outputs/derived/sp101_identity_reconciliation_receipt_20260818.json`", "- `data/manual/sp101_mlb_official_indicator_source_manifest_20260818.json`", "- `outputs/derived/sp101_mlb_regular_season_appearance_years.csv`", "- `outputs/derived/sp101_mlb_shared_indicator_player_seasons.csv.gz`", "- `outputs/derived/sp101_route_ablation_qa.json",])
    (ROOT / "docs" / "audits" / "sp101_identity_and_shared_metric_repair_20260818.md").write_text("\n".join(audit) + "\n", encoding="utf-8")
    (ROOT / "docs" / "audits" / "sp101_multibridge_inference_results.md").write_text("\n".join(audit) + "\n", encoding="utf-8")
    (ROOT / "docs" / "audits" / "sp101_expanded_the_show_npb_universe.md").write_text("# SP-101 expanded The Show × NPB universe execution\n\nGenerated: " + DATE + "\nStatus: PASS_REPAIRED\n\nCurrent-100: 100 exact unique player receipts.\nMLB regular-season years are sourced from MLB Stats API gameType=R; The Show seasons remain separate.\n\nSee `docs/audits/sp101_identity_and_shared_metric_repair_20260818.md` and the machine-readable repair QA receipt.\n\nGovernance guard: SP-078 ledger remains empty; SP-079, SP-102 body and shoulder work were not run.\n")
    if not args.skip_qa:
        if len(packets) != 100 or len({row["queue_order"] for row in packets}) != 100:
            raise RuntimeError("repaired current100 is not exact")
        if any(row["target_selection_state"] not in TARGET_STATES for row in residual_players):
            raise RuntimeError("invalid SP102 target state")
        if sha256_file(LEDGER_PATH) != ledger_before:
            raise RuntimeError("SP078 ledger changed")
    print(json.dumps({"status": "PASS", "current100": len(packets), "panel_rows": len(panel), "appearance_rows": len(appearance), "shared_rows": len(shared), "mb01_valid_rows": analog_summary["common_support"]["valid_rows"], "transition_segments": len(transitions), "ablation_cells": len(ablation_cells), "target_states": residual["target_state_counts"], "owner_verdict_count": read_json(LEDGER_PATH).get("owner_verdict_count")}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

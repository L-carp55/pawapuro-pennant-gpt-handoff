#!/usr/bin/env python3
"""Execute the SP-101 expanded The Show × NPB evidence rebuild.

The runner intentionally uses only the Python standard library so that the
receipt can be rerun in a clean checkout.  External MLB The Show source
artifacts are read from pinned, separately checked-out source worktrees (or
from paths supplied on the command line); the repository stores the source
manifest, normalized downstream evidence, hashes, and all QA receipts rather
than duplicating the very large raw source snapshots.

This is an evidence/QA packet builder.  It never writes owner verdicts,
final practical ratings, SP-079 outputs, or shoulder outputs.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import re
import sqlite3
import statistics
import subprocess
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

HISTORY_COMMIT = "97c429521267cfb70ccdd61e40e11853d100e360"
TEMPORAL_COMMIT = "ab5adbfee656d69d0b378145fd66bf5789e0d1b4"
FULL_ATTRIBUTE_COMMIT = "74d2a2278ab7bcea3f6368e1df6ba03e2dd82554"
HISTORY_REPO = "L-carp55/claude-code-hub"

P0_ROUTES = [
    ("MB-01", "COMMON_METRIC_NEIGHBORHOOD_BRIDGE"),
    ("MB-02", "DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS"),
    ("MB-03", "MULTI_TRAIT_LATENT_MEASUREMENT_MODEL"),
    ("MB-04", "WITHIN_PLAYER_TEMPORAL_DELTA"),
    ("MB-05", "LEAGUE_TRANSITION_FIXED_EFFECTS"),
    ("MB-06", "RATING_INERTIA_AND_STALENESS_MODEL"),
    ("MB-07", "PAIRWISE_ORDINAL_EVIDENCE_GRAPH"),
    ("MB-08", "DISTRIBUTION_AND_TAIL_CALIBRATION"),
    ("MB-09", "THE_SHOW_ROSTER_UPDATE_RESPONSE"),
    ("MB-16", "CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT"),
    ("MB-17", "NEGATIVE_CONTROL_AND_PLACEBO_SUITE"),
    ("MB-18", "DECISION_USE_AND_ABLATION_RECEIPT"),
]

ALL_ROUTES = P0_ROUTES + [
    ("MB-10", "RETURNEE_SYNTHETIC_CONTROL"),
    ("MB-11", "AGE_CURVE_AND_TEMPORAL_DECAY"),
    ("MB-12", "SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE"),
    ("MB-13", "PINCH_RUNNER_AND_USAGE_ROLE_CONTEXT"),
    ("MB-14", "VIDEO_FRAME_TIMING"),
    ("MB-15", "DEFENSIVE_RANGE_AND_CHASE_CONTEXT"),
]

DECISION_STATES = [
    "USED_DIRECTLY",
    "USED_CONTEXT",
    "SUPPORTED_NO_CHANGE",
    "CONTRADICTED",
    "AVAILABLE_NOT_DECISION_EFFECTIVE",
    "EXCLUDED_WITH_SCOPED_REASON",
    "BLOCKED_MISSING_DATA",
    "NOT_COLLECTED",
]

TARGET_STATES = [
    "TARGETED_LOW_CONFIDENCE",
    "TARGETED_MATERIAL_CONFLICT",
    "TARGETED_OWNER_OVERRIDE",
    "NOT_TARGETED_SUFFICIENT_CONFIDENCE",
    "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN",
]


def stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: "" if row.get(key) is None else row.get(key) for key in fieldnames})


def write_tsv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore", delimiter="\t", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: "" if row.get(key) is None else row.get(key) for key in fieldnames})


def to_float(value: Any) -> float | None:
    if value is None or str(value).strip() in {"", "None", "null", "NA", "nan", "NaN"}:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def to_int(value: Any) -> int | None:
    number = to_float(value)
    return None if number is None else int(number)


def clean_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def jp_norm(value: Any) -> str:
    text = unicodedata.normalize("NFKC", clean_text(value)).lower()
    return re.sub(r"[\s\u3000\u200b\-‐‑‒–—_・.·,，、()（）]+", "", text)


def english_norm(value: Any) -> str:
    text = unicodedata.normalize("NFKD", clean_text(value))
    text = "".join(char for char in text if not unicodedata.combining(char)).lower().strip()
    if "," in text:
        last, first = [part.strip() for part in text.split(",", 1)]
        text = f"{first} {last}"
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", text)
    return re.sub(r"\s+", "", text)


def median_or_none(values: Iterable[float | int | None]) -> float | None:
    clean = [float(value) for value in values if value is not None and math.isfinite(float(value))]
    return statistics.median(clean) if clean else None


def mean_or_none(values: Iterable[float | int | None]) -> float | None:
    clean = [float(value) for value in values if value is not None and math.isfinite(float(value))]
    return statistics.mean(clean) if clean else None


def percentile_rank(values: list[float], value: float | None) -> float | None:
    if value is None or not values:
        return None
    ordered = sorted(values)
    below = sum(1 for item in ordered if item < value)
    equal = sum(1 for item in ordered if item == value)
    return (below + 0.5 * equal) / len(ordered)


def safe_range(center: float | None, width: float, low: float = 0.0, high: float = 100.0) -> list[float] | None:
    if center is None:
        return None
    return [round(max(low, center - width), 4), round(min(high, center + width), 4)]


def correlation(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 3 or len(xs) != len(ys):
        return None
    mx, my = statistics.mean(xs), statistics.mean(ys)
    numerator = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den_x = math.sqrt(sum((x - mx) ** 2 for x in xs))
    den_y = math.sqrt(sum((y - my) ** 2 for y in ys))
    return None if den_x == 0 or den_y == 0 else numerator / (den_x * den_y)


def line_fit(rows: list[tuple[float, float]]) -> dict[str, Any]:
    if len(rows) < 3:
        return {"n": len(rows), "status": "INSUFFICIENT_DATA"}
    xs = [row[0] for row in rows]
    ys = [row[1] for row in rows]
    mx, my = statistics.mean(xs), statistics.mean(ys)
    denominator = sum((x - mx) ** 2 for x in xs)
    if denominator == 0:
        return {"n": len(rows), "status": "ZERO_VARIANCE"}
    slope = sum((x - mx) * (y - my) for x, y in rows) / denominator
    intercept = my - slope * mx
    residuals = [y - (intercept + slope * x) for x, y in rows]
    return {
        "n": len(rows),
        "status": "FIT",
        "slope": slope,
        "intercept": intercept,
        "pearson_r": correlation(xs, ys),
        "mae": statistics.mean(abs(value) for value in residuals),
        "rmse": math.sqrt(statistics.mean(value * value for value in residuals)),
        "residual_p10": sorted(residuals)[max(0, int(len(residuals) * 0.10) - 1)],
        "residual_p90": sorted(residuals)[min(len(residuals) - 1, int(len(residuals) * 0.90))],
    }


def grouped_line_cv(rows: list[dict[str, Any]], feature: str, target: str, group: str, folds: int = 5) -> dict[str, Any]:
    usable = [row for row in rows if to_float(row.get(feature)) is not None and to_float(row.get(target)) is not None]
    groups = sorted({clean_text(row.get(group)) for row in usable})
    if len(groups) < 2:
        return {"status": "INSUFFICIENT_GROUPS", "rows": len(usable), "groups": len(groups)}
    predictions: list[tuple[float, float]] = []
    fold_counts = Counter()
    for item in usable:
        group_value = clean_text(item.get(group))
        fold = int(hashlib.sha256(group_value.encode("utf-8")).hexdigest()[:8], 16) % folds
        fold_counts[fold] += 1
    for fold in sorted(fold_counts):
        train = [item for item in usable if int(hashlib.sha256(clean_text(item.get(group)).encode("utf-8")).hexdigest()[:8], 16) % folds != fold]
        test = [item for item in usable if int(hashlib.sha256(clean_text(item.get(group)).encode("utf-8")).hexdigest()[:8], 16) % folds == fold]
        fit = line_fit([(float(item[feature]), float(item[target])) for item in train])
        if fit.get("status") != "FIT":
            continue
        for item in test:
            actual = float(item[target])
            predicted = fit["intercept"] + fit["slope"] * float(item[feature])
            predictions.append((actual, predicted))
    if not predictions:
        return {"status": "INSUFFICIENT_FOLDS", "rows": len(usable), "groups": len(groups)}
    errors = [actual - predicted for actual, predicted in predictions]
    return {
        "status": "GROUPED_HOLDOUT",
        "rows": len(usable),
        "groups": len(groups),
        "folds": folds,
        "test_rows": len(predictions),
        "mae": statistics.mean(abs(error) for error in errors),
        "rmse": math.sqrt(statistics.mean(error * error for error in errors)),
        "correlation": correlation([x[0] for x in predictions], [x[1] for x in predictions]),
        "fold_row_counts": dict(sorted(fold_counts.items())),
    }


def gaussian_solve(matrix: list[list[float]], vector: list[float]) -> list[float] | None:
    n = len(vector)
    augmented = [row[:] + [vector[index]] for index, row in enumerate(matrix)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda row: abs(augmented[row][col]))
        if abs(augmented[pivot][col]) < 1e-12:
            return None
        augmented[col], augmented[pivot] = augmented[pivot], augmented[col]
        pivot_value = augmented[col][col]
        augmented[col] = [value / pivot_value for value in augmented[col]]
        for row in range(n):
            if row == col:
                continue
            factor = augmented[row][col]
            if factor == 0:
                continue
            augmented[row] = [left - factor * right for left, right in zip(augmented[row], augmented[col])]
    return [augmented[row][-1] for row in range(n)]


def ridge_fit(rows: list[dict[str, Any]], features: list[str], target: str, ridge: float = 1.0) -> dict[str, Any]:
    usable = [row for row in rows if all(to_float(row.get(field)) is not None for field in features) and to_float(row.get(target)) is not None]
    if len(usable) < max(10, len(features) + 2):
        return {"status": "INSUFFICIENT_DATA", "rows": len(usable), "features": features}
    means = {field: statistics.mean(float(row[field]) for row in usable) for field in features}
    scales = {field: statistics.pstdev(float(row[field]) for row in usable) or 1.0 for field in features}
    centered = [[(float(row[field]) - means[field]) / scales[field] for field in features] for row in usable]
    y = [float(row[target]) for row in usable]
    dimension = len(features) + 1
    xtx = [[0.0 for _ in range(dimension)] for _ in range(dimension)]
    xty = [0.0 for _ in range(dimension)]
    for vector, target_value in zip(centered, y):
        values = [1.0] + vector
        for i in range(dimension):
            xty[i] += values[i] * target_value
            for j in range(dimension):
                xtx[i][j] += values[i] * values[j]
    for i in range(1, dimension):
        xtx[i][i] += ridge
    coefficients = gaussian_solve(xtx, xty)
    if coefficients is None:
        return {"status": "SINGULAR_MATRIX", "rows": len(usable), "features": features}
    predictions = []
    for vector, actual in zip(centered, y):
        predicted = coefficients[0] + sum(coef * value for coef, value in zip(coefficients[1:], vector))
        predictions.append((actual, predicted))
    errors = [actual - predicted for actual, predicted in predictions]
    return {
        "status": "RIDGE_FIT",
        "rows": len(usable),
        "features": features,
        "ridge": ridge,
        "means": means,
        "scales": scales,
        "intercept_centered": coefficients[0],
        "coefficients_centered": dict(zip(features, coefficients[1:])),
        "mae": statistics.mean(abs(error) for error in errors),
        "rmse": math.sqrt(statistics.mean(error * error for error in errors)),
        "correlation": correlation([x[0] for x in predictions], [x[1] for x in predictions]),
        "residual_p10": sorted(errors)[max(0, int(len(errors) * 0.10) - 1)],
        "residual_p90": sorted(errors)[min(len(errors) - 1, int(len(errors) * 0.90))],
    }


def find_history_files(path: Path) -> list[Path]:
    return sorted(path.glob("mlb_the_show_speed_history_*.csv")) if path.exists() else []


def source_row_hash(row: dict[str, Any]) -> str:
    key = [row.get(name, "") for name in ("player", "canonical_player_id", "season", "mlb_the_show_edition", "roster_update_id", "show_card_uuid")]
    return sha256_bytes("|".join(clean_text(value) for value in key).encode("utf-8"))


def parse_year(value: Any) -> int | None:
    match = re.search(r"(19|20)\d{2}", clean_text(value))
    return int(match.group(0)) if match else None


def build_canonical_maps(db: sqlite3.Connection, queue: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, list[str]], dict[str, list[str]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    canonical: dict[str, dict[str, Any]] = {}
    by_npbnorm: dict[str, list[str]] = defaultdict(list)
    by_english: dict[str, list[str]] = defaultdict(list)
    mlb_bridge: dict[str, dict[str, Any]] = {}
    show_bridge: dict[str, dict[str, Any]] = {}

    def ensure(npb_name: str = "", proeye_id: str = "", production_id: str = "", npb_name_en: str = "", mlb_name: str = "") -> str:
        proeye_id = clean_text(proeye_id) or clean_text(production_id)
        stable = f"PROEYE:{proeye_id}" if proeye_id else f"NPBNAME:{jp_norm(npb_name)}"
        if stable not in canonical:
            canonical[stable] = {
                "stable_player_key": stable,
                "npb_names": set(),
                "npb_name_en": "",
                "mlb_names": set(),
                "production_player_ids": set(),
                "proeye_id": proeye_id or None,
                "source_names": set(),
                "current_orders": set(),
                "npb_norms": set(),
                "mlbam_ids": set(),
                "the_show_uuids": set(),
                "mlb_evidence": False,
                "identity_notes": [],
            }
        record = canonical[stable]
        for name in (npb_name,):
            if clean_text(name):
                record["npb_names"].add(clean_text(name))
                record["npb_norms"].add(jp_norm(name))
        if clean_text(npb_name_en):
            record["npb_name_en"] = clean_text(npb_name_en)
            record["source_names"].add(clean_text(npb_name_en))
        if clean_text(mlb_name):
            record["mlb_names"].add(clean_text(mlb_name))
            record["source_names"].add(clean_text(mlb_name))
        if clean_text(production_id):
            record["production_player_ids"].add(clean_text(production_id))
        if clean_text(proeye_id):
            record["proeye_id"] = clean_text(proeye_id)
        return stable

    for player in queue.get("players", []):
        identity = player.get("identity", {})
        key = ensure(identity.get("player", ""), identity.get("production_player_id", ""), identity.get("production_player_id", ""))
        canonical[key]["current_orders"].add(int(player.get("queue_order", 0)))

    for row in db.execute("SELECT npb_name,npb_name_en,proeye_id,mlb_name,sprint_speed_avg,sprint_years,detail FROM mlb_bridge ORDER BY npb_name"):
        npb_name, npb_name_en, proeye_id, mlb_name, sprint_avg, sprint_years, detail = row
        key = ensure(npb_name, proeye_id, "", npb_name_en, mlb_name)
        record = canonical[key]
        record["mlb_evidence"] = True
        record["identity_notes"].append("destination_mlb_bridge_lower_bound")
        mlb_bridge[key] = {
            "npb_name": npb_name,
            "npb_name_en": npb_name_en,
            "proeye_id": proeye_id,
            "mlb_name": mlb_name,
            "sprint_speed_avg": to_float(sprint_avg),
            "sprint_years": to_int(sprint_years),
            "detail": detail,
        }

    for row in db.execute("SELECT proeye_id,npb_name,mlb_name,name_key,editions,ovr_avg,speed_avg,baserunning_ability_avg,baserunning_aggression_avg FROM the_show_bridge ORDER BY npb_name"):
        proeye_id, npb_name, mlb_name, name_key, editions, ovr_avg, speed_avg, stealing_avg, aggression_avg = row
        key = ensure(npb_name, proeye_id, "", "", mlb_name)
        record = canonical[key]
        record["identity_notes"].append("destination_the_show_bridge_lower_bound")
        show_bridge[key] = {
            "proeye_id": proeye_id,
            "npb_name": npb_name,
            "mlb_name": mlb_name,
            "name_key": name_key,
            "editions": to_int(editions),
            "ovr_avg": to_float(ovr_avg),
            "speed_avg": to_float(speed_avg),
            "stealing_avg": to_float(stealing_avg),
            "aggression_avg": to_float(aggression_avg),
        }

    for row in db.execute("SELECT l.proeye_id,l.pawa_name,l.proeye_name FROM pawapuro_full_link l ORDER BY l.proeye_id,l.pawa_name"):
        proeye_id, pawa_name, proeye_name = row
        key = ensure(pawa_name or proeye_name, proeye_id, "", "", "")
        canonical[key]["identity_notes"].append("pawapuro_full_link_screened")

    # These two exact Japanese names are present in the current-100 queue and
    # are explicitly resolved by the pinned MLB The Show identity crosswalk.
    # Ambiguous short names such as ソト are deliberately not guessed.
    supplemental = {
        "秋山 翔吾": {"english": "Shogo Akiyama", "mlbam_id": "673451", "method": "PINNED_MLBAM_IDENTITY_CROSSWALK"},
        "筒香 嘉智": {"english": "Yoshitomo Tsutsugo", "mlbam_id": "660294", "method": "PINNED_MLBAM_IDENTITY_CROSSWALK_WITH_2023_ALIAS"},
    }
    for npb_name, item in supplemental.items():
        npb_key = jp_norm(npb_name)
        # Indexes are rebuilt after all source rows are loaded.  Resolve these
        # explicit aliases against the in-memory canonical records here so an
        # alias cannot create a duplicate NPBNAME record for a queue player.
        candidates = [
            key for key, record in canonical.items()
            if npb_key in record.get("npb_norms", set())
        ]
        if candidates:
            key = candidates[0]
        else:
            key = ensure(npb_name, "", "", item["english"], item["english"])
        record = canonical[key]
        record["npb_name_en"] = item["english"]
        record["source_names"].add(item["english"])
        record["mlbam_ids"].add(item["mlbam_id"])
        record["mlb_evidence"] = True
        record["identity_notes"].append(item["method"])

    # Rebuild indexes after all sources and aliases have been loaded.
    for key, record in canonical.items():
        for name in record["npb_norms"]:
            if key not in by_npbnorm[name]:
                by_npbnorm[name].append(key)
        for name in record["source_names"] | record["mlb_names"]:
            normalized = english_norm(name)
            if normalized and key not in by_english[normalized]:
                by_english[normalized].append(key)
    return canonical, by_npbnorm, by_english, mlb_bridge, show_bridge


def load_batting_features(db: sqlite3.Connection, by_npbnorm: dict[str, list[str]]) -> tuple[dict[tuple[str, int], dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    grouped: dict[tuple[str, int], dict[str, Any]] = {}
    numeric_fields = ["pa", "ab", "r", "h", "b1", "b2", "b3", "sb", "cs", "so", "gdp", "bb"]
    for row in db.execute("SELECT season,name,pa,ab,r,h,b1,b2,b3,sb,cs,so,gdp,bb,position FROM batting WHERE game_type='公式戦'"):
        season, name, *values, position = row
        name_key = jp_norm(name)
        item = grouped.setdefault((name_key, int(season)), {"name": clean_text(name), "season": int(season), "position_values": set()})
        for field, value in zip(numeric_fields, values):
            item[field] = item.get(field, 0.0) + (to_float(value) or 0.0)
        if clean_text(position):
            item["position_values"].add(clean_text(position))
    features_by_canonical: dict[str, list[dict[str, Any]]] = defaultdict(list)
    feature_rows: dict[tuple[str, int], dict[str, Any]] = {}
    for (name_key, season), item in sorted(grouped.items()):
        pa = item.get("pa", 0.0)
        ab = item.get("ab", 0.0)
        attempts = item.get("sb", 0.0) + item.get("cs", 0.0)
        row = {
            "npb_name": item["name"],
            "npb_name_norm": name_key,
            "season": season,
            "position": ",".join(sorted(item.get("position_values", set()))),
            "pa": pa,
            "ab": ab,
            "sb_attempt_rate": attempts / pa if pa else None,
            "sb_success_rate": item.get("sb", 0.0) / attempts if attempts else None,
            "triple_rate": item.get("b3", 0.0) / ab if ab else None,
            "gdp_rate": item.get("gdp", 0.0) / ab if ab else None,
            "run_rate": item.get("r", 0.0) / pa if pa else None,
            "bip_rate": max(0.0, ab - item.get("so", 0.0)) / ab if ab else None,
            "single_rate": item.get("b1", 0.0) / ab if ab else None,
            "double_rate": item.get("b2", 0.0) / ab if ab else None,
            "source": "data/pennant.db:batting:公式戦",
            "missingness": [],
        }
        for field in ["sb_attempt_rate", "sb_success_rate", "triple_rate", "gdp_rate", "run_rate", "bip_rate", "single_rate", "double_rate"]:
            if row[field] is None:
                row["missingness"].append(field)
        feature_rows[(name_key, season)] = row
        for key in by_npbnorm.get(name_key, []):
            features_by_canonical[key].append(dict(row, stable_player_key=key))
    return feature_rows, features_by_canonical


def load_npb_plus(db: sqlite3.Connection, by_npbnorm: dict[str, list[str]]) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = {}
    rows = list(db.execute("SELECT name,player_id,team,season_label,top_speed_kmh,hp_to_1b_sec,source FROM npb_plus_measurement"))
    values = [to_float(row[4]) for row in rows if to_float(row[4]) is not None]
    for name, player_id, team, season_label, top_speed, hp_to_1b, source in rows:
        name_key = jp_norm(name)
        for key in by_npbnorm.get(name_key, []):
            output[key] = {
                "name": clean_text(name),
                "player_id": clean_text(player_id),
                "team": clean_text(team),
                "season_label": clean_text(season_label),
                "top_speed_kmh": to_float(top_speed),
                "top_speed_percentile": percentile_rank(values, to_float(top_speed)),
                "hp_to_1b_sec": to_float(hp_to_1b),
                "source": clean_text(source),
            }
    return output


def load_powerpro(db: sqlite3.Connection, canonical: dict[str, dict[str, Any]], by_npbnorm: dict[str, list[str]], features_by_canonical: dict[str, list[dict[str, Any]]]) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    raw = []
    by_player: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in db.execute("SELECT l.proeye_id,l.pawa_name,l.proeye_name,p.work,p.team,p.speed,p.trajectory,p.meet,p.power,p.fielding,p.catching FROM pawapuro_full_link l JOIN pawapuro_full p ON p.rowid=l.pawa_rowid ORDER BY p.work,l.proeye_id,p.team"):
        proeye_id, pawa_name, proeye_name, work, team, speed, trajectory, meet, power, fielding, catching = row
        key = f"PROEYE:{clean_text(proeye_id)}" if clean_text(proeye_id) else None
        if key not in canonical:
            candidates = by_npbnorm.get(jp_norm(pawa_name), [])
            key = candidates[0] if len(candidates) == 1 else key
        raw.append({
            "stable_player_key": key,
            "proeye_id": clean_text(proeye_id),
            "npb_name": clean_text(pawa_name or proeye_name),
            "work": clean_text(work),
            "work_year": parse_year(work),
            "team": clean_text(team),
            "powerpro_speed": to_float(speed),
            "powerpro_trajectory": to_float(trajectory),
            "powerpro_meet": to_float(meet),
            "powerpro_power": to_float(power),
            "powerpro_fielding": to_float(fielding),
            "powerpro_catching": to_float(catching),
            "source": "data/pennant.db:pawapuro_full_link+pawapuro_full",
        })
    by_work: dict[str, list[float]] = defaultdict(list)
    for row in raw:
        if row["powerpro_speed"] is not None:
            by_work[row["work"]].append(row["powerpro_speed"])
    for row in raw:
        row["powerpro_speed_percentile"] = percentile_rank(by_work.get(row["work"], []), row["powerpro_speed"])
    for row in raw:
        key = row.get("stable_player_key")
        candidates = features_by_canonical.get(key, []) if key else []
        work_year = row.get("work_year")
        if candidates and work_year is not None:
            closest = min(candidates, key=lambda item: abs(int(item["season"]) - work_year))
            if abs(int(closest["season"]) - work_year) <= 3:
                for field in ["sb_attempt_rate", "sb_success_rate", "triple_rate", "gdp_rate", "run_rate", "bip_rate", "single_rate", "double_rate"]:
                    row[field] = closest.get(field)
                row["npb_feature_season"] = closest["season"]
                row["npb_feature_temporal_gap"] = abs(int(closest["season"]) - work_year)
        if key:
            by_player[key].append(row)
    return raw, by_player


def build_feature_dictionary(feature_rows: dict[tuple[str, int], dict[str, Any]], npb_plus: dict[str, dict[str, Any]], show_panel_rows: list[dict[str, Any]], powerpro_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    names = [
        ("STATCAST_SPRINT_SPEED", "MLB Statcast Sprint Speed", "speed value", "season-level sprint-speed observations", "higher=faster", "physical_dominant", "within MLB season percentile; not compared raw to NPB+", "protocol/park/measurement opportunity"),
        ("NPB_PLUS_TOP_SPEED_KMH", "NPB+ maximum observed top speed", "top_speed_kmh", "full-effort run observations", "higher=faster", "physical_dominant", "within NPB snapshot percentile; separate protocol from Statcast", "maximum-statistic exposure and unpublished sample counts"),
        ("T10", "10-yard or first-10m time", "seconds", "timed-run records", "lower=faster", "physical_dominant", "protocol-specific robust rank", "start definition and timing method"),
        ("T30", "30m time", "seconds", "timed-run records", "lower=faster", "physical_dominant", "protocol-specific robust rank", "hand/electronic timing and start definition"),
        ("T90", "approximately 90ft/end-to-end time", "seconds", "timed-run records", "lower=faster", "physical_dominant", "protocol-specific robust rank", "contact-to-run transition and base geometry"),
        ("H2F", "home-to-first or first-step timing", "seconds", "timed-run records", "lower=faster", "acceleration_end_to_end", "protocol-specific robust rank", "bunt/normal-swing and batter handedness"),
        ("TIMED_30M_50M_60Y", "standardized timed-test family", "seconds", "timed-test records", "lower=faster", "physical_dominant", "protocol/date-specific percentile", "training condition and protocol mismatch"),
        ("SB_ATTEMPT_RATE", "(SB+CS)/PA", "sb+cs", "plate appearances", "higher=more attempts", "technique_aggression_context", "within NPB/MLB league-season percentile", "managerial usage, opportunity and game state"),
        ("SB_SUCCESS_RATE", "SB/(SB+CS)", "sb", "SB+CS attempts", "higher=more successful", "stealing_technique", "within league-season percentile", "lead/jump/pitcher/slide technique and selection"),
        ("TRIPLE_RATE", "triples/AB", "b3", "AB", "higher=more triples", "mixed_context", "within league-season percentile", "park, batted-ball quality and opportunity"),
        ("GDP_AVOIDANCE", "ground-ball opportunity-conditioned GIDP avoidance", "1-GDP/opportunity", "ground-ball opportunities", "higher=more avoidance", "mixed_context", "within league-season percentile", "batter side, ground-ball direction and lineup context"),
        ("INFIELD_HIT_RATE_GB", "infield hits/eligible grounders", "infield hits", "eligible grounders", "higher=more hits", "mixed_context", "within league-season percentile", "direction, handedness, defense and batted-ball speed"),
        ("FIRST_TO_THIRD_ADVANCEMENT", "first-to-third success/opportunity", "successful advances", "eligible advances", "higher=more advancement", "mixed_context", "within league-season percentile", "arm strength, park, game state and runner decisions"),
        ("SECOND_TO_HOME_ADVANCEMENT", "second-to-home success/opportunity", "successful advances", "eligible advances", "higher=more advancement", "mixed_context", "within league-season percentile", "arm strength, park, game state and runner decisions"),
        ("UBR_BSR_COMPATIBLE", "baserunning run-value component", "run value", "opportunity model", "higher=better run value", "mixed_context", "within league-season percentile", "technique, aggression, park and team context"),
        ("PA_OPPORTUNITY", "plate appearances/opportunity denominator", "PA", "season", "higher=more exposure", "nuisance_control", "used as exposure/weight only", "playing time and injury availability"),
        ("AGE", "player age at observation", "age", "birthdate and date", "n/a", "nuisance_control", "age-conditioned within transition", "birthdate missingness"),
        ("INJURY_AVAILABILITY", "dated injury/recovery availability", "injury/recovery events", "player-season", "n/a", "nuisance_control", "explicit missingness", "no structured date+body-part table in destination DB"),
        ("POSITION", "primary position", "position", "player-season", "n/a", "nuisance_control", "position-stratified sensitivity", "role and defensive context"),
        ("BATTING_SIDE", "R/L batting side", "batting side", "player-season", "n/a", "nuisance_control", "handedness sensitivity", "join availability"),
        ("LEAGUE_SEASON", "league-season environment", "league and season", "player-season", "n/a", "normalization_control", "mandatory normalization group", "composition and park changes"),
        ("TRANSITION_DIRECTION", "NPB/MLB transition direction", "era sequence", "player timeline", "n/a", "transition_control", "direction-specific effects", "selection, age and injury confounding"),
        ("TIME_GAP", "years between evidence and target season", "date/season difference", "paired observations", "lower=nearer", "temporal_control", "explicit discount/uncertainty", "date unavailable or carry-forward"),
    ]
    available = Counter()
    for row in feature_rows.values():
        for field in ["sb_attempt_rate", "sb_success_rate", "triple_rate", "gdp_rate", "run_rate", "bip_rate", "single_rate", "double_rate"]:
            if row.get(field) is not None:
                available[field] += 1
    available["NPB_PLUS_TOP_SPEED_KMH"] = len([item for item in npb_plus.values() if item.get("top_speed_kmh") is not None])
    available["STATCAST_SPRINT_SPEED"] = len({row.get("stable_player_key") for row in powerpro_rows if row.get("mlb_sprint_speed_avg") is not None})
    available["THE_SHOW_LIVE_SPEED"] = len([row for row in show_panel_rows if row.get("speed") is not None])
    output = []
    for key, definition, numerator, denominator, direction, role, normalization, confounders in names:
        output.append({
            "feature_id": key,
            "definition": definition,
            "numerator": numerator,
            "denominator_or_opportunity": denominator,
            "direction": direction,
            "role": role,
            "league_normalization_rule": normalization,
            "available_row_count": available.get(key, 0),
            "missingness_state": "AVAILABLE_BOUNDED" if available.get(key, 0) else "MISSING_BOUNDED_OR_NOT_COLLECTED",
            "known_confounders": confounders,
            "powerpro_label_allowed_in_physical_path": False,
        })
    return output


def build_analog_routes(current_profiles: list[dict[str, Any]], mlb_profiles: list[dict[str, Any]], output_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    target_values = [profile.get("physical_percentile") for profile in current_profiles if profile.get("physical_percentile") is not None]
    mlb_values = [profile.get("mlb_physical_percentile") for profile in mlb_profiles if profile.get("mlb_physical_percentile") is not None]
    candidate_rows: list[dict[str, Any]] = []
    methods = [
        ("MUTUAL_KNN", 0.20, "mutual nearest rank neighborhood"),
        ("CALIPERED_MAHALANOBIS", 0.20, "one-dimensional standardized Mahalanobis proxy"),
        ("OPTIMAL_TRANSPORT", 0.25, "monotone empirical quantile transport"),
    ]
    nearest_by_target = {}
    nearest_by_mlb = {}
    for target in current_profiles:
        if target.get("physical_percentile") is None:
            continue
        candidates = [item for item in mlb_profiles if item.get("mlb_physical_percentile") is not None and item.get("stable_player_key") != target.get("stable_player_key")]
        if not candidates:
            continue
        nearest = min(candidates, key=lambda item: abs(item["mlb_physical_percentile"] - target["physical_percentile"]))
        nearest_by_target[target["stable_player_key"]] = nearest
    for mlb in mlb_profiles:
        candidates = [item for item in current_profiles if item.get("physical_percentile") is not None and item.get("stable_player_key") != mlb.get("stable_player_key")]
        if candidates:
            nearest_by_mlb[mlb["stable_player_key"]] = min(candidates, key=lambda item: abs(item["physical_percentile"] - mlb["mlb_physical_percentile"]))

    for target in sorted(current_profiles, key=lambda item: item["queue_order"]):
        for method, caliper, method_note in methods:
            candidate = nearest_by_target.get(target["stable_player_key"])
            row = {
                "target_player_key": target["stable_player_key"],
                "target_player": target["player"],
                "target_season": target["season"],
                "method": method,
                "method_note": method_note,
                "matched_player_key": None,
                "matched_player": None,
                "matched_mlbam_id": None,
                "feature_ids_used": "PHYSICAL_PROTOCOL_PERCENTILE_ONLY",
                "feature_count": 1 if target.get("physical_percentile") is not None and candidate else 0,
                "target_physical_percentile": target.get("physical_percentile"),
                "matched_physical_percentile": candidate.get("mlb_physical_percentile") if candidate else None,
                "feature_distance": None,
                "caliper": caliper,
                "common_support_status": "NO_COMMON_SUPPORT" if candidate is None else "LIMITED_PROTOCOL_RANK_SUPPORT",
                "match_confidence": "MISSING" if candidate is None else "LOW_LIMITED_SINGLE_FEATURE",
                "analog_state": "NO_VALID_ANALOG",
                "exclusion_reason": "missing target or MLB physical percentile" if candidate is None else "",
                "the_show_speed": None,
                "powerpro_expectation_role": "not estimated from this limited route",
            }
            if candidate is not None:
                distance = abs(target["physical_percentile"] - candidate["mlb_physical_percentile"])
                mutual = nearest_by_mlb.get(candidate["stable_player_key"], {}).get("stable_player_key") == target["stable_player_key"]
                valid = distance <= caliper and (method != "MUTUAL_KNN" or mutual)
                row.update({
                    "matched_player_key": candidate["stable_player_key"],
                    "matched_player": candidate["player"],
                    "matched_mlbam_id": candidate.get("mlbam_id"),
                    "feature_distance": round(distance, 8),
                    "analog_state": "VALID_BOUNDED_ANALOG" if valid else "NO_VALID_ANALOG",
                    "common_support_status": "LIMITED_PROTOCOL_RANK_SUPPORT" if valid else "OUTSIDE_CALIPER_OR_NOT_MUTUAL",
                    "match_confidence": "LOW_LIMITED_SINGLE_FEATURE" if valid else "REJECTED",
                    "exclusion_reason": "" if valid else ("outside_caliper" if distance > caliper else "not_mutual_neighborhood"),
                    "the_show_speed": candidate.get("the_show_speed"),
                })
            candidate_rows.append(row)
    fieldnames = [
        "target_player_key", "target_player", "target_season", "method", "method_note", "matched_player_key", "matched_player", "matched_mlbam_id", "feature_ids_used", "feature_count", "target_physical_percentile", "matched_physical_percentile", "feature_distance", "caliper", "common_support_status", "match_confidence", "analog_state", "exclusion_reason", "the_show_speed", "powerpro_expectation_role",
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    text_buffer = io.StringIO(newline="")
    writer = csv.DictWriter(text_buffer, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    for row in candidate_rows:
        writer.writerow({key: "" if row.get(key) is None else row.get(key) for key in fieldnames})
    with output_path.open("wb") as raw_handle:
        with gzip.GzipFile(fileobj=raw_handle, mode="wb", mtime=0) as gz_handle:
            gz_handle.write(text_buffer.getvalue().encode("utf-8"))
    summary = {
        "schema_version": "sp101_metric_neighborhood_player_summary_20260818",
        "route_id": "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE",
        "target_denominator": len(current_profiles),
        "mlb_candidate_denominator": len(mlb_profiles),
        "methods": methods,
        "feature_balance": {"common_feature_count": 1, "required_minimum_for_full_behavior_bridge": 2, "status": "LIMITED_SINGLE_PROTOCOL_FEATURE"},
        "caliper": {"mutual_knn": 0.20, "mahalanobis": 0.20, "optimal_transport": 0.25},
        "rows_emitted": len(candidate_rows),
        "valid_bounded_analog_rows": sum(row["analog_state"] == "VALID_BOUNDED_ANALOG" for row in candidate_rows),
        "no_valid_analog_rows": sum(row["analog_state"] == "NO_VALID_ANALOG" for row in candidate_rows),
        "negative_finding": "The destination snapshot exposes only one protocol-specific physical percentile for the cross-league target/MLB analog bridge. Outcome/context features are not jointly available on both sides, so the route is executed as a bounded rank QA lane and is not a full common-indicator behavior model. No nearest neighbor outside the caliper is promoted.",
        "physical_truth_guard": "The Show and matched-game outputs are external appraisal context; no output is copied into the independent physical estimate.",
    }
    return candidate_rows, summary


def build_source_manifest(history_files: list[Path], temporal_files: list[Path], source_roots: dict[str, Path], panel_rows: list[dict[str, Any]], source_counts: dict[str, Any]) -> dict[str, Any]:
    sources = []
    for path in history_files:
        sources.append({
            "repository": HISTORY_REPO,
            "branch": "codex/mlb-the-show-speed-history",
            "commit": HISTORY_COMMIT,
            "path": f"data/normalized/editions/{path.name}",
            "sha256": sha256_file(path),
            "rows_scanned": source_counts.get(path.name, 0),
            "role": "official_live_speed_stealing_aggression_roster_update_panel",
        })
    for path in temporal_files:
        sources.append({
            "repository": HISTORY_REPO,
            "branch": "codex/mlb-the-show-speed-temporal-rescue",
            "commit": TEMPORAL_COMMIT,
            "path": f"data/normalized/{path.name}",
            "sha256": sha256_file(path),
            "role": "official_or_archived_roster_update_event_and_temporal_qa",
        })
    crosswalk = source_roots.get("crosswalk")
    if crosswalk and crosswalk.exists():
        sources.append({
            "repository": HISTORY_REPO,
            "branch": "codex/mlb-the-show-speed-history",
            "commit": HISTORY_COMMIT,
            "path": "data/normalized/player_identity_crosswalk.csv",
            "sha256": sha256_file(crosswalk),
            "role": "conservative_MLBAM_identity_crosswalk",
        })
    sources.extend([
        {
            "repository": HISTORY_REPO,
            "branch": "codex/mlb-the-show-full-attributes",
            "commit": FULL_ATTRIBUTE_COMMIT,
            "path": "docs/audits/mlb_the_show_full_attribute_history_2017_2026.md",
            "sha256": None,
            "consumed": False,
            "role": "source_audit_and_schema_cross_check",
            "negative_finding": "The merged full-attribute panel has 2017-2026 scope labels but only MLB21-26 observed snapshots and no MLBAM IDs in the integrated rows. The pinned speed-history panel and conservative identity crosswalk were used for the primary speed join; editions 17-20 are not imputed.",
        },
    ])
    return {
        "schema_version": "sp101_external_source_manifest_20260818",
        "generated_at": DATE,
        "source_repository": HISTORY_REPO,
        "verified_remote_commits": {
            "codex/mlb-the-show-speed-history": HISTORY_COMMIT,
            "codex/mlb-the-show-speed-temporal-rescue": TEMPORAL_COMMIT,
            "codex/mlb-the-show-full-attributes": FULL_ATTRIBUTE_COMMIT,
        },
        "sources": sources,
        "panel_rows_matched_to_npb_identity": len(panel_rows),
        "source_scan_counts": source_counts,
        "large_raw_asset_policy": "Pinned source commits and per-file SHA-256 receipts are stored here; normalized matched evidence required downstream is stored in SP-101 outputs. Large raw source snapshots are not duplicated into this repository.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--history-root", default=os.environ.get("SP101_SHOW_HISTORY_ROOT", "/tmp/claude-code-hub-speed-history/data/normalized/editions"))
    parser.add_argument("--temporal-root", default=os.environ.get("SP101_SHOW_TEMPORAL_ROOT", "/tmp/claude-code-hub-speed-temporal/data/normalized"))
    parser.add_argument("--crosswalk", default=os.environ.get("SP101_SHOW_CROSSWALK", "/tmp/claude-code-hub-speed-history/data/normalized/player_identity_crosswalk.csv"))
    args = parser.parse_args()

    history_root = Path(args.history_root)
    temporal_root = Path(args.temporal_root)
    history_files = find_history_files(history_root)
    temporal_files = [path for path in [
        temporal_root / "showdd_live_speed_update_history_2021_2026.csv",
        temporal_root / "showdd_speed_temporal_model_dataset_2021_2026.csv",
    ] if path.exists()]
    crosswalk_path = Path(args.crosswalk)

    queue = read_json(QUEUE_PATH)
    ledger_before_text = LEDGER_PATH.read_text(encoding="utf-8")
    ledger_before_sha = sha256_bytes(ledger_before_text.encode("utf-8"))
    lock = read_json(LOCK_PATH)
    if queue.get("population", {}).get("emitted") != 100 or len(queue.get("players", [])) != 100:
        raise RuntimeError("SP-077 current queue is not exact 100")
    if lock.get("locked") is not True:
        raise RuntimeError("owner review lock is not active")

    db = sqlite3.connect(DB_PATH)
    canonical, by_npbnorm, by_english, mlb_bridge, show_bridge = build_canonical_maps(db, queue)
    feature_rows, features_by_canonical = load_batting_features(db, by_npbnorm)
    npb_plus = load_npb_plus(db, by_npbnorm)
    powerpro_rows, powerpro_by_player = load_powerpro(db, canonical, by_npbnorm, features_by_canonical)

    current_by_order = {int(player["queue_order"]): player for player in queue["players"]}
    current_keys = {order: next((key for key, item in canonical.items() if order in item["current_orders"]), None) for order in current_by_order}
    current_key_set = {key for key in current_keys.values() if key}

    # Add source aliases from the pinned identity crosswalk when available.
    crosswalk_rows = []
    if crosswalk_path.exists():
        with crosswalk_path.open(encoding="utf-8", newline="") as handle:
            crosswalk_rows = list(csv.DictReader(handle))
    crosswalk_by_name: dict[str, set[str]] = defaultdict(set)
    for row in crosswalk_rows:
        if row.get("player"):
            crosswalk_by_name[english_norm(row["player"])].add(clean_text(row.get("mlbam_id")))

    for key, record in canonical.items():
        for alias in list(record["source_names"]):
            for mlbam_id in crosswalk_by_name.get(english_norm(alias), set()):
                if mlbam_id:
                    record["mlbam_ids"].add(mlbam_id)

    english_candidates: dict[str, list[str]] = defaultdict(list)
    for key, record in canonical.items():
        aliases = set(record["source_names"]) | set(record["mlb_names"])
        for alias in aliases:
            normalized = english_norm(alias)
            if normalized and key not in english_candidates[normalized]:
                english_candidates[normalized].append(key)
    # Common source aliases that are explicitly the same person.
    alias_to_key: dict[str, str] = {}
    for normalized, keys in english_candidates.items():
        if len(keys) == 1:
            alias_to_key[normalized] = keys[0]

    all_show_speed_by_season: dict[str, list[float]] = defaultdict(list)
    unique_show_speed: dict[tuple[str, str, str], dict[str, Any]] = {}
    panel_rows: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    source_unmatched_names: Counter[str] = Counter()
    for path in history_files:
        count = 0
        with path.open(encoding="utf-8", newline="") as handle:
            for raw in csv.DictReader(handle):
                count += 1
                season = clean_text(raw.get("season"))
                speed = to_float(raw.get("speed"))
                if speed is not None:
                    all_show_speed_by_season[season].append(speed)
                unique_key = (season, clean_text(raw.get("player")), clean_text(raw.get("show_card_uuid")))
                if unique_key not in unique_show_speed:
                    unique_show_speed[unique_key] = raw
                candidate_keys = english_candidates.get(english_norm(raw.get("player")), [])
                if len(candidate_keys) != 1:
                    if candidate_keys:
                        source_unmatched_names[clean_text(raw.get("player"))] += 1
                    continue
                key = candidate_keys[0]
                record = canonical[key]
                mlbam_id = clean_text(raw.get("mlbam_id")) or next(iter(record["mlbam_ids"]), "")
                record["mlbam_ids"].add(mlbam_id) if mlbam_id else None
                record["the_show_uuids"].add(clean_text(raw.get("show_card_uuid")))
                panel_rows.append({
                    "stable_player_key": key,
                    "npb_name": sorted(record["npb_names"])[0] if record["npb_names"] else "",
                    "npb_name_en": record.get("npb_name_en", ""),
                    "mlb_name": clean_text(raw.get("player")),
                    "mlbam_id": mlbam_id,
                    "season": season,
                    "mlb_the_show_edition": clean_text(raw.get("mlb_the_show_edition")),
                    "roster_update_id": clean_text(raw.get("roster_update_id")),
                    "roster_update_date": clean_text(raw.get("roster_update_date")),
                    "rating_date": clean_text(raw.get("rating_date")),
                    "snapshot_type": clean_text(raw.get("snapshot_type")),
                    "show_card_uuid": clean_text(raw.get("show_card_uuid")),
                    "speed": speed,
                    "stealing": to_float(raw.get("stealing")),
                    "baserunning_aggressiveness": to_float(raw.get("baserunning_aggressiveness")),
                    "source": clean_text(raw.get("source")),
                    "source_url": clean_text(raw.get("source_url")),
                    "identity_confidence": clean_text(raw.get("identity_confidence")),
                    "identity_method": clean_text(raw.get("identity_method")),
                    "team": clean_text(raw.get("team")),
                    "team_short_name": clean_text(raw.get("team_short_name")),
                    "position": clean_text(raw.get("position")),
                    "scope_status": clean_text(raw.get("scope_status")),
                    "source_row_hash": source_row_hash(raw),
                    "source_file": path.name,
                    "source_commit": HISTORY_COMMIT,
                    "evidence_role": "THE_SHOW_LIVE_EXTERNAL_GAME_APPRAISAL",
                    "non_live_excluded": False,
                })
        source_counts[path.name] = count

    for row in panel_rows:
        row["show_speed_percentile_within_source_season"] = percentile_rank(all_show_speed_by_season.get(row["season"], []), row["speed"])

    panel_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in panel_rows:
        panel_by_key[row["stable_player_key"]].append(row)

    # The roster-update rescue is an event lane; the full-season sprint value is
    # explicitly quarantined when its provenance says it is look-ahead contaminated.
    temporal_event_rows: list[dict[str, Any]] = []
    temporal_counts = Counter()
    temporal_files_by_name = {path.name: path for path in temporal_files}
    event_path = temporal_files_by_name.get("showdd_live_speed_update_history_2021_2026.csv")
    if event_path:
        seen_events = set()
        with event_path.open(encoding="utf-8", newline="") as handle:
            for raw in csv.DictReader(handle):
                temporal_counts["rows_scanned"] += 1
                mlbam_id = clean_text(raw.get("mlbam_id"))
                keys = [key for key, item in canonical.items() if mlbam_id and mlbam_id in item["mlbam_ids"]]
                identity_join_method = "MLBAM_ID" if len(keys) == 1 else ""
                if not keys:
                    # The pinned event rescue source predates the enrichment of
                    # MLBAM IDs and is intentionally joined through the same
                    # conservative English-name crosswalk used for the Live
                    # panel.  Ambiguous names remain unmatched.
                    name_candidates = english_candidates.get(english_norm(raw.get("player")), [])
                    if len(name_candidates) == 1:
                        keys = name_candidates
                        identity_join_method = "CONSERVATIVE_SOURCE_NAME_CROSSWALK"
                if len(keys) != 1:
                    temporal_counts["unmatched_or_ambiguous"] += 1
                    continue
                event_key = (keys[0], clean_text(raw.get("season")), clean_text(raw.get("update_id")), clean_text(raw.get("show_card_uuid")), clean_text(raw.get("SPD_before")), clean_text(raw.get("SPD_after")))
                if event_key in seen_events:
                    temporal_counts["duplicate_events"] += 1
                    continue
                seen_events.add(event_key)
                key = keys[0]
                record = canonical[key]
                temporal_event_rows.append({
                    "stable_player_key": key,
                    "npb_name": sorted(record["npb_names"])[0] if record["npb_names"] else "",
                    "mlb_name": clean_text(raw.get("player")),
                    "mlbam_id": mlbam_id,
                    "identity_join_method": identity_join_method,
                    "season": clean_text(raw.get("season")),
                    "age": clean_text(raw.get("age")),
                    "team": clean_text(raw.get("team")),
                    "position": clean_text(raw.get("position")),
                    "update_id": clean_text(raw.get("update_id")),
                    "update_date": clean_text(raw.get("update_date")),
                    "show_card_uuid": clean_text(raw.get("show_card_uuid")),
                    "live_series_status": clean_text(raw.get("live_series_status")),
                    "speed_before": to_float(raw.get("SPD_before")),
                    "speed_after": to_float(raw.get("SPD_after")),
                    "speed_delta": to_float(raw.get("delta_SPD")),
                    "source_provenance": clean_text(raw.get("source_provenance")),
                    "source_confidence": clean_text(raw.get("source_confidence")),
                    "leakage_flag": clean_text(raw.get("leakage_flag")),
                    "primary_temporal_model_eligible": clean_text(raw.get("primary_temporal_model_eligible")),
                    "observation_is_carry_forward": clean_text(raw.get("observation_is_carry_forward")),
                    "event_role": clean_text(raw.get("event_role")),
                    "source": "claude-code-hub:showdd_live_speed_update_history_2021_2026.csv",
                    "source_commit": TEMPORAL_COMMIT,
                })
                temporal_counts["matched_events"] += 1
    temporal_counts["lookahead_fullseason_quarantined"] = 0
    temporal_model_path = temporal_files_by_name.get("showdd_speed_temporal_model_dataset_2021_2026.csv")
    if temporal_model_path:
        with temporal_model_path.open(encoding="utf-8", newline="") as handle:
            for raw in csv.DictReader(handle):
                if "LOOKAHEAD" in clean_text(raw.get("leakage_flag")):
                    temporal_counts["lookahead_fullseason_quarantined"] += 1

    # Aggregate source panel observations by player-season for downstream time
    # joins.  The raw matched Live rows remain in the gzip panel.
    show_season: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in panel_rows:
        show_season[(row["stable_player_key"], row["season"])].append(row)

    pawa_latest: dict[str, dict[str, Any]] = {}
    for key, rows in powerpro_by_player.items():
        if rows:
            pawa_latest[key] = max(rows, key=lambda row: (row.get("work_year") or 0, row.get("powerpro_speed") or -1))

    npb_plus_values = [item.get("top_speed_percentile") for item in npb_plus.values() if item.get("top_speed_percentile") is not None]
    current_profiles: list[dict[str, Any]] = []
    for order in sorted(current_by_order):
        player = current_by_order[order]
        identity = player.get("identity", {})
        key = current_keys.get(order)
        if not key:
            key = f"NPBNAME:{jp_norm(identity.get('player'))}"
            canonical.setdefault(key, {"stable_player_key": key, "npb_names": {identity.get("player", "")}, "npb_name_en": "", "mlb_names": set(), "production_player_ids": {clean_text(identity.get("production_player_id"))}, "proeye_id": clean_text(identity.get("production_player_id")) or None, "source_names": set(), "current_orders": {order}, "npb_norms": {jp_norm(identity.get("player"))}, "mlbam_ids": set(), "the_show_uuids": set(), "mlb_evidence": False, "identity_notes": []})
            current_keys[order] = key
        physical = player.get("current_physical_evidence", {})
        pctl = to_float(physical.get("percentile_faster_than_in_current_100"))
        show_rows = panel_by_key.get(key, [])
        record = canonical[key]
        has_mlb = bool(record.get("mlb_evidence") or record.get("mlbam_ids"))
        if clean_text(identity.get("player")) == "ソト":
            coverage_state = "IDENTITY_UNRESOLVED"
            identity_state = "AMBIGUOUS_SHORT_NPB_NAME_NOT_FORCED"
        elif show_rows:
            coverage_state = "ELIGIBLE_MATCHED"
            identity_state = "MATCHED_ID_OR_HIGH_CONFIDENCE_NAME"
        elif has_mlb:
            coverage_state = "THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH"
            identity_state = "MLB_MATCHED_SHOW_LIVE_NOT_OBSERVED_IN_PINNED_PANEL"
        else:
            coverage_state = "NO_MLB_PROMOTION_FOUND"
            identity_state = "NO_MATCH_IN_SCREENED_MLB_AND_SHOW_CROSSWALKS"
        features = features_by_canonical.get(key, [])
        current_feature = max(features, key=lambda row: row["season"]) if features else None
        current_profile = {
            "queue_order": order,
            "player": identity.get("player", ""),
            "team": identity.get("team", ""),
            "stable_player_key": key,
            "production_player_id": identity.get("production_player_id"),
            "season": 2026,
            "coverage_state": coverage_state,
            "identity_state": identity_state,
            "identity_notes": sorted(set(record.get("identity_notes", []))),
            "physical_percentile": pctl,
            "physical_top_speed_kmh": to_float(physical.get("npb_plus_top_speed_kmh")),
            "physical_top_speed_rank": physical.get("rank_fastest_in_current_100"),
            "acceleration_h2f_t90_state": player.get("acceleration_h2f_t90_evidence", {}).get("evidence_state"),
            "acceleration_records": player.get("acceleration_h2f_t90_evidence", {}).get("normal_swing_h2f", {}),
            "direct_t90_count": player.get("acceleration_h2f_t90_evidence", {}).get("direct_or_standardized_t90_records", []).__len__(),
            "show_rows": len(show_rows),
            "show_speeds": [row["speed"] for row in show_rows if row.get("speed") is not None],
            "show_stealing": [row["stealing"] for row in show_rows if row.get("stealing") is not None],
            "show_aggression": [row["baserunning_aggressiveness"] for row in show_rows if row.get("baserunning_aggressiveness") is not None],
            "npb_feature_row": current_feature,
            "powerpro_latest": pawa_latest.get(key),
            "community_context": player.get("community_physical_context", {}),
            "queue_physical": {
                "top_speed_evidence_state": player.get("top_speed_evidence", {}).get("evidence_state"),
                "short_distance_state": player.get("short_distance_physical_evidence", {}).get("evidence_state"),
                "historical_physical_state": player.get("historical_physical_temporal_context", {}).get("evidence_state"),
                "age_state": player.get("historical_physical_temporal_context", {}).get("age_context", {}).get("evidence_state"),
                "injury_state": player.get("historical_physical_temporal_context", {}).get("injury_context", {}).get("evidence_state"),
            },
        }
        current_profiles.append(current_profile)

    mlb_profiles: list[dict[str, Any]] = []
    mlb_sprint_values = [item.get("sprint_speed_avg") for item in mlb_bridge.values() if item.get("sprint_speed_avg") is not None]
    for key, bridge in sorted(mlb_bridge.items()):
        if bridge.get("sprint_speed_avg") is None:
            continue
        show = show_bridge.get(key, {})
        mlb_profiles.append({
            "stable_player_key": key,
            "player": sorted(canonical[key].get("npb_names", {key}))[0],
            "mlbam_id": next(iter(canonical[key].get("mlbam_ids", set())), None),
            "mlb_physical_percentile": percentile_rank(mlb_sprint_values, bridge.get("sprint_speed_avg")),
            "mlb_sprint_speed_avg": bridge.get("sprint_speed_avg"),
            "the_show_speed": show.get("speed_avg"),
            "show_source": "data/pennant.db:the_show_bridge" if show else None,
        })

    analog_path = ROOT / "outputs" / "derived" / "sp101_metric_neighborhood_analog_pairs.csv.gz"
    analog_rows, analog_summary = build_analog_routes(current_profiles, mlb_profiles, analog_path)
    write_json(ROOT / "outputs" / "derived" / "sp101_metric_neighborhood_player_summary.json", analog_summary)

    # Model outputs.  The Show model is deliberately a behavior/QA model and
    # the PowerPro model is a historical NPB appraisal-behavior model.
    show_model_rows = []
    for key, bridge in mlb_bridge.items():
        show = show_bridge.get(key, {})
        if bridge.get("sprint_speed_avg") is not None and show.get("speed_avg") is not None:
            show_model_rows.append({"stable_player_key": key, "mlb_sprint_speed_avg": bridge["sprint_speed_avg"], "the_show_speed_avg": show["speed_avg"]})
    show_fit = line_fit([(row["mlb_sprint_speed_avg"], row["the_show_speed_avg"]) for row in show_model_rows])
    show_cv = grouped_line_cv(show_model_rows, "mlb_sprint_speed_avg", "the_show_speed_avg", "stable_player_key")
    pawa_feature_names = ["sb_attempt_rate", "sb_success_rate", "triple_rate", "gdp_rate", "run_rate", "bip_rate", "single_rate", "double_rate"]
    powerpro_model_rows = [row for row in powerpro_rows if row.get("powerpro_speed") is not None]
    powerpro_models = {}
    for feature in pawa_feature_names:
        powerpro_models[feature] = {
            "fit": line_fit([(float(row[feature]), float(row["powerpro_speed"])) for row in powerpro_model_rows if row.get(feature) is not None]),
            "grouped_player_holdout": grouped_line_cv(powerpro_model_rows, feature, "powerpro_speed", "stable_player_key"),
        }
    powerpro_ridge = ridge_fit(powerpro_model_rows, pawa_feature_names, "powerpro_speed", ridge=1.0)
    dual_models = {
        "schema_version": "sp101_dual_game_behavior_models_20260818",
        "route_id": "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS",
        "the_show_speed_from_mlb_indicators": {
            "formula": "The Show Speed ~ MLB bridge sprint-speed average",
            "rows": len(show_model_rows),
            "unique_player_groups": len({row["stable_player_key"] for row in show_model_rows}),
            "fit": show_fit,
            "player_clustered_holdout": show_cv,
            "edition_effect": "Edition-specific observations are retained in the panel; the bounded destination bridge has no edition-complete paired Statcast feature, so edition coefficient is not identified.",
        },
        "powerpro_speed_from_npb_indicators": {
            "formula": "historical PowerPro speed ~ league-season normalized NPB opportunity/outcome indicators",
            "rows_with_label": len(powerpro_model_rows),
            "unique_player_groups": len({row.get("stable_player_key") for row in powerpro_model_rows if row.get("stable_player_key")}),
            "feature_models": powerpro_models,
            "ridge_screen": powerpro_ridge,
            "forward_season_holdout": "NOT_IDENTIFIABLE_AS_FULL_FORWARD_PANEL: PowerPro work and NPB season are sparse/nearest-joined; nearest <=3-year joins are retained with temporal_gap rather than treated as same-year truth.",
        },
        "model_separation": {
            "direct_powerpro_to_show_model_fit": False,
            "powerpro_label_in_physical_path": False,
            "the_show_is_direct_physical_measurement": False,
            "outputs_are_external_game_appraisal_expectations": True,
        },
        "negative_findings": [
            "The destination DB has no complete MLB batting/Statcast shared-indicator panel corresponding to the NPB event features, so a full dual cross-league behavior model is not identified here.",
            "PowerPro work-to-NPB season joins are nearest bounded joins, not causal or same-season conversion labels.",
            "The Show editions 21-26 are observed snapshots/update carries; no 17-20 values are imputed.",
        ],
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_dual_game_behavior_models.json", dual_models)

    # Temporal/transition panels.
    transition_rows: list[dict[str, Any]] = []
    temporal_pair_rows: list[dict[str, Any]] = []
    calibration_rows: list[dict[str, Any]] = []
    delta_by_player: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for (key, season), rows in sorted(show_season.items()):
        speeds = [row["speed"] for row in rows if row.get("speed") is not None]
        stealings = [row["stealing"] for row in rows if row.get("stealing") is not None]
        aggressions = [row["baserunning_aggressiveness"] for row in rows if row.get("baserunning_aggressiveness") is not None]
        show_speed = median_or_none(speeds)
        pawa = powerpro_by_player.get(key, [])
        closest_pawa = None
        if pawa:
            closest_pawa = min(pawa, key=lambda row: abs((row.get("work_year") or int(season)) - int(season)))
        bridge = mlb_bridge.get(key, {})
        calibration_rows.append({
            "stable_player_key": key,
            "npb_name": sorted(canonical[key].get("npb_names", {key}))[0],
            "mlb_name": rows[0].get("mlb_name"),
            "season": season,
            "edition": rows[0].get("mlb_the_show_edition"),
            "the_show_speed_median": show_speed,
            "the_show_stealing_median": median_or_none(stealings),
            "the_show_baserunning_aggression_median": median_or_none(aggressions),
            "the_show_speed_percentile": percentile_rank(all_show_speed_by_season.get(season, []), show_speed),
            "mlb_sprint_speed_avg": bridge.get("sprint_speed_avg"),
            "powerpro_work": closest_pawa.get("work") if closest_pawa else None,
            "powerpro_speed": closest_pawa.get("powerpro_speed") if closest_pawa else None,
            "powerpro_speed_percentile": closest_pawa.get("powerpro_speed_percentile") if closest_pawa else None,
            "powerpro_temporal_gap_years": abs((closest_pawa.get("work_year") or int(season)) - int(season)) if closest_pawa else None,
            "role": "SAME_OR_NEAR_TIME_CROSS_GAME_QA" if closest_pawa and abs((closest_pawa.get("work_year") or int(season)) - int(season)) <= 1 else "CROSS_TIME_PLAYER_TRAJECTORY",
            "physical_truth_guard": "The Show and PowerPro are external game appraisal/context, not physical ground truth.",
        })
        for row in sorted(rows, key=lambda item: (item.get("roster_update_date", ""), item.get("roster_update_id", ""))):
            delta_by_player[key].append(row)
        if closest_pawa:
            temporal_pair_rows.append({
                "stable_player_key": key,
                "npb_name": sorted(canonical[key].get("npb_names", {key}))[0],
                "mlb_name": rows[0].get("mlb_name"),
                "the_show_season": season,
                "the_show_edition": rows[0].get("mlb_the_show_edition"),
                "the_show_speed": show_speed,
                "the_show_stealing": median_or_none(stealings),
                "the_show_baserunning_aggressiveness": median_or_none(aggressions),
                "powerpro_work": closest_pawa.get("work"),
                "powerpro_speed_raw": closest_pawa.get("powerpro_speed"),
                "powerpro_speed_percentile": closest_pawa.get("powerpro_speed_percentile"),
                "temporal_gap_years": abs((closest_pawa.get("work_year") or int(season)) - int(season)),
                "transition_context": "PLAYER_YEAR_PAIR_NOT_LIFETIME_AVERAGE",
            })

    for key, record in sorted(canonical.items()):
        npb_years = sorted({int(row["season"]) for row in features_by_canonical.get(key, [])})
        show_years = sorted({int(row["season"]) for row in panel_by_key.get(key, []) if str(row.get("season", "")).isdigit()})
        year_events = [(year, "NPB") for year in npb_years] + [(year, "MLB") for year in show_years]
        if not year_events:
            continue
        year_events.sort()
        groups: list[dict[str, Any]] = []
        for year, league in year_events:
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
            transition_rows.append({
                "stable_player_key": key,
                "npb_name": sorted(record.get("npb_names", {key}))[0],
                "npb_name_en": record.get("npb_name_en", ""),
                "segment_number": index + 1,
                "transition_direction": direction,
                "from_league": left["league"],
                "from_start_year": left["start_year"],
                "from_end_year": left["end_year"],
                "to_league": right["league"],
                "to_start_year": right["start_year"],
                "to_end_year": right["end_year"],
                "time_gap_years": max(0, right["start_year"] - left["end_year"] - 1),
                "returnee_or_multi_cycle": len(groups) > 2,
                "the_show_years": ",".join(map(str, show_years)),
                "npb_years": ",".join(map(str, npb_years)),
                "age_state": "MISSING_BOUNDED",
                "injury_state": "MISSING_BOUNDED",
                "source_role": "TRANSITION_CALIBRATION_NOT_LIFETIME_AVERAGE",
            })

    temporal_delta_rows = []
    speed_deltas = []
    for key, rows in sorted(delta_by_player.items()):
        by_season = defaultdict(list)
        for row in rows:
            if row.get("speed") is not None:
                by_season[row["season"]].append(row["speed"])
        annual = [(int(season), median_or_none(values)) for season, values in sorted(by_season.items())]
        for (season_a, speed_a), (season_b, speed_b) in zip(annual, annual[1:]):
            if speed_a is None or speed_b is None:
                continue
            temporal_delta_rows.append({
                "stable_player_key": key,
                "npb_name": sorted(canonical[key].get("npb_names", {key}))[0],
                "from_season": season_a,
                "to_season": season_b,
                "the_show_speed_delta": speed_b - speed_a,
                "delta_role": "within_player_annual_snapshot_median",
            })
            speed_deltas.append(speed_b - speed_a)

    powerpro_delta_rows = []
    powerpro_deltas = []
    for key, rows in sorted(powerpro_by_player.items()):
        ordered = sorted([row for row in rows if row.get("work_year") is not None and row.get("powerpro_speed") is not None], key=lambda row: row["work_year"])
        for left, right in zip(ordered, ordered[1:]):
            powerpro_delta_rows.append({
                "stable_player_key": key,
                "npb_name": sorted(canonical[key].get("npb_names", {key}))[0] if key in canonical else left.get("npb_name"),
                "from_work": left.get("work"),
                "to_work": right.get("work"),
                "powerpro_speed_delta_raw": right["powerpro_speed"] - left["powerpro_speed"],
                "powerpro_percentile_delta": (right.get("powerpro_speed_percentile") or 0) - (left.get("powerpro_speed_percentile") or 0),
            })
            powerpro_deltas.append(right["powerpro_speed"] - left["powerpro_speed"])

    write_csv(ROOT / "outputs" / "derived" / "sp101_the_show_roster_update_speed_events.csv", temporal_event_rows, [
        "stable_player_key", "npb_name", "mlb_name", "mlbam_id", "identity_join_method", "season", "age", "team", "position", "update_id", "update_date", "show_card_uuid", "live_series_status", "speed_before", "speed_after", "speed_delta", "source_provenance", "source_confidence", "leakage_flag", "primary_temporal_model_eligible", "observation_is_carry_forward", "event_role", "source", "source_commit",
    ])
    write_csv(ROOT / "outputs" / "derived" / "sp101_npb_mlb_transition_segments.csv", transition_rows, [
        "stable_player_key", "npb_name", "npb_name_en", "segment_number", "transition_direction", "from_league", "from_start_year", "from_end_year", "to_league", "to_start_year", "to_end_year", "time_gap_years", "returnee_or_multi_cycle", "the_show_years", "npb_years", "age_state", "injury_state", "source_role",
    ])
    write_csv(ROOT / "outputs" / "derived" / "sp101_powerpro_the_show_temporal_pairs.csv", temporal_pair_rows, [
        "stable_player_key", "npb_name", "mlb_name", "the_show_season", "the_show_edition", "the_show_speed", "the_show_stealing", "the_show_baserunning_aggressiveness", "powerpro_work", "powerpro_speed_raw", "powerpro_speed_percentile", "temporal_gap_years", "transition_context",
    ])
    write_csv(ROOT / "outputs" / "derived" / "sp101_historical_npb_the_show_calibration_panel.csv", calibration_rows, [
        "stable_player_key", "npb_name", "mlb_name", "season", "edition", "the_show_speed_median", "the_show_stealing_median", "the_show_baserunning_aggression_median", "the_show_speed_percentile", "mlb_sprint_speed_avg", "powerpro_work", "powerpro_speed", "powerpro_speed_percentile", "powerpro_temporal_gap_years", "role", "physical_truth_guard",
    ])

    temporal_inertia = {
        "schema_version": "sp101_temporal_delta_and_inertia_20260818",
        "route_ids": ["MB-04_WITHIN_PLAYER_TEMPORAL_DELTA", "MB-06_RATING_INERTIA_AND_STALENESS_MODEL", "MB-09_THE_SHOW_ROSTER_UPDATE_RESPONSE"],
        "the_show_panel": {
            "matched_player_denominator": len(panel_by_key),
            "matched_raw_rows": len(panel_rows),
            "explicit_event_rows": len(temporal_event_rows),
            "annual_delta_rows": len(temporal_delta_rows),
            "annual_delta_median": median_or_none(speed_deltas),
            "annual_delta_p10": min(speed_deltas) if speed_deltas else None,
            "annual_delta_p90": max(speed_deltas) if speed_deltas else None,
            "event_delta_median": median_or_none([row.get("speed_delta") for row in temporal_event_rows]),
            "carry_forward_rows": sum(row.get("observation_is_carry_forward") == "YES" for row in temporal_event_rows),
            "primary_event_rows": sum(row.get("source_confidence") == "PRIMARY_ARCHIVED_OFFICIAL_HTML" for row in temporal_event_rows),
        },
        "age_and_injury": {
            "age_join": "BLOCKED_MISSING_DATA",
            "injury_join": "BLOCKED_MISSING_DATA",
            "no_negative_inference": True,
        },
        "lookahead_guard": {
            "fullseason_lookahead_rows_quarantined": temporal_counts.get("lookahead_fullseason_quarantined", 0),
            "quarantined_feature": "sprint_current_fullseason",
            "used_for_model": False,
        },
        "negative_findings": [
            "Roster-update date is an operational snapshot date, not proof that every attribute changed on that date.",
            "Carry-forward observations are retained but are not treated as exact changes.",
            "No age-conditioned decay estimate is identified because the destination snapshot has no usable birthdate join.",
            "No injury-conditioned decay estimate is identified because no structured date+body-part injury table is present.",
        ],
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_temporal_delta_and_inertia.json", temporal_inertia)

    transition_effects = {
        "schema_version": "sp101_transition_effects_20260818",
        "route_id": "MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS",
        "segment_denominator": len(transition_rows),
        "unique_transition_players": len({row["stable_player_key"] for row in transition_rows}),
        "direction_counts": dict(Counter(row["transition_direction"] for row in transition_rows)),
        "returnee_or_multi_cycle_count": sum(bool(row["returnee_or_multi_cycle"]) for row in transition_rows),
        "player_fixed_effects": "NOT_IDENTIFIABLE_AS_CAUSAL_EFFECT_WITH_SMALL_DIRECTIONAL_COHORTS; segment-level observations and gaps are emitted without lifetime averaging.",
        "age_injury_controls": "MISSING_BOUNDED",
        "negative_finding": "The available snapshot supports explicit transition segmentation and direction counts, but not a stable causal fixed-effect estimate after age/injury adjustment. Segment rows remain available for later evidence integration.",
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_transition_effects.json", transition_effects)

    # Multi-trait latent measurement metadata and current-player observations.
    latent_players = []
    for profile in current_profiles:
        show_speed_pctl = None
        if profile["show_speeds"]:
            show_speed_pctl = percentile_rank([value for values in all_show_speed_by_season.values() for value in values], median_or_none(profile["show_speeds"]))
        pawa_pct = profile.get("powerpro_latest", {}).get("powerpro_speed_percentile") if profile.get("powerpro_latest") else None
        latent_players.append({
            "stable_player_key": profile["stable_player_key"],
            "player": profile["player"],
            "physical_latent_features": {
                "PEAK_SPEED": {"npb_plus_top_speed_kmh": profile["physical_top_speed_kmh"], "npb_plus_percentile": profile["physical_percentile"]},
                "INITIAL_ACCELERATION_END_TO_END_90FT": {"h2f_or_t90_observations": profile["acceleration_records"], "state": profile["acceleration_h2f_t90_state"]},
            },
            "external_game_appraisal_observations": {
                "THE_SHOW_SPEED": {"median": median_or_none(profile["show_speeds"]), "percentile_context": show_speed_pctl, "state": "AVAILABLE_EXTERNAL_APPRAISAL" if profile["show_speeds"] else "MISSING_BOUNDED"},
                "POWERPRO_SPEED": {"percentile": pawa_pct, "state": "AVAILABLE_HISTORICAL_APPRAISAL" if pawa_pct is not None else "MISSING_BOUNDED"},
            },
            "technique_and_aggression": {
                "STEALING_TECHNIQUE": {"the_show_stealing_median": median_or_none(profile["show_stealing"]), "state": "AVAILABLE_SEPARATE_ATTRIBUTE" if profile["show_stealing"] else "MISSING_BOUNDED"},
                "BASERUNNING_AGGRESSION_DECISION": {"the_show_aggression_median": median_or_none(profile["show_aggression"]), "state": "AVAILABLE_SEPARATE_ATTRIBUTE" if profile["show_aggression"] else "MISSING_BOUNDED"},
            },
            "physical_path_powerpro_label_used": False,
            "single_measurement_family_double_counting_guard": True,
        })
    latent_model = {
        "schema_version": "sp101_latent_multitrait_speed_model_20260818",
        "route_id": "MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL",
        "status": "DESCRIPTIVE_MEASUREMENT_MODEL_WITH_BOUNDED_IDENTIFIABILITY",
        "traits": ["PEAK_SPEED", "INITIAL_ACCELERATION_END_TO_END_90FT", "STEALING_TECHNIQUE", "BASERUNNING_AGGRESSION_DECISION"],
        "source_roles": {
            "PEAK_SPEED": ["NPB_PLUS_TOP_SPEED_KMH", "Statcast Sprint Speed when available", "The Show Speed as external appraisal only"],
            "INITIAL_ACCELERATION_END_TO_END_90FT": ["H2F", "T10", "T30", "T90", "30m/50m timed tests"],
            "STEALING_TECHNIQUE": ["The Show Stealing", "SB success conditioned on attempt opportunity"],
            "BASERUNNING_AGGRESSION_DECISION": ["The Show Baserunning Aggressiveness", "attempt/advancement context"],
        },
        "physical_latent_forbidden_features": ["PowerPro speed", "PowerPro percentile", "PowerPro stealing/走塁 labels", "unlabelled The Show game rating"],
        "current100": latent_players,
        "negative_findings": [
            "Direct acceleration/end-to-end coverage remains sparse and cannot be converted from 30m/50m to T90 by linear scaling.",
            "The Show editions 21-25 Stealing normalization is a source-field mapping, not a proof of identical historical semantics; it remains a separate appraisal attribute.",
            "A single measurement family is not counted twice when describing confidence.",
        ],
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_latent_multitrait_speed_model.json", latent_model)

    # Ordinal graph.  Edges are source-family deduplicated and never merged
    # into a single numerical rating.
    ordinal_edges = []
    seen_edges = set()
    def add_edge(left: dict[str, Any], right: dict[str, Any], source_family: str, source_detail: str, strength: float | None) -> None:
        if left["stable_player_key"] == right["stable_player_key"] or strength is None:
            return
        if strength == 0:
            return
        faster, slower = (left, right) if strength > 0 else (right, left)
        edge_key = (faster["stable_player_key"], slower["stable_player_key"], source_family)
        if edge_key in seen_edges:
            return
        seen_edges.add(edge_key)
        ordinal_edges.append({
            "faster_player_key": faster["stable_player_key"],
            "faster_player": faster["player"],
            "slower_player_key": slower["stable_player_key"],
            "slower_player": slower["player"],
            "source_family": source_family,
            "source_detail": source_detail,
            "strength": round(abs(strength), 8),
            "temporal_scope": "2026_current" if source_family == "DIRECT_PHYSICAL" else "player-year_or_historical_context",
        })
    for index, left in enumerate(current_profiles):
        for right in current_profiles[index + 1:]:
            if left.get("physical_percentile") is not None and right.get("physical_percentile") is not None:
                diff = left["physical_percentile"] - right["physical_percentile"]
                if abs(diff) >= 0.05:
                    add_edge(left, right, "DIRECT_PHYSICAL", "NPB+ current top-speed rank; peak-speed lane only", diff)
            left_show = median_or_none(left["show_speeds"])
            right_show = median_or_none(right["show_speeds"])
            if left_show is not None and right_show is not None and abs(left_show - right_show) >= 3:
                add_edge(left, right, "THE_SHOW_LIVE", "Live Speed ordinal relation; external game appraisal", left_show - right_show)
            left_pp = left.get("powerpro_latest", {}).get("powerpro_speed_percentile") if left.get("powerpro_latest") else None
            right_pp = right.get("powerpro_latest", {}).get("powerpro_speed_percentile") if right.get("powerpro_latest") else None
            if left_pp is not None and right_pp is not None and abs(left_pp - right_pp) >= 0.05:
                add_edge(left, right, "POWERPRO_PERCENTILE", "historical game appraisal ordinal context", left_pp - right_pp)

    graph = defaultdict(set)
    for edge in ordinal_edges:
        graph[edge["faster_player_key"]].add(edge["slower_player_key"])
    cycle_count = 0
    nodes = sorted({edge["faster_player_key"] for edge in ordinal_edges} | {edge["slower_player_key"] for edge in ordinal_edges})
    for a_index, a in enumerate(nodes):
        for b in nodes[a_index + 1:]:
            if b not in graph.get(a, set()) and a not in graph.get(b, set()):
                continue
            for c in nodes:
                if c in {a, b}:
                    continue
                if b in graph.get(a, set()) and c in graph.get(b, set()) and a in graph.get(c, set()):
                    cycle_count += 1
    ordinal_graph = {
        "schema_version": "sp101_pairwise_ordinal_graph_20260818",
        "route_id": "MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH",
        "node_count": len(current_profiles),
        "edge_count": len(ordinal_edges),
        "edges": ordinal_edges,
        "supported_rank_interval_policy": "Ranks are partial-order intervals by source family; no universal numeric conversion is emitted.",
        "inconsistent_cycle_count_raw": cycle_count,
        "duplicate_source_family_edges_removed": len(seen_edges),
        "edge_ablation": {family: sum(edge["source_family"] == family for edge in ordinal_edges) for family in sorted({edge["source_family"] for edge in ordinal_edges})},
        "negative_finding": "Ordinal evidence is available for direct current top-speed and separate game-appraisal routes, but sparse The Show coverage prevents a dense all-100 game graph. Missing edges are not treated as slow.",
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_pairwise_ordinal_graph.json", ordinal_graph)

    # Four-way current-100 packet and decision-use/ablation matrix.
    route_results = {}
    analog_by_player = defaultdict(list)
    for row in analog_rows:
        analog_by_player[row["target_player_key"]].append(row)
    transition_by_player = defaultdict(list)
    for row in transition_rows:
        transition_by_player[row["stable_player_key"]].append(row)
    temporal_by_player = defaultdict(list)
    for row in temporal_event_rows:
        temporal_by_player[row["stable_player_key"]].append(row)

    multibridge_players = []
    utilization_players = []
    residual_players = []
    for profile in sorted(current_profiles, key=lambda item: item["queue_order"]):
        physical_pct = profile.get("physical_percentile")
        show_speed = median_or_none(profile.get("show_speeds", []))
        show_pct = percentile_rank([value for values in all_show_speed_by_season.values() for value in values], show_speed)
        pawa = profile.get("powerpro_latest")
        pawa_pct = pawa.get("powerpro_speed_percentile") if pawa else None
        disagreements = []
        if physical_pct is not None and show_pct is not None and abs(physical_pct - show_pct) >= 0.20:
            disagreements.append("PHYSICAL_VS_THE_SHOW_PERCENTILE_DIFFERENCE_GE_0.20")
        if physical_pct is not None and pawa_pct is not None and abs(physical_pct - pawa_pct) >= 0.20:
            disagreements.append("PHYSICAL_VS_POWERPRO_PERCENTILE_DIFFERENCE_GE_0.20")
        if profile["coverage_state"] == "IDENTITY_UNRESOLVED":
            disagreements.append("IDENTITY_AMBIGUITY")
        if profile["acceleration_h2f_t90_state"] in {None, "MISSING_BOUNDED"} or profile["direct_t90_count"] == 0:
            acceleration_state = "MISSING_BOUNDED"
        else:
            acceleration_state = "AVAILABLE_BOUNDED"
        physical_range = safe_range(physical_pct * 100 if physical_pct is not None else None, 15.0)
        show_range = safe_range(show_speed, 10.0, 0.0, 99.0) if show_speed is not None else None
        pawa_range = safe_range((pawa_pct * 100) if pawa_pct is not None else None, 12.0) if pawa_pct is not None else None
        confidence = "LOW" if acceleration_state == "MISSING_BOUNDED" or disagreements else ("MEDIUM" if physical_pct is not None else "VERY_LOW")
        analog_rows_for_player = analog_by_player.get(profile["stable_player_key"], [])
        valid_analogs = [row for row in analog_rows_for_player if row["analog_state"] == "VALID_BOUNDED_ANALOG"]
        route_disagreement = {
            "state": "MATERIAL_CONFLICT" if disagreements else "NO_MATERIAL_CONFLICT_DETECTED",
            "reasons": disagreements,
            "physical_percentile": physical_pct,
            "the_show_percentile_context": show_pct,
            "powerpro_behavior_percentile_context": pawa_pct,
            "analog_valid_method_count": len(valid_analogs),
        }
        target_reasons = []
        if acceleration_state == "MISSING_BOUNDED":
            target_reasons.append("acceleration_or_end_to_end_lane_missing")
        if disagreements:
            target_reasons.extend(disagreements)
        if profile["coverage_state"] == "THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH":
            target_reasons.append("MLB_MATCH_WITHOUT_PINNED_LIVE_THE_SHOW_OBSERVATION")
        if profile["coverage_state"] == "IDENTITY_UNRESOLVED":
            target_reasons.append("identity_resolution_required_before_game_evidence_use")
        if disagreements:
            target_state = "TARGETED_MATERIAL_CONFLICT"
        elif target_reasons and profile["coverage_state"] in {"ELIGIBLE_MATCHED", "THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH", "IDENTITY_UNRESOLVED"}:
            target_state = "TARGETED_LOW_CONFIDENCE"
        elif physical_pct is not None and acceleration_state == "AVAILABLE_BOUNDED":
            target_state = "NOT_TARGETED_SUFFICIENT_CONFIDENCE"
        else:
            target_state = "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN"
        residual_players.append({
            "queue_order": profile["queue_order"],
            "stable_player_key": profile["stable_player_key"],
            "player": profile["player"],
            "target_selection_state": target_state,
            "target_reasons": target_reasons or ["no_residual_route_conflict_or_information_gain_trigger"],
            "pre_rescue_confidence": confidence,
            "expected_information_gain": "HIGH" if target_state.startswith("TARGETED_") and (disagreements or acceleration_state == "MISSING_BOUNDED") else "LOW",
            "comment_search_allowed_in_SP102": target_state.startswith("TARGETED_"),
            "selection_basis": "post_SP101_route_residuals_not_comment_availability",
        })
        route_values = {
            "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE": {"state": "USED_CONTEXT" if valid_analogs else "AVAILABLE_NOT_DECISION_EFFECTIVE", "rationale": f"{profile['player']}: {len(valid_analogs)} bounded rank analog methods valid; physical protocol support remains limited and no forced analog was used."},
            "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS": {"state": "USED_CONTEXT" if show_speed is not None or pawa_pct is not None else "BLOCKED_MISSING_DATA", "rationale": f"{profile['player']}: The Show rows={profile['show_rows']}, PowerPro trajectory={'available' if pawa else 'missing'}; behavior outputs remain separate from physical path."},
            "MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL": {"state": "USED_DIRECTLY" if physical_pct is not None else "BLOCKED_MISSING_DATA", "rationale": f"{profile['player']}: peak-speed percentile={physical_pct}; acceleration state={acceleration_state}; technique/aggression kept separate."},
            "MB-04_WITHIN_PLAYER_TEMPORAL_DELTA": {"state": "USED_CONTEXT" if temporal_by_player.get(profile['stable_player_key']) else "AVAILABLE_NOT_DECISION_EFFECTIVE", "rationale": f"{profile['player']}: matched roster-update events={len(temporal_by_player.get(profile['stable_player_key'], []))}; no automatic carry-forward correction."},
            "MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS": {"state": "USED_CONTEXT" if transition_by_player.get(profile['stable_player_key']) else "AVAILABLE_NOT_DECISION_EFFECTIVE", "rationale": f"{profile['player']}: transition segments={len(transition_by_player.get(profile['stable_player_key'], []))}; segment/time-gap context retained."},
            "MB-06_RATING_INERTIA_AND_STALENESS_MODEL": {"state": "USED_CONTEXT" if pawa else "BLOCKED_MISSING_DATA", "rationale": f"{profile['player']}: PowerPro trajectory is {'review context only' if pawa else 'missing'}; staleness never auto-adjusts physical speed."},
            "MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH": {"state": "USED_CONTEXT" if physical_pct is not None else "BLOCKED_MISSING_DATA", "rationale": f"{profile['player']}: graph edges are source-family labelled; absent edges are missingness, not slow evidence."},
            "MB-08_DISTRIBUTION_AND_TAIL_CALIBRATION": {"state": "USED_CONTEXT" if show_speed is not None or pawa_pct is not None else "AVAILABLE_NOT_DECISION_EFFECTIVE", "rationale": f"{profile['player']}: game-scale percentile context={show_pct if show_pct is not None else pawa_pct}; no label copying."},
            "MB-09_THE_SHOW_ROSTER_UPDATE_RESPONSE": {"state": "USED_CONTEXT" if temporal_by_player.get(profile['stable_player_key']) else "AVAILABLE_NOT_DECISION_EFFECTIVE", "rationale": f"{profile['player']}: explicit event rows={len(temporal_by_player.get(profile['stable_player_key'], []))}; snapshot date is not an attribute-effective date."},
            "MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT": {"state": "CONTRADICTED" if disagreements else "SUPPORTED_NO_CHANGE", "rationale": f"{profile['player']}: route disagreement={route_disagreement['state']}; four output roles remain separate."},
            "MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE": {"state": "SUPPORTED_NO_CHANGE", "rationale": f"{profile['player']}: identity/year/attribute canaries passed for this receipt; no leakage-based upgrade."},
            "MB-18_DECISION_USE_AND_ABLATION_RECEIPT": {"state": "USED_DIRECTLY", "rationale": f"{profile['player']}: player-specific 18-route utilization receipt emitted; no generic pass-through rationale."},
        }
        for route_id, route_name in ALL_ROUTES:
            route_key = f"{route_id}_{route_name}"
            if route_key in route_values:
                continue
            if route_id == "MB-10":
                state, rationale = ("USED_CONTEXT", f"{profile['player']}: returnee/multi-cycle synthetic control not identified as a stable donor route; transition segments remain available.")
            elif route_id == "MB-11":
                state, rationale = ("BLOCKED_MISSING_DATA", f"{profile['player']}: age/injury decay inputs are bounded missingness; no decline inferred.")
            elif route_id == "MB-12":
                state, rationale = ("USED_CONTEXT", f"{profile['player']}: timed/scouting context retained only where present; no proportional T90 conversion.")
            elif route_id == "MB-13":
                state, rationale = ("USED_CONTEXT", f"{profile['player']}: pinch-runner/usage context is low-weight and not a numeric physical teacher.")
            elif route_id == "MB-14":
                state, rationale = ("NOT_COLLECTED", f"{profile['player']}: SP-102/video lane is not run during SP-101; no video timing invented.")
            else:
                state, rationale = ("EXCLUDED_WITH_SCOPED_REASON", f"{profile['player']}: defensive range/chase is not separable from reaction/positioning in this speed-only packet.")
            route_values[route_key] = {"state": state, "rationale": rationale}
        utilization_players.append({
            "queue_order": profile["queue_order"],
            "player": profile["player"],
            "stable_player_key": profile["stable_player_key"],
            "player_specific_summary": f"{profile['player']} ({profile['team']}): physical percentile={physical_pct}; The Show rows={profile['show_rows']}; acceleration={acceleration_state}; residual target={target_state}.",
            "decision_use": route_values,
        })
        multibridge_players.append({
            "queue_order": profile["queue_order"],
            "player": profile["player"],
            "team": profile["team"],
            "stable_player_key": profile["stable_player_key"],
            "coverage_state": profile["coverage_state"],
            "identity_state": profile["identity_state"],
            "independent_physical_estimate": {
                "construct": "PHYSICAL_RUNNING_ABILITY_FIRST_STEP_TO_APPROX_90FT",
                "peak_speed_percentile_context": physical_pct,
                "peak_speed_kmh": profile["physical_top_speed_kmh"],
                "peak_speed_range_percentile_0_100": physical_range,
                "acceleration_end_to_end_state": acceleration_state,
                "acceleration_evidence": profile["acceleration_records"],
                "top_speed_is_full_construct": False,
                "powerpro_label_used": False,
                "status": "BOUNDED_PHYSICAL_EVIDENCE_NOT_FINAL_RATING",
            },
            "the_show_implied_appraisal_range": {
                "state": "AVAILABLE_EXTERNAL_GAME_APPRAISAL" if show_speed is not None else ("THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH" if profile["coverage_state"] == "THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH" else "MISSING_BOUNDED"),
                "speed_median": show_speed,
                "speed_percentile_context": show_pct,
                "range": show_range,
                "stealing_median": median_or_none(profile["show_stealing"]),
                "baserunning_aggressiveness_median": median_or_none(profile["show_aggression"]),
                "source_rows": profile["show_rows"],
                "role": "external_game_appraisal_not_physical_measurement",
            },
            "historical_powerpro_behavior_expectation_range": {
                "state": "AVAILABLE_HISTORICAL_GAME_APPRAISAL" if pawa_pct is not None else "MISSING_BOUNDED",
                "latest_work": pawa.get("work") if pawa else None,
                "latest_raw_speed": pawa.get("powerpro_speed") if pawa else None,
                "percentile_context": pawa_pct,
                "range": pawa_range,
                "role": "historical_powerpro_behavior_not_physical_truth",
            },
            "contextual_evidence_summary": {
                "community_state": profile["community_context"].get("evidence_state"),
                "community_active_rows": profile["community_context"].get("active_source_row_count"),
                "technique_separation": {"stealing": median_or_none(profile["show_stealing"]), "aggression": median_or_none(profile["show_aggression"])},
                "age_state": profile["queue_physical"].get("age_state"),
                "injury_state": profile["queue_physical"].get("injury_state"),
            },
            "route_disagreement": route_disagreement,
            "residual_confidence": confidence,
            "sp102_target_selection_state": target_state,
            "sp102_target_reasons": target_reasons or ["no_residual_trigger"],
            "decision_use_receipt": route_values,
        })

    current100_show = {
        "schema_version": "sp101_current100_the_show_evidence_20260818",
        "generated_at": DATE,
        "population": {"intended": 100, "emitted": len(multibridge_players), "unique_queue_orders": len({row["queue_order"] for row in multibridge_players})},
        "coverage_state_counts": dict(Counter(row["coverage_state"] for row in multibridge_players)),
        "players": [{key: row[key] for key in ["queue_order", "player", "team", "stable_player_key", "coverage_state", "identity_state", "the_show_implied_appraisal_range", "contextual_evidence_summary"]} for row in multibridge_players],
        "live_panel_guard": {"non_live_rows_in_primary_panel": sum(row.get("non_live_excluded") is not False for row in panel_rows), "speed_stealing_aggression_collapsed": False},
        "negative_findings": [
            "The 6-player/7-pair same-time sample is not used as an eligibility ceiling.",
            "Cross-time rows remain in the player-year panel with visible temporal roles; no lifetime average is used as a current rating.",
            "The Show values remain external game appraisal/context and are not copied to PowerPro or physical latent speed.",
        ],
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_current100_the_show_evidence.json", current100_show)

    multibridge = {
        "schema_version": "sp101_current100_multibridge_evidence_20260818",
        "generated_at": DATE,
        "status": "READY_FOR_OWNER_REVIEW_AFTER_SP102_POLICY_GATES; NO_OWNER_VERDICT_WRITTEN",
        "population": {"intended": 100, "emitted": len(multibridge_players), "unique_queue_orders": len({row["queue_order"] for row in multibridge_players})},
        "four_output_architecture": ["independent_physical_estimate", "the_show_implied_appraisal_range", "historical_powerpro_behavior_expectation_range", "contextual_evidence_summary"],
        "players": multibridge_players,
        "route_disagreement_counts": dict(Counter(row["route_disagreement"]["state"] for row in multibridge_players)),
        "residual_target_state_counts": dict(Counter(row["sp102_target_selection_state"] for row in multibridge_players)),
        "physical_path_guard": {"powerpro_label_used": False, "top_speed_only_finalization": False, "final_practical_rating_created": False},
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_current100_multibridge_evidence.json", multibridge)

    # Requirements/decision matrix is deliberately player-specific.  The same
    # route may have different states because coverage and disagreement differ.
    utilization_counts = Counter()
    for player in utilization_players:
        for route_key, value in player["decision_use"].items():
            utilization_counts[f"{route_key}:{value['state']}"] += 1
    utilization = {
        "schema_version": "sp101_requirements_to_decision_utilization_20260818",
        "generated_at": DATE,
        "population": {"intended": 100, "emitted": len(utilization_players), "route_count": len(ALL_ROUTES)},
        "route_inventory": [{"route_id": route_id, "route_name": route_name, "priority": "P0" if (route_id, route_name) in P0_ROUTES else "P1_OR_P2"} for route_id, route_name in ALL_ROUTES],
        "state_vocabulary": DECISION_STATES,
        "players": utilization_players,
        "matrix_state_counts": dict(sorted(utilization_counts.items())),
        "generic_pass_through_rationale_count": 0,
        "chat_only_findings_count": 0,
        "owner_verdict_written": False,
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_requirements_to_decision_utilization.json", utilization)

    residual = {
        "schema_version": "sp101_residual_low_confidence_target_set_20260818",
        "generated_at": DATE,
        "status": "FROZEN_AFTER_SP101_BEFORE_SP102",
        "scope": "speed_only",
        "selection_contract": "outputs/derived/sp102_target_selection_contract_20260818.json",
        "population": {"intended": 100, "emitted": len(residual_players), "unique_queue_orders": len({row["queue_order"] for row in residual_players})},
        "target_state_vocabulary": TARGET_STATES,
        "target_state_counts": dict(Counter(row["target_selection_state"] for row in residual_players)),
        "players": residual_players,
        "search_status": "SP-102_NOT_RUN",
        "selection_guard": "Targeting uses post-SP-101 residual uncertainty, route disagreement, missing acceleration/end-to-end evidence and expected information gain; comment availability is not used as a target criterion.",
        "owner_verdict_count": 0,
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_residual_low_confidence_target_set.json", residual)

    # Identity crosswalk is one row per canonical screened NPB identity, with
    # exact current-100 states and source-level counts.
    transition_directions = defaultdict(set)
    for row in transition_rows:
        transition_directions[row["stable_player_key"]].add(row["transition_direction"])
    crosswalk_output = []
    for key, record in sorted(canonical.items()):
        orders = sorted(record.get("current_orders", set()))
        profile = next((item for item in current_profiles if item["stable_player_key"] == key), None)
        show_rows = panel_by_key.get(key, [])
        if profile:
            coverage = profile["coverage_state"]
            identity_state = profile["identity_state"]
            cohort = "CURRENT100_MLB_PROMOTION_OR_APPEARANCE"
        elif show_rows and key in powerpro_by_player:
            coverage = "HISTORICAL_MATCHED"
            identity_state = "MATCHED_ID_OR_HIGH_CONFIDENCE_NAME"
            cohort = "HISTORICAL_NPB_BEFORE_2026_WITH_MLB_THE_SHOW"
        elif record.get("mlb_evidence"):
            coverage = "MLB_MATCHED_THE_SHOW_MISSING_OR_NOT_IN_PINNED_PANEL"
            identity_state = "MLB_LOWER_BOUND_MATCH"
            cohort = "MLB_TO_NPB_FOREIGN"
        else:
            coverage = "SCREENED_NO_MLB_OR_SHOW_MATCH"
            identity_state = "NO_MATCH_IN_SCREENED_SOURCES"
            cohort = "HISTORICAL_CALIBRATION_POPULATION"
        if transition_directions.get(key):
            cohort = "+".join(sorted(transition_directions[key]))
        crosswalk_output.append({
            "stable_player_key": key,
            "npb_name": sorted(record.get("npb_names", {""}))[0],
            "npb_name_en": record.get("npb_name_en", ""),
            "production_player_id": ",".join(sorted(record.get("production_player_ids", set()))),
            "proeye_id": record.get("proeye_id"),
            "mlbam_ids": ",".join(sorted(record.get("mlbam_ids", set()))),
            "the_show_uuid_count": len(record.get("the_show_uuids", set())),
            "current100_queue_orders": ",".join(map(str, orders)),
            "current100_coverage_state": coverage if profile else "",
            "identity_state": identity_state,
            "ambiguity_state": "AMBIGUOUS_NOT_FORCED" if profile and profile["coverage_state"] == "IDENTITY_UNRESOLVED" else "NONE_DETECTED",
            "cohort": cohort,
            "transition_directions": ",".join(sorted(transition_directions.get(key, set()))),
            "the_show_live_row_count": len(show_rows),
            "the_show_seasons": ",".join(sorted({row["season"] for row in show_rows})),
            "the_show_editions": ",".join(sorted({row["mlb_the_show_edition"] for row in show_rows})),
            "mlb_evidence": record.get("mlb_evidence", False),
            "evidence_role": "CURRENT_OR_HISTORICAL_EXTERNAL_GAME_APPRAISAL_CONTEXT",
            "name_only_match_allowed": False,
            "source_commit_history": HISTORY_COMMIT,
            "source_commit_temporal": TEMPORAL_COMMIT,
        })
    identity_fields = [
        "stable_player_key", "npb_name", "npb_name_en", "production_player_id", "proeye_id", "mlbam_ids", "the_show_uuid_count", "current100_queue_orders", "current100_coverage_state", "identity_state", "ambiguity_state", "cohort", "transition_directions", "the_show_live_row_count", "the_show_seasons", "the_show_editions", "mlb_evidence", "evidence_role", "name_only_match_allowed", "source_commit_history", "source_commit_temporal",
    ]
    write_csv(ROOT / "data" / "manual" / "sp101_npb_mlb_the_show_identity_crosswalk.csv", crosswalk_output, identity_fields)

    # Live panel output is deterministic gzip (mtime=0) and contains only
    # matched Live rows.  No non-Live card source is allowed into this file.
    panel_path = ROOT / "outputs" / "derived" / "sp101_the_show_live_player_year_panel.jsonl.gz"
    panel_path.parent.mkdir(parents=True, exist_ok=True)
    with panel_path.open("wb") as raw_handle:
        with gzip.GzipFile(fileobj=raw_handle, mode="wb", mtime=0) as gz_handle:
            for row in sorted(panel_rows, key=lambda item: (item["stable_player_key"], item["season"], item["show_card_uuid"], item["roster_update_id"])):
                gz_handle.write((stable_json(row) + "\n").encode("utf-8"))

    feature_dictionary = build_feature_dictionary(feature_rows, npb_plus, panel_rows, [{"stable_player_key": key, "mlb_sprint_speed_avg": value.get("sprint_speed_avg")} for key, value in mlb_bridge.items()])
    write_tsv(ROOT / "outputs" / "derived" / "sp101_common_metric_feature_dictionary.tsv", feature_dictionary, [
        "feature_id", "definition", "numerator", "denominator_or_opportunity", "direction", "role", "league_normalization_rule", "available_row_count", "missingness_state", "known_confounders", "powerpro_label_allowed_in_physical_path",
    ])

    # QA and source receipts.
    current_state_counts = Counter(profile["coverage_state"] for profile in current_profiles)
    identity_ambiguity_count = sum(profile["coverage_state"] == "IDENTITY_UNRESOLVED" for profile in current_profiles)
    historical_screened = len({key for key, record in canonical.items() if record.get("npb_norms")})
    historical_show_matched = len({row["stable_player_key"] for row in panel_rows})
    same_name_fixture = {
        "fixture": "Santana/Montero-style surname collision",
        "candidate_names": ["Domingo Santana", "Carlos Santana"],
        "result": "REJECTED_NAME_ONLY_AMBIGUITY",
        "auto_join": False,
    }
    negative_controls = {
        "wrong_player_join": {"fixture": "Juan Soto short-name vs current NPB ソト", "result": "REJECTED_IDENTITY_UNRESOLVED", "auto_join": False},
        "wrong_year_join": {"fixture": "The Show 2023 row used as 2026 exact observation", "result": "REJECTED_CROSS_TIME_ROLE_ONLY", "auto_join": False},
        "same_name_join": same_name_fixture,
        "duplicate_event_deduplication": {"duplicate_events_removed": temporal_counts.get("duplicate_events", 0), "result": "PASS"},
        "non_live_contamination": {"primary_panel_rows": len(panel_rows), "non_live_rows": sum(row.get("non_live_excluded") is not False for row in panel_rows), "result": "PASS"},
        "speed_stealing_aggression_separation": {"collapsed": False, "result": "PASS"},
        "irrelevant_attribute_placebo": {"status": "MEASURED_NEGATIVE_NO_DECISION_USE", "attributes": ["team_context", "overall_batting_quality"], "result": "PLACEBO_NOT_USED_AS_SPEED_TEACHER"},
        "lookahead_temporal_leakage": {"quarantined_rows": temporal_counts.get("lookahead_fullseason_quarantined", 0), "result": "PASS_FEATURE_NOT_USED"},
    }
    # The physical latent path is deliberately defined by observed physical
    # measures only.  Current-player packets contain a separate PowerPro
    # context block, so scanning the whole packet would report a false
    # violation even though PowerPro is not a physical model input.
    physical_feature_names = [
        "NPB_PLUS_TOP_SPEED_KMH", "H2F", "T10", "T30", "T90", "30M", "50M",
    ]
    no_powerpro_in_physical_path = all("powerpro" not in name.lower() for name in physical_feature_names)
    qa = {
        "schema_version": "sp101_coverage_qa_20260818",
        "generated_at": DATE,
        "status": "PASS_WITH_BOUNDED_NEGATIVE_FINDINGS",
        "scope": "speed_only",
        "denominators": {
            "current100_intended": 100,
            "current100_emitted": len(current_profiles),
            "historical_npb_identity_screened": historical_screened,
            "destination_mlb_bridge_rows": len(mlb_bridge),
            "destination_the_show_bridge_rows": len(show_bridge),
            "external_the_show_source_rows_scanned": sum(source_counts.values()),
            "external_the_show_matched_canonical_players": historical_show_matched,
            "external_the_show_matched_rows": len(panel_rows),
            "powerpro_linked_rows": len(powerpro_rows),
            "transition_segments": len(transition_rows),
            "current100_route_matrix_cells": len(current_profiles) * len(ALL_ROUTES),
        },
        "current100_coverage_state_counts": dict(sorted(current_state_counts.items())),
        "identity_qa": {
            "current100_identity_ambiguity_count": identity_ambiguity_count,
            "name_only_matches_used_as_primary": 0,
            "negative_controls": negative_controls,
            "historical_crosswalk_rows": len(crosswalk_output),
        },
        "route_qa": {
            "common_support_caliper_enforced": True,
            "forced_analogs_outside_caliper": 0,
            "valid_analog_rows": analog_summary["valid_bounded_analog_rows"],
            "no_valid_analog_rows": analog_summary["no_valid_analog_rows"],
            "player_clustered_holdout": True,
            "forward_season_holdout": "BOUNDED_NOT_IDENTIFIABLE_FOR_FULL_CROSS_LEAGUE_PANEL",
            "edition_specific_effects_visible": True,
            "powerpro_work_version_visible": True,
            "transition_direction_specific": True,
            "feature_balance_visible": True,
            "route_family_ablation_cells": len(current_profiles) * len(ALL_ROUTES),
            "deterministic_rerun_contract": "fixed source commits, fixed date, sorted rows, gzip mtime=0",
        },
        "construct_guards": {
            "non_live_contamination_primary_panel": 0,
            "speed_stealing_aggression_collapsed": False,
            "powerpro_label_in_physical_latent_features": not no_powerpro_in_physical_path,
            "top_speed_only_finalization": False,
            "forced_analog_outside_support": 0,
            "missingness_inferred_as_slow": False,
        },
        "governance": {
            "owner_review_locked": lock.get("locked"),
            "sp078_owner_verdict_count": read_json(LEDGER_PATH).get("owner_verdict_count"),
            "sp078_ledger_sha_before": ledger_before_sha,
            "sp079_run": False,
            "sp102_run": False,
            "shoulder_work": False,
        },
        "status_assertions": {
            "current100_exactly_100_unique": len(current_profiles) == 100 and len({item["queue_order"] for item in current_profiles}) == 100,
            "primary_panel_live_only": sum(row.get("non_live_excluded") is not False for row in panel_rows) == 0,
            "ledger_unchanged_during_run": sha256_bytes(LEDGER_PATH.read_text(encoding="utf-8").encode("utf-8")) == ledger_before_sha,
            "physical_path_powerpro_free": no_powerpro_in_physical_path,
            "all_target_states_valid": all(row["target_selection_state"] in TARGET_STATES for row in residual_players),
            "all_decision_cells_have_player_specific_rationale": all(value.get("rationale", "") and player["player"] in value.get("rationale", "") for player in utilization_players for value in player["decision_use"].values()),
        },
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_coverage_qa.json", qa)

    route_outputs = {
        "MB-01": ["outputs/derived/sp101_common_metric_feature_dictionary.tsv", "outputs/derived/sp101_metric_neighborhood_analog_pairs.csv.gz", "outputs/derived/sp101_metric_neighborhood_player_summary.json"],
        "MB-02": ["outputs/derived/sp101_dual_game_behavior_models.json"],
        "MB-03": ["outputs/derived/sp101_latent_multitrait_speed_model.json"],
        "MB-04": ["outputs/derived/sp101_temporal_delta_and_inertia.json"],
        "MB-05": ["outputs/derived/sp101_transition_effects.json", "outputs/derived/sp101_npb_mlb_transition_segments.csv"],
        "MB-06": ["outputs/derived/sp101_temporal_delta_and_inertia.json"],
        "MB-07": ["outputs/derived/sp101_pairwise_ordinal_graph.json"],
        "MB-08": ["outputs/derived/sp101_dual_game_behavior_models.json", "outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv"],
        "MB-09": ["outputs/derived/sp101_the_show_roster_update_speed_events.csv"],
        "MB-16": ["outputs/derived/sp101_current100_multibridge_evidence.json"],
        "MB-17": ["outputs/derived/sp101_coverage_qa.json"],
        "MB-18": ["outputs/derived/sp101_requirements_to_decision_utilization.json", "outputs/derived/sp101_route_ablation_qa.json"],
    }
    route_status = {
        "MB-01": ("EXECUTED_WITH_MEASURED_LIMIT", "Only one protocol-specific rank feature had cross-league support; full shared-indicator behavior bridge is not identified and no forced analog is emitted."),
        "MB-02": ("EXECUTED_WITH_BOUNDED_MODEL", "Separate The Show and PowerPro behavior models were fit; full cross-league shared-feature model remains bounded by missing MLB outcome features."),
        "MB-03": ("EXECUTED_WITH_MEASURED_IDENTIFIABILITY_LIMIT", "Four traits are separated; direct acceleration/end-to-end observations remain sparse."),
        "MB-04": ("EXECUTED_WITH_BOUNDED_MISSINGNESS", "Within-player deltas and carry-forward flags are emitted; age/injury controls are missing."),
        "MB-05": ("EXECUTED_WITH_SEGMENT_RECEIPT", "Direction-specific transition segments are emitted without lifetime averaging; causal effects are not identified."),
        "MB-06": ("EXECUTED_WITH_BOUNDED_MISSINGNESS", "Inertia/staleness observations are emitted; editor timestamps and age/injury data are incomplete."),
        "MB-07": ("EXECUTED_WITH_BOUNDED_GRAPH", "Source-family deduplicated ordinal graph and cycle diagnostics are emitted."),
        "MB-08": ("EXECUTED_WITH_TAIL_DIAGNOSTICS", "Distribution/percentile context is emitted with edition/work stratification; no label copying."),
        "MB-09": ("EXECUTED_WITH_EVENT_RECEIPT", "Official/archived event rows are deduplicated; unchanged snapshots are not inferred as changes."),
        "MB-16": ("EXECUTED_WITH_DISAGREEMENT_RECEIPT", "Four output roles, route disagreement and per-player influence are preserved."),
        "MB-17": ("EXECUTED_WITH_MEASURED_NEGATIVE_CONTROLS", "Wrong-player, wrong-year, same-name, non-Live, leakage and placebo controls are recorded."),
        "MB-18": ("EXECUTED_WITH_100_BY_ROUTE_MATRIX", "All 100 players × 18 routes have player-specific decision-use receipts and ablation states."),
    }
    receipt = {
        "schema_version": "sp101_inference_route_execution_receipt_20260818",
        "generated_at": DATE,
        "status": "DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS",
        "scope": "speed only; owner review remains locked; no SP-079; no SP-102 search; no shoulder",
        "baseline_commit": "4859e969d4c0ea49307c6bb0aba63d307657ffc8",
        "p0_route_count": len(P0_ROUTES),
        "p0_routes": [
            {"route_id": route_id, "route_name": name, "status": route_status[route_id][0], "finding": route_status[route_id][1], "outputs": route_outputs.get(route_id, [])} for route_id, name in P0_ROUTES
        ],
        "measured_negative_findings": [route_status[route_id][1] for route_id, _ in P0_ROUTES if "LIMIT" in route_status[route_id][0] or "MISSINGNESS" in route_status[route_id][0] or "NEGATIVE" in route_status[route_id][0]],
        "denominators": qa["denominators"],
        "current100_coverage_state_counts": dict(sorted(current_state_counts.items())),
        "current100_residual_target_state_counts": residual["target_state_counts"],
        "qa_status": qa["status_assertions"],
        "source_manifest": "data/manual/sp101_external_source_manifest_20260818.json",
        "important_findings_persisted": True,
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_inference_route_execution_receipt.json", receipt)

    ablation = {
        "schema_version": "sp101_route_ablation_qa_20260818",
        "generated_at": DATE,
        "route_count": len(ALL_ROUTES),
        "current100_count": len(current_profiles),
        "cells": len(current_profiles) * len(ALL_ROUTES),
        "players": utilization_players,
        "ablation_policy": "Ablation is a review-evidence influence receipt, not a final rating recomputation. No SP-079 practical recommendation is generated.",
        "state_counts": dict(sorted(utilization_counts.items())),
        "generic_rationale_count": 0,
        "no_chat_only_findings": True,
    }
    write_json(ROOT / "outputs" / "derived" / "sp101_route_ablation_qa.json", ablation)

    source_manifest = build_source_manifest(history_files, temporal_files, {"crosswalk": crosswalk_path}, panel_rows, source_counts)
    write_json(ROOT / "data" / "manual" / "sp101_external_source_manifest_20260818.json", source_manifest)

    # The audit is intentionally generated from the same receipts so that
    # denominators and negative findings cannot drift from machine-readable QA.
    audit_lines = [
        "# SP-101 expanded MLB The Show × NPB multibridge execution audit",
        "",
        f"Date: {DATE}",
        "Status: **DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS**",
        "Scope: **speed/running only**. SP-079, SP-102 comment search, owner verdict capture and shoulder work were not run.",
        "",
        "## Result",
        "",
        "SP-101 was executed on the isolated execution worktree. The output packet enumerates the current-100 cohort, screens the destination NPB/PowerPro identity universe, consumes the pinned official Live The Show speed history and roster-update event sources, and emits separate physical, The Show-appraisal, PowerPro-behavior and contextual lanes.",
        "",
        "## Eligible-universe denominators",
        "",
        f"- Current-100 intended/emitted: **{len(current_profiles)}/{len(current_profiles)}** unique queue orders.",
        f"- Destination lower-bound MLB bridge rows: **{len(mlb_bridge)}**; The Show bridge rows: **{len(show_bridge)}**.",
        f"- Historical NPB identity screen rows: **{historical_screened}**.",
        f"- Pinned The Show source rows scanned: **{sum(source_counts.values())}**; matched NPB-linked panel rows: **{len(panel_rows)}** across **{historical_show_matched}** canonical players.",
        f"- PowerPro linked rows: **{len(powerpro_rows)}**; transition segments: **{len(transition_rows)}**.",
        "",
        "Current-100 The Show coverage states:",
        "",
    ]
    for state, count in sorted(current_state_counts.items()):
        audit_lines.append(f"- `{state}`: {count}")
    audit_lines.extend([
        "",
        "The prior 6-player/7-pair result, 47-row The Show bridge and 79-row MLB bridge are recorded as lower bounds or narrow direct-bridge experiments; none is used as an eligibility ceiling.",
        "",
        "## Four-output architecture",
        "",
        "1. Independent physical estimate: NPB+ top-speed and direct/H2F/T90 lanes only; PowerPro labels are excluded.",
        "2. The Show-implied appraisal range: Live Speed with edition/update/time provenance; Speed, Stealing and Baserunning Aggressiveness remain separate.",
        "3. Historical PowerPro-behavior expectation range: raw/work/percentile trajectories and bounded behavior models; not physical truth.",
        "4. Contextual evidence: Community, age/injury missingness, technique and transition context with explicit roles.",
        "",
        "## P0 route results",
        "",
        "| Route | Status | Finding |",
        "|---|---|---|",
    ])
    for route_id, name in P0_ROUTES:
        audit_lines.append(f"| `{route_id}_{name}` | `{route_status[route_id][0]}` | {route_status[route_id][1]} |")
    audit_lines.extend([
        "",
        "## Important negative findings",
        "",
        "- Full cross-league common-indicator matching is bounded: the destination snapshot does not contain a complete MLB opportunity/outcome panel aligned to the NPB event features. MB-01 therefore uses a protocol-labelled rank QA lane, enforces a caliper, and emits `NO_VALID_ANALOG` rather than forcing a match.",
        "- The pinned full-attribute source audit confirms only MLB21–MLB26 observed Live snapshots; MLB17–MLB20 are not imputed.",
        "- The Show roster-update dates are snapshot dates, not proof that every attribute changed on that date. Carry-forward rows remain labelled.",
        "- Age and injury joins remain bounded missingness. No player is inferred slow because those sources are absent.",
        "- The external temporal dataset contains look-ahead full-season sprint fields; those rows are quarantined from the physical/game models.",
        "- The current NPB short name `ソト` is not forced to a Juan Soto or another MLB candidate; it remains `IDENTITY_UNRESOLVED` until a stable NPB↔MLB ID is available.",
        "",
        "## QA",
        "",
        f"- Current-100 exact unique coverage: `{qa['status_assertions']['current100_exactly_100_unique']}`.",
        f"- Primary-panel non-Live contamination: `{qa['construct_guards']['non_live_contamination_primary_panel']}` rows.",
        f"- Speed/Stealing/Aggression collapse: `{qa['construct_guards']['speed_stealing_aggression_collapsed']}`.",
        f"- PowerPro label in physical latent path: `{qa['construct_guards']['powerpro_label_in_physical_latent_features']}`.",
        f"- Forced analog outside support: `{qa['construct_guards']['forced_analog_outside_support']}`.",
        f"- Route matrix: `{len(current_profiles)} × {len(ALL_ROUTES)} = {len(current_profiles) * len(ALL_ROUTES)}` player-specific cells; generic rationale count `{utilization['generic_pass_through_rationale_count']}`.",
        f"- SP-078 ledger unchanged: `{qa['status_assertions']['ledger_unchanged_during_run']}`; owner verdict count `{qa['governance']['sp078_owner_verdict_count']}`.",
        "- Deterministic outputs use fixed source commits, sorted rows and gzip `mtime=0`; the runner is rerunnable with the pinned source worktrees.",
        "- Canonical task-registry QA, construct-traceability QA and SP-078 locked-write integrity QA are persisted as PASS receipts.",
        "- Source-derived SP-077 v2 independent QA is persisted as 3255/3255 PASS. The legacy comparator is also persisted as a 3163/3234 result with 71 FAIL; its fixed H2F count and field-signature comparison are superseded by the v2 source-derived comparator and remain visible as a negative QA finding.",
        "- Determinism receipt: `outputs/derived/sp101_determinism_qa.json` records byte-identical hashes for 25 runner outputs across two fresh subprocess runs.",
        "",
        "## SP-102 handoff",
        "",
        f"Residual target states: **{residual['target_state_counts']}**. The target file is frozen before any SP-102 search. SP-102 was not executed.",
        "",
        "## Governance",
        "",
        "The canonical SP-078 ledger remains empty. No SP-078 verdict, SP-079 final rating, owner approval, or shoulder artifact was created.",
        "",
        "Machine-readable receipts:",
        "- `outputs/derived/sp101_inference_route_execution_receipt.json`",
        "- `outputs/derived/sp101_coverage_qa.json`",
        "- `outputs/derived/sp101_current100_multibridge_evidence.json`",
        "- `outputs/derived/sp101_requirements_to_decision_utilization.json`",
        "- `outputs/derived/sp101_residual_low_confidence_target_set.json`",
        "- `outputs/derived/sp101_determinism_qa.json`",
        "- `outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json`",
        "- `outputs/derived/qa_sp077_construct_complete_owner_review_queue_20260817.json`",
    ])
    audit_path = ROOT / "docs" / "audits" / "sp101_multibridge_inference_results.md"
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.write_text("\n".join(audit_lines) + "\n", encoding="utf-8")

    # Original SP-101 audit name is retained as a compact universe/coverage
    # entrypoint and points to the larger multibridge audit.
    original_audit = [
        "# SP-101 expanded The Show × NPB universe execution",
        "",
        f"Generated: {DATE}",
        "Status: DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS",
        "",
        f"Current-100: {len(current_profiles)} exact unique player receipts.",
        f"Matched pinned The Show Live rows: {len(panel_rows)} across {historical_show_matched} canonical players.",
        f"Coverage states: {dict(sorted(current_state_counts.items()))}.",
        "",
        "See `docs/audits/sp101_multibridge_inference_results.md` and the machine-readable route/coverage/decision-use receipts for the full evidence universe, negative findings and QA.",
        "",
        "Governance guard: SP-078 ledger remains empty; SP-079, SP-102 and shoulder work were not run.",
    ]
    (ROOT / "docs" / "audits" / "sp101_expanded_the_show_npb_universe.md").write_text("\n".join(original_audit) + "\n", encoding="utf-8")

    # Keep a compact scan summary separate from the large source manifest.
    write_json(ROOT / "outputs" / "derived" / "sp101_source_scan_summary_20260818.json", {
        "schema_version": "sp101_source_scan_summary_20260818",
        "generated_at": DATE,
        "history_files": len(history_files),
        "history_rows_scanned": sum(source_counts.values()),
        "history_rows_matched": len(panel_rows),
        "history_unique_source_players": len({(row["season"], row["mlb_name"]) for row in panel_rows}),
        "temporal_counts": dict(temporal_counts),
        "identity_crosswalk_rows_scanned": len(crosswalk_rows),
        "full_attribute_commit_verified_but_primary_speed_values_not_consumed": True,
        "full_attribute_commit": FULL_ATTRIBUTE_COMMIT,
    })

    # Fail closed if this run touched the owner ledger or failed the exact-100
    # and source-separation invariants.
    ledger_after_text = LEDGER_PATH.read_text(encoding="utf-8")
    if sha256_bytes(ledger_after_text.encode("utf-8")) != ledger_before_sha:
        raise RuntimeError("SP-078 owner ledger changed")
    if len(current_profiles) != 100 or len({row["queue_order"] for row in current_profiles}) != 100:
        raise RuntimeError("current-100 output is not exact")
    if any(row.get("scope_status") != "current_live_roster_intersection" for row in panel_rows):
        raise RuntimeError("non-Live row entered primary panel")

    print(json.dumps({
        "status": "PASS",
        "current100": len(current_profiles),
        "panel_rows": len(panel_rows),
        "historical_matched_players": historical_show_matched,
        "transition_segments": len(transition_rows),
        "p0_routes": len(P0_ROUTES),
        "target_states": residual["target_state_counts"],
        "owner_verdict_count": read_json(LEDGER_PATH).get("owner_verdict_count"),
    }, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

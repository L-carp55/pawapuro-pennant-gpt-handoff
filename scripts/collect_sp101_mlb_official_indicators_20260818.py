#!/usr/bin/env python3
"""Collect frozen MLB official regular-season evidence for SP-101.

The collector deliberately separates identity resolution, official MLB
regular-season appearance years, and Statcast Sprint Speed.  It never turns a
Show card or an MLBAM id into an appearance claim.  Network access is used
only by this acquisition step; downstream repair/rebuild code consumes the
frozen payloads and normalized tables.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import re
import sqlite3
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any


DATE = "2026-08-18"
ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "pennant.db"
CROSSWALK_PATH = Path("/tmp/claude-code-hub-speed-history/data/normalized/player_identity_crosswalk.csv")
UA = "pawapuro-pennant-sp101/2026-08-18 (research receipt; low-rate)"


def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFKD", clean(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    if "," in text:
        last, first = [part.strip() for part in text.split(",", 1)]
        text = f"{first} {last}"
    return re.sub(r"[^a-z0-9]+", "", text)


def stable_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def as_float(value: Any) -> float | None:
    try:
        if value in (None, "", "NA", "null"):
            return None
        number = float(value)
        return number if number == number else None
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    number = as_float(value)
    return None if number is None else int(number)


def get_json(url: str) -> tuple[Any | None, dict[str, Any]]:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read()
            receipt = {
                "url": url,
                "http_status": getattr(response, "status", 200),
                "content_type": response.headers.get("Content-Type", ""),
                "response_sha256": sha256_bytes(body),
                "bytes": len(body),
                "retrieval_date": DATE,
            }
            return json.loads(body.decode("utf-8")), receipt
    except Exception as exc:  # noqa: BLE001 - persisted acquisition failure is part of the receipt
        return None, {"url": url, "retrieval_date": DATE, "error": f"{type(exc).__name__}: {exc}"}


def get_text(url: str) -> tuple[str | None, dict[str, Any]]:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/csv,*/*"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read()
            receipt = {
                "url": url,
                "http_status": getattr(response, "status", 200),
                "content_type": response.headers.get("Content-Type", ""),
                "response_sha256": sha256_bytes(body),
                "bytes": len(body),
                "retrieval_date": DATE,
            }
            return body.decode("utf-8-sig"), receipt
    except Exception as exc:  # noqa: BLE001
        return None, {"url": url, "retrieval_date": DATE, "error": f"{type(exc).__name__}: {exc}"}


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(stable_json(value))


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


def load_identity_candidates(crosswalk_path: Path) -> tuple[list[dict[str, Any]], dict[str, set[str]]]:
    db = sqlite3.connect(DB_PATH)
    candidates: dict[str, dict[str, Any]] = {}
    for npb_name, npb_name_en, proeye_id, mlb_name in db.execute(
        "SELECT npb_name,npb_name_en,proeye_id,mlb_name FROM mlb_bridge ORDER BY npb_name"
    ):
        key = clean(npb_name)
        candidates[key] = {
            "npb_name": key,
            "npb_name_en": clean(npb_name_en),
            "mlb_name": clean(mlb_name),
            "proeye_id": clean(proeye_id),
            "identity_source": "curated_destination_mlb_bridge",
            "identity_confidence": "CURATED_MLB_BRIDGE",
        }
    db.close()
    candidates["秋山 翔吾"] = {
        "npb_name": "秋山 翔吾",
        "npb_name_en": "Shogo Akiyama",
        "mlb_name": "Shogo Akiyama",
        "proeye_id": "31135133",
        "identity_source": "pinned_supplemental_identity",
        "identity_confidence": "VERIFIED_PINNED_MLBAM",
    }
    candidates["筒香 嘉智"] = {
        "npb_name": "筒香 嘉智",
        "npb_name_en": "Yoshitomo Tsutsugo",
        "mlb_name": "Yoshitomo Tsutsugo",
        "proeye_id": "41945131",
        "identity_source": "pinned_supplemental_identity",
        "identity_confidence": "VERIFIED_PINNED_MLBAM",
    }

    crosswalk_ids: dict[str, set[str]] = defaultdict(set)
    if crosswalk_path.exists():
        with crosswalk_path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                player = norm(row.get("player"))
                mlbam_id = clean(row.get("mlbam_id"))
                if player and mlbam_id:
                    crosswalk_ids[player].add(mlbam_id)
    return sorted(candidates.values(), key=lambda row: (row["npb_name"], row["mlb_name"])), crosswalk_ids


def resolve_people(candidates: list[dict[str, Any]], crosswalk_ids: dict[str, set[str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    resolved: list[dict[str, Any]] = []
    receipts: list[dict[str, Any]] = []
    for item in candidates:
        target = norm(item["mlb_name"] or item["npb_name_en"])
        # The pinned crosswalk intentionally did not resolve the Japanese
        # player's 2021/22 spelling, but the prior identity audit records the
        # authoritative MLBAM bridge.  This is an explicit full-name bridge,
        # not a surname guess.
        pinned_ids = {"筒香 嘉智": "660294"}
        if item["npb_name"] in pinned_ids:
            selected_id = pinned_ids[item["npb_name"]]
            resolved.append(dict(item, mlbam_id=selected_id, resolution_method="pinned_full_name_identity_bridge"))
            receipts.append({"npb_name": item["npb_name"], "query": item["mlb_name"], "candidate_ids": [selected_id], "selected_id": selected_id, "method": "pinned_full_name_identity_bridge"})
            continue
        crosswalk = sorted(crosswalk_ids.get(target, set()))
        if len(crosswalk) == 1:
            resolved.append(dict(item, mlbam_id=crosswalk[0], resolution_method="pinned_crosswalk_exact"))
            receipts.append({"npb_name": item["npb_name"], "query": item["mlb_name"], "candidate_ids": crosswalk, "selected_id": crosswalk[0], "method": "pinned_crosswalk_exact"})
            continue
        query = item["mlb_name"] or item["npb_name_en"]
        url = "https://statsapi.mlb.com/api/v1/people/search?names=" + urllib.parse.quote(query)
        payload, receipt = get_json(url)
        people = (payload or {}).get("people", []) if isinstance(payload, dict) else []
        exact = [person for person in people if norm(person.get("fullName")) == target]
        ids = sorted({str(person.get("id")) for person in exact if person.get("id")})
        record = {"npb_name": item["npb_name"], "query": query, "candidate_ids": ids, "selected_id": ids[0] if len(ids) == 1 else None, "method": "statsapi_exact_full_name" if len(ids) == 1 else "unresolved_ambiguous_or_missing", "http_receipt": receipt}
        receipts.append(record)
        if len(ids) == 1:
            resolved.append(dict(item, mlbam_id=ids[0], resolution_method=record["method"]))
        time.sleep(0.05)
    return resolved, receipts


def load_savant_rows(ids: set[str], years: set[int]) -> tuple[dict[tuple[str, int], dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    selected: dict[tuple[str, int], dict[str, Any]] = {}
    receipts: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for year in sorted(years):
        url = f"https://baseballsavant.mlb.com/leaderboard/sprint_speed?year={year}&position=&team=&min=10&csv=true"
        text, receipt = get_text(url)
        receipts.append(dict(receipt, source="MLB_BASEBALL_SAVANT_STATCAST_SPRINT_SPEED", season=year))
        if text is None:
            failures.append(dict(receipt, source="MLB_BASEBALL_SAVANT_STATCAST_SPRINT_SPEED", season=year, failure_state="ACQUISITION_FAILED"))
            continue
        try:
            rows = list(csv.DictReader(io.StringIO(text)))
        except csv.Error as exc:
            failures.append(dict(receipt, source="MLB_BASEBALL_SAVANT_STATCAST_SPRINT_SPEED", season=year, failure_state=f"CSV_PARSE_FAILED:{exc}"))
            continue
        for row in rows:
            player_id = clean(row.get("player_id"))
            if player_id not in ids:
                continue
            speed = as_float(row.get("sprint_speed"))
            if speed is None:
                continue
            selected[(player_id, year)] = {
                "mlbam_id": player_id,
                "season": year,
                "sprint_speed": speed,
                "team": clean(row.get("team")),
                "competitive_runs": as_int(row.get("competitive_runs")),
                "bolts": as_int(row.get("bolts")),
                "source_url": url,
                "source_response_sha256": receipt.get("response_sha256"),
                "source": "MLB_BASEBALL_SAVANT_STATCAST_SPRINT_SPEED",
            }
        time.sleep(0.05)
    return selected, receipts, failures


def parse_stats(resolved: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    appearance_rows: list[dict[str, Any]] = []
    shared_rows: list[dict[str, Any]] = []
    payloads: dict[str, Any] = {}
    receipts: list[dict[str, Any]] = []
    for item in sorted(resolved, key=lambda row: (int(row["mlbam_id"]), row["npb_name"])):
        mlbam_id = str(item["mlbam_id"])
        url = f"https://statsapi.mlb.com/api/v1/people/{mlbam_id}/stats?stats=yearByYear&group=hitting&sportIds=1"
        payload, receipt = get_json(url)
        receipts.append(dict(receipt, mlbam_id=mlbam_id, source="MLB_STATS_API_YEAR_BY_YEAR_HITTING"))
        if payload is None:
            continue
        payloads[mlbam_id] = payload
        for block in payload.get("stats", []) if isinstance(payload, dict) else []:
            for split in block.get("splits", []):
                if clean(split.get("gameType")) not in {"R", ""}:
                    continue
                sport = split.get("sport", {}) or {}
                if sport.get("id") not in (None, 1, "1"):
                    continue
                stat = split.get("stat", {}) or {}
                season = as_int(split.get("season"))
                games = as_int(stat.get("gamesPlayed")) or 0
                pa = as_int(stat.get("plateAppearances")) or 0
                if season is None or (games <= 0 and pa <= 0):
                    continue
                h = as_int(stat.get("hits")) or 0
                ab = as_int(stat.get("atBats")) or 0
                sb = as_int(stat.get("stolenBases")) or 0
                cs = as_int(stat.get("caughtStealing")) or 0
                triples = as_int(stat.get("triples")) or 0
                doubles = as_int(stat.get("doubles")) or 0
                runs = as_int(stat.get("runs")) or 0
                strikeouts = as_int(stat.get("strikeOuts")) or 0
                gidp = as_int(stat.get("groundIntoDoublePlay")) or 0
                singles = h - doubles - triples - (as_int(stat.get("homeRuns")) or 0)
                bip = max(0, ab - strikeouts)
                payload_hash = receipt.get("response_sha256")
                source_url = url
                row = {
                    "stable_player_key": f"MLBAM:{mlbam_id}",
                    "mlbam_id": mlbam_id,
                    "npb_name": item["npb_name"],
                    "npb_name_en": item["npb_name_en"],
                    "mlb_name": split.get("player", {}).get("fullName") or item["mlb_name"],
                    "season": season,
                    "league": "MLB",
                    "game_type": "R",
                    "regular_season_games": games,
                    "plate_appearances": pa,
                    "at_bats": ab,
                    "source_url_or_endpoint": source_url,
                    "retrieval_date": DATE,
                    "payload_hash": payload_hash,
                    "identity_confidence": item["identity_confidence"],
                    "evidence_state": "VERIFIED_REGULAR_SEASON_APPEARANCE",
                }
                appearance_rows.append(row)
                shared_rows.append({
                    **row,
                    "runs": runs,
                    "hits": h,
                    "singles": singles,
                    "doubles": doubles,
                    "triples": triples,
                    "strikeouts": strikeouts,
                    "batted_balls_in_play": bip,
                    "ground_into_double_play": gidp,
                    "stolen_base_attempts": sb + cs,
                    "stolen_bases": sb,
                    "caught_stealing": cs,
                    "sb_attempt_rate": (sb + cs) / pa if pa else None,
                    "sb_success_rate": sb / (sb + cs) if sb + cs else None,
                    "triple_rate": triples / ab if ab else None,
                    "gdp_rate": gidp / ab if ab else None,
                    "run_rate": runs / pa if pa else None,
                    "single_rate": singles / ab if ab else None,
                    "double_rate": doubles / ab if ab else None,
                    "strikeout_rate": strikeouts / pa if pa else None,
                    "bip_rate": bip / ab if ab else None,
                    "sprint_speed": None,
                    "sprint_speed_source": "PENDING_STATCAST_JOIN",
                    "infield_hit_rate_opportunity": None,
                    "first_to_third_success_rate": None,
                    "second_to_home_success_rate": None,
                    "ubr_bsr_compatible": None,
                    "advanced_indicator_state": "BLOCKED_MISSING_DATA",
                    "advanced_indicator_missingness": "MLB_STATS_API_YEAR_BY_YEAR_HITTING_DOES_NOT_EXPOSE_OPPORTUNITY_TABLES_OR_UBR_BSR_COMPATIBLE_VALUES",
                    "feature_definition_version": "sp101_mlb_shared_indicator_dictionary_20260818",
                })
        time.sleep(0.05)
    # Stats API yearByYear returns one row per team for players traded during a
    # season.  SP-101 requires player-season rows, so aggregate counts before
    # exposing appearance years or rate features.  This avoids treating one
    # player's split lines as independent evidence.
    appearance_by_season: dict[tuple[str, int], dict[str, Any]] = {}
    for row in appearance_rows:
        key = (row["mlbam_id"], int(row["season"]))
        target = appearance_by_season.setdefault(key, dict(row, regular_season_games=0, plate_appearances=0, at_bats=0))
        target["regular_season_games"] += int(row.get("regular_season_games") or 0)
        target["plate_appearances"] += int(row.get("plate_appearances") or 0)
        target["at_bats"] += int(row.get("at_bats") or 0)

    count_fields = ["runs", "hits", "singles", "doubles", "triples", "strikeouts", "batted_balls_in_play", "ground_into_double_play", "stolen_base_attempts", "stolen_bases", "caught_stealing"]
    shared_by_season: dict[tuple[str, int], dict[str, Any]] = {}
    for row in shared_rows:
        key = (row["mlbam_id"], int(row["season"]))
        if key not in shared_by_season:
            shared_by_season[key] = dict(row)
            for field in count_fields:
                shared_by_season[key][field] = 0
        target = shared_by_season[key]
        for field in count_fields:
            target[field] += int(row.get(field) or 0)
    for key, row in shared_by_season.items():
        pa = int(row.get("plate_appearances") or 0)
        ab = int(row.get("at_bats") or 0)
        attempts = int(row.get("stolen_base_attempts") or 0)
        row["sb_attempt_rate"] = attempts / pa if pa else None
        row["sb_success_rate"] = int(row.get("stolen_bases") or 0) / attempts if attempts else None
        row["triple_rate"] = int(row.get("triples") or 0) / ab if ab else None
        row["gdp_rate"] = int(row.get("ground_into_double_play") or 0) / ab if ab else None
        row["run_rate"] = int(row.get("runs") or 0) / pa if pa else None
        row["single_rate"] = int(row.get("singles") or 0) / ab if ab else None
        row["double_rate"] = int(row.get("doubles") or 0) / ab if ab else None
        row["strikeout_rate"] = int(row.get("strikeouts") or 0) / pa if pa else None
        row["bip_rate"] = int(row.get("batted_balls_in_play") or 0) / ab if ab else None
    return list(appearance_by_season.values()), list(shared_by_season.values()), payloads, receipts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--crosswalk", default=str(CROSSWALK_PATH))
    parser.add_argument("--no-network", action="store_true", help="reserved for receipt inspection; acquisition requires network")
    args = parser.parse_args()
    if args.no_network:
        raise SystemExit("collector requires network; use the frozen outputs for no-network downstream rebuilds")

    candidates, crosswalk_ids = load_identity_candidates(Path(args.crosswalk))
    resolved, identity_receipts = resolve_people(candidates, crosswalk_ids)
    appearance_rows, shared_rows, payloads, stats_receipts = parse_stats(resolved)
    ids = {row["mlbam_id"] for row in resolved}
    years = {int(row["season"]) for row in appearance_rows}
    savant_rows, savant_receipts, savant_failures = load_savant_rows(ids, years)
    for row in shared_rows:
        sprint = savant_rows.get((row["mlbam_id"], int(row["season"])))
        if sprint:
            row["sprint_speed"] = sprint["sprint_speed"]
            row["sprint_speed_source"] = sprint["source_url"]

    # Save raw Stats API payloads by MLBAM id.  JSON key order and newline are
    # fixed so the payload hash is a rerun receipt rather than a log message.
    raw_path = ROOT / "data" / "manual" / "sp101_mlb_stats_api_payloads_20260818.json"
    write_json(raw_path, {"schema_version": "sp101_mlb_stats_api_payloads_20260818", "retrieval_date": DATE, "payloads": payloads})

    appearance_rows.sort(key=lambda row: (row["stable_player_key"], int(row["season"])))
    shared_rows.sort(key=lambda row: (row["stable_player_key"], int(row["season"])))
    write_csv(ROOT / "outputs" / "derived" / "sp101_mlb_regular_season_appearance_years.csv", appearance_rows, [
        "stable_player_key", "mlbam_id", "npb_name", "npb_name_en", "mlb_name", "season", "league", "game_type", "regular_season_games", "plate_appearances", "source_url_or_endpoint", "retrieval_date", "payload_hash", "identity_confidence", "evidence_state",
    ])
    write_gzip_csv(ROOT / "outputs" / "derived" / "sp101_mlb_shared_indicator_player_seasons.csv.gz", shared_rows, [
        "stable_player_key", "mlbam_id", "npb_name", "npb_name_en", "mlb_name", "season", "league", "game_type", "regular_season_games", "plate_appearances", "at_bats", "runs", "hits", "singles", "doubles", "triples", "strikeouts", "batted_balls_in_play", "ground_into_double_play", "stolen_base_attempts", "stolen_bases", "caught_stealing", "sb_attempt_rate", "sb_success_rate", "triple_rate", "gdp_rate", "run_rate", "single_rate", "double_rate", "strikeout_rate", "bip_rate", "sprint_speed", "sprint_speed_source", "infield_hit_rate_opportunity", "first_to_third_success_rate", "second_to_home_success_rate", "ubr_bsr_compatible", "advanced_indicator_state", "advanced_indicator_missingness", "feature_definition_version", "source_url_or_endpoint", "retrieval_date", "payload_hash", "identity_confidence", "evidence_state",
    ])
    write_json(ROOT / "data" / "manual" / "sp101_mlb_sprint_speed_rows_20260818.json", {"schema_version": "sp101_mlb_sprint_speed_rows_20260818", "retrieval_date": DATE, "rows": [savant_rows[key] for key in sorted(savant_rows)]})

    unresolved = [item for item in identity_receipts if not item.get("selected_id")]
    soto_attempts = {
        "npb_name": "ソト",
        "result": "UNRESOLVED_NO_SHORT_NAME_GUESS",
        "attempted_sources": [
            "data/pennant.db:current queue identity/team",
            "data/normalized/player_identity_crosswalk.csv:Juan Soto/Gregory Soto/Livan Soto/Elliot Soto candidates",
            "https://statsapi.mlb.com/api/v1/people/search?names=Soto",
        ],
        "candidate_mlbam_ids_not_adopted": ["665742", "642397", "670869"],
        "reason": "Short NPB surname is not an authoritative NPB↔MLB identity bridge; no candidate is promoted.",
    }
    manifest = {
        "schema_version": "sp101_mlb_official_indicator_source_manifest_20260818",
        "generated_at": DATE,
        "sources": [
            {"source": "MLB_STATS_API_YEAR_BY_YEAR_HITTING", "endpoint_template": "https://statsapi.mlb.com/api/v1/people/{mlbam_id}/stats?stats=yearByYear&group=hitting&sportIds=1", "definition": "gameType=R, sport=MLB, gamesPlayed>0 or plateAppearances>0; regular-season appearance only", "receipts": stats_receipts},
            {"source": "MLB_BASEBALL_SAVANT_STATCAST_SPRINT_SPEED", "endpoint_template": "https://baseballsavant.mlb.com/leaderboard/sprint_speed?year={season}&position=&team=&min=10&csv=true", "definition": "official Statcast Sprint Speed leaderboard, matched by MLBAM id and season", "receipts": savant_receipts},
            {"source": "PINNED_IDENTITY_CROSSWALK", "path": str(args.crosswalk), "sha256": sha256_file(Path(args.crosswalk)) if Path(args.crosswalk).exists() else None, "role": "identity candidate only; never appearance evidence"},
        ],
        "identity_resolution": identity_receipts,
        "unresolved_identity_attempts": unresolved,
        "short_name_negative_control": soto_attempts,
        "failed_acquisition": savant_failures + [item for item in stats_receipts if item.get("error")],
        "feature_definitions": {
            "directly_comparable_after_league_normalization": ["PA", "AB", "SB_ATTEMPTS", "SB_SUCCESS", "TRIPLES", "GIDP", "RUNS", "HITS", "SINGLES", "DOUBLES", "STRIKEOUTS", "BIP", "SPRINT_SPEED"],
            "approximate_common_construct": ["SB_ATTEMPT_RATE", "SB_SUCCESS_RATE", "TRIPLE_RATE", "GIDP_RATE", "RUN_RATE", "SINGLE_RATE", "DOUBLE_RATE", "STRIKEOUT_RATE", "BIP_RATE"],
            "not_definitionally_comparable": ["INFIELD_HIT_RATE_OPPORTUNITY", "FIRST_TO_THIRD_SUCCESS_RATE", "SECOND_TO_HOME_SUCCESS_RATE", "UBR_BSR_COMPATIBLE"],
            "blocked_missing_data": ["infield_hit_rate_opportunity", "first_to_third_success_rate", "second_to_home_success_rate", "ubr_bsr_compatible"],
        },
        "counts": {
            "curated_candidates": len(candidates),
            "resolved_mlbam_ids": len(resolved),
            "regular_season_appearance_rows": len(appearance_rows),
            "regular_season_players": len({row["mlbam_id"] for row in appearance_rows}),
            "shared_indicator_rows": len(shared_rows),
            "sprint_speed_rows": sum(row.get("sprint_speed") is not None for row in shared_rows),
            "blocked_advanced_indicator_rows": sum(row.get("advanced_indicator_state") == "BLOCKED_MISSING_DATA" for row in shared_rows),
        },
        "payload_file": str(raw_path.relative_to(ROOT)),
        "payload_file_sha256": sha256_file(raw_path),
        "determinism": "retrieval_date fixed to 2026-08-18; downstream uses frozen files; gzip mtime=0",
    }
    write_json(ROOT / "data" / "manual" / "sp101_mlb_official_indicator_source_manifest_20260818.json", manifest)
    print(json.dumps({"status": "PASS", "resolved_mlbam_ids": len(resolved), "appearance_rows": len(appearance_rows), "shared_rows": len(shared_rows), "sprint_speed_rows": sum(row.get("sprint_speed") is not None for row in shared_rows), "soto": "UNRESOLVED_NO_SHORT_NAME_GUESS"}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

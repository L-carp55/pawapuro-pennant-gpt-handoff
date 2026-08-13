#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Collect SP-054/SP-055 Prospi speed values from gamex.jp into run2 staging CSVs.

The collector is intentionally append-only.  It first verifies a direct (no
environment-proxy) connection to https://gamex.jp/.  It then records one
row for every 2026 100-player master-table player and requested edition:

* a validated matching card row with its published speed value, or
* NOT_FOUND when a successfully parsed edition has no safe player+team match,
* CONNECTION_FAILED when an edition page could not be reached, or
* SOURCE_SCHEMA_ISSUE when the reached page lacks the expected hitter table.

It never alters accepted/rejected ledgers, the final community artifacts, or
the speed task registry.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup


REPO = Path(__file__).resolve().parents[1]
TARGETS_CSV = REPO / "outputs" / "derived" / "speed_2026_100_owner_review_master_20260813.csv"
CURRENT_CSV = REPO / "outputs" / "derived" / "_staging_speed_prospi_gamex_current_run2.csv"
HISTORICAL_CSV = REPO / "outputs" / "derived" / "_staging_speed_prospi_gamex_historical_run2.csv"
LOG_JSONL = REPO / "outputs" / "derived" / "_staging_speed_prospi_gamex_run2_execution_log.jsonl"

RUN_ID = "speed-prospi-gamex-run2-20260813"
PARSER_VERSION = "1.0.0"
USER_AGENT = "Mozilla/5.0 (compatible; PawapuroPennantResearch/1.0; +https://github.com/L-carp55/pawapuro-pennant-gpt-handoff)"
ROOT_URL = "https://gamex.jp/"

# gamex.jp uses short club labels; the master table uses official full labels.
TEAM_TO_GAMEX = {
    "オリックス・バファローズ": "オリックス",
    "福岡ソフトバンクホークス": "ソフトバンク",
    "北海道日本ハムファイターズ": "日本ハム",
    "千葉ロッテマリーンズ": "ロッテ",
    "埼玉西武ライオンズ": "西武",
    "東北楽天ゴールデンイーグルス": "楽天",
    "読売ジャイアンツ": "巨人",
    "阪神タイガース": "阪神",
    "横浜DeNAベイスターズ": "DeNA",
    "広島東洋カープ": "広島",
    "東京ヤクルトスワローズ": "ヤクルト",
    "中日ドラゴンズ": "中日",
}

# The aliases are deliberately small and source-specific.  A partial-name
# match is never accepted unless it is listed here and the club also matches.
SOURCE_NAME_ALIASES = {
    "ファビアン": {"サンドロファビアン"},
    "モンテロ": {"エレフリスモンテロ", "Eモンテロ"},
}

EDITIONS = (
    {
        "task_id": "SP-054",
        "lane": "current",
        "edition_code": "2026S1",
        "edition": "2026 Series 1",
        "source_url": "https://gamex.jp/prospi-top/prospi-players/prospi-players-2026-s1",
    },
    {
        "task_id": "SP-055",
        "lane": "historical",
        "edition_code": "2025S2",
        "edition": "2025 Series 2",
        "source_url": "https://gamex.jp/prospi-top/prospi-players/prospi-players-2025-s2",
    },
    {
        "task_id": "SP-055",
        "lane": "historical",
        "edition_code": "2025S1",
        "edition": "2025 Series 1",
        "source_url": "https://gamex.jp/prospi-top/prospi-players/prospi-players-2025-s1",
    },
    # The run1 record claimed a 2024S2 historical route.  Preserve the actual
    # route and response without inventing an edition page that gamex.jp does
    # not provide at this URL.
    {
        "task_id": "SP-055",
        "lane": "historical",
        "edition_code": "2024S2_PROBE",
        "edition": "2024 Series 2 (gamex route probe)",
        "source_url": "https://gamex.jp/prospi-top/prospi-players/prospi-players-2024-s2",
        "source_probe_only": True,
    },
)

CSV_FIELDS = (
    "record_id",
    "task_id",
    "run_id",
    "record_type",
    "player",
    "canonical_player_id",
    "team",
    "game",
    "edition",
    "source_player_name",
    "source_team",
    "source_position",
    "source_rank",
    "source_card_type",
    "attribute_name",
    "attribute_value",
    "source_url",
    "source_table_index",
    "source_row_number",
    "source_row_fingerprint",
    "collected_at_utc",
    "http_status",
    "acquisition_status",
    "acceptance_status",
    "exclusion_or_decision_reason",
    "error_type",
    "error_message",
    "attempted_routes",
    "parser_version",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("﨑", "崎").replace("髙", "高").replace("塚", "塚")
    return re.sub(r"[\s\u3000・.．･]", "", value)


def fingerprint(parts: list[str]) -> str:
    text = "\x1f".join(parts).encode("utf-8")
    return hashlib.sha256(text).hexdigest()[:16]


def read_targets() -> list[dict[str, str]]:
    with TARGETS_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        targets = list(csv.DictReader(handle))
    if len(targets) != 100:
        raise RuntimeError(f"Expected exactly 100 master-table targets, found {len(targets)}: {TARGETS_CSV}")
    required = {"player", "player_id", "team"}
    missing = required.difference(targets[0])
    if missing:
        raise RuntimeError(f"Target file missing required fields: {sorted(missing)}")
    unknown_teams = sorted({row["team"] for row in targets}.difference(TEAM_TO_GAMEX))
    if unknown_teams:
        raise RuntimeError(f"No gamex team mapping for: {unknown_teams}")
    return targets


def open_session() -> requests.Session:
    session = requests.Session()
    # Explicitly ignore HTTP(S)_PROXY so the run cannot silently repeat the
    # prior 127.0.0.1:9 proxy failure.
    session.trust_env = False
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ja,en;q=0.8"})
    return session


def response_error(response: requests.Response) -> str:
    return f"HTTP {response.status_code} {response.reason or ''}".strip()


def parse_hitter_rows(html: bytes) -> tuple[list[dict[str, str]], list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, str]] = []
    issues: list[str] = []
    for table_index, table in enumerate(soup.find_all("table")):
        header_cells = table.find_all("th")
        headers = [cell.get_text(" ", strip=True) for cell in header_cells]
        if "選手名" not in headers or "走力" not in headers:
            continue
        for source_row_number, tr in enumerate(table.find_all("tr")[1:], start=1):
            cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["th", "td"])]
            if len(cells) != len(headers):
                issues.append(
                    f"table={table_index};row={source_row_number};expected_cells={len(headers)};actual_cells={len(cells)}"
                )
                continue
            record = dict(zip(headers, cells))
            record["_source_table_index"] = str(table_index)
            record["_source_row_number"] = str(source_row_number)
            rows.append(record)
    return rows, issues


def output_path(lane: str) -> Path:
    if lane == "current":
        return CURRENT_CSV
    if lane == "historical":
        return HISTORICAL_CSV
    raise ValueError(f"Unknown lane: {lane}")


def existing_ids(path: Path) -> set[str]:
    if not path.exists() or path.stat().st_size == 0:
        return set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return {row.get("record_id", "") for row in csv.DictReader(handle) if row.get("record_id")}


def append_csv(path: Path, record: dict[str, str], seen_ids: set[str], dry_run: bool) -> bool:
    record_id = record["record_id"]
    if record_id in seen_ids:
        return False
    if dry_run:
        seen_ids.add(record_id)
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    needs_header = not path.exists() or path.stat().st_size == 0
    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, extrasaction="raise")
        if needs_header:
            writer.writeheader()
        writer.writerow(record)
        handle.flush()
    seen_ids.add(record_id)
    return True


def append_log(event: dict[str, Any], dry_run: bool) -> None:
    event = {"run_id": RUN_ID, "logged_at_utc": utc_now(), **event}
    if dry_run:
        print(json.dumps(event, ensure_ascii=False, sort_keys=True))
        return
    LOG_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with LOG_JSONL.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()


def base_record(edition: dict[str, str], *, record_id: str, record_type: str, collected_at: str) -> dict[str, str]:
    return {
        "record_id": record_id,
        "task_id": edition["task_id"],
        "run_id": RUN_ID,
        "record_type": record_type,
        "player": "",
        "canonical_player_id": "",
        "team": "",
        "game": "Pro Yakyuu Spirits A",
        "edition": edition["edition"],
        "source_player_name": "",
        "source_team": "",
        "source_position": "",
        "source_rank": "",
        "source_card_type": "",
        "attribute_name": "走力",
        "attribute_value": "",
        "source_url": edition["source_url"],
        "source_table_index": "",
        "source_row_number": "",
        "source_row_fingerprint": "",
        "collected_at_utc": collected_at,
        "http_status": "",
        "acquisition_status": "",
        "acceptance_status": "",
        "exclusion_or_decision_reason": "",
        "error_type": "",
        "error_message": "",
        "attempted_routes": edition["source_url"],
        "parser_version": PARSER_VERSION,
    }


def card_matches(target: dict[str, str], source: dict[str, str]) -> bool:
    target_name = normalize(target["player"])
    source_name = normalize(source["選手名"])
    accepted_names = {target_name, *SOURCE_NAME_ALIASES.get(target_name, set())}
    return source_name in accepted_names and source["球団"] == TEAM_TO_GAMEX[target["team"]]


def card_fingerprint(edition: dict[str, str], source: dict[str, str]) -> str:
    return fingerprint(
        [edition["edition_code"], source["選手名"], source["球団"], source["守備"], source["ランク"], source["スカウト種別"], source["走力"]]
    )


def source_card_record(
    edition: dict[str, str], target: dict[str, str], source: dict[str, str], collected_at: str, http_status: int, duplicate_ordinal: int = 0
) -> dict[str, str]:
    row_fingerprint = card_fingerprint(edition, source)
    # Preserve duplicate source rows in raw output. The first occurrence keeps
    # its original stable id; later identical cards include a row ordinal.
    record_suffix = row_fingerprint if duplicate_ordinal <= 1 else f"{row_fingerprint}-DUP{duplicate_ordinal:02d}"
    record = base_record(
        edition,
        record_id=f"{edition['task_id']}-RUN2-{edition['edition_code']}-{target['player_id']}-{record_suffix}",
        record_type="MATCHED_CARD",
        collected_at=collected_at,
    )
    record.update(
        {
            "player": target["player"],
            "canonical_player_id": target["player_id"],
            "team": target["team"],
            "source_player_name": source["選手名"],
            "source_team": source["球団"],
            "source_position": source["守備"],
            "source_rank": source["ランク"],
            "source_card_type": source["スカウト種別"],
            "attribute_value": source["走力"],
            "source_table_index": source["_source_table_index"],
            "source_row_number": source["_source_row_number"],
            "source_row_fingerprint": row_fingerprint,
            "http_status": str(http_status),
            "acquisition_status": "RETRIEVED",
            "acceptance_status": "ACCEPTED_FOR_EXTERNAL_GAME_LANE",
            "exclusion_or_decision_reason": "Exact player-name (or documented source alias) and mapped-team match in gamex hitter table; published 走力 captured without conversion.",
        }
    )
    if not re.fullmatch(r"\d{1,3}", source["走力"]):
        record.update(
            {
                "attribute_value": "",
                "acquisition_status": "INSUFFICIENT",
                "acceptance_status": "EXCLUDED_PENDING_SOURCE_REVIEW",
                "exclusion_or_decision_reason": "Matched source card but 走力 was not an integer; no numeric value inferred.",
                "error_type": "SOURCE_VALUE_SCHEMA_ISSUE",
                "error_message": f"Unexpected 走力 cell: {source['走力']!r}",
            }
        )
    return record


def player_outcome_record(
    edition: dict[str, str], target: dict[str, str], collected_at: str, http_status: str, status: str, reason: str, *, error_type: str = "", error_message: str = ""
) -> dict[str, str]:
    suffix = {"NOT_FOUND": "NOTFOUND", "CONNECTION_FAILED": "CONNECTION", "INSUFFICIENT": "INSUFFICIENT"}[status]
    record = base_record(
        edition,
        record_id=f"{edition['task_id']}-RUN2-{edition['edition_code']}-{target['player_id']}-{suffix}",
        record_type="PLAYER_OUTCOME",
        collected_at=collected_at,
    )
    record.update(
        {
            "player": target["player"],
            "canonical_player_id": target["player_id"],
            "team": target["team"],
            "http_status": http_status,
            "acquisition_status": status,
            "acceptance_status": "NOT_ACCEPTED_NO_VALUE",
            "exclusion_or_decision_reason": reason,
            "error_type": error_type,
            "error_message": error_message,
        }
    )
    return record


def source_outcome_record(
    edition: dict[str, str], collected_at: str, http_status: str, status: str, reason: str, *, error_type: str = "", error_message: str = ""
) -> dict[str, str]:
    record = base_record(
        edition,
        record_id=f"{edition['task_id']}-RUN2-{edition['edition_code']}-SOURCE-{status}",
        record_type="SOURCE_OUTCOME",
        collected_at=collected_at,
    )
    record.update(
        {
            "http_status": http_status,
            "acquisition_status": status,
            "acceptance_status": "NOT_ACCEPTED_NO_VALUE",
            "exclusion_or_decision_reason": reason,
            "error_type": error_type,
            "error_message": error_message,
        }
    )
    return record


def write_record(edition: dict[str, str], record: dict[str, str], seen: dict[str, set[str]], dry_run: bool) -> bool:
    return append_csv(output_path(edition["lane"]), record, seen[edition["lane"]], dry_run)


def run(dry_run: bool) -> int:
    targets = read_targets()
    seen = {"current": existing_ids(CURRENT_CSV), "historical": existing_ids(HISTORICAL_CSV)}
    session = open_session()

    # This is retained in the log even though the caller must have run a
    # standalone curl/requests test first. It makes the artifact self-auditing.
    preflight_at = utc_now()
    try:
        preflight = session.get(ROOT_URL, timeout=(15, 30), allow_redirects=True)
        append_log(
            {
                "event": "reachability_preflight",
                "url": ROOT_URL,
                "http_status": preflight.status_code,
                "effective_url": preflight.url,
                "result": "SUCCESS" if preflight.ok else "HTTP_FAILURE",
                "error_message": "" if preflight.ok else response_error(preflight),
                "proxy_mode": "requests.Session.trust_env=False",
                "tested_at_utc": preflight_at,
            },
            dry_run,
        )
        if not preflight.ok:
            raise requests.HTTPError(response_error(preflight), response=preflight)
    except requests.RequestException as exc:
        exact_error = f"{type(exc).__name__}: {exc}"
        append_log(
            {
                "event": "reachability_preflight",
                "url": ROOT_URL,
                "result": "CONNECTION_FAILED",
                "error_message": exact_error,
                "proxy_mode": "requests.Session.trust_env=False",
                "tested_at_utc": preflight_at,
            },
            dry_run,
        )
        for edition in EDITIONS:
            if edition.get("source_probe_only"):
                continue
            for target in targets:
                write_record(
                    edition,
                    player_outcome_record(
                        edition,
                        target,
                        preflight_at,
                        "",
                        "CONNECTION_FAILED",
                        "Direct gamex.jp reachability preflight failed; source content was not classified as absent or malformed.",
                        error_type=type(exc).__name__,
                        error_message=exact_error,
                    ),
                    seen,
                    dry_run,
                )
        return 2

    counts: Counter[str] = Counter()
    for edition in EDITIONS:
        fetched_at = utc_now()
        try:
            response = session.get(edition["source_url"], timeout=(15, 45), allow_redirects=True)
        except requests.RequestException as exc:
            exact_error = f"{type(exc).__name__}: {exc}"
            append_log(
                {
                    "event": "edition_fetch",
                    "edition": edition["edition"],
                    "task_id": edition["task_id"],
                    "url": edition["source_url"],
                    "result": "CONNECTION_FAILED",
                    "error_message": exact_error,
                    "fetched_at_utc": fetched_at,
                },
                dry_run,
            )
            if edition.get("source_probe_only"):
                write_record(
                    edition,
                    source_outcome_record(
                        edition,
                        fetched_at,
                        "",
                        "CONNECTION_FAILED",
                        "Historical route probe could not connect; no content-absence or schema conclusion was made.",
                        error_type=type(exc).__name__,
                        error_message=exact_error,
                    ),
                    seen,
                    dry_run,
                )
            else:
                for target in targets:
                    write_record(
                        edition,
                        player_outcome_record(
                            edition,
                            target,
                            fetched_at,
                            "",
                            "CONNECTION_FAILED",
                            "Edition page could not be reached; no value was inferred and the page was not classified as malformed.",
                            error_type=type(exc).__name__,
                            error_message=exact_error,
                        ),
                        seen,
                        dry_run,
                    )
            counts[f"{edition['edition_code']}:CONNECTION_FAILED"] += 1
            continue

        if not response.ok:
            error = response_error(response)
            append_log(
                {
                    "event": "edition_fetch",
                    "edition": edition["edition"],
                    "task_id": edition["task_id"],
                    "url": edition["source_url"],
                    "result": "NOT_FOUND" if response.status_code == 404 else "HTTP_FAILURE",
                    "http_status": response.status_code,
                    "error_message": error,
                    "fetched_at_utc": fetched_at,
                },
                dry_run,
            )
            source_status = "NOT_FOUND" if response.status_code == 404 else "INSUFFICIENT"
            write_record(
                edition,
                source_outcome_record(
                    edition,
                    fetched_at,
                    str(response.status_code),
                    source_status,
                    "The requested gamex route returned a non-success HTTP response; no player value was inferred.",
                    error_type=f"HTTP_{response.status_code}",
                    error_message=error,
                ),
                seen,
                dry_run,
            )
            counts[f"{edition['edition_code']}:{source_status}"] += 1
            continue

        if edition.get("source_probe_only"):
            write_record(
                edition,
                source_outcome_record(
                    edition,
                    fetched_at,
                    str(response.status_code),
                    "INSUFFICIENT",
                    "Historical route probe unexpectedly returned content but was not an approved edition input; content intentionally not parsed into player values.",
                ),
                seen,
                dry_run,
            )
            counts[f"{edition['edition_code']}:INSUFFICIENT"] += 1
            continue

        source_rows, parser_issues = parse_hitter_rows(response.content)
        append_log(
            {
                "event": "edition_fetch",
                "edition": edition["edition"],
                "task_id": edition["task_id"],
                "url": edition["source_url"],
                "result": "SUCCESS" if source_rows else "SOURCE_SCHEMA_ISSUE",
                "http_status": response.status_code,
                "parsed_hitter_rows": len(source_rows),
                "parser_issues": parser_issues,
                "fetched_at_utc": fetched_at,
            },
            dry_run,
        )
        if not source_rows:
            write_record(
                edition,
                source_outcome_record(
                    edition,
                    fetched_at,
                    str(response.status_code),
                    "INSUFFICIENT",
                    "Source reached successfully but no hitter table containing 選手名 and 走力 could be parsed; no value was inferred.",
                    "SOURCE_SCHEMA_ISSUE",
                    "; ".join(parser_issues) if parser_issues else "No table with required headings was present.",
                ),
                seen,
                dry_run,
            )
            counts[f"{edition['edition_code']}:SOURCE_SCHEMA_ISSUE"] += 1
            continue

        # A malformed target-matching row is captured in the source-level log;
        # it never becomes a silent schema exclusion.
        for issue_index, issue in enumerate(parser_issues, start=1):
            issue_record = source_outcome_record(
                edition,
                fetched_at,
                str(response.status_code),
                "INSUFFICIENT",
                "A specific source-table row could not be parsed; this is preserved as a source schema issue rather than silently excluded.",
                "SOURCE_ROW_SCHEMA_ISSUE",
                issue,
            )
            issue_record["record_id"] = f"{edition['task_id']}-RUN2-{edition['edition_code']}-SOURCE-SCHEMA-{issue_index:03d}"
            write_record(edition, issue_record, seen, dry_run)

        for target in targets:
            matches = [row for row in source_rows if card_matches(target, row)]
            if not matches:
                record = player_outcome_record(
                    edition,
                    target,
                    fetched_at,
                    str(response.status_code),
                    "NOT_FOUND",
                    "Edition page was reached and parsed, but no exact player-name (or documented source alias) plus mapped-team match was present in its hitter table; no value inferred.",
                )
                write_record(edition, record, seen, dry_run)
                counts[f"{edition['edition_code']}:NOT_FOUND"] += 1
                continue
            duplicate_ordinals: Counter[str] = Counter()
            for source in matches:
                duplicate_key = card_fingerprint(edition, source)
                duplicate_ordinals[duplicate_key] += 1
                record = source_card_record(
                    edition,
                    target,
                    source,
                    fetched_at,
                    response.status_code,
                    duplicate_ordinal=duplicate_ordinals[duplicate_key],
                )
                write_record(edition, record, seen, dry_run)
                counts[f"{edition['edition_code']}:{record['acquisition_status']}"] += 1

    append_log(
        {
            "event": "run_summary",
            "result_counts": dict(sorted(counts.items())),
            "current_output": str(CURRENT_CSV.relative_to(REPO)),
            "historical_output": str(HISTORICAL_CSV.relative_to(REPO)),
            "target_count": len(targets),
            "dry_run": dry_run,
        },
        dry_run,
    )
    print(json.dumps(dict(sorted(counts.items())), ensure_ascii=False, sort_keys=True))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Fetch and parse without writing output files.")
    args = parser.parse_args()
    return run(dry_run=args.dry_run)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # exact cause is sent to stderr for the run log caller
        print(f"FATAL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise

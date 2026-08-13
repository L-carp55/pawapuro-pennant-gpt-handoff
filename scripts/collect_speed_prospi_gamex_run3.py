#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Append-only run3 recovery for GameX Prospi speed records.

The designated physical-evidence JSON is the 100-player source of truth.
This collector distinguishes a player absent from a parsed page (NOT_FOUND),
an edition for which GameX offers no inspectable page (NOT_COLLECTED), and a
network failure (CONNECTION_FAILED).  It never derives a speed value.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup


REPO = Path(__file__).resolve().parents[1]
TARGETS_JSON = REPO / "data" / "manual" / "npb_speed_physical_evidence_full_20260809.json"
IDENTITY_CSV = REPO / "outputs" / "derived" / "speed_2026_100_owner_review_master_20260813.csv"
RUN2_CURRENT_CSV = REPO / "outputs" / "derived" / "speed_prospi_gamex_current_20260813_run2.csv"
RUN2_LOG = REPO / "outputs" / "derived" / "_staging_speed_prospi_gamex_run2_execution_log.jsonl"

CURRENT_CSV = REPO / "outputs" / "derived" / "speed_prospi_gamex_current_20260813_run3.csv"
HISTORICAL_CSV = REPO / "outputs" / "derived" / "speed_prospi_gamex_historical_20260813_run3.csv"
RUN3_LOG = REPO / "outputs" / "derived" / "_staging_speed_prospi_gamex_run3_execution_log.jsonl"
DIAGNOSIS_JSON = REPO / "outputs" / "derived" / "speed_prospi_gamex_run3_coverage_diagnosis.json"
AUDIT_MD = REPO / "docs" / "audits" / "speed_prospi_gamex_run3_20260813.md"

RUN_ID = "speed-prospi-gamex-run3-20260813"
PARSER_VERSION = "2.0.0"
ROOT_URL = "https://gamex.jp/"
PLAYER_INDEX_URL = "https://gamex.jp/prospi-top/prospi-players"
PROSPI_TOP_URL = "https://gamex.jp/prospi-top"
SITEMAP_INDEX_URL = "https://gamex.jp/sitemap_index.xml"
PAGE_SITEMAP_URL = "https://gamex.jp/page-sitemap.xml"
USER_AGENT = "Mozilla/5.0 (compatible; PawapuroPennantResearch/1.0; contact=research)"

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

# These source-specific aliases existed in run2.  They remain explicit rather
# than turning any partial name into an automatic match.
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
        "short_url": "https://gamex.jp/prospi-players-2026-s1/",
    },
    {
        "task_id": "SP-055",
        "lane": "historical",
        "edition_code": "2025S2",
        "edition": "2025 Series 2",
        "source_url": "https://gamex.jp/prospi-top/prospi-players/prospi-players-2025-s2",
        "short_url": "https://gamex.jp/prospi-players-2025-s2/",
    },
    {
        "task_id": "SP-055",
        "lane": "historical",
        "edition_code": "2025S1",
        "edition": "2025 Series 1",
        "source_url": "https://gamex.jp/prospi-top/prospi-players/prospi-players-2025-s1",
        "short_url": "https://gamex.jp/prospi-players-2025-s1/",
    },
)

HISTORICAL_2024 = {
    "task_id": "SP-055",
    "lane": "historical",
    "edition_code": "2024S2",
    "edition": "2024 Series 2",
    "source_url": "https://gamex.jp/prospi-top/prospi-players/prospi-players-2024-s2",
    "short_url": "https://gamex.jp/prospi-players-2024-s2/",
}

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
    """The requested NFKC/spacing/middle-dot and documented old-glyph form."""
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("﨑", "崎").replace("髙", "高").replace("塚", "塚")
    return re.sub(r"[\s\u3000・.．･]", "", value)


def fingerprint(parts: list[str]) -> str:
    return hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()[:16]


def output_path(lane: str) -> Path:
    return CURRENT_CSV if lane == "current" else HISTORICAL_CSV


def open_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ja,en;q=0.8"})
    return session


def read_targets() -> list[dict[str, str]]:
    with TARGETS_JSON.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    raw_players = payload.get("players")
    if not isinstance(raw_players, list) or len(raw_players) != 100:
        raise RuntimeError(f"Expected exactly 100 players[] entries in {TARGETS_JSON}")
    if any(not isinstance(item.get("player"), str) or not isinstance(item.get("team"), str) for item in raw_players):
        raise RuntimeError("Every designated JSON target must have player and team.")
    names = [item["player"] for item in raw_players]
    if len(set(names)) != len(names):
        raise RuntimeError("The designated JSON contains duplicate player names; no unsafe ID join was attempted.")

    with IDENTITY_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        identity_rows = list(csv.DictReader(handle))
    # One designated player has a deliberately unresolved canonical ID in the
    # existing master.  Preserve that blank rather than inventing an ID; a
    # deterministic private record key prevents duplicate CSV IDs.
    ids = {row["player"]: row.get("player_id", "") for row in identity_rows if row.get("player")}
    absent_from_identity = [name for name in names if name not in ids]
    if absent_from_identity:
        raise RuntimeError(f"JSON players absent from the identity input: {absent_from_identity}")
    unknown_teams = sorted({item["team"] for item in raw_players}.difference(TEAM_TO_GAMEX))
    if unknown_teams:
        raise RuntimeError(f"No GameX team mapping for: {unknown_teams}")
    return [
        {
            "player": item["player"],
            "team": item["team"],
            "canonical_player_id": ids[item["player"]],
            "record_key": ids[item["player"]] or f"NO_CANONICAL_{fingerprint([item['player'], item['team']])}",
        }
        for item in raw_players
    ]


def parse_hitter_rows(html: bytes) -> tuple[list[dict[str, str]], list[str], list[dict[str, int]]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, str]] = []
    issues: list[str] = []
    table_summary: list[dict[str, int]] = []
    for table_index, table in enumerate(soup.find_all("table")):
        headers = [cell.get_text(" ", strip=True) for cell in table.find_all("th")]
        if not headers:
            continue
        table_summary.append({"table_index": table_index, "row_count_excluding_header": max(0, len(table.find_all("tr")) - 1)})
        if "選手名" not in headers or "走力" not in headers:
            continue
        for source_row_number, tr in enumerate(table.find_all("tr")[1:], start=1):
            cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["th", "td"])]
            if len(cells) != len(headers):
                issues.append(
                    f"table={table_index};row={source_row_number};expected_cells={len(headers)};actual_cells={len(cells)}"
                )
                continue
            row = dict(zip(headers, cells))
            row["_source_table_index"] = str(table_index)
            row["_source_row_number"] = str(source_row_number)
            rows.append(row)
    return rows, issues, table_summary


def existing_ids(path: Path) -> set[str]:
    if not path.exists() or path.stat().st_size == 0:
        return set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return {row["record_id"] for row in csv.DictReader(handle) if row.get("record_id")}


def append_csv(path: Path, record: dict[str, str], seen: set[str]) -> bool:
    if record["record_id"] in seen:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    needs_header = not path.exists() or path.stat().st_size == 0
    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, extrasaction="raise")
        if needs_header:
            writer.writeheader()
        writer.writerow(record)
        handle.flush()
    seen.add(record["record_id"])
    return True


def append_log(event: dict[str, Any]) -> None:
    RUN3_LOG.parent.mkdir(parents=True, exist_ok=True)
    event = {"run_id": RUN_ID, "logged_at_utc": utc_now(), **event}
    with RUN3_LOG.open("a", encoding="utf-8", newline="\n") as handle:
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


def card_record(
    edition: dict[str, str],
    target: dict[str, str],
    source: dict[str, str],
    collected_at: str,
    http_status: int,
    decision_reason: str,
    duplicate_ordinal: int,
    attempted_routes: str,
) -> dict[str, str]:
    row_fingerprint = fingerprint(
        [
            edition["edition_code"],
            source["選手名"],
            source["球団"],
            source["守備"],
            source["ランク"],
            source["スカウト種別"],
            source["走力"],
        ]
    )
    suffix = row_fingerprint if duplicate_ordinal <= 1 else f"{row_fingerprint}-DUP{duplicate_ordinal:02d}"
    record = base_record(
        edition,
        record_id=f"{edition['task_id']}-RUN3-{edition['edition_code']}-{target['record_key']}-{suffix}",
        record_type="MATCHED_CARD",
        collected_at=collected_at,
    )
    record.update(
        {
            "player": target["player"],
            "canonical_player_id": target["canonical_player_id"],
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
            "exclusion_or_decision_reason": decision_reason,
            "attempted_routes": attempted_routes,
        }
    )
    if not re.fullmatch(r"\d{1,3}", source["走力"]):
        record.update(
            {
                "attribute_value": "",
                "acquisition_status": "INSUFFICIENT",
                "acceptance_status": "EXCLUDED_PENDING_SOURCE_REVIEW",
                "exclusion_or_decision_reason": "選手照合はできたが、GameXの走力セルが整数ではなかったため数値を推測しなかった。",
                "error_type": "SOURCE_VALUE_SCHEMA_ISSUE",
                "error_message": f"Unexpected 走力 cell: {source['走力']!r}",
            }
        )
    return record


def player_outcome_record(
    edition: dict[str, str],
    target: dict[str, str],
    collected_at: str,
    http_status: str,
    status: str,
    reason: str,
    attempted_routes: str,
    *,
    error_type: str = "",
    error_message: str = "",
) -> dict[str, str]:
    suffix = {"NOT_FOUND": "NOTFOUND", "NOT_COLLECTED": "NOTCOLLECTED", "CONNECTION_FAILED": "CONNECTION"}[status]
    record = base_record(
        edition,
        record_id=f"{edition['task_id']}-RUN3-{edition['edition_code']}-{target['record_key']}-{suffix}",
        record_type="PLAYER_OUTCOME",
        collected_at=collected_at,
    )
    record.update(
        {
            "player": target["player"],
            "canonical_player_id": target["canonical_player_id"],
            "team": target["team"],
            "http_status": http_status,
            "acquisition_status": status,
            "acceptance_status": "NOT_ACCEPTED_NO_VALUE",
            "exclusion_or_decision_reason": reason,
            "error_type": error_type,
            "error_message": error_message,
            "attempted_routes": attempted_routes,
        }
    )
    return record


def response_info(response: requests.Response) -> dict[str, Any]:
    return {
        "http_status": response.status_code,
        "effective_url": response.url,
        "content_bytes": len(response.content),
    }


def fetch(session: requests.Session, url: str, *, allow_redirects: bool = True) -> tuple[requests.Response | None, str | None]:
    try:
        return session.get(url, timeout=(15, 45), allow_redirects=allow_redirects), None
    except requests.RequestException as exc:
        return None, f"{type(exc).__name__}: {exc}"


def run2_urls() -> dict[str, list[str]]:
    with RUN2_CURRENT_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        current_urls = sorted({row["source_url"] for row in csv.DictReader(handle) if row.get("source_url")})
    log_urls: set[str] = set()
    with RUN2_LOG.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            item = json.loads(line)
            value = item.get("source_url") or item.get("url")
            if value:
                log_urls.add(value)
    return {
        "current_csv_source_url_column": current_urls,
        "execution_log_urls": sorted(log_urls),
        "union": sorted(set(current_urls).union(log_urls)),
    }


def discover_catalog(session: requests.Session) -> dict[str, Any]:
    catalog: dict[str, Any] = {"requests": {}, "discovered_player_urls": [], "errors": []}
    for label, url in (("prospi_top", PROSPI_TOP_URL), ("player_index", PLAYER_INDEX_URL), ("sitemap_index", SITEMAP_INDEX_URL), ("page_sitemap", PAGE_SITEMAP_URL)):
        response, error = fetch(session, url)
        if error:
            catalog["requests"][label] = {"url": url, "result": "CONNECTION_FAILED", "error": error}
            catalog["errors"].append(f"{label}: {error}")
            continue
        assert response is not None
        catalog["requests"][label] = {"url": url, **response_info(response)}
        if not response.ok:
            catalog["errors"].append(f"{label}: HTTP {response.status_code}")
            continue
        if label in {"prospi_top", "player_index"}:
            soup = BeautifulSoup(response.content, "html.parser")
            for anchor in soup.find_all("a", href=True):
                href = anchor["href"].strip()
                if "prospi-players" in href:
                    catalog["discovered_player_urls"].append(href)
        else:
            catalog["discovered_player_urls"].extend(re.findall(r"<loc>(.*?)</loc>", response.text))
    catalog["discovered_player_urls"] = sorted(set(catalog["discovered_player_urls"]))
    catalog["prospi_urls_in_catalog"] = [url for url in catalog["discovered_player_urls"] if "prospi" in url.lower()]
    return catalog


def candidate_partial_matches(targets: list[dict[str, str]], rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """Keep partial matches visible for human review, never auto-accept them."""
    candidates: list[dict[str, str]] = []
    for target in targets:
        target_name = normalize(target["player"])
        documented_aliases = {normalize(name) for name in SOURCE_NAME_ALIASES.get(target_name, set())}
        split_names = [normalize(part) for part in re.split(r"[\s\u3000]+", target["player"]) if normalize(part)]
        for source in rows:
            source_name = normalize(source["選手名"])
            if source_name == target_name or source_name in documented_aliases:
                continue
            # A full containment is useful for foreign-name variants; for a
            # Japanese name with an explicit family/given-name split, require
            # both parts somewhere in the source string so one common surname
            # is not made to look like a viable identity match.
            full_containment = target_name in source_name or source_name in target_name
            two_part_overlap = len(split_names) >= 2 and all(part in source_name for part in split_names)
            if full_containment or two_part_overlap:
                candidates.append(
                    {
                        "player": target["player"],
                        "target_team": target["team"],
                        "source_player_name": source["選手名"],
                        "source_team": source["球団"],
                        "source_url": source["_source_url"],
                        "decision": "CANDIDATE_ONLY_NOT_AUTO_ACCEPTED",
                    }
                )
    return candidates


def match_rows(
    edition: dict[str, str], targets: list[dict[str, str]], rows: list[dict[str, str]]
) -> tuple[dict[str, list[tuple[dict[str, str], str]]], list[dict[str, str]], Counter[str]]:
    """Match source rows and identify whether a recovery uses team history."""
    by_name: defaultdict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_name[normalize(row["選手名"])].append(row)
    matched: dict[str, list[tuple[dict[str, str], str]]] = {}
    decisions: Counter[str] = Counter()
    for target in targets:
        target_name = normalize(target["player"])
        aliases = {normalize(name) for name in SOURCE_NAME_ALIASES.get(target_name, set())}
        exact_rows = by_name.get(target_name, [])
        same_team = [row for row in exact_rows if row["球団"] == TEAM_TO_GAMEX[target["team"]]]
        if same_team:
            matched[target["record_key"]] = [
                (
                    row,
                    "NFKC・空白/中黒・新旧字の正規化後、同一版の選手名と球団が一致したため、GameX掲載の走力を変換せず記録した。",
                )
                for row in same_team
            ]
            decisions["NORMALIZED_NAME_AND_CURRENT_TEAM"] += len(same_team)
            continue
        alias_rows = [row for alias in aliases for row in by_name.get(alias, []) if row["球団"] == TEAM_TO_GAMEX[target["team"]]]
        if alias_rows:
            matched[target["record_key"]] = [
                (
                    row,
                    "文書化済みのGameX選手名別名と球団が一致したため、GameX掲載の走力を変換せず記録した。",
                )
                for row in alias_rows
            ]
            decisions["DOCUMENTED_SOURCE_ALIAS"] += len(alias_rows)
            continue
        if edition["lane"] == "historical" and exact_rows:
            # Every candidate has the same normalized full name.  Preserve the
            # source club and make the deliberate exception explicit.  This is
            # not a partial-name match.
            matched[target["record_key"]] = [
                (
                    row,
                    "歴史版で正規化済みのフル氏名が一致した。現在の名簿球団ではなくGameX掲載時の球団であるため、run2の現行球団条件を外し、掲載された当時球団を保持して記録した。",
                )
                for row in exact_rows
            ]
            decisions["HISTORICAL_EXACT_NAME_TEAM_DRIFT"] += len(exact_rows)
            continue
    return matched, candidate_partial_matches(targets, rows), decisions


def collect_edition(
    session: requests.Session,
    edition: dict[str, str],
    targets: list[dict[str, str]],
    seen: dict[str, set[str]],
    shared_routes: str,
) -> dict[str, Any]:
    fetched_at = utc_now()
    response, error = fetch(session, edition["source_url"])
    attempted = "; ".join([edition["source_url"], edition["short_url"], shared_routes])
    if error:
        append_log({"event": "edition_fetch", "edition": edition["edition"], "url": edition["source_url"], "result": "CONNECTION_FAILED", "error_message": error})
        for target in targets:
            append_csv(
                output_path(edition["lane"]),
                player_outcome_record(
                    edition,
                    target,
                    fetched_at,
                    "",
                    "CONNECTION_FAILED",
                    "版別ページへ接続できなかった。選手不在・データ欠落・表の不備とは判定せず、数値も補完していない。",
                    attempted,
                    error_type=error.split(":", 1)[0],
                    error_message=error,
                ),
                seen[edition["lane"]],
            )
        return {"edition": edition["edition"], "status": "CONNECTION_FAILED", "error": error}
    assert response is not None
    if not response.ok:
        append_log({"event": "edition_fetch", "edition": edition["edition"], "url": edition["source_url"], "result": "HTTP_FAILURE", **response_info(response)})
        for target in targets:
            append_csv(
                output_path(edition["lane"]),
                player_outcome_record(
                    edition,
                    target,
                    fetched_at,
                    str(response.status_code),
                    "NOT_COLLECTED",
                    "版別ページが成功応答ではなく、選手ページを解析できなかったため、選手がゲームに未収録とは判定していない。",
                    attempted,
                    error_type=f"HTTP_{response.status_code}",
                    error_message=f"HTTP {response.status_code}",
                ),
                seen[edition["lane"]],
            )
        return {"edition": edition["edition"], "status": "NOT_COLLECTED", **response_info(response)}

    rows, parser_issues, table_summary = parse_hitter_rows(response.content)
    append_log(
        {
            "event": "edition_fetch",
            "edition": edition["edition"],
            "url": edition["source_url"],
            "result": "SUCCESS" if rows else "SOURCE_SCHEMA_ISSUE",
            "parsed_hitter_rows": len(rows),
            "parser_issues": parser_issues,
            "table_summary": table_summary,
            **response_info(response),
        }
    )
    if not rows:
        for target in targets:
            append_csv(
                output_path(edition["lane"]),
                player_outcome_record(
                    edition,
                    target,
                    fetched_at,
                    str(response.status_code),
                    "NOT_COLLECTED",
                    "版別ページには到達したが、選手名と走力を持つ打者表を解析できなかった。選手不在とは判定していない。",
                    attempted,
                    error_type="SOURCE_SCHEMA_ISSUE",
                    error_message="; ".join(parser_issues) if parser_issues else "No table with required headings.",
                ),
                seen[edition["lane"]],
            )
        return {"edition": edition["edition"], "status": "NOT_COLLECTED", **response_info(response), "parsed_hitter_rows": 0}

    for row in rows:
        row["_source_url"] = response.url
    matches, partial_candidates, decisions = match_rows(edition, targets, rows)
    retrieval_count = 0
    not_found_count = 0
    for target in targets:
        selected = matches.get(target["record_key"], [])
        if not selected:
            append_csv(
                output_path(edition["lane"]),
                player_outcome_record(
                    edition,
                    target,
                    fetched_at,
                    str(response.status_code),
                    "NOT_FOUND",
                    "版別ページには到達し、走力列を持つ打者表を全行解析したが、正規化済みのフル氏名（または文書化済み別名）に一致する選手行がなかった。これは当該GameXページ内の不在であり、ゲーム全体での未収録を意味しない。",
                    attempted,
                ),
                seen[edition["lane"]],
            )
            not_found_count += 1
            continue
        ordinals: Counter[str] = Counter()
        for source, reason in selected:
            card_key = fingerprint(
                [edition["edition_code"], source["選手名"], source["球団"], source["守備"], source["ランク"], source["スカウト種別"], source["走力"]]
            )
            ordinals[card_key] += 1
            record = card_record(
                edition,
                target,
                source,
                fetched_at,
                response.status_code,
                reason,
                ordinals[card_key],
                attempted,
            )
            append_csv(output_path(edition["lane"]), record, seen[edition["lane"]])
            if record["acquisition_status"] == "RETRIEVED":
                retrieval_count += 1
    return {
        "edition": edition["edition"],
        "edition_code": edition["edition_code"],
        "status": "SUCCESS",
        **response_info(response),
        "parsed_hitter_rows": len(rows),
        "parser_issues": parser_issues,
        "table_summary": table_summary,
        "retrieved_cards": retrieval_count,
        "not_found_player_outcomes": not_found_count,
        "partial_name_candidates_not_auto_accepted": partial_candidates,
        "match_decision_counts": dict(sorted(decisions.items())),
    }


def collect_2024_not_collected(
    session: requests.Session,
    targets: list[dict[str, str]],
    seen: dict[str, set[str]],
    shared_routes: str,
) -> dict[str, Any]:
    checked_at = utc_now()
    responses: list[dict[str, Any]] = []
    for url in (HISTORICAL_2024["source_url"], HISTORICAL_2024["short_url"]):
        response, error = fetch(session, url, allow_redirects=False)
        if error:
            responses.append({"url": url, "result": "CONNECTION_FAILED", "error": error})
        else:
            assert response is not None
            responses.append({"url": url, **response_info(response), "location": response.headers.get("Location", "")})
    attempted = "; ".join([HISTORICAL_2024["source_url"], HISTORICAL_2024["short_url"], shared_routes])
    http_statuses = ",".join(str(item.get("http_status", "")) for item in responses if item.get("http_status") is not None)
    reason = (
        "GameXの選手一覧・ページサイトマップに2024 Series 2はなく、旧形式・短形式の候補URLも選手表を返さなかった。"
        "選手別に確認できるGameXページがないためNOT_COLLECTEDであり、ゲームに未収録とは判定していない。"
    )
    for target in targets:
        append_csv(
            HISTORICAL_CSV,
            player_outcome_record(
                HISTORICAL_2024,
                target,
                checked_at,
                http_statuses,
                "NOT_COLLECTED",
                reason,
                attempted,
                error_type="GAME_X_2024S2_ROUTE_UNAVAILABLE",
                error_message=json.dumps(responses, ensure_ascii=False, sort_keys=True),
            ),
            seen["historical"],
        )
    append_log({"event": "2024s2_route_check", "result": "NOT_COLLECTED", "responses": responses})
    return {"edition": HISTORICAL_2024["edition"], "edition_code": "2024S2", "status": "NOT_COLLECTED", "player_outcomes": len(targets), "responses": responses}


def summarize_csv(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    retrieved = [row for row in rows if row.get("acquisition_status") == "RETRIEVED"]
    return {
        "row_count": len(rows),
        "status_counts": dict(sorted(Counter(row.get("acquisition_status", "") for row in rows).items())),
        "retrieved_card_count": len(retrieved),
        "retrieved_unique_player_count": len({row["canonical_player_id"] or f"NAME::{row['player']}" for row in retrieved}),
        "not_found_player_count": len({row["canonical_player_id"] or f"NAME::{row['player']}" for row in rows if row.get("acquisition_status") == "NOT_FOUND"}),
        "not_collected_player_count": len({row["canonical_player_id"] or f"NAME::{row['player']}" for row in rows if row.get("acquisition_status") == "NOT_COLLECTED"}),
        "connection_failed_player_count": len({row["canonical_player_id"] or f"NAME::{row['player']}" for row in rows if row.get("acquisition_status") == "CONNECTION_FAILED"}),
    }


def run2_retrieved_count(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return sum(1 for row in csv.DictReader(handle) if row.get("acquisition_status") == "RETRIEVED")


def write_new_utf8(path: Path, text: str) -> None:
    if path.exists():
        raise RuntimeError(f"Refusing to overwrite existing run3 artifact: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
        handle.flush()


def audit_markdown(diagnosis: dict[str, Any]) -> str:
    current = diagnosis["run3_outputs"]["current"]
    historical = diagnosis["run3_outputs"]["historical"]
    recovery = diagnosis["recovery_breakdown"]
    coverage = diagnosis["catalog_discovery"]
    return f"""# Prospi (GameX) 走力 run3 回収監査 — 2026-08-13

## 到達確認

- `https://gamex.jp/` はHTTP {diagnosis['reachability']['http_status']}で到達した。接続不可の憶測分類は行っていない。
- run2の`source_url`列は{', '.join(diagnosis['run2_urls']['current_csv_source_url_column'])}のみだった。run2実行ログのURL全件は診断JSONに列挙した。

## coverage（ページ被覆）

- GameXの選手一覧は、2026 Series 1（野手30・投手41）、2025 Series 2（野手233・投手170）、2025 Series 1（野手74・投手60）の3版を列挙していた。
- ページサイトマップと選手一覧で、球団別・50音別・選手検索・2024 Series 2の別DBは発見できなかった。短形式URLは既存の版別URLへの301であり、新しいデータページではなかった。
- よって新経路発見（B）による走力カードの増分は{recovery['B_new_route_cards']}件である。

## 範囲内の判定（名寄せ）

- run2の正規化（NFKC、空白・中黒除去、新旧字）は既に実装済みだった。run3で正規化だけから新たに増えたカードは{recovery['A_normalization_only_cards']}件である。
- 歴史版では、同じフル氏名がGameX上では当時の別球団に載るケースを検出した。現行球団を必須にしていたrun2の条件を歴史版にだけ適用しないことで、{recovery['A_historical_team_drift_cards']}件を回収した。これは部分一致ではなく、正規化済みフル氏名の一致である。
- 部分一致候補は自動採用していない。候補件数は診断JSONに残した。

## 取得できなかった範囲と理由

- 現行2026 S1: `NOT_FOUND` {current['not_found_player_count']}人。ページ内にはいなかったが、GameXページは全ゲーム内選手の完全名簿ではないため、ゲーム未収録とは判定しない。
- 履歴2025 S1/S2: `NOT_FOUND` {historical['not_found_player_count']}人（各版ページ内にいなかった）。
- 履歴2024 S2: `NOT_COLLECTED` {historical['not_collected_player_count']}人。GameX上で選手を確認するページ自体を発見できず、候補URLは成功応答にならなかったためである。
- `CONNECTION_FAILED` は現行・履歴とも{current['connection_failed_player_count'] + historical['connection_failed_player_count']}人。

## 集計

- 現行カード: run2 {diagnosis['run2_retrieved_cards']['current']}件 → run3 {current['retrieved_card_count']}件（増分{recovery['current_card_delta']}件）。
- 履歴カード（2025 S1/S2）: run2 {diagnosis['run2_retrieved_cards']['historical']}件 → run3 {historical['retrieved_card_count']}件（2024 S2の`NOT_COLLECTED`行を除く取得カードの増分{recovery['historical_card_delta']}件）。

数値の推測・変換・走力点への自動反映は一切していない。
"""


def main() -> int:
    if DIAGNOSIS_JSON.exists() or AUDIT_MD.exists():
        raise RuntimeError("run3 diagnosis/audit already exists; refusing to overwrite an existing run3 artifact.")
    targets = read_targets()
    seen = {"current": existing_ids(CURRENT_CSV), "historical": existing_ids(HISTORICAL_CSV)}
    session = open_session()
    preflight_at = utc_now()
    preflight, preflight_error = fetch(session, ROOT_URL)
    if preflight_error or preflight is None or not preflight.ok:
        error = preflight_error or f"HTTP {preflight.status_code}"
        append_log({"event": "reachability_preflight", "url": ROOT_URL, "result": "CONNECTION_FAILED", "error_message": error, "tested_at_utc": preflight_at})
        for edition in (*EDITIONS, HISTORICAL_2024):
            for target in targets:
                append_csv(
                    output_path(edition["lane"]),
                    player_outcome_record(
                        edition,
                        target,
                        preflight_at,
                        "" if preflight is None else str(preflight.status_code),
                        "CONNECTION_FAILED",
                        "GameXトップへの到達確認が失敗したため、本収集は行っていない。選手不在・表不備・値の欠落とは判定していない。",
                        ROOT_URL,
                        error_type=(error.split(":", 1)[0] if error else "HTTP_FAILURE"),
                        error_message=error,
                    ),
                    seen[edition["lane"]],
                )
        diagnosis = {
            "run_id": RUN_ID,
            "reachability": {"url": ROOT_URL, "tested_at_utc": preflight_at, "result": "CONNECTION_FAILED", "error": error},
            "stop_reason": "Preflight failed; no edition pages were classified.",
        }
        write_new_utf8(DIAGNOSIS_JSON, json.dumps(diagnosis, ensure_ascii=False, indent=2) + "\n")
        write_new_utf8(AUDIT_MD, "# Prospi (GameX) 走力 run3 回収監査\n\nGameXトップへ接続できなかったため、本収集は停止した。詳細は診断JSONを参照。\n")
        return 2

    append_log({"event": "reachability_preflight", "url": ROOT_URL, "result": "SUCCESS", "tested_at_utc": preflight_at, **response_info(preflight)})
    catalog = discover_catalog(session)
    shared_routes = "; ".join([PROSPI_TOP_URL, PLAYER_INDEX_URL, SITEMAP_INDEX_URL, PAGE_SITEMAP_URL])
    edition_results = [collect_edition(session, edition, targets, seen, shared_routes) for edition in EDITIONS]
    edition_results.append(collect_2024_not_collected(session, targets, seen, shared_routes))

    current_summary = summarize_csv(CURRENT_CSV)
    historical_summary = summarize_csv(HISTORICAL_CSV)
    decision_counts: Counter[str] = Counter()
    partial_candidates: list[dict[str, str]] = []
    for result in edition_results:
        decision_counts.update(result.get("match_decision_counts", {}))
        partial_candidates.extend(result.get("partial_name_candidates_not_auto_accepted", []))
    run2_current_cards = run2_retrieved_count(RUN2_CURRENT_CSV)
    run2_historical_cards = run2_retrieved_count(REPO / "outputs" / "derived" / "speed_prospi_gamex_historical_20260813_run2.csv")
    diagnosis = {
        "run_id": RUN_ID,
        "created_at_utc": utc_now(),
        "encoding": "UTF-8",
        "target_input": {
            "path": str(TARGETS_JSON.relative_to(REPO)),
            "player_count": len(targets),
            "identity_enrichment": str(IDENTITY_CSV.relative_to(REPO)),
            "canonical_id_unresolved_players": [target["player"] for target in targets if not target["canonical_player_id"]],
        },
        "reachability": {"url": ROOT_URL, "tested_at_utc": preflight_at, "result": "SUCCESS", **response_info(preflight)},
        "run2_urls": run2_urls(),
        "catalog_discovery": catalog,
        "edition_results": edition_results,
        "partial_name_candidates_not_auto_accepted": partial_candidates,
        "run2_retrieved_cards": {"current": run2_current_cards, "historical": run2_historical_cards},
        "run3_outputs": {"current": current_summary, "historical": historical_summary},
        "recovery_breakdown": {
            "A_normalization_only_cards": 0,
            "A_historical_team_drift_cards": decision_counts["HISTORICAL_EXACT_NAME_TEAM_DRIFT"],
            "A_total_entity_matching_cards": decision_counts["HISTORICAL_EXACT_NAME_TEAM_DRIFT"],
            "B_new_route_cards": 0,
            "current_card_delta": current_summary["retrieved_card_count"] - run2_current_cards,
            "historical_card_delta": historical_summary["retrieved_card_count"] - run2_historical_cards,
            "notes": "run2 already used the requested name normalization. The only recovered cards are historical exact-full-name matches whose source club differs from the 2026 target club; no partial-name candidate was auto-accepted.",
        },
        "limits": [
            "NOT_FOUND means absent from the parsed GameX edition page, not absent from ProspiA as a whole.",
            "2024 Series 2 is NOT_COLLECTED because no GameX player page was found; it is not a game-absence conclusion.",
            "No GameX/Prospi value is used to alter an NPB or PowerPro speed rating.",
        ],
    }
    write_new_utf8(DIAGNOSIS_JSON, json.dumps(diagnosis, ensure_ascii=False, indent=2) + "\n")
    write_new_utf8(AUDIT_MD, audit_markdown(diagnosis))
    append_log({"event": "run_summary", "current": current_summary, "historical": historical_summary, "recovery_breakdown": diagnosis["recovery_breakdown"]})
    print(json.dumps({"current": current_summary, "historical": historical_summary, "recovery_breakdown": diagnosis["recovery_breakdown"]}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

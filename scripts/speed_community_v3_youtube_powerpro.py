# -*- coding: utf-8 -*-
"""SP-033 PowerPro official YouTube lane: fresh discovery and bounded recovery.

This run is intentionally isolated from the legacy community artifacts.  It starts at the
official channel upload listing, records the complete channel-side discovery boundary, fetches
per-video metadata for date verification, and then recovers public comments/replies for relevant
PowerPro videos with yt-dlp's unbounded request (`all,all,all,all,all`).  The extractor may still
return a platform/client-limited subset; that limitation is recorded per video and is never
treated as evidence that comments do not exist.

Only these new files are written:
  outputs/derived/speed_community_v3_powerpro_*

The script refuses to overwrite any existing output.  Legacy inventories are read only for
overlap QA and are not used as the discovery source.
"""

from __future__ import annotations

import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "derived"
RECOVERY_MODE = "--comments-only-recovery" in sys.argv
RUN_SUFFIX = "20260815_context_recovery" if RECOVERY_MODE else "20260815"
INVENTORY_PATH = OUT_DIR / f"speed_community_v3_powerpro_inventory_{RUN_SUFFIX}.csv"
RAW_PATH = OUT_DIR / f"speed_community_v3_powerpro_raw_{RUN_SUFFIX}.jsonl"
CANDIDATE_PATH = OUT_DIR / f"speed_community_v3_powerpro_candidates_{RUN_SUFFIX}.jsonl"
LOG_PATH = OUT_DIR / f"speed_community_v3_powerpro_collection_log_{RUN_SUFFIX}.jsonl"
QA_PATH = OUT_DIR / f"speed_community_v3_powerpro_qa_{RUN_SUFFIX}.json"
SOURCE_INVENTORY_PATH = OUT_DIR / "speed_community_v3_powerpro_inventory_20260815.csv"
SOURCE_QA_PATH = OUT_DIR / "speed_community_v3_powerpro_qa_20260815.json"

MASTER_PATH = OUT_DIR / "speed_2026_100_owner_review_master_20260813.csv"
OLD_INVENTORIES = (
    OUT_DIR / "speed_youtube_official_video_inventory_powerpro_20260813.csv",
    OUT_DIR / "speed_youtube_official_video_inventory_20260813.csv",
)

OFFICIAL_CHANNEL_ID = "UCWzEh28vj3mQKpe0fzVTOUw"
OFFICIAL_CHANNEL_URL = f"https://www.youtube.com/channel/{OFFICIAL_CHANNEL_ID}/videos"
OFFICIAL_CHANNEL_NAME = "パワプロ・プロスピ公式チャンネル"
DATE_FROM = "2024-01-01"
DATE_TO = "2026-08-14"
METADATA_WORKERS = 4
METADATA_TIMEOUT_SECONDS = 75
COMMENTS_TIMEOUT_SECONDS = 600

INVENTORY_FIELDS = (
    "inventory_id",
    "game",
    "video_id",
    "title",
    "published_at",
    "source_url",
    "official_channel_id",
    "official_channel_name",
    "discovery_method",
    "matched_terms",
    "relevant_reason",
    "relevant_for_comment_collection",
    "target_players_from_title_if_any",
    "comments_available",
    "comments_retrieved",
    "comment_total_reported",
    "retrieval_method",
    "retrieval_bound_or_missingness",
    "already_in_old_inventory",
    "date_status",
    "metadata_status",
    "description_context_short",
    "error",
)

SPEED_TERMS = (
    "走力", "足", "脚", "俊足", "鈍足", "速い", "早い", "遅い", "スピード",
    "加速", "一塁到達", "内野安打", "盗塁", "走塁", "足が速", "足が遅",
)
RATING_TERMS = (
    "能力", "能力値", "査定", "評価", "反映", "高すぎ", "低すぎ", "上げろ", "下げろ",
    "もっと高", "もっと低", "おかしい", "妥当", "不満", "盛られて", "過大", "過小",
    "過小評価", "昔", "全盛期", "衰え", "劣化", "怪我", "故障", "復帰",
)
GRADE_RE = re.compile(r"(?<![A-Za-z])([SABCDEFG])(?:ランク|評価|査定)?(?![A-Za-z])")
NUMBER_RE = re.compile(r"(?<!\d)(?:[0-9]|[1-9][0-9]|100)(?!\d)")
NUMERIC_SPEED_RE = re.compile(r"(?:走力|スピード|足|脚)[^\n]{0,16}?(?:[0-9]|[1-9][0-9]|100)")
POWERPRO_TERMS = ("パワプロ", "パワフルプロ野球", "実況パワフルプロ野球", "powerpro")
PROSPI_ONLY_TERMS = ("プロスピ", "プロ野球スピリッツ", "プロスピA", "プロスピセレクション")
ABILITY_TERMS = ("能力", "査定", "選手紹介", "選手データ", "能力公開", "アップデート", "update", "新能力", "現役選手", "OB", "対決")


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def compact(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "")).replace("　", "")


def strip_proxy_env() -> dict[str, str]:
    env = os.environ.copy()
    for key in (
        "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy",
        "GIT_HTTP_PROXY", "GIT_HTTPS_PROXY", "git_http_proxy", "git_https_proxy",
    ):
        env.pop(key, None)
    return env


def tool_version() -> str:
    result = subprocess.run(
        ["yt-dlp", "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace",
        env=strip_proxy_env(), timeout=30, check=False,
    )
    return (result.stdout or result.stderr).strip()


def run_command(command: list[str], timeout: int) -> tuple[int, str, str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        env=strip_proxy_env(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )
    return result.returncode, result.stdout or "", result.stderr or ""


def ensure_new_outputs() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in (INVENTORY_PATH, RAW_PATH, CANDIDATE_PATH, LOG_PATH, QA_PATH):
        if path.exists():
            raise RuntimeError(f"refusing to overwrite existing output: {path}")
    with INVENTORY_PATH.open("x", encoding="utf-8", newline="") as handle:
        csv.DictWriter(handle, fieldnames=INVENTORY_FIELDS).writeheader()
    for path in (RAW_PATH, CANDIDATE_PATH, LOG_PATH):
        path.open("x", encoding="utf-8", newline="").close()


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def append_log(event: str, **payload: Any) -> None:
    append_jsonl(LOG_PATH, {"event": event, "logged_at": now_utc(), **payload})


def append_inventory(row: dict[str, Any]) -> None:
    normalized = {field: row.get(field, "") for field in INVENTORY_FIELDS}
    with INVENTORY_PATH.open("a", encoding="utf-8", newline="") as handle:
        csv.DictWriter(handle, fieldnames=INVENTORY_FIELDS).writerow(normalized)
        handle.flush()
        os.fsync(handle.fileno())


def read_old_ids() -> set[str]:
    ids: set[str] = set()
    for path in OLD_INVENTORIES:
        if not path.exists():
            continue
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as handle:
                for row in csv.DictReader(handle):
                    video_id = (row.get("video_id") or row.get("video_id_or_post_id") or "").strip()
                    if video_id:
                        ids.add(video_id)
        except (OSError, csv.Error) as exc:
            append_log("OLD_INVENTORY_READ_ERROR", path=str(path.relative_to(ROOT)), error=str(exc))
    return ids


def load_master() -> list[dict[str, str]]:
    if not MASTER_PATH.exists():
        raise RuntimeError(f"current-100 master is missing: {MASTER_PATH}")
    with MASTER_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not {"player", "player_id"}.issubset(reader.fieldnames or set()):
            raise RuntimeError("current-100 master lacks player/player_id columns")
        return [
            {"player": (row.get("player") or "").strip(), "player_id": (row.get("player_id") or "").strip()}
            for row in reader
            if (row.get("player") or "").strip()
        ]


def load_channel_listing() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--flat-playlist",
        "--dump-single-json", OFFICIAL_CHANNEL_URL,
    ]
    code, stdout, stderr = run_command(command, timeout=300)
    if code != 0:
        raise RuntimeError(f"official channel listing failed: exit={code}; stderr={stderr[-3000:]}")
    try:
        listing = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"official channel listing returned invalid JSON: {exc}; stderr={stderr[-1000:]}") from exc
    if listing.get("channel_id") != OFFICIAL_CHANNEL_ID:
        raise RuntimeError(f"channel ID mismatch: {listing.get('channel_id')!r}")
    entries = [entry for entry in (listing.get("entries") or []) if isinstance(entry, dict) and entry.get("id")]
    return listing, entries, subprocess.list2cmdline(command)


def parse_json_print_line(stdout: str) -> dict[str, Any]:
    """Parse the compact JSON-field print used for metadata, preserving escaped descriptions."""
    for line in stdout.splitlines():
        if not line.strip() or not line.lstrip().startswith('"'):
            continue
        fields = line.rstrip("\r\n").split("\t", 6)
        if len(fields) < 5:
            continue
        try:
            parsed = [json.loads(field) for field in fields[:5]]
        except json.JSONDecodeError:
            continue
        return {
            "video_id": parsed[0] or "",
            "upload_date": parsed[1] or "",
            "title": parsed[2] or "",
            "description": parsed[3] or "",
            "channel_id": parsed[4] or "",
        }
    raise ValueError("no compact metadata record found")


def fetch_metadata(entry: dict[str, Any]) -> dict[str, Any]:
    video_id = str(entry["id"])
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--skip-download", "--no-playlist",
        "--print", "%(id)j\t%(upload_date)j\t%(title)j\t%(description)j\t%(channel_id)j",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    try:
        code, stdout, stderr = run_command(command, timeout=METADATA_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as exc:
        return {"video_id": video_id, "status": "TIMEOUT", "error": str(exc), "command": subprocess.list2cmdline(command)}
    if code != 0:
        return {
            "video_id": video_id,
            "status": "FAILED",
            "error": f"exit={code}; {stderr[-2000:]}",
            "command": subprocess.list2cmdline(command),
        }
    try:
        metadata = parse_json_print_line(stdout)
    except ValueError as exc:
        return {"video_id": video_id, "status": "PARSE_FAILED", "error": str(exc), "command": subprocess.list2cmdline(command)}
    metadata.update({"status": "OK", "error": "", "command": subprocess.list2cmdline(command)})
    if metadata.get("channel_id") != OFFICIAL_CHANNEL_ID:
        metadata["status"] = "WRONG_CHANNEL"
        metadata["error"] = f"channel_id={metadata.get('channel_id')!r}"
    return metadata


def iso_date(upload_date: str) -> str:
    if not re.fullmatch(r"\d{8}", upload_date or ""):
        return ""
    return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"


def in_scope_date(date_value: str) -> bool:
    return bool(date_value) and DATE_FROM <= date_value <= DATE_TO


def title_description_relevance(title: str, description: str) -> tuple[bool, str, list[str], str]:
    text = f"{title}\n{description}"
    normalized = text.lower()
    has_powerpro = any(term.lower() in normalized for term in POWERPRO_TERMS)
    has_prospi = any(term.lower() in normalized for term in PROSPI_ONLY_TERMS)
    ability_hits = [term for term in ABILITY_TERMS if term.lower() in normalized]
    matched = [term for term in (*POWERPRO_TERMS, *PROSPI_ONLY_TERMS, *ABILITY_TERMS) if term.lower() in normalized]
    if has_powerpro and ability_hits:
        return True, "POWERPRO_SIGNAL_WITH_ABILITY_OR_PLAYER_SERIES_CONTEXT", matched, "PowerPro term plus ability/player/update/series signal in title or description."
    if has_powerpro:
        return True, "POWERPRO_CURRENT_OR_EDITION_CONTEXT", matched, "PowerPro term present; retained as official PowerPro context even without an explicit ability term."
    if has_prospi and not has_powerpro:
        return False, "PROSPI_ONLY_EXCLUDED_FROM_SP033", matched, "Prospi-only video excluded from SP-033 PowerPro lane."
    return False, "NO_POWERPRO_SIGNAL", matched, "No PowerPro signal in the fetched title/description."


def target_players(text: str, players: list[dict[str, str]]) -> list[dict[str, str]]:
    compact_text = compact(text)
    hits = []
    for player in players:
        name = compact(player["player"])
        if name and name in compact_text:
            hits.append(player)
    return hits


def safe_short_description(description: str) -> str:
    return re.sub(r"\s+", " ", description or "").strip()[:600]


def inventory_row(
    entry: dict[str, Any], metadata: dict[str, Any], index: int, old_ids: set[str], players: list[dict[str, str]],
) -> tuple[dict[str, Any], bool]:
    video_id = str(entry.get("id") or metadata.get("video_id") or "")
    title = str(metadata.get("title") or entry.get("title") or "")
    description = str(metadata.get("description") or "")
    published_at = iso_date(str(metadata.get("upload_date") or ""))
    relevant, reason_code, matched, reason = title_description_relevance(title, description)
    date_status = "IN_SCOPE" if in_scope_date(published_at) else ("OUT_OF_SCOPE" if published_at else "UNVERIFIED")
    collect = bool(relevant and date_status == "IN_SCOPE")
    targets = target_players(title, players)
    row = {
        "inventory_id": f"PPV3-INV-{index:04d}",
        "game": "PowerPro" if relevant else "Official channel mixed catalog",
        "video_id": video_id,
        "title": title,
        "published_at": published_at,
        "source_url": f"https://www.youtube.com/watch?v={video_id}",
        "official_channel_id": OFFICIAL_CHANNEL_ID,
        "official_channel_name": OFFICIAL_CHANNEL_NAME,
        "discovery_method": "official_channel_flat_playlist_then_per_video_metadata",
        "matched_terms": json_text(matched),
        "relevant_reason": f"{reason_code}: {reason}",
        "relevant_for_comment_collection": str(collect).lower(),
        "target_players_from_title_if_any": json_text(targets),
        "comments_available": "",
        "comments_retrieved": "",
        "comment_total_reported": "",
        "retrieval_method": "",
        "retrieval_bound_or_missingness": "",
        "already_in_old_inventory": str(video_id in old_ids).lower(),
        "date_status": date_status,
        "metadata_status": metadata.get("status", ""),
        "description_context_short": safe_short_description(description),
        "error": metadata.get("error", ""),
    }
    return row, collect


def parse_reported_count(value: Any) -> int | None:
    if value in (None, ""):
        return None
    match = re.search(r"\d[\d,]*", str(value))
    if not match:
        return None
    return int(match.group(0).replace(",", ""))


def comment_root_ids(comments: list[dict[str, Any]]) -> dict[str, str]:
    parent_by_id = {str(c.get("id")): str(c.get("parent") or "root") for c in comments if c.get("id")}
    roots: dict[str, str] = {}
    for comment_id in parent_by_id:
        current = comment_id
        seen: set[str] = set()
        while current not in seen:
            seen.add(current)
            parent = parent_by_id.get(current, "root")
            if parent in ("", "root", None):
                roots[comment_id] = current
                break
            if parent not in parent_by_id:
                roots[comment_id] = parent
                break
            current = parent
        else:
            roots[comment_id] = comment_id
    return roots


def fetch_comments(video_id: str) -> dict[str, Any]:
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--skip-download", "--no-playlist",
        "--get-comments", "--dump-single-json",
        "--extractor-args", "youtube:comment_sort=new;max_comments=all,all,all,all,all",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    try:
        code, stdout, stderr = run_command(command, timeout=COMMENTS_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as exc:
        return {"status": "TIMEOUT", "error": str(exc), "comments": [], "command": subprocess.list2cmdline(command)}
    if code != 0:
        return {"status": "FAILED", "error": f"exit={code}; {stderr[-3000:]}", "comments": [], "command": subprocess.list2cmdline(command)}
    try:
        info = json.loads(stdout)
    except json.JSONDecodeError as exc:
        return {"status": "PARSE_FAILED", "error": f"{exc}; stderr={stderr[-1000:]}", "comments": [], "command": subprocess.list2cmdline(command)}
    comments = [comment for comment in (info.get("comments") or []) if isinstance(comment, dict) and comment.get("id")]
    return {
        "status": "OK",
        "error": "",
        "comments": comments,
        "info": info,
        "command": subprocess.list2cmdline(command),
    }


def context_and_identity(
    comment: dict[str, Any], comments_by_id: dict[str, dict[str, Any]], video: dict[str, Any], players: list[dict[str, str]],
) -> dict[str, Any]:
    parent_id = str(comment.get("parent") or "root")
    root_id = video["root_ids"].get(str(comment.get("id")), str(comment.get("id")))
    parent = comments_by_id.get(parent_id, {}) if parent_id != "root" else comments_by_id.get(root_id, {})
    root = comments_by_id.get(root_id, {})
    reply_texts = [str(c.get("text") or "") for c in video["comments"] if video["root_ids"].get(str(c.get("id"))) == root_id]
    context = "\n".join(
        part for part in (
            str(video.get("title") or ""),
            str(video.get("description_context_short") or ""),
            str(root.get("text") or ""),
            str(parent.get("text") or ""),
            str(comment.get("text") or ""),
            "\n".join(reply_texts[:20]),
        ) if part
    )
    full_hits = target_players(context, players)
    if len(full_hits) == 1:
        identity_method = "FULL_NAME_IN_THREAD_OR_VIDEO_CONTEXT"
        confidence = "HIGH"
        canonical = full_hits[0]
    elif len(full_hits) > 1:
        identity_method = "MULTIPLE_FULL_NAMES_IN_THREAD_OR_VIDEO_CONTEXT"
        confidence = "AMBIGUOUS"
        canonical = None
    else:
        surname_hits: list[dict[str, str]] = []
        by_surname: dict[str, list[dict[str, str]]] = {}
        for player in players:
            surname = re.split(r"[\s　・]", player["player"])[0]
            if len(surname) >= 2:
                by_surname.setdefault(surname, []).append(player)
        compact_context = compact(context)
        for surname, surname_players in by_surname.items():
            if len(surname_players) == 1 and surname in compact_context:
                surname_hits.extend(surname_players)
        if len(surname_hits) == 1:
            identity_method = "UNIQUE_SURNAME_IN_THREAD_OR_VIDEO_CONTEXT"
            confidence = "MEDIUM"
            canonical = surname_hits[0]
        else:
            identity_method = "UNMAPPED_OR_AMBIGUOUS_CONTEXT"
            confidence = "AMBIGUOUS" if surname_hits else "LOW"
            canonical = None
    return {
        "video_title": video.get("title", ""),
        "video_description_context_short": video.get("description_context_short", ""),
        "root_comment_id": root_id,
        "root_comment_text": root.get("text", ""),
        "immediate_parent_comment_id": parent_id,
        "immediate_parent_text": parent.get("text", "") if parent else "",
        "direct_thread_context": reply_texts[:20],
        "context_for_review": context[:8000],
        "identity_method": identity_method,
        "identity_confidence": confidence,
        "canonical_player_id": canonical["player_id"] if canonical else "",
        "player": canonical["player"] if canonical else "",
    }


def candidate_fields(text: str, context: str) -> tuple[list[str], list[str], list[str]]:
    combined = f"{text}\n{context}"
    matched = [term for term in (*SPEED_TERMS, *RATING_TERMS) if term in combined]
    grades = sorted(set(GRADE_RE.findall(combined)))
    numbers = sorted(set(NUMBER_RE.findall(text)))
    if NUMERIC_SPEED_RE.search(combined):
        matched.append("NUMERIC_SPEED_EXPRESSION")
    if grades:
        matched.append("EXPLICIT_GRADE")
    if numbers and any(term in combined for term in ("走力", "足", "脚", "スピード")):
        matched.append("EXPLICIT_NUMERIC_VALUE_IN_SPEED_CONTEXT")
    return sorted(set(matched)), grades, numbers


def unique_surname_hits(text: str, players: list[dict[str, str]]) -> list[dict[str, str]]:
    compact_text = compact(text)
    by_surname: dict[str, list[dict[str, str]]] = {}
    for player in players:
        surname = re.split(r"[\s　・]", player["player"])[0]
        if len(surname) >= 2:
            by_surname.setdefault(surname, []).append(player)
    return [members[0] for surname, members in by_surname.items() if len(members) == 1 and surname in compact_text]


def is_candidate(text: str, context: str, video_title: str, players: list[dict[str, str]] | None = None) -> bool:
    combined = f"{text}\n{context}\n{video_title}"
    has_speed = any(term in combined for term in SPEED_TERMS)
    has_rating = any(term in combined for term in RATING_TERMS) or bool(GRADE_RE.search(combined))
    has_explicit_value = bool(NUMERIC_SPEED_RE.search(combined)) or bool(GRADE_RE.search(text) and any(term in combined for term in SPEED_TERMS))
    has_player_context = False
    if players:
        has_player_context = bool(target_players(combined, players) or unique_surname_hits(combined, players))
    return (has_speed and (has_rating or has_player_context)) or has_explicit_value


def make_raw_video(video: dict[str, Any], retrieval: dict[str, Any]) -> dict[str, Any]:
    info = retrieval.get("info") or {}
    reported = info.get("comment_count")
    numeric_reported = parse_reported_count(reported)
    retrieved = len(video["comments"])
    remainder = max(numeric_reported - retrieved, 0) if numeric_reported is not None else None
    return {
        "record_type": "video_metadata",
        "record_id": f"PPV3-VIDEO-{video['video_id']}",
        "platform": "YouTube",
        "game": "PowerPro",
        "source_type": "official_youtube_video_metadata",
        "source_url": video["source_url"],
        "official_channel_id": OFFICIAL_CHANNEL_ID,
        "video_id": video["video_id"],
        "video_title": video.get("title", ""),
        "published_at": video.get("published_at", ""),
        "video_description_context_short": video.get("description_context_short", ""),
        "comments_available": bool(retrieval.get("status") == "OK"),
        "comments_retrieved": retrieved,
        "comment_total_reported": reported,
        "requested_comment_bound": "all,all,all,all,all",
        "comment_sort": "new",
        "retrieval_method": "yt-dlp --get-comments --dump-single-json",
        "retrieval_bound_or_missingness": "YTDLP_ALL_REQUESTED; completeness not independently verified; platform/client pagination may remain",
        "unresolved_remainder_lower_bound": remainder,
        "retrieval_status": retrieval.get("status"),
        "error": retrieval.get("error", ""),
        "collected_at": now_utc(),
    }


def process_video(row: dict[str, Any]) -> dict[str, Any]:
    retrieval = fetch_comments(row["video_id"])
    comments = retrieval.get("comments") or []
    root_ids = comment_root_ids(comments)
    video = {
        **row,
        "video_id": row["video_id"],
        "source_url": row["source_url"],
        "comments": comments,
        "root_ids": root_ids,
    }
    append_jsonl(RAW_PATH, make_raw_video(video, retrieval))
    comments_by_id = {str(comment.get("id")): comment for comment in comments if comment.get("id")}
    candidate_count = 0
    for comment in comments:
        text = str(comment.get("text") or "")
        contextual = context_and_identity(comment, comments_by_id, video, row["players"])
        matched, grades, numbers = candidate_fields(text, contextual["context_for_review"])
        comment_id = str(comment.get("id"))
        parent_id = str(comment.get("parent") or "root")
        root_id = root_ids.get(comment_id, comment_id)
        common_record = {
            "record_type": "comment",
            "record_id": f"PPV3-RAW-{row['video_id']}-{comment_id}",
            "platform": "YouTube",
            "game": "PowerPro",
            "source_type": "official_youtube_comment_or_reply",
            "source_url": f"{row['source_url']}&lc={comment_id}",
            "official_channel_id": OFFICIAL_CHANNEL_ID,
            "video_id": row["video_id"],
            "video_title": row.get("title", ""),
            "published_at": row.get("published_at", ""),
            "video_description_context_short": row.get("description_context_short", ""),
            "comment_id": comment_id,
            "parent_comment_id": parent_id,
            "root_thread_id": root_id,
            "author": comment.get("author", ""),
            "author_id": comment.get("author_id", ""),
            "comment_published_at": comment.get("timestamp", ""),
            "text": text,
            "likes": comment.get("like_count"),
            "reply_count": comment.get("reply_count"),
            "root_comment_text": contextual["root_comment_text"],
            "immediate_parent_text": contextual["immediate_parent_text"],
            "direct_thread_context": contextual["direct_thread_context"],
            "context_for_review": contextual["context_for_review"],
            "identity_method": contextual["identity_method"],
            "identity_confidence": contextual["identity_confidence"],
            "canonical_player_id": contextual["canonical_player_id"],
            "player": contextual["player"],
            "independence_group": f"youtube:{row['video_id']}:{root_id}",
            "event_id": f"youtube:{row['video_id']}:{root_id}",
            "reaction_volume_same_root_thread": sum(1 for c in comments if root_ids.get(str(c.get("id"))) == root_id),
            "retrieval_bound_or_missingness": "YTDLP_ALL_REQUESTED; completeness not independently verified",
            "collected_at": now_utc(),
        }
        append_jsonl(RAW_PATH, common_record)
        if not is_candidate(text, contextual["context_for_review"], row.get("title", ""), row["players"]):
            continue
        candidate_count += 1
        candidate = {
            **common_record,
            "record_type": "candidate",
            "record_id": f"PPV3-CAND-{row['video_id']}-{comment_id}",
            "source_type": "official_youtube_comment_recall_first_candidate",
            "matched_terms": matched,
            "explicit_grades": grades,
            "explicit_numbers_in_comment": numbers,
            "semantic_review_status": "PENDING_CONTEXTUAL_REVIEW",
            "candidate_reason": "recall-first speed/rating or explicit grade/value signal in video-title/thread context; not an acceptance decision",
        }
        append_jsonl(CANDIDATE_PATH, candidate)
    reported = (retrieval.get("info") or {}).get("comment_count")
    return {
        "video_id": row["video_id"],
        "status": retrieval.get("status"),
        "comments_retrieved": len(comments),
        "comment_total_reported": reported,
        "candidate_count": candidate_count,
        "root_thread_count": len(set(root_ids.values())),
        "retrieval_command": retrieval.get("command", ""),
        "error": retrieval.get("error", ""),
    }


def regression_tests(players: list[dict[str, str]]) -> dict[str, Any]:
    cases = {
        "A": "ビシエドってそんな足速いのか。他にもいろいろ能力値がおかしい。",
        "B": "大谷走力Aだろ",
        "C": "これパワーAはもちろん、走力Bにも不満あったんだよね笑",
        "D": "予想 ミート82パワー90走力84",
        "E": "大谷走力Aだろ",
        "F": "足が速い山川",
        "G": "清原 ミートB79 パワー82 走力B74 これくらいはやってくれよ？",
    }
    results: dict[str, Any] = {}
    for label, text in cases.items():
        context = text
        matched, grades, numbers = candidate_fields(text, context)
        mapped = target_players(context, players)
        if not mapped:
            mapped = unique_surname_hits(context, players)
        candidate = is_candidate(text, context, "", players)
        results[label] = {
            "text": text,
            "candidate_retained": candidate,
            "matched_terms": matched,
            "explicit_grades": grades,
            "explicit_numbers": numbers,
            "current_100_mapping": [{"player": p["player"], "player_id": p["player_id"]} for p in mapped],
            "identity_note": "Current-100 mapping is only reported when the live master contains the name; otherwise the candidate is retained without inventing a player ID.",
        }
    return results


def load_recovery_targets(players: list[dict[str, str]]) -> list[dict[str, Any]]:
    if not SOURCE_INVENTORY_PATH.exists():
        raise RuntimeError(f"fresh discovery inventory is missing: {SOURCE_INVENTORY_PATH}")
    targets: list[dict[str, Any]] = []
    with SOURCE_INVENTORY_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("relevant_for_comment_collection") != "true":
                continue
            if row.get("date_status") != "IN_SCOPE":
                continue
            row["players"] = players
            targets.append(row)
    if not targets:
        raise RuntimeError("fresh discovery inventory contains no in-scope PowerPro recovery targets")
    return targets


def main() -> int:
    if shutil.which("yt-dlp") is None:
        raise RuntimeError("yt-dlp is not available on PATH")
    players = load_master()
    old_ids = read_old_ids()
    ensure_new_outputs()
    started_at = now_utc()
    append_log(
        "RUN_STARTED",
        scope="SP-033 PowerPro official YouTube only",
        run_mode="comments_only_recovery_from_fresh_inventory" if RECOVERY_MODE else "fresh_channel_discovery_and_comments",
        discovery_source=OFFICIAL_CHANNEL_URL,
        official_channel_id=OFFICIAL_CHANNEL_ID,
        official_channel_name=OFFICIAL_CHANNEL_NAME,
        date_from=DATE_FROM,
        date_to=DATE_TO,
        existing_inventory_read_only=[str(path.relative_to(ROOT)) for path in OLD_INVENTORIES if path.exists()],
        old_inventory_id_count=len(old_ids),
        yt_dlp_version=tool_version(),
        proxy_handling="all proxy environment variables removed for yt-dlp subprocesses",
        output_boundary=[str(path.relative_to(ROOT)) for path in (INVENTORY_PATH, RAW_PATH, CANDIDATE_PATH, LOG_PATH, QA_PATH)],
        forbidden_scope=["X", "SP-035", "registry", "common final", "docs audit", "commit", "push"],
    )
    source_qa: dict[str, Any] | None = None
    if RECOVERY_MODE:
        if SOURCE_QA_PATH.exists():
            source_qa = json.loads(SOURCE_QA_PATH.read_text(encoding="utf-8"))
        collection_targets = load_recovery_targets(players)
        inventory_rows = list(collection_targets)
        entries = [{"id": row["video_id"]} for row in collection_targets]
        append_log(
            "RECOVERY_SOURCE_BOUNDARY",
            source_inventory=str(SOURCE_INVENTORY_PATH.relative_to(ROOT)),
            source_qa=str(SOURCE_QA_PATH.relative_to(ROOT)) if SOURCE_QA_PATH.exists() else "",
            fresh_discovery_was_already_completed=True,
            recovery_target_count=len(collection_targets),
            note="This pass only augments the already completed fresh channel discovery with full raw comment/reply records; it does not replace discovery with legacy IDs.",
        )
    else:
        listing, entries, discovery_command = load_channel_listing()
        append_log(
            "CHANNEL_LISTING_DISCOVERED",
            discovery_method="official_channel_flat_playlist",
            discovery_command=discovery_command,
            channel_id=listing.get("channel_id"),
            channel_title=listing.get("title"),
            channel_url=OFFICIAL_CHANNEL_URL,
            flat_entry_count=len(entries),
            note="The official channel listing is the discovery source; old inventories are used only for overlap QA.",
        )

        metadata_results: dict[str, dict[str, Any]] = {}
        with ThreadPoolExecutor(max_workers=METADATA_WORKERS) as executor:
            future_map = {executor.submit(fetch_metadata, entry): entry for entry in entries}
            for completed in as_completed(future_map):
                entry = future_map[completed]
                video_id = str(entry.get("id"))
                try:
                    metadata_results[video_id] = completed.result()
                except Exception as exc:  # keep the per-video boundary explicit
                    metadata_results[video_id] = {"video_id": video_id, "status": "WORKER_FAILED", "error": f"{type(exc).__name__}: {exc}"}
                append_log("VIDEO_METADATA_BOUNDARY", video_id=video_id, metadata=metadata_results[video_id])

        inventory_rows = []
        collection_targets = []
        for index, entry in enumerate(entries, start=1):
            video_id = str(entry.get("id"))
            metadata = metadata_results.get(video_id, {"video_id": video_id, "status": "NOT_ATTEMPTED", "error": "not returned by metadata worker"})
            row, collect = inventory_row(entry, metadata, index, old_ids, players)
            row["players"] = players
            inventory_rows.append(row)
            if collect:
                collection_targets.append(row)
            else:
                append_inventory({key: value for key, value in row.items() if key in INVENTORY_FIELDS})
                append_log(
                    "VIDEO_NOT_COMMENT_TARGET",
                    video_id=video_id,
                    title=row["title"],
                    published_at=row["published_at"],
                    date_status=row["date_status"],
                    relevant_reason=row["relevant_reason"],
                    already_in_old_inventory=row["already_in_old_inventory"],
                )

        append_log(
            "DISCOVERY_FILTER_COMPLETE",
            flat_entry_count=len(entries),
            metadata_ok=sum(1 for row in inventory_rows if row["metadata_status"] == "OK"),
            metadata_failed=sum(1 for row in inventory_rows if row["metadata_status"] != "OK"),
            in_scope_entry_count=sum(1 for row in inventory_rows if row["date_status"] == "IN_SCOPE"),
            relevant_powerpro_video_count=len(collection_targets),
            old_inventory_id_count=len(old_ids),
            fresh_discovered_in_scope_ids=sum(1 for row in collection_targets if row["video_id"] not in old_ids),
            overlap_in_scope_ids=sum(1 for row in collection_targets if row["video_id"] in old_ids),
            unresolved_date_count=sum(1 for row in inventory_rows if row["date_status"] == "UNVERIFIED"),
        )

    comment_results: list[dict[str, Any]] = []
    for target in collection_targets:
        append_log(
            "COMMENTS_ATTEMPT_STARTED",
            video_id=target["video_id"],
            title=target["title"],
            source_url=target["source_url"],
            official_channel_id=OFFICIAL_CHANNEL_ID,
            requested_comment_bound="all,all,all,all,all",
            comment_sort="new",
        )
        result = process_video(target)
        comment_results.append(result)
        target["comments_available"] = str(result["status"] == "OK").lower()
        target["comments_retrieved"] = result["comments_retrieved"]
        target["comment_total_reported"] = result["comment_total_reported"]
        target["retrieval_method"] = "yt-dlp --get-comments --dump-single-json"
        target["retrieval_bound_or_missingness"] = "YTDLP_ALL_REQUESTED; completeness not independently verified; platform/client pagination may remain"
        target["error"] = result["error"]
        append_inventory({key: value for key, value in target.items() if key in INVENTORY_FIELDS})
        append_log("COMMENTS_ATTEMPT_FINISHED", **result, title=target["title"], source_url=target["source_url"])

    qa = {
        "generated_at": now_utc(),
        "started_at": started_at,
        "scope": "SP-033 PowerPro official YouTube lane only",
        "excluded_scope": ["SP-035/X new collection, reclassification, status changes", "Prospi lane", "registry", "common final", "commit", "push"],
        "discovery": {
            "official_channel_id": OFFICIAL_CHANNEL_ID,
            "official_channel_url": OFFICIAL_CHANNEL_URL,
            "official_channel_name": OFFICIAL_CHANNEL_NAME,
            "method": "comments_only_recovery_from_fresh_inventory" if RECOVERY_MODE else "official_channel_flat_playlist_then_per_video_metadata",
            "date_from": DATE_FROM,
            "date_to": DATE_TO,
            "official_channel_entries_scanned": source_qa.get("discovery", {}).get("official_channel_entries_scanned", len(entries)) if source_qa else len(entries),
            "metadata_ok": source_qa.get("discovery", {}).get("metadata_ok", sum(1 for row in inventory_rows if row["metadata_status"] == "OK")) if source_qa else sum(1 for row in inventory_rows if row["metadata_status"] == "OK"),
            "metadata_failed_or_unverified": source_qa.get("discovery", {}).get("metadata_failed_or_unverified", sum(1 for row in inventory_rows if row["metadata_status"] != "OK")) if source_qa else sum(1 for row in inventory_rows if row["metadata_status"] != "OK"),
            "in_scope_entries": source_qa.get("discovery", {}).get("in_scope_entries", sum(1 for row in inventory_rows if row["date_status"] == "IN_SCOPE")) if source_qa else sum(1 for row in inventory_rows if row["date_status"] == "IN_SCOPE"),
            "relevant_powerpro_videos": len(collection_targets),
            "old_inventory_ids_read_only": len(old_ids),
            "fresh_discovered_relevant_ids": source_qa.get("discovery", {}).get("fresh_discovered_relevant_ids", sum(1 for row in collection_targets if row["video_id"] not in old_ids)) if source_qa else sum(1 for row in collection_targets if row["video_id"] not in old_ids),
            "overlap_relevant_ids": source_qa.get("discovery", {}).get("overlap_relevant_ids", sum(1 for row in collection_targets if row["video_id"] in old_ids)) if source_qa else sum(1 for row in collection_targets if row["video_id"] in old_ids),
            "unresolved_date_count": source_qa.get("discovery", {}).get("unresolved_date_count", sum(1 for row in inventory_rows if row["date_status"] == "UNVERIFIED")) if source_qa else sum(1 for row in inventory_rows if row["date_status"] == "UNVERIFIED"),
            "fresh_discovery_source_inventory": str(SOURCE_INVENTORY_PATH.relative_to(ROOT)) if RECOVERY_MODE else "",
        },
        "collection": {
            "videos_attempted": len(comment_results),
            "videos_ok": sum(1 for result in comment_results if result["status"] == "OK"),
            "videos_failed_or_bounded": sum(1 for result in comment_results if result["status"] != "OK"),
            "comments_replies_retrieved": sum(int(result["comments_retrieved"]) for result in comment_results),
            "root_thread_count": sum(int(result["root_thread_count"]) for result in comment_results),
            "semantic_review_candidates": sum(int(result["candidate_count"]) for result in comment_results),
            "requested_bound": "all,all,all,all,all",
            "sort": "new",
            "completeness_statement": "yt-dlp all-requested is not proof of platform-exhaustive retrieval; per-video reported/retrieved counts and unresolved lower bounds are preserved in raw video records and log.",
            "per_video": comment_results,
        },
        "regression_cases_A_to_G": regression_tests(players),
        "output_files": [str(path.relative_to(ROOT)) for path in (INVENTORY_PATH, RAW_PATH, CANDIDATE_PATH, LOG_PATH, QA_PATH)],
        "limitations": [
            "The channel is a mixed PowerPro/Prospi official channel; Prospi-only videos are retained in the inventory but excluded from SP-033 comment collection.",
            "Metadata and comments are public extractor results, not YouTube Data API exhaustive exports.",
            "Current-100 player IDs are joined only from the live master; regression examples outside that master remain candidates without invented IDs.",
            "This script does not perform semantic acceptance; candidates preserve thread/title context for contextual review.",
        ],
    }
    with QA_PATH.open("x", encoding="utf-8") as handle:
        json.dump(qa, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    append_log("RUN_FINISHED", finished_at=qa["generated_at"], qa_summary=qa["discovery"], collection_summary=qa["collection"])
    print(json.dumps({
        "inventory_rows": len(inventory_rows),
        "official_channel_entries_scanned": len(entries),
        "in_scope_entries": qa["discovery"]["in_scope_entries"],
        "relevant_powerpro_videos": qa["discovery"]["relevant_powerpro_videos"],
        "fresh_discovered_relevant_ids": qa["discovery"]["fresh_discovered_relevant_ids"],
        "comments_replies_retrieved": qa["collection"]["comments_replies_retrieved"],
        "semantic_review_candidates": qa["collection"]["semantic_review_candidates"],
        "output_files": qa["output_files"],
    }, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise

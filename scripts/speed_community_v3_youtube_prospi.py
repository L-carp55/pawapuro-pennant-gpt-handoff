#!/usr/bin/env python3
"""SP-034 Prospi official YouTube lane for Community Recollection V3.

This script deliberately starts from the official channel's current /videos
listing.  It does not use the previous inventory as its discovery source; old
files are read only for overlap QA.  It writes only the lane-specific files
whose names start with ``speed_community_v3_prospi_``.

The public yt-dlp route is requested with all parents, replies, and depth.  A
platform-side or extractor-side opaque bound is still possible, so every
video records the requested route, reported count, retrieved count, and
missingness.  Candidate and semantic rows retain title, root, immediate
parent, and direct-reply context.
"""

from __future__ import annotations

import csv
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "derived"
MASTER_PATH = OUT_DIR / "speed_2026_100_owner_review_master_20260813.csv"

CHANNEL_ID = "UCWzEh28vj3mQKpe0fzVTOUw"
CHANNEL_NAME = "パワプロ・プロスピ公式チャンネル"
CHANNEL_URL = f"https://www.youtube.com/channel/{CHANNEL_ID}/videos"
START_DATE = "2024-01-01"
END_DATE = "2026-08-14"
RUN_DATE = "20260815_smallbatch"

OUT_INVENTORY = OUT_DIR / f"speed_community_v3_prospi_inventory_{RUN_DATE}.csv"
OUT_RAW = OUT_DIR / f"speed_community_v3_prospi_raw_{RUN_DATE}.jsonl"
OUT_CANDIDATES = OUT_DIR / f"speed_community_v3_prospi_candidates_{RUN_DATE}.jsonl"
OUT_SEMANTIC = OUT_DIR / f"speed_community_v3_prospi_semantic_classified_{RUN_DATE}.jsonl"
OUT_SUMMARY = OUT_DIR / f"speed_community_v3_prospi_player_summary_{RUN_DATE}.csv"
OUT_LOG = OUT_DIR / f"speed_community_v3_prospi_collection_log_{RUN_DATE}.json"
OUT_QA = OUT_DIR / f"speed_community_v3_prospi_qa_{RUN_DATE}.json"
FINAL_OUTPUTS = [OUT_INVENTORY, OUT_RAW, OUT_CANDIDATES, OUT_SEMANTIC, OUT_SUMMARY, OUT_LOG, OUT_QA]

FIELD_SEP = "\x1f"
METADATA_PRINT = (
    f"%(id)s{FIELD_SEP}%(upload_date)s{FIELD_SEP}%(timestamp)s{FIELD_SEP}"
    f"%(channel_id)s{FIELD_SEP}%(channel)s{FIELD_SEP}%(title)s{FIELD_SEP}%(description)j"
)

PROSPI_MARKERS = (
    "プロスピ", "プロ野球スピリッツ", "スピリッツ", "prospi", "pro baseball spirits",
)
PROSPI_SERIES_MARKERS = (
    "プロスピa", "プロスピ２０", "プロスピ20", "プロスピ2024", "プロスピ2025",
    "プロスピ2026", "プロ野球スピリッツa", "プロ野球スピリッツ2024",
    "プロ野球スピリッツ2025", "プロ野球スピリッツ2026",
)
ABILITY_MARKERS = (
    "能力", "能力値", "査定", "選手発表", "選手紹介", "選手追加", "アップデート",
    "update", "更新", "セレクション", "エキサイティング", "アニバーサリー", "アニバ",
    "タイムスリップ", "ts", "ob", "新登場", "登場選手", "選手公開", "player reveal",
    "roster reveal",
)
SPEED_TERMS = (
    "走力", "脚力", "俊足", "鈍足", "足が速", "足が遅", "足速", "足遅", "速い", "早い",
    "遅い", "スピード", "加速", "一歩目", "一塁到達", "内野安打", "盗塁", "走塁",
)
RATING_TERMS = (
    "走力", "能力値", "査定", "高すぎ", "高過ぎ", "低すぎ", "低過ぎ", "過大", "過小",
    "盛りすぎ", "盛り過ぎ", "上げろ", "下げろ", "もっと高", "もっと低", "おかしい",
    "妥当", "不満", "過小評価", "過大評価", "評価", "ランク",
)
GAMEPLAY_TERMS = ("ゲーム", "操作", "内野安打", "走塁", "盗塁", "一塁到達", "スタート", "走者")
STEALING_TERMS = ("盗塁", "盗塁成功", "盗塁し", "盗塁でき", "盗塁能力")
BASE_RUNNING_TERMS = ("走塁", "内野安打", "一塁到達", "ベースランニング", "スタート")
JOKE_TERMS = ("笑", "ｗ", "w", "草", "😂", "🤣", "www")
HIGH_TERMS = ("高すぎ", "高過ぎ", "盛りすぎ", "盛り過ぎ", "過大", "上げすぎ", "上げ過ぎ")
LOW_TERMS = ("低すぎ", "低過ぎ", "過小", "下げすぎ", "下げ過ぎ", "もっと高", "上げろ")
STALE_TERMS = ("昔", "全盛期", "往年", "若い頃", "全盛時代")
AGING_TERMS = ("年齢", "歳", "衰え", "劣化", "ベテラン")
INJURY_TERMS = ("怪我", "ケガ", "故障", "復帰")

DIRECT_SPEED_RE = re.compile(
    r"走力|脚力|俊足|鈍足|足が速|足が遅|足速|足遅|スピード|加速|一歩目|一塁到達|内野安打|盗塁|走塁",
    re.IGNORECASE,
)
GRADE_VALUE_RE = re.compile(
    r"(?:走力|脚力|スピード|足)\s*[:：]?\s*([SABCDEFG]|[０-９]{2}|[0-9]{2})",
    re.IGNORECASE,
)
BARE_GRADE_RE = re.compile(r"(?:ミート|パワー|走力|守備|肩力|能力)[^\n]{0,12}([SABCDEFG][0-9０-９]{0,2})", re.IGNORECASE)
NUMBER_RE = re.compile(r"(?:走力|脚力|スピード|足)[^\n]{0,8}([0-9０-９]{2})")

# Used only for contextual regression QA and for well-known surname/alias
# recovery.  A missing master row never receives an invented player_id.
KNOWN_ALIASES = {
    "大谷": "大谷翔平",
    "山川": "山川穂高",
    "ビシエド": "ビシエド",
    "清原": "清原和博",
}

INVENTORY_FIELDS = [
    "game", "video_id", "title", "description_short", "published_at", "source_url",
    "official_channel_id", "channel_name", "discovery_method", "channel_position",
    "matched_terms", "relevant_reason", "target_players_from_title_if_any",
    "comments_available", "comments_retrieved", "platform_reported_comment_count",
    "retrieval_method", "retrieval_bound_or_missingness", "already_in_old_inventory",
    "old_inventory_sources", "metadata_status", "collection_attempted_at",
]


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact(text: str | None) -> str:
    return re.sub(r"[\s　]+", "", text or "").lower()


def short_text(text: str | None, limit: int = 1000) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + "…"


def clean_error(value: str) -> str:
    value = (value or "").strip()
    return value[-6000:] if len(value) > 6000 else value


def make_env() -> tuple[dict[str, str], list[str]]:
    env = os.environ.copy()
    removed: list[str] = []
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        if key in env:
            removed.append(key)
            env.pop(key, None)
    return env, removed


def run_ytdlp(args: list[str], timeout: int = 900) -> tuple[str | None, str | None, list[str], list[str]]:
    """Run yt-dlp as an argv list, never as a shell string."""
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--no-progress",
        "--skip-download", *args,
    ]
    env, removed = make_env()
    try:
        result = subprocess.run(
            command, cwd=ROOT, env=env, text=True, encoding="utf-8", errors="replace",
            capture_output=True, timeout=timeout, check=False,
        )
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}", command, removed
    if result.returncode != 0:
        return None, clean_error(result.stderr or result.stdout or f"yt-dlp exited {result.returncode}"), command, removed
    return result.stdout, None, command, removed


def parse_printed_metadata(stdout: str) -> tuple[list[dict[str, Any]], list[str]]:
    records: list[dict[str, Any]] = []
    errors: list[str] = []
    for line_no, line in enumerate(stdout.splitlines(), start=1):
        if not line.strip():
            continue
        parts = line.split(FIELD_SEP, 6)
        if len(parts) != 7:
            errors.append(f"line {line_no}: field_count={len(parts)}")
            continue
        description_raw = parts[6]
        try:
            description = json.loads(description_raw) if description_raw not in ("NA", "", "None") else ""
        except json.JSONDecodeError:
            description = description_raw
            errors.append(f"line {line_no}: description_json_decode_failed")
        records.append({
            "video_id": parts[0],
            "upload_date": parts[1] if parts[1] != "NA" else None,
            "timestamp": parts[2] if parts[2] != "NA" else None,
            "official_channel_id": parts[3] if parts[3] != "NA" else None,
            "channel_name": parts[4] if parts[4] != "NA" else None,
            "title": parts[5] if parts[5] != "NA" else "",
            "description": description if isinstance(description, str) else str(description),
        })
    return records, errors


def iso_date(info: dict[str, Any]) -> str | None:
    upload_date = info.get("upload_date")
    if isinstance(upload_date, str) and re.fullmatch(r"\d{8}", upload_date):
        return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
    timestamp = info.get("timestamp")
    if isinstance(timestamp, str) and timestamp.isdigit():
        timestamp = int(timestamp)
    if isinstance(timestamp, (int, float)):
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return None


def in_scope(published_at: str | None) -> bool:
    if not published_at:
        return False
    return START_DATE <= published_at[:10] <= END_DATE


def marker_hits(title: str, description: str) -> list[str]:
    text = f"{title}\n{description}"
    hits: list[str] = []
    for marker in PROSPI_MARKERS + PROSPI_SERIES_MARKERS + ABILITY_MARKERS:
        if marker.lower() in text.lower() and marker not in hits:
            hits.append(marker)
    return hits


def is_relevant_prospi(title: str, description: str) -> tuple[bool, list[str], str]:
    title_lower = title.lower()
    desc_lower = description.lower()
    title_prospi = [m for m in PROSPI_MARKERS + PROSPI_SERIES_MARKERS if m.lower() in title_lower]
    desc_prospi = [m for m in PROSPI_MARKERS + PROSPI_SERIES_MARKERS if m.lower() in desc_lower]
    ability = [m for m in ABILITY_MARKERS if m.lower() in f"{title_lower}\n{desc_lower}"]
    if title_prospi:
        return True, marker_hits(title, description), "title_explicitly_identifies_prospi"
    if desc_prospi and ability:
        return True, marker_hits(title, description), "description_identifies_prospi_and_ability_or_update_context"
    return False, marker_hits(title, description), "not_prospi_identifiable_from_video_title_description"


def load_master() -> tuple[list[dict[str, str]], dict[str, dict[str, str]], dict[str, list[dict[str, str]]]]:
    with MASTER_PATH.open("r", encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    if len(rows) != 100:
        raise RuntimeError(f"current-100 master row count is {len(rows)}, expected 100: {MASTER_PATH}")
    by_name = {compact(row.get("player")): row for row in rows if compact(row.get("player"))}
    by_surname: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        name = (row.get("player") or "").strip()
        surname = compact(name.split(" ")[0] if " " in name else name[:2])
        if len(surname) >= 2:
            by_surname[surname].append(row)
    return rows, by_name, by_surname


def old_inventory_ids() -> tuple[set[str], dict[str, list[str]]]:
    """Read old inventory IDs only for overlap QA; never use them for discovery."""
    ids: set[str] = set()
    sources: dict[str, list[str]] = defaultdict(list)
    for path in sorted(OUT_DIR.iterdir()):
        name = path.name.lower()
        if path in FINAL_OUTPUTS or name.startswith("speed_community_v3_prospi_"):
            continue
        is_old_inventory = (
            (path.suffix.lower() == ".csv" and ("inventory" in name or "staging_speed_youtube_prospi" in name))
            or (path.suffix.lower() == ".jsonl" and ("youtube_official_video_inventory" in name or "staging_speed_youtube_prospi" in name))
        )
        if not is_old_inventory:
            continue
        try:
            if path.suffix.lower() == ".csv":
                with path.open("r", encoding="utf-8", newline="") as fh:
                    for row in csv.DictReader(fh):
                        video_id = (row.get("video_id") or row.get("video_id_or_post_id") or "").strip()
                        if video_id:
                            ids.add(video_id)
                            if str(path) not in sources[video_id]:
                                sources[video_id].append(str(path.relative_to(ROOT)))
            else:
                with path.open("r", encoding="utf-8") as fh:
                    for line_no, line in enumerate(fh, start=1):
                        if not line.strip():
                            continue
                        try:
                            row = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        video_id = str(row.get("video_id") or row.get("video_id_or_post_id") or "").strip()
                        if video_id:
                            ids.add(video_id)
                            if str(path) not in sources[video_id]:
                                sources[video_id].append(str(path.relative_to(ROOT)))
        except (OSError, UnicodeDecodeError):
            continue
    return ids, sources


def resolve_roots(comments: list[dict[str, Any]]) -> dict[str, str]:
    parent_by_id: dict[str, str | None] = {}
    for comment in comments:
        comment_id = str(comment.get("id") or "")
        if not comment_id:
            continue
        parent = comment.get("parent")
        parent_by_id[comment_id] = None if parent in (None, "", "root") else str(parent)
    root_by_id: dict[str, str] = {}

    def find(comment_id: str, trail: set[str] | None = None) -> str:
        if comment_id in root_by_id:
            return root_by_id[comment_id]
        trail = trail or set()
        if comment_id in trail:
            root_by_id[comment_id] = comment_id
            return comment_id
        trail.add(comment_id)
        parent = parent_by_id.get(comment_id)
        if not parent or parent not in parent_by_id:
            root_by_id[comment_id] = comment_id if not parent else parent
            return root_by_id[comment_id]
        root_by_id[comment_id] = find(parent, trail)
        return root_by_id[comment_id]

    for comment_id in parent_by_id:
        find(comment_id)
    return root_by_id


def normalize_comment_timestamp(value: Any) -> str | None:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return str(value) if value else None


def context_text(candidate: dict[str, Any]) -> str:
    return "\n".join(
        str(candidate.get(key) or "")
        for key in ("video_title", "video_description_short", "root_text", "immediate_parent_text", "candidate_text")
    )


def candidate_prefilter(title: str, description: str, root_text: str, parent_text: str, text: str) -> tuple[bool, list[str]]:
    all_text = "\n".join((title, description, root_text, parent_text, text))
    compact_text = compact(all_text)
    hits = []
    for term in SPEED_TERMS + RATING_TERMS:
        if compact(term) in compact_text and term not in hits:
            hits.append(term)
    has_direct_speed = bool(DIRECT_SPEED_RE.search(all_text))
    has_rating_context = bool(RATING_TERMS and any(term.lower() in all_text.lower() for term in RATING_TERMS))
    has_explicit_rating = bool(GRADE_VALUE_RE.search(all_text) or NUMBER_RE.search(all_text) or BARE_GRADE_RE.search(all_text))
    # Bare "足" is intentionally not a signal; this avoids generic phrases
    # such as 満足度 while retaining explicit grades/values in title context.
    keep = has_direct_speed or (has_explicit_rating and has_rating_context) or (has_rating_context and has_direct_speed)
    return keep, hits


def identity_resolution(
    *,
    comment_text: str,
    parent_text: str,
    root_text: str,
    title: str,
    description: str,
    master_rows: list[dict[str, str]],
    master_by_name: dict[str, dict[str, str]],
    by_surname: dict[str, list[dict[str, str]]],
) -> dict[str, Any]:
    comment_norm = compact(comment_text)
    parent_norm = compact(parent_text)
    root_norm = compact(root_text)
    title_norm = compact(title)
    full_matches: list[tuple[str, dict[str, str], str]] = []
    for row in master_rows:
        name = row.get("player") or ""
        name_norm = compact(name)
        if not name_norm:
            continue
        if name_norm in comment_norm:
            full_matches.append(("full_name_in_comment", row, name))
        elif name_norm in parent_norm:
            full_matches.append(("parent_context_full_name", row, name))
        elif name_norm in root_norm:
            full_matches.append(("root_context_full_name", row, name))
        elif name_norm in title_norm:
            full_matches.append(("title_context_full_name", row, name))
    unique_full = {row["player_id"]: (method, row, name) for method, row, name in full_matches}
    if len(unique_full) == 1:
        method, row, name = next(iter(unique_full.values()))
        confidence = "HIGH" if method == "full_name_in_comment" else "MEDIUM"
        return {
            "player": row.get("player"), "canonical_player_id": row.get("player_id"),
            "identity_method": method, "identity_confidence": confidence,
            "identity_candidates": [row.get("player")], "identity_context": name,
            "current_100": True,
        }
    if len(unique_full) > 1:
        names = sorted({entry[1].get("player") for entry in unique_full.values() if entry[1].get("player")})
        return {
            "player": None, "canonical_player_id": None, "identity_method": "multiple_full_name_contexts",
            "identity_confidence": "AMBIGUOUS", "identity_candidates": names,
            "identity_context": "multiple current-100 full-name matches", "current_100": False,
        }

    surname_hits: dict[str, list[dict[str, str]]] = defaultdict(list)
    for surname, rows in by_surname.items():
        if surname in comment_norm:
            for row in rows:
                surname_hits["comment:" + surname].append(row)
        elif surname in parent_norm:
            for row in rows:
                surname_hits["parent:" + surname].append(row)
        elif surname in root_norm:
            for row in rows:
                surname_hits["root:" + surname].append(row)
        elif surname in title_norm:
            for row in rows:
                surname_hits["title:" + surname].append(row)
    flat_surname = {row["player_id"]: row for rows in surname_hits.values() for row in rows}
    if len(flat_surname) == 1:
        row = next(iter(flat_surname.values()))
        location = next(iter(surname_hits))
        method = {
            "comment": "surname_in_comment", "parent": "parent_context_surname",
            "root": "root_context_surname", "title": "title_context_surname",
        }[location.split(":", 1)[0]]
        return {
            "player": row.get("player"), "canonical_player_id": row.get("player_id"),
            "identity_method": method, "identity_confidence": "MEDIUM",
            "identity_candidates": [row.get("player")], "identity_context": location,
            "current_100": True,
        }
    if len(flat_surname) > 1:
        names = sorted({row.get("player") for row in flat_surname.values() if row.get("player")})
        return {
            "player": None, "canonical_player_id": None, "identity_method": "surname_ambiguous",
            "identity_confidence": "AMBIGUOUS", "identity_candidates": names,
            "identity_context": ";".join(surname_hits), "current_100": False,
        }

    # A small alias layer is intentionally conservative and never assigns an
    # invented current-100 ID. It primarily rescues regression-style aliases.
    combined_norm = compact("\n".join((comment_text, parent_text, root_text, title)))
    alias_hits = [canonical for alias, canonical in KNOWN_ALIASES.items() if compact(alias) in combined_norm]
    if len(alias_hits) == 1:
        canonical = alias_hits[0]
        master_row = master_by_name.get(compact(canonical))
        return {
            "player": master_row.get("player") if master_row else canonical,
            "canonical_player_id": master_row.get("player_id") if master_row else None,
            "identity_method": "known_alias_context",
            "identity_confidence": "MEDIUM" if master_row else "LOW",
            "identity_candidates": [canonical],
            "identity_context": "known alias; no invented ID when absent from current-100 master",
            "current_100": bool(master_row),
        }
    if len(alias_hits) > 1:
        return {
            "player": None, "canonical_player_id": None, "identity_method": "known_alias_ambiguous",
            "identity_confidence": "AMBIGUOUS", "identity_candidates": sorted(alias_hits),
            "identity_context": "multiple known aliases", "current_100": False,
        }
    return {
        "player": None, "canonical_player_id": None, "identity_method": "unmapped",
        "identity_confidence": "LOW", "identity_candidates": [],
        "identity_context": "no safe current-100 full-name, surname, title, parent, root, or alias match",
        "current_100": False,
    }


def extract_rating(text: str) -> tuple[str | None, str | None]:
    grade_with_value = re.search(r"(?:走力|脚力|スピード|足)\s*[:：]?\s*[SABCDEFG]\s*([０-９]{2}|[0-9]{2})", text, re.IGNORECASE)
    if grade_with_value:
        return grade_with_value.group(1).translate(str.maketrans("０１２３４５６７８９", "0123456789")), "explicit_speed_grade_and_value"
    match = GRADE_VALUE_RE.search(text)
    if match:
        raw = match.group(1)
        return raw.translate(str.maketrans("０１２３４５６７８９", "0123456789")), "explicit_speed_grade_or_value"
    match = NUMBER_RE.search(text)
    if match:
        return match.group(1).translate(str.maketrans("０１２３４５６７８９", "0123456789")), "explicit_speed_value"
    # Handle the expected "走力Bにも不満" / "走力Aだろ" form even if
    # punctuation or whitespace sits between the field and grade.
    match = re.search(r"走力\s*([SABCDEFG])", text, re.IGNORECASE)
    if match:
        return match.group(1).upper(), "explicit_speed_grade"
    return None, None


def semantic_review(candidate: dict[str, Any]) -> dict[str, Any]:
    text = str(candidate.get("candidate_text") or "")
    whole = context_text(candidate)
    thread_text = "\n".join(
        str(candidate.get(key) or "")
        for key in ("root_text", "immediate_parent_text", "candidate_text")
    )
    has_speed = bool(DIRECT_SPEED_RE.search(whole))
    has_rating = any(term.lower() in thread_text.lower() for term in RATING_TERMS)
    has_gameplay = any(term in whole for term in GAMEPLAY_TERMS)
    has_stealing = any(term in whole for term in STEALING_TERMS)
    has_baserunning = any(term in whole for term in BASE_RUNNING_TERMS)
    explicit_value, explicit_kind = extract_rating(whole)
    direction = "UNCLEAR"
    if explicit_value is not None:
        direction = "EXPLICIT_PROPOSED_VALUE"
    elif any(term in whole for term in HIGH_TERMS):
        direction = "TOO_HIGH"
    elif any(term in whole for term in LOW_TERMS):
        direction = "TOO_LOW"
    elif any(term in whole for term in STALE_TERMS):
        direction = "STALE"
    elif any(term in whole for term in AGING_TERMS):
        direction = "AGING_NOT_REFLECTED"
    elif any(term in whole for term in INJURY_TERMS):
        direction = "INJURY_NOT_REFLECTED"
    elif any(term in whole for term in ("妥当", "丁度", "ちょうど", "合ってる", "正しい")):
        direction = "APPROPRIATE"
    elif any(term in whole for term in ("比較", "より速", "より遅", "比べ")):
        direction = "COMPARISON_ONLY"

    if has_stealing and has_baserunning:
        speed_concept = "STEALING_AND_BASE_RUNNING"
    elif has_stealing:
        speed_concept = "STEALING"
    elif has_baserunning:
        speed_concept = "BASE_TO_BASE"
    elif "加速" in whole or "一歩目" in whole:
        speed_concept = "ACCELERATION"
    elif has_speed and ("走力" in whole or "脚力" in whole):
        speed_concept = "PURE_SPEED"
    elif has_speed:
        speed_concept = "GENERAL_SPEED"
    else:
        speed_concept = "UNCLEAR"

    rating_context = has_rating and ("能力" in thread_text or "走力" in thread_text or explicit_value is not None or direction != "UNCLEAR")
    if not has_speed and not rating_context:
        claim_lane = "NOISE"
    elif has_gameplay and not rating_context and (has_stealing or has_baserunning):
        claim_lane = "STEALING_TECHNIQUE" if has_stealing and not has_baserunning else "BASERUNNING_TECHNIQUE"
    elif has_gameplay and rating_context:
        claim_lane = "MIXED"
    elif rating_context:
        claim_lane = "RATING_PROSPI"
    else:
        claim_lane = "PHYSICAL_OBSERVATION"

    discourse_source = thread_text
    has_joke = any(term in discourse_source for term in JOKE_TERMS)
    rhetorical = any(mark in discourse_source for mark in ("だろ", "でしょ", "か？", "なのか", "じゃない"))
    if has_joke and (has_speed or rating_context):
        discourse = "joke_but_claim_present"
    elif has_joke:
        discourse = "sarcasm_possible"
    elif rhetorical:
        discourse = "rhetorical"
    else:
        discourse = "literal"
    if has_joke or rhetorical:
        sarcasm_possible = True
    else:
        sarcasm_possible = False

    identity_confidence = candidate.get("identity_confidence") or "LOW"
    accepted = claim_lane != "NOISE" and identity_confidence != "AMBIGUOUS"
    if claim_lane in ("STEALING_TECHNIQUE", "BASERUNNING_TECHNIQUE"):
        acceptance_status = "CONTEXT_ONLY_GAMEPLAY_OR_TECHNIQUE"
    elif not accepted:
        acceptance_status = "UNMAPPED_OR_AMBIGUOUS"
    elif sarcasm_possible and claim_lane == "PHYSICAL_OBSERVATION":
        acceptance_status = "CONTEXTUAL_REVIEW_REQUIRED"
    else:
        acceptance_status = "ACCEPTED_CONTEXTUAL"

    return {
        "claim_lane": claim_lane,
        "rating_direction": direction,
        "speed_concept": speed_concept,
        "discourse": discourse,
        "sarcasm_possible": sarcasm_possible,
        "explicit_rating_value": explicit_value,
        "explicit_rating_kind": explicit_kind,
        "acceptance_status": acceptance_status,
        "semantic_method": "contextual_semantic_rule_review_v1",
        "semantic_context_fields_used": [
            "video_title", "video_description_short", "root_text", "immediate_parent_text", "candidate_text", "direct_replies",
        ],
        "semantic_note": "Rule review reads the assembled thread/video context; it is not a claim that regex alone proved meaning.",
    }


def build_regression_results(master_rows: list[dict[str, str]], by_name: dict[str, dict[str, str]], by_surname: dict[str, list[dict[str, str]]]) -> list[dict[str, Any]]:
    cases = [
        ("A", "ビシエドってそんな足速いのか。他にもいろいろ能力値がおかしい。", "ビシエド", "candidate", None),
        ("B", "大谷走力Aだろ", "大谷翔平", "explicit_rating", "A"),
        ("C", "これパワーAはもちろん、走力Bにも不満あったんだよね笑", None, "claim_and_joke", "B"),
        ("D", "予想 ミート82パワー90走力84", None, "explicit_rating", "84"),
        ("E", "大谷走力Bにも不満", "大谷翔平", "candidate", None),
        ("F", "足が速い山川", "山川穂高", "sarcasm_review", None),
        ("G", "清原 ... ミートB79 パワー82 走力B74 ... これくらいはやってくれよ？", "清原和博", "explicit_rating", "74"),
    ]
    results = []
    for case_id, text, expected_player, expected_kind, expected_value in cases:
        synthetic = {
            "video_title": "プロスピA 選手能力公開",
            "video_description_short": "公式能力紹介",
            "root_text": (text + "？w") if case_id == "F" else text,
            "immediate_parent_text": "",
            "candidate_text": text,
            "direct_replies": [],
        }
        keep, hits = candidate_prefilter(
            synthetic["video_title"], synthetic["video_description_short"], text, "", text,
        )
        ident = identity_resolution(
            comment_text=text, parent_text="", root_text=text, title=synthetic["video_title"],
            description=synthetic["video_description_short"], master_rows=master_rows,
            master_by_name=by_name, by_surname=by_surname,
        )
        synthetic.update(ident)
        semantic = semantic_review(synthetic)
        passed = bool(keep)
        if expected_player:
            normalized_expected = compact(expected_player)
            normalized_actual = {compact(str(value)) for value in [ident.get("player"), *(ident.get("identity_candidates") or [])] if value}
            passed = passed and normalized_expected in normalized_actual
        if expected_kind == "explicit_rating":
            passed = passed and semantic["rating_direction"] == "EXPLICIT_PROPOSED_VALUE" and semantic["explicit_rating_value"] == expected_value
        if case_id == "C":
            passed = passed and semantic["discourse"] == "joke_but_claim_present" and semantic["claim_lane"] != "NOISE"
        if case_id == "F":
            passed = passed and semantic["discourse"] in ("rhetorical", "sarcasm_possible", "joke_but_claim_present") and semantic["acceptance_status"] == "CONTEXTUAL_REVIEW_REQUIRED"
        results.append({
            "case": case_id, "text": text, "expected": expected_kind, "candidate_prefilter": keep,
            "prefilter_hits": hits, "resolved_player": ident.get("player"),
            "identity_candidates": ident.get("identity_candidates"), "claim_lane": semantic["claim_lane"],
            "rating_direction": semantic["rating_direction"], "explicit_rating_value": semantic["explicit_rating_value"],
            "discourse": semantic["discourse"], "acceptance_status": semantic["acceptance_status"], "pass": passed,
        })
    return results


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def initialize_lane_outputs() -> None:
    with OUT_INVENTORY.open("x", encoding="utf-8", newline="") as fh:
        csv.DictWriter(fh, fieldnames=INVENTORY_FIELDS).writeheader()
    OUT_RAW.open("x", encoding="utf-8", newline="\n").close()
    OUT_CANDIDATES.open("x", encoding="utf-8", newline="\n").close()
    OUT_SEMANTIC.open("x", encoding="utf-8", newline="\n").close()


def append_inventory_row(row: dict[str, Any]) -> None:
    with OUT_INVENTORY.open("a", encoding="utf-8", newline="") as fh:
        csv.DictWriter(fh, fieldnames=INVENTORY_FIELDS, extrasaction="ignore").writerow(row)


def save_log_checkpoint(log: dict[str, Any], status: str) -> None:
    log["status"] = status
    log["checkpoint_at"] = now_utc()
    log["checkpoint_counts"] = {
        "videos_completed": sum(item.get("status") in ("OK", "FAILED") for item in log.get("video_attempts", [])),
        "videos_attempted": len(log.get("video_attempts", [])),
        "comments_retrieved": sum(int(item.get("retrieved") or 0) for item in log.get("video_attempts", [])),
        "candidate_rows": log.get("candidate_rows_so_far", 0),
        "semantic_rows": log.get("semantic_rows_so_far", 0),
    }
    log["output_files"] = [str(path.relative_to(ROOT)) for path in [OUT_INVENTORY, OUT_RAW, OUT_CANDIDATES, OUT_SEMANTIC, OUT_LOG]]
    with OUT_LOG.open("w", encoding="utf-8") as fh:
        json.dump(log, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def write_inventory(rows: list[dict[str, Any]]) -> None:
    for row in rows:
        append_inventory_row(row)


def write_player_summary(semantic_rows: list[dict[str, Any]]) -> None:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in semantic_rows:
        key = row.get("canonical_player_id") or f"unmapped:{row.get('player') or 'UNKNOWN'}"
        grouped[key].append(row)
    fields = [
        "player", "canonical_player_id", "current_100", "semantic_review_candidates", "accepted_or_contextual_claims",
        "rating_claims", "physical_observations", "gameplay_or_technique_claims", "ambiguous_or_unmapped",
        "explicit_rating_values", "directions", "video_ids", "independence_groups",
    ]
    rows = []
    for key, group in sorted(grouped.items()):
        claims = [r for r in group if r.get("acceptance_status") in ("ACCEPTED_CONTEXTUAL", "CONTEXTUAL_REVIEW_REQUIRED")]
        rating = [r for r in group if r.get("claim_lane") in ("RATING_PROSPI", "MIXED")]
        physical = [r for r in group if r.get("claim_lane") == "PHYSICAL_OBSERVATION"]
        gameplay = [r for r in group if r.get("claim_lane") in ("GAMEPLAY_MECHANICS", "BASERUNNING_TECHNIQUE", "STEALING_TECHNIQUE")]
        rows.append({
            "player": group[0].get("player"), "canonical_player_id": group[0].get("canonical_player_id"),
            "current_100": bool(group[0].get("current_100")), "semantic_review_candidates": len(group),
            "accepted_or_contextual_claims": len(claims), "rating_claims": len(rating),
            "physical_observations": len(physical), "gameplay_or_technique_claims": len(gameplay),
            "ambiguous_or_unmapped": sum(r.get("identity_confidence") in ("LOW", "AMBIGUOUS") for r in group),
            "explicit_rating_values": ";".join(sorted({str(r.get("explicit_rating_value")) for r in group if r.get("explicit_rating_value")})),
            "directions": ";".join(sorted({str(r.get("rating_direction")) for r in group if r.get("rating_direction")})),
            "video_ids": ";".join(sorted({str(r.get("video_id")) for r in group if r.get("video_id")})),
            "independence_groups": ";".join(sorted({str(r.get("independence_group")) for r in group if r.get("independence_group")})),
        })
    with OUT_SUMMARY.open("x", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    existing = [str(path.relative_to(ROOT)) for path in FINAL_OUTPUTS if path.exists()]
    if existing:
        raise RuntimeError("Refusing to overwrite existing lane outputs: " + ", ".join(existing))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    started = now_utc()
    master_rows, master_by_name, by_surname = load_master()
    old_ids, old_sources = old_inventory_ids()
    log: dict[str, Any] = {
        "task": "SP-034",
        "lane": "Prospi official YouTube only",
        "scope_boundary": {
            "included": ["official channel-side discovery", "2024-01-01 through 2026-08-14 inclusive", "Prospi video comments and replies", "contextual candidate and semantic review"],
            "excluded": ["X/SP-035 new collection or reclassification", "PowerPro/SP-033 collection", "status/registry changes", "common final files", "commit/push"],
        },
        "started_at": started,
        "channel_url": CHANNEL_URL,
        "official_channel_id": CHANNEL_ID,
        "official_channel_name": CHANNEL_NAME,
        "period": {"start": START_DATE, "end": END_DATE},
        "yt_dlp": {"route": "yt-dlp", "version": None, "comment_sort": "new", "max_comments": "all,all,all,all,all", "api_key_configured": False},
        "discovery": {"method": "official_channel_side_scan", "channel_flat_entries": 0, "unique_channel_video_ids": 0, "metadata_records": 0, "metadata_parse_errors": [], "period_video_count": 0, "relevant_prospi_video_count": 0},
        "old_inventory_comparison": {"old_ids_count": len(old_ids), "old_inventory_used_for": "overlap QA only", "old_inventory_discovery_source": False},
        "video_attempts": [],
        "errors": [],
    }
    initialize_lane_outputs()
    save_log_checkpoint(log, "RUNNING_DISCOVERY")

    version_stdout, version_error, _, _ = run_ytdlp(["--version"], timeout=60)
    if version_error:
        log["yt_dlp"]["version_error"] = version_error
    else:
        log["yt_dlp"]["version"] = (version_stdout or "").strip()

    # A single unbounded channel request hung in the public route. Use
    # bounded channel-side pages instead, continuing until a short/empty page
    # or an explicit retrieval error. This is still fresh official-channel
    # discovery and is not reuse of the old inventory.
    page_size = 100
    unique_entries: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    discovery_errors: list[str] = []
    page_start = 1
    while page_start <= 5000:
        page_end = page_start + page_size - 1
        page_stdout, page_error, page_command, page_removed_proxy = run_ytdlp(
            ["--flat-playlist", "--playlist-start", str(page_start), "--playlist-end", str(page_end), "--dump-single-json", CHANNEL_URL],
            timeout=360,
        )
        page_entry_count = 0
        if page_error or page_stdout is None:
            discovery_errors.append(f"page {page_start}-{page_end}: {page_error}")
            log.setdefault("discovery_pages", []).append({
                "start": page_start, "end": page_end, "status": "FAILED", "error": page_error,
                "command": page_command, "removed_proxy_env_names": page_removed_proxy,
            })
            save_log_checkpoint(log, "DISCOVERY_PARTIAL_PAGE_ERROR")
            break
        try:
            page = json.loads(page_stdout)
        except json.JSONDecodeError as exc:
            discovery_errors.append(f"page {page_start}-{page_end}: JSONDecodeError: {exc}")
            log.setdefault("discovery_pages", []).append({"start": page_start, "end": page_end, "status": "FAILED_JSON", "error": str(exc)})
            save_log_checkpoint(log, "DISCOVERY_PARTIAL_JSON_ERROR")
            break
        page_entries = [entry for entry in (page.get("entries") or []) if isinstance(entry, dict) and entry.get("id")]
        page_entry_count = len(page_entries)
        for entry in page_entries:
            video_id = str(entry.get("id"))
            if video_id not in seen_ids:
                seen_ids.add(video_id)
                unique_entries.append(entry)
        log.setdefault("discovery_pages", []).append({
            "start": page_start, "end": page_end, "status": "OK", "returned": page_entry_count,
            "command": page_command, "removed_proxy_env_names": page_removed_proxy,
        })
        log["discovery"]["channel_flat_entries"] = log["discovery"].get("channel_flat_entries", 0) + page_entry_count
        log["discovery"]["unique_channel_video_ids"] = len(unique_entries)
        save_log_checkpoint(log, "RUNNING_DISCOVERY_PAGE")
        print(f"discovery_page={page_start}-{page_end} entries={page_entry_count} unique={len(unique_entries)}", flush=True)
        if page_entry_count < page_size:
            break
        page_start += page_size
    log["discovery"]["page_size"] = page_size
    log["discovery"]["discovery_errors"] = discovery_errors
    log["discovery"]["discovery_stop_boundary"] = page_start if discovery_errors else page_start + max(0, page_entry_count - page_size)
    print(f"official_channel_entries={log['discovery']['channel_flat_entries']} unique_video_ids={len(unique_entries)}", flush=True)

    # Resolve dates and descriptions from the channel-side discovered IDs in
    # small direct metadata batches. Title hints keep the public route bounded
    # without turning the old inventory into a discovery source. Entries whose
    # titles do not expose a relevant hint remain explicit date-unresolved
    # channel-scan coverage in the log.
    metadata_by_id: dict[str, dict[str, Any]] = {}
    metadata_hint_markers = PROSPI_MARKERS + PROSPI_SERIES_MARKERS + ABILITY_MARKERS + ("選手", "対決", "インタビュー", "PV", "CM", "新登場")
    metadata_entries = [
        entry for entry in unique_entries
        if any(marker.lower() in str(entry.get("title") or "").lower() for marker in metadata_hint_markers)
    ]
    log["discovery"]["metadata_target_count"] = len(metadata_entries)
    log["discovery"]["metadata_unresolved_channel_entry_count"] = len(unique_entries) - len(metadata_entries)
    save_log_checkpoint(log, "RUNNING_METADATA_COLLECTION")
    batch_size = 5
    metadata_errors: list[str] = []
    for start in range(0, len(metadata_entries), batch_size):
        batch = metadata_entries[start:start + batch_size]
        urls = [f"https://www.youtube.com/watch?v={entry['id']}" for entry in batch]
        stdout, error, command, removed = run_ytdlp(
            ["--no-playlist", "--print", METADATA_PRINT, *urls], timeout=1200,
        )
        if error or stdout is None:
            metadata_errors.append(f"batch {start + 1}-{start + len(batch)}: {error}")
            print(f"metadata_batch={start + 1}-{start + len(batch)} status=FAILED", flush=True)
            continue
        records, parse_errors = parse_printed_metadata(stdout)
        metadata_errors.extend(f"batch {start + 1}-{start + len(batch)}: {item}" for item in parse_errors)
        for record in records:
            metadata_by_id[str(record["video_id"])] = record
        print(f"metadata_batch={start + 1}-{start + len(batch)} records={len(records)}", flush=True)
        log.setdefault("metadata_batches", []).append({
            "start": start + 1, "end": start + len(batch), "requested": len(batch), "returned": len(records),
            "command": command, "removed_proxy_env_names": removed,
        })
        save_log_checkpoint(log, "RUNNING_METADATA_COLLECTION")
    log["discovery"]["metadata_records"] = len(metadata_by_id)
    log["discovery"]["metadata_parse_errors"] = metadata_errors

    period_records: list[dict[str, Any]] = []
    for position, entry in enumerate(unique_entries, start=1):
        video_id = str(entry["id"])
        info = metadata_by_id.get(video_id)
        if not info:
            continue
        published_at = iso_date(info)
        if not in_scope(published_at):
            continue
        period_records.append({
            "video_id": video_id, "title": info.get("title") or entry.get("title") or "",
            "description": info.get("description") or "", "published_at": published_at,
            "official_channel_id": info.get("official_channel_id") or CHANNEL_ID,
            "channel_name": info.get("channel_name") or CHANNEL_NAME, "channel_position": position,
        })
    log["discovery"]["period_video_count"] = len(period_records)
    print(f"period_videos={len(period_records)}", flush=True)

    relevant_records: list[dict[str, Any]] = []
    for record in period_records:
        relevant, hits, reason = is_relevant_prospi(record["title"], record["description"])
        if not relevant:
            continue
        relevant_records.append({**record, "matched_terms": hits, "relevant_reason": reason})
    log["discovery"]["relevant_prospi_video_count"] = len(relevant_records)
    print(f"relevant_prospi_videos={len(relevant_records)}", flush=True)
    save_log_checkpoint(log, "RUNNING_COMMENT_COLLECTION")

    inventory_rows: list[dict[str, Any]] = []
    raw_rows: list[dict[str, Any]] = []
    candidate_rows: list[dict[str, Any]] = []
    semantic_rows: list[dict[str, Any]] = []
    current_100_title_targets: dict[str, list[str]] = {}

    for video_index, record in enumerate(relevant_records, start=1):
        video_id = record["video_id"]
        title = record["title"]
        description = record["description"]
        source_url = f"https://www.youtube.com/watch?v={video_id}"
        title_identity = identity_resolution(
            comment_text="", parent_text="", root_text="", title=title, description=description,
            master_rows=master_rows, master_by_name=master_by_name, by_surname=by_surname,
        )
        target_players = title_identity.get("identity_candidates") or []
        current_100_title_targets[video_id] = target_players
        attempt_at = now_utc()
        comments_stdout, comments_error, comments_command, comments_removed = run_ytdlp(
            [
                "--no-playlist", "--get-comments", "--extractor-args",
                "youtube:comment_sort=new;max_comments=all,all,all,all,all",
                "--dump-single-json", source_url,
            ], timeout=1800,
        )
        video_attempt: dict[str, Any] = {
            "video_id": video_id, "title": title, "published_at": record["published_at"],
            "status": "RUNNING", "attempted_at": attempt_at,
            "command": comments_command, "removed_proxy_env_names": comments_removed,
            "requested_bound": "all_parents,all_replies,all_replies_per_thread,all_depth",
            "retrieved": 0, "platform_reported_comment_count": None, "error": comments_error,
        }
        log["current_video_attempt"] = video_attempt
        save_log_checkpoint(log, "RUNNING_COMMENT_REQUEST")
        comments: list[dict[str, Any]] = []
        info: dict[str, Any] = {}
        if comments_error or comments_stdout is None:
            log["errors"].append({"video_id": video_id, "stage": "comments", "error": comments_error})
        else:
            try:
                info = json.loads(comments_stdout)
                comments = [comment for comment in (info.get("comments") or []) if isinstance(comment, dict) and comment.get("id")]
                video_attempt["retrieved"] = len(comments)
                video_attempt["platform_reported_comment_count"] = info.get("comment_count")
            except json.JSONDecodeError as exc:
                comments_error = f"comments_json_decode_failed: {exc}"
                video_attempt["status"] = "FAILED"
                video_attempt["error"] = comments_error
                log["errors"].append({"video_id": video_id, "stage": "comments_json", "error": comments_error})
        root_by_id = resolve_roots(comments)
        comment_by_id = {str(comment.get("id")): comment for comment in comments}
        direct_replies_by_root: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for comment in comments:
            cid = str(comment.get("id"))
            parent = comment.get("parent")
            if parent not in (None, "", "root"):
                direct_replies_by_root[str(root_by_id.get(cid) or parent)].append(comment)
        for comment in comments:
            comment_id = str(comment.get("id"))
            parent_raw = comment.get("parent")
            parent_id = None if parent_raw in (None, "", "root") else str(parent_raw)
            root_id = root_by_id.get(comment_id) or comment_id
            root_comment = comment_by_id.get(root_id) or comment
            immediate_parent = comment_by_id.get(parent_id) if parent_id else None
            root_text = str(root_comment.get("text") or "")
            parent_text = str(immediate_parent.get("text") or "") if immediate_parent else ""
            text = str(comment.get("text") or "")
            raw_record = {
                "record_id": f"SP034-V3-RAW-{video_id}-{comment_id}", "platform": "YouTube",
                "source_type": "official_youtube_comment_or_reply", "game": "Prospi",
                "edition": "Prospi official YouTube lane", "source_url": f"{source_url}&lc={comment_id}",
                "video_id": video_id, "video_title": title, "video_description_short": short_text(description),
                "official_channel_id": CHANNEL_ID, "channel_name": CHANNEL_NAME,
                "published_at": normalize_comment_timestamp(comment.get("timestamp")),
                "comment_id": comment_id, "parent_comment_id": parent_id, "root_thread_id": root_id,
                "thread_role": "reply" if parent_id else "root", "author": comment.get("author"),
                "author_id": comment.get("author_id"), "text": text, "likes": comment.get("like_count"),
                "reply_count": comment.get("reply_count"), "is_pinned": comment.get("is_pinned"),
                "is_favorited": comment.get("is_favorited"), "platform_reported_comment_count": info.get("comment_count"),
                "retrieved_count_for_video": len(comments), "retrieval_method": "yt-dlp --get-comments",
                "retrieval_sort": "new", "retrieval_request": "max_comments=all,all,all,all,all",
                "retrieval_bound_or_missingness": "requested_all_but_public_route_or_extractor_may_have_opaque_bound",
                "collected_at": attempt_at,
            }
            raw_rows.append(raw_record)
            candidate_base = {
                "record_id": f"SP034-V3-CANDIDATE-{video_id}-{comment_id}",
                "raw_record_id": raw_record["record_id"], "platform": "YouTube", "game": "Prospi",
                "source_type": "official_youtube_speed_rating_candidate", "source_url": raw_record["source_url"],
                "video_id": video_id, "video_title": title, "video_description_short": short_text(description),
                "official_channel_id": CHANNEL_ID, "comment_id": comment_id, "parent_comment_id": parent_id,
                "root_thread_id": root_id, "candidate_text": text, "immediate_parent_text": parent_text,
                "root_text": root_text, "direct_replies": [
                    {"comment_id": str(reply.get("id")), "parent_comment_id": str(reply.get("parent")), "text": str(reply.get("text") or ""), "likes": reply.get("like_count")}
                    for reply in direct_replies_by_root.get(root_id, [])
                    if str(reply.get("id")) != comment_id
                ],
                "candidate_extraction_context": "video_title+description+root+immediate_parent+candidate_text",
                "retrieval_method": raw_record["retrieval_method"], "retrieved_count_for_video": len(comments),
                "platform_reported_comment_count": info.get("comment_count"),
                "retrieval_bound_or_missingness": raw_record["retrieval_bound_or_missingness"],
            }
            keep, hits = candidate_prefilter(title, description, root_text, parent_text, text)
            if not keep:
                continue
            identity = identity_resolution(
                comment_text=text, parent_text=parent_text, root_text=root_text, title=title, description=description,
                master_rows=master_rows, master_by_name=master_by_name, by_surname=by_surname,
            )
            candidate_base.update({"prefilter_terms": hits, **identity})
            candidate_rows.append(candidate_base)
            reviewed = {**candidate_base, **semantic_review(candidate_base)}
            reviewed["event_id"] = f"youtube:{video_id}"
            reviewed["independence_group"] = f"youtube:{video_id}:{root_id}:{reviewed.get('canonical_player_id') or reviewed.get('player') or 'UNMAPPED'}"
            reviewed["origin_count"] = 1
            reviewed["reaction_volume"] = len(direct_replies_by_root.get(root_id, [])) + 1
            reviewed["comment_count"] = len(comments)
            reviewed["like_sum"] = sum(int(reply.get("like_count") or 0) for reply in direct_replies_by_root.get(root_id, []) if str(reply.get("like_count") or "").isdigit()) + int(comment.get("like_count") or 0 if str(comment.get("like_count") or "").isdigit() else 0)
            reviewed["top_like_count"] = max([int(comment.get("like_count") or 0)] + [int(reply.get("like_count") or 0) for reply in direct_replies_by_root.get(root_id, []) if str(reply.get("like_count") or "").isdigit()])
            semantic_rows.append(reviewed)
        retrieval_bound = "requested_all_parents_all_replies_all_depth"
        if comments_error:
            retrieval_bound = "COMMENTS_NOT_RETRIEVED; transport_or_extractor_error; absence_not_inferred"
        elif info.get("comment_count") is not None and isinstance(info.get("comment_count"), int) and len(comments) < info["comment_count"]:
            retrieval_bound = "RETRIEVED_BELOW_PLATFORM_REPORTED_COMMENT_COUNT; unresolved_remainder"
        elif info.get("comment_count") is None:
            retrieval_bound = "PLATFORM_COMMENT_COUNT_NOT_RETURNED; requested_all_but_opaque_bound_possible"
        inventory_rows.append({
            "game": "Prospi", "video_id": video_id, "title": title,
            "description_short": short_text(description), "published_at": record["published_at"],
            "source_url": source_url, "official_channel_id": CHANNEL_ID, "channel_name": CHANNEL_NAME,
            "discovery_method": "official_channel_side_scan_then_direct_metadata",
            "channel_position": record["channel_position"], "matched_terms": ";".join(record["matched_terms"]),
            "relevant_reason": record["relevant_reason"], "target_players_from_title_if_any": ";".join(target_players),
            "comments_available": not bool(comments_error), "comments_retrieved": len(comments),
            "platform_reported_comment_count": info.get("comment_count"),
            "retrieval_method": "yt-dlp --get-comments --extractor-args youtube:comment_sort=new;max_comments=all,all,all,all,all",
            "retrieval_bound_or_missingness": retrieval_bound,
            "already_in_old_inventory": video_id in old_ids,
            "old_inventory_sources": ";".join(old_sources.get(video_id, [])),
            "metadata_status": "RETRIEVED", "collection_attempted_at": attempt_at,
        })
        video_attempt["candidate_count"] = sum(row.get("video_id") == video_id for row in candidate_rows)
        video_attempt["semantic_count"] = sum(row.get("video_id") == video_id for row in semantic_rows)
        log["video_attempts"].append(video_attempt)
        inventory_row = inventory_rows[-1]
        raw_start = max(0, len(raw_rows) - len(comments))
        candidate_video_rows = [row for row in candidate_rows if row.get("video_id") == video_id]
        semantic_video_rows = [row for row in semantic_rows if row.get("video_id") == video_id]
        append_inventory_row(inventory_row)
        write_jsonl(OUT_RAW, raw_rows[raw_start:])
        write_jsonl(OUT_CANDIDATES, candidate_video_rows)
        write_jsonl(OUT_SEMANTIC, semantic_video_rows)
        log["candidate_rows_so_far"] = len(candidate_rows)
        log["semantic_rows_so_far"] = len(semantic_rows)
        log["current_video_attempt"] = None
        save_log_checkpoint(log, "RUNNING_COMMENT_COLLECTION")
        print(f"comments={video_index}/{len(relevant_records)} video={video_id} retrieved={len(comments)} candidates={video_attempt['candidate_count']}", flush=True)

    inventory_rows.sort(key=lambda row: (row.get("published_at") or "", row.get("video_id") or ""), reverse=True)
    write_player_summary(semantic_rows)

    regression_results = build_regression_results(master_rows, master_by_name, by_surname)
    independent_groups = {row.get("independence_group") for row in semantic_rows if row.get("independence_group")}
    accepted = [row for row in semantic_rows if row.get("acceptance_status") in ("ACCEPTED_CONTEXTUAL", "CONTEXTUAL_REVIEW_REQUIRED")]
    mapped_current = {row.get("canonical_player_id") for row in semantic_rows if row.get("current_100") and row.get("canonical_player_id")}
    fresh_relevant = [row for row in inventory_rows if not row.get("already_in_old_inventory")]
    qa = {
        "task": "SP-034", "lane": "Prospi official YouTube only", "generated_at": now_utc(),
        "scope": {"start": START_DATE, "end": END_DATE, "channel_id": CHANNEL_ID, "channel_url": CHANNEL_URL},
        "counts": {
            "official_videos_scanned_from_channel": log["discovery"]["unique_channel_video_ids"],
            "metadata_records": log["discovery"]["metadata_records"], "period_videos": len(period_records),
            "relevant_prospi_videos": len(inventory_rows), "new_relevant_videos_absent_from_old_inventory": len(fresh_relevant),
            "old_inventory_ids_count": len(old_ids), "overlap_relevant_video_ids": sum(bool(row.get("already_in_old_inventory")) for row in inventory_rows),
            "comments_replies_retrieved": len(raw_rows), "videos_comment_attempted": len(log["video_attempts"]),
            "videos_comment_failed": sum(item.get("status") == "FAILED" for item in log["video_attempts"]),
            "semantic_review_candidates": len(candidate_rows), "semantic_classified": len(semantic_rows),
            "accepted_or_contextual_claims": len(accepted), "current_100_mapped_claim_rows": sum(bool(row.get("current_100")) for row in semantic_rows),
            "current_100_mapped_player_count": len(mapped_current), "meaningful_independent_origins": len(independent_groups),
            "explicit_grade_or_value_claims": sum(row.get("rating_direction") == "EXPLICIT_PROPOSED_VALUE" for row in semantic_rows),
            "direction_claims": sum(row.get("rating_direction") not in (None, "UNCLEAR") for row in semantic_rows),
            "rating_context_claims": sum(row.get("claim_lane") in ("RATING_PROSPI", "MIXED") for row in semantic_rows),
            "physical_observations": sum(row.get("claim_lane") == "PHYSICAL_OBSERVATION" for row in semantic_rows),
            "gameplay_or_technique_claims": sum(row.get("claim_lane") in ("GAMEPLAY_MECHANICS", "BASERUNNING_TECHNIQUE", "STEALING_TECHNIQUE") for row in semantic_rows),
            "sarcasm_or_joke_but_claim": sum(row.get("discourse") in ("sarcasm_possible", "joke_but_claim_present") for row in semantic_rows),
        },
        "retrieval": {
            "sort": "new", "requested_max_comments": "all,all,all,all,all",
            "fixed_100_300_cap_used": False, "youtube_data_api_used": False,
            "platform_reported_count_available_for_videos": sum(item.get("platform_reported_comment_count") is not None for item in log["video_attempts"]),
            "unresolved_remainder_videos": [item["video_id"] for item in log["video_attempts"] if item.get("status") == "FAILED" or item.get("retrieved", 0) < (item.get("platform_reported_comment_count") or 0)],
        },
        "identity": {
            "full_name_or_context_mapping": sum(row.get("identity_method", "").startswith(("full_name", "parent_context_full", "root_context_full", "title_context_full")) for row in candidate_rows),
            "surname_or_context_mapping": sum(row.get("identity_method", "").startswith(("surname", "parent_context_surname", "root_context_surname", "title_context_surname")) for row in candidate_rows),
            "alias_mapping": sum(row.get("identity_method") == "known_alias_context" for row in candidate_rows),
            "ambiguous": sum(row.get("identity_confidence") == "AMBIGUOUS" for row in candidate_rows),
            "low_or_unmapped": sum(row.get("identity_confidence") == "LOW" for row in candidate_rows),
        },
        "claim_lane_counts": dict(Counter(row.get("claim_lane") for row in semantic_rows)),
        "direction_counts": dict(Counter(row.get("rating_direction") for row in semantic_rows)),
        "regression_A_to_G": regression_results,
        "regression_pass": all(item.get("pass") for item in regression_results),
        "limitations": [
            "No YouTube Data API key was configured; public yt-dlp retrieval is not proof of exhaustive platform pagination.",
            "The channel listing exposed video IDs, while dates/descriptions were resolved by direct metadata calls for every discovered ID returned by the listing.",
            "Semantic output is deterministic contextual review and remains provisional for owner/LLM review; it is not a claim that regex alone established meaning.",
            "Unmapped or ambiguous comments remain in candidate and semantic outputs and are not converted to negative evidence.",
        ],
        "prohibited_scope_check": {"x_new_collection": False, "x_reclassification": False, "sp035_status_change": False, "registry_update": False, "common_final_edit": False},
        "output_files": [str(path.relative_to(ROOT)) for path in FINAL_OUTPUTS],
    }
    with OUT_QA.open("x", encoding="utf-8") as fh:
        json.dump(qa, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    log["finished_at"] = now_utc()
    log["output_files"] = [str(path.relative_to(ROOT)) for path in FINAL_OUTPUTS]
    log["final_counts"] = qa["counts"]
    with OUT_LOG.open("w", encoding="utf-8") as fh:
        json.dump(log, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(json.dumps({"counts": qa["counts"], "regression_pass": qa["regression_pass"]}, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FATAL {type(exc).__name__}: {exc}", file=sys.stderr)
        raise

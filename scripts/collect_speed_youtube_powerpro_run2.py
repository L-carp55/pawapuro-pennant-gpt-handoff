# -*- coding: utf-8 -*-
"""Collect SP-033 PowerPro official-YouTube evidence into isolated run-2 staging files.

This script intentionally does not modify the accepted/rejected ledgers, the task registry, or any
final integration artifact.  It appends one complete inventory record at a time so an interruption
preserves the completed-video boundary.
"""

from __future__ import annotations

import csv
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "derived"
CSV_PATH = OUT_DIR / "_staging_speed_youtube_powerpro_run2.csv"
JSONL_PATH = OUT_DIR / "_staging_speed_youtube_powerpro_run2.jsonl"
LOG_PATH = OUT_DIR / "speed_youtube_powerpro_run2_execution_log.md"
MASTER_PATH = OUT_DIR / "speed_2026_100_owner_review_master_20260813.csv"
OFFICIAL_CHANNEL_ID = "UCWzEh28vj3mQKpe0fzVTOUw"

# These are the official-channel videos identified by the successful corrected channel inventory
# and channel-search routes.  They cover the two current/near-current title videos and the only
# returned PowerPro-specific ability-value item; no title asserted a current-player ability/update
# reveal.  The script re-fetches metadata rather than trusting these display titles.
VIDEO_CANDIDATES = (
    {
        "video_id": "wOjrANePk1c",
        "edition": "PowerPro 2026-2027",
        "source_type": "YOUTUBE_OFFICIAL_CURRENT_EDITION_OPENING",
        "scope_note": "Current-edition opening movie; title does not itself identify a player ability or roster update.",
    },
    {
        "video_id": "lXJEdQqrU7E",
        "edition": "PowerPro 2026-2027",
        "source_type": "YOUTUBE_OFFICIAL_CURRENT_EDITION_PROMOTION",
        "scope_note": "Current-edition official promotional/interview video; must not be treated as an ability reveal without metadata evidence.",
    },
    {
        "video_id": "pxdRtLSTI80",
        "edition": "PowerPro 2024-2025",
        "source_type": "YOUTUBE_OFFICIAL_PRECEDING_EDITION_OPENING",
        "scope_note": "Immediately preceding console edition opening movie; included as near-current context, not as a current 2026 player-rating source.",
    },
    {
        "video_id": "4LPWDwnHVpg",
        "edition": "PowerPro 2020",
        "source_type": "YOUTUBE_OFFICIAL_HISTORICAL_PLAYER_ABILITY_QUIZ",
        "scope_note": "Official player-ability quiz discovered by the official-channel ability search; historical and not safely mappable to current 2026 ratings by title alone.",
    },
)

FIELDNAMES = (
    "record_id",
    "player",
    "canonical_player_id",
    "game",
    "edition",
    "update_date",
    "platform",
    "source_type",
    "source_url",
    "video_id_or_post_id",
    "parent_event_id",
    "author_id_or_name",
    "timestamp",
    "text",
    "likes",
    "reply_count",
    "classification",
    "strength",
    "independence_group",
    "physical_or_rating_lane",
    "target_rating_if_explicit",
    "comparison_player_if_any",
    "source_quality",
    "notes",
    "acceptance_status",
    "acceptance_reason",
    "acquisition_status",
    "error",
    "attempted_routes",
    "collected_at",
    "event_id",
    "origin_count",
    "comment_count",
    "like_sum",
    "top_like_count",
    "video_title",
    "video_published_at",
    "player_game_update_mapping",
    "missingness",
    "user_input_requirement",
    "api_state",
)

SPEED_TERMS = ("走力", "足", "脚", "俊足", "鈍足", "スピード", "速い", "遅い", "速すぎ", "遅すぎ")
RATING_TERMS = ("査定", "能力", "能力値", "反映", "高すぎ", "低すぎ", "もっと", "妥当", "評価", "A", "B", "C", "D", "E", "F", "G")


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def iso_timestamp(value: Any) -> str:
    """Normalize yt-dlp epoch values to an explicit UTC acquisition/publication timestamp."""
    if value in (None, ""):
        return ""
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    return str(value)


def append_log(text: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(text.rstrip() + "\n")


def existing_record_ids() -> set[str]:
    if not JSONL_PATH.exists():
        return set()
    ids: set[str] = set()
    with JSONL_PATH.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"existing staging JSONL is invalid at line {line_number}: {exc}") from exc
            record_id = record.get("record_id")
            if record_id:
                ids.add(str(record_id))
    return ids


def ensure_csv_header() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if CSV_PATH.exists() and CSV_PATH.stat().st_size > 0:
        with CSV_PATH.open("r", encoding="utf-8", newline="") as handle:
            header = next(csv.reader(handle), [])
        if header != list(FIELDNAMES):
            raise RuntimeError("existing staging CSV header does not match this run-2 schema; refusing to mix schemas")
        return
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        csv.DictWriter(handle, fieldnames=FIELDNAMES).writeheader()


def append_record(record: dict[str, Any], known_ids: set[str]) -> bool:
    record_id = str(record["record_id"])
    if record_id in known_ids:
        return False
    normalized = {field: as_text(record.get(field)) for field in FIELDNAMES}
    with CSV_PATH.open("a", encoding="utf-8", newline="") as csv_handle:
        csv.DictWriter(csv_handle, fieldnames=FIELDNAMES).writerow(normalized)
        csv_handle.flush()
        os.fsync(csv_handle.fileno())
    with JSONL_PATH.open("a", encoding="utf-8", newline="\n") as jsonl_handle:
        jsonl_handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        jsonl_handle.flush()
        os.fsync(jsonl_handle.fileno())
    known_ids.add(record_id)
    return True


def load_master_players() -> list[dict[str, str]]:
    with MASTER_PATH.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"player", "player_id"}
        if not required.issubset(reader.fieldnames or set()):
            raise RuntimeError(f"master file does not have the required columns: {required}")
        return [
            {"player": row["player"].strip(), "canonical_player_id": row["player_id"].strip()}
            for row in reader
            if row.get("player", "").strip()
        ]


def explicit_player_matches(text: str, players: list[dict[str, str]]) -> list[dict[str, str]]:
    compact = text.replace(" ", "").replace("　", "")
    matches = []
    for player in players:
        normalized_name = player["player"].replace(" ", "").replace("　", "")
        if normalized_name and normalized_name in compact:
            matches.append(player)
    return matches


def api_state() -> tuple[str, str]:
    key_names = ("YOUTUBE_API_KEY", "GOOGLE_API_KEY", "YT_API_KEY")
    configured = [name for name in key_names if os.environ.get(name)]
    if configured:
        return ("PRESENT_NOT_USED", "API key environment variable is present but this collection uses the public yt-dlp route only.")
    return ("NOT_CONFIGURED_ENV", "YouTube Data API key is not configured in the execution environment.")


def ytdlp_command(video_url: str, output_template: Path) -> list[str]:
    # Each flag and its value is a distinct argument.  In particular --no-update is a standalone
    # flag and cannot become a proxy value (the run-1 failure mode).
    return [
        "yt-dlp",
        "--no-update",
        "--skip-download",
        "--no-playlist",
        "--write-info-json",
        "--write-comments",
        "--extractor-args",
        "youtube:max_comments=100,100,100,100",
        "--output",
        str(output_template),
        video_url,
    ]


def run_ytdlp(video_id: str) -> tuple[dict[str, Any] | None, str | None, str, str]:
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    with tempfile.TemporaryDirectory(prefix="speed_youtube_powerpro_run2_") as temp_dir:
        template = Path(temp_dir) / "%(id)s.%(ext)s"
        command = ytdlp_command(video_url, template)
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", check=False)
        command_string = subprocess.list2cmdline(command)
        stderr = (completed.stderr or "").strip()
        stdout = (completed.stdout or "").strip()
        info_path = Path(temp_dir) / f"{video_id}.info.json"
        if not info_path.exists():
            error = f"yt-dlp exit={completed.returncode}; no info JSON created. stderr={stderr[-2000:]}"
            return None, error, command_string, stdout[-1000:]
        try:
            info = json.loads(info_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            return None, f"yt-dlp wrote unreadable info JSON: {exc}", command_string, stdout[-1000:]
        if completed.returncode != 0:
            return info, f"yt-dlp exit={completed.returncode}; stderr={stderr[-2000:]}", command_string, stdout[-1000:]
        return info, None, command_string, stdout[-1000:]


def direction_labels(text: str) -> list[str]:
    labels: list[str] = []
    if any(term in text for term in ("高すぎ", "速すぎ", "もっと低")):
        labels.append("RATING_TOO_HIGH")
    if any(term in text for term in ("低すぎ", "遅すぎ", "もっと高")):
        labels.append("RATING_TOO_LOW")
    if any(term in text for term in ("昔", "過去", "以前", "全盛期")) and "反映" in text:
        labels.append("STALE_RATING")
    if any(term in text for term in ("年齢", "衰え", "劣化")) and "反映" in text:
        labels.append("AGING_NOT_REFLECTED")
    if any(term in text for term in ("怪我", "故障", "けが")) and "反映" in text:
        labels.append("INJURY_NOT_REFLECTED")
    if any(term in text for term in ("一歩目", "加速")) and "反映" in text:
        labels.append("ACCELERATION_NOT_REFLECTED")
    return labels or ["UNCLASSIFIED_CONTEXT"]


def base_record(video: dict[str, Any], collected_at: str, api_status: str, api_note: str) -> dict[str, Any]:
    video_id = str(video.get("id") or "")
    title = str(video.get("title") or "")
    published_at = iso_timestamp(video.get("timestamp"))
    if not published_at:
        published_at = str(video.get("upload_date") or "")
    comment_values = [comment.get("like_count") or 0 for comment in video.get("comments") or []]
    return {
        "game": "PowerPro",
        "edition": "",
        "update_date": "",
        "platform": "YouTube",
        "source_url": f"https://www.youtube.com/watch?v={video_id}",
        "video_id_or_post_id": video_id,
        "parent_event_id": f"yt:video:{video_id}",
        "author_id_or_name": f"{video.get('channel') or video.get('uploader') or ''} ({video.get('channel_id') or video.get('uploader_id') or ''})".strip(),
        "timestamp": published_at,
        "likes": video.get("like_count"),
        "reply_count": "",
        "independence_group": f"yt:video:{video_id}",
        "physical_or_rating_lane": "RATING",
        "target_rating_if_explicit": "",
        "comparison_player_if_any": "",
        "collected_at": collected_at,
        "event_id": f"yt:video:{video_id}",
        "origin_count": 1,
        "comment_count": video.get("comment_count"),
        "like_sum": sum(comment_values),
        "top_like_count": max(comment_values, default=0),
        "video_title": title,
        "video_published_at": published_at,
        "player_game_update_mapping": "",
        "missingness": "",
        "user_input_requirement": "For complete/paginated comment coverage or reproducible API provenance, provide YouTube Data API v3 commentThreads JSON/CSV with video ID, comment ID, author channel ID/name, publishedAt, text, likeCount, parent ID, and reply count.",
        "api_state": f"{api_status}; {api_note}",
    }


def collect_video(candidate: dict[str, str], players: list[dict[str, str]], known_ids: set[str], api_status: str, api_note: str) -> dict[str, int]:
    collected_at = now_utc()
    video_id = candidate["video_id"]
    info, error, command_string, _ = run_ytdlp(video_id)
    if info is None:
        record = {
            "record_id": f"PPYT-RUN2-VIDEO-{video_id}",
            "player": "",
            "canonical_player_id": "",
            "game": "PowerPro",
            "edition": candidate["edition"],
            "update_date": "",
            "platform": "YouTube",
            "source_type": candidate["source_type"],
            "source_url": f"https://www.youtube.com/watch?v={video_id}",
            "video_id_or_post_id": video_id,
            "parent_event_id": f"yt:video:{video_id}",
            "author_id_or_name": "",
            "timestamp": "",
            "text": "",
            "likes": "",
            "reply_count": "",
            "classification": "UNCLASSIFIED_CONTEXT",
            "strength": "CONTEXT",
            "independence_group": f"yt:video:{video_id}",
            "physical_or_rating_lane": "RATING",
            "target_rating_if_explicit": "",
            "comparison_player_if_any": "",
            "source_quality": "OFFICIAL_CHANNEL_TARGET_UNRETRIEVED",
            "notes": candidate["scope_note"],
            "acceptance_status": "CONNECTION_FAILED",
            "acceptance_reason": "Public metadata/comments could not be retrieved; this is a collection failure, not evidence of no rating comments.",
            "acquisition_status": "CONNECTION_FAILED",
            "error": error,
            "attempted_routes": command_string,
            "collected_at": collected_at,
            "event_id": f"yt:video:{video_id}",
            "origin_count": 0,
            "comment_count": "",
            "like_sum": 0,
            "top_like_count": 0,
            "video_title": "",
            "video_published_at": "",
            "player_game_update_mapping": "NOT_RETRIEVED",
            "missingness": "CONNECTION_FAILED",
            "user_input_requirement": "Provide an official video URL and YouTube Data API v3 commentThreads export if the public route remains unavailable.",
            "api_state": f"{api_status}; {api_note}",
        }
        append_record(record, known_ids)
        append_log(f"- {collected_at} `{video_id}`: CONNECTION_FAILED. {error}")
        return {"videos": 1, "metadata": 0, "comments": 0, "candidates": 0, "failures": 1}

    actual_channel_id = str(info.get("channel_id") or info.get("uploader_id") or "")
    if actual_channel_id != OFFICIAL_CHANNEL_ID:
        raise RuntimeError(f"{video_id} uploader ID {actual_channel_id!r} does not match the official channel ID")
    record = base_record(info, collected_at, api_status, api_note)
    record.update(
        {
            "record_id": f"PPYT-RUN2-VIDEO-{video_id}",
            "player": "",
            "canonical_player_id": "",
            "edition": candidate["edition"],
            "source_type": candidate["source_type"],
            "text": str(info.get("title") or ""),
            "classification": "UNCLASSIFIED_CONTEXT",
            "strength": "CONTEXT",
            "source_quality": "OFFICIAL_CHANNEL_CONFIRMED",
            "notes": candidate["scope_note"],
            "acceptance_status": "INSUFFICIENT",
            "acceptance_reason": "A public comment sample was retrieved and screened. The video itself is not enough to establish a current-player running-rating claim.",
            "acquisition_status": "METADATA_AND_PUBLIC_COMMENT_SAMPLE_COLLECTED" if info.get("comments") else "METADATA_COLLECTED_COMMENTS_NOT_FOUND",
            "error": error or "NONE",
            "attempted_routes": command_string,
        }
    )
    title_and_description = f"{info.get('title') or ''}\n{info.get('description') or ''}"
    title_matches = explicit_player_matches(title_and_description, players)
    record["player_game_update_mapping"] = (
        "; ".join(f"{match['player']} ({match['canonical_player_id']}) title/description mention only" for match in title_matches)
        if title_matches
        else "NO_SAFE_CURRENT_100_PLAYER_MAPPING_FROM_TITLE_OR_DESCRIPTION"
    )
    record["missingness"] = (
        "INSUFFICIENT_CURRENT_PLAYER_RATING_MAPPING"
        if not title_matches
        else "INSUFFICIENT_EXPLICIT_SPEED_RATING_IN_VIDEO_METADATA"
    )

    comments = list(info.get("comments") or [])
    keyword_candidates = 0
    mapped_directional_candidates = 0
    for comment in comments:
        text = str(comment.get("text") or "")
        has_speed = any(term in text for term in SPEED_TERMS)
        has_rating = any(term in text for term in RATING_TERMS)
        if not (has_speed and has_rating):
            continue
        keyword_candidates += 1
        matched_players = explicit_player_matches(text, players)
        labels = direction_labels(text)
        directional = any(label != "UNCLASSIFIED_CONTEXT" for label in labels)
        if matched_players and directional:
            mapped_directional_candidates += 1
            status = "CANDIDATE_REQUIRES_MANUAL_REVIEW"
            strength = "RATING_COMMUNITY"
            reason = "Explicit current-master-name and rating-direction terms were detected mechanically; retain for human classification rather than treating it as a rating conclusion."
            missingness = "MANUAL_SEMANTIC_REVIEW_REQUIRED"
        else:
            status = "INSUFFICIENT"
            strength = "CONTEXT"
            reason = "Comment contains broad speed/rating terms but lacks both a safely mapped current target and an explicit high/low/stale direction."
            missingness = "INSUFFICIENT_SAFE_PLAYER_MAPPING_OR_DIRECTION"
        comment_id = str(comment.get("id") or f"sample-{keyword_candidates}")
        comment_record = dict(record)
        comment_record.update(
            {
                "record_id": f"PPYT-RUN2-COMMENT-{video_id}-{comment_id}",
                "player": "; ".join(match["player"] for match in matched_players),
                "canonical_player_id": "; ".join(match["canonical_player_id"] for match in matched_players),
                "source_type": "YOUTUBE_OFFICIAL_PUBLIC_COMMENT",
                "source_url": f"https://www.youtube.com/watch?v={video_id}&lc={comment_id}",
                "author_id_or_name": f"{comment.get('author') or ''} ({comment.get('author_id') or ''})".strip(),
                "timestamp": iso_timestamp(comment.get("timestamp")),
                "text": text,
                "likes": comment.get("like_count"),
                "reply_count": comment.get("reply_count"),
                "classification": "; ".join(labels),
                "strength": strength,
                "target_rating_if_explicit": "",
                "source_quality": "OFFICIAL_CHANNEL_PUBLIC_COMMENT",
                "notes": "Public comment sampled through yt-dlp. Same video is one independence group; comment count/likes are event-level volume, not independent physical observations.",
                "acceptance_status": status,
                "acceptance_reason": reason,
                "missingness": missingness,
                "comment_count": len(comments),
                "like_sum": "",
                "top_like_count": "",
            }
        )
        append_record(comment_record, known_ids)

    record["notes"] = (
        f"{candidate['scope_note']} Public yt-dlp sample: {len(comments)} comments (default newest ordering); "
        f"{keyword_candidates} broad speed+rating keyword candidates; {mapped_directional_candidates} safely-name-mapped directional candidates. "
        "Comment/reaction volume remains event-level context only."
    )
    if mapped_directional_candidates == 0:
        record["acceptance_reason"] = (
            f"Retrieved {len(comments)} public comments; screened {keyword_candidates} broad speed+rating keyword candidates and found no safely current-master-name-mapped directional rating claim. "
            "This is only a sample-level insufficiency finding, not proof that no comment exists."
        )
    append_record(record, known_ids)
    append_log(
        f"- {collected_at} `{video_id}`: metadata OK; official channel verified; comments={len(comments)}, "
        f"speed+rating candidates={keyword_candidates}, mapped directional candidates={mapped_directional_candidates}; error={error or 'NONE'}."
    )
    return {"videos": 1, "metadata": 1, "comments": len(comments), "candidates": keyword_candidates, "failures": 0}


def main() -> int:
    if not MASTER_PATH.exists():
        raise RuntimeError(f"master player source is missing: {MASTER_PATH}")
    if not shutil_which("yt-dlp"):
        raise RuntimeError("yt-dlp is not available on PATH")
    ensure_csv_header()
    known_ids = existing_record_ids()
    players = load_master_players()
    api_status, api_note = api_state()
    collected_at = now_utc()
    append_log(
        "# SP-033 PowerPro official YouTube run2 execution log\n\n"
        f"- started_at: {collected_at}\n"
        "- UTF-8 output: explicit UTF-8 is used for CSV, JSONL, log, source read, and temporary info JSON.\n"
        "- preflight_manual_command: `yt-dlp --no-update --skip-download --no-playlist --print ... https://www.youtube.com/watch?v=wOjrANePk1c`\n"
        "- preflight_result: SUCCESS before this collection; video/channel metadata returned and `--no-update` was not passed as a proxy host.\n"
        "- comment_manual_command: `yt-dlp --no-update --skip-download --no-playlist --write-info-json --write-comments --extractor-args youtube:max_comments=20,20,20,20 ...`\n"
        "- comment_manual_result: SUCCESS before this collection; wOjrANePk1c returned official metadata and 20 public comments.\n"
        "- discovery_routes: official `/videos` flat inventory (300 newest) and official channel searches for `選手能力`, `選手データ`, `アップデート`, `走力`, and `2026`; no current-player PowerPro ability/update video was asserted merely from a title.\n"
        "- run2 output boundary: only the two staging files and this log are written; legacy accepted/rejected artifacts and task registry are not touched.\n"
    )
    summary = {"videos": 0, "metadata": 0, "comments": 0, "candidates": 0, "failures": 0}
    for candidate in VIDEO_CANDIDATES:
        result = collect_video(candidate, players, known_ids, api_status, api_note)
        for key, value in result.items():
            summary[key] += value
    finished_at = now_utc()
    append_log(
        f"- finished_at: {finished_at}\n"
        f"- summary: videos={summary['videos']}, metadata_success={summary['metadata']}, public_comments_retrieved={summary['comments']}, "
        f"speed_rating_keyword_candidates={summary['candidates']}, connection_failures={summary['failures']}, api_state={api_status}.\n"
    )
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


def shutil_which(command: str) -> str | None:
    # Import locally to keep the module list above focused on the data path.
    import shutil

    return shutil.which(command)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise

#!/usr/bin/env python3
"""Collect the SP-034 Prospi official-YouTube lane without touching run1 data.

Every collected video and retained speed-related comment is appended immediately
to the run2 staging CSV/JSONL.  yt-dlp is called as an argument vector (never a
shell string) so an option such as --no-update cannot become a proxy value.
"""

from __future__ import annotations

import csv
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MASTER_PATH = ROOT / "outputs/derived/speed_2026_100_owner_review_master_20260813.csv"
OUT_CSV = ROOT / "outputs/derived/_staging_speed_youtube_prospi_run2.csv"
OUT_JSONL = ROOT / "outputs/derived/_staging_speed_youtube_prospi_run2.jsonl"
LOG_PATH = ROOT / "outputs/derived/speed_youtube_prospi_run2_execution_log.md"

CHANNEL_ID = "UCWzEh28vj3mQKpe0fzVTOUw"
CHANNEL_URL = f"https://www.youtube.com/channel/{CHANNEL_ID}/videos"
CHANNEL_NAME = "パワプロ・プロスピ公式チャンネル"
CHANNEL_LIMIT = 300  # "2026/直近" lane; do not represent this as the whole archive.

FIELDS = [
    "record_id", "player", "canonical_player_id", "game", "edition", "update_date",
    "platform", "source_type", "source_url", "video_id", "video_id_or_post_id",
    "parent_event_id", "author_id_or_name", "timestamp", "text", "likes", "reply_count",
    "classification", "strength", "independence_group", "physical_or_rating_lane",
    "target_rating_if_explicit", "comparison_player_if_any", "source_quality", "notes",
    "acceptance_status", "acceptance_reason", "collected_at", "attempted_routes", "error",
    "title", "published_at", "target_player_mapping", "update_mapping", "missingness",
    "required_user_input", "official_verification", "comments_retrieved",
    "comment_count_reported", "api_state",
]

PROSPI_MARKERS = ("プロスピ", "プロ野球スピリッツ")
ABILITY_MARKERS = (
    "能力", "能力値", "査定", "選手発表", "選手紹介", "選手追加", "アップデート",
    "更新", "セレクション", "エキサイティング", "アニバーサリー", "アニバ",
    "タイムスリップ", "TS", "OB",
)
SPEED_TERMS = ("走力", "足", "俊足", "鈍足", "遅", "速", "スピード", "加速", "一歩目", "走塁")


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_log(line: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8", newline="\n") as fh:
        fh.write(line.rstrip() + "\n")


def compact(value: str | None) -> str:
    return re.sub(r"[\s　]+", "", value or "")


def clean_error(value: str) -> str:
    value = value.strip()
    return value[-4000:] if len(value) > 4000 else value


def ytdlp(args: list[str]) -> tuple[dict[str, Any] | None, str | None, list[str]]:
    """Run one yt-dlp command with no proxy flag/value and no user config."""
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--skip-download",
        *args,
    ]
    env = os.environ.copy()
    removed_proxy_vars = []
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        if key in env:
            removed_proxy_vars.append(key)
            env.pop(key, None)
    try:
        result = subprocess.run(
            command,
            cwd=ROOT,
            env=env,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=120,
            check=False,
        )
    except Exception as exc:  # Preserve exact exception text as a lane record.
        return None, f"{type(exc).__name__}: {exc}", removed_proxy_vars
    if result.returncode != 0:
        stderr = clean_error(result.stderr or result.stdout or f"yt-dlp exited {result.returncode}")
        return None, stderr, removed_proxy_vars
    try:
        return json.loads(result.stdout), None, removed_proxy_vars
    except json.JSONDecodeError as exc:
        return None, f"JSONDecodeError: {exc}; stdout={clean_error(result.stdout)}", removed_proxy_vars


def existing_record_ids() -> set[str]:
    ids: set[str] = set()
    if not OUT_JSONL.exists():
        return ids
    with OUT_JSONL.open("r", encoding="utf-8") as fh:
        for number, line in enumerate(fh, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                write_log(f"- Existing JSONL parse error at line {number}; preserved and skipped for resume detection.")
                continue
            if record.get("record_id"):
                ids.add(str(record["record_id"]))
    return ids


def append_record(record: dict[str, Any], seen: set[str]) -> bool:
    record_id = str(record["record_id"])
    if record_id in seen:
        return False
    normalized = {field: record.get(field) for field in FIELDS}
    normalized["classification"] = json.dumps(normalized["classification"], ensure_ascii=False) if isinstance(normalized["classification"], list) else normalized["classification"]
    with OUT_JSONL.open("a", encoding="utf-8", newline="\n") as jsonl:
        jsonl.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    new_file = not OUT_CSV.exists()
    with OUT_CSV.open("a", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDS, extrasaction="ignore")
        if new_file:
            writer.writeheader()
        writer.writerow(normalized)
    seen.add(record_id)
    return True


def load_players() -> list[dict[str, str]]:
    with MASTER_PATH.open("r", encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    if len(rows) != 100:
        raise RuntimeError(f"Expected exactly 100 master rows; got {len(rows)} from {MASTER_PATH}")
    return rows


def match_players(text: str, players: list[dict[str, str]]) -> list[dict[str, str]]:
    normalized = compact(text)
    matches = []
    for player in players:
        name = compact(player["player"])
        if name and name in normalized:
            matches.append(player)
    return matches


def player_mapping(players: list[dict[str, str]]) -> str:
    if not players:
        return "NO_CURRENT_100_PLAYER_FULL_NAME_MATCH"
    return "; ".join(f"{p['player']} (player_id={p['player_id']})" for p in players)


def iso_from_info(info: dict[str, Any]) -> str | None:
    timestamp = info.get("timestamp") or info.get("release_timestamp")
    if isinstance(timestamp, (int, float)):
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    upload_date = info.get("upload_date")
    if isinstance(upload_date, str) and re.fullmatch(r"\d{8}", upload_date):
        return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
    return None


def rate_direction(text: str) -> tuple[list[str], str]:
    value = compact(text)
    labels: list[str] = []
    if any(term in value for term in ("高すぎ", "盛りすぎ", "盛り過ぎ", "過大", "速すぎ", "速過ぎ")):
        labels.append("RATING_TOO_HIGH")
    if any(term in value for term in ("低すぎ", "低過ぎ", "過小", "遅すぎ", "遅過ぎ", "もっと走力")):
        labels.append("RATING_TOO_LOW")
    if any(term in value for term in ("昔", "全盛期", "若い頃", "往年")):
        labels.append("STALE_RATING")
    if any(term in value for term in ("年齢", "歳", "衰え", "劣化")):
        labels.append("AGING_NOT_REFLECTED")
    if "怪我" in value or "ケガ" in value or "故障" in value:
        labels.append("INJURY_NOT_REFLECTED")
    if any(term in value for term in ("加速", "一歩目")):
        labels.append("ACCELERATION_NOT_REFLECTED")
    if not labels:
        labels = ["UNCLASSIFIED_CONTEXT"]
    strength = "RATING_COMMUNITY" if any(label.startswith("RATING_") or label.endswith("NOT_REFLECTED") or label == "STALE_RATING" for label in labels) else "CONTEXT"
    return labels, strength


def user_input_requirement() -> str:
    return (
        "For exhaustive/reproducible comment coverage, provide YouTube Data API commentThreads/replies JSON or CSV "
        "with videoId, comment ID, parent ID, authorChannelId/displayName, publishedAt, text, likeCount, replyCount."
    )


def base_record(*, record_id: str, source_type: str, source_url: str, video_id: str, title: str | None,
                published_at: str | None, mapping: str, update_mapping: str, collected_at: str) -> dict[str, Any]:
    return {
        "record_id": record_id,
        "player": None,
        "canonical_player_id": None,
        "game": "Pro Yakyuu Spirits A",
        "edition": "2026/most-recent official channel inventory",
        "update_date": published_at[:10] if published_at else None,
        "platform": "YouTube",
        "source_type": source_type,
        "source_url": source_url,
        "video_id": video_id,
        "video_id_or_post_id": video_id,
        "parent_event_id": f"youtube:{video_id}",
        "author_id_or_name": None,
        "timestamp": published_at,
        "text": None,
        "likes": None,
        "reply_count": None,
        "classification": ["UNCLASSIFIED_CONTEXT"],
        "strength": "CONTEXT",
        "independence_group": f"youtube:{video_id}",
        "physical_or_rating_lane": "rating",
        "target_rating_if_explicit": None,
        "comparison_player_if_any": None,
        "source_quality": "OFFICIAL_YOUTUBE_CHANNEL",
        "notes": None,
        "acceptance_status": "INSUFFICIENT",
        "acceptance_reason": None,
        "collected_at": collected_at,
        "attempted_routes": "yt-dlp direct official-channel collection; --ignore-config; --no-update; no --proxy argument",
        "error": None,
        "title": title,
        "published_at": published_at,
        "target_player_mapping": mapping,
        "update_mapping": update_mapping,
        "missingness": None,
        "required_user_input": user_input_requirement(),
        "official_verification": f"channel_id={CHANNEL_ID}; channel_name={CHANNEL_NAME}",
        "comments_retrieved": None,
        "comment_count_reported": "NOT_PUBLICLY_RETURNED_BY_YTDLP",
        "api_state": "NOT_CONFIGURED_ENV; no YouTube Data API key was supplied",
    }


def is_prospi_entry(title: str) -> bool:
    return any(marker in title for marker in PROSPI_MARKERS)


def is_comment_candidate(title: str, mapping_players: list[dict[str, str]]) -> bool:
    return bool(mapping_players) or any(marker in title for marker in ABILITY_MARKERS)


def run() -> int:
    collected_at = now_utc()
    write_log("# SP-034 Prospi official YouTube collection — run2")
    write_log("")
    write_log(f"- Started: {collected_at}")
    write_log("- Manual preflight before this script: `yt-dlp --ignore-config --no-update --no-warnings --flat-playlist --playlist-end 1 --dump-single-json <official-channel-url>` succeeded; no `--no-update` proxy-host error.")
    write_log("- Comment preflight before this script: `--get-comments --extractor-args youtube:max_comments=1` succeeded. The unsupported `--max-comments` option was rejected before collection and is not used here.")
    write_log("- Script calls yt-dlp with a subprocess argument list and strips proxy environment variables; it never passes a `--proxy` value.")

    seen = existing_record_ids()
    players = load_players()
    flat, flat_error, removed_proxy_vars = ytdlp([
        "--flat-playlist", "--playlist-end", str(CHANNEL_LIMIT), "--dump-single-json", CHANNEL_URL,
    ])
    if flat_error:
        record = base_record(
            record_id="SP034-RUN2-CHANNEL-INVENTORY", source_type="official_youtube_channel_inventory_failure",
            source_url=CHANNEL_URL, video_id=CHANNEL_ID, title=f"{CHANNEL_NAME} - Videos", published_at=None,
            mapping="NO_VIDEO_MAPPING_BECAUSE_CHANNEL_INVENTORY_FAILED", update_mapping="NOT_RETRIEVED", collected_at=collected_at,
        )
        record.update({
            "acceptance_status": "CONNECTION_FAILED" if "Unable to connect" in flat_error or "Connection" in flat_error else "NOT_FOUND",
            "acceptance_reason": "Official channel inventory could not be retrieved; no absence-of-evidence inference is valid.",
            "error": flat_error,
            "missingness": "CHANNEL_INVENTORY_NOT_RETRIEVED",
            "required_user_input": "Provide an official-channel video CSV/JSON with video ID, URL, title, and publishedAt, then rerun comment collection.",
        })
        append_record(record, seen)
        write_log(f"- Channel inventory failed: `{flat_error}`")
        return 2

    entries = [entry for entry in (flat or {}).get("entries", []) if isinstance(entry, dict)]
    prospi_entries = [entry for entry in entries if is_prospi_entry(str(entry.get("title") or ""))]
    write_log(f"- Official channel flat inventory returned {len(entries)} latest entries; {len(prospi_entries)} title-matched Prospi entries. Removed proxy env names for subprocess: {', '.join(removed_proxy_vars) or 'none'}.")
    print(f"flat_entries={len(entries)} prospi_title_entries={len(prospi_entries)}", flush=True)

    counts = {"inventory": 0, "comment_candidates": 0, "comments_retrieved": 0, "speed_term_comments": 0, "accepted": 0, "failures": 0}
    for position, entry in enumerate(prospi_entries, start=1):
        video_id = str(entry.get("id") or "")
        title_from_flat = str(entry.get("title") or "")
        if not video_id:
            continue
        source_url = f"https://www.youtube.com/watch?v={video_id}"
        metadata, metadata_error, _ = ytdlp(["--no-get-comments", "--dump-single-json", source_url])
        if metadata_error:
            record = base_record(
                record_id=f"SP034-RUN2-VIDEO-{video_id}", source_type="official_youtube_video_inventory",
                source_url=source_url, video_id=video_id, title=title_from_flat, published_at=None,
                mapping="NOT_EVALUATED_BECAUSE_METADATA_RETRIEVAL_FAILED", update_mapping="NOT_RETRIEVED", collected_at=now_utc(),
            )
            record.update({
                "acceptance_status": "CONNECTION_FAILED" if "Unable to connect" in metadata_error or "Connection" in metadata_error else "NOT_FOUND",
                "acceptance_reason": "Official video metadata retrieval failed; comments were not attempted for this video.",
                "error": metadata_error,
                "missingness": "VIDEO_METADATA_NOT_RETRIEVED",
                "required_user_input": "Provide this official video metadata and comment export if the route remains unavailable.",
            })
            append_record(record, seen)
            counts["failures"] += 1
            write_log(f"- Video {video_id} metadata failed: `{metadata_error}`")
            continue

        title = str(metadata.get("title") or title_from_flat)
        published_at = iso_from_info(metadata)
        mapping_players = match_players(f"{title}\n{metadata.get('description') or ''}", players)
        mapping = player_mapping(mapping_players)
        candidate = is_comment_candidate(title, mapping_players)
        update_mapping = "ability_or_update_title_marker" if any(marker in title for marker in ABILITY_MARKERS) else "current/player-event title without explicit ability marker"
        record = base_record(
            record_id=f"SP034-RUN2-VIDEO-{video_id}", source_type="official_youtube_video_inventory",
            source_url=source_url, video_id=video_id, title=title, published_at=published_at,
            mapping=mapping, update_mapping=update_mapping, collected_at=now_utc(),
        )
        record["notes"] = f"Prospi title match in latest-{CHANNEL_LIMIT} official channel inventory; comment_candidate={candidate}."
        record["missingness"] = "NO_YOUTUBE_DATA_API_KEY; public yt-dlp route is bounded to retained speed-term comments" if candidate else "COMMENTS_NOT_ATTEMPTED_NOT_AN_ABILITY_OR_CURRENT_100_PLAYER_CANDIDATE"
        record["acceptance_reason"] = "Inventory record only; title/metadata alone is not a speed-rating claim."
        if not candidate:
            record["acceptance_status"] = "INSUFFICIENT"
            append_record(record, seen)
            counts["inventory"] += 1
            continue

        counts["comment_candidates"] += 1
        comments_info, comments_error, _ = ytdlp([
            "--get-comments", "--extractor-args", "youtube:comment_sort=top;max_comments=300,300,100,20,2",
            "--dump-single-json", source_url,
        ])
        if comments_error:
            record.update({
                "acceptance_status": "CONNECTION_FAILED" if "Unable to connect" in comments_error or "Connection" in comments_error else "NOT_FOUND",
                "acceptance_reason": "Video metadata was retrieved, but public comment retrieval failed. This does not establish comment absence.",
                "error": comments_error,
                "missingness": "COMMENTS_NOT_RETRIEVED",
            })
            append_record(record, seen)
            counts["failures"] += 1
            write_log(f"- Video {video_id} comments failed: `{comments_error}`")
            continue

        comments = [comment for comment in comments_info.get("comments", []) if isinstance(comment, dict)]
        counts["comments_retrieved"] += len(comments)
        record["comments_retrieved"] = len(comments)
        record["missingness"] = "COMMENTS_BOUNDED_TO_YTDLP_MAX_300; full API pagination unavailable"
        record["acceptance_status"] = "INSUFFICIENT"
        record["acceptance_reason"] = "Comments were retrieved and screened below; video-level inventory is not an independent speed-rating observation."
        append_record(record, seen)
        counts["inventory"] += 1

        speed_comment_count = 0
        for comment in comments:
            text = str(comment.get("text") or "")
            if not any(term in text for term in SPEED_TERMS):
                continue
            speed_comment_count += 1
            counts["speed_term_comments"] += 1
            comment_id = str(comment.get("id") or f"index-{speed_comment_count}")
            comment_matches = match_players(text, players)
            labels, strength = rate_direction(text)
            accepted = bool(comment_matches) and strength == "RATING_COMMUNITY"
            if accepted:
                counts["accepted"] += 1
            comment_timestamp = comment.get("timestamp")
            timestamp = datetime.fromtimestamp(comment_timestamp, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z") if isinstance(comment_timestamp, (int, float)) else None
            target_rating_match = re.search(r"(?:走力|スピード)\s*([0-9]{2})", text)
            comment_record = base_record(
                record_id=f"SP034-RUN2-COMMENT-{video_id}-{comment_id}", source_type="official_youtube_comment",
                source_url=f"{source_url}&lc={comment_id}", video_id=video_id, title=title,
                published_at=published_at, mapping=player_mapping(comment_matches), update_mapping=update_mapping,
                collected_at=now_utc(),
            )
            comment_record.update({
                "player": comment_matches[0]["player"] if len(comment_matches) == 1 else None,
                "canonical_player_id": comment_matches[0]["player_id"] if len(comment_matches) == 1 else None,
                "video_id_or_post_id": comment_id,
                "parent_event_id": f"youtube:{video_id}:{comment.get('parent') or 'root'}",
                "author_id_or_name": "|".join(filter(None, [str(comment.get("author") or ""), str(comment.get("author_id") or "")])),
                "timestamp": timestamp,
                "text": text,
                "likes": comment.get("like_count"),
                "reply_count": "NOT_PUBLICLY_RETURNED_BY_YTDLP",
                "classification": labels,
                "strength": strength,
                "target_rating_if_explicit": target_rating_match.group(1) if target_rating_match else None,
                "source_quality": "OFFICIAL_YOUTUBE_PUBLIC_COMMENT",
                "notes": "Retained because it contains a broad speed-related term; classification does not make it a physical-speed teacher.",
                "acceptance_status": "ACCEPTED" if accepted else "INSUFFICIENT",
                "acceptance_reason": "Current-100-player identity and explicit rating-direction language present." if accepted else "Retained without inference: missing a safe current-100-player identity and/or explicit speed-rating direction.",
                "missingness": "YTDLP_BOUNDED_PUBLIC_COMMENT_SAMPLE; replies/total comment count may be incomplete",
                "comments_retrieved": len(comments),
            })
            append_record(comment_record, seen)

        write_log(f"- Video {video_id}: comments_retrieved={len(comments)}, retained_speed_term_comments={speed_comment_count}, mapping={mapping}.")
        print(f"video={position}/{len(prospi_entries)} id={video_id} comments={len(comments)} speed_terms={speed_comment_count}", flush=True)

    write_log("")
    write_log("## Result")
    for key, value in counts.items():
        write_log(f"- {key}: {value}")
    write_log(f"- Finished: {now_utc()}")
    print(json.dumps(counts, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(run())
    except Exception as exc:
        write_log(f"- FATAL {type(exc).__name__}: {exc}")
        print(f"FATAL {type(exc).__name__}: {exc}", file=sys.stderr)
        raise

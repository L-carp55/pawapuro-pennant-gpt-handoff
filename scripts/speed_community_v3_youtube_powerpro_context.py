#!/usr/bin/env python3
"""Recover row-level PowerPro comment/reply context for the V3 lane.

The primary PowerPro worker retained per-video retrieval counts and candidate
rows but did not leave the full comment rows in its raw JSONL.  This bounded
pass reruns the 35 relevant videos from the fresh official-channel QA, stores
every returned comment/reply with root/parent/title context, and preserves
timeouts or extractor errors as explicit missingness.
"""

from __future__ import annotations

import csv
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from speed_community_v3_youtube_powerpro import (
    DATE_FROM,
    DATE_TO,
    OFFICIAL_CHANNEL_ID,
    OFFICIAL_CHANNEL_NAME,
    ROOT,
    candidate_fields,
    comment_root_ids,
    context_and_identity,
    is_candidate,
    load_master,
    now_utc,
    parse_reported_count,
    run_command,
    safe_short_description,
)


DERIVED = ROOT / "outputs" / "derived"
SOURCE_QA = DERIVED / "speed_community_v3_powerpro_qa_20260815.json"
METADATA = DERIVED / "speed_community_v3_official_video_metadata_20260814.jsonl"
SCAN = DERIVED / "speed_community_v3_official_channel_scan_20260814.json"

OUT_INVENTORY = DERIVED / "speed_community_v3_powerpro_context_inventory_20260815.csv"
OUT_RAW = DERIVED / "speed_community_v3_powerpro_context_raw_20260815.jsonl"
OUT_CANDIDATES = DERIVED / "speed_community_v3_powerpro_context_candidates_20260815.jsonl"
OUT_LOG = DERIVED / "speed_community_v3_powerpro_context_collection_log_20260815.json"

TIMEOUT_SECONDS = 300
MAX_WORKERS = 6


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows), encoding="utf-8")


def metadata_by_id() -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in read_jsonl(METADATA):
        video_id = str(row.get("video_id") or row.get("id") or "")
        if video_id:
            result[video_id] = row
    if SCAN.exists():
        scan = json.loads(SCAN.read_text(encoding="utf-8"))
        for row in scan.get("entries", []):
            video_id = str(row.get("id") or row.get("video_id") or "")
            if video_id and video_id not in result:
                result[video_id] = {"video_id": video_id, "title": row.get("title") or "", "metadata_status": "UNVERIFIED"}
    return result


def target_ids() -> list[str]:
    if not SOURCE_QA.exists():
        raise FileNotFoundError(SOURCE_QA)
    qa = json.loads(SOURCE_QA.read_text(encoding="utf-8"))
    return [str(row["video_id"]) for row in qa.get("collection", {}).get("per_video", []) if row.get("video_id")]


def run_comments(video_id: str) -> dict[str, Any]:
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--no-progress", "--skip-download",
        "--no-playlist", "--get-comments", "--dump-single-json", "--extractor-args",
        "youtube:comment_sort=new;max_comments=all,all,all,all,all", f"https://www.youtube.com/watch?v={video_id}",
    ]
    started = now_utc()
    try:
        code, stdout, stderr = run_command(command, timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return {"video_id": video_id, "status": "TIMEOUT", "error": f"timeout_after_{TIMEOUT_SECONDS}s", "comments": [], "info": {}, "started": started, "command": command}
    if code != 0:
        return {"video_id": video_id, "status": "ERROR", "error": f"exit={code}; {stderr[-2000:]}", "comments": [], "info": {}, "started": started, "command": command}
    try:
        info = json.loads(stdout)
    except json.JSONDecodeError as exc:
        return {"video_id": video_id, "status": "PARSE_ERROR", "error": str(exc), "comments": [], "info": {}, "started": started, "command": command}
    comments = [row for row in (info.get("comments") or []) if isinstance(row, dict) and row.get("id")]
    return {"video_id": video_id, "status": "OK", "error": "", "comments": comments, "info": info, "started": started, "command": command}


def process(target: dict[str, Any], result: dict[str, Any], players: list[dict[str, str]]) -> dict[str, Any]:
    video_id = target["video_id"]
    comments = result["comments"]
    info = result.get("info") or {}
    reported = info.get("comment_count")
    reported_num = parse_reported_count(reported)
    if result["status"] == "OK":
        bound = "YTDLP_ALL_REQUESTED; completeness not independently verified; platform/client pagination may remain"
        if reported_num is not None and len(comments) < reported_num:
            bound += "; retrieved_below_platform_reported_count; unresolved_remainder"
        elif reported_num is None:
            bound += "; platform_reported_count_unavailable; unresolved_remainder"
    else:
        bound = f"{result['status']}; {result['error']}; comments_absence_not_inferred"
    root_ids = comment_root_ids(comments)
    video = {**target, "description_context_short": target["description_short"], "comments": comments, "root_ids": root_ids, "source_url": f"https://www.youtube.com/watch?v={video_id}"}
    by_id = {str(row.get("id")): row for row in comments}
    raw: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    for comment in comments:
        cid = str(comment.get("id"))
        root_id = root_ids.get(cid, cid)
        parent_raw = str(comment.get("parent") or "root")
        context = context_and_identity(comment, by_id, video, players)
        text = str(comment.get("text") or "")
        common = {
            "record_type": "comment_or_reply", "record_id": f"PPV3-CONTEXT-RAW-{video_id}-{cid}", "platform": "YouTube", "game": "PowerPro",
            "source_type": "official_youtube_comment_or_reply", "source_url": f"{video['source_url']}&lc={cid}", "official_channel_id": OFFICIAL_CHANNEL_ID,
            "video_id": video_id, "video_title": target["title"], "published_at": target["published_at"], "video_description_context_short": target["description_short"],
            "comment_id": cid, "parent_comment_id": None if parent_raw == "root" else parent_raw, "root_thread_id": root_id, "author": comment.get("author"),
            "author_id": comment.get("author_id"), "comment_published_at": comment.get("timestamp"), "text": text, "likes": comment.get("like_count"),
            "reply_count": comment.get("reply_count"), "root_comment_text": context.get("root_comment_text"), "immediate_parent_text": context.get("immediate_parent_text"),
            "direct_thread_context": context.get("direct_thread_context"), "context_for_review": context.get("context_for_review"),
            "identity_method": context.get("identity_method"), "identity_confidence": context.get("identity_confidence"), "canonical_player_id": context.get("canonical_player_id"),
            "player": context.get("player"), "independence_group": f"youtube:{video_id}:{root_id}", "event_id": f"youtube:{video_id}:{root_id}",
            "reaction_volume_same_root_thread": sum(1 for row in comments if root_ids.get(str(row.get("id"))) == root_id), "retrieved_count_for_video": len(comments),
            "platform_reported_comment_count": reported, "retrieval_method": "yt-dlp --get-comments", "retrieval_request": "max_comments=all,all,all,all,all",
            "retrieval_bound_or_missingness": bound, "collected_at": result["started"],
        }
        raw.append(common)
        if is_candidate(text, context.get("context_for_review", ""), target["title"], players):
            matched, grades, numbers = candidate_fields(text, context.get("context_for_review", ""))
            candidates.append({**common, "record_type": "candidate", "record_id": f"PPV3-CONTEXT-CAND-{video_id}-{cid}", "source_type": "official_youtube_comment_recall_first_candidate", "matched_terms": matched, "explicit_grades": grades, "explicit_numbers_in_comment": numbers, "candidate_reason": "recall-first speed/rating or explicit grade/value signal in video-title/thread context; not an acceptance decision"})
    inventory = {
        "game": "PowerPro", "video_id": video_id, "title": target["title"], "description_short": target["description_short"], "published_at": target["published_at"],
        "source_url": video["source_url"], "official_channel_id": OFFICIAL_CHANNEL_ID, "official_channel_name": OFFICIAL_CHANNEL_NAME,
        "discovery_method": "official_channel_side_scan_then_bounded_context_recovery", "matched_terms": target.get("matched_terms", ""), "relevant_reason": target.get("relevant_reason", ""),
        "target_players_from_title_if_any": "", "comments_available": result["status"] == "OK", "comments_retrieved": len(comments), "comment_total_reported": reported,
        "retrieval_method": "yt-dlp --get-comments", "retrieval_bound_or_missingness": bound, "already_in_old_inventory": "", "metadata_status": target.get("metadata_status", "OK"), "collection_attempted_at": result["started"],
    }
    return {"video_id": video_id, "status": result["status"], "error": result["error"], "comments_retrieved": len(comments), "candidate_count": len(candidates), "inventory": inventory, "raw": raw, "candidates": candidates}


def main() -> int:
    metadata = metadata_by_id()
    targets: list[dict[str, Any]] = []
    for video_id in target_ids():
        row = metadata.get(video_id, {})
        title = str(row.get("title") or "")
        published_at = str(row.get("published_at") or row.get("upload_date") or "")
        if len(published_at) == 8 and published_at.isdigit():
            published_at = f"{published_at[:4]}-{published_at[4:6]}-{published_at[6:8]}"
        targets.append({"video_id": video_id, "title": title, "published_at": published_at, "description_short": safe_short_description(str(row.get("description") or "")), "metadata_status": "ERROR" if row.get("error") else "OK"})
    players = load_master()
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(run_comments, row["video_id"]): row["video_id"] for row in targets}
        for future in as_completed(futures):
            result = future.result()
            results[result["video_id"]] = result
            print(json.dumps({"video_id": result["video_id"], "status": result["status"], "comments": len(result["comments"])}, ensure_ascii=True), flush=True)
    processed = [process(target, results[target["video_id"]], players) for target in targets]
    inventory = [row["inventory"] for row in processed]
    raw = [item for row in processed for item in row["raw"]]
    candidates = [item for row in processed for item in row["candidates"]]
    fields = ["game", "video_id", "title", "description_short", "published_at", "source_url", "official_channel_id", "official_channel_name", "discovery_method", "matched_terms", "relevant_reason", "target_players_from_title_if_any", "comments_available", "comments_retrieved", "comment_total_reported", "retrieval_method", "retrieval_bound_or_missingness", "already_in_old_inventory", "metadata_status", "collection_attempted_at"]
    with OUT_INVENTORY.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(inventory)
    write_jsonl(OUT_RAW, raw); write_jsonl(OUT_CANDIDATES, candidates)
    log = {"task": "speed_community_recollection_v3_youtube_powerpro_context", "scope": ["SP-033"], "status": "COMPLETED_BOUNDED", "target_count": len(targets), "videos_ok": sum(row["status"] == "OK" for row in processed), "timeout_count": sum(row["status"] == "TIMEOUT" for row in processed), "error_count": sum(row["status"] not in {"OK", "TIMEOUT"} for row in processed), "comment_rows_recovered": len(raw), "candidate_rows": len(candidates), "requested_comment_bound": "all,all,all,all,all", "timeout_seconds": TIMEOUT_SECONDS, "per_video": [{k: row[k] for k in ["video_id", "status", "error", "comments_retrieved", "candidate_count"]} for row in processed], "output_files": [str(path.relative_to(ROOT)) for path in [OUT_INVENTORY, OUT_RAW, OUT_CANDIDATES, OUT_LOG]], "note": "This pass exists to preserve row-level comment/reply context missing from the primary worker raw file; all-requested retrieval remains bounded public-route evidence, not platform-exhaustive proof."}
    OUT_LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: log[k] for k in ["status", "target_count", "videos_ok", "timeout_count", "error_count", "comment_rows_recovered", "candidate_rows"]}, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

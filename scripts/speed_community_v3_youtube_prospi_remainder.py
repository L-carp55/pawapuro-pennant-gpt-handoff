#!/usr/bin/env python3
"""Bounded completion pass for Prospi videos not finished by the primary worker.

The primary Prospi worker successfully recovered six videos but one very long
request left the remaining lane unfinished.  This pass uses the already
completed official-channel metadata scan, requests all comments/replies for
each remaining relevant video, and records timeout/error missingness instead
of treating an interrupted request as a negative finding.
"""

from __future__ import annotations

import csv
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from speed_community_v3_youtube_prospi import (
    CHANNEL_ID,
    CHANNEL_NAME,
    END_DATE,
    START_DATE,
    candidate_prefilter,
    identity_resolution,
    in_scope,
    is_relevant_prospi,
    load_master,
    now_utc,
    normalize_comment_timestamp,
    resolve_roots,
    semantic_review,
    short_text,
)


ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "outputs" / "derived"
METADATA_PATH = DERIVED / "speed_community_v3_official_video_metadata_20260814.jsonl"
SCAN_PATH = DERIVED / "speed_community_v3_official_channel_scan_20260814.json"
PRIMARY_INVENTORY = DERIVED / "speed_community_v3_prospi_inventory_20260815.csv"

OUT_INVENTORY = DERIVED / "speed_community_v3_prospi_remainder_inventory_20260815.csv"
OUT_RAW = DERIVED / "speed_community_v3_prospi_remainder_raw_20260815.jsonl"
OUT_CANDIDATES = DERIVED / "speed_community_v3_prospi_remainder_candidates_20260815.jsonl"
OUT_SEMANTIC = DERIVED / "speed_community_v3_prospi_remainder_semantic_classified_20260815.jsonl"
OUT_LOG = DERIVED / "speed_community_v3_prospi_remainder_collection_log_20260815.json"

REQUEST_TIMEOUT_SECONDS = 300
MAX_WORKERS = 6


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows),
        encoding="utf-8",
    )


def read_metadata() -> dict[str, dict[str, Any]]:
    rows = read_jsonl(METADATA_PATH)
    by_id: dict[str, dict[str, Any]] = {}
    for row in rows:
        video_id = str(row.get("video_id") or row.get("id") or "")
        if video_id:
            by_id[video_id] = row
    # The flat scan has a title even when a direct metadata request failed.
    if SCAN_PATH.exists():
        scan = json.loads(SCAN_PATH.read_text(encoding="utf-8"))
        for entry in scan.get("entries", []):
            video_id = str(entry.get("id") or entry.get("video_id") or "")
            if video_id and video_id not in by_id:
                by_id[video_id] = {"video_id": video_id, "title": entry.get("title") or "", "metadata_error": "DIRECT_METADATA_NOT_AVAILABLE"}
            elif video_id and entry.get("title") and not by_id[video_id].get("title"):
                by_id[video_id]["title"] = entry["title"]
    return by_id


def primary_completed_ids() -> set[str]:
    if not PRIMARY_INVENTORY.exists():
        return set()
    with PRIMARY_INVENTORY.open("r", encoding="utf-8-sig", newline="") as handle:
        return {str(row.get("video_id") or "") for row in csv.DictReader(handle) if row.get("video_id")}


def relevant_targets(metadata: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    targets: list[dict[str, Any]] = []
    for video_id, row in metadata.items():
        published_at = str(row.get("published_at") or row.get("upload_date") or "")
        if len(published_at) == 8 and published_at.isdigit():
            published_at = f"{published_at[:4]}-{published_at[4:6]}-{published_at[6:8]}"
        if not in_scope(published_at):
            continue
        title = str(row.get("title") or "")
        description = str(row.get("description") or row.get("description_short") or "")
        relevant, matched_terms, relevant_reason = is_relevant_prospi(title, description)
        if not relevant:
            continue
        targets.append({
            "video_id": video_id,
            "title": title,
            "description": description,
            "published_at": published_at,
            "matched_terms": matched_terms,
            "relevant_reason": relevant_reason,
            "metadata_status": "ERROR" if row.get("error") or row.get("metadata_error") else "OK",
        })
    return sorted(targets, key=lambda row: (row["published_at"], row["video_id"]))


def run_comments(video_id: str) -> dict[str, Any]:
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--no-progress", "--skip-download",
        "--no-playlist", "--get-comments", "--extractor-args",
        "youtube:comment_sort=new;max_comments=all,all,all,all,all", "--dump-single-json",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    env = os.environ.copy()
    removed_proxy_names: list[str] = []
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        if key in env:
            removed_proxy_names.append(key)
            env.pop(key, None)
    started = now_utc()
    try:
        result = subprocess.run(
            command,
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=REQUEST_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"video_id": video_id, "status": "TIMEOUT", "error": f"timeout_after_{REQUEST_TIMEOUT_SECONDS}s", "comments": [], "comment_count": None, "started": started, "command": command, "removed_proxy_names": removed_proxy_names}
    except Exception as exc:  # pragma: no cover - transport-specific
        return {"video_id": video_id, "status": "ERROR", "error": f"{type(exc).__name__}: {exc}", "comments": [], "comment_count": None, "started": started, "command": command, "removed_proxy_names": removed_proxy_names}
    if result.returncode != 0:
        return {"video_id": video_id, "status": "ERROR", "error": f"exit={result.returncode}; {(result.stderr or result.stdout)[-1000:]}", "comments": [], "comment_count": None, "started": started, "command": command, "removed_proxy_names": removed_proxy_names}
    try:
        info = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return {"video_id": video_id, "status": "PARSE_ERROR", "error": str(exc), "comments": [], "comment_count": None, "started": started, "command": command, "removed_proxy_names": removed_proxy_names}
    comments = [row for row in (info.get("comments") or []) if isinstance(row, dict) and row.get("id")]
    return {"video_id": video_id, "status": "OK", "error": "", "comments": comments, "comment_count": info.get("comment_count"), "started": started, "command": command, "removed_proxy_names": removed_proxy_names}


def build_rows(target: dict[str, Any], result: dict[str, Any], master_rows: list[dict[str, str]], master_by_name: dict[str, dict[str, str]], by_surname: dict[str, list[dict[str, str]]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    video_id = target["video_id"]
    comments = result["comments"]
    reported = result.get("comment_count")
    if result["status"] == "OK":
        bound = "requested_all_parents_all_replies_all_depth"
        if isinstance(reported, int) and len(comments) < reported:
            bound += "; retrieved_below_platform_reported_count; unresolved_remainder"
        elif not isinstance(reported, int):
            bound += "; platform_reported_count_unavailable; unresolved_remainder"
    else:
        bound = f"{result['status']}; {result['error']}; comments_absence_not_inferred"
    inventory = [{
        "game": "Prospi", "video_id": video_id, "title": target["title"], "description_short": short_text(target["description"]),
        "published_at": target["published_at"], "source_url": f"https://www.youtube.com/watch?v={video_id}",
        "official_channel_id": CHANNEL_ID, "channel_name": CHANNEL_NAME, "discovery_method": "official_channel_side_scan_then_bounded_remainder",
        "matched_terms": ";".join(target["matched_terms"]), "relevant_reason": target["relevant_reason"], "target_players_from_title_if_any": "",
        "comments_available": result["status"] == "OK", "comments_retrieved": len(comments), "platform_reported_comment_count": reported,
        "retrieval_method": "yt-dlp --get-comments", "retrieval_bound_or_missingness": bound,
        "already_in_old_inventory": "", "old_inventory_sources": "", "metadata_status": target["metadata_status"],
        "collection_attempted_at": result["started"],
    }]
    if not comments:
        return inventory, [], []
    roots = resolve_roots(comments)
    by_id = {str(row.get("id")): row for row in comments}
    direct_replies: dict[str, list[dict[str, Any]]] = {}
    for row in comments:
        cid = str(row.get("id"))
        root_id = roots.get(cid) or cid
        parent = row.get("parent")
        if parent not in (None, "", "root"):
            direct_replies.setdefault(root_id, []).append(row)
    raw_rows: list[dict[str, Any]] = []
    candidate_rows: list[dict[str, Any]] = []
    semantic_rows: list[dict[str, Any]] = []
    for comment in comments:
        comment_id = str(comment.get("id"))
        parent_id = str(comment.get("parent")) if comment.get("parent") not in (None, "", "root") else None
        root_id = roots.get(comment_id) or comment_id
        root = by_id.get(root_id) or comment
        parent = by_id.get(parent_id) if parent_id else None
        text = str(comment.get("text") or "")
        parent_text = str(parent.get("text") or "") if parent else ""
        root_text = str(root.get("text") or "")
        source_url = f"https://www.youtube.com/watch?v={video_id}&lc={comment_id}"
        raw = {
            "record_id": f"SP034-V3-REMAINDER-RAW-{video_id}-{comment_id}", "platform": "YouTube", "source_type": "official_youtube_comment_or_reply",
            "game": "Prospi", "edition": "Prospi official YouTube lane", "source_url": source_url, "video_id": video_id,
            "video_title": target["title"], "video_description_short": short_text(target["description"]), "official_channel_id": CHANNEL_ID,
            "channel_name": CHANNEL_NAME, "published_at": normalize_comment_timestamp(comment.get("timestamp")), "comment_id": comment_id,
            "parent_comment_id": parent_id, "root_thread_id": root_id, "thread_role": "reply" if parent_id else "root",
            "author": comment.get("author"), "author_id": comment.get("author_id"), "text": text, "likes": comment.get("like_count"),
            "reply_count": comment.get("reply_count"), "platform_reported_comment_count": reported, "retrieved_count_for_video": len(comments),
            "retrieval_method": "yt-dlp --get-comments", "retrieval_sort": "new", "retrieval_request": "max_comments=all,all,all,all,all",
            "retrieval_bound_or_missingness": bound, "collected_at": result["started"],
        }
        raw_rows.append(raw)
        keep, hits = candidate_prefilter(target["title"], target["description"], root_text, parent_text, text)
        if not keep:
            continue
        candidate = {
            "record_id": f"SP034-V3-REMAINDER-CANDIDATE-{video_id}-{comment_id}", "raw_record_id": raw["record_id"], "platform": "YouTube",
            "game": "Prospi", "source_type": "official_youtube_speed_rating_candidate", "source_url": source_url, "video_id": video_id,
            "video_title": target["title"], "video_description_short": short_text(target["description"]), "official_channel_id": CHANNEL_ID,
            "comment_id": comment_id, "parent_comment_id": parent_id, "root_thread_id": root_id, "candidate_text": text,
            "immediate_parent_text": parent_text, "root_text": root_text,
            "direct_replies": [{"comment_id": str(reply.get("id")), "parent_comment_id": str(reply.get("parent")), "text": str(reply.get("text") or ""), "likes": reply.get("like_count")} for reply in direct_replies.get(root_id, []) if str(reply.get("id")) != comment_id],
            "candidate_extraction_context": "video_title+description+root+immediate_parent+candidate_text", "prefilter_terms": hits,
            "retrieval_method": "yt-dlp --get-comments", "retrieved_count_for_video": len(comments), "platform_reported_comment_count": reported,
            "retrieval_bound_or_missingness": bound,
        }
        candidate.update(identity_resolution(comment_text=text, parent_text=parent_text, root_text=root_text, title=target["title"], description=target["description"], master_rows=master_rows, master_by_name=master_by_name, by_surname=by_surname))
        candidate_rows.append(candidate)
        reviewed = {**candidate, **semantic_review(candidate), "event_id": f"youtube:{video_id}", "independence_group": f"youtube:{video_id}:{root_id}:{candidate.get('canonical_player_id') or candidate.get('player') or 'UNMAPPED'}", "origin_count": 1, "reaction_volume": len(direct_replies.get(root_id, [])) + 1, "comment_count": len(comments)}
        semantic_rows.append(reviewed)
    return inventory, raw_rows, semantic_rows


def main() -> int:
    metadata = read_metadata()
    done = primary_completed_ids()
    targets = [row for row in relevant_targets(metadata) if row["video_id"] not in done]
    master_rows, master_by_name, by_surname = load_master()
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {pool.submit(run_comments, row["video_id"]): row["video_id"] for row in targets}
        for future in as_completed(future_map):
            result = future.result()
            results[result["video_id"]] = result
            print(json.dumps({"video_id": result["video_id"], "status": result["status"], "comments": len(result["comments"])}, ensure_ascii=True), flush=True)
    inventory_rows: list[dict[str, Any]] = []
    raw_rows: list[dict[str, Any]] = []
    candidate_rows: list[dict[str, Any]] = []
    semantic_rows: list[dict[str, Any]] = []
    event_log: list[dict[str, Any]] = []
    for target in targets:
        result = results.get(target["video_id"], {"video_id": target["video_id"], "status": "MISSING_RESULT", "error": "worker_result_missing", "comments": [], "comment_count": None, "started": now_utc()})
        inv, raw, sem = build_rows(target, result, master_rows, master_by_name, by_surname)
        inventory_rows.extend(inv)
        raw_rows.extend(raw)
        semantic_rows.extend(sem)
        candidate_rows.extend([{k: v for k, v in row.items() if k not in {"claim_lane", "rating_direction", "speed_concept", "discourse", "sarcasm_possible", "explicit_rating_value", "explicit_rating_kind", "acceptance_status", "semantic_method", "semantic_context_fields_used", "semantic_note", "event_id", "independence_group", "origin_count", "reaction_volume", "comment_count"}} for row in sem])
        event_log.append({"video_id": target["video_id"], "title": target["title"], "status": result["status"], "error": result.get("error", ""), "comments_retrieved": len(result.get("comments", [])), "platform_reported_comment_count": result.get("comment_count"), "requested_bound": "all_parents_all_replies_all_depth", "timeout_seconds": REQUEST_TIMEOUT_SECONDS})
    fields = [
        "game", "video_id", "title", "description_short", "published_at", "source_url", "official_channel_id", "channel_name", "discovery_method", "matched_terms", "relevant_reason", "target_players_from_title_if_any", "comments_available", "comments_retrieved", "platform_reported_comment_count", "retrieval_method", "retrieval_bound_or_missingness", "already_in_old_inventory", "old_inventory_sources", "metadata_status", "collection_attempted_at",
    ]
    with OUT_INVENTORY.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(inventory_rows)
    write_jsonl(OUT_RAW, raw_rows)
    write_jsonl(OUT_CANDIDATES, candidate_rows)
    write_jsonl(OUT_SEMANTIC, semantic_rows)
    log = {
        "task": "speed_community_recollection_v3_youtube_prospi_remainder",
        "scope": ["SP-034"], "official_channel_id": CHANNEL_ID, "period": {"from": START_DATE, "to": END_DATE},
        "status": "COMPLETED_BOUNDED", "source_metadata": str(METADATA_PATH.relative_to(ROOT)), "target_count": len(targets),
        "completed_count": sum(1 for row in event_log if row["status"] == "OK"), "timeout_count": sum(1 for row in event_log if row["status"] == "TIMEOUT"),
        "error_count": sum(1 for row in event_log if row["status"] not in {"OK", "TIMEOUT"}), "comment_rows_recovered": len(raw_rows),
        "candidate_rows": len(candidate_rows), "semantic_rows": len(semantic_rows), "requested_comment_bound": "all_parents_all_replies_all_depth",
        "per_video": event_log, "note": "Public yt-dlp route was used without a fixed top-100/300 cap; timeout/error rows remain unresolved and are not negative evidence.",
        "output_files": [str(path.relative_to(ROOT)) for path in [OUT_INVENTORY, OUT_RAW, OUT_CANDIDATES, OUT_SEMANTIC, OUT_LOG]],
    }
    OUT_LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: log[k] for k in ["status", "target_count", "completed_count", "timeout_count", "error_count", "comment_rows_recovered", "candidate_rows", "semantic_rows"]}, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Recover already-identified official-YouTube comment texts.

Does not search for new videos. Re-dumps comments for the same video IDs
that run2 already counted (PowerPro 4 + Prospi videos with comments_retrieved).
Raw run2 files are not modified.
"""
from __future__ import annotations

import csv
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "derived"
JSONL = OUT_DIR / "speed_youtube_official_comments_recovered_20260813.jsonl"
MANIFEST = OUT_DIR / "speed_youtube_official_comments_recovery_manifest_20260813.json"
PROSPI_STAGING = OUT_DIR / "_staging_speed_youtube_prospi_run2.jsonl"
POWERPRO_INV = OUT_DIR / "speed_youtube_official_video_inventory_20260813_run2.csv"

CHANNEL_ID = "UCWzEh28vj3mQKpe0fzVTOUw"


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ytdlp_comments(video_id: str, max_comments: str) -> tuple[dict | None, str | None, list[str]]:
    url = f"https://www.youtube.com/watch?v={video_id}"
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--skip-download",
        "--get-comments", "--extractor-args", f"youtube:comment_sort=top;max_comments={max_comments}",
        "--dump-single-json", url,
    ]
    env = os.environ.copy()
    removed = []
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        if key in env:
            removed.append(key)
            env.pop(key, None)
    try:
        result = subprocess.run(
            command, cwd=ROOT, env=env, text=True, encoding="utf-8", errors="replace",
            capture_output=True, timeout=180, check=False,
        )
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}", command
    if result.returncode != 0:
        err = (result.stderr or result.stdout or f"exit {result.returncode}")[-2000:]
        return None, err, command
    try:
        return json.loads(result.stdout), None, command
    except json.JSONDecodeError as exc:
        return None, f"JSONDecodeError: {exc}", command


def load_targets() -> list[dict]:
    targets = []
    if POWERPRO_INV.exists():
        with POWERPRO_INV.open("r", encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                vid = (row.get("video_id") or "").strip()
                if not vid:
                    continue
                sample = int(row.get("comment_sample_size") or 0)
                targets.append({
                    "game": "PowerPro",
                    "video_id": vid,
                    "title": row.get("title"),
                    "prior_comment_count": sample,
                    "max_comments": "100,100,100,100",
                    "source_inventory": str(POWERPRO_INV.relative_to(ROOT)),
                })
    if PROSPI_STAGING.exists():
        with PROSPI_STAGING.open("r", encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                rec = json.loads(line)
                if rec.get("source_type") != "official_youtube_video_inventory":
                    continue
                n = rec.get("comments_retrieved")
                if not (isinstance(n, int) and n > 0):
                    continue
                targets.append({
                    "game": "Pro Yakyuu Spirits A",
                    "video_id": rec.get("video_id"),
                    "title": rec.get("title"),
                    "prior_comment_count": n,
                    "max_comments": "300,300,100,20,2",
                    "source_inventory": str(PROSPI_STAGING.relative_to(ROOT)),
                })
    return targets


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if JSONL.exists():
        JSONL.unlink()
    targets = load_targets()
    manifest = {
        "generated_at": now_utc(),
        "scope": "bounded recovery of comments already counted in run2 inventories; no new video search",
        "channel_id": CHANNEL_ID,
        "targets": [],
        "totals": {"videos": len(targets), "comments_recovered": 0, "videos_failed": 0},
    }
    for target in targets:
        vid = target["video_id"]
        info, err, command = ytdlp_comments(vid, target["max_comments"])
        entry = {
            **target,
            "command": command,
            "recovered": 0,
            "error": err,
            "status": "FAILED" if err else "OK",
        }
        if err or not info:
            manifest["totals"]["videos_failed"] += 1
            manifest["targets"].append(entry)
            print(f"FAIL {vid} {err}", flush=True)
            continue
        comments = [c for c in (info.get("comments") or []) if isinstance(c, dict)]
        entry["recovered"] = len(comments)
        entry["comment_count_reported"] = info.get("comment_count")
        manifest["totals"]["comments_recovered"] += len(comments)
        with JSONL.open("a", encoding="utf-8", newline="\n") as fh:
            for comment in comments:
                rec = {
                    "record_id": f"YT-RECOVER-{vid}-{comment.get('id')}",
                    "game": target["game"],
                    "platform": "YouTube",
                    "source_type": "official_youtube_comment_recovered",
                    "source_url": f"https://www.youtube.com/watch?v={vid}&lc={comment.get('id')}",
                    "video_id": vid,
                    "video_title": info.get("title") or target["title"],
                    "official_channel_id": info.get("channel_id") or CHANNEL_ID,
                    "comment_id": comment.get("id"),
                    "parent": comment.get("parent"),
                    "author": comment.get("author"),
                    "author_id": comment.get("author_id"),
                    "timestamp": comment.get("timestamp"),
                    "text": comment.get("text"),
                    "like_count": comment.get("like_count"),
                    "event_id": f"youtube:{vid}",
                    "independence_group": f"youtube:{vid}",
                    "collected_at": now_utc(),
                    "missingness": "YTDLP_BOUNDED_PUBLIC_COMMENT_RECOVERY; not a YouTube Data API exhaustive dump",
                    "prior_run2_comment_count": target["prior_comment_count"],
                }
                fh.write(json.dumps(rec, ensure_ascii=False, separators=(",", ":")) + "\n")
        manifest["targets"].append(entry)
        print(f"OK {vid} recovered={len(comments)} prior={target['prior_comment_count']}", flush=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest["totals"], ensure_ascii=False), flush=True)
    return 0 if manifest["totals"]["videos_failed"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())

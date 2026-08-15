#!/usr/bin/env python3
"""Enrich the official-channel flat scan with publishedAt/description metadata.

The channel scan has the complete 199-entry playlist but flat extraction does
not expose upload dates.  This script fetches each video metadata record in a
bounded concurrent pool, preserving per-video failures instead of dropping
them.  It does not fetch comments.
"""

from __future__ import annotations

import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCAN = ROOT / "outputs/derived/speed_community_v3_official_channel_scan_20260814.json"
OUT = ROOT / "outputs/derived/speed_community_v3_official_video_metadata_20260814.jsonl"
MAX_WORKERS = 6


def fetch(entry: dict[str, Any]) -> dict[str, Any]:
    video_id = str(entry.get("id") or "")
    url = str(entry.get("url") or f"https://www.youtube.com/watch?v={video_id}")
    env = os.environ.copy()
    removed = []
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        if key in env:
            removed.append(key)
            env.pop(key, None)
    command = ["yt-dlp", "--ignore-config", "--no-update", "--no-warnings", "--skip-download", "--no-playlist", "--dump-single-json", url]
    try:
        proc = subprocess.run(command, cwd=ROOT, env=env, text=True, encoding="utf-8", errors="replace", capture_output=True, timeout=90)
    except Exception as exc:
        return {"video_id": video_id, "url": url, "flat_title": entry.get("title"), "metadata_status": "ERROR", "error": f"{type(exc).__name__}: {exc}", "proxy_variables_removed": removed}
    if proc.returncode != 0:
        return {"video_id": video_id, "url": url, "flat_title": entry.get("title"), "metadata_status": "ERROR", "error": (proc.stderr or proc.stdout or f"exit={proc.returncode}")[-4000:], "proxy_variables_removed": removed}
    try:
        info = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        return {"video_id": video_id, "url": url, "flat_title": entry.get("title"), "metadata_status": "ERROR", "error": f"JSONDecodeError: {exc}", "proxy_variables_removed": removed}
    keep = {
        "video_id": video_id,
        "url": url,
        "title": info.get("title") or entry.get("title"),
        "description": info.get("description") or "",
        "channel_id": info.get("channel_id") or info.get("uploader_id") or "",
        "channel": info.get("channel") or info.get("uploader") or "",
        "upload_date": info.get("upload_date") or "",
        "timestamp": info.get("timestamp"),
        "duration": info.get("duration"),
        "view_count": info.get("view_count"),
        "like_count": info.get("like_count"),
        "comment_count": info.get("comment_count"),
        "metadata_status": "OK",
        "proxy_variables_removed": removed,
    }
    return keep


def main() -> int:
    payload = json.loads(SCAN.read_text(encoding="utf-8"))
    entries = [entry for entry in payload.get("entries", []) if entry.get("id")]
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch, entry): entry for entry in entries}
        for future in as_completed(futures):
            results.append(future.result())
    results.sort(key=lambda row: (row.get("upload_date") or "", row.get("video_id") or ""), reverse=True)
    header = {
        "run": "speed_community_recollection_v3_youtube_metadata_20260814",
        "scanned_entries": len(entries),
        "max_workers": MAX_WORKERS,
        "finished_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "metadata_ok": sum(1 for row in results if row.get("metadata_status") == "OK"),
        "metadata_error": sum(1 for row in results if row.get("metadata_status") != "OK"),
    }
    OUT.write_text(json.dumps({"_header": header}, ensure_ascii=False) + "\n" + "\n".join(json.dumps(row, ensure_ascii=False) for row in results) + "\n", encoding="utf-8")
    print(json.dumps(header, ensure_ascii=False, indent=2))
    return 0 if header["metadata_error"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

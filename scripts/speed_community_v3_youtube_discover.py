#!/usr/bin/env python3
"""Scan the official YouTube channel for the V3 discovery window.

This is metadata discovery only.  It does not fetch comments and never writes
the old inventory.  The channel scan is deliberately separate from the
comment collectors so a partial network run remains auditable.
"""

from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "derived" / "speed_community_v3_official_channel_scan_20260814.json"
CHANNEL_ID = "UCWzEh28vj3mQKpe0fzVTOUw"
CHANNEL_URL = f"https://www.youtube.com/channel/{CHANNEL_ID}/videos"


def run_scan() -> tuple[dict[str, Any] | None, str | None, list[str]]:
    env = os.environ.copy()
    removed = []
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        if key in env:
            removed.append(key)
            env.pop(key, None)
    command = [
        "yt-dlp", "--ignore-config", "--no-update", "--no-warnings",
        "--flat-playlist", "--playlist-end", "2000", "--dump-single-json", CHANNEL_URL,
    ]
    try:
        proc = subprocess.run(command, cwd=ROOT, env=env, text=True, encoding="utf-8", errors="replace", capture_output=True, timeout=900)
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}", removed
    if proc.returncode != 0:
        return None, (proc.stderr or proc.stdout or f"exit={proc.returncode}")[-8000:], removed
    try:
        return json.loads(proc.stdout), None, removed
    except json.JSONDecodeError as exc:
        return None, f"JSONDecodeError: {exc}; stdout={proc.stdout[-4000:]}", removed


def main() -> int:
    started = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload, error, removed = run_scan()
    entries = (payload or {}).get("entries") or []
    result = {
        "run": "speed_community_recollection_v3_youtube_discovery_20260814",
        "channel_id": CHANNEL_ID,
        "channel_url": CHANNEL_URL,
        "started_at": started,
        "finished_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "requested_playlist_end": 2000,
        "official_channel_scan_succeeded": error is None,
        "entries_scanned": len(entries),
        "proxy_variables_removed": removed,
        "error": error,
        "entries": entries,
        "missingness": "NONE_FOR_METADATA_SCAN" if error is None else "OFFICIAL_CHANNEL_METADATA_SCAN_FAILED",
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in result if k != "entries"}, ensure_ascii=False, indent=2))
    return 0 if error is None else 1


if __name__ == "__main__":
    raise SystemExit(main())

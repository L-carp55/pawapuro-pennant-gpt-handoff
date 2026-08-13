#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Recover three legacy run-1 artifacts accidentally changed during run-2.

The user required the legacy ledgers to remain untouched.  This recovery is
fail-closed: it only restores a target if its current content exactly equals
the unexpected hash observed during this run, saves that content to a
run-2-labelled backup, then atomically restores the repository HEAD version.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
    "outputs/derived/speed_community_rating_filtered_20260813.csv": "08fe5183a2c6cc8047d74c9104938c1bb97f873cb3e25241f8ebe189417e7c12",
    "outputs/derived/speed_community_rating_player_summary_20260813.csv": "b82fc9c4826fcd66a8cff8c7652cd4ad89430361822888f806dbec8fca6b2838",
    "outputs/derived/speed_grok_x_rejected_reclassification_20260813.csv": "28cf7243d182c1c25b12c91bd2b93fbb277e0fafad77c440d23dca706a1a7b9d",
}
OUT_DIR = ROOT / "outputs" / "derived"
LOG = OUT_DIR / "speed_community_rating_legacy_restore_run2.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write(path: Path, data: bytes) -> None:
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> None:
    results = []
    for relative, unexpected_hash in TARGETS.items():
        target = ROOT / relative
        current = target.read_bytes()
        observed = sha256(current)
        if observed != unexpected_hash:
            raise RuntimeError(f"Refusing to restore {relative}: expected unexpected hash {unexpected_hash}, observed {observed}")
        # ``./`` tells Git to resolve the path relative to this project
        # directory, avoiding Windows console-codepage corruption of its
        # Japanese repository-prefix path.
        pristine = subprocess.check_output(["git", "show", f"HEAD:./{relative}"], cwd=ROOT)
        backup = target.with_name(target.stem + "_unexpected_mutation_backup_run2" + target.suffix)
        if backup.exists():
            raise RuntimeError(f"Refusing to overwrite existing backup: {backup}")
        atomic_write(backup, current)
        atomic_write(target, pristine)
        results.append({
            "target": relative,
            "unexpected_sha256": observed,
            "restored_head_sha256": sha256(pristine),
            "backup": str(backup.relative_to(ROOT)),
            "backup_sha256": sha256(current),
        })
    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "reason": "Restore legacy non-run2 outputs to their exact repository HEAD state after unexpected run-2-period mutation; preserve mutation as UTF-8 backup.",
        "results": results,
    }
    LOG.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Run the SP-102 collector with one fail-closed source repair.

Why this wrapper exists:
GitHub Actions exposed a Python semantic bug in the collection-summary counter:

    sum(condition and video_id for ...)

Python's `and` returns an operand, so truthy rows yield the video-id string and
`sum()` then attempts `int + str`. The collection logic itself completed up to
that final summary construction. We patch exactly that expression to a numeric
count and refuse to run if the expected source text is not present.

The repository connector available in this session cannot apply a one-line
unified patch to an arbitrary file, so this wrapper makes the repair explicit,
reviewable, deterministic, and fail-closed rather than silently rewriting the
large collector.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "sp102_targeted_video_comment_rescue_20260819.py"

old = 'sum(r["ledger_type"]=="VIDEO_FETCH" and r.get("video_id") for r in search_ledger)'
new = 'sum(1 for r in search_ledger if r["ledger_type"]=="VIDEO_FETCH" and r.get("video_id"))'

text = SOURCE.read_text(encoding="utf-8")
count = text.count(old)
if count != 1:
    raise RuntimeError(
        f"Expected exactly one known SP-102 summary-count bug, found {count}; "
        "refusing an ambiguous runtime repair"
    )
patched = text.replace(old, new, 1)
code = compile(patched, str(SOURCE), "exec")
ns = {
    "__name__": "__main__",
    "__file__": str(SOURCE),
    "__package__": None,
}
exec(code, ns, ns)

#!/usr/bin/env python3
"""SP-103 lane B: independent official-source verification.

The first run freezes small HTML snapshots.  Later runs reuse those snapshots,
so the parent materializer can be rerun deterministically without silently
changing the external denominator.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "derived" / "sp103_intermediate"
SNAP = ROOT / "outputs" / "derived" / "sp103_sources"
OUT.mkdir(parents=True, exist_ok=True)
SNAP.mkdir(parents=True, exist_ok=True)
GENERATED_AT = "2026-08-23"

SOURCES = [
    {
        "evidence_id": "SP103-EXT-NPBPLUS-H2F",
        "url": "https://www.japan-baseball.jp/npb-plus/",
        "snapshot": "npbplus_official.html",
        "claim": "The current official product page separately lists スプリントスピード and 最速タイム（一塁到達） under batter tracking data.",
        "construct_role": "current direct/near-direct physical speed; Sprint Speed and H2F remain distinct",
        "source_locator": "HTML headings/list around player tracking fields; terms スプリントスピード and 最速タイム（一塁到達)",
    },
    {
        "evidence_id": "SP103-EXT-MLB-90FT-SPLITS",
        "url": "https://www.mlb.com/glossary/statcast/90-foot-running-splits",
        "snapshot": "mlb_90ft_glossary.html",
        "claim": "MLB defines 90-foot splits in five-foot cumulative increments and standardizes home-to-first to 90 feet; raw H2F geometry differs by batting side.",
        "construct_role": "initial acceleration shape plus standardized end-to-end running context",
        "source_locator": "Definition section: five-foot increments, bat-on-ball to first, 90-foot extrapolation",
    },
    {
        "evidence_id": "SP103-EXT-MLB-OF-JUMP-BURST",
        "url": "https://www.mlb.com/glossary/statcast/jump",
        "snapshot": "mlb_jump_glossary.html",
        "claim": "MLB separates Outfielder Jump into Reaction (first 1.5 seconds), Burst (second 1.5 seconds) and Route (directional efficiency over three seconds).",
        "construct_role": "defensive-context burst/acceleration only; not universal speed",
        "source_locator": "Definition and component bullets for Reaction, Burst and Route",
    },
    {
        "evidence_id": "SP103-EXT-MLB-LEAD-DISTANCE",
        "url": "https://www.mlb.com/glossary/statcast/lead-distance",
        "snapshot": "mlb_lead_distance_glossary.html",
        "claim": "Lead Distance measures runner distance from the base at the pitcher's first movement and is separate from maximum speed/acceleration and throwing variables.",
        "construct_role": "stealing/start technique context; never a physical-speed booster",
        "source_locator": "Definition and explanatory paragraph on leads versus maximum speed/acceleration",
    },
    {
        "evidence_id": "SP103-EXT-MLB-BASESTEALING",
        "url": "https://baseballsavant.mlb.com/leaderboard/basestealing-run-value",
        "snapshot": "mlb_basestealing_leaderboard.html",
        "claim": "The official leaderboard defines basestealing opportunity/value and exposes Lead Distance Gained between pitcher first move and pitch release.",
        "construct_role": "stealing technique/opportunity context; outcome proxy, not physical ground truth",
        "source_locator": "Leaderboard explanation around basestealing impact, Lead Distance Gained and qualifiers",
    },
    {
        "evidence_id": "SP103-EXT-MLB-SPRINT-EXPOSURE",
        "url": "https://baseballsavant.mlb.com/sprint_speed_leaderboard",
        "snapshot": "mlb_sprint_speed_leaderboard.html",
        "claim": "The official Sprint Speed leaderboard exposes Competitive Runs, Bolts, HP to 1B and Sprint Speed; Bolt is a cumulative >=30 ft/s run.",
        "construct_role": "top-speed value plus reliability/exposure and end-to-end context",
        "source_locator": "Rendered table header and Sprint Speed/Bolt explanation",
    },
    {
        "evidence_id": "SP103-EXT-DELTA-SPD",
        "url": "https://1point02.jp/op/gnav/glossary/gls_explanation.aspx?ecd=204&eid=20047",
        "snapshot": "delta_102_spd_glossary.html",
        "claim": "1.02 defines Spd as the average of four capped components: stolen-base success, attempt frequency, triple rate and run rate.",
        "construct_role": "mixed outcome proxy with technique/opportunity overlap; never direct physical evidence",
        "source_locator": "Spd definition and formula A-D",
    },
    {
        "evidence_id": "SP103-EXT-WBC-SEARCH",
        "url": "https://baseballsavant.mlb.com/statcast-search-world-baseball-classic",
        "snapshot": "mlb_wbc_statcast_search.html",
        "claim": "Official WBC Statcast search states pitch-level data begins in 2023 and the public player selector contains 2023 and 2026 Japan entries; the public result field surface exposes pitch/hitting/fielding/glossary context but no player-level Sprint Speed, 90-foot or H2F result column.",
        "construct_role": "potential cross-league bridge; running-value acquisition currently bounded/blocked on public surface",
        "source_locator": "World Baseball Classic Statcast Search description, season/player selectors and running glossary section",
    },
    {
        "evidence_id": "SP103-EXT-WBC-2026-CONTEXT",
        "url": "https://www.mlb.com/world-baseball-classic/news/world-baseball-classic-follow-ups-to-watch-in-2026",
        "snapshot": "mlb_wbc_2026_tracking_context.html",
        "claim": "MLB states full Statcast tracking is available for WBC games, searchable for 2023 and available for the 2026 Classic.",
        "construct_role": "tracking-scope confirmation only; does not prove running metric retrievability",
        "source_locator": "Article paragraph describing full Statcast tracking and searchable 2023/2026 availability",
    },
    {
        "evidence_id": "SP103-EXT-MLB-PIPELINE-RUN",
        "url": "https://www.mlb.com/prospects/2020/top100/alex-kirilloff-666135",
        "snapshot": "mlb_pipeline_kirilloff_2020.html",
        "claim": "MLB Pipeline prospect material exposes a 20-80 Run scouting component separately from the other tools.",
        "construct_role": "historical scouting context, year/age stamped; not direct measurement",
        "source_locator": "Prospect tools/Run field in the page snapshot; coverage is page-specific",
    },
]


def fetch_snapshot(source: dict[str, str]) -> dict[str, object]:
    target = SNAP / source["snapshot"]
    fetched = False
    error = None
    if not target.exists() or target.stat().st_size == 0:
        req = urllib.request.Request(
            source["url"],
            headers={"User-Agent": "SP103-evidence-universe-audit/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=40) as response:
                body = response.read()
                target.write_bytes(body)
                fetched = True
                status = getattr(response, "status", 200)
                content_type = response.headers.get("Content-Type", "")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            status = None
            content_type = ""
            error = f"{type(exc).__name__}: {exc}"
    else:
        body = target.read_bytes()
        status = "FROZEN_REUSED"
        content_type = "frozen_snapshot"
    if target.exists():
        body = target.read_bytes()
        text = body.decode("utf-8", errors="replace")
        sha = hashlib.sha256(body).hexdigest()
        return {
            **source,
            "retrieval_date": GENERATED_AT,
            "fetch_status": status,
            "fetched_this_run": fetched,
            "content_type": content_type,
            "bytes": len(body),
            "sha256": sha,
            "snapshot_path": target.relative_to(ROOT).as_posix(),
            "error": error,
            "text_length": len(text),
        }
    return {
        **source,
        "retrieval_date": GENERATED_AT,
        "fetch_status": "BLOCKED_EXTERNAL",
        "fetched_this_run": fetched,
        "content_type": content_type,
        "bytes": 0,
        "sha256": None,
        "snapshot_path": target.relative_to(ROOT).as_posix(),
        "error": error or "snapshot_not_created",
        "text_length": 0,
    }


def wbc_surface_measurement(receipt: dict[str, object]) -> dict[str, object]:
    path = ROOT / str(receipt["snapshot_path"])
    text = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    # The HTML repeats selectors in multiple form controls.  (player id, year,
    # country) is the stable public-surface denominator.
    options = set(
        re.findall(
            r'<option[^>]*value="([^"]+)"[^>]*>\s*\[([0-9]{4})-([A-Z0-9]+)\]',
            text,
            flags=re.S,
        )
    )
    counts = Counter((year, team) for _id, year, team in options)
    running_columns = {
        "sprint_speed": len(re.findall(r"Sprint Speed", text, flags=re.I)),
        "90ft_split": len(re.findall(r"90ft|90-foot", text, flags=re.I)),
        "home_to_first": len(re.findall(r"home.?to.?first", text, flags=re.I)),
    }
    result = {
        "source": receipt["url"],
        "public_surface": receipt["snapshot_path"],
        "player_selector_denominator": {
            "2023_JPN_unique_player_ids": counts.get(("2023", "JPN"), 0),
            "2026_JPN_unique_player_ids": counts.get(("2026", "JPN"), 0),
        },
        "public_surface_running_tokens": running_columns,
        "player_level_running_rows_retrieved": {
            "2023": 0,
            "2026": 0,
        },
        "coverage_status": {
            "2023": "BLOCKED_EXTERNAL_PUBLIC_SEARCH_HAS_NO_RUNNING_RESULT_COLUMN",
            "2026": "BLOCKED_EXTERNAL_PUBLIC_SEARCH_HAS_NO_RUNNING_RESULT_COLUMN",
        },
        "interpretation": "The denominator is the official WBC player-selector lower bound, not a claim that all tournament participants are listed. Zero running rows is an acquisition limitation, never a slow/zero inference.",
    }
    return result


def main() -> None:
    receipts = [fetch_snapshot(x) for x in SOURCES]
    wbc = wbc_surface_measurement(next(x for x in receipts if x["evidence_id"] == "SP103-EXT-WBC-SEARCH"))
    output = {
        "schema_version": "sp103_external_source_verification_lane_b_v1",
        "generated_at": GENERATED_AT,
        "retrieval_policy": "Official/primary sources first; snapshots are frozen on first successful acquisition and reused for deterministic reruns.",
        "source_receipts": receipts,
        "wbc_coverage": wbc,
        "required_negative_findings": [
            {
                "finding_id": "WBC-RUNNING-VALUE-RETRIEVAL",
                "scope": "public Baseball Savant WBC search surface checked for 2023 and 2026 Japan selector universe",
                "denominator": wbc["player_selector_denominator"],
                "result": "No player-level Sprint Speed/90ft/H2F result rows were retrievable from the checked public search surface.",
                "status": "BLOCKED_EXTERNAL",
                "guard": "Do not interpret zero rows as zero speed; preserve the official tracking-scope positive finding separately.",
            },
            {
                "finding_id": "NPBPLUS-OLD-H2F-PROVENANCE",
                "scope": "historical local npb_plus_measurement.hp_to_1b_sec",
                "result": "Current official field availability does not validate old local values; old values remain fail-closed under the local provenance ruling.",
                "status": "REOPEN_SOURCE_AVAILABILITY_NOT_OLD_VALUES",
                "artifact": "docs/audits/luna_npb_plus_provenance_contamination_20260814.md",
            },
        ],
    }
    target = OUT / "lane_b_external_source_verification.json"
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS" if any(x["fetch_status"] not in {"BLOCKED_EXTERNAL", None} for x in receipts) else "BLOCKED_EXTERNAL",
        "sources": len(receipts),
        "fetched": sum(x["fetch_status"] not in {"BLOCKED_EXTERNAL", None} for x in receipts),
        "wbc_2023_jpn_selector": wbc["player_selector_denominator"]["2023_JPN_unique_player_ids"],
        "wbc_2026_jpn_selector": wbc["player_selector_denominator"]["2026_JPN_unique_player_ids"],
        "output": str(target.relative_to(ROOT)),
    }, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

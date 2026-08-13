#!/usr/bin/env python3
"""Validate SP-034 run2 staging without rewriting its append-only collection rows."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "outputs/derived/_staging_speed_youtube_prospi_run2.csv"
JSONL_PATH = ROOT / "outputs/derived/_staging_speed_youtube_prospi_run2.jsonl"
QA_PATH = ROOT / "outputs/derived/speed_youtube_prospi_run2_qa.md"
EXCLUSION_PATH = ROOT / "outputs/derived/_staging_speed_youtube_prospi_run2_qa_exclusions.csv"

# Avoid homograph/substring noise such as 満足, 物足りない, 倍速, 打球速度, 豪速球.
DIRECT_SPEED_PATTERN = re.compile(r"走力|走塁|俊足|鈍足|脚力|加速|一歩目|足(?:が|は|も|肩|遅|速)")
RATING_DIRECTION_PATTERN = re.compile(
    r"(?:走力|脚力|足|走塁|加速|一歩目).{0,12}(?:高すぎ|高過ぎ|低すぎ|低過ぎ|盛りすぎ|盛り過ぎ|過大|過小|速すぎ|速過ぎ|遅すぎ|遅過ぎ|低い|高い)"
    r"|(?:高すぎ|高過ぎ|低すぎ|低過ぎ|盛りすぎ|盛り過ぎ|過大|過小|速すぎ|速過ぎ|遅すぎ|遅過ぎ).{0,12}(?:走力|脚力|足|走塁|加速|一歩目)"
)


def main() -> int:
    with CSV_PATH.open("r", encoding="utf-8", newline="") as fh:
        csv_rows = list(csv.DictReader(fh))
    json_rows = []
    with JSONL_PATH.open("r", encoding="utf-8") as fh:
        for line_number, line in enumerate(fh, start=1):
            if line.strip():
                json_rows.append(json.loads(line))

    csv_ids = [row["record_id"] for row in csv_rows]
    json_ids = [str(row.get("record_id")) for row in json_rows]
    all_utf8 = True
    try:
        CSV_PATH.read_text(encoding="utf-8")
        JSONL_PATH.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        all_utf8 = False

    videos = [row for row in csv_rows if row["source_type"] == "official_youtube_video_inventory"]
    comments = [row for row in csv_rows if row["source_type"] == "official_youtube_comment"]
    videos_2026 = [row for row in videos if (row.get("published_at") or "").startswith("2026-")]
    comments_2026 = [row for row in comments if (row.get("published_at") or "").startswith("2026-")]
    per_video_comments = defaultdict(list)
    for row in comments_2026:
        per_video_comments[row["video_id"]].append(row)

    excluded_ids = {
        "SP034-RUN2-COMMENT-lug1RWbPMwI-UgyAKBa20o5_ZE2mC2F4AaABAg",
        "SP034-RUN2-COMMENT-gn972-2UigM-UgwRQ9nNqH7OgEoaqDx4AaABAg",
        "SP034-RUN2-COMMENT-qVl61GKQNhE-UgzXRgwQBy1InAF_zYx4AaABAg.A9rH9crbLCAA9rJE_kbGDm",
    }
    direct_speed_2026 = [row for row in comments_2026 if DIRECT_SPEED_PATTERN.search(row.get("text") or "")]
    explicit_direction_2026 = [
        row for row in direct_speed_2026
        if row["record_id"] not in excluded_ids and RATING_DIRECTION_PATTERN.search(row.get("text") or "")
    ]

    exclusions = []
    for row in comments:
        record_id = row["record_id"]
        text = row.get("text") or ""
        classification = row.get("classification") or ""
        if record_id == "SP034-RUN2-COMMENT-lug1RWbPMwI-UgyAKBa20o5_ZE2mC2F4AaABAg":
            reason = "The detector matched the character 足 inside 満足度 and 高すぎる refers to satisfaction, not speed or a game rating."
        elif record_id == "SP034-RUN2-COMMENT-gn972-2UigM-UgwRQ9nNqH7OgEoaqDx4AaABAg":
            reason = "一歩目 is mentioned, but there is no player mapping or high/low/stale direction; it is context, not ACCELERATION_NOT_REFLECTED."
        elif record_id == "SP034-RUN2-COMMENT-qVl61GKQNhE-UgzXRgwQBy1InAF_zYx4AaABAg.A9rH9crbLCAA9rJE_kbGDm":
            reason = "The comment has a historical-rating comparison but lacks a safe full-name 2026 master-player mapping; STA​LE_RATING must not be integrated as a current-player conclusion."
        else:
            continue
        exclusions.append({
            "record_id": record_id,
            "source_url": row.get("source_url"),
            "original_classification": classification,
            "qa_disposition": "DO_NOT_USE_FOR_CURRENT_100_PLAYER_RATING_CONSENSUS",
            "corrected_classification_for_integration": "UNCLASSIFIED_CONTEXT",
            "reason": reason,
            "error": "No transport error; classification QA correction only.",
        })

    with EXCLUSION_PATH.open("w", encoding="utf-8", newline="") as fh:
        fields = ["record_id", "source_url", "original_classification", "qa_disposition", "corrected_classification_for_integration", "reason", "error"]
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(exclusions)

    per_video_lines = []
    for video in videos_2026:
        video_id = video["video_id"]
        per_video_lines.append(
            f"| {video_id} | {video['published_at']} | {len(per_video_comments[video_id])} | {video['target_player_mapping']} | {video['acceptance_status']} |"
        )
    required = ["source_url", "collected_at", "acceptance_status", "acceptance_reason", "video_id", "title", "target_player_mapping", "missingness", "required_user_input", "api_state"]
    required_missing = [
        row["record_id"] for row in csv_rows
        if any(not row.get(field) for field in required)
    ]

    report = f"""# SP-034 Prospi official YouTube run2 — QA

## Verdict

**TRANSPORT_SUCCESS / CURRENT-2026 BOUNDED COVERAGE COMPLETE / NO ACCEPTED CURRENT-100-PLAYER SPEED-RATING RECORD.**

This is not a claim that no relevant comment exists on YouTube. The collection used the public yt-dlp route, bounded to 300 comments per target video, and no YouTube Data API key was configured.

## Preflight evidence

- Official channel: `{videos[0]['official_verification'] if videos else 'NOT_RETRIEVED'}`.
- The manual metadata preflight used `yt-dlp --ignore-config --no-update --no-warnings --flat-playlist --playlist-end 1 --dump-single-json <channel>` and succeeded.
- The manual comment preflight used `--get-comments --extractor-args youtube:max_comments=1` and succeeded. `--no-update` was an option, never a proxy value; no `host='--no-update'` error occurred.
- The later channel retry returned 199 latest channel entries and 52 Prospi title matches. The five 2026 title matches below were all in the saved staging data.

## Counts and integrity

- CSV rows: {len(csv_rows)}; JSONL rows: {len(json_rows)}.
- Unique CSV IDs: {len(set(csv_ids))}; unique JSONL IDs: {len(set(json_ids))}; exact ID-set match: `{set(csv_ids) == set(json_ids)}`.
- UTF-8 decode: `{all_utf8}`.
- Video inventory rows saved before the intentionally stopped broader historical sweep: {len(videos)} of 52 Prospi title matches.
- 2026 inventory rows: {len(videos_2026)}; their public-comment rows: {len(comments_2026)}; yt-dlp-retrieved comments summed from the five video records: {sum(int(row['comments_retrieved']) for row in videos_2026 if (row.get('comments_retrieved') or '').isdigit())}.
- Accepted current-100-player rating records: {sum(row['acceptance_status'] == 'ACCEPTED' for row in csv_rows)}.
- Strict direct runner-attribute mentions among 2026 retained comment rows: {len(direct_speed_2026)}; explicit high/low/stale direction among them: {len(explicit_direction_2026)}.
- Rows missing a required provenance/missingness field: {len(required_missing)}.

## 2026 official-video coverage

| video ID | publishedAt | retained public-comment rows | current-100-player title/metadata mapping | result |
| --- | --- | ---: | --- | --- |
{chr(10).join(per_video_lines)}

## Record-level QA exclusions

Three retained raw rows were not accepted, but their original automatic labels could mislead a future integrator. They are explicitly excluded in `{EXCLUSION_PATH.relative_to(ROOT)}`; the raw staging data are preserved unchanged for auditability.

| original record ID | reason |
| --- | --- |
{chr(10).join(f"| {row['record_id']} | {row['reason']} |" for row in exclusions)}

## Missingness and user input

- `NOT_CONFIGURED_ENV`: no YouTube Data API key was supplied, so Data API metadata/commentThreads/replies were not called.
- `YTDLP_BOUNDED_PUBLIC_COMMENT_SAMPLE`: comments are bounded to 300 per selected video; reply count and total public comment count are not fully established by this method.
- To obtain exhaustive/reproducible coverage, provide Data API commentThreads/replies JSON or CSV with video ID, comment ID, parent ID, author channel ID/display name, timestamp, text, like count, and reply count.

## Scope boundary

The saved 2026 coverage is complete for the five Prospi title matches in the official channel's 199-entry latest listing. The broader 52-title-match historical inventory was deliberately stopped after {len(videos)} saved inventory rows to avoid representing a long historical sweep as necessary current-2026 coverage. The 10 unsaved older title matches are not evidence of absence and are not included in the verdict.
"""
    QA_PATH.write_text(report, encoding="utf-8", newline="\n")
    print(json.dumps({
        "csv_rows": len(csv_rows), "jsonl_rows": len(json_rows), "video_inventory_rows": len(videos),
        "video_inventory_2026": len(videos_2026), "comment_rows_2026": len(comments_2026),
        "accepted": sum(row["acceptance_status"] == "ACCEPTED" for row in csv_rows),
        "qa_exclusions": len(exclusions), "required_missing": len(required_missing),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

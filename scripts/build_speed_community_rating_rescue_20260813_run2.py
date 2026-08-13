#!/usr/bin/env python3
"""Build the resumable run-2 community-rating rescue ledgers.

This deliberately treats the old Grok-X ledger as an immutable input.  It
does not alter the 41 original accepted rows or the source worktree.  Every
old rejected row is written once to the reclassification ledger, with a
record-level reason, before it is considered for the filtered lane.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import urllib.error
import urllib.request
import urllib.parse
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "outputs" / "derived"
GROK_INPUT = Path(
    r"C:\Users\amila\Desktop\Claude Code\_worktrees\pawapuro-speed-2026-grok-x-sns-rescue"
    r"\data\normalized\speed_2026_grok_x_sources.csv"
)
MASTER_INPUT = DERIVED / "speed_2026_100_owner_review_master_20260813.csv"
X_INPUTS = [
    DERIVED / "speed_community_rating_lane_x_powerpro_raw_20260813.jsonl",
    DERIVED / "speed_community_rating_lane_x_prospi_raw_20260813.jsonl",
]
YOUTUBE_INPUTS = [
    DERIVED / "_staging_speed_youtube_powerpro_run2.csv",
    DERIVED / "_staging_speed_youtube_prospi_run2.csv",
]
YOUTUBE_QA_EXCLUSIONS = DERIVED / "_staging_speed_youtube_prospi_run2_qa_exclusions.csv"
PROSPI_STAGING_INPUTS = {
    "current": DERIVED / "_staging_speed_prospi_gamex_current_run2.csv",
    "historical": DERIVED / "_staging_speed_prospi_gamex_historical_run2.csv",
}

RAW_FIELDS = [
    "record_id", "player", "canonical_player_id", "game", "edition", "update_date",
    "platform", "source_type", "source_url", "video_id_or_post_id", "parent_event_id",
    "author_id_or_name", "timestamp", "text", "likes", "reply_count", "classification",
    "strength", "independence_group", "physical_or_rating_lane",
    "target_rating_if_explicit", "comparison_player_if_any", "source_quality", "notes",
    "acceptance_status", "acceptance_reason", "collected_at", "attempted_routes",
    "event_id", "origin_count", "comment_count", "like_sum", "top_like_count",
    "agreement_ratio", "source_input_path", "source_input_sha256", "old_rejection_reason",
    "reclassification_status", "schema_validation", "identity_validation",
]

RECLASS_FIELDS = RAW_FIELDS + [
    "old_source_id", "old_acceptance_status", "old_directness", "old_evidence_strength",
    "old_text_excerpt", "old_posted_at", "old_retrieved_at", "old_accessibility_status",
    "old_identity_status",
]

YOUTUBE_INVENTORY_FIELDS = [
    "inventory_id", "game", "edition", "video_id", "video_url", "official_channel_name",
    "official_channel_id", "title", "published_at", "player_game_update_mapping",
    "source_type", "source_url", "collected_at", "acquisition_status", "api_state",
    "comment_total_reported", "comment_sample_size", "comment_sort", "acceptance_status",
    "acceptance_reason", "attempted_routes", "required_user_input", "notes", "error",
    "missingness",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def textify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def compact_name(name: str) -> str:
    return "".join((name or "").replace("　", " ").split())


def load_master_ids() -> dict[str, str]:
    ids: dict[str, str] = {}
    with MASTER_INPUT.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            player = compact_name(row.get("player", ""))
            identifier = row.get("canonical_player_id") or row.get("player_id") or "null"
            if player and identifier:
                ids[player] = identifier
    return ids


def load_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as error:
                raise RuntimeError(f"Invalid JSONL in {path} at line {line_number}: {error}") from error


def existing_ids(path: Path) -> set[str]:
    if not path.exists():
        return set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return {row.get("record_id", "") for row in csv.DictReader(handle) if row.get("record_id")}


def ensure_csv_header(path: Path, fields: list[str]) -> None:
    if path.exists() and path.stat().st_size:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            header = next(csv.reader(handle), [])
        if header != fields:
            raise RuntimeError(f"Existing header mismatch: {path}")
        return
    with path.open("w", encoding="utf-8", newline="") as handle:
        csv.DictWriter(handle, fieldnames=fields).writeheader()


def append_csv(path: Path, fields: list[str], row: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writerow({field: textify(row.get(field, "")) for field in fields})
        handle.flush()


def append_jsonl(path: Path, row: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8", newline="") as handle:
        handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()


def label_list(*labels: str) -> list[str]:
    return [label for label in labels if label]


def direction_labels(text: str) -> tuple[list[str], str]:
    compact = compact_name(text)
    slow_tokens = ("足遅", "鈍足", "脚力衰", "加速力がない", "スピードを欠", "足引きず")
    fast_tokens = ("俊足", "快足", "瞬足", "足速", "脚力やば", "爆発的走力")
    slow = any(token in compact for token in slow_tokens)
    fast = any(token in compact for token in fast_tokens)
    if slow and fast:
        return label_list("MIXED"), "WEAK_DIRECTIONAL"
    if slow:
        temporal = "TEMPORAL_DECLINE" if ("衰" in compact or "膝" in compact) else ""
        return label_list("PHYSICAL_SLOW", temporal), "WEAK_DIRECTIONAL"
    if fast:
        return label_list("PHYSICAL_FAST"), "WEAK_DIRECTIONAL"
    return label_list("UNCLASSIFIED_CONTEXT"), "CONTEXT"


def classify_grok_rejection(source: dict[str, str], canonical_id: str, input_sha: str) -> dict[str, Any]:
    old_reason = source.get("rejection_reason", "")
    text = source.get("text_excerpt") or source.get("quote_excerpt") or ""
    player = source.get("player", "")
    player_in_text = bool(compact_name(player)) and compact_name(player) in compact_name(text)
    has_event_fields = all(source.get(field, "") for field in ("post_id", "post_url", "posted_at", "author_account"))
    schema_validation = "PASS" if text and has_event_fields else "INSUFFICIENT_SOURCE_FIELDS"
    identity_validation = "PASS_PLAYER_TEXT_MATCH" if player_in_text else "PLAYER_NOT_VERIFIABLE_FROM_TEXT"
    game = ""
    if "プロスピ" in text:
        game = "Prospi"
    elif "パワプロ" in text:
        game = "PowerPro"
    elif old_reason == "GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED":
        game = "UNSPECIFIED_BASEBALL_GAME"

    status = "CONTEXT_ONLY"
    reclass_status = "RETAINED_NOT_ACCEPTED"
    reason = "Retained as raw context; it does not meet the flexible lane's record-level acceptance rule."
    labels: list[str] = ["UNCLASSIFIED_CONTEXT"]
    strength = "CONTEXT"
    lane = "RATING" if game else "PHYSICAL"

    if not text or not has_event_fields:
        status = "INSUFFICIENT"
        reclass_status = "NOT_RECLASSIFIABLE_INSUFFICIENT"
        reason = (
            "Original rejection retained: post text and/or author, timestamp, post ID, URL is missing. "
            "No rating or physical direction is inferred from an incomplete returned record."
        )
    elif old_reason == "CONFLICTING_RETURNED_URL_FOR_SAME_POST_ID":
        status = "INSUFFICIENT"
        reclass_status = "NOT_RECLASSIFIABLE_IDENTITY_CONFLICT"
        reason = "Original record has conflicting returned URLs for the same post ID; no record is accepted until the conflict is resolved."
    elif old_reason == "TARGET_NOT_VERIFIABLE_FROM_RETURNED_POST_TEXT" or not player_in_text:
        status = "INSUFFICIENT"
        reclass_status = "NOT_RECLASSIFIABLE_PLAYER_IDENTITY"
        reason = "The target player is not verifiable from the returned post text; the source remains raw context only and is not mapped to a player."
    elif old_reason.startswith("SAME_EVENT_ORIGIN_DUPLICATE") or old_reason.startswith("DUPLICATE_OF_EXISTING_SOURCE"):
        status = "CONTEXT_ONLY"
        reclass_status = "RETAINED_DUPLICATE_NOT_INDEPENDENT"
        reason = "Retained with its original duplicate linkage. It is not counted as an independent origin or re-accepted as a new observation."
    elif old_reason == "ARTICLE_OR_VIDEO_REPOST_NOT_INDEPENDENT_SNS_ORIGIN":
        status = "CONTEXT_ONLY"
        reclass_status = "RETAINED_REPOST_NOT_INDEPENDENT"
        reason = "Retained as a repost/syndicated context record; it is not an independent community origin."
    elif old_reason == "GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED":
        status = "ACCEPTED_RATING_CONTEXT"
        reclass_status = "RECLASSIFIED_TO_RATING_LANE"
        labels = ["RATING_VALUE_CONTEXT"]
        strength = "RATING_COMMUNITY"
        lane = "RATING"
        reason = (
            "Reclassified under the run-2 policy: an explicit game-rating value is valuable rating-lane context. "
            "It contains no high/low/stale appraisal claim, so it is not counted as directional consensus or a numeric teacher."
        )
    else:
        labels, strength = direction_labels(text)
        lane = "PHYSICAL"
        if old_reason in {
            "GENERIC_OR_AMBIGUOUS_SPEED_LABEL_NOT_SUFFICIENT_FOR_ACCEPTANCE",
            "NO_CLEAR_DIRECT_PHYSICAL_SPEED_CLAIM",
            "PLAY_OUTCOME_OR_TRANSITION_METRIC_NOT_ISOLATED_TO_PHYSICAL_SPEED",
            "BASERUNNING_DECISION_OR_STOLEN_BASE_CONTEXT_NOT_ISOLATED_TO_PHYSICAL_SPEED",
        } and strength == "WEAK_DIRECTIONAL":
            status = "ACCEPTED_WEAK_DIRECTIONAL_CONTEXT"
            reclass_status = "RECLASSIFIED_TO_WEAK_CONTEXT_LANE"
            reason = (
                "Reclassified under the flexible policy as weak directional physical context. "
                "The original rejection reason is retained; this record cannot independently create strict consensus, a rating value, or a player score."
            )
        else:
            status = "CONTEXT_ONLY"
            reclass_status = "RETAINED_NOT_DIRECTIONAL"
            reason = (
                "Retained as raw context after individual re-review. The returned text does not provide a safely attributable, "
                "directional speed or rating claim under the flexible policy."
            )

    source_id = source["source_id"]
    timestamp = source.get("posted_at") or source.get("post_date") or "NOT_PUBLICLY_DOCUMENTED"
    record = {
        "record_id": f"SP032-RUN2-{source_id}",
        "player": player,
        "canonical_player_id": canonical_id,
        "game": game,
        "edition": "",
        "update_date": "",
        "platform": "X",
        "source_type": "GROK_X_OLD_REJECTED_LEDGER_RECLASSIFICATION",
        "source_url": source.get("post_url") or source.get("source_url") or "",
        "video_id_or_post_id": source.get("post_id", ""),
        "parent_event_id": source.get("same_origin_duplicate_of") or source.get("post_id", ""),
        "author_id_or_name": source.get("author_account") or source.get("author") or "",
        "timestamp": timestamp,
        "text": text,
        "likes": "",
        "reply_count": "",
        "classification": labels,
        "strength": strength,
        "independence_group": source.get("independence_group", ""),
        "physical_or_rating_lane": lane,
        "target_rating_if_explicit": "",
        "comparison_player_if_any": "",
        "source_quality": "GROK_X_RETURNED_POST_LEDGER",
        "notes": "Original rejection reason retained verbatim: " + old_reason,
        "acceptance_status": status,
        "acceptance_reason": reason,
        "collected_at": utc_now(),
        "attempted_routes": json.dumps([
            "Read immutable old Grok-X rejected ledger",
            source.get("grok_x_search_receipt_provenance", ""),
            "Individual run-2 reclassification against the task's flexible policy",
        ], ensure_ascii=False),
        "event_id": source.get("same_origin_duplicate_of") or source.get("post_id", ""),
        "origin_count": 1 if status.startswith("ACCEPTED") else 0,
        "comment_count": 1,
        "like_sum": "",
        "top_like_count": "",
        "agreement_ratio": "",
        "source_input_path": str(GROK_INPUT),
        "source_input_sha256": input_sha,
        "old_rejection_reason": old_reason,
        "reclassification_status": reclass_status,
        "schema_validation": schema_validation,
        "identity_validation": identity_validation,
        "old_source_id": source_id,
        "old_acceptance_status": source.get("acceptance_status", ""),
        "old_directness": source.get("directness", ""),
        "old_evidence_strength": source.get("evidence_strength", ""),
        "old_text_excerpt": text,
        "old_posted_at": source.get("posted_at", ""),
        "old_retrieved_at": source.get("retrieved_at", ""),
        "old_accessibility_status": source.get("accessibility_status", ""),
        "old_identity_status": source.get("identity_status", ""),
    }
    return record


def normalise_x_attempt(row: dict[str, Any], input_path: Path, input_sha: str) -> dict[str, Any]:
    record = {field: row.get(field, "") for field in RAW_FIELDS}
    record["record_id"] = "RUN2-" + str(row.get("record_id", "UNKNOWN"))
    record["classification"] = row.get("classification", "UNCLASSIFIED_CONTEXT")
    record["source_input_path"] = str(input_path)
    record["source_input_sha256"] = input_sha
    record["old_rejection_reason"] = "RUN1_X_COLLECTION_AVAILABILITY_RECORD"
    record["reclassification_status"] = "RUN2_INDIVIDUAL_AVAILABILITY_REVIEW"
    # A NOT_FOUND query/official-replies attempt has no source post by design.
    record["schema_validation"] = "NOT_APPLICABLE_NO_SOURCE_POST_RETURNED"
    record["identity_validation"] = "NOT_APPLICABLE_NO_SOURCE_POST_RETURNED"
    notes = textify(record.get("notes"))
    record["notes"] = notes + " | Run-2 review: kept as NOT_FOUND collection availability, not schema_issue and not evidence."
    record["collected_at"] = utc_now()
    return record


def load_youtube_qa_exclusions() -> dict[str, dict[str, str]]:
    if not YOUTUBE_QA_EXCLUSIONS.exists():
        return {}
    with YOUTUBE_QA_EXCLUSIONS.open("r", encoding="utf-8-sig", newline="") as handle:
        return {row["record_id"]: row for row in csv.DictReader(handle) if row.get("record_id")}


def normalise_youtube_record(
    row: dict[str, Any], input_path: Path, input_sha: str, qa_exclusions: dict[str, dict[str, str]]
) -> dict[str, Any]:
    record = {field: row.get(field, "") for field in RAW_FIELDS}
    record["record_id"] = str(row.get("record_id", ""))
    record["video_id_or_post_id"] = row.get("video_id_or_post_id") or row.get("video_id") or ""
    record["source_input_path"] = str(input_path)
    record["source_input_sha256"] = input_sha
    record["old_rejection_reason"] = ""
    record["reclassification_status"] = "RUN2_YOUTUBE_STAGING_INTEGRATION"
    required = ("record_id", "source_url", "collected_at", "acceptance_status", "acceptance_reason")
    record["schema_validation"] = "PASS" if all(record.get(field) for field in required) else "INSUFFICIENT_STAGING_FIELDS"
    if record.get("player") and record.get("canonical_player_id"):
        record["identity_validation"] = "PASS_CANONICAL_PLAYER_ID"
    else:
        record["identity_validation"] = "NOT_APPLICABLE_VIDEO_LEVEL_OR_UNMAPPED_COMMENT"
    error = textify(row.get("error"))
    notes = textify(record.get("notes"))
    if error:
        notes += " | staging_error=" + error
    correction = qa_exclusions.get(record["record_id"])
    if correction:
        record["classification"] = correction.get("corrected_classification_for_integration", "UNCLASSIFIED_CONTEXT")
        record["notes"] = (
            notes + " | QA integration correction: " + correction.get("reason", "") +
            " | disposition=" + correction.get("qa_disposition", "DO_NOT_USE")
        )
        record["reclassification_status"] = "RUN2_YOUTUBE_QA_CORRECTED_EXCLUSION"
    else:
        record["notes"] = notes
    return record


def make_youtube_inventory_row(row: dict[str, Any], sequence: int) -> dict[str, Any]:
    video_id = source_video_id(row) or "CHANNEL_SEARCH"
    title = row.get("video_title") or row.get("title") or row.get("text") or ""
    channel = row.get("author_id_or_name") or row.get("official_verification") or ""
    channel_id = "UCWzEh28vj3mQKpe0fzVTOUw" if "UCWzEh28vj3mQKpe0fzVTOUw" in channel else ""
    return {
        "inventory_id": f"RUN2-YT-INV-{sequence:03d}",
        "game": row.get("game", ""),
        "edition": row.get("edition", ""),
        "video_id": video_id,
        "video_url": row.get("source_url", ""),
        "official_channel_name": channel,
        "official_channel_id": channel_id,
        "title": title,
        "published_at": row.get("video_published_at") or row.get("published_at") or row.get("timestamp") or "",
        "player_game_update_mapping": row.get("player_game_update_mapping") or row.get("target_player_mapping") or "",
        "source_type": row.get("source_type", ""),
        "source_url": row.get("source_url", ""),
        "collected_at": row.get("collected_at", ""),
        "acquisition_status": row.get("acquisition_status", "METADATA_OR_COMMENT_RECORD"),
        "api_state": row.get("api_state", ""),
        "comment_total_reported": row.get("comment_count_reported") or row.get("comment_count") or "",
        "comment_sample_size": row.get("comments_retrieved") or row.get("comment_count") or "",
        "comment_sort": "NOT_REPORTED",
        "acceptance_status": row.get("acceptance_status", ""),
        "acceptance_reason": row.get("acceptance_reason", ""),
        "attempted_routes": row.get("attempted_routes", ""),
        "required_user_input": row.get("user_input_requirement") or row.get("required_user_input") or "",
        "notes": row.get("notes", ""),
        "error": row.get("error", ""),
        "missingness": row.get("missingness", ""),
    }


def source_video_id(row: dict[str, Any]) -> str:
    """Return a video ID, never a comment ID, from a staging row."""
    if row.get("video_id"):
        return row["video_id"]
    parent = row.get("parent_event_id", "")
    if parent.startswith("yt:video:"):
        return parent.split(":", 2)[2]
    if parent.startswith("youtube:"):
        return parent.split(":", 2)[1]
    url = row.get("source_url", "")
    try:
        return urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("v", [""])[0]
    except ValueError:
        return ""


def is_youtube_inventory_source(row: dict[str, Any]) -> bool:
    source_type = (row.get("source_type") or "").lower()
    return "comment" not in source_type


def labels_from(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    value = textify(value)
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in value.split(";") if item.strip()]


def build_player_summary(raw_csv: Path, master_ids: dict[str, str]) -> dict[str, int]:
    """Create a 100-player, join-ready summary without generating any point rating."""
    output = DERIVED / "speed_community_rating_player_summary_20260813_run2.csv"
    master_players: list[tuple[str, str]] = []
    with MASTER_INPUT.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            player = row.get("player", "")
            canonical = row.get("canonical_player_id") or row.get("player_id") or "null"
            master_players.append((player, canonical))
    grouped: dict[str, list[dict[str, str]]] = {}
    with raw_csv.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("acceptance_status", "").startswith("ACCEPTED") and row.get("player"):
                grouped.setdefault(compact_name(row["player"]), []).append(row)

    fields = [
        "player", "canonical_player_id", "physical_consensus", "physical_independent_origins",
        "rating_consensus_powerpro", "rating_consensus_prospi", "rating_independent_origins",
        "rating_volume", "stale_community_support", "high_low_direction", "community_conflict",
        "best_supporting_sources", "confidence", "missingness",
    ]
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for player, canonical in master_players:
            rows = grouped.get(compact_name(player), [])
            labels = [label for row in rows for label in labels_from(row.get("classification", ""))]
            physical_fast = sum(label == "PHYSICAL_FAST" for label in labels)
            physical_slow = sum(label == "PHYSICAL_SLOW" for label in labels)
            if physical_fast and physical_slow:
                physical_consensus = "MIXED_WEAK_CONTEXT"
            elif physical_fast:
                physical_consensus = "FAST_WEAK_CONTEXT"
            elif physical_slow:
                physical_consensus = "SLOW_WEAK_CONTEXT"
            else:
                physical_consensus = "NONE"
            physical_groups = {
                row.get("independence_group", "") for row in rows
                if any(label in {"PHYSICAL_FAST", "PHYSICAL_SLOW", "TEMPORAL_DECLINE", "TEMPORAL_RECOVERY"}
                       for label in labels_from(row.get("classification", "")))
            }
            rating_powerpro = [row for row in rows if row.get("game") == "PowerPro"]
            rating_prospi = [row for row in rows if row.get("game") == "Prospi"]
            rating_rows = rating_powerpro + rating_prospi
            rating_groups = {row.get("independence_group", "") for row in rating_rows if row.get("independence_group")}
            stale = any(label in {"STALE_RATING", "AGING_NOT_REFLECTED"} for label in labels)
            too_high = any(label == "RATING_TOO_HIGH" for label in labels)
            too_low = any(label == "RATING_TOO_LOW" for label in labels)
            if too_high and too_low:
                high_low = "MIXED"
            elif too_high:
                high_low = "TOO_HIGH"
            elif too_low:
                high_low = "TOO_LOW"
            else:
                high_low = "NONE"
            sources = []
            for row in rows:
                source = row.get("source_url", "")
                if source and source not in sources:
                    sources.append(source)
            if not rows:
                confidence = "NONE"
                missingness = "NO_ACCEPTED_COMMUNITY_RECORD"
            elif all(row.get("strength") in {"WEAK_DIRECTIONAL", "RATING_COMMUNITY"} for row in rows):
                confidence = "WEAK_CONTEXT_ONLY"
                missingness = "NO_STRONG_OR_MEDIUM_DIRECTIONAL_RATING_RECORD"
            else:
                confidence = "CONTEXT_ONLY"
                missingness = "LIMITED_COMMUNITY_EVIDENCE"
            writer.writerow({
                "player": player,
                "canonical_player_id": canonical,
                "physical_consensus": physical_consensus,
                "physical_independent_origins": len({group for group in physical_groups if group}),
                "rating_consensus_powerpro": "VALUE_CONTEXT_ONLY" if rating_powerpro else "NONE",
                "rating_consensus_prospi": "VALUE_CONTEXT_ONLY" if rating_prospi else "NONE",
                "rating_independent_origins": len(rating_groups),
                "rating_volume": f"accepted_records={len(rating_rows)};physical_context_records={physical_fast + physical_slow}",
                "stale_community_support": "STALE_CONTEXT_PRESENT" if stale else "NO_STALE_EVIDENCE",
                "high_low_direction": high_low,
                "community_conflict": "PHYSICAL_DIRECTION_MIXED" if physical_fast and physical_slow else "NONE",
                "best_supporting_sources": ";".join(sources[:3]),
                "confidence": confidence,
                "missingness": missingness,
            })
    return {"summary_rows": len(master_players), "summary_players_with_accepted_context": sum(bool(grouped.get(compact_name(player))) for player, _ in master_players)}


def copy_prospi_final_outputs() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for lane, source in PROSPI_STAGING_INPUTS.items():
        if not source.exists():
            result[lane] = {"status": "MISSING_STAGING_INPUT", "path": str(source)}
            continue
        destination = DERIVED / f"speed_prospi_gamex_{lane}_20260813_run2.csv"
        shutil.copyfile(source, destination)
        result[lane] = {"status": "COPIED_UTF8", "source": str(source), "output": str(destination), "sha256": sha256(destination)}
    return result


def probe_x_replies_route(game: str, url: str) -> dict[str, Any]:
    """Record a live, unauthenticated official-X replies-route probe.

    HTTP access denial is deliberately distinct from connection failure and
    from NOT_FOUND.  Neither outcome is treated as a source-post record.
    """
    timestamp = utc_now()
    status = "CONNECTION_FAILED"
    detail = ""
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with opener.open(request, timeout=20) as response:
            status = f"HTTP_{response.status}"
            detail = f"HTTP {response.status} {response.reason}"
    except urllib.error.HTTPError as error:
        status = f"HTTP_{error.code}"
        detail = f"HTTP {error.code} {error.reason}"
    except Exception as error:  # The exact exception is evidence for a route failure.
        detail = f"{type(error).__name__}: {error}"

    if status.startswith("HTTP_2") or status.startswith("HTTP_3"):
        acceptance_status = "INSUFFICIENT"
        acceptance_reason = "Official X replies route was reachable, but no authenticated/API-supported post enumeration was available."
    elif status == "HTTP_404":
        acceptance_status = "NOT_FOUND"
        acceptance_reason = "Official X replies route returned HTTP 404; no source post or claim is inferred."
    elif status.startswith("HTTP_"):
        acceptance_status = "INSUFFICIENT"
        acceptance_reason = "Official X replies route was network-reachable but denied unauthenticated access; no source post or claim is inferred."
    else:
        acceptance_status = "CONNECTION_FAILED"
        acceptance_reason = "Official X replies route could not be reached; this is not evidence that no replies or rating claims exist."

    return {
        "record_id": f"RUN2-X-PROBE-{game.upper()}",
        "player": "",
        "canonical_player_id": "",
        "game": game,
        "edition": "",
        "update_date": "",
        "platform": "X",
        "source_type": "OFFICIAL_X_REPLIES_ROUTE_PROBE",
        "source_url": url,
        "video_id_or_post_id": "",
        "parent_event_id": f"x:official-replies-probe:{game.lower()}",
        "author_id_or_name": "",
        "timestamp": timestamp,
        "text": detail,
        "likes": "",
        "reply_count": "",
        "classification": ["UNCLASSIFIED_CONTEXT"],
        "strength": "CONTEXT",
        "independence_group": f"x:official-replies-probe:{game.lower()}",
        "physical_or_rating_lane": "RATING",
        "target_rating_if_explicit": "",
        "comparison_player_if_any": "",
        "source_quality": "LIVE_UNAUTHENTICATED_X_ROUTE_PROBE",
        "notes": "No post list, author post, reaction volume, player identity, or rating direction was inferred from the HTTP route probe.",
        "acceptance_status": acceptance_status,
        "acceptance_reason": acceptance_reason,
        "collected_at": timestamp,
        "attempted_routes": json.dumps(["Live unauthenticated HEAD request with proxy disabled", detail], ensure_ascii=False),
        "event_id": f"x:official-replies-probe:{game.lower()}",
        "origin_count": 0,
        "comment_count": 0,
        "like_sum": 0,
        "top_like_count": 0,
        "agreement_ratio": "",
        "source_input_path": "LIVE_NETWORK_PROBE_RUN2",
        "source_input_sha256": "",
        "old_rejection_reason": "",
        "reclassification_status": "RUN2_LIVE_ROUTE_PROBE",
        "schema_validation": "NOT_APPLICABLE_NO_SOURCE_POST_RETURNED",
        "identity_validation": "NOT_APPLICABLE_NO_SOURCE_POST_RETURNED",
    }


def write_run2(include_x: bool) -> dict[str, Any]:
    if not GROK_INPUT.exists():
        raise RuntimeError(f"Required old Grok-X ledger is missing: {GROK_INPUT}")
    if not MASTER_INPUT.exists():
        raise RuntimeError(f"Required master table is missing: {MASTER_INPUT}")
    DERIVED.mkdir(parents=True, exist_ok=True)
    grok_sha = sha256(GROK_INPUT)
    master_ids = load_master_ids()

    raw_csv = DERIVED / "speed_community_rating_raw_20260813_run2.csv"
    raw_jsonl = DERIVED / "speed_community_rating_raw_20260813_run2.jsonl"
    reclass_csv = DERIVED / "speed_grok_x_rejected_reclassification_20260813_run2.csv"
    filtered_csv = DERIVED / "speed_community_rating_filtered_20260813_run2.csv"
    for path, fields in ((raw_csv, RAW_FIELDS), (reclass_csv, RECLASS_FIELDS), (filtered_csv, RAW_FIELDS)):
        ensure_csv_header(path, fields)
    raw_done = existing_ids(raw_csv)
    reclass_done = existing_ids(reclass_csv)
    filtered_done = existing_ids(filtered_csv)

    counts: Counter[str] = Counter()
    input_rows = 0
    with GROK_INPUT.open("r", encoding="utf-8-sig", newline="") as handle:
        for source in csv.DictReader(handle):
            if source.get("acceptance_status") != "REJECTED":
                continue
            input_rows += 1
            player_key = compact_name(source.get("player", ""))
            record = classify_grok_rejection(source, master_ids.get(player_key, ""), grok_sha)
            counts[record["reclassification_status"]] += 1
            if record["record_id"] not in reclass_done:
                append_csv(reclass_csv, RECLASS_FIELDS, record)
            if record["record_id"] not in raw_done:
                append_csv(raw_csv, RAW_FIELDS, record)
                append_jsonl(raw_jsonl, {field: record.get(field, "") for field in RAW_FIELDS})
            if record["acceptance_status"].startswith("ACCEPTED") and record["record_id"] not in filtered_done:
                append_csv(filtered_csv, RAW_FIELDS, record)

    x_counts: Counter[str] = Counter()
    if include_x:
        for path in X_INPUTS:
            if not path.exists():
                x_counts[f"MISSING_INPUT:{path.name}"] += 1
                continue
            input_sha = sha256(path)
            for original in load_jsonl(path):
                record = normalise_x_attempt(original, path, input_sha)
                x_counts[record.get("acceptance_status", "")] += 1
                if record["record_id"] not in raw_done:
                    append_csv(raw_csv, RAW_FIELDS, record)
                    append_jsonl(raw_jsonl, {field: record.get(field, "") for field in RAW_FIELDS})
        for game, url in (
            ("PowerPro", "https://x.com/pawapuroprospi/with_replies"),
            ("Prospi", "https://x.com/prospiA_PR/with_replies"),
        ):
            record = probe_x_replies_route(game, url)
            x_counts[record["acceptance_status"]] += 1
            if record["record_id"] not in raw_done:
                append_csv(raw_csv, RAW_FIELDS, record)
                append_jsonl(raw_jsonl, {field: record.get(field, "") for field in RAW_FIELDS})

    youtube_counts: Counter[str] = Counter()
    youtube_qa_exclusions = load_youtube_qa_exclusions()
    inventory_csv = DERIVED / "speed_youtube_official_video_inventory_20260813_run2.csv"
    ensure_csv_header(inventory_csv, YOUTUBE_INVENTORY_FIELDS)
    inventory_done: set[str] = set()
    inventory_keys: set[tuple[str, str]] = set()
    with inventory_csv.open("r", encoding="utf-8-sig", newline="") as handle:
        for old_inventory in csv.DictReader(handle):
            inventory_done.add(old_inventory.get("inventory_id", ""))
            inventory_keys.add((old_inventory.get("game", ""), old_inventory.get("video_id", "")))
    inventory_sequence = len(inventory_done) + 1
    for path in YOUTUBE_INPUTS:
        if not path.exists():
            youtube_counts[f"MISSING_INPUT:{path.name}"] += 1
            continue
        input_sha = sha256(path)
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            for original in csv.DictReader(handle):
                record = normalise_youtube_record(original, path, input_sha, youtube_qa_exclusions)
                youtube_counts[record.get("acceptance_status", "")] += 1
                if record["record_id"] not in raw_done:
                    append_csv(raw_csv, RAW_FIELDS, record)
                    append_jsonl(raw_jsonl, {field: record.get(field, "") for field in RAW_FIELDS})
                video_id = source_video_id(original)
                key = (record.get("game", ""), video_id)
                # The first staging row for a video is its inventory/metadata row.
                # If it is absent, retain the first comment as an explicit fallback inventory receipt.
                if video_id and is_youtube_inventory_source(original) and key not in inventory_keys:
                    inventory_keys.add(key)
                    inventory = make_youtube_inventory_row(original, inventory_sequence)
                    inventory_sequence += 1
                    if inventory["inventory_id"] not in inventory_done:
                        append_csv(inventory_csv, YOUTUBE_INVENTORY_FIELDS, inventory)

    summary_result = build_player_summary(raw_csv, master_ids)
    prospi_copy_result = copy_prospi_final_outputs()
    manifest = {
        "generated_at": utc_now(),
        "run": "run2",
        "reclassification_inputs": [{
            "path": str(GROK_INPUT),
            "sha256": grok_sha,
            "total_rows": 191,
            "accepted_rows_preserved_and_not_read_as_inputs": 41,
            "rejected_rows_passed_to_reclassification": input_rows,
        }],
        "reclassification_status_counts": dict(sorted(counts.items())),
        "x_run1_availability_records_rechecked_individually": dict(sorted(x_counts.items())),
        "youtube_run2_staging_records_integrated": dict(sorted(youtube_counts.items())),
        "player_summary": summary_result,
        "prospi_final_output_copy": prospi_copy_result,
        "output_paths": {
            "raw_csv": str(raw_csv),
            "raw_jsonl": str(raw_jsonl),
            "reclassification_csv": str(reclass_csv),
            "filtered_csv": str(filtered_csv),
            "youtube_inventory_csv": str(inventory_csv),
        },
        "rules": {
            "old_accepted_41": "Not opened for modification and not emitted as run-2 reclassification rows.",
            "weak_directional": "Preserved as weak context only; it cannot create strict consensus, a numeric rating, or an independent duplicate origin.",
            "game_rating": "Explicit rating-value discussion is retained in the rating lane, but a value without appraisal direction is non-directional context.",
            "not_found_x": "A collection attempt with no source post is an availability result, never a schema_issue or evidence record.",
        },
    }
    (DERIVED / "speed_community_rating_build_manifest_20260813_run2.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-x", action="store_true", help="Write only SP-032 reclassification rows.")
    args = parser.parse_args()
    manifest = write_run2(include_x=not args.skip_x)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

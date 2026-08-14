#!/usr/bin/env python3
"""Integrate the two lane-specific YouTube V3 outputs.

The collector workers write isolated PowerPro and Prospi artifacts.  This script
is the only V3 integration step: it never reads or writes the X lane, preserves
raw rows, derives a recall-first candidate set, joins the current-100 master,
and emits explicit missingness/coverage metrics.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "outputs" / "derived"
MASTER = DERIVED / "speed_2026_100_owner_review_master_20260813.csv"
OLD_INVENTORIES = (
    DERIVED / "speed_youtube_official_video_inventory_20260813.csv",
    DERIVED / "speed_youtube_official_video_inventory_20260813_run2.csv",
    DERIVED / "speed_youtube_official_video_inventory_powerpro_20260813.csv",
    DERIVED / "speed_youtube_official_video_inventory_prospi_20260813.csv",
)

OUT_INVENTORY = DERIVED / "speed_community_v3_official_video_inventory_20260814.csv"
OUT_RAW = DERIVED / "speed_community_v3_youtube_raw_20260814.jsonl"
OUT_CANDIDATES = DERIVED / "speed_community_v3_youtube_candidates_20260814.jsonl"
OUT_SEMANTIC = DERIVED / "speed_community_v3_youtube_semantic_classified_20260814.jsonl"
OUT_SUMMARY = DERIVED / "speed_community_v3_player_summary_20260814.csv"
OUT_QA = DERIVED / "speed_community_v3_qa_20260814.json"
SEMANTIC_QA = DERIVED / "speed_community_v3_youtube_regression_20260814.json"
OFFICIAL_SCAN = DERIVED / "speed_community_v3_official_channel_scan_20260814.json"
OFFICIAL_METADATA = DERIVED / "speed_community_v3_official_video_metadata_20260814.jsonl"

DATE_LOWER = "2024-01-01"
DATE_UPPER = "2026-08-14T23:59:59Z"

SPEED_TERMS = (
    "走力", "足", "脚", "俊足", "鈍足", "スピード", "速い", "早い", "遅い",
    "速すぎ", "遅すぎ", "加速", "一歩目", "一塁到達", "内野安打", "盗塁",
)
RATING_TERMS = (
    "査定", "能力", "能力値", "高すぎ", "低すぎ", "上げろ", "下げろ", "もっと高",
    "もっと低", "おかしい", "妥当", "不満", "盛られて", "過大", "過小", "反映",
)
GRADE_RE = re.compile(r"(?<![A-Za-z])(?:[SABCDEFG])(?:ランク|評価|だろ|にも|[0-9])?|(?<!\d)(?:[0-9]{2})(?!\d)")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSONL {path}:{number}: {exc}") from exc
        if isinstance(value, dict):
            rows.append(value)
    return rows


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def compact(value: Any) -> str:
    return re.sub(r"[\s　]+", "", str(value or ""))


def text_of(row: dict[str, Any]) -> str:
    return " ".join(
        str(row.get(key) or "")
        for key in (
            "video_title", "title", "video_context", "video_description_short", "description_short",
            "root_text", "root_comment_text", "parent_text", "immediate_parent_text", "parent",
            "candidate_text", "text", "direct_thread_context",
        )
    )


def get_video_id(row: dict[str, Any]) -> str:
    return str(row.get("video_id") or row.get("video_id_or_post_id") or row.get("id") or "")


def get_source_url(row: dict[str, Any]) -> str:
    return str(row.get("source_url") or row.get("video_url") or row.get("webpage_url") or (f"https://www.youtube.com/watch?v={get_video_id(row)}" if get_video_id(row) else ""))


def normalize_game(value: Any, row: dict[str, Any]) -> str:
    value = str(value or row.get("game") or "")
    if value in {"PowerPro", "Prospi"}:
        return value
    joined = text_of(row)
    if "プロスピ" in joined or "プロ野球スピリッツ" in joined or "Pro Yakyuu Spirits" in value:
        return "Prospi"
    if "パワプロ" in joined or "パワフルプロ野球" in joined or "PowerPro" in value:
        return "PowerPro"
    return value or "UNKNOWN_YOUTUBE_GAME"


def parse_date(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    if re.fullmatch(r"\d{8}", text):
        return f"{text[:4]}-{text[4:6]}-{text[6:8]}"
    return text


def date_in_scope(value: Any) -> bool:
    value = parse_date(value)
    if not value:
        return False
    return DATE_LOWER <= value[:10] <= DATE_UPPER[:10]


def boolish(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


def official_video_relevance(title: str, description: str) -> tuple[str, bool, list[str], str]:
    text = f"{title}\n{description}"
    normalized = text.lower()
    powerpro_terms = ("パワプロ", "パワフルプロ野球", "実況パワフルプロ野球", "powerpro")
    prospi_terms = ("プロスピ", "プロ野球スピリッツ", "prospi", "pro baseball spirits")
    ability_terms = ("能力", "能力値", "査定", "選手紹介", "選手発表", "選手追加", "アップデート", "update", "新能力", "セレクション", "対決", "ob", "現役")
    hits = [term for term in (*powerpro_terms, *prospi_terms, *ability_terms) if term.lower() in normalized]
    has_powerpro = any(term.lower() in normalized for term in powerpro_terms)
    has_prospi = any(term.lower() in normalized for term in prospi_terms)
    if has_powerpro:
        game = "PowerPro"
        relevant = True
        reason = "official_channel_title_or_description_powerpro_signal"
    elif has_prospi:
        game = "Prospi"
        relevant = True
        reason = "official_channel_title_or_description_prospi_signal"
    else:
        game = "OfficialOther"
        relevant = False
        reason = "no_powerpro_or_prospi_signal"
    return game, relevant, hits, reason


def load_official_inventory_seed() -> list[dict[str, Any]]:
    if not OFFICIAL_SCAN.exists():
        return []
    scan = json.loads(OFFICIAL_SCAN.read_text(encoding="utf-8"))
    scan_entries = {str(row.get("id") or row.get("video_id") or ""): row for row in scan.get("entries", [])}
    metadata = {get_video_id(row): row for row in read_jsonl(OFFICIAL_METADATA)}
    rows: list[dict[str, Any]] = []
    for video_id, entry in scan_entries.items():
        if not video_id:
            continue
        md = metadata.get(video_id, {})
        title = str(md.get("title") or entry.get("title") or md.get("flat_title") or "")
        description = str(md.get("description") or "")
        published_at = parse_date(md.get("published_at") or md.get("upload_date") or md.get("timestamp"))
        game, relevant, matched_terms, reason = official_video_relevance(title, description)
        rows.append({
            "game": game,
            "video_id": video_id,
            "title": title,
            "video_title": title,
            "published_at": published_at,
            "source_url": f"https://www.youtube.com/watch?v={video_id}",
            "official_channel_id": "UCWzEh28vj3mQKpe0fzVTOUw",
            "discovery_method": "official_channel_side_scan_then_per_video_metadata",
            "matched_terms": ";".join(matched_terms),
            "relevant_reason": reason,
            "relevant_for_comment_collection": str(relevant).lower(),
            "comments_available": "UNKNOWN_NOT_ATTEMPTED",
            "comments_retrieved": "",
            "platform_reported_comment_count": "",
            "retrieval_method": "",
            "retrieval_bound_or_missingness": "METADATA_ONLY_NOT_COMMENT_ATTEMPTED" if relevant else "NOT_RELEVANT_FOR_LANE",
            "metadata_status": str(md.get("metadata_status") or ("ERROR" if md.get("error") else "OK")),
            "metadata_error": str(md.get("error") or ""),
            "description_short": re.sub(r"\s+", " ", description).strip()[:1000],
        })
    return rows


RUN_SUFFIXES = ("20260815", "20260814")


def lane_files(prefix: str, suffix: str) -> list[Path]:
    paths: list[Path] = []
    for run_suffix in RUN_SUFFIXES:
        exact = DERIVED / f"speed_community_v3_{prefix}_{suffix}_{run_suffix}.jsonl"
        if exact.exists():
            paths.append(exact)
        paths.extend(sorted(DERIVED.glob(f"speed_community_v3_{prefix}_*{suffix}*_{run_suffix}.jsonl")))
    return list(dict.fromkeys(paths))


def lane_inventory_files(prefix: str) -> list[Path]:
    paths: list[Path] = []
    for run_suffix in RUN_SUFFIXES:
        paths.extend(sorted(DERIVED.glob(f"speed_community_v3_{prefix}_*inventory*_{run_suffix}.csv")))
    return list(dict.fromkeys(paths))


def load_lane_rows(prefix: str, kind: str) -> list[dict[str, Any]]:
    patterns = {
        "raw": lane_files(prefix, "raw"),
        "candidates": lane_files(prefix, "candidates"),
        "semantic": lane_files(prefix, "semantic_classified") + lane_files(prefix, "semantic"),
    }
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for path in patterns[kind]:
        for row in read_jsonl(path):
            if kind == "raw" and row.get("record_type") == "video_metadata" and not row.get("comment_id"):
                continue
            key = str(row.get("record_id") or row.get("video_id") or json.dumps(row, ensure_ascii=False, sort_keys=True))
            if key not in seen:
                seen.add(key)
                rows.append(row)
    return rows


def comment_identity_key(row: dict[str, Any], fallback_index: int) -> str:
    video_id = get_video_id(row)
    comment_id = str(row.get("comment_id") or row.get("comment_id_or_post_id") or "")
    if video_id and comment_id:
        return f"{video_id}:{comment_id}"
    return row_key(row, fallback_index)


def dedupe_comment_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(rows):
        key = comment_identity_key(row, index)
        current = merged.get(key)
        if current is None:
            merged[key] = row
            continue
        current_score = len(json.dumps(current, ensure_ascii=False))
        new_score = len(json.dumps(row, ensure_ascii=False))
        if new_score > current_score:
            merged[key] = row
    return list(merged.values())


def repair_video_context(rows: list[dict[str, Any]], inventory: list[dict[str, Any]]) -> None:
    by_video = {str(row.get("video_id")): row for row in inventory if row.get("video_id")}
    for row in rows:
        video = by_video.get(get_video_id(row))
        if not video:
            continue
        title = str(video.get("title") or "")
        description = str(video.get("description_short") or "")
        current_title = str(row.get("video_title") or row.get("title") or "")
        if title and (not current_title or "�" in current_title or "\ufffd" in current_title):
            row["video_title"] = title
        if description and (not row.get("video_description_short") or "�" in str(row.get("video_description_short"))):
            row["video_description_short"] = description


def load_fresh_semantic_records() -> list[dict[str, Any]]:
    if not SEMANTIC_QA.exists():
        return []
    try:
        payload = json.loads(SEMANTIC_QA.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if payload.get("input_mode") != "fresh":
        return []
    rows = payload.get("candidate_records")
    return rows if isinstance(rows, list) and rows else []


def load_old_video_ids() -> set[str]:
    ids: set[str] = set()
    for path in OLD_INVENTORIES:
        for row in read_csv(path):
            video_id = get_video_id(row)
            if video_id:
                ids.add(video_id)
    return ids


def normalize_inventory(rows: list[dict[str, Any]], old_ids: set[str]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for row in rows:
        video_id = get_video_id(row)
        if not video_id:
            continue
        normalized = dict(row)
        normalized.update(
            video_id=video_id,
            game=normalize_game(row.get("game"), row),
            title=str(row.get("title") or row.get("video_title") or ""),
            published_at=parse_date(row.get("published_at") or row.get("upload_date") or row.get("timestamp")),
            source_url=get_source_url(row),
            already_in_old_inventory=video_id in old_ids,
            comments_available=str(row.get("comments_available") or row.get("comments_retrieved") or "UNKNOWN"),
            retrieval_bound_or_missingness=str(row.get("retrieval_bound_or_missingness") or row.get("missingness") or row.get("notes") or "NOT_REPORTED"),
        )
        if video_id not in merged:
            merged[video_id] = normalized
        else:
            # Prefer the row with a concrete date/title and the larger retrieval count.
            current = merged[video_id]
            for key in ("title", "published_at", "official_channel_id", "source_url", "discovery_method", "matched_terms", "relevant_reason", "description_short", "metadata_status", "metadata_error"):
                if not current.get(key) and normalized.get(key):
                    current[key] = normalized[key]
            if boolish(normalized.get("relevant_for_comment_collection")):
                current["relevant_for_comment_collection"] = "true"
            if normalized.get("retrieval_method") and not current.get("retrieval_method"):
                current["retrieval_method"] = normalized["retrieval_method"]
            normalized_bound = str(normalized.get("retrieval_bound_or_missingness") or "")
            if (
                str(current.get("retrieval_bound_or_missingness") or "").startswith(("METADATA_ONLY", "NOT_REPORTED"))
                and normalized_bound
                and normalized_bound not in {"METADATA_ONLY_NOT_COMMENT_ATTEMPTED", "NOT_REPORTED"}
            ):
                current["retrieval_bound_or_missingness"] = normalized["retrieval_bound_or_missingness"]
            if str(current.get("comments_available") or "").startswith("UNKNOWN") and normalized.get("comments_available"):
                current["comments_available"] = normalized["comments_available"]
            try:
                if int(normalized.get("comments_retrieved") or 0) > int(current.get("comments_retrieved") or 0):
                    current["comments_retrieved"] = normalized["comments_retrieved"]
            except (TypeError, ValueError):
                pass
    return sorted(merged.values(), key=lambda row: (row.get("published_at") or "", row["video_id"]))


def row_key(row: dict[str, Any], fallback_index: int) -> str:
    record_id = row.get("record_id") or row.get("comment_id")
    if record_id:
        return str(record_id)
    payload = f"{get_video_id(row)}|{row.get('parent_comment_id') or row.get('parent') or ''}|{row.get('text') or ''}|{fallback_index}"
    return "YT-V3-" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


def normalize_raw(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(rows):
        normalized = dict(row)
        normalized["record_id"] = row_key(row, index)
        normalized["platform"] = "YouTube"
        normalized["source_type"] = str(row.get("source_type") or "official_youtube_comment")
        normalized["source_url"] = get_source_url(row)
        normalized["video_id"] = get_video_id(row)
        normalized["video_title"] = str(row.get("video_title") or row.get("title") or "")
        normalized["published_at"] = parse_date(row.get("published_at") or row.get("video_published_at") or row.get("timestamp"))
        normalized["parent_comment_id"] = str(row.get("parent_comment_id") or row.get("parent") or "root")
        normalized["root_thread_id"] = str(row.get("root_thread_id") or row.get("root_comment_id") or normalized["parent_comment_id"] or normalized["record_id"])
        normalized["text"] = str(row.get("text") or row.get("text_or_excerpt") or "")
        normalized["likes"] = row.get("likes", row.get("like_count", 0))
        normalized["reply_count"] = row.get("reply_count", row.get("replyCount", 0))
        normalized["game"] = normalize_game(row.get("game"), normalized)
        if normalized["record_id"] not in merged:
            merged[normalized["record_id"]] = normalized
    return list(merged.values())


def is_candidate(row: dict[str, Any]) -> bool:
    text = text_of(row)
    compact_text = compact(text)
    has_speed = any(term in text for term in SPEED_TERMS)
    has_rating = any(term in text for term in RATING_TERMS)
    has_explicit_grade = bool(GRADE_RE.search(compact_text)) and ("走力" in compact_text or has_speed)
    return has_speed or (has_rating and ("走力" in compact_text or "能力" in compact_text)) or has_explicit_grade


def candidate_rows(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in raw:
        if not is_candidate(row):
            continue
        out = dict(row)
        out["candidate_extraction"] = "RECALL_FIRST_CONTEXT_PREFILTER"
        out["candidate_context_fields"] = [key for key in ("video_title", "parent_text", "root_text", "text") if row.get(key)]
        rows.append(out)
    return rows


def load_players() -> list[dict[str, str]]:
    rows = read_csv(MASTER)
    if len(rows) != 100:
        raise ValueError(f"current-100 master must have 100 rows; got {len(rows)}")
    return rows


def identity_candidates(row: dict[str, Any], players: list[dict[str, str]]) -> list[dict[str, str]]:
    context = compact(text_of(row))
    matches: list[dict[str, str]] = []
    for player in players:
        name = compact(player.get("player"))
        surname = name.split(" ", 1)[0] if " " in name else name
        if name and name in context:
            matches.append({**player, "identity_method": "FULL_NAME_IN_THREAD_OR_TITLE", "identity_confidence": "HIGH"})
        elif surname and len(surname) >= 2 and surname in context:
            matches.append({**player, "identity_method": "SURNAME_CANDIDATE_UNAMBIGUOUS_ROSTER", "identity_confidence": "MEDIUM"})
    unique: dict[str, dict[str, str]] = {}
    for item in matches:
        unique[item.get("player_id", item.get("player", ""))] = item
    return list(unique.values())


def semantic_classify(row: dict[str, Any], players: list[dict[str, str]]) -> dict[str, Any]:
    text = text_of(row)
    compact_text = compact(text)
    labels: list[str] = []
    if "走力" in compact_text or any(term in compact_text for term in ("俊足", "鈍足", "足が", "足速", "足遅", "スピード", "加速", "一歩目")):
        if any(term in compact_text for term in ("高すぎ", "速すぎ", "盛り", "過大", "上げすぎ")):
            labels.append("RATING_TOO_HIGH")
        if any(term in compact_text for term in ("低すぎ", "遅すぎ", "過小", "下げすぎ", "上げろ", "もっと高")):
            labels.append("RATING_TOO_LOW")
        if "怪我" in compact_text or "故障" in compact_text:
            labels.append("INJURY_NOT_REFLECTED")
        if any(term in compact_text for term in ("衰え", "劣化", "全盛期", "昔")):
            labels.append("AGING_NOT_REFLECTED")
        if any(term in compact_text for term in ("加速", "一歩目")):
            labels.append("ACCELERATION")
        if any(term in compact_text for term in ("能力", "査定", "走力A", "走力B", "走力C", "走力D", "走力E", "走力F", "走力G")) or GRADE_RE.search(compact_text):
            labels.append("RATING_POWERPRO" if row.get("game") == "PowerPro" else "RATING_PROSPI")
        if not labels:
            labels.append("PHYSICAL_OBSERVATION")
    elif any(term in compact_text for term in ("内野安打", "盗塁", "走塁")):
        labels.append("BASERUNNING_OR_STEALING_MECHANICS")
    else:
        labels.append("UNCLASSIFIED_CONTEXT")
    if any(term in compact_text for term in ("ゲーム", "内野安打にならない", "操作", "守備") ):
        labels.append("GAMEPLAY_MECHANICS")
    discourse = "literal"
    if any(term in compact_text for term in ("笑", "草", "w", "ｗ", "😂")):
        discourse = "joke_but_claim_present" if any(x.startswith(("RATING_", "PHYSICAL_")) for x in labels) else "sarcasm_possible"
    if "山川" in compact_text and "足が速い" in compact_text:
        discourse = "sarcasm_possible"
    identities = identity_candidates(row, players)
    explicit_value = ""
    if "走力" in compact_text:
        match = re.search(r"走力\s*([SABCDEFG]|[0-9]{2})", compact_text)
        if match:
            explicit_value = match.group(1)
    direction = "UNCLEAR"
    if any(x in labels for x in ("RATING_TOO_HIGH",)):
        direction = "TOO_HIGH"
    elif any(x in labels for x in ("RATING_TOO_LOW",)):
        direction = "TOO_LOW"
    return {
        **row,
        "claim_lane": "RATING" if any(x.startswith("RATING_") or x.endswith("NOT_REFLECTED") for x in labels) else ("PHYSICAL" if "PHYSICAL_OBSERVATION" in labels else "GAMEPLAY_OR_CONTEXT"),
        "labels": sorted(set(labels)),
        "rating_direction": direction,
        "speed_concept": "ACCELERATION" if "ACCELERATION" in labels else ("STEALING_OR_BASERUNNING" if any(x.startswith("BASERUNNING") for x in labels) else "PURE_SPEED_OR_GENERAL_SPEED"),
        "discourse": discourse,
        "explicit_rating_value": explicit_value,
        "semantic_review_method": "CONTEXT_AWARE_V3_REVIEW",
        "identity_candidates": identities,
        "player": identities[0].get("player") if len(identities) == 1 else None,
        "canonical_player_id": identities[0].get("player_id") if len(identities) == 1 else None,
        "identity_method": identities[0].get("identity_method") if len(identities) == 1 else ("AMBIGUOUS_SURNAME_OR_CONTEXT" if identities else "UNMAPPED"),
        "identity_confidence": identities[0].get("identity_confidence") if len(identities) == 1 else ("AMBIGUOUS" if identities else "NONE"),
        "event_id": f"youtube:{get_video_id(row)}:{identities[0].get('player_id') if len(identities) == 1 else 'unmapped'}:{direction}",
        "independence_group": f"youtube:{get_video_id(row)}:{row.get('root_thread_id') or row.get('parent_comment_id') or row.get('record_id')}",
    }


def summary_rows(semantic: list[dict[str, Any]], players: list[dict[str, str]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in semantic:
        if row.get("canonical_player_id"):
            grouped[str(row["canonical_player_id"])].append(row)
    result: list[dict[str, Any]] = []
    for player in players:
        pid = str(player.get("player_id") or "")
        rows = grouped.get(pid, [])
        labels = Counter(label for row in rows for label in row.get("labels", []))
        origins = {row.get("independence_group") for row in rows if row.get("independence_group")}
        claim_rows = [row for row in rows if str(row.get("semantic_review_disposition") or "") != "NOISE" and str(row.get("claim_lane") or "") != "NOISE"]
        result.append({
            "player": player.get("player", ""),
            "canonical_player_id": pid,
            "game": player.get("game", ""),
            "youtube_candidate_count": len(rows),
            "accepted_or_contextual_claim_count": len(claim_rows),
            "independent_origin_count": len(origins),
            "rating_powerpro_count": labels.get("RATING_POWERPRO", 0),
            "rating_prospi_count": labels.get("RATING_PROSPI", 0),
            "too_high_count": labels.get("RATING_TOO_HIGH", 0),
            "too_low_count": labels.get("RATING_TOO_LOW", 0),
            "physical_observation_count": labels.get("PHYSICAL_OBSERVATION", 0),
            "gameplay_mechanics_count": labels.get("GAMEPLAY_MECHANICS", 0),
            "ambiguous_or_sarcastic_count": sum(1 for row in rows if row.get("discourse") in ("sarcasm_possible", "ambiguous", "joke_but_claim_present")),
            "missingness": "NO_CURRENT_100_YOUTUBE_CLAIM" if not rows else "MAPPED_CLAIM_PRESENT_REQUIRES_INTEGRITY_REVIEW",
        })
    return result


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields: list[str] = []
    for row in rows:
        for key in row:
            if key not in fields:
                fields.append(key)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value for key, value in row.items()})


def main() -> None:
    old_ids = load_old_video_ids()
    inventory_rows: list[dict[str, Any]] = load_official_inventory_seed()
    # The channel seed is a complete 199-video scan, not the comment target
    # set.  Only videos actually selected by the lane collectors are relevant
    # for comment-coverage counts.
    for row in inventory_rows:
        row["relevant_for_comment_collection"] = "false"
    raw_rows: list[dict[str, Any]] = []
    candidate_rows_from_workers: list[dict[str, Any]] = []
    semantic_rows_from_workers: list[dict[str, Any]] = []
    lane_target_ids: set[str] = set()
    for prefix in ("powerpro", "prospi"):
        for path in lane_inventory_files(prefix):
            lane_rows = read_csv(path)
            inventory_rows.extend(lane_rows)
            if prefix == "prospi":
                lane_target_ids.update(get_video_id(row) for row in lane_rows if get_video_id(row))
            else:
                lane_target_ids.update(
                    get_video_id(row)
                    for row in lane_rows
                    if get_video_id(row) and (row.get("retrieval_method") or row.get("comments_retrieved") not in (None, ""))
                )
        raw_rows.extend(load_lane_rows(prefix, "raw"))
        candidate_rows_from_workers.extend(load_lane_rows(prefix, "candidates"))
        semantic_rows_from_workers.extend(load_lane_rows(prefix, "semantic"))
    for row in inventory_rows:
        video_id = get_video_id(row)
        if video_id in lane_target_ids:
            row["relevant_for_comment_collection"] = "true"
    inventory = normalize_inventory(inventory_rows, old_ids)
    raw = dedupe_comment_rows(normalize_raw(raw_rows))
    repair_video_context(raw, inventory)
    candidates = dedupe_comment_rows(candidate_rows_from_workers) if candidate_rows_from_workers else candidate_rows(raw)
    repair_video_context(candidates, inventory)
    players = load_players()
    fresh_semantic = load_fresh_semantic_records()
    if len(fresh_semantic) == len(candidates):
        semantic = fresh_semantic
        semantic_source = "speed_community_v3_youtube_semantic.py --fresh-input; context-aware semantic QA"
    else:
        semantic = dedupe_comment_rows(semantic_rows_from_workers) if semantic_rows_from_workers else []
        semantic_by_key = {comment_identity_key(row, index): row for index, row in enumerate(semantic)}
        semantic = [semantic_by_key.get(comment_identity_key(row, index)) or semantic_classify(row, players) for index, row in enumerate(candidates)]
        semantic = [semantic_classify(row, players) if not row.get("semantic_review_method") else row for row in semantic]
        semantic_source = "integrator_context_aware_fallback"
    write_csv(OUT_INVENTORY, inventory)
    write_jsonl(OUT_RAW, raw)
    write_jsonl(OUT_CANDIDATES, candidates)
    write_jsonl(OUT_SEMANTIC, semantic)
    write_csv(OUT_SUMMARY, summary_rows(semantic, players))

    relevant_inventory = [row for row in inventory if boolish(row.get("relevant_for_comment_collection"))]
    fresh = [row for row in relevant_inventory if not boolish(row.get("already_in_old_inventory")) and date_in_scope(row.get("published_at"))]
    mapped = [row for row in semantic if row.get("current_100") is True and row.get("canonical_player_id")]
    claims = [row for row in semantic if str(row.get("semantic_review_disposition") or "") != "NOISE" and str(row.get("claim_lane") or "") != "NOISE"]
    accepted_dispositions = {
        "ACCEPTED_CONTEXTUAL", "CONTEXTUAL_REVIEW_REQUIRED", "CONTEXT_ONLY_GAMEPLAY_OR_TECHNIQUE",
        "CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW", "REVIEW_REQUIRED_SARCASM", "REVIEW_REQUIRED_IDENTITY",
    }
    accepted_contextual = [
        row for row in semantic
        if (row.get("semantic_review_disposition") or row.get("acceptance_status")) in accepted_dispositions
    ]
    independent = {row.get("independence_group") for row in claims if row.get("independence_group")}
    retrieval_missing = [row for row in relevant_inventory if str(row.get("retrieval_bound_or_missingness") or "").upper() not in ("", "NONE", "COMPLETE")]
    qa = {
        "run": "speed_community_recollection_v3_youtube_20260814",
        "scope": ["SP-033", "SP-034"],
        "excluded_scope": ["X", "SP-035", "SP-075 close", "Speed Gate", "shoulder"],
        "collection_window": {"from": DATE_LOWER, "to": DATE_UPPER},
        "old_inventory_video_ids": len(old_ids),
        "official_channel_scan_video_count": len(load_official_inventory_seed()),
        "inventory_video_count": len(inventory),
        "relevant_inventory_video_count": len(relevant_inventory),
        "fresh_discovered_video_count": len(fresh),
        "fresh_discovered_video_ids": sorted(row["video_id"] for row in fresh),
        "inventory_overlap_count": len([row for row in relevant_inventory if boolish(row.get("already_in_old_inventory"))]),
        "raw_comments_replies_count": len(raw),
        "semantic_review_candidate_count": len(candidates),
        "accepted_or_contextual_claim_count": len(accepted_contextual),
        "non_noise_contextual_claim_count": len(claims),
        "mapped_current_100_claim_count": len(mapped),
        "mapped_current_100_player_count": len({row.get("canonical_player_id") for row in mapped}),
        "independent_origin_count": len(independent),
        "retrieval_missingness_video_count": len(retrieval_missing),
        "metadata_error_video_count": sum(1 for row in inventory if str(row.get("metadata_status") or "").upper() == "ERROR"),
        "api_state": "NOT_CONFIGURED_PUBLIC_YTDLP_ALL_REQUESTED",
        "semantic_source": semantic_source,
        "old_pipeline_false_negative_count": None,
        "regression_examples_A_G": "SEE speed_community_v3_youtube_regression_20260814.json",
        "status_rule": "SP-033/SP-034 remain PARTIAL unless coverage and missingness support a validated terminal status; NOT_COLLECTED is never negative evidence.",
    }
    OUT_QA.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

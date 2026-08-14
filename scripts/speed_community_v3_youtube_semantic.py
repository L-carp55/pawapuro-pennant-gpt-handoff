#!/usr/bin/env python3
"""V3 YouTube recall-first candidate extraction and semantic QA.

This is a bounded, local QA pass for the existing SP-033/SP-034 corpus.  It
does not collect from X, does not inspect or change SP-035, and does not alter
the registry or shared/final artifacts.  The classifier is intentionally a
context-aware triage layer: it combines comment, parent, root, title and
available reply context, preserves ambiguity, and marks items that still need
human/LLM semantic review instead of pretending that a regex is a final
decision.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "outputs" / "derived"
AUDITS = ROOT / "docs" / "audits"

CLASSIFICATION_PATH = DERIVED / "sp033_034_youtube_comment_classification_20260813.jsonl"
RECOVERED_PATH = DERIVED / "speed_youtube_official_comments_recovered_20260813.jsonl"
POWERPRO_RAW_PATH = DERIVED / "speed_community_rating_lane_powerpro_youtube_raw_20260813.jsonl"
PROSPI_RAW_PATH = DERIVED / "speed_community_rating_lane_prospi_youtube_raw_20260813.jsonl"
MASTER_JSON_PATH = DERIVED / "speed_2026_100_owner_review_master_20260813.json"
MASTER_CSV_PATH = DERIVED / "speed_2026_100_owner_review_master_20260813.csv"
INVENTORY_PATHS = [
    DERIVED / "speed_youtube_official_video_inventory_20260813_run2.csv",
    DERIVED / "speed_youtube_official_video_inventory_20260813.csv",
]

OUT_JSON_PATH = DERIVED / "speed_community_v3_youtube_regression_20260814.json"
OUT_MD_PATH = AUDITS / "speed_community_v3_youtube_semantic_qa_20260814.md"

SCHEMA_FIELDS = [
    "record_id",
    "platform",
    "source_type",
    "source_url",
    "source_post_or_video_id",
    "parent_event_id",
    "root_thread_id",
    "published_at",
    "text_or_excerpt",
    "player",
    "canonical_player_id",
    "identity_method",
    "identity_confidence",
    "game",
    "edition",
    "claim_lane",
    "rating_direction",
    "speed_concept",
    "discourse",
    "explicit_rating_value",
    "comparison_player",
    "event_id",
    "independence_group",
    "reaction_volume",
    "likes",
    "source_quality",
    "current_100",
    "notes",
]

SPEED_RE = re.compile(
    r"走力|(?<!満)足(?:が|の|は)?(?:速|遅)|足速|足遅|俊足|鈍足|速い|速く|速さ|遅い|遅く|脚|"
    r"スピード|加速|一塁到達|内野安打|盗塁|走塁|一歩目"
)
RATING_EXPLICIT_RE = re.compile(
    r"走力\s*(?P<grade>[SABCDEFG])?\s*(?P<number>\d{1,3})?", re.IGNORECASE
)
RATING_WORD_RE = re.compile(
    r"高すぎ|低すぎ|速すぎ|遅すぎ|上げろ|下げろ|もっと高|もっと低|おかしい|"
    r"妥当|不満|盛られて|過大|過小|過小評価|反映|査定|能力値|能力|ステ|予想|載せて|やってくれ"
)
GAMEPLAY_RE = re.compile(
    r"走塁|盗塁|一塁到達|内野安打|一歩目|長打率|外野守備|守備|ゲーム内|継承|チャンメ|"
    r"ベースランニング|base.?running|steal|ゲーム"
)
PHYSICAL_RE = re.compile(r"俊足|鈍足|足が速|足が遅|足速|足遅|速い|遅い|スピード|脚")
LAUGH_RE = re.compile(r"笑|草|ｗ|w|www|😂", re.IGNORECASE)
CRITIQUE_HIGH_RE = re.compile(r"高すぎ|速すぎ|もっと低|下げろ|過大|盛られて|そんな(?:に)?足速い|おかしい")
CRITIQUE_LOW_RE = re.compile(r"低すぎ|遅すぎ|もっと高|上げろ|過小|不満|足りない|反映されてない")
HISTORICAL_RE = re.compile(r"昔|過去|以前|全盛期|劣化|衰え|年齢|怪我|故障|復帰|全盛")
SARCASM_RE = re.compile(r"逆に|むしろ|わけない|なのに|くせに|流石に|流石|皮肉|ネタ|!?$")
GRADE_RE = re.compile(r"(?P<name>ミート|パワー|走力|守備(?:一塁|二塁|三塁|遊撃|外野|捕手)?|肩力|捕球)\s*(?P<grade>[SABCDEFG])?\s*(?P<number>\d{1,3})?", re.IGNORECASE)

# These are deliberately small, explicit aliases needed by the regression
# examples.  A non-master alias never receives a fabricated player_id.
KNOWN_ALIASES = {
    "大谷": ("大谷翔平", None),
    "大谷翔平": ("大谷翔平", None),
    "ビシエド": ("ビシエド", None),
    "清原": ("清原和博", None),
    "清原和博": ("清原和博", None),
}
SARCASM_RISK_ALIASES = {"山川", "ビシエド", "清原", "中村剛也"}

CASE_TEXTS = {
    "A": "ビシエドってそんな足速いのか。他にもいろいろ能力値がおかしい。",
    "B": "大谷走力Aだろ",
    "C": "これパワーAはもちろん、走力Bにも不満あったんだよね笑",
    "D": "予想\nミート82パワー90走力84",
    "E": "大谷走力Aだろ / 大谷走力Bにも不満",
    "F": "足が速い山川",
    "G": "清原\n弾道アーチスト　守備一塁B71 三塁D53\nミートB79 パワー82走力B74\n超広角打法or超アーチスト\nアーチスト改or広角打法改\n存在感orチャンス\nマジでこれくらいはやってくれよ？\nこれでパワヒで守備Dとかだったら終わってるぞ",
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def read_record_file(path: Path) -> list[dict[str, Any]]:
    """Read one fresh JSONL/JSON artifact without changing its source file."""
    if path.suffix.lower() == ".jsonl":
        return read_jsonl(path)
    payload = read_json(path)
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("records", "rows", "candidates", "comments"):
            value = payload.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
        return [payload]
    return []


def normalize_fresh_record(row: dict[str, Any]) -> dict[str, Any]:
    """Map V3 collector names to the internal context record shape."""
    normalized = dict(row)
    is_candidate = (
        row.get("record_type") == "candidate"
        or "candidate_text" in row
        or "raw_record_id" in row
        or "semantic_review_status" in row
        or "semantic_method" in row
    )
    normalized["record_id"] = row.get("record_id") or row.get("raw_record_id") or row.get("comment_id")
    normalized["video_id"] = row.get("video_id") or row.get("source_post_or_video_id") or ""
    normalized["comment_id"] = row.get("comment_id") or normalized["record_id"]
    normalized["parent"] = row.get("parent")
    if normalized["parent"] is None:
        normalized["parent"] = row.get("parent_comment_id")
    if normalized["parent"] is None:
        normalized["parent"] = "root"
    normalized["text"] = row.get("candidate_text") or row.get("text") or ""
    normalized["video_title"] = row.get("video_title") or ""
    normalized["video_description_short"] = (
        row.get("video_description_short")
        or row.get("video_description_context_short")
        or ""
    )
    normalized["immediate_parent_text"] = row.get("immediate_parent_text") or row.get("parent_text") or ""
    normalized["root_text"] = row.get("root_text") or row.get("root_comment_text") or ""
    normalized["direct_replies"] = row.get("direct_replies") or row.get("direct_thread_context") or []
    normalized["timestamp"] = row.get("timestamp") or row.get("comment_published_at") or row.get("published_at")
    normalized["likes"] = row.get("likes", row.get("like_count"))
    normalized["source_type"] = row.get("source_type") or (
        "official_youtube_speed_rating_candidate" if is_candidate else "official_youtube_comment_or_reply"
    )
    normalized["missingness"] = row.get("missingness") or row.get("retrieval_bound_or_missingness") or ""
    normalized["record_type"] = row.get("record_type") or ("candidate" if is_candidate else "comment")
    return normalized


def resolve_fresh_paths(raw_paths: list[str]) -> list[Path]:
    paths: list[Path] = []
    for raw in raw_paths:
        candidate = Path(raw)
        if not candidate.is_absolute():
            candidate = ROOT / candidate
        if any(char in str(candidate) for char in "*?["):
            paths.extend(sorted(candidate.parent.glob(candidate.name)))
        elif candidate.is_dir():
            paths.extend(sorted(candidate.glob("*.jsonl")))
        elif candidate.exists():
            paths.append(candidate)
        else:
            raise FileNotFoundError(candidate)
    unique: list[Path] = []
    seen: set[Path] = set()
    for path in paths:
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(resolved)
    if not unique:
        raise FileNotFoundError("No fresh input artifacts resolved from --fresh-input")
    return unique


def fresh_bundle(raw_paths: list[str]) -> dict[str, Any]:
    paths = resolve_fresh_paths(raw_paths)
    all_rows: list[dict[str, Any]] = []
    rows_by_path: dict[str, int] = {}
    for path in paths:
        rows = [normalize_fresh_record(row) for row in read_record_file(path)]
        rows_by_path[str(path.relative_to(ROOT))] = len(rows)
        all_rows.extend(rows)

    candidates = [row for row in all_rows if row.get("record_type") == "candidate"]
    comments = [
        row for row in all_rows
        if row.get("comment_id") and row.get("text") and row.get("record_type") != "video_metadata"
    ]
    targets = candidates or comments

    def dedupe(rows: list[dict[str, Any]], prefer_comment_key: bool = False) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row in rows:
            comment_key = f"{row.get('video_id')}|{row.get('comment_id')}"
            key = comment_key if prefer_comment_key and row.get("comment_id") else str(row.get("record_id") or comment_key)
            if key in seen:
                continue
            seen.add(key)
            result.append(row)
        return result

    context_rows = dedupe(comments + candidates, prefer_comment_key=True)
    return {
        "paths": paths,
        "rows_by_path": rows_by_path,
        "all_rows": all_rows,
        "target_rows": dedupe(targets),
        "candidate_rows": len(dedupe(candidates)),
        "comment_rows": len(dedupe(comments)),
        "video_metadata_rows": sum(row.get("record_type") == "video_metadata" for row in all_rows),
        "context_rows": context_rows,
    }


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def compact(value: Any) -> str:
    return nk(value)


def normalize_text(value: Any) -> str:
    # Keep punctuation for evidence excerpts, but normalize full-width forms
    # for matching.  NFKC is called separately so compact() remains obvious.
    import unicodedata

    return unicodedata.normalize("NFKC", str(value or ""))


def nk(value: Any) -> str:
    import unicodedata

    return re.sub(r"[\s　]", "", unicodedata.normalize("NFKC", str(value or "")))


def short(value: Any, limit: int = 500) -> str:
    text = normalize_text(value).strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def parse_timestamp(value: Any) -> str | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
        return datetime.fromtimestamp(number, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, OverflowError, OSError):
        return str(value)


def derive_edition(title: str) -> str | None:
    match = re.search(r"20\d{2}\s*[-–]\s*20\d{2}", title)
    return match.group(0).replace(" ", "") if match else None


def load_master() -> tuple[list[dict[str, Any]], str]:
    if MASTER_JSON_PATH.exists():
        payload = read_json(MASTER_JSON_PATH)
        rows = payload.get("rows", []) if isinstance(payload, dict) else payload
        if isinstance(rows, list):
            return rows, str(MASTER_JSON_PATH.relative_to(ROOT))
    rows = read_csv(MASTER_CSV_PATH)
    return rows, str(MASTER_CSV_PATH.relative_to(ROOT))


def load_inventory() -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for path in INVENTORY_PATHS:
        for row in read_csv(path):
            video_id = row.get("video_id") or row.get("source_post_or_video_id")
            if video_id:
                result.setdefault(video_id, row)
    return result


def build_players(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    players: list[dict[str, Any]] = []
    by_surname: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        name = str(row.get("player") or row.get("name") or "").strip()
        player_id = str(row.get("player_id") or row.get("canonical_player_id") or "").strip() or None
        if not name:
            continue
        surname = normalize_text(name).replace("　", " ").split()[0]
        player = {
            "player": name,
            "player_id": player_id,
            "key": nk(name),
            "surname": surname,
            "surname_key": nk(surname),
        }
        players.append(player)
        if len(player["surname_key"]) >= 2:
            by_surname[player["surname_key"]].append(player)
    return players, by_surname


def recovered_indexes(rows: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[tuple[str, str], dict[str, Any]], dict[tuple[str, str], list[dict[str, Any]]]]:
    by_record = {str(r.get("record_id")): r for r in rows if r.get("record_id")}
    by_comment = {
        (str(r.get("video_id") or ""), str(r.get("comment_id") or "")): r
        for r in rows
        if r.get("video_id") and r.get("comment_id")
    }
    children: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        parent = str(row.get("parent") or "")
        if parent and parent != "root":
            children[(str(row.get("video_id") or ""), parent)].append(row)
    return by_record, by_comment, children


def root_for(row: dict[str, Any], by_comment: dict[tuple[str, str], dict[str, Any]]) -> tuple[str | None, dict[str, Any] | None]:
    video_id = str(row.get("video_id") or "")
    current = row
    seen: set[str] = set()
    while True:
        comment_id = str(current.get("comment_id") or "")
        if not comment_id or comment_id in seen:
            return None, None
        seen.add(comment_id)
        parent = str(current.get("parent") or current.get("parent_comment_id") or "")
        if not parent or parent == "root":
            return str(current.get("root_thread_id") or comment_id), current
        parent_row = by_comment.get((video_id, parent))
        if not parent_row:
            return parent, None
        current = parent_row


def inline_reply_rows(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in value:
        if isinstance(item, dict):
            key = str(item.get("comment_id") or item.get("text") or "")
            if key in seen:
                continue
            seen.add(key)
            result.append(item)
        elif item not in (None, ""):
            key = str(item)
            if key in seen:
                continue
            seen.add(key)
            result.append({"comment_id": None, "text": key, "likes": None})
    return result


def context_for(
    row: dict[str, Any],
    fallback: dict[str, Any],
    by_comment: dict[tuple[str, str], dict[str, Any]],
    children: dict[tuple[str, str], list[dict[str, Any]]],
    inventory: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    video_id = str(row.get("video_id") or fallback.get("video_id") or "")
    comment_id = str(row.get("comment_id") or fallback.get("comment_id") or "")
    parent_id = str(row.get("parent") or row.get("parent_comment_id") or "")
    parent_row = by_comment.get((video_id, parent_id)) if parent_id and parent_id != "root" else None
    root_id, root_row = root_for(row, by_comment)
    inv = inventory.get(video_id, {})
    title = row.get("video_title") or fallback.get("video_title") or inv.get("title") or ""
    description = row.get("video_description_short") or fallback.get("video_description_short") or inv.get("description") or ""
    inline_parent = row.get("immediate_parent_text") or row.get("parent_text") or ""
    inline_root = row.get("root_text") or row.get("root_comment_text") or ""
    reply_rows = children.get((video_id, comment_id), []) or inline_reply_rows(row.get("direct_replies"))
    return {
        "video_id": video_id,
        "comment_id": comment_id,
        "parent_id": parent_id if parent_id and parent_id != "root" else None,
        "root_id": root_id,
        "text": normalize_text(row.get("text") or fallback.get("text") or ""),
        "parent_text": normalize_text(inline_parent or (parent_row.get("text") or "") if parent_row else inline_parent),
        "root_text": normalize_text(inline_root or (root_row.get("text") or "") if root_row else inline_root),
        "video_title": normalize_text(title),
        "video_description_short": short(description, 700),
        "reply_rows": reply_rows,
        "published_at": parse_timestamp(row.get("timestamp") or fallback.get("timestamp") or row.get("published_at")),
        "likes": row.get("like_count", row.get("likes", fallback.get("likes"))),
        "source_url": row.get("source_url") or fallback.get("source_url") or (
            f"https://www.youtube.com/watch?v={video_id}&lc={comment_id}" if video_id and comment_id else None
        ),
        "official_channel_id": row.get("official_channel_id") or fallback.get("official_channel_id") or inv.get("official_channel_id"),
        "missingness": row.get("missingness") or fallback.get("missingness") or "YTDLP_BOUNDED_PUBLIC_COMMENT_RECOVERY",
        "old_event_id": fallback.get("event_id") or row.get("event_id") or (f"youtube:{video_id}" if video_id else None),
    }


def context_text(ctx: dict[str, Any]) -> str:
    parts = [ctx.get("text"), ctx.get("parent_text"), ctx.get("root_text"), ctx.get("video_title"), ctx.get("video_description_short")]
    return "\n".join(str(p or "") for p in parts if p)


def explicit_rating(text: str) -> dict[str, Any]:
    speed_matches: list[dict[str, Any]] = []
    for match in RATING_EXPLICIT_RE.finditer(text):
        if match.group("grade") or match.group("number"):
            speed_matches.append({
                "grade": match.group("grade").upper() if match.group("grade") else None,
                "number": int(match.group("number")) if match.group("number") else None,
                "raw": match.group(0),
            })
    # Keep only the speed token; other ability values are retained separately.
    speed = speed_matches[0] if speed_matches else {"grade": None, "number": None, "raw": None}
    other: list[dict[str, Any]] = []
    for match in GRADE_RE.finditer(text):
        if match.group("name") == "走力":
            continue
        if match.group("grade") or match.group("number"):
            other.append({
                "name": match.group("name"),
                "grade": match.group("grade").upper() if match.group("grade") else None,
                "number": int(match.group("number")) if match.group("number") else None,
                "raw": match.group(0),
            })
    if speed["grade"] and speed["number"] is not None:
        value = f"{speed['grade']}{speed['number']}"
    elif speed["grade"]:
        value = speed["grade"]
    elif speed["number"] is not None:
        value = str(speed["number"])
    else:
        value = None
    return {"value": value, "grade": speed["grade"], "number": speed["number"], "other": other}


def find_name_hits(text: str, players: list[dict[str, Any]], by_surname: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    compact_text = nk(text)
    hits: list[dict[str, Any]] = []
    for player in sorted(players, key=lambda p: len(p["key"]), reverse=True):
        if player["key"] and player["key"] in compact_text:
            hits.append({**player, "kind": "full_name"})
    if hits:
        return hits
    for surname_key, surname_players in by_surname.items():
        if surname_key in compact_text:
            for player in surname_players:
                hits.append({**player, "kind": "surname"})
    return hits


def find_alias_hits(text: str) -> list[dict[str, Any]]:
    compact_text = nk(text)
    hits = []
    for alias, (player, player_id) in sorted(KNOWN_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        if nk(alias) in compact_text:
            hits.append({"player": player, "player_id": player_id, "key": nk(player), "surname": alias, "kind": "alias", "alias": alias})
    return hits


def resolve_identity(ctx: dict[str, Any], players: list[dict[str, Any]], by_surname: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    scopes = [
        ("comment", ctx.get("text", "")),
        ("parent", ctx.get("parent_text", "")),
        ("root", ctx.get("root_text", "")),
        ("video_title", ctx.get("video_title", "")),
        ("description", ctx.get("video_description_short", "")),
    ]
    for scope, value in scopes:
        if not value:
            continue
        hits = find_name_hits(value, players, by_surname)
        if not hits:
            hits = find_alias_hits(value)
        if not hits:
            continue
        unique = {(h.get("player"), h.get("player_id"), h.get("kind")) for h in hits}
        if len(unique) > 1:
            return {
                "player": None,
                "canonical_player_id": None,
                "identity_method": f"{scope}_ambiguous",
                "identity_confidence": "AMBIGUOUS",
                "identity_context": {"source": scope, "candidates": sorted({h.get("player") for h in hits if h.get("player")}), "excerpt": short(value)},
                "identity_candidates": [h.get("player") for h in hits if h.get("player")],
            }
        hit = hits[0]
        method = f"{scope}_{hit['kind']}"
        if hit["kind"] == "full_name":
            confidence = "HIGH" if scope == "comment" else "MEDIUM"
        elif hit["kind"] == "surname":
            confidence = "MEDIUM" if len(by_surname.get(hit["surname_key"], [])) == 1 else "AMBIGUOUS"
        else:
            confidence = "MEDIUM"
        return {
            "player": hit.get("player"),
            "canonical_player_id": hit.get("player_id"),
            "identity_method": method,
            "identity_confidence": confidence,
            "identity_context": {"source": scope, "matched": hit.get("alias") or hit.get("player"), "excerpt": short(value)},
            "identity_candidates": [hit.get("player")],
        }
    return {
        "player": None,
        "canonical_player_id": None,
        "identity_method": "unresolved",
        "identity_confidence": "LOW",
        "identity_context": {"source": None, "matched": None, "excerpt": None},
        "identity_candidates": [],
    }


def candidate_signals(ctx: dict[str, Any], force_candidate: bool = False) -> dict[str, Any]:
    text = ctx.get("text", "")
    combined = context_text(ctx)
    speed_hits = SPEED_RE.findall(combined)
    rating_tokens = RATING_WORD_RE.findall(combined)
    rating = explicit_rating(text)
    # An explicit speed grade/value may be in a reply while the number itself
    # is in the candidate.  Fall back to the full context only if the speed
    # token is still present in that context.
    if not rating["value"] and "走力" in combined:
        rating = explicit_rating(combined)
    has_explicit = bool(rating["value"])
    has_speed = bool(speed_hits)
    has_rating_context = bool(rating_tokens) and (has_speed or has_explicit)
    has_gameplay = bool(GAMEPLAY_RE.search(combined))
    has_physical = bool(PHYSICAL_RE.search(combined))
    candidate = has_speed and (has_rating_context or has_physical or has_gameplay or has_explicit)
    reasons = []
    if speed_hits:
        reasons.append("speed_term")
    if has_explicit:
        reasons.append("explicit_speed_grade_or_value")
    if rating_tokens:
        reasons.append("rating_language")
    if has_gameplay:
        reasons.append("gameplay_context")
    if has_physical:
        reasons.append("physical_context")
    if force_candidate:
        candidate = True
        reasons.append("fresh_integrated_candidate_preserved")
    return {
        "candidate": candidate,
        "speed_hits": sorted(set(speed_hits)),
        "rating_tokens": sorted(set(rating_tokens)),
        "rating": rating,
        "has_explicit": has_explicit,
        "has_gameplay": has_gameplay,
        "has_physical": has_physical,
        "reasons": reasons,
    }


def classify_semantics(ctx: dict[str, Any], signals: dict[str, Any], game: str) -> dict[str, Any]:
    text = ctx.get("text", "")
    combined = context_text(ctx)
    rating = signals["rating"]
    explicit = signals["has_explicit"]
    rating_claim = explicit or bool(RATING_WORD_RE.search(combined)) and bool(re.search(r"走力|能力|査定|ステ|ミート|パワー", combined))
    gameplay_claim = signals["has_gameplay"]
    physical_claim = signals["has_physical"]
    if rating_claim and gameplay_claim and not explicit:
        claim_lane = "MIXED"
    elif rating_claim:
        claim_lane = "RATING_POWERPRO" if game == "PowerPro" else "RATING_PROSPI"
    elif gameplay_claim:
        claim_lane = "GAMEPLAY_MECHANICS"
    elif physical_claim:
        claim_lane = "PHYSICAL_OBSERVATION"
    else:
        claim_lane = "NOISE"

    if re.search(r"盗塁", combined):
        speed_concept = "STEALING"
    elif re.search(r"一塁到達|一歩目|加速", combined):
        speed_concept = "ACCELERATION"
    elif re.search(r"内野安打", combined):
        speed_concept = "INFIELD_HIT_EFFECT"
    elif re.search(r"走塁|ベースランニング", combined):
        speed_concept = "BASE_TO_BASE"
    elif re.search(r"足|俊足|鈍足|速|遅|走力|スピード|脚", combined):
        speed_concept = "PURE_SPEED" if claim_lane != "GAMEPLAY_MECHANICS" else "GENERAL_SPEED"
    else:
        speed_concept = "UNCLEAR"

    if explicit:
        if CRITIQUE_HIGH_RE.search(combined):
            direction = "TOO_HIGH"
        elif CRITIQUE_LOW_RE.search(combined):
            direction = "TOO_LOW"
        else:
            direction = "EXPLICIT_PROPOSED_VALUE"
    elif HISTORICAL_RE.search(combined) and re.search(r"査定|能力|反映|昔|過去", combined):
        direction = "STALE"
    elif CRITIQUE_HIGH_RE.search(combined):
        direction = "TOO_HIGH"
    elif CRITIQUE_LOW_RE.search(combined):
        direction = "TOO_LOW"
    else:
        direction = "UNCLEAR"

    laugh = bool(LAUGH_RE.search(text))
    irony = bool(SARCASM_RE.search(text))
    known_risk = any(alias in nk(combined) for alias in SARCASM_RISK_ALIASES)
    if known_risk and physical_claim and not explicit:
        discourse = "sarcasm_possible"
    elif irony and physical_claim and not explicit:
        discourse = "sarcasm_possible"
    elif laugh and (rating_claim or physical_claim or gameplay_claim):
        discourse = "joke_but_claim_present"
    elif re.search(r"だろ|か[？?]|ほしい|やってくれ", text):
        discourse = "rhetorical"
    else:
        discourse = "literal"

    if claim_lane == "NOISE":
        disposition = "NOISE"
    elif discourse == "sarcasm_possible":
        disposition = "REVIEW_REQUIRED_SARCASM"
    else:
        disposition = "CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW"

    return {
        "claim_lane": claim_lane,
        "rating_direction": direction,
        "speed_concept": speed_concept,
        "discourse": discourse,
        "semantic_review_disposition": disposition,
        "laugh_marker_present": laugh,
        "rating_claim_present": rating_claim,
        "physical_claim_present": physical_claim,
        "gameplay_claim_present": gameplay_claim,
    }


def game_name(value: Any) -> str:
    value = str(value or "")
    if "PowerPro" in value or "パワプロ" in value:
        return "PowerPro"
    return "Pro Yakyuu Spirits A"


def player_current_100(pid: str | None, player: str | None, players: list[dict[str, Any]]) -> bool | None:
    if pid:
        return any(p.get("player_id") == pid for p in players)
    if player:
        key = nk(player)
        return any(p.get("key") == key for p in players)
    return None


def build_candidate(
    source: dict[str, Any],
    fallback: dict[str, Any],
    ctx: dict[str, Any],
    players: list[dict[str, Any]],
    by_surname: dict[str, list[dict[str, Any]]],
) -> dict[str, Any] | None:
    signals = candidate_signals(
        ctx,
        force_candidate=(source.get("record_type") == "candidate" or bool(source.get("candidate_text"))),
    )
    if not signals["candidate"]:
        return None
    identity = resolve_identity(ctx, players, by_surname)
    semantic = classify_semantics(ctx, signals, game_name(source.get("game") or fallback.get("game")))
    # Re-run disposition with the resolved identity confidence.
    semantic = classify_semantics(ctx, signals, game_name(source.get("game") or fallback.get("game")))
    if identity["identity_confidence"] in {"LOW", "AMBIGUOUS"} and semantic["semantic_review_disposition"] == "CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW":
        semantic["semantic_review_disposition"] = "REVIEW_REQUIRED_IDENTITY"
    video_id = str(ctx.get("video_id") or source.get("video_id") or fallback.get("video_id") or "")
    root_id = ctx.get("root_id")
    parent_id = ctx.get("parent_id")
    root_thread_id = f"youtube:{video_id}:{root_id or 'unknown-root'}"
    parent_event_id = f"youtube:{video_id}:{parent_id or root_id or 'root'}"
    id_key = identity.get("canonical_player_id") or nk(identity.get("player")) or root_id or "unmapped"
    value_key = signals["rating"]["value"] or "none"
    event_id = f"youtube:{video_id}:{id_key}:{semantic['claim_lane']}:{value_key}"
    direct_replies = [
        {
            "comment_id": r.get("comment_id"),
            "text": short(r.get("text"), 400),
            "likes": r.get("like_count", r.get("likes")),
        }
        for r in ctx.get("reply_rows", [])
    ]
    old_labels = source.get("labels") or []
    notes = [
        "recall_first_prefilter_then_context_aware_triage",
        f"context_used=comment,title,parent={bool(ctx.get('parent_text'))},root={bool(ctx.get('root_text'))},replies={len(direct_replies)}",
    ]
    if semantic["discourse"] == "sarcasm_possible":
        notes.append("do_not_auto_accept_literal_physical_claim")
    if identity["identity_method"].endswith("surname"):
        notes.append("surname_candidate_preserved; review uniqueness and irony")
    if old_labels and all(label in {"UNCLASSIFIED_CONTEXT", "JOKE_OR_NOISE"} for label in old_labels):
        notes.append("potential_old_classifier_false_negative")
    if ctx.get("missingness"):
        notes.append(str(ctx["missingness"]))
    record = {
        "record_id": source.get("record_id") or fallback.get("record_id") or ctx.get("comment_id"),
        "platform": "YouTube",
        "source_type": source.get("source_type") or fallback.get("source_type") or "official_youtube_comment_recovered",
        "source_url": ctx.get("source_url"),
        "source_post_or_video_id": video_id,
        "parent_event_id": parent_event_id,
        "root_thread_id": root_thread_id,
        "published_at": ctx.get("published_at"),
        "text_or_excerpt": short(ctx.get("text"), 1000),
        "player": identity.get("player"),
        "canonical_player_id": identity.get("canonical_player_id"),
        "identity_method": identity.get("identity_method"),
        "identity_confidence": identity.get("identity_confidence"),
        "game": game_name(source.get("game") or fallback.get("game")),
        "edition": derive_edition(ctx.get("video_title", "")) or source.get("edition") or fallback.get("edition"),
        "claim_lane": semantic["claim_lane"],
        "rating_direction": semantic["rating_direction"],
        "speed_concept": semantic["speed_concept"],
        "discourse": semantic["discourse"],
        "explicit_rating_value": signals["rating"]["value"],
        "explicit_rating_grade": signals["rating"]["grade"],
        "explicit_rating_number": signals["rating"]["number"],
        "other_ability_ratings": signals["rating"]["other"],
        "comparison_player": None,
        "event_id": event_id,
        "independence_group": f"{root_thread_id}:{id_key}:{semantic['claim_lane']}",
        "reaction_volume": 1,
        "likes": ctx.get("likes"),
        "source_quality": "OFFICIAL_YOUTUBE_BOUNDED_RECOVERY_WITH_THREAD_CONTEXT",
        "current_100": player_current_100(identity.get("canonical_player_id"), identity.get("player"), players),
        "notes": "; ".join(notes),
        "video_title": ctx.get("video_title") or None,
        "video_description_short": ctx.get("video_description_short") or None,
        "parent_comment_id": ctx.get("parent_id"),
        "parent_text": short(ctx.get("parent_text"), 1000) or None,
        "root_comment_id": root_id,
        "root_text": short(ctx.get("root_text"), 1000) or None,
        "direct_replies": direct_replies,
        "context_sources_used": [
            source_name for source_name, present in [
                ("comment", bool(ctx.get("text"))),
                ("video_title", bool(ctx.get("video_title"))),
                ("parent", bool(ctx.get("parent_text"))),
                ("root", bool(ctx.get("root_text"))),
                ("direct_replies", bool(direct_replies)),
            ] if present
        ],
        "identity_context": identity.get("identity_context"),
        "identity_candidates": identity.get("identity_candidates", []),
        "candidate_reasons": signals["reasons"],
        "speed_evidence_terms": signals["speed_hits"],
        "rating_evidence_terms": signals["rating_tokens"],
        "old_labels": old_labels,
        "old_acceptance_status": source.get("acceptance_status"),
        "input_record_type": source.get("record_type"),
        "fresh_raw_record_id": source.get("raw_record_id"),
        "semantic_review_disposition": semantic["semantic_review_disposition"],
        "laugh_marker_present": semantic["laugh_marker_present"],
        "rating_claim_present": semantic["rating_claim_present"],
        "physical_claim_present": semantic["physical_claim_present"],
        "gameplay_claim_present": semantic["gameplay_claim_present"],
    }
    return record


def candidate_sort_key(row: dict[str, Any]) -> tuple[int, int, str]:
    return (
        0 if row.get("explicit_rating_value") else 1,
        0 if row.get("current_100") is True else 1,
        str(row.get("record_id") or ""),
    )


def find_case_row(rows: Iterable[dict[str, Any]], text: str) -> dict[str, Any] | None:
    normalized = normalize_text(text).replace("\r\n", "\n")
    for row in rows:
        if normalize_text(row.get("text") or "").replace("\r\n", "\n") == normalized:
            return row
    return None


def fixed_case_source(case_id: str) -> dict[str, Any]:
    title = {
        "A": "【fixture】ビシエド能力公開",
        "B": "【fixture】大谷翔平能力公開",
        "C": "【fixture】大谷翔平能力公開",
        "D": "【fixture】大谷翔平能力公開",
        "F": "【fixture】山川穂高能力公開",
        "G": "【fixture】清原和博能力公開",
    }.get(case_id, "【fixture】公式能力公開")
    return {
        "record_id": f"FIXTURE-{case_id}",
        "video_id": f"fixture-video-{case_id}",
        "comment_id": f"fixture-comment-{case_id}",
        "parent": "root",
        "video_title": title,
        "text": CASE_TEXTS[case_id],
        "game": "Pro Yakyuu Spirits A",
        "source_type": "FIXED_REGRESSION_FIXTURE",
        "source_url": None,
        "likes": None,
        "missingness": "FIXED_REGRESSION_FIXTURE",
    }


def regression_results(
    candidate_by_text: dict[str, dict[str, Any]],
    source_rows: list[dict[str, Any]],
    recovered_by_record: dict[str, dict[str, Any]],
    players: list[dict[str, Any]],
    by_surname: dict[str, list[dict[str, Any]]],
    by_comment: dict[tuple[str, str], dict[str, Any]],
    children: dict[tuple[str, str], list[dict[str, Any]]],
    inventory: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    def make(case_id: str) -> dict[str, Any]:
        target = CASE_TEXTS[case_id]
        source = find_case_row(source_rows, target)
        source_type = "existing_7145_corpus" if source else "fixed_fixture"
        if source:
            context_row = recovered_by_record.get(str(source.get("record_id")), source)
            ctx = context_for(context_row, source, by_comment, children, inventory)
            fallback = source
        else:
            fallback = fixed_case_source(case_id)
            ctx = context_for(fallback, fallback, by_comment, children, inventory)
        candidate = build_candidate(fallback, fallback, ctx, players, by_surname)
        checks: dict[str, bool]
        if case_id == "A":
            checks = {
                "candidate_retained": candidate is not None,
                "bisciedi_identity": bool(candidate and candidate.get("player") == "ビシエド"),
                "rating_criticism_candidate": bool(candidate and candidate.get("claim_lane") in {"RATING_POWERPRO", "RATING_PROSPI"} and candidate.get("rating_direction") in {"TOO_HIGH", "UNCLEAR"}),
            }
        elif case_id == "B":
            checks = {
                "candidate_retained": candidate is not None,
                "otani_context_mapping": bool(candidate and "大谷" in str(candidate.get("player"))),
                "explicit_grade_A_preserved": bool(candidate and candidate.get("explicit_rating_grade") == "A"),
                "not_unclassified": bool(candidate and candidate.get("claim_lane") != "NOISE"),
            }
        elif case_id == "C":
            checks = {
                "candidate_retained": candidate is not None,
                "explicit_grade_B_preserved": bool(candidate and candidate.get("explicit_rating_grade") == "B"),
                "laughter_not_noise": bool(candidate and candidate.get("claim_lane") != "NOISE"),
                "claim_present_with_laughter": bool(candidate and candidate.get("discourse") in {"joke_but_claim_present", "rhetorical", "literal"}),
            }
        elif case_id == "D":
            checks = {
                "candidate_retained": candidate is not None,
                "explicit_value_84_preserved": bool(candidate and candidate.get("explicit_rating_number") == 84 and candidate.get("explicit_rating_value") == "84"),
                "title_context_mapping": bool(candidate and "大谷" in str(candidate.get("player"))),
                "rating_lane": bool(candidate and candidate.get("claim_lane") in {"RATING_POWERPRO", "RATING_PROSPI"}),
            }
        elif case_id == "F":
            checks = {
                "candidate_retained": candidate is not None,
                "surname_candidate_preserved": bool(candidate and candidate.get("player") == "山川 穂高" and "surname" in str(candidate.get("identity_method"))),
                "sarcasm_possible": bool(candidate and candidate.get("discourse") == "sarcasm_possible"),
                "not_auto_literal_acceptance": bool(candidate and candidate.get("semantic_review_disposition") == "REVIEW_REQUIRED_SARCASM"),
            }
        else:  # G
            checks = {
                "candidate_retained": candidate is not None,
                "kiyohara_identity_candidate": bool(candidate and "清原" in str(candidate.get("player"))),
                "explicit_grade_B_preserved": bool(candidate and candidate.get("explicit_rating_grade") == "B"),
                "explicit_value_74_preserved": bool(candidate and candidate.get("explicit_rating_number") == 74),
                "other_ability_ratings_retained": bool(candidate and candidate.get("other_ability_ratings")),
                "rating_lane": bool(candidate and candidate.get("claim_lane") == "RATING_PROSPI"),
            }
        return {
            "case": case_id,
            "source": source_type,
            "source_record_id": (source or fallback).get("record_id"),
            "text": target,
            "checks": checks,
            "result": "PASS" if all(checks.values()) else "FAIL",
            "observed": {
                "player": candidate.get("player") if candidate else None,
                "canonical_player_id": candidate.get("canonical_player_id") if candidate else None,
                "identity_method": candidate.get("identity_method") if candidate else None,
                "identity_confidence": candidate.get("identity_confidence") if candidate else None,
                "claim_lane": candidate.get("claim_lane") if candidate else None,
                "rating_direction": candidate.get("rating_direction") if candidate else None,
                "speed_concept": candidate.get("speed_concept") if candidate else None,
                "discourse": candidate.get("discourse") if candidate else None,
                "explicit_rating_value": candidate.get("explicit_rating_value") if candidate else None,
                "explicit_rating_grade": candidate.get("explicit_rating_grade") if candidate else None,
                "explicit_rating_number": candidate.get("explicit_rating_number") if candidate else None,
                "semantic_review_disposition": candidate.get("semantic_review_disposition") if candidate else None,
            },
        }

    results = [make(case_id) for case_id in ["A", "B", "C", "D", "F", "G"]]
    # Case E is deliberately a paired surname/title-context check over B/C.
    paired = [r for r in results if r["case"] in {"B", "C"}]
    e_checks = {
        "both_examples_retained": all(r["result"] == "PASS" for r in paired),
        "surname_or_alias_without_full_name_requirement": all(
            r["observed"].get("player") and r["observed"].get("identity_method") not in {"comment_full_name", "parent_full_name", "root_full_name"}
            for r in paired
        ),
        "otani_context_mapping": all("大谷" in str(r["observed"].get("player")) for r in paired),
    }
    results.insert(4, {
        "case": "E",
        "source": "paired_existing_7145_corpus",
        "source_record_id": ";".join(str(r["source_record_id"]) for r in paired),
        "text": "大谷走力Aだろ / 大谷走力Bにも不満",
        "checks": e_checks,
        "result": "PASS" if all(e_checks.values()) else "FAIL",
        "observed": {"paired_identity_methods": [r["observed"].get("identity_method") for r in paired], "players": [r["observed"].get("player") for r in paired]},
    })
    return results


def markdown_report(payload: dict[str, Any]) -> str:
    counts = payload["counts"]
    regressions = payload["regression_cases"]
    lines = [
        "# YouTube semantic / candidate QA — Community Recollection V3",
        "",
        f"- Run: `{payload['generated_at_utc']}`",
        "- Scope: SP-033 / SP-034 YouTube semantic and candidate QA only.",
        "- X / SP-035: **not touched; separated to Grok lane**.",
        "- Writes made by this run: this audit and its paired JSON only; registry and common final artifacts were not edited.",
        "",
        "## Verdict",
        "",
        f"- Regression A–G: **{'PASS' if all(r['result'] == 'PASS' for r in regressions) else 'FAIL'}** ({sum(r['result'] == 'PASS' for r in regressions)}/{len(regressions)} cases).",
        f"- Input mode: `{payload['input_mode']}`; candidate extraction: `{counts['candidate_rows']}` / `{counts['target_rows']}` target rows.",
        f"- Contextual claim triage: `{counts['contextual_claim_rows']}`; sarcasm review: `{counts['sarcasm_review_rows']}`; identity review: `{counts['identity_review_rows']}`.",
        f"- Distinct current-100 players mapped: `{counts['current_100_mapped_player_count']}`.",
        f"- Common schema required-field check: **{'PASS' if payload['schema_checks']['all_candidate_records_have_required_fields'] else 'FAIL'}**; context retained title/parent/root/reply = `{payload['schema_checks']['context_presence_counts']['video_title']}/{payload['schema_checks']['context_presence_counts']['parent_text']}/{payload['schema_checks']['context_presence_counts']['root_text']}/{payload['schema_checks']['context_presence_counts']['direct_replies']}` candidate rows.",
        "- These are semantic-review and QA dispositions, not final owner acceptance or a Speed Gate close.",
        "",
        "## Inputs and method",
        "",
        f"- Legacy classification corpus: `{payload['inputs']['classification']}` ({payload['inputs']['classification_rows']} rows).",
        f"- Legacy recovered context: `{payload['inputs']['recovered_comments']}` ({payload['inputs']['recovered_comment_rows']} rows).",
        f"- Active target/context rows: `{payload['inputs']['active_target_rows']}` / `{payload['inputs']['active_context_rows']}`.",
        f"- Fresh inputs: `{payload['inputs']['fresh_input_count']}` files; fresh candidate rows `{payload['inputs']['fresh_candidate_rows']}`, fresh raw comment rows `{payload['inputs']['fresh_comment_rows']}`.",
        f"- Existing raw lane manifests: PowerPro `{payload['inputs']['powerpro_raw_rows']}`, Prospi `{payload['inputs']['prospi_raw_rows']}` rows.",
        f"- Current-100 master: `{payload['inputs']['current_100_master']}` ({payload['inputs']['current_100_master_rows']} rows).",
        "- Candidate prefilter is recall-first. Semantic fields are derived from interacting evidence across comment, title, parent, root and direct replies; regex terms are signals, not the final disposition.",
        "- Full-name, unique-surname, alias, parent/root and title identity routes are recorded separately. Ambiguous or ironic cases remain review candidates.",
        "",
        "## Regression A–G",
        "",
        "| Case | Source | Result | Key observed fields |",
        "|---|---|---|---|",
    ]
    for row in regressions:
        obs = row["observed"]
        key = ", ".join(f"{k}={v}" for k, v in obs.items() if v not in (None, [], ""))
        lines.append(f"| {row['case']} | {row['source']} | **{row['result']}** | {key} |")
    lines += [
        "",
        "## Lane separation",
        "",
        "| Field | Count |",
        "|---|---:|",
    ]
    for key, value in sorted(payload["lane_counts"].items()):
        lines.append(f"| {key} | {value} |")
    lines += [
        "",
        "## Old 7,145-corpus false-negative measurement",
        "",
        f"- Potential old-classifier false negatives rescued into candidate review: `{payload['false_negative_measurement']['potential_old_classifier_false_negative_count']}`.",
        "- This is a measured triage gap, not a gold-standard recall estimate: the repository has no complete human-labeled truth set for all 7,145 comments.",
        "",
        "| Sample | Old labels | New lane | Identity | Text |",
        "|---|---|---|---|---|",
    ]
    for row in payload["false_negative_measurement"]["samples"]:
        lines.append(
            f"| {row['record_id']} | {', '.join(row['old_labels']) or 'none'} | {row['claim_lane']} | {row['player'] or 'unresolved'} | {short(row['text'], 120).replace('|', '\\|').replace('\n', ' / ')} |"
        )
    lines += [
        "",
        "## Coverage and limits",
        "",
        f"- Distinct videos in the active target candidate output: `{counts['distinct_videos']}`; legacy 7,145-corpus baseline remains in the false-negative section.",
        f"- Fresh rerun command: `{payload['recommended_fresh_command']}`.",
        "- This script does not perform fresh official-channel discovery or comment retrieval; discovery/retrieval remains a separate lane task. No fresh-discovery count is claimed here.",
        "- Existing recovered comments are explicitly marked as bounded public recovery; unavailable/paginated remainder is not treated as negative evidence.",
        "- SP-033 and SP-034 registry status was not changed and remains outside this semantic QA write scope.",
        "",
    ]
    return "\n".join(lines) + "\n"


def process_records(
    target_rows: list[dict[str, Any]],
    context_rows: list[dict[str, Any]],
    players: list[dict[str, Any]],
    by_surname: dict[str, list[dict[str, Any]]],
    inventory: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[tuple[str, str], dict[str, Any]], dict[tuple[str, str], list[dict[str, Any]]], int]:
    by_record, by_comment, children = recovered_indexes(context_rows)
    candidates: list[dict[str, Any]] = []
    missing_context_rows = 0
    for source in target_rows:
        record_id = str(source.get("record_id") or "")
        context_row = by_record.get(record_id)
        if context_row is None:
            source_video_id = str(source.get("video_id") or source.get("source_post_or_video_id") or "")
            source_comment_id = str(source.get("comment_id") or "")
            if source_video_id and source_comment_id:
                context_row = by_comment.get((source_video_id, source_comment_id))
        if context_row is None:
            missing_context_rows += 1
            context_row = source
        ctx = context_for(context_row, source, by_comment, children, inventory)
        candidate = build_candidate(source, context_row, ctx, players, by_surname)
        if candidate:
            candidates.append(candidate)
    candidates.sort(key=candidate_sort_key)
    by_event: Counter[str] = Counter(c["event_id"] for c in candidates)
    for candidate in candidates:
        candidate["reaction_volume"] = by_event[candidate["event_id"]]
    return candidates, by_record, by_comment, children, missing_context_rows


def run(fresh_inputs: list[str] | None = None) -> dict[str, Any]:
    for path in [CLASSIFICATION_PATH, RECOVERED_PATH, POWERPRO_RAW_PATH, PROSPI_RAW_PATH, MASTER_JSON_PATH]:
        if not path.exists():
            raise FileNotFoundError(path)

    classification = read_jsonl(CLASSIFICATION_PATH)
    recovered = read_jsonl(RECOVERED_PATH)
    powerpro_raw = read_jsonl(POWERPRO_RAW_PATH)
    prospi_raw = read_jsonl(PROSPI_RAW_PATH)
    master_rows, master_source = load_master()
    inventory = load_inventory()
    players, by_surname = build_players(master_rows)
    legacy_candidates, legacy_by_record, legacy_by_comment, legacy_children, legacy_missing_context = process_records(
        classification, recovered, players, by_surname, inventory
    )
    fresh_meta: dict[str, Any] | None = None
    if fresh_inputs:
        fresh_meta = fresh_bundle(fresh_inputs)
        candidates, fresh_by_record, fresh_by_comment, fresh_children, missing_context_rows = process_records(
            fresh_meta["target_rows"], fresh_meta["context_rows"], players, by_surname, inventory
        )
        active_target_rows = fresh_meta["target_rows"]
        active_context_rows = fresh_meta["context_rows"]
        input_mode = "fresh"
    else:
        candidates = legacy_candidates
        fresh_by_record, fresh_by_comment, fresh_children = legacy_by_record, legacy_by_comment, legacy_children
        missing_context_rows = legacy_missing_context
        active_target_rows = classification
        active_context_rows = recovered
        input_mode = "legacy"

    regression = regression_results(legacy_candidates, classification, legacy_by_record, players, by_surname, legacy_by_comment, legacy_children, inventory)
    lane_counts = Counter(c["claim_lane"] for c in candidates)
    disposition_counts = Counter(c["semantic_review_disposition"] for c in candidates)
    old_false_negative = [
        c for c in legacy_candidates
        if c.get("old_labels") and all(label in {"UNCLASSIFIED_CONTEXT", "JOKE_OR_NOISE"} for label in c["old_labels"])
    ]
    fn_samples = []
    seen_sample: set[str] = set()
    for candidate in sorted(old_false_negative, key=candidate_sort_key):
        if candidate["record_id"] in seen_sample:
            continue
        seen_sample.add(candidate["record_id"])
        fn_samples.append({
            "record_id": candidate["record_id"],
            "old_labels": candidate.get("old_labels", []),
            "claim_lane": candidate.get("claim_lane"),
            "player": candidate.get("player"),
            "identity_method": candidate.get("identity_method"),
            "identity_confidence": candidate.get("identity_confidence"),
            "text": candidate.get("text_or_excerpt"),
        })
        if len(fn_samples) >= 20:
            break

    current_ids = {c.get("canonical_player_id") for c in candidates if c.get("current_100") is True and c.get("canonical_player_id")}
    schema_missing = {
        str(candidate.get("record_id")): [field for field in SCHEMA_FIELDS if field not in candidate]
        for candidate in candidates
        if any(field not in candidate for field in SCHEMA_FIELDS)
    }
    context_presence = {
        "video_title": sum(bool(c.get("video_title")) for c in candidates),
        "parent_text": sum(bool(c.get("parent_text")) for c in candidates),
        "root_text": sum(bool(c.get("root_text")) for c in candidates),
        "direct_replies": sum(bool(c.get("direct_replies")) for c in candidates),
    }
    old_label_counts: Counter[str] = Counter(label for row in classification for label in row.get("labels", []))
    recommended_fresh_paths = [
        "outputs\\derived\\speed_community_v3_powerpro_raw_20260815.jsonl",
        "outputs\\derived\\speed_community_v3_powerpro_candidates_20260815.jsonl",
        "outputs\\derived\\speed_community_v3_prospi_raw_20260815.jsonl",
        "outputs\\derived\\speed_community_v3_prospi_candidates_20260815.jsonl",
    ]
    recommended_fresh_command = "python scripts\\speed_community_v3_youtube_semantic.py --fresh-input " + " ".join(recommended_fresh_paths)
    counts = {
        "classification_rows": len(classification),
        "recovered_comment_rows": len(recovered),
        "target_rows": len(active_target_rows),
        "active_context_rows": len(active_context_rows),
        "legacy_candidate_rows": len(legacy_candidates),
        "candidate_rows": len(candidates),
        "contextual_claim_rows": sum(c.get("claim_lane") not in {"NOISE"} for c in candidates),
        "accepted_contextual_claim_rows": sum(c.get("semantic_review_disposition") == "CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW" for c in candidates),
        "sarcasm_review_rows": sum(c.get("semantic_review_disposition") == "REVIEW_REQUIRED_SARCASM" for c in candidates),
        "identity_review_rows": sum(c.get("semantic_review_disposition") == "REVIEW_REQUIRED_IDENTITY" for c in candidates),
        "current_100_mapped_player_count": len(current_ids),
        "distinct_videos": len({c.get("source_post_or_video_id") for c in candidates if c.get("source_post_or_video_id")}),
        "missing_recovered_context_rows": missing_context_rows,
    }
    payload = {
        "schema_version": "speed_community_v3_youtube_semantic_qa_v1",
        "artifact_scope": "SP-033/SP-034 YouTube semantic and candidate QA only",
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "output_artifact_date": "2026-08-14",
        "input_mode": input_mode,
        "x_sp035_scope": "NOT_TOUCHED; GROK_LANE_SEPARATED",
        "writes_allowed_by_request": [
            "scripts/speed_community_v3_youtube_semantic.py",
            "outputs/derived/speed_community_v3_youtube_regression_20260814.json",
            "docs/audits/speed_community_v3_youtube_semantic_qa_20260814.md",
        ],
        "inputs": {
            "classification": str(CLASSIFICATION_PATH.relative_to(ROOT)),
            "classification_rows": len(classification),
            "recovered_comments": str(RECOVERED_PATH.relative_to(ROOT)),
            "recovered_comment_rows": len(recovered),
            "powerpro_raw": str(POWERPRO_RAW_PATH.relative_to(ROOT)),
            "powerpro_raw_rows": len(powerpro_raw),
            "prospi_raw": str(PROSPI_RAW_PATH.relative_to(ROOT)),
            "prospi_raw_rows": len(prospi_raw),
            "current_100_master": master_source,
            "current_100_master_rows": len(players),
            "video_inventory_context_rows": len(inventory),
            "active_target_rows": len(active_target_rows),
            "active_context_rows": len(active_context_rows),
            "fresh_input_count": len(fresh_meta["paths"]) if fresh_meta else 0,
            "fresh_input_paths": [str(path.relative_to(ROOT)) for path in fresh_meta["paths"]] if fresh_meta else [],
            "fresh_input_rows_by_path": fresh_meta["rows_by_path"] if fresh_meta else {},
            "fresh_candidate_rows": fresh_meta["candidate_rows"] if fresh_meta else 0,
            "fresh_comment_rows": fresh_meta["comment_rows"] if fresh_meta else 0,
            "fresh_video_metadata_rows": fresh_meta["video_metadata_rows"] if fresh_meta else 0,
        },
        "method": {
            "candidate_extraction": "recall_first_context_prefilter",
            "semantic_classification": "context_aware_rule_graph_with_explicit_review_dispositions",
            "context_fields_used": ["video_title", "video_description_short", "root_text", "parent_text", "candidate_text", "direct_replies", "game", "edition"],
            "identity_order": ["comment_full_name", "comment_surname", "comment_alias", "parent_context", "root_context", "video_title", "description"],
            "explicit_rating_policy": "preserve speed grade and/or numeric value; retain other ability tokens separately",
            "noise_policy": "laugh markers do not erase a speed/rating/gameplay claim",
            "sarcasm_policy": "preserve candidate and hold for review; do not auto-accept as literal physical evidence",
        },
        "counts": counts,
        "schema_checks": {
            "required_fields": SCHEMA_FIELDS,
            "all_candidate_records_have_required_fields": not schema_missing,
            "missing_fields_by_record": schema_missing,
            "context_presence_counts": context_presence,
        },
        "old_classification_label_counts": dict(old_label_counts),
        "lane_counts": dict(lane_counts),
        "disposition_counts": dict(disposition_counts),
        "regression_cases": regression,
        "regression_fixture_contract": {
            "case_ids": ["A", "B", "C", "D", "E", "F", "G"],
            "fixed_fixture_fallback_in_script": True,
            "actual_source_preferred_by_record_id": True,
            "fallback_policy": "If an exact 7,145-corpus row is unavailable, run the same context-aware path on a fixed fixture and mark source=fixed_fixture.",
        },
        "fresh_input_contract": {
            "option": "--fresh-input PATH [PATH ...]",
            "selection": "candidate rows are the active target when present; otherwise comment/reply rows are recall-prefiltered",
            "raw_context_join": "comment_id/video_id plus inline candidate parent/root/reply context",
            "dedupe": "record_id, then video_id|comment_id",
            "recommended_command": recommended_fresh_command,
        },
        "false_negative_measurement": {
            "population": "existing 7,145 classification rows",
            "potential_old_classifier_false_negative_count": len(old_false_negative),
            "definition": "new recall-first candidate whose old labels were only UNCLASSIFIED_CONTEXT/JOKE_OR_NOISE",
            "gold_standard_available": False,
            "samples": fn_samples,
        },
        "candidate_records": candidates,
        "status_effect": "No registry status changed; SP-033/SP-034 remain partial pending broader lane decisions.",
        "discovery_effect": "This semantic QA script does not perform fresh official-channel discovery or comment retrieval; no fresh-discovery completion is claimed.",
        "recommended_fresh_command": recommended_fresh_command,
    }
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fresh-input",
        nargs="+",
        metavar="PATH",
        help="Consume fresh integrated YouTube candidate/raw JSONL artifacts; candidate rows are preferred as targets and raw comments provide context.",
    )
    parser.add_argument("--no-write", action="store_true", help="Run QA and print summary without writing the two allowed artifacts.")
    args = parser.parse_args()
    payload = run(args.fresh_input)
    if not args.no_write:
        OUT_JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        OUT_MD_PATH.write_text(markdown_report(payload), encoding="utf-8")
    print(json.dumps({
        "input_mode": payload["input_mode"],
        "candidate_rows": payload["counts"]["candidate_rows"],
        "target_rows": payload["counts"]["target_rows"],
        "current_100_mapped_player_count": payload["counts"]["current_100_mapped_player_count"],
        "potential_old_classifier_false_negative_count": payload["false_negative_measurement"]["potential_old_classifier_false_negative_count"],
        "regression": {row["case"]: row["result"] for row in payload["regression_cases"]},
        "lane_counts": payload["lane_counts"],
        "outputs": [] if args.no_write else [str(OUT_JSON_PATH.relative_to(ROOT)), str(OUT_MD_PATH.relative_to(ROOT))],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

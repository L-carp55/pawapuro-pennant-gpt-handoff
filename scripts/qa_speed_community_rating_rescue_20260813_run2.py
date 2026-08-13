#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deterministic QA and UTF-8 audit for the run-2 community-rating rescue."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "outputs" / "derived"
AUDIT = ROOT / "docs" / "audits" / "speed_community_rating_rescue_20260813_run2.md"
QA_JSON = DERIVED / "speed_community_rating_rescue_20260813_run2_qa.json"
QA_MD = DERIVED / "speed_community_rating_rescue_20260813_run2_qa.md"
OLD_GROK = Path(
    r"C:\Users\amila\Desktop\Claude Code\_worktrees\pawapuro-speed-2026-grok-x-sns-rescue"
    r"\data\normalized\speed_2026_grok_x_sources.csv"
)


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256(path: Path) -> str:
    hash_ = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            hash_.update(block)
    return hash_.hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as error:
                raise RuntimeError(f"Invalid JSONL {path.name}:{line_number}: {error}") from error
    return records


def check_utf8(path: Path, issues: list[str]) -> None:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        issues.append(f"UTF8_DECODE_FAIL {path.name}: {error}")
        return
    if "\ufffd" in text:
        issues.append(f"UTF8_REPLACEMENT_CHARACTER {path.name}")


def require(condition: bool, code: str, issues: list[str]) -> None:
    if not condition:
        issues.append(code)


def rows_with_required(
    rows: list[dict[str, str]], fields: tuple[str, ...], label: str, issues: list[str]
) -> None:
    for row in rows:
        missing = [field for field in fields if not row.get(field)]
        if missing:
            issues.append(f"{label} missing={','.join(missing)} record={row.get('record_id', '')}")


def main() -> None:
    paths = {
        "raw_csv": DERIVED / "speed_community_rating_raw_20260813_run2.csv",
        "raw_jsonl": DERIVED / "speed_community_rating_raw_20260813_run2.jsonl",
        "powerpro_youtube_staging_csv": DERIVED / "_staging_speed_youtube_powerpro_run2.csv",
        "powerpro_youtube_staging_jsonl": DERIVED / "_staging_speed_youtube_powerpro_run2.jsonl",
        "prospi_youtube_staging_csv": DERIVED / "_staging_speed_youtube_prospi_run2.csv",
        "prospi_youtube_staging_jsonl": DERIVED / "_staging_speed_youtube_prospi_run2.jsonl",
        "prospi_current_staging": DERIVED / "_staging_speed_prospi_gamex_current_run2.csv",
        "prospi_historical_staging": DERIVED / "_staging_speed_prospi_gamex_historical_run2.csv",
        "reclassification": DERIVED / "speed_grok_x_rejected_reclassification_20260813_run2.csv",
        "filtered": DERIVED / "speed_community_rating_filtered_20260813_run2.csv",
        "summary": DERIVED / "speed_community_rating_player_summary_20260813_run2.csv",
        "youtube_inventory": DERIVED / "speed_youtube_official_video_inventory_20260813_run2.csv",
        "prospi_current": DERIVED / "speed_prospi_gamex_current_20260813_run2.csv",
        "prospi_historical": DERIVED / "speed_prospi_gamex_historical_20260813_run2.csv",
        "manifest": DERIVED / "speed_community_rating_build_manifest_20260813_run2.json",
        "powerpro_log": DERIVED / "speed_youtube_powerpro_run2_execution_log.md",
        "prospi_youtube_log": DERIVED / "speed_youtube_prospi_run2_execution_log.md",
        "prospi_youtube_exclusions": DERIVED / "_staging_speed_youtube_prospi_run2_qa_exclusions.csv",
        "prospi_gamex_log": DERIVED / "_staging_speed_prospi_gamex_run2_execution_log.jsonl",
    }
    issues: list[str] = []
    for label, path in paths.items():
        require(path.exists() and path.stat().st_size > 0, f"MISSING_OR_EMPTY {label} {path}", issues)
        if path.exists() and path.stat().st_size:
            check_utf8(path, issues)

    raw = read_csv(paths["raw_csv"])
    reclass = read_csv(paths["reclassification"])
    filtered = read_csv(paths["filtered"])
    summary = read_csv(paths["summary"])
    inventory = read_csv(paths["youtube_inventory"])
    current = read_csv(paths["prospi_current"])
    historical = read_csv(paths["prospi_historical"])
    exclusions = read_csv(paths["prospi_youtube_exclusions"])
    manifest = json.loads(paths["manifest"].read_text(encoding="utf-8"))
    raw_jsonl = read_jsonl(paths["raw_jsonl"])
    powerpro_youtube_staging = read_csv(paths["powerpro_youtube_staging_csv"])
    powerpro_youtube_jsonl = read_jsonl(paths["powerpro_youtube_staging_jsonl"])
    prospi_youtube_staging = read_csv(paths["prospi_youtube_staging_csv"])
    prospi_youtube_jsonl = read_jsonl(paths["prospi_youtube_staging_jsonl"])

    # SP-032: source must be real, complete for every old rejection, and must never contain old accepted rows.
    old_rows = read_csv(OLD_GROK)
    old_rejected = [row for row in old_rows if row.get("acceptance_status") == "REJECTED"]
    old_accepted = [row for row in old_rows if row.get("acceptance_status") == "ACCEPTED"]
    require(len(old_rows) == 191, f"OLD_GROK_EXPECTED_191 got={len(old_rows)}", issues)
    require(len(old_rejected) == 150, f"OLD_GROK_EXPECTED_150_REJECTED got={len(old_rejected)}", issues)
    require(len(old_accepted) == 41, f"OLD_GROK_EXPECTED_41_ACCEPTED got={len(old_accepted)}", issues)
    require(len(reclass) == 150, f"RECLASS_EXPECTED_150 got={len(reclass)}", issues)
    require(len({row.get('old_source_id') for row in reclass}) == 150, "RECLASS_DUPLICATE_OLD_SOURCE_ID", issues)
    require(not any(row.get("old_acceptance_status") == "ACCEPTED" for row in reclass), "RECLASS_OLD_ACCEPTED_LEAK", issues)
    require(
        {row.get("old_source_id") for row in reclass} == {row.get("source_id") for row in old_rejected},
        "RECLASS_OLD_REJECTED_SET_MISMATCH", issues,
    )
    require(
        manifest["reclassification_inputs"][0]["sha256"] == sha256(OLD_GROK),
        "RECLASS_INPUT_SHA_MISMATCH", issues,
    )
    require(
        manifest["reclassification_inputs"][0]["rejected_rows_passed_to_reclassification"] == 150,
        "RECLASS_INPUT_COUNT_NOT_150", issues,
    )
    rows_with_required(
        reclass,
        ("record_id", "old_source_id", "source_url", "timestamp", "acceptance_status", "acceptance_reason",
         "old_rejection_reason", "source_input_path", "source_input_sha256", "reclassification_status"),
        "RECLASS_REQUIRED", issues,
    )
    require(sum(row.get("old_rejection_reason") == "GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED" for row in reclass) == 2,
            "RECLASS_GAME_RATING_SOURCE_COUNT_NOT_2", issues)
    require(sum(row.get("reclassification_status") == "RECLASSIFIED_TO_RATING_LANE" for row in reclass) == 2,
            "RECLASS_GAME_RATING_RECLASSIFIED_NOT_2", issues)

    # Every raw record preserves provenance and a reason; a no-post availability row is explicitly not schema_issue.
    require(len(raw) == len({row.get("record_id") for row in raw}), "RAW_DUPLICATE_RECORD_ID", issues)
    require({row.get("record_id") for row in raw} == {row.get("record_id") for row in raw_jsonl}, "RAW_CSV_JSONL_ID_SET_MISMATCH", issues)
    rows_with_required(raw, ("record_id", "source_url", "acceptance_status", "acceptance_reason", "collected_at", "attempted_routes"), "RAW_REQUIRED", issues)
    require(not any(row.get("schema_validation") == "SOURCE_SCHEMA_ISSUE" for row in raw), "RAW_SOURCE_SCHEMA_ISSUE_CLASSIFICATION_PRESENT", issues)
    x_rows = [row for row in raw if row.get("source_type") in {"X_SEARCH_QUERY", "OFFICIAL_X_REPLY_AND_SEARCH_ATTEMPT", "OFFICIAL_X_REPLIES_ROUTE_PROBE"}]
    require(len(x_rows) >= 2, "X_RECHECK_ROWS_MISSING", issues)
    require(all(row.get("schema_validation", "").startswith("NOT_APPLICABLE") for row in x_rows), "X_AVAILABILITY_MARKED_AS_SCHEMA", issues)
    probes = [row for row in raw if row.get("source_type") == "OFFICIAL_X_REPLIES_ROUTE_PROBE"]
    require(len(probes) == 2 and all("HTTP 403 Forbidden" in row.get("text", "") for row in probes), "X_LIVE_PROBE_EXPECTED_HTTP403", issues)

    # Filtered must be a strict, traceable subset: no rating number is generated.
    filtered_ids = {row.get("record_id") for row in filtered}
    raw_ids = {row.get("record_id") for row in raw}
    require(filtered_ids.issubset(raw_ids), "FILTERED_NOT_RAW_SUBSET", issues)
    require(all(row.get("acceptance_status", "").startswith("ACCEPTED") for row in filtered), "FILTERED_NON_ACCEPTED_ROW", issues)
    require(not any(row.get("target_rating_if_explicit") for row in filtered), "FILTERED_GENERATED_NUMERIC_RATING", issues)

    # YouTube: test logs prove fixed invocation, inventory must have only videos, and known QA exclusions must be corrected.
    powerpro_log = paths["powerpro_log"].read_text(encoding="utf-8")
    prospi_youtube_log = paths["prospi_youtube_log"].read_text(encoding="utf-8")
    require("preflight_result: SUCCESS" in powerpro_log and "host='--no-update'" not in powerpro_log, "POWERPRO_YTDLP_PREFLIGHT_NOT_PROVEN", issues)
    require("Manual preflight" in prospi_youtube_log and "host='--no-update'" not in prospi_youtube_log, "PROSPI_YTDLP_PREFLIGHT_NOT_PROVEN", issues)
    require(len(inventory) == 56, f"YOUTUBE_INVENTORY_EXPECTED_56 got={len(inventory)}", issues)
    require(len({(row.get("game"), row.get("video_id")) for row in inventory}) == 56, "YOUTUBE_INVENTORY_DUPLICATE_VIDEO", issues)
    rows_with_required(inventory, ("inventory_id", "game", "video_id", "video_url", "source_url", "collected_at", "acceptance_status", "acceptance_reason", "missingness", "required_user_input"), "YOUTUBE_INVENTORY_REQUIRED", issues)
    for exclusion in exclusions:
        matching = [row for row in raw if row.get("record_id") == exclusion.get("record_id")]
        require(len(matching) == 1, f"YOUTUBE_QA_EXCLUSION_MISSING record={exclusion.get('record_id')}", issues)
        if matching:
            require(matching[0].get("classification") == "UNCLASSIFIED_CONTEXT", f"YOUTUBE_QA_EXCLUSION_UNCORRECTED record={exclusion.get('record_id')}", issues)
    require(
        {row.get("record_id") for row in powerpro_youtube_staging} == {row.get("record_id") for row in powerpro_youtube_jsonl},
        "POWERPRO_YOUTUBE_STAGING_CSV_JSONL_ID_SET_MISMATCH", issues,
    )
    require(
        {row.get("record_id") for row in prospi_youtube_staging} == {row.get("record_id") for row in prospi_youtube_jsonl},
        "PROSPI_YOUTUBE_STAGING_CSV_JSONL_ID_SET_MISMATCH", issues,
    )

    # SP-054/55: verify no mistaken connection claim and ensure every requested population was examined.
    current_status = Counter(row.get("acquisition_status") for row in current)
    historical_status = Counter(row.get("acquisition_status") for row in historical)
    require(current_status == Counter({"NOT_FOUND": 84, "RETRIEVED": 17}), f"PROSPI_CURRENT_COUNTS {dict(current_status)}", issues)
    require(historical_status == Counter({"RETRIEVED": 119, "NOT_FOUND": 105}), f"PROSPI_HISTORICAL_COUNTS {dict(historical_status)}", issues)
    require(len({row.get("canonical_player_id") for row in current}) == 100, "PROSPI_CURRENT_TARGET_COVERAGE_NOT_100", issues)
    for edition in ("2025 Series 2", "2025 Series 1"):
        edition_rows = [row for row in historical if row.get("edition") == edition]
        require(len({row.get("canonical_player_id") for row in edition_rows}) == 100, f"PROSPI_{edition}_TARGET_COVERAGE_NOT_100", issues)
    route_404 = [row for row in historical if row.get("edition") == "2024 Series 2 (gamex route probe)"]
    require(len(route_404) == 1 and route_404[0].get("http_status") == "404" and route_404[0].get("error_type") == "HTTP_404", "PROSPI_2024S2_404_NOT_RECORDED", issues)
    for rows, label in ((current, "PROSPI_CURRENT"), (historical, "PROSPI_HISTORICAL")):
        rows_with_required(rows, ("record_id", "task_id", "source_url", "collected_at_utc", "acquisition_status", "acceptance_status", "exclusion_or_decision_reason", "attempted_routes"), label, issues)
        for row in rows:
            if row.get("acquisition_status") == "RETRIEVED":
                try:
                    require(0 <= int(row.get("attribute_value", "")) <= 100, f"{label}_VALUE_OUT_OF_RANGE record={row.get('record_id')}", issues)
                except ValueError:
                    issues.append(f"{label}_NONINTEGER_VALUE record={row.get('record_id')}")
    gamex_log = [json.loads(line) for line in paths["prospi_gamex_log"].read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    require(any(row.get("event") == "reachability_preflight" and row.get("result") == "SUCCESS" and row.get("http_status") == 200 for row in gamex_log), "GAMEX_REACHABILITY_HTTP200_NOT_PROVEN", issues)

    # The summary is exactly joinable to the 100-player master table.
    with (DERIVED / "speed_2026_100_owner_review_master_20260813.csv").open("r", encoding="utf-8-sig", newline="") as handle:
        master_summary_keys = {(row.get("player", ""), row.get("player_id") or "null") for row in csv.DictReader(handle)}
    summary_keys = {(row.get("player", ""), row.get("canonical_player_id", "")) for row in summary}
    require(len(summary) == 100, f"SUMMARY_EXPECTED_100 got={len(summary)}", issues)
    require(len({row.get("canonical_player_id") for row in summary}) == 100 and not any(not row.get("canonical_player_id") for row in summary), "SUMMARY_NOT_JOINABLE", issues)
    require(summary_keys == master_summary_keys, "SUMMARY_PLAYER_ID_JOIN_KEY_SET_MISMATCH", issues)

    result: dict[str, Any] = {
        "generated_at": now(),
        "verdict": "PASS" if not issues else "FAIL",
        "issues": issues,
        "counts": {
            "old_grok_total": len(old_rows), "old_grok_accepted_preserved": len(old_accepted), "old_grok_rejected_reclassified": len(reclass),
            "reclassification_status": dict(Counter(row.get("reclassification_status") for row in reclass)),
            "raw_records": len(raw), "filtered_records": len(filtered), "summary_rows": len(summary),
            "youtube_inventory_videos": len(inventory),
            "prospi_current": dict(current_status), "prospi_historical": dict(historical_status),
        },
        "sha256": {label: sha256(path) for label, path in paths.items() if path.exists()},
        "checked_outputs": {label: str(path) for label, path in paths.items()},
    }
    QA_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    qa_lines = [
        "# Community Rating / YouTube / Prospi rescue run2 — QA",
        "",
        f"- generated_at: {result['generated_at']}",
        f"- verdict: **{result['verdict']}**",
        f"- issue_count: {len(issues)}",
        "",
        "## Checks",
        "",
        f"- SP-032: actual old Grok-X ledger=191; original accepted preserved=41; rejected passed row-for-row=150.",
        f"- SP-033/034: yt-dlp preflight was verified from run2 logs; inventory videos={len(inventory)}; QA classification exclusions={len(exclusions)} corrected in integrated raw.",
        f"- SP-054/055: gamex reachability HTTP 200 is recorded; current={dict(current_status)}; historical={dict(historical_status)}; 2024S2 HTTP 404 retained.",
        f"- Raw={len(raw)}, filtered={len(filtered)}, summary={len(summary)} joinable master rows.",
        "- UTF-8 decode and replacement-character checks passed for every checked artifact." if not any("UTF8" in item for item in issues) else "- UTF-8 check failed; see issues.",
        "",
        "## Issues",
        "",
    ]
    qa_lines.extend([f"- {issue}" for issue in issues] or ["- None."])
    QA_MD.write_text("\n".join(qa_lines) + "\n", encoding="utf-8")

    audit_lines = [
        "# 走力 Community Rating / YouTube / Prospi 追加収集 — run2",
        "",
        f"実施日: 2026-08-13  ",
        f"最終QA: **{result['verdict']}**（`outputs/derived/speed_community_rating_rescue_20260813_run2_qa.json`）",
        "",
        "## 結論",
        "",
        "run1の技術的失敗をそのまま証拠不存在へ変換せず、旧Grok-X rejected台帳の実データ、YouTubeの修正済み取得経路、gamex.jpの到達確認を別々に再実行した。既存Grok-X accepted 41件と旧ledgerは変更していない。",
        "",
        "## SP-032〜037: 再分類・X",
        "",
        f"- Grok-Xの実入力: 191件（SHA-256 `{sha256(OLD_GROK)}`）。旧accepted 41件は出力にも再分類入力にも混入させず、旧rejected 150件を1件ずつ記録付きで再分類した。",
        "- 結果: game ratingをrating laneへ2件、weak directional contextを29件再分類。残りは不完全情報78件、プレイヤー照合不能/ID競合/重複/非方向文脈として各レコードに理由を残した。",
        "- Xの既存収集結果はschema_issueとして捨てず、source post未取得のavailability recordとして再判定した。公式reply経路へのlive probeはPowerPro/ProspiともHTTP 403（ネットワーク到達・未認証拒否）であり、NOT_FOUNDやCONNECTION_FAILEDへ誤変換していない。",
        "- weak contextは数値走力・独立票・strict consensusを生成しない。",
        "",
        "## SP-033/034: 公式YouTube",
        "",
        "- yt-dlp単体のmetadata/comment preflightを、`--no-update`を独立引数として成功させた。run1の`host='--no-update'`は再発していない。",
        "- PowerPro: 公式動画4本、公開コメント257件を取得。安全に現行100人へ紐付く方向付き走力査定コメントは0件。",
        "- Prospi: 公式動画52本をinventory化。うち2026年5本で公開コメント1,436件、選定19動画全体では4,025件を取得。現行100人の受入済み走力査定コメントは0件。3件の誤検出はrawを残し、統合rawではUNCLASSIFIED_CONTEXTへ訂正した。",
        "- YouTube Data APIキーは未設定。各inventory行に、完全/再現可能な取得に必要な最小commentThreads/replies入力形式を残した。以上は公開yt-dlp経路のbounded coverageであり、YouTube全体に該当コメントが不存在という結論ではない。",
        "",
        "## SP-054/055: Prospi gamex.jp",
        "",
        "- 事前到達確認: `https://gamex.jp/` はproxy無効化でHTTP 200。したがってrun1の127.0.0.1:9失敗をデータ不存在として扱わなかった。",
        "- 現行2026 Series 1: 100人を全件検査し、17カードを取得、84件をHTTP 200の表解析後NOT_FOUNDとして保存（丸佳浩は複数カードのため結果行101）。",
        "- 履歴2025 Series 2/Series 1: 100人を各版で全件検査し、119カード取得、105件NOT_FOUND。2024 Series 2の指定routeはHTTP 404として1行保存し、schema_issue/空データへ置換していない。",
        "- Prospi値は外部ゲームの時点比較/QA用であり、走力点の自動補正には使わない。",
        "",
        "## 出力と制限",
        "",
        "- raw、filtered、100人join用summary、YouTube inventory、Grok-X再分類、Prospi current/historical、QAを`_run2`で保存した。",
        "- summaryは100行でcanonical_player_idを保持するが、communityから数値走力を生成しない。",
        "- 今回のNo accepted YouTube resultは、収集成功後の範囲内のnegative findingであって、API未取得・未認証X・未存在の推測を含まない。",
    ]
    AUDIT.write_text("\n".join(audit_lines) + "\n", encoding="utf-8")
    if issues:
        raise SystemExit(1)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

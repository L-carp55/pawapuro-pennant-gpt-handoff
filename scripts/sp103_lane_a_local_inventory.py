#!/usr/bin/env python3
"""SP-103 lane A: repository/database/data-asset inventory.

This lane is intentionally independent of the canonical SP-103 materializer.  It
enumerates tracked files, parses structured assets by content, scans semantic
field names/descriptions, and inspects every SQLite table/view.  The result is
an intermediate artifact consumed later by the parent materializer.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
import subprocess
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "derived" / "sp103_intermediate"
OUT.mkdir(parents=True, exist_ok=True)
GENERATED_AT = "2026-08-23"

TEXT_EXTENSIONS = {
    ".json", ".jsonl", ".csv", ".tsv", ".md", ".mjs", ".js", ".py",
    ".yml", ".yaml", ".txt", ".log", ".sql", ".sh",
}
STRUCTURED_EXTENSIONS = {".json", ".jsonl", ".csv", ".tsv", ".parquet"}
SEMANTIC_TERMS = {
    "speed": r"\bspeed\b|走力|スプリント|スピード",
    "running": r"running|run_speed|top_speed|sprint|走塁|走者|進塁|塁間",
    "acceleration": r"acceleration|accelerat|加速|初速|first.?step|first.?to.?base",
    "h2f_t90": r"hp_to_1b|home.?to.?first|h2f|t90|90.?ft|90feet|一塁到達|一塁到達",
    "short_distance": r"30m|50m|30.?m|50.?m|短距離|光電|電子計測",
    "baserunning": r"baserun|base.?running|advance|stolen|steal|盗塁|代走|UBR|BsR|wSB",
    "outcome_proxy": r"infield.?hit|grounder|ground.?ball|gdp|triple|三塁打|内野安打|併殺|ゴロ",
    "range_defense": r"rngr|range_runs|range|uzr|oaa|outfield.?jump|burst|reaction|route|守備範囲",
    "scouting": r"scout|prospect|run.?grade|スカウト|俊足|鈍足|身体測定",
    "game_appraisal": r"powerpro|pawapuro|the.?show|prospi|プロスピ|パワプロ|ゲーム査定",
    "temporal": r"injur|recovery|birth|age|trajectory|temporal|年齢|怪我|故障|時系列",
    "identity": r"proeye|player.?id|mlbam|crosswalk|identity|選手名|name_norm",
    "community_video": r"youtube|video|comment|community|SNS|grok|x.com|動画|コメント",
    "inference": r"analog|knn|mahal|optimal.?transport|latent|transition|pairwise|consensus|ablation|anchor|imput|common.?support|leakage",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def tracked_files() -> list[Path]:
    proc = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
    )
    return [ROOT / p.decode("utf-8") for p in proc.stdout.split(b"\0") if p]


def read_bytes(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError:
        return b""


def json_shape(value: Any, depth: int = 0) -> dict[str, Any]:
    if isinstance(value, list):
        sample = [json_shape(x, depth + 1) for x in value[:3]]
        return {"kind": "array", "length": len(value), "sample": sample}
    if isinstance(value, dict):
        keys = sorted(str(k) for k in value.keys())
        result: dict[str, Any] = {"kind": "object", "keys": keys[:120]}
        if depth < 2:
            result["children"] = {
                str(k): json_shape(value[k], depth + 1)
                for k in list(value.keys())[:30]
            }
        return result
    return {"kind": type(value).__name__}


def term_matches(text: str) -> tuple[list[str], dict[str, int]]:
    names: list[str] = []
    counts: dict[str, int] = {}
    for name, pattern in SEMANTIC_TERMS.items():
        found = re.findall(pattern, text, flags=re.IGNORECASE)
        if found:
            names.append(name)
            counts[name] = len(found)
    return names, counts


def line_count(data: bytes) -> int:
    return 0 if not data else data.count(b"\n") + (0 if data.endswith(b"\n") else 1)


def structured_info(path: Path, data: bytes) -> dict[str, Any]:
    suffix = path.suffix.lower()
    info: dict[str, Any] = {"format": suffix.lstrip("."), "bytes": len(data)}
    if suffix == ".json":
        try:
            parsed = json.loads(data.decode("utf-8"))
            info["json_shape"] = json_shape(parsed)
            if isinstance(parsed, list):
                info["record_count"] = len(parsed)
            elif isinstance(parsed, dict):
                for key in ("rows", "records", "players", "items", "data", "evidence"):
                    if isinstance(parsed.get(key), list):
                        info["record_array_key"] = key
                        info["record_count"] = len(parsed[key])
                        break
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            info["parse_error"] = type(exc).__name__
    elif suffix in {".csv", ".tsv"}:
        try:
            text = data.decode("utf-8-sig", errors="replace")
            delimiter = "\t" if suffix == ".tsv" else ","
            rows = csv.reader(text.splitlines(), delimiter=delimiter)
            header = next(rows, [])
            info["columns"] = header[:200]
            info["record_count"] = sum(1 for _ in rows)
        except (UnicodeError, csv.Error) as exc:
            info["parse_error"] = type(exc).__name__
    elif suffix == ".jsonl":
        records = 0
        parse_errors = 0
        key_union: set[str] = set()
        for raw in data.decode("utf-8", errors="replace").splitlines():
            if not raw.strip():
                continue
            records += 1
            try:
                obj = json.loads(raw)
                if isinstance(obj, dict):
                    key_union.update(str(k) for k in obj.keys())
            except json.JSONDecodeError:
                parse_errors += 1
        info["record_count"] = records
        info["columns_or_keys"] = sorted(key_union)[:200]
        if parse_errors:
            info["parse_errors"] = parse_errors
    return info


def file_inventory(path: Path) -> dict[str, Any]:
    data = read_bytes(path)
    rel = path.relative_to(ROOT).as_posix()
    try:
        text = data.decode("utf-8", errors="replace")
    except Exception:
        text = ""
    terms, counts = term_matches(text)
    result: dict[str, Any] = {
        "path": rel,
        "extension": path.suffix.lower().lstrip("."),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
        "line_count": line_count(data),
        "semantic_terms": terms,
        "semantic_match_counts": counts,
    }
    if path.suffix.lower() in STRUCTURED_EXTENSIONS:
        result["structured"] = structured_info(path, data)
    return result


def sqlite_inventory(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "path": path.relative_to(ROOT).as_posix(),
        "sha256": sha256_bytes(read_bytes(path)),
        "objects": [],
    }
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    try:
        objects = db.execute(
            "SELECT type, name, sql FROM sqlite_master "
            "WHERE type IN ('table','view') ORDER BY type, name"
        ).fetchall()
        for obj in objects:
            name = obj["name"]
            quoted = '"' + name.replace('"', '""') + '"'
            columns = [dict(row) for row in db.execute(f"PRAGMA table_info({quoted})")]
            try:
                row_count = int(db.execute(f"SELECT COUNT(*) FROM {quoted}").fetchone()[0])
            except sqlite3.DatabaseError as exc:
                row_count = None
                count_error = type(exc).__name__
            else:
                count_error = None
            non_null: dict[str, int] = {}
            if obj["type"] == "table" and row_count is not None:
                for col in columns:
                    col_name = col["name"]
                    qcol = '"' + col_name.replace('"', '""') + '"'
                    try:
                        non_null[col_name] = int(
                            db.execute(
                                f"SELECT COUNT(*) FROM {quoted} WHERE {qcol} IS NOT NULL"
                            ).fetchone()[0]
                        )
                    except sqlite3.DatabaseError:
                        non_null[col_name] = -1
            names = " ".join([name, obj["sql"] or "", " ".join(c["name"] for c in columns)])
            terms, counts = term_matches(names)
            entry = {
                "type": obj["type"],
                "name": name,
                "row_count": row_count,
                "columns": columns,
                "non_null_counts": non_null,
                "semantic_terms": terms,
                "semantic_match_counts": counts,
            }
            if count_error:
                entry["row_count_error"] = count_error
            result["objects"].append(entry)
    finally:
        db.close()
    result["object_count"] = len(result["objects"])
    result["semantic_object_count"] = sum(bool(x["semantic_terms"]) for x in result["objects"])
    return result


def main() -> None:
    files = tracked_files()
    ext_counts = Counter(p.suffix.lower().lstrip(".") or "<none>" for p in files)
    all_infos: list[dict[str, Any]] = []
    structured_assets: list[dict[str, Any]] = []
    semantic_assets: list[dict[str, Any]] = []
    for path in files:
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS | {".db"}:
            continue
        info = file_inventory(path)
        all_infos.append(info)
        if path.suffix.lower() in STRUCTURED_EXTENSIONS:
            structured_assets.append(info)
        if info["semantic_terms"]:
            semantic_assets.append(info)

    db_assets = [p for p in files if p.suffix.lower() in {".db", ".sqlite", ".sqlite3"}]
    sqlite = [sqlite_inventory(p) for p in db_assets if p.exists()]
    relevant_tables = [
        {
            "database": db["path"],
            "type": obj["type"],
            "name": obj["name"],
            "row_count": obj["row_count"],
            "columns": [c["name"] for c in obj["columns"]],
            "non_null_counts": obj["non_null_counts"],
            "semantic_terms": obj["semantic_terms"],
        }
        for db in sqlite
        for obj in db["objects"]
        if obj["semantic_terms"]
    ]

    output = {
        "schema_version": "sp103_local_asset_inventory_v1",
        "generated_at": GENERATED_AT,
        "scan_method": {
            "tracked_file_source": "git ls-files -z",
            "content_scan": "UTF-8 decode with semantic field/description regexes; not filename-only",
            "structured_formats": sorted(STRUCTURED_EXTENSIONS),
            "sqlite_schema": "sqlite_master + PRAGMA table_info + row/non-null counts",
            "date_policy": "fixed execution date for deterministic rerun",
        },
        "denominators": {
            "tracked_files": len(files),
            "tracked_regular_files_scanned": len(all_infos),
            "structured_assets_scanned": len(structured_assets),
            "semantic_assets_found": len(semantic_assets),
            "sqlite_databases": len(sqlite),
            "sqlite_objects": sum(x["object_count"] for x in sqlite),
            "semantic_sqlite_objects": len(relevant_tables),
        },
        "extension_counts": dict(sorted(ext_counts.items())),
        "semantic_term_vocabulary": sorted(SEMANTIC_TERMS),
        "semantic_assets": semantic_assets,
        "structured_assets": structured_assets,
        "sqlite": sqlite,
        "semantic_sqlite_objects": relevant_tables,
    }
    target = OUT / "lane_a_local_inventory.json"
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "tracked_files": len(files),
        "semantic_assets": len(semantic_assets),
        "structured_assets": len(structured_assets),
        "sqlite_objects": sum(x["object_count"] for x in sqlite),
        "output": str(target.relative_to(ROOT)),
    }, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()

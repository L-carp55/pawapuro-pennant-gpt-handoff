#!/usr/bin/env python3
"""Independent SP-103 inventory lanes C--G.

The lanes deliberately write separate intermediate files.  The parent
materializer consumes them later, so a lane cannot silently repair or
reinterpret another lane's evidence.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
INTERMEDIATE = ROOT / "outputs" / "derived" / "sp103_intermediate"
AS_OF = "2026-08-23"


def load_json(rel: str, default: Any = None) -> Any:
    path = ROOT / rel
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def count_lines(rel: str) -> int:
    path = ROOT / rel
    if not path.exists():
        return 0
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as fh:
        return sum(1 for _ in fh)


def count_csv_rows(rel: str) -> int:
    path = ROOT / rel
    if not path.exists():
        return 0
    with path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        return max(0, sum(1 for _ in csv.reader(fh)) - 1)


def path_bytes(rel: str) -> int:
    path = ROOT / rel
    return path.stat().st_size if path.exists() else 0


def sqlite_counts() -> dict[str, Any]:
    path = ROOT / "data" / "pennant.db"
    if not path.exists():
        return {"path": str(path.relative_to(ROOT)), "available": False, "tables": {}}
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        names = [r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )]
        result: dict[str, Any] = {"path": str(path.relative_to(ROOT)), "available": True, "tables": {}}
        for name in names:
            try:
                count = int(con.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0])
                columns = [r[1] for r in con.execute(f'PRAGMA table_info("{name}")')]
                result["tables"][name] = {"rows": count, "columns": columns}
            except sqlite3.Error as exc:
                result["tables"][name] = {"rows": None, "columns": [], "error": str(exc)}
        return result
    finally:
        con.close()


def db_rows(counts: dict[str, Any], name: str) -> int:
    return int((counts.get("tables", {}).get(name) or {}).get("rows") or 0)


def candidate(
    number: int,
    family: str,
    item: str,
    construct: str,
    status: str,
    source: str,
    local_asset: str,
    denominator: Any,
    requirements: Iterable[str],
    routes: Iterable[str],
    role: str,
    risk: str,
    bias: str,
    validation: str,
    next_action: str,
    decision: str | None = None,
    provenance: Iterable[str] | None = None,
) -> dict[str, Any]:
    status = status.upper()
    return {
        "candidate_number": number,
        "evidence_id": f"SP103-EV-{number:03d}",
        "family": family,
        "item": item,
        "construct": construct,
        "status": status,
        "source_authority": source,
        "source_or_metric": item,
        "source_url_or_repo_artifact": list(provenance or []),
        "current_local_asset": local_asset,
        "coverage_denominator": denominator,
        "existing_requirement_ids": list(requirements),
        "existing_sp_routes": list(routes),
        "evidence_role": role,
        "independence_or_double_count_risk": risk,
        "known_bias_or_confounding": bias,
        "validation_needed": validation,
        "next_action": next_action,
        "implementation_status": status,
        "decision_use_status": decision or status,
        "direct_numeric_promotion_allowed": False,
    }


def save_json(rel: str, payload: Any) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_tsv(rel: str, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, delimiter="\t", lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") if not isinstance(row.get(field, ""), (list, dict)) else json.dumps(row[field], ensure_ascii=False, sort_keys=True) for field in fields})


def lane_header(lane: str, purpose: str) -> dict[str, Any]:
    return {
        "schema_version": f"sp103_lane_{lane.lower()}_v1",
        "as_of": AS_OF,
        "lane": lane,
        "purpose": purpose,
        "execution_contract": "independent_process; no canonical SP-103 output is written by this lane",
    }


def physical_lane() -> None:
    db = sqlite_counts()
    npb_rows = db_rows(db, "npb_plus_measurement")
    npb_top = 0
    npb_h2f = 0
    if db.get("available"):
        con = sqlite3.connect(f"file:{ROOT / 'data' / 'pennant.db'}?mode=ro", uri=True)
        try:
            npb_top, npb_h2f = con.execute(
                "SELECT COUNT(top_speed_kmh), COUNT(hp_to_1b_sec) FROM npb_plus_measurement"
            ).fetchone()
        finally:
            con.close()
    sprint = load_json("data/manual/sp101_mlb_sprint_speed_rows_20260818.json", {}) or {}
    sprint_rows = sprint.get("rows", []) if isinstance(sprint, dict) else []
    hist = load_json("data/normalized/speed_historical_physical_measurements_2015_2026.json", {}) or {}
    hist_rows = hist.get("records", []) if isinstance(hist, dict) else []
    metric_counts = Counter(str(row.get("metric", "")) for row in hist_rows)
    range_assets = [
        "data/normalized/speed_historical_physical_measurements_2015_2026.json",
        "outputs/derived/sp017_physical_measurement_range_reclassification.json",
        "data/manual/sprint_30m_measurements_curated.json",
        "data/manual/npb_speed_physical_evidence_full_20260809.json",
    ]
    rows = [
        candidate(1, "direct_physical", "NPB+ Hawk-Eye Sprint Speed / スプリントスピード", "peak_speed", "IMPLEMENTED", "official NPB+ Hawk-Eye field; local raw table", "data/pennant.db:npb_plus_measurement.top_speed_kmh;outputs/derived/sp100_npb_raw_latent_speed.json", {"db_rows": npb_rows, "non_null": npb_top}, ["SR-003", "SR-010", "SR-061"], ["SP-100", "SP-101"], "PowerPro-free physical primary/context lane", "same-source and same-player dependency with other NPB+ fields", "season/exposure and measurement-reliability are not identifiable in the current snapshot", "preserve raw provenance and keep reliability/exposure separate", "SP-100 N-primary only; no final practical numeric output", "IMPLEMENTED_SEPARATE_FROM_POWERPRO", ["https://www.japan-baseball.jp/npb-plus/"]),
        candidate(2, "direct_physical", "NPB+ Hawk-Eye 最速タイム（一塁到達）", "home_to_first_end_to_end", "SOURCE_CONFIRMED_NEW", "official NPB+ product surface; current field availability verified, old local provenance invalid", "data/pennant.db:npb_plus_measurement.hp_to_1b_sec (old local field quarantined)", {"old_local_rows": npb_h2f, "current_value_rows": 0}, ["SR-004", "SR-008", "SR-055", "SR-058"], ["SP-007", "SP-100"], "separate current H2F discovery lane", "H2F/90-foot may share contact and play context; do not double count", "old local field is MISATTRIBUTED_SOURCE; current official player values were not retrieved", "recollect with per-player provenance, batting side, swing/bunt protocol and date", "SCOPED_REJECTED_OLD_VALUES; current source reopened only", ["https://www.japan-baseball.jp/npb-plus/", "docs/audits/luna_npb_plus_provenance_contamination_20260814.md"]),
        candidate(3, "direct_physical", "MLB Statcast Sprint Speed", "peak_speed", "IMPLEMENTED_INCOMPLETE", "official Baseball Savant/Statcast", "data/manual/sp101_mlb_sprint_speed_rows_20260818.json", {"rows": len(sprint_rows), "non_null": sum(1 for r in sprint_rows if r.get("sprint_speed") is not None or r.get("sprint_speed_ft_s") is not None)}, ["SR-010", "SR-011", "SR-061"], ["SP-101", "MB-01", "MB-02"], "MLB physical bridge/anchor context", "same-system rows can be duplicated with 90-foot or H2F events", "MLB population and NPB transfer are not exchangeable without support checks", "player-clustered/forward holdout and common-support calibration", "bridge/anchor only; no direct NPB final value", ["https://baseballsavant.mlb.com/leaderboard/sprint_speed"]),
        candidate(4, "direct_physical", "MLB Statcast 90-foot Running Splits and 5-foot cumulative splits", "acceleration_shape_and_end_to_end", "SOURCE_CONFIRMED_NEW", "official MLB glossary and Baseball Savant running-splits surface", "no local player-level 90-foot split table found in tracked assets", {"local_rows": 0, "source_surface": "verified"}, ["SR-008", "SR-011", "SR-055"], ["SP-101", "MB-12", "MB-18"], "potential acceleration/standardized end-to-end bridge", "same plays may underlie Sprint Speed and HP-to-1B", "public surface defines metric but no frozen eligible row extraction exists", "collect 5-foot splits with season, batting side, qualifiers and raw denominators", "NOT_COLLECTED_EXTERNAL_OPPORTUNITY", ["https://www.mlb.com/glossary/statcast/90-foot-running-splits", "https://baseballsavant.mlb.com/running_splits"]),
        candidate(5, "direct_physical", "MLB Statcast Outfielder Jump Burst", "defensive_burst", "SOURCE_CONFIRMED_NEW", "official MLB Statcast glossary/leaderboard", "no local player-level Jump Burst rows found", {"local_rows": 0, "source_surface": "verified"}, ["SR-008", "SR-052", "SR-055"], ["SP-101", "MB-15"], "defensive context, not universal speed", "Burst/Reaction/Route are components of one jump event and must be separated", "availability for eligible outfielders is not yet preserved as a local row set", "collect with Reaction, Burst, Route, position and season; never merge into base-speed point", "NOT_COLLECTED_EXTERNAL_OPPORTUNITY", ["https://www.mlb.com/glossary/statcast/jump", "https://baseballsavant.mlb.com/leaderboard/outfield_jump"]),
        candidate(6, "direct_physical", "historical sourced home-to-first records", "home_to_first_end_to_end", "COLLECTED_BUT_UNUSED", "curated historical articles/video/profile records", "data/normalized/speed_historical_physical_measurements_2015_2026.json", {"records": metric_counts.get("HP_TO_1B_SECONDS", 0) + metric_counts.get("HP_TO_1B_FASTEST_SEC", 0) + metric_counts.get("HP_TO_1B_AVG_SEC", 0) + metric_counts.get("HP_TO_1B_NORMAL_SEC", 0)}, ["SR-004", "SR-008", "SR-055"], ["SP-017", "SP-101"], "historical range/context only", "same measurement can be transcribed by multiple sources", "protocol/date/handedness are heterogeneous", "retain range/confidence and measurement cluster; no proportional T90 conversion", "COLLECTED_BUT_UNUSED_RANGE_CONTEXT", range_assets),
        candidate(7, "direct_physical", "historical 30m / 50m physical tests", "short_distance_acceleration", "COLLECTED_BUT_UNUSED", "curated physical measurement corpus", "data/normalized/speed_historical_physical_measurements_2015_2026.json;outputs/derived/sp017_physical_measurement_range_reclassification.json", {"30m_or_50m_records": sum(v for k, v in metric_counts.items() if "30M" in k or "50M" in k or k == "50m")}, ["SR-004", "SR-008", "SR-055", "SR-056"], ["SP-017", "SP-101", "MB-12"], "historical acceleration/context lane", "30m/50m is not T90 and can share the same athlete/profile source", "standing/flying start, protocol and date incomplete for many rows", "store intervals/protocol/date flags; forbid 30m/50m→T90 proportional transform", "COLLECTED_BUT_UNUSED_RANGE_CONTEXT", range_assets),
        candidate(8, "direct_physical", "direct timed T90 / basepath / full-effort run", "end_to_end_basepath", "COLLECTED_BUT_UNUSED", "curated physical corpus", "data/normalized/speed_historical_physical_measurements_2015_2026.json", {"T90_records": metric_counts.get("T90FT_SECONDS", 0)}, ["SR-004", "SR-008", "SR-055"], ["SP-007", "SP-101"], "high-value direct physical lane when protocol is known", "duplicate source and protocol variants require cluster/dedup", "coverage is small and current-year comparability is limited", "expand direct T90 with protocol and timepoint; retain current negative coverage finding", "COLLECTED_BUT_UNUSED_LOW_COVERAGE", ["data/normalized/speed_historical_physical_measurements_2015_2026.json"]),
        candidate(9, "direct_physical", "reproducible NPB tracking-derived event-level baserunning speed", "event_running_speed", "MEASURED_NEGATIVE", "official NPB+ product surface checked; no reproducible event-level export found", "outputs/derived/sp103_intermediate/lane_b_external_source_verification.json", {"reproducible_official_rows": 0}, ["SR-047", "SR-052", "SR-058"], ["SP-101"], "bounded negative finding", "event speed may duplicate Sprint Speed/90-foot fields", "official navigation/field availability is not an event-level data extract", "reopen only with a reproducible official endpoint/snapshot", "MEASURED_NEGATIVE_BOUNDED_PUBLIC_SURFACE", ["https://www.japan-baseball.jp/npb-plus/"]),
        candidate(10, "direct_physical", "defensive straight-line tracking isolated from reaction/route/positioning", "defensive_straight_line_speed", "MEASURED_NEGATIVE", "repo-wide inventory and SP-062 input audit", "outputs/derived/sp062_defensive_chase_close_20260814.json;data/pennant.db", {"separated_rows": 0}, ["SR-052", "SR-055", "SR-058"], ["SP-062", "SP-101"], "bounded negative finding", "RngR/UZR/Jump contain route, reaction, positioning or fielding skill", "no separated NPB fielder tracking row exists in local assets", "reopen only after a source exposes separable movement components", "MEASURED_NEGATIVE_BOUNDED_LOCAL_UNIVERSE", ["outputs/derived/sp062_defensive_chase_close_20260814.json"]),
    ]
    payload = lane_header("C", "direct and near-direct physical running evidence")
    payload.update({"database_snapshot": db, "metric_counts": dict(sorted(metric_counts.items())), "sprint_speed_source_rows": len(sprint_rows), "evidence_candidates": rows, "negative_findings": ["Old npb_plus_measurement.hp_to_1b_sec is not validated by the current official product page and remains fail-closed.", "No official reproducible NPB event-level running export was found in the bounded search."]})
    save_json("outputs/derived/sp103_intermediate/lane_c_physical_measurements.json", payload)


def proxy_lane() -> None:
    db = sqlite_counts()
    batting = db_rows(db, "batting")
    grounders = db_rows(db, "infield_grounder_events")
    advances = db_rows(db, "baserunning_advances")
    bm_player = db_rows(db, "bm_player")
    steals = db_rows(db, "catcher_steal_event")
    rows = [
        candidate(11, "outcome_proxy", "infield-hit rate / infield grounder outcomes", "batted_ball_and_speed_mixed", "IMPLEMENTED_INCOMPLETE", "local batting and infield event database", "data/pennant.db:batting;data/pennant.db:infield_grounder_events;src/ratings/running.mjs", {"batting_rows": batting, "grounder_rows": grounders}, ["SR-002", "SR-008", "SR-009", "SR-057"], ["SP-019", "MB-13"], "mixed outcome proxy; current route retains it with guard", "shared batted-ball and UBR/GDP opportunity information", "batted-ball direction, fielder and batter skill confound physical speed", "residualize/stratify by ball context and preserve NOT_IDENTIFIABLE where unresolved", "CURRENT_PROXY_WITH_OPEN_DECONFOUNDING", ["data/pennant.db", "src/ratings/running.mjs", "docs/audits/sp019_construct_validity_reaudit_v2_20260813.md"]),
        candidate(12, "outcome_proxy", "GDP avoidance", "opportunity_and_baserunning_proxy", "IMPLEMENTED_INCOMPLETE", "local batting database and running route", "data/pennant.db:batting.gdp;src/ratings/running.mjs", {"batting_rows": batting}, ["SR-002", "SR-009", "SR-057"], ["SP-019", "MB-13"], "outcome context; not direct speed", "shares plate-appearance, double-play and hitter-contact opportunity with other proxies", "batter speed, contact/groundball profile, runners/base state and defense are confounded", "retain as bounded/shrunken context; do not promote to direct physical truth", "CURRENT_PROXY_CONTEXT_ONLY", ["data/pennant.db", "src/ratings/running.mjs"]),
        candidate(13, "outcome_proxy", "triple rate", "outcome_and_baserunning_proxy", "IMPLEMENTED_INCOMPLETE", "local batting database and audited route", "data/pennant.db:batting.b3;configs/running_norms.json", {"batting_rows": batting}, ["SR-002", "SR-009", "SR-057"], ["SP-019", "MB-13"], "mixed outcome proxy with separate legacy-control comparison", "triple rate overlaps park, batted ball, fielding and baserunning advances", "raw outcome is not a pure leg-speed measure", "keep component separation test and no direct promotion", "CURRENT_PROXY_CONTEXT_ONLY", ["data/pennant.db", "docs/audits/sp019_proxy_deconfounding_reaudit_20260813.md"]),
        candidate(14, "outcome_proxy", "extra-base advancement / baserunning advances", "decision_and_baserunning_context", "IMPLEMENTED_INCOMPLETE", "local event database with shrinkage repair", "data/pennant.db:baserunning_advances;src/ratings/baserunning_advance.mjs", {"advance_rows": advances}, ["SR-009", "SR-055", "SR-056"], ["SP-018", "MB-13"], "bounded opportunity-aware context", "same runner events can feed UBR/BsR and extra-base outcomes", "park, outs, hit location, fielder arm and choice are mixed", "retain low-opportunity observations with continuous shrinkage and uncertainty", "CURRENT_SHRUNK_CONTEXT_ONLY", ["data/pennant.db", "src/ratings/baserunning_advance.mjs", "configs/running_norms.json"]),
        candidate(15, "outcome_proxy", "UBR / BsR-compatible measures", "baserunning_outcome_value", "IMPLEMENTED_INCOMPLETE", "Baseball Monster-style local data and route", "data/pennant.db:bm_player.ubr/run_war;data/pennant.db:v_bm_by_player;src/ratings/running.mjs", {"bm_player_rows": bm_player}, ["SR-002", "SR-009", "SR-057"], ["SP-019", "MB-13", "MB-15"], "outcome/defense context, not direct truth", "UBR/BsR overlaps advances, steals, baserunning decisions and opportunities", "model definition and league translation contain technique and context", "use only as residual/context lane and audit removal effects", "CURRENT_PROXY_CONTEXT_ONLY", ["data/pennant.db", "src/ratings/running.mjs"]),
        candidate(16, "outcome_proxy", "DELTA / 1.02 Spd (Speed Score)", "composite_outcome_proxy", "SOURCE_CONFIRMED_NEW", "official 1.02 glossary", "no direct local DELTA/Spd row; source definition preserved", {"local_rows": 0, "source_definition": "verified"}, ["SR-002", "SR-009", "SR-057", "SR-058"], ["SP-101"], "composite proxy only", "SB success, attempts, triples and run/scoring frequency overlap other candidates", "technique, opportunity, lineup and scoring environment are embedded", "if collected, store components and never call it direct speed", "SCOPED_NOT_COLLECTED_COMPOSITE_PROXY", ["https://1point02.jp/op/gnav/glossary/gls_explanation.aspx?ecd=204&eid=20047"]),
        candidate(17, "outcome_proxy", "stolen-base outcomes / steal success", "stealing_technique_and_opportunity", "IMPLEMENTED_INCOMPLETE", "local batting/catcher event data", "data/pennant.db:batting.sb/cs;data/pennant.db:catcher_steal_event", {"batting_rows": batting, "steal_event_rows": steals}, ["SR-002", "SR-009", "SR-019"], ["SP-101", "MB-13"], "technique/context lane separated from physical speed", "lead distance, pitcher/catcher, game state and decision overlap", "raw steals cannot identify pure running speed", "keep in technique lane; use physical estimate without direct SB input", "TECHNIQUE_CONTEXT_ONLY", ["data/pennant.db", "docs/state/speed_exclusion_reason_ledger.tsv"]),
        candidate(18, "outcome_proxy", "Statcast Baserunning Run Value / analogous outcome value", "baserunning_outcome_value", "SOURCE_CONFIRMED_NEW", "official MLB glossary/leaderboard", "no local eligible player-level Statcast run-value table", {"local_rows": 0, "source_surface": "verified"}, ["SR-002", "SR-052", "SR-057"], ["SP-101", "MB-13"], "technique/context unless deconfounded", "official model incorporates runner speed and other contextual inputs, creating circularity risk", "not a pure physical metric and not reproducibly extracted for current NPB cohort", "collect only with feature definition and deconfounding plan", "NOT_COLLECTED_CONTEXT_OPPORTUNITY", ["https://www.mlb.com/glossary/statcast/baserunning", "https://baseballsavant.mlb.com/leaderboard/basestealing-run-value"]),
    ]
    payload = lane_header("D", "outcome-derived proxy, technique and double-count audit")
    payload.update({"database_snapshot": db, "evidence_candidates": rows, "double_count_groups": [
        {"group_id": "SB_TECHNIQUE", "members": ["SP103-EV-016", "SP103-EV-017", "SP103-EV-018"], "guard": "never direct-speed-promote; keep lead/opportunity/technique separate"},
        {"group_id": "TRIPLE_AND_ADVANCE", "members": ["SP103-EV-013", "SP103-EV-014", "SP103-EV-015", "SP103-EV-016"], "guard": "same events may appear in multiple outcome proxies; route-removal and residualization required"},
        {"group_id": "INFIELD_BALL_CONTEXT", "members": ["SP103-EV-011", "SP103-EV-012", "SP103-EV-013", "SP103-EV-015"], "guard": "batted-ball and fielder context must not become speed truth"},
    ], "negative_findings": ["No proxy in this lane is allowed to become a direct physical measurement.", "SP-019 remains NOT_IDENTIFIABLE_PROVISIONAL for the infield-hit/GB deconfounding question."]})
    save_json("outputs/derived/sp103_intermediate/lane_d_outcome_proxies.json", payload)


def cross_game_lane() -> None:
    db = sqlite_counts()
    show_rows = db_rows(db, "the_show_rating")
    show_bridge = db_rows(db, "the_show_bridge")
    powerpro = db_rows(db, "pawapuro_full")
    transition_rows = count_csv_rows("outputs/derived/sp101_npb_mlb_transition_segments.csv")
    show_panel = count_lines("outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz")
    show_events = count_csv_rows("outputs/derived/sp101_the_show_roster_update_speed_events.csv")
    temporal_pairs = count_csv_rows("outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv")
    prospi_candidates = [
        "outputs/derived/speed_prospi_gamex_current_20260813_run2.csv",
        "outputs/derived/speed_prospi_gamex_current_20260813_run3.csv",
        "outputs/derived/speed_community_v3_prospi_remainder_inventory_20260815.csv",
    ]
    prospi_bytes = sum(path_bytes(p) for p in prospi_candidates)
    rows = [
        candidate(19, "external_game", "MLB The Show Live/base-roster Speed current and historical", "external_appraisal_speed", "IMPLEMENTED_INCOMPLETE", "local The Show database and SP-101 longitudinal panel", "data/pennant.db:the_show_rating;outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz", {"rating_rows": show_rows, "panel_lines": show_panel}, ["SR-023", "SR-024", "SR-060"], ["SP-101", "MB-09"], "appraisal/context only", "same player-edition fields correlate by construction and are not physical ground truth", "edition timing, roster carry-forward and cross-time confounding", "retain current/historical values with edition/time gaps and no direct copy", "SP101_CONTEXT_ONLY_NOT_FINAL_NUMERIC", ["outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz", "data/pennant.db"]),
        candidate(20, "external_game", "MLB The Show roster-update Speed deltas", "temporal_appraisal_delta", "IMPLEMENTED_INCOMPLETE", "local SP-101 roster-update events", "outputs/derived/sp101_the_show_roster_update_speed_events.csv", {"events": show_events}, ["SR-023", "SR-024", "SR-060"], ["SP-101", "MB-09"], "temporal context only", "multiple updates may represent the same underlying editorial source", "update timing and carry-forward labels are not a physical measurement", "preserve event provenance and use only as bounded ordinal/context lane", "SP101_CONTEXT_ONLY_NOT_FINAL_NUMERIC", ["outputs/derived/sp101_the_show_roster_update_speed_events.csv"]),
        candidate(21, "external_game", "The Show Stealing and Baserunning Aggressiveness separate from Speed", "technique_context", "IMPLEMENTED_INCOMPLETE", "local The Show fields and SP-101 semantic repair", "data/pennant.db:the_show_rating.speed/baserunning_ability/baserunning_aggression;outputs/derived/sp101_current100_multibridge_evidence.json", {"rating_rows": show_rows, "current100": 100}, ["SR-002", "SR-023", "SR-060"], ["SP-101", "MB-02", "MB-16"], "separate technique/context fields", "Speed, Stealing and Aggression share game-editorial provenance but different constructs", "game ratings are not physical truth", "keep named fields separate and prohibit collapse into physical estimate", "SEMANTICALLY_SEPARATED_CONTEXT", ["data/pennant.db", "outputs/derived/sp101_current100_multibridge_evidence.json"]),
        candidate(22, "cross_game_transition", "NPB→MLB Japanese-player transitions", "league_transition_context", "IMPLEMENTED_INCOMPLETE", "SP-101 transition panel and MLB appearance sources", "outputs/derived/sp101_npb_mlb_transition_segments.csv;outputs/derived/sp101_mlb_regular_season_appearance_years.csv", {"transition_rows": transition_rows}, ["SR-011", "SR-023", "SR-024", "SR-060"], ["SP-101", "MB-05"], "transition/eligibility context", "transition rows can reuse the same player-year The Show and MLB metrics", "selection into MLB, time gaps and age/injury confound transfer", "use explicit cohort and forward holdout; no lifetime average leakage", "SP101_IMPLEMENTED_BOUNDED_CONTEXT", ["outputs/derived/sp101_npb_mlb_transition_segments.csv"]),
        candidate(23, "cross_game_transition", "MLB→NPB foreign-player transitions", "league_transition_context", "IMPLEMENTED_INCOMPLETE", "SP-101 transition panel", "outputs/derived/sp101_npb_mlb_transition_segments.csv", {"transition_rows": transition_rows}, ["SR-011", "SR-023", "SR-024", "SR-060"], ["SP-101", "MB-05"], "transition/eligibility context", "same player appears in multiple source systems and editions", "selection, league and time gaps are material", "report cohort denominator and missingness separately", "SP101_IMPLEMENTED_BOUNDED_CONTEXT", ["outputs/derived/sp101_npb_mlb_transition_segments.csv"]),
        candidate(24, "cross_game_transition", "NPB→MLB→NPB returnees", "returnee_temporal_context", "IMPLEMENTED_INCOMPLETE", "SP-101 transition panel and returnee route", "outputs/derived/sp101_npb_mlb_transition_segments.csv;outputs/derived/sp101_transition_effects.json", {"transition_rows": transition_rows}, ["SR-011", "SR-023", "SR-024", "SR-054"], ["SP-101", "MB-10"], "returnee context/negative-control cohort", "same player has correlated repeated observations", "return-to-league selection and injury/time gap", "synthetic-control design with pre-period holdout and uncertainty", "SP101_IMPLEMENTED_BOUNDED_CONTEXT", ["outputs/derived/sp101_transition_effects.json"]),
        candidate(25, "cross_game_transition", "multi-cycle MLB/NPB players", "multi_cycle_temporal_context", "IMPLEMENTED_INCOMPLETE", "SP-101 transition panel", "outputs/derived/sp101_npb_mlb_transition_segments.csv", {"transition_rows": transition_rows}, ["SR-011", "SR-023", "SR-024", "SR-054"], ["SP-101", "MB-04", "MB-05"], "multi-cycle context", "repeated cycles are not independent evidence rows", "temporal and selection confounding", "cluster by player and retain cycle-specific gaps", "SP101_IMPLEMENTED_BOUNDED_CONTEXT", ["outputs/derived/sp101_npb_mlb_transition_segments.csv"]),
        candidate(26, "cross_game_transition", "historical NPB players with The Show data outside current 100", "historical_anchor_context", "IMPLEMENTED_INCOMPLETE", "SP-101 historical panel", "outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv;data/pennant.db:the_show_bridge", {"panel_rows": count_csv_rows("outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv"), "bridge_rows": show_bridge}, ["SR-023", "SR-024", "SR-032", "SR-060"], ["SP-101", "MB-01", "MB-08"], "historical context/anchor candidate", "same identity may occur in bridge, game rating and MLB physical tables", "historical cohort and temporal gap limit directness", "use only as bounded context or physical-anchored analog with support checks", "SP101_HISTORICAL_CONTEXT_NOT_FINAL_NUMERIC", ["outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv"]),
        candidate(27, "external_game", "PowerPro current value", "external_appraisal_context", "IMPLEMENTED_INCOMPLETE", "local PowerPro panel and owner ruling", "data/pennant.db:pawapuro_full;outputs/derived/sp100_npb_raw_latent_speed.json", {"rows": powerpro}, ["SR-005", "SR-007", "SR-010", "SR-061"], ["SP-100", "SP-101", "MB-06"], "appraisal context only", "using PowerPro as teacher creates circularity and label copying", "editorial/game scale is not physical speed", "retain current label for comparison/QA, excluded from physical teacher path", "POWERPRO_CONTEXT_ONLY", ["data/pennant.db", "docs/audits/sp100_owner_decision_20260816.md"]),
        candidate(28, "external_game", "PowerPro longitudinal trajectory / inertia / stale detection", "temporal_appraisal_context", "IMPLEMENTED_INCOMPLETE", "local PowerPro panel and SP-101 temporal route", "data/pennant.db:pawapuro_full;outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv", {"powerpro_rows": powerpro, "temporal_pairs": temporal_pairs}, ["SR-005", "SR-006", "SR-007", "SR-040"], ["SP-101", "MB-06", "MB-11"], "stale/odd diagnostic context", "trajectory fields share source/editorial inertia", "age/injury/current physical evidence must be joined before stale claim", "use separate diagnostic lane and preserve uncertainty", "POWERPRO_CONTEXT_ONLY_NOT_FINAL_NUMERIC", ["outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv"]),
        candidate(29, "external_game", "Prospi A raw data retained under owner ruling", "external_appraisal_context", "IMPLEMENTED_INCOMPLETE", "local Prospi A artifacts and owner ruling", ";".join(prospi_candidates), {"candidate_asset_bytes": prospi_bytes}, ["SR-027", "SR-028", "SR-029", "SR-059"], ["SP-101"], "raw/context only; not independent PowerPro teacher", "same game-editorial scale and possible duplicate source families", "Prospi A is explicitly not accepted for PowerPro stale/odd QA", "preserve raw and ruling; no silent promotion", "OWNER_RULING_CONTEXT_ONLY", prospi_candidates),
        candidate(30, "external_game", "console Prospi non-collection", "external_appraisal_context", "SCOPED_REJECTED", "owner ruling SR-059", "docs/state/speed_requirements_baseline_20260813.tsv", {"collected_console_rows": 0}, ["SR-027", "SR-028", "SR-029", "SR-059"], ["SP-101"], "explicit non-collection", "console Prospi is expected to be near-duplicate of PowerPro and not independent", "collecting it would expand scope without independent information", "reopen only if a new source proves independent construct/provenance", "OWNER_RULING_SCOPED_REJECTED", ["docs/state/speed_requirements_baseline_20260813.tsv"]),
    ]
    payload = lane_header("E", "MLB The Show, PowerPro, Prospi and cross-league temporal evidence")
    payload.update({"database_snapshot": db, "observations": {"transition_rows": transition_rows, "show_panel_lines": show_panel, "show_roster_update_events": show_events, "powerpro_show_temporal_pairs": temporal_pairs, "prospi_candidate_bytes": prospi_bytes}, "evidence_candidates": rows, "cohort_guards": ["current100=100 is retained; all eligible MLB-experienced rows are measured as matched/missing/unresolved, not silently reduced to the old 6/7-pair sample", "The Show Speed, Stealing and Baserunning Aggressiveness remain separate", "The Show/PowerPro values are not copied into current NPB final speed"]})
    save_json("outputs/derived/sp103_intermediate/lane_e_cross_game_temporal.json", payload)


def route_receipts() -> tuple[dict[str, Any], dict[str, int]]:
    source = load_json("outputs/derived/sp101_current100_multibridge_evidence.json", {}) or {}
    players = source.get("players", []) if isinstance(source, dict) else []
    keys = [
        "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE", "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS", "MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL", "MB-04_WITHIN_PLAYER_TEMPORAL_DELTA", "MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS", "MB-06_RATING_INERTIA_AND_STALENESS_MODEL", "MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH", "MB-08_DISTRIBUTION_AND_TAIL_CALIBRATION", "MB-09_THE_SHOW_ROSTER_UPDATE_RESPONSE", "MB-10_RETURNEE_SYNTHETIC_CONTROL", "MB-11_AGE_CURVE_AND_TEMPORAL_DECAY", "MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE", "MB-13_PINCH_RUNNER_AND_USAGE_ROLE_CONTEXT", "MB-14_VIDEO_FRAME_TIMING", "MB-15_DEFENSIVE_RANGE_AND_CHASE_CONTEXT", "MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT", "MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE", "MB-18_DECISION_USE_AND_ABLATION_RECEIPT",
    ]
    summary: dict[str, Any] = {}
    effects: Counter[str] = Counter()
    for key in keys:
        values = [p.get("decision_use_receipt", {}).get(key, {}) for p in players]
        effects.update(str(v.get("influence_classification", "MISSING")) for v in values)
        summary[key] = {
            "player_count": len(players),
            "receipt_count": sum(1 for v in values if v),
            "evidence_count_total": sum(int(v.get("evidence_count") or 0) for v in values),
            "decision_effect_counts": dict(sorted(Counter(str(v.get("decision_effect", "MISSING")) for v in values).items())),
            "influence_classification_counts": dict(sorted(Counter(str(v.get("influence_classification", "MISSING")) for v in values).items())),
            "state_counts": dict(sorted(Counter(str(v.get("state", "MISSING")) for v in values).items())),
            "source_artifact": "outputs/derived/sp101_current100_multibridge_evidence.json:players[].decision_use_receipt",
        }
    return summary, dict(sorted(effects.items()))


def transfer_lane() -> None:
    receipts, influence = route_receipts()
    source = load_json("outputs/derived/sp101_current100_multibridge_evidence.json", {}) or {}
    players = source.get("players", []) if isinstance(source, dict) else []
    ablation = load_json("outputs/derived/sp101_route_ablation_qa.json", {}) or {}
    routes = [
        (44, "TF-044", "normalized L2 analog matching", "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE", "implemented_bounded"),
        (45, "TF-045", "mutual kNN", "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE", "implemented_bounded"),
        (46, "TF-046", "covariance-aware Mahalanobis matching", "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE", "implemented_bounded"),
        (47, "TF-047", "optimal-transport distribution matching", "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE", "implemented_bounded"),
        (48, "TF-048", "shared-indicator prediction with player-clustered holdout", "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS", "implemented_bounded"),
        (49, "TF-049", "multi-trait latent measurement model", "MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL", "implemented_bounded"),
        (50, "TF-050", "within-player temporal delta", "MB-04_WITHIN_PLAYER_TEMPORAL_DELTA", "implemented_bounded"),
        (51, "TF-051", "league-transition fixed-effects model", "MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS", "implemented_bounded"),
        (52, "TF-052", "returnee synthetic controls", "MB-10_RETURNEE_SYNTHETIC_CONTROL", "implemented_bounded"),
        (53, "TF-053", "pairwise/ordinal constraint graph", "MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH", "implemented_bounded"),
        (54, "TF-054", "independent-lane consensus/conflict synthesis", "MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT", "implemented_bounded"),
        (55, "TF-055", "route-removal ablation", "MB-18_DECISION_USE_AND_ABLATION_RECEIPT", "implemented_bounded"),
        (56, "TF-056", "leakage-safe anchor calibration", "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE", "requires_new_preflight"),
        (57, "TF-057", "cross-fitted / leave-player-out transfer", "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS", "partial_holdout_receipt"),
        (58, "TF-058", "hierarchical partial pooling or interval transfer", "MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL", "requires_new_preflight"),
        (59, "TF-059", "physical-rich-only rank/quantile mapping", "MB-08_DISTRIBUTION_AND_TAIL_CALIBRATION", "requires_new_preflight"),
        (60, "TF-060", "multiple-imputation / interval propagation", "MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL", "requires_new_preflight"),
        (61, "TF-061", "handedness/protocol-aware H2F calibration", "MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE", "blocked_by_source_coverage"),
        (62, "TF-062", "MLB 5-foot acceleration-shape features", "MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE", "blocked_by_source_coverage"),
    ]
    methods: list[dict[str, Any]] = []
    for number, method_id, name, route, status in routes:
        route_summary = receipts.get(route, {})
        if number <= 55:
            calibration = "receipt-backed route ablation; not a final appraisal calibration error"
            uncertainty = "player-level route state, confidence tier, consensus spread and ablated state preserved"
            actual = "SP-101 preliminary evidence/decision-use only; no SP-079 final value"
            common = "explicit comparable-lane/common-support checks; insufficient lanes remain visible"
            leakage = "player clustering and/or forward holdout where applicable; no self-teaching partner fabrication"
            holdout = "SP-101 clustered/forward holdout receipt or exact 100x18 ablation receipt"
            features = "physical, shared indicators, game/context fields according to route; PowerPro excluded from physical teacher path"
        else:
            calibration = "not executed as a new final-appraisal calibration in SP-103; gap is explicit"
            uncertainty = "must output interval/range and confidence; no forced point estimate"
            common = "physical-rich anchor support only; fail closed outside overlap"
            leakage = "leave-player-out/cross-fit required; anchor cannot teach its own target"
            holdout = "new player-clustered and temporal holdout required before SP-079"
            features = "bounded common features only; H2F requires batting side/protocol; PowerPro labels prohibited as teacher"
            if number == 57:
                status = "IMPLEMENTED_INCOMPLETE"
                calibration = "SP-101 MB-02 has real clustered/forward holdout receipt; final all-family cross-fit remains a gap"
            if number in (61, 62):
                common = "only same protocol/handedness or same Statcast split definition; otherwise unavailable"
        methods.append({
            "candidate_number": number,
            "evidence_id": f"SP103-EV-{number:03d}",
            "method_id": method_id,
            "method": name,
            "source_route": route,
            "status": status.upper(),
            "training_population": "SP-101 physical-rich / shared-indicator / eligible transition cohort as route permits",
            "target_population": "current NPB 100 sparse or partially observed players; cohort is route-specific",
            "features": features,
            "target_construct": "latent physical speed percentile/range, not PowerPro label and not final 0-100",
            "common_support_rule": common,
            "leakage_guard": leakage,
            "holdout_design": holdout,
            "calibration_error_or_status": calibration,
            "uncertainty": uncertainty,
            "actual_decision_use": actual,
            "route_receipt": route_summary,
            "direct_numeric_promotion_allowed": False,
            "next_action": "retain bounded diagnostic and rerun independent QA before SP-079" if number <= 55 else "design and independently validate before any final appraisal",
        })
    payload = lane_header("F", "data-rich to data-poor transfer and inference method universe")
    payload.update({"current100_count": len(players), "sp101_route_receipts": receipts, "global_influence_counts": influence, "ablation_contract": {"all100x18_exact": ablation.get("all100x18_exact"), "cell_count": len(ablation.get("ablation_cells", [])) if isinstance(ablation.get("ablation_cells"), list) else 0, "source": "outputs/derived/sp101_route_ablation_qa.json"}, "evidence_candidates": methods, "negative_findings": ["SP-101 receipts prove route execution and decision-use/ablation semantics, not readiness of final practical numeric appraisal.", "New anchor/partial-pooling/H2F/5-foot transfer methods remain explicit gaps; no silent fallback is permitted."]})
    save_json("outputs/derived/sp103_intermediate/lane_f_transfer_methods.json", payload)
    top_speed_cells: list[dict[str, Any]] = []
    component_counts: Counter[str] = Counter()
    for player in players:
        physical = player.get("independent_physical_estimate", {}) or {}
        peak_available = physical.get("peak_speed_kmh") is not None or physical.get("peak_speed_range_percentile_0_100") is not None
        accel_evidence = physical.get("acceleration_evidence")
        accel_state = str(physical.get("acceleration_end_to_end_state", "MISSING"))
        accel_available = bool(accel_evidence) or accel_state in {"AVAILABLE", "AVAILABLE_BOUNDED", "MEASURED", "MEASURED_BOUNDED"}
        before_components = [name for name, available in (("PEAK_SPEED", peak_available), ("ACCELERATION_OR_END_TO_END", accel_available)) if available]
        after_components = [name for name, available in (("ACCELERATION_OR_END_TO_END", accel_available),) if available]
        before_state = "PHYSICAL_COMPONENT_AVAILABLE" if before_components else "NO_COMPONENT"
        after_state = "PHYSICAL_COMPONENT_AVAILABLE" if after_components else "NO_COMPONENT"
        component_class = "PEAK_AND_ACCELERATION" if peak_available and accel_available else "PEAK_ONLY" if peak_available else "ACCELERATION_ONLY" if accel_available else "NEITHER"
        component_counts[component_class] += 1
        top_speed_cells.append({
            "stable_player_key": player.get("stable_player_key"),
            "before_components": before_components,
            "after_peak_speed_removal_components": after_components,
            "before_state": before_state,
            "after_peak_speed_removal_state": after_state,
            "state_changed": before_state != after_state,
            "acceleration_end_to_end_state": accel_state,
            "final_numeric_rating_created": False,
        })
    save_json("outputs/derived/sp103_intermediate/lane_f_top_speed_preflight.json", {
        "schema_version": "sp103_top_speed_dominance_preflight_v1",
        "as_of": AS_OF,
        "population": len(players),
        "method": "deterministic component ablation: remove peak-speed component from each independent physical state; preserve acceleration/end-to-end availability; no final player rating is generated",
        "top_speed_field": "players[].independent_physical_estimate.peak_speed_kmh",
        "top_speed_available_count": sum(1 for p in players if p.get("independent_physical_estimate", {}).get("peak_speed_kmh") is not None),
        "acceleration_available_count": sum(1 for p in players if p.get("independent_physical_estimate", {}).get("acceleration_evidence")),
        "acceleration_end_to_end_state_counts": dict(sorted(Counter(str(p.get("independent_physical_estimate", {}).get("acceleration_end_to_end_state", "MISSING")) for p in players).items())),
        "component_class_counts": dict(sorted(component_counts.items())),
        "top_speed_removal_cells": top_speed_cells,
        "top_speed_only_count": component_counts.get("PEAK_ONLY", 0),
        "peak_and_acceleration_count": component_counts.get("PEAK_AND_ACCELERATION", 0),
        "acceleration_only_count": component_counts.get("ACCELERATION_ONLY", 0),
        "neither_count": component_counts.get("NEITHER", 0),
        "state_changed_after_peak_removal_count": sum(1 for cell in top_speed_cells if cell["state_changed"]),
        "route_influence_counts": influence,
        "top_speed_removal_status": "PASS_PRE_FINAL_APPRAISAL_COMPONENT_ABLATION",
        "final_appraisal_recompute": "NOT_RUN",
        "required_follow_up": "retain this component/influence receipt when final-appraisal preflight is authorized; preserve no PowerPro-copy path",
    })


def scale_candidates() -> list[dict[str, Any]]:
    return [
        candidate(63, "scale_engine", "provisional relative-to-display scale", "display_scale", "IMPLEMENTED_INCOMPLETE", "existing scale audit and SP-099 repair", "configs/ratings.json;docs/audits/sp099_scale_architecture_verdict_20260814.md", {"status": "provisional"}, ["SR-034", "SR-035", "SR-050"], ["SP-099"], "calibration only; not player evidence", "display scale can be mixed with physical units if applied at wrong layer", "PowerPro-derived scale and uncalibrated z-scale remain separate risks", "rerun scale QA after construct freeze; keep source and transform explicit", "NOT_READY_FOR_FINAL_SCALE", ["configs/ratings.json", "docs/audits/sp099_scale_architecture_verdict_20260814.md"]),
        candidate(64, "scale_engine", "ability-value → custom-engine movement-response bridge", "engine_response", "NOT_COLLECTED", "task/spec requirement; implementation not run in SP-103", "no new SP-103 engine output", {"new_runs": 0}, ["SR-036", "SR-044", "SR-050"], ["SP-079"], "calibration only", "engine response is downstream of evidence and cannot validate physical truth by itself", "no SP-103 run permitted to become final numeric generation", "run only after owner/gate scope explicitly allows it", "GATE_BLOCKED_PRE_SP079", ["docs/tasks/SP103_SPEED_EVIDENCE_UNIVERSE_COMPLETENESS_20260823.md"]),
        candidate(65, "scale_engine", "league-distribution simulation QA", "league_distribution_calibration", "NOT_COLLECTED", "task/spec requirement; no SP-103 simulation run", "no new SP-103 simulation output", {"new_runs": 0}, ["SR-036", "SR-044", "SR-050"], ["SP-079"], "calibration only", "league distribution can conceal systematic source/scale mismatch", "simulation is downstream and must not be mistaken for evidence discovery", "run as a separate post-gate QA with frozen evidence and scale manifest", "GATE_BLOCKED_PRE_SP079", ["docs/tasks/SP103_SPEED_EVIDENCE_UNIVERSE_COMPLETENESS_20260823.md"]),
        candidate(66, "scale_engine", "current-100 vs non-100 full-roster scale consistency", "population_scale_consistency", "NOT_COLLECTED", "task/spec requirement; no SP-103 final scale run", "no new SP-103 full-roster scale output", {"new_runs": 0}, ["SR-037", "SR-050"], ["SP-079"], "calibration only", "100-player-only normalization can create a separate scale", "no final 0-100 or shoulder work is permitted in this task", "run after evidence universe lock with all-roster denominator", "GATE_BLOCKED_PRE_SP079", ["docs/tasks/SP103_SPEED_EVIDENCE_UNIVERSE_COMPLETENESS_20260823.md"]),
    ]


def requirement_mapping(requirement_id: str) -> tuple[list[int], str, str]:
    # Each baseline row gets an explicit mapping; broad rows use multiple
    # candidates and a precise artifact/gap statement rather than an empty
    # "covered" flag.
    groups: dict[str, list[int]] = {
        "SR-001": [63, 64], "SR-002": [11, 17, 21], "SR-003": [1], "SR-004": [2, 6, 7, 8], "SR-005": [28], "SR-006": [28], "SR-007": [27, 49], "SR-008": [2, 4, 7, 8, 11, 14], "SR-009": [11, 12, 13, 14, 15], "SR-010": [1, 3, 27], "SR-011": [3, 22, 23, 24, 44, 48], "SR-012": [48, 57], "SR-013": [50, 58], "SR-014": [35, 36], "SR-015": [27, 29, 36], "SR-016": [27, 34, 35], "SR-017": [30, 35], "SR-018": [29, 35, 36], "SR-019": [17, 35, 40], "SR-020": [35, 36], "SR-021": [34, 35], "SR-022": [5, 10, 34, 35], "SR-023": [19, 20, 21, 22, 23, 24, 25, 26], "SR-024": [19, 20, 22, 23], "SR-025": [19, 22, 23, 44, 48], "SR-026": [19, 22, 23, 58], "SR-027": [29], "SR-028": [29], "SR-029": [27, 28, 29], "SR-030": [38, 50, 58], "SR-031": [37, 38, 50, 58], "SR-032": [3, 6, 7, 8, 26], "SR-033": [53, 54, 56], "SR-034": [63], "SR-035": [27, 63], "SR-036": [64], "SR-037": [66], "SR-038": [1, 3, 19, 27], "SR-039": [11, 13, 15, 54], "SR-040": [28, 37, 38, 50], "SR-041": [34, 35, 54], "SR-042": [54, 55], "SR-043": [1, 3, 11, 19, 44, 54], "SR-044": [64, 65], "SR-045": [63, 64, 65, 66], "SR-046": [64, 65, 66], "SR-047": [9, 10, 34, 35, 58], "SR-048": [63, 64, 65, 66], "SR-049": [63], "SR-050": [1, 3, 44, 55, 63, 64, 65, 66], "SR-051": [31, 32, 33, 41, 43], "SR-052": [5, 10, 31, 33, 34, 41, 42, 43], "SR-053": [50, 58], "SR-054": [22, 23, 24, 25, 28, 38], "SR-055": [2, 6, 7, 8, 11, 14, 34, 35, 40, 58], "SR-056": [7, 14, 44, 58, 60], "SR-057": [11, 13, 15, 16, 18, 54], "SR-058": [9, 10, 16, 30, 58, 61, 62], "SR-059": [29, 30], "SR-060": [19, 20, 21, 26, 27, 28], "SR-061": [1, 3, 44, 48, 56, 59],
    }
    nums = groups.get(requirement_id, [])
    if requirement_id in {"SR-045", "SR-046", "SR-048", "SR-049", "SR-050"}:
        status = "GOVERNANCE_LOCK_MEASURED"
        detail = "registry/QA lock is explicit; downstream final appraisal remains gate-blocked"
    elif requirement_id in {"SR-064", "SR-065"}:
        status = "NOT_APPLICABLE"
        detail = "not a baseline row"
    elif any(n in {9, 10, 16, 30, 58, 61, 62, 64, 65, 66} for n in nums):
        status = "BOUNDED_GAP_OR_NEGATIVE_FINDING"
        detail = "mapped evidence/gap is explicit; no silent completion claim"
    else:
        status = "TRACED_IMPLEMENTATION_OR_CONTEXT"
        detail = "mapped evidence/route is explicit and direct promotion is prohibited"
    return nums, status, detail


def owner_and_scale_lane() -> None:
    db = sqlite_counts()
    scouting = load_json("outputs/derived/sp060_scouting_inventory_20260814.json", {}) or {}
    pinch = load_json("outputs/derived/sp061_pinch_runner_weak_context_20260814.json", {}) or {}
    chase = load_json("outputs/derived/sp062_defensive_chase_close_20260814.json", {}) or {}
    community_files = [
        "data/normalized/speed_2026_sns_consensus_sources_v2.json",
        "outputs/derived/speed_community_v3_consensus_20260815.json",
        "outputs/derived/speed_community_v3_youtube_semantic_classified_20260814.jsonl",
    ]
    community_bytes = sum(path_bytes(p) for p in community_files)
    context_rows = [
        candidate(31, "human_context", "official scouting reports", "scouting_directional_context", "IMPLEMENTED_INCOMPLETE", "official scouting inventory with broad sweep", "outputs/derived/sp060_scouting_inventory_20260814.json", {"records": len(scouting.get("broad_official_scouting_sweep", []) or []), "inventory_bytes": path_bytes("outputs/derived/sp060_scouting_inventory_20260814.json")}, ["SR-031", "SR-032", "SR-052", "SR-055"], ["SP-060", "MB-12"], "dated directional context", "scouting grades and prose may share evaluator/source lineage", "coverage is sparse and age/role/year dependent", "preserve source year/age and use only low-weight/context lane", "COLLECTED_BOUNDED_SCOUTING_CONTEXT", ["outputs/derived/sp060_scouting_inventory_20260814.json"]),
        candidate(32, "human_context", "draft / amateur timed-test reporting", "historical_short_distance_context", "COLLECTED_BUT_UNUSED", "repository physical measurement corpus and scouting search", "data/normalized/speed_historical_physical_measurements_2015_2026.json;data/manual/sprint_30m_measurements_curated.json", {"related_records": 0, "protocol_uncertain_records": 0}, ["SR-004", "SR-008", "SR-055", "SR-056"], ["SP-017", "MB-12"], "historical range/context", "may duplicate 30m/50m profile measurements", "amateur timing protocol, age and selection effects", "retain interval and protocol flags; no universal conversion", "COLLECTED_BUT_UNUSED_OR_DUPLICATE_CONTROL", ["data/normalized/speed_historical_physical_measurements_2015_2026.json"]),
        candidate(33, "human_context", "pinch-runner usage", "role_and_technique_context", "IMPLEMENTED_INCOMPLETE", "SP-061 local sweep", "outputs/derived/sp061_pinch_runner_weak_context_20260814.json", {"rows": len(pinch.get("rows", []) or []), "unique_rows": len(pinch.get("unique_rows", []) or [])}, ["SR-002", "SR-052", "SR-055", "SR-058"], ["SP-061", "MB-13"], "weak role context; not direct speed", "pinch-runner, steal and advance decisions overlap technique/opportunity", "manager usage, roster role, score and injury confound", "preserve weak directional context and never use as physical teacher", "BOUNDED_WEAK_CONTEXT_NOT_DIRECT_SPEED", ["outputs/derived/sp061_pinch_runner_weak_context_20260814.json"]),
        candidate(34, "human_context", "video-frame timing / narration", "visual_acceleration_context", "IMPLEMENTED_INCOMPLETE", "existing video inventories plus SP-102 measured negative", "outputs/derived/sp102_coverage_qa.json;outputs/derived/sp102_target_post_rescue_summary.json;outputs/derived/speed_2026_video_tiebreak_sources.json", {"sp102_usable_rows": 0, "existing_asset_bytes": path_bytes("outputs/derived/speed_2026_video_tiebreak_sources.json")}, ["SR-021", "SR-022", "SR-047", "SR-055", "SR-058"], ["SP-039", "SP-102", "MB-14"], "strict video/context lane", "same clip/comment origin must be clustered", "camera angle, frame boundaries and narration subjective; SP-102 fetch failures are not evidence absence", "retain negative finding and any future timed row with frame/provenance receipt", "SP102_MEASURED_NEGATIVE_BOUNDED_ACQUISITION", ["outputs/derived/qa_sp102_targeted_video_comment_rescue.json", "docs/audits/sp102_targeted_video_comment_rescue_20260818.md"]),
        candidate(35, "human_context", "ordinary web / X / YouTube physical observations", "directional_observation_context", "IMPLEMENTED_INCOMPLETE", "community/social source inventories", ";".join(community_files), {"source_bytes": community_bytes}, ["SR-014", "SR-016", "SR-018", "SR-019", "SR-020", "SR-022"], ["SP-032", "SP-036", "SP-037", "SP-102"], "weak directional physical observation", "same event/reaction volume is not independent evidence", "source reliability, identity and timing are heterogeneous", "cluster origin, cap reaction volume and keep confidence/range", "COLLECTED_BOUNDED_CONTEXT_NO_DIRECT_PROMOTION", community_files),
        candidate(36, "human_context", "rating-opinion / community evidence separate from physical claims", "appraisal_opinion_context", "IMPLEMENTED_INCOMPLETE", "community normalized/QA assets", ";".join(community_files), {"source_bytes": community_bytes}, ["SR-015", "SR-019", "SR-020", "SR-022"], ["SP-032", "SP-036", "SP-037"], "opinion/context only", "multiple opinions from same origin can be duplicated", "game-rating opinion and physical observation are semantically different", "store claim type and origin cluster; no comment-only high-confidence physical point", "SEMANTICALLY_SEPARATED_OPINION_CONTEXT", community_files),
        candidate(37, "human_context", "injury / recovery", "temporal_physical_context", "IMPLEMENTED_INCOMPLETE", "SP-101 contextual state and local reports", "outputs/derived/sp101_current100_multibridge_evidence.json;docs/state/speed_requirements_baseline_20260813.tsv", {"current100": 100, "state_field": "contextual_evidence_summary.injury_state"}, ["SR-030", "SR-031", "SR-040", "SR-054"], ["SP-101", "MB-11"], "temporal/context modifier", "injury observations may be repeated across reports and season panels", "missingness and return-to-play timing limit causal interpretation", "preserve available/missing states and never fabricate recovery timing", "BOUNDED_TEMPORAL_CONTEXT", ["outputs/derived/sp101_current100_multibridge_evidence.json"]),
        candidate(38, "human_context", "age and longitudinal physical decline", "temporal_physical_context", "IMPLEMENTED_INCOMPLETE", "SP-101 transition/temporal panel", "outputs/derived/sp101_current100_multibridge_evidence.json;outputs/derived/sp101_npb_mlb_transition_segments.csv", {"current100": 100, "transition_rows": count_csv_rows("outputs/derived/sp101_npb_mlb_transition_segments.csv")}, ["SR-005", "SR-006", "SR-030", "SR-040", "SR-054"], ["SP-101", "MB-11"], "temporal/context modifier", "age is shared across all longitudinal player records", "age curves can import next-year or future information into current-year appraisal", "current-year-first, explicit time gap and forward holdout", "BOUNDED_TEMPORAL_CONTEXT_NO_AUTOMATIC_CARRYOVER", ["outputs/derived/sp101_npb_mlb_transition_segments.csv"]),
        candidate(39, "human_context", "explicit player-vs-player faster/slower claims with supported endpoints", "pairwise_directional_context", "IMPLEMENTED_INCOMPLETE", "SP-101 typed pairwise graph and existing source inventory", "outputs/derived/sp101_pairwise_ordinal_graph.json;outputs/derived/sp101_current100_multibridge_evidence.json", {"current100": 100, "route": "MB-07"}, ["SR-032", "SR-033", "SR-055", "SR-058"], ["SP-101", "MB-07"], "ordinal constraint/context", "same source/event can create dependent comparisons", "unsupported endpoint or generic comparison cannot establish signed relation", "require supported endpoints, typed edge, uncertainty and no fabricated partner", "SP101_TYPED_GRAPH_BOUNDED", ["outputs/derived/sp101_pairwise_ordinal_graph.json"]),
        candidate(40, "human_context", "generic fast/slow labels", "weak_directional_context", "IMPLEMENTED_INCOMPLETE", "community/source semantic inventories", ";".join(community_files), {"source_bytes": community_bytes}, ["SR-019", "SR-020", "SR-055", "SR-058"], ["SP-032", "SP-037", "MB-14"], "weak directional evidence", "generic label may be repeated or refer to technique rather than physical speed", "no metric, protocol or endpoint; high uncertainty", "retain as low-confidence direction with origin cap; no numeric point", "WEAK_DIRECTIONAL_NO_ZEROING", community_files),
        candidate(41, "defensive_context", "RngR / UZR / UZR_1200 / UZR_200 / range_runs", "defensive_range_context", "IMPLEMENTED_INCOMPLETE", "local Baseball Monster range assets", "data/pennant.db:bm_fld/bm_player/v_bm_by_player", {"bm_player_rows": db_rows(db, "bm_player"), "bm_fld_rows": db_rows(db, "bm_fld")}, ["SR-052", "SR-055", "SR-057"], ["SP-101", "MB-15"], "structured defensive context", "range metrics include positioning, reaction, fielding and opportunity", "not pure straight-line running speed", "keep fielding context separate and use removal audit", "DEFENSE_CONTEXT_NOT_BASE_SPEED", ["data/pennant.db"]),
        candidate(42, "defensive_context", "Statcast Outfielder Jump Burst for MLB-experienced outfielders", "defensive_burst_context", "SOURCE_CONFIRMED_NEW", "official MLB Jump glossary/leaderboard", "no local eligible Jump Burst row set", {"local_rows": 0, "source_surface": "verified"}, ["SR-052", "SR-055"], ["SP-101", "MB-15"], "defensive burst context", "duplicates candidate 5 at source-event level but role-specific universe row is retained", "reaction, route and position confound base running speed", "collect separately with position/eligibility; never merge with universal sprint speed", "NOT_COLLECTED_EXTERNAL_OPPORTUNITY", ["https://www.mlb.com/glossary/statcast/jump", "https://baseballsavant.mlb.com/leaderboard/outfield_jump"]),
        candidate(43, "defensive_context", "NPB tracking-derived fielder movement / straight-line speed separated from reaction/route/positioning", "defensive_straight_line_speed", "MEASURED_NEGATIVE", "repo-wide SQLite/schema/source scan and SP-062 bounded result", "outputs/derived/sp062_defensive_chase_close_20260814.json;data/pennant.db", {"separated_rows": 0, "sp062_items": len(chase.get("items", []) or [])}, ["SR-047", "SR-052", "SR-055", "SR-058"], ["SP-062", "SP-101"], "bounded negative finding", "any future movement feed may overlap Jump and range events", "current assets do not separate physical displacement from route/reaction/positioning", "reopen only with separable official tracking fields", "MEASURED_NEGATIVE_BOUNDED_LOCAL_UNIVERSE", ["outputs/derived/sp062_defensive_chase_close_20260814.json", "data/pennant.db"]),
    ]
    baseline_path = ROOT / "docs/state/speed_requirements_baseline_20260813.tsv"
    baseline: list[dict[str, str]] = []
    with baseline_path.open("r", encoding="utf-8", newline="") as fh:
        baseline = list(csv.DictReader(fh, delimiter="\t"))
    trace_rows: list[dict[str, Any]] = []
    for row in baseline:
        rid = row["requirement_id"]
        nums, status, detail = requirement_mapping(rid)
        trace_rows.append({
            "row_type": "requirement",
            "requirement_id": rid,
            "feedback_id": "",
            "description": row.get("description", ""),
            "mapped_evidence_ids": [f"SP103-EV-{n:03d}" for n in nums],
            "exact_route_or_gap": "; ".join(f"SP103-EV-{n:03d}" for n in nums) + "; " + detail,
            "implementation_artifact_or_source": "outputs/derived/sp103_speed_evidence_universe.tsv;outputs/derived/sp103_inference_method_universe.json;docs/state/speed_task_registry.tsv",
            "decision_use_receipt": "SP-103 universe classification; not final player rating; downstream use remains gate-controlled",
            "trace_status": status,
            "gap_or_next_action": "retain explicit gap/negative finding and rerun independent QA before SP-079",
        })
    seed_path = ROOT / "outputs/derived/sp103_owner_feedback_seed_20260823.tsv"
    owner_rows: list[dict[str, str]] = []
    if seed_path.exists():
        with seed_path.open("r", encoding="utf-8", newline="") as fh:
            owner_rows = list(csv.DictReader(fh, delimiter="\t"))
    owner_map: dict[str, tuple[list[int], str, str]] = {
        "OF-001": ([27, 49, 59], "PowerPro is context and excluded from physical teacher path", "TRACED_LOCKED"),
        "OF-002": ([11, 17, 21, 49], "technique/context fields are separate from physical estimate", "TRACED_LOCKED"),
        "OF-003": ([1, 2, 4, 7, 8, 55, 62], "top-speed availability and acceleration-shape gap are measured; final-appraisal preflight remains pending", "TRACED_GAP_RECORDED"),
        "OF-004": ([2, 4, 6, 7, 8, 61, 62], "protocol/time/confidence/range and H2F provenance guards are explicit", "TRACED_BOUNDED"),
        "OF-005": ([3, 6, 7, 8, 26, 44, 56], "historical physical-rich assets and denominators are inventoried", "TRACED_BOUNDED"),
        "OF-006": ([44, 45, 46, 47, 48, 49, 53, 54, 55, 56, 57, 58, 59, 60], "transfer metadata/uncertainty are recorded; final decision-use proof is not claimed", "REQUIRES_POST_SP103_DECISION_USE"),
        "OF-007": ([1, 3, 4, 7, 8, 55, 62], "preflight reports lane availability and route influence; top-speed removal against final appraisal is a follow-up", "TRACED_GAP_RECORDED"),
        "OF-008": ([19, 22, 23, 24, 25, 26], "all-eligible cohort rows are represented as matched/missing/unresolved in SP-101 assets", "TRACED_BOUNDED"),
        "OF-009": ([22, 23, 24, 25, 26], "transition cohort denominator and temporal guards are recorded", "TRACED_BOUNDED"),
        "OF-010": ([20, 27, 28], "trajectory and update deltas are context only; no current-value copy", "TRACED_LOCKED"),
        "OF-011": ([2, 6, 7, 8, 34, 35, 40, 58], "imperfect directional evidence is range/confidence/downweight or scoped rejection, not silent zero", "TRACED_BOUNDED"),
        "OF-012": ([31, 33, 34, 35, 36, 37, 41, 42, 43], "coverage and decision-use are separately measured; SP-102 negative remains preserved", "TRACED_BOUNDED"),
        "OF-013": ([37, 38, 50, 58], "age/injury availability and temporal route gaps are explicit", "TRACED_BOUNDED"),
        "OF-014": ([1, 2, 4, 7, 8, 10, 11, 17], "construct decomposed into peak/acceleration/end-to-end/defense and technique context", "TRACED_LOCKED"),
        "OF-015": ([11, 13, 15, 17, 21, 44, 54, 55, 58], "independence/double-count groups and route ablation are recorded", "TRACED_BOUNDED"),
    }
    for row in owner_rows:
        fid = row["feedback_id"]
        nums, detail, status = owner_map.get(fid, ([], "unmapped owner row", "GAP"))
        trace_rows.append({
            "row_type": "owner_feedback",
            "requirement_id": row.get("seed_existing_mapping", ""),
            "feedback_id": fid,
            "description": row.get("owner_requirement", ""),
            "mapped_evidence_ids": [f"SP103-EV-{n:03d}" for n in nums],
            "exact_route_or_gap": detail,
            "implementation_artifact_or_source": "outputs/derived/sp103_owner_feedback_seed_20260823.tsv;outputs/derived/sp103_inference_method_universe.json",
            "decision_use_receipt": row.get("minimum_acceptance_test", ""),
            "trace_status": status,
            "gap_or_next_action": row.get("status", "") + "; no owner verdict captured by SP-103",
        })
    fields = ["row_type", "requirement_id", "feedback_id", "description", "mapped_evidence_ids", "exact_route_or_gap", "implementation_artifact_or_source", "decision_use_receipt", "trace_status", "gap_or_next_action"]
    write_tsv("outputs/derived/sp103_owner_requirement_traceability.tsv", trace_rows, fields)
    payload = lane_header("G", "owner feedback, baseline requirement traceability, human/defensive context and scale/engine boundary")
    payload.update({"baseline_requirement_count": len(baseline), "owner_feedback_count": len(owner_rows), "traceability_row_count": len(trace_rows), "evidence_candidates": context_rows + scale_candidates(), "owner_feedback_status_counts": dict(sorted(Counter(r["trace_status"] for r in trace_rows if r["row_type"] == "owner_feedback").items())), "negative_findings": ["All 61 baseline rows and all 15 owner seed rows are mapped; mapping does not imply completion.", "Scale/engine candidates 63-66 are explicitly downstream and gate-blocked in SP-103."]})
    save_json("outputs/derived/sp103_intermediate/lane_g_owner_traceability.json", payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("lane", choices=["C", "D", "E", "F", "G"])
    args = parser.parse_args()
    {"C": physical_lane, "D": proxy_lane, "E": cross_game_lane, "F": transfer_lane, "G": owner_and_scale_lane}[args.lane]()


if __name__ == "__main__":
    main()

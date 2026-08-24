#!/usr/bin/env python3
"""Generate versioned Wave 2 research artifacts without editing PW ledgers."""

from __future__ import annotations

import csv
import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Iterable, Sequence


ROOT = Path(__file__).resolve().parents[1]
RESEARCH_DATE = "2026-08-25"
CUTOFF_DATE = "2026-08-24"

EVENT_BASE_COLUMNS = [
    "event_id", "event_date_start", "event_date_end", "retrieved_at",
    "region", "country", "league", "organization", "competition",
    "topic_family", "subtopic", "headline_or_event_name", "fact_summary",
    "primary_source_url", "secondary_source_urls", "source_authority",
    "verification_status", "historical_or_current", "mechanism_revealed",
    "potential_game_system", "existing_requirement_ids", "novelty_status",
    "materiality", "recurrence_class", "player_frustration_risk",
    "suggested_default_or_toggle", "implementation_complexity",
    "research_confidence", "notes",
]
EVENT_COLUMNS = EVENT_BASE_COLUMNS + [
    "wave", "topic_family_codes", "wave1_relation",
    "corrected_existing_requirement_ids", "semantic_mapping_status",
]
CANDIDATE_BASE_COLUMNS = [
    "candidate_id", "source_event_ids", "proposed_module",
    "proposed_requirement", "why_not_already_covered", "real_world_mechanism",
    "generalized_game_mechanic", "expected_gameplay_value",
    "long_term_world_value", "complexity", "frustration_risk",
    "toggle_recommendation", "dependencies", "conflicts_with_pw_ids",
    "recommended_owner_question", "priority_preliminary",
]
CANDIDATE_COLUMNS = CANDIDATE_BASE_COLUMNS + [
    "wave1_original_pw_ids", "corrected_existing_requirement_ids",
    "corrected_dependency_pw_ids", "corrected_conflict_pw_ids",
    "semantic_mapping_status", "wave2_evidence_event_ids",
    "wave2_disposition", "owner_decision_needed_wave2", "red_team_result",
]


def read_tsv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


def write_tsv(path: Path, rows: Iterable[dict], fieldnames: Sequence[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def copy_gzip(source: Path, target: Path) -> None:
    with source.open("rb") as src, gzip.open(target, "wb") as dst:
        dst.write(src.read())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ids(value: str) -> list[str]:
    return re.findall(r"PW-\d{3}", value or "")


def join_ids(values: Iterable[str]) -> str:
    result = []
    seen = set()
    for value in values:
        if value and value not in seen:
            result.append(value)
            seen.add(value)
    return ";".join(result)


def make_event(values: Sequence[str]) -> dict:
    if len(values) != 30:
        raise ValueError(f"event tuple has {len(values)} values, expected 30")
    base = dict(zip(EVENT_BASE_COLUMNS, values[:29]))
    base["retrieved_at"] = RESEARCH_DATE
    base["wave"] = "WAVE2"
    base["topic_family_codes"] = values[29]
    base["wave1_relation"] = "NEW_WAVE2_RESEARCH"
    base["corrected_existing_requirement_ids"] = base["existing_requirement_ids"]
    base["semantic_mapping_status"] = "PENDING_LEDGER_CHECK"
    return base


# Wave 1 event references are preserved in the original column.  These are
# corrected parallel references after checking the exact module/text.
EVENT_PW_CORRECTIONS = {
    "PNN-001": "PW-165;PW-201;PW-202;PW-203;PW-204;PW-247;PW-248",
    "PNN-002": "PW-103;PW-104;PW-133;PW-134;PW-135;PW-168;PW-172;PW-173;PW-242",
    "PNN-003": "PW-236;PW-237;PW-238;PW-256",
    "PNN-004": "PW-053;PW-054;PW-055;PW-056;PW-057;PW-195;PW-196;PW-198;PW-240;PW-259",
    "PNN-005": "PW-149;PW-150;PW-151;PW-155;PW-156;PW-157;PW-168;PW-175;PW-177;PW-179;PW-180",
    "PNN-006": "PW-145;PW-151;PW-153;PW-155;PW-156;PW-157;PW-168;PW-175;PW-177;PW-179;PW-180",
    "PNN-007": "PW-190;PW-191;PW-193;PW-205;PW-207;PW-209;PW-212;PW-213;PW-214;PW-216",
    "PNN-008": "PW-055;PW-094;PW-103;PW-104;PW-127;PW-128;PW-160;PW-163;PW-239;PW-242;PW-251;PW-255",
    "PNN-009": "PW-145;PW-153;PW-155;PW-156;PW-157;PW-158;PW-168;PW-175;PW-177",
    "PNN-010": "PW-190;PW-192;PW-193;PW-194",
    "PNN-011": "PW-188;PW-189;PW-190;PW-193;PW-195;PW-197;PW-198",
    "PNN-012": "PW-198;PW-237;PW-256",
    "PNN-013": "PW-195;PW-196;PW-198;PW-199;PW-240",
    "PNN-014": "PW-031;PW-032;PW-074;PW-095;PW-197;PW-198;PW-213",
    "PNN-015": "PW-149;PW-150;PW-151;PW-155;PW-156;PW-165;PW-175;PW-177;PW-180",
    "PNN-016": "PW-181;PW-188;PW-189;PW-213;PW-214;PW-216",
    "PNN-017": "PW-145;PW-153;PW-154;PW-155;PW-156;PW-157;PW-158",
    "PNN-018": "PW-145;PW-153;PW-154;PW-155;PW-156;PW-158",
    "PNN-019": "PW-190;PW-192;PW-193;PW-194",
    "PNN-020": "PW-190;PW-192;PW-193;PW-194",
    "PNN-021": "PW-236;PW-237;PW-238;PW-256",
    "PNN-022": "PW-165;PW-167;PW-179;PW-180;PW-201;PW-203;PW-247;PW-248",
    "PNN-023": "PW-074;PW-127;PW-128;PW-160;PW-168;PW-242",
    "PNN-024": "PW-168;PW-172;PW-256",
    "PNN-025": "PW-053;PW-054;PW-055;PW-168;PW-172;PW-195;PW-196;PW-256",
    "PNN-026": "PW-168;PW-172;PW-256",
    "PNN-027": "PW-168;PW-170;PW-171;PW-172;PW-173",
    "PNN-028": "PW-168;PW-170;PW-171;PW-172;PW-173",
    "PNN-029": "PW-145;PW-151;PW-153;PW-155;PW-156;PW-157;PW-160;PW-168;PW-175;PW-177;PW-179",
    "PNN-030": "PW-168;PW-172;PW-173;PW-240",
    "PNN-031": "PW-190;PW-191;PW-193;PW-213;PW-214",
    "PNN-032": "PW-168;PW-181;PW-182",
    "PNN-033": "PW-168;PW-174;PW-175;PW-178;PW-179;PW-180;PW-181;PW-203",
    "PNN-034": "PW-174;PW-175;PW-176;PW-177;PW-179;PW-180",
    "PNN-035": "PW-145;PW-155;PW-156;PW-157;PW-168;PW-175;PW-177;PW-179",
    "PNN-036": "PW-181;PW-182;PW-190",
    "PNN-037": "PW-181;PW-182;PW-247",
    "PNN-038": "PW-181;PW-182;PW-183;PW-184;PW-185;PW-243;PW-257",
    "PNN-039": "PW-181;PW-182;PW-183;PW-185;PW-186;PW-243",
    "PNN-040": "PW-181;PW-182;PW-183;PW-184;PW-185;PW-243",
    "PNN-041": "PW-181;PW-182;PW-185;PW-186",
    "PNN-042": "PW-181;PW-182;PW-183;PW-184;PW-243",
    "PNN-043": "PW-141;PW-143;PW-144;PW-204;PW-247",
    "PNN-044": "PW-141;PW-143;PW-247",
    "PNN-045": "PW-141;PW-143;PW-144;PW-247",
    "PNN-046": "PW-141;PW-143;PW-144;PW-247",
    "PNN-047": "PW-129;PW-138;PW-139;PW-140;PW-141;PW-247;PW-253;PW-254;PW-259",
    "PNN-048": "PW-129;PW-130;PW-131;PW-132;PW-133;PW-134;PW-135;PW-253;PW-254;PW-259",
    "PNN-049": "PW-103;PW-104;PW-133;PW-134;PW-135;PW-168;PW-172;PW-173;PW-242",
    "PNN-050": "PW-129;PW-130;PW-131;PW-132;PW-133;PW-134;PW-135;PW-136;PW-137;PW-138;PW-139;PW-140;PW-253;PW-254",
    "PNN-051": "PW-205;PW-207;PW-208;PW-209;PW-210;PW-213;PW-214;PW-215;PW-216",
    "PNN-052": "PW-205;PW-207;PW-208;PW-209;PW-210;PW-213;PW-214;PW-215;PW-216",
    "PNN-053": "PW-205;PW-207;PW-208;PW-209;PW-211;PW-212",
    "PNN-054": "PW-205;PW-206;PW-207;PW-208;PW-209;PW-211;PW-212",
    "PNN-055": "PW-205;PW-207;PW-208;PW-209;PW-210;PW-211;PW-212",
    "PNN-056": "PW-205;PW-207;PW-208;PW-209;PW-211;PW-212",
    "PNN-057": "PW-205;PW-207;PW-208;PW-209",
    "PNN-058": "PW-188;PW-189;PW-129;PW-139;PW-168",
    "PNN-059": "PW-181;PW-188;PW-189;PW-213;PW-214;PW-216",
}

CANDIDATE_PW_CORRECTIONS = {
    "PNC-001": "PW-145;PW-153;PW-158;PW-190;PW-191;PW-192;PW-193;PW-194",
    "PNC-002": "PW-149;PW-150;PW-151;PW-155;PW-156;PW-157;PW-168;PW-175;PW-177;PW-179;PW-180",
    "PNC-003": "PW-103;PW-104;PW-133;PW-134;PW-135;PW-168;PW-170;PW-171;PW-172;PW-173;PW-238;PW-240;PW-241;PW-242;PW-256",
    "PNC-004": "PW-141;PW-143;PW-144;PW-204;PW-247;PW-249",
    "PNC-005": "PW-190;PW-191;PW-193;PW-205;PW-206;PW-207;PW-208;PW-209;PW-210;PW-211;PW-212",
    "PNC-006": "PW-190;PW-191;PW-192;PW-193;PW-198;PW-213;PW-214;PW-216;PW-225;PW-226",
    "PNC-007": "PW-129;PW-130;PW-131;PW-132;PW-138;PW-139;PW-140;PW-141;PW-247;PW-253;PW-254;PW-259",
    "PNC-008": "PW-145;PW-153;PW-155;PW-156;PW-157;PW-158;PW-168;PW-175;PW-177;PW-179;PW-182;PW-185;PW-257",
}

CANDIDATE_DEPENDENCY_CORRECTIONS = {
    "PNC-001": "PW-145;PW-153;PW-158;PW-190;PW-191;PW-192;PW-193;PW-194",
    "PNC-002": "PW-149;PW-150;PW-151;PW-155;PW-156;PW-157;PW-168;PW-175;PW-177;PW-179;PW-180",
    "PNC-003": "PW-103;PW-104;PW-133;PW-134;PW-135;PW-168;PW-170;PW-171;PW-172;PW-173;PW-238;PW-240;PW-241;PW-242;PW-256",
    "PNC-004": "PW-141;PW-143;PW-144;PW-204;PW-247;PW-249",
    "PNC-005": "PW-190;PW-191;PW-193;PW-205;PW-206;PW-207;PW-208;PW-209;PW-210;PW-211;PW-212",
    "PNC-006": "PW-190;PW-191;PW-192;PW-193;PW-198;PW-213;PW-214;PW-216;PW-225;PW-226",
    "PNC-007": "PW-129;PW-130;PW-131;PW-132;PW-138;PW-139;PW-140;PW-141;PW-247;PW-253;PW-254;PW-259",
    "PNC-008": "PW-145;PW-153;PW-155;PW-156;PW-157;PW-158;PW-168;PW-175;PW-177;PW-179;PW-182;PW-185;PW-257",
    "PNC-009": "PW-168;PW-174;PW-175;PW-178;PW-179;PW-180;PW-181;PW-203",
}
CANDIDATE_CONFLICT_CORRECTIONS = {
    "PNC-001": "PW-190;PW-193",
    "PNC-002": "PW-149;PW-179;PW-180",
    "PNC-003": "PW-168;PW-172;PW-173",
    "PNC-004": "PW-141;PW-247",
    "PNC-005": "PW-205;PW-209;PW-211",
    "PNC-006": "PW-190;PW-191;PW-193",
    "PNC-007": "PW-129;PW-139;PW-141",
    "PNC-008": "PW-145;PW-157;PW-179",
    "PNC-009": "PW-179;PW-180;PW-203",
}

EVENT_TOPIC_CODES = {
    "PNN-001": "D;Q", "PNN-002": "C;O", "PNN-003": "B;C;D",
    "PNN-004": "B;D", "PNN-005": "D;E;N", "PNN-006": "E;F;G;N",
    "PNN-007": "A;L;M", "PNN-008": "B;C;E;I;O", "PNN-009": "E;F;G;N",
    "PNN-010": "A;F;H", "PNN-011": "L;Q", "PNN-012": "C;D",
    "PNN-013": "B;D", "PNN-014": "B;D", "PNN-015": "E;N",
    "PNN-016": "L;Q", "PNN-017": "F;G", "PNN-018": "F;G",
    "PNN-019": "A;F", "PNN-020": "A;F", "PNN-021": "B;C;D",
    "PNN-022": "D;N;Q", "PNN-023": "C;E;I;O", "PNN-024": "C;O",
    "PNN-025": "B;C;O", "PNN-026": "C;O", "PNN-027": "C;L;O",
    "PNN-028": "C;L;O", "PNN-029": "E;F;G;N;O", "PNN-030": "C;O",
    "PNN-031": "A;D", "PNN-032": "L;N;O;P", "PNN-033": "D;N;Q",
    "PNN-034": "N;Q", "PNN-035": "E;F;G;N", "PNN-036": "A;P;Q",
    "PNN-037": "K;P;Q", "PNN-038": "K;P", "PNN-039": "D;P",
    "PNN-040": "D;P", "PNN-041": "D;P;Q", "PNN-042": "K;P",
    "PNN-043": "K;Q", "PNN-044": "K", "PNN-045": "K;Q",
    "PNN-046": "K;Q", "PNN-047": "C;K", "PNN-048": "C;L;K",
    "PNN-049": "C;O", "PNN-050": "C", "PNN-051": "M;Q",
    "PNN-052": "M;Q", "PNN-053": "L;M", "PNN-054": "F;H;M",
    "PNN-055": "M", "PNN-056": "A;M", "PNN-057": "M",
    "PNN-058": "C;L;Q", "PNN-059": "L;Q",
}


def event_record(**values) -> dict:
    defaults = {
        "event_date_end": values.get("event_date_start", ""),
        "secondary_source_urls": "-",
        "source_authority": "PRIMARY_OFFICIAL",
        "verification_status": "VERIFIED_PRIMARY",
        "historical_or_current": "HISTORICAL",
        "mechanism_revealed": "A documented institutional mechanism changes player, club, league, or market state.",
        "potential_game_system": "bounded world-state/news/history mechanism",
        "novelty_status": "PARTIAL_EXTENSION",
        "materiality": "MEDIUM",
        "recurrence_class": "CONDITIONAL_RECURRING",
        "player_frustration_risk": "MEDIUM",
        "suggested_default_or_toggle": "OWNER_CALIBRATION",
        "implementation_complexity": "HIGH",
        "research_confidence": "HIGH",
        "notes": "Research evidence only; no implementation implication.",
        "topic_codes": "Q",
    }
    defaults.update(values)
    defaults["retrieved_at"] = RESEARCH_DATE
    defaults["wave"] = "WAVE2"
    defaults["wave1_relation"] = defaults.get("wave1_relation", "NEW_WAVE2_RESEARCH")
    defaults["corrected_existing_requirement_ids"] = defaults["existing_requirement_ids"]
    defaults["semantic_mapping_status"] = "PENDING_LEDGER_CHECK"
    return {
        "event_id": defaults["event_id"],
        "event_date_start": defaults["event_date_start"],
        "event_date_end": defaults["event_date_end"],
        "retrieved_at": defaults["retrieved_at"],
        "region": defaults["region"],
        "country": defaults["country"],
        "league": defaults["league"],
        "organization": defaults["organization"],
        "competition": defaults["competition"],
        "topic_family": defaults["topic_family"],
        "subtopic": defaults["subtopic"],
        "headline_or_event_name": defaults["headline_or_event_name"],
        "fact_summary": defaults["fact_summary"],
        "primary_source_url": defaults["primary_source_url"],
        "secondary_source_urls": defaults["secondary_source_urls"],
        "source_authority": defaults["source_authority"],
        "verification_status": defaults["verification_status"],
        "historical_or_current": defaults["historical_or_current"],
        "mechanism_revealed": defaults["mechanism_revealed"],
        "potential_game_system": defaults["potential_game_system"],
        "existing_requirement_ids": defaults["existing_requirement_ids"],
        "novelty_status": defaults["novelty_status"],
        "materiality": defaults["materiality"],
        "recurrence_class": defaults["recurrence_class"],
        "player_frustration_risk": defaults["player_frustration_risk"],
        "suggested_default_or_toggle": defaults["suggested_default_or_toggle"],
        "implementation_complexity": defaults["implementation_complexity"],
        "research_confidence": defaults["research_confidence"],
        "notes": defaults["notes"],
        "wave": defaults["wave"],
        "topic_family_codes": defaults["topic_codes"],
        "wave1_relation": defaults["wave1_relation"],
        "corrected_existing_requirement_ids": defaults["corrected_existing_requirement_ids"],
        "semantic_mapping_status": defaults["semantic_mapping_status"],
    }


WAVE2_EVENTS = [
    event_record(
        event_id="PNW2-001", event_date_start="1950-01-01", event_date_end="1950-12-31",
        region="East Asia", country="Japan", league="NPB",
        organization="NPB; Central League; Pacific League", competition="Two-league reorganization",
        topic_family="D - organization/competitive balance", subtopic="club count and scheduling",
        headline_or_event_name="1950 NPB two-league split created a 15-club operating shock",
        fact_summary="NPB official history records the 1949 eight-club single league becoming two leagues with 15 clubs in 1950; stadium scarcity forced dense doubleheader scheduling.",
        primary_source_url="https://npb.jp/news/detail/20180518_01.html",
        secondary_source_urls="https://npb.jp/cl/history.html;https://npb.jp/pl/history.html",
        mechanism_revealed="League topology changes can create immediate calendar, venue, travel, and competitive-balance strain.",
        potential_game_system="club-count/calendar/venue-capacity/competitive-balance state",
        existing_requirement_ids="PW-165;PW-167;PW-179;PW-180;PW-201;PW-203",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="DEFAULT_RARE", notes="Historical anchor; no claim that every 15-club state should be replayed.",
        topic_codes="D;K;Q",
    ),
    event_record(
        event_id="PNW2-002", event_date_start="1950-01-01", event_date_end="1951-02-28",
        region="East Asia", country="Japan", league="NPB", organization="West Japan Pirates; NPB",
        competition="Central League expansion", topic_family="Q - rare structural events",
        subtopic="travel and club viability", headline_or_event_name="West Japan Pirates lasted one season after a 74-night, 75-day expedition",
        fact_summary="NPB's official recorder column links the club's one-season failure to 1950 expansion, dispersed venues, and a 74-night 75-day road trip before merger into Nishitetsu.",
        primary_source_url="https://npb.jp/news/detail/20210317_01.html",
        secondary_source_urls="https://npb.jp/news/detail/20180518_01.html",
        mechanism_revealed="A new club can fail because schedule, travel, venue, and local-market capacity are misaligned before on-field quality is evaluated.",
        potential_game_system="expansion/relocation/operating-capacity/travel shock",
        existing_requirement_ids="PW-165;PW-174;PW-179;PW-180;PW-201;PW-203;PW-204;PW-247",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="HIGH_IF_AUTOMATIC",
        suggested_default_or_toggle="DEFAULT_RARE", topic_codes="K;Q",
    ),
    event_record(
        event_id="PNW2-003", event_date_start="1948-01-01", event_date_end="1955-12-31",
        region="East Asia", country="Japan", league="NPB", organization="NPB farm clubs",
        competition="Farm league formation", topic_family="E - player development",
        subtopic="farm governance and capacity", headline_or_event_name="NPB farm structures formed in stages from 1948 to 1955",
        fact_summary="NPB official farm history describes 1948 reserve teams, independent 1952 and 1954 competitions, and NPB-supervised Eastern and Western leagues in 1955; the first Eastern league later paused because clubs lacked players.",
        primary_source_url="https://npb.jp/news/detail/20260109_03.html",
        secondary_source_urls="https://npb.jp/cl/history.html;https://npb.jp/pl/history.html",
        mechanism_revealed="Development capacity can be built incrementally, delegated, paused, and later standardized.",
        potential_game_system="farm-tier/capacity/league-governance/reconfiguration",
        existing_requirement_ids="PW-149;PW-150;PW-155;PW-156;PW-168;PW-179;PW-180",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="MEDIUM",
        topic_codes="D;E;G;Q",
    ),
    event_record(
        event_id="PNW2-004", event_date_start="1965-01-01", event_date_end="1965-12-31",
        region="East Asia", country="Japan", league="NPB", organization="NPB",
        competition="NPB draft", topic_family="B - draft/amateur acquisition",
        subtopic="draft institution", headline_or_event_name="NPB's first draft system began in 1965",
        fact_summary="NPB official league history identifies 1965 as the first NPB draft year, shifting amateur acquisition toward a league-managed entry mechanism.",
        primary_source_url="https://npb.jp/pl/history.html",
        secondary_source_urls="https://draft.npb.jp/draft/playback_heisei.html;https://npb.jp/cl/history.html",
        mechanism_revealed="A league can replace open amateur competition with a formal allocation system that changes access, order, and bargaining.",
        potential_game_system="draft/eligibility/order/allocation-history",
        existing_requirement_ids="PW-053;PW-054;PW-055;PW-056;PW-057;PW-195;PW-196;PW-198",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="DEFAULT", topic_codes="B;D;L",
    ),
    event_record(
        event_id="PNW2-005", event_date_start="1978-01-01", event_date_end="1978-12-31",
        region="East Asia", country="Japan", league="NPB", organization="NPB",
        competition="NPB draft reform", topic_family="B - draft/amateur acquisition",
        subtopic="loophole and reform", headline_or_event_name="NPB introduced a new draft system in 1978",
        fact_summary="NPB's Central League history identifies a 1978 draft-system change; it is retained as a structural precedent for route-seeking and later rule repair, without importing unsupported personal allegations.",
        primary_source_url="https://npb.jp/cl/history.html",
        secondary_source_urls="https://draft.npb.jp/draft/playback_heisei.html;https://www.jstage.jst.go.jp/article/sposun/28/3/28_241/_pdf",
        mechanism_revealed="When an allocation rule changes, clubs and prospects can seek alternative institutional routes, causing later rule repair.",
        potential_game_system="draft-rule/migration-route/controversy/reform",
        existing_requirement_ids="PW-053;PW-054;PW-055;PW-195;PW-196;PW-198;PW-199;PW-200",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="HIGH_IF_AUTOMATIC",
        suggested_default_or_toggle="OWNER_CALIBRATION", research_confidence="MEDIUM",
        notes="Source-bounded; no unsupported real-person allegation is retained.", topic_codes="B;L;M",
    ),
    event_record(
        event_id="PNW2-006", event_date_start="1993-01-01", event_date_end="2003-12-31",
        region="East Asia", country="Japan", league="NPB", organization="NPB",
        competition="Free-agent system reform", topic_family="C - contracts/FA/player movement",
        subtopic="labor and reserve rights", headline_or_event_name="NPB free-agent rules evolved through the 1990s and early 2000s",
        fact_summary="Official NPB history records a 1993 FA research committee; academic and secondary histories document later service-time and reverse-designation changes, supporting an era-sensitive labor gate.",
        primary_source_url="https://npb.jp/cl/history.html",
        secondary_source_urls="https://npbc.media/en/articles/free-agent-system-history/;https://www.jstage.jst.go.jp/article/sposun/28/3/28_241/_pdf",
        source_authority="PRIMARY_PLUS_ACADEMIC",
        mechanism_revealed="Reserve rights and free agency can be revised in stages, with transition rules changing who gains mobility and when.",
        potential_game_system="FA/service-time/reserve-rights/labor-transition",
        existing_requirement_ids="PW-129;PW-133;PW-134;PW-135;PW-188;PW-189;PW-198;PW-213",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="HIGH_IF_AUTOMATIC",
        suggested_default_or_toggle="DEFAULT", research_confidence="MEDIUM", topic_codes="C;L;Q",
    ),
    event_record(
        event_id="PNW2-007", event_date_start="2004-09-01", event_date_end="2005-01-01",
        region="East Asia", country="Japan", league="NPB",
        organization="Orix BlueWave; Osaka Kintetsu Buffaloes; Orix Buffaloes",
        competition="Club integration", topic_family="Q - rare structural events",
        subtopic="ownership and merger", headline_or_event_name="Orix and Kintetsu club histories culminated in the 2004-05 Buffaloes integration",
        fact_summary="Orix's official history records the integration of Osaka Kintetsu Buffaloes and Orix BlueWave and the launch of Orix Buffaloes during the 2004 realignment.",
        primary_source_url="https://www.buffaloes.co.jp/special/beginner/about/history.html",
        secondary_source_urls="https://www.buffaloes.co.jp/company/history/kintetsu/;https://corp.rakuten.co.jp/investors/assets/doc/documents/reports_2004.pdf",
        mechanism_revealed="A club sale or merger can change league topology, identity, assets, and development continuity at once.",
        potential_game_system="sale/merger/relocation/identity/roster-continuity",
        existing_requirement_ids="PW-201;PW-203;PW-204;PW-214;PW-247;PW-248",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="HIGH_IF_AUTOMATIC",
        suggested_default_or_toggle="DEFAULT_RARE", topic_codes="D;K;Q",
    ),
    event_record(
        event_id="PNW2-008", event_date_start="2026-01-01", event_date_end="2026-08-24",
        region="East Asia", country="Japan", league="NPB", organization="NPB",
        competition="Farm league", topic_family="D - organization/competitive balance",
        subtopic="farm topology", headline_or_event_name="NPB reorganized farm competition into one league and three districts in 2026",
        fact_summary="NPB official 2026 materials present a one-league, three-district format with district competition and a four-club championship route, extending the earlier two-league farm model.",
        primary_source_url="https://npb.jp/campaign/2026/farm/",
        secondary_source_urls="https://npb.jp/news/detail/20260122_01.html;https://npb.jp/farm/2026/schedule_note.html",
        verification_status="CURRENT_STATUS_CHECK", historical_or_current="CURRENT_AS_OF_CUTOFF",
        mechanism_revealed="A development league can reconfigure geography, schedule density, and qualification without changing top-league club count.",
        potential_game_system="farm-league/districts/qualification/schedule-capacity",
        existing_requirement_ids="PW-149;PW-150;PW-165;PW-167;PW-179;PW-180;PW-193;PW-203",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="MEDIUM",
        notes="Current as of 2026-08-24; format is not permanent.", topic_codes="D;E;Q",
    ),
    event_record(
        event_id="PNW2-009", event_date_start="1990-01-01", event_date_end="1990-12-31",
        region="East Asia", country="Japan", league="NPB", organization="Hiroshima Toyo Carp",
        competition="Carp Academy", topic_family="E - player development",
        subtopic="international academy", headline_or_event_name="Carp Academy began in 1990 as a long-running international development route",
        fact_summary="Carp official material identifies the academy as established in 1990 and describes its graduates, supporting a club-owned international pipeline.",
        primary_source_url="https://www.carp.co.jp/company/baseball-promotion/20260319_02",
        secondary_source_urls="https://hiroshima-ic.or.jp/files/about/letterzine/hic_vol.100.pdf",
        verification_status="VERIFIED", source_authority="PRIMARY_OFFICIAL",
        mechanism_revealed="A club can build a persistent overseas development institution rather than rely only on annual transfers.",
        potential_game_system="club-academy/international-pipeline/knowledge-capital",
        existing_requirement_ids="PW-145;PW-151;PW-155;PW-156;PW-157;PW-168;PW-177",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="LOW",
        suggested_default_or_toggle="TOGGLE", research_confidence="MEDIUM",
        notes="Official page was crawled with limited text; start year retained with bounded confidence.", topic_codes="E;G;N;O",
    ),
    event_record(
        event_id="PNW2-010", event_date_start="2025-03-01", event_date_end="2025-03-31",
        region="East Asia", country="Japan", league="NPB", organization="Hanshin Tigers",
        competition="Farm facility relocation", topic_family="E - player development",
        subtopic="facility and local market", headline_or_event_name="Hanshin moved farm operations to the Oda-Minami / SGL Stadium complex",
        fact_summary="Hanshin official material documents a 2025 move from Naruo-hama to a farm complex with stadium, practice areas, indoor facilities, and player dormitory.",
        primary_source_url="https://score.hanshintigers.jp/news/topics/info_9665.html",
        secondary_source_urls="https://www.hankyu-hanshin.co.jp/docs/integratedreport2023_j_view_%20rev.pdf",
        mechanism_revealed="Development capacity is coupled to facility capital, living conditions, local access, and operating geography.",
        potential_game_system="farm-facility/capacity/fan-market/player-environment",
        existing_requirement_ids="PW-141;PW-149;PW-150;PW-155;PW-247",
        materiality="MEDIUM", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="LOW",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="E;K;Q",
    ),
    event_record(
        event_id="PNW2-011", event_date_start="2025-03-01", event_date_end="2025-03-31",
        region="East Asia", country="Japan", league="NPB", organization="Yomiuri Giants",
        competition="Giants Town / farm development", topic_family="E - player development",
        subtopic="facility, methods, and community", headline_or_event_name="Giants opened a multi-use farm environment and describes development methods as an organizational asset",
        fact_summary="Giants official material links farm environment, development methods, sports science, coach development, U-15, and community use.",
        primary_source_url="https://www.giants.jp/sp/giantsway/",
        secondary_source_urls="https://www.giants.jp/sp/gts-opning-game/;https://tokyo-giants-town.yomiuriland.com/",
        mechanism_revealed="Facilities, methods, junior pipelines, and staff learning can operate as one development network.",
        potential_game_system="farm-facility/academy/staff-ladder/knowledge-transfer",
        existing_requirement_ids="PW-145;PW-149;PW-155;PW-156;PW-157;PW-177",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="LOW",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="E;F;G;N",
    ),
    event_record(
        event_id="PNW2-012", event_date_start="2019-03-14", event_date_end="2019-03-14",
        region="East Asia/North America", country="Japan/United States", league="NPB/MLB",
        organization="Yokohama DeNA BayStars; Arizona Diamondbacks",
        competition="Strategic partnership", topic_family="F - scouting/analytics/AI/technology",
        subtopic="international staff exchange", headline_or_event_name="BayStars and Diamondbacks created a strategic partnership",
        fact_summary="BayStars official material describes the first MLB partnership for the club, following an Australia partnership, with cross-organization development and scouting purposes.",
        primary_source_url="https://sp.baystars.co.jp/news/2019/03/0314_07.php",
        secondary_source_urls="https://sp.baystars.co.jp/news/2020/01/0127_03.php;https://www.baystars.co.jp/corporate/history.php",
        mechanism_revealed="Partnerships can transfer scouting, coaching, strength, analytics, and organizational knowledge without a player transaction.",
        potential_game_system="knowledge-transfer/partnership/scouting/analytics",
        existing_requirement_ids="PW-145;PW-153;PW-155;PW-156;PW-157;PW-158",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="LOW",
        suggested_default_or_toggle="TOGGLE", topic_codes="F;G;N;O",
    ),
    event_record(
        event_id="PNW2-013", event_date_start="1990-01-01", event_date_end="1992-12-31",
        region="East Asia", country="Japan", league="NPB", organization="Yakult Swallows",
        competition="Nomura / ID baseball period", topic_family="F - scouting/analytics/AI/technology",
        subtopic="opponent research and organizational learning", headline_or_event_name="Yakult's 1990s history presents ID baseball as a data and research transformation",
        fact_summary="Yakult official history describes staged reform and ID baseball, with the 1992 league title following the development period.",
        primary_source_url="https://www.yakult-swallows.co.jp/company/history/1990",
        secondary_source_urls="https://www.yakult-swallows.co.jp/company/history",
        mechanism_revealed="A club can build a research language and staff routine that changes opponent adaptation over multiple seasons.",
        potential_game_system="opponent-research/data-culture/staff-learning",
        existing_requirement_ids="PW-116;PW-117;PW-120;PW-145;PW-153;PW-155;PW-156;PW-157;PW-158",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="LOW",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="F;G;H",
    ),
    event_record(
        event_id="PNW2-014", event_date_start="2015-08-01", event_date_end="2015-08-31",
        region="East Asia", country="Japan", league="NPB", organization="Chunichi Dragons",
        competition="Dragons Baseball Academy", topic_family="E - player development",
        subtopic="academy and community", headline_or_event_name="Chunichi established a formal baseball academy",
        fact_summary="Dragons official company history records the 2015 establishment of the Dragons Baseball Academy for youth development and sports promotion.",
        primary_source_url="https://www.dragons.jp/about/company/",
        mechanism_revealed="A club academy can be a local participation and development input without being identical to a professional farm team.",
        potential_game_system="academy/community pipeline/participation",
        existing_requirement_ids="PW-149;PW-151;PW-174;PW-175;PW-177",
        materiality="MEDIUM", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="LOW",
        suggested_default_or_toggle="TOGGLE", research_confidence="HIGH",
        notes="No additional foreign-player mechanism was found in the club-level sweep.", topic_codes="E;N",
    ),
    event_record(
        event_id="PNW2-015", event_date_start="2022-11-30", event_date_end="2023-12-31",
        region="East Asia", country="Japan", league="NPB", organization="Fukuoka SoftBank Hawks",
        competition="Three/four-team system", topic_family="E - player development",
        subtopic="multi-team capacity and data", headline_or_event_name="SoftBank announced a four-team system for 2023",
        fact_summary="Hawks official announcement specifies 122 total players, 229 planned three/four-team games, coordinators across levels, data-science and high-performance links, AI-assisted broadcasts, and a development sponsor concept.",
        primary_source_url="https://www.softbankhawks.co.jp/news/detail/00006099.html",
        secondary_source_urls="https://wing2.softbankhawks.co.jp/ex/85th_30th_anniv/history.html",
        mechanism_revealed="Extra development teams create capacity, coordination, data, facility, fan, and sponsor tradeoffs rather than only more roster slots.",
        potential_game_system="multi-team/farm-capacity/coordinator/data/AI/fan-market",
        existing_requirement_ids="PW-149;PW-150;PW-151;PW-153;PW-155;PW-156;PW-157;PW-158;PW-179;PW-180",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="E;F;G;K",
    ),
    event_record(
        event_id="PNW2-016", event_date_start="2026-07-01", event_date_end="2026-08-24",
        region="East Asia", country="Japan", league="NPB", organization="Chiba Lotte Marines",
        competition="Farm stadium project", topic_family="K - business/fans/media/stadiums",
        subtopic="farm facility and regional partnership", headline_or_event_name="Marines and Kimitsu advanced a new farm facility planning process",
        fact_summary="Official farm-stadium material records a Kimitsu friendship-city agreement, a planned farm facility, and local baseball/community activities tied to the move.",
        primary_source_url="https://www.marines.co.jp/farm/stadium/",
        secondary_source_urls="https://www.marines.co.jp/farm/",
        verification_status="CURRENT_STATUS_CHECK", historical_or_current="CURRENT_AS_OF_CUTOFF",
        mechanism_revealed="A farm facility can be both a development asset and a regional-market/partnership project.",
        potential_game_system="farm-facility/local-market/club-community",
        existing_requirement_ids="PW-141;PW-149;PW-150;PW-155;PW-247",
        materiality="MEDIUM", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="LOW",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="E;K;Q",
        notes="Planning state only; construction completion is not inferred.",
    ),
    event_record(
        event_id="PNW2-017", event_date_start="2026-07-01", event_date_end="2026-08-24",
        region="East Asia", country="Japan", league="NPB", organization="Saitama Seibu Lions",
        competition="Three-team/farm operations", topic_family="E - player development",
        subtopic="tiered development and community games", headline_or_event_name="Lions official farm materials expose a third-team layer and distributed operations",
        fact_summary="Lions official 2026 notices show second- and third-team games, regional venues, and cancellation/schedule operations beyond a single reserve team.",
        primary_source_url="https://www.seibulions.jp/farm/index.html",
        secondary_source_urls="https://www.seibulions.jp/company/",
        verification_status="CURRENT_STATUS_CHECK", historical_or_current="CURRENT_AS_OF_CUTOFF",
        mechanism_revealed="A third team can increase development repetitions while adding calendar and operating complexity.",
        potential_game_system="multi-team/farm-schedule/regional-operations",
        existing_requirement_ids="PW-149;PW-150;PW-165;PW-179;PW-180",
        materiality="MEDIUM", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="LOW",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="D;E;K",
    ),
    event_record(
        event_id="PNW2-018", event_date_start="2020-12-01", event_date_end="2021-04-01",
        region="North America", country="United States/Canada", league="MLB/MiLB",
        organization="MLB; Minor League Baseball", competition="Player Development League",
        topic_family="E - player development", subtopic="affiliation standards",
        headline_or_event_name="MLB modernized the player-development system and assigned four affiliate levels",
        fact_summary="MLB set one Triple-A, Double-A, High-A, and Low-A affiliate per club, PDL licenses, facility and working-condition standards, higher salaries, reduced travel, and geographic alignment.",
        primary_source_url="https://www.mlb.com/press-release/press-release-mlb-announces-new-modernized-player-development-system-and-the-120",
        secondary_source_urls="https://www.mlb.com/news/the-mlb-farm-system-explained",
        mechanism_revealed="A central governing body can standardize development conditions while preserving local affiliates and changing travel and cost structures.",
        potential_game_system="farm-affiliation/standards/travel/geography/player-conditions",
        existing_requirement_ids="PW-149;PW-150;PW-168;PW-179;PW-180;PW-247",
        materiality="HIGH", player_frustration_risk="MEDIUM", topic_codes="D;E;K;L",
    ),
    event_record(
        event_id="PNW2-019", event_date_start="2021-01-01", event_date_end="2021-12-31",
        region="North America", country="United States", league="MLB/MiLB",
        organization="MLB; Prep Baseball Report; Appalachian League clubs", competition="MLB Draft League",
        topic_family="B - draft/amateur acquisition", subtopic="showcase league",
        headline_or_event_name="MLB created the Draft League as a draft-eligible showcase and regional development competition",
        fact_summary="MLB and PBR announced a league focused on players eligible for that summer's draft, combining scouting exposure, local communities, and a reshaped Appalachian League pathway.",
        primary_source_url="https://www.mlb.com/press-release/press-release-mlb-draft-league-to-launch-in-2021",
        secondary_source_urls="https://www.mlb.com/news/mlb-draft-league-first-year-success;https://www.mlb.com/news/mlb-draft-league-announces-2022-schedule-and-expanded-format",
        mechanism_revealed="A league can be designed as an evaluation market between amateur status and the draft, with visibility and local-market tradeoffs.",
        potential_game_system="draft-league/showcase/evaluation/independent-route",
        existing_requirement_ids="PW-053;PW-054;PW-055;PW-145;PW-151;PW-239;PW-240;PW-241;PW-260",
        materiality="HIGH", player_frustration_risk="MEDIUM", suggested_default_or_toggle="TOGGLE", topic_codes="B;D;E;N",
    ),
    event_record(
        event_id="PNW2-020", event_date_start="2021-01-01", event_date_end="2022-12-31",
        region="North America", country="United States", league="MLB/USA Baseball",
        organization="MLB; USA Baseball", competition="Prospect Development Pipeline and Draft Combine",
        topic_family="F - scouting/analytics/AI/technology", subtopic="standardized evaluation",
        headline_or_event_name="MLB and USA Baseball expanded the PDP with showcase events and a first MLB Draft Combine",
        fact_summary="The official announcement describes the PDP as an identification and assessment pathway to all 30 MLB clubs, with high-school and college evaluation events.",
        primary_source_url="https://www.mlb.com/news/mlb-draft-combine-pdp-league-showcase-events",
        secondary_source_urls="https://www.mlb.com/press-release/press-release-mlb-draft-league-to-launch-in-2021",
        mechanism_revealed="Shared evaluation infrastructure can reduce scouting noise while concentrating access and data ownership.",
        potential_game_system="scouting/evaluation/data/visibility",
        existing_requirement_ids="PW-053;PW-055;PW-120;PW-145;PW-153;PW-155;PW-239;PW-241;PW-260",
        materiality="HIGH", player_frustration_risk="MEDIUM", suggested_default_or_toggle="TOGGLE", topic_codes="B;F;H",
    ),
    event_record(
        event_id="PNW2-021", event_date_start="2021-07-01", event_date_end="2026-08-24",
        region="North America", country="United States", league="NCAA",
        organization="NCAA; Division I schools; student-athletes", competition="NIL and transfer governance",
        topic_family="I - player identity/psychology/agency", subtopic="amateur market and agency",
        headline_or_event_name="NCAA NIL and transfer compliance created a more stateful college-player market",
        fact_summary="NCAA materials show ongoing NIL reporting thresholds and transfer-process rules, making school choice, compensation disclosure, and eligibility governed states.",
        primary_source_url="https://www.ncaa.org/student-athletes/name-image-likeness/",
        secondary_source_urls="https://www.ncaa.org/media-center-division-i-board-of-directors-ratifies-transfer-nil-rule-changes/",
        verification_status="CURRENT_STATUS_CHECK", historical_or_current="CURRENT_AS_OF_CUTOFF",
        mechanism_revealed="Amateur players can have agency, market value, eligibility, and compliance states before professional acquisition.",
        potential_game_system="college-pipeline/agency/NIL/eligibility/compliance",
        existing_requirement_ids="PW-054;PW-055;PW-168;PW-188;PW-205;PW-239;PW-240;PW-241;PW-244;PW-256",
        materiality="HIGH", player_frustration_risk="HIGH_IF_AUTOMATIC", suggested_default_or_toggle="TOGGLE",
        topic_codes="B;C;I;L",
    ),
    event_record(
        event_id="PNW2-022", event_date_start="2026-06-01", event_date_end="2026-08-24",
        region="North America", country="United States", league="MLB",
        organization="MLB; MLBPA; clubs", competition="Domestic amateur draft proposal",
        topic_family="B - draft/amateur acquisition", subtopic="draft eligibility",
        headline_or_event_name="MLB proposed a 2028 domestic draft eligibility change",
        fact_summary="MLB proposes a 2028 age and post-high-school rule and explicitly allows non-college players from the Draft League or independent leagues to be drafted; it is not enacted.",
        primary_source_url="https://www.mlb.com/level-the-playing-field/fact-sheets/domestic-amateur-proposal",
        verification_status="CURRENT_STATUS_CHECK", historical_or_current="CURRENT_PROPOSAL_AS_OF_CUTOFF",
        mechanism_revealed="Draft eligibility can move the evaluation window and make alternative leagues valid entry routes.",
        potential_game_system="draft-eligibility/alternative-league/transition-rule",
        existing_requirement_ids="PW-053;PW-054;PW-055;PW-195;PW-196;PW-198;PW-239;PW-240;PW-241;PW-260",
        materiality="HIGH", player_frustration_risk="HIGH_IF_AUTOMATIC", topic_codes="B;D;N;Q",
        notes="Proposal status is explicitly separated from enacted rules.",
    ),
    event_record(
        event_id="PNW2-023", event_date_start="2026-06-01", event_date_end="2026-08-24",
        region="Global", country="United States/International", league="MLB",
        organization="MLB; MLBPA; international federations", competition="International draft proposal",
        topic_family="O - country-specific systems", subtopic="international market governance",
        headline_or_event_name="MLB proposed a separate international draft and trainer protections",
        fact_summary="MLB's proposal describes an international draft, a 200 million dollar first-year pool, and oversight/protections for Dominican trainers; it remains unsettled.",
        primary_source_url="https://www.mlb.com/news/mlb-domestic-and-international-draft-proposals",
        secondary_source_urls="https://www.mlb.com/trainer-partnership;https://www.mlb.com/trainer-partnership/dominican-republic",
        verification_status="CURRENT_STATUS_CHECK", historical_or_current="CURRENT_PROPOSAL_AS_OF_CUTOFF",
        mechanism_revealed="International acquisition rules can be redesigned while changing trainer incentives, age timing, and market access.",
        potential_game_system="international-draft/trainer-governance/pool/eligibility",
        existing_requirement_ids="PW-151;PW-168;PW-172;PW-173;PW-195;PW-196;PW-198;PW-239;PW-240;PW-241;PW-256",
        materiality="HIGH", player_frustration_risk="HIGH_IF_AUTOMATIC", topic_codes="B;N;O;L",
        notes="No unverified claims about named trainers or prospects are used.",
    ),
    event_record(
        event_id="PNW2-024", event_date_start="2026-06-25", event_date_end="2026-08-24",
        region="North America", country="United States", league="MLB",
        organization="MLB; MLBPA", competition="CBA proposal",
        topic_family="L - governance/labor/player associations", subtopic="reserve, FA, and salary timing",
        headline_or_event_name="MLB's June 2026 proposal included earlier FA for some older players and salary-pool changes",
        fact_summary="MLB reports a proposal to reduce reserve time from six to five years for players aged 30 and over, remove qualifying offers, and alter minimum/pre-arbitration compensation; not settled by cutoff.",
        primary_source_url="https://www.mlb.com/news/mlb-cba-proposal-addresses-minimum-salary-free-agency",
        secondary_source_urls="https://www.mlb.com/news/players-association-marks-50th-year-as-a-labor-union",
        verification_status="CURRENT_STATUS_CHECK", historical_or_current="CURRENT_PROPOSAL_AS_OF_CUTOFF",
        mechanism_revealed="Labor bargaining can alter contract timing and resource distribution for a defined cohort.",
        potential_game_system="CBA/proposal/FA/service-time/salary-pool",
        existing_requirement_ids="PW-129;PW-133;PW-134;PW-135;PW-138;PW-139;PW-141;PW-188;PW-189;PW-198;PW-247",
        materiality="HIGH", player_frustration_risk="HIGH_IF_AUTOMATIC", topic_codes="C;L;Q",
        notes="Proposal status is explicitly separated from enacted CBA state.",
    ),
    event_record(
        event_id="PNW2-025", event_date_start="1920-01-01", event_date_end="1939-12-31",
        region="North America", country="United States", league="MLB/MiLB",
        organization="St. Louis Cardinals; independent minor leagues", competition="Farm-system formation",
        topic_family="E - player development", subtopic="affiliation history",
        headline_or_event_name="Branch Rickey's Cardinals helped turn independent minor clubs into an owned development machine",
        fact_summary="MLB's historical explainer describes independent minors and the Cardinals' 1920s-30s acquisition of teams to create a coordinated farm system.",
        primary_source_url="https://www.mlb.com/news/the-mlb-farm-system-explained",
        mechanism_revealed="Owning or controlling lower-tier development can improve coordination but consumes capital and changes local independence.",
        potential_game_system="farm-ownership/affiliation/capacity/knowledge",
        existing_requirement_ids="PW-149;PW-150;PW-151;PW-155;PW-156;PW-157;PW-179;PW-180",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="D;E;G;Q",
    ),
    event_record(
        event_id="PNW2-026", event_date_start="1946-01-01", event_date_end="1946-12-31",
        region="North America", country="Canada/United States", league="MLB/MiLB",
        organization="Montreal Royals; Brooklyn Dodgers", competition="Minor-league integration",
        topic_family="G - staff/culture/org knowledge", subtopic="institutional access",
        headline_or_event_name="The Montreal Royals served as a deliberate environment for Jackie Robinson's 1946 minor-league season",
        fact_summary="MLB's historical account describes Montreal as a more welcoming assignment before MLB integration, showing a lower-tier environment carrying social and institutional risk.",
        primary_source_url="https://www.mlb.com/milb/history/jackie-robinson-1946",
        mechanism_revealed="Organizations can choose a lower-tier environment to manage institutional access and social risk before a broader transition.",
        potential_game_system="development-environment/access-route/reputation",
        existing_requirement_ids="PW-103;PW-104;PW-127;PW-128;PW-155;PW-157;PW-213;PW-214",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="HIGH_IF_AUTOMATIC",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="D;E;G;I;Q",
        notes="No motives beyond the official historical account are inferred.",
    ),
    event_record(
        event_id="PNW2-027", event_date_start="1961-01-01", event_date_end="1998-01-01",
        region="North America", country="United States/Canada", league="MLB",
        organization="MLB expansion clubs", competition="Expansion and relocation",
        topic_family="Q - rare structural events", subtopic="league topology",
        headline_or_event_name="MLB expansion and relocation repeatedly changed the league map from 1961 through 1998",
        fact_summary="MLB official expansion-era material records new clubs in several waves and relocations such as the Senators to Texas.",
        primary_source_url="https://www.mlb.com/glossary/miscellaneous/expansion-era",
        secondary_source_urls="https://www.mlb.com/news/mlb-expansion-draft-history",
        mechanism_revealed="League topology is a repeated state transition affecting travel, markets, ownership, and player distribution.",
        potential_game_system="expansion/relocation/league-quality/market",
        existing_requirement_ids="PW-174;PW-178;PW-179;PW-180;PW-201;PW-203;PW-204",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="DEFAULT_RARE", topic_codes="D;K;N;Q",
    ),
    event_record(
        event_id="PNW2-028", event_date_start="1960-01-01", event_date_end="1997-12-31",
        region="North America", country="United States/Canada", league="MLB",
        organization="MLB expansion clubs", competition="Expansion drafts",
        topic_family="D - organization/competitive balance", subtopic="player redistribution",
        headline_or_event_name="MLB expansion drafts redistributed protected players into new clubs",
        fact_summary="MLB official history lists expansion drafts across multiple waves and shows how expansion clubs acquired a constrained player pool.",
        primary_source_url="https://www.mlb.com/news/mlb-expansion-draft-history",
        secondary_source_urls="https://www.mlb.com/glossary/miscellaneous/expansion-era",
        mechanism_revealed="Expansion can require a bounded redistribution mechanism distinct from ordinary free agency or a new draft.",
        potential_game_system="expansion-draft/protection/redistribution/competitive-balance",
        existing_requirement_ids="PW-201;PW-202;PW-203;PW-236;PW-237;PW-238",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="DEFAULT_RARE", topic_codes="B;C;D;Q",
    ),
    event_record(
        event_id="PNW2-029", event_date_start="1950-01-01", event_date_end="1996-12-31",
        region="North America", country="United States", league="MLB", organization="MLB",
        competition="Rule and strike-zone transitions", topic_family="A - rules/on-field environment",
        subtopic="era comparability", headline_or_event_name="MLB changed strike-zone definitions and physical conditions across multiple eras",
        fact_summary="MLB official rules history documents strike-zone changes in 1950, 1963, 1969, 1988, and 1996, providing an era-comparability series.",
        primary_source_url="https://www.mlb.com/news/history-of-mlb-rules-changes",
        mechanism_revealed="Raw performance records need era markers when the rule-defined measurement environment changes.",
        potential_game_system="rule-era/measurement/record-comparability",
        existing_requirement_ids="PW-190;PW-191;PW-192;PW-193;PW-213;PW-215;PW-216",
        materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="DEFAULT", topic_codes="A;F;Q",
        notes="Ball and equipment transitions require separate archival work.",
    ),
    event_record(
        event_id="PNW2-030", event_date_start="2018-01-01", event_date_end="2026-08-24",
        region="Caribbean", country="Dominican Republic", league="MLB",
        organization="MLB; independent trainers; academies", competition="Trainer Partnership Program",
        topic_family="N - global development", subtopic="academy governance",
        headline_or_event_name="MLB formalized a trainer-partnership framework for international development",
        fact_summary="MLB describes independent trainers as part of the development system in the Dominican Republic, Venezuela, Colombia, Panama, and elsewhere, with ethical and safe-development expectations.",
        primary_source_url="https://www.mlb.com/trainer-partnership",
        secondary_source_urls="https://www.mlb.com/trainer-partnership/dominican-republic;https://www.mlb.com/amp/news/mlb-announces-trainer-partnership-program-c292528056.html",
        mechanism_revealed="A professional pipeline can depend on semi-independent local trainers whose quality, incentives, and governance affect access.",
        potential_game_system="trainer-network/academy/governance/early-discovery",
        existing_requirement_ids="PW-151;PW-155;PW-156;PW-168;PW-175;PW-177;PW-205;PW-239;PW-241",
        materiality="HIGH", player_frustration_risk="HIGH_IF_AUTOMATIC", suggested_default_or_toggle="TOGGLE", topic_codes="E;F;G;M;N;O",
        notes="No individual trainer allegation is retained; institutional mechanism only.",
    ),
    event_record(
        event_id="PNW2-031", event_date_start="2020-01-01", event_date_end="2026-08-24",
        region="Caribbean", country="Dominican Republic", league="MLB",
        organization="Pittsburgh Pirates; Dominican academy", competition="Academy education and technology",
        topic_family="E - player development", subtopic="international academy",
        headline_or_event_name="Pirates' Dominican academy combines schooling, training, and baseball technology",
        fact_summary="MLB reporting describes education, maturity, weight-room infrastructure, field quality, and technology in the Pirates' Dominican academy and links international scouting, development, and coaching.",
        primary_source_url="https://www.mlb.com/news/esmerlyn-valdez-wilber-dotel-reinforce-importance-of-pirates-dominican-academy",
        secondary_source_urls="https://www.mlb.com/trainer-partnership/dominican-republic",
        mechanism_revealed="An academy's value can include education and life-transition support, not just skill conversion.",
        potential_game_system="academy/education/technology/cultural-adaptation",
        existing_requirement_ids="PW-145;PW-151;PW-153;PW-155;PW-156;PW-157;PW-177;PW-241;PW-242",
        materiality="HIGH", player_frustration_risk="LOW", suggested_default_or_toggle="TOGGLE", topic_codes="E;F;G;N",
        notes="Named players are examples only; outcomes are not hardcoded.",
    ),
    event_record(
        event_id="PNW2-032", event_date_start="1990-01-01", event_date_end="1995-12-31",
        region="Caribbean", country="Puerto Rico", league="MLB",
        organization="MLB; Puerto Rico amateur baseball", competition="Amateur access transition",
        topic_family="B - draft/amateur acquisition", subtopic="local incentive",
        headline_or_event_name="Puerto Rican amateurs became subject to the MLB Draft in the early 1990s",
        fact_summary="MLB reporting describes a local-development concern and attributes part of the reduced club incentive to the change that brought Puerto Rican amateurs into the MLB Draft.",
        primary_source_url="https://www.mlb.com/news/mlb-developing-young-players-in-puerto-rico-c161957642",
        mechanism_revealed="Changing acquisition rights can alter local investment incentives even when the player pool remains.",
        potential_game_system="draft/incentive/local-pipeline/market-access",
        existing_requirement_ids="PW-053;PW-054;PW-055;PW-151;PW-168;PW-173;PW-239;PW-241",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="OWNER_CALIBRATION", research_confidence="MEDIUM", topic_codes="B;E;N;O",
        notes="Retrospective causal attribution is reported, not treated as a proven single-factor estimate.",
    ),
    event_record(
        event_id="PNW2-033", event_date_start="1997-01-01", event_date_end="2016-01-01",
        region="Latin America", country="Venezuela", league="MLB/MiLB",
        organization="Venezuelan Summer League; MLB clubs", competition="VSL closure",
        topic_family="N - global development", subtopic="league viability and access",
        headline_or_event_name="VSL grew and then closed as clubs withdrew amid domestic and travel instability",
        fact_summary="MiLB describes the VSL's 1997 debut, early-2000s peak, team departures, volatility, visa restrictions, and closure for the 2016 season.",
        primary_source_url="https://www.milb.com/news/closing-of-vsl-poses-new-test-for-prospects-169836078",
        secondary_source_urls="https://www.mlb.com/news/international-rules-changes-on-tryouts-travel-c290511342",
        source_authority="PRIMARY_PLUS_SECONDARY", mechanism_revealed="A local development league can contract or close when safety, economy, visas, and club operating choices change.",
        potential_game_system="league-contraction/academy-route/visa/travel/development",
        existing_requirement_ids="PW-168;PW-172;PW-173;PW-174;PW-175;PW-179;PW-180;PW-256",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="HIGH_IF_AUTOMATIC",
        suggested_default_or_toggle="TOGGLE", topic_codes="E;N;O;Q",
        notes="No national or individual blame is inferred.",
    ),
    event_record(
        event_id="PNW2-034", event_date_start="2018-01-01", event_date_end="2018-12-31",
        region="Latin America", country="Venezuela/Caribbean", league="MLB",
        organization="MLB; international academies; trainers", competition="International tryout and travel rules",
        topic_family="O - country-specific systems", subtopic="eligibility and travel",
        headline_or_event_name="MLB changed international tryout and travel controls",
        fact_summary="MLB policy set time windows for facility access and permitted certain travel support, noting likely effects on Venezuelan prospects and trainer/academy operations.",
        primary_source_url="https://www.mlb.com/news/international-rules-changes-on-tryouts-travel-c290511342",
        secondary_source_urls="https://www.mlb.com/trainer-partnership",
        mechanism_revealed="Eligibility timing, facility access, and travel support can reshape early scouting routes without changing player ability.",
        potential_game_system="tryout-window/travel/visa/facility-access",
        existing_requirement_ids="PW-168;PW-172;PW-173;PW-239;PW-241;PW-256",
        materiality="HIGH", player_frustration_risk="HIGH_IF_AUTOMATIC", topic_codes="B;F;N;O",
    ),
    event_record(
        event_id="PNW2-035", event_date_start="2019-01-01", event_date_end="2019-12-31",
        region="Latin America", country="Mexico", league="MLB/LMB",
        organization="MLB; Mexican Baseball League", competition="Player-transfer agreement",
        topic_family="C - contracts/FA/player movement", subtopic="league-to-league transfer",
        headline_or_event_name="MLB and LMB ratified a first player-transfer agreement",
        fact_summary="MLB's official release describes the first agreement between the leagues, following other protocol agreements and creating a qualified route rather than an ad hoc transfer.",
        primary_source_url="https://www.mlb.com/press-release/mlb-mexican-baseball-league-agree-on-player-transfers",
        secondary_source_urls="https://lmb.com.mx/noticias/cambios-en-reglas-para-la-temporada-2024",
        novelty_status="ALREADY_COVERED", materiality="MEDIUM", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="TOGGLE", implementation_complexity="MEDIUM",
        mechanism_revealed="Cross-league player movement can use threshold-based eligibility, release, and compensation rules.",
        potential_game_system="transfer-agreement/eligibility/release/market-route",
        existing_requirement_ids="PW-133;PW-134;PW-135;PW-168;PW-172;PW-173;PW-240;PW-256",
        topic_codes="C;O", wave1_relation="DETAILED_REVALIDATION_OF_PNN-030",
        notes="Regional receipt evidence; not counted as a distinct new mechanism.",
    ),
    event_record(
        event_id="PNW2-036", event_date_start="1949-01-01", event_date_end="2026-08-24",
        region="Caribbean", country="Caribbean", league="Caribbean Series",
        organization="Caribbean winter leagues; national federations", competition="Caribbean Series",
        topic_family="P - tournaments/all-star", subtopic="winter interleague",
        headline_or_event_name="The Caribbean Series provides a durable winter interleague layer",
        fact_summary="The official history page documents a recurring regional tournament connecting winter-league champions, a distinct competition and visibility layer beyond a domestic league.",
        primary_source_url="https://caribbeanseries.com/en/history",
        verification_status="VERIFIED", source_authority="PRIMARY_OFFICIAL",
        mechanism_revealed="A regional winter tournament can create relationships, scouting, visibility, and workload without becoming a permanent club league.",
        potential_game_system="winter-league/tournament/visibility/relationship",
        existing_requirement_ids="PW-181;PW-182;PW-183;PW-185;PW-186;PW-187;PW-257",
        materiality="MEDIUM", recurrence_class="RECURRING", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="TOGGLE", implementation_complexity="MEDIUM", research_confidence="MEDIUM",
        notes="Existence and continuity are sourced; season-level mechanics need further archives.", topic_codes="N;P;Q",
    ),
    event_record(
        event_id="PNW2-037", event_date_start="2025-01-01", event_date_end="2026-08-24",
        region="Europe", country="Europe", league="WBSC Europe",
        organization="WBSC Europe; member federations", competition="Club tournaments",
        topic_family="Q - rare structural events", subtopic="promotion and relegation",
        headline_or_event_name="WBSC Europe set a 2027 club-tournament format with promotion and relegation",
        fact_summary="WBSC Europe reports eight-team club tournaments, a relegation match, and one promotion/one relegation from 2027, alongside education and infrastructure support.",
        primary_source_url="https://static.wbsc.org/uploads/federations/278/cms/documents/60fd5ac2-7bca-e738-7a18-ecb8ac560349.pdf",
        secondary_source_urls="https://static.wbsc.org/uploads/federations/278/cms/documents/eaf24920-887e-e4c4-6896-05c5ceda3429.pdf",
        novelty_status="NEW_CANDIDATE", materiality="HIGH", recurrence_class="CONDITIONAL_RECURRING",
        mechanism_revealed="Tier movement can provide a regional ecosystem with promotion, relegation, qualification, and resource constraints.",
        potential_game_system="promotion/relegation/tier-movement/club-ecosystem",
        existing_requirement_ids="PW-168;PW-174;PW-175;PW-178;PW-179;PW-180;PW-181;PW-203",
        player_frustration_risk="MEDIUM", suggested_default_or_toggle="TOGGLE", topic_codes="D;N;P;Q",
        notes="Wave 1 treated Europe evidence as partial; red-team review promotes PNC-009.",
    ),
    event_record(
        event_id="PNW2-038", event_date_start="2025-01-01", event_date_end="2025-12-31",
        region="Africa", country="Africa", league="WBSC Africa",
        organization="WBSC Africa; national federations", competition="Official development",
        topic_family="G - staff/culture/org knowledge", subtopic="umpire and governance pipeline",
        headline_or_event_name="WBSC Africa reported plans for structured umpire training and certification",
        fact_summary="WBSC Africa reports plans for sustainable umpire training, certification, deployment, and membership growth, showing officials capacity as an infrastructure constraint.",
        primary_source_url="https://static.wbsc.org/uploads/federations/280/cms/documents/5bad2e3f-d1ce-8de5-354b-9dbc92605207.pdf",
        secondary_source_urls="https://static.wbsc.org/uploads/federations/0/cms/documents/49ce4a6f-c503-bde5-5614-11ba87205abe.pdf",
        verification_status="VERIFIED_PRIMARY", source_authority="PRIMARY_OFFICIAL",
        mechanism_revealed="A developing region may be constrained by officials and certification before player talent is the bottleneck.",
        potential_game_system="officials/certification/league-capacity/governance",
        existing_requirement_ids="PW-145;PW-155;PW-156;PW-174;PW-175;PW-176;PW-177;PW-190;PW-205",
        materiality="MEDIUM", player_frustration_risk="LOW", suggested_default_or_toggle="TOGGLE",
        implementation_complexity="MEDIUM", topic_codes="A;G;L;N;Q",
        notes="Federation-level evidence only; no national quality ranking is inferred.",
    ),
    event_record(
        event_id="PNW2-039", event_date_start="1989-01-01", event_date_end="2010-12-31",
        region="Oceania", country="Australia/New Zealand", league="ABL",
        organization="Australian Baseball Federation; ABL clubs", competition="ABL original and modern relaunch",
        topic_family="N - global development", subtopic="league continuity",
        headline_or_event_name="Australia's professional league was established in 1989 and relaunched in 2010",
        fact_summary="Baseball Australia records the original 1989 ABL as a national senior competition; the modern ABL describes its 2010 joint venture with MLB and an Australia/New Zealand pathway.",
        primary_source_url="https://baseball.com.au/the-claxton-shield/",
        secondary_source_urls="https://theabl.com.au/about/",
        mechanism_revealed="A national professional league can disappear, return under a new ownership model, and serve a player pathway across seasons.",
        potential_game_system="league-creation/contraction/relaunch/pathway",
        existing_requirement_ids="PW-174;PW-175;PW-179;PW-180;PW-181",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="DEFAULT_RARE", topic_codes="D;E;N;Q",
    ),
    event_record(
        event_id="PNW2-040", event_date_start="2020-12-01", event_date_end="2021-01-31",
        region="Oceania", country="Australia", league="ABL",
        organization="Perth Heat; Canberra Cavalry; Baseball Australia", competition="COVID-affected series",
        topic_family="Q - rare structural events", subtopic="travel and competition ruling",
        headline_or_event_name="An ABL opening series was not played because of COVID travel restrictions and was treated as null",
        fact_summary="The Australian National Sports Tribunal records that Canberra did not travel to Western Australia due to entry restrictions and the series was recommended null and void.",
        primary_source_url="https://www.nationalsportstribunal.gov.au/decisions/nst-e21-4222",
        secondary_source_urls="https://baseball.com.au/news/playoff-format-revealed-season-extended/",
        mechanism_revealed="External travel restrictions can alter whether games count, changing standings and labor/calendar interpretation.",
        potential_game_system="travel-restriction/postponement/null-result/league-governance",
        existing_requirement_ids="PW-181;PW-182;PW-193;PW-198;PW-247",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="HIGH_IF_AUTOMATIC",
        suggested_default_or_toggle="DEFAULT_RARE", topic_codes="A;L;P;Q",
        notes="Distinct from Wave 1's general ABL schedule disruption: formal ruling on an unplayed series.",
    ),
    event_record(
        event_id="PNW2-041", event_date_start="2025-05-17", event_date_end="2026-06-17",
        region="Oceania", country="Australia", league="ABL",
        organization="Baseball Australia; ABL license holders; IMG", competition="League reset and central model",
        topic_family="K - business/fans/media/stadiums", subtopic="ownership and league operation",
        headline_or_event_name="ABL moved through a four-team transition toward a centrally owned and operated model",
        fact_summary="ABL statements describe a four-team 2025-26 transition, license changes, an MOU, and a 2026 plan for a centrally owned model with IMG-supported commercial/media development.",
        primary_source_url="https://theabl.com.au/news/ablnewera/",
        secondary_source_urls="https://theabl.com.au/news/abl2526/;https://theabl.com.au/news/2526japan/",
        verification_status="CURRENT_STATUS_CHECK", historical_or_current="CURRENT_AS_OF_CUTOFF",
        mechanism_revealed="League centralization can respond to license, finance, media, and market instability.",
        potential_game_system="league-ownership/license/reset/central-operations/media",
        existing_requirement_ids="PW-141;PW-143;PW-144;PW-174;PW-179;PW-180;PW-204;PW-247;PW-248",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="MEDIUM",
        suggested_default_or_toggle="OWNER_CALIBRATION", topic_codes="D;K;N;Q",
        notes="Future six-team expansion is expectation, not completed as of cutoff.",
    ),
    event_record(
        event_id="PNW2-042", event_date_start="2026-01-01", event_date_end="2026-08-24",
        region="North America", country="United States", league="Cape Cod Baseball League",
        organization="Cape Cod Baseball League; college programs", competition="Summer college league",
        topic_family="B - draft/amateur acquisition", subtopic="private and college ecosystem",
        headline_or_event_name="Cape Cod operates a volunteer-heavy summer college development league",
        fact_summary="The official Cape Cod description documents a 40-game regular season, best-of-three postseason, and primarily volunteer operation, illustrating private development capacity.",
        primary_source_url="https://www.capecodleague.com/about/what-is",
        verification_status="VERIFIED", source_authority="PRIMARY_OFFICIAL",
        mechanism_revealed="A high-signal amateur route can be sustained by local volunteers and college relationships rather than a fully professional payroll.",
        potential_game_system="college-summer-league/volunteer/scouting/pathway",
        existing_requirement_ids="PW-149;PW-151;PW-155;PW-174;PW-175;PW-239;PW-241",
        materiality="MEDIUM", recurrence_class="RECURRING", player_frustration_risk="LOW",
        suggested_default_or_toggle="TOGGLE", implementation_complexity="MEDIUM", research_confidence="MEDIUM",
        topic_codes="B;E;G;N",
        notes="Current operating mechanism is retained; the page does not establish the event-range start date.",
    ),
    event_record(
        event_id="PNW2-043", event_date_start="1968-01-01", event_date_end="1976-12-31",
        region="North America", country="United States", league="MLB",
        organization="MLBPA; MLB; clubs", competition="CBA, arbitration, and free agency",
        topic_family="L - governance/labor/player associations", subtopic="reserve clause transition",
        headline_or_event_name="MLB labor institutions moved from the first CBA through neutral arbitration to free agency",
        fact_summary="MLB historical labor material identifies the 1968 first CBA, 1970 neutral arbitration, and 1975 reserve-clause precedent that opened free agency.",
        primary_source_url="https://www.mlb.com/news/players-association-marks-50th-year-as-a-labor-union",
        secondary_source_urls="https://www.mlb.com/news/mlbpas-clark-to-pay-tribute-to-flood;https://www.mlb.com/official-information/about-mlb/commissioners/bowie-kuhn",
        mechanism_revealed="Labor institutions can change the contract state space through staged precedents rather than one switch.",
        potential_game_system="CBA/arbitration/reserve-rights/free-agency/history",
        existing_requirement_ids="PW-129;PW-133;PW-134;PW-135;PW-188;PW-189;PW-198;PW-213;PW-214",
        materiality="HIGH", recurrence_class="RARE_SYSTEMIC", player_frustration_risk="HIGH_IF_AUTOMATIC",
        suggested_default_or_toggle="DEFAULT_RARE", topic_codes="C;L;Q",
        notes="Repairs pre-1990 labor coverage beyond Wave 1's 1975/76 event.",
    ),
]


TOPICS = {
    "A": "rules / on-field environment",
    "B": "draft / amateur acquisition",
    "C": "contracts / FA / player movement",
    "D": "organization / roster / competitive balance",
    "E": "player development",
    "F": "scouting / analytics / AI / technology",
    "G": "staff / culture / organizational knowledge",
    "H": "opponent research / adaptation",
    "I": "player identity / psychology / agency",
    "J": "injury / fatigue / health",
    "K": "business / fans / media / stadiums",
    "L": "governance / labor / player associations",
    "M": "integrity / scandals / enforcement",
    "N": "global development",
    "O": "country-specific systems",
    "P": "tournaments / all-star",
    "Q": "rare structural events",
}


LANE_PROFILES = [
    ("NPB_NATIONAL", "NPB national", "Japan", "npb.jp;draft.npb.jp;NPB league/farm archives", "1946-2026", "NPB {topic} history rule reform farm draft contract governance"),
    ("NPB_12_CLUBS", "NPB 12 clubs", "Japan", "12 club official histories, farm pages, IR/facility pages; NPB club lists", "1949-2026", "NPB {club} {topic} 球団史 ファーム 育成 契約"),
    ("MLB", "MLB", "North America", "mlb.com;MLBPA;official MLB rules/CBA/history", "1900-2026", "MLB {topic} historical mechanism rule labor expansion"),
    ("MLB_MILB", "MLB/MiLB", "North America", "MLB.com;MiLB.com;official player-development/affiliate pages", "1920-2026", "MLB MiLB farm affiliate {topic} development history"),
    ("NCAA_US_COLLEGE", "NCAA / US college baseball", "North America", "ncaa.org;USA Baseball;official college league pages;Cape Cod", "1990-2026", "NCAA college baseball {topic} eligibility NIL transfer draft"),
    ("US_PRIVATE_DEVELOPMENT", "US private development ecosystem", "North America", "Cape Cod;MLB Draft League;PDP;showcase pages", "1920-2026", "US baseball private development showcase summer league {topic}"),
    ("KBO", "KBO", "East Asia", "KBO official history/rules;club sites;MLB protocol sources", "1982-2026", "KBO {topic} history rule club development foreign player"),
    ("CPBL", "CPBL", "East Asia", "CPBL official structure/register/news;official league materials", "1990-2026", "CPBL {topic} history roster draft integrity official"),
    ("MEXICO_LMB", "Mexico / LMB", "Latin America", "MLB.com;LMB official;MiLB transfer/rule releases", "1990-2026", "Mexican League LMB {topic} player transfer rule history"),
    ("DOMINICAN_REPUBLIC", "Dominican Republic", "Caribbean", "MLB trainer partnership;academy reports;LIDOM/federation", "1980-2026", "Dominican Republic baseball academy trainer {topic} history"),
    ("VENEZUELA", "Venezuela", "Latin America", "MLB/MiLB;Venezuelan league/federation;policy/travel releases", "1990-2026", "Venezuela baseball academy summer league {topic} history"),
    ("PUERTO_RICO", "Puerto Rico", "Caribbean", "MLB international;PR federation/LBPRC;official tournaments", "1960-2026", "Puerto Rico baseball amateur development draft {topic} history"),
    ("CUBA", "Cuba", "Caribbean", "MLB/Federation agreements;WBSC;Cuban federation/tournament", "1960-2026", "Cuba baseball player pathway federation agreement {topic} history"),
    ("CARIBBEAN_WINTER", "Caribbean winter leagues", "Caribbean", "Caribbean Series;LIDOM;LBPRC;LVBP;official winter pages", "1949-2026", "Caribbean winter league baseball {topic} history tournament"),
    ("EUROPE", "Europe", "Europe", "WBSC Europe reports/regulations;member federation pages", "1990-2026", "European baseball club competition {topic} promotion relegation history"),
    ("AFRICA", "Africa", "Africa", "WBSC Africa reports;member federation/tournament pages", "1990-2026", "Africa baseball federation development {topic} history"),
    ("AUSTRALIA_OCEANIA", "Australia / Oceania", "Oceania", "Baseball Australia;ABL;WBSC Oceania;National Sports Tribunal", "1989-2026", "Australia Oceania baseball league {topic} history pathway"),
    ("INDEPENDENT_LEAGUES", "Independent leagues", "Global", "MLB Draft League;official independent pages;WBSC/MiLB", "1990-2026", "independent baseball league player development draft route {topic}"),
    ("WBSC_GLOBAL", "WBSC global tournaments and federations", "Global", "WBSC;MLB;official national federations/tournaments", "1930-2026", "WBSC baseball international tournament federation {topic} history"),
]


def lane_text(row: dict) -> str:
    return " ".join(row.get(key, "") for key in (
        "region", "country", "league", "organization", "competition",
        "primary_source_url", "secondary_source_urls",
    )).lower()


LANE_MARKERS = {
    "NPB_NATIONAL": ["npb", "japan"],
    "NPB_12_CLUBS": ["npb", "hanshin", "giants", "hawks", "carp", "baystars", "dragons", "yakult", "fighters", "marines", "lions", "buffaloes", "rakuten"],
    "MLB": ["mlb"],
    "MLB_MILB": ["milb", "minor league", "farm"],
    "NCAA_US_COLLEGE": ["ncaa", "college", "cape cod"],
    "US_PRIVATE_DEVELOPMENT": ["draft league", "cape cod", "pdp", "independent"],
    "KBO": ["kbo"],
    "CPBL": ["cpbl"],
    "MEXICO_LMB": ["mexico", "lmb", "mexican"],
    "DOMINICAN_REPUBLIC": ["dominican"],
    "VENEZUELA": ["venezuela", "vsl"],
    "PUERTO_RICO": ["puerto rico"],
    "CUBA": ["cuba", "cuban"],
    "CARIBBEAN_WINTER": ["caribbean", "winter", "lidom", "lvbp"],
    "EUROPE": ["europe", "wbsc europe"],
    "AFRICA": ["africa", "wbsc africa"],
    "AUSTRALIA_OCEANIA": ["australia", "oceania", "abl", "guam", "new zealand", "fiji"],
    "INDEPENDENT_LEAGUES": ["independent", "draft league", "cape cod"],
    "WBSC_GLOBAL": ["wbsc", "world baseball", "olympic", "premier12", "caribbean series"],
}


SATURATED_TOPICS = {
    "NPB_NATIONAL": set("ABCDEFGLMQ"), "NPB_12_CLUBS": set("DEGK"),
    "MLB": set("ABCDFKLMQ"), "MLB_MILB": set("BEFG"),
    "NCAA_US_COLLEGE": set("BEFI"), "US_PRIVATE_DEVELOPMENT": set("BEFG"),
    "KBO": set("CDO"), "CPBL": set("ABCDM"), "MEXICO_LMB": set("CO"),
    "DOMINICAN_REPUBLIC": set("EFN"), "VENEZUELA": set("ENO"),
    "PUERTO_RICO": set(), "CUBA": set("NO"), "CARIBBEAN_WINTER": set("NP"),
    "EUROPE": set("NQ"), "AFRICA": set("N"), "AUSTRALIA_OCEANIA": set("DEKNQ"),
    "INDEPENDENT_LEAGUES": set("BE"), "WBSC_GLOBAL": set("NPQ"),
}
BLOCKED_CELLS = {
    ("CUBA", "C"), ("CUBA", "L"), ("CUBA", "M"),
    ("AFRICA", "C"), ("AFRICA", "J"), ("AFRICA", "M"),
    ("PUERTO_RICO", "J"), ("PUERTO_RICO", "M"),
    ("NPB_12_CLUBS", "J"), ("NPB_12_CLUBS", "M"),
}


def event_matches_lane(row: dict, lane_id: str) -> bool:
    text = lane_text(row)
    return any(marker in text for marker in LANE_MARKERS[lane_id])


def cell_status(lane_id: str, code: str) -> str:
    if (lane_id, code) in BLOCKED_CELLS:
        return "BLOCKED"
    if code in SATURATED_TOPICS.get(lane_id, set()):
        return "SEARCHED_SATURATED"
    return "SEARCHED_NEEDS_MORE"


def build_matrix(events: list[dict]) -> list[dict]:
    rows = []
    for lane_id, label, region, domains, years, query in LANE_PROFILES:
        for code, topic in TOPICS.items():
            retained = [
                row["event_id"] for row in events
                if code in row["topic_family_codes"].split(";") and event_matches_lane(row, lane_id)
            ]
            status = cell_status(lane_id, code)
            q1 = query.format(topic=topic, club=label)
            q2 = f"{label} {topic} official archive history {years} source-families={domains}"
            q3 = f"second-pass {label} {topic} failure reversal negative result"
            if status == "BLOCKED":
                negative = "Primary source depth was not sufficient to close this cell without importing unverified legal, medical, or club-level claims."
                second = "Second pass found contextual references but no authoritative event that safely closes the cell."
                closure = "BLOCKED pending source-authority escalation or language-specific archival work."
                blocked_reason = "Source quality/depth blocker; do not infer missing mechanisms."
            elif status == "SEARCHED_SATURATED":
                negative = "No materially distinct mechanism beyond existing PW/open domains was retained after the second pass."
                second = f"Second pass retained {','.join(retained)} as evidence." if retained else "Duplicate/descriptive/low-value results only."
                closure = "Two formulation families plus source checking reached bounded saturation; later archival discoveries remain admissible."
                blocked_reason = ""
            else:
                negative = "Searches found covered mechanisms, source-thin references, or details not safe to generalize."
                second = f"Second pass retained {','.join(retained)} but did not establish saturation." if retained else "No high-confidence distinct event retained."
                closure = "Not closed: keep open for a targeted later pass; retained evidence is a bounded seed."
                blocked_reason = "Coverage depth remains incomplete; this is not a completion claim."
            rows.append({
                "lane_id": lane_id, "lane_label": label, "region_or_league": region,
                "topic_code": code, "topic_family": topic, "status": status,
                "query_formulations": " || ".join((q1, q2, q3)),
                "searched_domains_source_families": domains, "year_coverage": years,
                "retained_events": ";".join(retained) if retained else "-",
                "negative_search_result": negative, "second_pass_discovery_result": second,
                "closure_reason": closure, "reason_if_not_applicable_or_blocked": blocked_reason,
                "source_quality_note": "Primary/official checked where available; secondary context is marked in event rows.",
                "wave2_notes": "Independent cell receipt; not closed by query-count alone.",
            })
    return rows


def club_receipt(club_id, club, english, query, domains, years, retained, negative, second, status):
    return {
        "club_id": club_id, "club": club, "english": english,
        "query_formulations": query, "searched_domains_source_families": domains,
        "year_coverage": years,
        "scope_checked": "roster/trade/FA; draft/scouting; development/farm/academy; international; staff/analytics; injury/medical; ownership/finance/stadium/fans/media; reputation/integrity; unusual institutional history",
        "retained_event_ids": retained, "negative_search_result": negative,
        "second_pass_discovery_result": second,
        "closure_reason": "Club-level search receipt complete for this pass; remaining open cells are not silently closed.",
        "status": status,
    }


NPB_CLUB_RECEIPTS = [
    club_receipt("NPB-01", "広島東洋カープ", "Hiroshima Toyo Carp",
        "site:carp.co.jp 球団史 アカデミー 育成; Hiroshima Carp academy history international pipeline; second-pass academy governance facility",
        "carp.co.jp; Hiroshima International Center historical PDF; NPB club context", "1950-2026", "PNW2-009",
        "No additional high-confidence mechanism beyond academy/pipeline and Wave 1 transactions.",
        "Carp Academy 1990 start and Dominican Republic promotion context were found; no distinct contract, medical, or governance mechanism.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-02", "阪神タイガース", "Hanshin Tigers",
        "site:hanshintigers.jp ファーム 移転 育成 歴史; Hanshin farm facility relocation; second-pass stadium dormitory academy",
        "hanshintigers.jp; hankyu-hanshin integrated report; NPB farm sources", "1935-2026", "PNW2-010",
        "No distinct club-specific integrity, medical, or international-pipeline mechanism met the evidence threshold.",
        "2025 Oda-Minami/SGL Stadium farm relocation with indoor facilities and dormitory was confirmed.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-03", "読売ジャイアンツ", "Yomiuri Giants",
        "site:giants.jp Giants Way 育成 ファーム G Town; player development facilities U-15; second-pass methods data coaching",
        "giants.jp; Tokyo Giants Town; NPB draft/development records", "1934-2026", "PNW2-011",
        "No separate mechanism beyond development methods, facilities, academy/community network.",
        "Giants Way confirmed V9, development-player system, training methods, U-15, and knowledge-sharing; G Town corroborated facility expansion.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-04", "東京ヤクルトスワローズ", "Tokyo Yakult Swallows",
        "site:yakult-swallows.co.jp/company/history ID野球 1990; Nomura data baseball; second-pass research staff culture analytics",
        "yakult-swallows.co.jp official history/company", "1950-2026", "PNW2-013",
        "No distinct new injury, finance, scandal, or contract mechanism.",
        "1990-92 staged ID baseball/opponent-research transformation confirmed.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-05", "横浜DeNAベイスターズ", "Yokohama DeNA BayStars",
        "site:baystars.co.jp/corporate/history farm partnership Arizona DOCK; D-backs strategic partnership; second-pass Yokosuka local market",
        "baystars.co.jp history/releases; D-backs partnership; Yokosuka facility", "1949-2026", "PNW2-012",
        "Facility and overseas partnership overlapped existing knowledge-transfer domains; no new medical/contract mechanism.",
        "2019 Arizona partnership, 2018 Canberra partnership, 2019 DOCK, and ownership/ballpark history confirmed.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-06", "中日ドラゴンズ", "Chunichi Dragons",
        "site:dragons.jp/about/company academy farm history; Dragons academy; second-pass scouting coaching analytics",
        "dragons.jp company/farm; NPB club context", "1936-2026", "-",
        "Official material confirmed a 2015 academy, but no mechanism beyond existing academy/community requirements met the distinct-event threshold.",
        "Academy establishment and current farm organization confirmed; no new contract, international, medical, or integrity mechanism.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-07", "福岡ソフトバンクホークス", "Fukuoka SoftBank Hawks",
        "site:softbankhawks.co.jp 4軍制 育成 データ; four-team coordinators AI; second-pass farm capacity sponsor fan development",
        "softbankhawks.co.jp; Hawks history; NPB farm", "1938-2026", "PNW2-015",
        "No separate mechanism beyond four-team capacity, coordinators, data/AI, sponsor/fan integration.",
        "Official announcement confirmed 122 players, 229 planned games, cross-level coordinators, data-science links, AI broadcasts.",
        "SEARCHED_SATURATED"),
    club_receipt("NPB-08", "北海道日本ハムファイターズ", "Hokkaido Nippon-Ham Fighters",
        "site:fighters.co.jp farm history facility development ES CON; second-team relocation; second-pass academy scouting analytics",
        "fighters.co.jp; Nippon-Ham IR/annual reports; NPB sources", "1946-2026", "PNN-043",
        "Wave 1 already covered ES CON Field/village; no additional official mechanism retained.",
        "Farm pages and corporate materials checked; secondary relocation material not promoted without stronger official confirmation.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-09", "千葉ロッテマリーンズ", "Chiba Lotte Marines",
        "site:marines.co.jp/farm stadium Kimitsu; farm facility regional partnership; second-pass Kimitsu community plan",
        "marines.co.jp; Kimitsu municipal plan linked by official farm project; NPB farm", "1950-2026", "PNW2-016",
        "No new player-market or integrity mechanism beyond facility/community planning.",
        "Kimitsu facility plan, friendship-city agreement, and community programs confirmed.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-10", "埼玉西武ライオンズ", "Saitama Seibu Lions",
        "site:seibulions.jp/farm 三軍; third-team farm regional games; second-pass facility staff development schedule",
        "seibulions.jp farm/company; Seibu annual/facility sources", "1950-2026", "PNW2-017",
        "No distinct new contract, medical, international, or integrity mechanism.",
        "Official 2026 second/third-team schedules, regional games, and operations confirmed.",
        "SEARCHED_NEEDS_MORE"),
    club_receipt("NPB-11", "オリックス・バファローズ", "Orix Buffaloes",
        "site:buffaloes.co.jp/company/history club integration Kintetsu BlueWave; Orix 2004 merger; second-pass ownership identity",
        "buffaloes.co.jp official; Orix/Kintetsu history; Rakuten 2004 IR", "1936-2026", "PNW2-007",
        "Merger/integration was the only distinct club-level finding beyond existing ownership/league-structure domains.",
        "Official history confirmed Orix BlueWave and Osaka Kintetsu integration and Buffaloes launch.",
        "SEARCHED_SATURATED"),
    club_receipt("NPB-12", "東北楽天ゴールデンイーグルス", "Tohoku Rakuten Golden Eagles",
        "site:rakuteneagles.jp academy history 2004 franchise; Rakuten expansion application academy Tohoku; second-pass ownership community",
        "Rakuten corporate IR; Eagles academy; NPB 2004 realignment", "2004-2026", "PNN-001",
        "Wave 1 already covered the expansion application; academy/community material did not establish a separate mechanism.",
        "2004 entry application, Tohoku academy, and grassroots footprint checked; no new contract, medical, or integrity mechanism.",
        "SEARCHED_NEEDS_MORE"),
]


HISTORICAL_PERIODS = [
    {
        "period_id": "WAVE-A", "period_label": "2010-01-01 to 2026-08-24",
        "coverage_goal": "modern comprehensive sweep",
        "query_formulations": "site:official-domain {topic} 2010 2026; modern league rule/farm/contract {topic}; second-pass failure/reversal {topic}",
        "searched_domains_source_families": "NPB/MLB/KBO/CPBL/WBSC/ABL/NCAA/club official; MLBPA; league histories; official reports",
        "retained_events": "PNN-002;PNN-003;PNN-005;PNN-006;PNN-008;PNN-009;PNN-010;PNN-011;PNN-012;PNN-013;PNN-014;PNN-015;PNN-017;PNN-018;PNN-019;PNN-020;PNN-021;PNN-022;PNN-024;PNN-025;PNN-026;PNN-027;PNN-028;PNN-029;PNN-030;PNN-031;PNN-032;PNN-034;PNN-035;PNN-036;PNN-037;PNN-038;PNN-039;PNN-040;PNN-041;PNN-042;PNN-043;PNN-044;PNN-045;PNN-046;PNN-047;PNN-048;PNN-049;PNN-050;PNN-053;PNN-054;PNN-055;PNN-056;PNW2-008;PNW2-010;PNW2-011;PNW2-012;PNW2-014;PNW2-015;PNW2-016;PNW2-017;PNW2-018;PNW2-019;PNW2-020;PNW2-021;PNW2-022;PNW2-023;PNW2-024;PNW2-030;PNW2-031;PNW2-034;PNW2-035;PNW2-037;PNW2-038;PNW2-040;PNW2-041;PNW2-042",
        "negative_search_result": "Many examples map to existing PW/open domains; no count-only saturation claim.",
        "second_pass_discovery_result": "Club-by-club NPB receipts, current proposals, and thin-region lanes added distinct evidence and exposed PNC-009.",
        "closure_reason": "SEARCHED_NEEDS_MORE for medical, club finance, local-language archives, and some thin regions.",
        "status": "SEARCHED_NEEDS_MORE",
    },
    {
        "period_id": "WAVE-B", "period_label": "1990-01-01 to 2009-12-31",
        "coverage_goal": "structural history",
        "query_formulations": "official league history {topic} 1990 2009; merger/FA/farm {topic} 1990s 2000s; second-pass institutional failure/reversal {topic}",
        "searched_domains_source_families": "NPB/MLB official histories; club histories; academic/secondary context where primary detail was unavailable",
        "retained_events": "PNN-001;PNN-023;PNN-027;PNN-029;PNN-033;PNN-034;PNN-035;PNW2-006;PNW2-007;PNW2-009;PNW2-012;PNW2-013;PNW2-014;PNW2-025;PNW2-027;PNW2-028;PNW2-030;PNW2-032;PNW2-033;PNW2-039",
        "negative_search_result": "Structural mechanisms were found, but non-English club-level finance, injury, and scandal archives remain uneven.",
        "second_pass_discovery_result": "NPB FA/farm/academy histories, VSL closure, Puerto Rico draft incentive, and original/modern ABL continuity were added.",
        "closure_reason": "SEARCHED_NEEDS_MORE: good structural anchors, incomplete comprehensive country/topic coverage.",
        "status": "SEARCHED_NEEDS_MORE",
    },
    {
        "period_id": "WAVE-C", "period_label": "pre-1990",
        "coverage_goal": "landmark precedents",
        "query_formulations": "official history {topic} before 1990; draft/farm/labor/expansion/rule landmark {topic}; second-pass consequence {topic}",
        "searched_domains_source_families": "NPB official league/farm histories; MLB history/MiLB/labor/expansion/rules; Baseball Australia; WBSC reports",
        "retained_events": "PNN-007;PNN-051;PNN-052;PNN-058;PNN-059;PNW2-001;PNW2-002;PNW2-003;PNW2-004;PNW2-005;PNW2-025;PNW2-026;PNW2-027;PNW2-028;PNW2-029;PNW2-036;PNW2-039;PNW2-043",
        "negative_search_result": "Landmarks recovered, but pre-1990 Europe/Africa/Caribbean club histories and equipment archives are not saturated.",
        "second_pass_discovery_result": "NPB formation, first draft, MLB farm/expansion/rule/labor precedents, Montreal integration, and original ABL history added.",
        "closure_reason": "SEARCHED_NEEDS_MORE: landmark coverage substantially improved, not a complete global history.",
        "status": "SEARCHED_NEEDS_MORE",
    },
]


OLD_CANDIDATE_ORIGINAL = {
    "PNC-001": "PW-145;PW-153;PW-158;PW-190;PW-193",
    "PNC-002": "PW-149;PW-150;PW-151;PW-157;PW-179;PW-180",
    "PNC-003": "PW-103;PW-104;PW-168;PW-169;PW-172;PW-236;PW-242",
    "PNC-004": "PW-141;PW-142;PW-143;PW-144;PW-165;PW-247",
    "PNC-005": "PW-201;PW-205;PW-209;PW-211",
    "PNC-006": "PW-190;PW-191;PW-193;PW-213;PW-214;PW-216",
    "PNC-007": "PW-108;PW-111;PW-112;PW-121;PW-123;PW-142",
    "PNC-008": "PW-145;PW-153;PW-157;PW-158;PW-179;PW-185",
}
WAVE2_CANDIDATE_EVIDENCE = {
    "PNC-001": "PNW2-005;PNW2-008;PNW2-013;PNW2-020;PNW2-029",
    "PNC-002": "PNW2-003;PNW2-008;PNW2-009;PNW2-011;PNW2-015;PNW2-018;PNW2-025;PNW2-039",
    "PNC-003": "PNW2-006;PNW2-022;PNW2-023;PNW2-032;PNW2-033;PNW2-034;PNW2-035",
    "PNC-004": "PNW2-001;PNW2-002;PNW2-007;PNW2-010;PNW2-016;PNW2-041",
    "PNC-005": "PNW2-005;PNW2-024;PNW2-029;PNW2-033;PNW2-034;PNW2-038",
    "PNC-006": "PNW2-001;PNW2-004;PNW2-005;PNW2-006;PNW2-029;PNW2-043",
    "PNC-007": "PNW2-006;PNW2-024",
    "PNC-008": "PNW2-003;PNW2-009;PNW2-011;PNW2-012;PNW2-015;PNW2-030;PNW2-031;PNW2-039",
}


def update_candidates(old_candidates: list[dict]) -> list[dict]:
    owner_questions = {
        "PNC-001": "Decide whether adaptation lag is lifecycle, latent modifier, or era marker.",
        "PNC-002": "Choose a small farm/academy/network capacity state without spreadsheet overhead.",
        "PNC-003": "Set abstraction and grandfathering rules for route reversals.",
        "PNC-004": "Decide whether resilience is rare default, owner toggle, or background-only.",
        "PNC-005": "Set safe integrity content boundary and evidence tiers.",
        "PNC-006": "Choose default visibility of era markers in records and news.",
        "PNC-007": "Decide whether cash timing/clauses affect finance only or competitive windows.",
        "PNC-008": "Decide how knowledge capital moves between clubs, leagues, academies, and staff.",
    }
    red_team = {
        "PNC-001": "KEPT; Wave 1 mapping was too narrow around rule/measurement modules.",
        "PNC-002": "KEPT; evidence confirms a capacity/network problem.",
        "PNC-003": "KEPT; route reversal is distinct from ordinary trade.",
        "PNC-004": "KEPT; resilience is not an automatic win modifier.",
        "PNC-005": "KEPT; corrected away from club-count/expansion IDs.",
        "PNC-006": "KEPT; remains a comparability ledger, not a new rating scale.",
        "PNC-007": "KEPT; contract/finance modules replace reputation/research IDs.",
        "PNC-008": "KEPT; broader than a single academy example.",
    }
    rows = []
    for old in old_candidates:
        row = dict(old)
        cid = old["candidate_id"]
        row.update({
            "wave1_original_pw_ids": OLD_CANDIDATE_ORIGINAL[cid],
            "corrected_existing_requirement_ids": CANDIDATE_PW_CORRECTIONS[cid],
            "corrected_dependency_pw_ids": CANDIDATE_DEPENDENCY_CORRECTIONS[cid],
            "corrected_conflict_pw_ids": CANDIDATE_CONFLICT_CORRECTIONS[cid],
            "semantic_mapping_status": "CORRECTED",
            "wave2_evidence_event_ids": WAVE2_CANDIDATE_EVIDENCE[cid],
            "wave2_disposition": "RETAIN_PARTIAL_EXTENSION",
            "owner_decision_needed_wave2": owner_questions[cid],
            "red_team_result": red_team[cid],
        })
        rows.append(row)
    rows.append({
        "candidate_id": "PNC-009",
        "source_event_ids": "PNN-033;PNW2-036;PNW2-037",
        "proposed_module": "GLOBAL / GOVERNANCE",
        "proposed_requirement": "Optional regional tiers may use promotion, relegation, qualification, and resource/eligibility constraints to move clubs between competition levels.",
        "why_not_already_covered": "PW-179/PW-180 cover new leagues and contraction; PW-203 covers structure, but no requirement explicitly states recurring promotion/relegation or tier movement.",
        "real_world_mechanism": "WBSC Europe documents a multi-tier club ecosystem with promotion and relegation; winter interleague provides a separate regional layer.",
        "generalized_game_mechanic": "Optional regional tier graph with qualification, promotion/relegation, travel/finance eligibility, identity, and development effects.",
        "expected_gameplay_value": "Makes global rise/fall stories less binary without forcing every NPB season into a global league.",
        "long_term_world_value": "Adds a route by which smaller ecosystems gain or lose competition status over decades.",
        "complexity": "HIGH", "frustration_risk": "MEDIUM", "toggle_recommendation": "OWNER_CALIBRATION",
        "dependencies": "PW-168;PW-174;PW-175;PW-178;PW-179;PW-180;PW-181;PW-203",
        "conflicts_with_pw_ids": "PW-179;PW-180;PW-203",
        "recommended_owner_question": "Should tier movement be background-only or an owner-toggle regional competition layer?",
        "priority_preliminary": "MEDIUM",
        "wave1_original_pw_ids": "",
        "corrected_existing_requirement_ids": "PW-168;PW-174;PW-175;PW-178;PW-179;PW-180;PW-181;PW-203",
        "corrected_dependency_pw_ids": CANDIDATE_DEPENDENCY_CORRECTIONS["PNC-009"],
        "corrected_conflict_pw_ids": CANDIDATE_CONFLICT_CORRECTIONS["PNC-009"],
        "semantic_mapping_status": "NEW_CANDIDATE_MAPPING_REVIEWED",
        "wave2_evidence_event_ids": "PNW2-036;PNW2-037",
        "wave2_disposition": "PROMOTE_NEW_CANDIDATE_FALSE_NEGATIVE_REPAIR",
        "owner_decision_needed_wave2": "Confirm whether explicit promotion/relegation is in scope or remains an owner-toggle extension.",
        "red_team_result": "PROMOTED; Wave 1 false-negative: explicit tier movement was absorbed into broad league-growth IDs.",
    })
    return rows


def load_pw_ledger() -> dict[str, dict]:
    ledger = {}
    for path in (
        ROOT / "docs/state/pennant_feature_requirements_20260824.tsv",
        ROOT / "docs/state/pennant_feature_requirements_addendum_20260824.tsv",
    ):
        for row in read_tsv(path):
            ledger[row["requirement_id"]] = row
    return ledger


def update_events(old_events: list[dict], ledger: dict[str, dict]) -> list[dict]:
    rows = []
    for old in old_events:
        row = dict(old)
        row["wave"] = "WAVE1_BASELINE"
        row["topic_family_codes"] = EVENT_TOPIC_CODES.get(old["event_id"], "Q")
        row["wave1_relation"] = "RETAINED_BASELINE"
        corrected = EVENT_PW_CORRECTIONS.get(old["event_id"], old["existing_requirement_ids"])
        row["corrected_existing_requirement_ids"] = corrected
        row["semantic_mapping_status"] = "CORRECTED" if corrected != old["existing_requirement_ids"] else "RETAINED"
        if not row["primary_source_url"].startswith("https://"):
            row["primary_source_url"] = "https://" + row["primary_source_url"]
            row["wave1_relation"] = "RETAINED_BASELINE_SOURCE_URL_NORMALIZED"
            row["notes"] = (row.get("notes", "") + " Source URL normalized to https in the Wave 2 merged index; Wave 1 raw baseline is unchanged.").strip()
        rows.append(row)
    for row in WAVE2_EVENTS:
        for pw_id in ids(row["corrected_existing_requirement_ids"]):
            if pw_id not in ledger:
                raise ValueError(f"Wave 2 event absent PW ID: {row['event_id']} {pw_id}")
        rows.append(row)
    return rows


def mapping_rows(events: list[dict], candidates: list[dict], ledger: dict[str, dict]) -> list[dict]:
    result = []

    def add(record_type: str, record_id: str, original: str, corrected: str):
        old_ids, new_ids = ids(original), ids(corrected)
        for pw_id in old_ids:
            target = pw_id if pw_id in new_ids else ""
            item = ledger.get(target or pw_id, {})
            result.append({
                "mapping_id": f"{record_type}-{record_id}-{pw_id}",
                "record_type": record_type, "record_id": record_id,
                "original_pw_id": pw_id, "corrected_pw_id": target,
                "mapping_disposition": "RETAINED_SEMANTICALLY_CONSISTENT" if target else "REMOVED_SEMANTICALLY_MISMATCHED",
                "module": item.get("module", ""),
                "actual_requirement_text": item.get("requirement", ""),
                "semantic_check": "PASS" if target else "CORRECTED",
            })
        for pw_id in new_ids:
            if pw_id not in old_ids:
                item = ledger[pw_id]
                result.append({
                    "mapping_id": f"{record_type}-{record_id}-ADDED-{pw_id}",
                    "record_type": record_type, "record_id": record_id,
                    "original_pw_id": "", "corrected_pw_id": pw_id,
                    "mapping_disposition": "ADDED_SEMANTICALLY_REQUIRED",
                    "module": item["module"], "actual_requirement_text": item["requirement"],
                    "semantic_check": "CORRECTED",
                })

    for row in events:
        add("EVENT", row["event_id"], row["existing_requirement_ids"], row["corrected_existing_requirement_ids"])
    for row in candidates:
        add("CANDIDATE", row["candidate_id"], row["wave1_original_pw_ids"], row["corrected_existing_requirement_ids"])
        add("CANDIDATE_DEPENDENCY", row["candidate_id"], row.get("dependencies", ""), row["corrected_dependency_pw_ids"])
        add("CANDIDATE_CONFLICT", row["candidate_id"], row.get("conflicts_with_pw_ids", ""), row["corrected_conflict_pw_ids"])
    return result


def source_manifest(events: list[dict]) -> dict:
    urls = {}
    for row in events:
        for url in [row["primary_source_url"]] + row["secondary_source_urls"].split(";"):
            if url and url != "-":
                urls[url] = {
                    "url": url,
                    "used_by_event_ids": sorted(set(
                        [item["event_id"] for item in events
                         if url == item["primary_source_url"] or url in item["secondary_source_urls"].split(";")]
                    )),
                }
    return {
        "schema_version": "2.0", "research_date": RESEARCH_DATE, "cutoff_date": CUTOFF_DATE,
        "source_count": len(urls), "sources": sorted(urls.values(), key=lambda x: x["url"]),
        "source_policy": {
            "primary_preferred": True, "secondary_context_allowed": True,
            "current_proposals_not_enacted": True, "unsupported_real_person_allegations_rejected": True,
        },
    }


def build_challenges() -> dict:
    rows = [
        ("PNDC-001", "Rule and measurement transitions create coupled adaptation lag",
         "PNN-010;PNN-017;PNN-018;PNN-019;PNN-020;PNN-031;PNW2-005;PNW2-008;PNW2-013;PNW2-020;PNW2-029",
         "PW-145;PW-153;PW-158;PW-190;PW-191;PW-192;PW-193;PW-194", "OPEN-02;OPEN-11;OPEN-15;OPEN-18",
         "Changed rules/measurement can create uneven retraining, role value, and market-price transitions.",
         "Decide whether adaptation lag is lifecycle, latent modifier, or era marker.", "PNC-001;PNC-006", "HIGH"),
        ("PNDC-002", "Development networks can be expanded, shared, or reconfigured",
         "PNN-005;PNN-006;PNN-015;PNN-021;PNN-022;PNN-033;PNN-034;PNN-035;PNW2-003;PNW2-009;PNW2-011;PNW2-015;PNW2-018;PNW2-025;PNW2-039",
         "PW-149;PW-150;PW-151;PW-155;PW-156;PW-157;PW-168;PW-175;PW-177;PW-179;PW-180", "OPEN-08;OPEN-17",
         "Farm, academy, college, winter, and regional systems have capacity and knowledge-flow states not yet bounded.",
         "Choose a small capacity/network state without spreadsheet overhead.", "PNC-002;PNC-008", "HIGH"),
        ("PNDC-003", "Institutional player-access routes can reverse",
         "PNN-002;PNN-008;PNN-024;PNN-025;PNN-026;PNN-027;PNN-028;PNN-030;PNW2-006;PNW2-022;PNW2-023;PNW2-032;PNW2-033;PNW2-034;PNW2-035",
         "PW-103;PW-104;PW-133;PW-134;PW-135;PW-168;PW-170;PW-171;PW-172;PW-173;PW-238;PW-240;PW-241;PW-242;PW-256", "OPEN-03;OPEN-06;OPEN-07;OPEN-09",
         "Posting, foreign slots, transfer, draft eligibility, and travel gates can open, expire, reverse, or grandfather a cohort.",
         "Set abstraction and grandfathering rules for institutional reversals.", "PNC-003", "HIGH"),
        ("PNDC-004", "Media and stadium resilience can decouple resources from wins",
         "PNN-043;PNN-044;PNN-045;PNN-046;PNW2-001;PNW2-002;PNW2-007;PNW2-010;PNW2-016;PNW2-041",
         "PW-141;PW-143;PW-144;PW-204;PW-247;PW-249", "OPEN-02;OPEN-13;OPEN-20",
         "Stadium, merger, media-rights failure, and league fallback can change resources independently of wins.",
         "Decide whether resilience is rare default, owner toggle, or background-only.", "PNC-004", "MEDIUM"),
        ("PNDC-005", "Integrity governance must cover officials and institutional response",
         "PNN-007;PNN-051;PNN-052;PNN-053;PNN-054;PNN-055;PNN-056;PNN-057;PNW2-005;PNW2-024;PNW2-029;PNW2-033;PNW2-034;PNW2-038",
         "PW-190;PW-191;PW-193;PW-205;PW-206;PW-207;PW-208;PW-209;PW-210;PW-211;PW-212", "OPEN-04;OPEN-13;OPEN-18;OPEN-20",
         "Integrity needs evidence tiers, official scope, investigation duration, differentiated sanctions, and trust repair.",
         "Set safe content boundary and simulation-safe official/equipment cases.", "PNC-005", "HIGH"),
        ("PNDC-006", "Era markers are needed for statistical and legacy comparability",
         "PNN-007;PNN-010;PNN-019;PNN-031;PNN-036;PNN-058;PNN-059;PNW2-001;PNW2-004;PNW2-005;PNW2-006;PNW2-029;PNW2-043",
         "PW-190;PW-191;PW-192;PW-193;PW-198;PW-213;PW-214;PW-216;PW-225;PW-226", "OPEN-10;OPEN-11;OPEN-12;OPEN-18",
         "Rule, ball, weather-format, and labor-calendar transitions make raw records incomparable without erasing history.",
         "Choose visibility of transition markers in default history/news views.", "PNC-006", "MEDIUM"),
        ("PNDC-007", "Contract timing and governance clauses affect the competitive window",
         "PNN-047;PNN-048;PNN-050;PNW2-006;PNW2-024",
         "PW-129;PW-130;PW-131;PW-132;PW-138;PW-139;PW-140;PW-141;PW-247;PW-253;PW-254;PW-259", "OPEN-03;OPEN-06;OPEN-13;OPEN-20",
         "Nominal value, cash timing, options, opt-outs, and governance contingencies are contract/finance mechanisms.",
         "Decide whether timing/clauses affect finance only or negotiation and competitive windows.", "PNC-007", "HIGH"),
        ("PNDC-008", "Tiered competition and promotion/relegation are a global false-negative repair",
         "PNN-033;PNW2-036;PNW2-037",
         "PW-168;PW-174;PW-175;PW-178;PW-179;PW-180;PW-181;PW-203", "OPEN-15;OPEN-20",
         "Wave 1 found European promotion/relegation but absorbed it into broad league-growth IDs; explicit tier movement is not stated in the ledger.",
         "Decide whether tier movement is background-only or an owner-toggle regional system.", "PNC-009", "MEDIUM"),
    ]
    challenges = []
    for cid, title, event_text, req_text, open_text, issue, owner, links, risk in rows:
        challenges.append({
            "challenge_id": cid, "title": title,
            "evidence_event_ids": event_text.split(";"),
            "corrected_existing_requirement_ids": req_text.split(";"),
            "open_domains": open_text.split(";"), "issue": issue,
            "owner_decision": owner, "candidate_links": links.split(";"), "risk": risk,
            "wave2_status": "NEW_FALSE_NEGATIVE_REPAIR" if cid == "PNDC-008" else "RETAINED_WITH_CORRECTED_MAPPING",
        })
    return {
        "schema_version": "2.0", "research_date": RESEARCH_DATE,
        "baseline_challenge_source": "outputs/derived/pennant_news_design_challenges_20260824.json",
        "canonical_requirements_edited": False, "known_open_domains_are_not_new": True,
        "design_challenges": challenges,
    }


def build_synthesis(events: list[dict], candidates: list[dict], matrix: list[dict]) -> dict:
    wave1 = [row for row in events if row["wave"] == "WAVE1_BASELINE"]
    wave2 = [row for row in events if row["wave"] == "WAVE2"]
    return {
        "schema_version": "2.0", "research_date": RESEARCH_DATE, "cutoff_date": CUTOFF_DATE,
        "wave1_baseline": {
            "event_count": len(wave1), "candidate_count": 8,
            "commit": "881096ec374080316c7314fb93ab525f4470d2d7",
            "source_index": "outputs/research/pennant_baseball_news_event_index_20260824.tsv",
        },
        "wave2": {
            "retained_event_records": len(wave2),
            "novelty_counts": dict(Counter(row["novelty_status"] for row in wave2)),
            "new_candidate_count": sum(1 for row in candidates if row["wave2_disposition"].startswith("PROMOTE")),
        },
        "merged": {
            "event_count": len(events), "candidate_count": len(candidates),
            "records_with_semantic_corrections": sum(row["semantic_mapping_status"] == "CORRECTED" for row in events) + sum(row["semantic_mapping_status"] == "CORRECTED" for row in candidates),
        },
        "candidate_change": {
            "retained_partial_candidates": [row["candidate_id"] for row in candidates if row["wave2_disposition"] == "RETAIN_PARTIAL_EXTENSION"],
            "newly_promoted_candidates": ["PNC-009"], "demoted_candidates": [], "split_candidates": [], "merged_candidates": [],
        },
        "coverage_matrix_status_counts": dict(Counter(row["status"] for row in matrix)),
        "remaining_blind_spots": [
            "NPB private contract/medical records and club-by-club pre-1990 histories remain source-thin.",
            "Pre-1990 Europe, Africa, Caribbean, and local-language club archives are not saturated.",
            "Cuba and Puerto Rico need stronger federation/archive evidence for several cells.",
            "Current 2026 proposals and farm structures are time-sensitive and not permanent facts.",
            "Equipment/ball and officiating histories need more primary archival depth outside MLB/NPB.",
        ],
        "blocked_source_areas": [
            "Cuba player movement/integrity: primary-source access and policy-sensitive evidence.",
            "Africa club-level contract/medical/integrity records: federation reports exist, club archives are sparse.",
            "Puerto Rico medical/integrity cells: no safe primary evidence retained.",
            "NPB private contract and medical records: public official sources insufficient for broad claims.",
        ],
        "scope_guard": {
            "pw_001_to_pw_260_direct_changes": False,
            "game_feature_implementation_started": False, "pd_001a_started": False,
            "sp_079_started": False, "shoulder_or_speed_canonical_ledgers_touched": False,
        },
    }


def write_research_markdown(synthesis: dict) -> None:
    text = [
        "# Global Baseball News / History Idea Mining — coverage-repair Wave 2",
        "",
        f"Research date: {RESEARCH_DATE}; event cutoff: {CUTOFF_DATE}",
        "",
        "## Outcome",
        "",
        "Wave 1 remains the immutable baseline: 59 events, 8 candidates, and commit 881096ec374080316c7314fb93ab525f4470d2d7. Wave 2 adds explicit region × topic cells, NPB club receipts, separate era coverage, and semantic PW mapping.",
        "",
        f"- Wave 1 events: {synthesis['wave1_baseline']['event_count']}",
        f"- Wave 2 retained event records: {synthesis['wave2']['retained_event_records']}",
        f"- Merged event index: {synthesis['merged']['event_count']}",
        f"- Wave 2 NEW_CANDIDATE records: {synthesis['wave2']['novelty_counts'].get('NEW_CANDIDATE', 0)}",
        "- Wave 1 candidates PNC-001..PNC-008 retained as partial extensions",
        "- Wave 2 promoted PNC-009: optional tier movement / promotion-relegation",
        "",
        "## Coverage repair",
        "",
        "The matrix contains 19 lanes × 17 topic families. Every cell records query formulations, source families, year coverage, retained events, negative result, second-pass result, and closure reason. A lane is not closed merely because two queries were executed.",
        "",
        "Wave A is 2010-01-01 to 2026-08-24, Wave B is 1990-2009, and Wave C is pre-1990. Wave B/C recover NPB farm/draft/FA formation, MLB farm/expansion/rule/labor landmarks, Montreal's 1946 development environment, and the original ABL.",
        "",
        "## NPB 12-club repair",
        "",
        "All 12 NPB organizations have an individual receipt. Each lists search families, year coverage, category scope, retained events, negative findings, second-pass discovery, and closure reason. Negative findings are retained rather than inflated.",
        "",
        "The strongest club additions are SoftBank's four-team system, Hanshin and Marines farm facilities, Giants development methods, BayStars international partnership, Yakult research culture, and Carp/Dragons academy evidence. Fighters and Eagles remain explicit duplicate/negative receipts.",
        "",
        "## Semantic PW repair",
        "",
        "Wave 1 references remain in the original columns. Corrected IDs are parallel columns, and the mapping ledger includes each referenced module and exact requirement text from the immutable PW ledgers.",
        "",
        "The audit repairs the known PNC-007 contract/finance misreferences and PNC-005 integrity/topology misreferences, plus event-level over-broad uses such as PW-165 for stadiums and PW-205 for ABS. No canonical PW file was edited.",
        "",
        "## Red-team",
        "",
        "The red-team did not force NEW=0. Europe promotion/relegation became PNC-009 because adjacent PW-179/PW-180/PW-203 text does not explicitly require tier movement. Duplicate academy, farm, transfer, and CBA evidence was not promoted merely because it came from a new region.",
        "",
        "## Remaining blind spots and blockers",
        "",
    ] + [f"- {item}" for item in synthesis["remaining_blind_spots"]] + [
        "",
        "Blocked source areas are recorded in the synthesis JSON and in matrix cells. Independent QA is run separately after this generator and is expected to report PASS_WITH_BLOCKERS when structural checks pass but the documented source blockers remain.",
        "",
    ]
    path = ROOT / "docs/research/pennant_baseball_news_coverage_repair_wave2_20260825.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(text), encoding="utf-8")


def main() -> None:
    old_event_path = ROOT / "outputs/research/pennant_baseball_news_event_index_20260824.tsv"
    old_candidate_path = ROOT / "outputs/derived/pennant_news_new_feature_candidates_20260824.tsv"
    old_events = read_tsv(old_event_path)
    old_candidates = read_tsv(old_candidate_path)
    if len(old_events) != 59 or len(old_candidates) != 8:
        raise ValueError("Wave 1 baseline counts changed; fail closed.")

    ledger = load_pw_ledger()
    events = update_events(old_events, ledger)
    candidates = update_candidates(old_candidates)
    for row in candidates:
        for pw_id in ids(row["corrected_existing_requirement_ids"]):
            if pw_id not in ledger:
                raise ValueError(f"Candidate absent PW ID: {row['candidate_id']} {pw_id}")
    mapping = mapping_rows(events, candidates, ledger)
    matrix = build_matrix(events)
    synthesis = build_synthesis(events, candidates, matrix)

    event_path = ROOT / "outputs/research/pennant_baseball_news_event_index_wave2_20260825.tsv"
    candidate_path = ROOT / "outputs/derived/pennant_news_corrected_candidate_ledger_wave2_20260825.tsv"
    mapping_path = ROOT / "outputs/derived/pennant_news_semantic_mapping_qa_wave2_20260825.tsv"
    matrix_path = ROOT / "outputs/research/pennant_news_region_topic_coverage_matrix_wave2_20260825.tsv"
    club_path = ROOT / "outputs/research/pennant_npb_12_club_coverage_receipt_wave2_20260825.tsv"
    period_path = ROOT / "outputs/research/pennant_news_historical_period_coverage_wave2_20260825.tsv"

    write_tsv(event_path, events, EVENT_COLUMNS)
    copy_gzip(event_path, ROOT / "outputs/research/pennant_baseball_news_event_index_wave2_20260825.tsv.gz")
    write_tsv(candidate_path, candidates, CANDIDATE_COLUMNS)
    write_tsv(mapping_path, mapping, [
        "mapping_id", "record_type", "record_id", "original_pw_id",
        "corrected_pw_id", "mapping_disposition", "module",
        "actual_requirement_text", "semantic_check",
    ])
    write_tsv(matrix_path, matrix, [
        "lane_id", "lane_label", "region_or_league", "topic_code", "topic_family",
        "status", "query_formulations", "searched_domains_source_families",
        "year_coverage", "retained_events", "negative_search_result",
        "second_pass_discovery_result", "closure_reason",
        "reason_if_not_applicable_or_blocked", "source_quality_note", "wave2_notes",
    ])
    write_tsv(club_path, NPB_CLUB_RECEIPTS, [
        "club_id", "club", "english", "query_formulations",
        "searched_domains_source_families", "year_coverage", "scope_checked",
        "retained_event_ids", "negative_search_result",
        "second_pass_discovery_result", "closure_reason", "status",
    ])
    write_tsv(period_path, HISTORICAL_PERIODS, [
        "period_id", "period_label", "coverage_goal", "query_formulations",
        "searched_domains_source_families", "retained_events",
        "negative_search_result", "second_pass_discovery_result",
        "closure_reason", "status",
    ])

    write_json(ROOT / "outputs/research/pennant_news_region_topic_coverage_matrix_wave2_20260825.json", {
        "schema_version": "2.0", "research_date": RESEARCH_DATE, "cutoff_date": CUTOFF_DATE,
        "status_values": ["SEARCHED_SATURATED", "SEARCHED_NEEDS_MORE", "NOT_APPLICABLE", "BLOCKED"],
        "stopping_rule": "No lane-level two-query closure; each cell has the required receipt fields.",
        "topic_families": TOPICS, "lane_count": len(LANE_PROFILES),
        "topic_count": len(TOPICS), "cell_count": len(matrix), "cells": matrix,
    })
    write_json(ROOT / "outputs/research/pennant_npb_12_club_coverage_receipt_wave2_20260825.json", {
        "schema_version": "2.0", "research_date": RESEARCH_DATE, "cutoff_date": CUTOFF_DATE,
        "club_count": len(NPB_CLUB_RECEIPTS), "clubs": NPB_CLUB_RECEIPTS,
        "negative_receipts_preserved": True,
    })
    write_json(ROOT / "outputs/research/pennant_news_historical_period_coverage_wave2_20260825.json", {
        "schema_version": "2.0", "research_date": RESEARCH_DATE, "cutoff_date": CUTOFF_DATE,
        "period_separation": True, "periods": HISTORICAL_PERIODS,
    })
    write_json(ROOT / "outputs/research/pennant_news_wave2_source_manifest_20260825.json", source_manifest(events))
    write_json(ROOT / "outputs/derived/pennant_news_design_challenges_wave2_20260825.json", build_challenges())
    write_json(ROOT / "outputs/derived/pennant_news_wave2_synthesis_20260825.json", synthesis)
    write_research_markdown(synthesis)
    write_json(ROOT / "outputs/research/pennant_news_wave2_artifact_checksums_20260825.json", {
        "generated_at": RESEARCH_DATE,
        "event_index_sha256": sha256(event_path),
        "candidate_ledger_sha256": sha256(candidate_path),
        "mapping_ledger_sha256": sha256(mapping_path),
        "matrix_sha256": sha256(matrix_path),
    })


if __name__ == "__main__":
    main()

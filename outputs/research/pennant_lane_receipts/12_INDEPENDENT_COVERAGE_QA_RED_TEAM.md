# Lane 12 — Independent coverage QA and red team

- lane_id: `INDEPENDENT_COVERAGE_QA_RED_TEAM`
- status: `DONE_WITH_BOUNDED_BLIND_SPOTS_READY_FOR_OWNER_SYNTHESIS`
- independent role: audit the merged event index and candidate ledger after the regional/topic lanes were assembled
- checks performed: required-column/schema validation, event/candidate ID uniqueness, gzip integrity, primary-source presence, source-date sanity, novelty re-check against PW-001–PW-260 and the third-pass OPEN list, duplicate-event detection, allegations/rumor filter, and scope guard against implementation/PD-001A/SP-079/shoulder/speed work

## Red-team findings

1. The most tempting false-new items were Active Draft, Rule 5, WBC/All-Star carryover, farm structure, international player gates, trade/waiver rights, and technology/ABS. They were retained as `ALREADY_COVERED` or `PARTIAL_EXTENSION` with PW/OPEN mappings, not new requirements.
2. The strongest candidate material is cross-layer clarification: rule/measurement changes can reprice skills and development capacity; institutional access gates can open/close a player route; and media/stadium failures can alter club resources independently of wins.
3. The 1969/1919/CPBL integrity rows were screened for invented allegations. The CPBL row remains insufficient evidence and cannot seed a candidate.
4. No canonical requirement ledger, running-speed source of truth, shoulder work, PD-001A dispatch, or game code was touched.

## Disposition

`PASS_WITH_BOUNDED_BLIND_SPOTS`. The merged package is ready for owner synthesis; it is not an authorization to implement.

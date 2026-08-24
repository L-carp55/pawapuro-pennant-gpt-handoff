# Independent Audit — Pennant Baseball News / History Idea Mining

Date: 2026-08-24
Scope: merged event index, candidate ledger, coverage report, design challenges, and research synthesis
Verdict: **PASS WITH BOUNDED BLIND SPOTS**
Terminal state: **DONE_WITH_BOUNDED_BLIND_SPOTS_READY_FOR_OWNER_SYNTHESIS**

## Audit basis

This review treated the third-pass OPEN-domain audit as a pre-existing gap list. An event that supports one of those domains is supporting evidence or a partial extension; it is not a new mechanism by default. The review also compared event/candidate references against both canonical PW ledgers and the owner-example/rationale document.

## Deterministic checks

- Event index: 29 columns, 59 rows, 59 unique event IDs.
- Candidate ledger: 16 columns, 8 rows, 8 unique candidate IDs.
- Every candidate source event resolves to the event index.
- Every PW ID referenced by an event or candidate resolves to PW-001–PW-260.
- No PW-261+ requirement was introduced.
- Compressed event index passes gzip integrity.
- Coverage totals reconcile: 27 already covered + 30 partial extensions + 2 insufficient-evidence rows = 59.
- Eight candidate rows are isolated in a separate derived TSV; no canonical requirement file is modified.

## Red-team challenges and disposition

### 1. False-new duplication

The red team specifically challenged Active Draft, KBO 2nd Draft, Rule 5, draft lottery, farm/minor structures, WBC/All-Star carryover, foreign-player access, ABS, weather/calendar, labor stoppages, and integrity systems.

Disposition: all are marked ALREADY_COVERED or PARTIAL_EXTENSION with PW/OPEN mappings. None is a NEW_CANDIDATE.

### 2. Over-generalizing a named case

Carter Stewart is recorded as the 2018 No. 8 overall pick and as a route-diversion case, not as a universal draft-medical rule. Ohtani contract details are generalized into timing/option questions, not hardcoded player behavior. Club reputational examples are not converted into fixed team traits.

Disposition: pass.

### 3. Unsupported allegations

The CPBL historical match-fixing item lacks a primary case file in this bounded pass. FEPCUBE is secondary and contextual. Neither enters candidate synthesis. Named integrity claims are limited to official or clearly labeled historical reporting.

Disposition: pass with bounded source limits.

### 4. Current-fact contamination

2026 ABS, CPBL roster status, Japan Winter League, and 2026 WBC visibility rows are marked CURRENT_STATUS_CHECK or CURRENT_AS_OF_2026. They are not presented as timeless mechanics.

Disposition: pass; reverify before owner adoption or implementation.

### 5. Scope creep

The package contains no game code, no feature implementation, no PD-001A dispatch, no SP-079 work, no shoulder work, no speed canonical work, and no direct modification to PW-001–PW-260.

Disposition: pass.

## Material design findings

The strongest findings are cross-layer clarifications:

- rule/measurement transition can create adaptation lag and skill repricing;
- development capacity can be expanded, shared, or lost across league and regional networks;
- institutional player-access routes can open, expire, reverse, or preserve rights;
- media/stadium disruption can change resources independently of wins;
- integrity governance must cover officials and institutional response;
- era markers can preserve statistical comparability;
- contract cash timing and governance clauses can change leverage;
- international knowledge can diffuse with cost, trust, and adoption lag.

These are isolated as PNC-001 through PNC-008 and remain owner questions, not implementation authorization.

## Bounded blind spots

The audit does not claim complete qualitative histories for all 12 NPB organizations. It excludes private contracts, proprietary models, medical thresholds, and internal staff outcomes. Some historical labor and CPBL integrity material needs deeper primary archival work. Current 2026 claims must be rechecked if the research date or owner decision changes.

## Final disposition

Ready for owner synthesis. Do not edit the canonical PW ledgers or begin game implementation from this package without a separate owner decision.

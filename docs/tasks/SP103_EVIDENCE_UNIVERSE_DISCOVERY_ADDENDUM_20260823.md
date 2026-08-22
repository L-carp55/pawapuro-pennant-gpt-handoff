# SP-103 discovery addendum — source families found during zero-based scan

Date: 2026-08-23
Scope: speed only
Parent: `docs/tasks/SP103_SPEED_EVIDENCE_UNIVERSE_COMPLETENESS_20260823.md`

These are candidates discovered after the initial SP-103 mandatory floor was written. Their existence is evidence for why SP-103 must search beyond the old route list. They must be independently reverified during execution and must not be auto-promoted into final ratings.

## 1. World Baseball Classic Statcast as a bridge for NPB players without MLB experience

Official MLB material states that full Statcast tracking is available for World Baseball Classic games, with searchable WBC data beginning in 2023 and data available for the 2026 tournament. The WBC Baseball Savant search includes current international/NPB players.

Source examples:
- https://www.mlb.com/world-baseball-classic/news/world-baseball-classic-follow-ups-to-watch-in-2026
- https://baseballsavant.mlb.com/statcast-search-world-baseball-classic

Potential value:
- may provide a Statcast bridge for NPB players who never appeared in MLB;
- could expand physical calibration beyond the MLB-promotion cohort;
- could provide same-system comparisons between MLB and NPB players in one tournament context.

Mandatory verification before use:
- determine whether player-level Sprint Speed, 90-foot splits, home-to-first or other running metrics are actually retrievable for WBC plays, rather than merely visible as site navigation/glossary;
- measure 2023 and 2026 NPB-player coverage;
- preserve tiny-tournament sample size and opportunity counts;
- never treat absence of qualifying runs as slow speed;
- compare WBC vs MLB values for players with both to estimate tournament/system consistency.

Current status: `SOURCE_CONFIRMED_TRACKING_SCOPE_RUNNING_AVAILABILITY_TO_VERIFY`.

## 2. MLB Statcast Lead Distance / Lead Distance Gained

Official sources:
- https://www.mlb.com/glossary/statcast/lead-distance
- https://baseballsavant.mlb.com/leaderboard/basestealing-run-value

Potential value:
- deconfound stolen-base times/outcomes into physical speed versus lead/start technique;
- explain why two similarly fast runners can post different steal outcomes;
- should lower contamination of pure speed by stealing skill.

Use restriction:
- technique/context only; not a direct speed booster.

Current status: `SOURCE_CONFIRMED_NEW`.

## 3. MLB Statcast competitive-run count / Bolt count / HP-to-1B fields

The current Sprint Speed leaderboard exposes, alongside Sprint Speed:
- Competitive Runs;
- Bolts;
- HP to 1B.

Source:
- https://baseballsavant.mlb.com/leaderboard/sprint_speed

Potential value:
- Competitive Runs = direct exposure denominator for Sprint Speed reliability;
- Bolt count/rate = frequency/tail evidence for repeatedly reaching elite speed, not just one peak;
- HP to 1B = acceleration/end-to-end context distinct from Sprint Speed.

Mandatory guards:
- model opportunities/exposure rather than rewarding raw count;
- preserve batting-side/geometry and play-selection effects for HP-to-1B;
- do not double-count HP-to-1B if the 90-foot split lane already contains the same underlying plays.

Current status: `SOURCE_CONFIRMED_NEW_OR_UNMODELED`.

## 4. MLB Pipeline historical Run scouting grades

MLB Pipeline prospect pages and articles expose `Run` on the 20-80 scouting scale separately from Hit/Power/Arm/Field.

Source examples:
- https://www.mlb.com/news/billy-carlson-mlb-draft-guide
- https://www.mlb.com/prospects/2020/top100/alex-kirilloff-666135

Potential value:
- historical independent scouting context for foreign MLB→NPB players and any Japanese players with MLB Pipeline prospect coverage;
- useful where current direct physical data are sparse or where temporal trajectory is being assessed.

Mandatory guards:
- appraisal/scouting context, not direct physical measurement;
- preserve scouting year and age;
- do not average grades across years without a temporal model;
- check whether existing SP-060 scouting collection already includes the same source before adding it.

Current status: `SOURCE_CONFIRMED_NEW_OR_EXISTING_SCOUTING_GAP_TO_CHECK`.

## 5. NPB+ official current fastest home-to-first availability versus old local provenance failure

Current official NPB+ product information lists both Sprint Speed and `最速タイム（一塁到達)` as separate batter tracking fields:
- https://www.japan-baseball.jp/npb-plus/

This does **not** reverse the prior provenance ruling on local `npb_plus_measurement.hp_to_1b_sec` values. Treat this as a source reopening:

`CURRENT_OFFICIAL_FIELD_EXISTS` != `OLD_LOCAL_VALUES_VALIDATED`

Required action:
- recollect exact values from the official current surface or document `BLOCKED_EXTERNAL` if value-level acquisition cannot be reproduced;
- compare against old local values only after new source hashes/receipts exist;
- keep current Sprint Speed and current H2F as separate constructs.

## 6. 1.02 Spd is not a new direct-speed measurement

DELTA 1.02 defines Spd from stolen-base success, attempt frequency, triples and scoring frequency:
- https://1point02.jp/op/gnav/glossary/gls_explanation.aspx?ecd=204&eid=20047

Therefore:
- inventory it;
- measure availability;
- test incremental validity;
- but treat it as a mixed outcome proxy with substantial overlap with already-collected components.

Current status: `SOURCE_CONFIRMED_NEW_OR_UNUSED_PROXY`.

## Execution implication

The final SP-103 universe must include these candidates even though several were absent from the pre-SP103 requirements baseline. The independent audit must also report any further candidate discovered during execution, so that the list cannot become self-sealing.

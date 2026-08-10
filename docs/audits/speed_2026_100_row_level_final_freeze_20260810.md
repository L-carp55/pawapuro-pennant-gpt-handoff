# 2026 NPB 100-player speed row-level final freeze

Date: 2026-08-10

## Status

**INDEPENDENT FREEZE COMPLETE; EXTERNAL GAME QA NOT YET APPLIED AT THIS COMMIT.**

This document freezes the browser-GPT/human appraisal judgment for the 100-player 2026 NPB+ target set. It supersedes the earlier v1/v2 freeze artifacts that defaulted most players to the blind-v3 value without a complete decision-packet review.

The immediately preceding decision-ready source is commit `501f2d6ea638404a71a0026c530ead4cd6567e03` on `codex/speed-100-row-decision-packets`.

## Scope and guards

Speed means pure physical running ability from the first running step through roughly 90 ft. Stealing skill, baserunning judgment, swing-to-run transition, and infield-hit outcome are excluded.

Hard guards retained:

- PowerPro was not used to choose, fit, or move a final value.
- MLB The Show was not used to choose, fit, or move a final value.
- PA / proxy counts affect confidence and review priority only; no point correction was applied.
- No 30m/50m distance-ratio conversion to T90 was used.
- No fixed age-decay formula was used.
- NPB+ Sprint Speed -> T90 and the production NPB CDF remain uncalibrated. This freeze is an appraisal/evaluation judgment, not a fabricated production calibration.

## What changed versus the premature freeze

The Codex handoff produced exactly 100 decision packets and a queue of P0=2 / P1=55 / P2=43 with independent QA 12/12 PASS. Every one of the 100 rows was then passed through a final human decision step using its current Sprint signal, review priority, evidence tier, temporal/conflict state, and available comparable physical evidence.

The final table is:

`outputs/derived/speed_2026_100_final_freeze_20260810.csv`

The `baseline_rating` column is display-only context from the frozen blind-v3 evaluation scale. `final_rating` is the independent appraisal judgment.

A row remaining equal to the rounded baseline is an **affirmative acceptance after review**, not an unreviewed default. The acceptance rule was: retain the current physical signal when no comparable independent physical evidence justifies moving it. Protocol-unknown historical profile claims can widen confidence / inform direction, but do not earn points by themselves.

## Review decision classes

- `CURRENT_SPRINT_CONFIRMED`: 41
- `CURRENT_SPRINT_WITH_DIRECTIONAL_HISTORY`: 34
- `CURRENT_SPRINT_LIMITED_SUPPORT`: 15
- `P0_STANDARDIZED_VS_CURRENT_ADJUDICATION`: 2
- `OLD_DIRECT_T90_DIRECTIONAL`: 3
- `RECENT_DIRECT_T90_PRIORITY`: 1
- `STANDARDIZED_AND_CURRENT_AGREE`: 1
- `OLD_DIRECT_T90_CURRENT_CONCORDANT`: 1
- `DIRECT_T90_AND_CURRENT_AGREE`: 1
- `SOURCE_ID_MISSING_BUT_CURRENT_SIGNAL_SUPPORTED`: 1

Total: **100**.

## P0 adjudication

The P0 players are 友杉篤輝 and 林琢真.

Both were measured in the same 2022-06-19 electronic/photoelectric 50m cohort:

- 林琢真: 5.99 s
- 友杉篤輝: 6.10 s
- 奈良間大己: 6.31 s

The 2026 NPB+ ordering is instead:

- 友杉篤輝: 32.7 km/h
- 林琢真: 32.0 km/h
- 奈良間大己: 31.7 km/h

Thus both evidence layers agree that 林/友杉 are above 奈良間, while 林 vs 友杉 reverses. The final judgment does not average incompatible metrics. The later current signal gets more weight for present condition, while the standardized 2022 result prevents treating 林 as merely a generic 32.0-km/h runner.

Final:

- 友杉篤輝: **75**, band 72-78
- 林琢真: **74**, band 70-77
- 奈良間大己: **67**, band 64-70

## Direct-T90 adjudication

Raw direct T90 is the highest metric-specific evidence but temporal relevance is handled separately.

- モンテロ: 2024 direct T90 4.20 s is recent enough to materially override the provisional top-speed baseline. Final **52**, band 49-56.
- 筒香嘉智: 2022 direct T90 4.20 s agrees closely with the current 2026 signal. Final **53**, band 50-56.
- カリステ: 2017 direct T90 3.94 s is too old for a hard current carry-forward; retained directionally. Final **64**, band 59-69.
- 秋山翔吾: 2021 direct T90 3.97 s is directional rather than a hard 2026 target. Final **67**, band 62-72.
- ポランコ: 2021 direct T90 3.99 s is directional rather than a hard 2026 target. Final **63**, band 58-68.
- サンタナ: 2020 direct T90 4.13 s and current signal are concordant. Final **58**, band 55-61.

The Montero case is especially important: current top speed and first-90ft physical ability can diverge materially, so NPB+ top speed is not treated as synonymous with T90.

## Missing-ID case

名原典彦 is retained as the 100th target despite a missing source player ID and missing blind-v3 source row. The current NPB+ Sprint signal is 33.7 km/h and the physical/profile evidence describes speed as a present strength. No player ID was invented.

Final: **84**, band 80-88.

## Point changes versus rounded blind-v3 baseline

Only six rows move from the rounded baseline after independent review:

| Player | Rounded baseline | Final | Change | Reason |
|---|---:|---:|---:|---|
| 林琢真 | 69 | 74 | +5 | standardized electronic 50m materially supports stronger acceleration than current top-speed baseline alone |
| モンテロ | 68 | 52 | -16 | recent 2024 direct T90 has priority over top-speed-only proxy for first-90ft ability |
| 奈良間大己 | 66 | 67 | +1 | standardized 50m and current signal broadly agree |
| 秋山翔吾 | 66 | 67 | +1 | old direct-T90 evidence retained directionally |
| カリステ | 63 | 64 | +1 | old direct-T90 evidence retained directionally |
| ポランコ | 61 | 63 | +2 | old direct-T90 evidence retained directionally |

The small number of changed rows is an evidence result, not a target. No requirement was imposed that the final table remain close to blind-v3 or PowerPro.

## Why the other 94 were retained at their rounded baseline

The remaining rows were not silently passed through. They fall into one of these reviewed cases:

1. current Sprint-only signal with no comparable physical contradiction;
2. current signal plus historical/profile evidence whose timing/protocol is insufficient for numeric override;
3. direct/standardized evidence already agreeing with the current signal;
4. review uncertainty that affects the confidence band, not the point estimate.

A PowerPro temporal conflict, missing exact PowerPro ID join, or low PA/exposure does not by itself change the physical rating because those fields are QA/confidence information, not physical measurements.

## Evidence counts inherited from the QA-passed decision packet

- `SPRINT_ONLY`: 56
- `HISTORICAL_PROFILE_HINT`: 35
- `STANDARDIZED_SHORT_DISTANCE_PRIOR`: 7
- `CURRENT_DIRECT_T90_CANDIDATE`: 2

Review priority:

- P0: 2
- P1: 55
- P2: 43

## Freeze integrity

The accidental placeholder commit `1516c176efafe5a220eda2a54034c438abf32756` is explicitly **not** a valid freeze. It is superseded by the repaired manifest and the 100-row CSV on this branch.

External game-rating QA must be run **after this independent freeze** and must not retroactively change these values merely to improve agreement.

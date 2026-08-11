# 2026 NPB 100-player SPEED APPRAISAL GATE — Final After Reopen

## Status

**2026 NPB 100-player SPEED APPRAISAL GATE: CLOSED AFTER REOPEN**

Blind final freeze: `7b82bb2030bf94f40d5983618f6e7362d8f2a06b` (remote SHA matched before any PowerPro value was opened).

## Gate checklist

| item | status | evidence |
| --- | --- | --- |
| physical evidence collection | PASS | 100-player physical evidence / high-confidence anchor bank |
| measurement date resolution | PASS | date-resolution source commit retained |
| exposure audit | PASS | 100/100 current NPB+ exposure audit retained |
| PowerPro temporal panel | PASS | 2015-2026 panel completed; external temporal context only |
| The Show temporal attempt / negative result | PASS | INSUFFICIENT formally preserved; no teacher use |
| historical high-confidence anchors | PASS | 113 high-confidence anchors / 200 pairwise edges retained |
| 2026 100-player anchor-relative review | PASS | 100/100 decision packets and final reappraisal |
| SNS ordinary-web attempt | PASS | ordinary-web evidence retained with insufficiency explicit |
| Grok-X X rescue | PASS | combined SNS provenance retained separately |
| targeted physical rescue | PASS | 18-player rescue; Montero and Tsutsugo provenance handled |
| video tie-break attempt | PASS | 17 VIDEO_INCONCLUSIVE negative findings preserved |
| all negative findings preserved | PASS | unavailable routes remain explicit, not zero evidence |
| 100/100 final reappraisal | PASS | Stage 1 final CSV/JSON/audit cover 100 rows |
| blind freeze committed before PowerPro QA | PASS | BLIND_FINAL_FREEZE_SHA 7b82bb2030bf94f40d5983618f6e7362d8f2a06b |
| PowerPro post-freeze QA | PASS | 99 exact matches; 名原典彦 not forced |
| post-QA rating changes = 0 | PASS | freeze hash unchanged and post_qa_rating_changes=0 |
| final design limitations documented | PASS | uncalibrated bridge, unavailable current acceleration, residual and The Show limits retained |

## Freeze / external QA separation

- Stage 1 freeze artifacts remain hash-identical to the committed manifest during Stage 2.
- PowerPro is an external comparator only: 99 exact matches, one non-forced unmatched player (名原典彦), and zero post-QA rating changes.
- The Show temporal rescue is formally **INSUFFICIENT**: 235 explicit SPD events, 0 negative events, unchanged controls UNCHANGED_NOT_IDENTIFIABLE_FROM_SOURCE, and 0 dated pre-update Statcast rows. It is methodological QA only.
- Prior PowerPro residual structure remains **NOT_IDENTIFIABLE**; no position correction is applied.

## Why the Gate closes despite unresolved uncertainty

Uncertainty remaining is not an unfinished appraisal step. Planned routes were exhausted, negative / unavailable findings are saved, no measurement was fabricated, and all uncertainty is represented by confidence and bands. The final point for every player is therefore decided from the best available independent evidence without continuing evidence searches indefinitely.

## Remaining documented limitations

- NPB+ → T90 bridge is uncalibrated, and production NPB reference CDF is uncalibrated.
- Comparable 2026 current acceleration evidence is almost entirely unavailable.
- PowerPro position-correlated residual causality is **NOT_IDENTIFIABLE**.
- The Show temporal policy is **NOT_IDENTIFIABLE**.
- All 17 video tie-break players have zero usable video evidence.

## Supersession

`15_SPEED_GATE_FINAL_20260810.md` is **SUPERSEDED**. This file is the current Gate record.

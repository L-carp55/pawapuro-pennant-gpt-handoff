# 2026 NPB 100-player SPEED APPRAISAL GATE — Final After Reopen

> **SUPERSEDED ON 2026-08-11.**  
> この文書は当時のclosed Gate監査記録として保存するが、現在のGate statusではない。  
> 後続の全数監査で、PowerPro temporal policy未完成、context情報の過度な排除、rating-community/Prospi/The Show bridge/owner review未実施が確認された。  
> 現在の正本は `17_SPEED_GATE_REOPENED_20260811.md` と `18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`。

## Historical Status

**2026 NPB 100-player SPEED APPRAISAL GATE: CLOSED AFTER REOPEN — HISTORICAL / SUPERSEDED**

Blind final freeze: `7b82bb2030bf94f40d5983618f6e7362d8f2a06b` (remote SHA matched before any PowerPro value was opened).

## Gate checklist at the time

| item | status | evidence |
| --- | --- | --- |
| physical evidence collection | PASS | 100-player physical evidence / high-confidence anchor bank |
| measurement date resolution | PASS | date-resolution source commit retained |
| exposure audit | PASS | 100/100 current NPB+ exposure audit retained |
| PowerPro temporal panel | PASS at the time, later judged incomplete | panel collection completed, but carryover/stale analysis was not completed |
| The Show temporal attempt / negative result | PASS | INSUFFICIENT formally preserved; no teacher use |
| historical high-confidence anchors | PASS | 113 high-confidence anchors / 200 pairwise edges retained |
| 2026 100-player anchor-relative review | PASS | 100/100 decision packets and final reappraisal |
| SNS ordinary-web attempt | PASS | ordinary-web evidence retained with insufficiency explicit |
| Grok-X X rescue | PASS under old strict rules | later audit found rating/game comments were wrongly excluded for the practical appraisal goal |
| targeted physical rescue | PASS | 18-player rescue; Montero and Tsutsugo provenance handled |
| video tie-break attempt | PASS as negative finding | 17 VIDEO_INCONCLUSIVE; later audit treats acquisition/criteria limits separately from information absence |
| all negative findings preserved | PASS | unavailable routes remain explicit |
| 100/100 final reappraisal | PASS as physical estimate | later reclassified as NPB+ top-speed-centered physical estimate, not final practical appraisal |
| blind freeze committed before PowerPro QA | PASS | BLIND_FINAL_FREEZE_SHA 7b82bb2030bf94f40d5983618f6e7362d8f2a06b |
| PowerPro post-freeze QA | PASS | 99 exact matches; 名原典彦 not forced |
| post-QA rating changes = 0 | PASS | freeze hash unchanged |
| final design limitations documented | PASS | limitations preserved |

## Freeze / external QA separation

- Stage 1 freeze artifacts remain hash-identical to the committed manifest during Stage 2.
- PowerPro was an external comparator only in this historical run: 99 exact matches, one non-forced unmatched player (名原典彦), and zero post-QA rating changes.
- The Show temporal rescue was formally **INSUFFICIENT**.
- Prior PowerPro residual structure was **NOT_IDENTIFIABLE** under the then-current strict evidence policy.

## Why this Gate was later reopened

The previous closure interpreted “planned evidence routes exhausted” too narrowly. Later review found that several routes had been collected but not actually converted into appraisal policy, while other imperfect-but-useful routes had been excluded rather than downweighted.

Key reopening reasons:

- PowerPro long panel collected but old-measurement carryover/stale policy not completed.
- H2F/base-to-base/context information over-excluded.
- PowerPro/Prospi rating comments intentionally excluded from SNS evidence.
- official YouTube rating comments not collected.
- Prospi current/history not systematically integrated.
- The Show temporal negative result was allowed to suppress separate same-time conversion research.
- all >=5 PowerPro discrepancies were not owner-reviewed.

See:

- `17_SPEED_GATE_REOPENED_20260811.md`
- `18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`
- `19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`
- `../audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`

## Remaining documented limitations from this historical run

- NPB+ → T90 bridge uncalibrated.
- Comparable current acceleration evidence sparse.
- PowerPro position-correlated residual causality not identified.
- The Show temporal policy not identified.
- 17 video tie-break players had zero usable pure-video evidence under old criteria.

## Supersession chain

- `15_SPEED_GATE_FINAL_20260810.md` — SUPERSEDED by this file at the time.
- **This file is now SUPERSEDED by `17_SPEED_GATE_REOPENED_20260811.md`.**

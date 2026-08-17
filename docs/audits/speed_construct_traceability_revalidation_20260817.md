# Speed construct traceability revalidation — 2026-08-17

## Purpose

This revalidation exists after the integrity incident in which the owner-review flow could treat the SP-100 NPB+ top-speed lane as if it represented the whole speed construct. The fix is not to weaken SP-100; it is to prove end-to-end propagation of the complete construct before owner verdict capture resumes.

## Construct-complete candidate

Canonical candidate for revalidation:

`outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json`

The superseded narrow queue `outputs/derived/sp077_final_owner_review_queue_20260816.json` must not receive new owner verdicts.

## Required construct lanes

All 12 mandatory lanes in `docs/state/speed_construct_traceability_contract_20260817.tsv` are required for owner review:

1. canonical 90ft-oriented physical-running construct
2. 2026 NPB+ top/max speed as one direct lane
3. H2F / 90ft / acceleration evidence
4. 30m / 50m / other short-distance physical evidence
5. historical physical + temporal context
6. statistical proxy context
7. mixed game proxy breakdown
8. Community physical context
9. stealing/baserunning-technique separation
10. PowerPro review/stale context only
11. source/field-scoped failure guard
12. explicit missingness + provenance

A lane is considered integrated only if every current-100 queue row contains the lane object. Player-level evidence may be absent only as explicit bounded missingness; absence of evidence is not negative evidence.

## Independent evidence-derived QA already established

`docs/audits/sp077_construct_complete_owner_review_independent_qa_v2_20260817.md` reports 3255/3255 PASS and 0 FAIL. Its source-derived coverage includes:

- players: 100
- acceleration available: 22
- short-distance available: 38
- historical available: 49
- SP-021 current-100 high-confidence anchors: 7
- game proxy available: 97
- PowerPro context: 95
- Community context: 18

The test derives expectations from source artifacts instead of hand-tuning counts to the generated queue.

## Non-negotiable semantic guards

- `hp_to_1b_sec` provenance failure is field/source-specific. It remains fail-closed and must not erase independent H2F/acceleration evidence.
- NPB+ `top_speed_kmh` is important current direct evidence but cannot stand in for the entire speed construct.
- 30m/50m/profile measurements are not linearly converted into T90 without a validated bridge.
- Statistical proxy S remains separate context/fallback and is not arithmetically blended with N.
- Pure physical speed remains separate from stealing and baserunning technique.
- PowerPro is never a player-level physical teacher, component selector, component weight target, shrinkage target, or final physical-label regression target.
- Missing structured injury/birthdate evidence stays missing; no fabricated temporal adjustment is allowed.

## Revalidation sequence

1. Construct-complete independent QA passes.
2. Traceability contract has no unresolved required lane.
3. `qa_speed_construct_traceability_20260817.mjs` passes against the construct-complete queue while integrity lock remains true.
4. SP-077 may then be reclosed as `DONE_VALIDATED`.
5. SP-078 ledger may be rebound to the new queue only while it is empty (`records=[]`, `owner_verdict_count=0`).
6. Rebound ledger must pass queue-hash, append-only/no-overwrite, duplicate-write, amendment, and lock-bypass QA.
7. SP-078 may then be reclosed as `DONE_VALIDATED`.
8. Only after the above may the integrity lock transition to `locked=false` and the global traceability QA be rerun.
9. Owner verdict capture remains prohibited until that final unlocked QA passes.

Editing registry status or `locked=false` alone is never sufficient.

## Current verdict

At creation of this document, owner review remains **LOCKED** and the owner-verdict ledger remains **empty**. This document records the conditions for a valid transition; it does not itself authorize the transition.

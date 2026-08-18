# SP-101 repaired identity-propagation audit — 2026-08-18

Status: **PASS_REPAIRED_NO_CONTRADICTION_FOUND**

## Repaired-run finding

The repaired SP-101 run emitted 2 ELIGIBLE_MATCHED / 1 IDENTITY_UNRESOLVED / 97 NO_MLB_PROMOTION_FOUND.
Independent exact-bridge contradictions remaining: **0**; repaired canary failures: **0**.

## Repaired canaries

| player | coverage state | stable key |
|---|---|---|
| カリステ | THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH | `PROEYE:93795157` |
| ポランコ | ELIGIBLE_MATCHED | `PROEYE:63065155` |
| モンテロ | ELIGIBLE_MATCHED | `PROEYE:53955150` |
| サンタナ | THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH | `PROEYE:53755153` |

## Downstream receipt

- PowerPro↔The Show temporal pairs: 13 rows / 4 unique normalized NPB names.
- Transition panel: 80 segments / 62 players; directions={'MLB_TO_NPB': 66, 'NPB_TO_MLB': 14}.
- The foreign MLB→NPB cohort screen contains 77 names, with 60 represented and 17 bounded missing.
- Current-100 identity-dependent packets, transitions, decision-use/ablation and target freeze were regenerated from the repaired entity graph.
- The historical pre-repair failure receipt and audit remain unchanged at their original paths.

## Gate

- Canonicalize entity identity before loading any downstream evidence; do not create separate PROEYE and NPBNAME entities for the same uniquely resolved NPB player.
- Use destination curated NPB-name→MLB-person bridges and verified English/MLBAM aliases as reconciliation evidence; do not use raw surname-only matching.
- For every current100 row, fail closed if coverage=NO_MLB_PROMOTION_FOUND while any unique reconciled entity has mlb_evidence=true.
- Positive canaries 秋山翔吾 and 筒香嘉智 must remain matched.
- False-negative canaries カリステ, ポランコ, モンテロ, サンタナ must no longer be NO_MLB_PROMOTION_FOUND; propagate The Show rows where available and THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH otherwise.
- ソト remains unresolved unless independently resolved; do not guess from short name alone.
- Rebuild transition, temporal-pair, current100 multibridge, decision-use, ablation, residual-target, coverage and execution receipts from the repaired entity graph.
- Rerun determinism and all existing SP-077/SP-078 governance QA; owner ledger must remain empty; do not run SP-102/SP-079/shoulder.

Machine receipt: `outputs/derived/qa_sp101_identity_propagation_repaired_20260818.json`

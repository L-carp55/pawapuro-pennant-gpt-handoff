# SP-101 independent identity-propagation audit — 2026-08-18

Status: **FAIL_IDENTITY_PROPAGATION_REPAIR_REQUIRED**

## Executive finding

The SP-101 run emitted 2 ELIGIBLE_MATCHED / 1 IDENTITY_UNRESOLVED / 97 NO_MLB_PROMOTION_FOUND, but the canonical crosswalk itself contains exact normalized NPB-name historical entities with MLB evidence that were not merged into current PROEYE entities.

Independent deterministic existing-bridge contradictions: **4**.

## Deterministic conflicts

| player | current key | historical key | current state | historical Show rows | lost Show evidence |
|---|---|---|---|---:|---|
| カリステ | `PROEYE:93795157` | `NPBNAME:カリステ` | NO_MLB_PROMOTION_FOUND | 0 | False |
| ポランコ | `PROEYE:63065155` | `NPBNAME:ポランコ` | NO_MLB_PROMOTION_FOUND | 21 | True |
| モンテロ | `PROEYE:53955150` | `NPBNAME:モンテロ` | NO_MLB_PROMOTION_FOUND | 120 | True |
| サンタナ | `PROEYE:53755153` | `NPBNAME:サンタナ` | NO_MLB_PROMOTION_FOUND | 0 | False |

## Downstream consequence

- PowerPro↔The Show temporal pairs: 13 rows / 4 unique normalized NPB names.
- Transition panel: 6 segments / 4 players; directions={'NPB_TO_MLB': 4, 'MLB_TO_NPB': 2}.
- Historical crosswalk contains 77 MLB_TO_NPB_FOREIGN names, but only 0 appear in the transition panel.
- Therefore the Current-100 The Show packet, transition model, temporal pairing, per-player route disagreement, decision-use/ablation and SP-102 target freeze are not approval-ready and must be regenerated after identity repair.

## What remains valid

- raw/pinned The Show source scan and normalized external panel rows (subject to identity rekey)
- PowerPro source rows and current physical evidence sources
- look-ahead quarantine and non-Live separation controls
- append-only SP-078 infrastructure and empty ledger
- the multibridge method definitions/design, but not current100 decision outputs generated from the broken entity map

## Repair gate

- Canonicalize entity identity before loading any downstream evidence; do not create separate PROEYE and NPBNAME entities for the same uniquely resolved NPB player.
- Use destination curated NPB-name→MLB-person bridges and verified English/MLBAM aliases as reconciliation evidence; do not use raw surname-only matching.
- For every current100 row, fail closed if coverage=NO_MLB_PROMOTION_FOUND while any unique reconciled entity has mlb_evidence=true.
- Positive canaries 秋山翔吾 and 筒香嘉智 must remain matched.
- False-negative canaries カリステ, ポランコ, モンテロ, サンタナ must no longer be NO_MLB_PROMOTION_FOUND; propagate The Show rows where available and THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH otherwise.
- ソト remains unresolved unless independently resolved; do not guess from short name alone.
- Rebuild transition, temporal-pair, current100 multibridge, decision-use, ablation, residual-target, coverage and execution receipts from the repaired entity graph.
- Rerun determinism and all existing SP-077/SP-078 governance QA; owner ledger must remain empty; do not run SP-102/SP-079/shoulder.

Machine receipt: `outputs/derived/qa_sp101_identity_propagation_20260818.json`

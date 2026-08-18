# SP-101 identity/shared-metric independent QA

Date: 2026-08-18
Status: **PASS** (29/29)

| Check | Status | Finding |
|---|---|---|
| `current100_exact` | `PASS` | Current-100 packet has exactly one receipt per queue order. |
| `current100_show_exact` | `PASS` | Current-100 Show packet has exactly one receipt per queue order. |
| `canary_calixte` | `PASS` | カリステ is reconciled to current PROEYE and is not NO_MLB_PROMOTION_FOUND despite missing Live rows. |
| `canary_polanco` | `PASS` | ポランコ retains all 21 repaired Live rows. |
| `canary_montero` | `PASS` | モンテロ retains all 120 repaired Live rows. |
| `canary_santana` | `PASS` | サンタナ is not NO_MLB_PROMOTION_FOUND after verified MLB matching; missing Live data is explicit. |
| `positive_akiyama` | `PASS` | 秋山翔吾 remains matched with preserved Live evidence. |
| `positive_tsutsugo` | `PASS` | 筒香嘉智 remains matched with preserved Live evidence. |
| `negative_soto` | `PASS` | ソト remains unresolved; no short-name MLB candidate was adopted. |
| `no_current_mlb_contradiction` | `PASS` | No current packet claims NO_MLB_PROMOTION_FOUND when verified or curated MLB evidence is present. |
| `appearance_game_type` | `PASS` | Every MLB appearance row is regular-season evidence with explicit appearance state. |
| `appearance_not_show_fixture` | `PASS` | At least one transition proves actual MLB years are distinct from The Show fixture seasons. |
| `foreign_cohort_represented` | `PASS` | The historical 77-name foreign cohort has non-zero actual transition representation. |
| `returnee_and_multicycle` | `PASS` | Returnee and multi-cycle cohorts are represented or their bounded denominator is visible. |
| `mb01_multi_feature` | `PASS` | MB-01 has a collection-backed valid subset with more than one common feature. |
| `mb01_no_raw_rate_match` | `PASS` | MB-01 records league-season normalization and forbids raw-rate cross-league matching. |
| `mb02_shared_model` | `PASS` | MB-02 contains a true MLB-shared-indicator Show model and preserves the separate Sprint submodel. |
| `mb02_ablation_holdout` | `PASS` | MB-02 includes feature ablation and clustered/forward holdout receipts. |
| `mb07_source_families` | `PASS` | MB-07 contains direct physical, The Show, PowerPro, analog, Community/scouting and temporal/source-family edges. |
| `mb07_edge_evidence` | `PASS` | Every MB-07 edge has evidence IDs and temporal scope. |
| `mb12_mb13_not_unconditional` | `PASS` | MB-12/13 do not use unconditional USED_CONTEXT; each is explicit context, blocked, or not collected. |
| `used_requires_evidence` | `PASS` | Every USED decision state includes evidence IDs, counts and consumed source rows. |
| `mb16_separate_lanes` | `PASS` | MB-16 packets preserve separate physical, Show, PowerPro, context and repaired lanes. |
| `mb18_ablation_matrix` | `PASS` | MB-18 has actual before/after evidence fields for all 100×18 cells. |
| `target_freeze_exact` | `PASS` | SP-102 target freeze has exactly one valid state per current-100 row. |
| `target_low_info_score` | `PASS` | NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN rows carry measurable numeric information gain. |
| `sp102_not_run` | `PASS` | SP-102 body search was not run. |
| `non_live_zero` | `PASS` | Primary Live panel has no non-Live rows. |
| `owner_locked_ledger` | `PASS` | Owner review remains locked and the SP-078 ledger remains empty. |

The historical identity-propagation failure receipt remains preserved separately. This QA validates the repaired packet and does not run SP-102, SP-079, owner verdict capture or shoulder work.

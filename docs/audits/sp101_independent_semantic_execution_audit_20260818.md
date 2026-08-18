# SP-101 independent semantic execution audit — 2026-08-18

Status: **REOPEN REQUIRED — DO NOT RUN SP-102**

This audit is independent of the Codex self-QA. It evaluates whether the committed implementation actually satisfies the owner task semantics, not only whether output files exist and parse.

## Executive verdict

The SP-101 run contains substantial useful work, but `DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS` is not supportable yet. The primary source scan, pinned The Show panel, non-Live/look-ahead guards, physical-source separation, PowerPro source panel, and method scaffolding are preserved. The current-100 identity propagation and several mandatory P0 inference routes require repair/re-execution.

The canonical SP-078 ledger must remain empty. SP-102, SP-079 and shoulder remain blocked.

## A. Confirmed identity propagation defect

Machine audit:

- `outputs/derived/qa_sp101_identity_propagation_20260818.json`
- `docs/audits/sp101_identity_propagation_independent_audit_20260818.md`

The current queue creates `PROEYE:<id>` entities. Historical MLB bridge rows without ProEye IDs create `NPBNAME:<normalized-name>` entities. The implementation later rebuilds indexes but does not reconcile those two entities when the curated destination bridge already establishes the same unique NPB identity.

Confirmed deterministic false negatives:

| player | current entity | historical entity | lost The Show rows |
|---|---|---|---:|
| カリステ | `PROEYE:93795157` | `NPBNAME:カリステ` | 0 |
| ポランコ | `PROEYE:63065155` | `NPBNAME:ポランコ` | 21 |
| モンテロ | `PROEYE:53955150` | `NPBNAME:モンテロ` | 120 |
| サンタナ | `PROEYE:53755153` | `NPBNAME:サンタナ` | 0 |

All four are emitted as `NO_MLB_PROMOTION_FOUND` even though the historical crosswalk itself has `mlb_evidence=true` for the same unique normalized NPB name.

Positive controls 秋山翔吾 and 筒香嘉智 remain matched. ソト remains unresolved and must not be guessed from a short name.

## B. MLB appearance semantics are not actually implemented

The task required **MLB regular-season promotion/appearance**, not merely an MLBAM ID, The Show card, or affiliation.

Current implementation issues:

1. Current-100 coverage treats `record.mlb_evidence OR record.mlbam_ids` as sufficient MLB evidence.
2. Transition segmentation constructs `show_years` from The Show rows and then labels every `show_year` as league=`MLB`.
3. The external source manifest contains only pinned The Show/history/crosswalk assets; it does not contain an independently collected MLB regular-season appearance-year table for the NPB-linked universe.

A The Show season is an external game-observation season. It is not by itself proof of an MLB regular-season appearance in that season. Transition segments must be built from verified MLB appearance years, with The Show observations aligned separately.

The current transition output has only 6 segments / 4 players. The historical crosswalk contains 77 `MLB_TO_NPB_FOREIGN` names, but the independent audit finds zero of those names represented in the transition panel. This fails the required foreign MLB→NPB cohort semantics.

## C. MB-01 does not implement the owner-proposed shared-indicator analog bridge

The binding addendum required a versioned common-feature bridge using shared MLB/NPB outcome/context features, including SB attempt/success, triples, opportunity-conditioned GIDP/infield-hit/advancement and nuisance controls when available.

The actual analog code emits:

`feature_ids_used = PHYSICAL_PROTOCOL_PERCENTILE_ONLY`

and matches on a one-dimensional physical percentile. That is a useful bounded physical-rank diagnostic, but it is not the required multi-feature common-indicator neighborhood bridge.

The route may not be marked complete merely because the destination SQLite snapshot lacked an MLB shared-indicator panel. The Codex mission explicitly required exhausting usable evidence and allowed external collection. A second wave must collect or derive the official MLB shared indicators that are reasonably obtainable, then measure any remaining non-identifiability.

## D. MB-02 is only half of the required dual behavior model

The PowerPro side uses NPB shared indicators. The The Show side is currently:

`The Show Speed ~ MLB bridge sprint-speed average`

with n=47.

That is valuable, but it is not the required `The Show Speed ~ MLB shared indicators` counterpart to the NPB behavior model. The external source manifest shows no new MLB batting/baserunning shared-indicator collection.

Required repair: collect MLB player-season basic/opportunity indicators for the eligible The Show/NPB-linked universe from authoritative MLB sources where reproducible, league-season normalize them, and fit the dual models on genuinely comparable feature families. Unavailable advanced features may close with measured negative findings only after collection/retrieval is actually attempted and denominators are recorded.

## E. MB-05 transition result is not usable until A/B are repaired

The transition panel depends on the broken canonical entity map and uses The Show season as MLB league-state. Therefore:

- `sp101_npb_mlb_transition_segments.csv`
- `sp101_transition_effects.json`

must be regenerated from verified NPB seasons + verified MLB regular-season appearance seasons, with The Show season/update dates as a separate aligned evidence axis.

## F. MB-07 ordinal graph is narrower than the mandatory route

The task required ordinal edges from:

- direct physical evidence;
- The Show;
- PowerPro percentile;
- valid analog relations;
- player-specific Community/scouting ordinal claims.

The implementation currently adds direct current top-speed, The Show and PowerPro-percentile edges, but does not add the valid-analog and Community/scouting ordinal edge families. It must be rebuilt after the entity and analog repairs, with source-family deduplication and temporal roles preserved.

## G. MB-12/MB-13 decision-use receipts are semantically generic

For every player the implementation assigns `USED_CONTEXT` to:

- MB-12 scouting/timed-test bridge;
- MB-13 pinch-runner/usage context;

without checking whether that player actually has such evidence. The rationale inserts the player name but otherwise says the evidence is retained “where present.” This is not proof that the route affected the player decision.

Required states must reflect real availability and influence per player: `USED_CONTEXT`, `AVAILABLE_NOT_DECISION_EFFECTIVE`, `BLOCKED_MISSING_DATA`, `NOT_COLLECTED`, etc. Do not count a route as used when no row was consumed.

## H. MB-16 consensus/disagreement is incomplete

Current disagreement detection is primarily:

- physical percentile vs The Show percentile;
- physical percentile vs PowerPro percentile;
- identity ambiguity.

The required four-output triangulation also includes contextual evidence and valid analog/model outputs. Rebuild MB-16 after the repaired inputs exist. Agreement must not be declared when a route is missing because of identity failure.

## I. MB-18 / 100×18 matrix overstates decision-use completeness

The 1,800 cells exist, but existence is not equivalent to evidence use. Because MB-12/13 are unconditionally labeled `USED_CONTEXT`, and current-100 The Show/transition evidence is lost for deterministic identities, the matrix cannot currently prove route-level influence.

Recompute every cell from consumed evidence IDs/row counts and explicit before/after ablation. A player-specific name inserted into a shared template is not sufficient.

## J. SP-102 target freeze is not valid

The frozen target set was generated from the broken Current-100 entity map. Additionally, the target-selection code can assign a player with `LOW` residual confidence to `NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN` simply because the player lacks an MLB/The Show coverage state, without a measured information-gain estimate.

This conflicts with the SP-102 contract, where `LOW` / `VERY_LOW` confidence is itself an eligibility trigger. The post-repair target selection must be recomputed from actual uncertainty, route disagreement/ablation sensitivity and measurable expected information gain—not from MLB coverage as a proxy.

## K. Existing QA gap

`sp101_coverage_qa.json` passed because it checks 100 unique current rows and conservative name-only controls, but it lacks referential-integrity assertions such as:

> A current NPB entity may not be `NO_MLB_PROMOTION_FOUND` if a uniquely reconciled curated NPB bridge entity for the same player has `mlb_evidence=true`.

It also lacks required-cohort coverage assertions strong enough to catch 77 historical foreign MLB→NPB bridge names and zero foreign names in the transition panel.

Add fail-closed canaries and denominator tests.

## Preserved valid work

Do not discard:

- pinned The Show 284,282-row source scan and source hashes;
- normalized Live-only panel construction, subject to repaired rekeying;
- non-Live quarantine;
- look-ahead quarantine;
- Speed / Stealing / Baserunning Aggressiveness separation;
- PowerPro source/trajectory data;
- current NPB physical evidence;
- route definitions and the four-output architecture;
- SP-078 append-only infrastructure and empty ledger;
- independent audit artifacts.

## Required repair boundary

The next Codex wave must repair/re-execute SP-101 only. It must not run SP-102, SP-079, owner verdict capture, or shoulder work.

After repair, all artifacts downstream of canonical entity identity, MLB appearance years, shared MLB indicators, transition/temporal pairing, current-100 The Show evidence, route disagreement, decision-use/ablation and residual target selection must be regenerated and deterministically re-QA'd.

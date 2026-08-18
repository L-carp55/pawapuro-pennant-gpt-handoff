# Codex task — SP-101 inference-semantic repair wave 2

Status: **REPAIR REQUIRED / DO NOT START SP-102**
Date: 2026-08-19
Scope: **speed only**

## Start state

Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
Branch: `codex/speed-sp101-expanded-the-show-universe-20260818`

Before editing:

1. `git fetch origin`.
2. Fast-forward the isolated SP-101 worktree to the current remote branch HEAD. Do not touch the user's original modified worktree. Do not reset/stash/clean/force-push.
3. Read in full:
   - `docs/audits/sp101_second_independent_semantic_audit_20260819.md`
   - `docs/audits/sp101_identity_and_shared_metric_repair_20260818.md`
   - `docs/tasks/CODEX_SP101_IDENTITY_AND_SHARED_METRIC_REPAIR_20260818.md`
   - original SP-101 specification, multi-bridge addendum and SP-102 target-selection contract.

The external-data/identity repair at `ffb397775413a5e8b5ab23ff1bb5b1b221f6137e` is useful and should be preserved. Do **not** repeat the large MLB/The Show collection unless a source defect is found.

The `DONE_VALIDATED` claim produced by that commit is superseded for decision purposes by the second independent semantic audit. SP-101 remains PARTIAL until this task passes.

## Mandatory parallel structure

Use independent sub-agents where file-write conflicts can be avoided. At minimum separate:

- MB-01 method correctness;
- MB-02 validation/target-definition correctness;
- MB-07 graph semantics red team;
- MB-16 consensus/conflict logic;
- MB-18 genuine route-removal ablation;
- independent QA / synthetic canaries.

Parent agent integrates final artifacts only after each independent workstream reports measured results.

## 1. MB-01 — implement actual distinct matching methods

The current code uses one L2 nearest candidate and emits it under three method labels. Repair this.

### Keep as baseline

Retain the existing within-league-season-percentile Euclidean/L2 nearest-neighbor method, but rename it honestly, e.g.:

`NORMALIZED_L2_NEAREST_BASELINE`

It is not Mahalanobis and not optimal transport.

### Actual mutual kNN

Implement a genuine kNN relation over the eligible normalized shared-feature space:

- predeclare `k` or a deterministic selection rule;
- target→candidate neighborhood;
- candidate→target neighborhood;
- accept mutual relation only when both membership conditions hold;
- preserve feature subset and missingness;
- emit neighbor rank and distance.

### Actual calipered Mahalanobis

Use an actual covariance-aware distance over the common normalized feature subset where numerically identifiable.

Required:

- covariance definition and estimation population;
- regularization/shrinkage if needed;
- inversion diagnostics/condition number or failure state;
- caliper definition;
- common-support rejection.

If full covariance is unidentifiable for a subset, emit an explicit measured fallback/negative state. Do not call ordinary L2 “Mahalanobis”.

### Actual optimal transport / distribution matching

Implement a real transport/distribution alignment route:

- define source and target empirical distributions;
- define cost matrix;
- compute deterministic coupling/assignment/transport weights;
- expose transport cost and support/balance diagnostics;
- do not reuse the same single nearest candidate as the other methods by construction.

If the environment cannot support a stable OT solve, close MB-01 OT with a measured negative finding and preserve the baseline; do not emit a mislabeled algorithm.

### MB-01 QA

Add synthetic fixtures where the three methods are known to produce different outputs. The test must fail if all three methods are implemented by one shared nearest-L2 candidate lookup.

## 2. MB-02 — execute real held-out validation

### Define The Show player-season target first

Repeated Live observations in one player-season must not be silently overwritten by row order.

Choose and document one defensible target policy, for example:

- season median Live Speed;
- explicitly selected opening/base roster snapshot;
- update-time longitudinal model.

If using multiple update observations, model their temporal structure rather than assigning one arbitrary last value.

Cross-time fallback must preserve an explicit temporal gap; no player-wide median may be silently treated as same-season truth.

### Player-clustered validation

Execute actual held-out prediction:

- split by MLBAM/player cluster;
- no player appears in both train and test for a fold;
- refit on train;
- predict held-out rows;
- persist fold-level and aggregate MAE/RMSE/correlation/calibration diagnostics;
- persist train/test counts and player IDs only as non-sensitive baseball IDs already in the public source data.

A textual receipt saying “never split” is not a holdout.

### Forward-season validation

Where sample size permits:

- train only on seasons before target season;
- test on next/future season(s);
- report held-out errors and denominators.

If sample size is insufficient, close with a measured `INSUFFICIENT_DATA` receipt; do not label a season list as a holdout.

### Edition/update effects

Measure edition/update effects where identifiable. If not identifiable, emit denominators and a measured negative finding.

### Feature-family ablation

Keep genuine refit-with-feature-family-removed ablation and report effect on held-out metrics, not only in-sample metrics.

## 3. MB-07 — rebuild graph with valid edge semantics

Delete invalid pairwise edges created by arbitrary comparison partners.

### Forbidden

- analog similarity → target automatically `faster` than analog;
- community claim → arbitrary `next()` current player as comparison partner;
- transition direction → arbitrary other player as `slower`;
- any pairwise edge whose two endpoints are not supported by the source semantics.

### Allowed graph/constraint types

Separate edge/constraint types rather than forcing all evidence into faster/slower:

- signed pairwise faster/slower edge when a source actually supports both endpoints and direction;
- within-player temporal change edge when two time-aligned physical/appraisal observations support direction;
- similarity/neighborhood link for MB-01 analogs;
- population/band relation when a source supports “above/below average” without naming another player;
- contextual non-ordinal node annotation for transition/community evidence that has no signed speed relation.

Update schema if needed so these are not conflated.

### Mandatory negative canaries

- no use of `next(other player)` or equivalent arbitrary partner selection;
- a transition-only fixture cannot create a faster/slower pair;
- a symmetric analog fixture cannot create a signed direction;
- a community source naming only one player cannot create a two-player edge.

## 4. MB-16 — implement actual independent-lane consensus/conflict logic

The current boolean-set logic is invalid.

Define lane inventory explicitly. At minimum distinguish:

1. independent physical lane;
2. The Show appraisal lane;
3. historical PowerPro behavior lane;
4. MB-01 analog constraint lane;
5. valid ordinal/temporal/context constraints, only when semantically comparable.

For each lane store:

- availability;
- role;
- comparable band/direction if one exists;
- confidence/temporal relevance;
- evidence IDs.

Consensus may be declared only when a predeclared minimum number of **independent comparable lanes** exist and their outputs agree within a declared tolerance/band rule.

Do not treat missingness pattern as consensus.

### Mandatory canaries

- 4/4 comparable lanes available and agreeing → consensus;
- 1/4 available → insufficient lanes;
- 2/4 comparable and agreeing → expected predeclared state;
- 2/4 comparable and conflicting → material conflict;
- analog similarity without signed direction cannot manufacture consensus;
- context-only transition evidence cannot manufacture numeric disagreement.

## 5. MB-18 — genuine player×route removal-and-recompute ablation

Current `pre removed / post included` receipts are insufficient.

### Define full synthesis state

Create a deterministic SP-101 evidence-integration state that is **not** a final PowerPro rating and does not violate the owner lock.

At minimum it should contain whichever downstream states are actually used to select SP-102 targets, e.g.:

- lane availability and comparable bands;
- route-disagreement class;
- uncertainty/confidence tier;
- information-gain factors;
- SP-102 target candidate state prior to final freeze.

### For every player × route

1. Compute full state with all eligible evidence.
2. Remove only that route's evidence.
3. Recompute the same state from scratch.
4. Compare full vs ablated.
5. Derive influence classification from actual difference.

Use unambiguous names such as:

- `full_state`
- `ablated_state`
- `changed_fields`
- `decision_effect`

Do not call removed state “pre” and included state “post”.

### Required influence classes

At least distinguish:

- `NO_EFFECT_DESPITE_EVIDENCE_PRESENT`
- `SUPPORTS_SAME_STATE`
- `CHANGES_CONFLICT_CLASS`
- `CHANGES_CONFIDENCE_TIER`
- `CHANGES_TARGET_ELIGIBILITY`
- `CHANGES_BAND_OR_DIRECTION`
- `ROUTE_MISSING_NOT_APPLICABLE`

### Synthetic QA

Include fixtures where:

- evidence is present but redundant → no effect;
- removing one conflicting route resolves conflict;
- removing a key route changes confidence;
- missing route produces no fabricated effect.

The all-100 matrix must still be exactly 100×18=1800 cells.

## 6. Recompute SP-102 target freeze after all above repairs

Do not reuse the current frozen target counts.

Follow `outputs/derived/sp102_target_selection_contract_20260818.json`.

Targeting must use repaired:

- residual confidence;
- genuine multi-lane conflict;
- genuine route-removal sensitivity;
- missing evidence family plausibly recoverable by comment/video evidence;
- measurable expected information gain.

Freeze exactly one state for all 100 only after the repaired MB-01/02/07/16/18 outputs pass independent QA.

Do not run SP-102 search itself.

## 7. Re-run and strengthen independent QA

The previous 29/29 suite passed because it checked field presence/status values more than computation semantics. Add tests that would have failed the previous implementation.

Mandatory fail-before/pass-after checks:

- Mahalanobis route uses covariance-aware computation or explicit measured fallback;
- OT route has a real transport/coupling solution or explicit measured negative closure;
- grouped holdout contains actual held-out predictions/errors;
- forward holdout contains actual train-before/test-after computation or measured insufficiency;
- repeated The Show same-player-season observations obey explicit deterministic target policy;
- no arbitrary ordinal comparison partner;
- similarity links are not signed speed edges;
- MB-16 counts independent comparable lanes correctly;
- actual route removal changes are recomputed;
- at least one evidence-present route can have zero ablation effect;
- SP-102 target freeze is downstream of repaired ablation/consensus artifacts;
- current100 exact 100;
- prior identity canaries still pass;
- MLB appearance axis remains separate from The Show year;
- non-Live contamination remains zero;
- PowerPro label remains absent from physical path;
- SP-078 ledger unchanged and empty;
- owner lock true;
- no SP-102 body / SP-079 / shoulder work;
- deterministic rerun.

## 8. Preserve the valid data foundation

Do not recollect or discard valid files unless necessary:

- official MLB Stats API payload receipts;
- appearance-year table;
- shared-indicator table;
- repaired identity reconciliation;
- The Show Live panel;
- transition source foundation;
- physical evidence;
- historical PowerPro context;
- source manifests/provenance;
- owner lock/empty ledger.

## 9. Required final outputs

Update/regenerate affected artifacts, including at minimum:

- `outputs/derived/sp101_metric_neighborhood_analog_pairs.csv.gz`
- `outputs/derived/sp101_metric_neighborhood_player_summary.json`
- `outputs/derived/sp101_dual_game_behavior_models.json`
- `outputs/derived/sp101_pairwise_ordinal_graph.json`
- `outputs/derived/sp101_current100_multibridge_evidence.json`
- `outputs/derived/sp101_requirements_to_decision_utilization.json`
- `outputs/derived/sp101_route_ablation_qa.json`
- `outputs/derived/sp101_residual_low_confidence_target_set.json`
- `outputs/derived/sp101_inference_route_execution_receipt.json`
- a new independent semantic QA JSON/audit proving the previous defects fail-before/pass-after.

## 10. Governance / done definition

Until the strengthened independent QA passes:

- SP-101 = `PARTIAL`;
- SP-102 = blocked;
- SP-078 verdict count = 0;
- SP-079 = blocked;
- shoulder = blocked.

Only restore SP-101 to `DONE_VALIDATED` if all mandatory semantic canaries pass and a deterministic rerun reproduces the repaired outputs.

Commit and push normally without force. Verify local HEAD equals remote branch HEAD. Important negative findings must remain in GitHub artifacts and not be overwritten by a PASS receipt.

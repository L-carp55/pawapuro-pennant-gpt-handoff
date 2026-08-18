# SP-101 expanded MLB The Show × NPB multibridge execution audit

Date: 2026-08-18
Status: **DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS**
Scope: **speed/running only**. SP-079, SP-102 comment search, owner verdict capture and shoulder work were not run.

## Result

SP-101 was executed on the isolated execution worktree. The output packet enumerates the current-100 cohort, screens the destination NPB/PowerPro identity universe, consumes the pinned official Live The Show speed history and roster-update event sources, and emits separate physical, The Show-appraisal, PowerPro-behavior and contextual lanes.

## Eligible-universe denominators

- Current-100 intended/emitted: **100/100** unique queue orders.
- Destination lower-bound MLB bridge rows: **79**; The Show bridge rows: **47**.
- Historical NPB identity screen rows: **766**.
- Pinned The Show source rows scanned: **284282**; matched NPB-linked panel rows: **3604** across **56** canonical players.
- PowerPro linked rows: **1879**; transition segments: **6**.

Current-100 The Show coverage states:

- `ELIGIBLE_MATCHED`: 2
- `IDENTITY_UNRESOLVED`: 1
- `NO_MLB_PROMOTION_FOUND`: 97

The prior 6-player/7-pair result, 47-row The Show bridge and 79-row MLB bridge are recorded as lower bounds or narrow direct-bridge experiments; none is used as an eligibility ceiling.

## Four-output architecture

1. Independent physical estimate: NPB+ top-speed and direct/H2F/T90 lanes only; PowerPro labels are excluded.
2. The Show-implied appraisal range: Live Speed with edition/update/time provenance; Speed, Stealing and Baserunning Aggressiveness remain separate.
3. Historical PowerPro-behavior expectation range: raw/work/percentile trajectories and bounded behavior models; not physical truth.
4. Contextual evidence: Community, age/injury missingness, technique and transition context with explicit roles.

## P0 route results

| Route | Status | Finding |
|---|---|---|
| `MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE` | `EXECUTED_WITH_MEASURED_LIMIT` | Only one protocol-specific rank feature had cross-league support; full shared-indicator behavior bridge is not identified and no forced analog is emitted. |
| `MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS` | `EXECUTED_WITH_BOUNDED_MODEL` | Separate The Show and PowerPro behavior models were fit; full cross-league shared-feature model remains bounded by missing MLB outcome features. |
| `MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL` | `EXECUTED_WITH_MEASURED_IDENTIFIABILITY_LIMIT` | Four traits are separated; direct acceleration/end-to-end observations remain sparse. |
| `MB-04_WITHIN_PLAYER_TEMPORAL_DELTA` | `EXECUTED_WITH_BOUNDED_MISSINGNESS` | Within-player deltas and carry-forward flags are emitted; age/injury controls are missing. |
| `MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS` | `EXECUTED_WITH_SEGMENT_RECEIPT` | Direction-specific transition segments are emitted without lifetime averaging; causal effects are not identified. |
| `MB-06_RATING_INERTIA_AND_STALENESS_MODEL` | `EXECUTED_WITH_BOUNDED_MISSINGNESS` | Inertia/staleness observations are emitted; editor timestamps and age/injury data are incomplete. |
| `MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH` | `EXECUTED_WITH_BOUNDED_GRAPH` | Source-family deduplicated ordinal graph and cycle diagnostics are emitted. |
| `MB-08_DISTRIBUTION_AND_TAIL_CALIBRATION` | `EXECUTED_WITH_TAIL_DIAGNOSTICS` | Distribution/percentile context is emitted with edition/work stratification; no label copying. |
| `MB-09_THE_SHOW_ROSTER_UPDATE_RESPONSE` | `EXECUTED_WITH_EVENT_RECEIPT` | Official/archived event rows are deduplicated; unchanged snapshots are not inferred as changes. |
| `MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT` | `EXECUTED_WITH_DISAGREEMENT_RECEIPT` | Four output roles, route disagreement and per-player influence are preserved. |
| `MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE` | `EXECUTED_WITH_MEASURED_NEGATIVE_CONTROLS` | Wrong-player, wrong-year, same-name, non-Live, leakage and placebo controls are recorded. |
| `MB-18_DECISION_USE_AND_ABLATION_RECEIPT` | `EXECUTED_WITH_100_BY_ROUTE_MATRIX` | All 100 players × 18 routes have player-specific decision-use receipts and ablation states. |

## Important negative findings

- Full cross-league common-indicator matching is bounded: the destination snapshot does not contain a complete MLB opportunity/outcome panel aligned to the NPB event features. MB-01 therefore uses a protocol-labelled rank QA lane, enforces a caliper, and emits `NO_VALID_ANALOG` rather than forcing a match.
- The pinned full-attribute source audit confirms only MLB21–MLB26 observed Live snapshots; MLB17–MLB20 are not imputed.
- The Show roster-update dates are snapshot dates, not proof that every attribute changed on that date. Carry-forward rows remain labelled.
- Age and injury joins remain bounded missingness. No player is inferred slow because those sources are absent.
- The external temporal dataset contains look-ahead full-season sprint fields; those rows are quarantined from the physical/game models.
- The current NPB short name `ソト` is not forced to a Juan Soto or another MLB candidate; it remains `IDENTITY_UNRESOLVED` until a stable NPB↔MLB ID is available.

## QA

- Current-100 exact unique coverage: `True`.
- Primary-panel non-Live contamination: `0` rows.
- Speed/Stealing/Aggression collapse: `False`.
- PowerPro label in physical latent path: `False`.
- Forced analog outside support: `0`.
- Route matrix: `100 × 18 = 1800` player-specific cells; generic rationale count `0`.
- SP-078 ledger unchanged: `True`; owner verdict count `0`.
- Deterministic outputs use fixed source commits, sorted rows and gzip `mtime=0`; the runner is rerunnable with the pinned source worktrees.
- Canonical task-registry QA, construct-traceability QA and SP-078 locked-write integrity QA are persisted as PASS receipts.
- Source-derived SP-077 v2 independent QA is persisted as 3255/3255 PASS. The legacy comparator is also persisted as a 3163/3234 result with 71 FAIL; its fixed H2F count and field-signature comparison are superseded by the v2 source-derived comparator and remain visible as a negative QA finding.
- Determinism receipt: `outputs/derived/sp101_determinism_qa.json` records byte-identical hashes for 25 runner outputs across two fresh subprocess runs.

## SP-102 handoff

Residual target states: **{'NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN': 68, 'TARGETED_MATERIAL_CONFLICT': 28, 'NOT_TARGETED_SUFFICIENT_CONFIDENCE': 4}**. The target file is frozen before any SP-102 search. SP-102 was not executed.

## Governance

The canonical SP-078 ledger remains empty. No SP-078 verdict, SP-079 final rating, owner approval, or shoulder artifact was created.

Machine-readable receipts:
- `outputs/derived/sp101_inference_route_execution_receipt.json`
- `outputs/derived/sp101_coverage_qa.json`
- `outputs/derived/sp101_current100_multibridge_evidence.json`
- `outputs/derived/sp101_requirements_to_decision_utilization.json`
- `outputs/derived/sp101_residual_low_confidence_target_set.json`
- `outputs/derived/sp101_determinism_qa.json`
- `outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json`
- `outputs/derived/qa_sp077_construct_complete_owner_review_queue_20260817.json`

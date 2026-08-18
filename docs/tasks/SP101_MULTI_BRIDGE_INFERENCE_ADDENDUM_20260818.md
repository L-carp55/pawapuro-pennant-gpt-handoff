# SP-101 addendum — multi-bridge inference beyond direct player overlap

Status: **BINDING TASK ADDENDUM / OWNER-REVIEW BLOCKER**

Date: 2026-08-18

Scope: **走力のみ。肩力・SP-078 owner verdict・SP-079 final ratingは対象外。**

This addendum is mandatory together with:

- `docs/tasks/SP101_EXPANDED_THE_SHOW_NPB_UNIVERSE_20260818.md`
- `docs/state/speed_owner_clarification_the_show_scope_20260818.md`
- `outputs/derived/sp101_inference_route_registry_20260818.json`
- `docs/audits/sp101_common_metric_bridge_feasibility_20260818.md`

## 1. Owner clarification extended

Direct same-player, same-time The Show↔PowerPro pairs are only one evidence route.

SP-101 must also exploit indirect but auditable bridges, especially:

> Use common indicators available in MLB and NPB to find similar player-seasons. Observe how MLB analogs are rated by The Show and how NPB analogs are rated by PowerPro. Use the two appraisal distributions as external QA against an independently estimated physical speed construct.

The absence of a direct player overlap does not make the data unusable.

## 2. Required four-output architecture

Every current-100 player must receive four separate estimates or bounded missingness states:

1. **Independent physical estimate**
   - PowerPro-label-free;
   - based on NPB+/Statcast top speed, H2F/T10/T30/T90, 30m/50m, and bounded physical evidence;
   - explicitly separates peak speed from acceleration/end-to-end.

2. **The Show-implied appraisal range**
   - based on The Show Live Speed, shared-indicator analogs, player trajectory and transition models;
   - stored as external game appraisal, never as direct physical measurement.

3. **Historical PowerPro-behavior expectation range**
   - based on historical PowerPro trajectories and comparable NPB indicator profiles;
   - describes how PowerPro tended to rate similar profiles, not what the physical truth must be.

4. **Contextual evidence**
   - Community, scouting, pinch-runner role, video, defensive context and other bounded evidence;
   - each source retains its role and confidence.

The final review must preserve agreement and disagreement among these four outputs. It must not average them into one unlabelled score.

## 3. Mandatory common-metric neighborhood bridge

Route: `MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE`

### 3.1 Common feature dictionary

Build a versioned feature dictionary. Each feature must include:

- source system;
- definition;
- numerator and denominator;
- season;
- opportunity threshold;
- direction;
- physical/technique/aggression role;
- league-normalization rule;
- missingness state;
- known confounders.

At minimum test these feature families.

#### Physical-dominant

- Statcast Sprint Speed and NPB+ top speed as separate protocol-specific fields;
- H2F/T10/T30/T90;
- 30m/50m/60-yard timed tests;
- full-effort run count/exposure.

#### Shared game outcomes

- SB attempt rate;
- SB success rate;
- triples per eligible opportunity;
- GIDP avoidance conditional on ground-ball opportunities;
- infield-hit rate conditional on ground balls, direction and batter handedness;
- first-to-third and second-to-home advancement;
- UBR/BsR or compatible advancement components;
- run-scoring/advancement opportunity counts.

#### Nuisance and context controls

- league-season;
- PA/opportunities;
- age and injury availability;
- position;
- batting side;
- park/team environment;
- transition direction and time gap.

General batting quality must not be treated as speed, but may be included as an opportunity/confounding control where justified.

### 3.2 Normalization

Raw MLB and NPB values must not be compared directly unless their definitions and environments are proven compatible.

Required comparisons:

- within-league-season z-scores;
- within-league-season percentiles;
- robust ranks;
- optional position/handedness stratification;
- sensitivity with and without nuisance controls.

### 3.3 Matching methods

Run at least:

1. mutual k-nearest neighbors;
2. calipered Mahalanobis matching;
3. optimal-transport/distribution matching.

For every analog pair preserve:

- target player-season;
- matched player-season;
- feature distance;
- common-support status;
- balance by feature;
- temporal gap;
- transition state;
- The Show rating and provenance;
- PowerPro rating and provenance;
- match confidence;
- exclusion reason when rejected.

A player outside common support receives `NO_VALID_ANALOG`. Do not force the nearest available player.

## 4. Mandatory dual behavior models

Route: `MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS`

Build two separate models:

- `The Show Speed ~ MLB shared indicators`
- `PowerPro speed ~ NPB shared indicators`

Do **not** fit only `PowerPro ~ The Show`.

Compare the two models through:

- predicted percentile;
- calibration bands;
- residuals;
- common-indicator counterfactuals;
- model disagreement.

The physical estimate remains a third independent path and cannot use the PowerPro label as input.

## 5. Mandatory latent multi-trait model

Route: `MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL`

Minimum latent traits:

- `PEAK_SPEED`;
- `INITIAL_ACCELERATION_END_TO_END_90FT`;
- `STEALING_TECHNIQUE`;
- `BASERUNNING_AGGRESSION_DECISION`.

Source roles:

| Source | Primary latent role |
|---|---|
| Sprint Speed / NPB+ top speed | Peak speed |
| T10/T30/H2F/T90 | Acceleration and end-to-end |
| 30m/50m | Bounded physical context across acceleration/maintenance |
| The Show Speed | External physical-speed appraisal |
| The Show Stealing | Stealing technique appraisal |
| The Show Baserunning Aggressiveness | Aggression/decision appraisal |
| PowerPro走力 | Historical game appraisal of physical speed |
| PowerPro盗塁・走塁 traits | Technique/aggression appraisal |
| NPB S/game proxies | Mixed context with explicit contamination |

A single measurement family may inform more than one latent aspect but cannot be counted as two independent sources when assigning confidence.

## 6. Mandatory temporal and transition routes

Execute separately:

- within-player annual/roster-update deltas;
- PowerPro version-to-version deltas;
- NPB→MLB;
- MLB→NPB;
- NPB→MLB→NPB returnees;
- multi-cycle transitions;
- game-specific rating inertia/staleness;
- age-conditioned temporal decay.

Do not collapse multiple transitions or editions into lifetime averages.

Historical evidence is discounted through visible time/transition weights; it is not silently deleted.

## 7. Mandatory ordinal route

Build a pairwise evidence graph from:

- direct physical faster/slower evidence;
- The Show ordinal relations;
- PowerPro percentile relations;
- valid analog relations;
- player-specific Community/scouting ordinal claims.

The graph must report:

- supported rank intervals;
- inconsistent cycles;
- temporal conflicts;
- duplicate source-family edges;
- edge ablation.

This route is required because ordinal evidence can remain useful when numerical scales differ.

## 8. Required outputs added by this addendum

- `outputs/derived/sp101_common_metric_feature_dictionary.tsv`
- `outputs/derived/sp101_metric_neighborhood_analog_pairs.csv.gz`
- `outputs/derived/sp101_metric_neighborhood_player_summary.json`
- `outputs/derived/sp101_dual_game_behavior_models.json`
- `outputs/derived/sp101_latent_multitrait_speed_model.json`
- `outputs/derived/sp101_temporal_delta_and_inertia.json`
- `outputs/derived/sp101_transition_effects.json`
- `outputs/derived/sp101_pairwise_ordinal_graph.json`
- `outputs/derived/sp101_route_ablation_qa.json`
- `outputs/derived/sp101_current100_multibridge_evidence.json`
- `outputs/derived/sp101_inference_route_execution_receipt.json`
- `docs/audits/sp101_multibridge_inference_results.md`

## 9. Parallel-agent extension

The original Agent E must be split into independent writers.

### Agent E1 — Common-feature dictionary and analog matching

Owns feature definitions, normalization, common support, kNN/Mahalanobis/optimal-transport outputs and balance QA.

### Agent E2 — Game-behavior models and distribution calibration

Owns The Show/PowerPro behavior models, edition/version effects, quantile/tail calibration and negative controls.

### Agent E3 — Latent multi-trait and ordinal graph

Owns the peak/acceleration/technique/aggression measurement model and pairwise graph.

### Agent E4 — Temporal, transition, inertia and age

Owns within-player deltas, transition segments, returnee analysis, rating lag and temporal decay.

### Agent E5 — Ensemble and decision-use receipts

Owns four-output triangulation, route disagreement, route influence, current-100 ablation and requirement-to-decision receipts.

Only the parent agent integrates final player packets. No two sub-agents edit the same final file.

## 10. QA additions

Mandatory:

- player-clustered holdout;
- forward-season holdout;
- The Show edition-specific effects;
- PowerPro work/version effects;
- transition-direction-specific evaluation;
- feature balance and common-support coverage;
- route-family ablation;
- wrong-player, wrong-year and same-name negative controls;
- irrelevant-attribute placebo tests;
- special/non-Live contamination = 0 in primary panel;
- Speed/Stealing/Aggression never collapsed;
- no PowerPro labels in physical latent features;
- no top-speed-only finalization;
- no forced analog outside the caliper;
- no generic pass-through rationale for any current-100 player;
- 100-player × route decision-use matrix;
- all failures and negative findings committed before final response.

## 11. Revised Definition of Done

SP-101 cannot be closed merely by producing a larger identity crosswalk.

It is complete only when:

1. the full eligible NPB↔MLB↔The Show universe is enumerated;
2. all required player-year and transition panels exist;
3. all P0 routes in `sp101_inference_route_registry_20260818.json` are executed or closed with measured negative findings;
4. every current-100 player has four-output evidence or bounded missingness;
5. route-level decision influence is proven;
6. physical and game-appraisal paths remain separate;
7. independent QA and determinism pass;
8. a new all-100 owner-review packet can be built without reusing the superseded SP-078 proposal;
9. the owner ledger remains empty;
10. no SP-079 or shoulder output is created.

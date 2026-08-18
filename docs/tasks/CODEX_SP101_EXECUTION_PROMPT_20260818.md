# Codex execution prompt — SP-101 expanded MLB The Show × NPB speed evidence rebuild

## Mission

Execute **SP-101** end to end on this branch and push the completed work to GitHub.

This is a **speed/running appraisal task only**. Do not start shoulder/arm appraisal.

The goal is not to force a final rating. The goal is to exhaust the usable evidence routes, build the canonical NPB↔MLB↔MLB The Show↔PowerPro evidence universe, quantify what each route can and cannot tell us, and leave a fully auditable current-100 evidence packet ready for human owner review and later SP-102 targeted rescue.

## Repository and branch

- Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
- Work only on branch: `codex/speed-sp101-expanded-the-show-universe-20260818`
- Branch baseline at dispatch: `4aef2779f438ec53f5bcc841fc3498effecbc5c5`
- Do not force-push.
- Use a separate worktree if your environment supports it.

External source repository:

- `L-carp55/claude-code-hub`

Required source branches/commits already referenced by the project:

- `codex/mlb-the-show-speed-history` @ `97c429521267cfb70ccdd61e40e11853d100e360`
- `codex/mlb-the-show-speed-temporal-rescue` @ `ab5adbfee656d69d0b378145fd66bf5789e0d1b4`
- `codex/mlb-the-show-full-attributes` (use the project-pinned source/audit and verify actual remote SHA before consuming)

## Read first — authoritative task inputs

Before editing or collecting anything, read these in full:

1. `docs/tasks/SP101_EXPANDED_THE_SHOW_NPB_UNIVERSE_20260818.md`
2. `docs/tasks/SP101_MULTI_BRIDGE_INFERENCE_ADDENDUM_20260818.md`
3. `docs/state/speed_owner_clarification_the_show_scope_20260818.md`
4. `docs/state/speed_sp101_activation_state_20260818.json`
5. `outputs/derived/sp101_inference_route_registry_20260818.json`
6. `docs/audits/sp101_common_metric_bridge_feasibility_20260818.md`
7. `outputs/derived/sp101_common_metric_bridge_feasibility_20260818.json`
8. `docs/state/speed_task_registry.tsv`
9. `docs/state/speed_owner_review_integrity_lock_20260817.json`
10. `outputs/derived/sp078_owner_verdict_ledger_20260816.json`
11. `docs/tasks/SP102_TARGETED_2CH_VIDEO_COMMENT_RESCUE_20260818.md`
12. `outputs/derived/sp102_target_selection_contract_20260818.json`

Also inspect the existing SP-007/015/016/017/021/022/041/042/043/060/061/062/074/075/098/100 artifacts referenced by the task registry when relevant. Do not re-derive a lower-quality substitute if a higher-quality canonical receipt already exists.

## Binding construct definition

The target construct is:

> Physical baseball running ability from the first running step to about 90 ft, including initial acceleration, peak speed, and ability to sustain effective speed to the end of the run.

Keep separate:

- `PEAK_SPEED`
- `INITIAL_ACCELERATION_END_TO_END_90FT`
- `STEALING_TECHNIQUE`
- `BASERUNNING_AGGRESSION_DECISION`

Do not reduce running ability to NPB+ top speed. Do not reduce poor stealing/baserunning outcomes to poor physical speed.

## Critical owner clarifications

### The Show eligible universe

The old **6 players / 7 pairs** result is only the narrow sample for one same-time direct numeric bridge test. It is **not** the eligible population.

You must enumerate and use role-appropriate evidence for:

- current-100 MLB-promoted/appeared players;
- all historical NPB-before-2026 players with MLB/The Show evidence;
- Japanese NPB→MLB players, including those still in MLB;
- foreign MLB→NPB players;
- NPB→MLB→NPB returnees;
- MLB→NPB→MLB / multi-cycle transitions;
- historical calibration players outside the current 100.

A cross-time The Show value remains evidence. Time gap changes role and weight; it does not erase the record.

### The Show use is broader than direct player overlap

Direct The Show↔PowerPro overlap is only one route.

You must also test indirect bridges using shared MLB/NPB indicators, including the owner-proposed route:

> Find MLB player-seasons with a shared-indicator profile and observe their The Show Speed. Find NPB player-seasons with a comparable league-normalized indicator profile and observe their PowerPro speed. Use the distributions as separate external game-appraisal expectations against an independent physical estimate.

Do not compare raw MLB and NPB rates without league-season normalization/common-support checks.

## Mandatory multi-agent structure

Use multiple independent sub-agents in parallel wherever tasks do not write the same final file. Parent agent alone integrates final outputs.

Minimum workstreams:

### A — Identity universe
- Enumerate NPB-before-2026 and current-100 population.
- Determine MLB regular-season promotion/appearance, not merely affiliation/minor-league contract.
- Build canonical NPB/ProEye/production ID/MLBAM/The Show UUID/Japanese/English-name crosswalk.
- Preserve ambiguity and negative controls.

### B — The Show Live panel
- Isolate Live/base roster `Speed` by player/edition/snapshot/update.
- Preserve official roster-update events when reproducible.
- Quarantine WBC, Flashback, Finest, Awards, Topps Now, Captain, Milestone and other non-Live cards.
- Keep `Speed`, `Stealing`, and `Baserunning Aggressiveness` separate.

### C — NPB + PowerPro timeline
- Build NPB season histories and PowerPro raw + percentile trajectories.
- Include players outside current100 and Japanese players currently in MLB.
- Preserve work/version effects, breakpoints, inertia, missing years.

### D — Transition segmentation
- NPB→MLB
- MLB→NPB
- NPB→MLB→NPB
- MLB→NPB→MLB / multi-cycle
- Align season, edition/update date, PowerPro work/version, Statcast, age/injury availability, temporal gap.
- Never collapse multiple segments into a lifetime average.

### E1 — Common-feature dictionary + analog matching
- Build the versioned cross-league feature dictionary.
- Test mutual kNN, calipered Mahalanobis, and optimal-transport/distribution matching.
- Require common support. Output `NO_VALID_ANALOG` rather than forcing a bad match.
- Store feature balance and match distance.

### E2 — Dual game-behavior models + scale/tail calibration
Fit separately:
- `The Show Speed ~ MLB shared indicators`
- `PowerPro speed ~ NPB shared indicators`

Compare predicted percentiles, calibration bands, residuals, edition/version effects and tail compression.

### E3 — Latent multi-trait + ordinal graph
- Build separate latent aspects for peak speed, acceleration/end-to-end, stealing technique, baserunning aggression/decision.
- Build ordinal faster/slower graph from direct measurements, The Show, PowerPro percentiles, valid analogs, scouting/Community claims.
- Detect inconsistent cycles and duplicate source-family edges.

### E4 — Temporal / transition / inertia
- Within-player annual deltas.
- The Show roster-update response.
- PowerPro version-to-version changes.
- Age-conditioned decay where data exist; explicit bounded missingness otherwise.
- Rating inertia/staleness.
- Returnee and transition effects by direction/time gap.

### E5 — Ensemble + decision-use + ablation
For every current-100 player, keep separate:
1. independent physical estimate/range;
2. The Show-implied appraisal range;
3. historical PowerPro-behavior expectation range;
4. contextual evidence summary;
5. route disagreement and decision-use receipt.

Run route-family ablation and record whether each route changed, supported, contradicted, narrowed, widened, or did not affect the player review.

### F — Independent red team
Test:
- identity/homonym leakage;
- wrong-player/wrong-year joins;
- same player split across train/test;
- duplicate cards/updates/events;
- non-Live contamination;
- Speed/Stealing/Aggression collapse;
- PowerPro-label leakage into physical latent estimate;
- top-speed-only finalization;
- forced analogs outside support;
- temporal leakage;
- irrelevant/non-speed placebo attributes;
- common-feature proxy leakage through general batting quality/team context;
- rerun determinism.

## Required P0 inference routes

All of these must be executed, or closed with a measured negative finding and committed audit:

- `MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE`
- `MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS`
- `MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL`
- `MB-04_WITHIN_PLAYER_TEMPORAL_DELTA`
- `MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS`
- `MB-06_RATING_INERTIA_AND_STALENESS_MODEL`
- `MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH`
- `MB-08_DISTRIBUTION_AND_TAIL_CALIBRATION`
- `MB-09_THE_SHOW_ROSTER_UPDATE_RESPONSE`
- `MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT`
- `MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE`
- `MB-18_DECISION_USE_AND_ABLATION_RECEIPT`

Do not close SP-101 merely because the identity crosswalk is complete.

## Shared-indicator route — minimum feature families

Use only role-appropriate, opportunity-conditioned features. At minimum test:

### Physical-dominant
- Statcast Sprint Speed and NPB+ top speed as separate protocol-specific fields;
- T10/T30/T90/H2F;
- 30m/50m/60-yard timing where available;
- full-effort run/exposure counts.

### Shared outcome/context
- SB attempt rate;
- SB success rate;
- triples per eligible opportunity;
- GIDP avoidance conditioned on ground-ball opportunity;
- infield-hit rate conditioned on ground balls, direction and batter handedness where available;
- first-to-third / second-to-home advancement;
- UBR/BsR-compatible advancement components;
- pinch-runner/tactical role when available.

### Nuisance controls
- league-season environment;
- PA/opportunities;
- age/injury availability;
- position;
- batting side;
- park/team context;
- transition direction;
- time gap.

General batting quality is not speed. Use it only as an opportunity/confounding control when justified.

## Existing feasibility signals — use as starting evidence, not final truth

The committed proof of concept measured:

- The Show Speed vs bounded Statcast Sprint Speed bridge: Pearson `r≈0.873`, Spearman `≈0.880`.
- Historical NPB shared-indicator analog screen: grouped CV `R²≈0.505`, MAE `≈8.17` PowerPro points.

Do not optimize to reproduce these exact values. Rebuild from the canonical enlarged universe with proper temporal, player-cluster, edition/version and support controls.

## SP-102 handoff requirement

Do **not** execute SP-102 in this task.

But SP-101 must freeze:

`outputs/derived/sp101_residual_low_confidence_target_set.json`

with exactly one target-selection state for all 100 players:

- `TARGETED_LOW_CONFIDENCE`
- `TARGETED_MATERIAL_CONFLICT`
- `TARGETED_OWNER_OVERRIDE`
- `NOT_TARGETED_SUFFICIENT_CONFIDENCE`
- `NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN`

Target based on residual uncertainty/information gain after SP-101, not on comment availability.

SP-102 will later search 2ch/5ch-style baseball video comments only for those residual targets.

## Required original SP-101 outputs

Create/validate all outputs required by `SP101_EXPANDED_THE_SHOW_NPB_UNIVERSE_20260818.md`, including:

- `data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv`
- `outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz`
- `outputs/derived/sp101_the_show_roster_update_speed_events.csv`
- `outputs/derived/sp101_npb_mlb_transition_segments.csv`
- `outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv`
- `outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv`
- `outputs/derived/sp101_current100_the_show_evidence.json`
- `outputs/derived/sp101_requirements_to_decision_utilization.json`
- `outputs/derived/sp101_coverage_qa.json`
- `docs/audits/sp101_expanded_the_show_npb_universe.md`

## Required multi-bridge outputs

Also create/validate:

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
- `outputs/derived/sp101_residual_low_confidence_target_set.json`
- `docs/audits/sp101_multibridge_inference_results.md`

If exact filenames need minor schema-preserving adjustments, update the task spec and audit why. Do not silently omit outputs.

## Per-player current-100 requirements

Every player must have explicit states for:

- stable identity;
- The Show/MLB coverage state;
- direct physical evidence and missingness;
- peak-speed evidence;
- acceleration/end-to-end evidence;
- shared-indicator analog result or `NO_VALID_ANALOG`;
- The Show-implied range or bounded missingness;
- PowerPro-behavior expectation range or bounded missingness;
- PowerPro raw/percentile trajectory context;
- transition/time-gap context when relevant;
- technique/aggression separation;
- scouting/Community/pinch-runner/video availability states;
- route disagreement;
- decision-use/ablation receipt;
- residual confidence and SP-102 target-selection state.

No generic pass-through rationale for the 85/100 non-directional cases. Each player must have player-specific receipts.

## Governance — hard prohibitions

Do not:

- write SP-078 owner verdicts;
- run SP-079 final ratings;
- start shoulder appraisal;
- modify or fabricate owner approval;
- copy current PowerPro values into the physical latent estimate;
- fit a PowerPro-labelled player model as the physical truth path;
- convert old The Show values directly to current NPB rating without role/time controls;
- average multiple editions/transition segments into a lifetime number;
- mix non-Live cards into the primary The Show panel;
- treat NPB+ top speed as the whole construct;
- treat missing evidence as slow/zero;
- hide failed models, negative findings, unresolved IDs, or coverage gaps in the final chat only.

The canonical owner ledger must remain:

- `records=[]`
- `owner_verdict_count=0`

Owner review remains locked.

## Validation requirements

At minimum:

- explicit denominator for every eligible cohort;
- current-100 exactly 100 unique coverage states;
- identity ambiguity/negative-control QA;
- player-clustered holdout;
- forward-season holdout where applicable;
- edition-specific The Show effects;
- PowerPro work/version effects;
- transition-direction-specific evaluation;
- feature-balance and common-support coverage;
- route-family ablation;
- wrong-player/wrong-year/same-name canaries;
- irrelevant-attribute placebo tests;
- non-Live contamination = 0 in primary panel;
- Speed/Stealing/Aggression never collapsed;
- no PowerPro label in physical latent features;
- no top-speed-only finalization;
- no forced analog outside caliper/support;
- deterministic rerun from frozen inputs;
- SP-078 ledger hash unchanged.

Run the canonical project QA as relevant, including task-registry, construct traceability and SP-078 integrity checks.

## Git / delivery requirements

- Commit all important code, data receipts, audits, negative findings and QA outputs to this branch.
- Large generated raw assets may be represented by reproducible manifests/hashes if repository size constraints require it, but do not omit the normalized evidence needed downstream.
- Do not leave important findings only in the Codex final response.
- Push the branch.
- Verify local HEAD == remote branch HEAD.
- In the final response report:
  - remote HEAD SHA;
  - executed P0 routes and measured negative routes;
  - eligible-universe denominators;
  - current-100 The Show coverage states;
  - major changes from the pre-SP101 100-player packet;
  - number of SP-102 residual targets and why;
  - all unresolved blockers;
  - QA summary;
  - confirmation that SP-078 remained empty, SP-079 was not run, and shoulder was untouched.

## Stop conditions

Do not stop because one method fails. Record the failure and continue with independent routes.

Do not broaden into unrelated abilities. Do not start SP-102 comment collection. Do not request owner approval during SP-101 implementation unless an actual policy decision is impossible to infer from the committed specifications.

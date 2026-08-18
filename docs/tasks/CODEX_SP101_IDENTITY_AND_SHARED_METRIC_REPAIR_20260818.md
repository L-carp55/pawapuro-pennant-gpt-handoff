# Codex repair task — SP-101 identity propagation + MLB shared-metric execution

Status: **REPAIR REQUIRED / DO NOT START SP-102**
Date: 2026-08-18
Scope: **走力のみ。**

## Start state

Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
Branch: `codex/speed-sp101-expanded-the-show-universe-20260818`

Before doing anything:

1. `git fetch origin`
2. Fast-forward this worktree to the current remote branch HEAD. Do not reset, stash, clean, force-push, or touch the user's original worktree.
3. Read in full:
   - `docs/audits/sp101_identity_propagation_independent_audit_20260818.md`
   - `outputs/derived/qa_sp101_identity_propagation_20260818.json`
   - `docs/audits/sp101_independent_semantic_execution_audit_20260818.md`
   - original SP-101 task, multi-bridge addendum, owner clarification, SP-102 contract.

The prior Codex result at `127df6b...` is **not accepted as DONE_VALIDATED**. Preserve useful artifacts, but repair the execution defects below and regenerate all affected outputs.

## 1. Repair canonical entity reconciliation first

Root cause in `scripts/sp101_execute_20260818.py`:

- current queue players are created as `PROEYE:<production_id>`;
- historical bridge rows with a missing ProEye ID become `NPBNAME:<normalized-name>`;
- the two records are indexed but not unioned before downstream evidence loading.

Implement an explicit canonical-entity reconciliation stage **before downstream evidence is attached**.

### Required reconciliation hierarchy

Use strongest evidence first:

1. same verified ProEye/production ID;
2. same verified MLBAM ID;
3. destination curated bridge identity (`npb_name` ↔ explicit MLB person) + unique exact normalized NPB name to a current queue player;
4. verified English/Japanese alias crosswalk + team/season consistency;
5. otherwise preserve ambiguity.

Do not use raw surname-only or short-name guesses.

When a historical `NPBNAME` record is uniquely reconciled to a current `PROEYE` record, the **current PROEYE key is the surviving representative**. Union and preserve:

- Japanese names/aliases;
- English names;
- MLB names;
- MLBAM IDs;
- The Show UUIDs;
- MLB evidence state;
- identity notes/provenance;
- current queue orders;
- bridge rows keyed to the representative.

Rebuild all indexes only after reconciliation.

### Mandatory canaries

Positive controls that must remain matched:

- 秋山翔吾
- 筒香嘉智

False-negative controls that must be repaired:

- カリステ — must not be `NO_MLB_PROMOTION_FOUND`
- ポランコ — must receive its eligible The Show history (historical crosswalk currently has 21 Live rows)
- モンテロ — must receive its eligible The Show history (historical crosswalk currently has 120 Live rows)
- サンタナ — must not be `NO_MLB_PROMOTION_FOUND`; if no pinned Live row exists, use `THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH`

ソト:

- do not guess from `ソト` alone;
- independently resolve the current NPB player using authoritative/current roster identity + MLB identity evidence if possible;
- if resolved, store the source receipt and MLB appearance years;
- otherwise retain `IDENTITY_UNRESOLVED` with exact attempted sources.

### New fail-closed invariant

For every current100 player:

> `NO_MLB_PROMOTION_FOUND` is illegal when the reconciled canonical entity has verified MLB regular-season appearance evidence or a uniquely linked curated destination MLB bridge with `mlb_evidence=true`.

Run `scripts/qa_sp101_identity_propagation_20260818.py` after regeneration. The repaired run must make the former contradiction set zero; revise the audit script's expected mode if needed so repaired state exits PASS rather than deleting the historical failure receipt.

## 2. Collect actual MLB regular-season appearance years

The prior implementation incorrectly used The Show observation seasons as `MLB` seasons for transition segmentation.

Create a reproducible, authoritative appearance table for the NPB-linked eligible universe, preferably from official MLB Stats API / official MLB player-game or season records.

Required output:

`outputs/derived/sp101_mlb_regular_season_appearance_years.csv`

Minimum fields:

- canonical stable player key;
- MLBAM ID;
- MLB name;
- MLB season;
- regular-season games/PA when available;
- source endpoint/URL;
- retrieval date;
- source payload hash;
- identity confidence;
- evidence state.

An MLBAM ID alone is not an MLB appearance. A The Show card alone is not an MLB appearance.

Transition segmentation must use:

- verified NPB seasons as NPB state;
- verified MLB regular-season appearance seasons as MLB state;
- The Show edition/update dates as a **separate external-game observation axis**.

Do not label The Show seasons as MLB seasons.

## 3. Execute the owner-proposed common-indicator bridge rather than stopping at one physical percentile

The previous MB-01 implementation used only:

`PHYSICAL_PROTOCOL_PERCENTILE_ONLY`

This is not the binding shared-indicator analog route.

Collect reproducible MLB player-season indicators for the eligible The Show / NPB-linked universe from authoritative MLB sources where available.

At minimum attempt to build MLB counterparts for:

- PA / AB;
- SB attempts = SB+CS;
- SB success;
- triples;
- GIDP;
- runs;
- hits/singles/doubles;
- strikeouts / balls in play if definitions support the existing NPB feature;
- Sprint Speed where available.

Also attempt, and explicitly record denominators/negative findings for:

- opportunity-conditioned infield hits;
- first-to-third / second-to-home advancement;
- UBR/BsR-compatible baserunning value or an authoritative compatible source.

Do not stop with “destination DB does not contain it.” This is an external-data task. Attempt collection and persist source manifests, HTTP/source receipts, definitions and failed acquisition routes.

Required output:

`outputs/derived/sp101_mlb_shared_indicator_player_seasons.csv.gz`

Create/update `sp101_common_metric_feature_dictionary.tsv` with exact MLB and NPB definitions and compatibility grades:

- `DIRECTLY_COMPARABLE_AFTER_LEAGUE_NORMALIZATION`
- `APPROXIMATE_COMMON_CONSTRUCT`
- `NOT_DEFINITIONALLY_COMPARABLE`
- `BLOCKED_MISSING_DATA`

Raw MLB and NPB rates must not be matched without within-league-season normalization.

## 4. Re-run MB-01 with genuine multi-feature matching

At minimum run:

- mutual kNN;
- calipered Mahalanobis;
- optimal-transport/distribution matching.

Use only compatible shared features and nuisance controls. Report covariate balance and common support.

A one-feature physical-rank analog can remain as a separate baseline, but it cannot stand in for MB-01.

No common support → `NO_VALID_ANALOG`.

## 5. Re-run MB-02 as a true dual behavior model

Fit separately:

- `The Show Speed ~ MLB shared indicators`
- `PowerPro speed ~ NPB shared indicators`

The prior `The Show Speed ~ Sprint Speed` model is a useful submodel and should be preserved, not treated as the entire The Show behavior model.

Required:

- player-clustered holdout;
- forward-season holdout where identifiable;
- edition-specific The Show effects;
- PowerPro work/version effects;
- feature-family ablation;
- model uncertainty and calibration bands;
- no PowerPro label in the independent physical path.

If specific advanced shared features remain unavailable after actual collection attempts, close those features only with measured negative findings.

## 6. Rebuild transition and temporal routes

Rebuild from the repaired canonical graph and actual MLB appearance years:

- `sp101_npb_mlb_transition_segments.csv`
- `sp101_transition_effects.json`
- `sp101_powerpro_the_show_temporal_pairs.csv`
- `sp101_historical_npb_the_show_calibration_panel.csv`
- `sp101_temporal_delta_and_inertia.json`
- roster-update player joins

Required cohort QA:

- NPB→MLB Japanese;
- MLB→NPB foreign;
- NPB→MLB→NPB returnee;
- multi-cycle when present.

Every required cohort must have an explicit denominator and either represented rows or a measured bounded missingness/negative finding.

The existing state “77 historical MLB_TO_NPB_FOREIGN names, 0 foreign names represented in transition panel” must fail QA.

## 7. Rebuild MB-07 ordinal graph with all mandatory source families

Include separately labelled edges from:

- direct physical evidence;
- The Show Live Speed;
- PowerPro percentile;
- valid MB-01 analog relations;
- canonical Community/scouting ordinal claims where available.

Preserve temporal scope and source-family deduplication. Do not turn these edges into one unlabeled numerical truth.

## 8. Repair MB-12 / MB-13 per-player decision-use

Do not emit `USED_CONTEXT` just because a route exists globally.

For every player, derive state from actual consumed rows:

- scouting/timed tests;
- pinch-runner/usage evidence.

If no row exists, use `AVAILABLE_NOT_DECISION_EFFECTIVE`, `BLOCKED_MISSING_DATA`, or `NOT_COLLECTED` as appropriate.

Every `USED_*` state must carry:

- evidence IDs / source rows consumed;
- row count;
- whether removing those rows changes any player-level output.

## 9. Rebuild MB-16 / MB-18 from actual route influence

MB-16 must compare the full separate outputs:

1. independent physical estimate;
2. The Show-implied range;
3. PowerPro-behavior expectation;
4. contextual evidence;
5. analog/ordinal/transition constraints.

Do not label `SUPPORTED_NO_CHANGE` merely because The Show evidence is absent.

MB-18 must prove actual route influence with before/after ablation. A player name inserted into a generic rationale is not sufficient.

Required per-cell additions:

- evidence_count;
- evidence_ids/source IDs;
- pre-ablation state/range;
- post-ablation state/range;
- influence classification.

## 10. Rebuild the SP-102 residual target set

The previous target freeze is invalid.

Follow `sp102_target_selection_contract_20260818.json` exactly.

- `LOW` or `VERY_LOW` residual confidence is an eligibility trigger.
- `NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN` requires an explicit measurable information-gain rationale; do not use MLB/The Show noncoverage as a proxy.
- material route conflicts and ablation sensitivity remain targets.
- freeze exactly one state for all 100 only **after all repaired SP-101 routes are complete**.

Do not run SP-102 itself.

## 11. QA that must fail before the fix and pass afterward

Add/retain canaries for:

- unique exact curated NPB bridge entity split between `PROEYE` and `NPBNAME`;
- historical MLB evidence contradicting current `NO_MLB_PROMOTION_FOUND`;
- positive matched 秋山/筒香;
- repaired カリステ/ポランコ/モンテロ/サンタナ;
- unresolved short-name negative controls;
- actual MLB appearance year ≠ The Show observation year fixture;
- required foreign MLB→NPB cohort coverage;
- MB-01 feature count >1 for at least the subset with valid shared support, or a measured collection-based negative finding;
- no unconditional `USED_CONTEXT` for absent scouting/pinch-runner evidence;
- decision-use matrix uses consumed evidence IDs;
- SP-102 target eligibility obeys confidence contract;
- non-Live contamination=0;
- PowerPro label leakage=0;
- top-speed-only finalization=0;
- deterministic rerun;
- SP-078 ledger unchanged.

## 12. Status/governance

Until all repair QA passes:

- SP-101 status = `PARTIAL` / repair required;
- SP-102 = blocked;
- SP-079 = blocked;
- owner review = locked;
- SP-078 ledger = empty;
- shoulder = blocked.

Do not write an owner verdict or final practical rating.

## 13. Definition of repaired SP-101 done

Only restore SP-101 to `DONE_VALIDATED` when:

1. canonical entity reconciliation passes;
2. current100 MLB coverage is based on verified MLB appearance evidence;
3. actual MLB appearance years drive transitions;
4. shared MLB indicator collection has been attempted and committed;
5. MB-01/02 meet the binding route semantics or have collection-backed measured negative findings;
6. all downstream identity-dependent routes and player packets are regenerated;
7. 100×18 decision-use represents actual consumed evidence/ablation;
8. SP-102 target set is regenerated under its contract;
9. all independent/canonical/determinism QA passes;
10. SP-078 ledger is still empty;
11. no SP-102 search, SP-079 or shoulder work has been run.

Commit and push without force. Verify local HEAD equals remote branch HEAD. Important findings must be persisted in GitHub artifacts, not only the final Codex answer.

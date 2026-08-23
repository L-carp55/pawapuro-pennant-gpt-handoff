# SP-104 — Pre-SP079 high-value physical evidence remediation

Date: 2026-08-23
Status: **NOT_STARTED / BLOCKS_SP079**
Scope: **走力のみ**
Parent: SP-103 browser independent review
Base commit: `7cbb0eec61eb65e88ec43c90a9b6fa6da594db4d`
Branch: `codex/speed-sp104-pre-sp079-high-value-remediation-20260823`

## Purpose

SP-103 successfully completed the zero-based evidence-universe inventory, but the browser independent review did not accept its transition to SP-079. The reason is narrow and measurable: 78/100 current physical states are peak-speed-only while feasible direct/near-direct acceleration/end-to-end evidence is either already collected but unused or available from official public Statcast surfaces.

SP-104 must test those **high-information, feasible gaps only**. It must not reopen the entire speed research program, and it must not generate final PowerPro-style speed ratings.

Canonical override:
`docs/state/speed_sp103_readiness_override_20260823.json`

Independent review:
`docs/audits/sp103_browser_independent_review_20260823.md`

## Governance locks

Until SP-104 independent QA closes:

- SP-079 remains `BLOCKED_DEPENDENCY`.
- SP-078 owner verdict ledger remains empty; expected `owner_verdict_count=0`.
- Do not create final numeric speed ratings.
- Do not start shoulder/SP-082.
- Do not roll back SP-103's accepted 71-row evidence universe.
- Do not re-enable old local `npb_plus_measurement.hp_to_1b_sec` as NPB+ ground truth.
- PowerPro player labels must not enter a physical teacher path.

## First repository change

Update `docs/state/speed_task_registry.tsv` so that:

1. SP-104 exists as a gate-blocking child task of SP-103.
2. SP-079 `depends_on` includes SP-104 and remains `BLOCKED_DEPENDENCY`.
3. SP-103 remains `DONE_VALIDATED` as the completeness audit, while its old readiness overlay is superseded by `docs/state/speed_sp103_readiness_override_20260823.json`.
4. SP-101 and SP-102 statuses remain unchanged.
5. owner-verdict and shoulder locks remain unchanged.

Run canonical registry QA immediately after this change.

## Frozen pre-SP104 baseline

All incremental effects must be compared against commit:
`7cbb0eec61eb65e88ec43c90a9b6fa6da594db4d`

At that baseline:

- current100 = 100;
- `PEAK_ONLY` = 78;
- `PEAK_AND_ACCELERATION` = 21;
- `NEITHER` = 1;
- historical sourced H2F = 74 records, collected but unused;
- historical 30m/50m physical tests = 232 records, collected but unused;
- direct T90/basepath/full-effort = 12 records, collected but unused;
- MLB Sprint Speed local bridge rows = 264;
- official MLB 90-foot / five-foot split source confirmed but not locally collected;
- official Sprint Speed exposure / HP-to-1B fields confirmed but not locally collected.

Do not treat these counts as target outcomes. They are baseline denominators.

# P0 — blocking remediation

## P0-A. Make existing historical physical evidence decision-effective

Input families:

- historical sourced H2F;
- historical 30m/50m physical tests;
- direct T90/basepath/full-effort runs;
- SP-017 range/confidence overlay;
- any exact duplicate/cluster metadata already present.

Required work:

1. Build a canonical row-level physical measurement table.
2. Preserve player identity, measurement date/year/range, source/provenance, event/measurement cluster, metric type, raw value/unit, protocol, start type, batting side if relevant, bunt/swing/game context, and confidence.
3. Deduplicate repost/transcription copies of the same underlying measurement without deleting provenance.
4. Never convert 30m/50m proportionally into T90.
5. Never treat unknown protocol/date as exact; retain interval/range/context evidence instead of zeroing it.
6. Produce current100 and extended-anchor coverage separately.
7. Define an explicit evidence-role hierarchy: exact direct physical > protocol-bounded physical range > weak historical directional context.
8. Measure which current100 players and which anchor players gain a non-peak physical lane.

Required output:
`outputs/derived/sp104_historical_physical_canonical.jsonl`

## P0-B. Collect official MLB running-split and exposure/H2F data for the eligible bridge universe

Primary official surfaces:

- `https://baseballsavant.mlb.com/running_splits`
- `https://baseballsavant.mlb.com/sprint_speed_leaderboard`
- MLB 90-foot glossary already frozen by SP-103.

The public 2026 surfaces expose downloadable leaderboard controls. Do not assume field semantics from labels alone; inspect and freeze the actual exported schema.

### Population

Start from the full SP-101 MLB/NPB identity universe and historical physical-rich anchor population, not only the current100 and not only a tiny same-time pair set.

For every eligible player-season, preserve matched/missing/unresolved state. Absence of a qualifying row is missing exposure, never slow speed.

### Fields / constructs

Collect and preserve when available:

- standardized 90-foot time;
- cumulative five-foot split vector / raw split representation exposed by source;
- batting side;
- season;
- opportunities / qualifier denominator;
- Sprint Speed;
- Competitive Runs;
- Bolts;
- HP-to-1B;
- any source-level player ID and team needed for reproducible crosswalk.

### Guards

- Raw H2F/contact-to-first and standardized 90-foot time are distinct.
- Same underlying plays must not be counted as independent evidence twice.
- Competitive Runs is exposure/reliability context, not speed by itself.
- Bolts is tail/frequency context and must be exposure-adjusted; raw count is not a speed score.
- HP-to-1B needs batting-side/protocol handling.
- Preserve season/time gap when transferring to current NPB appraisal.

Required outputs:

- `data/manual/sp104_mlb_running_splits.csv`
- `data/manual/sp104_mlb_sprint_exposure_h2f.csv`
- `outputs/derived/sp104_mlb_running_collection_manifest.json`
- `outputs/derived/sp104_mlb_npb_running_crosswalk_coverage.json`

If the Download CSV UI cannot be reproduced programmatically, document exact failure and make one bounded alternative acquisition attempt using the public page/network route. Do not spin through uncontrolled scraping methods.

## P0-C. Evaluate, rather than assume, data-rich -> data-poor transfer methods

Candidate methods to test:

1. leakage-safe anchor calibration;
2. cross-fitted / leave-player-out transfer;
3. hierarchical partial pooling / interval transfer;
4. physical-rich-only rank/quantile mapping;
5. multiple-imputation / interval propagation;
6. handedness/protocol-aware H2F calibration;
7. five-foot acceleration-shape features.

This is a **model-selection experiment**, not a requirement to implement all seven in production.

### Teacher/target rules

- Teacher outcome must be physical or physical-range evidence, never PowerPro player labels.
- Current target player may not teach its own estimate.
- Same-player repeated seasons belong to the same holdout cluster unless a predeclared forward-time test explicitly trains on earlier seasons and tests later seasons.
- League/time/age/protocol differences must be visible features/strata or explicit limitations.
- Common support must be checked before transfer.
- A sparse player may end as `NO_COMMON_SUPPORT`; do not force a point estimate.

### Validation

For each candidate method record:

- training population and N;
- distinct players and player-seasons;
- features;
- target construct;
- holdout design;
- common-support rule;
- calibration error / MAE or interval coverage as appropriate;
- uncertainty;
- comparison against simple baselines;
- incremental value versus frozen SP-101/SP-103 evidence state;
- route dependence / double-count risk;
- result state: `USED`, `BOUNDED_CONTEXT`, `MEASURED_NEGATIVE`, or `NO_COMMON_SUPPORT`.

A complicated method must not be selected merely because it exists. Prefer the simplest method that adds stable out-of-sample information.

Required outputs:

- `outputs/derived/sp104_transfer_method_benchmark.json`
- `outputs/derived/sp104_anchor_to_sparse_player_receipts.jsonl`
- `outputs/derived/sp104_selected_transfer_policy.json`

## P0-D. Recompute evidence-state coverage and top-speed dominance

After P0-A through P0-C:

For all 100 current players compute the evidence state before and after SP-104, including at minimum:

- peak/top-speed lane;
- acceleration/H2F lane;
- end-to-end/T90 lane;
- historical physical range lane;
- selected anchor/transfer lane;
- technique/proxy lanes kept separate;
- missingness/common-support state.

Run removal/ablation for:

- top speed;
- historical physical evidence;
- new MLB split/H2F evidence;
- selected transfer method(s);
- The Show context;
- statistical proxies.

Do **not** optimize for a desired count of non-peak-only players. A player remains peak-only if no defensible independent evidence exists.

Required outputs:

- `outputs/derived/sp104_current100_physical_state_before_after.json`
- `outputs/derived/sp104_component_decision_use_ablation.json`

# P1 — bounded attempts, still part of SP-104

## P1-A. Current NPB+ fastest H2F

The current official product page says fastest H2F exists as a separate field. Make one bounded reproducible attempt to collect per-player current values with value-level provenance.

Rules:

- old local `hp_to_1b_sec` remains quarantined;
- never infer new values from the old field;
- if official values cannot be reproducibly obtained, close as `BLOCKED_EXTERNAL_CURRENT_VALUE_SURFACE` and proceed;
- if obtained, compare old-vs-new only as a provenance reconciliation audit, not as automatic validation of old rows.

Required output:
`outputs/derived/sp104_npbplus_h2f_recollection_receipt.json`

## P1-B. MLB Outfielder Jump Burst

Official surface:
`https://baseballsavant.mlb.com/leaderboard/outfield_jump`

Only collect if reproducible and if the eligible MLB-experienced outfielder crosswalk has nontrivial overlap.

Preserve Reaction, Burst, Route and opportunity/qualification fields separately.

Use Burst only as **defensive-context acceleration/burst evidence**. Do not promote Reaction or Route into physical speed, and do not generalize OF-only evidence to non-outfielders.

Required output:
`outputs/derived/sp104_outfielder_jump_burst_context.json`

# P2 — explicitly non-blocking in this wave

Do not expand SP-104 to chase the following unless they are virtually free byproducts of P0/P1 collection:

- WBC running rows if public search still exposes no running result columns;
- Lead Distance / Lead Distance Gained beyond technique-separation documentation;
- 1.02 Spd beyond composite/double-count control;
- broad new MLB Pipeline scouting collection;
- generic new SNS/video/community collection;
- engine-response calibration;
- league simulation;
- current100-vs-full-roster final display-scale calibration.

Persist any incidental discovery, but do not create additional blocking tasks unless it invalidates a core source/provenance assumption.

# QA requirements

Independent QA must not be a schema-only checker.

At minimum:

1. Recompute P0-A row counts and dedup clusters from raw inputs.
2. Recompute MLB collection coverage from frozen exported rows and crosswalk.
3. Verify current target player never appears in its own teacher fold.
4. Detect same-player season leakage.
5. Test malformed/wrong-player identity fixtures.
6. Test handedness/protocol guard for H2F.
7. Test that 30m/50m cannot be promoted as T90.
8. Test that PowerPro labels are absent from physical teachers/features.
9. Test that missing official leaderboard rows do not become zero/slow.
10. Test that raw Bolt count is not used without exposure context.
11. Test that Reaction/Route cannot enter the Burst physical-context lane.
12. Recompute all-100 before/after physical states and ablations.
13. Confirm no final 0-100 speed rating was generated.
14. Confirm owner ledger count is still 0.
15. Confirm SP-079 remains blocked and shoulder untouched.
16. Fix the SP-103 diagnostic-reporting bug so the gate check records `depends_on`, not nonexistent `dependencies`.
17. Add a fail-before fixture where SP-104 is removed from SP-079 `depends_on`; registry/gate QA must fail.
18. Deterministic transforms must rerun byte-identically from frozen source snapshots.

# Required canonical outputs

At minimum:

- `outputs/derived/sp104_historical_physical_canonical.jsonl`
- `data/manual/sp104_mlb_running_splits.csv`
- `data/manual/sp104_mlb_sprint_exposure_h2f.csv`
- `outputs/derived/sp104_mlb_running_collection_manifest.json`
- `outputs/derived/sp104_mlb_npb_running_crosswalk_coverage.json`
- `outputs/derived/sp104_transfer_method_benchmark.json`
- `outputs/derived/sp104_anchor_to_sparse_player_receipts.jsonl`
- `outputs/derived/sp104_selected_transfer_policy.json`
- `outputs/derived/sp104_current100_physical_state_before_after.json`
- `outputs/derived/sp104_component_decision_use_ablation.json`
- `outputs/derived/sp104_npbplus_h2f_recollection_receipt.json`
- `outputs/derived/sp104_outfielder_jump_burst_context.json`
- `outputs/derived/qa_sp104_pre_sp079_remediation.json`
- `outputs/derived/sp104_pre_sp079_readiness.json`
- `docs/audits/sp104_pre_sp079_high_value_remediation.md`

If a required acquisition is genuinely unavailable, the corresponding canonical file must still exist as a structured negative/block receipt with denominator and error/provenance; do not fabricate empty success data.

# Definition of Done

SP-104 may close only when:

1. every P0 source/method has actually been tested, not merely listed;
2. existing 74 H2F / 232 30m-50m / 12 T90 baseline records are either decision-effectively materialized or individually bounded/excluded with reasons;
3. official MLB running collection has a reproducible success or a bounded documented acquisition failure;
4. transfer candidates have honest out-of-sample/common-support results and only defensible methods are selected;
5. all 100 current players have explicit post-SP104 physical-state and transfer-support receipts;
6. top-speed dominance is remeasured rather than hidden;
7. new evidence route removal/ablation is computed;
8. no PowerPro teacher contamination or technique leakage is present;
9. independent QA passes substantive fixtures;
10. owner verdict count remains 0;
11. no final numeric speed rating or shoulder artifact exists;
12. task registry correctly binds SP-079 to SP-104.

Terminal states:

- `DONE_VALIDATED_READY_FOR_SP079` — high-value feasible gaps are tested and incorporated/bounded.
- `DONE_NEGATIVE_FINDING_READY_FOR_SP079` — high-value feasible tests were performed but add no defensible incremental information.
- `PARTIAL/BLOCKED` — a material feasible P0 gap remains untested.

Even if ready, **stop at SP-104**. Do not run SP-079 automatically. A browser GPT independent review must accept the SP-104 result before SP-079 is authorized.

作業フォルダ: /mnt/c/Users/amila/Desktop/Claude Code/repos/pawapuro-pennant-gpt-handoff
Repo: L-carp55/pawapuro-pennant-gpt-handoff

パワプロ査定プロジェクトの走力査定です。SP-079 commit `be3588b26e3ce0818880f80c4a0350764886bb6f` は機械QAは通りましたが、browser独立監査で最終統合ロジックのsemantic defectが見つかったため、SP-105「SP-079 synthesis/calibration semantic repair」だけを実行してください。

## Target

Branch:
`codex/speed-sp105-sp079-synthesis-calibration-repair-20260826`

Read in full before work:

1. `docs/audits/sp079_browser_independent_review_20260826.md`
2. `docs/tasks/SP105_SP079_SYNTHESIS_CALIBRATION_REPAIR_20260826.md`
3. `docs/state/speed_sp105_activation_state_20260826.json`
4. SP-079 frozen policy/final100/synthesis/ablation/QA/audit/generator
5. SP-100 through SP-104 canonical evidence, especially SP-104 physical/MLB/transfer outputs and SP-101 multibridge/The Show/ordinal outputs

## Worktree safety

- `git fetch origin` first.
- Inspect `git status`, `git worktree list`, local/remote branch state and HEAD.
- Do not modify/reset/clean the user's canonical checkout.
- Do not touch any existing stash including `stash@{0}`.
- Use a fresh isolated worktree for this exact SP-105 branch unless a clean exact registered worktree already exists.
- Do not reuse old SP-101/SP-102/SP-103/SP-104/SP-079 worktrees for writes.

## First action — registry reconciliation

Before model work, update `docs/state/speed_task_registry.tsv` so that:

- SP-079 is `PARTIAL`, with its prior 100-row/800-cell output preserved as a frozen baseline but browser review superseding `DONE_VALIDATED`;
- SP-105 exists as a gate-blocking repair child depending on SP-079/SP-104 as appropriate;
- SP-080 and SP-081 remain `NOT_STARTED`;
- SP-082/shoulder remains blocked;
- owner verdict count remains 0;
- SP-101/102/103/104 validated states remain unchanged.

Run canonical registry QA immediately and fail closed on error.

## Scope boundary

Do **not** collect another broad evidence wave. SP-105 is a synthesis/calibration repair only.

Do not:
- perform new broad YouTube/X/scouting/WBC collection;
- use PowerPro player ratings to learn weights, calibration, thresholds, or manual corrections;
- revive the old NPB+ `hp_to_1b_sec` field;
- run SP-080/SP-081;
- start shoulder work.

## Required baseline reproduction

First reproduce the exact `be3588b...` SP-079 output from its frozen manifest. Preserve equal-family averaging as `BASELINE_CONTROL_ONLY`.

The repair must prove why the selected policy is preferable using physical evidence, not merely replace one arbitrary formula with another.

## Critical defect to repair

The current policy declares Tier A > Tier B > contextual tiers, but the point estimator gives every available physical family equal `1/n` influence after independently converting each family to a percentile.

This causes two problems:

1. old/wide/protocol-bounded evidence can move the point as much as current direct evidence;
2. percentiles from different reference populations (current100 NPB+, historical tests, MLB Statcast) are averaged as though they share a calibrated latent scale.

Example: 中川圭太 combines current NPB+ peak percentile about 0.758 and historical/bounded H2F about 0.127 at 50:50, producing about 0.442. Preserve this as a regression case; do not manually tune the player.

## Synthesis benchmark

Execute the full SP-105 parent spec. At minimum compare:

A. current equal-family baseline;
B. tier-aware reliability/precision synthesis;
C. cross-family physical calibration where overlapping anchors/common support permit;
D. conservative Tier-A anchor + lower-tier bounds/constraints when cross-family calibration is not identifiable.

### Validation rules

- physical evidence only as validation target;
- no PowerPro features/labels/optimization;
- player-clustered/leave-player-out validation;
- same-player seasons held together unless explicit forward-time design;
- no target self-teaching;
- common-support required;
- explicit reference population for each percentile/mapping;
- no extrapolation presented as calibrated evidence;
- prefer simpler policy when held-out performance is statistically indistinguishable.

Report held-out rank error, interval coverage, calibration/stability and common-support coverage as data permit.

If no cross-family mapping is defensible, do not force one: use the conservative tier-aware policy and keep lower-tier evidence as bounded constraints.

## Context decision-use repair

For The Show, analog/ordinal/transition, proxies and scouting/community/video/usage, separately measure whether removal changes:

- point;
- display rating;
- rank;
- interval;
- confidence;
- conflict state;
- evidence state.

A lane may validly be `PRESENT_NO_DECISION_EFFECT`. Do not call it materially used merely because it was loaded or widened uncertainty.

The Show remains no-direct-copy. But validated SP-101 trajectory/update/transition/ordinal constraints should be routed into bounds/rank/conflict if semantically supported. If final effect is still zero, record an explicit measured zero-effect finding.

Do not force SP-104 transfer methods into production when they were not validated for production use.

## Unresolved rows

Every player must have `point_semantics`:

- `DEFENSIBLE_POINT_ESTIMATE`
- `DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE`
- `NO_DEFENSIBLE_POINT`

An unresolved conflict cannot silently look like an ordinary validated estimate. If a UI display midpoint is retained, keep it separate from the scientific point estimate when appropriate.

## Rematerialize exactly 100 players

Produce the required SP-105 final JSON/CSV/report with:

- selected calibrated/tier-aware synthesis policy;
- exact evidence/provenance receipts;
- current/high-tier vs historical/bounded influence;
- context decision-use classification;
- explicit point semantics;
- confidence/conflict/missingness;
- provisional display rating only;
- `scale_status=PROVISIONAL_PENDING_SP071_SP072`;
- PowerPro posthoc-only fields after core values freeze.

No manual player-specific adjustment based on PowerPro plausibility is allowed.

## Rich final-value ablation

Run actual remove-and-recompute for the same eight components as SP-079.

Do not use one combined `changed_player_count` alone. For every component report:

- point changed count + effect sizes;
- display rating changed count;
- rank changed count + effect sizes;
- interval changed count;
- confidence changed count;
- conflict changed count;
- evidence-state changed count;
- applicable/present zero-effect count.

Retain top-speed correlation and leave-peak-out diagnostics as descriptive only.

## Independent QA

Use a separate red-team process. It must detect at minimum:

- Tier-B equal override of Tier-A without validation;
- uncalibrated mixing of percentiles from different reference populations;
- PowerPro in weight/calibration selection;
- self-teaching or same-player season leakage;
- direct The Show copy;
- loaded-but-zero-effect lane falsely marked material;
- interval-only change counted as point change;
- unresolved row mislabeled as defensible point;
- legacy NPB+ H2F;
- 30m/50m -> T90;
- missing -> zero/slow;
- owner verdict write / SP-080/SP-081/shoulder output.

Deterministic stages must rerun byte-identically.

## End state

Allowed SP-105 terminal states:

- `DONE_VALIDATED_READY_FOR_SP079_REACCEPTANCE`
- `DONE_NEGATIVE_FINDING_READY_FOR_SP079_REACCEPTANCE`
- `PARTIAL/BLOCKED`

Even if validated, STOP at SP-105. Do not run SP-080, SP-081 or shoulder. Browser GPT must independently review the repaired output and explicitly reaccept SP-079 first.

Commit/push all artifacts, verify remote HEAD, then report:

- branch + exact commit;
- registry state;
- baseline reproduction result;
- candidate synthesis policies and held-out validation results;
- selected policy and why;
- 100-player evidence/confidence/point-semantics distribution;
- largest changes vs frozen SP-079 baseline;
- component point/rank/interval/confidence effect counts;
- The Show/analog/proxy/community actual decision-use counts;
- unresolved/no-defensible-point players;
- independent QA checks and fixtures;
- owner verdict count;
- confirmation SP-080/SP-081/shoulder untouched.

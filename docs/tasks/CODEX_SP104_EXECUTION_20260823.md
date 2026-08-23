作業フォルダ: /mnt/c/Users/amila/Desktop/Claude Code/repos/pawapuro-pennant-gpt-handoff
Repo: L-carp55/pawapuro-pennant-gpt-handoff

パワプロ査定プロジェクトの走力査定です。SP-103のbrowser独立監査により、SP-103の棚卸し完了は承認されましたが、SP-079 readinessは高価値gapのbounded remediationが終わるまで差し戻されています。SP-104だけを実行してください。

## Target

Branch:
`codex/speed-sp104-pre-sp079-high-value-remediation-20260823`

Base SP-103 commit:
`7cbb0eec61eb65e88ec43c90a9b6fa6da594db4d`

Read in full before work:

1. `docs/audits/sp103_browser_independent_review_20260823.md`
2. `docs/state/speed_sp103_readiness_override_20260823.json`
3. `docs/tasks/SP104_PRE_SP079_HIGH_VALUE_EVIDENCE_REMEDIATION_20260823.md`
4. `docs/state/speed_sp104_activation_state_20260823.json`
5. SP-103 canonical audit/universe/gap/method/readiness/QA artifacts.

## Worktree safety

- `git fetch origin` first.
- Inspect `git status`, `git worktree list`, branch and remote HEAD.
- The user's canonical checkout has pre-existing changes preserved in `stash@{0}` from the prior run. **Do not pop, drop, overwrite, clear, reset, or otherwise touch that stash.**
- Do not clean/reset the canonical checkout.
- Use a fresh isolated worktree for the SP-104 branch unless an existing exact SP-104 worktree is already registered and clean.
- Do not reuse the old SP-101/SP-102/SP-103 worktrees for writes.

## Governance lock

During SP-104:

- SP-079 must remain blocked.
- owner verdict capture must remain disabled and `owner_verdict_count=0`.
- no final 0-100 speed ratings.
- no shoulder work.
- SP-103's 71-row completeness inventory remains accepted; do not rebuild it from scratch.
- old local NPB+ `hp_to_1b_sec` remains quarantined and must never be treated as validated official H2F.
- PowerPro player values must never be physical teacher labels.

## First repository change

Before any collection/model work, update `docs/state/speed_task_registry.tsv`:

- add SP-104 as a gate-blocking child of SP-103;
- keep SP-103 `DONE_VALIDATED` but note its readiness is superseded by `docs/state/speed_sp103_readiness_override_20260823.json`;
- add SP-104 to SP-079 `depends_on` and keep SP-079 `BLOCKED_DEPENDENCY`;
- preserve SP-101 `DONE_VALIDATED`, SP-102 `DONE_NEGATIVE_FINDING`, owner-verdict and shoulder state.

Run canonical registry QA immediately. Add/fix QA so the diagnostic record uses the actual `depends_on` field rather than nonexistent `dependencies`.

## Execute the parent SP-104 spec exactly

The critical path is intentionally bounded:

### P0-A — existing physical evidence

Materialize the existing historical physical corpus into a decision-effective canonical table:
- H2F baseline 74 records;
- 30m/50m baseline 232 records;
- T90/basepath/full-effort baseline 12 records.

Preserve protocol/date/batting-side/start-type/context/confidence and measurement-cluster provenance. Deduplicate same underlying measurement. No 30m/50m -> T90 proportional conversion. Unknown protocol/date remains bounded range/context, not zero and not exact.

### P0-B — official MLB running data

Collect for the full eligible SP-101 MLB/NPB crosswalk + historical physical-rich anchor universe, not just current100:

- Baseball Savant 90ft Running Splits / five-foot split representation:
  `https://baseballsavant.mlb.com/running_splits`
- Sprint Speed leaderboard exposure/H2F context:
  `https://baseballsavant.mlb.com/sprint_speed_leaderboard`

Current official pages expose Download CSV controls. Freeze actual exported schema and source snapshots/receipts. Preserve season, player ID, batting side, qualifier/opportunity denominator, 90ft/raw split fields, Sprint Speed, Competitive Runs, Bolts, HP-to-1B where actually exposed.

Never interpret missing qualification as slow. Do not double-count shared underlying plays. Raw Bolt count requires exposure context. Raw contact-to-first and standardized 90ft are separate constructs.

### P0-C — transfer benchmark

Benchmark rather than automatically adopt:
- leakage-safe anchor calibration;
- cross-fit/leave-player-out;
- hierarchical interval/partial pooling;
- physical-rich-only rank/quantile mapping;
- multiple-imputation/interval propagation;
- handedness/protocol-aware H2F;
- five-foot acceleration-shape features.

Use physical evidence/ranges as teacher targets only. Same target player may not teach itself. Same-player seasons must be clustered unless a declared forward-time holdout is used. Common-support is mandatory. `NO_COMMON_SUPPORT` is a valid result. Prefer simpler methods if incremental out-of-sample value is comparable.

### P0-D — all-100 remeasurement

Recompute all 100 players' physical evidence states and route-removal ablation after P0. Measure top-speed dominance again; **do not optimize to reduce peak-only count** and do not generate final ratings.

### P1 — bounded only

- One reproducible attempt to recollect current official NPB+ fastest H2F. If unavailable, close structured `BLOCKED_EXTERNAL_CURRENT_VALUE_SURFACE`; old local values stay quarantined.
- Outfielder Jump Burst: collect only if reproducible and eligible MLB-experienced OF overlap is material. Preserve Reaction/Burst/Route separately; Burst is defensive context only.

### P2 — do not expand scope

WBC running rows, Lead Distance, 1.02 Spd, broad Pipeline scouting, generic community, engine, simulation and final scale work are non-blocking here unless they fall out essentially free from P0/P1. Do not create another exploratory wave merely because these exist.

## Error rule

If acquisition or tooling fails, before changing strategy search official documentation/issues for the exact error or source behavior. Preserve the failure receipt. Do not silently switch to a lower-provenance source or claim full coverage from a bounded query.

## Parallel work

Where possible, use independent sub-agents/processes for non-conflicting lanes:
- historical physical canonicalization;
- official MLB collection/crosswalk;
- transfer-method benchmark;
- independent QA/red-team.

Keep write paths separate until parent materialization.

## QA

Implement the substantive QA in the SP-104 spec. In particular fail-before fixtures must catch:

- target player teaching itself;
- same-player season leakage;
- wrong identity joins;
- 30m/50m promoted to T90;
- PowerPro entering physical teacher features/targets;
- missing leaderboard row converted to zero/slow;
- raw Bolt count used without exposure;
- Reaction/Route leaking into Burst lane;
- SP-104 removed from SP-079 `depends_on`;
- owner verdict nonzero;
- accidental final speed numeric generation.

Deterministic transforms must rerun byte-identically from frozen input snapshots.

## Required outputs and end state

Produce every canonical output listed in `SP104_PRE_SP079_HIGH_VALUE_EVIDENCE_REMEDIATION_20260823.md`, including independent QA, readiness and audit.

Terminal states allowed:
- `DONE_VALIDATED_READY_FOR_SP079`
- `DONE_NEGATIVE_FINDING_READY_FOR_SP079`
- `PARTIAL/BLOCKED`

Even on READY, **STOP at SP-104**. Do not run SP-079, owner verdict capture, final numeric speed generation or shoulder.

Commit/push all artifacts to the SP-104 branch, verify remote HEAD, then report:
- branch + exact commit;
- registry state;
- acquisition coverage and failures;
- historical physical rows before/after dedup and current100/anchor coverage;
- each transfer method's validation result and selected policy;
- pre/post peak-only/acceleration/end-to-end coverage (as diagnostics, not optimization targets);
- ablation/decision-use findings;
- independent QA status;
- owner verdict count;
- SP-079 readiness result.

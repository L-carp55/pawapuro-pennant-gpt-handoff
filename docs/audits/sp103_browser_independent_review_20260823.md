# SP-103 Browser Independent Review — readiness override

Date: 2026-08-23
Reviewed commit: `7cbb0eec61eb65e88ec43c90a9b6fa6da594db4d`
Reviewed branch: `codex/speed-sp103-evidence-universe-completeness-20260823`
Independent reviewer role: browser GPT / project coordinator
Scope: speed only

## Verdict

- **SP-103 completeness audit itself: ACCEPTED / DONE_VALIDATED remains valid.**
- **SP-103 readiness result `READY_FOR_SP079_WITH_BOUNDED_GAPS`: OVERRIDDEN.**
- Effective transition state: **`SP079_BLOCKED_PENDING_SP104_HIGH_VALUE_REMEDIATION`**.
- SP-079 must not run yet.
- SP-078 owner verdict count must remain 0.
- Final numeric speed ratings and shoulder work remain blocked.

This is not a request to reopen the entire evidence universe or to expand scope indefinitely. It applies SP-103's own completion rule: when a discovered gap is both feasible and likely to materially change final appraisal, create a bounded remediation child task before SP-079.

## Why the completeness audit is accepted

The SP-103 run materially improved the project state and satisfies the inventory side of its specification:

- 66 mandatory candidates plus 5 additional discovered candidates = 71 total evidence-universe rows;
- repo-wide semantic/structured asset scan with measured denominators;
- 10 official/primary source receipts with frozen snapshots/hashes;
- explicit separation of top speed, acceleration/H2F/end-to-end, defensive burst, technique, outcome proxies, external-game context, historical trajectory and scale/engine calibration;
- old local NPB+ H2F remains fail-closed rather than being silently resurrected;
- SP-101 route decision-use receipts and exact 100 x 18 ablation are preserved;
- owner feedback and requirements are traced;
- owner verdict remains empty and SP-079/shoulder were not run.

Therefore the zero-based **inventory/completeness** accomplishment should not be rolled back.

## Why READY_FOR_SP079 is not accepted yet

### 1. The top-speed dominance result is materially unresolved

SP-103 itself measured the current independent physical-state composition as:

- `PEAK_ONLY`: **78 / 100**
- `PEAK_AND_ACCELERATION`: **21 / 100**
- `NEITHER`: **1 / 100**
- state changed after peak removal: **78 / 100**

This is not automatically evidence that the final model is wrong. However, it establishes that the final appraisal is highly exposed to missing acceleration/end-to-end evidence. A newly discovered feasible acceleration/end-to-end source therefore has unusually high expected information gain before final appraisal.

### 2. High-value physical evidence already exists locally but is still decision-ineffective

The canonical evidence universe records:

- historical sourced H2F: **74 records**, `COLLECTED_BUT_UNUSED`;
- historical 30m/50m physical tests: **232 records**, `COLLECTED_BUT_UNUSED`;
- direct timed T90/basepath/full-effort runs: **12 records**, `COLLECTED_BUT_UNUSED`.

These are not merely hypothetical sources. They already exist in the repository and are directly relevant to the owner requirement that baseball-relevant speed not collapse into top speed alone. Their protocol/date/handedness uncertainty must be preserved, but uncertainty is not a reason to reduce them to zero information.

### 3. Official Statcast sources confirmed by SP-103 are feasible to acquire, not merely theoretical

Independent current-source recheck on 2026-08-23 confirmed:

- Baseball Savant `90ft Running Splits Leaderboard` exposes year, bat side, minimum opportunities, raw split times, and a **Download CSV** control:
  `https://baseballsavant.mlb.com/running_splits`
- Baseball Savant `Sprint Speed Leaderboard` exposes year/opportunity controls and a **Download CSV** control; its official page defines competitive runs/bolts and SP-103's frozen receipt confirms the current surface also carries HP-to-1B:
  `https://baseballsavant.mlb.com/sprint_speed_leaderboard`
- Baseball Savant `Outfielder Jump Leaderboard` exposes a **Download CSV** control; the official MLB definition and SP-103 receipt separate Reaction, Burst and Route:
  `https://baseballsavant.mlb.com/leaderboard/outfield_jump`

Accordingly, at least the 90-foot/split and Sprint-exposure/H2F families are feasible bounded collection targets for the MLB-experienced/historical anchor universe. They should not be skipped merely because SP-103 was an inventory task.

### 4. Several transfer methods are explicitly marked as needing design/validation before final appraisal

The SP-103 universe itself marks the following as not yet implemented or source-confirmed-new, with `design and independently validate before any final appraisal`:

- leakage-safe anchor calibration;
- hierarchical partial pooling / interval transfer;
- physical-rich-only rank/quantile mapping;
- multiple-imputation / interval propagation;
- handedness/protocol-aware H2F calibration;
- MLB 5-foot acceleration-shape features.

SP-103's purpose was partly to determine which transfer methods could turn data-rich anchors into bounded evidence for data-poor players. The correct remediation is **not** to implement all six automatically. The child task must benchmark them under leakage-safe holdout/common-support rules and retain only methods that add stable information.

### 5. SP-103's own decision rule calls for a child task in this situation

`docs/tasks/SP103_SPEED_EVIDENCE_UNIVERSE_COMPLETENESS_20260823.md` says that gaps likely to materially change final appraisal should create a bounded remediation child task, while low-value or inaccessible gaps may close as measured missingness/negative findings.

The combination of (a) 78/100 peak-only states, (b) locally present direct/near-direct physical records that are still unused, and (c) public official running split/H2F surfaces makes a bounded child task necessary before the final 100-player appraisal.

## QA issue found during independent review

`qa_sp103_speed_evidence_universe.json` records:

- check: `registry_sp103_gate_and_sp079_block`
- `sp079_dependencies: null`
- `passed: true`

This initially looks contradictory, but the checker implementation proves the substantive gate test is correct: it evaluates `sp079.get("depends_on")`. The diagnostic payload mistakenly records `sp079.get("dependencies")`, a nonexistent field. This is a **reporting-only QA bug**, not evidence that SP-079 escaped the dependency lock. SP-104 must fix the reported key and add a fail-before fixture that removes SP-104 from `depends_on` once SP-104 is registered.

## Bounded remediation: what is blocking vs non-blocking

### P0 — blocking before SP-079

1. Materialize the already-collected H2F / 30m / 50m / T90 corpus into a canonical, deduplicated physical-evidence matrix with protocol/date/handedness/confidence preserved.
2. Collect official MLB 90-foot Running Splits / five-foot splits and Sprint leaderboard exposure + HP-to-1B for the eligible MLB/NPB bridge and historical anchor universe, with raw denominator/provenance.
3. Evaluate leakage-safe data-rich -> data-poor transfer alternatives and retain only methods with defensible incremental validation/common support. Explicit no-common-support is acceptable.
4. Re-run all-100 component coverage and top-speed-removal/decision-use ablation after remediation, without creating final 0-100 speed ratings.

### P1 — bounded attempts; do not spin indefinitely

5. Attempt current NPB+ per-player fastest H2F acquisition with value-level provenance. Old local H2F remains quarantined regardless of failure/success until independently reconciled.
6. Collect/evaluate Outfielder Jump Burst only for eligible MLB-experienced outfielders if the acquisition is reproducible and overlap is material. Reaction/Route remain separate and Burst is defensive context, not universal base speed.

### P2 — non-blocking unless cheap evidence changes materiality

- WBC Statcast running values remain bounded external missingness if the checked public surface still exposes no player-level running rows.
- Lead Distance remains technique/context only.
- 1.02 Spd remains a mixed proxy with double-count risk.
- MLB Pipeline Run scouting may be checked against the existing scouting corpus, but it is not a reason to delay SP-079 unless material new current/anchor coverage is demonstrated.
- engine response, league simulation and full-roster scale consistency are downstream scale/gate work and are outside this remediation.

## Acceptance rule for SP-104

SP-104 may close without forcing every candidate into the final model. It must show, for every P0/P1 route:

- exact acquisition/coverage denominator;
- provenance and reproducible snapshot/receipt;
- dedup/construct separation;
- player-clustered or leave-player-out validation where learning is involved;
- common-support and leakage guard;
- incremental effect/ablation versus the frozen pre-SP104 state;
- explicit `USED`, `BOUNDED_CONTEXT`, `MEASURED_NEGATIVE`, `BLOCKED_EXTERNAL`, or `NO_COMMON_SUPPORT` result;
- no silent fallback and no PowerPro teacher path.

The exit criterion is **not** a target number of players moving away from peak-only. The criterion is that the high-information feasible gaps have been actually tested and either incorporated or closed with measured evidence.

## Governance

Effective immediately after this review:

- SP-103 frozen artifacts remain accepted.
- SP-103's `READY_FOR_SP079` overlay is superseded by `docs/state/speed_sp103_readiness_override_20260823.json`.
- SP-104 is the only new pre-SP079 child task authorized by this review.
- SP-079 remains `BLOCKED_DEPENDENCY` until SP-104 independent QA closes.
- owner verdict capture remains disabled (`owner_verdict_count=0`).
- no final numeric speed generation.
- no shoulder work.

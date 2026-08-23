# SP-103 Speed Evidence Universe Completeness Audit

- Audit date: 2026-08-23
- Final audit status: **READY_FOR_SP079**
- Independent QA: **PASS_READY_FOR_SP079**
- Scope boundary: SP-103 only. SP-079, SP-078 owner verdict capture, final numeric speed generation, and shoulder work were not run.

## Decision

The zero-based evidence universe is complete at the declared floor and has an explicit addendum for candidates discovered during execution. The independent QA recomputed the canonical coverage, provenance, decision-use, leakage, double-count, gate-lock, deterministic-rematerialization, and fail-before conditions. It emitted `READY_FOR_SP079` with bounded gaps and negative findings preserved.

This is a gate handoff, not a final player appraisal. No player-level final speed value or owner verdict was created by SP-103.

## Coverage and inventory

| Area | Measured result |
|---|---:|
| Mandatory zero-based candidates | 66 |
| Additional candidates found and independently recorded | 5 |
| Total evidence-universe rows | 71 |
| Status counts | `{"COLLECTED_BUT_UNUSED": 4, "IMPLEMENTED": 1, "IMPLEMENTED_INCOMPLETE": 42, "MEASURED_NEGATIVE": 4, "NOT_COLLECTED": 7, "SCOPED_REJECTED": 1, "SOURCE_CONFIRMED_NEW": 12}` |
| Tracked files / regular files scanned | 1049 / 1039 |
| Structured assets / semantic assets | 475 / 983 |
| SQLite databases / objects / semantic objects | 1 / 38 / 36 |
| Official/primary external receipts | 10; all frozen snapshots hash-verified |
| WBC Japan selector lower-bound | 2023=15, 2026=30 |
| WBC running result rows | 2023=0, 2026=0; classified as bounded public-surface acquisition limitation, never as slow/zero |
| Baseline requirement rows / owner seed rows traced | 61 / 15 |

The local inventory includes the NPB+ measurement table, MLB bridge, The Show tables, PowerPro panel, batting/outcome tables, baserunning advances, steal events, and structured defensive range tables. The collected-but-unused scan classified nonzero assets rather than treating file existence as decision use.

## Evidence families and guardrails

The mandatory families 1–66 are each present with source/provenance, coverage denominator, status, current local asset, evidence role, known confounding, validation need, next action, and a direct-promotion guard. Families are separated as follows:

- NPB+ Sprint Speed and current official fastest H2F are separate. The historical local `hp_to_1b_sec` values remain fail-closed because the current official page listing does not validate their old provenance.
- MLB Sprint Speed, 90-foot/5-foot splits, H2F, 30m/50m, T90, and Outfielder Jump Burst remain distinct constructs. Jump Burst is defensive context and is not universal running speed.
- Infield hits, GDP avoidance, triples, advances, UBR/BsR, 1.02 Spd, steals, Lead Distance, and Statcast baserunning value are proxy or technique/context families. No proxy is allowed direct physical promotion.
- The Show Speed, Stealing, and Baserunning Aggressiveness are separate game-context fields. The Show and PowerPro are not used as physical ground truth or silently copied into a current NPB value. Prospi A is retained under the owner ruling; console Prospi non-collection remains explicit.
- Scouting, timed tests, pinch-runner use, video, SNS/community, injury, age, pairwise claims, and generic fast/slow labels retain bounded direction/context or a measured negative finding; comment/reaction volume is not independent evidence.
- RngR/UZR/range assets and Jump Burst are defensive context. No NPB tracking-derived straight-line fielder speed separated from reaction/route/positioning was found in the local universe.

The addendum rows separately record WBC Statcast as a bridge opportunity, Lead Distance/Lead Distance Gained, Competitive Runs/Bolts/HP-to-1B exposure fields, MLB Pipeline Run scouting, and the NPB+ H2F provenance conflict.

## Transfer, decision-use, and top-speed audit

The method universe contains all candidate methods 44–62. Each method records training population, target population, features, target construct, common support, leakage guard, holdout design, calibration status, uncertainty, and actual decision-use status. SP-101 receipts were independently re-counted as 18 routes × 100 players, and the route-removal contract contains exactly 1,800 cells (100 × 18).

The pre-final-appraisal component ablation removed peak speed from all 100 independent physical states without producing a final value: 78 players were peak-speed-only, 21 had peak speed plus bounded acceleration/end-to-end evidence, and 1 had neither. The state changed for 78 after peak removal. This is an explicit top-speed-dominance finding and must remain visible to the next appraisal step; it is not a final numeric appraisal.

## Gaps and negative findings

The gap/remediation artifact records each non-implemented, source-confirmed-new, collected-but-unused, scoped-rejected, and measured-negative candidate with a bounded next action. Open exclusion blockers remain visible, including EX-004, EX-017, and EX-018. SP-103 did not close them by relabeling.

The principal bounded findings are:

1. The public WBC surface confirms tracking scope and selector denominators but did not expose player-level running result rows in the frozen search surface.
2. The current official NPB+ page confirms separate Sprint Speed and fastest H2F fields, but no current per-player H2F values were retrieved; old local H2F values are not resurrected.
3. NPB defensive straight-line speed separated from route/reaction/positioning remains unavailable in the local asset universe.
4. New anchor calibration, hierarchical interval transfer, physical-only quantile mapping, multiple-imputation, handedness/protocol-aware H2F calibration, and 5-foot acceleration-shape transfer remain explicit pre-SP-079 design gaps rather than silent fallbacks.

## Independent QA evidence

The independent H lane passed all checks and five fail-before fixtures:

- removing a mandatory candidate;
- promoting legacy H2F to direct use;
- removing the H2F/5-foot transfer method;
- dropping a requirement trace row; and
- disabling the exact 100×18 route ablation.

The parent materializer was rerun from frozen inputs and produced byte-identical base canonical outputs; the readiness file is intentionally a separate finalizer overlay changing from `PENDING_INDEPENDENT_QA` to `READY_FOR_SP079`. Owner verdict count remained 0 and owner capture remained locked. The registry retains SP-079 as dependency-blocked on SP-103; SP-101 and SP-102 statuses remain unchanged.

## Execution isolation

The runtime did not expose a sub-agent orchestration API, so lanes A–G were executed as separate independent processes with isolated intermediate files, and lane H was a separate red-team process that read canonical outputs and reran the parent materializer for byte comparison. The parent alone combined the lanes. This is recorded as an execution limitation, not hidden as a claim of separate model identities.

## Frozen artifacts

- `outputs/derived/sp103_speed_evidence_universe.tsv`
- `outputs/derived/sp103_local_asset_inventory.json`
- `outputs/derived/sp103_external_source_verification.json`
- `outputs/derived/sp103_collected_but_unused.json`
- `outputs/derived/sp103_inference_method_universe.json`
- `outputs/derived/sp103_owner_requirement_traceability.tsv`
- `outputs/derived/sp103_gap_and_remediation_plan.json`
- `outputs/derived/sp103_pre_sp079_readiness.json`
- `outputs/derived/qa_sp103_speed_evidence_universe.json`
- `outputs/derived/sp103_materialization_manifest.json`
- `outputs/derived/sp103_sources/*` (frozen official-source snapshots)

**STOP at SP-103.** A later explicitly authorized SP-079 run must consume these artifacts, rerun all-100 consistency/decision-use QA, preserve the H2F/proxy/technique/top-speed guards, and keep owner verdict capture and shoulder work outside this commit.

## Official source receipts

- NPB+ tracking fields: https://www.japan-baseball.jp/npb-plus/
- MLB 90-foot Running Splits: https://www.mlb.com/glossary/statcast/90-foot-running-splits
- MLB Outfielder Jump: https://www.mlb.com/glossary/statcast/jump
- MLB Lead Distance: https://www.mlb.com/glossary/statcast/lead-distance
- Baseball Savant basestealing/Lead Distance Gained: https://baseballsavant.mlb.com/leaderboard/basestealing-run-value
- Baseball Savant Sprint Speed exposure fields: https://baseballsavant.mlb.com/sprint_speed_leaderboard
- 1.02 Spd definition: https://1point02.jp/op/gnav/glossary/gls_explanation.aspx?ecd=204&eid=20047
- WBC Statcast search: https://baseballsavant.mlb.com/statcast-search-world-baseball-classic
- WBC tracking scope: https://www.mlb.com/world-baseball-classic/news/world-baseball-classic-follow-ups-to-watch-in-2026
- MLB Pipeline Run scouting: https://www.mlb.com/prospects/2020/top100/alex-kirilloff-666135

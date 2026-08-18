# SP-101 Codex wave-1 independent review — 2026-08-18

Status: **REJECT DONE_VALIDATED / KEEP SP-101 PARTIAL / REPAIR DISPATCH READY**

Codex wave-1 committed the initial implementation at `127df6b07d39a36b94324e18386fd013b24ccd01` on `codex/speed-sp101-expanded-the-show-universe-20260818`.

Independent browser-GPT review found material execution defects. The wave-1 outputs are **not approval-ready** and must not unlock SP-102, owner review, SP-078 capture, SP-079, or shoulder.

## Confirmed deterministic identity failures

Independent fail-closed audit on the execution branch:

- audit commit: `5c6ea2f997dc83b874115f15d673469634ec458c`
- `docs/audits/sp101_identity_propagation_independent_audit_20260818.md`
- `outputs/derived/qa_sp101_identity_propagation_20260818.json`
- status: `FAIL_IDENTITY_PROPAGATION_REPAIR_REQUIRED`

Confirmed false `NO_MLB_PROMOTION_FOUND` rows:

- カリステ
- ポランコ — 21 eligible The Show Live rows stranded on the historical entity
- モンテロ — 120 eligible The Show Live rows stranded on the historical entity
- サンタナ

Root cause: current-100 rows are keyed as `PROEYE:<id>`, while historical MLB bridge rows with missing ProEye IDs are keyed as `NPBNAME:<name>`; the implementation rebuilds indexes but does not union the same uniquely resolved NPB player before downstream evidence propagation.

The wave-1 transition panel also has only 6 segments / 4 players. The historical crosswalk contains 77 names labeled `MLB_TO_NPB_FOREIGN`, while zero of those foreign names are represented in the transition panel.

## Additional semantic execution gaps

The detailed execution-branch audit is:

`docs/audits/sp101_independent_semantic_execution_audit_20260818.md`

Key findings:

1. The implementation uses The Show observation years as MLB league-state in transition segmentation instead of independently verified MLB regular-season appearance years.
2. The external source manifest contains no independently collected MLB regular-season appearance table, despite the binding requirement to determine MLB promotion/appearance.
3. `MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE` uses only `PHYSICAL_PROTOCOL_PERCENTILE_ONLY`, not the required multi-feature common MLB/NPB indicator profile.
4. The Show side of MB-02 is only `The Show Speed ~ Sprint Speed`; MLB shared batting/baserunning indicators were not collected.
5. MB-07 omits required valid-analog and Community/scouting ordinal edge families.
6. MB-12/13 mark scouting/timed-test and pinch-runner routes `USED_CONTEXT` generically rather than proving per-player evidence consumption.
7. MB-16/18 therefore overstate cross-source consensus and 100×18 decision-use completeness.
8. The SP-102 residual target freeze is invalid and must be regenerated after repair; `LOW`/`VERY_LOW` confidence cannot be dismissed as low expected information gain merely because MLB/The Show coverage is absent.

## Preserved useful work

Do not discard:

- pinned 284,282-row The Show source scan and source hashes;
- Live/non-Live separation;
- look-ahead quarantine;
- Speed/Stealing/Baserunning Aggressiveness separation;
- current NPB physical sources;
- PowerPro source/trajectory assets;
- multi-bridge method definitions;
- SP-078 append-only infrastructure and empty ledger.

## Repair task

The execution branch now contains the binding repair task:

`docs/tasks/CODEX_SP101_IDENTITY_AND_SHARED_METRIC_REPAIR_20260818.md`

Current execution-branch repair-task commit at the time of this receipt:

`d1ae140de5e066a56344dc53ae6a0b82d7728b13`

The repair wave must fast-forward to the latest remote execution-branch HEAD, preserve wave-1 raw/pinned work, repair identity/MLB appearance/shared-indicator semantics, regenerate dependent routes, rerun independent/canonical/determinism QA, and keep the owner ledger empty.

## Governance consequence

- canonical review-branch SP-101 remains `PARTIAL`;
- SP-102 remains blocked;
- SP-079 remains blocked;
- owner review remains locked;
- SP-078 `records=[]`, `owner_verdict_count=0`;
- shoulder remains blocked.

# SP-104 Pre-SP-079 High-Value Remediation

## Conclusion

SP-104 is **PARTIAL_BLOCKED**. The evidence-remediation package is frozen
at decision-use/range state, and the downstream SP-079 gate remains blocked.

## Scope completed

- P0-A: canonicalized the historical physical corpus with measurement-cluster
  deduplication, raw-value/protocol/date/range preservation, identity states,
  and an explicit 30m/50m -> T90 prohibition.
- P0-B: collected official Baseball Savant running-splits, Sprint Speed
  exposure/H2F fields, and Outfielder Jump CSV snapshots for every exact
  MLBAM ID in the crosswalk (not current-100 only).
- P0-C: benchmarked seven leakage-safe physical/range transfer candidates with
  player-clustered holdouts, common-support checks, uncertainty, and
  NO_COMMON_SUPPORT as a valid result.
- P0-D: recomputed all 100 before/after evidence states plus six component
  ablation lanes without creating a final numeric value.
- P1-A: current NPB+ H2F per-player value collection is a bounded negative
  finding; the legacy local H2F field remains fail-closed.
- P1-B: Outfielder Jump is retained as separate defensive context; Reaction,
  Burst, and Route are not merged.

## Independent QA

**PASS_PARTIAL_BLOCKED** (43/43 checks; 6 fail-before fixtures)

The independent QA artifact is
outputs/derived/qa_sp104_pre_sp079_remediation.json.

## Gate locks

- SP-079: **BLOCKED** by the active SP-104 dependency.
- SP-078 owner verdict: **not run; count remains 0**.
- Final 0-100 speed generation: **not run**.
- Shoulder: **not started**.
- Engine/simulation/scale work: **not run**.
- Missing official leaderboard rows are missing exposure, never slow.
- No PowerPro label is used as a physical teacher or target.

## Reproduction

- Materializer: python3 scripts/sp104_pre_sp079_remediation.py --offline
- Independent QA: python3 scripts/qa_sp104_pre_sp079_remediation.py
- All official CSV bytes are frozen under data/manual/sp104_mlb_raw/.

The stop boundary is SP-104. Even if a later gate marks this package ready,
the next action must be explicitly authorized and separately audited.

# Browser independent review — SP-104 pre-SP079 remediation

Date: 2026-08-25
Reviewed branch: `codex/speed-sp104-pre-sp079-high-value-remediation-20260823`
Reviewed commit: `693902e8b7ab089033028e7475ae5d911498d246`

## Decision

**ACCEPT_SP104_READY_FOR_SP079_WITH_BOUNDED_EXTERNAL_GAP**

SP-104's canonical evidence-remediation work is accepted. The parent SP-104 artifact's terminal label `PARTIAL_BLOCKED` is not accepted as the effective readiness state, because the only cited remaining blocker is P1-A current NPB+ fastest-H2F value acquisition. The SP-104 specification explicitly states that if current official values cannot be reproducibly obtained, the task must close that lane as `BLOCKED_EXTERNAL_CURRENT_VALUE_SURFACE` **and proceed**. `PARTIAL/BLOCKED` is reserved for a material feasible **P0** gap that remains untested.

All P0 items were actually executed and independently checked:

- P0-A historical physical canonicalization: raw 459 → canonical 458, with H2F 74, 30m/50m 232→231, T90 12; protocol/date/range/provenance retained and 30m/50m→T90 prohibited.
- P0-B official MLB running collection: full exact crosswalk MLBAM population 55; 36 frozen official receipts; 129 running-split rows and 209 Sprint/exposure/H2F rows; missing qualification is not slow/zero.
- P0-C seven transfer candidates benchmarked with player-clustered holdout/common-support guards. TF-056/060/062 are bounded context; TF-057/058/059/061 have no common support; no production transfer was promoted.
- P0-D all 100 physical states and six component ablations recomputed. Peak-only changes from 78 to 50 while peak+acceleration changes from 21 to 49; this is a measured coverage diagnostic, not an optimization target.
- Independent QA: 44/44 checks pass, 6/6 fail-before fixtures detected, deterministic offline rematerialization is byte-identical.
- owner verdict count remains 0; no final 0–100 speed rating, SP-079 execution, shoulder, engine/simulation/final-scale work occurred.

## NPB+ current H2F ruling

The official NPB+ public/product surface confirms that player information includes both Sprint Speed and `最速タイム（一塁到達）`, but it does not expose a reproducible public per-player value table in the checked web surface. The SP-104 receipt correctly returns zero current rows and leaves the old local `npb_plus_measurement.hp_to_1b_sec` quarantined.

This is **bounded external missingness**, not a material feasible P0 gap. It must remain visible in SP-079 as missing current acceleration evidence and must never be imputed from the contaminated historical local field. It does not justify another open-ended acquisition wave before final practical appraisal.

External verification on 2026-08-25 also confirms the official web page describes the per-player H2F field as an app/player-information feature, while the public webpage itself is a product description rather than an exported player-value table.

## Transfer-method ruling

No production transfer method was selected. This is acceptable and preferred over forcing a model: SP-104 was a model-selection experiment, and `NO_COMMON_SUPPORT`/bounded context are valid terminal findings. SP-079 may use only the bounded evidence states and validated route/context receipts; it must not silently turn a non-selected transfer candidate into a point estimate.

## Top-speed dominance ruling

The post-SP104 state remains materially top-speed-heavy (50 peak-only players), but the critical feasible non-peak evidence was tested and incorporated/bounded. Remaining peak-only status is therefore not by itself a reason to keep researching until a target percentage is reached. SP-079 must preserve this diagnostic and run final-value ablations so that peak speed cannot silently dominate because of implementation weighting.

## Git LFS push note

The repository `.gitattributes` marks only two Community raw JSONL paths for LFS. SP-104's canonical outputs are different paths. Therefore the reported bypass of the unavailable local `git-lfs` pre-push hook does not, by itself, indicate that SP-104 artifacts skipped required LFS object upload. Preserve this as an environment note; do not generalize hook bypass as normal practice if a future change touches an LFS-tracked path.

## Effective transition

SP-104 is accepted as:

`DONE_VALIDATED_READY_FOR_SP079_WITH_BOUNDED_EXTERNAL_NPBPLUS_H2F`

The generated `outputs/derived/sp104_pre_sp079_readiness.json` and audit remain historical outputs of the worker run; this browser review and the accompanying readiness override supersede only their terminal gate interpretation, not their measured data.

SP-079 is **not run by this review**. A separately authorized SP-079 execution must first reconcile the task registry to this review, consume SP-103/SP-104 canonical artifacts, rerun all-100 consistency/decision-use checks on the actual final-appraisal logic, and preserve owner-verdict/shoulder locks until their explicit stages.

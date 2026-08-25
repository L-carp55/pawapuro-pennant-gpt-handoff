# SP-079 Browser Independent Review — synthesis/calibration semantics

Date: 2026-08-26
Reviewed commit: `be3588b26e3ce0818880f80c4a0350764886bb6f`
Verdict: **MECHANICAL_QA_ACCEPTED / FINAL_SYNTHESIS_NOT_ACCEPTED**
Effective SP-079 state: **PARTIAL — BLOCKED_BY_SP105_SYNTHESIS_CALIBRATION_REPAIR**

## What is accepted

The SP-079 execution is mechanically strong and remains useful evidence:

- exactly 100 player rows were produced;
- 800 actual remove-and-recompute ablation cells exist;
- deterministic rerun was byte-identical;
- owner verdict ledger remained empty (`owner_verdict_count=0`);
- no SP-080/SP-081/shoulder work was run;
- PowerPro is post-hoc only;
- direct The Show numeric copy is prohibited;
- legacy contaminated NPB+ H2F remains excluded;
- 30m/50m is not converted to T90;
- missing source rows are not treated as slow;
- technique remains separate from pure physical speed.

These outputs are preserved as a baseline/control and must not be deleted.

## Why `DONE_VALIDATED` is not accepted

### 1. The declared evidence hierarchy is contradicted by the point estimator

`sp079_appraisal_policy.json` declares:

- Tier A = current direct/near-direct physical evidence;
- Tier B = historical/protocol-bounded physical ranges and same-system MLB evidence;
- lower tiers are contextual.

But the actual synthesis uses `EQUAL_AVAILABLE_CONSTRUCT_FAMILIES`: every available physical family gets exactly `1/n` weight and the final point is the arithmetic mean of family midpoint percentiles.

That makes a wide, old, protocol-bounded H2F/30m/50m family as influential on the point as current NPB+ peak evidence whenever both are present. This is not the same as “do not discard imperfect evidence.” It silently promotes imperfect evidence to equal point influence.

Concrete example from the frozen output:

- 中川圭太 current NPB+ peak percentile ≈ 0.7576;
- historical/bounded H2F family point ≈ 0.1268 with a very wide interval;
- the two are averaged 50:50 to ≈ 0.4422, yielding provisional rating 44 with interval 0–98 and `UNRESOLVED`.

The explicit conflict state is useful, but an unresolved conflict does not validate the equal-weight midpoint as the best point estimate.

### 2. Different percentile reference populations are averaged without a validated common calibration

The physical families are converted independently to percentiles using different source populations:

- current NPB+ peak percentile uses the frozen current100 cohort;
- historical H2F/30m/50m/T90 percentiles are computed within their historical/protocol-specific record distributions;
- MLB Statcast percentiles use MLB bridge/source distributions.

The final point estimator then treats those 0–1 percentiles as directly commensurate and averages them. No held-out cross-family calibration step establishes that “0.70” in one source/protocol/population is equivalent to “0.70” in another.

This reintroduces a scale-mixing risk at the latent-percentile layer. SP-099 previously showed why mixing unlike scales before calibration is unsafe; SP-105 must resolve the analogous issue here without using PowerPro labels.

### 3. Context lanes are reported as used without proving decision-effective influence on the point/rank

The Show, analog/ordinal/transition, statistical proxies, and scouting/community/video are not part of the physical point estimator. In the current synthesis they mainly add interval width or alter confidence/evidence-state labels.

The final ablation summary reports any changed field as “changed player,” so:

- `analog_ordinal_transition: 77 changed players`
- `statistical_proxies: 80 changed players`

may represent interval/confidence/evidence-state changes rather than point/rank changes.

The Show and scouting/community/video have 0 changed players in the current ablation. Therefore the current artifacts do **not** prove that all previously requested comparison/context routes materially influenced final appraisal where they were eligible. They may legitimately have zero effect, but that must be measured and stated as such, not implied by a generic “used” statement.

### 4. The independent QA validates implementation consistency, not the semantic validity of the equal-weight policy

The QA explicitly treats the equal-family rule itself as a passing condition (`component_weight_rule`, `source:equal_family_weight`). It does not compare the equal-weight estimator against alternative leakage-safe, PowerPro-free synthesis policies on held-out physical evidence.

Thus 50/50 PASS proves the code follows its frozen policy; it does not prove that the policy is a defensible final estimator.

### 5. `UNRESOLVED` rows still receive ordinary-looking point ratings

An `UNRESOLVED` direct conflict can still receive an arithmetic mean point and a 0–100 provisional rating. The wide interval and VERY_LOW confidence are good safeguards, but the artifact must distinguish:

- a defensible point estimate;
- a display midpoint used only because the interface requires a number.

SP-105 must make this distinction explicit and prevent unresolved midpoint values from being mistaken for validated estimates.

## Required repair scope

Do **not** collect another broad evidence wave. Freeze SP-100 through SP-104 inputs and repair only synthesis/calibration semantics.

SP-105 must:

1. benchmark equal-family averaging as a baseline rather than assume it is correct;
2. establish a PowerPro-free common latent calibration or a conservative tier-aware alternative;
3. use player-clustered/leave-player-out validation on physical-rich anchors and preserve common-support failure;
4. ensure current Tier-A evidence is not silently equated with old/wide Tier-B evidence;
5. explicitly distinguish source/protocol/time uncertainty from point influence;
6. measure actual point/rank/interval/confidence effects separately for every ablated family;
7. separately measure The Show/analog/ordinal/context decision use; if a lane has zero point/rank effect, persist that as a measured result instead of claiming generic use;
8. retain all 100 rows and allow `NO_DEFENSIBLE_POINT` / display-midpoint-only states when necessary;
9. keep owner verdict count 0 and keep SP-080/SP-081/shoulder blocked.

## LFS note

The repository `.gitattributes` marks only the two Community raw JSONL files as LFS-managed. The SP-079 changed outputs are not those paths, so the reported `--no-verify` push does not by itself indicate missing SP-079 LFS objects. Future changes to an LFS-managed path must not bypass the LFS upload hook.

## Transition

SP-079 remains a valuable frozen baseline, but its registry `DONE_VALIDATED` state is superseded by this browser review until SP-105 independently validates a repaired synthesis policy and rematerializes the 100-player output.

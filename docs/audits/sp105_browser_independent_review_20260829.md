# SP-105 Browser Independent Review — 2026-08-29

## Verdict

**SP-105 is accepted as a valid measured negative finding for cross-family numeric point calibration, but SP-079 is NOT yet reaccepted as the completed baseball-relevant speed appraisal.**

Accepted state:
- SP-105 semantic repair succeeded in removing the invalid SP-079 equal-family percentile averaging.
- The selected conservative policy is internally honest: current NPB+ Tier-A peak is the only point anchor; lower-tier physical families retain native reference populations and act only as interval/conflict constraints.
- Cross-family calibration was actually attempted under player-clustered leave-player-out/common-support guards and was not promoted when production criteria failed.
- Rich ablation now separates point/rating/rank/interval/confidence/conflict/evidence-state effects.
- PowerPro remains posthoc-only; owner verdict count remains 0; SP-080/SP-081/shoulder remain untouched.

However, the repaired 100-player output is not yet sufficient to claim that the project has produced a fully integrated baseball-relevant running-speed point/rank:

1. The report explicitly states that the **current NPB+ peak percentile is the sole Tier-A point anchor for all 100 rows**. Lower-tier H2F/T90/90ft/30m/50m evidence has point weight 0.
2. The rich ablation confirms that removing acceleration/end-to-end, historical physical, MLB running, The Show, analog/ordinal/transition, statistical proxies, and scouting/community/video/usage changes **zero player points, zero display ratings, and zero ranks** under the selected policy.
3. The Show is applicable for only 4 current100 rows and is `PRESENT_NO_DECISION_EFFECT` for all 4. This is an honest bounded zero-effect finding, not a defect by itself.
4. Analog/ordinal/transition is applicable for 96 rows but changes intervals only, never point/rank. Statistical proxies do the same for 98 rows and contextual scouting/community/video/usage for 18 rows.
5. Therefore the numeric ranking produced by SP-105 is, by construction, the current100 NPB+ peak-speed ranking with additional uncertainty/conflict annotations. That is a defensible **peak-anchor appraisal**, but it is not yet the intended multi-construct baseball-running-speed point/rank.

## Why this is not another data-collection request

The browser review does **not** request another broad evidence wave and does not reject the SP-105 negative calibration finding. The remaining question is narrower:

> Can already validated same-family and signed ordinal/range evidence alter the final ordering without pretending that heterogeneous percentile scales are numerically commensurate?

SP-105 showed that broad numeric cross-family calibration is not identifiable. That does not imply that all non-peak evidence must have zero rank effect. Ordinal information does not require direct numeric commensurability.

The repository already contains:
- same-family relative ordering from H2F/T90/30m/50m/native physical records;
- SP-101 signed pairwise ordinal evidence;
- SP-101 validated analog/common-support context;
- transition/trajectory constraints, including bounded The Show roles;
- explicit evidence tiers, confidence, provenance and missingness guards.

These can be tested as **rank/interval constraints** against a peak-anchor baseline without averaging their native percentiles.

## Required bounded follow-up inside SP-105

Do not create a new evidence-search task. Perform one final SP-105 wave limited to an ordinal/range-constrained ranking benchmark.

Compare at minimum:

A. `D_BASELINE`: the accepted SP-105 Tier-A peak-anchor ranking.

B. `ORDINAL_CONSTRAINED`: begin from the D baseline and allow only validated nonnumeric constraints to alter rank/range/conflict:
- signed same-family physical comparisons;
- high-confidence SP-101 pairwise ordinal edges;
- validated cross-player analog constraints only when they imply a bounded ordering/range under common support, never a point transfer;
- validated The Show trajectory/transition/ordinal context only where direction semantics are explicit;
- lower-tier evidence must not be converted into a common numeric percentile.

The candidate must use a transparent constrained-ranking method (for example a minimum-violation partial-order / monotone rank projection or another auditably equivalent method), not an arbitrary weighted score.

### Selection requirements

Use physical/ordinal evidence only; no PowerPro selection target.

The ordinal candidate may replace D only if it shows material, reproducible incremental value under independent tests such as:
- leave-player/leave-edge-out recovery of held-out signed physical comparisons;
- lower weighted constraint-violation rate than the peak-only baseline;
- stability under source-family removal;
- no degradation that is explained only by low-confidence/context-only edges;
- explicit common-support and time/provenance guards.

If the ordinal candidate cannot outperform or cannot be identified without arbitrary weights, close it as a measured negative finding and **then reaccept SP-079 only with explicit semantics that the available data support a peak-anchored point plus multi-source uncertainty/constraints, not a fully integrated multi-construct point.**

## Point semantics requirement

The existing SP-105 field `DEFENSIBLE_POINT_ESTIMATE` is acceptable only if the report explicitly defines the point as:

`DEFENSIBLE_TIER_A_PEAK_ANCHOR_POINT_NOT_FULL_CONSTRUCT_POINT`

unless the final ordinal/range benchmark justifies a broader rank/point interpretation.

A current NPB+ peak measurement is a defensible observed physical point. It is not, by itself, proof that peak speed equals the full baseball-relevant running-speed latent trait.

## Governance

Until this bounded SP-105 wave is independently reviewed:
- SP-079 remains `PARTIAL`.
- SP-105 remains gate-blocking.
- owner verdict count remains 0.
- SP-080 and SP-081 remain `NOT_STARTED`.
- SP-082/shoulder remains `BLOCKED_DEPENDENCY`.
- no broad new collection.
- no PowerPro teacher/weight/selection use.

## Evidence supporting this verdict

- SP-105 final report: all 100 rows use the sole Tier-A NPB+ peak point anchor; lower families have zero point weight.
- SP-105 rich ablation: every non-peak/context component changes 0 point/rating/rank rows; effects are interval/conflict/evidence-state only.
- SP-105 context decision-use: The Show 4/4 present-no-effect; analog/ordinal 96 interval-only; proxies 98 interval-only; scouting/community/video/usage 18 interval-only.
- SP-105 calibration receipts: mappings are fail-closed under production criteria; no broad cross-family mapping was promoted.
- Independent QA: 84/84 and 13/13 fail-before fixtures pass; this validates implementation consistency but does not change the semantic interpretation above.

# SP-100 production-wiring decision packet

Date: 2026-08-16
Status: **PARTIAL — owner value judgment required**
Production behavior: **unchanged**

## Decision

Technical recommendation: **N_PRIMARY_S_CONTEXT_OR_FALLBACK**. This is not owner approval and has not been wired into production.

Required owner approval (one line):

> Approve N_PRIMARY_S_CONTEXT_OR_FALLBACK for 2026-only SP-100 production wiring; keep S as context/fallback and do not blend S and N by an unidentifiable weight.

## Evidence boundary

- **N**: 2026 NPB+ <code>top_speed_kmh</code> only, a direct maximum-statistic measure for 100 players. It is not assumed error-free; generic reliability is **NOT_IDENTIFIABLE**.
- <code>hp_to_1b_sec</code> is <code>MISATTRIBUTED_SOURCE</code> and remains fail-closed.
- Exposure is contextual only: it cannot shrink N because it is correlated with the measured trait and N is opportunity-sensitive as a maximum statistic.
- **S** is a 2025 statistical proxy (93 players), not a 2026 direct measure. H2F remains a separate low-confidence/context lane.
- The NPB Enterprise article is a selected, separate lane; it adds only a 周東-specific repeated-elite context flag and cannot create generic reliability.
- Absolute 0–100 calibration remains provisional pending SP-071/engine bridge.

## Architecture comparison

| Architecture | Annual-time alignment | Construct/directness | Coverage | Unidentifiable weight | Technical result |
|---|---|---|---|---|---|
| N_PRIMARY_S_CONTEXT_OR_FALLBACK | BEST FOR 2026: N is a 2026 snapshot. S is 2025 context or a fallback only when an appraisal-year direct N observation is unavailable; 2026 N is never copied backward. | BEST: N is direct tracked top/max speed. S is a statistical proxy, retained for sanity/context rather than treated as the same measurement. | N covers 100/100; S covers 93/100. The observed 2026 N lane therefore supplies the complete current target population. | NO: S and N are not arithmetically blended. No generic N reliability or F blend weight is invented. | **RECOMMEND** |
| S_PRIMARY_N_CONTEXT | WEAKER FOR 2026: primary S is a 2025 proxy while N is temporally aligned 2026 direct evidence. | WEAKER: it gives primary status to a proxy and relegates direct top/max-speed evidence to context. | WEAKER: S covers 93/100 and therefore cannot be primary for seven current-target players without another fallback. | NO new S/N blend weight, but the choice of ignoring N as primary is a value judgment rather than a reliability estimate. | Admissible but not recommended |
| NO_SINGLE_POINT_OWNER_REVIEW_ONLY | CONSERVATIVE: avoids a production physical point despite aligned 2026 N. | PRESERVES direct evidence only as owner-review material; no operational primary estimate is produced. | Owner review can show all 100 N observations, but there is no production physical point for any player. | NO: no blend is produced. | Admissible but not recommended |

All three preserve the provenance, circularity, and no-future-outcome guards stated in the JSON packet. The detailed fields also record each sampling/max-statistic caveat.

## Why the recommendation is asymmetric

N is current-season direct physical/rank evidence and covers 100/100. S is an earlier statistical proxy and covers 93/100. Treating the two symmetrically would require a generic N reliability/blend weight that the repository explicitly cannot identify. The recommended architecture therefore does **not** blend them. It keeps S labelled as sanity/context or an appraisal-year fallback without copying 2026 N backward.

## Owner-ruling search result

No explicit post-v2-provenance-repair owner ruling ratifying one of these architectures was found. The pre-v2 owner policy (commit <code>24a4388</code>) authorizes the constraints and opens SP-100; the v2 provenance repair (commit <code>3f42d9a</code>) explicitly retains <code>winner=NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE</code>. The subsequent owner-blocker/community commits do not record an SP-100 architecture verdict. A recommendation is therefore not treated as approval.

## Source receipt

The machine-readable packet records SHA-256 hashes for every input, including the v2 N artifact, candidate comparison, provenance guard, SP-046 policy, NPB Enterprise lane, and current registry.

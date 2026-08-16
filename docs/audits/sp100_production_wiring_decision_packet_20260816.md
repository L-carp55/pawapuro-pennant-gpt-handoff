# SP-100 production-wiring decision packet

Date: 2026-08-16
Status: **DONE_VALIDATED — explicit owner ruling implemented**
Production behavior: **changed only for the explicit 2026 current physical/rank layer**

## Owner decision

> SP-100は N_PRIMARY_S_CONTEXT_OR_FALLBACK で承認します。Sはcontext/fallbackに留め、SとNを識別不能な重みでblendしません。

The ruling was recorded after the v2 provenance repair and is implemented exactly as **N_PRIMARY_S_CONTEXT_OR_FALLBACK**. It is an architecture ruling only; it writes no player-level owner verdict and does not run SP-079.

## Implemented behavior

- NPB+ <code>top_speed_kmh</code> is N-primary for the frozen current 100-player 2026 physical/rank layer.
- S remains separately labelled 2025 statistical context/fallback only. No numeric N reliability or N/S blend weight exists, and no arithmetic N/S blend is calculated.
- The generic direct-measurement route no longer accepts <code>top_speed_kmh</code>, so a PowerPro-scale regression or 2026-to-2025 backward copy cannot be used by that legacy path.
- <code>hp_to_1b_sec</code> remains fail-closed; generic N reliability remains <code>NOT_IDENTIFIABLE</code>; exposure is context only and does not change N z.
- The display point is explicitly provisional pending SP-071 / engine bridge. This packet does not produce a final practical 100-player appraisal.

## Architecture comparison

| Architecture | Owner decision | Time/construct result | Unidentifiable blend weight | Production state |
|---|---|---|---|---|
| N_PRIMARY_S_CONTEXT_OR_FALLBACK | **APPROVED** | 2026 N is the aligned current physical/rank evidence; 2025 S is context/fallback only and N is never copied backward. | No: N and S are never arithmetically blended and no generic N reliability coefficient is created. | Implemented as the explicit 2026 current physical/rank layer only; display remains provisional and no final practical rating is created. |
| S_PRIMARY_N_CONTEXT | Not selected | Weaker: primary S is 2025 while N is current 2026 evidence. | No blend, but not owner-selected. | Not implemented. |
| NO_SINGLE_POINT_OWNER_REVIEW_ONLY | Not selected | Conservative but leaves aligned 2026 evidence non-operational. | No blend. | Not implemented. |

## Validation receipt

- Current N-primary rows: **100/100**.
- Stable player keys: **100/100**, including the repaired 名原 <code>BM_PLAYER:20230057</code> crosswalk.
- Production-layer content checks: **910 pass / 0 fail**.
- Source hashes are in the JSON packet.

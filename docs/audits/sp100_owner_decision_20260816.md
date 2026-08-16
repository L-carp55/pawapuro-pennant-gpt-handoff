# SP-100 owner decision — 2026-08-16

## Authoritative owner instruction

Source: owner instruction in this Codex task, 2026-08-16 JST.

> SP-100は N_PRIMARY_S_CONTEXT_OR_FALLBACK で承認します。Sはcontext/fallbackに留め、SとNを識別不能な重みでblendしません。

## Normalized implementation decision

- Approved architecture: `N_PRIMARY_S_CONTEXT_OR_FALLBACK`.
- Scope: the explicit current-2026 SP-100 physical/rank layer only.
- N: use the verified NPB+ `top_speed_kmh` lane as primary current physical/rank evidence where present.
- S: retain as labelled statistical context or fallback only; do not calculate any arithmetic N/S blend or an N reliability weight.
- This instruction is an explicit owner verdict after the SP-100 v2 provenance repair. It is not inferred from a technical recommendation or from a missing repository record.

## Retained boundaries

- `hp_to_1b_sec` remains `MISATTRIBUTED_SOURCE` and fail-closed.
- Generic NPB+ measurement reliability remains `NOT_IDENTIFIABLE`; exposure is context only and does not shrink N.
- N is never copied backward to a 2025 (or earlier) annual card.
- The display point remains provisional pending SP-071 / engine bridge; this does not run SP-079 or create a final practical rating.
- This is an architecture decision, not a player-level owner verdict. The SP-078 ledger remains at zero real owner verdicts.

# SP-079 preimplementation contract — 2026-08-18

Status: **CONTRACT ONLY / SP-079 NOT EXECUTED**

## Decision

Owner verdicts must be given a precise downstream meaning before they are captured. SP-079 will therefore require exactly one active append-only owner verdict for every current-100 queue row, but it will not use PowerPro as a physical teacher or treat a directional verdict as a replacement rating.

## Entry gate

- speed_owner_review_integrity_lock_20260817.locked=false
- task-registry QA PASS
- construct-traceability QA PASS
- SP-078 ledger remains bound to the active 100-row construct queue
- exactly 100 active owner verdicts exist: one per queue_row_key
- every verdict has nonempty timestamp/source/reviewer and append-only history

## Verdict semantics

- **POWERPRO_PLAUSIBLE:** Do not anchor to PowerPro. Preserve the independent evidence estimate; record only that no forced directional correction is required.
- **POWERPRO_TOO_LOW:** The independent practical range must not silently resolve below the current PowerPro comparison without an explicit conflict flag; preferred_rating_optional, when supplied, is a review constraint rather than physical evidence.
- **POWERPRO_TOO_HIGH_OR_STALE:** The independent practical range must not silently resolve above the current PowerPro comparison without an explicit conflict flag; preferred_rating_optional, when supplied, is a review constraint rather than physical evidence.
- **UNRESOLVED:** Do not force a point direction. Preserve a wider range, lower confidence, and the exact conflict/missing-target reason.

## Output contract

- queue_row_key and stable identity
- owner_verdict event receipt
- physical latent/rank estimate
- practical provisional display point
- range_low and range_high
- confidence and explicit confidence drivers
- per-lane evidence values or bounded missingness
- historical carryover reason and weight when used
- technique-separation receipt
- PowerPro comparison result without teacher leakage
- source provenance and source hashes
- absolute_scale_status

## Absolute-scale boundary

SP-079 may create a relative/practical estimate and a provisional display point after owner review. It may **not** claim that the absolute 0–100 scale is final. Every row must carry `PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE` until the ability-to-engine-response bridge and league-distribution calibration are complete.

## Minimum QA

- 100/100 population and unique queue keys
- 100/100 active owner-verdict coverage with exact queue hash binding
- deterministic byte-identical rerun
- no PowerPro current value in physical-estimation feature set
- no top-speed-only finalization
- all required construct lanes remain visible per player
- missingness is explicit and never negative evidence
- historical evidence used only with player-specific current-year exception reason
- directional verdict canaries: 山口航輝, 塩見泰隆, 村林一輝, 坂倉将吾
- conflict canaries remain unresolved unless amended by owner: 細川成也, 小園海斗, 古賀優大
- カリステ/矢野雅哉/京田陽太 regression guards against peak-speed overreach
- SP-078 ledger unchanged by SP-079 computation
- shoulder remains blocked

## Critical-path consequence

- SP-078 owner decisions are the immediate blocker.
- SP-079 follows after 100/100 active verdict coverage.
- SP-080 still waits for both SP-071 and SP-079.
- SP-081 and shoulder remain blocked.

Machine contract: `outputs/derived/sp079_preimplementation_contract_20260818.json`


# SP-100 owner-approved production wiring

Date: 2026-08-16

## Implemented rule

- Owner-approved architecture: **N_PRIMARY_S_CONTEXT_OR_FALLBACK**.
- Current 2026 N primary physical/rank rows: **100/100**.
- Every row has a stable player key; 名原 uses the repaired `BM_PLAYER:20230057` crosswalk rather than a fabricated ProEYE id.
- S remains a separately labelled 2025 statistical context/fallback record. It is never arithmetically blended with N.
- The output is a current physical layer, not SP-079 and not a final practical rating.

## Guards retained

- NPB+ input is `top_speed_kmh` only; `hp_to_1b_sec` remains fail-closed.
- Generic NPB+ reliability remains `NOT_IDENTIFIABLE`; no reliability weight is created.
- Exposure remains contextual only and does not shrink N.
- N is generated only for explicit `physicalEvidenceSeason=2026`; it is never copied onto a 2025 card.
- The 0–100 display point is explicitly provisional pending SP-071 / engine bridge.

## Validation

- 910 content checks passed; 0 failed.
- Every N z/top-speed value is independently reproduced against the frozen 100-player raw SP-100 artifact.
- No owner player verdict is written by this generator.

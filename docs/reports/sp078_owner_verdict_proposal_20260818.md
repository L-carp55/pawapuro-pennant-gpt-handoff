# SP-078 owner-verdict proposal — 2026-08-18

Status: **PROPOSED / NOT OWNER-APPROVED / NOT CAPTURE-READY**

## Why this is the next step

SP-077/078 infrastructure and construct QA are complete, the integrity lock is open, and SP-079 is blocked only by real owner-verdict input. However, a generic instruction to continue is not equivalent to 100 explicit player-level owner decisions. This packet therefore freezes the exact proposed decisions and their SP-079 meaning without mutating the append-only ledger.

## Three-batch checkpoint

- **Batch A — bulk compatible/no target: 88** (83 POWERPRO_PLAUSIBLE + 5 no-current-target UNRESOLVED)
- **Batch B — directional review: 9**
- **Batch C — material conflict: 3**

### Batch B — directional review

- **西川 龍馬（PP 72）** — `POWERPRO_TOO_HIGH_OR_STALE` / CURRENT_PEAK_PLUS_CONTEXT_CONCERN / LOW. Current peak is below average with adequate exposure, and S/game context is neutral-to-negative. There is no current acceleration/end-to-end measurement, so this remains only a low-confidence PP72-high concern.
- **西野 真弘（PP 76）** — `POWERPRO_TOO_HIGH_OR_STALE` / CONTEXT_SUPPORTED_HIGH_CONCERN / LOW. Peak speed is about average and underexposed; S is slightly negative and game context is more clearly negative. This is a low-confidence PP76-high concern, not a peak-only strong verdict.
- **福永 裕基（PP 64）** — `POWERPRO_TOO_LOW` / CURRENT_PEAK_PLUS_WEAK_STATISTICAL_SUPPORT / LOW. Current peak is rank 13 with adequate exposure. S points the same way but has only 57 PA and moderate reliability; game context is near neutral. Preserve as a low-confidence low-rating concern rather than discard it or call it strong.
- **郡司 裕也（PP 61）** — `POWERPRO_TOO_LOW` / CURRENT_PEAK_PLUS_CONTEXT_SUPPORTED_CONCERN / LOW. Current peak is rank 20 with adequate exposure, while S and game context are not negative. This supports a low-confidence concern that PP61 is low, but missing acceleration/end-to-end evidence prevents a strong verdict.
- **山口 航輝（PP 52）** — `POWERPRO_TOO_LOW` / LOW_CONFIDENCE_TECHNIQUE_SEPARATED_CONCERN / LOW. Peak speed and the Community physical statement support real foot speed, while the same statement separately identifies poor stealing sense. Negative S/game context is retained but downweighted as technique/opportunity-contaminated. Unknown-date 50m is retained at low weight, not treated as decisive.
- **坂倉 将吾（PP 68）** — `POWERPRO_TOO_HIGH_OR_STALE` / MULTI_SOURCE_DIRECTIONAL_CONCERN / MEDIUM. Current peak, unknown-date 50m, S and game context consistently lean low. The 50m record is one nonpeak measurement family and must not be double-counted as two independent physical dimensions; the conclusion remains a supported concern, not STRONG_MULTI_PHYSICAL.
- **塩見 泰隆（PP 83）** — `POWERPRO_TOO_HIGH_OR_STALE` / STRONG_MULTI_LANE / MEDIUM. Peak speed remains respectable but underexposed. H2F is poor, S has zero reliability/PA, and several current 2026 physical observations describe injury/age-related decline. This is the clearest high/stale case across distinct evidence lanes.
- **村林 一輝（PP 69）** — `POWERPRO_TOO_LOW` / CURRENT_PEAK_PLUS_CONTEXT_SUPPORTED_CONCERN / MEDIUM. Current peak is extreme and adequately exposed, with S and game context in the same direction. Older nonpeak context is retained but weak and does not erase the current signal. PP69 warrants a medium-confidence low concern, not a final numerical rating.
- **今宮 健太（PP 66）** — `POWERPRO_TOO_HIGH_OR_STALE` / PEAK_AND_CONTEXT_SUPPORTED_HIGH_CONCERN / MEDIUM. Current peak is low and underexposed, while both S and game context also lean low. Absence of nonpeak direct evidence prevents a strong verdict, but multiple retained signals support a medium-confidence PP66-high concern.

### Batch C — keep unresolved because evidence conflicts

- **細川 成也（PP 60）** — `UNRESOLVED` / CURRENT_PEAK_VS_NONPEAK_AND_CONTEXT_CONFLICT / MEDIUM. Current peak is high, but 50m context, S and game signals all lean lower. The previous TOO_LOW screen was driven mainly by peak speed; full-construct evidence is genuinely conflicting.
- **小園 海斗（PP 79）** — `UNRESOLVED` / CURRENT_VS_OLD_H2F_AND_CONTEXT_CONFLICT / MEDIUM. Current peak is near average and 2016 H2F is slow, but current S/game context is positive. The old H2F is one measurement family, not two independent physical dimensions; the prior STRONG_TOO_HIGH screen is withdrawn.
- **古賀 優大（PP 46）** — `UNRESOLVED` / CURRENT_PEAK_VS_CONTEXT_CONFLICT / MEDIUM. Current peak speed is above average, but S and all mixed-game components are strongly low. With no H2F/T30/T90/30m/50m lane, neither side may replace the whole construct. The prior TOO_LOW screen was peak-led.

### No-current-PowerPro target (Batch A / objective UNRESOLVED)

- **宗 佑磨（PP —）** — `UNRESOLVED` / NO_CURRENT_POWERPRO_TARGET / HIGH. No current PowerPro comparison target exists. Physical evidence remains available for later SP-079 appraisal, but no PowerPro high/low verdict can be made.
- **ソト（PP —）** — `UNRESOLVED` / NO_CURRENT_POWERPRO_TARGET / HIGH. No current PowerPro comparison target exists. Physical evidence remains available for later SP-079 appraisal, but no PowerPro high/low verdict can be made.
- **名原 典彦（PP —）** — `UNRESOLVED` / NO_CURRENT_POWERPRO_TARGET / HIGH. No current PowerPro comparison target exists. Physical evidence remains available for later SP-079 appraisal, but no PowerPro high/low verdict can be made.
- **牧 秀悟（PP —）** — `UNRESOLVED` / NO_CURRENT_POWERPRO_TARGET / HIGH. No current PowerPro comparison target exists. Physical evidence remains available for later SP-079 appraisal, but no PowerPro high/low verdict can be made.
- **丸 佳浩（PP —）** — `UNRESOLVED` / NO_CURRENT_POWERPRO_TARGET / HIGH. No current PowerPro comparison target exists. Physical evidence remains available for later SP-079 appraisal, but no PowerPro high/low verdict can be made.

## Meaning of approval

- `POWERPRO_PLAUSIBLE` means compatible with retained evidence; it does **not** validate the exact PowerPro number.
- `POWERPRO_TOO_LOW` / `POWERPRO_TOO_HIGH_OR_STALE` are directional constraints; they do **not** select a replacement number by themselves.
- `UNRESOLVED` preserves conflict or missing comparison target; SP-079 must widen the range and must not force a direction.
- PowerPro remains comparison context only and is never copied into the physical estimate.

## What happens after explicit owner approval

1. Materialize real SP-078 events with the actual owner-approval timestamp, source, and reviewer.
2. Run append-only capture against the exact active queue hash.
3. Require 100 active verdicts and rerun registry/construct/lock QA.
4. Implement SP-079 under the separately committed preimplementation contract.

Machine proposal: `outputs/derived/sp078_owner_verdict_proposal_20260818.json`


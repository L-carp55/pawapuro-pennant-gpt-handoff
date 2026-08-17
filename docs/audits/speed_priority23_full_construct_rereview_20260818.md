# Speed Priority-23 full-construct re-review — 2026-08-18

Status: **CORRECTED NON-VERDICT RECOMMENDATIONS**

This audit supersedes `docs/audits/speed_priority23_owner_review_recommendations_20260817.md`.

The earlier recommendation pass stated the correct definition but still used current NPB+ top-speed rank too strongly when deciding whether a PowerPro rating was too high or too low. That was a review-method defect. It did not alter the queue, QA, integrity lock, SP-077/SP-078 state, or any owner verdict because SP-078 remains empty.

## Canonical construct

Speed means physical running ability from the first running step to about 90 ft:

1. **Initial acceleration** — T10/T30 or bounded H2F evidence where available.
2. **Peak speed** — current NPB+ top speed, with exposure context.
3. **Speed maintenance / complete first-to-90ft performance** — T90, H2F, and bounded 30m/50m physical-profile evidence. No linear 30m/50m-to-T90 conversion is allowed.

The evidence lanes are not interchangeable:

- NPB+ top speed observes peak speed only.
- H2F may combine contact-to-run transition, acceleration, and maintenance; it is not a pure acceleration measure.
- T10/T30/T90 can describe the shape of the run, but historical records do not automatically carry to 2026.
- 30m/50m evidence is physical context, not a validated arithmetic substitute for T90.
- Statistical S and mixed game proxies are context/fallback only and may contain baserunning technique or game opportunity.
- Community physical observations are bounded review context; technique rows remain separate.
- Missing acceleration or maintenance evidence is explicit missingness, not evidence of slowness.
- PowerPro is comparison context only and never the physical teacher.

## Corrected decision gate

A strong `POWERPRO_TOO_HIGH_OR_STALE` or `POWERPRO_TOO_LOW` recommendation now requires one of:

- at least two meaningfully independent physical dimensions with compatible temporal relevance; or
- one current/recent end-to-end physical lane plus independent corroboration.

Current top speed alone cannot support a strong verdict. When peak speed conflicts with S/game proxies but acceleration and maintenance are missing, the correct recommendation is `UNRESOLVED`.

`POWERPRO_PLAUSIBLE` means the available full-construct evidence does not materially contradict the rating; it does not mean the exact number has been physically calibrated.

## Corrected Priority-23 recommendations

| # | Player | PP | Physical lanes available | Corrected recommendation | Why |
|---:|---|---:|---|---|---|
| 1 | 中川 圭太 | 74 | current peak + bounded H2F/history | `POWERPRO_PLAUSIBLE` | Peak speed is above average, while H2F is only slightly below average and context is near average. The dimensions do not support an extreme rating but do not materially contradict 74. |
| 10 | カリステ | 82 | current peak + 2017 T10/T30/T90 | `UNRESOLVED` | Current peak has only 7 observed runs and may be understated; the strong complete-run evidence is from 2017 and cannot be carried automatically to 2026. The earlier “too high/stale” call relied too much on current peak rank. |
| 12 | 大島 洋平 | 74 | current peak + 2007 H2F | `UNRESOLVED` | Current peak is exposure-limited, and the H2F evidence is extremely old. High S/game values and Community comments mainly concern practical baserunning, not a current physical 90ft measurement. |
| 26 | 郡司 裕也 | 61 | current peak only; S/game context | `UNRESOLVED` | Rank-20 peak speed creates a legitimate “PP may be low” concern, but there is no acceleration, H2F, T90, 30m or 50m lane. The earlier `POWERPRO_TOO_LOW` call was top-speed-dominant. |
| 28 | ソト | — | current peak only | `UNRESOLVED` | No current PowerPro comparison value exists, and the full construct is largely missing. |
| 29 | ポランコ | 63 | current peak + 2021 T10/T30/T90 | `POWERPRO_PLAUSIBLE` | Current peak is low-middle and exposure-limited; the direct complete-run history does not create a material contradiction to a low-middle rating, although current confidence remains limited by age of the record. |
| 32 | 安田 尚憲 | 46 | current peak + 50m physical context | `POWERPRO_PLAUSIBLE` | Very low current peak and slow 50m context point in the same direction; S/game context also agrees. This is not a top-speed-only conclusion. |
| 34 | 山口 航輝 | 52 | current peak + 50m context + separated Community physical/technique evidence | `POWERPRO_TOO_LOW` | Peak speed is above the low-rating range, 50m context is not slow, and the repaired Community row explicitly separates “足は速い” from “盗塁のセンスはない.” Negative S/game context therefore cannot be read as pure physical slowness. Confidence: medium, because current direct acceleration/T90 remains missing. |
| 36 | 藤原 恭大 | 85 | current peak + H2F + 50m | `POWERPRO_PLAUSIBLE` | High current peak, good H2F and strong short-distance physical evidence converge across the construct; S/game context corroborates rather than determines the result. |
| 39 | 古賀 悠斗 | 47 | current peak only; S/game/Community context | `UNRESOLVED` | Current peak and proxies lean low, but acceleration and maintenance are missing. Community suggests possible improvement. A low rating is plausible, but the full physical construct is not sufficiently observed. |
| 44 | ファビアン | 61 | exposure-limited current peak only | `UNRESOLVED` | S and acceleration/maintenance evidence are missing; game proxy cannot replace the physical lanes. |
| 45 | モンテロ | 49 | current peak + 2024 T10/T30/T90/Sprint Speed | `POWERPRO_PLAUSIBLE` | The recent complete-run record supplies the dimensions missing from top speed. It explains why a respectable observed maximum need not imply a high first-to-90ft rating. |
| 46 | 名原 典彦 | — | current peak + 50m physical context | `UNRESOLVED` | The physical evidence points toward a high-speed profile, but no current PowerPro value exists to evaluate. |
| 52 | 野間 峻祥 | 88 | 8-run current peak only; S/game context | `UNRESOLVED` | The earlier “too high/stale” call was not justified. Current peak is exposure-limited, while S/game context is strongly positive; without acceleration or complete-run physical evidence, neither side resolves the construct. |
| 53 | サンタナ | 47 | current peak + 2020 T10/T30/T90/Sprint Speed | `POWERPRO_PLAUSIBLE` | Current peak is below average and the direct complete-run history is compatible with a low rating. The historical date limits confidence but the dimensions do not conflict. |
| 57 | 古賀 優大 | 46 | current peak only; S/game context | `UNRESOLVED` | Above-average peak speed conflicts with low S/game proxies, but those proxies may contain technique and opportunity. With acceleration and maintenance missing, the earlier `POWERPRO_TOO_LOW` call was top-speed-dominant. |
| 58 | 塩見 泰隆 | 83 | current peak + poor H2F + 30m history + current decline observations | `POWERPRO_TOO_HIGH_OR_STALE` | A respectable maximum speed does not rescue the whole construct: H2F is very poor, the positive S value has reliability 0 / PA 0, and several current physical observations describe injury/age-related loss. This remains the strongest high/stale case. |
| 59 | 岩田 幸宏 | 96 | elite current peak; S/game/Community context | `UNRESOLVED` | The direction “very fast” is strongly supported, but 96 is an almost ceiling-level full-construct claim. There is no direct acceleration, H2F, T90, 30m or 50m lane, so the exact elite whole-construct rating cannot yet be validated. |
| 78 | 山川 穂高 | 47 | current peak + 50m context | `POWERPRO_PLAUSIBLE` | Low current peak and slow 50m context agree; S/game context also points low. |
| 79 | 柳田 悠岐 | 67 | current peak + very old H2F/50m + current Community context | `UNRESOLVED` | Current peak is moderately high, but end-to-end physical evidence is old and S/game context is lower. The current Community row is positive but not a standardized measurement. The full current construct remains mixed. |
| 94 | 佐藤 輝明 | 68 | current peak + 30m/50m physical context | `POWERPRO_PLAUSIBLE` | Above-average current peak and short-distance physical records support a moderately above-average rating; S/game context is near neutral. |
| 98 | 木浪 聖也 | 59 | exposure-limited current peak only; S/game context | `UNRESOLVED` | Low observed peak conflicts with near-average game context, and acceleration/maintenance are missing. Neither lane can substitute for the whole construct. |
| 100 | 森下 翔太 | 60 | current peak only; S/game context | `UNRESOLVED` | Current peak is low with adequate exposure, but S/game context is near average and direct acceleration/maintenance evidence is missing. A low-middle rating is possible but not fully validated. |

## Corrected counts

- `POWERPRO_PLAUSIBLE`: 8 — 中川圭太 / ポランコ / 安田尚憲 / 藤原恭大 / モンテロ / サンタナ / 山川穂高 / 佐藤輝明
- `POWERPRO_TOO_LOW`: 1 — 山口航輝
- `POWERPRO_TOO_HIGH_OR_STALE`: 1 — 塩見泰隆
- `UNRESOLVED`: 13 — カリステ / 大島洋平 / 郡司裕也 / ソト / 古賀悠斗 / ファビアン / 名原典彦 / 野間峻祥 / 古賀優大 / 岩田幸宏 / 柳田悠岐 / 木浪聖也 / 森下翔太

## Material changes from the superseded pass

The following strong recommendations are withdrawn because they were driven mainly by current peak speed while another required physical dimension was missing:

- カリステ: `POWERPRO_TOO_HIGH_OR_STALE` → `UNRESOLVED`
- 郡司裕也: `POWERPRO_TOO_LOW` → `UNRESOLVED`
- 野間峻祥: `POWERPRO_TOO_HIGH_OR_STALE` → `UNRESOLVED`
- 古賀優大: `POWERPRO_TOO_LOW` → `UNRESOLVED`

Additional plausible calls moved to `UNRESOLVED` because the full current construct was not observed: 大島洋平 / 古賀悠斗 / ファビアン / 岩田幸宏 / 柳田悠岐 / 木浪聖也 / 森下翔太.

The two strongest directional findings that survive the corrected method are:

1. **山口航輝: PP 52 is probably too low**, because physical-speed evidence and technique evidence are explicitly separated.
2. **塩見泰隆: PP 83 is probably too high/stale**, because current decline evidence and poor first-to-base performance contradict an elite complete construct despite a decent maximum speed.

## Governance

- This file contains recommendations only.
- No SP-078 event was created or modified.
- `owner_verdict_count` remains 0.
- SP-079 remains blocked until the owner explicitly records decisions.
- Shoulder remains out of scope.

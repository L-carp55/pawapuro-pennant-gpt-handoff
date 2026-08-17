# Speed Priority-23 owner-review recommendations — 2026-08-17

Status: **NON-VERDICT RECOMMENDATIONS ONLY**

This document is an AI-side re-review of the repaired construct-complete Priority-23 packet. It is **not** an SP-078 owner verdict ledger and does not authorize SP-079. No owner decision is recorded here.

## Frozen basis

- Active branch at review start: `review/opus-speed-pre-owner-review-wave-20260816`
- Post-unlock committed state verified by canonical registry / construct-traceability / SP-078-integrity CI.
- Active construct queue: `outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json`
- Active queue SHA-256: `ff822cb44874a1021723e0c962ead7a16871d185586fd894ed29824456ca464d`
- Community semantic propagation: `848/848 PASS; 0 FAIL` from `outputs/derived/qa_sp077_community_semantic_propagation_20260817.json`.
- Structural construct QA: `3255/3255 PASS; 0 FAIL` from `outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json`.
- Owner verdict ledger remains the only canonical decision store: `outputs/derived/sp078_owner_verdict_ledger_20260816.json`.

## Review rule

The reviewed construct is **physical running ability from the first running step to about 90 ft**, including initial acceleration, top speed and speed maintenance. The lanes are not averaged as if they measured the same thing.

Rules preserved:

- 2026 NPB+ top speed is the current N-primary physical lane, but not the whole construct.
- S and mixed game proxies are context/fallback only and can contain technique/game-context effects.
- Pure speed is separated from stealing/baserunning technique.
- Historical 30m/50m/T90/H2F evidence is not automatically carried forward to 2026.
- `hp_to_1b_sec` attributed to NPB+ remains fail-closed; independent H2F evidence remains valid in its own lane.
- Missing acceleration/short-distance evidence is missingness, not evidence that the player is slow.
- PowerPro is review/stale context only and is never used as a physical teacher.

`Recommendation confidence` below is confidence in the **review recommendation**, not a new appraisal confidence scale.

## Recommendations

| # | Player | PP current | Recommendation | Confidence | Main basis |
|---:|---|---:|---|---|---|
| 1 | 中川 圭太 | 74 | `POWERPRO_PLAUSIBLE` | medium-high | Current N 32.6 km/h / rank 23 with adequate exposure; H2F is only slightly below average; S/game are near modestly above average. Repaired Community contains both fast-running and later decline/injury context, so 74 is defensible without treating either comment as a standalone teacher. |
| 10 | カリステ | 82 | `POWERPRO_TOO_HIGH_OR_STALE` | low-medium | Current N is 31.3 / rank 59 and only 7 full-effort runs, so the maximum may be understated, but there is no same-time S or current acceleration corroboration for an 82-level rating. The 2017 high-confidence T10/T30/T90/Sprint-Speed evidence is useful history but cannot be automatically carried to 2026. |
| 12 | 大島 洋平 | 74 | `POWERPRO_PLAUSIBLE` | medium | Current N rank 42 is exposure-limited (13 runs); H2F is near average, while S and mixed game context are clearly positive. Community evidence is technique/continued-baserunning context rather than pure-speed proof, so it supports caution rather than an automatic upgrade. |
| 26 | 郡司 裕也 | 61 | `POWERPRO_TOO_LOW` | medium | Current direct N is 32.7 / rank 20 with adequate exposure. S and game proxies are roughly average rather than negative, and there is no direct physical evidence supporting a lower-third physical rating. Missing acceleration evidence must not be treated as negative evidence. |
| 28 | ソト | — | `UNRESOLVED` | high | There is no current PowerPro value to judge. Current N 30.1 / rank 91 is useful for later practical appraisal, but cannot produce a PowerPro plausibility verdict when the comparison target is absent. |
| 29 | ポランコ | 63 | `POWERPRO_PLAUSIBLE` | medium | Current N 31.1 / rank 65 is exposure-limited; 2021 high-confidence T10/T30/T90/Sprint-Speed history and near-average game context do not create a strong current contradiction to a low-middle PP 63. |
| 32 | 安田 尚憲 | 46 | `POWERPRO_PLAUSIBLE` | high | Current N 29.6 / rank 93, 50m 6.7 s context, S -0.71 and game -0.81 all point to a low-speed profile. PP 46 is directionally and roughly ordinally consistent. |
| 34 | 山口 航輝 | 52 | `POWERPRO_TOO_LOW` | high | Current N 31.9 / rank 38 is based on only 17 runs and may be understated; 50m 6.3 s is additional physical context. Crucially, repaired Community semantics explicitly say he is physically fast while separately saying盗塁のセンスはない. Low S/game proxies therefore cannot be used to collapse technique into pure foot speed. |
| 36 | 藤原 恭大 | 85 | `POWERPRO_PLAUSIBLE` | high | Current N 33.0 / rank 13 with adequate exposure, H2F 3.9 s, 50m 5.7 s context, S +0.76 and game +0.87 all agree on a high-speed construct. |
| 39 | 古賀 悠斗 | 47 | `POWERPRO_PLAUSIBLE` | medium-high | Current N 30.6 / rank 75 with adequate exposure, S -0.61 and game -0.81 all support a low rating. Community notes possible improvement but do not establish an elite/current physical level and therefore do not overturn the broader evidence. |
| 44 | ファビアン | 61 | `POWERPRO_PLAUSIBLE` | low | Current N 31.4 / rank 55 has only 15 runs and may be understated; S/current acceleration are missing and game proxy is low. PP 61 is not strongly contradicted, but evidence coverage is thin. |
| 45 | モンテロ | 49 | `POWERPRO_PLAUSIBLE` | medium | Current N 31.9 / rank 38 is exposure-limited, but 2024 high-confidence direct records include T90 4.2 s and Sprint Speed 26.2 ft/s, while game proxy is -0.81. Full-construct evidence therefore does not justify upgrading him solely from the current maximum top-speed lane. |
| 46 | 名原 典彦 | — | `UNRESOLVED` | high | No current PowerPro value exists. Current N 33.7 / rank 4 plus 50m 5.9/6.2 s physical evidence strongly matter for later practical appraisal, but there is no PP target for an owner comparison verdict. |
| 52 | 野間 峻祥 | 88 | `POWERPRO_TOO_HIGH_OR_STALE` | low-medium | PP 88 is an extreme top-end rating, while current N is 31.7 / rank 42. The maximum is based on only 8 runs and may be understated, and S/game context is strongly positive, so the direction is not certain; nevertheless there is no current acceleration/short-distance physical evidence corroborating a ~96th-percentile PP rating. |
| 53 | サンタナ | 47 | `POWERPRO_PLAUSIBLE` | medium-high | Current N 30.8 / rank 70 with adequate exposure, 2020 high-confidence T90 4.13 s / Sprint Speed 26.9 ft/s history, and game -0.40 all support a below-average physical profile. |
| 57 | 古賀 優大 | 46 | `POWERPRO_TOO_LOW` | medium | Current N 32.1 / rank 33 has adequate exposure. S -0.88 and game -1.11 are mixed/statistical context rather than direct physical acceleration evidence; under the pure-speed/technique separation rule, those proxies cannot by themselves justify a bottom-12% PP value when the current direct physical lane is above average. |
| 58 | 塩見 泰隆 | 83 | `POWERPRO_TOO_HIGH_OR_STALE` | high | Current N 32.3 / rank 31 is based on only 8 runs, but H2F is very poor (4.205 s, z -1.82), S has reliability 0 / PA 0, and repaired 2026 Community physical rows repeatedly describe a material loss of running speed due to injury/age. The full construct therefore supports a substantial stale/high concern despite a still-respectable maximum speed. |
| 59 | 岩田 幸宏 | 96 | `POWERPRO_PLAUSIBLE` | high | Current N 33.6 / rank 5 with 50 full-effort runs, S +2.04, game +2.44 and Community “足めっちゃ早い” all converge on elite speed. |
| 78 | 山川 穂高 | 47 | `POWERPRO_PLAUSIBLE` | high | Current N 29.4 / rank 95, S -1.03, game -1.09 and 50m 6.2 s low-confidence context all point in the same slow direction. |
| 79 | 柳田 悠岐 | 67 | `POWERPRO_PLAUSIBLE` | medium-high | Current N 32.1 / rank 33 is based on 20 runs and may be understated; H2F is roughly average, S/game are lower, while repaired current Community says his running speed remains noticeable. PP 67 is a moderate-above-average compromise rather than an elite carryover. |
| 94 | 佐藤 輝明 | 68 | `POWERPRO_PLAUSIBLE` | high | Current N 32.1 / rank 33 with adequate exposure, 30m 4.0 s / 50m 6.0 s physical context, and near-average S/game are consistent with a moderately above-average PP value. |
| 98 | 木浪 聖也 | 59 | `POWERPRO_PLAUSIBLE` | medium | Current N 30.0 / rank 92 is based on only 18 runs and may be understated; S -0.21 and game ~0 are less negative. PP 59 is low-middle and does not require treating the observed maximum as the whole construct. |
| 100 | 森下 翔太 | 60 | `POWERPRO_PLAUSIBLE` | medium-high | Current N 30.5 / rank 80 has adequate exposure, while S/game are near average. PP 60 is a low-middle value that reasonably reflects the mixed construct rather than overreacting to either lane. |

## Recommendation counts

- `POWERPRO_PLAUSIBLE`: 15
- `POWERPRO_TOO_HIGH_OR_STALE`: 3 — カリステ / 野間峻祥 / 塩見泰隆
- `POWERPRO_TOO_LOW`: 3 — 郡司裕也 / 山口航輝 / 古賀優大
- `UNRESOLVED`: 2 — ソト / 名原典彦 (no current PP comparison value)

## Highest-information owner decisions

If the owner wants to review disagreements before routine plausible cases, the six most informative decisions are:

1. **山口航輝 — recommend `POWERPRO_TOO_LOW`**: repaired Community semantics directly separate pure speed from poor stealing sense.
2. **塩見泰隆 — recommend `POWERPRO_TOO_HIGH_OR_STALE`**: current Community decline + very poor H2F conflict with PP 83.
3. **郡司裕也 — recommend `POWERPRO_TOO_LOW`**: current direct top speed is rank 20 with adequate exposure, with no negative direct physical lane.
4. **古賀優大 — recommend `POWERPRO_TOO_LOW`**: direct current physical rank 33 conflicts with bottom-tier PP 46; negative S/game are not allowed to substitute for pure-speed evidence.
5. **野間峻祥 — recommend `POWERPRO_TOO_HIGH_OR_STALE`**, but low-medium confidence because N exposure is only 8 and S/game context is strongly positive.
6. **カリステ — recommend `POWERPRO_TOO_HIGH_OR_STALE`**, but low-medium confidence because current N exposure is only 7 and the historical physical anchor is strong but from 2017.

## What must happen next

- These recommendations must **not** be copied into SP-078 automatically.
- The owner should explicitly accept, reject or amend each verdict.
- Only explicit owner decisions are written through the append-only SP-078 capture path.
- SP-079 remains blocked until actual owner verdict events exist.
- Shoulder remains out of scope until the Speed Gate and owner approval are complete.

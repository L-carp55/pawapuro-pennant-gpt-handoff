# SP-079 Final Practical Speed Reappraisal — 100 Players

As of 2026-08-25, this is a provisional, baseball-relevant running-speed appraisal for the frozen current NPB+ 100-player denominator. The current NPB+ top speed is retained as the peak lane; acceleration/H2F, direct or standardized 90ft, historical short-distance, official MLB, ordinal/analog, and bounded context lanes remain semantically separate.

## Decision status

- Scale status: `PROVISIONAL_PENDING_SP071_SP072`
- Owner verdict input: none; `owner_verdict_count=0`
- PowerPro: posthoc QA only, never a feature or teacher
- The Show: full SP101 universe used as external context/trajectory/ordinal evidence; no direct numeric copy
- 30m/50m: native short-distance context only; no T90 conversion
- Current NPB+ H2F: unavailable; missingness is not treated as slow
- SP104 transfer: no production transfer; TF056/060/062 bounded context, TF057/058/059/061 no common support
- SP-080, SP-081, and shoulder work: not executed

## Frozen input and synthesis rules

Input manifest SHA-256 for the policy is `f901959fee00c74c0c46d9f3be04a2ff79fcbd30bbb42b5b9efe58fa697fc4e3`. Physical construct families receive equal weight only among families with usable evidence. A peak-only result is therefore a transparent missingness state, not a hard-coded peak-dominant target. Every interval is rule-bounded and the 0–100 display is a monotone percentile mapping, not an engine-final calibration.

## Population summary

Evidence states: `{"UNRESOLVED":22,"SUPPORTED_ANALOG_OR_ORDINAL_RANGE":49,"DIRECT_MULTI_CONSTRUCT":26,"NO_COMMON_SUPPORT_WIDE_INTERVAL":3}`

Confidence: `{"VERY_LOW":22,"LOW":52,"MEDIUM":26}`

## Component ablation

The following cells were actual reruns of the full synthesis function with one component removed; they are not relabel-only comparisons.

| Removed component | Cells | Changed players | Changed fraction |
|---|---:|---:|---:|
| peak_speed | 100 | 100 | 1 |
| acceleration_h2f_t90_90ft | 100 | 68 | 0.68 |
| historical_physical | 100 | 94 | 0.94 |
| mlb_statcast_running_bridge | 100 | 17 | 0.17 |
| the_show_context | 100 | 0 | 0 |
| analog_ordinal_transition | 100 | 77 | 0.77 |
| statistical_proxies | 100 | 80 | 0.8 |
| scouting_community_video_usage_context | 100 | 0 | 0 |

## First twelve rows by rank

| Rank | Player | Rating | Interval | Evidence state | Confidence |
|---:|---|---:|---:|---|---|
| 52 | 中川 圭太 | 44 | 0–98 | UNRESOLVED | VERY_LOW |
| 37 | 太田 椋 | 53 | 32–74 | SUPPORTED_ANALOG_OR_ORDINAL_RANGE | LOW |
| 31 | 宗 佑磨 | 61 | 40–82 | SUPPORTED_ANALOG_OR_ORDINAL_RANGE | LOW |
| 24 | 来田 涼斗 | 66 | 22–100 | DIRECT_MULTI_CONSTRUCT | MEDIUM |
| 68 | 森 友哉 | 29 | 0–56 | DIRECT_MULTI_CONSTRUCT | MEDIUM |
| 72 | 紅林 弘太郎 | 26 | 5–47 | SUPPORTED_ANALOG_OR_ORDINAL_RANGE | LOW |
| 72 | 若月 健矢 | 26 | 5–47 | SUPPORTED_ANALOG_OR_ORDINAL_RANGE | LOW |
| 66 | 西川 龍馬 | 32 | 11–53 | SUPPORTED_ANALOG_OR_ORDINAL_RANGE | LOW |
| 45 | 西野 真弘 | 48 | 27–69 | SUPPORTED_ANALOG_OR_ORDINAL_RANGE | LOW |
| 28 | カリステ | 63 | 0–100 | UNRESOLVED | VERY_LOW |
| 62 | 土田 龍空 | 36 | 15–57 | SUPPORTED_ANALOG_OR_ORDINAL_RANGE | LOW |
| 49 | 大島 洋平 | 47 | 0–100 | DIRECT_MULTI_CONSTRUCT | MEDIUM |

## QA handoff

Generator preflight status: `PASS_PRE_INDEPENDENT_QA`. The independent red-team audit is recorded separately in `docs/audits/sp079_final_practical_reappraisal_independent_audit.md`. The frozen manifest records source hashes, identity denominator, no-owner-write state, and all prohibited-input guards.

# 2026 NPB 走力 Final Video Tie-break

- 対象: 17/17（canonical queue限定）
- 基準: `2026-08-11`
- 目的: 映像からの方向的な最終tie-break。動画から数値走力・疑似計測・ゲーム能力値は生成しない。

## 集計

| 項目 | 件数 |
| --- | ---: |
| videos discovered | 32 |
| accepted video sources | 1 |
| rejected video sources | 31 |
| usable current full-effort sources | 0 |
| unique candidate plays | 32 |
| unique games/events | 32 |
| unique source origins | 32 |
| players with >=2 usable plays | 0 |
| players with >=3 usable plays | 0 |
| VIDEO_INCONCLUSIVE | 17 |
| remaining unresolved queue | 17 |

Accepted sourceの1件は現在の通常速度プレーとして本文を確認できたが、打席からの移行・打球結果・塁間の経路とターンを分離できない **context-only** であり、ordinal判定に使えるplay数には含めていない。

## 分類の変化

| pre-video classification | count |
| --- | ---: |
| INSUFFICIENT_EVIDENCE_REMAINS | 13 |
| METRIC_CONSTRUCT_CONFLICT_REMAINS | 2 |
| MIXED_EVIDENCE_REMAINS | 2 |

| post-video classification | count |
| --- | ---: |
| VIDEO_INCONCLUSIVE | 17 |

| evidence strength | count |
| --- | ---: |
| NONE | 12 |
| WEAK | 5 |

## Player-by-player rationale

| player | before | video | strength | usable | rationale |
| --- | --- | --- | --- | --- | --- |
| 西野 真弘 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | Two official 2025 candidates were found, but one is explicitly bunt/baserunning-technique context and one is a home-run highlight. Neither was visually reviewed because browser attachment failed; no ordinal direction is supportable. |
| カリステ | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | Two distinct 2025 candidates were recovered with exact IDs, but neither could be visually inspected for normal speed/effort and the first is additionally contaminated by baserunning decisions and turns. |
| 土田 龍空 | MIXED_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | WEAK | 0 | The reviewed current fan video is a batting-result clip; effort and a direct straight segment cannot be separated from transition and baserunning context. |
| 大島 洋平 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | A 2026 broadcast training feature and a 2025 official-club game feature were discovered, but neither could be visually reviewed for normal speed, effort, or a usable straight segment. |
| 友杉 篤輝 | METRIC_CONSTRUCT_CONFLICT_REMAINS | VIDEO_INCONCLUSIVE | WEAK | 0 | No reviewed 2025–2026 candidate supplied a pure full-effort current straight run. The examined official candidate is a 2023 edited defensive feature and is excluded. |
| 外崎 修汰 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | The discovered current candidates are an interview and a home-run highlight; an undated title explicitly about baserunning technique was also excluded. No physical conclusion is drawn. |
| 矢野 雅哉 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | A 2025 fielding clip was excluded by construct, a 2026 third-party all-at-bats montage could not be inspected, and the remaining broadcast candidate is outside the current window. |
| 野間 峻祥 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | Two distinct 2026 candidates were body-reviewed, but neither supplied an identifiable, normal-speed, full-effort physical-running observation. |
| 中村 悠平 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | The current candidate is an injury-stoppage clip rather than a running observation; no position-based inference was made. |
| 林 琢真 | METRIC_CONSTRUCT_CONFLICT_REMAINS | VIDEO_INCONCLUSIVE | WEAK | 0 | The reviewed 2025 official walk-off clip is current but batter-to-first/replay context only, not a pure isolated running observation. |
| 梶原 昂希 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | The reviewed current candidate is a still-image montage, not a playable running sequence. |
| 梅野 隆太郎 | MIXED_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | WEAK | 0 | The reviewed current double-hit recording contains a batted-ball start, turn/route contamination, and no isolated comparable straight segment. |
| 筒香 嘉智 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | Two 2025 current-window clips were identified, but both are home-run/batter-to-first contexts and were not visually inspectable. |
| 秋山 翔吾 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | A 2025 double clip and a 2026 return-to-action practice-game candidate were recovered, but visual review failed before attachment. The second is Tier C and cannot verify identity, effort, normal speed, or direction from metadata alone. |
| ポランコ | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | Three distinct 2025–2026 candidates were found. One has explicit third-base-coach physical assistance, one is a home-run transition context, and one highlight could not be visually reviewed. |
| サンタナ | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | NONE | 0 | Three current-window clips were identified but are all home-run/batter-to-first contexts; the 2026-04-11 title explicitly describes non-full-effort running. None is a qualifying pure-running observation. |
| 奈良間 大己 | INSUFFICIENT_EVIDENCE_REMAINS | VIDEO_INCONCLUSIVE | WEAK | 0 | One current official normal-speed play is retained only as transition-contaminated context; it cannot determine a pure physical ordinal direction. |

## Source limitations and acquisition failures

- In-app Browserのwebview attach timeoutにより、複数の公開候補は本文再生まで到達できなかった。本文を視認できなかった候補は採用せず、`VISUAL_INSPECTION_UNAVAILABLE` または同等理由として保存した。
- 一部の公開YouTube候補は元ストリームを直接取得し、順序を変えないsource-frame contact sheetで本文・編集・対象identity・走行contextを確認した。この確認は距離、秒数、FPS、擬似T90、30m、50mの抽出には使っていない。
- 通常の打席から一塁、塁間のターン、盗塁・走塁判断、守備範囲、モンタージュ、停止・故障場面は、純粋な身体的走力の証拠にしなかった。

## Rejected evidence reasons

| category | candidate records with category |
| --- | ---: |
| visual or normal-speed unavailable | 24 |
| transition or baserunning contamination | 16 |
| edited / replay / montage | 8 |
| no running / no identifiable target run | 4 |

## Negative findings

- 17人全員について、複数の独立したcurrent full-effort physical runを満たす映像集合は得られなかった。
- したがって、既存のSNS mixed/metric conflict/insufficient分類を映像だけで上書きしない。
- 残る17人は `outputs/derived/speed_2026_post_video_unresolved_queue.csv` に明示した。

## QA

- Status: **PASS** (21/21)
- exact video-ID duplicate records: 0
- PowerPro residual: 未使用
- final chat only knowledge: 0（全candidateと判定根拠はledger / manual research / resultsに保存）
- reproducible build: `node scripts/build_speed_2026_final_video_tiebreak.mjs`

Independent QA: **PASS** (21/21) — `data/manual/speed_2026_video_tiebreak_independent_qa_20260811.json`

- 独立QAは4本のYouTube URLのライブ再取得を取得側エラーで再確認できなかった。この制約は削除確認ではなく、保存済みID/URLと本文review記録に基づくPASSである。

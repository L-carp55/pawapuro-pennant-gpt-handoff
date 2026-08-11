# 2026 NPB 走力 Final Reappraisal — Blind Freeze

## Stage 1 conclusion

100/100人を、PowerProを参照しないまま最終一点・不確実性band・confidenceへ再査定した。現行NPB+は同一100人内のordinal signalに限定し、30m/50m又はNPB+をT90へ変換していない。

- 対象: 100/100
- 旧provisionalとの比較: 1人変更、98人unchanged、baseline未作成 1人
- 変更: モンテロのみ。2024公式direct T90を優先し、現行NPB+と異metric平均をせずdirect-T90 scaleで 52 とした。
- 名原典彦: player_idをnullのまま保持し、2026 NPB+同一scaleの隣接ordinal値から 84 を明示決定した。

## Blind boundary

- Stage 1で開いた入力はmanifestの8ファイルのみ。PowerPro能力値、residual、discrepancy register、position residual、その他ゲーム差分は開いていない。
- SNSはconfidence / uncertaintyのみ、videoは0 usable playのnegative findingのみで、点数を動かしていない。
- historical direct / standardized evidenceは計測年代を保持し、固定age decayや自動carry-forwardをしていない。

## Critical provenance

- 筒香嘉智: 2022 Baseball Savant Running Splits T90=4.20秒は **CONFIRMED_PRIMARY** の歴史証拠として保持。旧anchor bankの名前aliasによる棄却を黙って上書きせず、2026値への自動転用もしない。
- モンテロ: 2024 direct T90=4.20秒はcurrent windowの唯一の確認済み直接計測であり、最優先とした。
- 17人のvideo tie-breakは全員 **VIDEO_INCONCLUSIVE**・usable current full-effort play=0。これはcurrent NPB+正しさの証拠ではなく、追加方向情報なしである。

## 100-row decision audit

| player | sprint km/h | point | band | confidence | primary | secondary | SNS | video | decision | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 中川 圭太 |  | 75 | 68-82 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 太田 椋 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.7km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 宗 佑磨 |  | 68 | 61-75 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.9km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 来田 涼斗 |  | 73 | 66-80 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 森 友哉 |  | 62 | 55-69 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.2km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 紅林 弘太郎 |  | 57 | 50-64 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.7km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 若月 健矢 |  | 57 | 50-64 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.7km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 西川 龍馬 |  | 61 | 54-68 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.1km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 西野 真弘 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP | 2026 NPB+ 31.6km/hの同一100人内順位を現行中心として明示affirm。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| カリステ |  | 63 | 56-70 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_DIRECT_T90_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_HISTORICAL_DIRECT_CONTEXT | 2026 NPB+ 31.3km/hの同一100人内順位を現行中心として明示affirm。公式直接T90（2017年）は歴史文脈のみで、現行点を自動補正しない。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 土田 龍空 |  | 62 | 52-72 | LOW | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | VIDEO_INCONCLUSIVE | UNCHANGED_AFTER_FULL_REAPPRAISAL_MIXED_BAND_WIDENED | 2026 NPB+ 31.2km/hの同一100人内順位を現行中心として明示affirm。異metricまたはSNS混在は点を平均せず、レンジ拡大で表現。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 大島 洋平 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP | 2026 NPB+ 31.7km/hの同一100人内順位を現行中心として明示affirm。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 岡林 勇希 |  | 74 | 67-81 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 木下 拓哉 |  | 46 | 41-51 | MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | AFFIRMED_CURRENT_ORDINAL_WITH_SNS_SUPPORT | 2026 NPB+ 29.4km/hの同一100人内順位を現行中心として明示affirm。独立SNSは現行bandの支持にのみ用い、点数加算はしない。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 村松 開人 |  | 82 | 75-89 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 板山 祐太郎 |  | 69 | 62-76 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.0km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 田中 幹也 |  | 83 | 76-90 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 石川 昂弥 |  | 57 | 50-64 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 福永 裕基 |  | 78 | 71-85 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.0km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 細川 成也 |  | 75 | 68-82 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.7km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 高橋 周平 |  | 47 | 40-54 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 29.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 奈良間 大己 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_STANDARDIZED_SHORT_DISTANCE_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP | 2026 NPB+ 31.7km/hの同一100人内順位を現行中心として明示affirm。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 水野 達稀 |  | 82 | 75-89 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 清宮 幸太郎 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.7km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 田宮 裕涼 |  | 73 | 66-80 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 郡司 裕也 |  | 75 | 68-82 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.7km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 野村 佑希 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.7km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| ソト |  | 52 | 45-59 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.1km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| ポランコ |  | 61 | 54-68 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_DIRECT_T90_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_HISTORICAL_DIRECT_CONTEXT | 2026 NPB+ 31.1km/hの同一100人内順位を現行中心として明示affirm。公式直接T90（2021年）は歴史文脈のみで、現行点を自動補正しない。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 佐藤 都志也 |  | 63 | 56-70 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.3km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 友杉 篤輝 |  | 75 | 65-85 | LOW | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_STANDARDIZED_SHORT_DISTANCE_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | UNCHANGED_AFTER_FULL_REAPPRAISAL_CONFLICT_BAND_WIDENED | 2026 NPB+ 32.7km/hの同一100人内順位を現行中心として明示affirm。異metricまたはSNS混在は点を平均せず、レンジ拡大で表現。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 安田 尚憲 |  | 48 | 41-55 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 29.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 小川 龍成 |  | 82 | 75-89 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 山口 航輝 |  | 68 | 61-75 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.9km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 岡 大海 |  | 75 | 70-80 | MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | AFFIRMED_CURRENT_ORDINAL_WITH_SNS_SUPPORT | 2026 NPB+ 32.6km/hの同一100人内順位を現行中心として明示affirm。独立SNSは現行bandの支持にのみ用い、点数加算はしない。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 藤原 恭大 |  | 78 | 71-85 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.0km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 藤岡 裕大 |  | 58 | 48-68 | LOW | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL_TEMPORAL_CONSTRAINT | 2026 NPB+ 30.8km/hの同一100人内順位を現行中心として明示affirm。SNSの時間変化は旧証拠のcarry-forwardを抑える制約としてのみ使用。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 髙部 瑛斗 |  | 83 | 76-90 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 古賀 悠斗 |  | 57 | 50-64 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 外崎 修汰 |  | 72 | 65-79 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP | 2026 NPB+ 32.3km/hの同一100人内順位を現行中心として明示affirm。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 源田 壮亮 |  | 77 | 70-84 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.9km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 滝澤 夏央 |  | 78 | 71-85 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.0km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 石井 一成 |  | 75 | 68-82 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| ファビアン |  | 64 | 57-71 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| モンテロ |  | 52 | 46-58 | MEDIUM | RECENT_DIRECT_T90_2024 | CURRENT_NPB_PLUS_ORDINAL_DIRECTION_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | REANCHORED_TO_RECENT_DIRECT_T90 | 2024年の公式直接90ft計測を現行窓の最優先証拠として採用。2026 NPB+は同一100人内の方向情報に限定し、異指標を平均しない。 |
| 名原 典彦 |  | 84 | 74-94 | LOW | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | SAME_SCALE_ORDINAL_FALLBACK_FOR_MISSING_BLIND_BASELINE | 2026 NPB+ 33.7km/hの同一scale隣接値から点を補間。source player_idはnullのまま保持し、過去50mは現行へ自動転用しない。 |
| 坂倉 将吾 |  | 57 | 50-64 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 小園 海斗 |  | 65 | 58-72 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 矢野 雅哉 |  | 57 | 50-64 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP | 2026 NPB+ 30.7km/hの同一100人内順位を現行中心として明示affirm。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 秋山 翔吾 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_DIRECT_T90_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_HISTORICAL_DIRECT_CONTEXT | 2026 NPB+ 31.6km/hの同一100人内順位を現行中心として明示affirm。公式直接T90（2021年）は歴史文脈のみで、現行点を自動補正しない。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 菊池 涼介 |  | 67 | 60-74 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.8km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 野間 峻祥 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP | 2026 NPB+ 31.7km/hの同一100人内順位を現行中心として明示affirm。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| サンタナ |  | 58 | 51-65 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_DIRECT_T90_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_HISTORICAL_DIRECT_CONTEXT | 2026 NPB+ 30.8km/hの同一100人内順位を現行中心として明示affirm。公式直接T90（2020年）は歴史文脈のみで、現行点を自動補正しない。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 並木 秀尊 |  | 85 | 80-90 | MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | AFFIRMED_CURRENT_ORDINAL_WITH_SNS_SUPPORT | 2026 NPB+ 33.8km/hの同一100人内順位を現行中心として明示affirm。独立SNSは現行bandの支持にのみ用い、点数加算はしない。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 中村 悠平 |  | 55 | 48-62 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP | 2026 NPB+ 30.4km/hの同一100人内順位を現行中心として明示affirm。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 丸山 和郁 |  | 73 | 66-80 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 古賀 優大 |  | 70 | 63-77 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.1km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 塩見 泰隆 |  | 72 | 67-77 | MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | AFFIRMED_CURRENT_ORDINAL_WITH_SNS_SUPPORT | 2026 NPB+ 32.3km/hの同一100人内順位を現行中心として明示affirm。独立SNSは現行bandの支持にのみ用い、点数加算はしない。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 岩田 幸宏 |  | 83 | 76-90 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 長岡 秀樹 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 太田 光 |  | 56 | 49-63 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 村林 一輝 |  | 92 | 85-99 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 34.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 浅村 栄斗 |  | 56 | 49-63 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 渡邊 佳明 |  | 54 | 47-61 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.3km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 鈴木 大地 |  | 42 | 37-47 | MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | AFFIRMED_CURRENT_ORDINAL_WITH_SNS_SUPPORT | 2026 NPB+ 29.0km/hの同一100人内順位を現行中心として明示affirm。独立SNSは現行bandの支持にのみ用い、点数加算はしない。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 京田 陽太 |  | 61 | 54-68 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.1km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 佐野 恵太 |  | 57 | 50-64 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 宮﨑 敏郎 |  | 54 | 47-61 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.3km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 山本 祐大 |  | 60 | 53-67 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.0km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 度会 隆輝 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.7km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 林 琢真 |  | 69 | 59-79 | LOW | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_STANDARDIZED_SHORT_DISTANCE_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | UNCHANGED_AFTER_FULL_REAPPRAISAL_CONFLICT_BAND_WIDENED | 2026 NPB+ 32.0km/hの同一100人内順位を現行中心として明示affirm。異metricまたはSNS混在は点を平均せず、レンジ拡大で表現。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 梶原 昂希 |  | 82 | 75-89 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP | 2026 NPB+ 33.4km/hの同一100人内順位を現行中心として明示affirm。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 牧 秀悟 |  | 66 | 59-73 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.6km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 筒香 嘉智 |  | 53 | 45-61 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_DIRECT_T90_CONTEXT_ONLY |  | VIDEO_INCONCLUSIVE | AFFIRMED_CURRENT_ORDINAL_WITH_HISTORICAL_DIRECT_CONTEXT | 2026 NPB+ 30.2km/hの同一100人内順位を現行中心として明示affirm。2022年公式T90=4.20秒のprovenance訂正は歴史文脈として保持し、2026へ自動転用しない。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 蝦名 達夫 |  | 64 | 57-71 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 今宮 健太 |  | 55 | 48-62 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 周東 佑京 |  | 96 | 89-100 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 35.0km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 山川 穂高 |  | 46 | 39-53 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 29.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 柳田 悠岐 |  | 70 | 63-77 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.1km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 柳町 達 |  | 65 | 58-72 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 栗原 陵矢 |  | 63 | 56-70 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.3km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 正木 智也 |  | 61 | 54-68 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.1km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 海野 隆司 |  | 54 | 47-61 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.3km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 牧原 大成 |  | 83 | 76-90 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 近藤 健介 |  | 62 | 55-69 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.2km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 丸 佳浩 |  | 64 | 54-74 | LOW | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL_TEMPORAL_CONSTRAINT | 2026 NPB+ 31.4km/hの同一100人内順位を現行中心として明示affirm。SNSの時間変化は旧証拠のcarry-forwardを抑える制約としてのみ使用。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 佐々木 俊輔 |  | 78 | 71-85 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 33.0km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 吉川 尚輝 |  | 74 | 67-81 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 大城 卓三 |  | 44 | 37-51 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 29.2km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 岸田 行倫 |  | 46 | 39-53 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 29.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 松本 剛 |  | 64 | 57-71 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 31.4km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 中野 拓夢 |  | 77 | 70-84 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.9km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 伏見 寅威 |  | 43 | 36-50 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 29.1km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 佐藤 輝明 |  | 70 | 63-77 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.1km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 坂本 誠志郎 |  | 53 | 46-60 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.2km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 大山 悠輔 |  | 56 | 49-63 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 小幡 竜平 |  | 76 | 69-83 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | HISTORICAL_PROFILE_CONTEXT_ONLY |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 32.8km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 木浪 聖也 |  | 51 | 44-58 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.0km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |
| 梅野 隆太郎 |  | 57 | 47-67 | LOW | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | VIDEO_INCONCLUSIVE | UNCHANGED_AFTER_FULL_REAPPRAISAL_MIXED_BAND_WIDENED | 2026 NPB+ 30.6km/hの同一100人内順位を現行中心として明示affirm。異metricまたはSNS混在は点を平均せず、レンジ拡大で表現。targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映。動画はusable current full-effort play=0で、数値入力にしていない。 |
| 森下 翔太 |  | 56 | 49-63 | LOW_MEDIUM | CURRENT_NPB_PLUS_ORDINAL | NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE |  | NOT_IN_VIDEO_TIEBREAK_SCOPE | UNCHANGED_AFTER_FULL_REAPPRAISAL | 2026 NPB+ 30.5km/hの同一100人内順位を現行中心として明示affirm。個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映。 |

## Comparison to prior provisional freeze

| player | prior rounded | final | change | reason |
| --- | --- | --- | --- | --- |
| モンテロ |  | 52 | -16 | RECENT_DIRECT_T90_PRECEDENCE |
| 名原 典彦 |  | 84 | N/A | SAME_SCALE_CURRENT_ORDINAL_INTERPOLATION_SOURCE_ID_NULL |

- mean absolute change (99 comparable rows): 0.162
- 不必要な変更数を目標にせず、現行direct evidenceが明確に優先されるモンテロだけを変更した。

## Remaining limitations

- NPB+ → T90 bridgeは未較正で、production NPB reference CDFも未較正。
- 2026の比較可能なcurrent acceleration evidenceはほぼ公開されていない。
- 17人にusable video evidenceはない。
- SNSの不足・混在は、証拠不存在ではなく、今回のstrict基準でordinal resolutionを支える独立性が不足したことを示す。
- これらはconfidence / bandへ反映済みであり、追加探索を再開する理由にはしない。

## Internal QA

- Status: **PASS** (21/21)
- Rebuild: `node scripts/build_speed_2026_final_reappraisal_freeze.mjs`

## Independent QA

- Status: **PASS** (21/21)
- Artifact: `data/manual/speed_2026_final_reappraisal_blind_independent_qa_20260811.json`
- Independent reviewer opened only Stage 1 allowlisted evidence and freeze artifacts; no external game value was used.

# 走力100人・走力定義準拠の全件再レビュー — 2026-08-18

Status: **CORRECTED NON-VERDICT RECOMMENDATIONS**

> これはAI側のレビュー推奨であり、SP-078の正式owner verdictではない。SP-079も開始しない。

## 結論

- 対象: **100/100人**
- PowerProと大きな矛盾なし: **31人**
- PowerProが低すぎる可能性: **1人（山口航輝）**
- PowerProが高すぎる・古い可能性: **1人（塩見泰隆）**
- 未確定: **67人**

未確定が多いのは失敗ではなく、最高速度だけで総合走力を断定しないという走力定義を100人へ同じように適用した結果である。

## 今回の走力定義

走力は、**最初の一歩から約90ftまでの身体的な走力**として評価する。

1. 初期加速
2. 最高速度
3. 約90ftまで速度を維持して走り切る性能

- NPB+最高速度は2だけを測る1レーン。
- H2F・T10・T30・T90・30m・50mは別レーンとして扱い、相互に無効な換算をしない。
- S・試合指標・Communityは補助文脈で、身体レーンの代わりにしない。
- 盗塁・走塁技術を純粋な足の速さへ混ぜない。
- 古い記録を2026年へ自動持ち越ししない。
- 欠損を遅さの証拠にしない。

## 強い方向判定が残った2人

### 山口 航輝 — PowerProが低すぎる可能性

現在の最高速度と50mは52より速い方向を示し、Communityは『足は速い』と『盗塁のセンスはない』を明確に分離している。低いS・試合指標を純粋な脚力低下へ読み替えられない。

### 塩見 泰隆 — PowerProが高すぎる・古い可能性

最高速度が一定水準でも走力全体は別。H2Fが非常に遅く、Sのプラス値は信頼度0・PA0で、2026年の複数観察も怪我・年齢による低下を示す。83は高すぎるか古い可能性が高い。

## PowerProと大きな矛盾がなかった31人

中川 圭太 / 来田 涼斗 / 森 友哉 / 岡林 勇希 / 田中 幹也 / 清宮 幸太郎 / ポランコ / 友杉 篤輝 / 安田 尚憲 / 岡 大海 / 藤原 恭大 / 髙部 瑛斗 / 源田 壮亮 / 滝澤 夏央 / モンテロ / 秋山 翔吾 / サンタナ / 丸山 和郁 / 林 琢真 / 梶原 昂希 / 筒香 嘉智 / 蝦名 達夫 / 周東 佑京 / 山川 穂高 / 柳町 達 / 栗原 陵矢 / 正木 智也 / 牧原 大成 / 松本 剛 / 佐藤 輝明 / 小幡 竜平

ここでの「大きな矛盾なし」は、その数値が正確に較正済みという意味ではない。利用できる複数の身体レーンが、PowerPro値を明確には否定しないという意味だけである。

## 未確定67人の主な理由

- INSUFFICIENT_FULL_CONSTRUCT_PEAK_ONLY: 46人
- NO_CURRENT_POWERPRO_TARGET: 5人
- PEAK_AND_50M_CONFLICT: 2人
- TEMPORAL_MISMATCH_CURRENT_PEAK_VS_2017_RUN_SHAPE: 1人
- OLD_H2F_NOT_CURRENT_WHOLE_CONSTRUCT: 1人
- PHYSICAL_DIMENSIONS_AND_PROXIES_CONFLICT: 1人
- CONFLICTING_SHORT_DISTANCE_RECORDS: 1人
- NON_PEAK_VALUE_MISSING: 1人
- CURRENT_PEAK_AND_2024_H2F_CONFLICT: 1人
- LOW_PHYSICAL_EVIDENCE_VS_HIGHER_PP_TEMPORAL_UNKNOWN: 1人
- OLD_H2F_AND_MISSING_SHORT_VALUE: 1人
- PEAK_VS_SHORT_AND_CONTEXT_CONFLICT: 1人
- CEILING_RATING_NOT_SUPPORTED_ACROSS_DIMENSIONS: 1人
- ELITE_DIRECTION_BUT_CEILING_WHOLE_CONSTRUCT_UNOBSERVED: 1人
- CURRENT_PEAK_VS_OLD_50M_CONFLICT: 1人
- CURRENT_AND_HISTORICAL_DIMENSIONS_MIXED: 1人
- PHYSICAL_DIMENSIONS_CONFLICT: 1人

## 100人個別表

| # | 選手 | PP | 直接物理レーン | 判定 | 確信度 | 理由 |
|---:|---|---:|---|---|---|---|
| 1 | 中川 圭太 | 74 | CURRENT_PEAK + H2F_NORMAL | 大きな矛盾なし | LOW_MEDIUM | 現在の最高速度は上位寄りで、H2Fはサンプル平均よりわずかに遅い程度。現在の補助材料も強く否定しておらず、74とは大きく矛盾しない。ただしH2Fの現在性が弱いため確信度は限定的。 |
| 2 | 太田 椋 | 64 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 3 | 宗 佑磨 | — | CURRENT_PEAK | 未確定 | HIGH | 現行PowerPro値がなく、比較判定そのものができない。物理材料は後続の実査定には使えるが、PowerProの妥当性判定にはならない。 |
| 4 | 来田 涼斗 | 85 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | LOW_MEDIUM | 現在の最高速度は上位寄りで、50mも速い方向。高い評価と整合するが、50mの測定年が不明なので確信度は限定的。 |
| 5 | 森 友哉 | 65 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | LOW_MEDIUM | 現在の最高速度と50mはいずれも中位からやや下の身体像を示す。65とは大きく矛盾しないが、50mの測定年が不明。 |
| 6 | 紅林 弘太郎 | 56 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 7 | 若月 健矢 | 48 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 8 | 西川 龍馬 | 72 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 9 | 西野 真弘 | 76 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 10 | カリステ | 82 | CURRENT_PEAK + T10_T30_T90_RECORDS:4 | 未確定 | MEDIUM_HIGH | 現在の最高速度は7回相当で過小評価の可能性があり、T10・T30・T90は2017年。現在と過去の時間軸が合わず、2026年の総合走力は決められない。 |
| 11 | 土田 龍空 | 66 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 12 | 大島 洋平 | 74 | CURRENT_PEAK + H2F_NORMAL + H2F_BUNT | 未確定 | MEDIUM_HIGH | 現在の最高速度は測定機会が少なく、H2Fは2007年。S・試合指標・Communityは走塁実用面の文脈を含み、現在の90ft身体能力を代替できない。 |
| 13 | 岡林 勇希 | 81 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | MEDIUM | 現在の最高速度、2019年の50m、現在のS・試合文脈がいずれも速い方向。81とは大きく矛盾しないが、50mが古いため確信度は中程度。 |
| 14 | 木下 拓哉 | 39 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 15 | 村松 開人 | 80 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 16 | 板山 祐太郎 | 72 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 17 | 田中 幹也 | 83 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | MEDIUM_HIGH | 現在の最高速度は最上位層で、50mも速く、現在の補助指標も同方向。83は妥当な範囲。 |
| 18 | 石川 昂弥 | 41 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 19 | 福永 裕基 | 64 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 20 | 細川 成也 | 60 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 現在の最高速度は速い一方、50mは中位で、S・試合文脈は低い。物理レーン同士も補助材料とも一致せず未確定。 |
| 21 | 高橋 周平 | 46 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 22 | 奈良間 大己 | 64 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:3 | 未確定 | MEDIUM_HIGH | 現在の最高速度は中位だが、50m記録が6.31秒と5.8秒で大きく食い違う。現在の総合走力を一意に決められない。 |
| 23 | 水野 達稀 | 71 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 24 | 清宮 幸太郎 | 56 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | MEDIUM | 現在の最高速度は中位、50mは遅い方向で、S・試合文脈も低め。56という低めの評価とは大きく矛盾しない。 |
| 25 | 田宮 裕涼 | 68 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 短距離レーンは存在するが数値が欠けており、実質的に使える直接物理材料は最高速度だけ。総合走力は未確定。 |
| 26 | 郡司 裕也 | 61 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 27 | 野村 佑希 | 52 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 28 | ソト | — | CURRENT_PEAK | 未確定 | HIGH | 現行PowerPro値がなく、比較判定そのものができない。物理材料は後続の実査定には使えるが、PowerProの妥当性判定にはならない。 |
| 29 | ポランコ | 63 | CURRENT_PEAK + T10_T30_T90_RECORDS:4 | 大きな矛盾なし | MEDIUM | 現在の最高速度は中位下、2021年のT10・T30・T90も低めから中位で、63と大きく矛盾しない。ただし現在性は限定的。 |
| 30 | 佐藤 都志也 | 71 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 現在の最高速度は中位下だが、測定年不明の50mは速い。物理レーンが食い違い、71の妥当性を決められない。 |
| 31 | 友杉 篤輝 | 87 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:3 | 大きな矛盾なし | HIGH | 現在の最高速度、H2F、短距離の3方向がいずれも速い。87という高評価と整合する。 |
| 32 | 安田 尚憲 | 46 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | HIGH | 現在の最高速度は下位で、50mも遅い。S・試合文脈も同方向であり、46という低評価と整合する。 |
| 33 | 小川 龍成 | 86 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 34 | 山口 航輝 | 52 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | PowerProが低すぎる可能性 | MEDIUM | 現在の最高速度と50mは52より速い方向を示し、Communityは『足は速い』と『盗塁のセンスはない』を明確に分離している。低いS・試合指標を純粋な脚力低下へ読み替えられない。 |
| 35 | 岡 大海 | 82 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | MEDIUM | 現在の最高速度と50mは速い方向で、現在のS・試合文脈もプラス。82と整合する。 |
| 36 | 藤原 恭大 | 85 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | HIGH | 現在の最高速度、H2F、50mの3つが速い方向で一致し、現在の補助材料も同方向。85と整合する。 |
| 37 | 藤岡 裕大 | 65 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 38 | 髙部 瑛斗 | 90 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | HIGH | 現在の最高速度は最上位層で、50mも速く、現在のS・試合文脈も高い。90と整合する。 |
| 39 | 古賀 悠斗 | 47 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 40 | 外崎 修汰 | 68 | CURRENT_PEAK + H2F_NORMAL | 未確定 | MEDIUM_HIGH | 現在の最高速度は上位寄りだが、2024年H2Fはかなり遅い。走りの形が食い違うため68を確定できない。 |
| 41 | 源田 壮亮 | 80 | CURRENT_PEAK + H2F_NORMAL + H2F_BUNT | 大きな矛盾なし | HIGH | 現在の最高速度が速く、2024年を含む複数のH2Fも速い。80と整合する。 |
| 42 | 滝澤 夏央 | 85 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | MEDIUM_HIGH | 現在の最高速度と50mがいずれも速い。85と整合するが、50mの測定年不明により確信度は少し下がる。 |
| 43 | 石井 一成 | 79 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 44 | ファビアン | 61 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 45 | モンテロ | 49 | CURRENT_PEAK + T10_T30_T90_RECORDS:4 | 大きな矛盾なし | MEDIUM | 現在の最高速度は一定水準だが、2024年T90は4.20秒でSprint Speedも低め。最近の走り切り材料が低い総合評価を説明し、49と整合する。 |
| 46 | 名原 典彦 | — | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:4 | 未確定 | HIGH | 現行PowerPro値がなく、比較判定そのものができない。物理材料は後続の実査定には使えるが、PowerProの妥当性判定にはならない。 |
| 47 | 坂倉 将吾 | 68 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 現在の最高速度と50mは低めだが、50mの測定年が不明。68を高すぎると断定できるほど時間軸が揃っていない。 |
| 48 | 小園 海斗 | 79 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 現在の最高速度は中位、H2Fは2016年で、短距離数値も欠ける。現在の79を検証できない。 |
| 49 | 矢野 雅哉 | 78 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 観測された最高速度は低い一方、50mとS・試合文脈は高い。レーンが衝突しており未確定。 |
| 50 | 秋山 翔吾 | 73 | CURRENT_PEAK + T10_T30_T90_RECORDS:4 | 大きな矛盾なし | LOW_MEDIUM | 現在の最高速度は測定機会が少ないが、2021年のT10・T30・T90と現在の補助文脈は上位方向。73とは大きく矛盾しないが現在性は限定的。 |
| 51 | 菊池 涼介 | 72 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 52 | 野間 峻祥 | 88 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 53 | サンタナ | 47 | CURRENT_PEAK + T10_T30_T90_RECORDS:4 | 大きな矛盾なし | MEDIUM | 現在の最高速度は下位寄りで、2020年のT10・T30・T90も低い方向。47と整合する。 |
| 54 | 並木 秀尊 | 97 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:3 | 未確定 | MEDIUM_HIGH | 現在の最高速度は最上位だが、H2Fは平均程度で、50m記録も5.32秒と6.06秒で食い違う。97という上限近い総合評価を全次元では確認できない。 |
| 55 | 中村 悠平 | 56 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 56 | 丸山 和郁 | 86 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | HIGH | 現在の最高速度、H2F、50mの3つが速い方向で一致。86と整合する。 |
| 57 | 古賀 優大 | 46 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 58 | 塩見 泰隆 | 83 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:3 | PowerProが高すぎる・古い可能性 | HIGH | 最高速度が一定水準でも走力全体は別。H2Fが非常に遅く、Sのプラス値は信頼度0・PA0で、2026年の複数観察も怪我・年齢による低下を示す。83は高すぎるか古い可能性が高い。 |
| 59 | 岩田 幸宏 | 96 | CURRENT_PEAK | 未確定 | MEDIUM_HIGH | 『非常に速い』方向は最高速度・S・試合文脈・Communityで強く支持される。ただし96はほぼ上限の総合走力で、加速・H2F・T90・30m・50mがなく数値そのものは確認できない。 |
| 60 | 長岡 秀樹 | 58 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 61 | 太田 光 | 44 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 62 | 村林 一輝 | 69 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 現在の最高速度は最上位だが、非最高速度の直接材料は2015年50m6.2秒のみ。時間軸と方向が合わず69を決められない。 |
| 63 | 浅村 栄斗 | 35 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 64 | 渡邊 佳明 | 50 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 65 | 鈴木 大地 | 49 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 66 | 京田 陽太 | 78 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 現在の最高速度は中位下だが、測定年不明の50mは速い。物理レーンが衝突し78を決められない。 |
| 67 | 佐野 恵太 | 48 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 68 | 宮﨑 敏郎 | 33 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 69 | 山本 祐大 | 61 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 70 | 度会 隆輝 | 65 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 71 | 林 琢真 | 82 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:3 | 大きな矛盾なし | MEDIUM | 現在の最高速度は上位寄りで、2022年および年不明の50mも速い。82と大きく矛盾しないが、最高速度の測定機会が少ないため確信度は中程度。 |
| 72 | 梶原 昂希 | 90 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | MEDIUM_HIGH | 現在の最高速度は最上位で、50mも速い。H2Fは平均程度なので90の厳密な上限までは証明しないが、大きな矛盾はない。 |
| 73 | 牧 秀悟 | — | CURRENT_PEAK | 未確定 | HIGH | 現行PowerPro値がなく、比較判定そのものができない。物理材料は後続の実査定には使えるが、PowerProの妥当性判定にはならない。 |
| 74 | 筒香 嘉智 | 45 | CURRENT_PEAK + T10_T30_T90_RECORDS:4 | 大きな矛盾なし | HIGH | 現在の最高速度と2022年のT10・T30・T90・Sprint Speedがすべて低い方向。45と整合する。 |
| 75 | 蝦名 達夫 | 75 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | LOW_MEDIUM | 現在の最高速度は中位、50mは速く、S・試合文脈もプラス。75と大きく矛盾しないが、50mの測定年が不明。 |
| 76 | 今宮 健太 | 66 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 77 | 周東 佑京 | 96 | CURRENT_PEAK + H2F_NORMAL + H2F_BUNT + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | HIGH | 現在の最高速度1位、2024年を含む速いH2F、速い50mが一致。96という最上位評価と整合する。 |
| 78 | 山川 穂高 | 47 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | HIGH | 現在の最高速度は下位で、50mも遅く、S・試合文脈も同方向。47と整合する。 |
| 79 | 柳田 悠岐 | 67 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 現在の最高速度は上位寄りだが、H2F・50mは古く、S・試合文脈は低い。現在のCommunityは肯定的でも標準化された走り切り測定ではなく未確定。 |
| 80 | 柳町 達 | 67 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | LOW_MEDIUM | 現在の最高速度と50mはいずれも中位の身体像。67とは大きく矛盾しないが、50mの測定年不明で確信度は限定的。 |
| 81 | 栗原 陵矢 | 59 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | MEDIUM | 現在の最高速度と50mがともに中位下。59と整合する。 |
| 82 | 正木 智也 | 48 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | MEDIUM_HIGH | 現在の最高速度は中位下、50mは遅く、補助材料も低い。48と整合する。 |
| 83 | 海野 隆司 | 52 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 84 | 牧原 大成 | 82 | CURRENT_PEAK + H2F_BUNT + SHORT_DISTANCE_RECORDS:2 | 大きな矛盾なし | HIGH | 現在の最高速度は最上位層で、バントH2Fと50mも速い。82と整合する。 |
| 85 | 近藤 健介 | 64 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 86 | 丸 佳浩 | — | CURRENT_PEAK | 未確定 | HIGH | 現行PowerPro値がなく、比較判定そのものができない。物理材料は後続の実査定には使えるが、PowerProの妥当性判定にはならない。 |
| 87 | 佐々木 俊輔 | 76 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 88 | 吉川 尚輝 | 80 | CURRENT_PEAK + H2F_NORMAL + SHORT_DISTANCE_RECORDS:2 | 未確定 | MEDIUM_HIGH | 現在の最高速度と50mは速い一方、通常H2Fは非常に遅い。走りの形が衝突しており80を決められない。 |
| 89 | 大城 卓三 | 24 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 90 | 岸田 行倫 | 55 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 91 | 松本 剛 | 69 | CURRENT_PEAK + H2F_NORMAL | 大きな矛盾なし | LOW_MEDIUM | 現在の最高速度は中位で、2022年H2Fも平均付近。69とは大きく矛盾しないが確信度は限定的。 |
| 92 | 中野 拓夢 | 75 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 93 | 伏見 寅威 | 40 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 94 | 佐藤 輝明 | 68 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:5 | 大きな矛盾なし | MEDIUM | 現在の最高速度は上位寄りで、30m・50m材料も中位以上。68というやや高めの評価と整合する。 |
| 95 | 坂本 誠志郎 | 56 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 96 | 大山 悠輔 | 58 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 97 | 小幡 竜平 | 77 | CURRENT_PEAK + SHORT_DISTANCE_RECORDS:5 | 大きな矛盾なし | MEDIUM | 現在の最高速度は上位で、30m・50mも中位以上。77と整合する。 |
| 98 | 木浪 聖也 | 59 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 99 | 梅野 隆太郎 | 57 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |
| 100 | 森下 翔太 | 60 | CURRENT_PEAK | 未確定 | HIGH | 現在の直接的な身体材料が最高速度だけで、加速・H2F・T90・30m・50mがない。S・試合指標・Communityは補助文脈であり、約90ftの総合走力を代替できないため未確定。 |

## Governance

- Source queue: `outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json`
- Queue SHA-256: `ff822cb44874a1021723e0c962ead7a16871d185586fd894ed29824456ca464d`
- Evidence inventory: `outputs/derived/speed_all100_full_construct_inventory_20260818.json`
- Manual recommendation ledger: `data/manual/speed_all100_full_construct_review_recommendations_20260818.tsv`
- SP-078 owner_verdict_count: 0
- SP-079: NOT_STARTED
- Shoulder: out of scope
- この監査結果をowner verdictへ自動コピーしてはならない。

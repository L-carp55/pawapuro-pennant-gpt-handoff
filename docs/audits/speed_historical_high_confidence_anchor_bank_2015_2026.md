# 走力 Historical High-Confidence Anchor Bank — 2015–2026

## 結論

この成果物は、選手×計測年代を崩さずに保存した身体計測・直接90ft・現在NPB+の比較補助台帳です。最終的な走力値は一切出力していません。

## 固定した境界

- 50m/30mを90ftへ比例変換していません。
- 年齢減衰、盗塁数、走塁結果、打撃から一塁までの到達、イベント単発速度をアンカー選択に使っていません。
- PowerPro、プロスピ、MLB The Showを参照・入力・選択に使っていません。
- MLB Sprint Speed、NPB+、Statcast 90ftは別定義・別集計のまま保持し、数値橋渡しをしていません。

## 生データとソース発見

- 生データ行: 459
- 高信頼アンカー: 113
- 現在NPB+の中信頼・同一データ集合アンカー: 100
- 棄却／文脈のみ行: 202
- 侍ジャパン大学候補の光電管50mは、公式の「2022年以降」表現を安全な開始点に採用しました。2021年は公式記事の光電管記載と2025年公式説明が衝突するため、全4件を保留棄却しました。
- 2022年6月の既存30人表は、公式で確認できた上位5人のみ採用し、残り25人は生データに残して高信頼から外しました。
- 2025年12月は35人・表示62試技を保持し、同一セッション複数試技の代表値は最小値です。この選び方は補正や別日比較を意味しません。

## 絶対直接値

公式Statcast CSVをライブ再検証できたT90は5選手年代です（カリステ2017、サンタナ2020、秋山翔吾2021、ポランコ2021、モンテロ2024）。筒香嘉智2022は現在の公式running-splitsとSprint Speed CSVで行が見つからず、保存済みスナップショットもないため棄却しました。

## アンカー・バンド・年代

バンドは同一指標・同一コホート内の8分位ラベルです。速さの最終評価ではなく、比較の位置を示すだけです。直接T90の異年代5件は意図的にバンド化・相互エッジ化していません。

- 高信頼50m物理アンカーのバンド分布: {"B1_FASTEST_COHORT_OCTILE":10,"B2_UPPER_COHORT_OCTILE":13,"B3_UPPER_MID_COHORT_OCTILE":15,"B4_MID_UPPER_COHORT_OCTILE":13,"B5_MID_LOWER_COHORT_OCTILE":12,"B6_LOWER_MID_COHORT_OCTILE":16,"B7_LOWER_COHORT_OCTILE":12,"B8_SLOWEST_COHORT_OCTILE":17}
- 2026 NPB+ 100人の中信頼バンド分布: {"B1_FASTEST_COHORT_OCTILE":12,"B2_UPPER_COHORT_OCTILE":13,"B3_UPPER_MID_COHORT_OCTILE":12,"B4_MID_UPPER_COHORT_OCTILE":13,"B5_MID_LOWER_COHORT_OCTILE":12,"B6_LOWER_MID_COHORT_OCTILE":13,"B7_LOWER_COHORT_OCTILE":12,"B8_SLOWEST_COHORT_OCTILE":13}
- 年代別の生データ／高信頼／中信頼: {"2015":{"raw_measurements":3,"high_confidence_anchors":0,"moderate_current_anchors":0},"2016":{"raw_measurements":6,"high_confidence_anchors":0,"moderate_current_anchors":0},"2017":{"raw_measurements":9,"high_confidence_anchors":1,"moderate_current_anchors":0},"2018":{"raw_measurements":7,"high_confidence_anchors":0,"moderate_current_anchors":0},"2019":{"raw_measurements":8,"high_confidence_anchors":0,"moderate_current_anchors":0},"2020":{"raw_measurements":21,"high_confidence_anchors":1,"moderate_current_anchors":0},"2021":{"raw_measurements":31,"high_confidence_anchors":2,"moderate_current_anchors":0},"2022":{"raw_measurements":56,"high_confidence_anchors":9,"moderate_current_anchors":0},"2023":{"raw_measurements":18,"high_confidence_anchors":6,"moderate_current_anchors":0},"2024":{"raw_measurements":50,"high_confidence_anchors":28,"moderate_current_anchors":0},"2025":{"raw_measurements":62,"high_confidence_anchors":35,"moderate_current_anchors":0},"2026":{"raw_measurements":134,"high_confidence_anchors":31,"moderate_current_anchors":100}}

## 比較グラフ

- エッジ総数: 200
- 高信頼エッジ: 101
- 中信頼エッジ: 99
- 同一バンド隣接エッジ: 161

高信頼エッジは同日・同形式の光電管コホート内だけです。中信頼エッジは2026 NPB+ 100人の同一スナップショット内だけで、公開サンプル数／qualified-run数がないことを保持しています。

## 100人相対パケット

- 参加: 100/100
- 状態内訳: {"ANCHOR_CONTEXT_HIGH_EVIDENCE":1,"ANCHOR_RESOLVED_MODERATE":80,"SNS_TIEBREAK":19}
- SNS再確認待ち: 19
- 動画レビュー待ち: 0
- 情報不足: 0

SNSキューに入れるのは、PAが100未満で現行NPB+の公開ラン数がない者、または同じ過去物理コホート順位と2026 NPB+順位が逆向きになる者だけです。全P1扱いにはしていません。

## 主な不確実性と否定的発見

1. 2015–2020は高信頼のNPB系光電管大規模コホートを確認できず、空白を埋める推定をしていません。
2. 2022年6月の25人、2021年12月の4人、手動計測・方式不明の30m/50m、home-to-first、盗塁・走塁結果は保持したうえでアンカーから外しました。
3. MLB直接90ftは実測定義上の絶対値ですが、年代差・リーグ差を越えて現在NPB+へ数値変換していません。
4. 2026 NPB+は100/100結合できましたが、選手別サンプル数とqualified-run数は公開されていません。
5. 鹿屋体育大の光電管30m、BCリーグの大規模測定、慶應の111人研究、匿名30m研究も発見しましたが、NPB中心の名寄せ可能な個人値という要件を満たさず、source manifestのnegative discovery registerに明記して採用していません。

## QA

内部QAは PASS（15件）です。独立QAファイルも検出: PASS。

## 次の安全な作業

SNSキューだけを、同一測定定義・日付・独立ソース数を明記して再確認してください。未確認の候補をゲーム能力値へ直結させないでください。

## 成果物

- data/manifests/speed_historical_anchor_source_manifest_2015_2026.json
- data/normalized/speed_historical_physical_measurements_2015_2026.json / data/normalized/speed_historical_physical_measurements_2015_2026.csv
- outputs/derived/speed_high_confidence_anchor_bank_2015_2026.json / outputs/derived/speed_high_confidence_anchor_bank_2015_2026.csv
- outputs/derived/speed_anchor_rejected_candidates_2015_2026.csv
- outputs/derived/speed_anchor_band_coverage_2015_2026.json
- outputs/derived/speed_high_confidence_anchor_pairwise_graph_2015_2026.json
- outputs/derived/speed_2026_100_anchor_relative_packets.json / outputs/derived/speed_2026_100_sns_tiebreak_queue.csv
- outputs/derived/speed_historical_anchor_build_qa_2015_2026.json

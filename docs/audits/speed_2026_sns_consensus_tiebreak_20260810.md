# 2026 NPB 走力 SNS Consensus Tie-break

## 範囲と結論

Historical High-Confidence Anchor BankでSNS_TIEBREAKとなったcanonical 19人だけを再確認した。SNS・定性根拠はordinal constraintだけに使い、最終走力値、50m/30mから90ftへの換算、年齢の固定減衰、盗塁・走塁技術、ゲーム能力値は一切使っていない。

## カバレッジ

- SNS target: 19/19
- 100-player decision support: 100/100 (81 non-SNS baseline + 19 SNS tie-break)
- accepted raw source: 21
- rejected source: 31
- accepted SNS-platform source: 7
- rejected SNS-platform source: 23
- accepted source platform counts: {"PUBLIC_WEB_POST":3,"SPORTS_ARTICLE":14,"X_TWITTER":3,"YOUTUBE":1}
- all source year counts: {"2018":1,"2019":1,"2021":1,"2022":2,"2024":5,"2025":15,"2026":27}
- independent accepted source >=2: 6
- independent accepted source >=3: 3
- independent SNS source >=2: 0
- classification counts: {"INSUFFICIENT_SNS_EVIDENCE":18,"METRIC_CONSTRUCT_CONFLICT":1}
- VIDEO_TIEBREAK_RECOMMENDED: 19

## 19人の結論

- 西野 真弘 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。独立SNSの速度観察不足。
- カリステ (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。SNS最低件数に未達。
- 土田 龍空 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。現在SNSが1起源のみ。
- 大島 洋平 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。SNS最低件数に未達。
- 木下 拓哉 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。同一出来事群のみ。
- 友杉 篤輝 (TYPE_B_PHYSICAL_ORDER_CONFLICT): INSUFFICIENT_SNS_EVIDENCE / still unresolved。同一映像以外のSNS不足。
- 岡 大海 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。走塁結果を除外するとSNS根拠なし。
- 藤岡 裕大 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。有効な現在SNSなし。
- 外崎 修汰 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / widen uncertainty。SNS不足と時点の混在。
- 矢野 雅哉 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / widen uncertainty。速い方向だがSNS1件。
- 野間 峻祥 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。補助記事はあるがSNS1件。
- 並木 秀尊 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。再現不能な検索索引を除外。
- 中村 悠平 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。対象本人の有効SNSなし。
- 塩見 泰隆 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。復帰後のSNS速度観察不足。
- 鈴木 大地 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。SNS1件で単発事象のみ。
- 林 琢真 (TYPE_B_PHYSICAL_ORDER_CONFLICT): METRIC_CONSTRUCT_CONFLICT / still unresolved。歴史的短距離値と現順位は別構成。
- 梶原 昂希 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。SNS1件で現行最速帯を確定しない。
- 丸 佳浩 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。有効な身体速度根拠なし。
- 梅野 隆太郎 (TYPE_A_CURRENT_SAMPLE_INSTABILITY): INSUFFICIENT_SNS_EVIDENCE / still unresolved。対象本人の有効SNSなし。

## ソース上の制約

- X/Twitterは公開検索画面が安定して取得できず、Blueskyもこの実行環境では閲覧接続が成立しなかった。したがって、SNS本文を確認できないものを推測で票にしていない。
- スポーツ記事はSNS不足時の補助sourceとしてのみ明示区別した。記事だけの集積をSNS consensusとは呼んでいない。
- 2026、2025、2024を優先し、Type Bの測定差だけは測定時代の直接資料を残した。古い投稿・資料は2026 current abilityを自動的に決める根拠ではない。
- SNSで見つからなかったことは、遅い、またはcurrent NPB+が正しいという証拠ではない。

## 棄却した証拠の扱い

- repost、転載、同一origin、盗塁・走塁判断、game rating、physical speedを直接示さない記事は独立票に数えない。
- rejected source records remain in the raw ledger with exclusion_reason so that the negative finding is reproducible.

## QA

- internal QA: PASS (21 checks)
- independent QA: PASS
- publication QA status: PASS

## 成果物

- data/normalized/speed_2026_sns_consensus_sources.csv
- data/normalized/speed_2026_sns_consensus_sources.json
- outputs/derived/speed_2026_sns_tiebreak_consensus.json
- outputs/derived/speed_2026_sns_tiebreak_consensus.csv
- outputs/derived/speed_2026_100_post_sns_decision_support.json
- outputs/derived/speed_2026_video_tiebreak_queue.csv
- outputs/derived/speed_2026_sns_consensus_qa.json

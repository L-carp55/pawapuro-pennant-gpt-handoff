# 2026 NPB+ Sprint Speed 小標本・観測機会監査

作成日: 2026-08-09
対象: data/pennant.db::npb_plus_measurement の season_label='2026途中' AND top_speed_kmh IS NOT NULL 100人。ユーザー指定の 07_pennant.db はこのリポジトリには存在せず、同リポジトリの data/pennant.db を正本として読み取りました。

## 目的と扱い

本成果物は出場量・観測機会・公開仕様の欠損を後工程で検証できるようにするための収集データです。Sprint Speedや査定値は変更していません。PowerPro値は入力しておらず、将来結合用に pawapuro_2026_speed 列を空欄で用意しています。

## 取得時点と出典

- 2026年の試合・PA・AB: NPB公式「個人打撃成績（全選手）」ページの **2026年8月8日現在**。
- 2025年の試合・PA・AB: NPB公式の各球団・個人打撃成績ページのシーズン確定値。
- PBP proxy: リポジトリに既存の infield_grounder_events、baserunning_advances、catcher_steal_event。元データは [Nippon Baseball Data Repository](https://github.com/armstjc/Nippon-Baseball-Data-Repository) 由来で、日付が確認できる範囲は 2026-03-27 through 2026-07-18 (existing PBP-derived tables; date-bearing tables)。
- NPB+仕様: [NPB+公式ページ](https://www.japan-baseball.jp/npb-plus/) と [利用規約](https://www.japan-baseball.jp/npb-plus/terms/) などの公開資料。アプリ内部値の追加取得やスクレイピングはしていません。

公式成績のページは、例えば [NPB 2026 DeNA個人打撃成績](https://npb.jp/bis/2026/stats/idb1_db.html) および [NPB 2025 SoftBank個人打撃成績](https://npb.jp/bis/2025/stats/idb1_h.html) の形式で、全選手の試合・PA・ABを掲載しています。

## NPB+仕様監査

公開資料から確認できたのは、NPB+のトラッキングデータがHawk-Eye由来であること、選手情報にSprint Speed（スプリント）が表示されること、そして「最速タイム（一塁到達）」がSprint Speedとは別項目で表示されることまでです。次の項目は公開資料で確認できなかったため、推定せず NOT_PUBLICLY_DOCUMENTED としました。

| 項目 | 判定 |
| --- | --- |
| minimum sample | NOT_PUBLICLY_DOCUMENTED |
| qualified run count | NOT_PUBLICLY_DOCUMENTED |
| sample count | NOT_PUBLICLY_DOCUMENTED |
| aggregation method | NOT_PUBLICLY_DOCUMENTED |
| update frequency | NOT_PUBLICLY_DOCUMENTED |
| 最高速度か平均速度か | NOT_PUBLICLY_DOCUMENTED |
| MLB Statcastと同じ定義か | NOT_PUBLICLY_DOCUMENTED |
| km/h単位の公式定義 | NOT_PUBLICLY_DOCUMENTED |

リポジトリの保存列名は top_speed_kmh ですが、これはリポジトリ側の保存名であり、NPB+公式の集計式・単位・対象走数を証明するものではありません。

## PBP proxyの定義と限界

full_effort_run_proxy_count は、次の既存レコード数の合計です。

1. infield_grounder_events: 走者なしの内野ゴロ・内野安打・送球エラー等として記録された打者イベント。
2. baserunning_advances: 一塁→三塁、二塁→本塁、一塁→本塁（二塁打）の走者イベント。
3. catcher_steal_event: 牽制を除外した二塁への盗塁関連イベント。

これは「全力走行が確実に起きた回数」ではなく、走力が発現し得る場面の機械的な記録数です。イベントは速度そのものではなく、同一プレーの一意性・全力走行の有無・走者の意図を完全には保証しません。盗塁は査定値へ混ぜていません。

## 球団別一覧

### オリックス

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 中川 圭太 | 32.6 | 93 | 366 | — | 41 | 463 | partial_tier_A_C_unavailable |
| 太田 椋 | 31.7 | 85 | 347 | — | 30 | 496 | partial_tier_A_C_unavailable |
| 宗 佑磨 | 31.9 | 96 | 388 | — | 41 | 388 | partial_tier_A_C_unavailable |
| 来田 涼斗 | 32.4 | 62 | 183 | — | 24 | 135 | partial_tier_A_C_unavailable |
| 森 友哉 | 31.2 | 65 | 250 | — | 25 | 191 | partial_tier_A_C_unavailable |
| 紅林 弘太郎 | 30.7 | 95 | 365 | — | 28 | 447 | partial_tier_A_C_unavailable |
| 若月 健矢 | 30.7 | 80 | 244 | — | 20 | 400 | partial_tier_A_C_unavailable |
| 西川 龍馬 | 31.1 | 102 | 436 | — | 57 | 412 | partial_tier_A_C_unavailable |
| 西野 真弘 | 31.6 | 29 | 85 | — | 15 | 252 | partial_tier_A_C_unavailable |

### 中日

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| カリステ | 31.3 | 26 | 67 | — | 7 | 192 | partial_tier_A_C_unavailable |
| 土田 龍空 | 31.2 | 38 | 43 | — | 3 | 53 | partial_tier_A_C_unavailable |
| 大島 洋平 | 31.7 | 21 | 66 | — | 13 | 98 | partial_tier_A_C_unavailable |
| 岡林 勇希 | 32.5 | 54 | 235 | — | 39 | 637 | partial_tier_A_C_unavailable |
| 木下 拓哉 | 29.4 | 21 | 63 | — | 4 | 122 | partial_tier_A_C_unavailable |
| 村松 開人 | 33.4 | 99 | 413 | — | 55 | 186 | partial_tier_A_C_unavailable |
| 板山 祐太郎 | 32 | 67 | 182 | — | 18 | 193 | partial_tier_A_C_unavailable |
| 田中 幹也 | 33.5 | 73 | 247 | — | 48 | 365 | partial_tier_A_C_unavailable |
| 石川 昂弥 | 30.6 | 64 | 236 | — | 20 | 75 | partial_tier_A_C_unavailable |
| 福永 裕基 | 33 | 73 | 256 | — | 31 | 57 | partial_tier_A_C_unavailable |
| 細川 成也 | 32.7 | 102 | 429 | — | 37 | 428 | partial_tier_A_C_unavailable |
| 高橋 周平 | 29.5 | 48 | 102 | — | 12 | 101 | partial_tier_A_C_unavailable |

### 日本ハム

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 奈良間 大己 | 31.7 | 84 | 192 | — | 22 | 103 | partial_tier_A_C_unavailable |
| 水野 達稀 | 33.4 | 98 | 409 | — | 47 | 332 | partial_tier_A_C_unavailable |
| 清宮 幸太郎 | 31.7 | 97 | 363 | — | 42 | 577 | partial_tier_A_C_unavailable |
| 田宮 裕涼 | 32.4 | 74 | 236 | — | 35 | 274 | partial_tier_A_C_unavailable |
| 郡司 裕也 | 32.7 | 79 | 284 | — | 29 | 422 | partial_tier_A_C_unavailable |
| 野村 佑希 | 31.7 | 84 | 302 | — | 25 | 369 | partial_tier_A_C_unavailable |

### ロッテ

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ソト | 30.1 | 88 | 302 | — | 29 | 367 | partial_tier_A_C_unavailable |
| ポランコ | 31.1 | 52 | 149 | — | 12 | 154 | partial_tier_A_C_unavailable |
| 佐藤 都志也 | 31.3 | 88 | 301 | — | 26 | 224 | partial_tier_A_C_unavailable |
| 友杉 篤輝 | 32.7 | 83 | 270 | — | 35 | 319 | partial_tier_A_C_unavailable |
| 安田 尚憲 | 29.6 | 42 | 129 | — | 10 | 350 | partial_tier_A_C_unavailable |
| 小川 龍成 | 33.4 | 96 | 346 | — | 51 | 202 | partial_tier_A_C_unavailable |
| 山口 航輝 | 31.9 | 67 | 243 | — | 17 | 112 | partial_tier_A_C_unavailable |
| 岡 大海 | 32.6 | 26 | 50 | — | 7 | 181 | partial_tier_A_C_unavailable |
| 藤原 恭大 | 33 | 63 | 278 | — | 31 | 452 | partial_tier_A_C_unavailable |
| 藤岡 裕大 | 30.8 | 9 | 26 | — | 3 | 373 | partial_tier_A_C_unavailable |
| 髙部 瑛斗 | 33.6 | 44 | 130 | — | 31 | 384 | partial_tier_A_C_unavailable |

### 西武

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 古賀 悠斗 | 30.6 | 76 | 193 | — | 30 | 328 | partial_tier_A_C_unavailable |
| 外崎 修汰 | 32.3 | 23 | 69 | — | 9 | 415 | partial_tier_A_C_unavailable |
| 源田 壮亮 | 32.9 | 81 | 209 | — | 27 | 361 | partial_tier_A_C_unavailable |
| 滝澤 夏央 | 33 | 93 | 363 | — | 52 | 438 | partial_tier_A_C_unavailable |
| 石井 一成 | 32.6 | 62 | 216 | — | 22 | 364 | partial_tier_A_C_unavailable |

### 広島

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ファビアン | 31.4 | 65 | 255 | — | 15 | 572 | partial_tier_A_C_unavailable |
| モンテロ | 31.9 | 86 | 251 | — | 13 | 396 | partial_tier_A_C_unavailable |
| 名原 典彦 | 33.7 | 53 | 222 | — | 28 | — | partial_2025_unavailable_tier_A_C_unavailable |
| 坂倉 将吾 | 30.6 | 94 | 383 | — | 38 | 399 | partial_tier_A_C_unavailable |
| 小園 海斗 | 31.5 | 96 | 382 | — | 49 | 573 | partial_tier_A_C_unavailable |
| 矢野 雅哉 | 30.7 | 44 | 58 | — | 15 | 335 | partial_tier_A_C_unavailable |
| 秋山 翔吾 | 31.6 | 49 | 134 | — | 9 | 157 | partial_tier_A_C_unavailable |
| 菊池 涼介 | 31.8 | 88 | 353 | — | 36 | 389 | partial_tier_A_C_unavailable |
| 野間 峻祥 | 31.7 | 35 | 86 | — | 8 | 166 | partial_tier_A_C_unavailable |

### ヤクルト

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| サンタナ | 30.8 | 96 | 357 | — | 40 | 240 | partial_tier_A_C_unavailable |
| 並木 秀尊 | 33.8 | 18 | 45 | — | 6 | 128 | partial_tier_A_C_unavailable |
| 中村 悠平 | 30.4 | 32 | 65 | — | 8 | 221 | partial_tier_A_C_unavailable |
| 丸山 和郁 | 32.4 | 39 | 112 | — | 10 | 36 | partial_tier_A_C_unavailable |
| 古賀 優大 | 32.1 | 69 | 252 | — | 27 | 291 | partial_tier_A_C_unavailable |
| 塩見 泰隆 | 32.3 | 37 | 83 | — | 8 | 0 | partial_tier_A_C_unavailable |
| 岩田 幸宏 | 33.6 | 91 | 330 | — | 50 | 401 | partial_tier_A_C_unavailable |
| 長岡 秀樹 | 31.6 | 85 | 355 | — | 55 | 261 | partial_tier_A_C_unavailable |

### 楽天

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 太田 光 | 30.5 | 72 | 204 | — | 23 | 231 | partial_tier_A_C_unavailable |
| 村林 一輝 | 34.5 | 96 | 386 | — | 63 | 557 | partial_tier_A_C_unavailable |
| 浅村 栄斗 | 30.5 | 87 | 333 | — | 27 | 389 | partial_tier_A_C_unavailable |
| 渡邊 佳明 | 30.3 | 54 | 140 | — | 12 | 166 | partial_tier_A_C_unavailable |
| 鈴木 大地 | 29 | 34 | 55 | — | 5 | 198 | partial_tier_A_C_unavailable |

### DeNA

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 京田 陽太 | 31.1 | 45 | 119 | — | 19 | 210 | partial_tier_A_C_unavailable |
| 佐野 恵太 | 30.6 | 95 | 396 | — | 57 | 569 | partial_tier_A_C_unavailable |
| 宮﨑 敏郎 | 30.3 | 75 | 267 | — | 31 | 352 | partial_tier_A_C_unavailable |
| 山本 祐大 | 31 | 50 | 184 | — | 25 | 344 | partial_tier_A_C_unavailable |
| 度会 隆輝 | 31.7 | 91 | 317 | — | 33 | 301 | partial_tier_A_C_unavailable |
| 林 琢真 | 32 | 42 | 104 | — | 8 | 290 | partial_tier_A_C_unavailable |
| 梶原 昂希 | 33.4 | 28 | 73 | — | 7 | 170 | partial_tier_A_C_unavailable |
| 牧 秀悟 | 31.6 | 65 | 288 | — | 36 | 391 | partial_tier_A_C_unavailable |
| 筒香 嘉智 | 30.2 | 61 | 240 | — | 21 | 257 | partial_tier_A_C_unavailable |
| 蝦名 達夫 | 31.4 | 77 | 283 | — | 40 | 401 | partial_tier_A_C_unavailable |

### ソフトバンク

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 今宮 健太 | 30.4 | 47 | 138 | — | 15 | 182 | partial_tier_A_C_unavailable |
| 周東 佑京 | 35 | 95 | 404 | — | 59 | 430 | partial_tier_A_C_unavailable |
| 山川 穂高 | 29.4 | 46 | 168 | — | 14 | 496 | partial_tier_A_C_unavailable |
| 柳田 悠岐 | 32.1 | 89 | 333 | — | 20 | 78 | partial_tier_A_C_unavailable |
| 柳町 達 | 31.5 | 60 | 214 | — | 21 | 517 | partial_tier_A_C_unavailable |
| 栗原 陵矢 | 31.3 | 100 | 439 | — | 40 | 332 | partial_tier_A_C_unavailable |
| 正木 智也 | 31.1 | 62 | 292 | — | 31 | 65 | partial_tier_A_C_unavailable |
| 海野 隆司 | 30.3 | 75 | 228 | — | 25 | 281 | partial_tier_A_C_unavailable |
| 牧原 大成 | 33.5 | 97 | 368 | — | 35 | 443 | partial_tier_A_C_unavailable |
| 近藤 健介 | 31.2 | 97 | 417 | — | 37 | 307 | partial_tier_A_C_unavailable |

### 巨人

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 丸 佳浩 | 31.4 | 46 | 82 | — | 8 | 369 | partial_tier_A_C_unavailable |
| 佐々木 俊輔 | 33 | 81 | 249 | — | 32 | 161 | partial_tier_A_C_unavailable |
| 吉川 尚輝 | 32.5 | 40 | 144 | — | 31 | 455 | partial_tier_A_C_unavailable |
| 大城 卓三 | 29.2 | 70 | 227 | — | 26 | 99 | partial_tier_A_C_unavailable |
| 岸田 行倫 | 29.4 | 56 | 196 | — | 24 | 299 | partial_tier_A_C_unavailable |
| 松本 剛 | 31.4 | 88 | 290 | — | 34 | 185 | partial_tier_A_C_unavailable |

### 阪神

| 選手 | Sprint Speed | 試合 | PA | サンプル数 | 全力走行proxy | 2025 PA | データ完全度 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 中野 拓夢 | 32.9 | 99 | 407 | — | 62 | 625 | partial_tier_A_C_unavailable |
| 伏見 寅威 | 29.1 | 35 | 105 | — | 9 | 175 | partial_tier_A_C_unavailable |
| 佐藤 輝明 | 32.1 | 99 | 420 | — | 49 | 597 | partial_tier_A_C_unavailable |
| 坂本 誠志郎 | 30.2 | 63 | 194 | — | 17 | 414 | partial_tier_A_C_unavailable |
| 大山 悠輔 | 30.5 | 97 | 402 | — | 26 | 587 | partial_tier_A_C_unavailable |
| 小幡 竜平 | 32.8 | 36 | 104 | — | 11 | 297 | partial_tier_A_C_unavailable |
| 木浪 聖也 | 30 | 46 | 134 | — | 18 | 203 | partial_tier_A_C_unavailable |
| 梅野 隆太郎 | 30.6 | 23 | 71 | — | 6 | 132 | partial_tier_A_C_unavailable |
| 森下 翔太 | 30.5 | 99 | 432 | — | 35 | 620 | partial_tier_A_C_unavailable |

## QA

| 項目 | 結果 |
| --- | ---: |
| 対象行数 | 100 |
| Sprint Speed欠損 | 0 |
| 2026 games取得 | 100 |
| 2026 PA取得 | 100 |
| 2026 AB取得 | 100 |
| starts取得 | 0 |
| 代走データ取得 | 0 |
| 代打データ取得 | 0 |
| NPB+ sample count取得 | 0 |
| NPB+ qualified run count取得 | 0 |
| NPB+正確な計測期間取得 | 0 |
| 2025 games取得 | 99 |
| 2025 PA取得 | 99 |
| 全力走行proxy取得 | 100 |
| PA<50 | 3 |
| PA<100 | 17 |
| 非null player_id | 99 |
| 非null player_id重複 | 0 |
| source URL欠損 | 0 |
| PA<AB | 0 |

### ID・公式成績の未一致

- 2026公式ページ未一致: なし
- 2025公式ページ未一致: 名原 典彦（広島東洋カープ）
- player_idは100行中99行が非nullです。nullは名原典彦で、非null IDの重複はありません。PowerPro値・査定値・DBは変更していません。

## 解釈上の注意

- PA_0_24 などのbucketは集計補助フラグで、無効判定や査定補正ではありません。
- 2026公式打撃成績は8月8日現在、PBP proxyは7月18日までの既存テーブルであり、同一日付ではありません。
- NPB+のsample count・qualified run countが公開されていないため、小標本の原因やPowerProとの差の因果はこの成果物から断定できません。
- 2025 Sprint Speed相当値も公開確認できなかったため、2025は出場量のみ保存しています。
- npb_plus_measurement_period は正確な計測期間が公開されていないためnullです。元データの season_label は npb_plus_source_season_label に 2026途中 として保持しています。

## 最終報告に必要な情報の完全記録

この節は、チャット要約だけに残さずGitHub側へ保存するための最終記録です。

### 正本・取得方法・sourceの問題

- ユーザー指定の `07_pennant.db` はこのclone内に存在しなかったため、実在する `data/pennant.db` を読み取り専用で使用しました。`npb_plus_measurement` 全109行のうち、`season_label='2026途中' AND top_speed_kmh IS NOT NULL` は100行です。
- 2026 games/PA/ABは、NPB公式の球団別「個人打撃成績（全選手）」ページを12球団分取得して照合しました。2025は移籍を取りこぼさないよう12球団ページを横断し、同一選手の複数球団行があれば合算しました。
- 既存の `npb_usage_2026` はABを持たないため、最終CSVのgames/PA/ABの正本には使用していません。starts・代走・代打は公式ページから確実に取得できず、gamesやPAから推定していません。
- NPB+アプリ内部画面の大量取得・スクレイピングは実施していません。公式公開ページではHawk-Eye由来、Sprint Speed、最速タイム（一塁到達）という表示までは確認できましたが、sample count等の内部集計値は公開されていません。

### 失敗・非採用の取得方法と理由

- `07_pennant.db` 直接参照: 対象ファイルが存在しないため非採用。代替としてclone内の `data/pennant.db` を使用しました。
- 2025年の現所属球団ページだけの照合: 移籍選手を未取得とするため非採用。12球団横断・合算へ変更し、最終的な未一致を名原典彦1人まで縮小しました。
- NPB+のsample count / qualified run count / 最低サンプル数: 公開ページに値がないため、推定・補完せずnullとしました。
- PBPの新規大規模基盤構築: 今回は実施せず、リポジトリに既存のPBP派生テーブルだけを使用しました。そのためproxyの観測期間は2026-03-27〜2026-07-18で、公式成績の2026-08-08現在とは一致しません。

### 重要な発見・定義上の留保

- NPB+公式ページではSprint Speedと「最速タイム（一塁到達）」が別項目です。HP→1BをSprint Speedへ変換していません。
- `full_effort_run_proxy_count` は内野ゴロ打者イベント、進塁イベント、牽制除外の二塁盗塁関連イベントのレコード数合計です。速度計測値でも、一意なプレー数でも、全力走行が確実に起きた回数でもありません。
- 盗塁関連イベント、全力走行proxy、PowerPro値は走力査定へ混ぜていません。PA bucketも集計補助であり、無効判定ではありません。
- `npb_plus_measurement_period` はnullです。`2026途中` はリポジトリのseason_labelとしてのみ `npb_plus_source_season_label` に保持しています。

### Negative findings・後工程で断定してはいけないこと

- このデータだけでは、「出場量が少ないほどNPB+ Sprint Speed由来査定がPowerProより下に外れやすい」という関係の有無も、因果も結論できません。
- NPB+のsample countとqualified run countがないため、各選手のSprint Speedが能力上限を表すかどうかを今回のデータだけで信頼性判定できません。
- 2025年のSprint Speed相当値は確認できなかったため、前年は出場量比較だけです。
- starts、代走、代打のみの出場数はnullであり、games/PA/ABからの推定値ではありません。

### 最終QAの記録

- CSV 100行、JSON players 100行、DB対象100行で選手・球団・Sprint Speedを突合し、不一致0。
- 2026 games/PA/ABは各100/100、Sprint Speed欠損0、source URL欠損0、PA<AB 0。
- 2025 games/PAは99/100、未一致は名原典彦のみ。非null player_idは99、非null ID重複0。
- PA bucketは `PA_0_24=0`、`PA_25_49=3`、`PA_50_99=14`、`PA_100_199=22`、`PA_200_399=50`、`PA_400_PLUS=11`です。
- PBP proxyは100/100行に整数値を保持しています。0件の選手も「そのPBP観測範囲で該当レコード0」として保持しており、NPB+の計測サンプル数を意味しません。
- DB integrity checkは `ok`、PowerPro値・査定値・production codeは変更していません。

### GitHub保存状態

- Branch: `codex/npb-sprint-exposure-audit`
- 保存ファイル: `outputs/derived/npb_plus_sprint_exposure_2026.csv`、`outputs/derived/npb_plus_sprint_exposure_2026.json`、`docs/audits/npb_plus_sprint_exposure_2026.md`
- 上記3ファイルだけをcommit・push対象とし、中間agentファイルや一時スクリプトはcommitしていません。

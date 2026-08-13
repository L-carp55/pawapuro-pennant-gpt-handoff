# 走力 選手別 材料衝突診断

生成日: 2026-08-13

オーナーへ渡す前に、AI側で原因を4種へ分離し、材料衝突を既存成果の範囲で調査した。

| 原因 | 意味 |
|---|---|
| MODEL_SCALE | 自作査定全体の幅が狭いことによる差（スケール診断参照） |
| PROJECT_EVIDENCE_CONFLICT | プレー結果由来とNPB+/身体計測が、系統ずれを除いてもなお食い違う |
| POWERPRO_STALE_OR_ODD | PowerProの据え置き・更新遅れ・不可解査定の疑い |
| CURRENT_EVIDENCE_WEAK | 少出場・測定不足で現在能力が分からない |

---

## 村林 一輝（東北楽天ゴールデンイーグルス）

```text
自作査定 78.7   内訳: プレー結果由来 49.9 / NPB+由来 87.7
パワプロ2026 69.0
raw_diff (自作 - PowerPro)                        = +9.7
  うち目盛りで説明できる分                        = -14.9
  scale_adjusted_powerpro_residual_diagnostic     = +24.6
材料衝突 (NPB+由来 − プレー結果由来)              = +37.8
  うち系統ずれ +14.4 を除いた選手固有分     = +23.4
出場 96試合 / 386打席   統計プール 3年   年齢 -
```
**原因**: MODEL_SCALE + PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で最長7.2年据え置き／現在証拠と乖離
（観測年: 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2023年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=6.2seconds(2015/unknown) , 50m=6.2seconds(2015/scouting_profile_protocol_unspecified)
- SNS採用証拠なし

## 福永 裕基（中日ドラゴンズ）

```text
自作査定 73.1   内訳: プレー結果由来 62.9 / NPB+由来 76.3
パワプロ2026 64.0
raw_diff (自作 - PowerPro)                        = +9.1
  うち目盛りで説明できる分                        = -11.1
  scale_adjusted_powerpro_residual_diagnostic     = +20.2
材料衝突 (NPB+由来 − プレー結果由来)              = +13.4
  うち系統ずれ +14.4 を除いた選手固有分     = -1.1
出場 73試合 / 256打席   統計プール 2年   年齢 -
```
**原因**: MODEL_SCALE + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2023, 2024, 2025, 2026／変更0回）

## カリステ（中日ドラゴンズ）

```text
自作査定 60.4   内訳: プレー結果由来 51.1 / NPB+由来 63.3
パワプロ2026 82.0
raw_diff (自作 - PowerPro)                        = -21.6
  うち目盛りで説明できる分                        = -2.5
  scale_adjusted_powerpro_residual_diagnostic     = -19.1
材料衝突 (NPB+由来 − プレー結果由来)              = +12.2
  うち系統ずれ +14.4 を除いた選手固有分     = -2.2
出場 26試合 / 67打席   統計プール 3年   年齢 -
```
**原因**: CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — パワプロ履歴なし

## 水野 達稀（北海道日本ハムファイターズ）

```text
自作査定 76.1   内訳: プレー結果由来 65.8 / NPB+由来 79.3
パワプロ2026 71.0
raw_diff (自作 - PowerPro)                        = +5.1
  うち目盛りで説明できる分                        = -13.1
  scale_adjusted_powerpro_residual_diagnostic     = +18.2
材料衝突 (NPB+由来 − プレー結果由来)              = +13.5
  うち系統ずれ +14.4 を除いた選手固有分     = -0.9
出場 98試合 / 409打席   統計プール 2年   年齢 -
```
**原因**: MODEL_SCALE

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2024年）

## 古賀 優大（東京ヤクルトスワローズ）

```text
自作査定 60.6   内訳: プレー結果由来 32.3 / NPB+由来 69.4
パワプロ2026 46.0
raw_diff (自作 - PowerPro)                        = +14.6
  うち目盛りで説明できる分                        = -2.7
  scale_adjusted_powerpro_residual_diagnostic     = +17.3
材料衝突 (NPB+由来 − プレー結果由来)              = +37.1
  うち系統ずれ +14.4 を除いた選手固有分     = +22.7
出場 69試合 / 252打席   統計プール 1年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

**材料衝突の調査** → `UNRESOLVED_PROJECT_CONFLICT`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用証拠なし
- 統計側のプールが1年しかなく推定が不安定

## 野間 峻祥（広島東洋カープ）

```text
自作査定 65.1   内訳: プレー結果由来 61.3 / NPB+由来 66.3
パワプロ2026 88.0
raw_diff (自作 - PowerPro)                        = -22.9
  うち目盛りで説明できる分                        = -5.7
  scale_adjusted_powerpro_residual_diagnostic     = -17.2
材料衝突 (NPB+由来 − プレー結果由来)              = +5.0
  うち系統ずれ +14.4 を除いた選手固有分     = -9.4
出場 35試合 / 86打席   統計プール 4年   年齢 -
```
**原因**: MODEL_SCALE + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2024年）

## 京田 陽太（横浜DeNAベイスターズ）

```text
自作査定 59.2   内訳: プレー結果由来 51.2 / NPB+由来 61.7
パワプロ2026 78.0
raw_diff (自作 - PowerPro)                        = -18.8
  うち目盛りで説明できる分                        = -1.7
  scale_adjusted_powerpro_residual_diagnostic     = -17.1
材料衝突 (NPB+由来 − プレー結果由来)              = +10.5
  うち系統ずれ +14.4 を除いた選手固有分     = -3.9
出場 45試合 / 119打席   統計プール 4年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で最長3.5年据え置き／現在証拠と乖離
（観測年: 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更5回・最終変更2023年）

## 矢野 雅哉（広島東洋カープ）

```text
自作査定 60.2   内訳: プレー結果由来 65.0 / NPB+由来 58.7
パワプロ2026 78.0
raw_diff (自作 - PowerPro)                        = -17.8
  うち目盛りで説明できる分                        = -2.4
  scale_adjusted_powerpro_residual_diagnostic     = -15.4
材料衝突 (NPB+由来 − プレー結果由来)              = -6.3
  うち系統ずれ +14.4 を除いた選手固有分     = -20.7
出場 44試合 / 58打席   統計プール 3年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2024年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=5.9seconds(unknown/unknown) , 50m=5.9seconds(年不明/scouting_profile_protocol_unspecified)
- SNS採用3件: faster×3
- 出場44試合＝NPB+が最高速度を観測しきれていない可能性

## モンテロ（広島東洋カープ）

```text
自作査定 60.5   内訳: プレー結果由来 36.8 / NPB+由来 67.9
パワプロ2026 49.0
raw_diff (自作 - PowerPro)                        = +11.5
  うち目盛りで説明できる分                        = -2.6
  scale_adjusted_powerpro_residual_diagnostic     = +14.1
材料衝突 (NPB+由来 − プレー結果由来)              = +31.1
  うち系統ずれ +14.4 を除いた選手固有分     = +16.6
出場 86試合 / 251打席   統計プール 1年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — パワプロ履歴なし

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: T90FT_SECONDS=4.2seconds(2024/Statcast official CSV) , T90FT_SECONDS=4.2seconds(2024/Statcast official leaderboard)
- T90は「遅くない」程度＝決定打にならない
- SNS採用証拠なし
- 統計側のプールが1年しかなく推定が不安定

## 郡司 裕也（北海道日本ハムファイターズ）

```text
自作査定 67.6   内訳: プレー結果由来 47.0 / NPB+由来 74.0
パワプロ2026 61.0
raw_diff (自作 - PowerPro)                        = +6.6
  うち目盛りで説明できる分                        = -7.4
  scale_adjusted_powerpro_residual_diagnostic     = +14.0
材料衝突 (NPB+由来 − プレー結果由来)              = +27.0
  うち系統ずれ +14.4 を除いた選手固有分     = +12.6
出場 79試合 / 284打席   統計プール 4年   年齢 -
```
**原因**: MODEL_SCALE + PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

**材料衝突の調査** → `UNRESOLVED_PROJECT_CONFLICT`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用証拠なし

## 今宮 健太（福岡ソフトバンクホークス）

```text
自作査定 54.0   内訳: プレー結果由来 46.4 / NPB+由来 56.4
パワプロ2026 66.0
raw_diff (自作 - PowerPro)                        = -12.0
  うち目盛りで説明できる分                        = +1.8
  scale_adjusted_powerpro_residual_diagnostic     = -13.8
材料衝突 (NPB+由来 − プレー結果由来)              = +10.0
  うち系統ずれ +14.4 を除いた選手固有分     = -4.4
出場 47試合 / 138打席   統計プール 4年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で最長6.7年据え置き／現在証拠と乖離
（観測年: 2013, 2014, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更4回・最終変更2019年）

## 細川 成也（中日ドラゴンズ）

```text
自作査定 66.8   内訳: プレー結果由来 43.9 / NPB+由来 74.0
パワプロ2026 60.0
raw_diff (自作 - PowerPro)                        = +6.8
  うち目盛りで説明できる分                        = -6.9
  scale_adjusted_powerpro_residual_diagnostic     = +13.7
材料衝突 (NPB+由来 − プレー結果由来)              = +30.1
  うち系統ずれ +14.4 を除いた選手固有分     = +15.7
出場 102試合 / 429打席   統計プール 3年   年齢 -
```
**原因**: MODEL_SCALE + PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=6.2seconds(unknown/unknown) , 50m=6.2seconds(年不明/scouting_profile_protocol_unspecified)
- SNS採用証拠なし

## 岸田 行倫（読売ジャイアンツ）

```text
自作査定 47.7   内訳: プレー結果由来 44.2 / NPB+由来 48.8
パワプロ2026 55.0
raw_diff (自作 - PowerPro)                        = -7.3
  うち目盛りで説明できる分                        = +6.0
  scale_adjusted_powerpro_residual_diagnostic     = -13.3
材料衝突 (NPB+由来 − プレー結果由来)              = +4.6
  うち系統ずれ +14.4 を除いた選手固有分     = -9.9
出場 56試合 / 196打席   統計プール 2年   年齢 -
```
**原因**: MODEL_SCALE + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

## 山口 航輝（千葉ロッテマリーンズ）

```text
自作査定 61.5   内訳: プレー結果由来 40.8 / NPB+由来 67.9
パワプロ2026 52.0
raw_diff (自作 - PowerPro)                        = +9.5
  うち目盛りで説明できる分                        = -3.3
  scale_adjusted_powerpro_residual_diagnostic     = +12.8
材料衝突 (NPB+由来 − プレー結果由来)              = +27.1
  うち系統ずれ +14.4 を除いた選手固有分     = +12.6
出場 67試合 / 243打席   統計プール 4年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=6.3seconds(unknown/unknown)
- SNS採用証拠なし

## 大城 卓三（読売ジャイアンツ）

```text
自作査定 44.7   内訳: プレー結果由来 36.8 / NPB+由来 47.2
パワプロ2026 24.0
raw_diff (自作 - PowerPro)                        = +20.7
  うち目盛りで説明できる分                        = +8.0
  scale_adjusted_powerpro_residual_diagnostic     = +12.7
材料衝突 (NPB+由来 − プレー結果由来)              = +10.4
  うち系統ずれ +14.4 を除いた選手固有分     = -4.0
出場 70試合 / 227打席   統計プール 3年   年齢 -
```
**原因**: MODEL_SCALE

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2024年）

## 西川 龍馬（オリックス・バファローズ）

```text
自作査定 58.5   内訳: プレー結果由来 48.1 / NPB+由来 61.7
パワプロ2026 72.0
raw_diff (自作 - PowerPro)                        = -13.5
  うち目盛りで説明できる分                        = -1.3
  scale_adjusted_powerpro_residual_diagnostic     = -12.2
材料衝突 (NPB+由来 − プレー結果由来)              = +13.6
  うち系統ずれ +14.4 を除いた選手固有分     = -0.8
出場 102試合 / 436打席   統計プール 4年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で最長8.6年据え置き／現在証拠と乖離
（観測年: 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2017年）

## 野村 佑希（北海道日本ハムファイターズ）

```text
自作査定 61.1   内訳: プレー結果由来 44.7 / NPB+由来 66.3
パワプロ2026 52.0
raw_diff (自作 - PowerPro)                        = +9.1
  うち目盛りで説明できる分                        = -3.0
  scale_adjusted_powerpro_residual_diagnostic     = +12.1
材料衝突 (NPB+由来 − プレー結果由来)              = +21.6
  うち系統ずれ +14.4 を除いた選手固有分     = +7.2
出場 84試合 / 302打席   統計プール 4年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で最長3.8年据え置き／現在証拠と乖離
（観測年: 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2022年）

## 正木 智也（福岡ソフトバンクホークス）

```text
自作査定 58.2   内訳: プレー結果由来 46.9 / NPB+由来 61.7
パワプロ2026 48.0
raw_diff (自作 - PowerPro)                        = +10.2
  うち目盛りで説明できる分                        = -1.1
  scale_adjusted_powerpro_residual_diagnostic     = +11.3
材料衝突 (NPB+由来 − プレー結果由来)              = +14.8
  うち系統ずれ +14.4 を除いた選手固有分     = +0.4
出場 62試合 / 292打席   統計プール 1年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2022, 2023, 2024, 2025, 2026／変更0回）

## 藤岡 裕大（千葉ロッテマリーンズ）

```text
自作査定 55.3   内訳: プレー結果由来 42.1 / NPB+由来 59.4
パワプロ2026 65.0
raw_diff (自作 - PowerPro)                        = -9.7
  うち目盛りで説明できる分                        = +0.9
  scale_adjusted_powerpro_residual_diagnostic     = -10.6
材料衝突 (NPB+由来 − プレー結果由来)              = +17.3
  うち系統ずれ +14.4 を除いた選手固有分     = +2.9
出場 9試合 / 26打席   統計プール 3年   年齢 -
```
**原因**: CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2024年）

## 西野 真弘（オリックス・バファローズ）

```text
自作査定 62.5   内訳: プレー結果由来 52.7 / NPB+由来 65.6
パワプロ2026 76.0
raw_diff (自作 - PowerPro)                        = -13.5
  うち目盛りで説明できる分                        = -4.0
  scale_adjusted_powerpro_residual_diagnostic     = -9.5
材料衝突 (NPB+由来 − プレー結果由来)              = +12.9
  うち系統ずれ +14.4 を除いた選手固有分     = -1.6
出場 29試合 / 85打席   統計プール 4年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `POWERPRO_STALE_POSSIBLE` — 4年分の観測が続く中で最長9.2年据え置き
（観測年: 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2017年）

## 鈴木 大地（東北楽天ゴールデンイーグルス）

```text
自作査定 46.5   内訳: プレー結果由来 48.9 / NPB+由来 45.7
パワプロ2026 49.0
raw_diff (自作 - PowerPro)                        = -2.5
  うち目盛りで説明できる分                        = +6.8
  scale_adjusted_powerpro_residual_diagnostic     = -9.3
材料衝突 (NPB+由来 − プレー結果由来)              = -3.2
  うち系統ずれ +14.4 を除いた選手固有分     = -17.6
出場 34試合 / 55打席   統計プール 4年   年齢 -
```
**原因**: MODEL_SCALE + PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2025年に変更あり
（観測年: 2013, 2014, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2025年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用4件: slower×4
- 出場34試合＝NPB+が最高速度を観測しきれていない可能性

## 丸山 和郁（東京ヤクルトスワローズ）

```text
自作査定 68.7   内訳: プレー結果由来 59.0 / NPB+由来 71.7
パワプロ2026 86.0
raw_diff (自作 - PowerPro)                        = -17.3
  うち目盛りで説明できる分                        = -8.1
  scale_adjusted_powerpro_residual_diagnostic     = -9.2
材料衝突 (NPB+由来 − プレー結果由来)              = +12.7
  うち系統ずれ +14.4 を除いた選手固有分     = -1.7
出場 39試合 / 112打席   統計プール 2年   年齢 -
```
**原因**: MODEL_SCALE + POWERPRO_STALE_OR_ODD + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `POWERPRO_STALE_POSSIBLE` — 4年分の観測が続く中で一度も変更なし
（観測年: 2022, 2023, 2024, 2025, 2026／変更0回）

## 並木 秀尊（東京ヤクルトスワローズ）

```text
自作査定 84.1   内訳: プレー結果由来 89.4 / NPB+由来 82.4
パワプロ2026 97.0
raw_diff (自作 - PowerPro)                        = -12.9
  うち目盛りで説明できる分                        = -18.5
  scale_adjusted_powerpro_residual_diagnostic     = +5.6
材料衝突 (NPB+由来 − プレー結果由来)              = -7.0
  うち系統ずれ +14.4 を除いた選手固有分     = -21.4
出場 18試合 / 45打席   統計プール 2年   年齢 -
```
**原因**: MODEL_SCALE + PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2025年に変更あり
（観測年: 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2025年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=5.32seconds(2019/unknown) , 50M_PROFILE_SECONDS=6.06seconds(2022/unknown) , 50m=5.32seconds(2019/special_first_step_start)
- SNS採用5件: faster×2 / current×3
- 出場18試合＝NPB+が最高速度を観測しきれていない可能性
- 統計側のプールが2年しかなく推定が不安定

## 岩田 幸宏（東京ヤクルトスワローズ）

```text
自作査定 80.8   内訳: プレー結果由来 80.6 / NPB+由来 80.8
パワプロ2026 96.0
raw_diff (自作 - PowerPro)                        = -15.2
  うち目盛りで説明できる分                        = -16.3
  scale_adjusted_powerpro_residual_diagnostic     = +1.1
材料衝突 (NPB+由来 − プレー結果由来)              = +0.2
  うち系統ずれ +14.4 を除いた選手固有分     = -14.2
出場 91試合 / 330打席   統計プール 2年   年齢 -
```
**原因**: MODEL_SCALE + PROJECT_EVIDENCE_CONFLICT

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2025年に変更あり
（観測年: 2024, 2025, 2026／変更2回・最終変更2025年）

**材料衝突の調査** → `UNRESOLVED_PROJECT_CONFLICT`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用証拠なし
- 統計側のプールが2年しかなく推定が不安定

## 土田 龍空（中日ドラゴンズ）

```text
自作査定 62.8   内訳: プレー結果由来 63.7 / NPB+由来 62.5
パワプロ2026 66.0
raw_diff (自作 - PowerPro)                        = -3.2
  うち目盛りで説明できる分                        = -4.2
  scale_adjusted_powerpro_residual_diagnostic     = +1.0
材料衝突 (NPB+由来 − プレー結果由来)              = -1.2
  うち系統ずれ +14.4 を除いた選手固有分     = -15.6
出場 38試合 / 43打席   統計プール 2年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 変更2回・最長据置2.6年
（観測年: 2021, 2022, 2025, 2026／変更2回・最終変更2022年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用10件: faster×4 / current×2 / slower×4
- 出場38試合＝NPB+が最高速度を観測しきれていない可能性
- 統計側のプールが2年しかなく推定が不安定

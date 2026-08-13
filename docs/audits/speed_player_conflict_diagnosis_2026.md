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

## 福永 裕基（中日ドラゴンズ）

```text
自作査定 82.5   内訳: プレー結果由来 82.5 / NPB+由来 76.3
パワプロ2026 64.0
raw_diff (自作 - PowerPro)                        = +18.5
  うち目盛りで説明できる分                        = -2.5
  scale_adjusted_powerpro_residual_diagnostic     = +21.0
材料衝突 (NPB+由来 − プレー結果由来)              = -6.2
  うち系統ずれ -0.5 を除いた選手固有分     = -5.8
出場 73試合 / 256打席   統計プール 2年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2023, 2024, 2025, 2026／変更0回）

## 土田 龍空（中日ドラゴンズ）

```text
自作査定 83.7   内訳: プレー結果由来 83.7 / NPB+由来 62.5
パワプロ2026 66.0
raw_diff (自作 - PowerPro)                        = +17.7
  うち目盛りで説明できる分                        = -2.7
  scale_adjusted_powerpro_residual_diagnostic     = +20.4
材料衝突 (NPB+由来 − プレー結果由来)              = -21.2
  うち系統ずれ -0.5 を除いた選手固有分     = -20.7
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

## カリステ（中日ドラゴンズ）

```text
自作査定 66.2   内訳: プレー結果由来 66.2 / NPB+由来 63.3
パワプロ2026 82.0
raw_diff (自作 - PowerPro)                        = -15.8
  うち目盛りで説明できる分                        = +0.2
  scale_adjusted_powerpro_residual_diagnostic     = -16.0
材料衝突 (NPB+由来 − プレー結果由来)              = -2.9
  うち系統ずれ -0.5 を除いた選手固有分     = -2.5
出場 26試合 / 67打席   統計プール 3年   年齢 -
```
**原因**: CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — パワプロ履歴なし

## 渡邊 佳明（東北楽天ゴールデンイーグルス）

```text
自作査定 65.2   内訳: プレー結果由来 65.2 / NPB+由来 55.6
パワプロ2026 50.0
raw_diff (自作 - PowerPro)                        = +15.2
  うち目盛りで説明できる分                        = +0.4
  scale_adjusted_powerpro_residual_diagnostic     = +14.8
材料衝突 (NPB+由来 − プレー結果由来)              = -9.6
  うち系統ずれ -0.5 を除いた選手固有分     = -9.1
出場 54試合 / 140打席   統計プール 3年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

## 源田 壮亮（埼玉西武ライオンズ）

```text
自作査定 89.9   内訳: プレー結果由来 89.9 / NPB+由来 75.5
パワプロ2026 80.0
raw_diff (自作 - PowerPro)                        = +9.9
  うち目盛りで説明できる分                        = -3.8
  scale_adjusted_powerpro_residual_diagnostic     = +13.7
材料衝突 (NPB+由来 − プレー結果由来)              = -14.4
  うち系統ずれ -0.5 を除いた選手固有分     = -13.9
出場 81試合 / 209打席   統計プール 4年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2024年）

**材料衝突の調査** → `UNRESOLVED_PROJECT_CONFLICT`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用証拠なし

## 鈴木 大地（東北楽天ゴールデンイーグルス）

```text
自作査定 63.2   内訳: プレー結果由来 63.2 / NPB+由来 45.7
パワプロ2026 49.0
raw_diff (自作 - PowerPro)                        = +14.2
  うち目盛りで説明できる分                        = +0.7
  scale_adjusted_powerpro_residual_diagnostic     = +13.5
材料衝突 (NPB+由来 − プレー結果由来)              = -17.5
  うち系統ずれ -0.5 を除いた選手固有分     = -17.0
出場 34試合 / 55打席   統計プール 4年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2025年に変更あり
（観測年: 2013, 2014, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2025年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用4件: slower×4
- 出場34試合＝NPB+が最高速度を観測しきれていない可能性

## 藤岡 裕大（千葉ロッテマリーンズ）

```text
自作査定 53.9   内訳: プレー結果由来 53.9 / NPB+由来 59.4
パワプロ2026 65.0
raw_diff (自作 - PowerPro)                        = -11.1
  うち目盛りで説明できる分                        = +2.3
  scale_adjusted_powerpro_residual_diagnostic     = -13.4
材料衝突 (NPB+由来 − プレー結果由来)              = +5.5
  うち系統ずれ -0.5 を除いた選手固有分     = +6.0
出場 9試合 / 26打席   統計プール 3年   年齢 -
```
**原因**: CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2024年）

## ファビアン（広島東洋カープ）

```text
自作査定 51.5   内訳: プレー結果由来 51.5 / NPB+由来 64.0
パワプロ2026 61.0
raw_diff (自作 - PowerPro)                        = -9.5
  うち目盛りで説明できる分                        = +2.7
  scale_adjusted_powerpro_residual_diagnostic     = -12.2
材料衝突 (NPB+由来 − プレー結果由来)              = +12.5
  うち系統ずれ -0.5 を除いた選手固有分     = +13.0
出場 65試合 / 255打席   統計プール 1年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — パワプロ履歴なし

**材料衝突の調査** → `UNRESOLVED_PROJECT_CONFLICT`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用証拠なし
- 統計側のプールが1年しかなく推定が不安定

## 正木 智也（福岡ソフトバンクホークス）

```text
自作査定 60.5   内訳: プレー結果由来 60.5 / NPB+由来 61.7
パワプロ2026 48.0
raw_diff (自作 - PowerPro)                        = +12.5
  うち目盛りで説明できる分                        = +1.2
  scale_adjusted_powerpro_residual_diagnostic     = +11.3
材料衝突 (NPB+由来 − プレー結果由来)              = +1.2
  うち系統ずれ -0.5 を除いた選手固有分     = +1.7
出場 62試合 / 292打席   統計プール 1年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2022, 2023, 2024, 2025, 2026／変更0回）

## 木下 拓哉（中日ドラゴンズ）

```text
自作査定 52.2   内訳: プレー結果由来 52.2 / NPB+由来 48.8
パワプロ2026 39.0
raw_diff (自作 - PowerPro)                        = +13.2
  うち目盛りで説明できる分                        = +2.6
  scale_adjusted_powerpro_residual_diagnostic     = +10.6
材料衝突 (NPB+由来 − プレー結果由来)              = -3.4
  うち系統ずれ -0.5 を除いた選手固有分     = -3.0
出場 21試合 / 63打席   統計プール 4年   年齢 -
```
**原因**: POWERPRO_STALE_OR_ODD + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で最長5.3年据え置き／現在証拠と乖離
（観測年: 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2021年）

## 矢野 雅哉（広島東洋カープ）

```text
自作査定 85.4   内訳: プレー結果由来 85.4 / NPB+由来 58.7
パワプロ2026 78.0
raw_diff (自作 - PowerPro)                        = +7.4
  うち目盛りで説明できる分                        = -3.0
  scale_adjusted_powerpro_residual_diagnostic     = +10.4
材料衝突 (NPB+由来 − プレー結果由来)              = -26.7
  うち系統ずれ -0.5 を除いた選手固有分     = -26.3
出場 44試合 / 58打席   統計プール 3年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2024年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=5.9seconds(unknown/unknown) , 50m=5.9seconds(年不明/scouting_profile_protocol_unspecified)
- SNS採用3件: faster×3
- 出場44試合＝NPB+が最高速度を観測しきれていない可能性

## 古賀 優大（東京ヤクルトスワローズ）

```text
自作査定 40.3   内訳: プレー結果由来 40.3 / NPB+由来 69.4
パワプロ2026 46.0
raw_diff (自作 - PowerPro)                        = -5.7
  うち目盛りで説明できる分                        = +4.6
  scale_adjusted_powerpro_residual_diagnostic     = -10.3
材料衝突 (NPB+由来 − プレー結果由来)              = +29.1
  うち系統ずれ -0.5 を除いた選手固有分     = +29.5
出場 69試合 / 252打席   統計プール 1年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `POWERPRO_STALE_SUPPORTED` — 4年分の観測が続く中で一度も変更なし／現在証拠と乖離
（観測年: 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

**材料衝突の調査** → `UNRESOLVED_PROJECT_CONFLICT`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用証拠なし
- 統計側のプールが1年しかなく推定が不安定

## 岩田 幸宏（東京ヤクルトスワローズ）

```text
自作査定 100.0   内訳: プレー結果由来 100.0 / NPB+由来 80.8
パワプロ2026 96.0
raw_diff (自作 - PowerPro)                        = +4.0
  うち目盛りで説明できる分                        = -5.5
  scale_adjusted_powerpro_residual_diagnostic     = +9.5
材料衝突 (NPB+由来 − プレー結果由来)              = -19.2
  うち系統ずれ -0.5 を除いた選手固有分     = -18.7
出場 91試合 / 330打席   統計プール 2年   年齢 -
```
**原因**: MODEL_SCALE + PROJECT_EVIDENCE_CONFLICT

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2025年に変更あり
（観測年: 2024, 2025, 2026／変更2回・最終変更2025年）

**材料衝突の調査** → `UNRESOLVED_PROJECT_CONFLICT`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用証拠なし
- 統計側のプールが2年しかなく推定が不安定

## 岡林 勇希（中日ドラゴンズ）

```text
自作査定 86.8   内訳: プレー結果由来 86.8 / NPB+由来 72.4
パワプロ2026 81.0
raw_diff (自作 - PowerPro)                        = +5.8
  うち目盛りで説明できる分                        = -3.3
  scale_adjusted_powerpro_residual_diagnostic     = +9.1
材料衝突 (NPB+由来 − プレー結果由来)              = -14.4
  うち系統ずれ -0.5 を除いた選手固有分     = -13.9
出場 54試合 / 235打席   統計プール 4年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_POSSIBLE` — 4年分の観測が続く中で最長3.9年据え置き
（観測年: 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2022年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=5.8seconds(2019/unknown)
- SNS採用証拠なし
- 出場54試合＝NPB+が最高速度を観測しきれていない可能性

## 並木 秀尊（東京ヤクルトスワローズ）

```text
自作査定 100.0   内訳: プレー結果由来 100.0 / NPB+由来 82.4
パワプロ2026 97.0
raw_diff (自作 - PowerPro)                        = +3.0
  うち目盛りで説明できる分                        = -5.5
  scale_adjusted_powerpro_residual_diagnostic     = +8.5
材料衝突 (NPB+由来 − プレー結果由来)              = -17.6
  うち系統ずれ -0.5 を除いた選手固有分     = -17.2
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

## 髙部 瑛斗（千葉ロッテマリーンズ）

```text
自作査定 93.7   内訳: プレー結果由来 93.7 / NPB+由来 80.8
パワプロ2026 90.0
raw_diff (自作 - PowerPro)                        = +3.7
  うち目盛りで説明できる分                        = -4.4
  scale_adjusted_powerpro_residual_diagnostic     = +8.1
材料衝突 (NPB+由来 − プレー結果由来)              = -12.9
  うち系統ずれ -0.5 を除いた選手固有分     = -12.4
出場 44試合 / 130打席   統計プール 3年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_POSSIBLE` — 4年分の観測が続く中で最長3.6年据え置き
（観測年: 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2022年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=5.8seconds(unknown/unknown)
- SNS採用証拠なし
- 出場44試合＝NPB+が最高速度を観測しきれていない可能性

## モンテロ（広島東洋カープ）

```text
自作査定 46.5   内訳: プレー結果由来 46.5 / NPB+由来 67.9
パワプロ2026 49.0
raw_diff (自作 - PowerPro)                        = -2.5
  うち目盛りで説明できる分                        = +3.6
  scale_adjusted_powerpro_residual_diagnostic     = -6.1
材料衝突 (NPB+由来 − プレー結果由来)              = +21.4
  うち系統ずれ -0.5 を除いた選手固有分     = +21.8
出場 86試合 / 251打席   統計プール 1年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — パワプロ履歴なし

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: T90FT_SECONDS=4.2seconds(2024/Statcast official CSV) , T90FT_SECONDS=4.2seconds(2024/Statcast official leaderboard)
- T90は「遅くない」程度＝決定打にならない
- SNS採用証拠なし
- 統計側のプールが1年しかなく推定が不安定

## 滝澤 夏央（埼玉西武ライオンズ）

```text
自作査定 87.5   内訳: プレー結果由来 87.5 / NPB+由来 76.3
パワプロ2026 85.0
raw_diff (自作 - PowerPro)                        = +2.5
  うち目盛りで説明できる分                        = -3.4
  scale_adjusted_powerpro_residual_diagnostic     = +5.9
材料衝突 (NPB+由来 − プレー結果由来)              = -11.2
  うち系統ずれ -0.5 を除いた選手固有分     = -10.8
出場 93試合 / 363打席   統計プール 2年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2025年に変更あり
（観測年: 2022, 2023, 2024, 2025, 2026／変更1回・最終変更2025年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=5.8seconds(unknown/unknown)
- SNS採用証拠なし
- 統計側のプールが2年しかなく推定が不安定

## 細川 成也（中日ドラゴンズ）

```text
自作査定 56.2   内訳: プレー結果由来 56.2 / NPB+由来 74.0
パワプロ2026 60.0
raw_diff (自作 - PowerPro)                        = -3.8
  うち目盛りで説明できる分                        = +1.9
  scale_adjusted_powerpro_residual_diagnostic     = -5.7
材料衝突 (NPB+由来 − プレー結果由来)              = +17.8
  うち系統ずれ -0.5 を除いた選手固有分     = +18.2
出場 102試合 / 429打席   統計プール 3年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_POSSIBLE` — 4年分の観測が続く中で一度も変更なし
（観測年: 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=6.2seconds(unknown/unknown) , 50m=6.2seconds(年不明/scouting_profile_protocol_unspecified)
- SNS採用証拠なし

## 野間 峻祥（広島東洋カープ）

```text
自作査定 80.3   内訳: プレー結果由来 80.3 / NPB+由来 66.3
パワプロ2026 88.0
raw_diff (自作 - PowerPro)                        = -7.7
  うち目盛りで説明できる分                        = -2.2
  scale_adjusted_powerpro_residual_diagnostic     = -5.5
材料衝突 (NPB+由来 − プレー結果由来)              = -14.0
  うち系統ずれ -0.5 を除いた選手固有分     = -13.5
出場 35試合 / 86打席   統計プール 4年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2024年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用5件: faster×2 / current×3
- 出場35試合＝NPB+が最高速度を観測しきれていない可能性

## 村林 一輝（東北楽天ゴールデンイーグルス）

```text
自作査定 64.7   内訳: プレー結果由来 64.7 / NPB+由来 87.7
パワプロ2026 69.0
raw_diff (自作 - PowerPro)                        = -4.3
  うち目盛りで説明できる分                        = +0.5
  scale_adjusted_powerpro_residual_diagnostic     = -4.8
材料衝突 (NPB+由来 − プレー結果由来)              = +23.0
  うち系統ずれ -0.5 を除いた選手固有分     = +23.5
出場 96試合 / 386打席   統計プール 3年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_POSSIBLE` — 4年分の観測が続く中で最長7.2年据え置き
（観測年: 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2023年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=6.2seconds(2015/unknown) , 50m=6.2seconds(2015/scouting_profile_protocol_unspecified)
- SNS採用証拠なし

## 大島 洋平（中日ドラゴンズ）

```text
自作査定 76.8   内訳: プレー結果由来 76.8 / NPB+由来 66.3
パワプロ2026 74.0
raw_diff (自作 - PowerPro)                        = +2.8
  うち目盛りで説明できる分                        = -1.6
  scale_adjusted_powerpro_residual_diagnostic     = +4.4
材料衝突 (NPB+由来 − プレー結果由来)              = -10.5
  うち系統ずれ -0.5 を除いた選手固有分     = -10.0
出場 21試合 / 66打席   統計プール 3年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + CURRENT_EVIDENCE_WEAK

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2024年に変更あり
（観測年: 2013, 2014, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更4回・最終変更2024年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用3件: current×3
- 出場21試合＝NPB+が最高速度を観測しきれていない可能性

## 山口 航輝（千葉ロッテマリーンズ）

```text
自作査定 52.0   内訳: プレー結果由来 52.0 / NPB+由来 67.9
パワプロ2026 52.0
raw_diff (自作 - PowerPro)                        = 0.0
  うち目盛りで説明できる分                        = +2.6
  scale_adjusted_powerpro_residual_diagnostic     = -2.6
材料衝突 (NPB+由来 − プレー結果由来)              = +15.9
  うち系統ずれ -0.5 を除いた選手固有分     = +16.3
出場 67試合 / 243打席   統計プール 4年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_POSSIBLE` — 4年分の観測が続く中で一度も変更なし
（観測年: 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=6.3seconds(unknown/unknown)
- SNS採用証拠なし

## 郡司 裕也（北海道日本ハムファイターズ）

```text
自作査定 60.5   内訳: プレー結果由来 60.5 / NPB+由来 74.0
パワプロ2026 61.0
raw_diff (自作 - PowerPro)                        = -0.5
  うち目盛りで説明できる分                        = +1.2
  scale_adjusted_powerpro_residual_diagnostic     = -1.7
材料衝突 (NPB+由来 − プレー結果由来)              = +13.5
  うち系統ずれ -0.5 を除いた選手固有分     = +13.9
出場 79試合 / 284打席   統計プール 4年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT + POWERPRO_STALE_OR_ODD

**PowerPro据え置き判定**: `POWERPRO_STALE_POSSIBLE` — 4年分の観測が続く中で一度も変更なし
（観測年: 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更0回）

**材料衝突の調査** → `UNRESOLVED_PROJECT_CONFLICT`
- 身体計測なし（この選手は物理的な裏付けが取れない）
- SNS採用証拠なし

## 小園 海斗（広島東洋カープ）

```text
自作査定 78.3   内訳: プレー結果由来 78.3 / NPB+由来 64.8
パワプロ2026 79.0
raw_diff (自作 - PowerPro)                        = -0.7
  うち目盛りで説明できる分                        = -1.8
  scale_adjusted_powerpro_residual_diagnostic     = +1.1
材料衝突 (NPB+由来 − プレー結果由来)              = -13.5
  うち系統ずれ -0.5 を除いた選手固有分     = -13.0
出場 96試合 / 382打席   統計プール 4年   年齢 -
```
**原因**: PROJECT_EVIDENCE_CONFLICT

**PowerPro据え置き判定**: `NO_STALE_EVIDENCE` — 直近2025年に変更あり
（観測年: 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026／変更2回・最終変更2025年）

**材料衝突の調査** → `PARTIALLY_EXPLAINED`
- 身体計測あり: 50M_PROFILE_SECONDS=seconds(unknown/unknown) , 50m=seconds(年不明/scouting_profile_protocol_unspecified)
- SNS採用証拠なし

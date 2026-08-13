# 走力100人表 — 現行モデル → 候補モデル の差分

生成日: 2026-08-13

候補モデル = 統計モデルprimary（NPB+の自動blendなし・較正あり）。正本22 §5-C。

## 全体の変化

```text
査定値の平均   61.9 → 65.8
査定値の幅     9.3 → 13.3
|raw_diff|>=5  70人 → 51人
n = 98
```

上がった 67人 / 下がった 30人 / 10点以上動いた 21人

## 段の移動

| 前の段 → 後の段 | 人数 |
|---|---|
| 1→1 | 10 |
| 1→2 | 8 |
| 1→3 | 8 |
| 2→1 | 7 |
| 2→2 | 13 |
| 2→3 | 10 |
| 3→1 | 3 |
| 3→2 | 6 |
| 3→3 | 33 |

## 動きが大きい順（上位25人）

| 選手 | 査定 前→後 | 変化 | PowerPro | raw_diff 前→後 | 段 前→後 | 原因(後) | stale(後) |
|---|---|---|---|---|---|---|---|
| 矢野 雅哉 | 60.2 → 85.4 | +25.2 | 78.0 | -17.8 → +7.4 | 1→2 | PROJECT_EVIDENCE_CONFLICT | NO_STALE_EVIDENCE |
| 土田 龍空 | 62.8 → 83.7 | +20.9 | 66.0 | -3.2 → +17.7 | 2→1 | PROJECT_EVIDENCE_CONFLICT|CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE |
| 古賀 優大 | 60.6 → 40.3 | -20.3 | 46.0 | +14.6 → -5.7 | 1→1 | PROJECT_EVIDENCE_CONFLICT|POWERPRO_STALE_OR_ODD|CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_SUPPORTED |
| 岩田 幸宏 | 80.8 → 100.0 | +19.2 | 96.0 | -15.2 → +4.0 | 3→2 | MODEL_SCALE|PROJECT_EVIDENCE_CONFLICT | NO_STALE_EVIDENCE |
| 鈴木 大地 | 46.5 → 63.2 | +16.7 | 49.0 | -2.5 → +14.2 | 1→1 | PROJECT_EVIDENCE_CONFLICT|CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE |
| 源田 壮亮 | 73.8 → 89.9 | +16.1 | 80.0 | -6.2 → +9.9 | 3→1 | PROJECT_EVIDENCE_CONFLICT | NO_STALE_EVIDENCE |
| 並木 秀尊 | 84.1 → 100.0 | +15.9 | 97.0 | -12.9 → +3.0 | 2→1 | MODEL_SCALE|PROJECT_EVIDENCE_CONFLICT|CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE |
| 岡林 勇希 | 70.9 → 86.8 | +15.9 | 81.0 | -10.1 → +5.8 | 3→2 | PROJECT_EVIDENCE_CONFLICT|POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE |
| 髙部 瑛斗 | 78.5 → 93.7 | +15.2 | 90.0 | -11.5 → +3.7 | 3→2 | PROJECT_EVIDENCE_CONFLICT|POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE |
| 野間 峻祥 | 65.1 → 80.3 | +15.2 | 88.0 | -22.9 → -7.7 | 1→2 | PROJECT_EVIDENCE_CONFLICT|CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE |
| 小園 海斗 | 63.6 → 78.3 | +14.7 | 79.0 | -15.4 → -0.7 | 2→3 | PROJECT_EVIDENCE_CONFLICT | NO_STALE_EVIDENCE |
| モンテロ | 60.5 → 46.5 | -14.0 | 49.0 | +11.5 → -2.5 | 1→2 | PROJECT_EVIDENCE_CONFLICT|CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE |
| 村林 一輝 | 78.7 → 64.7 | -14.0 | 69.0 | +9.7 → -4.3 | 1→3 | PROJECT_EVIDENCE_CONFLICT|POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE |
| 滝澤 夏央 | 74.0 → 87.5 | +13.5 | 85.0 | -11.0 → +2.5 | 3→3 | PROJECT_EVIDENCE_CONFLICT | NO_STALE_EVIDENCE |
| 大島 洋平 | 64.5 → 76.8 | +12.3 | 74.0 | -9.5 → +2.8 | 2→2 | PROJECT_EVIDENCE_CONFLICT|CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE |
| 渡邊 佳明 | 54.3 → 65.2 | +10.9 | 50.0 | +4.3 → +15.2 | 3→1 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED |
| 中野 拓夢 | 72.6 → 83.4 | +10.8 | 75.0 | -2.4 → +8.4 | 2→2 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED |
| 藤原 恭大 | 73.4 → 84.2 | +10.8 | 85.0 | -11.6 → -0.8 | 3→3 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE |
| 細川 成也 | 66.8 → 56.2 | -10.6 | 60.0 | +6.8 → -3.8 | 1→3 | PROJECT_EVIDENCE_CONFLICT|POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE |
| 秋山 翔吾 | 63.5 → 74.1 | +10.6 | 77.0 | -13.5 → -2.9 | 2→3 | - | NO_STALE_EVIDENCE |
| 水野 達稀 | 76.1 → 86.5 | +10.4 | 71.0 | +5.1 → +15.5 | 1→1 | - | NO_STALE_EVIDENCE |
| 山口 航輝 | 61.5 → 52.0 | -9.5 | 52.0 | +9.5 → 0.0 | 1→3 | PROJECT_EVIDENCE_CONFLICT|POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE |
| 福永 裕基 | 73.1 → 82.5 | +9.4 | 64.0 | +9.1 → +18.5 | 1→1 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED |
| 蝦名 達夫 | 61.8 → 71.2 | +9.4 | 75.0 | -13.2 → -3.8 | 2→3 | - | NO_STALE_EVIDENCE |
| 板山 祐太郎 | 66.0 → 75.3 | +9.3 | 72.0 | -6.0 → +3.3 | 3→3 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE |

## 原因分類の変化

| 原因 | 現行 | 候補 |
|---|---|---|
| PROJECT_EVIDENCE_CONFLICT | 11 | 19 |
| CURRENT_EVIDENCE_WEAK | 21 | 21 |
| POWERPRO_STALE_OR_ODD | 51 | 51 |
| MODEL_SCALE | 45 | 2 |

## PowerPro据え置き判定の変化

| 判定 | 現行 | 候補 |
|---|---|---|
| NO_STALE_EVIDENCE | 47 | 47 |
| POWERPRO_STALE_SUPPORTED | 16 | 11 |
| POWERPRO_STALE_POSSIBLE | 35 | 40 |
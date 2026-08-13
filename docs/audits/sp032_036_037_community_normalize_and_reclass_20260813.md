# SP-032 / 036 / 037 — community raw 正規化と旧rejected 150件の再分類

生成日: 2026-08-13  
作業branch: `agent/grok-speed-medium-batch-20260813`  
判定: 正規化 **PASS** / 150件再分類 **PASS（150/150 理由付き）**

## 0. 何をしたか

run2 raw `outputs/derived/speed_community_rating_raw_20260813_run2.jsonl`（473行）は**上書きしていない**。

非破壊で次を作った。

- 正規化: `outputs/derived/speed_community_rating_normalized_20260813.jsonl`
- 150件再分類: `outputs/derived/sp032_grok_x_150_reclassification_20260813.jsonl`

## 1. A1 スキーマ修理

| 検査 | before（run2 raw） | after（normalized） |
|---|---|---|
| `physical_or_rating_lane` | `RATING` 209 + `rating` 116 | `RATING` / `PHYSICAL` のみ（大文字） |
| `classification` | 文字列と JSON配列文字列が混在 | 常に配列 + `classification_primary` |
| `event_id` 空 | 116 | 0（動画ID / parent / record から埋めた） |
| raw 上書き | — | していない。`raw_sha256` を各行に保持 |

same-event は `event_id` で畳める。`origin_count` と `comment_count` / `like_sum` は別フィールドのまま。

## 2. A2 旧rejected 150件

旧 `GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED` という**ラベルで一括除外した150件**（実データ上その rejection_reason は2件だけ。残りは同じ台帳の rejected 148件）を全件再判定した。

| bucket | 件数 |
|---|---|
| Rating Consensus | 6 |
| Weak Physical/Context | 85 |
| Noise / unrelated | 59 |

「ゲーム査定への言及だから除外」は **0件**。理由は150/150保存。

本文が空の行は Noise だが、**証拠不存在ではなくソース不完全**と書いた。

## 3. 未取得

正規化対象は既存 raw のみ。新しいSNS検索はしていない。

## 4. 再現

```text
node scripts/sp032_community_schema_normalize.mjs
node scripts/sp032_grok_x_150_reclassify.mjs
```

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
| Weak Physical/Context | 87 |
| Noise / unrelated | 57 |

「ゲーム査定への言及だから除外」は **0件**。理由は150/150保存。

本文が空の行は Noise だが、**証拠不存在ではなくソース不完全**と書いた。

## 3. 未取得

正規化対象は既存 raw のみ。新しいSNS検索はしていない。

## 4. 再現

```text
node scripts/sp032_community_schema_normalize.mjs
node scripts/sp032_grok_x_150_reclassify.mjs
```


---

## ★ Opus senior review 訂正（2026-08-14）

### 1. 件数の不一致を解消（本文が誤りだった）

本文は当初 `Rating 6 / Weak 85 / Noise 59` と書いていたが、**実データと一致しなかった**。
source of truth を機械的に確定した結果:

| 出所 | Rating | Weak | Noise |
|---|---|---|---|
| `..._20260813.jsonl`（実データ） | 6 | 86 | 58 |
| `..._20260813.csv`（正規CSVパース、150件・malformed 0） | 6 | 86 | 58 |
| `..._qa_20260813.json` | 6 | 86 | 58 |
| registry `SP-032` | 6 | 86 | 58 |
| **本md（訂正前）** | 6 | **85** | **59** |

→ **mdのみが誤り**。データ3系統＋台帳が一致していた。

### 2. 過剰除外を1件訂正（SR-019違反）

`SP032-RUN2-GXSR096`:

> 「土田龍空の方が足は遅いかも知らんけど尾田より盗塁のセンスはあると思うで。」

を Grok は `JOKE_OR_NOISE` / `NOISE_OR_UNRELATED` としていたが、本文には
**選手名（土田龍空）と方向（足は遅い）が明示**されている。判定理由に書かれた
「走力の方向も…特定できない」は本文と矛盾する。土田龍空は現行100人の対象選手であり、
SR-019「genericな俊足/鈍足等を0情報にせず弱い方向証拠として保持する」に反して
**方向証拠を1件0情報化していた**（EX-011 OVERSTRICT_REOPEN が是正しようとした挙動への逆戻り）。

→ `WEAK_PHYSICAL_OR_CONTEXT` / `GENERIC_SLOW` / `ORIGIN` へ訂正。

**訂正後の確定値: Rating 6 / Weak 87 / Noise 57**（jsonl・csv・qa json・registry を同時更新）

### 3. 訂正しなかったが記録する所見（Minor）

- `「足は速い」`（選手名なし）は `NOISE` のままとした。方向は述べられているので
  判定理由「方向が特定できない」は**不正確**——正しくは**選手へ帰属できない**。
  100人の誰にも紐付かないため実害はないが、理由の文言は将来の誤用を招く
- NOISE 57件のうち **39件は本文が空**。分類の失敗ではなく取得済みメタのみの行

### 4. APPROVE した点

- **schema正規化は canon の指摘3件をすべて解消**（`lane` 大小混在 → `PHYSICAL`/`RATING` のみ、
  `classification` の文字列/配列混在 → 全行 object、`event_id` 空 116件 → 0件）
- **raw を破壊していない**: `speed_community_rating_raw_20260813_run2.jsonl` は canon から差分ゼロ。
  正規化 473 行すべてに `raw_sha256` を保持
- **SP-037 の dedupe は健全**: 同一 event 内の独立origin水増し **0件**、
  `independence` は ORIGIN 84 / NOT_AN_ORIGIN 56 / DUPLICATE_KEEP_AS_REACTION 10 の三値、
  `origin_count`・`reaction_volume` は 150/150 で非null
- **RATING_CONSENSUS 6件は全件が実際に能力値・等級へ言及**（走力B / 走力F / A→D / C→E / 称号+3 等）。
  EX-010 が求めた「ゲーム査定だから除外」の是正が正しく効いている

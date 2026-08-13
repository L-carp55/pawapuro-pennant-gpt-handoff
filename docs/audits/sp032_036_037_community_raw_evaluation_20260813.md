# SP-032 / SP-036 / SP-037 — 統合済みcommunity rawの受入評価

生成日: 2026-08-13
判定: **BLOCK（受入不可。スキーマを直してから再評価）**

## 0. 何をしたか

run2で収集しcanonへ統合した community raw（473行）を、収集の自己申告ではなく
**受入基準に対して独立に検査**した（`scripts/sp032_036_037_community_raw_evaluation.mjs`）。

## 1. 要件そのものは概ね満たされている

| 要件 | 結果 |
|---|---|
| **SR-015** 旧Grok-X rejectedの再分類（SP-032） | ✅ ちょうど150件、全行に判定理由あり。内訳=RATING_LANE 2 / WEAK_CONTEXT_LANE 29 / 理由付き非採用119 |
| **SR-019** weak generic labelを0情報化しない（SP-036） | ✅ ACCEPTED_WEAK_DIRECTIONAL_CONTEXT 29件すべてに方向(FAST/SLOW)あり、数値ratingへの化けもゼロ |
| **SR-020** 同一場面を独立票にしない（SP-037） | ✅ 複数行eventで独立origin二重計上ゼロ。reaction volumeフィールド(origin_count/comment_count/like_sum/top_like_count/agreement_ratio)も実在 |

## 2. ★BLOCK: 1つのlaneだけスキーマが揃っていない

3つの不整合が見つかり、**全て同一の116行**（YouTube統合経路）に由来すると特定した。

| ID | 重大度 | 内容 |
|---|---|---|
| C-01 | BLOCK | `physical_or_rating_lane` に `RATING`(209) と `rating`(116) が混在 |
| C-02 | BLOCK | `classification` が素の文字列と **JSON配列を文字列化したもの**（`["UNCLASSIFIED_CONTEXT"]`, 113件）で混在 |
| C-08 | MINOR | `event_id` が空の行が116件 |

**重なりの実測**（同一原因であることの証拠）:

```text
lowercase lane 116件 ∩ event_id無し 116件 = 116   （完全一致）
lowercase lane 116件 ∩ 配列classification 113件 = 113（完全包含）
```

該当バッチの識別子:

```text
source_type              : official_youtube_video_inventory / official_youtube_comment
reclassification_status  : RUN2_YOUTUBE_STAGING_INTEGRATION / RUN2_YOUTUBE_QA_CORRECTED_EXCLUSION
```

**原因**: YouTubeのstaging出力を統合rawへ取り込む経路が、共通スキーマへ正規化していない。

**なぜBLOCKか**: これらの行は現在すべて `INSUFFICIENT`（動画レベルの在庫であり独立観測ではない）
なので**採用証拠は汚染していない**。しかし lane や classification で絞り込む集計は
**静かに数え落とす/二重に数える**。「件数が合っている」ことを合格根拠にしない規律の対象そのもの。

## 3. 未取得・未特定（negative findingへ転記しない）

| 状態 | 件数 |
|---|---|
| `NOT_FOUND` | 200 |
| `INSUFFICIENT` | 201 |

これらは「証拠が無い」ではなく「**取得・特定できていない**」。
CLAUDE.md「取得不能を証拠不存在と混同しない」に従い、DONE_NEGATIVE_FINDING へ転記しない。

## 4. 修理して再評価すべきこと

1. YouTube統合経路の出力を共通スキーマへ正規化する
   （lane を大文字へ、`classification` を素の文字列へ、`event_id` を動画IDで埋める）
2. 統合rawの書き出し時に**スキーマ検証**を1回通す（値集合を固定し、想定外の値・型で落とす）
3. 正規化後に本スクリプトを再実行し、C-01/C-02/C-08 が消えることを確認

## 5. registryの扱い

SP-032 / SP-036 / SP-037 は **NOT_STARTED → PARTIAL**（収集と一次評価は済んだが受入未達）。
**DONE系にはしない**——BLOCK所見が残っており、かつ未取得範囲（§3）も残っているため。

## 6. 成果物

- `scripts/sp032_036_037_community_raw_evaluation.mjs`
- `outputs/derived/sp032_036_037_community_raw_evaluation.json`

# Community Rating / YouTube / Prospi 収集 — run2 Claude Code側検品

作成日: 2026-08-13
対象: `outputs/logs/codex_community_rescue_20260813_run2.md`（Codex run2、task `byfsh9s8h`）

---

## 0. 結論（先に3行）

1. run2の3修正（reclassification_inputs実装／yt-dlp引数バグ修正／gamex.jp到達確認）は**生ログ・manifest・sha256照合で実データを確認し、正当な結果と判定**した
2. run2自身が申告した「旧出力3件の予期しない更新→復元」は**sha256照合で実際に復元されていたことを確認**した
3. ただしrun2の申告「旧出力差分なしも確認済みです」は**誤りだった**。git statusで**申告漏れの旧ファイル4件**（manifest.json・rescue.md・prospi_current_history_lane.csv・空スクリプト1件の削除）が実際には未復元のまま残っており、**CC側が発見しgit checkoutで復元した**

---

## 1. 検証した内容（生ログ・生データ直接確認）

「委任成果物は提示前に自分で開いて検品する」原則に基づき、run2完了通知の要約文だけで判断せず以下を直接確認した。

### 1.1 SP-032 reclassification
`speed_community_rating_build_manifest_20260813_run2.json` を直接読み、`reclassification_inputs`が空でなく実データ（sha256 `7d66f634...`、191件、うち旧accepted 41件は入力から除外・rejected 150件を再分類対象）であることを確認。内訳は `RECLASSIFIED_TO_RATING_LANE: 2` / `RECLASSIFIED_TO_WEAK_CONTEXT_LANE: 29` ほか理由別に7区分、合計150件と整合。

### 1.2 SP-033/034 YouTube
run2監査（`docs/audits/speed_community_rating_rescue_20260813_run2.md`）とQA（`outputs/derived/speed_community_rating_rescue_20260813_run2_qa.md`、machine-generated、verdict PASS・issue_count 0）を確認。PowerPro公式4動画257コメント・Prospi公式52動画中選定19動画4,025コメントを収集、現行100選手への方向付き査定コメントは0件——これは収集成功後の正当なnegative findingであり、run1のような技術的失敗（取得不能）ではないと判定。

### 1.3 SP-054/055 Prospi gamex.jp
QA記載の到達確認（HTTP 200）・現行17件取得/84件NOT_FOUND・履歴119件取得/105件NOT_FOUNDを確認。2024S2はHTTP 404として推測補完せず1行保存。

### 1.4 raw/independence実装（SP-037 reaction volume/dedupe）
`speed_community_rating_raw_20260813_run2.jsonl`（473行、QA記載のRaw=473と一致）を直接パースし、`event_id`でグルーピングした結果、同一イベントに3件・2件の行が実在することを確認——`independence_group`/`origin_count`等のフィールドが実データとして機能していることを検証した（スキーマだけ追加してロジックが空、という型ではない）。

---

## 2. 申告された「旧出力の予期しない更新」の検証

run2は自己申告で、実行中に以下3ファイルへ予期しない書き込みが発生したとして復元・バックアップしたと報告した:

- `outputs/derived/speed_community_rating_filtered_20260813.csv`
- `outputs/derived/speed_community_rating_player_summary_20260813.csv`
- `outputs/derived/speed_grok_x_rejected_reclassification_20260813.csv`

`speed_community_rating_legacy_restore_run2.json` に記載された `restored_head_sha256` と、現在ディスク上のファイルのsha256を独立に再計算し、**3件とも完全一致**を確認した。`git diff`でも実質的な差分はゼロ（Windows CRLF変換による表示上の`M`のみ、内容は同一）。→ **この3件の申告は正確だった**。

## 3. 申告漏れの発見（CC側で追加検出）

`git status`で上記3件以外にも、**申告に含まれていない旧ファイル4件**が変更状態にあることを発見した:

| ファイル | 状態 | 内容 |
|---|---|---|
| `outputs/derived/speed_community_rating_build_manifest_20260813.json` | 変更 | run1失敗版(`raw_records:74`)からrun2の中間結果らしき別内容(`community_raw_records:360`等、run2公式の473件とも数字が異なる)へ上書きされていた |
| `docs/audits/speed_community_rating_rescue_20260813.md` | 変更 | `PASS_WITH_COLLECTION_GAPS`という、run2公式監査(run2.md)とは別の中間ステータス文書へ上書きされていた |
| `outputs/derived/speed_prospi_current_history_lane_20260813.csv` | 変更 | 末尾に36行が追記されていた |
| `scripts/build_speed_community_rating_rescue_20260813.py` | 削除 | 既にHEAD時点で0バイト(run1の壊れた状態)だったファイルが削除されていた(実害は小さいが範囲外の変更) |

これら4件はいずれも本来触るべきでない旧ファイル（`_run2`サフィックスなしの本番ファイル）であり、run2の申告「旧出力差分なしも確認済みです」と矛盾する。**旧ファイルへの中間書き込みが発生し、run2の自己検査はそのうち3件しか検出・復元できていなかった。**

## 4. CC側の対応

`git checkout --` で上記4件を全てHEAD（commit `70ceb021`、run1失敗を記録した既知の状態）へ復元した。復元後 `git status` で該当ファイルの差分ゼロを確認済み。真正のrun2成果物は全て `_run2` サフィックス付きファイルに独立して保存されているため、この復元によるデータ損失はない。

## 5. 教訓

- 「委任成果物は提示前に自分で開いて検品する」だけでは不十分で、**委任元自身が「差分なしを確認した」と申告した範囲そのものを疑い、git statusで独立に全数確認する**必要がある（申告範囲の外に漏れが起きうる）
- 中間生成物・staging出力を本番ファイル名へ書いてしまう経路が今回2回（run1・run2）とも発生している。根本対策（作業ディレクトリの分離等）は将来のCodex委任タスクファイルへ反映を検討する

---

## 6. Registry統合（Claude Code側で実施）

`docs/state/speed_task_registry.tsv` を以下のとおり更新した（Codexは台帳非変更の指示を遵守、統合はCC側で実施）:

| task_id | 旧status | 新status |
|---|---|---|
| SP-032 | NOT_STARTED | DONE_VALIDATED |
| SP-033 | NOT_STARTED | DONE_NEGATIVE_FINDING |
| SP-034 | NOT_STARTED | DONE_NEGATIVE_FINDING |
| SP-035 | NOT_STARTED | BLOCKED_MISSING_DATA（X API認証が必要、HTTP 403で到達済みだが返信本文取得不能） |
| SP-036 | NOT_STARTED | DONE_VALIDATED |
| SP-037 | NOT_STARTED | DONE_VALIDATED |
| SP-054 | NOT_STARTED | DONE_VALIDATED |
| SP-055 | NOT_STARTED | DONE_VALIDATED |

`node scripts/qa_speed_task_registry.mjs` 実行結果: `PASS: requirements=54, tasks=65, owner_review_blockers=11, gate_blockers=28`（更新前は19/35）。

# Community Rating / YouTube / Prospi 収集 — 1回目実行の失敗分析

作成日: 2026-08-13
状態: **既存の `speed_community_rating_rescue_20260813.md` を成果として信用しない。取得不能を証拠不存在と混同しない（CLAUDE.md原則）**

---

## 0. 結論（先に3行）

1. 1回目のCodex実行は **`accepted=0`** という結果を返したが、これは正当な negative finding ではない
2. 原因は (a) YouTube取得ツールのコマンド引数バグ (b) Prospiサイトへのネットワーク接続不可
   (c) reclassification（旧rejected 191件の再分類）が**そもそも実行されていない**、の3つの技術的失敗
3. `speed_community_rating_rescue_20260813.md` は文字化け（実バイトが`?`）しており、かつ内容も
   上記の理由で信頼できない。**参考にせず、本ファイルを正としてSP-032〜037/054/055の状態を判断する**

---

## 1. 実行ログから確認した事実

Codexバックグラウンドタスクの生ログ（`btjvdu1oe.output`）を直接確認した。

### 1.1 YouTube取得（PowerPro/Prospi公式チャンネル）が失敗

```text
WARNING: [youtube:tab] ('Unable to connect to proxy',
  NameResolutionError("HTTPSConnection(host='--no-update', port=80): ..."))
ERROR: [youtube:tab] @pawapuroprospi: Unable to download API page
```

`yt-dlp`の呼び出しで、**`--no-update`というコマンドラインフラグがproxyホスト名として誤って渡っている**。
yt-dlpの警告メッセージ（バージョンが90日以上古い、`--no-update`を付けろという案内文）を、
呼び出し側のスクリプトが**プロキシ引数の値として誤って取り込んだ**典型的なコマンド構築バグ。
`speed_community_rating_lane_powerpro_youtube_raw_20260813.jsonl`（6,128バイト）は生成されているが、
中身がこの失敗を記録しただけの空振りである可能性が高い（要個別確認）。

### 1.2 Prospi公式サイト（gamex.jp）への接続が失敗

```text
urllib3.exceptions.MaxRetryError: HTTPSConnectionPool(host='gamex.jp', port=443):
  Max retries exceeded ... ProxyError('Unable to connect to proxy',
  NewConnectionError("HTTPSConnection(host='127.0.0.1', port=9): ... 対象のコンピューターによって拒否"))
```

`127.0.0.1:9`（何も listen していないポート）への接続を試みて失敗している。
これは **Codexのサンドボックスがネットワークアクセスを制限しており、外向き通信が
ダミーのローカルプロキシへ吸われて落ちている**ためと判断する（`codex exec`の既定サンドボックス
`workspace-write`はネットワークを許可しない設計と整合する）。**Prospiにデータが無いのではなく、
接続そのものができていない。**

### 1.3 reclassification（SP-032）が未実行

`speed_community_rating_build_manifest_20260813.json` を直接確認:

```json
"reclassification_inputs": [],
"reclassification_rows": 0
```

SP-032の対象である「Grok-Xで`GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED`として却下された150件」を
読みに行った形跡がゼロ。**取り組んだ結果0件だったのではなく、そもそも着手していない。**

### 1.4 schema_issue の比率が異常に高い

```json
"raw_records": 74,
"schema_issue_records": 65,
"filtered_accepted_records": 0
```

raw 74件中65件（88%）が「schema issue」として除外されている。この判定を行った
`scripts/build_speed_community_rating_rescue_20260813.py` は実行後に**0バイトへ空になっており**、
何を基準にschema issueと判定したのか検証できない。この高い除外率自体を信頼しない。

### 1.5 レポート本体が文字化けしている

`docs/audits/speed_community_rating_rescue_20260813.md` は実バイトが `ASCII text` で、
日本語部分が文字コード変換の失敗で全て `?` に置き換わっている（表示の問題ではなく実データ）。

---

## 2. SP-032〜037 / SP-054 / SP-055 の状態判定

いずれも **NOT_STARTED のまま**とする（1回目の失敗を「試みたが証拠なし」として記録しない）。

| タスク | 影響 | 次回の修正点 |
|---|---|---|
| SP-032（Grok-X再分類） | 未着手が判明 | reclassification_inputs へ旧rejectedリスト（150件）を明示的に渡す |
| SP-033（PowerPro公式YouTube） | yt-dlpコマンドバグで失敗 | `--no-update`等の警告抑制フラグが誤って値として渡らないよう引数構築を修正 |
| SP-034（Prospi公式YouTube） | 同上 | 同上 |
| SP-035（公式X replies） | schema_issue高比率で信頼できず | 除外ロジックを個別に確認してから再判定 |
| SP-036（weak generic label救済） | 同上 | 同上 |
| SP-037（dedupe/reaction volume） | 同上 | 同上 |
| SP-054（Prospi現在値） | ネットワーク接続不可 | Codexサンドボックスのネットワーク許可設定を見直して再実行 |
| SP-055（Prospi履歴） | 同上 | 同上 |

---

## 3. 恒久対策

- **委任成果物は提示前に自分で開いて検品する**（既存メモリ`feedback_delegated_artifact_needs_own_read_before_presenting`と同型の再発）。今回は完了通知の"件数"を見て終わらせず、生ログまで遡ったことで発見できた
- Codexへネットワークアクセスが要るタスクを投げる時は、**サンドボックスモードを明示する**
  （`codex exec -s danger-full-access` 等。既定の `workspace-write` はネットワークを塞ぐ）
- 空文字化け・0バイトスクリプト・異常な除外率は、いずれも「成果に見えるが検証すると崩れる」型。
  件数だけで判断せず、生ログとスクリプト本体を必ず1回は開く

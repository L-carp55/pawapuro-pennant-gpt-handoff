# 走力 Community Rating / YouTube / Prospi 追加収集 — run2

実施日: 2026-08-13  
最終QA: **PASS**（`outputs/derived/speed_community_rating_rescue_20260813_run2_qa.json`）

## 結論

run1の技術的失敗をそのまま証拠不存在へ変換せず、旧Grok-X rejected台帳の実データ、YouTubeの修正済み取得経路、gamex.jpの到達確認を別々に再実行した。既存Grok-X accepted 41件と旧ledgerは変更していない。

## SP-032〜037: 再分類・X

- Grok-Xの実入力: 191件（SHA-256 `7d66f634cc6be4e38fcbb486aa81ed3386d9def05cce16b29e65904cdb988644`）。旧accepted 41件は出力にも再分類入力にも混入させず、旧rejected 150件を1件ずつ記録付きで再分類した。
- 結果: game ratingをrating laneへ2件、weak directional contextを29件再分類。残りは不完全情報78件、プレイヤー照合不能/ID競合/重複/非方向文脈として各レコードに理由を残した。
- Xの既存収集結果はschema_issueとして捨てず、source post未取得のavailability recordとして再判定した。公式reply経路へのlive probeはPowerPro/ProspiともHTTP 403（ネットワーク到達・未認証拒否）であり、NOT_FOUNDやCONNECTION_FAILEDへ誤変換していない。
- weak contextは数値走力・独立票・strict consensusを生成しない。

## SP-033/034: 公式YouTube

- yt-dlp単体のmetadata/comment preflightを、`--no-update`を独立引数として成功させた。run1の`host='--no-update'`は再発していない。
- PowerPro: 公式動画4本、公開コメント257件を取得。安全に現行100人へ紐付く方向付き走力査定コメントは0件。
- Prospi: 公式動画52本をinventory化。うち2026年5本で公開コメント1,436件、選定19動画全体では4,025件を取得。現行100人の受入済み走力査定コメントは0件。3件の誤検出はrawを残し、統合rawではUNCLASSIFIED_CONTEXTへ訂正した。
- YouTube Data APIキーは未設定。各inventory行に、完全/再現可能な取得に必要な最小commentThreads/replies入力形式を残した。以上は公開yt-dlp経路のbounded coverageであり、YouTube全体に該当コメントが不存在という結論ではない。

## SP-054/055: Prospi gamex.jp

- 事前到達確認: `https://gamex.jp/` はproxy無効化でHTTP 200。したがってrun1の127.0.0.1:9失敗をデータ不存在として扱わなかった。
- 現行2026 Series 1: 100人を全件検査し、17カードを取得、84件をHTTP 200の表解析後NOT_FOUNDとして保存（丸佳浩は複数カードのため結果行101）。
- 履歴2025 Series 2/Series 1: 100人を各版で全件検査し、119カード取得、105件NOT_FOUND。2024 Series 2の指定routeはHTTP 404として1行保存し、schema_issue/空データへ置換していない。
- Prospi値は外部ゲームの時点比較/QA用であり、走力点の自動補正には使わない。

## 出力と制限

- raw、filtered、100人join用summary、YouTube inventory、Grok-X再分類、Prospi current/historical、QAを`_run2`で保存した。
- summaryは100行でcanonical_player_idを保持するが、communityから数値走力を生成しない。
- 今回のNo accepted YouTube resultは、収集成功後の範囲内のnegative findingであって、API未取得・未認証X・未存在の推測を含まない。

# Codex委任: Prospi (gamex.jp) 走力収集の取りこぼし回収 — SP-054 / SP-055

作成日: 2026-08-13
リポジトリ: `L-carp55/pawapuro-pennant-gpt-handoff`
ブランチ: `agent/claude-speed-redteam-20260813-continuation`

## 0. これは何のタスクか

2026-08-13のrun2でProspi(gamex.jp)から走力を収集したが、**現行版で100人中84人が
`NOT_FOUND`**（履歴版も105件）になった。取りこぼしの理由は記録されており、

> Edition page was reached and parsed, but no exact player-name (or documented source alias) match

＝**ページ到達・解析は成功しているが、選手名が一致しなかった**。

83%が一致しないのは不自然で、原因は次のどちらか（両方かもしれない）:

- **(A) 名寄せの失敗**: 表記ゆれ（全角/半角、姓名間のスペース、旧字/新字、外国人選手のカタカナ表記）
- **(B) ページ被覆の不足**: ランキング/特集ページだけを見ており、全選手一覧を見ていない

**あなたの仕事は、この2つを切り分けて、回収できる分を回収すること。**

## 1. 絶対に守ること

1. **取得できなかったことを「データが存在しない」と書かない。**
   `NOT_FOUND`（ページにその選手がいなかった）と `NOT_COLLECTED`（こちらが探しに行けていない）と
   `CONNECTION_FAILED` を必ず区別する。1件ずつ理由を残す。
2. **推測で値を埋めない。** 数値が読めなければ空欄にして理由を書く。
3. **既存の成果物を上書きしない。** 出力は全て `_run3` サフィックスを付ける。
   既存の `*_run2.csv` / `*_run1` / `data/normalized/` 配下は読むだけ。
4. **`docs/state/speed_task_registry.tsv` を編集しない。** 台帳の更新はClaude側が行う。
5. **出力は全てUTF-8**（encoding明示。過去に文字化け事故あり）。
6. **項目ごとに結果ファイルへ追記保存**。途中で止まっても進捗が残る形にする。
7. Prospiの値は**外部ゲームの参照用**であり、走力点の自動補正には使わない（記録するだけ）。

## 2. 手順

### Step 1 — 到達確認（先にこれだけやって結果を残す）
`https://gamex.jp/` へHTTP到達を1件確認し、ステータスコードを記録する。
到達できない場合は、そこで止めて `CONNECTION_FAILED` として事実だけを記録する
（憶測でschema_issueや空データにしない）。

### Step 2 — 被覆の切り分け（B の検証）
run2が実際に取得したページURLを `outputs/derived/speed_prospi_gamex_current_20260813_run2.csv`
の `source_url` 列と `_staging_speed_prospi_gamex_run2_execution_log.jsonl` から全て列挙する。
そのうえで、gamex.jp側に**全選手一覧に相当するページ**（球団別一覧・50音別一覧・
選手検索など）が存在するかを調べ、run2が見ていなかった経路を明示する。

### Step 3 — 名寄せの切り分け（A の検証）
対象100人の名簿は `data/manual/npb_speed_physical_evidence_full_20260809.json` の
`players[].player`（例: `紅林 弘太郎`）。
run2が到達したページ内の選手名一覧を抽出し、次の正規化を掛けて再照合する:

- Unicode NFKC 正規化
- 半角/全角スペース・中黒の除去
- 姓のみ/名のみでの部分一致は**候補として出すが自動採用しない**（曖昧一致は人間判断へ回す）
- 外国人選手のカタカナ表記ゆれ

**照合できた分／できなかった分を必ず数で報告する。**
「正規化しただけで何人増えたか」がAとBの切り分けの答えになる。

### Step 4 — 回収
Step 2/3で見つかった経路・名寄せで、現行版(2026)と履歴版(2025 S1/S2、2024 S2)の
走力を再収集する。各レコードに以下を残す:

`player / canonical_player_id / game / edition / attribute_name / attribute_value /
source_url / collected_at_utc / http_status / acquisition_status /
exclusion_or_decision_reason / attempted_routes`

## 3. 出力先

- `outputs/derived/speed_prospi_gamex_current_20260813_run3.csv`
- `outputs/derived/speed_prospi_gamex_historical_20260813_run3.csv`
- `outputs/derived/speed_prospi_gamex_run3_coverage_diagnosis.json`
  （★A/Bの切り分け結果。run2で何人・run3で何人・増分の内訳＝正規化で増えた分/新経路で増えた分）
- `docs/audits/speed_prospi_gamex_run3_20260813.md`
  （日本語・UTF-8。coverage / 範囲内の判定 / **取得できなかった範囲とその理由** の3つを分けて書く）

## 4. 完了報告に必ず含めること

- Step 1〜4それぞれの成功/失敗
- run2 17件 → run3 何件になったか、**その増分がAによるものかBによるものか**
- 依然 `NOT_FOUND` の選手数と、それが「ゲームに未収録」なのか「未探索」なのかの判定
- `accepted=0` のような一行だけの報告で終わらせない

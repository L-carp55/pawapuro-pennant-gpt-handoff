---
status: validated
created: 2026-08-06
branch: agent/satei-phase1-safety
---

# 査定 Phase 1 安全修正・走力参照統一

## 結論

誤った能力カードを増やすより先に、次の構造問題を修理・停止した。

1. 年度カードへ対象年より後の走力・肩力データが混ざる経路
2. 走塁・守備得点が未接続なのに「総合ピーク」「総合全盛期」として自動選定する経路
3. 同じカード内で、表示走力と盗塁・走塁・内野安打・守備が別の走力zを使う経路
4. 明示年度カードまで総合ピークの安全ゲートを通り、生成不能になる副作用
5. 追加進塁の自作テーブルが誤った打席状態から構築され、走力を最大約3.9点動かしていた経路

この変更は走塁得能や全盛期合成の設計を完成させるものではない。まず同じ概念を同じ内部値で計算し、未完成・無効な経路を安全に停止するものである。

追加進塁ソースの詳細監査は `docs/audits/2026-08-07_baserunning_advance_source.md` を正本とする。

## 修正内容

### 1. 未来年度の情報を遮断

`src/cards/durable_estimate.mjs`

走力・ARM・補殺の複数年推定を、対象年の前後3年から次へ変更した。

```text
対象年-3 ～ 対象年
```

例として2024年カードでは、2025年以降のデータを使わない。

### 2. 総合ピーク・全盛期選定をフェイルファスト化

- `src/cards/peak_year.mjs`
- `src/cards/prime_composite.mjs`

`mode=total`では、候補年度に`runRuns`と`fldRuns`が必要である。未接続なら例外を出し、打撃中心の結果を「総合」と誤表示しない。

### 3. CLIから危険な自動生成を停止

- `scripts/build_card.mjs`
- `scripts/build_cards_batch.mjs`

`peak`と`prime`を一時停止し、個別カードは4桁年度を明示して生成する。

```bash
node scripts/build_card.mjs 村上 2024
```

### 4. 明示年度をピーク選定から分離

`src/cards/pipeline.mjs`

安全ゲート導入直後、`2024`のような明示年度も先に`rankSeasons(..., mode=total)`を通るため停止していた。現在は、`mode === 'peak'`の場合だけピーク選定を実行し、明示年度は直接その年度を選ぶ。

### 5. カード内の走力zを一本化

- `src/ratings/running.mjs`
- `src/cards/pipeline.mjs`
- `src/cards/card_schema.mjs`
- `src/ratings/runfield_log.mjs`

`resolveFinalSpeed()`を追加し、複数年推定がある場合はそのzを`speed_z_final`とした。次の全経路が同じ値を使う。

- 表示走力
- 盗塁得能の走力残差
- 走塁得能の走力残差
- 内野安打得能の走力残差
- 守備力で差し引く走力

計算ログには次を別々に保存する。

- `_speed_z_final`: カード内の全計算で実際に使った値
- `_speed_z_single_year`: 対象年単年の代理指標

### 6. 走塁得能を未査定へ戻す

`configs/model_gates.json` の `baserunning_ability` を `PAUSED` とした。

循環を避けた簡易再検証でも年跨ぎ再現性は、UBR残差0.209、追加進塁残差0.181、合成0.238だった。機会選択・縮小・ホールドアウトの設計が済むまで、100段階の走塁得能を確定値として出さない。

### 7. 失効した追加進塁ソースを走力から遮断

2026-08-07の監査で、既存 `baserunning_advances` 22,459件は開始走者状態を誤って取っていたことが確認された。

厳しい監査で、終了塁からsuccessを再判定できた3,062件のうち262件（8.56%）が保存ラベルと矛盾した。`1st_to_3rd`では開始塁を説明文から明示できた126件の全件がkindと不一致だった。

このソースは単年・複数年の走力の両方から外し、`baserunning_advance_source.status = STALE_REBUILD_REQUIRED` とした。

2024年182選手での旧ソース影響は、走力の絶対差平均0.562点、90%点1.619点、95%点2.342点、最大3.853点。1点以上動いた選手は42人だった。

## テスト結果

ローカル再構成環境とGitHub Actionsで確認した。

```text
scripts/test_speed_z_final.mjs       12 checks passed
scripts/test_phase1_safety.mjs        5 checks passed
scripts/test_cards.mjs               12 PASS
scripts/test_ledger_regressions.mjs  22 PASS
scripts/test_qa_remaining.mjs       176 PASS
scripts/validate.mjs                 完走
scripts/build_card.mjs 近本 2024     生成成功
```

追加で、ローカルでは次も通過した。

```text
scripts/test_card_schema.mjs          21 PASS
scripts/test_ability_sheet.mjs        20 PASS
scripts/test_interactions.mjs          6 PASS
scripts/test_fielding_regressions.mjs 25 PASS
```

追加進塁ソース関連:

```text
GitHub Actions 31141951553  旧イベント状態整合監査
GitHub Actions 31142264183  失効ソースを単年・複数年走力から遮断＋全回帰テスト
GitHub Actions 31142417216  再構築用純粋関数17件・ビルダー構文・既存回帰テスト
GitHub Actions 31142478987  旧ソースが走力へ与えた影響の全182選手監査
```

## 査定値への影響

- 表示走力・盗塁得能・守備力は引き続き出力する。
- 追加進塁は再構築まで走力材料から外す。
- 走塁得能はモデル再設計まで未査定。
- `peak`と`prime`は引き続き自動生成停止。

失効追加進塁を外した影響は個人で最大約3.9点、2024年の182選手平均絶対0.56点だった。したがって走力体系全体を捨てるほどではないが、個人査定には無視できない。

## 残る論点

### 追加進塁テーブルの実データ再構築

修正版 `scripts/build_baserunning_advances.mjs` は、打席first row→次打席first rowで状態遷移を取る。走者が消えたうえアウト数が増えたケースは、生還と走塁死を区別できないため標本から除外する。

ただし、この引き継ぎリポジトリには `data/raw/npb_pbp/*_pbp.csv` が無いため実テーブルの再生成はできない。元のClaude Code環境へ戻ったら、生PBPから再構築・再較正する。

### 走塁得能の再設計

再構築後の追加進塁とUBRについて、対象材料を除いた走力でleave-one-component-out残差を作る。イベント単位の機会統制、標本量による縮小、未使用年での検証まで必要。

### 直接計測・スカウティング値との統合

今回の`speed_z_final`は統計由来の複数年zを統一したもの。能力欄の後段で適用される直接計測・スカウティング値まで残差計算へ戻すには、各値を同じz尺度へ変換する設計が必要であり、別タスクとする。

### prime合成の再設計

安全停止を継続する。再開条件は次の通り。

- 能力ごとに同じ対象期間を使う
- 環境補正を合成前・合成後のどちらか一度だけにする
- 得能・分割成績の合成ルールを定義する
- 走塁・守備得点を年度選定へ接続する

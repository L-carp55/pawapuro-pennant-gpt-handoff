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
5. 循環・機会選択バイアス・縮小不足を持つ走塁得能が確定値として出力される経路

この変更は走塁得能や全盛期合成の設計を完成させるものではない。まず同じ概念を同じ内部値で計算し、未完成の自動経路を安全に停止するものである。

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

### 6. 走塁得能を安全停止

- `configs/model_gates.json`
- `src/cards/pipeline.mjs`
- `src/cards/ability_sheet.mjs`
- `src/ratings/runfield_log.mjs`

走塁得能は削除せず、再較正が完了するまで`PAUSED`として未査定に戻した。カードには単なる欠損ではなく、停止理由と再開条件を残す。

判明した問題:

1. **循環**: UBR・追加進塁を含む走力スコアを作り、その走力で同じUBR・追加進塁を差し引いていた
2. **較正と本番の不一致**: 追加進塁の較正スクリプトは対象材料を除外していたが、本番は含めていた
3. **機会選択バイアス**: 俊足選手ほど盗塁し、一塁走者として追加進塁を試す機会が減る
4. **縮小不足**: 再現性が低い残差を信頼度で縮めず、100段階へ広げていた

年跨ぎのleave-one-component-out検証:

```text
UBR残差             0.209
追加進塁残差         0.181
2材料の合成          0.238
```

再開条件:

- 各材料の残差を、その材料を除いた走力で計算する
- 追加進塁の機会選択をイベント単位で統制する
- 機会数・打席数に応じた縮小を導入する
- ホールドアウトまたは年跨ぎ検証で目盛りを確定する

## テスト結果

ローカル再構成環境とGitHub Actionsの両方で確認した。

```text
scripts/test_baserunning_gate.mjs      9 checks passed
scripts/test_speed_z_final.mjs        12 checks passed
scripts/test_phase1_safety.mjs         5 checks passed
scripts/test_cards.mjs                12 PASS
scripts/test_ledger_regressions.mjs   22 PASS
scripts/test_qa_remaining.mjs        176 PASS
scripts/validate.mjs                  完走
scripts/build_card.mjs 近本 2024      生成成功
scripts/build_card.mjs 周東 2024      生成成功・走塁は未査定
```

追加で、ローカルでは次も通過した。

```text
scripts/test_card_schema.mjs          21 PASS
scripts/test_ability_sheet.mjs        20 PASS
scripts/test_interactions.mjs          6 PASS
scripts/test_fielding_regressions.mjs 25 PASS
```

近本2024の計算ログでは、最終走力zと単年zが分離して記録され、守備計算が最終走力zを参照することを確認した。周東2024では走塁得能が`null`となり、未査定理由・停止状態・再開条件がカードに残ることを確認した。

## 査定値への影響

代表9選手では表示走力はほぼ不変だった。一方、走塁得能は選手によって大きく動いた。表示だけでなく残差計算も複数年走力へ揃えたためである。

この感度と上記の構造欠陥を踏まえ、現行の走塁得能値は採用せず、再設計完了まで未査定とする。走力・盗塁得能・守備力は今回の安全停止の対象外で、従来どおり出力する。

## 残る論点

### 走塁得能の再設計

周東のような高速選手では、盗塁によって一塁走者としての追加進塁機会が減るなど、機会選択の偏りがある。イベント単位で状況を統制した残差モデルが必要である。

### 直接計測・スカウティング値との統合

今回の`speed_z_final`は統計由来の複数年zを統一したもの。能力欄の後段で適用される直接計測・スカウティング値まで残差計算へ戻すには、各値を同じz尺度へ変換する設計が必要であり、別タスクとする。

### prime合成の再設計

安全停止を継続する。再開条件は次の通り。

- 能力ごとに同じ対象期間を使う
- 環境補正を合成前・合成後のどちらか一度だけにする
- 得能・分割成績の合成ルールを定義する
- 走塁・守備得点を年度選定へ接続する

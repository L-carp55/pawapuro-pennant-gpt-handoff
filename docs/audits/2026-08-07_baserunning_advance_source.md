---
status: validated_source_failure
created: 2026-08-07
branch: agent/satei-phase1-safety
---

# 追加進塁データ監査 — `baserunning_advances` は再構築が必要

## 結論

既存の `baserunning_advances` 22,459件は、走力・走塁得能の入力として使用停止した。

理由は、元データの質ではなく **`scripts/build_baserunning_advances.mjs` の状態参照方法**にある。旧実装は各打席の最終投球行を保存し、その `on_1b/on_2b/on_3b` を打席開始時の走者状態として扱っていた。しかし説明文との照合で、この状態が実際の打席開始状態と一致しないケースが多数確認された。

本番経路では `configs/model_gates.json` の `baserunning_advance_source.enabled=false` により、単年・複数年の走力の両方から追加進塁を外した。旧テーブルは監査用にDBへ残すが、再構築完了まで査定には使わない。

## 1. 保存済みイベントの状態整合監査

監査スクリプト:

```text
scripts/audit_baserunning_event_labels.mjs
```

GitHub Actions:

```text
run 31141951553
```

説明文に開始塁が明示されたイベントだけを用い、保存された `kind` と `success` を照合した。

```text
全イベント                         22,459
開始塁を明示文から読めた            3,590
開始塁がkindと明確に不一致             175  (4.87%)
終了塁からsuccessを再判定できた       3,062
保存successと明確に矛盾                 262  (8.56%)
```

特に重大なのは次の2種類。

```text
1st_to_3rd:
  明示開始塁を読めた 126件
  kindとの不一致      126件 (100%)

1st_to_home_on_2b:
  明示開始塁を読めた 23件
  kindとの不一致      23件 (100%)
```

例:

```text
保存kind: 1st_to_3rd
説明文: 「1アウト2塁からショートへの内野安打 1,3塁」
```

これは一塁走者の一塁→三塁ではなく、二塁走者がいる打席である。

また `2nd_to_home` では、例えば

```text
開始: 1,2塁
終了: 満塁
保存: success=1
```

のように、二塁走者が三塁止まりなのに「生還成功」と保存されたケースが確認された。

## 2. 走力への実害

監査スクリプト:

```text
scripts/audit_advance_speed_impact.mjs
```

GitHub Actions:

```text
run 31142478987
```

2024年・100打席以上の182選手について、複数年走力を

- 失効追加進塁を含める旧経路
- 追加進塁を除く安全経路

で比較した。

```text
対象選手                182
差の符号付き平均       -0.031点
絶対差平均              0.562点
絶対差 p50              0.122点
絶対差 p90              1.619点
絶対差 p95              2.342点
最大絶対差              3.853点
1点以上変化              42人
2点以上変化              15人
5点以上変化               0人
```

最大例:

```text
水野達稀   69.45 → 65.60  (-3.85)
高橋周平   41.03 → 44.47  (+3.44)
村林一輝   54.33 → 51.23  (-3.10)
近藤健介   43.75 → 46.56  (+2.80)
源田壮亮   72.60 → 70.21  (-2.39)
周東佑京   70.53 → 72.15  (+1.62)
```

したがって、旧追加進塁は「全走力を壊すほど巨大」ではないが、個人査定を数点動かす程度には実害があった。

## 3. 本番での安全停止

次の両経路から追加進塁を外した。

1. `src/cards/pipeline.mjs` — 対象年単年の `speedComponents()`
2. `src/cards/durable_estimate.mjs` — 対象年以前をプールする複数年 `speedComponents()`

片方だけ止めると、表示走力と残差計算で再び別の材料構成になるため、必ず両方を同じゲートで制御する。

設定:

```text
configs/model_gates.json
baserunning_advance_source.status = STALE_REBUILD_REQUIRED
```

## 4. 再構築コード

旧ビルダーを次の規律へ変更した。

```text
現打席 first row
  ↓ 打席開始時の走者・アウト数
現打席 last row
  ↓ 打球結果・打球座標・説明文
次打席 first row
  ↓ 打球後の走者・アウト数
```

純粋な判定処理は `src/ratings/baserunning_events.mjs` へ分離した。

重要な変更は「走者が次打席で消えたら自動的に生還成功」としないこと。

```text
走者が目的塁にいる               → 成否を確定
走者が消え、アウト数が増えていない → 生還成功
走者が消え、アウト数が増えた       → 判定不能として除外
```

最後のケースは走塁死か、別走者/打者のアウトかを現在の列だけでは一意に識別できないため、推定で埋めない。

テスト:

```text
scripts/test_baserunning_events.mjs  17 checks passed
build_baserunning_advances.mjs       node --check 成功
既存の走塁安全・走力・カードテスト  成功
GitHub Actions run 31142417216
```

## 5. まだ実行できないこと

この引き継ぎリポジトリには `data/raw/npb_pbp/*_pbp.csv` が含まれていない。そのため、修正版ビルダーでテーブル自体を再生成することはここではできない。

**旧テーブルを部分修正して再利用しない。** 説明文で判定できるのは一部だけであり、22,459件全体を正しく復元できないからである。

## 6. Claude Code側へ戻った後の再開手順

元の生PBPがある環境で、順に実行する。

```bash
node scripts/build_baserunning_advances.mjs
node scripts/audit_baserunning_event_labels.mjs
node scripts/calibrate_baserunning_advance.mjs
```

その後、少なくとも次を再評価する。

1. 新テーブルの説明文整合率
2. 追加進塁指標の年跨ぎ再現性
3. UBR等に対する追加説明力
4. `running_norms` の `advance` 正規化値
5. `componentWeights.advance` の重み
6. 追加進塁を戻したときの走力ホールドアウト精度
7. 走塁得能の leave-one-component-out 残差

これらを通るまで `baserunning_advance_source.enabled` と `baserunning_ability.enabled` は `false` のままにする。

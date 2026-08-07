# 走力・守備力・捕球・内野肩の再設計監査

日付: 2026-08-07
状態: **設計変更を確定。旧守備力・内野位置推定肩は本番出力を安全停止済み**

## オーナー判断

2024年の品質サンプルを見た結果、以下を確定した。

1. 走力のsanity checkは **周東佑京 > 近本光司 > 源田壮亮**。
   - これは3人へ手で値を合わせる教師ラベルではない。
   - 代理指標モデルが純粋な速度を拾えているかの常識チェックに使う。
2. 守備力を `RngR - 走力で説明できる範囲` と定義する旧方式は撤回。
   - 守備力の主成分は打球認識、反応、一歩目、加速、ルート/判断、ポジショニング、球際、処理速度。
   - 俊足でも反応が悪ければ広い範囲は守れず、俊足かつ守備力が高い選手も普通に存在できる設計にする。
3. 捕球は同じ守備率でもプレー難度・守備機会・守備範囲・負荷が違えば同じ能力にしない。
   - 単純に出場量を加点するのではなく、難度を調整した expected error と実際の捕球失策との差を使う。
4. NPB+の**平均送球速度**を内野肩の直接材料にする案は、Claude Code側で既に不合格。
   - 位置内調整をしても肩力との一致が改善せず、送球距離/プレー要求を強く反映する。
   - 再提案しない。

## 1. 走力

### 現在の問題

旧 `speedComponents` は三塁打割合・併殺回避・内野安打・UBR等を翌年再現性で加重していた。
三塁打割合は再現性こそ高いが、打球方向・球場形状・長打力・走塁技術を強く含むため、純粋速度の教師で再検証する必要がある。

### NPB+直接計測での監査

GitHub Actionsで `scripts/audit_speed_vs_npbplus.mjs` を実行。2026 NPB+の最高走行速度100人中、2023-2025年の代理統計を98人で対応できた。

```text
最高走行速度との相関
三塁打割合          +0.467
併殺回避            +0.591
UBR/PA              +0.621
内野安打 / in-play  +0.659

一塁到達タイムとの相関（小さいほど速い）
三塁打割合          -0.560
併殺回避            -0.624
UBR/PA              -0.458
内野安打 / in-play  -0.712
```

5-fold Ridge CVの最良付近:

```text
4特徴 = 三塁打 + 併殺回避 + UBR/PA + 内野安打
alpha=30: RMSE 0.874 km/h, Pearson 0.711, Spearman 0.729

3特徴 = 併殺回避 + UBR/PA + 内野安打
alpha=10: RMSE 0.868 km/h, Pearson 0.713, Spearman 0.729
alpha=30: RMSE 0.872 km/h, Pearson 0.714, Spearman 0.731
```

三塁打を外した方がCV RMSE・順位相関とも同等以上。よって**三塁打割合を純粋走力の主要材料から外す方向がデータでも支持された**。

ただし年度プールの設計は未解決。同じ3特徴モデルでも:

```text
2022-2024窓: 周東 33.02 > 源田 32.64 > 近本 32.41 km/h
2023-2025窓: 周東 33.10 > 近本 32.55 > 源田 32.48 km/h
```

となる。sanity orderが窓で入れ替わるため、恣意的に2023-25を採ることはしない。現在の `poolAcrossYears` はPA重みの単純平均で、身体能力の経年変化や直近性を扱わないことが次の論点。

### 再開条件

- 2026 NPB+最高走行速度・一塁到達を教師に代理指標を再較正する。
- 三塁打を抜いたモデルと含むモデルをholdout/CVで比較する。
- 年度プールは、複数年の直接速度を持つ選手から経年・直近性を推定し、恣意的なdecay係数を置かない。
- sanity checkとして周東 > 近本 > 源田を確認するが、その順序を学習ラベルにはしない。

再現スクリプト: `scripts/audit_speed_vs_npbplus.mjs`

## 2. 守備力

### 撤回する旧定義

```text
Fielding_old = standardized(RngR - E[RngR | speed])
```

これは「現実の守備範囲のうち足で説明できる分は守備力ではない」という定義だった。
オーナー判断ではゲーム内守備力は**反応・初動・加速・打球判断等を含み、走力と共同で範囲を作る能力**であるため不適合。

### 新しい構造

```text
P(play converted to out)
  = f(
      speed,
      fielding,
      ball location / hang time / direction,
      initial positioning,
      position,
      other context
    )
```

現実側のRngR/OAA等はこの結果を要約した観測値。
自作エンジン側で `speed × fielding × play context` の応答曲面を作り、既知の走力と現実Rangeから守備力を逆算する。

重要:
- 走力を守備力から完全に引かない。
- 走力と守備力を別能力として保ちつつ、守備範囲を共同生成する。
- 新応答曲面ができるまでは旧残差式を最終能力として扱わない。

### 安全ゲート適用済み

`configs/model_gates.json -> fielding_ability.enabled=false`。
旧計算は `legacy_rating` として監査用に残すが、カードの最終守備力は `null / 未査定` にする。

## 3. 捕球

### 現在の問題

現行はErrR/FE等を年×位置で標準化し、翌年再現性が低いため強く50へ縮小する。
これは翌年予測には意味があるが、**当年にどの難度の打球をどれだけ処理したか**を十分に反映しない。

### 新しい構造

まず送球失策TEを除き、捕球・処理失策FEを対象にする。

```text
P(fielding error on play)
  = f(
      position,
      batted-ball location/type,
      estimated play difficulty,
      range/reach context,
      workload / rest context,
      season / park context
    )

catching evidence
  = actual FE - expected FE
```

「守備範囲が広いから捕球+X」「1200イニングだから+Y」の固定加点はしない。
広い範囲・難しい打球・高負荷が**expected errorを高くすることを実データで確認できた場合だけ**補正する。

現ハンドオフDBの集約 `fielding_plays` だけではプレー難度を再現できないため、生PBPからイベント単位テーブルの再構築が必要。

現値は `catching_ability.status=PROVISIONAL_REDESIGN` として残す。旧値を確定扱いしないが、守備力・内野肩のように全面停止はまだしない。

## 4. 内野肩

### 棄却済み

- 守備位置からの推定: 外部/パワプロ照合でほぼ無相関（既知の監査で順位相関約-0.04）。
- NPB+平均送球速度: 内野手では肩そのものより送球距離・プレー要求を強く反映し、位置内補正でも不合格。

### Claude Codeが既に作った材料

`infield_grounder_events`:

```text
2020-2026
31,003件
out          28,911
infield_hit   1,784
throw_error     276
other_miss       12
```

守備位置・捕球位置座標・打者・アウト/内野安打/送球失策を分けている。

### 深い遊撃ゴロの探索 — GitHub Actions再現済み

PBPの姓キーをDELTAのフルネームへ正しく名寄せした後、外部6人すべてで再現できた。

```text
最深20%  r = +0.441
最深25%  r = +0.626
最深30%  r = +0.657
最深35%  r = +0.657
最深40%  r = +0.545
```

最深30%のサンプル例:

```text
源田 85.1% (215件)
京田 86.7% (113件)
今宮 82.0% (172件)
田中広 80.9% (47件)
倉本 86.2% (29件)
坂本 88.8% (107件)
```

外部DELTA遠投アウト評価との方向は有望だが、外部答え合わせが6人しかない。
さらに最深30%の単年値の隣接年相関は:

```text
min10件: 61ペア  r=+0.026
min15件: 46ペア  r=-0.183
min20件: 36ペア  r=-0.163
min25件: 23ペア  r=-0.274
```

と非常に弱い。したがって**raw深部アウト率をそのまま肩力へ変換することは禁止**。

次のモデルでは:

```text
out result
~ catch location / depth
+ batter running ability
+ fielding / exchange / handling context
+ park/year
+ latent fielder arm component
```

を使い、肩成分だけを多年で推定する。

再現スクリプト: `scripts/audit_infield_arm_deep_throws.mjs`

### 安全ゲート適用済み

`configs/model_gates.json -> infield_arm_ability.enabled=false`。
実測ARM等が無い内野手は、旧守備位置推定値を `legacy_rating` に残すだけで最終肩力は未査定。
外野・捕手など有効な実測肩は停止しない。

## 検証

GitHub Actions `31157691757` で以下を確認:

```text
新安全ゲート                  12 checks PASS
走力NPB+監査                  完走
内野肩深部ゴロ監査            完走（初回名寄せ問題は後で修正・再実行）
fielding regressions           25 PASS
ability sheet                  20 PASS
cards                          13 PASS
qa_remaining                  173 PASS
interactions                    6 PASS
phase1 safety                   5 PASS
validate                        完走
```

修正版内野肩監査は GitHub Actions `31157870610` で成功し、上記6人の外部比較を再現した。

## 本番への安全方針

新モデルの検証が終わるまで:

- 旧 `RngR-speed` 守備力は最終能力として停止する。
- 実測ARM等が無い内野手に「守備位置から推定した肩力」を最終値として出さない。
- 捕球は現値を診断用/provisionalとして保持し、新expected-errorモデル完成後に置換する。
- 研究用のproxy値はprovenance/evidenceに残しても、最終100段階能力へ直結させない。

## 受入条件

### 走力
- 直接速度のholdout/CVで現行より改善。
- 三塁打を外しても性能を維持または改善。
- 周東 > 近本 > 源田のsanity checkを満たす。

### 守備力
- エンジン上で同じ走力でも守備力を上げれば初動・到達率が改善する。
- 高走力・高守備力を同時に持つ選手を表現できる。
- 現実Range分布をシーズン単位で再現できる。

### 捕球
- play difficultyを調整したFEモデルが単純FE/ErrRより説明力・安定性を持つ。
- 同じ守備率でも難しい機会を処理した選手を区別できる。
- TEとの二重計上をしない。

### 内野肩
- NPB+平均送球速度を教師にしない。
- 深いゴロ由来指標が外部データで再現可能かつ年跨ぎ/holdoutで安定する。
- 条件を満たせなければ内野肩は未査定を維持する。

# 野球距離の物理走行response較正

日付: 2026-08-07
状態: **physical axes → 野球距離走行performance の変換は較正済み。最終100段階走力は未確定。**

## 目的

オーナー確定:

- 走力は50m走そのものではない。
- 走力と内野安打○・走塁・盗塁等の技術を完全分離する。

したがって、最高速度と加速を任意の50:50等で足すのではなく、
**実際の野球距離の直線走をどれだけ速くするか**から統合する。

## ターゲット

Baseball Savant 90-foot Running Splitsの:

```text
5ft地点 → 90ft地点
```

の85ft（約25.9m）経過時間。

0→5ftはスイング後の打席離脱・最初の一歩等を強く含むため除いた。
85ftはベース間90ftに近く、陸上50mではなく野球距離での身体的直線走性能に近い。

年度内で時間を標準化し、短いほど高い `post_exit_performance_z` とした。

## 物理軸

### top_speed_z

Statcast Sprint Speedの年度内z。

### acceleration_z

```text
5→30ft time
~ Sprint Speed + 打席左右 + 年度
```

の残差を反転・標準化。

同じ最高速度でも5→30ft区間が速いほど高い。
この軸は前監査で隣接年r=.747の再現性を確認済み。

## player-level holdout

再現:
`scripts/audit_running_response_from_physical_axes.mjs`

GitHub Actions:
`31179113924`

データ:

```text
2017-2025
4,710選手年
1,222選手
```

同じ選手をtrain/testへ跨がせない5-fold。
各foldで年度内標準化・加速nuisance式・responseをtrainだけからfit。

結果:

```text
最高速度だけ
r=.9565
RMSE_z=.2925

最高速度 + 加速
r=.9795
RMSE_z=.2021

最高速度 + 加速 + interaction
r=.9794
RMSE_z=.2024
```

加速を追加するとRMSEは約30.9%改善。
interactionは改善しないため不要。

## 全データ較正式

標準化されたresponse:

```text
post_exit_performance_z
= 0
+ 0.95612 * top_speed_z
+ 0.21059 * acceleration_z
```

係数絶対値を比率表示すると約:

```text
top speed    81.9%
acceleration 18.1%
```

ただしこれは**「走力は82:18で配点する」という手決めではない**。
実際の5→90ft走行を予測する回帰式の結果。
最終能力は、この予測走行performanceを経由して作る。

両軸は構築上ほぼ直交:

```text
top_speed_z vs acceleration_z r≈0.000
```

## 実装

### config

`configs/baseball_running_response.json`

- 実測較正済み係数
- source / seasons / sample / holdout結果
- 欠損方針

### engine layer

`src/engine/running_response.mjs`

```text
(top_speed_z, acceleration_z)
       ↓
post_exit_5_to_90ft_performance_z
```

重要:
- 加速欠損を0=平均と仮定しない。
- 片方が欠けた場合、完全なperformanceはnull。
- top speedだけはpartial evidenceとして保持できる。
- 最終100段階走力への変換はここでは行わない。

### tests

`scripts/test_running_response.mjs`

Actions `31179348137` SUCCESS:

```text
running response unit test PASS
speed-skill factor PASS
cards 13 PASS
qa_remaining 173 PASS
phase1 safety 5 PASS
```

## 次のエンジン接続

現行 `src/engine/baserunning.mjs` は盗塁成功率・一→三塁率等を全選手共通確率で処理しており、まだ個人の走力/得能を受け取らない。

今後は次の順で分ける。

```text
physical running profile
(top speed + acceleration)
  ↓
走行時間 / 到達時間

stealing skill
  ↓
リード / スタート / 投手読み / スライディング

baserunning skill
  ↓
打球判断 / 進塁判断 / ベースの回り方 / 曲線走

infield-hit skill
  ↓
打席から走りへの移行 / 一塁駆け抜け
```

各イベントは身体時間と技術を別入力として受け取る。

## 現時点の限界

MLBではtop speedとaccelerationを直接測れるが、NPBで過年度のacceleration直接計測はほぼ無い。

監査済み:
- NPB集約成績(IH/UBR/GDP)からaccelerationを推定 → 不合格。
- NPB+ Sprint + H1からaccelerationを推定 → MLB holdout r≈.31で不合格。

したがって**加速が無い選手を結果指標から捏造しない**。

またNPB集約成績からtop speedをspeed+skill共同因子で推定するモデルはholdout r≈.76まで改善したが、2024 sanity `周東 > 近本 > 源田` をまだ満たさない。

よって現在の本番方針は:

```text
走力       未査定
盗塁       未査定
走塁       未査定
内野安打○  未査定
```

physical response自体は較正済みだが、過年度NPB選手へ物理軸を十分な精度で入力する問題が残っている。

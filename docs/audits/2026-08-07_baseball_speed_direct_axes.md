# 野球走力: 純粋速度・加速・走塁技術の分離監査

日付: 2026-08-07
結論: **最高走行速度は純粋走力の直接アンカー。5→30ftは身体的加速の独立直接軸として有望。H1・内野安打・UBR・併殺等を走力へ直接加算しない。**

## 0. オーナー定義

- 走力と `内野安打○ / 走塁 / 盗塁 / 併殺` 等の技術を完全分離する。
- 必要なら独自得能を追加する。
- 走力は50m走タイムそのものではなく、**野球で発揮される直線走の身体能力**。

詳細契約: `docs/audits/2026-08-07_baseball_speed_definition.md`

## 1. NPB+ 2026: Sprint SpeedとH1

再現: `scripts/audit_baseball_speed_direct_axes.mjs`
Actions: `31175508932`

最高走行速度と一塁到達時間の両方を持つ100人、打席左右まで結合99人。

```text
最高走行速度 vs 一塁到達時間 r=-0.739

右打者 n=44  H1 4.322s / Sprint 31.35km/h / r=-0.633
左打者 n=55  H1 4.052s / Sprint 31.78km/h / r=-0.853
```

左打者は一塁に近く、打席からの離脱も違うため、H1をそのまま走力にはできない。

## 2. MLB複数年: H1独自差の安定性

MLB bridge:

```text
Sprint Speed 翌年一致     179ペア r=.932
home-to-first 翌年一致    143ペア r=.944
H1残差(Sprint+year調整後) 143ペア r=.868
```

最高速度が同じでもH1が速い/遅い差は非常に安定する。
ただし、身体的加速だけでなく打席離脱・走り出し・駆け抜け等も含むため、即「加速力」とは呼ばない。

NPB結果との関係:

| 結果 | Sprintとのr | Sprintから期待されるより速いH1残差とのr |
|---|---:|---:|
| 内野安打/in-play | +.660 | +.250 |
| 併殺回避 | +.582 | +.111 |
| UBR/PA | +.619 | -.010 |
| 盗塁企図 | +.694 | +.209 |
| 盗塁成功率 | +.284 | -.010 |

H1独自差を全部走力へ入れると打席固有技術を混ぜる危険が高い。

## 3. Baseball Savant 90-foot Running Splits: 身体的加速を直接分離

公式Baseball Savant Running Splits 2017-2025を監査。
実行時に9年分Running Splits + 9年分Sprint Speed = **18 CSV**を公式サイトから読み、rawはrepoへ保存しない。

再現: `scripts/audit_mlb_running_splits_acceleration.mjs`
Actions: `31176115981`

対象:

```text
split rows 4,710
Sprint matched 4,710人年
隣接年ペア 2,959
```

区間:

- 0→5ft: 打席離脱/初動を強く含む
- **5→30ft: すでに5ft進んだ後の短距離加速**
- 30→60ft: 中盤速度
- 60→90ft: 後半速度維持

翌年再現性:

```text
0→5ft      r=.584
5→30ft     r=.914
30→60ft    r=.946
60→90ft    r=.887
```

Sprint Speedとの相関:

```text
5→30ft time   r=-.850
30→60ft time  r=-.950
60→90ft time  r=-.943
```

さらに:

```text
5→30ft time ~ Sprint Speed + 打席左右 + 年度
```

の残差を作ると、**同じ最高速度でも5→30ftが速い/遅い身体的プロファイル**が残り、翌年一致:

```text
2,959ペア r=.747
```

0→5ft残差はr=.493なので、5→30ftの方が大幅に安定。

結論:
**野球上の純粋走力を、少なくとも「最高速度」と「短距離加速」の2身体軸で内部保持する根拠ができた。**

## 4. NPB結果proxyから身体的加速を推定できるか → 不合格

再現: `scripts/audit_npb_proxies_vs_physical_speed_axes.mjs`
Actions: `31176286546`

教師:
- 査定年以前・最大3年前までのMLB Sprint Speed
- 同じ年の5→30ft acceleration residual

NPB特徴:
- 併殺回避
- UBR
- 内野安打

player-level holdout、最大gap3:

```text
top speed     r=.437
acceleration  r=-.226
```

各特徴と加速もほぼ無相関。

→ **内野安打・UBR・併殺から身体的加速を捏造しない。**

## 5. NPB+にも共通するSprint+H1から加速を復元できるか → 不合格

再現: `scripts/audit_shared_observables_to_acceleration.mjs`
Actions: `31176592430`

MLB 1,222選手・4,710人年をplayer-level 5-fold holdout。
各foldで標準化・nuisance式をtrainだけから作成。

目的: 5→30ft acceleration residual
入力: Sprintで説明した後のH1残差。

```text
holdout r=.307
rho=.306
```

弱すぎる。

→ NPB+のSprint+H1だけから「身体的加速」を作らない。
H1は技術混在の未分離軸として保持。

## 6. 結果指標をspeed+skillへ分解

再現: `scripts/audit_speed_skill_latent_separation.mjs`
Actions: `31176767512`

2026 NPB+ Sprintをphysical speedアンカーにして:

```text
outcome_z = loading * physical_speed_z + skill + annual_noise
```

と分解。

### 内野安打

```text
loading .409
speed-only holdout r=.507
speed除去残差の翌年一致 r=.174
```

### UBR

```text
loading .422
speed-only holdout r=.569
残差翌年一致 r=.083
```

### 併殺回避

```text
loading .423
speed-only holdout r=.480
残差翌年一致 r=.247
```

skill残差同士の相関:

```text
IH vs UBR   .171
IH vs GDP   .177
UBR vs GDP  .128
```

つまり速度を除いた後に、**互いにかなり別の技術軸が残る**。
「三指標を平均して走力」にするより、共通speed因子＋個別skillに分ける方がデータにも整合。

## 7. joint speed+skill factor

再現: `scripts/audit_joint_speed_skill_factor.mjs`
Actions: `31176920402`

stable skillとannual noiseを別varianceに分け、複数年ではannual noiseだけを減らす。

player-level holdout:

```text
n=98
r=.751
rho=.758
RMSE_z=.665
```

旧3特徴Ridgeより改善。

ただし2024本人証拠<=2024だけでは:

```text
周東 1.812
源田 1.434
近本 1.209
```

となり、sanity `周東 > 近本 > 源田` を通らない。

## 8. 年度窓・skill較正期間を変えてもsanityは直らない

### 証拠窓

再現: `scripts/audit_joint_speed_temporal_windows.mjs`
Actions: `31177058741`

2026直接速度へのholdoutだけで選択:

```text
1年 r=.640 RMSE .781z
2年 r=.738 RMSE .683z
3年 r=.751 RMSE .665z
4年 r=.758 RMSE .662z  ← 最良
```

同じ4年窓を2024へ平行移動しても `周東 > 源田 > 近本`。

### skill priorを2020-25まで延長

再現: `scripts/audit_joint_speed_skill_long_calibration.mjs`
Actions: `31177303742`

holdout最良:

```text
calibration 2022-2025
window 4年
r=.760
RMSE_z=.661
```

それでも2024は `周東 > 源田 > 近本`。

→ 単純な窓選びやskill priorの短さが原因ではない。
**集約成績だけでは近本と源田のような近い純粋速度差を識別できない。**

## 9. 外部validation

別文書: `docs/audits/2026-08-07_speed_external_validation.md`

重要:
- 2025 NPB+由来の二次資料ではSprintが近本33.5、源田33.4とほぼ同等で近本が僅かに上。
- 一方H1は近本3.94、源田3.84で逆転。
- 同じSprint 33.5でも中野3.72、近本3.94、森下4.35とH1が大きく違う。
- H1を純粋速度へ潰さない設計を強く支持する。
- ただし2025計測なので2024カードの本人入力には使わない。

## 10. 実装部品

`src/ratings/speed_skill_factor.mjs` を追加。

係数をハードコードせず、較正値を外から渡す汎用推論器。

出力:

- `speed_z` / `speed_sd`
- 指標ごとの独立skill posterior
- 各skill posterior SD / shrinkage

原則:

- stable skill varianceは複数年でも消さない。
- annual noiseだけ複数年で減る。
- skill residualをspeedへ足し戻さない。
- calibrationが無ければフェイルファスト。

テスト:
Actions `31177734971` SUCCESS

```text
speed-skill factor unit tests PASS
cards 13 PASS
qa_remaining 173 PASS
phase1 safety 5 PASS
```

## 11. 現在の本番判断

新モデルは構造として旧方式より正しいが、2024 sanity未合格なので本番化しない。

```text
走力       未査定
盗塁       未査定
走塁       未査定
内野安打○  未査定
```

旧proxy・直接計測・候補posteriorはevidenceとして保持。

今後の最終形:

```text
physical baseball speed
  ├─ top-speed component
  └─ acceleration component（直接splitがある場合）

+ independent skills
  ├─ infield-hit skill
  ├─ baserunning skill
  ├─ stealing skill
  └─ GDP tendency/skill
```

最終表示の1つの`走力`へtop speedとaccelerationをどう合成するかは、**自作エンジンで27〜30m走の結果に対する感度を較正して決める**。恣意的な50/50等は置かない。

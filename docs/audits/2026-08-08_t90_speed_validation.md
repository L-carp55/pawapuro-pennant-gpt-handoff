# T90走力モデル — 2022年実データ初回検証

日付: 2026-08-08  
状態: **限定サンプルで設計妥当性を確認 / 最終NPBブリッジ係数ではない**

## 1. 目的

走力を「最高速度」そのものではなく、**最初の走行ステップから90ft（27.43m）を直線移動する身体的スプリント能力=T90**として扱う設計が妥当かを実データで確認する。

特に確認したいのは次の2点。

1. MLB Statcast Sprint Speed（トップスピード寄りの指標）はT90をどこまで説明するか。
2. Sprint Speedで説明できないT90差に、最初の10ft/30ftの加速差が残るか。

これはオーナー指摘「福本豊はヨーイドンならもっと速い選手がいたという話があるのに、パワプロでは走力S」「最速一塁到達はセーフティバントで0.何秒変わる」を受けた走力再設計の最初の物理検証。

## 2. データ

### T90 / 5ft splits

公開されている2022年 Baseball Savant Running Splits CSVを使用。

- 出典: Baseball Savant 90ft Running Splitsの公開CSV由来
- 公開コピー: `wyattbaldwin/Expected-Steal-Success-Rate` の `Database/running_splits_2022.csv`
- 列: `time_at_5ft ... time_at_90ft`
- switch hitterは左右別行がある。

### Sprint Speed

本プロジェクト `mlb_bridge.detail` に保存済みの2022年MLB Sprint Speedを使用。

- 2022年Sprint Speedを持つNPB接続選手: 30人
- Running Splits側と一致: 26人
- Running Splits側に行が無かった4人: Lewis Brinson / Mark Payton / David MacKinnon / Alex Dickerson

この検証は**NPB接続選手26人だけの限定サンプル**であり、MLB全体の最終係数ではない。

switch hitterの2行は、この初回検証では左右を単純平均した。公開CSVに各打席側のcompetitive-run数が無いためであり、最終全数較正では重みの扱いを別途詰める。

## 3. Sprint SpeedだけでT90を予測

26人で単回帰:

```text
T90 = 7.11794 - 0.111415 × SprintSpeed(ft/s)
```

結果:

| 指標 | 値 |
|---|---:|
| n | 26 |
| Pearson r | **-0.9662** |
| R² | **0.9336** |
| in-sample MAE | 0.0353秒 |
| in-sample RMSE | 0.0456秒 |
| leave-one-out MAE | **0.0387秒** |
| leave-one-out RMSE | 0.0505秒 |
| LOO予測 vs 実測 r | 0.9585 |

### 解釈

Sprint SpeedはT90の非常に強い材料。

ただし **R²=1ではない**。同じSprint Speedでも90ftを走り切る時間には有意な差が残る。

例:

- Luis González: Sprint 28.2 ft/s, T90 3.92秒
- Alcides Escobar: Sprint 28.2 ft/s, T90 3.99秒

最高速度が同じでもT90で0.07秒差がある。

したがって「Sprint Speedをそのまま走力へ変換」は採用しない。

## 4. Sprint Speed残差に初期加速が残るか

Sprint Speed単回帰から、

```text
residual = 実T90 - Sprint Speedから予測したT90
```

を作った。

正の残差 = トップスピードの割に90ftが遅い。  
負の残差 = トップスピードの割に90ftが速い。

残差との相関:

| split | residualとのr | p値 |
|---|---:|---:|
| 10ft time | **+0.483** | 0.0125 |
| 30ft time | **+0.406** | 0.0395 |

つまり、**トップスピードで説明できないT90差に、序盤の加速タイムが統計的に残っている**。

この結果は「走力=最高速度」ではなく、「野球距離における最高速度+加速」と考える設計を支持する。

## 5. Sprint Speed + 短距離split

### Sprint Speed + 10ft

```text
T90 = 5.10220
    - 0.088190 × SprintSpeed
    + 1.56372 × T10
```

| 指標 | Sprintのみ | Sprint + T10 |
|---|---:|---:|
| R² | 0.9336 | **0.9675** |
| LOO MAE | 0.0387秒 | **0.0286秒** |
| LOO RMSE | 0.0505秒 | **0.0375秒** |
| LOO予測r | 0.9585 | **0.9774** |

### Sprint Speed + 30ft

```text
T90 = 3.72667
    - 0.065644 × SprintSpeed
    + 1.16410 × T30
```

| 指標 | Sprintのみ | Sprint + T30 |
|---|---:|---:|
| R² | 0.9336 | **0.9810** |
| LOO MAE | 0.0387秒 | **0.0212秒** |
| LOO RMSE | 0.0505秒 | **0.0283秒** |
| LOO予測r | 0.9585 | **0.9872** |

T30単独でもR²≈0.906だが、Sprint Speedと組み合わせる方が明確に良い。

## 6. 設計判断

### 確定

1. **T90を走力の中心尺度にする方針を維持。**
2. Sprint SpeedはTier Bの重要な直接材料だが、**単独で走力値へ変換しない**。
3. 10〜30ftのcleanなsplit/加速計測がある場合、Sprint Speedと組み合わせてT90を推定する。
4. 特にT30は「野球距離の加速」を表す有力材料。
5. 最速home-to-firstは引き続き直接アンカー禁止。バント・左右・打撃→走行transitionが混ざるため。

### まだ確定しない

1. 上記26人回帰の係数を `ratings.json` に本採用しない。
2. MLB全体・複数年で同じ関係が保たれることを確認する。
3. NPB+の `top_speed_kmh` とMLB Sprint Speedを同一定義とみなさない。
4. NPB用reference CDFは、NPB選手のT90 posteriorを作ってから確定する。

## 7. 福本豊QAへの含意

この検証で、**トップスピード順位と90ft性能は完全には一致しない**ことが実データで確認できた。

したがって福本豊について、50m/最高速度で歴代最上位でなかったという資料があっても、それだけで走力Sを否定しない設計が妥当。

一方、106盗塁そのものを走力へ加点もしない。

```text
走力 = T90（加速+速度）
盗塁 = リード/読み/スタート/スライディング等
走塁 = ベース回り/追加進塁判断等
```

の分離を維持する。

## 8. 次の検証

1. 2017年以降のSavant Running Splits + Sprint Speedを全MLBで取得。
2. player-seasonへ統合（switch hitterの左右重複処理を厳密化）。
3. 年固定効果を除いた `Sprint Speed -> T90` を較正。
4. T10/T30を追加した時のout-of-year改善を測る。
5. `T90 - Sprint予測` の残差の翌年再現性を測る。
6. その後にNPB+とのブリッジへ進む。

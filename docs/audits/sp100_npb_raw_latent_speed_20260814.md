# SP-100 — PowerPro を介さない NPB+ raw → latent physical speed（設計＋実装）

生成日: 2026-08-14
状態: **設計確定・実装済み・妥当性確認済み。production配線は未実施（§7）**

## 1. PowerPro 非経由であることの担保

| 保証 | 内容 |
|---|---|
| 読み込むフィールド | `top_speed_kmh` / `hp_to_1b_sec` / `full_effort_run_proxy_count` / `PA` / `games` / `season_label` / `previous_season_PA` |
| 読み込まないフィールド | **`pawapuro_2026_speed`**（実データでも 0/100 で不在） |
| 機械チェック | 使用フィールド名に `pawapuro` / `powerpro` が含まれたら**例外で停止**するガードを実装 |
| 翌年再現性 | **一切使用しない**（SR-053） |

## 2. 4つの要求入力が実際に揃うか（実測）

| 要求 | 実データ | 状態 |
|---|---|---|
| same-time physical construct | `top_speed_kmh` 100/100、`hp_to_1b_sec` 100/100 | 揃う |
| measurement reliability | `npb_plus_sample_count` **0/100**、`npb_plus_qualified_run_count` **0/100** | 公表値なし → parallel forms で代替（§3） |
| exposure / sample error | `full_effort_run_proxy_count` 100/100（範囲 3–63、中央 26） | 揃う |
| temporal proximity | `npb_plus_source_season_label`（2026途中）、`previous_season_PA` 99/100 | 揃う（ただし年別NPB+は無く単一snapshot） |

**`sprint_speed_kmh` と `top_speed_kmh` は完全に同一**（r=1.0000・100%一致）。
独立した2測定ではないので reliability の推定には使えない。
独立なのは **`hp_to_1b_sec`**（別の物理量）だけ。

## 3. reliability を parallel forms で出した

公表run数が全てnullのため、**同じ構成概念を測る別測定どうしの一致**から推定した。

```text
r(top_speed_kmh, -hp_to_1b_sec) = 0.7462
Spearman-Brown（2測定合成時の信頼性） = 0.8547
```

PowerPro を一切使わない**内部整合**の推定。最高速度と一塁到達時間という
**別の物理量**が 0.75 で一致する事実が、両者が同じ「走る速さ」を測っている証拠になる。

## 4. 合成

```text
z_top = standardize(top_speed_kmh)          同一snapshot内で標準化
z_h2f = standardize(-hp_to_1b_sec)          符号反転（速いほど大）
z_meas = 各測定を r で重み付けした平均
w_exp  = runs / (runs + kappa)              kappa = 26（実データ中央値。恣意的定数を置かない）
latent_speed_z = z_meas * w_exp             観測が薄いほど集団平均へ寄せる
confidence     = min(1, SpearmanBrown) * w_exp
```

未縮小値 `latent_speed_z_unshrunk` も**併記して保存**する（§6の理由）。

## 5. 妥当性の確認 — モデルが知らないはずの事実を再現した

モデルには**選手名も、誰が速いかも、PowerProの値も一切与えていない**。
入力は物理測定と機会数だけ。それでも:

| 順位 | 選手 | 備考 |
|---|---|---|
| 1 | **周東 佑京** | NPB屈指の俊足。当プロジェクトの他分析でも常に最上位 |
| 2 | 岩田 幸宏 | 代走要員クラスの快足 |
| 3 | 小川 龍成 | |
| 4 | 滝澤 夏央 | |
| 5 | 水野 達稀 | |
| 98 | 浅村 栄斗 | 長距離砲 |
| 99 | **山川 穂高** | 長距離砲。鈍足で知られる |
| 100 | ソト | 長距離砲 |

**固有名詞レベルで外部の常識と一致**した。相関係数より強い妥当性の証拠。

副産物: SP-033/034 で見つけた「足が速い山川」が**皮肉**である可能性が本推定でも裏付けられた。
姓マッチを自動採用しなかった判断は正しかった。

## 6. 記録すべき限界 — exposure の選択効果

`corr(exposure_runs, 未縮小latent) = **0.4537**` ——
**速い選手ほど全力走の機会が多い**。したがって exposure による縮小は**対称ではない**。

| 群 | 未縮小平均 | 縮小後平均 | 縮小率 |
|---|---|---|---|
| 上位20人 | 1.304 | 0.803 | 0.616 |
| 下位20人 | −1.136 | −0.507 | **0.446** |

**遅い選手のほうが約38%強く中央へ寄せられる。**

縮小は「精度の表明」としては正しい（3回しか走っていない選手の推定は実際に不確か）が、
**分布の形は非対称に圧縮される**。したがって:

- **順位・相対比較には `latent_speed_z_unshrunk` を使う**
- **信頼度を伴う下流利用には `latent_speed_z` と `confidence` を使う**
- 両方を保存済みなので用途で選べる

非対称性を消すには exposure を latent speed で説明した残差で縮小する必要があるが、
n=100 では過適合の危険があるため**今回は行わず、事実として記録するに留める**。

## 7. production への配線は未実施

本推定は**単独で完結した latent speed** であり、既存の統計モデル（proxy由来）とは別系統。
配線するには次の判断が要る:

1. 既存の統計 speed と **どう合成するか**（置換か、重み付き合成か）
2. 合成するなら **NPB+ は2026 snapshot のみ**なので過去年の査定には使えない（temporal proximity）
3. 合成後の目盛りは `applyScale` の再導出が要る（SP-016 と同じ「対の作業」問題）

→ **SP-079 で PowerPro-mapped blend の代わりに何を使うか**という設計判断であり、
SP-071（絶対目盛り）とも絡む。実装は次工程。

## 8. 成果物

- `scripts/sp100_npb_raw_latent_speed.mjs`
- `outputs/derived/sp100_npb_raw_latent_speed.json`（100人分の latent_speed_z / unshrunk / confidence / exposure）

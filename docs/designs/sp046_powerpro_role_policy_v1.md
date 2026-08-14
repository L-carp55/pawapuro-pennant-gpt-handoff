---
status: final
date: 2026-08-14
authority: owner ruling 2026-08-14 + SR-007 / SR-010
---

# SP-046 — PowerPro の役割（確定policy v1）

## 0. 一行で

**PowerPro は「目盛りの参考」と「疑いのフラグ」には使ってよいが、
個々の選手の能力値を決める側には一切入れない。**

## 1. 許可（PowerPro を使ってよい範囲）

| # | 用途 | 条件 |
|---|---|---|
| A-1 | **global display scale の provisional 参考** | 集団全体の中心と幅だけを合わせる用途に限る。`applyScale` は `slope = sd(PowerPro)/sd(internal)`、`intercept = mean(PowerPro) − slope*mean(internal)` の2定数のみで、**個人ラベルを一切参照しない**。SP-071（engine応答での絶対目盛り確定）までの暫定 |
| A-2 | **stale / odd の参考** | 「PowerProのこの選手の値は据え置きが長い／他の証拠と食い違う」という**疑いの入口**として使う。疑いの解消は他の証拠で行う |
| A-3 | **community Rating Consensus の比較対象** | コミュニティが「この査定は高い/低い」と言う時の参照点。査定の正解としてではなく、議論の対象として |

## 2. 禁止（PowerPro を使ってはいけない範囲）

| # | 禁止事項 | 理由 |
|---|---|---|
| B-1 | **player-level teacher** | 個々の選手のPowerPro値を正解として当てにいくと、PowerProの誤りをそのまま複製する（SR-007 循環QAの回避） |
| B-2 | **component の採否** | どの材料を使うかをPowerProとの一致で決めない |
| B-3 | **component weight** | 材料の重みをPowerProとの一致で決めない |
| B-4 | **shrinkage 強度** | 縮小の強さをPowerProとの一致で決めない |
| B-5 | **final physical speed への個人ラベル回帰** | 「実測 → PowerPro個人値」の回帰式を最終走力の経路に入れない（SR-010: NPB+ raw と PowerProラベル回帰経路を分離する） |

## 3. 本policyが直ちに効く既存箇所

### 3.1 NPB+ direct path → legacy / provisional diagnostic へ降格

`direct_measurement.mjs` が作る `direct.value` は
`m.intercept + m.slope * measured` で、この **slope/intercept と test_r は
PowerPro個人ラベルを教師に当てた回帰**（`scripts/calibrate_npb_plus_direct.mjs`）。

→ **B-5 に該当**。したがって `blendDirect` を通る
PowerPro-mapped NPB+ direct path は **final production 経路として扱わない**。
**legacy / diagnostic として保持**する（削除しない。比較対照に要る）。

恒久解は **SP-100**（PowerPro を介さない NPB+ raw → latent speed）。

### 3.2 `applyScale` は許可（A-1）

個人ラベルを使わず集団の中心と幅だけを合わせる2定数なので B-5 に当たらない。
SP-071 まで provisional に使う。

### 3.3 SP-015 の weight 設計への制約

component weight を **PowerPro との一致度で決めてはいけない**（B-3）。
同様に**翌年再現性**も使わない（SR-053）。
使える軸は SP-015 側で定義する（同時点の測定信頼性・標本誤差・交絡・
construct directness・temporal proximity・**PowerPro を経由しない**独立physical convergence）。

## 4. 「独立physical convergence」に NPB+ raw を使ってよい理由

NPB+ の **raw sprint speed（km/h）** は、トラッキングが直接出す物理量であり
**PowerPro のラベルではない**。SR-010 が「NPB+ raw measurement 自体」と
「PowerProラベルへ回帰した変換経路」を**分離して評価せよ**と定めているとおり、
前者は使ってよく、後者（§3.1）が禁止対象。

ただし次の2点を守る:

- **axis-level にのみ使う**（材料ごとの重みの決定）。**player-level の値を当てにいかない**
- NPB+ 自体の限界（in-game tracking集計・qualified run数非公開・露出依存）を
  結論に明記する

## 5. 判定に使う一問（実装レビュー用）

> その PowerPro の値は、**選手個人を特定して**使われているか？

- YES → 禁止（B-1〜B-5）
- NO（集団の中心・幅・分布だけ） → 許可（A-1）

`applyScale` は NO。`direct.value` の回帰は **YES**（個人ラベルで当てた式）。

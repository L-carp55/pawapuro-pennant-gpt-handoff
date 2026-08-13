# SP-015 — component weight を翌年再現性から同時点の量へ組み直す

生成日: 2026-08-13

状態（2026-08-13 更新）: **productionへ適用済み。ただしSP-015自体はPARTIAL（完了ではない）**

> ⚠️ 本文中の「productionへは未適用」「提案」という記述は**起草時点(監査段階)の記録**であり、
> 現在のコード・registryとは一致しない。履歴として残すが、現在の状態は以下が正:
>
> - `configs/running_norms.json` の `componentWeights` は **same_time_reliability 値へ置換済み**
>   （旧値は `_componentWeightsLegacyNextYearRepeatability` にlegacy controlとして保持）
> - `src/ratings/running.mjs` の `speedComponents()` fallback既定値・コメントも更新済み
> - `baserunningAbility()` の `ubrOnSpeed.repeatability` / `advanceOnSpeed.repeatability` 依存も
>   同型違反として等重み(w=1)へ是正済み
> - 100人before/after再計算実施済み（`speed_2026_100_before_after_sp015_016_20260813.md`）
>
> **それでもSP-015はPARTIAL**。残っているもの:
> 1. UBRの同時点信頼性は測れておらず中央値0.496で代用したまま
> 2. 軸1(construct directness)・軸4(confounding)・軸8(direct-anchor agreement)は未数値化
>
> EX-008はこれらが埋まるまでOPENのまま維持する。

## 0. 違反の内容

`configs/running_norms.json` の `componentWeights` は Year Y→Y+1 の一致（翌年再現性）そのもの:

```text
  triple      0.695
  gdpAvoid    0.62
  infieldHit  0.586
  advance     0.527
  ubr         0.445
```
CLAUDE.md §年度査定の目的関数 が「翌年再現性をweight・採否・縮小の直接根拠に使わない」と定めるため、これは直接違反。

## 1. 代わりに使った軸（正本 §3 の B / C のみ）

各材料は率なので、その年の試行回数から**標本誤差が解析的に出る**。

```text
reliability = 1 − E[標本誤差の分散] / 観測された選手間分散
```
1シーズン内で完結し、**翌年の情報を一切含まない**。

| 材料 | 同時点の信頼性 | 年別 | 備考 |
|---|---|---|---|
| 三塁打割合 (triple) | **0.496** | 2021:0.49 2022:0.52 2023:0.55 2024:0.46 2025:0.45 |  |
| 併殺回避 (gdpAvoid) | **0.433** | 2021:0.50 2022:0.31 2023:0.40 2024:0.47 2025:0.48 |  |
| 内野安打率 (infieldHit) | **0.533** | 2021:0.56 2022:0.56 2023:0.60 2024:0.53 2025:0.41 |  |
| 自作の走塁指標 (advance) | **0.221** | 2021:0.24 2022:0.07 2023:0.33 2024:0.23 2025:0.23 |  |
| 走塁貢献(UBR) (ubr) | **-** | - | 合成指標で試行回数に分解できず、同時点の標本誤差を解析的に出せない。翌年再現性を代用してはいけないため、weightは同時点で測れる材料から決め、UBRは等重み扱い（下記sensitivityで影響を確認）とする |

## 2. 3方式の重み（恣意的な単一置換をしない）

| 材料 | legacy（翌年再現性・違反） | equal | same_time_reliability |
|---|---|---|---|
| triple | 0.695 | 1 | 0.496 |
| gdpAvoid | 0.62 | 1 | 0.433 |
| infieldHit | 0.586 | 1 | 0.533 |
| advance | 0.527 | 1 | 0.221 |
| ubr | 0.445 | 1 | 0.496 |

※ UBRは合成指標で試行回数に分解できず同時点の標本誤差を出せない。翌年再現性の代用は禁止されているため、
測れた材料の中央値 0.496 を暫定で当て、下の感度で影響を確認した。

## 3. 感度（2025年・同一選手集合で合成zを比較）

n = 158人

| 比較 | 相関 | 最大差(z) |
|---|---|---|
| legacy vs equal | 0.995 | 0.249 |
| legacy vs same_time_reliability | 0.992 | 0.241 |
| equal vs same_time_reliability | 0.997 | 0.203 |

**legacy と same_time_reliability の順位はほぼ同じ（r=0.992）。**
つまり違反していたのは**根拠の立て方**であって、出てくる順位ではない。
順位が変わらないからこそ、根拠だけを正しい軸へ置き換えられる。

## 4. 提案

`componentWeights` を `same_time_reliability` へ置き換える。理由は次のとおり:

- 1シーズン内の標本誤差だけから出しており、翌年の情報を含まない（owner ruleに適合）
- 各材料の「その年どれだけ確からしく測れているか」を直接表す（正本 §2 の軸2/軸3）
- equalより情報量が多く、legacyと順位がほぼ同じなので移行の副作用が小さい

**未解決として残すもの**:

- UBRの同時点信頼性は測れていない（中央値で代用）。分解可能な形のUBRが手に入れば置き換える
- 軸1（construct directness）・軸4（confounding）・軸8（direct-anchor agreement）は
  本スクリプトでは数値化していない。現状は同時点信頼性のみでweightを作っており、
  それらは**未反映**であることを明示する
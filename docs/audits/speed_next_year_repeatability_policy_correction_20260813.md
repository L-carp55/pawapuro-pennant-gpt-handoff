# 走力査定 — 「翌年再現性」を年度査定へ使わない方針の再確認と修正

作成日: 2026-08-13
状態: **CURRENT POLICY CORRECTION / OWNER RULE RESTORED**

## 0. 結論

2026-08-05のオーナー指示は明確だった。

> 「基本的にはその年だけで査定してください。過去の実績から補正が入るのは成績が明らかに下振れたときとけがなどであまり出られなかったときだけです」
>
> 「翌年再現性は一年ごとの能力を査定するのに完全に不要です」

このルールはミート/パワーの縮小ではコード・configへ反映されたが、**走力のcomponent weightには旧ロジックが残存した**。

したがって、以下を訂正する。

1. **翌年再現性・翌年予測力を、年度走力査定の材料採否・重み・縮小強度・最終点の根拠に使わない。**
2. 翌年再現性を計測した既存研究は削除しないが、**projection / durable-trait / diagnostic用途に限定**する。
3. 「翌年再現性が悪化したから分離しない」「翌年再現性が高いから重くする」という結論は、年度走力査定のacceptance criterionとしては撤回する。
4. 現行production statistical speed modelは**controlとして保持**するが、そのcomponentWeightsはlegacyであり、final modelへそのまま継承しない。

---

## 1. 現在確認できる直接違反

### 1.1 `configs/running_norms.json`

現在のcomponent weights:

```text
triple      0.695
gdpAvoid    0.620
infieldHit  0.586
ubr         0.445
advance     0.527
```

`_componentWeights_basis` は明示的に「各材料の翌年再現性」と書いている。

これは現在のowner ruleと衝突する。

### 1.2 `src/ratings/running.mjs`

`speedComponents()` は同じ翌年再現性をそのままweightとして使用している。

また `baserunningAbility()` でも `ubrOnSpeed.repeatability` / `advanceOnSpeed.repeatability` をcomponent weightに使っている。

### 1.3 三塁打の走塁寄与分離実験

`outputs/triple_rate_separation_20260805.md` の実験自体は有用な履歴資産として保持する。

ただし、

```text
分離したら翌年再現性が下がった
→ だから年度走力査定では分離しない
```

という採否ロジックは無効。

分離する/しないは、**同時点の走力construct validity、走塁得能との二重計上、交絡除去後の説明力、直接身体計測との整合**で改めて判定する。

### 1.4 T-0203 / rolling holdout

翌年・未来年予測を使う研究は、future leakage検査やprojection研究としては価値がある。

しかし、

```text
翌年をよく当てる / 当てない
→ 2026年の走力査定へ入れる / 入れない
```

という直接の採否条件にはしない。

T-0203/T-0204は**diagnostic/projection research**として保持し、final annual appraisal weightの正本にしない。

---

## 2. 年度査定で見るべきもの

査定対象は「その時点の野球上の走る身体能力」。

したがって材料の評価軸は、翌年との一致ではなく原則として次を使う。

1. **construct directness** — T90 / 30m / 50m / NPB+ speed等、何を直接測っているか
2. **same-time measurement reliability** — 同一時点・同条件での計測誤差、sample/機会数、repeat runs
3. **temporal proximity** — 査定年から測定時点がどれだけ近いか
4. **confounding** — 打撃、走塁判断、起用、左右打席、打球方向等がどれだけ混ざるか
5. **same-time convergence** — 独立した身体計測・観察・proxyが同じ方向を示すか
6. **double-counting risk** — 盗塁/走塁得能へ回す情報との重複
7. **coverage / missingness** — 観測されなかったことを低能力と誤認していないか
8. **direct-anchor agreement** — 利用可能なcurrent/historical physical anchorsとの同時点整合

重みを数値化する場合も、これらから校正する。**翌年再現性をweightへ直接代入しない。**

---

## 3. 「再現性」という言葉の区別

混同を防ぐため、今後は用語を分ける。

### A. 翌年再現性 / year-to-year persistence

同一選手のYear YとY+1の相関。

- 年度査定のweightには使わない
- projection / durable-trait研究では使用可

### B. 同時点の測定信頼性 / measurement reliability

同じ能力を同じ時期に繰り返し測った時の誤差・安定性。

- 年度査定のconfidence/weightに関係する

### C. サンプル由来の推定誤差

PA、走行機会、計測回数等による不確実さ。

- 観測のconfidenceには関係する
- ただし「翌年も同じか」とは別概念

今後「再現性」とだけ書かず、A/B/Cのどれかを明記する。

---

## 4. 修正タスク

`SP-015` をowner-review blocker / Gate blockerとして新設する。

完了条件:

- `running.mjs` / `running_norms.json` の翌年再現性由来weightを全数棚卸し
- T-0203 / triple separation等をannual appraisal acceptanceから切り離す
- current-year construct用のweighting/combinationを再設計
- direct physical anchorが少ない場合は、恣意的な新weightを置かず、equal/regularized/sensitivity等を比較して根拠を保存
- 100人候補表を再計算し、変更影響を保存
- owner review final queueはその後に生成

---

## 5. 再発防止

`speed_requirements_baseline_20260813.tsv` に、

> 翌年再現性・翌年予測力を年度査定の材料採否・重み・縮小根拠へ使わない

を独立要件として追加する。

`speed_task_registry.tsv` では `SP-015` が未完の間、owner review / Speed Gateをfail-closedにする。

この修正は「再現性を一切調べない」という意味ではない。**年度査定の目的関数と、翌年予測の目的関数を混ぜない**という意味である。

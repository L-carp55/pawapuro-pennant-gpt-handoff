# 2026 NPB 走力査定 — 変遷・SNS・PowerPro比較 オーナー向けまとめ

作成日: 2026-08-11  
状態: **REFERENCE / REBUILD INPUT**

この文書は、これまでの走力査定で「どのように値が変わったか」「SNSで何が分かったか」「PowerProとどれくらい違ったか」を、専門用語を減らしてまとめたもの。

現在のGateは再開済みであり、この文書の最終physical値をそのままゲームへ採用しない。

---

# 1. 査定がどう変わったか

最初の100人一括査定は、主に2026 NPB+の最高速度を100人内で並べてPowerPro風scaleへ変換した `blind-v3`。

その後:

1. direct 90ft / T90
2. electronic/photoelectric 30m・50m
3. historical physical measurements
4. exposure
5. PowerPro history
6. anchor bank
7. ordinary SNS
8. Grok-X
9. targeted current evidence
10. video

を追加した。

しかし最終physical freezeでは古い測定やSNSをpoint estimateへほぼ入れず、結果として多くの選手がblind-v3値へ戻った。

---

# 2. 数字が動いた代表選手

## モンテロ: 68 → 52

- NPB+最高速度31.9km/hでは中上位で68相当。
- 2024 Baseball Savant direct T90 = 4.20秒を確認。
- 野球の90ft走をより直接見る証拠として52へ修正。
- PowerPro 49に近い。

この例は、最高速度だけでは加速/90ft性能を取り逃すことを示す。

## 林琢真: 69 → 74 → 69

- 2026 NPB+ 32.0km/hでbaseline 69。
- 2022 photoelectric 50m 5.99秒を強く見て74へ。
- ただし2026 current top-speed orderingと2022 50m orderingが衝突。
- 最終physicalでは古い50mの直接加点を外して69へ戻した。
- PowerPro 82。

現在の再構築では「古い50mを完全に背景へ落としすぎた可能性」を重点再検証する。

## 友杉篤輝: 75維持だが根拠が強化

- 2022 photoelectric 50m 6.10秒。
- 2026 NPB+ 32.7km/h。
- SNS/スカウト評でも速さを支持。
- physical 75 / PowerPro 87。

現在はprojectが加速を拾えておらず低すぎる可能性を重点検証する。

## 奈良間大己: 66 → 67 → 66

- 2022 photoelectric 50m 6.31秒。
- intermediateではhistorical short-distanceを少し加点。
- final physicalでは2026へ直接carryしない方針で66へ戻した。
- PowerPro 64。

同じ2022 cohortの林・友杉との比較アンカーとして重要。

## カリステ: 63 → 64 → 63

- 2017 direct T90 3.94秒。
- 2025年にも「俊足巧打」系SNS evidence。
- historical T90をcurrent pointへ自動carryしない方針で63へ戻した。
- PowerPro 82。

現在は、old measurementのweightを落としすぎた可能性と、PowerPro staleでないかの両方を検証する。

## 秋山翔吾: 66 → 67 → 66

- 2021 direct T90 3.97秒。
- PowerPro historyは高めを維持/上昇。
- final physicalではhistorical T90をcontext-only化して66。
- PowerPro 77。

**Ownerは現在のPowerPro 77が高すぎる/stale可能性を疑っている。**

これは「PowerProに寄せる」だけでは解決しない代表case。

## ポランコ: 61 → 63 → 61

- 2021 direct T90 3.99秒。
- intermediateで63。
- old measurementをcurrentへ直接carryしない方針で61。
- PowerPro 63。

## 筒香嘉智: 53のまま、provenanceが大きく変化

- 2022 T90 4.20秒を一度使用。
- historical anchor bank作成時に公式再確認できず高信頼から除外。
- targeted rescueでBaseball Savant rowを再発見し `CONFIRMED_PRIMARY` に訂正。
- ただし2022→2026へ自動carryせず53。
- PowerPro 45。

---

# 3. SNS調査の実績

## ordinary web

X本文を安定取得できず、19人のほとんどがinsufficientとなった。

## Grok-X rescue

- x_search 175
- success 175
- raw hit occurrences 267
- unique candidates 191
- accepted 41
- rejected 150

combined classification:

- current band supported: 5
- temporal change supported: 2
- metric conflict: 2
- mixed: 2
- insufficient: 8

---

# 4. SNSから得た具体的な方向

## 木下拓哉

複数独立投稿が一貫して遅い側。

例として2026年に、他選手との比較を含め「足が遅い」「非常に遅い」とする直接評価が複数。

physical 46 / PowerPro 39。

新方針では、SNSはPowerPro 39側を補強する可能性も含めてrating reviewに使う。

## 岡大海

複数独立投稿で足の速さ・加速を直接支持。

physical 75 / PowerPro 82。

PowerPro側が実戦加速をより拾っている可能性を検証する代表case。

## 並木秀尊

現在も非常に速い方向の評価。

physical 85 / PowerPro 97。

top speedだけでなくfirst-step/acceleration/top-band calibrationを見直す対象。

## 塩見泰隆

2025-26に現在の速さ・加速を支持する情報。

physical 72 / PowerPro 83。

## 鈴木大地

現在は遅い側を支持するcommunity evidence。

## 藤岡裕大

- 2024: 足の速さ低下を問題視
- 2025: 以前より脚力が落ちたという評価
- 2025末: 現在は普通程度という評価

physical pointは58のままだが、昔の俊足イメージをcurrentへcarryしない方向を補強した。

## 丸佳浩

- 2024: 脚力が以前より衰えたという評価
- 2025: 現在は走力が低いという直接評価

physical 64 / PowerPro 65でほぼ一致。

## 土田龍空

別々の投稿で:

- 足が速い
- スピードが強み
- 遅い側

が混在。

mixed evidenceとしてrangeを広げた。

## 梅野隆太郎

速い/遅いが混在。physical 57 / PowerPro 57。

## 友杉篤輝

スカウト評や投稿でspeedを高く評価。

速いこと自体は支持されたが、林とのcurrent pairwise orderingは未解決。

---

# 5. SNS旧運用の問題

Grok-Xでは以下を明示的に棄却していた。

- game rating / game discussion
- generic speed labels
- baserunning/stealing context
- play outcome context
- question form

identity/repost control自体は必要だが、practical appraisalでは一部を捨てすぎた。

今後は:

## Physical Observation Consensus

実際の足・加速・一歩目・decline/recovery。

## Rating Consensus

PowerPro/Prospiについて:

- 高すぎる
- 低すぎる
- stale
- injury未反映
- acceleration未反映
- 走力と走塁得能の分離がおかしい

を別laneで集める。

---

# 6. PowerPro比較

previous physical freeze vs PowerPro:

- exact match: 99
- project mean: 65.343
- PowerPro mean: 65.667
- mean diff: -0.323
- MAE: 7.758
- RMSE: 9.839
- correlation: 0.776

owner rule:

**5点以上を大きな乖離。**

PowerProの方が大幅に高い代表:

- 野間
- 矢野
- カリステ
- 京田
- 小園
- 林
- 並木
- 友杉

project physicalの方が大幅に高い代表:

- 古賀優大
- 村林
- 宮﨑
- 浅村
- 大城
- 山口
- 石川昂弥
- 細川

新方針では、差の大きい選手でまずproject model不足を疑うが、PowerProのstale/inertiaも同時に検査する。

---

# 7. PowerProをそのまま信用できないcase

ユーザーは、PowerProにはベテランで走力を維持しすぎる不可解査定がある可能性を指摘。

重点case:

- 現在: 秋山翔吾
- 過去: 松山竜平

長期PowerPro panelを使い:

- 長期据え置き
- age
- injury
- Prospi trajectory
- current top speed/H2F
- community rating comments

を重ねてstale priorを検出する。

---

# 8. The Show / foreign players

The Show temporal policy研究はデータ制約で識別不能だったが、same-time conversionは別問題。

今後:

- PowerPro Speed ~ The Show Speed
- Statcast intermediary
- percentile / quantile mapping

をholdout比較する。

測定時にPowerProへ未収録の助っ人はThe ShowをPowerPro相当へ変換してmeasurement-era priorを作る。

---

# 9. 現在の正式結論

previous blind freezeは:

```text
physical_speed_estimate baseline
```

として保存する。

実ゲーム値は今後の:

```text
practical_powerpro_style_speed
```

で再作成する。

現在:

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
```

次工程はClaude Codeによる独立red-team。肩力には進まない。

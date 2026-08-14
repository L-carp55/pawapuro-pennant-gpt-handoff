# SP-100 — Candidate S / N / F 比較（既定は凍らせない）

生成日: 2026-08-14
状態: **比較済み。winner 未宣言。production 既定は未変更**

## 候補

| 記号 | 中身 |
|---|---|
| S | 2025年の統計走力（continuous prior の z） |
| N | 2026 NPB+ raw の latent physical speed（すでに露出で縮小） |
| F | それぞれの信頼性で縮小したあと、同じ z 空間で合成 |

PowerPro 個人値は weight に使っていない。NPB+ 2026 snapshot を過去年へコピーしていない。display scale はここでは掛けていない。

## 被覆

S 93 / N 100 / 両方 93。H2F 低信頼レーン 15。strict T90 は 0。

## 比較

| 対 | n | r |
|---|---|---|
| S vs N | 93 | 0.7491 |
| S vs H2F | 15 | 0.2195 |
| N vs H2F | 15 | 0.4293 |
| F vs H2F | 15 | 0.4350 |
| S vs NPB+ sprint | 93 | 0.7597 |
| N vs NPB+ sprint | 100 | 0.8764（N は top speed から作っているので勝敗基準にしない） |

PowerPro との一致は勝敗基準にしない。

## なぜ winner を宣言しないか

H2F は n=15 で低信頼。strict T90 は足りない。N は 2026 年だけの snapshot。S は 2025 年の統計年。年が違う残差を「同じ年の選手対立」にしない。

残るのは Opus/owner の配線判断。SP-079 の最終査定は、この winner が決まるまで PowerPro 経由の NPB+ blend を final に使わない。

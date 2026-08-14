# SP-016 — continuous prior を production candidate として適用

生成日: 2026-08-14
状態: **candidate 適用済み。hard gate は control。既定の確定は Opus/owner。EX-009 は未閉じ**

## 何をしたか

設計正本どおり、縮小と display scale 再導出をセットで入れた。片方だけ入れることはしていない。

- pooling: `z_cur*=PA/(PA+κ)`, `z_hist*=PA_hist/(PA_hist+κ)`, 精度合成。κ=50, λ=0.2703
- 素朴な `w=PA/(PA+κ)` は使っていない（東妻問題で棄却済み）
- applyScale は全体の中心・幅だけ合わせた。PowerPro 個人値は weight にもフィット対象にも使っていない
- hard gate (`poolingMode=current_year_first_hard` + 旧 slope 1.381 / intercept −4.330) は control として残した

現行 configs の既定は `speedPooling.mode=continuous_prior`。これは candidate の配線であり、最終2026 practical rating ではない。

## 尺度検査（必須）

対象: 2025年統計ロースター 260人。before = hard gate + 旧 scale。after = continuous + 新 scale。

| 項目 | before | after |
|---|---|---|
| 平均 | 65.035 | 65.035 |
| 標準偏差 | 15.994 | 15.994 |
| 最小 / 最大 | 27.07 / 131.86 | 34.83 / 122.64 |
| p10 / p50 / p90 | 46.49 / 63.68 / 84.34 | 45.61 / 63.43 / 86.53 |

delta = after − before:

- 平均 0.000、sd 6.113、最小 −23.63、最大 +29.42
- 5点以上 76人、10点以上 22人
- 正 128 / 負 127 → **全員同方向ではない**
- corr(delta, hard) = −0.1911
- corr(delta, continuous) = +0.1911
- corr(delta, 当年PA) = +0.0938

|r| は 0.9 から遠い。これは尺度バグの署名ではない。崖（25–100PA）は hard 側に残り、continuous の構造的崖は 0。

100人カード経路（99人成功、名原は一軍打撃なしで値を作らない）:

- corr(delta, hard) = +0.1098
- corr(delta, continuous) = +0.4019
- 全員同方向ではない

100人専用の別 scale は無い。同じ slope/intercept をロースター全体に使っている（SP-072）。

極端な動きの例: 田村俊介 +29.4（当年69PA）、浅野翔吾 −23.6（当年83PA）。少出場の揺れは縮小で吸収され、当年が極端な年は履歴へ寄る。

## 残る判断

年度査定は current-year 中心、という owner 規則を continuous prior が満たすかどうかは、この適用だけでは閉じない。EX-009 は POLICY_CONFLICT_REOPEN のまま残す。

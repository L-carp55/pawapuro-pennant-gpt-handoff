# Catching range-adjustment audit

判定: **RESEARCH_ONLY**

event-to-bm_fld RngR coverage=98.1%
analysis events (RngR present, >=100 inn)=121,659 / FE=1165

RngRは捕球へ加点せず、同守備位置で広い範囲を処理する選手の機会難度proxyとしてのみ投入する。

| model | events | Brier | logloss | AUC | AP | split players | split r | next-year pairs | next-year r |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| context | 121659 | 0.008531 | 0.03541 | 0.942 | 0.158 | 731 | 0.085 | 357 | 0.027 |
| context_range | 121659 | 0.008515 | 0.03534 | 0.942 | 0.163 | 731 | 0.075 | 357 | 0.022 |

## acceptance rule

context_rangeが同一標本のcontextよりBrier/loglossを改善し、かつ残差再現性を悪化させない場合のみ、RngRを機会難度proxyとして次段階に残す。改善しなければ二重計上を避けて不採用。

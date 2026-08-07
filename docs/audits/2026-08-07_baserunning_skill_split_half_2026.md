# 2026 走塁skill split-half監査

判定: **RESEARCH_ONLY_NOT_ABILITY_READY**

- game_id hashで試合をA/Bへ完全分割。同一試合は両側へ入らない。
- 各半分で独立に打球位置・hit_location・outs・fielderをcontext調整する。
- 各半分でNPB+最高走行速度の効果を別々に推定し、その身体成分を除いた残差を比較する。
- 加速の直接観測がNPBには無いため、ここで得る残差を最終走塁得能とはしない。

events A/B: 1080 / 1151
speed-model train players A/B: 68 / 71
speed slope A/B: 0.036 / 0.060
common players (>=5 events each half): 46
split-half raw residual Pearson: 0.122
split-half speed-adjusted Pearson: 0.039
split-half raw residual Spearman: 0.096
split-half speed-adjusted Spearman: 0.029

## pooled speed-adjusted residual examples

| player | speed km/h | events | residual |
|---|---:|---:|---:|
| 滝澤夏央 | 33.0 | 21 | 0.183 |
| 太田椋 | 31.7 | 15 | 0.170 |
| 福永裕基 | 33.0 | 10 | 0.165 |
| 森友哉 | 31.2 | 13 | 0.157 |
| 周東佑京 | 35.0 | 20 | 0.145 |
| 蝦名達夫 | 31.4 | 16 | 0.093 |
| 藤原恭大 | 33.0 | 16 | 0.092 |
| 若月健矢 | 30.7 | 11 | 0.076 |
| 田宮裕涼 | 32.4 | 16 | 0.075 |
| 清宮幸太郎 | 31.7 | 19 | 0.070 |
| 細川成也 | 32.7 | 24 | -0.282 |
| モンテロ | 31.9 | 11 | -0.220 |
| 坂倉将吾 | 30.6 | 23 | -0.210 |
| 小川龍成 | 33.4 | 18 | -0.201 |
| 村林一輝 | 34.5 | 24 | -0.192 |
| 村松開人 | 33.4 | 22 | -0.155 |
| 牧秀悟 | 31.6 | 25 | -0.148 |
| 古賀優大 | 32.1 | 16 | -0.136 |
| 来田涼斗 | 32.4 | 13 | -0.124 |
| 小園海斗 | 31.5 | 26 | -0.111 |

## interpretation rule

身体走力を除いた後のsplit-half再現性が十分でなければ、追加進塁単独から走塁得能を100段階へ広げない。速度補正で再現性が上がるか、少なくとも維持されることを確認してから次へ進む。

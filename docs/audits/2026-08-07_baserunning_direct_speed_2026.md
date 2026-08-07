# 2026 追加進塁 × NPB+直接走力 監査

判定: **RESEARCH_ONLY_PHYSICAL_PLUS_SKILL_RESIDUAL**

- 追加進塁イベントは打球位置・アウト数・hit_locationの経験セルでcontext調整する。
- この残差はまだ身体走力と走塁技術の両方を含む。得能値として使用しない。
- NPB+最高走行速度との関係を測り、身体成分が残るかだけ確認する。

events_2026: 2231
direct_speed_players: 100
matched_players_n>=5: 82
corr(top_speed, context_residual): 0.259
residual slope per +1 SD top speed: 0.040

| event | matched players | corr(speed,residual) |
|---|---:|---:|
| 1st_to_3rd | 81 | 0.214 |
| 2nd_to_home | 62 | 0.267 |
| 1st_to_home_on_2b | 28 | 0.122 |

## fastest matched examples

| player | top speed km/h | events | context residual |
|---|---:|---:|---:|
| 周東佑京 | 35.0 | 20 | 0.249 |
| 村林一輝 | 34.5 | 24 | -0.115 |
| 名原典彦 | 33.7 | 9 | 0.215 |
| 岩田幸宏 | 33.6 | 11 | 0.205 |
| 田中幹也 | 33.5 | 17 | 0.174 |
| 牧原大成 | 33.5 | 13 | -0.083 |
| 村松開人 | 33.4 | 22 | -0.099 |
| 小川龍成 | 33.4 | 18 | -0.142 |
| 水野達稀 | 33.4 | 25 | 0.126 |
| 福永裕基 | 33.0 | 10 | 0.200 |
| 藤原恭大 | 33.0 | 16 | 0.133 |
| 滝澤夏央 | 33.0 | 21 | 0.213 |

## interpretation

相関があっても残差を走力へ戻さない。身体走力の直接観測で説明できる部分を先に除き、その後の選手効果だけを走塁skill候補として別途検証する。

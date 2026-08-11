# 2026 NPB 走力 Final Reappraisal — Post-freeze External QA

## Conclusion

Stage 1 blind freeze `7b82bb2030bf94f40d5983618f6e7362d8f2a06b` の後にだけPowerProとThe Showを外部QAとして確認した。final ratingの変更は **0** であり、PowerProの残差を補正目標にしていない。

## Freeze integrity

- Stage 1 core hash: **UNCHANGED**
- Internal blind QA: PASS (21/21)
- Independent blind QA: PASS (21/21)
- post-QA rating changes: **0**

## PowerPro 2026 external QA

| metric | value |
| --- | --- |
| n_matched | 99 |
| final_mean | 65.343434 |
| powerpro_mean | 65.666667 |
| mean_difference_final_minus_powerpro | -0.323232 |
| mae | 7.757576 |
| rmse | 9.83911 |
| correlation | 0.776279 |
| abs_diff_gt_10 | 33 |
| abs_diff_gt_15 | 11 |

- within 5: 44/99 (0.444444)
- within 10: 66/99 (0.666667)
- Exact-only match rule: same canonical player_id + same canonical team + one source candidate.
- 名原典彦はplayer_id nullであり、PowerProへ強制matchしていない。

### Largest positive residuals (final − PowerPro)

| player | final | PowerPro | residual |
| --- | --- | --- | --- |
| 古賀 優大 | 70 |  | 24 |
| 村林 一輝 | 92 |  | 23 |
| 宮﨑 敏郎 | 54 |  | 21 |
| 浅村 栄斗 | 56 |  | 21 |
| 大城 卓三 | 44 |  | 20 |
| 山口 航輝 | 68 |  | 16 |
| 石川 昂弥 | 57 |  | 16 |
| 細川 成也 | 75 |  | 15 |
| 郡司 裕也 | 75 |  | 14 |
| 福永 裕基 | 78 |  | 14 |

### Largest negative residuals (final − PowerPro)

| player | final | PowerPro | residual |
| --- | --- | --- | --- |
| 野間 峻祥 | 66 |  | -22 |
| 矢野 雅哉 | 57 |  | -21 |
| カリステ | 63 |  | -19 |
| 京田 陽太 | 61 |  | -17 |
| 小園 海斗 | 65 |  | -14 |
| 丸山 和郁 | 73 |  | -13 |
| 岩田 幸宏 | 83 |  | -13 |
| 林 琢真 | 69 |  | -13 |
| 並木 秀尊 | 85 |  | -12 |
| 友杉 篤輝 | 75 |  | -12 |

## Comparison with old provisional freeze

- changed: 1
- unchanged: 98
- mean absolute change among 99 comparable rows: 0.162
- largest move: モンテロ -16 (recent direct-T90 precedence); this decision predates all PowerPro access.

## Residual structure and The Show

- PowerPro residual structure: **NOT_IDENTIFIABLE**. A position-correlated residual remains an external descriptive finding; no causal correction or position adjustment is added.
- The Show: **INSUFFICIENT**. 235 explicit SPD events, 0 negative events, no defensible unchanged control, and 0 dated pre-update Statcast rows. No 2017–2020 bulk restart and no numeric NPB correction.

## Documented limits

- NPB+ → T90 bridge and production NPB reference CDF remain uncalibrated.
- Comparable 2026 acceleration evidence is largely unavailable.
- 17 video cases remain VIDEO_INCONCLUSIVE with zero usable plays.
- These are uncertainty limits, not open collection tasks.

## QA

- Stage 2 final QA: **PASS** (12/12)
- Rebuild: `node scripts/build_speed_2026_final_reappraisal_external_qa.mjs`

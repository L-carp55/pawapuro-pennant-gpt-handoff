# 2026 NPB 100-player speed post-freeze external QA

Date: 2026-08-10

## Frozen input

Independent freeze commit:

`a77c419613ed33b2d463ad309e755d32df2f632f`

Player table:

`outputs/derived/speed_2026_100_final_freeze_20260810.csv`

No PowerPro or MLB The Show value was used before or during the freeze to set a final rating.

## PowerPro 2026 external comparison

99/100 frozen players could be matched to `pawapuro_full` 2026 by team plus normalized roster name. 名原典彦 has no PowerPro match in this source and was not force-matched.

Results:

| Metric | Post-freeze | Old blind-v3 reference |
|---|---:|---:|
| n | 99 | 99 |
| mean independent/final | 65.444 | 65.445 |
| mean PowerPro | 65.667 | 65.667 |
| mean diff | -0.222 | -0.221 |
| MAE | **7.677** | 7.947 |
| RMSE | **9.756** | 10.018 |
| correlation | **0.781** | 0.766 |
| within 5 | **44.44%** | 42.42% |
| within 10 | **68.69%** | 63.64% |
| abs diff >10 | **31** | 36 |
| abs diff >15 | **11** | 13 |

The small improvement is a diagnostic outcome only. It was not an optimization target and **zero ratings were changed after this QA**.

Old blind-v3 comparison source:

`outputs/derived/speed_blind_v3_powerpro_qa_2026.json` from commit `3be42ff62775cf98eec614f9ee733ae06d565bde`.

## Largest independent > PowerPro residuals

- 古賀優大: 70 vs 46 (+24)
- 村林一輝: 92 vs 69 (+23)
- 宮﨑敏郎: 54 vs 33 (+21)
- 浅村栄斗: 56 vs 35 (+21)
- 大城卓三: 44 vs 24 (+20)
- 山口航輝: 68 vs 52 (+16)
- 石川昂弥: 57 vs 41 (+16)
- 細川成也: 75 vs 60 (+15)

## Largest independent < PowerPro residuals

- 野間峻祥: 66 vs 88 (-22)
- 矢野雅哉: 57 vs 78 (-21)
- カリステ: 64 vs 82 (-18)
- 京田陽太: 61 vs 78 (-17)
- 小園海斗: 65 vs 79 (-14)
- 岩田幸宏: 83 vs 96 (-13)
- 丸山和郁: 73 vs 86 (-13)
- 来田涼斗: 73 vs 85 (-12)
- 友杉篤輝: 75 vs 87 (-12)
- 並木秀尊: 85 vs 97 (-12)

These residuals are review diagnostics, not correction targets. Large residuals can reflect metric-definition differences, missing acceleration evidence, temporal smoothing, or game-side appraisal bias. They are not evidence that the independent physical value should be moved toward the game value.

## The Show external QA

No player-level numerical comparison is asserted for this 100-player NPB roster.

The dedicated The Show history audit established that the available panel is heavily carry-forward based and does not identify a reliable decline/aging/smoothing coefficient. No verified NPB-to-MLB player identity bridge for this roster is present in the decision-packet artifact. Therefore The Show is retained only as a negative-result / methodology QA source.

No final NPB speed value was changed from The Show data.

## Verdict

**External QA PASS for appraisal Gate purposes.**

Reason:

1. the independent scale is broadly centered relative to an external game reference without fitting to it;
2. individual residuals remain large enough to demonstrate that PowerPro was not simply copied;
3. post-freeze QA produced zero rating changes;
4. The Show limitations are explicitly preserved rather than converted into unsupported coefficients.

This verdict does not calibrate a production NPB+ -> T90 bridge or NPB production CDF.

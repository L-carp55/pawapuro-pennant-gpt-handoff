# Catching expected-error research audit

判定: **RESEARCH_ONLY_NOT_ABILITY_READY**

events=142,429 / FE positives=1,401 / prevalence=0.984%

同一年度内でfielder単位のGroupKFoldを行い、対象選手自身の失策を学習せずにexpected FEを予測する。

## out-of-fielder prediction

| model | events | prevalence | Brier | logloss | AUC | AP |
|---|---:|---:|---:|---:|---:|---:|
| base | 142429 | 0.984% | 0.008827 | 0.03654 | 0.936 | 0.140 |
| context | 142429 | 0.984% | 0.008764 | 0.03621 | 0.941 | 0.157 |
| context_workload | 142429 | 0.984% | 0.008790 | 0.03639 | 0.940 | 0.153 |

- `base`: position + batted-ball type + runner presence
- `context`: + coordinates, park, batter side
- `context_workload`: + prior-only defensive workload/rest. Current-game future is not used.

## player residual reliability

| model | split-half players | split-half Pearson | adjacent-year pairs | adjacent-year Pearson |
|---|---:|---:|---:|---:|
| base | 862 | 0.048 | 417 | -0.003 |
| context | 862 | 0.057 | 417 | -0.006 |
| context_workload | 862 | 0.064 | 417 | 0.010 |

Residual = expected FE probability − actual FE. Positive means fewer FE than context expectation. Volume is not added as ability; it only affects uncertainty.

## raw workload descriptives

| prior defensive pitches 14d decile | events | FE rate |
|---|---:|---:|
| (-0.001, 190.0] | 14293 | 1.042% |
| (190.0, 438.0] | 14204 | 0.950% |
| (438.0, 697.0] | 14249 | 0.954% |
| (697.0, 924.0] | 14261 | 1.171% |
| (924.0, 1099.0] | 14222 | 1.048% |
| (1099.0, 1236.0] | 14214 | 0.858% |
| (1236.0, 1366.0] | 14307 | 0.867% |
| (1366.0, 1490.0] | 14227 | 1.047% |
| (1490.0, 1626.0] | 14258 | 0.961% |
| (1626.0, 2369.0] | 14168 | 0.939% |

## acceptance rule

- 難易度・負荷は、out-of-fielder Brier/loglossを改善する場合だけexpected-errorへ残す。
- 捕球能力へ変換する前に、context-adjusted residualがraw/baseよりsplit-halfまたは翌年再現性を改善するか確認する。
- 再現性が弱ければ100段階へ無理に広げず、複数年階層化または追加の打球難度データを待つ。

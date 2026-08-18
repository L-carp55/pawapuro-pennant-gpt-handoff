# SP-101 common-metric bridge feasibility audit — 2026-08-18

Status: **FEASIBLE AS AN INDEPENDENT GAME-APPRAISAL QA LANE — NOT PHYSICAL GROUND TRUTH**

Scope: **走力のみ。肩力・SP-078 owner verdict・SP-079 final ratingは対象外。**

## 1. Owner insight being tested

The useful MLB The Show population is not limited to direct same-player/same-time The Show↔PowerPro overlaps.

A second bridge is possible:

1. Observe which MLB/common indicators are associated with `MLB The Show Speed`.
2. Find NPB player-seasons with a similar, league-normalized common-indicator profile.
3. Observe how those NPB analogs were rated by PowerPro.
4. Use the resulting analog distribution as an **external game-appraisal expectation**, while keeping the independent physical-speed estimate separate.

This is a valid additional route even when no direct The Show↔PowerPro player-year pair exists.

## 2. Available-data feasibility

The available SQLite snapshot already contains enough material to justify a mandatory proof-of-concept route.

| Asset | Measured size | Relevant role |
|---|---:|---|
| `the_show_rating` | 17,476 rows / 5,024 name keys | Multi-edition game attributes |
| `the_show_rating`, Live only | 10,400 rows / 4,424 name keys | Primary The Show appraisal panel |
| `the_show_bridge` | 47 rows | Existing lower-bound NPB-linked The Show set |
| `mlb_bridge` | 79 rows | Existing lower-bound NPB-linked Statcast/MLB set |
| `pawapuro_full` | 3,229 rows / 943 names | Historical PowerPro appraisal panel |
| `pawapuro_full_link` | 1,879 rows / 682 ProEye IDs | PowerPro↔NPB identity bridge |
| `batting` | 17,908 rows | NPB shared basic indicators and opportunity denominators |
| `baserunning_advances` | 22,459 events | First-to-third / second-to-home / extra-base advancement context |
| `infield_grounder_events` | 31,003 events | Infield-hit and GIDP opportunity conditioning |
| `bm_bat` | 5,171 rows | GB%, BABIP and advanced batting context |
| `bm_fld` | 14,488 rows | Range/position context; not pure speed by itself |

A same-year PowerPro↔NPB official-batting join already yields **1,879 PowerPro rows / 682 players**. The 2020, 2022 and 2024 PowerPro works also have **806 same-year advanced BM batting rows** and **801 fielding rows** after the ProEye↔BM bridge.

## 3. Proof of concept A — The Show Speed contains physical-speed signal

The existing bounded `mlb_bridge × the_show_bridge` intersection contains 47 players with both multi-year average Statcast Sprint Speed and average The Show Speed.

- Pearson correlation: **0.8730**
- Spearman correlation: **0.8798**

This is not a final conversion model. The bridge is selected, small, and time-mixed. It nevertheless establishes that The Show Speed is not arbitrary with respect to physical speed and is worth integrating as a separately labelled appraisal source.

## 4. Proof of concept B — common NPB indicators reconstruct PowerPro rating behavior

A deliberately simple analog experiment was run on historical NPB player-years.

### Population

- 968 PowerPro player-year rows
- 393 unique players
- minimum 100 PA
- PowerPro works: 2013, 2014, 2016, 2018, 2020, 2022, 2024

### Shared features

All features were standardized within season:

- stolen-base attempt rate;
- stolen-base success rate;
- triple rate;
- GIDP rate;
- run rate;
- ball-in-play rate;
- single rate;
- double rate.

These are intentionally only a first-pass set. They mix physical speed, technique, batting quality, opportunity and managerial usage. The final route must add the available event-level conditioning and keep physical/technique/aggression traits separate.

### Analog estimator

- distance-weighted k-nearest neighbors;
- `k=30`;
- five-fold GroupKFold by ProEye player ID;
- no player appears in both training and test.

Results:

- MAE: **8.17 PowerPro points**
- R²: **0.505**
- prediction correlation: **0.716**

A ridge screen reached R² 0.523 / MAE 7.99, and an ExtraTrees screen reached R² 0.574 / MAE 7.60. Model dependence is material, so the final pipeline must expose route spread and ablation instead of selecting the most flattering model.

## 5. Correct interpretation

The result does **not** mean:

- basic baserunning outcomes are physical ground truth;
- PowerPro labels should train the physical latent speed;
- The Show Speed should be copied into a current NPB rating;
- a nearest analog must always be produced.

It means:

> Historical PowerPro appraisal behavior is predictable enough from shared, league-normalized indicators that an MLB→NPB analog route can provide an independent game-appraisal expectation and discrepancy check.

The output of this route must be named and stored as something like:

- `the_show_implied_appraisal_percentile`;
- `powerpro_analog_expectation_range`;
- `analog_match_balance`;
- `analog_route_confidence`.

It must never be named `physical_speed_truth` or silently blended into the physical estimate.

## 6. Mandatory final design

### 6.1 Shared-feature families

#### Physical-dominant

- Statcast Sprint Speed / NPB+ top speed, separately labelled because protocols differ;
- H2F / T10 / T30 / T90 where available;
- 30m / 50m with protocol and date uncertainty;
- direct full-effort run counts and exposure.

#### Outcome/context

- SB attempt rate and success rate;
- triples per eligible opportunity;
- GIDP avoidance conditioned on ground-ball opportunities;
- infield hits conditioned on ground balls, direction and batter handedness;
- first-to-third and second-to-home advancement rates;
- UBR/BsR or compatible advancement components;
- pinch-runner usage and tactical role when available.

#### Nuisance controls

- league-season environment;
- PA/opportunity count;
- age and injury availability;
- position and batting side;
- park and team context;
- transition direction and time gap.

### 6.2 Matching

The final implementation must test at least:

1. mutual k-nearest-neighbor matching;
2. calipered Mahalanobis matching;
3. distribution/optimal-transport matching.

All matching operates on league-season standardized or percentile-transformed common features. Raw MLB and NPB rates must not be compared without environment normalization.

No match inside the predeclared caliper means `NO_VALID_ANALOG`, not a forced nearest player.

### 6.3 Four-way triangulation

For each target NPB player, keep four outputs separate:

1. **Independent physical estimate** — PowerPro-label-free direct and physical evidence.
2. **The Show-implied appraisal** — what The Show tends to assign to comparable MLB profiles.
3. **Historical PowerPro-behavior expectation** — what PowerPro tended to assign to comparable NPB profiles.
4. **Contextual observation** — scouting, Community, pinch-running, video and role evidence.

Agreement raises confidence. Disagreement creates a diagnostic reason; it is not automatically averaged away.

## 7. QA requirements

- player-clustered validation;
- forward-season validation in addition to random grouped folds;
- edition-specific The Show effects;
- transition-direction-specific calibration;
- covariate-balance tables for every analog pair;
- feature-family ablation;
- negative controls using non-speed attributes and intentionally irrelevant indicators;
- no PowerPro label in the physical latent path;
- no special/non-Live card contamination in the primary The Show panel;
- no forced analog outside the caliper;
- explicit uncertainty from match distance, temporal gap, source quality and model disagreement;
- current-100 decision-use receipt proving whether this route changed, supported, contradicted or did not affect the appraisal.

## 8. Decision

`MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE` is promoted to a **mandatory P0 SP-101 route**.

It is not sufficient by itself. It must be used alongside direct physical evidence, temporal/transition models, pairwise/ordinal constraints and the separate PowerPro trajectory analysis.

Machine-readable receipt:

`outputs/derived/sp101_common_metric_bridge_feasibility_20260818.json`

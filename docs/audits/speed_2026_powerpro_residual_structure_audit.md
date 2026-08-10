# 2026 NPB Speed — PowerPro Residual Structure Audit

Status: **COMPLETE — V1 INVALIDATED BY INDEPENDENT QA; V2 FINAL QA PASS**

This audit tests whether a comparison with PowerPro reveals a missing physical component in the independent speed design. It does not create or alter any final speed rating, and it does not use PowerPro as a teacher value.

## Critical QA supersession — V1 is not a final result

The independent read-only QA failed requirement 14: known historical short-distance measurements were compared with the 2026 current signal without a case-level temporal-conflict classification. The V1 Stage 1 freeze and every V1 Stage 2 result below are preserved as failure evidence only and must not be used for the final verdict, discrepancy register, SNS queue, or QA PASS.

Failure evidence: scripts/build_speed_2026_blind_physical_construct_profiles.mjs, lines 319-340, could return agreement, metric conflict, or insufficient evidence but never TEMPORAL_CONSTRUCT_CONFLICT. Known 2022 measurements therefore entered the nine-row acceleration subset without an explicit temporal boundary. No rating was changed, but the frozen physical construct and all downstream external diagnostics require a new blind Stage 1 freeze followed by a full Stage 2 rebuild.

The V2 rule is deliberately conservative: a non-2026 physical measurement may be retained as historical evidence, but it must not be directly compared with the current 2026 NPB+ signal. It is classified TEMPORAL_CONSTRUCT_CONFLICT when the dated measurement/current-signal comparison is otherwise relevant, or INSUFFICIENT_SHORT_DISTANCE_EVIDENCE when timing is unknown. No fixed age decay or newly invented conversion threshold is permitted.

## Stage 1 V2 freeze receipt — current hand-off before V2 external analysis

Status: **STAGE_1_V2_FROZEN**

The V2 blind builder generated at 2026-08-10T00:00:02.000Z and was fixed-hash reproducible in two identical timestamped runs. It retains the same physical source commits as V1 and does not open external-game data.

| Artifact | SHA-256 |
|---|---|
| scripts/build_speed_2026_blind_physical_construct_profiles.mjs | f6bc3c4dcf6fd2e47042a9bde55b7f03ba2aed098af5fe3550013a222ae3aacc |
| outputs/derived/speed_2026_blind_physical_construct_profiles.json | 18b44bf3cd3e929a86082ce9c5bab196380436b09a3e48a496f6ce5e2d05b53d |
| outputs/derived/speed_2026_blind_physical_construct_profiles.csv | ed6f6a57346d456f4feadfaaf38b07f8f0138d89be20c7774a59ddf4b0f5bd6b |
| outputs/derived/speed_2026_acceleration_evidence_subset.csv | 18585ee18c6c41d6781ef8191a42e5ab245823b2dc260ae9219b64c31b65bf55 |
| outputs/derived/speed_2026_blind_physical_construct_freeze_manifest.json | 6f9bd97f121d0b6f51e4b1952d4b89ddd0709e4a26fcd4a69cc8c16993094252 |
| outputs/derived/speed_2026_blind_physical_construct_stage1_qa.json | f2075f1ab5d507cf4629ab1e77ac29e79662a3668d8666889068a99b002d2a63 |

V2 coverage is 100 unique profiles: 9 TEMPORAL_CONSTRUCT_CONFLICT, 91 INSUFFICIENT_SHORT_DISTANCE_EVIDENCE, and zero rows in every other comparison class. The usable acceleration subset is zero because only current-2026 comparable rows may enter it. The V2 QA confirms that every known non-2026 comparison measurement is temporal-conflicted, unknown-only timing is insufficient, and no temporal conflict appears in the usable subset.

Stage 2 V2 must consume only this hand-off. It must not use the V1 physical classifications or V1 Stage 2 results.

## V1 historical freeze receipt — invalidated evidence only

Stage 1 was completed on branch `codex/speed-powerpro-residual-structure-audit` from base commit `648f75670d4b97bccce1efeb3ebbab3a06068347`. The build-generated timestamp is `2026-08-10T11:16:33.820Z`.

Physical inputs were fixed to these cited commits:

- Historical anchor bank: `dcf8637f4e94ae51af3bd8f9a99927bfb37bdef3`
- 100-player decision packets: `501f2d6ea638404a71a0026c530ead4cd6567e03`
- NPB+ exposure: `3be42ff62775cf98eec614f9ee733ae06d565bde`

The following SHA-256 receipts are the immutable Stage 1 hand-off to Stage 2:

| Artifact | SHA-256 |
|---|---|
| `scripts/build_speed_2026_blind_physical_construct_profiles.mjs` | `d00bc58f017d5c247515d4335a5edc4edefbc071f7f1fdd3bafa8bc0616072d4` |
| `outputs/derived/speed_2026_blind_physical_construct_profiles.json` | `1f9b6159b7ad87c2603d0c3fefc598bab22672046bb404e95a35866cb7c7a6c6` |
| `outputs/derived/speed_2026_blind_physical_construct_profiles.csv` | `a8f931d8c396a2f002c17f06474a0e855f4544193def62b269dd6b193b1d644e` |
| `outputs/derived/speed_2026_acceleration_evidence_subset.csv` | `4c3e68c52a7ae2c4ed53f1cb6368b78ff5f4f0b66559123718fd6f690f930013` |
| `outputs/derived/speed_2026_blind_physical_construct_freeze_manifest.json` | `d9d38d07ea3edeea1c144405154a320228e71e595fa6b9057e39e27b245e8e9e` |
| `outputs/derived/speed_2026_blind_physical_construct_stage1_qa.json` | `95703f96ef1911545c25151bc18fc4707913ef8c71abca564e0cf71b1b01e924` |

Stage 2 must not alter any of the listed Stage 1 artifacts. Re-running their builder without a new, separately documented freeze is prohibited for this audit.

## Information barrier

Stage 1 did not open, parse, retain, emit, or use PowerPro, Prospi, or MLB The Show values, rankings, residuals, or QA outputs. The exposure source contained an embedded nonphysical game field; the builder removes prohibited keys at the text level before JSON parsing and runs a guard test before serialization.

The first lexical guard stopped a provisional output before finalization. It is preserved in `speed_2026_blind_physical_construct_stage1_qa.json` as `STAGE1_OUTPUT_TEXT_GUARD_TRIP_001`: no prohibited game value was parsed, retained, emitted, or used; free-text passthrough was removed; the rerun passed. The final profile JSON, profile CSV, and acceleration subset contain no restricted game/rating/residual tokens.

## Stage 1 coverage and findings

- Physical profiles: 100 / 100 unique player IDs.
- Direct T90 evidence available: 6.
- Standardized short-distance evidence available: 9.
- Physical-only SNS queue: 19 existing rows retained; additions 0; removals 0. It was generated without game inputs.
- Classification: 97 `INSUFFICIENT_SHORT_DISTANCE_EVIDENCE`; 2 `METRIC_CONSTRUCT_CONFLICT`; 1 `SHORT_DISTANCE_AND_TOP_SPEED_AGREE`; all other allowed classes 0.

The high insufficiency rate is a finding, not a reason to manufacture a cross-metric bridge. No 50m-to-T90 conversion, percentile subtraction across cohorts, fixed age decay, or HP-to-1B promotion to a speed input was used.

## Stage 1 QA

The reproducible builder passed its coverage, uniqueness, label allowlist, source-sanitization, output-token, metric-boundary, age-decay, and HP-to-1B context-only checks. Parent revalidation reran the Stage 1 builder and independently recomputed the listed SHA-256 receipts before any Stage 2 input was opened.

## Stage 2 external residual audit

Status: **V1 SUPERSEDED / DO NOT USE FOR FINAL VERDICT**

Residual definitions were fixed before analysis:

- Residual A = rounded blind-v3 top-speed baseline minus PowerPro 2026.
- Residual B = provisional final physical freeze minus PowerPro 2026.

Both are external diagnostic values only. Positive means the independent value is above PowerPro; negative means it is below PowerPro. They are not correction instructions.

### Matching and coverage

- Dataset rows: 100.
- Strict exact canonical team-aware PowerPro matches: 99.
- Unmatched without forced name matching: 名原典彦 (広島東洋カープ).
- Usable Residual A / B rows: 99 / 99.
- No fuzzy matching, team aliases, or forced match was used.
- The supplied blind-v3 PowerPro QA file is aggregate-only; player-level external values were reconstructed from the local 2026 PowerPro roster table and recorded with explicit provenance in the machine-readable outputs.
- The frozen Stage 1 profile hash matches the freeze manifest before the Stage 2 analysis.

### Exact-position residuals

The exact-position analysis covers C=16, 1B=12, 2B=14, 3B=10, SS=14, LF=10, CF=12, and RF=11. The table reports mean residual A / B; full bootstrap intervals, permutation tests, medians, effect sizes, and sign consistency are stored in outputs/derived/speed_2026_position_residual_analysis.json.

| Position | n | Residual A mean | Residual B mean | Permutation p, A / B |
|---|---:|---:|---:|---:|
| C | 16 | +4.188 | +4.188 | .0612 / .0548 |
| 1B | 12 | +5.000 | +3.667 | .0594 / .1494 |
| 2B | 14 | -2.786 | -2.357 | .3001 / .3881 |
| 3B | 10 | +7.400 | +7.400 | .0123 / .0087 |
| SS | 14 | -3.500 | -3.500 | .1827 / .1845 |
| LF | 10 | +3.600 | +3.900 | .2129 / .1700 |
| CF | 12 | -6.000 | -6.000 | .0300 / .0289 |
| RF | 11 | -8.455 | -8.364 | .0034 / .0032 |

These are descriptive external residuals. They do not establish that any individual position is physically faster or slower after all omitted physical factors are accounted for.

### Predefined position-group residuals

Groups were defined before seeing results: MIDDLE_PREMIUM = SS / CF / RF; MIDDLE_NEUTRAL = 2B; CORNER_CATCHER = C / 1B / 3B / LF. No group membership changed after testing.

| Group | n | A mean, 95% bootstrap CI | B mean, 95% bootstrap CI | Hedges g vs complement, A / B | Permutation p, A / B | Dominant sign, A / B |
|---|---:|---|---|---|---|---|
| MIDDLE_PREMIUM | 37 | -5.784 [-8.514, -2.865] | -5.757 [-8.486, -2.729] | -0.977 / -0.990 | .0001 / .0001 | negative 75.7% / 75.7% |
| MIDDLE_NEUTRAL | 14 | -2.786 [-5.429, -0.357] | -2.357 [-4.643, -0.143] | -0.301 / -0.251 | .3029 / .3823 | negative 57.1% / 57.1% |
| CORNER_CATCHER | 48 | +4.938 [+2.292, +7.583] | +4.667 [+2.104, +7.208] | +1.116 / +1.094 | .0001 / .0001 | positive 64.6% / 64.6% |

The middle-premium versus corner/catcher contrast is large and remains in both residual definitions. The neutral second-base group is not a robust separate finding.

### Matched-speed sensitivity

All 27 requested cells are published in outputs/derived/speed_2026_position_matched_speed_pairs.csv and the position-analysis JSON: three speed windows, three group contrasts, and three age conditions. The 883 unrestricted pair rows use player-cluster bootstrap rather than treating repeated dyads as independent.

The principal middle-premium minus corner/catcher contrast remains negative in every unrestricted speed window:

| NPB+ window | Pair rows | Unique players | Residual A mean difference, 95% cluster-bootstrap CI | Residual B mean difference, 95% cluster-bootstrap CI |
|---|---:|---:|---|---|
| plus/minus 0.1 km/h | 97 | 67 | -12.072 [-17.398, -6.864] | -11.959 [-17.135, -6.543] |
| plus/minus 0.2 km/h | 162 | 69 | -12.364 [-17.271, -7.447] | -12.012 [-16.979, -7.321] |
| plus/minus 0.3 km/h | 227 | 69 | -12.599 [-17.160, -7.992] | -12.300 [-16.729, -7.801] |

Age plus/minus 2 and plus/minus 4 analyses are recorded as NOT_FEASIBLE, not omitted: the frozen inputs contain zero usable ages. Age-unrestricted cells remain descriptive and are not age-adjusted causal estimates.

## Acceleration classification analysis

Only nine players have standardized short-distance evidence in the immutable Stage 1 subset: six insufficient-evidence rows, one short-distance-and-top-speed agreement row, and two metric-construct-conflict rows. The singleton agreement class makes an acceleration coefficient unidentified under leave-one-out validation. Therefore:

- No position-plus-acceleration model was fit.
- No age, handedness, or exposure-expanded acceleration model was fit.
- No partial R-squared or predictive-improvement claim for acceleration was reported.

For the single rare-class descriptive contrast, the exact permutation results are non-supportive: Residual A mean difference +4.375, two-sided p=.888889; Residual B +6.250, p=.777778. The feasible nine-row coarse position-only comparator is not evidence for acceleration: LOOCV MAE is 11.278 with out-of-sample R-squared -0.064 for A, and 7.889 with 0.062 for B. Full reproducibility fields, bootstrap diagnostic intervals, and the explicit non-fit reasons are in outputs/derived/speed_2026_residual_model_comparison.json.

Conclusion: independent short-distance evidence is insufficient to identify a missing acceleration component or to distinguish it from position/archetype structure. This is a data-limit conclusion, not evidence that acceleration is irrelevant to baseball running ability.

## HP to 1B diagnostic

HP to 1B remains context-only. In the 99 matched current rows, raw seconds correlate with Residual A / B at +.269 / +.254. After predefined position-group control, those correlations are -.017 / -.034. The specified historical approximately .061 residual correlation cannot be exactly reproduced because the permitted local rows lack batting-handedness and switch-hitter fields; the available top-speed-plus-PA reduced specification is explicitly labeled non-substitute.

No HP-to-1B field was promoted to an acceleration input or a rating correction.

## Archetype diagnostic

An existing current maximum-exit-velocity field has a position-adjusted association with the external residual (partial R-squared .084 / .076 for A / B; n=95). The association is stable in the reported resampling diagnostics, but it is a diagnostic of position/archetype-correlated external residuals only. It is not a causal mechanism, a power-hitter rule, an acceleration measure, or a speed-rating correction. Age, height, weight, and batting handedness are absent and were not inferred or collected.

## Player-level external discrepancy register

The register contains all 100 targets; residuals are null for the one unmatched player. It classifies every player with absolute residual above 10 on either residual definition: 34 in the union, 34 for Residual A, and 31 for Residual B.

| Classification | Count |
|---|---:|
| INSUFFICIENT_PHYSICAL_EVIDENCE | 18 |
| POWERPRO_HIGH_AND_PHYSICAL_SUPPORTS_FASTER | 2 |
| POWERPRO_HIGH_BUT_PHYSICAL_CONFLICTED | 2 |
| POWERPRO_HIGH_WITHOUT_PHYSICAL_SUPPORT | 2 |
| POWERPRO_LOW_AND_PHYSICAL_SUPPORTS_SLOWER | 5 |
| POWERPRO_LOW_BUT_PHYSICAL_CONFLICTED | 0 |
| POWERPRO_LOW_WITHOUT_PHYSICAL_SUPPORT | 5 |

These labels are external QA classifications, not changes to final values or directions to fit values toward PowerPro.

## Physical-only SNS queue v2 and targeted evidence needs

The queue builder reads only the frozen Stage 1 physical profiles and the frozen old physical-only membership projection. It never reads or emits an external game value, residual, or rating.

| Queue measure | Count |
|---|---:|
| Old physical-only queue | 19 |
| Retained | 19 |
| Added | 16 |
| Removed | 0 |
| Queue v2 | 35 |
| Targeted additional physical-evidence needs | 35 |

The 16 additions arise from physical uncertainty, especially temporal uncertainty, standardized-cohort/current conflict, and anchor-relative unresolved state. They are not authorization to start SNS, video, or web collection. The needs file identifies the kind of future physical evidence that would resolve a case; no collection was performed.

## V1 historical global verdict and causal limits — invalidated

**Global verdict: NOT_IDENTIFIABLE.**

The audit supports the narrower statement:

> position-correlated residual supported; causal source not fully identified.

The grouped and matched-speed position pattern is stable across Residual A and B, but only nine independently usable short-distance cases exist and the acceleration signal has a one-player positive class. The evidence therefore cannot distinguish a missing acceleration component from position/archetype-related structure, omitted physical information, roster/usage composition, or a PowerPro appraisal prior. The correct response is not a position correction, an acceleration coefficient learned from PowerPro, or a final-rating change.

## Negative findings and retained limits

- No independent acceleration-component claim is supported.
- No causal PowerPro position/archetype-prior claim is supported.
- No PowerPro-based speed correction is authorized.
- No HP-to-1B acceleration correction is authorized.
- No age-controlled matched-speed analysis is available because frozen age coverage is zero.
- No handedness or switch-hitter HP-to-1B sensitivity is available because those fields are absent.
- No 50m-to-T90 conversion, cohort-percentile subtraction, fixed age decay, game-rating anchoring, SNS collection, video collection, shoulder work, or final rating generation occurred.

## QA history and next step

The Stage 1 lexical guard trip STAGE1_OUTPUT_TEXT_GUARD_TRIP_001 was detected before finalization and remediated without parsing or emitting a prohibited game value. Agent D also preserved one initial runtime failure caused by a restricted local git child process, followed by a documented remediation that consumes only the already frozen physical-only queue membership from Stage 1 QA. Neither failure changed a classification or a final value.

The first integrated QA run is also retained as QA_INITIAL_SCHEMA_FIELD_CHECK_001. It failed one validator-only check because the QA script used shortened residual-field aliases for 名原典彦 while the discrepancy register stores documented full field names. The register itself already held explicit null residuals, and no source record, classification, or final value changed. The QA script was corrected to inspect the documented fields and records this first failure in its final machine-readable output.

The independent read-only QA has now passed all 18 required checks. It verified the Stage 1 V2 freeze, 100/100 coverage, the 99/100 exact-match boundary, all requested matched-speed cells, the zero-row acceleration subset and non-fit, strict queue separation, no final-rating change, reproducible scripts, and this audit's completeness.

## V2 final external residual results

Status: **V2 ANALYSIS COMPLETE / FINAL INDEPENDENT QA PASS (18/18)**

Only the Stage 1 V2 freeze above was consumed. V1 Stage 2 artifacts were not read or used for the V2 calculations. Residual A remains rounded blind-v3 top-speed baseline minus PowerPro 2026; Residual B remains provisional final physical freeze minus PowerPro 2026. Both are external diagnostics only.

### V2 matching, positions, and matched-speed analysis

- Targets: 100; exact canonical team-aware PowerPro matches: 99; 名原典彦 remains the sole unmatched player with null residuals and no forced match.
- Both residuals have 99 usable rows.
- Exact positions are C=16, 1B=12, 2B=14, 3B=10, SS=14, LF=10, CF=12, and RF=11.
- All eight exact positions, three frozen groups, and all 27 matched-speed cells were recomputed.
- Unrestricted matched-speed pairs: 883, with player-cluster bootstrap.
- Age plus/minus 2 and plus/minus 4 remain explicitly NOT_FEASIBLE because the frozen source contains zero ages. All nine unrestricted cells are still reported.
- V2 position output verifies the V2 Stage 1 profile hash before calculating and records zero rating changes.

| Predefined group | n | Residual A mean, 95% bootstrap CI | Residual B mean, 95% bootstrap CI | Permutation p, A / B |
|---|---:|---|---|---|
| MIDDLE_PREMIUM (SS/CF/RF) | 37 | -5.784 [-8.514, -2.865] | -5.757 [-8.486, -2.729] | .0001 / .0001 |
| MIDDLE_NEUTRAL (2B) | 14 | -2.786 [-5.429, -0.357] | -2.357 [-4.643, -0.143] | .3029 / .3823 |
| CORNER_CATCHER (C/1B/3B/LF) | 48 | +4.938 [+2.292, +7.583] | +4.667 [+2.104, +7.208] | .0001 / .0001 |

At the three unrestricted NPB+ matching windows, middle-premium minus corner/catcher remains negative for both residual definitions: -12.072 / -11.959 at plus/minus 0.1 km/h, -12.364 / -12.012 at plus/minus 0.2 km/h, and -12.599 / -12.300 at plus/minus 0.3 km/h. The full 27-cell sensitivity table, including the explicitly infeasible age conditions, is stored in outputs/derived/speed_2026_position_matched_speed_pairs.csv.

This is a stable position-correlated external pattern. It is not evidence for a position correction or a causal claim about why the pattern exists.

### V2 acceleration analysis

The V2 acceleration-evidence subset is **0**, not 9. The nine known non-2026 measurement/current-signal comparisons are all TEMPORAL_CONSTRUCT_CONFLICT and are excluded from the usable current-acceleration subset; 91 other players remain INSUFFICIENT_SHORT_DISTANCE_EVIDENCE.

For both residuals, the position-only, acceleration-only, position-plus-acceleration, age, handedness, and exposure model entries have n=0, fit_performed=false, and NO_USABLE_CURRENT_ACCELERATION_EVIDENCE. No cross-validation, partial R-squared, permutation importance, bootstrap coefficient, or acceleration correction was manufactured.

V2 conclusion: **NOT_IDENTIFIABLE / NO_USABLE_CURRENT_ACCELERATION_EVIDENCE** for a missing acceleration-component claim.

### V2 HP to 1B and archetype diagnostics

These diagnostics retain their requested scope but remain noncausal and noncorrective:

- HP to 1B raw seconds correlation with Residual A / B: +.269307 / +.253815 (n=99).
- PA at least 200: +.410194 / +.377999 (n=60).
- After predefined position-group control: -.016961 / -.033706 (n=97).
- Left-handed exclusion and switch-hitter splits remain unavailable because the permitted fields lack handedness.
- Existing maximum exit velocity remains a diagnostic-only position-adjusted association: n=95 and partial R-squared .084127 / .075541 for A / B.

HP to 1B is context-only; neither it nor the archetype association is an acceleration measure, causal explanation, or rating correction.

### V2 player discrepancy register and physical-only SNS queue

All 100 targets are present in the external discrepancy register. Residual A / B coverage is 99 / 99; all 34 players with absolute residual above 10 on either definition are classified.

| V2 external-QA classification | Count |
|---|---:|
| INSUFFICIENT_PHYSICAL_EVIDENCE | 14 |
| POWERPRO_HIGH_AND_PHYSICAL_SUPPORTS_FASTER | 2 |
| POWERPRO_HIGH_BUT_PHYSICAL_CONFLICTED | 4 |
| POWERPRO_HIGH_WITHOUT_PHYSICAL_SUPPORT | 2 |
| POWERPRO_LOW_AND_PHYSICAL_SUPPORTS_SLOWER | 5 |
| POWERPRO_LOW_BUT_PHYSICAL_CONFLICTED | 2 |
| POWERPRO_LOW_WITHOUT_PHYSICAL_SUPPORT | 5 |

The physical-only SNS queue V2 has 25 rows: 19 retained, 6 added, and 0 removed. All nine known non-2026 temporal conflicts are handled as physical temporal uncertainty where relevant; unknown-only eras are not falsely called temporal conflicts. The 25 targeted additional-physical-evidence entries are a future evidence-needs register, not authorization to conduct SNS, video, or web collection.

Queue generation reads only frozen V2 physical profiles and the frozen V2 physical-only queue source. It reads and emits no PowerPro, residual, rating, blind-baseline, or final-freeze field.

### V2 global verdict

**Global verdict: NOT_IDENTIFIABLE.**

The supported statement is:

> position-correlated residual supported; causal source not fully identified.

The V2 position and matched-speed external pattern is robust across both residual definitions. However, once known historical measurements are handled correctly, no current comparable short-distance evidence remains. The audit therefore cannot distinguish an omitted acceleration component from position/archetype-related structure, omitted physical evidence, roster/usage composition, or a PowerPro prior.

No final speed rating was generated or changed. No position correction, acceleration coefficient learned from PowerPro, HP-to-1B correction, 50m-to-T90 conversion, fixed age decay, game anchor, SNS collection, video collection, or shoulder work occurred.

### V2 QA history and final independent check

The V1 independent QA failure for temporal handling is preserved as STAGE1_TEMPORAL_BOUNDARY_QA_FAIL_002. V2 remediates it with an immutable hash freeze and explicit current-year-only usable acceleration rule. The earlier lexical barrier guard, Agent D runtime failure, and first integrated-QA schema-check failure also remain recorded above.

The second independent read-only QA has passed **18/18**. It independently rechecked the V2 temporal boundary (all 9 dated non-2026 cases are TEMPORAL_CONSTRUCT_CONFLICT), all freeze hashes, the empty acceleration subset and non-fit, the 99/100 matching boundary, all 27 matched-speed cells, strict queue separation, no rating changes, all five reproducibility scripts, and this decision record. No blocking issue remains.

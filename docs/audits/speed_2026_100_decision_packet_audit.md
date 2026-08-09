# 2026 NPB Sprint Speed 100-player decision-packet audit

Generated: 2026-08-09T17:15:37.814Z

## Scope and hard boundaries

- This artifact prepares evidence packets for human/browser-GPT final judgment. It creates **no final speed rating**, target, range, or calibration correction.
- Scope is pure running ability from the first running step through roughly 90ft. It excludes stealing skill, baserunning judgment, swing-to-run transition, and infield-hit outcomes.
- PowerPro and MLB The Show are external temporal/blind QA only. They are absent from anchor selection, edge generation, and review-priority calculations.
- 50m and 30m records are preserved as ordinal/acceleration evidence only. This builder contains no 50m-to-T90 or 30m-to-T90 conversion.
- PA and full-effort-run proxies are review-confidence fields only. They never change a rating because this builder does not generate ratings.

## Frozen input provenance

| Input | Repository / branch | Commit | Consumed files |
|---|---|---|---|
| appraisal_policy | L-carp55/pawapuro-pennant-gpt-handoff / agent/appraisal-principles-20260809 | `179e03c76c4379f4372da722741b1a705df66974` | `CLAUDE.md`<br>`docs/satei_handoff/12_APPRAISAL_PRINCIPLES_20260809.md`<br>`docs/satei_handoff/13_CURRENT_CRITICAL_PATH_20260809.md` |
| physical_evidence | L-carp55/pawapuro-pennant-gpt-handoff / codex/speed-physical-evidence-full | `94a26e7160a879ea0e13f4ddb91d4fdadc7c04e9` | `data/manual/npb_speed_physical_evidence_full_20260809.json`<br>`outputs/derived/npb_speed_evidence_coverage_20260809.csv`<br>`data/manual/standardized_50m_electronic_reference.json`<br>`data/manual/standardized_30m50m_photoelectric_2026.json`<br>`data/manual/sprint_30m_measurements_curated.json` |
| measurement_date_resolution | L-carp55/pawapuro-pennant-gpt-handoff / codex/speed-measurement-date-resolution | `b374d1cb543e2035d9a18230e3b9245a616c6275` | `outputs/derived/npb_speed_measurement_date_resolution_20260809.json` |
| exposure_audit | L-carp55/pawapuro-pennant-gpt-handoff / codex/npb-sprint-exposure-audit | `3be42ff62775cf98eec614f9ee733ae06d565bde` | `outputs/derived/npb_plus_sprint_exposure_2026.json` |
| powerpro_history | L-carp55/pawapuro-pennant-gpt-handoff / codex/pawapuro-speed-history-panel | `19fad9848b782c95bcdd97449fa5a9768da9f9b3` | `outputs/derived/pawapuro_speed_history_panel_2015_2026.json` |
| the_show_speed_history | L-carp55/claude-code-hub / codex/mlb-the-show-speed-history | `97c429521267cfb70ccdd61e40e11853d100e360` | `docs/audits/mlb_the_show_speed_history_audit.md`<br>`data/qa/collection_audit_summary.json` |
| the_show_full_attributes | L-carp55/claude-code-hub / codex/mlb-the-show-full-attributes | `74d2a2278ab7bcea3f6368e1df6ba03e2dd82554` | `docs/audits/mlb_the_show_full_attribute_history_2017_2026.md`<br>`outputs/derived/mlb_the_show_full_attribute_summary_2017_2026.json`<br>`outputs/derived/mlb_the_show_live_roster_attributes_2017_2026.csv` |

The NPB input snapshots required for reproducibility are committed into this branch at their listed paths. The Show artifacts are recorded as external-QA provenance because no verified player-level NPB/MLB ID bridge exists for this roster.

## Join coverage and identity handling

- Master roster seed: exposure dataset **players[]** = **100/100** rows.
- Physical join: **100/100** exact normalized name+team matches.
- Measurement-date records: **35** records across **34** players; attached by **measurement_cluster_id**, never by a date-only overwrite.
- Blind-v3: **99/100** exact player-ID joins. 名原典彦 remains **SOURCE_ROW_ABSENT**; no formula-based replacement was created.
- Exact PowerPro ID-to-summary joins: **95/100**. Missing or conflicting history IDs remain flags rather than forced name matches.
- 名原典彦 is present: **true**. The source player ID remains null.

PowerPro exception handling is retained in packets: 宗佑磨, 牧秀悟, 丸佳浩, and 名原典彦 have no exact history-ID match; ソト is an ID conflict requiring review; 松本剛 retains an exact historical link but keeps the separate unresolved 2026 rows out of that trajectory.

## Evidence and temporal distributions

### Source physical evidence tier

- A: 6
- B: 39
- D: 4
- unknown: 51

### Decision-usable evidence tier (no date-based promotion)

- CURRENT_DIRECT_T90_CANDIDATE: 2
- HISTORICAL_PROFILE_HINT: 35
- SPRINT_ONLY: 56
- STANDARDIZED_SHORT_DISTANCE_PRIOR: 7

### Temporal candidates

- CONFLICTED: 3
- CURRENT_SUPPORTED: 78
- TEMPORAL_UNKNOWN: 19

No **IMPROVEMENT_SUPPORTED**, **DECLINE_SUPPORTED**, or **STABLE_CARRY_FORWARD** state is fabricated from game ratings, carry-forward rows, age, or unmatched metrics.

### PowerPro external-QA joins

- EXACT_ID_TO_SUMMARY: 95
- ID_CONFLICT_REQUIRES_REVIEW: 1
- MISSING_EXACT_ID_MAPPING: 4

For every exact history ID, trajectory nodes are rebuilt from raw observations after excluding all same-player/same-date conflicting speed dates. The pre-existing change-event and summary files are not used because their historical builder calculated changes before conflict exclusion.

- Global source-panel same-date conflict receipts retained: **32**.
- Exact target-ID trajectories with a retained raw conflict receipt: **3**.

## Pairwise graph

- Nodes: 100
- Edges: 154
- Physical-corroborated edges: 2
- Sprint-only low-confidence ordinal candidates: 152
- **CLEARLY_FASTER_THAN** / **CLEARLY_SLOWER_THAN**: 0 (measurement error / repeat-test precision is not available).
- **SIMILAR_BAND**: 0 (same displayed T90 across different years is not treated as same-condition evidence).

The two physical-corroborated current candidates are only 林琢真 → 奈良間大己 and 友杉篤輝 → 奈良間大己. 林琢真 ↔ 友杉篤輝 is intentionally suppressed because shared 2022 electronic 50m ordering conflicts with 2026 NPB+ ordering. All other graph edges are explicitly marked **CURRENT_NPB_PLUS_ORDINAL_CANDIDATE** / **LOW**, not comparable T90 evidence.

## Human review queue

- P0: 2
- P1: 55
- P2: 43

All 100 records remain **human_judgment_required=true** because this handoff does not decide final ratings.

## Conflict and missing-data register

- BLIND_V3_SOURCE_ROW_ABSENT: 1
- DIRECT_T90_PRESENT_NPBPLUS_BRIDGE_UNCALIBRATED: 2
- IDENTITY_SOURCE_ID_MISSING: 1
- NPB_PLUS_SAMPLE_COUNT_OR_QUALIFIED_RUN_COUNT_NOT_PUBLISHED: 100
- POWERPRO_SAME_DATE_CONFLICT_EXCLUDED_FROM_TRAJECTORY: 3
- POWERPRO_TEMPORAL_QA_UNAVAILABLE_OR_CONFLICTED_ID: 5
- PROTOCOL_OR_MEASUREMENT_YEAR_UNCERTAINTY: 39
- STANDARDIZED_50M_CURRENT_NPBPLUS_DIRECTION_CONFLICT: 2

Negative findings:

- NPB+ measurement sample count / qualified run count is not publicly documented in the source artifact; PA/proxy are not treated as a substitute.
- No exact measurement date is established by the date-resolution artifact; inferred years improve only temporal joins.
- The 2026 photoelectric 30m/50m cohort has no normalized-name overlap with this 100-player roster.
- The Show history has extensive carry-forward rows and no proven Statcast join; it cannot establish an NPB player's physical trajectory here.
- Injury data were not among the approved source artifacts. The packets state that limitation rather than infer injury effects.
- **NEEDS_ADDITIONAL_EVIDENCE** is retained where a final reviewer would need information outside the approved artifacts.

## Build QA

| Check | Status | Detail |
|---|---|---|
| master_roster_exactly_100 | PASS | rows=100 |
| decision_packets_exactly_100 | PASS | packets=100 |
| no_duplicate_roster_row | PASS | roster_row_id unique |
| 名原典彦_included_and_source_id_uninvented | PASS | player_id remains null; blind-v3 row remains absent |
| sprint_source_join | PASS | 100/100 current Sprint values retained from exposure source |
| physical_join | PASS | 100/100 normalized name+team joins |
| measurement_date_cluster_join | PASS | attached=35 source=35 |
| blind_v3_join_and_missing_row | PASS | 99 exact, 1 source absence |
| same_date_powerpro_conflicts_excluded | PASS | all exact-ID trajectories rebuilt after excluding conflict dates |
| no_50m_or_30m_t90_conversion | PASS | builder preserves metrics and emits no converted T90 values |
| powerpro_or_the_show_not_in_pairwise_graph | PASS | graph evidence contains physical / NPB+ source layers only |
| no_final_rating_key_generated | PASS | prohibited_key=none |
| reproducible_input_presence | PASS | all fixed local input snapshots present |

### Build QA correction history

| Run | Status | Check | Finding | Correction | Resolution |
|---|---|---|---|---|---|
| initial_generated_artifact_check | FAIL | no_final_rating_key_generated | The safeguard boolean key powerpro_rating_used_for_final matched the forbidden-key detector. No final-rating value was generated, but the name made the guard ambiguous. | Renamed the non-input safeguard to powerpro_contributes_to_final_value and final_speed_value_generated, then reran the full builder. | PASS on rerun |

## Independent QA

Status: **PASS**

All twelve independent checks passed. The initially gated persistence/readable-audit check was corrected by saving this machine-readable matrix, rebuilding the audit, and completing a final independent read-only reflection check.

### Independent QA checks

| Check | Status | Evidence |
|---|---|---|
| master_packets_csv_and_review_queue_exactly_100 | PASS | master JSON=100, packets=100, master CSV=100, review queue=100. |
| roster_identity_keys_unique | PASS | 100 normalized name+team keys unique, 99 non-null source IDs unique, and 100 roster/join keys unique. |
| nahara_preserved_without_invented_source_id | PASS | 名原典彦 remains player_id=null with fallback-name-team key and blind SOURCE_ROW_ABSENT; source/output Sprint=33.7, PA=222, proxy=28. |
| sprint_values_labels_and_urls_match_exposure_source | PASS | 100/100 current Sprint values, labels, and URLs exactly match the exposure source. |
| exposure_and_proxy_fields_preserved | PASS | PA, games, full-effort proxy, sample fields, PA bucket, and packet copies match for 100/100 players. |
| physical_evidence_and_coverage_preserved | PASS | 100 physical players and 101 source records equal 101 output records; raw-field, coverage, tier, and count mismatches=0. |
| measurement_date_records_attached_by_exact_cluster | PASS | All 35 date-resolution records are attached exactly once by measurement cluster; 15 inferred-year records retained; evidence tier, usage, and numeric-T90 flags unmutated. |
| powerpro_clean_trajectory_excludes_same_date_conflicts | PASS | 95 exact-ID trajectories independently rebuilt; no clean node occurs on a target conflict date. Target receipts: 水野達稀 2024-07-18 [68,71]; 秋山翔吾 2026-06-11 and 2026-06-30 [69,77]; 塩見泰隆 2018-04-26 [69,82]. Global source registry=32. |
| no_short_distance_t90_conversion | PASS | No derived short-distance T90 field exists; exactly six raw direct-T90 records are retained as six. Static builder check: direct-only classification at lines 268+, 50m ordering at lines 819+. |
| pairwise_graph_is_valid_and_excludes_game_ratings | PASS | Graph=100 nodes/154 unique edges: 152 CURRENT_NPB_PLUS_ORDINAL_CANDIDATE and 2 CORROBORATED_STANDARDIZED_AND_CURRENT_NPB_PLUS. Directions/support evidence independently validate; no PowerPro/The Show value occurs in an edge; anchors resolve to edges; review priority contains no game speed/rating input. Required packet, queue, and edge fields are present. |
| independent_qa_artifact_and_audit_reflection | PASS | Initial stable snapshot had no independent QA artifact and audit stated PENDING. This artifact was serialized, the audit was rebuilt, and the final independent read-only reflection check passed. |
| reproducible_rebuild_matches_delivered_artifacts | PASS | Isolated copy rebuilt with Node status PASS; both CSV outputs are byte-identical and all four JSON outputs are semantic-identical after ignoring generated_at; audit is identical after ignoring generated timestamp. P0=2, P1=55, P2=43. |

### Independent QA initial gate and correction record

| Check | Initial status | Finding | Correction | Resolution |
|---|---|---|---|---|
| independent_qa_artifact_and_audit_reflection | GATED | The initial independent QA snapshot found no saved independent QA artifact and audit lines 136-138 reported PENDING, leaving important QA evidence only in the QA message. | Saved this machine-readable QA matrix, added readable audit rendering, rebuilt all artifacts, then requested a final independent read-only recheck. | PASS |

### Independent QA source provenance

| Scope | Status | Detail |
|---|---|---|
| input_snapshot_and_origin_ref_verification | PASS | All listed local origin refs equal manifest commits; NPB input blobs match after CRLF normalization and JSON semantic parsing. |
| the_show_external_provenance | PASS | The Show refs resolve to manifest commits 97c4295 and 74d2a22. They remain external-QA provenance only; no player-level NPB/MLB identity bridge is asserted. |

### Independent QA limitations

- This QA validates integration, preservation, provenance, and reviewability; it does not assign or approve any final PowerPro speed rating.
- PowerPro and MLB The Show values were checked only as prohibited decision inputs and temporal/external-QA metadata; neither is an anchor, pairwise-edge input, or final-rating input.
- No 30m or 50m record has been converted into T90; raw direct-T90 records remain distinct from standardized short-distance evidence.
- The independently reread audit now includes all 12 checks, the initial gate/correction record, source provenance, and limits; no material QA result remains only in chat.


## Browser-GPT handoff notes

1. Use **speed_2026_100_decision_packets.json** for player-by-player review. Treat **blind_v3_baseline** as display-only provisional context, not a result to adopt.
2. Start with P0, then P1, then P2 queue order. Inspect every packet before setting any final value.
3. Do not use a PowerPro or The Show number to move a final rating. Use those histories only to ask why a physical observation may be old or contradictory.
4. For a packet marked **INSUFFICIENT_PAIRWISE_EVIDENCE**, leave the comparison unresolved rather than manufacturing an anchor.
5. If outside evidence becomes essential, mark it **NEEDS_ADDITIONAL_EVIDENCE**; this task does not authorize new large-scale collection.

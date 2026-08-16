# OPUS speed pre-owner-review wave — independent QA

Date: 2026-08-16

This is an independent re-read and local execution check. It does not regenerate individual workstream artifacts, modify the registry, collect external data, or enter owner verdicts.

## Result

- **25 PASS / 0 FAIL — PASS**
- Registry QA: PASS; SP-016 receipt: 8 PASS / 0 FAIL; SP-098 receipt: 16 PASS / 0 FAIL; SP-100 read-only QA: 57 PASS / 0 FAIL.
- Real owner verdicts: **0**.

## Content-level conclusions

- SP-016: repaired mode is production default. At 50 PA or more history is exactly absent; below 50 PA the coherent zero-centred prior uses kappa=50 and lambda=50/505. Raw 520 historical-PA median is reproduced before split-team deduplication; corrected calibrated cohort is 260 / 241 / 505.
- SP-098: 名原 is `BM_PLAYER:20230057` with batting coverage missing, Santana is exact `53755153`, and Shiomi is exact `71975136` with AB=0/non-batting schema retained. Negative same-surname/wrong-team/wrong-id cases reject.
- SP-100: remains PARTIAL. `N_PRIMARY_S_CONTEXT_OR_FALLBACK` is a technical recommendation only; no post-v2 owner ruling was found, no production architecture is implemented, and `hp_to_1b_sec` remains rejected.
- SP-077: exact 100/100 unique stable rows, zero verdicts, dependency fixture rejects an open declared dependency, and the human report contains readable SP-074 states.
- SP-078: initialized empty ledger binds to the final queue hash; ordinary overwrite rejects and explicit amendments preserve history.
- SP-075/Community invariant hashes and the production scale-finalization configuration are unchanged. No new external collection, shoulder work, SP-079/SP-080/SP-081 work, individual PowerPro teacher, or future-year annual-appraisal weighting was found.

## Exact remaining blockers to SP-079

- Explicit owner approval of the SP-100 production-wiring architecture is still required; SP-100 remains PARTIAL and production behavior is unchanged.
- Owner verdicts have not been entered: SP-078 ledger intentionally contains zero real verdicts.

## Non-blocking provisional limitation

- SP-071 absolute 0-100 scale finalization remains blocked on the engine bridge; it is retained as a provisional label, not a declared SP-079 dependency.

## Check ledger

| Check | Result | Detail |
|---|---|---|
| TASK_SCOPE_RE_READ | PASS | full task scope guards present |
| REGISTRY_QA_EXECUTES_PASS | PASS | PASS: requirements=61, tasks=72, exclusions=25, open_exclusions=3, unresolved_terminal=2, owner_review_task_blockers=0, owner_review_dependency_task_blockers=0, owner_review_dependency_exclusion_blockers=0, owner_review_non_dependency_exclusion_blocks=3, gate_task_blockers=15, gate_exclusion_blockers=3<br>SP-077 is fail-closed on its declared dependencies; the global Speed Gate remains fail-closed until all gate blockers reach zero.<br> |
| REGISTRY_DIRECT_ROWS_CONTENT_LEVEL | PASS | {"SP-016":["DONE_VALIDATED","0","0"],"SP-098":["DONE_VALIDATED","0","0"],"SP-100":["PARTIAL","0","1"],"SP-077":["DONE_VALIDATED","0","0"],"SP-078":["DONE_VALIDATED","0","0"]} |
| EX009_TRANSFORMATION_CLOSED_WITH_REPAIRED_EVIDENCE | PASS | VALID_TRANSFORMATION_EXCLUSION |
| SP016_RECEIPT_8_PASS_0_FAIL | PASS | {"genuinely_failable":true,"pass_count":8,"fail_count":0} |
| SP016_CALIBRATION_AND_REPRODUCTION_FACTS | PASS | {"repaired_median":505,"raw_median":520,"lambda":0.09900990099009901} |
| SP016_ALL_INVARIANTS_AND_REJECTION_FIXTURES | PASS | {"invariant_count":10,"rejection_fixtures":6} |
| SP016_DYNAMIC_MONOTONE_ZERO_AND_MALFORMED_FAIL_CLOSED | PASS | {"history_at_49":0.33557046979865773,"history_at_50":0} |
| SP016_PRODUCTION_PATH_AND_IDEMPOTENT_PURE_CALLS | PASS | {"player_id":"01005159","pool_reason":"LOW_SAMPLE_CURRENT_YEAR_HISTORY_PRIOR","seasons":[2024,2025]} |
| SP098_RECEIPT_16_PASS_0_FAIL | PASS | {"passed":16,"failed":0,"result":"PASS"} |
| SP098_DYNAMIC_IDENTITY_COVERAGE_AND_NEGATIVES | PASS | {"nahara":"BM_PLAYER:20230057","santana":"53755153","shiomi":"71975136"} |
| SP098_NO_SELF_FULFILLING_ID_CHECK | PASS | no non-empty-id shortcut |
| SP100_RECEIPT_57_PASS_0_FAIL | PASS | SP-100 independent QA: 57 PASS / 0 FAIL<br> |
| SP100_OWNER_BOUNDARY_RECOMMENDATION_ONLY | PASS | {"status":"PARTIAL","recommendation":"N_PRIMARY_S_CONTEXT_OR_FALLBACK"} |
| SP100_TOP_SPEED_ONLY_AND_RAW_PROVENANCE_GUARD | PASS | {"hp_to_1b_sec_used":0,"reliability":"NOT_IDENTIFIABLE"} |
| SP100_PACKET_SOURCE_HASHES_CURRENT | PASS | {"verified_sources":17} |
| SP077_QUEUE_EXACT_100_UNIQUE_AND_BLANK | PASS | {"rows":100,"verdicts":0} |
| SP077_DEPENDENCY_GATE_PROVISIONAL_AND_HUMAN_REPORT | PASS | {"fixture":"{\"fixture\":\"open_declared_sp077_dependency\",\"result\":\"PASS\"}\r\n","provisional":"PARTIAL"} |
| SP077_SOURCE_HASHES_AND_SCOPE_GUARDS | PASS | {"verified_sources":7,"scope_guards":{"no_external_collection":true,"no_shoulder_work":true,"no_sp079_sp080_sp081":true,"no_owner_verdicts_created":true,"no_powerpro_individual_teacher":true,"no_future_year_annual_appraisal_weighting":true}} |
| SP078_EMPTY_LEDGER_LINKED_TO_FINAL_QUEUE | PASS | {"rows":100,"verdict_count":0} |
| SP078_NO_OVERWRITE_SELF_TEST | PASS | {"self_test":"PASS","duplicate_overwrite_rejected":true,"explicit_amendment_preserves_history":true}<br> |
| SP075_AND_COMMUNITY_INVARIANT_HASHES_UNCHANGED | PASS | {"outputs/derived/sp075_stale_conflict_rediagnosis_v4_20260816.json":"610db284b6c4d55adc507d217d503fff108026f7ad13cbfc9f6a4a68d4a8a250","outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl":"ce5b1a3f0c002daa36a2dc86678a596edc95be4e4e57716072894c8f11921a85","outputs/derived/speed_community_v3_canonical_20260815.jsonl":"9bb9e9cc0df7646840e7b584756d7501ecad475df1410ebc72d549fda09ad058","outputs/derived/speed_x_excluded_prospi_20260816.jsonl":"aade4c19937484741ccb4b3622e1596d3a241b333bfb63a10a89d0561e09ec0d"} |
| PRODUCTION_SCALE_FINALIZATION_UNCHANGED | PASS | {"slope":1.8883315802194052,"intercept":-29.54411881474512,"n":260} |
| NO_POWERPRO_TEACHER_OR_FUTURE_ANNUAL_WEIGHTING | PASS | repaired sources contain no PowerPro teacher or future-year weighting path |
| NO_EXTERNAL_COLLECTION_AND_FORBIDDEN_WORK_SCOPE | PASS | {"changed_path_count":1,"changed_scripts":0} |

## SHA-256 of key artifacts

- `configs/running_norms.json`: `4439795b9452c8d3cdb6a2a8e3bc0811ed3aa3b8071e7f2135908c11f8d985cd`
- `docs/state/speed_task_registry.tsv`: `4cb96a0be7fd263b94f86f736f24921288a5b6e2c15cead56771ddeffbae57b0`
- `docs/state/speed_exclusion_reason_ledger.tsv`: `bcf0f5e743fb08f57590007ecca80c333a8eea43964102859adbff7264349c8a`
- `src/ratings/durable_traits.mjs`: `040a205c523bdd3917f2c17026d5b13b89142a3934d62984dad2d78fb004b7cd`
- `src/cards/durable_estimate.mjs`: `dcccc0f3f9892aac9f0aafd642c4b92c0d6c005c2f2cdf4c825b87995d36d3e8`
- `src/cards/pipeline.mjs`: `4be4c897f775f5999cdda7146422b811194b0ee2ea799858a6064dc675e539bc`
- `scripts/qa_speed_task_registry.mjs`: `73a48efd04d213a289fb959494f3f88f48da9054862edd44c3fc36ed0abadaac`
- `scripts/sp016_current_year_first_repair_qa_20260816.mjs`: `4bab605d00fd9ad17c3bbf3e5c035dc21bb3e0ddcbd17e3c5f621789604d950d`
- `outputs/derived/sp016_current_year_first_repair_qa_20260816.json`: `cf4bbb7baa4039489c61c43b2d5e3598e1b3be52e5677e42f8300c7dacac4d19`
- `docs/audits/sp016_current_year_first_repair_20260816.md`: `7e0b5f047b640a16bff9b7e8ae62e1134ea93b79a8c150a047eebc6f7fdf5f5d`
- `scripts/sp098_identity_coverage_qa_20260816.mjs`: `36ad6ee724721d6c8a43dfbf81f5008513e50d035a09557f6b8a54181c98ca55`
- `outputs/derived/sp098_identity_coverage_qa_20260816.json`: `4887935877ec968027d8aa2d62893e87875e9c8414c8c4991d0fc36edbed4c81`
- `docs/audits/sp098_identity_coverage_qa_20260816.md`: `1413d978e74de7f423f60969658d12a079933e7a1bdffd8d3cd05a051c77be8d`
- `scripts/sp100_production_wiring_decision_packet_20260816.mjs`: `5a8f208326bbf68421ff333ad815d1fd0549e0f8d4738176e896adc27f255941`
- `scripts/qa_sp100_production_wiring_decision_packet_20260816.mjs`: `580f34654843a004dc10e31eb5098333ea9fb1390e43d7a0db9aa0d631f6255b`
- `outputs/derived/sp100_production_wiring_decision_packet_20260816.json`: `f339f69d10afd89aaecfc639396e0c5742c8a72cf8cc65a328cf97a39e1ff99e`
- `docs/audits/sp100_production_wiring_decision_packet_20260816.md`: `8cf223259123419f31bfcbc8435f26ee52b5ceb90920e30baf46ed8cfcc957e1`
- `scripts/build_sp077_final_owner_review_queue_20260816.mjs`: `6a3d4f36af55d5381ee9bee9357debec56f8ec83066fcbe900b3b211f76e2259`
- `outputs/derived/sp077_final_owner_review_queue_20260816.json`: `757e3d5dd51fe86c0238cbbe4be614839ae647541d9a048caeab23bf732e5287`
- `outputs/derived/sp077_final_owner_review_queue_20260816.csv`: `135a78aa031830b7b3e82b72d138e4ff5e8dc49e12399a52f07f46efe739b783`
- `docs/reports/sp077_final_owner_review_queue_20260816.md`: `b9abf22add9e0ed65b491d2091bbc1b7327ed9b3ea2252963cac4a240758f53a`
- `scripts/sp078_owner_verdict_capture_20260816.mjs`: `802610206bd6530d659b03963763b7846a1810390bdf7e51cecee7788d11b986`
- `outputs/derived/sp078_owner_verdict_ledger_20260816.json`: `8448f1ea288f8e1b10a1c8ace12fefd1f000f63abaf496321513fcdd7b4b20a6`

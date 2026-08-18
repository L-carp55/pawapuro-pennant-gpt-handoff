# SP-101 identity and shared-metric repair audit

Date: 2026-08-18
Status: **PASS_REPAIRED**
Scope: speed only; SP-102 body, SP-078 owner verdict, SP-079 and shoulder work were not run.

## Repair order

1. Reconciled canonical entities while preserving current PROEYE keys.
2. Collected actual MLB regular-season appearance years from MLB Stats API (`gameType=R`).
3. Collected shared MLB indicators and Statcast Sprint Speed with source hashes/receipts.
4. Rebuilt MB-01/02/05/07/12/13/16/18, Current-100 packets, decision-use/ablation and the SP-102 target freeze.

## Identity canaries

- `カリステ`: stable key `PROEYE:93795157`, coverage `THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH`, Show rows `0`, actual MLB years `[2015, 2017]`.
- `ポランコ`: stable key `PROEYE:63065155`, coverage `ELIGIBLE_MATCHED`, Show rows `21`, actual MLB years `[2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021]`.
- `モンテロ`: stable key `PROEYE:53955150`, coverage `ELIGIBLE_MATCHED`, Show rows `120`, actual MLB years `[2022, 2023, 2024]`.
- `サンタナ`: stable key `PROEYE:53755153`, coverage `THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH`, Show rows `0`, actual MLB years `[2014, 2015, 2016, 2017, 2018, 2019, 2020]`.
- `秋山 翔吾`: stable key `PROEYE:31135133`, coverage `ELIGIBLE_MATCHED`, Show rows `43`, actual MLB years `[2020, 2021]`.
- `筒香 嘉智`: stable key `PROEYE:41945131`, coverage `ELIGIBLE_MATCHED`, Show rows `43`, actual MLB years `[2020, 2021, 2022]`.
- `ソト`: stable key `PROEYE:03505133`, coverage `IDENTITY_UNRESOLVED`, Show rows `0`, actual MLB years `[]`.

`ソト` was not matched to Juan/Gregory/Livan Soto. Candidate IDs and attempted sources are preserved in the official indicator manifest.

## Metric and transition findings

- MLB appearance rows: **361**; shared player-seasons: **361**; non-null Statcast Sprint Speed joins: **264**.
- MB-01 valid multi-feature rows: **211**; minimum valid feature count: **7**.
- MB-02 shared-model rows: **260**; legacy Sprint Speed submodel preserved: **True**.
- MB-05 transition segments: **80**; direction counts: `{'MLB_TO_NPB': 66, 'NPB_TO_MLB': 14}`; foreign cohort representation: `{'screened': 77, 'represented': 60, 'missing': 17, 'screened_source': 'first_wave_historical_foreign_identity_screen_77_names'}`.
- The Show season labels are retained as a separate axis and never used as MLB appearance years.
- Opportunity-conditioned infield hits, advancement and UBR/BsR-compatible indicators are explicitly blocked rather than inferred.

## Decision use and ablation

- Decision matrix: `100 × 18` player-specific cells; unconditional MB-12/13 USED_CONTEXT cells: `0`.
- Ablation cells with evidence fields: `1800`; generic rationale count: `0`.
- Frozen SP-102 target states: `{'NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN': 70, 'TARGETED_MATERIAL_CONFLICT': 27, 'TARGETED_LOW_CONFIDENCE': 1, 'NOT_TARGETED_SUFFICIENT_CONFIDENCE': 2}`; SP-102 search status: `SP-102_NOT_RUN`.

## Governance and QA

- Owner review remains locked; SP-078 ledger is unchanged and empty.
- No SP-079 final rating, shoulder work or SP-102 body execution was performed.
- Historical identity failure audit is retained; repaired QA is a separate PASS receipt.

Machine-readable receipts:
- `outputs/derived/qa_sp101_identity_and_shared_metric_repair_20260818.json`
- `outputs/derived/sp101_identity_reconciliation_receipt_20260818.json`
- `data/manual/sp101_mlb_official_indicator_source_manifest_20260818.json`
- `outputs/derived/sp101_mlb_regular_season_appearance_years.csv`
- `outputs/derived/sp101_mlb_shared_indicator_player_seasons.csv.gz`
- `outputs/derived/sp101_route_ablation_qa.json

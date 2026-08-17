# SP-077 construct-complete owner-review queue candidate

Date: 2026-08-17

- Coverage: 100/100; verdicts remain zero.
- This packet restores the full speed construct to owner review. It does not unlock owner review by itself.
- Top speed is one lane only; acceleration/H2F/T90, short-distance/historical physical evidence, mixed game proxies, community physical context, technique separation, PowerPro review context, source-scope guards, and explicit missingness are separate.

## Lane coverage

| Lane | Available/nonmissing | Explicit missing |
|---|---:|---:|
| construct_contract | 100 | 0 |
| top_speed_evidence | 100 | 0 |
| acceleration_h2f_t90_evidence | 22 | 78 |
| short_distance_physical_evidence | 38 | 62 |
| historical_physical_temporal_context | 49 | 51 |
| statistical_proxy_context | 100 | 0 |
| game_context_proxy_breakdown | 97 | 3 |
| community_physical_context | 18 | 82 |
| technique_separation_contract | 100 | 0 |
| powerpro_review_context | 95 | 5 |
| source_scope_guard | 100 | 0 |
| missingness_and_provenance_contract | 100 | 0 |

## Guards

- NPB+ `hp_to_1b_sec` remains fail-closed as a misattributed source field; independent H2F/acceleration evidence remains valid in its own lane.
- 30m/50m evidence is never linearly scaled to T90.
- Injury/birthdate joins remain explicit bounded missingness where the repository lacks structured player-level evidence.
- PowerPro is never a player-level physical teacher.
- No owner verdict or final SP-079 practical rating is created.

Machine-readable: `outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json`

## SP-021 high-confidence anchors

- Source inventory: 459 records.
- ACCEPTED_HIGH_CONFIDENCE: 140 raw records.
- Grouped by selected_anchor_id / measurement cluster: 113 anchors.
- Current-100 overlap: 7 anchors / 7 raw records / 7 players.
- Multi-row anchors preserve every accepted raw record; no row is silently chosen or discarded.
- These are historical/physical anchors, not automatic current-year carryover values.

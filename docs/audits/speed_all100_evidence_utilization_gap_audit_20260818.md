# Speed all-100 evidence-utilization gap audit — 2026-08-18

Status: **MEASURED FAIL — CURRENT SP-078 PROPOSAL IS NOT APPROVAL-READY**

## Conclusion

The current 100-player recommendation set did **not** use all evidence assets and appraisal phenomena identified by the owner and the immutable speed requirements baseline.

This is not merely a documentation gap. The final review pipeline narrowed the input set before decision-making:

1. `build_speed_all100_full_construct_inventory_20260818.mjs` compacted the SP-077 queue into a selected subset.
2. `build_speed_all100_integrated_owner_review_20260818.mjs` scored only that compact subset.
3. `build_speed_all100_owner_review_adjudication_20260818.mjs` supplied player-specific manual adjudication for 15 players; the other 85 were automated pass-through rows with a generic compatibility rationale.
4. The resulting SP-078 proposal therefore cannot be treated as a complete owner-review packet.

The append-only owner ledger remains untouched (`owner_verdict_count=0`), so this defect can be corrected without rewriting owner history.

## What actually affected the 100-player screen

| Evidence family | Actual role |
|---|---|
| Current NPB+ peak speed and exposure | Direct physical input; nominal maximum component weight 40% |
| H2F / T10 / T30 / T90 / 30m / 50m / historical Sprint Speed | Direct physical/profile input with time, source and protocol discounts |
| 2025 statistical proxy S | Capped contextual input |
| Mixed game context: triples, GIDP avoidance, UBR, advance, infield hits | Capped contextual input |
| Community physical statements | Semantic positive/negative contextual input |
| Community technique statements | Presence-based modifier used to downweight conflicting S/game context |
| Current PowerPro percentile | Comparison target after the independent screen; not a physical feature |

These are real inputs. The problem is that they are only a subset of the accumulated project evidence.

## PowerPro history was collected but not fully used

The repository contains a large longitudinal PowerPro panel and a normalized trajectory layer:

- published ratings across the covered 2013–2026 works/versions;
- version-level distributions and percentiles;
- first/last ratings;
- raw changes;
- percentile drift;
- `raw_flat_but_pct_moved` cases;
- S1 internal inertia;
- S2 disagreement;
- stale/odd flags.

However, the final integrated screen uses only the current PowerPro value/percentile as the comparison target. `changes`, `years`, S1, S2 and the stale flag are retained in the compact inventory but are not part of the score or recommendation logic. The final output may display a flag, but displaying it is not the same as using the trajectory to adjudicate the player.

Therefore the owner requirement to use PowerPro **trajectory**, version distribution, inertia and current evidence alignment was only completed upstream—not in the final 100-player decision.

## MLB The Show was not used in the final decision

The project has two distinct kinds of MLB information:

1. **Real MLB measurements**, such as Statcast Sprint Speed and T10/T30/T90. Some of these were used for individual players.
2. **MLB The Show game ratings and mappings.** These were not read by the final inventory, screen, or adjudication scripts.

The Show numeric conversion has an important policy boundary:

- same-time The Show→PowerPro conversion was found `NOT_IDENTIFIABLE` because the overlap was only 6 players / 7 pairs, the fast band had no support, and player holdout was impossible;
- cross-time player-level conversion was explicitly disallowed under the 2026-08-14 owner ruling because current-year appraisal would be confounded by aging, injury, movement between leagues, and time;
- raw/context evidence was explicitly preserved and only the **numeric conversion path** was closed.

The current final review respected the ban on player-level numeric conversion, but it also failed to consume the permitted remainder: The Show context and population-level measurement→game-scale shape as independent QA. The existing `the_show_mapping.json` was not an input to the final pipeline.

Thus the answer is not “The Show was used safely.” The accurate answer is:

> The player-level numeric bridge was intentionally excluded, while the remaining permissible The Show uses were not propagated into the final 100-player review.

## Other accumulated evidence that did not reach the final decision

### Present upstream but dropped or non-effective downstream

- SP-021 high-confidence anchor receipt as an independent lane;
- SP-022 evidence-weighted pairwise/range receipts;
- SP-043 veteran case-study conclusions;
- SP-074 conflict diagnosis;
- SP-075 Community/stale rediagnosis receipts;
- Community PowerPro-rating context;
- full injury/age bounded-missingness receipts;
- full source-scope and provenance receipts.

Some underlying facts may reappear through another lane, but the final pipeline does not preserve enough receipts to prove that these analyses influenced the recommendation.

### Still incomplete and not consumed

| Task / evidence family | Current state | Consequence |
|---|---|---|
| SP-020 measurement-date resolution | `PARTIAL` | current-vs-historical relevance remains incomplete |
| SP-044 age/birthdate join | `BLOCKED_MISSING_DATA` | no structured age bridge |
| SP-045 injury/recovery join | `BLOCKED_MISSING_DATA` | no structured player-level injury bridge; Community can still carry observed decline |
| SP-060 official/public scouting | `PARTIAL` | 21/100 players found in broader inventory; final screen does not read it |
| SP-061 pinch-runner usage | `PARTIAL` | five attributable players found; contextual treatment not decided or consumed |
| SP-062 defensive straight-line chase | `NOT_STARTED` | no separable evidence; external NPB tracking not collected; 607 range rows remain unevaluated for this purpose |
| Video low-weight context | preserved without consumer | 17 inconclusive records remain unable to affect the review |
| SP-063 legacy missing-data reconciliation | `PARTIAL` | Statcast Baserunning Run Value remains unmapped |
| SP-072 full-roster/100-vs-non100 scale consistency | `NOT_STARTED` | current-100 scale consistency is not established |
| SP-090 final-chat-only durability scan | `PARTIAL` | completeness claim is not fully machine-established |

## Contract defect

The 12-lane construct traceability contract is internally coherent, but it is narrower than the immutable requirements baseline. It covers the central physical construct, statistical/game context, Community, PowerPro review context and provenance—but omits separate lanes for:

- The Show raw/context/global structural QA;
- full PowerPro trajectory receipts;
- official scouting;
- pinch-runner usage;
- defensive chase/video context;
- several case/range/conflict receipts.

Consequently, “12/12 lanes integrated” did not prove “all owner-identified usable phenomena were used.”

A related governance mismatch remains: SP-077 is recorded `DONE_VALIDATED`, while SR-052 child tasks SP-060/SP-061/SP-062 remain `PARTIAL` / `PARTIAL` / `NOT_STARTED` and related exclusion rows remain open or reassessment-required.

## Overstatement in the previous review

The previous response described the result as a human-adjudicated review of all 100 players. The code does not support that wording.

- 15 players have explicit player-specific adjudication entries.
- 85 players inherit the automated screen and receive a generic compatibility rationale.

All 100 rows were processed, but all 100 were **not** individually re-adjudicated from the full accumulated evidence set.

## Superseded for owner approval

The following artifacts remain useful as intermediate diagnostics but must not be approved or copied into SP-078:

- `outputs/derived/speed_all100_integrated_owner_review_20260818.json`
- `outputs/derived/speed_all100_owner_review_adjudicated_20260818.json`
- `outputs/derived/sp078_owner_verdict_proposal_20260818.json`
- `docs/reports/sp078_owner_verdict_proposal_20260818.md`

Reason: **incomplete evidence utilization and overstated all-player manual review**.

This supersession does not invalidate the raw SP-077 evidence queue, the append-only SP-078 infrastructure, or the underlying collected datasets. It invalidates the claim that the current recommendation set is ready for owner approval.

## Exact next step

1. Replace the 12-lane-only review contract with a **requirements-to-decision utilization contract** covering every active SR requirement.
2. For every player and evidence family, emit one of:
   - `USED_DIRECTLY`
   - `USED_CONTEXT`
   - `AVAILABLE_NOT_DECISION_EFFECTIVE`
   - `EXCLUDED_WITH_SCOPED_REASON`
   - `BLOCKED_MISSING_DATA`
   - `NOT_COLLECTED`
3. Reintroduce PowerPro raw trajectory, normalized percentile trajectory, inertia, breakpoints and current-evidence alignment as review context—never as a physical teacher.
4. Split The Show into distinct questions:
   - keep player-level numeric conversion excluded unless the owner explicitly amends SR-060;
   - use raw/context evidence and global measurement→rating scale-shape QA where valid;
   - never silently turn temporal mismatch into a current player rating.
5. Integrate scouting, pinch-runner and usable video context at explicit low weights. Preserve defensive chase as bounded missingness until separable evidence exists.
6. Propagate SP-021, SP-022, SP-043, SP-074, SP-075, age/injury missingness and source-scope receipts into the rebuilt all-100 packet.
7. Individually adjudicate all 100 players with a player-specific rationale and evidence-use receipt.
8. Run independent QA that verifies both **availability** and **decision influence**.
9. Generate a new SP-078 proposal only after that rebuilt review passes.

Machine-readable audit:

`outputs/derived/speed_all100_evidence_utilization_gap_audit_20260818.json`

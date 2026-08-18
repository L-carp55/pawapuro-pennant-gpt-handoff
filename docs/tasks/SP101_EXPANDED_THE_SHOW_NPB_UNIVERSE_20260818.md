# SP-101 — Expanded MLB The Show × NPB evidence universe rebuild

Status: **PARTIAL / READY FOR CODEX DISPATCH / OWNER-REVIEW BLOCKER**
Date: 2026-08-18
Scope: **走力のみ。肩力は対象外。**

## Objective

Build a canonical, time-indexed NPB ↔ MLB ↔ MLB The Show ↔ PowerPro evidence universe, then regenerate player-level speed evidence packets so that every eligible MLB-experienced player and every relevant historical calibration player can affect the final speed appraisal in a role-appropriate way.

## Why this task is necessary

- The prior 6-player/7-pair sample was only a narrow same-time numeric-bridge test and was incorrectly treated as if it bounded The Show applicability.
- The local `mlb_bridge` and `the_show_bridge` are incomplete historical snapshots, not complete NPB↔MLB universes.
- Current-100 exact ID overlap with those local bridges is zero, while obvious MLB-experienced current players are missing, proving a crosswalk/namespace/coverage defect rather than a two-player universe.
- Historical NPB players, Japanese NPB→MLB players, foreign MLB→NPB players, and NPB→MLB→NPB returnees are required for temporal and league-transition inference.
- The current SP-078 proposal is superseded and the canonical owner ledger remains empty.

## Source repositories and immutable inputs

### Destination

- Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
- Active baseline branch: `review/opus-speed-pre-owner-review-wave-20260816`
- Start from the latest remote HEAD after the SP-101 activation/relock commits.

### MLB The Show source repository

Repository: `L-carp55/claude-code-hub`

1. `codex/mlb-the-show-speed-history`
   - commit: `97c429521267cfb70ccdd61e40e11853d100e360`
   - key audit: `docs/audits/mlb_the_show_speed_history_audit.md`
2. `codex/mlb-the-show-speed-temporal-rescue`
   - commit: `ab5adbfee656d69d0b378145fd66bf5789e0d1b4`
   - role: official/archived roster-update speed events with duplicate/event-role controls
3. `codex/mlb-the-show-full-attributes`
   - commit referenced by project: `74d2a2278ab7bcea3f6368e1df6ba03e2dd82554`
   - key audit: `docs/audits/mlb_the_show_full_attribute_history_2017_2026.md`
   - role: MLB21–MLB26 Live/base roster attribute snapshots; non-Live/DD isolated

### Destination repository inputs

- `data/pennant.db`
  - `mlb_bridge`
  - `the_show_bridge`
  - `the_show_rating`
  - `pawapuro_full`
  - `pawapuro_full_link`
  - NPB roster/player-link tables
- `outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json`
- PowerPro longitudinal/normalized trajectory artifacts
- direct physical measurement artifacts
- Community, pairwise, stale/conflict, age/injury-missingness and provenance receipts
- `docs/state/speed_owner_clarification_the_show_scope_20260818.md`

## Eligible cohorts

The final universe must explicitly enumerate at least the following cohorts:

1. `CURRENT100_MLB_PROMOTION_OR_APPEARANCE`
2. `HISTORICAL_NPB_BEFORE_2026_WITH_MLB_THE_SHOW`
3. `NPB_TO_MLB_JAPANESE`
4. `MLB_TO_NPB_FOREIGN`
5. `NPB_TO_MLB_TO_NPB_RETURNEE`
6. `MLB_TO_NPB_TO_MLB_OR_MULTI_CYCLE`
7. `HISTORICAL_CALIBRATION_POPULATION`

No cohort may be silently omitted because a player is outside the current 100 or because the The Show season differs from the target NPB season.

## Target branch and worktree

- Branch: `codex/speed-sp101-expanded-the-show-universe-20260818`
- Create a separate worktree.
- Do not modify or force-push the review branch directly.
- Parent agent alone performs final integration.

## Parallel agent plan

Use multiple independent sub-agents. Each writes separate intermediate files; no two agents edit the same final file.

### Agent A — Identity universe

- Enumerate every NPB-before-2026 player and every current-100 player.
- Identify MLB promotion/appearance, not merely contract/minor-league affiliation.
- Build canonical NPB/ProEye/NPB player ID/MLBAM/The Show UUID/English-Japanese name crosswalk.
- Preserve `MATCHED_ID`, `MATCHED_HIGH_CONFIDENCE_NAME`, `AMBIGUOUS`, `UNRESOLVED`, and negative-control states.
- Detect namespace mismatches and stale bridge IDs.

### Agent B — The Show Live panel

- Isolate Live/base roster `Speed` by player and edition/snapshot/update.
- Preserve roster-update before/after speed events where reproducible.
- Quarantine WBC, Flashback, Finest, Topps Now, Awards, Captain, Milestone and all other non-Live cards.
- Keep `Speed`, `Stealing`, and `Baserunning Aggressiveness` separate.
- Preserve raw source payload hashes and card/update provenance.

### Agent C — NPB/PowerPro timeline

- Build NPB season timeline and PowerPro raw/percentile trajectories for every crosswalked player.
- Include players no longer in NPB and Japanese players still in MLB.
- Preserve version distribution, breakpoints, inertia, and missing years.

### Agent D — Transition segmentation

- Classify NPB→MLB, MLB→NPB, NPB→MLB→NPB, MLB→NPB→MLB, and multi-cycle segments.
- Do not collapse segments into a lifetime average.
- Align target season, The Show edition/update, PowerPro work/version, Statcast season, age availability, injury availability, and temporal gap.

### Agent E — Evidence roles and models

Create separate, non-overlapping roles:

- same/near-time cross-game QA;
- cross-time player trajectory/prior;
- transition calibration by direction and time gap;
- ordinal/pairwise context;
- population scale-shape/compression/tail QA;
- direct physical evidence;
- technique-separation evidence;
- excluded-with-scoped-reason.

Do not create an unrestricted direct The Show→current-PowerPro conversion.

### Agent F — Independent QA/red team

- Test identity leakage and homonyms.
- Test duplicate cards, duplicated updates, and same-event aliases.
- Test non-Live contamination.
- Test temporal leakage and train/test player leakage.
- Test missing cohorts and false exclusions.
- Test that old/cross-time evidence is discounted rather than silently deleted.
- Test that the 6/7, 47, and 79 counts cannot be used as universe ceilings.

## Required outputs

- `data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv`
- `outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz`
- `outputs/derived/sp101_the_show_roster_update_speed_events.csv`
- `outputs/derived/sp101_npb_mlb_transition_segments.csv`
- `outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv`
- `outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv`
- `outputs/derived/sp101_current100_the_show_evidence.json`
- `outputs/derived/sp101_requirements_to_decision_utilization.json`
- `outputs/derived/sp101_coverage_qa.json`
- `docs/audits/sp101_expanded_the_show_npb_universe.md`

## Required per-row fields

- stable identity keys and every source identifier;
- NPB season(s), MLB season(s), The Show edition/update date, PowerPro work/version;
- transition direction and segment number;
- Live/non-Live status and source/card/roster provenance;
- `Speed`, `Stealing`, `Baserunning Aggressiveness` as separate fields;
- direct Statcast Sprint Speed/T10/T30/T90 as separate physical fields;
- temporal gap and target season;
- age/injury availability and bounded missingness;
- match confidence and ambiguity state;
- evidence role;
- decision-use state: `USED_DIRECTLY`, `USED_CONTEXT`, `AVAILABLE_NOT_DECISION_EFFECTIVE`, `EXCLUDED_WITH_SCOPED_REASON`, `BLOCKED_MISSING_DATA`, or `NOT_COLLECTED`;
- source hash and transformation receipt.

## Non-scope

- Do not write SP-078 owner verdicts.
- Do not run SP-079 final ratings.
- Do not start shoulder appraisal.
- Do not copy a The Show value directly into a current NPB/PowerPro rating.
- Do not mix non-Live special cards into the Live numeric panel.
- Do not average multiple editions or transition segments into one lifetime number.
- Do not use PowerPro as a physical teacher.
- Do not treat missing data as slow/zero evidence.

## QA requirements

1. Enumerate the final eligible universe and prove it is not capped at 6/7, 47, or 79.
2. Every current-100 player receives exactly one coverage state:
   - `ELIGIBLE_MATCHED`
   - `NO_MLB_PROMOTION_FOUND`
   - `IDENTITY_UNRESOLVED`
   - `THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH`
3. Every NPB-before-2026 player is screened for MLB promotion/appearance and eligible The Show history.
4. ID joins are primary. Name-only matches require explicit ambiguity evidence and negative controls.
5. Validation is player-clustered; editions/cards from one player cannot cross train/test boundaries.
6. Same measurement/card/update duplicates are deduplicated with preserved provenance.
7. Live/non-Live contamination count is zero in the primary panel.
8. Speed/Stealing/Baserunning fields never collapse.
9. Temporal and transition features are visible and perturbation-tested.
10. Current100 packet proves which The Show evidence actually affected each decision.
11. Important negative findings, failed methods, unresolved identities, and coverage limitations are committed to audit artifacts, not left in the Codex final answer.

## Definition of Done

- `Codex final answer only` contains zero important findings.
- All required outputs exist, parse, and are committed.
- Coverage and identity QA pass with explicit denominators.
- Every eligible cohort is represented or has bounded missingness.
- Current-100 evidence packets are ready to enter a rebuilt requirements-to-decision review.
- No owner verdict, SP-079 result, or shoulder artifact is created.
- Commit and push the branch.
- Verify local HEAD equals remote branch HEAD.

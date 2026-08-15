# Luna Task — X PowerPro Current Evidence Cleanup

Date: 2026-08-16

## Purpose

Re-evaluate the **already collected X evidence only** for the speed appraisal project after an owner rule correction.

This is **not a collection task**. Do not search X, the web, YouTube, or any external source.

The previous Community V3 aggregate mixed three things that must now be separated:

1. current PowerPro rating reactions,
2. current real-world speed observations,
3. Prospi game-rating posts and old historical posts.

The owner has explicitly ruled that **all Prospi-related X game/rating evidence must be excluded from active appraisal use**, because X posts frequently refer to smartphone Prospi A and product identity / rating intent cannot be distinguished reliably enough. Do not attempt to rescue console Prospi from ambiguous X text. Exclude the whole Prospi game/rating lane from active appraisal evidence.

The owner also requires current appraisal evidence to be temporally relevant. Old PowerPro posts may be kept only as historical trajectory/context, never as votes in the current consensus.

## Repository / branch

Repository:
`L-carp55/pawapuro-pennant-gpt-handoff`

Create/check out branch:
`review/x-powerpro-current-cleanup-20260816`

Base exactly from Terra Community V3 final integration SHA:
`18b070bea3fd31a946532af397f9ed078044dc12`

Before doing anything, fetch remote and verify that the base SHA exists.

## Canonical semantic source

Use as the semantic source of truth:

`outputs/derived/speed_community_v3_canonical_20260815.jsonl`

Do **not** rebuild from the older Luna X canonical directly. Terra already corrected subject/lane mistakes that must not regress.

Useful audit/context files:

- `outputs/derived/speed_community_v3_consensus_20260815.json`
- `outputs/derived/speed_community_v3_semantic_audit_qa_20260815.json`
- `docs/audits/speed_community_v3_terra_final_audit_20260815.md`
- `outputs/derived/speed_community_v3_x_integrity_qa_20260815.json`
- `outputs/derived/speed_community_v3_x_query_coverage_20260815.csv`

## Hard owner rules

### A. No new collection

Absolutely do not:
- search X,
- search the web,
- collect more replies,
- search YouTube,
- call external APIs.

Only transform existing repository evidence.

### B. Exclude all Prospi game/rating evidence from active appraisal use

If an X row is about ratings / cards / gameplay / abilities in any form of:
- Prospi,
- Prospi A,
- Prospi console,
- ambiguous `プロスピ`,

then it must **not** enter active PowerPro current consensus.

Do not try to infer that an ambiguous Prospi post is the console version.

Preserve the row in an audit/excluded artifact with reason such as:
`EXCLUDED_PROSPI_PRODUCT_AND_RATING_INTENT`

Important nuance: a genuinely game-independent real-world physical observation can remain eligible even if it happened to be discovered by a query containing Prospi. Eligibility is decided from the row's semantic content, not discovery query wording.

### C. PowerPro mainline only for game-rating consensus

Active rating consensus may contain only unambiguously mainline PowerPro rating reactions.

Exclude PowerPro mobile/app/game-specific card-style evidence if present, with a separate reason.

### D. Current window

For **active current appraisal evidence**, require:
`published_at >= 2025-01-01`

Use 2025-2026 because the current appraisal task is 2026 and 2025 can provide near-current stale/trajectory context.

Pre-2025 PowerPro evidence may be retained only in:
`HISTORICAL_POWERPRO_TRAJECTORY`

It must never count toward current community consensus, directional-vote counts, or current-player coverage.

If a row lacks a usable date, it cannot enter active current consensus unless the repository itself contains a deterministic, provenance-backed date resolution. Do not guess dates.

### E. Physical observations

Keep a separate active lane for 2025-2026 **real-world, game-independent speed-specific observations**, e.g. explicit statements that a player is fast, slow, slower than before, has lost speed after injury, etc.

Do not treat generic aging statements as speed observations unless the text itself is speed-specific.

Keep pure speed distinct from:
- baserunning technique,
- stealing technique,
- start/jump,
- gameplay mechanics.

Technique-only material may be retained as context but not as pure-speed physical evidence.

### F. Preserve Terra semantic corrections

The following regressions must remain correct:

1. Fukudome power-only complaints are not speed claims.
2. `盗塁王が走力Aじゃない...塩見より低い` — the criticized stolen-base king remains ambiguous; Shiomi is comparison-only.
3. Maruyama/Iwata multi-subject row — `足めっちゃ早い` belongs to 岩田幸宏, not 丸山和郁.
4. Akiyama/Muramatsu row — Akiyama shoulder aging is not speed; Muramatsu is separate tactical/base-to-base context.
5. 西川史礁 must never map to 西川龍馬.
6. 山本大斗 must never map to 山本祐大.
7. Dalbec/Matsumoto row — Dalbec is the criticized rating subject; 松本剛 is comparison-only.

## Required mutually exclusive buckets

Every X row in the Terra final canonical must receive exactly one top-level disposition bucket:

1. `CURRENT_POWERPRO_RATING`
   - 2025-2026
   - mainline PowerPro
   - actual speed-rating reaction/context
   - no Prospi

2. `CURRENT_REALWORLD_SPEED_PHYSICAL`
   - 2025-2026
   - game-independent real-world speed-specific observation

3. `CURRENT_TECHNIQUE_CONTEXT`
   - 2025-2026
   - baserunning / stealing / acceleration-context only
   - not pure speed

4. `HISTORICAL_POWERPRO_TRAJECTORY`
   - pre-2025 PowerPro rating/context
   - archive only

5. `EXCLUDED_PROSPI_ALL`
   - any Prospi game/rating/gameplay evidence, regardless of mobile/console ambiguity

6. `EXCLUDED_POWERPRO_APP`
   - PowerPro mobile/app game-rating evidence if present

7. `EXCLUDED_NON_SPEED`

8. `REVIEW_REQUIRED`
   - ambiguous date / product / identity / subject that cannot safely enter an active lane

If an existing Terra row is duplicate, preserve duplicate semantics and do not count it as an independent active event.

## Active evidence rules

For `CURRENT_POWERPRO_RATING`, separate:
- TOO_HIGH
- TOO_LOW
- APPROPRIATE
- EXPLICIT_PROPOSED_VALUE
- STALE
- AGING_NOT_REFLECTED
- INJURY_NOT_REFLECTED
- RECOVERY_NOT_REFLECTED
- COMPARISON_ONLY
- UNCLEAR

Only actual subject-targeted directional/appraisal claims count toward directional consensus.

`COMPARISON_ONLY` does not create a vote for the comparison player.

For current physical observations, retain:
- player
- exact text
- date
- source URL
- pure-speed vs technique classification
- injury/aging context where explicit

## Required outputs

Create:

1. `outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl`
   - all active `CURRENT_POWERPRO_RATING` + `CURRENT_REALWORLD_SPEED_PHYSICAL` + `CURRENT_TECHNIQUE_CONTEXT` rows

2. `outputs/derived/speed_x_current_powerpro_summary_20260816.csv`
   - current-100 player summary
   - at minimum: player, player_id, rating_claims, directional_rating_claims, physical_speed_observations, technique_context, attributable_origins, unattributed_events, verdict

3. `outputs/derived/speed_x_historical_trajectory_20260816.jsonl`
   - all `HISTORICAL_POWERPRO_TRAJECTORY`

4. `outputs/derived/speed_x_excluded_prospi_20260816.jsonl`
   - all Prospi game/rating/gameplay X rows excluded under owner rule

5. `outputs/derived/speed_x_current_powerpro_qa_20260816.json`

6. `docs/audits/speed_x_current_powerpro_cleanup_20260816.md`

## Required human-readable claim lists

The audit Markdown must contain a table listing **every surviving current PowerPro speed-rating row**, with:
- date
- player
- exact short text/excerpt
- direction/value
- current_100
- source URL
- whether author is attributable

Also list **every surviving 2025-2026 real-world speed-specific physical observation** with the same fields.

Do not only report counts. The owner needs to inspect the actual evidence.

## QA assertions

The machine QA must fail if any of these are false:

1. active current rating rows with Prospi product/game = 0
2. active current rating rows dated before 2025-01-01 = 0
3. active current rating rows with missing/guessed date = 0
4. active current rating rows from PowerPro app/mobile = 0
5. comparison-only subject counted as target vote = 0
6. Terra X regressions 1-7 all PASS
7. duplicate rows counted as independent active events = 0
8. real-world physical lane containing generic non-speed aging only = 0
9. technique-only rows counted as pure speed = 0
10. every active row traceable to a Terra canonical `record_id`

Additionally report:
- previous superseded figure: X speed-relevant 138 / current100 usable Community players 55
- new active current PowerPro rating claim count
- new directional current PowerPro rating claim count
- current100 players with active PowerPro rating evidence
- current100 players with directional PowerPro evidence
- current real-world speed-specific physical observation count
- current100 players with such physical observations
- attributable vs unattributed source-event counts
- historical PowerPro rows archived
- Prospi rows excluded

## Value judgment

After recomputation, state one of:

- `X_COLLECTION_USEFUL`
- `X_COLLECTION_LIMITED_VALUE`
- `X_COLLECTION_METHOD_MISALIGNED`

The judgment must be based on the **surviving 2025-2026 PowerPro + real-world physical evidence**, not on the old 138/55 totals.

Explain briefly:
- how many current100 players retained genuinely usable evidence,
- how many retained directional PowerPro rating reactions,
- whether the evidence materially helps odd/stale owner review.

Do not claim X is useful merely because rows exist.

## Registry / SP-035 / SP-075

Do not change production ratings.
Do not start shoulder.
Do not close Speed Gate.

Reassess whether SP-035's current `DONE_VALIDATED` description needs wording correction because its previous aggregate included Prospi and historical material. If status itself remains `DONE_VALIDATED` as a bounded **collection** lane, make clear that the old 138/55 appraisal-use aggregate is superseded by the owner-filtered current PowerPro artifact.

If SP-075 references the old Community aggregate in a way that affects owner-review context, update only that contextual reference. Do not invent appraisal changes.

## Tests / completion

Run the filter from repository source, regenerate all outputs, run QA, and make it idempotent.

Then:
1. `git status` clean after generation
2. commit
3. push
4. verify remote SHA

Final response only:
- branch
- remote SHA
- current PowerPro active rating claims
- directional PowerPro claims
- current100 players with PowerPro evidence
- current100 players with directional PowerPro evidence
- current real-world physical speed observations
- current100 players with physical speed observations
- historical PowerPro rows archived
- Prospi rows excluded
- QA result
- value judgment
- paths to claim-list audit and machine QA

No new search was permitted; explicitly confirm zero external collection/search was performed.

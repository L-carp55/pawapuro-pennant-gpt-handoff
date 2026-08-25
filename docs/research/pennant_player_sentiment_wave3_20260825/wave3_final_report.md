# Targeted Research Wave 3 — final report

## Gate summary

- Scope: public-source player sentiment and long-save observations around PowerPro Pennant, Prospi Pennant, and MLB The Show Franchise.
- Research only: no implementation, no canonical PW ledger edit, no new PW ID, no merge.
- Starting branch SHA: `2e4a3db520fb7a46986e8ab3bf07eba12f33c6e0`
- User-specified base SHA: `721a5f50c3c680b3e5d2fe5e8c6b7ed77c410c37` (ancestor verified)
- Research branch: `codex/pennant-player-sentiment-wave3-20260825`
- Substantive research artifact commit SHA: `853c6c55eb2abc2f64987bab0133654fe8622d56`
- Final local/remote branch SHA: verified at handoff after the metadata commit and reported in the completion message.
- Final worktree state: verified clean at handoff after the metadata commit.
- Note: the branch-head SHA is intentionally reported at handoff rather than embedded in this file; changing an embedded head SHA would create a new head SHA.
- Independent QA: `PASS_WITH_LIMITATIONS` (see [independent_qa.md](./independent_qa.md))

## Counts

### Evidence and themes

- Evidence rows: **98**
- Unique source URLs: **76**
- Independence keys/source groups: **53**
- Duplicate URL groups with multiple claim rows: **9**; these are not counted as independent sources
- Themes: **34**
- Research lanes: **13**

### Evidence by game

| Game | Rows |
|---|---:|
| PowerPro | 37 |
| Prospi | 28 |
| MLB The Show | 33 |

### Product/mode counts

| Product/mode | Rows |
|---|---:|
| PowerPro Pennant | 37 |
| Prospi Pennant | 22 |
| myBALLPARK adjacent SEASON | 4 |
| myBALLPARK | 1 |
| Prospi/myBALLPARK scope aid | 1 |
| MLB The Show Franchise | 33 |

### Platform counts

| Platform | Rows |
|---|---:|
| X | 32 |
| Reddit | 14 |
| Gamemos | 13 |
| Official Konami | 6 |
| Operation Sports | 6 |
| Yahoo Chiebukuro | 3 |
| PlayStation Blog | 2 |
| 5ch | 2 |
| Note/blog | 2 |
| Dengeki | 1 |
| GameSpot | 1 |
| Official manual | 1 |
| Official MLB26 manual | 3 |
| PlayStation Store | 1 |
| Public bug board | 1 |
| Operation Sports forum | 4 |
| The Show forum | 2 |
| Blog | 4 |

### Topic counts A-T

Counts are evidence-row topic tags, so one row may contribute to several topics.

| Topic | Count | Topic | Count | Topic | Count | Topic | Count |
|---|---:|---|---:|---|---:|---|---:|
| A | 9 | F | 5 | K | 6 | P | 32 |
| B | 22 | G | 1 | L | 10 | Q | 27 |
| C | 11 | H | 2 | M | 8 | R | 82 |
| D | 28 | I | 9 | N | 10 | S | 21 |
| E | 10 | J | 14 | O | 5 | T | 13 |

### Signal counts

| Signal | Count |
|---|---:|
| COMPLAINT | 53 |
| REQUEST | 17 |
| PRAISE | 15 |
| OBSERVATION | 8 |
| TRADEOFF | 4 |
| EXPLOIT | 1 |

### Evidence recurrence labels

| Evidence label | Count |
|---|---:|
| SINGLE_SOURCE | 54 |
| MODERATE_RECURRENT | 17 |
| NOT_A_SENTIMENT | 13 |
| ISOLATED_ANECDOTE | 7 |
| VERSION_SPECIFIC | 4 |
| LOW_CONFIDENCE | 3 |

### Theme recurrence and mapping

| Theme recurrence | Count |
|---|---:|
| MIXED_CONTESTED | 15 |
| MODERATE_RECURRENT | 14 |
| STRONG_RECURRENT | 2 |
| VERSION_SPECIFIC | 1 |
| ISOLATED_ANECDOTE | 1 |
| INSUFFICIENT_EVIDENCE | 1 |

| Mapping | Count |
|---|---:|
| PARTIAL_EXTENSION | 16 |
| ALREADY_COVERED | 11 |
| NEW_CANDIDATE | 3 |
| LOW_VALUE | 2 |
| INSUFFICIENT_EVIDENCE | 2 |

## Top 10 findings

1. Long-save value is repeatedly tied to records, history, unexpected players, and meaningful roster stories—not to maximum feature count.
2. PowerPro foreign-player release/movement is the strongest product-specific recurrent concern, but launch-version bias and bug-versus-design causality remain unresolved.
3. CPU draft concerns are about organization need, role balance, and explainability; current-draft/rookie discovery itself is also praised.
4. Finance can create useful competitive differences, but CPU inability to participate is a possible world-stoppage failure, not merely a hard economy.
5. UI requests across products converge on selective delegation, one-screen decision support, short reasons, and safe resumption.
6. Prospi’s official record/award/roster-history layer is a strong keep signal; classic and myBALLPARK evidence must remain separate.
7. Prospi has a long-save activity-stop suspicion, but no controlled reproduction; it remains a verification target.
8. MLB The Show’s official 26 trade direction—organization-specific valuation, counteroffers, Trade Hub—aligns with PW’s market direction.
9. MLB community evidence contains opposite trade failures: overactive CPU movement and overprotected/blocked markets. Do not optimize a single frequency number.
10. The thinnest areas are PowerPro F/G/K/M, Prospi G/H/O/N, and MLB G/J/M/N; they must remain unresolved.

## Top 5 contradictions

1. Too many trades versus too few/refused trades.
2. Realistic uncertainty versus opaque, unexplained behavior.
3. Full automation versus need for detailed information.
4. Financial pressure versus CPU participation stopping.
5. Unexpected player success versus perceived ability/statistical inconsistency.

The detailed evidence and disposition are in [design_challenge_memo.md](./design_challenge_memo.md) and T19/T28/T33 of [theme_ledger.tsv](./theme_ledger.tsv).

## Top 10 uncovered candidates

These are review candidates returned to existing Open Domains, not new PW IDs:

1. OD-01 deployment AI and failure/recovery reasons.
2. OD-04 special-ability lifecycle.
3. OD-07 roster rights, options, waivers, service-time-like constraints.
4. OD-12 awards, Hall of Fame, retired numbers, historical recognition.
5. OD-13 economy, salary inflation, cross-league purchasing power.
6. OD-15 league-wide strategic meta without rubber banding.
7. OD-16 information visibility and player/club belief boundaries.
8. OD-17 physical maturation separate from evaluation change.
9. OD-10 schedule, travel, weather, and calendar causes.
10. OD-20 ownership succession and long-run governance.

## Thin areas and access blockers

- X post dates/reply trees: not consistently visible through public indexing; dates remain `UNKNOWN` where not verified.
- Reddit: thread visibility is uneven and the audience is self-selected; votes/comments are not prevalence.
- YouTube comments: not used because accessible stable comment-level extraction was not verified.
- 5ch: low-confidence context only.
- Language/platform asymmetry: Japanese sources dominate PowerPro/Prospi; English specialist communities dominate MLB The Show.
- No controlled long-save reruns or patch verification were performed in this research-only wave.

## Artifact paths

- [README.md](./README.md)
- [research_lane_receipts.tsv](./research_lane_receipts.tsv)
- [evidence_index.tsv](./evidence_index.tsv)
- [theme_ledger.tsv](./theme_ledger.tsv)
- [powerpro_synthesis.md](./powerpro_synthesis.md)
- [prospi_synthesis.md](./prospi_synthesis.md)
- [mlb_the_show_synthesis.md](./mlb_the_show_synthesis.md)
- [cross_game_comparison.tsv](./cross_game_comparison.tsv)
- [cross_game_comparison.md](./cross_game_comparison.md)
- [design_challenge_memo.md](./design_challenge_memo.md)
- [independent_qa.md](./independent_qa.md)

## Final disposition

The research wave is ready for design review with limitations. It supports prioritizing reason-giving CPU organization behavior, selective delegation, long-save activity/recovery, and existing open-domain questions. It does not authorize implementation, canonical PW changes, or a merge into `design/pennant-world-master-20260824`.

# Independent QA / red-team audit

## Verdict

**PASS_WITH_LIMITATIONS for the research artifact.** The evidence, theme, lane, and semantic-mapping gates pass. The result is not a population survey, does not prove product bugs, and does not authorize implementation or canonical PW changes.

This audit was run as a separate pass after the evidence and theme ledgers were assembled. It challenged the generated counts, source independence, version/mode boundaries, recurrence labels, contradiction preservation, and PW-ID guard rather than adding supporting evidence.

## Structural checks

| Check | Result | Evidence |
|---|---|---|
| Evidence rows | PASS | 98 rows; IDs E001-E098 are contiguous |
| Theme rows | PASS | 34 deduplicated themes |
| Research lanes | PASS | 13 lanes L01-L13, including independent QA lane L13 |
| Required topics | PASS | All A-T appear; topic counts are retained in the final report |
| Signal enum | PASS | Every evidence row uses only PRAISE, COMPLAINT, REQUEST, EXPLOIT, TRADEOFF, or OBSERVATION |
| Source URLs | PASS | 98 HTTPS source pointers; 76 unique URLs; 9 duplicate URL groups are separate claims from the same source and are not counted as independent sources |
| Source groups | PASS | 53 independence keys retained; theme `unique_source_groups` values match expanded evidence references |
| Evidence references | PASS | Every E-ID referenced by the theme ledger resolves to E001-E098 |
| Semantic mapping enum | PASS | Every theme uses an allowed mapping value |
| Recurrence enum | PASS | Every theme uses an allowed recurrence value |
| PW-ID guard | PASS | No referenced PW ID is outside PW-001 through PW-260; no new PW ID was created |
| Official-source guard | PASS | Official rows are not labeled as recurrent sentiment; they remain mode/version/keep context |
| Adjacent-mode guard | PASS | 6 myBALLPARK rows are marked ADJACENT_MODE and are not treated as classic Prospi Pennant evidence |

## Automated distribution snapshot

- Evidence by game: PowerPro 37; Prospi 28; MLB The Show 33.
- Evidence by simulation scope: SIM_ONLY 44; MIXED/UNKNOWN 20; MODE_DESIGN 14; UI_ONLY 9; ADJACENT_MODE 6; MANUAL_ONLY 3; MIXED 2.
- Evidence by signal: COMPLAINT 53; REQUEST 17; PRAISE 15; OBSERVATION 8; TRADEOFF 4; EXPLOIT 1.
- Theme mapping: ALREADY_COVERED 11; PARTIAL_EXTENSION 16; NEW_CANDIDATE 3; LOW_VALUE 2; INSUFFICIENT_EVIDENCE 2.
- Theme recurrence: MODERATE_RECURRENT 14; MIXED_CONTESTED 15; STRONG_RECURRENT 2; VERSION_SPECIFIC 1; ISOLATED_ANECDOTE 1; INSUFFICIENT_EVIDENCE 1.

## Red-team findings and dispositions

### 1. “Recurrent” may be inflated by one launch-week roundup

PowerPro T02 has multiple source groups, but several rows come from the same launch-period aggregator and indexed X cluster. The ledger keeps `STRONG_RECURRENT` because the signal crosses source groups, while the caveat explicitly says the current version and launch-week bias remain unresolved. It is a priority for reproduction, not a final product-wide fact.

### 2. The two opposite MLB trade complaints must not be averaged

T19 retains both “CPU trades destroy the league” and “CPU refuses/hoards/does not trade.” Its recurrence is `MIXED_CONTESTED`, not strong. The design implication is a reasoned market with organization-specific constraints, not a global trade-frequency slider.

### 3. Official feature descriptions are not player approval

Official PowerPro, Prospi, PlayStation, and MLB manual rows are labeled `MODE_DESIGN` or `NOT_A_SENTIMENT`. They are used for version/feature context and keep signals only. Community failures do not automatically falsify an official direction, and official direction does not prove it works.

### 4. Adjacent Prospi evidence could contaminate the classic Pennant answer

myBALLPARK rows are separately labeled `product_mode`, `simulation_scope=ADJACENT_MODE`, and the synthesis explicitly limits their use to UI/tempo hints. They are not used to claim a classic Prospi CPU-market recurrence.

### 5. Manual, mixed, and simulation-only observations could contaminate realism claims

The evidence index carries `simulation_scope`. The PowerPro and Prospi syntheses mark A/H/I/F topics as thin or mixed where controlled CPU-only evidence is missing. The MLB synthesis similarly separates official mode design from community long-save observation.

### 6. One anecdote could become a design rule

Exceptional CPU stars, individual trade requests, and isolated long-save stories are labeled `ISOLATED_ANECDOTE` or `SINGLE_SOURCE`. They are retained as possible player value, not as recurrence or causal evidence.

### 7. New requirements could be smuggled in through the memo

The memo returns candidates to existing PW IDs and open-domain IDs only. No new `PW-` number, canonical ledger edit, or implementation task is present in this directory.

## Coverage and access blockers

- X public indexing did not reliably expose exact post dates or full reply trees; affected rows retain `UNKNOWN` rather than guessed dates.
- Reddit comments and votes are not a representative survey. Several pages were only partially accessible through public search/open behavior.
- YouTube comment-level evidence was not used because accessible, stable extraction could not be verified in this run.
- 5ch rows are low-confidence context only.
- PowerPro/Prospi evidence is Japanese-heavy; MLB The Show evidence is English-heavy and specialist-community-heavy.
- Direct long-save reproduction, statistical re-runs, and patch verification were outside this research-only wave.

## Gate conclusion

The artifacts are suitable for design review as a bounded, source-grounded research wave. They are **not** sufficient to freeze the open domains or justify implementation. The next evidence gate should prioritize OD-01/OD-16 (deployment AI and information visibility), then validate the long-save activity and save-reliability questions with controlled runs.

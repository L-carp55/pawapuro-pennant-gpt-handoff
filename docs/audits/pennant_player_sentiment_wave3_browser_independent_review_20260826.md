# Pennant Player Sentiment Wave 3 — Browser GPT independent review

Date: 2026-08-26
Status: **INDEPENDENT REVIEW / PASS_WITH_LIMITATIONS / NO IMPLEMENTATION AUTHORIZATION**

## Scope

Independent review of Codex research branch:
`codex/pennant-player-sentiment-wave3-20260825`

Canonical design branch at review start:
`design/pennant-world-master-20260824`

Canonical SHA verified unchanged during research:
`2e4a3db520fb7a46986e8ab3bf07eba12f33c6e0`

Research branch remote HEAD verified:
`7ab859518fce0cd436599245c13fa1abe010d870`

Substantive research artifact commit:
`853c6c55eb2abc2f64987bab0133654fe8622d56`

Comparison: research branch is 2 commits ahead / 0 behind canonical start; all changed files are under `docs/research/pennant_player_sentiment_wave3_20260825/`. No canonical PW ledger, implementation code, appraisal lane, PD-001A, SP-078/SP-079, shoulder, or speed-canonical file was modified.

## Artifact-level verdict

**PASS_WITH_LIMITATIONS** is appropriate.

The artifact contains:

- 98 evidence rows;
- 76 unique URLs;
- 53 source-independence groups;
- 34 synthesized themes;
- 13 research lanes including a separate QA lane;
- meaningful representation of all three requested game families: PowerPro 37 / Prospi 28 / MLB The Show 33 evidence rows;
- explicit separation of official feature context, community sentiment, adjacent modes, version-specific issues, manual/mixed/sim-only observations, requests, praise, complaints, tradeoffs, and anecdotes;
- preserved contradictory feedback instead of averaging it away.

No `CONTRADICTS_CURRENT_DIRECTION` theme was emitted. This is not, by itself, evidence of forced agreement: the largest tensions (too many vs too few trades; uncertainty vs opacity; automation vs detailed information; financial pressure vs CPU participation stopping) were preserved as `MIXED_CONTESTED` or partial extensions rather than suppressed.

## Independent source-quality checks

Spot checks confirmed that key retained public sources exist and that representative paraphrases are materially faithful, including:

- the 2024-07-19 PowerPro Pennant discussion summarizing ability-screen UI burden, rapid foreign-player releases, low trade activity, CPU finance/draft participation issues, and positive Pennant/newcomer reactions;
- the Operation Sports MLB The Show 26 Franchise wishlist discussing progression/regression based on age/performance/injuries, wear-and-tear injuries with lingering/minor/career-threatening effects, bullpen modernization, and long-save customization.

The research correctly does **not** treat those sources as population surveys or controlled causal evidence.

## Important limitations retained

1. PowerPro/Prospi are Japanese-source heavy; MLB The Show is English specialist-community heavy. This satisfies broad bilingual coverage only asymmetrically and should not be read as balanced bilingual sampling inside every product family.
2. X public indexing leaves many dates/reply trees unverifiable. `UNKNOWN` is correctly retained rather than guessed.
3. Gamemos launch-period roundups can amplify a single launch-week cluster; repeated comments inside one roundup are not independent sources.
4. Reddit / wishlist / specialist communities overrepresent highly engaged franchise players.
5. YouTube comment evidence was not used because stable public comment-level extraction was not verified.
6. No controlled long-save reproduction, patch verification, or statistical re-run was performed.
7. Repository evidence proves a separate QA artifact/pass exists, but Git history alone cannot prove organizational independence of the checker beyond the documented separate-pass process.

## Semantic review of mappings

### Valid / useful

- Trade-frequency complaints are correctly preserved as conflicting signals rather than a mandate to raise/lower one global frequency.
- UI/delegation findings reinforce the existing `deep internally / simple surface / important interrupts` direction.
- Foreign-player release/movement is a useful partial-extension target because movement needs reasons connecting performance, contract, role, player intent, market and club constraints.
- Special-ability lifecycle remains a legitimate open design candidate, but evidence is moderate/thin and does not specify mechanics.

### Correction: T21 should not be treated as wholly NEW

`T21` (`打順・ブルペン・ロースター運用AIの信頼性`) is labeled `NEW_CANDIDATE`, but the canonical 2026-08-25 wall-talk already defines major parts of this area:

- pitcher day-state is uncertain and inferred from velocity, command, release, pitch quality, contact, workload, medical/coach/catcher information and opponent adaptation;
- starter/bullpen decisions are multi-factor rather than fixed pitch-count/run rules;
- CPU management mistakes arise from evaluation error, slow diagnosis, fixed-role bias, workload error and information integration rather than random stupidity;
- user-facing control is policy/report/lock based.

Therefore browser-GPT disposition is:

**T21 = PARTIAL_EXTENSION / MOSTLY_COVERED_BY_20260825_WALLTALK**, with remaining value mainly in lineup/roster/deployment reason-giving, recovery behavior after bad decisions, and future QA.

This correction means Wave 3 does not justify interrupting the current owner-wall-talk priority to reopen OD-01 from scratch.

## Priority impact

Wave 3 does **not** justify changing the planned wall-talk order.

- Player morale/role/relationship evidence (topic G) is extremely thin, so the completed grievance/relationship design remains first-principles owner design rather than a social-consensus import.
- Injury/fatigue evidence (topic F) is also thin. It supports keeping wear-and-tear/lingering effects as a design question, but not any particular formula.
- Therefore continue with injury / fatigue / medical / rehab / recurrence, then retirement / continuation.

## Guardrails

- Do not merge the research branch into canonical design automatically.
- Do not create new PW IDs directly from Wave 3.
- Do not treat user sentiment as factual evidence about real injury, player psychology, team behavior, or causal baseball mechanics.
- Use recurrent feedback to identify design/QA questions; use real baseball data and reproducible simulation tests for calibration.
- Implementation remains unauthorized.

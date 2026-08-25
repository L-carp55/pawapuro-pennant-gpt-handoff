# Pennant Player Sentiment Mining — Targeted Research Wave 3

## Scope

- As-of boundary: 2026-08-25 JST (research execution began on 2026-08-25; final QA may be recorded on 2026-08-26 JST).
- Purpose: public-source research on player praise, complaints, requests, exploits, tradeoffs, and long-save stories around PowerPro Pennant, Prospi Pennant, and MLB The Show Franchise.
- This is a research artifact only. It does not implement features, edit the canonical PW ledgers, create new PW IDs, or merge into the design branch.
- Evidence is a pointer to a public source, not a claim that the source is representative of all players.

## Git provenance

- Research branch: `codex/pennant-player-sentiment-wave3-20260825`
- Starting branch: `origin/design/pennant-world-master-20260824`
- Starting branch SHA: `2e4a3db520fb7a46986e8ab3bf07eba12f33c6e0`
- User-specified base SHA: `721a5f50c3c680b3e5d2fe5e8c6b7ed77c410c37` (verified as an ancestor of the starting SHA)
- Canonical branch: unchanged by this research wave.

## Evidence rules

1. The source URL, visible source date or explicit `UNKNOWN`, language, platform, game/mode, and query/navigation path are retained.
2. Exact version/mode is preferred. A version-specific complaint is not silently generalized to a series-wide rule.
3. Manual play, sim-only play, mixed play, mode design documentation, and adjacent modes are separated.
4. One post or one thread does not become recurrence by itself. Recurrence is counted at the unique source-group level and marked with a caveat.
5. Praise, complaint, request, exploit, tradeoff, and observation are kept distinct.
6. A semantic mapping is a design-review judgment only: `ALREADY_COVERED`, `PARTIAL_EXTENSION`, `NEW_CANDIDATE`, `CONTRADICTS_CURRENT_DIRECTION`, `LOW_VALUE`, or `INSUFFICIENT_EVIDENCE`.
7. `NEW_CANDIDATE` means a candidate design question for review; it is not a new PW requirement.

## Files

- `research_lane_receipts.tsv`: 13 independently scoped lane receipts, including query/navigation, retained/rejected source handling, coverage, and blockers.
- `evidence_index.tsv`: source-level evidence rows with provenance and semantic scope.
- `theme_ledger.tsv`: deduplicated cross-source themes and their mapping to existing PW requirements/open domains.
- `powerpro_synthesis.md`, `prospi_synthesis.md`, `mlb_the_show_synthesis.md`: product-specific synthesis.
- `cross_game_comparison.tsv`: comparable dimensions across the three products.
- `cross_game_comparison.md`: human-readable comparison and recurrence caveats.
- `design_challenge_memo.md`: design challenges for Pennant World review; no implementation decisions.
- `independent_qa.md`: independent audit method and result.
- `wave3_final_report.md`: final counts, top findings, contradictions, uncovered candidates, thin areas, and gate status.

## Access and coverage limitations

- X search returned public indexed posts, but visible post dates and full reply trees were not consistently available; those fields remain `UNKNOWN` where not verified.
- Reddit pages were sometimes readable only through search snippets or a public URL; comment-level representativeness is therefore limited.
- YouTube comments were not used as a quantitative source because accessible comment-level extraction could not be verified in this run.
- 5ch was used only as low-confidence anecdotal context, never as sole support for a recurring design conclusion.
- Japanese evidence is stronger for PowerPro/Prospi; English evidence is stronger for MLB The Show. The cross-game comparison therefore carries language and platform bias.
- Prospi `myBALLPARK` evidence is explicitly labeled adjacent-mode evidence and is not treated as classic Pennant evidence.

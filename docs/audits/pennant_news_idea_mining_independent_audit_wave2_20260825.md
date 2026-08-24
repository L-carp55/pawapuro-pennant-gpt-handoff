# Independent audit — Global Baseball News / History Idea Mining Wave 2

QA date: 2026-08-25; event cutoff: 2026-08-24

## Verdict: PASS_WITH_BLOCKERS

Structural, gzip, ID, PW existence, semantic text, source taxonomy, matrix topology, NPB-12, period, false-new, false-covered, false-negative, and duplicate checks were run independently of the generator.

- Wave 1 baseline events: 59
- Wave 2 retained events: 43
- Merged events: 102
- Semantic mapping rows: 1028; removed mismatches: 106; required additions: 301
- Matrix: 323 cells; status counts: {'SEARCHED_SATURATED': 68, 'SEARCHED_NEEDS_MORE': 245, 'BLOCKED': 10}
- NPB individual receipts: 12
- Historical receipts: Wave A / Wave B / Wave C

## Red-team findings

PNC-001 through PNC-008 were retained as partial extensions. PNC-009 was promoted because explicit promotion/relegation was false-covered by broad league-growth requirements in Wave 1. Mexico transfer evidence was retained as a detailed revalidation, not a new mechanism.

The semantic audit specifically removes PNC-007's reputation/knowledge/research misuse for contract/finance and PNC-005's club-count/expansion misuse for integrity. Exact module and requirement text are checked against the immutable PW ledgers.

## Blockers

- 10 matrix cells are BLOCKED by source authority/depth.
- 245 matrix cells remain SEARCHED_NEEDS_MORE; Wave 2 is a repair wave, not global saturation.
- Wave 1 current-year rows with 2026-12-31 boundary are preserved and require revalidation before implementation.
- NPB club-level medical/private contract and thin-region archives remain incomplete.

These blockers are evidence/scope blockers, not schema failures. No game implementation, PD-001A, SP-079, shoulder appraisal, or speed canonical work was started.

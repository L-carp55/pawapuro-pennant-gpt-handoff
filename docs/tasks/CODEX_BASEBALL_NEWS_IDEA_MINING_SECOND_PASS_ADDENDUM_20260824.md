# Codex news/history idea-mining — second-pass baseline addendum

Status: **MANDATORY ADDENDUM / SUPERSEDES 235-ONLY BASELINE ASSUMPTION**
Date: 2026-08-24

This addendum must be read together with:
`docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`.

## Why this addendum exists

A stricter second-pass audit found that the original 235-row baseline was not sufficient for strict wall-talk completeness. Do not run the news-mining task against only `PW-001..PW-235`.

## Mandatory read-first additions

Before any discovery work, read in full:

1. `docs/audits/pennant_walltalk_second_pass_gap_audit_20260824.md`
2. `docs/state/pennant_feature_requirements_addendum_20260824.tsv`
3. `docs/reference/pennant_owner_examples_and_rationale_20260824.md`
4. current `docs/state/pennant_design_program_state_20260824.json`

The feature authority for duplicate/newness checks is now:

- base: `PW-001..PW-235` in `pennant_feature_requirements_20260824.tsv`;
- addendum: `PW-236..PW-260` in `pennant_feature_requirements_addendum_20260824.tsv`;
- combined count: **260 requirements**.

## Discovery comparison rule

Every candidate found in baseball news/history must be compared against **both** requirement files plus the concrete examples/rationale reference.

Do not call something new merely because its named historical example is absent from the generic master. Conversely, if a real event reveals a genuinely new mechanism beyond all 260 requirements, preserve it as a candidate.

## Concrete-example rule

The owner example file contains:
- owner perceptions;
- hypotheticals;
- historical research seeds;
- assistant causality cautions.

Do not silently convert an owner perception into a verified fact. For named real-world examples, independently verify before using them as evidence.

## Explicit recovered areas not to rediscover as new

The second pass already recovered:
- dedicated trade/transaction design;
- CPU pursuit of blocked/surplus players;
- active draft as a separate route;
- real Global Baseball World as the foreign-player candidate pool;
- multi-league competition for the same player;
- early foreign-scouting information advantage;
- emergent NPB adaptation rather than one fixed adaptation rating;
- national-team player agency / possible user-control mode;
- absolute-vs-era-relative skill-scale problem;
- real 2026 club programs as starting assets rather than permanent exclusive buffs;
- resource differences without automatic pay-to-win;
- owner-strategy personality with universally high win motivation;
- expectation-relative team evaluation;
- reforms can fail without catch-up bonuses;
- development attention trade-offs;
- staff career ladders;
- pre-FA extensions;
- broader agent behavior;
- reclamation/revival reputation;
- roster/foreign-player rules as governance targets;
- persistent relationships from All-Star/international events;
- user-club participation in governance;
- pressure/expectation as contextual effect;
- bounded prospect-universe architecture.

## Output rule

Continue to write genuinely new findings only to candidate outputs. Do not mutate either canonical PW ledger directly.

## Implementation guard

Still forbidden:
- game feature implementation;
- PD-001A dispatch;
- SP-079;
- shoulder work.

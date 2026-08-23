# Codex news/history idea-mining — second/third-pass baseline addendum

Status: **MANDATORY ADDENDUM / SUPERSEDES 235-ONLY BASELINE ASSUMPTION**
Date: 2026-08-24

Read together with:
`docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`.

## Mandatory read-first additions

Before any discovery work, read in full:

1. `docs/audits/pennant_walltalk_second_pass_gap_audit_20260824.md`
2. `docs/audits/pennant_open_domain_third_pass_audit_20260824.md`
3. `docs/state/pennant_feature_requirements_addendum_20260824.tsv`
4. `docs/reference/pennant_owner_examples_and_rationale_20260824.md`
5. current `docs/state/pennant_design_program_state_20260824.json`

Feature authority for duplicate/newness checks:

- base: `PW-001..PW-235`;
- addendum: `PW-236..PW-260`;
- combined accepted/proposed inventory: **260 requirements**;
- plus all explicitly known OPEN domains in the third-pass audit/state file.

## Discovery comparison rule

Every candidate found in baseball news/history must be compared against:
- both PW ledgers;
- concrete examples/rationale reference;
- third-pass OPEN-domain audit.

A real-world event that merely provides evidence/examples for a known OPEN domain is **not automatically a new game feature**. Record it as supporting evidence / design input for that domain.

## Known OPEN domains not to rediscover as new

In addition to the older OPEN list, the third pass explicitly identifies:
- game-day lineup/rotation/bullpen deployment AI;
- in-game tactical decision engine;
- retirement/continuation/comeback decisions;
- special-ability/trait lifecycle;
- morale/relationships/clubhouse dynamics;
- trade requests/holdouts/role conflicts;
- roster rights/waivers/options/assignment/service time;
- farm/minor/third-fourth-team competition structure;
- amateur eligibility/progression/draft-rights rules;
- schedule/calendar/postponement/travel/rescheduling;
- weather/climate/day-to-day ballpark environment;
- awards/Hall of Fame/retired numbers/legacy systems;
- league-economy/salary-inflation/currency/cross-league market levels;
- labor stoppages/lockouts/strikes/shortened seasons;
- league-wide strategy/metagame evolution;
- information-visibility/scouting-fog model;
- physical maturation/body/conditioning development;
- officiating/umpire/ABS transition model;
- rare external shocks;
- ownership sale/succession/parent-company/local-market evolution.

The third-pass audit also lists mandatory sub-checklists inside existing OPEN areas such as trade, contracts, national teams, integrity, injury and governance.

## Concrete-example rule

Owner examples/perceptions/hypotheticals are research seeds and rationale, not automatically verified facts. Independently verify named real-world examples before using them as factual evidence.

## Output rule

Genuinely new mechanisms go to candidate outputs only. Do not mutate canonical PW ledgers directly.

## Implementation guard

Still forbidden:
- game feature implementation;
- PD-001A dispatch;
- SP-079;
- shoulder work.

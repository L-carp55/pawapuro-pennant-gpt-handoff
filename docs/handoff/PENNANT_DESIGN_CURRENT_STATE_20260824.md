# Pennant Design Current State — 2026-08-24

## Current phase

**DESIGN DISCOVERY / SECOND-PASS PRESERVATION COMPLETE / EXTERNAL IDEA MINING NEXT**

Do not start game-feature implementation yet.

## Canonical branch

`design/pennant-world-master-20260824`

## Read order

1. `docs/state/pennant_design_program_state_20260824.json`
2. `docs/state/pennant_feature_requirements_20260824.tsv` (`PW-001..PW-235`)
3. `docs/state/pennant_feature_requirements_addendum_20260824.tsv` (`PW-236..PW-260`)
4. `docs/design/PENNANT_WORLD_SIMULATION_MASTER_20260824.md`
5. `docs/design/PENNANT_WORLD_SIMULATION_MASTER_SECOND_PASS_ADDENDUM_20260824.md`
6. `docs/reference/pennant_owner_examples_and_rationale_20260824.md`
7. `docs/audits/pennant_walltalk_second_pass_gap_audit_20260824.md`
8. `docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`
9. `docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_SECOND_PASS_ADDENDUM_20260824.md`

The older `pennant_walltalk_completeness_audit_20260824.md` remains history, but its strict "complete" implication is superseded by the second-pass gap audit.

## Current facts

- Base ledger: 235 requirements.
- Second-pass recovered ledger: 25 requirements.
- **Combined current inventory: 260 requirements.**
- Concrete owner examples, hypotheticals, perceptions, and causality cautions are separately persisted rather than discarded during generalization.
- The initial 235-row completeness claim was too strong and is explicitly superseded for strict completeness.
- Open design domains are explicitly listed rather than discarded.
- PD-001A Age Dataset has a spec but is **HOLD / NOT DISPATCHED**.
- Next major work is broad real-baseball news/history idea mining by Codex after the research branch is synced to this repaired baseline.
- Codex research candidates must not directly become canonical `PW-*` requirements; owner/ChatGPT synthesis is required first.
- Speed appraisal governance remains separate: do not use this lane to start SP-079 or shoulder work.

## Important second-pass recoveries

- dedicated trade/transaction design;
- CPU targeting of blocked/underused players;
- active draft as separate movement route;
- foreign-player search from the actual Global Baseball World;
- cross-league bidding and early-discovery advantage;
- emergent NPB adaptation;
- national-team player participation agency;
- absolute-vs-era-relative long-run skill-scale problem;
- real-world club programs as starting assets, not permanent exclusive buffs;
- ownership strategy personality while all CPU clubs still want to win;
- expectation-relative team evaluation;
- reforms can fail without catch-up bonuses;
- development-attention trade-offs;
- staff career ladders;
- early extensions;
- broader agent behavior;
- reclamation/revival reputation;
- foreign-player/roster rules as governance targets;
- persistent All-Star/international relationships;
- user-club participation in governance;
- high-contract expectation pressure as context rather than stat penalty;
- bounded prospect-universe architecture.

## Product direction in one sentence

**PowerPro-like simple control surface + deep autonomous long-term baseball world where players, clubs, institutions, rules, markets, technology, and global baseball evolve over decades.**

## Owner-level rules already fixed

- Every CPU club seriously tries to become strong and win; mistakes and different strategies are allowed, deliberate apathy is not.
- User-controlled club retains final authority over GM/manager decisions.
- No hidden rubber-band balancing.
- Future player outcomes remain uncertain.
- CPU does not receive unfair hidden-truth access.
- International tournament physical-load penalty must be user-toggleable.
- Historical legend reincarnation is OFF in the standard world.
- Global baseball beyond NPB should remain alive and, where feasible, start with real existing overseas players.
- League rules/institutions/team count/equipment may evolve.

## Completeness wording

Correct statement:

**The currently available wall-talk has been second-pass preserved as requirements, proposed requirements, concrete examples/rationales, or explicit OPEN domains.**

Do NOT claim that every relevant sentence from every historical chat is mathematically proven preserved unless an authoritative complete chat export is audited row by row.

## Next action

After syncing the Codex branch to this repaired HEAD, run both:

- `docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`
- `docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_SECOND_PASS_ADDENDUM_20260824.md`

on branch:

`codex/pennant-news-idea-mining-20260824`

After Codex pushes, ChatGPT/owner should review research coverage, genuinely new mechanics, extensions, challenged assumptions, and blind spots before adding canonical requirements or beginning implementation.

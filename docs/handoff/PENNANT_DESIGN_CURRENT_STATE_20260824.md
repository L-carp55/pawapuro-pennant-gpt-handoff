# Pennant Design Current State — 2026-08-24

## Current phase

**DESIGN DISCOVERY / EXTERNAL IDEA MINING**

Do not start game-feature implementation yet.

## Canonical branch

`design/pennant-world-master-20260824`

## Read order

1. `docs/state/pennant_design_program_state_20260824.json`
2. `docs/state/pennant_feature_requirements_20260824.tsv`
3. `docs/design/PENNANT_WORLD_SIMULATION_MASTER_20260824.md`
4. `docs/audits/pennant_walltalk_completeness_audit_20260824.md`
5. `docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`

## Current facts

- 235 granular Pennant feature requirements are persisted.
- Owner wall-talk baseline through 2026-08-24 is preserved.
- Open design domains are explicitly listed rather than discarded.
- PD-001A Age Dataset has a spec but is **HOLD / NOT DISPATCHED**.
- Next major work is broad real-baseball news/history idea mining by Codex.
- Codex research candidates must not directly become canonical `PW-*` requirements; owner/ChatGPT synthesis is required first.
- Speed appraisal governance remains separate: do not use this lane to start SP-079 or shoulder work.

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

## Next action

Run Codex task:

`docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`

on branch:

`codex/pennant-news-idea-mining-20260824`

After Codex pushes, ChatGPT/owner should review:

- research coverage;
- genuinely new mechanics;
- partial extensions;
- challenges to current assumptions;
- blind spots;

before adding any new canonical `PW-*` rows or beginning implementation.

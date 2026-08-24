# Pennant information / defense / deployment wall-talk — 2026-08-25

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This file records accepted design direction from the 2026-08-25 owner wall-talk. It supplements, but does not replace, the canonical PW ledgers and master design.

## 1. Player truth, observation, and displayed ratings are separate

The game must distinguish at least:

1. latent current baseball skill;
2. true development / decline state;
3. short-term readiness / feel / mechanics;
4. contextual environment;
5. observed performance;
6. each club's belief about the player.

The user and CPU do not read latent truth directly. A displayed PowerPro-like rating such as `C66` should normally represent the current club's evaluation, not an omniscient true value.

Evaluation confidence should differ by player, skill, league, sample, staff/scouting/data quality, and type of evidence. A displayed rating may rise because the player truly developed, because the club corrected an earlier under-evaluation, or both.

## 2. Evaluation update is distinct from growth

UI/news should distinguish:

- evaluation revision: the club changed what it believes;
- actual development: staff believes the player's baseball skill is changing;
- short-term good/bad state;
- noisy over/under-performance.

Staff are also uncertain and can be wrong. CPU clubs are subject to the same information constraints.

## 3. Replace the daily omniscient condition icon

Do not model PowerPro/Prospi-style daily `絶好調 / 好調 / 普通 / 不調 / 絶不調` as an externally known direct modifier.

Short-term state may internally include physical readiness, fatigue, timing/feel, mechanical stability, soreness/minor issue, and analogous pitching-specific factors. These states have persistence and causes rather than being arbitrary daily re-rolls.

User-facing information should usually be qualitative staff reports, e.g.:

- timing looks unusually good;
- results are strong but underlying contact/approach has not clearly improved;
- staff suspects the club's prior ability estimate was too low;
- fatigue exists but does not yet require rest.

Exact hidden state values should not be exposed by default.

## 4. Analytics / technology value through information advantage

Tracking, analytics, biomechanics, AI, coaching, and medical investment should not primarily act as flat stat buffs.

A major benefit is earlier / better inference about:

- real breakouts;
- false hot streaks;
- mechanical changes;
- deterioration;
- fatigue / injury warning;
- defensive skill;
- player fit.

This allows information efficiency itself to evolve by club and era.

## 5. Defense must materially affect wins

Defense cannot be reduced to error count. The engine must allow defensive quality to change whether a batted ball becomes:

- out;
- single;
- double / triple;
- double play;
- extra advancement.

Conceptual decomposition:

- fielding / range: reaction, first step, route, positioning knowledge, play speed;
- catching / hands: successful processing of reached balls, error tendency;
- arm: throwing strength, transfer, throwing execution;
- team positioning / opponent research: separate from the fielder's intrinsic skill.

A poor defender's largest cost may be balls never reached, which are scored as hits rather than errors.

Defense should also have downstream effects on pitcher workload, starter exit timing, bullpen burden, and roster value.

The engine must be calibrated so defensive differences affect season run prevention and win probability at realistic magnitude, not merely made large by fiat.

## 6. Defensive value is contextual

Defensive value can depend on:

- pitcher batted-ball profile (ground-ball vs fly-ball);
- park geometry / surface / environment;
- score / inning (defensive replacement vs offense-first substitution);
- current rule set and positioning restrictions.

CPU lineup and roster decisions must evaluate offense + defense + baserunning rather than batting alone.

## 7. Pitcher day-state is also uncertain

No omniscient pitcher's-condition icon. Managers infer current effectiveness from information such as:

- velocity / velocity change;
- command;
- release stability;
- pitch quality;
- swing-and-miss;
- hard contact;
- pitch count / recent workload;
- medical and coach reports;
- catcher feedback;
- opponent adaptation / times-through-order;
- game context and bullpen availability.

A scoreless outing can have poor underlying quality and vice versa. Defensive failure must not automatically be charged to pitcher-quality evaluation.

## 8. Starter and bullpen decisions are multi-factor

Starter removal must not be a fixed pitch-count / inning / runs rule. Rotation and bullpen decisions should consider effective performance, opponent familiarity, short- and long-term workload, health, future schedule, reliever availability, competitive context, and player role.

Role concepts may include closer, setup, fireman/high-leverage, matchup, middle, long relief, swingman, mop-up, but these are organizational roles rather than immutable player tags.

Postseason and season-end contexts can legitimately change usage while retaining continuous physical constraints.

## 9. Mental pressure is not a single magic closer rating

Whether a pitcher can handle closer/high-leverage work should emerge from multiple psychological/contextual factors rather than one `closer suitability` stat.

Candidate internal components include:

- pressure response;
- arousal regulation / tendency to press;
- emotional recovery after failure;
- role comfort / routine comfort;
- confidence state;
- prior experience and adaptation.

A pitcher may perform normally while trailing but lose execution in close/high-leverage situations; another may be essentially unaffected. Real-player anecdotes are research/design seeds, not automatic factual hard-coding.

The club must infer these tendencies from multi-year results, pitch quality under leverage, mechanics, coach/catcher observation, role history, and player communication. Small-sample leverage ERA alone must not assign a mental trait.

## 10. Psychological stress can contribute to fatigue

Pitcher fatigue is not only pitch count and consecutive days.

Distinguish at least conceptually:

- physical workload;
- acute psychological stress load;
- accumulated mental fatigue;
- individual recovery.

Two 20-pitch outings can have different costs: a low-leverage clean inning versus repeatedly escaping a one-run, bases-loaded situation.

A pitcher who is more pressure-sensitive may consume more psychological resources in the same game state. Managers/coaches can therefore conclude that a pitcher is more spent than the raw pitch count suggests and remove him earlier.

The user should receive qualitative observations such as `球数以上に神経を使っているようです`, not exact mental-fatigue numbers.

## 11. Manager / staff quality should produce human-like mistakes

Bad CPU management is not random stupidity. Differences should arise from:

- evaluation error;
- slow diagnosis;
- excessive loyalty to past performance;
- fixed-role bias;
- poor workload management;
- weak information integration;
- overreaction to recent results;
- underreaction to real development/change.

All CPU clubs still seriously try to win.

## 12. User-facing control remains simple

Internally deep systems should be exposed mainly through:

- qualitative staff reports;
- a small number of strategy sliders/policies;
- individual player locks / explicit instructions;
- important-event interrupts.

The user should not need to inspect exact fatigue, timing, pressure, or posterior variables every game.

## 13. Required future QA

Implementation must eventually include scenario tests for:

- hot streak caused by noise vs real growth vs prior under-evaluation;
- defensive-team run prevention / BABIP / extra-base-hit differences;
- conversion exploit with strong bat / poor defense at premium positions;
- pitch-count-identical outings with different stress loads;
- leverage vs low-leverage pitcher behavior;
- repeated closer failures and role reassignment;
- velocity/release warning despite good run results;
- defense-caused pitcher workload changes;
- manager archetype differences without hidden-truth access.

## 14. Guardrails

- Do not expose latent truth to CPU or user by default.
- Do not create arbitrary daily condition re-rolls as the main system.
- Do not make `覚醒` a simple event-based stat jump by default.
- Do not reduce defense to errors.
- Do not reduce pitching fatigue to pitch count.
- Do not reduce mental pressure to one magic ability.
- Do not start implementation from this document yet.

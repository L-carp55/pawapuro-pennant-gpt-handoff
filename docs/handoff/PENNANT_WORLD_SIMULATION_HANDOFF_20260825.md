# Pennant World Simulation — Handoff 2026-08-25

Status: **DESIGN DISCOVERY / OWNER WALL-TALK ACTIVE / IMPLEMENTATION NOT AUTHORIZED**

This handoff is for continuing the long-term Pennant World Simulation design in a new ChatGPT session. It is separate from the running/speed/shoulder appraisal lanes.

## 1. Repository and canonical branch

Repository:
`L-carp55/pawapuro-pennant-gpt-handoff`

Canonical design branch:
`design/pennant-world-master-20260824`

Before this handoff, the latest known canonical design commit was:
`721a5f50c3c680b3e5d2fe5e8c6b7ed77c410c37`

The handoff file itself creates a newer commit on that branch. In the next session, fetch the current remote HEAD rather than assuming the previous SHA is still HEAD.

## 2. Non-negotiable product vision

Build a PowerPro/Pennant-like baseball management simulator with:

- PowerPro-like simple/intuitive surface UI;
- deep internal simulation capable of decades/100-year saves;
- no OOTP-style mandatory daily micromanagement;
- user sets policy and may delegate, but has final authority for the user-controlled club;
- causal systems rather than arbitrary gamey buffs/events;
- hidden information and uncertainty;
- CPU clubs cannot read latent truth or cheat;
- every CPU club seriously tries to win long-term;
- dynasties are allowed, with no hidden rubber-band catch-up;
- history, careers, organizational knowledge, rules, markets, and global baseball persist and evolve;
- the baseball world outside NPB is alive;
- standard legend reincarnation is OFF by default;
- international-tournament physical-load effects require a user toggle;
- implementation is NOT authorized yet.

## 3. Appraisal-lane guards

Do NOT progress from this design lane into:

- SP-078 owner verdict;
- SP-079;
- shoulder appraisal;
- speed canonical changes;
- PD-001A dispatch.

Those lanes remain separate.

## 4. Canonical requirement inventory before current wall-talk

Base ledger:
`docs/state/pennant_feature_requirements_20260824.tsv`
PW-001..PW-235

Second-pass addendum:
`docs/state/pennant_feature_requirements_addendum_20260824.tsv`
PW-236..PW-260

Combined canonical requirement count: **260**.

The 2026-08-25 owner wall-talk documents listed below supplement those ledgers but have not yet been converted into new canonical PW IDs.

## 5. External research state before SNS Wave 3

News/history research branch:
`codex/pennant-news-idea-mining-20260824`

Wave 1:
`881096ec374080316c7314fb93ab525f4470d2d7`

Wave 2:
`34ef644dc3c8c5017fc46b68f24dec1096227f7a`

Wave 2 summary:

- 102 total events after Wave 1+2;
- 19 lanes × 17 topics = 323 matrix cells;
- 68 `SEARCHED_SATURATED`;
- 245 `SEARCHED_NEEDS_MORE`;
- 10 `BLOCKED`;
- QA `PASS_WITH_BLOCKERS`;
- PNC-001..PNC-008 partial candidates retained;
- PNC-009 promotion/relegation/qualification tier movement promoted NEW.

Broad news/history search is intentionally paused. Do **not** chase all 245 NEEDS_MORE cells. Use targeted research only where a design decision needs evidence.

## 6. Important owner wall-talk preserved on 2026-08-25

### 6.1 Information / defense / deployment / pitcher mental model

Document:
`docs/design/PENNANT_INFORMATION_DEFENSE_DEPLOYMENT_WALLTALK_20260825.md`

Created in commit:
`dc2b9be0783e224d5f478a7a617d6f6679cb0fa0`

Key decisions/directions:

- displayed PowerPro-like ability is the club's current estimate, not omniscient latent truth;
- distinguish latent skill, true development/decline, short-term readiness, context, observed performance, and club belief;
- no omniscient daily 5-stage condition icon as the main system;
- evaluation revision and real growth are separate;
- analytics/AI/tracking primarily improve information quality/speed, not flat player buffs;
- defense must materially affect outs, BABIP, XBH, runner advancement, DP, pitcher workload, bullpen burden, and wins;
- defense is not merely error rate;
- pitcher day-state is uncertain and inferred from velo, command, release, pitch quality, hard contact, workload, medical/coach/catcher information, opponent adaptation, etc.;
- starter pull/bullpen decisions are multi-factor rather than fixed pitch-count/runs rules;
- mental pressure is not one magic closer-suitability number;
- candidate mental components include pressure response, arousal regulation, emotional recovery, role/routine comfort, confidence, and experience;
- a pitcher may be fine while trailing but struggle in high leverage, or vice versa;
- psychological stress contributes to fatigue, so two 20-pitch outings can have different cost;
- bad CPU management should arise from evaluation/diagnosis/role/workload/information errors, not random stupidity;
- user-facing control remains simple through policies, staff reports, and locks.

### 6.2 Trade market / user roster AI / governance / Active Draft

Document:
`docs/design/PENNANT_TRADE_MARKET_GOVERNANCE_WALLTALK_20260825.md`

Created in commit:
`0c0feba2958d79320c0854dfb3525737776910ec`

Key directions:

- no single omniscient global trade-value point system;
- each club evaluates players through its own imperfect information, needs, depth, competitive window, contracts, future uncertainty, finances, alternatives, and opportunity cost;
- CPU clubs proactively search and contact other clubs;
- needs are functional (`CF defense`, `high-leverage reliever`, etc.), not only positions;
- blocked/underused prospects and surplus depth should be noticed by other clubs;
- anti-fleece comes from rational valuation, competition, alternatives, roster constraints, etc., not hidden anti-user modifiers;
- genuine user information advantage and successful buy-low trades remain possible;
- user-facing roster/GM AI should identify needs, suggest trade/FA/foreign targets, search by desired profile, find possible buy-low players, estimate who may be movable, construct packages, and maintain watchlists;
- that user AI cannot read latent truth or CPU hidden willingness;
- inquiry/negotiation itself produces imperfect information;
- PowerPro-like trade activity save setting: `少ない / 普通 / 多い`;
- owner prefers an active market for fun/history;
- activity setting changes transaction friction/search aggressiveness, not CPU rationality;
- GM/team transaction philosophy varies and can change over time;
- trade deadline is an evolvable governance variable;
- Active Draft (`現役ドラフト`) is a mutable institution, not forever fixed to current rules;
- Active Draft can expand, shrink, change eligibility/timing/selection count/etc.;
- future new player-mobility institutions analogous to Active Draft can be created from bounded rule primitives;
- user can participate in proposals/votes; Commissioner mode may allow direct rule experiments;
- rule/institution changes should have measurable outcomes and unintended side effects.

### 6.3 Trade package valuation wall-talk (not yet separately persisted as its own file)

Important decisions from conversation:

- evaluate the future with vs without the transaction, not simple player-point totals;
- same player has different value for different clubs;
- include current contribution, future distribution, age/aging, contract, health, role/position, scarcity, player preferences/rights, and business value where relevant;
- cheap controllable stars can be worth more than slightly better expensive near-FA players;
- negative-value contracts can exist;
- `star 1 vs prospects 3` is nonlinear and affected by portfolio/diversification, roster slots, need overlap, and risk preference;
- prospects are evaluated as distributions, and different clubs can have different distributions for the same prospect;
- club development fit can change prospect value without flat buffs;
- roster-slot cost and diminishing marginal value prevent `10 weak players for 1 star` exploits;
- FA-to-be/rental value depends heavily on competitive window and institutional compensation;
- real competing offers can raise price; fake anti-user competitors are forbidden;
- deadline urgency changes reservation value;
- medical evaluation can trigger renegotiation or collapse but is uncertain;
- defensive/role/mental fit can affect club-specific value;
- user AI should offer several packages such as `成立優先 / バランス / 低コスト狙い`, not one magic answer;
- three-team trades are a promising OPEN design direction, especially if AI can propose them;
- future rule changes may enable draft-pick trades, salary retention, conditional assets, etc.;
- trade outcome and decision quality are separate; later luck should not retroactively define whether the original decision was rational;
- anti-fleece QA must be scenario-based while still allowing genuinely lopsided outcomes caused by information/forecast differences.

## 7. FA / contracts / agents

Document:
`docs/design/PENNANT_FA_CONTRACT_AGENT_MARKET_WALLTALK_20260825.md`

Created in commit:
`51ae5a78cc65093545859322559fcbabcb7436ca`

Key directions:

- FA is not a highest-salary auction;
- player decisions can weigh salary, years/security, role, winning, region/family, club preference, staff relationships, overseas ambition, posting philosophy, etc.;
- FA rights acquisition does not automatically mean declaration;
- early extensions, upcoming FA, trade decisions, and overseas movement are one connected market/career process;
- role expectations/promises matter, but not every statement becomes a hard contract clause;
- breaking role expectations affects trust, future retention, agent relations, or trade requests rather than directly reducing ability;
- agents differ in timing, market creation, risk appetite, security emphasis, career planning, and information—not just salary inflation;
- FA demand/supply changes dynamically as other FA/trades/foreign acquisitions occur;
- early extension can be a great buy-low or a mistake for either side;
- player and agent forecasts can also be wrong;
- contract years vs annual salary are meaningful tradeoffs;
- long-run salary levels must track the changing league/world economy rather than treating a fixed yen figure as timeless;
- posting/MLB ambition can be part of extension negotiations;
- user roster AI compares Trade / FA / foreign / Active Draft / release / internal promotion rather than treating them as separate mini-games;
- CPU that loses its first FA target should seek alternatives instead of giving up;
- user may delegate negotiations with policy constraints and be interrupted only for important decisions.

## 8. Clubhouse culture / FA fit

Document:
`docs/design/PENNANT_CLUBHOUSE_CULTURE_FA_FIT_WALLTALK_20260825.md`

Created in commit:
`790177314bf1ec39b2ed43bc51479c93012961e5`

Key directions:

- do not model club mood as one `good/bad` meter;
- use multiple dimensions such as discipline/strictness, warmth, internal competition, hierarchy, autonomy, communication openness, role clarity, staff trust, veteran leadership, cohesion, pressure, etc.;
- player preferences differ: some want disciplined/tight organizations, some relaxed/warm clubs, some intense competition, some freedom;
- culture fit matters more than a universal `good culture` ranking;
- strict can be healthy; relaxed can also be unhealthy;
- club culture is emergent and changes with manager, coaches, GM, veterans, captains, results, promises, player treatment, foreign-player support, etc.;
- distinguish actual internal culture from outside reputation;
- FA players know culture imperfectly through agents, former teammates, national-team/All-Star contacts, media, meetings, and history;
- staff/club statements can create expectations; mismatch later can damage trust;
- veterans can have real clubhouse/mentoring/bridge value even after on-field decline;
- foreign-player adaptation/support can use the same culture-fit logic;
- `ムードメーカー` should not be a flat team stat buff; it can mediate tension, integration, slumps, etc.;
- subgroups can exist internally, but UI should stay simple;
- user should influence culture through actual decisions, not a direct `culture +10` slider.

## 9. Long-run global baseball growth

Document:
`docs/design/PENNANT_LONG_RUN_GLOBAL_BASEBALL_GROWTH_WALLTALK_20260825.md`

Created in commit:
`604706edf1a77b9cc3379832503e0b9b355841de`

State update commit:
`c41583987367a53be954198429261e9482994d2e`

Owner decision:

**Default 100-year world should have a positive secular long-run trend in global baseball level and market size.**

Meaning:

- long-term upward pressure on absolute player skill, development knowledge, analytics/AI/measurement, medicine/conditioning, talent pools, academies, scouting networks, fandom/media markets, league revenue, salary markets, and international competition;
- not a mechanical +X% every year;
- cycles, recessions, local decline, bad governance, demographic shocks, and league-specific stagnation remain possible;
- a particular league can decline relative to the world even while improving in absolute terms;
- the 2026 MLB/NPB/KBO/etc. hierarchy is not permanently fixed;
- knowledge diffusion raises the world floor over time while preserving temporary first-mover advantage;
- absolute baseball skill must be separated from era/league-relative displayed PowerPro-like ratings, otherwise every player becomes A/S-rated after decades;
- market growth must separate nominal inflation from real revenue/fan/media/cross-league purchasing-power growth.

The state now includes a top-level positive global-growth principle.

## 10. Current targeted research — player sentiment Wave 3

Task spec:
`docs/tasks/CODEX_PENNANT_PLAYER_SENTIMENT_MINING_WAVE3_20260825.md`

Created in commit:
`721a5f50c3c680b3e5d2fe5e8c6b7ed77c410c37`

Purpose:

Collect public player feedback on long-term Pennant/Franchise modes in:

- PowerPro;
- Prospi;
- MLB The Show.

This is targeted design research, not a new global-news sweep.

Required evidence includes praise, complaints, requests, exploits, tradeoffs, observations, long-save collapse/boredom, UI burden, CPU AI failures, lost old features, and recurring cross-game issues.

Important bias controls:

- Japanese + English;
- multiple platforms;
- do not let one viral post/community define consensus;
- preserve contradictory feedback;
- separate version-specific problems;
- classify recurrence (`STRONG_RECURRENT`, `MODERATE_RECURRENT`, `MIXED_CONTESTED`, `VERSION_SPECIFIC`, `ISOLATED_ANECDOTE`, `INSUFFICIENT_EVIDENCE`);
- semantic-map findings to actual requirement/wall-talk text, not guessed PW ID ranges;
- do not force `NEW_CANDIDATE` to zero or inflate it;
- independent QA is required;
- stop at thematic saturation rather than scraping the whole internet.

Recommended dedicated research branch:
`codex/pennant-player-sentiment-wave3-20260825`

### Dispatch status

As of this handoff, the **task spec and copy-paste Codex execution prompt have been prepared**, but no Codex Wave 3 result has been received in this ChatGPT session yet.

If the user brings back a Codex report in the next session:

1. independently verify starting/final/remote SHA and branch;
2. inspect changed files and scope;
3. verify evidence/source quality, duplication, version context, and cross-game balance;
4. inspect `NEW_CANDIDATE`, `PARTIAL_EXTENSION`, and `CONTRADICTS_CURRENT_DIRECTION` semantically;
5. do not auto-merge/canonize findings;
6. use the findings to reprioritize remaining owner wall-talk.

## 11. Suggested remaining wall-talk priority

The next core design domains, in preferred order, are:

1. **player dissatisfaction / relationships / role conflict / trade request behavior**;
2. **injury / fatigue / medical / rehab / recurrence**;
3. **retirement / continuation / overseas/independent continuation / comeback**;
4. special abilities / red traits / gold traits lifecycle and how they coexist with the deeper mental/context systems;
5. roster rights / registration / waiver / options / assignment / service-time style state machines by league;
6. farm / 2nd / 3rd / 4th-team competition and player-use structure;
7. amateur pipeline: high school / university / industrial / independent / overseas development before draft;
8. finance / fan / media / sponsor / stadium formulas and snowball control;
9. formal information-visibility/UI policy by player class and evidence confidence;
10. awards / Hall of Fame / retired numbers / historical transaction/draft/GM legacy;
11. schedule / travel / postponement / expansion calendaring;
12. bounded Rule Engine primitive catalog.

Do not try to open all of these simultaneously. Finish one coherent block, preserve it, then move on.

## 12. Recommended next-session sequence

If Codex Wave 3 results are already available:

1. restore current branch/HEAD;
2. independently audit Wave 3;
3. extract only high-confidence/recurrent player-experience findings;
4. identify which current directions are supported, contradicted, or missing;
5. then resume owner wall-talk starting with player dissatisfaction/relationships unless evidence suggests another domain must move first.

If Wave 3 has not yet been run:

1. restore current branch/HEAD;
2. confirm the task spec exists;
3. user can dispatch the prepared Codex prompt;
4. meanwhile continue owner wall-talk with player dissatisfaction/relationships.

## 13. Research/implementation discipline

The owner has repeatedly identified a failure mode where research expands forever. Therefore:

- broad wall-talk is appropriate during design;
- targeted evidence collection is useful;
- once enough evidence exists to make an owner decision, synthesize instead of chasing every gap;
- partial completion and explicit blockers are preferable to endless search;
- do not start implementation until the design block is stable and explicitly authorized.

## 14. New-session restoration request

The next ChatGPT session should begin by checking GitHub current HEAD on `design/pennant-world-master-20260824`, reading this handoff, the current state JSON, and the latest 2026-08-25 wall-talk/task documents before continuing. Do not rely only on chat memory if GitHub has moved.

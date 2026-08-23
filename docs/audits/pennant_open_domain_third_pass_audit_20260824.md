# Pennant open-domain third-pass audit — 2026-08-24

Status: **OPEN-DOMAIN LIST FOUND INCOMPLETE / REPAIR REQUIRED**

## Purpose

The second-pass audit repaired missing feature requirements and concrete owner examples. This third pass asks a different question:

> Even where a feature exists in the 260-row requirement inventory, have all materially unfinished design domains been explicitly listed as OPEN so they cannot disappear before implementation?

Result: **No.** The current `open_design_domains` list is directionally strong but still misses several major domains and edge-case families.

This file does **not** promote all items below to accepted features. It records them as domains that require deliberate wall-talk/research or an explicit out-of-scope decision.

---

# A. Already-open domains that are valid

The current state already correctly marks these broad areas OPEN:

- injury/fatigue/condition detailed model;
- stadium/new-stadium/renovation;
- fan/media/sponsor/popularity details;
- finance formulas;
- agent-market details;
- minimal contract clauses;
- national-team eligibility;
- global simulation granularity/performance budget;
- scandal frequency/governance calibration;
- family/children generation;
- coaching/mentorship calibration;
- staff labor market;
- player-association bargaining;
- expansion/relocation governance;
- future technology proposal generation;
- real overseas player data/licensing;
- detailed trade/transaction market;
- active-draft mechanics;
- foreign-player roster-registration rules;
- absolute-vs-era-relative skill-scale policy.

These remain valid.

---

# B. Clear missing OPEN domains

## OD-01 — Game-day roster, lineup, rotation, bullpen and deployment AI

The master states that lineup, batting order, rotation and bullpen roles can be manual/delegated and gives manager philosophies, but **the actual deployment engine is not designed**.

Must later cover at least:
- starting lineup construction;
- rest/platoon decisions;
- rotation maintenance and spot starts;
- bullpen roles and workload;
- closer/setup/fireman/opening/long relief concepts;
- call-up/down interaction with availability;
- player-development vs win-now use;
- user locks/priority instructions.

This is a critical CPU-quality domain, not a UI detail.

## OD-02 — In-game tactical decision engine

The plate-appearance engine exists conceptually, but manager decisions remain underdesigned:
- pinch hitting/running;
- defensive substitutions;
- bunts;
- steal attempts;
- hit-and-run or analogous tactical choices;
- intentional walks;
- pitcher changes;
- matchup usage;
- defensive positioning under the current rule set;
- extra-inning strategy.

This must connect to opponent research and evolving league strategy.

## OD-03 — Retirement / continuation / comeback decision model

The design preserves retirement history and post-career staff paths, but **the decision to retire is not designed**.

Need later to model:
- ability and role offers;
- age/health;
- family/stability values;
- willingness to play overseas/independent leagues;
- desire for milestones/records/championships;
- acceptance of reduced role/pay;
- forced market exit vs voluntary retirement;
- rare comeback/unretirement if desired.

This is distinct from aging and injury.

## OD-04 — Special abilities / traits lifecycle

Existing appraisal specifications treat special abilities as core performance components and explicitly prohibit double counting. Pennant design does not yet specify how blue/red/gold traits evolve through a career.

Need later to decide:
- acquisition;
- improvement/downgrade/removal;
- age-related change;
- experience/role/coaching/mechanics effects;
- persistent vs contextual traits;
- generated-player trait distributions;
- gold-trait rarity over long saves;
- double-count protection with changing base ratings.

## OD-05 — Player morale, relationships and clubhouse social dynamics

Personality, values, leadership, mood-maker effects and staff relationships exist as requirements, but the **actual social/morale state model is not designed**.

Need later to cover:
- teammate relationships;
- manager/coach relationships;
- role satisfaction;
- playing-time dissatisfaction;
- leadership groups;
- conflicts and reconciliation;
- new-player assimilation;
- how much of this remains hidden vs visible;
- preventing tedious soap-opera micromanagement.

## OD-06 — Trade request / holdout / role-conflict behavior

Player values exist, but behavior between “unhappy” and “FA” is underdesigned:
- trade requests;
- refusal to extend;
- negotiation holdout / camp absence where institutionally applicable;
- request for first-team opportunity;
- acceptance/refusal of assignment where rules allow;
- public/private complaints;
- club responses.

## OD-07 — Roster rights / waivers / options / assignment / service-time layer

`PW-256` says roster rules can evolve, but the current-world operational mechanics are not designed.

Need league-specific handling of concepts such as:
- first-team registration / de-registration;
- reserve/protected lists;
- waivers;
- outright/DFA-style equivalents where applicable;
- minor-league options in MLB;
- injured lists;
- service time;
- release/non-tender/free-contract routes;
- protected players for expansion/active drafts;
- nationality/domestic-player/foreign-player roster status.

Do not force every league into one NPB-style state machine.

## OD-08 — Farm / minor / third-fourth team competition structure

The design says second-team results matter and multi-team systems can exist, but does not define:
- league/schedule/opponent structure;
- assignment between 2nd/3rd/4th teams;
- independent/university/exhibition opponents;
- playing-time allocation;
- travel/cost;
- development-game vs official-game distinction;
- how new team levels are integrated after organizational innovation.

## OD-09 — Amateur pipeline / eligibility / progression rules

Prospects can move high school→university→industrial/independent and re-enter drafts, but detailed rules are OPEN:
- draft eligibility;
- draft declaration/submission;
- signing/refusal deadlines;
- school progression;
- university transfer/other pathways where relevant;
- industrial/independent movement;
- overseas amateur routes;
- draft rights and re-entry;
- injury/academic/other interruptions at an abstract level.

## OD-10 — Schedule, calendar, postponement, travel and rescheduling engine

Rule evolution can change team count/game count, but no robust calendar generator is specified.

Need later to cover:
- regular-season scheduling;
- interleague balance;
- rest days;
- travel burden;
- rainouts/postponements;
- doubleheaders;
- rescheduled games;
- tournament/camp overlap;
- postseason calendar;
- expansion from 12→14/16 teams.

## OD-11 — Weather / climate / ballpark day-to-day environment

New stadiums are OPEN, but game-to-game environment is separate:
- rain/wind/temperature;
- dome/retractable roof;
- field surface;
- altitude if global leagues are simulated;
- attendance and postponement effects;
- ball flight and fatigue/health interactions if evidence justifies them.

This should remain optional in surface complexity even if internally modeled.

## OD-12 — Awards, Hall of Fame, retired numbers and legacy-selection systems

Records exist, but selection/recognition systems remain underdesigned:
- MVP;
- Rookie of the Year;
- Best Nine / Gold Glove / Sawamura-type awards;
- All-Star historical prestige;
- Hall of Fame;
- retired numbers / club honors;
- era/context adjustment where needed;
- voting/selection logic and historical records.

This is important for a decades-long history game.

## OD-13 — League economy, salary inflation, currency and cross-league market levels

Club finance is OPEN, but a century-scale world also needs macro-economic consistency:
- salary/revenue inflation;
- changing league revenues;
- cross-league salary competitiveness;
- currency/exchange-rate abstraction if multiple countries transact;
- economic growth/contraction;
- preventing nominal salaries from becoming meaningless over decades.

## OD-14 — Labor stoppages / lockouts / strikes / shortened or cancelled seasons

Player association bargaining is OPEN, but bargaining failure itself is not explicitly preserved.

Potential rare outcomes:
- strike;
- lockout;
- delayed season;
- shortened season;
- cancelled games;
- emergency CBA;
- downstream effects on service time, revenue and records.

This should be very carefully calibrated/toggleable because it can be frustrating.

## OD-15 — League-wide strategic/metagame evolution

Opponent learning exists at player/team level, but the league-wide tactical meta is not explicitly designed.

Examples:
- bullpen specialization;
- opener/piggyback usage;
- increased/decreased bunting;
- steal environment changes;
- defensive positioning trends;
- pitch-selection/pitch-design trends;
- roster construction trends.

Successful strategies should diffuse and eventually face counter-strategies, not remain static for decades.

## OD-16 — Information-visibility model

The project says future skill is uncertain and CPU cannot see hidden truth, but exact UI visibility is still unresolved:
- own NPB current ratings exact or uncertain?;
- opponent NPB ratings?;
- amateur prospects?;
- foreign pros?;
- MiLB/KBO/CPBL players?;
- personalities?;
- injury risk?;
- organizational knowledge?;
- how scouting quality changes visible information.

This is a foundational UX/game-balance decision.

## OD-17 — Physical maturation / body / conditioning development

Age curves cover baseball skills, but young-player physical maturation is not explicitly designed:
- height/weight/body composition changes;
- strength/speed maturation;
- conditioning/training adaptation;
- trade-offs with position/mechanics;
- aging body changes.

Avoid cosmetic-only height/weight if those fields exist.

## OD-18 — Officiating / umpire layer before and during automation changes

ABS rule evolution exists, but the baseline officiating model is not specified:
- human strike-zone variation;
- umpire quality/consistency if included;
- replay/challenge decisions;
- transition to ABS challenge/full systems;
- preventing excessive complexity.

## OD-19 — Rare external shocks

The world has political/institutional change, but rare exogenous disruptions are not explicitly designed:
- disasters;
- pandemics/health emergencies;
- war/geopolitical restrictions;
- visa/sanction shocks;
- infrastructure failure.

These should be rare and probably configurable, and must not become random punishment spam.

## OD-20 — Ownership sale / succession / parent-company and local-market evolution

Expansion/relocation is OPEN, but ordinary ownership change is separate:
- club sale;
- parent-company change;
- owner succession;
- management-policy shift;
- local-market demographic/economic change;
- new ownership increasing/decreasing investment while maintaining the universal goal of winning.

---

# C. Important subdomains already covered by existing OPEN items but needing explicit checklists later

These are not separate top-level omissions, but should not be forgotten:

### Injury/fatigue
- surgery/treatment decisions;
- medical second opinions;
- rehab assignment;
- return-to-play timing;
- recurrence management;
- injury insurance/contract implications.

### Trade/transaction market
- deadline behavior;
- 1-for-1 and multi-player packages;
- three-team deals if desired;
- cash/salary retention where rules allow;
- draft-pick trades if rules allow;
- player consent/no-trade;
- medical review;
- counteroffers/negotiation/walk-away;
- competing bids;
- trade block/untouchable list;
- trade rumors/leaks;
- anti-fleece QA against the human player.

### Contracts
- salary arbitration/dispute procedures where applicable;
- non-tender/release mechanisms;
- signing deadlines;
- incentives/options;
- early extensions;
- contract guarantee differences between leagues;
- service-time implications.

### National teams
- eligibility/dual nationality;
- federation selection;
- club release/insurance;
- calendar conflicts;
- participation refusal;
- qualifiers.

### Integrity
- anti-doping/testing;
- investigations;
- appeals;
- sanctions and reinstatement;
- club vs league jurisdiction.

### League governance
- voting weights;
- commissioner authority;
- dispute resolution;
- emergency rule changes;
- standings/tiebreak procedures;
- transition rules after expansion.

---

# D. Audit conclusion

The current OPEN list should **not** be treated as exhaustive.

Most serious previously-unlisted domains:
1. deployment/rotation/bullpen AI;
2. retirement decision model;
3. special-ability lifecycle;
4. roster-rights/waiver/options state machine;
5. clubhouse/morale/relationship model;
6. schedule/weather/travel;
7. awards/Hall of Fame/legacy;
8. labor stoppages;
9. league-wide strategic evolution;
10. information-visibility model.

These are now preserved as OPEN-design audit findings. They are **not yet accepted detailed specifications** and should be reviewed in future wall-talk/news-mining synthesis.

# Pennant amateur pipeline / draft eligibility / signing rights wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This document preserves the design block for amateur pipelines, draft eligibility, declaration/availability, selection, negotiation rights, signing/refusal, re-entry, school/corporate/independent progression, overseas amateur routes, and long-run rule evolution. It supplements PW-053..PW-075, PW-151, PW-160..PW-173, PW-195..PW-200, PW-239..PW-260 and the roster-rights/farm-system wall-talk. It creates no new canonical PW IDs.

## 1. Amateur pipeline is a career graph, not an annual draft-class generator

Do not generate a player only when the draft screen opens.

A prospect can exist before draft eligibility and move through a career graph such as:

- high school;
- university;
- industrial/corporate baseball;
- independent league;
- junior college / overseas college;
- academy or other future amateur/development institution;
- professional league where league rules permit a later NPB/other draft route.

The same person persists across these transitions.

## 2. Eligibility is evaluated from rules, not age alone

Do not model `age >= 18 -> draft eligible`.

Draft eligibility is a rule-engine result based on the relevant league/era and may depend on:

- current institution and affiliation;
- education/progression state;
- registration history;
- elapsed seasons/years;
- nationality/residency where applicable;
- prior professional affiliation;
- declaration/notification requirements;
- exceptional institutional rules;
- rule changes and transition clauses.

Age is one input where the league's rules make it relevant, not the universal mechanism.

## 3. Eligibility, declaration, and willingness are separate

Keep distinct:

1. **legally/institutionally eligible to be selected**;
2. **required declaration/entry document has been filed**;
3. **player actually wishes to sign if selected**;
4. **clubs believe the player is signable**.

A prospect can be talented and scouted but not yet eligible. An eligible player can decline to declare where the system requires declaration. A declared player can still reject a particular contract or club when rules permit.

## 4. 2025 NPB rule anchor — do not freeze it forever

The most recent fully detailed official NPB draft overview available during this wall-talk is the 2025 overview. It provides useful initial-rule anchors:

- NPB clubs require draft selection to obtain negotiation rights with a qualifying new player;
- High School Baseball Federation / university federation players must be publicly listed as having submitted the applicable pro-intent declaration to be selected;
- Japan Amateur Baseball Association players have registration-season restrictions before NPB contracting, with a different period for high-school/middle-school graduates;
- negotiation rights acquired in the draft cannot be transferred under that rule set;
- negotiation rights expire if a contract/public registration is not completed by the applicable deadline, with different deadlines for some categories such as JABA players and players attending overseas schools.

The 2026 NPB Draft is scheduled for 2026-10-22, but exact 2026 detailed draft rules must be revalidated before implementation rather than assumed from 2025.

## 5. Selection gives rights to negotiate, not automatic ownership

A draft selection must not instantly teleport a player into the organization.

Conceptual states:

```text
eligible prospect
  -> selected
  -> club receives league-defined negotiation/signing right
  -> negotiation
  -> signed OR unsigned/refused
  -> right remains active until expiry/other rule event
  -> rights expire / are released / otherwise resolved
```

Player rights and club rights are rule-defined and can differ by league/era.

## 6. Player can reject a drafted club when the applicable rules allow it

A player can rationally prefer another path because of:

- education goals;
- desire to improve draft position/value later;
- preferred club/region;
- development environment;
- role/pathway confidence;
- compensation/security;
- overseas ambition;
- family/personal reasons;
- belief that current market undervalues him;
- uncertainty about health/readiness;
- desire to remain with current institution.

Do not reduce refusal to a random `signing failure` roll.

## 7. Clubs estimate signability imperfectly

A club may believe a player is likely or unlikely to sign based on:

- scout contacts;
- public statements;
- player/advisor/agent signals where allowed;
- school/team relationships;
- historical preferences;
- market alternatives;
- media reporting;
- club development reputation.

This belief can be wrong.

CPU teams must not read hidden player utility or a guaranteed signing threshold.

## 8. Draft value includes signing risk without collapsing into one number

A very talented player who is difficult to sign can move down a club's board, but the club should compare:

- baseball value distribution;
- need/BPA;
- signing probability belief;
- cost/bonus/contract constraints;
- alternative picks;
- opportunity cost;
- competitive/development timeline.

Different clubs can rationally rank the same player differently.

## 9. Negotiation is a real post-draft stage

After selection, negotiation can include the league-appropriate terms and nonbinding career discussion.

Relevant dimensions may include:

- signing bonus/initial compensation;
- contract classification/status;
- development plan;
- expected initial assignment;
- role/pathway discussion;
- education/family accommodations where applicable;
- timing.

Do not promise future playing time or promotion as a magical binding clause unless the actual rule system supports it. Informal career representations can still influence trust/reputation later.

## 10. Refusal does not delete the prospect

If a player does not sign, he follows another real path.

Examples:

- high school -> university;
- high school -> corporate/industrial team if eligible under rules;
- high school -> independent league;
- university -> corporate/industrial;
- university -> independent;
- amateur -> overseas school/college route;
- remain in current eligible institution where rules allow;
- future professional/overseas route where applicable.

The person remains the same persistent entity.

## 11. Re-entry is eligibility-driven, not a scripted second-chance event

A previously drafted/undrafted prospect can re-enter a future draft when the then-current rules make him eligible again.

His next evaluation uses his actual intervening history:

- new performance observations;
- physical maturation;
- injury history;
- role/position change;
- mechanics changes;
- skill development;
- new league quality/context;
- scouting information growth.

Do not simply apply `previously drafted -> +potential` or a guaranteed rise.

## 12. Institutional waiting/lock periods are rule data

Real-world systems can impose waiting periods or eligibility clocks after joining a particular institution.

Represent them as explicit rule primitives such as:

- minimum registered seasons;
- minimum years since graduation/enrollment;
- declaration windows;
- age/academic-class conditions;
- exception events such as team dissolution where the rule allows them.

Do not hard-code the present JABA periods into the engine itself. They are initial NPB rule data that can change historically or in a future save.

## 13. Negotiation rights have expiry and scope

A draft right should have:

- owning club;
- target player;
- acquisition event;
- expiry date/condition;
- permitted contract type;
- transferability status;
- release/forfeiture conditions;
- effect on player eligibility while active.

Current NPB-style rights may be non-transferable while future rules or other leagues may differ.

## 14. Draft-pick rights and player-negotiation rights are separate concepts

Do not conflate:

- right to make a selection/pick;
- the selected player's negotiation/signing right;
- roster control after signing.

A league may permit trading some draft picks while prohibiting transfer of an already acquired player negotiation right, or vice versa in a future ruleset.

## 15. Current MLB is a different rule family

2026 MLB provides a useful contrast:

- four-year college eligibility depends on college-year/age conditions;
- high-school graduates who have not attended college can be eligible;
- junior-college routes have distinct treatment;
- signing deadlines apply after selection;
- unsigned players can retain future amateur/draft pathways depending on their situation;
- bonus-pool/slot rules create club-level portfolio tradeoffs.

Therefore MLB draft logic must not be recreated using NPB declaration/waiting-period rules.

## 16. Bonus-pool or signing-budget systems are league-rule modules

Where a league uses a draft bonus pool, slot values, hard/soft pools, compensation picks, forfeiture, or other mechanisms, those constraints belong to the league's draft-rule pack.

They can influence strategy such as:

- under-slot/over-slot offers;
- portfolio allocation across picks;
- signability targeting;
- compensation after unsigned selections.

Do not give NPB clubs an MLB bonus-pool game unless NPB rules later evolve in that direction.

## 17. Player pathway choice is a career decision

When multiple next institutions are available, player choice can depend on:

- expected development quality;
- competition/playing opportunity;
- education value;
- compensation/security;
- path to NPB/MLB/other leagues;
- family/geography;
- preferred organization/coaches;
- role/position opportunity;
- risk tolerance;
- current draft/market feedback.

The best baseball-development option is not universally chosen by every player.

## 18. Schools/corporate/independent organizations have reputations and real differences

Do not model `University A = development +5` permanently.

Institutions may differ over time in:

- coaching quality;
- facilities;
- competition level;
- playing-time opportunity;
- medical support;
- scouting exposure;
- positional depth;
- development philosophy;
- connections/network.

Prospects and clubs observe these qualities imperfectly.

## 19. Amateur performance is evidence, not direct ability generation

Keep PW-070's principle:

- amateur statistics are generated/retained as observed performance;
- league quality, age, role, schedule, ballpark/context matter;
- strong amateur results inform evaluation but do not directly add ability points.

A player can dominate weaker competition without having elite professional skill, and a talented player can post noisy/limited statistics.

## 20. Amateur injuries and interruptions persist

A prospect can experience:

- injury/rehab;
- missed season;
- role loss;
- position conversion;
- school/team transfer where rules permit;
- reduced exposure;
- return/recovery.

These events alter scouting information, career choice and development conditions, not just draft stock through a scripted modifier.

## 21. Physical maturation is separate from institution label

High-school, university, corporate and independent prospects differ partly because of age and physical maturation, not because each source has a fixed growth template.

The physical-maturation open domain later determines changes such as strength/body/speed/conditioning. Draft source category should not duplicate those effects.

## 22. Undrafted prospects persist around the draft frontier

PW-260's prospect-universe architecture remains mandatory.

Do not individually simulate every amateur baseball player in the world.

Instead:

- instantiate likely draft/professional candidates and a surrounding fringe;
- keep important previously observed prospects persistent;
- allow new players to enter the individually simulated frontier as performance/scouting/age changes;
- allow undrafted players to move to university/corporate/independent/other routes and later re-enter.

## 23. Prospect identity is preserved through all stages

Store meaningful history such as:

- schools/teams/institutions;
- seasons and roles;
- draft eligibility years;
- declaration decisions;
- public/media rankings;
- each club's historical evaluation where retained internally;
- draft selections/round/pick;
- signed/refused/unsigned outcome;
- later re-entry;
- injury and position/mechanics history.

This makes later retrospectives possible.

## 24. Draft refusal can become history, not a punishment flag

If a player rejects Club A and later becomes a star, that is a career story.

Do not apply hidden vengeance, permanent loyalty penalties, or guaranteed future refusal to that club.

The earlier interaction may affect relationship/reputation only if the causal history justifies it.

## 25. Club treatment and development reputation matter before signing

Prospects can care about evidence such as:

- opportunity for young players;
- successful development histories;
- medical reputation;
- treatment of prior draftees;
- positional blockage;
- farm depth;
- coaching stability.

This creates a legitimate strategic value for building an attractive organization without a universal `draft signing +10%` buff.

## 26. Competitive pathways can cross national borders when rules permit

The Global Baseball World should support plausible cross-border amateur/prospect pathways.

Examples can include:

- Japanese player attending an overseas university/college;
- overseas prospect entering a Japanese amateur/professional development route;
- academy player moving to another country's school/league;
- high-level young player choosing a professional route outside the most obvious domestic draft.

Eligibility must be resolved from the relevant league rules rather than nationality stereotypes.

## 27. International amateur signing and domestic drafts are distinct transaction systems

Where a league signs international amateurs outside its domestic draft, model that as a separate acquisition path with its own:

- eligibility;
- age/registration rules;
- signing windows;
- bonus/pool rules;
- federation/government constraints;
- agent/trainer/network effects;
- club scouting relationships.

Do not force every young global player through one universal draft.

## 28. Draft systems themselves can evolve

Existing governance principles remain:

- declaration requirements can change;
- eligibility ages/years can change;
- lottery/order can change;
- number of rounds can change;
- pick trading can be introduced/removed;
- bonus pools can be introduced/changed;
- compensation rules can change;
- international amateurs can remain separate or be moved into a future draft if governance creates one;
- transition clauses identify which cohorts are affected.

As a 2026 real-world policy example, MLB and MLBPA bargaining includes a proposal for redesigned domestic and international drafts. A proposal is not current law; in the simulation this kind of institutional debate belongs to the Rule Proposal Engine rather than silently changing rules.

## 29. CPU draft strategy must account for pipeline alternatives

CPU teams should understand that a prospect can have an outside path.

Examples:

- a difficult-to-sign high-school player may choose university;
- a player with strong overseas preference may be less signable;
- an older corporate player may have higher current certainty but less long-horizon upside;
- a raw independent-league player may be a lower-cost/high-variance option.

CPU uses its own imperfect information and organizational strategy.

## 30. User draft UI stays compact

The user should not manually manage every amateur eligibility rule.

Useful draft-board display can show concise fields such as:

- current institution/path;
- eligible / not eligible / declaration pending;
- approximate signability or known intention;
- expected next path if unsigned;
- scouting range/confidence;
- major health/availability uncertainty;
- roster/development fit;
- deadlines/rights only when relevant.

The engine handles rule compliance automatically unless the user is intentionally making a governance decision.

## 31. Important events can interrupt automation

Possible important interrupts:

- priority prospect declares or withdraws where rules allow;
- drafted player indicates strong refusal risk;
- signing deadline approaches with unresolved negotiation;
- major medical finding changes draft/signing view;
- player chooses university/corporate/overseas continuation;
- league rule change alters eligibility for a cohort.

Routine eligibility checks remain automated.

## 32. Player visibility and club visibility remain imperfect

The user/CPU club should not know:

- exact future ability;
- exact future development path;
- guaranteed willingness to sign;
- every competing club's draft board;
- future injury/market outcomes.

The player likewise does not know his future draft slot or career outcome.

## 33. No draft-source stereotype should determine career ceiling

Do not encode:

- high school = high potential;
- university = medium potential;
- corporate = low potential;
- independent = lottery ticket only.

The source affects age, observed experience, uncertainty, competition and immediate readiness distributions. Individual talent/development remains causal and variable.

## 34. Development after refusal can improve or worsen stock naturally

A player who rejects a draft selection can:

- improve dramatically;
- remain similar;
- stagnate;
- be injured;
- change position;
- become more polished but lose physical projection;
- fall out of the draft frontier.

There is no guaranteed `拒否して大学へ -> 次回順位上昇` bonus.

## 35. Draft misses should be explainable retrospectively

Long-save history should support questions such as:

- why did a star go undrafted earlier?;
- which club ranked him highly but passed because of signability?;
- did an injury hide his value?;
- did he develop later?;
- was the competition level misunderstood?;
- did another club simply make a better uncertain decision?

This supports the project principle that uncertainty and mistakes are part of the world rather than hidden cheating.

## 36. Future QA

Scenario tests should eventually include:

- high-school star declares, is drafted, refuses, goes to university, and re-enters later as the same person;
- undrafted fringe prospect enters corporate/independent baseball and later becomes draft-worthy;
- two clubs value the same prospect differently because one has higher signability confidence;
- talented but difficult-to-sign player falls and then signs, without CPU hidden truth;
- drafted player remains unsigned until negotiation-right expiry;
- rule change alters eligibility only for the intended cohort through transition rules;
- NPB and MLB pipelines use different eligibility/signing mechanics while sharing the same abstract engine;
- international amateur signing remains distinct from domestic draft where current rules require it;
- amateur performance changes evaluation rather than directly granting ability;
- player source category does not predetermine career ceiling;
- prospect history remains continuous through school/corporate/independent transitions;
- 50/100-year simulation does not lose talent because unsigned/undrafted prospects are accidentally deleted.

## 37. Guardrails

- No annual one-shot draft-class generator disconnected from prior history.
- No universal age-only eligibility rule.
- No automatic signing upon selection.
- No CPU access to hidden signability or future ability.
- No deletion of unsigned/refusing/undrafted prospects.
- No fixed high-school/university/corporate potential templates.
- No direct amateur-stat-to-ability conversion.
- No permanent hard-coding of 2025/2026 league rules into the engine; use rule data and revalidate before implementation.
- No assumption that all international amateurs enter the same draft.
- No implementation from this document yet.

## Research anchors used during wall-talk

- NPB official 2025 Draft overview: `https://draft.npb.jp/draft/2025/information.html`
- NPB official 2026 Draft page (2026-08-26 status: date/host information available; detailed rules to be revalidated): `https://draft.npb.jp/draft/2026/`
- MLB official 2026 Draft overview and eligibility/signing information: `https://www.mlb.com/news/2026-mlb-draft-overview-and-schedule`
- MLB official 2026 CBA draft proposal article, used only as an example of possible future rule evolution rather than current law: `https://www.mlb.com/news/mlb-domestic-and-international-draft-proposals`

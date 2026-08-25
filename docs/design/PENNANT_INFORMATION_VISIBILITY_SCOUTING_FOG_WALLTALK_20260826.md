# Pennant information visibility / scouting fog / club belief wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This document closes the main design questions for information visibility and scouting fog. It supplements PW-004, PW-006, PW-055..PW-062, PW-082, PW-107, PW-112..PW-123, PW-239..PW-245, the information/defense/deployment wall-talk, trade/FA/agent wall-talk, medical wall-talk, amateur-pipeline wall-talk, and finance wall-talk. It creates no new canonical PW IDs.

## 1. Every club owns beliefs, not truth

The simulation keeps latent player/world truth separate from what each organization believes.

Conceptually maintain:

- latent current baseball state;
- observed evidence;
- each club's estimate/distribution;
- confidence/uncertainty;
- evidence age/freshness;
- public/media consensus;
- player/agent self-beliefs where relevant.

The user-controlled club sees its organization's beliefs, not a privileged truth layer.

## 2. PowerPro-like ratings remain the main surface

Do not replace the familiar simple rating screen with mandatory probability tables.

A displayed `C66`, `B75`, etc. normally means:

> `our organization currently evaluates this player's relevant present skill around this level`.

It is an estimate even when shown as one number.

Detailed views can add confidence/uncertainty when useful without forcing it into the main screen.

## 3. Displayed rating and confidence are separate

Two players can both show `ミート C65` while the club has very different confidence.

Example:

- established own-team veteran: `C65 / confidence high`;
- recently scouted foreign prospect: `C65 / confidence low`, with a wider plausible range internally.

Do not encode uncertainty by randomly shaking the displayed number every day.

## 4. Own players have better information, not perfect information

For players inside the organization, the club has access to more evidence:

- games/practice;
- tracking/video;
- coaches;
- medical/conditioning;
- direct communication;
- farm/rehab observations;
- historical internal data.

Therefore present-skill confidence is usually higher, but still not omniscient.

Hidden future growth, subtle decline, latent injury state, psychological state, and newly emerging mechanics can remain uncertain.

## 5. Established opponents are more observable than obscure prospects

Public competition produces information.

A regular NPB player with years of data can be evaluated fairly well even without being inside the club, while:

- newly promoted players;
- injured players;
- role-changing players;
- foreign players from poorly covered leagues;
- amateur prospects;
- lower-level overseas players

can carry wider uncertainty.

Do not assign the same fog level to every non-roster player.

## 6. Visibility is skill-specific

Some dimensions are easier to observe than others.

Possible examples:

- raw running speed may become observable relatively quickly;
- pitch velocity is easy to observe when tracked;
- command quality requires larger/role-aware samples;
- defense/range can need tracking/context;
- future development is inherently uncertain;
- personality/role values require relationship/communication evidence;
- health risk can remain highly uncertain without medical access.

Scouting quality therefore has domain-specific effects rather than one universal `accuracy` value.

## 7. Prospect future value is always a distribution

Never show a guaranteed future ceiling as truth.

Prospect reports can include concepts such as:

- present estimated ability;
- future range;
- most likely role/ceiling language;
- uncertainty/confidence;
- key risk factors;
- observable reasons.

A high-confidence present skill does not imply high-confidence future development.

## 8. Amateur and draft scouting uses layered evidence

Prospect beliefs can use:

- amateur performance;
- competition strength;
- physical/mechanical observation;
- workouts/combine/tests where applicable;
- medical information where legally/structurally available;
- interviews/relationships;
- prior seasons;
- media/public rankings.

No source reveals hidden truth by itself.

## 9. Foreign/overseas scouting depends on coverage and network

A club's uncertainty for overseas players depends on:

- league data availability;
- scouting presence;
- network relationships;
- language/access;
- staff expertise;
- historical familiarity;
- technological/data infrastructure;
- recency of observation.

Money can expand coverage, but Network Capital and Knowledge Capital still matter.

## 10. Public/media evaluation is a separate belief system

Media prospect rankings, public reputation and fan consensus should not simply copy club evaluations.

They can:

- influence player reputation/pressure;
- shape market expectations;
- create public surprise when teams diverge;
- provide information to clubs without replacing scouting.

A club can rationally disagree with the consensus.

## 11. Evaluation changes do not equal development

A displayed rating can change because:

- true skill changed;
- more evidence arrived;
- measurement/model improved;
- role/context changed what was observable;
- club corrected previous bias;
- new medical/mechanical information changed the estimate.

History/UI should distinguish `evaluation revision` from `actual development/decline` where the club can infer the difference.

## 12. New-club evaluation can differ immediately after a transaction

After a trade/FA/signing, the acquiring organization may assign different displayed ratings without any instant physical change.

Reasons can include:

- different scouting model;
- better/worse data access;
- medical exam;
- different defensive/context model;
- different interpretation of mechanics;
- pre-existing information disagreement.

This is legitimate and should not be presented as a magical transfer awakening.

## 13. Evaluation convergence can happen after acquisition

Once a player joins a club, new internal evidence may rapidly narrow uncertainty and revise ratings.

A famous `we thought he was X, but after camp we believe Y` story can therefore emerge naturally.

Both user and CPU organizations experience this.

## 14. Information has freshness and decay

Old observations become stale when:

- time passes;
- player ages/develops;
- mechanics change;
- injury occurs;
- role changes;
- league/context changes.

A club that scouted a player heavily three years ago should not retain perfect current knowledge forever.

## 15. Knowledge can persist without remaining equally reliable

Prior familiarity still matters.

Examples:

- former teammate;
- former catcher/pitcher relationship;
- coach who worked with the player;
- scout with long history;
- international-team relationship.

This can provide a better starting prior or qualitative insight, but evidence can age or become wrong.

## 16. Information can transfer between people and organizations

Connect to PW-112..PW-115.

Player/staff movement may bring knowledge about:

- tendencies;
- preparation;
- mechanics;
- clubhouse behavior;
- opponent approaches;
- league context.

Do not transfer hidden exact ratings; transfer bounded knowledge/evidence.

## 17. Personality and values remain partly hidden

Do not show exact internal values such as:

`MLB ambition = 0.83`.

The club infers them from:

- direct conversations;
- contract/role negotiations;
- prior decisions;
- agent behavior;
- public statements;
- relationships;
- career stage.

Confidence can improve while ambiguity remains.

## 18. Grievance and exit intent are not exact visible meters

The grievance wall-talk remains in force.

User/staff can receive reports such as:

- no major concern detected;
- role dissatisfaction is possible;
- agent has raised the issue;
- formal request received.

Do not expose exact hidden grievance thresholds or the future date of a trade request.

## 19. Medical information has the strongest access asymmetry

Own-club medical staff may have detailed examination/imaging/rehab evidence.

Other clubs may only have:

- public injury history;
- performance changes;
- scout observation;
- disclosed medical information;
- transaction medical examination when permitted.

Even a formal medical review does not reveal guaranteed future health.

## 20. Injury risk is not a visible universal number

Do not display a precise `future injury probability 17.4%` as normal UI.

Possible user-facing reports include:

- no unusual concern identified;
- some durability concern;
- prior injury creates uncertainty;
- medical staff recommends workload caution;
- information is limited.

Any PowerPro-style durability special ability is a summarized evaluation layer, not a second hidden modifier.

## 21. Short-term condition/readiness is qualitatively observed

The previous wall-talk remains mandatory:

- no omniscient daily condition reroll;
- staff observes fatigue, timing, mechanics, soreness, velocity, movement, etc.;
- reports can be uncertain/wrong.

The user can still receive simple actionable language without exact latent-state values.

## 22. Scouting investment improves expected information quality, not truth access

Better scouts/data systems can improve:

- coverage;
- speed;
- evidence quality;
- domain-specific interpretation;
- confidence calibration;
- false-positive/false-negative rates;
- identification of when uncertainty remains high.

They cannot eliminate future uncertainty.

## 23. Good scouting includes knowing when you do not know

A high-quality organization should often be better calibrated, not merely more optimistic/precise.

Example:

- weak scout: confidently reports `B70` on poor evidence;
- strong scout: reports `C62-B72, uncertain due limited competition/data`.

Accurate uncertainty estimation is itself an information advantage.

## 24. Multiple evaluators can disagree internally

A club need not have one monolithic opinion.

Possible sources:

- area scout;
- pro scout;
- analytics model;
- coach;
- medical staff;
- GM/front office.

The organization can combine them into an official working evaluation while preserving disagreement where important.

Do not require the user to manually reconcile every minor disagreement.

## 25. Staff quality affects information integration

An organization can possess good raw information but use it poorly because of:

- siloed departments;
- poor communication;
- model misuse;
- outdated assumptions;
- authority conflicts;
- excessive loyalty to one source.

This creates human-like organizational failure without hidden anti-user behavior.

## 26. CPU clubs use the same visible world and private evidence rules

CPU clubs must not access:

- exact latent ability;
- exact future potential;
- exact injury risk;
- exact player preferences;
- user's private scout reports;
- other CPU clubs' private evaluations.

They act from their own beliefs and information networks.

## 27. Information differences create real market opportunities

Buy-low/sell-high can arise because clubs genuinely disagree.

Examples:

- one club identifies a mechanical improvement early;
- another overweights recent results;
- one club has better overseas scouting;
- medical interpretation differs;
- one club values defensive evidence better.

Anti-fleece logic must not erase legitimate information advantages.

## 28. Market activity itself produces information

Trade inquiry, negotiation, roster decisions, FA bids and public rumors can reveal partial signals.

Examples:

- several clubs inquire about the same player;
- asking price reveals seller valuation range;
- agent market activity suggests demand;
- player is unexpectedly made available;
- club refuses despite public expectation.

These are noisy signals, not direct access to other clubs' hidden values.

## 29. Information leakage can occur without perfect transparency

Relevant events can move knowledge between private/public states:

- agent communication;
- press reporting;
- teammate/staff comments;
- transaction talks;
- official injury announcements;
- public workouts.

Leak reliability and completeness can vary.

Do not make every rumor true or every leak false.

## 30. User-facing confidence should be compact

Possible default representations:

- no marker when confidence is normal/high;
- `?` or confidence badge for uncertain areas;
- range only in detail view;
- short scout note explaining the main uncertainty.

The exact visual design is future UX work, but the surface must stay PowerPro-like rather than spreadsheet-heavy.

## 31. Exact ratings can remain usable for own roster management

The project does not need to make basic lineup setting frustrating by hiding every own-player current rating behind huge ranges.

For established own players, use stable point estimates as the normal UI, with uncertainty surfaced mainly when material.

This preserves intuitive management while keeping the semantic meaning `club evaluation`, not `truth`.

## 32. Information granularity can depend on save preference only at the surface

A future setting may allow users to see more/less confidence detail, but changing UI detail must not change what the organization actually knows.

Do not create an `easy mode = true hidden ratings revealed` inside the standard simulation unless explicitly offered as a separate accessibility/fantasy setting.

## 33. Historical record preserves what was believed at the time where valuable

For major draft/transaction decisions, the game can retain snapshots such as:

- club's pre-draft grade;
- public ranking;
- selection position;
- acquisition-time evaluation;
- later outcome.

This enables retrospective `why did they make that decision?` analysis without rewriting history using future knowledge.

## 34. Ex-post evaluation must not leak into past decisions

When reviewing a 2030 draft in 2040, the UI can show what happened, but CPU decision QA must use what the club knew in 2030.

Do not judge or simulate past decisions using later-discovered hidden truth.

## 35. Information systems improve over 100 years

Tracking, AI, medical imaging, biomechanics, data sharing and scouting tools can evolve.

Effects can include:

- narrower uncertainty in some observable skills;
- faster detection of change;
- broader geographic coverage;
- better calibration;
- new data types.

Future technology must not eliminate irreducible uncertainty about development, injury, adaptation or human decisions.

## 36. Information advantage can diffuse

Successful evaluation methods can spread through:

- staff movement;
- vendors;
- publications;
- imitation;
- league-wide infrastructure;
- technology adoption.

A first mover can gain temporary edge without keeping permanent omniscience.

## 37. Required QA

Future QA should test:

- two clubs show different ratings for the same player from different evidence;
- acquisition changes displayed evaluation without actual skill jump;
- own-player confidence is high but not perfect;
- obscure overseas prospect has wider uncertainty than established NPB regular;
- old scouting report becomes stale after mechanics/injury change;
- strong scout reports wider but better-calibrated uncertainty than overconfident weak scout;
- public/media ranking disagrees with club board;
- CPU cannot read user/private reports;
- medical exam changes beliefs but does not reveal future injury truth;
- market inquiry creates noisy information without exposing exact trade values;
- historical decision review uses contemporaneous information rather than future outcomes;
- 100-year technology improves observation without collapsing uncertainty to zero.

## 38. Guardrails

- No user/CPU omniscient latent ratings in standard mode.
- No guaranteed future potential value.
- No universal fog penalty for every non-roster player.
- No one-dimensional scout accuracy stat as the entire system.
- No exact personality/grievance/injury-risk meters by default.
- No daily random rating jitter to represent uncertainty.
- No transfer-acquisition rating change interpreted automatically as real development.
- No perfect permanent information from old scouting.
- No anti-fleece rule that deletes legitimate information asymmetry.
- No mandatory probability-spreadsheet UI.
- No implementation from this document yet.

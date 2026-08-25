# Pennant retirement / continuation / overseas / independent / comeback wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This document preserves owner wall-talk on retirement, continued playing, overseas/independent continuation, unsigned states, comeback, final seasons, injury-related career decisions, and transition out of playing. It supplements lifecycle, identity, transfer, contract/agent, injury/medical, global-world and history design. It creates no new canonical PW IDs.

## 1. Retirement is a career decision, not an age-trigger event

Do not model retirement as `age >= X -> retire` or a fixed random retirement roll after a threshold.

Retirement emerges from the interaction of:

- desire to continue playing;
- expected playing opportunities;
- physical capability / health;
- role willingness;
- expected league/club market;
- salary/security expectations;
- competitive goals;
- family/geography/personal priorities;
- injury/treatment burden;
- career identity/legacy goals;
- alternative post-playing opportunities.

Age matters through these mechanisms rather than as a deterministic timer.

## 2. Club separation and player retirement are different

A club can decide it no longer wants a player without the player deciding to retire.

Keep separate states such as:

- retained / under contract;
- released / non-tendered / free-contract equivalent according to league rules;
- unsigned free agent;
- negotiating with domestic clubs;
- exploring overseas/independent options;
- deciding whether to continue;
- retired.

Do not auto-retire a released veteran because his former NPB club no longer wants him.

## 3. Desire to continue and market feasibility are separate

A player may strongly want to continue but receive no acceptable offer.

A player may also receive offers but voluntarily retire because the available role, location, salary, health burden, or family cost is not worth continuing.

This distinction is necessary for realistic late-career stories.

## 4. Player beliefs about the market are imperfect

The player and agent do not know every club's hidden willingness.

They estimate market opportunity from:

- prior inquiries;
- agent network;
- public usage/roster needs;
- teammates/former teammates;
- media;
- overseas contacts;
- scouting/reputation;
- previous contract negotiations.

A player can misjudge his market and remain unsigned longer than expected.

## 5. Retirement decision can be delayed

Do not require every veteran to make an immediate binary choice on a fixed offseason date.

Possible path:

`released -> waits for NPB offer -> explores KBO/CPBL/Mexico/independent -> lowers role/salary expectations -> still no acceptable offer -> retires`.

This preserves real market uncertainty and connects directly to PW-127/PW-128.

## 6. Overseas and independent continuation are normal career paths

A player who loses an NPB role may continue in:

- MLB/MiLB where plausible;
- KBO;
- CPBL;
- Mexico;
- independent leagues;
- other future leagues in the Global Baseball World.

Destination depends on actual market demand, league rules, salary/role, player preferences, family/geography, level, and career goals.

Do not treat overseas continuation as a special random revival event.

## 7. Role willingness can broaden with career stage

A veteran may gradually accept roles he rejected earlier:

- regular -> platoon;
- starter -> relief;
- closer -> setup/middle relief;
- everyday player -> bench/pinch hitter;
- premium defensive position -> lower-load position;
- NPB first team -> overseas/independent role.

Another player may refuse such downgrades and retire sooner. No universal veteran personality rule.

## 8. Health and treatment can trigger retirement decisions

The injury/medical system connects directly to career continuation.

Examples:

- young player chooses long surgery/rehab because expected remaining career is large;
- older player with the same treatment burden decides not to spend 12-18 months rehabilitating;
- repeated recurrence lowers willingness to continue even when another procedure is medically possible;
- player continues if a lower-load role/position can reduce physical demands.

Do not encode `major injury -> retirement` as a fixed probability independent of career context.

## 9. Return-to-performance belief matters more than mere medical clearance

A player may be medically capable of playing but believe he can no longer perform at an acceptable professional level.

Conversely, the player may believe he can still contribute even when clubs are skeptical.

This creates natural disagreement between player self-belief and market evaluation.

## 10. Career goals can delay or accelerate retirement

Possible motivations include:

- championship pursuit;
- milestone/record pursuit;
- desire to finish with a particular club;
- desire to play with/against a family member or important teammate;
- national-team ambition;
- desire for one more full season;
- wish to retire while still effective;
- desire to prove recovery after injury;
- financial/security needs.

These are weights in an individual decision, not scripted mandatory story events.

## 11. Planned final season is distinct from immediate retirement

A player may announce that the current season will be his last.

This can create:

- final-season historical context;
- retirement-game/ceremony possibilities where culturally/institutionally appropriate;
- media/fan attention;
- role discussions with the club;
- legacy milestones.

The announcement should not provide a hidden performance buff.

## 12. Retirement announcement can occur at different times

Possible timings include:

- preseason/offseason;
- during a season after decline/injury;
- after the season;
- after an unsuccessful free-agent search;
- after a postseason/championship;
- during rehabilitation when expected return value changes.

The system should not force one universal retirement calendar.

## 13. Player can retire while a club still wants him

Voluntary retirement despite offers should be possible because of:

- health;
- family/personal priorities;
- desired role no longer available;
- career goals already satisfied;
- unwillingness to move geographically;
- unwillingness to accept lower-level play;
- alternative career opportunity.

Do not assume money always maximizes continuation utility.

## 14. Player can continue despite widespread expectations of retirement

Media/club/fan expectation is not the player's true retirement intent.

An older player can keep searching for a role if he still wants to play and believes one exists.

This reinforces the information-uncertainty design: retirement intent is imperfectly observed until communicated.

## 15. Agent role changes late in career

Agents can:

- search smaller markets;
- contact overseas/independent clubs;
- negotiate reduced or specialized roles;
- advise whether to wait or retire;
- test whether a ceremonial/old-club return is possible;
- compare player/staff transition opportunities where permitted.

Agents can be wrong about market depth.

## 16. Clubs should not know an exact hidden retirement threshold

A CPU/user club may infer:

- player seems strongly committed to continuing;
- family considerations may matter;
- player is unwilling to accept a minor role;
- retirement is increasingly likely.

Do not expose `retires if offer < 37 million` or equivalent hidden utility thresholds.

## 17. Retirement and grievances can connect

A veteran may choose retirement rather than accept a role he strongly dislikes, but this is not always a hostile grievance.

Examples:

- player wants to remain a starter and retires rather than move to relief;
- player accepts a bench role because club trust is high;
- relationship breakdown accelerates exit from one club but the player continues elsewhere.

Retirement, trade request, FA exit, and club relationship are distinct outcomes from shared career preferences.

## 18. Retirement and club treatment affect reputation

How clubs handle veterans can contribute to player/agent reputation:

- transparent role discussion;
- respectful release;
- helping find another opportunity where plausible;
- final-season handling;
- injury/medical treatment;
- broken promises or public conflict.

Do not give a universal morale penalty/reward; effects propagate through relationships and reputation.

## 19. Retirement does not erase the person

Retired players remain historical entities.

Persist:

- full playing career;
- teams/leagues;
- contracts/transactions;
- major injuries;
- awards/records;
- relationships where historically relevant;
- retirement date/reason category where known in-world;
- post-playing career if they remain active in the baseball world.

This connects to PW-213.

## 20. Post-playing paths are selective

Not every retired player becomes a coach.

Possible paths include:

- no continuing baseball role;
- coach/instructor;
- manager;
- scout;
- front office/GM track;
- analyst/media role if modeled;
- federation/league/academy work;
- other off-field path not actively simulated in detail.

Only people relevant to the baseball world need full active-agent simulation after retirement.

## 21. Playing reputation does not equal staff ability

Existing rule `great player != great coach` remains mandatory.

Playing career can affect opportunity/network/reputation but does not directly determine coaching/GM skill.

## 22. Temporary retirement / comeback is possible

Retirement need not be an irreversible deletion of player state.

A player can consider comeback when:

- desire to play returns;
- health improves;
- a suitable role appears;
- an expansion/new league creates demand;
- a former club/player relationship creates an opportunity;
- financial/personal circumstances change.

Comeback should be uncommon enough to remain meaningful but causal, not a random nostalgia event.

## 23. Comeback requires preserved physical state

A retired player does not freeze at retirement ability.

During time away:

- aging continues;
- conditioning can decline depending on continued training;
- injuries may heal or persist;
- baseball timing/skill readiness can decay;
- some physical recovery from chronic workload may occur.

A comeback therefore requires re-evaluation rather than restoring the last saved rating.

## 24. Retirement duration affects comeback feasibility

A short retirement after injury/market failure is different from a five-year absence.

Longer absence generally creates larger uncertainty and performance-readiness cost, without making comeback mathematically impossible at a fixed number of years.

## 25. Comeback market is real, not guaranteed

A player wanting to return still needs a club/league willing to sign him.

Possible path:

`retired -> trains/works out -> agent contacts clubs -> tryout/scouting -> contract offer or no market -> return or remain retired`.

CPU/user teams use imperfect evaluation and cannot read future comeback performance.

## 26. New leagues/expansion can create late-career opportunities

Because the global world and league structure evolve, future expansion or a strengthening overseas league can create a new market for veterans who otherwise would retire.

This is a natural consequence of the world system, not an anti-retirement catch-up mechanism.

## 27. Historical recognition should distinguish voluntary and market-forced endings

For history/UI, useful narrative distinctions include:

- voluntary retirement while still wanted;
- retirement after no acceptable offer;
- retirement driven mainly by injury/medical burden;
- announced final season;
- overseas/independent continuation before retirement;
- comeback after retirement.

Do not expose one hidden `retirement reason scalar`; preserve causal history instead.

## 28. User-facing control remains light

For the user-controlled club, important cases can interrupt automation:

- veteran asks about next-season role;
- player considering retirement seeks role clarity;
- player asks whether club would retain him after rehab;
- club wants to discuss a final-season/retirement arrangement;
- retired former player wants to attempt a comeback or staff role.

Routine market searches and low-impact retirements can be handled automatically and summarized.

## 29. CPU clubs respond rationally to retirement uncertainty

CPU clubs should:

- plan depth if a veteran may retire;
- avoid assuming retirement before it is known;
- offer contracts/roles when worthwhile;
- pivot to alternatives if the player retires/rejects;
- account for comeback candidates only when information/market suggests it.

Do not make CPU roster planning fail because an exact retirement date was hidden only from the user.

## 30. Long-run equilibrium must not use forced retirement as a population-control hack

Player population balance should come from roster limits, talent generation, market demand, aging/performance, league structures and career decisions.

Do not artificially force extra retirements solely because the simulation has too many players.

## 31. Future QA

Scenario tests should eventually include:

- same age/performance but different role preferences -> continue vs retire;
- released veteran continues in KBO/CPBL/Mexico/independent league;
- player wants to continue but no acceptable market exists;
- player retires despite a domestic offer because role/family/health costs dominate;
- major surgery selected by young player but retirement selected by older player with different career horizon;
- veteran accepts reduced role after previously rejecting it;
- announced final season without performance buff;
- short retirement followed by realistic comeback attempt;
- long retirement requiring major re-evaluation rather than frozen ratings;
- expansion/new league creating a legitimate comeback/veteran market;
- CPU planning around retirement uncertainty without hidden-truth access.

## 32. Guardrails

- No fixed retirement-age threshold as the core mechanism.
- No automatic retirement immediately after release/no NPB offer.
- No assumption that all players accept any offer to continue.
- No assumption that all veterans broaden role preferences the same way.
- No injury-to-retirement direct random table independent of career context.
- No frozen ability during retirement.
- No guaranteed comeback contract.
- No reincarnation/nostalgia mechanic disguised as comeback.
- No forced retirement as a population-control shortcut.
- No implementation from this document yet.

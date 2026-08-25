# Pennant season calendar / schedule / travel / postponement / weather wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This document preserves the design block for season calendars, schedule generation, travel, rest, postponements, makeup games, doubleheaders, venue availability, weather, domes/roofs, postseason/international/farm overlap, and long-run rule evolution. It supplements PW-181..PW-203, OD-10/OD-11, the injury/fatigue design, farm-system design, international design, and Rule Proposal Engine. It creates no new canonical PW IDs.

## 1. Calendar is a world system, not a fixed table

Do not hard-code one 2026 NPB schedule and repeat it forever.

A season schedule is generated from current rule/institution state such as:

- number of clubs;
- league/division structure;
- games per club;
- opponent frequencies;
- home/away requirements;
- interleague structure;
- postseason format;
- All-Star/international windows;
- venue availability;
- travel/rest constraints;
- season start/end windows;
- farm/development competition structure;
- weather/roof rules;
- rescheduling policy.

## 2. Master calendar coordinates all baseball activities

A player/team can have overlapping obligations across:

- spring camp/preseason;
- regular season;
- farm/development games;
- postseason;
- All-Star events;
- national-team tournaments/qualifiers;
- rehab games;
- winter leagues;
- exhibitions;
- draft/transaction/contract deadlines;
- governance meetings where calendar-relevant.

The calendar engine prevents impossible double-booking or explicitly resolves conflicts.

## 3. Competition schedule and player availability are separate

A game can exist on the calendar even if a particular player is unavailable because of:

- injury;
- rest;
- international duty;
- suspension;
- roster status;
- travel/visa issue;
- other institutionally valid reason.

Do not delete scheduled games to solve player conflicts.

## 4. Schedule generation is a constraint problem

The generator should satisfy hard constraints first, then optimize soft preferences.

Hard constraints may include:

- legal number of games;
- opponent counts;
- home/away totals;
- venue impossibility;
- postseason qualification windows;
- minimum turnaround where rules require it;
- league-specific travel/series rules;
- shared-stadium conflicts.

Soft objectives can include:

- reducing extreme travel;
- balancing rest;
- avoiding excessive home/road streaks;
- commercial/rivalry preferences;
- minimizing late-season congestion;
- geographic clustering.

## 5. Imperfect schedules are allowed when causally justified

Realistic calendars need not be mathematically perfectly fair.

A club can have a harder travel month or an awkward run of games because of:

- venue constraints;
- rescheduling;
- league events;
- regional travel;
- historical structure.

But unfairness should come from explicit constraints/events, not random punishment of the user.

## 6. Rest days are real physical resources

Days off affect:

- acute fatigue recovery;
- bullpen availability;
- starter rotation planning;
- catcher/rest-heavy positions;
- injury rehab progression where relevant;
- travel recovery.

Do not give a generic team ability bonus for an off day.

## 7. Travel is a workload component

Travel can contribute to readiness through:

- distance/time-zone change where relevant;
- overnight/late arrival;
- consecutive road series;
- international travel;
- limited recovery time;
- travel quality/logistics.

Exact magnitude requires research/calibration. Do not equate kilometers directly with `fatigue +X`.

## 8. Travel burden differs across global leagues

The Global Baseball World includes leagues with very different geography.

A compact domestic league and a continent-spanning league should not have identical travel cost/recovery patterns.

Travel infrastructure and scheduling quality can evolve over decades.

## 9. Weather is a day-level environment, not random flavor only

Relevant high-level variables can include:

- rain/precipitation;
- temperature;
- wind;
- humidity where evidence/model supports it;
- extreme-weather conditions;
- field/surface condition.

The engine should only model effects with meaningful gameplay/simulation value.

## 10. Weather and ballpark infrastructure interact

Venue state can include:

- open-air;
- fixed dome;
- retractable roof;
- surface/drainage quality;
- altitude/geometry where relevant;
- future renovations.

A roof can reduce postponement/weather exposure without becoming a universal performance buff.

## 11. Weather affects game conditions through causal channels

Potential effects, subject to calibration, include:

- postponement/delay probability;
- ball flight;
- footing/fielding conditions;
- grip/throwing environment;
- player thermal/physical stress;
- attendance.

Do not create a generic `rain = all players -5` modifier.

## 12. Forecast and actual weather are different

Clubs/user can know forecasts with uncertainty before games.

This can affect:

- pitching plans;
- travel/logistics;
- likely postponement planning;
- lineup/rest considerations in limited cases.

Do not reveal exact future weather as hidden truth far in advance.

## 13. Postponement is an event with downstream consequences

A postponed game affects more than one date.

Possible consequences include:

- starter rotation reset/reassignment;
- bullpen recovery;
- changed travel plan;
- future makeup-game congestion;
- ticket/attendance effects;
- roster timing;
- postseason/calendar pressure.

This creates natural strategic differences without scripted bonuses.

## 14. Makeup games use explicit rescheduling rules

The engine should search valid dates/windows according to the current league rules and constraints.

Possible outcomes where rules permit:

- makeup on future off day;
- schedule extension;
- doubleheader;
- neutral/alternate venue;
- cancellation/no contest only under the applicable rules.

Do not silently erase unplayed games.

## 15. Doubleheaders are rule-defined

If a league permits doubleheaders, represent:

- roster rules if special;
- pitching/rest consequences;
- travel/calendar compression;
- game-time spacing;
- historical record.

Do not assume MLB/NPB/future leagues use the same doubleheader rules.

## 16. Late-season congestion can emerge naturally

Repeated postponements can create:

- dense final weeks;
- rotation improvisation;
- bullpen stress;
- rest tradeoffs;
- competitive consequences.

This should be a causal consequence of weather/calendar state, not a hidden playoff-race difficulty modifier.

## 17. Postseason calendar is derived from current rules

The postseason engine must adapt if the league changes:

- team count;
- divisions;
- qualification criteria;
- series length;
- byes;
- reseeding;
- tie-breaks;
- neutral-site rules;
- home-field rules.

Do not build postseason dates around a permanent 12-team NPB assumption.

## 18. League expansion must trigger schedule regeneration, not patches

If the world changes 12 -> 14 -> 16 clubs, the same scheduling architecture should construct a new valid season.

Expansion may require governance decisions on:

- league/division alignment;
- game count;
- interleague frequency;
- travel balance;
- postseason format;
- farm schedule.

## 19. International tournaments share the calendar

WBC/Premier12/Olympics/qualifiers/etc. can create:

- player absence;
- travel;
- physical load if the user's tournament-load setting permits it;
- club roster replacements;
- scouting/relationship/history effects.

Do not treat international events as outside-time cutscenes.

## 20. International physical-load toggle remains authoritative

The existing user requirement remains:

- tournament honor/popularity/history effects remain meaningful;
- physical fatigue/injury impact follows the chosen OFF/LIGHT/REALISTIC-like setting.

Calendar conflicts still exist even if physical-load effects are disabled.

## 21. Farm/third/fourth-team calendars are separate but coordinated

Each organizational team can have its own competition schedule.

Players moving between levels need:

- travel/assignment timing;
- legal roster status;
- rest/readiness implications;
- rehab-game availability.

Do not simulate a farm player as appearing in two games in different cities on the same date.

## 22. Development teams need enough games/opponents to justify existence

Connect to the farm wall-talk.

A third/fourth team only creates real playing opportunity if its competition circuit has:

- opponents;
- schedule volume;
- suitable competition quality;
- travel/facility resources.

This prevents fake development value from a menu-created team with no real games.

## 23. Winter leagues and overseas assignments occupy real time

Winter-league participation can affect:

- offseason recovery;
- playing experience;
- exposure/relationships;
- injury/load;
- travel;
- spring readiness.

The player cannot simultaneously be at incompatible events.

## 24. Stadium availability can constrain schedule

Potential constraints include:

- shared venue;
- concerts/events;
- renovation;
- disaster/damage;
- temporary relocation;
- new stadium opening.

The stadium system later provides the detailed venue-state model.

## 25. Rare shocks can alter seasons without becoming routine chaos

If rare external-shock systems are enabled, the calendar can support:

- delayed starts;
- suspended periods;
- shortened seasons;
- relocated games;
- closed-door/attendance restrictions;
- emergency rule changes.

These should be rare/configurable and historically recorded.

## 26. Labor stoppages use the same calendar layer

Strike/lockout/shortened-season design, if later implemented, should modify the existing season calendar rather than run as a detached event.

Consequences can propagate to:

- games played;
- service time according to rules;
- revenue;
- records;
- contract timelines;
- draft/order rules;
- postseason format.

## 27. Transaction deadlines are calendar objects

Trade deadline, roster expansion/cut dates, signing deadlines, draft dates, posting windows and similar rules should be attached to the league calendar/rule system.

If governance changes a date or mechanism, the calendar updates accordingly.

## 28. Player rights clocks and service clocks use actual calendar state

Roster-rights systems should reference:

- actual active days;
- injured-list days where rules count them;
- season dates;
- registration periods;
- eligibility windows.

Do not simulate rights from an abstract season counter detached from the schedule.

## 29. Schedule affects CPU deployment decisions

Managers/GM AI can plan around known future schedule such as:

- off days;
- doubleheaders;
- long road trips;
- postseason proximity;
- expected bullpen load;
- upcoming opponent quality;
- international absence.

CPU uses known calendar/forecast information, not future hidden outcomes.

## 30. User can set policies, not manually solve scheduling

Normal club mode should not require the user to construct the league schedule.

League office/engine handles schedule generation.

User-facing decisions are limited to meaningful club-level issues such as:

- travel/rest policy where applicable;
- rotation response;
- rehab/farm assignment;
- venue alternatives if club authority exists;
- governance votes on future schedule structures.

Commissioner mode can expose schedule editing separately.

## 31. Calendar UI should make congestion legible

Useful views include:

- month calendar;
- travel/road-trip blocks;
- rest-day markers;
- makeup/doubleheader markers;
- international absences;
- key transaction deadlines;
- farm/rehab schedule where relevant.

Do not require users to calculate schedule stress manually from raw dates.

## 32. Historical schedule state is preserved

For each season retain enough data to reconstruct:

- games scheduled/played;
- postponements/makeups;
- season length;
- postseason structure;
- major disruptions;
- league/team alignment;
- rule version.

This matters for comparing records across eras.

## 33. Schedule quality itself can improve institutionally

Over decades leagues may adopt better scheduling/forecast/logistics systems.

Potential effects include:

- less unnecessary travel;
- better recovery spacing;
- more robust rescheduling;
- improved venue coordination.

Do not model this as a direct player-stat buff.

## 34. Long-run schedule QA

Future QA must test:

- every club receives correct game totals/opponent mix;
- expansion to 14/16 clubs still generates valid calendars;
- no impossible same-time player/team assignments;
- rainouts generate legal makeup dates;
- repeated rainouts can create realistic congestion without schedule deadlock;
- dome/open-air differences affect postponement causally;
- global travel burden differs plausibly by geography;
- international events integrate without deleting club games;
- shortened seasons preserve historical context;
- service/transaction deadlines use real calendar dates;
- farm/third/fourth teams receive valid competition schedules;
- CPU deployment uses calendar knowledge without future omniscience.

## 35. Guardrails

- No permanent replay of the 2026 schedule.
- No user-specific schedule punishment.
- No arbitrary `travel = ability -X` modifier.
- No generic `rain = all ratings -X` modifier.
- No silent deletion of postponed games.
- No assumption every league uses the same doubleheader/postponement rules.
- No international tournament existing outside the calendar.
- No fixed 12-club architecture.
- No farm team with fake playing opportunities disconnected from scheduled games.
- No mandatory league-schedule micromanagement in normal club mode.
- No implementation from this document yet.

# Pennant awards / Hall of Fame / retired numbers / legacy wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This document preserves the design block for league awards, voting/selection, Hall of Fame, club honors, retired numbers, legacy, historical-era context, and long-save recognition. It supplements PW-185, PW-187, PW-213..PW-221, the long-run growth design, information-visibility design, and Wave 3 long-save/history findings. It creates no new canonical PW IDs.

## 1. Recognition systems are institutions, not cosmetic end-of-year popups

Awards and legacy systems should influence and preserve baseball history without directly changing underlying baseball ability.

They can affect:

- player reputation/prestige;
- media/fan attention;
- contract/market perception where rational;
- historical ranking/context;
- Hall-of-Fame candidacy;
- club legacy;
- retirement/final-season narratives;
- international/league prestige.

Do not implement `award -> ability +X`.

## 2. Each award has a rule definition

An award is defined by rule data such as:

- league/competition scope;
- eligible positions/roles;
- minimum participation requirements;
- voter/selector type;
- ballot structure;
- timing;
- permitted statistics/information environment;
- tie rules;
- historical rule version;
- award-specific criteria.

Do not hard-code every award to `highest overall value wins`.

## 3. Different awards can legitimately value different things

Examples of award dimensions can include:

- overall season value;
- pitching performance;
- batting performance;
- defense;
- rookie eligibility;
- comeback/return where such an award exists;
- positional excellence;
- postseason/international performance for competition-specific awards.

The exact 2026 real-world rule/selector set is initial rule data to verify before implementation.

## 4. Voters use observable information, not hidden truth

Award voters/committees do not know latent ability.

They can observe or receive:

- statistics;
- games/film;
- public advanced metrics available in the era;
- team context;
- media narratives;
- reputation;
- role/position;
- historical comparisons.

This allows disagreement and imperfect awards without random selection.

## 5. Award voting can contain human-like biases

Possible bounded effects include:

- reputation/incumbency;
- narrative strength;
- team success;
- milestone salience;
- traditional-stat preference;
- newer-metric preference;
- position/role expectations;
- regional/media exposure.

These must come from voter/institution/era state, not a generic random `snub chance`.

## 6. The voting environment can evolve over decades

As baseball knowledge and media change, award selection can shift.

Examples:

- stronger use of advanced defensive metrics;
- changing pitcher-win emphasis;
- changing valuation of relief roles;
- increased use of context-neutral metrics;
- new award categories;
- obsolete awards disappearing;
- selection body changing.

Historical winners retain the rules/context of their own era.

## 7. Award systems can change through governance

Possible rule changes include:

- eligibility thresholds;
- ballot size;
- voter groups;
- award name/category;
- league-wide vs separate-league award;
- defensive position categories;
- rookie definition;
- tie/second-place rules.

Do not rewrite earlier history after a rule change.

## 8. Defensive awards cannot be fielding-percentage contests

Connect to the defense/information design.

Defensive selection can use the era's available evidence about:

- range/opportunity conversion;
- throwing;
- catching/hands;
- positional difficulty;
- playing time;
- advanced tracking where available;
- observer/scout impressions.

Because defensive measurement is uncertain, voters can disagree without the engine giving them latent fielding truth.

## 9. Rookie awards require explicit eligibility state

Rookie eligibility should derive from the league's rule system and roster/service/history state, not from `age <= X` alone.

Rule evolution can change eligibility, and international/professional prior experience must be handled according to the applicable league rule.

## 10. Shortened seasons and unusual years remain historically valid

Awards may still exist in shortened/changed seasons according to the rules of that year.

Do not normalize away the historical fact that seasons had different lengths or structures.

Historical comparisons can provide context rather than rewriting raw totals.

## 11. Award outcomes store voting detail where available/appropriate

Persist useful history such as:

- winner;
- finalists/top finishers;
- vote totals/points if that selection system uses them;
- award rule version;
- season context;
- key statistics/narrative snapshot.

This lets users revisit disputed or close races decades later.

## 12. Award snubs and surprise winners can become real stories

A player may lose an award despite stronger modern-model value because contemporary voters valued other evidence/narratives.

Another player may win narrowly due legitimate uncertainty or different criteria.

Do not force awards to agree with the game's omniscient retrospective value model.

## 13. Awards influence reputation, not hidden skill

Winning can affect:

- public prestige;
- fan interest;
- contract demand/expectations;
- Hall-of-Fame narrative;
- club marketing;
- pressure/public expectations.

Any market effect depends on how decision-makers interpret the award; it is not a universal salary multiplier.

## 14. Hall of Fame is a separate selection institution

Do not implement `career WAR/points > threshold -> automatically inducted` as the full model unless a league explicitly uses such a rule.

Hall-of-Fame candidacy can consider:

- eligibility/waiting period;
- career longevity;
- peak value;
- awards;
- records/milestones;
- positional/role context;
- era context;
- postseason/international legacy where culturally relevant;
- historical reputation;
- selection committee/voter philosophy.

## 15. Hall-of-Fame selectors also have imperfect historical judgment

Voters know the recorded past but may disagree about:

- era quality;
- defensive value;
- peak vs longevity;
- relief/starter value;
- league strength;
- shortened seasons;
- advanced metrics unavailable during the player's career.

This allows borderline candidates and changing standards.

## 16. Hall-of-Fame voting standards can evolve

Across a century, the institution can change:

- waiting periods;
- ballot duration;
- threshold;
- electorate;
- veteran/committee routes;
- eligibility scope;
- treatment of overseas/multi-league careers.

Any change is rule/history, not silent retcon.

## 17. Late induction is possible

A player not elected on the first ballot can be inducted later through the applicable system.

Historical re-evaluation can emerge from:

- changed voter composition;
- new analytical understanding;
- committee review;
- changing league context.

Do not make first-year rejection permanent unless the rule says so.

## 18. Global Baseball World needs league-specific recognition systems

Different leagues can have different:

- awards;
- Hall-of-Fame institutions;
- club honors;
- historical prestige.

A career spanning NPB/MLB/KBO/CPBL/Mexico/future leagues keeps all achievements in one player history while respecting each institution separately.

## 19. Cross-league prestige is contextual

An award from one league should not carry a fixed universal value forever.

Its prestige can depend on:

- league quality;
- historical reputation;
- era;
- international visibility;
- award institution.

A rising future league can gain greater historical prestige over time.

## 20. Club honors are distinct from league Hall of Fame

A club can honor a player who is not a league-wide Hall-of-Famer.

Possible club-level recognition includes:

- club Hall of Fame / honor roll if the club uses one;
- commemorative ceremony;
- captain/legend recognition;
- statue/named area if future presentation supports it;
- retired number.

These are separate decisions with separate traditions.

## 21. Retired numbers should be rare, club-specific decisions

Do not use a global automatic stat threshold.

A club's decision can consider:

- sustained contribution to the club;
- peak performance;
- championships/major moments;
- career duration with club;
- fan/cultural significance;
- relationship with club;
- historical precedent/tradition;
- ownership/front-office philosophy;
- number availability/history.

Different clubs can rationally have different retirement standards.

## 22. Retired-number traditions can evolve

A club may historically avoid formal number retirement, later adopt it, or use another honor system.

Do not permanently stereotype a 2026 club tradition if ownership/governance/history changes.

## 23. Number history should persist

The game should be able to show:

- notable players who wore a number;
- periods of non-use;
- formal retirement;
- reissue/unretirement if a future club decision/rule permits it.

This gives uniform numbers historical meaning in 100-year saves.

## 24. Legacy is multidimensional, not one hidden score

Avoid one universal `legacy = 92` controlling everything.

Useful dimensions include:

- career performance;
- peak dominance;
- longevity;
- records;
- awards;
- championships/memorable moments;
- club identity;
- international impact;
- cultural/fan significance;
- role innovation/history;
- post-playing contribution.

Different institutions weight them differently.

## 25. Records must preserve raw and contextual history

Keep raw records intact:

- career totals;
- single-season records;
- club records;
- league records;
- postseason/international records where appropriate.

Historical tools can additionally show:

- league-average/era context;
- season length;
- league strength;
- rule environment;
- park/context-adjusted views where supported.

Do not overwrite raw history with era-adjusted values.

## 26. Absolute skill and historical greatness are not identical

Because global baseball quality can improve over decades, later players may be absolutely more skilled while earlier players remain historically extraordinary relative to their era.

Legacy/Hall-of-Fame systems should therefore avoid treating absolute-skill progression as a reason to erase earlier stars.

## 27. New records become harder/easier for causal reasons

Record environments can change through:

- season length;
- league offense level;
- pitching usage;
- rules;
- medical longevity;
- schedule;
- competition quality.

Do not secretly preserve 2026 record frequencies through hidden normalization.

## 28. Historical news should connect awards to careers

News/history can surface stories such as:

- first MVP after a late-career breakout;
- repeated defensive awards after a position change;
- player denied an award multiple times before finally winning;
- first Hall-of-Fame player from a new baseball region;
- retired number after a dynasty career;
- controversial close vote.

These stories emerge from records and institutions, not scripted nostalgia events.

## 29. Children/second-generation players inherit history, not achievements

A former star's child can carry public expectations and family history, but does not inherit awards, Hall-of-Fame status or ability.

This reinforces the non-reincarnation design.

## 30. Post-playing careers can extend legacy

A player who becomes a coach/manager/GM/federation figure can add separate post-playing achievements to his historical profile.

Do not retroactively add staff success to playing ability; display distinct career phases.

## 31. Integrity/sanction effects require explicit policy, not ad hoc erasure

If future governance/integrity design allows eligibility restrictions, sanctions, suspensions or controversies to affect honors, the relevant institution must define how.

Do not silently delete records or awards because of a generic scandal flag.

## 32. User control is limited and contextual

The user should not manually choose league MVP/Hall-of-Fame winners in normal club mode.

Possible user decisions can include:

- club-specific honor/ceremony where the user's authority plausibly applies;
- club retired-number policy;
- governance vote if league award rules are being changed;
- Commissioner mode override as a separate explicit tool.

## 33. UI should make long saves browsable

Useful history views can include:

- season award page;
- award leaderboard/history;
- player trophy cabinet;
- Hall-of-Fame class pages;
- retired-number history;
- club legends;
- record progression over time;
- `where are they now` career summaries;
- draft-class retrospective linked to awards/records.

Do not require users to open dozens of disconnected menus to reconstruct a career.

## 34. Historical search must survive 100 years

Indexes/queries should support questions such as:

- who won MVP in 2047?;
- most MVPs by a shortstop;
- players with awards in both NPB and MLB;
- Hall-of-Famers drafted outside round 1;
- players whose numbers were retired by two clubs;
- first award winner from a newly developed baseball country.

This is a data/history requirement, not merely presentation flavor.

## 35. Award distributions need long-run QA

Future QA should check that:

- one position/role is not structurally locked out without rule justification;
- one statistic does not dominate every award accidentally;
- defensive awards respond to actual defensive contribution rather than errors alone;
- voter philosophy can create variation without becoming random;
- Hall-of-Fame class sizes remain plausible under evolving criteria;
- 100-year global skill growth does not cause Gold/award/HOF inflation by itself;
- shortened seasons/rule changes are historically preserved;
- retired numbers remain rare enough to retain meaning.

## 36. Guardrails

- No award-to-base-ability buff.
- No universal hidden `legacy score` as the only decision variable.
- No omniscient award voters using latent truth.
- No one-stat automatic MVP/Hall-of-Fame rule as the default.
- No defensive award based only on fielding percentage/errors.
- No retcon of historical winners when rules change.
- No global automatic retired-number threshold.
- No erasing early-era greatness because future absolute skill rises.
- No fantasy reincarnation through legacy systems.
- No implementation from this document yet.

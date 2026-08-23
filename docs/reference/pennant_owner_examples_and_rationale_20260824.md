# Pennant owner examples / rationale seeds — 2026-08-24

Status: **REFERENCE SEEDS — NOT ALL ITEMS ARE VERIFIED FACTUAL CLAIMS**

Purpose: preserve the concrete examples, counterexamples, user perceptions, hypotheticals, and design rationale used in the 2026-08-23〜24 owner wall-talk. The canonical feature ledgers intentionally generalize mechanisms; this file prevents the original examples from disappearing during generalization.

## Critical interpretation rule

- `OWNER_EXAMPLE`: example supplied by the owner to explain desired gameplay. It is not automatically a verified factual claim.
- `OWNER_PERCEPTION`: fan/owner perception used to explain why a reputation or AI system is wanted. Never hard-code it as a permanent real-club truth without separate evidence.
- `HYPOTHETICAL`: deliberately fictional scenario used to test the design.
- `HISTORICAL_RESEARCH_SEED`: real-world case named by the owner as something Codex should verify and mine for generalizable mechanics.
- `ASSISTANT_CAUTION`: factual/casual interpretation caveat raised during wall-talk; preserve it so later implementation does not overclaim causality.

---

## 1. First-team experience vs farm development

### OWNER_EXAMPLE
The owner rejected the earlier idea that a player who is clearly below first-team quality should receive a development penalty merely because the level is too hard.

Desired interpretation:
- struggling against stronger first-team competition can itself be valuable experience;
- the natural cost of forcing underdeveloped youngsters into the first team should primarily be current team performance, entertainment value, attendance/revenue, and opportunity cost;
- first-team bench inactivity can still be inferior to regular farm playing time because actual exposure differs.

This is the rationale behind `PW-025`/`PW-026`, not a generic RPG "recommended level" system.

---

## 2. Position conversion / Sakakura-type catcher burden example

### OWNER_EXAMPLE
The owner cited the problem in console PowerPro/Prospi where a strong-hitting 1B/3B/OF can be converted to 2B/SS/C and retain the same offensive output, creating an unrealistic way to place elite offense at positions that are normally offensively scarce.

### OWNER_EXAMPLE
Sakakura was cited as a recent intuitive example for the possibility that catching workload can affect batting output. The design purpose is **not** to hard-code a Sakakura causal penalty, but to ensure catcher workload, defensive learning, physical/cognitive load, fatigue, and training allocation can influence effective batting performance.

### ASSISTANT_CAUTION
A year-to-year batting decline and a change in catching workload do not by themselves prove causality. The game should model general mechanisms and calibrate them from broader evidence rather than encoding one player's season as proof.

---

## 3. Pitching-form exploit

### OWNER_EXAMPLE
In PowerPro/console Prospi, changing a 160 km/h overhand pitcher to an underhand/submarine cosmetic form can leave a 160 km/h submarine pitcher. The owner wants mechanical form changes to affect actual delivery mechanics, velocity, movement, command, deception, workload/injury profile, and adaptation rather than being visual only.

Do not solve this by a universal "submarine max velocity = X" cap; individual exceptions should remain possible.

---

## 4. Spring camp / special coaches

### OWNER_EXAMPLE
Spring training should matter as a period for real technical change. The owner specifically mentioned inviting special/temporary coaches in camp.

Design use:
- conversion work;
- pitching/hitting mechanics changes;
- pitch acquisition/refinement;
- specialist advice;
- role changes;
- focused development.

The desired effect is not a flat +stat bonus but better diagnosis, fit detection, implementation quality, and earlier recognition of failed changes.

---

## 5. Carp Academy / Hawks multi-team system / Stewart Jr.-type acquisition

### OWNER_EXAMPLE
The Hiroshima Carp's Dominican academy was cited as a club-specific long-term talent-development / acquisition route.

### OWNER_EXAMPLE
The SoftBank Hawks' third/fourth-team system was cited as an example of a club investing in a much larger development environment and more playing opportunities.

### OWNER_EXAMPLE
Carter Stewart Jr. was cited as the archetype of an NPB club acquiring a highly regarded young US amateur/prospect through a route outside the normal veteran-foreign-player pattern.

### ASSISTANT_CAUTION
During wall-talk the example was corrected: Stewart Jr. was not the No. 1 overall MLB draft pick; he was a first-round, eighth-overall selection. Preserve the mechanism (elite young overseas prospect acquisition), not the inaccurate "No. 1 overall" wording.

### DESIGN RATIONALE
Existing real-world initiatives should be 2026 starting organizational assets, not eternal team-exclusive buffs. Other clubs may imitate them; the original club may expand, change, or shrink them.

---

## 6. Open-ended organizational innovation examples

### OWNER_EXAMPLE
The owner explicitly wants many more innovative moves than a fixed facility list, including:
- AI utilization and AI development;
- new winter-league destinations;
- new relationships/pipelines with MLB AA organizations or ecosystems;
- overseas universities / US college pipelines;
- new scouting/development bases outside the Dominican Republic;
- new international talent networks;
- new player-development environments that do not exist at game start.

The important requirement is open-ended innovation, not merely implementing the named examples.

---

## 7. Veteran non-playing value / mood maker

### OWNER_EXAMPLE
A declining veteran may still be acquired or kept because the club expects:
- mentoring of young players;
- preparation and professional-habit transfer;
- information sharing;
- catcher knowledge transfer to pitchers/catchers;
- leadership / mood-making value on the first-team bench.

This must consume real roster/payroll opportunity cost. It must not be a free global team buff.

---

## 8. Kai-type information transfer and reverse familiarity

### OWNER_EXAMPLE
Kai Takuya was cited as an example of the idea that acquiring an experienced catcher from another league can bring information about old opponents and league tendencies.

The owner also suggested the reverse possibility: old opponents may know the catcher's tendencies very well, so information can move in both directions.

### ASSISTANT_CAUTION
During wall-talk, the stronger causal claim that opponents hit well specifically because they knew Kai's tendencies was **not treated as verified**. The game should preserve the two-way familiarity mechanism without encoding that causal story as established fact.

This example is the rationale for `PW-112`–`PW-115`.

---

## 9. Transfer breakout / FA bust

### OWNER_EXAMPLE
The owner wants both:
- players who blossom after moving to a new club;
- players who move via major FA with huge expectations and then fail badly.

Neither should be a random "transfer awakening" or "FA curse" roll. Potential causes discussed include:
- playing time;
- role;
- coaching;
- mechanical change;
- ballpark;
- defensive position/workload;
- tactical fit;
- adaptation;
- relationships;
- pressure/expectations;
- opponent familiarity.

---

## 10. Club reputation examples — perceptions, not permanent truths

### OWNER_PERCEPTION
The owner cited real-world fan perceptions as examples of the kinds of reputations a club can acquire:
- Rakuten being viewed as harsh toward long-serving / meritorious players;
- Yakult being viewed as a club where players are frequently injured;
- the Tatsunami-era Dragons being perceived as having a heavy/tense atmosphere;
- Lotte and Chunichi being perceived as clubs where many power-hitting prospects fail to develop.

These are **examples of reputational narratives**, not instructions to hard-code these clubs with fixed negative modifiers. The system must separate true organization quality from public/player reputation, allow reputation to be wrong or lagged, and allow it to change over time.

---

## 11. CPU ownership motivation example

### OWNER_PERCEPTION
The owner cited Hiroshima and Chunichi as examples of the frustration a player feels when a real-life ownership group is perceived as not seriously trying to improve the club.

Game-design conclusion:
- do **not** reproduce "unmotivated ownership" as a CPU objective;
- every CPU club should seriously pursue long-run winning;
- ownership can differ in short/long-term horizon, risk, spending, patience, and innovation, but not in whether winning matters;
- mistakes and long dark ages remain possible.

This is a player-experience design rationale, not a factual judgment the simulation should assert about those real organizations.

---

## 12. Opponent research / "unfamiliar pitcher" example

### OWNER_PERCEPTION
The owner cited the common perception that Hiroshima can struggle against pitchers it is seeing for the first time.

Game-design conclusion:
- do not hard-code "Hiroshima: unfamiliar pitcher penalty";
- represent pre-game scouting, video/data quality, in-game learning, and adjustment ability;
- a team can temporarily become poor/good against unfamiliar players because of staff/analysis quality and history, and that can change.

### OWNER_EXAMPLE
The owner also wants a user decision such as "this batter always hits us; prioritize research/countermeasures against him," creating a finite analysis-resource trade-off.

---

## 13. Second-year jinx / times-through-order

### OWNER_EXAMPLE
The owner wants sophomore slumps and mid-season declines to emerge because opponents collect data and adjust, not because the calendar says "year two".

The same research concept should operate:
- within a game (first/second/third trip through the order);
- within a season;
- across seasons.

Players and coaches must be able to counter-adjust, creating a research → countermeasure → re-adaptation loop.

---

## 14. Player individuality / career values

### OWNER_EXAMPLE
Player individuality must extend far beyond FA bid evaluation. Examples explicitly mentioned:
- a childhood/favorite club and a willingness to choose it in FA;
- strong MLB ambition;
- broader overseas orientation, including choosing KBO/CPBL/Mexico/independent/etc. after NPB release rather than retiring;
- prioritizing playing time over money;
- poor attitude / unprofessional behavior;
- different attitudes toward money, championship chances, role, geography, family, stability, and career continuation.

The owner specifically corrected "overseas orientation" so it must **not** mean only MLB ambition.

---

## 15. Player association / rule-change examples

### OWNER_EXAMPLE
The owner wants a real player-association layer and broad rule evolution, including examples such as:
- shortening FA service time;
- limiting pickoff/disengagement attempts;
- changing base size;
- ABS / automated strike-zone systems;
- DH adoption;
- intentional-walk rules;
- extra-inning tie-break formats;
- returning from a 12-inning cap to unlimited extra innings or other structures;
- changing the baseball / coefficient of restitution;
- adopting an MLB-style ball.

The list is illustrative rather than exhaustive; the Rule Proposal Engine must accommodate future ideas not known in 2026.

---

## 16. Draft-system evolution examples

### OWNER_EXAMPLE
The owner explicitly wants draft rules themselves to be changeable, not just the players inside the draft.

Named inspirations:
- former NPB preferred-entry / free-signing-slot style systems;
- reverse-standings selection orders;
- current/modern MLB lottery-type structures;
- NPB-style simultaneous first-round bidding/lottery;
- future hybrid systems.

The world may reintroduce a historically inspired concept in a different future form.

---

## 17. Posting and salary-cut edge cases

### OWNER_EXAMPLE
Club approval of a posting request must **not** guarantee an overseas transfer. The player can be posted, fail to reach an acceptable contract, and remain in NPB.

### OWNER_EXAMPLE
The existing NPB mechanism where a sufficiently large proposed pay cut can allow a player who refuses it to become a free agent/free-contract player must exist as a separate exit route from normal FA.

Current numerical thresholds and procedural details are **initial-rule data to verify before implementation**, not hard-coded from this wall-talk file.

---

## 18. Rule loopholes / institutional controversies

### HISTORICAL_RESEARCH_SEED
The owner named the following as examples of controversies or mechanisms worth mining:
- Egawa Suguru / the "blank day" controversy;
- draft / recruiting money controversies, including the owner-mentioned Oba Shota example, which must be fact-checked before use;
- fan-labelled "Arihara-style FA" and "Uwasawa-style FA" type discussions around overseas-return / reserve-rights / compensation-system incentives.

Design purpose:
- distinguish a legal/structural rule exploit or disputed institutional route from a crime/scandal;
- repeated exploitation can trigger league/player-association debate and reform.

Do not encode fan labels as legal judgments.

---

## 19. Scandal / integrity research seeds

### HISTORICAL_RESEARCH_SEED
The owner named examples including:
- Black Mist scandal;
- Giants baseball-gambling cases;
- Anraku-related harassment/power-harassment reporting;
- SoftBank Furuya theft case;
- recruiting/payment scandals;
- broader cases where lax governance may allow small problems to escalate.

These are research seeds for a generalized Governance & Integrity system. Before they are used as historical facts or calibration examples, Codex must verify the exact event, person, date, sanction, and source.

### OWNER_PERCEPTION
The owner also referred to current Hiroshima management/ownership as an example of concern that overly lax discipline could allow problems to grow. Preserve this only as a design rationale for governance strength; do not convert it into a factual club accusation or permanent real-club attribute without evidence.

---

## 20. Global career / real overseas player hypotheticals

### HYPOTHETICAL
A declining Mike Trout eventually expresses interest in NPB, multiple Japanese clubs bid, and SoftBank wins the negotiation. The point is not Trout specifically; it tests whether an existing real overseas star can follow a plausible late-career path into NPB based on age, ability, contract market, role, preferences, and competing bids.

### HYPOTHETICAL
A real AA prospect existing in the 2026 world can reach MLB around 2031 and later make a US WBC roster. The point is continuous overseas player history: the player should not disappear merely because he was outside NPB at game start.

### DESIGN RATIONALE
Foreign-player candidate lists should be searches of the living Global Baseball World. They should not be disconnected cards generated only when an NPB club opens the foreign-player screen.

---

## 21. Cuba / country-specific institutional examples

### OWNER_EXAMPLE
Cuban players were cited to require country-specific institutional logic such as:
- players not always freely choosing destination clubs;
- government/federation involvement;
- players leaving the domestic system / moving abroad;
- policy changes that may allow freer movement;
- possible NPB/MLB negotiations with Cuban institutions.

The world must support liberalization, tightening, failed agreements, and changing national-team relationships rather than a one-way "unlock free agency" tech tree.

---

## 22. Meaningful All-Star / WBC / international events

### OWNER_EXAMPLE
PowerPro/Prospi international tournaments and All-Star events were criticized as being too cosmetic.

Desired meaning includes:
- historical prestige;
- popularity and commercial value;
- scouting exposure;
- overseas career interest;
- knowledge exchange and relationships;
- national baseball popularity/growth;
- persistent tournament history.

### OWNER_CONSTRAINT
International-tournament fatigue/injury effects must be user-toggleable because a player having his NPB season ruined merely because he was selected for WBC can feel punishing rather than fun.

The physical-load toggle must not remove all non-physical meaning from tournaments.

---

## 23. Global baseball growth

### OWNER_EXAMPLE
The owner wants baseball to spread much further around the world, including Africa, creating:
- more players;
- more leagues;
- higher global baseball quality;
- stronger and more varied international tournaments.

NPB clubs may contribute through academies, scouting, coaching, or other investment. A club that opens a new market gets an early advantage but does not own the region forever.

The owner also wants league creation and global competitive balance to change over decades rather than remain frozen at 2026 geography.

---

## 24. Legend reincarnation decision

### OWNER_DECISION
Standard world: historical players do **not** reincarnate as normal draft/foreign players.

Allowed alternatives:
- naturally similar new players;
- media labels such as "second coming of ...";
- children/descendants as distinct people;
- retired legends becoming staff;
- optional fantasy reincarnation mode only as a separate future option.

Reason: the core world is a continuous history, so the same person reappearing as a teenager would damage historical continuity.

---

## 25. Easy-dynasty problem

### OWNER_EXAMPLE
PowerPro/Prospi can become too easy after several seasons, and once the user's club becomes a dynasty it can remain dominant indefinitely.

Desired solution is **not** rubber-banding. Natural counter-pressure includes:
- rising salaries;
- FA / overseas movement;
- playing-time dissatisfaction in deep rosters;
- aging golden generations;
- staff poaching;
- opponent study;
- imitation of successful methods;
- changing market prices;
- rules/international-market changes;
- smarter CPU rebuilding.

A genuine dynasty must remain possible; maintaining it should be harder than creating the first one.

---

## 26. MLB ball / club-count / league-structure examples

### OWNER_EXAMPLE
The owner explicitly named:
- possible MLB-ball adoption;
- changing the number of NPB clubs;
- many other structural possibilities.

These are examples for a generic league-governance system, not one-time scripted future events.

---

# Preservation rule

When future Codex research discovers a real event similar to one of these examples:
1. keep the original owner example/rationale;
2. separately record verified real-world facts and sources;
3. generalize the game mechanism;
4. never silently rewrite an owner perception into a verified fact;
5. never discard a negative/cautionary note merely because the generalized feature survives.

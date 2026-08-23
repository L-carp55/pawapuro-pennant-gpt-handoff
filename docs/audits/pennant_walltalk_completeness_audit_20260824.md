# Pennant wall-talk completeness audit — 2026-08-24

Status: **BASELINE COMPLETE FOR CURRENT CONVERSATION / FURTHER EXTERNAL DISCOVERY PENDING**

Purpose: verify that the major ideas discussed in the owner wall-talk have been preserved in the GitHub master design and granular requirement ledger before broad Codex news/history mining begins.

Canonical files:

- `docs/design/PENNANT_WORLD_SIMULATION_MASTER_20260824.md`
- `docs/state/pennant_feature_requirements_20260824.tsv`
- `docs/state/pennant_design_program_state_20260824.json`
- `docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`

The ledger currently contains **235 granular requirements**.

This audit does not claim that the product design is finished. It claims that the discussion to this point has been converted into explicit retained requirements or explicit OPEN design domains rather than being left only in chat prose.

---

## 1. Core product / UX coverage

Captured:

- deep internal simulation with PowerPro-like simple surface (`PW-001`, `PW-002`);
- natural-system outcomes rather than arbitrary scripted events (`PW-003`);
- no CPU hidden-truth advantage (`PW-006`);
- all CPU organizations seriously pursue winning (`PW-007`–`PW-009`);
- user-controlled club remains final authority over GM/manager (`PW-011`, `PW-012`);
- optional delegation, interruption, spectator mode retained (`PW-010`, `PW-013`, `PW-014`).

Owner-specific concern covered:

> CPU clubs that seem to have no intention of becoming competitive would be frustrating even if realistic.

This is preserved as a top-level AI objective, not a low-priority flavor feature.

---

## 2. Growth / aging / player life coverage

Captured:

- no deterministic early/normal/late-growth career template as the main engine (`PW-015`);
- ability-specific aging (`PW-016`);
- persistent player-specific development differences (`PW-017`);
- future as a distribution, not a fixed cap (`PW-019`);
- performance vs true ability separation (`PW-022`, `PW-023`);
- late bloomers, busts, injury-changed careers, comeback paths (`PW-024`).

PD-001A age-data implementation specification remains in the repository but is explicitly HOLD / not dispatched while feature discovery continues.

---

## 3. One-team vs two-team development / minors coverage

Captured owner correction:

> Higher-level first-team experience should not be artificially made worse for development merely because the player is struggling. The natural cost should be current team performance / entertainment / finances.

Mapped to:
- `PW-025`, `PW-026`.

Also retained:
- bench vs regular playing-time distinction (`PW-027`–`PW-029`);
- minor-league performance as observation rather than direct XP conversion (`PW-030`);
- minor-league historical records (`PW-031`);
- focused development and finite coaching attention (`PW-032`–`PW-035`).

---

## 4. Position conversion exploit coverage

Owner identified the PowerPro/console-Prospi exploit where a strong-hitting corner player can be converted to 2B/SS/C while retaining full offense, creating an unrealistic positional advantage.

Preserved as:

- explicit exploit prevention `PW-036`;
- defensive learning/workload/cognitive/training effects `PW-037`;
- batting-expression cost through workload/fatigue rather than arbitrary batting-rating deletion `PW-038`;
- catcher burden `PW-040`;
- career-extending moves down the defensive spectrum `PW-039`.

The owner example involving a catcher/first-base workload change is retained as a design inspiration, but the system is generalized rather than hard-coding one player's causal story.

---

## 5. Pitching / hitting mechanics coverage

Owner concern:

> A 160 km/h pitcher should not remain a 160 km/h submarine pitcher simply because the user changed a cosmetic pitching form.

Preserved in:
- `PW-042`–`PW-045`.

Hitting-form changes also retained:
- `PW-046`, `PW-047`.

Spring-camp meaningful technical work:
- `PW-048`–`PW-052`, including guest/specialist coaches and pitch learning.

---

## 6. Draft / prospect / scouting coverage

Preserved:

- draft as long-term talent supply (`PW-053`);
- high school / university / industrial / independent differences (`PW-054`);
- hidden truth vs scout ranges (`PW-055`–`PW-061`);
- CPU independent draft boards (`PW-056`, `PW-057`);
- media rankings (`PW-062`);
- BPA vs needs / competitive-window behavior (`PW-063`–`PW-065`);
- natural strong/weak classes (`PW-066`, `PW-067`);
- realistic ability correlations (`PW-068`);
- archetype as descriptive label rather than generation template (`PW-069`);
- amateur performance (`PW-070`);
- development draft / one-tool prospects (`PW-071`);
- undrafted players continuing to university / industrial / independent and returning later (`PW-072`, `PW-073`);
- draft-time evaluations retained forever (`PW-074`, `PW-075`).

---

## 7. GM / manager / staff coverage

Owner correction:

> GM and manager can be separate personalities for CPU clubs, but the user-controlled club must not be forced into conflict with its own staff.

Preserved:
- `PW-076`, `PW-077`.

Further staff framework:
- `PW-078`–`PW-087`.

Includes:
- GM strategy/evaluation differences;
- manager philosophy vs ability;
- coaching as directional/efficiency influence rather than magic stat boost;
- scouting specialties;
- retired player → staff path;
- staff-driven club culture;
- expected-performance-based manager firing.

---

## 8. Prevent easy permanent dominance coverage

Owner concern:

> PowerPro/Prospi can become easy after several years and once a dynasty forms it can remain dominant indefinitely.

Preserved:
- competitive window (`PW-088`, `PW-089`);
- anti-snowball mechanisms (`PW-090`);
- dynasties themselves remain possible (`PW-091`);
- CPU learns/mimics successful strategies (`PW-092`, `PW-093`);
- market price reacts to successful player types (`PW-094`);
- long-run competitive-balance QA (`PW-225`–`PW-229`).

No hidden rubber-band correction is allowed (`PW-229`).

---

## 9. Veteran / clubhouse / information value coverage

Owner ideas retained:

- acquire diminished veteran partly for young-player development (`PW-095`–`PW-097`);
- keep a mood/leadership veteran on the first-team bench (`PW-098`, `PW-099`);
- acquire a catcher/player for information from an old league/team (`PW-112`–`PW-115`).

Important distinction retained:

- information moves both ways;
- old opponents can know the transferred player's tendencies too;
- information decays over time.

---

## 10. Player personality / values / agency coverage

Owner explicitly requested much broader player individuality than FA bidding alone.

Preserved:

- broad personality/value model (`PW-100`);
- childhood/favorite team (`PW-101`);
- overseas/career mobility broader than MLB ambition (`PW-102`);
- playing-time-driven FA (`PW-103`);
- money/championship/family/location/role/development etc. (`PW-104`);
- relationship history and changing values (`PW-105`, `PW-106`);
- imperfect observation of personality (`PW-107`).

---

## 11. Club reputation coverage

Owner examples generalized:

- reputation for treatment of franchise veterans;
- health/medical reputation;
- clubhouse atmosphere;
- reputation for failing/succeeding to develop certain player types.

Preserved:
- `PW-108`–`PW-111`.

Critical rule:

- actual organizational quality != external reputation.

This allows reputation to be wrong, lagging, or slow to recover.

---

## 12. Opponent study / sophomore slump coverage

Owner requested:

- second-year jinx as opponent research rather than magic penalty;
- first/second/third time through effects;
- teams that struggle against unfamiliar pitchers;
- player-specific focused preparation.

Preserved:
- `PW-116`–`PW-123`.

Includes adaptation loop:

`opponent identifies weakness → changes attack → player adjusts → opponent re-learns`.

---

## 13. Transfer breakout / FA disappointment coverage

Owner requested meaningful transfer-context effects.

Preserved:
- contextual breakout (`PW-124`);
- big-FA disappointment (`PW-125`);
- true skill vs effective performance (`PW-126`);
- overseas comeback route (`PW-127`, `PW-128`).

No direct “transfer awakening roll” is required.

---

## 14. Contract / FA / posting coverage

Preserved:

- non-money FA preferences (`PW-129`);
- role promises (`PW-130`);
- agents (`PW-131`, `PW-132`);
- posting permission can still fail to produce an overseas contract (`PW-133`, `PW-134`);
- posting reputation (`PW-135`);
- salary-cut-limit route to free agency (`PW-136`, `PW-137`);
- long contracts and dynamic market price (`PW-138`–`PW-140`).

---

## 15. Finance / attendance coverage

Preserved:

- meaningful club finances without turning into shop-price micromanagement (`PW-141`, `PW-142`);
- attendance determined by more than winning (`PW-143`);
- successful clubs also become more expensive to maintain (`PW-144`).

This domain remains OPEN for deeper formula design.

---

## 16. Club innovation coverage

Owner requested many more innovative actions beyond fixed facilities.

Preserved:

- innovation as a general system (`PW-145`, `PW-146`);
- overseas academies (`PW-147`, `PW-148`);
- 3rd/4th teams (`PW-149`, `PW-150`);
- MLB AA / overseas university / JUCO / independent pipelines (`PW-151`);
- new winter-league destinations (`PW-152`);
- AI use/development (`PW-153`, `PW-154`);
- relationship/network capital (`PW-155`);
- organizational knowledge (`PW-156`);
- staff poaching and knowledge diffusion (`PW-157`);
- proposal/experiment system (`PW-158`);
- small-budget first-mover innovation (`PW-159`).

This captures the owner's desire for a much more active, deep, replayable world where novel organizational moves keep appearing.

---

## 17. Global real-player world coverage

Owner explicitly requested actual overseas players wherever feasible rather than fictional foreign-player cards appearing from nowhere.

Preserved:

- global living world (`PW-160`);
- maximum feasible real overseas player implementation (`PW-161`, `PW-162`);
- AA prospect → MLB/WBC future path (`PW-163`);
- declining MLB superstar → NPB bidding war path (`PW-164`);
- tiered simulation depth (`PW-165`);
- real-to-generated transition (`PW-166`);
- changing foreign league quality (`PW-167`).

---

## 18. Country / region-specific institutions coverage

Owner requested Cuba-type systems and many more country-specific mechanics.

Preserved:

- different national/league institutions (`PW-168`);
- Cuba overseas movement and federation/government involvement (`PW-169`);
- possible negotiation among Cuban institutions / NPB / MLB (`PW-170`);
- high-level foreign relocation/federation-exit career event (`PW-171`);
- regulation can tighten as well as liberalize (`PW-172`);
- foreign institutional change feeds back into NPB player markets (`PW-173`).

---

## 19. Global baseball growth coverage

Owner requested active worldwide baseball expansion rather than permanently fixed baseball geography.

Preserved:

- global growth (`PW-174`);
- country ecosystem state (`PW-175`);
- Africa/new regions becoming real talent sources (`PW-176`);
- NPB clubs contributing to development (`PW-177`);
- market competition after development (`PW-178`);
- new professional leagues (`PW-179`);
- stagnation/contraction also possible (`PW-180`).

---

## 20. WBC / international / all-star coverage

Owner concern:

> International tournaments and all-star games are too often cosmetic events in PowerPro/Prospi.

Preserved:

- meaningful WBC/Premier12/Olympics/youth tournaments (`PW-181`, `PW-182`);
- fatigue/injury OFF/LIGHT/REALISTIC toggle (`PW-183`, `PW-184`);
- meaningful all-star selection/recognition (`PW-185`);
- international success changes national baseball growth (`PW-186`);
- tournament history / international rivalries (`PW-187`).

---

## 21. Player association / rules / equipment coverage

Owner requested dynamic:

- FA service years;
- pickoff limits;
- base size;
- ABS;
- DH;
- intentional walk;
- tie-break/unlimited extra innings;
- ball coefficient;
- MLB ball adoption;
- many future rule changes.

Preserved:
- player association (`PW-188`, `PW-189`);
- on-field rule change (`PW-190`);
- ball/equipment (`PW-191`, `PW-192`);
- generic Rule Proposal Engine (`PW-193`, `PW-194`).

---

## 22. Draft system itself can evolve

Owner asked whether old preferred/free-signing systems or MLB-style order/lottery could be freely changed.

Preserved:

- draft system as Rule Engine (`PW-195`);
- preferred/free slots, reverse order, lottery, NPB-style systems (`PW-196`);
- draft pick trading/compensation/penalties (`PW-197`);
- transition/effective-date rules (`PW-198`);
- rule exploit and reform (`PW-199`, `PW-200`).

---

## 23. Club count / league structure coverage

Owner explicitly mentioned changing number of clubs.

Preserved:

- 12 teams are initial condition, not eternal constant (`PW-201`);
- Expansion Draft (`PW-202`);
- league/division/CS/Japan Series/interleague/game count changes (`PW-203`);
- relocation/sale/merger as rare future possibilities (`PW-204`).

---

## 24. Scandal / governance / institutional controversy coverage

Owner suggested scandals, discipline failures, gambling, theft, harassment, historical rule controversies, illegal recruiting/payment, and similar events as rare spice.

Preserved:
- governance/compliance (`PW-205`, `PW-206`);
- broad scandal categories (`PW-207`);
- low-frequency/high-impact calibration (`PW-208`);
- sanctions (`PW-209`);
- no fabricated future serious crimes for real current people by default (`PW-210`);
- generated players can participate in future fictional scandal systems (`PW-211`);
- organizational response/reputation (`PW-212`).

Rule exploitation is kept separate from criminal/integrity scandals (`PW-199`, `PW-200`).

---

## 25. Historical records / legends coverage

Preserved:

- complete player life history (`PW-213`);
- club history (`PW-214`);
- robust records (`PW-215`);
- news-driven storytelling (`PW-216`).

Owner decision on reincarnation:

> Do not use historical legends as normal reincarnated draft/foreign players in the standard world.

Preserved:
- reincarnation default OFF (`PW-217`);
- natural “second coming” comparisons (`PW-218`);
- children of former players (`PW-219`, `PW-220`);
- optional fantasy reincarnation mode only as future backlog (`PW-221`).

---

## 26. Injury / fatigue coverage status

Retained but intentionally NOT falsely marked complete:

- ability vs fatigue/injury separation (`PW-222`);
- injury/recurrence/permanent loss/rehab (`PW-223`);
- pitcher workload and veteran rest (`PW-224`).

This is an explicit OPEN design domain.

---

## 27. Long-run QA / exploit resistance coverage

Preserved:

- 20/50/100 year QA (`PW-225`);
- competitive-balance QA (`PW-226`);
- Super-GM stress test (`PW-227`);
- exploit-search agent (`PW-228`);
- no hidden rubber band (`PW-229`).

---

## 28. External idea-mining request coverage

Owner requested exhaustive use of real NPB/MLB/global baseball news to discover still-missing mechanics.

Preserved:
- `PW-230`–`PW-233`;
- execution specification in `CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`.

The task requires separate workstreams for:

- NPB rules/labor/transactions;
- NPB player development/organization;
- MLB/MiLB rules/CBA/draft;
- MLB player development/technology;
- KBO/CPBL;
- Cuba/Latin America/Mexico/Caribbean;
- WBSC/Europe/Africa/Oceania;
- international tournaments;
- business/stadium/expansion/media;
- career/contracts/agents;
- integrity/scandals/rule exploits;
- independent QA.

---

# 29. Known OPEN domains are not omissions

These were deliberately placed in `pennant_design_program_state_20260824.json` as OPEN, because they have not yet had enough wall-talk:

- injury/fatigue/condition detailed model;
- stadium/new stadium/renovation;
- fan/media/sponsor/popularity detailed model;
- finance formulas;
- agent market details;
- minimal contract clauses;
- national-team eligibility;
- global simulation performance budget;
- scandal frequency calibration;
- family generation policy;
- coaching/mentorship calibration;
- staff labor market;
- player-association bargaining mechanics;
- expansion/relocation governance;
- future technology generation;
- real overseas player data/licensing feasibility.

They are explicitly retained so they cannot disappear simply because they are unfinished.

---

# 30. Current verdict

For the wall-talk content available through 2026-08-24:

- **235 granular requirements are persisted.**
- Owner-specific corrections and examples have corresponding generalized requirements.
- Design-proposed ideas that have not been explicitly accepted are marked `PROPOSED` / `OWNER_REVIEW` rather than silently treated as owner decisions.
- Unfinished major domains are listed as OPEN rather than dropped.
- The next discovery wave is external real-baseball news/history mining, not implementation.

Therefore current state:

**WALL-TALK BASELINE: PRESERVED**

**EXTERNAL IDEA DISCOVERY: READY**

**FEATURE IMPLEMENTATION: NOT YET AUTHORIZED**

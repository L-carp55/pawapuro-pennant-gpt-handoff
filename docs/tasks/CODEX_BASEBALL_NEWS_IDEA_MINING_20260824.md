# Codex task — Global Baseball News / History Idea Mining for Pennant Design

Status: **READY FOR DISPATCH AFTER DESIGN BASELINE VERIFICATION**
Date: 2026-08-24
Scope: **DESIGN DISCOVERY ONLY — DO NOT IMPLEMENT GAME FEATURES**
Repo: `L-carp55/pawapuro-pennant-gpt-handoff`
Design baseline branch: `design/pennant-world-master-20260824`
Recommended execution branch: `codex/pennant-news-idea-mining-20260824`

---

## 0. Objective

Owner wants to make the long-term Pennant simulation substantially deeper than PowerPro/Prospi by learning from real baseball history and current baseball worldwide.

Your task is to perform a **broad, evidence-backed idea-mining sweep across major professional baseball news, rule changes, organizational innovations, labor/contract events, player-development changes, global baseball expansion, scandals/governance, technology, equipment, international tournaments, unique career paths, and league/business restructuring**.

This is NOT a current-news summary for the user.

The product question is:

> **What real baseball events/mechanisms, past or present, reveal game systems or edge cases that are missing from the current Pennant master design?**

The current design already contains hundreds of ideas. Do not rediscover them and call them new. Compare every candidate against the canonical ledger.

---

## 1. Read first — source of truth

Read in full:

1. `docs/design/PENNANT_WORLD_SIMULATION_MASTER_20260824.md`
2. `docs/state/pennant_feature_requirements_20260824.tsv`
3. `docs/state/pennant_design_program_state_20260824.json`
4. `docs/audits/pennant_walltalk_completeness_audit_20260824.md`
5. `docs/design/integration_design_v0.md`
6. `CLAUDE.md`

Important:

- `pennant_feature_requirements_20260824.tsv` is the canonical feature-idea ledger for this discovery wave.
- Do NOT silently edit existing `PW-*` requirements to fit newly found news.
- New findings go to a separate candidate ledger first.
- No implementation task begins in this wave.
- PD-001A age dataset remains undispatched while design discovery is active.
- Do not touch SP-078 owner verdict, SP-079, shoulder, or speed canonical ledgers.

---

## 2. Research philosophy

### 2.1 Breadth first

Owner explicitly requested a very broad sweep — “major NPB, MLB, and other overseas baseball news, as much as possible.”

Do not stop after finding 20 or 50 examples.

Build a coverage matrix and continue until all required regions × topic families have been searched to the bounded stopping rule below.

### 2.2 Evidence first

Prefer:

1. official league/team/player-association/federation documents;
2. public rulebooks, CBA/agreements, official releases;
3. high-quality wire/news reporting;
4. specialist baseball analysis for mechanism interpretation;
5. reputable historical sources for older events.

For current facts, verify with primary/official sources where feasible.

Do not use a single unsourced forum post as factual evidence.

Community discussions can be used only to discover candidate topics, which must then be independently verified.

### 2.3 Idea mining, not blind feature inflation

Every event must answer:

- What actually happened?
- What baseball mechanism does it reveal?
- Is that mechanism already represented by one or more `PW-*` requirements?
- If not, is it genuinely material to long-term Pennant gameplay?
- Can it be generalized rather than hard-coded as a one-off historical script?
- What complexity does it add?
- Could it create player frustration?
- Should it be default, toggleable, rare-event, or out of scope?

---

## 3. Time coverage

Use a layered historical strategy rather than pretending one search can exhaust 100+ years.

### Wave A — modern comprehensive sweep

Target: **2010-01-01 through 2026-08-24**.

Search systematically by topic family and region.

### Wave B — structural history

Target: **1990-2009**.

Focus on major structural changes, unusual transactions, expansion/contraction, labor disputes, international-market shifts, major scandals, development innovations, rule changes, league restructures.

### Wave C — landmark historical precedents

Pre-1990.

Do NOT attempt every game/news article.
Search for landmark precedents relevant to game systems:

- draft制度 changes;
- free agency / reserve-system changes;
- famous rule loopholes and controversies;
- league mergers/splits/expansion;
- gambling/match-fixing/integrity crises;
- equipment/ball changes;
- labor relations;
- international player movement;
- farm/minor/development system innovations.

Every coverage claim must state its bounds. Do not call the full history exhaustive if only bounded search was performed.

---

## 4. Mandatory region / competition coverage

At minimum create separate discovery workstreams for:

### Japan
- NPB central league / pacific league
- all 12 organizations
- NPB Players Association / labor
- independent leagues
- amateur / high school / university / industrial baseball when relevant to pro pipeline
- winter/development leagues involving Japanese organizations

### United States / Canada
- MLB
- MiLB (AAA/AA/A/Rookie, rule experiments, player development)
- MLBPA / CBA
- NCAA / major college baseball developments
- independent leagues
- private player-development ecosystem where material

### East Asia
- KBO / Korea
- CPBL / Taiwan
- other relevant leagues/development systems

### Caribbean / Latin America
- Cuba and Cuban Baseball Federation/state policy
- Dominican Republic
- Venezuela
- Puerto Rico
- Mexico / LMB / winter leagues
- Caribbean Series / development pipelines

### Europe / Africa / Oceania
- WBSC development
- European leagues / Baseball Champions League where relevant
- African federation/development initiatives
- Australian Baseball League and Oceania
- new/expanding national leagues and academies

### International
- WBC
- Premier12
- Olympic baseball
- U-18/U-23 and qualifiers where they reveal development/globalization mechanisms
- international club competitions where relevant

---

## 5. Mandatory topic families

Each topic family below must have its own search queries and coverage receipt.

### A. Rules / on-field environment

Look for:
- pitch clock
- disengagement/pickoff limits
- base size / base placement
- ABS / challenge systems
- check-swing technology
- replay
- defensive shift rules
- DH
- intentional walks
- mound visits
- roster rules
- extra innings / ties / tie-break
- schedule/game-count changes
- ball specifications / coefficient / seam / aerodynamics
- bat/equipment changes
- mound/field changes
- experimental MiLB/minor/independent rules
- unintended consequences and later revisions

### B. Draft / amateur acquisition

Look for:
- NPB historical draft formats
- preferred/free signing slots
- lottery / reverse order / snake
- MLB lottery changes
- international draft proposals
- trading draft picks
- compensation picks
- bonus pools / slotting
- draft eligibility changes
- college NIL / transfer effects on pro pipeline
- independent / nontraditional amateur pathways
- draft refusal / re-entry
- rule exploits / controversy

### C. Contracts / FA / player movement

Look for:
- FA service-time changes
- posting
- failed posting
- free-agency compensation
- contract reduction/free agency mechanisms
- waivers / DFA / Rule 5 / option systems
- overseas-return pathways
- unusual clauses
- agents and representation
- player choice for playing time vs money
- late-career overseas moves
- NPB→MLB→NPB / NPB release→overseas→return
- international signing restrictions

### D. Organization / roster building / competitive balance

Look for:
- rebuilds
- dynasties ending
- ownership philosophy
- revenue sharing
- luxury tax / salary-cap debates
- expansion draft
- franchise expansion
- relocation
- mergers / league restructuring
- competitive-balance policies
- anti-tanking rules
- successful/failed front-office transformations

### E. Player development

Look for:
- 3rd/4th teams
- expanded farm systems
- academy systems
- Dominican/Latin academies
- new countries/regions
- winter league assignments
- overseas training
- position conversions
- pitching/hitting mechanics changes
- pitch design
- swing design
- biomechanics
- training-lab partnerships
- rehab innovations
- special camp coaches
- development coordinators
- player-development plans
- nontraditional development routes

### F. Scouting / analytics / AI / technology

Look for:
- tracking systems
- Hawkeye / TrackMan / Statcast / bat tracking
- biomechanics labs
- AI scouting
- AI video analysis
- injury prediction
- automated opponent preparation
- scouting databases
- R&D department changes
- virtual/VR training
- data-sharing partnerships
- university/private-lab relationships
- technology adoption failures, not only successes

### G. Staff / culture / organizational knowledge

Look for:
- coach/GM poaching
- coaching-tree effects
- veteran mentorship
- catcher knowledge transfer
- specialists
- organizational culture changes
- player-development reputation
- medical reputation
- free-agent attraction/avoidance because of organization reputation
- former players becoming staff

### H. Opponent research / adaptation

Look for:
- times-through-order learning
- rookie novelty / sophomore adjustment
- opponent-specific game plans
- pitch tipping
- catcher/game-calling familiarity
- former-team knowledge
- hitters/pitchers adjusting after league learns weaknesses
- scouting departments that excel/fail against unfamiliar opponents

### I. Player identity / psychology / agency

Look for:
- favorite/home clubs
- overseas ambitions
- playing-time motives
- role dissatisfaction
- family/location preferences
- leadership / clubhouse influence
- professionalism / discipline
- mentorship
- comeback motivations
- retirement decisions
- international-team motivations

Do not turn anecdotes into universal causal claims without evidence.

### J. Injury / fatigue / health

Look for:
- workload management
- pitcher usage / rest
- international tournament fatigue debates
- rehabilitation
- surgery/recovery innovations
- medical/staff changes
- chronic injury management
- position workload effects
- health-related contract/roster mechanisms

### K. Business / fans / media / stadiums

Look for:
- stadium construction/renovation
- attendance changes
- local-market changes
- broadcasting/streaming rights
- sponsorship
- merchandise/star effects
- public funding / ownership changes
- team financial crises
- fan backlash shaping decisions
- popularity impacts of stars, rookies, scandals, international success

### L. Governance / labor / player associations

Look for:
- NPBPA proposals
- MLBPA/CBA disputes
- lockouts / strikes
- grievance/arbitration systems
- service-time manipulation disputes
- league/union negotiation over rules
- player safety
- minimum salary
- roster sizes
- scheduling
- rule-making committees

### M. Integrity / scandals / enforcement

Look for system-level lessons from:
- gambling
- match fixing
- harassment/bullying
- theft/criminal conduct
- prohibited substances
- illegal payments
- draft/recruiting misconduct
- tampering
- sign stealing
- institutional coverups
- weak governance vs strong intervention

Safety / ethics rule:
- Do not create new allegations about real people.
- Use only verified public events.
- The game-design output must generalize mechanisms; it must not assign future fictional crimes to real current players.

### N. Global baseball development

Look for:
- new national leagues
- academy initiatives
- WBSC programs
- African/European/Oceania growth
- youth participation
- international tournaments changing domestic interest
- country-level baseball booms/declines
- foreign investment/pipelines
- domestic stars changing popularity

### O. Country-specific institutional systems

At minimum:
- Cuba government/federation and player movement
- Korea military-service / overseas-movement interactions
- Taiwan return/draft/player-movement systems where material
- Mexico league ownership/contract structures where material
- US college/pro eligibility and signing pathways
- other region-specific mechanisms discovered during research

### P. International tournaments / all-star events

Look for:
- WBC/Premier12/Olympics roster rules
- national-team eligibility
- player withdrawals
- fatigue/health debates
- scouting exposure
- player popularity
- knowledge exchange
- tournament effects on domestic baseball growth
- all-star selection/fan voting/commercial effects

### Q. Rare structural events

Look for:
- franchise bankruptcy/sale
- mergers
- expansion/contraction
- emergency schedule changes
- disasters/pandemics only insofar as they reveal reusable league mechanisms
- geopolitical restrictions affecting players/teams
- visa issues
- sanctions
- cross-border agreements

---

## 6. Mandatory parallel agent structure

Use independent sub-agents with separate files to avoid write conflicts.

Minimum recommended workers:

1. `NPB_RULES_LABOR_TRANSACTIONS`
2. `NPB_ORG_PLAYER_DEVELOPMENT`
3. `MLB_MILB_RULES_CBA_DRAFT`
4. `MLB_PLAYER_DEVELOPMENT_TECH`
5. `EAST_ASIA_KBO_CPBL`
6. `LATAM_CUBA_MEXICO_CARIBBEAN`
7. `EUROPE_AFRICA_OCEANIA_WBSC`
8. `INTERNATIONAL_TOURNAMENTS_GLOBALIZATION`
9. `BUSINESS_STADIUM_EXPANSION_MEDIA`
10. `PLAYER_CAREER_CONTRACT_AGENT_CASES`
11. `INTEGRITY_SCANDAL_RULE_EXPLOIT`
12. `INDEPENDENT_COVERAGE_QA_RED_TEAM`

Each worker writes its own intermediate TSV/JSON/Markdown receipt.
Parent alone creates canonical merged candidate outputs.

---

## 7. Search methodology

For each worker:

1. Build a source universe / domain list.
2. Search by year buckets and topic keywords.
3. Search broad category pages where available, not only targeted known events.
4. Follow links to primary documentation.
5. Deduplicate syndicated versions of the same event.
6. Preserve negative findings and inaccessible sources.
7. Record query terms / time boundaries / domains searched.

Use multiple synonyms in Japanese, English, Korean/Chinese/Spanish where feasible via translation/search tools.

Do not claim full coverage of a language/league when search tooling is limited.

---

## 8. Source-use policy

- Official NPB/MLB/WBSC/etc. public pages may be used as **research evidence and citations**.
- Do NOT mass-republish protected official datasets into the game database merely because a page is readable.
- This task is article/event discovery and design extraction, not player-stat acquisition.
- Store URLs, metadata, short summaries, hashes/receipts where useful; do not store full copyrighted articles.

---

## 9. Canonical event index schema

Create:

`outputs/research/pennant_baseball_news_event_index_20260824.tsv.gz`

Minimum fields:

```text
event_id
event_date_start
event_date_end
retrieved_at
region
country
league
organization
competition
topic_family
subtopic
headline_or_event_name
fact_summary
primary_source_url
secondary_source_urls
source_authority
verification_status
historical_or_current
mechanism_revealed
potential_game_system
existing_requirement_ids
novelty_status
materiality
recurrence_class
player_frustration_risk
suggested_default_or_toggle
implementation_complexity
research_confidence
notes
```

`fact_summary` must be paraphrased and concise.

`novelty_status`:

- `ALREADY_COVERED`
- `PARTIAL_EXTENSION`
- `NEW_CANDIDATE`
- `CONTRADICTS_OR_REFINES_CURRENT_DESIGN`
- `LOW_VALUE_OR_TOO_SPECIFIC`
- `INSUFFICIENT_EVIDENCE`

---

## 10. New candidate requirement ledger

Create:

`outputs/derived/pennant_news_new_feature_candidates_20260824.tsv`

Only include `PARTIAL_EXTENSION`, `NEW_CANDIDATE`, or material `CONTRADICTS_OR_REFINES_CURRENT_DESIGN` rows.

Fields:

```text
candidate_id
source_event_ids
proposed_module
proposed_requirement
why_not_already_covered
real_world_mechanism
generalized_game_mechanic
expected_gameplay_value
long_term_world_value
complexity
frustration_risk
toggle_recommendation
dependencies
conflicts_with_pw_ids
recommended_owner_question
priority_preliminary
```

Do not assign new canonical `PW-*` IDs. Owner/ChatGPT integration does that after review.

---

## 11. Existing design challenge report

Create:

`outputs/derived/pennant_news_design_challenges_20260824.json`

Find real-world evidence that suggests an existing assumption may be oversimplified.

Examples:
- a supposedly beneficial development environment has mixed outcomes;
- a rule change had an unexpected second-order effect;
- a player-mobility mechanism behaves differently by country;
- reputation effects are weaker/stronger than assumed;
- new baseball technology failed organizationally;
- expansion altered talent distribution in unexpected ways.

Do not silently modify the master design. Report challenge + evidence + affected `PW-*` IDs.

---

## 12. Idea clusters expected to be especially valuable

Do not limit research to these; they are examples of high expected information gain:

- unusual player-acquisition routes;
- farm-system innovations;
- cross-sport / nontraditional prospects;
- player-development laboratories;
- scouting model changes;
- AI adoption and failure;
- international development projects;
- obscure winter leagues / exchange programs;
- unusual veteran roles / mentor contracts;
- catcher/pitcher knowledge transfer;
- rule experiments that never reached MLB/NPB;
- league expansion/contraction proposals;
- player association demands that did not pass;
- draft formats that were proposed/tested/abolished;
- posting/FA edge cases;
- unique country restrictions;
- roster rules designed to stop competitive exploits;
- scandals leading to permanent rules;
- ball/equipment controversies;
- stadium/environment changes influencing team construction;
- successful and failed rebuild/dynasty transitions;
- front-office personnel poaching;
- international-tournament effects on player markets;
- national baseball development after international success;
- new professional leagues or failed league launches.

---

## 13. Coverage reports

Create:

`outputs/derived/pennant_news_research_coverage_20260824.json`

Report at minimum:

- event count total;
- unique source URLs;
- official/primary source count;
- counts by region;
- counts by league;
- counts by topic family;
- counts by decade/year band;
- number ALREADY_COVERED;
- number PARTIAL_EXTENSION;
- number NEW_CANDIDATE;
- number design challenges;
- inaccessible source families;
- language/search limitations;
- worker-level query counts;
- known blind spots.

A high raw event count is not itself success. Coverage diversity and novelty detection matter.

---

## 14. Bounded stopping rule

This research could expand forever, so use a measured stopping criterion.

A region × topic family cell may close when all are true:

1. at least two materially different query formulations were run;
2. official/primary source family was checked when available;
3. at least one reputable secondary source family was checked when useful;
4. a second discovery pass yields no new material mechanism, OR the cell is documented as inaccessible/low-evidence;
5. all material candidate events were mapped to existing requirements or new candidate rows.

High-value cells may require more passes.

Do not stop the entire project merely because one search engine gives repetitive results.

---

## 15. Independent QA

Independent QA must not only check file existence.

It must:

- sample raw event rows and verify sources actually support summaries;
- verify claimed novelty against the full `PW-*` ledger;
- identify false-new candidates that are duplicates;
- identify existing requirements with weak/no real-world analog coverage;
- check that major regions/topic families are not silently missing;
- challenge source authority;
- ensure current facts are not based only on stale secondary sources;
- check historical anecdotes are not presented as proven causal mechanisms;
- check real-person allegations are not invented or amplified beyond sources;
- check copyright-safe paraphrasing;
- verify deterministic merge/dedupe transforms;
- ensure no game code / speed owner artifacts were modified.

Create:

- `outputs/derived/qa_pennant_news_idea_mining_20260824.json`
- `docs/audits/pennant_news_idea_mining_independent_audit_20260824.md`

---

## 16. Final synthesis

Create:

`docs/research/pennant_baseball_news_idea_mining_20260824.md`

Structure:

1. Executive summary
2. Coverage
3. Highest-value NEW candidates
4. Partial extensions to existing systems
5. Evidence that challenges current design assumptions
6. Region-specific mechanisms
7. Rules / labor / draft
8. Player development / technology
9. Globalization / international
10. Contracts / unique career movement
11. Organizational culture / reputation / knowledge
12. Integrity / governance / rule exploits
13. Business / stadium / expansion
14. Ideas rejected as too narrow/low-value
15. Remaining blind spots
16. Owner decision questions

Do not merge candidates into canonical master requirements yet.

---

## 17. No endless collection of low-value duplicate articles

The goal is not “number of articles.”

If 200 syndicated articles describe the same rule change, retain one primary/authoritative event row and only secondary sources needed for interpretation.

Prioritize **distinct mechanisms**.

---

## 18. Examples already covered — do not mislabel as new

The current master already includes, among many others:

- player aging / late bloomers;
- player personality and career preferences;
- mentor / leadership / information value;
- catcher/old-team familiarity;
- opponent research and second-year adjustment;
- position workload effects;
- pitching/hitting mechanical changes;
- spring-camp guest coaches;
- 3rd/4th teams;
- overseas academies;
- new winter-league/pipeline development;
- AI/R&D;
- MLB/MiLB real-player universe;
- Cuba institutional restrictions;
- global baseball development/new leagues;
- WBC/all-star significance;
- player-association/rule changes;
- draft format flexibility;
- posting failure;
- salary reduction/free agency;
- rule loopholes;
- scandals/governance;
- league expansion;
- MLB-ball/equipment changes;
- no reincarnated legends by default;
- CPU all trying seriously to win;
- anti-permanent-dynasty mechanisms.

Read all 235 ledger rows before claiming novelty.

---

## 19. End state

Terminal states:

- `DONE_VALIDATED_READY_FOR_OWNER_SYNTHESIS`
- `DONE_WITH_BOUNDED_BLIND_SPOTS_READY_FOR_OWNER_SYNTHESIS`
- `PARTIAL_BLOCKED`

Stop after research + QA + commit/push.

Do NOT:
- implement features;
- start PD-001A;
- alter speed owner verdicts;
- start SP-079;
- start shoulder;
- create canonical new `PW-*` rows without owner/ChatGPT synthesis.

Commit and push normally, verify local HEAD equals remote branch HEAD, and report:

- exact branch and SHA;
- event count;
- unique source count;
- coverage matrix summary;
- new candidate count;
- top novel mechanisms;
- challenged existing assumptions;
- QA result;
- blind spots;
- terminal state.

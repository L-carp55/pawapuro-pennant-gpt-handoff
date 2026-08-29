# Codex task — Player Ability / Appraisal Ontology Research Wave 1

Date: 2026-08-29
Status: **RESEARCH SPEC ONLY / OWNER DESIGN NOT YET DECIDED / IMPLEMENTATION NOT AUTHORIZED**

## Purpose

Before continuing the Pennant special-ability lifecycle design, build a source-grounded, cross-game inventory of **all player appraisal attributes, sub-attributes, special abilities/traits, tendencies and closely related player descriptors** used by the current console baseball games most relevant to this project, then identify overlaps, missing dimensions, and candidate improvements.

Primary comparison targets:

1. **Powerful Pro Baseball 2026-2027** — current console version, with Pennant/current real-player data as the primary relevance target.
2. **Professional Baseball Spirits 2026** — **PS5 / Steam console game only**. Do not use Professional Baseball Spirits A / mobile as evidence for console appraisal structure except when explicitly documenting contamination or historical naming overlap.
3. **MLB The Show 26** — **Franchise + Live Roster/current player-rating structure** as primary relevance. Diamond Dynasty, Road to the Show and other modes must be separated rather than silently mixed into Franchise evidence.

Secondary comparison targets may include older console versions of the same franchises when necessary to identify removed, renamed, merged or historically useful appraisal concepts.

The result is **not** a final Pawapuro ability list. It is the research substrate for owner/browser-GPT wall-talk that will later decide the unified Player Ability & Appraisal Ontology.

## Starting canonical state

- Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
- Canonical design branch: `design/pennant-world-master-20260824`
- Starting canonical SHA at task creation: `3298b18cbe1efa08a371812b868c6fea062766bf`
- Recommended research branch: `codex/player-ability-appraisal-ontology-wave1-20260829`

Create/use a dedicated research branch. Do **not** merge into canonical design automatically.

## Why this task comes now

The owner has decided that it is better to determine the complete appraisal-item / special-ability universe before finalizing special-ability acquisition/loss rules.

The project therefore needs to answer, in order:

1. What player dimensions do the three games currently represent?
2. Which are visible headline ratings, detailed ratings, special abilities, tendencies, contextual ratings, physical/current-state fields, potential/future fields, or derived summaries?
3. Which concepts are semantically the same under different names?
4. Which existing concepts should be split into multiple causal parameters?
5. Which concepts duplicate effects already represented elsewhere?
6. Which important baseball dimensions are missing from all three games and should be candidates for the Pennant World internal model?
7. Which dimensions should be shown on the simple PowerPro-like card, which should appear only in details, and which should remain internal?
8. Only after this ontology is reviewed by the owner should lifecycle/calibration/formula work continue.

## Non-negotiable guards

- **Research only. No implementation.**
- Do not edit the canonical PW requirement ledgers.
- Do not declare any candidate ontology item OWNER-ACCEPTED or canonical.
- Do not modify appraisal values for real players.
- Do not touch SP-078 owner verdict, SP-079, shoulder appraisal, speed canonical work, or PD-001A.
- Do not treat the assistant-draft wall-talk documents dated 2026-08-26 as owner-approved design decisions unless a later explicit owner-review document says so.
- Preserve the already-established principle that current Pennant design distinguishes truth, observation/evaluation and displayed rating; do not assume a game-visible number must become latent truth.
- Do not import arcade/fantasy/DD/Success effects into the normal Pennant ontology without explicit mode labeling and owner review.
- Do not use one game's terminology as the default truth. Compare semantics.
- Do not infer a mechanic's effect from its name alone when an effect description or in-game evidence can be found.
- No unsupported claims that a rating is causal, cosmetic, derived, or sim-engine-active. Label uncertainty.

## Current-version anchoring

Use current sources as of **2026-08-29 JST**.

Current public anchors already known and to be revalidated by the research:

- PowerPro 2026-2027 is the current console PowerPro title; its Pennant mode includes individual special-ability instruction and a separate new **team special ability** system. Team special abilities must be cataloged separately and must not contaminate the individual-player ontology.
- Professional Baseball Spirits 2026 is the current PS5/Steam console title, released 2026-07-16; player data and boosted/awakening versions exist, but boosted data must not be confused with the normal base appraisal schema.
- MLB The Show 26 changed/expanded its attribute structure; Franchise and Live Roster are primary, and mode-specific DD/RTTS behavior must be separated.

Revalidate these statements and exact schema details from public sources during execution.

## Definition of “appraisal item” for this research

Collect every player-level field that can materially describe baseball ability, performance tendency, role, position, repertoire, contextual response, physical/medical availability, future projection or special behavior in the relevant modes.

At minimum include, where present:

### A. Headline/base ratings

Examples of categories to search, without assuming final inclusion:

- contact / meet;
- power;
- speed;
- arm;
- fielding;
- catching/error handling;
- velocity;
- control/command;
- stamina;
- recovery/durability.

### B. Split/detail ratings

Examples:

- vs R / vs L contact;
- vs R / vs L power;
- directional reaction/jump;
- arm strength vs arm accuracy;
- catcher blocking / pop time / framing where present;
- pitch-level break/control/velocity;
- role aptitude;
- position aptitude;
- stealing vs general baserunning;
- vision / discipline / clutch-like fields.

### C. Pitch repertoire

For every relevant game, capture:

- pitch identity/classification;
- pitch-level grades/attributes;
- repertoire-level summary fields;
- velocity/break/control relationships;
- any special pitch quality fields;
- original/special pitches where applicable.

### D. Special abilities / traits / quirks

Collect the complete current list where accessible, including positive, negative, rank-based, gold/ultra/super traits, neutral/green/tendency-like labels, and pitcher/hitter/fielding/baserunning/catcher traits.

Do not assume all such labels are true independent abilities.

### E. Tendencies / behavioral descriptors

Collect fields that represent **what the player tends to choose**, not how good he is, such as aggressiveness, pull/opposite-field behavior, steal tendency, pitch usage or analogous concepts where present.

### F. Contextual / situational ratings

Examples:

- clutch/chance;
- vs handedness;
- pinch hitting;
- runners on base / scoring position;
- high leverage / pressure;
- day/night/home/road or other Quirk-type contexts.

Record exact trigger semantics if available.

### G. Future/projection fields

Examples:

- potential;
- awakening/boosted versions;
- growth tendency;
- future grade.

Separate:

- present ability;
- displayed future projection;
- alternate boosted/awakening player version;
- progression mechanics.

Do not merge these into one concept.

### H. Role / position / two-way structure

Include:

- primary/secondary positions;
- position aptitude grades;
- starter/reliever/closer aptitude;
- two-way eligibility/role;
- catcher-specific roles if encoded.

### I. Current-state fields

If a game exposes condition, fatigue, injury, morale/confidence or short-term form, catalog them **separately from permanent appraisal**.

### J. Derived summaries

Examples:

- overall rating;
- stars;
- aggregate offense/defense/running grades;
- badges derived from underlying attributes.

Mark these as derived when supported; do not treat them as additional causal inputs unless evidence shows otherwise.

## Mode-contamination rules

This is one of the most important gates.

### PowerPro

Separate at minimum:

- current real-player data / normal player schema;
- Pennant-useable individual special abilities;
- Success/MyLife-specific abilities or acquisition systems;
- team special abilities introduced in 2026-2027;
- fantasy/legend/DLC-only mechanics;
- cosmetic/form fields.

A special ability can exist in multiple modes; record that fact instead of duplicating it as separate concepts.

### Professional Baseball Spirits

Primary target is **Professional Baseball Spirits 2026 on PS5/Steam**.

Explicitly exclude or segregate:

- Professional Baseball Spirits A mobile ratings/abilities;
- eBaseball PRO SPIRIT if schema differs;
- boosted/awakening alternate data versus standard current-player data;
- created-player-only editing fields;
- older console data used only for historical comparison.

If current Prospi 2026 public documentation is incomplete, use public in-game screenshots/videos/databases cautiously and label provenance and confidence. Prefer multiple independent confirmations for complete lists.

### MLB The Show 26

Primary target:

- Franchise player ratings;
- Live Roster schema;
- per-pitch ratings/repertoire relevant to Franchise;
- Franchise-visible Quirks/Tendencies;
- Potential/Overall as displayed in Franchise.

Separate:

- Diamond Dynasty card-only attributes, boosts and card programs;
- DD-only Quirks or altered Quirk behavior;
- Road to the Show progression categories/perks;
- player-locked/QTE-only effects;
- gameplay-only user-interface aids that are not normal Franchise simulation attributes.

If the same field exists in DD and Franchise, retain one semantic concept with mode-specific behavior notes.

## Research question set 1 — complete raw inventory

For each item found, determine as much as public evidence supports:

- exact original name;
- English/Japanese translation if useful;
- game family;
- exact title/version/update state;
- mode(s);
- player type: hitter/pitcher/catcher/fielder/baserunner/two-way/all;
- display category/page;
- numeric/rank/binary/tier scale;
- normal range;
- positive/negative/neutral classification if applicable;
- documented or observed effect;
- activation/context condition;
- whether it appears on real players;
- whether generated/created players can possess it;
- whether it can change in long-term Franchise/Pennant if known;
- whether it affects manual gameplay, simulation, both, or unknown;
- whether it is likely a summary/derived label, independent parameter, tendency or current state **only when supported**;
- primary source URL(s);
- source type and confidence;
- unresolved ambiguity.

Do not leave current-item rows without a source pointer unless public verification is genuinely blocked; mark those `BLOCKED_UNVERIFIED`.

## Research question set 2 — semantic crosswalk

Build a cross-game concept map.

Examples of questions, not predetermined answers:

- Is PowerPro `走力` semantically equivalent to The Show `Speed`, or does one package more than the other?
- How do PowerPro `盗塁` / `走塁` relate to The Show `Stealing` / `Baserunning Aggressiveness`?
- How do PowerPro `肩力` / `送球` relate to The Show `Arm Strength` / `Arm Accuracy` and Prospi equivalents?
- Does Prospi split right/left contact where PowerPro exposes a single Meet rating plus handedness traits?
- Is The Show `Clutch` closer to PowerPro `チャンス`, or does it encode a narrower/different trigger?
- Are PowerPro special abilities such as `内野安打○` an independent skill, a derived badge over speed/acceleration/swing/handedness/route, or mixed?
- Which fielding concepts are hidden inside one game's aggregate fielding number but explicitly split in another?
- Which pitch qualities are individual pitch attributes in one game but represented by a special ability in another?

For every crosswalk group record:

- semantic concept;
- source items;
- exact overlap;
- important differences;
- whether merge is safe;
- whether split is advisable;
- unresolved questions.

Use `SAME`, `PARTIAL_OVERLAP`, `RELATED_NOT_EQUIVALENT`, `UNIQUE`, `UNCLEAR` rather than forcing matches.

## Research question set 3 — effect ownership / double-count audit

For every important concept ask:

> If Pennant World includes this visible rating or special ability, what baseball outcome channel does it represent, and is that same channel already represented somewhere else?

Flag likely overlaps such as:

- raw speed vs baserunning technique vs stealing technique;
- arm strength vs throwing accuracy/technique;
- fielding aggregate vs reaction/route/hands;
- injury/durability badge vs full medical model;
- clutch/chance badge vs persistent pressure response + situational approach + annual results;
- contact vs vision/strikeout avoidance;
- control vs command vs per-pitch control;
- pitch break summary vs per-pitch break;
- catcher arm vs pop time/transfer;
- mood/leadership trait vs clubhouse social system.

Do not decide the final owner design. Produce overlap evidence and candidate decompositions.

## Research question set 4 — real-baseball gap audit

After cataloging the three games, deliberately search for important baseball-performance dimensions that are either:

- absent from all three;
- hidden inside over-broad aggregates;
- represented only indirectly;
- represented in one title but not the others;
- represented in a way that appears unsuitable for a deep causal simulation.

Use reputable baseball measurement/scouting sources to identify constructs, not to create formulas yet.

Candidate areas to inspect include, but are not limited to:

### Hitting

- bat-to-ball/contact ability;
- pitch recognition;
- swing decision / chase control;
- bat speed;
- raw power vs game power;
- launch/spray tendencies;
- platoon differences;
- two-strike/foul-ball skill;
- situational approach.

### Running

- top speed;
- acceleration/burst;
- first-step/start response;
- turn/re-acceleration;
- baserunning read/decision;
- route/rounding bases;
- steal lead/read/start/slide;
- willingness/aggressiveness versus execution skill.

### Fielding

- reaction/first step;
- directional range;
- route efficiency;
- positioning knowledge;
- hands/catch conversion;
- transfer speed;
- arm strength;
- arm accuracy;
- throwing on the move;
- double-play technique;
- position-specific cognition.

### Catching

- blocking;
- receiving/framing under human umpire rules;
- pop time decomposition;
- transfer;
- throw strength/accuracy;
- game calling / preparation / pitcher communication;
- changing value under ABS rule variants.

### Pitching

- peak and typical velocity;
- command vs broad control;
- release repeatability;
- extension/release geometry;
- deception;
- per-pitch velocity/break/shape/command;
- repertoire usage/tendency;
- tunneling/sequencing if evidence supports a distinct concept;
- workload tolerance/recovery versus stamina;
- holding runners / slide-step / pickoff skill.

### Psychology / context

- persistent pressure response;
- arousal regulation;
- emotional recovery;
- role/routine comfort;
- confidence/current state;
- annual situational performance and noise.

Do not assume every candidate deserves a visible rating. The goal is to identify the smallest useful causal dimensions.

## Important special question — hierarchy / composite ratings

Explicitly investigate whether a **hierarchical rating model** is preferable for some domains.

Example owner concept:

```text
走力 (simple visible composite)
├─ top speed
├─ acceleration
├─ re-acceleration / turning
└─ possibly other pure movement components

走塁 technique (separate)
├─ batted-ball read
├─ advancement decision
├─ route / base rounding
└─ slide / execution

盗塁 technique (separate)
├─ pitcher read
├─ lead/start
├─ timing
└─ slide
```

Do not force this exact decomposition. Compare what the three games and real measurement frameworks suggest, then provide candidate hierarchies for:

- hitting;
- power;
- running;
- fielding;
- throwing;
- catching;
- pitching control/command;
- pitch quality;
- stamina/recovery/workload;
- contextual/mental performance.

For every proposed composite, state whether the composite should be:

- display-only summary;
- actual engine input;
- both;
- unresolved.

Default research caution: avoid feeding both a composite and all of its components into the engine if that would double-count the same effect.

## Important special question — annual appraisal vs persistent trait

Classify each item using a **candidate temporal semantics**, without finalizing it:

- `PERSISTENT_SKILL` — normally changes gradually;
- `PERSISTENT_TENDENCY`;
- `PHYSICAL_CAPACITY`;
- `ANNUAL_APPRAISAL` — can legitimately vary materially year-to-year because the game is representing that season's player;
- `PERSISTENT_PLUS_ANNUAL` — both a stable player component and annual observed/performance component matter;
- `CURRENT_STATE` — fatigue/form/confidence/injury/etc.;
- `DERIVED_SUMMARY`;
- `FUTURE_PROJECTION`;
- `UNKNOWN`.

This is especially important for concepts such as `チャンス`, `対左`, `対ピンチ`, clutch-like ratings and situational traits.

Do **not** classify `チャンス` as purely persistent or purely annual by assumption. Preserve the owner wall-talk insight that a player can have persistent mental/context response while PowerPro's yearly appraisal can still change substantially based on that season.

## Source hierarchy

Prefer sources in this order:

1. official game manuals/sites/FAQs/update notes;
2. in-game screens/video from current version where clearly identifiable;
3. reliable structured player databases tied to current version;
4. specialist communities/databases with clear evidence;
5. general wikis/guides;
6. forum anecdotes only for unresolved mechanics or mode behavior.

For real-baseball construct gap research, prefer:

- official MLB/Baseball Savant/Statcast definitions where relevant;
- official/league measurement documentation;
- peer-reviewed sports-science/baseball research when needed;
- established scouting/analytics references;
- specialist analysis as secondary support.

Search Japanese and English sources.

## Historical comparison rules

Do not perform an unbounded history scrape.

Use older console versions only when needed to answer:

- Was a current item renamed/removed/merged?
- Did an older title expose a useful dimension that the latest title hides?
- Is a currently ambiguous concept better documented in a previous console release?
- Does a removed concept deserve consideration for Pennant World?

Record exact title/year. Never silently import a 2015/2019 item as if it exists in 2026.

## Parallel execution

Use parallel independent lanes. Recommended **minimum 16 research workers + separate independent QA**.

Suggested lanes:

1. PowerPro 2026-2027 — hitter/base ratings and positions
2. PowerPro 2026-2027 — pitcher/pitch repertoire ratings
3. PowerPro 2026-2027 — full individual blue/red/rank special abilities
4. PowerPro 2026-2027 — gold/ultra/other traits + mode contamination audit
5. Prospi 2026 PS5/Steam — hitter/fielding/running appraisal schema
6. Prospi 2026 PS5/Steam — pitcher/pitch-level appraisal schema
7. Prospi 2026 PS5/Steam — full special-ability/trait schema
8. Prospi historical-console differential + Prospi A contamination guard
9. MLB The Show 26 Franchise/Live Roster — hitter/running attributes
10. MLB The Show 26 Franchise/Live Roster — fielding/catcher attributes
11. MLB The Show 26 Franchise/Live Roster — pitcher/per-pitch attributes
12. MLB The Show 26 — Franchise-visible Quirks/Tendencies + DD/RTTS contamination guard
13. Cross-game semantic normalization/crosswalk
14. Real-baseball gap audit — hitting/running
15. Real-baseball gap audit — fielding/catching
16. Real-baseball gap audit — pitching/psychology/context
17. Effect-ownership/double-count red-team
18. Independent final QA — must not be the same pass that generated the main synthesis

Workers must preserve search receipts, rejected sources, mode/version labels and blockers.

## Required output artifacts

Create a dedicated research directory such as:

`docs/research/player_ability_appraisal_ontology_wave1_20260829/`

At minimum create:

### 1. `source_receipts.tsv`

Fields:

- lane_id
- query_or_navigation
- game/version/mode scope
- source_url
- source_type
- retained_or_rejected
- reason
- access limitation
- notes

### 2. `raw_attribute_catalog.tsv`

One row per raw rating/appraisal field.

Recommended fields:

- raw_item_id
- game_family
- title_version
- update_as_of
- mode
- original_name
- translated_name
- player_scope
- category
- scale_type
- scale_range
- documented_meaning
- documented_effect
- sim_manual_scope
- real_player_present
- generated_player_present
- editable_if_known
- temporal_behavior_if_known
- source_ids/urls
- source_quality
- verification_status
- notes

### 3. `raw_special_trait_catalog.tsv`

One row per special ability / trait / Quirk / tendency.

Include:

- raw_trait_id
- game/title/version/mode
- exact name
- tier/color/rank family
- positive/negative/neutral
- player scope
- trigger/context
- effect description
- effect certainty
- real/generated availability
- mode contamination flags
- source evidence
- notes

### 4. `cross_game_semantic_crosswalk.tsv`

Fields:

- concept_id
- concept_name
- PowerPro items
- Prospi items
- MLB The Show items
- semantic_relation
- shared_meaning
- differences
- merge_safe
- split_candidate
- unresolved_question
- evidence

### 5. `effect_ownership_overlap_audit.tsv`

Fields:

- concept/item
- apparent outcome channel
- overlapping base attributes
- overlapping special traits
- overlapping health/psychology/mechanics systems
- double_count_risk (`LOW/MEDIUM/HIGH`)
- likely decomposition
- evidence
- owner_question

### 6. `candidate_hierarchical_ontology.tsv`

This is **candidate-only**, not canonical.

For each proposed Pennant World concept include:

- candidate_id
- domain
- concept_name
- parent_composite
- child_atomic_components
- source_game_inspiration
- real_baseball_support
- proposed_visibility (`CORE_VISIBLE`, `DETAIL_VISIBLE`, `INTERNAL_ATOMIC`, `SPECIAL_TRAIT`, `DERIVED_BADGE`, `TENDENCY`, `CURRENT_STATE`, `FUTURE_PROJECTION`, `REFERENCE_ONLY`, `UNRESOLVED`)
- engine_role_candidate (`INPUT`, `DISPLAY_ONLY`, `MIXED`, `UNKNOWN`)
- temporal_semantics_candidate
- rationale
- major_overlap_risk
- owner_review_required

Every row must remain `owner_review_required=true` unless it merely restates an already explicit owner decision.

### 7. `missing_dimension_gap_audit.md` + TSV

List candidate additions not cleanly covered by the three games.

For each candidate:

- baseball construct;
- why current game schemas are insufficient;
- available real measurement/scouting evidence;
- likely usefulness to simulation;
- likely usefulness to user-facing appraisal;
- whether it should probably be internal only;
- overlap risk;
- evidence strength;
- owner question.

### 8. `mode_contamination_audit.md`

Explicitly document:

- PowerPro team-special / Success / MyLife contamination;
- Prospi A / eBaseball PRO SPIRIT / boosted-data contamination;
- MLB DD / RTTS / card-only / player-locked contamination;
- any rows excluded or retained only as `REFERENCE_ONLY`.

### 9. `historical_removed_changed_items.md`

Only important historical console differences, bounded by the historical rules above.

### 10. `design_decision_memo.md`

Do **not** make final design decisions. Present owner/browser-GPT decisions required.

At minimum answer:

- Which existing PowerPro items clearly should remain visible for familiarity?
- Which PowerPro items look too aggregated and may need hidden/detail subcomponents?
- Which Prospi/The Show items provide useful decomposition missing from PowerPro?
- Which items are likely tendencies rather than ability?
- Which are likely current-state rather than appraisal?
- Which special abilities appear derivable from causal components and may be better as badges?
- Which unique traits genuinely add a missing outcome channel?
- Which concepts have high double-count risk?
- Which missing constructs are strongest candidates for new Pennant World parameters?
- What are the 20-30 highest-value owner wall-talk questions before ontology freeze?

### 11. `independent_qa.md`

Independent QA must check:

- latest title/version/mode identity;
- Prospi A contamination absent;
- DD/RTTS contamination labeled;
- PowerPro team special abilities separated;
- complete raw list claims are actually supported;
- duplicate/synonym inflation;
- translations preserve semantics;
- effect descriptions match sources;
- current vs historical version not mixed;
- source coverage includes both Japanese and English where applicable;
- all three game families have meaningful current-version coverage;
- crosswalk does not force false equivalence;
- candidate hierarchy is not mislabeled as owner-approved;
- all candidate ontology rows preserve owner-review status;
- no canonical PW IDs were created/edited;
- no appraisal implementation/formula work started.

QA verdict must separately report:

- structural completeness;
- source/provenance quality;
- current-version completeness;
- mode-contamination cleanliness;
- semantic-crosswalk confidence;
- gap-audit confidence.

### 12. `wave1_final_report.md`

Report:

- starting SHA;
- substantive research commit SHA;
- final remote branch SHA;
- raw attribute row count by game;
- special trait row count by game;
- crosswalk concept count;
- unique source count/source-family count;
- candidate new/internal dimensions count;
- high double-count-risk count;
- blocked/unverified items;
- top 20 cross-game findings;
- top 20 owner decisions required;
- independent QA verdict.

## Completeness gate

Do not claim `ALL ITEMS COMPLETE` merely because a guide lists many fields.

For each game, completeness requires deliberate coverage of:

- hitter ratings;
- pitcher ratings;
- fielding ratings;
- catcher ratings;
- baserunning;
- position/role aptitude;
- pitch repertoire/per-pitch ratings;
- special abilities/traits/Quirks;
- tendencies/contextual ratings;
- future/potential/awakening fields;
- current-state fields that can be mistaken for permanent appraisal;
- derived summary/overall fields;
- relevant mode exclusions.

If any category cannot be publicly verified, mark the exact gap `BLOCKED` rather than hiding it.

## Semantic stopping rule

Stop broad searching when:

- the current schema of all three titles is covered category-by-category;
- all high-impact raw items have at least one credible source and important items have corroboration where needed;
- historical search is no longer yielding distinct removed/changed concepts;
- semantic crosswalk reaches saturation;
- real-baseball gap search mostly repeats already captured candidate dimensions;
- remaining uncertainty is listed explicitly.

Do not expand into formula calibration, real-player numeric appraisal, or implementation during this wave.

## Final handoff / Git rules

- Work on the dedicated research branch.
- Commit and normally push all artifacts.
- Keep the canonical design branch untouched except for this task specification already created by browser GPT.
- Do not open/merge a PR unless explicitly requested.
- Final response to the owner/browser GPT must report the remote branch and SHAs; do not require the user to paste the entire report if push succeeded.
- Stop after push.

Browser GPT will then independently audit the research, present the proposed unified ontology to the owner in chat, conduct wall-talk, and only afterward write an owner-reviewed canonical design document.

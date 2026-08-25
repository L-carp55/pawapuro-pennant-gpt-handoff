# Pennant special abilities / red traits / gold traits lifecycle wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This document preserves the wall-talk for OD-04 `special_abilities_traits_lifecycle`. It supplements lifecycle, development, mechanics, injury/medical, information/scouting, relationships, staff/coaching, trade/contract, and long-run world-scale design. It creates no new canonical PW IDs and does not alter current appraisal values.

## 1. Core principle: a special ability is not a magic perk inventory item

The normal simulation should not treat every blue/red/gold ability as an independent boolean that directly adds a hidden bonus on top of base ratings.

Instead, each ability label should correspond to a causal underlying trait, skill, weakness, tendency, context response, or summary state.

Conceptually:

```text
underlying trait state
+ current applicability/context
+ observation/evaluation confidence
        ↓
PowerPro-style visible ability label/tier
```

The label is a compact user-facing representation of a real simulation component; the icon itself is not an additional second effect.

## 2. Special abilities remain important performance components

Avoid the opposite mistake of making all traits cosmetic labels.

Some traits own real outcome channels that are not fully represented by the headline base ratings. The design goal is **one causal owner per effect channel**, not removal of special-ability effects.

Examples of legitimate separate channels can include:

- batting approach / spray-angle skill;
- pitch recognition / decision behavior;
- situational decision response;
- baserunning decision technique;
- throwing/catching/release techniques;
- pitch-shape or usage-related skill not represented by velocity/control alone;
- contextual performance response where evidence supports a persistent individual component;
- communication/leadership effects through social systems rather than direct batting/pitching buffs.

## 3. Every ability requires an Effect Contract

Before implementation, every canonical PowerPro-style special ability should be classified with an explicit contract such as:

- `trait_family`;
- `underlying_state_source`;
- `applicable_context`;
- `owned_outcome_channel`;
- `included_in_base_rating` yes/no/partial;
- `display_only_summary` yes/no;
- `learning_model`;
- `decay_or_loss_model`;
- `observation_model`;
- `tiering_model`;
- `interaction_guards` to prevent duplicate effects.

No special ability should be implemented until its effect ownership is clear enough to avoid double counting.

## 4. Suggested trait families

Not all PowerPro-style abilities should use the same lifecycle mechanics.

Useful high-level families include:

### A. Learned technical skills

Examples in concept:
- specialized batting approaches;
- bunt technique;
- baserunning/stealing technique;
- pickoff/quick-delivery technique;
- pitch-specific or fielding technique.

These can improve through practice, exposure, coaching, mechanics, and experience.

### B. Decision / approach tendencies

Examples in concept:
- swing aggression;
- first-pitch approach;
- pull/opposite-field preference;
- steal/bunt aggressiveness;
- pitch-selection tendencies.

These often alter choices/distributions rather than raw physical capacity.

### C. Context-response skills

Examples in concept:
- platoon response;
- pinch-hitting adaptation;
- pressure/high-leverage response;
- certain role-specific responses.

These require strong protection against small-sample outcome overfitting.

### D. Physical / medical summaries

Examples in concept:
- durability / injury-proneness-like display;
- recovery-related summary.

These should summarize underlying health/risk processes and **must not apply an additional injury multiplier** if those processes already own the risk.

### E. Mental / social traits

Examples in concept:
- leadership;
- mood-maker-like influence;
- communication/mentorship.

Effects must flow through relationship, communication, adaptation, conflict mediation and information systems rather than a universal team ability buff.

### F. Role / repertoire / mechanics-linked traits

Some visible traits are best understood as consequences or summaries of role, repertoire, mechanics, release, pitch shape, defensive technique, etc.

Do not duplicate the mechanics system by adding the same physical effect again as a trait modifier.

## 5. Trait truth is continuous even when the UI is discrete

Many internal traits should use a continuous or multi-dimensional latent state.

The visible PowerPro UI may still show:

- no icon;
- blue ability;
- stronger tier;
- gold ability;
- red weakness.

Crossing a display threshold must not be the instant at which the actual baseball effect suddenly appears.

A player can improve gradually before the icon is awarded, and can decline gradually before the icon is removed.

## 6. Separate true trait, applicability, evidence and display

For each trait conceptually distinguish:

1. **latent trait strength** — actual underlying ability/weakness;
2. **stability/persistence** — how durable the state is;
3. **applicability** — whether current role/context uses it;
4. **observational evidence** — what the club/scouts can infer;
5. **display tier** — current PowerPro-style label shown from the club's information layer;
6. **history** — acquisition, upgrade, downgrade, dormancy, return.

This separation is necessary for both lifecycle realism and information uncertainty.

## 7. Acquisition is gradual development, not an achievement unlock

Do not model acquisition primarily as:

`100 plate appearances -> 20% chance of ability acquired`.

Improvement can instead arise from combinations such as:

- relevant repetitions/exposure;
- focused training;
- compatible coaching;
- mechanical refinement;
- new role/position;
- opponent adaptation and counter-adaptation;
- player-specific learning response;
- physical maturation;
- career experience.

An event may reveal or accelerate development, but should not normally create an unrelated ability from nothing.

## 8. Performance results are evidence, not automatic trait growth

A strong single-season statistic does not automatically create the matching special ability.

Example principle:

- excellent results with runners in scoring position may raise belief that the player handles those situations well;
- those results also contain opponent mix, batted-ball luck, sampling noise, role and team context;
- actual contextual skill changes only when the underlying player state changes.

This is the same truth/evaluation/observed-performance separation already used elsewhere in Pennant World.

## 9. Small-sample contextual traits need especially strong shrinkage

Traits analogous to clutch, platoon response, pinch hitting or other situational outcomes should not swing dramatically from a few opportunities.

Use conceptually:

- player prior;
- accumulated career evidence;
- current mechanics/approach;
- context-specific observations;
- uncertainty/shrinkage toward broader skill;
- possible persistent individual component.

Do not derive permanent red/blue traits directly from one noisy season split.

## 10. Trait display changes need hysteresis

Avoid icon flicker such as:

`blue -> none -> blue -> none` every month around a threshold.

A visible upgrade/downgrade should normally require enough evidence and persistence.

Possible conceptual rules:

- entry threshold differs slightly from exit threshold;
- minimum confidence requirement;
- sustained state requirement for major/gold tier changes;
- explicit emerging/declining staff report before a label changes.

Exact thresholds remain calibration work.

## 11. Disappearance must have a causal reason

Do not perform an annual random `special ability deletion roll`.

A trait can weaken/disappear because of:

- actual technical decline;
- aging-related physical/processing change;
- major mechanics change;
- injury or incomplete recovery;
- long period without using/rehearsing a specialized skill;
- role change that removes relevant exposure;
- competing training/resource allocation;
- previous evaluation being revised after more evidence.

The first six are changes in player state; the last is primarily a change in belief/display.

## 12. Dormant and lost are different

Some traits become temporarily less relevant without being erased.

Examples:

- a pinch-hitting adaptation trait becomes less observable after the player becomes an everyday starter;
- a former starter's starter-specific preparation may be dormant while he works exclusively in relief;
- a rarely used bunt technique may remain in memory but lose sharpness.

Represent `dormant / low-applicability` separately from permanent loss when appropriate.

## 13. Aging can improve some traits while reducing others

Do not make `older -> fewer special abilities` a universal rule.

Possible career patterns:

- physical/quickness-dependent traits decline;
- learned technical/anticipation/decision traits can remain or improve with experience;
- role specialization can create new late-career traits;
- declining physical tools can motivate mechanical/approach adaptation;
- chronic injury can remove or alter previously stable techniques.

This should create realistic veteran evolution rather than a simple icon purge.

## 14. Injury affects traits only through real mechanisms

The injury system can change special abilities when it changes:

- mechanics;
- physical capability;
- movement confidence;
- workload tolerance;
- role;
- rehabilitation focus;
- available technique.

Do not apply `major injury -> randomly lose two blue traits`.

Conversely, rehabilitation or adaptation may produce a new technique/approach without any scripted compensation bonus.

## 15. Mechanics change can create, weaken or invalidate traits

Because pitching/hitting mechanics are causal in this project, a substantial form/mechanics change can affect trait states tied to:

- release/command;
- pitch shape;
- contact geometry;
- launch/spray behavior;
- defensive movement/throwing technique.

The ability lifecycle must read from the mechanics state rather than run as a separate RPG layer.

## 16. Role change can create new specialization without automatic buffs

Examples:

- starter -> reliever;
- regular -> pinch hitter/bench specialist;
- catcher -> lower-load position;
- shortstop -> corner position;
- contact hitter -> more selective/power-oriented approach.

New role provides different exposure, learning incentives and applicability. It does not automatically grant a role special ability on the day of reassignment.

## 17. Coaching is not direct icon transfer

A coach with a famous playing-career ability does not simply copy that icon onto pupils.

Coaching influence should depend on:

- coach's actual instructional knowledge;
- ability to diagnose the player's problem;
- teaching quality;
- compatibility with the player's mechanics/learning style;
- relationship/trust/communication;
- player motivation/buy-in;
- available time/attention;
- relevant repetitions.

This preserves PW-081 and the rule that great player != great coach.

## 18. Former player ability and coaching skill are separate

An elite former player may:

- understand a technique but be poor at teaching it;
- have succeeded through exceptional physical gifts that are not transferable;
- become an excellent teacher in a different area;
- be able to identify the right players for a technique without teaching it to everyone.

Therefore OB/special coaches can be meaningful without becoming gold-trait vending machines.

## 19. User-directed special-ability training should be a project, not a guaranteed purchase

A PowerPro-like simple surface can still allow the user to select goals such as:

- improve opposite-field approach;
- improve bunting;
- refine steal technique;
- improve handling of a role/context.

Internally this allocates limited development/coaching attention and changes learning probability/direction.

Do not use a guaranteed `spend points/book -> trait acquired` core model unless kept as a separate arcade/fantasy option.

## 20. Competing development goals create tradeoffs

Learning one specialized skill can consume:

- practice time;
- coaching attention;
- mechanical experimentation budget;
- game opportunities;
- cognitive focus.

This connects directly to PW-251's finite development-attention idea and helps prevent every veteran from accumulating every positive trait.

## 21. Red traits are causal weaknesses, not curses

A red trait should represent a real weakness/tendency/context response or a strongly believed weakness, not an arbitrary negative status effect.

Red traits can differ in persistence:

- highly trainable technique weakness;
- context-specific approach weakness;
- physical limitation;
- mechanics-linked weakness;
- temporary/state-dependent weakness;
- evaluation error that later disappears.

Do not assume every red trait can be removed with enough training.

## 22. Red traits can be development targets

A club may prioritize reducing a weakness rather than adding a blue trait.

Success depends on the causal source.

Examples in principle:

- a decision/technique weakness may improve through training/experience;
- a physical limitation may be much less modifiable;
- an injury-linked weakness may require recovery/mechanics change;
- a noisy evaluation may simply be revised after more data.

The UI can report `改善傾向` without guaranteeing removal.

## 23. CPU draft logic should evaluate red traits through scouting beliefs

Wave 3 contains a complaint that CPU can select players with many red weaknesses high in the draft. This should not be solved by `CPU never drafts red traits early`.

A high pick can be rational when:

- the player's total expected value is still high;
- weakness severity is uncertain;
- club believes it is fixable;
- upside/rarity at a premium skill is exceptional;
- the club's development environment fits the weakness;
- competing prospects are worse.

CPU must evaluate its scouting belief, not hidden true red-trait values.

## 24. Gold traits are not a separate supernatural layer

Where possible, a gold ability should be the elite display tier of the same underlying trait family rather than a wholly different effect stack.

Conceptually:

```text
same underlying trait dimension
      ↓
normal / blue / elite / gold display tier
```

Crossing into gold changes the label/recognition, not the underlying performance by a sudden discontinuous jump.

Some canonical PowerPro abilities may require bespoke mapping; exact ability-by-ability treatment is a later specification task.

## 25. Gold acquisition requires mastery and durable evidence

Do not allow gold-trait inflation through simple accumulation of coaching events.

Gold status should generally require some combination of:

- genuinely elite underlying trait strength;
- sustained applicability/performance evidence;
- sufficiently high evaluation confidence;
- durability/persistence consistent with that ability family.

A single hot month or one coach event should not normally create a gold trait.

## 26. Gold traits can be lost without a random purge

Gold can downgrade when elite mastery no longer exists because of:

- aging;
- injury;
- mechanics change;
- role change;
- actual skill decline;
- broader era/league context changing the display tier;
- evaluation correction.

Again, the underlying change is continuous; the visible label changes after sufficient evidence/persistence.

## 27. Separate absolute trait effectiveness from era/league-relative display tier

The world has a positive secular long-run baseball-quality trend and already separates absolute baseball skill from PowerPro display scale.

Apply the same principle here where appropriate:

- underlying trait effectiveness is an absolute simulation quantity;
- elite/gold display can be calibrated relative to the league/era distribution so gold remains meaningful over 50-100 years;
- a technique becoming common across baseball should not make every future player gold by default.

Some binary rule/technique labels may remain absolute; the ability-by-ability mapping must state which model applies.

## 28. Generated players are sampled in trait space, not by random icon rolls

Do not generate rookies by independently rolling `blue trait count` and `red trait count`.

Generated players should receive underlying trait dimensions from population models correlated with:

- physical/base skills;
- age/development stage;
- mechanics;
- role/background;
- experience;
- player-specific learning/decision characteristics.

Visible labels are then inferred from those states and available scouting evidence.

## 29. Correlations must be realistic but not deterministic

Avoid both extremes:

- totally independent random trait combinations;
- archetype templates that force every similar player into the same trait set.

Examples of principles:

- some techniques correlate with certain physical/approach profiles;
- elite base skill does not guarantee every associated blue trait;
- weaknesses can coexist with star-level headline ability;
- unusual combinations remain possible at realistic frequency.

## 30. Trait scouting is imperfect

Not every special ability should be known with the same confidence.

Some traits are easy to observe quickly; others require large samples or contextual observation.

Possible UI/scouting states:

- confirmed ability;
- likely strength;
- possible weakness;
- insufficient evidence;
- conflicting reports.

CPU and user organizations use their own information. No CPU club receives the hidden trait ledger for free.

## 31. Own-player evaluation can also update

Even a player's current club can revise its belief about context traits, mechanics effects or durability.

Normal PowerPro-like display should remain easy to read, but the number shown/icon shown represents the club's current evaluated view unless a later information-policy decision explicitly defines a different layer.

Debug/QA truth views can exist separately from normal gameplay.

## 32. Trades, FA and roster decisions use believed traits, not hidden truth

Clubs can value special abilities because they affect projected role/performance/fit, but valuations differ because of:

- scouting confidence;
- team strategy;
- role need;
- coaching/development belief;
- risk tolerance;
- expected transferability to the new environment.

A club can buy low because it believes a red trait is fixable, or avoid a player because it distrusts a context skill. Either can be wrong.

## 33. Some traits may be context-dependent rather than portable

A visible special ability may partly depend on environment/role.

Examples conceptually:

- pinch-hit adaptation needs pinch-hit usage;
- certain communication/leadership effects depend on relationships and clubhouse context;
- tactical tendencies interact with manager/team strategy;
- park/league/opponent environment can change how a skill manifests.

Do not assume every icon transfers with exactly the same realized value to every club while keeping the same underlying player skill.

## 34. Mood-maker / leadership traits must follow the social model

Existing PW-098/PW-099 direction remains mandatory:

- a mood-maker can have real roster value;
- effect is indirect through adaptation, communication, information-sharing, conflict mediation, etc.;
- no universal `all teammates +2` buff.

Visible social special abilities can summarize these capabilities without becoming direct performance multipliers.

## 35. Injury-proneness-like traits must follow the medical model

A PowerPro-style `ケガしにくさ` display can exist as a compact summary of the organization's current durability/risk evaluation.

But underlying injury risk already depends on body-region stress, workload, prior injury, mechanics, age, recovery and chance.

Therefore the displayed trait must **not** apply another generic injury multiplier on top of the same factors unless the effect contract identifies an independent physiological component not otherwise modeled.

## 36. Pressure/clutch-like traits must follow the mental/day-state model

Do not make a clutch icon a universal postseason/RISP magic modifier.

If a persistent context-response trait exists, it should interact with:

- pressure response;
- arousal regulation;
- emotional recovery;
- role/routine comfort;
- opponent strategy;
- actual context.

Observed high-leverage results remain noisy evidence.

## 37. Trait history should be preserved as part of career history

Meaningful lifecycle events can be logged, for example:

- emerging skill noted by staff;
- first confirmed blue trait;
- red weakness reduced;
- gold mastery recognized;
- trait became dormant after role change;
- major injury/mechanics change caused downgrade;
- later career adaptation created a new specialty.

Do not spam the news feed with minor threshold noise; important transitions can become career-history events.

## 38. Long saves need population equilibrium QA

Special abilities require dedicated 20/50/100-year QA.

Track at least:

- blue/red/gold prevalence by league, age, position and role;
- acquisition/downgrade/removal rates;
- number of traits per player distribution;
- gold-trait prevalence and persistence;
- rookie trait distributions;
- age-specific trait profiles;
- role-specific trait profiles;
- cross-era display stability;
- correlation with base skills without duplication;
- CPU valuation/use of traits;
- whether traits accumulate monotonically with career length.

## 39. No automatic accumulation with age or service time

A 15-year veteran should not become a walking collection of positive icons merely because he has existed longer.

Learning is balanced by:

- finite attention;
- physical/technical decline;
- role specialization;
- actual difficulty of mastery;
- player-specific learning response;
- traits that become dormant/obsolete;
- competition and era-relative tiering.

## 40. No forced disappearance just to control population counts

The inverse is also prohibited.

Do not randomly delete veteran abilities solely because the simulation has too many traits.

Population equilibrium must emerge from causal development/decline plus calibrated display thresholds, not hidden cleanup rules.

## 41. Trait interactions need explicit anti-double-count rules

Examples of required safeguards:

- if spray-angle skill directly drives batted-ball direction, a `広角`-type label cannot independently apply the same directional modifier again;
- if health state directly drives injury hazard, a durability label cannot reapply that same risk;
- if pressure-response state changes situational execution, a clutch label is the display for that state rather than a second multiplier;
- if mechanics determine pitch movement, a mechanics-summary trait cannot duplicate movement effects;
- if base contact rating already contains a skill dimension, related traits must own only the residual/context/shape channel explicitly excluded from the base rating.

## 42. Starting real-player appraisal is preserved, not rewritten here

This wall-talk does not change the existing appraisal lane or current real-player special-ability values.

At implementation integration time, current curated appraisals can initialize the corresponding trait/evaluation states according to an explicit mapping table.

Do not use this design document to reopen SP-078/SP-079, speed canonical, shoulder appraisal, or other protected appraisal lanes.

## 43. User-facing UI remains PowerPro-like

The player card can continue to show familiar compact blue/red/gold labels.

Deep internal state should surface only when useful through staff reports such as:

- `逆方向への打撃が安定してきています`;
- `左投手への対応はまだ評価が定まっていません`;
- `この弱点はフォーム由来の可能性があります`;
- `現在の役割ではこの技術を使う機会が減っています`;
- `金特級と評価するにはまだ継続的な確認が必要です`.

No daily trait-micromanagement screen is required.

## 44. Important trait-development projects may interrupt automation only selectively

Possible interruption-worthy events:

- major mechanics change that may alter multiple traits;
- deliberate specialist training with meaningful opportunity cost;
- serious red weakness blocking a role/position;
- potential gold-level mastery;
- injury/rehab-driven technique redesign.

Routine gradual development can remain automated and summarized.

## 45. Ability-by-ability mapping remains a future specification task

This wall-talk defines the lifecycle architecture, not the final mapping of every existing PowerPro special ability.

The later mapping pass must classify each actual ability into:

- true underlying skill/trait;
- contextual response;
- tendency/decision policy;
- physical/medical summary;
- mental/social summary;
- mechanics/repertoire summary;
- display-only/redundant candidate;
- bespoke ability requiring its own causal mechanism.

That pass must reconcile with existing appraisal semantics before implementation.

## 46. Future QA scenarios

Future implementation/research should test scenarios such as:

- player improves gradually before visible blue trait appears;
- visible trait persists briefly near a threshold rather than flickering;
- one hot RISP season does not automatically create a permanent clutch trait;
- veteran loses physical trait but gains role/decision specialization;
- major injury changes mechanics and indirectly downgrades a trait;
- role change makes a trait dormant without deleting underlying skill;
- former star coach fails to teach his former signature skill to an incompatible player;
- non-star coach successfully teaches through superior instruction/fit;
- red trait improves when its causal source is trainable but persists when it is not;
- high draft pick with red weakness is rational under club scouting/value beliefs;
- CPU cannot see hidden trait truth;
- gold traits remain rare/meaningful after 100 years without random cleanup;
- world-wide skill improvement does not cause universal gold-trait inflation;
- ability effects do not double-count base ratings/mechanics/health/social systems.

## 47. Guardrails

- No annual random special-ability purge.
- No deterministic achievement unlock as the core acquisition model.
- No coach-to-player icon copying.
- No great-player-equals-great-teacher rule.
- No guaranteed special-ability training purchase.
- No every-red-trait-is-fixable assumption.
- No gold-trait vending-machine progression.
- No gold ability as an automatic extra effect stacked on top of the same underlying blue trait channel.
- No base-rating + trait double counting of the same mechanism.
- No injury/durability double counting.
- No social-trait universal team buff.
- No CPU access to hidden trait truth.
- No forced trait removal solely for population control.
- No implementation from this document yet.

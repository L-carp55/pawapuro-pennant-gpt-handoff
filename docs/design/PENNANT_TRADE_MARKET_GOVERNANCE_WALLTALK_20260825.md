# Pennant trade market / transaction governance wall-talk — 2026-08-25

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This file records the 2026-08-25 owner wall-talk on trade activity, user-facing roster AI, transaction culture, deadlines, Active Draft evolution, and creation of new player-mobility institutions. It supplements the canonical PW ledgers and master design.

## 1. Trade is a market, not a universal player-point swap

Do not assign one omniscient global trade-value score and simply compare totals.

A club's valuation must depend on its own imperfect player evaluation, roster needs, depth, competitive window, contract status, age, future uncertainty, finances, alternatives, player preferences/rights, and opportunity cost. Market value and club-specific value are separate.

CPU clubs use the same imperfect-information constraints as the user. Anti-fleece protection must come from rational valuation, competition, alternatives, and negotiation rather than hidden anti-user modifiers. Genuine user information advantage and successful buy-low trades must remain possible.

## 2. Trade decision flow

A transaction should emerge from a sequence:

1. identify roster/problem need;
2. identify surplus / expendable resources;
3. search the market;
4. estimate target and seller willingness;
5. construct an offer / package;
6. negotiate / counteroffer / compete;
7. handle medical, consent, roster, contractual, and institutional constraints;
8. record the transaction and later historical evaluation.

CPU clubs should actively contact other clubs rather than only react to offers.

## 3. Needs are functional, not just positional

A club may need `CF defense`, `high-leverage reliever`, `right-handed platoon bat`, `swingman`, `long relief`, `shortstop depth`, etc., rather than merely `one outfielder` or `one pitcher`.

Deployment AI and roster-construction AI must therefore connect directly to trade search.

## 4. Surplus and blocked-player recognition

CPU clubs should recognize:

- duplicated strengths;
- blocked prospects / underused major-league-caliber players;
- excess role depth;
- players approaching FA or other rights milestones;
- players who no longer fit the competitive window.

Other clubs should also detect such situations and make proactive inquiries. A deep organization cannot hide all useful players indefinitely without market pressure.

Surplus does not mean worthless: injury depth, future exits, conversion possibilities, bench value, and future uncertainty still matter.

## 5. User-facing roster / trade AI

The user should not need to manually inspect every player in every organization.

The user's GM/pro-scouting/analytics assistant can:

- analyze the user's roster and identify needs;
- suggest trade targets proactively;
- search from natural-language or simple criteria;
- compare acquisition routes (trade / FA / foreign market / release / etc.);
- identify possible buy-low / under-valued players;
- identify players the other club may be more willing to move;
- suggest packages likely to fit the seller's needs;
- identify clubs that may want a player the user wants to move;
- maintain watch lists and alert when availability appears to improve.

The assistant must explain reasons rather than return only a star rating.

## 6. User-facing AI cannot see hidden truth

The assistant may only reason from information available to the user's organization, including scouting, analytics, public roster/usage, contracts, reporting, agent/network information, prior inquiries, and organizational knowledge.

It must not directly read:

- true latent ability;
- the CPU club's hidden trade-willingness scalar;
- hidden future potential;
- guaranteed future injury outcomes.

`Under-valued` means under-valued relative to the user's club belief / estimated market belief, not relative to omniscient truth.

The assistant can be wrong. Better scouting/analytics/network quality improves evidence quality, not the UI's language-model intelligence itself.

## 7. Inquiry and negotiation generate information

Contacting a club can update beliefs about availability and seller needs. Responses may reveal that the seller:

- views the player as core;
- wants a young starter / catcher / upside prospect;
- is willing to discuss the player only in a package;
- has more or less willingness than previously estimated.

Repeated inquiry must not allow perfect reverse-engineering of hidden CPU values.

## 8. User-configurable trade activity

Provide a PowerPro-like save setting such as:

- 少ない;
- 普通;
- 多い.

The owner explicitly prefers an active market because player movement creates more interesting history.

This setting should **not** make CPU clubs irrational or distort player value. It should primarily change transaction friction / search aggressiveness / willingness to initiate discussions / tolerance for mutually beneficial movement, while keeping club objectives and valuation coherent.

A possible internal interpretation:

- `少ない`: higher transaction friction, fewer exploratory inquiries, stronger preference for internal solutions;
- `普通`: calibrated baseline for the starting baseball world;
- `多い`: more active search, more exploratory negotiation, lower cultural/institutional hesitation when a deal is still rational.

Do not implement `多い` as accepting clearly losing trades.

## 9. Club / GM transaction philosophy

Trade behavior should also vary by organization and GM/personnel leadership.

Possible differences include:

- aggressive vs conservative transaction appetite;
- willingness to trade veterans;
- willingness to trade prospects;
- preference for certainty vs upside distributions;
- willingness to trade within the league / same league / direct competitors;
- preference for internal development vs external acquisition;
- patience in negotiation;
- willingness to create multi-player packages;
- tendency to shop surplus players proactively;
- use of analytics/scouting differences to pursue buy-low targets.

All clubs still seriously try to win. These are strategy/risk/information differences, not different ultimate motivation.

## 10. Save setting and in-world culture are separate

User setting controls the desired overall gameplay activity level.

The simulated baseball world can still evolve its own transaction culture through:

- successful/failed trades;
- GM/front-office diffusion;
- rule changes;
- player-association pressure;
- expansion of player-mobility institutions;
- changing competitive-balance ideas;
- analytics showing value in reallocating blocked players.

Therefore a `多い` setting does not freeze the exact annual trade count, and a `普通` save can still become more or less active over decades.

## 11. Trade deadline is a governance variable

The trade deadline must not be hard-coded forever.

The current/start-year rule can be represented, but future deadline changes can emerge through league governance, owner proposals, player-association discussion, competitive-balance concerns, schedule structure, expansion, or other institutional changes.

Possible rule outcomes include:

- earlier deadline;
- later deadline;
- different windows / restrictions;
- offseason-only or additional special windows if a future rule system creates them.

The exact allowed design space should be calibrated later. The important requirement is that deadline policy is an evolvable rule, not a timeless constant.

## 12. Deadline pressure should arise naturally

The deadline can change market urgency without functioning as an arbitrary transaction-spawn date.

As the deadline approaches, clubs reevaluate:

- remaining games / current-win value;
- injury replacement needs;
- probability of contention;
- expiring rights / FA risk;
- value of waiting vs losing the transaction opportunity.

This can naturally increase activity near the deadline.

## 13. Active Draft is a mutable institution

The Active Draft (`現役ドラフト`) must remain a transaction route distinct from ordinary trade / FA / release.

Its rules should be evolvable, including possible changes to:

- eligibility;
- exclusions / protected categories;
- nomination requirements;
- number of players submitted;
- number of selections;
- ordering / priority;
- salary/contract constraints;
- timing;
- frequency;
- roster effects;
- player consent / rights where applicable;
- incentives or obligations for clubs to participate.

Do not hard-code today's format as eternal.

## 14. Active Draft can expand, contract, succeed, or fail

If the institution successfully moves blocked players into meaningful roles, support can grow and the league/player association may propose expansion.

If it creates unintended effects or weak participation, the institution can be revised, narrowed, replaced, or potentially abolished.

The game should preserve institutional history and outcomes rather than treating reform as a guaranteed improvement.

## 15. New player-mobility institutions can be created

The owner wants systems analogous to Active Draft to be creatable in future saves.

The Rule Proposal Engine should be able to generate or allow proposals for new player-mobility institutions by composing a bounded set of rule primitives rather than scripting one bespoke event.

Candidate primitives include:

- eligible player pool;
- protection / exemption rules;
- club nomination obligations;
- selection order / lottery / bidding / matching mechanism;
- number of selections;
- frequency / timing;
- compensation / exchange requirement;
- salary/contract transfer rule;
- player consent / refusal rights;
- roster-slot consequences;
- re-entry / rights retention;
- purpose / policy target (blocked-player movement, competitive balance, development opportunity, etc.).

This is a design direction, not permission for an unrestricted rule editor that exposes every internal variable.

## 16. User participation and control modes

Depending on mode, the user may:

- simply receive league reform proposals and vote;
- submit / sponsor a proposal;
- negotiate conditions / support;
- in Commissioner mode, directly configure or create a rule experiment.

Normal club-control UI should remain simple; advanced institution creation can live behind governance / Commissioner interfaces.

## 17. Institutions need evaluation and feedback

A new or modified transaction system should be evaluated over time through observable outcomes such as:

- number and quality of players moved;
- playing-time changes after movement;
- club participation;
- competitive-balance effects;
- player / union support;
- owner/front-office support;
- unintended loopholes;
- transaction-market interaction.

Poor outcomes can cause further reform. Successful mechanisms may diffuse to other leagues or inspire variants.

## 18. Guardrails

- Trade-frequency settings must not secretly make CPU valuation stupid.
- GM/team personality must not become permanent franchise magic; leadership and institutional culture can change.
- Deadline / Active Draft reforms remain in-world governance, not arbitrary annual randomization.
- New institutions should be built from bounded reusable rule components and causal political/institutional pressure.
- User-facing AI must remain constrained by organizational information quality.
- Do not begin implementation from this wall-talk document yet.

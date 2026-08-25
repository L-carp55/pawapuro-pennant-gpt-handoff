# Pennant long-run global baseball growth wall-talk — 2026-08-25

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This file records the owner decision that the default long-run baseball world should have a positive secular growth tendency in both baseball quality and market scale. It supplements the canonical PW ledgers and master design.

## 1. Default world has positive secular growth

Over multi-decade / century simulations, the default expectation is that the global baseball ecosystem trends upward rather than remaining stationary forever.

This applies to broad world-level dimensions such as:

- absolute player skill / athletic quality;
- coaching and player-development knowledge;
- scouting / analytics / AI / biomechanics capability;
- medical / conditioning / recovery capability;
- participation and talent-pool depth;
- academy / farm / league infrastructure;
- international scouting connectivity;
- global competitive depth;
- fan reach / media reach / commercial market;
- league and club revenues;
- player salaries / market values;
- international competition quality and visibility.

The default should therefore feel like baseball as a global sport is gradually developing over 20 / 50 / 100 years, not replaying a static 2026 equilibrium forever.

## 2. Positive trend is not monotonic annual growth

Do not implement `every league +X% per year` or guaranteed annual growth.

The intended structure is:

```text
positive long-run secular drift
+ cyclical variation
+ local club/league success or failure
+ technological / organizational diffusion
+ institutional change
+ rare shocks
= observed history
```

World baseball can have recessions, setbacks, failed leagues, weak generations, strikes, disasters, policy restrictions, market contraction, or temporary stagnation while still having a positive long-run global trend by default.

## 3. Global growth does not mean every league grows equally

Individual countries, leagues, and clubs may:

- grow faster than the world;
- stagnate;
- decline;
- recover later;
- lose relative status to rising regions;
- become newly important baseball centers.

The world aggregate can trend upward while relative league strength changes substantially.

NPB, MLB, KBO, CPBL, Latin American systems, European leagues, African development systems, Oceania, and newly generated future leagues must not be locked to permanent 2026 relative positions.

## 4. Growth should be causal, not a flat hidden buff

Long-run improvement should emerge through mechanisms such as:

- larger participation pools;
- better youth development;
- better nutrition / conditioning / medicine;
- coaching and staff knowledge accumulation;
- technology adoption;
- analytics / AI / tracking / biomechanics;
- stronger facilities and farm systems;
- international exchange and knowledge transfer;
- league investment;
- media / commercial revenue reinvestment;
- improved scouting access to previously under-scouted regions;
- competitive imitation and counter-innovation.

A small background secular component may be necessary to keep the default world from becoming globally stationary, but owner-visible explanations should come mainly from real system states and diffusion rather than `future era +5` modifiers.

## 5. Absolute baseball skill and displayed PowerPro-like ratings must remain separate

This reinforces existing PW-245 / OPEN design work.

If absolute baseball quality improves over decades, displayed ratings must not simply drift until the average player is rated 85-90.

The architecture must distinguish at least:

- absolute baseball skill / engine-relevant skill;
- league / era competitive level;
- user-facing PowerPro-like rating scale.

A player rated `B75` in 2080 may be absolutely better at baseball than a `B75` player in 2026 while occupying a similar relative tier in the contemporary league.

Historical comparison tools may expose absolute / era-adjusted context separately.

## 6. Market growth must distinguish real growth from nominal inflation

Long-run market expansion should not be simulated only by making salary numbers larger.

Distinguish conceptually:

- nominal salary / price inflation;
- real league revenue growth;
- real fan / media market growth;
- changes in revenue distribution;
- changing cross-league salary competitiveness;
- changes in the economic value of stars / rights / international exposure.

A `10 billion yen` contract decades later should not automatically mean the same competitive or financial burden as the same nominal figure in 2026.

## 7. Growth can create strategic and institutional consequences

Examples of second-order effects:

- deeper talent pools make replacement players stronger;
- better evaluation reduces some market inefficiencies while creating new ones around new technology;
- stronger overseas leagues increase competition for the same players;
- rising regions create new scouting / academy opportunities;
- richer leagues can expand farm systems, medical departments, and R&D;
- salary growth changes FA / trade / foreign-player markets;
- global parity can make international tournaments more competitive;
- new leagues may become financially viable;
- existing leagues may lose relative prestige even while improving absolutely.

## 8. Innovation diffusion should raise the floor over time

Successful methods should not remain permanent exclusive club buffs.

Over decades, scouting methods, pitch design, training, AI, biomechanics, medical knowledge, and organizational structures can diffuse through staff movement, partnerships, imitation, publications, technology vendors, academies, national federations, and international competition.

First movers still retain temporary advantages, and diffusion speed can vary by money, staff, language, trust, network, regulation, and organizational competence.

## 9. User-facing long-run history should make growth legible

History / news / analytics views should be able to explain that the world has changed, for example:

- league-average velocity / athleticism rose;
- new countries became significant talent sources;
- salaries and league revenues expanded;
- international competitive gaps narrowed or widened;
- a league gained / lost global status;
- technology adoption created a new era;
- the average replacement level improved.

This should be visible historically without forcing users to manage macroeconomics directly.

## 10. Default trajectory and configurability

Owner preference: **positive long-run growth is the default experience**.

A future save-setting may optionally allow reduced / accelerated / highly volatile world-growth variants, but the standard mode should not be a stationary world.

Any such setting must adjust structural growth tendencies rather than directly grant hidden player-rating buffs.

## 11. Guardrails

- Do not force every season, country, league, or club to grow.
- Do not use hidden catch-up boosts to make weak leagues converge automatically.
- Do not make world growth equivalent to universal displayed-rating inflation.
- Do not equate salary inflation with real market growth.
- Do not freeze 2026 league hierarchy for 100 years.
- Do not make one club's current innovation a permanent exclusive franchise trait.
- Preserve genuine decline, failed institutions, and lost eras inside an overall positive default secular trend.
- Do not begin implementation from this wall-talk document yet.

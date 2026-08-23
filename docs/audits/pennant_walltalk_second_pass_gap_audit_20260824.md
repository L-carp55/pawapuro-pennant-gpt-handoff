# Pennant wall-talk second-pass gap audit — 2026-08-24

Status: **INITIAL 235-ROW BASELINE FOUND INCOMPLETE / SECOND-PASS REPAIR APPLIED**

## 0. Why this audit exists

The first audit (`pennant_walltalk_completeness_audit_20260824.md`) correctly preserved most high-level mechanisms, but it used a **generalization-first** completeness criterion. On a stricter reread of the owner wall-talk, that was not sufficient to justify the phrase "one item missing = zero" / complete preservation.

This second pass tests three separate preservation layers:

1. **Mechanism preservation** — did the game-system idea survive?
2. **Decision/rationale preservation** — did the reason a mechanism was requested survive?
3. **Concrete example/counterexample preservation** — did named examples and cautions survive without being silently turned into factual truth?

Verdict before repair:

- mechanism coverage: high;
- rationale/example coverage: incomplete;
- several assistant-proposed or pre-existing project requirements: absent from the 235-row ledger.

Therefore the first "BASELINE COMPLETE" verdict is **superseded for strict completeness purposes** by this audit.

---

# 1. Concrete examples lost during generalization

The initial master generalized mechanisms but did not explicitly retain many owner examples, including:

- Sakakura-type catcher/first-base workload example;
- Kai-type old-league information / reverse familiarity example and the causality caveat;
- Carp Academy / SoftBank 3rd-4th team / Carter Stewart Jr. examples in their full rationale;
- specific owner perceptions used to motivate club-reputation systems (Rakuten veteran treatment, Yakult injury reputation, Tatsunami-era Chunichi atmosphere, Lotte/Chunichi power-development reputation);
- owner perception of Hiroshima/Chunichi ownership as the negative UX example motivating "all CPU clubs seriously try to win";
- Hiroshima/unfamiliar-pitcher perception as the negative example motivating research quality instead of a fixed franchise trait;
- Mike Trout late-career NPB bidding hypothetical;
- 2026 AA prospect → later MLB/WBC hypothetical;
- historical controversy/scandal seeds such as Black Mist, baseball gambling, harassment, theft, Egawa blank-day, recruiting/payment controversy, and fan-labelled overseas-return rule debates;
- explicit correction/caution that a real example used for inspiration should not be treated as causal proof or a permanent club/player trait.

Repair:

- added `docs/reference/pennant_owner_examples_and_rationale_20260824.md`.
- examples are labeled as OWNER_EXAMPLE / OWNER_PERCEPTION / HYPOTHETICAL / HISTORICAL_RESEARCH_SEED / ASSISTANT_CAUTION.
- unverified perceptions are explicitly forbidden from becoming hard-coded facts without research.

---

# 2. Missing granular requirements found

The 235-row ledger omitted several requirements or proposed ideas that existed in the wall-talk or pre-existing project purpose.

Repair:

- added `docs/state/pennant_feature_requirements_addendum_20260824.tsv` with `PW-236`–`PW-260`.

## Important recovered requirements

### Dedicated trade / transaction layer

The original project complaint explicitly includes bad CPU trade/FA/roster construction, but the 235-row design had no dedicated trade-system requirement.

Recovered:
- `PW-236`: dedicated trade system;
- `PW-237`: CPU actively targets blocked/underused prospects and surplus players;
- `PW-238`: active draft as a separate transaction route.

### Global player market is the actual foreign-player candidate pool

Recovered:
- `PW-239`: NPB foreign-player candidates come from the living Global Baseball World;
- `PW-240`: multiple leagues can compete for the same player;
- `PW-241`: early scouting/network discovery creates information/price advantage;
- `PW-242`: NPB adaptation emerges from underlying traits/context rather than one fixed adaptation stat.

### International player agency

The first ledger preserved tournament meaning and selection composition but lost the earlier proposal that the player himself may value/decline national-team participation.

Recovered:
- `PW-243`: player willingness/decline;
- `PW-244`: optional user-final-control vs player-agency mode for the user club.

### Global skill inflation vs display scale

The earlier wall-talk explicitly raised a problem: if world baseball improves over decades, raw baseball ability can rise without every PowerPro display rating drifting upward forever.

Recovered:
- `PW-245`: study separation of absolute baseball skill from era/league-relative display scale.

### Real 2026 innovations are starting assets, not eternal club buffs

Recovered:
- `PW-246`.

### Finance / ownership nuance

Recovered:
- `PW-247`: resource differences exist but money is not an automatic win button;
- `PW-248`: owner strategy personality can differ while win motivation stays high;
- `PW-249`: evaluate team results relative to expectations/competitive window;
- `PW-250`: rebuild attempts can fail without automatic catch-up.

### Development / staff / contract details

Recovered:
- `PW-251`: focused-development attention trade-off and player response differences;
- `PW-252`: staff career ladders and non-staff retirement paths;
- `PW-253`: early contract extensions before FA;
- `PW-254`: broader agent behavior;
- `PW-255`: emergent reclamation/revival reputation.

### Governance / roster / relationship details

Recovered:
- `PW-256`: foreign-player/roster registration rules can also evolve;
- `PW-257`: All-Star/national-team relationships may persist beyond the event;
- `PW-258`: user-controlled club can participate in league governance positions/votes;
- `PW-259`: contract/expectation pressure affects context, not direct hidden stat penalties;
- `PW-260`: bounded prospect universe for scalable long-term simulation.

---

# 3. Major domains that were already correctly marked OPEN

These are **not** second-pass omissions because the state file explicitly preserved them as unfinished:

- injury/fatigue/condition details;
- stadium/new-stadium/renovation;
- fan/media/sponsor details;
- finance formulas;
- agent-market detailed design;
- contract clauses;
- national-team eligibility;
- global simulation performance budget;
- scandal calibration;
- family generation;
- coaching/mentorship calibration;
- staff labor market;
- player-association bargaining details;
- expansion/relocation governance;
- future technology generation;
- real overseas player data/licensing feasibility.

After this second pass, additional OPEN areas should include:

- detailed trade / transaction market design;
- active-draft mechanics;
- NPB foreign-player registration/roster rules;
- absolute-vs-relative long-run ability scale policy.

---

# 4. What this audit does NOT claim

Even after repair, "all information" cannot mean that the product is fully designed.

This audit claims only:

1. the currently available owner wall-talk has been represented as either:
   - canonical mechanism requirement,
   - explicit proposed requirement,
   - concrete example/rationale seed,
   - or explicitly OPEN design domain;
2. named owner examples are no longer discarded merely because a generalized mechanism exists;
3. the initial 235 count is no longer treated as the complete universe;
4. external baseball-news/history discovery has not yet run, so new ideas remain expected.

---

# 5. Current strict verdict

### Before second-pass repair

**NOT STRICTLY COMPLETE.**

The original 235-row baseline was materially useful but too aggressive in claiming completeness.

### After second-pass repair

Current requirement inventory:

- base ledger: `PW-001`–`PW-235` = 235 rows;
- second-pass addendum: `PW-236`–`PW-260` = 25 rows;
- combined current count: **260 requirements**.

Concrete examples/rationales:

- now separately persisted in `docs/reference/pennant_owner_examples_and_rationale_20260824.md`.

### Remaining epistemic limitation

A literal mathematical proof that no sentence from all historical conversations was ever omitted would require a complete authoritative export of every relevant prior chat turn and a row-level traceability matrix against it. The current project/session context available to this audit has been exhaustively rechecked, but that stronger claim should not be made without such an export.

Therefore the correct status is:

**CURRENT AVAILABLE WALL-TALK: SECOND-PASS PRESERVED**

**ABSOLUTE ALL-HISTORICAL-CHAT COMPLETENESS: NOT PROVABLE FROM CURRENT INPUT ALONE**

**EXTERNAL IDEA DISCOVERY: STILL PENDING**

**FEATURE IMPLEMENTATION: STILL NOT AUTHORIZED**

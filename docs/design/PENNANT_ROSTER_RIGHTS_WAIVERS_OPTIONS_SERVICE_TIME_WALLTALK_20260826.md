# Pennant roster rights / waivers / options / assignment / service-time wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / CURRENT-RULE RESEARCH ANCHORED / IMPLEMENTATION NOT AUTHORIZED**

This document preserves wall-talk for OD-07 `roster_rights_waiver_options_assignment_service_time_model`. It supplements transaction/trade, active draft, injury/medical, grievance/player agency, farm systems, contract/FA, governance and CPU deployment design. It creates no new canonical PW IDs.

## 1. Core principle: roster status is multi-axis, not one enum

Do not represent every league with one state such as:

`FIRST_TEAM / SECOND_TEAM / FREE_AGENT`.

A player can simultaneously have different statuses for:

- contractual control / registration rights;
- protected/reserve roster membership;
- active game roster eligibility;
- physical assignment location;
- injury/leave list status;
- option/assignment rights;
- waiver exposure;
- service/FA/arbitration clocks;
- nationality/domestic/foreign roster classification;
- special temporary exception status.

These axes interact but are not interchangeable.

## 2. Use one Roster Rights Engine with league-specific rule packs

NPB, MLB, KBO, CPBL, future leagues and independent leagues should not be forced into identical state names.

Use common rule primitives such as:

- roster/list membership;
- capacity limit;
- eligibility condition;
- assignment destination;
- minimum stay/cooldown;
- service-clock accrual;
- consent right;
- waiver exposure;
- claim priority;
- transaction deadline;
- injury/leave exception;
- temporary extra-roster exception;
- effective date / transition rule.

Each league/era composes these primitives differently.

## 3. 2026 NPB is an initial rule pack, not universal code

Current official NPB public information confirms distinct layers such as:

- 支配下選手登録;
- 育成選手登録;
- 出場選手登録 / 登録抹消;
- active-registration limits;
- ordinary re-registration delay after removal;
- special exceptions such as infection/concussion-related rules;
- in-season deadline for new controlled-player contracts/transfers;
- waiver-related post-deadline paths.

As of 2026, public NPB roster notices show 31 registered players for clubs in season and ordinary roster-removal notices state that a player cannot be re-registered for 10 days. Many clubs operate at the 70-player controlled-roster limit, while development players remain a separate list and can be converted to controlled status before the applicable deadline.

These values belong in current-world rules/data, not hard-coded architecture.

## 4. 2026 MLB demonstrates why multiple axes are required

Current MLB rules include, among other things:

- 26-man active roster;
- 40-man roster;
- injured lists;
- Minor League option years;
- limits on optioning frequency;
- minimum assignment periods before normal recall;
- DFA / outright waiver paths;
- service-time accrual;
- arbitration / free-agency consequences;
- service-based consent rights;
- Rule 5 protection/exposure.

A player may therefore be controlled by the organization, on the 40-man roster, optioned to the Minors, accruing or not accruing MLB service depending on status, and carrying future waiver/consent implications simultaneously.

## 5. Separate Contract Control from Competition Eligibility

The club having contractual rights to a player does not mean the player is currently eligible for the top league.

Conceptual axes:

```text
CONTRACT CONTROL
  controlled / free agent / loaned / etc.

PROTECTED OR RESERVE STATUS
  league-specific protected roster/list

ACTIVE ELIGIBILITY
  active/top-team roster or not

ASSIGNMENT
  first team / second team / AAA / AA / rehab / third team / etc.
```

This prevents NPB controlled-player registration and MLB 40-man protection from being treated as the same thing as game-day availability.

## 6. Injury status is a roster/legal state layered over true health

The medical model owns actual health and readiness.

The roster-rights engine owns institutional consequences such as:

- whether the player occupies an active slot;
- whether he remains on a protected list;
- minimum unavailable period;
- replacement eligibility;
- service-time consequences where applicable;
- rehab-assignment eligibility.

Do not use `injured-list status` as proof of true latent health severity.

## 7. Promotion is a legal/roster transaction, not just a depth-chart move

When a club wants to promote a player, the engine should check all relevant constraints.

Possible checks include:

- active-roster space;
- protected/control roster membership;
- foreign-player limits;
- option/assignment status;
- recent demotion cooldown;
- injury status;
- contract status;
- roster-expansion / temporary replacement rule;
- deadline/eligibility rules.

If promotion is illegal, the UI/CPU must receive the exact rule reason and available legal paths.

## 8. Demotion also has consequences beyond playing time

Possible consequences include:

- mandatory minimum time before recall;
- consumption of an option year or option movement allowance;
- waiver exposure;
- service-time effect;
- need for player consent;
- active/protected roster spot changes;
- player grievance/trust consequences;
- development opportunity and role consequences.

Thus `send to minors` must not be a costless reversible toggle in leagues where rules make it costly.

## 9. NPB registration removal should create real roster planning

Under the current NPB-style rule pack, ordinary removal from the first-team registered roster should create a re-registration waiting period based on current rules.

This makes decisions such as:

- skipping a starter once;
- temporarily carrying an extra reliever;
- resting a veteran;
- creating bench depth;

carry real opportunity cost.

Special exceptions can override the ordinary cooldown when the rule pack explicitly allows them.

## 10. Temporary exceptions are data-driven exception tokens

Do not create bespoke engine branches for every future exception.

Model special cases as rule-authorized temporary states such as:

- concussion replacement;
- infectious-disease replacement;
- doubleheader extra player;
- emergency replacement;
- postseason/tournament-specific roster exception.

The token states:

- eligibility trigger;
- capacity effect;
- duration;
- recall/demotion exception;
- service consequences;
- replacement relationship where relevant.

This lets future rules change without redesigning roster code.

## 11. MLB option years are a rights resource, not a player quality attribute

For an MLB-style rule pack, option status affects whether a player can be assigned to the Minors without waivers.

The club must consider future flexibility when promoting/protecting players.

Do not interpret `has options` as positive baseball ability or developmental potential.

## 12. Option transactions create strategic but bounded flexibility

Current MLB public rules state that players generally receive three option years, with a possible fourth in defined cases. One option year is normally consumed after enough Minor League assignment time in a season, and current rules also limit the number of times a player can be optioned during one season.

The game should store the rule definitions in the MLB 2026 ruleset and evaluate them automatically.

Future CBAs can change those numbers through governance/rule data.

## 13. Out-of-options status should create meaningful roster pressure

An out-of-options player cannot simply be toggled between MLB and the Minors under current MLB-style rules.

The club may need to:

- retain him on the active roster;
- trade him;
- DFA him;
- expose him to outright waivers;
- release him;
- use another legal roster path.

This creates genuine value for roster flexibility and explains why two similarly talented players can have different organizational value.

## 14. DFA is a transaction process, not instant disappearance

Under the current MLB ruleset, DFA removes a player from the 40-man roster and starts a short resolution window in which trade/waiver/release outcomes can occur.

The simulation should preserve this process rather than treating DFA as a synonym for release.

## 15. Waivers create real exposure to other clubs

A player subject to waivers is not merely waiting through a timer.

Other eligible clubs should evaluate whether to claim based on:

- player value;
- contract;
- roster space;
- role need;
- option/assignment status;
- competitive window;
- medical information;
- future rights.

No CPU club should ignore a valuable waiver player simply because the user initiated the transaction.

## 16. Waiver claims use public institutional information, not hidden club intent

Claiming clubs may know the player's public/available roster status and their own evaluation, but not every other club's hidden claim decision.

Where priority/order rules exist, the engine applies them institutionally after clubs make independent decisions.

## 17. Assignment refusal rights must be explicit

A player may have the contractual/service-based right to reject certain assignments.

Current MLB public explanations, for example, note that players with more than five years of MLB service must consent to being optioned, and certain players can reject an outright assignment in favor of free agency.

Player agency here is a **legal right**, distinct from ordinary role preference or grievance.

## 18. Legal rights and social resistance remain separate

A player without a formal veto can still dislike a demotion.

Therefore:

```text
institutional ability to assign
≠
player willingness/satisfaction
```

The roster engine determines whether the club can legally make the move. The grievance/relationship system determines the human response.

## 19. Service time is a rule clock, not experience points

Service-time-like systems should record institutional rights accrual.

They must not directly make the player better.

Current MLB service time affects arbitration, FA and certain trade/assignment rights; current NPB FA qualification uses its own league-specific service/registration rules.

Each league owns its own clock definitions.

## 20. Multiple service clocks can coexist

A future league may need separate concepts such as:

- top-league service;
- registered-roster days;
- professional seasons;
- arbitration service;
- FA service;
- pension/benefit service;
- domestic-player classification time.

Do not assume one integer `service_time` can support every institution.

## 21. Service manipulation can exist as a legal incentive problem

If a rule creates incentives to delay promotion or assignment for rights-control reasons, CPU/user clubs may notice and exploit that incentive within the rules.

Do **not** secretly prevent the user/CPU from making a legal but controversial move.

Instead consequences can emerge through:

- player/agent grievance;
- reputation;
- union/player-association response;
- public/media debate;
- future CBA/rule proposal;
- altered player willingness to extend/sign.

This connects directly to the project's rule-loophole and governance philosophy.

## 22. CPU roster management must price rights opportunity cost

CPU player valuation should include not only baseball performance but also relevant roster-rights value, for example:

- option flexibility;
- protected-roster slot cost;
- waiver risk;
- remaining club control;
- service/FA timeline;
- consent/no-trade restrictions;
- foreign/domestic status;
- Rule 5/Active Draft exposure;
- injury-list availability.

This does not mean every club values those factors identically.

## 23. CPU cannot use roster rules with hidden future knowledge

A CPU club may preserve an option because it believes flexibility is valuable; it cannot know with certainty that the player will be injured next month or become a star.

Roster decisions use current club beliefs and forecast distributions.

## 24. Roster spots have nonlinear value

The 40th protected slot, 70th controlled slot, final foreign-player slot or final active-roster spot can be much more valuable than a generic average roster slot depending on context.

Roster-space value therefore changes with:

- deadline proximity;
- injury cluster;
- prospect protection deadlines;
- competitive window;
- upcoming transactions;
- available replacement pool.

Do not assign one fixed dollar/point price to a roster slot.

## 25. Protection deadlines connect prospects to roster decisions

Rules such as MLB Rule 5 eligibility or future Active Draft protection rules create choices between:

- protecting a prospect;
- exposing him;
- clearing a roster spot;
- trading another player;
- accepting claim/draft risk.

The prospect universe and roster-rights engine must therefore share the same persistent player identity.

## 26. Active Draft and Rule 5-like institutions are distinct rule modules

Do not collapse all forced player-mobility systems into one generic `active draft` button.

They may differ in:

- eligibility;
- protection lists;
- selection order;
- acquiring-club roster obligation;
- return rights;
- salary/fee;
- duration;
- purpose.

Use common primitives but preserve institutional identity/history.

## 27. Expansion Draft uses the same protection primitives

Expansion Draft can reuse:

- protected-player list;
- eligible/exposed pool;
- claim/selection order;
- maximum losses per club;
- contract transfer;
- special exemption.

Do not build expansion protection as a disconnected system.

## 28. Foreign-player status is another roster axis

Nationality/domestic-status rules should not be baked into first-team assignment state.

A player can be:

- controlled by the club;
- active or inactive;
- domestic/foreign by the current rule definition;
- subject to position-specific or aggregate foreign limits.

Rule evolution can change those definitions and limits without rewriting the core player object.

## 29. Injury replacement and roster rights must connect to medical uncertainty

A club deciding whether to place a player on an injury list / remove him from active registration weighs:

- expected absence distribution;
- minimum roster-list duration;
- replacement value;
- rights/service consequences;
- uncertainty in diagnosis.

The club should not know the exact hidden recovery date when making the choice.

## 30. Rehab assignment is separate from normal demotion

Where league rules permit a formal rehab assignment, it should have its own eligibility/duration consequences.

Where a league instead uses second-team games after roster removal, that is a different rule path.

Do not force every injured player into an MLB-style rehab-assignment state.

## 31. User-facing UI should explain consequences before confirmation

Keep the surface simple.

Example NPB-style action preview:

`一軍登録を抹消します。通常ルールでは10日間再登録できません。`

Example MLB-style preview:

`AAAへoptionします。この移動により今季のoption yearが使用される可能性があります。再昇格には通常の最低滞在期間が適用されます。`

Example out-of-options warning:

`この選手はoptionできません。マイナーへ送るにはDFA/waiver等の手続きが必要です。`

Do not make users memorize legal rulebooks to operate the roster.

## 32. Assistant/GM recommendations should include rights reasons

The organization's AI can say:

- `この選手を抹消すると次の先発予定日に再登録できません`;
- `このprospectを昇格させるには40-man枠を1つ空ける必要があります`;
- `この選手はout of optionsのため、降格すると他球団へ失うリスクがあります`;
- `今保護しなければ次回draftで対象になる可能性があります`.

These explanations should derive from real rule state, not flavor text.

## 33. Delegation must remain possible

The user should not have to manually process every procedural roster move.

Possible policy controls:

- standard automatic legal move;
- preserve prospects/options aggressively;
- prioritize current first-team strength;
- avoid waiver exposure without confirmation;
- always interrupt on permanent-control/waiver-risk decisions.

Important irreversible/high-risk actions should be interrupt-capable.

## 34. CPU must recover from roster deadlocks

A competent CPU cannot simply stop promoting, drafting or signing because a roster is full.

When constraints bind, it must search legal alternatives such as:

- demotion/option;
- release/non-tender;
- trade;
- waiver transaction;
- protected-roster removal;
- injury-list transfer where legitimate;
- letting another candidate go.

Bad organizations can choose poorly, but the world must not functionally stop because the AI cannot solve a roster constraint.

This directly answers Wave 3's long-save concern about CPU acquisition/roster activity stopping.

## 35. Roster mistakes should have identifiable causes

Examples:

- overvaluing a fringe veteran and exposing a prospect;
- burning flexibility too early;
- holding too many redundant players;
- misunderstanding player recovery timing;
- failing to anticipate a protection deadline;
- accepting waiver loss because current competitive need dominates.

Avoid random `CPU roster error` events.

## 36. Transaction history is permanent

Preserve meaningful roster-rights history such as:

- active registration/removal;
- option assignments;
- DFA;
- waiver claim/clear;
- outright assignment;
- development-to-controlled conversion;
- Rule 5/Active Draft/Expansion Draft selection;
- major roster-rights refusal/consent events.

Routine daily movement can be summarized to prevent history spam.

## 37. Rules can evolve over decades

Roster institutions are part of the Rule Proposal Engine.

Possible future changes include:

- active roster size;
- protected/control roster size;
- foreign-player limits;
- option count/frequency;
- minimum recall waiting periods;
- waiver procedure;
- service-time definition;
- FA/arbitration timelines;
- draft protection systems;
- injury-list rules.

Every rule change must support effective date and transition/grandfathering when required.

## 38. Rule change must not corrupt existing player rights

When a rule changes, existing players may require transition treatment.

Examples:

- already-used option years;
- accrued service;
- existing no-trade/consent rights;
- current protected status;
- contracts signed under prior rules.

The engine needs explicit migration/transition rules rather than recalculating history under the new system.

## 39. League identity remains visible

Although one engine powers all leagues, the UI and history should still use recognizable institutional names:

- NPB 支配下 / 育成 / 出場選手登録;
- MLB 40-man / option / DFA / waivers;
- other leagues' own terms.

Do not erase baseball-world identity for the sake of technical abstraction.

## 40. Future QA — NPB-style scenarios

At minimum test:

- controlled player promoted to active registration;
- ordinary active-roster removal creates the correct re-registration wait;
- permitted special exception bypasses only the rule it is designed to bypass;
- development player cannot be treated as controlled/active without valid conversion;
- controlled-roster capacity blocks illegal conversion/signing;
- applicable deadline prevents ordinary late transaction while preserving authorized waiver paths;
- CPU adjusts legally instead of becoming inactive when roster capacity is full.

## 41. Future QA — MLB-style scenarios

At minimum test:

- promote non-40-man prospect when 40-man is full -> legal roster-clearing decision required;
- optionable player moves to Minors and option/service rules update correctly;
- repeated option moves respect current annual movement limits;
- out-of-options player cannot be freely demoted;
- DFA creates resolution process rather than immediate deletion;
- waiver claim transfers rights correctly;
- player with applicable service rights can reject assignment;
- injured-list transaction changes active/protected-slot consequences correctly;
- service time accrues only under the current ruleset's eligible statuses;
- 27th-man/doubleheader exception works without consuming ordinary recall restrictions incorrectly;
- Rule 5/protection decisions interact with 40-man capacity.

## 42. Cross-era QA

For 20/50/100-year saves verify:

- no roster institution silently freezes league transactions;
- rules changed by governance take effect on the correct date;
- old service/contract rights survive transitions correctly;
- CPU clubs remain legally active under new rule combinations;
- no league-specific state leaks into another league;
- roster population remains consistent with league capacity;
- player history remains traceable across rule eras.

## 43. Guardrails

- No universal `FIRST_TEAM / SECOND_TEAM` roster enum for all leagues.
- No costless reversible demotion in leagues with assignment rights/cooldowns.
- No service time as a baseball-skill stat.
- No CPU hidden access to future injuries, player development or other clubs' claim decisions.
- No waiver process where other clubs are passive by default.
- No automatic retirement/release from DFA/waiver exposure unless the institution produces that outcome.
- No secret ban on legal service-time/roster-rule exploitation; use player/union/governance responses instead.
- No hard-coding 2026 NPB/MLB numeric rules into architecture; load them as initial rule data.
- No implementation from this document yet.

## 44. Current official research anchors used for this wall-talk

NPB official public sources (2026):

- https://npb.jp/announcement/roster/
- https://npb.jp/announcement/2026/
- https://npb.jp/announcement/2026/pn_registered.html
- https://npb.jp/news/detail/20260731_02.html

MLB official glossary sources:

- https://www.mlb.com/glossary/transactions/40-man-roster
- https://www.mlb.com/glossary/transactions/26-man-roster
- https://www.mlb.com/glossary/transactions/minor-league-options
- https://www.mlb.com/glossary/transactions/designate-for-assignment
- https://www.mlb.com/glossary/transactions/service-time
- https://www.mlb.com/glossary/injuries/10-day-injured-list
- https://www.mlb.com/glossary/injuries/15-day-injured-list

These sources anchor the 2026 initial ruleset only. Exact CBA/NPB agreement text and future rule changes must be revalidated before implementation.

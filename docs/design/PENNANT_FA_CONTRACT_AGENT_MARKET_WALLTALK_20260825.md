# Pennant FA / contract / agent market wall-talk — 2026-08-25

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This file preserves the 2026-08-25 wall-talk on free agency, extensions, contract renewal, agents, promises, player values, competing offers, posting/overseas paths, and user-facing acquisition AI. It supplements the canonical PW ledgers, master design, and `PENNANT_TRADE_MARKET_GOVERNANCE_WALLTALK_20260825.md`.

## 1. FA is part of one Player Mobility Market

Do not treat trade, FA, foreign-player acquisition, release, Active Draft, posting, extension, and other movement routes as isolated mini-games.

The user's roster AI and CPU clubs should compare routes such as:
- trade now;
- wait for FA;
- extend the current player;
- seek a foreign-player alternative;
- claim / sign a released player;
- wait for Active Draft or another mobility mechanism where relevant.

The correct decision depends on need, timing, acquisition cost, uncertainty, contract length, player preferences, competitive window, and institutional rules.

## 2. FA declaration / market entry is a player decision

FA should not be an automatic event purely because eligibility is reached.

A player may weigh:
- current club attachment;
- expected role / playing time;
- contract value and security;
- championship opportunity;
- home / family / geography;
- favorite or desired club;
- overseas ambition;
- organization reputation;
- manager / coach relationships;
- confidence in future usage;
- commercial / prestige considerations;
- desire for a new challenge.

The player may choose not to enter the market even when eligible.

## 3. Early extension / re-signing must exist before FA

Clubs can negotiate before formal FA eligibility. The timing itself is strategic.

A club may offer security early to:
- retain a core player;
- avoid future bidding competition;
- lock in a player before a breakout;
- create cost certainty.

A player may accept for security or reject because he expects a stronger future market.

Extensions should not guarantee bargains; both sides have imperfect beliefs about future performance and market value.

## 4. Player value is multidimensional, not salary-only

A contract offer can include or imply:
- salary / total guaranteed value;
- contract length;
- payment timing where the rule set allows it;
- options / opt-outs / incentives where supported;
- role expectations;
- first-team / rotation / closer opportunities;
- posting / overseas discussion expectations;
- position expectations;
- no-trade / consent rights where permitted;
- family / relocation support or analogous qualitative context where appropriate.

Keep the typed clause set bounded so the game remains baseball management rather than contract-law micromanagement.

## 5. Role promises matter but are not magic stat modifiers

Examples:
- `先発として起用予定`;
- `クローザー候補`;
- `レギュラー争いの中心`;
- `若手育成より即戦力として評価`;
- `将来のposting協議に前向き`.

A promise influences signing willingness and later trust / satisfaction. If circumstances change, the club may break or renegotiate the expectation, creating relationship and future-market consequences rather than direct hidden ability penalties.

## 6. Clubs and players have different beliefs about future value

A player and his agent may believe a breakout is real while the club sees noise; the club may believe decline risk is high while the player expects another prime season.

Contract disagreement therefore emerges naturally from:
- ability evaluation differences;
- aging uncertainty;
- injury / durability uncertainty;
- role expectations;
- market expectations;
- risk tolerance.

Do not force all negotiation disputes into random mood modifiers.

## 7. Agent behavior is broader than asking for more money

Agents may differ in:
- preferred negotiation timing;
- willingness to test the open market;
- creation of multi-club competition;
- information / rumor management;
- emphasis on security vs upside;
- use of deadlines;
- role / posting / option demands;
- willingness to reopen or walk away from talks;
- relationship/network strength.

Agents do not read hidden truth. Their quality is partly market knowledge, negotiation skill, and information network.

## 8. Market creation is an active process

An agent can contact clubs, signal availability, encourage competing offers, or wait strategically.

A club can also contact agents early where rules allow and build interest.

The FA market should not be a static list where every club sees the same exact salary demand and secretly bids once.

## 9. Competing offers are real and simultaneous

Multiple CPU clubs may pursue the same player based on their own needs and beliefs.

A player's preferred offer is not necessarily the highest salary. A lower-money offer may win because of:
- clearer role;
- more years / security;
- stronger championship outlook;
- preferred location;
- better organizational reputation;
- overseas / posting pathway;
- manager / coach relationship.

The UI should explain major deciding factors without exposing exact hidden utility scores.

## 10. Counteroffers and evolving demands

Negotiation should allow:
- initial offer;
- response / rejection;
- counteroffer;
- revised term / role / length;
- competing-market feedback;
- walk-away.

Repeated offers must not allow perfect reverse-engineering of the player's hidden utility function.

## 11. User-facing roster AI should compare acquisition routes

The assistant can answer requests such as:
- `来季の遊撃をどう補強すべき？`;
- `この選手をトレードで今取るべきか、FAまで待つべきか？`;
- `2億円以内で長打力のある一塁手候補を国内外から探して`;
- `このFA選手の代替候補を探して`.

It can compare trade cost, FA salary risk, foreign-player uncertainty, roster fit, and timing, while remaining constrained by the user's organizational information.

## 12. A club may trade a player because extension talks fail

Extension rejection can change trade incentives before FA.

A club may decide:
- keep the player for the pennant race;
- make one more extension attempt;
- trade him before losing control;
- accept compensation / market-exit consequences under current rules.

This connects contract negotiation directly to trade deadline behavior.

## 13. A player may prefer to reach FA despite a fair offer

Reasons can include:
- desire to choose a destination;
- confidence in future market price;
- dissatisfaction with role;
- overseas ambition;
- relationship issues;
- desire to test personal market value.

This is not automatically hostility toward the current club.

## 14. Club reputation should affect negotiations emergently

Examples of relevant reputations:
- honors role promises;
- develops pitchers well;
- provides opportunities to young players;
- supports overseas ambitions;
- handles veterans respectfully;
- has unstable management / frequent role changes;
- strong medical / support environment.

These reputations must emerge from actual history and observed behavior, not permanent real-club tags.

## 15. Large contracts create organizational context, not direct ability penalties

High salary can create expectations, fan/media attention, sunk-cost pressure, and role persistence.

A struggling high-salary player may therefore remain in the lineup longer because of organizational decision-making, but the salary itself does not mechanically reduce baseball skill.

## 16. Contract value and cash timing can be separated where rules allow

The system should be capable of distinguishing:
- headline nominal value;
- guaranteed amount;
- payment timing;
- options / opt-outs;
- current payroll burden;
- future payroll burden.

This is especially important for long-term, cross-league, and future-rule simulations. Do not expose unnecessary accounting detail in the default UI.

## 17. Salary inflation and league economics must remain separate from talent rating

Over decades, nominal salaries can rise as league revenues and economies change. A `5億円` salary must not represent the same percentile forever.

Contract evaluation should use era/league economic context, not a fixed nominal money scale.

## 18. Player / club risk preferences matter

Player examples:
- prefers guaranteed security;
- prefers shorter deal to re-enter market;
- accepts risk for an MLB/overseas opportunity;
- prioritizes role over money.

Club examples:
- willing to pay high AAV for short term;
- willing to guarantee length for lower annual cost;
- avoids long-term aging risk;
- accepts risk for scarce superstar talent.

These preferences should be continuous and contextual, not rigid archetype labels.

## 19. Posting / overseas path belongs in contract planning

A player who strongly wants MLB or another overseas league may care about the current club's future posting stance.

A club may use a future willingness to discuss posting as part of relationship / extension negotiation, subject to the governing rules. Posting remains a separate institutional process and can still fail to produce an overseas contract.

## 20. Failed market outcomes must be possible

Examples:
- player declares / seeks a move but desired offers do not appear;
- posting is approved but no acceptable overseas deal is reached;
- a player misjudges market demand;
- a club waits too long and loses leverage;
- a player returns to the previous league / club market after an unsuccessful attempt.

The market must not always resolve to the player's first preference.

## 21. Contract renewal / salary adjustment is distinct from FA

Ordinary annual salary renewal, extensions, FA, release, salary-reduction/free-contract routes, posting, and other institutional exits should remain distinct transaction states even if they share valuation infrastructure.

Do not collapse all contract changes into one generic negotiation screen.

## 22. Negotiation information is imperfect

The user should not see exact values such as `player accepts at 423 million`.

Instead, the AI / agent interface can report:
- `かなり前向き`;
- `金額より契約年数を重視しているようです`;
- `他球団も強く関心を示している可能性があります`;
- `現在の条件では合意は難しそうです`.

The user's assistant can be wrong when its market information is weak.

## 23. A player's market can change over time during the same offseason

Examples:
- another club fills the position;
- a competing player signs;
- injury changes demand;
- a trade changes a club's needs;
- an unexpected non-tender / release adds supply;
- a bidding club withdraws.

Therefore waiting can improve or worsen leverage.

## 24. CPU clubs must preserve alternatives

A CPU club should compare the targeted FA with:
- internal options;
- cheaper FA alternatives;
- trade candidates;
- foreign players;
- prospects;
- waiting until later.

This prevents irrational bidding wars for every top player.

## 25. The user may instruct negotiation strategy rather than micromanage every offer

Possible simple policies:
- `絶対に残したい`;
- `適正価格なら残留`;
- `短期契約優先`;
- `長期固定を狙う`;
- `役割保証には慎重`;
- `FA市場まで待つ`.

The assistant can generate offers and explain tradeoffs, while the user retains final authority unless the task is delegated.

## 26. CPU decision quality is not judged only by later outcome

A five-year deal can be rational ex ante and fail because of unpredictable injury or decline. A reckless contract can succeed by luck.

History / GM evaluation should distinguish decision quality at signing from realized outcome, consistent with trade evaluation principles.

## 27. Required future QA

Future scenario tests should include:
- early extension accepted vs rejected;
- contender vs rebuilding club valuation of the same FA;
- highest salary losing to a preferred role/location offer;
- role promise later becoming infeasible;
- extension failure changing trade-deadline behavior;
- bidding competition raising terms;
- market collapse after alternatives sign;
- failed posting / failed overseas market;
- high-salary sunk-cost pressure without direct skill penalty;
- user AI comparing trade-now vs FA-wait vs foreign alternative;
- agent strategies producing different but rational market paths;
- no hidden-truth access by CPU or user assistant.

## 28. Guardrails

- Do not reduce FA to salary-only bidding.
- Do not reveal exact hidden acceptance thresholds by default.
- Do not give CPU clubs omniscient future talent or injury knowledge.
- Do not make expensive contracts directly change baseball ability.
- Do not make player preferences permanent one-dimensional personality tags.
- Do not create unlimited contract clause micromanagement in the normal UI.
- Do not start implementation from this wall-talk document yet.

# Pennant player grievance / relationship / role conflict / trade-request wall-talk — 2026-08-26

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This document preserves the owner wall-talk that followed the 2026-08-25 handoff. It supplements existing identity, reputation, trade-market, FA/contract/agent, clubhouse-culture, and information-design documents. It does not create new canonical PW IDs.

## 1. Player agency is real but bounded

Players are career actors rather than passive roster objects. They may have career goals, role preferences, playing-time preferences, overseas ambitions, relationship concerns, and treatment expectations.

Separate:

- preference;
- request;
- negotiation / pressure;
- trade or exit intent;
- contractual / institutional right.

A player may strongly prefer shortstop or starting-pitcher work without having a legal right to refuse another assignment. Conversely, a contractual or institutional right can constrain the club regardless of mood.

## 2. Do not use one universal dissatisfaction meter

Represent dissatisfaction as cause-specific **Grievance** cases rather than one `morale = 32` scalar.

Candidate grievance families:

- `ROLE`: starter/reliever, regular/bench, batting order, defensive position;
- `PLAYING_TIME`: first-team/minor-team assignment and opportunity volume;
- `PROMISE`: role, posting, career-path, or other explicit expectation not honored;
- `VALUATION`: salary / organizational valuation disagreement;
- `CAREER_PATH`: MLB/overseas, conversion, starting-role challenge, etc.;
- `COMPETITIVE_DIRECTION`: contender vs rebuild / career-window mismatch;
- `RELATIONSHIP`: manager, GM, coach, teammate;
- `CULTURE`: organizational-culture mismatch;
- `TREATMENT`: explanation quality, demotion handling, veteran treatment, respect/fairness;
- `HEALTH`: medical, return-to-play, workload or treatment disagreement; detailed design belongs to the next health wall-talk.

Each grievance should retain its cause, desired resolution, severity/importance, duration, expectation source, discussion history, current resolution state, agent involvement, and information-publicity state where relevant.

## 3. Satisfaction, trust, fairness and exit intent are separate

A player can dislike his playing time while still trusting the club and believing the competition was fair. Another player can receive substantial playing time while distrusting the organization because explicit promises were repeatedly broken.

Do not collapse:

- current satisfaction;
- trust in manager/front office;
- perceived fairness;
- expectation that the issue can be solved internally;
- desire to leave.

This distinction is necessary for realistic retention, trade, FA and relationship behavior.

## 4. Expectations need provenance

The same role change has different meaning depending on where the expectation came from.

Possible expectation sources, from weaker to stronger, include:

- player self-expectation;
- media/public expectation;
- informal staff comment;
- explicit club explanation;
- FA/extension negotiation promise;
- contractual/institutional right.

`レギュラー争いに参加させる` is not equivalent to `レギュラーとして起用する`.

## 5. Promise and explanation memory persists

Club statements, promises, review dates, and renegotiated expectations must be stored in history.

Example:

- club says a reliever will be reconsidered for the rotation after the season;
- offseason passes without a genuine review;
- credibility/trust falls;
- later similar explanations carry less persuasive weight.

The player should evaluate both the immediate decision and the organization's historical credibility.

## 6. Explanation can mitigate conflict without solving the underlying preference

A club may be unable to provide the requested role. Clear, credible explanation can preserve trust even while dissatisfaction remains.

Conversely, repeatedly postponing an issue with empty explanations should worsen credibility.

This makes communication a real organizational variable without turning dialogue into a magic morale button.

## 7. Fair loss and unfair treatment must differ

If a player loses a role to a genuinely stronger competitor after a transparent competition, he may remain dissatisfied but accept the legitimacy of the decision.

If he believes the decision came from stale reputation, personal bias, broken promises, or unexplained fixed-role behavior, trust can fall much further.

CPU mistakes should therefore arise from the same evaluation, role, information, and communication failures already defined for managers rather than from random anti-player behavior.

## 8. Money does not erase every grievance

Cause-specific grievances require cause-relevant resolution.

- higher salary may improve valuation satisfaction but not solve a playing-time grievance;
- a batting-order change does not automatically solve a posting grievance;
- a role promise cannot repair a severe medical-trust dispute by itself.

Multiple grievances can coexist.

## 9. Career stage changes preferences

Player preferences are not permanently fixed personality tags. Career stage and experience can change priorities.

Examples:

- young player: development and playing opportunity;
- prime player: role, salary, contention, MLB challenge;
- veteran: continued playing time, championship chance, family/geography, old-club attachment, transition toward retirement/staff work.

## 10. Grievances escalate through a state process

Trade request should usually be the result of unresolved conflict rather than a random event.

Conceptual progression:

1. latent mismatch;
2. mild dissatisfaction;
3. informal expression;
4. formal meeting / discussion;
5. concrete improvement request;
6. internal exit intent;
7. formal trade request;
8. possible public/market escalation.

Not every grievance passes through every stage, and improvement can occur at any stage.

## 11. Private and public trade requests are different

A player may privately ask the club to explore opportunities without making a public demand.

Possible publicity states:

- private to player/agent/club;
- selectively communicated to interested clubs;
- rumor / partial public knowledge;
- public trade request.

Publicity can affect market leverage and competition, but public demand does not mechanically force a cheap trade.

## 12. Agent behavior connects grievance to the market

Agents can:

- encourage internal resolution;
- advise patience until FA;
- assess external demand;
- signal availability to other clubs;
- push for trade or role change;
- manage the timing/publicity of the dispute.

Agents operate with imperfect information and may misjudge the market.

## 13. Players also have imperfect beliefs about external options

A player can overestimate or underestimate his market, playing-time prospects, or fit elsewhere.

Information can come from agents, teammates, former teammates, national-team/All-Star relationships, media, prior inquiries, and career history.

A trade request can therefore fail to produce a desirable market.

## 14. Trade request is not always hostile

Allow amicable exit preferences.

Example: a blocked shortstop respects the club and manager but wants a regular role elsewhere. The club may agree that a move benefits the player's career.

Trust can remain high through the transaction, enabling later reunion or positive club reputation.

## 15. Trade request requires an outside-option belief

Unresolved grievance alone is not enough. Exit intent should also depend on whether the player believes an external path can improve his career.

Relevant influences include:

- internal resolution probability;
- expected market demand;
- remaining time to FA/other rights;
- geography/family;
- contention;
- role availability elsewhere;
- agent advice;
- player's tolerance for relocation/change.

## 16. Trade-request motives remain typed

Useful categories include:

- opportunity request;
- role request;
- competitive-window request;
- relationship breakdown;
- career-path request;
- mutual separation.

The motive should influence what destination actually resolves the issue.

## 17. Club can rationally refuse

Player satisfaction is not the club's only objective.

The club weighs:

- competitive value of accepting the request;
- cost to roster construction / other players;
- depth and future uncertainty;
- relationship/retention cost of refusal;
- trade market return;
- contract and institutional constraints.

A decision can be rational for the club even when it damages the player relationship.

## 18. Refusal does not directly reduce baseball ability

Possible consequences include:

- continued professional play despite dissatisfaction;
- trust decline;
- reduced extension/FA retention willingness;
- stronger future request;
- public escalation;
- agent relationship effects;
- later resolution after role/manager/roster changes.

Do not implement `trade request -> ability -5` or an equivalent direct stat penalty.

## 19. Requests can be withdrawn

A player may withdraw or soften an exit request after:

- manager change;
- role change;
- roster vacancy;
- new contract/expectation agreement;
- competitive improvement;
- changed personal priorities.

Trade-request status is not permanent.

## 20. Trade activity setting does not create grievances

The save-level trade-activity setting (`少ない / 普通 / 多い`) changes market friction/search activity, not player dissatisfaction or rationality.

A high-activity world may resolve blocked-player grievances through trades more often because more rational opportunities are explored; it does not manufacture more dissatisfaction.

## 21. Role scarcity should create real career pressure

Not all player goals can be satisfied simultaneously. Examples:

- more starting-pitcher candidates than rotation spots;
- multiple closer candidates;
- multiple major-league-caliber players at one position.

This scarcity should naturally connect role conflict to trade, FA, Active Draft, conversion, and minor-league assignment.

## 22. Relationships use a sparse graph

Do not maintain a full all-player-by-all-player friendship matrix.

Persist only meaningful relationships, for example:

- friendship / closeness;
- trust;
- mentor / mentee;
- respect;
- competitive rivalry;
- friction;
- severe conflict.

Friendship, professional trust, competition and conflict are distinct. A player can respect a manager without liking him personally, or be close friends with a positional rival.

## 23. Relationships have causal but indirect effects

Do not use `bad relationship -> meet -5`.

Relationships can affect:

- communication;
- mentorship;
- role acceptance;
- conflict mediation;
- adaptation/integration;
- trust in information;
- FA/trade information channels;
- willingness to remain with the organization.

## 24. Team-treatment events propagate selectively

One player's treatment must not become a universal clubhouse morale penalty.

Impact depends on:

- who knows what happened;
- relationship to the affected player;
- whether the observer sees the issue as relevant to his own future;
- whether the treatment appears fair;
- agent/subgroup connections.

Repeated treatment history can become club reputation.

## 25. Club reputation emerges from career treatment

History such as honoring role promises, supporting career moves, handling veterans respectfully, or repeatedly breaking commitments can create player/agent reputation.

Reputation can lag current reality and should interact with the existing clubhouse/FA information model.

## 26. Player-vs-player conflict is causal, not random flavor spam

Conflict can emerge from role competition, public criticism, discipline/standards differences, subgroup tensions, or accumulated treatment history.

Most interpersonal dislike should not affect on-field ability directly. Consequences should flow through communication, cohesion, role acceptance, mentorship, and related systems.

## 27. User-facing UI stays qualitative and selective

Do not require daily grievance management.

Most minor cases can be handled by staff and reported briefly. Important escalation can interrupt automation.

Example levels:

- minor: `起用について少し考えるところがあるようです`;
- meaningful: `先発での起用機会を希望しています`;
- serious: `代理人から起用方針について面談の申し入れがあります`;
- formal: `出場機会を求め、移籍希望を伝えてきました`.

Exact grievance/trust/exit-intent scalars remain hidden by default.

## 28. Conceptual state machine

```text
CAREER GOAL / EXPECTATION
        ↓
current-state GAP
        ↓
GRIEVANCE
        ↓
observe / express / discuss
        ↓
resolve / defer / worsen
        ↓
if deferred: review deadline and credibility memory
        ↓
unresolved + weak internal outlook + external option belief
        ↓
EXIT INTENT
        ↓
TRADE REQUEST (private or public)
        ↓
market search
        ↓
trade / stay / withdraw / wait for FA or other path
```

Resolved grievances leave a bounded historical trace rather than disappearing from relationship/reputation history completely.

## 29. Future QA

Scenario tests should eventually include:

- fair competition loss vs broken role promise;
- money failing to erase a playing-time grievance;
- clear explanation preserving trust despite continued dissatisfaction;
- repeated broken review promises reducing club credibility;
- amicable exit preference with high club trust;
- trade request with weak external demand producing continued stay;
- withdrawn request after manager/role change;
- trade-activity setting changing market resolution but not grievance generation;
- one player's unfair treatment affecting close/relevant peers more than unrelated teammates;
- CPU and user assistants having no hidden access to player true exit intent or other clubs' hidden willingness.

## 30. Guardrails

- No universal morale/grievance scalar as the core model.
- No random trade-request event as the primary mechanism.
- No direct grievance/relationship-to-base-ability penalty.
- No omniscient knowledge of player inner state.
- No assumption that satisfying every player request is optimal management.
- No assumption that every trade request is hostile.
- No implementation from this document yet.

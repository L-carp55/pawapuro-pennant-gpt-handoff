# Pennant clubhouse culture / FA fit wall-talk — 2026-08-25

Status: **OWNER WALL-TALK PRESERVED / IMPLEMENTATION NOT AUTHORIZED**

This file records design direction for team atmosphere, clubhouse culture, player cultural preferences, and their effects on FA/retention/role fit. It supplements the canonical PW ledgers and master design.

## 1. Do not model one universal `team mood` score

A single `mood = 82` where higher is always better is too gamey and collapses distinct cultures.

Represent clubhouse / organizational atmosphere as a multidimensional profile. Candidate dimensions include:

- discipline / strictness;
- psychological safety / supportiveness;
- openness / communication;
- competitiveness / internal pressure;
- informality / friendliness;
- hierarchy vs player autonomy;
- veteran-led vs youth-led social structure;
- tolerance for individuality;
- accountability / performance standards;
- stability vs volatility;
- role clarity;
- trust in manager/front office;
- team cohesion / fragmentation.

A culture can be healthy without being relaxed. `厳しく引き締まっている` and `和気あいあい` can both be attractive to different players.

## 2. Separate internal reality from external reputation

The game should distinguish:

1. actual current clubhouse culture;
2. player-specific lived experience;
3. outside reputation / media perception;
4. the FA player's current belief about that club.

An outside player does not automatically know the true clubhouse state. Information can come from former teammates, agents, national-team relationships, media, staff, scouts, prior visits/negotiations, and league reputation.

## 3. Culture emerges from people and history

Do not assign permanent franchise traits such as `Team X = harsh` or `Team Y = friendly`.

Culture should emerge from:

- manager personality / communication;
- coaching staff;
- GM/front-office policy;
- veteran leaders / captains / mood-makers;
- roster age structure;
- recent success / failure;
- role disputes;
- transaction treatment;
- scandals / governance;
- repeated promise-keeping or promise-breaking;
- staff/player turnover;
- foreign-player integration practices;
- organizational pressure and media environment.

Leadership changes or roster turnover can materially change the culture over time.

## 4. Players have culture preferences, not one `good mood` preference

Player preferences may include:

- likes a relaxed / friendly environment;
- prefers a disciplined, high-standard environment;
- wants strong veteran leadership;
- prefers freedom and autonomy;
- values direct communication;
- dislikes public criticism / pressure;
- enjoys intense internal competition;
- wants clear role definitions;
- prefers a young, energetic clubhouse;
- values family-friendly / stable environment;
- values international-player support;
- likes innovation/data-heavy environments or prefers traditional coaching.

Preferences should be continuous, uncertain, and may change with career stage and experience.

## 5. FA decision uses culture fit as one dimension

Culture fit joins, but does not replace:

- salary;
- contract length/security;
- role / playing time;
- contention;
- geography/family;
- favorite club;
- overseas ambition;
- manager/coach relationships;
- posting philosophy;
- organizational reputation;
- development/medical confidence.

A player can choose less money for a better perceived environment; another may ignore culture for money or role.

## 6. Culture mismatch should not directly reduce base ability

Do not implement `bad fit -> meet -5` or universal morale stat penalties.

Possible effects are contextual:

- role dissatisfaction;
- stress / recovery burden;
- trust and communication quality;
- willingness to ask for help;
- adaptation speed;
- contract-extension willingness;
- trade-request probability;
- willingness to accept role changes;
- clubhouse conflict / isolation;
- short-term readiness or pressure response where justified.

Performance effects, if any, should emerge through those mechanisms rather than arbitrary ability reductions.

## 7. Good fit can help without becoming a buff

A culturally comfortable player may:

- communicate problems earlier;
- adapt to new mechanics/roles more easily;
- recover psychologically after failure;
- accept coaching more readily;
- remain with the team on extension;
- mentor others effectively.

This is not a flat `chemistry +10` benefit.

## 8. Team cohesion is dynamic and local

Cohesion can vary within subgroups:

- pitchers vs position players;
- veterans vs young players;
- domestic vs foreign players;
- starters vs bench/blocked players;
- manager-aligned vs dissatisfied groups.

Avoid making every club a single perfectly unified social blob.

## 9. Veteran/mood-maker value connects here

A veteran can have value through:

- conflict mediation;
- helping new players integrate;
- maintaining routines under losing streaks;
- mentoring young players;
- helping foreign players adapt;
- supporting accountability / standards.

This creates real non-playing roster value without directly increasing teammates' ratings.

## 10. FA / agent information about culture is imperfect

Agents and players may infer culture from:

- former teammates;
- national-team / All-Star relationships;
- public reports;
- promises and negotiation tone;
- prior free-agent experiences;
- player treatment history;
- staff turnover;
- clubhouse reputation.

A reputation can lag reality. A club may improve internally but retain a bad external image, or vice versa.

## 11. Club can intentionally change culture, but not instantly

Management can influence culture through:

- manager/staff hiring;
- captain/veteran leadership choices;
- communication policy;
- role transparency;
- player-support infrastructure;
- disciplinary standards;
- foreign-player support;
- handling of disputes and failures.

A menu choice like `make clubhouse friendly` should not instantly alter culture. Change requires people, actions, time, and credible follow-through.

## 12. Different cultures can both produce winning teams

Do not encode one optimal culture.

A strict/high-accountability club can succeed if players fit and leadership is trusted.
A relaxed/friendly club can succeed if standards remain high enough and players self-regulate.

Problems arise more from mismatch, inconsistency, broken trust, unclear roles, toxic conflict, or weak accountability than from one style being inherently bad.

## 13. CPU clubs and managers can have culture strategy

CPU front offices may value culture fit differently when signing/trading players. A GM may avoid a talented player who is believed to be a poor fit, while another accepts that risk.

Again, CPU uses imperfect information and cannot read hidden personality truth.

## 14. User-facing UI should be qualitative

Possible club overview:

- 雰囲気: 引き締まっている / 比較的和やか / 競争が激しい
- 役割: 明確 / やや流動的
- コミュニケーション: 開放的 / 監督主導
- 信頼関係: 良好 / 一部に不満あり

Player/agent report examples:

- `厳しい環境を好む本人には合いそうです。`
- `本人は自由度の高い環境を重視しており、現在の球団文化とは少し合わない可能性があります。`
- `外部から見た評判は改善傾向ですが、情報の確度は高くありません。`

Do not expose exact hidden culture vectors by default.

## 15. Required future QA

Future tests should include:

- same offer, different player culture preferences -> different FA choices;
- same culture reputation but changed internal staff -> reputation lag;
- strict/high-accountability culture succeeding with compatible players;
- friendly culture succeeding without becoming a universal buff;
- culture mismatch causing retention/communication issues without direct stat penalties;
- veteran leader removal changing cohesion gradually rather than instantly;
- bad external reputation reducing FA interest even after internal reform until reputation catches up;
- CPU evaluating culture fit without hidden-truth access.

## 16. Guardrails

- No single universal `good mood` scalar as the core system.
- No permanent real-club culture stereotypes.
- No direct culture-to-base-rating modifier.
- No omniscient user/CPU knowledge of culture or personality.
- Culture is dynamic, multidimensional, and historically emergent.
- FA culture fit is one factor among many, not a deterministic rule.
- Do not begin implementation from this document yet.

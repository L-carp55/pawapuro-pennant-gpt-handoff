# Codex task — Pennant / Franchise player sentiment mining Wave 3

Date: 2026-08-25
Status: TARGETED RESEARCH SPEC ONLY / IMPLEMENTATION NOT AUTHORIZED

## Purpose

Collect and synthesize public player opinions about long-term season / pennant / franchise modes in:

- 実況パワフルプロ野球 / eBASEBALL パワフルプロ野球 (ペナント and directly adjacent roster-management systems);
- プロ野球スピリッツ (ペナント / season-management equivalents and directly adjacent systems);
- MLB The Show (Franchise and directly adjacent roster-management systems).

This is **not** a general review-score or game-sales study. The goal is to identify what real players repeatedly find fun, frustrating, unrealistic, shallow, tedious, exploitable, or missing in long-term baseball management, and convert those observations into design evidence for the Pawapuro Pennant World Simulation project.

This is the targeted Wave 3 that follows the news/history mechanism research. Do not reopen the full 323-cell global-news matrix. Focus only on player-experience evidence relevant to design decisions.

## Non-negotiable guards

- Do not modify canonical PW ledgers.
- Do not implement game code.
- Do not touch PD-001A, SP-079, shoulder appraisal, or speed canonical material.
- Do not treat social-media opinion as factual evidence about real players/teams or as proof of causal baseball mechanics.
- Do not infer hidden demographic or personal attributes of posters.
- Use only public, legitimately accessible material. Do not bypass login/paywall/access controls.
- Preserve source URL, platform, date when available, game/title/version context, and short paraphrase. Avoid unnecessary verbatim copying.
- Do not let one viral post or one community dominate the synthesis.

## Core research question

For each title family and each major management subsystem:

1. What do players repeatedly praise?
2. What do players repeatedly complain about?
3. What mechanics are considered unrealistic or easily exploitable?
4. What creates long-term save boredom, collapse, or loss of immersion?
5. What creates memorable long-term stories and replayability?
6. What information/UI is too opaque, too visible, too tedious, or too shallow?
7. What do users ask developers to add/change?
8. Which complaints are title-specific, and which recur across multiple games?
9. Which apparent consensus claims are actually weak or contradictory?
10. Which findings challenge or support the current Pawapuro Pennant design direction?

## Source families

Search broadly in Japanese and English. Candidate public sources include, when accessible:

- X / Twitter public posts and indexed public discussions;
- Reddit, especially MLB The Show communities and relevant baseball-game threads;
- YouTube videos and public comments where searchable/accessibly indexed;
- Japanese public blogs / note-style posts / review diaries;
- public forums and communities such as Operation Sports or equivalent long-form discussion boards;
- Steam / PlayStation / Nintendo / store reviews when they discuss the management mode in detail;
- public Q&A / community sites;
- 5ch or similar public forum material only as low-confidence anecdotal evidence, with explicit source-quality labeling;
- developer-community replies only when they contain genuine player feedback, not marketing copy.

Do not restrict the study to one platform. Search both Japanese and English terms and relevant abbreviations/misspellings.

## Time coverage

Prioritize modern versions first, but include older versions when they reveal persistent or removed features.

- Primary: roughly 2018-2026, with exact title/version/year recorded.
- Secondary historical comparison: roughly 2010-2017 when useful.
- Older examples only when repeatedly referenced as a lost/better feature or as evidence of a long-running issue.

First identify the relevant release/version names and mode terminology for each franchise before doing the deeper sweep.

## Required topic matrix

At minimum, cover these topics for each game family where applicable:

A. CPU roster construction / lineup / rotation / bullpen AI
B. trade frequency, logic, exploitability, market activity
C. FA / contracts / salary / retention / player movement
D. draft / amateur generation / prospect quality / player pool
E. player development, aging, decline, awakening, progression/regression
F. injuries, fatigue, condition, workload
G. player morale, roles, clubhouse / personality / relationships if present or requested
H. defense impact and simulation-result realism
I. statistical realism, league-wide distributions, era drift, long-save balance
J. foreign players / overseas movement / MLB-NPB interaction where applicable
K. farm / minors / 2軍 / development teams
L. rules / league customization / expansion / relocation / structural change
M. awards / records / history / Hall of Fame / legacy / immersion
N. finances / budgets / market / attendance / popularity
O. staff / scouting / analytics / delegation / assistant AI
P. UI / information visibility / menu burden / automation / simulation speed
Q. customization / commissioner-style controls / sliders / save settings
R. long-term replayability / dynasty / anti-snowball / CPU competitiveness
S. features players explicitly wish existed
T. features players praise and would not want removed

Add subtopics when recurring evidence demands it, but do not create dozens of trivial categories.

## Special questions tied to current owner wall-talk

Specifically test whether public player feedback supports, rejects, or complicates these current design ideas:

- PowerPro-like simple surface with deeper simulation underneath;
- trade activity setting `少ない / 普通 / 多い`;
- more active trade market while preserving rational CPU behavior;
- user-facing AI that recommends trade/FA targets and searches by desired profile;
- imperfect information rather than omniscient ratings/condition;
- displayed ability as club estimate rather than latent truth;
- defense having material impact on sim results;
- pitcher management using workload/quality/context rather than fixed pitch-count rules;
- clubhouse culture / player fit affecting FA decisions;
- evolving Active Draft and transaction rules;
- changing trade deadline through league governance;
- long-run global baseball level and market having positive secular growth by default;
- historical records and meaningful 20/50/100-year world evolution;
- CPU clubs seriously trying to win rather than acting as passive scenery.

Do not force feedback into these ideas. A finding may contradict the current direction.

## Sampling / bias controls

This is critical.

For each claimed theme, track:

- number of distinct sources/posts;
- number of distinct platforms/communities;
- number of distinct title versions/years;
- whether the theme is praise, complaint, request, exploit report, or neutral observation;
- whether it is repeated consensus, mixed, or isolated anecdote;
- whether later versions may have fixed the issue;
- whether the poster is discussing simulation-only play, manual play, online modes, or mixed modes;
- whether the claim is actually about the pennant/franchise mode rather than general gameplay.

Do not count reposts, quoted duplicates, SEO copies, or multiple comments repeating one source as independent evidence.

Use a confidence taxonomy such as:

- STRONG_RECURRENT: repeated across multiple independent sources/platforms/versions;
- MODERATE_RECURRENT: repeated but platform/version-limited;
- MIXED_CONTESTED: meaningful disagreement or strong trade-off;
- VERSION_SPECIFIC: clearly tied to a particular release;
- ISOLATED_ANECDOTE: interesting but not generalizable;
- INSUFFICIENT_EVIDENCE.

Never convert raw mention count directly into design priority.

## Parallel execution

Use parallel independent lanes. Recommended minimum 12 workers plus independent QA.

Suggested lanes:

1. PowerPro Japanese X/public SNS — current versions
2. PowerPro Japanese long-form/forums/blogs — current versions
3. PowerPro historical/lost-feature complaints
4. Prospi Japanese X/public SNS
5. Prospi long-form/forums/blogs
6. MLB The Show Reddit current versions
7. MLB The Show Operation Sports / long-form franchise community
8. MLB The Show historical/lost-feature complaints
9. cross-game trade/FA/CPU-AI comparison
10. cross-game progression/aging/injury/stat-sim comparison
11. cross-game UI/delegation/customization/long-save replayability
12. explicit feature-request mining across all three families
13. independent red-team / QA (separate from generators)

Workers must preserve receipts: queries used, platforms searched, title/year scope, sources retained, sources rejected, and why search was considered sufficient or still thin.

## Output artifacts

Create at least:

### 1. Evidence index TSV

Suggested fields:

- evidence_id
- game_family
- title_version
- mode
- source_date
- platform
- source_url
- language
- topic
- sentiment_type (`PRAISE`, `COMPLAINT`, `REQUEST`, `EXPLOIT`, `TRADEOFF`, `OBSERVATION`)
- concise_paraphrase
- user_impact
- long_save_relevance
- source_quality
- duplicate_group
- notes

### 2. Theme ledger TSV

One row per synthesized theme, with:

- theme_id
- theme_title
- games_affected
- topics
- supporting_evidence_ids
- contradicting_evidence_ids
- recurrence_class
- version_scope
- likely_root_problem
- current_project_coverage (`ALREADY_COVERED`, `PARTIAL_EXTENSION`, `NEW_CANDIDATE`, `CONTRADICTS_CURRENT_DIRECTION`, `LOW_VALUE`, `INSUFFICIENT_EVIDENCE`)
- related PW IDs / owner-walltalk docs **with semantic text verification, not ID guessing**
- design_implication
- recommended_owner_question
- priority_preliminary

Do not directly create new canonical PW IDs.

### 3. Game-by-game synthesis Markdown

For each of PowerPro, Prospi, MLB The Show:

- top recurrent strengths;
- top recurrent pain points;
- long-save failure modes;
- most requested missing features;
- especially divisive features;
- version-specific issues that should not be generalized;
- features from older releases players want restored;
- lessons worth copying;
- lessons worth avoiding.

### 4. Cross-game comparison matrix

Rows = topic areas; columns = three game families. Record what players praise/criticize and how consistent the evidence is.

### 5. Design challenge memo

Explicitly answer:

- Which current project assumptions are most strongly supported by player feedback?
- Which are contradicted or need calibration?
- What recurring user pain exists that the current 260 PW + wall-talk material still does not cover?
- Which issues are usability/UI problems rather than simulation-depth problems?
- Which features sound attractive in requests but create obvious complexity/frustration risks?
- What should be owner-wall-talked before implementation?

### 6. Independent QA / audit

Independent checker must verify:

- source URLs exist / are public where possible;
- paraphrases match source meaning;
- no quote inflation;
- no duplicate/repost inflation;
- title/version context is not lost;
- general gameplay complaints are not mislabeled as Pennant/Franchise feedback;
- Japanese and English coverage both exist;
- all three game families have meaningful coverage;
- no single platform dominates conclusions without being labeled;
- contradictory feedback is preserved;
- current-project mappings use semantic text, not loose ID ranges;
- `NEW_CANDIDATE` is not forced to zero or inflated;
- source-quality and recurrence classifications are internally consistent.

Final QA verdict should distinguish schema/structural PASS from evidence thinness. `PASS_WITH_BLOCKERS` is acceptable when coverage is honest.

## Stopping rule

Do **not** attempt to scrape the whole internet. Stop broad searching when:

- each game family has multiple independent source families;
- every high-priority topic has at least been deliberately searched;
- high-impact recurrent themes have cross-source corroboration or are explicitly labeled thin/contested;
- additional searches mainly reproduce already-captured themes;
- unresolved gaps are listed as blockers rather than hidden.

The goal is thematic saturation for design decisions, not maximal post count.

## Final deliverable

Commit and normally push all research artifacts to a dedicated research branch. Do not merge into canonical design automatically. Report:

- starting SHA;
- final/remote SHA;
- evidence-row count;
- synthesized-theme count;
- breakdown by game/platform/topic/recurrence class;
- NEW/PARTIAL/CONTRADICTS counts;
- strongest 10 cross-game findings;
- top unresolved evidence gaps;
- independent QA verdict.

Stop after push. Owner/browser GPT performs the design synthesis and decides what enters canonical requirements.
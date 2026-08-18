# SP-102 — Targeted 2ch/5ch-style baseball video comment rescue

Status: **BLOCKED_DEPENDENCY / RUN ONLY AFTER SP-101 / OWNER-REVIEW BLOCKER**

Date: 2026-08-18

Scope: **走力のみ。肩力・SP-078 owner verdict・SP-079 final ratingは対象外。**

## 1. Objective

After every structured, physical, statistical, MLB The Show, PowerPro-trajectory, transition, ordinal, scouting and existing Community route has been executed in SP-101, collect and analyze comments on Japanese baseball discussion videos—especially 2ch/5ch-style summary videos and other high-comment fan-analysis videos—for only the players whose speed appraisal remains low-confidence, unstable or materially conflicted.

This is a **last-mile targeted rescue lane**, not a global substitute for direct evidence and not a reason to delay SP-101 by crawling all videos for all 100 players.

## 2. Why this source may add information

Recent Japanese baseball discussion videos can contain large volumes of audience observations about:

- whether a player is physically fast or slow;
- whether speed has declined after age or injury;
- whether a player is fast but poor at stealing or baserunning decisions;
- relative comparisons between teammates or contemporaries;
- repeated observations of first-step quickness, infield-hit speed, acceleration or full-effort running;
- whether a PowerPro rating appears stale, too high or too low;
- links or references to specific games, clips or primary measurements.

The value is not the raw number of comments. The value is the possibility of finding **specific, time-indexed, player-level observations** or discovering better primary sources.

## 3. Exact sequence

1. Complete SP-101 and all mandatory P0 inference routes.
2. Produce the final SP-101 current-100 evidence packet, route-ablation results and decision-use matrix.
3. Freeze `outputs/derived/sp101_residual_low_confidence_target_set.json` before any SP-102 search.
4. Run SP-102 only on the frozen target set.
5. Recompute affected players and then rerun the all-100 consistency/decision-use QA.
6. Only after SP-102 is complete or closes with a measured zero-target/zero-usable-evidence finding may a new SP-078 proposal be generated.

## 4. Target selection contract

A player is eligible when at least one of the following remains after SP-101:

- final appraisal confidence is `LOW` or `VERY_LOW`;
- the uncertainty interval is in the widest predeclared tier;
- at least two independent route families disagree on direction or ordinal band;
- route-family ablation changes the owner-review recommendation or practical band;
- acceleration/end-to-end evidence is materially missing and the decision remains sensitive;
- The Show-implied, PowerPro-behavior and independent physical estimates materially disagree;
- a current injury/age/trajectory question remains unresolved;
- the owner explicitly adds the player.

A player is not targeted merely because many videos exist. High-confidence, route-stable players are excluded unless the owner explicitly reopens them.

Every one of the 100 players must receive one target-selection state:

- `TARGETED_LOW_CONFIDENCE`
- `TARGETED_MATERIAL_CONFLICT`
- `TARGETED_OWNER_OVERRIDE`
- `NOT_TARGETED_SUFFICIENT_CONFIDENCE`
- `NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN`

## 5. Source universe

Search may include:

- 2ch/5ch-style baseball summary videos;
- fan discussion and player-analysis videos;
- game-specific reaction videos;
- team-focused channels;
- highlight or retrospective videos when the comments contain player-level speed observations;
- older videos when needed for a player-specific trajectory.

The default emphasis is recent seasons, but publication date and the season/event being discussed must be recorded separately.

Search queries must cover:

- Japanese name, spacing variants and common nicknames;
- foreign-player Japanese/English/Romanized names;
- current and former team names;
- `足`, `速い`, `遅い`, `俊足`, `走力`, `一塁到達`, `内野安打`, `加速`, `全力疾走`, `盗塁`, `走塁`, `代走`, `衰え`, `怪我`;
- player-versus-player comparison queries where an ordinal conflict exists.

## 6. Keep source layers separate

The following are different evidence objects and must not be merged:

1. `VIDEO_NARRATION_OR_EDITORIAL`
2. `QUOTED_2CH_5CH_THREAD_TEXT`
3. `YOUTUBE_TOP_LEVEL_COMMENT`
4. `YOUTUBE_COMMENT_REPLY`
5. `LINKED_PRIMARY_SOURCE_DISCOVERED_IN_COMMENT`

A video narration quoting a thread and comments reacting to that narration are not independent confirmations of the same claim.

When a comment links to a game clip, official article, measurement or player statement, collect the linked source into its proper primary/secondary lane. The comment becomes a discovery receipt, not the physical evidence itself.

## 7. Semantic classes

Every retained claim must be classified into one of:

- `CURRENT_REALWORLD_SPEED_PHYSICAL`
- `CURRENT_INITIAL_ACCELERATION_OR_H2F`
- `CURRENT_END_TO_END_OR_FULL_EFFORT`
- `CURRENT_TECHNIQUE_CONTEXT`
- `HISTORICAL_TRAJECTORY`
- `INJURY_AGE_DECLINE_CONTEXT`
- `RELATIVE_ORDINAL_COMPARISON`
- `CURRENT_POWERPRO_RATING_OPINION`
- `PRIMARY_SOURCE_DISCOVERY`
- `AMBIGUOUS_TIME_OR_PLAYER`
- `REPOST_OR_QUOTE_NOT_INDEPENDENT`
- `MEME_SARCASM_JOKE`
- `GENERAL_FANDOM_NO_SPEED_CLAIM`
- `SPAM_OR_BOT`

Physical speed, stealing technique, baserunning aggression and PowerPro-rating opinion must remain separate.

## 8. Evidence role and maximum influence

An individual anonymous comment is low-confidence contextual evidence. It is never a direct measurement and cannot by itself produce a numerical speed rating.

Allowed uses:

- support or contradict an existing direction;
- separate physical speed from stealing/baserunning technique;
- identify a current decline or recovery question;
- add an ordinal edge;
- narrow or widen confidence when independent event clusters agree or disagree;
- discover a better primary source;
- rescue a low-confidence directional conclusion when multiple specific, time-aligned and independent clusters agree.

Not allowed:

- majority-vote rating assignment;
- treating likes or reply counts as independent evidence;
- multiplying identical comments across channels;
- treating the video title/thumbnail as an observation;
- converting “速い/遅い” directly into a PowerPro point;
- upgrading comment-only evidence to high confidence;
- using comment identity or personal profile information.

A comment-only route may at most create a `LOW_CONFIDENCE_DIRECTIONAL_RESCUE`. A stronger conclusion requires corroboration from a non-comment source family.

## 9. Independence, deduplication and priming controls

The unit of independence is not one comment. Claims must be clustered by:

- player;
- referenced season/game/event;
- video;
- channel;
- thread;
- near-duplicate phrase/template;
- source layer;
- transient same-author cluster.

Required controls:

- exact and semantic near-duplicate removal;
- quoted-thread and narration/comment dependency marking;
- same-channel and same-event clustering;
- meme/template phrase detection;
- title/thumbnail priming flag;
- sarcasm/irony review;
- reactions retained only as `reaction_volume`;
- repeated claims from one video never counted as many independent origins.

Persist no public username. When same-author detection is needed, use a non-reversible, run-scoped cluster token and discard the source identifier after QA.

## 10. Collection method and platform compliance

Prefer the official YouTube Data API for reproducible comment collection. Record video IDs, comment IDs, timestamps, parent/reply relationships, retrieval time and source URL. Retrieve full replies when the thread response is relevant.

Do not circumvent disabled comments, private/deleted videos, access restrictions or quota controls. Do not shard one use case across projects to evade quota. Follow current YouTube API terms, privacy and storage requirements.

Commit normalized evidence, hashes, short necessary excerpts, classifications and source receipts. Do not commit unnecessary personal-profile data or build commenter profiles.

## 11. Required outputs

- `outputs/derived/sp101_residual_low_confidence_target_set.json`
- `outputs/derived/sp102_video_candidate_manifest.json`
- `outputs/derived/sp102_video_comment_collection_manifest.json`
- `outputs/derived/sp102_video_comment_normalized.jsonl`
- `outputs/derived/sp102_origin_event_clusters.json`
- `outputs/derived/sp102_player_evidence_summary.json`
- `outputs/derived/sp102_primary_source_discovery_receipts.json`
- `outputs/derived/sp102_decision_use_and_ablation.json`
- `outputs/derived/sp102_coverage_qa.json`
- `docs/audits/sp102_targeted_video_comment_rescue.md`

## 12. Required per-player outputs

For every frozen target:

- target reason and pre-rescue confidence;
- query set and searched video denominator;
- videos/comments/replies retrieved;
- source-layer counts;
- independent origin/event-cluster count;
- physical/technique/trajectory/ordinal/rating-opinion claims;
- contradictory claims;
- linked primary sources discovered;
- final use state:
  - `CHANGED_DIRECTION`
  - `SUPPORTED_EXISTING_DIRECTION`
  - `CONTRADICTED_EXISTING_DIRECTION`
  - `NARROWED_UNCERTAINTY`
  - `WIDENED_UNCERTAINTY`
  - `DISCOVERED_PRIMARY_SOURCE`
  - `AVAILABLE_NOT_DECISION_EFFECTIVE`
  - `NO_USABLE_EVIDENCE`;
- before/after recommendation, interval and confidence;
- exact claim/event/source provenance.

## 13. Parallel-agent plan

Use separate writers and parent-only integration.

- **Agent A — Target freeze and information-gain ranking**
- **Agent B — Video-universe discovery and channel-diversity manifest**
- **Agent C — Official-API comment/reply collection and compliance receipts**
- **Agent D — Semantic classification, sarcasm/template detection and source-layer separation**
- **Agent E — Origin/event clustering, independence QA and primary-source promotion**
- **Agent F — Player-level decision-use integration and before/after ablation**
- **Agent G — Independent red team**

No two agents edit the same final file. The parent agent integrates and writes the final audit.

## 14. QA requirements

- target set is frozen before search;
- no high-confidence global crawl unless owner-overridden;
- every target has an explicit coverage state;
- every non-target has an explicit selection state;
- video narration, quoted thread and comments remain separate;
- no username/profile persistence;
- no comment counted as direct physical measurement;
- no comment/like/reply volume treated as independent origins;
- near-duplicate and same-event inflation = 0 after clustering;
- canaries for sarcasm, memes, copied comments, same-author repeats, title priming and wrong-season references;
- comments-disabled/deleted/unavailable states are explicit missingness, not negative evidence;
- no comment-only high-confidence verdict;
- any promoted primary source is independently fetched and classified;
- player-specific before/after decision-use receipts exist;
- rerun is deterministic given a frozen source snapshot;
- important negative findings and failed searches are persisted to GitHub.

## 15. Definition of Done

SP-102 is complete only when:

1. SP-101 is `DONE_VALIDATED` and the residual target set is frozen;
2. all frozen targets are searched with explicit denominators;
3. source-layer, deduplication, independence and privacy QA pass;
4. every target has a player-specific decision-use receipt;
5. zero-target and zero-usable-evidence outcomes are allowed only as measured negative findings;
6. affected players and the full 100-player consistency checks are rerun;
7. the canonical SP-078 owner ledger remains empty;
8. no SP-079 or shoulder artifact is created;
9. all important results, constraints and negative findings are committed and pushed.

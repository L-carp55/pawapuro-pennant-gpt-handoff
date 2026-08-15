# YouTube semantic / candidate QA — Community Recollection V3

- Run: `2026-08-14T17:16:14.807485Z`
- Scope: SP-033 / SP-034 YouTube semantic and candidate QA only.
- X / SP-035: **not touched; separated to Grok lane**.
- Writes made by this run: this audit and its paired JSON only; registry and common final artifacts were not edited.

## Verdict

- Regression A–G: **PASS** (7/7 cases).
- Input mode: `fresh`; candidate extraction: `2171` / `2171` target rows.
- Contextual claim triage: `1972`; sarcasm review: `61`; identity review: `268`.
- Distinct current-100 players mapped: `24`.
- Common schema required-field check: **PASS**; context retained title/parent/root/reply = `2171/1029/2171/648` candidate rows.
- These are semantic-review and QA dispositions, not final owner acceptance or a Speed Gate close.

## Inputs and method

- Legacy classification corpus: `outputs\derived\sp033_034_youtube_comment_classification_20260813.jsonl` (7145 rows).
- Legacy recovered context: `outputs\derived\speed_youtube_official_comments_recovered_20260813.jsonl` (8715 rows).
- Active target/context rows: `2171` / `38455`.
- Fresh inputs: `2` files; fresh candidate rows `2171`, fresh raw comment rows `40626`.
- Existing raw lane manifests: PowerPro `3`, Prospi `7` rows.
- Current-100 master: `outputs\derived\speed_2026_100_owner_review_master_20260813.json` (100 rows).
- Candidate prefilter is recall-first. Semantic fields are derived from interacting evidence across comment, title, parent, root and direct replies; regex terms are signals, not the final disposition.
- Full-name, unique-surname, alias, parent/root and title identity routes are recorded separately. Ambiguous or ironic cases remain review candidates.

## Regression A–G

| Case | Source | Result | Key observed fields |
|---|---|---|---|
| A | existing_7145_corpus | **PASS** | player=ビシエド, identity_method=comment_alias, identity_confidence=MEDIUM, claim_lane=RATING_POWERPRO, rating_direction=TOO_HIGH, speed_concept=PURE_SPEED, discourse=sarcasm_possible, semantic_review_disposition=REVIEW_REQUIRED_SARCASM |
| B | existing_7145_corpus | **PASS** | player=大谷翔平, identity_method=comment_alias, identity_confidence=MEDIUM, claim_lane=RATING_PROSPI, rating_direction=EXPLICIT_PROPOSED_VALUE, speed_concept=PURE_SPEED, discourse=rhetorical, explicit_rating_value=A, explicit_rating_grade=A, semantic_review_disposition=CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW |
| C | existing_7145_corpus | **PASS** | player=大谷翔平, identity_method=video_title_alias, identity_confidence=MEDIUM, claim_lane=RATING_PROSPI, rating_direction=TOO_LOW, speed_concept=PURE_SPEED, discourse=joke_but_claim_present, explicit_rating_value=B, explicit_rating_grade=B, semantic_review_disposition=CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW |
| D | existing_7145_corpus | **PASS** | player=大谷翔平, identity_method=video_title_alias, identity_confidence=MEDIUM, claim_lane=RATING_PROSPI, rating_direction=EXPLICIT_PROPOSED_VALUE, speed_concept=PURE_SPEED, discourse=literal, explicit_rating_value=84, explicit_rating_number=84, semantic_review_disposition=CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW |
| E | paired_existing_7145_corpus | **PASS** | paired_identity_methods=['comment_alias', 'video_title_alias'], players=['大谷翔平', '大谷翔平'] |
| F | existing_7145_corpus | **PASS** | player=山川 穂高, canonical_player_id=21425139, identity_method=comment_surname, identity_confidence=MEDIUM, claim_lane=PHYSICAL_OBSERVATION, rating_direction=UNCLEAR, speed_concept=PURE_SPEED, discourse=sarcasm_possible, semantic_review_disposition=REVIEW_REQUIRED_SARCASM |
| G | existing_7145_corpus | **PASS** | player=清原和博, identity_method=comment_alias, identity_confidence=MEDIUM, claim_lane=RATING_PROSPI, rating_direction=EXPLICIT_PROPOSED_VALUE, speed_concept=PURE_SPEED, discourse=rhetorical, explicit_rating_value=B74, explicit_rating_grade=B, explicit_rating_number=74, semantic_review_disposition=CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW |

## Lane separation

| Field | Count |
|---|---:|
| GAMEPLAY_MECHANICS | 132 |
| MIXED | 505 |
| NOISE | 199 |
| PHYSICAL_OBSERVATION | 27 |
| RATING_POWERPRO | 6 |
| RATING_PROSPI | 1302 |

## Old 7,145-corpus false-negative measurement

- Potential old-classifier false negatives rescued into candidate review: `101`.
- This is a measured triage gap, not a gold-standard recall estimate: the repository has no complete human-labeled truth set for all 7,145 comments.

| Sample | Old labels | New lane | Identity | Text |
|---|---|---|---|---|
| YT-RECOVER-qVl61GKQNhE-UgzXRgwQBy1InAF_zYx4AaABAg | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 柳田 悠岐 | 柳田が走力AだったんだからAのせてほしかったな |
| YT-RECOVER-qVl61GKQNhE-UgzXRgwQBy1InAF_zYx4AaABAg.A9rH9crbLCAA9rJE_kbGDm | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 柳田 悠岐 | 全盛期柳田が走力80だから大谷がA乗るのはなさそう |
| YT-RECOVER-t-0dgSQckqQ-UgwqN63b_dAjoTGN0Ep4AaABAg.ACTKzrz247fACTMqcXCPKc | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 山川 穂高 | めっちゃ欲しいけど山川おかわり中西カブレラ誰と変えるかめっちゃ悩むわ |
| YT-RECOVER-ZlhjLHzUt0A-UgyIfblGe38FvnvQVKN4AaABAg | JOKE_OR_NOISE | RATING_PROSPI | 大谷翔平 | これパワーAはもちろん、走力Bにも不満あったんだよね笑 |
| YT-RECOVER-jdfUYFjoQV0-UgxWgos43rV-Vm2LfsR4AaABAg.A6ptJ_OhIU8A6qQ-YzMmve | UNCLASSIFIED_CONTEXT | RATING_PROSPI | unresolved | まあミート走力87の同値、パワー78のバケモンがいたからセーフセーフ / 特能もアベレージヒッターでミート97! / そんなキャラがいたセレクションだからいいに決まってるでしょ! |
| YT-RECOVER-nXfOipyoX6k-Ugx8FlZgFzYY4bfnEyB4AaABAg | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | 大谷走力Aだろ |
| YT-RECOVER-qVl61GKQNhE-UgwUKeliEajnW1NNbo54AaABAg | JOKE_OR_NOISE | RATING_PROSPI | 大谷翔平 | 予想 ミート80 パワー90 走力 79 / 超アーチスト / 広角打法 / 別次元?笑 |
| YT-RECOVER-qVl61GKQNhE-UgwUKeliEajnW1NNbo54AaABAg.A9rDwfAVeiQA9rECBiYY_h | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | 惜しい! |
| YT-RECOVER-qVl61GKQNhE-UgwUKeliEajnW1NNbo54AaABAg.A9rDwfAVeiQA9rIpQFGfXV | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | 大分ニアピン |
| YT-RECOVER-qVl61GKQNhE-UgwUKeliEajnW1NNbo54AaABAg.A9rDwfAVeiQA9tuv2mwn9c | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | @メルヘンとグレーデル 一番惜しい |
| YT-RECOVER-qVl61GKQNhE-UgxnQu-cGjmDdj0-arZ4AaABAg | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | ミート82パワー90走力85 / 特能超アーチスト、二刀流改、広角打法 |
| YT-RECOVER-qVl61GKQNhE-UgxnQu-cGjmDdj0-arZ4AaABAg.A9qkncHhlQ-A9qpEg2UEF6 | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | アリエール |
| YT-RECOVER-qVl61GKQNhE-UgxnQu-cGjmDdj0-arZ4AaABAg.A9qkncHhlQ-A9r8nL92m6U | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | 特能は超アーチスト、広角打法改、二刀流or存在感だと思います |
| YT-RECOVER-qVl61GKQNhE-UgxnQu-cGjmDdj0-arZ4AaABAg.A9qkncHhlQ-A9rAuchAFGH | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | 超アーチスト◎ / 盗塁・改 / 存在感 |
| YT-RECOVER-qVl61GKQNhE-UgxnQu-cGjmDdj0-arZ4AaABAg.A9qkncHhlQ-A9rE7O2pnFt | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | おしい |
| YT-RECOVER-qVl61GKQNhE-Ugxugp5GHunpC9R7e614AaABAg | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | ミート83パワー90走力86 / 超アーチスト / 広角打法 / 二刀流 |
| YT-RECOVER-qVl61GKQNhE-Ugxugp5GHunpC9R7e614AaABAg.A9qovSSa9pkA9qp2NAPx0m | JOKE_OR_NOISE | RATING_PROSPI | 大谷翔平 | 特能二刀流草 |
| YT-RECOVER-qVl61GKQNhE-Ugyrh4Wz9tF9s4cc0ZB4AaABAg.A9qkOxTLOO8A9rCA2iIaEv | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | ミート87パワー90走力87 / 特殊能力 / 超showtime / アーチスト改 / 広角打法 |
| YT-RECOVER-qVl61GKQNhE-UgzDrNWQm8nyivos5jN4AaABAg | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | 予想ミート83 パワー90 走力83 |
| YT-RECOVER-qVl61GKQNhE-UgzDrNWQm8nyivos5jN4AaABAg.A9qD4ngFqPBA9qiUxkAVfA | UNCLASSIFIED_CONTEXT | RATING_PROSPI | 大谷翔平 | おっいいですねー |

## Coverage and limits

- Distinct videos in the active target candidate output: `39`; legacy 7,145-corpus baseline remains in the false-negative section.
- Fresh rerun command: `python scripts\speed_community_v3_youtube_semantic.py --fresh-input outputs\derived\speed_community_v3_powerpro_raw_20260815.jsonl outputs\derived\speed_community_v3_powerpro_candidates_20260815.jsonl outputs\derived\speed_community_v3_prospi_raw_20260815.jsonl outputs\derived\speed_community_v3_prospi_candidates_20260815.jsonl`.
- This script does not perform fresh official-channel discovery or comment retrieval; discovery/retrieval remains a separate lane task. No fresh-discovery count is claimed here.
- Existing recovered comments are explicitly marked as bounded public recovery; unavailable/paginated remainder is not treated as negative evidence.
- SP-033 and SP-034 registry status was not changed and remains outside this semantic QA write scope.

\n

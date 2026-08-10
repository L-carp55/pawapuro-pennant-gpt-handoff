# 2026 NPB 走力 — Grok-X SNS Rescue 監査

- 実施日: 2026-08-10
- 対象: canonical 19人のみ。PowerPro residual / game rating / 数値査定は使用していない。
- baseline: `data/normalized/speed_2026_sns_consensus_sources.json`（SHA-256: `dfe1f9c642d9d2396a649e80f4693ed52a91134a97d07bd050eadd98fa736a9b`）を上書きせず、`GROK_X_SUPPLEMENT`を別 provenance で追加。

## 検索・回収

- x_search query count: 175（成功 175）
- raw X hits（URL出現数）: 267
- unique X post candidates: 191
- accepted X posts: 41
- rejected X posts: 150
- duplicate existing posts/origins: 1
- post ID/URL identity conflicts: 3
- pairwise Type B queries: 4; raw hits: 0（全て Nothing found）

## 独立性と分類

- Grok-X単独で independent X >=2: 11人、>=3: 7人
- 既存SNSと統合後 independent X >=2: 14人、>=3: 7人
- strict SNS requirement（一般ラベル・質問を除く独立X 2起源以上）達成: 11/19人
- video queue: pre-Grok 19人 → post-Grok 12人

| 選手 | raw候補 | accepted X | independent X | qualifying X | other SNS | total SNS | pre | Grok-only | combined | video |
|---|---:|---:|---:|---:|---:|---:|---|---|---|---|
| 西野 真弘 | 13 | 2 | 2 | 1 | 0 | 2 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | YES |
| カリステ | 4 | 1 | 1 | 0 | 0 | 1 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | YES |
| 土田 龍空 | 13 | 4 | 4 | 4 | 1 | 5 | INSUFFICIENT_SNS_EVIDENCE | MIXED_CONSENSUS | MIXED_CONSENSUS | YES |
| 大島 洋平 | 14 | 1 | 1 | 1 | 0 | 1 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | YES |
| 木下 拓哉 | 19 | 5 | 5 | 5 | 1 | 6 | INSUFFICIENT_SNS_EVIDENCE | SUPPORTS_CURRENT_ORDINAL | SUPPORTS_CURRENT_ORDINAL | NO |
| 友杉 篤輝 | 6 | 3 | 3 | 3 | 0 | 3 | INSUFFICIENT_SNS_EVIDENCE | METRIC_CONSTRUCT_CONFLICT | METRIC_CONSTRUCT_CONFLICT | YES |
| 岡 大海 | 8 | 4 | 4 | 4 | 0 | 4 | INSUFFICIENT_SNS_EVIDENCE | SUPPORTS_CURRENT_ORDINAL | SUPPORTS_CURRENT_ORDINAL | NO |
| 藤岡 裕大 | 9 | 3 | 3 | 2 | 0 | 3 | INSUFFICIENT_SNS_EVIDENCE | TEMPORAL_CHANGE_SUPPORTED | TEMPORAL_CHANGE_SUPPORTED | NO |
| 外崎 修汰 | 6 | 1 | 1 | 1 | 0 | 1 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | YES |
| 矢野 雅哉 | 6 | 1 | 1 | 0 | 0 | 1 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | YES |
| 野間 峻祥 | 7 | 1 | 2 | 0 | 0 | 2 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | YES |
| 並木 秀尊 | 12 | 1 | 2 | 2 | 0 | 2 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | SUPPORTS_CURRENT_ORDINAL | NO |
| 中村 悠平 | 13 | 1 | 1 | 1 | 0 | 1 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | YES |
| 塩見 泰隆 | 12 | 3 | 3 | 3 | 1 | 4 | INSUFFICIENT_SNS_EVIDENCE | SUPPORTS_CURRENT_ORDINAL | SUPPORTS_CURRENT_ORDINAL | NO |
| 鈴木 大地 | 9 | 1 | 2 | 2 | 0 | 2 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | SUPPORTS_CURRENT_ORDINAL | NO |
| 林 琢真 | 17 | 3 | 3 | 2 | 0 | 3 | METRIC_CONSTRUCT_CONFLICT | METRIC_CONSTRUCT_CONFLICT | METRIC_CONSTRUCT_CONFLICT | YES |
| 梶原 昂希 | 11 | 2 | 2 | 1 | 1 | 3 | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | INSUFFICIENT_SNS_EVIDENCE | YES |
| 丸 佳浩 | 8 | 2 | 2 | 2 | 0 | 2 | INSUFFICIENT_SNS_EVIDENCE | TEMPORAL_CHANGE_SUPPORTED | TEMPORAL_CHANGE_SUPPORTED | NO |
| 梅野 隆太郎 | 4 | 2 | 2 | 2 | 0 | 2 | INSUFFICIENT_SNS_EVIDENCE | MIXED_CONSENSUS | MIXED_CONSENSUS | YES |

## 分類件数

```json
{
  "before": {
    "INSUFFICIENT_SNS_EVIDENCE": 18,
    "METRIC_CONSTRUCT_CONFLICT": 1
  },
  "grok_x_only": {
    "INSUFFICIENT_SNS_EVIDENCE": 10,
    "METRIC_CONSTRUCT_CONFLICT": 2,
    "MIXED_CONSENSUS": 2,
    "SUPPORTS_CURRENT_ORDINAL": 3,
    "TEMPORAL_CHANGE_SUPPORTED": 2
  },
  "combined": {
    "INSUFFICIENT_SNS_EVIDENCE": 8,
    "METRIC_CONSTRUCT_CONFLICT": 2,
    "MIXED_CONSENSUS": 2,
    "SUPPORTS_CURRENT_ORDINAL": 5,
    "TEMPORAL_CHANGE_SUPPORTED": 2
  }
}
```

## 除外・負の所見

- 盗塁技術、走塁判断、バント、内野安打・三塁打・ランニングホームラン等の結果依存投稿、ゲーム査定は採用しなかった。
- 同一作者の連投、同一出来事群、同一実況・放送言及は独立票に数えなかった。
- 3件は同一post IDに異なるURL/本文が返り、ID同定不整合として拒否した。
- 既存SNSR040と本文・作者が一致する鈴木大地の投稿は、Grok-Xの新規独立根拠に数えず関連付けた。
- deleted/inaccessible と明示された投稿は0件。本文または日時が返らない候補は、削除済みと推測せず未確認として拒否した。
- 友杉・林のType B pairwise検索4件は全て結果なしであり、関係を推測していない。

## rejected evidence reasons

```json
{
  "ALL_OUT_EFFORT_WITHOUT_SPEED_OBSERVATION": 11,
  "ARTICLE_OR_VIDEO_REPOST_NOT_INDEPENDENT_SNS_ORIGIN": 5,
  "BASERUNNING_DECISION_OR_STOLEN_BASE_CONTEXT_NOT_ISOLATED_TO_PHYSICAL_SPEED": 6,
  "CONFLICTING_RETURNED_URL_FOR_SAME_POST_ID": 3,
  "DUPLICATE_OF_EXISTING_SOURCE:SNSR040": 1,
  "GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED": 2,
  "GENERIC_OR_AMBIGUOUS_SPEED_LABEL_NOT_SUFFICIENT_FOR_ACCEPTANCE": 33,
  "MISSING_VERIFIABLE_POST_TEXT_OR_TIMESTAMP": 58,
  "NO_CLEAR_DIRECT_PHYSICAL_SPEED_CLAIM": 9,
  "PLAY_OUTCOME_OR_TRANSITION_METRIC_NOT_ISOLATED_TO_PHYSICAL_SPEED": 5,
  "QUESTION_FORM_NOT_DIRECT_PHYSICAL_SPEED_CLAIM": 1,
  "SAME_EVENT_ORIGIN_DUPLICATE_OF_2060952602855276715": 1,
  "SAME_EVENT_ORIGIN_DUPLICATE_OF_2061780501363671339": 3,
  "TARGET_NOT_VERIFIABLE_FROM_RETURNED_POST_TEXT": 12
}
```

## QA

- 19/19 checks passed; final chat only knowledge = 0.
- Independent QA agent: PASS after a required correction. It verified the question-form rejection, generic-only strict gate, 191 receipt traces, baseline preservation, classifications, and video queue.
- [x] 1. canonical_19_only: All Grok and consensus records resolve to the fixed canonical 19.
- [x] 2. x_search_receipts_saved: 175 stored x_search receipts; all status OK.
- [x] 3. actual_post_id_and_url_saved: 191/191 unique candidate records retain a status ID and x.com URL; every accepted URL exactly appears in a stored Grok-X receipt.
- [x] 4. repost_duplicate_control: Known same-event/broadcast repetitions rejected; accepted records are not marked reposts.
- [x] 5. same_origin_control: Umeno and Suzuki same-event/broadcast groups collapsed.
- [x] 6. existing_ledger_duplicate_control: The matching Suzuki X origin is linked as duplicate of SNSR040 and not counted anew.
- [x] 7. stolen_base_technique_excluded: No accepted Grok source uses stolen-base technique.
- [x] 8. baserunning_judgment_excluded: No accepted Grok source rests on start or decision quality.
- [x] 9. game_rating_excluded: No accepted Grok source is a game rating/discussion.
- [x] 10. current_historical_separated: All accepted sources have explicit current/historical context.
- [x] 11. old_posts_not_overweighted: Directional/current-support outcomes each retain at least one 2025/26 accepted Grok source.
- [x] 12. no_numeric_sns_rating_generated: v2 consensus stores bands and ordinal constraints only, not SNS-derived numeric ratings.
- [x] 13. insufficient_not_forced: All players remaining explicitly insufficient stay in the video queue; the count is 8.
- [x] 14. deleted_inaccessible_not_confirmed: No metadata-incomplete or identity-conflicted result was accepted as confirmed evidence.
- [x] 15. powerpro_residual_not_used: Builder inputs contain only baseline SNS, canonical consensus, and Grok-X evidence; no residual audit input.
- [x] 16. reproducible_integration: Deterministic inputs, fixed manual decision table, and one output row per candidate.
- [x] 17. final_chat_only_knowledge_zero: All claims and counts used for the deliverable are stored in repository artifacts; chat-only knowledge count is 0.
- [x] 18. question_form_not_accepted: Question-form candidate 2035030093240967369 is rejected and no accepted source has question-form directness.
- [x] 19. generic_labels_do_not_create_strict_consensus_alone: Strict consensus is based on two qualifying independent X origins; general player-type labels are retained as context but cannot satisfy it alone.

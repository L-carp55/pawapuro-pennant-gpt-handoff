# Grok Build Task — 走力 X Community Recollection V3

作成日: 2026-08-15
状態: **ACTIVE / X-ONLY DECISIVE WAVE**
Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
Execution branch: `grok/speed-x-recollection-v3-20260815`
Base SHA: `3f42d9a7c4703e75bf9ee406524381611c6b733b`

## 0. 目的
SP-035 `Official X replies and rating criticism/praise` を、X検索に強いGrok Buildが担当する。既存X laneは81行あるが、Opus監査で `current_100` がnull hard-codeされており、current-100への査定批判0件という結果をnegative findingとして扱えない。今回の目的は、X上に走力査定・実走力・stale/aging/injury等の有用なcommunity evidenceが本当にどの程度あるかを、検索感度を十分に上げて一度だけ測り直すこと。この1waveで決着させ、無限追加検索はしない。

## 1. 役割境界
Grok Buildは **Xのみ** 担当する。

やる:
- PowerPro official X post discovery
- Prospi official X post discovery
- official post replies / quote reactions
- current-100 player targeted X search
- rating criticism / praise
- physical speed observations useful as context
- stale / aging / injury / recovery claims
- PowerPro vs Prospi comparison
- thread/reply/quote context reading
- semantic classification
- player identity resolution
- X lane QA
- SP-035のstatus提案

やらない:
- YouTube discovery/comment collection（Codex lane）
- SP-033 / SP-034のstatus変更
- SP-075の最終close
- Speed Gate close
- 肩力着手

## 2. 既存artifact
最初に最低限読む:
- `docs/tasks/CODEX_SPEED_COMMUNITY_RATING_RESCUE_20260813.md`
- `docs/state/speed_task_registry.tsv`
- `docs/audits/opus_largewave_bulk_review_20260814.md`
- `scripts/sp035_x_official_rescue_save.mjs`
- `outputs/derived/sp035_x_official_rescue_20260813.json`
- `outputs/derived/sp035_x_existing_organize_20260814.json`
- current-100 master table

旧成果を正しい前提にしない。rawは消さず、今回の新収集と区別する。

## 3. 並列実行
X検索は独立queryを多数切れるためsubagent並列化する。
- Agent A: PowerPro official account / ability posts / replies
- Agent B: Prospi official account / ability posts / replies
- Agent C: current-100 targeted search — セ・リーグ側
- Agent D: current-100 targeted search — パ・リーグ側
- Agent E: veteran/stale/injury重点 search
- QA Agent: false-negative / identity / sarcasm / duplication independent review
親Grokは統合・意味判定・commit/pushを担当。

## 4. Official post discovery
対象期間:
- Tier A: 2024-01-01 ～ 2026-08-15
- Tier B: 2020-2023はstale / veteran / historical owner-review候補だけ

PowerPro / Prospi official accountsから、選手能力、能力公開、能力紹介、査定、アップデート、新能力、選手紹介、セレクション、OB、現役選手の能力確認、roster/database update相当postを探索する。official post本体だけでなく可能な範囲でreplies / quote posts / reaction postsを追う。

各postについて post id / account / timestamp / text / media context / target player(s) / game / edition / replies/quotes取得範囲 / discovery query を保存する。

## 5. current-100 targeted search
current-100 masterから **実際に100人リストを生成**し、`current_100` をhard-codeしない。各playerについて最低1回は broad query familyを通す。

最低query family:
- `<player> 走力 パワプロ`
- `<player> 走力 プロスピ`
- `<player> 走力 査定`
- `<player> 足速 パワプロ`
- `<player> 足遅 パワプロ`
- `<player> 俊足 パワプロ`
- `<player> 鈍足 パワプロ`
- `<player> 走力 高すぎ`
- `<player> 走力 低すぎ`
- `<player> 走力 おかしい`
- `<player> 走力 上げろ`
- `<player> 走力 下げろ`
- `<player> 走力 A/B/C`

query languageはX上の実用性に応じて自然に展開してよい。最初のpassは広く、hitのある選手・owner-review候補・stale候補のみ深掘りする。

## 6. stale / aging / injury重点
以下を広く拾う:
- 昔は速かった
- 全盛期
- まだこの走力なのか
- 走力落ちた
- 衰え / 劣化 / 年齢
- 怪我後 / 復帰後 / 手術後
- 以前より速い/遅い
- 昔のイメージで査定されている
- 査定が更新されていない
支持・反証の両方を拾い、staleを決め打ちしない。

## 7. Rating lane / Physical lane分離
Rating lane: PowerPro/Prospi走力の高すぎ・低すぎ、explicit grade/value、update賛否、stale/aging/injury非反映、PowerPro vs Prospi比較。これは実走力の教師値にしない。
Physical lane: 実際に足が速い/遅い、加速、一塁到達、直線速度、昔より落ちた/戻った。ただし盗塁成功・走塁技術・スタート判断を純粋な脚力と混ぜない。

## 8. Semantic classification
regexだけで最終判定しない。X post / reply / quoteの意味を読む。可能な限り original post / reply先 / quote対象 / surrounding thread / official ability reveal / game/edition/date を一緒に見る。

claim_lane:
- RATING_POWERPRO
- RATING_PROSPI
- PHYSICAL_OBSERVATION
- GAMEPLAY_MECHANICS
- BASERUNNING_TECHNIQUE
- STEALING_TECHNIQUE
- MIXED
- NOISE

rating_direction:
- TOO_HIGH
- TOO_LOW
- APPROPRIATE
- EXPLICIT_PROPOSED_VALUE
- STALE
- AGING_NOT_REFLECTED
- INJURY_NOT_REFLECTED
- RECOVERY_NOT_REFLECTED
- COMPARISON_ONLY
- UNCLEAR

speed_concept:
- PURE_SPEED
- ACCELERATION
- BASE_TO_BASE
- INFIELD_HIT_EFFECT
- STEALING
- GENERAL_SPEED
- UNCLEAR

discourse:
- literal
- sarcasm_possible
- joke_but_claim_present
- rhetorical
- ambiguous

`笑 / 草 / w / 😂` があってもclaimが明確ならNOISEへ落とさない。

## 9. Player identity resolution
full name → surname → nickname/alias → reply先target → quote元target → official ability post context → current-100 alias table の順で解決する。
保存: player / canonical_player_id / current_100 / identity_method / identity_confidence(HIGH/MEDIUM/LOW/AMBIGUOUS) / identity_context。ambiguousは捨てず採用可否だけ分ける。

## 10. Evidence strength
最低: STRONG / MEDIUM / WEAK_DIRECTIONAL / RATING_COMMUNITY / CONTEXT / JOKE_MEME_NOISE。generic/weakでもdirectionがあれば0情報化しない。ただしlikesが多いだけでphysical truthへ昇格させない。

## 11. Independence / reaction volume
同一postへの大量replyを100独立観察として数えない。最低clusterは `x:<source_post_or_reveal>:<player>:<claim_cluster>`。event_id / independence_group / origin_count / reaction_volume / reply_count / quote_count / like_sum / top_like_count を可能な範囲で保存。reaction volumeは独立origin数と分ける。

## 12. 共通schema
Codex YouTube laneとの統合用に最低以下を出す:
record_id, platform, source_type, source_url, source_post_or_video_id, parent_event_id, root_thread_id, published_at, text_or_excerpt, player, canonical_player_id, identity_method, identity_confidence, game, edition, claim_lane, rating_direction, speed_concept, discourse, explicit_rating_value, comparison_player, event_id, independence_group, reaction_volume, likes, source_quality, current_100, notes。

## 13. 必須成果物
1. `outputs/derived/speed_community_v3_x_official_post_inventory_20260815.csv|jsonl`
2. `outputs/derived/speed_community_v3_x_raw_20260815.jsonl`
3. `outputs/derived/speed_community_v3_x_classified_20260815.jsonl`
4. `outputs/derived/speed_community_v3_x_player_summary_20260815.csv`
5. `outputs/derived/speed_community_v3_x_query_coverage_20260815.csv`
6. `outputs/derived/speed_community_v3_x_qa_20260815.json`
7. `docs/audits/speed_community_v3_x_recollection_20260815.md`
旧artifactを上書きしない。

## 14. QA — false negative重視
QA Agentはacceptedだけ確認して終わらない。candidateからランダムsample、rejected/unclassifiedからランダムsample、current-100 mapping miss、surname/alias miss、sarcasm false positive、gameplay complaint→physical誤分類、duplicate/same-event水増し、official/unofficial混同、100人へのquery family適用を確認する。

QA artifact最低項目:
- current_100 players searched / 100
- players with >=1 raw hit
- players with >=1 rating claim
- players with >=1 physical claim
- official posts discovered
- replies/quotes collected
- raw candidate count
- accepted rating claim count
- accepted/context physical claim count
- false-negative sample rate
- false-positive sample rate
- unresolved ambiguous identity count

## 15. Stop rule
この1waveで十分な検索をした後は止める。成功は大量hitではなく、official X discovery、current-100実検索、semantic classification、false-negative QA、missingness明示、SP-035判断価値の測定ができること。十分探索してもyieldが低ければ bounded low-yield resultとしてよい。ただし検索不能・取得不能を証拠不存在とは書かない。

## 16. SP-035 status policy
成果に基づきstatusを**提案**するがSpeed Gateは閉じない。
- DONE_VALIDATED: coverage/QA十分でusable X lane構築
- DONE_NEGATIVE_FINDING: 十分な探索を実施し対象scopeで本当にlow-yieldと判断できた場合のみ
- PARTIAL: search/coverageに意味のある穴が残る
- BLOCKED_EXTERNAL: X検索機能上の制約で必要範囲へ到達不能
取得不能だけを理由にDONE_NEGATIVE_FINDINGへしない。

## 17. 完了時
明確な問題は自分で修正し、途中でowner確認待ちを挟まず、このwaveを最後まで進める。commit/push後に branch / final remote head SHA / current_100 searched / raw X hits / semantic candidates / accepted rating claims / contextual/physical claims / players covered / official posts discovered / replies/quotes collected / top findings / SP-035 proposed status / unresolved missingness / QA result のみ報告する。SP-033/034、SP-075、Speed Gate、肩力には触れない。
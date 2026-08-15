# Codex Task — 走力 Community / Official YouTube / X 再収集 V3

作成日: 2026-08-14
状態: **ACTIVE / ONE DECISIVE RECOLLECTION WAVE**
Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
Execution branch: `codex/speed-community-recollection-v3-20260814`
Base SHA: `3f42d9a7c4703e75bf9ee406524381611c6b733b`

---

## 0. このタスクをやり直す理由

SP-033 / SP-034 / SP-035 は現在 PARTIAL / gate_block=1。

既存YouTube corpusは 7,145 comments あるが、再監査で以下が判明した。

- 新規動画探索をせず、既知video IDだけからコメントを再取得していた
- yt-dlp の bounded/top-comment 取得で、完全収集ではない
- player mappingが元々フルネーム完全一致中心
- comment本文単体のregex分類が中心で、video title / parent comment / reply thread文脈を意味判定へ十分使っていない
- `走力Aだろ`, `走力84`, `走力Bにも不満`, `足が速い` 等の人間には明白な査定コメントを大量に落とせる
- X側でも current_100 が行ごとに null のhard-codeだった

したがって、**「有用なcommunity evidenceがほぼ存在しない」というnegative findingはまだ成立していない**。

このV3では、同じ収集方法を繰り返さない。

目的はコメント数を増やすことではなく、

1. relevant official video/postを正しく発見する
2. comment/replyの文脈を保持する
3. 高感度で走力査定claim候補を拾う
4. LLMによる意味分類で player / direction / rating-vs-physical / sarcasm を判定する
5. それでも低yieldなら、その時点で初めて community lane の判断価値を測る

こと。

**この1waveで決着させる。無限に追加収集しない。**

---

# 1. 実行原則

大規模read-heavy taskなので、Codex parentが全部直列で処理しない。

独立作業はsubagentへ並列dispatchする。

推奨分担:

- Agent A: PowerPro official YouTube video discovery + comments
- Agent B: Prospi official YouTube video discovery + comments
- Agent C: Official X post/reply discovery
- Agent D: per-player X rating criticism / praise search
- Agent E: semantic classifier / entity-resolution pipeline
- QA Agent: independent coverage / false-negative / false-positive audit

親agentは統合・status判断・commit/pushを担当。

---

# 2. 絶対に繰り返してはいけない旧方式

以下を禁止する。

- 既存 inventory の video IDだけを回して「探索完了」とする
- `comment_sort=top` の100/300件だけで十分とみなす
- full-name exact matchだけでplayerを確定する
- comment本文だけをregexにかけ、video title / parent / repliesを無視する
- `走力A`, `走力84` のようなexplicit ratingを UNCLASSIFIED に落とす
- `笑`, `草`, `w` が含まれるだけで査定claimをJOKE/NOISEへ落とす
- current_100をhard-code nullにする
- 取得不能を negative evidence とする
- artifactが存在するだけでtaskをDONEへ進める

---

# 3. Scope — YouTube discovery

## Tier A: exhaustive discovery

対象期間: **2024-01-01 ～ 2026-08-14**

KONAMI / パワプロ / プロスピのofficial channel uploadsを、既存inventoryではなくchannel側から取得して検索する。

少なくとも title / description / publishedAt / video_id を列挙し、以下の概念を広く拾う。

- パワプロ / パワフルプロ野球
- プロスピ / プロ野球スピリッツ
- 選手能力
- 能力公開
- 能力紹介
- アップデート
- update
- 査定
- 選手紹介
- 対決
- 新能力
- セレクション
- OB / 現役選手による能力確認

keyword一本で切らず、タイトル・説明と番組seriesを使って関連videoを判定する。

## Tier B: targeted historical discovery

2020-2023は全動画を総当たりしない。

current-100 masterで stale / aging / injury / large PowerPro gap / owner-review候補になっている選手についてだけ、過去能力公開・update動画を追加探索する。

## 必須出力

`outputs/derived/speed_community_v3_official_video_inventory_20260814.csv`

最低列:

- game
- video_id
- title
- published_at
- source_url
- official_channel_id
- discovery_method
- matched_terms
- relevant_reason
- target_players_from_title_if_any
- comments_available
- comments_retrieved
- retrieval_method
- retrieval_bound_or_missingness
- already_in_old_inventory

さらに old inventory と比較し、

- old IDs count
- fresh discovered IDs count
- overlap
- newly found relevant videos

をQAへ保存する。

---

# 4. YouTube comment/reply回収

relevant videoについて、取得可能な範囲で **top comments限定をやめる**。

YouTube Data APIが利用可能なら paginationで commentThreads + replies を取得する。

APIが無い場合も、yt-dlp等で可能な限り深く回収する。固定100/300 capをそのまま使わない。

完全取得できない場合は、各videoごとに必ず:

- retrieval tool
- sort/order
- requested/retrieved count
- platform-reported count if available
- bound
- unresolved remainder

を保存する。

重要: parent-child thread構造を保持する。

各comment recordには最低限:

- video_id
- video_title
- video_description_short/context key
- comment_id
- parent_comment_id
- root_thread_id
- author
- published_at
- text
- likes
- reply_count
- source_url

を持たせる。

---

# 5. 高感度 candidate extraction

regexは **候補を減らすための最終分類器ではなく、recall-first prefilter** に限定する。

少なくとも次を候補化する。

## speed words

- 走力
- 足
- 俊足
- 鈍足
- 速い / 早い
- 遅い
- 脚
- スピード
- 加速
- 一塁到達
- 内野安打
- 盗塁

## rating expressions

- A / B / C / D / E / F / G
- S
- 0-100 numerical values
- 高すぎ / 低すぎ
- 上げろ / 下げろ
- もっと高 / もっと低
- おかしい
- 妥当
- 不満
- 盛られてる / 過大
- 過小 / 過小評価
- 昔 / 全盛期 / 衰え / 劣化 / 怪我 / 復帰

explicit grade/numberが出ている行は、`走力`と同じcomment/thread/title contextにある限り必ずsemantic reviewへ送る。

---

# 6. player identity resolution — context aware

player mappingは次の順で行う。

1. comment内 full name
2. comment内 surname / nickname / common alias
3. parent commentで明示されたplayer
4. root threadで明示されたplayer
5. video title / ability reveal target
6. video description / chapter context
7. current-100 roster + alias table

`current_100` は master tableからjoinし、hard-codeしない。

姓だけの場合は複数候補・引退選手・皮肉を考慮し confidence を持たせる。

出力:

- canonical_player_id
- player
- identity_method
- identity_confidence = HIGH / MEDIUM / LOW / AMBIGUOUS
- identity_context

ambiguousを0情報化せず候補として保持する。

---

# 7. semantic classification — regex onlyは禁止

候補comment/threadは **LLM / subagentで意味を読む**。

各候補に、少なくとも以下を同時に渡す。

- video title
- relevant title target player(s)
- root parent comment
- immediate parent
- candidate comment
- direct replies where useful
- game / edition / post date

分類項目:

## claim lane

- RATING_POWERPRO
- RATING_PROSPI
- PHYSICAL_OBSERVATION
- GAMEPLAY_MECHANICS
- BASERUNNING_TECHNIQUE
- STEALING_TECHNIQUE
- MIXED
- NOISE

## rating direction

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

## speed concept

- PURE_SPEED
- ACCELERATION
- BASE_TO_BASE
- INFIELD_HIT_EFFECT
- STEALING
- GENERAL_SPEED
- UNCLEAR

## discourse

- literal
- sarcasm_possible
- joke_but_claim_present
- rhetorical
- ambiguous

`笑 / 草 / w / 😂` があっても claim自体が明確なら NOISE にしない。

---

# 8. 必須 regression examples

以下は既存7,145 corpusから実際に見つかった旧pipelineのfalse-negative / hard case。

V3のclassifier QAで必ずテストケース化する。

### Case A

`ビシエドってそんな足速いのか。他にもいろいろ能力値がおかしい。`

期待:
- speed/rating candidateとして保持
- ビシエドへmapping可能
- 高すぎ方向または rating criticism候補

### Case B

`大谷走力Aだろ`

期待:
- 大谷へcontext mapping
- explicit proposed grade A
- UNCLASSIFIEDにしない

### Case C

`これパワーAはもちろん、走力Bにも不満あったんだよね笑`

期待:
- 走力Bへの不満claimを保持
- 笑があってもJOKE_ONLYにしない
- directionは文脈込みで判定

### Case D

`予想 ミート82パワー90走力84`

期待:
- explicit proposed speed value 84
- 対象playerをvideo/thread contextから解決

### Case E

`大谷走力Aだろ` / `大谷走力Bにも不満` のようにsurname/title contextだけで十分な場合、full-name exact matchを要求しない

### Case F

`足が速い山川`

期待:
- 山川穂高 candidateまでは保持
- surrounding threadを読み sarcasm_possible を付ける
- contextなしで literal physical evidenceとして自動採用しない

### Case G

`清原 ... ミートB79 パワー82 走力B74 ... これくらいはやってくれよ？`

期待:
- explicit proposed speed grade/valueとして保持
- 他能力が混在していても走力部分を抽出

QA Agentはこれらが期待どおりでない限りPASSを出さない。

---

# 9. Official X / rating criticism rescue — SP-035

既存81行の整理だけで終えない。

## official post discovery

PowerPro / Prospi official accountsについて、2024-2026の:

- 能力公開
- 選手紹介
- update
- ability reveal
- roster reveal

を発見し、そのreply / quote-reactionを可能な範囲で取得する。

## current-100 targeted search

100人masterからplayer listを生成し、少なくとも次のquery familyを機械生成する。

- `<player> 走力 パワプロ`
- `<player> 走力 プロスピ`
- `<player> 足速 パワプロ`
- `<player> 足遅 パワプロ`
- `<player> 走力 高すぎ`
- `<player> 走力 低すぎ`
- `<player> 走力 おかしい`
- `<player> 走力 A|B|C...` に相当する検索

全100人を同一深度で無限検索する必要はない。

第一passで広くscanし、hitのある選手・owner-review候補・stale候補を深掘りする。

X MCP / Grok-X searchが使えるならsubagentへ並列化する。

---

# 10. independence / reaction volume

same-event reactionを独立測定として水増ししない。

ただし旧方式のように `1 video = 1 origin` で全選手を潰さない。

最低単位:

`platform:event_or_video:player:thread_or_claim_cluster`

保存:

- event_id
- independence_group
- origin_count
- reaction_volume
- comment_count
- like_sum
- top_like_count

同一video内でも別player・別claim threadは別clusterになり得る。

---

# 11. Evidence policy

community rating evidenceは **純粋な走力の教師値にしない**。

用途:

- PowerPro stale/odd context
- community disagreement
- owner-review context
- external reasonableness check

以下を分離する。

- pure physical observation
- game rating criticism
- gameplay balance complaint
- baserunning / stealing mechanics

「ゲームで内野安打にならない」は、必ずしも現実のpure foot speedへの批判ではない。

---

# 12. 成果物

最低限:

1. `docs/audits/speed_community_recollection_v3_20260814.md`
2. `outputs/derived/speed_community_v3_official_video_inventory_20260814.csv`
3. `outputs/derived/speed_community_v3_youtube_raw_20260814.jsonl`
4. `outputs/derived/speed_community_v3_youtube_candidates_20260814.jsonl`
5. `outputs/derived/speed_community_v3_youtube_semantic_classified_20260814.jsonl`
6. `outputs/derived/speed_community_v3_x_raw_20260814.jsonl`
7. `outputs/derived/speed_community_v3_x_semantic_classified_20260814.jsonl`
8. `outputs/derived/speed_community_v3_player_summary_20260814.csv`
9. `outputs/derived/speed_community_v3_qa_20260814.json`
10. reproducible scripts / query logs

raw / candidate / accepted-summaryを分ける。

---

# 13. 必須QA metrics

旧結果と比較できるよう、必ず数字を出す。

## discovery

- official videos scanned
- relevant videos found
- new relevant videos absent from old inventory

## collection

- comments/replies retrieved
- retrieval completeness / bounds

## extraction

- speed/rating candidate count
- candidate rate
- explicit grade/value claims
- direction claims

## identity

- mapped current-100 count
- full-name mapping
- surname/alias mapping
- title-context mapping
- parent/thread-context mapping
- ambiguous count

## semantic output

- accepted rating-context count
- weak directional count
- physical observation count
- gameplay-only count
- sarcasm/joke-but-claim count
- distinct player count
- distinct independent origin count

## old-vs-v3

- old 7,145 corpusからV3 classifierで新たに救済できたclaim数
- fresh discovery由来の新claim数
- old pipeline false-negative examples count

---

# 14. SP-033 / SP-034 / SP-035 / SP-075 status rule

**ファイルができただけでDONEにしない。**

SP-033/034/035は、実際のcoverage / missingness / meaningful evidenceを検査してstatusを更新する。

- 取得・分類が十分実行できた → DONE_VALIDATED または、実データに基づく適切な完了status
- 技術的に未取得部分が残る → PARTIAL + exact missingness

`NOT_COLLECTED = negative finding` にしない。

SP-075はSP-033/034/035を正しく再評価してから再生成する。

ただしcommunity aloneでPowerPro staleをSUPPORTEDへ昇格させない。

---

# 15. Scope boundary

このtaskで触ってよいのは community evidence lane と、それに直接依存する SP-075 re-diagnosisまで。

触らない:

- SP-016 methodology
- SP-071 absolute scale finalization
- SP-079 final appraisal
- SP-081 Speed Gate close
- SP-082 shoulder
- production default model

走力Gateを勝手に閉じない。
肩力へ進まない。

---

# 16. Stop rule — 1回で決着

このV3を完遂した後、community evidenceが依然として低yieldでも、**自動的に第4回収集へ広げない**。

その場合はauditで:

- discovery coverage
- retrieval bound
- semantic recall QA
- meaningful current-100 claims
- incremental decision value

を定量化し、community laneをGate blockerとして残す価値があるかをowner/GPTへ返す。

このwaveの目的は「永遠にSNSを探すこと」ではなく、**旧negative findingが低感度pipelineのせいだったかを1回で判定すること**。

---

# 17. 完了条件

- [ ] fresh official-video discoveryを実施した
- [ ] old inventoryとの差分を測定した
- [ ] top 100/300固定capだけに依存していない
- [ ] parent/reply contextを保持した
- [ ] full-name exact match以外でentity resolutionできる
- [ ] current_100をmasterからjoinした
- [ ] regex-onlyではなくsemantic classificationを実施した
- [ ] regression Case A-G がpassした
- [ ] raw/candidate/classified/summaryを分離した
- [ ] same-event water-fillingを防いだ
- [ ] weak evidenceを0情報化していない
- [ ] rating vs physical vs gameplayを分離した
- [ ] SP-033/034/035を実データで再判定した
- [ ] SP-075を必要なら再生成した
- [ ] registry validator / relevant regression testsを実行した
- [ ] commit + pushした
- [ ] final chat only knowledge = 0

---

# 18. 完了報告

返すのは簡潔に:

- branch
- commit SHA
- fresh videos discovered
- comments/replies retrieved
- speed/rating candidates
- mapped current-100 claims
- meaningful independent origins
- old pipelineから救済された件数
- SP-033/034/035/075 status
- QA/tests
- remaining blocker

を報告する。

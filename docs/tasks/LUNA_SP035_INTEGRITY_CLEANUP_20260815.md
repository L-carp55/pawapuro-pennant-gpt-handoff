# Luna Task — SP-035 X Recollection V3 Integrity Cleanup

作成日: 2026-08-15
状態: **ACTIVE / DETERMINISTIC CLEANUP ONLY**
Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
Execution branch: `codex/luna-sp035-integrity-cleanup-20260815`
Base SHA: `1405e956bf2b77a2aaf84e546cd1c9ec23740ccb`

## 0. 目的
Grok Build が収集した SP-035 X recollection v3 は、検索そのものは十分進んだが、canonical counts / platform separation / event identity / classification hygiene / QA / docs consistency に不整合が残っている。

このtaskは **追加のX検索をしない**。既存artifactだけを機械的に正本化する。

Luna向けの決定論的cleanupであり、新しい方法論判断や追加リサーチは不要。

## 1. 絶対にやらないこと
- 新規X検索
- Web検索
- YouTube作業
- SP-033 / SP-034変更
- SP-075最終close
- Speed Gate close
- 肩力着手
- raw evidenceの削除
- 取得不能をnegative findingへ変換

## 2. Input正本候補
最低限読む:
- `outputs/derived/speed_community_v3_x_raw_20260815.jsonl`
- `outputs/derived/speed_community_v3_x_classified_20260815.jsonl`
- `outputs/derived/speed_community_v3_x_player_summary_20260815.csv`
- `outputs/derived/speed_community_v3_x_query_coverage_20260815.csv`
- `outputs/derived/speed_community_v3_x_qa_20260815.json`
- `docs/audits/speed_community_v3_x_recollection_20260815.md`
- `docs/state/speed_task_registry.tsv`

## 3. Canonical platform separation
現classified datasetには `platform=X` と `platform=WEB` が混在している。

必ず分離する:

### X primary lane
SP-035のcoverage/count/status判定に使う。
- platform が X/x
- 実X post/reply/quote/search-result record

### Supplemental WEB/context lane
X primaryとは別artifactへ保存する。
- Game8
- Gamerch
- 日刊スポーツ
- Instagram snippet
- blog
- その他WEB

WEB行は削除しない。

推奨出力:
- `outputs/derived/speed_community_v3_x_canonical_20260815.jsonl`
- `outputs/derived/speed_community_v3_x_supplemental_web_20260815.jsonl`

以降のSP-035 canonical countsは **X primaryのみ** から再計算する。

## 4. Event identity / dedupe修理
X primaryに以下を残さない:
- `x:unknown:*`
- `x:nourl:*`
- `x:undefined`

X投稿URLまたは `source_post_or_video_id` からpost IDを復元する。

canonical event key:
`x:<post_id>:<canonical_player_id-or-player-key>:<claim_cluster>`

canonical independence groupは最低:
`x:<post_id>:<canonical_player_id-or-player-key>`

同一post/player/claimが複数source agentから入った場合はdedupeし、rawは保持したままcanonical dataset側で1recordへ正規化する。

検索クエリそのもののNOT_FOUND recordはevidence originとして数えない。

修正後に:
- canonical X rows
- unique X post IDs
- unique independence groups
- duplicate rows collapsed
を計測する。

## 5. Classification hygiene
### Speed-specific physical
直接走力を述べているものだけ:
- 足が速い/遅い
- 走力が落ちた
- 全力疾走が速い
- 一塁到達/直線速度等

新しいnormalized fieldを設けてよい:
- `evidence_subtype=SPEED_SPECIFIC_PHYSICAL`

### General context
走力を直接述べていない:
- ACL手術した
- 年齢で衰えた（走力明示なし）
- 攻守で厳しい
- generic injury/recovery

これらは:
- `GENERAL_AGING_INJURY_CONTEXT`
などの別 subtype へ移す。

既存textを削除しない。

### Rating
PowerPro/Prospiの走力査定への方向付きclaimは維持する。
Prospi A / console等はgame/editionを可能な限り区別する。

### Technique separation
盗塁・走塁技術・スタート判断をpure speedへ昇格させない。

## 6. Numeric canonicalization
現在の数字はartifact間で矛盾している。
例:
- QA JSON: raw=420, rating=166, raw players=78, rating players=68
- registry: raw=483, rating=188, player hit=79
- audit末尾: rating=147, players=64

**手打ち値を信じない。**

最終canonical X datasetから再計算し、その値だけを正本とする。

最低再計算:
- x_primary_rows
- current_100_searched
- current_100_with_raw_x_hit
- current_100_with_directional_rating_claim
- current_100_with_speed_specific_physical_claim
- directional_rating_claim_count
- speed_specific_physical_count
- general_context_count
- official_x_post_count
- reply_quote_count_known
- unique_origin_count
- supplemental_web_rows
- unresolved_identity_count

## 7. Docs / Registry整合
以下をcanonical値へ同期する:
- `outputs/derived/speed_community_v3_x_qa_20260815.json`
- `docs/audits/speed_community_v3_x_recollection_20260815.md`
- `docs/state/speed_task_registry.tsv` の SP-035

同一文書の上部/下部で数値が食い違う状態を残さない。

できれば数字の出所を `canonical X datasetから再計算` と明記し、古いGrok途中集計を正本扱いしない。

## 8. QA強化
新規検索は禁止。既存canonical datasetのみをsample reviewする。

最低4 strata:
1. directional rating claims
2. speed-specific physical claims
3. general context
4. rejected/noise/unclear

各stratumから可能なら最低20件、件数不足なら全件をreview。
加えてidentity edge casesを全件または最低20件review。

QAで確認:
- player identity誤結
- 西川史礁→西川龍馬の誤結なし
- 山本大斗→山本祐大の誤結なし
- rating direction誤分類
- joke markerだけでclaimを捨てていない
- generic agingをspeed-specificへ誤昇格していない
- WEBがX countに混ざっていない
- duplicate/same-post水増しなし

sample count / error count / corrected countを記録する。
`3/3なのでfalse-positive rate 0%` のような過小sample rate表現はやめる。

推奨出力:
- `outputs/derived/speed_community_v3_x_integrity_qa_20260815.json`

## 9. SP-035 status判断
cleanup後、statusを提案または更新する。

原則:
- `DONE_VALIDATED`: bounded X laneとしてowner review / stale-odd contextへ十分使用でき、残るmissingnessが追加検索をGate必須にするほどではない
- `PARTIAL`: canonical X lane自体にmeaningful coverage/identity/classification穴が残る

「全返信ページングを取っていない」だけで自動PARTIALにしない。
SP-035の目的はX上の全発言完全収集ではなく、Rating Consensus / context laneを実用可能にすること。

ただし取得不能をnegative findingにはしない。

## 10. Tests / checks
既存QAに加え、可能ならcleanup scriptを作り再実行可能にする。

最低:
- idempotent
- canonical counts deterministic
- WEB row countがX primaryに混ざらない
- `x:undefined` がX canonicalで0
- `x:unknown` がX canonicalで0（実post IDがある行）
- duplicate canonical key=0
- current_100 mappingはmaster由来

関連既存testがあれば実行する。
Speed Gate全体を閉じない。

## 11. 完了時
commit/pushし、次だけ報告:
- branch
- final remote head SHA
- X-only canonical rows
- X-only directional rating claims
- X-only speed-specific physical claims
- X-only current100 players covered
- unique origins
- supplemental WEB rows separated
- QA sample count / errors / fixes
- canonical artifact paths
- SP-035 final/proposed status
- remaining missingness

追加検索はしない。

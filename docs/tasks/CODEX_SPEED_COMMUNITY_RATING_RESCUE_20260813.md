# Codex Task — 走力 Community Rating / YouTube / Prospi 追加収集

作成日: 2026-08-13
状態: **ACTIVE / REQUIRED BEFORE OWNER REVIEW FINALIZATION**
Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
Base branch: `agent/claude-speed-redteam-20260812`

---

## 0. 背景

既存SNS収集は以下まで完了済み:

- ordinary SNS: `codex/speed-2026-sns-consensus-tiebreak`
- Grok-X rescue: `codex/speed-2026-grok-x-sns-rescue`
- Grok-X: x_search 175 / raw hits 267 / unique candidates 191 / accepted 41

しかし旧strict QAで `GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED` として、**PowerPro / Prospiの査定値そのものへの批評を除外した**。

さらに:

- KONAMI公式YouTubeコメント
- Prospi公式YouTubeコメント
- official X能力紹介reply
- Prospi rating comments

は体系的には未実施。

この漏れを埋める。

重要: **既存41 accepted SNSはやり直さない。旧raw/rejected ledgerも上書きしない。**

---

# 1. 実行体制 — 複数subagentを必ず並列使用

大規模read-heavy収集なので、親agentが全部直列に調べない。

最低限:

### Agent A — PowerPro official YouTube

- KONAMI公式の2026/直近PowerPro能力紹介
- 選手能力公開
- update紹介
- 個別選手/球団能力紹介
- コメント欄

### Agent B — Prospi official YouTube

- プロスピ公式の能力紹介
- update
- 選手能力公開
- コメント欄

### Agent C — X PowerPro rating lane

- PowerPro走力査定への批評
- official ability post replies
- high/low/stale/aging/injury/acceleration comments

### Agent D — X Prospi rating lane

- Prospi走力査定への批評
- official post replies
- PowerProとの比較

### Agent E — Existing Grok-X rejected ledger rescue

旧191 candidate / rejected 150から:

- game rating discussion
- generic speed label
- appraisal criticism
- same-event reaction

を**新しい柔軟基準で再分類**。

新規検索と旧ledger救済を混同しない。

### QA Agent — 独立QA

- duplicate
- same-event grouping
- player identity
- game/edition identity
- official vs unofficial source
- classification drift
- weak evidence preservation
- reaction volume
- quote/provenance completeness

親agentだけが最終統合する。

---

# 2. 収集目的

2 laneを厳密に分ける。

## A. Physical Observation Consensus

既存成果を原則再利用。

必要な追加検索は不足選手だけ。

例:

- 足が速い/遅い
- 加速
- 一歩目
- 直線速度
- 昔より落ちた/戻った

## B. Rating Consensus — 今回の主対象

集める:

- PowerPro走力が高すぎる
- PowerPro走力が低すぎる
- Prospi走力が高すぎる/低すぎる
- 昔の俊足イメージを引きずっている
- agingが反映されていない
- injury/recoveryが反映されていない
- accelerationを見ていない
- top speedを過大評価している
- 走力でなく走塁得能の問題ではないか
- update変更が妥当/不当
- PowerProよりProspiが自然
- ProspiよりPowerProが自然

**Rating Consensusは実走力の教師値にしない。**
PowerPro / Prospi prior/stale/odd判定とowner reviewの材料にする。

---

# 3. 対象選手・scope

## 第一優先

現在の100人master tableのうち:

- owner review候補
- PowerPro stale/odd `SUPPORTED/POSSIBLE`
- confidence LOW
- PROJECT_EVIDENCE_CONFLICT
- raw project-PowerPro gap大
- physical evidence conflict

## 第二優先

100人全体。

公式YouTube1本に複数選手が出る場合は、動画コメント全体を取得して後からplayer mappingする。

## veteran stale重点

- 秋山翔吾
- 松山竜平（historical case）
- 今宮健太
- 西川龍馬
- その他long-hold候補

ただし最初から「stale」と決め打ちしたqueryだけにしない。

---

# 4. YouTube収集

## 必須ターゲット

- KONAMI PowerPro official channel / official videos
- Prospi official channel / official videos
- ability reveal
- player rating reveal
- roster/update reveal

## API

YouTube Data APIが利用できる場合:

- video metadata
- commentThreads
- replies where useful
- like count
- publishedAt
- author channel ID/display name if available

を取得。

## APIが利用できない場合

そこで止めない。

最低限:

1. relevant official video一覧
2. video ID
3. title
4. published date
5. player/game/update mapping
6. APIで取得できなかった理由
7. userへ要求する最小形式

を保存する。

ユーザーは必要ならYouTube API出力 / CSV / JSON / copy-pasteを提供可能。

**API不可 = comments lane完了、とはしない。**

---

# 5. X / Grok-X収集

## 新しい採用方針

旧strict gateをそのまま使わない。

### 保持するレベル

- `STRONG`
- `MEDIUM`
- `WEAK_DIRECTIONAL`
- `RATING_COMMUNITY`
- `CONTEXT`
- `JOKE_MEME_NOISE`

weak/genericでもdirectionがある場合はraw/filtered ledgerへ残す。

### 旧rejectの救済

特に旧reject reason:

- game rating / discussion
- generic speed label
- ambiguous speed label
- play result / transition

を再確認。

完全なphysical observationでないことと、rating consensusとして無価値なことを混同しない。

---

# 6. 同一イベント・reaction volume

同じ動画・同じability reveal・同じpostに対する100コメントを100独立観察として数えない。

保存:

- `independence_group`
- `event_id`
- `origin_count`
- `comment_count`
- `like_sum`
- `top_like_count`
- `agreement_ratio` if defensible

reaction volumeは「広がり」の別指標として扱う。

---

# 7. Classification

最低限:

- `RATING_TOO_HIGH`
- `RATING_TOO_LOW`
- `STALE_RATING`
- `AGING_NOT_REFLECTED`
- `INJURY_NOT_REFLECTED`
- `RECOVERY_NOT_REFLECTED`
- `ACCELERATION_NOT_REFLECTED`
- `TOP_SPEED_OVERRATED`
- `TOP_SPEED_UNDERRATED`
- `PROSPI_MORE_PLAUSIBLE`
- `POWERPRO_MORE_PLAUSIBLE`
- `COMPARE_OTHER_PLAYER`
- `PHYSICAL_FAST`
- `PHYSICAL_SLOW`
- `TEMPORAL_DECLINE`
- `TEMPORAL_RECOVERY`
- `MIXED`
- `JOKE_OR_MEME`
- `UNCLASSIFIED_CONTEXT`

複数label可。

---

# 8. Raw schema

最低限:

```text
record_id
player
canonical_player_id
game
edition
update_date
platform
source_type
source_url
video_id_or_post_id
parent_event_id
author_id_or_name
timestamp
text
likes
reply_count
classification
strength
independence_group
physical_or_rating_lane
target_rating_if_explicit
comparison_player_if_any
source_quality
notes
```

raw textを保存可能ならrawへ保持。copyright-sensitiveな外部共有用artifactでは必要以上の長文転載をしない。

---

# 9. Player summary

100人master tableへjoinできるsummaryを作る。

最低限:

```text
player
physical_consensus
physical_independent_origins
rating_consensus_powerpro
rating_consensus_prospi
rating_independent_origins
rating_volume
stale_community_support
high_low_direction
community_conflict
best_supporting_sources
confidence
missingness
```

Rating Consensusから数値走力点を直接生成しない。

---

# 10. PowerPro stale/oddへの接続

communityを使って:

- `POWERPRO_STALE_SUPPORTED`
- `POWERPRO_STALE_POSSIBLE`
- `NO_STALE_EVIDENCE`

を補強/弱化する。

communityだけでSUPPORTEDへ昇格させない。

最低でもtrajectory / current physical/statistical evidence等と組み合わせる。

---

# 11. 成果物

最低限:

1. `docs/audits/speed_community_rating_rescue_20260813.md`
2. `outputs/derived/speed_community_rating_raw_20260813.csv|jsonl`
3. `outputs/derived/speed_community_rating_filtered_20260813.csv`
4. `outputs/derived/speed_community_rating_player_summary_20260813.csv`
5. `outputs/derived/speed_youtube_official_video_inventory_20260813.csv`
6. `outputs/derived/speed_grok_x_rejected_reclassification_20260813.csv`
7. QA artifact

取得不能やnegative findingも必ず保存。

---

# 12. Definition of Done

- [ ] old accepted 41を上書き/喪失していない
- [ ] old rejected ledgerを新基準でrating laneとして再監査
- [ ] PowerPro official YouTubeを対象化
- [ ] Prospi official YouTubeを対象化
- [ ] official X repliesを対象化
- [ ] X rating criticismを対象化
- [ ] weak directional evidenceを0扱いしていない
- [ ] same-eventを独立票で水増ししていない
- [ ] reaction volumeを別保持
- [ ] raw/filtered/player summaryを分離
- [ ] 100人master tableへjoin可能
- [ ] PowerPro stale/odd statusへ接続可能
- [ ] YouTube API不可ならvideo inventory + missingness + user-input requirementを保存
- [ ] final chat only knowledge = 0

---

# 13. 完了後

Claude/GPTへ返すのはGitHub artifact paths / commit / coverage / main findingsの要約だけ。

その後:

1. 100人tableへcommunity fields join
2. stale/odd再分類
3. owner review queue再抽出
4. ownerへ提示

へ進む。

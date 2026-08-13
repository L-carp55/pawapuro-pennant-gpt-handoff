# 走力再構築 — 現在地と自律継続ルール

作成日: 2026-08-13
状態: **CURRENT / これを現在の単一正本として優先**
対象branch: `agent/claude-speed-redteam-20260812`

---

# 0. このファイルの目的

ユーザーがClaude CodeとGPTの間で毎ターン仲介しなくてよいように、現時点の事実・確定事項・未解決事項・次工程・停止条件を一つにまとめる。

**このファイルより前のhandoff / task文書に次工程の指示が残っていても、本書と衝突する場合は本書を優先する。**

ユーザーへの逐次確認は原則不要。下記の明示的な停止条件に到達するまで、自律的に調査・検証・実装候補作成を進める。

---

# 1. 引継ぎ上の既知の失敗

GPTがClaude Codeへ戻す際のhandoffは不正確だった。

既に判明・訂正済み:

- Claude離脱時点を探索段階として記述したが、実際には既存production speed modelが実装・較正済みだった。
- 三塁打・GIDP回避・内野安打・advance・UBR、多年pool、走力/走塁分離、blendDirect等を十分に引き継がなかった。
- GPT/Codex側の100人baselineは「NPB+中心」ではなく、99人でNPB+速度のほぼ完全な一次関数だった。
- owner reviewの意図を「オーナーが走力目盛りを作る」に取り違えた。
- **追加SNSのRating Consensus / official YouTube comments / Prospi rating commentsを未実施のまま、後続正本22から次工程として落としていた。**

最後の項目は2026-08-13に再確認して復元した。既存audit `speed_2026_reopen_comprehensive_gap_audit_20260811.md` §2.5–2.10 を根拠とする。

---

# 2. 再利用する確定資産

以下は原則やり直さない。

- 既存Claude production speed model
- 2021-2025等の多年pool実装
- 三塁打 / GIDP回避 / 内野安打 / advance / UBR の既存componentと再現性重み
- 走力で説明できる進塁成分を除いた走塁得能の分離
- GPT/Codexの2026 NPB 100人 roster / NPB+ speed / exposure
- physical evidence ledger 459件
- high-confidence physical anchor候補113件
- PowerPro 2015-2026 long panel
- The Show collection
- ordinary SNS / Grok-X evidence（Physical Observation laneとして再利用）
- targeted physical rescue / video negative findings
- 100人 owner review master table と再現スクリプト
- Claude independent red-team
- T-0198 `maxSeason` 修理
- rolling holdout訂正版
- 2026 advance追加情報テスト
- NPB+ direct CV
- NPB+→PowerPro label→blend の構造問題監査
- T-0203層別検証

### 既存SNSについての重要境界

Grok-X rescueは:

- x_search 175
- raw hit 267
- unique candidates 191
- accepted X posts 41

まで実施済み。

ただし当時のQAで `GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED` として、**PowerPro/Prospi査定への言及を意図的に除外**していた。

したがって既存SNSは主に:

- 足が速い/遅い
- 加速
- temporal decline/recovery
- pairwise physical impression

を扱う **Physical Observation Consensus** であり、後述の **Rating Consensusを完了したことにはならない**。

---

# 3. 現在までに確定した重要結論

## 3.1 T-0198

`poolAcrossYears`等へ `maxSeason` を追加し、時間holdout時に未来年を除外可能。未指定時は既存挙動不変。

## 3.2 rolling temporal holdout

NPB+には過去年snapshotがなく、統計側だけY-1で切れるため、公平なrolling holdoutによるNPB+ blend採否は **NOT_IDENTIFIABLE**。

未来情報を含む `statOpen` はdiagnosticのみ。

## 3.3 NPB+自体

NPB+には実の信号がある。

ただし2026 advanceに対し、2021-2025統計モデルへのincremental valueは確認した閾値で0以下。

T-0203では最も薄い1年層がn=2のため、低reliability層での追加価値は **C = 小標本で判定不能**。

T-0204として2026終了後の再実行を登録するが、これは現在作業のblockerではない。

暫定relative policy:

- 自動NPB+ blendは使用しない
- relative modelは既存統計モデルprimary
- raw NPB+はlow reliability / conflict / review evidenceとして保持

## 3.4 現行NPB+ blend経路

`NPB+ speed -> PowerPro label regression -> rating -> blend`

には:

1. 教師値がPowerPro
2. 重みもPowerPro一致度由来
3. regression predictionによる分散縮小
4. 異scale量の混合
5. priorとQAの循環

がある。production正当化されたdirect evidence経路として扱わない。

## 3.5 Absolute scale

`scale_calibration.走力` はPowerPro由来。relative modelとは分離し、最終正本とはしない。

---

# 4. 復元された未実施工程 — Community Rating / YouTube / Prospi comments

**これは未完であり、owner review queue確定前に必ず実施する。**

旧critical path 18 Phase 5 と comprehensive gap audit §2.5–2.10 に存在したが、後の正本22から誤って落ちていた。

## 4.1 2 laneを分離

### A. Physical Observation Consensus

既存ordinary SNS / Grok-Xを再利用。

対象:

- physical speed
- first step / acceleration
- straight-line speed
- decline/recovery
- pairwise physical comparison

既存41 acceptedを再収集し直さない。必要な不足選手だけ追加検索する。

### B. Rating Consensus — **追加収集が未実施**

対象:

- PowerPro走力が高すぎ / 低すぎ
- Prospi走力が高すぎ / 低すぎ
- stale rating / 昔の俊足イメージを引きずっている
- aging / injuryが反映されていない
- top speed / accelerationの取り違え
- 走力ではなく走塁得能で表すべきという意見
- PowerPro vs Prospiどちらが自然か
- updateでの変更に対する賛否

Rating Consensusはphysical speedの直接教師値にはしない。
**PowerPro/Prospi appraisalの信頼度、stale/odd detector、owner review優先度の材料**として使う。

## 4.2 追加収集source

必須:

- KONAMI公式の新能力紹介YouTube
- KONAMI公式の選手能力公開YouTube
- update紹介YouTube
- プロスピ公式能力紹介YouTube
- official X能力紹介投稿へのreply
- X上のPowerPro/Prospi査定批評

補助:

- appraisal blogs / 掲示板等はsource qualityを分けて保存
- user-provided YouTube API JSON/CSV or pasted comments

## 4.3 YouTubeコメントの状態

**2026-08-13時点で体系的収集は未実施。**

旧video tie-breakは選手の走行映像を探した工程であり、YouTubeコメント欄のRating Consensus収集とは別物。

取得経路:

1. YouTube Data APIが利用可能ならAPIで収集
2. 利用不可なら対象official動画一覧・video ID・選手・能力公開版を確定し、取得不能理由を保存
3. userがAPI出力 / CSV / JSON / コメントcopy-pasteを提供できる場合、それをraw corpusへ追記

API不可を理由にYouTube lane全体を「完了」としない。

## 4.4 generic SNSを過度に捨てない

旧Grok-Xの191候補→41 acceptedのstrict gateをRating Consensusへそのまま流用しない。

各コメント/postを:

- strong
- medium
- weak directional
- rating-community
- context
- joke/meme/noise

へ分類する。

弱いdirectional evidenceは低重みで保持する。

同一出来事の多数コメントは独立観察数を水増ししないが、reaction volume / likes / reply agreementは別フィールドにする。

## 4.5 機械可読分類例

- `RATING_TOO_HIGH`
- `RATING_TOO_LOW`
- `STALE_RATING`
- `INJURY_NOT_REFLECTED`
- `AGING_NOT_REFLECTED`
- `ACCELERATION_NOT_REFLECTED`
- `TOP_SPEED_OVERRATED`
- `PROSPI_MORE_PLAUSIBLE`
- `POWERPRO_MORE_PLAUSIBLE`
- `COMPARE_OTHER_PLAYER`
- `MIXED`
- `JOKE_OR_MEME`

各recordに最低限:

- player
- game (`powerpro` / `prospi`)
- edition/update/date
- platform
- URL / video ID / post ID
- comment/post text or compliant excerpt/hash/raw storage reference
- timestamp
- author identifier if available
- likes/reactions if available
- classification
- strength
- independence_group
- target_rating mentioned if explicit
- current/historical context

を保持する。

---

# 5. Codexへ委任する追加収集

大規模read-heavy収集なのでCodexを主担当とする。

Codex task正本:

`docs/tasks/CODEX_SPEED_COMMUNITY_RATING_RESCUE_20260813.md`

**複数subagentを並列使用する。**

推奨分割:

- Agent A: PowerPro official YouTube comments
- Agent B: Prospi official YouTube comments
- Agent C: X PowerPro rating criticism / official replies
- Agent D: X Prospi rating criticism / official replies
- Agent E: existing Grok-X rejected ledger再分類（rating discussion / generic directionalを救済）
- QA Agent: dedupe / identity / same-event grouping / source-quality / leakage / classification review

raw corpusとfiltered/summaryを分け、旧strict ledgerを上書きしない。

### 対象範囲

1. まず2026 100-player master table全員へplayer keyを付けられるofficial/comment corpusを広く回収
2. 特に重点:
   - owner review候補
   - PowerPro stale/odd候補
   - confidence LOW
   - project evidence conflict
   - PowerPro / Prospi divergence
3. 公式動画1本に複数選手コメントがある場合は動画全体を取得して後からplayer mappingする

---

# 6. Community追加収集と並行して進めるrelative / absolute作業

Community collection待ちを理由にrelative/absolute model作業を停止しない。

1. relative modelは暫定的に既存統計モデルprimaryで候補化
2. テストを通す
3. absolute scale問題を別レーンで分析
4. 100人表の内部再生成・差分QAまでは進めてよい

ただし、**owner review queueの最終確定・PowerPro stale/odd最終分類はCommunity Rating収集完了後に行う。**

理由:

Rating Consensusはモデル教師値ではないが、PowerPro/Prospiの査定がstale/oddかを判断する重要材料だから。

---

# 7. Community完了後の100人 owner review再構築

100人表へ追加する:

- SNS physical consensus
- SNS rating consensus
- YouTube rating consensus
- Prospi current/history（取得できる範囲）
- PowerPro stale status
- community dispute status
- source count / independent origin count / reaction volume

owner review候補:

- relative/absolute修正後も |raw project - PowerPro| >=5
- confidence LOW
- physical evidence conflict
- PowerPro stale/odd supported or possible
- community dispute
- Prospi conflict
- AI側で原因未解決

ただしabsolute scaleだけで大量に選出される場合は、先にscaleを解く。

---

# 8. Absolute scale（0-100）

relative modelと混ぜない。

現行 `scale_calibration.走力` はPowerPro由来なので最終正本ではない。

最終的には:

- 自作エンジンの走力値→実プレー現象の応答
- league simulationにおける三塁打・内野安打・進塁・盗塁等の分布
- 能力帯のゲーム内意味

から校正する方向を優先。

PowerPro分布はreference / QAには使えるが、教師値とQAの二重使用をしない。

---

# 9. ユーザーへ停止して確認する条件

以下まで逐次確認不要。

1. Community/YouTube取得にAPI key等、ユーザーだけが提供できるcredential/outputが必要
2. 実装候補が独立QAでも決まらない
3. owner review queueが完成して人間の野球観が必要
4. absolute scale候補がsimulationでも決まらない
5. 新規大規模外部収集の費用/規模判断が必要

YouTube APIが無くても、対象動画一覧と取得不能理由まで自律的に確定してから止まる。

---

# 10. 禁止事項

- ownerに走力目盛り表を作らせて停止しない
- PowerProとの差だけでowner reviewを選ばない
- PowerPro一致率だけでモデルを選ばない
- NPB+ raw measurementを削除しない
- 未来情報diagnosticをholdout validationと呼ばない
- `NOT_IDENTIFIABLE` を無理に結論化しない
- Rating Consensusをphysical speedの直接教師値として混ぜない
- old Grok-X strict rejectsを削除/上書きしない
- YouTube API不可を「YouTube comments収集完了」と扱わない
- 重要知見をchatだけに残さない

---

# 11. 現在地を一文で

> **relative modelは既存統計モデルprimaryへ暫定移行し、NPB+はreview evidenceとして保持する段階。並行して、以前漏れたRating Consensus（PowerPro/Prospi査定へのSNS反応）と公式YouTubeコメントをCodexで追加収集し、これをPowerPro stale/odd判定とowner review packageへ統合してから最終レビューへ進む。**

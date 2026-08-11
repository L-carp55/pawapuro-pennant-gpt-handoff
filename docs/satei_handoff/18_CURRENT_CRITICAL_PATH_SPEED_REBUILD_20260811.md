# CURRENT CRITICAL PATH — Speed Rebuild 2026-08-11

状態: **ACTIVE / CURRENT OPERATING RECORD**

このファイルは、`13_CURRENT_CRITICAL_PATH_20260809.md` を後続監査の結果で更新した現在の作業順である。

`13_CURRENT_CRITICAL_PATH_20260809.md` は履歴資料として残すが、2026-08-11以降の進行判断では本ファイルを優先する。

---

# 1. 最重要ルール

現在の走力Gateは再開済み。

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
```

肩力へ進まない。

ユーザーの `進めて` は、このcritical pathの次工程を進める意味とする。

現在のblind freezeは完成品ではなく、`physical_speed_estimate` 系列の中間成果として保持する。

---

# 2. 作業体制

## Claude Code

査定思想・壁打ち・red-teamの主担当。

- 実装前に仕様の前提を疑う
- evidence weightingを設計
- PowerProをどこまで信用し、どこでstaleを疑うか設計
- context情報をどの重みで使うか設計
- Codex実装結果を別モデル視点でレビュー

## Codex

データ処理・実装・大規模収集の主担当。

- DB集計
- API / scraping
- model build
- reproducible artifacts
- automated QA

## GPT

独立レビュー・統合。

- Claude案とCodex結果の矛盾検出
- missing workflow監査
- owner review package作成
- GitHub正本照合

## Owner

最終査定責任者。

- |diff|>=5 review
- veteran stale判定
- PowerPro/Prospiの違和感裁定
- final acceptance

---

# 3. Phase 0 — Claude Code red-team / design freeze

**次に最初に行う工程。**

実装を始める前にClaude Codeへ現在までの成果を読ませ、以下を独立red-teamさせる。

必読:

- `17_SPEED_GATE_REOPENED_20260811.md`
- 本ファイル
- `19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`
- `docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`
- `12_APPRAISAL_PRINCIPLES_20260809.md`
- `13_CURRENT_CRITICAL_PATH_20260809.md`（history）
- PowerPro temporal panel audit
- physical evidence / anchor audit
- Grok-X audit
- final freeze / PowerPro QA

Claudeへ最初は実装させない。

出すもの:

1. 現行監査への反論
2. 抜けている工程
3. PowerPro priorの使い方
4. stale/inertia判定案
5. context-inclusive acceleration案
6. The Show→PowerPro bridge案
7. Prospiの使い方
8. SNS physical/rating lane設計
9. owner review設計
10. 最終100人査定フロー

Claude案をGPTとownerでレビューした後に仕様freezeする。

---

# 4. Phase 1 — PowerPro temporal / stale / inertia analysis

目的:

> 過去の身体測定を現在へどれだけ残すかと、PowerPro自身が古い評価を引きずっていないかを分離する。

必須作業:

- 23,206 observation / 58 versionsをanalysis-readyに正規化
- same-player/same-date conflictの原因を版・球団・default/updateまで解く
- 各edition/versionの走力分布を保存
- raw scoreだけでなくpercentile / quantileを作る
- player trajectoryを年齢と結合
- position別trajectory
- initial speed band別trajectory
- year-to-year / edition-to-edition persistence
- >=3年据え置き率
- veteran persistence
- injury/recovery後の更新反応
- stale candidate detector

重点case:

- 秋山翔吾
- 松山竜平
- その他ベテラン

old physical carryoverは固定年数減衰にしない。

分類例:

- `STABLE_PHYSICAL_CARRYOVER_SUPPORTED`
- `DECLINE_SUPPORTED`
- `IMPROVEMENT_SUPPORTED`
- `POWERPRO_STALE_SUSPECTED`
- `TEMPORAL_UNRESOLVED`

---

# 5. Phase 2 — context-inclusive acceleration model

目的:

> 最高速度だけでは拾えない一歩目・加速・90ft実戦速度を、完全ではない情報も使って推定する。

入力候補:

- NPB+ Sprint Speed
- direct T90/T30/T10
- standardized 30m/50m
- home-to-first
- bunt home-to-first
- base-to-base
- infield grounder event
- infield hit
- GIDP avoidance
- triples
- extra-base advancement
- pinch-runner usage
- official scouting
- injury/recovery

### H2F rules

一塁到達を直接PowerPro点へ変換しない。

最低限:

- batting side
- bunt / normal swing
- sample count
- fastest
- median
- upper quartile
- season
- timing provenance

を持つ。

同条件比較・residual化してacceleration evidenceへ変換する。

### outcome proxies

結果指標は低重みで使用。

例:

- infield hit: handedness / ground-ball / batted-ball locationを調整
- GIDP: ground-ball opportunity / batting order等を調整
- triples: park / batted-ball power / directionを調整

完全に分解できない交絡はmissingではなくuncertaintyとして保持する。

---

# 6. Phase 3 — The Show→PowerPro bridge

目的:

> 測定時点にPowerProが存在しない助っ人・MLB選手の当時走力をPowerPro相当へ変換する。

比較モデル:

1. direct linear: `PowerPro ~ The Show`
2. Statcast intermediary
3. percentile/quantile mapping
4. isotonic
5. piecewise linear

必要:

- same-year / nearest-year mapping
- verified identity
- PowerPro and The Show live/current roster context
- edition normalization

validation:

- player holdout
- year holdout
- foreign-player holdout
- fast/slow band MAE
- calibration plot

output:

- converted_powerpro
- low/high
- confidence
- method

---

# 7. Phase 4 — Prospi integration

必要範囲:

- current speed ratings
- historical speed ratings where available
- PowerProとのsame-player/same-time comparison
- PowerPro/Prospi divergence
- community comments

目的:

- PowerPro stale疑いの外部QA
- PowerProだけ高い/Prospiだけ高いを識別
- official appraisal consensusの補強

ProspiはPowerProの値をそのままコピーしていると仮定しない。

---

# 8. Phase 5 — Community appraisal

2 laneを必ず分離。

## 8.1 Physical Observation Consensus

- physical speed
- first step
- acceleration
- straight-line speed
- decline/recovery
- pairwise speed

## 8.2 Rating Consensus

- PowerPro high/low
- Prospi high/low
- stale rating
- injury not reflected
- acceleration not reflected
- wrong ability component
- PowerPro vs Prospi preference

source:

- Grok-X
- official YouTube comments
- official X replies
- appraisal blogs
- user-provided pasted comments

### Generic comments

generic `俊足`等を0にしない。

- strong
- medium
- weak directional
- rating-community
- noise

へ分類。

### reaction volume

同一出来事を独立観察として複数票にはしないが、コメント数/like等の広がりは別指標にする。

---

# 9. Phase 6 — Owner review

対象:

- |PowerPro - candidate| >= 5
- stale candidate
- veteran long hold
- injury mismatch
- Prospi conflict
- The Show converted conflict
- community dispute

Ownerへ提示するpacket:

- player
- physical estimate
- practical candidate
- PowerPro current
- PowerPro trajectory
- PowerPro prior status
- Prospi current/history
- The Show converted value
- NPB+ top speed
- H2F summary
- T90/30m/50m
- SNS physical
- SNS rating
- injury/age context
- suggested interpretation

Owner verdictをGitHubへ保存。

後工程で上書き禁止。

---

# 10. Phase 7 — 100-player practical reappraisal

出力を2列に分ける。

## physical_speed_estimate

独立physical estimate。

## practical_powerpro_style_speed

実際にゲームへ入れる査定。

必須fields:

- player
- physical_low / point / high
- practical_low / point / high
- confidence
- PowerPro
- PowerPro prior status
- Prospi
- The Show converted
- H2F acceleration summary
- temporal carryover class
- community physical class
- community rating class
- owner verdict
- evidence used
- evidence downweighted
- major discrepancy reason

---

# 11. Phase 8 — Validation

必須:

- 100/100
- |PowerPro-practical| >=5全員に説明
- owner review complete
- owner verdict unchanged
- PowerPro stale候補を別表示
- no silent fallback
- custom engine / simulationでleague behavior QA

走力が影響する実戦結果について:

- infield hits
- extra-base advancement
- GIDP avoidance
- defensive running where applicable

が現実分布と大きく矛盾しないか確認。

---

# 12. Stop conditions

以下の場合でも肩力へ移らない。

- Claude design review未完
- PowerPro stale model未完
- H2F/acceleration model未完
- The Show conversion未検証
- owner >=5 review未完
- 100-player practical reappraisal未完

---

# 13. GitHub durability rule

全タスクで:

```text
final chat response にしか存在しない重要知見 = 0
```

を完了条件にする。

Codex/Claudeの最終回答はGitHub成果の要約に限定する。

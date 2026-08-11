# 2026 NPB 走力査定 — Gate再開・全数監査

作成日: 2026-08-11  
状態: **CURRENT / GATE REOPENED**  
対象: 2026 NPB野手100人の走力査定

## 0. 結論

2026-08-11に一度 `2026 NPB 100-player SPEED APPRAISAL GATE: CLOSED AFTER REOPEN` まで進めたが、その後のユーザー再レビューと全成果横断監査で、**査定工程の一部未実施と、証拠排除ルールの過剰な厳格化**が確認された。

したがって、旧Gate閉鎖は完成扱いしない。現在の正しい状態は:

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
```

旧blind freezeは削除しない。位置づけを:

```text
NPB+ TOP-SPEED-CENTERED INDEPENDENT PHYSICAL APPRAISAL
```

とし、実際にゲームへ採用する走力は、今後作る:

```text
POWERPRO-INFORMED PRACTICAL SPEED APPRAISAL
```

へ置き換える。

今回の中心的な失敗は、データが無かったことではない。**不完全な情報を低い重みで使う方法を作らず、条件が完全でない情報を0扱いしすぎたこと**である。

---

# 1. ここまで完了した主要成果

## 1.1 走力定義・原則

- 走力は一歩目から約90ftまでの野球上の身体的running ability。
- 盗塁技術、走塁判断、スライディング、リード等は別能力。
- NPB+ Sprint SpeedとStatcast Sprint Speedは同一定義と仮定しない。
- 30m/50mを距離比例でT90へ変換しない。

## 1.2 2026 NPB+ / exposure

- 100/100人のNPB+ Sprint Speedを取得。
- 100/100人のPA・試合数・full-effort-run proxyを取得。
- NPB+の選手別qualified run count / sample count / aggregation methodは公開確認できず。

## 1.3 身体証拠

- physical measurement raw recordsを大規模収集。
- Historical High-Confidence Anchor Bank:
  - raw physical measurements: 459
  - high-confidence anchors: 113
  - current NPB+ moderate anchors: 100
  - pairwise graph: HIGH 101 / MODERATE 99
- direct T90を複数選手年代で確認。
- 2022大学候補の光電管50m cohort等を保存。

## 1.4 PowerPro長期パネル

branch: `codex/pawapuro-speed-history-panel`  
commit: `7d2e35dddd3f523c5c223813bdd65587605fe07b`

- 23,206 observations
- 2,972 canonical player IDs
- 58 archived versions
- 2016-2026を中心にカバー
- 2015 independent snapshotは欠損

身体測定時点とのjoin:

branch: `codex/speed-physical-evidence-full`  
commit: `94a26e7160a879ea0e13f4ddb91d4fdadc7c04e9`

- 測定年が既知の16 measurement clusters / 15 playersについて当時PowerProと2025終了値を結合。
- 例:
  - 林琢真: 87 -> 82
  - 友杉篤輝: 81 -> 87
  - 奈良間大己: 64 -> 64
  - 筒香嘉智: 52 -> 45
  - 秋山翔吾: 72 -> 77
  - ポランコ: 67 -> 63
  - カリステ: 87 -> 82
  - サンタナ: 47 -> 47
  - 塩見泰隆: 69 -> 83
  - モンテロ: 49 -> 49

**重要:** この成果物自身が「相関分析・現在査定変更は行っていない」と明記している。つまりtemporal data collectionは完了したが、**古い身体測定のcurrent carryover policyは未完成**。

## 1.5 The Show

Speed long panel / full attributesを収集。

主なSpeed history成果:

- editions 21-26を中心に大規模取得
- current/live item snapshot主体
- explicit historical Speed change eventが極端に少ない
- negative Speed change event / unchanged controls / dated pre-update Statcastを十分確保できず
- temporal policyは `NOT_IDENTIFIABLE / INSUFFICIENT`

ただし、これは**The Showを同時点換算へ使えないことを意味しない**。旧実装にはStatcast→The Show、Statcast→PowerProの変換研究があり、The Show→PowerPro bridgeは未完のまま残っている。

## 1.6 SNS / Grok-X

ordinary-web SNS branch: `codex/speed-2026-sns-consensus-tiebreak`  
commit: `44f35988e0fcadc59a59c11a299fc43f2158417a`

Grok-X rescue branch: `codex/speed-2026-grok-x-sns-rescue`  
commit: `063f0013b2dc044d71c9cec6ed6209978805d2f5`

Grok-X結果:

- x_search: 175/175 success
- raw hit occurrences: 267
- unique candidates: 191
- accepted X posts: 41
- rejected: 150
- strict independent qualifying X >=2: 11/19
- combined result:
  - SUPPORTS_CURRENT_ORDINAL 5
  - TEMPORAL_CHANGE_SUPPORTED 2
  - METRIC_CONSTRUCT_CONFLICT 2
  - MIXED_CONSENSUS 2
  - INSUFFICIENT 8

重要な定性結果:

- 木下拓哉: 複数独立投稿が一貫して遅い側
- 岡大海: 速さ・加速を複数独立投稿が支持
- 並木秀尊: 現在も非常に速い方向
- 塩見泰隆: 現在も速い方向
- 鈴木大地: 遅い側を支持
- 藤岡裕大: 過去より脚力低下の可能性
- 丸佳浩: 過去より脚力低下の可能性
- 土田龍空: 速い/普通/遅いが混在
- 梅野隆太郎: mixed
- 友杉篤輝: 速いことは支持、林とのphysical ordering conflictは未解決

## 1.7 targeted evidence / video

Targeted evidence branch: `codex/speed-2026-final-targeted-evidence-rescue`  
commit: `9f664bfadd03fdbb8f3bc31790193abfd8de0f94`

- active target 18/18
- current physical measurement found: 1（モンテロ2024 direct T90）
- 筒香2022 T90=4.20をBaseball Savant上で再確認し `CONFIRMED_PRIMARY` に訂正
- video queue 17

Video branch: `codex/speed-2026-final-video-tiebreak`  
commit: `50a28cc77c7c71a8d3101990555165ebb0428d36`

- 17/17
- candidates 32
- accepted source 1（context-only）
- ordinal判断に使えるusable current full-effort video: 0
- 17/17 VIDEO_INCONCLUSIVE

**重要:** これは「世の中に有用動画が存在しない」ではなく、今回の取得経路と厳格な採用条件では利用可能にできなかった、というnegative finding。

## 1.8 blind final freeze / PowerPro QA

branch: `codex/speed-2026-final-reappraisal-freeze`

- BLIND_FINAL_FREEZE_SHA: `7b82bb2030bf94f40d5983618f6e7362d8f2a06b`
- FINAL_GATE_SHA: `1db37ed11bfb4070c03afe530c9dfb7c12244a79`
- 100/100
- PowerPro exact match: 99
- post-QA rating changes: 0
- final mean 65.343 / PowerPro mean 65.667
- MAE 7.758 / RMSE 9.839 / corr 0.776

ただしblind-v3基準との比較では98人据え置き、1人変更（モンテロ68→52）、1人旧baselineなしであり、**大量に収集したphysical/SNS/temporal evidenceが最終point estimateへほとんど入らなかった**。

---

# 2. 重大な未実施 / 不十分工程

## 2.1 PowerPro temporal policy

**未完。**

長期パネルを収集し16測定へjoinしたが、以下を行っていない。

- measurement-era PowerPro→current PowerProの分布分析
- 作品間score distribution normalization
- percentile / quantile trajectory
- age×position×initial-band別の変化
- injury/recoveryとのjoin
- veteran stale/inertia detector
- old T90/30m/50mのcarryover weight決定
- historical holdout validation

ユーザー指摘どおり、秋山翔吾・過去の松山竜平のように、ベテランでPowerProの走力が長期間維持されるケースを正式に監査する必要がある。

## 2.2 PowerProの据え置き・stale評価

PowerProは強いpriorにするが、無条件に正解扱いしない。

必要なstatus:

- `CURRENT_RELIABLE_PRIOR`
- `CURRENT_BUT_UNCERTAIN`
- `STALE_PRIOR_SUSPECTED`
- `COMMUNITY_DISPUTED`
- `OWNER_DISPUTED`
- `NO_POWERPRO_AT_MEASUREMENT_DATE`

ベテラン、故障後、長期据え置き、Prospiと乖離、communityで高すぎ/古いとの反応があるケースはpriorを弱める。

## 2.3 一塁到達・加速

旧実装ではHP→1BにもPowerProとの説明力があることを確認していたが、後工程で一律 `CONTEXT_ONLY` にしすぎた。

今後は:

- LHH/RHH分離
- bunt / normal swing分離
- sample count
- fastest / median / upper quartile
- effort context
- year
- same-condition comparison

を持たせ、**low-to-medium confidence acceleration evidence**として使う。

「一塁到達だけで走力を決めない」は維持するが、「一塁到達を点数へ一切使わない」は撤回する。

## 2.4 実戦の混合情報

後工程で排除しすぎたため、以下を低重みで再投入する。

- base-to-base running
- infield grounder events
- infield-hit tendency after batted-ball/context adjustment
- GIDP avoidance after batted-ball/context adjustment
- triples after park/batted-ball adjustment
- pinch-runner usage
- official scouting
- defensive straight-line chase speed when route/reaction can be separated

盗塁技術・走塁判断は引き続き別能力だが、混合データを「0情報」にしない。

## 2.5 SNSの使い方

Grok-X監査では `GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED` としてPowerPro/Prospi査定への言及を除外した。これは現在の目的に対して過度に厳しい。

今後SNSは2 laneに分離する。

### Physical Observation Consensus

- 足が速い/遅い
- 一歩目
- 加速
- 直線速度
- 昔より落ちた/戻った
- player A vs B

### Rating Consensus

- PowerPro走力が高すぎ/低すぎ
- Prospiの方が自然
- 走力ではなく走塁得能で表すべき
- injury/agingが反映されていない
- 昔の俊足イメージを引きずっている
- 更新で改善/悪化

Rating Consensusはphysical measurementではないが、**PowerPro priorの信頼度を評価する情報**として使用する。

## 2.6 YouTube / official rating comments

未実施。

対象:

- KONAMI新能力紹介動画
- 選手能力公開動画
- update紹介動画
- Prospi能力紹介
- official X能力紹介投稿への返信

取得方法:

- YouTube Data API
- user copy/paste
- CSV/JSON upload
- Grok-X

分類例:

- `RATING_TOO_HIGH`
- `RATING_TOO_LOW`
- `STALE_RATING`
- `INJURY_NOT_REFLECTED`
- `ACCELERATION_NOT_REFLECTED`
- `TOP_SPEED_OVERRATED`
- `PROSPI_MORE_PLAUSIBLE`
- `POWERPRO_MORE_PLAUSIBLE`
- `COMPARE_OTHER_PLAYER`
- `JOKE_OR_MEME`

## 2.7 generic SNS labelsの扱い

Grok-Xではgeneric/ambiguous labelを大量に棄却した。今後は:

- 強い証拠
- 中程度
- 弱いが方向あり
- rating/community evidence
- noise

へ分け、弱い情報を0扱いしない。

同一場面の複数反応はindependent observationとしては1 originにまとめるが、reaction volumeは別フィールドに保存する。

## 2.8 Owner review

旧実装にはowner/scouting inputの仕組みがあったが、100人走力で正式工程に接続しなかった。

今後、**PowerProとの差が5以上**の全選手を必ずowner reviewへ回す。

追加対象:

- veteran stale suspect
- injury後据え置き
- Prospi vs PowerPro large conflict
- The Show converted vs PowerPro conflict
- community dispute

Owner verdict:

- `POWERPRO_PLAUSIBLE`
- `POWERPRO_TOO_HIGH_STALE`
- `POWERPRO_TOO_LOW`
- `PROJECT_TOO_HIGH`
- `PROJECT_TOO_LOW`
- `PROSPI_MORE_PLAUSIBLE`
- `UNRESOLVED`

owner verdictはGitHubへ保存し、後工程で自動上書きされないQAを入れる。

## 2.9 The Show→PowerPro bridge

未完成。

The Show temporal policyが識別不能だったことと、同時点conversionが不可能であることを混同しない。

必要モデル:

1. `PowerPro Speed ~ The Show Speed`
2. Statcast intermediary bridge
3. percentile / quantile mapping

候補:

- linear
- piecewise linear
- isotonic
- quantile mapping

検証:

- year holdout
- player holdout
- foreign-player holdout
- fast/slow band MAE
- calibration curve

出力:

- converted_powerpro
- converted_low
- converted_high
- confidence

利用先:

- NPB収録前の助っ人
- 測定時点にPowerProが無いMLB選手
- PowerPro historyの欠損補完

## 2.10 Prospi

体系的には未実施。

必要:

- current speed
- historical changes
- PowerProとの同時点比較
- rating comments
- stale QA

PowerProとProspiの双方が高い/低い、片方だけ高い/低いを分ける。

## 2.11 Anchor/pairwise

113 high-confidence anchorsを作ったが、100人pairwise graphの多くはNPB+ ordinal候補だった。`CLEARLY_FASTER/SLOWER` を0にするなど、measurement errorが無いことを理由に相対判断を止めすぎた。

今後はexact measurementだけでなく、evidence-weighted pairwise probability / rangeを認める。

## 2.12 Video

17人32候補の収集は実施したが、取得不能・transition contaminationを理由にusable 0となった。

今後はpure T90 evidenceとは別に:

- context video
- acceleration impression
- repeated same-player run
- community reaction

として低重みで残す。

---

# 3. PowerProを今後どう使うか

## 3.1 立場

PowerProは単なる外部QAより強く扱う。

理由:

- KONAMIは継続的に選手を査定
- 長期間の映像・実戦観察がある可能性
- 非公開/取得困難な一塁到達や加速情報を利用している可能性
- 人員・時間・データ量が本プロジェクトより大きい
- ユーザー目視ではPowerProの方が自然なケースが多い

ただしPowerProは絶対正解ではない。

## 3.2 強いpriorとして使う条件

- current version
- temporal trajectoryが合理的
- Prospiと整合
- current physical evidenceと大矛盾なし
- rating communityも大きな違和感なし
- ownerが違和感なし

## 3.3 priorを弱める条件

- 3年以上ほぼ据え置き
- veteran / aging
- major injury後も据え置き
- NPB+/H2F/current evidenceと大幅乖離
- Prospiだけ低下
- communityでstale/highと複数指摘
- owner disputed

---

# 4. 新しい証拠階層

## Tier A — current direct physical

- current T90
- current T10/T30
- standardized electronic 30m/50m

## Tier B — current practical running

- NPB+ top speed
- adjusted home-to-first
- base-to-base
- official training sprint
- official video

## Tier C — historical physical

- old T90
- old electronic 30m/50m
- manual/profile sprint

Temporal modelでweightを決める。

## Tier D — game/scouting priors

- PowerPro current/history
- Prospi current/history
- The Show converted speed

## Tier E — human evidence

- owner
- official scout
- reporters
- SNS physical consensus
- SNS rating consensus
- YouTube comments

## Tier F — outcome proxies

- infield hit
- GIDP avoidance
- triples
- extra-base advancement
- pinch-runner usage

交絡を保持して低～中重みで使用する。

---

# 5. 2種類の最終走力を保存する

## A. `physical_speed_estimate`

公開physical / current speed data中心の独立推定。

現在のblind freezeはこの系統の成果として保存する。

## B. `practical_powerpro_style_speed`

実際にゲームへ入れる査定。

入力:

- PowerPro prior/history
- Prospi
- The Show conversion
- top speed
- acceleration / H2F
- direct/standardized measurements
- context metrics
- SNS physical
- SNS rating
- official comments
- owner verdict

各選手に:

- low / point / high
- confidence
- PowerPro prior status
- owner verdict
- major discrepancy reason
- evidence used
- evidence downweighted
- unresolved flags

を保存する。

---

# 6. 再構築critical path

## Phase 0 — 正本修正

- Gate status ACTIVE / REOPENED
- prior final GateをSUPERSEDED扱い
- このauditをcurrent gap auditとして保存

## Phase 1 — PowerPro temporal / stale audit

- long panel正規化
- same-date conflict resolution
- edition distribution normalization
- age/position/band trajectory
- veteran inertia/stale detector
- injury/recovery timeline
- 秋山・松山等case audit
- old physical carryover policy

## Phase 2 — context-inclusive acceleration

- NPB+ top speed
- H2F
- bunt H2F
- base-to-base
- infield grounders
- infield-hit/GIDP/triples contextual residuals
- pinch-runner usage
- injury context

## Phase 3 — The Show / Prospi bridge

- The Show→PowerPro conversion
- foreign-player historical backfill
- Prospi current/history collection

## Phase 4 — community appraisal

- physical SNS
- PowerPro/Prospi rating comments
- official YouTube comments
- official X replies
- appraisal blogs

## Phase 5 — owner review

- all |PowerPro-project| >=5
- veteran stale suspects
- community conflicts
- game-to-game conflicts

## Phase 6 — 100-player reappraisal

- practical_powerpro_style_speed 100/100
- physical estimateは別列で保持
- no silent fallback
- owner verdict protection

## Phase 7 — validation

- all >=5 residuals explained
- simulation/engine distribution QA
- owner final approval

---

# 7. Claude / Codex / GPTの役割

今後は同一系統AIの思考偏りを避ける。

## Claude Code

**査定思想・壁打ち・red-teamの主担当。**

- 実装前に前提を疑う
- 既存モデルの欠点を探す
- evidence weightingを設計
- PowerPro priorとstale detectionを設計

## Codex

**データ処理・実装・大規模収集。**

- DB分析
- scraping / API
- model build
- reproducible outputs
- QA

## GPT

**独立レビュー・統合。**

- Claude案とCodex結果の矛盾確認
- missing workflow検出
- owner review package整理

## Owner

**最終査定責任者。**

- >=5 discrepancy全レビュー
- veteran/stale判断
- official ratingの違和感を最終裁定

---

# 8. Definition of Done

次をすべて満たすまで走力Gateを閉じない。

- [ ] PowerPro long panelを収集ではなくtemporal/stale分析した
- [ ] old physical carryover policyを検証した
- [ ] veteran stale detectorを作った
- [ ] 秋山・松山等をowner reviewした
- [ ] H2Fを調整済み加速材料として実際に使った
- [ ] base-to-base等context情報を低重みでも統合した
- [ ] The Show→PowerPro conversionをholdout検証した
- [ ] foreign-player measurement-eraへ適用した
- [ ] Prospi current/historyを必要範囲で統合した
- [ ] PowerPro/Prospi査定コメントを収集した
- [ ] official YouTube commentsを収集またはowner uploadで統合した
- [ ] |diff|>=5を全員owner reviewした
- [ ] owner verdictが後工程で上書きされない
- [ ] physical estimate / practical estimateを分離した
- [ ] 100人practical reappraisalを完成した
- [ ] all >=5 residualsに説明を付けた
- [ ] engine/simulation QAを実施した
- [ ] owner final approvalを得た
- [ ] final chat only knowledge = 0

---

# 9. Current status

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
```

Shoulder phaseには進まない。

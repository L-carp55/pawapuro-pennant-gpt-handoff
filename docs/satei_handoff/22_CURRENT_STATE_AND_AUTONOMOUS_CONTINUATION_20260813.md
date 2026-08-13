# 走力再構築 — 現在地と自律継続ルール

作成日: 2026-08-13  
状態: **CURRENT HUMAN SUMMARY / machine registry優先**  
対象branch: `agent/claude-speed-redteam-20260812`

---

## 0. Authority

この文書は人間向け要約であり、task statusの正本ではない。

正本:

- `docs/state/speed_task_registry.tsv`
- `docs/state/speed_requirements_baseline_20260813.tsv`
- `docs/state/speed_legacy_open_item_map.tsv`

本書とregistryが衝突したらregistry優先。

新handoff / owner review ready / Gate close / 肩力開始の前に:

```bash
node scripts/qa_speed_task_registry.mjs
```

を必ずPASSさせる。

---

## 1. 現在の正式状態

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
OWNER REVIEW: NOT READY
SHOULDER: BLOCKED
```

既存100人master tableはpreliminary asset。旧owner review queueはSUPERSEDED。

---

## 2. 確定済みの重要事項

### Existing production control

Claude離脱前からproduction statistical speed modelが存在していた。

- triple
- GIDP avoidance
- infield hit
- advance
- UBR
- multi-year pooling
- baserunning skill residualization

を持つ。再構築案はこれをcontrolとして比較する。

### GPT/Codex旧blind baseline

99人がNPB+最高速度のほぼ完全な一次関数だった。大量に集めた証拠が点数へほぼ接続されていなかったため、実用最終値として使わない。

### T-0198

`maxSeason`修理済み。時間holdout時に未来年を切れる。未指定時の旧挙動は維持。

### NPB+

- raw NPB+には現実アウトカムへの信号がある。
- 現行 `NPB+ -> PowerPro label regression -> blend` は、教師値・重み・回帰による幅縮小・scale混在・循環に構造問題がある。
- rolling temporal comparisonは過去NPB+ snapshotがなく公平化できないため `NOT_IDENTIFIABLE`。
- T-0203はC。最も統計材料が薄い1年層がn=2で、conditional valueを判定できなかった。
- 現時点では自動blendを使わず、raw NPB+はlow-reliability選手のreview/conflict evidenceとして保持。
- T-0204で2026終了後に同じ事前定義を再実行する。

### Absolute scale

relative orderingとは別問題。

現行 `scale_calibration.走力` はPowerPro由来で最終正本ではない。能力値→engine走力効果の橋が未実装なので、engine responseでの最終校正は依存待ち。

---

## 3. 今回の全数監査で復元した未完工程

詳細statusは `docs/state/speed_task_registry.tsv` を見る。

### Community / rating evidence

既存ordinary SNS / Grok-X acceptedは主にPhysical Observation。

owner review前に必須:

- 旧Grok-X rejectのRating Consensus再分類
- PowerPro公式YouTube能力紹介/update comments
- Prospi公式YouTube comments
- PowerPro/Prospi official X replies・rating criticism/praise
- weak generic labelsの救済
- same-event dedupe / reaction volume

Codex task:
`docs/tasks/CODEX_SPEED_COMMUNITY_RATING_RESCUE_20260813.md`

### PowerPro temporal/stale

- version conflict normalization
- edition distribution / percentile trajectory
- stale/inertia再判定
- 秋山翔吾 / 松山竜平等のcase study
- age/birth join（現データでは欠損）
- injury/recovery join（未統合）

### The Show

- collection自体は既存資産として保持
- temporal response policyはnegative finding / NOT_IDENTIFIABLE
- same-time The Show→PowerPro mappingはpartial
- direct / quantile / isotonic / piecewise比較と正しいholdoutが未完
- validated mappingの該当助っ人適用が未完

### Prospi

- current speed未完
- historical speed未完
- PowerProとのsame-time divergence未完

### Flexible evidence / legacy cleanup

- strict current acceleration prior alpha=0のnegative findingは保持
- revised flexible/context acceleration laneはpartial
- official scouting / pinch-runner usage / defensive straight-line chase speedの実施・不要・blocked判定が未完
- 2026-08-05 `all_missing_data`親タスクは結果文書が「調査中」のままなので、後続task IDへ明示的に精算する必要がある

### Review / finalization

- community/Prospi/The Show/temporalを入れたconflict・stale再診断
- final owner review queue
- owner verdict no-overwrite QA
- final practical 100-player reappraisal
- full-roster scale consistency
- engine/simulation QA
- Gate close

---

## 4. Autonomous continuation

逐次owner確認は原則不要。

現在は、依存関係が許すものを並列に進める:

1. Codex Community Rating / YouTube / Prospi collection
2. PowerPro version normalization / stale analysis
3. The Show same-time mapping completion
4. age/injuryについて既存sourceを先に監査し、無ければBLOCKEDを明示
5. flexible/context evidenceの残件整理
6. legacy all-missing-data speed子要件の精算

その後:

7. 100人master tableへjoin
8. PROJECT_EVIDENCE_CONFLICT再診断
9. PowerPro stale/odd再診断
10. final owner review queue生成

ownerへ戻すのは、AI側の根拠を使い切っても判断が必要なケースだけ。

---

## 5. Stop conditions

次のいずれかでのみownerへ確認する:

- final owner review queueが完成した
- 独立QAでも複数の実装候補の優劣が決まらない
- absolute scaleの候補がengine QAでも決まらない
- 新しい大規模外部取得が必要で、費用・規模・依存追加の判断が必要
- owner自身の野球観/PowerPro違和感が最終判定に必要

BLOCKED / WAITING_EXTERNALの存在だけを理由に、他の独立タスクまで停止しない。

---

## 6. Fail-closed rules

- registryに無い新タスクをchatだけで開始しない
- 新しいowner requirementが出たらbaseline+registryへ先に追加
- old proseから新handoffへ未完項目を手動コピーしない
- parent label（SNS / The Show / PowerPro panel等）だけでDONEにしない
- negative findingと未実施を区別
- artifact存在とcompletionを区別
- preliminary owner queueをfinalとして送らない
- Gate blockerが1件でも残る間はGate closeしない
- Speed Gate完了前は肩力へ進まない

---

## 7. 一文で現在地

> **走力のデータ/既存統計モデル/NPB+検証基盤はかなり進んだが、Rating Consensus・公式YouTube/X・Prospi・PowerPro staleの完成・The Show same-time mapping・一部補助証拠・absolute scale/engine依存・final owner reviewが未完。これらをtask registryでfail-closedに追跡し、owner review前にAI側で可能な限り解決する段階。**

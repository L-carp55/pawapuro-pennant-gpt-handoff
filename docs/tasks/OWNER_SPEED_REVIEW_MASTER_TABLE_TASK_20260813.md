# Task — 2026 NPB 走力 Owner Review Master Table

作成日: 2026-08-13  
状態: **CURRENT NEXT TASK**

---

## 0. 目的

オーナーに走力の目盛りや100人の点数をゼロから決めてもらうのではない。

**AI側が先に100人全員を整理・説明し、その後で判断が必要な選手だけをオーナーへレビュー依頼する。**

オーナーが元々求めていた形式:

> project側の査定走力とその根拠、PowerProの査定能力と過去の査定推移、差が大きい場合はなぜ差が生じたと考えられるかまでAI側でまとめる。その後、差が大きい選手と査定信頼度が低い選手をオーナーがレビューする。

---

## 1. 禁止事項

このタスクでは:

- ownerに「T90 4.05秒→何点？」等の目盛りを決めてもらわない
- ownerに17人/100人の点数を1人ずつ付けてもらわない
- 新しいfinal ratingへ書き換えない
- PowerProへfitしない
- owner回答待ちになる前に、AI側でできる分析を残さない

`OWNER_SPEED_ANCHOR_SHEET_20260812.md` と `OWNER_SPEED_ANCHOR_TABLE_V2_20260812.md` はSUPERSEDED。

---

## 2. 入力の正本

最低限以下を使用する。

### GPT/Codex 100人査定

- `outputs/derived/speed_2026_100_final_reappraisal_freeze_20260811.csv`
- `outputs/derived/speed_2026_100_final_reappraisal_freeze_20260811.json`
- blind freeze audit / manifest

### PowerPro current / history

- `outputs/derived/pawapuro_speed_history_panel_2015_2026.*`
- `outputs/derived/speed_2026_100_final_reappraisal_powerpro_qa_20260811.json`
- PowerPro discrepancy / residual artifacts

### Physical / exposure

- 100-player master evidence / decision packets
- physical evidence full ledger
- measurement-date resolution
- exposure audit
- historical physical measurement ledger
- targeted evidence rescue

### SNS / qualitative

- ordinary SNS ledger
- Grok-X accepted/rejected ledger
- combined consensus v2
- targeted new6 X sources
- video negative findings

### Claude existing production model

Claude red-teamで確認したexisting production speed modelを、100人へ再現可能な場合はcontrolとして出す。

ただしこの列をGPT/Codex査定へ混ぜない。

---

## 3. 100人 master table の必須列

機械可読CSV/JSONと、人が読めるMarkdownの両方を作る。

### Identity

- `player`
- `player_id`
- `team`

### Project appraisal

- `gpt_codex_rating`
- `gpt_codex_low`
- `gpt_codex_high`
- `gpt_codex_confidence`
- `gpt_codex_decision_class`
- `gpt_codex_short_rationale`

### Existing production control

可能なら:

- `existing_production_model_rating`
- `existing_production_model_basis`
- `existing_production_model_status`

再現できない場合はnull＋理由。推測で埋めない。

### Current physical context

- `npb_plus_sprint_kmh`
- `exposure_games`
- `exposure_pa`
- `direct_t90_summary`
- `standardized_30m_50m_summary`
- `home_to_first_summary`
- `historical_physical_summary`
- `physical_evidence_strength`

### SNS / observation

- `sns_physical_classification`
- `sns_physical_summary`
- `video_classification`

### PowerPro

- `powerpro_current_speed`
- `powerpro_match_status`
- `powerpro_history_summary`
- `powerpro_change_points`
- `powerpro_years_since_material_change`

`powerpro_history_summary` は例:

```text
2016:60 → 2018:68 → 2020:68 → 2022:72 → 2024:72 → 2026:69
```

のように、人間が一目で変遷を読める形式も保存する。

同年に複数versionがある場合は、重要change pointを保持し、単純に最後の1値だけへ潰さない。

### Discrepancy

- `project_minus_powerpro`
- `abs_project_powerpro_diff`
- `large_diff_ge_5`
- `discrepancy_direction`
- `discrepancy_reason_class`
- `discrepancy_reason_explanation_ja`
- `discrepancy_reason_confidence`

### PowerPro stale / project error flags

- `powerpro_stale_suspected`
- `powerpro_stale_reason`
- `project_top_speed_overweight_suspected`
- `project_acceleration_missing_suspected`
- `historical_evidence_conflict`
- `current_exposure_risk`

### Owner review

- `owner_review_required`
- `owner_review_reasons`
- `owner_verdict`（空欄）
- `owner_note`（空欄）
- `owner_preferred_rating_optional`（空欄）

---

## 4. 「差が生まれた理由」の作り方

数値差だけを見て理由を生成しない。

必ず利用可能な証拠を突き合わせる。

候補classの例:

- `PROJECT_TOP_SPEED_ONLY_UNDERESTIMATE`
- `PROJECT_TOP_SPEED_OVERWEIGHT`
- `POWERPRO_ACCELERATION_OR_SHORT_DISTANCE_HIGHER`
- `POWERPRO_STALE_HIGH_SUSPECTED`
- `POWERPRO_STALE_LOW_SUSPECTED`
- `HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO`
- `CURRENT_PHYSICAL_SUPPORTS_PROJECT`
- `LOW_EXPOSURE_NPBPLUS_RISK`
- `TEMPORAL_CHANGE_NOT_CAPTURED`
- `METRIC_CONSTRUCT_CONFLICT`
- `SNS_SUPPORTS_POWERPRO_DIRECTION`
- `SNS_SUPPORTS_PROJECT_DIRECTION`
- `NO_CLEAR_CAUSE`

複数原因がある場合は複数保持してよい。

### 重要

例としてPowerProがprojectより15点高いからといって、

> 「PowerProが加速を見ている」

と自動断定しない。

H2F / T90 / short-distance / SNS / history等がその方向を支持した場合のみ書く。

証拠が無ければ `NO_CLEAR_CAUSE` とする。

---

## 5. stale / inertia判定

PowerProの過去推移を必ず見る。

候補例:

- 長年ほぼ同じ値
- 高齢化してもほぼ維持
- 故障や現在physical低下と反対
- SNSで「昔の査定のまま」等が複数

ただし年数だけでstaleと断定しない。

`powerpro_stale_suspected=true` は**疑いフラグ**であり、ownerが最終確認する。

秋山翔吾のようなベテラン候補は必ずhistoryを読みやすく表示する。

---

## 6. Owner review対象

### Mandatory

以下のいずれか:

1. `abs_project_powerpro_diff >= 5`
2. `gpt_codex_confidence == LOW`
3. `historical_evidence_conflict == true`
4. `powerpro_stale_suspected == true`

### Not automatically mandatory

- `LOW_MEDIUM` だけ

LOW_MEDIUMはmaster tableに表示するが、それだけで87人全員をreview queueへ入れない。

### Review priority

優先度:

1. stale疑い + 大乖離
2. LOW/conflict + 大乖離
3. abs diffの大きい順
4. stale/conflictのみ

---

## 7. Owner review用Markdown

master tableとは別に、ownerが実際に見る軽量版を作る。

1選手あたり最低限:

|項目|内容|
|---|---|
|選手|...|
|project査定|70（60–78 / LOW）|
|project根拠|...|
|PowerPro現在|82|
|PowerPro推移|2018:... → 2020:... → ...|
|差|-12|
|physical evidence|...|
|SNS|...|
|AIが考える差の理由|...|
|PowerPro stale疑い|YES/NO + 理由|
|オーナー裁定|空欄|

表が横に長くなりすぎる場合、review queueだけは選手ごとの短いsection形式でもよい。

用語は日本語で分かりやすく書く。

---

## 8. オーナー裁定の選択肢

空欄templateとして:

- `POWERPRO_PLAUSIBLE`
- `POWERPRO_TOO_HIGH_OR_STALE`
- `POWERPRO_TOO_LOW`
- `PROJECT_TOO_HIGH`
- `PROJECT_TOO_LOW`
- `BOTH_QUESTIONABLE`
- `UNRESOLVED`
- `OTHER`

数値を付けたい場合のみ `owner_preferred_rating_optional` を使う。

**ownerに数値を付けることを必須にしない。**

---

## 9. 必須成果物

推奨path:

- `outputs/derived/speed_2026_100_owner_review_master_20260813.csv`
- `outputs/derived/speed_2026_100_owner_review_master_20260813.json`
- `docs/reports/speed_2026_100_owner_review_master_20260813.md`
- `docs/tasks/OWNER_SPEED_REVIEW_QUEUE_20260813.md`
- `outputs/derived/speed_2026_100_owner_review_master_qa_20260813.json`

必要ならdiscrepancy reason provenance JSONも追加。

---

## 10. QA

最低限:

- 100/100 rows
- unique player identities
- 名原典彦を保持、IDを捏造しない
- GPT/Codex freeze値がsourceと一致
- PowerPro current値が99 exact match / 名原non-forcedを保持
- PowerPro historyがplayer identityと一致
- diff計算一致
- `abs diff >=5` 全員がreview queueへ入る
- confidence LOW全員がreview queueへ入る
- stale/conflict全員がreview queueへ入る
- LOW_MEDIUMだけで自動flagされていない
- owner fieldsは空欄
- ownerにアンカー作成を要求していない
- discrepancy reasonが証拠なしで断定されていない
- chat-only important knowledge = 0

---

## 11. 完了条件

このタスクの完成は、**ownerへレビュー可能な比較材料を渡せる状態**。

ここではまだ最終走力を変更しない。

オーナー回答後に初めて、Claude red-teamの設計論（独立アンカー、既存production control、PowerProの位置づけ等）を踏まえて、次の査定設計を決める。

# パワプロ査定プロジェクト — Handoff Entry Point

最終更新: 2026-08-13  
状態: **走力Gate ACTIVE / OWNER REVIEW NOT READY / 肩力BLOCKED**

---

## 1. 最初に読むもの

走力については、proseのhandoffを正本にしない。次の順で読む。

1. `../state/speed_task_registry.tsv` — **現在タスク状態の唯一の正本**
2. `../state/speed_requirements_baseline_20260813.tsv` — **消してはいけない要件ベースライン**
3. `../state/speed_legacy_open_item_map.tsv` — 旧未完工程→現タスクID移行表
4. `22_CURRENT_STATE_AND_AUTONOMOUS_CONTINUATION_20260813.md` — 人間向け現在地
5. `../audits/speed_task_completeness_and_handoff_root_cause_20260813.md` — 漏れ全数監査と再発防止
6. 必要な個別audit / source artifact

旧 `17_SPEED_GATE_REOPENED_20260811.md`、`18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`、`19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md` は履歴・要件発見元として残すが、**現在のタスク状態を決める正本ではない**。

---

## 2. 現在の状態

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
OWNER REVIEW: NOT READY
SHOULDER: BLOCKED
```

現在の100人owner review master tableはpreliminary。旧owner queueはSUPERSEDED。

最終owner review前に少なくとも、task registryで `owner_review_block=1` のタスクを閉じる必要がある。特に:

- Rating Consensus用の旧Grok-X reject救済
- PowerPro公式YouTube comments
- Prospi公式YouTube comments
- official X replies / rating discussion
- weak generic SNS recovery / same-event dedupe
- PowerPro version normalization / stale再判定
- The Show same-time mappingの検証と該当助っ人適用
- Prospi current/history + PowerPro divergence
- conflict再診断

が未完。

---

## 3. 完了宣言前の必須QA

```bash
node scripts/qa_speed_task_registry.mjs
```

以下の前に必須:

- 新handoff / CURRENT文書作成
- taskをDONEへ変更
- owner review ready宣言
- Speed Gate close
- 肩力開始

FAILしたら進めない。

---

## 4. 今回の引継ぎ事故からのルール

- 「SNS済み」では完了にしない。Physical / Rating / YouTube / X / Prospiを別task IDで追う。
- 「The Show済み」では完了にしない。collection / temporal negative / same-time mapping / holdout / applicationを別task IDで追う。
- 「PowerPro panel済み」では完了にしない。collection / normalization / stale / age / injury / community/Prospi QAを別task IDで追う。
- ファイル存在だけではDONEにしない。completion artifactは非空でなければならない。
- negative findingはDONE_NEGATIVE_FINDINGとして保存し、未実施にも成功にも変換しない。
- blocked / waitingは消さず明示する。
- 新しいowner指示でscopeが増えたら、まず `speed_requirements_baseline_20260813.tsv` と `speed_task_registry.tsv` へ追加してから作業する。
- 新handoffは旧未完工程を手作業でコピーしない。registryを参照する。

---

## 5. AIの役割

- Claude Code: 査定思想・red-team・統合。停止条件まで自律継続。
- Codex: read-heavy収集・DB/API・再現可能成果物。複数subagent＋独立QAを使用。
- GPT: 独立レビュー・漏れ監査・正本整合。
- Owner: AIでは決められない個別査定・stale/odd・最終acceptanceのみ。

重要知見はすべてGitHubへ保存し、`final chat response にしか存在しない重要知見 = 0` を守る。

---

## 6. 一般仕様の参照

走力の現在タスク状態とは別に、一般設計を確認する場合:

- `12_APPRAISAL_PRINCIPLES_20260809.md`
- `01_HISTORY_DECISION_LOG.md`
- `02_CURRENT_SPEC_V2.md`
- `03_FORMULAS_DATA_CONTRACTS.md`
- `04_RUNNING_DEFENSE_CATCHER.md`
- `05_SPECIAL_ABILITIES_KONAMI.md`
- `09_QA_TESTS_OPEN_QUESTIONS.md`
- `10_SOURCE_CATALOG.md`
- `11_LEGACY_REFERENCE_V1_9.md`

を使う。ただし走力の進行状態は常にtask registry優先。

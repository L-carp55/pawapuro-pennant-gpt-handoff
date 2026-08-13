# MANIFEST — Current State Index

最終更新: 2026-08-13

> 旧2026-07-31版は当時の12ファイルのchecksum snapshotだったが、その後ファイルが更新・追加されており、現在の進行正本としては失効している。**古いSHA256表を現在の完全性証明として使わない。**

## 現在の走力state authority

- `docs/state/speed_task_registry.tsv` — 現在タスク状態の唯一の正本
- `docs/state/speed_requirements_baseline_20260813.tsv` — 不変要件ベースライン
- `docs/state/speed_legacy_open_item_map.tsv` — 旧未完工程から現タスクへの移行表
- `docs/satei_handoff/22_CURRENT_STATE_AND_AUTONOMOUS_CONTINUATION_20260813.md` — 人間向け現在地要約
- `docs/audits/speed_task_completeness_and_handoff_root_cause_20260813.md` — 全数監査・根本原因・再発防止

## State QA

- `scripts/qa_speed_task_registry.mjs`
- `.github/workflows/speed-task-registry-qa.yml`

新handoff、owner review ready、Speed Gate close、肩力開始の前にvalidator PASSが必須。

## Community rescue

- `docs/tasks/CODEX_SPEED_COMMUNITY_RATING_RESCUE_20260813.md`

旧SNSはPhysical Observation中心。Rating Consensus / PowerPro・Prospi公式YouTube / official X replies / Prospi current-historyは別タスクで未完。

## Historical documents

`17/18/19`、旧Gate、旧critical path、2026-07-31以前のhandoff群は履歴・要件発見元として保持する。現在状態の判定には直接使用せず、`docs/state/speed_legacy_open_item_map.tsv`を通じて現task IDへ解決する。

## 重要

このMANIFEST自体もtask statusの正本ではない。**状態は常に `docs/state/speed_task_registry.tsv` を参照する。**

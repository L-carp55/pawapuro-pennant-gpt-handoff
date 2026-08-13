# 走力 — 現在位置の記録（2026-08-13 セッション2、canon repo移行時点）

## 0. 発見: 作業場所の取り違え

このセッションの前半（community rating run1/run2の検品）は、正しいcanon repo
(`repos/pawapuro-pennant-gpt-handoff`、branch `agent/claude-speed-redteam-20260812`)ではなく、
Hub repo (`claude-code-hub.git`)内の `パワプロ風ペナント開発/` フォルダ（過去にexportされた
古いスナップショット）で行われていた。オーナー指示「GitHub上の最新正本を優先」を受けてcanon repoの
worktreeを新設し(`_worktrees/pawapuro-speed-claude-redteam-continuation`,
branch `agent/claude-speed-claude-redteam-20260813-continuation`)、以後はここで作業する。

## 1. 捨てていない成果（Hub側、`パワプロ風ペナント開発/`、commit `4c2191b2`ほか）

- Community rating run1の失敗分析(yt-dlp引数バグ・Codexサンドボックスのネットワーク遮断・reclassification未着手)
- Community rating run2の検品・統合(旧出力申告漏れ4件の発見・復元含む)
- registry上のSP-032/033/034/035/036/037/054/055のstatus更新

**このPhaseでは着手しない**: オーナー指示により今回はcommunity/YouTube/Prospi等の新規外部調査を広げず、
走力モデル本体(SP-015/016/018/019/007/017)を先に修理する。上記run2成果はcanon repo側の
registryへは未統合。community工程に戻る時に、Hub側の成果物とcanon repo側のexclusion ledger
(EX-010/EX-011、SP-032/035/036/037)を突き合わせて統合する。

## 2. canon repo側で発見した追加の整合性問題（着手前に修理済み）

- SP-041/SP-015/SP-016の完了成果物`.md`が、registry記載パス(`outputs/...`)と異なる実際の保存先
  (`docs/audits/...`)に存在しており、QAが3件FAILしていた → registry側のパス参照を実体に合わせて修正
- `speed_exclusion_reason_ledger.tsv`のEX-001/002/025がSP-017、EX-004/006/007がSP-019、
  EX-005がSP-018を参照していたが、これらのtaskがregistryに存在しなかった → 新規作成
- SR-055〜SR-058(除外原則の新要件)がどのtaskにも紐付いておらず`UNMAPPED REQUIREMENT`でQA FAIL
  → SP-017/018/019/097(新設)へ紐付け

修理後 `node scripts/qa_speed_task_registry.mjs` はPASS
(requirements=58, tasks=69, exclusions=25, open_exclusions=18)。

## 3. 次にやること

オーナー優先順位どおり: SP-015 → SP-016 → SP-018 → SP-019 → SP-007 → SP-017 → 100人before/after再計算 → 最終QA。

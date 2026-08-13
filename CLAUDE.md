# パワプロ風ペナント開発 — Project CLAUDE.md

> 個人で楽しむための、パワプロのペナント機能を改善した全自動試合シミュレーター。

## ★ CURRENT SPEED AUTHORITY — 2026-08-13

走力の現在状態は**散在するhandoff proseではなく、機械可読台帳を正本**とする。

最優先:

1. `docs/state/speed_task_registry.tsv` — **現在のタスク状態の唯一の正本**
2. `docs/state/speed_requirements_baseline_20260813.tsv` — **消してはいけない要件の不変ベースライン**
3. `docs/state/speed_legacy_open_item_map.tsv` — 旧critical path / audit / Codex親タスクから現タスクへの移行表
4. `docs/satei_handoff/22_CURRENT_STATE_AND_AUTONOMOUS_CONTINUATION_20260813.md` — 人間向け現在地要約。台帳と衝突したら台帳優先
5. `docs/audits/speed_task_completeness_and_handoff_root_cause_20260813.md` — 漏れ全数監査・根本原因・再発防止

旧 `17/18/19`、旧Gate文書、過去auditは証拠・履歴として読む。**そこに未完工程が残っていても、`speed_legacy_open_item_map.tsv`を経由して現タスクIDへ追跡する。旧proseを新しいCURRENTとして再採用しない。**

現在の正式状態:

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
OWNER REVIEW: NOT READY
SHOULDER: BLOCKED
```

### 必須QA

以下の前に必ず実行する:

```bash
node scripts/qa_speed_task_registry.mjs
```

- 「完了」「owner review ready」「Gate close」と宣言する前
- 新しいhandoff / CURRENT文書を作る前
- 走力から肩力へ進む前
- `speed_task_registry.tsv` のstatusをDONE系へ変える前

QAがFAILしたら**fail closed**。文章上「終わったように見える」ことを理由に進めない。

---

## 現在までに確定した走力の重要事項

- Claude離脱前から、三塁打 / GIDP回避 / 内野安打 / advance / UBR、多年pool、走力と走塁技術の分離を持つproduction statistical modelが存在していた。これをcontrolとして残す。
- GPT/Codexの旧100人blind baselineは、Claudeの機械検証で99人がNPB+最高速度のほぼ完全な一次関数だった。実用最終値として扱わない。
- T-0198 `maxSeason` 修理済み。時間holdoutで未来年を切れる。
- NPB+には実信号があるが、現行 `NPB+ -> PowerPro label regression -> blend` は教師値・重み・scale・循環に構造問題がある。
- T-0203はC / NOT_IDENTIFIABLE。統計材料1年層がn=2で、低reliability層でのNPB+追加価値を確定できない。現時点では自動blendせず、raw NPB+をreview/conflict evidenceとして保持する。T-0204で2026終了後に事前定義どおり再実行する。
- PowerProの役割は**未確定タスク**。現行のPowerPro由来scaleは暫定で、PowerProを教師値とQAの両方にしない。
- absolute 0-100 scaleはrelative orderingと分離。能力値→engine走力効果の橋が未実装なので最終scale校正は依存待ち。
- 既存owner review master tableはpreliminary asset。旧owner queueはSUPERSEDED。community/Prospi/The Show/temporal等の必須前工程後にfinal queueを再生成する。

### Community evidenceの重要な未完工程

既存ordinary SNS / Grok-X 41 acceptedは主に**Physical Observation lane**。

以下は別タスクで、まだ完了していない:

- 旧Grok-X rejectedのRating Consensus再分類
- PowerPro公式YouTube能力紹介/updateコメント
- Prospi公式YouTube能力紹介コメント
- PowerPro/Prospi公式X replies・査定批評
- weak generic labelsの救済
- same-event dedupe / reaction volume
- Prospi current/history

Codex委任正本:
`docs/tasks/CODEX_SPEED_COMMUNITY_RATING_RESCUE_20260813.md`

---

## 役割分担

### Claude Code
査定思想・red-team・統合判断。停止条件に当たるまで逐次owner確認を要求せず、自律継続する。

### Codex
read-heavy収集・DB処理・API・再現可能成果物・QA。大規模収集では**複数subagentを並列使用し、独立QA agentを置く**。final chat only knowledgeは禁止。

### GPT
Claude/Codex成果の独立レビュー、漏れ監査、GitHub正本整合、owner review package整理。

### Owner
AI側で解けない個別査定・PowerPro stale/odd・最終acceptanceを裁定。AIが解ける工程をownerへ丸投げしない。

---

## 最上位目的

本家ペナントの4つの不満を解消する:

1. 選手の成長と衰えの雑さ
2. CPU球団の編成判断の弱さ
3. 記録・数字の物足りなさ
4. 球団経営の浅さ

査定は自作engineと一体設計し、最終的には能力→成績のleague-level整合でQAする。

---

## 開発・査定原則

- 同じ情報を基礎能力と特殊能力へ二重計上しない。
- エラーは捕球で扱い、守備力へ直接混ぜない。
- 盗塁数・走塁判断を走力へそのまま混ぜない。
- 欠損を0にしない。`null / 0 / 推定 + flag`を区別。
- 不完全な証拠は、交絡・時点・信頼度を記録して低重みで使える形にする。完全でないことだけを理由に0情報扱いしない。
- negative findingは「未実施」と区別して保存し、取得不能を証拠不存在と混同しない。
- raw dataは上書きせず、加工は再現可能にする。
- 未校正係数は設定へ分離し根拠を保存。
- PowerPro / Prospi / The Showはsourceと用途を分離し、循環QAを避ける。
- 重要な結論・coverage・欠損・negative finding・owner verdictはGitHubへ保存し、`final chat response にしか存在しない重要知見 = 0` とする。

---

## データソース・注意

- プロEYE球: 1936-2025年（1945欠）の打撃・投手・守備CSV。選手IDで年またぎ追跡。
- NPB公式は取得元にしない（二次利用禁止の明記があるため）。
- Nippon Baseball Data Repository等の既存repo資産を、年齢/名簿補完候補としてまず監査する。
- 大規模外部取得が必要な場合のみ、規模・費用・新規依存をownerへ確認する。

### 守備位置表記

結合時に表記差で黙って0件になる事故を防ぐ:

- `bm_fld`: `1B/2B/3B/SS/LF/CF/RF/C/P`
- `v_fielding` / DELTA: `一/二/三/遊/左/中/右/捕/投`
- 既存 `POS_JA` 対応を再利用する。

---

## 絶対禁止

- `speed_task_registry.tsv`に無い新しい走力タスクをchatだけで進める
- 新handoff作成時に旧未完タスクを手作業で選別して落とす
- 「SNS済み」「The Show済み」のような親ラベルだけで子タスクをDONE扱いする
- 成果物ファイルが存在するだけで完了扱いする
- preliminary owner queueをfinalとしてownerへ送る
- validator FAILのままGateを閉じる
- Speed Gate完了前に肩力へ進む

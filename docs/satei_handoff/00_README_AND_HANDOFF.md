# パワプロ査定プロジェクト — Claude Code 引き継ぎパッケージ

作成日: 2026-07-31  
最終更新: 2026-08-11  
状態: **走力Gate再開 / Claude Code壁打ち主担当へ移行**  
対象: 実在選手をパワプロ風に査定するための、再現可能・検証可能な野手査定モデル

---

## 1. このパッケージの目的

本パッケージは、長い対話の中で形成・修正された査定思想、誤り、検証結果、撤回事項、未解決課題を、Claude Code / Codex / GPT / オーナー間で引き継げる形に整理する。

最重要事項:

> **過去に出力した具体的な能力値の多くは最終版ではない。**

また、2026-08-11に一度閉じた走力Gateは、後続の全数監査により再度開いた。

現在の正式状態:

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
```

旧blind freezeは削除せず、`physical_speed_estimate` 系列の中間成果として保存する。実際にゲームへ採用する最終走力は、今後作る `practical_powerpro_style_speed`。

---

## 2. 2026-08-11以降の推奨読書順

1. `00_README_AND_HANDOFF.md`
2. `17_SPEED_GATE_REOPENED_20260811.md` **（現在のGate status）**
3. `18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md` **（現在の作業順）**
4. `19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md` **（Claude Code再開用完全handoff）**
5. `../audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md` **（未実施・過度な証拠排除の全数監査）**
6. `12_APPRAISAL_PRINCIPLES_20260809.md` **（一般査定原則）**
7. `13_CURRENT_CRITICAL_PATH_20260809.md` **（旧critical path / history）**
8. `16_SPEED_GATE_FINAL_AFTER_REOPEN_20260811.md` **（旧closed Gate / history）**
9. `01_HISTORY_DECISION_LOG.md`
10. `02_CURRENT_SPEC_V2.md`
11. `03_FORMULAS_DATA_CONTRACTS.md`
12. `04_RUNNING_DEFENSE_CATCHER.md`
13. `05_SPECIAL_ABILITIES_KONAMI.md`
14. `06_CARP_CASE_STUDY_AUDIT.md`
15. `07_WBC2017_PRIME_STATUS.md`
16. `08_CLAUDE_CODE_IMPLEMENTATION_PLAN.md`
17. `09_QA_TESTS_OPEN_QUESTIONS.md`
18. `10_SOURCE_CATALOG.md`
19. `11_LEGACY_REFERENCE_V1_9.md`

---

## 3. 現在の正本

| ファイル | 役割 |
|---|---|
| `17_SPEED_GATE_REOPENED_20260811.md` | **現在の走力Gate status**。旧16をSUPERSEDED扱いにする |
| `18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md` | **現在の進行正本**。Claude red-team→PowerPro temporal/stale→H2F加速→The Show/Prospi→community→owner review→100人再査定の順序 |
| `19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md` | Claude Codeが過去チャット無しで再開するための完全handoff |
| `../audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md` | 走力最終工程の全数監査。未実施工程・厳しすぎた証拠排除・再構築方針 |
| `12_APPRAISAL_PRINCIPLES_20260809.md` | 一般原則。17/18/19と矛盾する走力旧ルールは2026-08-11追補を優先 |
| `13_CURRENT_CRITICAL_PATH_20260809.md` | 旧進行正本。history |
| `16_SPEED_GATE_FINAL_AFTER_REOPEN_20260811.md` | 旧closed Gate。17によりSUPERSEDED |
| `01_HISTORY_DECISION_LOG.md` | 査定モデルの修正履歴 |
| `02_CURRENT_SPEC_V2.md` | v2査定仕様 |
| `03_FORMULAS_DATA_CONTRACTS.md` | 入力スキーマ・数式・出力台帳 |
| `04_RUNNING_DEFENSE_CATCHER.md` | 走力・盗塁・守備・捕球等の旧詳細。走力部分は17/18/19優先 |
| `05_SPECIAL_ABILITIES_KONAMI.md` | 得能・KONAMI比較 |
| `11_LEGACY_REFERENCE_V1_9.md` | 歴史資料 |

---

## 4. Claude Codeへの最初の指示

```text
最初に17, 18, 19とcomprehensive gap auditを読んでください。

すぐコードを書かないでください。
現在のGPT/Codex案を正しい前提にせず、まず独立red-teamをしてください。

確認すること:
- PowerProを強いpriorとして使いつつ、ベテランstaleをどう検出するか
- 一塁到達等の混合情報をどの重みで使うか
- 古い身体測定を現在へどの程度持ち越すか
- The Show→PowerPro変換
- Prospiの利用
- PowerPro/Prospi査定へのSNS/YouTubeコメント
- owner reviewをどこへ入れるか
- これまで言及されていたのに未実施の方法が他にないか

最初の成果は実装ではなくred-team auditにしてください。
```

---

## 5. 現在のAI役割分担

### Claude Code

査定思想・壁打ち・独立red-teamの主担当。

### Codex

大規模データ処理・DB分析・API・実装・再現可能成果物・QA。

### GPT

Claude案とCodex結果の独立レビュー、矛盾・抜けの検出、owner review package整理。

### Owner

最終査定責任者。

- PowerProとの差5以上を全員確認
- veteran staleの違和感を裁定
- PowerPro/Prospiのどちらが自然かを判断
- final acceptance

---

## 6. 2026-08-11で追加された重要原則

- **PowerProは単なる最後のQAより強いpriorとして使う。** ただしstale/inertia flagを持つ。
- **5点以上のPowerPro差を大きな乖離**とする。
- 一塁到達・塁間走・内野ゴロ等は、交絡があるからといって0扱いせず、低～中信頼の情報として使う。
- SNSはPhysical ObservationとRating Consensusに分離する。
- PowerPro/Prospiの査定コメントを収集する。
- KONAMI/Prospiの公式能力紹介YouTubeコメントを利用する。YouTube API、CSV/JSON、ownerコピペを許可。
- genericな「俊足」「鈍足」等も弱い証拠として保持する。
- The Show temporal policyが識別不能でも、The Show→PowerProのsame-time conversionは別研究として行う。
- 助っ人で測定時点PowerProが無ければThe Show換算を使う。
- Prospi current/historyを体系的に統合する。
- owner verdictを正式データとして保存し、後工程で上書きしない。

---

## 7. 現在の走力成果

| 作業 | 状態 |
|---|---|
| T90 production architecture | 完了 |
| MLB T90 calibration | 完了 |
| 2026 NPB+ Sprint Speed 100人 | 完了 |
| exposure audit | 完了 |
| physical evidence collection | 完了 |
| measurement date resolution | 部分完了 |
| PowerPro long panel | **収集完了 / temporal-stale分析未完** |
| body measurement × PowerPro timing join | 16 measurement clustersまで完了 / policy未作成 |
| Historical Anchor Bank | 113 high-confidence anchorsを構築 |
| ordinary SNS | 実施 |
| Grok-X SNS | 175検索、191候補、41採用 |
| rating-comment SNS | **未実施（旧ルールで除外していた）** |
| official YouTube comments | **未実施** |
| Prospi current/history | **未実施** |
| The Show long data | 収集済み / temporal policy negative result |
| The Show→PowerPro conversion | **未完成** |
| H2F/context-inclusive acceleration | **未完成** |
| owner review >=5 | **未実施** |
| previous blind freeze | 完了。ただしphysical estimateとして保存 |
| practical PowerPro-style reappraisal | **未実施** |
| 肩力 | **走力Gateを閉じるまで進まない** |

---

## 8. Previous blind freeze

branch: `codex/speed-2026-final-reappraisal-freeze`

- BLIND_FINAL_FREEZE_SHA: `7b82bb2030bf94f40d5983618f6e7362d8f2a06b`
- previous FINAL_GATE_SHA: `1db37ed11bfb4070c03afe530c9dfb7c12244a79`

100/100査定済みだが、今後は `physical_speed_estimate` baselineとして扱う。

PowerPro QA:

- 99 exact matches
- project mean 65.343
- PowerPro mean 65.667
- MAE 7.758
- RMSE 9.839
- corr 0.776

差5以上を今後全員owner reviewする。

---

## 9. 重要な失敗の教訓

このプロジェクトでは以前から:

> 「完璧に使えないなら使わない」は、データが少ない状況では最も損な判断

という教訓があった。

走力最終工程ではこれを再発させた。

今後:

```text
完全ではない
→ 何が混ざるかを記録
→ confidenceを下げる
→ 他の証拠と合わせて使う
```

を原則とする。

---

## 10. 出力上の絶対条件

各選手で、最終的に:

```text
physical_speed_estimate
practical_powerpro_style_speed
PowerPro current/history
PowerPro prior status
Prospi current/history
The Show converted value
current top speed
H2F/acceleration evidence
historical physical evidence
SNS physical
SNS rating
owner verdict
low/point/high
confidence
major discrepancy reason
evidence used/downweighted
```

を追跡できるようにする。

---

## 11. GitHub durability

Claude/Codex/GPTの最終チャットを正本にしない。

```text
final chat response にしか存在しない重要知見 = 0
```

を全タスクの完了条件にする。

---

## 12. 注意

現在は「完成済み査定表」ではなく、**走力実用査定の再構築フェーズ**。

次にやるのは肩力ではなく、Claude Codeによる独立red-teamである。

# 走力再構築 — タスク全数監査・引継ぎ漏れ根本原因・再発防止

作成日: 2026-08-13  
状態: **CURRENT GOVERNANCE AUDIT**  
対象: Claude Code → GPT/Codex → Claude Code と移行した2026 NPB走力再構築全体

---

## 0. 結論

今回の漏れは単発の「YouTubeコメントを忘れた」ではない。

根本には、**タスク状態を文章handoffへ手作業で転記し、`SNS済み` / `The Show済み` / `PowerPro panel済み` のような親ラベルで子工程を圧縮していた**という構造問題がある。

そのため、各handoff自体が丁寧に見えても、次の種類の情報が繰り返し消えた。

1. **同じデータ源の別用途** — Physical SNSは済みだがRating SNSは未実施
2. **collectionとanalysisの違い** — PowerPro panel収集済みだがstale/carryover分析は未完
3. **negative findingと別研究の違い** — The Show temporal policyはNOT_IDENTIFIABLEでもsame-time mappingは別タスク
4. **既存実装と新規研究の違い** — H2F/三塁打/advance等は既に検証済みの部分があるのに「未実施」と再定義
5. **artifact存在とcompletionの違い** — 空ファイル・途中result・mapping outputが存在してもDoDを満たしていない
6. **preliminaryとfinalの違い** — 100人表/owner queueが作られていても、community/Prospi/scale等の前工程が残る

今後は文章handoffをtask statusの正本にしない。

- `docs/state/speed_requirements_baseline_20260813.tsv`
- `docs/state/speed_task_registry.tsv`
- `docs/state/speed_legacy_open_item_map.tsv`

を機械正本とし、`scripts/qa_speed_task_registry.mjs` とGitHub Actionsでfail closedにする。

**文字通りの100%保証は不可能**である。未来の未発言要件や外部サービス障害まで機械的に予知することはできない。ただし、今回と同系列の「既に言及/登録済みの未完タスクがhandoffで消える」「部分成果を全体完了と誤認する」「Gate/owner reviewを早く閉じる」問題については、文章上の注意ではなく**機械的に失敗させる構造**へ変更した。

---

# 1. 監査範囲

今回、以下を相互照合した。

- root `CLAUDE.md`
- `docs/satei_handoff/00_README_AND_HANDOFF.md`
- `MANIFEST.md`
- `12_APPRAISAL_PRINCIPLES_20260809.md`
- 旧13 / 16 / 17 / 18 / 19 / 20 / 21 / 22
- `speed_2026_reopen_comprehensive_gap_audit_20260811.md`
- Claude independent red-team
- NPB+ scale / rolling holdout / T-0203 / absolute scale audits
- owner review master / conflict diagnosis / queue
- PowerPro / physical / Grok-X / video / acceleration artifacts
- The Show mapping / holdout artifacts
- `implementation_checklist.md`
- 2026-08-05 Codex `all_missing_data` task/result
- repository recursive tree（zero-byteを含むartifact実在性）
- current Community Rating Rescue task

判断は「ファイル名がある」ではなく、**目的・coverage・negative finding・QA・後続適用まで分解**した。

---

# 2. 今回復元された重要な未完タスク

詳細は `docs/state/speed_task_registry.tsv` が正本。ここでは漏れやすいものだけ示す。

## 2.1 Community / rating lane

既存ordinary SNS / Grok-Xは主にPhysical Observation。

未完:

- 旧Grok-X rejectからgame-rating discussionをRating Consensusへ救済
- PowerPro公式YouTube能力紹介/updateコメント
- Prospi公式YouTube能力紹介コメント
- PowerPro/Prospi official X replies
- weak generic `俊足/鈍足` の低重み救済
- same-event dedupe / reaction volume

これは `CODEX_SPEED_COMMUNITY_RATING_RESCUE_20260813.md` へ再委任する。

## 2.2 Prospi

体系的には未完:

- current speed
- historical speed
- same-time PowerPro divergence
- rating comments

PowerPro stale判定の独立QAとしてowner review前に必要。

## 2.3 The Show

完了と未完を分離:

- longitudinal / full-attribute collection: 資産として保持
- temporal response/lag: `NOT_IDENTIFIABLE` のnegative finding
- Statcast→The Show / Statcast→PowerPro linear bridge: 既存部分成果あり
- **The Show→PowerPro same-timeのdirect / quantile / isotonic / piecewise比較: 未完**
- holdout: 旧holdoutはPowerPro target labelがtest側0人という設計欠陥を記録済み
- eligible foreign/import casesへの実適用: 未実施

したがって「The Show済み」と一語で閉じてはいけない。

## 2.4 PowerPro temporal / stale

long panel collection自体は完了。

未完/部分完了:

- same-date/version conflict normalization
- edition distribution / percentile
- trajectory normalization
- stale/inertiaの最終判定
- 秋山翔吾 / 松山竜平等のcase study完成
- community / Prospiを加えたstale再判定
- age/birth join
- injury/recovery join

age/birth・injuryは現在BLOCKEDとして明示し、存在しないことを黙って落とさない。

## 2.5 Flexible acceleration/context evidence

「未実施」ではないもの:

- old H2F calibration: signalはあるがtest_n=14 / MAE大でdirect converter不適
- strict current acceleration prior: current direct evidence不足でalpha=0のnegative finding
- triple baserunning separation: 分離するとrepeatability悪化のnegative finding

未完:

- 上記negative findingを壊さず、revised flexible-evidence policy用のlow-confidence context laneを整理
- official scouting coverage整理
- pinch-runner usageの既存data利用可否
- defensive straight-line chase speedの実施/不要判定

## 2.6 旧2026-08-05 all-missing-data親タスク

`_codex_result_20260805_missing_data.md` はstatusが「調査中」のまま。

後続のphysical ledger等でspeed子項目の多くは代替されたが、親taskを正式にclose/supersedeしていない。

これが「古いtaskがどこまで置換されたか分からない」状態を作るため、現registry `SP-063` で子項目へ精算する。

## 2.7 Scale / full roster / engine

- relative modelとabsolute 0-100 scaleは分離済み
- PowerPro由来scaleは暫定
- ability→engine running-effect bridge未実装のためabsolute scale最終校正はdependency block
- 100人だけ別scaleにしないfull-roster consistencyは未実施
- final engine/simulation league-distribution QA未実施

## 2.8 Owner review / final appraisal

preliminary master tableはある。

しかしfinal owner review前に:

- community rescue
- Prospi
- The Show mapping/application
- PowerPro stale再判定
- conflict再診断

が必要。

旧owner queueはSUPERSEDED。

その後:

- final owner queue
- owner verdict保存/no-overwrite QA
- practical 100-player reappraisal
- engine QA
- Gate close

の順。

---

# 3. 「忘れていた」と見えたが、実際はnegative finding / partialだったもの

漏れ監査では、再研究の浪費を避けるためこれも区別した。

| 項目 | 正しい状態 |
|---|---|
| 三塁打から走塁寄与を分離 | 実施済み。分離で翌年再現性が悪化 → `DONE_NEGATIVE_FINDING` |
| H2F | 旧較正済み。signalはあるが高MAE/小n → direct点換算には使わない |
| acceleration residual prior | strict current evidenceではready 0、alpha=0 → negative finding。flexible laneは別task |
| strict video | 17/17 inconclusive → acquisition/criteria negative finding。証拠不存在とは言わない |
| The Show temporal | NOT_IDENTIFIABLE → temporal taskのnegative finding。same-time conversionとは別 |
| NPB+ T-0203 | 1年層n=2でC/判定不能 → 自動blendしない、T-0204へ |
| absolute scale investigation | 調査は実施。engine bridge依存が判明 → finalizationはBLOCKED_DEPENDENCY |

この分類を導入したのは、`NOT_IDENTIFIABLE` を「未実施」に戻して無限研究したり、逆に「調査したから完了」として別子タスクを消したりする両方を防ぐため。

---

# 4. 根本原因

## RC-1: Task stateを文章handoffに保存していた

最大原因。

handoffのたびに「今重要と思うもの」を人間/AIが要約し直したため、**state migrationが非単調**だった。

旧文書の未完項目が新文書にコピーされなければ、その瞬間に見えなくなる。

実例:

`18 Phase 5 Community appraisal`
→ 22作成時に既存Grok-Xを「再利用資産」と書く
→ Rating Consensus / YouTube / official Xの未実施が次工程から消える。

### 対策

proseは説明のみ。task statusはTSV registryのみ。

---

## RC-2: 親ラベルが複数の子タスクを潰した

例:

- `SNS` = Physical + Rating + YouTube + X + weak label + dedupe
- `The Show` = collection + temporal + same-time mapping + validation + application
- `PowerPro temporal` = collection + normalization + stale + age + injury + community/Prospi QA

「SNSをやった」でPhysical laneだけが全体完了に見えた。

### 対策

子工程をunique `SP-*` IDに分解。親ラベルだけでDONEにできない。

---

## RC-3: collection / analysis / policy / applicationを分けていなかった

23,206 PowerPro observationsがあることと、old physical carryover policyが完成していることは別。

The Show mapping JSONがあることと、正しいforeign holdoutを通して助っ人へ適用できることも別。

### 対策

各段階を別task ID化。

---

## RC-4: artifact存在 = completion という誤推論

repositoryには:

- zero-byte historical/work files
- status=`調査中` のCodex result
- partial mapping
- preliminary owner queue

が共存する。

ファイル名だけ検索すると「やった」に見える。

### 対策

CLOSED taskのartifactはvalidatorが**存在+非0 byte**を必須化。preliminary/finalを別task IDにした。

---

## RC-5: negative findingの意味境界が曖昧だった

`video unusable` を `video evidence不存在`、`The Show temporal NOT_IDENTIFIABLE` を `The Show利用不能` のように拡張解釈しやすかった。

逆方向には、negative findingを「未実施」に戻して同じ研究を繰り返す危険もある。

### 対策

`DONE_NEGATIVE_FINDING` を独立statusにした。

---

## RC-6: CURRENT / 正本が複数あった

同時に:

- CLAUDE.md
- 00_README
- 17/18/19
- 22
- implementation_checklist
- MANIFEST

が現在状態のように読めた。

しかもCLAUDE/READMEは22作成後も17/18/19へ誘導し、MANIFESTは7/31 checksumのままだった。

### 対策

入口をregistryへ収束。MANIFESTをcurrent state indexへ変更。22はhuman summaryへ格下げ。

---

## RC-7: Immutable owner requirementsが無かった

ownerが明示した:

- YouTube comments
- Prospi
- rating-SNS
- stale veteran review
- The Show conversion

が後のsummaryから消えても検知する仕組みがなかった。

### 対策

52件の`SR-*` requirement baselineを作成。全requirementが最低1 taskへmappingされないとvalidator FAIL。

今後owner requirementが追加されたら、**作業前にbaseline+registryへ追加**する。

---

## RC-8: 旧未完taskから新taskへのmigration mapが無かった

新しいcritical pathを作るたび、旧文書を読む人の記憶に依存した。

### 対策

`speed_legacy_open_item_map.tsv`で:

- 旧18 Phase 1〜8
- comprehensive gap audit 2.x
- old all-missing-data parent
- Claude red-team missing DoD

を現task IDへ明示mapping。

---

## RC-9: Gateが「予定ルートを試した」ことで閉じられた

以前のGateでは、video等の取得不能/negative findingまで含め「routes exhausted」と解釈し、planned-but-unimplemented子工程が残ったままcloseした。

### 対策

Gateは努力量ではなくregistry stateで閉じる。`gate_block=1`が1件でもopenならSP-081をCLOSEDにするとvalidator FAIL。

---

## RC-10: owner reviewも早くreadyになり得た

`|PowerPro diff|>=5`だけでreviewへ回すと、scale問題・project内部conflict・missing communityをownerへ丸投げする。

### 対策

`owner_review_block=1`を導入。SP-077 final queueを閉じる前に全blockerがCLOSEDでないとvalidator FAIL。

---

## RC-11: chat-only knowledgeが最初のhandoffで残った

Claude側チャットに存在したproduction model/検証知識がGitHubに十分永続化されず、GPTはClaude離脱時点を探索段階と誤認した。

### 対策

`final chat response にしか存在しない重要知見 = 0` をtaskとして追跡。final回答はGitHub artifactの要約に限定。

---

## RC-12: branch/repo分散と役割境界の曖昧さ

Codex branch、Claude branch、`claude-code-hub`等へ成果が分散し、「別branchにある=現在taskへ統合済み」と誤認しやすい。

### 対策

branchではなくtask registryでstatusを管理。外部branch成果はcurrent task artifact/provenanceとして登録されて初めてcompletionへ寄与する。

---

## RC-13: diagnosticをacceptanceへ流用した

statOpenの未来情報を含む比較を一度acceptanceに使った例のように、限界を文書へ書いても結論側を機械的に拘束していなかった。

### 対策

validation / diagnostic / negative findingをtask/artifact上で区別。`NOT_IDENTIFIABLE`を無理にDONE_VALIDATEDへ変えない。

---

## RC-14: blocked / waitingが「忘れてよい」に近かった

age/injury、T-0204、engine bridge等は今すぐ進められないため、prose要約から落ちやすい。

### 対策

`BLOCKED_MISSING_DATA` / `BLOCKED_DEPENDENCY` / `WAITING_EXTERNAL` を正式status化。消さずregistryに残す。

---

# 5. 実装した再発防止

## 5.1 Immutable Requirements Baseline

`docs/state/speed_requirements_baseline_20260813.tsv`

52 requirement IDs。

新handoffがどれだけ短くても、requirementがtask mappingから消えるとQA FAIL。

## 5.2 Canonical Task Registry

`docs/state/speed_task_registry.tsv`

タスクごとに:

- task_id
- status
- requirement_ids
- owner_review_block
- gate_block
- dependencies
- next action / blocker
- artifact

を持つ。

## 5.3 Legacy Open-Item Migration Map

`docs/state/speed_legacy_open_item_map.tsv`

旧proseを捨てず、旧未完工程→現task IDを固定。

## 5.4 Fail-Closed Validator

`scripts/qa_speed_task_registry.mjs`

検査:

1. requirement/task ID重複
2. status enum
3. **全immutable requirementがtaskへmapping済みか**
4. open taskにnext action/blockerがあるか
5. CLOSED taskのartifactが存在しnon-zeroか
6. dependency未完なのにchildをcloseしていないか
7. legacy map source/taskが有効か
8. final owner queueをblocker残存でcloseしていないか
9. Speed Gateをgate blocker残存でcloseしていないか
10. shoulderをGate前にcloseしていないか
11. CLAUDE/README/MANIFEST/22がcanonical registry/baselineを指すか
12. preliminary owner queueがSUPERSEDEDのままか

## 5.5 GitHub Actions

`.github/workflows/speed-task-registry-qa.yml`

state / handoff / task / audit / output変更でvalidatorを実行。

## 5.6 Entrypoint Convergence

- root `CLAUDE.md`
- `00_README_AND_HANDOFF.md`
- `MANIFEST.md`
- 22 current human summary

をregistryへ収束。

17/18/19はhistory/要件発見元へ格下げ。

---

# 6. 新しい作業プロトコル

## 新しいowner requirementが出た時

**順序を固定:** 

1. `SR-*` requirement追加
2. `SP-*` task追加/既存taskへmapping
3. dependency / owner block / gate block設定
4. validator PASS
5. その後に作業開始

chatだけで先に作業しない。

## taskを完了する時

1. artifact保存
2. negative finding / coverage / missingness保存
3. 必要QA保存
4. registry status更新
5. validator PASS
6. 初めて「完了」と報告

## handoffを作る時

handoffへopen task一覧を手コピーしない。

- registryを正本としてリンク
- human summaryは必要なら生成
- legacy mapを更新
- validator PASS

## owner reviewへ進む時

SP-077をDONEにする前にvalidator。`owner_review_block=1`が残ればFAIL。

## Gate close時

SP-081をDONEにする前にvalidator。`gate_block=1`が残ればFAIL。

---

# 7. 残る限界と100%について

技術的に保証できるのは「**登録済み要件・既存文書に明示済みの工程が黙って消えない**」こと。

完全に保証できないもの:

- ownerがまだ一度も言語化していない将来要件
- 外部source自体の消滅
- 取得不能なprivate data
- task登録前にAIがowner instructionを誤読する可能性

そのため、文字通りの100%保証は約束しない。

代わりに、今回の同系列事故については:

- **忘れるとvalidator FAIL**
- **partialをDONEにするとartifact/dependency/gateでFAIL**
- **旧CURRENTへ戻るとentrypoint checkでFAIL**
- **owner review/Gateを早く閉じるとFAIL**

というfail-closed構造にした。

---

# 8. 現在のタスク規模

初回registry化時点で63 taskへ分解。

大きく残っているのは:

- Community Rating / YouTube / X / Prospi collection
- PowerPro normalization / stale finalization / age / injury
- The Show same-time mapping + foreign application
- flexible/context evidenceの残件
- old all-missing-data parent reconciliation
- full-roster / absolute scale / engine dependency
- community-enriched conflict/stale rediagnosis
- final owner queue / verdict / practical 100 / simulation / Gate

これらは今後、親ラベルの一言では消えない。

---

# 9. Definition of Done — 今後の「引継ぎ完了」

次の全てを満たすまでhandoff/state migrationを完了扱いしない。

- [ ] 新owner requirementをbaselineへ追加した
- [ ] 全requirementがtaskへmappingされている
- [ ] 旧未完項目をlegacy mapへmappingした
- [ ] open taskにnext action/blockerがある
- [ ] CLOSED task artifactがnon-zero
- [ ] final owner queueをpreliminaryと区別した
- [ ] blocked/waiting taskを削除していない
- [ ] entrypointがregistryを指す
- [ ] `node scripts/qa_speed_task_registry.mjs` PASS
- [ ] final chat only knowledge = 0

このDoDを、文章の注意ではなくCIで強制する。

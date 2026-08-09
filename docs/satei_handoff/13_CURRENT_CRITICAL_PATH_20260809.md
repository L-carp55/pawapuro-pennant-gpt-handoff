# CURRENT CRITICAL PATH — 2026-08-09

状態: **ACTIVE / 現在の作業順を拘束する運用正本**

このファイルは、査定設計の一般原則ではなく、2026-08-09時点で「次に何をするか」を明示する。
`PR #3 Speed v1 complete` を「走力査定全体が完了した」と解釈してはならない。

---

## 1. 最重要区別

### 完了しているもの

- T90を中心とした走力production architecture
- MLB 2017-2025のT90物理較正
- NPB+ Sprint Speedの定義同一性が未確認であることの明示
- NPB+→T90 bridgeを未較正のままにする安全境界

### まだ完了していないもの

- 2026 NPB 100選手の最終走力査定
- Codex追加収集を統合した再査定
- 低出場 / 観測不足によるSprint Speed下振れの扱い確定
- 過去身体測定を現在へ持ち越すtemporal policyの確定
- 2015-2026等の高信頼アンカー群の構築
- データ不足選手のpairwise / ordinal補完
- 必要選手へのSNSコンセンサス適用
- 最終的なPowerPro / The Show外部QA

したがって、**肩力へ移ってはいけない。**

---

## 2. GitHubに到着済みの走力Codex成果

### A. 100選手の身体証拠収集＋測定対象のtemporal PowerPro QA

branch:
`codex/speed-physical-evidence-full`

latest commit:
`94a26e7160a879ea0e13f4ddb91d4fdadc7c04e9`

主な成果:
- NPB 100選手のSprint Speed外身体証拠収集
- clean direct T90 / electronic 50m / historical 30m・50m等の分類
- 身体測定年が既知の記録についてPowerPro時系列との照合

### B. 年不明30m/50mの時期特定

branch:
`codex/speed-measurement-date-resolution`

commit:
`46256707aea07352fb276a65693cd9661547e62d`

結果:
- unknown短距離対象35件
- 年推定15件
  - high 2
  - medium 13
- still unknown 20
- exact date 0
- year confirmed 0

### C. 2026 NPB+ Sprint Speed 小標本・観測機会監査

branch:
`codex/npb-sprint-exposure-audit`

commit:
`4a5f9b17a750639a8989601f7f8af648774365e4`

結果:
- 100/100 games, PA, AB取得
- 2025 games/PA 99/100
- full-effort-run proxy 100/100
- PA<50: 3
- PA<100: 17
- NPB+ sample count / qualified run count / aggregation method は公開確認できず
- 固定PA閾値で査定補正してはならない

### D. PowerPro 2015-2026 full long panel

branch:
`codex/pawapuro-speed-history-panel`

commit:
`7d2e35dddd3f523c5c223813bdd65587605fe07b`

主な成果:
- 2013/2014アーカイブも補助的に取得
- 2016-2026を中心にupdate/version単位で長期化
- 23,206観測
- 2,972 canonical player ID
- 58版
- 2015は独立home-console snapshotを回収できず欠損

この成果は到着済みなので、The Show待ち中でもブラウザGPT側で統合分析を開始してよい。

---

## 3. まだ待つべき走力Codex成果

### A. MLB The Show Speed long panel

目的:
- Statcast Sprint Speed/T10/T30/T90の実測変化にThe Show Speedがどう追随したか
- appraisal lag / smoothing / small-sample preservationの把握
- MLB側の時間軸QA

Speed trajectoryは走力査定のtemporal policy設計に使用する。

### B. The Show full attributes

Arm Strength / Arm Accuracy / Fielding / Reaction等のraw Live Roster属性は将来の肩・守備・捕球にも再利用する。

ただし**走力の肩移行ゲートに必要なのは少なくともSpeed時系列部分**であり、将来属性全体の取得完了を待つ必要があるとは限らない。

---

## 4. 待っている間にブラウザGPTがやること

肩力研究を開始しない。

既に到着した走力成果についてのみ、以下を進めてよい。

1. 身体証拠台帳とmeasurement-date-resolutionを統合
2. NPB+ exposure監査を100人査定表へjoin
3. PA / full-effort-run proxyとSprint Speed乖離の関係を分析
4. direct T90 / standardized 50m / historical profileの証拠階層を再適用
5. PowerPro long panelを身体測定・2026査定候補へjoinしてtemporal QAを進める
6. The Show panel到着後すぐ比較できるjoin schemaを準備

新しい能力テーマへ横展開しない。

---

## 5. Codex成果到着後の走力クリティカルパス

順序を固定する。

### Phase 1 — temporal integration

- PowerPro 2015-2026 long panel統合
- The Show Speed long panel統合
- 古い身体測定のmeasurement-eraとcurrent-eraを区別
- 年齢 / 故障 / 出場量 / physical evidence / game temporal QAを並べる

PowerPro / The Showの変化量を直接物理減衰係数にはしない。

### Phase 2 — high-confidence anchor pool

2026だけでなく過去選手も含め、データが十分で独立査定に納得できる選手を能力帯ごとに多数作る。

アンカー条件:
- physical evidenceが十分
- measurement protocolが比較的明確
- exposureが十分
- temporal trajectoryを説明可能
- 証拠間の大矛盾がない

### Phase 3 — 2026 100人再査定

各選手について:

1. physical baseline
2. exposure QA
3. temporal QA
4. anchorとのpairwise / ordinal比較
5. データ不足・不自然な外れ値のみSNSコンセンサス
6. 必要な場合のみ直接映像tie-break
7. 最終一点またはrange

### Phase 4 — blind external QA

独立査定を凍結した後に:
- PowerPro
- MLB The Show（該当MLBケース）

と比較する。

ゲーム査定へ合わせて数値をfitしてはならない。

---

## 6. 肩力へ移るためのGate

以下を満たすまで肩力の本格査定へ進まない。

- [ ] 既に依頼済みの走力Codex主要成果が返却済み、または明示的に取得不能と確定
- [ ] 到着済み身体証拠 / date resolution / exposure auditを統合済み
- [ ] PowerPro full temporal panelを分析済み
- [ ] The Show Speed temporal QAを必要範囲で分析済み
- [ ] high-confidence anchor方式を実データで構築・検証済み
- [ ] 2026 NPB 100人を最新原則で再査定済み
- [ ] データ不足・納得感不足の主要外れ値をanchor/SNSで監査済み
- [ ] PowerPro比較を最後に実施し、循環fitがないことを確認
- [ ] 走力の最終設計判断をGitHubへ保存

**このGateが満たされるまでは、PR #3の「Speed v1 complete」を理由に肩力へ進んではならない。**

---

## 7. `進めて` の解釈

このcritical pathがACTIVEな間、ユーザーの `進めて` は:

> 走力の未完工程を次へ進める

という意味であり、

> 次の能力（肩力）へ進む

という意味ではない。

Codex待ちの場合は、到着済み走力データの統合・分析を進める。待ち時間を理由に別能力へ移らない。

---

## 8. Codex成果の永続化・新セッション引継ぎルール

**Codexの最終チャット回答は正本ではない。GitHubにcommit/pushされた成果物だけを、別セッションから確実に復元できる永続成果として扱う。**

したがって、今後Codexへ委任するすべてのタスクでは、完了前に以下を必須とする。

### 8.1 最終回答だけに残してはいけない情報

以下は必ず `docs/audits/...md` 等のGitHub成果物へ保存する。

- 主要な調査結果・件数・coverage
- 重要な発見
- データ取得上の制約
- sourceの問題
- 定義が確認できなかった項目
- 欠損・未解決事項
- データ品質上の留保
- 異常値・矛盾・conflict
- 失敗した取得方法とその理由
- QA結果
- 後工程で誤解すると危険な注意事項
- `このデータからは○○を結論できない` というnegative finding
- Codexが最終回答で報告するその他の重要事項

機械処理に必要な情報は可能な限りCSV/JSONにも保持する。

### 8.2 Codex最終回答の位置づけ

Codexの最終回答は、**GitHubへ保存済み内容の要約**に限定する。

完了条件:

```text
final chat response にしか存在しない重要知見 = 0
```

となってからcommit/pushする。

### 8.3 実行中タスクへの扱い

2026-08-09時点ですでに実行中のThe Show等のCodexセッションには、スコープを変えず次の追加指示だけ送る。

> 最終チャット回答に書く主要結果・制約・欠損・negative finding・QA・重要留保をすべてaudit MD等へ保存し、final responseにしか存在しない重要知見がない状態でcommit/pushすること。既存作業のやり直しは不要。

実行中タスクを停止・再開始する必要はない。

### 8.4 ブラウザGPT側の回収手順

新しいChatGPTセッションでは、ユーザーにCodex回答全文の貼り付けを求める前にGitHubを確認する。

1. remote branch一覧と最新commitを確認
2. 対象branchの `docs/audits/...md` を読む
3. CSV/JSON/スクリプトを必要に応じて確認
4. final response由来の情報がなくても後工程を再現できるか確認
5. 欠落が疑われる場合だけユーザーへCodex回答または追加Codex監査を依頼

ユーザーが `進めて` とだけ言った場合も、待機中Codex成果があるなら最初にGitHubの新規branch/commitを確認する。

### 8.5 今後のCodexプロンプト標準句

大規模・小規模を問わず、成果を後続セッションで使うCodexタスクには以下の意味を必ず含める。

```text
重要な結論・制約・欠損・QA・negative findingを最終チャット回答だけに残さない。
すべてGitHub上のaudit Markdownおよび必要なCSV/JSONへ保存する。
最終回答はGitHubへ保存済み内容の要約とし、final responseにしか存在しない重要知見がない状態でcommit/pushする。
```

このルールは、今回の走力研究だけでなく、今後の肩力・守備・捕球・打撃等のCodex委任にも適用する。

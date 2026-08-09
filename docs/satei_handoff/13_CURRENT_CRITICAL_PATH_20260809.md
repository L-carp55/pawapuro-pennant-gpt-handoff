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

---

## 3. まだ待つべき走力Codex成果

2026-08-09 16:49 JST時点のremote branch一覧では、以下の成果branchはまだ確認できない。

### A. PowerPro 2015-2026 full long panel

目的:
- 年末代表値だけでなく可能な限りupdate/version単位
- 同一選手の走力査定が「いつ」変わったかを追跡
- 古い身体測定の現在価値を判断するtemporal QA
- game title yearとactual rating/update dateを分離

これは肩力へ進む前に回収・統合する。

### B. MLB The Show Speed long panel

目的:
- Statcast Sprint Speed/T10/T30/T90の実測変化にThe Show Speedがどう追随したか
- appraisal lag / smoothing / small-sample preservationの把握
- MLB側の時間軸QA

Speed trajectoryは走力査定のtemporal policy設計に使用する。

### C. The Show full attributes

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
5. PowerPro long panel / The Show panel到着後すぐ比較できるjoin schemaを準備

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

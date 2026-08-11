# Claude Code 実行プロンプト — 走力再構築 Independent Red-Team

Repository:
`L-carp55/pawapuro-pennant-gpt-handoff`

Branch to start from:
`agent/speed-rebuild-handoff-20260811`

## 最初に読む

1. `CLAUDE.md`
2. `docs/satei_handoff/00_README_AND_HANDOFF.md`
3. `docs/satei_handoff/17_SPEED_GATE_REOPENED_20260811.md`
4. `docs/satei_handoff/18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`
5. `docs/satei_handoff/19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`
6. `docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`
7. `docs/reports/speed_2026_appraisal_history_sns_powerpro_owner_summary_20260811.md`
8. `docs/satei_handoff/12_APPRAISAL_PRINCIPLES_20260809.md`
9. 必要に応じて旧13/16と既存audit/output

## 目的

このプロジェクトは2026 NPB野手100人の走力査定を一度blind freezeまで進めたが、後続レビューで、証拠の排除が厳しすぎ、PowerPro temporal policy・H2F加速・rating community・Prospi・The Show bridge・owner review等が未完成だったことが分かった。

現在Gateは:

```text
ACTIVE / REOPENED
```

です。

**最初の仕事は実装ではありません。**

GPT/Codexが作った現在の再構築案を、正しい前提にせず独立red-teamしてください。

## 必須観点

### A. 前提監査

- 現在のcomprehensive gap auditで見落としている未実施工程はあるか
- 逆に「未実施」とされたが不要な工程はあるか
- 過去のdocs/source/config/scriptsに、言及済みなのに今回の案へ入っていない手法はないか

### B. PowerPro

- PowerProを強いpriorとして使うのは妥当か
- ownerの「全体ではPowerProの方が自然」という観察をどう扱うか
- veteran stale/inertiaをどう検出するか
- 秋山翔吾・松山竜平をcase studyにする
- edition/update distribution差をどう扱うか
- raw pointだけでなくpercentile/quantileを使うべきか

### C. Historical physical carryover

- old T90/30m/50mをcurrentへどう残すか
- fixed age decayを避けつつ、age/injury/current evidenceをどう入れるか
- PowerPro historyをtemporal QAより強く使うべきか
- The Show/Prospiをどう補助するか

### D. Context-inclusive acceleration

- H2Fをどう調整すれば実際に使えるか
- LHH/RHH、bunt、normal swing、sample count、median/upper quartile等をどう使うか
- base-to-base/infield-grounder/infield-hit/GIDP/triplesをどこまで利用できるか
- stealing/baserunning skillの二重計上をどう防ぐか

### E. SNS / community

- Physical Observation ConsensusとRating Consensusの分離は妥当か
- PowerPro/Prospi能力紹介YouTubeコメントをどう集計するか
- genericな俊足/鈍足をどの程度信用するか
- 同一場面への多数反応をどう扱うか
- likes/reactions/author expertiseをどう使うか

### F. The Show→PowerPro

- direct regression / Statcast intermediary / quantile / isotonicのどれが妥当か
- same-year/nearest-year alignment
- foreign-player holdout
- double counting防止
- measurement-era PowerPro欠損の補完方法

### G. Prospi

- current/historyをどの範囲まで取るべきか
- PowerProとの共通性/差をどう検証するか
- stale判定の外部QAとして有効か

### H. Owner review

- |PowerPro diff|>=5全員をowner reviewするのは妥当か
- owner packetに何が必要か
- owner verdictをモデルへどう反映するか
- owner verdictの過剰な主観化をどう防ぐか

### I. Validation

- 新しいpractical appraisalが本当に改善したかを何で判定するか
- PowerPro一致率だけで成功判定しない
- custom engineでinfield hit / advancement / GIDP等をどうQAするか
- falsifiableなholdout / benchmarkを設計する

## 禁止

- まだ100人の新しい最終走力を出さない
- すぐに大規模scrapingへ進まない
- PowerProを無条件に正解扱いしない
- 旧strict physical modelを無条件に正解扱いしない
- GPT/Codex案に迎合しない
- shoulderへ進まない

## 出力

新しいbranchを作ること。推奨:

`claude/speed-rebuild-independent-red-team-20260811`

最低成果物:

`docs/audits/speed_rebuild_claude_independent_red_team_20260811.md`

必要なら:

- revised evidence hierarchy
- revised critical path proposal
- missing-method inventory
- model comparison plan
- owner review schema proposal

を追加ファイルへ保存。

## auditに必須

- 現行案への賛成点
- 現行案への反論
- まだ厳しすぎる点
- 逆に緩めてはいけない点
- 未実施工程
- 不要工程
- 旧docs/codeから再発見した方法
- PowerPro prior/stale設計案
- acceleration/H2F設計案
- The Show conversion設計案
- Prospi設計案
- community設計案
- owner review設計案
- validation plan
- 最終的に推奨する実装順

重要な知見をClaudeの最終チャットだけに残さないこと。

```text
final chat response にしか存在しない重要知見 = 0
```

となってからcommit/pushし、branch/local SHA/remote SHAを報告してください。

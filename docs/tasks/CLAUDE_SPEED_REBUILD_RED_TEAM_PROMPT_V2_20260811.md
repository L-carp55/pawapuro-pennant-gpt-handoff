# Claude Code 実行プロンプト v2 — 走力再構築 Independent Red-Team

Repository:
`L-carp55/pawapuro-pennant-gpt-handoff`

Branch:
`agent/speed-rebuild-handoff-20260811`

このClaude Codeチャットには、ブラウザGPTへ引き継ぐ前に進めていた走力再設計の会話履歴が残っている前提です。

そのため、最初に**自分の既存チャット上の最後の進捗と、GPT/Codex側でその後進んだ差分を照合**してください。

## 必読順

1. `CLAUDE.md`
2. `docs/satei_handoff/00_README_AND_HANDOFF.md`
3. `docs/satei_handoff/20_PROGRESS_SINCE_CLAUDE_HANDOFF_20260811.md` **← 最重要。Claude離脱後の差分**
4. `docs/satei_handoff/17_SPEED_GATE_REOPENED_20260811.md`
5. `docs/satei_handoff/18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`
6. `docs/satei_handoff/19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`
7. `docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`
8. `docs/reports/speed_2026_appraisal_history_sns_powerpro_owner_summary_20260811.md`
9. `docs/satei_handoff/12_APPRAISAL_PRINCIPLES_20260809.md`
10. 必要に応じて旧13/16および既存audit/output

## まず行うこと

**まだ実装しない。まだ100人を再査定しない。**

最初に次を行う。

### 1. Claude自身の過去チャットとGitHub差分を照合

- Claude Code側で最後にどこまで進めていたか
- `20_PROGRESS_SINCE_CLAUDE_HANDOFF_20260811.md` の引継ぎ境界は正しいか
- GPT/Codexが同じ作業を重複していないか
- Claude時代に検討していたのにGPT側で消えた査定方法はないか
- GPT側が誤って「Claude時代に未実施」と扱っているものはないか

必要なら自分のチャット履歴を根拠に訂正する。

### 2. GPT/Codexがその後行った作業を独立評価

特に以下を「成果として再利用すべき」「方法に問題がある」「やり直し必要」に分ける。

- physical evidence full collection
- measurement date resolution
- exposure audit
- PowerPro 2015–2026 long panel
- The Show collection / temporal negative result
- 100-player decision packets
- historical anchor bank
- ordinary SNS
- Grok-X rescue
- residual / acceleration audit
- targeted physical rescue
- video tie-break
- blind final freeze
- PowerPro external QA
- Gate closure
- Gate reopening / comprehensive gap audit

### 3. 現在の再構築案をred-team

GPT案を正しい前提にしない。

必須観点:

#### PowerPro

- 強いpriorとして使うのは妥当か
- veteran stale/inertiaをどう検出するか
- 秋山翔吾・松山竜平のような候補をどう扱うか
- edition/update間のscale差
- raw pointとpercentile/quantile

#### Historical physical

- old T90/30m/50mを現在へどう残すか
- PowerPro history / Prospi / The Showをどう時間軸に使うか
- fixed age decayを使わず個人変化をどう扱うか

#### Context-inclusive acceleration

- H2F
- bunt H2F
- base-to-base
- infield grounder
- infield hit
- GIDP avoidance
- triples
- pinch-runner usage
- injury/recovery

を、交絡を記録した上でどこまで使えるか。

#### SNS / community appraisal

Physical Observation ConsensusとRating Consensusを分ける案を評価。

- PowerPro/Prospi査定へのコメント
- KONAMI/Prospi公式YouTubeコメント
- X replies
- generic俊足/鈍足
- likes / reaction volume
- author expertise
- same-event multiple reactions

#### The Show→PowerPro

- direct regression
- Statcast intermediary
- quantile mapping
- isotonic
- same-year/nearest-year alignment
- foreign-player holdout

を比較。

#### Prospi

- current/historyをどこまで取得すべきか
- PowerPro stale判定の独立QAになるか
- PowerProとProspiが同じ情報源を共有する可能性による二重カウント

#### Owner review

- |PowerPro diff|>=5全員をowner reviewする案
- owner packetに必要な情報
- owner verdictの重み
- owner verdictの過剰主観化を防ぐ方法
- owner verdictを後工程で勝手に上書きしない方法

#### Validation

PowerPro一致率だけを成功指標にしない。

- independent physical fit
- owner plausibility
- community appraisal
- custom-engine simulation behavior
- temporal consistency
- holdout

をどう組み合わせるか。

## 必須成果物

新しいbranchを作る場合はClaude側で適切な名前を付ける。

最低限GitHubへ:

1. `docs/audits/...` — independent red-team audit
2. `docs/design/...` — revised speed appraisal architecture proposal
3. `docs/satei_handoff/...` — current critical pathへの修正提案が必要なら保存
4. 機械可読な未実施 / retain / redo matrixが有用ならCSV/JSON

を保存する。

重要な発見をfinal chatだけに残さない。

## 終了時の回答

- Claude側の旧チャットとhandoff境界が一致していたか
- GPT/Codexがどこまで進めたと評価するか
- 再利用する成果
- 捨てる/やり直す成果
- GPTのcomprehensive gap auditでさらに漏れていた項目
- 新しい査定設計の主要原則
- 実装前にownerへ確認すべき事項
- branch / commit / artifact paths

を報告する。

**このred-teamが終わるまで実装へ進まない。**

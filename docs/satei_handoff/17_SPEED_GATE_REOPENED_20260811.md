# SPEED APPRAISAL GATE — Reopened 2026-08-11

状態: **CURRENT / ACTIVE / REOPENED**

## 1. 現在の正式ステータス

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
```

`16_SPEED_GATE_FINAL_AFTER_REOPEN_20260811.md` の `CLOSED AFTER REOPEN` は、後続の全数監査により**SUPERSEDED**となった。

旧Gate閉鎖時のblind freezeとPowerPro QAは削除しない。研究上の重要な中間成果として保存する。

- BLIND_FINAL_FREEZE_SHA: `7b82bb2030bf94f40d5983618f6e7362d8f2a06b`
- previous FINAL_GATE_SHA: `1db37ed11bfb4070c03afe530c9dfb7c12244a79`

ただし、その100人freezeは今後:

```text
NPB+ TOP-SPEED-CENTERED INDEPENDENT PHYSICAL APPRAISAL
```

として扱い、実際にゲームへ採用する最終走力ではない。

## 2. Gateを再開した理由

後続レビューで以下が確認された。

1. PowerPro 2015-2026 long panelは収集したが、古い身体測定のcurrent carryover policyを完成していない。
2. PowerProのベテラン据え置き/stale/inertiaを体系的に検出していない。
3. 一塁到達・base-to-base・内野ゴロ等のcontext情報を厳しく排除しすぎた。
4. Grok-XでPowerPro/Prospi査定へのコメントを明示的に除外していた。
5. official YouTube能力紹介コメントを未収集。
6. Prospi current/historyを体系的に未統合。
7. The Show temporal policyが識別不能だったことを、The Show→PowerPro同時点変換まで使えないように扱っていた。
8. |PowerPro-project| >=5 の全選手をowner reviewへ回していない。
9. 113 anchor / SNS / temporal evidenceを集めても、最終point estimateはblind-v3から実質1人しか変わらず、証拠統合が不十分だった。
10. 動画usable=0の一部は情報不存在ではなく取得経路・採用条件によるnegative findingだった。

詳細:

`docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`

## 3. 今後の最終成果物は2系統

### A. physical_speed_estimate

公開physical / speed data中心の独立査定。

旧blind freezeをこの系列の中間正本として保存する。

### B. practical_powerpro_style_speed

ゲームへ実際に採用する査定。

使用可能:

- PowerPro current/history
- PowerPro stale/inertia flag
- Prospi current/history
- The Show→PowerPro conversion
- current NPB+ top speed
- direct T90/T30/T10
- electronic/photoelectric 30m/50m
- adjusted home-to-first
- bunt H2F
- base-to-base
- infield-grounder/context residuals
- infield hit / GIDP / triples after context adjustment
- official scouting
- SNS physical consensus
- SNS rating consensus
- official YouTube / X comments
- injury/recovery context
- owner verdict

## 4. PowerProの新しい位置づけ

PowerProは単なる最後の外部QAより強いpriorとして扱う。

ただし無条件の正解ではない。

prior status:

- `CURRENT_RELIABLE_PRIOR`
- `CURRENT_BUT_UNCERTAIN`
- `STALE_PRIOR_SUSPECTED`
- `COMMUNITY_DISPUTED`
- `OWNER_DISPUTED`
- `NO_POWERPRO_AT_MEASUREMENT_DATE`

特にベテラン・長期据え置き・故障後・Prospiと乖離するケースはstaleを疑う。

ユーザー例:

- 現在の秋山翔吾
- 過去の松山竜平

これらはcase studyとして必ず再確認する。

## 5. SNSの新しい位置づけ

SNSを2laneに分ける。

### Physical Observation Consensus

実際の足の速さ、一歩目、加速、昔より落ちた等。

### Rating Consensus

PowerPro/Prospiの走力が高すぎる・低すぎる・古い、得能で表現すべき等。

Grok-Xの旧 `GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED` は新方針では撤回する。ゲーム査定コメントはphysical evidenceとは別laneで保存し、PowerPro priorの信頼度判断に使う。

## 6. Owner review

今後、少なくとも以下を必ずowner reviewへ回す。

- |PowerPro - practical candidate| >= 5
- veteran stale suspect
- major injury後据え置き
- Prospi/PowerPro conflict
- The Show converted/PowerPro conflict
- community dispute

Owner verdictはGitHubへ保存し、自動工程で上書きしない。

## 7. Gate closure checklist

以下を満たすまで肩力へ進まない。

- [ ] PowerPro temporal/stale analysis完成
- [ ] old physical carryover policy完成
- [ ] adjusted H2F / acceleration model完成
- [ ] context-inclusive running model完成
- [ ] The Show→PowerPro conversion holdout PASS
- [ ] foreign-player historical backfill
- [ ] Prospi current/history必要範囲統合
- [ ] PowerPro/Prospi rating comments収集
- [ ] official YouTube comments収集/投入
- [ ] owner review for all >=5 discrepancies
- [ ] owner verdict protection QA
- [ ] practical 100-player reappraisal
- [ ] all >=5 residual explanations
- [ ] engine/simulation QA
- [ ] owner final approval
- [ ] final chat only knowledge = 0

## 8. 次に読むファイル

1. `18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`
2. `19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`
3. `../audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`

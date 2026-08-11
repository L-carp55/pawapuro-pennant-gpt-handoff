# CURRENT CRITICAL PATH — 2026-08-09

状態: **SUPERSEDED / HISTORICAL**

このファイルは2026-08-09時点の走力critical pathの履歴記録であり、**現在の作業順を拘束しない**。

2026-08-11の後続監査で、旧Gate閉鎖後に以下が判明した。

- PowerPro long panelは収集済みだったが、old physical carryover / stale-inertia policyは未完成だった。
- H2F・base-to-base・内野ゴロ等の混合情報を厳しく排除しすぎた。
- Grok-XでPowerPro/Prospi査定へのコメントを除外していた。
- official YouTube rating comments、Prospi current/history、The Show→PowerPro bridge、owner >=5 reviewが未実施だった。
- previous blind freezeは主にNPB+ top-speed centered physical estimateで、practical PowerPro-style appraisalにはなっていなかった。

したがって現在の正本は:

1. `17_SPEED_GATE_REOPENED_20260811.md`
2. `18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`
3. `19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`
4. `../audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`

現在の正式状態:

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
```

肩力へ進まない。

---

## Original 2026-08-09 document

元の全文はGit履歴に保存されている。

直前のclosed-Gate系commit:

`1db37ed11bfb4070c03afe530c9dfb7c12244a79`

そのcommit上の:

`docs/satei_handoff/13_CURRENT_CRITICAL_PATH_20260809.md`

を参照すれば、当時の全文を再現できる。

当時の主要な意図は以下であり、現在も一部は継承する。

- Speed v1 architecture完了と2026 NPB最終査定完了を区別する。
- 肩力へ移る前に走力Gateを満たす。
- physical evidence / exposure / temporal QA / anchor / SNS / PowerPro QAを順に実施する。
- Codex最終チャットを正本にせずGitHubへ永続化する。
- `final chat response にしか存在しない重要知見 = 0` を完了条件にする。

ただし、旧critical pathの「PowerPro/The Showはfreeze後の外部QAのみ」「不完全なcontext情報を最終値へほぼ使わない」という運用は、2026-08-11再構築方針で変更された。

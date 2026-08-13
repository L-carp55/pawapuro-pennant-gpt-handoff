# SUPERSEDED — OWNER_SPEED_ANCHOR_TABLE_V2_20260812

状態: **SUPERSEDED / DO NOT USE / OWNER INPUT NOT REQUIRED**

この量→点数表は、ユーザーの実際の次工程を取り違えて作成されたものです。

オーナーは現時点で「一塁到達○秒→走力○点」という目盛りを決める役ではありません。

正しい次工程は、AI側が100人全員について:

- GPT/Codex査定とその根拠
- 査定confidence
- PowerPro現在値
- PowerPro過去推移
- projectとの差
- 差が生まれた原因の分析
- PowerPro stale疑い
- physical/SNS/exposure/temporal conflict

を1枚のmaster tableへまとめ、その後に差5点以上・confidence LOW・conflict・stale疑いだけをオーナーへレビュー依頼することです。

現在の正本:

- `docs/satei_handoff/21_CORRECTED_CONTINUATION_AFTER_CLAUDE_REDTEAM_20260813.md`
- `docs/tasks/OWNER_SPEED_REVIEW_MASTER_TABLE_TASK_20260813.md`

**この表への記入待ちを理由に停止してはいけません。**

元内容はGit履歴 `a0099a357652babbb92bf15e45d495a6eafdd91e` で確認できます。

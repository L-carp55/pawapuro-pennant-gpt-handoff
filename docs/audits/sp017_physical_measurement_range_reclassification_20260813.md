# SP-017 — protocol/date不明の身体測定をrange evidenceへ復元（EX-001/EX-002/EX-025是正）

生成日: 2026-08-13
状態: **EX-001/EX-002完了（非破壊overlay新設）。EX-025は現行実装が既に是正方針どおりと確認**

## 0. 何が違反だったか

`data/normalized/speed_historical_physical_measurements_2015_2026.json`（459件）のうち57件が、
計測方式または測定日が公開情報で確認できないという理由だけでnumeric evidenceから完全除外
（`bank_acceptance_status`が`REJECTED_PROTOCOL*`系）されていた。

CLAUDE.md『★証拠除外の原則』: 「`不完全`と`無価値`を同義にしない」「`この変換は無効`と
`元データ自体が無価値`を分離する。例: 30m/50m→T90距離比例は無効でも30m/50m実測自体は残す」
に反する。

## 1. 対象の切り分け

459件のrejection_reasonを全数集計し、以下の**3種のみ**をEX-001/EX-002の対象とした
（残りは別のexclusion事由——unverified source tier=EX-025、context mixing=EX-003系——
であり本タスクの対象外）。

| rejection_reason | 件数 | 対応するEX |
|---|---|---|
| `REJECTED_PROTOCOL_OR_DATE_NOT_PUBLICLY_DOCUMENTED` | 42 | EX-001/EX-002両方 |
| `REJECTED_PROTOCOL_MANUAL_START_NOT_COMPARABLE` | 3 | EX-001（手計測） |
| `REJECTED_PROTOCOL_NOT_FULLY_PUBLICLY_DOCUMENTED` | 12 | EX-001 |
| 合計 | **57** | |

対象外として据え置いた主な理由（このタスクでは変更しない）:

- `REJECTED_TIER_C_FULL_TABLE_NOT_INDEPENDENTLY_VERIFIED`（25件）= EX-025。
  出典本文未確認のsnippetは数値証拠として使わない、が是正方針そのもの（下記§3）
- `REJECTED_CONTACT_TO_RUN_TRANSITION_OR_GAME_CONTEXT`（71件）= EX-003系（打撃→走行移行の
  文脈混入）。SP-007（H2F低信頼度レーン）が対象とした`data/manual/npb_speed_physical_evidence_full_20260809.json`
  とは別ファイル・別レコード群のため、このタスクでは同種の再分類が必要かどうかを
  次段（未着手・次タスク候補）として明示するに留める

## 2. EX-001/EX-002: 57件をrange evidenceへ復元

`scripts/sp017_physical_measurement_range_reclassification.mjs` が元ファイルを**上書きせず**、
`outputs/derived/sp017_physical_measurement_range_reclassification.json` へ非破壊overlayとして出力。

各レコードに追加した情報:

- `corrected_usage_class: HISTORICAL_PROFILE_RANGE_EVIDENCE`
- `confidence`: protocol/dateどちらも欠ける場合`low`、片方だけ欠ける場合`low_medium`
- `protocol_flag` / `temporal_flag`: 何が不明かを機械可読に保持
- `numeric_t90_usable: false`（維持）— **比例T90変換は引き続き禁止**（EX-020）。
  current-year direct accelerationの入力にはしない。あくまでhistorical/profile evidence

結果: 57件中 confidence=medium 3件・low_medium 3件・low 51件。temporal_flag=DATE_UNKNOWN 54件・DATE_KNOWN 3件
（DATE_KNOWNでもtiming_methodが不明なため対象に残った3件）。

## 3. EX-025: 現行実装は既に是正方針どおりと確認

EX-025の是正方針は「数値証拠としては使わない。source follow-up候補としてraw ledgerに残すことは可」。
`REJECTED_TIER_C_FULL_TABLE_NOT_INDEPENDENTLY_VERIFIED`（25件）は、既に**削除されずraw ledgerに
残っており**、rejection_reasonも記録済みで、numeric evidenceとしては使われていない。
**追加の実装変更は不要**——是正方針の要求を現行データ構造が既に満たしている。

## 4. 結論

| exclusion | 対応 |
|---|---|
| EX-001 | 57件をrange+confidence+protocol flag付きhistorical evidenceへ復元完了 |
| EX-002 | 同上（temporal_flag付き） |
| EX-025 | 現行実装が既に方針どおりと確認、変更不要 |

## 5. 次段候補（このタスクの範囲外）

`REJECTED_CONTACT_TO_RUN_TRANSITION_OR_GAME_CONTEXT`（71件、`data/normalized/`側）が
SP-007のH2F低信頼度レーンと同種の再分類対象になりうるかは未検討。オーナーの今回の優先指示
（SP-015/016/018/019/007/017の6件）には含まれないため、次のCommunity/証拠統合Phaseで
判断する候補として記録するに留める。

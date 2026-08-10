# 2026 NPB 走力 Final Targeted Evidence Rescue — Audit

- 実施日: 2026-08-11
- 対象: canonical 18人のみ（旧SNS未解決12人 + residual scopeで限定された新規6人）。
- 結論境界: 最終ゲーム数値・T90換算・年齢減衰・動画収集/分析は行っていない。

## カバレッジ

- Active canonical coverage: 18/18
- 旧12人のcurrent physical measurement: confirmed 0/12; not found 12/12
- 新規6人のcurrent physical measurement: confirmed 1/6; not found 5/6
- 現在期のdirect T90: 1
- 現在期の標準化30m: 0
- 現在期の標準化50m: 0

## Grok-X temporal rescue

- 新規6人 query plan: 54
- 実行receipt: 54（OK 54, failure 0）
- raw X hits: 45
- reviewed sources: 38; accepted 7; rejected 31
- independent qualifying X: >=2 sources 0人; >=3 sources 0人
- inaccessible/deleted: 0
- 既存ledgerとの重複は新しい独立票にしない。具体的な判定は data/normalized/speed_2026_new6_grok_x_temporal_sources.json の各source recordに保存。

## 筒香嘉智のT90来歴訂正

- 2022公式Baseball Savant Running Splits CSVのplayer_id 660294 / `Tsutsugo, Yoshi`行を再検証し、T90=4.20秒を `CONFIRMED_PRIMARY` とした。
- これは2024–2026年のcurrent physical measurementではない。既存historical anchor bankは上書きせず、今回のseparate-provenance correctionとしてのみ保存した。

## 解決分類

- 旧12人のpre-rescue Grok-X/SNS classification: INSUFFICIENT_SNS_EVIDENCE=8, METRIC_CONSTRUCT_CONFLICT=2, MIXED_CONSENSUS=2
- INSUFFICIENT_EVIDENCE_REMAINS: 13
- METRIC_CONSTRUCT_CONFLICT_REMAINS: 2
- MIXED_EVIDENCE_REMAINS: 2
- RESOLVED_CURRENT_PHYSICAL_MEASUREMENT: 1
- Video queue: 17

## Video queue（動画は未取得）

| Player | Resolution | Exact video question |
|---|---|---|
| 西野 真弘 | INSUFFICIENT_EVIDENCE_REMAINS | 西野 真弘: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| カリステ | INSUFFICIENT_EVIDENCE_REMAINS | カリステ: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| 土田 龍空 | MIXED_EVIDENCE_REMAINS | 土田 龍空: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、相反する同時代証拠のどちらが現在の身体的走速度をより良く表すかを判定する。 |
| 大島 洋平 | INSUFFICIENT_EVIDENCE_REMAINS | 大島 洋平: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| 友杉 篤輝 | METRIC_CONSTRUCT_CONFLICT_REMAINS | 友杉 篤輝: 2026年の同条件・全力直線走を複数プレーで確認し、現在のNPB+順序と過去年の別計測constructの差が、現時点の身体的走速度差として残るかを判定する。 |
| 外崎 修汰 | INSUFFICIENT_EVIDENCE_REMAINS | 外崎 修汰: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| 矢野 雅哉 | INSUFFICIENT_EVIDENCE_REMAINS | 矢野 雅哉: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| 野間 峻祥 | INSUFFICIENT_EVIDENCE_REMAINS | 野間 峻祥: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| 中村 悠平 | INSUFFICIENT_EVIDENCE_REMAINS | 中村 悠平: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| 林 琢真 | METRIC_CONSTRUCT_CONFLICT_REMAINS | 林 琢真: 2026年の同条件・全力直線走を複数プレーで確認し、現在のNPB+順序と過去年の別計測constructの差が、現時点の身体的走速度差として残るかを判定する。 |
| 梶原 昂希 | INSUFFICIENT_EVIDENCE_REMAINS | 梶原 昂希: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| 梅野 隆太郎 | MIXED_EVIDENCE_REMAINS | 梅野 隆太郎: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、相反する同時代証拠のどちらが現在の身体的走速度をより良く表すかを判定する。 |
| 筒香 嘉智 | INSUFFICIENT_EVIDENCE_REMAINS | 筒香 嘉智: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |
| 秋山 翔吾 | INSUFFICIENT_EVIDENCE_REMAINS | 秋山 翔吾: 2026年の全力直線走を確認し、歴史的な直接T90計測の方向性が現在にも保たれているか、または現在の速度変化を示す明確な観察があるかを判定する。 |
| ポランコ | INSUFFICIENT_EVIDENCE_REMAINS | ポランコ: 2026年の全力直線走を確認し、歴史的な直接T90計測の方向性が現在にも保たれているか、または現在の速度変化を示す明確な観察があるかを判定する。 |
| サンタナ | INSUFFICIENT_EVIDENCE_REMAINS | サンタナ: 2026年の全力直線走を確認し、歴史的な直接T90計測の方向性が現在にも保たれているか、または現在の速度変化を示す明確な観察があるかを判定する。 |
| 奈良間 大己 | INSUFFICIENT_EVIDENCE_REMAINS | 奈良間 大己: 2025–2026年の一歩目から約90ftまでの全力直線走を複数プレーで確認し、現行NPB+ bandを支持・一段速い・一段遅いのいずれかだけを判定する。 |

## 負の所見・除外

- 旧12人について、現行windowの個人別・protocol documented sprint measurementは確認できなかった。これは情報不存在の主張ではない。
- 中村悠平の30mスプリント予定は、個人結果・計時方式・実施確認を欠くため不採用。梶原昂希の50m 5.8秒は計測年・protocol不明のため不採用。
- 新規6人ではモンテロ以外にcurrent-windowの採用可能なdirect T90/標準化30m/50mは確認できなかった。
- 盗塁技術、走塁判断、内野安打、HP→一塁到達、ゲーム査定、年齢だけの推測は入力に用いなかった。
- 一時Grok collectorの文字コード不整合は検出時点で証拠から除外し、正しい選手名を持つreceiptのみを採用対象とする。

## 100人統合・再現性

- frozen 100-player post-SNS supportのplayer objectsは別overlay方式により不変。18 active overlayと既存Grok-X解決済み7人overlayのみを追加した。
- PowerPro residual outputは新規6人のscope selectionだけに使い、検索方向・解決分類・数値調整には使っていない。
- Build script: `scripts/build_speed_2026_final_targeted_evidence_rescue.mjs`。最終QA scriptは別途すべてのartifactとbaseline不変性を検査する。

## QA

- Deterministic QA status: `PASS`（25 deterministic checks、独立QA verdict: `PASS`）。

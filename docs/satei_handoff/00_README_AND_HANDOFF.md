# パワプロ査定プロジェクト — Claude Code 引き継ぎパッケージ

作成日: 2026-07-31  
状態: **v2.0再設計フェーズ + 2026-08-09追補**  
対象: 実在選手をパワプロ風に査定するための、再現可能・検証可能な野手査定モデル  

---

## 1. このパッケージの目的

本パッケージは、長い対話の中で形成・修正された査定思想、誤り、検証結果、撤回事項、未解決課題を、Claude Code / Codex / ブラウザGPT間で引き継げる形に整理したもの。

最重要事項は次の通り。

> **過去に出力した具体的な能力値の多くは最終版ではない。**  
> 価値があるのは、どの指標を分離し、どの二重計上を避け、どのデータを収集すべきかという設計知見である。

さらに、一般仕様と現在の作業順を区別する。

- `12_APPRAISAL_PRINCIPLES_20260809.md` = 最新の査定設計原則
- `13_CURRENT_CRITICAL_PATH_20260809.md` = **現在どこまで進めてよいかを拘束する運用正本**

新しい能力テーマへ移る前に必ず両方読むこと。

---

## 2. 推奨読書順

1. `00_README_AND_HANDOFF.md`
2. `12_APPRAISAL_PRINCIPLES_20260809.md` **（最新査定原則）**
3. `13_CURRENT_CRITICAL_PATH_20260809.md` **（現在の作業順・停止条件。必読）**
4. `01_HISTORY_DECISION_LOG.md`
5. `02_CURRENT_SPEC_V2.md`
6. `03_FORMULAS_DATA_CONTRACTS.md`
7. `04_RUNNING_DEFENSE_CATCHER.md`
8. `05_SPECIAL_ABILITIES_KONAMI.md`
9. `06_CARP_CASE_STUDY_AUDIT.md`
10. `07_WBC2017_PRIME_STATUS.md`
11. `08_CLAUDE_CODE_IMPLEMENTATION_PLAN.md`
12. `09_QA_TESTS_OPEN_QUESTIONS.md`
13. `10_SOURCE_CATALOG.md`
14. `11_LEGACY_REFERENCE_V1_9.md`

---

## 3. 各ファイルの役割

| ファイル | 役割 |
|---|---|
| `12_APPRAISAL_PRINCIPLES_20260809.md` | **最新追補**。ミート→パワー処理順序、HRを結果扱いする原則、T90走力定義、NPB+ transfer boundary、小標本、アンカー/SNS、PowerPro/The Show時系列QA、大規模Codex並列委任 |
| `13_CURRENT_CRITICAL_PATH_20260809.md` | **現在の進行正本**。Speed v1 architecture完了と走力査定完了を区別し、肩力へ移るGate、待機中Codex成果、到着済み走力成果、次工程を固定する |
| `01_HISTORY_DECISION_LOG.md` | 会話で起きた修正を時系列で記録。なぜ現在の仕様になったかを把握する |
| `02_CURRENT_SPEC_V2.md` | v2時点の採用仕様、保留事項、撤回事項。追補と矛盾する箇所は追補優先 |
| `03_FORMULAS_DATA_CONTRACTS.md` | 入力スキーマ、数式、データ階層、出力台帳 |
| `04_RUNNING_DEFENSE_CATCHER.md` | v2時点の走力・盗塁・守備・捕球・肩・送球・捕手阻止モデル。走力部分は追補を優先 |
| `05_SPECIAL_ABILITIES_KONAMI.md` | 青赤得能、金特、能力との二重計上防止、KONAMI比較手順 |
| `06_CARP_CASE_STUDY_AUDIT.md` | カープ査定で判明した具体的なミスと、再査定時の論点 |
| `07_WBC2017_PRIME_STATUS.md` | 最終ロースター、全盛期年度候補、未確定事項 |
| `08_CLAUDE_CODE_IMPLEMENTATION_PLAN.md` | リポジトリ構成、モジュール、実装順序、成果物 |
| `09_QA_TESTS_OPEN_QUESTIONS.md` | 自動テスト、受入基準、未解決研究課題 |
| `10_SOURCE_CATALOG.md` | 一次情報・分割データ・KONAMI比較先・野間画像の転記 |
| `11_LEGACY_REFERENCE_V1_9.md` | 旧仕様書を原文のまま保存。新仕様と混同しない |

---

## 4. Claude Code / Codex / ブラウザGPTへの最初の指示

```text
最初に 12_APPRAISAL_PRINCIPLES_20260809.md と
13_CURRENT_CRITICAL_PATH_20260809.md を読んでください。

12は最新の査定原則、13は現在の作業順と停止条件です。
13がACTIVEの間は、一般仕様上「次の能力へ進める」状態に見えても、
13のGateを満たさない限り別能力へ移らないでください。

特に PR #3 の `Speed v1 complete` は、
T90 production architecture と MLB calibration path の完了であり、
2026 NPBの最終走力査定完了を意味しません。

現在13がACTIVEな間、ユーザーの「進めて」は
走力critical pathの次工程を進めるという意味です。
Codex待ちを理由に肩力等へ横展開しないでください。

過去に出力された能力値は正解として扱わず、ケーススタディ上の失敗例として扱ってください。
未校正係数を勝手に確定しないでください。
PowerPro / MLB The Showは独立査定を凍結した後の外部QAです。
```

---

## 5. 現在の最重要原則

- **KONAMI能力は正解ではない。** 独自査定を先に固定する。
- **計算式と途中値を全選手で出す。** 印象による無根拠な点補正は禁止。
- **得能込み基準と基礎能力を分ける。**
- **同じ情報を能力と得能に二重計上しない。**
- **使えない交差データを推測式で捏造しない。**
- **出場量は主に信頼度。能力への直接加点ではない。**
- **本塁打はパワーの結果であり、HR数だけでパワーを決めない。**
- **ミートを先に確定し、パワーを後から査定する。M/P相互作用を両側から二重控除しない。**
- **走力は最初の走行ステップから約90ftの身体速度。盗塁・走塁技術・打席からの移行を混ぜない。**
- **NPB+ Sprint Speedは現状provisional。少出場では最大努力走行未観測を疑う。**
- **高信頼アンカー＋相対比較＋高品質SNSコンセンサスでデータ不足を補完してよい。**
- **PowerPro / MLB The Showは独立査定凍結後のQA。差を教師値・補正量にしない。**
- **大規模なread-heavy収集はCodexへ委任し、サブエージェント並列実行を明示する。**
- **金特は歴史的水準のみ。候補乱発は禁止。**
- **投手は未設計。野手仕様を流用して数値化しない。**

---

## 6. 現在のステータス

| 作業 | 状態 |
|---|---|
| T90 production architecture | 完了 |
| MLB 2017-2025 T90 calibration | 完了 |
| 2026 NPB最終走力査定 | **未完。現在のcritical path** |
| 100選手physical evidence | Codex収集済み |
| measurement-date resolution | Codex収集済み。35件中15件年推定、20件unknown |
| 2026 Sprint exposure audit | Codex収集済み。100人PA/games/proxy取得、NPB+ sample countは非公開 |
| PowerPro 2015-2026 update-level long panel | **回収待ち / 統合前** |
| MLB The Show Speed long panel | **回収待ち / 統合前** |
| high-confidence speed anchors | **未構築** |
| 2026 100人のanchor/SNS込み再査定 | **未実施** |
| 肩力本格再設計 | **走力Gateを満たすまで開始しない** |
| ミート→パワー査定順序 | 2026-08-09追補で採用、係数未校正 |
| HRを結果扱いするパワー設計 | 2026-08-09追補で採用 |
| 守備分解 | 方向採用、ゲーム係数未校正 |
| 捕手盗塁阻止 | 方向採用、ゲーム係数未校正 |
| 得能寄与 | 方向採用、点数未校正 |

---

## 7. 出力上の絶対条件

各選手の最終レポートには必ず以下を含める。

```text
カード定義
使用年度
採用理由
入力データ
データ出典
欠損・推定
環境補正
小サンプル/観測機会の信頼度
平均得能込み能力
得能一覧
得能平均との差
M/P相互作用（ミート先、パワー後）
最終能力
走守の分解
走力の証拠Tier / exposure / temporal QA
アンカー/SNS相対比較を使った場合の根拠
信頼度
未確認事項
PowerPro / The Show比較（最後）
```

---

## 8. 重要な用語

| 用語 | 意味 |
|---|---|
| 補正成績 | 年度・リーグ・球場・サンプルを調整した統計値 |
| 平均得能込み基準 | その成績帯の選手に平均的な得能がある場合の能力 |
| 個別査定能力 | 実際に付与する得能を差し引いた基礎能力 |
| 実効能力 | 基礎能力と得能をゲーム内で合成した性能 |
| Prior | 少サンプルの実績を縮小する先の事前実力分布 |
| Blind freeze | PowerPro等の外部査定を見る前に独自査定を凍結すること |
| Provenance | 各数値の出典と加工履歴 |
| Anchor | 身体データ・時系列等が十分で、相対比較の基準にできる高信頼査定選手 |
| Ordinal QA | 絶対点ではなく「Aより速い/Bより遅い」等の順位制約で検証すること |

---

## 9. 注意

このプロジェクトは、まだ「完成済み査定表」ではなく、**厳密な査定エンジンを構築する研究開発プロジェクト**である。

現在は走力critical pathがACTIVEであり、`13_CURRENT_CRITICAL_PATH_20260809.md` の肩力移行Gateを満たすまで次能力へ進まない。

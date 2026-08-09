# 2026 NPB 100人 走力独立査定 freeze — 2026-08-10

Status: `INDEPENDENT_FREEZE_WITH_RANGES / EXTERNAL_QA_NOT_APPLIED`

## 目的

PowerPro / MLB The Show を最終的な外部QAへ使う前に、2026 NPB+ Sprint Speed 100人について独立査定を凍結する。

このfreezeではゲーム能力値を教師値・補正量・fit対象に使わない。

## 基礎線

99人については既存の PowerPro-blind v3 evaluation baseline:

- `outputs/derived/speed_blind_v3_npbplus_2026.json`
- `T90 = 4.05 - 0.1015374380 * (NPB+ Sprint Speed km/h - 31.6)`
- `rating = clamp(1,100,100 - 99*(T90-3.66)/(4.78-3.66))`

を「評価用基礎線」として使用する。

これは final production NPB CDF ではない。NPB+→T90 bridgeも未較正なので、基礎線は点推定の真値ではなく、100人を同一規則で並べるための独立スタート地点である。

名原典彦は player_id 欠損のため元99人JSONに入っていないが、NPB+ Sprint Speed 33.7 km/h に同じ凍結式を機械適用し、評価基礎線 84.3747 とする。これは個別手修正ではない。

## evidence / exposure 方針

- direct T90 は最上位の物理証拠。
- standardized/electronic 30m/50m は acceleration / ordinal evidence。50m秒数を距離比例でT90へ換算しない。
- historical/profile 30m/50m は順位方向の補助。測定年が推定できても evidence tier を自動昇格しない。
- NPB+ exposure の PA / full-effort-run proxy は confidence / triage 用。点数補正には使わない。
- 古い物理記録は固定の年数減衰係数で補正しない。
- 5年以上前の物理記録も履歴として保持するが、現在T90へ機械投入しない。temporal trajectory と現在の物理証拠を見て ordinal constraint として使う。

## MLB The Show temporal QA の扱い

The Show成果は `L-carp55/claude-code-hub` の以下2branchで確認した。

- `codex/mlb-the-show-speed-history` HEAD `97c429521267cfb70ccdd61e40e11853d100e360`
- `codex/mlb-the-show-full-attributes` HEAD `74d2a2278ab7bcea3f6368e1df6ba03e2dd82554`

Speed-history側は 2021–2026 の284,282 normalized rowsを持つが、Speed provenanceの283,884行は current item snapshot の carry-forward、公式roster-update deltaから復元された行は398。`attribute_change_receipts.csv` の今回保存receiptは計66行で、Speed receiptは62行、全て2026年5/7・6/11・7/15の上方変更である。

したがって今回のThe Show成果から aging decline / lag / smoothing の数値モデルを同定してはいけない。The Showは「長期temporal係数を作れない」というnegative resultを含む外部QA資料として扱う。

17–20も完全な独立QA済みpanelではないため、2017–2026完全長期trajectoryとはみなさない。

## PowerPro temporal QA の扱い

PowerPro長期panelは外部QA用であり、freeze値の計算には使わない。

特に same-player same-date differing-speed conflict はtrajectory計算から除外またはconflict扱いとし、都合のよい一方を選ばない。

## 独立freezeの表現

原則:

- 追加の強い独立物理証拠と大きな矛盾がない選手: v3 evaluation baseline の一点を freeze point とする。
- 強い追加物理証拠と基礎線が衝突する選手: arbitrary weightで平均せず freeze range とする。
- historical/profile evidenceのみの矛盾は、一点を機械修正せず `ordinal_review` を残す。

### 強いrange対象

#### 林琢真

- NPB+ Sprint Speed 32.0 -> v3 baseline 69.1169
- 2022-06-19 standardized electronic/photoelectric 50m 5.99 sec
- 既存 acceleration candidate は short-distance side 77.3790, top-speed side 69.1169
- 2026 exposure: PA 104, full-effort proxy 8 と薄い

Freeze: `69.1–77.4`

解釈: current NPB+ pointを下限候補とし、光電管短距離能力が示す上振れをrangeとして保持する。一点化しない。

#### 友杉篤輝

- NPB+ 32.7 -> 75.3995
- standardized electronic/photoelectric 50m 6.10 sec
- short-distance candidate 73.7179
- 2系統差 0.019 sec相当で十分整合

Freeze: `74–75`（中心は約74.6、表示上は75でも可）

#### 奈良間大己

- NPB+ 31.7 -> 66.4243
- standardized electronic/photoelectric 50m 6.31 sec
- short-distance candidate 66.7285
- 2系統ほぼ一致

Freeze: `66–67`（中心は約66.6、表示上は67でも可）

### ordinal review 対象

以下はhistorical/profile evidenceまたは低exposureとの衝突があるため、外部QA前のfreezeではv3 pointを教師に合わせて手修正せず、`ordinal_review`を付ける。

- 並木秀尊: Sprint 33.8 / baseline 85.27。PA45・proxy6と低exposure。ただしSprint自体が既にelite。5.32秒特殊スタート記録は `REJECTED_FOR_SPEED`。現時点で自動+補正しない。
- 矢野雅哉: Sprint 30.7 / baseline 57.45。PA58・proxy15と低exposure。historical 50m 5.9はprotocol/year不明の方向証拠。`57`を基礎点として保持し、相対比較で上方range候補を再検討する。
- 小園海斗: Sprint 31.5 / baseline 64.63。PA382・proxy49で十分なexposure。高校時代5.8–6.0はdirectional evidenceだが、乖離を小標本では説明できない。`65`を基礎点として保持し、現在ordinal comparisonのみ追加する。
- 塩見泰隆: Sprint 32.3 / baseline 71.81。2018 30m 3.85 sec は強い方向証拠だが測定年が古く、2026 PA83・proxy8。`72`を基礎点としてrange検討対象。
- 梶原昂希: Sprint 33.4 / baseline 81.68。PA73・proxy7と低exposure、historical 50m 5.8方向証拠。Sprint自体は高速側なので自動補正しない。
- 名原典彦: Sprint 33.7 / 同式baseline 84.37。50mに複数矛盾記録（manual 6.2 / electronic 5.9 / 別記事約7.3）と年不明があるため、基礎点84を保持しordinal review対象。

## 以前の暫定manual correctionから戻すもの

過去の provisional reappraisal で手修正されていた以下は、今回の最新原則ではゲームQA・owner band・profile印象に合わせた補正を独立freezeへ持ち込まない。

- 村林一輝: baseline 91.55を独立基礎線へ戻す。PA386 / proxy63で十分な現行観測。
- 細川成也: baseline 75.40を独立基礎線へ戻す。PA429 / proxy37で十分な現行観測。
- 小園海斗: provisional 70固定は撤回し、独立基礎点65 + ordinal_review。
- 矢野雅哉: provisional 60固定は撤回し、独立基礎点57 + ordinal_review。
- 並木秀尊: provisional 90固定は撤回し、独立基礎点85 + ordinal_review。

これは「v3が正しいから戻す」のではなく、外部QAや印象を教師としてfreeze前にfitしないための処置である。

## freeze後に許可する工程

このファイル保存後は初めて:

1. PowerPro 2026 / long panelとの外部QA
2. MLB該当ケースについてThe Showとの外部QA
3. 大きなdisagreementの分類（metric-definition / acceleration / temporal / exposure / game-lag / unknown）
4. ゲーム値へ合わせず、独立査定側の証拠不足が判明した場合だけ再open理由を明示

を行ってよい。

## まだfinal productionでない理由

- NPB+→T90 bridgeは未較正。
- final NPB T90 reference CDFは `POLICY_DRAFT_REFERENCE_NOT_FROZEN`。
- NPB+100人はNPB全野手の完全・無作為標本ではない。
- このfreezeは「2026 100人の独立査定を外部QA前に固定する」ための査定成果であり、production inverse-fの最終freezeとは別。

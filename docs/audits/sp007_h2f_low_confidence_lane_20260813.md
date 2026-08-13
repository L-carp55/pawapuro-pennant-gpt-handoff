# SP-007 — H2F（一塁到達）を低信頼度の別レーンとして復元（EX-003/EX-015是正）

生成日: 2026-08-13
状態: **低信頼度レーン新設完了。strict T90パイプライン(speedComponents)は無変更**

## 0. 何が違反だったか

`data/manual/npb_speed_physical_evidence_full_20260809.json` の一塁到達（hp_to_1b）
実測31件（15選手、重複あり）が、全件 `usage_class: CONTEXT_ONLY` / `numeric_t90_usable: false`
として、走力へのどの経路からも参照されない状態だった（EX-003: OVERBROAD_REOPEN）。

一方、EX-015が指す「strict direct-current acceleration prior は ready_players=0」
（`configs/speed_acceleration_prior.json` 系の厳密T90 prior）はそれ自体が正しい
negative findingであり、**別レーンを新設してもこれは上書きしない**。

## 1. データの中身

- hp_to_1b実測 31件 / 15選手（重複あり、`same_measurement_cluster_id`でdedup）
- 打撃→走行移行・打席左右・打球経路等が混ざる「通常スイング」25件と、
  スタートが速いバント（セーフティ/プッシュバント）6件が混在していた
- 秒数レンジ 3.40〜4.36秒

## 2. 分離した処理

`scripts/sp007_h2f_low_confidence_lane.mjs`:

1. **同一クラスタの重複を畳む**（EX-022 VALID_DEDUP、同一測定の転載を独立票にしない）
2. **bunt/normal-swingを分離**（EX-003 corrected_policy）。バント6件は通常スイングより
   有意に速くなり得るため、同一分布として比較できない → 別集計、混ぜない
3. **打者左右をDBから結合**（`nf3_team_bat.bats`）。結果=右6人・左13人
4. **サンプル内標準化z-scoreを作る**（strict T90 priorとは別軸。標準化50m集団とhp_to_1bは
   プロトコルが違うため混ぜない）

## 3. 結果

| レーン | 選手数 | 平均 | SD |
|---|---|---|---|
| normal-swing | 15人 | 3.962秒 | 0.133秒 |
| bunt | 4人 | n<5のため標準化なし（バラつきの推定に十分な標本がない） |

## 4. 使い方の境界（EX-015を上書きしない）

- **strict T90パイプライン（`src/ratings/running.mjs` speedComponents）は無変更**。
  このレーンのzを走力の合成zへは配線しない
- `EX-015` の`strict prior alpha=0` というnegative findingは、このレーンとは
  **別の問い**（=「厳密な現在直接加速度証拠があるか」）に対する回答であり、
  低信頼度レーンの新設で「解決した」ことにしない
- 用途: `docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md` §5B
  `practical_powerpro_style_speed`（owner review向け実用査定）の補助材料。
  単独で走力点を決めず、他の同時点証拠と併記してowner reviewへ渡す

## 5. 出力

`outputs/derived/sp007_h2f_low_confidence_lane.json`（選手別z・出典・bunt/normal区分・打者左右付き）

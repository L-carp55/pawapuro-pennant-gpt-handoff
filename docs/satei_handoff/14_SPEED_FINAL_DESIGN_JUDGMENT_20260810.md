# SPEED FINAL DESIGN JUDGMENT — 2026-08-10

Status: **2026 NPB 100 APPRAISAL GATE COMPLETE / PRODUCTION NPB T90 CDF REMAINS SEPARATE CALIBRATION LIMITATION**

この文書は2026-08-10時点の走力査定フェーズの最終設計判断である。

## 1. 走力の定義

基礎走力は、盗塁技術・走塁判断・打席からのスタート動作・内野安打結果とは分離し、**最初の走行ステップから約90ftを移動する身体能力**を対象とする。

盗塁、走塁、内野安打○等は別能力・特殊能力で表現する。

## 2. 証拠階層

現在の優先順位:

1. clean direct T90 / 90ft
2. clean T30/T10 splits
3. standardized electronic/photoelectric 50m
4. NPB+ Sprint Speed current ordinal baseline
5. historical/protocol-unknown 30m/50m directional evidence
6. HP→1B contextual evidence
7. scouting / current qualitative consensus / video tie-break

50mを距離比例でT90へ変換しない。HP→1Bをbase speedへ直変換しない。

## 3. NPB+ Sprint Speedの扱い

NPB+ Sprint Speedは2026同一データセット内のcurrent ordinal baselineとして有用。ただし公開定義がMLB Statcast Sprint Speedと数値的に同一とは確認できず、NPB+→T90 bridgeは未較正。

したがってMLB係数をkm/h換算して移植しない。

2026 exposure auditでは低PAほどSprint Speedが低くなる一般関係は確認されなかった。PA / full-effort proxyはconfidence/triageにのみ使い、固定PA閾値補正・点数加点をしない。

## 4. acceleration

MLB 2017–2025ではSprint Speed単独T90モデルより、T10/T30を加えたモデルの誤差が明確に小さい。したがってbase speedはtop speedだけでは不十分で、acceleration profileが独立情報である。

NPB側でclean accelerationがある選手だけ個別に使う。全員へ一律の加速補正を置かない。

standardized 50mは88観測の同条件/明示プロトコルbankをordinal/acceleration priorとして使用するが、秒数を直接T90へ距離比例変換しない。

## 5. temporal policy

固定式 `measurement age × decay coefficient` は採用しない。

測定時代のphysical evidenceとcurrent evidenceを別に保持し、必要に応じて:
- STABLE / agreement
- DECLINE_SUPPORTED
- IMPROVEMENT_SUPPORTED
- CONFLICTED
- UNKNOWN

として解釈する。

古い高品質測定は年齢だけで無効化しない。一方、5年以上前の値を現在T90へ機械投入もしない。

故障・復帰・current exposure・current Sprint・独立physical evidenceを優先し、PowerPro/The Showの変化量を身体減衰係数にしない。

## 6. PowerPro / MLB The Show

両者は**独立査定freeze後の外部QAのみ**。

PowerPro 99人QA:
- mean blind 65.45 / PowerPro 65.67
- mean difference -0.22
- correlation 0.766
- MAE 7.95

全体中心は近いが個人差が大きい。従ってPowerProに合わせたglobal shift、position correction、residual fitをしない。

MLB The Show long-history collectionは大量のnormalized rowsを持つが、historical Speedの大半がcurrent snapshot carry-forwardであり、公式deltaから復元できた履歴は限定的。今回の保存receiptも上方変更側へ偏っているためaging/lag/smoothing係数を同定しない。

The Showのnegative resultも最終判断の一部である。

## 7. high-confidence anchor方式

アンカーは4層に分ける:
- Absolute T90 anchor
- standardized short-distance / acceleration anchor
- current NPB+ ordinal anchor
- temporal case anchor

詳細は `docs/audits/speed_high_confidence_anchor_pool_20260810.md`。

ゲーム能力値をanchorとして使用しない。

## 8. 2026 NPB 100人の独立査定

機械可読正本:
- `outputs/derived/speed_independent_freeze_v2_2026_100_20260810.json`

基礎:
- 既存 PowerPro-blind v3 evaluation baseline 99人
- 名原典彦は同一式で100人目を機械補完
- direct T90 / standardized short-distance / temporal evidenceによる明示override/range

広いconflict rangeを意図的に残す選手:
- 林琢真 69.1–77.4
- カリステ 63–75
- 秋山翔吾 66–73
- ポランコ 61–71
- モンテロ 52–68

強い独立証拠が整合し一点化できる代表:
- 友杉篤輝 75
- 奈良間大己 67
- サンタナ 58
- 筒香嘉智 53

その他はfreeze-v2のdefault rule / explicit overrideで再現する。

rangeは統計的confidence intervalではなく、独立物理証拠が示す候補envelopeである。

## 9. QAで再openした唯一の数値ロジック

v1 freeze後のQAで「direct T90を最上位と定義したのにdefault NPB+ pointを採用した」という内部整合ミスを発見した。

これはPowerPro/The Showへのfitではなく、v1以前から存在した独立Statcast T90を正しく適用するための修正。v2として履歴を分離保存した。

## 10. production NPB T90 CDFについて

`configs/speed_t90_reference_policy.json` のfinal NPB T90 reference CDFは未freezeであり、`configs/speed_t90_models.json` のNPB+→T90も `UNCALIBRATED`。

公開データ収集を終えた現時点でも、NPB+ Sprint Speedとclean NPB T90を結ぶ十分な同一選手較正セットは得られていない。

このため、係数を捏造してproduction inverse-fを閉じない。

これは**2026 NPB 100人の査定を終えられないという意味ではない**。2026 appraisalはordinal/physical-evidence方式でfreezeし、production T90 CDFは将来の測定データ追加時にのみ置換可能なengineering calibration layerとして残す。

## 11. 走力Gate

- [x] 依頼済み主要Codex成果を回収 / 取得不能部分を明示
- [x] physical evidence / date resolution / exposure audit統合
- [x] PowerPro full temporal panel分析
- [x] MLB The Show Speed temporal QA分析（数値temporal model不可というnegative result含む）
- [x] temporal policy確定
- [x] high-confidence anchor方式を実データで構築
- [x] 2026 NPB 100人を最新原則で再査定
- [x] データ不足・主要外れ値をanchor / selective qualitative evidenceで監査
- [x] independent appraisal freeze v2
- [x] freeze後PowerPro / The Show external QA
- [x] 循環fit禁止を維持
- [x] 最終走力設計判断をGitHubへ保存

### Gate verdict

**2026 NPB 100人の走力査定フェーズは完了。**

ただしproduction NPB T90 reference CDF / NPB+→T90 regressionは、現在の公開データでは識別不能な別engineering limitationとして残る。これを埋めるためにゲーム値へfitしてはならない。

次能力へ進む場合も、この文書・freeze-v2・external QA auditを走力正本として扱う。

## 12. 主要成果物

- `docs/audits/speed_independent_freeze_2026_100_20260810.md` — v1監査履歴
- `outputs/derived/speed_independent_freeze_2026_100_20260810.json` — v1 machine-readable
- `docs/audits/speed_independent_freeze_v2_direct_t90_correction_20260810.md` — v2 correction rationale
- `outputs/derived/speed_independent_freeze_v2_2026_100_20260810.json` — final 2026 appraisal freeze
- `docs/audits/speed_external_qa_after_freeze_20260810.md` — post-freeze external QA
- `docs/audits/speed_high_confidence_anchor_pool_20260810.md` — anchor pool
- this file — final design judgment

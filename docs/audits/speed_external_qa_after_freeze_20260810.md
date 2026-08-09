# 走力 independent freeze 後の external QA — 2026-08-10

Status: `EXTERNAL_QA_COMPLETE_WITH_SOURCE_LIMITS`

## 原則

この監査は independent freeze v2 の後に行う。PowerPro / MLB The Show の数値へ査定をfitしない。ゲーム値との差は、独立査定側の証拠不足・metric mismatch・temporal issueを発見する診断にのみ使う。

## PowerPro 2026 cross-sectional QA

既存 `outputs/derived/speed_blind_v3_powerpro_qa_2026.json` の99人比較:

- blind v3 mean: 65.4452
- PowerPro mean: 65.6667
- mean blind - PowerPro: -0.2215
- MAE: 7.9466
- RMSE: 10.0182
- correlation: 0.7661
- within ±5: 42.4%
- within ±10: 63.6%
- |diff| > 10: 36/99
- |diff| > 15: 13/99

結論: 全体中心はほぼ一致しているため、PowerProへ合わせたglobal shift / scale fitは不要かつ禁止。個人差が主問題。

### 大差の代表

blind > PowerPro:
- 古賀優大 +24.0
- 村林一輝 +22.6
- 宮﨑敏郎 +20.9
- 浅村栄斗 +20.7
- 大城卓三 +20.0

blind < PowerPro:
- 野間峻祥 -21.6
- 矢野雅哉 -20.6
- カリステ -19.2
- 京田陽太 -17.0
- 小園海斗 -14.4

既存QAで fastest HP→1B residual と blind-vs-PowerPro residual の相関は約0.061。したがってHP→1B残差をacceleration correctionとして導入しない。

position別差も診断に留め、捕手/遊撃/外野等のposition係数をbase speedへfitしない。

## 差の解釈

### 村林一輝
2026 NPB+ Sprint Speed 34.5、PA386 / full-effort proxy63でcurrent exposureは十分。PowerProとの差だけで91.6を69へ下げない。historical 50m 6.2はprotocol不明の方向証拠であり、current physical observationを機械的に覆せない。分類: `METRIC_OR_PROFILE_CONFLICT / NO_GAME_FIT`。

### 細川成也
2026 NPB+ 32.7、PA429 / proxy37。以前のmanual 69への降格は独立freezeでは撤回。historical 6.2 profileだけでcurrent Sprintを大きく下げない。分類: `HISTORICAL_PROFILE_CONFLICT / CURRENT_EXPOSURE_SUFFICIENT`。

### 矢野雅哉
2026 NPB+ 30.7、PA58 / proxy15。historical 50m 5.9はprotocol/year不明。追加の独立記事では「足は速い方でも特別速いわけではない」という評価や、本人が羽月を「特別足が速い」と区別する発言があり、PowerPro 78を教師に上方fitする根拠にはならない。freeze v2は57を維持。分類: `LOW_EXPOSURE + HISTORICAL_DIRECTIONAL_EVIDENCE / MODERATE_FAST_ORDINAL`。

### 塩見泰隆
2018 30m 3.85は強い古い方向証拠だが、2024左膝前十字靱帯・半月板損傷/手術、2025同部位再手術、2026に約1年半ぶり一軍復帰という独立temporal evidenceがある。古い全盛期短距離を現在へ強くcarry forwardせず、current NPB+基礎点72を優先。分類: `DECLINE_SUPPORTED_BY_INJURY_HISTORY`。

### 並木秀尊
NPB+ 33.8はelite側。2026記事/選手紹介でも並外れた脚力・超俊足という方向記述が継続。特殊スタート由来5.32秒はnumeric evidenceとしては引き続きrejectするが、85を下げる独立根拠はない。PowerProへ合わせて97まで上げることもしない。分類: `ELITE_ORDINAL_SUPPORTED / LOW_EXPOSURE`。

### 梶原昂希
NPB+ 33.4。profile 50m5.8はprotocol不明だが俊足方向で一致。82維持。分類: `CURRENT_FAST + HISTORICAL_DIRECTION_AGREEMENT`。

### 名原典彦
NPB+ 33.7。古い50m記録はmanual6.2/electronic5.9/別表記約7.3とconflictし測定年も不明。一方2026支配下登録時の記事・球団周辺資料では俊足/脚力が現在の武器として複数確認される。古い矛盾記録は数値利用せず、mechanical baseline84を維持。分類: `CURRENT_FAST_ORDINAL_SUPPORTED / OLD_MEASUREMENT_CONFLICT`。

## Direct T90 consistency correction discovered during QA

外部QA作業中、v1 freezeの内部ロジックに、direct T90を最上位証拠と定義しながら6人をdefault NPB+ pointのまま処理した矛盾を発見した。

これはゲーム値からの修正ではなく、v1以前から存在する独立Statcast T90を適用する内部整合修正として `speed_independent_freeze_v2_direct_t90_correction_20260810.md` / `speed_independent_freeze_v2_2026_100_20260810.json` に分離保存した。

## MLB The Show QA

Source repo: `L-carp55/claude-code-hub`

- `codex/mlb-the-show-speed-history` HEAD `97c429521267cfb70ccdd61e40e11853d100e360`
- `codex/mlb-the-show-full-attributes` HEAD `74d2a2278ab7bcea3f6368e1df6ba03e2dd82554`

Speed-history collection:
- normalized rows 284,282 (MLB21–26)
- official API assets 983, fetch failures 0
- Speed carry-forward rows 283,884
- Speed reconstructed from official roster-update delta 398
- preserved attribute-change receipts total 66; Speed receipts 62
- preserved Speed receipt sample is 2026 upward-change observations, so it is source-selection-biased for temporal modeling
- Statcast not joined in the collection
- MLB17–20 are not a complete integrated panel

Conclusion: this collection is valuable for provenance and external sanity checking but cannot identify a bidirectional aging decline coefficient, reliable lag distribution, or smoothing model. `The Show change x points => physical speed change y` is prohibited.

The older cross-sectional `the_show_mapping.json` shows strong Sprint-Speed association on a small matched sample, but is not a temporal model and is not used to set 2026 NPB ratings.

## External QA verdict

1. No global rating shift.
2. No position correction.
3. No HP→1B acceleration correction.
4. No PowerPro residual fit.
5. No The Show temporal decay coefficient.
6. Keep direct T90 / standardized short-distance / current NPB+ / exposure / injury timeline as independent evidence layers.
7. Five broad conflict ranges remain intentionally unresolved rather than arbitrarily averaged: 林琢真, カリステ, 秋山翔吾, ポランコ, モンテロ.
8. Narrow/consistent physical overlaps are point-frozen: 友杉75, 奈良間67, サンタナ58, 筒香53.
9. 2026 100-player independent appraisal is reproducibly defined by v3 blind base + 名原 same-formula completion + freeze-v2 overrides. This is an appraisal freeze, not the final production NPB T90 CDF.

## Remaining engineering/model limitation

`configs/speed_t90_models.json` still has NPB+ Sprint Speed -> T90 as `UNCALIBRATED`; `configs/speed_t90_reference_policy.json` still has the final NPB T90 CDF as not frozen. Publicly available data collected in this phase do not identify a valid NPB+↔Statcast T90 bridge strongly enough to fit it.

Therefore do not fabricate coefficients to close the production inverse-f layer. The 2026 appraisal result can be finalized as ordinal/physical-evidence ratings with explicit ranges while the engine reference-CDF layer remains a separately documented future calibration task.

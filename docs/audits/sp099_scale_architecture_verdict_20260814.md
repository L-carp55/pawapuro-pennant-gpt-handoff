# SP-099 — 走力scaleのarchitecture判定（Opus独立、Grok note非依拠）

作成日: 2026-08-14
判定者: Opus senior review（`sp099_production_blend_review_note_20260813.md` は参照したが結論は独立に出した）
状態: **修理実施。SP-071（absolute 0–100の最終確定）には踏み込んでいない**

---

## 1. 3つの値がどの尺度に属するか

| 値 | 生成箇所 | 尺度 |
|---|---|---|
| **statistical speed** `run.speed` | `speedRating(z,cfg)` = `50 + z*15` | **内部尺度（未較正）**。`zscore_ratings.speed` の center=50/spread=15 は「パワプロの分布に合わせた暫定値」と自己申告されているだけで、実分布に当てた較正ではない |
| **applyScale 適用後** | `ability_sheet.applyScale` = `1.3811*v − 4.330` | **パワプロ尺度**。パワプロ143人に対して実測（r=0.727、RMSE 17.8→10.9） |
| **NPB+ direct** `direct.value` | `direct_measurement.mjs` `m.intercept + m.slope*measured` | **パワプロ尺度**。回帰の目標変数がパワプロ能力値そのもの（`SELECT power ... FROM pawapuro_full`） |
| **scouting** | 人手評価 | **パワプロ尺度**（コード注記どおり） |

## 2. 質問への回答

### Q1. scale違いの値をblendしていないか → **していた（確定）**

`blendDirect(statValue, direct)` は
`statValue*(1−w) + direct.value*w` を計算するが、
**statValue は未較正の内部尺度、direct.value はパワプロ尺度**だった。

算術で実証（紅林弘太郎、w=0.76）:

```text
現行     : 42.5(未較正) × 0.24 + 58.6(パワプロ尺度) × 0.76 = 54.8
尺度統一後: 54.4(較正済) × 0.24 + 58.6(パワプロ尺度) × 0.76 = 57.6
```

### Q2. speedOverrideによってapplyScaleを迂回していないか → **していた**

`ability_sheet.mjs`:

```js
走力: speedOverride
  ? graded(speedOverride.value, cfg, {...})   // ability引数なし → applyScale不発
  : graded(run?.speed, cfg, {}, '走力'),      // ability='走力' → applyScale発火
```

**この迂回自体は scouting と direct 成分については正しい**（既にパワプロ尺度なので再較正は誤り）。
問題は、同じ枝を通る blend の**統計成分だけが最後まで一度も較正されない**こと。

実測: 100人中 **97人が direct 経路**（scouting経路は0人）。`uncalibrated` 欄が出ない＝
較正未適用であることがカード上でも確認できた。

### Q3. 逆にscale修理すると二重較正にならないか → **なる。だから直す場所が違う**

blend の**出力**に applyScale を掛けると、既にパワプロ尺度の direct 成分（重み76%）が
二重に較正される。**正しい直し方は、統計成分だけを混合前に較正して尺度を揃えること。**

実装: `blendDirect(statValue, direct, ability)` とし、`ability != null` のとき
`statValue = applyScale(statValue, ability, cfg)` を**混合前に**適用。
`graded(...)` 側は ability 引数なしのまま（＝二重較正しない）。
`applyScale` は `ability_sheet.mjs` から export し、**実装を1つに保った**。

較正が定義されていない能力（パワー）では `applyScale` は恒等なので影響しない
（`scale_calibration.applied` のキーは 走力 と 弾道 のみ）。

### Q4. statPrimarySpeed=true を暫定productionへすべきか → **すべきでない**

`statPrimarySpeed=true` は blend を丸ごと切って統計モデルだけを使う。
確かに尺度バグは回避できるが、**重み76%の direct 実測を捨てる**ことになる。
バグの実害（後述の約3.5点）より、実測を捨てる損失の方が大きい。
**尺度を揃えた blend が正しい経路**であり、`statPrimarySpeed` は診断・比較用の
フラグとして残すのが妥当（既定 false のまま）。

## 3. 修理の実害量

direct 経路の97人について:

| | 修正前 | 修正後 |
|---|---|---|
| 走力の平均 | 61.90 | **65.42** |
| 変化 | — | **全員が上方修正**（平均 +3.52点 / 最小 +1.8 / 最大 +6.7） |

**全員が同方向に動く**のが尺度バグの署名——未較正の内部尺度（center≈50）が
パワプロ尺度（applyScale(50)≈64.7）より系統的に低いため、統計成分24%ぶんだけ
全選手が引き下げられていた。

修正後は blend と `statPrimarySpeed` の差が**双方向**になった
（紅林 +3.4 / 若月 −5.0 / 森 +5.2 / 西川 −0.6）＝ direct 実測が上下どちらにも
効く、正しく較正された挙動。両経路の平均差も 0.60点まで縮んだ。

## 4. 踏み込まなかったこと

- **SP-071（absolute 0–100 scaleの最終確定）は行っていない。** 本修理は
  「既存の2つの尺度を既存の較正式で揃える」ことに閉じており、目盛りそのものを
  定義し直してはいない
- `zscore_ratings.speed` の center=50/spread=15 が暫定値である問題は**残っている**。
  これは SP-071 の領域
- `applyScale` の較正（r=0.727）はパワプロ143人を正解として当てたもの。
  パワプロを教師値とQAの両方に使わない原則（SR-007）との関係は SP-046 の論点であり、
  本修理はその判断を先取りしていない（既存の較正式をそのまま使っただけ）

## 5. 回帰

`test_context_freeze` 22 / `test_ability_sheet` 20 / `test_card_schema` 21 /
`test_cards` 12 / `test_fielding_regressions` 25 = **全100 PASS / 0 FAIL**。
`qa_speed_task_registry.mjs` PASS。

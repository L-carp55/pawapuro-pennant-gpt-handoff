---
status: validated
created: 2026-08-07
branch: agent/satei-phase1-safety
---

# As-of証拠・走力目盛り監査

## 結論

2026-08-07の監査で、過去年カードへ「対象年より後に得られた本人固有の情報」が複数経路から混入していたこと、および統計走力と外部走力が異なる目盛りのまま混合されていたことを確認した。

本修正では次を統一した。

1. 本人固有の証拠は原則として `evidence_year <= targetSeason`
2. 複数年集約済みで年別本人内訳を失った証拠は、集約期間末年より前のカードへ使わない
3. 統計走力と直接計測走力は同じ最終目盛りへ変換してから統合する
4. 統合後の走力を共通zへ戻し、表示・盗塁・内野安打・守備残差で同じ脚力を使う
5. 手査定・スカウティングは `evidence_only` と `decision` を区別する
6. 直接計測（第1階層）を decision スカウティング（第2階層）より優先する

後年のリーグ分布や係数を「較正基準」として使うことまでは禁止していない。禁止するのは、例えば2025年の本人打撃成績や2026年の本人計測値を2024カードの本人証拠として利用することである。

## 1. 直接計測の未来情報遮断

`src/ratings/direct_measurement.mjs` に、査定年以前の計測だけを抽出する処理を追加した。

### MLB Statcast

`mlb_bridge` の `sprint_speed_avg` / `arm_mph_avg` は複数年平均なので、過去年カードへそのまま使わない。`detail` 内の年別観測から `year <= targetSeason` だけを再平均する。

対象年以前に1件も実測が無ければ、未来を含む全期間平均へフォールバックせず `null` とする。

### NPB+

`configs/ratings.json` のNPB+直接計測は2026年計測である。したがって2025年以前のカードでは走力・パワー・捕手肩力の本人証拠として利用しない。

専用テスト:

```text
scripts/test_direct_measurement_temporal.mjs  12 checks passed
```

GitHub Actions:

```text
31143988170  success
```

## 2. 走力overrideの目盛り混在

監査前の実装では、

```text
統計 run.speed      = scale_calibration前の内部raw目盛り
直接計測 value      = scale_calibration後の最終目盛り
```

を直接平均していた。

さらに、能力欄では直接計測を混ぜた走力を表示する一方、盗塁・内野安打・守備残差では統計由来の `speed_z_final` を使っていた。

### 未来情報遮断前

2024年・100打席以上182人のうち、100人（54.9%）で直接計測overrideが発動していた。大半は2026年NPB+の未来情報だった。

同一目盛りで混合した場合との誤差は平均約3.61点で、周東佑京などでも数点規模の差があった。

### 未来情報遮断後

2024年で有効な直接計測は、査定年以前のMLB Statcastを持つ7人へ減った。

それでも旧混合では、同一目盛りで混ぜた値との差が

```text
平均絶対誤差  約2.42点
最大絶対誤差  約2.99点
```

残った。

## 3. 共通目盛り・共通zへの統合

`src/ratings/speed_evidence.mjs` を追加した。

処理順は次の通り。

```text
統計由来raw走力
  ↓ scale_calibration
統計の最終目盛り
  ＋ 有効な直接計測（すでに最終目盛り）
  ↓ 同じ目盛りで統合
最終表示走力
  ↓ scale_calibrationの逆変換
内部raw走力
  ↓ zscoreの逆変換
共通 speed_z_final
```

この共通zを、

- 表示走力の潜在値
- 盗塁得能の走力残差
- 内野安打得能の走力残差
- 守備力の走力残差

へ共通利用する。

2024年の有効な直接計測7人では、修正後の

```text
同一目盛り混合誤差 平均 0.019点
最大               0.047点
表示走力と共通zの最大不一致 0.002 z程度
```

まで縮小した。残りは丸め誤差である。

関連テスト:

```text
scripts/test_speed_evidence.mjs
scripts/test_speed_external_integration.mjs
scripts/test_speed_override_population.mjs
scripts/audit_speed_override_scale.mjs
```

GitHub Actions:

```text
31144577253  success
```

## 4. 打撃Priorの未来情報

走力以外にも、本人の一軍・二軍打撃Priorが `targetSeason ± 3` で作られていた。

現在は、

```text
一軍: targetSeason-3 ～ targetSeason
二軍: season-3 ～ season
```

だけを使う。

2024年・30打数以上254人を監査すると、227人で2025年の本人一軍成績が旧Prior候補に入っていた。

旧Priorとas-of Priorの差:

```text
Prior AVG 絶対差平均   約15厘
90%点                  約37厘
最大                   約59厘
Prior種別まで変化       38人
```

これはPriorの差であり最終ミートが同じだけ動くわけではないが、未来情報混入の範囲が広かったことを示す。

監査:

```text
scripts/audit_asof_evidence_impact.mjs
GitHub Actions 31145331879
```

## 5. 守備・送球の集約本人証拠

本人結果を複数年集約し、年別内訳を失った以下の派生値は、集約期間が2020-2026まで及ぶ。

- `catcher_fielding_rating.json`
- `catcher_throw_accuracy.json`
- `infield_throw_accuracy.json`

これらは2025年以前のカードでは本人証拠として利用しない。

`throw_accuracy_from_te.json` は各レコードに `seasons` が残るため、レコードの最終年が `targetSeason` 以下の場合だけ利用する。

2024年時点では、TE送球得能判定34レコードのうち30レコードが2024より後の本人結果を含んでいた。

共通規律は `src/ratings/evidence_time.mjs`、集約ソース末年は `configs/model_gates.json` に保存した。

テスト:

```text
scripts/test_asof_evidence.mjs  23 checks passed
```

GitHub Actions:

```text
31145239739  success
```

## 6. スカウティング68/88の意味を実装へ合わせる

`configs/scouting.json` の鈴木誠也について、走力68・肩力88は元から次のように記されていた。

- 高校時代の50m走・遠投などを根拠としたPrior
- 2021年そのものの直接計測ではない
- 過去GPTの手査定値で、教師ラベルにはしない
- 期待順序・常識チェックとして使う
- 統計由来の値を上書きして消さない

しかし旧実装は、これらを最終能力へ全置換し、さらに「スカウティング > 直接計測 > 統計」の順で処理していた。

これは仕様04 §1.2の

```text
第1階層 直接計測
第2階層 スカウティング
第3階層 成果指標
```

とも逆だった。

### 修正

スカウティング入力に `application` を追加した。

```text
evidence_only
  Prior候補・常識チェックとして証拠束に残す
  最終能力へ直接上書きしない

decision
  明示的な最終判断用入力
  ただし同時に直接計測があれば第1階層の直接計測を優先
```

現在の鈴木誠也68/88は `evidence_only` とした。

鈴木誠也2021では、台帳を読み込んでも最終走力・肩力は統計/有効な上位証拠の値を維持し、68/88は `ability_evidence.scouting_prior` に残る。

関連テスト:

```text
scripts/test_scouting_application.mjs
scripts/test_scouting_evidence_only_integration.mjs
scripts/test_speed_evidence.mjs
```

GitHub Actions:

```text
31145876475  success
```

全回帰:

```text
scripts/test_qa_remaining.mjs        176 PASS
scripts/test_fielding_regressions.mjs 25 PASS
scripts/test_ledger_regressions.mjs   22 PASS
scripts/test_cards.mjs                12 PASS
scripts/validate.mjs                  完走
```

## 7. 今後の規律

単年カードの本人証拠は、能力ごとに次の契約を持たせる。

```text
estimation_target
  season_performance または latent_trait_at_season_end

evidence_cutoff
  原則 targetSeason

evidence_window
  例: targetSeason-3 ～ targetSeason
```

後年データを使った「回顧的なベスト推定」を作りたい場合は、単年カードとは別モードとして明示し、通常カードへ黙って混ぜない。

## 残る課題

1. 生PBPから追加進塁を再構築し、走塁得能を再設計
2. `prime`の期間混在・環境補正二重適用・得能合成を再設計
3. 年度別の走塁・守備得点をピーク年度選定へ接続
4. `decision`スカウティングを使う場合の入力手順・根拠強度を正式化

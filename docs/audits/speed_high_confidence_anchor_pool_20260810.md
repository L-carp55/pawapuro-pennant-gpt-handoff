# 走力 high-confidence anchor pool — 2026-08-10

Status: `ANCHOR_POOL_FROZEN_FOR_ORDINAL_APPRAISAL`

## 目的

2026 NPB 100人のデータ不足・metric conflictを、PowerPro / MLB The Showへ合わせず相対比較するための独立物理アンカー群を固定する。

異なる測定種別を無理に同じ秒へ変換しない。アンカーは役割別に保持する。

## A. Absolute T90 anchors

Baseball Savant / Statcast Running Splits の90ft実測。

- カリステ 3.94 sec (2017)
- 秋山翔吾 3.97 (2021)
- ポランコ 3.99 (2021)
- サンタナ 4.13 (2020)
- 筒香嘉智 4.20 (2022)
- モンテロ 4.20 (2024)

用途: 90ftそのものの物理アンカー。古い測定は固定減衰せず、current evidenceと衝突すればrange化する。

## B. Standardized/electronic short-distance anchor bank

Canonical source:
- `data/manual/standardized_50m_electronic_reference.json`: 2022 + 2024, 57 records
- `data/manual/standardized_30m50m_photoelectric_2026.json`: 2026, 31 records

合計 88 standardized 50m observations。

同一セッションで電子/光電管測定された集団内順位として利用する。50m秒数を27.43m/90ftへ距離比例換算しない。

2026 NPB 100内の強い重複:
- 林琢真 5.99 (2022)
- 友杉篤輝 6.10 (2022)
- 奈良間大己 6.31 (2022)

2026 cohortでは鈴木湧陽5.78/30m3.85、岡田啓吾5.83/30m3.89のみ30mも公式確認。残り29人の30mを50m順位から推定しない。

用途: acceleration / ordinal anchor。T90 candidate priorは補助レンジに限る。

## C. Current NPB+ ordinal anchors

NPB+ Sprint SpeedはMLB Statcastとの数値定義同一性が未確認なのでT90へ単位換算しない。ただし2026同一データセット内のcurrent ordinal signalとして使用する。

代表アンカー:
- 周東佑京 35.0 km/h: 最上位 current-speed anchor
- 村林一輝 34.5: very-fast current signal; exposure十分
- 名原典彦 33.7: fast current signal; qualitative俊足記述とも方向一致
- 並木秀尊 33.8: elite current signal; exposure低めだが現在の俊足記述と方向一致
- 田中幹也 33.5 / 村松開人33.4 / 梶原昂希33.4: fast-side comparison anchors
- 友杉篤輝32.7: standardized50mと整合する中上位anchor
- 奈良間大己31.7: standardized50mと整合する中間anchor
- サンタナ30.8: direct T90とcurrent NPB+が整合する遅め側anchor
- 筒香嘉智30.2: direct T90とcurrent NPB+が整合する遅め側anchor

NPB+ exposureは点数補正に使わず、anchor confidenceの判定だけに使う。

## D. Temporal anchors

古い身体証拠を現在へ持ち越す判断の比較例。

- サンタナ: 2020 direct T90と2026 NPB+がほぼ整合 → old evidence carry-forwardが問題にならない整合例
- 筒香嘉智: 2022 direct T90と2026 NPB+がほぼ整合 → near/mid-age agreement例
- 塩見泰隆: 2018 short-distance俊足証拠 + 2024/2025重大左膝故障・手術 → old peak evidenceを現在へ強くcarryしない decline-supported例
- モンテロ: 2024 direct T90と2026 NPB+が大きく衝突 → metric-definition/current-state conflict例。rangeを保持
- 林琢真: standardized short distanceとcurrent NPB+が衝突しexposureも薄い → low-exposure conflict例

## アンカー適格性ルール

高信頼anchorは原則として:
1. physical evidenceの出所が明確
2. measurement protocolが直接または相対比較上十分明確
3. current evidenceと大矛盾がない、または矛盾理由を明示できる
4. exposure不足を能力補正へ混ぜない
5. PowerPro / The Showをteacherとして使っていない

を満たす。

## 非アンカー / conflict examples

- 矢野雅哉: historical5.9はprotocol不明、current exposure低め → comparison対象だがanchorにはしない
- 小園海斗: old profileとcurrent high-exposure NPB+が乖離 → anchorにはしない
- 細川成也: historical profileとcurrent NPB+ conflict → anchorにはしない
- カリステ/秋山/ポランコ: direct T90自体はabsolute anchorだが、2026 current-point anchorとしてはtemporal conflictのためrange用途

## 結論

アンカーpoolは「一本の回帰式」ではなく、absolute T90 / standardized acceleration / current ordinal / temporal caseの4層で保持する。これにより、データ不足選手をゲーム査定へfitせず、物理的に説明可能な相対比較で補完できる。

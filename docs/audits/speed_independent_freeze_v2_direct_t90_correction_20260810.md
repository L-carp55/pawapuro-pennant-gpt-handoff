# 2026 NPB 100人 走力独立査定 freeze v2 — direct T90 correction

Status: `INDEPENDENT_FREEZE_V2 / DIRECT_T90_INTERNAL_CONSISTENCY_CORRECTION`

## なぜv1を再openしたか

v1保存後の外部QA工程で、v1自身のルール「direct T90は最上位物理証拠」と、実際のdefault処理「strong-range 3人以外はNPB+ v3基礎点」の間に内部矛盾を発見した。

修正理由はPowerPro / MLB The Showとの不一致ではない。修正対象6人のStatcast direct T90はv1以前から独立物理台帳に存在していたため、ゲーム値を見たことによるfitを避けるため、ゲーム値を一切用いず direct T90 と current NPB+ baseline だけでfreeze v2を作る。

v1は監査履歴として削除しない。

## direct T90 6人

同じv3 evaluation尺度上で direct T90 を表示すると:

| player | direct T90 | year | direct-T90 eval | 2026 NPB+ eval | v2 independent freeze |
|---|---:|---:|---:|---:|---|
| カリステ | 3.94 | 2017 | 75.25 | 62.83 | 63–75 |
| 秋山翔吾 | 3.97 | 2021 | 72.60 | 65.53 | 66–73 |
| ポランコ | 3.99 | 2021 | 70.83 | 61.04 | 61–71 |
| サンタナ | 4.13 | 2020 | 58.46 | 58.35 | 58 |
| 筒香嘉智 | 4.20 | 2022 | 52.27 | 52.96 | 52–53 |
| モンテロ | 4.20 | 2024 | 52.27 | 68.22 | 52–68 |

## 解釈

- サンタナ・筒香はdirect T90とcurrent NPB+基礎線がほぼ一致し、独立査定は狭くできる。
- 秋山・ポランコ・カリステは古いdirect T90とcurrent NPB+が乖離する。固定年数減衰やゲーム値で一点化せずrangeを保持する。
- モンテロは2024 direct T90 4.20 secと2026 NPB+基礎線が大きく衝突する。測定が比較的新しく、direct T90の証拠Tierが高いため、v1の68一点は不適切。NPB+とMLB Statcastのmetric-definition bridge自体が未較正なので52–68をfreeze rangeとする。

このrange幅は統計的信頼区間ではない。2つの独立物理証拠が示す評価候補のenvelopeである。

## v1から継続するstrong ranges

- 林琢真: 69.1–77.4
- 友杉篤輝: 74–75
- 奈良間大己: 66–67

## ordinal review継続

- 並木秀尊: base 85
- 矢野雅哉: base 57
- 小園海斗: base 65
- 塩見泰隆: base 72
- 梶原昂希: base 82
- 名原典彦: base 84

加えて、PowerPro外部QAで大差が出た選手はゲーム値に合わせず、独立物理証拠不足の有無だけを調べる。v2の数値変更は上記direct T90 correction以外にはまだ行わない。

## 循環参照防止

- direct-T90 evalは既存のv3 evaluation scaleへT90そのものを入れただけで、PowerPro/The Showを使っていない。
- PowerPro/The Showとの比較結果からrange endpointを決めていない。
- external QAで大差があっても、それ自体を変更理由にしない。

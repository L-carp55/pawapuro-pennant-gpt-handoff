# パワプロ走力履歴と身体測定の時点整合（2026-08-09）

## 範囲

前回台帳のうち、測定年が確定している T90ft・30m・50m の16測定クラスタ（15選手）だけを収集対象にした。身体値からパワプロ走力を逆算せず、相関分析・現在査定の変更も行っていない。

年不明の50m等は34選手・35測定クラスタを確認したが、合理的な時点根拠を追加できないため、パワプロ年度を割り当てず JSON の unassigned_year_unknown_records にのみ保存した。

## 時点の扱い

- 2024年終了はパワプロ2024-2025 PS4 Ver.1.07（2024-11-26）。
- 2025年終了は同 Ver.1.14（2025-11-20）。pawapuro_full の work=2024 終端値はこのどちらにも使っていない。
- 2026開幕はパワプロ2026-2027の発売日（2026-06-11）時点のBASELESS defaultデータ。後発の v1.10 / v1.11 ではない。
- 数値はBASELESSの該当選手・版ページ、版番号と配信日はKONAMI公式ページで確認した。過去作品のローカル終端スナップショットは補助履歴であり、日付がDBに残っていないため直近査定の決定には使っていない。

## QA

- 測定年が判明: 16測定クラスタ / 15選手（厳密な測定日あり 3件）
- 当時に最も近いパワプロ走力を取得: 16件
- 当時から2025終了の変化を算出: 16件
- 年不明のまま未割当: 34選手 / 35測定クラスタ
- 査定時点が測定からプラスマイナス1年以内: 13件、プラスマイナス2年以内: 14件
- 最大上昇（直近から2025終了）: 塩見 泰隆 +14
- 最大低下（直近から2025終了）: 筒香 嘉智 -7
- 据え置き（直近から2025終了）: モンテロ (49)、佐藤 輝明 (68)、小幡 竜平 (77)、サンタナ (47)、奈良間 大己 (64)

## 一覧

| 選手 | 身体測定 | 測定年 | 直近パワプロ | 当時走力 | 2025終了 | 変化 | 時点差 | 出典 |
| -- | -- | --: | -- | --: | --: | --: | --: | -- |
| 筒香 嘉智 | T90ft 4.20秒 | 2022 | パワフルプロ野球2024-2025 1.01 (2024-07-18) | 52 | 45 | -7 | 2年 | [身体](https://baseballsavant.mlb.com/running_splits?bats=&min=5&position=&team=&type=raw&year=2022) / [値](https://www.baseless.org/data/source/2024/dat_BA_1_01.html) / [版日](https://www.konami.com/pawa/2024-2025/update/240718) |
| 林 琢真 | 50m 5.99秒 | 2022 | eBASEBALLパワフルプロ野球2022 1.09 (2023-03-30) | 87 | 82 | -5 | 284日 | [身体](https://www.youtube.com/watch?v=fC8_8iA7Cao) / [値](https://www.baseless.org/data/source/2022/dat_BA_1_09.html) / [版日](https://www.konami.com/pawa/2022/update/230330) |
| モンテロ | T90ft 4.20秒 | 2024 | パワフルプロ野球2024-2025 1.08 (2025-03-27) | 49 | 49 | +0 | 1年 | [身体](https://baseballsavant.mlb.com/running_splits?bats=&min=5&position=&team=&type=raw&year=2024) / [値](https://www.baseless.org/data/source/2024/dat_C_1_08.html) / [版日](https://www.konami.com/pawa/2024-2025/update/250327) |
| 秋山 翔吾 | T90ft 3.97秒 | 2021 | eBASEBALLパワフルプロ野球2022 1.07 (2022-09-29) | 72 | 77 | +5 | 1年 | [身体](https://baseballsavant.mlb.com/running_splits?bats=&min=5&position=&team=&type=raw&year=2021) / [値](https://www.baseless.org/data/source/2022/dat_C_1_07.html) / [版日](https://www.konami.com/pawa/2022/update/220929) |
| 佐藤 輝明 | 30m 4秒 | 2020 | eBASEBALLパワフルプロ野球2020 1.09 (2021-04-08) | 68 | 68 | +0 | 1年 | [身体](https://origin.daily.co.jp/tigers/2020/12/07/0013919463.shtml) / [値](https://www.baseless.org/data/source/2020/dat_T_1_09.html) / [版日](https://www.konami.com/pawa/2020/update/210408) |
| 小幡 竜平 | 30m 3.98秒 | 2018 | 実況パワフルプロ野球2018 1.10 (2019-04-23) | 77 | 77 | +0 | 1年 | [身体](https://hochi.news/articles/20181202-OHT1T50237.html) / [値](https://www.baseless.org/data/source/2018/dat_T_1_10.html) / [版日](https://www.konami.com/pawa/2018/update/190418) |
| ポランコ | T90ft 3.99秒 | 2021 | eBASEBALLパワフルプロ野球2022 default initial player data (2022-04-21) | 67 | 63 | -4 | 1年 | [身体](https://baseballsavant.mlb.com/running_splits?bats=&min=5&position=&team=&type=raw&year=2021) / [値](https://www.baseless.org/data/source/2022/dat_M.html) / [版日](https://www.konami.com/pawa/2022/) |
| 友杉 篤輝 | 50m 6.10秒 | 2022 | eBASEBALLパワフルプロ野球2022 1.09 (2023-03-30) | 81 | 87 | +6 | 284日 | [身体](https://www.youtube.com/watch?v=fC8_8iA7Cao) / [値](https://www.baseless.org/data/source/2022/dat_M_1_09.html) / [版日](https://www.konami.com/pawa/2022/update/230330) |
| カリステ | T90ft 3.94秒 | 2017 | eBASEBALLパワフルプロ野球2022 1.09 (2023-03-30) | 87 | 82 | -5 | 6年 | [身体](https://baseballsavant.mlb.com/running_splits?bats=&min=5&position=&team=&type=raw&year=2017) / [値](https://www.baseless.org/data/source/2022/dat_D_1_09.html) / [版日](https://www.konami.com/pawa/2022/update/230330) |
| 岡林 勇希 | 50m 5.80秒 | 2019 | eBASEBALLパワフルプロ野球2020 default initial player data (2020-07-09) | 78 | 81 | +3 | 1年 | [身体](https://www.nikkansports.com/baseball/news/201910290000658.html) / [値](https://www.baseless.org/data/source/2020/dat_D.html) / [版日](https://www.konami.com/pawa/2020/) |
| サンタナ | T90ft 4.13秒 | 2020 | eBASEBALLパワフルプロ野球2020 1.09 (2021-04-08) | 47 | 47 | +0 | 1年 | [身体](https://baseballsavant.mlb.com/running_splits?bats=&min=5&position=&team=&type=raw&year=2020) / [値](https://www.baseless.org/data/source/2020/dat_S_1_09.html) / [版日](https://www.konami.com/pawa/2020/update/210408) |
| 塩見 泰隆 | 30m 3.85秒 | 2018 | 実況パワフルプロ野球2018 default initial player data (2018-04-26) | 69 | 83 | +14 | 0年 | [身体](https://www.daily.co.jp/baseball/2018/01/17/0010903502.shtml) / [値](https://www.baseless.org/data/source/2018/dat_S.html) / [版日](https://www.konami.com/pawa/2018/update/180412) |
| 並木 秀尊 | 50m 5.32秒 | 2019 | eBASEBALLパワフルプロ野球2022 default initial player data (2022-04-21) | 95 | 97 | +2 | 3年 | [身体](https://www.nikkansports.com/baseball/news/202306230001335.html) / [値](https://www.baseless.org/data/source/2022/dat_S.html) / [版日](https://www.konami.com/pawa/2022/) |
| 並木 秀尊 | 50m 6.06秒 | 2022 | eBASEBALLパワフルプロ野球2022 default initial player data (2022-04-21) | 95 | 97 | +2 | 0年 | [身体](https://www.nikkansports.com/baseball/news/202306230001335.html) / [値](https://www.baseless.org/data/source/2022/dat_S.html) / [版日](https://www.konami.com/pawa/2022/) |
| 村林 一輝 | 50m 6.20秒 | 2015 | 実況パワフルプロ野球2016 default initial player data (2016-04-28) | 60 | 69 | +9 | 1年 | [身体](https://column.sp.baseball.findfriends.jp/?id=055-20151207-01&pid=column_detail) / [値](https://www.baseless.org/data/source/2016/dat_E.html) / [版日](https://www.konami.com/pawa/2016/) |
| 奈良間 大己 | 50m 6.31秒 | 2022 | eBASEBALLパワフルプロ野球2022 1.09 (2023-03-30) | 64 | 64 | +0 | 284日 | [身体](https://www.youtube.com/watch?v=fC8_8iA7Cao) / [値](https://www.baseless.org/data/source/2022/dat_F_1_09.html) / [版日](https://www.konami.com/pawa/2022/update/230330) |

## データ上の限界

- 測定日不明の行は日数差を作らず、年差のみを保存した。
- 測定時点に選手がパワプロに存在しない場合は、その選手が初めて収録された実在の版を直近値にした。作品年だけを機械的に当てはめていない。
- data/pennant.db を参照した。指定名の 07_pennant.db はワークツリー内に存在しなかった。
- 本ファイルは時系列の収集結果であり、走力の妥当性や身体能力との対応の結論は含めない。

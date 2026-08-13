# 2026 NPB 走力 — Owner Review Master Table（100人）

生成日: 2026-08-13

## 列の意味

| 列 | 意味 |
|---|---|
| project査定 | **GPT/Codex freeze**。オーナーが「あなたの査定」と呼んでいるもの |
| 既存モデル(control) | Claude側の既存production model。**比較用の参考**で、project査定には混ぜていない |
| PowerPro現在 / 推移 | 2026年の値と、値が動いた年だけを並べた履歴 |
| 差 | project査定 − PowerPro |
| 差の理由 | 証拠が支持した時だけ書く。支持が無ければ `NO_CLEAR_CAUSE` |

**レビュー対象: 64人 / 100人**（差5以上 or confidence LOW or 証拠衝突 or 据え置き疑い。
LOW_MEDIUMだけでは対象にしていない）

---

| 選手 | project査定 | 幅 | conf | 既存モデル | PowerPro | 差 | PowerPro推移 | 据え置き | 差の理由 | レビュー |
|---|---|---|---|---|---|---|---|---|---|---|
| 古賀 優大 | 70 | 63–77 | LOW_MEDIUM | 40.3 | 46 | +24 | 2017:46 | YES | POWERPRO_STALE_LOW_SUSPECTED | 要 |
| 村林 一輝 | 92 | 85–99 | LOW_MEDIUM | 64.7 | 69 | +23 | 2016:60 → 2023:69 | - | NO_CLEAR_CAUSE | 要 |
| 野間 峻祥 | 66 | 59–73 | LOW_MEDIUM | 80.3 | 88 | -22 | 2016:85 → 2019:91 → 2024:88 | - | LOW_EXPOSURE_NPBPLUS_RISK|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 矢野 雅哉 | 57 | 50–64 | LOW_MEDIUM | 85.4 | 78 | -21 | 2021:71 → 2024:78 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 浅村 栄斗 | 56 | 49–63 | LOW_MEDIUM | 49.9 | 35 | +21 | 2013:66 → 2020:58 → 2021:53 → 2023:55 → 2024:42 → 2025:35 | - | NO_CLEAR_CAUSE | 要 |
| 宮﨑 敏郎 | 54 | 47–61 | LOW_MEDIUM | 53.4 | 33 | +21 | 2013:55 → 2017:40 → 2018:43 → 2023:36 → 2024:33 | - | NO_CLEAR_CAUSE | 要 |
| 大城 卓三 | 44 | 37–51 | LOW_MEDIUM | 46.5 | 24 | +20 | 2018:43 → 2021:31 → 2024:24 | - | NO_CLEAR_CAUSE | 要 |
| カリステ | 63 | 56–70 | LOW_MEDIUM | 66.2 | 82 | -19 | 履歴なし | - | LOW_EXPOSURE_NPBPLUS_RISK|TEMPORAL_CHANGE_NOT_CAPTURED|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 京田 陽太 | 61 | 54–68 | LOW_MEDIUM | 66.4 | 78 | -17 | 2017:85 → 2018:89 → 2022:85 → 2023:78 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 石川 昂弥 | 57 | 50–64 | LOW_MEDIUM | 53.5 | 41 | +16 | 2020:55 → 2023:41 | - | NO_CLEAR_CAUSE | 要 |
| 山口 航輝 | 68 | 61–75 | LOW_MEDIUM | 52 | 52 | +16 | 2019:52 | YES | POWERPRO_STALE_LOW_SUSPECTED | 要 |
| 細川 成也 | 75 | 68–82 | LOW_MEDIUM | 56.2 | 60 | +15 | 2017:60 | YES | POWERPRO_STALE_LOW_SUSPECTED | 要 |
| 福永 裕基 | 78 | 71–85 | LOW_MEDIUM | 82.5 | 64 | +14 | 2023:64 | - | NO_CLEAR_CAUSE | 要 |
| 郡司 裕也 | 75 | 68–82 | LOW_MEDIUM | 60.5 | 61 | +14 | 2020:61 | YES | POWERPRO_STALE_LOW_SUSPECTED | 要 |
| 野村 佑希 | 66 | 59–73 | LOW_MEDIUM | 57.3 | 52 | +14 | 2019:45 → 2020:50 → 2022:52 | YES | POWERPRO_STALE_LOW_SUSPECTED | 要 |
| 小園 海斗 | 65 | 58–72 | LOW_MEDIUM | 78.3 | 79 | -14 | 2019:86 → 2023:85 → 2025:79 | - | NO_CLEAR_CAUSE | 要 |
| 丸山 和郁 | 73 | 66–80 | LOW_MEDIUM | 77.1 | 86 | -13 | 2022:86 | YES | LOW_EXPOSURE_NPBPLUS_RISK|POWERPRO_STALE_HIGH_SUSPECTED|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 岩田 幸宏 | 83 | 76–90 | LOW_MEDIUM | 100 | 96 | -13 | 2024:91 → 2025:96 | - | NO_CLEAR_CAUSE | 要 |
| 林 琢真 | 69 | 59–79 | LOW | 68.6 | 82 | -13 | 2023:87 → 2025:82 | - | METRIC_CONSTRUCT_CONFLICT|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 正木 智也 | 61 | 54–68 | LOW_MEDIUM | 60.5 | 48 | +13 | 2022:48 | YES | POWERPRO_STALE_LOW_SUSPECTED | 要 |
| 来田 涼斗 | 73 | 66–80 | LOW_MEDIUM | 70.5 | 85 | -12 | 2021:83 → 2024:85 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| ソト | 52 | 45–59 | LOW_MEDIUM | 42.7 | 40 | +12 | 履歴なし | - | NO_CLEAR_CAUSE | 要 |
| 友杉 篤輝 | 75 | 65–85 | LOW | 75.9 | 87 | -12 | 2023:87 | - | METRIC_CONSTRUCT_CONFLICT|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 並木 秀尊 | 85 | 80–90 | MEDIUM | 100 | 97 | -12 | 2021:95 → 2025:97 | - | LOW_EXPOSURE_NPBPLUS_RISK|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 太田 光 | 56 | 49–63 | LOW_MEDIUM | 61.5 | 44 | +12 | 2019:52 → 2020:57 → 2024:44 | - | NO_CLEAR_CAUSE | 要 |
| 西川 龍馬 | 61 | 54–68 | LOW_MEDIUM | 62.1 | 72 | -11 | 2016:69 → 2017:72 | YES | POWERPRO_STALE_HIGH_SUSPECTED | 要 |
| 水野 達稀 | 82 | 75–89 | LOW_MEDIUM | 86.5 | 71 | +11 | 2022:68 → 2024:71 | - | NO_CLEAR_CAUSE | 要 |
| 坂倉 将吾 | 57 | 50–64 | LOW_MEDIUM | 62.4 | 68 | -11 | 2017:71 → 2024:68 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 秋山 翔吾 | 66 | 59–73 | LOW_MEDIUM | 74.1 | 77 | -11 | 2013:72 → 2024:77 → 2026:69 | - | TEMPORAL_CHANGE_NOT_CAPTURED|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| サンタナ | 58 | 51–65 | LOW_MEDIUM | 51.6 | 47 | +11 | 履歴なし | - | TEMPORAL_CHANGE_NOT_CAPTURED | 要 |
| 塩見 泰隆 | 72 | 67–77 | MEDIUM | - | 83 | -11 | 2018:82 → 2021:83 | YES | LOW_EXPOSURE_NPBPLUS_RISK|POWERPRO_STALE_HIGH_SUSPECTED|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 蝦名 達夫 | 64 | 57–71 | LOW_MEDIUM | 71.2 | 75 | -11 | 2020:70 → 2025:75 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 今宮 健太 | 55 | 48–62 | LOW_MEDIUM | 59.7 | 66 | -11 | 2013:66 → 2017:70 → 2018:68 → 2019:66 | YES | POWERPRO_STALE_HIGH_SUSPECTED | 要 |
| 西野 真弘 | 66 | 59–73 | LOW_MEDIUM | 68.5 | 76 | -10 | 2016:71 → 2017:76 | YES | LOW_EXPOSURE_NPBPLUS_RISK|POWERPRO_STALE_HIGH_SUSPECTED|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 清宮 幸太郎 | 66 | 59–73 | LOW_MEDIUM | 60.8 | 56 | +10 | 2018:45 → 2022:56 | YES | POWERPRO_STALE_LOW_SUSPECTED | 要 |
| 古賀 悠斗 | 57 | 50–64 | LOW_MEDIUM | 53.6 | 47 | +10 | 2022:35 → 2023:47 | - | NO_CLEAR_CAUSE | 要 |
| 若月 健矢 | 57 | 50–64 | LOW_MEDIUM | 61.3 | 48 | +9 | 2014:63 → 2016:57 → 2017:53 → 2018:45 → 2024:48 | - | NO_CLEAR_CAUSE | 要 |
| 佐野 恵太 | 57 | 50–64 | LOW_MEDIUM | 50.2 | 48 | +9 | 2017:53 → 2023:48 | - | NO_CLEAR_CAUSE | 要 |
| 岸田 行倫 | 46 | 39–53 | LOW_MEDIUM | 56.7 | 55 | -9 | 2018:55 | YES | POWERPRO_STALE_HIGH_SUSPECTED | 要 |
| 宗 佑磨 | 68 | 61–75 | LOW_MEDIUM | 61.4 | 76 | -8 | 履歴なし | - | NO_CLEAR_CAUSE | 要 |
| 大島 洋平 | 66 | 59–73 | LOW_MEDIUM | 76.8 | 74 | -8 | 2013:87 → 2020:83 → 2022:80 → 2023:77 → 2024:74 | - | LOW_EXPOSURE_NPBPLUS_RISK | 要 |
| 佐藤 都志也 | 63 | 56–70 | LOW_MEDIUM | 61.6 | 71 | -8 | 2020:71 | YES | POWERPRO_STALE_HIGH_SUSPECTED|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 長岡 秀樹 | 66 | 59–73 | LOW_MEDIUM | 59.6 | 58 | +8 | 2020:66 → 2022:58 | YES | POWERPRO_STALE_LOW_SUSPECTED | 要 |
| 梶原 昂希 | 82 | 75–89 | LOW_MEDIUM | 84.7 | 90 | -8 | 2022:83 → 2024:90 | - | LOW_EXPOSURE_NPBPLUS_RISK|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 筒香 嘉智 | 53 | 45–61 | LOW_MEDIUM | 46.8 | 45 | +8 | 2013:52 → 2016:58 → 2024:52 → 2025:45 | - | METRIC_CONSTRUCT_CONFLICT|TEMPORAL_CHANGE_NOT_CAPTURED|CURRENT_PHYSICAL_SUPPORTS_PROJECT | 要 |
| 木浪 聖也 | 51 | 44–58 | LOW_MEDIUM | 59.1 | 59 | -8 | 2019:64 → 2023:59 | - | NO_CLEAR_CAUSE | 要 |
| 岡林 勇希 | 74 | 67–81 | LOW_MEDIUM | 86.8 | 81 | -7 | 2020:78 → 2022:81 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 木下 拓哉 | 46 | 41–51 | MEDIUM | 52.2 | 39 | +7 | 2016:45 → 2021:39 | YES | LOW_EXPOSURE_NPBPLUS_RISK|POWERPRO_STALE_LOW_SUSPECTED|SNS_SUPPORTS_PROJECT_DIRECTION | 要 |
| 岡 大海 | 75 | 70–80 | MEDIUM | 75.3 | 82 | -7 | 2018:85 → 2023:82 | - | LOW_EXPOSURE_NPBPLUS_RISK|HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 藤原 恭大 | 78 | 71–85 | LOW_MEDIUM | 84.2 | 85 | -7 | 2019:85 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 藤岡 裕大 | 58 | 48–68 | LOW | 53.9 | 65 | -7 | 2018:67 → 2024:65 | - | LOW_EXPOSURE_NPBPLUS_RISK | 要 |
| 髙部 瑛斗 | 83 | 76–90 | LOW_MEDIUM | 93.7 | 90 | -7 | 2020:80 → 2022:90 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 滝澤 夏央 | 78 | 71–85 | LOW_MEDIUM | 87.5 | 85 | -7 | 2022:81 → 2025:85 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 鈴木 大地 | 42 | 37–47 | MEDIUM | 63.2 | 49 | -7 | 2013:65 → 2016:57 → 2018:55 → 2025:49 | - | LOW_EXPOSURE_NPBPLUS_RISK | 要 |
| 吉川 尚輝 | 74 | 67–81 | LOW_MEDIUM | 74.6 | 80 | -6 | 2017:80 | - | HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO | 要 |
| 田宮 裕涼 | 73 | 66–80 | LOW_MEDIUM | 66.3 | 68 | +5 | 2019:61 → 2024:68 | - | NO_CLEAR_CAUSE | 要 |
| 菊池 涼介 | 67 | 60–74 | LOW_MEDIUM | 68.6 | 72 | -5 | 2013:82 → 2017:72 | - | NO_CLEAR_CAUSE | 要 |
| 松本 剛 | 64 | 57–71 | LOW_MEDIUM | 65.3 | 69 | -5 | 2013:58 → 2014:65 → 2022:69 | - | NO_CLEAR_CAUSE | 要 |
| 土田 龍空 | 62 | 52–72 | LOW | 83.7 | 66 | -4 | 2021:62 → 2022:64 → 2025:66 | - | LOW_EXPOSURE_NPBPLUS_RISK|SNS_SUPPORTS_POWERPRO_DIRECTION | 要 |
| 小川 龍成 | 82 | 75–89 | LOW_MEDIUM | 75.2 | 86 | -4 | 2021:73 → 2024:86 | - | - | - |
| 外崎 修汰 | 72 | 65–79 | LOW_MEDIUM | 61.4 | 68 | +4 | 2016:70 → 2020:74 → 2024:70 → 2025:68 | - | LOW_EXPOSURE_NPBPLUS_RISK | - |
| 石井 一成 | 75 | 68–82 | LOW_MEDIUM | 73.4 | 79 | -4 | 2017:68 → 2022:79 | - | - | - |
| 渡邊 佳明 | 54 | 47–61 | LOW_MEDIUM | 65.2 | 50 | +4 | 2019:50 | - | - | - |
| 栗原 陵矢 | 63 | 56–70 | LOW_MEDIUM | 59.8 | 59 | +4 | 2016:56 → 2020:61 → 2021:65 → 2022:54 → 2023:55 → 2024:63 → 2025:59 | - | - | - |
| 森下 翔太 | 56 | 49–63 | LOW_MEDIUM | 62.7 | 60 | -4 | 2023:60 | - | - | - |
| 森 友哉 | 62 | 55–69 | LOW_MEDIUM | 60.7 | 65 | -3 | 2023:65 | - | - | - |
| 板山 祐太郎 | 69 | 62–76 | LOW_MEDIUM | 75.3 | 72 | -3 | 2016:72 | - | - | - |
| 源田 壮亮 | 77 | 70–84 | LOW_MEDIUM | 89.9 | 80 | -3 | 2017:86 → 2024:80 | - | - | - |
| ファビアン | 64 | 57–71 | LOW_MEDIUM | 51.5 | 61 | +3 | 履歴なし | - | - | - |
| モンテロ | 52 | 46–58 | MEDIUM | 46.5 | 49 | +3 | 履歴なし | - | METRIC_CONSTRUCT_CONFLICT | 要 |
| 柳田 悠岐 | 70 | 63–77 | LOW_MEDIUM | 61.8 | 67 | +3 | 2013:72 → 2014:81 → 2019:79 → 2022:74 → 2023:72 → 2024:70 → 2025:67 | - | - | - |
| 伏見 寅威 | 43 | 36–50 | LOW_MEDIUM | 47.1 | 40 | +3 | 2013:44 → 2019:40 | - | LOW_EXPOSURE_NPBPLUS_RISK | - |
| 坂本 誠志郎 | 53 | 46–60 | LOW_MEDIUM | 58.9 | 56 | -3 | 2016:53 → 2017:56 | - | - | - |
| 太田 椋 | 66 | 59–73 | LOW_MEDIUM | 59.3 | 64 | +2 | 2019:61 → 2024:64 | - | - | - |
| 村松 開人 | 82 | 75–89 | LOW_MEDIUM | 75.6 | 80 | +2 | 2023:78 → 2025:80 | - | - | - |
| 奈良間 大己 | 66 | 59–73 | LOW_MEDIUM | 69.4 | 64 | +2 | 2023:64 | - | - | - |
| ポランコ | 61 | 54–68 | LOW_MEDIUM | 59.1 | 63 | -2 | 履歴なし | - | TEMPORAL_CHANGE_NOT_CAPTURED | - |
| 安田 尚憲 | 48 | 41–55 | LOW_MEDIUM | 47.1 | 46 | +2 | 2018:46 | - | - | - |
| 柳町 達 | 65 | 58–72 | LOW_MEDIUM | 66.2 | 67 | -2 | 2020:67 → 2023:70 → 2024:67 | - | - | - |
| 海野 隆司 | 54 | 47–61 | LOW_MEDIUM | 60.8 | 52 | +2 | 2020:52 | - | - | - |
| 近藤 健介 | 62 | 55–69 | LOW_MEDIUM | 57.1 | 64 | -2 | 2013:40 → 2014:50 → 2017:51 → 2022:64 | - | - | - |
| 佐々木 俊輔 | 78 | 71–85 | LOW_MEDIUM | 79.6 | 76 | +2 | 2024:76 | - | - | - |
| 中野 拓夢 | 77 | 70–84 | LOW_MEDIUM | 83.4 | 75 | +2 | 2021:75 | - | - | - |
| 佐藤 輝明 | 70 | 63–77 | LOW_MEDIUM | 67.4 | 68 | +2 | 2021:68 | - | - | - |
| 大山 悠輔 | 56 | 49–63 | LOW_MEDIUM | 52.7 | 58 | -2 | 2017:58 | - | - | - |
| 中川 圭太 | 75 | 68–82 | LOW_MEDIUM | 72.1 | 74 | +1 | 2019:65 → 2022:70 → 2024:74 | - | - | - |
| 紅林 弘太郎 | 57 | 50–64 | LOW_MEDIUM | 54.5 | 56 | +1 | 2020:63 → 2022:56 | - | - | - |
| 高橋 周平 | 47 | 40–54 | LOW_MEDIUM | 51.9 | 46 | +1 | 2013:50 → 2018:54 → 2019:46 | - | - | - |
| 中村 悠平 | 55 | 48–62 | LOW_MEDIUM | 52.4 | 56 | -1 | 2013:65 → 2017:61 → 2018:56 | YES | LOW_EXPOSURE_NPBPLUS_RISK|POWERPRO_STALE_HIGH_SUSPECTED | 要 |
| 山本 祐大 | 60 | 53–67 | LOW_MEDIUM | 61.8 | 61 | -1 | 2018:50 → 2023:61 | - | - | - |
| 度会 隆輝 | 66 | 59–73 | LOW_MEDIUM | 68.1 | 65 | +1 | 2024:65 | - | - | - |
| 牧 秀悟 | 66 | 59–73 | LOW_MEDIUM | 60.4 | 67 | -1 | 履歴なし | - | - | - |
| 山川 穂高 | 46 | 39–53 | LOW_MEDIUM | 42.1 | 47 | -1 | 2014:41 → 2022:51 → 2024:47 | - | - | - |
| 牧原 大成 | 83 | 76–90 | LOW_MEDIUM | 84 | 82 | +1 | 2013:82 | - | - | - |
| 丸 佳浩 | 64 | 54–74 | LOW | 58.2 | 65 | -1 | 履歴なし | - | - | 要 |
| 小幡 竜平 | 76 | 69–83 | LOW_MEDIUM | 70.5 | 77 | -1 | 2019:77 | - | LOW_EXPOSURE_NPBPLUS_RISK | - |
| 田中 幹也 | 83 | 76–90 | LOW_MEDIUM | 79.9 | 83 | 0 | 2023:83 | - | - | - |
| 名原 典彦 | 84 | 74–94 | LOW | - | - | - | 履歴なし | - | - | 要 |
| 周東 佑京 | 96 | 89–100 | LOW_MEDIUM | 94.8 | 96 | 0 | 2019:94 → 2021:96 | - | - | - |
| 梅野 隆太郎 | 57 | 47–67 | LOW | 54.5 | 57 | 0 | 2014:61 → 2025:57 | - | LOW_EXPOSURE_NPBPLUS_RISK | 要 |
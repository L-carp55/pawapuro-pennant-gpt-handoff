# 走力 オーナーレビュー待ち行列（案）

生成日: 2026-08-13

状態: **AI側の工程は完了。スケール問題は主因でないことを実測で確認済み**

（目盛りをPowerProへ完全に揃えても |差|>=5 は 51人→56人 と減らない。
　つまり残りは選手個別の食い違い。詳細=outputs/speed_absolute_scale_investigation.md）

★走力の絶対目盛り（0〜100）は**まだ正本化されていない**（PowerPro由来の暫定）。
そのため「何点が正しいか」ではなく**「どちらが自然か」**でお答えください。

抽出条件（いずれか該当）:

- 修正後もPowerProとの差が5以上
- confidence LOW
- 強い材料衝突（系統ずれを除いて15点以上）
- PowerPro据え置きの疑いが裏付けられた（POWERPRO_STALE_SUPPORTED）
- AI側で原因を解決できなかった（UNRESOLVED_PROJECT_CONFLICT）

**現時点の該当: 63人**（スケール修正後に再抽出する）

## 回答のしかた

点数を決めていただく必要はありません。次から選ぶだけで構いません。

- `PowerProの方が自然`
- `自作査定の方が自然`
- `その中間`
- `どちらも違和感`
- `判断できない`

必要に応じて任意の点数・コメントを添えていただけると助かります。

### 優先順位（上から見ていただければ十分です）

- **A群**: 差が大きい かつ こちらの信頼度も低い（最も情報が足りない）
- **B群**: 差が大きい（信頼度は中〜高）
- **C群**: 差は小さいが、信頼度が低い／PowerPro据え置きの裏付けあり

#### A群（16人）

| 選手 | 自作 | PowerPro | raw_diff | 信頼度 | 原因 | stale | あなたの判断 | 任意の点数・コメント |
|---|---|---|---|---|---|---|---|---|
| 土田 龍空 | 83.7 | 66.0 | +17.7 | 低 | PROJECT_EVIDENCE_CONFLICT+CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| カリステ | 66.2 | 82.0 | -15.8 | 低 | CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| 鈴木 大地 | 63.2 | 49.0 | +14.2 | 低 | PROJECT_EVIDENCE_CONFLICT+CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| 木下 拓哉 | 52.2 | 39.0 | +13.2 | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_SUPPORTED | | |
| 正木 智也 | 60.5 | 48.0 | +12.5 | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_SUPPORTED | | |
| 藤岡 裕大 | 53.9 | 65.0 | -11.1 | 低 | CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| ファビアン | 51.5 | 61.0 | -9.5 | 低 | PROJECT_EVIDENCE_CONFLICT+CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| 丸山 和郁 | 77.1 | 86.0 | -8.9 | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_POSSIBLE | | |
| 野間 峻祥 | 80.3 | 88.0 | -7.7 | 低 | PROJECT_EVIDENCE_CONFLICT+CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| 西野 真弘 | 68.5 | 76.0 | -7.5 | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_POSSIBLE | | |
| 伏見 寅威 | 47.1 | 40.0 | +7.1 | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_POSSIBLE | | |
| 岡 大海 | 75.3 | 82.0 | -6.7 | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_POSSIBLE | | |
| 外崎 修汰 | 61.4 | 68.0 | -6.6 | 低 | CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| 小幡 竜平 | 70.5 | 77.0 | -6.5 | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_POSSIBLE | | |
| 古賀 優大 | 40.3 | 46.0 | -5.7 | 低 | PROJECT_EVIDENCE_CONFLICT+POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_SUPPORTED | | |
| 梶原 昂希 | 84.7 | 90.0 | -5.3 | 低 | CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |

#### B群（35人）

| 選手 | 自作 | PowerPro | raw_diff | 信頼度 | 原因 | stale | あなたの判断 | 任意の点数・コメント |
|---|---|---|---|---|---|---|---|---|
| 大城 卓三 | 46.5 | 24.0 | +22.5 | 中 | - | NO_STALE_EVIDENCE | | |
| 宮﨑 敏郎 | 53.4 | 33.0 | +20.4 | 中 | - | NO_STALE_EVIDENCE | | |
| 福永 裕基 | 82.5 | 64.0 | +18.5 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED | | |
| 太田 光 | 61.5 | 44.0 | +17.5 | 中 | - | NO_STALE_EVIDENCE | | |
| 水野 達稀 | 86.5 | 71.0 | +15.5 | 中 | - | NO_STALE_EVIDENCE | | |
| 渡邊 佳明 | 65.2 | 50.0 | +15.2 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED | | |
| 浅村 栄斗 | 49.9 | 35.0 | +14.9 | 高 | - | NO_STALE_EVIDENCE | | |
| 宗 佑磨 | 61.4 | 76.0 | -14.6 | 高 | - | NO_STALE_EVIDENCE | | |
| 来田 涼斗 | 70.5 | 85.0 | -14.5 | 中 | - | NO_STALE_EVIDENCE | | |
| 林 琢真 | 68.6 | 82.0 | -13.4 | 中 | - | NO_STALE_EVIDENCE | | |
| 若月 健矢 | 61.3 | 48.0 | +13.3 | 高 | - | NO_STALE_EVIDENCE | | |
| 石川 昂弥 | 53.5 | 41.0 | +12.5 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED | | |
| 京田 陽太 | 66.4 | 78.0 | -11.6 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED | | |
| 友杉 篤輝 | 75.9 | 87.0 | -11.1 | 高 | - | NO_STALE_EVIDENCE | | |
| 小川 龍成 | 75.2 | 86.0 | -10.8 | 中 | - | NO_STALE_EVIDENCE | | |
| 源田 壮亮 | 89.9 | 80.0 | +9.9 | 高 | PROJECT_EVIDENCE_CONFLICT | NO_STALE_EVIDENCE | | |
| 西川 龍馬 | 62.1 | 72.0 | -9.9 | 高 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED | | |
| 佐藤 都志也 | 61.6 | 71.0 | -9.4 | 高 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED | | |
| 海野 隆司 | 60.8 | 52.0 | +8.8 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 中野 拓夢 | 83.4 | 75.0 | +8.4 | 高 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED | | |
| 矢野 雅哉 | 85.4 | 78.0 | +7.4 | 中 | PROJECT_EVIDENCE_CONFLICT | NO_STALE_EVIDENCE | | |
| 近藤 健介 | 57.1 | 64.0 | -6.9 | 高 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 丸 佳浩 | 58.2 | 65.0 | -6.8 | 中 | - | NO_STALE_EVIDENCE | | |
| 牧 秀悟 | 60.4 | 67.0 | -6.6 | 中 | - | NO_STALE_EVIDENCE | | |
| 古賀 悠斗 | 53.6 | 47.0 | +6.6 | 中 | - | NO_STALE_EVIDENCE | | |
| 今宮 健太 | 59.7 | 66.0 | -6.3 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 高橋 周平 | 51.9 | 46.0 | +5.9 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 岡林 勇希 | 86.8 | 81.0 | +5.8 | 中 | PROJECT_EVIDENCE_CONFLICT+POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 坂倉 将吾 | 62.4 | 68.0 | -5.6 | 高 | - | NO_STALE_EVIDENCE | | |
| 石井 一成 | 73.4 | 79.0 | -5.6 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 奈良間 大己 | 69.4 | 64.0 | +5.4 | 高 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_SUPPORTED | | |
| 吉川 尚輝 | 74.6 | 80.0 | -5.4 | 中 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 大山 悠輔 | 52.7 | 58.0 | -5.3 | 高 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 野村 佑希 | 57.3 | 52.0 | +5.3 | 高 | POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 柳田 悠岐 | 61.8 | 67.0 | -5.2 | 高 | - | NO_STALE_EVIDENCE | | |

#### C群（12人）

| 選手 | 自作 | PowerPro | raw_diff | 信頼度 | 原因 | stale | あなたの判断 | 任意の点数・コメント |
|---|---|---|---|---|---|---|---|---|
| 村林 一輝 | 64.7 | 69.0 | -4.3 | 高 | PROJECT_EVIDENCE_CONFLICT+POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 岩田 幸宏 | 100.0 | 96.0 | +4.0 | 中 | MODEL_SCALE+PROJECT_EVIDENCE_CONFLICT | NO_STALE_EVIDENCE | | |
| 細川 成也 | 56.2 | 60.0 | -3.8 | 高 | PROJECT_EVIDENCE_CONFLICT+POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 中村 悠平 | 52.4 | 56.0 | -3.6 | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_POSSIBLE | | |
| 並木 秀尊 | 100.0 | 97.0 | +3.0 | 低 | MODEL_SCALE+PROJECT_EVIDENCE_CONFLICT+CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| 大島 洋平 | 76.8 | 74.0 | +2.8 | 低 | PROJECT_EVIDENCE_CONFLICT+CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| モンテロ | 46.5 | 49.0 | -2.5 | 低 | PROJECT_EVIDENCE_CONFLICT+CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| 梅野 隆太郎 | 54.5 | 57.0 | -2.5 | 低 | CURRENT_EVIDENCE_WEAK | NO_STALE_EVIDENCE | | |
| 郡司 裕也 | 60.5 | 61.0 | -0.5 | 中 | PROJECT_EVIDENCE_CONFLICT+POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |
| 名原 典彦 | - | - | - | 低 | - | NO_STALE_EVIDENCE | | |
| 塩見 泰隆 | - | 83.0 | - | 低 | POWERPRO_STALE_OR_ODD+CURRENT_EVIDENCE_WEAK | POWERPRO_STALE_POSSIBLE | | |
| 山口 航輝 | 52.0 | 52.0 | 0.0 | 中 | PROJECT_EVIDENCE_CONFLICT+POWERPRO_STALE_OR_ODD | POWERPRO_STALE_POSSIBLE | | |


# SP-052 option B — same-year overlap census

生成日: 2026-08-13  
案A（cross-time）へは進んでいない。

## 探索範囲

- The Show: `the_show_rating` の **Live / 野手 / speedあり** だけ（special/boosted は混ぜない）
- PowerPro: SP-041 の 2,972人 long panel
- 同一性: `the_show_bridge` と `mlb_bridge`（proeye_id がある行）。日本語名と英語名の曖昧一致はしていない
- 同一年のみ。年をまたぐ補間はしていない

## 結果

| 指標 | 値 |
|---|---|
| overlap player count | 6 |
| overlap pair count | 7 |
| years | 2021, 2023, 2024, 2025 |
| show band | fast 0 / mid 4 / slow 3 |
| sealed holdout players with a same-year pair | 1 |
| player-holdout 可能か | いいえ |

以前の100人中心調査（6人・7ペア）と、全収集を対象にした今回の母集団探索は同じ規模だった。

## 判定

**same-time numeric bridge remains NOT_IDENTIFIABLE**

SP-052は再開しない。案Aへ自動では進まない。

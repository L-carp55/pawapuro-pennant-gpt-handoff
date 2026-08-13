# SP-052 — The Show → PowerPro same-time mapping 方式比較（SR-025）

生成日: 2026-08-13
状態: **NOT_IDENTIFIABLE。same-time bridge は現在の母集団では構造的に推定できない**

## 0. 結論（先に3行）

1. The Show と PowerPro の両方に値がある選手は31人いるが、**同一年の値を持つのは6人だけ**
2. 残り25人は**年が完全に分離**している——The Showは選手の**MLB在籍年**、PowerProは
   **NPB在籍年**に値を持ち、この2つは経歴上ほぼ連続しない別区間だから
3. これは収集不足ではなく**母集団の性質**。SR-025の「**same-time** bridge」という要件は、
   この母集団では原理的に満たせない。**方式比較（linear/isotonic/piecewise/quantile）の
   結論は出さない**

## 1. 時間的分離の実測

| 区分 | 人数 |
|---|---|
| The Show年・PowerPro年の両方を持つ | 31 |
| うち **同一年が1つ以上ある**（same-time可） | **6** |
| うち **年が完全に分離**（same-time不可） | **25** |

分離の実例:

```text
鈴木 誠也 : Show[2023,2024,2025,2026]  PowerPro[2013-2021]
吉田 正尚 : Show[2023,2024,2025,2026]  PowerPro[2016-2022]
オースティン: Show[2026]                PowerPro[2020-2025]
スパンジェンバーグ: Show[2023]           PowerPro[2020-2021]
```

NPB→MLBへ移った選手が対象なので、当然こうなる。**橋を架けたい2つの値が、
定義上ほぼ同じ年に存在しない。**

## 2. 使えるデータ量

| 指標 | 値 |
|---|---|
| same-timeペア | **7件 / 6人** |
| 封印ホールドアウトで両方の値を持つ選手 | **0人** |

`configs/holdout_mlb_bridge.json` の `_verdict` は2026-08-04時点で既に
「test 11人のうちパワプロ走力ラベルを持つ人が0人で検証に使えなかった」と記録している。
SP-041でPowerProパネルが2,972人へ拡大した後も、**The Show側の被覆が足りず状況は変わらない**
（封印test 10人のうち PowerPro を持つのは9人だが、The Show を持つのは0人）。

## 3. 方式比較の結果は採用しない

参考として leave-one-out（選手単位）を回すと linear/piecewise が MAE 7.6、
baseline（平均値を返すだけ）が 17.4 だったが、

- **fold数が5しかない**
- band別に割ると各bandのnが1〜2

ため、**方式間の優劣を論じられる水準ではない**。数値は
`outputs/derived/sp052_the_show_to_powerpro_mapping.json` に残すが、
**SP-052の完了根拠にはしない**。

## 4. ホールドアウトの露出（自己申告）

本タスクの下調べで、封印test選手 **`ハイネマン`** の (The Show, PowerPro) の組を
画面へ出力してしまった。`configs/holdout_mlb_bridge.json` の既存運用
（`_exposed_excluded`＝「一度見た値は見なかったことにできない」）に従い、
恣意的な選び直しではなく**露出の事実に基づいて** exposed へ追加し、fitでは train 側扱いとする。
封印されたまま残るのは10人。

## 5. 次にどうするか（オーナー判断が要る）

SR-025は「The Show→PowerPro **same-time** bridgeをlinear/quantile/isotonic等で比較し
holdout検証する」だが、上記のとおり**same-timeの形では成立しない**。選択肢:

| 案 | 内容 | 影響 |
|---|---|---|
| A | **cross-time bridge を許容**し、経年変化（加齢・移籍）を明示的に補正した上で橋を架ける | SR-025の「same-time」要件の変更＝**オーナー裁定が要る** |
| B | 母集団を変える。両ゲームに**同時点で載っている選手**（MLB選手でPowerProの海外選手枠にいる等）を探す | 存在するか未調査 |
| C | The Showを経由せず、**Statcast実測→PowerPro**の既存経路に絞る（`the_show_mapping.json`のown_scale, n=11） | ただし同じ時間的分離の問題を抱えるため、Aと同じ論点に帰着 |

**この判断はowner review queueとは別**（queueは作成・送付しない）。設計判断として
`SP-046`（Final PowerPro role / non-circular usage policy）と併せて提示する候補。

## 6. SP-053への影響

SP-053「Apply validated The Show mapping to pre-PowerPro foreign measurements」は
**validated mapping の存在を前提としている**。本タスクがNOT_IDENTIFIABLEである以上、
SP-053は着手できない。依存関係は維持したまま、SP-053のブロッカー理由を本ファイルへ更新する。

## 7. 成果物

- `scripts/sp052_the_show_to_powerpro_mapping.mjs`
- `outputs/derived/sp052_the_show_to_powerpro_mapping.json`

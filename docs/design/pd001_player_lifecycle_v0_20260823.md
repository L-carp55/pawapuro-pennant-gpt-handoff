# PD-001 — 選手人生（成長・ピーク・衰え）設計 v0

Status: **DESIGN BASELINE / PHASE 5**
Date: 2026-08-23
Scope: ペナントの長期選手成長・衰え。年度査定の走力owner reviewとは別系統。

## 0. 目的

本家ペナントへの主要不満の1つである「選手の成長と衰えが雑」を解消する。

既存 `docs/design/integration_design_v0.md` のPhase 5方針、すなわち「成長曲線は年齢別実成績カーブを実データから推定する」を継承し、固定的な早熟/普通/晩成テーブルではなく、NPB実測と選手固有差から選手人生を生成する。

この設計は査定側の0–100絶対スケールが今後修正されても壊れないよう、内部のlatent skill（リーグ環境に対する潜在能力）と表示能力値を分離する。

## 1. 採用する基本構造

能力群 `k`、選手 `i`、シーズン `t` について、概念的には次の分解を持つ。

```text
latent_skill[i,k,t+1]
 = latent_skill[i,k,t]
 + population_age_curve[k, age]
 + persistent_player_effect[i,k]
 + annual_development_shock[i,k,t]
 - persistent_injury_loss[i,k,t]
```

実装時の具体式・分布・係数はPD-001B以降で実データから推定し、ここではハードコードしない。

### 1.1 population age curve

NPBの実測から能力群別に推定する平均加齢効果。

全能力を同じ年齢補正で動かさない。少なくとも打撃、走力/走塁、守備、肩、投手球速、奪三振、制球、被弾、スタミナ等は、利用可能な観測とconstructに応じて別々に扱う。

### 1.2 persistent player effect

平均より伸びやすい、衰えにくい、ピークが前後する等の持続的個人差。

これにより同年齢でも異なる人生曲線を許す。架空新人では母集団から生成し、実在選手では開始時点までの本人履歴が十分ならBayesianに更新する。

### 1.3 annual development shock

毎年の小さい確率変動。独立乱数だけで能力が上下にガタつく設計にはしない。

大きなブレイクが必要なら、専用の「覚醒ボタン」を主因にせず、低確率の持続的変化としてモデル化し、表示上のみ物語化できるようにする。

### 1.4 injury / persistent loss

怪我による一時離脱と恒久能力低下を、通常の加齢曲線と分離する。

PA/IPや出場試合の減少だけを怪我とみなしてはいけない。二軍落ち、併用、不調、起用判断が混在するため、PD-001Dで別モデルとして扱う。

## 2. 明示的に不採用とする設計

- 固定の「早熟・普通・晩成」を人生の主決定変数にする。
- ある年齢から全能力を一律に `-N` する。
- 単年成績の悪化をそのまま真の能力低下とみなす。
- 各選手に固定の絶対上限（例: 将来パワー90）を神様視点で与え、それだけで成長を決める。
- 0–100表示能力値そのものの差分を、データ未校正のまま直接aging modelの目的変数にする。
- 生き残ったベテランだけの単純平均を加齢曲線として採用する。

## 3. 成績と真の能力を分離する

単年成績は試合数・対戦・運・環境・役割等のノイズを含む。

```text
latent true skill
    ↓
試合エンジン + 環境 + 起用 + 確率変動
    ↓
観測された年度成績
```

成長・衰えで直接動かすのはlatent skillであり、「今年OPSが落ちたから能力も同量落とす」という自己増幅を避ける。

査定の目的関数（その年の能力査定）と、ペナント内の将来成長モデル（projection / lifecycle）は別用途として分離する。

## 4. 将来性は点ではなく分布として持つ

若い選手ほど将来の不確実性を大きくする。

例として、将来能力を内部的に「中央値76、10–90%区間58–91」のような分布として表現できる構造を採る。観測が増えるほどposteriorを狭める。

ユーザー表示では現在能力を通常どおり明示し、将来分布をどこまで可視化するかはUI設計で別途決める。

## 5. survivorship / selection biasを明示的に扱う

高齢で急落した選手ほど翌年の一軍データから消えるため、連続年度が存在する選手だけの平均差は衰えを過小評価しうる。

PD-001Bでは少なくとも次を検討・比較する。

- 同一選手の連続年度変化
- 小サンプル成績の縮小
- 年度リーグ環境の正規化
- 翌年観測される確率 / 一軍に残る選抜の影響
- 欠落・引退・一軍非出場を無視した推定との差
- 年齢効果の平滑化と端年齢の不確実性

単純な「年齢別OPS平均」の差をそのまま成長率にはしない。

## 6. PD-001の工程分割

### PD-001A — Age Dataset Foundation

2006–2025の学習対象player-seasonへ生年月日と再現可能な年齢を結合する。

主経路はProEYE球のPlayer Registryにある `PlayerID` + `Birthdate` の直接ID結合。名前fuzzy matchingは主経路にしない。

### PD-001B — Empirical Aging Curves

年齢付き実測データから、能力/construct別のpopulation aging curveと不確実性を推定する。

### PD-001C — Individual Development Engine

population curveにpersistent player effectとannual shockを統合し、架空新人・実在選手に適用できる更新エンジンを作る。

### PD-001D — Injury / Availability / Retirement

能力変化と出場可能性、怪我、引退を分離したモデルを作る。

### PD-001E — Long-run QA

20年・50年・必要なら100年シミュレーションで少なくとも以下を検査する。

- 能力インフレ/デフレが起きない
- 人材が枯渇しない
- 特定年齢で全員一斉にピーク/急落しない
- 遅咲き、早期完成、長寿スター、急落が適度に共存する
- 年齢構成・能力分布・引退年齢が不自然にならない
- seed固定時の再現性

## 7. PD-001Aで固定する年齢定義

生年月日そのものをcanonicalに保存し、年齢は導出値として再計算可能にする。

aging model用にはシーズンの代表日を **7月1日** とし、次の両方を生成する。

- `age_july1_completed`: その年7月1日時点の満年齢（カレンダー上のcompleted years）。
- `age_july1_decimal`: `days(YYYY-07-01 - birth_date) / 365.2425` の連続年齢。

ProEYE等が表示する `Age` 列はcanonical ageとして使わない。表示時点や定義が変わりうるため、DOBから必ず自前導出する。

## 8. データ源方針（PD-001A）

### Primary

ProEYE球 Player Registry:
- https://proeyekyuu.com/player-registry/
- 同一表に `Birthdate` と `PlayerID` が存在する。
- 本プロジェクトの主要統計ソースであるProEYEのIDをそのまま `data/pennant.db` の `player_id` と結合する。
- 一括表/CSV exportを優先し、名前名寄せや2,000件超の個別ページ巡回を避ける。

### Secondary independent cross-check

Wikidata:
- `P4260` = NPB player ID
- `P569` = date of birth
- IDのexact joinのみを原則とする。

### Tertiary / limited QA

現在選手について、既存の公開player directory等を補助照合に使ってよい。ただし、過去に確認した年次roster CSVは現在情報が混入しており歴史snapshotとして使わない。

### Forbidden / non-production

- NPB公式サイトをデータ取得元にしない（プロジェクト既定の二次利用制約）。
- ドラフト年からDOBを推定してproduction値にしない。
- 名前だけの曖昧一致でDOBを採用しない。
- 欠損DOBを0や仮日付で埋めない。

## 9. 次のcritical path

`PD-001A → 独立QA → PD-001B`

PD-001Aはcoverage 100%を無理に作ること自体が目的ではない。未解決が残る場合はplayer_id単位で明示し、推測値を混ぜずにcoverageと影響player-season数を測定してからPD-001Bへ渡す。

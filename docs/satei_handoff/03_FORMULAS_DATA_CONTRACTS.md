# 数式・データ契約・計算台帳

この文書は実装者向け。  
数値を手作業で調整せず、入力・変換・出力を追跡可能にする。

---

## 1. データ原則

### 1.1 Provenance

全入力値に以下を持たせる。

```yaml
value:
source_name:
source_url:
retrieved_at:
season:
league:
context:
is_estimated:
estimation_method:
confidence:
notes:
```

### 1.2 生データと派生値を分離

```text
raw/
normalized/
derived/
ratings/
comparison/
```

へ分離する。

派生値を生データへ上書きしない。

### 1.3 欠損を0にしない

- 不明: `null`
- 実際に0: `0`
- 推定: 値 + `is_estimated=true`

---

## 2. 選手カードスキーマ

```yaml
player_id:
name_ja:
name_en:
card_type: peak_single_year | prime_composite
season_label:
seasons_used:
team:
league:
team_games:
primary_position:
secondary_positions:
bats:
throws:
source_freeze_commit:
```

`peak_single_year`で別年度の能力を直接混ぜてはならない。

---

## 3. 打撃入力

```yaml
batting:
  G:
  PA:
  AB:
  H:
  2B:
  3B:
  HR:
  BB:
  IBB:
  HBP:
  SO:
  SF:
  SH:
  GDP:
  SB:
  CS:
  AVG:
  OBP:
  SLG:
  OPS:
  ISO:
  BABIP:
```

文脈別:

```yaml
splits:
  vs_r:
    PA:
    AB:
    H:
    HR:
  vs_l:
    PA:
    AB:
    H:
    HR:
  risp:
    PA:
    AB:
    H:
    HR:
  non_risp:
    PA:
    AB:
    H:
    HR:
  vs_r_non_risp:
    PA:
    AB:
    H:
    HR:
```

---

## 4. ミート計算

### 4.1 文脈選択

```python
if vs_r_non_risp.AB is sufficient:
    context = "A"
    H_ctx = vs_r_non_risp.H
    AB_ctx = vs_r_non_risp.AB
elif vs_r.AB is available:
    context = "B"
    H_ctx = vs_r.H
    AB_ctx = vs_r.AB
else:
    context = "C"
    H_ctx = total.H
    AB_ctx = total.AB
```

禁止:

```text
対右とRISPの周辺集計から、任意係数で対右×非得点圏を作る
```

### 4.2 2019環境換算

比較するリーグ平均は同文脈。

率比型の暫定形:

```text
AVG_env
= AVG_ref_2019_context
× (AVG_player_context / AVG_lg_year_context)
```

より柔軟な傑出度式を使う場合も、設定ファイル化し感度分析する。

### 4.3 経験ベイズ縮小

```text
AVG_post
= (H_env_equivalent + kappa_M × AVG_prior)
  / (AB_context + kappa_M)
```

実装しやすい代替:

```text
AVG_post
= (AB_context × AVG_env + kappa_M × AVG_prior)
  / (AB_context + kappa_M)
```

Prior候補:

1. 同選手の前後年・直近3年
2. 二軍/MLB変換後の本人実績
3. 同リーグ・同年代・同打席タイプ
4. リーグ平均

`kappa_M`は校正対象。ハードコード禁止。

### 4.4 平均得能込みM

```text
M_mean = f_m(AVG_post)
```

`f_m`は連続・単調増加関数。

初期アンカー候補:

```yaml
- [.180, 19]
- [.200, 25]
- [.230, 40]
- [.260, 50]
- [.280, 60]
- [.300, 65]
- [.320, 70]
- [.330, 75]
- [.350, 84]
- [.365, 90]
- [.370, 94]
```

これは未校正。過去の基準を起点にテストするための候補。

### 4.5 得能・相互作用台帳

```yaml
meat_adjustments:
  baseline_mean_ability:
  special_ability_delta:
  strikeout_red_delta:
  power_interaction_delta:
  infield_hit_delta:
  manual_delta:
  manual_reason:
  final_meat:
```

ルール:

- `manual_delta != 0`なら理由と根拠を必須。
- 同じ要素を二行に入れない。
- 完全neutral統計を使った場合、チャンス/対左を再度引かない。

---

## 5. パワー計算

### 5.1 500PA相当AB

```text
ABREF_500PA_2019_NPB = 436.25
```

設定ファイルに置く。

```text
HR_500PAeq_raw
= HR / AB × ABREF_500PA_2019_NPB
```

### 5.2 環境換算

率で処理する。

```text
hr_rate_player = HR / AB
hr_rate_lg_year = HR_lg / AB_lg
hr_rate_ref = HR_lg_2019 / AB_lg_2019
```

候補式:

```text
hr_rate_env
= hr_rate_player
× (hr_rate_ref / hr_rate_lg_year) ^ gamma_HR
× park_factor
× league_factor
```

`gamma_HR`は未校正。設定値と感度分析を保存。

### 5.3 経験ベイズ縮小

```text
hr_rate_post
= (HR_env_equivalent + kappa_P × hr_rate_prior)
  / (AB + kappa_P)
```

実装代替:

```text
hr_rate_post
= (AB × hr_rate_env + kappa_P × hr_rate_prior)
  / (AB + kappa_P)
```

```text
HR_500PAeq_post
= hr_rate_post × 436.25
```

Priorはケガ・限定起用・新人によって選択する。

### 5.4 ISO/SLG整合

```yaml
power_cross_checks:
  ISO:
  SLG:
  2B_rate:
  3B_rate:
  Barrel:
  HardHit:
  EV:
  MaxEV:
  FB_rate:
  HR_FB:
  xSLG:
```

三塁打は脚力・球場要因を分離する。

### 5.5 平均得能込みP

```text
P_mean = f_p(HR_500PAeq_post, ISO, SLG, quality_of_contact)
```

初期アンカー:

```yaml
- [10, 60]
- [20, 70]
- [30, 80]
- [40, 86.5]
- [46, 90]
- [50, 94]
- [56, 100]
- [60, 103.5]
- [70, 110]
```

### 5.6 得能調整台帳

```yaml
power_adjustments:
  baseline_mean_ability:
  trajectory_delta:
  power_hitter_delta:
  pull_or_opposite_delta:
  intimidation_delta:
  manual_delta:
  manual_reason:
  final_power:
```

寄与点はゲーム内校正まで仮設定。

---

## 6. チャンス・対左

### 6.1 チャンス

```text
DeltaChance = AVG_RISP - AVG_nonRISP
```

単年は強く回帰する。

チャンス得能の決定にRBIを直接使わない。

追加得能:

- 満塁男: 満塁分割
- サヨナラ男: サヨナラ機会
- 逆境○: ビハインド時
- ダメ押し: 大差・終盤等
- 決勝打系: 決勝機会の定義が必要

### 6.2 対左

```text
DeltaLeft = AVG_vsL - AVG_vsR
```

PA/ABの小ささを多年度へ縮小する。

本塁打差も見るが、ミートとパワーの対左効果を混同しない。

---

## 7. 信頼度

能力の±レンジは最終出力しなくても、内部信頼度を持つ。

```yaml
confidence:
  sample:
  source_quality:
  context_match:
  prior_quality:
  game_calibration:
  overall:
```

例:

- A: 直接計測・十分サンプル・完全文脈
- B: 公式集計・一部近似
- C: 周辺値・映像/スカウティング
- D: 推定が大きい

---

## 8. 出力計算ログ

各選手で以下のJSON/YAMLを保存。

```yaml
player:
card:
inputs:
context_tier:
environment:
prior:
shrinkage:
meat:
  context_avg:
  env_avg:
  post_avg:
  mean_ability:
  adjustments:
  final:
power:
  hr_rate:
  hr_500paeq_raw:
  env:
  post:
  mean_ability:
  adjustments:
  final:
fielding:
special_abilities:
confidence:
unresolved:
```

---

## 9. ソース優先順位

1. NPB公式・MLB公式・Statcast
2. DELTA等の専門指標
3. Baseball-Reference / FanGraphs
4. NF3 / Baseball Data等の集計サイト
5. 記事・映像・スカウト評価
6. ファン査定サイト
7. SNS

KONAMI能力サイトは比較専用。独自査定の入力には使わない。

---

## 10. データ検算

必須:

```text
H = 1B + 2B + 3B + HR
AVG = H / AB
OBP整合
SLG整合
SB成功率
RISP H/AB整合
左右H/AB合計の差
守備機会 = PO + A + E
```

丸め誤差以外の不一致はフラグにする。

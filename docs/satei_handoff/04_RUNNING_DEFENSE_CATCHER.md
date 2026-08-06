# 走力・盗塁・守備・捕球・肩・捕手仕様

---

## 1. 走力 — ADOPTED

### 1.1 原則

```text
走力は純粋な脚力。
盗塁数・盗塁成功率そのものではない。
```

### 1.2 データ優先順位

第1階層:

- Sprint Speed
- 一塁到達タイム
- 走塁時最高速度
- 30m/50m走
- Home-to-first
- 外野での追走速度計測

第2階層:

- 公式スカウティング
- 代走起用
- 映像計測
- Statcast Baserunning Run Value等

第3階層（補助）:

- 三塁打率
- 内野安打率
- 併殺回避
- BsR/UBR
- 追加進塁率

注意:

- 三塁打には球場形状、打球方向、長打力が混ざる。
- 内野安打には左打ち、ゴロ率、打球傾向が混ざる。
- 守備範囲から走力を決め、その走力で守備力を逆算すると循環する。

---

## 2. 盗塁得能 — ADOPTED

### 2.1 使用指標

```text
成功率
企図率
純粋走力に対する成功率の残差
投手クイック
捕手阻止力
走者のスタート・スライディング評価
```

例:

```text
走力A・成功率低い → 盗塁E/F
走力C・成功率高い → 盗塁B
走力A・企図なし → 慎重盗塁、能力ランクは中立
```

盗塁数を走力に戻さない。

---

## 3. 走塁得能 — ADOPTED

盗塁とは別。

使用:

- 一塁から三塁
- 二塁から本塁
- タッチアップ
- 追加進塁
- 走塁死
- BsR/UBR
- 三塁打のうち速度寄与

---

## 4. 守備力と捕球 — ADOPTED

### 4.1 守備力

```text
範囲
反応
一歩目
打球判断
ポジショニング
球際
処理速度
併殺動作
```

### 4.2 捕球

```text
失策
守備率
捕球・ハンドリング
バウンド処理
落球
捕逸（捕手）
```

### 4.3 送球

- 純粋速度・遠投: 肩力
- 精度: 送球得能
- 送球失策を識別して使う
- 総失策を肩力へ入れない

---

## 5. 内野守備 — ADOPTED / PROVISIONAL

内野の守備範囲は、走力より守備力の寄与が大きい。

主材料:

- OAAの内野範囲
- RngR
- 反応時間
- 左右・前後の処理
- 補殺/守備機会をポジション・投手傾向で調整
- 併殺動作

同じ範囲の俊足・鈍足内野手で、外野ほど大きな守備力補正を行わない。

固定係数は未校正。

---

## 6. 外野守備 — ADOPTED / PROVISIONAL

外野の守備範囲は走力と守備力の合成。

必須方向:

```text
同じ現実Rangeなら
俊足外野手 → 守備力を下方修正
鈍足外野手 → 守備力を上方修正
```

例示用の0.55/0.45式は撤回済み。実装に使わない。

校正方法:

1. パワプロ内で複数の走力・守備力組合せを作る。
2. 同一打球セットを守らせる。
3. 捕球到達率・到達時間を計測。
4. 現実Range指標へフィット。
5. ポジション別応答曲面を作る。

外野肩:

- 送球速度
- 進塁抑止
- Arm Runs
- 補殺は走者・打球・守備位置の文脈調整が必要

補殺数だけで肩Sにしない。

---

## 7. 失策の取り扱い — ADOPTED

```text
エラー数は捕球のみに影響する。
守備力には直接影響しない。
```

ただし失策分類がある場合:

- 捕球失策 → 捕球
- 送球失策 → 送球
- 判断ミスで記録されない失策 → 守備力/特殊能力候補

総合UZR/DRSを守備力に使い、同時に失策で捕球を下げる場合は、総合指標内のエラー成分を除く。

---

## 8. 出場量 — ADOPTED

守備イニングは能力への直接加点ではなく、推定信頼度に使う。

REJECTED:

```text
DefWorkが高いから守備力+4
```

正しい処理:

```text
守備イニングが多い
→ 指標の縮小を弱くする
→ 能力値そのものを自動加点しない
```

---

## 9. ゴールデングラブ — REJECTED

守備能力の入力に使わない。

理由:

- 打撃印象
- 知名度
- 過去の固定観念
- 記者投票
- ポジション別候補不足

紹介情報としてのみ利用可能。

---

## 10. 捕手能力 — ADOPTED / PROVISIONAL

### 10.1 盗塁阻止への寄与順

```text
肩 > 送球 > 守備力
```

- 肩: 送球速度・到達球速
- 送球: 精度
- 守備力: 捕球からリリースまでの速さ、動作
- 捕球: 盗塁阻止とは別。捕逸・失策等

### 10.2 必要データ

```text
盗塁企図
盗塁刺
盗塁阻止率
捕手守備イニング
Pop Time
Exchange Time
送球速度
送球失策
捕逸
投手クイック
牽制
相手走者の走力
```

### 10.3 文脈調整

捕手盗塁阻止率をそのまま肩へ変換しない。

モデル候補:

```text
CS_result ~ catcher_arm + catcher_exchange + catcher_accuracy
          + pitcher_quick + runner_speed + pitch_location
```

ゲーム内の肩・送球・守備力への逆算係数はシミュレーションで決める。

過去の0.55/0.30/0.15はREJECTED。

---

## 11. 捕球のポジション別校正

同じ守備率でもポジションで難易度が違う。

ただし旧v1.9の固定表をそのまま使わず、各年・各ポジションの:

```text
E / Defensive Chances
FPCT
プレー難度
送球失策比率
```

で標準化する。

候補:

```text
error_rate = E / (PO + A + E)
z_error = position_year_standardize(error_rate)
```

捕球値への変換係数は校正対象。

---

## 12. サブポジ

- 守備イニング
- 起用頻度
- 実際の守備指標
- ポジションごとの能力差

主位置とサブポジで同一守備力が適切とは限らない。ゲーム仕様上の適性値も別管理する。

---

## 13. 走守計算ログ

```yaml
running:
  primary_speed_metric:
  secondary_metrics:
  speed_rating:
  steal_attempt_rate:
  steal_success_rate:
  steal_residual_vs_speed:
  stealing_ability:
  baserunning_ability:

fielding:
  position:
  range_metric:
  range_component_only:
  speed_rating_fixed:
  inferred_fielding_rating:
  error_rate:
  catching_rating:
  arm_metric:
  arm_rating:
  throwing_error_rate:
  throwing_ability:
  innings:
  confidence:

catcher:
  attempts:
  caught:
  caught_stealing_rate:
  pop_time:
  exchange:
  throw_velocity:
  pitcher_context:
  runner_context:
  shoulder:
  throwing:
  fielding:
  catching:
```

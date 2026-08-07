# 走力・守備力・捕球・内野肩の再設計監査

日付: 2026-08-07
状態: **設計変更を確定。旧走力・旧守備力・内野位置推定肩を本番出力から安全停止済み**

## オーナー判断

1. 走力のsanity checkは **周東佑京 > 近本光司 > 源田壮亮**。教師ラベルではなく常識チェック。
2. 走力と `内野安打○ / 走塁 / 盗塁 / 併殺` 等の技術を完全分離する。走力は50m走そのものではなく、野球の直線走で使う身体能力。
3. 守備力を `RngR - 走力で説明できる範囲` と定義する旧方式は撤回。守備力は反応、一歩目、加速、判断、ポジショニング等を含み、走力と共同で範囲を作る。
4. 捕球は同じ守備率でもプレー難度・守備機会・守備範囲・負荷が違えば同じ能力にしない。固定仕事量ボーナスではなくexpected errorで扱う。
5. NPB+平均送球速度を内野肩の直接材料にする案はClaude Code側で既に不合格。再提案しない。

## 1. 走力

### 旧方式を停止した理由

旧 `speedComponents` は三塁打割合・併殺回避・内野安打・UBR等を直接合成していた。
しかしこれらは純粋速度以外の技術・文脈を含む。

```text
三塁打   -> 打球・球場・外野守備・走塁判断
内野安打 -> 打球＋打席から走りへの移行＋一塁駆け抜け
UBR      -> 打球判断・進塁判断・ベースランニング
併殺回避 -> ゴロ/走者状況・守備・一塁走技術
```

相関があっても、これらを固定重みで平均して「純粋な足の速さ」とすることは定義違反。

### 新しい身体軸

詳細: `docs/audits/2026-08-07_baseball_speed_definition.md` / `2026-08-07_baseball_speed_direct_axes.md`

```text
physical baseball speed
  ├─ top speed
  └─ short acceleration
```

最高速度:
- NPB+ / MLB Statcast Sprint Speedを直接アンカー候補とする。

短距離加速:
- Baseball Savant 90-foot Running Splitsの **5→30ft** を使う。
- 2017-2025、4,710選手年。
- 5→30ft timeの隣接年一致 r=.914。
- Sprint Speed・打席左右・年度を除いた5→30ft残差も隣接年 r=.747。
- 0→5ft残差はr=.493なので、5→30ftの方が打席離脱の影響を減らした身体的加速軸として安定。

一塁到達H1:
- Sprintと強く相関するが打席左右・打席離脱・駆け抜け等を混ぜる。
- H1残差は年跨ぎで安定しているが、真の5→30ft加速をplayer-holdoutで予測する相関は約.31しかない。
- **H1を加速力として代用しない。**

### speed + skill分離

2026 NPB+ Sprintを身体速度アンカーとして、結果ごとに:

```text
outcome_z = loading * physical_speed_z + stable_skill + annual_noise
```

へ分解すると、速度除去後の残差にも年跨ぎ再現性が残る。

```text
内野安打 skill残差 repeat ≈ .174
UBR/走塁 skill残差 repeat ≈ .083
併殺残差 repeat ≈ .247
```

しかも3残差の相互相関は約.13〜.18で、かなり別々の技術軸。

joint factorのplayer-holdoutは r=.751、長期較正でr=.760まで改善したが、2024はまだ `周東 > 源田 > 近本`。
年度窓・skill較正期間を変えても直らない。

結論:
**集約成績だけでは近本と源田のような近い純粋速度差を識別できない。無理に順位を作らず未査定を維持する。**

### 実装

- `configs/baseball_speed_model.json`
- `src/ratings/speed_skill_factor.mjs`
- `scripts/test_speed_skill_factor.mjs`

最終カードでは現在:

```text
走力       未査定
盗塁       未査定
走塁       未査定
内野安打○  未査定
```

旧proxyはlegacy evidenceとして保持。

## 2. 守備力

### 撤回した旧定義

```text
Fielding_old = standardized(RngR - E[RngR | speed])
```

俊足だから守備力を下げるという意味になり、反応・初動を主とするオーナー定義と不適合。

### 新しい構造

```text
P(play converted to out)
  = f(
      speed,
      fielding,
      ball location / hang time / direction,
      initial positioning,
      position,
      other context
    )
```

走力と守備力が共同で守備範囲を作る。

`src/engine/fielding_response.mjs` / `configs/fielding_response_surface.json` に、較正済みlookup tableだけを受け取る骨格を追加。
反応秒数・speed/fielding重み等の仮係数は置かない。較正表が無ければフェイルファスト。

`fielding_ability.enabled=false`。旧値はlegacy evidenceのみ。

### PBPイベント探索

既存31,003件の内野ゴロを位置・打者・年度等で調整したevent residualはRngRと約+.3〜+.5で整合する一方、隣接年安定性がほぼ0。
現在のPBPにはハングタイム・打球速度・初期守備位置がなく、同じ座標でも難度差を取り切れない可能性が高い。

本番未採用。

## 3. 捕球

現行ErrR/FEは翌年再現性を目的に強く50へ縮小しており、当年の難度・範囲・負荷を十分扱わない。

新構造:

```text
P(field error on play)
  = f(
      position,
      batted-ball location/type,
      play difficulty,
      range/reach context,
      workload/rest,
      season/park,
      ...
    )

catching evidence = actual FE - expected FE
```

固定の「1200イニングなら+Y」は入れない。

### workload context

PBPの `fielder_2_name`〜`fielder_9_name` から各試合の守備球数を復元できるため、`build_fielding_error_events.mjs`へ以下を追加:

- 前回守備試合からの日数
- 直近7/14日の守備試合数
- 直近7/14日の守備球数
- 当該プレー前のシーズン累積守備試合数/守備球数

現在試合の後半情報は使わない。日付欠損は0でなくnull。
固定疲労点へ変換せず、生説明変数としてexpected-error較正へ渡す。

`src/ratings/fielding_workload.mjs` / `scripts/test_fielding_workload.mjs` を追加、28 checks PASS。

生PBPは公開handoff repoに無いため、実テーブル再生成は元Claude Code環境で行う。
捕球は `PROVISIONAL_REDESIGN` のまま。

## 4. 内野肩

### 棄却済み

- 守備位置からの推定: 外部照合でほぼ無相関（順位相関約-.04）。
- NPB+平均送球速度: 送球距離・プレー要求を強く反映し、位置内補正でも不合格。

### 既存PBP

`infield_grounder_events`:

```text
2020-2026
31,003件
out          28,911
infield_hit   1,784
throw_error     276
other_miss       12
```

raw深部アウト率はDELTA 2017遠投評価6人と最大+.66程度だが単年再現性がほぼ0〜負。
深さへの傾きモデルは外部相関が逆で棄却。

現在残す唯一の研究候補は**文脈調整した深部アウト残差の複数年pool**。

```text
外部DELTA corr 最大 +.688
偶数年/奇数年poolの安定性 一部条件 +.3〜+.45
```

ただし外部6人のみなので本番未採用。
`infield_arm_ability.enabled=false` を維持。

## 検証

主要なGitHub Actions:

```text
守備/内野肩安全ゲート              31157691757 SUCCESS
修正版深部ゴロ外部監査             31157870610 SUCCESS
走力定義分離パッチ全回帰           31175187526 SUCCESS
直接Sprint/H1軸監査                 31175508932 SUCCESS
MLB 5→30ft加速監査                  31176115981 SUCCESS
NPB proxy→身体加速監査              31176286546 SUCCESS（加速は不合格）
H1→5→30ft加速holdout                31176592430 SUCCESS（r≈.31で不合格）
speed/skill残差分離                 31176767512 SUCCESS
joint speed+skill factor            31176920402 SUCCESS
証拠窓holdout                       31177058741 SUCCESS
長期skill較正                       31177303742 SUCCESS
speed_skill_factor汎用部品全回帰    31177734971 SUCCESS
```

走力定義分離後の全回帰例:

```text
fielding workload 28 PASS
fielding/defense gates 12 PASS
cards 13 PASS
qa_remaining 173 PASS
phase1 safety 5 PASS
```

## 本番への安全方針

- 走力: **未査定**。旧proxyはlegacy evidenceのみ。
- 盗塁: **未査定**。新しいphysical speed確定後に残差化し直す。
- 走塁: **未査定**。
- 内野安打○: **未査定**。新しいphysical speed確定後にイベント残差で再構築。
- 守備力: **未査定**。
- 捕球: **provisional**。event-level expected-errorへ置換予定。
- 内野肩: 有効な直接証拠が無ければ**未査定**。
- 外野/捕手肩: 有効な実測ARM等は継続。

## 受入条件

### 走力
- physical speedをtop speedとshort accelerationへ内部分解できる。
- 内野安打/UBR/盗塁/GDP/三塁打を固定重みでspeedへ直接加えない。
- skill残差をspeedへ足し戻さない。
- player-holdoutで十分な精度を持つ。
- 周東 > 近本 > 源田を学習ラベルにせずsanityとして満たす。
- 最終1つの走力へのtop speed/acceleration合成は、自作エンジンの27〜30m走応答から決める。

### 守備力
- エンジン上で同じ走力でも守備力を上げれば初動・到達率が改善する。
- 高走力・高守備力を同時に持つ選手を表現できる。
- 現実Range分布をシーズン単位で再現できる。

### 捕球
- play difficultyを調整したFEモデルが単純FE/ErrRより説明力を持つ。
- 同じ守備率でも難しい機会・高負荷を処理した選手を区別できる。
- TEとの二重計上をしない。

### 内野肩
- NPB+平均送球速度を教師にしない。
- 文脈調整した深部プレー由来指標を独立データで検証する。
- 条件を満たせなければ未査定を維持する。

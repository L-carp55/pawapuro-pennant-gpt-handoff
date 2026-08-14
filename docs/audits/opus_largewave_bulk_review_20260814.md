# Opus Bulk Review — Grok Large Wave の独立 red-team と是正

生成日: 2026-08-14
レビュー範囲: `3ebab0449ad63cec912b192142c8f61eab5da1fa` → `6f79716bda88b559e488ffcb16ad6ca9df35f0df`（48ファイル・+22,364/−62）
方針: Grok / Luna の自己申告を正しい前提として使わず、差分と成果物を実データで検証する。

---

## 0. 一言でいうと

このwaveは **gate blocker を 28 → 14 に、open exclusion を 9 → 2 に減らしたが、その大部分は新しい測定を伴っていなかった**。
台帳を動かしたのは `scripts/_update_registry_large_wave_20260814.mjs` で、これは成果物を一切検査せず
`patch(tasks,'SP-XXX',{status:...})` を並べただけのスクリプトだった（`existsSync` も件数確認も閾値も無い）。

同時に、**私（Opus）が前のwaveで作った SP-100 にも2つの独立した欠陥**が見つかった。
片方は provenance 汚染（owner訂正で判明）、もう片方はそれとは無関係な統計設計の誤りである。

是正後の状態:

```text
gate task blockers      14 → 27
gate exclusion blockers  2 → 7
回帰テスト             188 PASS / 0 FAIL
registry QA            PASS（新しい中身検査つき）
```

**blocker が増えたのは後退ではない。** 測定を伴わない前進を取り消した結果であり、
Speed Gate が実際にどれだけ遠いかを正直な数字へ戻したもの。

---

## 1. NPB+ provenance 事故の是正（owner mandate の本体）

### 1.1 何が起きていたか

owner訂正: **このプロジェクトが使う NPB+ アプリ／選手画面の走力系 direct measurement は「最高速度のみ」**。
にもかかわらず `data/manual/npb_plus_screens.jsonl` の `hp_to_1b_sec` が NPB+ 測定として取り込まれ、
SP-100 v1 でこう使われていた:

```text
hp_to_1b_sec
  → 符号反転して標準化 (z_h2f)
  → top_speed との相関 rPF = 0.7462           ← 「2つの平行測定の一致」として扱っていた
  → Spearman-Brown 合成信頼性 0.8547
  → latent_speed_z / confidence
  → Candidate N（N_npb_z / N_confidence）
  → Candidate F（融合の重み relN）
```

`hp_to_1b_sec` が NPB+ の測定でない以上、**「同じ構成概念を測る2つの平行測定」という前提そのものが成立しない**。
r=0.7462 も 0.8547 も、根拠を失った数字だった。

### 1.2 直した内容

| 対象 | 是正 |
|---|---|
| 分類の正本 | `configs/npb_plus_field_provenance.json` を新設。フィールドごとに `VERIFIED_NPB_PLUS` / `MISATTRIBUTED_SOURCE` / `DERIVED_PROXY` を機械可読で持つ |
| 合流点 | `src/ratings/npb_plus_provenance.mjs` を新設。**生JSONLを各自が読む形をやめ**、ここを通さないと取り出せない形にした。誤帰属フィールドを NPB+ 測定として要求すると例外で止まる |
| raw | **削除していない**。`readRawForAudit()` で明示的にだけ取れる。禁止したのは「NPB+測定として消費すること」であって値の保存ではない |
| SP-100 | `latent_speed_z` を撤去し `npb_top_speed_z`（最高速度のみ・標準化のみ）へ。reliability は数値を作らず `NOT_IDENTIFIABLE` |
| production 校正 | `configs/ratings.json` の `npb_plus_direct.models.hp_to_1b_sec`（走力への変換式）を models から外し `_removed_misattributed_20260814` へ退避 |
| production 合流点 | `src/ratings/direct_measurement.mjs` に fail-closed を追加。誤帰属フィールドの変換式が設定に戻されたら**黙って飛ばさず止める** |

### 1.3 production 側の汚染は「開いていた経路」だった

`src/ratings/direct_measurement.mjs` は同じ能力の候補を `test_r` 降順で1つだけ採る。
`top_speed_kmh`(0.762) が `hp_to_1b_sec`(0.588) より上なので**通常は選ばれない**が、
top_speed が欠測で hp だけ在る選手では hp が採用されえた。実害の有無ではなく、経路が開いていたことが問題。

### 1.4 測定信頼性は識別できない、と記録した

直接測定が1つしか無い。公表 `sample_count` / `qualified_run_count` は100人全員 null。
同一 snapshot 内の反復測定も無い。よって:

```text
npb_plus_generic_measurement_reliability = NOT_IDENTIFIABLE   （value: null）
```

**代わりの2測定を仕立てて内部信頼性を作り直さない。** 埋めるより識別不能と残す方が正しい。
再開条件（選択されていない event-level tracking が母集団規模で入手できた場合等）を config に明記した。

---

## 2. SP-100 のもう1つの欠陥 — 汚染とは無関係の統計設計の誤り

owner の指示範囲外だが、同じ成果物を作り直す過程で実測して見つけたので併せて直した。

### 2.1 exposure による縮小が、測定対象と相関していた

`full_effort_run_proxy_count`（全力走の機会数）で z を乗算縮小していた。実測（n=100）:

```text
corr(exposure_runs, z_top)   = +0.4148
corr(exposure_weight, z_top) = +0.3526
```

exposure は**測定したい能力そのものと正に相関する**（速い選手ほど全力走が多い）。
このため乗算縮小は中立でなくなる:

| | |z| の平均損失 | 平均 exposure |
|---|---|---|
| 速い群 (z>0) | 0.3905 | 30.3 |
| 遅い群 (z<0) | **0.4666** | 23.3 |

結果、**縮小後の平均が +0.0552 へ動いた**。縮小は本来 mean を動かさない操作なので、これは系統的な歪み。

さらに `top_speed` は**最大値統計**である。機会数が少ない選手は「精度が低い」のではなく
**水準が下振れする**。中心方向への縮小はこの偏りを直さず、上の非対称を上乗せするだけだった。

→ exposure は **z へ掛けず、別欄の文脈情報**にした。縮小した値が要る用途には
`rho ∈ {0.5, 0.7, 0.9}` の**感度帯**を出す（仮定であって推定ではないと明示）。

### 2.2 融合 S×N の尺度混同

共通93人での実測:

```text
S（continuous prior・階層縮小済） mean 0.0556 / sd 0.5807
N（標準化のみ）                  mean 0.0084 / sd 1.0108      比 1.741
```

生のまま `w` で混ぜると、**`w` が「どちらをどれだけ信じるか」ではなく「どちらのばらつきをどれだけ取り込むか」**になる。
署名も出ていた:

```text
生のまま       corr(S-N, S) = -0.2740   corr(S-N, N) = -0.8335
尺度を揃えた後 corr(S-N, S) = +0.3466   corr(S-N, N) = -0.3466   （対称＝健全）
percentile版   +0.3347 / -0.3325
```

→ 共通集合で尺度を揃えてから重みを掛ける形に変更し、順位空間版も併記。
自己検査（`corr(差, 各source)`）を出力へ毎回残すようにした。

### 2.3 Candidate F は単一値を作らない

融合には N 側の測定信頼性が要るが、それは `NOT_IDENTIFIABLE`。
**識別できない量を重みに使って単一の融合値を作るのは、識別できたふりをすること**なので、
`w_npb ∈ {0.25, 0.5, 0.75}` の帯として出す。`winner = NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE`。

### 2.4 門番が自己申告だった（v1）

v1 の PowerPro 漏れ検査は `const used = ['latent_speed_z', ...]` という**自分で書いた配列を自分で調べる**形で、
書き忘れれば必ず通った。v2 は (1)実行するSQL文 (2)実際に開いた入力ファイルのパス
(3)読み込んだ成果物が申告する provenance の3つを見る形にした。

### 2.5 独立検証レーンは汚染していなかった（温存の根拠）

H2F レーン（SP-007）の出所を実地確認したところ、
`data/manual/npb_speed_physical_evidence_full_20260809.json` 由来で各行が
`pacificleague.com` / `baseballking.jp` 等の source URL を持つ `VERIFIED_OTHER_SOURCE`。
誤帰属した `npb_plus_screens.hp_to_1b_sec` とは別系統。**検証軸として使い続けてよい**。

### 2.6 波及: SP-042 が静かに0件になる経路

`sp042_powerpro_stale_detector.mjs` は `latent_speed_z_unshrunk` と `confidence` を読んでいた。
v2 で両方消えたため、**filter が全件落として0件になるが成果物は生成される**（気づけない形）。
fail-closed を入れて再生成。95人比較・尺度検査健全（-0.4049 / +0.2951）。

---

## 3. NPB Enterprise DATA SPOTLIGHT 記事（2026-08-10）の評価

**別 provenance レーン `NPB_ENTERPRISE_TRACKING_ARTICLE` として保存した**（アプリ画面レーンと統合しない）。

- 保存先: `data/manual/npb_enterprise_tracking_article_20260810.json`
- 評価: `scripts/sp100_npb_enterprise_article_lane.mjs` → `outputs/derived/npb_enterprise_article_lane_20260814.json`

### 使えること（周東佑京 個人に限定）

| 事実 | 値 |
|---|---|
| 上位50件への登場回数 | **8回**（次点の選手は4回） |
| 9.17 m/s 以上の7イベント中 | **6件**が本人 |
| 最高 9.24 m/s (33.264 km/h) | **2イベント**で記録 |
| 非周東の平均 | 8.72 m/s (31.392 km/h) |
| 本人のリード平均 | 3.89 m（非周東平均 4.00 m より**短い**） |

→ **同一シーズン内で、event単位の最高速度が繰り返し集団最上位に到達している**。
アプリ側の単一値（35.0 km/h、100人中1位、z=+2.7051）が単発の外れ値である可能性を下げる。
出力は `WITHIN_SEASON_REPEATED_ELITE_MAX_SPEED` という**個人限定の文脈フラグ**であって、点数でも重みでもない。

### 使えないこと（母集団が選択標本のため）

標本は「二塁盗塁の**成功**」かつ「タイム上位50件」に条件づけられている。したがって:

- 母集団の測定信頼性は **NOT_IDENTIFIABLE**。SP-100 の判定を変えない
- 出現回数8回や 9.24 / 9.17 m/s の閾値を、**全選手共通の信頼性係数へ変換しない**
- 上位50件に居ないことは「遅い」の証拠にならない（識別できない）
- 二盗タイムは純粋な足の速さの教師値にしない（記事自身がリード・スタート・加速・スライディングの混在を明記）
- SP-061（代走の文脈レーン）へ合流させない

### アプリ値との突合

記事の最大 33.264 km/h < アプリ表示 35.0 km/h。**記事はアプリ値の重複ではなく、制限された event 集合の観測**。
集計規則が同一である証拠は無いので、2つを同じ量として平均したり差を誤差として読んだりしない。
盗塁成功率88.5%は両者一致するが、それは速度フィールドの定義が同じである証拠にはならない。

---

## 4. SP-016 — production の既定が、方針conflictを開いたまま切り替わっていた

**最も重い発見。** `configs/running_norms.json` の `speedPooling.mode = "continuous_prior"` と
`pipeline.mjs` の既定により、**すべての `appraiseCard` 呼び出しが continuous prior を使う状態**になっていた。
一方 registry は `SP-016 = PARTIAL`、除外台帳は `EX-009 = POLICY_CONFLICT_REOPEN`（gate_block=1）のまま。
文書は「candidate」と書いているのに配線は production 既定＝**fail-closed の逆**。

→ **`current_year_first_hard` へ差し戻した。** continuous_prior は `opts.poolingMode` で明示した時だけ使う候補として保持。

### 採用前に直すべき欠陥（実測）

**A-1 非単調性 — 出場を増やすと一旦リーグ平均へ寄る。**
縮小が分子だけに掛かり、分母には生の PA が入っているため、当年PAが希釈重みとしても働く。
`paHist=500` のときの総係数:

| paCur | 0 | 15 | 50 | **61** | 120 | 200 | 400 | 500 |
|---|---|---|---|---|---|---|---|---|
| 係数 | 0.9091 | 0.8413 | 0.7986 | **0.7973（最小）** | 0.8135 | 0.8440 | 0.8940 | 0.9091 |

z=+2 の選手は **当年61打席のときの方が0打席のときより表示で6.33点低く**、
約500打席まで0打席時の値に戻らない。オーナールールの逆。

**A-3 単一プール縮小との誤差が符号反転する。** 正しい形 `(n_c+λn_h)/(n_c+λn_h+κ)` と比べて
6/500 で **+18% 過小縮小**、200/500 で **−3% 過剰縮小**。PA依存の符号反転は全体の再較正では吸収できない。

**A-4 規定打席級にも履歴が残る。** 当年PA帯別の履歴重み割合（n=241）:

| 当年PA | 1–50 | 50–100 | 100–200 | 200–350 | 350–500 | ≥500 |
|---|---|---|---|---|---|---|
| 履歴の割合 | 90.6% | 73.0% | 43.2% | 34.7% | **37.1%** | **32.4%** |

源田壮亮は当年361打席で履歴 **54.8%**、+10.5点動く。
CLAUDE.md 絶対禁止「十分な current-year evidence がある選手へ過去年を自動pool」に該当。

**B λ が別母集団の中央値で較正されている。** `λ = κ/median(PA_hist) = 50/185 = 0.2703` の 185 は
「2022-2025に出場した全選手を**名前キー**で集計した n=480 の上側中央値」。
実際に適用される2025ロスター（**player_id キー**、n=260）の median は **520**。
同じ規則をその母集団で解くと λ=50/520=**0.0962**。現行値は履歴に**約2.8倍**の精度重みを与えている。

**F 採否ゲートが構成上落ちない。** mean/sd を揃えた後は恒等的に
`corr(delta, hard) ≡ −√((1−r)/2)` が成立する。予測 **−0.191108** に対し実測 **−0.191108**（完全一致）。
閾値 `|r|>0.9` が発火するには新旧が**逆相関**する必要があり、原理的に起きない。
`all_same_direction` も mean(delta)=3.7e−14 なので不可能。
さらに `done_ready` は、この保証された値と `continuous_structural_cliff = 0`（**ハードコードのリテラル**）の
AND で決まっており、**2つの定数の関数**だった。

**X-1 結合の重複行。** 2022-2025 で **15 player-season が重複**し、**1,628 PA が水増し**。
ロスター260人中10人が該当（リチャード / 野村大樹 / 廣岡大志 / 郡司裕也 / 伊藤裕季也 / 若林楽人 / 宇佐見真吾 / 秋広優人 / 川越誠司 / 後藤駿太）。
伊藤裕季也2021は同じ21打席が z=+1.51 と −1.66 の2行で入っている。
hard gate では大半が不可視だったが、continuous では `paHist` へ直接効く。

**X-2 非冪等。** `sp016_continuous_prior_apply.mjs` は `configs/ratings.json` を読んでから同じファイルを上書きする。
再実行すると control 側が新 scale で計算され、成果物を自分の値に再現できない。

**X-4 control 自体が27%で壊れている。** 260人中**71人**が `NO_CURRENT_YEAR_OBSERVATION`。
`pa>=100` のフィルタが `sufficientWeight=50` の判定より**前**に効くため、69打席の選手は
「当年が不十分」ではなく「当年が無かったこと」にされる。この群の before/after は2つの変更を同時に測っている。

### 確認できた健全性（巻き戻していない部分）

表示 scale の再導出は**本物の mean/sd 合わせ**だった。独立に再現:

```text
slope     = sd(legacyDisp)/sd(contUncal) = 15.9941/8.4699 = 1.8883315802194
intercept = 65.0345 − slope×50.0858      = −29.54411881475
交点 u*   = 49.7103   ← ロスター中心（50.0858）とほぼ一致＝モーメント合わせの署名
n = 260 も独立に再構築して一致
```

PowerPro の**個人ラベルへの再回帰ではない**（SP-046 A-1 の範囲内）。
削除された `_correlation` / `_rmse_*` は旧 n=143 の PowerPro フィットの記述で、新しい数字の横に残す方が誤りだった。

ただし**出所表記が2箇所で偽になっていた**ので直した:
- `configs/ratings.json` の `scale_calibration._script` は走力の applied 値を生んでいない → 注記を追加
- `src/cards/ability_sheet.mjs` が全能力へ一律に「パワプロ143人で中心と幅を較正済み」と刻んでいた → 設定側の記録から引く形へ（`scaleProvenance()`）

### 付随して見つけた実バグ — `poolingMode` が飾りになっていた

`poolAcrossYears` は `mode` を解決した直後に
`if (mode === 'current_year_first_hard' || opts.currentYearFirst)` と旧フラグで上書きしていた。
`pipeline` は `currentYearFirst = true` を既定で渡すため、
**`poolingMode: 'legacy_auto_pool'` を明示しても到達できない**状態だった。
`mode` を唯一の権威にし、`pipeline` 側も `currentYearFirst` / `sufficientWeight` を
`poolingMode` から導く形へ変更。回帰テストで両方向（既定=当年のみ／明示=5年）が実際に切り替わることを確認した。

---

## 5. SP-015 — 独立検証で clean。巻き戻さない

3段階で汚染を否定した。

1. **スクリプト全走査**: `hp_to_1b` の出現 **0件**。SQL の6ビュー/テーブルはいずれも `npb_plus_measurement` を参照しない
2. **入力ファイルの実値照合**: `metric = NPB_PLUS_SPRINT_SPEED_KMH` の100件が
   `npb_plus_screens.top_speed_kmh` と **100/100 完全一致**（|Δ|<1e-9）、
   `hp_to_1b_sec` と一致するものは **0/100**。値域も 29.0–35.0 km/h で秒の3–5帯は0件
3. **重みの独立再計算**: DBから作り直して configs と**完全一致**
   （infieldHit 0.300 / gdpAvoid 0.1892 / ubr 0.1892 / triple 0.1637 / advance 0.0926）

翌年再現性の項は式に無く（信頼性は季節内の二項誤差分散）、PowerPro 個人ラベルも無い。

**なお重みの合計は 0.9347 で 1.0 にならないが、これは欠陥ではない。**
`src/ratings/running.mjs` が `sum/wsum` の加重平均を動的分母で取るため、
成分が選手ごとに null になる設計上、正規化しないのが正しい。

### 記録すべき限界（巻き戻し理由ではない）

- **有効Nの過大表示**: axis6 の n=328 は player-season で、実体は **93人**（32人×5季ほか）。
  重み比は頑健だが「0.563 対 0.437」の差の確からしさは主張できない
- **temporal proximity のラベルが実態と違う**: `SAME_SEASON(=1)` と表示しているが、
  検証基準の NPB+ は全件2026 snapshot、成分は2021–2025 で**最大5年離れている**
- **結合の重複 player-season 7件**（中田翔2021ほか）。`t.ih` が片チーム分の小計なのに分母は通年で infieldHit が下振れ。約1%
- **`source_name` の過大帰属**: 3ソースを並べた複合ラベルだが実体は `top_speed_kmh` 単独。**今回の事故と同型**なので狭めること
- **コメントの文言**: `baserunning_advance.mjs` の材料採用理由が「翌年との一致 0.527」と翌年再現性の言葉で書かれている（値は不使用と実証済みだが文言を直す）

---

## 6. Grok Large Wave の完了判定 — 全数 red-team の結果

### 6.1 台帳を動かした仕組み

`scripts/_update_registry_large_wave_20260814.mjs` に**成果物の検査が一切無い**。
`existsSync` も件数確認も閾値も無く、`patch()` の羅列。
task 側の `gate_block` 列は 1 のままだが、validator は「`gate_block=1` かつ未クローズ」を数えるため、
**status を DONE にするだけで blocker が 28 → 14 に落ちた**。

### 6.2 差し戻した15件

| task | 旧→新 | 実測した列挙件数 | 差し戻しの根拠 |
|---|---|---|---|
| SP-020 | DONE→PARTIAL | 0件 | `exact_dates_found: 0` がハードコード。日付台帳は100人中34人分。成果物自身が `not_collected` と明記 |
| SP-022 | DONE→PARTIAL | 78件 | 不確かさが定数（`max(0.2, 0.35*(1.2-0.5*(sRel+nRel)))`）で **156ドロー中96件が下限0.2に張り付く**＝証拠の質が効かない |
| SP-036 | DONE→PARTIAL | 7件 | `event_id` の名前空間不一致（`yt:video:X` と `youtube:X`）で独立origin が **7→実体4件**。6/7 は選手未紐づけ、1件はゲーム挙動のジョーク |
| SP-039 | DONE→PARTIAL | 17件 | 既存ファイルの射影のみで新規データ0。**17/17 が INCONCLUSIVE のまま** `negative_finding: false` をハードコード。消費先も無い |
| SP-043 | DONE→PARTIAL | 16件 | 松山は `snf`/`stale` とも null で走力証拠ゼロ。`peers_same_pattern` は `low_pa_extremes.slice(0,8)` で「同型」ではない |
| SP-060 | DONE→PARTIAL | 1件 | 走力scouting の実データは**1件のみ** |
| SP-061 | DONE→PARTIAL | 5件 | sweep が第2ソースを取りこぼし（キー名 `source_records` を見ず0件マッチ。当該785KBに代走17件）。他3コーパスも未走査 |
| SP-062 | DONE_NEG→**NOT_STARTED** | **0件** | 384バイトが全て文字列リテラルで**データアクセス0**。「Broad recollection not opened」＝NOT_COLLECTED を negative finding として記録＝絶対禁止に該当 |
| SP-063 | DONE→PARTIAL | 10件 | 手書き対応表。親タスクの Statcast Baserunning Run Value が未マップ |
| SP-072 | DONE→**NOT_STARTED** | 0件 | 判定が `sp016_scale_artifact_check.mjs` の**ハードコード false を読み戻す循環**。SR-037 が問う「100人 vs 非100人が同一尺度か」を実際には比較していない |
| SP-074 | DONE→PARTIAL | 12件 | 検査が構成上必ず通る（S も N も z なので平均≈0・双方向は保証）。閾値 0.9 は発火しえず実測 −0.595。S=2025 と N=2026 の年ずれを認めたまま閉じている |
| SP-090 | DONE→PARTIAL | 11件 | 走査対象がハードコード11パスで、**同じwaveの成果物13件を含んでいない**。`missing_from_repo_after_this_file: []` もリテラル |
| SP-098 | DONE→PARTIAL | 24件 | **名原典彦が `status: ERROR` のまま未解決**。同定チェックが `id === 定数 || !!id` で任意のidを通す自己充足形 |
| SP-045 | （BLOCKED維持） | 0件 | 全フィールドが文字列リテラル。DBハンドルを開いて**一度も故障テーブルを問い合わせていない**。ラベルは正直だが成果物は証拠でない |
| SP-044 | （BLOCKED維持） | — | PRAGMA走査は本物。`public_roster_checked` はハードコードの主張 |

### 6.3 SP-072 の中身 — 循環に隠れていた実質

SP-072 の判定は `sp016_scale_artifact_check.mjs:129` の**リテラル `false`** を読み戻したもの。
しかも SR-037 が問うている比較を実際にはしていない。
依存ファイル側には答えがあり、**100人サブセットと非100人が逆方向に動いている**:

```text
100人サブセット   mean +0.791   sd 14.98 → 16.436 (+9.7%)
非100人(168人)    mean −0.433   sd 16.517 → 15.701 (−4.9%)
```

全体のモーメントを合わせた結果、**ばらつきがオーナーレビュー対象の集団の側へ再配分されている**。
SP-072 が報告したのは全体の before/after だけで、その平均と sd は
**新 scale がそれを再現するように作られているので構造的に一致するしかない**。

### 6.4 除外7件の closure

| EX | 判定 | 措置 |
|---|---|---|
| EX-004 | 閉じる根拠の一脚が SP-062（0レコード）、もう一脚 SP-061 は sweep 未完 | **再open** (gate=1) |
| EX-011 | generic 7件は重複計上で実体4件、6件は選手未紐づけ | **再open** (gate=1) |
| EX-013 | pairwise は実在するが、CLEARLY_SLOWER / LEAN_SLOWER が **0 なのは焦点リストが F の降順で i<j のみという作り方の帰結**（構成上0） | **再open** (gate=1) |
| EX-017 | 母数5件が、キー名不一致で第2ソース（代走17件）を0件マッチにした結果 | **再open** (gate=1) |
| EX-018 | 唯一の JSON 証拠が 0レコードの文字列リテラル。「探して分離できなかった」でなく「探していない」 | **再open** (gate=1) |
| EX-012 | 17件の実データに基づく点は確認。ただし保持した low-weight レーンに**消費先が無い** | 閉じたまま＋注記 |
| EX-016 | 実データ1件という母数を数えた上での downgrade として妥当 | 閉じたまま＋注記 |

### 6.5 直して測り直した5件 — 巻き戻しで終わらせていない

差し戻しただけでは前進がないので、原因が特定できたものはその場で直して再測定した。

**SP-061（代走の文脈レーン）— 実バグ**
コーパス選択が `.records` / `.sources` / `.items` しか見ておらず、キー名が `source_records` の
785KBファイル（代走17件を含む）を**0件マッチのまま通していた**。
任意の配列値キー・JSONL・ルート配列を受ける形へ書き直し、走査対象も列挙し直した。

```text
走査ファイル      2（実効1） → 165（一次30 + 二次135）
走査レコード      未報告      → 174,194
代走マッチ        5           → 65（一次48）
```

**選手が特定できる投稿が5件新たに出た**（岡大海・土田龍空・藤岡裕大・林琢真・鈴木大地）。
旧成果物には1件も出ていなかった。スキップした87ファイルは理由つきで列挙、
構造化された双子を持たないCSV4件は raw 出現数18件と `NOT_COLLECTED` を明記、
Grok の検索**プロンプト**側にマッチしたもの（0件）は別勘定にした。

**SP-036（generic ラベル）— 重複計上**
`event_id` の名前空間を正規化し（`yt:video:X` / `youtube:X` / `youtube:X:root` / `youtube:X:<parent>` → `youtube:X`）、
origin をコメント単位の同一性で数える形へ。

```text
origins  7 → 4     （3件が名前空間の違いで二重に数えられていた）
unique_videos 4
選手証拠として使えるもの  1件（山川穂高のみ）
```

行は削除せず、`attributed_to_player` / `likely_not_player_observation` のフラグで区別した（証拠除外の原則）。
**1件では EX-011 の「大量棄却は厳しすぎた」を支持できない**ので再判定が要る。

**SP-062（守備の追走）— 文字列リテラルを実測へ**
`sqlite_master` + `PRAGMA table_info` で **38オブジェクト / 626カラム**を走査。
キーワード一致8オブジェクト、直線追走を**分離できるものは0**
（守備文脈の列を要求する判定が `npb_plus_measurement.chase_pct` を正しく弾いた＝あれは選球の chase）。
コーパス側は8,911行の言及があるが分離条件（動作語＋計測単位）を通るものは0。

**★副産物の発見**: `outputs/derived/web_collected_measurements.json` に
**構造化された range 指標607行が既に在った**（RngR 72 / UZR 111 / UZR_1200 96 / UZR_200 15 / range_runs 313）。
これまで不可視だった。`MEASURED_POSITIVE` だが直線追走は分離しないので、走力の材料にはならない。
外部NPBトラッキングは `NOT_COLLECTED`（未取得であって「無い」ではない）。

**SP-045（故障データ）— 手打ち定数を実測へ**
旧版は `pennant_db_injury_tables: "none"` を手で書いていただけで、**DBハンドルを開いたまま一度も問い合わせていなかった**。
実測すると一致するテーブル・ビューは0、カラムも0（`(^|_)(dl|il)($|_)` で境界を切ってあるので "fielding" 等に誤爆しない）。
テキスト側は145行が故障語を含むが、**日付つき24行・部位つき6行・両方揃うものは0**。

**SP-060（スカウト評）— 1件しか数えていなかった**
31ファイル / 2,840レコードを3レーンで走査。

```text
lane A  configs/scouting.json の走力 1件（2026-100内は0）
lane B  provenance欄の scouting/draft 行 37件 + 文脈欄12件を8ファイルから抽出 → 23人（2026-100内 21人）
lane C  自由記述にスカウト評が引用されている4ファイル
被覆    1件 → 21/100人
```

**これらは EX-011 / EX-016 / EX-017 / EX-018 の母数を変える。** 再判定が要るので閉じていない
（`REASSESS_REQUIRED` / `*_REOPEN` のまま）。

### 6.6 消費先が無い問題（横断）

`sp022` / `sp036` / `sp039` / `sp060` / `sp061` / `sp062` のいずれも `src/` からも `configs/` からも**参照されていない**。
このwaveで「復活させた」レーンはすべて孤立ファイル。
`grep -rln "community|sns|grok|youtube|RATING_CONSENSUS" src/` も空で、
**community 系の証拠は機械的に点数を動かす経路を持たない**（オーナーレビューの入力レーンとしてのみ存在する）。

---

## 7. validator の強化 — 「存在すれば完了」を止めた

従来の完了判定は `existsSync && size > 0` だけだった。だから**文字列リテラルしか書いていない
0レコードの成果物で DONE を主張できた**（SP-062 / SP-045 / SP-090 が実際にそうなっていた）。

追加した規則:

- **3b 中身の検査**: `DONE_*` のタスクは、JSON/JSONL 成果物に**列挙された証拠が1件以上**あること。
  無い場合は `next_action_or_blocker` に `EVIDENCE_STATUS=MEASURED_NEGATIVE`（探して0件）の明示が要る。
  `EVIDENCE_STATUS=NOT_COLLECTED` で DONE 系を名乗ると**エラー**（取得不能を証拠不存在と混同しない）
- **3c negative finding の裏取り**: `DONE_NEGATIVE_FINDING` は成果物自身に
  `evidence_status: MEASURED_NEGATIVE` または `NOT_IDENTIFIABLE` の記録が要る

**この検査は実際に発火することを確認した**（導入直後に SP-062 を検出）。
併せて、既存の正当な negative 3件には実データを確認したうえで印を刻んだ:

| task | 印 | 実測の中身 |
|---|---|---|
| SP-006 | `MEASURED_NEGATIVE` | 標準化50m n=88 を集計した上で strict direct evidence では採用に足りないと判定 |
| SP-019 | `MEASURED_NEGATIVE` | NPB+ n=91 / 50m n=34 / T90 n=2。EX-007 決着（CI95[−0.213,−0.083] が0を含まない）、EX-006 は NOT_IDENTIFIABLE_PROVISIONAL |
| SP-052 | `NOT_IDENTIFIABLE` | The Show Live 4,671行 × PowerPro 2,972人を全数照合し、同年overlap 6人7ペア・fast band 0・holdout不可と実測 |

---

## 8. オーナー裁定が要る論点（CC側では動かしていない）

### 8.1 SP-033/034/035/075 — 判断価値ほぼ0 と、構造デッドロック

YouTube 7,145コメントの実測:

| 指標 | 件数 | 割合 |
|---|---|---|
| 選手が付いた | 313 | 4.4% |
| 自動採用 | 70 | 0.98% |
| 姓+タイトル一致による採用 | **0** | 0% |
| 速度の主張を含む | **11** | **0.15%** |
| 主張あり **かつ** 同定済み | **0** | **0%** |

唯一マップされた1件は「足が速い山川」＝皮肉の取りこぼし。採用70件の67%（47件）が2人に集中。
ボトルネックはコメント量ではなく**上流の claim 分類器**（タイトル一致した242件中31件が弱いラベルだけで弾かれている）。
X側は81行中 current-100 の査定批判が **0件**、`current_100` は行ごとに null のハードコード。

**構造デッドロック**: `NOT_COLLECTED` は DONE 系で閉じられず（validator）、
`DONE_NEGATIVE_FINDING` と書けば絶対禁止に触れる。
SP-075 は SP-033/034/035 に依存し、SP-077 は SP-075 に依存するため、
**収集経路が塞がったままだと owner review queue は構造的に到達不能**。

SR-016/017/018 の origin は「owner explicit request」なので、**CC の判断で blocker を外すのはスコープ削減にあたる。実行していない。**
推奨する決着形（前例 = `NOT_IDENTIFIABLE_PROVISIONAL_CURRENT_BEHAVIOR`）: 除外台帳へ `scope=speed_community` の行を新設し、
上の実測値を evidence として **NOT_COLLECTED を可視のまま残しつつ blocker から外す**。

### 8.2 SP-100 の production 配線

N 側の測定信頼性が識別できない以上、S と N の融合比は**仮定のまま**。
どの `w_npb` を採るか（あるいは N を配線しないか）は設計判断であってデータからは決まらない。

### 8.3 SP-016 continuous prior の採否

§4 の A-1 / A-3 / A-4 / B / X-1 / X-4 を直し、F の採否ゲートを**実際に落ちうる形**へ作り替えてから再測定する必要がある。
現状は候補として保持し、production 既定は control。

---

## 9. 触っていないもの（禁止事項の遵守）

- **SP-081 Speed Gate は閉じていない**（blocker が task 27 / 除外 7 残っている）
- **SP-082 肩力へ進んでいない**
- **SP-071 絶対尺度を確定していない**（エンジン依存が未解決）
- **owner review queue（SP-077）を生成していない**
- **raw データを1件も削除していない**（`hp_to_1b_sec` 100行、`hp_to_1b_measurements_curated.json`、Prospi raw すべて温存）

---

## 10. 検証記録

```text
node scripts/qa_speed_task_registry.mjs   → PASS
  requirements=61, tasks=72, exclusions=25, open_exclusions=7,
  unresolved_terminal=1, owner_review_task_blockers=8, owner_review_exclusion_blockers=7,
  gate_task_blockers=27, gate_exclusion_blockers=7

node scripts/test_qa_remaining.mjs        → 188 PASS / 0 FAIL
```

回帰テストは2件を書き換えた。理由は**方針が変わって主張が偽になったから**であって、通すためではない:

- `§走力複数年ログ-b`「既定で複数年が使われる」→ 既定が current-year 中心に戻ったので偽。
  「既定では当年に閉じる」＋「明示すれば複数年が使われる（`§-c` 新設）」の2本にした
- `§窓-d`「既定では対象年より後が混ざる」→ 既定経路では**漏れが方針で閉じた**ので偽。
  「既定では後年ゼロ」に変え、maxSeason の機構は多年pool を明示した経路（`§窓-d2` 新設）で確かめる形にした

どちらも**主張を弱めておらず、テスト本数は 186 → 188 に増えている**。

前 wave が「full regression PASS」と報告していたが、その時点の base 版テストを現コードに当てると
`§走塁材料-c` と `§走塁材料-e` の2件が FAIL する（SP-018 / SP-015 が先に入っていたのにテストが旧挙動を主張していた）。
Grok がこの2件を書き換えたのは**陳腐化の修理として妥当**だったが、
「PASS」という受領書と実際の状態は一致していなかった。

# SP-042 — PowerPro stale/inertia detector（Prospi非依存版）

生成日: 2026-08-14
状態: **設計確定・実装済み。疑いの入口としてのみ使う（自動補正しない）**

## 1. 前提が変わった

旧設計は **Prospi との同時点比較**を前提にしていた。
2026-08-14 のオーナー裁定で Prospi A（スマホアプリ版）は査定として比較適格でないと確定し、
SP-054/055/056 が SUPERSEDED になったため、**この前提は失効**した。

代わりに **SP-100 の PowerPro非依存 latent physical speed** が使えるようになったので、
独立参照をそちらへ置き換えた。結果として **PowerPro を教師にせず**に stale を疑える。

## 2. 尺度差の罠を踏まない設計

PowerPro素点と `latent_speed_z` は**別の尺度**。生の差を取ると SP-056 と同じ失敗
（`corr(diff, powerpro) = −0.945` ＝ 乖離が片方の値で決まる）になる。

→ **両方を percentile へ写してから比較する。** 順位空間なら尺度差は原理的に消える。

**再発防止の自己検査を実装に組み込んだ**:

```text
corr(gap, powerpro_pct) = −0.3875
corr(gap, latent_pct)   = +0.2533
```

どちらも ±1 から遠い＝percentile空間での比較は健全。
（SP-056 の −0.945 と対照的。|r| が1に近ければ設計ミスの徴候として気付ける）

## 3. 2つの signal を**合成せずに**出す

原因が違うので1つの点数にまとめない。

| signal | 内容 | 根拠 |
|---|---|---|
| **S1 内部inertia** | 素点が一度も動いていないのにリーグ内 percentile が動いた | SP-041実測。**据え置き年数だけでstale判定は不可**と実証済み（パネル全体で129人） |
| **S2 外部不一致** | PowerPro percentile と latent physical percentile の乖離が平均から1.5SD以上 | SP-100（PowerPro非依存） |

## 4. 結果（95人を比較）

| flag | 人数 |
|---|---|
| NONE | 77 |
| EXTERNAL_DISAGREEMENT_ONLY | 11 |
| INTERNAL_INERTIA_ONLY | 5 |
| **BOTH** | **2** |

### PowerPro が物理より低く見ている（正のgap）＝ stale の典型

| 選手 | PP pct | 物理 pct | gap | 素点（変更回数/年数） | flag |
|---|---|---|---|---|---|
| **古賀 優大** | 0.12 | 0.68 | **+0.56** | 46（**変更0回 / 10年**） | EXTERNAL |
| **郡司 裕也** | 0.37 | 0.76 | +0.39 | 61（**変更0回 / 7年**） | **BOTH** |
| 福永 裕基 | 0.46 | 0.80 | +0.34 | 64（変更0回 / 4年） | EXTERNAL |
| 長岡 秀樹 | 0.29 | 0.63 | +0.33 | 58（変更1回 / 7年） | EXTERNAL |
| **細川 成也** | 0.34 | 0.65 | +0.30 | 60（**変更0回 / 10年**） | **BOTH** |

**「素点が10年間一度も動いていない」＋「物理証拠とのpercentile差が大きい」**が最も強い stale 徴候。
古賀優大・細川成也がその典型。

### PowerPro が物理より高く見ている（負のgap）

| 選手 | PP pct | 物理 pct | gap | 素点 |
|---|---|---|---|---|
| カリステ | 0.86 | 0.21 | −0.65 | 82（変更0回 / 4年） |
| 矢野 雅哉 | 0.80 | 0.34 | −0.46 | 78 |
| 塩見 泰隆 | 0.88 | 0.48 | −0.39 | 83 |

## 5. 使い方の境界（SP-046 遵守）

- **疑いの入口としてのみ**使う（A-2）。**解消は他の証拠で行う**
- **player-level teacher にしない**（B-1）。PowerProの値を正解として当てにいかない
- **自動補正しない**。flag は owner review の入力であって、点数の書き換えではない
- 物理側の confidence が低い選手（exposure が少ない）は gap が過大に出うる。
  `latent_confidence` と `exposure_runs` を各行に併記してあるので、
  review 時に信頼度で絞れる（例: 塩見泰隆は AB=0 で exposure が小さい）

## 6. 成果物

- `scripts/sp042_powerpro_stale_detector.mjs`
- `outputs/derived/sp042_powerpro_stale_detector.json`

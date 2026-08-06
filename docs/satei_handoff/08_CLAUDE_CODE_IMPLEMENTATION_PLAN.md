# Claude Code 実装計画

---

## 1. 推奨リポジトリ構成

```text
pawapuro-satei/
├─ README.md
├─ pyproject.toml
├─ configs/
│  ├─ reference_2019.yml
│  ├─ calibration_provisional.yml
│  ├─ source_priority.yml
│  └─ game_versions.yml
├─ data/
│  ├─ raw/
│  ├─ normalized/
│  ├─ derived/
│  ├─ konami/
│  └─ provenance/
├─ docs/
│  ├─ spec/
│  ├─ case_studies/
│  └─ methodology/
├─ src/pawapuro_satei/
│  ├─ schemas.py
│  ├─ validation.py
│  ├─ provenance.py
│  ├─ environment.py
│  ├─ priors.py
│  ├─ shrinkage.py
│  ├─ batting/
│  │  ├─ context.py
│  │  ├─ meat.py
│  │  ├─ power.py
│  │  ├─ trajectory.py
│  │  └─ abilities.py
│  ├─ running/
│  │  ├─ speed.py
│  │  ├─ stealing.py
│  │  └─ baserunning.py
│  ├─ defense/
│  │  ├─ range.py
│  │  ├─ catching.py
│  │  ├─ arm.py
│  │  └─ catcher.py
│  ├─ cards/
│  │  ├─ peak_year.py
│  │  └─ prime_composite.py
│  ├─ comparison/
│  │  ├─ blind_freeze.py
│  │  └─ konami.py
│  └─ reporting/
│     ├─ markdown.py
│     └─ audit_log.py
├─ tests/
│  ├─ unit/
│  ├─ regression/
│  ├─ property/
│  └─ fixtures/
└─ outputs/
   ├─ calculations/
   ├─ reports/
   └─ frozen/
```

---

## 2. 技術方針

- Python 3.12+
- Pydanticでスキーマ
- pandasまたはpolars
- pytest
- YAML設定
- DuckDB/Parquetを推奨
- 全計算はpure functionを基本
- Notebookだけにロジックを置かない

---

## 3. 実装優先順位

### Step 1: スキーマと検算

- PlayerCard
- BattingLine
- SplitLine
- LeagueEnvironment
- Provenance
- RatingOutput
- AdjustmentLedger

入力不整合を拒否する。

### Step 2: 436.25換算

```python
def hr_500pa_equivalent(hr: int, ab: int, ab_ref: float = 436.25) -> float:
    ...
```

PA=500を掛けないテスト。

### Step 3: 文脈選択

- Tier A/B/C
- 完全クロスがない場合に推定しない
- 信頼度タグ

### Step 4: 環境補正

- 文脈一致
- 2019基準
- 球場・リーグ
- 設定値感度

### Step 5: Prior/縮小

Prior provider interface:

```python
class PriorProvider(Protocol):
    def get_meat_prior(...): ...
    def get_power_prior(...): ...
```

- proven veteran injury
- rookie
- platoon
- no-history
- historical short season

### Step 6: M/P変換

- piecewise linear
- monotonic
- no overlapping bins
- config-driven

### Step 7: Adjustment Ledger

全調整を一行ずつ記録。

```python
ledger.add(
    component="strikeout_red",
    delta=...,
    reason=...,
    source=...,
    provisional=True,
)
```

### Step 8: 走守

まずデータ構造と分離だけ実装。係数は設定ファイル。

### Step 9: レポート

各選手に:

- input
- formulas
- intermediate
- confidence
- final
- unresolved

をMarkdown生成。

### Step 10: Blind freeze

独自結果JSONのSHA256を保存してからKONAMIを読み込む。

---

## 4. 校正プログラム

### 4.1 M/P相互作用

パワプロ内シミュレーションが可能なら、能力組合せのグリッドを作る。

```text
M: 20〜100
P: 20〜100
得能セット
投手能力固定
球場固定
打席数大
```

測定:

- AVG
- BABIP
- HR
- SLG
- K
- 打球タイプ

### 4.2 得能寄与

一つずつオン/オフ。

- AH
- PH
- 広角
- プル
- 流し
- 内野安打
- チャンス
- 対左
- 三振
- 盗塁
- 走塁

基礎能力との交互作用も測る。

### 4.3 外野守備

走力×守備力グリッドで同一打球セット。

### 4.4 内野守備

走力×守備力で左右・前後・併殺を測る。

### 4.5 捕手

肩×送球×守備力でPop/阻止率相当を測る。

---

## 5. 係数管理

未校正値は:

```yaml
status: provisional
value:
source:
rationale:
sensitivity_range:
calibration_task:
```

として保存。

コードへマジックナンバーを埋め込まない。

---

## 6. データ収集

### 一次情報

- NPB公式
- MLB公式
- Baseball Savant
- 球団公式
- 侍ジャパン公式

### 高度指標

- DELTA
- FanGraphs
- Baseball-Reference
- Statcast

### 分割補完

- NF3
- Baseball Data

### KONAMI

- 公式データ
- 信頼できる能力データベース
- 作品・更新版を必ず記録

---

## 7. 最初に実装するケース

### Regression 1: 野間2018

検証:

- 走力と盗塁分離
- 赤得能込みミート
- 内野安打分離
- 外野走力補正
- KONAMI全得能比較

### Regression 2: バティスタ2018

- 436.25換算
- 302PA
- 限定起用Prior
- 対右低打率
- 高P/M相互作用

### Regression 3: 石原2016

- 低ミート域
- 非力野手P校正
- 捕手阻止
- 一軍下限を使わない

### Regression 4: 西川2018

- 失策は捕球
- 送球分類
- 守備力を失策で直接下げない

### Regression 5: 松山2017

- 外野主位置
- 鈍足外野の守備力逆算

---

## 8. WBC作業

1. ロースターfixtureを作る。
2. 野手15人の年度候補データを収集。
3. peak year selection reportを生成。
4. ユーザー承認または規則で凍結。
5. 野手v2.0計算。
6. 投手モデルを別ブランチで開発。
7. 28人完成後にKONAMI比較。

---

## 9. Git運用

ブランチ例:

```text
spec/v2-data-contract
feature/batting-engine
feature/defense-calibration
case/carp-golden-era
case/wbc2017-prime
```

能力値を比較前に:

```text
git commit
sha256sum output.json
```

で凍結。

---

## 10. 完了定義

コードが動くだけでは不可。

- すべての値にProvenance
- 自動テスト
- 途中式レポート
- 未校正値の明示
- 過去ケース回帰
- 手調整の記録
- KONAMI blind freeze
- 同入力で同結果

を満たすこと。

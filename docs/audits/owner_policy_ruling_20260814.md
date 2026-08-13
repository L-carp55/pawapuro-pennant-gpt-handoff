# オーナー最終policy裁定（2026-08-14）— review branch反映記録

作成日: 2026-08-14
反映先: `review/grok-medium-batch-20260813`
性格: **裁定の記録と反映のみ。新しい分析へは広げていない**

---

## 1. Prospi

**裁定**: 収集済みProspiは全て **Prospi A（スマホアプリ版）** であり、PowerPro stale/odd QA には
使用しない。raw は保持する。コンソール版ProspiはPowerProとほぼ同等で独立情報にならないため
**追加収集しない**。SR-027/028/029 の実行前提を supersede する。

**反映**:

- `SR-059` を **append-only** で追加（既存行は1行も書き換えていない）
- `SP-054` / `SP-055` / `SP-056` → **`SUPERSEDED`**
  （`BLOCKED_MISSING_DATA` にはしない＝データ待ちではなく、方針として使わない判断のため）
- 各 task の `requirement_ids` に `SR-059` を併記し、supersede の関係を機械可読にした
- raw（`speed_prospi_gamex_*_run3.csv` 等425行）は削除していない

## 2. The Show

**裁定**: **cross-time numeric bridge は許可しない**。年度査定の current-year 原則と、
加齢・故障・移籍による temporal confounding 回避のため。

**反映**:

- `SR-060` を append-only で追加
- `SP-052` = **`DONE_NEGATIVE_FINDING` 維持**（same-time は母集団の構造上成立せず。
  overlap 6人/7ペア・fast band 0・player holdout 不可）
- `SP-053` = **`SUPERSEDED`**（前提の validated numeric mapping は same-time が成立せず
  cross-time も不採用となったため今後も生成されない）
- **The Show raw / context evidence 自体は残す**
- `EX-014` → **`VALID_NUMERIC_EXCLUSION`** へ更新。
  「利用全体の除外」ではなく **数値変換経路としてのThe Showのみ**を閉じる、と明記

## 3. SP-046 / SP-099

**裁定**:

- SP-099 の **scale-mixing bug 修理そのものは承認**
- ただし Q4「`statPrimarySpeed=false` を production 維持。direct weight 76% を捨てる損失が大きい」は
  **final policy としては承認しない**

**理由（オーナー指摘）**: `scripts/calibrate_npb_plus_direct.mjs` が示すとおり、
NPB+ `direct.value` の slope/intercept および `test_r` は **PowerPro 個人ラベルを教師に**
作られている。したがってこれは **純粋な physical direct weight ではない**。

**反映（`SP-046` へ policy として明記）**:

| 対象 | 判定 |
|---|---|
| PowerPro-mapped NPB+ direct path | **legacy / provisional diagnostic に限定**（SR-007 / SR-010） |
| `applyScale` | `slope = sd(PowerPro)/sd(internal)`、`intercept = mean(PowerPro) − slope*mean(internal)` の **global center/width display calibration** であり個人ラベルを使っていない → **SP-071 まで provisional に利用可** |
| PowerPro の使用禁止範囲 | **player-level teacher / component selection / weight / shrinkage には使用しない** |

## 4. 新規task `SP-100`

**`PowerPro-free NPB+ raw speed integration into latent speed`** を
**owner blocker かつ gate blocker** として起票（`SR-010` / `SR-061`）。

設計方針:

- NPB+ raw は保持し、次の4点から latent speed へ統合する
  1. same-time physical construct
  2. measurement reliability
  3. exposure / sample error
  4. temporal proximity
- **PowerPro ラベルおよび翌年再現性を weight や採否に使わない**
- **legacy / control 用の blend 実装は削除しない**（比較対照として保持）

**SP-079 への接続**: 本 task 完成まで final practical reappraisal で
**PowerPro-mapped NPB+ blend を final 値として使用しない**。
`SP-079` の `depends_on` へ `SP-100` を追加し、`next_action_or_blocker` にも明示した。

## 5. SP-071

absolute 0–100 scale finalization は **今回行わない**。engine dependency
（`T-0076` 能力値→engine走力効果の橋）のまま維持。

---

## 反映しなかったもの（スコープ遵守）

- 新しいデータ収集・Community作業・肩力には進んでいない
- requirements baseline の**既存行は1行も書き換えていない**（append-only）
- The Show / Prospi の raw は一切削除していない
- SP-099 の修理コードはそのまま（承認済み）。`statPrimarySpeed` の既定も変更していない
  ——Q4は「final policy として承認しない」であり、暫定の production 既定を今変えろという
  指示ではないため。恒久解は SP-100

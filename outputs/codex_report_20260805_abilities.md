# 得能3種の配線とパワー補助指標の実測報告

- 対象コミット: `b700ab24bd87198fb272b0541ebb6fb7f85e0f73`
- 状態: 作業中

## 項目1: 得能3種のカード生成への配線

### 何をしたか

- `src/cards/pipeline.mjs` から `strikeoutAbility`、`infieldHitAbility`、`goldSpecialAbilities` を呼び、`src/cards/ability_sheet.mjs` の得能欄へ渡した。
- 三振系は査定済みコンタクト値、内野安打○は `nf3_team_bat.ih` の内野安打率から同年・同打席の平均を引いた超過分、金特は2006-2025年の環境補正済み歴代分布を入力にした。
- 非該当時は空配列や `null` のキーを出さず、得能キー自体を省略する回帰テストを追加した。
- 金特分布は `scripts/build_gold_historical_distribution.mjs` で再生成可能にし、`outputs/derived/gold_historical_distribution.json` へ保存した。

### 触ったファイル（相対パス）

- `configs/ratings.json`
- `src/cards/pipeline.mjs`
- `src/cards/ability_sheet.mjs`
- `scripts/build_gold_historical_distribution.mjs`
- `scripts/test_ability_sheet.mjs`
- `scripts/build_card.mjs`
- `outputs/derived/gold_historical_distribution.json`
- `outputs/cards_batch_all_peak.md`
- `outputs/cards/*.json`（今回生成・更新29ファイル。実出力確認用）

### 実測数値

- 金特分布: 2006-2025年の全6,621打者年を読み取り、少打数の偶然を除く既存下限 `AB>=200` の2,186打者年で算出。
  - `hrPer500`: p99.5 = 48.550415、p99.9 = 53.499501、最大 = 72.656484（Ｗ．バレンティン2013）
  - `avgEnv`: p99.5 = 0.342496、p99.9 = 0.358019、最大 = 0.361981（柳田悠岐2015）
- 内野安打○のDB全体確認: 2020-2025年・200打数以上で入力が揃う634打者年中、既存閾値を満たすのは13打者年。
- 実カード29ファイルの付与件数:
  - 三振系 7件（`三振` 4件、`選球眼` 3件）
  - `内野安打○` 1件（野村勇2025）
  - 金特 4件（`アーチスト` 2件、`安打製造機` 2件）
- 能力欄の局所回帰テスト: 20 PASS / 0 FAIL。

### 未解決点

- `special_abilities.infield_hit` の閾値・走力係数・ミート調整幅は既存設定どおり PROVISIONAL。今回は根拠なく変更せず、配線と実データ入力だけを行った。
- 回帰テスト一式の総数は全項目完了後に実行・追記する。

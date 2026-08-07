# 2025 追加進塁PBP再構築監査

日付: 2026-08-07

判定: **PASS_FOR_MULTIYEAR_REBUILD**

## 入力・安全規律

- source: Nippon Baseball Data Repository / GitHub Release `pbp`
- raw PBPは一時ディレクトリへ取得し、repositoryへcommitしない。
- repositoryの`data/pennant.db`は変更しない。一時SQLiteだけへ再構築する。
- 打球直前状態は打席内の実投球列を追跡し、説明文の明示塁配置とhybrid runner identityを保守的にreconcileする。
- identity/配置が一意でないケースは除外し、0や推定値で埋めない。

## 再構築結果

| 指標 | 値 |
|---|---:|
| 確定可能イベント | 3,670 |
| 走者 | 320 |
| uncertain current除外 | 11 |
| uncertain next除外 | 0 |
| 明示配置reconcile成功 | 4802 |
| 明示配置reconcile不確定 | 13 |
| 明示配置なしpitch | 241898 |

| event | n | success | ambiguity excluded |
|---|---:|---:|---:|
| 単打 一→三 | 1964 | 24% | 11 |
| 単打 二→本 | 1324 | 43.1% | 20 |
| 二塁打 一→本 | 382 | 36.9% | 7 |

## 独立ラベル監査

| 指標 | 件数 | 率 |
|---|---:|---:|
| 説明文から開始塁を読めた | 1052 | 28.66% |
| 開始塁の明確な不一致 | 0 | 0.00% |
| successを独立再判定できた | 940 | 25.61% |
| 保存successとの矛盾 | 0 | 0.00% |

## 受入基準

- 開始塁の明確な不一致 <= 1.0%
- success矛盾 <= 0.5%
- 条件を満たすまではplayer-specific走塁responseの較正に使わない。

## raw command output

<details><summary>builder</summary>

```text
走塁の確定可能な機会: 3,670件
型ごとの成功率:
  単打で一塁→三塁               1964件  成功 24.0%  判定不能除外 11
  単打で二塁→生還               1324件  成功 43.1%  判定不能除外 20
  二塁打で一塁→生還               382件  成功 36.9%  判定不能除外 7
  走者 320人
  seasons 2025
  non-pitch state exclusions current=186 next=201
  uncertain state exclusions current=11 next=0
  reconciliation explicitResolved=4802 explicitUncertain=13 noPattern=241898
  outcome labels explicit=1103 nextState=2567 explicitVsStateDisagreement=9
  regular-season rows 2025:351751
  mode WRITE /tmp/pawapuro-baserunning-2025-5FNfqS/rebuilt_2025.sqlite

注意: 旧baserunning_advancesは再利用しない。上記生データから再構築後に較正をやり直すこと。
出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)
```
</details>

<details><summary>label audit</summary>

```text
# 追加進塁イベント 状態整合監査（説明文明示ケース）
db=/tmp/pawapuro-baserunning-2025-5FNfqS/rebuilt_2025.sqlite
total=3670
開始塁を明示文から読めた: 1052 (28.66%)
開始塁の明確な不一致: 0 (0.00%)
終了塁からsuccessを明確に再判定できた: 940 (25.61%)
そのうち保存successと矛盾: 0 (0.00%)

| kind | events | success% | parsed start | bad start | parsed outcome | contradiction |
|---|---:|---:|---:|---:|---:|---:|
| 1st_to_3rd | 1964 | 23.98% | 0 | 0 (—) | 0 | 0 (—) |
| 1st_to_home_on_2b | 382 | 36.91% | 0 | 0 (—) | 0 | 0 (—) |
| 2nd_to_home | 1324 | 43.13% | 1052 | 0 (0.00%) | 940 | 0 (0.00%) |

## 開始塁が kind と矛盾する例

## 終了塁から見た success 矛盾の例
```
</details>

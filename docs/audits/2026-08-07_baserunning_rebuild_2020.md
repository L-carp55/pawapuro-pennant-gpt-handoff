# 2020 追加進塁PBP再構築監査

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
| 確定可能イベント | 3,003 |
| 走者 | 304 |
| uncertain current除外 | 6 |
| uncertain next除外 | 0 |
| 明示配置reconcile成功 | 4373 |
| 明示配置reconcile不確定 | 10 |
| 明示配置なしpitch | 216273 |

| event | n | success | ambiguity excluded |
|---|---:|---:|---:|
| 単打 一→三 | 1520 | 35.1% | 9 |
| 単打 二→本 | 1124 | 57% | 21 |
| 二塁打 一→本 | 359 | 40.1% | 11 |

## 独立ラベル監査

| 指標 | 件数 | 率 |
|---|---:|---:|
| 説明文から開始塁を読めた | 860 | 28.64% |
| 開始塁の明確な不一致 | 0 | 0.00% |
| successを独立再判定できた | 739 | 24.61% |
| 保存successとの矛盾 | 0 | 0.00% |

## 受入基準

- 開始塁の明確な不一致 <= 1.0%
- success矛盾 <= 0.5%
- 条件を満たすまではplayer-specific走塁responseの較正に使わない。

## raw command output

<details><summary>builder</summary>

```text
走塁の確定可能な機会: 3,003件
型ごとの成功率:
  単打で一塁→三塁               1520件  成功 35.1%  判定不能除外 9
  単打で二塁→生還               1124件  成功 57.0%  判定不能除外 21
  二塁打で一塁→生還               359件  成功 40.1%  判定不能除外 11
  走者 304人
  seasons 2020
  non-pitch state exclusions current=156 next=160
  uncertain state exclusions current=6 next=0
  reconciliation explicitResolved=4373 explicitUncertain=10 noPattern=216273
  outcome labels explicit=920 nextState=2083 explicitVsStateDisagreement=3
  regular-season rows 2020:310531
  mode WRITE /tmp/pawapuro-baserunning-2020-QP73s3/rebuilt_2020.sqlite

注意: 旧baserunning_advancesは再利用しない。上記生データから再構築後に較正をやり直すこと。
出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)
```
</details>

<details><summary>label audit</summary>

```text
# 追加進塁イベント 状態整合監査（説明文明示ケース）
db=/tmp/pawapuro-baserunning-2020-QP73s3/rebuilt_2020.sqlite
total=3003
開始塁を明示文から読めた: 860 (28.64%)
開始塁の明確な不一致: 0 (0.00%)
終了塁からsuccessを明確に再判定できた: 739 (24.61%)
そのうち保存successと矛盾: 0 (0.00%)

| kind | events | success% | parsed start | bad start | parsed outcome | contradiction |
|---|---:|---:|---:|---:|---:|---:|
| 1st_to_3rd | 1520 | 35.13% | 0 | 0 (—) | 0 | 0 (—) |
| 1st_to_home_on_2b | 359 | 40.11% | 0 | 0 (—) | 0 | 0 (—) |
| 2nd_to_home | 1124 | 57.03% | 860 | 0 (0.00%) | 739 | 0 (0.00%) |

## 開始塁が kind と矛盾する例

## 終了塁から見た success 矛盾の例
```
</details>

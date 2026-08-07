# 2022 追加進塁PBP再構築監査

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
| 確定可能イベント | 3,430 |
| 走者 | 326 |
| uncertain current除外 | 11 |
| uncertain next除外 | 0 |
| 明示配置reconcile成功 | 4686 |
| 明示配置reconcile不確定 | 15 |
| 明示配置なしpitch | 245528 |

| event | n | success | ambiguity excluded |
|---|---:|---:|---:|
| 単打 一→三 | 1822 | 31.5% | 18 |
| 単打 二→本 | 1210 | 50% | 20 |
| 二塁打 一→本 | 398 | 41% | 14 |

## 独立ラベル監査

| 指標 | 件数 | 率 |
|---|---:|---:|
| 説明文から開始塁を読めた | 935 | 27.26% |
| 開始塁の明確な不一致 | 0 | 0.00% |
| successを独立再判定できた | 789 | 23.00% |
| 保存successとの矛盾 | 0 | 0.00% |

## 受入基準

- 開始塁の明確な不一致 <= 1.0%
- success矛盾 <= 0.5%
- 条件を満たすまではplayer-specific走塁responseの較正に使わない。

## raw command output

<details><summary>builder</summary>

```text
走塁の確定可能な機会: 3,430件
型ごとの成功率:
  単打で一塁→三塁               1822件  成功 31.5%  判定不能除外 18
  単打で二塁→生還               1210件  成功 50.0%  判定不能除外 20
  二塁打で一塁→生還               398件  成功 41.0%  判定不能除外 14
  走者 326人
  seasons 2022
  non-pitch state exclusions current=192 next=202
  uncertain state exclusions current=11 next=0
  reconciliation explicitResolved=4686 explicitUncertain=15 noPattern=245528
  outcome labels explicit=953 nextState=2477 explicitVsStateDisagreement=2
  regular-season rows 2022:355856
  mode WRITE /tmp/pawapuro-baserunning-2022-MMGKgl/rebuilt_2022.sqlite

注意: 旧baserunning_advancesは再利用しない。上記生データから再構築後に較正をやり直すこと。
出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)
```
</details>

<details><summary>label audit</summary>

```text
# 追加進塁イベント 状態整合監査（説明文明示ケース）
db=/tmp/pawapuro-baserunning-2022-MMGKgl/rebuilt_2022.sqlite
total=3430
開始塁を明示文から読めた: 935 (27.26%)
開始塁の明確な不一致: 0 (0.00%)
終了塁からsuccessを明確に再判定できた: 789 (23.00%)
そのうち保存successと矛盾: 0 (0.00%)

| kind | events | success% | parsed start | bad start | parsed outcome | contradiction |
|---|---:|---:|---:|---:|---:|---:|
| 1st_to_3rd | 1822 | 31.50% | 0 | 0 (—) | 0 | 0 (—) |
| 1st_to_home_on_2b | 398 | 40.95% | 0 | 0 (—) | 0 | 0 (—) |
| 2nd_to_home | 1210 | 50.00% | 935 | 0 (0.00%) | 789 | 0 (0.00%) |

## 開始塁が kind と矛盾する例

## 終了塁から見た success 矛盾の例
```
</details>

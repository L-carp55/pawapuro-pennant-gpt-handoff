# 2023 追加進塁PBP再構築監査

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
| 確定可能イベント | 3,542 |
| 走者 | 322 |
| uncertain current除外 | 4 |
| uncertain next除外 | 0 |
| 明示配置reconcile成功 | 4705 |
| 明示配置reconcile不確定 | 7 |
| 明示配置なしpitch | 242490 |

| event | n | success | ambiguity excluded |
|---|---:|---:|---:|
| 単打 一→三 | 1842 | 30.7% | 10 |
| 単打 二→本 | 1291 | 50.7% | 21 |
| 二塁打 一→本 | 409 | 37.9% | 4 |

## 独立ラベル監査

| 指標 | 件数 | 率 |
|---|---:|---:|
| 説明文から開始塁を読めた | 976 | 27.56% |
| 開始塁の明確な不一致 | 0 | 0.00% |
| successを独立再判定できた | 843 | 23.80% |
| 保存successとの矛盾 | 0 | 0.00% |

## 受入基準

- 開始塁の明確な不一致 <= 1.0%
- success矛盾 <= 0.5%
- 条件を満たすまではplayer-specific走塁responseの較正に使わない。

## raw command output

<details><summary>builder</summary>

```text
走塁の確定可能な機会: 3,542件
型ごとの成功率:
  単打で一塁→三塁               1842件  成功 30.7%  判定不能除外 10
  単打で二塁→生還               1291件  成功 50.7%  判定不能除外 21
  二塁打で一塁→生還               409件  成功 37.9%  判定不能除外 4
  走者 322人
  seasons 2023
  non-pitch state exclusions current=143 next=150
  uncertain state exclusions current=4 next=0
  reconciliation explicitResolved=4705 explicitUncertain=7 noPattern=242490
  outcome labels explicit=1027 nextState=2515 explicitVsStateDisagreement=3
  regular-season rows 2023:350953
  mode WRITE /tmp/pawapuro-baserunning-2023-ekKck7/rebuilt_2023.sqlite

注意: 旧baserunning_advancesは再利用しない。上記生データから再構築後に較正をやり直すこと。
出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)
```
</details>

<details><summary>label audit</summary>

```text
# 追加進塁イベント 状態整合監査（説明文明示ケース）
db=/tmp/pawapuro-baserunning-2023-ekKck7/rebuilt_2023.sqlite
total=3542
開始塁を明示文から読めた: 976 (27.56%)
開始塁の明確な不一致: 0 (0.00%)
終了塁からsuccessを明確に再判定できた: 843 (23.80%)
そのうち保存successと矛盾: 0 (0.00%)

| kind | events | success% | parsed start | bad start | parsed outcome | contradiction |
|---|---:|---:|---:|---:|---:|---:|
| 1st_to_3rd | 1842 | 30.67% | 0 | 0 (—) | 0 | 0 (—) |
| 1st_to_home_on_2b | 409 | 37.90% | 0 | 0 (—) | 0 | 0 (—) |
| 2nd_to_home | 1291 | 50.66% | 976 | 0 (0.00%) | 843 | 0 (0.00%) |

## 開始塁が kind と矛盾する例

## 終了塁から見た success 矛盾の例
```
</details>

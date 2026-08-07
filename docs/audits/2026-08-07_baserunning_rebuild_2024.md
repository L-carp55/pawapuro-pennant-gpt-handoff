# 2024 追加進塁PBP再構築監査

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
| 確定可能イベント | 3,620 |
| 走者 | 322 |
| uncertain current除外 | 4 |
| uncertain next除外 | 0 |
| 明示配置reconcile成功 | 4758 |
| 明示配置reconcile不確定 | 5 |
| 明示配置なしpitch | 240487 |

| event | n | success | ambiguity excluded |
|---|---:|---:|---:|
| 単打 一→三 | 1887 | 28.4% | 20 |
| 単打 二→本 | 1338 | 48.4% | 25 |
| 二塁打 一→本 | 395 | 37.2% | 10 |

## 独立ラベル監査

| 指標 | 件数 | 率 |
|---|---:|---:|
| 説明文から開始塁を読めた | 1033 | 28.54% |
| 開始塁の明確な不一致 | 0 | 0.00% |
| successを独立再判定できた | 902 | 24.92% |
| 保存successとの矛盾 | 3 | 0.33% |

## 受入基準

- 開始塁の明確な不一致 <= 1.0%
- success矛盾 <= 0.5%
- 条件を満たすまではplayer-specific走塁responseの較正に使わない。

## raw command output

<details><summary>builder</summary>

```text
走塁の確定可能な機会: 3,620件
型ごとの成功率:
  単打で一塁→三塁               1887件  成功 28.4%  判定不能除外 20
  単打で二塁→生還               1338件  成功 48.4%  判定不能除外 25
  二塁打で一塁→生還               395件  成功 37.2%  判定不能除外 10
  走者 322人
  seasons 2024
  non-pitch state exclusions current=183 next=205
  uncertain state exclusions current=4 next=0
  reconciliation explicitResolved=4758 explicitUncertain=5 noPattern=240487
  regular-season rows 2024:348685
  mode WRITE /tmp/pawapuro-baserunning-2024-JPJXJ6/rebuilt_2024.sqlite

注意: 旧baserunning_advancesは再利用しない。上記生データから再構築後に較正をやり直すこと。
出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)
```
</details>

<details><summary>label audit</summary>

```text
# 追加進塁イベント 状態整合監査（説明文明示ケース）
db=/tmp/pawapuro-baserunning-2024-JPJXJ6/rebuilt_2024.sqlite
total=3620
開始塁を明示文から読めた: 1033 (28.54%)
開始塁の明確な不一致: 0 (0.00%)
終了塁からsuccessを明確に再判定できた: 902 (24.92%)
そのうち保存successと矛盾: 3 (0.33%)

| kind | events | success% | parsed start | bad start | parsed outcome | contradiction |
|---|---:|---:|---:|---:|---:|---:|
| 1st_to_3rd | 1887 | 28.40% | 0 | 0 (—) | 0 | 0 (—) |
| 1st_to_home_on_2b | 395 | 37.22% | 0 | 0 (—) | 0 | 0 (—) |
| 2nd_to_home | 1338 | 48.36% | 1033 | 0 (0.00%) | 902 | 3 (0.33%) |

## 開始塁が kind と矛盾する例

## 終了塁から見た success 矛盾の例
2024	2nd_to_home	伊藤裕季也	start=2塁	end=1,3塁	saved=1	implied=0	0アウト二塁から三塁側へ絶妙なセーフティバント！内野安打で出塁する 一三塁
2024	2nd_to_home	佐藤龍世	start=2塁	end=1,3塁	saved=1	implied=0	1アウト二塁からレフトへのヒットで出塁 一三塁
2024	2nd_to_home	長野久義	start=2塁	end=1,3塁	saved=1	implied=0	0アウト二塁からピッチャーへの内野安打 一三塁
```
</details>

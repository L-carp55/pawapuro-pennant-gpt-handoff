# ソースカタログ・既参照エビデンス

このファイルは、会話中に参照した主要ソースと、再実装時に優先すべき取得先を記録する。  
**能力値へ使う前に必ず再取得・再検算すること。** 過去回答内の数値をそのまま転載しない。

---

## 1. 一次情報

### NPB公式

年度別個人打撃:

```text
https://npb.jp/bis/2016/stats/idb1_c.html
https://npb.jp/bis/2017/stats/idb1_c.html
https://npb.jp/bis/2018/stats/idb1_c.html
```

年度別個人守備:

```text
https://npb.jp/bis/2016/stats/idf1_c.html
https://npb.jp/bis/2017/stats/idf1_c.html
https://npb.jp/bis/2018/stats/idf1_c.html
```

年度別チーム打撃・環境:

```text
https://npb.jp/bis/2016/stats/tmb_c.html
https://npb.jp/bis/2017/stats/tmb_c.html
https://npb.jp/bis/2018/stats/tmb_c.html
https://npb.jp/bis/2019/stats/tmb_c.html
```

2019年規定打者・500PA級打者:

```text
https://npb.jp/bis/2019/stats/bat_c.html
https://npb.jp/bis/2019/stats/bat_p.html
```

捕手盗塁阻止:

```text
https://npb.jp/bis/2016/stats/lf_csp2_c.html
https://npb.jp/bis/2018/stats/lf_csp2_c.html
```

注意:

- 盗塁阻止率だけで肩を決めない。
- 守備率は捕球へ。
- チーム打撃は2019環境係数の基礎。
- 436.25は500PA以上打者のAB/PAを再計算して検証する。

---

## 2. 侍ジャパン公式

2017 WBC最終ロースター:

```text
https://www.japan-baseball.jp/jp/team/topteam/2017/wbc/player.html
```

英語版が存在する場合も、日本語版を主とする。

確認事項:

- 大谷翔平・嶋基宏は最終出場登録から除外。
- 武田翔太・炭谷銀仁朗を含む。
- 28人。

---

## 3. 分割成績補助

NF3:

```text
https://nf3.sakura.ne.jp/
```

会話で例示された選手ページ:

```text
2017田中広輔
https://nf3.sakura.ne.jp/2017/Central/C/f/2_stat.htm

2016菊池涼介
https://nf3.sakura.ne.jp/2016/Central/C/f/33_stat.htm

2018丸佳浩
https://nf3.sakura.ne.jp/2018/Central/C/f/9_stat.htm

2018鈴木誠也
https://nf3.sakura.ne.jp/2018/Central/C/f/51_stat.htm

2016新井貴浩
https://nf3.sakura.ne.jp/2016/Central/C/f/25_stat.htm

2017松山竜平
https://nf3.sakura.ne.jp/2017/Central/C/f/44_stat.htm

2017エルドレッド
https://nf3.sakura.ne.jp/2017/Central/C/f/55_stat.htm

2017安部友裕
https://nf3.sakura.ne.jp/2017/Central/C/f/60_stat.htm

2018會澤翼
https://nf3.sakura.ne.jp/2018/Central/C/f/27_stat.htm

2016石原慶幸
https://nf3.sakura.ne.jp/2016/Central/C/f/31_stat.htm

2018西川龍馬
https://nf3.sakura.ne.jp/2018/Central/C/f/63_stat.htm

2018野間峻祥
https://nf3.sakura.ne.jp/2018/Central/C/f/37_stat.htm

2018バティスタ
https://nf3.sakura.ne.jp/2018/Central/C/f/95_stat.htm
```

用途:

- 対右/対左
- 得点圏
- 内野安打
- ISO/BABIP
- 三振・盗塁分割

注意:

- 二次集計。公式値との整合を検算。
- 対右とRISPがあっても、対右×非得点圏の交差を推定しない。

---

## 4. Baseball Data

会話で一部RISP H/AB確認に使用:

```text
https://baseballdata.jp/
```

用途:

- 総H/AB
- RISP H/AB
- 周辺集計の検算

二次情報のため、公式・NF3等と突合。

---

## 5. MLB・Statcast

今後の全盛期査定で使用:

```text
https://www.mlb.com/
https://baseballsavant.mlb.com/
https://www.fangraphs.com/
https://www.baseball-reference.com/
```

青木等のMLB年、鈴木誠也のMLBを全盛期候補に含める場合は、MLB→2019NPB変換モデルが必要。

---

## 6. 守備高度指標

優先:

- DELTA
- OAA
- DRS
- UZRの成分
- RngR
- Arm Runs

注意:

- 総合UZR/DRSを守備力へ使い、失策を捕球へ追加すると二重計上の恐れ。
- Range成分・Error成分・Arm成分を分離。

---

## 7. KONAMI能力の参照先

会話では以下のようなファン整理サイトを使用した。

```text
https://pawapuro-player.net/
https://game8.jp/pawapuro2024-2025/
```

使用条件:

- 比較専用。
- 独自査定前に見ない。
- 画像から全得能を読み取る。
- 作品・アップデート・査定時点を記録。
- 可能なら公式データを優先。

---

## 8. 野間2018 KONAMI画像の転記

会話に添付された画像から確認した能力:

```yaml
player: 野間峻祥
version_label_in_image: オープン9
position: 外
bats_throws: 右投左打
trajectory: 3
meat: B71
power: D55
speed: A85
arm: S90
fielding: B72
catching: C67
abilities:
  - チャンスF
  - 対左投手F
  - ケガしにくさD
  - 盗塁E
  - 走塁A
  - 送球C
  - バント○
  - 内野安打○
  - サヨナラ男
  - レーザービーム
```

画像上の成績表示:

```text
率 .189
0本
2点
```

注意:

- 画像の能力が2018年終了時査定か、オープン9更新時点かを特定する。
- この画像は「基礎ミートだけで比較してはいけない」回帰テスト用。
- 赤得能Fが2つあるため、B71の実効評価は得能込みで行う。

---

## 9. 非力野手のKONAMI実装例

会話では近年例として以下を参照した。

```text
小林誠司: F帯のミート・パワー
植田海: F帯のパワー
山田遥楓: E帯のパワー
```

再実装時は、最新・同一作品・同一アップデートで低パワー野手の分布を収集する。

目的:

```text
現代NPB野手にP-Gがほぼ使われない
```

というゲーム校正仮説を検証する。

これは「一軍野手だから下限」というルールではない。

---

## 10. ソース取得時のチェック

```text
[ ] URL
[ ] 取得日
[ ] 年度
[ ] リーグ
[ ] 対象文脈
[ ] 分母
[ ] 丸め前値
[ ] 公式値との一致
[ ] 欠損
[ ] 推定方法
[ ] 利用した能力・得能
```

---

## 11. アーカイブ推奨

ウェブページは変更・消失する可能性があるため:

- raw HTML
- CSV
- スクリーンショット
- 取得日時
- SHA256

を保存する。

ただし利用規約・著作権・再配布条件を守ること。

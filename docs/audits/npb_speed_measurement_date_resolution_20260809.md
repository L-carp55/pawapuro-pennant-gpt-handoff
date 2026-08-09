# NPB走力身体測定・年不明レコードの時期特定

生成日: 2026-08-09
対象: measurement_year=unknown のうち、30m/50m/60yd等の短距離記録。今回の入力では対象は50m 35レコードで、HP→1Bの6レコードは除外した。

## 結論

35レコード中15レコードを年のみ推定し、20レコードはunknownのまま保持した。正確な測定日は0件、年確定は0件、高信頼の年推定は2件、中信頼の年推定は13件だった。

公開年・ドラフト年・入団年だけで年を割り当てず、学年だけが書かれたプロフィールは「測定年」ではなく「そのプロフィール値が同時期に確認できる年」として中信頼に限定した。本文に具体的な走行・合宿後の測定がある林琢真と藤原恭大のみ高信頼とした。

## QA

| 項目 | 件数 |
| -- | --: |
| 元入力のunknown全種目 | 41 |
| 今回の対象（50m） | 35 |
| 除外（HP→1B） | 6 |
| 解決（STILL_UNKNOWN以外） | 15 |
| EXACT_DATE_FOUND | 0 |
| YEAR_CONFIRMED | 0 |
| YEAR_INFERRED_HIGH | 2 |
| YEAR_INFERRED_MEDIUM | 13 |
| STILL_UNKNOWN | 20 |
| 同一cluster重複 | 0 |
| 元URL欠損 | 0 |
| 年情報の矛盾 | 0 |

### 同一測定・値の矛盾に関する留保

- 小園海斗の5.8–6.0秒は既存clusterを維持し、2016年記事・2018年記事・2019年記事を別測定として増やしていない。
- 林琢真の5.7秒は、同年の別clusterにある電子計時5.99秒と統合していない。元記事は大学日本代表合宿の5.99秒と、合宿後の自己新5.7秒を別の出来事として記載している。([日刊スポーツ](https://www.nikkansports.com/baseball/news/202210270001023.html))
- 友杉篤輝の5.9秒は、別clusterの電子計時6.10秒と統合していない。
- 田宮裕涼の「6秒台前半」は数値化せず、そのまま文字列で保持した。

## 新たに特定できた重要な時期情報

- 林琢真: 2022年の大学日本代表合宿で5.99秒を記録した後、合宿後に自己新5.7秒を計測したと本文にあるため、対象の5.7秒を2022年に高信頼推定した。([日刊スポーツ](https://www.nikkansports.com/baseball/news/202210270001023.html))
- 藤原恭大: 2017年の高校2年時の練習で、50m走20本目・逆風でも5.7秒が出たという具体的な走行状況を確認できた。([デイリースポーツ](https://www.daily.co.jp/baseball/2017/08/04/0010433505.shtml))
- 柳田悠岐: 2015年記事が、2010年ドラフト指名直後の取材時に本人が50m5.94秒をプロフィール回答したと明記する。ただし実測日ではないため中信頼の年推定に留めた。([Sportiva](https://sportiva.shueisha.co.jp/clm/baseball/npb/2015/07/14/post_583/))

## 解決済み（年のみ推定）

- 安田 尚憲
- 蝦名 達夫
- 丸山 和郁
- 吉川 尚輝
- 京田 陽太
- 佐藤 都志也
- 周東 佑京
- 小園 海斗
- 小幡 竜平
- 滝澤 夏央
- 藤原 恭大
- 柳町 達
- 柳田 悠岐
- 友杉 篤輝
- 林 琢真

## まだunknownの選手

- 岡 大海
- 梶原 昂希
- 栗原 陵矢
- 佐藤 輝明
- 細川 成也
- 坂倉 将吾
- 山口 航輝
- 山川 穂高
- 森 友哉
- 正木 智也
- 清宮 幸太郎
- 田宮 裕涼
- 田中 幹也
- 奈良間 大己
- 牧原 大成
- 名原 典彦
- 矢野 雅哉
- 来田 涼斗
- 髙部 瑛斗

来田涼斗は、2020年3月の記事で「高校2年」と値が併記されるが、その学年は2019年度から2020年春にまたがり、測定会・測定日もないため、2019/2020のどちらかへ単一割当せずunknownとした。([日刊スポーツ](https://www.nikkansports.com/baseball/column/baseballcountry/news/202003140000249.html))

## 全対象一覧

| 選手 | 記録 | 元の年 | 解決年 | 根拠 | 信頼度 | 状態 |
| -- | -- | --- | --: | -- | --- | --- |
| 蝦名 達夫 | 6 | unknown | 2019 | 本文で青森大学4年の選手紹介と50m6.0秒が同一箇所に記載され、大学4年の時期を2019年に接続できる。測定会・測定日・計時条件は記載されないため、年のみを中信頼で推定した。 | medium | YEAR_INFERRED_MEDIUM |
| 細川 成也 | 6.2 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 小園 海斗 | 5.8–6秒 | unknown | 2016 | 2016年本文で報徳学園高校1年生の小園について、本人の「50mの最速は5秒9か6秒0」が記載され、後年の5.9秒・5.8秒は同じ高校時代の紹介clusterとして維持した。高校1年の時期を2016年に接続するが、測定会・測定日は不明である。 | medium | YEAR_INFERRED_MEDIUM |
| 矢野 雅哉 | 5.9 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 藤原 恭大 | 5.7 | unknown | 2017 | 本文が大阪桐蔭高校2年の藤原恭大について、練習の50m走20本目や逆風でも5秒7が出たという具体的な走行状況を記載する。練習時期を2017年に高信頼で接続するが、個別の測定日は不明である。 | high | YEAR_INFERRED_HIGH |
| 林 琢真 | 5.7 | unknown | 2022 | 本文が「今年の大学日本代表合宿」の50m5.99秒の後に「合宿後に自己新の5秒7を計測した」と明記する。記事公開年と合宿の年が2022年で一致するため、5.7秒の年を2022年と高信頼で推定した。正確な測定日は不明で、同年の別clusterの電子計時5.99秒とは統合しない。 | high | YEAR_INFERRED_HIGH |
| 梶原 昂希 | 5.8 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 来田 涼斗 | 5.9 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 清宮 幸太郎 | 6.5 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 栗原 陵矢 | 6 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 京田 陽太 | 5.9 | unknown | 2016 | 侍ジャパン公式本文で日本大学4年の京田陽太と50m5.9秒が同一記事に記載され、大学4年の時期を2016年に接続できる。記事公開日は測定日とせず、測定会・計時条件も不明のため年のみ中信頼で推定した。 | medium | YEAR_INFERRED_MEDIUM |
| 牧原 大成 | 5.8 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 丸山 和郁 | 5.8 | unknown | 2019 | 明治大学2年の丸山和郁と50m5.8秒が同じ大学生紹介に記載され、大学2年の時期を2019年に接続できる。測定日・測定イベント・計時条件は本文にないため年のみ中信頼で推定した。 | medium | YEAR_INFERRED_MEDIUM |
| 正木 智也 | 6.6 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 森 友哉 | 6.2 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 名原 典彦 | 5.9 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 名原 典彦 | 6.2 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 奈良間 大己 | 5.8 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 小幡 竜平 | 6.1 | unknown | 2018 | 延岡学園高校3年の小幡竜平と50m6.1秒が同じ選手紹介に記載され、3年時を2018年に接続できる。新人合同自主トレの記事掲載年や入団年を測定年としたのではなく、測定会・測定日は不明のため年のみ中信頼で推定した。 | medium | YEAR_INFERRED_MEDIUM |
| 岡 大海 | 6.1 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 坂倉 将吾 | 6.4 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 佐藤 輝明 | 6 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 佐藤 都志也 | 5.9 | unknown | 2018 | 東洋大学3年の佐藤都志也と50m5.9秒が同じ大学生紹介に記載され、大学3年の時期を2018年に接続できる。測定日・測定会・計時条件は不明のため年のみ中信頼で推定した。 | medium | YEAR_INFERRED_MEDIUM |
| 周東 佑京 | 5.7 | unknown | 2017 | 東京農業大学北海道オホーツク4年の周東佑京と50m5.7秒が大学公式プロフィール欄に記載され、4年時を2017年に接続できる。公式記事の掲載年を単独根拠にはせず、学年・経歴の対応を併用したが、測定日・計時条件は不明である。 | medium | YEAR_INFERRED_MEDIUM |
| 髙部 瑛斗 | 5.8 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 滝澤 夏央 | 5.8 | unknown | 2021 | 関根学園高校3年の滝澤夏央と50m5.8秒が同じ選手紹介に記載され、3年時を2021年に接続できる。測定会・測定日・計時条件は不明で、ドラフト日を測定日とは扱わない。 | medium | YEAR_INFERRED_MEDIUM |
| 田宮 裕涼 | 6秒台前半 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 田中 幹也 | 5.9 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 友杉 篤輝 | 5.9 | unknown | 2022 | 天理大学4年の友杉篤輝と50m5.9秒が同じドラフト候補紹介に記載され、大学4年の時期を2022年に接続できる。別clusterの2022-06-19電子計時6.10秒とは同一測定とみなさず、5.9秒の測定日・方式は不明のままとした。 | medium | YEAR_INFERRED_MEDIUM |
| 山口 航輝 | 6.3 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 山川 穂高 | 6.2 | unknown | unknown | 時期アンカー不足 | low | STILL_UNKNOWN |
| 柳町 達 | 6.2 | unknown | 2016 | 2016年の大学野球記事本文で慶應大学1年の柳町達と50m6.2秒が同じ選手紹介に記載され、慶應大学公式ブログでも同年の1年在籍を確認できる。測定日・測定会・計時条件は不明である。 | medium | YEAR_INFERRED_MEDIUM |
| 柳田 悠岐 | 5.94 | unknown | 2010 | 2015年記事が「5年前の秋」「2010年ドラフト2位指名を受けた数日後」の取材時に、柳田本人がプロフィールとして50m5.94秒を回答したと記載する。値が回答された時点を2010年に接続するが、実測日・測定会は不明である。 | medium | YEAR_INFERRED_MEDIUM |
| 安田 尚憲 | 6.7 | unknown | 2016 | 最古確認記事で履正社高校2年の安田尚憲と50m6.7秒が同じプロフィールに記載され、同値が2017年記事にも再掲されている。高校2年の時期を2016年に接続するが、同値の測定日・測定会・計時条件は不明である。 | medium | YEAR_INFERRED_MEDIUM |
| 吉川 尚輝 | 5.7 | unknown | 2016 | 中京学院大学4年の吉川尚輝と50m5.7秒が同じ選手紹介に記載され、大学4年の時期を2016年に接続できる。測定日・測定イベント・計時条件は明記されないため年のみ中信頼で推定した。 | medium | YEAR_INFERRED_MEDIUM |

## 生成物と後工程への注意

- 元の data/manual/npb_speed_physical_evidence_full_20260809.json は上書きしていない。
- 本台帳は時期結合用の補助成果物であり、走力査定、PowerPro値、50mからT90への換算は変更していない。
- 50mのプロフィール値は測定条件不明のため、年が推定できても既存の数値利用区分を変更していない。
- 6担当の中間JSONを親Agentの統合に使用した。最終branchには指定された3成果物のみを残す。

## 保存確認：最終回答に依存しない監査情報

この節は、後工程がチャット本文を読まなくても判断できるように、調査結果・制約・未解決事項・negative finding・QAを保存するための追補である。

### Coverageと主要結果

- 元入力でunknownだった全種目は41レコード（50m 35、HP→1B 6）。今回の対象は50m 35レコード、34選手であり、HP→1Bは対象外とした。
- 15レコードを年のみ推定し、20レコードはSTILL_UNKNOWN。exact dateは0、YEAR_CONFIRMEDは0、YEAR_INFERRED_HIGHは2、YEAR_INFERRED_MEDIUMは13。
- unresolvedは19選手: 岡大海、梶原昂希、栗原陵矢、佐藤輝明、細川成也、坂倉将吾、山口航輝、山川穂高、森友哉、正木智也、清宮幸太郎、田宮裕涼、田中幹也、奈良間大己、牧原大成、名原典彦、矢野雅哉、来田涼斗、髙部瑛斗。
- 同一cluster重複0、元source URL欠損0、矛盾する年情報0。元の data/manual/npb_speed_physical_evidence_full_20260809.json は上書きしていない。

### 重要な発見

- 林琢真: 2022年の大学日本代表合宿で5.99秒、その後の合宿後に自己新5.7秒を計測したと本文にあるため、5.7秒を2022年にYEAR_INFERRED_HIGHとした。([日刊スポーツ](https://www.nikkansports.com/baseball/news/202210270001023.html))
- 藤原恭大: 2017年の高校2年時の練習で、50m走20本目・逆風でも5.7秒が出たという具体的な走行状況を確認した。([デイリースポーツ](https://www.daily.co.jp/baseball/2017/08/04/0010433505.shtml))
- 柳田悠岐: 2015年記事が、2010年ドラフト指名直後の取材時に本人が50m5.94秒をプロフィール回答したと記載する。ただし、これは実測日ではないため中信頼の年推定に留めた。([Sportiva](https://sportiva.shueisha.co.jp/clm/baseball/npb/2015/07/14/post_583/))

### データ取得上の制約とsource問題

- 元記録の多くはhistorical profileで、元の測定会・測定日・計時方式が本文にない。記事内の「50m○秒」は、過去プロフィール値の転載である可能性を排除できない。
- 来田涼斗は2020年3月記事で「高校2年」と値が併記されるが、高校2年は2019年度から2020年春にまたがり、測定会・測定日もないため単一の年へ割り当てなかった。([日刊スポーツ](https://www.nikkansports.com/baseball/column/baseballcountry/news/202003140000249.html))
- 柳町達は元の日刊スポーツURLの直接取得がcache missとなった。転載本文と慶應義塾大学公式ブログで同年の大学1年在籍文脈は確認したが、測定日・測定会は確認できなかった。
- 岡大海は明大スポーツのページ表示日が本文内容と整合せず、山川穂高は元ページの表示日が無効値（-0001-11-30）だったため、いずれも表示日を測定年の根拠に使わなかった。
- 名原典彦は高校時代の手動6.2秒、大学時代の電子5.9秒、別記事の約7.3秒表記があり、測定年・同一測定性を特定できないため全て年unknownのままとした。

### 定義が確認できなかった項目

全35対象について、以下は原則未確認である。JSONの各recordにも元スナップショットとともに保持している。

- measurement_date、measurement_event_or_test_name
- timing_method、start_protocol、surface、shoe、indoor_outdoor
- 同値転載が同一テストかどうか
- プロフィール値が記事年に測定されたかどうか

### Negative findingとデータ品質上の留保

- 公開年・ドラフト年・入団年だけで測定年を確定できる記録はなかった。
- 35件のどの記録についても正確な測定日を確認できなかった。
- この台帳だけからPowerProの査定年、走力査定、または50mからT90への換算値を結論してはいけない。
- 50mプロフィール値は計時条件不明で、numeric_t90_usable=falseのまま保持する。
- 小園海斗の5.8–6.0秒は既存cluster内の幅として保持し、2016/2018/2019の転載を別測定に増やしていない。
- 林琢真の5.7秒と同年別clusterの電子計時5.99秒、友杉篤輝の5.9秒と別clusterの電子計時6.10秒は統合していない。
- 田宮裕涼の「6秒台前半」は数値化せず文字列で保持している。
- YEAR_INFERRED_HIGH/MEDIUMは時間結合用の推定候補であり、YEAR_CONFIRMEDやexact dateとして後工程で扱ってはいけない。

### QAと機械処理用の保存先

- JSONにはcoverage、status別件数、unresolved選手、source問題、未確認項目、negative finding、conflict register、後工程警告、各recordのevidence_quote・source_dates_checked・conflict_notes・qa_flagsを保持した。
- CSVには最低列に加え、inference_sources、evidence_quote、source_dates_checked、conflict_notes、qa_flags、original_measurement_confidenceを追加した。
- 最終3ファイルのJSON/CSV/Markdownは35レコードで一致し、必須cluster、元年unknown、50m metric、元URLの整合を再検証した。
- 6並列担当の中間JSONを親Agentが統合した。中間JSONは最終branchには残さず、指定されたCSV/JSON/Markdownだけを成果物とした。

### 入力ファイルのSHA-256（作業開始時・最終確認時）

- data/manual/npb_speed_physical_evidence_full_20260809.json: `82c0c59b2f6431cd4d31efce3c3f62c0d601b84bf6466eb5cd17fc0b538afa1d`
- outputs/derived/npb_speed_evidence_coverage_20260809.csv: `1a2bd221d5ecc7822f21f45fe7f1a04f33e521b6a3c15a84bc4bf9ed2234389c`
- docs/audits/npb_speed_physical_evidence_full_20260809.md: `f26b7df72dac89ec30e3ec41ca1be95be863299026798e852032825c53a051fb`
- outputs/derived/pawapuro_speed_history_for_physical_measurements_20260809.csv: `cdd4adc556770cf70d1a4d4ef8cdb8de919339220acb0864acac902c0b0598a0`

### Git保存範囲

- branch: `codex/speed-measurement-date-resolution`
- 成果物: 本Markdown、対応するCSV、対応するJSONの3ファイル
- 元台帳、PowerPro値、走力査定、T90換算値は変更対象外

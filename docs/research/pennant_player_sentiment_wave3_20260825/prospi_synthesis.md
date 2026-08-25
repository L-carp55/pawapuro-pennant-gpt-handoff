# Prospi Pennant synthesis

## Scope and evidence posture

クラシックなProspi Pennantと、myBALLPARKのSEASONを分けて扱った。前者はKonami公式・PlayStation Blog・公開X・公開バグ掲示板、後者はmyBALLPARK改善記事とモードレビューを使った。証拠行はE038-E065、テーマはT12-T17に対応する。

myBALLPARKは、社会型・施設・エネルギー・固定的な選手構成を含む別モードである。テンポ・一括受取・オート停止・能力検索の要望はUIの参考になるが、classic PennantのCPUシミュレーションの証拠には昇格していない。

## 結論

Prospiの長期体験で残すべきものは、年俸・予算・年度記録・タイトル・ドラフト・殿堂と、CPUが生んだ意外な選手の物語である。一方、年数経過後にCPUの獲得・放出・候補生成が止まる疑い、疲労・国際大会・実況・表示の不整合が、長期セーブの信頼を削っている。Prospiの証拠はPowerProより薄く、古い版や単発投稿が多いので、現時点では設計変更より「何年目に何が止まったか」を再現可能にすることが先である。

### 主要な観察

1. **記録は価値の中心** — 公式資料は30年運用、年俸・予算、選手名鑑、年度成績、タイトル、ドラフト候補、殿堂を明示する。[Prospi 2019公式](https://www.konami.com/games/prospi/2019/spirits) と [Prospi 2015公式紹介](https://blog.ja.playstation.com/2015/03/24/20150324_prospi2015/) は、長期記録を残す方向の歴史的根拠になる。
2. **想定外の成功は肯定される** — CPUドラフト選手が本塁打や三冠王に至る物語、CPU対CPU実験を楽しむ投稿がある。ただし、これは低確率の物語の価値を示すもので、能力評価の誤りを証明しない。
3. **長期停止疑い** — CPUが年数経過後に選手を放出しない・ドラフト選手を取らない、転生プロが20年出ないという報告がある。生成・獲得・退団が止まれば、100年世界の反復可能性を損なうが、再現試験はしていない。
4. **不具合と設計を分ける** — 国際大会停止、救援疲労、実況と状態のずれ、メニュー表示の不整合は、設計要件に直結させず、版別の再現性確認に送る。
5. **隣接モードの強いUI信号** — myBALLPARKではテンポの悪さ、運要素、周回時間、オート停止、能力検索、一括受取、高難度への要望が一つの記事に整理されている。[改善要望記事](https://www.myballpark-blog.com/entry/season-improvement) は有用だが、classic Pennantとの混同は禁止。

## A-T topic coverage

| Topic | 現時点の読み | 主な証拠 | coverage |
|---|---|---|---|
| A CPU lineup/rotation/bullpen | CPU采配の歴史的要望はあるが、現行の定量証拠は薄い | E046,E055 | THIN |
| B trade | 期限・個別獲得・育成物語が中心 | E047-E049,E064 | THIN/MIXED |
| C FA/contracts/salary | 年俸・予算は公式記録要素。現行不満は薄い | E039-E040 | THIN |
| D draft/prospects | 長期停止疑い、意外なスター、候補の強さへの要望 | E041-E045,E054,E063 | MIXED |
| E development/aging | ベテラン衰退、CPU生成停滞、若手育成物語 | E042,E049,E054 | MIXED |
| F injuries/fatigue | 救援疲労の単発報告 | E053,E055 | THIN |
| G morale/roles/clubhouse | 直接証拠なし | — | THIN |
| H defense/sim | 直接証拠なし | — | THIN |
| I stats realism/era drift | 能力の低いCPU選手の活躍という物語はあるが検証なし | E043-E045 | THIN |
| J foreign/overseas | 国際代表、アジア系外国人への要望、国際大会停止 | E042,E051-E052,E063 | MIXED |
| K farm/minors | 2軍成績表示の要望 | E042,E063 | THIN |
| L rules/customization/expansion | 国際大会・代表選択の断片的要望 | E042,E052 | THIN |
| M awards/history | タイトル・年度記録・殿堂は公式に厚い | E039-E040 | SUFFICIENT for keep signal |
| N finance/market | 年俸・予算の公式文脈、現行感情は薄い | E039-E040 | THIN |
| O staff/scouting/analytics | 直接証拠は薄い | — | THIN |
| P UI/automation/sim speed | classicの不整合、adjacentのテンポ・オート要望 | E050-E051,E056-E058 | MIXED; adjacent-heavy |
| Q customization/save | 期限UX、表示、長期エラー | E048,E050-E051,E061-E062 | MIXED |
| R replayability/dynasty/CPU | 記録・意外な選手の物語と、年数後の停止疑い | E039-E045,E054 | MIXED |
| S explicit requests | 2軍表示、代表、ベテラン、期限、UI | E042,E048,E057-E059,E063-E064 | MIXED |
| T keep features | 30年、年俸・記録・殿堂、CPUドラフト物語 | E039-E045 | MIXED |

## Existing PW semantic mapping

- **Already covered:** 記録・歴史・殿堂（PW-187-PW-221）、長期世界の物語（PW-001-PW-004, PW-213-PW-221）、市場とプレイヤー価値（PW-095-PW-140）。
- **Partial extension:** 年数経過後のCPU獲得・放出・候補生成の活動量（PW-007-PW-009, PW-025-PW-075）、2軍表示と候補の観測可能性（PW-035, PW-053-PW-075）、期限と本人意思（PW-124-PW-140, PW-236, PW-253）。
- **Adjacent-only:** myBALLPARKの周回テンポ、オート停止、検索・一括受取は、PW-001/010-PW-014の表面設計に対する参考信号だが、classic Pennantの設計根拠にはしない。
- **Open-domain candidate:** CPU配置・疲労・国際大会の関係はOD-01、OD-10、OD-16の検討材料。ただし本波だけでは新PW IDを作らない。

## Design challenge

Prospiの課題は、機能数ではなく、**30年の記録が途中で動かなくならないこと**である。意外なCPU選手を歓迎する余白を残しながら、停止・不整合・期限ミスを「仕様なのか、偶然なのか、版の不具合なのか」に分解できる記録が必要になる。

## Stop condition for this product

classic PennantのG/H/Oは薄く、F/K/Nも限定的である。myBALLPARKの強いUI信号をclassicへ一般化しない。次の波では、現行版のCPU対CPU長期セーブを同一条件で観測し、年数別の選手生成・移籍・疲労・記録更新を取得しない限り、仕様の確定に進まない。

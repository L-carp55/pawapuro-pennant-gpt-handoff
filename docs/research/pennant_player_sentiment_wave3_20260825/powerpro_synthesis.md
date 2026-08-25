# PowerPro Pennant synthesis

## Scope and evidence posture

対象は、PowerPro 2024-2025を中心に、PowerPro 2022、2026として索引された公開X投稿、Gamemosの発売期スレッド集約、noteの大会・参加者文脈、Yahoo知恵袋、5ch低信頼文脈、Konami公式の現行・過去資料である。証拠行は [evidence_index.tsv](./evidence_index.tsv) のE001-E037、テーマは [theme_ledger.tsv](./theme_ledger.tsv) のT01-T11に対応する。

同じ「ペナント」でも、完全自動、観戦、手動混在、データ画面、UI要望が混ざる。したがって、CPUシミュレーションの事実、手動プレイの感想、操作負荷、製品版の不具合を同じ再発性として数えていない。

## 結論

PowerProでは、ペナントの長期運用自体は「面白い」「現役ドラフトや新人候補が楽しい」と評価される一方、外国人放出、CPUドラフト、資金不足、情報確認、完全委任の不足が長期体験を削っている。新しい要素を大量に足すより、既存の長期世界が「なぜその選択・放出・成績になったか」を短く説明し、ユーザーが任せる範囲を選べることが優先である。

### 主要な観察

1. **残す価値** — 無期限運用、現役ドラフト、強い新人、意外な外国人・ドラフト選手の物語は、長期セーブの再開理由になる。公式にも現行ドラフトと無期限プレイが案内され、コミュニティにも肯定的な長期物語がある。[公式ペナントページ](https://www.konami.com/pawa/2024-2025/mode/pennant)
2. **最も再発する不満** — 成績や主力性と釣り合わない外国人の早期解雇・流動である。別ソースでも現れたが、発売期の版固有バグである可能性は残る。T02は強い再発性だが、原因は未確定。
3. **CPU組織行動** — CPUが投手・捕手など特定の役割を偏重する、資金不足でドラフト参加できない、ベテランや外国人の扱いが不自然という声がある。これは単純な強さではなく、球団ニーズ・資金・将来・評価誤差の接続問題である。
4. **操作面** — 能力詳細の二度押し、一覧を長く閲覧する負荷、完全委任がないことが、シミュレーションの深さとは別に不満になる。重要な局面だけ確認したいという自動派の需要も存在する。
5. **成績の議論は未確定** — 四球、打低、配球、長期記録表示は評価が割れている。手動・観戦・完全自動の証拠を混ぜず、現時点では設計変更の根拠ではなく検証候補とする。
6. **長期信頼** — 年数を進めた後のエラー、候補生成の視覚不具合、成績表示不整合は、仕様候補ではなく版・再現手順・修正状況を確認するQAレーンに置く。

## A-T topic coverage

| Topic | 現時点の読み | 主な証拠 | coverage |
|---|---|---|---|
| A CPU lineup/rotation/bullpen | 四球・配球・観戦の体感が割れる。ラインナップより役割評価の証拠が厚い | E011,E032 | MIXED |
| B trade | 低頻度・要請不足への不満。件数より理由ある市場が必要 | E006,E024,E027,E031 | MIXED |
| C FA/contracts/salary | 資金不足・海外FA補償なし・10年目エラー | E013,E015,E024 | THIN/MIXED |
| D draft/prospects | 投手偏重、弱点能力、捕手優先、候補一覧の閲覧負荷。現役ドラフトは肯定 | E008,E019-E021,E027,E029-E030 | SUFFICIENT |
| E development/aging | 特殊能力消失、OBコーチ高齢化、外国人高齢化への疑問 | E014,E016,E028 | MIXED |
| F injuries/fatigue | 今回は直接証拠が薄い | — | THIN |
| G morale/roles/clubhouse | 直接証拠はほぼ未収集 | — | THIN |
| H defense/sim | 守備ミス・捕球・クッションの観察はあるが因果未確定 | E011 | THIN/MIXED |
| I stats realism/era drift | 打低・四球・長期成績が割れる。再計算なし | E011,E012,E032,E034,E035 | MIXED |
| J foreign/overseas | 放出・移籍・市場・海外FAが最も厚い | E004,E007,E013,E018,E024-E028 | SUFFICIENT |
| K farm/minors | 直接の2軍運用証拠は薄い | E027 | THIN |
| L rules/customization/expansion | 現役ドラフト、DH設定、方式の違いが断片的 | E001,E008,E026,E030 | THIN/MIXED |
| M awards/history | 公式過去資料はあるが現行感想は薄い | E036-E037 | THIN |
| N finance/market | 資金不足と補強制約は確認できるが意図か不具合か不明 | E010,E013,E022,E024 | MIXED |
| O staff/scouting/analytics | CPU練習、捕手評価、OBコーチ、完全委任 | E005,E016,E027-E028 | MIXED |
| P UI/automation/sim speed | 二度押し、調整確認、候補閲覧、完全委任 | E003,E005,E017,E023,E029,E033 | SUFFICIENT |
| Q customization/save | 操作範囲・画面情報・長期エラーが中心 | E003,E015,E023,E031,E035 | MIXED |
| R replayability/dynasty/CPU | 長期物語は肯定、CPU・外国人・資金で崩れる | E002,E007,E008,E014,E024-E026 | SUFFICIENT |
| S explicit requests | 完全委任、理由表示、ドラフト幅、調整表示 | E005,E017,E023,E028,E030 | SUFFICIENT |
| T keep features | 現役ドラフト、新人候補、無期限長期運用、歴史 | E001,E002,E008,E036 | MIXED |

## Existing PW semantic mapping

- **Already covered:** 単純操作と深い内部（PW-001, PW-010-PW-014）、無期限世界・自然発生（PW-002-PW-004）、記録と歴史（PW-187-PW-221）、市場・外国・契約（PW-124-PW-140, PW-236, PW-239-PW-242）。
- **Partial extension:** CPUドラフトの組織ニーズと理由表示（PW-053-PW-075, PW-237, PW-260）、外国人の退出・海外市場・本人意思（PW-095-PW-140, PW-236）、財政難と参加停止の切り分け（PW-141-PW-159, PW-247-PW-249）。
- **New candidate at open-domain level only:** 特殊能力のライフサイクルとOBコーチの経歴（OD-04、OD-05/OD-17との接続）。新しいPW IDは作らない。
- **Low value for design:** 発売直後の体型表示・進行停止・表示不整合は、仕様ではなく版別QAへ送る。

## Design challenge

PowerProの証拠は、CPUが「強いか」よりも、**長期に動き続ける組織が、短い画面で納得できる理由を返せるか**を問うている。外国人放出、ドラフト偏重、資金不足、候補一覧の長さを個別修正する前に、真実・球団評価・見えている情報・結果を分離する現在のPW方向を、ペナント画面でどう返すかを検証する必要がある。

## Stop condition for this product

PowerPro側のA-Tは、J/D/P/Q/R/Sが比較的厚い一方、F/G/K/Mは薄い。したがって、この波の証拠だけで怪我・クラブハウス・2軍・賞・規則の新仕様を決めない。次の調査またはQAで補うまで、未確定のまま保持する。

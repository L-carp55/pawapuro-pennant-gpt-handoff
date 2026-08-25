# Design challenge memo — do not implement from this memo

## Decision boundary

このメモは、Pennant Worldの設計検討へ返す研究結果であり、実装仕様・新規PW要件・正本変更ではない。既存PW要件への意味付けと、未仕様Open Domainへの返却だけを行う。

## One-line conclusion

3作品の公開証拠は、機能数の追加よりも、**長期世界の変化を任せられ、必要な時だけ短く介入でき、後から理由と歴史を追えること**を支持している。

## Top 10 evidence-backed findings

1. **PowerProの長期運用は価値がある。** 無期限プレイ、現役ドラフト、新人候補、意外な長期物語が肯定される。一方、同じ長期運用で外国人放出・CPUドラフト・資金不足が不満になる。（T01-T06）
2. **外国人の問題は「移動数」ではなく、移動理由の断絶である。** 実績・年俸・役割・本人意思・市場が見えないため、現実的な放出と機械的な放出を区別できない。（T02）
3. **CPUドラフトは勝率最適化だけでは納得されない。** 投手・捕手偏重、弱点能力、球団ニーズとの不一致が語られる一方、現役ドラフトや意外な新人は楽しまれている。（T03,T06,T14）
4. **資金制約は、差を作る時と機能を止める時を分ける必要がある。** 他球団がドラフトに参加できないなら、財政シミュレーションではなく世界停止に見える。（T04）
5. **情報画面と委任は別々の機能ではない。** 二度押し・候補一覧・調整確認・完全委任の要望は、重要局面だけ見たいという同じ需要を示す。（T05,T30,T31）
6. **Prospiの記録・殿堂・年俸・年度成績はKeep候補である。** 長期セーブの意外なCPU選手の物語も、この記録層があることで意味を持つ。（T12,T14）
7. **Prospiの長期停止疑いは、100年世界の活動量ゲートに返すべきである。** CPUの獲得・放出・候補生成が年数後に止まるなら、強さの問題より先に反復性の問題になる。（T13,T15）
8. **MLB The Showは、公式にはPWに近い市場UIを持つ。** 球団別評価、反提案、Trade Hub、Streamlinedは、理由を返す表面の参照になる。（T18,T20,T25）
9. **しかし市場の評価は逆方向の失敗を同時に生む。** CPUが市場を動かしすぎるという声と、untouchable・拒否・CPU取引不足の声があり、件数の最適化は危険である。（T19,T28）
10. **最も薄い領域を埋めずに仕様を確定してはならない。** PowerProのF/G/K/M、ProspiのG/H/O/N、MLBのG/J/M/Nは、今回の公開証拠では弱い。（T34、各 synthesis）

## Top 5 contradictions to preserve

| Contradiction | Evidence | Design implication |
|---|---|---|
| 移籍・トレードが多すぎる / 少なすぎる | PowerPro E004-E006,E024-E026; MLB E076,E080-E082 | 件数ではなく球団目的・契約・時期・情報・本人意思を保存する |
| 現実的な不確実性 / 理由が見えない不透明さ | E002,E007,E018,E067-E068,E078 | 真実を全開示せず、評価・観測・不確実性を短く説明する |
| 自動化したい / 詳細を見たい | E003,E005,E017,E023,E029,E033,E069-E070 | 局面別委任、差分表示、復旧点を同時に設計する |
| 予算・資金の厳しさ / CPUの参加停止 | E010,E013,E022,E024 | 財政の差と機能停止を判別する監査条件が必要 |
| 意外なスター / 能力・成績の不整合 | E012,E043-E045,E073 | 例外物語を残しつつ、絶対能力・時代相対・環境・役割を分離する |

## Top 10 uncovered candidates (review candidates, not new PW IDs)

1. **OD-01:** lineup/rotation/bullpen deployment AIの理由、失敗の型、復旧。
2. **OD-04:** special ability lifecycle（付与、消失、引継ぎ、評価誤差）。
3. **OD-07:** roster rights / options / waivers / service-time-like constraints。
4. **OD-12:** awards, Hall of Fame, retired numbers, historical recognition。
5. **OD-13:** economy, salary inflation, cross-league purchasing power。
6. **OD-15:** league-wide strategic meta and adaptation without rubber banding。
7. **OD-16:** information visibility and player/club belief boundaries。
8. **OD-17:** physical maturation and aging separate from evaluation change。
9. **OD-10:** schedule, travel, weather, calendar as causes of fatigue and bullpen decisions。
10. **OD-20:** ownership succession and long-run club governance.

これらは既存監査で未仕様とされている領域へ返している。今回のソーシャル証拠だけで仕様化せず、次の設計波または再現可能なシミュレーション観測へ送る。

## Existing PW mapping summary

- **Already covered:** PW-001-PW-009, PW-010-PW-014, PW-095-PW-140, PW-160-PW-221, PW-236, PW-239-PW-260の方向は、単純操作・深い世界・市場・情報・歴史・自然な長期競争と整合する。
- **Partial extension:** CPU市場の理由、候補・下部組織の詰まり、本人意思、年齢・成績・評価の分離、長期活動量の監査。
- **New candidate:** 既存Open Domainに対する設計質問のみ。新規PW IDは作っていない。
- **Low value:** 版固有の進行停止、体型表示、メニュー不整合、保存事故は、再現性が確認されるまで設計思想へ昇格させない。

## Proposed review order

1. OD-01/OD-16を、PW-004/006/010-014と一緒に「理由を返すCPUと委任UI」の設計課題として読む。
2. PW-124-140/236/253-255に、移籍・FA・契約の失敗理由と本人意思の観測境界を追加検討する。
3. PW-015-035/088-094/174-186/245-250に、長期活動量・成長・世界発展が止まらないためのQA指標を加えるか検討する。
4. F/G/K/M等の薄い領域は、新しい実装ではなく別の証拠収集または同一条件の長期観測へ送る。

## Non-implementation guard

このメモから実装を開始しない。次に必要なのは、ownerが設計質問の優先順位を決めること、または同一条件の長期シミュレーションで未解決テーマを検証することである。

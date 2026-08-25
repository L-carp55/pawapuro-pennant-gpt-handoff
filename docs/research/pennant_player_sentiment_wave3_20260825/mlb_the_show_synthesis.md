# MLB The Show Franchise synthesis

## Scope and evidence posture

対象はMLB The Show 25-26を中心に、公式PlayStation/MLB26 manual/MLB23 manual、Operation Sportsの記事・フォーラム、Reddit公開スレッド、GameSpotの過去レビューである。証拠行はE066-E098、テーマはT18-T28に対応する。

公式資料は「意図された挙動」と「現行の機能」を確認するために使い、コミュニティは実際の長期セーブでどこが破綻したと感じられるかを確認するために使った。Reddit・フォーラムは熱心なプレイヤーに偏り、投票数は母集団の割合ではない。

## 結論

MLB The Showは、トレード市場の球団差・反提案・Trade Hub、Full Control/Streamlined、負傷時のブルペンゲームなど、Pennant Worldが目指す方向に近い公式機能を明示している。一方、コミュニティでは、CPUトレードの過剰移動と硬直、打順・ブルペンAI、年齢回帰、契約条件の欠落、UI遅延・保存の安全性が、長期フランチャイズを壊す要因として報告されている。[MLB The Show 26 Franchise manual](https://mlb26.manual.theshow.com/en/franchise-1.html)

この対立は「トレードを増やすか減らすか」では解けない。必要なのは、球団の目的・市場・ファーム・買い手売り手・選手契約・情報の不確実性を分け、拒否・提案・停滞の理由をプレイヤーに返すことである。

### 主要な観察

1. **公式の方向** — 26のマニュアルは、双方4人、CPUの actionable feedback・counteroffer、球団ごとの市場・ファーム・買い手売り手、Trade Hubを案内する。これはPW-124-PW-140/PW-236の方向と整合する。[公式マニュアル](https://mlb26.manual.theshow.com/en/franchise-1.html)
2. **CPU市場の両極** — あるスレッドはCPUトレードで数年でリーグが崩れると述べ、別のスレッドはuntouchable・拒否・CPUトレード不足を訴える。設定・版・プレイ方針の差を残したまま、件数で平均化しない。
3. **ロースター管理** — 打順・ブルペン・成長回帰が、専門分析とコミュニティで繰り返し主要課題になる。[Operation Sportsの25分析](https://www.operationsports.com/mlb-the-show-25-franchise-mode-in-depth-breakdown/)
4. **成長・回帰** — 若手潜在力偏重、ベテラン急落、年齢曲線、マイナー層、成績と能力尺度のずれが長期運用の不満に直結する。PWの絶対能力・時代相対表示・評価不確実性の分離を補強するが、詳細仕様の直接根拠ではない。
5. **契約・FA** — FA刷新は肯定される一方、オプトアウト、ノートレード条項、選手・球団オプション、前払い・後払い等の欠落や、過去機能の喪失が「交渉の表現力低下」として語られる。
6. **委任とテンポ** — Full Control/Streamlined、Quick Manageの自動・手動切替は良い設計例だが、メニュー遅延、オートセーブ不足、保存喪失があれば、委任の価値は落ちる。
7. **拡張・歴史** — 拡張、再編、ルール、殿堂、永久欠番、マイナー・国際要素への要望がある。これは単なる編集機能要求ではなく、長期世界を自分の歴史にする需要である。

## A-T topic coverage

| Topic | 現時点の読み | 主な証拠 | coverage |
|---|---|---|---|
| A CPU lineup/rotation/bullpen | 現行の主要不満の一つ。ロースターAIの説明不足 | E071,E077,E086,E088 | SUFFICIENT |
| B trade | 公式は進展、ユーザー体験は過剰移動/硬直の両極 | E067-E068,E076,E078,E080-E082,E087 | SUFFICIENT |
| C FA/contracts/salary | 契約条件の欠落とFA交渉の不満 | E066,E074,E096-E098 | SUFFICIENT |
| D draft/prospects | 潜在力偏重、候補・トレード指標、下部組織 | E082,E084-E085,E088-E089 | MIXED |
| E development/aging | 年齢急落・回帰・若手過信が厚い | E071-E072,E085,E089-E091 | SUFFICIENT |
| F injuries/fatigue | ブルペン・疲労・怪我運用が要望に出る | E069,E085 | MIXED |
| G morale/roles/clubhouse | 直接証拠は薄い | — | THIN |
| H defense/sim | K/9等の成績尺度、シミュレーション成績の問題 | E073 | THIN/MIXED |
| I stats realism/era drift | 能力尺度・K/9・年齢回帰の議論 | E073,E089-E091 | MIXED |
| J foreign/overseas | 国際FA・投稿・国際リーグの要望はあるが薄い | E079,E084 | THIN |
| K farm/minors | ファーム状態、マイナー成績、AAA昇格問題 | E067,E082,E084,E088-E089,E091 | MIXED |
| L rules/customization/expansion | 再編・拡張・ルール・カスタムリーグの要望 | E083-E085,E095 | SUFFICIENT |
| M awards/history | 殿堂・永久欠番・歴史のwishlist | E083,E095 | MIXED |
| N finance/market | 市場規模・市場全体・買い手売り手を公式に説明 | E067 | MIXED |
| O staff/scouting/analytics | ドラフト・スカウト・ロースター管理の専門議論 | E071,E085-E086 | MIXED |
| P UI/automation/sim speed | Trade Hub・Streamlinedは肯定、遅延・保存は不満 | E068-E070,E092-E094 | SUFFICIENT |
| Q customization/save | options・カスタム・オートセーブ・UI | E083-E084,E092-E094,E097-E098 | SUFFICIENT |
| R replayability/dynasty/CPU | 20年運用、リーグ漂流、長期契約、歴史要望 | E075-E083,E095 | SUFFICIENT |
| S explicit requests | 交渉条件、拡張、ロースター、短時間化、保存 | E074-E075,E083-E085,E092-E098 | SUFFICIENT |
| T keep features | 市場の理由表示、委任、フル操作の切替は保持候補 | E066-E070 | MIXED |

## Existing PW semantic mapping

- **Already covered:** 球団ごとの市場、選手価値、トレード、FA、契約、本人意思、情報の非対称（PW-004, PW-095-PW-140, PW-236, PW-249, PW-253-PW-255）。
- **Partial extension:** trade engineを理由・反提案・市場感として表面に返すこと（PW-001, PW-010-PW-014, PW-236）、年齢・成績・怪我を分けた成長回帰（PW-015-PW-035, PW-088-PW-094, OD-17）、長期保存・履歴の安全性（PW-187-PW-229）。
- **New candidate at open-domain level only:** 打順・ブルペン配置AI（OD-01/OD-02）、ロースター権利・オプション（OD-07）、拡張・殿堂・労働・情報可視性（OD-12/OD-14/OD-16）。新PW IDは作らない。
- **Contradiction to avoid:** 「CPUトレードが多いほどリアル」「untouchableが多いほど安全」の単純化は、E076とE082の両方に反する。

## Design challenge

MLB The Showから学ぶべきなのは、機能の数ではなく、**球団ごとの不完全な評価を、プレイヤーが判断に使える短い反応へ変えること**である。反提案、Trade Hub、Streamlinedは表面の良い例だが、長期でロースターが崩れた時に、どの誤認・制約・情報遅延が原因だったかまで返せなければ、深いシミュレーションは「壊れた自動化」に見える。

## Stop condition for this product

MLB側はB/E/P/Q/R/Sが厚い一方、G/J/M/Nのプレイヤー証拠は薄い。現行26のCPUロースター・市場・回帰を、同じ設定・年数・操作条件で再現しない限り、コミュニティの逆方向の不満を一つの仕様へ統合しない。

# パワプロ風ペナント — World Simulation Master Design

Status: **OWNER WALL-TALK MASTER / IMPLEMENTATION NOT AUTHORIZED YET**
Date: 2026-08-24
Branch: `design/pennant-world-master-20260824`

> この文書は2026-08-23〜24のowner壁打ちで出たペナント機能案を、実装前に一つも落とさず保存するためのマスター設計である。
> 既存の走力査定SP系とは別レーン。SP-078 owner verdict、SP-079、肩力を進める根拠にはしない。
> ここに書かれた機能は「全部を即実装する」という意味ではない。まず要件として保存し、外部事例探索・設計統合・優先順位付けを行ってから実装する。

---

## 0. プロダクトの中心像

このゲームの目標は、単にパワプロのペナントへ項目を足すことではない。

> **操作感はパワプロ程度に分かりやすいまま、内部では選手・球団・リーグ制度・世界野球が長期間自律的に変化し、数十年〜100年遊んでも同じ攻略法・同じ勢力図・同じ制度に固定されない野球世界を作る。**

最重要体験:

1. 選手に人生がある。
2. 12球団が本気で勝とうとする。
3. 球団が学習・革新・失敗・再建する。
4. 選手市場が人格・契約・海外・情報・評判で動く。
5. NPBの外側にも生きた野球世界がある。
6. 制度・ルール・球団数・用具・国際環境まで変わり得る。
7. 毎年の出来事が歴史として残る。
8. 内部は複雑でもユーザーに雑務を強制しない。

---

# I. 最上位設計原則

## 1. 内部は深く、表面は簡単

- OOTPほど管理項目を前面に出さない。
- 毎日の練習メニュー、売店価格、細かなスタッフ契約条項等を大量操作させない。
- ユーザーは「意図・方針・重要案件」を決め、細部はAIへ委任できる。
- 重要案件だけ自動進行を止める。

## 2. 自然発生を優先し、ご都合イベントを減らす

- 「移籍したので覚醒20%」ではなく、出場機会・役割・コーチ・フォーム・球場・適応などの結果で覚醒が起こる。
- 「2年目なので能力-3」ではなく、相手研究と本人の再適応でジンクスが起こる。
- 「豊作年なので全新人+5」ではなく、生成結果や世代効果の結果として豊作になる。
- 「弱小救済+10」「強豪弱体化-10」のようなゴムバンド補正を使わない。

## 3. 実態と観測・評判を分ける

- 真の能力と年度成績を分ける。
- 組織能力と球団評判を分ける。
- 選手の内面と周囲から見える人物評を分ける。
- 海外リーグ成績とNPB換算能力を分ける。
- 情報の鮮度と真実を分ける。

## 4. プレイヤーとCPUに不公平な神様視点を与えない

- CPUだけhidden potentialを読むことは禁止。
- ドラフト・外国人・FA等ではCPUも観測情報に基づく。
- プレイヤーも将来能力の確定値は見ない。
- 現在のPowerPro風能力表示は分かりやすく保ってよいが、未来は不確実。

## 5. すべてのCPU球団は本気で勝つ

- 意図的な無気力経営をしない。
- 全球団の最上位目的は「制約の中で長期的競争力と優勝回数を最大化する」。
- ただし戦略・判断能力・リスク許容・財務・偶然によって結果は異なる。
- 長期低迷時には必ず原因分析・戦略再評価・組織変更を検討する。
- 暗黒期はあってよいが、「何も変えず負け続ける」ことをAIの仕様にしない。

---

# II. ユーザー操作・自動化

## 6. 手動 / 方針指定 / 完全自動

各業務を3段階で切替可能にする。

- 手動: 個別案件までユーザーが決定。
- 方針指定: 方針だけユーザーが決め、AIが実務を行う。
- 完全自動: スタッフAIへ委任。

対象:

- ドラフト
- FA
- トレード
- 外国人
- 戦力外
- 契約更改
- 一二軍入替
- スタメン
- 打順
- ローテーション
- 中継ぎ役割
- 育成
- スカウト
- 施設・組織投資

## 7. 自操作球団ではプレイヤーが最終決定権者

CPU球団ではGMと監督を別人格としてよいが、自操作球団でそれを強制してストレスを生まない。

優先順位:

```text
ユーザーの明示指示
  > ユーザーの球団方針
  > 委任先スタッフの思想
  > 通常AI判断
```

任せた領域だけスタッフ差が出る。

## 8. 重要案件だけ割り込み

通知レベル例:

- 緊急: 自動進行停止。
- 重要: 次回停止時にまとめて表示。
- 通常: ニュース欄。
- 非表示: 記録のみ。

重要案件候補:

- ドラフト
- FA宣言
- 大型トレード
- 長期故障
- 支配下登録候補
- 戦力外
- 制度変更採決
- 国際大会代表
- 大型組織投資
- 不祥事
- 球団拡張・移転等

## 9. 観戦・Commissionerモード

- 全12球団CPUで数十年観戦可能。
- 途中から球団操作を開始可能。
- 途中で操作をやめて観戦へ戻れる。

---

# III. 選手人生・成長・衰え

## 10. 固定型の早熟/普通/晩成を主決定変数にしない

能力ごとの実測aging curveと個人差を中心にする。

概念:

```text
latent skill(t+1)
 = latent skill(t)
 + ability-specific age curve
 + persistent player effect
 + small annual shock
 - persistent injury loss
```

## 11. 能力別aging

全能力を同じ年齢補正で動かさない。

候補:

### 野手
- コンタクト
- 長打
- 選球
- 走力
- 走塁技術
- 肩
- 守備範囲
- 守備技術
- 捕球

### 投手
- 球速
- 奪三振能力
- 制球
- 被弾/コンタクト抑制
- スタミナ
- 球種別品質

## 12. 将来性は固定上限ではなく分布

- `future power = 86` のような神様視点の固定capを主概念にしない。
- 若いほど将来分布を広くする。
- 実績・観測が増えるとposteriorが狭くなる。
- generated rookieは母集団から個人差をsampleする。
- 実在選手は開始時点までの履歴から本人固有の傾向を更新可能。

## 13. 成績と能力変化を分離

- 単年成績の悪化を同量の能力低下とみなさない。
- 好成績→成長→さらに好成績、という自己増幅を防ぐ。
- 調子・運・対戦環境・役割をlatent abilityから分離する。

## 14. 選手人生の多様性

自然発生させたい例:

- 超有望株→スター
- ドラフト下位→遅咲き
- ドラ1→期待外れ
- 怪我で人生変更
- 移籍後に開花
- 海外で再生→NPB復帰
- 長寿スター
- 急落
- 役割変更で延命

---

# IV. 育成・二軍・春季キャンプ・フォーム・コンバート

## 15. 一軍経験をゲーム的に低効率扱いしない

旧案の「適正難易度」を主制約にしない。

- 同量の実戦経験なら高レベルの一軍経験には少なくとも同等以上の育成価値を持たせる方向。
- 一軍で能力不足の若手を大量起用するデメリットは、成長ペナルティではなく現在戦力・勝率・興行・財務の悪化として出す。

## 16. 出場機会は重要だが逓減

- 一軍ベンチ30打席より二軍400打席が育成上有利になり得る。
- ただし出場数に比例して無限成長しない。
- 登録日数ではなく実際の打席・BF・投球回・役割を見る。

## 17. 二軍の意味

- 若手の継続的出場場所。
- リハビリ実戦。
- コンバート・新球等の試行。
- 二軍成績は能力上昇の直接原因ではなく状態観測情報。
- 二軍年度成績・通算・タイトル・昇格履歴を残す。

## 18. 育成方針

野手例:
- バランス
- コンタクト
- 長打
- 選球
- 守備
- フィジカル
- ポジション転向

投手例:
- バランス
- 球速
- 制球
- 変化球
- スタミナ
- 先発/救援転向

効果は「能力+5」ではなく、自然成長の方向への小さなbias。

## 19. 重点育成

- 全選手を毎年個別設定させない。
- 基本はコーチおまかせ。
- 特定選手だけ重点指定。
- コーチ資源は有限で、対象を増やしすぎると一人当たり効果が薄くなる方向。

## 20. ポジションコンバートは打撃にも間接影響

PowerPro/Prospi家庭用のように強打の一塁/外野/三塁を二塁/遊撃/捕手へ動かし、打撃を完全維持したままポジション希少性だけ得る攻略を防ぐ。

影響軸:

1. 新ポジション守備習熟
2. 身体的守備負荷
3. 認知・連携負荷
4. 守備練習に使う育成資源
5. 選手自身の適性
6. 疲労・コンディションを介した実効打撃

打撃latent skillを機械的に下げるのではなく、守備負担により「試合で発揮できる打撃」が変化する構造を基本にする。

## 21. 守備負荷によるキャリア変化

自然発生例:

- 遊撃→三塁→一塁→代打
- 捕手負担軽減で打撃発揮改善
- 高齢選手のDH/一塁移行
- 投手の先発→救援転向

## 22. 投球フォーム変更を能力構造へ接続

見た目だけ変えて160km/h投手を160km/hアンダースローにできる問題を防ぐ。

Mechanical change候補:
- arm slot
- release height/side
- stride
- trunk tilt
- extension
- delivery tempo

影響:
- 球速
- 変化量/軌道
- 制球
- deception
- 左右差
- 故障負荷

アンダー等へ大改造すれば一時的な球速低下・制球悪化・球種軌道変化が起こり得る。固定最大球速capではなく、本人と新メカニクスから再計算する。

## 23. 打撃フォーム変更

Mechanical change候補:
- 足上げ縮小
- ノーステップ
- stance変更
- スイングコンパクト化
- 長打狙い
- 引っ張り/逆方向アプローチ

影響候補:
- コンタクト
- 長打
- 三振
- 打球角度
- 球速対応
- 打球方向

Cosmetic form changeとMechanical changeをUI上分離する。

## 24. 春季キャンプを技術改造の中心期間にする

キャンプで行う候補:
- コンバート
- フォーム変更
- 新球習得
- 球種改良
- 打撃アプローチ変更
- 先発/救援転向
- 重点育成

## 25. 臨時・特別コーチ招集

- 春季キャンプに元選手や専門家を招聘可能。
- 「パワー+5」ではなく、特定改造の適性発見・成功率・損失軽減・早期撤退判断等に作用。

## 26. 球種習得・改良

- 新球習得は成功保証なし。
- 習得失敗、実戦レベル未到達、武器化等を自然発生。
- 既存球種改良も可能。

## 27. ベテランは育成ではなく維持・再設計

- 能力維持
- 守備負担軽減
- コンバート
- 役割変更
- フォーム/アプローチ変更

---

# V. ドラフト・アマチュア・スカウト

## 28. ドラフトは長期人材供給システム

- 10〜15年後の球界を支える中核。
- 新人生成・成長・引退と同時校正してリーグ能力インフレ/枯渇を防ぐ。

## 29. 高校・大学・社会人・独立の差

固定タイプではなく、年齢・現在完成度・情報量・残り成長期間から平均差が出る。

- 高校: 若い、現在能力低め、不確実性大。
- 大学: 完成度・情報量増。
- 社会人: 即戦力性高め、残り成長期間短め。
- 独立: 経歴/年齢幅が広い。

## 30. 真の能力とスカウト評価を分離

公開情報:
- 年齢
- 所属
- ポジション
- 投打
- 身長体重
- 球速等
- アマ成績
- 大会実績
- メディア評価

自球団スカウト:
- 能力range
- 将来range
- 信頼度
- リスク

## 31. CPUも独自draft board

評価差の原因:
- スカウト精度
- GM思想
- ポジション需要
- competitive window
- リスク許容

全球団が同じランキングを使わない。

## 32. スカウト運用

- 毎週ポイント手作業は避ける。
- 全体方針 + 少数の重点調査選手。
- 調査量でrangeが狭くなるが完全真値にはならない。

## 33. メディアdraft ranking

- 自球団評価とは別。
- メディアも間違う。
- 「世間1位、自球団6位」等の葛藤を作る。

## 34. BPAとneeds

- 上位指名ほどBPA寄り。
- 下位ほどrole/needs/lottery ticketを重視可能。
- 再建/優勝争いで即戦力と素材の評価weightが変わる。

## 35. 豊作・不作

- 毎年固定人数のA級を置かない。
- 結果として全体豊作、投手豊作、大学投手豊作等が発生。
- 必要なら実測された世代効果を追加。

## 36. 能力相関

- 万能超人を独立乱数で量産しない。
- 身体能力・体格・守備位置・打撃タイプ・球速・制球等の現実的相関を持つ。
- 珍しい選手は珍しい確率で発生。

## 37. 選手タイプは生成原因ではなく結果ラベル

「大型遊撃手テンプレート」から作るより、生成された特徴にメディア/スカウトがラベルを付ける。

## 38. アマ成績

- 真の能力 + 競技レベル + 出場機会 + noiseから簡略生成。
- アマ全試合を完全simしなくてよい。

## 39. 育成ドラフト

- 低総合だけでなく一芸特化型を重要候補にする。
- 球速だけ高い、足だけ速い、長打だけ大きい等。

## 40. 指名漏れ選手を消さない

- 高校指名漏れ→大学
- 大学→社会人/独立
- 数年後に再ドラフト候補
- 一度生成した有望選手の人物史を保持。

## 41. ドラフト時評価を永久保存

- 指名順位
- メディア評価
- 自球団スカウト評価
- 将来評価range
- 当時のprospect rank

後からcareer結果と比較できる。

## 42. ドラフト世代ページ

- 当時評価
- 10年後評価
- 最大の当たり
- 掘り出し物
- 期待外れ
- 球団別成果

---

# VI. スタッフ・組織・球団文化

## 43. 基本スタッフ

- GM/編成責任者
- 監督
- コーチ陣
- スカウト部門
- 後で医療、二軍監督等

## 44. GM

判断能力:
- 現在能力評価
- 将来性評価
- 選手価値
- 契約価値
- team needs
- 長期計画

思想:
- 若手/即戦力
- talent/needs
- cost/戦力
- FA積極度
- trade積極度
- 外国人重視度

低能力GM = ランダム行動ではなく評価誤差・計画ミスが大きい。

## 45. 監督

思想例:
- 若手/実績
- 打撃/守備
- 固定/調子
- 左右重視
- 先発を引っ張る/早継投
- 中継ぎ酷使への慎重さ

能力と思想を分離し、単純な総合点ランキングにしない。

## 46. コーチ

- 選手本人の自然発達が主。
- コーチは発達方向・効率へ小〜中程度影響。
- 得意分野と選手の状態/課題の相性を持つ。

## 47. スカウト

- 現在能力
- 将来性
- 投手/野手
- 怪我リスク
- 外国人

等の評価精度差。

## 48. 引退選手→スタッフ

- 一部がコーチ・監督・GM等へ転身。
- 名選手=名コーチではない。
- 現役時代の専門領域が得意分野へ弱く影響可能。

## 49. スタッフ人事で球団文化が形成

球団カラーは固定buffだけでなく、

```text
球団の持続的傾向
+ 現GM
+ 現監督
+ コーチ
+ スカウト
+ 戦力
+ 歴史
```

から形成。

## 50. CPUはスタッフ選考も賢くする

- GMとの思想一致
- 現戦力
- competitive window
- 実績
- 年俸

を評価。

## 51. 解任は期待値比

- 優勝候補5位は厳しい評価。
- 再建初年5位は許容可能。
- 若手成長等も評価。

---

# VII. CPU球団・競争均衡・王朝

## 52. Competitive Window

候補state:
- CONTENDER
- COMPETE
- NEUTRAL
- RETOOL
- REBUILD

トレード、FA、ドラフト、若手起用に反映。

## 53. 弱い球団は必ず変化を試みる

長期低迷で検討:
- GM/監督交代
- コーチ刷新
- スカウト再編
- draft方針変更
- FA投資
- 海外市場
- 3/4軍
- AI/R&D
- 再建

## 54. 一度強くなって永久優勝を防ぐ自然な反作用

- 年俸上昇
- FA流出
- MLB挑戦
- 出場機会要求
- 黄金世代高齢化
- スタッフ引き抜き
- 他球団の模倣
- opponent research
- 市場価格変化
- ルール変更
- 国際市場変化

## 55. 王朝は許す

- 連覇・黄金時代はあってよい。
- ゲームが裏で強制的に敗北させない。
- 目標は「王朝を作れるが、更新し続ける方が難しい」。

## 56. CPUは成功要因を学習

- プレイヤー球団だけでなくCPU同士も研究。
- 成功した選手タイプ、育成法、スカウト市場、施設、人材を追随。
- first-mover advantageは永続しない。

## 57. 市場価格が成功戦略へ反応

あるタイプの選手が勝利に寄与して注目されれば、そのタイプのdraft/FA市場評価が上がる。

---

# VIII. 選手価値・人格・外部性

## 58. 選手価値は試合戦力だけではない

候補:
- On-field value
- Future value
- Mentor value
- Leadership value
- Information value
- Commercial value
- Fit value

## 59. ベテランのmentor価値

- 若手育成
- 試合準備
- 技術共有
- 捕手なら若手投手/捕手への知識
- ベンチ情報共有

ただし「ベテラン在籍で全員成長+10%」は禁止。

## 60. ベンチ枠とのトレードオフ

ベテランをmentor/ムード目的で一軍ベンチに置けば、一軍枠・年俸・若手枠を消費する。

## 61. ムードメーカー

単純な全能力buffではなく:
- 新人適応
- 連敗時の心理安定
- 役割変更への納得
- 情報共有

等へ間接作用。

## 62. Player Identity — 性格と価値観を分離

性格候補:
- 真面目さ
- 向上心
- 助言受容
- 自信
- 忍耐
- 競争心
- リーダーシップ
- 協調性
- 感情安定
- 環境適応
- リスク志向

価値観候補:
- 年俸
- 出場機会
- 優勝
- 好きな球団
- 地元
- 海外挑戦
- 安定
- 契約年数
- 家族
- 監督/コーチ
- 仲間
- 役割
- 自分を評価してくれる球団
- 育成環境

## 63. 価値観は年齢・経験で少し変化可能

若手は出場、全盛期は年俸/優勝、ベテランは安定/家族等が重要になり得るが、全員同じ変化にはしない。

## 64. 球団との関係履歴

- 若い頃から使ってもらった
- 二軍に長く置かれた
- 年俸交渉
- 怪我中の支援
- 約束を守った/破った
- トレード候補化

等で愛着・信頼が変化。

## 65. 素行・規律

単一の「素行不良」赤特ではなく、練習態度・遅刻・衝突・規律違反等を性格と環境から低確率で発生させる。

---

# IX. 球団評判・知識・情報

## 66. 球団評判は動的に形成

候補:
- Veteran Treatment
- Player Trust
- Medical Reputation
- Clubhouse Reputation
- Opportunity Reputation
- Hitting/Pitching/Power Development Reputation
- Posting Friendliness
- International Reputation
- Integrity/Governance Reputation

## 67. 実態と評判を分ける

- 実際の医療能力と「怪我が多い球団」という評判は別。
- 偶然でも悪評が立つ場合がある。
- 改善しても評判回復にはlagがある。

## 68. Knowledge & Familiarity

選手・スタッフは「誰/どのリーグ/どの球団についてどれだけ新鮮な知識を持つか」を持つ。

- 古巣情報
- 他リーグ情報
- 捕手の打者/投手情報
- 投手・打者の癖
- コーチの組織知識
- スカウトnetwork

情報は時間とともに陳腐化。

## 69. 情報移籍は双方向

移籍選手が古巣・旧リーグ情報を持つ一方、古巣側もその選手の傾向をよく知る可能性がある。

---

# X. Opponent Learning / 対戦研究

## 70. 初見優位

新人・新フォーム・新球種・リーグ移籍直後は相手データが少なく、一時的なnovelty advantageがあり得る。

## 71. 試合内学習

1巡目→2巡目→3巡目で:
- 球筋
- 配球
- 決め球
- タイミング

等の情報が増える。

疲労と打者学習を分離し、単純な3巡目能力-5にはしない。

## 72. シーズン内・年跨ぎ研究

- 5月初対戦→8月には研究済み。
- 新人年→2年目には映像/データが蓄積。
- 2年目のジンクスを研究→対策として自然発生させる。

## 73. 再適応

```text
相手が弱点発見
→ 攻め方変更
→ 本人/コーチが修正
→ 成績回復
→ 再研究
```

というcycle。

## 74. 球団別research能力

- 事前スカウティング
- 映像解析
- 初見対応
- 試合中調整
- ベンチ共有

が違う。

固定の「初物×」特性にはしない。

## 75. 重点対策

ユーザーが「この打者/投手を重点研究」を指定可能。
分析資源は有限で他対象とのtrade-offを作る。

---

# XI. 移籍・FA・契約・代理人

## 76. 移籍覚醒/FA失敗を文脈効果で発生

変化要因:
- 出場機会
- role
- coaching
- 球場
- 戦術
- 守備位置
- 適応
- 人間関係
- プレッシャー
- 技術改造

「移籍したから覚醒確率○%」は禁止。

## 77. 真の能力と発揮能力を分離

同じlatent skillでも環境によりeffective performanceが変わる。
技術改造が成功すればlatent skill自体も変化可能。

## 78. Career Mobility / 海外志向を広く定義

MLB志向だけでなく:
- 上位リーグ挑戦
- 戦力外後も海外で現役続行
- 出場機会優先
- 海外生活への適応
- NPB復帰志向
- 地域嗜好
- 家族/安定

を含む。

## 79. FA判断

FA権を持つ=宣言ではない。

判断要因:
- 市場価値
- 現球団満足
- 出場機会
- 優勝
- 金銭
- 海外
- 愛着
- 年齢

## 80. FA契約条件

必要最小限:
- 年俸
- 年数
- 想定役割
- レギュラー/競争
- 先発/救援
- posting方針
- 必要なら出来高/option

## 81. 起用約束と球団信頼

FA等で起用方針を示し、それを破れば本人不満・代理人/選手市場での評判悪化。

## 82. 代理人

- 交渉能力
- 国際network
- risk preference
- 金銭重視
- 選手希望尊重
- MLB/NPB球団との関係

等。

## 83. ポスティング

```text
本人希望
→ 球団容認/拒否/延期交渉
→ 海外市場
→ 契約成立 or 不成立
```

球団が容認しても移籍できない事象を必須化。
不成立理由:
- オファー不足
- 条件不一致
- role
- medical
- 市場競合
- 制度制約

## 84. ポスティング評判

寛容な球団は海外志向選手からの信頼を得る一方、スターを早期喪失するtrade-off。

## 85. 減額制限超過→自由契約

現行制度の初期状態として、一定以上の減額提示に選手が同意しなければ自由契約を選べる仕組みを持つ。
FAとは別経路。

## 86. 長期契約

- 安定と球団リスク。
- 衰えた高年俸ベテランがfuture roster/財務を圧迫可能。
- 王朝維持を難しくする自然要因。

## 87. 市場価格

年齢・能力・ポジション希少性・FA年数・人気・タイトル・怪我・代替選手・市場供給等で変動。

---

# XII. 財務・人気・興行

## 88. 財務は深いが会計ゲームにはしない

収入:
- チケット
- 放映
- スポンサー
- グッズ
- postseason
- その他

支出:
- 選手年俸
- スタッフ
- スカウト
- 二/三/四軍
- 海外アカデミー
- 施設
- R&D
- 医療
- 国際活動

## 89. 観客動員

勝率だけでなく:
- 順位
- 優勝争い
- 前年
- スター
- 人気若手
- ブランド
- 地域市場
- 記録挑戦
- 大型補強

など。

## 90. 若手起用のtrade-off

能力不足の若手を一軍で使うこと自体に成長ペナルティを置かず、勝率・順位・興行・財務側のcostを中心にする。
人気若手なら興行面のプラスもあり得る。

## 91. 成功すれば支出も増える

優勝→収入増だけでなく:
- 年俸
- スタッフ価格
- FA引留め
- 期待値

も上がる。

---

# XIII. Organizational Innovation / 球団イノベーション

## 92. 固定施設ツリーではなく革新cycle

```text
新アイデア
→ 小規模実験
→ 成功/失敗
→ 拡大/撤退
→ 組織ノウハウ
→ 他球団模倣
→ 次の革新
```

## 93. 新しい獲得経路

例:
- ドミニカ以外の海外アカデミー
- 中南米常設拠点
- 韓国/台湾
- 豪州
- 欧州
- アフリカ
- MLB/MiLB若手
- MLB AA等とのnetwork
- 米国大学/JUCO
- 独立リーグ
- KBO/CPBL
- MLB draft契約不成立prospect
- 海外エリートprospect

## 94. 新しい育成環境

- 3軍
- 4軍
- development squad
- 二軍対外試合network
- 新winter league派遣先
- 海外短期留学
- 大学/独立との練習試合
- 投手/打撃lab
- biomechanics
- rehab center
- tracking環境

## 95. AI・データ・R&D

- AI映像解析
- AI scouting
- mechanics提案
- injury risk
- condition予測
- opponent model
- video classification
- player-development DB
- VR等

`AI Lv1→Lv2→Lv3` の単純tech treeにしない。

## 96. Network Capital

地域/組織との関係を蓄積資産にする。

- Latin America Network
- US College Network
- KBO/CPBL
- winter league
- research institute

等。

## 97. Knowledge Capital

- Pitching Development Knowledge
- Hitting Development Knowledge
- Biomechanics
- Scouting Analytics
- International Scouting
- Injury Management

人材移動で一部が他球団へ拡散。

## 98. first mover advantageは永続しない

成功した革新は他球団が研究・模倣する。

## 99. 金満だけが革新しない

大規模投資型と、安価だが不確実なアイデア型の両方を用意。
小規模球団も先行発見で優位を取れる。

## 100. 提案型UI

新施策はGM、スカウト、R&D責任者、監督、コーチ、海外スタッフ等から提案。
ユーザーは承認/小規模実験/却下/再検討等を選べる。
自分でprojectを起案することも可能。

---

# XIV. Global Baseball World

## 101. NPB外を生きた世界にする

海外は外国人候補供給装置ではない。
各選手に所属・契約・成績・成長・移籍・代表・引退の人生を持たせる。

## 102. 2026開始時の実在海外選手を可能な限り実装

優先候補:
- MLB
- AAA
- AA
- 主要MiLB
- MLB prospect
- KBO
- CPBL
- Mexico
- Cuba
- independent
- 主要大学/国際アマprospect（情報品質に応じて）

## 103. Real→Generatedを滑らかに移行

2026開始時は実在比率高。
未来世代ほどgenerated playerが増える。
境界を突然切らない。

## 104. 海外sim粒度を階層化

- NPB: full game sim
- MLB: medium/full
- AAA/AA: career/season sim
- 小規模海外: season aggregate
- 発展途上国: ecosystem + top prospects only

人物は存在させるが全試合を完全simしない。

## 105. MiLB career

- A→AA→AAA→MLB
- option/40-man/DFA/release等
- 海外移籍

を可能な範囲で再現。
2026のAA prospectが2030年代MLBスター/WBC代表になる世界を可能にする。

## 106. 晩年MLBスターのNPB来日

MLBで衰えた実在スターが:
- 出場機会
- 年俸
- NPB興味
- 家族
- DH/role

等から来日を希望し、NPB複数球団との争奪戦になる可能性。

## 107. 海外での再生→NPB復帰

NPB戦力外→KBO/CPBL/Mexico/independent→活躍/改造→NPB復帰。

## 108. 海外リーグレベル差

海外成績をそのままNPB換算しない。
league quality、環境、選手skillから成績を生成・評価。

## 109. 国・地域固有制度

世界を同じ自由市場ルールに統一しない。

候補:
- Cubaの政府/連盟関与
- MLB/MiLB制度
- KBOの制度・兵役等
- CPBL
- Mexico
- US college
- 独立

## 110. Cuba institutional state

候補field:
- overseas contract permission
- NPB/MLB permission
- destination freedom
- release fee
- federation share
- scouting access
- national-team policy
- visa/international relations

政府・連盟・NPB/MLBが交渉して制度が変わり得る。
国外移住/連盟離脱は高レベルのcareer eventとして扱い、具体的方法をシミュレートしない。

## 111. 政治・制度は一方向tech treeではない

自由化だけでなく規制強化、協定終了、ビザ問題等もあり得る。

## 112. 国際制度変更がNPB市場へ波及

例:
- MLB international draft
- Cuba協定
- KBO外国人制度

等でNPBの外国人市場が変わる。

---

# XV. 世界普及・国際大会

## 113. Country Baseball Ecosystem

国ごとのlatent state候補:
- Popularity
- Participation
- Youth Infrastructure
- Coaching Quality
- Facilities
- League Quality
- Professional Economy
- Scouting Connectivity
- Federation Quality
- International Reputation

## 114. 野球普及は経路依存

- WBC躍進
- 国内スター
- NPB/MLB academy
- WBSC支援
- 学校リーグ
- sponsor

等で競技人口・施設・league qualityが長期成長。
停滞・後退も可能。

## 115. アフリカ等の新市場

初期に弱い地域でも数十年の投資・成功で有力選手供給地域になり得る。
NPB球団がacademy/coach/scoutを置き世界普及へ関与可能。
投資した球団だけが永遠に独占せず、市場成長後は他球団/MLBも参入。

## 116. 新リーグ誕生

十分な人気・競技人口・資金・施設が揃えば、セミプロ→プロleagueが稀に新設。
頻発させない。
縮小/統合も可能。

## 117. 世界リーグレベルは動的

MLB/NPB/KBO/CPBL等のrelative levelを永久固定しない。
選手層・育成・資金・技術・国際流動で変化。

## 118. 国際大会を意味あるイベントにする

対象候補:
- WBC
- Premier12
- Olympic baseball（その世界の開催状況）
- U-18/U-23
- qualifiers
- international friendlies

意味:
- 名誉
- popularity
- scouting exposure
- overseas interest
- knowledge transfer
- relationships
- national baseball growth
- historical records

## 119. 国際大会負荷toggle

ユーザー体験保護のため:
- OFF: 身体疲労/故障リスク増なし
- LIGHT: 軽い一時疲労
- REALISTIC: 移動・登板負荷・故障等反映

OFFでも人気・名誉・scouting・世界普及等の意味は残す。

## 120. オールスターの意味

- 選出回数
- 初選出
- fan vote
- popularity
- sponsor/commercial
- 他球団選手との交流/技術共有
- historical prestige

## 121. 代表選考

総合能力順だけでなくrole、position balance、左右、直近状態、国際経験等を考慮。

## 122. 国際大会が国を変える

WBC等の躍進→人気→競技人口→施設→10〜20年後の選手供給というfeedback。

## 123. 国際大会史・新ライバル

大会別歴史、優勝、MVP、surprise、国同士の継続的ライバル関係を保存。

---

# XVI. League Governance / Rule Evolution

## 124. 制度は固定しない

選手会・NPB・球団・審判等が利害を持ち、提案・交渉・試験・採決・改正する。

## 125. Player Association

選手会が要求し得る例:
- FA短縮
- 人的補償見直し
- 最低年俸
- 登録日数
- 移籍自由度
- 故障者保護
- 日程
- 安全

## 126. 変更可能な試合ルール

- DH
- 申告敬遠
- pitch clock
- 牽制回数/plate disengagement
- base size
- base placement
- defensive shift restriction
- ABS full/challenge
- replay
- mound visit
- extra innings 12回
- 無制限延長
- tie-break runner
- 引き分け
- check swing challenge等将来ルール

## 127. 用具・環境

- NPB球/MLB球への変更
- 反発係数
- seam/aerodynamics
- ball size/weight許容範囲
- bat規格
- mound/field dimensions等将来候補

ルール変更で能力値を直接±せず、試合engineの物理・確率を変える。

## 128. Rule Proposal Engine

各変更を:

```text
提案主体
目的
変更対象
予想効果
支持/反対勢力
試験方法
採決/交渉
施行日
経過措置
結果
副作用
再改正
```

として扱う。

## 129. Minor/二軍での試験導入

将来ルールを一軍導入前に二軍/他league等でtest可能。

## 130. ドラフト制度をRule Engine化

変更軸:

### 1巡目
- 全球団入札抽選
- 完全ウェイバー
- weighted lottery
- MLB型lottery
- 希望入団枠
- 自由獲得枠
- 事前交渉

### 2巡目以降
- reverse standings
- snake
- NPB型交互
- lottery順継続

### pick
- trade可否
- compensation pick
- competitive balance
- rule violationによる剥奪

### 対象
- 高校/大学/社会人一括or分離
- independent
- international
- development draft

### 契約
- signing bonus limits
- bonus pool
- refusal
- re-entry

## 131. 過去制度の再登場も可能

希望枠・自由入団枠等をhistory inspirationとして、将来の異なる形の制度案として再登場可能。

## 132. Rule exploit → 論争 → 改正

制度趣旨の穴をユーザー/CPUが利用し、それが頻発すれば:
- 他球団
- 選手会
- league

が問題提起しRule Proposalへ進む。
永久攻略法にしない。

## 133. 球団数変更

12球団は2026初期条件。

将来:
- 14
- 16
- その他

を可能にする。
条件:
- 市場
- stadium
- ownership
- league revenue
- talent pool
- popularity

## 134. Expansion Draft

新球団誕生時に:
- 既存球団protect list
- unprotected player selection
- FA/外国人/スタッフ獲得

を実施。

## 135. League Structure変更

- セ/パ
- 地区制
- 1league
- CS方式
- wildcard
- Japan Series
- interleague games
- season game count

等をRule Engine候補にする。

## 136. 球団移転・売却・合併

理論上可能だが低頻度・慎重。
長期財務/市場問題を経て大事件として扱う。

---

# XVII. Governance / Integrity / Scandal

## 137. Governance & Integrity

個人だけでなく組織の:
- compliance
- internal reporting
- discipline
- cover-up tendency
- leadership

を持つ。

## 138. 甘い組織の悪影響

「犯罪率+20%」ではなく、小さな問題を放置しエスカレート/文化化しやすい構造。

## 139. 不祥事カテゴリ

低〜重大:
- 規律違反
- team conflict
- harassment
- violence
- theft等
- illegal gambling
- prohibited substances
- baseball betting
- match fixing
- information leak
- tampering
- illegal contract/payment
- draft rule violation
- cover-up

## 140. 制裁

- 注意
- fine
- suspension
- 二軍/一軍降格
- release
- draft pick forfeiture
- club sanction
- criminal caseなら法執行側処理（詳細手順はゲーム化しすぎない）

## 141. 頻度

重大事件は非常に稀。
50年simで「あの年の大事件」として記憶に残る程度を目安に校正。
軽微な規律/衝突はそれより多くてもよい。

## 142. 実在人物への架空重大犯罪を標準生成しない

- 実在人物: 開始時点までに確認された史実のみ。
- 将来の架空重大犯罪/ハラスメント等は標準では付与しない。
- generated人物: design上の対象にできる。

## 143. 不祥事後の球団対応

- 厳正対応
- 改革
- 隠蔽

で評判・sponsor・FA attraction・fan等への長期影響が変化。

---

# XVIII. 記録・歴史・ニュース

## 144. 選手史

保存:
- draft
- amateur history
- minor/二軍
- 一軍年度
- teams
- overseas leagues
- titles
- awards
- injuries
- transfers
- contracts
- representative teams
- staff career after retirement

## 145. 球団史

- 順位
- 優勝
- GM/監督
- 主力
- draft classes
- major trades/FA
- organizational innovations
- scandals
- rule-change positions
- stadium/market events

## 146. 通算・年度・球団記録

通算は年度集計のsumから算出し二重管理しない既存原則を維持。

## 147. ニュースは数字を物語へ変換

例:
- breakout
- record
- large transfer
- draft
- innovation
- new foreign pipeline
- rule proposal
- league expansion
- international upset
- scandal
- historical comparison

## 148. 「○○二世」・歴史比較

名選手本人を転生させるのではなく、似た新人が自然発生しメディアが「○○二世」「○○以来」と比較する。

## 149. 親子・血縁

元選手の子供がprospectとして登場可能。
能力コピーはしない。
親子二代記録等を保存。

## 150. 転生レジェンド

標準: **OFF**。

- 同一人物は一度だけ存在。
- 引退後はスタッフ等へ。
- optional fantasy modeとして転生ONを将来用意してもよい。

---

# XIX. 怪我・疲労・コンディション（未完成だが必須領域）

## 151. 長期能力と短期状態を分離

- latent ability
- fatigue
- form/condition
- injury

を混同しない。

## 152. 怪我

- short/long absence
- recurrence
- permanent loss
- rehab
- return progression

をPD-001D等で別model化。

## 153. 代表大会負荷はtoggle

国際大会参加での疲労・故障影響はユーザーがOFF/LIGHT/REALISTICを選べる。

## 154. 投手酷使・ベテラン休養

育成・起用とつながるが、詳細設計は今後。

---

# XX. 長期QA・アンチ攻略

## 155. 20/50/100年simulation

検査:
- ability inflation/deflation
- talent shortage
- age distribution
- career length
- peak distribution
- late bloomers
- long-lived stars
- busts
- league equilibrium

## 156. Competitive Balance QA

- 球団別優勝回数
- 連覇率
- 3連覇以上
- dynasty duration
- last→champion turnaround
- strength persistence
- revenue→wins
- FA flow
- age structure

## 157. Super-GM Agent

熟練プレイヤー相当の最適化AIを自操作球団役として50年以上回し、簡単に永久常勝できる穴を検査。

## 158. Exploit Search Agent

探索対象例:
- 若手一軍固定
- 高卒偏重
- FA全取り
- 高齢者即放出
- foreigner大量獲得
- 打撃型一塁→二遊間コンバート
- 特定市場独占
- rule loophole

現実では不合理なのにgameで最強の戦略を検出して修正。

## 159. No rubber band

強豪だから能力を裏で下げる/弱小だから新人を強くする等のhidden catch-up補正は使わない。

---

# XXI. 現時点で未完の大領域

次の項目は重要だが、まだ壁打ちが十分ではないため「削除」ではなくOPENとして保持する。

1. 怪我・疲労・コンディション詳細
2. 球場・新球場建設・改修
3. ファン・メディア・スポンサー・人気詳細
4. 球団財務モデルの具体式
5. 代理人市場の詳細
6. contract clauseの必要最小集合
7. national-team eligibilityの詳細
8. global league/country simの粒度とperformance budget
9. scandal frequency calibration
10. family/children generation policy
11. coaching/mentorship effect calibration
12. staff labor market
13. player association bargaining mechanics
14. expansion/relocation governance
15. future technology proposal generation
16. historical real-world player/license/data feasibility

---

# XXII. 実装前のResearch Program

このマスターを実装仕様に直結させてはいけない。

次工程:

1. NPB/MLB/MiLB/KBO/CPBL/WBSC/その他主要野球ニュースを大量探索。
2. 過去の制度改正、珍しい契約・移籍、育成革新、球団経営、国際発展、scandal、rule experiment、technology、facility、player development等から新しい機能候補を抽出。
3. このマスターとの差分を機械可読ledgerに追加。
4. 重複・低価値・複雑すぎる案を分類。
5. Ownerと再壁打ち。
6. その後にmodule priorityとMVP/Phaseを決める。
7. 初めて実装Codex taskへ移る。

PD-001A Age Datasetはbranch上に仕様があるが、**このdesign discoveryが続いている間はdispatchしない**。

---

# XXIII. Source-of-truth rule

機能要件の粒度は `docs/state/pennant_feature_requirements_20260824.tsv` を正本とする。
このmasterは人間向け統合説明。

News miningの実行正本:
`docs/tasks/CODEX_BASEBALL_NEWS_IDEA_MINING_20260824.md`

Program state:
`docs/state/pennant_design_program_state_20260824.json`

Wall-talk coverage audit:
`docs/audits/pennant_walltalk_completeness_audit_20260824.md`

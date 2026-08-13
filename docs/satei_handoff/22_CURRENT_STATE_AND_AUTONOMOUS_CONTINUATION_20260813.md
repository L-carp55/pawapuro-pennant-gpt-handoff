# 走力再構築 — 現在地と自律継続ルール

作成日: 2026-08-13
状態: **CURRENT / これを現在の単一正本として優先**
対象branch: `agent/claude-speed-redteam-20260812`

---

# 0. このファイルの目的

ユーザーがClaude CodeとGPTの間で毎ターン仲介しなくてよいように、現時点の事実・確定事項・未解決事項・次工程・停止条件を一つにまとめる。

**このファイルより前のhandoff / task文書に次工程の指示が残っていても、本書と衝突する場合は本書を優先する。**

ユーザーへの逐次確認は原則不要。下記の明示的な停止条件に到達するまで、自律的に調査・検証・実装候補作成を進める。

---

# 1. まず認識しておくべき引継ぎ上の失敗

GPTがClaude Codeへ戻す際のhandoffは不正確だった。

特に誤っていた点:

- Claude離脱時点を探索段階として記述したが、実際には走力の既存production modelが実装・較正済みだった。
- 既存モデルの三塁打・GIDP回避・内野安打・advance・UBR、多年pool、走力/走塁分離、blendDirect等を十分に引き継がなかった。
- GPT/Codex側の100人baselineを「NPB+中心」と書いたが、Claudeの機械検証で99人はNPB+速度のほぼ完全な一次関数だった。
- owner reviewの意図を「オーナーが走力目盛りを作る」に取り違えた。

これらは既にClaude red-teamで発見・訂正済み。**再度同じhandoffを信じて探索をやり直さない。**

---

# 2. 再利用する確定資産

以下は原則やり直さない。

- 既存Claude production speed model
- 2021-2025等の多年pool実装
- 三塁打 / GIDP回避 / 内野安打 / advance / UBR の既存componentと再現性重み
- 走力で説明できる進塁成分を除いた走塁得能の分離
- GPT/Codexの2026 NPB 100人 roster / NPB+ speed / exposure
- physical evidence ledger 459件
- high-confidence physical anchor候補113件
- PowerPro 2015-2026 long panel
- The Show collection
- ordinary SNS / Grok-X evidence
- targeted physical rescue / video negative findings
- 100人 owner review master table と再現スクリプト
- Claude independent red-team
- T-0198 `maxSeason` 修理
- rolling holdout訂正版
- 2026 advance追加情報テスト
- NPB+ direct CV
- NPB+→PowerPro label→blend の構造問題監査

---

# 3. 現在までに確定した重要結論

## 3.1 T-0198

`poolAcrossYears`等へ `maxSeason` を追加し、時間holdout時に未来年を除外できるよう修理済み。
未指定時の従来挙動は不変。テストPASS。

## 3.2 rolling temporal holdout

NPB+には過去年snapshotがなく、統計側だけY-1で切れるため、NPB+ blendの公平なrolling holdout比較は **NOT_IDENTIFIABLE**。

`statOpen`（未来情報を含む統計）はdiagnosticにのみ使い、acceptance criterionへ使わない。

## 3.3 NPB+自体

NPB+は無価値ではない。
選手単位CVで各現実アウトカムに信号を持つ。

ただし2026 advanceに対して、2021-2025統計モデルへ追加したときのincremental valueは、確認した閾値で一貫して0以下。

現時点の最も妥当な解釈:

> **全体ではNPB+が悪いのではなく、既存統計モデルと情報が冗長である可能性が高い。**

## 3.4 現行NPB+ blend経路

現行:

`NPB+ speed -> PowerPro label regression -> rating -> blend`

には少なくとも次の構造問題がある。

1. 教師値が現実でなくPowerPro
2. blend重みもPowerPro一致度由来
3. regression predictionが分散を縮める
4. 異なるscaleの量を混ぜている
5. PowerProがpriorとQAの両方になる循環

したがって、**現行経路をそのままproductionの正当なdirect evidence経路とは扱わない。**

## 3.5 絶対目盛り

`scale_calibration.走力` がPowerPro由来である問題は未解決。

これはrelative model（誰が誰より速いか）とは分けて扱う。

---

# 4. 現在の唯一の未解決分岐 — T-0203

次に実行するのは、**統計材料が薄い選手でだけNPB+に追加情報があるか**の層別検証。

理由:

全体で冗長でも、

- pooled yearsが少ない
- reliabilityが低い
- 過去PA / 走塁機会が少ない
- 新人 / 来日直後 / 少出場

ではNPB+が有用な可能性がある。

### 層の定義

PowerProとの差やNPB+との食い違いを使って層を作らない。
NPB+を見なくても分かる統計側の証拠量のみを使う。

候補:

- pooled years
- pooled statistical observation weight
- `traitRating` reliability
- 過去PA / component opportunity counts

閾値を結果を見て後付けしない。既存の自然なカテゴリまたは連続interactionとして扱う。

### 検証

2026 advance等、利用できる現実アウトカムに対し:

1. statistical model only
2. NPB+ only
3. statistical model + NPB+

を比較。

最低限:

- partial correlation / incremental association
- incremental R²等の増分
- cross-validated error differenceが可能なら実施
- sample size
- bootstrap等の不確実性
- reliabilityとのinteraction

を保存する。

PowerProは採否判定に使わない。

---

# 5. T-0203後の自動分岐

ユーザーへ途中確認せず、以下のルールで進める。

## A. 低reliability層でもNPB+の増分が確認できない

- relative modelでは現行 `NPB+ -> PowerPro label -> blend` を外す方向をproduction候補とする。
- NPB+ raw measurementは削除しない。
- conflict detector / QA / human review evidenceとして保持する。
- regression-based direct rating conversionは使用しない。

## B. 低reliability層でのみ明確な増分がある

- 一律blendを廃止。
- statistical reliabilityが低いときだけNPB+を補助するconditional modelを設計する。
- 重みはPowerPro一致度ではなく、現実アウトカムへのincremental valueを根拠にする。
- 過学習を避けるため、実装前にholdout/CV可能な範囲でQAする。

## C. 小標本等で判定不能

- 自動blendを使わない。
- low reliability選手ではNPB+をreview evidenceとして保持。
- relative modelは既存統計モデルをprimaryにする。
- 不確実性を明示する。

---

# 6. relative model分岐後に自律的に行うこと

1. 選択したrelative modelを別branchまたは明確なcommitで実装候補化
2. 既存テストをすべて通す
3. 100人表を再生成
4. 以前の表との差分を保存
5. PROJECT_EVIDENCE_CONFLICTを再診断
6. PowerPro stale/odd判定を再診断
7. owner review queueを再抽出

### owner review候補

最低限:

- relative model修正後も |raw project - PowerPro| >=5
- confidence LOW
- 強いphysical evidence conflict
- PowerPro stale/odd疑い
- AI側で原因未解決

ただし、スケール問題だけで大量選出される場合は、まずabsolute scale問題を分離する。

---

# 7. absolute scale（0-100）の扱い

relative modelと混ぜない。

現行 `scale_calibration.走力` はPowerPro由来なので、最終正本とはしない。

absolute scaleは最終的に:

- 自作エンジン内での走力値→実プレー現象の応答
- リーグ全体の三塁打・内野安打・進塁・盗塁等の分布
- 既存能力との整合

から校正する方向を優先する。

PowerPro分布はreference / QAとして表示してよいが、同じPowerProを教師値とQAの両方に使わない。

**このabsolute scale問題は、T-0203のrelative model決着を妨げない。**

---

# 8. ユーザーへ停止して確認する条件

以下のいずれかに到達するまで、逐次確認は不要。

1. T-0203がA/B/Cのどれにも分類できないほど方法論的に曖昧
2. 実装候補が複数あり、独立QAでも優劣が決まらない
3. owner review queueが完成し、実際にユーザーの野球観・PowerPro違和感が必要
4. absolute scaleの候補が複数あり、エンジンQAでも選べない
5. 新しい大規模外部データ収集が必要で、費用/規模/時間の判断が必要

それ以外は自律継続する。

---

# 9. 禁止事項

- ownerに走力の目盛り表を作らせて停止しない
- PowerProとの差だけでowner reviewを選ばない
- PowerPro一致率だけでモデルを選ばない
- NPB+が全体で冗長だからといってraw measurementを削除しない
- 未来情報を含むdiagnosticをholdout validationと呼ばない
- `NOT_IDENTIFIABLE` を無理にA/Bへ寄せない
- 既存のnegative findingを再調査して時間を浪費しない
- 重要な知見をchatだけに残さない

---

# 10. 現在地を一文で

> **データ収集は十分進んでおり、現在は既存の較正済み統計モデルを土台に、NPB+をどの条件で追加すべきか（T-0203）を最後に判定してrelative modelを確定し、その後100人owner review表を作り直す段階。ユーザーの逐次仲介は不要。**

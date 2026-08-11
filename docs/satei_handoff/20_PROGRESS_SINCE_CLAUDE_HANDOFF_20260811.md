# Claude Code離脱後の進捗差分 — GPT / Codexが何をどこまで進めたか

作成日: 2026-08-11  
状態: **CURRENT HANDOFF DELTA / Claude Codeの既存チャットからの差分**  
Repository: `L-carp55/pawapuro-pennant-gpt-handoff`  
Current handoff branch: `agent/speed-rebuild-handoff-20260811`

---

# 0. このファイルの目的

Claude Code側には、ブラウザGPTへ引き継ぐ前の走力再設計チャットが残っている。

そのため本ファイルは、プロジェクト全体を最初から説明するのではなく、

> **Claude Codeが最後に把握している地点から、ブラウザGPT / Codex側で何を新しく行い、どこまで進み、何が失敗して現在どこへ戻ったか**

だけを時系列で明示する。

Claude Codeは、自分の既存チャットとこのファイルを突き合わせて現在地を復元すること。

---

# 1. Claude CodeからGPTへ引き継いだ時点

Claude Code側では、走力・肩力が低く出る問題のうち、まず走力の再設計を進めていた。

引継ぎ直前の重要事項:

- 走力は盗塁技術・走塁判断と完全に分ける。
- 走力は単純な50m走タイムではなく、**野球における足の速さ**として考える。
- 最初の走行ステップから約90ftまでの移動能力を中心に考える。
- 内野ゴロイベント、一塁到達、走塁イベントを使えるか検討していた。
- `build_infield_grounder_events` 等、内野ゴロイベント生成処理の確認を行っていた。
- ユーザーから、内野安打○・走塁・盗塁などは別得能として存在するため、純粋な脚力と技術を完全に切り分けるよう明示された。
- 一方で、50mそのものを野球走力へ直結させないことも確認された。

この時点では、現在の100人査定、PowerPro長期パネル、SNS大量収集、The Show、historical anchor bank等はまだ統合されていなかった。

Claude Code側で最後にユーザーが求めたのは、次のチャットへ移るために必要な情報だけを保存し、その後ブラウザGPT側で続きを行うことだった。

---

# 2. GPTが最初に行った再設計

## 2.1 査定原則とcritical pathをGitHubへ固定

GPTは、Claude Codeからの引継ぎ後、まず走力研究を無制限に広げないために査定原則と作業順をGitHubへ固定した。

主要commit:

`179e03c76c4379f4372da722741b1a705df66974`

主要ファイル:

- `CLAUDE.md`
- `docs/satei_handoff/12_APPRAISAL_PRINCIPLES_20260809.md`
- `docs/satei_handoff/13_CURRENT_CRITICAL_PATH_20260809.md`

ここで定めた主な内容:

- 走力 = 一歩目から約90ftまでの身体的running ability
- 盗塁・走塁判断・打席から走行への移行は別
- NPB+ Sprint Speedだけでは加速を拾えない
- clean T90 / T30 / standardized short distanceを優先
- 古いデータは固定年齢減衰を置かない
- high-confidence anchor + pairwise + SNSを使う
- PowerPro / The Showは当初、独立査定凍結後の外部QAとして扱う

この最後のPowerPro境界は、後に**厳しすぎたため再撤回**される。

---

# 3. GPT / Codexで新たに収集・構築したもの

Claude Code離脱後、GPTは大規模なデータ収集をCodexへ委任した。

以下はClaude Codeが既存チャットで把握していない可能性が高い新規成果である。

---

## 3.1 2026 NPB 100人の身体証拠収集

branch:
`codex/speed-physical-evidence-full`

commit:
`94a26e7160a879ea0e13f4ddb91d4fdadc7c04e9`

行ったこと:

- 100人のNPB+ Sprint Speed以外の身体証拠を収集
- direct T90
- 30m / 50m
- electronic / photoelectric measurement
- home-to-first
- historical profile
- 測定時期
- PowerPro時系列との初期join

重要:

この段階では一塁到達等も保持したが、後の厳格化で多くを `CONTEXT_ONLY` にしてしまった。

---

## 3.2 年不明測定の時期推定

branch:
`codex/speed-measurement-date-resolution`

主成果:

- unknown短距離測定 35件
- 年推定 15件
- still unknown 20件

完全には解決していない。

---

## 3.3 2026 NPB+ exposure audit

branch:
`codex/npb-sprint-exposure-audit`

100/100について:

- games
- PA
- AB
- full-effort-run proxy

を取得。

重要negative finding:

- NPB+が選手別のqualified run count / sample countを公開していない

したがって少出場選手のSprint Speed下振れの信頼度問題は残った。

---

## 3.4 PowerPro 2015–2026 long panel

branch:
`codex/pawapuro-speed-history-panel`

commit:
`7d2e35dddd3f523c5c223813bdd65587605fe07b`

収集結果:

- 23,206観測
- 2,972 canonical player ID
- 58版
- 2013 / 2014も補助回収
- 2016–2026を広くcoverage
- 2015独立snapshotは欠損

**ただし重要:**

この時点では収集しただけで、PowerProの過去→現在変化から古い身体データをどの程度現在へ残すかというtemporal carryover modelは作っていない。

後にこの未実施をGate閉鎖後に発見した。

---

## 3.5 MLB The Show collection

別repository:
`L-carp55/claude-code-hub`

### Speed history

branch:
`codex/mlb-the-show-speed-history`

主結果:

- editions 21–26を中心に大量取得
- carry-forward主体で完全な歴史snapshotではない

### Temporal rescue

branch:
`codex/mlb-the-show-speed-temporal-rescue`

commit:
`ab5adbfee656d69d0b378145fd66bf5789e0d1b4`

結論:

`INSUFFICIENT`

理由:

- explicit Speed eventsはある
- negative eventが取れない
- unchanged controlsを特定できない
- update日前Statcastが取れない

したがってThe Showの**時間変化モデル**は作れなかった。

ただし後の再監査で、

> temporal modelが作れないことと、The Show SpeedをPowerProへ換算できないことは別問題

と判明した。

### Full attributes

`codex/mlb-the-show-full-attributes`

Speed以外にも、Arm Strength / Accuracy / Fielding / Reaction等を収集済み。

---

# 4. 100人decision packetとanchor構築

## 4.1 100-player decision packets

100人について、

- NPB+ current speed
- physical evidence
- exposure
- measurement era
- PowerPro trajectory QA
- review priority

を統合したpacketを作成した。

ただし、この時点では最終ratingは作らなかった。

重要な反省:

- pairwise edge 154本中、physical corroboratedは2本だけ
- 152本は実質NPB+最高速度の順位

後から見ると、anchor手法を作ったというより、NPB+順位を厳密な形式へ包装した部分が大きい。

---

## 4.2 Historical High-Confidence Anchor Bank

branch:
`codex/speed-historical-high-confidence-anchor-bank`

commit:
`dcf8637f4e94ae51af3bd8f9a99927bfb37bdef3`

結果:

- raw physical measurements: 459
- high-confidence anchors: 113
- current NPB+ moderate anchors: 100
- rejected/context-only: 202
- pairwise graph total: 200

重要:

ここでは、

- home-to-first
- 内野安打
- 盗塁・走塁結果
- PowerPro
- Prospi
- The Show

をanchor選択から意図的に除外した。

後の再監査では、この境界はphysical anchorを作る目的には妥当でも、**実用的なパワプロ風最終査定へそのまま適用したのが誤り**と判断した。

---

# 5. SNS調査を大幅に進めた

## 5.1 ordinary-web SNS

branch:
`codex/speed-2026-sns-consensus-tiebreak`

commit:
`44f35988e0fcadc59a59c11a299fc43f2158417a`

対象19人。

Xの公開検索制約が大きく、ほとんどが `INSUFFICIENT` になった。

---

## 5.2 Grok-X rescue

branch:
`codex/speed-2026-grok-x-sns-rescue`

commit:
`063f0013b2dc044d71c9cec6ed6209978805d2f5`

Grok-X `x_search` を使って再調査。

結果:

- query 175
- raw X hit 267
- unique candidates 191
- accepted X 41
- rejected 150

改善した例:

- 木下拓哉: 遅い方向を複数独立投稿が支持
- 岡大海: 速い方向を複数支持
- 藤岡裕大: temporal decline支持
- 並木秀尊: 現在も速い方向
- 塩見泰隆: 現在も速い方向
- 丸佳浩: temporal decline支持
- 土田龍空: mixed
- 梅野隆太郎: mixed
- 友杉・林: metric conflict残存

重要な失敗:

Grok-Xでは、

- genericな俊足/鈍足
- 走塁文脈
- game rating discussion
- PowerPro/Prospi査定へのコメント

をかなり厳しく除外した。

後の再監査で、特に**公式ゲーム査定へのコメントを別laneで収集すべきだった**と判断した。

---

# 6. PowerPro residual / acceleration監査

branch:
`codex/speed-powerpro-residual-structure-audit`

commit:
`a688d2f69ec9e38e54662f0f18757d184c5f8885`

目的:

PowerProとの差が、

- acceleration不足
- position prior
- archetype

等で説明できるか確認。

結果:

- position-correlated residualは確認
- current comparable acceleration evidence = 0
- acceleration原因は `NOT_IDENTIFIABLE`
- HP→1B単純残差はposition control後ほぼ相関0

当時はこれを理由にH2Fを強い入力へ上げなかった。

後の再監査では、

> 単純相関が低い = H2Fに情報がない

ではないと修正。

旧実装ではH2F単独でもPowerProとのtest correlation約0.59があり、複数本・左右打席・バント等を調整すれば加速情報として使える可能性がある。

---

# 7. targeted evidence rescue

branch:
`codex/speed-2026-final-targeted-evidence-rescue`

commit:
`9f664bfadd03fdbb8f3bc31790193abfd8de0f94`

対象18人。

行ったこと:

- 新6人へのGrok-X temporal search
- current physical evidence再探索
- old T90 provenance再監査

結果:

- 18/18 coverage
- current physical measurementは実質モンテロの2024 direct T90のみ
- 筒香2022 T90=4.20を `CONFIRMED_PRIMARY` に訂正
- 17人はvideoへ残った

---

# 8. video tie-break

branch:
`codex/speed-2026-final-video-tiebreak`

commit:
`50a28cc77c7c71a8d3101990555165ebb0428d36`

対象17人。

結果:

- candidate 32
- accepted source 1
- ordinal判定に使えるusable current full-effort video = 0
- 17/17 `VIDEO_INCONCLUSIVE`

重要な後日修正:

この結果は、

> 使える動画が世の中にない

ではなく、

> 今回の取得経路・厳格な採用条件では使える形にできなかった

というnegative findingに過ぎない。

当時はこれを「evidence routes exhausted」と解釈しすぎた。

---

# 9. 一度、100人blind final freezeまで進めた

branch:
`codex/speed-2026-final-reappraisal-freeze`

## Blind freeze

commit:
`7b82bb2030bf94f40d5983618f6e7362d8f2a06b`

100/100をPowerProを見ずに一度凍結した。

特徴:

- final rows: 100
- confidence: MEDIUM 6 / LOW_MEDIUM 87 / LOW 7
- blind-v3 baseline比で変更は実質モンテロだけ
- モンテロ 68 → 52
- 名原典彦は旧baselineなし

重要:

この結果は後に、

> 集めた証拠をほぼ点数へ使えず、NPB+最高速度中心の初期値へ戻ってしまった

と再評価された。

現在は**実用最終査定ではなく、NPB+ top-speed centered physical benchmark**として保存する。

---

# 10. PowerPro外部QAと一度目のGate閉鎖

final Gate branch head:
`1db37ed11bfb4070c03afe530c9dfb7c12244a79`

PowerPro 2026と99人厳密match。

主結果:

- final mean: 65.343
- PowerPro mean: 65.667
- MAE: 7.758
- RMSE: 9.839
- correlation: 0.776
- within 5: 44/99
- within 10: 66/99
- abs diff >10: 33
- abs diff >15: 11
- PowerPro閲覧後rating変更: 0

当時:

`2026 NPB 100-player SPEED APPRAISAL GATE: CLOSED AFTER REOPEN`

とした。

---

# 11. Gate閉鎖後、ユーザー指摘で設計上の問題を再発見

ユーザーから、

- PowerProの方が全体に違和感が少ない
- KONAMIは人員・時間・映像・データが多い
- 一塁到達等、こちらが除外したものを実際には査定へ使っているのではないか
- 昔のPowerPro→現在PowerPro変化からold physicalの持越しを決める工程が未実施ではないか
- SNSの棄却基準が厳しすぎる
- 公式査定へのコメントも集めるべき
- veteranにはPowerProのstale/inertiaがある可能性
- 秋山翔吾、過去の松山竜平等を人間が確認する必要
- Prospiも見るべき
- The Show→PowerPro変換で助っ人を補完できる

と指摘された。

GPTは再監査し、これらの指摘を**妥当と認定した**。

---

# 12. 再監査で判明した主要未実施・過度な排除

詳細は:

`docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`

主な問題:

1. PowerPro long panelを収集したがtemporal carryover policyを作っていない
2. H2Fを調整利用せずcontext-onlyに落とした
3. base-to-base / infield-grounder / infield-hit / GIDP / triples等を最終査定へ十分使っていない
4. SNSでPowerPro/Prospi査定へのコメントを明示的に除外
5. YouTube公式能力紹介コメント未収集
6. Prospi current/history未収集
7. The Show→PowerPro direct bridge未完成
8. owner reviewを100人走力へ接続していない
9. 5点以上乖離全員のowner裁定未実施
10. veteran stale PowerPro detector未実装
11. 113 anchorの多くは異年代・異指標で、実際のcurrent physical pairwiseは少ない
12. video acquisition failureをevidence exhaustionと扱いすぎた
13. PowerProを最後のQAだけに制限したため、実用査定の強いpriorとして使えなかった

---

# 13. Claudeへ戻す直前にGPTが行った最後の作業

現在branch:
`agent/speed-rebuild-handoff-20260811`

このbranchでは、GPTが以下をGitHubへ正本化した。

## 13.1 Gateを再度OPEN

`docs/satei_handoff/17_SPEED_GATE_REOPENED_20260811.md`

正式状態:

`ACTIVE / REOPENED`

旧16 GateはSUPERSEDED。

## 13.2 新critical path

`docs/satei_handoff/18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`

新しい順序:

1. Claude independent red-team
2. PowerPro temporal / stale audit
3. context-inclusive acceleration
4. The Show→PowerPro bridge
5. Prospi
6. community appraisal / YouTube comments
7. owner review
8. 100-player practical reappraisal
9. simulation QA
10. owner final approval

## 13.3 Claude handoff

`docs/satei_handoff/19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`

## 13.4 comprehensive gap audit

`docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`

## 13.5 progress delta

本ファイル。

---

# 14. GPT/Codex側で「かなり進んだ部分」と「まだ完成していない部分」

## かなり進んだ / 再利用すべき

### データ・インフラ

- 2026 NPB 100人 roster / NPB+ speed
- 100人physical evidence ledger
- measurement-date resolution
- exposure audit
- PowerPro 2015–2026 long panel
- The Show 2021–2026 collection
- full attribute collection
- 459 physical measurement ledger
- 113 high-confidence physical anchor candidates
- ordinary-web SNS
- Grok-X 191 candidate / 41 accepted X posts
- targeted evidence packets
- video candidate ledger
- 100-player PowerPro QA
- reproducible scripts / QA / provenance

### 重要な個別証拠

- モンテロ 2024 direct T90 4.20
- 筒香 2022 T90 4.20 provenance correction
- カリステ 2017 direct T90
- 秋山 2021 direct T90
- ポランコ 2021 direct T90
- サンタナ 2020 direct T90
- 林 / 友杉 / 奈良間 2022 electronic 50m cohort
- SNSで木下・岡・並木・塩見・藤岡・丸等の方向情報

これらはやり直さず再利用する。

---

## まだ完成していない / Claudeに再設計してほしい

### 走力モデルそのもの

- top speed + acceleration + practical evidenceの統合方法
- PowerPro priorの強さ
- stale/inertiaの検出方法
- historical physical carryover
- H2F調整モデル
- base-to-base / outcome proxyの使い方
- Prospiの位置づけ
- The Show→PowerPro変換
- rating-community consensus
- owner verdict integration

### 100人最終値

**未完成。**

現在の100人freezeをproduction finalとみなさない。

---

# 15. Claude Codeへ期待する最初の仕事

Claude Codeは、GPTが作った再構築案を実装するのではなく、まず独立red-teamする。

特に自分の過去チャットと比較して、

- Claude時代に検討していたのにGPT側で消えたもの
- GPT/Codexが新しく追加したが不要なもの
- GPTの94項目監査にもまだ漏れているもの
- 循環査定・二重計上
- PowerProへ寄せすぎる危険
- 逆に独立物理へ寄せすぎる危険

を指摘する。

**まだ100人の再査定やコード実装を始めない。**

---

# 16. 現在の役割分担

ユーザーの希望により、今後は同一AI系の思考偏りを避ける。

- Claude Code: 査定思想・壁打ち・独立red-teamの主担当
- Codex: 大量データ処理・実装・再現可能な成果物
- GPT: Claude案/Codex結果の独立レビュー・統合・漏れ監査
- User / Owner: 最終査定責任者。PowerPro違和感・stale候補等を裁定

---

# 17. 一言で現在地を表すと

Claude CodeからGPTへ引き継いだ後、**データ収集・QA・GitHub正本化は大幅に進んだ**。

一方で、最終査定ロジックは厳密化しすぎた結果、情報を捨てすぎてNPB+最高速度中心へ戻ってしまった。

その失敗をGate閉鎖後に認め、現在は:

> **大量に集めたデータを捨てずに使う「実用的なパワプロ風走力査定」をClaude Code主導で再設計する直前**

である。

肩力にはまだ進んでいない。

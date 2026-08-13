# 走力再構築 — Claude Red-Team後の正しい継続地点

作成日: 2026-08-13  
状態: **CURRENT / CONTINUE FROM HERE**  
Branch: `agent/claude-speed-redteam-20260812`

---

## 0. 最重要訂正

GPTが作成した `20_PROGRESS_SINCE_CLAUDE_HANDOFF_20260811.md` は、Claude Code離脱時点の描写が不正確だった。

Claude Code自身の独立red-teamで、離脱前には走力モデルがすでに実装・較正済みだったことが確認された。

正本として優先する:

- `docs/audits/speed_rebuild_independent_red_team_20260812.md`
- `docs/audits/speed_rebuild_redteam_addendum_npbplus_linearity_20260812.md`
- Claude Code側に残る既存チャット履歴

`20_PROGRESS...` は歴史資料としてのみ扱い、Claude離脱時点の事実認定には使わない。

---

## 1. Claude red-teamで新たに確定した重要事実

### 1.1 既存の走力モデルは実装・較正済みだった

既存production pipelineにはすでに:

- 直近5年プール
- triple
- GIDP avoidance
- infield hit
- advance
- UBR
- 翌年再現性ベースのcomponent weight
- baserunningAbilityで走力寄与を残差化
- NPB+実測を信頼度加重でblendする `blendDirect`

が存在する。

したがって、これらを「これから新規に作る」と扱わない。

### 1.2 GPT/Codex 100人baselineはNPB+速度の完全な一次関数だった

Claudeの機械検証:

```text
rating = -218.0884 + 8.9752 × NPB+速度(km/h)
n = 99
r = 1.000000
R² = 1.000000
最大残差 = 0.000544点
```

final freezeで実質的に点を動かしたのはモンテロ1人のみ。

つまりGPT/Codex側で収集したphysical evidence / anchor / SNS / exposure / video等は、最終点へほとんど接続されていなかった。

### 1.3 Claude red-team自体は完了している

今はred-teamをやり直す段階ではない。

red-team成果は再利用するが、その後に作成されたOWNER_SPEED_ANCHOR_SHEET / V2 TABLEは、オーナーの意図を取り違えたため**現在の作業ではない**。

---

## 2. オーナーが元々求めていた作業

オーナーがレビューしたいのは「走力の目盛りをゼロから決めること」ではない。

まずAI側で100人全員について、次を1枚の比較テーブルへ整理する。

1. GPT/Codexが査定した走力
2. その査定根拠
3. 査定信頼度
4. KONAMI / PowerProの現在走力
5. PowerPro走力の過去から現在までの推移
6. 両者の差
7. 差が大きい場合、なぜ差が生じたと考えられるか
8. PowerPro側がstale / 維持されすぎている可能性
9. project側がNPB+ top speedへ寄りすぎている可能性
10. physical / SNS / exposure / temporal evidence conflict

そのうえで、**レビュー対象だけ**をオーナーへ提示する。

---

## 3. オーナーがレビューする対象

最低限:

- `abs(project_rating - powerpro_rating) >= 5`
- project confidence = `LOW`
- metric/evidence conflictが大きい
- PowerPro stale/inertia疑いがある

`LOW_MEDIUM` 87人全員を自動的にowner reviewへ回さない。
ただしmaster tableにはconfidenceを全員分表示する。

PowerPro乖離だけでowner review母数を決めるというClaude red-teamの懸念も残すため、**LOW/conflict/staleも独立トリガー**にする。

---

## 4. 今すぐ作るべき成果物

正しい次タスクは:

`docs/tasks/OWNER_SPEED_REVIEW_MASTER_TABLE_TASK_20260813.md`

で定義する。

### 必須成果

1. 100人全員のmaster CSV/JSON
2. 読みやすいmaster Markdown
3. owner review対象だけのMarkdown
4. discrepancy reasonを作った根拠台帳
5. QA

オーナーはmaster tableを見た後、レビュー対象の各選手についてPowerPro / projectのどちらが不自然かを裁定する。

---

## 5. OWNER_SPEED_ANCHOR_* の扱い

以下は**作業中止 / SUPERSEDED**:

- `docs/tasks/OWNER_SPEED_ANCHOR_SHEET_20260812.md`
- `docs/tasks/OWNER_SPEED_ANCHOR_TABLE_V2_20260812.md`

理由:

オーナーに量→点数の目盛りを作らせることは、今回の継続タスクとして依頼されていなかった。

Claude red-teamの「独立アンカーが必要」という設計論そのものは残す。
しかし、その設計論を実装するかは、100人比較レビューと既存production modelとの比較を見た後に決める。

**オーナー記入待ちで停止してはいけない。**

---

## 6. PowerProをどう扱うか

現時点ではPowerProを無条件の教師値にしない。

しかし比較テーブルでは詳細に扱う。

特に:

- current PowerPro
- change points / edition history
- 何年間ほぼ据え置きか
- age / injury / current physicalとの不整合
- community rating comments（既存分があれば）

を並べる。

ベテランstale候補（例: 秋山翔吾、過去の松山竜平型）は、差の大きさに関係なくreview flagを立てられるようにする。

---

## 7. 既存Claude production modelも比較材料として残す

GPT/Codex freezeだけを「projectの唯一の査定」とみなさない。

Claude red-teamが確認した既存production speed modelの出力が同じ100人へ再現可能なら、master tableへ別列で載せる。

例:

- `gpt_codex_physical_rating`
- `existing_production_model_rating`
- `powerpro_current_rating`

ただし、ユーザーが直接レビュー対象として指定した「あなたの査定」はGPT/Codex freezeを指すため、その列を消さない。

既存production modelは**control / reference**として追加する。

---

## 8. この工程でまだ行わないこと

- ownerに走力アンカー点数を付けてもらう
- 新しい最終査定式をfitする
- PowerProへ合わせて補正する
- 100人のfinal ratingを書き換える
- 肩力へ進む

まず比較テーブルを完成させ、オーナーレビューを受ける。

---

## 9. 一言で現在地

**Claude red-teamは完了済み。次は「アンカー作成」ではなく、100人のproject査定・根拠・PowerPro現在値/履歴・乖離原因を1枚に統合し、差大/LOW/conflict/staleだけをオーナーへレビュー依頼する段階。**

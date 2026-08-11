# パワプロ風ペナント開発 — Project CLAUDE.md

> 個人で楽しむための、パワプロのペナント機能を改善したシミュレーター。試合を手動プレイする機能は作らない（試合結果は全自動計算）。

## ★ 2026-08-11 CURRENT OVERRIDE — 最優先

走力査定は一度 `CLOSED AFTER REOPEN` まで進んだが、後続のowner reviewと全数監査により**再度ACTIVEへ戻った**。

現在の最優先正本:

1. `docs/satei_handoff/17_SPEED_GATE_REOPENED_20260811.md`
2. `docs/satei_handoff/18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`
3. `docs/satei_handoff/19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`
4. `docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`
5. `docs/satei_handoff/12_APPRAISAL_PRINCIPLES_20260809.md`

`13_CURRENT_CRITICAL_PATH_20260809.md` と `16_SPEED_GATE_FINAL_AFTER_REOPEN_20260811.md` は履歴資料。進行判断では17/18/19を優先する。

現在の正式状態:

```text
2026 NPB SPEED APPRAISAL GATE: ACTIVE / REOPENED
```

肩力へ進まない。

### Claude Codeの現在役割

Claude Codeは**査定思想・壁打ち・独立red-teamの主担当**。まず19のhandoffを読み、すぐ実装せず現行再構築案を批判する。

Codexは大規模データ処理・実装、GPTは独立レビュー、オーナーは最終裁定を担当する。

### 走力で変更された重要原則

- PowerProは単なる最後のQAではなく**強いprior**として使う。ただしベテラン・故障後・長期据え置きではstale/inertiaを疑う。
- PowerProとの差**5点以上を大きな乖離**とし、全員owner reviewへ回す。
- 一塁到達・塁間走・内野ゴロ等は交絡があるからといって0情報にしない。交絡を記録しlow/medium confidenceで使う。
- SNSは身体速度への言及だけでなく、PowerPro/Prospi査定へのhigh/low/staleコメントも別laneで使う。
- KONAMI/Prospi公式YouTube能力紹介コメントも査定community evidenceとして利用する。YouTube API、CSV/JSON、ownerのコピペ投入を許可する。
- 助っ人等で測定時点のPowerProが無い場合、MLB The Show→PowerPro変換を統計的に作って補完する。
- genericな俊足/鈍足、走塁結果を含む投稿、動画context等は「完璧でないから棄却」ではなく、弱い証拠として保持する。
- 旧blind final freezeは削除せず `physical_speed_estimate` 系列の中間成果とする。実ゲーム採用値は今後の `practical_powerpro_style_speed`。

## 最上位目的
本家ペナントの4つの不満を解消したペナントシミュレーターを完成させ、オーナー（ユーザー）が長期ペナントを楽しめる状態にする:
1. 選手の成長と衰えの雑さ
2. CPU球団の頭の悪さ（ドラフト・トレード・FA・編成）
3. 記録・数字の物足りなさ（通算記録・タイトル史・球団史）
4. 球団経営の浅さ

## 確定済みの設計判断（2026-07-31 オーナー確定）
- **査定の照準は自作エンジン整合**: 「能力→成績」変換はこちらが定義し、査定（成績→能力）はその逆算として一体設計する。KONAMI比較は参考チェックに格下げしていたが、走力では2026-08-11追補によりPowerProを強いpriorとして使う。stale検出とowner裁定を必須とする。
- **カープ黄金期13人・WBC28人は検証用題材**: 査定パイプライン完成後の最初のテストケースとして使う
- **投手は球速・球種も計算に組み込む**: ただし実在投手の球速・球種は「実際の奪三振率・与四球率・被弾率を再現するよう逆算」で割り当てる（根拠なき係数を置かない原則との両立）。近年投手は公開データから直接取得
- **選手データ**: 実在NPB選手ベース＋以後のドラフト新人は架空生成
- **UI**: ブラウザで動く画面付き（ローカル起動、公開しない）

## 正本
- 査定思想・数式・失敗ログの正本 = `docs/satei_handoff/`
- **2026-08-11以降の走力の現在作業順 = `18_CURRENT_CRITICAL_PATH_SPEED_REBUILD_20260811.md`**
- Claude Code再開 = `19_CLAUDE_CODE_HANDOFF_SPEED_REBUILD_20260811.md`
- comprehensive gap audit = `docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md`
- `12_APPRAISAL_PRINCIPLES_20260809.md` は一般原則。ただし走力で17/18/19と矛盾する旧「PowerProはfreeze後だけ」「HP→1Bはcontext-only」等は2026-08-11追補を優先する
- `13_CURRENT_CRITICAL_PATH_20260809.md` は履歴資料
- `16_SPEED_GATE_FINAL_AFTER_REOPEN_20260811.md` は旧Gate記録。17によりSUPERSEDED
- 統合設計 = `docs/design/integration_design_v0.md`
- 旧仕様 `11_LEGACY_REFERENCE_V1_9.md` は歴史資料。新設計と混同しない

## データソース
- **プロEYE球** (`https://proeyekyuu.com/ja/csvs-jp/`): 1936-2025年（1945欠）の打撃・投手・守備CSV。利用自由・出典表記歓迎。選手ID付きで年またぎ追跡可能
- **NPB公式は取得元にしない**（二次利用禁止の明記あり）
- Nippon Baseball Data Repository (GitHub, MIT): 名簿2018-2026・ドラフト2004-2025。年齢・投打の補完候補
- 一括取得の実行前は規模（ファイル数）をオーナーに明示する（Hub法務境界ルール準拠）

## 開発原則（査定引継ぎから継承）
- 同じ情報を能力と特殊能力に二重計上しない
- エラーは捕球のみ。守備力に入れない
- 盗塁数と走力を混ぜない
- 少サンプルは減点でなくPrior回帰（経験ベイズ）
- 欠損を0にしない（null / 0 / 推定+フラグを区別）
- **不完全な情報も0にしない。** 交絡・信頼度・時点を保存して低重みで使えるようにする
- 係数のハードコード禁止。未校正値は設定ファイルに分離し根拠を記録
- 計算ログ（入力・途中式・出典）を全選手で保存
- **本塁打数はパワーそのものではなく結果指標。** EV/Max EV、Barrel%、Hard-Hit%、ISO、xSLG、HR/FB、Launch Angle等から長打生成能力を先に評価し、HRは整合性QAへ回す
- **ミート/パワー相互作用は「ミートを先に確定→その後パワー」の順序で扱う。** 同じ相互作用を両能力から同時に差し引いて二重弱体化しない
- **走力は最初の走行ステップから約90ftを移動する身体能力。** 盗塁技術・走塁判断とは分離するが、H2F等の混合観測は調整済み補助情報として使う
- **NPB+ Sprint Speed→T90は未較正。** 最高速度だけで最終査定しない
- **少出場選手の低Sprint Speedは最大努力走行の未観測を疑う。** サンプル数/走行機会、PA、試合数を信頼度に反映し、固定PA閾値で自動減点しない
- **データ不足選手はアンカー・SNS・公式ゲーム査定・owner reviewを組み合わせて補完可能。**
- PowerPro / Prospi / The Showは用途とprovenanceを分離する。PowerProは強いpriorだがstale flagを持つ
- **大規模なread-heavy収集をCodexへ委任する場合、サブエージェントによる並列実行をプロンプトで明示する。** 年代/球団/ソース別Agent＋独立QA Agent、別中間ファイル、親Agentのみ最終統合を原則とする
- **Codex / Claudeの最終チャット回答は正本にしない。** 重要な結論・coverage・制約・欠損・negative finding・QA・owner verdictは必ずGitHubへ保存し、`final responseにしか存在しない重要知見 = 0` とする
- **校正の答え合わせは「12球団×143試合を回した時のリーグ全体の成績分布が実データの分布と一致するか」**。走力ではinfield hit、extra-base advancement、GIDP回避等の関連分布もQAする

## 技術方針
- TypeScript + Node.js（エンジン・査定とも同一言語でブラウザUIと共有）
- データはSQLite（Hub実績あり）＋生CSVは data/raw/ に保存
- UI: ローカルWebサーバー＋ブラウザ。フレームワークは実装開始時に決定

## ★守備位置の表記が経路ごとに3種類ある（2026-08-05に3回踏んだ）
新しいデータ源を守備位置で結合する前に、必ずどの表記か確認する。素通しで結合すると**エラーにならず黙って対象0件・全員が既定の分岐へ落ちる**。
- `bm_fld`: 英語 `1B/2B/3B/SS/LF/CF/RF/C/P`
- `v_fielding`・DELTA: 日本語1文字 `一/二/三/遊/左/中/右/捕/投`
- 対応表 `POS_JA = {'1B':'一','2B':'二','3B':'三','SS':'遊','LF':'左','CF':'中','RF':'右','C':'捕','P':'投'}` を再利用する
- 較正済み位置別基準は較正側表記を保持するため、参照時に必ず変換を確認する

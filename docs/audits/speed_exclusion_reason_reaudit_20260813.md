# 走力 — 誤った理由で除外・0情報化されたデータ/タスクの再監査

作成日: 2026-08-13
状態: **CURRENT / EXCLUSION REAUDIT**
正本: `docs/state/speed_exclusion_reason_ledger.tsv`

## 0. 結論

「未実施タスク」監査とは別に、**一度見つけた/作ったデータや研究を、誤った理由・古い目的関数・過剰なstrictnessで無効化していないか**を監査した。

現時点で25の除外パターンを分離した。

- **再評価が必要**: 18
- **除外の範囲を限定すれば妥当**: 7

中心的な再発パターンは次の5つ。

1. `不完全 → 0情報`（手計測、時点不明、複合指標、主観情報）
2. `少サンプル → null`（固定機会数閾値）
3. `別proxyと相関が落ちる → 交絡調整をしない`（UBRを物差しにした内野安打）
4. `negative finding → 隣接レーンまで無効`（The Show temporal、strict acceleration、video）
5. `翌年を当てない → 年度査定には使わない`（repeatability weight、triple separation）

これらはowner review前に再評価する。

---

## 1. 明確に再評価すべきもの

### 1.1 30m/50m・プロフィール計測

旧strict pathでは、protocol不明・手計測・年代不明の30m/50mをnumeric T90から除外した。

**正しい切り分け:**

- `30m/50mを距離比例でT90へ変換しない` → 正しい
- `protocol不明だから30m/50m自体を0情報にする` → 誤り

測定方法・年代・source qualityを保存し、historical/profile physical rangeとして使う。

### 1.2 測定時点が曖昧な身体測定

exact date/yearが不明であることはcurrent direct扱いを弱める理由だが、identity/sourceが確認できる測定自体を消す理由ではない。

`measurement date unknown` と `evidence absent` を分離する。

### 1.3 Home-to-first / H2F

旧後工程で `CONTEXT_ONLY` を「点数には一切使わない」に近く運用した。

H2Fは左右打席・スイング移行等を含むためpure T90 converterにはしないが、旧較正でもsignal自体はあった。L/R・bunt/normal・effort・sampleを持つlow-to-medium acceleration evidenceへ戻す。

### 1.4 実戦proxy全般

- base-to-base
- infield grounder
- infield hit
- GIDP avoidance
- triples
- extra-base advancement
- pinch-runner usage

は交絡がある。しかし交絡があることと情報が0であることは別。

純粋脚力と走塁技術の切り分け・打球/球場/左右等の調整を行い、残った方向情報を低〜中重みで使う。

### 1.5 advanceの固定機会数閾値

現行 `running.mjs` は `advanceChances < min_chances` の観測を丸ごと落とす。

旧文書自身が、俊足選手ほど盗塁等で対象場面が減り、周東のような選手が閾値で漏れうることを記録している。

少サンプルはposterior uncertaintyの問題であり、観測値の不存在ではない。統計量が定義可能なら値を保持し、shrinkage/interval/confidenceで扱う。

### 1.6 内野安打のGB率交絡

現行設定は、GB率を調整するとUBRとの相関が下がることを理由にGB交絡を残している。

しかしUBRも走塁判断・機会等を含む混合proxy。純粋走力のconstructを評価する際に、`UBRとよく相関する`だけで交絡を残すのは不適切。

current physical measurementsとの同時点整合、打球タイプ交絡、二重計上リスクで再評価する。

### 1.7 三塁打の走塁成分分離

分離実験そのものは実施済みだが、`翌年再現性が悪化したから分離しない`という採否理由はowner ruleに反するため撤回済み。

同時点construct validityで再判定する。

### 1.8 component weights

三塁打/GDP/内野安打/UBR/advanceのweightを翌年再現性そのものにした旧方式はfinal annual appraisalには使わない。

### 1.9 automatic multi-year pool

`翌年をよく当てる / 身体能力は年で変わりにくい`ことを理由に全員を前後年poolする旧方式は、`基本はその年だけで査定`というowner ruleに反する。

historyを捨てるのではなく、少出場・故障・明らかな下振れ・temporal bridging等の条件付きpriorへ戻す。

### 1.10 SNS rating / generic label

- game-rating discussionをphysicalでないため除外
- genericな俊足/鈍足を曖昧として除外

はいずれもレーンを分ければ有用。Rating Consensus / weak directional evidenceへ救済する。

### 1.11 Video

pure current T90でないため `VIDEO_INCONCLUSIVE` としたnegative findingはそのレーンでは正しいが、context video・加速印象・同一選手のrepeat-runまで0情報に拡張してはいけない。

### 1.12 Pairwise

exact physical corroborationを要求しすぎ、100人で実質的な `CLEARLY_FASTER/SLOWER` が0になった。probabilistic/range pairwiseへ変更する。

### 1.13 The Show temporal

lag/temporal responseが `NOT_IDENTIFIABLE` だったことはsame-time conversionの否定ではない。The Show→PowerPro same-time bridgeとeligible foreign applicationは独立タスク。

### 1.14 strict acceleration prior

current direct acceleration evidence不足でalpha=0だったnegative findingは、strict direct laneだけに限定する。H2F/context/scoutingのweak acceleration evidenceを同時に無効化しない。

---

## 2. 除外そのものは妥当だが、範囲を限定すべきもの

- 盗塁数/成功率を**生のまま基礎走力へ**入れない
- 30m/50mを距離比例でT90へ変換しない
- 3年以上離れた身体測定をsame-year directと呼ばない（ただしhistorical evidenceとして残す）
- 同一測定の転載を独立証拠として重複計上しない
- 同一SNSイベントの100コメントを100独立観察にしない
- Gold Gloveを能力点の直接入力にしない
- 本文未確認の検索snippetをnumeric physical evidenceにしない

この7つは「データを消す」のではなく、**使ってよい用途を限定する**という意味で維持する。

---

## 3. 走力以外にも同系列の既知例がある

これは肩力/守備へ今すぐ進むという意味ではない。Speed Gate後の再開時に再発させないためのdebt記録。

### 3.1 NPB+送球速度を全ポジションで混ぜてfalse negative

全68人では相関がほぼ0だったため当初「送球速度は肩力に使えない」と報告したが、ポジション層別後に捕手では強い関係が出た。異質集団をpoolしたことでsignalを消していた。

### 3.2 守備の併殺材料

DPS/DPTのweight、DPFの不採用に翌年再現性を使っている。翌年再現性を年度査定の採否にしないowner ruleに照らし、守備再開時に再監査が必要。

### 3.3 守備力/捕球のshrinkage

fielding/catchingのkappaの一部もyear-to-year correlationから決めている。年度査定のsample uncertaintyと翌年persistenceを混同していないか再監査が必要。

### 3.4 送球失策parser

内野ゴロの悪送球276件は、当初イベント表記をparserが拾えず丸ごと落ちていた。後に修正済み。これは「データが無い」と「parserが読めていない」を区別する必要性の既知例。

### 3.5 打球方向

当初「引っ張り率は公開されていない」としたが、実際にはraw NF3 2,098ページに既に存在し、parserが読み飛ばしていただけだった。後に1,024人分を抽出して修正済み。

### 3.6 第1階層の守備/肩/捕球

`直接計測が不完全だから使えない`を「材料の限界」と報告したが、後に正本自身が「第1階層未着手だっただけ」と訂正している。

これらは `docs/state/project_wide_exclusion_policy_debt_20260813.tsv` に保存する。

---

## 4. 再発防止

1. `speed_exclusion_reason_ledger.tsv` を除外判断の正本にする。
2. 不完全/少サンプル/交絡ありは自動0情報理由にしない。
3. `変換が無効` と `元データが無価値` を別判定にする。
4. negative findingのscopeを必ず明記する。
5. proxyを別proxyやPowerProとの相関だけで採否しない。
6. 固定sample thresholdで観測済み値をnullにする箇所をコード監査する。
7. final owner review / Speed Gateは、再評価必要なexclusion ledger行が残る間fail closedにする。

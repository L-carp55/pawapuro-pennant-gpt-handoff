# Community rating run1/run2 — Hub側成果のcanon統合記録

作成日: 2026-08-13
状態: **raw / provenance / 失敗診断のみを統合。task statusは移植していない**

## 0. なぜこの記録が要るか

community rating の run1/run2（収集の再実行）は、canon repository ではなく
**Hub側の古いスナップショットフォルダ**（`claude-code-hub.git` 内 `パワプロ風ペナント開発/`）で
実行されていた（経緯 = `speed_2026_session_position_20260813_2.md`）。

オーナー指示（2026-08-13）:

> 旧Hub側のcommunity run1/run2についてはstatusを移植せず、raw/provenance/失敗診断だけを
> 検品してcanonへ統合してください。**取得失敗をnegative findingにしないでください。**

## 1. 統合したもの（56ファイル / 4.56MB）

| 種別 | 内容 |
|---|---|
| raw | `speed_community_rating_raw_20260813_run2.jsonl`（473行）/ `.csv`、Grok-X再分類150件、Prospi current/historical、YouTube inventory |
| provenance | `speed_community_rating_build_manifest_20260813_run2.json`（入力SHA-256・件数・区分別内訳）、各laneのexecution log、`_staging_*`（統合前の生取得） |
| QA | `speed_community_rating_rescue_20260813_run2_qa.json` / `.md`、独立QA snapshot |
| 失敗診断 | run1 failure analysis（canonへ既存）、run2 CC検品記録、`speed_community_rating_legacy_restore_run2.json`（旧出力汚染3件の復元sha256照合） |
| 再現性 | 収集・QA・復元スクリプト（Python 7本） |
| 参考 | run1のレポート本体（**実バイトがASCIIで日本語が全て`?`に化けている**。信頼できないが失敗の証拠として保存） |

**検品**: raw jsonl 473行がQA記載の`Raw=473`と一致、manifestの`reclassification_inputs`が
非空（run1で空だった箇所）、UTF-8で置換文字なし——を統合後のcanon側ファイルで再確認済み。

## 2. 移植しなかったもの（重要）

Hub側のregistryでは以下のstatusを付けていたが、**canonへは一切移植していない**。
canon側のSP-032〜037/054/055は **NOT_STARTED のまま**。

| task | Hub側で付けた status | canon | 移植しない理由 |
|---|---|---|---|
| SP-032 | DONE_VALIDATED | NOT_STARTED | 下記§3 |
| SP-033 | **DONE_NEGATIVE_FINDING** | NOT_STARTED | **★取得失敗/bounded coverageをnegative findingにしていた** |
| SP-034 | **DONE_NEGATIVE_FINDING** | NOT_STARTED | **★同上** |
| SP-035 | BLOCKED_MISSING_DATA | NOT_STARTED | 下記§3 |
| SP-036 | DONE_VALIDATED | NOT_STARTED | 下記§3 |
| SP-037 | DONE_VALIDATED | NOT_STARTED | 下記§3 |
| SP-054 | DONE_VALIDATED | NOT_STARTED | 下記§3 |
| SP-055 | DONE_VALIDATED | NOT_STARTED | 下記§3 |

## 3. ★SP-033/034を`DONE_NEGATIVE_FINDING`としたのは誤りだった

Hub側で「PowerPro公式YouTube 4動画257コメント / Prospi公式52動画4,025コメントを収集し、
現行100選手への方向付き走力査定コメントは0件」を **収集成功後の正当なnegative finding** と
判定した。これは**過大な主張**である。

run2のレポート自身が同じ節でこう書いている:

> YouTube Data APIキーは未設定。各inventory行に、完全/再現可能な取得に必要な最小
> commentThreads/replies入力形式を残した。**以上は公開yt-dlp経路のbounded coverageであり、
> YouTube全体に該当コメントが不存在という結論ではない。**

つまり:

- **取得できた範囲での0件**（bounded coverage）であって
- **存在しないことの確認**（negative finding）ではない

CLAUDE.md『開発・査定原則』の「negative findingは『未実施』と区別して保存し、
**取得不能を証拠不存在と混同しない**」に照らして、Hub側のラベルは違反だった。
canonへは移植せず、ここに誤りとして記録する。

同型の注意が要るもの: SP-035（公式X replies）はHTTP 403で**本文を取得できていない**。
「返信に査定言及が無かった」ではなく「未認証で読めなかった」であり、これも
negative findingではない。

## 4. canon側で今後どう扱うか

- SP-032〜037/054/055 は **NOT_STARTED のまま**、次のCommunity Phaseで
  収集済みraw（本統合分）を入力として**改めて評価**する
- 評価の際、各laneについて次の3つを**分けて**記録する:
  1. 取得できた範囲（coverage: 動画数・コメント数・到達可否）
  2. その範囲内での判定結果（accepted / context-only / 0件）
  3. **取得できなかった範囲**（APIキー未設定・403・404）とその理由
- 3が空でない限り、そのlaneを `DONE_NEGATIVE_FINDING` にしない

## 5. 参照

- `speed_community_rating_rescue_20260813_run1_failure_analysis.md`（run1の3つの技術的失敗）
- `speed_community_rating_rescue_20260813_run2.md`（run2の収集レポート）
- `speed_community_rating_rescue_20260813_run2_cc_verification.md`（run2のCC検品。旧出力汚染4件の発見を含む）
- `speed_2026_session_position_20260813_2.md`（作業場所取り違えの経緯）

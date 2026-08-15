# Speed Community Recollection V3 — YouTube lane audit

実行日: 2026-08-15
対象: SP-033 PowerPro official YouTube / SP-034 Prospi official YouTube
対象期間: 2024-01-01 ～ 2026-08-14
branch: `codex/speed-community-recollection-v3-20260814`

## 結論

SP-033 と SP-034 は、公式チャンネル発見からコメント・返信回収、文脈保持、recall-first候補抽出、意味判定、current-100照合、A–G回帰QAまで実行済みである。ただし公開yt-dlp経路の全件性を独立証明できず、動画メタデータ2件にも直接取得エラーが残るため、両taskのstatusは `PARTIAL` とする。

X / SP-035、SP-075 close、Speed Gate、肩力はこの成果物の対象外であり、変更していない。

## Discovery

| 指標 | 実測値 |
|---|---:|
| official channel scan | 199 videos |
| direct metadata | 197 OK / 2 ERROR |
| inventory rows | 199 |
| relevant lane videos（PowerPro 35 + Prospi 56、lane overlap 11） | 80 unique |
| old inventory ID union | 57 |
| fresh relevant video IDs | 58 unique |
| relevant fresh / old overlap | 58 / 22 |

公式チャンネル側から取得した199件を母集団とし、旧video IDだけを探索完了の根拠にはしていない。`CmBoz1XeAmU` は直接metadata取得がERRORだったが、flat scanとlane側の動画情報・コメント取得でProspi対象として保持した。`mcFoF1ty1Aw` も直接metadata ERRORとして記録し、取得不能をnegative findingにはしていない。

## Comment / reply recovery

取得指定は `comment_sort=new;max_comments=all,all,all,all,all`。固定top-100/top-300は使用していない。

| 指標 | 実測値 |
|---|---:|
| unique recovered comment/reply rows | 38,455 |
| PowerPro lane rows before cross-lane dedupe | 9,352 |
| Prospi lane rows before cross-lane dedupe | 31,803 |
| unique root rows | 28,097 |
| unique reply rows | 10,358 |
| videos with successful comment request | 80 / 80 |

各raw rowに `video_id`, `video_title`, `comment_id`, `parent_comment_id`, `root_thread_id`, `source_url`, `text`, `likes`, `reply_count` を保存した。候補rowではさらにroot text、immediate parent text、direct reply context、動画description contextを保存している。lane overlapで同一video/commentが重複する行は統合した。

## Candidate / semantic / identity

| 指標 | 実測値 |
|---|---:|
| recall-first semantic-review candidates | 2,171 |
| non-noise contextual claims | 1,972 |
| strict `CONTEXTUAL_CLAIM_FOR_SEMANTIC_REVIEW` | 1,643 |
| identity review | 268 |
| sarcasm review | 61 |
| noise retained but not accepted | 199 |
| current-100 mapped claim rows | 121 |
| current-100 mapped player count | 24 |
| potential legacy-classifier false-negative candidates | 101 |

意味判定は動画タイトル、description、comment、parent、root、direct repliesを組み合わせるcontext-aware reviewであり、regex単独を最終判定にしていない。current-100照合はmaster tableから行い、曖昧な姓・alias・タイトル文脈は候補またはreview状態を維持した。

## Regression and QA

- Regression A–G: **7 / 7 PASS**
- Semantic schema required fields: **PASS**
- Fresh semantic candidate rows with title context: **2,171 / 2,171**
- Fresh semantic candidate rows with parent context: **1,029 / 2,171**
- Fresh semantic candidate rows with root context: **2,171 / 2,171**
- Fresh semantic candidate rows with direct replies: **648 / 2,171**
- Common raw required-field check: **PASS**
- No replacement-character titles in raw/candidate/semantic outputs: **PASS**
- Current-100 master join: **100-row master verified; 24 mapped players**

## Unresolved YouTube missingness

1. API keyは設定しておらず、YouTube Data APIの `commentThreads.list` / `comments.list` による独立pagination照合は未実施。
2. 80 relevant videosは公開yt-dlp経路で全件指定を要求し、80件ともcomment requestは成功したが、platform全件性を独立検証できないため、全80件を `requested_all...; completeness not independently verified` として保持した。
3. direct metadataは2件（`mcFoF1ty1Aw`, `CmBoz1XeAmU`）でERROR。`CmBoz1XeAmU` はflat/lane fallbackで対象としたが、直接metadataの欠損は解消扱いにしていない。
4. channel scanの119件はSP-033/SP-034のrelevant target外であり、comment coverageの分母には含めていない。
5. current-100に安全に紐付かなかった候補は不在証拠ではなく、identity unresolvedとして保持した。

## Artifacts

- `outputs/derived/speed_community_v3_official_channel_scan_20260814.json`
- `outputs/derived/speed_community_v3_official_video_metadata_20260814.jsonl`
- `outputs/derived/speed_community_v3_official_video_inventory_20260814.csv`
- `outputs/derived/speed_community_v3_youtube_raw_20260814.jsonl`
- `outputs/derived/speed_community_v3_youtube_candidates_20260814.jsonl`
- `outputs/derived/speed_community_v3_youtube_semantic_classified_20260814.jsonl`
- `outputs/derived/speed_community_v3_player_summary_20260814.csv`
- `outputs/derived/speed_community_v3_qa_20260814.json`
- `outputs/derived/speed_community_v3_youtube_regression_20260814.json`
- `docs/audits/speed_community_v3_youtube_semantic_qa_20260814.md`

\n

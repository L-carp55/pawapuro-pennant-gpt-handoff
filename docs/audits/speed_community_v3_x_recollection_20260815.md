# SP-035 X recollection v3 — integrity cleanup（2026-08-15）

担当: Luna cleanup。新規X検索・Web検索は実施していない。Grok Buildの既存artifactを読み、raw evidenceを保持したまま canonical X lane と supplemental WEB lane を分離した。

## 1. authoritative input / boundary

- raw evidence: `outputs/derived/speed_community_v3_x_raw_20260815.jsonl`（420行、未変更）
- classified evidence: `outputs/derived/speed_community_v3_x_classified_20260815.jsonl`（366行、未変更）
- current-100 mapping: `outputs/derived/speed_2026_100_owner_review_master_20260813.csv` と同scratch masterの一致を確認
- 新規検索、Web取得、YouTube、SP-033 / SP-034 / SP-075、Speed Gate、肩力は実施していない

## 2. canonical counts

数字は古いGrok途中集計ではなく、canonical X datasetから再計算した。

| 項目 | canonical値 |
| --- | ---: |
| raw input rows (preserved) | **420** |
| classified input rows (preserved) | **366** |
| X primary canonical rows | **373** |
| unique X post IDs | **338** |
| unique independence groups / origins | **370** |
| duplicate rows collapsed | **1** |
| current-100 searched | **100 / 100** |
| current-100 with raw X hit | **73** |
| current-100 with directional rating claim | **61** |
| current-100 with speed-specific physical claim | **14** |
| directional rating claim rows | **156** |
| speed-specific physical rows | **21** |
| general aging/injury context rows | **17** |
| official X post IDs | **111** |
| known reply/quote rows | **50** |
| unique origins | **370** |
| supplemental WEB rows | **36** |
| unresolved identity rows | **100** |
| X no-post non-evidence rows excluded from canonical | **10** |

X primary は platform=X/x かつ X投稿IDを復元できる post/reply/quote recordだけを対象にした。投稿IDのない検索クエリ、アカウントメタデータ、空の入口recordは raw に残し、evidence originとして数えていない。WEBは別artifactに保存し、X countへ混ぜていない。

## 3. event identity / dedupe

- event key: `x:<post_id>:<canonical_player_id-or-player-key>:<claim_cluster>`
- independence group: `x:<post_id>:<canonical_player_id-or-player-key>`
- X canonicalで `x:unknown:*`、`x:nourl:*`、`x:undefined` は0件
- 同一post/player/claimの重複は canonical側で 1行をcollapseし、source record IDsをcanonical rowに保持した
- raw / classifiedは削除・上書きしていない

## 4. classification hygiene

- directional rating、speed-specific physical、general aging/injury context、baserunning/stealing techniqueを別facetで保持した
- `evidence_subtype=SPEED_SPECIFIC_PHYSICAL` または複合claim用の明示subtypeを付与した
- 走塁・盗塁・ベーラン・スタート判断だけの記録をpure speedへ昇格していない
- joke markerがあっても、本文に方向付きratingまたは直接physical claimがあれば捨てていない
- ACL/手術/年齢/一般的な衰えだけで走力を直接述べない記録は `GENERAL_AGING_INJURY_CONTEXT` として分離した

## 5. current-100 / identity regression

- current_100はsource flagを信じず、masterのcanonical player_idから再計算した
- 西川史礁は西川龍馬へ結び付けていない
- 山本大斗は山本祐大へ結び付けていない
- current-100 mapping regression、WEB混入、duplicate canonical key、legacy event tokenをQAで検査した

## 6. QA

既存canonical datasetのみを使った層別sample reviewを実施した。strataは directional rating、speed-specific physical、general context、rejected/noise/unclear、identity edge cases。各stratumは可能なら20件、件数不足は全件をreviewした。sample count / error count / corrected countは machine-readable QA JSON に保存した。

## 7. official discovery / evidence limits

既存Grok artifactには公式X投稿、公式投稿へのreply/quote、community X recordが含まれる。今回のcleanupは取得範囲を広げていない。

残る欠損は「存在しない」というnegative findingではなく、このbounded artifactで未取得・未同定・current-100 hitなしだった範囲として扱う。

- 公式スレッドの認証付き全返信ページングは NOT_COLLECTED（canonical known reply/quote rows=50）。
- current-100 27人はこのbounded X artifactでcanonical post hitがない（若月 健矢、土田 龍空、板山 祐太郎、石川 昂弥、福永 裕基、野村 佑希、ファビアン、モンテロ、名原 典彦、坂倉 将吾、小園 海斗、サンタナ、京田 陽太、佐野 恵太、山本 祐大、度会 隆輝、林 琢真、梶原 昂希、蝦名 達夫、栗原 陵矢、海野 隆司、佐々木 俊輔、岸田 行倫、伏見 寅威、坂本 誠志郎、小幡 竜平、梅野 隆太郎）。これは発言不存在のnegative findingではない。
- PowerPro公式の個別走力本文は既存query結果で薄く、画像・公式サイト側の能力値取得は今回のcleanup範囲外。
- X_SEARCH_QUERYのNOT_FOUND/HITS_BUT_IRRELEVANT、account metadata、入口recordはrawに保持したがcanonical evidence originには数えていない。

## 8. SP-035 status

**PARTIAL**

bounded X laneとして canonical化・current-100 mapping・分類衛生・QAは完了した。一方、公式スレッドの全返信ページングは NOT_COLLECTED のままで、current-100の一部にはこのartifact内のX post hitがない。これは取得不能を証拠不存在へ変換する理由ではないため、SP-035は PARTIAL を維持する。

Canonical artifacts:

- `outputs/derived/speed_community_v3_x_canonical_20260815.jsonl`
- `outputs/derived/speed_community_v3_x_supplemental_web_20260815.jsonl`
- `outputs/derived/speed_community_v3_x_integrity_qa_20260815.json`
- `outputs/derived/speed_community_v3_x_qa_20260815.json`

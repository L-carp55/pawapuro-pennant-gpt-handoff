# SP-033 / 034 — 既存公式YouTubeコメントの分類

生成日: 2026-08-13  
新規動画探索: **していない**  
YouTube Data API: **使っていない**

## coverage の分離

| 区分 | PowerPro | Prospi | 計 |
|---|---|---|---|
| run2 が数えた取得 | 257 | 4,025 | 4,282 |
| 今回本文を分類できたユニークコメント | 251 | 6,894 | 7,145 |
| 現行100人へ安全に紐づく採用 | 0 | 0 | 0 |

run2 の本文は temp ディレクトリ破棄で残っていなかった。既知の公式動画IDだけを yt-dlp で再ダンプした。新しいチャンネル探索はしていない。

Prospi の分類件数が run2 の 4,025 を超えるのは、run2 inventory に載っていたが当時コメントを残さなかった公式動画からも本文を拾ったため。新しい動画を探したのではない。

## ラベル（同一動画は1 origin）

動画 55 本を origin とした。コメント件数は reaction volume。

多い順: UNCLASSIFIED_CONTEXT 6,120 / JOKE_OR_NOISE 1,009 / PLAYER_COMPARISON 6 / STALE_RATING 4 / GENERIC_FAST 4 / SPEED_TOO_HIGH 2 / PROSPI_MORE_PLAUSIBLE 1

現行100人フルネーム＋方向の採用は 0。これは「YouTubeに査定コメントが存在しない」ではない。

## 取得できていない範囲（NOT_COLLECTED）

- YouTube Data API の全ページ / 全返信
- run2 が数えた件数と、今回 bounded dump の件数の差（例: PowerPro 257 vs 251）
- 公式チャンネルの inventory に無い動画

再現:

```text
python scripts/recover_youtube_official_comments_known_videos.py
node scripts/sp033_034_youtube_existing_classify.mjs
```

---

## ★ Opus senior review（2026-08-14）— APPROVE_WITH_FIX

### 1. `current_100_player_mapped = 0` は「妥当」だが表現が誤解を招く

- **accepted evidence としては妥当**（0件で正しい）
- しかし「100人の誰にも言及が無い」という意味ではない。**姓のみの言及が243件**あり、
  うち1件は走力方向ラベル付きだった:

  > 「足が速い山川」→ **山川 穂高 は現行100人に実在**（`canonical_player_id` は null だった）

  取りこぼしの原因は player mapping が**フルネーム完全一致のみ**（`compact.includes(p.key)`）
  だったこと。姓のみの言及は構造的に拾えなかった。

### 2. 修正した3点

| # | 欠陥 | 修正 | 実測効果 |
|---|---|---|---|
| F-1 | `PLAYER_COMPARISON` が `と比べ` 単独で発火し、**PS4・球団・他ゲームとの比較まで**選手比較として拾っていた（16件中6件が誤検出） | 速度語（足/走力/速/遅/俊足/鈍足）を伴う比較に限定 | **6 → 1件** |
| F-2 | フルネーム完全一致のみで姓のみ言及を取りこぼし | ロースター内で**姓が一意な場合のみ** candidate 層を新設（`SURNAME_CANDIDATE_UNAMBIGUOUS_IN_ROSTER`）。**自動採用しない** | 243件を可視化、うち走力ラベル1件 |
| F-3 | `event_id = youtube:<video_id>` により1動画内の**別選手**への言及まで1originへ潰れる | 選手が特定できた行は `youtube:<video>:<player_id>` へ分割 | **現状は不活性**（フルネーム一致0件のため発火せず）。将来mappingが増えた時に効く latent fix |

### 3. 姓マッチを自動採用しなかった理由

「足が速い山川」は**皮肉の可能性が高い**——山川穂高は長距離砲で鈍足として知られる。
自動採用すると**方向が反転した証拠**を注入しかねない。同名他人・引退選手を拾うリスクも
同様にある。したがって「0情報化しない（SR-019）」と「誤った方向を入れない」を両立させるため、
**candidate として残し採否は人間のreviewへ回す**形にした。

### 4. 同一場面の水増し防止は維持

オーナー指示「同一場面反応を独立票として水増ししない原則は維持。ただし別選手・別査定主張まで
1 originに潰す必要はない」に対し、F-3 は**選手ごとに閉じた origin** とすることで両立させている。
選手が特定できない行は従来どおり動画単位のまま（水増し防止側に倒す）。

### 5. NOT_COLLECTED の扱いは APPROVE

- run2 Prospi 33動画のコメント未試行、YouTube Data API のページング範囲外を
  `NOT_COLLECTED` として明示し、「コメントが存在しない」へ変換していない
- 新規動画探索・API取得は行っていない（オーナー指示どおり）

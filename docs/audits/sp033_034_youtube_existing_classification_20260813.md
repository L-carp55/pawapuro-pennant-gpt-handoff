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

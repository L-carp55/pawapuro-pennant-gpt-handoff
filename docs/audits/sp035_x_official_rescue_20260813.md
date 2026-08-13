# SP-035 — 公式X replies / 査定批評の targeted rescue

生成日: 2026-08-13  
判定: **PARTIAL。PowerPro公式Xは NOT_COLLECTED。Prospi公式は一部取得。negative finding ではない。**

## 取得できた範囲

- 公式アカウント `@prospiA_PR` の能力公開投稿 3件（福留・糸井新能力、OB福本豊など）
- 返信本文 4件。うち走力査定批評は 1件（福本豊「走力低すぎ」）
- 成果: `outputs/derived/sp035_x_official_rescue_20260813.json`

## 取得できなかった範囲

| 範囲 | 状態 | 理由 |
|---|---|---|
| PowerPro公式の能力公開投稿・返信・引用 | `NOT_COLLECTED` | 今セッションの Grok/X 検索では公式PowerPro能力投稿が取れなかった |
| Prospi公式投稿の全返信・全引用 | `NOT_COLLECTED` | thread fetch は見える一部だけ。全件は認証付きX APIが要る |
| run2 の未認証 reply 経路 | `ACCESS_BLOCKED` | 既存記録どおり HTTP 403 |

X API申請はしていない。

空検索や 403 を「査定批評が存在しない」とは書いていない。

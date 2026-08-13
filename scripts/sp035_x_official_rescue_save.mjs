// SP-035 — 今セッションで到達できた公式X投稿/返信を保存する。
// X API申請はしない。取れなかった範囲は NOT_COLLECTED / ACCESS_BLOCKED。
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = path.join(ROOT, 'outputs', 'derived', 'sp035_x_official_rescue_20260813.json');

const officialPosts = [
  {
    post_id: '2077694733518782866',
    handle: 'prospiA_PR',
    game: 'Prospi',
    url: 'https://x.com/prospiA_PR/status/2077694733518782866',
    posted_at: '2026-07-16T10:00:00Z',
    text: '「福留×糸井のホンネ！俺の実力話しますSP」第2弾。アップデートされた福留孝介・糸井嘉男の新能力を先行公開。',
    replies_reported: 42,
    quotes_reported: 70,
    retrieval: 'GROK_X_SEARCH + X_THREAD_FETCH',
  },
  {
    post_id: '2078026922907304081',
    handle: 'prospiA_PR',
    game: 'Prospi',
    url: 'https://x.com/prospiA_PR/status/2078026922907304081',
    posted_at: '2026-07-17T08:00:00Z',
    text: '福留孝介・糸井嘉男登場記念スカウト。新たな能力にアップデート。',
    replies_reported: 58,
    quotes_reported: 26,
    retrieval: 'GROK_X_SEARCH + X_THREAD_FETCH',
  },
  {
    post_id: '2014609045613904167',
    handle: 'prospiA_PR',
    game: 'Prospi',
    url: 'https://x.com/prospiA_PR/status/2014609045613904167',
    posted_at: '2026-01-23T08:00:00Z',
    text: '2025 Series2 OB第5弾。山内一弘・福本豊が登場。',
    replies_reported: 48,
    quotes_reported: 12,
    retrieval: 'X_THREAD_FETCH via reply 2014680637387714970',
  },
];

const replies = [
  {
    post_id: '2077699813446201580',
    parent_id: '2077694733518782866',
    handle: 'anoJohnnys',
    url: 'https://x.com/anoJohnnys/status/2077699813446201580',
    text: 'コナミさ、日本の球場の中でトップに広いバンテリンドームでホームラン30本以上打ってる人がA80な訳無いやん。舐めてんの？',
    labels: ['RATING_TOO_LOW'],
    speed_rating: false,
    bucket: 'RATING_CONSENSUS',
    reason: '公式能力公開投稿への返信。パワー査定批判。走力ではないが rating-lane として保持。',
  },
  {
    post_id: '2077696153454551162',
    parent_id: '2077694733518782866',
    handle: 'MayuKDB',
    url: 'https://x.com/MayuKDB/status/2077696153454551162',
    text: '福留称号込みでパワー最大88は渋くて草 90乗らんパワヒは使えんて',
    labels: ['RATING_TOO_LOW'],
    speed_rating: false,
    bucket: 'RATING_CONSENSUS',
    reason: '公式能力公開投稿への返信。パワー査定が低いという批評。',
  },
  {
    post_id: '2077696764585673175',
    parent_id: '2077694733518782866',
    handle: 'jjbY43qvfP11897',
    url: 'https://x.com/jjbY43qvfP11897/status/2077696764585673175',
    text: '福留弱すぎて悲しいんだけど…パワー低いパワヒは論外すぎる',
    labels: ['RATING_TOO_LOW'],
    speed_rating: false,
    bucket: 'RATING_CONSENSUS',
    reason: '公式能力公開投稿への返信。査定が弱いという批評。',
  },
  {
    post_id: '2014680637387714970',
    parent_id: '2014609045613904167',
    handle: 'manpeit',
    url: 'https://x.com/manpeit/status/2014680637387714970',
    text: '福本さんの走力低すぎやろ。世界の盗塁王やぞ？ 「走力」として走塁技術もある程度入るならSでも良いとさえ思う。',
    labels: ['RATING_TOO_LOW', 'SPEED_TOO_LOW'],
    speed_rating: true,
    bucket: 'RATING_CONSENSUS',
    reason: '公式OB登場投稿への返信。走力査定が低すぎるという明示批評。',
  },
];

const out = {
  generated_at: '2026-08-13',
  x_api_application: 'NOT_MADE',
  routes_attempted: [
    { route: 'grok-x search @pawapuroprospi', result: 'NO_POSTS_RETURNED', status: 'NOT_COLLECTED' },
    { route: 'grok-x search official PowerPro ability posts', result: 'NO_MATCHING_POSTS', status: 'NOT_COLLECTED' },
    { route: 'grok-x search @prospiA_PR 新能力/能力公開', result: 'OFFICIAL_POSTS_FOUND', status: 'RETRIEVED' },
    { route: 'x_thread_fetch on official Prospi posts', result: 'SOME_REPLIES_VISIBLE', status: 'RETRIEVED_PARTIAL' },
    { route: 'run2 unauthenticated official X reply HTTP', result: 'HTTP_403 documented in run2', status: 'ACCESS_BLOCKED' },
  ],
  official_posts_retrieved: officialPosts,
  replies_retrieved: replies,
  coverage: {
    acquired: {
      official_prospi_posts: officialPosts.length,
      replies_with_full_text: replies.length,
      speed_rating_replies: replies.filter(r => r.speed_rating).length,
    },
    accepted_evidence: replies.filter(r => r.bucket === 'RATING_CONSENSUS').map(r => r.post_id),
    inconclusive_evidence: officialPosts.map(p => ({
      post_id: p.post_id,
      replies_reported: p.replies_reported,
      replies_text_retrieved: replies.filter(r => r.parent_id === p.post_id).length,
      note: 'Thread fetch returns a visible sample, not the full reply set.',
    })),
    not_collected: [
      { lane: 'PowerPro official X ability posts / replies / quotes', status: 'NOT_COLLECTED', reason: 'No official PowerPro ability-reveal posts were retrievable via available Grok/X search in this session. Previous run2 unauthenticated reply route was HTTP 403 (ACCESS_BLOCKED).' },
      { lane: 'Complete reply/quote pagination on retrieved Prospi posts', status: 'NOT_COLLECTED', reason: 'Thread fetch is a visible sample. Full reply/quote dump would need authenticated X API, which was not requested.' },
    ],
  },
  negative_finding: false,
  note: 'Empty search or 403 is not evidence that rating criticism does not exist.',
};

writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  official_posts: officialPosts.length,
  replies: replies.length,
  speed_rating_replies: replies.filter(r => r.speed_rating).length,
  powerpro_official: 'NOT_COLLECTED',
}, null, 2));

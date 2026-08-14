// SP-035 — organize already-collected official X material. No new API app.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = rel => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));

const official = existsSync(path.join(ROOT, 'outputs/derived/sp035_x_official_rescue_20260813.json'))
  ? J('outputs/derived/sp035_x_official_rescue_20260813.json') : {};
const grokPath = 'data/manual/speed_2026_grok_x_reviewed_evidence_20260810.json';
const grok = existsSync(path.join(ROOT, grokPath)) ? J(grokPath) : { records: [] };
const recs = grok.candidate_decisions || grok.records || grok.posts || grok.candidates || [];
const arr = Array.isArray(recs) ? recs : Object.values(recs).flat?.() || [];

const SPEED = /走力|足が速|足速|俊足|鈍足|脚力|スプリント|50m|一塁到達/;
const RATING = /査定|能力値|走力[A-G]|[A-G]走力/;
const organized = [];
for (const r of arr) {
  const t = String(r.text_excerpt || r.post_text_returned || r.text || '');
  if (!SPEED.test(t) && !RATING.test(t)) continue;
  organized.push({
    player: r.player || r.target_player || r.canonical_player || null,
    handle: r.handle || r.author || r.username || null,
    url: r.url || r.post_url || null,
    post_id: r.post_id || r.id || null,
    text: t.slice(0, 240),
    labels: r.labels || r.classification || null,
    speed_relevant: SPEED.test(t),
    rating_relevant: RATING.test(t),
    current_100: null,
  });
}

const out = {
  generated_at: '2026-08-14',
  new_x_api_application: false,
  existing_official: {
    posts: (official.official_posts_retrieved || []).length,
    replies: (official.replies_retrieved || official.official_replies || []).length,
    routes: official.routes_attempted || [],
    current_100_speed_criticism: 0,
    note: 'Existing official retrieve is Prospi A PR + OB (Fukumoto). Current-100 speed criticism remains empty in retrieved text. Empty is NOT_COLLECTED, not absence.',
  },
  existing_grok_x_speed_or_rating: {
    n: organized.length,
    with_player: organized.filter(x => x.player).length,
    rows: organized.slice(0, 80),
  },
  not_collected: [
    'Authenticated X API full reply paging',
    'Official PowerPro account reply crawl',
    'New Grok-X search beyond existing artifacts',
  ],
  negative_finding: false,
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp035_x_existing_organize_20260814.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  official_posts: out.existing_official.posts,
  grok_x_speed_or_rating: organized.length,
  new_api: false,
}, null, 2));

// SP-036 — 150件台帳の外にある generic fast/slow を既存収集物から掃き出す。0情報化しない。
//
// 2026-08-14 REPAIR (independent audit finding 2):
//   The sweep reported origins: 7 while only 4 distinct comments existed. Three comments
//   appear in two corpora that namespace the same YouTube video differently
//   (`yt:video:4LPWDwnHVpg` vs `youtube:4LPWDwnHVpg`, `youtube:<vid>:root`,
//   `youtube:<vid>:<parent comment>`), so a raw event_id dedupe silently failed.
//   Fixes:
//     1. event ids are canonicalised (platform alias + type-token drop) before dedupe;
//     2. origins are counted on the *comment* identity (video + comment id), recovered
//        from explicit video_id/comment_id fields, else from the source_url v=/lc= pair,
//        else from the record_id tail — not on the raw event_id string;
//     3. every row carries `attributed_to_player` and `likely_not_player_observation`
//        (with the matched reason tokens), and the artifact reports how many rows and how
//        many origins are actually usable as player evidence.
//   Nothing is deleted: flagged rows stay in the output (証拠除外の原則 / 0情報化しない).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'outputs', 'derived', 'speed_community_rating_normalized_20260813.jsonl');
const YT = path.join(ROOT, 'outputs', 'derived', 'sp033_034_youtube_comment_classification_20260813.jsonl');
const RECLASS = path.join(ROOT, 'outputs', 'derived', 'sp032_grok_x_150_reclassification_20260813.jsonl');
const OUT = path.join(ROOT, 'outputs', 'derived', 'sp036_generic_label_sweep_20260814.json');
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

const load = p => readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const reclassRows = load(RECLASS);
const rawRows = load(RAW);
const ytRows = load(YT);
const already = new Set(reclassRows.map(r => r.record_id));
const kept = [];

// ---------------------------------------------------------------------------
// identity canonicalisation
// ---------------------------------------------------------------------------
const PLATFORM_ALIAS = { yt: 'youtube', youtube: 'youtube', x: 'x', twitter: 'x', tw: 'x', bsky: 'bluesky', bluesky: 'bluesky' };
// segments that describe the *kind* of object rather than the platform-native id
const TYPE_TOKENS = new Set(['video', 'v', 'watch', 'post', 'status', 'root', 'comment', 'c', 'thread', 'reply']);

function canonicalEventId(rawId) {
  const s = String(rawId ?? '').trim();
  if (!s) return null;
  if (!s.includes(':')) return `unknown:${s}`;
  const segs = s.split(':').filter(Boolean);
  const platform = PLATFORM_ALIAS[segs[0].toLowerCase()] || segs[0].toLowerCase();
  const rest = segs.slice(1).filter(x => !TYPE_TOKENS.has(x.toLowerCase()));
  // first surviving segment is the platform-native id; anything after it is a parent
  // comment / thread pointer and must not create a second namespace.
  return `${platform}:${rest[0] ?? segs[segs.length - 1]}`;
}

// Recover (video, comment) from whichever fields a corpus happens to carry.
function commentIdentity(row) {
  const canonEvent = canonicalEventId(row.event_id ?? row.parent_event_id ?? row.independence_group);
  const video = row.video_id
    || (typeof row.source_url === 'string' ? (row.source_url.match(/[?&]v=([\w-]+)/) || [])[1] : null)
    || (canonEvent ? canonEvent.split(':')[1] : null);
  let comment = row.comment_id
    || (typeof row.source_url === 'string' ? (row.source_url.match(/[?&]lc=([\w.-]+)/) || [])[1] : null);
  if (!comment && typeof row.record_id === 'string' && video) {
    const marker = `${video}-`;
    const at = row.record_id.indexOf(marker);
    if (at >= 0) comment = row.record_id.slice(at + marker.length);
  }
  const method = row.video_id && row.comment_id ? 'EXPLICIT_VIDEO_AND_COMMENT_FIELDS'
    : (typeof row.source_url === 'string' && /[?&]lc=/.test(row.source_url)) ? 'SOURCE_URL_V_AND_LC'
      : comment ? 'RECORD_ID_TAIL_AFTER_VIDEO_ID' : 'CANONICAL_EVENT_ID_ONLY';
  const id = video && comment ? `youtube:${video}#${comment}`
    : video ? `youtube:${video}`
      : (canonEvent || row.record_id);
  return { origin_id: id, canonical_event_id: canonEvent || (video ? `youtube:${video}` : null), video_id: video || null, comment_id: comment || null, identity_method: method };
}

// ---------------------------------------------------------------------------
// usability flags
// ---------------------------------------------------------------------------
// Game-mechanic / UI-operation talk: the sentence is about操作 in the game, not about a
// real player's legs. Detected, not hardcoded per row.
const MECHANIC_TOKENS = [/タップ/, /連打/, /ボタン/, /コントローラ/, /操作/, /画面/, /アプリ/, /スワイプ/, /課金/];
const SPEED_TOKENS = [/足が速|足速|足が遅|足遅|俊足|鈍足|速く/];
function mechanicFlag(text) {
  const mech = MECHANIC_TOKENS.filter(rx => rx.test(text)).map(rx => String(rx).slice(1, -1));
  const spd = SPEED_TOKENS.some(rx => rx.test(text));
  if (!mech.length || !spd) return { flag: false, reason: null, tokens: mech };
  return {
    flag: true,
    reason: `game-mechanic/UI tokens [${mech.join(', ')}] co-occur with a speed term: the sentence describes in-game 操作 (making the on-screen runner faster), not an observation of a real player's speed`,
    tokens: mech,
  };
}

function keep(row, source, sourcePath) {
  const text = String(row.text ?? '');
  const labels = row.labels || row.classification || [];
  const lab = Array.isArray(labels) ? labels : [labels];
  const generic = lab.some(l => /GENERIC_FAST|GENERIC_SLOW|PHYSICAL_FAST|PHYSICAL_SLOW/.test(String(l)))
    || /(俊足|鈍足|足が速|足が遅|足速|足遅)/.test(text);
  if (!generic) return;
  if (already.has(row.record_id)) return;
  const ident = commentIdentity(row);
  const player = row.player ?? row.surname_candidate_player ?? null;
  const mech = mechanicFlag(text);
  kept.push({
    record_id: row.record_id,
    source,
    source_path: sourcePath,
    player,
    attributed_to_player: Boolean(player && String(player).trim()),
    likely_not_player_observation: mech.flag,
    likely_not_player_observation_reason: mech.reason,
    usable_as_player_evidence: Boolean(player && String(player).trim()) && !mech.flag,
    text: text.slice(0, 240),
    labels: lab,
    bucket: /鈍|遅/.test(text) && !/速/.test(text) ? 'WEAK_PHYSICAL_OR_CONTEXT_SLOW' : 'WEAK_PHYSICAL_OR_CONTEXT_FAST',
    zeroed: false,
    event_id: row.event_id ?? null,
    canonical_event_id: ident.canonical_event_id,
    origin_id: ident.origin_id,
    video_id: ident.video_id,
    comment_id: ident.comment_id,
    identity_method: ident.identity_method,
    origin_count: 0,
    reaction_volume: 1,
  });
}

for (const r of rawRows) keep(r, 'community_normalized', rel(RAW));
for (const r of ytRows) keep(r, 'youtube_classified', rel(YT));

// ---------------------------------------------------------------------------
// dedupe on the canonical comment identity
// ---------------------------------------------------------------------------
const byOrigin = new Map();
for (const r of kept) {
  const k = r.origin_id || r.record_id;
  if (!byOrigin.has(k)) byOrigin.set(k, []);
  byOrigin.get(k).push(r);
}
for (const [, g] of byOrigin) {
  g[0].origin_count = 1;
  for (const x of g) x.reaction_volume = g.length;
}
const byRawEventId = new Set(kept.map(r => r.event_id ?? r.record_id));
const byVideo = new Set(kept.map(r => r.canonical_event_id).filter(Boolean));

const originSummary = [...byOrigin.entries()].map(([origin_id, g]) => ({
  origin_id,
  rows: g.length,
  raw_event_ids: [...new Set(g.map(r => r.event_id))],
  sources: [...new Set(g.map(r => r.source))],
  attributed_to_player: g.some(r => r.attributed_to_player),
  player: g.map(r => r.player).find(p => p && String(p).trim()) || null,
  likely_not_player_observation: g.some(r => r.likely_not_player_observation),
  usable_as_player_evidence: g.some(r => r.usable_as_player_evidence),
  text: g[0].text.slice(0, 120),
}));

const usableOrigins = originSummary.filter(o => o.usable_as_player_evidence);
const originsCollapsedByNamespaceFix = byRawEventId.size - byOrigin.size;

writeFileSync(OUT, JSON.stringify({
  generated_at: '2026-08-14',
  task: 'SP-036 recover weak generic SNS labels without zeroing them',
  inputs_read: [
    { path: rel(RAW), records: rawRows.length, role: 'community rating normalized ledger' },
    { path: rel(YT), records: ytRows.length, role: 'YouTube comment classification' },
    { path: rel(RECLASS), records: reclassRows.length, role: '150-row reclassification ledger (already-covered record_ids)' },
  ],
  code_path: 'scripts/sp036_generic_label_sweep.mjs :: keep() -> commentIdentity() -> byOrigin dedupe',
  method: {
    generic_label_test: 'labels match GENERIC_FAST|GENERIC_SLOW|PHYSICAL_FAST|PHYSICAL_SLOW, or the text contains 俊足|鈍足|足が速|足が遅|足速|足遅',
    already_covered: 'record_id present in the 150-row reclassification ledger is skipped',
    event_id_canonicalisation: 'platform alias (yt->youtube, twitter->x, bsky->bluesky) + drop type tokens (video/v/watch/post/status/root/comment/thread/reply) + keep the first surviving platform-native segment',
    origin_unit: 'a single comment: youtube:<video_id>#<comment_id>, recovered from explicit fields, else source_url v=/lc=, else the record_id tail after the video id',
    player_attribution: 'player or surname_candidate_player non-empty',
    non_observation_flag: `game-mechanic/UI tokens [${MECHANIC_TOKENS.map(r => String(r).slice(1, -1)).join(', ')}] co-occurring with a speed term`,
  },
  previous_defect: 'origins were counted on the raw event_id string, so yt:video:<vid> and youtube:<vid> (and youtube:<vid>:root) counted the same comment twice; the reported 7 origins were 4 comments.',
  counts: {
    outside_150_ledger_rows: kept.length,
    distinct_raw_event_id_strings: byRawEventId.size,
    origins: byOrigin.size,
    origins_before_namespace_normalisation: byRawEventId.size,
    origins_collapsed_by_namespace_fix: originsCollapsedByNamespaceFix,
    unique_videos: byVideo.size,
    rows_attributed_to_player: kept.filter(r => r.attributed_to_player).length,
    rows_likely_not_player_observation: kept.filter(r => r.likely_not_player_observation).length,
    rows_usable_as_player_evidence: kept.filter(r => r.usable_as_player_evidence).length,
    origins_attributed_to_player: originSummary.filter(o => o.attributed_to_player).length,
    origins_likely_not_player_observation: originSummary.filter(o => o.likely_not_player_observation).length,
    origins_usable_as_player_evidence: usableOrigins.length,
    zeroed: 0,
  },
  note: 'These are weak directional labels kept off the numeric teacher path. Not independent physical measurements. Rows that fail the usability tests are flagged, never deleted.',
  origins: originSummary,
  rows: kept,
}, null, 2));

console.log(JSON.stringify({
  outside_150_rows: kept.length,
  raw_event_id_strings: byRawEventId.size,
  origins_after_normalisation: byOrigin.size,
  unique_videos: byVideo.size,
  rows_attributed_to_player: kept.filter(r => r.attributed_to_player).length,
  rows_flagged_not_player_observation: kept.filter(r => r.likely_not_player_observation).length,
  origins_usable_as_player_evidence: usableOrigins.length,
  zeroed: 0,
}, null, 2));

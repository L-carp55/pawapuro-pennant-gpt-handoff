// SP-033/034 — 既存公式YouTubeコメントを分類する。新規動画探索はしない。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = path.join(ROOT, 'outputs', 'derived', 'speed_2026_100_owner_review_master_20260813.csv');
const RECOVERED = path.join(ROOT, 'outputs', 'derived', 'speed_youtube_official_comments_recovered_20260813.jsonl');
const RECOVERY_MANIFEST = path.join(ROOT, 'outputs', 'derived', 'speed_youtube_official_comments_recovery_manifest_20260813.json');
const PROSPI_STAGING = path.join(ROOT, 'outputs', 'derived', '_staging_speed_youtube_prospi_run2.jsonl');
const POWERPRO_STAGING = path.join(ROOT, 'outputs', 'derived', '_staging_speed_youtube_powerpro_run2.jsonl');
const POWERPRO_INV = path.join(ROOT, 'outputs', 'derived', 'speed_youtube_official_video_inventory_powerpro_20260813.csv');
const COMBINED_INV = path.join(ROOT, 'outputs', 'derived', 'speed_youtube_official_video_inventory_20260813_run2.csv');
const POWERPRO_VIDEO_IDS = new Set(['wOjrANePk1c', 'lXJEdQqrU7E', 'pxdRtLSTI80', '4LPWDwnHVpg']);
const OUT_JSONL = path.join(ROOT, 'outputs', 'derived', 'sp033_034_youtube_comment_classification_20260813.jsonl');
const OUT_QA = path.join(ROOT, 'outputs', 'derived', 'sp033_034_youtube_comment_classification_qa_20260813.json');

function loadJsonl(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
}

function parseCsv(p) {
  const raw = readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  return lines.slice(1).map(line => {
    // inventory is simple enough for this file (quoted fields exist). Use a small parser.
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

function playersFromMaster() {
  const rows = parseCsv(MASTER);
  return rows.map(r => ({
    player: r.player,
    player_id: r.player_id,
    key: (r.player ?? '').normalize('NFKC').replace(/[\s　]/g, ''),
  })).filter(p => p.key);
}

function classifyText(text) {
  const t = String(text ?? '');
  const labels = [];
  if (/(高すぎ|速すぎ|もっと低)/.test(t) && /(走力|査定|能力)/.test(t)) labels.push('RATING_TOO_HIGH');
  if (/(低すぎ|遅すぎ|もっと高)/.test(t) && /(走力|査定|能力)/.test(t)) labels.push('RATING_TOO_LOW');
  if (/(古|昔|過去|以前|全盛期)/.test(t) && /(査定|能力|反映)/.test(t)) labels.push('STALE_RATING');
  if (/(走力).*(高|速すぎ)/.test(t)) labels.push('SPEED_TOO_HIGH');
  if (/(走力).*(低|遅すぎ)/.test(t)) labels.push('SPEED_TOO_LOW');
  if (/(怪我|故障|けが)/.test(t) && /(反映|査定)/.test(t)) labels.push('INJURY_NOT_REFLECTED');
  if (/(年齢|衰え|劣化)/.test(t) && /(反映|査定)/.test(t)) labels.push('AGING_NOT_REFLECTED');
  if (/プロスピ/.test(t) && /妥当|こっちが/.test(t)) labels.push('PROSPI_MORE_PLAUSIBLE');
  if (/パワプロ/.test(t) && /妥当|こっちが/.test(t)) labels.push('POWERPRO_MORE_PLAUSIBLE');
  if (/(より速|より遅|と比べ)/.test(t)) labels.push('PLAYER_COMPARISON');
  if (/(俊足|足速|足が速)/.test(t)) labels.push('GENERIC_FAST');
  if (/(鈍足|足遅|足が遅)/.test(t)) labels.push('GENERIC_SLOW');
  if (/(草|www|笑|ネタ)/.test(t) && labels.length === 0) labels.push('JOKE_OR_NOISE');
  if (!labels.length) labels.push('UNCLASSIFIED_CONTEXT');
  return labels;
}

function matchPlayers(text, players) {
  const compact = String(text ?? '').normalize('NFKC').replace(/[\s　]/g, '');
  return players.filter(p => p.key.length >= 2 && compact.includes(p.key));
}

const players = playersFromMaster();
const recovered = loadJsonl(RECOVERED);
const prospiStagingComments = loadJsonl(PROSPI_STAGING)
  .filter(r => r.source_type === 'official_youtube_comment');
const powerproStaging = loadJsonl(POWERPRO_STAGING)
  .filter(r => /COMMENT|comment/i.test(String(r.source_type ?? '')) && r.text);

const commentRowsRaw = recovered.length
  ? recovered
  : [
    ...prospiStagingComments.map(r => ({ ...r, game: r.game || 'Pro Yakyuu Spirits A', video_id: r.video_id })),
    ...powerproStaging.map(r => ({ ...r, game: 'PowerPro', video_id: r.video_id_or_post_id })),
  ];
const seenComment = new Set();
const commentRows = [];
for (const r of commentRowsRaw) {
  const id = `${r.video_id}|${r.comment_id || r.video_id_or_post_id || r.record_id}`;
  if (seenComment.has(id)) continue;
  seenComment.add(id);
  commentRows.push(r);
}

const classified = commentRows.map(r => {
  const text = r.text ?? '';
  const labels = classifyText(text);
  const hits = matchPlayers(text, players);
  const eventId = r.event_id || `youtube:${r.video_id}`;
  const accepted = hits.length === 1 && labels.some(l => l !== 'UNCLASSIFIED_CONTEXT' && l !== 'JOKE_OR_NOISE');
  return {
    record_id: r.record_id || r.comment_id,
    video_id: r.video_id,
    comment_id: r.comment_id || r.video_id_or_post_id,
    event_id: eventId,
    independence_group: eventId,
    text,
    likes: r.like_count ?? r.likes ?? null,
    game: POWERPRO_VIDEO_IDS.has(String(r.video_id)) ? 'PowerPro' : 'Pro Yakyuu Spirits A',
    labels,
    player: hits.length === 1 ? hits[0].player : null,
    canonical_player_id: hits.length === 1 ? hits[0].player_id : null,
    identity: hits.length === 1 ? 'UNIQUE' : hits.length ? 'AMBIGUOUS' : 'UNMAPPED',
    acceptance_status: accepted ? 'ACCEPTED_RATING_OR_DIRECTIONAL_CONTEXT' : 'INCONCLUSIVE',
    origin_count: 0,
    reaction_volume: 1,
  };
});

// Same-video comments are one origin; reaction volume is the comment count.
const byEvent = new Map();
for (const r of classified) {
  if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
  byEvent.get(r.event_id).push(r);
}
for (const [, grp] of byEvent) {
  const accepted = grp.filter(r => r.acceptance_status.startsWith('ACCEPTED'));
  if (accepted.length) accepted[0].origin_count = 1;
  for (const r of grp) r.reaction_volume = grp.length;
}

const powerproInv = existsSync(POWERPRO_INV) ? parseCsv(POWERPRO_INV) : parseCsv(COMBINED_INV).filter(r => POWERPRO_VIDEO_IDS.has(r.video_id));
const powerproAcquiredReported = powerproInv.reduce((s, r) => s + Number(r.comment_sample_size || r.comment_total_reported || 0), 0);
const prospiInv = loadJsonl(PROSPI_STAGING).filter(r => r.source_type === 'official_youtube_video_inventory');
const prospiAcquiredReported = prospiInv.reduce((s, r) => s + (Number(r.comments_retrieved) || 0), 0);
const prospiNotAttempted = prospiInv.filter(r => Number(r.comments_retrieved) > 0 === false).length;

const byGame = { PowerPro: 0, 'Pro Yakyuu Spirits A': 0 };
for (const r of classified) {
  if (r.game === 'PowerPro') byGame.PowerPro += 1;
  else byGame['Pro Yakyuu Spirits A'] += 1;
}

const accepted = classified.filter(r => r.acceptance_status.startsWith('ACCEPTED'));
const inconclusive = classified.filter(r => r.acceptance_status === 'INCONCLUSIVE');
const recoveryManifest = existsSync(RECOVERY_MANIFEST)
  ? JSON.parse(readFileSync(RECOVERY_MANIFEST, 'utf8'))
  : null;

writeFileSync(OUT_JSONL, classified.map(r => JSON.stringify(r)).join('\n') + (classified.length ? '\n' : ''));
const qa = {
  generated_at: '2026-08-13',
  source_of_comment_text: recovered.length
    ? 'outputs/derived/speed_youtube_official_comments_recovered_20260813.jsonl'
    : 'run2 staging keyword-retained comments only; full comment text was not persisted in run2',
  new_video_search: false,
  youtube_data_api: 'NOT_USED',
  coverage: {
    acquired_reported_by_run2: {
      powerpro_comments: 257,
      prospi_comments: 4025,
      total: 4282,
      note: 'These are run2 counted comments. Parser-derived sample sizes are not used as the official count.',
      parser_powerpro_sample_sum: powerproAcquiredReported,
      parser_prospi_retrieved_sum: prospiAcquiredReported,
    },
    comment_text_classified_now: {
      powerpro: byGame.PowerPro,
      prospi: byGame['Pro Yakyuu Spirits A'],
      total: classified.length,
    },
    not_collected_or_inaccessible: {
      run2_prospi_videos_comments_not_attempted: prospiNotAttempted,
      youtube_data_api_pagination_beyond_ytdlp_bound: 'NOT_COLLECTED',
      comment_text_not_retained_if_recovery_failed: recovered.length
        ? 0
        : (powerproAcquiredReported + prospiAcquiredReported) - classified.length,
      note: 'Not collected is not a negative finding that comments do not exist.',
    },
  },
  accepted_evidence: {
    current_100_player_mapped: accepted.length,
    distinct_events: new Set(accepted.map(r => r.event_id)).size,
    label_counts: classified.reduce((a, r) => {
      for (const l of r.labels) a[l] = (a[l] ?? 0) + 1;
      return a;
    }, {}),
    videos_as_origins: byEvent.size,
    note: 'Same-video comments share one origin. reaction_volume is the comment count on that video. Labels are not independent physical measurements.',
  },
  inconclusive_evidence: { rows: inconclusive.length },
  recovery_manifest_totals: recoveryManifest?.totals ?? null,
  verdict: classified.length ? 'CLASSIFIED_AVAILABLE_TEXT' : 'NO_COMMENT_TEXT_AVAILABLE',
};
writeFileSync(OUT_QA, JSON.stringify(qa, null, 2));
console.log(JSON.stringify(qa, null, 2));

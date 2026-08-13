// SP-032/036/037 — run2 community raw を非破壊で正規化する。
// 元 raw は上書きしない。
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'outputs', 'derived', 'speed_community_rating_raw_20260813_run2.jsonl');
const OUT_JSONL = path.join(ROOT, 'outputs', 'derived', 'speed_community_rating_normalized_20260813.jsonl');
const OUT_QA = path.join(ROOT, 'outputs', 'derived', 'speed_community_rating_normalized_qa_20260813.json');

const LANES = new Set(['PHYSICAL', 'RATING']);
const CLASS_ENUM = new Set([
  'UNCLASSIFIED_CONTEXT', 'PHYSICAL_FAST', 'PHYSICAL_SLOW',
  'RATING_VALUE_CONTEXT', 'RATING_TOO_HIGH', 'RATING_TOO_LOW', 'STALE_RATING',
  'SPEED_TOO_HIGH', 'SPEED_TOO_LOW', 'INJURY_NOT_REFLECTED', 'AGING_NOT_REFLECTED',
  'PROSPI_MORE_PLAUSIBLE', 'POWERPRO_MORE_PLAUSIBLE', 'PLAYER_COMPARISON',
  'GENERIC_FAST', 'GENERIC_SLOW', 'JOKE_OR_NOISE',
]);

function loadJsonl(p) {
  return readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); }
    catch (e) { throw new Error(`${p}:${i + 1} ${e.message}`); }
  });
}

function asArray(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (value == null) return [];
  const s = String(value).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
    } catch { /* keep as scalar */ }
  }
  return [s];
}

function eventIdOf(r) {
  const existing = String(r.event_id ?? '').trim();
  if (existing) return existing;
  const parent = String(r.parent_event_id ?? '').trim();
  if (parent) return parent;
  const vid = String(r.video_id ?? r.video_id_or_post_id ?? '').trim();
  if (vid && String(r.platform ?? '').toLowerCase() === 'youtube') return `youtube:${vid}`;
  if (vid) return vid;
  const url = String(r.source_url ?? '');
  const m = url.match(/[?&]v=([\w-]{6,})/) || url.match(/youtu\.be\/([\w-]{6,})/);
  if (m) return `youtube:${m[1]}`;
  return `record:${r.record_id}`;
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const raw = loadJsonl(RAW);
const sha = createHash('sha256').update(readFileSync(RAW)).digest('hex');
const findings = [];
const rows = raw.map((r, i) => {
  const classification = asArray(r.classification);
  const lane = String(r.physical_or_rating_lane ?? '').trim().toUpperCase();
  const event_id = eventIdOf(r);
  const origin = numOrNull(r.origin_count);
  const comments = numOrNull(r.comment_count);
  return {
    record_id: r.record_id,
    player: r.player ?? null,
    canonical_player_id: r.canonical_player_id ?? null,
    game: r.game || null,
    edition: r.edition || null,
    platform: r.platform || null,
    source_type: r.source_type,
    source_url: r.source_url || null,
    video_id_or_post_id: r.video_id_or_post_id || r.video_id || null,
    parent_event_id: r.parent_event_id || null,
    event_id,
    independence_group: r.independence_group || event_id,
    author_id_or_name: r.author_id_or_name || null,
    timestamp: r.timestamp || null,
    text: r.text || '',
    likes: numOrNull(r.likes),
    reply_count: r.reply_count ?? null,
    classification,
    classification_primary: classification[0] || 'UNCLASSIFIED_CONTEXT',
    strength: r.strength || null,
    physical_or_rating_lane: lane,
    target_rating_if_explicit: r.target_rating_if_explicit || null,
    comparison_player_if_any: r.comparison_player_if_any || null,
    source_quality: r.source_quality || null,
    notes: r.notes || null,
    acceptance_status: r.acceptance_status || null,
    acceptance_reason: r.acceptance_reason || null,
    reclassification_status: r.reclassification_status || null,
    old_rejection_reason: r.old_rejection_reason || null,
    collected_at: r.collected_at || null,
    origin_count: origin,
    comment_count: comments,
    like_sum: numOrNull(r.like_sum),
    top_like_count: numOrNull(r.top_like_count),
    agreement_ratio: r.agreement_ratio ?? null,
    source_input_path: r.source_input_path || null,
    source_input_sha256: r.source_input_sha256 || null,
    raw_line_index: i + 1,
    raw_sha256: sha,
  };
});

const laneVals = {};
const classPrimary = {};
let emptyEvent = 0;
for (const r of rows) {
  laneVals[r.physical_or_rating_lane] = (laneVals[r.physical_or_rating_lane] ?? 0) + 1;
  classPrimary[r.classification_primary] = (classPrimary[r.classification_primary] ?? 0) + 1;
  if (!r.event_id) emptyEvent += 1;
  if (!LANES.has(r.physical_or_rating_lane)) {
    findings.push({ id: 'N-01', severity: 'BLOCK', summary: `lane not in enum: ${r.physical_or_rating_lane}`, record_id: r.record_id });
  }
  if (!Array.isArray(r.classification)) {
    findings.push({ id: 'N-02', severity: 'BLOCK', summary: 'classification is not an array', record_id: r.record_id });
  }
  if (typeof r.classification === 'string' && r.classification.trim().startsWith('[')) {
    findings.push({ id: 'N-03', severity: 'BLOCK', summary: 'classification still a JSON-array string', record_id: r.record_id });
  }
}
if (Object.keys(laneVals).some(k => k !== k.toUpperCase())) {
  findings.push({ id: 'N-04', severity: 'BLOCK', summary: 'lane case mix remains', detail: laneVals });
}
if (emptyEvent) findings.push({ id: 'N-05', severity: 'BLOCK', summary: `event_id empty after normalize: ${emptyEvent}` });

const eventGroups = new Map();
for (const r of rows) {
  if (!eventGroups.has(r.event_id)) eventGroups.set(r.event_id, []);
  eventGroups.get(r.event_id).push(r);
}

writeFileSync(OUT_JSONL, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
const qa = {
  generated_at: '2026-08-13',
  source_raw: 'outputs/derived/speed_community_rating_raw_20260813_run2.jsonl',
  source_raw_sha256: sha,
  output: 'outputs/derived/speed_community_rating_normalized_20260813.jsonl',
  row_total: rows.length,
  raw_not_overwritten: true,
  schema_value_counts: { physical_or_rating_lane: laneVals, classification_primary: classPrimary },
  event_id_empty: emptyEvent,
  distinct_events: eventGroups.size,
  reaction_volume_fields_present: ['origin_count', 'comment_count', 'like_sum', 'top_like_count', 'agreement_ratio'],
  findings,
  verdict: findings.some(f => f.severity === 'BLOCK') ? 'BLOCK' : 'PASS',
};
writeFileSync(OUT_QA, JSON.stringify(qa, null, 2));
console.log(`normalized=${rows.length} events=${eventGroups.size} verdict=${qa.verdict}`);
for (const f of findings) console.log(`[${f.severity}] ${f.id} ${f.summary}`);
if (qa.verdict === 'BLOCK') process.exit(1);

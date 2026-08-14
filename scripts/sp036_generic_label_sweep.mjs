// SP-036 — 150件台帳の外にある generic fast/slow を既存収集物から掃き出す。0情報化しない。
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'outputs', 'derived', 'speed_community_rating_normalized_20260813.jsonl');
const YT = path.join(ROOT, 'outputs', 'derived', 'sp033_034_youtube_comment_classification_20260813.jsonl');
const RECLASS = path.join(ROOT, 'outputs', 'derived', 'sp032_grok_x_150_reclassification_20260813.jsonl');
const OUT = path.join(ROOT, 'outputs', 'derived', 'sp036_generic_label_sweep_20260814.json');

const load = p => readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const already = new Set(load(RECLASS).map(r => r.record_id));
const kept = [];

function keep(row, source) {
  const text = String(row.text ?? '');
  const labels = row.labels || row.classification || [];
  const lab = Array.isArray(labels) ? labels : [labels];
  const generic = lab.some(l => /GENERIC_FAST|GENERIC_SLOW|PHYSICAL_FAST|PHYSICAL_SLOW/.test(String(l)))
    || /(俊足|鈍足|足が速|足が遅|足速|足遅)/.test(text);
  if (!generic) return;
  if (already.has(row.record_id)) return;
  kept.push({
    record_id: row.record_id,
    source,
    player: row.player ?? row.surname_candidate_player ?? null,
    text: text.slice(0, 240),
    labels: lab,
    bucket: /鈍|遅/.test(text) && !/速/.test(text) ? 'WEAK_PHYSICAL_OR_CONTEXT_SLOW' : 'WEAK_PHYSICAL_OR_CONTEXT_FAST',
    zeroed: false,
    event_id: row.event_id,
    origin_count: 0,
    reaction_volume: 1,
  });
}

for (const r of load(RAW)) keep(r, 'community_normalized');
for (const r of load(YT)) keep(r, 'youtube_classified');

const byEvent = new Map();
for (const r of kept) {
  const k = r.event_id || r.record_id;
  if (!byEvent.has(k)) byEvent.set(k, []);
  byEvent.get(k).push(r);
}
for (const [, g] of byEvent) {
  g[0].origin_count = 1;
  for (const x of g) x.reaction_volume = g.length;
}

writeFileSync(OUT, JSON.stringify({
  generated_at: '2026-08-14',
  outside_150_ledger: kept.length,
  origins: byEvent.size,
  zeroed: 0,
  note: 'These are weak directional labels kept off the numeric teacher path. Not independent physical measurements.',
  rows: kept,
}, null, 2));
console.log(JSON.stringify({ outside_150: kept.length, origins: byEvent.size, zeroed: 0 }, null, 2));

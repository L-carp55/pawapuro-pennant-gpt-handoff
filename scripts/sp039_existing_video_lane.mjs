// SP-039 — 新規の広い動画探索はしない。既存 candidate を context / contamination 付きで棚卸しする。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = [
  'outputs/derived/speed_2026_video_tiebreak_results.json',
  'outputs/derived/speed_2026_video_tiebreak_queue.csv',
  'outputs/derived/speed_2026_final_video_tiebreak_queue.csv',
  'docs/audits/speed_2026_final_video_tiebreak.md',
];
const existing = [];
for (const rel of CANDIDATES) {
  const abs = path.join(ROOT, rel);
  existing.push({ path: rel, present: existsSync(abs), bytes: existsSync(abs) ? readFileSync(abs).length : 0 });
}

let results = [];
const resPath = path.join(ROOT, 'outputs', 'derived', 'speed_2026_video_tiebreak_results.json');
if (existsSync(resPath)) {
  try {
    const j = JSON.parse(readFileSync(resPath, 'utf8'));
    results = Array.isArray(j) ? j : (j.player_results || j.results || j.players || []);
  } catch { /* keep empty */ }
}

const out = {
  generated_at: '2026-08-14',
  broad_search_reopened: false,
  existing_artifacts: existing,
  n_existing_result_rows: results.length,
  classifications: results.map(r => ({
    player: r.player, player_id: r.player_id,
    video_classification: r.video_classification,
    evidence_strength: r.evidence_strength,
    accepted_video_source_count: r.accepted_video_source_count,
    usable_current_full_effort_play_count: r.usable_current_full_effort_play_count,
    post_video_resolution_status: r.post_video_resolution_status,
    contamination_or_context: r.rationale || r.contamination || null,
  })),
  policy: 'Reuse only. Context / contamination flags retained. Not a numeric T90 teacher. Low-weight review lane.',
  usage: 'CONTEXT_VIDEO_LOW_WEIGHT',
  not_collected: existing.filter(e => !e.present).map(e => e.path),
  negative_finding: false,
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp039_existing_video_lane_20260814.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

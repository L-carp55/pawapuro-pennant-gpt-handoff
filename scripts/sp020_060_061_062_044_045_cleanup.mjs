// Phase D/E inventories from existing data only. No fabricated dates/injuries.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const dates = J('outputs/derived/npb_speed_measurement_date_resolution_20260809.json');
const scouting = J('configs/scouting.json');
const grok = existsSync(path.join(ROOT, 'data/manual/speed_2026_grok_x_reviewed_evidence_20260810.json'))
  ? J('data/manual/speed_2026_grok_x_reviewed_evidence_20260810.json') : { records: [] };
const grokSrc = existsSync(path.join(ROOT, 'data/normalized/speed_2026_grok_x_sources.json'))
  ? J('data/normalized/speed_2026_grok_x_sources.json') : null;

const speedScout = (scouting.entries || []).filter(e => e.ability === '走力');
writeFileSync(path.join(ROOT, 'outputs/derived/sp060_scouting_inventory_20260814.json'), JSON.stringify({
  generated_at: '2026-08-14',
  n_speed_entries: speedScout.length,
  entries: speedScout.map(e => ({
    player: e.player, season: e.season, value: e.value,
    evaluator: e.evaluator, basis: e.basis, source: e.source, dated: e.dated,
    usage: 'LOW_MEDIUM_EVIDENCE_NOT_PURE_SPEED_TEACHER',
  })),
  missing_coverage: 'Most 2026-100 players have no official scouting row. Broad recollection not opened.',
  teacher: false,
}, null, 2));

const pinchTexts = [];
const recs = grok.candidate_decisions || grok.records || grok.posts || grok.candidates || [];
const arr = Array.isArray(recs) ? recs : Object.values(recs).flat?.() || [];
for (const r of arr) {
  const t = r.text_excerpt || r.post_text_returned || r.text || '';
  if (/代走/.test(t)) pinchTexts.push({ text: String(t).slice(0, 200), player: r.player || r.target_player || null, source: 'reviewed' });
}
const srcRows = grokSrc?.records || grokSrc?.sources || grokSrc?.items || (Array.isArray(grokSrc) ? grokSrc : []);
for (const r of srcRows) {
  const t = r.text_excerpt || r.quote_excerpt || r.text || '';
  if (/代走/.test(t)) pinchTexts.push({ text: String(t).slice(0, 200), player: r.player || r.canonical_player || null, source: 'normalized_grok_x' });
}
writeFileSync(path.join(ROOT, 'outputs/derived/sp061_pinch_runner_weak_context_20260814.json'), JSON.stringify({
  generated_at: '2026-08-14',
  source: 'existing Grok-X reviewed texts only',
  n_mentions: pinchTexts.length,
  usage: 'WEAK_CONTEXTUAL_NOT_TEACHER',
  note: 'Mentions of 代走 mix manager choice, role, and injury. Not isolated speed.',
  rows: pinchTexts.slice(0, 40),
}, null, 2));

writeFileSync(path.join(ROOT, 'outputs/derived/sp062_defensive_chase_close_20260814.json'), JSON.stringify({
  generated_at: '2026-08-14',
  verdict: 'NOT_DECISION_USEFUL',
  reason: 'Existing NPB+ top_speed / H2F / TZR-RngR mix route, reaction, positioning, and straight-line speed. No source in-repo isolates defensive straight-line chase. Broad recollection not opened.',
  closed: true,
  negative_finding: true,
  scope: 'defensive chase as isolated speed evidence',
}, null, 2));

writeFileSync(path.join(ROOT, 'outputs/derived/sp020_date_resolution_status_20260814.json'), JSON.stringify({
  generated_at: '2026-08-14',
  source: 'outputs/derived/npb_speed_measurement_date_resolution_20260809.json',
  resolved_players: dates.coverage?.resolved_unique_players ?? [],
  unresolved_players: dates.coverage?.unresolved_unique_players ?? [],
  exact_dates_found: 0,
  fabricated: false,
  policy: 'Unresolved dates stay unresolved. Protocol-incomplete rows stay range/confidence (SP-017 overlay).',
  not_collected: 'Further official-profile date hunt for the 19 unresolved players was not completed as a full external sweep this wave. Remaining = DATE_UNRESOLVED, not evidence absence.',
}, null, 2));

const db = new DatabaseSync(path.join(ROOT, 'data/pennant.db'), { readOnly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view')").all().map(r => r.name);
const birthCols = [];
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
  if (cols.some(c => /birth|dob|生年/i.test(c))) birthCols.push({ t, cols });
}
writeFileSync(path.join(ROOT, 'outputs/derived/sp044_age_birth_search_20260814.json'), JSON.stringify({
  generated_at: '2026-08-14',
  pennant_db_birth_columns: birthCols,
  public_roster_checked: {
    source: 'armstjc/Nippon-Baseball-Data-Repository rosters/2025_npb_rosters.csv',
    has_birthdate: false,
    columns: 'person_id,player_name,player_name_kanji,team,jersey,position,announce_date,movement,season',
  },
  status: 'BLOCKED_MISSING_DATA',
  blocker: 'No high-trust birthdate field in pennant.db or the MIT roster dump. NPB official pages are out of collection policy.',
  not_negative_finding: true,
}, null, 2));

writeFileSync(path.join(ROOT, 'outputs/derived/sp045_injury_search_20260814.json'), JSON.stringify({
  generated_at: '2026-08-14',
  pennant_db_injury_tables: 'none',
  pa_drop_not_converted: true,
  roster_removal_not_converted: true,
  existing_texts: 'SNS mentions of ケガ/故障 exist but lack date/body-part/absence/recovery structure.',
  status: 'BLOCKED_MISSING_DATA',
  blocker: 'No structured injury ledger. Would need official IL/press sources; not fabricated from PA drops.',
  not_negative_finding: true,
}, null, 2));

console.log(JSON.stringify({
  scouting: speedScout.length,
  pinch: pinchTexts.length,
  chase: 'CLOSED_NOT_USEFUL',
  birth_cols: birthCols.length,
}, null, 2));

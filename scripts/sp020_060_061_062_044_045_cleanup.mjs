// Phase D/E inventories from existing data only. No fabricated dates/injuries.
//
// 2026-08-14 REPAIR (independent audit findings 1 and 3):
//   - SP-061 previously matched 0 rows in data/normalized/speed_2026_grok_x_sources.json
//     because the corpus loader only accepted the keys records/sources/items while that
//     file stores its rows under `source_records`. Three further corpora holding 代走
//     hits were never opened at all. The loader now accepts ANY top-level array-valued
//     key and enumerates every JSON/JSONL corpus under data/normalized, data/manual and
//     (secondary scope) outputs/derived. Scanned and skipped files are both listed.
//   - SP-062 / SP-045 / SP-060 previously wrote string literals with no data access.
//     They now query data/pennant.db (sqlite_master + PRAGMA table_info) and the on-disk
//     corpora, and report measured counts.
//   - evidence_status is emitted per item. Vocabulary is fixed:
//       MEASURED_NEGATIVE  = we looked, the exact query/paths are recorded, and N = 0
//       MEASURED_POSITIVE  = we looked, the exact query/paths are recorded, and N > 0
//       NOT_COLLECTED      = we did not look / could not look, with the reason
//     取得不能を証拠不存在と混同しない: NOT_COLLECTED is never reported as a negative finding.
//
// SP-020 and SP-044 artifacts are OUT OF THIS WAVE'S WRITE SCOPE. Their generation code is
// unchanged but gated behind SP_WRITE_020_044=1 so this repair cannot touch those files.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const GENERATED_AT = '2026-08-14';
const EVIDENCE_STATUS_VOCAB = ['MEASURED_NEGATIVE', 'MEASURED_POSITIVE', 'NOT_COLLECTED'];

const dates = J('outputs/derived/npb_speed_measurement_date_resolution_20260809.json');
const scouting = J('configs/scouting.json');

// ---------------------------------------------------------------------------
// Generic corpus loader
// ---------------------------------------------------------------------------
// Accepts:
//   *.jsonl                      -> one row per line
//   *.json holding a bare array  -> rows = the array
//   *.json holding an object     -> rows = every element of EVERY top-level array-valued
//                                   key (records / sources / items / source_records /
//                                   entries / rows / data / comments / posts / anything)
// Every row carries its file, its array key and its index so counts are traceable.

// Field-path segments that hold the *search prompt we sent out*, not observed text.
// Matches inside them are counted separately and never treated as evidence.
const PROMPT_FIELD_SEGMENTS = /^(query|queries|query_plan|prompt|search_query|query_kinds|query_log)$/i;

// rawScanPattern: when a file cannot be parsed as rows (CSV), we still count raw pattern
// occurrences so nothing is dropped without a number attached to it.
function listCorpusFiles(dir, { exclude = [], rawScanPattern = null } = {}) {
  const abs = path.join(ROOT, dir);
  const scanned = [];
  const skipped = [];
  if (!existsSync(abs)) return { scanned, skipped: [{ file: dir, reason: 'DIRECTORY_DOES_NOT_EXIST' }] };
  const rawCount = fp => {
    if (!rawScanPattern) return undefined;
    const g = readFileSync(fp, 'utf8').match(new RegExp(rawScanPattern.source, 'g'));
    return g ? g.length : 0;
  };
  for (const name of readdirSync(abs).sort()) {
    const fp = path.join(abs, name);
    if (!statSync(fp).isFile()) { skipped.push({ file: rel(fp), reason: 'NOT_A_FILE' }); continue; }
    if (exclude.some(rx => rx.test(name))) {
      skipped.push({ file: rel(fp), reason: 'SELF_OUTPUT_OF_THIS_SCRIPT_EXCLUDED_TO_AVOID_CIRCULAR_COUNTING' });
      continue;
    }
    if (/\.jsonl$/i.test(name) || /\.json$/i.test(name)) { scanned.push(fp); continue; }
    if (/\.csv$/i.test(name)) {
      const twins = [name.replace(/\.csv$/i, '.json'), name.replace(/\.csv$/i, '.jsonl')]
        .filter(t => existsSync(path.join(abs, t)) && !exclude.some(rx => rx.test(t)));
      const occ = rawCount(fp);
      skipped.push({
        file: rel(fp),
        reason: twins.length
          ? `CSV_MIRROR_OF_SCANNED_STRUCTURED_TWIN(${twins.join(',')})`
          : 'CSV_NOT_PARSED_BY_THIS_SWEEP_NO_STRUCTURED_TWIN',
        structured_twin_scanned: twins,
        ...(occ === undefined ? {} : {
          raw_pattern_occurrences_unparsed: occ,
          row_level_attribution: occ > 0 && !twins.length ? 'NOT_COLLECTED_PATTERN_PRESENT_IN_UNPARSED_CSV' : 'NOT_APPLICABLE',
        }),
      });
      continue;
    }
    const occ = rawCount(fp);
    skipped.push({ file: rel(fp), reason: 'NOT_JSON_OR_JSONL', ...(occ === undefined ? {} : { raw_pattern_occurrences_unparsed: occ }) });
  }
  return { scanned, skipped };
}

function loadCorpus(fp) {
  const raw = readFileSync(fp, 'utf8');
  const out = { file: rel(fp), bytes: raw.length, rows: [], arrays: [], parse_error: null };
  try {
    if (/\.jsonl$/i.test(fp)) {
      const lines = raw.split(/\r?\n/).filter(Boolean);
      lines.forEach((l, i) => out.rows.push({ key: '__jsonl_line', index: i, obj: JSON.parse(l) }));
      out.arrays.push({ key: '__jsonl_line', n: lines.length });
      return out;
    }
    const j = JSON.parse(raw);
    if (Array.isArray(j)) {
      j.forEach((o, i) => out.rows.push({ key: '__root_array', index: i, obj: o }));
      out.arrays.push({ key: '__root_array', n: j.length });
      return out;
    }
    if (j && typeof j === 'object') {
      for (const [k, v] of Object.entries(j)) {
        if (!Array.isArray(v)) continue;
        out.arrays.push({ key: k, n: v.length });
        v.forEach((o, i) => out.rows.push({ key: k, index: i, obj: o }));
      }
    }
    return out;
  } catch (e) {
    out.parse_error = String(e.message).slice(0, 200);
    return out;
  }
}

// Walk one row and return every string leaf with its field path.
function stringLeaves(node, trail = [], acc = []) {
  if (typeof node === 'string') { acc.push({ path: trail.join('.') || '__self', value: node }); return acc; }
  if (Array.isArray(node)) { node.forEach(x => stringLeaves(x, trail.concat('[]'), acc)); return acc; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) stringLeaves(v, trail.concat(k), acc);
  }
  return acc;
}
const isPromptPath = p => p.split('.').some(seg => PROMPT_FIELD_SEGMENTS.test(seg));

function firstString(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// SP-061 — pinch-runner (代走) sweep over every corpus, not one file
// ---------------------------------------------------------------------------
const PINCH_RE = /代走/;
const SELF_OUTPUTS = [/^sp060_/, /^sp061_/, /^sp062_/, /^sp045_/, /^sp044_/, /^sp020_/, /^sp036_/];

// Same post is stored as a bare id in one corpus and as a full URL in another. Normalize
// to a platform-native id so the unique count is not inflated by namespace differences.
function canonicalIdentity(raw, fallback) {
  const s = String(raw ?? '').trim();
  if (!s) return { id: fallback, unit: 'ROW_POSITION_FALLBACK' };
  let m = s.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i);
  if (m) return { id: `x:${m[1]}`, unit: 'SINGLE_POST' };
  m = s.match(/youtube\.com\/watch\?[^"']*?v=([\w-]+)(?:[^"']*?[&?]lc=([\w.-]+))?/i);
  if (m) return { id: `youtube:${m[1]}${m[2] ? '#' + m[2] : ''}`, unit: 'SINGLE_POST' };
  if (/^\d{15,}$/.test(s)) return { id: `x:${s}`, unit: 'SINGLE_POST' };
  if (/^GXQ\d+$/i.test(s)) return { id: `receipt:${s}`, unit: 'SEARCH_RESPONSE_BLOB' };
  return { id: s, unit: 'OTHER_SOURCE_ID' };
}

const pinchScopes = [
  { scope: 'PRIMARY', dir: 'data/normalized', exclude: [] },
  { scope: 'PRIMARY', dir: 'data/manual', exclude: [] },
  { scope: 'SECONDARY_DERIVED', dir: 'outputs/derived', exclude: SELF_OUTPUTS },
];

const pinchPerFile = [];
const pinchSkipped = [];
const pinchRows = [];
let pinchPromptOnlyHits = 0;

for (const { scope, dir, exclude } of pinchScopes) {
  const { scanned, skipped } = listCorpusFiles(dir, { exclude, rawScanPattern: PINCH_RE });
  for (const s of skipped) pinchSkipped.push({ scope, ...s, evidence_status: 'NOT_COLLECTED' });
  for (const fp of scanned) {
    const c = loadCorpus(fp);
    if (c.parse_error) {
      pinchSkipped.push({ scope, file: c.file, reason: `JSON_PARSE_ERROR: ${c.parse_error}`, evidence_status: 'NOT_COLLECTED' });
      continue;
    }
    let matched = 0;
    let promptHits = 0;
    const fieldHist = {};
    for (const row of c.rows) {
      const leaves = stringLeaves(row.obj);
      const hits = leaves.filter(l => PINCH_RE.test(l.value));
      if (!hits.length) continue;
      const obsHits = hits.filter(h => !isPromptPath(h.path));
      promptHits += hits.length - obsHits.length;
      if (!obsHits.length) continue;
      matched++;
      for (const h of obsHits) fieldHist[h.path] = (fieldHist[h.path] || 0) + 1;
      const o = row.obj;
      const rawIdentity = firstString(o, ['post_url', 'source_url', 'post_id', 'candidate_id', 'source_id', 'record_id', 'receipt_id']);
      const { id: identity, unit } = canonicalIdentity(rawIdentity, `${c.file}#${row.key}[${row.index}]`);
      const longest = obsHits.slice().sort((a, b) => b.value.length - a.value.length)[0];
      const who = firstString(o, ['player', 'target_player', 'canonical_player', 'exact_observation_subject', 'surname_candidate_player']);
      pinchRows.push({
        file: c.file,
        scope,
        array_key: row.key,
        row_index: row.index,
        identity,
        identity_raw: rawIdentity,
        identity_unit: unit,
        attributed_to_player: Boolean(who && String(who).trim()),
        // Grok returned several posts inside one response blob; a hit in that blob does not
        // prove the hit belongs to this row's post.
        text_is_surrounding_search_blob: obsHits.every(h => /surrounding_returned_text|raw_response_text/i.test(h.path)),
        matched_fields: obsHits.map(h => h.path),
        player: who,
        text: String(longest.value).slice(0, 240),
      });
    }
    pinchPromptOnlyHits += promptHits;
    pinchPerFile.push({
      scope,
      file: c.file,
      arrays: c.arrays,
      records_scanned: c.rows.length,
      matched_rows: matched,
      matches_in_excluded_prompt_fields: promptHits,
      matched_field_paths: fieldHist,
      evidence_status: matched > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
    });
  }
}

const pinchUnique = new Map();
for (const r of pinchRows) {
  const prev = pinchUnique.get(r.identity);
  if (!prev) { pinchUnique.set(r.identity, { ...r, seen_in_files: [r.file] }); continue; }
  if (!prev.seen_in_files.includes(r.file)) prev.seen_in_files.push(r.file);
  // keep the copy that carries a player attribution and the longer quoted text
  if ((!prev.attributed_to_player && r.attributed_to_player) || (r.text.length > prev.text.length && r.attributed_to_player === prev.attributed_to_player)) {
    pinchUnique.set(r.identity, { ...r, seen_in_files: prev.seen_in_files });
  }
}
const pinchPrimary = pinchPerFile.filter(f => f.scope === 'PRIMARY');

writeFileSync(path.join(ROOT, 'outputs/derived/sp061_pinch_runner_weak_context_20260814.json'), JSON.stringify({
  generated_at: GENERATED_AT,
  task: 'SP-061 pinch-runner usage as weak contextual evidence',
  evidence_status_vocabulary: EVIDENCE_STATUS_VOCAB,
  method: {
    pattern: String(PINCH_RE),
    corpus_loader: 'every top-level array-valued key of each .json (records/sources/items/source_records/entries/rows/data/comments/posts/…), every line of each .jsonl, or the bare root array',
    prompt_fields_excluded: String(PROMPT_FIELD_SEGMENTS),
    prompt_field_exclusion_rationale: 'Grok/X search prompts contain 代走 as an instruction word; a prompt is not an observation.',
    scopes: pinchScopes.map(s => ({ scope: s.scope, dir: s.dir })),
    code_path: 'scripts/sp020_060_061_062_044_045_cleanup.mjs :: listCorpusFiles + loadCorpus + stringLeaves',
  },
  previous_defect: 'The earlier loader read only .records/.sources/.items, so speed_2026_grok_x_sources.json (key = source_records) matched 0 rows and three other corpora were never opened.',
  totals: {
    files_scanned: pinchPerFile.length,
    files_scanned_primary: pinchPrimary.length,
    files_skipped: pinchSkipped.length,
    records_scanned: pinchPerFile.reduce((a, b) => a + b.records_scanned, 0),
    matched_rows: pinchRows.length,
    matched_rows_primary: pinchRows.filter(r => r.scope === 'PRIMARY').length,
    unique_source_identities: pinchUnique.size,
    unique_single_posts: [...pinchUnique.values()].filter(r => r.identity_unit === 'SINGLE_POST').length,
    unique_search_response_blobs: [...pinchUnique.values()].filter(r => r.identity_unit === 'SEARCH_RESPONSE_BLOB').length,
    unique_single_posts_attributed_to_a_player: [...pinchUnique.values()].filter(r => r.identity_unit === 'SINGLE_POST' && r.attributed_to_player).length,
    unique_single_posts_whose_own_post_text_holds_the_term: [...pinchUnique.values()].filter(r => r.identity_unit === 'SINGLE_POST' && !r.text_is_surrounding_search_blob).length,
    unique_single_posts_matched_only_via_surrounding_search_blob: [...pinchUnique.values()].filter(r => r.identity_unit === 'SINGLE_POST' && r.text_is_surrounding_search_blob).length,
    matches_only_inside_search_prompts: pinchPromptOnlyHits,
    files_with_matches: pinchPerFile.filter(f => f.matched_rows > 0).length,
    unparsed_csv_files_holding_the_pattern_without_a_structured_twin:
      pinchSkipped.filter(s => s.row_level_attribution === 'NOT_COLLECTED_PATTERN_PRESENT_IN_UNPARSED_CSV').length,
    unparsed_csv_raw_occurrences_without_a_structured_twin:
      pinchSkipped.filter(s => s.row_level_attribution === 'NOT_COLLECTED_PATTERN_PRESENT_IN_UNPARSED_CSV')
        .reduce((a, b) => a + (b.raw_pattern_occurrences_unparsed || 0), 0),
  },
  evidence_status: pinchRows.length > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
  usage: 'WEAK_CONTEXTUAL_NOT_TEACHER',
  note: 'Mentions of 代走 mix manager choice, role, and injury. Not isolated speed. Kept, not zeroed.',
  per_file: pinchPerFile,
  skipped_files: pinchSkipped,
  rows: pinchRows,
  unique_rows: [...pinchUnique.values()],
}, null, 2));

// ---------------------------------------------------------------------------
// SP-060 — official scouting evidence inventory (measured, three lanes)
// ---------------------------------------------------------------------------
const scoutEntries = scouting.entries || [];
const speedScout = scoutEntries.filter(e => e.ability === '走力');
const scoutByAbility = {};
for (const e of scoutEntries) scoutByAbility[e.ability] = (scoutByAbility[e.ability] || 0) + 1;

// Lane B: measurement records whose *provenance* fields declare a scouting/draft profile.
const SCOUT_PROVENANCE_RE = /scouting|scout|draft|スカウト|ドラフト/i;
const PROVENANCE_FIELDS = /^(timing_method|protocol_class|source_provenance|source_name|source_url|source_title|source_class|tier|source_type|measurement_protocol)$/i;
const CONTEXT_FIELDS = /^(context|note|notes|reason|cohort|cohort_id|basis|surface_or_conditions|caveat)$/i;

const scoutLaneB = [];
const scoutLaneC = [];
const scoutSkipped = [];
const scoutPlayers = new Set();
let scoutFilesScanned = 0;
let scoutRecordsScanned = 0;
for (const dir of ['data/normalized', 'data/manual']) {
  const { scanned, skipped } = listCorpusFiles(dir);
  for (const s of skipped) scoutSkipped.push({ ...s, evidence_status: 'NOT_COLLECTED' });
  scoutFilesScanned += scanned.length;
  for (const fp of scanned) {
    const c = loadCorpus(fp);
    if (c.parse_error) { scoutSkipped.push({ file: c.file, reason: `JSON_PARSE_ERROR: ${c.parse_error}`, evidence_status: 'NOT_COLLECTED' }); continue; }
    scoutRecordsScanned += c.rows.length;
    let prov = 0, ctx = 0, textOnly = 0;
    const playersHere = new Set();
    for (const row of c.rows) {
      const leaves = stringLeaves(row.obj).filter(l => !isPromptPath(l.path));
      const hit = leaves.filter(l => SCOUT_PROVENANCE_RE.test(l.value));
      if (!hit.length) continue;
      const last = p => p.split('.').filter(s => s !== '[]').pop() || '';
      const provHit = hit.some(h => PROVENANCE_FIELDS.test(last(h.path)));
      const ctxHit = hit.some(h => CONTEXT_FIELDS.test(last(h.path)));
      const who = firstString(row.obj, ['player', 'name', 'player_name', 'exact_observation_subject', 'canonical_player']);
      if (provHit) { prov++; if (who) { playersHere.add(who); scoutPlayers.add(who); } }
      else if (ctxHit) { ctx++; if (who) { playersHere.add(who); scoutPlayers.add(who); } }
      else textOnly++;
    }
    if (prov + ctx + textOnly === 0) continue;
    const entry = {
      file: c.file,
      records_scanned: c.rows.length,
      provenance_field_matches: prov,
      context_field_matches: ctx,
      free_text_mentions_only: textOnly,
      unique_players_with_scouting_provenance: playersHere.size,
      evidence_status: (prov + ctx) > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
    };
    if (prov + ctx > 0) scoutLaneB.push(entry); else scoutLaneC.push(entry);
  }
}

const master100 = existsSync(path.join(ROOT, 'outputs/derived/speed_2026_100_owner_review_master_20260813.json'))
  ? J('outputs/derived/speed_2026_100_owner_review_master_20260813.json') : null;
const master100Rows = master100?.rows || [];
const master100Names = new Set(master100Rows.map(r => String(r.player || '').replace(/[\s　]/g, '')));
const norm = s => String(s || '').replace(/[\s　]/g, '');
const scoutCoverage100 = [...scoutPlayers].filter(p => master100Names.has(norm(p)));
const scoutConfigCoverage100 = speedScout.filter(e => master100Names.has(norm(e.player)));

writeFileSync(path.join(ROOT, 'outputs/derived/sp060_scouting_inventory_20260814.json'), JSON.stringify({
  generated_at: GENERATED_AT,
  task: 'SP-060 official scouting evidence integration',
  evidence_status_vocabulary: EVIDENCE_STATUS_VOCAB,
  inputs_read: [
    { path: 'configs/scouting.json', records: scoutEntries.length, by_ability: scoutByAbility },
    { path: 'data/normalized/*.json(l) + data/manual/*.json(l)', files_scanned: scoutFilesScanned, records_scanned: scoutRecordsScanned, files_skipped: scoutSkipped.length, note: 'per-file counts in lane_b_measurement_corpora / lane_c_free_text_only' },
    { path: 'outputs/derived/speed_2026_100_owner_review_master_20260813.json', records: master100Rows.length },
  ],
  code_path: 'scripts/sp020_060_061_062_044_045_cleanup.mjs :: SP-060 lane A/B/C scan',
  method: {
    lane_a: 'configs/scouting.json entries filtered on ability === 走力',
    lane_b: `records whose provenance fields (${String(PROVENANCE_FIELDS)}) or context fields (${String(CONTEXT_FIELDS)}) match ${String(SCOUT_PROVENANCE_RE)}`,
    lane_c: 'files where the pattern only appears in free text (quoted scout comments in SNS posts) — weaker lane, counted separately',
  },
  lane_a_config_scouting: {
    n_entries_total: scoutEntries.length,
    n_speed_entries: speedScout.length,
    n_speed_entries_inside_2026_100: scoutConfigCoverage100.length,
    evidence_status: speedScout.length > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
    entries: speedScout.map(e => ({
      player: e.player, season: e.season, value: e.value,
      evaluator: e.evaluator, basis: e.basis, source: e.source, dated: e.dated,
      usage: 'LOW_MEDIUM_EVIDENCE_NOT_PURE_SPEED_TEACHER',
    })),
  },
  lane_b_measurement_corpora: {
    files_with_scouting_provenance: scoutLaneB.length,
    records_with_provenance_field_match: scoutLaneB.reduce((a, b) => a + b.provenance_field_matches, 0),
    records_with_context_field_match: scoutLaneB.reduce((a, b) => a + b.context_field_matches, 0),
    unique_players_named: scoutPlayers.size,
    unique_players_inside_2026_100: scoutCoverage100.length,
    evidence_status: scoutLaneB.length > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
    per_file: scoutLaneB,
  },
  lane_c_free_text_only: {
    files: scoutLaneC.length,
    evidence_status: scoutLaneC.length > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
    per_file: scoutLaneC,
    note: 'Scout comments quoted inside SNS/X posts. Directional context only.',
  },
  coverage_vs_2026_100: {
    target_players: master100Rows.length,
    players_with_any_scouting_row: new Set([...scoutCoverage100, ...scoutConfigCoverage100.map(e => norm(e.player))]).size,
  },
  skipped_files: scoutSkipped,
  missing_coverage: 'Most 2026-100 players have no official scouting row. Broad recollection not opened.',
  broad_official_scouting_sweep: {
    evidence_status: 'NOT_COLLECTED',
    reason: 'No external sweep of team/press official scouting profiles was run in this wave. Absence of a row is not evidence that no scouting evaluation exists.',
  },
  teacher: false,
}, null, 2));

// ---------------------------------------------------------------------------
// DB handle (shared by SP-062, SP-044, SP-045)
// ---------------------------------------------------------------------------
const DB_PATH = 'data/pennant.db';
const SQL_OBJECTS = "SELECT type, name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name";
const db = new DatabaseSync(path.join(ROOT, DB_PATH), { readOnly: true });
const dbObjects = db.prepare(SQL_OBJECTS).all();
const dbSchema = dbObjects.map(o => {
  const cols = db.prepare(`PRAGMA table_info(${o.name})`).all().map(c => c.name);
  let rows = null;
  try { rows = db.prepare(`SELECT COUNT(*) AS n FROM "${o.name}"`).get().n; } catch { rows = null; }
  return { type: o.type, name: o.name, columns: cols, rows };
});

// ---------------------------------------------------------------------------
// SP-062 — defensive straight-line chase evidence: actually look
// ---------------------------------------------------------------------------
const CHASE_COL_RE = /chase|pursuit|closing|route|sprint|range|rngr|uzr|tzr|top_speed|reaction/i;
const FIELDING_CONTEXT_RE = /^(fielder|fielder_norm|pos|position)$/i;

const chaseColumnHits = [];
for (const t of dbSchema) {
  const hits = t.columns.filter(c => CHASE_COL_RE.test(c));
  if (!hits.length) continue;
  const fieldingContext = t.columns.some(c => FIELDING_CONTEXT_RE.test(c));
  chaseColumnHits.push({
    object: t.name, type: t.type, rows: t.rows,
    matched_columns: hits,
    table_has_fielding_context_column: fieldingContext,
    sibling_columns: t.columns,
    isolates_defensive_chase: fieldingContext && hits.some(c => /chase|pursuit|closing|route|sprint|top_speed/i.test(c)),
  });
}
const chaseIsolating = chaseColumnHits.filter(h => h.isolates_defensive_chase);

// Defensive-range vocabulary. Bare レンジ is deliberately excluded: it is a substring of
// オレンジ and produced thousands of false positives in the YouTube comment corpora.
const CHASE_TEXT_RE = /守備範囲|守備レンジ|追走|defensive_range|DEFENSIVE_RANGE|\bUZR\b|\bTZR\b|\bRngR\b/i;
// A row only isolates straight-line chase if it names the running motion AND carries a
// measurement unit. Both halves must be present in the same matched text.
const CHASE_METRIC_RE = /uzr|tzr|rngr|range|守備範囲|追走/i;
const CHASE_MOTION_RE = /追走|直線|トップスピード|最高速度|スプリント|sprint|top[ _-]?speed/i;
const CHASE_UNIT_RE = /\d\s*(秒|sec|s\b|km\/?h|キロ|m\/s|ft\/s|フィート)/i;
let chaseRowsMatched = 0, chaseRowsIsolating = 0, chasePromptHits = 0;
const chaseMetricHist = {};   // structured rows whose metric field IS a range metric
const chaseMetricFiles = {};
const chaseTextPerFile = [];
const chaseIsolatingRows = [];
for (const dir of ['data/normalized', 'data/manual', 'outputs/derived']) {
  const { scanned } = listCorpusFiles(dir, { exclude: SELF_OUTPUTS });
  for (const fp of scanned) {
    const c = loadCorpus(fp);
    if (c.parse_error) continue;
    let obs = 0, prompt = 0, iso = 0;
    for (const row of c.rows) {
      // A metric field is a controlled vocabulary, so it is matched with a looser regex
      // than free text (UZR_1200 / UZR_200 carry no word boundary after the R).
      const metricName = firstString(row.obj, ['metric', 'metric_name', 'measure', 'stat']);
      if (metricName && CHASE_METRIC_RE.test(metricName)) {
        chaseMetricHist[metricName] = (chaseMetricHist[metricName] || 0) + 1;
        chaseMetricFiles[c.file] = (chaseMetricFiles[c.file] || 0) + 1;
      }
      const leaves = stringLeaves(row.obj);
      const hits = leaves.filter(l => CHASE_TEXT_RE.test(l.value));
      if (!hits.length) continue;
      const o = hits.filter(h => !isPromptPath(h.path));
      prompt += hits.length - o.length;
      if (!o.length) continue;
      obs++;
      const blob = o.map(h => h.value).join(' ');
      if (CHASE_MOTION_RE.test(blob) && CHASE_UNIT_RE.test(blob)) {
        iso++;
        chaseIsolatingRows.push({ file: c.file, array_key: row.key, row_index: row.index, text: blob.slice(0, 240) });
      }
    }
    if (obs || prompt) chaseTextPerFile.push({ file: c.file, records_scanned: c.rows.length, rows_matched_outside_prompts: obs, rows_passing_isolation_test: iso, matches_inside_search_prompts: prompt });
    chaseRowsMatched += obs; chaseRowsIsolating += iso; chasePromptHits += prompt;
  }
}

writeFileSync(path.join(ROOT, 'outputs/derived/sp062_defensive_chase_close_20260814.json'), JSON.stringify({
  generated_at: GENERATED_AT,
  task: 'SP-062 defensive straight-line chase speed evidence',
  evidence_status_vocabulary: EVIDENCE_STATUS_VOCAB,
  code_path: 'scripts/sp020_060_061_062_044_045_cleanup.mjs :: SP-062 DB column probe + corpus text probe',
  inputs_read: [
    { path: DB_PATH, objects: dbSchema.length, sql: SQL_OBJECTS, per_object: 'PRAGMA table_info(<name>) + SELECT COUNT(*)' },
    { path: 'data/normalized + data/manual + outputs/derived (*.json, *.jsonl)', files_with_hits: chaseTextPerFile.length },
  ],
  items: [
    {
      item: 'pennant.db column isolating defensive straight-line chase',
      evidence_status: chaseIsolating.length > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
      n: chaseIsolating.length,
      query: `${SQL_OBJECTS} then PRAGMA table_info(<name>); column regex ${String(CHASE_COL_RE)}; required fielding-context column regex ${String(FIELDING_CONTEXT_RE)}`,
      objects_scanned: dbSchema.length,
      columns_scanned: dbSchema.reduce((a, b) => a + b.columns.length, 0),
      keyword_matched_objects: chaseColumnHits.length,
      keyword_matches: chaseColumnHits,
      note: 'A keyword match is not a chase metric. npb_plus_measurement.chase_pct sits next to k_pct/bb_rate/barrel_pct and carries no fielder/pos column, so it is plate-discipline chase, not defensive pursuit. That disambiguation is why the isolating test also requires a fielding-context column.',
    },
    {
      item: 'in-repo corpus row isolating defensive chase speed (as opposed to route/reaction/positioning mixes)',
      evidence_status: chaseRowsIsolating > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
      n: chaseRowsIsolating,
      query: `text regex ${String(CHASE_TEXT_RE)} over every array-valued key of every .json/.jsonl in data/normalized, data/manual, outputs/derived; isolation test = ${String(CHASE_MOTION_RE)} AND ${String(CHASE_UNIT_RE)} in the same matched text; search-prompt fields ${String(PROMPT_FIELD_SEGMENTS)} counted separately`,
      rows_mentioning_defensive_range: chaseRowsMatched,
      rows_passing_isolation_test: chaseRowsIsolating,
      matches_inside_search_prompts: chasePromptHits,
      isolating_rows: chaseIsolatingRows.slice(0, 25),
      note: 'Matches are range/RngR/UZR/守備範囲 mentions, which mix route, reaction, positioning and straight-line speed. A large share of raw occurrences is the Grok-X prompt clause instructing the searcher to exclude 守備範囲 posts, counted separately above.',
      per_file: chaseTextPerFile,
    },
    {
      item: 'structured defensive-range metric rows already in the repo (RngR / UZR style)',
      evidence_status: Object.values(chaseMetricHist).reduce((a, b) => a + b, 0) > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
      n: Object.values(chaseMetricHist).reduce((a, b) => a + b, 0),
      query: `rows carrying a metric/metric_name/measure/stat field whose value matches ${String(CHASE_TEXT_RE)}`,
      by_metric: chaseMetricHist,
      by_file: chaseMetricFiles,
      isolates_straight_line_chase: false,
      why_not: 'Range runs are outcome credit per opportunity. They fold route, first step, positioning and arm-independent conversion into one number, and carry no time or distance unit, so they cannot be inverted into straight-line chase speed. They stay usable for defence work; they are not a speed teacher.',
    },
    {
      item: 'external tracking data (Statcast-style fielder sprint/route on batted balls) for NPB',
      evidence_status: 'NOT_COLLECTED',
      n: null,
      reason: 'No such feed is in the repo and no external acquisition was attempted in this wave. This is a collection gap, not evidence that the ability is unmeasurable.',
    },
  ],
  verdict: (chaseIsolating.length === 0 && chaseRowsIsolating === 0) ? 'NOT_DECISION_USEFUL_ON_CURRENT_IN_REPO_SOURCES' : 'CANDIDATE_SOURCE_FOUND_REVIEW_REQUIRED',
  closed: chaseIsolating.length === 0 && chaseRowsIsolating === 0,
  scope: 'defensive chase as isolated speed evidence, in-repo sources only',
  negative_finding_scope_limit: 'Applies only to isolating defensive straight-line chase from in-repo sources. Does not generalize to adjacent lanes (offensive sprint, H2F, T90) and does not close future external tracking collection.',
  db_schema_snapshot: dbSchema.map(t => ({ name: t.name, type: t.type, rows: t.rows, n_columns: t.columns.length })),
}, null, 2));

// ---------------------------------------------------------------------------
// SP-020 / SP-044 — generation retained but OUT OF WRITE SCOPE for this repair wave
// ---------------------------------------------------------------------------
const birthCols = [];
for (const t of dbSchema) {
  if (t.columns.some(c => /birth|dob|生年/i.test(c))) birthCols.push({ t: t.name, cols: t.columns });
}
if (process.env.SP_WRITE_020_044 === '1') {
  writeFileSync(path.join(ROOT, 'outputs/derived/sp020_date_resolution_status_20260814.json'), JSON.stringify({
    generated_at: GENERATED_AT,
    source: 'outputs/derived/npb_speed_measurement_date_resolution_20260809.json',
    resolved_players: dates.coverage?.resolved_unique_players ?? [],
    unresolved_players: dates.coverage?.unresolved_unique_players ?? [],
    exact_dates_found: 0,
    fabricated: false,
    policy: 'Unresolved dates stay unresolved. Protocol-incomplete rows stay range/confidence (SP-017 overlay).',
    not_collected: 'Further official-profile date hunt for the 19 unresolved players was not completed as a full external sweep this wave. Remaining = DATE_UNRESOLVED, not evidence absence.',
  }, null, 2));
  writeFileSync(path.join(ROOT, 'outputs/derived/sp044_age_birth_search_20260814.json'), JSON.stringify({
    generated_at: GENERATED_AT,
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
}

// ---------------------------------------------------------------------------
// SP-045 — injury/recovery: run the actual schema scan and the actual text scan
// ---------------------------------------------------------------------------
const INJURY_RE = /故障|離脱|負傷|怪我|ケガ|登録抹消|抹消|injur|disabled_list|(^|_)(dl|il)($|_)/i;
const injuryObjectHits = dbObjects.filter(o => INJURY_RE.test(o.name)).map(o => o.name);
const injuryColumnHits = [];
for (const t of dbSchema) {
  const hits = t.columns.filter(c => INJURY_RE.test(c));
  if (hits.length) injuryColumnHits.push({ object: t.name, matched_columns: hits, rows: t.rows });
}

// Unstructured injury mentions in existing text corpora, with a structure test.
const DATE_RE = /(19|20)\d{2}[-/年.]\s?\d{1,2}[-/月.]/;
const BODY_PART_RE = /(ハムストリング|太もも|大腿|ふくらはぎ|足首|アキレス|膝|ひざ|肩|肘|ひじ|腰|手首|指|股関節|肉離れ|骨折|靭帯)/;
const injuryTextPerFile = [];
let injuryRows = 0, injuryRowsWithDate = 0, injuryRowsWithBodyPart = 0, injuryRowsFullyStructured = 0;
for (const dir of ['data/normalized', 'data/manual', 'outputs/derived']) {
  const { scanned } = listCorpusFiles(dir, { exclude: SELF_OUTPUTS });
  for (const fp of scanned) {
    const c = loadCorpus(fp);
    if (c.parse_error) continue;
    let n = 0, nd = 0, nb = 0, nf = 0;
    for (const row of c.rows) {
      const leaves = stringLeaves(row.obj).filter(l => !isPromptPath(l.path));
      const hits = leaves.filter(l => INJURY_RE.test(l.value));
      if (!hits.length) continue;
      n++;
      const blob = hits.map(h => h.value).join(' ');
      const hasDate = DATE_RE.test(blob);
      const hasPart = BODY_PART_RE.test(blob);
      if (hasDate) nd++;
      if (hasPart) nb++;
      if (hasDate && hasPart) nf++;
    }
    if (n) {
      injuryTextPerFile.push({ file: c.file, records_scanned: c.rows.length, rows_with_injury_term: n, with_date: nd, with_body_part: nb, with_date_and_body_part: nf });
      injuryRows += n; injuryRowsWithDate += nd; injuryRowsWithBodyPart += nb; injuryRowsFullyStructured += nf;
    }
  }
}

writeFileSync(path.join(ROOT, 'outputs/derived/sp045_injury_search_20260814.json'), JSON.stringify({
  generated_at: GENERATED_AT,
  task: 'SP-045 injury/recovery join for temporal/stale analysis',
  evidence_status_vocabulary: EVIDENCE_STATUS_VOCAB,
  code_path: 'scripts/sp020_060_061_062_044_045_cleanup.mjs :: SP-045 sqlite_master/PRAGMA scan + corpus text scan',
  inputs_read: [
    { path: DB_PATH, sql: SQL_OBJECTS, objects: dbSchema.length, columns: dbSchema.reduce((a, b) => a + b.columns.length, 0) },
    { path: 'data/normalized + data/manual + outputs/derived (*.json, *.jsonl)', files_with_injury_terms: injuryTextPerFile.length },
  ],
  items: [
    {
      item: 'injury table in pennant.db',
      evidence_status: injuryObjectHits.length > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
      n: injuryObjectHits.length,
      query: `${SQL_OBJECTS}; name regex ${String(INJURY_RE)}`,
      objects_scanned: dbSchema.length,
      matches: injuryObjectHits,
    },
    {
      item: 'injury-related column in any pennant.db table or view',
      evidence_status: injuryColumnHits.length > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
      n: injuryColumnHits.length,
      query: `PRAGMA table_info(<name>) for all ${dbSchema.length} objects; column regex ${String(INJURY_RE)} (the (^|_)(dl|il)($|_) branch is anchored so it cannot match substrings such as "fielding")`,
      columns_scanned: dbSchema.reduce((a, b) => a + b.columns.length, 0),
      matches: injuryColumnHits,
    },
    {
      item: 'unstructured injury mentions in existing collected text',
      evidence_status: injuryRows > 0 ? 'MEASURED_POSITIVE' : 'MEASURED_NEGATIVE',
      n: injuryRows,
      query: `text regex ${String(INJURY_RE)} over every array-valued key of every .json/.jsonl in data/normalized, data/manual, outputs/derived; structure test = date ${String(DATE_RE)} and body part ${String(BODY_PART_RE)} in the same matched text`,
      rows_with_date: injuryRowsWithDate,
      rows_with_body_part: injuryRowsWithBodyPart,
      rows_with_date_and_body_part: injuryRowsFullyStructured,
      per_file: injuryTextPerFile,
      note: 'Mentions exist but lack the absence/recovery window a ledger needs; they are kept as weak context, not zeroed.',
    },
    {
      item: 'official IL / registration-removal (登録抹消) feed',
      evidence_status: 'NOT_COLLECTED',
      n: null,
      reason: 'No external acquisition attempted in this wave; NPB official pages are outside the collection policy. Absence here is a collection gap, not evidence that no injuries occurred.',
    },
    {
      item: 'PA drop / roster removal converted into injury events',
      evidence_status: 'NOT_COLLECTED',
      n: null,
      reason: 'Deliberately not derived. Converting a plate-appearance drop into an injury would fabricate the event; npb_usage_2026 has plate_appearances/games but no cause field.',
    },
  ],
  status: (injuryObjectHits.length === 0 && injuryColumnHits.length === 0) ? 'BLOCKED_MISSING_DATA' : 'STRUCTURED_SOURCE_FOUND_REVIEW_REQUIRED',
  blocker: `No structured injury ledger: ${injuryObjectHits.length} matching tables/views and ${injuryColumnHits.length} matching columns across ${dbSchema.length} pennant.db objects; ${injuryRows} text rows mention an injury term but ${injuryRowsFullyStructured} carry both a date and a body part.`,
  not_negative_finding: 'The BLOCKED status is missing data, not a finding that injuries are irrelevant to speed.',
}, null, 2));

console.log(JSON.stringify({
  sp060_config_speed_rows: speedScout.length,
  sp060_lane_b_files: scoutLaneB.length,
  sp060_lane_b_provenance_rows: scoutLaneB.reduce((a, b) => a + b.provenance_field_matches, 0),
  sp060_unique_players: scoutPlayers.size,
  sp061_files_scanned: pinchPerFile.length,
  sp061_records_scanned: pinchPerFile.reduce((a, b) => a + b.records_scanned, 0),
  sp061_matched_rows: pinchRows.length,
  sp061_unique_sources: pinchUnique.size,
  sp062_db_objects: dbSchema.length,
  sp062_keyword_columns: chaseColumnHits.length,
  sp062_isolating_columns: chaseIsolating.length,
  sp045_injury_tables: injuryObjectHits.length,
  sp045_injury_columns: injuryColumnHits.length,
  sp045_text_rows: injuryRows,
  birth_cols: birthCols.length,
}, null, 2));

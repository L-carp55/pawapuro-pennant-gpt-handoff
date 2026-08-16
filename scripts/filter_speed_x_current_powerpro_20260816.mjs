#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const DERIVED = path.join(ROOT, 'outputs', 'derived');
const AUDITS = path.join(ROOT, 'docs', 'audits');
const INPUT = path.join(DERIVED, 'speed_community_v3_canonical_20260815.jsonl');
const DATE = '2026-08-16';
const CURRENT_START = '2025-01-01';

const OUT_ACTIVE = path.join(DERIVED, `speed_x_current_powerpro_clean_${DATE.replaceAll('-', '')}.jsonl`);
const OUT_SUMMARY = path.join(DERIVED, `speed_x_current_powerpro_summary_${DATE.replaceAll('-', '')}.csv`);
const OUT_HISTORY = path.join(DERIVED, `speed_x_historical_trajectory_${DATE.replaceAll('-', '')}.jsonl`);
const OUT_PROSPI = path.join(DERIVED, `speed_x_excluded_prospi_${DATE.replaceAll('-', '')}.jsonl`);
const OUT_QA = path.join(DERIVED, `speed_x_current_powerpro_qa_${DATE.replaceAll('-', '')}.json`);
const OUT_AUDIT = path.join(AUDITS, `speed_x_current_powerpro_cleanup_${DATE.replaceAll('-', '')}.md`);

const text = fs.readFileSync(INPUT, 'utf8');
const inputSha256 = crypto.createHash('sha256').update(text).digest('hex');
const all = text.split(/\r?\n/).filter(Boolean).map((line, i) => {
  try { return JSON.parse(line); }
  catch (err) { throw new Error(`Invalid JSONL at line ${i + 1}: ${err.message}`); }
});
const xRows = all.filter(r => String(r.platform || '').toLowerCase() === 'x');

const norm = v => String(v ?? '').trim();
const low = v => norm(v).toLowerCase();
const dateOnly = v => {
  const s = norm(v);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};
const isCurrentDate = d => Boolean(d && d >= CURRENT_START && d <= '2026-12-31');
const isHistoricalDate = d => Boolean(d && d < CURRENT_START);
// Product identity must come from canonical semantic fields.  Do not inspect
// notes/source_context here: those fields may mention a discovery query or an
// author's profile even when the row itself is a game-independent observation.
const productString = r => [r.source_product, r.game, r.source_claim_lane, r.claim_lane].map(norm).join(' | ');
const textString = r => [r.text_or_excerpt, r.source_context, r.notes].map(norm).join(' | ');

function isProspi(r) {
  const p = low(productString(r));
  return p.includes('prospi') || p.includes('プロスピ') || norm(r.claim_lane) === 'RATING_PROSPI' || norm(r.source_claim_lane) === 'RATING_PROSPI';
}
function isPowerProApp(r) {
  const p = low(productString(r));
  const t = low(norm(r.text_or_excerpt));
  return (p.includes('powerpro') || p.includes('パワプロ')) && (p.includes('app') || p.includes('mobile') || p.includes('アプリ') || t.includes('パワプロアプリ'));
}
function isPowerProRating(r) {
  const lane = norm(r.claim_lane);
  const sourceLane = norm(r.source_claim_lane);
  const p = low(productString(r));
  return lane === 'RATING_POWERPRO' || sourceLane === 'RATING_POWERPRO' || ((p.includes('powerpro') || p.includes('パワプロ')) && lane.startsWith('RATING_'));
}
function isUsableRatingStatus(r) {
  return ['USABLE_RATING_CONTEXT', 'CONTEXT_ONLY_COMPARISON'].includes(norm(r.canonical_status));
}
function isUsablePhysical(r) {
  return norm(r.canonical_status) === 'USABLE_PHYSICAL_CONTEXT' && norm(r.claim_lane) === 'PHYSICAL_OBSERVATION' && Boolean(r.speed_semantics_present);
}
function isTechnique(r) {
  return ['BASERUNNING_TECHNIQUE', 'STEALING_TECHNIQUE'].includes(norm(r.claim_lane)) || norm(r.canonical_status) === 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY';
}
function isDuplicate(r) {
  return norm(r.canonical_status) === 'EXCLUDED_DUPLICATE' || norm(r.dedupe_status).startsWith('DUPLICATE_') || Boolean(r.duplicate_of);
}
function hasGameProduct(r) {
  return Boolean(norm(r.source_product) || norm(r.game));
}
function isGameIndependentPhysical(r) {
  // Owner rule: physical lane must be real-world, not a game/card/rating observation.
  // Conservative fail-closed rule: rows with an explicit game/product are not treated as game-independent.
  return isUsablePhysical(r) && !hasGameProduct(r) && !isProspi(r) && !isPowerProApp(r);
}
function needsReview(r) {
  return norm(r.canonical_status).startsWith('REVIEW_REQUIRED_');
}
function directionIsVote(r) {
  if (norm(r.canonical_status) === 'CONTEXT_ONLY_COMPARISON') return false;
  return ['TOO_HIGH', 'TOO_LOW', 'APPROPRIATE', 'STALE', 'AGING_NOT_REFLECTED', 'INJURY_NOT_REFLECTED', 'RECOVERY_NOT_REFLECTED'].includes(norm(r.direction));
}

function isCurrentGameIndependentPhysicalWithContextOnlyProspiMention(r) {
  const d = dateOnly(r.published_at);
  const context = [r.source_context, r.notes].map(norm).join(' | ');
  return isCurrentDate(d)
    && !norm(r.source_product)
    && !norm(r.game)
    && norm(r.claim_lane) === 'PHYSICAL_OBSERVATION'
    && norm(r.canonical_status) === 'USABLE_PHYSICAL_CONTEXT'
    && Boolean(r.speed_semantics_present)
    && /prospi|プロスピ/i.test(context);
}
function isAttributable(r) {
  return norm(r.author_attribution_status) === 'ATTRIBUTABLE' && Boolean(norm(r.author_or_handle));
}
function sourceEvent(r) { return norm(r.source_event_key || r.origin_key || r.record_id); }

function classify(r) {
  const d = dateOnly(r.published_at);
  const base = { ...r, owner_filter_date: DATE, owner_filter_published_date: d };

  // Prospi rule takes precedence for any game/rating/gameplay evidence.
  if (isProspi(r)) return { ...base, owner_disposition: 'EXCLUDED_PROSPI_ALL', owner_exclusion_reason: 'EXCLUDED_PROSPI_PRODUCT_AND_RATING_INTENT' };
  if (isPowerProApp(r)) return { ...base, owner_disposition: 'EXCLUDED_POWERPRO_APP', owner_exclusion_reason: 'EXCLUDED_POWERPRO_APP_OR_MOBILE' };
  if (isDuplicate(r)) return { ...base, owner_disposition: 'EXCLUDED_NON_SPEED', owner_exclusion_reason: 'DUPLICATE_NOT_INDEPENDENT' };

  if (isPowerProRating(r)) {
    if (!d) return { ...base, owner_disposition: 'REVIEW_REQUIRED', owner_exclusion_reason: 'MISSING_OR_UNRESOLVED_DATE' };
    if (isHistoricalDate(d)) return { ...base, owner_disposition: 'HISTORICAL_POWERPRO_TRAJECTORY', owner_exclusion_reason: 'PRE_2025_ARCHIVE_ONLY' };
    if (!isUsableRatingStatus(r)) return { ...base, owner_disposition: 'REVIEW_REQUIRED', owner_exclusion_reason: `SEMANTIC_STATUS_${norm(r.canonical_status) || 'UNKNOWN'}` };
    return { ...base, owner_disposition: 'CURRENT_POWERPRO_RATING', owner_exclusion_reason: null };
  }

  if (isGameIndependentPhysical(r)) {
    if (!d) return { ...base, owner_disposition: 'REVIEW_REQUIRED', owner_exclusion_reason: 'MISSING_OR_UNRESOLVED_DATE' };
    if (isCurrentDate(d)) return { ...base, owner_disposition: 'CURRENT_REALWORLD_SPEED_PHYSICAL', owner_exclusion_reason: null };
    return { ...base, owner_disposition: 'EXCLUDED_NON_SPEED', owner_exclusion_reason: 'OUTSIDE_CURRENT_PHYSICAL_WINDOW' };
  }

  if (isTechnique(r)) {
    if (!d) return { ...base, owner_disposition: 'REVIEW_REQUIRED', owner_exclusion_reason: 'MISSING_OR_UNRESOLVED_DATE' };
    if (isCurrentDate(d) && !hasGameProduct(r)) return { ...base, owner_disposition: 'CURRENT_TECHNIQUE_CONTEXT', owner_exclusion_reason: null };
    return { ...base, owner_disposition: 'EXCLUDED_NON_SPEED', owner_exclusion_reason: 'TECHNIQUE_NOT_CURRENT_GAME_INDEPENDENT' };
  }

  if (needsReview(r) && Boolean(r.speed_semantics_present)) return { ...base, owner_disposition: 'REVIEW_REQUIRED', owner_exclusion_reason: `SEMANTIC_STATUS_${norm(r.canonical_status)}` };
  return { ...base, owner_disposition: 'EXCLUDED_NON_SPEED', owner_exclusion_reason: 'NOT_ACTIVE_SPEED_EVIDENCE' };
}

const classified = xRows.map(classify);
const byBucket = Object.fromEntries([...new Set(classified.map(r => r.owner_disposition))].sort().map(k => [k, classified.filter(r => r.owner_disposition === k)]));
const active = classified.filter(r => ['CURRENT_POWERPRO_RATING', 'CURRENT_REALWORLD_SPEED_PHYSICAL', 'CURRENT_TECHNIQUE_CONTEXT'].includes(r.owner_disposition));
const history = byBucket.HISTORICAL_POWERPRO_TRAJECTORY || [];
const prospi = byBucket.EXCLUDED_PROSPI_ALL || [];
const currentRating = byBucket.CURRENT_POWERPRO_RATING || [];
const currentPhysical = byBucket.CURRENT_REALWORLD_SPEED_PHYSICAL || [];
const currentTechnique = byBucket.CURRENT_TECHNIQUE_CONTEXT || [];

function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }
function countCurrent100Players(rows) { return uniq(rows.filter(r => r.current_100).map(r => norm(r.player_id || r.player_name))).length; }
function independentEvents(rows) { return uniq(rows.filter(r => !isDuplicate(r)).map(sourceEvent)); }
function authorOrigins(rows) { return uniq(rows.filter(isAttributable).map(r => norm(r.attributable_author_origin_key || r.origin_key || `${r.author_or_handle}:${sourceEvent(r)}`))); }

const ratingVoteRows = currentRating.filter(directionIsVote);
const current100Rating = currentRating.filter(r => r.current_100);
const current100Vote = ratingVoteRows.filter(r => r.current_100);
const current100Physical = currentPhysical.filter(r => r.current_100);

const players = new Map();
for (const r of active.filter(r => r.current_100)) {
  const key = norm(r.player_id || r.player_name);
  if (!players.has(key)) players.set(key, { player: norm(r.player_name), player_id: norm(r.player_id), rating_claims: 0, directional_rating_claims: 0, physical_speed_observations: 0, technique_context: 0, attributable_origins: new Set(), unattributed_events: new Set(), directions: [] });
  const p = players.get(key);
  if (r.owner_disposition === 'CURRENT_POWERPRO_RATING') {
    p.rating_claims++;
    if (directionIsVote(r)) { p.directional_rating_claims++; p.directions.push(norm(r.direction)); }
  }
  if (r.owner_disposition === 'CURRENT_REALWORLD_SPEED_PHYSICAL') p.physical_speed_observations++;
  if (r.owner_disposition === 'CURRENT_TECHNIQUE_CONTEXT') p.technique_context++;
  if (isAttributable(r)) p.attributable_origins.add(norm(r.attributable_author_origin_key || r.origin_key || `${r.author_or_handle}:${sourceEvent(r)}`));
  else p.unattributed_events.add(sourceEvent(r));
}
function verdict(p) {
  const dirs = p.directions;
  const hi = dirs.filter(x => x === 'TOO_HIGH').length;
  const lo = dirs.filter(x => x === 'TOO_LOW').length;
  const stale = dirs.filter(x => ['STALE', 'AGING_NOT_REFLECTED', 'INJURY_NOT_REFLECTED', 'RECOVERY_NOT_REFLECTED'].includes(x)).length;
  const ok = dirs.filter(x => x === 'APPROPRIATE').length;
  if ((hi && lo) || ((hi || lo || stale) && ok)) return 'MIXED';
  if (hi) return 'TOO_HIGH';
  if (lo) return 'TOO_LOW';
  if (stale) return 'STALE_OR_TEMPORAL_CONCERN';
  if (ok) return 'APPROPRIATE';
  if (p.rating_claims) return 'RATING_CONTEXT_ONLY';
  if (p.physical_speed_observations) return 'PHYSICAL_CONTEXT_ONLY';
  if (p.technique_context) return 'TECHNIQUE_CONTEXT_ONLY';
  return 'INSUFFICIENT';
}
const summaryRows = [...players.values()].sort((a,b) => a.player.localeCompare(b.player, 'ja')).map(p => ({
  player: p.player, player_id: p.player_id, rating_claims: p.rating_claims, directional_rating_claims: p.directional_rating_claims,
  physical_speed_observations: p.physical_speed_observations, technique_context: p.technique_context,
  attributable_origins: p.attributable_origins.size, unattributed_events: p.unattributed_events.size, verdict: verdict(p)
}));

const csvEscape = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; };
const csvCols = ['player','player_id','rating_claims','directional_rating_claims','physical_speed_observations','technique_context','attributable_origins','unattributed_events','verdict'];
const csv = [csvCols.join(','), ...summaryRows.map(r => csvCols.map(c => csvEscape(r[c])).join(','))].join('\n') + '\n';

function machineChecks() {
  const checks = {};
  checks.active_rating_prospi_zero = currentRating.filter(isProspi).length === 0;
  checks.active_rating_pre2025_zero = currentRating.filter(r => !isCurrentDate(dateOnly(r.published_at))).length === 0;
  checks.active_rating_missing_date_zero = currentRating.filter(r => !dateOnly(r.published_at)).length === 0;
  checks.active_rating_powerpro_app_zero = currentRating.filter(isPowerProApp).length === 0;
  const comparisonOnlyIds = new Set(currentRating.filter(r => norm(r.direction) === 'COMPARISON_ONLY' || norm(r.canonical_status) === 'CONTEXT_ONLY_COMPARISON').map(r => norm(r.record_id)));
  checks.comparison_only_vote_zero = !ratingVoteRows.some(r => comparisonOnlyIds.has(norm(r.record_id)));
  checks.active_duplicates_zero = active.filter(isDuplicate).length === 0;
  checks.physical_generic_non_speed_zero = currentPhysical.filter(r => !r.speed_semantics_present || norm(r.claim_lane) !== 'PHYSICAL_OBSERVATION').length === 0;
  checks.technique_counted_as_physical_zero = currentPhysical.filter(isTechnique).length === 0;
  checks.active_traceable_record_id_all = active.every(r => Boolean(norm(r.record_id)));
  checks.context_only_prospi_mentions_do_not_exclude_physical = !classified.some(r => isCurrentGameIndependentPhysicalWithContextOnlyProspiMention(r) && r.owner_disposition !== 'CURRENT_REALWORLD_SPEED_PHYSICAL');
  checks.x_only_input = classified.every(r => low(r.platform) === 'x');
  checks.owner_buckets_mutually_exclusive = classified.length === xRows.length && classified.every(r => Boolean(r.owner_disposition));
  checks.nishikawa_shoki_not_nishikawa_ryoma = !classified.some(r => /西川史礁/.test(textString(r)) && norm(r.player_name) === '西川 龍馬' && !norm(r.canonical_status).startsWith('EXCLUDED_'));
  checks.yamamoto_taido_not_yamamoto_yudai = !classified.some(r => /山本大斗/.test(textString(r)) && norm(r.player_name) === '山本 祐大' && !norm(r.canonical_status).startsWith('EXCLUDED_'));
  checks.fukudome_power_only_not_active_speed = !active.some(r => /福留/.test(textString(r)) && /パワー/.test(textString(r)) && !/走力|足|速|遅|スピード/.test(norm(r.text_or_excerpt)));
  checks.shiomi_comparison_not_vote = !ratingVoteRows.some(r => /盗塁王/.test(textString(r)) && norm(r.player_name) === '塩見 泰隆');
  checks.maruyama_iwata_subject_preserved = !currentPhysical.some(r => /岩田.*足めっちゃ早|足めっちゃ早.*岩田/.test(textString(r)) && norm(r.player_name) === '丸山 和郁');
  checks.dalbec_matsumoto_comparison_not_vote = !ratingVoteRows.some(r => /ダルベック/.test(textString(r)) && norm(r.player_name) === '松本 剛');
  return checks;
}
const checks = machineChecks();
const failedChecks = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);

const qa = {
  schema_version: 'speed_x_current_powerpro_qa_20260816', generated_at: DATE, input: path.relative(ROOT, INPUT).replaceAll('\\','/'), input_sha256: inputSha256,
  owner_rules: { no_new_collection: true, prospi_game_rating_excluded_all: true, active_current_start: CURRENT_START, powerpro_mainline_only_for_rating_consensus: true, game_independent_physical_separate: true },
  previous_superseded_metrics: { final_canonical_x_speed_relevant_claims: 138, current100_players_with_usable_community_evidence_all_platforms: 55 },
  input_counts: { terra_all_rows: all.length, terra_x_rows: xRows.length },
  disposition_counts: Object.fromEntries(Object.entries(byBucket).map(([k,v]) => [k,v.length])),
  active_counts: {
    current_powerpro_rating_claims: currentRating.length,
    directional_current_powerpro_rating_claims: ratingVoteRows.length,
    current100_players_with_powerpro_rating_evidence: countCurrent100Players(currentRating),
    current100_players_with_directional_powerpro_evidence: countCurrent100Players(ratingVoteRows),
    current_realworld_speed_physical_observations: currentPhysical.length,
    current100_players_with_realworld_speed_physical_observations: countCurrent100Players(currentPhysical),
    current_technique_context_rows: currentTechnique.length,
    active_unique_source_events: independentEvents(active).length,
    active_attributable_author_origins: authorOrigins(active).length,
    active_unattributed_source_events: independentEvents(active.filter(r => !isAttributable(r))).length,
    historical_powerpro_rows_archived: history.length,
    prospi_rows_excluded: prospi.length
  },
  machine_checks: checks,
  failed_checks: failedChecks,
  verdict: failedChecks.length ? 'FAIL' : 'PASS'
};

function short(s, n=180) { s = norm(s).replace(/\s+/g,' '); return s.length > n ? s.slice(0,n-1) + '…' : s; }
function mdEscape(s) { return short(s).replaceAll('|','\\|'); }
function claimTable(rows) {
  if (!rows.length) return '_None._\n';
  const lines = ['| Date | Player | Text | Direction / value | current100 | Source | Author |','|---|---|---|---|---:|---|---|'];
  for (const r of rows.sort((a,b) => (dateOnly(a.published_at)||'').localeCompare(dateOnly(b.published_at)||'') || norm(a.player_name).localeCompare(norm(b.player_name),'ja'))) {
    const dv = [norm(r.direction), norm(r.explicit_value)].filter(Boolean).join(' / ');
    lines.push(`| ${dateOnly(r.published_at) || ''} | ${mdEscape(r.player_name || r.source_player || '')} | ${mdEscape(r.text_or_excerpt)} | ${mdEscape(dv)} | ${r.current_100 ? 'yes' : 'no'} | ${norm(r.source_url)} | ${isAttributable(r) ? mdEscape(r.author_or_handle) : 'unattributed'} |`);
  }
  return lines.join('\n') + '\n';
}

function valueJudgment() {
  const pRating = countCurrent100Players(currentRating);
  const pDir = countCurrent100Players(ratingVoteRows);
  const pPhys = countCurrent100Players(currentPhysical);
  // Conservative rubric. Presence alone is not enough.
  if (pDir >= 15 || (pDir >= 10 && pPhys >= 10)) return 'X_COLLECTION_USEFUL';
  if (pDir >= 5 || pPhys >= 5 || pRating >= 10) return 'X_COLLECTION_LIMITED_VALUE';
  return 'X_COLLECTION_METHOD_MISALIGNED';
}
const value = valueJudgment();
qa.value_judgment = value;

const audit = `# X current PowerPro evidence cleanup\n\nDate: ${DATE}\n\n## Owner rule correction\n\nThis pass performs **zero new X/web/YouTube collection**. It only re-filters the Terra Community V3 canonical X rows. All Prospi game/rating/gameplay evidence is excluded from active appraisal use, regardless of whether a post might refer to mobile or console Prospi. Pre-2025 PowerPro rows are historical trajectory only.\n\nThe previous aggregate \`138 X speed-relevant / 55 current-100 players with Community evidence\` is **superseded for active current PowerPro appraisal use**.\n\n## Counts\n\n- Terra X rows reviewed: ${xRows.length}\n- Current PowerPro rating claims: ${currentRating.length}\n- Directional current PowerPro rating claims: ${ratingVoteRows.length}\n- Current-100 players with PowerPro rating evidence: ${countCurrent100Players(currentRating)}\n- Current-100 players with directional PowerPro evidence: ${countCurrent100Players(ratingVoteRows)}\n- Current real-world speed-specific physical observations: ${currentPhysical.length}\n- Current-100 players with real-world speed-specific physical observations: ${countCurrent100Players(currentPhysical)}\n- Current technique-only context rows: ${currentTechnique.length}\n- Historical PowerPro rows archived: ${history.length}\n- Prospi rows excluded: ${prospi.length}\n- Active attributable author origins: ${authorOrigins(active).length}\n- Active unattributed source events: ${independentEvents(active.filter(r => !isAttributable(r))).length}\n\n## Value judgment\n\n**${value}**\n\nThis judgment is based only on surviving 2025-2026 mainline PowerPro rating evidence plus game-independent real-world speed observations. It does not use the old 138/55 totals as proof of value.\n\n## Every surviving current PowerPro speed-rating row\n\n${claimTable(currentRating)}\n\n## Every surviving 2025-2026 real-world speed-specific physical observation\n\n${claimTable(currentPhysical)}\n\n## QA\n\n- Verdict: **${qa.verdict}**\n- Failed checks: ${failedChecks.length ? failedChecks.join(', ') : 'none'}\n\nMachine QA: \`outputs/derived/speed_x_current_powerpro_qa_20260816.json\`\n`;

const jsonl = rows => rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
fs.writeFileSync(OUT_ACTIVE, jsonl(active));
fs.writeFileSync(OUT_HISTORY, jsonl(history));
fs.writeFileSync(OUT_PROSPI, jsonl(prospi));
fs.writeFileSync(OUT_SUMMARY, csv);
fs.writeFileSync(OUT_QA, JSON.stringify(qa, null, 2) + '\n');
fs.writeFileSync(OUT_AUDIT, audit);

console.log(JSON.stringify({
  verdict: qa.verdict,
  value_judgment: value,
  input_x_rows: xRows.length,
  current_powerpro_rating_claims: currentRating.length,
  directional_current_powerpro_rating_claims: ratingVoteRows.length,
  current100_players_with_powerpro_rating_evidence: countCurrent100Players(currentRating),
  current100_players_with_directional_powerpro_evidence: countCurrent100Players(ratingVoteRows),
  current_realworld_speed_physical: currentPhysical.length,
  current100_players_with_realworld_speed_physical: countCurrent100Players(currentPhysical),
  historical_powerpro_rows: history.length,
  prospi_rows_excluded: prospi.length,
  failed_checks: failedChecks
}, null, 2));

if (failedChecks.length) process.exitCode = 1;

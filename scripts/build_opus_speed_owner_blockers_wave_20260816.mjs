// Deterministic owner-blocker closure wave. Existing repository evidence only:
// no network, no new X/YouTube/Web collection, no shoulder work, no SP-077+ work.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = '2026-08-16';
const CLOSED = new Set(['DONE_VALIDATED', 'DONE_NEGATIVE_FINDING', 'SUPERSEDED', 'OBSOLETE_DUPLICATE']);
const ACTIVE_X_DISPOSITIONS = new Set([
  'CURRENT_POWERPRO_RATING',
  'CURRENT_REALWORLD_SPEED_PHYSICAL',
  'CURRENT_TECHNIQUE_CONTEXT',
]);

const R = {
  genericSweep: 'outputs/derived/sp036_generic_label_sweep_20260814.json',
  legacyGeneric: 'outputs/derived/sp032_grok_x_150_reclassification_20260813.jsonl',
  terraCanonical: 'outputs/derived/speed_community_v3_canonical_20260815.jsonl',
  terraQa: 'outputs/derived/speed_community_v3_semantic_audit_qa_20260815.json',
  cleanX: 'outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl',
  xHistory: 'outputs/derived/speed_x_historical_trajectory_20260816.jsonl',
  xExcludedProspi: 'outputs/derived/speed_x_excluded_prospi_20260816.jsonl',
  xQa: 'outputs/derived/speed_x_current_powerpro_qa_20260816.json',
  sp100: 'outputs/derived/sp100_wiring_candidates_20260814.json',
  sp042: 'outputs/derived/sp042_powerpro_stale_detector.json',
  oldSp075: 'outputs/derived/sp075_stale_conflict_rediagnosis_v3_20260815.json',
  physical: 'data/normalized/speed_historical_physical_measurements_2015_2026.json',
  video: 'data/normalized/speed_2026_video_tiebreak_sources.json',
  db: 'data/pennant.db',
  registry: 'docs/state/speed_task_registry.tsv',
  exclusions: 'docs/state/speed_exclusion_reason_ledger.tsv',
};

const O = {
  sp036: 'outputs/derived/sp036_generic_label_decision_v2_20260816.json',
  sp022: 'outputs/derived/sp022_pairwise_range_v2_20260816.json',
  sp043: 'outputs/derived/sp043_veteran_case_studies_v2_20260816.json',
  sp074: 'outputs/derived/sp074_conflict_diagnosis_v2_20260816.json',
  sp075: 'outputs/derived/sp075_stale_conflict_rediagnosis_v4_20260816.json',
  qa: 'outputs/derived/opus_speed_owner_blockers_wave_20260816_qa.json',
  audit: 'docs/audits/opus_speed_owner_blockers_wave_20260816.md',
};

const sourceHashes = {};
const qaChecks = [];
const full = rel => path.join(ROOT, rel);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const norm = value => String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const round = (value, places = 6) => Number(Number(value).toFixed(places));
const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const unique = values => [...new Set(values.filter(value => value != null && value !== ''))];
const countBy = (rows, key) => rows.reduce((out, row) => {
  const k = key(row);
  out[k] = (out[k] || 0) + 1;
  return out;
}, {});

function fail(message) {
  throw new Error(message);
}

function check(label, condition, detail = null) {
  const pass = Boolean(condition);
  qaChecks.push({ label, pass, detail });
  if (!pass) fail('QA failed: ' + label + (detail ? ' :: ' + detail : ''));
}

function requireObject(value, label) {
  check(label + ' is an object', value != null && typeof value === 'object' && !Array.isArray(value));
  return value;
}

function requireArray(value, label) {
  check(label + ' is an array', Array.isArray(value));
  return value;
}

function requireFields(value, fields, label) {
  requireObject(value, label);
  for (const field of fields) check(label + ' has field ' + field, Object.hasOwn(value, field));
  return value;
}

function readBuffer(rel) {
  const abs = full(rel);
  check('input exists: ' + rel, fs.existsSync(abs));
  const bytes = fs.readFileSync(abs);
  sourceHashes[rel] = sha256(bytes);
  return bytes;
}

function readText(rel) {
  return readBuffer(rel).toString('utf8');
}

function readJson(rel) {
  try {
    return JSON.parse(readText(rel));
  } catch (error) {
    fail('invalid JSON input ' + rel + ': ' + error.message);
  }
}

function readJsonl(rel) {
  const text = readText(rel);
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      fail('invalid JSONL input ' + rel + ':' + (index + 1) + ': ' + error.message);
    }
  }
  return rows;
}

function parseTsv(rel) {
  const raw = readText(rel).replace(/^\uFEFF/, '').trimEnd();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  check(rel + ' has header and rows', lines.length >= 2);
  const header = lines.shift().split('\t');
  const rows = lines.map((line, index) => {
    const cells = line.split('\t');
    check(rel + ':' + (index + 2) + ' has expected TSV columns', cells.length === header.length);
    return Object.fromEntries(header.map((key, column) => [key, cells[column]]));
  });
  return { header, rows };
}

function serializeTsv(parsed) {
  return [parsed.header.join('\t'), ...parsed.rows.map(row => parsed.header.map(key => String(row[key] ?? '')).join('\t'))].join('\n') + '\n';
}

function pickHashes(paths) {
  return Object.fromEntries(paths.map(rel => {
    check('source hash is registered: ' + rel, Boolean(sourceHashes[rel]));
    return [rel, sourceHashes[rel]];
  }));
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  check('quantile has observations', sorted.length > 0);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function normalCdf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function atomicWrite(rel, body) {
  const target = full(rel);
  const temp = target + '.tmp-' + process.pid;
  fs.writeFileSync(temp, body, 'utf8');
  fs.renameSync(temp, target);
}

function jsonBody(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function eventSet(rows) {
  return unique(rows.map(row => row.source_event_key || row.origin_key || row.record_id));
}

function rowCounts(rows) {
  return { row_count: rows.length, unique_source_events: eventSet(rows).length };
}

// Inputs are deliberately loaded before any output is written. A missing/renamed field
// therefore stops the wave without publishing a partial decision package.
const genericSweep = readJson(R.genericSweep);
const legacyReclassified = readJsonl(R.legacyGeneric);
const terraCanonical = readJsonl(R.terraCanonical);
const terraQa = readJson(R.terraQa);
const cleanX = readJsonl(R.cleanX);
const xHistory = readJsonl(R.xHistory);
const xExcludedProspi = readJsonl(R.xExcludedProspi);
const xQa = readJson(R.xQa);
const sp100 = readJson(R.sp100);
const sp042 = readJson(R.sp042);
const oldSp075 = readJson(R.oldSp075);
const physicalBank = readJson(R.physical);
const videoBank = readJson(R.video);
readBuffer(R.db);
const registry = parseTsv(R.registry);
const exclusions = parseTsv(R.exclusions);

requireFields(genericSweep, ['counts', 'origins', 'rows'], 'SP-036 source artifact');
requireFields(genericSweep.counts, ['outside_150_ledger_rows', 'origins', 'rows_usable_as_player_evidence', 'zeroed'], 'SP-036 source counts');
requireArray(genericSweep.origins, 'SP-036 source origins');
requireArray(genericSweep.rows, 'SP-036 source rows');
requireFields(terraQa, ['verdict', 'checks'], 'Terra semantic QA');
check('Terra semantic QA passes', terraQa.verdict === 'PASS');
requireFields(xQa, ['verdict', 'active_counts', 'machine_checks'], 'owner-filtered X QA');
check('owner-filtered X QA passes', xQa.verdict === 'PASS');
requireFields(sp100, ['players', 'compare', 'coverage', 'policy'], 'SP-100 wiring');
requireArray(sp100.players, 'SP-100 players');
check('SP-100 contains 100 review players', sp100.players.length === 100);
check('SP-100 attests no individual PowerPro weight', sp100.policy.no_powerpro_individual_weight === true);
check('SP-100 attests no next-year repeatability input', sp100.policy.no_next_year_repeatability === true);
requireFields(sp042, ['rows', 'flag_counts'], 'SP-042 stale detector');
requireArray(sp042.rows, 'SP-042 stale rows');
requireFields(oldSp075, ['players', 'community_effects', 'source_hashes'], 'old SP-075 baseline');
requireArray(oldSp075.players, 'old SP-075 players');
check('old SP-075 has 100 players', oldSp075.players.length === 100);
requireFields(physicalBank, ['records'], 'normalized physical evidence bank');
requireArray(physicalBank.records, 'normalized physical evidence records');
requireFields(videoBank, ['source_records'], 'video tiebreak source bank');
requireArray(videoBank.source_records, 'video tiebreak source records');

for (const row of cleanX) requireFields(row, [
  'record_id', 'player_id', 'player_name', 'current_100', 'claim_lane',
  'canonical_status', 'owner_disposition', 'owner_filter_date', 'source_product',
], 'owner-filtered X row');
for (const row of xExcludedProspi) requireFields(row, [
  'record_id', 'player_name', 'current_100', 'source_product', 'owner_disposition',
], 'excluded X Prospi row');
check('excluded X file retains its explicit Prospi-all exclusion disposition',
  xExcludedProspi.every(row => row.owner_disposition === 'EXCLUDED_PROSPI_ALL'));
for (const row of terraCanonical) requireFields(row, [
  'record_id', 'platform', 'source_product', 'player_name', 'player_id', 'current_100',
  'identity_status', 'claim_lane', 'canonical_status', 'source_url',
], 'Terra canonical row');
for (const player of sp100.players) requireFields(player, [
  'player', 'S_stat_z', 'S_reliability', 'pa_2025',
  'N_npb_top_speed_z', 'N_exposure_runs', 'npb_2026_only',
], 'SP-100 player');

const population = sp100.players.map(player => ({ ...player, player_key: norm(player.player) }));
check('SP-100 player names are unique after normalization', new Set(population.map(player => player.player_key)).size === 100);
const populationByKey = new Map(population.map(player => [player.player_key, player]));
const oldByKey = new Map(oldSp075.players.map(player => [norm(player.player), player]));
const staleByKey = new Map(sp042.rows.map(row => [norm(row.player), row]));
const terraByPlayer = new Map();
for (const row of terraCanonical) {
  const key = norm(row.player_name);
  if (!key) continue;
  if (!terraByPlayer.has(key)) terraByPlayer.set(key, []);
  terraByPlayer.get(key).push(row);
}

// ---------------------------------------------------------------------------
// SP-036: bounded generic-label re-judgment
// ---------------------------------------------------------------------------
const legacyGeneric = legacyReclassified.filter(row => {
  const labels = Array.isArray(row.labels) ? row.labels : [];
  return labels.some(label => label === 'GENERIC_FAST' || label === 'GENERIC_SLOW');
});
for (const row of legacyGeneric) requireFields(row, [
  'record_id', 'player', 'source_url', 'text', 'bucket', 'labels',
  'independence', 'origin_count', 'reaction_volume',
], 'legacy generic-label row');
const legacyOrigins = legacyGeneric.filter(row => row.independence === 'ORIGIN' || Number(row.origin_count) > 0);

const normalizeUrl = value => String(value ?? '').trim().replace(/\/$/, '');
const terraUrls = new Set(terraCanonical.map(row => normalizeUrl(row.source_url)).filter(Boolean));
const cleanXUrls = new Set(cleanX.map(row => normalizeUrl(row.source_url)).filter(Boolean));
const classifyGeneric = row => {
  const text = String(row.text ?? row.text_or_excerpt ?? '');
  if (row.likely_not_player_observation) return 'TECHNIQUE_GAMEPLAY_OR_NOISE';
  if (/(能力値|査定|パワプロ|rating)/i.test(text)) return 'RATING_CONTEXT';
  if (row.usable_as_player_evidence || String(row.player ?? '').trim()) return 'GENERIC_PHYSICAL_CONTEXT';
  return 'UNATTRIBUTED_OR_AMBIGUOUS_CONTEXT';
};
const outsideRows = genericSweep.rows.map(row => ({
  record_id: row.record_id,
  origin_id: row.origin_id,
  source: row.source,
  player: String(row.player ?? '').trim() || null,
  category: classifyGeneric(row),
  usable_as_player_evidence: Boolean(row.usable_as_player_evidence),
  likely_not_player_observation: Boolean(row.likely_not_player_observation),
  zeroed: Boolean(row.zeroed),
  source_url: row.source_url || null,
}));
const outsideOrigins = genericSweep.origins.map(origin => ({
  origin_id: origin.origin_id,
  player: String(origin.player ?? '').trim() || null,
  category: classifyGeneric(origin),
  usable_as_player_evidence: Boolean(origin.usable_as_player_evidence),
  likely_not_player_observation: Boolean(origin.likely_not_player_observation),
  row_count: origin.rows,
}));
const activeLineage = {
  legacy_generic_rows: legacyGeneric.length,
  legacy_generic_origins: legacyOrigins.length,
  exact_url_matches_in_final_terra: legacyGeneric.filter(row => terraUrls.has(normalizeUrl(row.source_url))).length,
  exact_url_matches_in_owner_filtered_x: legacyGeneric.filter(row => cleanXUrls.has(normalizeUrl(row.source_url))).length,
};
activeLineage.total_deterministic_active_matches =
  activeLineage.exact_url_matches_in_final_terra + activeLineage.exact_url_matches_in_owner_filtered_x;
const broadClaimState = activeLineage.total_deterministic_active_matches === 0
  ? 'NOT_IDENTIFIABLE_FOR_BROAD_LEGACY_POPULATION_NO_DETERMINISTIC_ACTIVE_LINEAGE'
  : 'REQUIRES_ROW_LEVEL_ACTIVE_LINEAGE_REVIEW';
const usableOutsideOrigins = outsideOrigins.filter(origin => origin.usable_as_player_evidence);

check('SP-036 source retains every outside-ledger row', outsideRows.length === genericSweep.counts.outside_150_ledger_rows);
check('SP-036 source retains every outside-ledger origin', outsideOrigins.length === genericSweep.counts.origins);
check('SP-036 no outside-ledger row was zeroed', outsideRows.every(row => row.zeroed === false));
check('SP-036 usable player evidence count derives from origins', usableOutsideOrigins.length === genericSweep.counts.origins_usable_as_player_evidence);
check('SP-036 only one usable outside-ledger player origin exists', usableOutsideOrigins.length === 1);

const sp036 = {
  schema_version: 'sp036_generic_label_decision_v2_20260816',
  generated_at: DATE,
  task_id: 'SP-036',
  status: 'DONE_NEGATIVE_FINDING',
  evidence_status: 'MEASURED_NEGATIVE',
  exact_tested_question: 'Within the seven-row outside-150 generic-label rescue, does retained weak generic fast/slow context demonstrate systematic current player-level speed decision value under the owner-filtered active policy?',
  source_hashes: pickHashes([R.genericSweep, R.legacyGeneric, R.terraCanonical, R.terraQa, R.cleanX, R.xQa]),
  input_counts: {
    outside_150_rows: outsideRows.length,
    outside_150_origins: outsideOrigins.length,
    outside_150_usable_player_origins: usableOutsideOrigins.length,
    legacy_reclassified_generic_rows: legacyGeneric.length,
    legacy_reclassified_generic_origins: legacyOrigins.length,
  },
  population_separation: {
    outside_150_sweep: {
      role: 'bounded additional rescue directly tested here',
      rows: outsideRows,
      origins: outsideOrigins,
    },
    legacy_reclassified_generic_labels: {
      role: 'retained historical weak context; not silently discarded or treated as a current active vote',
      rows: legacyGeneric.map(row => ({
        record_id: row.record_id,
        player: row.player || null,
        bucket: row.bucket,
        labels: row.labels,
        independence: row.independence,
        origin_count: row.origin_count,
        reaction_volume: row.reaction_volume,
        category: classifyGeneric(row),
        source_url: row.source_url,
      })),
      active_lineage: activeLineage,
    },
  },
  role_policy: {
    generic_physical_context: 'context only; never a physical teacher or automatic player action',
    rating_context: 'rating-consensus context only; not physical truth',
    technique_gameplay_noise: 'retained for provenance but excluded from pure-speed interpretation',
    missing_or_unlinked_lineage: 'not negative evidence and not an active vote',
    powerpro_individual_label_as_physical_teacher: false,
    automatic_rating_change: false,
    automatic_stale_promotion: false,
  },
  original_mass_rejection_claim: {
    claim: 'Mass rejection of generic labels was too strict.',
    outside_150_rescue_result: 'UNSUPPORTED: one attributable usable origin cannot establish systematic decision value.',
    broad_legacy_population_result: broadClaimState,
    reason: 'The 67 legacy generic rows remain preserved, but the frozen final Terra and owner-filtered active layers provide no deterministic URL crosswalk for a broad active-policy conclusion.',
  },
  final_reason: 'The exact seven-row rescue was genuinely tested and did not demonstrate systematic decision value. Weak evidence remains contextual; the broader historical claim stays explicitly unidentifiable rather than being converted to a false negative or a forced positive.',
};

// ---------------------------------------------------------------------------
// SP-022: same-time, evidence-sensitive directed pairwise ranges
// ---------------------------------------------------------------------------
const comparablePopulation = population.filter(player => player.S_stat_z != null);
const maxPa = Math.max(...comparablePopulation.map(player => Number(player.pa_2025)));
check('SP-022 has current-year comparable players', comparablePopulation.length > 1);
check('SP-022 effective sample denominator is positive', maxPa > 0);
const PA_BASE_NOISE = 0.12;
const PA_QUALITY_RANGE = 0.85;

function makeProfile(player) {
  const hasStat = player.S_stat_z != null;
  if (!hasStat) {
    return {
      player: player.player,
      player_id: player.player_id ?? null,
      appraisal_year: 2025,
      state: 'MISSING_SAME_TIME_STATISTICAL_EVIDENCE',
      value_z: null,
      S_reliability: null,
      pa_2025: Number(player.pa_2025 ?? 0),
      effective_sample_fraction: null,
      quality: null,
      sigma: null,
      excluded_future_NPB_2026: true,
    };
  }
  check('SP-022 S_stat_z is numeric for ' + player.player, isNumber(player.S_stat_z));
  check('SP-022 S_reliability is numeric for ' + player.player, isNumber(player.S_reliability));
  check('SP-022 pa_2025 is finite for ' + player.player, isNumber(player.pa_2025));
  const sampleFraction = Math.max(0, Math.min(1, Math.log1p(Math.max(0, player.pa_2025)) / Math.log1p(maxPa)));
  const reliability = Math.max(0, Math.min(1, player.S_reliability));
  const quality = 0.65 * reliability + 0.35 * sampleFraction;
  const sigma = PA_BASE_NOISE + PA_QUALITY_RANGE * (1 - quality);
  return {
    player: player.player,
    player_id: player.player_id ?? null,
    appraisal_year: 2025,
    state: 'COMPARABLE_2025_STATISTICAL_PROXY',
    value_z: round(player.S_stat_z, 6),
    S_reliability: round(reliability, 6),
    pa_2025: player.pa_2025,
    effective_sample_fraction: round(sampleFraction, 6),
    quality: round(quality, 6),
    sigma: round(sigma, 6),
    excluded_future_NPB_2026: true,
  };
}

function validateProfile(profile) {
  requireFields(profile, ['player', 'appraisal_year', 'state', 'value_z', 'sigma'], 'pairwise profile');
  if (profile.state === 'COMPARABLE_2025_STATISTICAL_PROXY') {
    check('comparable profile has numeric value: ' + profile.player, isNumber(profile.value_z));
    check('comparable profile has positive sigma: ' + profile.player, isNumber(profile.sigma) && profile.sigma > 0);
  } else {
    check('missing profile preserves null numeric fields: ' + profile.player, profile.value_z == null && profile.sigma == null);
  }
  return profile;
}

const profiles = population.map(makeProfile);
profiles.forEach(validateProfile);
const profileByKey = new Map(profiles.map(profile => [norm(profile.player), profile]));

function directionalClass(probability) {
  if (probability >= 0.9) return 'CLEARLY_FASTER';
  if (probability >= 0.65) return 'LEAN_FASTER';
  if (probability <= 0.1) return 'CLEARLY_SLOWER';
  if (probability <= 0.35) return 'LEAN_SLOWER';
  return 'SIMILAR_BAND';
}

function compareProfiles(a, b) {
  validateProfile(a);
  validateProfile(b);
  if (a.state !== 'COMPARABLE_2025_STATISTICAL_PROXY' || b.state !== 'COMPARABLE_2025_STATISTICAL_PROXY') {
    return {
      player_a: a.player,
      player_b: b.player,
      appraisal_year: 2025,
      state: 'MISSING_EVIDENCE_NOT_COMPARABLE',
      directional_class: 'MISSING_EVIDENCE_NOT_COMPARABLE',
      p_a_faster_than_b: null,
      combined_sigma: null,
      missing_evidence: [
        ...(a.state === 'COMPARABLE_2025_STATISTICAL_PROXY' ? [] : [a.player]),
        ...(b.state === 'COMPARABLE_2025_STATISTICAL_PROXY' ? [] : [b.player]),
      ],
      a_profile: a,
      b_profile: b,
    };
  }
  const combinedSigma = Math.hypot(a.sigma, b.sigma);
  const probability = normalCdf((a.value_z - b.value_z) / combinedSigma);
  return {
    player_a: a.player,
    player_b: b.player,
    appraisal_year: 2025,
    state: 'COMPARABLE_2025_STATISTICAL_PROXY',
    directional_class: directionalClass(probability),
    p_a_faster_than_b: round(probability, 8),
    combined_sigma: round(combinedSigma, 8),
    a_interval_90_z: [round(a.value_z - 1.645 * a.sigma, 6), round(a.value_z + 1.645 * a.sigma, 6)],
    b_interval_90_z: [round(b.value_z - 1.645 * b.sigma, 6), round(b.value_z + 1.645 * b.sigma, 6)],
    missing_evidence: [],
    a_profile: a,
    b_profile: b,
  };
}

const directedPairs = [];
for (let i = 0; i < profiles.length; i += 1) {
  for (let j = i + 1; j < profiles.length; j += 1) {
    directedPairs.push(compareProfiles(profiles[i], profiles[j]));
    directedPairs.push(compareProfiles(profiles[j], profiles[i]));
  }
}
const pairByKey = new Map(directedPairs.map(pair => [norm(pair.player_a) + '\u0000' + norm(pair.player_b), pair]));
const comparablePairs = directedPairs.filter(pair => pair.state === 'COMPARABLE_2025_STATISTICAL_PROXY');
const missingPairs = directedPairs.filter(pair => pair.state === 'MISSING_EVIDENCE_NOT_COMPARABLE');
const pairClassCounts = countBy(directedPairs, pair => pair.directional_class);
const comparableSigmas = profiles.filter(profile => profile.sigma != null).map(profile => profile.sigma);
const floorHits = comparableSigmas.filter(sigma => Math.abs(sigma - PA_BASE_NOISE) < 1e-10).length;
const ceilingHits = comparableSigmas.filter(sigma => sigma >= PA_BASE_NOISE + PA_QUALITY_RANGE - 1e-10).length;

for (const pair of comparablePairs) {
  const reverse = pairByKey.get(norm(pair.player_b) + '\u0000' + norm(pair.player_a));
  check('SP-022 reverse pair exists: ' + pair.player_a + ' / ' + pair.player_b, Boolean(reverse));
  check('SP-022 reverse probability symmetry: ' + pair.player_a + ' / ' + pair.player_b,
    Math.abs(pair.p_a_faster_than_b + reverse.p_a_faster_than_b - 1) < 0.000001);
  check('SP-022 reverse sigma symmetry: ' + pair.player_a + ' / ' + pair.player_b,
    Math.abs(pair.combined_sigma - reverse.combined_sigma) < 0.000001);
}

function degradedProfile(profile) {
  if (profile.state !== 'COMPARABLE_2025_STATISTICAL_PROXY') return profile;
  const reliability = Math.max(0, profile.S_reliability * 0.5);
  const pa = Math.max(0, Math.floor(profile.pa_2025 * 0.25));
  const sampleFraction = Math.max(0, Math.min(1, Math.log1p(pa) / Math.log1p(maxPa)));
  const quality = 0.65 * reliability + 0.35 * sampleFraction;
  const sigma = PA_BASE_NOISE + PA_QUALITY_RANGE * (1 - quality);
  if (sigma <= profile.sigma + 1e-10) {
    return {
      ...profile,
      state: 'MISSING_SAME_TIME_STATISTICAL_EVIDENCE',
      value_z: null,
      sigma: null,
      degradation: 'SOURCE_REMOVED_BECAUSE_QUALITY_CANNOT_DECREASE_FURTHER',
    };
  }
  return {
    ...profile,
    S_reliability: round(reliability, 6),
    pa_2025: pa,
    effective_sample_fraction: round(sampleFraction, 6),
    quality: round(quality, 6),
    sigma: round(sigma, 6),
    degradation: 'RELIABILITY_AND_EFFECTIVE_SAMPLE_REDUCED',
  };
}

const perturbations = [];
const referenceProfile = profiles.find(profile => profile.state === 'COMPARABLE_2025_STATISTICAL_PROXY');
for (const profile of profiles.filter(profile => profile.state === 'COMPARABLE_2025_STATISTICAL_PROXY' && profile.player !== referenceProfile.player)) {
  const before = compareProfiles(profile, referenceProfile);
  const degraded = degradedProfile(profile);
  const after = compareProfiles(degraded, referenceProfile);
  const beforeCertainty = Math.abs(before.p_a_faster_than_b - 0.5);
  const afterCertainty = after.p_a_faster_than_b == null ? 0 : Math.abs(after.p_a_faster_than_b - 0.5);
  const pass = afterCertainty <= beforeCertainty + 0.000001;
  perturbations.push({
    player: profile.player,
    before_sigma: profile.sigma,
    after_sigma: degraded.sigma,
    before_certainty: round(beforeCertainty, 8),
    after_certainty: round(afterCertainty, 8),
    result: after.state,
    pass,
  });
  check('SP-022 degradation does not increase certainty: ' + profile.player, pass);
}

let malformedRejected = false;
try {
  validateProfile({
    player: 'malformed fixture',
    appraisal_year: 2025,
    state: 'COMPARABLE_2025_STATISTICAL_PROXY',
    value_z: 0,
    sigma: -0.1,
  });
} catch {
  malformedRejected = true;
}
check('SP-022 malformed negative-sigma fixture is rejected', malformedRejected);
const missingFixture = compareProfiles(
  { player: 'missing fixture', appraisal_year: 2025, state: 'MISSING_SAME_TIME_STATISTICAL_EVIDENCE', value_z: null, sigma: null },
  referenceProfile,
);
check('SP-022 missing-evidence fixture remains non-comparable', missingFixture.directional_class === 'MISSING_EVIDENCE_NOT_COMPARABLE' && missingFixture.p_a_faster_than_b == null);
check('SP-022 uncertainty floor does not dominate', floorHits < Math.ceil(comparableSigmas.length * 0.2));
check('SP-022 pair direction has symmetric clear classes', pairClassCounts.CLEARLY_FASTER === pairClassCounts.CLEARLY_SLOWER);
check('SP-022 pair direction has symmetric lean classes', pairClassCounts.LEAN_FASTER === pairClassCounts.LEAN_SLOWER);

const sp022 = {
  schema_version: 'sp022_pairwise_range_v2_20260816',
  generated_at: DATE,
  task_id: 'SP-022',
  status: 'DONE_VALIDATED',
  evidence_status: 'MEASURED_BOUNDED',
  source_hashes: pickHashes([R.sp100]),
  appraisal_scope: {
    appraisal_year: 2025,
    included_source: 'S_stat_z current-year statistical/proxy context only',
    source_policy_attestation: {
      no_powerpro_individual_weight: sp100.policy.no_powerpro_individual_weight,
      no_next_year_repeatability: sp100.policy.no_next_year_repeatability,
    },
    excluded_sources: [
      '2026 NPB+ top-speed snapshot is temporally later and is not used for annual pairwise direction or uncertainty',
      'PowerPro individual labels are not present in the model',
      'next-year outcome, correlation, and RMSE are not used',
    ],
  },
  uncertainty_design: {
    formula: 'sigma = 0.12 + 0.85 * (1 - (0.65*S_reliability + 0.35*log(1+PA_2025)/log(1+max_PA_2025)))',
    base_same_time_proxy_noise: PA_BASE_NOISE,
    quality_range: PA_QUALITY_RANGE,
    rationale: 'S_reliability and current-year effective sample monotonically widen uncertainty when weaker; no hard uncertainty floor or ceiling is applied.',
    profile_distribution: {
      count: comparableSigmas.length,
      p05: round(quantile(comparableSigmas, 0.05), 6),
      p25: round(quantile(comparableSigmas, 0.25), 6),
      p50: round(quantile(comparableSigmas, 0.5), 6),
      p75: round(quantile(comparableSigmas, 0.75), 6),
      p95: round(quantile(comparableSigmas, 0.95), 6),
      floor_hit_count: floorHits,
      ceiling_hit_count: ceilingHits,
      unique_sigma_count: new Set(comparableSigmas.map(value => value.toFixed(6))).size,
    },
  },
  coverage: {
    population_players: profiles.length,
    comparable_players: profiles.filter(profile => profile.state === 'COMPARABLE_2025_STATISTICAL_PROXY').length,
    missing_same_time_players: profiles.filter(profile => profile.state !== 'COMPARABLE_2025_STATISTICAL_PROXY').map(profile => profile.player),
    directed_pair_count: directedPairs.length,
    comparable_directed_pair_count: comparablePairs.length,
    missing_evidence_directed_pair_count: missingPairs.length,
  },
  profiles,
  pairs: directedPairs,
  result_count_distribution: pairClassCounts,
  qa: {
    reverse_pair_symmetry: { tested_directed_pairs: comparablePairs.length, passed: true },
    perturbation: { tested_profiles: perturbations.length, rows: perturbations },
    missing_evidence_regression: { passed: true, fixture: missingFixture },
    malformed_fixture_rejected: malformedRejected,
    no_powerpro_individual_labels_as_physical_teacher: true,
    no_next_year_outcome_used: true,
  },
};

// ---------------------------------------------------------------------------
// SP-043: veteran evidence reconciliation, with empty peer set by design
// ---------------------------------------------------------------------------
const physicalByKey = new Map();
for (const record of physicalBank.records) {
  requireFields(record, [
    'raw_id', 'player', 'measurement_year', 'metric', 'value', 'unit',
    'canonicality', 'bank_acceptance_status', 'same_measurement_cluster_id',
  ], 'normalized physical record');
  const key = norm(record.player_key || record.player);
  if (!physicalByKey.has(key)) physicalByKey.set(key, []);
  physicalByKey.get(key).push(record);
}
const videoByKey = new Map();
for (const record of videoBank.source_records) {
  requireFields(record, ['record_id', 'player', 'season', 'accepted', 'physical_speed_relevance', 'rejection_reason'], 'video tiebreak record');
  const key = norm(record.player_key || record.player);
  if (!videoByKey.has(key)) videoByKey.set(key, []);
  videoByKey.get(key).push(record);
}

const db = new DatabaseSync(full(R.db), { readOnly: true });
function paHistory(name) {
  return db.prepare('SELECT season, pa, ab, g FROM v_batting WHERE name LIKE ? ORDER BY season').all('%' + name.replace(/\s/g, '%') + '%');
}
const lowPaCandidateUniverse = db.prepare(
  'SELECT name, pa, ab, g FROM v_batting WHERE season = 2025 AND pa > 0 AND pa <= 10 ORDER BY pa ASC, name ASC',
).all();

function physicalSummary(record) {
  return {
    raw_id: record.raw_id,
    measurement_date: record.measurement_date || null,
    measurement_year: record.measurement_year,
    metric: record.metric,
    value: record.value,
    unit: record.unit,
    evidence_class: record.evidence_class || null,
    canonicality: record.canonicality,
    acceptance: record.bank_acceptance_status,
    same_measurement_cluster_id: record.same_measurement_cluster_id,
    role: Number(record.measurement_year) >= 2025 ? 'CURRENT_DIRECT_OR_ORDINAL_CONTEXT' : 'HISTORICAL_DIRECT_CONTEXT',
    notes: record.notes || null,
  };
}

function buildVeteranCase(playerName) {
  const key = norm(playerName);
  const physicalAll = physicalByKey.get(key) || [];
  const canonicalPhysical = physicalAll.filter(record => record.canonicality === 'CANONICAL_SOURCE_RECORD');
  const currentDirect = canonicalPhysical.filter(record => Number(record.measurement_year) >= 2025).map(physicalSummary);
  const historicalDirect = canonicalPhysical.filter(record => Number(record.measurement_year) < 2025).map(physicalSummary);
  const duplicateClusterIds = canonicalPhysical.map(record => record.same_measurement_cluster_id);
  check('SP-043 canonical physical clusters are not duplicated for ' + playerName,
    new Set(duplicateClusterIds).size === duplicateClusterIds.length);
  const wiring = populationByKey.get(key) || null;
  const stale = staleByKey.get(key) || null;
  const videoRows = (videoByKey.get(key) || []).map(record => ({
    record_id: record.record_id,
    season: record.season,
    accepted: record.accepted,
    physical_speed_relevance: record.physical_speed_relevance,
    rejection_reason: record.rejection_reason,
  }));
  const xRows = cleanX.filter(row => norm(row.player_name) === key && row.current_100 && ACTIVE_X_DISPOSITIONS.has(row.owner_disposition));
  const communityRows = terraByPlayer.get(key) || [];
  const caseResult = {
    player: playerName,
    current_direct_physical: currentDirect,
    historical_direct_physical: historicalDirect,
    statistical_context: wiring ? {
      appraisal_year: 2025,
      S_stat_z: wiring.S_stat_z,
      S_reliability: wiring.S_reliability,
      pa_2025: wiring.pa_2025,
      future_2026_NPB_top_speed_context: {
        value_z: wiring.N_npb_top_speed_z,
        kmh: wiring.npb_plus_top_speed_kmh,
        exposure_runs: wiring.N_exposure_runs,
        reliability: wiring.N_reliability,
        role: 'TEMPORALLY_LATER_CONTEXT_NOT_ANNUAL_2025_TEACHER',
      },
    } : {
      state: 'NO_SP100_CURRENT_STATISTICAL_CONTEXT',
      role: 'MISSING_NOT_ZERO',
    },
    powerpro_stale_odd_context: stale ? {
      coverage: 'SP042_COVERED',
      flag: stale.flag,
      powerpro_pct: stale.powerpro_pct,
      latent_physical_pct: stale.latent_physical_pct,
      percentile_gap: stale.percentile_gap,
      role: 'STALE_ODD_CONTEXT_ONLY_NOT_PHYSICAL_EVIDENCE',
    } : {
      coverage: 'SP042_NOT_COVERED',
      role: 'MISSING_NOT_ZERO_NOT_PHYSICAL_EVIDENCE',
    },
    injury_aging_context: {
      pa_by_year: paHistory(playerName),
      injury_evidence_status: 'NOT_COLLECTED_IN_BOUNDED_INPUTS',
      age_or_low_PA_is_not_physical_decline_evidence: true,
      conclusion: 'No injury, aging, role, or PA-only narrative is converted into a speed decline verdict.',
    },
    video_context: {
      rows: videoRows,
      accepted_speed_records: videoRows.filter(row => row.accepted === true && row.physical_speed_relevance !== 'NOT_USABLE_WITHOUT_ISOLATED_STRAIGHT_SEGMENT').length,
      role: 'video rows remain context or rejected evidence at their stated scope',
    },
    community_context: {
      active_owner_filtered_x_rows: xRows.length,
      final_terra_rows_all_statuses: communityRows.length,
      active_physical_teacher: false,
    },
    missingness: {
      no_current_direct_speed_evidence: currentDirect.length === 0,
      no_current_statistical_context: !wiring || wiring.S_stat_z == null,
      no_stale_detector_coverage: !stale,
    },
    conclusion: null,
  };
  if (key === norm('松山 竜平')) {
    caseResult.conclusion = {
      state: 'NO_DIRECT_SPEED_EVIDENCE',
      physical_decline_verdict: 'NOT_IDENTIFIABLE',
      reason: 'No canonical direct speed record, no SP-100 current statistical context, and no SP-042 stale/odd coverage exist in the bounded inputs.',
    };
  } else {
    caseResult.conclusion = {
      state: currentDirect.length ? 'CURRENT_ORDINAL_CONTEXT_PRESENT' : 'NO_CURRENT_DIRECT_SPEED_EVIDENCE',
      physical_decline_verdict: 'NOT_IDENTIFIABLE',
      reason: 'Historical 2021 Statcast evidence and later 2026 NPB+ top-speed context are separated by time, construct, and sampling. Reduced PA is not treated as a decline measurement.',
    };
  }
  return caseResult;
}

const veteranCases = [buildVeteranCase('秋山 翔吾'), buildVeteranCase('松山 竜平')];
const akiyamaCase = veteranCases.find(row => norm(row.player) === norm('秋山 翔吾'));
const matsuyamaCase = veteranCases.find(row => norm(row.player) === norm('松山 竜平'));
check('SP-043 Matsuyama has no direct canonical speed evidence', matsuyamaCase.current_direct_physical.length === 0 && matsuyamaCase.historical_direct_physical.length === 0);
check('SP-043 Matsuyama conclusion states no direct speed evidence', matsuyamaCase.conclusion.state === 'NO_DIRECT_SPEED_EVIDENCE');
check('SP-043 Akiyama does not receive a physical decline verdict', akiyamaCase.conclusion.physical_decline_verdict === 'NOT_IDENTIFIABLE');
check('SP-043 no PowerPro context is counted as physical evidence',
  veteranCases.every(row => row.powerpro_stale_odd_context.role.includes('NOT_PHYSICAL_EVIDENCE')));

function validatePeerSet(peers, descriptor) {
  if (!Array.isArray(peers)) fail('peer set must be an array');
  if (descriptor == null || typeof descriptor !== 'object' || Array.isArray(descriptor)) fail('peer descriptor must be an object');
  if (peers.length > 0) {
    if (typeof descriptor.matching_rule !== 'string' || descriptor.matching_rule.length === 0) {
      fail('non-empty peer set requires an explicit matching rule');
    }
    if (!Array.isArray(descriptor.candidate_universe)) fail('non-empty peer set requires a candidate universe');
    if (descriptor.selection_method === 'FIRST_N') fail('non-empty peer set cannot use positional selection');
  }
}
const peerDescriptor = {
  candidate_universe: lowPaCandidateUniverse,
  candidate_universe_definition: 'All 2025 v_batting rows with 0 < PA <= 10, shown only as a descriptive low-current-sample universe.',
  matching_rule: null,
  selection_method: 'NO_PEERS_EMITTED',
  result: [],
  reason: 'The bounded inputs do not contain a predeclared joint age, injury/role mechanism, and same-time direct-speed construct needed to label another player a genuine veteran same-pattern peer. Low PA alone is not a same pattern.',
};
validatePeerSet(peerDescriptor.result, peerDescriptor);
let firstNFixtureRejected = false;
try {
  validatePeerSet([lowPaCandidateUniverse[0]], {
    candidate_universe: lowPaCandidateUniverse,
    matching_rule: null,
    selection_method: 'FIRST_N',
  });
} catch {
  firstNFixtureRejected = true;
}
check('SP-043 first-N low-PA peer fixture is rejected', firstNFixtureRejected);

const sp043 = {
  schema_version: 'sp043_veteran_case_studies_v2_20260816',
  generated_at: DATE,
  task_id: 'SP-043',
  status: 'DONE_VALIDATED',
  evidence_status: 'MEASURED_BOUNDED',
  exact_tested_question: 'What speed evidence at its relevant date exists for Akiyama, Matsuyama, and genuinely reproducible peers, without turning age, PA, PowerPro, or narrative context into a physical decline verdict?',
  source_hashes: pickHashes([R.physical, R.video, R.sp100, R.sp042, R.cleanX, R.terraCanonical, R.db]),
  case_studies: veteranCases,
  peer_rule: peerDescriptor,
  qa: {
    current_direct_and_historical_records_separated: true,
    duplicate_physical_cluster_guard: true,
    no_powerpro_as_physical_evidence: true,
    no_age_or_low_PA_decline_inference: true,
    first_N_peer_fixture_rejected: firstNFixtureRejected,
  },
  final_reason: 'The case-study reconciliation is complete and usable as owner context. It deliberately returns NOT_IDENTIFIABLE for a physical decline claim and NO_DIRECT_SPEED_EVIDENCE for Matsuyama rather than manufacturing either a verdict or false peers.',
};

// ---------------------------------------------------------------------------
// SP-074: evidence conflict diagnosis by time, construct, and missingness
// ---------------------------------------------------------------------------
function diagnoseEvidence(a, b) {
  if (!a || !b || a.value == null || b.value == null) {
    return {
      state: 'MISSING_EVIDENCE_NOT_CONFLICT',
      conflict_strength: 'NOT_IDENTIFIABLE',
      comparison_gap: null,
      directional_state: null,
    };
  }
  if (a.year !== b.year) {
    return {
      state: 'TEMPORALLY_CONFOUNDED',
      conflict_strength: 'NOT_IDENTIFIABLE',
      comparison_gap: null,
      directional_state: null,
      temporal_gap_years: Math.abs(a.year - b.year),
    };
  }
  if (a.construct !== b.construct) {
    return {
      state: 'DIFFERENT_CONSTRUCT_CONTEXT_ONLY',
      conflict_strength: 'NOT_IDENTIFIABLE',
      comparison_gap: null,
      directional_state: null,
    };
  }
  check('same-time diagnostic uncertainty a is positive', isNumber(a.uncertainty) && a.uncertainty > 0);
  check('same-time diagnostic uncertainty b is positive', isNumber(b.uncertainty) && b.uncertainty > 0);
  const gap = a.value - b.value;
  const combinedUncertainty = Math.hypot(a.uncertainty, b.uncertainty);
  const normalizedGap = Math.abs(gap) / combinedUncertainty;
  return {
    state: normalizedGap >= 2 ? 'SAME_TIME_DISAGREEMENT' : 'NO_MATERIAL_SAME_TIME_DISAGREEMENT',
    conflict_strength: normalizedGap >= 2 ? 'MATERIAL' : 'LOW',
    comparison_gap: round(gap, 6),
    normalized_gap: round(normalizedGap, 6),
    directional_state: gap > 0 ? 'A_HIGHER' : gap < 0 ? 'B_HIGHER' : 'EQUAL',
  };
}

const currentYearDirectRecords = physicalBank.records.filter(record =>
  record.canonicality === 'CANONICAL_SOURCE_RECORD'
  && Number(record.measurement_year) === 2025
  && populationByKey.has(norm(record.player_key || record.player)),
);
const physicalYears = countBy(
  physicalBank.records.filter(record => record.canonicality === 'CANONICAL_SOURCE_RECORD' && populationByKey.has(norm(record.player_key || record.player))),
  record => String(record.measurement_year),
);
const conflictRows = population.map(player => {
  const s = player.S_stat_z == null ? null : {
    source: 'SP100_2025_STATISTICAL_PROXY',
    year: 2025,
    construct: 'STATISTICAL_PROXY_SPEED',
    value: player.S_stat_z,
    uncertainty: 1 - Math.max(0, Math.min(1, player.S_reliability)),
    provenance: 'outputs/derived/sp100_wiring_candidates_20260814.json :: S_stat_z',
  };
  const n = player.N_npb_top_speed_z == null ? null : {
    source: 'SP100_2026_NPB_PLUS_TOP_SPEED',
    year: 2026,
    construct: 'MAX_SPEED_TRACKING',
    value: player.N_npb_top_speed_z,
    uncertainty: null,
    reliability_status: player.N_reliability == null ? 'NOT_IDENTIFIABLE' : 'AVAILABLE',
    provenance: 'outputs/derived/sp100_wiring_candidates_20260814.json :: N_npb_top_speed_z',
  };
  const diagnosis = diagnoseEvidence(s, n);
  return {
    player: player.player,
    player_id: player.player_id ?? null,
    sources: { statistical_proxy_2025: s, npb_plus_top_speed_2026: n },
    classification: diagnosis,
    same_time_conflict_score_withheld: diagnosis.state !== 'SAME_TIME_DISAGREEMENT' && diagnosis.state !== 'NO_MATERIAL_SAME_TIME_DISAGREEMENT',
  };
});
const conflictCounts = countBy(conflictRows, row => row.classification.state);

const largeFixture = diagnoseEvidence(
  { year: 2025, construct: 'TRACKED_MAX_SPEED_PERCENTILE', value: 0.95, uncertainty: 0.05 },
  { year: 2025, construct: 'TRACKED_MAX_SPEED_PERCENTILE', value: 0.05, uncertainty: 0.05 },
);
const smallFixture = diagnoseEvidence(
  { year: 2025, construct: 'TRACKED_MAX_SPEED_PERCENTILE', value: 0.55, uncertainty: 0.15 },
  { year: 2025, construct: 'TRACKED_MAX_SPEED_PERCENTILE', value: 0.50, uncertainty: 0.15 },
);
const constructFixture = diagnoseEvidence(
  { year: 2025, construct: 'TRACKED_MAX_SPEED_PERCENTILE', value: 0.95, uncertainty: 0.05 },
  { year: 2025, construct: 'STATISTICAL_PROXY_SPEED', value: 0.05, uncertainty: 0.05 },
);
const largeReverseFixture = diagnoseEvidence(
  { year: 2025, construct: 'TRACKED_MAX_SPEED_PERCENTILE', value: 0.05, uncertainty: 0.05 },
  { year: 2025, construct: 'TRACKED_MAX_SPEED_PERCENTILE', value: 0.95, uncertainty: 0.05 },
);
const missingFixture074 = diagnoseEvidence(
  null,
  { year: 2025, construct: 'TRACKED_MAX_SPEED_PERCENTILE', value: 0.50, uncertainty: 0.1 },
);
check('SP-074 actual same-time direct comparison inventory is empty', currentYearDirectRecords.length === 0);
check('SP-074 actual 2025-to-2026 comparisons are temporally confounded', conflictCounts.TEMPORALLY_CONFOUNDED === comparablePopulation.length);
check('SP-074 missing S source is not called conflict', conflictCounts.MISSING_EVIDENCE_NOT_CONFLICT === population.length - comparablePopulation.length);
check('SP-074 constructed large same-time disagreement fails', largeFixture.state === 'SAME_TIME_DISAGREEMENT');
check('SP-074 constructed small same-time disagreement passes', smallFixture.state === 'NO_MATERIAL_SAME_TIME_DISAGREEMENT');
check('SP-074 different construct fixture is contextual, not conflict', constructFixture.state === 'DIFFERENT_CONSTRUCT_CONTEXT_ONLY');
check('SP-074 order permutation preserves material magnitude',
  largeReverseFixture.state === largeFixture.state
  && Math.abs(largeReverseFixture.normalized_gap - largeFixture.normalized_gap) < 0.000001
  && largeReverseFixture.directional_state !== largeFixture.directional_state);
check('SP-074 missing-source fixture remains missing not conflict', missingFixture074.state === 'MISSING_EVIDENCE_NOT_CONFLICT');

const sp074 = {
  schema_version: 'sp074_conflict_diagnosis_v2_20260816',
  generated_at: DATE,
  task_id: 'SP-074',
  status: 'DONE_NEGATIVE_FINDING',
  evidence_status: 'MEASURED_NEGATIVE',
  exact_tested_question: 'Which project evidence pairs are genuine same-time disagreements, temporal bridge problems, different-construct context, or missing evidence?',
  source_hashes: pickHashes([R.sp100, R.physical]),
  source_provenance: {
    statistical_proxy: {
      year: 2025,
      construct: 'STATISTICAL_PROXY_SPEED',
      source: R.sp100,
      role: 'current-year proxy context; not a direct max-speed measurement',
    },
    npb_plus: {
      year: 2026,
      construct: 'MAX_SPEED_TRACKING',
      source: R.sp100,
      role: 'current maximum-speed snapshot only; generic reliability NOT_IDENTIFIABLE',
    },
    same_time_direct_comparison_availability: {
      canonical_2025_direct_records_for_current100: currentYearDirectRecords.map(record => record.raw_id),
      canonical_direct_records_by_year: physicalYears,
      result: currentYearDirectRecords.length === 0
        ? 'NO_TRUE_OR_EXPLICITLY_ALIGNABLE_SAME_TIME_DIRECT_COMPARISON_AVAILABLE'
        : 'AVAILABLE',
    },
  },
  diagnosis_policy: {
    same_time_disagreement: 'Requires equal year, equal construct, observed player-level values, and source-specific uncertainty.',
    different_time: 'TEMPORALLY_CONFOUNDED; conflict strength is NOT_IDENTIFIABLE rather than a score.',
    different_construct: 'DIFFERENT_CONSTRUCT_CONTEXT_ONLY; not automatically contradictory.',
    missing_evidence: 'MISSING_EVIDENCE_NOT_CONFLICT; missingness is not a negative finding.',
    standardized_mean_sd_checks_used: false,
  },
  players: conflictRows,
  classification_counts: conflictCounts,
  qa: {
    large_same_time_fixture: largeFixture,
    small_same_time_fixture: smallFixture,
    different_construct_fixture: constructFixture,
    permutation_fixture: { forward: largeFixture, reversed: largeReverseFixture },
    missing_source_fixture: missingFixture074,
    no_tautological_standardization_check: true,
  },
  final_reason: 'The tested current-100 inventory contains no true or explicitly alignable same-time independent direct comparison, so no actual conflict score is identifiable. The negative finding is bounded to that availability question; fixtures validate that a genuine same-time disagreement would still be detected without tautological standardization.',
};
const sp074ByKey = new Map(sp074.players.map(row => [norm(row.player), row]));

// ---------------------------------------------------------------------------
// SP-075: regenerate once after A-D are resolved in memory
// ---------------------------------------------------------------------------
const preliminaryBodies = {
  [O.sp036]: jsonBody(sp036),
  [O.sp022]: jsonBody(sp022),
  [O.sp043]: jsonBody(sp043),
  [O.sp074]: jsonBody(sp074),
};
const precursorHashes = Object.fromEntries(Object.entries(preliminaryBodies).map(([rel, body]) => [rel, sha256(body)]));

const activeX = cleanX.filter(row => row.current_100 === true && ACTIVE_X_DISPOSITIONS.has(row.owner_disposition));
check('SP-075 active X allowlist excludes Prospi', activeX.every(row => row.source_product !== 'Prospi' && row.source_product !== 'Pro Yakyuu Spirits'));
check('SP-075 active X row count matches cleaned policy', activeX.length === 28);
const terraYoutube = terraCanonical.filter(row => row.platform === 'YouTube');
const ytPowerPro = terraYoutube.filter(row =>
  row.current_100 === true
  && row.identity_status === 'RESOLVED'
  && row.source_product === 'PowerPro'
  && row.claim_lane === 'RATING_POWERPRO'
  && row.canonical_status === 'USABLE_RATING_CONTEXT',
);
const ytPhysical = terraYoutube.filter(row =>
  row.current_100 === true
  && row.identity_status === 'RESOLVED'
  && row.source_product !== 'Prospi'
  && row.claim_lane === 'PHYSICAL_OBSERVATION'
  && String(row.canonical_status).startsWith('USABLE_'),
);
const ytTechnique = terraYoutube.filter(row =>
  row.current_100 === true
  && row.identity_status === 'RESOLVED'
  && row.source_product !== 'Prospi'
  && ['BASERUNNING_TECHNIQUE', 'STEALING_TECHNIQUE', 'GAMEPLAY_MECHANICS'].includes(row.claim_lane)
  && !String(row.canonical_status).startsWith('EXCLUDED_'),
);
// This frozen, separately named input is the disposition-level Prospi-all
// exclusion ledger. Two legacy rows lack a product label, so filter on its
// explicit owner disposition rather than silently resurrecting them.
const excludedXProspi = xExcludedProspi.filter(row => row.current_100 === true);
const excludedYoutubeProspi = terraYoutube.filter(row => row.current_100 === true && row.source_product === 'Prospi');
check('SP-075 current100 YouTube PowerPro active rows are correctly zero', ytPowerPro.length === 0);
check('SP-075 excluded current100 X Prospi count is preserved', excludedXProspi.length === 73);
check('SP-075 excluded current100 YouTube Prospi count is preserved', excludedYoutubeProspi.length === 4);

function rowsForPlayer(rows, key) {
  return rows.filter(row => norm(row.player_name) === key);
}

function countChannel(rows) {
  return { ...rowCounts(rows), directional_rows: rows.filter(row => ['FASTER', 'SLOWER', 'EXPLICIT_PROPOSED_VALUE'].includes(row.direction)).length };
}

const sp043ByKey = new Map(sp043.case_studies.map(row => [norm(row.player), row]));
const genericByKey = new Map();
for (const row of legacyGeneric) {
  const key = norm(row.player);
  if (!key) continue;
  genericByKey.set(key, (genericByKey.get(key) || 0) + 1);
}
for (const row of usableOutsideOrigins) {
  const key = norm(row.player);
  if (!key) continue;
  genericByKey.set(key, (genericByKey.get(key) || 0) + 1);
}

const sp075Players = population.map(player => {
  const key = player.player_key;
  const xPowerPro = rowsForPlayer(activeX.filter(row => row.owner_disposition === 'CURRENT_POWERPRO_RATING'), key);
  const xPhysical = rowsForPlayer(activeX.filter(row => row.owner_disposition === 'CURRENT_REALWORLD_SPEED_PHYSICAL'), key);
  const xTechnique = rowsForPlayer(activeX.filter(row => row.owner_disposition === 'CURRENT_TECHNIQUE_CONTEXT'), key);
  const yPowerPro = rowsForPlayer(ytPowerPro, key);
  const yPhysical = rowsForPlayer(ytPhysical, key);
  const yTechnique = rowsForPlayer(ytTechnique, key);
  const xProspi = rowsForPlayer(excludedXProspi, key);
  const yProspi = rowsForPlayer(excludedYoutubeProspi, key);
  const activeRows = [...xPowerPro, ...xPhysical, ...xTechnique, ...yPowerPro, ...yPhysical, ...yTechnique];
  const old = oldByKey.get(key) || null;
  const conflict = sp074ByKey.get(key) || null;
  const profile = profileByKey.get(key) || null;
  const veteran = sp043ByKey.get(key) || null;
  const stale = staleByKey.get(key) || null;
  const oldCommunity = old && old.community_context ? old.community_context : {};
  return {
    player: player.player,
    player_id: player.player_id ?? old?.player_id ?? null,
    team: old?.team ?? null,
    stale_detector_coverage: Boolean(stale),
    stale_detector_state: stale ? {
      flag: stale.flag,
      latent_reliability_status: stale.latent_reliability_status,
      exposure_caveat: stale.exposure_caveat,
    } : { state: 'STALE_NOT_COVERED' },
    physical_reference_context: {
      statistical_proxy_2025: player.S_stat_z == null ? null : {
        value_z: player.S_stat_z,
        reliability: player.S_reliability,
        pa_2025: player.pa_2025,
      },
      npb_plus_top_speed_2026: {
        value_z: player.N_npb_top_speed_z,
        kmh: player.npb_plus_top_speed_kmh,
        exposure_runs: player.N_exposure_runs,
        reliability: player.N_reliability,
        temporal_status: 'LATER_THAN_2025_STATISTICAL_PROXY',
      },
    },
    source_counts: {
      x_powerpro_rating_context: countChannel(xPowerPro),
      x_realworld_physical_context: countChannel(xPhysical),
      x_technique_context: countChannel(xTechnique),
      youtube_powerpro_rating_context: countChannel(yPowerPro),
      youtube_realworld_physical_context: countChannel(yPhysical),
      youtube_technique_context: countChannel(yTechnique),
      excluded_x_prospi: countChannel(xProspi),
      excluded_youtube_prospi: countChannel(yProspi),
    },
    active_community_source_row_count: activeRows.length,
    active_community_source_event_count: eventSet(activeRows).length,
    community_effect: activeRows.length
      ? 'OWNER_REVIEW_CONTEXT_ONLY'
      : 'NO_MAPPED_ACTIVE_COMMUNITY_CONTEXT_NOT_NEGATIVE',
    conflict_diagnostic_state: conflict?.classification?.state || 'MISSING_EVIDENCE_NOT_CONFLICT',
    temporal_confounding: conflict?.classification?.state === 'TEMPORALLY_CONFOUNDED',
    wave_context: {
      sp036_generic_context_rows_preserved: genericByKey.get(key) || 0,
      sp036_broad_legacy_active_lineage: broadClaimState,
      sp022_pairwise_profile_state: profile?.state || 'MISSING_SAME_TIME_STATISTICAL_EVIDENCE',
      sp043_veteran_case: veteran?.conclusion || null,
      sp074_conflict_classification: conflict?.classification || null,
    },
    comparison_to_old_20260815: {
      old_usable_claim_count: oldCommunity.usable_claim_count ?? 0,
      old_prospi_context_count: oldCommunity.prospi_context_count ?? 0,
      old_powerpro_context_count: oldCommunity.powerpro_context_count ?? 0,
    },
    automatic_rating_change: false,
    automatic_stale_promotion: false,
    powerpro_label_not_used_as_physical_teacher: true,
    prospi_directional_consensus_weight: 0,
    prospi_stale_support_claims_used: 0,
  };
});

const newActiveSet = new Set(sp075Players.filter(row => row.active_community_source_row_count > 0).map(row => norm(row.player)));
const oldActiveSet = new Set(oldSp075.players
  .filter(row => (row.community_context?.usable_claim_count || 0) > 0)
  .map(row => norm(row.player)));
const retainedPlayers = [...newActiveSet].filter(key => oldActiveSet.has(key));
const removedPlayers = [...oldActiveSet].filter(key => !newActiveSet.has(key));
const addedPlayers = [...newActiveSet].filter(key => !oldActiveSet.has(key));
check('SP-075 clean owner-review Community player count is 18', newActiveSet.size === 18);
check('SP-075 old Community count is the stale 55 baseline', oldActiveSet.size === 55);
check('SP-075 old-to-new retained count is 17', retainedPlayers.length === 17);
check('SP-075 old-to-new removed count is 38', removedPlayers.length === 38);
check('SP-075 old-to-new added count is 1', addedPlayers.length === 1);
check('SP-075 active rows use no Prospi', sp075Players.every(row =>
  row.prospi_directional_consensus_weight === 0 && row.prospi_stale_support_claims_used === 0));
check('SP-075 automatic rating changes stay zero', sp075Players.every(row => row.automatic_rating_change === false));
check('SP-075 automatic stale promotions stay zero', sp075Players.every(row => row.automatic_stale_promotion === false));
check('SP-075 retains all 100 players', sp075Players.length === 100);

const changedPlayerSummary = sp075Players.filter(row => {
  const oldActive = row.comparison_to_old_20260815.old_usable_claim_count > 0;
  const newActive = row.active_community_source_row_count > 0;
  return oldActive !== newActive || row.comparison_to_old_20260815.old_prospi_context_count > 0;
}).map(row => ({
  player: row.player,
  old_active_context: row.comparison_to_old_20260815.old_usable_claim_count > 0,
  new_active_context: row.active_community_source_row_count > 0,
  old_prospi_context_count: row.comparison_to_old_20260815.old_prospi_context_count,
  excluded_x_prospi_rows: row.source_counts.excluded_x_prospi.row_count,
  excluded_youtube_prospi_rows: row.source_counts.excluded_youtube_prospi.row_count,
  change_type: (row.comparison_to_old_20260815.old_usable_claim_count > 0) === (row.active_community_source_row_count > 0)
    ? 'RETAINED_WITH_POLICY_CONTEXT_CHANGE'
    : row.active_community_source_row_count > 0 ? 'ADDED_UNDER_CLEAN_POLICY' : 'REMOVED_FROM_ACTIVE_CONTEXT',
}));

const sp075 = {
  schema_version: 'sp075_stale_conflict_rediagnosis_v4_20260816',
  generated_at: DATE,
  task_id: 'SP-075',
  status: 'DONE_VALIDATED',
  evidence_status: 'MEASURED_BOUNDED',
  source_hashes: {
    ...pickHashes([
      R.cleanX, R.xHistory, R.xExcludedProspi, R.xQa,
      R.terraCanonical, R.terraQa, R.sp042, R.sp100, R.oldSp075,
    ]),
    ...precursorHashes,
  },
  population: { expected_players: 100, joined_players: sp075Players.length },
  policy: {
    community_role: 'OWNER_REVIEW_CONTEXT_ONLY',
    x_active_dispositions: [...ACTIVE_X_DISPOSITIONS],
    terra_input_scope: 'YouTube rows only; Terra X rows are never used as active input after the owner-filtered X cleanup.',
    powerpro_individual_labels_as_physical_teacher: false,
    prospi_directional_consensus_weight: 0,
    prospi_stale_support_claims_used: 0,
    automatic_rating_changes: 0,
    automatic_stale_promotions: 0,
    missing_community_evidence_is_negative: false,
    historical_x_powerpro_rows_active: 0,
  },
  community_effects: {
    owner_review_context_players: newActiveSet.size,
    active_x_rows: activeX.length,
    active_youtube_powerpro_rows: ytPowerPro.length,
    active_youtube_physical_rows: ytPhysical.length,
    active_youtube_technique_rows: ytTechnique.length,
    excluded_x_prospi_rows_current100: excludedXProspi.length,
    excluded_youtube_prospi_rows_current100: excludedYoutubeProspi.length,
    player_level_speed_appraisal_changes: 0,
    stale_auto_promotion_count: 0,
  },
  old_vs_new_20260815: {
    old_owner_review_context_players: oldActiveSet.size,
    new_owner_review_context_players: newActiveSet.size,
    retained_player_count: retainedPlayers.length,
    removed_player_count: removedPlayers.length,
    added_player_count: addedPlayers.length,
    retained_players: retainedPlayers.map(key => populationByKey.get(key)?.player || key),
    removed_players: removedPlayers.map(key => oldByKey.get(key)?.player || key),
    added_players: addedPlayers.map(key => populationByKey.get(key)?.player || key),
    changed_player_context: changedPlayerSummary,
    old_artifact_status: 'SUPERSEDED_FOR_ACTIVE_COMMUNITY_COUNTS_ONLY',
  },
  repaired_owner_context: {
    sp036: { status: sp036.status, scope: 'bounded generic rescue negative finding; broad legacy active lineage remains not identifiable' },
    sp022: { status: sp022.status, scope: '2025 statistical proxy pairwise ranges only; no automatic score' },
    sp043: { status: sp043.status, scope: 'case-study evidence reconciliation; missingness preserved' },
    sp074: { status: sp074.status, scope: 'temporal and construct diagnostic states; no forced common conflict score' },
  },
  remaining_sp075_blockers: [],
  players: sp075Players,
};

// ---------------------------------------------------------------------------
// Registry and exclusion updates. Only SP-036, SP-022, SP-043, SP-074, SP-075
// and inseparable EX-011 / EX-013 are changed.
// ---------------------------------------------------------------------------
function patchTask(taskId, patch) {
  const row = registry.rows.find(candidate => candidate.task_id === taskId);
  check('registry task exists: ' + taskId, Boolean(row));
  Object.assign(row, patch);
}
const taskArtifacts = {
  'SP-036': [O.sp036, O.qa, O.audit],
  'SP-022': [O.sp022, O.qa, O.audit],
  'SP-043': [O.sp043, O.qa, O.audit],
  'SP-074': [O.sp074, O.qa, O.audit],
  'SP-075': [O.sp075, O.sp036, O.sp022, O.sp043, O.sp074, O.qa, O.audit, R.cleanX, R.xExcludedProspi, R.terraCanonical, R.sp042, R.sp100],
};
patchTask('SP-036', {
  status: 'DONE_NEGATIVE_FINDING',
  owner_review_block: '0',
  gate_block: '0',
  next_action_or_blocker: 'EVIDENCE_STATUS=MEASURED_NEGATIVE; the seven-row outside-150 generic-label rescue retained all weak rows but produced only one usable player origin, so it does not support systematic decision value. The broader 67-row legacy population remains NOT_IDENTIFIABLE for active policy because no deterministic lineage crosswalk exists; this is not negative evidence.',
  artifacts: taskArtifacts['SP-036'].join(';'),
});
patchTask('SP-022', {
  status: 'DONE_VALIDATED',
  owner_review_block: '0',
  gate_block: '0',
  next_action_or_blocker: 'EVIDENCE_STATUS=MEASURED_BOUNDED; 2025 statistical-proxy pairwise ranges now use reliability plus current PA, enumerate both directions, preserve missing evidence as non-comparable, and pass reverse symmetry, perturbation, and malformed-fixture QA. No future-year outcome or PowerPro label is used.',
  artifacts: taskArtifacts['SP-022'].join(';'),
});
patchTask('SP-043', {
  status: 'DONE_VALIDATED',
  owner_review_block: '0',
  gate_block: '0',
  next_action_or_blocker: 'EVIDENCE_STATUS=MEASURED_BOUNDED; veteran cases are rebuilt from dated direct, statistical, stale/odd, video, and missingness evidence. Akiyama decline is NOT_IDENTIFIABLE; Matsuyama is NO_DIRECT_SPEED_EVIDENCE. No age, PA, or PowerPro narrative becomes physical evidence, and no false peer set is emitted.',
  artifacts: taskArtifacts['SP-043'].join(';'),
});
patchTask('SP-074', {
  status: 'DONE_NEGATIVE_FINDING',
  owner_review_block: '0',
  gate_block: '0',
  next_action_or_blocker: 'EVIDENCE_STATUS=MEASURED_NEGATIVE; the bounded current-100 inventory has no true or explicitly alignable same-time independent direct comparison. The classifier separates temporal confounding, construct mismatch, and missingness without manufacturing a conflict score; substantive fixtures and regressions pass.',
  artifacts: taskArtifacts['SP-074'].join(';'),
});
const oldSp075Registry = registry.rows.find(row => row.task_id === 'SP-075');
const updatedDependencies = unique([
  ...String(oldSp075Registry.depends_on || '').split(',').map(value => value.trim()).filter(Boolean),
  'SP-022', 'SP-043', 'SP-074',
]);
patchTask('SP-075', {
  status: 'DONE_VALIDATED',
  owner_review_block: '0',
  gate_block: '0',
  depends_on: updatedDependencies.join(','),
  next_action_or_blocker: 'EVIDENCE_STATUS=MEASURED_BOUNDED; final 20260816 re-diagnosis uses only the owner-filtered X layer plus YouTube-only Terra rows. Active Community owner-review context is 18 players, not the stale 55. Prospi contributes zero directional consensus and zero stale support; automatic rating changes and stale promotions are 0/0. This closes SP-075 only, not SP-077 or the global Speed Gate.',
  artifacts: taskArtifacts['SP-075'].join(';'),
});

function patchExclusion(exclusionId, patch) {
  const row = exclusions.rows.find(candidate => candidate.exclusion_id === exclusionId);
  check('exclusion exists: ' + exclusionId, Boolean(row));
  Object.assign(row, patch);
}
patchExclusion('EX-011', {
  verdict: 'NOT_IDENTIFIABLE_PROVISIONAL_CURRENT_BEHAVIOR',
  corrected_policy: 'The bounded re-judgment preserves all legacy and additional generic records as contextual data. One attributable extra origin does not change a player automatically. Because frozen active layers have no deterministic bridge for the broader legacy set, a universal rejection-or-rescue rule is not declared.',
  evidence: unique([
    ...String(exclusions.rows.find(row => row.exclusion_id === 'EX-011').evidence).split(';'),
    O.sp036,
    O.audit,
  ]).join(';'),
});
patchExclusion('EX-013', {
  verdict: 'VALID_DOWNGRADE_NOT_ZERO',
  corrected_policy: 'Directed 2025 proxy comparisons now publish both orientations, derive uncertainty from observed reliability and effective current sample, and return an explicit non-comparable state for absent observations. The artifact is contextual and never supplies a physical teacher or automatic action.',
  evidence: unique([
    ...String(exclusions.rows.find(row => row.exclusion_id === 'EX-013').evidence).split(';'),
    O.sp022,
    O.audit,
  ]).join(';'),
});

const registryByTask = new Map(registry.rows.map(row => [row.task_id, row]));
for (const dependency of updatedDependencies) {
  const row = registryByTask.get(dependency);
  check('SP-075 dependency remains in registry: ' + dependency, Boolean(row));
  check('SP-075 dependency is closed: ' + dependency, CLOSED.has(row.status));
}
for (const taskId of ['SP-036', 'SP-022', 'SP-043', 'SP-074', 'SP-075']) {
  const row = registryByTask.get(taskId);
  check('updated registry status is closed: ' + taskId, CLOSED.has(row.status));
  check('updated registry points to dated artifact: ' + taskId, row.artifacts.includes(O[taskId.toLowerCase().replace('-', '')] || O.sp075) || row.artifacts.includes(O.audit));
}

const globalOwnerQueuePrerequisites = registry.rows
  .filter(row => row.task_id !== 'SP-075' && row.owner_review_block === '1' && !CLOSED.has(row.status))
  .map(row => ({ task_id: row.task_id, status: row.status, reason: row.next_action_or_blocker }));
sp075.out_of_scope_global_owner_queue_prerequisites = globalOwnerQueuePrerequisites;

const registryBody = serializeTsv(registry);
const exclusionsBody = serializeTsv(exclusions);
const audit = [
  '# OPUS speed owner-blocker closure wave',
  '',
  'Date: ' + DATE,
  '',
  '## Scope and collection boundary',
  '',
  'This wave reads frozen repository artifacts only. It performs no X, YouTube, Web, NPB-official, shoulder, SP-077, SP-078, SP-079, or global Speed Gate work. It leaves the production default unchanged.',
  '',
  '## SP-036 — weak generic SNS labels',
  '',
  '- Exact bounded question: whether the seven-row additional generic-label rescue proves systematic current player-level speed decision value.',
  '- The seven rows collapse to ' + outsideOrigins.length + ' origins; only ' + usableOutsideOrigins.length + ' is usable player context. All rows remain preserved and zeroed rows are 0.',
  '- Final result: DONE_NEGATIVE_FINDING for the bounded rescue. The broader ' + legacyGeneric.length + '-row historical generic population is ' + broadClaimState + ', not a negative finding.',
  '',
  '## SP-022 — pairwise/range appraisal',
  '',
  '- The repaired design uses only 2025 S statistical/proxy context. It excludes later 2026 NPB+ values, future-year outcomes, and PowerPro labels.',
  '- It enumerates ' + directedPairs.length + ' directed real-player pairs; ' + comparablePairs.length + ' are comparable and ' + missingPairs.length + ' preserve missing same-time evidence as non-comparable.',
  '- Sigma p05/p50/p95: ' + round(quantile(comparableSigmas, 0.05), 3) + ' / ' + round(quantile(comparableSigmas, 0.5), 3) + ' / ' + round(quantile(comparableSigmas, 0.95), 3) + '. Floor hits: ' + floorHits + '. Reverse-pair and degradation tests pass.',
  '',
  '## SP-043 — veteran case studies',
  '',
  '- Akiyama has dated historical and later ordinal context, but a physical decline verdict is NOT_IDENTIFIABLE.',
  '- Matsuyama has NO_DIRECT_SPEED_EVIDENCE in the bounded inputs. Low PA, age, and PowerPro context are not converted into a speed conclusion.',
  '- No same-pattern peer is emitted: the low-PA universe is descriptive only and is not a first-N proxy for a genuine matched mechanism.',
  '',
  '## SP-074 — conflict diagnosis',
  '',
  '- Current S is a 2025 statistical proxy and N is a 2026 NPB+ top-speed snapshot. ' + conflictCounts.TEMPORALLY_CONFOUNDED + ' rows are TEMPORALLY_CONFOUNDED and ' + conflictCounts.MISSING_EVIDENCE_NOT_CONFLICT + ' rows are missing-source, not conflicts.',
  '- No true or explicitly alignable 2025 same-time direct comparison exists in the frozen current-100 inventory. A large constructed same-time disagreement fixture fails; a small fixture passes; permutation and missing-source regressions pass.',
  '',
  '## SP-075 — final 20260816 refresh',
  '',
  '- New active owner-review Community count: ' + newActiveSet.size + ' players. The old active count ' + oldActiveSet.size + ' is retained only as a superseded comparison baseline.',
  '- Old to new: retained ' + retainedPlayers.length + ', removed ' + removedPlayers.length + ', added ' + addedPlayers.length + '.',
  '- Active X rows: ' + activeX.length + '. Active YouTube PowerPro rows: ' + ytPowerPro.length + '. Excluded Prospi rows for current100 reporting: X ' + excludedXProspi.length + ', YouTube ' + excludedYoutubeProspi.length + '.',
  '- Automatic rating changes / stale promotions: 0 / 0. Prospi directional consensus and automatic stale support: 0 / 0.',
  '- SP-075 has no remaining direct blocker after this wave. SP-077 and global Gate prerequisites remain out of scope and are not closed here.',
  '',
  '## Registry and QA',
  '',
  '- Updated task rows only: SP-036, SP-022, SP-043, SP-074, SP-075.',
  '- Updated inseparable exclusion rows only: EX-011, EX-013.',
  '- Internal machine gate completed before output writing. The separate QA script writes the compact final re-read result.',
  '',
  '## Artifacts',
  '',
  '- ' + O.sp036,
  '- ' + O.sp022,
  '- ' + O.sp043,
  '- ' + O.sp074,
  '- ' + O.sp075,
  '- ' + O.qa,
].join('\n');

const finalBodies = {
  ...preliminaryBodies,
  [O.sp075]: jsonBody(sp075),
  [O.audit]: audit + '\n',
  [R.registry]: registryBody,
  [R.exclusions]: exclusionsBody,
};
const outputHashes = Object.fromEntries(Object.entries(finalBodies).map(([rel, body]) => [rel, sha256(body)]));
const internalUnexpectedFailures = qaChecks.filter(checkResult => !checkResult.pass);
check('all internal non-fixture assertions pass', internalUnexpectedFailures.length === 0);
const qa = {
  schema_version: 'opus_speed_owner_blockers_wave_20260816_qa',
  generated_at: DATE,
  qa_type: 'builder_internal_gate',
  source_hashes: { ...sourceHashes, ...precursorHashes },
  generated_output_hashes: outputHashes,
  scope_guard: {
    no_network_or_collection_operations: true,
    no_shoulder_work: true,
    no_sp077_or_later_work: true,
    no_global_speed_gate_close: true,
    production_default_changed: false,
  },
  checks_run: qaChecks.length,
  failed_checks: internalUnexpectedFailures,
  verdict: 'PASS',
};
finalBodies[O.qa] = jsonBody(qa);

for (const [rel, body] of Object.entries(finalBodies)) atomicWrite(rel, body);
db.close();

console.log(JSON.stringify({
  ok: true,
  outputs: Object.keys(finalBodies),
  sp036_status: sp036.status,
  sp022_status: sp022.status,
  sp043_status: sp043.status,
  sp074_status: sp074.status,
  sp075_status: sp075.status,
  sp075_owner_review_context_players: newActiveSet.size,
  automatic_rating_changes: 0,
  automatic_stale_promotions: 0,
  qa_checks: qaChecks.length,
}, null, 2));

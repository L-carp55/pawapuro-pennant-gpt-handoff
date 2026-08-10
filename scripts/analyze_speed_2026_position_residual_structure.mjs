/**
 * Stage 2 V2 only: external PowerPro residual-structure analysis.
 *
 * This script reads the frozen Stage 1 profile and the pre-external-QA final
 * freeze. It never writes a rating input, a correction, or a Stage 1 file.
 * PowerPro is read only after the freeze and is used solely as an external
 * comparison target.
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DERIVED = path.join(ROOT, 'outputs', 'derived');

const PATHS = {
  blind: path.join(DERIVED, 'speed_blind_v3_npbplus_2026.json'),
  finalCsv: path.join(DERIVED, 'speed_2026_100_final_freeze_20260810.csv'),
  finalJson: path.join(DERIVED, 'speed_2026_100_final_freeze_20260810.json'),
  postFreezeQa: path.join(DERIVED, 'speed_2026_100_post_freeze_powerpro_qa_20260810.json'),
  stage1Profile: path.join(DERIVED, 'speed_2026_blind_physical_construct_profiles.json'),
  stage1Manifest: path.join(DERIVED, 'speed_2026_blind_physical_construct_freeze_manifest.json'),
  database: path.join(ROOT, 'data', 'pennant.db'),
  datasetCsv: path.join(DERIVED, 'speed_2026_powerpro_residual_structure_dataset.csv'),
  analysisJson: path.join(DERIVED, 'speed_2026_position_residual_analysis.json'),
  pairsCsv: path.join(DERIVED, 'speed_2026_position_matched_speed_pairs.csv'),
};

// Fixed seed and iteration counts make every inferential result reproducible.
const SEED = 20260810;
const BOOTSTRAP_ITERATIONS = 10_000;
const PERMUTATION_ITERATIONS = 10_000;
const CLUSTER_BOOTSTRAP_ITERATIONS = 5_000;
const STAGE1_V2_PROFILE_SHA256 = '18b44bf3cd3e929a86082ce9c5bab196380436b09a3e48a496f6ce5e2d05b53d';
const SPEED_THRESHOLDS = [0.1, 0.2, 0.3];
const AGE_BANDS = [
  { id: 'AGE_PLUS_MINUS_2', maxGap: 2 },
  { id: 'AGE_PLUS_MINUS_4', maxGap: 4 },
  { id: 'AGE_UNRESTRICTED', maxGap: null },
];

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const POSITION_MAP = Object.freeze({
  '捕': 'C', '一': '1B', '二': '2B', '三': '3B',
  '遊': 'SS', '左': 'LF', '中': 'CF', '右': 'RF',
});
const GROUPS = [
  { id: 'MIDDLE_PREMIUM', positions: ['SS', 'CF', 'RF'] },
  { id: 'MIDDLE_NEUTRAL', positions: ['2B'] },
  { id: 'CORNER_CATCHER', positions: ['C', '1B', '3B', 'LF'] },
];
const PAIR_COMPARISONS = [
  { id: 'MIDDLE_PREMIUM_MINUS_MIDDLE_NEUTRAL', left: 'MIDDLE_PREMIUM', right: 'MIDDLE_NEUTRAL' },
  { id: 'MIDDLE_PREMIUM_MINUS_CORNER_CATCHER', left: 'MIDDLE_PREMIUM', right: 'CORNER_CATCHER' },
  { id: 'MIDDLE_NEUTRAL_MINUS_CORNER_CATCHER', left: 'MIDDLE_NEUTRAL', right: 'CORNER_CATCHER' },
];

// These are orthographic normalizations, not fuzzy matching. The retained
// full player/team identity remains in every receipt. PowerPro's local roster
// display abbreviates given names, so a same-team label is resolved only when
// it is the unique exact canonical player-label prefix in the frozen roster.
const ORTHOGRAPHIC_NORMALIZATION = Object.freeze({
  '髙': '高', '﨑': '崎', '邊': '辺', '邉': '辺', '濵': '浜', '濱': '浜',
  '塚': '塚', '神': '神', '福': '福', '羽': '羽', '祥': '祥', '礼': '礼',
  '晴': '晴', '都': '都', '益': '益', '猪': '猪', '飯': '飯',
});

function canonicalName(value) {
  return [...String(value ?? '').normalize('NFKC').replaceAll(' ', '').replaceAll('　', '')]
    .map(char => ORTHOGRAPHIC_NORMALIZATION[char] ?? char)
    .join('');
}

function stableSeed(label) {
  let hash = (2166136261 ^ SEED) >>> 0;
  for (const char of label) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(sortedValues, probability) {
  if (!sortedValues.length) return null;
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}

function round(value, digits = 6) {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function signConsistency(values) {
  const positive = values.filter(value => value > 0).length;
  const negative = values.filter(value => value < 0).length;
  const zero = values.length - positive - negative;
  const direction = positive > negative ? 'POSITIVE' : negative > positive ? 'NEGATIVE' : 'TIED_OR_ZERO';
  return {
    n: values.length,
    positive,
    negative,
    zero,
    direction,
    dominant_sign_fraction: values.length ? round(Math.max(positive, negative) / values.length) : null,
    nonzero_direction_fraction: positive + negative ? round(Math.max(positive, negative) / (positive + negative)) : null,
  };
}

function bootstrapCi(values, statistic, iterations, label) {
  if (!values.length) return null;
  const rng = mulberry32(stableSeed(`bootstrap:${label}`));
  const results = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sample = [];
    for (let index = 0; index < values.length; index += 1) sample.push(values[Math.floor(rng() * values.length)]);
    results.push(statistic(sample));
  }
  results.sort((a, b) => a - b);
  return { lower: round(quantile(results, 0.025)), upper: round(quantile(results, 0.975)), iterations };
}

function hedgesG(groupValues, complementValues) {
  if (groupValues.length < 2 || complementValues.length < 2) return null;
  const groupMean = mean(groupValues);
  const complementMean = mean(complementValues);
  const groupVariance = groupValues.reduce((sum, value) => sum + (value - groupMean) ** 2, 0) / (groupValues.length - 1);
  const complementVariance = complementValues.reduce((sum, value) => sum + (value - complementMean) ** 2, 0) / (complementValues.length - 1);
  const degreesOfFreedom = groupValues.length + complementValues.length - 2;
  const pooledSd = Math.sqrt(((groupValues.length - 1) * groupVariance + (complementValues.length - 1) * complementVariance) / degreesOfFreedom);
  if (!Number.isFinite(pooledSd) || pooledSd === 0) return null;
  const cohenD = (groupMean - complementMean) / pooledSd;
  const correction = 1 - 3 / (4 * (groupValues.length + complementValues.length) - 9);
  return round(cohenD * correction);
}

function permutationTest(groupValues, complementValues, iterations, label) {
  if (!groupValues.length || !complementValues.length) return null;
  const all = [...groupValues, ...complementValues];
  const observed = mean(groupValues) - mean(complementValues);
  const groupN = groupValues.length;
  const rng = mulberry32(stableSeed(`permutation:${label}`));
  let asExtreme = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const shuffled = [...all];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    const difference = mean(shuffled.slice(0, groupN)) - mean(shuffled.slice(groupN));
    if (Math.abs(difference) >= Math.abs(observed) - 1e-12) asExtreme += 1;
  }
  return {
    observed_group_minus_complement: round(observed),
    two_sided_p_value: round((asExtreme + 1) / (iterations + 1)),
    iterations,
    null: 'exchangeable player residuals across this group and its complement',
  };
}

function summarizePositionResidual(groupRows, allPositionRows, residualKey, label) {
  const values = groupRows.map(row => row[residualKey]).filter(Number.isFinite);
  const groupIds = new Set(groupRows.map(row => row.player_id));
  const complementValues = allPositionRows
    .filter(row => !groupIds.has(row.player_id))
    .map(row => row[residualKey])
    .filter(Number.isFinite);
  return {
    n: values.length,
    mean: round(mean(values)),
    median: round(median(values)),
    bootstrap_mean_ci_95: bootstrapCi(values, mean, BOOTSTRAP_ITERATIONS, `${label}:mean`),
    bootstrap_median_ci_95: bootstrapCi(values, median, BOOTSTRAP_ITERATIONS, `${label}:median`),
    complement_n: complementValues.length,
    complement_mean: round(mean(complementValues)),
    group_minus_complement_mean: values.length && complementValues.length ? round(mean(values) - mean(complementValues)) : null,
    hedges_g_vs_complement: hedgesG(values, complementValues),
    permutation_test_vs_complement: permutationTest(values, complementValues, PERMUTATION_ITERATIONS, label),
    sign_consistency: signConsistency(values),
  };
}

function clusterBootstrapCi(pairs, metricKey, label) {
  if (!pairs.length) return null;
  const playerIds = [...new Set(pairs.flatMap(pair => [pair.left_player_id, pair.right_player_id]))];
  if (playerIds.length < 2) return null;
  const rng = mulberry32(stableSeed(`cluster-bootstrap:${label}`));
  const results = [];
  for (let iteration = 0; iteration < CLUSTER_BOOTSTRAP_ITERATIONS; iteration += 1) {
    const multiplicity = new Map();
    for (let draw = 0; draw < playerIds.length; draw += 1) {
      const id = playerIds[Math.floor(rng() * playerIds.length)];
      multiplicity.set(id, (multiplicity.get(id) ?? 0) + 1);
    }
    let numerator = 0;
    let denominator = 0;
    for (const pair of pairs) {
      const weight = (multiplicity.get(pair.left_player_id) ?? 0) * (multiplicity.get(pair.right_player_id) ?? 0);
      if (!weight) continue;
      numerator += weight * pair[metricKey];
      denominator += weight;
    }
    if (denominator) results.push(numerator / denominator);
  }
  if (!results.length) return null;
  results.sort((a, b) => a - b);
  return {
    lower: round(quantile(results, 0.025)),
    upper: round(quantile(results, 0.975)),
    iterations: CLUSTER_BOOTSTRAP_ITERATIONS,
    successful_replicates: results.length,
    resampling_unit: 'player; dyad weight is the product of endpoint multiplicities',
  };
}

function summarizePairMetric(pairs, key, label) {
  const values = pairs.map(pair => pair[key]).filter(Number.isFinite);
  return {
    n_pairs: values.length,
    mean_left_minus_right: round(mean(values)),
    median_left_minus_right: round(median(values)),
    sign_consistency: signConsistency(values),
    player_cluster_bootstrap_mean_ci_95: clusterBootstrapCi(pairs, key, label),
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const parseLine = line => {
    const values = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        values.push(current); current = '';
      } else current += char;
    }
    values.push(current);
    return values;
  };
  const header = parseLine(lines[0]);
  return lines.slice(1).filter(Boolean).map(line => {
    const values = parseLine(line);
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']));
  });
}

function csvText(rows, headers) {
  const quote = value => {
    if (value == null) return '';
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${headers.join(',')}\n${rows.map(row => headers.map(header => quote(row[header])).join(',')).join('\n')}\n`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function keyForPlayer(player, team) {
  return `${canonicalName(team)}\u0000${canonicalName(player)}`;
}

function uniqueMap(rows, keyFunction, sourceName) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFunction(row);
    if (map.has(key)) throw new Error(`${sourceName} has a duplicate canonical key: ${key}`);
    map.set(key, row);
  }
  return map;
}

function resolvedPosition(usageCandidates) {
  if (!usageCandidates.length) return { status: 'MISSING_NO_CURRENT_USAGE_ROW', raw: null, position: null, receipt: null };
  if (usageCandidates.length > 1) return { status: 'AMBIGUOUS_CURRENT_USAGE_NAME', raw: null, position: null, receipt: null };
  const usage = usageCandidates[0];
  const position = POSITION_MAP[usage.primary_pos] ?? null;
  return {
    status: position ? 'EXACT_NORMALIZED_NAME_UNIQUE_CURRENT_USAGE' : 'UNMAPPED_CURRENT_USAGE_POSITION',
    raw: usage.primary_pos,
    position,
    receipt: usage,
  };
}

function primaryGroup(position) {
  return GROUPS.find(group => group.positions.includes(position))?.id ?? null;
}

function buildPairs(rows) {
  const matchedPositionRows = rows.filter(row => row.powerpro_match_status === 'EXACT_CANONICAL_TEAM_MATCH' && row.position && Number.isFinite(row.residual_a) && Number.isFinite(row.residual_b));
  const byGroup = new Map(GROUPS.map(group => [group.id, matchedPositionRows.filter(row => row.position_group === group.id)]));
  const ageAvailable = matchedPositionRows.filter(row => Number.isFinite(row.age)).length;
  const allPairs = [];
  const analysis = [];

  for (const threshold of SPEED_THRESHOLDS) {
    for (const ageBand of AGE_BANDS) {
      for (const comparison of PAIR_COMPARISONS) {
        const leftRows = byGroup.get(comparison.left) ?? [];
        const rightRows = byGroup.get(comparison.right) ?? [];
        const speedMatched = [];
        const retained = [];
        for (const left of leftRows) {
          for (const right of rightRows) {
            const speedGap = Math.abs(left.npb_plus_sprint_speed_kmh - right.npb_plus_sprint_speed_kmh);
            if (speedGap > threshold + 1e-12) continue;
            speedMatched.push({ left, right, speedGap });
            const ageGap = Number.isFinite(left.age) && Number.isFinite(right.age) ? Math.abs(left.age - right.age) : null;
            if (ageBand.maxGap != null && (ageGap == null || ageGap > ageBand.maxGap)) continue;
            retained.push({ left, right, speedGap, ageGap });
          }
        }
        const status = ageBand.maxGap != null && ageAvailable === 0
          ? 'NOT_FEASIBLE_NO_FROZEN_AGE_FIELD'
          : retained.length ? 'ANALYZED' : 'NO_ELIGIBLE_PAIRS';
        const pairObjects = retained.map((pair, index) => ({
          pair_id: `${comparison.id}|${threshold.toFixed(1)}|${ageBand.id}|${String(index + 1).padStart(4, '0')}`,
          speed_threshold_kmh: threshold,
          age_band: ageBand.id,
          age_max_gap_years: ageBand.maxGap,
          group_comparison: comparison.id,
          left_player_id: pair.left.player_id,
          left_player: pair.left.player,
          left_team: pair.left.team,
          left_group: comparison.left,
          left_position: pair.left.position,
          left_age: pair.left.age,
          left_sprint_kmh: pair.left.npb_plus_sprint_speed_kmh,
          left_powerpro_2026: pair.left.powerpro_2026_speed,
          left_residual_a: pair.left.residual_a,
          left_residual_b: pair.left.residual_b,
          right_player_id: pair.right.player_id,
          right_player: pair.right.player,
          right_team: pair.right.team,
          right_group: comparison.right,
          right_position: pair.right.position,
          right_age: pair.right.age,
          right_sprint_kmh: pair.right.npb_plus_sprint_speed_kmh,
          right_powerpro_2026: pair.right.powerpro_2026_speed,
          right_residual_a: pair.right.residual_a,
          right_residual_b: pair.right.residual_b,
          sprint_speed_gap_kmh: round(pair.speedGap, 3),
          age_gap_years: pair.ageGap,
          powerpro_left_minus_right: pair.left.powerpro_2026_speed - pair.right.powerpro_2026_speed,
          residual_a_left_minus_right: pair.left.residual_a - pair.right.residual_a,
          residual_b_left_minus_right: pair.left.residual_b - pair.right.residual_b,
        }));
        allPairs.push(...pairObjects);
        analysis.push({
          speed_threshold_kmh: threshold,
          age_band: ageBand.id,
          age_max_gap_years: ageBand.maxGap,
          group_comparison: comparison.id,
          left_group_n: leftRows.length,
          right_group_n: rightRows.length,
          n_speed_matched_before_age_filter: speedMatched.length,
          n_pairs: pairObjects.length,
          unique_players_in_pairs: [...new Set(pairObjects.flatMap(pair => [pair.left_player_id, pair.right_player_id]))].length,
          status,
          residual_a: summarizePairMetric(pairObjects, 'residual_a_left_minus_right', `${comparison.id}|${threshold}|${ageBand.id}|A`),
          residual_b: summarizePairMetric(pairObjects, 'residual_b_left_minus_right', `${comparison.id}|${threshold}|${ageBand.id}|B`),
          powerpro: summarizePairMetric(pairObjects, 'powerpro_left_minus_right', `${comparison.id}|${threshold}|${ageBand.id}|P`),
        });
      }
    }
  }
  return { allPairs, analysis, matchedPositionRows, ageAvailable };
}

async function main() {
  const [blind, finalJson, postFreezeQa, stage1, manifest, finalCsvText] = await Promise.all([
    readJson(PATHS.blind),
    readJson(PATHS.finalJson),
    readJson(PATHS.postFreezeQa),
    readJson(PATHS.stage1Profile),
    readJson(PATHS.stage1Manifest),
    readFile(PATHS.finalCsv, 'utf8'),
  ]);
  const finalRows = parseCsv(finalCsvText);
  const finalByName = uniqueMap(finalRows, row => canonicalName(row.player), 'final freeze CSV');
  const blindById = uniqueMap(blind.players, row => String(row.player_id), 'blind-v3 input');
  const blindByNameTeam = uniqueMap(blind.players, row => keyForPlayer(row.name, row.team), 'blind-v3 input');
  const profiles = stage1.profiles;
  if (profiles.length !== 100) throw new Error(`Stage 1 profile coverage must be 100, found ${profiles.length}`);

  const db = new DatabaseSync(PATHS.database, { readOnly: true });
  const powerproRoster = db.prepare('SELECT rowid, work, team, name, name_norm, speed FROM pawapuro_full WHERE work = ?').all('2026');
  const usageRows = db.prepare('SELECT name, plate_appearances, games, primary_pos, primary_pos_pitches, pos_breakdown FROM npb_usage_2026').all();
  db.close();
  const usageByName = new Map();
  for (const usage of usageRows) {
    const key = canonicalName(usage.name);
    if (!usageByName.has(key)) usageByName.set(key, []);
    usageByName.get(key).push(usage);
  }

  const dataset = profiles.map(profile => {
    const final = finalByName.get(canonicalName(profile.player));
    if (!final) throw new Error(`Final freeze is missing Stage 1 player ${profile.player}`);
    const blindRow = blindById.get(String(profile.player_id)) ?? blindByNameTeam.get(keyForPlayer(profile.player, profile.team)) ?? null;
    const canonicalPlayer = canonicalName(profile.player);
    const canonicalTeam = canonicalName(profile.team);
    const powerproCandidates = powerproRoster.filter(candidate =>
      canonicalName(candidate.team) === canonicalTeam && canonicalPlayer.startsWith(canonicalName(candidate.name_norm || candidate.name))
    );
    const pawa = powerproCandidates.length === 1 ? powerproCandidates[0] : null;
    const powerproMatchStatus = pawa
      ? 'EXACT_CANONICAL_TEAM_MATCH'
      : powerproCandidates.length === 0 ? 'UNMATCHED_NO_UNIQUE_CANONICAL_ROSTER_LABEL' : 'AMBIGUOUS_CANONICAL_ROSTER_LABEL';
    const positionResolution = resolvedPosition(usageByName.get(canonicalPlayer) ?? []);
    const powerpro = pawa ? finiteNumber(pawa.speed) : null;
    const blindRaw = blindRow ? finiteNumber(blindRow.blind_rating) : null;
    const blindRounded = blindRaw == null ? null : Math.round(blindRaw);
    const finalRating = finiteNumber(final.final_rating);
    const row = {
      player_id: String(profile.player_id ?? ''),
      player: profile.player,
      player_canonical: canonicalPlayer,
      team: profile.team,
      team_canonical: canonicalTeam,
      stage1_profile_status: profile.stage,
      stage1_profile_present: true,
      npb_plus_sprint_speed_kmh: finiteNumber(profile.npb_plus_sprint_speed_kmh),
      blind_v3_match_status: blindRow ? 'EXACT_PLAYER_ID_OR_TEAM_NAME_MATCH' : 'MISSING_FROM_BLIND_V3_INPUT',
      blind_v3_baseline_raw: blindRaw,
      blind_v3_baseline_rounded: blindRounded,
      final_freeze_rating: finalRating,
      final_freeze_decision_class: final.decision_class || null,
      powerpro_match_status: powerproMatchStatus,
      powerpro_match_method: pawa ? 'SAME_TEAM_UNIQUE_CANONICAL_ROSTER_LABEL_RESOLUTION' : null,
      powerpro_candidate_count: powerproCandidates.length,
      powerpro_2026_roster_display_name: pawa?.name ?? null,
      powerpro_2026_roster_normalized_name: pawa?.name_norm ?? null,
      powerpro_2026_speed: powerpro,
      residual_a: blindRounded != null && powerpro != null ? blindRounded - powerpro : null,
      residual_b: finalRating != null && powerpro != null ? finalRating - powerpro : null,
      position_source: 'data/pennant.db::npb_usage_2026.primary_pos',
      position_match_status: positionResolution.status,
      position_raw_jp: positionResolution.raw,
      position: positionResolution.position,
      position_group: primaryGroup(positionResolution.position),
      current_usage_plate_appearances: positionResolution.receipt?.plate_appearances ?? null,
      current_usage_games: positionResolution.receipt?.games ?? null,
      current_usage_pos_breakdown: positionResolution.receipt?.pos_breakdown ?? null,
      age: null,
      age_status: 'MISSING_NO_FROZEN_AGE_FIELD',
      acceleration_class: profile.acceleration_top_speed_classification ?? null,
      exposure_pa: profile.exposure?.PA ?? null,
      exposure_games: profile.exposure?.games ?? null,
    };
    return row;
  });

  const unmatched = dataset.filter(row => row.powerpro_match_status !== 'EXACT_CANONICAL_TEAM_MATCH');
  if (unmatched.length !== 1 || unmatched[0].player !== '名原 典彦') {
    throw new Error(`Required 99/100 PowerPro boundary failed: ${unmatched.map(row => row.player).join(', ') || 'none'}`);
  }
  const matched = dataset.filter(row => row.powerpro_match_status === 'EXACT_CANONICAL_TEAM_MATCH');
  if (matched.length !== 99) throw new Error(`Expected 99 PowerPro matches, found ${matched.length}`);
  if (dataset.some(row => row.final_freeze_rating == null)) throw new Error('At least one final-freeze rating is missing.');

  const analyzablePositionRows = matched.filter(row => POSITIONS.includes(row.position) && Number.isFinite(row.residual_a) && Number.isFinite(row.residual_b));
  const exactPositionAnalysis = Object.fromEntries(POSITIONS.map(position => {
    const rows = analyzablePositionRows.filter(row => row.position === position);
    return [position, {
      positions: [position],
      players: rows.map(row => ({ player_id: row.player_id, player: row.player, team: row.team })),
      residual_a: summarizePositionResidual(rows, analyzablePositionRows, 'residual_a', `exact:${position}:A`),
      residual_b: summarizePositionResidual(rows, analyzablePositionRows, 'residual_b', `exact:${position}:B`),
    }];
  }));
  const predefinedGroupAnalysis = Object.fromEntries(GROUPS.map(group => {
    const rows = analyzablePositionRows.filter(row => group.positions.includes(row.position));
    return [group.id, {
      positions: group.positions,
      players: rows.map(row => ({ player_id: row.player_id, player: row.player, team: row.team, position: row.position })),
      residual_a: summarizePositionResidual(rows, analyzablePositionRows, 'residual_a', `group:${group.id}:A`),
      residual_b: summarizePositionResidual(rows, analyzablePositionRows, 'residual_b', `group:${group.id}:B`),
    }];
  }));
  const pairBuild = buildPairs(dataset);

  const [stage1ProfileHash, stage1ManifestHash, blindHash, finalCsvHash, finalJsonHash, postFreezeQaHash, databaseHash, databaseStats] = await Promise.all([
    sha256(PATHS.stage1Profile), sha256(PATHS.stage1Manifest), sha256(PATHS.blind), sha256(PATHS.finalCsv),
    sha256(PATHS.finalJson), sha256(PATHS.postFreezeQa), sha256(PATHS.database), stat(PATHS.database),
  ]);
  const manifestStage1ProfileHash = manifest.frozen_artifact_sha256?.['outputs/derived/speed_2026_blind_physical_construct_profiles.json'] ?? null;
  if (stage1ProfileHash !== STAGE1_V2_PROFILE_SHA256) {
    throw new Error(`Current Stage 1 V2 profile hash is not the approved freeze: ${stage1ProfileHash}`);
  }
  if (manifestStage1ProfileHash !== STAGE1_V2_PROFILE_SHA256) {
    throw new Error(`Stage 1 V2 manifest does not declare the approved freeze hash: ${manifestStage1ProfileHash}`);
  }

  const positionCounts = Object.fromEntries(POSITIONS.map(position => [position, analyzablePositionRows.filter(row => row.position === position).length]));
  const analysis = {
    schema_version: 'speed-2026-position-and-matched-residual-analysis/v2.0.0',
    stage: 'STAGE_2_EXTERNAL_RESIDUAL_DIAGNOSTIC_ONLY_V2',
    generated_at: new Date().toISOString(),
    status: 'COMPLETE_V2_NO_POSITION_CORRECTIONS_OR_RATING_CHANGES',
    supersession: {
      version: 'V2',
      supersedes: 'V1 Stage 2 position/matched-speed outputs',
      reason: 'Stage 1 temporal-boundary QA failure superseded the prior Stage 1 freeze.',
      v1_stage2_outputs_read_or_used: false,
      v2_stage1_profile_sha256: STAGE1_V2_PROFILE_SHA256,
    },
    analysis_contract: {
      residual_a: 'rounded blind-v3 baseline minus PowerPro 2026 Speed',
      residual_b: 'provisional final freeze minus PowerPro 2026 Speed',
      powerpro_role: 'read-only external comparator; never a rating teacher or correction target',
      matching: 'same team plus unique canonical local PowerPro roster-label resolution; no fuzzy matching and no forced match',
      required_unmatched_player: '名原 典彦',
      position_role: 'descriptive residual grouping only; position adjustments are prohibited',
      matched_speed_role: 'all predefined group contrasts, every requested speed threshold, and every requested age band are emitted; player-level clustered bootstrap addresses repeated-player dyads',
    },
    reproducibility: {
      seed: SEED,
      bootstrap_iterations: BOOTSTRAP_ITERATIONS,
      permutation_iterations: PERMUTATION_ITERATIONS,
      player_cluster_bootstrap_iterations: CLUSTER_BOOTSTRAP_ITERATIONS,
      statistic_precision_decimals: 6,
    },
    input_provenance: {
      historical_source_commits: {
        blind_v3_npb_plus_and_aggregate_powerpro_qa: '3be42ff62775cf98eec614f9ee733ae06d565bde',
        final_freeze_branch_base: '648f75670d4b97bccce1efeb3ebbab3a06068347',
        stage1_manifest_sources: manifest.source_commits,
      },
      files: {
        stage1_profile: { path: path.relative(ROOT, PATHS.stage1Profile), sha256: stage1ProfileHash, required_v2_sha256: STAGE1_V2_PROFILE_SHA256, manifest_declared_sha256: manifestStage1ProfileHash },
        stage1_manifest: { path: path.relative(ROOT, PATHS.stage1Manifest), sha256: stage1ManifestHash },
        blind_v3_npb_plus: { path: path.relative(ROOT, PATHS.blind), sha256: blindHash, player_rows: blind.players.length },
        final_freeze_csv: { path: path.relative(ROOT, PATHS.finalCsv), sha256: finalCsvHash, player_rows: finalRows.length },
        final_freeze_json: { path: path.relative(ROOT, PATHS.finalJson), sha256: finalJsonHash, source_decision_packet_commit: finalJson.source_decision_packet_commit },
        post_freeze_powerpro_qa: { path: path.relative(ROOT, PATHS.postFreezeQa), sha256: postFreezeQaHash, stated_powerpro_match_count: postFreezeQa.match?.matched_powerpro_2026 ?? null },
        powerpro_external_roster: { path: path.relative(ROOT, PATHS.database), table: 'pawapuro_full', work: '2026', sha256: databaseHash, bytes: databaseStats.size, roster_rows: powerproRoster.length },
        position_source: { path: path.relative(ROOT, PATHS.database), table: 'npb_usage_2026', rows: usageRows.length },
      },
      unavailable_aggregate_input_note: 'The historical speed_blind_v3_powerpro_qa_2026.json is an aggregate QA receipt at its stated source commit and is not needed for row-level residual construction. Row-level Residual A is reconstructed only from frozen blind-v3 values plus the external 2026 roster comparator.',
    },
    coverage: {
      stage1_profiles: profiles.length,
      final_freeze_rows: finalRows.length,
      blind_v3_rows: blind.players.length,
      dataset_rows: dataset.length,
      powerpro_exact_canonical_team_matches: matched.length,
      powerpro_unmatched: unmatched.map(row => ({ player: row.player, team: row.team, status: row.powerpro_match_status })),
      residual_a_usable: dataset.filter(row => Number.isFinite(row.residual_a)).length,
      residual_b_usable: dataset.filter(row => Number.isFinite(row.residual_b)).length,
      exact_position_usable: analyzablePositionRows.length,
      exact_position_counts: positionCounts,
      frozen_age_available: dataset.filter(row => Number.isFinite(row.age)).length,
      matched_speed_pair_rows: pairBuild.allPairs.length,
    },
    powerpro_exact_match_receipts: dataset.map(row => ({
      player_id: row.player_id,
      player: row.player,
      team: row.team,
      status: row.powerpro_match_status,
      method: row.powerpro_match_method,
      candidate_count: row.powerpro_candidate_count,
      external_roster_display_name: row.powerpro_2026_roster_display_name,
      external_speed: row.powerpro_2026_speed,
    })),
    position_analysis: {
      analysis_population: 'PowerPro exact canonical-team matches with a mapped current primary position and both residuals available',
      exact_positions: exactPositionAnalysis,
      predefined_groups: predefinedGroupAnalysis,
    },
    matched_speed_analysis: {
      group_comparisons: PAIR_COMPARISONS,
      speed_thresholds_kmh: SPEED_THRESHOLDS,
      age_bands: AGE_BANDS,
      age_data_status: pairBuild.ageAvailable === 0 ? 'NOT_FEASIBLE_FOR_PLUS_MINUS_2_OR_PLUS_MINUS_4_NO_FROZEN_AGE_FIELD' : 'AVAILABLE_FOR_REQUESTED_AGE_BANDS',
      player_dependence_control: 'node/cluster bootstrap of players; dyad means are recomputed using endpoint multiplicity-product weights',
      cells: pairBuild.analysis,
    },
    negative_findings_and_limits: [
      'All 99 available residual records have an exact canonical-team external comparison; 名原典彦 is retained as the only unmatched player rather than being force-matched.',
      'The frozen Stage 1 profile contains no age field. Therefore the plus/minus-2 and plus/minus-4 age analyses are explicitly emitted as not feasible; only age-unrestricted matched-speed analyses are estimable from permitted frozen inputs.',
      'PowerPro roster display names abbreviate several given names. Canonical identity resolution permits only a unique same-team display-label prefix of the frozen full player name; no edit distance, cross-team matching, or ambiguity resolution is used.',
      'Position is a current-usage descriptor from npb_usage_2026, not a rating input. Position-correlated residuals do not identify a causal source or justify a position correction.',
      'Matched-speed pair rows are not independent because players recur across dyads. Reported matched-speed uncertainty uses player-level clustered bootstrap rather than a naive pair bootstrap.',
      'No PowerPro value was used to set or revise the final freeze, and this script writes no production rating artifact.',
    ],
    validation: {
      required_99_of_100_boundary_passed: matched.length === 99 && unmatched.length === 1 && unmatched[0].player === '名原 典彦',
      stage1_profile_100_rows_passed: profiles.length === 100,
      stage1_profile_hash_matches_manifest: manifestStage1ProfileHash === STAGE1_V2_PROFILE_SHA256 && stage1ProfileHash === STAGE1_V2_PROFILE_SHA256,
      required_stage1_v2_profile_sha256_passed: stage1ProfileHash === STAGE1_V2_PROFILE_SHA256,
      final_freeze_100_rows_passed: finalRows.length === 100,
      residual_a_definition_passed: dataset.filter(row => row.residual_a != null).every(row => row.residual_a === row.blind_v3_baseline_rounded - row.powerpro_2026_speed),
      residual_b_definition_passed: dataset.filter(row => row.residual_b != null).every(row => row.residual_b === row.final_freeze_rating - row.powerpro_2026_speed),
      all_requested_position_levels_emitted: POSITIONS.every(position => Object.hasOwn(exactPositionAnalysis, position)) && GROUPS.every(group => Object.hasOwn(predefinedGroupAnalysis, group.id)),
      all_requested_matched_speed_cells_emitted: pairBuild.analysis.length === SPEED_THRESHOLDS.length * AGE_BANDS.length * PAIR_COMPARISONS.length,
      rating_changes_made: 0,
    },
  };

  const datasetHeaders = [
    'player_id', 'player', 'player_canonical', 'team', 'team_canonical', 'stage1_profile_status', 'stage1_profile_present',
    'npb_plus_sprint_speed_kmh', 'blind_v3_match_status', 'blind_v3_baseline_raw', 'blind_v3_baseline_rounded',
    'final_freeze_rating', 'final_freeze_decision_class', 'powerpro_match_status', 'powerpro_match_method',
    'powerpro_candidate_count', 'powerpro_2026_roster_display_name', 'powerpro_2026_roster_normalized_name', 'powerpro_2026_speed',
    'residual_a', 'residual_b', 'position_source', 'position_match_status', 'position_raw_jp', 'position', 'position_group',
    'current_usage_plate_appearances', 'current_usage_games', 'current_usage_pos_breakdown', 'age', 'age_status',
    'acceleration_class', 'exposure_pa', 'exposure_games',
  ];
  const pairHeaders = [
    'pair_id', 'speed_threshold_kmh', 'age_band', 'age_max_gap_years', 'group_comparison',
    'left_player_id', 'left_player', 'left_team', 'left_group', 'left_position', 'left_age', 'left_sprint_kmh', 'left_powerpro_2026', 'left_residual_a', 'left_residual_b',
    'right_player_id', 'right_player', 'right_team', 'right_group', 'right_position', 'right_age', 'right_sprint_kmh', 'right_powerpro_2026', 'right_residual_a', 'right_residual_b',
    'sprint_speed_gap_kmh', 'age_gap_years', 'powerpro_left_minus_right', 'residual_a_left_minus_right', 'residual_b_left_minus_right',
  ];
  await Promise.all([
    writeFile(PATHS.datasetCsv, csvText(dataset, datasetHeaders), 'utf8'),
    writeFile(PATHS.analysisJson, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8'),
    writeFile(PATHS.pairsCsv, csvText(pairBuild.allPairs, pairHeaders), 'utf8'),
  ]);

  console.log(JSON.stringify({
    status: analysis.status,
    dataset_rows: dataset.length,
    exact_powerpro_matches: matched.length,
    unmatched: unmatched.map(row => row.player),
    position_usable: analyzablePositionRows.length,
    age_available: pairBuild.ageAvailable,
    matched_pair_rows: pairBuild.allPairs.length,
    output_files: [
      path.relative(ROOT, PATHS.datasetCsv),
      path.relative(ROOT, PATHS.analysisJson),
      path.relative(ROOT, PATHS.pairsCsv),
    ],
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

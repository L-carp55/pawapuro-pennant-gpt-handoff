#!/usr/bin/env node
/**
 * Stage 2 V2 external diagnostic only. This script never changes a speed rating.
 *
 * It reconstructs two post-freeze PowerPro residuals from their original local
 * inputs using an exact normalized-name + exact-team join. The frozen Stage 1
 * acceleration classification is only an explanatory label; no game value is
 * fed back into a rating or evidence classification.
 *
 * Run: node scripts/analyze_speed_2026_acceleration_models.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DERIVED = path.join(ROOT, 'outputs', 'derived');
const PATHS = {
  stage1Manifest: path.join(DERIVED, 'speed_2026_blind_physical_construct_freeze_manifest.json'),
  stage1Profiles: path.join(DERIVED, 'speed_2026_blind_physical_construct_profiles.json'),
  blind: path.join(DERIVED, 'speed_blind_v3_npbplus_2026.json'),
  freeze: path.join(DERIVED, 'speed_2026_100_final_freeze_20260810.csv'),
  acceleration: path.join(DERIVED, 'speed_2026_acceleration_evidence_subset.csv'),
  exposure: path.join(DERIVED, 'npb_plus_sprint_exposure_2026.json'),
  npbScreens: path.join(ROOT, 'data', 'manual', 'npb_plus_screens.jsonl'),
  curatedHp: path.join(ROOT, 'data', 'manual', 'hp_to_1b_measurements_curated.json'),
  database: path.join(ROOT, 'data', 'pennant.db'),
  outputJson: path.join(DERIVED, 'speed_2026_residual_model_comparison.json'),
  outputCsv: path.join(DERIVED, 'speed_2026_residual_model_comparison.csv'),
};

for (const [label, file] of Object.entries(PATHS)) {
  if (!label.startsWith('output') && !existsSync(file)) throw new Error(`Missing required input: ${label}: ${file}`);
}

function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function hashFile(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
function normalizeName(value) {
  // Same deterministic normalization on both sides; it removes spacing only.
  // It intentionally does not transliterate, fuzzy-match, or substitute names.
  return String(value ?? '').normalize('NFKC').replace(/[\s　]/gu, '');
}
function normalizeTeam(value) { return String(value ?? '').normalize('NFKC').trim(); }
function exactKey(team, name) { return `${normalizeTeam(team)}\u001f${normalizeName(name)}`; }

// V2 hard gate. This runs before any residual/model analysis and makes the
// frozen Stage 1 provenance a required, independently checked input.
const stage1Manifest = readJson(PATHS.stage1Manifest);
const expectedStage1Hashes = stage1Manifest.frozen_artifact_sha256 ?? {};
const stage1HashVerification = {
  manifest_schema_version: stage1Manifest.schema_version ?? null,
  manifest_stage: stage1Manifest.stage ?? null,
  profiles: {
    path: 'outputs/derived/speed_2026_blind_physical_construct_profiles.json',
    expected_sha256: expectedStage1Hashes['outputs/derived/speed_2026_blind_physical_construct_profiles.json'] ?? null,
    actual_sha256: hashFile(PATHS.stage1Profiles),
  },
  acceleration_subset: {
    path: 'outputs/derived/speed_2026_acceleration_evidence_subset.csv',
    expected_sha256: expectedStage1Hashes['outputs/derived/speed_2026_acceleration_evidence_subset.csv'] ?? null,
    actual_sha256: hashFile(PATHS.acceleration),
  },
};
stage1HashVerification.profiles.matches_manifest = Boolean(stage1HashVerification.profiles.expected_sha256)
  && stage1HashVerification.profiles.expected_sha256.toLowerCase() === stage1HashVerification.profiles.actual_sha256.toLowerCase();
stage1HashVerification.acceleration_subset.matches_manifest = Boolean(stage1HashVerification.acceleration_subset.expected_sha256)
  && stage1HashVerification.acceleration_subset.expected_sha256.toLowerCase() === stage1HashVerification.acceleration_subset.actual_sha256.toLowerCase();
if (stage1HashVerification.manifest_schema_version !== 'speed-2026-stage1-blind-physical-construct-freeze/v2.0.0'
  || stage1HashVerification.manifest_stage !== 'STAGE_1_V2_FREEZE'
  || !stage1HashVerification.profiles.matches_manifest
  || !stage1HashVerification.acceleration_subset.matches_manifest) {
  throw new Error(`V2 Stage 1 frozen-input verification failed: ${JSON.stringify(stage1HashVerification)}`);
}
const stage1Profiles = readJson(PATHS.stage1Profiles);
if (stage1Profiles.stage !== 'STAGE_1_BLIND_PHYSICAL_CONSTRUCT_V2_FREEZE') {
  throw new Error(`Refusing Stage 2 run: profiles are not the V2 Stage 1 freeze (got ${stage1Profiles.stage ?? 'missing'}).`);
}
function indexUnique(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const unique = new Map();
  const ambiguous = new Map();
  for (const [key, list] of groups) {
    if (list.length === 1) unique.set(key, list[0]);
    else ambiguous.set(key, list);
  }
  return { unique, ambiguous, groups };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/u, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell.replace(/\r$/u, '')); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}
function writeCsv(rows, file) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map(column => csvEscape(row[column])).join(','));
  writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  return { rows: rows.length, columns };
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}
function median(values) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
}
function quantile(values, q) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length) return null;
  const index = (usable.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return usable[lower] + (usable[upper] - usable[lower]) * (index - lower);
}
function variance(values) {
  const mu = mean(values);
  if (mu === null || values.length < 2) return null;
  return values.reduce((sum, value) => sum + (value - mu) ** 2, 0) / (values.length - 1);
}
function pearson(x, y) {
  const pairs = x.map((value, i) => [value, y[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 3) return { n: pairs.length, r: null, reason: 'fewer than three complete pairs' };
  const mx = mean(pairs.map(pair => pair[0]));
  const my = mean(pairs.map(pair => pair[1]));
  let numerator = 0; let xx = 0; let yy = 0;
  for (const [a, b] of pairs) {
    numerator += (a - mx) * (b - my);
    xx += (a - mx) ** 2;
    yy += (b - my) ** 2;
  }
  if (xx === 0 || yy === 0) return { n: pairs.length, r: null, reason: 'zero variance' };
  return { n: pairs.length, r: round(numerator / Math.sqrt(xx * yy)), reason: null };
}
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function invert(matrix) {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    if (Math.abs(augmented[pivot][col]) < 1e-10) return null;
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];
    const divisor = augmented[col][col];
    for (let j = 0; j < 2 * n; j += 1) augmented[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = 0; j < 2 * n; j += 1) augmented[row][j] -= factor * augmented[col][j];
    }
  }
  return augmented.map(row => row.slice(n));
}
function fitOls(X, y) {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (!n || !p || y.length !== n || n <= p) return { valid: false, reason: `n=${n} is not greater than parameter_count=${p}` };
  const xtx = Array.from({ length: p }, () => Array(p).fill(0));
  const xty = Array(p).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let a = 0; a < p; a += 1) {
      xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b += 1) xtx[a][b] += X[i][a] * X[i][b];
    }
  }
  const inverse = invert(xtx);
  if (!inverse) return { valid: false, reason: 'singular design matrix' };
  const coefficients = inverse.map(row => row.reduce((sum, value, j) => sum + value * xty[j], 0));
  const fitted = X.map(row => row.reduce((sum, value, j) => sum + value * coefficients[j], 0));
  const residuals = y.map((value, i) => value - fitted[i]);
  const rss = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const yMean = mean(y);
  const tss = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  return {
    valid: true,
    n,
    parameter_count: p,
    degrees_of_freedom: n - p,
    coefficients,
    fitted,
    residuals,
    rss,
    r2: tss > 0 ? 1 - rss / tss : null,
  };
}
function predict(row, coefficients) { return row.reduce((sum, value, i) => sum + value * coefficients[i], 0); }
function loocv(X, y) {
  const predictions = [];
  for (let i = 0; i < X.length; i += 1) {
    const trainX = X.filter((_, index) => index !== i);
    const trainY = y.filter((_, index) => index !== i);
    const model = fitOls(trainX, trainY);
    if (!model.valid) return { available: false, reason: `fold ${i + 1}: ${model.reason}` };
    predictions.push(predict(X[i], model.coefficients));
  }
  const mae = mean(predictions.map((value, i) => Math.abs(y[i] - value)));
  const sse = predictions.reduce((sum, value, i) => sum + (y[i] - value) ** 2, 0);
  const yMean = mean(y);
  const sst = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  return { available: true, folds: X.length, mae: round(mae), out_of_sample_r2: sst > 0 ? round(1 - sse / sst) : null };
}
function repeatedKFold(X, y, { folds = 5, repeats = 20, seed = 20260810 } = {}) {
  if (X.length < folds) return { available: false, reason: `n=${X.length} is smaller than ${folds} folds` };
  const random = mulberry32(seed);
  const foldMaes = [];
  let invalid = 0;
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    const order = shuffle([...X.keys()], random);
    const perFold = Array.from({ length: folds }, () => []);
    order.forEach((value, i) => perFold[i % folds].push(value));
    for (const testIndex of perFold) {
      const testSet = new Set(testIndex);
      const trainX = X.filter((_, i) => !testSet.has(i));
      const trainY = y.filter((_, i) => !testSet.has(i));
      const model = fitOls(trainX, trainY);
      if (!model.valid) { invalid += 1; continue; }
      foldMaes.push(mean(testIndex.map(i => Math.abs(y[i] - predict(X[i], model.coefficients)))));
    }
  }
  if (!foldMaes.length) return { available: false, reason: 'all repeated-CV training folds were singular or underdetermined', invalid_folds: invalid };
  return {
    available: invalid === 0,
    repeats,
    folds,
    valid_folds: foldMaes.length,
    invalid_folds: invalid,
    mae_mean: round(mean(foldMaes)),
    mae_interval_95: [round(quantile(foldMaes, 0.025)), round(quantile(foldMaes, 0.975))],
    reason: invalid ? 'Some folds were not estimable; do not treat this as a complete repeated-CV result.' : null,
  };
}
function partialR2(full, reduced) {
  if (!full.valid || !reduced.valid) return { available: false, reason: 'full or reduced model was not fit' };
  if (reduced.rss <= 0) return { available: false, reason: 'reduced model has zero residual variation' };
  return { available: true, value: round(1 - full.rss / reduced.rss) };
}
function permutationImportance(X, y, predictorIndex, { iterations = 2000, seed = 20260810 } = {}) {
  const fitted = fitOls(X, y);
  if (!fitted.valid) return { available: false, reason: fitted.reason };
  const originalMse = fitted.rss / y.length;
  const random = mulberry32(seed + predictorIndex);
  const values = X.map(row => row[predictorIndex]);
  const deltas = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const permutation = shuffle(values, random);
    const permuted = X.map((row, i) => row.map((value, index) => index === predictorIndex ? permutation[i] : value));
    const model = fitOls(permuted, y);
    if (model.valid) deltas.push(model.rss / y.length - originalMse);
  }
  return {
    available: Boolean(deltas.length),
    method: 'in-sample MSE increase after independently permuting the named column; diagnostic, not causal',
    iterations_requested: iterations,
    iterations_valid: deltas.length,
    mse_increase_mean: round(mean(deltas)),
    mse_increase_interval_95: [round(quantile(deltas, 0.025)), round(quantile(deltas, 0.975))],
  };
}
function permutationImportanceBlock(X, y, predictorIndexes, { iterations = 2000, seed = 20260810 } = {}) {
  const fitted = fitOls(X, y);
  if (!fitted.valid) return { available: false, reason: fitted.reason };
  const originalMse = fitted.rss / y.length;
  const random = mulberry32(seed + predictorIndexes.reduce((sum, value) => sum + value, 0));
  const deltas = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const order = shuffle([...X.keys()], random);
    const permuted = X.map((row, i) => row.map((value, index) => predictorIndexes.includes(index) ? X[order[i]][index] : value));
    const model = fitOls(permuted, y);
    if (model.valid) deltas.push(model.rss / y.length - originalMse);
  }
  return {
    available: Boolean(deltas.length),
    method: 'in-sample MSE increase after jointly permuting all dummy columns for the named categorical predictor; diagnostic, not causal',
    iterations_requested: iterations,
    iterations_valid: deltas.length,
    mse_increase_mean: round(mean(deltas)),
    mse_increase_interval_95: [round(quantile(deltas, 0.025)), round(quantile(deltas, 0.975))],
  };
}
function bootstrapCoefficient(X, y, coefficientIndex, { iterations = 3000, seed = 20260810 } = {}) {
  const fullFit = fitOls(X, y);
  if (!fullFit.valid) return { available: false, reason: fullFit.reason, iterations_requested: iterations };
  const fullCoefficientSign = Math.sign(fullFit.coefficients[coefficientIndex]);
  const random = mulberry32(seed + coefficientIndex * 91);
  const values = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const indexes = Array.from({ length: X.length }, () => Math.floor(random() * X.length));
    const model = fitOls(indexes.map(i => X[i]), indexes.map(i => y[i]));
    if (model.valid) values.push(model.coefficients[coefficientIndex]);
  }
  if (!values.length) return { available: false, reason: 'no bootstrap resample was estimable', iterations_requested: iterations };
  const nonzero = values.filter(value => value !== 0);
  const positive = values.filter(value => value > 0).length;
  const negative = values.filter(value => value < 0).length;
  return {
    available: true,
    iterations_requested: iterations,
    iterations_valid: values.length,
    coefficient_interval_95: [round(quantile(values, 0.025)), round(quantile(values, 0.975))],
    sign_stability: {
      positive_fraction: round(positive / values.length),
      negative_fraction: round(negative / values.length),
      same_sign_as_full_fit_fraction: nonzero.length && fullCoefficientSign !== 0 ? round((values.filter(value => Math.sign(value) === fullCoefficientSign).length) / nonzero.length) : null,
    },
  };
}
function groupCounts(rows, field) {
  const counts = {};
  for (const row of rows) counts[row[field] ?? 'MISSING'] = (counts[row[field] ?? 'MISSING'] ?? 0) + 1;
  return counts;
}
function exactPermutationRareContrast(rows, valueField, positiveField) {
  const positive = rows.filter(row => row[positiveField]);
  const negative = rows.filter(row => !row[positiveField]);
  if (!positive.length || !negative.length) return { available: false, reason: 'both comparison groups are required' };
  const observed = mean(positive.map(row => row[valueField])) - mean(negative.map(row => row[valueField]));
  const n = rows.length;
  const k = positive.length;
  const combinations = [];
  function visit(start, chosen) {
    if (chosen.length === k) { combinations.push([...chosen]); return; }
    for (let i = start; i <= n - (k - chosen.length); i += 1) { chosen.push(i); visit(i + 1, chosen); chosen.pop(); }
  }
  visit(0, []);
  const effects = combinations.map(indexes => {
    const chosen = new Set(indexes);
    const a = rows.filter((_, i) => chosen.has(i)).map(row => row[valueField]);
    const b = rows.filter((_, i) => !chosen.has(i)).map(row => row[valueField]);
    return mean(a) - mean(b);
  });
  const extreme = effects.filter(effect => Math.abs(effect) >= Math.abs(observed) - 1e-12).length;
  return {
    available: true,
    exact: true,
    positive_n: positive.length,
    comparison_n: negative.length,
    mean_difference_positive_minus_other: round(observed),
    two_sided_p: round(extreme / effects.length),
    permutations: effects.length,
  };
}
function bootstrapRareContrast(rows, valueField, positiveField, { iterations = 3000, seed = 20260810 } = {}) {
  const random = mulberry32(seed);
  const values = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sample = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]);
    const positive = sample.filter(row => row[positiveField]);
    const negative = sample.filter(row => !row[positiveField]);
    if (positive.length && negative.length) values.push(mean(positive.map(row => row[valueField])) - mean(negative.map(row => row[valueField])));
  }
  if (!values.length) return { available: false, reason: 'no resample retained both groups' };
  return {
    available: true,
    method: 'nonparametric resampling; this is a rarity diagnostic, not a stable inferential interval',
    iterations_requested: iterations,
    iterations_valid: values.length,
    invalid_due_to_absent_rare_class: iterations - values.length,
    difference_interval_95: [round(quantile(values, 0.025)), round(quantile(values, 0.975))],
    sign_stability: {
      positive_fraction: round(values.filter(value => value > 0).length / values.length),
      negative_fraction: round(values.filter(value => value < 0).length / values.length),
    },
  };
}
function oneHot(rows, field, reference = null) {
  const levels = [...new Set(rows.map(row => row[field]).filter(value => value !== null && value !== undefined))].sort();
  const ref = reference && levels.includes(reference) ? reference : levels[0] ?? null;
  const encodedLevels = levels.filter(level => level !== ref);
  return {
    levels,
    reference: ref,
    encodedLevels,
    matrix: rows.map(row => [1, ...encodedLevels.map(level => row[field] === level ? 1 : 0)]),
  };
}
function residualizeByGroup(rows, responseField, groupField) {
  const encoding = oneHot(rows, groupField);
  const y = rows.map(row => row[responseField]);
  const fit = fitOls(encoding.matrix, y);
  if (!fit.valid) return { available: false, reason: fit.reason };
  return { available: true, values: fit.residuals, levels: encoding.levels, reference: encoding.reference };
}

const blind = readJson(PATHS.blind).players;
const freeze = parseCsv(readFileSync(PATHS.freeze, 'utf8'));
const acceleration = parseCsv(readFileSync(PATHS.acceleration, 'utf8'));
if (acceleration.length !== 0) {
  throw new Error(`Refusing V2 analysis: the verified V2 acceleration subset must have zero usable rows, found ${acceleration.length}.`);
}
const exposure = readJson(PATHS.exposure).players;
const screens = readFileSync(PATHS.npbScreens, 'utf8').split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
const curatedHp = readJson(PATHS.curatedHp).records;
const db = new DatabaseSync(PATHS.database, { readOnly: true });
const pawapuro2026 = db.prepare("SELECT work, team, name, name_norm, speed FROM pawapuro_full WHERE work = '2026'").all();
const positions = db.prepare('SELECT name, plate_appearances, games, primary_pos, pos_breakdown FROM npb_usage_2026').all();
db.close();

const pawaIndex = indexUnique(pawapuro2026, row => exactKey(row.team, row.name_norm || row.name));
const blindIndex = indexUnique(blind, row => exactKey(row.team, row.name));
const exposureIndex = indexUnique(exposure, row => exactKey(row.team, row.player));
const exposureNameIndex = indexUnique(exposure, row => normalizeName(row.player));
const freezeNameIndex = indexUnique(freeze, row => normalizeName(row.player));
const accelerationIndex = indexUnique(acceleration, row => exactKey(row.team, row.player));
const screenIndex = indexUnique(screens, row => exactKey(row.team, row.name));
const positionIndex = indexUnique(positions, row => normalizeName(row.name));
const curatedHpIndex = indexUnique(curatedHp, row => exactKey(row.team, row.player));

const pawapuroByExactTeam = new Map();
for (const row of pawapuro2026) {
  const team = normalizeTeam(row.team);
  const list = pawapuroByExactTeam.get(team) ?? [];
  list.push(row);
  pawapuroByExactTeam.set(team, list);
}
function matchOfficialPawapuroRosterLabel(team, fullRosterName) {
  // The local 2026 PowerPro source stores official abbreviated roster labels
  // (for example, 周東 instead of 周東佑京). This is not a fuzzy name match:
  // the team must be exact and the abbreviation must be a prefix of exactly
  // one canonical roster name within that same team.
  const canonical = normalizeName(fullRosterName);
  const candidates = (pawapuroByExactTeam.get(normalizeTeam(team)) ?? []).filter(row => {
    const label = normalizeName(row.name_norm || row.name);
    return label && canonical.startsWith(label);
  });
  if (candidates.length !== 1) return { row: null, status: candidates.length ? 'AMBIGUOUS_EXACT_TEAM_OFFICIAL_ABBREVIATION_PREFIX_EXCLUDED' : 'NO_EXACT_TEAM_OFFICIAL_ABBREVIATION_PREFIX_MATCH', candidates };
  const label = normalizeName(candidates[0].name_norm || candidates[0].name);
  return { row: candidates[0], status: label === canonical ? 'EXACT_TEAM_NORMALIZED_NAME_MATCH' : 'UNIQUE_EXACT_TEAM_OFFICIAL_ABBREVIATION_PREFIX_MATCH', candidates };
}

function positionToCode(value) {
  const map = { '捕': 'C', '一': '1B', '二': '2B', '三': '3B', '遊': 'SS', '左': 'LF', '中': 'CF', '右': 'RF' };
  return map[value] ?? null;
}
function positionGroup(position) {
  if (['SS', 'CF', 'RF'].includes(position)) return 'MIDDLE_PREMIUM';
  if (position === '2B') return 'MIDDLE_NEUTRAL';
  if (['C', '1B', '3B', 'LF'].includes(position)) return 'CORNER_CATCHER';
  return null;
}

// Use exposure roster to supply the team to the freeze CSV, whose frozen table
// intentionally contains player names but no team column. Name-only matches are
// accepted here only when the source roster has exactly one normalized-name row.
const stage2Rows = [];
for (const roster of exposure) {
  const key = exactKey(roster.team, roster.player);
  const pawapuroMatch = matchOfficialPawapuroRosterLabel(roster.team, roster.player);
  const pawa = pawapuroMatch.row;
  const blindRow = blindIndex.unique.get(key) ?? null;
  const frozen = freezeNameIndex.unique.get(normalizeName(roster.player)) ?? null;
  const accelerationRow = accelerationIndex.unique.get(key) ?? null;
  const screen = screenIndex.unique.get(key) ?? null;
  const positionRow = positionIndex.unique.get(normalizeName(roster.player)) ?? null;
  const primaryPosition = positionToCode(positionRow?.primary_pos);
  const pawaSpeed = numberOrNull(pawa?.speed);
  const blindRating = numberOrNull(blindRow?.blind_rating);
  const finalRating = numberOrNull(frozen?.final_rating);
  const exactPawaMatch = Boolean(pawa);
  const residualA = exactPawaMatch && blindRating !== null ? Math.round(blindRating) - pawaSpeed : null;
  const residualB = exactPawaMatch && finalRating !== null ? finalRating - pawaSpeed : null;
  stage2Rows.push({
    player: roster.player,
    team: roster.team,
    player_id: roster.player_id ?? null,
    exact_team_normalized_name_key: key,
    powerpro_match_status: pawapuroMatch.status,
    powerpro_2026_speed: pawaSpeed,
    powerpro_source_roster_label: pawa?.name_norm ?? null,
    blind_v3_match_status: blindRow ? 'EXACT_TEAM_NORMALIZED_NAME_MATCH' : 'NO_EXACT_TEAM_NORMALIZED_NAME_MATCH',
    blind_v3_rating_unrounded: blindRating,
    blind_v3_rating_rounded: blindRating === null ? null : Math.round(blindRating),
    final_freeze_match_status: frozen ? 'UNIQUE_NORMALIZED_NAME_TO_FROZEN_CSV_WITH_TEAM_FROM_EXPOSURE_ROSTER' : (freezeNameIndex.ambiguous.has(normalizeName(roster.player)) ? 'AMBIGUOUS_FROZEN_NAME_EXCLUDED' : 'NO_FROZEN_NAME_MATCH'),
    final_freeze_rating: finalRating,
    residual_a_rounded_blind_minus_powerpro: residualA,
    residual_b_final_freeze_minus_powerpro: residualB,
    npb_plus_top_speed_kmh: numberOrNull(roster.npb_plus_sprint_speed_kmh),
    PA: numberOrNull(roster.PA),
    full_effort_run_proxy_count: numberOrNull(roster.full_effort_run_proxy_count),
    hp_to_1b_sec_current_npb_plus: numberOrNull(screen?.hp_to_1b_sec),
    primary_position: primaryPosition,
    position_group: positionGroup(primaryPosition),
    position_match_status: positionRow ? 'UNIQUE_NORMALIZED_NAME_MATCH_NPB_USAGE_2026_NO_TEAM_FIELD' : (positionIndex.ambiguous.has(normalizeName(roster.player)) ? 'AMBIGUOUS_NAME_EXCLUDED' : 'NO_POSITION_ROW'),
    acceleration_subset_member: Boolean(accelerationRow),
    acceleration_classification: accelerationRow?.acceleration_top_speed_classification ?? null,
    acceleration_classification_basis: accelerationRow?.classification_basis ?? null,
    acceleration_measurement_era: accelerationRow?.measurement_era ?? null,
    acceleration_exposure_json: accelerationRow?.exposure ?? null,
    npb_plus_exit_velo_max: numberOrNull(screen?.exit_velo_max),
    npb_plus_hard_hit_pct: numberOrNull(screen?.hard_hit_pct),
    power_proxy_match_status: screen ? 'EXACT_TEAM_NORMALIZED_NAME_MATCH' : (screenIndex.ambiguous.has(key) ? 'AMBIGUOUS_EXCLUDED' : 'NO_SCREEN_ROW'),
    curated_historical_hp_to_1b_present: curatedHpIndex.groups.has(key),
  });
}

const residualARows = stage2Rows.filter(row => row.residual_a_rounded_blind_minus_powerpro !== null);
const residualBRows = stage2Rows.filter(row => row.residual_b_final_freeze_minus_powerpro !== null);
const accelerationRows = stage2Rows.filter(row => row.acceleration_subset_member && row.residual_a_rounded_blind_minus_powerpro !== null && row.residual_b_final_freeze_minus_powerpro !== null);

function hpDiagnostic(valueField) {
  const rows = stage2Rows.filter(row => row[valueField] !== null && row.hp_to_1b_sec_current_npb_plus !== null);
  const allSeconds = pearson(rows.map(row => row.hp_to_1b_sec_current_npb_plus), rows.map(row => row[valueField]));
  const allFaster = pearson(rows.map(row => -row.hp_to_1b_sec_current_npb_plus), rows.map(row => row[valueField]));
  const pa200 = rows.filter(row => row.PA !== null && row.PA >= 200);
  const pa200Seconds = pearson(pa200.map(row => row.hp_to_1b_sec_current_npb_plus), pa200.map(row => row[valueField]));
  const hpResidualRows = rows.filter(row => row.npb_plus_top_speed_kmh !== null && row.PA !== null);
  const hpResidualX = hpResidualRows.map(row => [1, row.npb_plus_top_speed_kmh, row.PA]);
  const hpResidualFit = fitOls(hpResidualX, hpResidualRows.map(row => row.hp_to_1b_sec_current_npb_plus));
  const hpResidualCorrelation = hpResidualFit.valid
    ? pearson(hpResidualFit.residuals, hpResidualRows.map(row => row[valueField]))
    : { n: hpResidualRows.length, r: null, reason: hpResidualFit.reason };
  const controlled = rows.filter(row => row.position_group !== null);
  const residualY = residualizeByGroup(controlled, valueField, 'position_group');
  const residualHp = residualizeByGroup(controlled, 'hp_to_1b_sec_current_npb_plus', 'position_group');
  const positionControl = residualY.available && residualHp.available
    ? pearson(residualHp.values, residualY.values)
    : { n: controlled.length, r: null, reason: residualY.reason ?? residualHp.reason };
  return {
    status: 'DIAGNOSTIC_CONTEXT_ONLY',
    response: valueField,
    direction: 'The raw time is seconds (lower is faster); both raw-seconds and reversed faster-is-higher signs are shown to prevent sign ambiguity.',
    all_current_npb_plus_hp_to_1b: {
      n: allSeconds.n,
      pearson_r_seconds_vs_residual: allSeconds.r,
      pearson_r_faster_is_higher_vs_residual: allFaster.r,
      note: 'This is the direct local 2026 NPB+ field. It remains context-only because swing-to-run transition and batting side are not resolved.',
    },
    reported_prior_residual_correlation_reproduction: {
      reported_reference: 'approximately 0.061 for a home-to-first residual specification containing top speed plus LHH plus switch/PA terms',
      status: 'NOT_EXACTLY_REPRODUCIBLE_FROM_PERMITTED_LOCAL_FIELDS',
      missing_required_terms: ['batting handedness / LHH', 'switch-hitter flag'],
      available_reduced_specification: hpResidualFit.valid ? {
        n: hpResidualRows.length,
        hp_to_1b_model: 'seconds ~ intercept + current NPB+ top speed (km/h) + PA',
        correlation_of_reduced_spec_hp_residual_with_powerpro_residual: hpResidualCorrelation.r,
        note: 'This is a diagnostic-only reduced specification, not a substitute reproduction of the reported 0.061 because LHH and switch terms are unavailable.',
      } : { n: hpResidualRows.length, available: false, reason: hpResidualFit.reason },
    },
    sensitivity: {
      PA_at_least_200: {
        threshold: 200,
        n: pa200Seconds.n,
        pearson_r_seconds_vs_residual: pa200Seconds.r,
        note: 'PA is exposure, not a direct count of qualifying full-effort home-to-first runs.',
      },
      left_handed_excluded: {
        available: false,
        reason: 'No batting-handedness field is present in the permitted source rows; no inference or external lookup was substituted.',
      },
      switch_hitter_separately: {
        available: false,
        reason: 'No batting-handedness field is present in the permitted source rows; no inference or external lookup was substituted.',
      },
      position_group_control: {
        n: positionControl.n,
        method: 'Pearson correlation after separately residualizing home-to-first seconds and the response on the predefined three-level position group; diagnostic/noncausal only, not an acceleration predictive model.',
        pearson_r_seconds_vs_residual: positionControl.r,
        reason_if_unavailable: positionControl.reason ?? null,
        position_groups: residualY.levels ?? null,
      },
    },
    verdict: 'DIAGNOSTIC_CONTEXT_ONLY_NO_RATING_CORRECTION',
  };
}

function archetypeDiagnostic(valueField) {
  const rows = stage2Rows.filter(row => row[valueField] !== null && row.position_group !== null && row.npb_plus_exit_velo_max !== null);
  const y = rows.map(row => row[valueField]);
  const group = oneHot(rows, 'position_group', 'CORNER_CATCHER');
  const reducedX = group.matrix;
  const fullX = group.matrix.map((row, i) => [...row, rows[i].npb_plus_exit_velo_max]);
  const reduced = fitOls(reducedX, y);
  const full = fitOls(fullX, y);
  const coefficientIndex = fullX[0].length - 1;
  return {
    status: 'DIAGNOSTIC_ONLY_NOT_AN_ACCELERATION_MODEL',
    response: valueField,
    power_proxy: {
      field: 'npb_plus_exit_velo_max',
      definition: 'Existing current NPB+ maximum exit velocity. It is treated as a continuous hard-contact/power proxy, not a categorical power-hitter label.',
      n: rows.length,
      missing_from_exact_residual_rows: stage2Rows.filter(row => row[valueField] !== null && row.npb_plus_exit_velo_max === null).length,
      raw_pearson: pearson(rows.map(row => row.npb_plus_exit_velo_max), y),
    },
    fields_available: {
      primary_position: stage2Rows.filter(row => row[valueField] !== null && row.primary_position !== null).length,
      position_group: stage2Rows.filter(row => row[valueField] !== null && row.position_group !== null).length,
      PA: stage2Rows.filter(row => row[valueField] !== null && row.PA !== null).length,
      full_effort_run_proxy_count: stage2Rows.filter(row => row[valueField] !== null && row.full_effort_run_proxy_count !== null).length,
      exit_velo_max: rows.length,
      hard_hit_pct: stage2Rows.filter(row => row[valueField] !== null && row.npb_plus_hard_hit_pct !== null).length,
      age: 0,
      height: 0,
      weight: 0,
      batting_handedness: 0,
    },
    position_adjusted_exit_velo_model: {
      available: full.valid && reduced.valid,
      reason_if_unavailable: full.valid && reduced.valid ? null : (full.reason ?? reduced.reason),
      n: full.valid && reduced.valid ? rows.length : null,
      parameter_count: full.valid && reduced.valid ? full.parameter_count : null,
      degrees_of_freedom: full.valid && reduced.valid ? full.degrees_of_freedom : null,
      position_group_reference: group.reference,
      position_group_levels: group.levels,
      coefficient_exit_velo: full.valid && reduced.valid ? round(full.coefficients[coefficientIndex]) : null,
      in_sample_r2: full.valid && reduced.valid ? round(full.r2) : null,
      partial_r2_exit_velo_given_position_group: partialR2(full, reduced),
      loocv: full.valid && reduced.valid ? loocv(fullX, y) : { available: false, reason: full.reason ?? reduced.reason },
      repeated_cv: full.valid && reduced.valid ? repeatedKFold(fullX, y) : { available: false, reason: full.reason ?? reduced.reason },
      permutation_importance_exit_velo: full.valid && reduced.valid ? permutationImportance(fullX, y, coefficientIndex) : { available: false, reason: full.reason ?? reduced.reason },
      bootstrap_coefficient_sign_stability_exit_velo: full.valid && reduced.valid ? bootstrapCoefficient(fullX, y, coefficientIndex) : { available: false, reason: full.reason ?? reduced.reason },
      caution: 'This is an independent external-QA archetype association diagnostic. It neither identifies a causal source of a residual nor authorizes a rating correction; it is not an acceleration or position-plus-acceleration predictive fit.',
    },
  };
}

function makeV2NoUsableAccelerationEvidence(valueField) {
  const unavailable = (model) => ({
    model,
    status: 'NOT_IDENTIFIABLE_NO_USABLE_CURRENT_ACCELERATION_EVIDENCE',
    n: 0,
    fit_performed: false,
    reason: 'The verified V2 Stage 1 acceleration-evidence subset is empty after temporal-boundary exclusions. No model may be fit.',
    loocv_mae: { available: false, reason: 'n=0; no fit performed' },
    repeated_cv_mae: { available: false, reason: 'n=0; no fit performed' },
    out_of_sample_r2: { available: false, reason: 'n=0; no fit performed' },
    partial_r2: { available: false, reason: 'n=0; no fit performed' },
    permutation_importance: { available: false, reason: 'n=0; no fit performed' },
    bootstrap_coefficient_sign_stability: { available: false, reason: 'n=0; no fit performed' },
  });
  return {
    response: valueField,
    analysis_n: 0,
    status: 'NO_USABLE_CURRENT_ACCELERATION_EVIDENCE',
    conclusion: 'NOT_IDENTIFIABLE: V2 contains no usable current acceleration evidence. No acceleration, position, joint, age, handedness, or exposure model was fit.',
    requested_models: {
      position_only: unavailable('position_only'),
      acceleration_only: unavailable('acceleration_only'),
      position_plus_acceleration: unavailable('position_plus_acceleration'),
      plus_age: unavailable('position_plus_acceleration_plus_age'),
      plus_handedness: unavailable('position_plus_acceleration_plus_handedness'),
      plus_exposure_confidence: unavailable('position_plus_acceleration_plus_exposure_confidence'),
    },
  };
}

const accelerationAnalysis = {
  stage1_v2_manifest_verification: stage1HashVerification,
  stage1_v2_profile_summary: {
    stage: stage1Profiles.stage,
    profile_count: stage1Profiles.profile_count,
    classification_counts: stage1Profiles.classification_counts,
    known_non_2026_comparison_measurements: stage1Manifest.coverage?.known_non_2026_comparison_measurements ?? null,
  },
  frozen_stage1_source: 'outputs/derived/speed_2026_acceleration_evidence_subset.csv',
  source_row_count: acceleration.length,
  exact_residual_rows: accelerationRows.length,
  usable_current_acceleration_evidence_n: 0,
  excluded_without_exact_powerpro_residual: [],
  residual_a: makeV2NoUsableAccelerationEvidence('residual_a_rounded_blind_minus_powerpro'),
  residual_b: makeV2NoUsableAccelerationEvidence('residual_b_final_freeze_minus_powerpro'),
  conservative_conclusion: 'NOT_IDENTIFIABLE / NO_USABLE_CURRENT_ACCELERATION_EVIDENCE: the V2 temporal boundary leaves zero usable acceleration rows, so no acceleration-related model was fit.',
};

const hpTargetCurrentMatches = stage2Rows.filter(row => row.curated_historical_hp_to_1b_present).length;
const outputRows = stage2Rows.map(row => ({
  player: row.player,
  team: row.team,
  player_id: row.player_id,
  powerpro_match_status: row.powerpro_match_status,
  powerpro_2026_speed: row.powerpro_2026_speed,
  blind_v3_rating_unrounded: row.blind_v3_rating_unrounded,
  blind_v3_rating_rounded: row.blind_v3_rating_rounded,
  final_freeze_rating: row.final_freeze_rating,
  residual_a_rounded_blind_minus_powerpro: row.residual_a_rounded_blind_minus_powerpro,
  residual_b_final_freeze_minus_powerpro: row.residual_b_final_freeze_minus_powerpro,
  npb_plus_top_speed_kmh: row.npb_plus_top_speed_kmh,
  PA: row.PA,
  full_effort_run_proxy_count: row.full_effort_run_proxy_count,
  hp_to_1b_sec_current_npb_plus: row.hp_to_1b_sec_current_npb_plus,
  primary_position: row.primary_position,
  position_group: row.position_group,
  position_match_status: row.position_match_status,
  acceleration_subset_member: row.acceleration_subset_member,
  acceleration_classification: row.acceleration_classification,
  acceleration_classification_basis: row.acceleration_classification_basis,
  npb_plus_exit_velo_max: row.npb_plus_exit_velo_max,
  npb_plus_hard_hit_pct: row.npb_plus_hard_hit_pct,
  curated_historical_hp_to_1b_present: row.curated_historical_hp_to_1b_present,
}));

const out = {
  schema_version: 'speed-2026-stage2-residual-model-comparison/v2.0.0',
  generated_at: new Date().toISOString(),
  purpose: 'External PowerPro residual-structure diagnostic after the independent physical freeze. No result in this file changes a Stage 1 or final speed rating.',
  guards: {
    powerpro_is_teacher_or_correction_target: false,
    stage1_classification_rebuilt_or_changed: false,
    stage1_v2_manifest_and_frozen_hashes_verified_before_analysis: true,
    acceleration_models_fit: false,
    hp_to_1b_independent_diagnostic_sensitivities_fit: true,
    archetype_independent_association_diagnostic_fit: true,
    forced_name_match: false,
    hp_to_1b_used_as_acceleration_or_rating_input: false,
    game_values_used_in_archetype_predictor: false,
  },
  inputs: Object.fromEntries(Object.entries(PATHS).filter(([label]) => !label.startsWith('output')).map(([label, file]) => [label, { path: path.relative(ROOT, file).replaceAll('\\', '/'), sha256: hashFile(file) }])),
  field_mapping: {
    residual_a: 'Math.round(outputs/derived/speed_blind_v3_npbplus_2026.json players[].blind_rating) minus data/pennant.db pawapuro_full.speed where work=2026',
    residual_b: 'outputs/derived/speed_2026_100_final_freeze_20260810.csv final_rating minus data/pennant.db pawapuro_full.speed where work=2026',
    identity: 'PowerPro source uses official abbreviated roster labels. Matching requires exact team and a unique official-label prefix of the full normalized roster name (NFKC, spacing removed only); no fuzzy/near-name matching. The frozen CSV supplies only player name, so its team is recovered solely from a unique normalized-name row in the 100-player exposure roster before that PowerPro join.',
    acceleration: 'Verified V2 frozen acceleration subset from outputs/derived/speed_2026_acceleration_evidence_subset.csv. The file has zero usable rows after temporal-boundary exclusions; no class is recomputed and no acceleration-related model is fit.',
    hp_to_1b: 'Current NPB+ hp_to_1b_sec field from data/manual/npb_plus_screens.jsonl, joined by exact team plus normalized name. It is a context-only diagnostic because batting side and swing-to-run protocol are unresolved.',
    position: 'npb_usage_2026.primary_pos from data/pennant.db, joined only on a unique normalized player name because that local table has no team column.',
    exposure: 'PA and full_effort_run_proxy_count from outputs/derived/npb_plus_sprint_exposure_2026.json.',
    power_proxy: 'npb_plus_exit_velo_max and npb_plus_hard_hit_pct from data/manual/npb_plus_screens.jsonl, joined by exact team plus normalized name.',
  },
  stage1_v2_provenance: {
    manifest: 'outputs/derived/speed_2026_blind_physical_construct_freeze_manifest.json',
    profile: 'outputs/derived/speed_2026_blind_physical_construct_profiles.json',
    acceleration_subset: 'outputs/derived/speed_2026_acceleration_evidence_subset.csv',
    hash_verification_before_analysis: stage1HashVerification,
    profile_stage: stage1Profiles.stage,
    profile_classification_counts: stage1Profiles.classification_counts,
  },
  exact_match_qa: {
    roster_rows: stage2Rows.length,
    pawapuro_2026_rows_in_database: pawapuro2026.length,
    residual_a_n: residualARows.length,
    residual_b_n: residualBRows.length,
    unmatched_from_residual_b: stage2Rows.filter(row => row.residual_b_final_freeze_minus_powerpro === null).map(row => ({ player: row.player, team: row.team, powerpro_match_status: row.powerpro_match_status })),
    ambiguous_powerpro_official_abbreviation_prefixes_excluded: stage2Rows.filter(row => row.powerpro_match_status === 'AMBIGUOUS_EXACT_TEAM_OFFICIAL_ABBREVIATION_PREFIX_EXCLUDED').length,
    expected_unmatched_player: '名原 典彦',
    no_forced_match_for_expected_unmatched: stage2Rows.some(row => normalizeName(row.player) === normalizeName('名原 典彦') && row.powerpro_match_status === 'NO_EXACT_TEAM_OFFICIAL_ABBREVIATION_PREFIX_MATCH'),
    residual_formula_qa: {
      residual_a_all_recomputed: residualARows.every(row => row.residual_a_rounded_blind_minus_powerpro === row.blind_v3_rating_rounded - row.powerpro_2026_speed),
      residual_b_all_recomputed: residualBRows.every(row => row.residual_b_final_freeze_minus_powerpro === row.final_freeze_rating - row.powerpro_2026_speed),
    },
  },
  residual_summary: {
    residual_a: { n: residualARows.length, mean: round(mean(residualARows.map(row => row.residual_a_rounded_blind_minus_powerpro))), median: round(median(residualARows.map(row => row.residual_a_rounded_blind_minus_powerpro))), sd: round(Math.sqrt(variance(residualARows.map(row => row.residual_a_rounded_blind_minus_powerpro)) ?? NaN)) },
    residual_b: { n: residualBRows.length, mean: round(mean(residualBRows.map(row => row.residual_b_final_freeze_minus_powerpro))), median: round(median(residualBRows.map(row => row.residual_b_final_freeze_minus_powerpro))), sd: round(Math.sqrt(variance(residualBRows.map(row => row.residual_b_final_freeze_minus_powerpro)) ?? NaN)) },
  },
  acceleration_analysis: accelerationAnalysis,
  hp_to_1b_diagnostic: {
    source_availability: {
      current_npb_plus_rows_with_time_and_residual_a: stage2Rows.filter(row => row.hp_to_1b_sec_current_npb_plus !== null && row.residual_a_rounded_blind_minus_powerpro !== null).length,
      current_npb_plus_rows_with_time_and_residual_b: stage2Rows.filter(row => row.hp_to_1b_sec_current_npb_plus !== null && row.residual_b_final_freeze_minus_powerpro !== null).length,
      historical_curated_records: curatedHp.length,
      historical_curated_exact_current_team_name_matches: hpTargetCurrentMatches,
      historical_curated_use: 'Not pooled: their measurements are historical, heterogeneous, and often condition-specific. The 2026 roster diagnostic uses only the current local NPB+ field.',
    },
    residual_a: hpDiagnostic('residual_a_rounded_blind_minus_powerpro'),
    residual_b: hpDiagnostic('residual_b_final_freeze_minus_powerpro'),
    conclusion: 'HP→1B remains diagnostic/context-only. Neither its correlations nor any sensitivity result may be turned into an acceleration correction.',
  },
  archetype_diagnostic: {
    residual_a: archetypeDiagnostic('residual_a_rounded_blind_minus_powerpro'),
    residual_b: archetypeDiagnostic('residual_b_final_freeze_minus_powerpro'),
    conservative_conclusion: 'Position and a limited existing power proxy can be described, but age, height, weight, and batting handedness are absent. These observations do not identify a residual causal mechanism or an acceleration effect.',
  },
  player_level_inputs: outputRows,
  limitations: [
    'PowerPro is an external comparison only. This output does not change a rating, a physical evidence tier, or a Stage 1 classification.',
    'The verified V2 acceleration subset has zero usable rows after temporal-boundary exclusions. No position, acceleration, joint, age, handedness, or exposure model was fit.',
    'The current NPB+ HP→1B time has unresolved batting side and swing-to-run protocol. It is not a T90 equivalent or a direct acceleration measure.',
    'Age, height, weight, and batting handedness are absent from the permitted local Stage 2 source rows. They were not inferred or collected externally.',
    'Position comes from a local usage table without a team field; it is used only after a unique normalized-name match and is labeled separately from the exact team-aware PowerPro join.',
    'The position-adjusted exit-velocity association is a diagnostic/noncausal archetype check, not an acceleration model or an appraisal rule.',
  ],
  conclusion: 'NOT_IDENTIFIABLE / NO_USABLE_CURRENT_ACCELERATION_EVIDENCE for an acceleration-component claim. V2 supports no acceleration-related model and no PowerPro-based speed correction.',
};

mkdirSync(DERIVED, { recursive: true });
writeFileSync(PATHS.outputJson, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
const csv = writeCsv(outputRows, PATHS.outputCsv);
const qa = {
  json_written: existsSync(PATHS.outputJson),
  csv_written: existsSync(PATHS.outputCsv),
  json_round_trip: JSON.parse(readFileSync(PATHS.outputJson, 'utf8')).exact_match_qa.residual_a_n === residualARows.length,
  csv_rows: csv.rows,
  player_rows: outputRows.length,
  residual_a_n: residualARows.length,
  residual_b_n: residualBRows.length,
  acceleration_subset_n: accelerationRows.length,
  stage1_v2_profile_hash_matches_manifest: stage1HashVerification.profiles.matches_manifest,
  stage1_v2_acceleration_subset_hash_matches_manifest: stage1HashVerification.acceleration_subset.matches_manifest,
};
out.reproducibility_qa = qa;
writeFileSync(PATHS.outputJson, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(qa));

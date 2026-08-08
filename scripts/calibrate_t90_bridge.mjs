// Calibrate MLB Statcast Sprint Speed -> standardized 90ft running time (T90).
// Input: data/raw/statcast_running/{running_splits,sprint_speed}_YYYY.csv
// Output: outputs/derived/t90_bridge_calibration.json
//
// Design rules:
// - T90 is the target. Sprint Speed is evidence, not the rating itself.
// - Switch hitters can appear once per batting side in Running Splits; collapse to one player-season
//   using competitive-run weights when available.
// - Do not use home-to-first fastest time here.
// - Report year-fixed-effect slope, leave-one-year-out performance, and adjacent-year repeatability.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(ROOT, 'data', 'raw', 'statcast_running');
const OUT = path.join(ROOT, 'outputs', 'derived', 't90_bridge_calibration.json');

const normalize = s => String(s ?? '').trim().toLowerCase()
  .replace(/[%()]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map(x => x.trim());
  return {
    headers,
    rows: rows.slice(1).filter(r => r.some(x => String(x ?? '').trim() !== '')).map(r =>
      Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))),
  };
}

const num = v => {
  const n = Number(String(v ?? '').replace(/[%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

function pickHeader(headers, tests) {
  const hs = headers.map(h => [h, normalize(h)]);
  for (const test of tests) {
    const hit = hs.find(([, n]) => test(n));
    if (hit) return hit[0];
  }
  return null;
}

const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const wmean = (a, valueKey, weightKey) => {
  let sw = 0, sv = 0;
  for (const r of a) {
    const v = r[valueKey], w = r[weightKey] > 0 ? r[weightKey] : 1;
    if (!Number.isFinite(v)) continue;
    sv += v * w; sw += w;
  }
  return sw > 0 ? sv / sw : null;
};

function corrPairs(pairs) {
  const a = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (a.length < 3) return null;
  const mx = mean(a.map(x => x[0])), my = mean(a.map(x => x[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of a) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

function olsXY(rows, xKey = 'sprint', yKey = 't90') {
  const a = rows.filter(r => Number.isFinite(r[xKey]) && Number.isFinite(r[yKey]));
  const mx = mean(a.map(r => r[xKey])), my = mean(a.map(r => r[yKey]));
  let sxy = 0, sxx = 0;
  for (const r of a) { sxy += (r[xKey] - mx) * (r[yKey] - my); sxx += (r[xKey] - mx) ** 2; }
  const slope = sxx > 0 ? sxy / sxx : null;
  return { n: a.length, intercept: slope == null ? null : my - slope * mx, slope };
}

function evalPred(rows, pred) {
  const a = rows.map(r => ({ ...r, p: pred(r) })).filter(r => Number.isFinite(r.p) && Number.isFinite(r.t90));
  if (!a.length) return { n: 0 };
  const err = a.map(r => r.p - r.t90);
  return {
    n: a.length,
    mae: mean(err.map(Math.abs)),
    rmse: Math.sqrt(mean(err.map(x => x * x))),
    bias: mean(err),
    r: corrPairs(a.map(r => [r.p, r.t90])),
  };
}

function multiOlsYearTrend(rows, centerYear) {
  const a = rows.filter(r => Number.isFinite(r.sprint) && Number.isFinite(r.t90) && Number.isFinite(r.year));
  // Solve 3x3 normal equations for y = b0 + b1*sprint + b2*(year-centerYear)
  const X = a.map(r => [1, r.sprint, r.year - centerYear]);
  const y = a.map(r => r.t90);
  const M = Array.from({ length: 3 }, () => Array(3).fill(0));
  const v = Array(3).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < 3; j++) {
      v[j] += X[i][j] * y[i];
      for (let k = 0; k < 3; k++) M[j][k] += X[i][j] * X[i][k];
    }
  }
  // Gaussian elimination
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let j = i + 1; j < 3; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    [M[i], M[p]] = [M[p], M[i]]; [v[i], v[p]] = [v[p], v[i]];
    const d = M[i][i];
    if (Math.abs(d) < 1e-12) return null;
    for (let k = i; k < 3; k++) M[i][k] /= d; v[i] /= d;
    for (let j = 0; j < 3; j++) if (j !== i) {
      const f = M[j][i];
      for (let k = i; k < 3; k++) M[j][k] -= f * M[i][k];
      v[j] -= f * v[i];
    }
  }
  return { n: a.length, intercept: v[0], sprint_slope: v[1], year_slope: v[2], center_year: centerYear };
}

const files = await readdir(IN);
const years = [...new Set(files.map(f => Number(f.match(/_(20\d\d)\.csv$/)?.[1])).filter(Number.isFinite))].sort();
if (!years.length) throw new Error(`No Statcast running CSVs in ${path.relative(ROOT, IN)}`);

const all = [];
const diagnostics = [];
for (const year of years) {
  const splitFile = path.join(IN, `running_splits_${year}.csv`);
  const sprintFile = path.join(IN, `sprint_speed_${year}.csv`);
  let splitText, sprintText;
  try { splitText = await readFile(splitFile, 'utf8'); sprintText = await readFile(sprintFile, 'utf8'); }
  catch { continue; }
  const S = parseCsv(splitText), P = parseCsv(sprintText);

  const sid = pickHeader(S.headers, [n => n === 'player_id', n => n.endsWith('_id') && n.includes('player')]);
  const sname = pickHeader(S.headers, [n => n === 'player_name', n => n === 'name', n => n.includes('player_name')]);
  const sw = pickHeader(S.headers, [n => n === 'competitive_runs', n => n.includes('competitive') && n.includes('run')]);
  const splitHeader = d => pickHeader(S.headers, [
    n => n === String(d),
    n => n === `${d}ft` || n === `${d}_ft`,
    n => n.includes(`${d}ft`) || n.includes(`${d}_ft`),
    n => n === `split_${d}` || n === `${d}_split`,
  ]);
  const h10 = splitHeader(10), h30 = splitHeader(30), h60 = splitHeader(60), h90 = splitHeader(90);

  const pid = pickHeader(P.headers, [n => n === 'player_id', n => n.endsWith('_id') && n.includes('player')]);
  const pname = pickHeader(P.headers, [n => n === 'player_name', n => n === 'name', n => n.includes('player_name')]);
  const pspeed = pickHeader(P.headers, [n => n === 'sprint_speed', n => n.includes('sprint') && n.includes('speed')]);

  if ((!sid && !sname) || !h90 || (!pid && !pname) || !pspeed) {
    diagnostics.push({ year, error: 'header_detection_failed', split_headers: S.headers, sprint_headers: P.headers,
      detected: { sid, sname, sw, h10, h30, h60, h90, pid, pname, pspeed } });
    continue;
  }

  const splitGroups = new Map();
  for (const r of S.rows) {
    const keyRaw = sid ? r[sid] : r[sname];
    const key = String(keyRaw ?? '').trim();
    const t90 = num(r[h90]);
    if (!key || !(t90 > 0)) continue;
    const rec = { t90, t10: h10 ? num(r[h10]) : null, t30: h30 ? num(r[h30]) : null,
      t60: h60 ? num(r[h60]) : null, weight: sw ? num(r[sw]) : 1, name: sname ? r[sname] : null };
    if (!splitGroups.has(key)) splitGroups.set(key, []);
    splitGroups.get(key).push(rec);
  }

  const split = new Map();
  for (const [key, a] of splitGroups) split.set(key, {
    key, name: a.find(x => x.name)?.name ?? null,
    t90: wmean(a, 't90', 'weight'), t10: wmean(a, 't10', 'weight'), t30: wmean(a, 't30', 'weight'),
    t60: wmean(a, 't60', 'weight'), split_rows: a.length, split_weight: a.reduce((s, x) => s + (x.weight > 0 ? x.weight : 1), 0),
  });

  const sprint = new Map();
  for (const r of P.rows) {
    const keyRaw = pid ? r[pid] : r[pname];
    const key = String(keyRaw ?? '').trim();
    const v = num(r[pspeed]);
    if (key && Number.isFinite(v)) sprint.set(key, { sprint: v, name: pname ? r[pname] : null });
  }

  let matched = 0;
  for (const [key, a] of split) {
    const b = sprint.get(key);
    if (!b) continue;
    all.push({ year, player_key: key, name: a.name ?? b.name, sprint: b.sprint, t10: a.t10, t30: a.t30,
      t60: a.t60, t90: a.t90, split_rows: a.split_rows, split_weight: a.split_weight });
    matched++;
  }
  diagnostics.push({ year, split_player_seasons: split.size, sprint_player_seasons: sprint.size, matched,
    detected: { sid, sname, sw, h10, h30, h60, h90, pid, pname, pspeed } });
}

if (all.length < 20) throw new Error(`Only ${all.length} matched player-seasons; inspect diagnostics/header mapping`);

const byYear = new Map();
for (const r of all) { if (!byYear.has(r.year)) byYear.set(r.year, []); byYear.get(r.year).push(r); }
const yearStats = {};
for (const [year, a] of byYear) {
  yearStats[year] = {
    n: a.length,
    sprint_mean: mean(a.map(r => r.sprint)),
    t90_mean: mean(a.map(r => r.t90)),
    t90_sd: Math.sqrt(mean(a.map(r => (r.t90 - mean(a.map(x => x.t90))) ** 2))),
    r_sprint_t90: corrPairs(a.map(r => [r.sprint, r.t90])),
  };
}

const pooled = olsXY(all);
const centerYear = Math.round(mean(all.map(r => r.year)));
const trendModel = multiOlsYearTrend(all, centerYear);
const pooledEval = evalPred(all, r => pooled.intercept + pooled.slope * r.sprint);
const trendEval = trendModel ? evalPred(all, r => trendModel.intercept + trendModel.sprint_slope * r.sprint + trendModel.year_slope * (r.year - centerYear)) : null;

// Within-year centered slope: removes season-level measurement/environment shifts.
let numFE = 0, denFE = 0;
for (const [, a] of byYear) {
  const mx = mean(a.map(r => r.sprint)), my = mean(a.map(r => r.t90));
  for (const r of a) { numFE += (r.sprint - mx) * (r.t90 - my); denFE += (r.sprint - mx) ** 2; }
}
const betaFE = denFE > 0 ? numFE / denFE : null;
const feResiduals = all.map(r => {
  const a = byYear.get(r.year), mx = mean(a.map(x => x.sprint)), my = mean(a.map(x => x.t90));
  return { ...r, residual: r.t90 - (my + betaFE * (r.sprint - mx)) };
});

// Leave-one-year-out: train raw Sprint Speed -> T90 on other seasons and test the held-out season.
const cv = [];
for (const y of years) {
  const train = all.filter(r => r.year !== y), test = all.filter(r => r.year === y);
  if (train.length < 20 || test.length < 5) continue;
  const m = olsXY(train);
  cv.push({ year: y, train_n: train.length, ...evalPred(test, r => m.intercept + m.slope * r.sprint),
    slope: m.slope, intercept: m.intercept });
}

// Adjacent-year repeatability after player-season collapse.
const byPlayer = new Map();
for (const r of feResiduals) { if (!byPlayer.has(r.player_key)) byPlayer.set(r.player_key, []); byPlayer.get(r.player_key).push(r); }
const adjacent = { t90: [], sprint: [], residual: [] };
for (const a0 of byPlayer.values()) {
  const a = [...a0].sort((x, y) => x.year - y.year);
  for (let i = 0; i < a.length - 1; i++) if (a[i + 1].year === a[i].year + 1) {
    adjacent.t90.push([a[i].t90, a[i + 1].t90]);
    adjacent.sprint.push([a[i].sprint, a[i + 1].sprint]);
    adjacent.residual.push([a[i].residual, a[i + 1].residual]);
  }
}

const splitProfile = {};
for (const d of [10, 30, 60]) {
  const k = `t${d}`;
  const a = all.filter(r => Number.isFinite(r[k]));
  splitProfile[d] = {
    n: a.length,
    mean_sec: mean(a.map(r => r[k])),
    r_with_t90: corrPairs(a.map(r => [r[k], r.t90])),
    r_with_sprint_speed: corrPairs(a.map(r => [r[k], r.sprint])),
  };
}

const out = {
  generated_at: new Date().toISOString(),
  source: 'Baseball Savant public CSV: 90ft Running Splits + Sprint Speed',
  seasons: years,
  n_player_seasons: all.length,
  design: {
    target: 'T90 seconds (standardized 90ft running split)',
    predictor: 'Sprint Speed ft/s',
    switch_hitter_collapse: 'competitive-run weighted mean when weight is available',
    excluded: 'fastest home-to-first is not used',
  },
  diagnostics,
  by_year: yearStats,
  pooled_raw_model: { ...pooled, evaluation: pooledEval },
  pooled_year_trend_model: trendModel ? { ...trendModel, evaluation: trendEval } : null,
  within_year_fixed_effect_sprint_slope: betaFE,
  leave_one_year_out: cv,
  adjacent_year_repeatability: {
    n_pairs: adjacent.t90.length,
    t90_r: corrPairs(adjacent.t90),
    sprint_speed_r: corrPairs(adjacent.sprint),
    t90_residual_after_sprint_yearFE_r: corrPairs(adjacent.residual),
  },
  split_profile: splitProfile,
  interpretation_guardrail: 'Do not directly convert Sprint Speed to the final 1-100 rating. First estimate T90, then map T90 through the NPB reference CDF.',
};

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`T90 bridge calibration: ${all.length} matched player-seasons, ${years[0]}-${years.at(-1)}`);
console.log(`  pooled: T90 = ${pooled.intercept.toFixed(4)} + ${pooled.slope.toFixed(4)} * SprintSpeed`);
console.log(`  pooled r=${pooledEval.r?.toFixed(3)} MAE=${pooledEval.mae?.toFixed(3)}s RMSE=${pooledEval.rmse?.toFixed(3)}s`);
console.log(`  within-year slope=${betaFE?.toFixed(4)} sec/(ft/s)`);
console.log(`  adjacent-year: T90 r=${out.adjacent_year_repeatability.t90_r?.toFixed(3)}, Sprint r=${out.adjacent_year_repeatability.sprint_speed_r?.toFixed(3)}, residual r=${out.adjacent_year_repeatability.t90_residual_after_sprint_yearFE_r?.toFixed(3)}`);
console.log(`  -> ${path.relative(ROOT, OUT)}`);

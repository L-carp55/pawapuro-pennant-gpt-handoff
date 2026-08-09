// Calibrate a physical 30m sprint time -> Statcast-style T90 bridge.
//
// Why:
//   30m = 98.4252 ft, only 8.4252 ft longer than T90's 90 ft.
//   Baseball Savant Running Splits provide T85 and T90, so the observed final-5ft
//   velocity can estimate the extra 8.4252ft needed to reach 30m without inventing
//   a fixed "subtract 0.3 sec" rule.
//
// Input:
//   data/raw/statcast_running/running_splits_YYYY.csv
// Output:
//   outputs/derived/sprint30_to_t90_calibration.json
//
// Important:
//   This calibrates DISTANCE conversion only. A reported NPB 30m test may use a
//   different start protocol/timing gate/surface, so its protocol class must still
//   be accounted for before treating it as a Tier-B T90 measurement.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(ROOT, 'data', 'raw', 'statcast_running');
const OUT = path.join(ROOT, 'outputs', 'derived', 'sprint30_to_t90_calibration.json');
const FT_30M = 30 / 0.3048; // 98.42519685 ft
const EXTRA_FT = FT_30M - 90;

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
  if (!rows.length) return [];
  const headers = rows[0].map(x => x.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).filter(r => r.some(x => String(x ?? '').trim() !== '')).map(r =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

const finite = v => Number.isFinite(v);
const num = v => { const n = Number(String(v ?? '').trim()); return finite(n) ? n : null; };
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const quantile = (a, p) => {
  const s = a.filter(finite).sort((x, y) => x - y);
  if (!s.length) return null;
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i), f = i - lo;
  return s[lo] * (1 - f) + s[hi] * f;
};
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

function ols(rows, xKey, yKey) {
  const a = rows.filter(r => finite(r[xKey]) && finite(r[yKey]));
  const mx = mean(a.map(r => r[xKey])), my = mean(a.map(r => r[yKey]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const r of a) {
    const dx = r[xKey] - mx, dy = r[yKey] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const slope = sxx > 0 ? sxy / sxx : null;
  const intercept = slope == null ? null : my - slope * mx;
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  const pred = a.map(q => intercept + slope * q[xKey]);
  const err = a.map((q, i) => pred[i] - q[yKey]);
  return {
    n: a.length, intercept, slope, r, r2: r == null ? null : r * r,
    mae: mean(err.map(Math.abs)), rmse: Math.sqrt(mean(err.map(e => e * e))),
  };
}

const files = (await readdir(IN)).filter(f => /^running_splits_20\d\d\.csv$/.test(f)).sort();
if (!files.length) throw new Error(`No running_splits_YYYY.csv in ${path.relative(ROOT, IN)}`);

const rows = [];
const bySeason = {};
for (const file of files) {
  const season = Number(file.match(/(20\d\d)/)[1]);
  const src = parseCsv(await readFile(path.join(IN, file), 'utf8'));
  let used = 0;
  for (const r of src) {
    const t85 = num(r.time_at_85ft), t90 = num(r.time_at_90ft);
    if (!(t85 >= 0) || !(t90 > t85)) continue;
    const dt5 = t90 - t85;
    const lateFps = 5 / dt5;
    // Extrapolate the final 8.425ft to 30m at observed 85-90ft average speed.
    const extraSec = EXTRA_FT / lateFps;
    const t30mEstimate = t90 + extraSec;
    rows.push({ season, t85, t90, late_fps: lateFps, extra_sec_90ft_to_30m: extraSec, t30m_est: t30mEstimate });
    used++;
  }
  bySeason[season] = { rows: src.length, usable: used };
}

if (rows.length < 20) throw new Error(`Only ${rows.length} usable rows; expected Savant T85/T90 columns`);

const extra = rows.map(r => r.extra_sec_90ft_to_30m);
const late = rows.map(r => r.late_fps);
const model = ols(rows, 't30m_est', 't90');

// Does the correction vary systematically with T90? This lets callers decide whether a fixed
// correction is adequate or a T30-dependent bridge is required.
const deltaOnT90 = ols(rows, 't90', 'extra_sec_90ft_to_30m');

// Approximate leave-one-out error for simple OLS without refitting N times using leverage formula.
// For 1D OLS h_ii = 1/n + (x_i-xbar)^2/Sxx; LOO residual = e_i/(1-h_ii).
const mx = mean(rows.map(r => r.t30m_est));
const sxx = rows.reduce((s, r) => s + (r.t30m_est - mx) ** 2, 0);
const looErr = [];
for (const r of rows) {
  const p = model.intercept + model.slope * r.t30m_est;
  const e = r.t90 - p;
  const h = 1 / rows.length + (sxx > 0 ? (r.t30m_est - mx) ** 2 / sxx : 0);
  looErr.push(e / Math.max(1e-9, 1 - h));
}

const out = {
  generated_at: new Date().toISOString(),
  source: 'Baseball Savant 5ft Running Splits',
  seasons: Object.keys(bySeason).map(Number),
  n_rows: rows.length,
  geometry: {
    t90_distance_ft: 90,
    sprint30_distance_ft: FT_30M,
    extra_ft_after_t90: EXTRA_FT,
    method: 'Use observed 85-90ft average velocity to extrapolate the additional 8.4252ft to 30m.',
  },
  coverage_by_season: bySeason,
  final_5ft_speed_fps: {
    mean: mean(late), sd: sd(late),
    p05: quantile(late, .05), p25: quantile(late, .25), median: quantile(late, .5),
    p75: quantile(late, .75), p95: quantile(late, .95),
  },
  correction_30m_minus_t90_sec: {
    mean: mean(extra), sd: sd(extra),
    p05: quantile(extra, .05), p25: quantile(extra, .25), median: quantile(extra, .5),
    p75: quantile(extra, .75), p95: quantile(extra, .95),
  },
  t30m_est_to_t90_linear: {
    ...model,
    loo_mae: mean(looErr.map(Math.abs)),
    loo_rmse: Math.sqrt(mean(looErr.map(e => e * e))),
  },
  correction_dependence_on_t90: deltaOnT90,
  interpretation: [
    'This estimates the distance-only 30m↔90ft relation for baseball runners already near late-run speed.',
    'It does NOT remove timing-gate/start-protocol differences in published NPB 30m tests.',
    'Therefore team-reported 30m tests stay Tier D unless their protocol is shown compatible with the T90 definition.',
  ],
};

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`30m -> T90 calibration: ${rows.length} runner-side rows`);
console.log(`  correction median ${(out.correction_30m_minus_t90_sec.median).toFixed(3)}s (p05 ${(out.correction_30m_minus_t90_sec.p05).toFixed(3)} / p95 ${(out.correction_30m_minus_t90_sec.p95).toFixed(3)})`);
console.log(`  T90 = ${model.intercept.toFixed(4)} + ${model.slope.toFixed(4)} * T30m_est; LOO MAE=${out.t30m_est_to_t90_linear.loo_mae.toFixed(4)}s`);
console.log(`  -> ${path.relative(ROOT, OUT)}`);

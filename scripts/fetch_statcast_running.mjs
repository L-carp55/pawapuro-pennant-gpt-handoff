// Download MLB Statcast running data used to calibrate the T90 speed model.
//
// IMPORTANT: this script does not run automatically.
// Before bulk acquisition, state the scale to the owner (project rule):
//   default 2017-current => 2 CSV files/year (90ft splits + sprint speed),
//   so ~20 files for 10 seasons.
//
// Sources are the same public Baseball Savant CSV endpoints used by pybaseball.
// Usage:
//   node scripts/fetch_statcast_running.mjs 2017 2026
// Optional env:
//   MIN_T90=5 MIN_SPRINT=10

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = Number(process.argv[2] ?? 2017);
const END = Number(process.argv[3] ?? new Date().getFullYear());
const MIN_T90 = Number(process.env.MIN_T90 ?? 5);
const MIN_SPRINT = Number(process.env.MIN_SPRINT ?? 10);

if (!Number.isInteger(START) || !Number.isInteger(END) || START > END) {
  throw new Error(`invalid season range: ${START}-${END}`);
}

const outDir = path.join(ROOT, 'data', 'raw', 'statcast_running');
await mkdir(outDir, { recursive: true });

const plans = [];
for (let year = START; year <= END; year++) {
  plans.push({
    year,
    kind: 'running_splits',
    file: `running_splits_${year}.csv`,
    url: `https://baseballsavant.mlb.com/running_splits?type=raw&bats=&year=${year}&position=&team=&min=${MIN_T90}&csv=true`,
  });
  plans.push({
    year,
    kind: 'sprint_speed',
    file: `sprint_speed_${year}.csv`,
    url: `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${year}&position=&team=&min=${MIN_SPRINT}&csv=true`,
  });
}

console.log(`Statcast running acquisition plan: ${START}-${END}`);
console.log(`  files: ${plans.length} (${END - START + 1} seasons × 2)`);
console.log(`  90ft min opportunities: ${MIN_T90}`);
console.log(`  sprint-speed min opportunities: ${MIN_SPRINT}`);
console.log(`  destination: ${path.relative(ROOT, outDir)}`);
console.log('');

const manifest = [];
for (const p of plans) {
  const res = await fetch(p.url, { headers: { 'user-agent': 'pawapuro-pennant-personal-research/1.0' } });
  if (!res.ok) throw new Error(`${p.kind} ${p.year}: HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes(',') || text.length < 100) throw new Error(`${p.kind} ${p.year}: response does not look like CSV`);
  const target = path.join(outDir, p.file);
  await writeFile(target, text, 'utf8');
  manifest.push({ season: p.year, kind: p.kind, file: p.file, bytes: Buffer.byteLength(text), source_url: p.url });
  console.log(`  saved ${p.file} (${Buffer.byteLength(text).toLocaleString()} bytes)`);
}

await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({
  retrieved_at: new Date().toISOString(),
  start_season: START,
  end_season: END,
  min_t90_opportunities: MIN_T90,
  min_sprint_opportunities: MIN_SPRINT,
  files: manifest,
}, null, 2), 'utf8');

console.log(`\nDone: ${manifest.length} files + manifest.json`);

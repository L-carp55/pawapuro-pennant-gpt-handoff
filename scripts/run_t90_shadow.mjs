// Shadow-run the redesigned T90 speed appraisal without changing live card output.
//
// Usage:
//   node scripts/run_t90_shadow.mjs 2024 30
//
// It intentionally tolerates uncalibrated models and an unfrozen NPB reference CDF:
// status fields show exactly why each player cannot yet receive a T90/rating.

import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTargetSpeedEvidence } from '../src/ratings/speed_evidence.mjs';
import { appraiseSpeedT90 } from '../src/ratings/speed_appraisal.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const MIN_PA = Number(process.argv[3] || 30);
const J = async p => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));
const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

const modelCfg = await J('configs/speed_t90_models.json');
const temporalCfg = await J('configs/speed_t90_temporal.json');
const sprint30 = await J('data/manual/sprint_30m_measurements_curated.json');
const hp1b = await J('data/manual/hp_to_1b_measurements_curated.json');

let reference = [];
for (const p of ['outputs/derived/t90_npb_reference.json', 'configs/t90_npb_reference.json']) {
  const abs = path.join(ROOT, p);
  if (!existsSync(abs)) continue;
  const j = await J(p);
  reference = Array.isArray(j) ? j : (j.t90_sec ?? j.reference_times ?? []);
  break;
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const players = db.prepare(`
  SELECT player_id, name, team, pa, ab, h, b2, b3, hr, so, gdp
  FROM v_batting
  WHERE season=? AND position<>'投' AND pa>=?
  ORDER BY pa DESC`).all(SEASON, MIN_PA);

const plusRows = db.prepare(`SELECT * FROM npb_plus_measurement`).all();
const plusMap = new Map(plusRows.map(r => [norm(r.name), r]));
const mlbRows = db.prepare(`SELECT * FROM mlb_bridge`).all();
const mlbMap = new Map(mlbRows.map(r => [norm(r.npb_name), r]));

// Tier-E proxy raw evidence. These are features only; they cannot produce T90 unless a calibrated proxy model is enabled.
const nf3Rows = db.prepare(`SELECT name_norm, bats, ab, ih FROM nf3_team_bat WHERE season=?`).all(SEASON);
const nf3Map = new Map(nf3Rows.map(r => [norm(r.name_norm), r]));

const out = [];
for (const p of players) {
  const k = norm(p.name);
  const nf3 = nf3Map.get(k);
  const inplay = Math.max(1, p.ab - p.so);
  const proxy = {};
  if (nf3 && Number.isFinite(nf3.ih)) proxy.infield_hit_rate = nf3.ih / inplay;
  // GDP avoidance here is intentionally raw/simple; final proxy calibration decides exact normalization.
  if (Number.isFinite(p.gdp)) proxy.gdp_avoid = -p.gdp / inplay;

  const built = buildTargetSpeedEvidence({
    targetSeason: SEASON,
    playerName: p.name,
    mlbBridgeRow: mlbMap.get(k) ?? null,
    npbPlusRow: plusMap.get(k) ?? null,
    sprint30Records: sprint30.records ?? [],
    hp1bRecords: hp1b.records ?? [],
    temporalConfig: temporalCfg,
    proxyEvidence: proxy,
  });
  const app = appraiseSpeedT90(built.evidence, modelCfg, reference);
  out.push({
    player_id: p.player_id,
    name: p.name,
    team: p.team,
    season: SEASON,
    pa: p.pa,
    status: app.status,
    t90_sec: app.t90_sec,
    speed_rating: app.rating,
    tier: app.tier,
    source: app.source,
    unresolved: app.unresolved ?? null,
    evidence_keys: Object.keys(built.evidence),
    provenance: built.provenance,
  });
}

db.close();

const statusCount = {};
for (const r of out) statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;
const evidenceCount = {};
for (const r of out) for (const k of r.evidence_keys) evidenceCount[k] = (evidenceCount[k] ?? 0) + 1;

console.log(`=== T90 shadow ${SEASON} PA>=${MIN_PA} (${out.length} players) ===`);
console.log('status:', statusCount);
console.log('evidence:', evidenceCount);
console.log(`reference T90 count: ${reference.length}`);

const withT90 = out.filter(r => Number.isFinite(r.t90_sec));
if (withT90.length) {
  console.log('\nT90 available (shadow only):');
  for (const r of withT90.slice(0, 20)) console.log(`  ${r.name}: ${r.t90_sec.toFixed(3)}s / ${r.speed_rating ?? 'rating pending'} / ${r.source}`);
}

await mkdir(path.join(ROOT, 'outputs', 'derived'), { recursive: true });
const dest = path.join(ROOT, 'outputs', 'derived', `t90_shadow_${SEASON}.json`);
await writeFile(dest, JSON.stringify({
  generated_at: new Date().toISOString(), season: SEASON, min_pa: MIN_PA,
  reference_count: reference.length, status_count: statusCount, evidence_count: evidenceCount, players: out,
}, null, 2), 'utf8');
console.log(`\n-> ${path.relative(ROOT, dest)}`);
console.log('NOTE: this script never changes live card ratings.');

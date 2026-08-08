// Audit readiness for switching the live speed appraisal from legacy speedComponents() to T90.
//
// This is a coverage/readiness audit, NOT a calibration script.
// It answers:
//   - how many NPB players have physical evidence (NPB+, MLB Sprint, curated 30m),
//   - how many only have contextual H->1 evidence,
//   - whether any T90 bridge model is actually enabled,
//   - whether the NPB reference CDF exists,
//   - which legacy migration blockers remain.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const J = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

const modelCfg = J('configs/speed_t90_models.json');
const sprint30 = J('data/manual/sprint_30m_measurements_curated.json');
const hp1b = J('data/manual/hp_to_1b_measurements_curated.json');

const npbPlus = db.prepare(`SELECT name, top_speed_kmh, hp_to_1b_sec FROM npb_plus_measurement`).all();
const mlb = db.prepare(`SELECT npb_name, sprint_speed_avg, detail FROM mlb_bridge`).all();

const npbTopNames = new Set(npbPlus.filter(r => Number.isFinite(r.top_speed_kmh)).map(r => norm(r.name)));
const mlbSprintNames = new Set(mlb.filter(r => Number.isFinite(r.sprint_speed_avg)).map(r => norm(r.npb_name)));
const sprint30Names = new Set((sprint30.records ?? []).filter(r => Number.isFinite(r.seconds_30m)).map(r => norm(r.player)));
const hp1bNormalNames = new Set((hp1b.records ?? [])
  .filter(r => r.condition_class === 'normal_swing' && r.speed_use === 'tier_c_contextual')
  .map(r => norm(r.player)));

const physicalNames = new Set([...npbTopNames, ...mlbSprintNames, ...sprint30Names]);
const anyEvidenceNames = new Set([...physicalNames, ...hp1bNormalNames]);

function coverage(season, minPa) {
  const rows = db.prepare(`
    SELECT name, pa FROM v_batting
    WHERE season=? AND position<>'投' AND pa>=?`).all(season, minPa);
  let npbp=0, mlbs=0, m30=0, phys=0, h1=0, any=0;
  for (const r of rows) {
    const k = norm(r.name);
    if (npbTopNames.has(k)) npbp++;
    if (mlbSprintNames.has(k)) mlbs++;
    if (sprint30Names.has(k)) m30++;
    if (physicalNames.has(k)) phys++;
    if (hp1bNormalNames.has(k)) h1++;
    if (anyEvidenceNames.has(k)) any++;
  }
  return {
    season, min_pa: minPa, players: rows.length,
    npb_plus_top_speed: npbp,
    mlb_sprint_speed: mlbs,
    curated_30m: m30,
    any_physical_evidence: phys,
    physical_coverage_pct: rows.length ? phys / rows.length * 100 : null,
    normal_hp1b_contextual: h1,
    any_tier_a_to_d_evidence: any,
    any_evidence_coverage_pct: rows.length ? any / rows.length * 100 : null,
  };
}

const modelStates = Object.fromEntries(Object.entries(modelCfg.models ?? {}).map(([k,v]) => [k, {
  enabled: v.enabled === true,
  status: v.status ?? null,
  coefficients_complete: (() => {
    if (v.coefficients) return Object.values(v.coefficients).length > 0 && Object.values(v.coefficients).every(Number.isFinite) && Number.isFinite(v.intercept);
    if ('slope' in v) return Number.isFinite(v.slope) && Number.isFinite(v.intercept);
    return false;
  })(),
}]));
const enabledModels = Object.entries(modelStates).filter(([,v]) => v.enabled).map(([k]) => k);

const refCandidates = [
  'outputs/derived/t90_npb_reference.json',
  'configs/t90_npb_reference.json',
];
const referencePath = refCandidates.find(p => existsSync(path.join(ROOT, p))) ?? null;

const blockers = [];
if (!enabledModels.length) blockers.push('T90 bridge modelが1つもenabledではない（意図どおり。本番切替不可）');
if (!referencePath) blockers.push('NPB reference T90 CDFが未凍結（走力1-100への変換不可）');
blockers.push('src/ratings/running.mjs の legacy speedComponents() が本番経路で有効');
blockers.push('src/cards/durable_estimate.mjs が legacy speedComponents() を前後±3年でプール');
blockers.push('src/cards/pipeline.mjs が単年sc.scoreを盗塁/走塁/内野安打/守備残差へ渡し、表示走力はdurable.speedを使うため基礎走力が二重状態');
blockers.push('src/ratings/direct_measurement.mjs の MLB/NPB+ direct speed -> Pawapuro-scale rating 経路が残る');
blockers.push('ability_sheet.mjs / ratings.json の legacy speed scale calibration を本番切替時に無効化する必要');

const out = {
  generated_at: new Date().toISOString(),
  physical_source_counts: {
    npb_plus_top_speed_unique: npbTopNames.size,
    mlb_sprint_speed_unique: mlbSprintNames.size,
    curated_30m_unique: sprint30Names.size,
    union_physical_unique: physicalNames.size,
    contextual_normal_hp1b_unique: hp1bNormalNames.size,
  },
  coverage_2024: [30,100,200,300].map(pa => coverage(2024, pa)),
  models: modelStates,
  enabled_models: enabledModels,
  npb_reference: { frozen: !!referencePath, path: referencePath },
  live_switch_ready: enabledModels.length > 0 && !!referencePath && blockers.length === 0,
  blockers,
  verdict: 'T90 foundation/evidence collection may proceed, but live speed output must remain legacy until bridge + NPB reference are frozen and all blockers are removed.',
};

console.log('=== T90 migration readiness ===');
console.log(`NPB+ top speed: ${out.physical_source_counts.npb_plus_top_speed_unique}`);
console.log(`MLB Sprint: ${out.physical_source_counts.mlb_sprint_speed_unique}`);
console.log(`curated 30m: ${out.physical_source_counts.curated_30m_unique}`);
for (const c of out.coverage_2024) {
  console.log(`2024 PA>=${c.min_pa}: ${c.any_physical_evidence}/${c.players} physical (${c.physical_coverage_pct.toFixed(1)}%)`);
}
console.log(`enabled T90 models: ${enabledModels.length ? enabledModels.join(', ') : 'none'}`);
console.log(`NPB reference CDF: ${referencePath ?? 'not frozen'}`);
console.log('\nBlockers:');
for (const b of blockers) console.log(` - ${b}`);
console.log(`\nLIVE SWITCH: ${out.live_switch_ready ? 'READY' : 'NOT READY'}`);

db.close();

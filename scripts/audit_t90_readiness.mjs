// Audit readiness for switching the live speed appraisal from legacy speedComponents() to T90.
//
// This is a coverage/readiness audit, NOT a calibration script.
// It explicitly separates:
//   (a) physical evidence that exists somewhere in a player's history, from
//   (b) physical evidence close enough to the target season to be auto-usable now.
//
// A historical 2018 30m test must not make a 2024 player look "covered" unless an age/trajectory
// model exists. Single-event normal H->1 is QA/context only and never counts as physical coverage.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMlbSprintEvidence, buildNpbPlusEvidence, buildSprint30Evidence, contextualHp1bQa,
} from '../src/ratings/speed_evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const J = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

const modelCfg = J('configs/speed_t90_models.json');
const temporalCfg = J('configs/speed_t90_temporal.json');
const sprint30 = J('data/manual/sprint_30m_measurements_curated.json');
const hp1b = J('data/manual/hp_to_1b_measurements_curated.json');

const npbPlusRows = db.prepare(`SELECT * FROM npb_plus_measurement`).all();
const mlbRows = db.prepare(`SELECT * FROM mlb_bridge`).all();
const npbPlusMap = new Map(npbPlusRows.map(r => [norm(r.name), r]));
const mlbMap = new Map(mlbRows.map(r => [norm(r.npb_name), r]));

// History-level source presence: useful for provenance, NOT the target-season coverage denominator.
const historyNames = {
  npb_plus: new Set(npbPlusRows.filter(r => Number.isFinite(r.top_speed_kmh)).map(r => norm(r.name))),
  mlb_sprint: new Set(mlbRows.filter(r => Number.isFinite(r.sprint_speed_avg)).map(r => norm(r.npb_name))),
  sprint30: new Set((sprint30.records ?? []).filter(r => Number.isFinite(r.seconds_30m)).map(r => norm(r.player))),
  normal_hp1b_qa: new Set((hp1b.records ?? [])
    .filter(r => r.condition_class === 'normal_swing' && r.speed_use === 'tier_c_contextual')
    .map(r => norm(r.player))),
};
const physicalHistoryNames = new Set([...historyNames.npb_plus, ...historyNames.mlb_sprint, ...historyNames.sprint30]);

function sourceState(name, season) {
  const k = norm(name);
  // Numerical time-gap variance is metric/unit specific. Never fall back NPB km/h or 30m seconds
  // to MLB Sprint Speed's ft/s variance merely because the target-year gap is the same.
  const mlb = buildMlbSprintEvidence(mlbMap.get(k) ?? null, season,
    temporalCfg?.mlb_sprint_speed ?? null);
  const npb = buildNpbPlusEvidence(npbPlusMap.get(k) ?? null, season,
    temporalCfg?.npb_plus_top_speed ?? null);
  const m30 = buildSprint30Evidence(sprint30.records ?? [], name, season,
    temporalCfg?.sprint30 ?? null);
  const qa = contextualHp1bQa(hp1b.records ?? [], name, season);

  const autoSources = {
    npb_plus: Object.prototype.hasOwnProperty.call(npb.evidence, 'npb_plus_top_speed_kmh'),
    mlb_sprint: Object.prototype.hasOwnProperty.call(mlb.evidence, 'mlb_sprint_speed_ftps'),
    sprint30: Object.prototype.hasOwnProperty.call(m30.evidence, 'sprint_30m_sec'),
  };
  const autoPhysical = Object.values(autoSources).some(Boolean);

  return {
    autoSources,
    autoPhysical,
    normalHp1bQa: qa.some(x => x.condition_class === 'normal_swing'),
    physicalHistory: physicalHistoryNames.has(k),
    historicalOnly: {
      npb_plus: !!npb.metadata?.historical_only,
      mlb_sprint: !!mlb.metadata?.historical_only,
      sprint30: !!m30.metadata?.historical_only,
    },
  };
}

function coverage(season, minPa) {
  const rows = db.prepare(`
    SELECT name, pa FROM v_batting
    WHERE season=? AND position<>'投' AND pa>=?`).all(season, minPa);

  const c = {
    target_season: season,
    min_pa: minPa,
    players: rows.length,
    auto_usable: { npb_plus: 0, mlb_sprint: 0, sprint30: 0, any_physical: 0 },
    physical_history_any_year: 0,
    physical_history_but_not_auto_usable: 0,
    same_season_normal_hp1b_qa: 0,
  };

  for (const r of rows) {
    const s = sourceState(r.name, season);
    for (const k of ['npb_plus', 'mlb_sprint', 'sprint30']) if (s.autoSources[k]) c.auto_usable[k]++;
    if (s.autoPhysical) c.auto_usable.any_physical++;
    if (s.physicalHistory) c.physical_history_any_year++;
    if (s.physicalHistory && !s.autoPhysical) c.physical_history_but_not_auto_usable++;
    if (s.normalHp1bQa) c.same_season_normal_hp1b_qa++;
  }

  c.auto_usable.physical_coverage_pct = rows.length ? c.auto_usable.any_physical / rows.length * 100 : null;
  c.physical_history_coverage_pct = rows.length ? c.physical_history_any_year / rows.length * 100 : null;
  return c;
}

const modelStates = Object.fromEntries(Object.entries(modelCfg.models ?? {}).map(([k,v]) => [k, {
  enabled: v.enabled === true,
  status: v.status ?? null,
  coefficients_complete: (() => {
    if (v.coefficients) return Object.values(v.coefficients).length > 0
      && Object.values(v.coefficients).every(Number.isFinite) && Number.isFinite(v.intercept);
    if ('slope' in v) return Number.isFinite(v.slope) && Number.isFinite(v.intercept);
    return false;
  })(),
}]));
const enabledModels = Object.entries(modelStates).filter(([,v]) => v.enabled).map(([k]) => k);
const incompleteEnabledModels = Object.entries(modelStates)
  .filter(([,v]) => v.enabled && !v.coefficients_complete).map(([k]) => k);

const refCandidates = [
  'outputs/derived/t90_npb_reference.json',
  'configs/t90_npb_reference.json',
];
const referencePath = refCandidates.find(p => existsSync(path.join(ROOT, p))) ?? null;

const blockers = [];
if (!enabledModels.length) blockers.push('T90 bridge modelが1つもenabledではない（意図どおり。本番切替不可）');
if (incompleteEnabledModels.length) blockers.push(`enabledなのに係数不完全: ${incompleteEnabledModels.join(', ')}`);
if (!referencePath) blockers.push('NPB reference T90 CDFが未凍結（走力1-100への変換不可）');
blockers.push('src/ratings/running.mjs の legacy speedComponents() が本番経路で有効');
blockers.push('src/cards/durable_estimate.mjs が legacy speedComponents() を前後±3年でプール');
blockers.push('src/cards/pipeline.mjs が単年sc.scoreを盗塁/走塁/内野安打/守備残差へ渡し、表示走力はdurable.speedを使うため基礎走力が二重状態');
blockers.push('src/ratings/direct_measurement.mjs の MLB/NPB+ direct speed -> Pawapuro-scale rating 経路が残る');
blockers.push('ability_sheet.mjs / ratings.json の legacy speed scale calibration を本番切替時に無効化する必要');

const coverage2024 = [30,100,200,300].map(pa => coverage(2024, pa));
const out = {
  generated_at: new Date().toISOString(),
  physical_source_counts_all_history: {
    npb_plus_top_speed_unique: historyNames.npb_plus.size,
    mlb_sprint_speed_unique: historyNames.mlb_sprint.size,
    curated_30m_unique: historyNames.sprint30.size,
    union_physical_unique: physicalHistoryNames.size,
    contextual_normal_hp1b_qa_unique: historyNames.normal_hp1b_qa.size,
  },
  coverage_2024: coverage2024,
  coverage_definition: {
    auto_usable_physical: '対象年から4年以内のNPB+/MLB/30m身体測定。5年以上・測定年不明は除外。',
    physical_history: '年代を問わず物理測定が存在すること。自動T90入力可能とは限らない。',
    normal_hp1b: '同年の通常スイング単発H->1。QAのみで物理被覆に含めない。',
    temporal_numeric_uncertainty: 'MLB Sprint / NPB+ / 30mごとに別較正。単位の違う変動SDを流用しない。',
  },
  models: modelStates,
  enabled_models: enabledModels,
  npb_reference: { frozen: !!referencePath, path: referencePath },
  live_switch_ready: blockers.length === 0,
  blockers,
  verdict: 'T90 foundation/evidence collection may proceed, but live speed output must remain legacy until bridge + NPB reference are frozen and all blockers are removed.',
};

console.log('=== T90 migration readiness ===');
console.log(`history: NPB+ ${historyNames.npb_plus.size} / MLB Sprint ${historyNames.mlb_sprint.size} / curated 30m ${historyNames.sprint30.size}`);
for (const c of coverage2024) {
  console.log(`2024 PA>=${c.min_pa}: auto-usable physical ${c.auto_usable.any_physical}/${c.players} (${c.auto_usable.physical_coverage_pct.toFixed(1)}%)`
    + ` / any-year physical history ${c.physical_history_any_year}/${c.players}`
    + ` / history-only ${c.physical_history_but_not_auto_usable}`);
}
console.log(`enabled T90 models: ${enabledModels.length ? enabledModels.join(', ') : 'none'}`);
console.log(`NPB reference CDF: ${referencePath ?? 'not frozen'}`);
console.log('\nBlockers:');
for (const b of blockers) console.log(` - ${b}`);
console.log(`\nLIVE SWITCH: ${out.live_switch_ready ? 'READY' : 'NOT READY'}`);

db.close();

// Build a CANDIDATE weighted NPB T90 reference distribution from shadow outputs.
//
// This script NEVER writes the live/frozen reference file. It exists to expose completeness,
// tier/source mix, and the candidate CDF while freeze guards are still unmet.
//
// Required inputs:
//   outputs/derived/t90_shadow_YYYY.json for all policy seasons
//   data/pennant.db
//
// Output:
//   outputs/derived/t90_npb_reference_candidate.json

import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLICY = JSON.parse(await readFile(path.join(ROOT, 'configs', 'speed_t90_reference_policy.json'), 'utf8'));
const OUT = path.join(ROOT, 'outputs', 'derived', 't90_npb_reference_candidate.json');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const seasons = POLICY.population?.seasons ?? [];
const nSeasons = seasons.length;
if (!nSeasons) throw new Error('speed_t90_reference_policy: population.seasons is empty');

const basePa = POLICY.population.eligibility.base_min_pa_at_143_games;
const games = POLICY.population.eligibility.season_games;
const minPaFor = season => basePa * Number(games[String(season)]) / 143;

const seasonResults = [];
const entries = [];
let totalEligible = 0, totalMissing = 0, totalUncertaintyMissing = 0;
const sourceMix = {}, tierMix = {};

for (const season of seasons) {
  const minPa = minPaFor(season);
  if (!(minPa > 0)) throw new Error(`No valid season_games for ${season}`);

  const eligible = db.prepare(`
    SELECT player_id, name, team, pa
    FROM v_batting
    WHERE season=? AND position<>'投' AND pa>=?
    ORDER BY player_id`).all(season, minPa);
  totalEligible += eligible.length;

  const shadowPath = path.join(ROOT, 'outputs', 'derived', `t90_shadow_${season}.json`);
  if (!existsSync(shadowPath)) {
    seasonResults.push({
      season, team_games: games[String(season)], min_pa: minPa,
      eligible: eligible.length, shadow_exists: false,
      t90_present: 0, t90_missing: eligible.length, uncertainty_present: 0,
      coverage: 0, missing_players: eligible.map(x => ({player_id:x.player_id,name:x.name,team:x.team,pa:x.pa})),
    });
    totalMissing += eligible.length;
    totalUncertaintyMissing += eligible.length;
    continue;
  }

  const shadow = JSON.parse(await readFile(shadowPath, 'utf8'));
  const byId = new Map((shadow.players ?? []).map(x => [String(x.player_id), x]));
  const present = [], missing = [];
  let uncertaintyPresent = 0;

  for (const p of eligible) {
    const s = byId.get(String(p.player_id));
    if (!s || !Number.isFinite(s.t90_sec)) {
      missing.push({ player_id:p.player_id, name:p.name, team:p.team, pa:p.pa,
        shadow_status:s?.status ?? 'MISSING_FROM_SHADOW', unresolved:s?.unresolved ?? null });
      continue;
    }
    // Future shadow format should provide t90_sd_sec or posterior summary.
    const sd = Number.isFinite(s.t90_sd_sec) ? s.t90_sd_sec : null;
    if (sd != null) uncertaintyPresent++;
    present.push({ ...p, t90_sec:s.t90_sec, t90_sd_sec:sd, tier:s.tier ?? null, source:s.source ?? null, status:s.status ?? null });
    sourceMix[s.source ?? 'unknown'] = (sourceMix[s.source ?? 'unknown'] ?? 0) + 1;
    tierMix[s.tier ?? 'unknown'] = (tierMix[s.tier ?? 'unknown'] ?? 0) + 1;
  }

  totalMissing += missing.length;
  totalUncertaintyMissing += eligible.length - uncertaintyPresent;

  // Equal total mass per season; equal weight inside season.
  const w = present.length ? 1 / (nSeasons * present.length) : null;
  for (const p of present) entries.push({
    season, player_id:p.player_id, name:p.name, team:p.team, pa:p.pa,
    t90_sec:p.t90_sec, t90_sd_sec:p.t90_sd_sec,
    tier:p.tier, source:p.source,
    weight:w,
  });

  seasonResults.push({
    season, team_games: games[String(season)], min_pa: minPa,
    eligible: eligible.length, shadow_exists: true,
    t90_present: present.length, t90_missing: missing.length,
    uncertainty_present: uncertaintyPresent,
    uncertainty_missing: eligible.length - uncertaintyPresent,
    coverage: eligible.length ? present.length / eligible.length : null,
    candidate_season_total_weight: w == null ? 0 : w * present.length,
    missing_players: missing,
  });
}

db.close();

const requireAll = POLICY.freeze_gate.require_all_eligible_player_seasons_have_t90 === true;
const requireUncertainty = POLICY.freeze_gate.require_t90_uncertainty === true;
const allT90 = totalMissing === 0;
const allUncertainty = totalUncertaintyMissing === 0;
const freezeEligible = (!requireAll || allT90) && (!requireUncertainty || allUncertainty);

const totalWeight = entries.reduce((s,x)=>s+(x.weight ?? 0),0);
const out = {
  generated_at: new Date().toISOString(),
  status: freezeEligible ? 'CANDIDATE_PASSES_DATA_GATES_NOT_FROZEN' : 'CANDIDATE_INCOMPLETE_NOT_FROZEN',
  policy_file: 'configs/speed_t90_reference_policy.json',
  explicit_warning: 'THIS IS NOT THE LIVE/FROZEN NPB T90 REFERENCE.',
  seasons,
  totals: {
    eligible_player_seasons: totalEligible,
    t90_present: totalEligible - totalMissing,
    t90_missing: totalMissing,
    uncertainty_present: totalEligible - totalUncertaintyMissing,
    uncertainty_missing: totalUncertaintyMissing,
    candidate_entries: entries.length,
    candidate_weight_sum: totalWeight,
  },
  freeze_gate: {
    require_all_t90: requireAll,
    require_uncertainty: requireUncertainty,
    all_t90_present: allT90,
    all_uncertainty_present: allUncertainty,
    passes_data_gates: freezeEligible,
    live_reference_written: false,
  },
  source_mix: sourceMix,
  tier_mix: tierMix,
  by_season: seasonResults,
  reference_entries: entries,
};

await mkdir(path.dirname(OUT), {recursive:true});
await writeFile(OUT, JSON.stringify(out,null,2),'utf8');

console.log('=== NPB T90 reference candidate ===');
for (const s of seasonResults) {
  console.log(`${s.season}: minPA=${s.min_pa.toFixed(1)} eligible=${s.eligible} T90=${s.t90_present}/${s.eligible}`
    + ` uncertainty=${s.uncertainty_present}/${s.eligible} seasonWeight=${s.candidate_season_total_weight.toFixed(3)}`);
}
console.log(`total: T90 ${out.totals.t90_present}/${totalEligible}; uncertainty ${out.totals.uncertainty_present}/${totalEligible}; weight=${totalWeight.toFixed(6)}`);
console.log(`freeze data gate: ${freezeEligible ? 'PASS (still candidate only)' : 'FAIL'}`);
console.log(`-> ${path.relative(ROOT,OUT)}`);

// SP-100 owner-approved 2026 production wiring.
//
// NPB+ top speed is a current-season maximum statistic. This module builds
// its relative N estimate from the fixed current-100 cohort without assigning
// a numeric generic reliability, applying opportunity shrinkage, or blending
// it with the earlier statistical S lane. It intentionally returns null for
// every non-2026 appraisal so the 2026 observation cannot leak backwards.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNpbPlusMeasurements, npbPlusReliability } from './npb_plus_provenance.mjs';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TARGET_SEASON = 2026;
const TARGET_COHORT_SIZE = 100;
const norm = value => String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const populationSd = (values, average) => Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);

function readCurrentCohort(root) {
  const file = path.join(root, 'outputs', 'derived', 'npb_plus_sprint_exposure_2026.json');
  const source = JSON.parse(readFileSync(file, 'utf8'));
  const roster = Array.isArray(source) ? source : (source.players ?? source.rows ?? null);
  if (!Array.isArray(roster) || roster.length !== TARGET_COHORT_SIZE) {
    throw new Error(`[SP-100 N primary fail-closed] current target cohort must contain exactly ${TARGET_COHORT_SIZE} rows`);
  }

  const latent = JSON.parse(readFileSync(path.join(root, 'outputs', 'derived', 'sp100_npb_raw_latent_speed.json'), 'utf8'));
  if (latent.n_players !== TARGET_COHORT_SIZE || !Array.isArray(latent.players) || latent.players.length !== TARGET_COHORT_SIZE
    || latent.inputs?.hp_to_1b_sec_used !== 0
    || latent.measurement_reliability?.verdict !== 'NOT_IDENTIFIABLE'
    || latent.exposure_proxy?.applied_to_z !== false) {
    throw new Error('[SP-100 N primary fail-closed] frozen raw SP-100 artifact is not the valid top-speed-only 100-player input');
  }
  const latentByName = new Map(latent.players.map(row => [norm(row.player), row]));
  if (latentByName.size !== TARGET_COHORT_SIZE) {
    throw new Error('[SP-100 N primary fail-closed] frozen raw SP-100 artifact has duplicate normalized player names');
  }
  const sp098Repair = JSON.parse(readFileSync(path.join(root, 'outputs', 'derived', 'sp098_identity_coverage_repair_20260813.json'), 'utf8'));
  const naharaFarmRows = sp098Repair?.diagnoses?.['名原 典彦']?.farm_bm_player;
  const naharaIds = [...new Set((Array.isArray(naharaFarmRows) ? naharaFarmRows : [])
    .filter(row => norm(row.name_ja) === norm('名原 典彦') && row.team === '広' && row.player_id != null)
    .map(row => String(row.player_id)))];
  if (naharaIds.length !== 1 || naharaIds[0] !== '20230057') {
    throw new Error('[SP-100 N primary fail-closed] SP-098 repaired canonical crosswalk for 名原 is not valid');
  }
  const naharaCanonicalKey = `BM_PLAYER:${naharaIds[0]}`;
  const npb = loadNpbPlusMeasurements(root, ['top_speed_kmh']);
  const rows = roster.map(entry => {
    const key = norm(entry.player);
    const measured = finite(npb.byName.get(key)?.top_speed_kmh);
    const stated = finite(entry.npb_plus_sprint_speed_kmh);
    const frozen = latentByName.get(key);
    if (!key || measured == null || stated == null || !frozen
      || Math.abs(measured - stated) > 1e-9 || measured !== frozen.top_speed_kmh) {
      throw new Error(`[SP-100 N primary fail-closed] cohort/raw top-speed mismatch for ${entry.player ?? '(unknown)'}`);
    }
    const productionPlayerId = String(entry.player_id ?? frozen.player_id ?? '').trim() || null;
    const stablePlayerKey = productionPlayerId
      ? `PROEYE:${productionPlayerId}`
      : (key === norm('名原 典彦') ? naharaCanonicalKey : null);
    if (!stablePlayerKey) {
      throw new Error(`[SP-100 N primary fail-closed] missing stable player key for ${entry.player ?? '(unknown)'}`);
    }
    if (entry.player_id != null && frozen.player_id != null && String(entry.player_id) !== String(frozen.player_id)) {
      throw new Error(`[SP-100 N primary fail-closed] roster/raw player id mismatch for ${entry.player ?? '(unknown)'}`);
    }
    return {
      player: entry.player,
      name_key: key,
      stable_player_key: stablePlayerKey,
      production_player_id: productionPlayerId,
      top_speed_kmh: measured,
      full_effort_run_proxy_count: finite(entry.full_effort_run_proxy_count) ?? 0,
      source_season_label: entry.npb_plus_source_season_label ?? null,
      frozen_npb_top_speed_z: frozen.npb_top_speed_z,
      frozen_exposure_context: frozen.exposure_context ?? null,
    };
  });
  if (new Set(rows.map(row => row.name_key)).size !== rows.length
    || new Set(rows.map(row => row.stable_player_key)).size !== rows.length) {
    throw new Error('[SP-100 N primary fail-closed] current target cohort has duplicate names or stable player keys');
  }
  return { rows, provenance: npb.provenance };
}

/**
 * Return the owner-approved N-primary estimate for one current-season player.
 * The returned rank/z are relative within the exactly-100 current cohort; the
 * caller applies the repository's existing provisional display mapping.
 */
export function buildNpbTopSpeedPrimary({ root = DEFAULT_ROOT, physicalEvidenceSeason, playerName, stablePlayerKey = null }) {
  if (Number(physicalEvidenceSeason) !== TARGET_SEASON) return null;
  const key = norm(playerName);
  const requestedStableKey = String(stablePlayerKey ?? '').trim();
  if (!key && !requestedStableKey) return null;

  const reliability = npbPlusReliability(root);
  if (reliability.verdict !== 'NOT_IDENTIFIABLE' || reliability.value !== null) {
    throw new Error('[SP-100 N primary fail-closed] generic NPB+ reliability must remain NOT_IDENTIFIABLE');
  }

  const { rows, provenance } = readCurrentCohort(root);
  const match = rows.filter(row => (!key || row.name_key === key)
    && (!requestedStableKey || row.stable_player_key === requestedStableKey));
  if (!match.length) return null; // N unavailable: caller keeps S as the fallback.
  if (match.length !== 1) throw new Error(`[SP-100 N primary fail-closed] ambiguous current cohort match for ${playerName}`);

  const topValues = rows.map(row => row.top_speed_kmh);
  const average = mean(topValues);
  const spread = populationSd(topValues, average);
  if (!(spread > 0)) throw new Error('[SP-100 N primary fail-closed] top-speed cohort has no dispersion');
  const target = match[0];
  const calculatedZ = +((target.top_speed_kmh - average) / spread).toFixed(4);
  if (calculatedZ !== target.frozen_npb_top_speed_z) {
    throw new Error(`[SP-100 N primary fail-closed] frozen N z does not match its verified current cohort for ${playerName}`);
  }
  const rankFastest = 1 + rows.filter(row => row.top_speed_kmh > target.top_speed_kmh).length;
  const tieCount = rows.filter(row => row.top_speed_kmh === target.top_speed_kmh).length;
  const positiveRuns = rows.map(row => row.full_effort_run_proxy_count).filter(value => value > 0).sort((a, b) => a - b);
  const contextReferenceRuns = positiveRuns.length ? positiveRuns[Math.floor(positiveRuns.length / 2)] : null;

  return {
    architecture: 'N_PRIMARY_S_CONTEXT_OR_FALLBACK',
    appraisal_year: TARGET_SEASON,
    player: target.player,
    stable_player_key: target.stable_player_key,
    production_player_id: target.production_player_id,
    top_speed_kmh: target.top_speed_kmh,
    npb_top_speed_z: target.frozen_npb_top_speed_z,
    current_cohort: {
      size: rows.length,
      mean_top_speed_kmh: +average.toFixed(3),
      sd_top_speed_kmh: +spread.toFixed(3),
      rank_fastest: rankFastest,
      tie_count: tieCount,
      percentile_faster_than: +((rows.filter(row => row.top_speed_kmh < target.top_speed_kmh).length / (rows.length - 1)).toFixed(4)),
    },
    measurement_reliability: reliability.verdict,
    exposure_context: {
      full_effort_run_proxy_count: target.full_effort_run_proxy_count,
      reference_runs_context_only: contextReferenceRuns,
      applied_to_z: false,
      max_statistic_direction: contextReferenceRuns != null && target.full_effort_run_proxy_count < contextReferenceRuns
        ? 'FEW_RUNS_TOP_SPEED_LIKELY_UNDERSTATED'
        : 'ADEQUATE_RUNS',
    },
    source_season_label: target.source_season_label,
    provenance,
    fallback_policy: 'Use S only when current-year N is unavailable; never arithmetically blend S and N.',
  };
}

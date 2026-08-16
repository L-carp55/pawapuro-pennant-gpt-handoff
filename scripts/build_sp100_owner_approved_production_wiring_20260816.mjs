// Materialize the owner-approved SP-100 current-2026 physical layer.
// This does not run SP-079 and does not create a final practical rating.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSp100ProductionPhysicalSpeed } from '../src/ratings/sp100_production_wiring.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = '2026-08-16';
const F = {
  config: 'configs/ratings.json',
  exposure: 'outputs/derived/npb_plus_sprint_exposure_2026.json',
  sp022: 'outputs/derived/sp022_pairwise_range_v2_20260816.json',
  sp098Repair: 'outputs/derived/sp098_identity_coverage_repair_20260813.json',
  latent: 'outputs/derived/sp100_npb_raw_latent_speed.json',
  output: 'outputs/derived/sp100_owner_approved_production_wiring_20260816.json',
  audit: 'docs/audits/sp100_owner_approved_production_wiring_20260816.md',
};
const read = file => readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const norm = value => String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const checks = [];
function check(label, condition, detail = null) {
  checks.push({ label, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`[SP-100 production wiring] ${label}${detail ? `: ${detail}` : ''}`);
}
function atomicWrite(file, value) {
  const target = path.join(ROOT, file);
  const temp = `${target}.tmp-${process.pid}`;
  writeFileSync(temp, value, 'utf8');
  renameSync(temp, target);
}

const cfg = json(F.config);
const exposure = json(F.exposure);
const roster = exposure.players ?? exposure.rows ?? [];
const sp022 = json(F.sp022);
const latent = json(F.latent);
const profiles = sp022.profiles ?? [];
const profileByName = new Map(profiles.map(row => [norm(row.player), row]));
const latentByName = new Map((latent.players ?? []).map(row => [norm(row.player), row]));

check('current exposure roster is exactly 100', roster.length === 100, `n=${roster.length}`);
check('SP-022 statistical context has exactly 100 profiles', profiles.length === 100, `n=${profiles.length}`);
check('raw SP-100 N artifact is exactly 100', latent.n_players === 100 && latent.players?.length === 100, `n=${latent.n_players}`);
check('raw SP-100 N excludes hp_to_1b_sec', latent.inputs?.hp_to_1b_sec_used === 0);
check('raw SP-100 generic reliability remains unknown', latent.measurement_reliability?.verdict === 'NOT_IDENTIFIABLE' && latent.measurement_reliability?.value === null);
check('raw SP-100 exposure is contextual only', latent.exposure_proxy?.applied_to_z === false);

const players = roster.map((row, index) => {
  const key = norm(row.player);
  const statistical = profileByName.get(key);
  const rawN = latentByName.get(key);
  check(`SP-022 profile joins ${row.player}`, Boolean(statistical));
  check(`raw N joins ${row.player}`, Boolean(rawN));
  const statisticalContext = {
    appraisal_year: statistical.appraisal_year,
    state: statistical.state,
    value_z: statistical.value_z,
    reliability: statistical.S_reliability,
    pa_2025: statistical.pa_2025,
    effective_sample_fraction: statistical.effective_sample_fraction,
    sigma: statistical.sigma,
    provenance: F.sp022,
  };
  const resolved = resolveSp100ProductionPhysicalSpeed({
    root: ROOT,
    physicalEvidenceSeason: 2026,
    playerName: row.player,
    cfg,
    statisticalContext,
  });
  check(`N primary selects ${row.player}`, resolved.selection === 'N_PRIMARY_CURRENT_2026');
  check(`stable player key resolves ${row.player}`, Boolean(resolved.n_primary?.stable_player_key));
  check(`N/S never blend ${row.player}`, resolved.no_arithmetic_n_s_blend === true);
  check(`N generic reliability remains nonnumeric ${row.player}`,
    resolved.n_primary?.measurement_reliability === 'NOT_IDENTIFIABLE'
      && !Object.prototype.hasOwnProperty.call(resolved.n_primary ?? {}, 'reliability_weight'));
  check(`N z reproduces frozen artifact ${row.player}`, resolved.n_primary?.npb_top_speed_z === rawN.npb_top_speed_z,
    `${resolved.n_primary?.npb_top_speed_z} vs ${rawN.npb_top_speed_z}`);
  check(`N raw top speed reproduces frozen artifact ${row.player}`, resolved.n_primary?.top_speed_kmh === rawN.top_speed_kmh);
  check(`N display point is provisional ${row.player}`,
    Number.isFinite(resolved.n_primary?.provisional_display_point)
      && resolved.n_primary?.display_scale_status === 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE');
  return {
    row_id: `SP100:2026:${resolved.n_primary.stable_player_key}`,
    player: row.player,
    player_id: resolved.n_primary.production_player_id,
    stable_player_key: resolved.n_primary.stable_player_key,
    team: row.team ?? null,
    ...resolved,
  };
});

check('all output row ids are unique', new Set(players.map(row => row.row_id)).size === 100);
check('all output stable player keys are unique', new Set(players.map(row => row.stable_player_key)).size === 100);
check('all output rows are N primary', players.every(row => row.selection === 'N_PRIMARY_CURRENT_2026'));
check('no output row contains arithmetic blend fields', players.every(row =>
  !JSON.stringify(row).match(/(?:blend_weight|fused_value|w_npb)/iu)));

const sourceHashes = Object.fromEntries(Object.entries(F)
  .filter(([key]) => !['output', 'audit'].includes(key))
  .map(([, file]) => [file, sha256(read(file))]));
const output = {
  schema_version: 'sp100_owner_approved_production_wiring_20260816',
  generated_at: DATE,
  task_id: 'SP-100',
  status: 'DONE_VALIDATED',
  owner_approved_architecture: 'N_PRIMARY_S_CONTEXT_OR_FALLBACK',
  production_behavior: {
    current_2026_n_is_primary_physical_rank_estimate: true,
    S_role: 'CONTEXT_OR_FALLBACK_ONLY',
    arithmetic_N_S_blend: false,
    physical_evidence_season: 2026,
    final_practical_reappraisal_created: false,
  },
  non_negotiable_guards: {
    top_speed_only_npb_plus_direct_measurement: true,
    hp_to_1b_sec_fail_closed: true,
    generic_npb_reliability: 'NOT_IDENTIFIABLE',
    exposure_applied_to_z: false,
    no_individual_powerpro_teacher_or_weight: true,
    no_future_year_repeatability_weight: true,
    no_2026_N_copy_to_earlier_years: true,
    absolute_display_scale: 'PROVISIONAL_PENDING_SP-071_ENGINE_BRIDGE',
    no_sp079_final_practical_reappraisal: true,
  },
  source_hashes: sourceHashes,
  summary: {
    current_target_population: players.length,
    N_primary_count: players.filter(row => row.selection === 'N_PRIMARY_CURRENT_2026').length,
    S_fallback_count: players.filter(row => row.selection === 'S_FALLBACK_NO_CURRENT_YEAR_N').length,
    real_owner_verdicts_written: 0,
    checks_passed: checks.length,
    checks_failed: 0,
  },
  players,
  checks,
};

const report = [
  '# SP-100 owner-approved production wiring',
  '',
  `Date: ${DATE}`,
  '',
  '## Implemented rule',
  '',
  '- Owner-approved architecture: **N_PRIMARY_S_CONTEXT_OR_FALLBACK**.',
  `- Current 2026 N primary physical/rank rows: **${output.summary.N_primary_count}/100**.`,
  '- Every row has a stable player key; 名原 uses the repaired `BM_PLAYER:20230057` crosswalk rather than a fabricated ProEYE id.',
  '- S remains a separately labelled 2025 statistical context/fallback record. It is never arithmetically blended with N.',
  '- The output is a current physical layer, not SP-079 and not a final practical rating.',
  '',
  '## Guards retained',
  '',
  '- NPB+ input is `top_speed_kmh` only; `hp_to_1b_sec` remains fail-closed.',
  '- Generic NPB+ reliability remains `NOT_IDENTIFIABLE`; no reliability weight is created.',
  '- Exposure remains contextual only and does not shrink N.',
  '- N is generated only for explicit `physicalEvidenceSeason=2026`; it is never copied onto a 2025 card.',
  '- The 0–100 display point is explicitly provisional pending SP-071 / engine bridge.',
  '',
  '## Validation',
  '',
  `- ${checks.length} content checks passed; 0 failed.`,
  '- Every N z/top-speed value is independently reproduced against the frozen 100-player raw SP-100 artifact.',
  '- No owner player verdict is written by this generator.',
  '',
].join('\n');

atomicWrite(F.output, `${JSON.stringify(output, null, 2)}\n`);
atomicWrite(F.audit, report);
console.log(JSON.stringify({ status: output.status, N_primary_count: output.summary.N_primary_count, checks: `${checks.length}/0`, output: F.output, audit: F.audit }, null, 2));

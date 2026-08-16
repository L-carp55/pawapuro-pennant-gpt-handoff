// Independent QA for the explicit owner-approved SP-100 production wire.
//
// This test intentionally consumes the materialized production layer, decision
// packet, final owner-review queue, and empty verdict ledger.  Missing or stale
// consumers are failures; this is not a best-effort diagnostic.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDirectMeasurements } from '../src/ratings/direct_measurement.mjs';
import { loadNpbPlusMeasurements } from '../src/ratings/npb_plus_provenance.mjs';
import { resolveSp100ProductionPhysicalSpeed } from '../src/ratings/sp100_production_wiring.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER_TEXT = 'SP-100は N_PRIMARY_S_CONTEXT_OR_FALLBACK で承認します。Sはcontext/fallbackに留め、SとNを識別不能な重みでblendしません。';
const F = {
  config: 'configs/ratings.json',
  registry: 'docs/state/speed_task_registry.tsv',
  decision: 'docs/audits/sp100_owner_decision_20260816.md',
  productionSource: 'scripts/build_sp100_owner_approved_production_wiring_20260816.mjs',
  directSource: 'src/ratings/direct_measurement.mjs',
  productionLayer: 'outputs/derived/sp100_owner_approved_production_wiring_20260816.json',
  packet: 'outputs/derived/sp100_production_wiring_decision_packet_20260816.json',
  packetReport: 'docs/audits/sp100_production_wiring_decision_packet_20260816.md',
  raw: 'outputs/derived/sp100_npb_raw_latent_speed.json',
  queue: 'outputs/derived/sp077_final_owner_review_queue_20260816.json',
  ledger: 'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
  output: 'outputs/derived/qa_sp100_owner_approved_wiring_20260816.json',
  audit: 'docs/audits/sp100_owner_approved_wiring_20260816.md',
};
const checks = [];
const failures = [];
const rel = file => path.join(ROOT, file);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const norm = value => String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const populationSd = (values, mean) => Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);

function read(file) {
  return readFileSync(rel(file), 'utf8');
}
function load(file) {
  if (!existsSync(rel(file))) {
    expect(`required artifact exists: ${file}`, false, 'missing');
    return null;
  }
  try {
    return JSON.parse(read(file));
  } catch (error) {
    expect(`required artifact is valid JSON: ${file}`, false, error.message);
    return null;
  }
}
function expect(label, pass, detail = null) {
  const result = { label, pass: Boolean(pass), ...(detail == null ? {} : { detail }) };
  checks.push(result);
  if (!result.pass) failures.push(result);
  return result.pass;
}
function sourceHashMatches(container, file) {
  return container?.source_hashes?.[file] === sha256(read(file));
}
function atomicWrite(file, value) {
  const target = rel(file);
  const temp = `${target}.tmp-${process.pid}`;
  writeFileSync(temp, value, 'utf8');
  renameSync(temp, target);
}

for (const file of Object.values(F)) {
  if (!['output', 'audit'].includes(Object.entries(F).find(([, value]) => value === file)?.[0])) {
    expect(`required artifact exists: ${file}`, existsSync(rel(file)), existsSync(rel(file)) ? null : 'missing');
  }
}

const cfg = load(F.config) ?? {};
const layer = load(F.productionLayer);
const packet = load(F.packet);
const raw = load(F.raw);
const queue = load(F.queue);
const ledger = load(F.ledger);
const registry = existsSync(rel(F.registry)) ? read(F.registry) : '';
const ownerDecision = existsSync(rel(F.decision)) ? read(F.decision) : '';
const packetReport = existsSync(rel(F.packetReport)) ? read(F.packetReport) : '';
const productionSource = existsSync(rel(F.productionSource)) ? read(F.productionSource) : '';
const directSource = existsSync(rel(F.directSource)) ? read(F.directSource) : '';

// 1. Owner decision must be an explicit recorded instruction, not a technical
// recommendation inferred from an old repository state.
expect('owner decision document records the exact owner instruction', ownerDecision.includes(OWNER_TEXT));
expect('owner decision document calls the approval explicit', /explicit owner verdict|明示的なowner/i.test(ownerDecision));
expect('registry marks SP-100 DONE_VALIDATED', /^SP-100\tDONE_VALIDATED\t/m.test(registry));
expect('packet schema is current', packet?.schema_version === 'sp100_production_wiring_decision_packet_20260816');
expect('packet is owner-approved and implemented',
  packet?.status === 'DONE_VALIDATED'
    && packet?.decision_type === 'EXPLICIT_OWNER_APPROVED_IMPLEMENTED'
    && packet?.implemented_architecture === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK'
    && packet?.production_behavior_changed === true);
expect('packet retains exact owner instruction', JSON.stringify(packet ?? {}).includes(OWNER_TEXT));
expect('packet records a real owner ruling', packet?.owner_ruling_after_v2_provenance_repair?.found === true);
expect('packet source hash binds owner decision document', packet ? sourceHashMatches(packet, F.decision) : false);
expect('packet human report is owner-approved, not pending approval',
  /DONE_VALIDATED|owner-approved|owner approved/i.test(packetReport)
    && !/Production behavior:\s*\*\*unchanged\*\*/i.test(packetReport));

// 2. The former generic NPB direct-measurement route cannot map top speed
// through its PowerPro-calibrated regression or subsequent blend path.
expect('generic direct source explicitly excludes top_speed_kmh', /metric !== 'top_speed_kmh'/.test(directSource));
const genericCfg = {
  ...(cfg.direct_measurement ?? {}),
  npb_plus_direct: cfg.npb_plus_direct,
  scale_calibration: cfg.scale_calibration,
};
let genericTopSpeed = null;
try {
  genericTopSpeed = buildDirectMeasurements({ top_speed_kmh: 35.0 }, genericCfg, 2026).走力;
  expect('generic direct path does not produce a top-speed rating', genericTopSpeed === null, JSON.stringify(genericTopSpeed));
} catch (error) {
  expect('generic direct path executes without a top-speed conversion', false, error.message);
}
let hpRejected = false;
try { loadNpbPlusMeasurements(ROOT, ['hp_to_1b_sec']); } catch { hpRejected = true; }
expect('provenance guard rejects hp_to_1b_sec as NPB+ measurement', hpRejected);

// 3. Frozen N values must reproduce the exact intended current cohort.
const rawPlayers = Array.isArray(raw?.players) ? raw.players : [];
const rawSpeeds = rawPlayers.map(row => number(row.top_speed_kmh));
const validRawSpeeds = rawSpeeds.length === 100 && rawSpeeds.every(value => value != null);
const rawMean = validRawSpeeds ? average(rawSpeeds) : null;
const rawSd = validRawSpeeds ? populationSd(rawSpeeds, rawMean) : null;
expect('raw N population is exactly 100', raw?.n_players === 100 && rawPlayers.length === 100);
expect('raw N uses top speed only and excludes hp_to_1b_sec', raw?.inputs?.top_speed_kmh === 100 && raw?.inputs?.hp_to_1b_sec_used === 0);
expect('raw N cohort mean is exactly 31.612', rawMean != null && Math.abs(rawMean - 31.612) < 1e-9, String(rawMean));
expect('raw N cohort population SD is exactly 1.252', rawSd != null && Math.abs(rawSd - 1.252) < 5e-4, String(rawSd));
expect('raw N recorded normalization matches independently recomputed mean/SD',
  raw?.same_time_normalization?.top_speed?.mean === 31.612
    && raw?.same_time_normalization?.top_speed?.sd === 1.252);
for (const row of rawPlayers) {
  const expectedZ = rawMean == null ? null : +((Number(row.top_speed_kmh) - rawMean) / rawSd).toFixed(4);
  expect(`raw N z reproduces fixed cohort: ${row.player}`, expectedZ === row.npb_top_speed_z);
}
expect('generic NPB reliability remains NOT_IDENTIFIABLE without numeric value',
  raw?.measurement_reliability?.verdict === 'NOT_IDENTIFIABLE' && raw?.measurement_reliability?.value === null);
expect('exposure remains context and cannot shrink z', raw?.exposure_proxy?.applied_to_z === false);

// 4. Production layer must select N current evidence, retain S separately,
// and never embed a numeric reliability or an N/S blend.
const layerPlayers = Array.isArray(layer?.players) ? layer.players : [];
const rawByPlayer = new Map(rawPlayers.map(row => [norm(row.player), row]));
expect('production layer schema/status are final',
  layer?.schema_version === 'sp100_owner_approved_production_wiring_20260816' && layer?.status === 'DONE_VALIDATED');
expect('production layer declares approved architecture', layer?.owner_approved_architecture === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK');
expect('production layer says N primary, S separate, no arithmetic blend',
  layer?.production_behavior?.current_2026_n_is_primary_physical_rank_estimate === true
    && layer?.production_behavior?.S_role === 'CONTEXT_OR_FALLBACK_ONLY'
    && layer?.production_behavior?.arithmetic_N_S_blend === false);
expect('production layer preserves no-SP-079 and no-backward-copy guards',
  layer?.non_negotiable_guards?.no_sp079_final_practical_reappraisal === true
    && layer?.non_negotiable_guards?.no_2026_N_copy_to_earlier_years === true
    && layer?.production_behavior?.final_practical_reappraisal_created === false);
expect('production layer has exactly 100 N-primary rows',
  layerPlayers.length === 100 && layerPlayers.every(row => row.selection === 'N_PRIMARY_CURRENT_2026'));
expect('production layer records no owner verdicts', layer?.summary?.real_owner_verdicts_written === 0);
expect('production layer is bound to raw N input', layer ? sourceHashMatches(layer, F.raw) : false);
for (const row of layerPlayers) {
  const frozen = rawByPlayer.get(norm(row.player));
  const n = row.n_primary;
  expect(`production row joins raw N: ${row.player}`, Boolean(frozen));
  expect(`production N/S selection is separate: ${row.player}`,
    row.architecture === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK'
      && row.no_arithmetic_n_s_blend === true
      && row.statistical_context?.role === 'S_CONTEXT_OR_FALLBACK_ONLY_NOT_ARITHMETIC_BLEND');
  expect(`production N record matches frozen top/z: ${row.player}`,
    n?.top_speed_kmh === frozen?.top_speed_kmh && n?.npb_top_speed_z === frozen?.npb_top_speed_z);
  expect(`production N has exact cohort normalization: ${row.player}`,
    n?.current_cohort?.size === 100
      && n?.current_cohort?.mean_top_speed_kmh === 31.612
      && n?.current_cohort?.sd_top_speed_kmh === 1.252);
  expect(`production N reliability remains nonnumeric: ${row.player}`,
    n?.measurement_reliability === 'NOT_IDENTIFIABLE'
      && !Object.prototype.hasOwnProperty.call(n ?? {}, 'reliability_weight'));
  expect(`production exposure does not shrink z: ${row.player}`, n?.exposure_context?.applied_to_z === false);
  expect(`production N/S has no blend fields: ${row.player}`,
    !/(?:blend_weight|fused_value|weighted_value|reliability_weight|test_r)/iu.test(JSON.stringify(row)));
}

// A direct resolver probe proves that current N cannot be copied backward to
// a 2025 card. S remains the explicit fallback only when no current-year N is
// requested.
const probePlayer = rawPlayers[0]?.player;
let backwards = null;
try {
  backwards = resolveSp100ProductionPhysicalSpeed({
    root: ROOT,
    physicalEvidenceSeason: 2025,
    playerName: probePlayer,
    cfg,
    statisticalContext: { source: 'QA_S_CONTEXT' },
  });
  expect('2025 resolver has no copied 2026 N',
    backwards?.selection === 'S_FALLBACK_NO_CURRENT_YEAR_N' && backwards?.n_primary === null);
} catch (error) {
  expect('2025 resolver rejects backward N copy safely', false, error.message);
}
expect('production generator contains no appraiseCard/final appraisal call', !/appraiseCard\s*\(/.test(productionSource));
expect('production generator has no external-collection mechanism', !/\b(fetch|https?:|curl|wget|child_process)\b/i.test(productionSource));

// 5. SP-077 must consume this current physical layer without declaring player
// verdicts or producing SP-079 output, and the empty durable ledger must bind
// exactly to the regenerated queue.
const queuePlayers = Array.isArray(queue?.players) ? queue.players : [];
const layerByPlayer = new Map(layerPlayers.map(row => [norm(row.player), row]));
expect('queue schema/status are final pre-owner-review only',
  queue?.schema_version === 'sp077_final_owner_review_queue_20260816'
    && queue?.status === 'DONE_VALIDATED_PENDING_OWNER_VERDICTS');
expect('queue source hash binds approved production layer', queue ? sourceHashMatches(queue, F.productionLayer) : false);
expect('queue no longer says SP-100 owner decision is required',
  queue?.provisional_constraints?.sp100_status === 'DONE_VALIDATED'
    && queue?.provisional_constraints?.sp100_implemented_architecture === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK');
expect('queue has exactly 100 owner-review rows', queuePlayers.length === 100);
for (const row of queuePlayers) {
  const player = row.identity?.player;
  const wired = layerByPlayer.get(norm(player));
  const current = row.current_physical_evidence ?? {};
  expect(`queue consumes N-primary current layer: ${player}`,
    current.sp100_current_physical_selection === 'N_PRIMARY_CURRENT_2026'
      && current.sp100_npb_top_speed_z === wired?.n_primary?.npb_top_speed_z
      && current.sp100_rank_fastest === wired?.n_primary?.current_cohort?.rank_fastest
      && current.sp100_measurement_reliability === 'NOT_IDENTIFIABLE'
      && current.sp100_exposure_context?.applied_to_z === false);
  expect(`queue keeps S only as separate context: ${player}`,
    row.statistical_proxy_context?.role === 'CONTEXT_AND_PAIRWISE_RANGE_ONLY_NOT_A_PHYSICAL_TEACHER');
  expect(`queue keeps owner verdict blank: ${player}`,
    row.owner_verdict?.status === 'NOT_ENTERED' && row.owner_verdict?.verdict === null
      && row.owner_verdict?.preferred_rating_optional === null);
  expect(`queue has no SP-100 provisional/ SP-079 final output: ${player}`,
    row.provisional_status?.sp100_owner_decision_required === false
      && row.provisional_status?.no_sp079_final_reappraisal_entered === true);
}
const queueText = JSON.stringify(queue ?? {});
expect('queue does not retain old SP-100 PARTIAL label', !/SP-100=PARTIAL|owner production-wiring decision required/iu.test(queueText));
expect('ledger schema is current', ledger?.schema_version === 'sp078_owner_verdict_ledger_20260816');
expect('ledger binds exact regenerated queue hash and 100 rows',
  ledger?.queue_source?.sha256 === sha256(read(F.queue)) && ledger?.queue_source?.row_count === 100);
expect('ledger contains no owner verdicts', Array.isArray(ledger?.records) && ledger.records.length === 0 && ledger?.owner_verdict_count === 0);

const qa = {
  schema_version: 'qa_sp100_owner_approved_wiring_20260816',
  generated_at: '2026-08-16',
  task_id: 'SP-100',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  summary: { checks_passed: checks.length - failures.length, checks_failed: failures.length },
  required_consumers: [F.productionLayer, F.packet, F.queue, F.ledger],
  checks,
  failures,
};
const audit = [
  '# SP-100 owner-approved production wiring — independent QA',
  '',
  `Status: **${qa.status}**`,
  '',
  `- Checks: ${qa.summary.checks_passed} passed / ${qa.summary.checks_failed} failed.`,
  '- Required consumers: current 2026 production layer, approved decision packet, regenerated SP-077 queue, and empty SP-078 ledger.',
  '- This QA rejects a missing consumer, a stale source hash, a generic top-speed-to-PowerPro route, any N/S blend, any numeric generic reliability, exposure shrinkage, hp_to_1b use, a 2025 backward N copy, SP-079/final-rating creation, external collection code, or a nonempty owner-verdict ledger.',
  '',
  '## Failed checks',
  '',
  ...(failures.length ? failures.map(row => `- ${row.label}${row.detail ? ` — ${row.detail}` : ''}`) : ['- None.']),
  '',
].join('\n');
atomicWrite(F.output, `${JSON.stringify(qa, null, 2)}\n`);
atomicWrite(F.audit, audit);
console.log(`SP-100 owner-approved independent QA: ${qa.summary.checks_passed} PASS / ${qa.summary.checks_failed} FAIL`);
if (failures.length) process.exitCode = 1;

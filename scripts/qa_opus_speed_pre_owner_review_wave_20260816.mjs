// Independent, read-mostly closure QA for the OPUS pre-owner-review speed wave.
// This script deliberately owns only its own JSON/Markdown receipts.  It does
// not regenerate any individual workstream output, write registry state, enter
// an owner verdict, or perform network collection.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { poolAcrossYears } from '../src/ratings/durable_traits.mjs';
import { estimateDurableTraits } from '../src/cards/durable_estimate.mjs';
import { appraiseCard, makeContext, resolveIdentity } from '../src/cards/pipeline.mjs';
import { loadNpbPlusMeasurements } from '../src/ratings/npb_plus_provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'outputs/derived/qa_opus_speed_pre_owner_review_wave_20260816.json';
const AUDIT = 'docs/audits/opus_speed_pre_owner_review_wave_20260816.md';
const rel = (...parts) => path.join(...parts).replace(/\\/g, '/');
const full = file => path.join(ROOT, file);
const read = file => fs.readFileSync(full(file), 'utf8');
const json = file => JSON.parse(read(file));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fileHash = file => sha256(read(file));
const norm = value => String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const checks = [];
const argument = flag => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? '' : '';
};
const decodeReceipt = flag => {
  const value = argument(flag);
  return value ? Buffer.from(value, 'base64').toString('utf8') : '';
};
const runtimeReceipts = {
  registryQa: decodeReceipt('--registry-qa-b64'),
  sp100Qa: decodeReceipt('--sp100-qa-b64'),
  sp077Fixture: decodeReceipt('--sp077-fixture-b64'),
  sp078SelfTest: decodeReceipt('--sp078-selftest-b64'),
  ratingsConfigUnchanged: argument('--ratings-config-unchanged'),
  changedPaths: decodeReceipt('--changed-paths-b64'),
};

function check(id, fn) {
  try {
    const detail = fn();
    checks.push({ id, pass: true, detail: detail == null ? null : detail });
  } catch (error) {
    checks.push({ id, pass: false, detail: error instanceof Error ? error.message : String(error) });
  }
}
function requireOk(condition, message) {
  if (!condition) throw new Error(message);
}
function rowsFromTsv(file) {
  const lines = read(file).replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  const header = lines.shift().split('\t');
  return lines.filter(Boolean).map((line, index) => {
    const cells = line.split('\t');
    requireOk(cells.length === header.length, `${file}:${index + 2} column count`);
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}
function findTask(rows, id) {
  const row = rows.find(item => item.task_id === id);
  requireOk(Boolean(row), `missing registry row ${id}`);
  return row;
}
function allPass(values) {
  return Object.values(values).every(value => (typeof value === 'string' && value.startsWith('PASS'))
    || (value && typeof value === 'object' && value.result === 'PASS'));
}

const keyFiles = [
  'configs/running_norms.json',
  'docs/state/speed_task_registry.tsv',
  'docs/state/speed_exclusion_reason_ledger.tsv',
  'src/ratings/durable_traits.mjs',
  'src/cards/durable_estimate.mjs',
  'src/cards/pipeline.mjs',
  'scripts/qa_speed_task_registry.mjs',
  'scripts/sp016_current_year_first_repair_qa_20260816.mjs',
  'outputs/derived/sp016_current_year_first_repair_qa_20260816.json',
  'docs/audits/sp016_current_year_first_repair_20260816.md',
  'scripts/sp098_identity_coverage_qa_20260816.mjs',
  'outputs/derived/sp098_identity_coverage_qa_20260816.json',
  'docs/audits/sp098_identity_coverage_qa_20260816.md',
  'scripts/sp100_production_wiring_decision_packet_20260816.mjs',
  'scripts/qa_sp100_production_wiring_decision_packet_20260816.mjs',
  'outputs/derived/sp100_production_wiring_decision_packet_20260816.json',
  'docs/audits/sp100_production_wiring_decision_packet_20260816.md',
  'docs/audits/sp100_owner_decision_20260816.md',
  'docs/audits/sp100_owner_approved_production_wiring_20260816.md',
  'docs/audits/sp100_owner_approved_wiring_20260816.md',
  'src/ratings/direct_measurement.mjs',
  'src/ratings/sp100_npb_primary_speed.mjs',
  'src/ratings/sp100_production_wiring.mjs',
  'scripts/build_sp100_owner_approved_production_wiring_20260816.mjs',
  'scripts/qa_sp100_owner_approved_wiring_20260816.mjs',
  'outputs/derived/sp100_owner_approved_production_wiring_20260816.json',
  'outputs/derived/qa_sp100_owner_approved_wiring_20260816.json',
  'scripts/build_sp077_final_owner_review_queue_20260816.mjs',
  'outputs/derived/sp077_final_owner_review_queue_20260816.json',
  'outputs/derived/sp077_final_owner_review_queue_20260816.csv',
  'docs/reports/sp077_final_owner_review_queue_20260816.md',
  'scripts/sp078_owner_verdict_capture_20260816.mjs',
  'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
];

// Task and registry integrity.
check('TASK_SCOPE_RE_READ', () => {
  const task = read('docs/tasks/OPUS_SPEED_PRE_OWNER_REVIEW_WAVE_20260816.md');
  for (const phrase of ['No new X / YouTube / Web / NPB-official / Prospi / The Show collection.',
    'No shoulder work.', 'No SP-079 final reappraisal.', 'No SP-080 engine simulation.',
    'No SP-081 global Speed Gate closure.', 'Do not change the absolute 0-100 scale policy in SP-071.']) {
    requireOk(task.includes(phrase), `task guard absent: ${phrase}`);
  }
  return 'full task scope guards present';
});
check('REGISTRY_QA_EXECUTES_PASS', () => {
  const output = runtimeReceipts.registryQa;
  requireOk(output, 'missing externally executed registry QA receipt');
  requireOk(/^PASS: requirements=61, tasks=72, exclusions=25,/.test(output), `unexpected registry QA: ${output}`);
  requireOk(output.includes('owner_review_dependency_task_blockers=0'), `SP-077 dependency gate not closed: ${output}`);
  return output;
});

const registry = rowsFromTsv('docs/state/speed_task_registry.tsv');
check('REGISTRY_DIRECT_ROWS_CONTENT_LEVEL', () => {
  const expected = {
    'SP-016': ['DONE_VALIDATED', '0', '0'],
    'SP-098': ['DONE_VALIDATED', '0', '0'],
    'SP-100': ['DONE_VALIDATED', '0', '0'],
    'SP-077': ['DONE_VALIDATED', '0', '0'],
    'SP-078': ['DONE_VALIDATED', '0', '0'],
  };
  for (const [id, values] of Object.entries(expected)) {
    const row = findTask(registry, id);
    requireOk([row.status, row.owner_review_block, row.gate_block].join('|') === values.join('|'),
      `${id} registry state ${row.status}/${row.owner_review_block}/${row.gate_block}`);
    requireOk(row.artifacts.includes('20260816'), `${id} lacks wave artifact receipt`);
  }
  return expected;
});
check('EX009_TRANSFORMATION_CLOSED_WITH_REPAIRED_EVIDENCE', () => {
  const exclusion = rowsFromTsv('docs/state/speed_exclusion_reason_ledger.tsv').find(row => row.exclusion_id === 'EX-009');
  requireOk(exclusion?.verdict === 'VALID_TRANSFORMATION_EXCLUSION', `EX-009 verdict ${exclusion?.verdict}`);
  requireOk(exclusion.owner_review_block === '0' && exclusion.gate_block === '0', 'EX-009 remains blocking');
  for (const token of ['50 PA', 'median historical PA=505', '15 duplicate player-seasons', 'failable']) {
    requireOk(exclusion.corrected_policy.includes(token), `EX-009 evidence missing ${token}`);
  }
  return exclusion.verdict;
});

// SP-016: verify receipt plus an independent execution of its policy functions.
const sp016 = json('outputs/derived/sp016_current_year_first_repair_qa_20260816.json');
const runNorm = json('configs/running_norms.json');
const ratingCfg = json('configs/ratings.json');
const fieldNorm = json('configs/fielding_norms.json');
const runValues = json('configs/run_values.json').values;
check('SP016_RECEIPT_8_PASS_0_FAIL', () => {
  requireOk(sp016.status === 'DONE_VALIDATED', `status ${sp016.status}`);
  requireOk(sp016.collection === 'NO_NETWORK_OR_EXTERNAL_COLLECTION', `collection ${sp016.collection}`);
  requireOk(sp016.production_default === 'current_year_first_low_sample_prior', `default ${sp016.production_default}`);
  requireOk(sp016.gate?.pass_count === 8 && sp016.gate?.fail_count === 0 && sp016.gate?.genuinely_failable === true,
    `gate ${JSON.stringify(sp016.gate)}`);
  return sp016.gate;
});
check('SP016_CALIBRATION_AND_REPRODUCTION_FACTS', () => {
  const p = sp016.parameters;
  requireOk(p.sufficiency_pa === 50 && p.kappa === 50 && p.lambda === 50 / 505, `parameters ${JSON.stringify(p)}`);
  requireOk(p.production_calibration_cohort?.n === 260 && p.production_calibration_cohort?.history_recipient_n === 241
    && p.production_calibration_cohort?.upper_median_historical_pa === 505, 'repaired cohort not 260/241/505');
  const legacy = sp016.reproduced_legacy_defects;
  requireOk(legacy.B_wrong_population_lambda?.exact_production_calibration_cohort_reconciliation?.raw_pre_X1_dedupe?.upper_median_historical_pa === 520,
    'raw pre-X1 520 not reproduced');
  requireOk(legacy.X1_duplicate_join?.duplicate_player_seasons === 15 && legacy.X1_duplicate_join?.raw_pa_inflation === 1628,
    'duplicate repair receipt mismatch');
  requireOk(legacy.X4_low_pa_deleted_before_sufficiency?.legacy_no_current_count === 71
    && legacy.X4_low_pa_deleted_before_sufficiency?.repaired_preserved_low_pa_count === 169, 'low-PA retention mismatch');
  requireOk(legacy.A1_non_monotonic?.minimum < legacy.A1_non_monotonic?.coefficients?.[0]
    && legacy.A3_sign_changing_error?.error_at_6_500 * legacy.A3_sign_changing_error?.error_at_200_500 < 0,
    'legacy defects not independently recorded');
  return { repaired_median: 505, raw_median: 520, lambda: p.lambda };
});
check('SP016_ALL_INVARIANTS_AND_REJECTION_FIXTURES', () => {
  requireOk(allPass(sp016.repaired_invariants), `invariants ${JSON.stringify(sp016.repaired_invariants)}`);
  requireOk(sp016.negative_fixtures?.all_rejected === true && sp016.negative_fixtures?.rows?.length >= 6
    && sp016.negative_fixtures.rows.every(row => row.rejected === true), 'negative fixtures not all rejected');
  return { invariant_count: Object.keys(sp016.repaired_invariants).length, rejection_fixtures: sp016.negative_fixtures.rows.length };
});
check('SP016_DYNAMIC_MONOTONE_ZERO_AND_MALFORMED_FAIL_CLOSED', () => {
  const opts = { poolingMode: runNorm.speedPooling.mode, sufficientWeight: 50, kappa: 50, lambda: 50 / 505 };
  const sweep = [];
  for (let pa = 0; pa <= 50; pa++) {
    const obs = [{ season: 2024, z: 1, weight: 505 }, ...(pa ? [{ season: 2025, z: 2, weight: pa }] : [])];
    sweep.push(poolAcrossYears(obs, 2025, opts));
  }
  for (let i = 1; i < sweep.length; i++) requireOk(sweep[i].historyContribution <= sweep[i - 1].historyContribution + 1e-12, `history increased at ${i}`);
  requireOk(sweep.at(-1).historyContribution === 0 && sweep.at(-1).z === 2
    && sweep.at(-1).weight === 50 && sweep.at(-1).years === 1 && sweep.at(-1).seasons.join(',') === '2025',
  'sufficiency is not exactly current-only in point or downstream reliability fields');
  const low = sweep[10];
  const expected = (10 * 2 + (50 / 505) * 505 * 1) / (10 + (50 / 505) * 505 + 50);
  requireOk(Math.abs(low.z - expected) < 1e-12, `coherent formula mismatch ${low.z} != ${expected}`);
  let malformedRejected = false;
  let duplicateRejected = false;
  try { poolAcrossYears([{ season: 2025, z: 1, weight: 0 }], 2025, opts); } catch { malformedRejected = true; }
  try { poolAcrossYears([{ season: 2025, z: 1, weight: 1 }, { season: 2025, z: 2, weight: 1 }], 2025, opts); } catch { duplicateRejected = true; }
  requireOk(malformedRejected && duplicateRejected, 'malformed or duplicate fixture accepted');
  return { history_at_49: sweep[49].historyContribution, history_at_50: sweep[50].historyContribution };
});
const dynamicDb = new DatabaseSync(full('data/pennant.db'), { readOnly: true });
check('SP016_PRODUCTION_PATH_AND_IDEMPOTENT_PURE_CALLS', () => {
  {
    const db = dynamicDb;
    const sample = db.prepare(`SELECT player_id FROM v_batting WHERE season=2025 AND pa BETWEEN 1 AND 49 AND position<>'投' ORDER BY player_id LIMIT 1`).get();
    requireOk(Boolean(sample?.player_id), 'no low-PA production fixture player');
    const context = { runNorm, fldNorm: fieldNorm, maxSeason: 2025 };
    const first = estimateDurableTraits(db, sample.player_id, 2025, context).speed;
    const second = estimateDurableTraits(db, sample.player_id, 2025, context).speed;
    requireOk(first?.poolReason === 'LOW_SAMPLE_CURRENT_YEAR_HISTORY_PRIOR', `normal low-PA path ${first?.poolReason}`);
    requireOk(JSON.stringify(first) === JSON.stringify(second), 'pure production estimate is not idempotent');
    requireOk(first.seasons.every(year => year <= 2025), `future season used ${first.seasons}`);
    const card = appraiseCard(makeContext(db, ratingCfg), {
      playerId: sample.player_id, mode: '2025', cfg: ratingCfg, rv: runValues, runNorm, fldNorm: fieldNorm,
      statPrimarySpeed: true, maxSeason: 2025,
    });
    requireOk(!card.error && card.card, `normal appraiseCard failed ${card.error}`);
    return { player_id: sample.player_id, pool_reason: first.poolReason, seasons: first.seasons };
  }
});

// SP-098: independently execute identity and coverage cases against the local DB.
const sp098 = json('outputs/derived/sp098_identity_coverage_qa_20260816.json');
check('SP098_RECEIPT_16_PASS_0_FAIL', () => {
  requireOk(sp098.mode === 'IDENTITY_COVERAGE_QA_ONLY_NOT_FINAL_2026_PRACTICAL_APPRAISAL', `mode ${sp098.mode}`);
  requireOk(sp098.external_collection_performed === false && sp098.owner_verdicts_written === 0, 'SP-098 scope breach');
  requireOk(sp098.summary?.passed === 16 && sp098.summary?.failed === 0 && sp098.summary?.result === 'PASS', `summary ${JSON.stringify(sp098.summary)}`);
  return sp098.summary;
});
check('SP098_DYNAMIC_IDENTITY_COVERAGE_AND_NEGATIVES', () => {
  {
    const db = dynamicDb;
    const context = makeContext(db, ratingCfg);
    const nahara = resolveIdentity(db, '名原 典彦', { team: '広島東洋カープ', season: 2025 });
    requireOk(nahara.status === 'IDENTITY_RESOLVED_BATTING_COVERAGE_MISSING' && nahara.playerId === null
      && nahara.canonicalKey === 'BM_PLAYER:20230057' && nahara.coverage?.firstTeamBatting === 'MISSING', `名原 ${JSON.stringify(nahara)}`);
    const naharaCard = appraiseCard(context, { name: '名原 典彦', team: '広島東洋カープ', mode: '2025', cfg: ratingCfg, rv: runValues, runNorm, fldNorm: fieldNorm, statPrimarySpeed: true, maxSeason: 2025 });
    requireOk(naharaCard.status === 'IDENTITY_RESOLVED_BATTING_COVERAGE_MISSING' && naharaCard.card === null && naharaCard.batting === null, '名原 coverage handling');
    const santana = resolveIdentity(db, 'サンタナ', { team: '東京ヤクルトスワローズ', season: 2025 });
    requireOk(santana.playerId === '53755153' && santana.dbName === 'Ｄ．サンタナ', `Santana ${JSON.stringify(santana)}`);
    const shiomi = appraiseCard(context, { name: '塩見 泰隆', team: '東京ヤクルトスワローズ', mode: '2025', cfg: ratingCfg, rv: runValues, runNorm, fldNorm: fieldNorm, statPrimarySpeed: true, maxSeason: 2025 });
    const ability = shiomi.card?.abilities?.基礎能力;
    requireOk(shiomi.card?.player_id === '71975136' && shiomi.card?._no_batting_sample === true && ability?.ミート === null && ability?.パワー === null
      && Number.isFinite(ability?.走力?.value) && Number.isFinite(ability?.肩力?.value), 'Shiomi non-batting schema');
    for (const [label, result, code] of [
      ['same surname', resolveIdentity(db, 'サンタナ', {}), 'AMBIGUOUS_IDENTITY'],
      ['wrong team', resolveIdentity(db, 'サンタナ', { team: '広島東洋カープ', season: 2025 }), 'IDENTITY_CONSTRAINT_MISMATCH'],
      ['wrong id', resolveIdentity(db, 'サンタナ', { playerId: '83585138', team: '東京ヤクルトスワローズ', season: 2025 }), 'IDENTITY_CONSTRAINT_MISMATCH'],
    ]) requireOk(result.errorCode === code, `${label} accepted: ${JSON.stringify(result)}`);
    return { nahara: nahara.canonicalKey, santana: santana.playerId, shiomi: shiomi.card.player_id };
  }
});
check('SP098_NO_SELF_FULFILLING_ID_CHECK', () => {
  const source = read('src/cards/pipeline.mjs') + read('scripts/sp063_090_098_043_022_072_074_075.mjs');
  requireOk(!/\|\|\s*!!\s*(id|playerId)/.test(source), 'non-empty id acceptance shortcut remains');
  return 'no non-empty-id shortcut';
});

// SP-100: independently assert the explicit owner-approved limited wiring.
const sp100 = json('outputs/derived/sp100_production_wiring_decision_packet_20260816.json');
const sp100Layer = json('outputs/derived/sp100_owner_approved_production_wiring_20260816.json');
const latent = json('outputs/derived/sp100_npb_raw_latent_speed.json');
check('SP100_PACKET_QA_PASS_0_FAIL', () => {
  const output = runtimeReceipts.sp100Qa;
  requireOk(output, 'missing externally executed SP-100 QA receipt');
  requireOk(/SP-100 owner-approved packet QA: \d+ PASS \/ 0 FAIL/.test(output), `unexpected SP-100 QA: ${output}`);
  return output;
});
check('SP100_EXPLICIT_OWNER_DECISION_AND_IMPLEMENTATION', () => {
  const exact = 'SP-100は N_PRIMARY_S_CONTEXT_OR_FALLBACK で承認します。Sはcontext/fallbackに留め、SとNを識別不能な重みでblendしません。';
  requireOk(sp100.status === 'DONE_VALIDATED' && sp100.decision_type === 'EXPLICIT_OWNER_APPROVED_IMPLEMENTED', `status ${sp100.status}/${sp100.decision_type}`);
  requireOk(sp100.technical_recommendation === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK', `recommendation ${sp100.technical_recommendation}`);
  requireOk(sp100.implemented_architecture === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK' && sp100.production_behavior_changed === true, 'approved architecture not implemented');
  requireOk(sp100.owner_ruling_after_v2_provenance_repair?.found === true
    && sp100.owner_ruling_after_v2_provenance_repair?.exact_owner_ruling === exact
    && sp100.owner_ruling_after_v2_provenance_repair?.owner_player_verdicts_written === 0, 'owner ruling receipt mismatch');
  requireOk(sp100.architectures?.length === 3 && sp100.architectures.every(architecture =>
    ['annual_time_alignment', 'construct_directness', 'sampling_max_statistic_caveat', 'coverage', 'provenance_safety', 'circularity', 'arbitrary_unidentifiable_weight']
      .every(key => Boolean(architecture[key]))), 'admissible architecture comparison incomplete');
  requireOk(sp100Layer.status === 'DONE_VALIDATED' && sp100Layer.summary?.current_target_population === 100
    && sp100Layer.summary?.N_primary_count === 100 && sp100Layer.summary?.S_fallback_count === 0
    && sp100Layer.production_behavior?.arithmetic_N_S_blend === false
    && sp100Layer.production_behavior?.final_practical_reappraisal_created === false, 'N-primary layer summary mismatch');
  requireOk(sp100Layer.players?.length === 100 && new Set(sp100Layer.players.map(row => row.stable_player_key)).size === 100
    && sp100Layer.players.every(row => row.selection === 'N_PRIMARY_CURRENT_2026'
      && row.no_arithmetic_n_s_blend === true
      && row.n_primary?.measurement_reliability === 'NOT_IDENTIFIABLE'
      && row.n_primary?.exposure_context?.applied_to_z === false), 'N-primary row constraint mismatch');
  return { status: sp100.status, implementation: sp100.implemented_architecture, n_primary_rows: sp100Layer.summary.N_primary_count };
});
check('SP100_TOP_SPEED_ONLY_AND_RAW_PROVENANCE_GUARD', () => {
  requireOk(latent.inputs?.hp_to_1b_sec_used === 0 && latent.measurement_reliability?.verdict === 'NOT_IDENTIFIABLE'
    && latent.measurement_reliability?.value === null && latent.exposure_proxy?.applied_to_z === false, 'latent guard state mismatch');
  let rejected = false;
  try { loadNpbPlusMeasurements(ROOT, ['hp_to_1b_sec']); } catch { rejected = true; }
  requireOk(rejected, 'hp_to_1b_sec accepted by raw provenance loader');
  return { hp_to_1b_sec_used: latent.inputs.hp_to_1b_sec_used, reliability: latent.measurement_reliability.verdict };
});
check('SP100_PACKET_SOURCE_HASHES_CURRENT', () => {
  const mismatches = Object.entries(sp100.source_hashes ?? {}).filter(([file, expected]) => fileHash(file) !== expected).map(([file]) => file);
  requireOk(mismatches.length === 0, `packet stale against ${mismatches.join(', ')}`);
  return { verified_sources: Object.keys(sp100.source_hashes).length };
});

// SP-077 and SP-078: must be queue-only and append-only, respectively.
const queueText = read('outputs/derived/sp077_final_owner_review_queue_20260816.json');
const queue = JSON.parse(queueText);
const ledger = json('outputs/derived/sp078_owner_verdict_ledger_20260816.json');
check('SP077_QUEUE_EXACT_100_UNIQUE_AND_BLANK', () => {
  requireOk(queue.schema_version === 'sp077_final_owner_review_queue_20260816' && queue.status === 'DONE_VALIDATED_PENDING_OWNER_VERDICTS', 'queue schema/status');
  requireOk(queue.players?.length === 100 && new Set(queue.players.map(row => row.queue_row_key)).size === 100, 'queue population/key uniqueness');
  requireOk(queue.population?.intended_current_100_count === 100 && queue.population?.emitted_count === 100, 'queue population counters');
  requireOk(queue.players.every(row => row.identity?.stable_player_key && row.owner_verdict?.status === 'NOT_ENTERED' && row.owner_verdict?.verdict === null), 'queue has missing key or nonblank verdict');
  return { rows: queue.players.length, verdicts: queue.players.filter(row => row.owner_verdict.verdict != null).length };
});
check('SP077_DEPENDENCY_GATE_PROVISIONAL_AND_HUMAN_REPORT', () => {
  requireOk(queue.dependency_gate?.all_declared_dependencies_closed === true && queue.dependency_gate.declared_dependencies?.length === 12, 'dependency gate result');
  const fixture = runtimeReceipts.sp077Fixture;
  requireOk(fixture, 'missing externally executed SP-077 fixture receipt');
  requireOk(fixture.includes('"result":"PASS"'), `dependency fixture ${fixture}`);
  requireOk(queue.provisional_constraints?.sp100_status === 'DONE_VALIDATED'
    && queue.provisional_constraints?.sp100_implemented_architecture === 'N_PRIMARY_S_CONTEXT_OR_FALLBACK'
    && queue.provisional_constraints?.sp100_owner_approved_wiring_active === true
    && queue.provisional_constraints?.sp100_owner_decision_required === false
    && queue.provisional_constraints?.sp071_status === 'BLOCKED_DEPENDENCY', 'missing current SP-100/SP-071 status labels');
  requireOk(queue.players.every(row => row.current_physical_evidence?.sp100_selection === 'N_PRIMARY_CURRENT_2026'
    && row.current_physical_evidence?.no_arithmetic_n_s_blend === true
    && row.current_physical_evidence?.measurement_reliability === 'NOT_IDENTIFIABLE'
    && row.provisional_status?.sp100_owner_decision_required === false
    && row.provisional_status?.sp100_owner_approved_wiring_active === true), 'queue does not expose N-primary/no-blend fields for all rows');
  const report = read('docs/reports/sp077_final_owner_review_queue_20260816.md');
  requireOk(!report.includes('[object Object]'), 'human queue report serializes a field as [object Object]');
  requireOk(report.includes('Queue coverage: **100/100**') && report.includes('No owner verdict is entered.'), 'human report missing queue/verdict statement');
  return { fixture, sp100: queue.provisional_constraints.sp100_status };
});
check('SP077_SOURCE_HASHES_AND_SCOPE_GUARDS', () => {
  const mismatches = Object.entries(queue.source_hashes ?? {}).filter(([file, expected]) => fileHash(file) !== expected).map(([file]) => file);
  requireOk(mismatches.length === 0, `queue stale against ${mismatches.join(', ')}`);
  requireOk(Object.values(queue.scope_guards ?? {}).every(value => value === true), `queue scope guards ${JSON.stringify(queue.scope_guards)}`);
  return { verified_sources: Object.keys(queue.source_hashes).length, scope_guards: queue.scope_guards };
});
check('SP078_EMPTY_LEDGER_LINKED_TO_FINAL_QUEUE', () => {
  requireOk(ledger.schema_version === 'sp078_owner_verdict_ledger_20260816' && Array.isArray(ledger.records) && ledger.records.length === 0
    && ledger.owner_verdict_count === 0, 'ledger is non-empty');
  requireOk(ledger.queue_source?.row_count === 100 && ledger.queue_source?.sha256 === sha256(queueText), 'ledger queue hash mismatch');
  requireOk(ledger.append_update_semantics?.ordinary_duplicate_write === 'REJECTED_NO_SILENT_OVERWRITE'
    && ledger.append_update_semantics?.amendment === 'APPEND_ONLY_REQUIRES_EXPLICIT_SUPERSEDES_EVENT_ID'
    && ledger.append_update_semantics?.historical_events_preserved === true, 'append-only semantics missing');
  return { rows: ledger.queue_source.row_count, verdict_count: ledger.owner_verdict_count };
});
check('SP078_NO_OVERWRITE_SELF_TEST', () => {
  const output = runtimeReceipts.sp078SelfTest;
  requireOk(output, 'missing externally executed SP-078 self-test receipt');
  requireOk(output.includes('"self_test":"PASS"') && output.includes('"duplicate_overwrite_rejected":true')
    && output.includes('"explicit_amendment_preserves_history":true')
    && output.includes('"empty_reinitialization_rebinds_current_queue":true')
    && output.includes('"nonempty_reinitialization_rejected":true'), `SP-078 self test ${output}`);
  return output;
});

// Wave-wide guards and invariants.
check('SP075_AND_COMMUNITY_INVARIANT_HASHES_UNCHANGED', () => {
  const expected = {
    'outputs/derived/sp075_stale_conflict_rediagnosis_v4_20260816.json': '610db284b6c4d55adc507d217d503fff108026f7ad13cbfc9f6a4a68d4a8a250',
    'outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl': 'ce5b1a3f0c002daa36a2dc86678a596edc95be4e4e57716072894c8f11921a85',
    'outputs/derived/speed_community_v3_canonical_20260815.jsonl': '9bb9e9cc0df7646840e7b584756d7501ecad475df1410ebc72d549fda09ad058',
    'outputs/derived/speed_x_excluded_prospi_20260816.jsonl': 'aade4c19937484741ccb4b3622e1596d3a241b333bfb63a10a89d0561e09ec0d',
  };
  const mismatch = Object.entries(expected).filter(([file, expectedHash]) => fileHash(file) !== expectedHash).map(([file]) => file);
  requireOk(mismatch.length === 0, `invariant hash mismatch ${mismatch.join(', ')}`);
  return expected;
});
check('PRODUCTION_SCALE_FINALIZATION_UNCHANGED', () => {
  requireOk(runtimeReceipts.ratingsConfigUnchanged === 'true', 'git reports configs/ratings.json changed');
  const speed = ratingCfg.scale_calibration?.applied?.走力;
  requireOk(speed?.slope === 1.8883315802194052 && speed?.intercept === -29.54411881474512 && speed?._n === 260,
    `unexpected production speed scale ${JSON.stringify(speed)}`);
  return { slope: speed.slope, intercept: speed.intercept, n: speed._n };
});
check('NO_POWERPRO_TEACHER_OR_FUTURE_ANNUAL_WEIGHTING', () => {
  const traits = read('src/ratings/durable_traits.mjs');
  const repairedMode = traits.split('export function currentYearFirstLowSamplePrior')[1]
    .split(/\/\*\*\r?\n \* SP-016 continuous/)[0];
  const executableRepairedMode = repairedMode.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  requireOk(!/PowerPro|パワプロ/.test(executableRepairedMode), 'PowerPro mention in repaired speed path');
  requireOk(!/next.year|future.year|翌年|RMSE/.test(executableRepairedMode), 'future-year selection logic in repaired mode');
  requireOk(read('src/cards/durable_estimate.mjs').includes('maxSeason'), 'production speed path has no max-season boundary');
  return 'repaired sources contain no PowerPro teacher or future-year weighting path';
});
check('NO_EXTERNAL_COLLECTION_AND_FORBIDDEN_WORK_SCOPE', () => {
  requireOk(runtimeReceipts.changedPaths, 'missing externally captured changed-path receipt');
  const changed = new Set(runtimeReceipts.changedPaths.split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !line.startsWith('warning:')));
  const allowed = new Set([
    'configs/running_norms.json', 'docs/state/speed_exclusion_reason_ledger.tsv', 'docs/state/speed_task_registry.tsv',
    'outputs/derived/sp100_npb_raw_latent_speed.json', 'outputs/derived/sp100_wiring_candidates_20260814.json',
    'scripts/qa_speed_task_registry.mjs', 'scripts/sp063_090_098_043_022_072_074_075.mjs', 'scripts/sp100_npb_raw_latent_speed.mjs',
    'src/cards/durable_estimate.mjs', 'src/cards/pipeline.mjs', 'src/ratings/durable_traits.mjs', 'src/ratings/direct_measurement.mjs',
    'src/ratings/sp100_npb_primary_speed.mjs', 'src/ratings/sp100_production_wiring.mjs',
    'docs/audits/sp016_current_year_first_repair_20260816.md', 'docs/audits/sp098_identity_coverage_qa_20260816.md',
    'docs/audits/sp100_production_wiring_decision_packet_20260816.md', 'docs/audits/sp100_owner_decision_20260816.md',
    'docs/audits/sp100_owner_approved_production_wiring_20260816.md', 'docs/audits/sp100_owner_approved_wiring_20260816.md',
    'docs/reports/sp077_final_owner_review_queue_20260816.md',
    'outputs/derived/sp016_current_year_first_repair_qa_20260816.json', 'outputs/derived/sp077_final_owner_review_queue_20260816.csv',
    'outputs/derived/sp077_final_owner_review_queue_20260816.json', 'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
    'outputs/derived/sp098_identity_coverage_qa_20260816.json', 'outputs/derived/sp100_production_wiring_decision_packet_20260816.json',
    'outputs/derived/sp100_owner_approved_production_wiring_20260816.json', 'outputs/derived/qa_sp100_owner_approved_wiring_20260816.json',
    'scripts/build_sp077_final_owner_review_queue_20260816.mjs', 'scripts/build_sp100_owner_approved_production_wiring_20260816.mjs',
    'scripts/qa_sp100_production_wiring_decision_packet_20260816.mjs', 'scripts/qa_sp100_owner_approved_wiring_20260816.mjs',
    'scripts/sp016_current_year_first_repair_qa_20260816.mjs', 'scripts/sp078_owner_verdict_capture_20260816.mjs',
    'scripts/sp098_identity_coverage_qa_20260816.mjs', 'scripts/sp100_production_wiring_decision_packet_20260816.mjs',
    'scripts/test_qa_remaining.mjs',
    'scripts/qa_opus_speed_pre_owner_review_wave_20260816.mjs', OUT, AUDIT,
  ]);
  const unexpected = [...changed].filter(file => !allowed.has(file));
  requireOk(unexpected.length === 0, `out-of-scope changed paths: ${unexpected.join(', ')}`);
  requireOk(![...changed].some(file => /(^|\/)(shoulder|sp079|sp080|sp081)/i.test(file)), `forbidden work path: ${[...changed].join(', ')}`);
  const changedScripts = [...changed].filter(file => (file.startsWith('scripts/') || file.startsWith('src/'))
    && file !== 'scripts/qa_opus_speed_pre_owner_review_wave_20260816.mjs');
  const networkPattern = /\bfetch\s*\(|https?\.request\s*\(|axios\b|undici\b|playwright\b|puppeteer\b|selenium\b/;
  const networked = changedScripts.filter(file => networkPattern.test(read(file)));
  requireOk(networked.length === 0, `network collection API in ${networked.join(', ')}`);
  return { changed_path_count: changed.size, changed_scripts: changedScripts.length };
});

const passed = checks.filter(checkResult => checkResult.pass).length;
const failed = checks.length - passed;
const keyArtifactHashes = Object.fromEntries(keyFiles.filter(file => fs.existsSync(full(file))).map(file => [file, fileHash(file)]));
const renderDetail = value => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
};
const result = {
  schema_version: 'qa_opus_speed_pre_owner_review_wave_20260816',
  generated_at: '2026-08-16',
  qa_authority: 'independent_read_only_wave_qa',
  collection: 'NO_NETWORK_OR_EXTERNAL_COLLECTION',
  owner_verdicts_written: ledger.owner_verdict_count,
  checks,
  summary: { passed, failed, result: failed === 0 ? 'PASS' : 'FAIL' },
  key_artifact_sha256: keyArtifactHashes,
  remaining_blockers_to_sp079: [
    'Owner review/verdict input has not been entered: SP-078 ledger intentionally contains zero real verdicts.',
  ],
  non_blocking_provisional_limitations: [
    'SP-071 absolute 0-100 scale finalization remains blocked on the engine bridge; it is retained as a provisional label, not a declared SP-079 dependency.',
  ],
};
fs.mkdirSync(path.dirname(full(OUT)), { recursive: true });
fs.mkdirSync(path.dirname(full(AUDIT)), { recursive: true });
fs.writeFileSync(full(OUT), JSON.stringify(result, null, 2) + '\n', 'utf8');

const audit = [
  '# OPUS speed pre-owner-review wave — independent QA',
  '',
  'Date: 2026-08-16',
  '',
  'This is an independent re-read and local execution check. It does not regenerate individual workstream artifacts, modify the registry, collect external data, or enter owner verdicts.',
  '',
  '## Result',
  '',
  `- **${passed} PASS / ${failed} FAIL — ${result.summary.result}**`,
  `- Registry QA: PASS; SP-016 receipt: 8 PASS / 0 FAIL; SP-098 receipt: 16 PASS / 0 FAIL; ${runtimeReceipts.sp100Qa.match(/SP-100 owner-approved packet QA: \d+ PASS \/ 0 FAIL/)?.[0] ?? 'SP-100 packet QA PASS receipt supplied'}.`,
  `- Real owner verdicts: **${ledger.owner_verdict_count}**.`,
  '',
  '## Content-level conclusions',
  '',
  '- SP-016: repaired mode is production default. At 50 PA or more history is exactly absent; below 50 PA the coherent zero-centred prior uses kappa=50 and lambda=50/505. Raw 520 historical-PA median is reproduced before split-team deduplication; corrected calibrated cohort is 260 / 241 / 505.',
  '- SP-098: 名原 is `BM_PLAYER:20230057` with batting coverage missing, Santana is exact `53755153`, and Shiomi is exact `71975136` with AB=0/non-batting schema retained. Negative same-surname/wrong-team/wrong-id cases reject.',
  '- SP-100: DONE_VALIDATED. The explicit owner ruling implements `N_PRIMARY_S_CONTEXT_OR_FALLBACK` as the current 2026 N-primary physical/rank layer for 100/100 rows; S remains separate context/fallback, `hp_to_1b_sec` remains rejected, and no final SP-079 rating is created.',
  '- SP-077: exact 100/100 unique stable rows, zero verdicts, dependency fixture rejects an open declared dependency, and the human report contains readable SP-074 states.',
  '- SP-078: initialized empty ledger binds to the final queue hash; ordinary overwrite rejects and explicit amendments preserve history.',
  '- SP-075/Community invariant hashes and the production scale-finalization configuration are unchanged. No new external collection, shoulder work, SP-079/SP-080/SP-081 work, individual PowerPro teacher, or future-year annual-appraisal weighting was found.',
  '',
  '## Exact remaining blockers to SP-079',
  '',
  ...result.remaining_blockers_to_sp079.map(item => `- ${item}`),
  '',
  '## Non-blocking provisional limitation',
  '',
  ...result.non_blocking_provisional_limitations.map(item => `- ${item}`),
  '',
  '## Check ledger',
  '',
  '| Check | Result | Detail |',
  '|---|---|---|',
  ...checks.map(item => `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${renderDetail(item.detail).replace(/\|/g, '\\|').replace(/\n/g, '<br>')} |`),
  '',
  '## SHA-256 of key artifacts',
  '',
  ...Object.entries(keyArtifactHashes).map(([file, hash]) => `- \`${file}\`: \`${hash}\``),
  '',
].join('\n');
fs.writeFileSync(full(AUDIT), audit, 'utf8');

console.log(JSON.stringify(result.summary));
if (failed) process.exitCode = 1;

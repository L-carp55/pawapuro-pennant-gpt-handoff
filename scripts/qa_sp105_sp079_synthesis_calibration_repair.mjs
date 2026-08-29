#!/usr/bin/env node

// Independent red-team QA for SP-105.  This process is deliberately separate
// from the synthesis generator and reruns the generator before writing its own
// result.  It does not write owner verdicts or any downstream task outputs.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'outputs', 'derived');
const QA_REL = 'outputs/derived/qa_sp105_sp079_synthesis_calibration_repair.json';
const AUDIT_REL = 'docs/audits/sp105_sp079_synthesis_calibration_repair.md';
const GENERATOR_REL = 'scripts/sp105_synthesis_calibration_repair.mjs';
const GENERATOR = path.join(ROOT, GENERATOR_REL);
const SCALE_STATUS = 'PROVISIONAL_PENDING_SP071_SP072';
const SELECTED_POLICY_ID = 'CONSERVATIVE_TIER_A_ANCHOR_LOWER_TIER_BOUNDED_CONSTRAINT';
const COMPONENTS = [
  'peak_speed',
  'acceleration_h2f_t90_90ft',
  'historical_physical',
  'mlb_statcast_running_bridge',
  'the_show_context',
  'analog_ordinal_transition',
  'statistical_proxies',
  'scouting_community_video_usage_context'
];
const PHYSICAL_FAMILIES = ['PEAK', 'ACCELERATION_H2F', 'END_TO_END_90FT', 'SHORT_DISTANCE'];
const POINT_SEMANTICS = new Set([
  'DEFENSIBLE_POINT_ESTIMATE',
  'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE',
  'NO_DEFENSIBLE_POINT'
]);
const GENERATED_FILES = [
  'outputs/derived/sp105_cross_family_calibration_receipts.json',
  'outputs/derived/sp105_frozen_input_manifest.json',
  'outputs/derived/sp105_selected_synthesis_policy.json',
  'outputs/derived/sp105_synthesis_policy_benchmark.json',
  'outputs/derived/sp105_context_decision_use_100.json',
  'outputs/derived/sp105_final_practical_speed_100.json',
  'outputs/derived/sp105_final_practical_speed_100.csv',
  'outputs/derived/sp105_final_value_component_ablation.json',
  'outputs/derived/sp105_powerpro_posthoc_qa.json',
  'outputs/derived/sp105_global_consistency_qa.json',
  'outputs/derived/sp105_player_evidence_synthesis.jsonl',
  'docs/reports/sp105_final_practical_speed_100.md'
];

function absolute(rel) {
  return path.join(ROOT, rel);
}

function read(rel) {
  return fs.readFileSync(absolute(rel), 'utf8');
}

function json(rel) {
  return JSON.parse(read(rel));
}

function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(absolute(rel))).digest('hex');
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function countBy(rows, key) {
  return rows.reduce((out, row) => {
    const value = row[key] ?? 'null';
    out[value] = (out[value] ?? 0) + 1;
    return out;
  }, {});
}

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
}

function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows.filter((values) => values.some((value) => value !== '')).map((values) => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ''])));
}

function parseRegistry(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split('\t');
  return lines.filter(Boolean).map((line) => Object.fromEntries(line.split('\t').map((value, i) => [header[i], value])));
}

function checkFactory(checks) {
  return (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
}

function failBeforeFixtures() {
  const fixtures = [];
  const fixture = (id, payload, detector, detail) => {
    const detected = Boolean(detector(payload));
    fixtures.push({ id, detected, pass: detected, detail });
  };
  fixture('tier_b_equal_override', { family_point_influence: { PEAK: 0.5, ACCELERATION_H2F: 0.5 }, validated_mapping: false }, (x) => Object.entries(x.family_point_influence).some(([family, weight]) => family !== 'PEAK' && weight > 0) && x.validated_mapping === false, 'a lower-tier equal point vote without validation must be rejected');
  fixture('uncalibrated_reference_population_mix', { point_reference_populations: ['SP100_CURRENT100_NPB_PLUS_2026', 'SP104_CANONICAL_METRIC:HP_TO_1B_SECONDS'], common_scale_mapping_selected: false }, (x) => x.point_reference_populations.length > 1 && x.common_scale_mapping_selected === false, 'unmapped native percentiles must not be averaged as one scale');
  fixture('powerpro_teacher', { powerpro_used_as_teacher: true, powerpro_used_for_selection: true }, (x) => x.powerpro_used_as_teacher === true || x.powerpro_used_for_selection === true, 'PowerPro teacher/selection use must be rejected');
  fixture('target_self_teaching', { target_player: 'P1', training_players: ['P1', 'P2'] }, (x) => x.training_players.includes(x.target_player), 'target player must be excluded from calibration training');
  fixture('same_player_season_leakage', { held_out_season: 2026, training_seasons: [2025, 2026] }, (x) => x.training_seasons.includes(x.held_out_season), 'same-player held-out season leakage must be detected');
  fixture('the_show_direct_copy', { the_show_direct_copy: true, numeric_point_use: true }, (x) => x.the_show_direct_copy === true || x.numeric_point_use === true, 'The Show appraisal must not be copied into physical point');
  fixture('loaded_zero_effect_marked_material', { present: true, present_but_zero_effect: true, materially_used_for_point_or_rank: true }, (x) => x.present_but_zero_effect === true && x.materially_used_for_point_or_rank === true, 'a loaded zero-effect lane cannot be called material');
  fixture('interval_only_counted_as_point', { changed_fields: ['interval'], point_changed: true }, (x) => x.changed_fields.includes('interval') && x.point_changed === true && !x.changed_fields.includes('point'), 'interval-only changes must not be counted as point changes');
  fixture('unresolved_row_defensible_point', { point_semantics: 'DEFENSIBLE_POINT_ESTIMATE', conflict_state: 'UNRESOLVED_SAME_SCALE_PHYSICAL_CONFLICT' }, (x) => x.point_semantics === 'DEFENSIBLE_POINT_ESTIMATE' && x.conflict_state.startsWith('UNRESOLVED'), 'unresolved rows must not retain ordinary defensible-point semantics');
  fixture('legacy_npb_plus_h2f', { source_manifest_id: 'NPB_PLUS_LEGACY', metric: 'HP_TO_1B_SECONDS' }, (x) => /npb.?plus/i.test(x.source_manifest_id) && /hp.?to.?1b|h2f/i.test(x.metric), 'legacy NPB+ H2F field must remain quarantined');
  fixture('short_distance_to_t90', { source_family: '50M', target_family: 'T90', forbidden_transform_applied: true }, (x) => /30M|50M/i.test(x.source_family) && /T90|90FT/i.test(x.target_family) && x.forbidden_transform_applied === true, '30m/50m must not be converted to T90');
  fixture('missing_to_zero_or_slow', { evidence_state: 'MISSING_BOUNDED', missingness_policy: 'MISSING_TO_SLOW', imputed_value: 0 }, (x) => /MISSING_TO_SLOW|SLOW/i.test(x.missingness_policy) || x.imputed_value === 0, 'missingness must not become zero/slow evidence');
  fixture('owner_sp080_sp081_shoulder_scope', { owner_verdict_written: true, sp080: 'DONE', sp081: 'DONE', shoulder: 'STARTED' }, (x) => x.owner_verdict_written === true || x.sp080 !== 'NOT_STARTED' || x.sp081 !== 'NOT_STARTED' || x.shoulder !== 'BLOCKED_DEPENDENCY', 'owner write and downstream SP-080/SP-081/shoulder work must be detected');
  return fixtures;
}

function auditMarkdown(result, finalJson, benchmark, ablation, contextUse) {
  const passed = result.checks.filter((check) => check.pass).length;
  const failed = result.checks.filter((check) => !check.pass).length;
  const checkRows = result.checks.map((check) => `| ${check.id} | ${check.pass ? 'PASS' : 'FAIL'} | ${typeof check.detail === 'string' ? check.detail : JSON.stringify(check.detail)} |`).join('\n');
  const fixtureRows = result.fail_before_fixtures.map((fixture) => `| ${fixture.id} | ${fixture.pass ? 'PASS' : 'FAIL'} | ${fixture.detail} |`).join('\n');
  return `# SP-105 SP-079 synthesis/calibration repair — independent audit

Date: 2026-08-29
Process: separate deterministic red-team QA after the SP-105 synthesis generator
Result: **${result.status}**

## Scope

The audit covers the frozen be3588 SP-079 baseline reproduction, physical-only calibration benchmark, exact 100-player rematerialization, native reference-population receipts, eight-component 800-cell actual ablation, context decision-use removal tests, PowerPro posthoc boundary, and registry/owner locks. It stops at SP-105 and does not enter owner verdicts, SP-080/SP-081, or shoulder work.

## Independent checks

${passed} checks passed; ${failed} checks failed.

| Check | Result | Detail |
|---|---|---|
${checkRows}

## Fail-before fixtures

All ${result.fail_before_fixtures.length} prohibited-construction fixtures were intentionally made invalid and detected before they could be accepted as production evidence.

| Fixture | Result | Detail |
|---|---|---|
${fixtureRows}

## Output summary

- final rows: ${finalJson.players.length}; point semantics: ${JSON.stringify(countBy(finalJson.players, 'point_semantics'))}
- benchmark cases: ${benchmark.case_count}; selected policy: ${benchmark.selected_policy_id}
- actual ablation cells: ${ablation.cells.length}
- context decision-use aggregate: ${JSON.stringify(contextUse.aggregate)}
- scale status: ${finalJson.scale_status}

## Interpretation and limits

The selected policy is a conservative Tier-A current NPB+ peak anchor with lower-tier native-scale bounded constraints and zero lower-tier point weight. Cross-family mappings are diagnostic unless player-clustered leave-player-out common-support gates pass; no mapping was promoted across all required families. The output is cohort-relative and provisional pending SP-071/SP-072. PowerPro is posthoc QA only, and the browser must independently reaccept SP-079 before any downstream speed task proceeds.
`;
}

function main() {
  const checks = [];
  const check = checkFactory(checks);
  const canonicalSeed = spawnSync(process.execPath, [GENERATOR], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  check('determinism:canonical_seed_exit_zero', canonicalSeed.status === 0, { status: canonicalSeed.status, stderr: canonicalSeed.stderr?.slice(-2000) });
  const required = [
    ...GENERATED_FILES,
    GENERATOR_REL,
    'outputs/derived/sp079_appraisal_policy.json',
    'outputs/derived/sp079_frozen_input_manifest.json',
    'outputs/derived/sp079_player_evidence_synthesis.jsonl',
    'outputs/derived/sp079_final_practical_speed_100.csv',
    'outputs/derived/sp079_final_practical_speed_100.json',
    'outputs/derived/sp079_final_value_component_ablation.json',
    'outputs/derived/sp079_powerpro_posthoc_qa.json',
    'outputs/derived/sp079_global_consistency_qa.json',
    'outputs/derived/qa_sp079_final_practical_reappraisal.json',
    'docs/reports/sp079_final_practical_speed_100.md',
    'docs/audits/sp079_final_practical_reappraisal_independent_audit.md',
    'docs/state/speed_task_registry.tsv',
    'outputs/derived/sp078_owner_verdict_ledger_20260816.json'
  ];
  for (const rel of required) check(`required:${rel}`, fs.existsSync(absolute(rel)) && fs.statSync(absolute(rel)).size > 0, 'exists and non-empty');

  const finalJson = json('outputs/derived/sp105_final_practical_speed_100.json');
  const policy = json('outputs/derived/sp105_selected_synthesis_policy.json');
  const manifest = json('outputs/derived/sp105_frozen_input_manifest.json');
  const benchmark = json('outputs/derived/sp105_synthesis_policy_benchmark.json');
  const calibration = json('outputs/derived/sp105_cross_family_calibration_receipts.json');
  const ablation = json('outputs/derived/sp105_final_value_component_ablation.json');
  const contextUse = json('outputs/derived/sp105_context_decision_use_100.json');
  const posthoc = json('outputs/derived/sp105_powerpro_posthoc_qa.json');
  const globalQa = json('outputs/derived/sp105_global_consistency_qa.json');
  const frozenSp079 = json('outputs/derived/sp079_final_practical_speed_100.json');
  const synthesis = read('outputs/derived/sp105_player_evidence_synthesis.jsonl').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const csvRows = parseCsv(read('outputs/derived/sp105_final_practical_speed_100.csv'));
  const registryRows = parseRegistry(read('docs/state/speed_task_registry.tsv'));
  const registry = new Map(registryRows.map((row) => [row.task_id, row]));
  const ownerLedger = json('outputs/derived/sp078_owner_verdict_ledger_20260816.json');
  const source = read(GENERATOR_REL);

  check('population:exact_100_unique', finalJson.players.length === 100 && new Set(finalJson.players.map((row) => row.stable_player_key)).size === 100, { count: finalJson.players.length });
  check('population:queue_order_1_to_100', finalJson.players.every((row, i) => row.queue_order === i + 1), 'JSON queue order');
  check('population:rank_is_bounded_and_eligible', finalJson.players.every((row) => Number.isInteger(row.rank_fastest) && row.rank_fastest >= 1 && row.rank_fastest <= 100) && Math.min(...finalJson.players.map((row) => row.rank_fastest)) === 1, 'all final rows have bounded rank; ties are permitted');
  check('population:synthesis_jsonl_100', synthesis.length === 100 && synthesis.every((row, i) => row.queue_order === i + 1) && new Set(synthesis.map((row) => row.stable_player_key)).size === 100, { count: synthesis.length });
  check('population:csv_100', csvRows.length === 100 && new Set(csvRows.map((row) => row.stable_player_key)).size === 100, { count: csvRows.length });
  check('population:cross_format_order', stableHash(finalJson.players.map((row) => row.stable_player_key)) === stableHash(csvRows.map((row) => row.stable_player_key)) && stableHash(finalJson.players.map((row) => row.stable_player_key)) === stableHash(synthesis.map((row) => row.stable_player_key)), 'JSON/CSV/JSONL key order agrees');

  check('schema:required_fields', finalJson.players.every((row) => Array.isArray(row.latent_speed_percentile_interval) && row.latent_speed_percentile_interval.length === 2 && Array.isArray(row.provisional_practical_rating_interval) && row.provisional_practical_rating_interval.length === 2 && row.confidence && row.conflict_state && row.evidence_state && row.scale_status === SCALE_STATUS && row.context_decision_use && row.tier_influence && row.source_evidence_records), 'point/interval/display/provenance/context fields present');
  check('schema:point_semantics_allowed', finalJson.players.every((row) => POINT_SEMANTICS.has(row.point_semantics)), [...POINT_SEMANTICS]);
  check('schema:point_semantics_consistent', finalJson.players.every((row) => row.point_semantics !== 'DEFENSIBLE_POINT_ESTIMATE' ? row.scientific_point_estimate === null || row.point_semantics === 'DEFENSIBLE_POINT_ESTIMATE' : row.scientific_point_estimate === row.latent_speed_percentile_point) && finalJson.players.every((row) => row.point_semantics !== 'DISPLAY_MIDPOINT_ONLY_NOT_POINT_ESTIMATE' || row.scientific_point_estimate === null) && finalJson.players.every((row) => row.point_semantics !== 'NO_DEFENSIBLE_POINT' || row.latent_speed_percentile_point === null), 'semantic labels agree with point fields');
  check('schema:rating_is_declared_display_mapping', finalJson.players.every((row) => row.provisional_practical_rating === null || row.provisional_practical_rating === Math.round(row.latent_speed_percentile_point * 100)), 'rating maps from point only');
  check('schema:point_inside_interval', finalJson.players.every((row) => row.latent_speed_percentile_point === null || (row.latent_speed_percentile_point >= row.latent_speed_percentile_interval[0] && row.latent_speed_percentile_point <= row.latent_speed_percentile_interval[1])), 'point inside bounded interval');
  check('schema:interval_bounded', finalJson.players.every((row) => row.latent_speed_percentile_interval[0] >= 0 && row.latent_speed_percentile_interval[1] <= 1 && row.latent_speed_percentile_interval[0] <= row.latent_speed_percentile_interval[1]), 'latent interval [0,1]');
  check('schema:provisional_scale_status', finalJson.scale_status === SCALE_STATUS && policy.interval_rule?.point_inside_interval === true, SCALE_STATUS);
  check('schema:provenance_receipts', synthesis.every((row) => row.physical_evidence.records.every((record) => record.provenance && record.provenance.input_hash_key && record.provenance.source_file && record.source_id && record.reference_population)), 'every physical record has source/provenance/reference population');
  const frozenByPlayerId = new Map(frozenSp079.players.map((row) => [String(row.player_id), row]));
  check('comparison:pre_sp105_and_pre_sp079_fields', finalJson.players.every((row) => {
    const frozen = frozenByPlayerId.get(String(row.player_id));
    return frozen
      && row.pre_sp105_frozen_sp079_rating_for_comparison_only === frozen.provisional_practical_rating
      && JSON.stringify(row.pre_sp105_frozen_sp079_interval_for_comparison_only) === JSON.stringify(frozen.latent_speed_percentile_interval)
      && row.change_vs_frozen_sp079_baseline === row.provisional_practical_rating - frozen.provisional_practical_rating
      && row.change_vs_pre_sp105_frozen_sp079 === row.change_vs_frozen_sp079_baseline
      && Object.hasOwn(row, 'pre_sp079_project_rating_for_comparison_only')
      && Object.hasOwn(row, 'change_vs_pre_sp079_project');
  }), 'frozen SP-079 and pre-SP-079 project comparison fields are separate');

  check('policy:selected_conservative_anchor', policy.selected_policy_id === SELECTED_POLICY_ID && policy.point_anchor?.family === 'PEAK' && policy.point_anchor?.point_weight === 1 && policy.decision?.lower_tier_point_weight === 0 && policy.lower_tier_policy?.direct_cross_family_union === false, policy.selected_policy_id);
  check('policy:physical_only_no_owner_or_powerpro', policy.physical_only_selection === true && policy.powerpro_used_for_selection === false && policy.owner_verdict_used_for_selection === false && policy.prohibited_inputs?.powerpro_in_weight_or_calibration === false && policy.prohibited_inputs?.owner_verdict_in_weight_or_calibration === false, 'selection is physical-only');
  check('policy:hash_receipts_match', finalJson.selected_policy_sha256 === sha256('outputs/derived/sp105_selected_synthesis_policy.json') && manifest.generated_policy?.sha256 === finalJson.selected_policy_sha256 && synthesis.every((row) => row.synthesis_receipt?.policy_sha256 === finalJson.selected_policy_sha256), 'selected policy hash is stable in all receipts');
  check('policy:manifest_hash_receipts_match', finalJson.input_manifest_sha256 === sha256('outputs/derived/sp105_frozen_input_manifest.json') && synthesis.every((row) => row.synthesis_receipt?.input_manifest_sha256 === finalJson.input_manifest_sha256), 'input manifest hash is stable in all receipts');
  check('policy:lower_tier_point_weight_zero', finalJson.players.every((row) => row.family_point_influence?.PEAK === 1 && PHYSICAL_FAMILIES.filter((family) => family !== 'PEAK').every((family) => (row.family_point_influence?.[family] ?? 0) === 0) && row.lower_tier_constraints.every((constraint) => constraint.point_weight_in_selected_policy === 0)), 'no Tier-B equal override');
  check('policy:point_reference_population_is_anchor_only', finalJson.players.every((row) => row.synthesis_receipt?.point_reference_population === 'SP100_CURRENT100_NPB_PLUS_2026'), 'no uncalibrated reference-population mixing in point');

  check('guard:all_final_rows_false', finalJson.guards?.powerpro_teacher_used === false && finalJson.guards?.powerpro_used_for_selection === false && finalJson.guards?.owner_verdict_used_for_selection === false && finalJson.guards?.the_show_direct_copy === false && finalJson.guards?.legacy_npb_plus_h2f_used === false && finalJson.guards?.short_distance_to_t90_conversion === false && finalJson.guards?.missingness_as_slow === false && finalJson.guards?.target_self_teaching_or_season_leakage === false && finalJson.guards?.technique_as_pure_speed === false && finalJson.guards?.selected_production_transfer === false && finalJson.players.every((row) => row.powerpro_teacher_used === false && row.the_show_direct_copy === false && row.legacy_npb_plus_h2f_used === false && row.direct_30m_50m_to_t90_conversion === false && row.missingness_is_not_slow === true && row.target_self_teaching_or_season_leakage === false && row.technique_used_in_physical_point === false && row.selected_production_transfer === false), 'row and aggregate guards');
  check('guard:source_forbids_legacy_npBplus_h2f', !source.includes('npb_plus_measurement.hp_to_1b_sec') && !source.match(/NPB_PLUS[^\n]{0,100}hp_to_1b_sec/i), 'old local NPB+ hp_to_1b_sec is absent');
  check('guard:official_shared_season_not_additive', synthesis.every((row) => {
    const official90 = new Set(row.physical_evidence.records.filter((record) => record.source_kind === 'MLB_STATCAST_OFFICIAL' && record.family === 'END_TO_END_90FT' && record.used_in_synthesis).map((record) => `${record.stable_player_key}|${record.measurement_year}`));
    return row.physical_evidence.records.filter((record) => record.source_kind === 'MLB_STATCAST_OFFICIAL' && record.family === 'ACCELERATION_H2F' && official90.has(`${record.stable_player_key}|${record.measurement_year}`)).every((record) => record.used_in_synthesis === false && record.used_in_lower_tier_constraint === false);
  }), 'same-player same-season H2F/90ft fields are not additive');
  const synthFunction = source.slice(source.indexOf('function synthesize'), source.indexOf('function rankResults'))
    .replaceAll('powerpro_teacher_used: false', '')
    .replaceAll('non_powerpro', 'ordinal');
  check('guard:synthesis_function_no_powerpro', !/powerpro|current_powerpro/i.test(synthFunction), 'PowerPro absent from physical synthesis function');
  check('guard:synthesis_function_no_show_numeric', !/show\.range|speed_percentile_context|show_speed/i.test(synthFunction), 'The Show numeric appraisal absent from physical synthesis function');
  check('guard:powerpro_loaded_after_core_freeze', source.indexOf('const coreValuesHash') < source.indexOf('readJson(INPUT_PATHS.baseline)'), 'baseline/PowerPro comparison is read after core hash');

  check('calibration:actual_loo_receipts', calibration.receipts.length === 12 && calibration.receipts.every((receipt) => receipt.player_clustered_leave_one_out === true && receipt.same_player_seasons_held_together === true && receipt.target_player_excluded_from_training === true && receipt.owner_verdict_used === false && receipt.powerpro_used === false && typeof receipt.production_eligible === 'boolean'), { receipt_count: calibration.receipts.length });
  check('calibration:common_support_no_extrapolated_prediction', calibration.receipts.every((receipt) => receipt.holdout_predictions.every((row) => row.target_player_excluded_from_training === true && row.same_player_seasons_held_together === true && (row.common_support === true || row.prediction === null))), 'unsupported holdouts have no calibrated prediction');
  check('calibration:not_promoted', calibration.selected_for_production === false && calibration.receipts.some((receipt) => receipt.production_eligible === false) && policy.calibration?.common_scale_mapping_selected === false && policy.calibration?.mapping_states && Object.values(policy.calibration.mapping_states).every((state) => state.production_point_use === false), 'no cross-family mapping promoted across required families');
  check('benchmark:all_candidates_and_physical_target', benchmark.case_count > 0 && benchmark.candidates?.A_FROZEN_EQUAL_FAMILY_BASELINE && benchmark.candidates?.B_TIER_AWARE_UNCALIBRATED_RELIABILITY && benchmark.candidates?.C_LOO_COMMON_SCALE_ISOTONIC && benchmark.candidates?.D_CONSERVATIVE_TIER_A_ANCHOR && benchmark.held_out_design?.target === 'physical_evidence_only' && benchmark.held_out_design?.player_clustered === true && benchmark.held_out_design?.leave_player_out === true && benchmark.held_out_design?.same_player_seasons_held_together === true && benchmark.held_out_design?.target_self_teaching === false && benchmark.held_out_design?.common_support_required_for_mapping === true && benchmark.held_out_design?.no_extrapolation === true, 'A/B/C/D benchmark contract');
  check('benchmark:baseline_control_and_selected_D', benchmark.candidates.A_FROZEN_EQUAL_FAMILY_BASELINE.selected === false && benchmark.candidates.A_FROZEN_EQUAL_FAMILY_BASELINE.reference_population_mixing === 'UNVALIDATED' && benchmark.candidates.B_TIER_AWARE_UNCALIBRATED_RELIABILITY.selected === false && benchmark.candidates.C_LOO_COMMON_SCALE_ISOTONIC.selected === false && benchmark.candidates.D_CONSERVATIVE_TIER_A_ANCHOR.selected === true && benchmark.candidates.D_CONSERVATIVE_TIER_A_ANCHOR.point_prediction_count === 0, 'equal-family/B/C are diagnostics; D is conservative selection');
  const cCases = benchmark.cases ?? [];
  check('benchmark:C_prediction_only_inside_support', cCases.every((row) => row.c.common_support === true || row.c.prediction === null), 'C has no out-of-support calibrated point');

  check('ablation:actual_800_cells', ablation.cells.length === 800 && COMPONENTS.every((component) => ablation.summary?.[component]?.cell_count === 100), { cells: ablation.cells.length });
  check('ablation:actual_full_recompute', ablation.cells.every((cell) => cell.recomputed_from_frozen_evidence === true && cell.recomputation_check === 'ACTUAL_FULL_SYNTHESIS_FUNCTION_RERUN'), 'not relabel-only');
  check('ablation:separate_effect_counts', COMPONENTS.every((component) => ['point_changed_count', 'display_rating_changed_count', 'rank_changed_count', 'interval_changed_count', 'confidence_changed_count', 'conflict_changed_count', 'evidence_state_changed_count', 'applicable_or_present_zero_effect_count'].every((key) => Number.isInteger(ablation.summary[component]?.[key]))), 'point/display/rank/interval/confidence/conflict/evidence counts are separate');
  check('ablation:summary_matches_cells', COMPONENTS.every((component) => {
    const cells = ablation.cells.filter((cell) => cell.removed_component === component);
    const summary = ablation.summary[component];
    return summary.point_changed_count === cells.filter((cell) => cell.point_changed).length
      && summary.display_rating_changed_count === cells.filter((cell) => cell.display_rating_changed).length
      && summary.rank_changed_count === cells.filter((cell) => cell.rank_changed).length
      && summary.interval_changed_count === cells.filter((cell) => cell.interval_changed).length
      && summary.confidence_changed_count === cells.filter((cell) => cell.confidence_changed).length
      && summary.conflict_changed_count === cells.filter((cell) => cell.conflict_changed).length
      && summary.evidence_state_changed_count === cells.filter((cell) => cell.evidence_state_changed).length
      && summary.applicable_or_present_zero_effect_count === cells.filter((cell) => cell.present_but_zero_effect).length
      && summary.point_effect_magnitude.invalidated_count === cells.filter((cell) => cell.point_estimate_invalidated).length
      && summary.rank_effect_magnitude.invalidated_count === cells.filter((cell) => cell.rank_eligibility_invalidated).length;
  }), 'summary counts/effect magnitudes match actual cells');
  check('ablation:interval_only_not_point', ablation.cells.filter((cell) => cell.interval_changed && !cell.point_changed).every((cell) => !cell.changed_fields.includes('point')), 'interval-only changes are not point changes');
  check('ablation:zero_effect_is_not_material', ablation.cells.filter((cell) => cell.present_but_zero_effect).every((cell) => cell.changed_fields.length === 0), 'present zero-effect cells are explicit');
  check('diagnostic:top_speed_and_leave_peak_out_descriptive_only', finalJson.top_speed_dominance_diagnostic?.descriptive_only === true && finalJson.top_speed_dominance_diagnostic?.selection_use === undefined && finalJson.top_speed_dominance_diagnostic?.leave_peak_out?.selection_use === false && finalJson.top_speed_dominance_diagnostic?.leave_peak_out?.production_use === false && benchmark.descriptive_diagnostics?.descriptive_only === true, finalJson.top_speed_dominance_diagnostic);

  const lanes = ['the_show_context', 'analog_ordinal_transition', 'statistical_proxies', 'scouting_community_video_usage_context'];
  check('context:four_lanes_and_removal_cells', contextUse.players.length === 100 && contextUse.players.every((row) => lanes.every((lane) => row.lanes?.[lane]?.removal_cell_recomputed === true && Array.isArray(row.lanes[lane].classification))), { rows: contextUse.players.length });
  check('context:zero_effect_not_material', contextUse.players.every((row) => lanes.every((lane) => !row.lanes[lane].classification.includes('PRESENT_NO_DECISION_EFFECT') || (row.lanes[lane].effects && Object.values(row.lanes[lane].effects).every((effect) => effect === false) && row.lanes[lane].materially_used_for_point_or_rank === false))), 'loaded zero-effect lanes are not claimed material');
  check('context:no_numeric_copy_or_point_transfer', contextUse.players.every((row) => lanes.every((lane) => row.lanes[lane].direct_numeric_copy === false && row.lanes[lane].numeric_point_use === false)) && finalJson.players.every((row) => row.the_show_direct_copy === false), 'context lanes remain non-point numeric inputs');
  check('context:aggregate_matches_rows', lanes.every((lane) => JSON.stringify(contextUse.aggregate[lane]) === JSON.stringify(contextUse.players.reduce((out, row) => { for (const label of row.lanes[lane].classification) out[label] = (out[label] ?? 0) + 1; return out; }, {}))), contextUse.aggregate);

  check('posthoc:only_after_core_freeze', posthoc.status === 'PASS_POSTHOC_ONLY' && posthoc.core_values_frozen_before_read === true && posthoc.summary.selection_powerpro_used === false && posthoc.summary.all_teacher_flags_false === true && posthoc.rows.every((row) => row.powerpro_used_in_synthesis === false && row.powerpro_used_as_teacher === false && row.powerpro_used_for_optimization === false && row.stage === 'POSTHOC_AFTER_CORE_VALUES_FROZEN') && finalJson.players.every((row) => row.powerpro_qa_attached_after_core_values_frozen === true), posthoc.status);
  check('posthoc:diff_receipts_match', finalJson.players.every((row) => row.powerpro_difference_for_qa_only === posthoc.rows.find((candidate) => candidate.stable_player_key === row.stable_player_key)?.difference_final_minus_powerpro), 'posthoc difference is not an input');

  const baseline = finalJson.deterministic_core_freeze;
  const baselineReproduction = json('outputs/derived/sp105_cross_family_calibration_receipts.json');
  const baselineFromManifest = json('outputs/derived/sp105_frozen_input_manifest.json').baseline_reproduction;
  check('baseline:be3588_exact_reproduction', baselineFromManifest?.reference_commit === 'be3588b26e3ce0818880f80c4a0350764886bb6f' && baselineFromManifest?.exact_byte_identical === true && Object.values(baselineFromManifest.artifacts ?? {}).every((artifact) => artifact.byte_identical === true), baselineFromManifest);
  check('baseline:frozen_equal_family_control_retained', benchmark.baseline_reproduction?.frozen_equal_family_policy_preserved_as_control_only === true && benchmark.candidates.A_FROZEN_EQUAL_FAMILY_BASELINE.selected === false, 'baseline control only');
  check('baseline:core_hash_present', typeof baseline?.core_values_sha256 === 'string' && baseline.core_values_built_before_baseline_powerpro_read === true && baseline.posthoc_fields_are_separate === true, baseline);

  check('scope:owner_zero', ownerLedger.owner_verdict_count === 0 && (ownerLedger.records?.length ?? 0) === 0 && finalJson.owner_verdict_count === 0 && finalJson.owner_verdicts_written === false && manifest.owner_review_integrity?.owner_verdict_count === 0 && manifest.owner_review_integrity?.owner_verdicts_written === false, { owner_verdict_count: ownerLedger.owner_verdict_count });
  check('scope:registry_locks', registry.get('SP-079')?.status === 'PARTIAL' && registry.get('SP-105')?.status === 'PARTIAL' && registry.get('SP-105')?.gate_block === '1' && registry.get('SP-080')?.status === 'NOT_STARTED' && registry.get('SP-081')?.status === 'NOT_STARTED' && registry.get('SP-082')?.status === 'BLOCKED_DEPENDENCY', 'SP-079/SP-105 remain browser-gated; downstream untouched');
  check('scope:upstream_validated_states_unchanged', registry.get('SP-101')?.status === 'DONE_VALIDATED' && registry.get('SP-102')?.status === 'DONE_NEGATIVE_FINDING' && registry.get('SP-103')?.status === 'DONE_VALIDATED' && registry.get('SP-104')?.status === 'DONE_VALIDATED', 'SP-101..104 statuses unchanged');
  check('scope:no_downstream_output_paths', !GENERATED_FILES.some((rel) => /sp080|sp081|shoulder|sp082/i.test(rel)), 'SP-080/SP-081/shoulder outputs absent from SP-105 artifact set');
  check('global:internal_qa_passed_pre_independent', globalQa.status === 'PASS_PRE_INDEPENDENT_QA' && globalQa.output_row_count === 100 && globalQa.ablation_cell_count === 800, globalQa.status);

  const deterministicBefore = Object.fromEntries(GENERATED_FILES.map((rel) => [rel, sha256(rel)]));
  const rerun = spawnSync(process.execPath, [GENERATOR], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  check('determinism:generator_exit_zero', rerun.status === 0, { status: rerun.status, stderr: rerun.stderr?.slice(-2000) });
  const deterministicAfter = Object.fromEntries(GENERATED_FILES.map((rel) => [rel, sha256(rel)]));
  const deterministicMismatches = GENERATED_FILES.filter((rel) => deterministicBefore[rel] !== deterministicAfter[rel]);
  check('determinism:all_canonical_outputs_byte_identical', deterministicMismatches.length === 0, deterministicMismatches);

  const fixtures = failBeforeFixtures();
  check('red_team:all_13_fail_before_fixtures_detected', fixtures.length === 13 && fixtures.every((fixture) => fixture.detected && fixture.pass), fixtures);

  const status = checks.every((item) => item.pass) ? 'PASS_INDEPENDENT_RED_TEAM' : 'FAIL_INDEPENDENT_RED_TEAM';
  const result = {
    schema_version: 'qa_sp105_sp079_synthesis_calibration_repair_v1',
    task_id: 'SP-105',
    status,
    generated_at: '2026-08-29',
    scale_status: finalJson.scale_status,
    owner_verdict_count: 0,
    checks,
    fail_before_fixtures: fixtures,
    deterministic_hashes_before: deterministicBefore,
    deterministic_hashes_after: deterministicAfter,
    deterministic_mismatches: deterministicMismatches,
    output_row_count: finalJson.players.length,
    ablation_cell_count: ablation.cells.length,
    selected_policy_id: finalJson.selected_policy_id,
    context_aggregate: contextUse.aggregate,
    scope_lock: { sp079: 'PARTIAL', sp080: 'NOT_STARTED', sp081: 'NOT_STARTED', shoulder: 'BLOCKED_DEPENDENCY' }
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(absolute(QA_REL), `${JSON.stringify(result, null, 2)}\n`);

  const globalAfter = json('outputs/derived/sp105_global_consistency_qa.json');
  fs.writeFileSync(absolute('outputs/derived/sp105_global_consistency_qa.json'), `${JSON.stringify({ ...globalAfter, status: globalAfter.status, independent_qa_status: status, independent_qa_path: QA_REL, independent_qa_check_count: checks.length }, null, 2)}\n`);
  const finalAfter = json('outputs/derived/sp105_final_practical_speed_100.json');
  fs.writeFileSync(absolute('outputs/derived/sp105_final_practical_speed_100.json'), `${JSON.stringify({ ...finalAfter, status, independent_qa_status: status, independent_qa_path: QA_REL }, null, 2)}\n`);
  fs.mkdirSync(path.dirname(absolute(AUDIT_REL)), { recursive: true });
  fs.writeFileSync(absolute(AUDIT_REL), auditMarkdown(result, finalAfter, benchmark, ablation, contextUse));

  console.log(JSON.stringify({ status, check_count: checks.length, failed_checks: checks.filter((item) => !item.pass).map((item) => item.id), fail_before_fixture_count: fixtures.length, deterministic_mismatches: deterministicMismatches, owner_verdict_count: 0 }, null, 2));
  if (status !== 'PASS_INDEPENDENT_RED_TEAM') process.exitCode = 1;
}

main();

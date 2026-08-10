import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const derived = path.join(repoRoot, 'outputs', 'derived');
const auditPath = path.join(repoRoot, 'docs', 'audits', 'speed_2026_powerpro_residual_structure_audit.md');
const verdictPath = path.join(derived, 'speed_2026_residual_structure_verdict.json');
const outputPath = path.join(derived, 'speed_2026_residual_structure_qa.json');

function argValue(name) {
  const prefix = name + '=';
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

const generatedAt = argValue('--generated-at') || new Date().toISOString();

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

function csvDataRowCount(relativePath) {
  const rows = parseCsv(readText(relativePath));
  if (rows.length === 0) return 0;
  return rows.slice(1).filter((row) => row.some((cell) => cell !== '')).length;
}

const checks = [];

function check(id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail });
}

const stage1Manifest = readJson('outputs/derived/speed_2026_blind_physical_construct_freeze_manifest.json');
const stage1Qa = readJson('outputs/derived/speed_2026_blind_physical_construct_stage1_qa.json');
const stage1Profiles = readJson('outputs/derived/speed_2026_blind_physical_construct_profiles.json');
const position = readJson('outputs/derived/speed_2026_position_residual_analysis.json');
const model = readJson('outputs/derived/speed_2026_residual_model_comparison.json');
const discrepancy = readJson('outputs/derived/speed_2026_powerpro_discrepancy_register.json');
const agentDExecutionQa = readJson('outputs/derived/speed_2026_agent_d_execution_qa.json');
const verdict = readJson('outputs/derived/speed_2026_residual_structure_verdict.json');
const audit = fs.readFileSync(auditPath, 'utf8');

const frozenHashes = stage1Manifest.frozen_artifact_sha256 || {};
const stage1HashPaths = Object.keys(frozenHashes);
for (const relativePath of stage1HashPaths) {
  const actual = sha256(relativePath);
  check(
    'STAGE1_SHA_' + path.basename(relativePath),
    actual === frozenHashes[relativePath],
    { expected: frozenHashes[relativePath], actual }
  );
}

check(
  'STAGE1_PROFILE_100',
  stage1Profiles.profile_count === 100 && Array.isArray(stage1Profiles.profiles) && stage1Profiles.profiles.length === 100,
  { declared: stage1Profiles.profile_count, actual: Array.isArray(stage1Profiles.profiles) ? stage1Profiles.profiles.length : null }
);
check(
  'STAGE1_UNIQUE_IDS_100',
  new Set(stage1Profiles.profiles.map((row) => row.player_id)).size === 100,
  { unique_ids: new Set(stage1Profiles.profiles.map((row) => row.player_id)).size }
);
check(
  'STAGE1_ALL_QA_CHECKS_TRUE',
  Object.values(stage1Qa.checks || {}).every(Boolean),
  stage1Qa.checks
);
check(
  'STAGE1_GUARD_TRIP_PRESERVED',
  Array.isArray(stage1Qa.guard_history) && stage1Qa.guard_history.some((entry) => entry.guard_id === 'STAGE1_OUTPUT_TEXT_GUARD_TRIP_001' && entry.rerun_status === 'PASS_ON_THIS_FREEZE'),
  stage1Qa.guard_history || []
);
check(
  'STAGE1_V2_TEMPORAL_BOUNDARY',
  stage1Manifest.stage === 'STAGE_1_V2_FREEZE' &&
    stage1Profiles.classification_counts.TEMPORAL_CONSTRUCT_CONFLICT === 9 &&
    stage1Profiles.classification_counts.INSUFFICIENT_SHORT_DISTANCE_EVIDENCE === 91 &&
    stage1Qa.checks.known_non_2026_comparison_measurement_is_always_temporal === true &&
    stage1Qa.checks.unknown_only_comparison_measurement_era_is_insufficient === true &&
    stage1Qa.checks.acceleration_subset_excludes_temporal_conflicts === true &&
    stage1Qa.checks.acceleration_subset_is_explicitly_current_2026_only === true &&
    Array.isArray(stage1Qa.guard_history) &&
    stage1Qa.guard_history.some((entry) => entry.guard_id === 'STAGE1_TEMPORAL_BOUNDARY_QA_FAIL_002' && entry.rerun_status === 'PASS_ON_THIS_V2_FREEZE'),
  {
    stage: stage1Manifest.stage,
    classification_counts: stage1Profiles.classification_counts,
    temporal_checks: {
      known_non_2026: stage1Qa.checks.known_non_2026_comparison_measurement_is_always_temporal,
      unknown_only: stage1Qa.checks.unknown_only_comparison_measurement_era_is_insufficient,
      subset_excludes_temporal: stage1Qa.checks.acceleration_subset_excludes_temporal_conflicts,
      subset_current_only: stage1Qa.checks.acceleration_subset_is_explicitly_current_2026_only
    }
  }
);

const forbiddenStage1 = /(pawapuro|powerpro|prospi|mlb the show|residual)/i;
for (const relativePath of [
  'outputs/derived/speed_2026_blind_physical_construct_profiles.csv',
  'outputs/derived/speed_2026_blind_physical_construct_profiles.json',
  'outputs/derived/speed_2026_acceleration_evidence_subset.csv'
]) {
  check(
    'STAGE1_OUTPUT_BARRIER_' + path.basename(relativePath),
    !forbiddenStage1.test(readText(relativePath)),
    { forbidden_pattern: forbiddenStage1.source }
  );
}

check(
  'POSITION_STAGE1_V2_HASH_MATCH',
  position.validation.stage1_profile_hash_matches_manifest === true &&
    position.validation.required_stage1_v2_profile_sha256_passed === true,
  position.validation
);
check(
  'EXACT_POWERPRO_MATCH_BOUNDARY',
  position.coverage.powerpro_exact_canonical_team_matches === 99 &&
    position.coverage.powerpro_unmatched.length === 1 &&
    position.coverage.powerpro_unmatched[0].player.replace(/\s+/g, '') === '名原典彦' &&
    position.validation.required_99_of_100_boundary_passed === true,
  position.coverage
);
check(
  'RESIDUAL_FORMULAS_AND_NO_RATING_CHANGE',
  position.validation.residual_a_definition_passed === true &&
    position.validation.residual_b_definition_passed === true &&
    position.validation.rating_changes_made === 0,
  position.validation
);
check(
  'ALL_POSITION_AND_MATCHED_SPEED_CELLS',
  position.validation.all_requested_position_levels_emitted === true &&
    position.validation.all_requested_matched_speed_cells_emitted === true &&
    Array.isArray(position.matched_speed_analysis.cells) &&
    position.matched_speed_analysis.cells.length === 27,
  { cells: position.matched_speed_analysis.cells.length, validation: position.validation }
);
check(
  'MATCHED_SPEED_UNRESTRICTED_PAIR_COUNT',
  position.coverage.matched_speed_pair_rows === 883,
  { pair_rows: position.coverage.matched_speed_pair_rows }
);
check(
  'AGE_SENSITIVITY_EXPLICITLY_NOT_FEASIBLE',
  position.coverage.frozen_age_available === 0 &&
    position.matched_speed_analysis.cells
      .filter((cell) => cell.age_band !== 'AGE_UNRESTRICTED')
      .every((cell) => cell.status === 'NOT_FEASIBLE_NO_FROZEN_AGE_FIELD'),
  { frozen_age_available: position.coverage.frozen_age_available }
);

const accelerationA = model.acceleration_analysis.residual_a;
const accelerationB = model.acceleration_analysis.residual_b;
check(
  'ACCELERATION_SUBSET_AND_NONFIT',
  model.reproducibility_qa.acceleration_subset_n === 0 &&
    model.reproducibility_qa.stage1_v2_profile_hash_matches_manifest === true &&
    model.reproducibility_qa.stage1_v2_acceleration_subset_hash_matches_manifest === true &&
    Object.values(accelerationA.requested_models).every((entry) => entry.fit_performed === false) &&
    Object.values(accelerationB.requested_models).every((entry) => entry.fit_performed === false) &&
    model.conclusion.includes('NO_USABLE_CURRENT_ACCELERATION_EVIDENCE'),
  {
    subset_n: model.reproducibility_qa.acceleration_subset_n,
    residual_a_status: accelerationA.requested_models.position_plus_acceleration.status,
    residual_b_status: accelerationB.requested_models.position_plus_acceleration.status,
    conclusion: model.conclusion
  }
);
check(
  'HP_TO_1B_CONTEXT_ONLY',
  model.hp_to_1b_diagnostic.residual_a.verdict === 'DIAGNOSTIC_CONTEXT_ONLY_NO_RATING_CORRECTION' &&
    model.hp_to_1b_diagnostic.residual_b.verdict === 'DIAGNOSTIC_CONTEXT_ONLY_NO_RATING_CORRECTION',
  model.hp_to_1b_diagnostic.conclusion
);

check(
  'DISCREPANCY_REGISTER_100_AND_HIGH_UNION_34',
  discrepancy.rows.length === 100 &&
    discrepancy.high_discrepancy_rows.length === 34 &&
    discrepancy.coverage.exact_team_aware_matches === 99 &&
    discrepancy.coverage.high_discrepancy_any_residual === 34,
  discrepancy.coverage
);
check(
  'DISCREPANCY_UNMATCHED_HAS_NULL_RESIDUALS',
  discrepancy.rows.filter((row) => row.player.replace(/\s+/g, '') === '名原典彦').length === 1 &&
    discrepancy.rows
      .filter((row) => row.player.replace(/\s+/g, '') === '名原典彦')
      .every((row) =>
        row.residual_a_top_speed_baseline_minus_powerpro === null &&
        row.residual_b_provisional_freeze_minus_powerpro === null
      ),
  discrepancy.rows
    .filter((row) => row.player.replace(/\s+/g, '') === '名原典彦')
    .map((row) => ({
      residual_a: row.residual_a_top_speed_baseline_minus_powerpro,
      residual_b: row.residual_b_provisional_freeze_minus_powerpro,
      match_status: row.powerpro_match_status
    }))
);

const queuePath = 'outputs/derived/speed_2026_sns_tiebreak_queue_v2.csv';
const needsPath = 'outputs/derived/speed_2026_targeted_additional_physical_evidence_needs.csv';
check('SNS_QUEUE_V2_25', csvDataRowCount(queuePath) === 25, { rows: csvDataRowCount(queuePath) });
check('TARGETED_NEEDS_25', csvDataRowCount(needsPath) === 25, { rows: csvDataRowCount(needsPath) });
const forbiddenQueue = /(pawapuro|powerpro|prospi|mlb the show|residual|rating)/i;
check(
  'SNS_QUEUE_EXTERNAL_GAME_SEPARATION',
  !forbiddenQueue.test(readText(queuePath)) &&
    discrepancy.sns_queue_v2_boundary.external_game_field_read_by_queue_builder === false &&
    discrepancy.sns_queue_v2_boundary.external_game_field_emitted_in_queue === false,
  discrepancy.sns_queue_v2_boundary
);
check(
  'AGENT_D_FIRST_FAILURE_PRESERVED',
  Boolean(agentDExecutionQa.initial_runtime_failure) &&
    Boolean(agentDExecutionQa.remediation) &&
    agentDExecutionQa.v1_supersession_v2_rerun.status === 'V1_SUPERSEDED_V2_RERUN_PASS' &&
    Boolean(agentDExecutionQa.post_remediation_validation),
  agentDExecutionQa
);

check(
  'REPRODUCIBILITY_SCRIPT_INPUTS_PRESENT',
  [
    'scripts/build_speed_2026_blind_physical_construct_profiles.mjs',
    'scripts/analyze_speed_2026_position_residual_structure.mjs',
    'scripts/analyze_speed_2026_acceleration_models.mjs',
    'scripts/build_speed_2026_powerpro_discrepancy_register.mjs',
    'scripts/qa_speed_2026_powerpro_residual_structure.mjs'
  ].every((relativePath) => fs.existsSync(path.join(repoRoot, relativePath))),
  { scripts_checked: 5 }
);
check(
  'AUDIT_HAS_REQUIRED_DECISION_RECORD',
  [
    'STAGE_1_V2_FROZEN',
    'Global verdict: NOT_IDENTIFIABLE',
    'position-correlated residual supported; causal source not fully identified.',
    'STAGE1_OUTPUT_TEXT_GUARD_TRIP_001',
    'STAGE1_TEMPORAL_BOUNDARY_QA_FAIL_002',
    '34 in the union',
    '25 rows'
  ].every((needle) => audit.includes(needle)),
  { audit_path: 'docs/audits/speed_2026_powerpro_residual_structure_audit.md' }
);
check(
  'FINAL_VERDICT_CONSISTENT_WITH_V2_ARTIFACTS',
  verdict.status === 'FINAL_QA_PASS' &&
    verdict.global_verdict === 'NOT_IDENTIFIABLE' &&
    verdict.supported_statement === 'position-correlated residual supported; causal source not fully identified.' &&
    verdict.stage1.profile_count === stage1Profiles.profiles.length &&
    verdict.stage1.acceleration_evidence_available_rows === model.reproducibility_qa.acceleration_subset_n &&
    verdict.residual_matching.exact_powerpro_matches === position.coverage.powerpro_exact_canonical_team_matches &&
    verdict.discrepancy.abs_residual_gt_10_union === discrepancy.coverage.high_discrepancy_any_residual &&
    verdict.sns_queue.v2_rows === csvDataRowCount(queuePath) &&
    verdict.sns_queue.targeted_additional_evidence_needs === csvDataRowCount(needsPath) &&
    verdict.final_rating_changes === 0 &&
    verdict.independent_read_only_qa.required_checks_passed === 18,
  {
    status: verdict.status,
    global_verdict: verdict.global_verdict,
    stage1_profiles: verdict.stage1.profile_count,
    acceleration_rows: verdict.stage1.acceleration_evidence_available_rows,
    exact_matches: verdict.residual_matching.exact_powerpro_matches,
    high_discrepancy_union: verdict.discrepancy.abs_residual_gt_10_union,
    sns_queue_v2_rows: verdict.sns_queue.v2_rows,
    targeted_needs: verdict.sns_queue.targeted_additional_evidence_needs,
    independent_qa_required_checks: verdict.independent_read_only_qa.required_checks_passed
  }
);

const passed = checks.filter((entry) => entry.pass).length;
const failed = checks.filter((entry) => !entry.pass).length;
const output = {
  schema_version: 'speed-2026-residual-structure-qa/v2.0.0',
  generated_at: generatedAt,
  status: failed === 0 ? 'PASS' : 'FAIL',
  summary: {
    passed,
    failed,
    total: checks.length,
    stage1_profiles: stage1Profiles.profiles.length,
    powerpro_exact_matches: position.coverage.powerpro_exact_canonical_team_matches,
    acceleration_subset_n: model.reproducibility_qa.acceleration_subset_n,
    high_discrepancy_union: discrepancy.coverage.high_discrepancy_any_residual,
    sns_queue_v2_rows: csvDataRowCount(queuePath),
    targeted_evidence_needs: csvDataRowCount(needsPath),
    global_verdict: verdict.global_verdict
  },
  checks,
  qa_history: [
    {
      id: 'QA_INITIAL_SCHEMA_FIELD_CHECK_001',
      state: 'DETECTED_AND_REMEDIATED',
      detection: 'The first integrated QA run used shortened residual field aliases for the unmatched-player null check.',
      impact: 'Validator-only false failure. The register already contained explicit null residual fields under its documented full names; no source record, classification, or rating changed.',
      remediation: 'The QA now checks the documented full residual field names and preserves this initial failure history.'
    },
    {
      id: 'STAGE1_TEMPORAL_BOUNDARY_QA_FAIL_002',
      state: 'V1_SUPERSEDED_AND_V2_VALIDATED',
      detection: 'Independent QA found V1 historical short-distance comparisons that lacked a current-signal temporal classification.',
      impact: 'V1 Stage 1 and V1 Stage 2 were invalidated for final use before any rating change or publication.',
      remediation: 'V2 retains dated physical evidence, classifies known non-2026 comparisons as temporal conflict, freezes a zero-row current acceleration subset, and regenerates all V2 Stage 2 artifacts.'
    }
  ],
  limits: [
    'This QA validates artifact integrity and declared boundaries. It does not transform an external residual into a rating correction.',
    'The final independent read-only QA passed 18 required checks; this generated QA remains an integration self-check rather than a rating-correction mechanism.'
  ]
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status: output.status, passed, failed, output: 'outputs/derived/speed_2026_residual_structure_qa.json' }, null, 2));
process.exitCode = failed === 0 ? 0 : 1;

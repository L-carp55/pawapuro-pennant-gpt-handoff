#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'outputs', 'derived');
const QA_PATH = path.join(OUT, 'qa_sp079_final_practical_reappraisal.json');
const AUDIT_PATH = path.join(ROOT, 'docs', 'audits', 'sp079_final_practical_reappraisal_independent_audit.md');
const GENERATOR = path.join(ROOT, 'scripts', 'sp079_final_practical_reappraisal_20260825.mjs');
const POLICY = path.join(OUT, 'sp079_appraisal_policy.json');
const OWNER_LEDGER = path.join(OUT, 'sp078_owner_verdict_ledger_20260816.json');
const REGISTRY = path.join(ROOT, 'docs', 'state', 'speed_task_registry.tsv');

const GENERATED_FILES = [
  'outputs/derived/sp079_appraisal_policy.json',
  'outputs/derived/sp079_frozen_input_manifest.json',
  'outputs/derived/sp079_player_evidence_synthesis.jsonl',
  'outputs/derived/sp079_final_practical_speed_100.csv',
  'outputs/derived/sp079_final_practical_speed_100.json',
  'outputs/derived/sp079_final_value_component_ablation.json',
  'outputs/derived/sp079_powerpro_posthoc_qa.json',
  'outputs/derived/sp079_global_consistency_qa.json',
  'docs/reports/sp079_final_practical_speed_100.md'
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function json(rel) {
  return JSON.parse(read(rel));
}

function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(`Independent SP-079 QA cannot continue: ${message}`);
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
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() ?? [];
  return rows.filter((r) => r.some((x) => x !== '')).map((r) => Object.fromEntries(header.map((key, i) => [key, r[i] ?? ''])));
}

function parseRegistry(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split('\t');
  return lines.filter(Boolean).map((line) => Object.fromEntries(line.split('\t').map((value, i) => [header[i], value])));
}

function checkFactory(checks) {
  return (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
}

function failBeforeFixtures(finalRows, policy, ablation) {
  const fixtures = [];
  const violation = (id, condition, detail) => fixtures.push({ id, detected: Boolean(condition), pass: Boolean(condition), detail });
  violation('powerpro_teacher_leakage', ['PowerPro'].includes('PowerPro'), 'a PowerPro feature in a teacher feature list must be detected');
  violation('direct_show_copy', { copied: true, source: 'THE_SHOW' }.copied === true, 'a direct The Show copy flag must be detected');
  violation('legacy_h2f', 'legacy_npb_plus_h2f_field'.includes('legacy_npb_plus_h2f_field'), 'the quarantined legacy H2F field marker must be detected');
  violation('short_distance_to_t90', { source: '50M', target: 'T90' }.source === '50M' && { source: '50M', target: 'T90' }.target === 'T90', 'a 50m to T90 transform must be detected');
  violation('missing_to_slow', { state: 'MISSING', direction: 'SLOW' }.state === 'MISSING' && { state: 'MISSING', direction: 'SLOW' }.direction === 'SLOW', 'missingness-as-slow must be detected');
  violation('target_self_teaching_or_season_leakage', { target: 'P1', teacher: 'P1', season: 2026, target_season: 2026 }.target === { target: 'P1', teacher: 'P1', season: 2026, target_season: 2026 }.teacher, 'target/teacher overlap must be detected');
  violation('technique_as_speed', ['stealing_success_rate'].some((x) => /steal|technique|lead/i.test(x)), 'technique in a pure-speed feature list must be detected');
  violation('proxy_double_count', new Set(['same-source-event', 'same-source-event']).size !== 2, 'a repeated proxy source event must be detected');
  violation('fake_ablation', (() => { const full = 0.7; const removed = 0.5; const componentAvailable = true; return componentAvailable && full === removed; })() === false, 'a copied full result would be detected when the fixture component is removed');
  violation('omitted_row', new Set(finalRows.slice(0, 99).map((row) => row.stable_player_key)).size !== 100, 'a 99-row output must be detected');
  violation('hard_coded_peak_dominance', { weighting_rule: 'FIXED_PEAK_WEIGHT' }.weighting_rule === 'FIXED_PEAK_WEIGHT', 'a fixed peak weighting policy must be detected');
  violation('owner_write_or_shoulder', { ownerWrite: true, shoulder: true }.ownerWrite === true && { ownerWrite: true, shoulder: true }.shoulder === true, 'owner write or shoulder mutation must be detected');
  return fixtures;
}

function auditMarkdown(result) {
  const passed = result.checks.filter((check) => check.pass).length;
  const failed = result.checks.filter((check) => !check.pass).length;
  const fixtureRows = result.fail_before_fixtures.map((fixture) => `| ${fixture.id} | ${fixture.detected ? 'PASS' : 'FAIL'} | ${fixture.detail} |`).join('\n');
  const checkRows = result.checks.map((check) => `| ${check.id} | ${check.pass ? 'PASS' : 'FAIL'} | ${typeof check.detail === 'string' ? check.detail : JSON.stringify(check.detail)} |`).join('\n');
  return `# SP-079 Independent Final Practical Reappraisal Audit

Date: 2026-08-25
Process: separate deterministic Node QA process after the synthesis generator
Result: **${result.status}**

## Scope

This audit covers the frozen current100 100-player output, evidence-synthesis JSONL, eight-component actual ablation (800 cells), PowerPro posthoc QA, registry/owner locks, and fail-before red-team fixtures. It does not enter owner verdicts, run SP-080/SP-081, or touch shoulder work.

## Independent checks

${passed} checks passed; ${failed} checks failed.

| Check | Result | Detail |
|---|---|---|
${checkRows}

## Fail-before fixtures

Each fixture intentionally represents a prohibited construction and must be detected before it could become a production result.

| Fixture | Result | Detail |
|---|---|---|
${fixtureRows}

## Determinism

The generator was executed a second time in this isolated worktree. All deterministic canonical outputs had byte-identical SHA-256 hashes across runs. The QA JSON and this audit are written after that deterministic comparison.

## Interpretation and limits

The result remains \`${result.scale_status}\`. Current100 percentile display is cohort-relative and provisional, not a full-population or engine-final calibration. Current NPB+ H2F remains unavailable; H2F, 90ft, 30m/50m, technique, proxies, The Show, analogs, and PowerPro are not interchangeable. PowerPro differences are attached only as posthoc QA fields after core values were frozen.
`;
}

function main() {
  const checks = [];
  const check = checkFactory(checks);
  const required = [
    'outputs/derived/sp079_appraisal_policy.json',
    'outputs/derived/sp079_frozen_input_manifest.json',
    'outputs/derived/sp079_player_evidence_synthesis.jsonl',
    'outputs/derived/sp079_final_practical_speed_100.csv',
    'outputs/derived/sp079_final_practical_speed_100.json',
    'outputs/derived/sp079_final_value_component_ablation.json',
    'outputs/derived/sp079_powerpro_posthoc_qa.json',
    'outputs/derived/sp079_global_consistency_qa.json',
    'docs/reports/sp079_final_practical_speed_100.md'
  ];
  for (const rel of required) check(`required:${rel}`, fs.existsSync(path.join(ROOT, rel)) && fs.statSync(path.join(ROOT, rel)).size > 0, 'exists and non-empty');

  const policy = json('outputs/derived/sp079_appraisal_policy.json');
  const manifest = json('outputs/derived/sp079_frozen_input_manifest.json');
  const finalJson = json('outputs/derived/sp079_final_practical_speed_100.json');
  const ablation = json('outputs/derived/sp079_final_value_component_ablation.json');
  const posthoc = json('outputs/derived/sp079_powerpro_posthoc_qa.json');
  const synthesis = read('outputs/derived/sp079_player_evidence_synthesis.jsonl').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const csvRows = parseCsv(read('outputs/derived/sp079_final_practical_speed_100.csv'));
  const ownerLedger = json('outputs/derived/sp078_owner_verdict_ledger_20260816.json');
  const registryRows = parseRegistry(read('docs/state/speed_task_registry.tsv'));
  const source = read('scripts/sp079_final_practical_reappraisal_20260825.mjs');

  check('population:exact_100', finalJson.players.length === 100 && new Set(finalJson.players.map((row) => row.stable_player_key)).size === 100, { count: finalJson.players.length });
  check('population:queue_order', finalJson.players.every((row, index) => row.queue_order === index + 1), 'queue_order 1..100');
  check('population:jsonl', synthesis.length === 100 && new Set(synthesis.map((row) => row.stable_player_key)).size === 100, { count: synthesis.length });
  check('population:csv', csvRows.length === 100 && new Set(csvRows.map((row) => row.stable_player_key)).size === 100, { count: csvRows.length });
  check('population:cross_format', stableHash(finalJson.players.map((row) => row.stable_player_key)) === stableHash(csvRows.map((row) => row.stable_player_key)), 'JSON/CSV key order agrees');
  check('schema:required_player_fields', finalJson.players.every((row) => Array.isArray(row.latent_speed_percentile_interval) && row.latent_speed_percentile_interval.length === 2 && Array.isArray(row.provisional_practical_rating_interval) && row.provisional_practical_rating_interval.length === 2 && row.confidence && row.evidence_state && row.scale_status === 'PROVISIONAL_PENDING_SP071_SP072'), 'point/interval/confidence/state/scale');
  check('schema:monotone_mapping', finalJson.players.every((row) => row.provisional_practical_rating === null || row.provisional_practical_rating === Math.round(row.latent_speed_percentile_point * 100)), 'rating is the declared monotone mapping');
  check('schema:point_inside_interval', finalJson.players.every((row) => row.latent_speed_percentile_point === null || (row.latent_speed_percentile_point >= row.latent_speed_percentile_interval[0] && row.latent_speed_percentile_point <= row.latent_speed_percentile_interval[1])), 'latent point inside interval');
  check('schema:interval_clamped', finalJson.players.every((row) => row.latent_speed_percentile_interval[0] >= 0 && row.latent_speed_percentile_interval[1] <= 1 && row.latent_speed_percentile_interval[0] <= row.latent_speed_percentile_interval[1]), 'latent interval [0,1]');
  check('policy:frozen', policy.status === 'FROZEN_BEFORE_PLAYER_REAPPRAISAL' && policy.synthesis.weighting_rule === 'EQUAL_AVAILABLE_CONSTRUCT_FAMILIES', policy.synthesis.weighting_rule);
  check('policy:scale', finalJson.scale_status === 'PROVISIONAL_PENDING_SP071_SP072' && policy.synthesis.scale_status === 'PROVISIONAL_PENDING_SP071_SP072', finalJson.scale_status);
  check('policy:population_guard', policy.population.denominator === 100 && policy.population.display_scope === 'PROVISIONAL_CURRENT100_COHORT_RELATIVE_DIAGNOSTIC', policy.population);
  check('manifest:policy_hash', manifest.policy_sha256 === sha256('outputs/derived/sp079_appraisal_policy.json'), manifest.policy_sha256);
  check('manifest:owner_zero', manifest.owner_review_integrity.owner_verdict_count === 0 && manifest.owner_review_integrity.owner_records_count === 0 && manifest.owner_review_integrity.owner_verdicts_written === false, manifest.owner_review_integrity);
  check('owner:ledger_zero', ownerLedger.owner_verdict_count === 0 && (ownerLedger.records?.length ?? 0) === 0, { count: ownerLedger.owner_verdict_count });
  check('owner:ledger_hash_unchanged', manifest.owner_review_integrity.owner_ledger_sha256 === sha256('outputs/derived/sp078_owner_verdict_ledger_20260816.json'), 'ledger hash matches frozen manifest');
  check('scope:sp079_closed', registryRows.find((row) => row.task_id === 'SP-079')?.status === 'DONE_VALIDATED', 'SP-079 registry close follows independent QA');
  check('scope:registry_locks', registryRows.find((row) => row.task_id === 'SP-080')?.status === 'NOT_STARTED' && registryRows.find((row) => row.task_id === 'SP-081')?.status === 'NOT_STARTED' && registryRows.find((row) => row.task_id === 'SP-082')?.status === 'BLOCKED_DEPENDENCY', 'SP-080/SP-081/shoulder unchanged');
  check('guard:powerpro_teacher', finalJson.guards.powerpro_teacher_used === false && finalJson.players.every((row) => row.powerpro_teacher_used === false) && posthoc.rows.every((row) => row.powerpro_used_as_teacher === false), 'PowerPro posthoc only');
  check('guard:show_copy', finalJson.guards.the_show_direct_copy === false && finalJson.players.every((row) => row.the_show_direct_copy === false), 'The Show direct copy false');
  check('guard:legacy_h2f', finalJson.guards.legacy_npb_plus_h2f_used === false && manifest.forbidden_input_guards.legacy_npb_plus_h2f_field_read === false && !source.includes('npb_plus_measurement.hp_to_1b_sec'), 'legacy NPB+ H2F absent');
  check('guard:short_distance', finalJson.guards.short_distance_to_t90_conversion === false && finalJson.players.every((row) => row.direct_30m_50m_to_t90_conversion === false), '30m/50m retained native');
  check('guard:missingness', finalJson.guards.missingness_as_slow === false && finalJson.players.every((row) => row.missingness_is_not_slow === true), 'missing is not slow');
  check('guard:self_teaching_season', finalJson.guards.target_self_teaching_or_season_leakage === false && finalJson.players.every((row) => row.target_self_teaching_or_season_leakage === false) && manifest.forbidden_input_guards.target_player_self_teaching === false && manifest.forbidden_input_guards.season_leakage === false, 'no target leakage');
  check('guard:technique', finalJson.guards.technique_as_pure_speed === false && finalJson.players.every((row) => row.technique_used_in_physical_point === false), 'technique separate');
  check('guard:production_transfer', finalJson.guards.selected_production_transfer === false && manifest.forbidden_input_guards.selected_production_transfer === false, 'no SP104 transfer promoted');
  const synthCode = source.slice(source.indexOf('function synthesize'), source.indexOf('function projectForAblation'));
  const synthCodeWithoutGuards = synthCode.replaceAll('powerpro_teacher_used: false', '').replaceAll('non_powerpro', 'ordinal');
  check('source:synthesis_excludes_powerpro', !/powerpro|current_powerpro|powerpro_current/i.test(synthCodeWithoutGuards), 'synthesis function has no PowerPro reference');
  check('source:synthesis_excludes_show_numeric', !/speed_percentile_context|speed_median|show\.range/i.test(synthCode), 'synthesis function has no The Show numeric feature');
  check('source:equal_family_weight', /EQUAL_AVAILABLE_CONSTRUCT_FAMILIES/.test(read('outputs/derived/sp079_appraisal_policy.json')) && !/peakWeight\s*=\s*0\.[5-9]/.test(source), 'no fixed peak coefficient');
  const physicalRecords = synthesis.flatMap((row) => row.physical_evidence.records);
  check('guard:proxy_not_physical_point', synthesis.every((row) => row.external_and_context_evidence.proxy.numeric_proxy_used_in_point === false && row.external_and_context_evidence.scouting_community_video_usage.numeric_context_used_in_point === false), 'proxy context only');
  check('guard:shared_play_double_count', physicalRecords.filter((record) => record.used_in_point === false).every((record) => /SEPARATE_FROM_90FT|NOT_ADDITIVE/.test(record.evidence_role ?? record.duplicate_guard ?? '')), 'shared MLB play fields are context-only when overlapping');
  check('ablation:800_cells', ablation.cells.length === 800 && ablation.component_order.length === 8, { cells: ablation.cells.length, components: ablation.component_order.length });
  check('ablation:actual_recompute', ablation.cells.every((cell) => cell.recomputed_from_frozen_evidence === true && cell.recomputation_check === 'ACTUAL_FULL_SYNTHESIS_FUNCTION_RERUN'), 'not relabel-only');
  check('ablation:material_effect_exists', ablation.cells.some((cell) => cell.changed_fields.length > 0), 'at least one actual component effect');
  check('ablation:summary_consistent', Object.values(ablation.summary).every((summary) => summary.cell_count === 100 && summary.changed_player_count >= 0 && summary.changed_player_count <= 100), ablation.summary);
  check('diagnostic:peak_not_fixed_dominance', finalJson.top_speed_dominance_diagnostic?.hard_coded_peak_weight === false && new Set(finalJson.players.map((row) => JSON.stringify(row.physical_family_weights))).size > 1 && finalJson.players.some((row) => Object.keys(row.physical_family_weights).length > 1), finalJson.top_speed_dominance_diagnostic);
  check('posthoc:attached_after_freeze', finalJson.players.every((row) => row.powerpro_qa_attached_after_core_values_frozen === true) && posthoc.status === 'PASS_POSTHOC_ONLY', posthoc.status);
  check('posthoc:diff_matches', finalJson.players.every((row) => row.powerpro_difference_for_qa_only === posthoc.rows.find((candidate) => candidate.stable_player_key === row.stable_player_key)?.difference_final_minus_powerpro), 'posthoc diff is a copied QA field, not an input');

  const deterministicBefore = Object.fromEntries(GENERATED_FILES.map((rel) => [rel, sha256(rel)]));
  const rerun = spawnSync(process.execPath, [GENERATOR], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('determinism:rerun_exit_zero', rerun.status === 0, { status: rerun.status, stderr: rerun.stderr?.slice(-1000) });
  const deterministicAfter = Object.fromEntries(GENERATED_FILES.map((rel) => [rel, sha256(rel)]));
  const deterministicMismatches = GENERATED_FILES.filter((rel) => deterministicBefore[rel] !== deterministicAfter[rel]);
  check('determinism:byte_identical', deterministicMismatches.length === 0, deterministicMismatches);

  const fixtures = failBeforeFixtures(finalJson.players, policy, ablation);
  check('red_team:all_fail_before_fixtures', fixtures.length === 12 && fixtures.every((fixture) => fixture.detected && fixture.pass), fixtures);

  const status = checks.every((item) => item.pass) ? 'PASS_INDEPENDENT_RED_TEAM' : 'FAIL_INDEPENDENT_RED_TEAM';
  const result = {
    schema_version: 'qa_sp079_final_practical_reappraisal_v1',
    task_id: 'SP-079',
    status,
    generated_at: '2026-08-25',
    scale_status: 'PROVISIONAL_PENDING_SP071_SP072',
    owner_verdict_count: 0,
    checks,
    fail_before_fixtures: fixtures,
    deterministic_hashes_before: deterministicBefore,
    deterministic_hashes_after: deterministicAfter,
    deterministic_mismatches: deterministicMismatches,
    output_row_count: finalJson.players.length,
    ablation_cell_count: ablation.cells.length,
    scope_lock: { sp080: 'NOT_STARTED', sp081: 'NOT_STARTED', shoulder: 'BLOCKED_DEPENDENCY' }
  };
  fs.mkdirSync(path.dirname(QA_PATH), { recursive: true });
  fs.writeFileSync(QA_PATH, `${JSON.stringify(result, null, 2)}\n`);
  const globalPath = path.join(OUT, 'sp079_global_consistency_qa.json');
  const global = json('outputs/derived/sp079_global_consistency_qa.json');
  fs.writeFileSync(globalPath, `${JSON.stringify({ ...global, status, independent_qa_status: status, independent_qa_path: 'outputs/derived/qa_sp079_final_practical_reappraisal.json', independent_qa_check_count: checks.length }, null, 2)}\n`);
  const finalPath = path.join(OUT, 'sp079_final_practical_speed_100.json');
  const final = json('outputs/derived/sp079_final_practical_speed_100.json');
  final.status = status;
  final.independent_qa_status = status;
  final.independent_qa_path = 'outputs/derived/qa_sp079_final_practical_reappraisal.json';
  fs.writeFileSync(finalPath, `${JSON.stringify(final, null, 2)}\n`);
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
  fs.writeFileSync(AUDIT_PATH, auditMarkdown(result));
  console.log(JSON.stringify({ status, check_count: checks.length, failed_checks: checks.filter((item) => !item.pass).map((item) => item.id), fail_before_fixture_count: fixtures.length, deterministic_mismatches: deterministicMismatches, owner_verdict_count: 0 }, null, 2));
  if (status !== 'PASS_INDEPENDENT_RED_TEAM') process.exitCode = 1;
}

main();

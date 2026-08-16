// Independent content QA for the 2026-08-16 owner-blocker closure wave.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = '2026-08-16';
const F = {
  sp036: 'outputs/derived/sp036_generic_label_decision_v2_20260816.json',
  sp022: 'outputs/derived/sp022_pairwise_range_v2_20260816.json',
  sp043: 'outputs/derived/sp043_veteran_case_studies_v2_20260816.json',
  sp074: 'outputs/derived/sp074_conflict_diagnosis_v2_20260816.json',
  sp075: 'outputs/derived/sp075_stale_conflict_rediagnosis_v4_20260816.json',
  qa: 'outputs/derived/opus_speed_owner_blockers_wave_20260816_qa.json',
  registry: 'docs/state/speed_task_registry.tsv',
  exclusions: 'docs/state/speed_exclusion_reason_ledger.tsv',
  cleanX: 'outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl',
  terra: 'outputs/derived/speed_community_v3_canonical_20260815.jsonl',
  xExcluded: 'outputs/derived/speed_x_excluded_prospi_20260816.jsonl',
  audit: 'docs/audits/opus_speed_owner_blockers_wave_20260816.md',
};
const full = rel => path.join(ROOT, rel);
const sha = value => createHash('sha256').update(value).digest('hex');
const norm = value => String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const checks = [];
function check(label, condition) {
  checks.push({ label, pass: Boolean(condition) });
  if (!condition) throw new Error(label);
}
function read(rel) {
  check('exists: ' + rel, fs.existsSync(full(rel)));
  return fs.readFileSync(full(rel), 'utf8');
}
function json(rel) {
  try {
    return JSON.parse(read(rel));
  } catch (error) {
    throw new Error('invalid JSON ' + rel + ': ' + error.message);
  }
}
function jsonl(rel) {
  return read(rel).split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error('invalid JSONL ' + rel + ':' + (index + 1));
    }
  });
}
function tsv(rel) {
  const lines = read(rel).trimEnd().split(/\r?\n/);
  const header = lines.shift().split('\t');
  return lines.map((line, index) => {
    const cells = line.split('\t');
    check(rel + ':' + (index + 2) + ' has expected columns', cells.length === header.length);
    return Object.fromEntries(header.map((key, column) => [key, cells[column]]));
  });
}
function countBy(rows, get) {
  return rows.reduce((out, row) => {
    const key = get(row);
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

const sp036 = json(F.sp036);
const sp022 = json(F.sp022);
const sp043 = json(F.sp043);
const sp074 = json(F.sp074);
const sp075 = json(F.sp075);
const registry = tsv(F.registry);
const exclusions = tsv(F.exclusions);
const cleanX = jsonl(F.cleanX);
const terra = jsonl(F.terra);
const xExcluded = jsonl(F.xExcluded);

check('SP-036 schema', sp036.schema_version === 'sp036_generic_label_decision_v2_20260816');
check('SP-036 status is negative finding', sp036.status === 'DONE_NEGATIVE_FINDING');
check('SP-036 preserves all outside rows', sp036.population_separation.outside_150_sweep.rows.length === 7);
check('SP-036 preserves zeroed=false', sp036.population_separation.outside_150_sweep.rows.every(row => row.zeroed === false));
check('SP-036 keeps broad legacy claim explicitly unidentifiable',
  String(sp036.original_mass_rejection_claim.broad_legacy_population_result).startsWith('NOT_IDENTIFIABLE'));

check('SP-022 schema', sp022.schema_version === 'sp022_pairwise_range_v2_20260816');
check('SP-022 has real directed pairs', sp022.pairs.length === 9900);
const pairMap = new Map(sp022.pairs.map(pair => [norm(pair.player_a) + '\u0000' + norm(pair.player_b), pair]));
for (const pair of sp022.pairs.filter(pair => pair.state === 'COMPARABLE_2025_STATISTICAL_PROXY')) {
  const reverse = pairMap.get(norm(pair.player_b) + '\u0000' + norm(pair.player_a));
  check('SP-022 reverse exists: ' + pair.player_a + '/' + pair.player_b, Boolean(reverse));
  check('SP-022 reverse probability: ' + pair.player_a + '/' + pair.player_b,
    Math.abs(pair.p_a_faster_than_b + reverse.p_a_faster_than_b - 1) < 0.000001);
}
check('SP-022 missing evidence is non-comparable',
  sp022.pairs.filter(pair => pair.state === 'MISSING_EVIDENCE_NOT_COMPARABLE').every(pair => pair.p_a_faster_than_b == null));
check('SP-022 malformed fixture was actually rejected', sp022.qa.malformed_fixture_rejected === true);
check('SP-022 future NPB input is excluded', sp022.appraisal_scope.excluded_sources.some(text => text.includes('2026 NPB+')));

check('SP-043 schema', sp043.schema_version === 'sp043_veteran_case_studies_v2_20260816');
const matsuyama = sp043.case_studies.find(row => norm(row.player) === norm('松山 竜平'));
const akiyama = sp043.case_studies.find(row => norm(row.player) === norm('秋山 翔吾'));
check('SP-043 Matsuyama case exists', Boolean(matsuyama));
check('SP-043 Matsuyama has no direct speed evidence', matsuyama.conclusion.state === 'NO_DIRECT_SPEED_EVIDENCE');
check('SP-043 Akiyama avoids decline inference', akiyama.conclusion.physical_decline_verdict === 'NOT_IDENTIFIABLE');
check('SP-043 has no fabricated peers', sp043.peer_rule.result.length === 0 && sp043.peer_rule.selection_method === 'NO_PEERS_EMITTED');

check('SP-074 schema', sp074.schema_version === 'sp074_conflict_diagnosis_v2_20260816');
check('SP-074 records the bounded negative finding', sp074.status === 'DONE_NEGATIVE_FINDING' && sp074.evidence_status === 'MEASURED_NEGATIVE');
check('SP-074 contains 100 player classifications', sp074.players.length === 100);
check('SP-074 has no tautological standardization QA', sp074.diagnosis_policy.standardized_mean_sd_checks_used === false);
check('SP-074 large fixture detects conflict', sp074.qa.large_same_time_fixture.state === 'SAME_TIME_DISAGREEMENT');
check('SP-074 missing fixture is not conflict', sp074.qa.missing_source_fixture.state === 'MISSING_EVIDENCE_NOT_CONFLICT');
check('SP-074 actual temporal state preserved', sp074.classification_counts.TEMPORALLY_CONFOUNDED === 93);

check('SP-075 schema', sp075.schema_version === 'sp075_stale_conflict_rediagnosis_v4_20260816');
check('SP-075 has 100-player coverage', sp075.players.length === 100 && sp075.population.joined_players === 100);
check('SP-075 owner context count is 18', sp075.community_effects.owner_review_context_players === 18);
check('SP-075 old stale baseline is 55 only for comparison', sp075.old_vs_new_20260815.old_owner_review_context_players === 55);
check('SP-075 old-new counts are 17/38/1',
  sp075.old_vs_new_20260815.retained_player_count === 17
  && sp075.old_vs_new_20260815.removed_player_count === 38
  && sp075.old_vs_new_20260815.added_player_count === 1);
check('SP-075 automatic effects remain 0/0',
  sp075.community_effects.player_level_speed_appraisal_changes === 0
  && sp075.community_effects.stale_auto_promotion_count === 0);
check('SP-075 Prospi has zero active influence', sp075.players.every(row =>
  row.prospi_directional_consensus_weight === 0 && row.prospi_stale_support_claims_used === 0));
check('SP-075 no unclean Terra X source was used', sp075.policy.terra_input_scope.includes('YouTube rows only'));

const activeX = cleanX.filter(row => row.current_100 === true && [
  'CURRENT_POWERPRO_RATING', 'CURRENT_REALWORLD_SPEED_PHYSICAL', 'CURRENT_TECHNIQUE_CONTEXT',
].includes(row.owner_disposition));
const activePlayers = new Set(activeX.map(row => norm(row.player_name)));
check('source clean X independently gives 28 active rows / 18 players', activeX.length === 28 && activePlayers.size === 18);
const ytCurrentPowerPro = terra.filter(row =>
  row.platform === 'YouTube'
  && row.current_100
  && row.identity_status === 'RESOLVED'
  && row.source_product === 'PowerPro'
  && row.claim_lane === 'RATING_POWERPRO'
  && row.canonical_status === 'USABLE_RATING_CONTEXT',
);
check('source Terra YouTube contributes zero current PowerPro rows', ytCurrentPowerPro.length === 0);
check('source excluded X file retains its Prospi-all exclusion disposition', xExcluded.every(row => row.owner_disposition === 'EXCLUDED_PROSPI_ALL'));
check('source excluded X Prospi count is 73', xExcluded.filter(row => row.current_100).length === 73);
check('source Terra YouTube Prospi count is 4', terra.filter(row => row.platform === 'YouTube' && row.current_100 && row.source_product === 'Prospi').length === 4);

const rowById = new Map(registry.map(row => [row.task_id, row]));
for (const taskId of ['SP-036', 'SP-022', 'SP-043', 'SP-074', 'SP-075']) {
  const row = rowById.get(taskId);
  check('registry contains ' + taskId, Boolean(row));
  check('registry closes ' + taskId, ['DONE_VALIDATED', 'DONE_NEGATIVE_FINDING'].includes(row.status));
  check('registry points to 20260816 deliverable for ' + taskId, row.artifacts.includes('20260816'));
}
check('EX-011 has truthful terminal status', exclusions.find(row => row.exclusion_id === 'EX-011').verdict === 'NOT_IDENTIFIABLE_PROVISIONAL_CURRENT_BEHAVIOR');
check('EX-013 has validated downgrade status', exclusions.find(row => row.exclusion_id === 'EX-013').verdict === 'VALID_DOWNGRADE_NOT_ZERO');

const verifiedArtifacts = [
  F.sp036, F.sp022, F.sp043, F.sp074, F.sp075,
  F.registry, F.exclusions, F.cleanX, F.terra, F.xExcluded, F.audit,
];
const artifactHashes = Object.fromEntries(verifiedArtifacts.map(rel => [rel, sha(read(rel))]));
const precursorArtifacts = [F.sp036, F.sp022, F.sp043, F.sp074];
check('SP-075 records all A-D precursor hashes', precursorArtifacts.every(rel =>
  sp075.source_hashes[rel] === artifactHashes[rel]));

const result = {
  schema_version: 'opus_speed_owner_blockers_wave_20260816_qa',
  generated_at: DATE,
  qa_type: 'independent_reread',
  verdict: 'PASS',
  checks_run: checks.length,
  failed_checks: checks.filter(check => !check.pass),
  verified_artifact_hashes: artifactHashes,
  scope_guard: {
    no_network_or_collection_operations: true,
    no_shoulder_work: true,
    no_sp077_or_later_work: true,
    no_global_speed_gate_close: true,
    production_default_changed: false,
  },
  sp075_owner_review_context_players: sp075.community_effects.owner_review_context_players,
  automatic_rating_changes: sp075.community_effects.player_level_speed_appraisal_changes,
  automatic_stale_promotions: sp075.community_effects.stale_auto_promotion_count,
  source_counts: {
    active_x: activeX.length,
    active_x_players: activePlayers.size,
    terra_youtube_powerpro: ytCurrentPowerPro.length,
    excluded_x_prospi: xExcluded.filter(row => row.current_100).length,
  },
};
const qaTarget = full(F.qa);
const qaTemp = qaTarget + '.tmp-' + process.pid;
fs.writeFileSync(qaTemp, JSON.stringify(result, null, 2) + '\n', 'utf8');
fs.renameSync(qaTemp, qaTarget);
console.log(JSON.stringify(result, null, 2));

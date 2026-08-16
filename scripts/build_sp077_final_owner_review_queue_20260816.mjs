// SP-077 final pre-owner-review queue.
//
// This is deliberately a queue, not SP-079: it preserves current physical
// material, 2025 statistical context, and Community context as separate lanes.
// It never creates a final practical rating or an owner verdict.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = '2026-08-16';
const CLOSED = new Set(['DONE_VALIDATED', 'DONE_NEGATIVE_FINDING', 'SUPERSEDED', 'OBSOLETE_DUPLICATE']);
const F = {
  registry: 'docs/state/speed_task_registry.tsv',
  master: 'outputs/derived/speed_2026_100_master_evidence.csv',
  sp022: 'outputs/derived/sp022_pairwise_range_v2_20260816.json',
  sp074: 'outputs/derived/sp074_conflict_diagnosis_v2_20260816.json',
  sp075: 'outputs/derived/sp075_stale_conflict_rediagnosis_v4_20260816.json',
  sp098: 'outputs/derived/sp098_identity_coverage_qa_20260816.json',
  sp100: 'outputs/derived/sp100_production_wiring_decision_packet_20260816.json',
  queueJson: 'outputs/derived/sp077_final_owner_review_queue_20260816.json',
  queueCsv: 'outputs/derived/sp077_final_owner_review_queue_20260816.csv',
  report: 'docs/reports/sp077_final_owner_review_queue_20260816.md',
};

const full = rel => path.join(ROOT, rel);
const sha256 = text => createHash('sha256').update(text).digest('hex');
const norm = value => String(value ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const numeric = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
function fail(message) { throw new Error(`SP-077 fail-closed: ${message}`); }
function check(label, condition) { if (!condition) fail(label); }
function read(rel) {
  const abs = full(rel);
  check(`missing input ${rel}`, fs.existsSync(abs));
  return fs.readFileSync(abs, 'utf8');
}
function json(rel) {
  try { return JSON.parse(read(rel)); }
  catch (error) { fail(`invalid JSON ${rel}: ${error.message}`); }
}
function parseTsv(rel) {
  const lines = read(rel).replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  const header = lines.shift().split('\t');
  return lines.filter(Boolean).map((line, index) => {
    const cells = line.split('\t');
    check(`${rel}:${index + 2} has ${header.length} columns`, cells.length === header.length);
    return Object.fromEntries(header.map((key, column) => [key, cells[column]]));
  });
}
function parseCsv(text) {
  const rows = []; let fields = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { fields.push(field); field = ''; }
    else if (ch === '\n') { fields.push(field.replace(/\r$/, '')); rows.push(fields); fields = []; field = ''; }
    else field += ch;
  }
  if (field || fields.length) { fields.push(field.replace(/\r$/, '')); rows.push(fields); }
  const header = rows.shift();
  check('current-100 CSV has a header', Array.isArray(header) && header.length > 1);
  return rows.filter(row => row.length > 1).map((row, index) => {
    check(`current-100 CSV row ${index + 2} has expected columns`, row.length === header.length);
    return Object.fromEntries(header.map((key, column) => [key, row[column]]));
  });
}
function atomicWrite(rel, body) {
  const target = full(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temp, body, 'utf8');
  fs.renameSync(temp, target);
}
function csvEscape(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function list(value) { return String(value ?? '').split(',').map(item => item.trim()).filter(Boolean); }

function assertDependencies(registryRows) {
  const byId = new Map(registryRows.map(row => [row.task_id, row]));
  const task = byId.get('SP-077');
  check('SP-077 registry row exists', Boolean(task));
  const dependencyIds = list(task.depends_on);
  check('SP-077 declares dependencies', dependencyIds.length > 0);
  const open = dependencyIds.map(id => ({ id, row: byId.get(id) }))
    .filter(({ row }) => !row || !CLOSED.has(row.status));
  if (open.length) fail(`declared dependency not closed: ${open.map(({ id, row }) => `${id}=${row?.status ?? 'MISSING'}`).join(', ')}`);
  return { byId, task, dependencyIds };
}

const registryRows = parseTsv(F.registry);
if (process.argv.includes('--fixture-open-dependency')) {
  const fixture = registryRows.map(row => ({ ...row }));
  const sp016 = fixture.find(row => row.task_id === 'SP-016');
  check('fixture has SP-016', Boolean(sp016));
  sp016.status = 'PARTIAL';
  let rejected = false;
  try { assertDependencies(fixture); } catch (error) { rejected = /declared dependency not closed/.test(error.message); }
  check('open declared dependency fixture is rejected', rejected);
  console.log(JSON.stringify({ fixture: 'open_declared_sp077_dependency', result: 'PASS' }));
  process.exit(0);
}
const { byId, dependencyIds } = assertDependencies(registryRows);
const sp071 = byId.get('SP-071');
const sp100Registry = byId.get('SP-100');
check('SP-071 registry row exists', Boolean(sp071));
check('SP-100 registry row exists', Boolean(sp100Registry));

const sourceTexts = Object.fromEntries([F.registry, F.master, F.sp022, F.sp074, F.sp075, F.sp098, F.sp100]
  .map(rel => [rel, read(rel)]));
const sourceHashes = Object.fromEntries(Object.entries(sourceTexts).map(([rel, text]) => [rel, sha256(text)]));
const masterRows = parseCsv(sourceTexts[F.master]);
const sp022 = JSON.parse(sourceTexts[F.sp022]);
const sp074 = JSON.parse(sourceTexts[F.sp074]);
const sp075 = JSON.parse(sourceTexts[F.sp075]);
const sp098 = JSON.parse(sourceTexts[F.sp098]);
const sp100 = JSON.parse(sourceTexts[F.sp100]);

check('current-100 source has exactly 100 rows', masterRows.length === 100);
check('SP-022 provides 100 profiles', Array.isArray(sp022.profiles) && sp022.profiles.length === 100);
check('SP-074 provides 100 classifications', Array.isArray(sp074.players) && sp074.players.length === 100);
check('SP-075 provides 100 player contexts', Array.isArray(sp075.players) && sp075.players.length === 100);
check('SP-098 identity QA passed', sp098?.summary?.result === 'PASS');
check('SP-100 packet remains a recommendation, not an implementation',
  sp100?.status === 'PARTIAL' && sp100?.production_behavior_changed === false);
check('SP-100 packet selects no production architecture without owner ruling',
  sp100?.implemented_architecture == null);

const sp022ByName = new Map(sp022.profiles.map(row => [norm(row.player), row]));
const sp074ByName = new Map(sp074.players.map(row => [norm(row.player), row]));
const sp075ByName = new Map(sp075.players.map(row => [norm(row.player), row]));
const sp098Outcomes = sp098.outcomes ?? {};

function identityFor(row) {
  const player = norm(row.player);
  if (player === norm('名原 典彦')) {
    const result = sp098Outcomes.nahara;
    check('SP-098 provides 名原 canonical crosswalk', result?.canonical_key === 'BM_PLAYER:20230057');
    return {
      stable_player_key: result.canonical_key,
      production_player_id: null,
      canonical_crosswalk_key: result.canonical_key,
      identity_status: result.status,
      batting_coverage: result.batting_coverage,
    };
  }
  const playerId = String(row.player_id ?? '').trim();
  const fallback = String(row.roster_join_key || row.roster_row_id || row.player).trim();
  return {
    stable_player_key: playerId ? `PROEYE:${playerId}` : `ROSTER:${fallback}`,
    production_player_id: playerId || null,
    canonical_crosswalk_key: null,
    identity_status: row.identity_status || 'SOURCE_IDENTITY_STATUS_NOT_RECORDED',
    batting_coverage: 'NOT_EVALUATED_BY_SP098',
  };
}

const ownerFlags = [
  `SP-100=${sp100Registry.status}: ${sp100?.exact_one_line_owner_approval_required ?? sp100?.required_owner_approval ?? sp100?.owner_decision?.required_approval ?? 'owner production-wiring decision required'}`,
  `SP-071=${sp071.status}: absolute 0-100 scale remains provisional pending engine bridge`,
  'SP-079 is not run by this queue; no final practical reappraisal is represented here.',
];
const players = masterRows.map((row, index) => {
  const nameKey = norm(row.player);
  const s = sp022ByName.get(nameKey);
  const conflict = sp074ByName.get(nameKey);
  const community = sp075ByName.get(nameKey);
  check(`SP-022 profile joins ${row.player}`, Boolean(s));
  check(`SP-074 classification joins ${row.player}`, Boolean(conflict));
  check(`SP-075 context joins ${row.player}`, Boolean(community));
  const conflictClassification = conflict.classification ?? null;
  const conflictState = typeof conflictClassification === 'object'
    ? conflictClassification.state ?? null
    : conflictClassification;
  const identity = identityFor(row);
  const activeCommunityRows = Number(community.active_community_source_row_count ?? 0);
  const activeCommunity = activeCommunityRows > 0;
  return {
    queue_row_key: `SP077:${identity.stable_player_key}`,
    queue_order: index + 1,
    identity: {
      player: row.player,
      team: row.team,
      roster_row_id: row.roster_row_id || null,
      roster_join_key: row.roster_join_key || null,
      ...identity,
      source_identity_flags: (() => { try { return JSON.parse(row.identity_flags || '[]'); } catch { return [row.identity_flags]; } })(),
    },
    current_physical_evidence: {
      appraisal_year: 2026,
      npb_plus_top_speed_kmh: numeric(row.npb_plus_sprint_speed_kmh),
      measure_class: 'NPB_PLUS_TOP_MAX_SPEED_DIRECT_MAX_STATISTIC',
      full_effort_run_proxy_count: numeric(row.full_effort_run_proxy_count),
      exposure_class: row.exposure_class || null,
      exposure_confidence: row.exposure_confidence || null,
      undersampling_suspicion: row.undersampling_suspicion || null,
      direct_t90_current_count: numeric(row.direct_t90_current_count),
      standardized_short_distance_count: numeric(row.standardized_short_distance_count),
      historical_profile_count: numeric(row.historical_profile_count),
      physical_record_count: numeric(row.physical_record_count),
      existing_provisional_physical_point: numeric(row.blind_v3_baseline_rating),
      existing_provisional_t90: numeric(row.blind_v3_t90),
      existing_point_status: 'PRESERVED_PROVISIONAL_NOT_A_FINAL_SP079_APPRAISAL',
      provenance: row.source_artifact_references || null,
      limitation: 'N is direct current maximum-statistic evidence, not error-free. Exposure is confidence/context only and does not numerically shrink N.',
    },
    statistical_proxy_context: {
      appraisal_year: s.appraisal_year,
      state: s.state,
      value_z: s.value_z,
      reliability: s.S_reliability,
      pa_2025: s.pa_2025,
      effective_sample_fraction: s.effective_sample_fraction,
      quality: s.quality,
      sigma: s.sigma,
      role: 'CONTEXT_AND_PAIRWISE_RANGE_ONLY_NOT_A_PHYSICAL_TEACHER',
      provenance: F.sp022,
    },
    community_rating_consensus_context: {
      active_under_sp075_policy: activeCommunity,
      active_source_row_count: activeCommunityRows,
      active_source_event_count: Number(community.active_community_source_event_count ?? 0),
      effect: activeCommunity ? community.community_effect : null,
      source_counts: community.source_counts ?? null,
      role: 'OWNER_REVIEW_CONTEXT_ONLY_NOT_A_PHYSICAL_TEACHER_OR_AUTOMATIC_ACTION',
      provenance: F.sp075,
    },
    pairwise_and_conflict_context: {
      sp022_pairwise_context_state: s.state,
      sp074_classification: conflictClassification,
      sp074_state: conflictState,
      temporal_confounding: conflictState === 'TEMPORALLY_CONFOUNDED',
      physical_teacher_prohibited: true,
      provenance: [F.sp022, F.sp074],
    },
    missingness_and_coverage: {
      source_best_evidence_tier: row.source_best_evidence_tier || null,
      decision_usable_evidence_tier: row.decision_usable_evidence_tier || null,
      blind_v3_status: row.blind_v3_status || null,
      measurement_date_record_count: numeric(row.measurement_date_record_count),
      measurement_year_statuses: (() => { try { return JSON.parse(row.measurement_year_statuses || '[]'); } catch { return [row.measurement_year_statuses]; } })(),
      no_negative_inference_from_missingness: true,
    },
    provisional_status: {
      labels: ownerFlags,
      sp100_owner_decision_required: true,
      sp071_absolute_scale_finalization_pending: true,
      no_sp079_final_reappraisal_entered: true,
    },
    owner_verdict: {
      status: 'NOT_ENTERED',
      verdict: null,
      note: null,
      preferred_rating_optional: null,
      timestamp: null,
      source: null,
      reviewer: null,
    },
  };
});

check('queue has exactly 100 rows', players.length === 100);
check('queue row keys are unique', new Set(players.map(row => row.queue_row_key)).size === players.length);
check('all rows preserve an identity key', players.every(row => row.identity.stable_player_key));
check('all rows keep verdicts blank', players.every(row => row.owner_verdict.status === 'NOT_ENTERED' && row.owner_verdict.verdict == null));
check('only active SP-075 context is included', players.filter(row => !row.community_rating_consensus_context.active_under_sp075_policy)
  .every(row => row.community_rating_consensus_context.effect == null));
check('all rows label SP-100 and SP-071 as provisional', players.every(row =>
  row.provisional_status.sp100_owner_decision_required && row.provisional_status.sp071_absolute_scale_finalization_pending));

const output = {
  schema_version: 'sp077_final_owner_review_queue_20260816',
  generated_at: DATE,
  task_id: 'SP-077',
  status: 'DONE_VALIDATED_PENDING_OWNER_VERDICTS',
  purpose: 'Final pre-owner-review queue only; it does not run SP-079 or create a final practical rating.',
  dependency_gate: {
    declared_dependencies: dependencyIds,
    all_declared_dependencies_closed: true,
    fixture_open_dependency_rejection_command: 'node scripts/build_sp077_final_owner_review_queue_20260816.mjs --fixture-open-dependency',
  },
  source_hashes: sourceHashes,
  scope_guards: {
    no_external_collection: true,
    no_shoulder_work: true,
    no_sp079_sp080_sp081: true,
    no_owner_verdicts_created: true,
    no_powerpro_individual_teacher: true,
    no_future_year_annual_appraisal_weighting: true,
  },
  provisional_constraints: {
    sp100_status: sp100Registry.status,
    sp100_recommendation: sp100?.technical_recommendation ?? 'N_PRIMARY_S_CONTEXT_OR_FALLBACK',
    sp100_implemented_architecture: sp100?.implemented_architecture ?? null,
    sp071_status: sp071.status,
    text: ownerFlags,
  },
  population: {
    intended_current_100_count: 100,
    emitted_count: players.length,
    unique_stable_row_keys: new Set(players.map(row => row.queue_row_key)).size,
    active_sp075_community_context_players: new Set(players.filter(row => row.community_rating_consensus_context.active_under_sp075_policy)
      .map(row => row.identity.stable_player_key)).size,
  },
  players,
};

const csvColumns = [
  'queue_row_key', 'queue_order', 'player', 'team', 'stable_player_key', 'production_player_id', 'canonical_crosswalk_key',
  'identity_status', 'batting_coverage', 'npb_plus_top_speed_kmh', 'existing_provisional_physical_point', 'existing_provisional_t90',
  'sp022_state', 'sp022_value_z', 'sp022_sigma', 'sp075_active_context', 'sp075_active_source_row_count', 'sp074_classification',
  'source_best_evidence_tier', 'decision_usable_evidence_tier', 'owner_verdict_status', 'sp100_provisional', 'sp071_provisional',
];
const csvRows = players.map(row => ({
  queue_row_key: row.queue_row_key,
  queue_order: row.queue_order,
  player: row.identity.player,
  team: row.identity.team,
  stable_player_key: row.identity.stable_player_key,
  production_player_id: row.identity.production_player_id,
  canonical_crosswalk_key: row.identity.canonical_crosswalk_key,
  identity_status: row.identity.identity_status,
  batting_coverage: row.identity.batting_coverage,
  npb_plus_top_speed_kmh: row.current_physical_evidence.npb_plus_top_speed_kmh,
  existing_provisional_physical_point: row.current_physical_evidence.existing_provisional_physical_point,
  existing_provisional_t90: row.current_physical_evidence.existing_provisional_t90,
  sp022_state: row.statistical_proxy_context.state,
  sp022_value_z: row.statistical_proxy_context.value_z,
  sp022_sigma: row.statistical_proxy_context.sigma,
  sp075_active_context: row.community_rating_consensus_context.active_under_sp075_policy,
  sp075_active_source_row_count: row.community_rating_consensus_context.active_source_row_count,
  sp074_classification: row.pairwise_and_conflict_context.sp074_state,
  source_best_evidence_tier: row.missingness_and_coverage.source_best_evidence_tier,
  decision_usable_evidence_tier: row.missingness_and_coverage.decision_usable_evidence_tier,
  owner_verdict_status: row.owner_verdict.status,
  sp100_provisional: true,
  sp071_provisional: true,
}));
const report = [
  '# SP-077 final owner review queue',
  '',
  `Date: ${DATE}`,
  '',
  '## Status',
  '',
  `- Queue coverage: **${players.length}/100**, exactly once by stable row key.`,
  '- No owner verdict is entered. This is pre-owner-review infrastructure, not SP-079.',
  `- SP-100 remains **${sp100Registry.status}**: technical recommendation is N-primary/S-context-or-fallback, but production is unchanged pending explicit owner approval.`,
  `- SP-071 remains **${sp071.status}**: the absolute 0–100 display scale is provisional.`,
  '',
  '## Reading the rows',
  '',
  '- `current_physical_evidence` is the current 2026 NPB+ top/max-speed lane and separately preserves any existing provisional physical point. It is not a final SP-079 rating.',
  '- `statistical_proxy_context` is the 2025 S/pairwise lane. It is context only and never a physical teacher.',
  '- `community_rating_consensus_context` is present only where active under SP-075; it is owner-review context only and never an automatic action.',
  '- Missingness is explicit and is never converted into negative evidence.',
  '- 名原 uses the stable `BM_PLAYER:20230057` crosswalk with batting coverage marked missing; no ProEYE id or 2025 first-team batting value is invented.',
  '',
  '## Machine-readable artifacts',
  '',
  `- ${F.queueJson}`,
  `- ${F.queueCsv}`,
  '',
  '## Compact 100-player index',
  '',
  '| # | Player | Stable key | 2026 N top speed | S context | Active SP-075 context | SP-074 state | Verdict |',
  '|---:|---|---|---:|---|---:|---|---|',
  ...players.map(row => `| ${row.queue_order} | ${row.identity.player} | ${row.identity.stable_player_key} | ${row.current_physical_evidence.npb_plus_top_speed_kmh ?? '-'} | ${row.statistical_proxy_context.state} | ${row.community_rating_consensus_context.active_source_row_count} | ${row.pairwise_and_conflict_context.sp074_state ?? '-'} | ${row.owner_verdict.status} |`),
  '',
].join('\n');

atomicWrite(F.queueJson, JSON.stringify(output, null, 2) + '\n');
atomicWrite(F.queueCsv, [csvColumns.join(','), ...csvRows.map(row => csvColumns.map(column => csvEscape(row[column])).join(','))].join('\n') + '\n');
atomicWrite(F.report, report);
console.log(JSON.stringify({
  ok: true,
  emitted_rows: players.length,
  active_sp075_context_players: output.population.active_sp075_community_context_players,
  owner_verdicts_written: 0,
  dependency_gate: 'PASS',
  outputs: [F.queueJson, F.queueCsv, F.report],
}, null, 2));

// Construct-complete SP-077 owner-review queue.
// Restores every retained speed evidence lane to each player row without
// producing a final practical rating or owner verdict.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = '2026-08-17';
const F = {
  oldQueue: 'outputs/derived/sp077_final_owner_review_queue_20260816.json',
  h2f: 'outputs/derived/sp007_h2f_low_confidence_lane.json',
  recoveredPhysical: 'outputs/derived/sp017_physical_measurement_range_reclassification.json',
  physical: 'data/manual/npb_speed_physical_evidence_full_20260809.json',
  runNorm: 'configs/running_norms.json',
  stale: 'outputs/derived/sp042_powerpro_stale_detector.json',
  injury: 'outputs/derived/sp045_injury_search_20260814.json',
  age: 'outputs/derived/sp044_age_birth_search_20260814.json',
  xClean: 'outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl',
  contract: 'docs/state/speed_construct_traceability_contract_20260817.tsv',
  out: 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json',
  report: 'docs/reports/sp077_construct_complete_owner_review_queue_20260817.md',
};
const full = p => path.join(ROOT, p);
const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const read = p => {
  if (!fs.existsSync(full(p))) throw new Error(`missing input: ${p}`);
  return fs.readFileSync(full(p), 'utf8');
};
const json = p => JSON.parse(read(p));
const sha = text => createHash('sha256').update(text).digest('hex');
const nullableNumber = v => (v === null || v === undefined || v === '') ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const asArray = v => Array.isArray(v) ? v : [];
const metricText = r => `${r?.metric ?? ''} ${r?.metric_raw ?? ''} ${r?.metric_canonical ?? ''} ${r?.start_protocol ?? ''}`;
const isT90 = r => /(T90|90\s*ft|90ft|home.?to.?first|home-to-first|一塁到達)/i.test(metricText(r));
const isShort = r => /(^|[^0-9])(10m|20m|30m|40m|50m|60yd|60-yard)([^0-9]|$)/i.test(metricText(r));
const missing = (reason, sources) => ({
  evidence_state: 'MISSING_BOUNDED',
  reason,
  no_negative_inference: true,
  searched_or_scoped_sources: sources,
});

const oldText = read(F.oldQueue);
const oldQueue = JSON.parse(oldText);
if (!Array.isArray(oldQueue.players) || oldQueue.players.length !== 100) throw new Error('old SP-077 queue is not exact 100');
const h2f = json(F.h2f);
const recovered = json(F.recoveredPhysical);
const physical = json(F.physical);
const runNorm = json(F.runNorm);
const stale = json(F.stale);
const injury = json(F.injury);
const age = json(F.age);
const contractText = read(F.contract);
const xRows = read(F.xClean).split(/\r?\n/).filter(Boolean).map((line, i) => {
  try { return JSON.parse(line); } catch (e) { throw new Error(`invalid ${F.xClean}:${i + 1}: ${e.message}`); }
});
const db = new DatabaseSync(full('data/pennant.db'), { readOnly: true });

const normalH2F = new Map(asArray(h2f.normal_swing?.players ?? h2f.rows).map(r => [norm(r.canonical_name ?? r.player), r]));
const buntH2F = new Map(asArray(h2f.bunt?.players ?? h2f.bunt_rows ?? h2f.buntRows).map(r => [norm(r.canonical_name ?? r.player), r]));
const physicalByName = new Map(asArray(physical.players).map(r => [norm(r.player), r]));
const recoveredByName = new Map();
for (const r of asArray(recovered.records)) {
  const k = norm(r.canonical_name ?? r.raw_name ?? r.player);
  if (!recoveredByName.has(k)) recoveredByName.set(k, []);
  recoveredByName.get(k).push(r);
}
const staleByName = new Map(asArray(stale.rows ?? stale.players).map(r => [norm(r.player), r]));
const xByName = new Map();
for (const r of xRows) {
  const k = norm(r.player ?? r.canonical_player ?? r.subject_player ?? r.player_name);
  if (!k) continue;
  if (!xByName.has(k)) xByName.set(k, []);
  xByName.get(k).push(r);
}

function compactPhysicalRecord(r) {
  const y = Number.isFinite(Number(r.measurement_year)) ? Number(r.measurement_year) : null;
  return {
    measurement_year: y,
    temporal_distance_years_from_2026: y == null ? null : 2026 - y,
    metric: r.metric ?? r.metric_canonical ?? r.metric_raw ?? null,
    seconds: nullableNumber(r.seconds ?? r.value),
    value: nullableNumber(r.value ?? r.seconds),
    unit: r.unit ?? (r.seconds != null ? 'sec' : null),
    usage_class: r.usage_class ?? r.reclassification_status ?? null,
    confidence: r.confidence ?? null,
    timing_method: r.timing_method ?? null,
    start_protocol: r.start_protocol ?? null,
    source_tier: r.source_tier ?? null,
    source_name: r.source_name ?? null,
    source_url: r.source_url ?? null,
    published_date: r.published_date ?? null,
    numeric_t90_usable: r.numeric_t90_usable ?? false,
    same_measurement_cluster_id: r.same_measurement_cluster_id ?? null,
    reason: r.reason ?? r.range_use ?? null,
    flags: r.flags ?? [],
    carryover_role: 'PROFILE_OR_PRIOR_ONLY_REQUIRES_EXPLICIT_CURRENT_CARRYOVER_REASON',
  };
}

function gameContext(playerId, playerName) {
  if (!playerId) return missing('NO_PROEYE_BATTING_ID_FOR_2025_GAME_CONTEXT', [F.oldQueue, 'data/pennant.db']);
  const line = db.prepare(`SELECT * FROM v_batting WHERE player_id=? AND season=2025 AND position <> '投'`).get(String(playerId));
  if (!line || !(Number(line.pa) > 0)) return missing('NO_2025_FIRST_TEAM_BATTING_SAMPLE', ['data/pennant.db']);
  const bm = db.prepare(`
    SELECT b.ubr, b.wsb, m.gb_pct
    FROM v_bm_by_player b
    LEFT JOIN player_link l ON l.proeye_id=b.proeye_id AND l.season=b.season
    LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
    WHERE b.proeye_id=? AND b.season=2025 AND b.farm=0`).get(String(playerId));
  const ih = db.prepare(`
    SELECT t.ih, t.bats FROM nf3_team_bat t
    JOIN nf3_team_link l ON l.season=t.season AND l.name_norm=t.name_norm
    WHERE l.proeye_id=? AND t.season=2025`).get(String(playerId));
  if (!bm) return {
    evidence_state: 'PARTIAL',
    season: 2025,
    role: 'MIXED_GAME_CONTEXT_PROXY_NOT_DIRECT_PHYSICAL_TEACHER',
    line_summary: { PA: line.pa, AB: line.ab, B2: line.b2, B3: line.b3, HR: line.hr, SO: line.so, GDP: line.gdp },
    components: null,
    missing_reason: 'NO_2025_BASEMENT_CONTEXT_ROW',
    provenance: ['data/pennant.db', 'src/ratings/running.mjs'],
  };
  const adv = advanceOf(db, norm(playerName), 2025);
  const sc = speedComponents({
    PA: line.pa, AB: line.ab, H: line.h, B2: line.b2, B3: line.b3, HR: line.hr,
    BB: line.bb, HBP: line.hbp, SO: line.so, SH: line.sh, SF: line.sf,
    GDP: line.gdp, SB: line.sb, CS: line.cs,
  }, {
    gbPct: bm.gb_pct, infieldHits: ih?.ih ?? null, bats: ih?.bats ?? null,
    season: 2025, advance: adv?.value ?? null, advanceChances: adv?.chances ?? 0,
  }, bm.ubr, runNorm);
  return {
    evidence_state: 'AVAILABLE_MIXED_PROXY',
    season: 2025,
    role: 'MIXED_GAME_CONTEXT_PROXY_NOT_DIRECT_PHYSICAL_TEACHER',
    interpretation_guard: 'Do not treat outcome/context signals as pure speed; preserve batted-ball and baserunning confounding.',
    raw: sc.raw,
    z: sc.z,
    same_time_weights: sc.weights,
    legacy_composite_score_context_only: sc.score,
    used_component_count: sc.used,
    sample: { PA: line.pa, AB: line.ab, advance_chances: adv?.chances ?? 0 },
    provenance: ['data/pennant.db', 'src/ratings/running.mjs', 'configs/running_norms.json'],
  };
}

function splitCommunity(nameKey, oldCommunity) {
  const allRows = xByName.get(nameKey) ?? [];
  const ACTIVE = new Set(['CURRENT_POWERPRO_RATING', 'CURRENT_REALWORLD_SPEED_PHYSICAL', 'CURRENT_TECHNIQUE_CONTEXT']);
  // SP-075 policy defines active owner-review context by owner_disposition.
  // usable_for_current100 is preserved as a semantic qualifier, NOT an
  // activation filter: comparison-only PowerPro context (e.g. Polanco) and
  // technique-only context (e.g. Oshima) remain visible to the owner while
  // still carrying usable_for_current100=false so they cannot become a
  // physical teacher or automatic appraisal input.
  const rows = allRows.filter(r => r.current_100 === true
    && ACTIVE.has(String(r.owner_disposition ?? '')));
  const physicalRows = rows.filter(r => r.owner_disposition === 'CURRENT_REALWORLD_SPEED_PHYSICAL');
  const techniqueRows = rows.filter(r => r.owner_disposition === 'CURRENT_TECHNIQUE_CONTEXT');
  const ratingRows = rows.filter(r => r.owner_disposition === 'CURRENT_POWERPRO_RATING');
  const compact = r => ({
    record_id: r.record_id ?? null,
    source_record_id: r.source_record_id ?? null,
    source_date: r.published_at ?? r.temporal_context ?? null,
    disposition: r.owner_disposition ?? null,
    claim_lane: r.claim_lane ?? r.source_claim_lane ?? null,
    direction: r.direction ?? null,
    speed_concept: r.speed_concept ?? null,
    discourse: r.discourse ?? null,
    canonical_status: r.canonical_status ?? null,
    usable_for_current100: r.usable_for_current100 === true,
    text: r.text_or_excerpt ?? null,
    url: r.source_url ?? null,
  });
  return {
    evidence_state: rows.length ? 'AVAILABLE_BOUNDED' : 'MISSING_BOUNDED',
    active_source_row_count: rows.length,
    physical_observation_rows: physicalRows.map(compact),
    technique_context_rows: techniqueRows.map(compact),
    powerpro_rating_context_rows: ratingRows.map(compact),
    aggregate_source_counts: oldCommunity?.source_counts ?? null,
    role: 'OWNER_REVIEW_CONTEXT_ONLY',
    missing_is_negative: false,
    activation_rule: 'current_100=true AND owner_disposition in SP-075 active dispositions; usable_for_current100 is retained as a qualifier, not an activation filter',
    provenance: [F.xClean, 'outputs/derived/sp075_stale_conflict_rediagnosis_v4_20260816.json'],
  };
}

const players = oldQueue.players.map(row => {
  const name = row.identity.player;
  const key = norm(name);
  const p = physicalByName.get(key) ?? null;
  const rawRecords = asArray(p?.records);
  const recoveredRecords = recoveredByName.get(key) ?? [];
  const normal = normalH2F.get(key) ?? null;
  const bunt = buntH2F.get(key) ?? null;
  const t90Records = rawRecords.filter(isT90).map(compactPhysicalRecord);
  const shortRecords = [...rawRecords.filter(isShort).map(compactPhysicalRecord),
    ...recoveredRecords.filter(isShort).map(compactPhysicalRecord)];
  const allHist = [...rawRecords.map(compactPhysicalRecord), ...recoveredRecords.map(compactPhysicalRecord)];
  const historical = allHist.filter(r => r.measurement_year == null || r.measurement_year < 2026);
  const physicalSearch = p?.search ?? null;
  const staleRow = staleByName.get(key) ?? null;
  const community = splitCommunity(key, row.community_rating_consensus_context);
  const injuryContext = {
    evidence_state: 'MISSING_BOUNDED',
    repository_search_status: injury?.status ?? injury?.evidence_status ?? 'NO_PLAYER_LEVEL_STRUCTURED_INJURY_JOIN',
    player_level_injury_join_available: false,
    reason: 'SP-045 found no structured player-level injury/recovery rows with sufficient date+body-part context; absence is not evidence of no injury.',
    no_negative_inference: true,
    provenance: F.injury,
  };
  const ageContext = {
    evidence_state: 'MISSING_BOUNDED',
    player_level_birthdate_join_available: false,
    reason: 'SP-044 is BLOCKED_MISSING_DATA; age is not manufactured from unrelated evidence.',
    no_negative_inference: true,
    provenance: F.age,
  };

  return {
    ...row,
    construct_contract: {
      definition: 'PHYSICAL_RUNNING_ABILITY_FROM_FIRST_RUNNING_STEP_TO_ABOUT_90FT',
      required_visible_dimensions: ['INITIAL_ACCELERATION', 'TOP_SPEED', 'SPEED_MAINTENANCE_TO_ABOUT_90FT'],
      top_speed_is_full_construct: false,
      stealing_and_baserunning_technique_are_separate: true,
      final_practical_rating_created_here: false,
      provenance: ['docs/state/speed_requirements_baseline_20260813.tsv', F.contract],
    },
    top_speed_evidence: {
      evidence_state: 'AVAILABLE_CURRENT_DIRECT_MAX_STATISTIC',
      season: 2026,
      npb_plus_top_speed_kmh: row.current_physical_evidence.npb_plus_top_speed_kmh,
      z: row.current_physical_evidence.npb_top_speed_z,
      rank: row.current_physical_evidence.rank_fastest_in_current_100,
      exposure_context: row.current_physical_evidence.exposure_context,
      reliability: row.current_physical_evidence.measurement_reliability,
      role: 'TOP_SPEED_LANE_ONLY_NOT_FULL_SPEED_CONSTRUCT',
      provenance: row.current_physical_evidence.provenance,
    },
    acceleration_h2f_t90_evidence: {
      evidence_state: normal || bunt || t90Records.length ? 'AVAILABLE_BOUNDED' : 'MISSING_BOUNDED',
      normal_swing_h2f: normal ? {
        seconds: nullableNumber(normal.seconds),
        n_independent_records: nullableNumber(normal.n_independent_records),
        n_raw_records: nullableNumber(normal.n_raw_records),
        z_within_sample_lower_is_faster: nullableNumber(normal.z),
        handedness: normal.bats ?? null,
        confidence: 'LOW',
        lane: normal.lane,
        sources: normal.sources ?? [],
      } : null,
      bunt_h2f: bunt ? {
        seconds: nullableNumber(bunt.seconds),
        n_independent_records: nullableNumber(bunt.n_independent_records),
        n_raw_records: nullableNumber(bunt.n_raw_records),
        z_within_sample_lower_is_faster: nullableNumber(bunt.z),
        handedness: bunt.bats ?? null,
        confidence: 'LOW_VERY_SMALL_SAMPLE',
        lane: bunt.lane,
        sources: bunt.sources ?? [],
        note: bunt.note ?? null,
      } : null,
      direct_or_standardized_t90_records: t90Records,
      role: 'ACCELERATION_CONTEXT; H2F_BUNT_AND_NORMAL_ARE_SEPARATE; NEVER_STANDALONE_RATING',
      source_scope_guard: 'NPB+ hp_to_1b_sec provenance failure does not invalidate independently sourced H2F/T90 evidence.',
      missingness: normal || bunt || t90Records.length ? null : missing(
        physicalSearch?.outcome ?? 'NO_RETAINED_H2F_T90_RECORD',
        [F.h2f, F.physical]),
      provenance: [F.h2f, F.physical],
    },
    short_distance_physical_evidence: {
      evidence_state: shortRecords.length ? 'AVAILABLE_BOUNDED' : 'MISSING_BOUNDED',
      records: shortRecords,
      transformation_guard: 'RAW_30M_50M_ETC_RETAINED; NO_LINEAR_DISTANCE_SCALING_TO_T90',
      missingness: shortRecords.length ? null : missing(physicalSearch?.outcome ?? 'NO_RETAINED_SHORT_DISTANCE_RECORD', [F.physical, F.recoveredPhysical]),
      provenance: [F.physical, F.recoveredPhysical],
    },
    historical_physical_temporal_context: {
      evidence_state: historical.length ? 'AVAILABLE_BOUNDED' : 'MISSING_BOUNDED',
      records: historical,
      current_carryover_policy: 'NO_AUTOMATIC_CARRYOVER; USE_ONLY_WITH_EXPLICIT_LOW_SAMPLE_INJURY_RECOVERY_UNDERPERFORMANCE_OR_TEMPORAL_BRIDGE_REASON',
      injury_context: injuryContext,
      age_context: ageContext,
      missingness: historical.length ? null : missing(physicalSearch?.outcome ?? 'NO_RETAINED_HISTORICAL_PHYSICAL_RECORD', [F.physical, F.recoveredPhysical]),
      provenance: [F.physical, F.recoveredPhysical, F.injury, F.age],
    },
    game_context_proxy_breakdown: gameContext(row.identity.production_player_id, name),
    community_physical_context: community,
    technique_separation_contract: {
      base_speed_excludes: ['STEAL_SUCCESS_RATE_AS_DIRECT_SPEED', 'STEAL_ATTEMPT_RATE_AS_DIRECT_SPEED', 'BASERUNNING_JUDGMENT_AS_DIRECT_SPEED', 'LEAD', 'SLIDING_TECHNIQUE'],
      mixed_components_may_appear_only_as_context: ['UBR', 'ADVANCE', 'TRIPLES', 'GIDP_AVOIDANCE', 'INFIELD_HITS'],
      stealing_and_baserunning_abilities_require_residual_or_separate_model: true,
      provenance: ['src/ratings/running.mjs', 'docs/state/speed_requirements_baseline_20260813.tsv'],
    },
    powerpro_review_context: {
      evidence_state: staleRow ? 'AVAILABLE_REVIEW_CONTEXT' : 'MISSING_BOUNDED',
      stale_detector: staleRow,
      individual_powerpro_label_is_physical_teacher: false,
      allowed_role: 'STALE_ODD_REVIEW_CONTEXT_ONLY',
      automatic_rating_change: false,
      provenance: F.stale,
    },
    source_scope_guard: {
      npb_plus_top_speed_field: 'VERIFIED_NPB_PLUS',
      npb_plus_hp_to_1b_sec: 'MISATTRIBUTED_SOURCE_FAIL_CLOSED',
      h2f_construct_lane_preserved: true,
      negative_findings_do_not_generalize_to_adjacent_lanes: true,
      provenance: ['configs/npb_plus_field_provenance.json', F.h2f, F.recoveredPhysical],
    },
    missingness_and_provenance_contract: {
      every_required_lane_explicit: true,
      missingness_is_not_negative_evidence: true,
      lane_states: {
        top_speed: 'AVAILABLE_CURRENT_DIRECT_MAX_STATISTIC',
        acceleration_h2f_t90: normal || bunt || t90Records.length ? 'AVAILABLE_BOUNDED' : 'MISSING_BOUNDED',
        short_distance: shortRecords.length ? 'AVAILABLE_BOUNDED' : 'MISSING_BOUNDED',
        historical_physical: historical.length ? 'AVAILABLE_BOUNDED' : 'MISSING_BOUNDED',
        statistical_proxy: row.statistical_proxy_context?.state ?? 'MISSING_BOUNDED',
        game_context_proxy: null,
        community_physical: community.evidence_state,
        powerpro_review: staleRow ? 'AVAILABLE_REVIEW_CONTEXT' : 'MISSING_BOUNDED',
        injury: 'MISSING_BOUNDED',
        age: 'MISSING_BOUNDED',
      },
      provenance: [F.contract, F.oldQueue, F.h2f, F.recoveredPhysical, F.physical, F.stale, F.xClean],
    },
  };
});

for (const row of players) {
  row.missingness_and_provenance_contract.lane_states.game_context_proxy =
    row.game_context_proxy_breakdown.evidence_state;
}
const requiredFields = [
  'construct_contract','top_speed_evidence','acceleration_h2f_t90_evidence',
  'short_distance_physical_evidence','historical_physical_temporal_context',
  'statistical_proxy_context','game_context_proxy_breakdown','community_physical_context',
  'technique_separation_contract','powerpro_review_context','source_scope_guard',
  'missingness_and_provenance_contract',
];
for (const row of players) {
  for (const f of requiredFields) if (row[f] == null) throw new Error(`${row.identity.player}: missing ${f}`);
  if (row.construct_contract.top_speed_is_full_construct !== false) throw new Error(`${row.identity.player}: top-speed substitution`);
  if (row.owner_verdict?.verdict != null) throw new Error(`${row.identity.player}: owner verdict contamination`);
}
if (new Set(players.map(r => r.queue_row_key)).size !== 100) throw new Error('queue keys not unique');

const sources = [F.oldQueue,F.h2f,F.recoveredPhysical,F.physical,F.runNorm,F.stale,F.injury,F.age,F.xClean,F.contract];
const output = {
  schema_version: 'sp077_construct_complete_owner_review_queue_20260817',
  generated_at: DATE,
  task_id: 'SP-077',
  status: 'CONSTRUCT_COMPLETE_CANDIDATE_LOCK_STILL_REQUIRED',
  purpose: 'Construct-complete pre-owner-review evidence packet. No owner verdict and no SP-079 final rating.',
  construct: {
    definition: 'physical running ability from first running step to about 90ft',
    dimensions: ['initial acceleration','top speed','speed maintenance to about 90ft'],
    top_speed_only_finalization_forbidden: true,
  },
  source_hashes: Object.fromEntries(sources.map(p => [p, sha(read(p))])),
  population: { intended: 100, emitted: players.length, unique_queue_keys: new Set(players.map(r => r.queue_row_key)).size },
  required_lane_fields: requiredFields,
  owner_review_lock_expected: true,
  players,
};
fs.mkdirSync(path.dirname(full(F.out)), { recursive: true });
fs.writeFileSync(full(F.out), JSON.stringify(output, null, 2) + '\n', 'utf8');

const counts = Object.fromEntries(requiredFields.map(field => [field, {
  available: players.filter(r => !/^MISSING/.test(String(r[field]?.evidence_state ?? ''))).length,
  explicit_missing: players.filter(r => /^MISSING/.test(String(r[field]?.evidence_state ?? ''))).length,
}]));
const report = [
  '# SP-077 construct-complete owner-review queue candidate',
  '',
  `Date: ${DATE}`,
  '',
  '- Coverage: 100/100; verdicts remain zero.',
  '- This packet restores the full speed construct to owner review. It does not unlock owner review by itself.',
  '- Top speed is one lane only; acceleration/H2F/T90, short-distance/historical physical evidence, mixed game proxies, community physical context, technique separation, PowerPro review context, source-scope guards, and explicit missingness are separate.',
  '',
  '## Lane coverage',
  '',
  '| Lane | Available/nonmissing | Explicit missing |',
  '|---|---:|---:|',
  ...requiredFields.map(f => `| ${f} | ${counts[f].available} | ${counts[f].explicit_missing} |`),
  '',
  '## Guards',
  '',
  '- NPB+ `hp_to_1b_sec` remains fail-closed as a misattributed source field; independent H2F/acceleration evidence remains valid in its own lane.',
  '- 30m/50m evidence is never linearly scaled to T90.',
  '- Injury/birthdate joins remain explicit bounded missingness where the repository lacks structured player-level evidence.',
  '- PowerPro is never a player-level physical teacher.',
  '- No owner verdict or final SP-079 practical rating is created.',
  '',
  `Machine-readable: \`${F.out}\``,
  '',
].join('\n');
fs.mkdirSync(path.dirname(full(F.report)), { recursive: true });
fs.writeFileSync(full(F.report), report, 'utf8');
console.log(JSON.stringify({ status: 'GENERATED_LOCKED_CANDIDATE', players: players.length, output: F.out, report: F.report, lane_counts: counts }));

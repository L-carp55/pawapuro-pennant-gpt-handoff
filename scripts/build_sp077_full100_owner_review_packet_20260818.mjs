// Construct-complete, evidence-preserving review packet for all 100 speed players.
// This script only compresses existing SP-077 evidence for human review.
// It never writes an owner verdict or creates an SP-079 practical rating.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json';
const OUT_JSON = 'outputs/derived/sp077_full100_owner_review_packet_20260818.json';
const OUT_TSV = 'outputs/derived/sp077_full100_owner_review_matrix_20260818.tsv';
const OUT_MD = 'docs/reports/sp077_full100_owner_review_packet_20260818.md';

const queue = JSON.parse(fs.readFileSync(path.join(ROOT, QUEUE), 'utf8'));
if (queue?.schema_version !== 'sp077_construct_complete_owner_review_queue_20260817') throw new Error('wrong queue schema');
if (!Array.isArray(queue.players) || queue.players.length !== 100) throw new Error('queue is not exact current-100');
if (new Set(queue.players.map(r => r.queue_row_key)).size !== 100) throw new Error('queue keys are not unique');

const val = v => v == null ? null : v;
const arr = v => Array.isArray(v) ? v : [];
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const fmt = v => v == null ? '—' : String(v);
const oneLine = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const joinText = xs => xs.filter(Boolean).join(' / ');

const compactPhysical = r => ({
  year: val(r?.measurement_year),
  temporal_distance_years_from_2026: val(r?.temporal_distance_years_from_2026),
  metric: val(r?.metric),
  seconds: val(r?.seconds),
  value: val(r?.value),
  unit: val(r?.unit),
  confidence: val(r?.confidence),
  usage_class: val(r?.usage_class),
  timing_method: val(r?.timing_method),
  start_protocol: val(r?.start_protocol),
  source_tier: val(r?.source_tier),
  source_name: val(r?.source_name),
  published_date: val(r?.published_date),
  numeric_t90_usable: r?.numeric_t90_usable === true,
  carryover_role: val(r?.carryover_role),
});
const compactH2f = h => h ? ({
  seconds: val(h.seconds),
  z: val(h.z_within_sample_lower_is_faster),
  n_independent_records: val(h.n_independent_records),
  n_raw_records: val(h.n_raw_records),
  handedness: val(h.handedness),
  confidence: val(h.confidence),
  lane: val(h.lane),
  sources: arr(h.sources),
}) : null;
const compactCommunity = r => ({
  record_id: val(r?.record_id),
  date: val(r?.source_date),
  disposition: val(r?.disposition),
  claim_lane: val(r?.claim_lane),
  direction: val(r?.direction),
  speed_concept: val(r?.speed_concept),
  usable_for_current100: r?.usable_for_current100 === true,
  text: val(r?.text),
  url: val(r?.url),
});
const metricText = r => {
  const x = r?.seconds ?? r?.value;
  return `${r?.year ?? '?'} ${r?.metric ?? '?'} ${x ?? '?'}${r?.unit ? ` ${r.unit}` : ''} [${r?.confidence ?? '?'}]`;
};
const summarizeRecords = xs => xs.length ? xs.map(metricText).join(' / ') : '—';

function compact(row) {
  const a = row.acceleration_h2f_t90_evidence ?? {};
  const s = row.statistical_proxy_context ?? {};
  const g = row.game_context_proxy_breakdown ?? {};
  const c = row.community_physical_context ?? {};
  const pp = row.powerpro_review_context?.stale_detector ?? null;
  const top = row.top_speed_evidence ?? {};
  const current = row.current_physical_evidence ?? {};
  const t90 = arr(a.direct_or_standardized_t90_records).map(compactPhysical);
  const short = arr(row.short_distance_physical_evidence?.records).map(compactPhysical);
  const historical = arr(row.historical_physical_temporal_context?.records).map(compactPhysical);
  const communityPhysical = arr(c.physical_observation_rows).map(compactCommunity);
  const communityTechnique = arr(c.technique_context_rows).map(compactCommunity);
  const communityRating = arr(c.powerpro_rating_context_rows).map(compactCommunity);
  const laneStates = row.missingness_and_provenance_contract?.lane_states ?? {};
  const availablePhysicalDimensions = [
    top?.evidence_state && !String(top.evidence_state).startsWith('MISSING') ? 'PEAK_SPEED' : null,
    a?.normal_swing_h2f || a?.bunt_h2f ? 'H2F' : null,
    t90.length ? 'T90' : null,
    short.length ? 'SHORT_DISTANCE' : null,
    communityPhysical.length ? 'COMMUNITY_PHYSICAL' : null,
  ].filter(Boolean);
  return {
    queue_row_key: row.queue_row_key,
    queue_order: row.queue_order,
    player: row.identity?.player,
    team: row.identity?.team,
    stable_player_key: row.identity?.stable_player_key,
    identity_status: row.identity?.identity_status,
    top_speed: {
      state: top.evidence_state,
      kmh: top.npb_plus_top_speed_kmh,
      z: top.z,
      rank_current100: top.rank,
      exposure_context: top.exposure_context,
      reliability: top.reliability,
      role: top.role,
    },
    acceleration_h2f_t90: {
      state: a.evidence_state,
      normal_swing_h2f: compactH2f(a.normal_swing_h2f),
      bunt_h2f: compactH2f(a.bunt_h2f),
      direct_or_standardized_t90_records: t90,
      missingness: a.missingness ?? null,
    },
    short_distance: {
      state: row.short_distance_physical_evidence?.evidence_state,
      records: short,
      transformation_guard: row.short_distance_physical_evidence?.transformation_guard,
      missingness: row.short_distance_physical_evidence?.missingness ?? null,
    },
    historical_physical: {
      state: row.historical_physical_temporal_context?.evidence_state,
      records: historical,
      current_carryover_policy: row.historical_physical_temporal_context?.current_carryover_policy,
      injury_context: row.historical_physical_temporal_context?.injury_context,
      age_context: row.historical_physical_temporal_context?.age_context,
      missingness: row.historical_physical_temporal_context?.missingness ?? null,
    },
    sp021_high_confidence_historical_anchor: row.sp021_high_confidence_anchor_context ?? null,
    statistical_proxy: {
      appraisal_year: s.appraisal_year,
      state: s.state,
      value_z: s.value_z,
      reliability: s.reliability,
      pa_2025: s.pa_2025,
      effective_sample_fraction: s.effective_sample_fraction,
      quality: s.quality,
      sigma: s.sigma,
      role: s.role,
    },
    game_context_proxy: {
      state: g.evidence_state,
      season: g.season,
      role: g.role,
      raw: g.raw ?? null,
      z: g.z ?? null,
      same_time_weights: g.same_time_weights ?? null,
      composite_context_z: g.legacy_composite_score_context_only ?? null,
      used_component_count: g.used_component_count ?? null,
      sample: g.sample ?? null,
      missing_reason: g.missing_reason ?? null,
    },
    community: {
      state: c.evidence_state,
      physical: communityPhysical,
      technique: communityTechnique,
      powerpro_rating: communityRating,
      role: c.role,
    },
    pairwise_and_conflict_context: row.pairwise_and_conflict_context ?? null,
    missingness_and_coverage: row.missingness_and_coverage ?? null,
    powerpro_review: {
      state: row.powerpro_review_context?.evidence_state,
      raw_last: pp?.powerpro_raw_last ?? null,
      percentile: pp?.powerpro_pct ?? null,
      physical_percentile_reference: pp?.latent_physical_pct ?? null,
      percentile_gap: pp?.percentile_gap ?? null,
      changes: pp?.powerpro_raw_changes ?? null,
      years: pp?.powerpro_years ?? null,
      flag: pp?.flag ?? null,
      s1_internal_inertia: pp?.s1_internal_inertia ?? null,
      s2_external_disagreement: pp?.s2_external_disagreement ?? null,
      role: row.powerpro_review_context?.allowed_role,
    },
    retired_legacy_context: {
      provisional_physical_point: current.existing_provisional_physical_point ?? null,
      provisional_t90: current.existing_provisional_t90 ?? null,
      status: current.existing_point_status ?? null,
    },
    available_physical_dimensions: availablePhysicalDimensions,
    lane_states: laneStates,
    source_scope_guard: row.source_scope_guard,
    technique_separation: row.technique_separation_contract,
    owner_verdict: row.owner_verdict,
  };
}

const rows = queue.players.map(compact).sort((a,b) => a.queue_order - b.queue_order);
if (rows.some(r => r.owner_verdict?.verdict != null || r.owner_verdict?.status !== 'NOT_ENTERED')) throw new Error('owner verdict contamination');

const coverage = {
  players: rows.length,
  normal_h2f: rows.filter(r => r.acceleration_h2f_t90.normal_swing_h2f).length,
  bunt_h2f: rows.filter(r => r.acceleration_h2f_t90.bunt_h2f).length,
  t90: rows.filter(r => r.acceleration_h2f_t90.direct_or_standardized_t90_records.length).length,
  short_distance: rows.filter(r => r.short_distance.records.length).length,
  historical: rows.filter(r => r.historical_physical.records.length).length,
  sp021_anchor: rows.filter(r => r.sp021_high_confidence_historical_anchor?.evidence_state && !String(r.sp021_high_confidence_historical_anchor.evidence_state).startsWith('MISSING')).length,
  statistical_proxy: rows.filter(r => r.statistical_proxy.value_z != null).length,
  game_context_proxy: rows.filter(r => r.game_context_proxy.composite_context_z != null).length,
  community_physical: rows.filter(r => r.community.physical.length).length,
  community_technique: rows.filter(r => r.community.technique.length).length,
  community_powerpro_rating: rows.filter(r => r.community.powerpro_rating.length).length,
  powerpro_current: rows.filter(r => r.powerpro_review.raw_last != null).length,
};

const output = {
  schema_version: 'sp077_full100_owner_review_packet_20260818',
  generated_at: '2026-08-18',
  source_queue: QUEUE,
  source_queue_schema: queue.schema_version,
  purpose: 'Full-construct human review of all 100 players. Evidence only; no owner verdict and no SP-079 final rating.',
  evidence_policy: [
    'Use all retained evidence with role-specific limits rather than deleting weak or mixed evidence.',
    'Current NPB+ peak speed is one physical dimension, not the whole construct.',
    'H2F, T90 and short-distance records remain distinct; no invalid linear conversion.',
    'Historical physical evidence receives temporal caution but is not discarded.',
    'S and game proxies are context/fallback with explicit technique/opportunity confounding.',
    'Community physical, technique and PowerPro-rating rows remain separate.',
    'Missingness is not negative evidence.',
    'PowerPro is review context only and is never the physical teacher.',
  ],
  coverage,
  players: rows,
};
fs.mkdirSync(path.dirname(path.join(ROOT, OUT_JSON)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT_JSON), JSON.stringify(output, null, 2) + '\n');

const tsvHeaders = [
  'order','player','team','pp_current','pp_pct','pp_flag','top_kmh','top_z','top_rank','exposure_proxy_count','exposure_direction',
  'h2f_seconds','h2f_z_lower_is_faster','t90_count','t90_records','short_count','short_records','historical_count','historical_records',
  'sp021_anchor_state','s_z','s_reliability','s_pa','game_z','community_physical_count','community_physical_text',
  'community_technique_count','community_technique_text','community_rating_count','community_rating_text','conflict_state',
  'available_physical_dimensions','retired_legacy_point','lane_states'
];
const tsvRows = rows.map(r => {
  const h = r.acceleration_h2f_t90.normal_swing_h2f;
  const conflict = r.pairwise_and_conflict_context?.sp074_state ?? r.pairwise_and_conflict_context?.sp074_classification?.state ?? null;
  return [
    r.queue_order,r.player,r.team,r.powerpro_review.raw_last,r.powerpro_review.percentile,r.powerpro_review.flag,
    r.top_speed.kmh,r.top_speed.z,r.top_speed.rank_current100,r.top_speed.exposure_context?.full_effort_run_proxy_count,
    r.top_speed.exposure_context?.max_statistic_direction,h?.seconds,h?.z,
    r.acceleration_h2f_t90.direct_or_standardized_t90_records.length,summarizeRecords(r.acceleration_h2f_t90.direct_or_standardized_t90_records),
    r.short_distance.records.length,summarizeRecords(r.short_distance.records),r.historical_physical.records.length,summarizeRecords(r.historical_physical.records),
    r.sp021_high_confidence_historical_anchor?.evidence_state,r.statistical_proxy.value_z,r.statistical_proxy.reliability,r.statistical_proxy.pa_2025,
    r.game_context_proxy.composite_context_z,r.community.physical.length,joinText(r.community.physical.map(x => x.text)),
    r.community.technique.length,joinText(r.community.technique.map(x => x.text)),r.community.powerpro_rating.length,
    joinText(r.community.powerpro_rating.map(x => x.text)),conflict,r.available_physical_dimensions.join(','),
    r.retired_legacy_context.provisional_physical_point,JSON.stringify(r.lane_states ?? {})
  ].map(oneLine).join('\t');
});
fs.writeFileSync(path.join(ROOT, OUT_TSV), [tsvHeaders.join('\t'), ...tsvRows, ''].join('\n'));

const md = [
  '# SP-077 Full 100 — construct-complete owner-review packet',
  '',
  '> **Evidence only. No owner verdict and no SP-079 rating is created.** Weak, historical and mixed evidence is retained with explicit limits instead of being discarded.',
  '',
  `Source: \`${QUEUE}\``,
  '',
  '## Coverage',
  '',
  ...Object.entries(coverage).map(([k,v]) => `- ${k}: ${v}`),
  '',
  '## Full matrix',
  '',
  '| # | 選手 | PP | peak km/h(rank) | H2F | T90 | 30/50m等 | S z | game z | Community P/T/R | conflict |',
  '|---:|---|---:|---|---|---:|---:|---:|---:|---|---|',
  ...rows.map(r => {
    const h = r.acceleration_h2f_t90.normal_swing_h2f;
    const conflict = r.pairwise_and_conflict_context?.sp074_state ?? r.pairwise_and_conflict_context?.sp074_classification?.state ?? '—';
    return `| ${r.queue_order} | ${r.player} | ${fmt(r.powerpro_review.raw_last)} | ${fmt(r.top_speed.kmh)} (${fmt(r.top_speed.rank_current100)}) | ${h ? `${fmt(h.seconds)} / z=${fmt(h.z)}` : '—'} | ${r.acceleration_h2f_t90.direct_or_standardized_t90_records.length} | ${r.short_distance.records.length} | ${r.statistical_proxy.value_z == null ? '—' : Number(r.statistical_proxy.value_z).toFixed(2)} | ${r.game_context_proxy.composite_context_z == null ? '—' : Number(r.game_context_proxy.composite_context_z).toFixed(2)} | ${r.community.physical.length}/${r.community.technique.length}/${r.community.powerpro_rating.length} | ${conflict} |`;
  }),
  '',
  '## Per-player evidence',
  '',
  ...rows.flatMap(r => [
    `### ${r.queue_order}. ${r.player}（${r.team ?? '—'}）`,
    '',
    `- **Peak speed:** ${fmt(r.top_speed.kmh)} km/h; rank ${fmt(r.top_speed.rank_current100)}; z=${fmt(r.top_speed.z)}; exposure=${JSON.stringify(r.top_speed.exposure_context ?? null)}.`,
    `- **H2F/T90:** normal=${r.acceleration_h2f_t90.normal_swing_h2f ? JSON.stringify(r.acceleration_h2f_t90.normal_swing_h2f) : 'none'}; bunt=${r.acceleration_h2f_t90.bunt_h2f ? JSON.stringify(r.acceleration_h2f_t90.bunt_h2f) : 'none'}; T90=${summarizeRecords(r.acceleration_h2f_t90.direct_or_standardized_t90_records)}.`,
    `- **Short-distance:** ${summarizeRecords(r.short_distance.records)}.`,
    `- **Historical physical:** ${summarizeRecords(r.historical_physical.records)}.`,
    `- **SP-021 anchor:** ${JSON.stringify(r.sp021_high_confidence_historical_anchor ?? null)}.`,
    `- **S / game:** S z=${fmt(r.statistical_proxy.value_z)}, reliability=${fmt(r.statistical_proxy.reliability)}, PA=${fmt(r.statistical_proxy.pa_2025)}; game z=${fmt(r.game_context_proxy.composite_context_z)}, components=${JSON.stringify(r.game_context_proxy.z ?? null)}.`,
    `- **Community:** physical=${r.community.physical.length ? r.community.physical.map(x => `${x.date ?? '?'} ${x.text ?? ''}`).join(' / ') : 'none'}; technique=${r.community.technique.length ? r.community.technique.map(x => `${x.date ?? '?'} ${x.text ?? ''}`).join(' / ') : 'none'}; rating=${r.community.powerpro_rating.length ? r.community.powerpro_rating.map(x => `${x.date ?? '?'} ${x.text ?? ''}`).join(' / ') : 'none'}.`,
    `- **PowerPro context:** current=${fmt(r.powerpro_review.raw_last)}, pct=${fmt(r.powerpro_review.percentile)}, gap=${fmt(r.powerpro_review.percentile_gap)}, flag=${fmt(r.powerpro_review.flag)}, changes=${JSON.stringify(r.powerpro_review.changes ?? null)}.`,
    `- **Conflict / lanes:** ${JSON.stringify(r.pairwise_and_conflict_context ?? null)}; available physical dimensions=${r.available_physical_dimensions.join(',') || 'PEAK_ONLY'}; lane states=${JSON.stringify(r.lane_states ?? {})}.`,
    '',
  ]),
].join('\n');
fs.mkdirSync(path.dirname(path.join(ROOT, OUT_MD)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT_MD), md + '\n');

console.log(JSON.stringify({ status: 'PASS', players: rows.length, coverage, json: OUT_JSON, tsv: OUT_TSV, report: OUT_MD }));

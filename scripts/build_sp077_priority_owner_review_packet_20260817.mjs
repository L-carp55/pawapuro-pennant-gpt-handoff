// Human-readable, construct-complete owner-review packet for the 23 priority players.
// Reads only the validated SP-077 construct-complete queue. Never creates a
// verdict or final SP-079 rating.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json';
const OUT_JSON = 'outputs/derived/sp077_priority23_owner_review_packet_20260817.json';
const OUT_MD = 'docs/reports/sp077_priority23_owner_review_packet_20260817.md';
const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const priority = [
  '中川 圭太','カリステ','大島 洋平','郡司 裕也','ポランコ','安田 尚憲','山口 航輝','藤原 恭大',
  '古賀 悠斗','野間 峻祥','古賀 優大','塩見 泰隆','岩田 幸宏','山川 穂高','柳田 悠岐','佐藤 輝明',
  '木浪 聖也','森下 翔太','ソト','ファビアン','モンテロ','名原 典彦','サンタナ',
];
const queue = JSON.parse(fs.readFileSync(path.join(ROOT, QUEUE), 'utf8'));
if (queue?.schema_version !== 'sp077_construct_complete_owner_review_queue_20260817') throw new Error('wrong queue schema');
if (!Array.isArray(queue.players) || queue.players.length !== 100) throw new Error('queue is not exact current-100');
const byName = new Map(queue.players.map(r => [norm(r.identity?.player), r]));
const missingNames = priority.filter(name => !byName.has(norm(name)));
if (missingNames.length) throw new Error(`priority player join failed: ${missingNames.join(', ')}`);

const val = v => v == null ? null : v;
const compactPhysical = r => ({
  year: val(r?.measurement_year), metric: val(r?.metric), seconds: val(r?.seconds), value: val(r?.value), unit: val(r?.unit),
  confidence: val(r?.confidence), usage_class: val(r?.usage_class), timing_method: val(r?.timing_method),
  start_protocol: val(r?.start_protocol), source_tier: val(r?.source_tier), source_name: val(r?.source_name),
  numeric_t90_usable: r?.numeric_t90_usable === true, carryover_role: val(r?.carryover_role),
});
const compactH2f = h => h ? ({ seconds: h.seconds, z: h.z_within_sample_lower_is_faster, n_independent_records: h.n_independent_records,
  handedness: h.handedness, confidence: h.confidence, lane: h.lane, sources: h.sources }) : null;
const compactCommunity = r => ({ date: r.source_date, disposition: r.disposition, direction: r.direction, text: r.text, url: r.url });
function compact(row) {
  const a = row.acceleration_h2f_t90_evidence ?? {};
  const s = row.statistical_proxy_context ?? {};
  const g = row.game_context_proxy_breakdown ?? {};
  const c = row.community_physical_context ?? {};
  const pp = row.powerpro_review_context?.stale_detector ?? null;
  const high = row.sp021_high_confidence_anchor_context ?? null;
  return {
    queue_row_key: row.queue_row_key,
    queue_order: row.queue_order,
    player: row.identity.player,
    team: row.identity.team,
    stable_player_key: row.identity.stable_player_key,
    construct_contract: row.construct_contract,
    top_speed: {
      state: row.top_speed_evidence?.evidence_state,
      kmh: row.top_speed_evidence?.npb_plus_top_speed_kmh,
      z: row.top_speed_evidence?.z,
      rank_current100: row.top_speed_evidence?.rank,
      exposure_context: row.top_speed_evidence?.exposure_context,
      reliability: row.top_speed_evidence?.reliability,
      role: row.top_speed_evidence?.role,
    },
    acceleration_h2f_t90: {
      state: a.evidence_state,
      normal_swing_h2f: compactH2f(a.normal_swing_h2f),
      bunt_h2f: compactH2f(a.bunt_h2f),
      direct_or_standardized_t90_records: (a.direct_or_standardized_t90_records ?? []).map(compactPhysical),
      role: a.role,
      missingness: a.missingness ?? null,
    },
    short_distance: {
      state: row.short_distance_physical_evidence?.evidence_state,
      records: (row.short_distance_physical_evidence?.records ?? []).map(compactPhysical),
      transformation_guard: row.short_distance_physical_evidence?.transformation_guard,
      missingness: row.short_distance_physical_evidence?.missingness ?? null,
    },
    high_confidence_historical_anchors: high,
    historical_physical: {
      state: row.historical_physical_temporal_context?.evidence_state,
      records: (row.historical_physical_temporal_context?.records ?? []).map(compactPhysical),
      current_carryover_policy: row.historical_physical_temporal_context?.current_carryover_policy,
      injury_context: row.historical_physical_temporal_context?.injury_context,
      age_context: row.historical_physical_temporal_context?.age_context,
      missingness: row.historical_physical_temporal_context?.missingness ?? null,
    },
    statistical_proxy: {
      appraisal_year: s.appraisal_year, state: s.state, value_z: s.value_z, reliability: s.reliability,
      pa_2025: s.pa_2025, effective_sample_fraction: s.effective_sample_fraction, quality: s.quality, sigma: s.sigma, role: s.role,
    },
    game_context_proxy: {
      state: g.evidence_state, season: g.season, role: g.role, raw: g.raw ?? null, z: g.z ?? null,
      same_time_weights: g.same_time_weights ?? null, legacy_composite_score_context_only: g.legacy_composite_score_context_only ?? null,
      used_component_count: g.used_component_count ?? null, sample: g.sample ?? null, missing_reason: g.missing_reason ?? null,
    },
    community: {
      state: c.evidence_state,
      physical: (c.physical_observation_rows ?? []).map(compactCommunity),
      technique: (c.technique_context_rows ?? []).map(compactCommunity),
      powerpro_rating: (c.powerpro_rating_context_rows ?? []).map(compactCommunity),
      role: c.role,
    },
    technique_separation: row.technique_separation_contract,
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
    source_scope_guard: row.source_scope_guard,
    lane_states: row.missingness_and_provenance_contract?.lane_states,
    owner_verdict: row.owner_verdict,
  };
}
const rows = priority.map(name => compact(byName.get(norm(name)))).sort((a,b) => a.queue_order - b.queue_order);
if (rows.some(r => r.owner_verdict?.verdict != null || r.owner_verdict?.status !== 'NOT_ENTERED')) throw new Error('owner verdict contamination');

const output = {
  schema_version: 'sp077_priority23_owner_review_packet_20260817',
  generated_at: '2026-08-17',
  source_queue: QUEUE,
  source_queue_schema: queue.schema_version,
  purpose: 'Human owner review of priority players using the full speed construct. Evidence only; no verdict and no final rating.',
  guards: [
    'Top speed is one lane only.',
    'Acceleration/H2F/T90, short-distance and historical physical evidence stay separate.',
    'Statistical/game proxies are context and retain confounding.',
    'Pure speed is separate from stealing/baserunning technique.',
    'PowerPro is review/stale context only, never the physical teacher.',
    'Missing evidence is explicit missingness, not negative evidence.',
  ],
  population: { priority_expected: 23, emitted: rows.length },
  players: rows,
};
fs.mkdirSync(path.dirname(path.join(ROOT, OUT_JSON)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT_JSON), JSON.stringify(output, null, 2) + '\n');

const fmt = x => x == null ? '—' : String(x);
const rec = r => r ? `${fmt(r.seconds)}秒${r.z == null ? '' : ` (z=${Number(r.z).toFixed(2)})`}` : '—';
const listMetrics = xs => xs.length ? xs.slice(0,4).map(x => `${x.year ?? '?'} ${x.metric ?? '?'} ${x.seconds ?? x.value ?? '?'}${x.unit ? ` ${x.unit}` : ''} [${x.confidence ?? '?'}]`).join(' / ') + (xs.length > 4 ? ` / +${xs.length-4}件` : '') : '—';
const md = [
  '# SP-077 Priority 23 — construct-complete owner review packet',
  '',
  '> **Evidence only. No owner verdict is entered here.** Top speed is not the whole speed construct.',
  '',
  `Source: \`${QUEUE}\``,
  '',
  '## Quick matrix',
  '',
  '| # | 選手 | NPB+最高速 | 順位 | H2F normal | short-distance | S z | game proxy z | PP current | PP flag |',
  '|---:|---|---:|---:|---|---|---:|---:|---:|---|',
  ...rows.map(r => {
    const gz = r.game_context_proxy.legacy_composite_score_context_only;
    return `| ${r.queue_order} | ${r.player} | ${fmt(r.top_speed.kmh)} | ${fmt(r.top_speed.rank_current100)} | ${rec(r.acceleration_h2f_t90.normal_swing_h2f)} | ${r.short_distance.records.length}件 | ${r.statistical_proxy.value_z == null ? '—' : Number(r.statistical_proxy.value_z).toFixed(2)} | ${gz == null ? '—' : Number(gz).toFixed(2)} | ${fmt(r.powerpro_review.raw_last)} | ${fmt(r.powerpro_review.flag)} |`;
  }),
  '',
  '## Player evidence',
  '',
  ...rows.flatMap(r => [
    `### ${r.player}（${r.team ?? '—'}）`,
    '',
    `- **Top speed:** ${fmt(r.top_speed.kmh)} km/h / current-100 rank ${fmt(r.top_speed.rank_current100)} / z ${r.top_speed.z == null ? '—' : Number(r.top_speed.z).toFixed(3)}. Exposure: ${JSON.stringify(r.top_speed.exposure_context ?? null)}.`,
    `- **Acceleration/H2F/T90:** normal ${rec(r.acceleration_h2f_t90.normal_swing_h2f)}; bunt ${rec(r.acceleration_h2f_t90.bunt_h2f)}; direct/standardized T90 records ${listMetrics(r.acceleration_h2f_t90.direct_or_standardized_t90_records)}.`,
    `- **Short-distance physical:** ${listMetrics(r.short_distance.records)}.`,
    `- **Historical physical:** ${listMetrics(r.historical_physical.records)}. Current carryover is not automatic.`,
    `- **2025 statistical proxy S:** z=${r.statistical_proxy.value_z == null ? '—' : Number(r.statistical_proxy.value_z).toFixed(3)}, reliability=${fmt(r.statistical_proxy.reliability)}, PA=${fmt(r.statistical_proxy.pa_2025)}, state=${fmt(r.statistical_proxy.state)}.`,
    `- **Mixed game proxy:** state=${fmt(r.game_context_proxy.state)}, composite-context z=${r.game_context_proxy.legacy_composite_score_context_only == null ? '—' : Number(r.game_context_proxy.legacy_composite_score_context_only).toFixed(3)}, components=${JSON.stringify(r.game_context_proxy.z ?? null)}.`,
    `- **Community physical:** ${r.community.physical.length ? r.community.physical.map(x => `${x.date ?? '?'} ${x.text ?? ''}`).join(' / ') : 'none'}; technique context: ${r.community.technique.length ? r.community.technique.map(x => `${x.date ?? '?'} ${x.text ?? ''}`).join(' / ') : 'none'}.`,
    `- **PowerPro review context only:** current=${fmt(r.powerpro_review.raw_last)}, pct=${fmt(r.powerpro_review.percentile)}, gap=${fmt(r.powerpro_review.percentile_gap)}, flag=${fmt(r.powerpro_review.flag)}.`,
    `- **Lane states:** ${JSON.stringify(r.lane_states)}.`,
    '',
  ]),
].join('\n');
fs.mkdirSync(path.dirname(path.join(ROOT, OUT_MD)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT_MD), md + '\n');
console.log(JSON.stringify({ status: 'PASS', priority_players: rows.length, json: OUT_JSON, report: OUT_MD }));

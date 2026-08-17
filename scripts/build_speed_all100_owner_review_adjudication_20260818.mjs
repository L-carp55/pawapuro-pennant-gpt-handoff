// Human-adjudicated all-100 owner-review recommendations.
// Reads the reproducible integrated screen, corrects known screen-method defects,
// preserves every player's evidence/uncertainty, and never writes SP-078 or SP-079.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREEN = 'outputs/derived/speed_all100_integrated_owner_review_20260818.json';
const LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';
const OUT_JSON = 'outputs/derived/speed_all100_owner_review_adjudicated_20260818.json';
const OUT_TSV = 'outputs/derived/speed_all100_owner_review_adjudicated_20260818.tsv';
const OUT_MD = 'docs/audits/speed_all100_owner_review_adjudicated_20260818.md';

const screen = JSON.parse(fs.readFileSync(path.join(ROOT, SCREEN), 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, LEDGER), 'utf8'));
if (screen.population !== 100 || screen.players?.length !== 100) throw new Error('screen is not exact 100');
if (screen.owner_verdict_count !== 0) throw new Error('screen owner-verdict contamination');
if (ledger.owner_verdict_count !== 0 || ledger.records?.length !== 0) throw new Error('SP-078 is not empty');
if (new Set(screen.players.map(r => r.queue_row_key)).size !== 100) throw new Error('duplicate queue row key');

const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const one = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const pct = v => v == null ? '—' : `${Math.round(Number(v) * 1000) / 10}`;

// Every automated directional screen is explicitly adjudicated here. The screen is
// useful for recall, but its numerical score is not the owner-review truth.
const adjudications = new Map([
  ['古賀優大', {
    recommendation: 'UNRESOLVED', strength: 'CURRENT_PEAK_VS_CONTEXT_CONFLICT', confidence: 'MEDIUM',
    reason_code: 'PEAK_SPEED_AND_GAME_CONTEXT_DISAGREE_WITH_NO_ACCELERATION_OR_END_TO_END_MEASUREMENT',
    rationale: 'Current peak speed is above average, but S and all mixed-game components are strongly low. With no H2F/T30/T90/30m/50m lane, neither side may replace the whole construct. The prior TOO_LOW screen was peak-led.'
  }],
  ['郡司裕也', {
    recommendation: 'POWERPRO_TOO_LOW', strength: 'CURRENT_PEAK_PLUS_CONTEXT_SUPPORTED_CONCERN', confidence: 'LOW',
    reason_code: 'CURRENT_PEAK_HIGH_AND_CONTEXT_NOT_NEGATIVE_BUT_NONPEAK_PHYSICAL_MISSING',
    rationale: 'Current peak is rank 20 with adequate exposure, while S and game context are not negative. This supports a low-confidence concern that PP61 is low, but missing acceleration/end-to-end evidence prevents a strong verdict.'
  }],
  ['山口航輝', {
    recommendation: 'POWERPRO_TOO_LOW', strength: 'LOW_CONFIDENCE_TECHNIQUE_SEPARATED_CONCERN', confidence: 'LOW',
    reason_code: 'COMMUNITY_EXPLICITLY_SEPARATES_PHYSICAL_SPEED_FROM_STEALING_TECHNIQUE',
    rationale: 'Peak speed and the Community physical statement support real foot speed, while the same statement separately identifies poor stealing sense. Negative S/game context is retained but downweighted as technique/opportunity-contaminated. Unknown-date 50m is retained at low weight, not treated as decisive.'
  }],
  ['細川成也', {
    recommendation: 'UNRESOLVED', strength: 'CURRENT_PEAK_VS_NONPEAK_AND_CONTEXT_CONFLICT', confidence: 'MEDIUM',
    reason_code: 'HIGH_CURRENT_PEAK_CONFLICTS_WITH_50M_AND_STATISTICAL_GAME_CONTEXT',
    rationale: 'Current peak is high, but 50m context, S and game signals all lean lower. The previous TOO_LOW screen was driven mainly by peak speed; full-construct evidence is genuinely conflicting.'
  }],
  ['福永裕基', {
    recommendation: 'POWERPRO_TOO_LOW', strength: 'CURRENT_PEAK_PLUS_WEAK_STATISTICAL_SUPPORT', confidence: 'LOW',
    reason_code: 'HIGH_CURRENT_PEAK_WITH_SAME_DIRECTION_LOW_SAMPLE_S_CONTEXT',
    rationale: 'Current peak is rank 13 with adequate exposure. S points the same way but has only 57 PA and moderate reliability; game context is near neutral. Preserve as a low-confidence low-rating concern rather than discard it or call it strong.'
  }],
  ['村林一輝', {
    recommendation: 'POWERPRO_TOO_LOW', strength: 'CURRENT_PEAK_PLUS_CONTEXT_SUPPORTED_CONCERN', confidence: 'MEDIUM',
    reason_code: 'EXTREME_CURRENT_PEAK_WITH_POSITIVE_S_AND_GAME_CONTEXT',
    rationale: 'Current peak is extreme and adequately exposed, with S and game context in the same direction. Older nonpeak context is retained but weak and does not erase the current signal. PP69 warrants a medium-confidence low concern, not a final numerical rating.'
  }],
  ['坂倉将吾', {
    recommendation: 'POWERPRO_TOO_HIGH_OR_STALE', strength: 'MULTI_SOURCE_DIRECTIONAL_CONCERN', confidence: 'MEDIUM',
    reason_code: 'CURRENT_PEAK_50M_S_AND_GAME_CONTEXT_ALL_LEAN_LOW',
    rationale: 'Current peak, unknown-date 50m, S and game context consistently lean low. The 50m record is one nonpeak measurement family and must not be double-counted as two independent physical dimensions; the conclusion remains a supported concern, not STRONG_MULTI_PHYSICAL.'
  }],
  ['塩見泰隆', {
    recommendation: 'POWERPRO_TOO_HIGH_OR_STALE', strength: 'STRONG_MULTI_LANE', confidence: 'MEDIUM',
    reason_code: 'CURRENT_DECLINE_OBSERVATIONS_AND_POOR_H2F_OVERRIDE_DECENT_PEAK_ONLY_VIEW',
    rationale: 'Peak speed remains respectable but underexposed. H2F is poor, S has zero reliability/PA, and several current 2026 physical observations describe injury/age-related decline. This is the clearest high/stale case across distinct evidence lanes.'
  }],
  ['京田陽太', {
    recommendation: 'POWERPRO_PLAUSIBLE', strength: 'LOW_EXPOSURE_PEAK_COUNTERBALANCED_BY_SHORT_DISTANCE_CONTEXT', confidence: 'LOW',
    reason_code: 'CURRENT_PEAK_UNDEREXPOSED_AND_50M_CONTEXT_SUPPORTS_HIGHER_PHYSICAL_PROFILE',
    rationale: 'Current peak is low-middle but based on few runs and may be understated; unknown-date 50m is fast and S/game are near neutral. PP78 is not exactly validated, but the prior TOO_HIGH screen was too peak-dominant.'
  }],
  ['矢野雅哉', {
    recommendation: 'POWERPRO_PLAUSIBLE', strength: 'LOW_EXPOSURE_PEAK_COUNTERBALANCED_BY_50M_S_AND_GAME_CONTEXT', confidence: 'MEDIUM',
    reason_code: 'CURRENT_PEAK_UNDEREXPOSED_WHILE_SHORT_DISTANCE_AND_CONTEXT_SUPPORT_FAST_PROFILE',
    rationale: 'Peak speed is low in only 15 proxy opportunities and may be understated. 50m, S and game context all support a fast profile, so PP78 remains plausible. Weak/unknown-date evidence is discounted, not discarded.'
  }],
  ['西川龍馬', {
    recommendation: 'POWERPRO_TOO_HIGH_OR_STALE', strength: 'CURRENT_PEAK_PLUS_CONTEXT_CONCERN', confidence: 'LOW',
    reason_code: 'CURRENT_PEAK_BELOW_AVERAGE_WITH_NO_POSITIVE_CONTEXT_CORROBORATION',
    rationale: 'Current peak is below average with adequate exposure, and S/game context is neutral-to-negative. There is no current acceleration/end-to-end measurement, so this remains only a low-confidence PP72-high concern.'
  }],
  ['小園海斗', {
    recommendation: 'UNRESOLVED', strength: 'CURRENT_VS_OLD_H2F_AND_CONTEXT_CONFLICT', confidence: 'MEDIUM',
    reason_code: 'CURRENT_PEAK_AND_OLD_H2F_LEAN_LOW_WHILE_CURRENT_S_GAME_CONTEXT_LEANS_HIGH',
    rationale: 'Current peak is near average and 2016 H2F is slow, but current S/game context is positive. The old H2F is one measurement family, not two independent physical dimensions; the prior STRONG_TOO_HIGH screen is withdrawn.'
  }],
  ['カリステ', {
    recommendation: 'POWERPRO_PLAUSIBLE', strength: 'LOW_EXPOSURE_CURRENT_PEAK_WITH_HISTORICAL_DIRECT_SUPPORT', confidence: 'LOW',
    reason_code: 'SEVEN_RUN_CURRENT_PEAK_CANNOT_OVERRIDE_2017_T10_T30_T90_DIRECT_PROFILE',
    rationale: 'Current peak has only seven proxy opportunities and may be understated. The 2017 T10/T30/T90/Sprint-Speed set is old but direct and internally coherent, and game context is slightly positive. PP82 is plausible with low current confidence, not proven high/stale.'
  }],
  ['今宮健太', {
    recommendation: 'POWERPRO_TOO_HIGH_OR_STALE', strength: 'PEAK_AND_CONTEXT_SUPPORTED_HIGH_CONCERN', confidence: 'MEDIUM',
    reason_code: 'CURRENT_PEAK_S_AND_GAME_CONTEXT_ALL_LEAN_BELOW_PP66',
    rationale: 'Current peak is low and underexposed, while both S and game context also lean low. Absence of nonpeak direct evidence prevents a strong verdict, but multiple retained signals support a medium-confidence PP66-high concern.'
  }],
  ['西野真弘', {
    recommendation: 'POWERPRO_TOO_HIGH_OR_STALE', strength: 'CONTEXT_SUPPORTED_HIGH_CONCERN', confidence: 'LOW',
    reason_code: 'AVERAGE_UNDEREXPOSED_PEAK_AND_NEGATIVE_GAME_CONTEXT_DO_NOT_SUPPORT_PP76',
    rationale: 'Peak speed is about average and underexposed; S is slightly negative and game context is more clearly negative. This is a low-confidence PP76-high concern, not a peak-only strong verdict.'
  }],
]);

const rows = screen.players.map(source => {
  const key = norm(source.player);
  const manual = adjudications.get(key) ?? null;
  const final = manual ?? {
    recommendation: source.recommendation,
    strength: source.recommendation_strength,
    confidence: source.recommendation_confidence,
    reason_code: source.reason_code,
    rationale: source.recommendation === 'POWERPRO_PLAUSIBLE'
      ? 'All retained evidence and uncertainty were reviewed through the full-construct screen. No material contradiction requires a directional PowerPro verdict. This is compatibility, not exact numerical validation.'
      : source.reason_code === 'NO_CURRENT_POWERPRO_TARGET'
        ? 'No current PowerPro comparison target exists. Physical evidence remains available for later SP-079 appraisal, but no PowerPro high/low verdict can be made.'
        : 'Automated screen retained after human adjudication.'
  };
  return {
    queue_order: source.queue_order,
    queue_row_key: source.queue_row_key,
    player: source.player,
    team: source.team,
    powerpro_current: source.powerpro_current,
    screening: {
      recommendation: source.recommendation,
      strength: source.recommendation_strength,
      confidence: source.recommendation_confidence,
      reason_code: source.reason_code,
      estimated_percentile: source.integrated_review?.estimated_percentile,
      lower_percentile: source.integrated_review?.lower_percentile,
      upper_percentile: source.integrated_review?.upper_percentile,
      band: source.integrated_review?.band,
      physical_coverage: source.integrated_review?.physical_coverage,
      peak_contribution_share: source.integrated_review?.peak_contribution_share,
      conflict_flags: source.conflict_flags,
    },
    adjudicated_recommendation: final.recommendation,
    adjudicated_strength: final.strength,
    adjudicated_confidence: final.confidence,
    adjudicated_reason_code: final.reason_code,
    adjudication_rationale: final.rationale,
    human_directional_review_performed: manual != null,
    evidence: source.dimensions,
    supporting_lanes_from_screen: source.supporting_lanes,
    evidence_used_from_screen: source.evidence_used,
    retained_uncertainty: {
      estimated_percentile: source.integrated_review?.estimated_percentile,
      lower_percentile: source.integrated_review?.lower_percentile,
      upper_percentile: source.integrated_review?.upper_percentile,
      interval_width: source.integrated_review?.interval_width,
      physical_coverage: source.integrated_review?.physical_coverage,
    },
    governance: {
      owner_verdict_written: false,
      sp079_rating_created: false,
      shoulder_work_performed: false,
      powerpro_used_as_teacher: false,
    },
  };
});

if (adjudications.size !== 15) throw new Error(`adjudication map size=${adjudications.size}`);
for (const name of adjudications.keys()) {
  if (!rows.some(r => norm(r.player) === name)) throw new Error(`adjudicated player missing: ${name}`);
}

const counts = {};
const confidenceCounts = {};
const strengthCounts = {};
for (const r of rows) {
  counts[r.adjudicated_recommendation] = (counts[r.adjudicated_recommendation] ?? 0) + 1;
  confidenceCounts[r.adjudicated_confidence] = (confidenceCounts[r.adjudicated_confidence] ?? 0) + 1;
  strengthCounts[r.adjudicated_strength] = (strengthCounts[r.adjudicated_strength] ?? 0) + 1;
}
const expectedCounts = {
  POWERPRO_PLAUSIBLE: 83,
  UNRESOLVED: 8,
  POWERPRO_TOO_HIGH_OR_STALE: 5,
  POWERPRO_TOO_LOW: 4,
};
for (const [k,v] of Object.entries(expectedCounts)) if (counts[k] !== v) throw new Error(`${k}=${counts[k]}, expected ${v}`);
if (Object.values(counts).reduce((a,b)=>a+b,0) !== 100) throw new Error('counts do not sum to 100');

const noTarget = rows.filter(r => r.powerpro_current == null);
if (noTarget.length !== 5 || noTarget.some(r => r.adjudicated_recommendation !== 'UNRESOLVED')) throw new Error('no-target invariant failed');
const expectedDirectional = {
  POWERPRO_TOO_LOW: ['郡司裕也','山口航輝','福永裕基','村林一輝'],
  POWERPRO_TOO_HIGH_OR_STALE: ['坂倉将吾','塩見泰隆','西川龍馬','今宮健太','西野真弘'],
  UNRESOLVED_CONFLICT: ['古賀優大','細川成也','小園海斗'],
};
for (const [group,names] of Object.entries(expectedDirectional)) {
  for (const name of names) {
    const r = rows.find(x => norm(x.player) === name);
    const expected = group === 'UNRESOLVED_CONFLICT' ? 'UNRESOLVED' : group;
    if (r?.adjudicated_recommendation !== expected) throw new Error(`${name}=${r?.adjudicated_recommendation}, expected ${expected}`);
  }
}
const correctedPlausible = ['矢野雅哉','京田陽太','カリステ'];
for (const name of correctedPlausible) {
  const r = rows.find(x => norm(x.player) === name);
  if (r?.adjudicated_recommendation !== 'POWERPRO_PLAUSIBLE') throw new Error(`${name} plausible correction failed`);
}
if (rows.some(r => r.governance.owner_verdict_written || r.governance.sp079_rating_created || r.governance.shoulder_work_performed)) throw new Error('governance contamination');

const output = {
  schema_version: 'speed_all100_owner_review_adjudicated_20260818',
  generated_at: '2026-08-18',
  status: 'HUMAN_ADJUDICATED_NON_VERDICT_RECOMMENDATIONS',
  source_screen: SCREEN,
  source_owner_ledger: LEDGER,
  population: 100,
  owner_verdict_count: 0,
  methodology: {
    construct: 'initial acceleration + peak speed + speed maintenance/end-to-end to about 90ft',
    evidence_use: 'All retained direct, weak, historical, statistical, game and Community evidence remains visible. Weakness changes confidence/role, not existence.',
    human_adjudication_scope: 'All 100 rows reviewed through the integrated screen; all 15 automated directional recommendations manually re-read against source lanes. Three additional mixed cases were moved to UNRESOLVED and three peak-dominant high calls were restored to plausible.',
    independence_correction: 'A single H2F/30m/50m measurement family may inform more than one construct aspect but is never counted as two independent physical sources when assigning verdict strength.',
    plausible_definition: 'Compatible with available full-construct evidence and uncertainty; not exact validation of the PowerPro number.',
    unresolved_definition: 'Comparison target missing or material evidence conflict remains after retaining all usable lanes.',
  },
  counts,
  confidence_counts: confidenceCounts,
  strength_counts: strengthCounts,
  expected_directional_groups: expectedDirectional,
  corrected_to_plausible: correctedPlausible,
  players: rows,
};
fs.mkdirSync(path.dirname(path.join(ROOT, OUT_JSON)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT_JSON), JSON.stringify(output, null, 2) + '\n');

const headers = ['order','player','team','pp','screening','final','strength','confidence','estimate_pct','range_low_pct','range_high_pct','physical_coverage','peak_share','human_directional_review','reason_code','rationale'];
const tsv = [headers.join('\t'), ...rows.map(r => [
  r.queue_order,r.player,r.team,r.powerpro_current,r.screening.recommendation,r.adjudicated_recommendation,r.adjudicated_strength,r.adjudicated_confidence,
  r.screening.estimated_percentile,r.screening.lower_percentile,r.screening.upper_percentile,r.screening.physical_coverage,r.screening.peak_contribution_share,
  r.human_directional_review_performed,r.adjudicated_reason_code,r.adjudication_rationale
].map(one).join('\t')), ''].join('\n');
fs.writeFileSync(path.join(ROOT, OUT_TSV), tsv);

const orderedGroups = ['POWERPRO_TOO_LOW','POWERPRO_TOO_HIGH_OR_STALE','UNRESOLVED','POWERPRO_PLAUSIBLE'];
const groupRows = rec => rows.filter(r => r.adjudicated_recommendation === rec).sort((a,b)=>a.queue_order-b.queue_order);
const md = [
  '# Speed all-100 owner-review adjudication — 2026-08-18','',
  'Status: **HUMAN-ADJUDICATED RECOMMENDATIONS — NOT OWNER VERDICTS**','',
  'All 100 players were reviewed under the canonical construct. Weak, old, mixed and Community evidence was retained with role/confidence limits rather than discarded. The reproducible integrated screen was used for recall, then every directional screen was manually re-read.','',
  '## Final counts','',
  ...Object.entries(counts).map(([k,v])=>`- ${k}: ${v}`),
  '',`Confidence: ${JSON.stringify(confidenceCounts)}`,'',
  '## Key methodological corrections','',
  '- Current NPB+ peak speed remains at most one dimension; it cannot create a strong whole-construct verdict alone.',
  '- A single H2F/30m/50m measurement may inform acceleration and end-to-end interpretation, but is not treated as two independent physical sources.',
  '- Historical and unknown-date evidence is discounted, not deleted.',
  '- S/game context is retained; explicit technique evidence prevents it from being misread as pure physical speed.',
  '- `POWERPRO_PLAUSIBLE` means no material contradiction inside the retained uncertainty range, not exact validation.',
  '',
  '## Final all-100 table','',
  '| # | 選手 | PP | 統合目安pct (幅) | 最終推奨 | 強さ | 確度 | 人間再裁定 |',
  '|---:|---|---:|---|---|---|---|---|',
  ...rows.map(r=>`| ${r.queue_order} | ${r.player} | ${r.powerpro_current ?? '—'} | ${pct(r.screening.estimated_percentile)} (${pct(r.screening.lower_percentile)}–${pct(r.screening.upper_percentile)}) | ${r.adjudicated_recommendation} | ${r.adjudicated_strength} | ${r.adjudicated_confidence} | ${r.human_directional_review_performed ? 'YES' : 'screen-compatible'} |`),
  '',
  ...orderedGroups.flatMap(rec => [
    `## ${rec}`,'',
    ...groupRows(rec).map(r => `- **${r.player}（PP ${r.powerpro_current ?? '—'}）** — ${r.adjudicated_strength}/${r.adjudicated_confidence}. ${r.adjudication_rationale}`),
    ''
  ]),
  '## Withdrawn automated directions','',
  '- 古賀優大: TOO_LOW → UNRESOLVED（peak と S/game の実質衝突）',
  '- 細川成也: TOO_LOW → UNRESOLVED（peak と 50m/S/game の衝突）',
  '- 小園海斗: TOO_HIGH → UNRESOLVED（current peak/old H2F と current context の衝突）',
  '- 矢野雅哉: TOO_HIGH → PLAUSIBLE（少数peakより50m/S/gameを合わせて評価）',
  '- 京田陽太: TOO_HIGH → PLAUSIBLE（少数peakと50mを両方保持）',
  '- カリステ: TOO_HIGH → PLAUSIBLE（7-run peakだけで2017 direct T10/T30/T90を消さない）',
  '',
  '## Governance','',
  '- SP-078 owner verdict count remains 0.',
  '- No SP-079 final practical rating was created.',
  '- No shoulder work was started.',
  '- Explicit owner decisions are still required before writing the append-only verdict ledger.',''
].join('\n');
fs.mkdirSync(path.dirname(path.join(ROOT, OUT_MD)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT_MD), md + '\n');

console.log(JSON.stringify({status:'PASS',population:rows.length,counts,confidenceCounts,adjudicated_directional:adjudications.size,noTarget:noTarget.map(r=>r.player)}));

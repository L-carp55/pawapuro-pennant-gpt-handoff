// Evidence-maximizing, full-construct review synthesis for all 100 speed players.
// No owner verdicts are written. This is a transparent screening/recommendation layer only.
// Canonical construct: initial acceleration + peak speed + speed maintenance/end-to-end to ~90ft.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = 'outputs/derived/speed_all100_full_construct_inventory_20260818.json';
const OUT_JSON = 'outputs/derived/speed_all100_integrated_owner_review_20260818.json';
const OUT_TSV = 'outputs/derived/speed_all100_integrated_owner_review_20260818.tsv';
const OUT_MD = 'docs/audits/speed_all100_integrated_owner_review_20260818.md';

const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, INPUT), 'utf8'));
if (inventory?.population?.emitted !== 100 || inventory?.players?.length !== 100) throw new Error('inventory is not exact 100');
if (inventory.owner_verdict_count !== 0) throw new Error('owner verdict contamination');
if (new Set(inventory.players.map(r => r.queue_row_key)).size !== 100) throw new Error('duplicate queue key');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = v => Number.isFinite(Number(v)) ? Number(v) : null;
const arr = v => Array.isArray(v) ? v : [];
const median = xs => {
  const a = xs.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if (!a.length) return null;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
};
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const sd = xs => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1));
};
const robust = xs => {
  const clean = xs.filter(Number.isFinite);
  const center = median(clean) ?? 0;
  const mad = median(clean.map(x => Math.abs(x-center))) ?? 0;
  let scale = mad * 1.4826;
  if (!(scale > 1e-9)) scale = sd(clean) ?? 1;
  return { n: clean.length, center, scale: scale > 1e-9 ? scale : 1 };
};
const normName = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const oneLine = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const pct = v => v == null ? null : Math.round(v*1000)/10;

function metricKey(record) {
  const m = String(record?.metric ?? '').normalize('NFKC').toUpperCase().replace(/[\s_-]+/g, '');
  if (/T10FT|10FT/.test(m)) return 'T10FT';
  if (/T30FT|30FT/.test(m)) return 'T30FT';
  if (/T90FT|90FT/.test(m)) return 'T90FT';
  if (/HPTO1B|HOMETO1ST|HOMETOFIRST|一塁到達/.test(m)) return 'H2F';
  if (/30M/.test(m)) return '30M';
  if (/50M/.test(m)) return '50M';
  if (/SPRINTSPEED/.test(m)) return 'HIST_SPRINT';
  return null;
}
function recordValue(record, key) {
  const v = finite(record?.seconds ?? record?.value);
  if (v == null) return null;
  return v;
}
function lowerIsFaster(key) { return key !== 'HIST_SPRINT'; }
function fallbackScale(key) {
  return ({T10FT:0.05,T30FT:0.10,T90FT:0.18,H2F:0.18,'30M':0.20,'50M':0.30,HIST_SPRINT:1.5})[key] ?? 1;
}
function confidenceWeight(value) {
  const c = String(value ?? '').toLowerCase();
  if (c === 'high') return 1;
  if (c === 'medium_high') return 0.85;
  if (c === 'medium') return 0.70;
  if (c === 'low_medium') return 0.50;
  if (c === 'low') return 0.34;
  return 0.30;
}
function temporalWeight(year) {
  const y = finite(year);
  if (y == null) return 0.35; // unknown date is retained, not discarded
  if (y >= 2026) return 1.00;
  if (y === 2025) return 0.92;
  if (y === 2024) return 0.82;
  if (y === 2023) return 0.68;
  if (y === 2022) return 0.57;
  if (y === 2021) return 0.47;
  if (y === 2020) return 0.39;
  if (y >= 2018) return 0.31;
  return 0.23;
}
function sourceWeight(record) {
  const tier = String(record?.source_tier ?? '').toUpperCase();
  const tierW = tier === 'A' ? 1 : tier === 'B' ? 0.88 : tier === 'C' ? 0.72 : 0.82;
  const numericW = record?.numeric_t90_usable === false ? 0.72 : 1;
  const protocol = String(record?.start_protocol ?? '').toLowerCase();
  const protocolW = /unknown|unspecified/.test(protocol) ? 0.82 : 1;
  return tierW * numericW * protocolW;
}

// Collapse duplicated profile/curated aliases so one measurement cannot gain weight by appearing in several lanes.
function uniqueRecords(player) {
  const all = [
    ...arr(player.acceleration_h2f_t90?.direct_or_standardized_t90_records),
    ...arr(player.short_distance?.records),
    ...arr(player.historical_physical?.records),
  ];
  const seen = new Set();
  const out = [];
  for (const r of all) {
    const key = metricKey(r);
    const value = recordValue(r, key);
    if (!key || value == null) continue;
    const id = `${key}|${r.year ?? '?'}|${Math.round(value*10000)/10000}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({...r, normalized_metric:key, normalized_value:value});
  }
  return out;
}

const recordsByPlayer = new Map(inventory.players.map(p => [p.queue_row_key, uniqueRecords(p)]));
const perMetricPerPlayer = new Map();
for (const p of inventory.players) {
  const grouped = new Map();
  for (const r of recordsByPlayer.get(p.queue_row_key)) {
    if (!grouped.has(r.normalized_metric)) grouped.set(r.normalized_metric, []);
    grouped.get(r.normalized_metric).push(r.normalized_value);
  }
  for (const [k, values] of grouped) {
    if (!perMetricPerPlayer.has(k)) perMetricPerPlayer.set(k, []);
    perMetricPerPlayer.get(k).push(median(values));
  }
}
const metricStats = {};
for (const key of ['T10FT','T30FT','T90FT','H2F','30M','50M','HIST_SPRINT']) {
  const r = robust(perMetricPerPlayer.get(key) ?? []);
  if (r.n < 4) r.scale = fallbackScale(key);
  metricStats[key] = r;
}
function recordZ(record) {
  const key = record.normalized_metric;
  const stats = metricStats[key];
  const raw = lowerIsFaster(key)
    ? (stats.center - record.normalized_value) / stats.scale
    : (record.normalized_value - stats.center) / stats.scale;
  return clamp(raw, -3, 3);
}
function weightedDimension(entries) {
  const valid = entries.filter(e => Number.isFinite(e.z) && e.support > 0);
  if (!valid.length) return {z:0, confidence:0, support:0, entries:[]};
  const support = valid.reduce((s,e)=>s+e.support,0);
  const z = valid.reduce((s,e)=>s+e.z*e.support,0)/support;
  // Evidence is retained with diminishing returns so duplicates cannot manufacture certainty.
  const confidence = clamp(1-Math.exp(-support),0,1);
  return {z:clamp(z,-3,3),confidence,support,entries:valid};
}
function metricDimensionSupport(key) {
  const accel = ({T10FT:1.00,T30FT:0.90,T90FT:0.25,H2F:0.70,'30M':0.72,'50M':0.30,HIST_SPRINT:0.15})[key] ?? 0;
  const end = ({T10FT:0.12,T30FT:0.30,T90FT:1.00,H2F:0.85,'30M':0.58,'50M':0.82,HIST_SPRINT:0.20})[key] ?? 0;
  return {accel,end};
}
function exposureConfidence(top) {
  const direction = String(top?.exposure_context?.max_statistic_direction ?? '');
  if (direction === 'ADEQUATE_RUNS') return 1;
  if (direction === 'FEW_RUNS_TOP_SPEED_LIKELY_UNDERSTATED') return 0.82;
  return 0.78;
}
function h2fTemporal(player, seconds) {
  const candidates = recordsByPlayer.get(player.queue_row_key)
    .filter(r => r.normalized_metric === 'H2F' && Math.abs(r.normalized_value-seconds) < 0.035)
    .sort((a,b)=>(finite(b.year)??0)-(finite(a.year)??0));
  return candidates[0] ?? null;
}
function semanticPhysicalVote(rows) {
  const details=[];
  let sum=0, weight=0;
  for (const r of arr(rows)) {
    const direction = String(r?.direction ?? '').toUpperCase();
    const text = String(r?.text ?? '').normalize('NFKC');
    let vote=0;
    if (/FASTER|FAST|POSITIVE|IMPROV|UP/.test(direction)) vote=1;
    if (/SLOW|NEGATIVE|DECLIN|DOWN/.test(direction)) vote=-1;
    const neg = /(走力.{0,5}(落ち|低下)|足.{0,5}(遅|落ち)|遅くな|明らかに遅|衰え|スピード.{0,5}落ち)/.test(text);
    const pos = /(俊足|足.{0,3}速|走力向上|走力.{0,3}上が|衰え知らず|スピードがある|脚力|全力疾走.*速)/.test(text);
    if (neg && !pos) vote=-1;
    else if (pos && !neg) vote=1;
    else if (pos && neg) vote=0;
    const year = Number(String(r?.date ?? '').slice(0,4));
    const recency = Number.isFinite(year) ? temporalWeight(year) : 0.55;
    const usable = r?.usable_for_current100 === true ? 1 : 0.65;
    const w = recency*usable;
    sum += vote*w; weight += w;
    details.push({record_id:r?.record_id,date:r?.date,text:r?.text,vote,weight:w});
  }
  return {z:weight?clamp(sum/weight,-1,1):0,confidence:clamp(weight/2,0,1),details};
}
function gameConsistency(components) {
  const xs = Object.values(components ?? {}).map(finite).filter(v=>v!=null);
  if (!xs.length) return 0;
  const composite = mean(xs);
  const sameSign = xs.filter(v => Math.sign(v)===Math.sign(composite) || Math.abs(v)<0.15).length/xs.length;
  return clamp(0.45+0.55*sameSign,0.45,1);
}
function empiricalPct(value, values) {
  const sorted=values.slice().sort((a,b)=>a-b);
  let n=0; for (const x of sorted) if (x<=value) n++; else break;
  return sorted.length<=1 ? 0.5 : clamp((n-0.5)/sorted.length,0.005,0.995);
}
function band(p) {
  if (p>=0.95) return 'ELITE';
  if (p>=0.82) return 'VERY_FAST';
  if (p>=0.62) return 'ABOVE_AVERAGE';
  if (p>=0.38) return 'AVERAGE';
  if (p>=0.18) return 'BELOW_AVERAGE';
  if (p>=0.05) return 'SLOW';
  return 'VERY_SLOW';
}

const staged=[];
for (const player of inventory.players) {
  const topZ = finite(player.top_speed?.z) ?? 0;
  const peakConf = exposureConfidence(player.top_speed);
  const physicalRecords = recordsByPlayer.get(player.queue_row_key);
  const accelEntries=[]; const endEntries=[];
  for (const r of physicalRecords) {
    const z=recordZ(r);
    const quality=confidenceWeight(r.confidence)*temporalWeight(r.year)*sourceWeight(r);
    const dim=metricDimensionSupport(r.normalized_metric);
    if (dim.accel>0) accelEntries.push({type:r.normalized_metric,z,support:dim.accel*quality,year:r.year,value:r.normalized_value,confidence:r.confidence});
    if (dim.end>0) endEntries.push({type:r.normalized_metric,z,support:dim.end*quality,year:r.year,value:r.normalized_value,confidence:r.confidence});
  }
  for (const [kind, h, protocolFactor] of [
    ['NORMAL_H2F',player.acceleration_h2f_t90?.normal_swing_h2f,1],
    ['BUNT_H2F',player.acceleration_h2f_t90?.bunt_h2f,0.55],
  ]) {
    if (!h || finite(h.seconds)==null || finite(h.z)==null) continue;
    const match=h2fTemporal(player,finite(h.seconds));
    const quality=confidenceWeight(h.confidence)*temporalWeight(match?.year)*protocolFactor;
    accelEntries.push({type:kind,z:clamp(finite(h.z),-3,3),support:0.70*quality,year:match?.year??null,value:h.seconds,confidence:h.confidence});
    endEntries.push({type:kind,z:clamp(finite(h.z),-3,3),support:0.85*quality,year:match?.year??null,value:h.seconds,confidence:h.confidence});
  }
  const accel=weightedDimension(accelEntries);
  const end=weightedDimension(endEntries);
  const peakContribution=0.40*peakConf*topZ;
  const accelContribution=0.30*accel.confidence*accel.z;
  const endContribution=0.30*end.confidence*end.z;
  const physicalScore=peakContribution+accelContribution+endContribution;
  const physicalCoverage=clamp(0.40*peakConf+0.30*accel.confidence+0.30*end.confidence,0,1);

  const community=semanticPhysicalVote(player.community?.physical);
  const techniquePresent=arr(player.community?.technique).length>0;
  const sZ=finite(player.statistical_proxy?.value_z);
  const sRel=finite(player.statistical_proxy?.reliability) ?? 0;
  const sPa=finite(player.statistical_proxy?.pa_2025) ?? 0;
  let sWeight=sZ==null?0:0.12*sRel*clamp(sPa/300,0,1);
  const gameZ=finite(player.game_context_proxy?.legacy_composite_score_context_only);
  const gamePa=finite(player.game_context_proxy?.sample?.PA) ?? sPa;
  let gameWeight=gameZ==null?0:0.08*clamp(gamePa/300,0,1)*gameConsistency(player.game_context_proxy?.components_z);
  // When an explicit technique row explains a physical/context disagreement, do not throw S/game away;
  // retain them at half weight rather than misreading technique as base speed.
  if (techniquePresent && Math.sign(community.z)!==0) {
    if (sZ!=null && Math.sign(sZ)!==Math.sign(community.z)) sWeight*=0.5;
    if (gameZ!=null && Math.sign(gameZ)!==Math.sign(community.z)) gameWeight*=0.5;
  }
  const communityWeight=0.10*community.confidence;
  const contextScore=(sZ??0)*sWeight+(gameZ??0)*gameWeight+community.z*communityWeight;
  const rawScore=physicalScore+contextScore;
  const dimensionValues=[{z:topZ,w:0.40*peakConf},{z:accel.z,w:0.30*accel.confidence},{z:end.z,w:0.30*end.confidence}].filter(x=>x.w>0.08);
  const disagreement=dimensionValues.length>=2 ? clamp(sd(dimensionValues.map(x=>x.z))??0,0,2) : 0;
  const contextCoverage=clamp(sWeight+gameWeight+communityWeight,0,0.30);
  const uncertaintyRaw=clamp(0.18+0.58*(1-physicalCoverage)+0.12*disagreement+(peakConf<0.9?0.05:0)-0.10*contextCoverage,0.18,0.88);
  staged.push({
    player,topZ,peakConf,accel,end,physicalRecords,community,techniquePresent,sZ,sWeight,gameZ,gameWeight,communityWeight,
    contributions:{peak:peakContribution,acceleration:accelContribution,end_to_end:endContribution,statistical:(sZ??0)*sWeight,game:(gameZ??0)*gameWeight,community:community.z*communityWeight},
    physicalScore,physicalCoverage,contextCoverage,rawScore,uncertaintyRaw,disagreement
  });
}
const rawScores=staged.map(x=>x.rawScore);
const rawStats=robust(rawScores);

const rows=[];
for (const x of staged) {
  const estimatedPct=empiricalPct(x.rawScore,rawScores);
  const lowerPct=empiricalPct(x.rawScore-x.uncertaintyRaw,rawScores);
  const upperPct=empiricalPct(x.rawScore+x.uncertaintyRaw,rawScores);
  const pp=finite(x.player.powerpro_review?.raw_last);
  const ppPct=finite(x.player.powerpro_review?.percentile);
  const gap=ppPct==null?null:estimatedPct-ppPct;
  const intervalWidth=upperPct-lowerPct;
  const direction=gap==null?0:Math.sign(gap);
  const supports=[];
  const supportCandidate=(lane,z,confidence,kind='context')=>{
    if (!(confidence>0.05) || Math.abs(z)<0.18 || direction===0) return;
    if (Math.sign(z)===direction) supports.push({lane,z,confidence,kind});
  };
  supportCandidate('peak_speed',x.topZ,x.peakConf,'physical');
  supportCandidate('initial_acceleration',x.accel.z,x.accel.confidence,'physical');
  supportCandidate('end_to_end_maintenance',x.end.z,x.end.confidence,'physical');
  supportCandidate('S_context',x.sZ??0,x.sWeight/0.12,'context');
  supportCandidate('game_context',x.gameZ??0,x.gameWeight/0.08,'context');
  supportCandidate('community_physical',x.community.z,x.community.confidence,'context');
  const nonPeakSupport=supports.filter(s=>s.lane!=='peak_speed').length;
  const physicalSupport=supports.filter(s=>s.kind==='physical').length;
  const absContrib=Object.values(x.contributions).reduce((s,v)=>s+Math.abs(v),0);
  const peakShare=absContrib?Math.abs(x.contributions.peak)/absContrib:1;
  const strongPhysicalConflict=x.accel.confidence>0.30 && x.end.confidence>0.30 && Math.abs(x.accel.z-x.end.z)>1.45;
  const peakNonPeakConflict=(x.accel.confidence>0.28 || x.end.confidence>0.28)
    && Math.sign(x.topZ)!==Math.sign((x.accel.z*x.accel.confidence+x.end.z*x.end.confidence)/(x.accel.confidence+x.end.confidence||1))
    && Math.abs(x.topZ)>0.55 && Math.max(Math.abs(x.accel.z),Math.abs(x.end.z))>0.75;

  let recommendation, strength='COMPATIBILITY_REVIEW', reasonCode='';
  if (pp==null || ppPct==null) {
    recommendation='UNRESOLVED'; strength='NO_CURRENT_POWERPRO_TARGET'; reasonCode='NO_CURRENT_POWERPRO_TARGET';
  } else {
    const outsideLow=ppPct < lowerPct-0.025;
    const outsideHigh=ppPct > upperPct+0.025;
    const semanticTooHigh=x.community.z<=-0.45 && (x.accel.z<=-0.70 || x.end.z<=-0.70) && ppPct>=0.75;
    const semanticTooLow=x.community.z>=0.45 && x.techniquePresent && ppPct<=0.32
      && (x.topZ>0.05 || x.accel.z>0.05 || x.end.z>0.05);
    if (semanticTooHigh) {
      recommendation='POWERPRO_TOO_HIGH_OR_STALE'; strength='STRONG_MULTI_LANE'; reasonCode='CURRENT_DECLINE_PLUS_NONPEAK_PHYSICAL_CONTRADICTION';
    } else if (semanticTooLow) {
      recommendation='POWERPRO_TOO_LOW'; strength='MULTI_LANE_TECHNIQUE_SEPARATED'; reasonCode='PHYSICAL_SPEED_POSITIVE_TECHNIQUE_CONTEXT_SEPARATED';
    } else if (outsideLow && gap>=0.13 && (nonPeakSupport>=1 || supports.length>=2)) {
      recommendation='POWERPRO_TOO_LOW'; strength=physicalSupport>=2?'STRONG_MULTI_PHYSICAL':'SUPPORTED_DIRECTIONAL'; reasonCode='POWERPRO_BELOW_INTEGRATED_EVIDENCE_INTERVAL';
    } else if (outsideHigh && gap<=-0.13 && (nonPeakSupport>=1 || supports.length>=2)) {
      recommendation='POWERPRO_TOO_HIGH_OR_STALE'; strength=physicalSupport>=2?'STRONG_MULTI_PHYSICAL':'SUPPORTED_DIRECTIONAL'; reasonCode='POWERPRO_ABOVE_INTEGRATED_EVIDENCE_INTERVAL';
    } else if (gap>=0.27 && supports.length>=1) {
      recommendation='POWERPRO_TOO_LOW'; strength=nonPeakSupport?'LOW_CONFIDENCE_SUPPORTED_CONCERN':'PEAK_LED_CONCERN_ONLY'; reasonCode='LARGE_DIRECTIONAL_GAP_WITH_PARTIAL_SUPPORT';
    } else if (gap<=-0.27 && supports.length>=1) {
      recommendation='POWERPRO_TOO_HIGH_OR_STALE'; strength=nonPeakSupport?'LOW_CONFIDENCE_SUPPORTED_CONCERN':'PEAK_LED_CONCERN_ONLY'; reasonCode='LARGE_DIRECTIONAL_GAP_WITH_PARTIAL_SUPPORT';
    } else if ((strongPhysicalConflict || peakNonPeakConflict) && Math.abs(gap)>=0.12) {
      recommendation='UNRESOLVED'; strength='MATERIAL_PHYSICAL_CONFLICT'; reasonCode='PHYSICAL_DIMENSIONS_CONFLICT';
    } else {
      recommendation='POWERPRO_PLAUSIBLE'; strength='COMPATIBLE_NOT_EXACTLY_VALIDATED'; reasonCode='POWERPRO_INSIDE_OR_NEAR_INTEGRATED_EVIDENCE_RANGE';
    }
  }
  // A peak-led concern is retained rather than discarded, but can never be presented as a strong whole-construct verdict.
  if ((recommendation==='POWERPRO_TOO_LOW'||recommendation==='POWERPRO_TOO_HIGH_OR_STALE') && peakShare>0.70 && nonPeakSupport===0) {
    strength='PEAK_LED_CONCERN_ONLY';
  }
  let confidence='LOW';
  if (x.physicalCoverage>=0.72 && intervalWidth<=0.38 && !strongPhysicalConflict && !peakNonPeakConflict) confidence='HIGH';
  else if (x.physicalCoverage>=0.50 || nonPeakSupport>=2 || (supports.length>=3 && intervalWidth<=0.55)) confidence='MEDIUM';
  if (strength==='PEAK_LED_CONCERN_ONLY') confidence='LOW';
  if (strength==='STRONG_MULTI_LANE'||strength==='STRONG_MULTI_PHYSICAL') confidence=x.physicalCoverage>=0.60?'HIGH':'MEDIUM';
  if (strength==='NO_CURRENT_POWERPRO_TARGET') confidence='HIGH';

  const evidenceUsed=[];
  evidenceUsed.push(`current peak z=${x.topZ.toFixed(3)} (exposure confidence=${x.peakConf.toFixed(2)})`);
  if (x.accel.confidence>0) evidenceUsed.push(`acceleration z=${x.accel.z.toFixed(3)} conf=${x.accel.confidence.toFixed(2)}`);
  if (x.end.confidence>0) evidenceUsed.push(`end-to-end z=${x.end.z.toFixed(3)} conf=${x.end.confidence.toFixed(2)}`);
  if (x.sZ!=null) evidenceUsed.push(`S z=${x.sZ.toFixed(3)} effective weight=${x.sWeight.toFixed(3)}`);
  if (x.gameZ!=null) evidenceUsed.push(`game z=${x.gameZ.toFixed(3)} effective weight=${x.gameWeight.toFixed(3)}`);
  if (x.community.confidence>0) evidenceUsed.push(`Community physical vote=${x.community.z.toFixed(2)} conf=${x.community.confidence.toFixed(2)}`);
  if (x.techniquePresent) evidenceUsed.push('Community technique context retained separately; conflicting S/game context downweighted, not deleted');

  rows.push({
    queue_order:x.player.queue_order,queue_row_key:x.player.queue_row_key,player:x.player.player,team:x.player.team,
    powerpro_current:pp,powerpro_percentile:ppPct,powerpro_flag:x.player.powerpro_review?.flag??null,
    integrated_review:{
      raw_score:x.rawScore,standardized_z:(x.rawScore-rawStats.center)/rawStats.scale,
      estimated_percentile:estimatedPct,lower_percentile:lowerPct,upper_percentile:upperPct,band:band(estimatedPct),
      uncertainty_raw:x.uncertaintyRaw,interval_width:intervalWidth,physical_coverage:x.physicalCoverage,context_coverage:x.contextCoverage,
      peak_contribution_share:peakShare,contributions:x.contributions
    },
    dimensions:{
      peak:{z:x.topZ,confidence:x.peakConf,kmh:x.player.top_speed?.kmh,rank:x.player.top_speed?.rank_current100,exposure:x.player.top_speed?.exposure_context},
      acceleration:{z:x.accel.z,confidence:x.accel.confidence,support:x.accel.support,evidence:x.accel.entries},
      end_to_end:{z:x.end.z,confidence:x.end.confidence,support:x.end.support,evidence:x.end.entries},
      statistical_context:{z:x.sZ,effective_weight:x.sWeight,reliability:x.player.statistical_proxy?.reliability,pa:x.player.statistical_proxy?.pa_2025},
      game_context:{z:x.gameZ,effective_weight:x.gameWeight,components:x.player.game_context_proxy?.components_z},
      community_physical:{z:x.community.z,confidence:x.community.confidence,details:x.community.details},
      community_technique:arr(x.player.community?.technique),
      community_powerpro_rating:arr(x.player.community?.powerpro_rating),
    },
    recommendation,recommendation_strength:strength,recommendation_confidence:confidence,reason_code:reasonCode,
    estimated_vs_powerpro_percentile_gap:gap,supporting_lanes:supports,
    conflict_flags:{strong_physical_conflict:strongPhysicalConflict,peak_nonpeak_conflict:peakNonPeakConflict},
    evidence_used:evidenceUsed,
    guardrails:[
      'Recommendation only; not an SP-078 owner verdict.',
      'Peak speed cannot produce a strong whole-construct verdict by itself.',
      'Historical/unknown-date physical evidence is retained with temporal discount, not deleted.',
      'S/game/Community remain context with role-specific limits.',
      'Missing evidence is prior-average uncertainty, not negative evidence.',
      'No exact final SP-079 rating is created here.'
    ]
  });
}

const counts={}; for (const r of rows) counts[r.recommendation]=(counts[r.recommendation]??0)+1;
const confidenceCounts={}; for (const r of rows) confidenceCounts[r.recommendation_confidence]=(confidenceCounts[r.recommendation_confidence]??0)+1;
const strengthCounts={}; for (const r of rows) strengthCounts[r.recommendation_strength]=(strengthCounts[r.recommendation_strength]??0)+1;
const output={
  schema_version:'speed_all100_integrated_owner_review_20260818',generated_at:'2026-08-18',source:INPUT,
  status:'NON_VERDICT_RECOMMENDATIONS_ONLY',owner_verdict_count:0,population:rows.length,
  methodology:{
    construct:'initial acceleration + peak speed + speed maintenance/end-to-end to about 90ft',
    maximum_component_weights:{peak_speed:0.40,initial_acceleration:0.30,end_to_end:0.30},
    context_caps:{statistical_S:0.12,mixed_game:0.08,community_physical:0.10},
    weak_evidence_policy:'retain with confidence, temporal, source and protocol discounts; never convert absence to zero',
    historical_policy:'retain all dates; 2024-26 strongest, older/unknown progressively discounted but never discarded',
    duplicate_policy:'deduplicate same player/metric/year/value across profile, curated and lane aliases',
    top_speed_guard:'top speed may create a LOW-confidence concern but cannot create a STRONG verdict without nonpeak/context support',
    powerpro_guard:'PowerPro is compared only after independent synthesis and is never used to estimate physical speed',
    metric_stats:metricStats,
  },
  counts,confidence_counts:confidenceCounts,strength_counts:strengthCounts,players:rows
};
fs.mkdirSync(path.dirname(path.join(ROOT,OUT_JSON)),{recursive:true});
fs.writeFileSync(path.join(ROOT,OUT_JSON),JSON.stringify(output,null,2)+'\n');

const headers=['order','player','team','pp','pp_pct','estimate_pct','range_low_pct','range_high_pct','band','recommendation','strength','confidence','gap','physical_coverage','peak_z','accel_z','accel_conf','end_z','end_conf','S_z','game_z','community_z','peak_share','reason_code','supporting_lanes'];
const tsv=[headers.join('\t'),...rows.map(r=>[
  r.queue_order,r.player,r.team,r.powerpro_current,r.powerpro_percentile,r.integrated_review.estimated_percentile,r.integrated_review.lower_percentile,r.integrated_review.upper_percentile,r.integrated_review.band,
  r.recommendation,r.recommendation_strength,r.recommendation_confidence,r.estimated_vs_powerpro_percentile_gap,r.integrated_review.physical_coverage,
  r.dimensions.peak.z,r.dimensions.acceleration.z,r.dimensions.acceleration.confidence,r.dimensions.end_to_end.z,r.dimensions.end_to_end.confidence,
  r.dimensions.statistical_context.z,r.dimensions.game_context.z,r.dimensions.community_physical.z,r.integrated_review.peak_contribution_share,r.reason_code,
  r.supporting_lanes.map(x=>x.lane).join(',')
].map(oneLine).join('\t')),''].join('\n');
fs.writeFileSync(path.join(ROOT,OUT_TSV),tsv);

const grouped = rec => rows.filter(r=>r.recommendation===rec).sort((a,b)=>Math.abs(b.estimated_vs_powerpro_percentile_gap??0)-Math.abs(a.estimated_vs_powerpro_percentile_gap??0));
const md=[
  '# Speed all-100 integrated full-construct owner review — 2026-08-18','',
  'Status: **NON-VERDICT RECOMMENDATIONS ONLY**','',
  'This review uses every retained lane with explicit role, temporal and confidence limits. Weak or old evidence is discounted rather than discarded. No SP-078 event and no SP-079 rating is created.','',
  '## Method','',
  '- Canonical construct: initial acceleration + peak speed + speed maintenance/end-to-end to about 90ft.',
  '- Peak speed can contribute at most 40%; acceleration and end-to-end dimensions together can contribute up to 60%.',
  '- S, mixed game signals and Community are retained as capped context, not direct physical teachers.',
  '- Historical and unknown-date measurements remain usable at lower weight; duplicated aliases are deduplicated.',
  '- A peak-only discrepancy is retained as a `PEAK_LED_CONCERN_ONLY`, never promoted to a strong whole-construct conclusion.',
  '- `POWERPRO_PLAUSIBLE` means compatible with the evidence interval, not exact numerical validation.','',
  '## Counts','',
  ...Object.entries(counts).map(([k,v])=>`- ${k}: ${v}`),
  '',`Confidence: ${JSON.stringify(confidenceCounts)}`,'',`Strength: ${JSON.stringify(strengthCounts)}`,'',
  '## All 100','',
  '| # | 選手 | PP | 統合pct (幅) | 帯 | 推奨 | 強さ | 確度 | 主要次元 |',
  '|---:|---|---:|---|---|---|---|---|---|',
  ...rows.map(r=>`| ${r.queue_order} | ${r.player} | ${r.powerpro_current??'—'} | ${pct(r.integrated_review.estimated_percentile)} (${pct(r.integrated_review.lower_percentile)}–${pct(r.integrated_review.upper_percentile)}) | ${r.integrated_review.band} | ${r.recommendation} | ${r.recommendation_strength} | ${r.recommendation_confidence} | peak ${r.dimensions.peak.z.toFixed(2)} / accel ${r.dimensions.acceleration.confidence?r.dimensions.acceleration.z.toFixed(2):'—'} / end ${r.dimensions.end_to_end.confidence?r.dimensions.end_to_end.z.toFixed(2):'—'} / S ${r.dimensions.statistical_context.z==null?'—':Number(r.dimensions.statistical_context.z).toFixed(2)} / G ${r.dimensions.game_context.z==null?'—':Number(r.dimensions.game_context.z).toFixed(2)} |`),
  '',
  '## Directional recommendations','',
  ...['POWERPRO_TOO_LOW','POWERPRO_TOO_HIGH_OR_STALE'].flatMap(rec=>[
    `### ${rec}`,'',
    ...grouped(rec).map(r=>`- **${r.player} (PP ${r.powerpro_current})** — estimate ${pct(r.integrated_review.estimated_percentile)}pct, evidence range ${pct(r.integrated_review.lower_percentile)}–${pct(r.integrated_review.upper_percentile)}pct; ${r.recommendation_strength}/${r.recommendation_confidence}. ${r.evidence_used.join('; ')}. Peak share=${pct(r.integrated_review.peak_contribution_share)}%.`),
    ''
  ]),
  '## Governance','',
  '- This output is an AI recommendation layer, not owner verdict history.',
  '- SP-078 remains empty until explicit owner approval.',
  '- SP-079 remains blocked until actual owner verdicts exist.',
  '- Shoulder remains out of scope.',''
].join('\n');
fs.mkdirSync(path.dirname(path.join(ROOT,OUT_MD)),{recursive:true});
fs.writeFileSync(path.join(ROOT,OUT_MD),md+'\n');

console.log(JSON.stringify({status:'PASS',players:rows.length,counts,confidenceCounts,strengthCounts,metricStats}));

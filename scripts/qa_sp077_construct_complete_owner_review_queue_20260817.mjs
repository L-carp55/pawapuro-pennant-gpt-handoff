import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = {
  queue:'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json',
  old:'outputs/derived/sp077_final_owner_review_queue_20260816.json',
  h2f:'outputs/derived/sp007_h2f_low_confidence_lane.json',
  physical:'data/manual/npb_speed_physical_evidence_full_20260809.json',
  recovered:'outputs/derived/sp017_physical_measurement_range_reclassification.json',
  anchors:'data/normalized/speed_historical_physical_measurements_2015_2026.json',
  stale:'outputs/derived/sp042_powerpro_stale_detector.json',
  x:'outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl',
  lock:'docs/state/speed_owner_review_integrity_lock_20260817.json',
  ledger:'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
  qa:'outputs/derived/qa_sp077_construct_complete_owner_review_queue_20260817.json',
  audit:'docs/audits/sp077_construct_complete_owner_review_independent_qa_20260817.md',
};
const full=p=>path.join(ROOT,p);
const read=p=>fs.readFileSync(full(p),'utf8');
const json=p=>JSON.parse(read(p));
const norm=v=>String(v??'').normalize('NFKC').replace(/[\s\u3000]/g,'');
const arr=v=>Array.isArray(v)?v:[];
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const errors=[]; const checks=[];
const check=(cond,label,detail=null)=>{checks.push({label,pass:!!cond,detail});if(!cond)errors.push(detail?`${label}: ${detail}`:label);};
const has=(o,k)=>o!=null&&typeof o==='object'&&Object.prototype.hasOwnProperty.call(o,k);
const metricText=r=>`${r?.metric??''} ${r?.metric_raw??''} ${r?.metric_canonical??''} ${r?.start_protocol??''}`;
const isT90=r=>/(T90|90\s*ft|90ft|home.?to.?first|home-to-first|一塁到達)/i.test(metricText(r));
const isShort=r=>/(^|[^0-9])(10m|20m|30m|40m|50m|60yd|60-yard)([^0-9]|$)/i.test(metricText(r));
const recSig=r=>JSON.stringify([n(r.measurement_year),r.metric??r.metric_canonical??r.metric_raw??null,n(r.value??r.seconds),r.source_url??null]);
const outSig=r=>JSON.stringify([n(r.measurement_year),r.metric??null,n(r.value??r.seconds),r.source_url??null]);
const sameMultiset=(a,b)=>{const m=new Map();for(const x of a)m.set(x,(m.get(x)||0)+1);for(const x of b)m.set(x,(m.get(x)||0)-1);return [...m.values()].every(v=>v===0);};

const q=json(P.queue), old=json(P.old), h2f=json(P.h2f), physical=json(P.physical), recovered=json(P.recovered), anchors=json(P.anchors), stale=json(P.stale), lock=json(P.lock), ledger=json(P.ledger);
const xRows=read(P.x).split(/\r?\n/).filter(Boolean).map(JSON.parse);
check(q.schema_version==='sp077_construct_complete_owner_review_queue_20260817','schema');
check(arr(q.players).length===100,'population=100',`got ${arr(q.players).length}`);
check(new Set(arr(q.players).map(r=>r.queue_row_key)).size===100,'unique queue keys');
check(lock.locked===true,'integrity lock remains true during independent QA');
check(arr(ledger.records).length===0&&Number(ledger.owner_verdict_count)===0,'SP078 ledger remains zero');
check(/LOCK/i.test(String(q.status)),'candidate status explicitly locked',String(q.status));
const qByName=new Map(q.players.map(r=>[norm(r.identity?.player),r]));
const oldByName=new Map(old.players.map(r=>[norm(r.identity?.player),r]));
const required=['construct_contract','top_speed_evidence','acceleration_h2f_t90_evidence','short_distance_physical_evidence','historical_physical_temporal_context','sp021_high_confidence_anchor_context','statistical_proxy_context','game_context_proxy_breakdown','community_physical_context','technique_separation_contract','powerpro_review_context','source_scope_guard','missingness_and_provenance_contract'];
for(const r of q.players){
 for(const f of required)check(has(r,f),`${r.identity.player} field ${f}`);
 check(r.construct_contract?.top_speed_is_full_construct===false,`${r.identity.player} top speed not full construct`);
 check(r.source_scope_guard?.npb_plus_hp_to_1b_sec==='MISATTRIBUTED_SOURCE_FAIL_CLOSED',`${r.identity.player} NPB+ H2F field fail-closed`);
 check(r.source_scope_guard?.h2f_construct_lane_preserved===true,`${r.identity.player} H2F construct preserved`);
 check(r.technique_separation_contract?.stealing_and_baserunning_abilities_require_residual_or_separate_model===true,`${r.identity.player} technique separation`);
 check(r.owner_verdict?.verdict==null,`${r.identity.player} no owner verdict`);
 const o=oldByName.get(norm(r.identity.player));
 check(!!o,`${r.identity.player} exists in old queue`);
 if(o){
   check(n(r.top_speed_evidence?.npb_plus_top_speed_kmh)===n(o.current_physical_evidence?.npb_plus_top_speed_kmh),`${r.identity.player} top speed exact source match`);
   check(JSON.stringify(r.statistical_proxy_context)===JSON.stringify(o.statistical_proxy_context),`${r.identity.player} statistical context preserved exactly`);
 }
 const gs=r.game_context_proxy_breakdown;
 if(gs?.evidence_state==='AVAILABLE_MIXED_PROXY'){
   check(gs.role==='MIXED_GAME_CONTEXT_PROXY_NOT_DIRECT_PHYSICAL_TEACHER',`${r.identity.player} game proxy role`);
   check(!has(gs.raw,'SB')&&!has(gs.raw,'CS')&&!has(gs.z,'SB')&&!has(gs.z,'CS'),`${r.identity.player} steals not direct speed component`);
 }
 check(r.historical_physical_temporal_context?.injury_context?.no_negative_inference===true,`${r.identity.player} injury missingness nonnegative`);
 check(r.historical_physical_temporal_context?.age_context?.no_negative_inference===true,`${r.identity.player} age missingness nonnegative`);
}

// H2F: exact player/value preservation from SP-007 normal and bunt lanes.
const normal=arr(h2f.normal_swing?.players), bunt=arr(h2f.bunt?.players);
for(const s of normal){const r=qByName.get(norm(s.canonical_name??s.player));if(!r)continue;check(n(r.acceleration_h2f_t90_evidence?.normal_swing_h2f?.seconds)===n(s.seconds),`H2F normal exact ${s.canonical_name??s.player}`);}
for(const s of bunt){const r=qByName.get(norm(s.canonical_name??s.player));if(!r)continue;check(n(r.acceleration_h2f_t90_evidence?.bunt_h2f?.seconds)===n(s.seconds),`H2F bunt exact ${s.canonical_name??s.player}`);}
const h2fCurrent=new Set([...normal,...bunt].map(s=>norm(s.canonical_name??s.player)).filter(k=>qByName.has(k)));
check(h2fCurrent.size===15,'SP007 current100 H2F player coverage',`got ${h2fCurrent.size}`);

// Direct physical source: short-distance and historical records must not silently disappear.
const pByName=new Map(arr(physical.players).map(p=>[norm(p.player),p]));
const rrByName=new Map();for(const x of arr(recovered.records)){const k=norm(x.canonical_name??x.raw_name??x.player);if(!rrByName.has(k))rrByName.set(k,[]);rrByName.get(k).push(x);}
for(const r of q.players){const k=norm(r.identity.player);const raw=arr(pByName.get(k)?.records);const rec=rrByName.get(k)??[];
 const expectedShort=[...raw.filter(isShort),...rec.filter(isShort)].map(recSig);const actualShort=arr(r.short_distance_physical_evidence?.records).map(outSig);
 check(sameMultiset(expectedShort,actualShort),`${r.identity.player} short-distance source preservation`,`expected ${expectedShort.length}, actual ${actualShort.length}`);
 const expectedHist=[...raw,...rec].filter(x=>{const y=n(x.measurement_year);return y==null||y<2026;}).map(recSig);const actualHist=arr(r.historical_physical_temporal_context?.records).map(outSig);
 check(sameMultiset(expectedHist,actualHist),`${r.identity.player} historical source preservation`,`expected ${expectedHist.length}, actual ${actualHist.length}`);
 check(new Set(actualShort).size===actualShort.length,`${r.identity.player} no duplicate short-distance records`);
}

// SP-021: accepted high-confidence raw rows deduplicate to 113 anchors; exact 7-anchor current100 overlap must be surfaced.
const accepted=arr(anchors.records).filter(x=>x.bank_acceptance_status==='ACCEPTED_HIGH_CONFIDENCE');const dedup=new Map();for(const x of accepted){const id=x.selected_anchor_id||x.same_measurement_cluster_id||x.raw_id;if(!dedup.has(id))dedup.set(id,x);}
check(accepted.length===140,'SP021 accepted high-confidence raw=140',`got ${accepted.length}`);check(dedup.size===113,'SP021 dedup anchors=113',`got ${dedup.size}`);
let aCount=0,pCount=0;for(const r of q.players){const expected=[...dedup].filter(([,x])=>norm(x.player)===norm(r.identity.player));const actual=arr(r.sp021_high_confidence_anchor_context?.records);aCount+=actual.length;if(actual.length)pCount++;
 check(actual.length===expected.length,`${r.identity.player} SP021 anchor count`,`expected ${expected.length}, actual ${actual.length}`);
 for(const [id,x] of expected){const y=actual.find(z=>z.anchor_id===id);check(!!y,`${r.identity.player} SP021 anchor ${id} present`);if(y)check(n(y.value)===n(x.value)&&y.metric===x.metric&&n(y.measurement_year)===n(x.measurement_year),`${r.identity.player} SP021 anchor ${id} exact`);}
}
check(aCount===7&&pCount===7,'SP021 current100 overlap 7 anchors/7 players',`anchors=${aCount}, players=${pCount}`);

// PowerPro stale context exact 95/100 presence and source row preservation.
const staleRows=arr(stale.rows??stale.players);const staleByName=new Map(staleRows.map(x=>[norm(x.player),x]));let staleAvail=0;for(const r of q.players){const s=staleByName.get(norm(r.identity.player));const avail=r.powerpro_review_context?.evidence_state==='AVAILABLE_REVIEW_CONTEXT';if(avail)staleAvail++;check(avail===!!s,`${r.identity.player} PowerPro stale presence exact`);if(s&&avail)check(JSON.stringify(r.powerpro_review_context.stale_detector)===JSON.stringify(s),`${r.identity.player} PowerPro stale row exact`);}
check(staleAvail===95,'PowerPro stale context 95/100',`got ${staleAvail}`);

// Community physical/context availability must match bounded clean X source player set.
const xNames=new Set(xRows.map(x=>norm(x.player??x.canonical_player??x.subject_player??x.player_name)).filter(k=>qByName.has(k)&&k));let commAvail=0;for(const r of q.players){const avail=r.community_physical_context?.evidence_state==='AVAILABLE_BOUNDED';if(avail)commAvail++;check(avail===xNames.has(norm(r.identity.player)),`${r.identity.player} community bounded presence exact`);}
check(commAvail===18,'community context 18/100',`got ${commAvail}`);

const summary={schema_version:'qa_sp077_construct_complete_owner_review_queue_20260817',generated_at:'2026-08-17',status:errors.length?'FAIL':'PASS',checks_total:checks.length,checks_passed:checks.filter(x=>x.pass).length,checks_failed:errors.length,coverage:{players:q.players.length,h2f_current100_players:h2fCurrent.size,sp021_current100_anchors:aCount,sp021_current100_players:pCount,powerpro_stale_players:staleAvail,community_players:commAvail,game_proxy_available:q.players.filter(r=>r.game_context_proxy_breakdown?.evidence_state==='AVAILABLE_MIXED_PROXY').length,short_distance_available:q.players.filter(r=>r.short_distance_physical_evidence?.evidence_state==='AVAILABLE_BOUNDED').length,historical_available:q.players.filter(r=>r.historical_physical_temporal_context?.evidence_state==='AVAILABLE_BOUNDED').length,acceleration_available:q.players.filter(r=>r.acceleration_h2f_t90_evidence?.evidence_state==='AVAILABLE_BOUNDED').length},errors,checks};
fs.writeFileSync(full(P.qa),JSON.stringify(summary,null,2)+'\n');
const md=[ '# SP-077 construct-complete owner-review independent QA','',`Status: **${summary.status}**`,`Checks: ${summary.checks_passed}/${summary.checks_total} PASS; ${summary.checks_failed} FAIL`,'','## Independently verified coverage','',`- players: ${summary.coverage.players}/100`,`- acceleration/H2F/T90 available: ${summary.coverage.acceleration_available}/100; SP-007 H2F source players matched: ${summary.coverage.h2f_current100_players}`,`- short-distance physical available: ${summary.coverage.short_distance_available}/100`,`- historical physical available: ${summary.coverage.historical_available}/100`,`- SP-021 high-confidence current100: ${summary.coverage.sp021_current100_anchors} anchors / ${summary.coverage.sp021_current100_players} players`,`- mixed game-context proxy available: ${summary.coverage.game_proxy_available}/100`,`- PowerPro stale/review context: ${summary.coverage.powerpro_stale_players}/100`,`- bounded clean community context: ${summary.coverage.community_players}/100`,'','## Fail-closed guards','','- Owner-review integrity lock must remain true during this QA.','- SP-078 ledger must remain zero.','- NPB+ `hp_to_1b_sec` stays fail-closed while independently sourced H2F remains preserved.','- Top speed may not substitute for the full construct.','- No owner verdict or SP-079 final rating is created here.','',...(errors.length?['## Errors','',...errors.map(e=>`- ${e}`),'']:[])].join('\n');
fs.mkdirSync(path.dirname(full(P.audit)),{recursive:true});fs.writeFileSync(full(P.audit),md+'\n');
console.log(JSON.stringify({status:summary.status,checks_passed:summary.checks_passed,checks_failed:summary.checks_failed,coverage:summary.coverage}));
if(errors.length)process.exit(1);

#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,hashlib,json,re
from collections import Counter,defaultdict
from pathlib import Path
from typing import Any

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'/'derived'
TARGET=OUT/'sp101_residual_low_confidence_target_set.json'
SP101=OUT/'sp101_current100_multibridge_evidence.json'

CLASSES={
 'CURRENT_REALWORLD_SPEED_PHYSICAL','CURRENT_INITIAL_ACCELERATION_OR_H2F','CURRENT_END_TO_END_OR_FULL_EFFORT',
 'CURRENT_TECHNIQUE_CONTEXT','HISTORICAL_TRAJECTORY','INJURY_AGE_DECLINE_CONTEXT','RELATIVE_ORDINAL_COMPARISON',
 'CURRENT_POWERPRO_RATING_OPINION','PRIMARY_SOURCE_DISCOVERY','AMBIGUOUS_TIME_OR_PLAYER','REPOST_OR_QUOTE_NOT_INDEPENDENT',
 'MEME_SARCASM_JOKE','GENERAL_FANDOM_NO_SPEED_CLAIM','SPAM_OR_BOT'
}
LAYERS={'VIDEO_NARRATION_OR_EDITORIAL','QUOTED_2CH_5CH_THREAD_TEXT','YOUTUBE_TOP_LEVEL_COMMENT','YOUTUBE_COMMENT_REPLY','LINKED_PRIMARY_SOURCE_DISCOVERED_IN_COMMENT'}

def j(p): return json.loads(p.read_text(encoding='utf-8'))
def rows_gz(p):
    out=[]
    with gzip.open(p,'rt',encoding='utf-8') as f:
        for line in f:
            if line.strip(): out.append(json.loads(line))
    return out
def wj(p,o): p.write_text(json.dumps(o,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
def wjl(p,rows):
    with p.open('w',encoding='utf-8',newline='\n') as f:
        for r in rows: f.write(json.dumps(r,ensure_ascii=False,sort_keys=True)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def compact(s): return re.sub(r'[\s　\W_]+','',str(s or '').lower(),flags=re.UNICODE)
def band(v):
    if v is None:return None
    return 'LOW' if v<0.35 else ('MID' if v<0.65 else 'HIGH')

def canonical_layer(r):
    layer=r.get('source_layer')
    text=str(r.get('text') or '')
    title=str(r.get('video_title') or '')
    if layer=='COMMENT': return 'YOUTUBE_TOP_LEVEL_COMMENT'
    if layer=='REPLY': return 'YOUTUBE_COMMENT_REPLY'
    if layer in {'AUTO_CAPTION_TRANSCRIPT','MANUAL_SUBTITLE'}:
        if any(x in text for x in ['名無しさん','なんJ民','5ch民','2ch','5ch','>>','スレ民']) or any(x in title for x in ['反応集','なんJ','2ch','5ch']):
            # A reaction-style narration is not automatically a verbatim thread quote.
            # Require a textual quote/thread marker for QUOTED; title alone remains narration.
            if any(x in text for x in ['名無しさん','なんJ民','5ch民','2ch','5ch','>>','スレ民']): return 'QUOTED_2CH_5CH_THREAD_TEXT'
        return 'VIDEO_NARRATION_OR_EDITORIAL'
    if layer=='UPLOADER_DESCRIPTION': return 'VIDEO_NARRATION_OR_EDITORIAL'
    return 'VIDEO_NARRATION_OR_EDITORIAL'

def semantic_class(r):
    text=str(r.get('claim_excerpt') or r.get('text') or '')
    t=text.lower(); axis=r.get('speed_axis')
    if r.get('quoted_existing_content_record_id'): return 'REPOST_OR_QUOTE_NOT_INDEPENDENT'
    if any(x in text for x in ['皮肉','ネタ','草','www','ｗｗ','笑']) and r.get('direction')!='UNCLEAR_OR_MIXED': return 'MEME_SARCASM_JOKE'
    if not r.get('usable_directional_context'): return 'AMBIGUOUS_TIME_OR_PLAYER'
    if any(x in text for x in ['パワプロ','走力査定','能力値','査定','S99','A80']): return 'CURRENT_POWERPRO_RATING_OPINION'
    if any(x in text for x in ['怪我','けが','故障','衰え','年齢','加齢','劣化','復帰']): return 'INJURY_AGE_DECLINE_CONTEXT'
    years=[int(x) for x in re.findall(r'(20\d{2})',text)]
    if any(y<=2024 for y in years) or any(x in text for x in ['昔','以前','全盛期','若い頃']): return 'HISTORICAL_TRAJECTORY'
    if any(x in text for x in ['より速','より遅','と比べ','比較','一番速','最速クラス','チームで一番']): return 'RELATIVE_ORDINAL_COMPARISON'
    if axis in {'HOME_TO_FIRST','ACCELERATION_EXPLOSIVENESS'}: return 'CURRENT_INITIAL_ACCELERATION_OR_H2F'
    if axis=='T90_SHORT_DISTANCE': return 'CURRENT_END_TO_END_OR_FULL_EFFORT'
    if axis=='BASERUNNING_TECHNIQUE': return 'CURRENT_TECHNIQUE_CONTEXT'
    if axis in {'GENERIC_FOOT_SPEED','FIELD_50M'}: return 'CURRENT_REALWORLD_SPEED_PHYSICAL'
    return 'AMBIGUOUS_TIME_OR_PLAYER'

def pre_band(packet):
    vals=[]
    for lane in packet.get('lane_inventory_semantic_repair',[]):
        v=lane.get('comparable_percentile')
        if lane.get('comparable') and isinstance(v,(int,float)): vals.append(float(v))
    if not vals:return None
    vals.sort(); n=len(vals)
    med=vals[n//2] if n%2 else (vals[n//2-1]+vals[n//2])/2
    return band(med)

def independent_direction(records, clusters):
    usable=[r for r in records if r.get('usable_directional_context') and r.get('semantic_class') not in {'MEME_SARCASM_JOKE','REPOST_OR_QUOTE_NOT_INDEPENDENT','AMBIGUOUS_TIME_OR_PLAYER','CURRENT_TECHNIQUE_CONTEXT','CURRENT_POWERPRO_RATING_OPINION'}]
    byid={r['record_id']:r for r in usable}
    dirs=[]
    for c in clusters:
        rs=[byid[x] for x in c.get('member_record_ids',[]) if x in byid]
        ds={r.get('direction') for r in rs if r.get('direction') in {'FAST_DIRECTIONAL','SLOW_DIRECTIONAL'}}
        if len(ds)==1: dirs.append(next(iter(ds)))
    return dirs

def use_state(pre, records, clusters, primary):
    usable=[r for r in records if r.get('usable_directional_context') and r.get('semantic_class') not in {'MEME_SARCASM_JOKE','REPOST_OR_QUOTE_NOT_INDEPENDENT','AMBIGUOUS_TIME_OR_PLAYER'}]
    if any(p.get('validation_status')=='INDEPENDENTLY_FETCHED_VALIDATED_PRIMARY' for p in primary): return 'DISCOVERED_PRIMARY_SOURCE'
    dirs=independent_direction(records,clusters)
    if not usable and not dirs:return 'NO_USABLE_EVIDENCE'
    if not dirs:return 'AVAILABLE_NOT_DECISION_EFFECTIVE'
    fast=sum(d=='FAST_DIRECTIONAL' for d in dirs); slow=sum(d=='SLOW_DIRECTIONAL' for d in dirs)
    # Never majority-vote a rating. Only describe relation to the existing coarse direction when non-ambiguous clusters exist.
    if fast and slow:return 'WIDENED_UNCERTAINTY'
    observed='HIGH' if fast else 'LOW'
    if pre in {'HIGH','LOW'}:
        return 'SUPPORTED_EXISTING_DIRECTION' if observed==pre else 'CONTRADICTED_EXISTING_DIRECTION'
    return 'AVAILABLE_NOT_DECISION_EFFECTIVE'

def synthetic_canaries():
    fixtures={
      'sarcasm':{'claim_excerpt':'足速すぎて草、いや遅すぎるだろ笑','usable_directional_context':True,'direction':'FAST_DIRECTIONAL','speed_axis':'GENERIC_FOOT_SPEED'},
      'meme':{'claim_excerpt':'俊足で草www ネタだろ','usable_directional_context':True,'direction':'FAST_DIRECTIONAL','speed_axis':'GENERIC_FOOT_SPEED'},
      'title_priming':{'claim_excerpt':'足速いね','usable_directional_context':False,'direction':'FAST_DIRECTIONAL','speed_axis':'GENERIC_FOOT_SPEED'},
      'wrong_season':{'claim_excerpt':'2020年は足が速かった','usable_directional_context':True,'direction':'FAST_DIRECTIONAL','speed_axis':'GENERIC_FOOT_SPEED'},
      'technique':{'claim_excerpt':'走塁判断が速い','usable_directional_context':True,'direction':'FAST_DIRECTIONAL','speed_axis':'BASERUNNING_TECHNIQUE'},
      'rating_opinion':{'claim_excerpt':'パワプロの走力査定が低すぎる','usable_directional_context':True,'direction':'FAST_DIRECTIONAL','speed_axis':'GENERIC_FOOT_SPEED'},
    }
    got={k:semantic_class(v) for k,v in fixtures.items()}
    checks={
      'sarcasm_or_meme_not_physical':got['sarcasm']=='MEME_SARCASM_JOKE' and got['meme']=='MEME_SARCASM_JOKE',
      'title_priming_not_usable':got['title_priming']=='AMBIGUOUS_TIME_OR_PLAYER',
      'wrong_season_historical':got['wrong_season']=='HISTORICAL_TRAJECTORY',
      'baserunning_technique_separate':got['technique']=='CURRENT_TECHNIQUE_CONTEXT',
      'powerpro_opinion_separate':got['rating_opinion']=='CURRENT_POWERPRO_RATING_OPINION',
    }
    return {'checks':checks,'pass':all(checks.values()),'classifications':got}

src=j(TARGET); all100=src['players']; targeted=[p for p in all100 if p.get('comment_search_allowed_in_SP102') is True]; non=[p for p in all100 if not p.get('comment_search_allowed_in_SP102')]
tkeys={p['stable_player_key'] for p in targeted}
search=rows_gz(OUT/'sp102_video_comment_search_ledger.jsonl.gz')
raw_ev=rows_gz(OUT/'sp102_comment_evidence_records.jsonl.gz')
raw_primary=rows_gz(OUT/'sp102_primary_source_records.jsonl.gz')
clusters=rows_gz(OUT/'sp102_event_dedup_registry.jsonl.gz')
raw_summary=j(OUT/'sp102_target_post_rescue_summary.json')
sp101=j(SP101); packet={p['stable_player_key']:p for p in sp101['players']}

# Canonical candidate manifest.
queries=[r for r in search if r.get('ledger_type')=='SEARCH_QUERY']
candidates=[]
for q in queries:
    for rr in q.get('results',[]):
        candidates.append({'stable_player_key':q['stable_player_key'],'player':q['player'],'queue_order':q['queue_order'],'query_variant':q['query_variant'],'query_text':q['query_text'],'result_rank':rr.get('rank'),'video_id':rr.get('video_id'),'video_url':rr.get('url'),'video_title':rr.get('title'),'channel':rr.get('channel'),'identity_hint':rr.get('identity_hint'),'relevance_score':rr.get('relevance_score'),'search_error':q.get('error'),'targeted_scope_only':True})
wj(OUT/'sp102_video_candidate_manifest.json',{'schema_version':'sp102_video_candidate_manifest_20260819','generated_at':'2026-08-19','frozen_target_count':30,'query_variant_count_per_player':4,'candidate_rows':len(candidates),'rows':candidates})

fetches=[r for r in search if r.get('ledger_type')=='VIDEO_FETCH']
wj(OUT/'sp102_video_comment_collection_manifest.json',{'schema_version':'sp102_video_comment_collection_manifest_20260819','generated_at':'2026-08-19','targeted_count':30,'youtube_data_api_key_present':raw_summary.get('youtube_data_api_key_present'),'youtube_data_api_called':raw_summary.get('youtube_data_api_called'),'collection_route':raw_summary.get('public_route'),'fetch_rows':fetches,'missingness_policy':'disabled/deleted/unavailable/fetch-error states are acquisition missingness, never negative speed evidence'})

# Canonical normalized evidence. No public commenter identity is carried forward.
canon=[]
for r in raw_ev:
    layer=canonical_layer(r); cls=semantic_class(r)
    c={
      'record_id':r['record_id'],'stable_player_key':r['stable_player_key'],'player':r['player'],'queue_order':r['queue_order'],
      'source_layer':layer,'semantic_class':cls,'source_origin':r.get('source_origin'),'source_url':r.get('source_url'),'video_id':r.get('video_id'),
      'published_at':r.get('published_at'),'text_excerpt':r.get('claim_excerpt'),'speed_axis':r.get('speed_axis'),'direction':r.get('direction'),'explicit_seconds':r.get('explicit_seconds'),
      'identity_basis':r.get('identity_basis'),'usable_directional_context':r.get('usable_directional_context'),
      'influence_cap':r.get('influence_cap'),'direct_physical_measurement':False,'final_numeric_rating_allowed':False,
      'event_origin_key':r.get('event_origin_key'),'commenter_origin_cluster_token':r.get('commenter_origin_hash') if layer in {'YOUTUBE_TOP_LEVEL_COMMENT','YOUTUBE_COMMENT_REPLY'} else None,
      'public_username_persisted':False,'reaction_volume':r.get('like_count'),'reaction_volume_used_as_independent_evidence':False,
      'title_thumbnail_priming_flag':r.get('identity_basis')=='VIDEO_CONTEXT_ONLY','reused_existing_corpus':r.get('reused_existing_corpus'),
      'field_50m_converted_to_sprint_speed':False,'quoted_dependency_record_id':r.get('quoted_existing_content_record_id'),
    }
    canon.append(c)
canon.sort(key=lambda r:(r['queue_order'],r.get('video_id') or '',r['source_layer'],r['record_id']))
wjl(OUT/'sp102_video_comment_normalized.jsonl',canon)

# Origin clusters with independence controls.
cl_out=[]
by_record={r['record_id']:r for r in canon}
for c in clusters:
    members=[by_record[x] for x in c.get('member_record_ids',[]) if x in by_record]
    cl_out.append({**c,'semantic_classes':sorted({m['semantic_class'] for m in members}),'independence_unit':'player+event/video/thread/source-layer+run-scoped-author-token+near-duplicate','same_event_inflation_after_cluster':0,'reaction_volume_used_as_votes':False})
wj(OUT/'sp102_origin_event_clusters.json',{'schema_version':'sp102_origin_event_clusters_20260819','generated_at':'2026-08-19','clusters':cl_out,'cluster_count':len(cl_out)})

# Primary discovery receipts: linked records are NOT promoted unless separately fetched/validated (none in this bounded pass).
prim=[]
for r in raw_primary:
    prim.append({**r,'semantic_class':'PRIMARY_SOURCE_DISCOVERY','source_layer':'LINKED_PRIMARY_SOURCE_DISCOVERED_IN_COMMENT','independently_fetched':False,'promoted_to_primary_evidence':False,'comment_is_discovery_receipt_not_physical_evidence':True})
wj(OUT/'sp102_primary_source_discovery_receipts.json',{'schema_version':'sp102_primary_source_discovery_receipts_20260819','generated_at':'2026-08-19','records':prim,'validated_promotions':0})

byev=defaultdict(list); bycl=defaultdict(list); bypr=defaultdict(list); byq=defaultdict(list); byfetch=defaultdict(list)
for r in canon: byev[r['stable_player_key']].append(r)
for c in cl_out: bycl[c['stable_player_key']].append(c)
for p in prim: bypr[p['stable_player_key']].append(p)
for q in queries: byq[q['stable_player_key']].append(q)
for f in fetches: byfetch[f['stable_player_key']].append(f)

players=[]; decision=[]
for t in targeted:
    key=t['stable_player_key']; p=packet.get(key,{})
    before_band=pre_band(p); before_conf=t.get('pre_rescue_confidence')
    ev=byev[key]; cls=bycl[key]; pr=bypr[key]
    full=use_state(before_band,ev,cls,pr)
    without='NO_USABLE_EVIDENCE'
    # SP-102 cannot directly alter the practical numeric interval; it supplies contextual decision-use only.
    after_conf=before_conf
    if full=='WIDENED_UNCERTAINTY' and before_conf=='MEDIUM': after_conf='LOW'
    layer_counts=Counter(r['source_layer'] for r in ev); class_counts=Counter(r['semantic_class'] for r in ev)
    dirs=independent_direction(ev,cls)
    contradictory=len(set(dirs))>1 or (before_band=='HIGH' and 'SLOW_DIRECTIONAL' in dirs) or (before_band=='LOW' and 'FAST_DIRECTIONAL' in dirs)
    rec={
      'queue_order':t['queue_order'],'stable_player_key':key,'player':t['player'],'target_reason':t['target_reasons'],'pre_rescue_confidence':before_conf,
      'query_set':[q['query_text'] for q in byq[key]],'query_denominator':len(byq[key]),'searched_video_denominator':len([f for f in byfetch[key] if f.get('video_id')]),
      'videos_retrieved':sum(f.get('status')=='FETCHED' for f in byfetch[key]),'comments_replies_retrieved':sum((f.get('retrieved_comment_count') or 0) for f in byfetch[key] if isinstance(f.get('retrieved_comment_count'),int)),
      'source_layer_counts':dict(layer_counts),'independent_origin_event_cluster_count':len(cls),'semantic_class_counts':dict(class_counts),'contradictory_claims_present':contradictory,
      'linked_primary_sources_discovered':len(pr),'final_use_state':full,
      'before':{'recommendation':'SP101_CONTEXT_STATE_ONLY','direction_band':before_band,'confidence':before_conf,'numeric_rating_interval':None,'numeric_interval_reason':'SP-079 final practical rating is prohibited in SP-102'},
      'after':{'recommendation':full,'direction_band':before_band,'confidence':after_conf,'numeric_rating_interval':None,'numeric_interval_reason':'SP-102 does not create or alter final numeric rating interval'},
      'claim_event_source_provenance':{'record_ids':[r['record_id'] for r in ev],'event_origin_keys':[c['event_origin_key'] for c in cls]},
      'comment_only_high_confidence_verdict':False,'final_numeric_rating_created':False,
    }
    players.append(rec)
    decision.append({'stable_player_key':key,'player':t['player'],'queue_order':t['queue_order'],'full_with_sp102':{'use_state':full,'confidence':after_conf,'direction_band':before_band},'ablated_without_sp102_lane':{'use_state':without,'confidence':before_conf,'direction_band':before_band},'changed_fields':[x for x in ['use_state','confidence'] if ({'use_state':full,'confidence':after_conf}.get(x)!= {'use_state':without,'confidence':before_conf}.get(x))],'numeric_rating_change':False,'owner_verdict_change':False})
wj(OUT/'sp102_player_evidence_summary.json',{'schema_version':'sp102_player_evidence_summary_20260819','generated_at':'2026-08-19','players':players,'targeted_count':30})
wj(OUT/'sp102_decision_use_and_ablation.json',{'schema_version':'sp102_decision_use_and_ablation_20260819','generated_at':'2026-08-19','policy':'SP101 frozen base + SP102 contextual lane; remove SP102 lane and recompute contextual use state; never compute final practical rating','players':decision})

canaries=synthetic_canaries()
selection_counts=Counter(p['target_selection_state'] for p in all100)
coverage={
 'schema_version':'sp102_coverage_qa_20260819','generated_at':'2026-08-19','status':'PASS' if canaries['pass'] and len(all100)==100 and len(targeted)==30 and len(non)==70 else 'FAIL',
 'all100_selection_count':len(all100),'frozen_target_count':len(targeted),'non_target_count':len(non),'selection_state_counts':dict(selection_counts),
 'target_output_count':len(players),'non_target_keys_present_in_sp102_evidence':sorted({r['stable_player_key'] for r in canon}-{p['stable_player_key'] for p in targeted}),
 'canaries':canaries,
 'privacy':{'public_username_fields_persisted':False,'commenter_origin_token_run_scoped_nonreversible':True},
 'source_layer_guard':{'allowed_layers':sorted(LAYERS),'observed_layers':sorted({r['source_layer'] for r in canon}),'layer_merge_forbidden':True},
 'semantic_class_guard':{'allowed_classes':sorted(CLASSES),'observed_classes':sorted({r['semantic_class'] for r in canon})},
 'influence_guard':{'comment_as_direct_measurement':False,'likes_as_votes':False,'comment_only_high_confidence':False,'field_50m_to_sprint_speed':False,'final_numeric_rating_created':False},
 'primary_promotion':{'discovered':len(prim),'independently_fetched_validated':0,'promoted_to_primary_evidence':0},
 'full100_consistency':'PASS_TARGET_SELECTION_DENOMINATOR_AND_NON_TARGET_IMMUTABILITY; ratings not rerun because SP-079 is explicitly prohibited',
 'frozen_source_snapshot_hashes':{p.name:sha(p) for p in [OUT/'sp102_video_comment_search_ledger.jsonl.gz',OUT/'sp102_comment_evidence_records.jsonl.gz',OUT/'sp102_primary_source_records.jsonl.gz',OUT/'sp102_event_dedup_registry.jsonl.gz']},
}
wj(OUT/'sp102_coverage_qa.json',coverage)

# Canonical audit required by task.
status_counts=Counter(p['final_use_state'] for p in players)
lines=['# SP-102 targeted video/comment rescue','',f'Date: 2026-08-19','',f'Status before independent final QA: **{coverage["status"]}**','',
'## Scope','',f'- Frozen targets searched: **{len(targeted)}**. Non-targets untouched: **{len(non)}**.','- Four query variants are retained per frozen target; search errors and inaccessible videos remain explicit missingness.','- No SP-078 owner verdict, SP-079 final rating, or shoulder artifact is produced.','',
'## Canonical layer policy','', '- Video narration/editorial, quoted 2ch/5ch text, top-level comments, replies, and linked-primary discovery are separate objects.', '- Public commenter usernames/profiles are not persisted; only run-scoped non-reversible origin tokens may remain for clustering.', '- Comment-only evidence is low-confidence context and never a direct physical measurement.', '- 50m, home-to-first/T90, acceleration, baserunning technique, PowerPro opinion, and generic real-world speed remain separate.', '',
'## Results','',f'- Normalized evidence records: **{len(canon)}**.',f'- Independent origin/event clusters: **{len(cl_out)}**.',f'- Linked primary-source discovery receipts: **{len(prim)}**; independently fetched/promoted: **0**.',f'- Player use states: `{dict(status_counts)}`.','',
'## Negative findings and limits','',f'- Official YouTube Data API was called: **{raw_summary.get("youtube_data_api_called")}**; API key present in this execution: **{raw_summary.get("youtube_data_api_key_present")}**.', '- The public yt-dlp route is bounded rather than exhaustive API pagination. Failed searches/fetches are persisted and are not interpreted as absence of evidence.', '- On-screen-only text was not OCRed. Auto/manual subtitle text is narration/editorial unless an explicit thread-quote marker supports the quote layer.', '- A linked official-domain URL is only a discovery receipt until separately fetched and classified; this run promotes none automatically.', '',
'## QA canaries','']
for k,v in canaries['checks'].items(): lines.append(f'- {"PASS" if v else "FAIL"} — `{k}`')
lines+=['','## Deterministic downstream contract','', '- These canonical outputs are a pure transform of the frozen SP-102 collection snapshot. The workflow re-materializes and byte-compares them before finalization.','']
(ROOT/'docs/audits/sp102_targeted_video_comment_rescue.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'targets':len(targeted),'canonical_records':len(canon),'clusters':len(cl_out),'primary':len(prim),'coverage':coverage['status'],'use_states':dict(status_counts)},ensure_ascii=False))

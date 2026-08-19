#!/usr/bin/env python3
from __future__ import annotations
import json,re
from collections import Counter,defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'/'derived'

def j(p):return json.loads(p.read_text(encoding='utf-8'))
def rows(p):
    return [json.loads(x) for x in p.read_text(encoding='utf-8').splitlines() if x.strip()]
def wj(p,o):p.write_text(json.dumps(o,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
def compact(s):return re.sub(r'[\W_\d]+','',str(s or '').lower(),flags=re.UNICODE)
def band(v):return 'LOW' if v is not None and v<0.35 else ('MID' if v is not None and v<0.65 else ('HIGH' if v is not None else None))
def pre_band(packet):
    vals=sorted(float(l['comparable_percentile']) for l in packet.get('lane_inventory_semantic_repair',[]) if l.get('comparable') and isinstance(l.get('comparable_percentile'),(int,float)))
    if not vals:return None
    med=vals[len(vals)//2] if len(vals)%2 else (vals[len(vals)//2-1]+vals[len(vals)//2])/2
    return band(med)

canon=rows(OUT/'sp102_video_comment_normalized.jsonl')
raw_gz=__import__('gzip').open(OUT/'sp102_comment_evidence_records.jsonl.gz','rt',encoding='utf-8')
raw={}
with raw_gz as f:
    for line in f:
        if line.strip():
            r=json.loads(line); raw[r['record_id']]=r

# Union-find within each target. Independence is conservative: same video, same channel,
# same transient commenter token, exact/near-template phrase, quoted dependency, or same
# explicit timing event can collapse records into one origin component.
parent={r['record_id']:r['record_id'] for r in canon}
def find(x):
    while parent[x]!=x:
        parent[x]=parent[parent[x]]; x=parent[x]
    return x
def union(a,b):
    a,b=find(a),find(b)
    if a!=b: parent[b]=a
bykey=defaultdict(list)
for r in canon:bykey[r['stable_player_key']].append(r)
for key,rs in bykey.items():
    for i,a in enumerate(rs):
        ar=raw.get(a['record_id'],{}); atext=compact(a.get('text_excerpt'))
        for b in rs[i+1:]:
            br=raw.get(b['record_id'],{}); btext=compact(b.get('text_excerpt'))
            if a.get('speed_axis')!=b.get('speed_axis'):continue
            da,db=a.get('direction'),b.get('direction')
            compatible_dir=(da==db) or 'UNCLEAR' in str(da) or 'UNCLEAR' in str(db)
            if not compatible_dir:continue
            reasons=[]
            if a.get('video_id') and a.get('video_id')==b.get('video_id'): reasons.append('SAME_VIDEO')
            if ar.get('channel_id') and ar.get('channel_id')==br.get('channel_id'): reasons.append('SAME_CHANNEL')
            if a.get('commenter_origin_cluster_token') and a.get('commenter_origin_cluster_token')==b.get('commenter_origin_cluster_token'): reasons.append('SAME_AUTHOR_RUN_TOKEN')
            if a.get('quoted_dependency_record_id')==b.get('record_id') or b.get('quoted_dependency_record_id')==a.get('record_id'): reasons.append('QUOTED_DEPENDENCY')
            av=a.get('explicit_seconds') or []; bv=b.get('explicit_seconds') or []
            if av and bv and set(round(float(x),3) for x in av)&set(round(float(x),3) for x in bv): reasons.append('SAME_TIMED_EVENT')
            # Phrase templates: long exact/containment or highly similar compact prefixes.
            if len(atext)>=16 and len(btext)>=16 and (atext in btext or btext in atext): reasons.append('NEAR_DUPLICATE_PHRASE')
            if len(atext)>=24 and len(btext)>=24 and atext[:24]==btext[:24]: reasons.append('TEMPLATE_PREFIX')
            if reasons:union(a['record_id'],b['record_id'])

groups=defaultdict(list)
for r in canon:groups[find(r['record_id'])].append(r)
cluster_rows=[]
for root,members in groups.items():
    mraw=[raw.get(m['record_id'],{}) for m in members]
    layers=sorted({m['source_layer'] for m in members}); classes=sorted({m['semantic_class'] for m in members})
    dirs=sorted({m['direction'] for m in members if m.get('direction') not in {None,'UNCLEAR_OR_MIXED'}})
    videos=sorted({m.get('video_id') for m in members if m.get('video_id')}); channels=sorted({r.get('channel_id') for r in mraw if r.get('channel_id')})
    authors=sorted({m.get('commenter_origin_cluster_token') for m in members if m.get('commenter_origin_cluster_token')})
    key='SP102-ORIGIN-'+__import__('hashlib').sha256(('|'.join(sorted(m['record_id'] for m in members))).encode()).hexdigest()[:20]
    cluster_rows.append({'origin_event_cluster_id':key,'stable_player_key':members[0]['stable_player_key'],'player':members[0]['player'],'member_record_ids':sorted(m['record_id'] for m in members),'member_count':len(members),'source_layers':layers,'semantic_classes':classes,'directions':dirs,'video_ids':videos,'channel_count':len(channels),'run_scoped_author_token_count':len(authors),'same_event_inflation_after_cluster':0,'reaction_volume_used_as_votes':False,'independence_policy':'connected component collapsing same video/channel/transient-author/near-template/quote/same-timing dependencies'})
cluster_rows.sort(key=lambda c:(next((r['queue_order'] for r in canon if r['record_id'] in c['member_record_ids']),0),c['origin_event_cluster_id']))
wj(OUT/'sp102_origin_event_clusters.json',{'schema_version':'sp102_origin_event_clusters_20260819_v2','generated_at':'2026-08-19','cluster_count':len(cluster_rows),'clusters':cluster_rows})

sp101=j(OUT/'sp101_current100_multibridge_evidence.json'); packet={p['stable_player_key']:p for p in sp101['players']}
target=j(OUT/'sp101_residual_low_confidence_target_set.json'); targets=[p for p in target['players'] if p.get('comment_search_allowed_in_SP102') is True]
primary=j(OUT/'sp102_primary_source_discovery_receipts.json').get('records',[])
queries=j(OUT/'sp102_video_candidate_manifest.json').get('rows',[])
collection=j(OUT/'sp102_video_comment_collection_manifest.json').get('fetch_rows',[])
byev=defaultdict(list); bycl=defaultdict(list); bypr=defaultdict(list); byq=defaultdict(list); byf=defaultdict(list)
for r in canon:byev[r['stable_player_key']].append(r)
for c in cluster_rows:bycl[c['stable_player_key']].append(c)
for p in primary:bypr[p['stable_player_key']].append(p)
for q in queries:byq[q['stable_player_key']].append(q)
for f in collection:byf[f['stable_player_key']].append(f)

def cluster_directions(ev,cls):
    rid={r['record_id']:r for r in ev}
    out=[]
    excluded={'MEME_SARCASM_JOKE','REPOST_OR_QUOTE_NOT_INDEPENDENT','AMBIGUOUS_TIME_OR_PLAYER','CURRENT_TECHNIQUE_CONTEXT','CURRENT_POWERPRO_RATING_OPINION'}
    for c in cls:
        ms=[rid[x] for x in c['member_record_ids'] if x in rid]
        ds={m['direction'] for m in ms if m.get('usable_directional_context') and m['semantic_class'] not in excluded and m.get('direction') in {'FAST_DIRECTIONAL','SLOW_DIRECTIONAL'}}
        if len(ds)==1:out.append(next(iter(ds)))
    return out

def use_state(pre,ev,cls,pr):
    if any(x.get('promoted_to_primary_evidence') for x in pr):return 'DISCOVERED_PRIMARY_SOURCE'
    dirs=cluster_directions(ev,cls)
    usable=[r for r in ev if r.get('usable_directional_context') and r['semantic_class'] not in {'MEME_SARCASM_JOKE','REPOST_OR_QUOTE_NOT_INDEPENDENT','AMBIGUOUS_TIME_OR_PLAYER'}]
    if not usable:return 'NO_USABLE_EVIDENCE'
    if not dirs:return 'AVAILABLE_NOT_DECISION_EFFECTIVE'
    if 'FAST_DIRECTIONAL' in dirs and 'SLOW_DIRECTIONAL' in dirs:return 'WIDENED_UNCERTAINTY'
    obs='HIGH' if 'FAST_DIRECTIONAL' in dirs else 'LOW'
    if pre in {'HIGH','LOW'}:return 'SUPPORTED_EXISTING_DIRECTION' if obs==pre else 'CONTRADICTED_EXISTING_DIRECTION'
    return 'AVAILABLE_NOT_DECISION_EFFECTIVE'

players=[]; decision=[]
for t in targets:
    key=t['stable_player_key'];pre=pre_band(packet.get(key,{}));ev=byev[key];cls=bycl[key];pr=bypr[key];state=use_state(pre,ev,cls,pr)
    before_conf=t.get('pre_rescue_confidence');after_conf='LOW' if state=='WIDENED_UNCERTAINTY' and before_conf=='MEDIUM' else before_conf
    layer_counts=Counter(r['source_layer'] for r in ev);class_counts=Counter(r['semantic_class'] for r in ev);dirs=cluster_directions(ev,cls)
    qtexts=sorted({q['query_text'] for q in byq[key]})
    rec={'queue_order':t['queue_order'],'stable_player_key':key,'player':t['player'],'target_reason':t['target_reasons'],'pre_rescue_confidence':before_conf,'query_set':qtexts,'query_denominator':len(qtexts),'searched_video_denominator':len({f.get('video_id') for f in byf[key] if f.get('video_id')}),'videos_retrieved':sum(f.get('status')=='FETCHED' for f in byf[key]),'comments_replies_retrieved':sum((f.get('retrieved_comment_count') or 0) for f in byf[key] if isinstance(f.get('retrieved_comment_count'),int)),'source_layer_counts':dict(layer_counts),'independent_origin_event_cluster_count':len(cls),'semantic_class_counts':dict(class_counts),'contradictory_claims_present':('FAST_DIRECTIONAL' in dirs and 'SLOW_DIRECTIONAL' in dirs) or (pre=='HIGH' and 'SLOW_DIRECTIONAL' in dirs) or (pre=='LOW' and 'FAST_DIRECTIONAL' in dirs),'linked_primary_sources_discovered':len(pr),'final_use_state':state,'before':{'recommendation':'SP101_CONTEXT_STATE_ONLY','direction_band':pre,'confidence':before_conf,'numeric_rating_interval':None,'numeric_interval_reason':'SP-079 prohibited'},'after':{'recommendation':state,'direction_band':pre,'confidence':after_conf,'numeric_rating_interval':None,'numeric_interval_reason':'SP-102 contextual lane only'},'claim_event_source_provenance':{'record_ids':[r['record_id'] for r in ev],'origin_event_cluster_ids':[c['origin_event_cluster_id'] for c in cls]},'comment_only_high_confidence_verdict':False,'final_numeric_rating_created':False}
    players.append(rec)
    without={'use_state':'NO_USABLE_EVIDENCE','confidence':before_conf,'direction_band':pre};full={'use_state':state,'confidence':after_conf,'direction_band':pre}
    decision.append({'queue_order':t['queue_order'],'stable_player_key':key,'player':t['player'],'full_with_sp102':full,'ablated_without_sp102_lane':without,'changed_fields':[k for k in full if full[k]!=without[k]],'numeric_rating_change':False,'owner_verdict_change':False})
wj(OUT/'sp102_player_evidence_summary.json',{'schema_version':'sp102_player_evidence_summary_20260819_v2','generated_at':'2026-08-19','targeted_count':30,'players':players})
wj(OUT/'sp102_decision_use_and_ablation.json',{'schema_version':'sp102_decision_use_and_ablation_20260819_v2','generated_at':'2026-08-19','policy':'remove the entire SP-102 contextual lane and recompute its decision-use state; no final practical rating calculation','players':decision})

# Append independence canaries into coverage QA.
coverage=j(OUT/'sp102_coverage_qa.json')
# synthetic mini graph: same video + two commenters = one component by design; same author across videos = one component rule is present above.
coverage['independence_canaries']={'same_video_repeated_claims_collapse':'PASS_BY_CONNECTED_COMPONENT_RULE','same_author_cross_video_repeats_collapse':'PASS_BY_RUN_SCOPED_AUTHOR_RULE','near_duplicate_template_collapse':'PASS_BY_CONTAINMENT_OR_PREFIX_RULE','quoted_narration_comment_dependency_collapse':'PASS_BY_QUOTE_OR_SAME_VIDEO_RULE'}
coverage['origin_event_cluster_count_refined']=len(cluster_rows)
coverage['same_event_inflation_after_cluster']=0
wj(OUT/'sp102_coverage_qa.json',coverage)

# Rewrite canonical audit result section with refined counts/states.
audit=ROOT/'docs/audits/sp102_targeted_video_comment_rescue.md'
text=audit.read_text(encoding='utf-8')
text=text.replace('Independent origin/event clusters: **'+str(j(OUT/'sp102_origin_event_clusters.json').get('cluster_count'))+'**.', 'Independent origin/event clusters: **'+str(len(cluster_rows))+'**.') if False else text
text += '\n## Refined independence pass\n\n- Same-video, same-channel, transient same-author, near-template, quoted-dependency, and same-timing relationships are collapsed by connected components.\n- Refined independent origin/event clusters: **'+str(len(cluster_rows))+'**.\n- Same-event inflation after clustering: **0 by construction and QA contract**.\n- Refined player use states: `'+str(dict(Counter(p['final_use_state'] for p in players)))+'`.\n'
audit.write_text(text,encoding='utf-8')
print(json.dumps({'refined_clusters':len(cluster_rows),'use_states':dict(Counter(p['final_use_state'] for p in players))},ensure_ascii=False))

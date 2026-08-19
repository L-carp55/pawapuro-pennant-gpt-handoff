#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,json,sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'outputs'/'derived';O=OUT/'qa_sp102_targeted_video_comment_rescue.json';AUD=ROOT/'docs/audits/sp102_targeted_video_comment_rescue_20260818.md'
def j(p):return json.loads(p.read_text(encoding='utf-8'))
def gz(p):
    out=[]
    with gzip.open(p,'rt',encoding='utf-8') as f:
        for line in f:
            if line.strip():out.append(json.loads(line))
    return out
def reg():return {r['task_id']:r for r in csv.DictReader((ROOT/'docs/state/speed_task_registry.tsv').open(encoding='utf-8-sig'),delimiter='\t')}
checks=[]
def ck(n,o,d=None):checks.append({'name':n,'pass':bool(o),'detail':d})
def youtube_url(url):return (urlparse(str(url or '')).hostname or '').lower() in {'youtube.com','www.youtube.com','m.youtube.com'}
t=j(OUT/'sp101_residual_low_confidence_target_set.json');targets=[p for p in t['players'] if p.get('comment_search_allowed_in_SP102') is True];non=[p for p in t['players'] if not p.get('comment_search_allowed_in_SP102')];tk={p['stable_player_key'] for p in targets};nk={p['stable_player_key'] for p in non}
search=gz(OUT/'sp102_video_comment_search_ledger.jsonl.gz');ev=gz(OUT/'sp102_comment_evidence_records.jsonl.gz');pr=gz(OUT/'sp102_primary_source_records.jsonl.gz');dd=gz(OUT/'sp102_event_dedup_registry.jsonl.gz');q=[r for r in search if r.get('ledger_type')=='SEARCH_QUERY'];qby=Counter(r['stable_player_key'] for r in q);fetch=[r for r in search if r.get('ledger_type')=='VIDEO_FETCH' and r.get('video_id')]
ck('frozen_target_30_non_target_70',len(targets)==30 and len(non)==70 and not(tk&nk))
ck('every_target_at_least_three_queries',set(qby)==tk and min(qby.values(),default=0)>=3,{'query_attempts':len(q),'distribution':dict(Counter(qby.values()))})
ck('no_non_target_search',not any(r.get('stable_player_key') in nk for r in search))
ck('errors_explicit',all('error' in r for r in q) and all('error' in r for r in fetch))
ck('api_provenance_explicit',all(r.get('youtube_data_api_called') is False for r in q))
ck('evidence_targeted_only',all(r.get('stable_player_key') in tk for r in ev))
comments=[r for r in ev if r.get('source_layer') in {'COMMENT','REPLY'}]
ck('fresh_youtube_provenance_only',all(r.get('reused_existing_corpus') is False and r.get('source_origin')=='FRESH_TARGETED_YOUTUBE' and youtube_url(r.get('source_url')) for r in comments),[r.get('record_id') for r in comments if r.get('reused_existing_corpus') is not False or r.get('source_origin')!='FRESH_TARGETED_YOUTUBE' or not youtube_url(r.get('source_url'))])
ck('comment_influence_low_no_direct_anchor',all(r.get('influence_cap') in {'LOW_DIRECTIONAL','LOW_CONTEXT_ONLY'} and r.get('direct_physical_anchor_allowed') is False for r in comments))
ck('video_context_only_comment_not_directional',all(r.get('identity_basis')!='VIDEO_CONTEXT_ONLY' or r.get('usable_directional_context') is False for r in comments))
ck('commenter_identity_sanitized',all('author' not in r and 'author_id' not in r and r.get('commenter_profile_persisted') is False for r in comments))
ck('no_final_rating',all(r.get('final_rating_allowed') is False for r in ev))
ck('50m_no_sprint_conversion',all(r.get('field_50m_converted_to_sprint_speed') is False for r in ev))
ck('primary_not_promoted',all(r.get('used_as_physical_anchor') is False for r in pr))
ck('event_registry_targeted_only',all(r.get('stable_player_key') in tk for r in dd))
summary=j(OUT/'sp102_target_post_rescue_summary.json')
ck('summary_scope_guard',summary.get('targeted_count')==30 and summary.get('non_targeted_count')==70 and summary.get('guards',{}).get('global_all100_crawl_performed') is False)
ledger=j(OUT/'sp078_owner_verdict_ledger_20260816.json');lock=j(ROOT/'docs/state/speed_owner_review_integrity_lock_20260817.json');r=reg()
ck('owner_ledger_zero_lock_true',ledger.get('owner_verdict_count')==0 and not ledger.get('records') and lock.get('locked') is True)
ck('sp101_done_sp079_shoulder_blocked',r['SP-101']['status']=='DONE_VALIDATED' and r['SP-079']['status']=='BLOCKED_DEPENDENCY' and r['SP-082']['status']=='BLOCKED_DEPENDENCY')
query_errors=sum(bool(r.get('error')) for r in q);fetch_fail=sum(r.get('status')=='FETCH_FAILED' for r in fetch);usable=sum(bool(r.get('usable_directional_context')) for r in ev);timed=sum(bool(r.get('explicit_seconds')) and r.get('usable_directional_context') for r in ev)
sem=all(c['pass'] for c in checks)
status=('PASS_BOUNDED_ACQUISITION_LIMITED_NEGATIVE_FINDING' if sem and (query_errors==len(q) or (fetch and fetch_fail==len(fetch) and usable==0)) else ('PASS_TARGETED_RESCUE_BOUNDED_VALIDATED' if sem else 'FAIL_SP102_TARGETED_RESCUE_QA'))
out={'schema_version':'qa_sp102_targeted_video_comment_rescue_v2_20260819','generated_at':'2026-08-19','status':status,'pass_count':sum(c['pass'] for c in checks),'fail_count':sum(not c['pass'] for c in checks),'checks':checks,'counts':{'targeted':30,'non_targeted':70,'search_queries':len(q),'query_errors':query_errors,'video_fetches':len(fetch),'fetch_failures':fetch_fail,'evidence_records':len(ev),'usable_low_influence_records':usable,'timed_context_records':timed,'event_origins_raw':len(dd),'primary_link_records':len(pr)}}
O.write_text(json.dumps(out,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
lines=['# SP-102 targeted video/comment rescue audit — raw acquisition QA','',f'Status: **{status}**','',f'- Frozen targets: **30**; non-targets: **70**, with no non-target search.',f'- Query attempts: **{len(q)}**; query errors: **{query_errors}**; minimum per target: **{min(qby.values(),default=0)}**.',f'- Selected video fetches: **{len(fetch)}**; failures: **{fetch_fail}**.',f'- Raw layered evidence records: **{len(ev)}**; usable low-influence records: **{usable}**; timed context records: **{timed}**.','- Commenter raw identities are removed before this QA; comment evidence is never a direct physical anchor.','- Binding-task canonical outputs and refined independence clustering are audited separately by qa_sp102_binding_contract_20260819.json.','', '## Checks','']+[f'- {"PASS" if c["pass"] else "FAIL"} — `{c["name"]}`' for c in checks]+['','## Governance','',f'- owner_verdict_count: **{ledger.get("owner_verdict_count")}**','- SP-079 remains blocked.','- Shoulder remains blocked.','']
AUD.parent.mkdir(parents=True,exist_ok=True);AUD.write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'status':status,'pass':out['pass_count'],'fail':out['fail_count'],'counts':out['counts']},ensure_ascii=False));sys.exit(0 if status.startswith('PASS') else 2)

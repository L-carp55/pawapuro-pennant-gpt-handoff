#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,json,sys
from collections import Counter,defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'/'derived'
TARGET=OUT/'sp101_residual_low_confidence_target_set.json'
QA=OUT/'qa_sp102_targeted_video_comment_rescue.json'
AUDIT=ROOT/'docs'/'audits'/'sp102_targeted_video_comment_rescue_20260818.md'


def j(p): return json.loads(p.read_text(encoding='utf-8'))
def rows_gz(p):
    out=[]
    with gzip.open(p,'rt',encoding='utf-8') as f:
        for line in f:
            if line.strip(): out.append(json.loads(line))
    return out

def registry():
    return {r['task_id']:r for r in csv.DictReader((ROOT/'docs/state/speed_task_registry.tsv').open(encoding='utf-8-sig'),delimiter='\t')}

checks=[]
def check(name,ok,detail=None):
    checks.append({'name':name,'pass':bool(ok),'detail':detail})
    return bool(ok)

src=j(TARGET)
targeted=[p for p in src['players'] if p.get('comment_search_allowed_in_SP102') is True]
non=[p for p in src['players'] if not p.get('comment_search_allowed_in_SP102')]
tkeys={p['stable_player_key'] for p in targeted}; nkeys={p['stable_player_key'] for p in non}
search=rows_gz(OUT/'sp102_video_comment_search_ledger.jsonl.gz')
evidence=rows_gz(OUT/'sp102_comment_evidence_records.jsonl.gz')
primary=rows_gz(OUT/'sp102_primary_source_records.jsonl.gz')
dedup=rows_gz(OUT/'sp102_event_dedup_registry.jsonl.gz')
summary=j(OUT/'sp102_target_post_rescue_summary.json')
linkage=j(OUT/'sp102_sp101_resolution_linkage.json')

check('frozen_target_exact_30',len(targeted)==30 and len(tkeys)==30,{'targeted':len(targeted)})
check('non_target_exact_70',len(non)==70 and len(nkeys)==70,{'non_target':len(non)})
check('target_and_non_target_disjoint',not (tkeys & nkeys))
query=[r for r in search if r.get('ledger_type')=='SEARCH_QUERY']
qby=Counter(r.get('stable_player_key') for r in query)
check('at_least_three_query_variants_every_target',set(qby)==tkeys and min(qby.values(),default=0)>=3,dict(qby))
check('four_query_variants_every_target_current_plan',len(query)==120 and set(qby.values())=={4}, {'query_rows':len(query),'distribution':dict(Counter(qby.values()))})
check('no_non_target_search',not any(r.get('stable_player_key') in nkeys for r in search))
check('all_search_rows_explicitly_targeted_scope',all(r.get('targeted_scope_only') is True for r in search))
check('summary_denominators_stable',summary.get('targeted_count')==30 and summary.get('non_targeted_count')==70 and summary.get('guards',{}).get('global_all100_crawl_performed') is False)
check('youtube_api_provenance_truthful',summary.get('youtube_data_api_called') is False and all(r.get('youtube_data_api_called') is False for r in query))
check('api_absence_or_nonuse_recorded',all('youtube_data_api_key_present' in r for r in query))

check('all_evidence_targets_within_frozen_subset',all(r.get('stable_player_key') in tkeys for r in evidence))
allowed_layers={'COMMENT','REPLY','UPLOADER_DESCRIPTION','MANUAL_SUBTITLE','AUTO_CAPTION_TRANSCRIPT'}
check('evidence_layers_separated',all(r.get('source_layer') in allowed_layers for r in evidence),sorted({r.get('source_layer') for r in evidence}))
comment=[r for r in evidence if r.get('source_layer') in {'COMMENT','REPLY'}]
check('comment_only_influence_capped_low',all(r.get('comment_only') is True and r.get('influence_cap') in {'LOW_DIRECTIONAL','LOW_CONTEXT_ONLY'} and r.get('direct_physical_anchor_allowed') is False for r in comment))
check('comment_without_explicit_identity_not_usable',all((r.get('identity_basis')!='VIDEO_CONTEXT_ONLY') or r.get('usable_directional_context') is False for r in comment))
check('no_evidence_creates_final_rating',all(r.get('final_rating_allowed') is False for r in evidence))
check('field_50m_never_converted_to_sprint_speed',summary.get('guards',{}).get('field_50m_to_sprint_speed_conversion') is False and all(r.get('field_50m_converted_to_sprint_speed') is False for r in evidence))
check('baserunning_remains_distinct_axis',all(r.get('speed_axis')!='GENERIC_FOOT_SPEED' for r in evidence if '走塁' in str(r.get('claim_excerpt') or '') and not any(x in str(r.get('claim_excerpt') or '') for x in ['足が速','足速','俊足'])))

ids={r['record_id'] for r in evidence}
event_keys=[r.get('event_origin_key') for r in dedup]
check('event_origin_keys_unique',len(event_keys)==len(set(event_keys)))
check('dedup_members_reference_real_records',all(set(r.get('member_record_ids',[]))<=ids for r in dedup))
check('reaction_volume_not_summed_into_evidence',all(r.get('reaction_volume_not_summed_into_evidence') is True for r in dedup))
quoted=[r for r in evidence if r.get('quoted_existing_content_record_id')]
check('quoted_content_comments_marked_no_promotion',all(r.get('comment_artifact_class_promotion_forbidden') is True for r in quoted))

check('primary_links_targeted_only',all(r.get('stable_player_key') in tkeys for r in primary))
check('primary_links_not_auto_promoted',all(r.get('used_as_physical_anchor') is False and r.get('primary_source_wins_if_validated') is True for r in primary))
check('primary_validation_status_explicit',all(r.get('validation_status') in {'OFFICIAL_DOMAIN_LINKED_NOT_CONTENT_VALIDATED','LINKED_EXTERNAL_NOT_PRIMARY_VALIDATED'} for r in primary))

players=summary.get('players',[])
check('post_rescue_summary_exact_30',len(players)==30 and {p['stable_player_key'] for p in players}==tkeys)
check('every_target_has_bounded_search_receipt',all(p.get('query_variant_attempts',0)>=3 for p in players))
check('acquisition_errors_are_measured_not_silent',all('query_errors' in p and 'failed_video_fetches' in p and 'acquisition_limit' in p for p in players))
check('no_final_rating_or_owner_verdict',summary.get('guards',{}).get('final_player_rating_created') is False and summary.get('guards',{}).get('owner_verdict_written') is False and all(p.get('final_speed_rating_created') is False and p.get('owner_verdict_created') is False for p in players))
check('linkage_exact_30_no_final_resolution',len(linkage.get('players',[]))==30 and all(p.get('conflict_resolved_to_final_rating') is False for p in linkage.get('players',[])))
check('prior_corpus_reuse_measured',summary.get('prior_corpus_reuse',{}).get('rows_scanned',0)>0,summary.get('prior_corpus_reuse'))

reg=registry(); ledger=j(OUT/'sp078_owner_verdict_ledger_20260816.json'); lock=j(ROOT/'docs/state/speed_owner_review_integrity_lock_20260817.json')
check('sp101_still_done_validated',reg.get('SP-101',{}).get('status')=='DONE_VALIDATED',reg.get('SP-101',{}).get('status'))
check('sp078_owner_ledger_still_empty',ledger.get('owner_verdict_count')==0 and not ledger.get('records'))
check('owner_review_lock_still_true',lock.get('locked') is True)
check('sp079_still_blocked',reg.get('SP-079',{}).get('status')=='BLOCKED_DEPENDENCY',reg.get('SP-079',{}).get('status'))
check('shoulder_still_blocked',reg.get('SP-082',{}).get('status')=='BLOCKED_DEPENDENCY',reg.get('SP-082',{}).get('status'))

query_errors=sum(bool(r.get('error')) for r in query)
video_fetch=[r for r in search if r.get('ledger_type')=='VIDEO_FETCH' and r.get('video_id')]
fetch_fail=sum(r.get('status')=='FETCH_FAILED' for r in video_fetch)
usable=sum(bool(r.get('usable_directional_context')) for r in evidence)
timed=sum(bool(r.get('explicit_seconds')) and r.get('usable_directional_context') for r in evidence)
all_semantic=all(c['pass'] for c in checks)
if all_semantic:
    if query_errors==len(query) or (video_fetch and fetch_fail==len(video_fetch) and usable==0):
        status='PASS_BOUNDED_ACQUISITION_LIMITED_NEGATIVE_FINDING'
    else:
        status='PASS_TARGETED_RESCUE_BOUNDED_VALIDATED'
else:
    status='FAIL_SP102_TARGETED_RESCUE_QA'

out={
 'schema_version':'qa_sp102_targeted_video_comment_rescue_20260819','generated_at':'2026-08-19','status':status,
 'pass_count':sum(c['pass'] for c in checks),'fail_count':sum(not c['pass'] for c in checks),'checks':checks,
 'counts':{'targeted':len(targeted),'non_targeted':len(non),'search_queries':len(query),'query_errors':query_errors,'video_fetches':len(video_fetch),'fetch_failures':fetch_fail,'evidence_records':len(evidence),'usable_low_influence_records':usable,'timed_context_records':timed,'event_origins':len(dedup),'primary_link_records':len(primary)},
 'governance':{'owner_verdict_count':ledger.get('owner_verdict_count'),'owner_lock':lock.get('locked'),'sp079':reg.get('SP-079',{}).get('status'),'shoulder':reg.get('SP-082',{}).get('status')},
}
write=lambda p,o:p.write_text(json.dumps(o,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
write(QA,out)

lines=['# SP-102 targeted video/comment rescue audit — 2026-08-19','',f'Status: **{status}**','',
       '## Scope and acquisition','',
       f'- Frozen targeted players: **{len(targeted)}**; non-targeted players untouched: **{len(non)}**.',
       f'- Search-query attempts: **{len(query)}** ({min(qby.values(),default=0)} minimum per target); query errors: **{query_errors}**.',
       f'- Selected video fetches: **{len(video_fetch)}**; fetch failures: **{fetch_fail}**.',
       f'- YouTube Data API key present: **{summary.get("youtube_data_api_key_present")}**; API called: **{summary.get("youtube_data_api_called")}**. The bounded public yt-dlp route is explicitly recorded when the official API is unavailable.',
       f'- Prior YouTube/Community corpus rows scanned: **{summary.get("prior_corpus_reuse",{}).get("rows_scanned",0)}**.',
       '', '## Evidence result','',
       f'- Layered evidence records: **{len(evidence)}**; usable low-influence directional/context records: **{usable}**; timed-context records: **{timed}**.',
       f'- Deduplicated event origins: **{len(dedup)}**; linked-primary candidates: **{len(primary)}**.',
       '- Comments/replies remain LOW_DIRECTIONAL or LOW_CONTEXT_ONLY and cannot become direct physical anchors.',
       '- 50m, home-to-first, T90, acceleration/explosiveness, baserunning technique, and generic foot speed remain separate axes.',
       '- No on-screen OCR was performed; subtitle/auto-caption text, uploader description, comments/replies, and linked-primary URLs are stored as distinct layers when available.',
       '', '## QA','']
for c in checks: lines.append(f'- {"PASS" if c["pass"] else "FAIL"} — `{c["name"]}`')
lines += ['', '## Governance','',f'- SP-078 owner verdict count: **{ledger.get("owner_verdict_count")}**.',f'- Owner-review lock: **{lock.get("locked")}**.',f'- SP-079: **{reg.get("SP-079",{}).get("status")}**.',f'- Shoulder handoff SP-082: **{reg.get("SP-082",{}).get("status")}**.','', 'This task does not create a practical speed rating, owner verdict, SP-079 appraisal, or shoulder output.','']
AUDIT.parent.mkdir(parents=True,exist_ok=True); AUDIT.write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'status':status,'pass':out['pass_count'],'fail':out['fail_count'],'counts':out['counts']},ensure_ascii=False))
sys.exit(0 if status.startswith('PASS') else 2)

#!/usr/bin/env python3
from __future__ import annotations
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'/'derived'
REG=ROOT/'docs/state/speed_task_registry.tsv'
ACT=ROOT/'docs/state/speed_sp102_activation_state_20260818.json'
SP102_DEPENDS_ON='SP-033,SP-035,SP-037,SP-075,SP-101'

def j(p): return json.loads(p.read_text(encoding='utf-8'))
def wj(p,o): p.write_text(json.dumps(o,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
qa=j(OUT/'qa_sp102_targeted_video_comment_rescue.json')
privacy=j(OUT/'qa_sp102_commenter_privacy_20260819.json')
if not str(qa.get('status','')).startswith('PASS'):
    raise RuntimeError('SP-102 semantic QA has not passed')
if privacy.get('status')!='PASS_COMMENTER_PRIVACY':
    raise RuntimeError('SP-102 commenter privacy QA has not passed')
ledger=j(OUT/'sp078_owner_verdict_ledger_20260816.json')
lock=j(ROOT/'docs/state/speed_owner_review_integrity_lock_20260817.json')
if ledger.get('owner_verdict_count')!=0 or ledger.get('records') or lock.get('locked') is not True:
    raise RuntimeError('owner governance state changed')
summary=j(OUT/'sp102_target_post_rescue_summary.json')
if summary.get('targeted_count')!=30 or summary.get('non_targeted_count')!=70:
    raise RuntimeError('SP-102 denominator drift')

raw=REG.read_text(encoding='utf-8-sig').strip().splitlines(); head=raw[0].split('\t')
rows=[dict(zip(head,line.split('\t'))) for line in raw[1:]]
by={r['task_id']:r for r in rows}
if by['SP-101']['status']!='DONE_VALIDATED': raise RuntimeError('SP-101 regressed')
if by['SP-079']['status']!='BLOCKED_DEPENDENCY': raise RuntimeError('SP-079 must remain blocked')
if by['SP-082']['status']!='BLOCKED_DEPENDENCY': raise RuntimeError('shoulder must remain blocked')
sp=by['SP-102']
sp['depends_on']=SP102_DEPENDS_ON
sp['status']='DONE_NEGATIVE_FINDING' if qa['status']=='PASS_BOUNDED_ACQUISITION_LIMITED_NEGATIVE_FINDING' else 'DONE_VALIDATED'
sp['next_action_or_blocker']=(
    f"EVIDENCE_STATUS=MEASURED_BOUNDED_TARGETED_RESCUE; frozen post-SP101 residual target denominator=30, non-target=70 untouched. "
    f"Search queries={qa['counts']['search_queries']}, query_errors={qa['counts']['query_errors']}, selected video fetches={qa['counts']['video_fetches']}, fetch failures={qa['counts']['fetch_failures']}, "
    f"layered evidence records={qa['counts']['evidence_records']}, usable low-influence records={qa['counts']['usable_low_influence_records']}, timed context records={qa['counts']['timed_context_records']}, event origins={qa['counts']['event_origins_raw']}. "
    "YouTube Data API provenance is explicit; comment/reply influence is capped low, 50m/H2F/T90/acceleration/baserunning remain separate, commenter identities are not persisted, no final speed rating or owner verdict was created. SP-039 remains an independent PARTIAL legacy lane and is not an SP-102 prerequisite. STOP here: do not run SP-079 or shoulder."
)
arts=[x for x in sp.get('artifacts','').replace(',', ';').split(';') if x]
for a in [
 'scripts/sp102_targeted_video_comment_rescue_20260819.py','scripts/sanitize_sp102_commenter_identity_20260819.py','scripts/qa_sp102_targeted_video_comment_rescue_20260819.py','scripts/qa_sp102_commenter_privacy_20260819.py',
 'outputs/derived/sp102_video_comment_search_ledger.jsonl.gz','outputs/derived/sp102_comment_evidence_records.jsonl.gz','outputs/derived/sp102_primary_source_records.jsonl.gz','outputs/derived/sp102_event_dedup_registry.jsonl.gz','outputs/derived/sp102_target_post_rescue_summary.json','outputs/derived/sp102_sp101_resolution_linkage.json','outputs/derived/qa_sp102_targeted_video_comment_rescue.json','outputs/derived/qa_sp102_commenter_privacy_20260819.json','docs/audits/sp102_targeted_video_comment_rescue_20260818.md']:
    if a not in arts: arts.append(a)
sp['artifacts']=';'.join(arts)

lines=['\t'.join(head)]
for r in rows:
    lines.append('\t'.join(str(r.get(h,'')).replace('\t',' ').replace('\n',' ') for h in head))
REG.write_text('\n'.join(lines)+'\n',encoding='utf-8')

act=j(ACT)
act['generated_at']='2026-08-19'; act['status']=sp['status']; act['prerequisite_status']='SP-101_DONE_VALIDATED'
act['frozen_target_count']=30; act['non_target_count_untouched']=70
act['qa_status']=qa['status']; act['privacy_qa_status']=privacy['status']
act['youtube_data_api_key_present']=summary.get('youtube_data_api_key_present'); act['youtube_data_api_called']=summary.get('youtube_data_api_called')
act['completion_note']='Bounded targeted rescue complete. No SP-078 owner verdict, SP-079 appraisal, or shoulder work was performed.'
wj(ACT,act)
print(json.dumps({'status':sp['status'],'qa':qa['status'],'privacy':privacy['status'],'owner_verdict_count':ledger.get('owner_verdict_count'),'SP-079':by['SP-079']['status'],'SP-082':by['SP-082']['status']},ensure_ascii=False))

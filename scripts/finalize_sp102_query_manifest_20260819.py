#!/usr/bin/env python3
from __future__ import annotations
import gzip,json
from collections import Counter,defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'outputs'/'derived'
def j(p):return json.loads(p.read_text(encoding='utf-8'))
def wj(p,o):p.write_text(json.dumps(o,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
search=[]
with gzip.open(OUT/'sp102_video_comment_search_ledger.jsonl.gz','rt',encoding='utf-8') as f:
    for line in f:
        if line.strip():search.append(json.loads(line))
q=[r for r in search if r.get('ledger_type')=='SEARCH_QUERY'];by=defaultdict(list)
for r in q:by[r['stable_player_key']].append(r)
manifest=j(OUT/'sp102_video_candidate_manifest.json')
manifest['search_attempts']=[{'stable_player_key':r['stable_player_key'],'player':r['player'],'queue_order':r['queue_order'],'query_variant':r['query_variant'],'query_text':r['query_text'],'result_count':r.get('result_count'),'error':r.get('error'),'acquisition_route':r.get('acquisition_route'),'targeted_scope_only':r.get('targeted_scope_only')} for r in q]
manifest['search_attempt_count']=len(q);manifest['per_target_query_attempt_counts']={k:len(v) for k,v in sorted(by.items())};manifest['query_variant_count_per_player']=None
wj(OUT/'sp102_video_candidate_manifest.json',manifest)
ps=j(OUT/'sp102_player_evidence_summary.json')
for p in ps['players']:
    qs=by[p['stable_player_key']];p['query_set']=[r['query_text'] for r in qs];p['query_denominator']=len(qs);p['query_error_count']=sum(bool(r.get('error')) for r in qs);p['query_variant_ids']=[r['query_variant'] for r in qs]
wj(OUT/'sp102_player_evidence_summary.json',ps)
audit=ROOT/'docs/audits/sp102_targeted_video_comment_rescue.md';text=audit.read_text(encoding='utf-8');text+='\n## Query-contract coverage\n\n- Total targeted search-query attempts: **'+str(len(q))+'**.\n- Per-target minimum/maximum attempts: **'+str(min((len(v) for v in by.values()),default=0))+' / '+str(max((len(v) for v in by.values()),default=0))+'**.\n- Zero-result and error queries remain in the candidate manifest as search attempts rather than disappearing from the denominator.\n';audit.write_text(text,encoding='utf-8')
print(json.dumps({'query_attempts':len(q),'targets':len(by),'per_target_distribution':dict(Counter(len(v) for v in by.values()))},ensure_ascii=False))

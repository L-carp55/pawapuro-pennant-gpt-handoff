#!/usr/bin/env python3
from __future__ import annotations
import csv, gzip, json, os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'/'derived'/'sp102_youtube_foundation_inventory_20260819.json'
TARGET=ROOT/'outputs'/'derived'/'sp101_residual_low_confidence_target_set.json'

KEYWORDS=('youtube','comment','community_v3','sp033')
files=[]
for base in [ROOT/'scripts',ROOT/'docs'/'tasks',ROOT/'docs'/'audits',ROOT/'outputs'/'derived',ROOT/'.github'/'workflows']:
    if not base.exists(): continue
    for p in base.rglob('*'):
        if p.is_file() and any(k in p.name.lower() for k in KEYWORDS):
            files.append(str(p.relative_to(ROOT)).replace('\\','/'))
files=sorted(set(files))

def sample_text(p:Path, n=2):
    out=[]
    try:
        if p.suffix=='.gz':
            f=gzip.open(p,'rt',encoding='utf-8',errors='replace')
        else:
            f=p.open('r',encoding='utf-8',errors='replace')
        with f:
            for _ in range(n):
                line=f.readline()
                if not line: break
                out.append(line[:1000].rstrip('\n'))
    except Exception as e:
        return {'error':repr(e)}
    return out

schemas=[]
for rel in files:
    p=ROOT/rel
    rec={'path':rel,'bytes':p.stat().st_size}
    if p.suffix in {'.json','.jsonl','.gz','.csv','.md','.mjs','.py','.yml','.yaml'} or '.jsonl.gz' in p.name or '.csv.gz' in p.name:
        sm=sample_text(p,2)
        rec['sample']=sm
        if isinstance(sm,list) and sm:
            s=sm[0].strip()
            if s.startswith('{'):
                try: rec['first_json_keys']=sorted(json.loads(s).keys())
                except Exception: pass
    schemas.append(rec)

t=json.loads(TARGET.read_text(encoding='utf-8'))
targeted=[p for p in t['players'] if p.get('comment_search_allowed_in_SP102') is True]
non=[p for p in t['players'] if not p.get('comment_search_allowed_in_SP102')]

out={
 'schema_version':'sp102_youtube_foundation_inventory_20260819',
 'generated_at':'2026-08-19',
 'targeted_count':len(targeted),
 'nontarget_count':len(non),
 'targeted_players':[{k:p.get(k) for k in ['queue_order','stable_player_key','player','target_selection_state','pre_rescue_confidence','expected_information_gain','target_reasons']} for p in targeted],
 'youtube_related_files':schemas,
 'youtube_api_key_present':bool(os.environ.get('YOUTUBE_API_KEY')),
 'youtube_api_key_value_recorded':False,
 'guard':'preflight only; no SP-102 external search executed',
}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(out,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'targeted':len(targeted),'non_targeted':len(non),'youtube_related_files':len(files),'youtube_api_key_present':out['youtube_api_key_present']},ensure_ascii=False))

#!/usr/bin/env python3
from __future__ import annotations
import gzip,hashlib,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'outputs'/'derived'/'sp102_comment_evidence_records.jsonl.gz'

def h(v:str)->str:
    return hashlib.sha256(('SP102_COMMENTER_ORIGIN\x1f'+v).encode('utf-8')).hexdigest()[:24]
rows=[]
with gzip.open(P,'rt',encoding='utf-8') as f:
    for line in f:
        if not line.strip(): continue
        r=json.loads(line)
        if r.get('source_layer') in {'COMMENT','REPLY'}:
            raw=str(r.get('author_id') or r.get('author') or '')
            r['commenter_origin_hash']=h(raw) if raw else None
            r.pop('author',None)
            r.pop('author_id',None)
            r['commenter_profile_persisted']=False
        rows.append(r)
with P.open('wb') as raw:
    with gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as gz:
        for r in rows:
            gz.write((json.dumps(r,ensure_ascii=False,sort_keys=True)+'\n').encode('utf-8'))
print(json.dumps({'rows':len(rows),'comment_rows':sum(r.get('source_layer') in {'COMMENT','REPLY'} for r in rows),'raw_commenter_identity_fields_remaining':sum(any(k in r for k in ['author','author_id']) for r in rows if r.get('source_layer') in {'COMMENT','REPLY'})}))

#!/usr/bin/env python3
from __future__ import annotations
import gzip,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'outputs'/'derived'/'sp102_comment_evidence_records.jsonl.gz'
O=ROOT/'outputs'/'derived'/'qa_sp102_commenter_privacy_20260819.json'
rows=[]
with gzip.open(P,'rt',encoding='utf-8') as f:
    for line in f:
        if line.strip(): rows.append(json.loads(line))
comments=[r for r in rows if r.get('source_layer') in {'COMMENT','REPLY'}]
checks={
 'no_raw_author_field':all('author' not in r for r in comments),
 'no_raw_author_id_field':all('author_id' not in r for r in comments),
 'commenter_profile_persisted_false':all(r.get('commenter_profile_persisted') is False for r in comments),
 'origin_hash_only_when_available':all(('commenter_origin_hash' in r) for r in comments),
}
out={'schema_version':'qa_sp102_commenter_privacy_20260819','generated_at':'2026-08-19','status':'PASS_COMMENTER_PRIVACY' if all(checks.values()) else 'FAIL_COMMENTER_PRIVACY','comment_rows':len(comments),'checks':checks}
O.write_text(json.dumps(out,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out,ensure_ascii=False))
sys.exit(0 if out['status'].startswith('PASS') else 2)

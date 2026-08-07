import csv, os, re, sys
from collections import defaultdict
from pathlib import Path
raw=Path(os.environ.get('PBP_RAW_DIR','data/raw/npb_pbp'))
out=Path(sys.argv[1]) if len(sys.argv)>1 else None
broad=re.compile(r'エラー|失策|悪送球|後逸|落球|ファンブル|トンネル|お手玉|捕球ミス|送球ミス')
regular={'1','2','26'}
rows=[]
for year in range(2020,2026):
    stats=defaultdict(lambda:[0,0])
    for p in sorted(raw.glob(f'{year}-*_pbp.csv')):
        with p.open(encoding='utf-8-sig',newline='') as f:
            for r in csv.DictReader(f):
                if str(r.get('game_type_id','')) not in regular: continue
                br=str(r.get('bresult','')).removesuffix('.0') or '(blank)'
                stats[br][0]+=1
                if broad.search(str(r.get('description_jap',''))): stats[br][1]+=1
    for br in [str(x) for x in range(100,109)]:
        n,e=stats[br]
        rows.append((year,br,n,e,(e/n if n else None)))
lines=['# 2020–2025 bresult 100–108 失策語集中率','', '| year | code | all | error-keyword | share |','|---:|---:|---:|---:|---:|']
for y,b,n,e,s in rows: lines.append(f'| {y} | {b} | {n} | {e} | {s*100:.1f}% |' if s is not None else f'| {y} | {b} | 0 | 0 | — |')
lines += ['','## 判定規律','','コード100–108はFE/TEの種類を決めるためには使わない。各年で高い失策語集中率が安定する場合のみ、説明文で種類を分類できないイベントを「失策疑い・負例から除外」とする補助フラグに使う。']
text='\n'.join(lines)+'\n'
if out: out.write_text(text,encoding='utf-8')
print(text)

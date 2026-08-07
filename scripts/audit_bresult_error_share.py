import csv, os, re, sys
from collections import defaultdict
from pathlib import Path

raw=Path(os.environ.get('PBP_RAW_DIR','data/raw/npb_pbp'))
out=Path(sys.argv[1]) if len(sys.argv)>1 else None
broad=re.compile(r'エラー|失策|悪送球|後逸|落球|ファンブル|トンネル|お手玉|捕球ミス|送球ミス')
regular={'1','2','26'}
stats=defaultdict(lambda:[0,0,[],[]])
for p in sorted(raw.glob('2024-*_pbp.csv')):
    with p.open(encoding='utf-8-sig',newline='') as f:
        for r in csv.DictReader(f):
            if str(r.get('game_type_id','')) not in regular: continue
            br=str(r.get('bresult','')).removesuffix('.0') or '(blank)'
            d=str(r.get('description_jap',''))
            x=stats[br]; x[0]+=1
            if broad.search(d):
                x[1]+=1
                if len(x[2])<6: x[2].append(d[:180])
            elif d and len(x[3])<6: x[3].append(d[:180])
rows=sorted(stats.items(),key=lambda kv:kv[1][1],reverse=True)
lines=['# 2024 bresult error-share audit','', '| bresult | all rows | error-keyword rows | share |','|---:|---:|---:|---:|']
for br,(n,e,yes,no) in rows[:40]: lines.append(f'| {br} | {n} | {e} | {e/n*100:.2f}% |')
for br,(n,e,yes,no) in rows[:15]:
    lines += ['',f'## bresult {br}','','error examples:']+[f'- {x}' for x in yes]+['','non-error examples:']+[f'- {x}' for x in no]
lines += ['','## rule','','非失策行にも頻出するbresultは、失策ラベルとして使用しない。説明文と独立に失策専用と確認できたコードのみ補助候補。']
text='\n'.join(lines)+'\n'
if out: out.write_text(text,encoding='utf-8')
print(text)

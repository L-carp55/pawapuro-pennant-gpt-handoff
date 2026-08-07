import hashlib, os, sqlite3, sys, re
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score, average_precision_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

EVENT_DB=Path(os.environ.get('PBP_DB_PATH','data/pennant.db'))
SOURCE_DB=Path(os.environ.get('PENNANT_DB_PATH','data/pennant.db'))
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else None
norm=lambda s: re.sub(r'[\s\u3000]+','',str(s or ''))
posmap={'1B':'一','2B':'二','3B':'三','SS':'遊','LF':'左','CF':'中','RF':'右'}

ec=sqlite3.connect(EVENT_DB)
df=pd.read_sql_query('''SELECT season,game_id,park,bats,fielder_norm,pos,hc_x,hc_y,ball_type,has_runner,field_error_label
 FROM fielding_error_events WHERE season BETWEEN 2020 AND 2025 AND field_error_label IS NOT NULL''',ec)
ec.close(); df=df[df.pos.isin(posmap.values())].copy(); df['fielder_key']=df.fielder_norm.map(norm); df['y']=df.field_error_label.astype(int)
sc=sqlite3.connect(SOURCE_DB)
r=pd.read_sql_query('''SELECT p.season,p.name_ja,f.pos,f.inn,f.rngr
 FROM bm_fld f JOIN bm_player p ON p.season=f.season AND p.farm=f.farm AND p.player_id=f.player_id
 WHERE f.farm=0 AND f.season BETWEEN 2020 AND 2025 AND f.rngr IS NOT NULL AND f.inn>0''',sc);sc.close()
r['pos']=r.pos.map(posmap);r=r[r.pos.notna()].copy();r['fielder_key']=r.name_ja.map(norm);r['inn']=pd.to_numeric(r.inn,errors='coerce');r['rngr']=pd.to_numeric(r.rngr,errors='coerce')
r=r.groupby(['season','fielder_key','pos'],as_index=False).agg(inn=('inn','sum'),rngr=('rngr','sum'));r['rngr1000']=r.rngr/r.inn*1000
m=df.merge(r,on=['season','fielder_key','pos'],how='left');coverage=m.rngr1000.notna().mean();m=m[(m.rngr1000.notna())&(m.inn>=100)].copy().reset_index(drop=True)
for c in ['hc_x','hc_y','has_runner','rngr1000']:m[c]=pd.to_numeric(m[c],errors='coerce')
m['hc_x2']=m.hc_x**2;m['hc_y2']=m.hc_y**2;m['hc_xy']=m.hc_x*m.hc_y

def pipe(use_range):
 cats=['pos','ball_type','park','bats'];nums=['has_runner','hc_x','hc_y','hc_x2','hc_y2','hc_xy']+(['rngr1000'] if use_range else [])
 pre=ColumnTransformer([('cat',OneHotEncoder(handle_unknown='ignore',min_frequency=5),cats),('num',Pipeline([('imp',SimpleImputer(strategy='median')),('sc',StandardScaler())]),nums)])
 return Pipeline([('pre',pre),('lr',LogisticRegression(max_iter=1000,C=1.0,solver='liblinear'))]),cats+nums
pred={k:np.full(len(m),np.nan) for k in ['context','context_range']}
for season,idx in m.groupby('season').groups.items():
 ids=np.array(list(idx),dtype=int);sub=m.iloc[ids];groups=sub.fielder_key;n=min(5,groups.nunique());
 if n<3:continue
 for tr,te in GroupKFold(n_splits=n).split(sub,sub.y,groups):
  for key,use in [('context',False),('context_range',True)]:
   model,cols=pipe(use);model.fit(m.iloc[ids[tr]][cols],m.iloc[ids[tr]].y);pred[key][ids[te]]=model.predict_proba(m.iloc[ids[te]][cols])[:,1]

def corr(a,b):return float(np.corrcoef(a,b)[0,1]) if len(a)>=3 and np.std(a)>0 and np.std(b)>0 else np.nan
def reliability(p):
 d=m.copy();d['resid']=p-d.y;d=d[np.isfinite(d.resid)].copy();d['half']=d.game_id.map(lambda x:int(hashlib.sha1(str(x).encode()).hexdigest()[-1],16)&1)
 g=d.groupby(['season','fielder_key','half']).agg(n=('resid','size'),v=('resid','mean')).reset_index();A=g[g.half==0].rename(columns={'n':'nA','v':'a'});B=g[g.half==1].rename(columns={'n':'nB','v':'b'});ab=A.merge(B,on=['season','fielder_key']);ab=ab[(ab.nA>=20)&(ab.nB>=20)]
 fy=d.groupby(['season','fielder_key']).agg(n=('resid','size'),v=('resid','mean')).reset_index();fy=fy[fy.n>=60];ny=fy.merge(fy,on='fielder_key',suffixes=('_a','_b'));ny=ny[ny.season_b==ny.season_a+1]
 return len(ab),corr(ab.a,ab.b),len(ny),corr(ny.v_a,ny.v_b)
rows=[]
for k,p in pred.items():
 ok=np.isfinite(p);y=m.y.to_numpy()[ok];q=p[ok];rows.append((k,ok.sum(),brier_score_loss(y,q),log_loss(y,q,labels=[0,1]),roc_auc_score(y,q),average_precision_score(y,q),*reliability(p)))
lines=['# Catching range-adjustment audit','', '判定: **RESEARCH_ONLY**','',f'event-to-bm_fld RngR coverage={coverage*100:.1f}%',f'analysis events (RngR present, >=100 inn)={len(m):,} / FE={int(m.y.sum())}','',
'RngRは捕球へ加点せず、同守備位置で広い範囲を処理する選手の機会難度proxyとしてのみ投入する。','','| model | events | Brier | logloss | AUC | AP | split players | split r | next-year pairs | next-year r |','|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
for x in rows:lines.append(f'| {x[0]} | {x[1]} | {x[2]:.6f} | {x[3]:.5f} | {x[4]:.3f} | {x[5]:.3f} | {x[6]} | {x[7]:.3f} | {x[8]} | {x[9]:.3f} |')
lines+=['','## acceptance rule','','context_rangeが同一標本のcontextよりBrier/loglossを改善し、かつ残差再現性を悪化させない場合のみ、RngRを機会難度proxyとして次段階に残す。改善しなければ二重計上を避けて不採用。']
text='\n'.join(lines)+'\n';print(text);OUT and OUT.write_text(text,encoding='utf-8')

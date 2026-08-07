import math, os, sqlite3, sys
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

DB=Path(os.environ.get('PBP_DB_PATH','data/pennant.db'))
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else None
con=sqlite3.connect(DB)
df=pd.read_sql_query('''SELECT season,game_id,park,bats,fielder_norm,pos,hc_x,hc_y,ball_type,has_runner,field_error_label
 FROM fielding_error_events
 WHERE season BETWEEN 2020 AND 2025 AND field_error_label IS NOT NULL''',con)
con.close()
df=df[df.pos.isin(['一','二','三','遊','左','中','右'])].copy().reset_index(drop=True)
df['y']=df.field_error_label.astype(int)
for c in ['hc_x','hc_y','has_runner']: df[c]=pd.to_numeric(df[c],errors='coerce')
df['hc_x2']=df.hc_x**2;df['hc_y2']=df.hc_y**2;df['hc_xy']=df.hc_x*df.hc_y
cats=['pos','ball_type','park','bats'];nums=['has_runner','hc_x','hc_y','hc_x2','hc_y2','hc_xy']

def context_model():
 pre=ColumnTransformer([('cat',OneHotEncoder(handle_unknown='ignore',min_frequency=5),cats),('num',Pipeline([('imp',SimpleImputer(strategy='median',add_indicator=True)),('sc',StandardScaler())]),nums)])
 return Pipeline([('pre',pre),('lr',LogisticRegression(max_iter=1000,C=1.0,solver='liblinear'))])

# Same-season OOF context probabilities by whole fielder. These are the baseline probabilities used for prior fitting.
p=np.full(len(df),np.nan)
for season,idx in df.groupby('season').groups.items():
 ids=np.array(list(idx),dtype=int);sub=df.iloc[ids];groups=sub.fielder_norm.astype(str);n=min(5,groups.nunique())
 if n<3:continue
 for tr,te in GroupKFold(n_splits=n).split(sub,sub.y,groups):
  m=context_model();m.fit(df.iloc[ids[tr]][cats+nums],df.iloc[ids[tr]].y);p[ids[te]]=m.predict_proba(df.iloc[ids[te]][cats+nums])[:,1]
df['p']=p;df=df[np.isfinite(df.p)].copy().reset_index(drop=True)
EPS=1e-6
df['eta']=np.log(np.clip(df.p,EPS,1-EPS)/(1-np.clip(df.p,EPS,1-EPS)))

def sigmoid(x):
 x=np.clip(x,-30,30);return 1/(1+np.exp(-x))

def fit_delta(eta,y,sigma):
 # Penalized player intercept using only prior seasons. Prior mean 0, SD sigma on log-odds scale.
 if len(y)==0:return 0.0
 d=0.0;prec=1/(sigma*sigma)
 for _ in range(30):
  q=sigmoid(eta+d);g=float(np.sum(y-q)-d*prec);h=float(-np.sum(q*(1-q))-prec)
  if h==0:break
  step=g/h;d-=step
  if abs(step)<1e-7:break
 return float(d)

def evaluate(target_seasons,lookback,sigma):
 ys=[];base=[];adj=[];players=0;prior_events=0
 for season in target_seasons:
  cur=df[df.season==season]
  for player,g in cur.groupby('fielder_norm'):
   prior=df[(df.fielder_norm==player)&(df.season<season)&(df.season>=season-lookback)]
   if len(prior)<20:continue
   delta=fit_delta(prior.eta.to_numpy(),prior.y.to_numpy(),sigma)
   q=sigmoid(g.eta.to_numpy()+delta)
   ys.extend(g.y.to_numpy());base.extend(g.p.to_numpy());adj.extend(q);players+=1;prior_events+=len(prior)
 if not ys:return None
 y=np.array(ys);b=np.array(base);q=np.array(adj)
 return dict(events=len(y),players=players,prior_events=prior_events,
  base_brier=brier_score_loss(y,b),adj_brier=brier_score_loss(y,q),
  base_logloss=log_loss(y,b,labels=[0,1]),adj_logloss=log_loss(y,q,labels=[0,1]),
  base_auc=roc_auc_score(y,b),adj_auc=roc_auc_score(y,q),
  base_ap=average_precision_score(y,b),adj_ap=average_precision_score(y,q))

# Tune only on 2021-2023. Freeze choice before evaluating 2024-2025.
lookbacks=[1,2,3,4,5]
sigmas=[0.05,0.10,0.15,0.20,0.30,0.40,0.60,0.80,1.20]
tuning=[]
for L in lookbacks:
 for S in sigmas:
  r=evaluate([2021,2022,2023],L,S)
  if r:tuning.append((r['adj_logloss'],r['adj_brier'],L,S,r))
tuning.sort(key=lambda x:(x[0],x[1]))
if not tuning:raise RuntimeError('no tuning results')
_,_,bestL,bestS,tuneBest=tuning[0]
test=evaluate([2024,2025],bestL,bestS)
if test is None:raise RuntimeError('no 2024-2025 test results')

# Also report no-shrink-ish and alternative windows on locked test for transparency, but selection remains tuning-only.
testGrid=[]
for L in lookbacks:
 for S in sigmas:
  r=evaluate([2024,2025],L,S)
  if r:testGrid.append((L,S,r))

def pct_improve(base,adj):return (base-adj)/base*100 if base else float('nan')
lines=['# Catching multi-year prior temporal-holdout audit','',
'判定: **RESEARCH_ONLY_TEMPORAL_VALIDATION**','',
'- 捕球は単年FE残差を広げず、過去年だけからplayer-specific log-odds effectを推定する。',
'- shrinkage強度(sigma)とlookback年数は2021-2023だけで選び、2024-2025は完全な時間holdoutとして最後に1回評価する。',
'- target season本人のFEはprior推定に一切使わない。将来年も使わない。','',
'## tuning result (2021-2023 only)','',
f'best lookback={bestL} years / prior SD sigma={bestS:.2f} log-odds',
f'events={tuneBest["events"]:,} / players={tuneBest["players"]}',
f'baseline logloss={tuneBest["base_logloss"]:.5f} → prior-adjusted={tuneBest["adj_logloss"]:.5f}',
f'baseline Brier={tuneBest["base_brier"]:.6f} → prior-adjusted={tuneBest["adj_brier"]:.6f}','',
'## locked temporal holdout (2024-2025)','',
'| metric | context baseline | + past-only player prior | change |','|---|---:|---:|---:|',
f'| logloss | {test["base_logloss"]:.5f} | {test["adj_logloss"]:.5f} | {pct_improve(test["base_logloss"],test["adj_logloss"]):+.2f}% |',
f'| Brier | {test["base_brier"]:.6f} | {test["adj_brier"]:.6f} | {pct_improve(test["base_brier"],test["adj_brier"]):+.2f}% |',
f'| AUC | {test["base_auc"]:.3f} | {test["adj_auc"]:.3f} | {test["adj_auc"]-test["base_auc"]:+.3f} |',
f'| AP | {test["base_ap"]:.3f} | {test["adj_ap"]:.3f} | {test["adj_ap"]-test["base_ap"]:+.3f} |','',
f'holdout events={test["events"]:,} / player-seasons={test["players"]} / prior events consumed={test["prior_events"]:,}','',
'## locked-test sensitivity (not used for selection)','',
'| lookback | sigma | logloss | Brier |','|---:|---:|---:|---:|']
for L,S,r in sorted(testGrid,key=lambda x:(x[0],x[1])):lines.append(f'| {L} | {S:.2f} | {r["adj_logloss"]:.5f} | {r["adj_brier"]:.6f} |')
lines+=['','## acceptance rule','',
'- locked 2024-2025でloglossとBrierの両方がcontext baselineを改善した場合だけ、複数年player priorを捕球latent候補として残す。',
'- 改善しない場合、現在のFEイベントだけから恒常的捕球能力を作る案は棄却する。',
'- 改善しても最終100段階化は別工程。分散・posterior uncertaintyをデータから決める。','']
text='\n'.join(lines);print(text);OUT and OUT.write_text(text,encoding='utf-8')

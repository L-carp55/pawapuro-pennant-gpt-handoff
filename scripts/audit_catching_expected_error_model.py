import hashlib, math, os, sqlite3, sys
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
df=pd.read_sql_query('''SELECT season,game_id,park,bats,fielder_norm,pos,hc_x,hc_y,ball_type,has_runner,
 field_error_label,prev_def_game_gap_days,prior_def_games_7d,prior_def_games_14d,
 prior_def_pitches_7d,prior_def_pitches_14d,season_def_games_before,season_def_pitches_before
 FROM fielding_error_events
 WHERE season BETWEEN 2020 AND 2025 AND field_error_label IS NOT NULL''',con)
con.close()
df=df[df.pos.isin(['一','二','三','遊','左','中','右'])].copy()
df['y']=df.field_error_label.astype(int)
for c in ['hc_x','hc_y','has_runner','prev_def_game_gap_days','prior_def_games_7d','prior_def_games_14d','prior_def_pitches_7d','prior_def_pitches_14d','season_def_games_before','season_def_pitches_before']:
    df[c]=pd.to_numeric(df[c],errors='coerce')
df['hc_x2']=df.hc_x**2; df['hc_y2']=df.hc_y**2; df['hc_xy']=df.hc_x*df.hc_y
# Workload scale is numeric only; no hand-set effect direction.
df['season_def_pitches_before_k']=df.season_def_pitches_before/1000.0

def model(cols_cat,cols_num):
    pre=ColumnTransformer([
      ('cat',OneHotEncoder(handle_unknown='ignore',min_frequency=5),cols_cat),
      ('num',Pipeline([('imp',SimpleImputer(strategy='median',add_indicator=True)),('sc',StandardScaler())]),cols_num),
    ])
    return Pipeline([('pre',pre),('lr',LogisticRegression(max_iter=1000,C=1.0,solver='liblinear'))])

variants={
 'base': (['pos','ball_type'],['has_runner']),
 'context': (['pos','ball_type','park','bats'],['has_runner','hc_x','hc_y','hc_x2','hc_y2','hc_xy']),
 'context_workload': (['pos','ball_type','park','bats'],['has_runner','hc_x','hc_y','hc_x2','hc_y2','hc_xy','prev_def_game_gap_days','prior_def_games_7d','prior_def_games_14d','prior_def_pitches_7d','prior_def_pitches_14d','season_def_games_before','season_def_pitches_before_k']),
}

# Same-season, whole-fielder holdout. A player's own errors never fit the probabilities used for that player.
preds={k:np.full(len(df),np.nan) for k in variants}
for season,ix in df.groupby('season').groups.items():
    ids=np.array(list(ix)); sub=df.loc[ids]; groups=sub.fielder_norm.astype(str)
    n_groups=groups.nunique(); n_splits=min(5,n_groups)
    if n_splits<3: continue
    gkf=GroupKFold(n_splits=n_splits)
    for tr_local,te_local in gkf.split(sub,sub.y,groups):
        tr_ids=ids[tr_local]; te_ids=ids[te_local]
        for name,(cats,nums) in variants.items():
            m=model(cats,nums); m.fit(df.loc[tr_ids,cats+nums],df.loc[tr_ids,'y'])
            preds[name][te_ids]=m.predict_proba(df.loc[te_ids,cats+nums])[:,1]

metrics=[]
for name,p in preds.items():
    ok=np.isfinite(p); y=df.y.to_numpy()[ok]; q=p[ok]
    metrics.append((name,int(ok.sum()),float(y.mean()),brier_score_loss(y,q),log_loss(y,q,labels=[0,1]),roc_auc_score(y,q),average_precision_score(y,q)))
    df[f'p_{name}']=p
    df[f'resid_{name}']=p-df.y # positive = fewer errors than expected

# Reliability of player residuals: split games A/B within player-season, and adjacent-year correlation.
def parity(x): return int(hashlib.sha1(str(x).encode()).hexdigest()[-1],16)&1
df['half']=df.game_id.map(parity)

def corr(a,b):
    if len(a)<3 or np.std(a)==0 or np.std(b)==0:return np.nan
    return float(np.corrcoef(a,b)[0,1])

def reliability(col):
    d=df[np.isfinite(df[col])].copy()
    g=d.groupby(['season','fielder_norm','half']).agg(n=(col,'size'),v=(col,'mean')).reset_index()
    A=g[g.half==0].rename(columns={'n':'nA','v':'a'}); B=g[g.half==1].rename(columns={'n':'nB','v':'b'})
    ab=A.merge(B,on=['season','fielder_norm']); ab=ab[(ab.nA>=20)&(ab.nB>=20)]
    split=corr(ab.a,ab.b)
    fy=d.groupby(['season','fielder_norm']).agg(n=(col,'size'),v=(col,'mean')).reset_index(); fy=fy[fy.n>=60]
    nxt=fy.merge(fy,on='fielder_norm',suffixes=('_a','_b')); nxt=nxt[nxt.season_b==nxt.season_a+1]
    year=corr(nxt.v_a,nxt.v_b)
    return len(ab),split,len(nxt),year
rel=[]
for name in variants:
    rel.append((name,*reliability(f'resid_{name}')))

# Does workload add useful information beyond context? Also inspect event-level error rates by workload decile descriptively.
work=df[df.prior_def_pitches_14d.notna()].copy()
if len(work):
    try: work['load_decile']=pd.qcut(work.prior_def_pitches_14d,10,duplicates='drop')
    except Exception: work['load_decile']=None
work_rows=[]
if 'load_decile' in work and work.load_decile.notna().any():
    for k,x in work.groupby('load_decile',observed=True): work_rows.append((str(k),len(x),x.y.mean()))

lines=['# Catching expected-error research audit','', '判定: **RESEARCH_ONLY_NOT_ABILITY_READY**','',
 f'events={len(df):,} / FE positives={int(df.y.sum()):,} / prevalence={df.y.mean()*100:.3f}%','',
 '同一年度内でfielder単位のGroupKFoldを行い、対象選手自身の失策を学習せずにexpected FEを予測する。','','## out-of-fielder prediction','',
 '| model | events | prevalence | Brier | logloss | AUC | AP |','|---|---:|---:|---:|---:|---:|---:|']
for r in metrics: lines.append(f'| {r[0]} | {r[1]} | {r[2]*100:.3f}% | {r[3]:.6f} | {r[4]:.5f} | {r[5]:.3f} | {r[6]:.3f} |')
lines += ['','- `base`: position + batted-ball type + runner presence','- `context`: + coordinates, park, batter side','- `context_workload`: + prior-only defensive workload/rest. Current-game future is not used.','', '## player residual reliability','',
 '| model | split-half players | split-half Pearson | adjacent-year pairs | adjacent-year Pearson |','|---|---:|---:|---:|---:|']
for name,nsp,rsp,ny,ry in rel: lines.append(f'| {name} | {nsp} | {rsp:.3f} | {ny} | {ry:.3f} |')
lines += ['','Residual = expected FE probability − actual FE. Positive means fewer FE than context expectation. Volume is not added as ability; it only affects uncertainty.','', '## raw workload descriptives','',
 '| prior defensive pitches 14d decile | events | FE rate |','|---|---:|---:|']
for k,n,r in work_rows: lines.append(f'| {k} | {n} | {r*100:.3f}% |')
lines += ['','## acceptance rule','',
 '- 難易度・負荷は、out-of-fielder Brier/loglossを改善する場合だけexpected-errorへ残す。',
 '- 捕球能力へ変換する前に、context-adjusted residualがraw/baseよりsplit-halfまたは翌年再現性を改善するか確認する。',
 '- 再現性が弱ければ100段階へ無理に広げず、複数年階層化または追加の打球難度データを待つ。','']
text='\n'.join(lines)
if OUT: OUT.write_text(text,encoding='utf-8')
print(text)

// 内野肩の探索2: raw深部アウト率ではなく「深くなるほどアウト率が落ちにくいか」を測る。
//
// 狙い:
//   通常位置でのアウト率は捕球・持ち替え・守備力などを強く含む。
//   肩が強ければ、捕球位置が深くなって送球距離が伸びてもアウト率の低下が小さいはず。
//
// 手順（SSのみ）:
//   1) 全体の P(out) を、捕球位置(hc_x/hc_y)・打者速度proxy・年度でlogistic回帰
//   2) 各イベントの residual = actual - expected を作る
//   3) 野手ごとに residual ~ depth を回帰し、depth slope を肩proxyとする
//      （野手の通常処理力は主に切片へ、深さに対する耐性だけを傾きで拾う）
//   4) DELTA 2017の遠投アウト評価6人と外部比較
//   5) fielder×yearでも同じ傾きを作り、隣接年再現性を確認
//
// 最終肩力は生成しない。外部n=6なので探索扱い。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const norm=s=>(s??'').normalize('NFKC').replace(/[\s　]/g,'');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function solve(A,b){
  const n=A.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    if(Math.abs(M[p][c])<1e-10)return null;
    [M[c],M[p]]=[M[p],M[c]];
    const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;
    for(let r=0;r<n;r++)if(r!==c){const m=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=m*M[c][j];}
  }
  return M.map(r=>r[n]);
}
const pearson=p=>{
  if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;
  let xy=0,xx=0,yy=0;for(const [x,y] of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;
};

// ---- 2026 NPB+直接走力で、打者速度のnuisance proxyだけを作る（肩の教師には使わない） ----
const KEYS=['gdp_avoid','ubr_pa','ih_inplay'];
const batRows=db.prepare(`
  SELECT b.player_id,b.name,b.season,b.pa,b.ab,b.so,b.gdp,bm.ubr,m.gb_pct,t.ih
  FROM v_batting b
  LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.position<>'投' AND b.season BETWEEN 2020 AND 2025 AND b.pa>=50`).all();
const raw=batRows.map(r=>{
  const inplay=Math.max(1,(r.ab??0)-(r.so??0));
  const gb=Math.max(1,inplay*((r.gb_pct??45)/100));
  return {id:r.player_id,name:r.name,season:r.season,pa:r.pa,
    gdp_avoid:-(r.gdp??0)/gb,ubr_pa:r.ubr!=null&&r.pa>0?r.ubr/r.pa:null,ih_inplay:r.ih!=null?r.ih/inplay:null};
});
const normByYear=new Map();
for(const y of [...new Set(raw.map(r=>r.season))]){
  const a=raw.filter(r=>r.season===y),n={};
  for(const k of KEYS){const v=a.map(r=>r[k]).filter(Number.isFinite);const m=v.reduce((s,x)=>s+x,0)/v.length;const sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length)||1;n[k]={m,sd};}
  normByYear.set(y,n);
}
const annual=new Map();
for(const r of raw){if(!KEYS.every(k=>Number.isFinite(r[k])))continue;const n=normByYear.get(r.season);annual.set(`${r.id}|${r.season}`,{...r,...Object.fromEntries(KEYS.map(k=>[k,(r[k]-n[k].m)/n[k].sd]))});}
const direct=db.prepare(`SELECT player_id,top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all();
const train=[];
for(const d of direct){const r=annual.get(`${d.player_id}|2025`);if(r)train.push({...r,target:d.top_speed_kmh});}
// OLS nuisance model: coefficients are fitted, not hard-coded. p=3, n≈96なので正則化不要。
const p=KEYS.length,A=Array.from({length:p+1},()=>Array(p+1).fill(0)),B=Array(p+1).fill(0);
for(const r of train){const x=[1,...KEYS.map(k=>r[k])];for(let i=0;i<x.length;i++){B[i]+=x[i]*r.target;for(let j=0;j<x.length;j++)A[i][j]+=x[i]*x[j];}}
const beta=solve(A,B);
const speedPred=r=>beta?beta[0]+KEYS.reduce((s,k,i)=>s+beta[i+1]*r[k],0):null;

// 名前→player_id は年ごとに一意な完全一致を優先。PBPの略称はprefixで一意な場合だけ結ぶ。
const namesBySeason=new Map();
for(const r of db.prepare(`SELECT DISTINCT season,player_id,name FROM v_batting WHERE position<>'投'`).all()){
  if(!namesBySeason.has(r.season))namesBySeason.set(r.season,[]);namesBySeason.get(r.season).push({...r,key:norm(r.name)});
}
function batterSpeed(name,season){
  const key=norm(name),hits=(namesBySeason.get(season)??[]).filter(r=>r.key===key||r.key.startsWith(key)||key.startsWith(r.key));
  const ids=[...new Set(hits.map(r=>r.player_id))];if(ids.length!==1)return null;
  const a=annual.get(`${ids[0]}|${season}`);return a?speedPred(a):null;
}

// ---- SS event set ----
const ev=db.prepare(`SELECT season,park,batter,batter_norm,fielder,fielder_norm,hc_x,hc_y,is_out
  FROM infield_grounder_events
  WHERE pos='SS' AND has_runner=0 AND kind IN ('out','infield_hit') AND hc_x IS NOT NULL AND hc_y IS NOT NULL`).all();
for(const e of ev)e.batter_speed=batterSpeed(e.batter_norm||e.batter,e.season);
const usable=ev.filter(e=>Number.isFinite(e.batter_speed));

// covariate standardization. depthはhc_yが小さいほど深いので符号を反転。
const stat=(a,k)=>{const m=a.reduce((s,x)=>s+x[k],0)/a.length;const sd=Math.sqrt(a.reduce((s,x)=>s+(x[k]-m)**2,0)/a.length)||1;return{m,sd};};
for(const e of usable)e.depth=-e.hc_y;
const ds=stat(usable,'depth'),xs=stat(usable,'hc_x'),bs=stat(usable,'batter_speed');
for(const e of usable){e.dz=(e.depth-ds.m)/ds.sd;e.xz=(e.hc_x-xs.m)/xs.sd;e.bz=(e.batter_speed-bs.m)/bs.sd;}
const years=[...new Set(usable.map(e=>e.season))].sort();
const y0=years[0];

// nuisance model: logistic P(out) ~ depth + depth^2 + x + x^2 + batter speed + year FE
const feat=e=>[1,e.dz,e.dz*e.dz,e.xz,e.xz*e.xz,e.bz,...years.slice(1).map(y=>e.season===y?1:0)];
const dim=feat(usable[0]).length;
let coef=Array(dim).fill(0);
const sigmoid=z=>1/(1+Math.exp(-clamp(z,-30,30)));
for(let iter=0;iter<30;iter++){
  const H=Array.from({length:dim},()=>Array(dim).fill(0)),g=Array(dim).fill(0);
  for(const e of usable){const x=feat(e),pr=sigmoid(x.reduce((s,v,i)=>s+v*coef[i],0)),w=Math.max(1e-6,pr*(1-pr)),err=e.is_out-pr;
    for(let i=0;i<dim;i++){g[i]+=x[i]*err;for(let j=0;j<dim;j++)H[i][j]+=x[i]*x[j]*w;}}
  const step=solve(H,g);if(!step)break;let mx=0;for(let i=0;i<dim;i++){coef[i]+=step[i];mx=Math.max(mx,Math.abs(step[i]));}if(mx<1e-8)break;
}
for(const e of usable){const x=feat(e);e.expected=sigmoid(x.reduce((s,v,i)=>s+v*coef[i],0));e.resid=e.is_out-e.expected;}

function slope(rows,minN){
  if(rows.length<minN)return null;
  const md=rows.reduce((s,r)=>s+r.dz,0)/rows.length,mr=rows.reduce((s,r)=>s+r.resid,0)/rows.length;
  let xy=0,xx=0;for(const r of rows){const d=r.dz-md;xy+=d*(r.resid-mr);xx+=d*d;}if(xx<=0)return null;
  return {n:rows.length,slope:xy/xx,intercept:mr-(xy/xx)*md};
}

const DELTA=[
  {display:'源田壮亮',key:'源田',target:80.0},
  {display:'京田陽太',key:'京田',target:71.7},
  {display:'今宮健太',key:'今宮',target:75.0},
  {display:'田中広輔',key:'田中広',target:60.7},
  {display:'倉本寿彦',key:'倉本',target:76.5},
  {display:'坂本勇人',key:'坂本',target:78.6},
];

console.log('# infield arm depth-slope residual audit');
console.log(`SS events=${ev.length} / batter-speed matched=${usable.length} / nuisance direct-speed train=${train.length}`);
console.log(`nuisance years=${years.join(',')} (baseline=${y0})`);
for(const minN of [80,100,150,200]){
  const pairs=[],show=[];
  for(const v of DELTA){const rows=usable.filter(e=>norm(e.fielder_norm).startsWith(norm(v.key)));const s=slope(rows,minN);if(!s)continue;pairs.push([s.slope,v.target]);show.push(`${v.display}:${s.slope.toFixed(4)}(n=${s.n})`);}
  console.log(`pooled minN=${minN}: external n=${pairs.length} r=${pearson(pairs)?.toFixed(3)??'—'}  ${show.join(' / ')}`);
}

// 年ごとのdepth slope再現性。raw deep-rateより改善するかを見る。
for(const minN of [30,40,50,60]){
  const per=new Map();
  for(const y of years){for(const name of new Set(usable.filter(e=>e.season===y).map(e=>norm(e.fielder_norm)))){
    const s=slope(usable.filter(e=>e.season===y&&norm(e.fielder_norm)===name),minN);if(s)per.set(`${y}|${name}`,s.slope);
  }}
  const pairs=[];for(const [k,v] of per){const [ys,name]=k.split('|'),next=per.get(`${Number(ys)+1}|${name}`);if(next!=null)pairs.push([v,next]);}
  console.log(`adjacent-year slope minN=${minN}: pairs=${pairs.length} r=${pearson(pairs)?.toFixed(3)??'—'}`);
}

console.log('\n判定: external correlationと年跨ぎ再現性の両方がraw深部アウト率より改善した場合だけ、次のlatent-arm候補へ進める。');
console.log('改善しなければ「深さへの耐性」も肩力としては未採用。');
db.close();

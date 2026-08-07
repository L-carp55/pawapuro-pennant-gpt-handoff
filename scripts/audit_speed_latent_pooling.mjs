// 走力の複数年プール方法を、2026 NPB+直接走力でホールドアウト比較する。
//
// 比較:
//   latest     = 直近年の代理速度だけ
//   mean3      = 直近3年の代理速度を、各年を対象年へprocess drift分だけ進めて単純平均
//   paMean3    = 同上を各年PAで加重（旧poolAcrossYearsの考え方に近い診断）
//   kalman     = MLB直接Sprint Speedから測った年変化(process noise)と、
//                NPB代理モデルの観測誤差を使ったlatent-state filter
//
// 重要:
// - 2026の直接値を持つ選手を5-foldでholdoutし、対象選手の直接値をproxy回帰の学習に使わない。
// - proxyは三塁打を使わず、併殺回避 + UBR/PA + 内野安打/in-play。
// - 年ごとのリーグ環境差を個人差と読まないため、各featureはseason内zへ標準化する。
// - process drift/noiseは別データ（MLB Statcast年別直接計測）から測る。
// - ここでは最終100段階能力を作らない。プール法の採否だけを決める。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const norm=s=>(s??'').normalize('NFKC').replace(/\s+/g,'');

const pearson=p=>{
  if(p.length<5)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;
  let xy=0,xx=0,yy=0;for(const [x,y] of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;
};
const rank=a=>{const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),o=Array(a.length);for(let i=0;i<s.length;){let j=i+1;while(j<s.length&&s[j][0]===s[i][0])j++;const r=(i+j-1)/2+1;for(let k=i;k<j;k++)o[s[k][1]]=r;i=j;}return o;};
const spearman=p=>{if(p.length<5)return null;const rx=rank(p.map(x=>x[0])),ry=rank(p.map(x=>x[1]));return pearson(rx.map((x,i)=>[x,ry[i]]));};
const rmse=p=>Math.sqrt(p.reduce((s,[x,y])=>s+(x-y)**2,0)/p.length);
const mae=p=>p.reduce((s,[x,y])=>s+Math.abs(x-y),0)/p.length;
const foldOf=id=>[...String(id)].reduce((s,c)=>s+c.charCodeAt(0),0)%5;

// ---------- annual proxy features ----------
const rawRows=db.prepare(`
  SELECT b.player_id,b.name,b.season,b.pa,b.ab,b.so,b.gdp,bm.ubr,m.gb_pct,t.ih
  FROM v_batting b
  LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.position<>'投' AND b.season BETWEEN 2020 AND 2025 AND b.pa>=50
`).all();

const raw=rawRows.map(r=>{
  const inplay=Math.max(1,(r.ab??0)-(r.so??0));
  const gb=Math.max(1,inplay*((r.gb_pct??45)/100));
  return {
    id:r.player_id,name:r.name,season:r.season,pa:r.pa,
    gdp_avoid:-(r.gdp??0)/gb,
    ubr_pa:r.ubr!=null&&r.pa>0?r.ubr/r.pa:null,
    ih_inplay:r.ih!=null?r.ih/inplay:null,
  };
});
const KEYS=['gdp_avoid','ubr_pa','ih_inplay'];
const normByYear=new Map();
for(const y of [...new Set(raw.map(r=>r.season))]){
  const a=raw.filter(r=>r.season===y);
  const n={};
  for(const k of KEYS){const v=a.map(r=>r[k]).filter(Number.isFinite);const m=v.reduce((s,x)=>s+x,0)/v.length;const sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length)||1;n[k]={mean:m,sd};}
  normByYear.set(y,n);
}
const annual=new Map();
for(const r of raw){
  if(!KEYS.every(k=>Number.isFinite(r[k])))continue;
  const n=normByYear.get(r.season);
  annual.set(`${r.id}|${r.season}`,{...r,...Object.fromEntries(KEYS.map(k=>[k,(r[k]-n[k].mean)/n[k].sd]))});
}

// ---------- direct 2026 target ----------
const direct=db.prepare(`SELECT player_id,name,top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all()
  .filter(d=>annual.has(`${d.player_id}|2025`));

// ---------- ridge ----------
function solve(A,b){const n=A.length,M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-12)return null;[M[c],M[p]]=[M[p],M[c]];const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;for(let r=0;r<n;r++)if(r!==c){const m=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=m*M[c][j];}}return M.map(r=>r[n]);}
function fit(train,alpha=10){
  const ym=train.reduce((s,r)=>s+r.target,0)/train.length;
  const p=KEYS.length,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
  for(const r of train){const x=KEYS.map(k=>r[k]),y=r.target-ym;for(let i=0;i<p;i++){b[i]+=x[i]*y;for(let j=0;j<p;j++)A[i][j]+=x[i]*x[j];}}
  for(let i=0;i<p;i++)A[i][i]+=alpha;
  const beta=solve(A,b);return {ym,beta,predict:r=>ym+beta.reduce((s,v,i)=>s+v*r[KEYS[i]],0)};
}
function innerObservationRmse(train){
  const pred=[];
  for(let f=0;f<4;f++){
    const tr=train.filter((r,i)=>i%4!==f),te=train.filter((r,i)=>i%4===f);if(tr.length<10||!te.length)continue;
    const m=fit(tr,10);for(const r of te)pred.push([m.predict(r),r.target]);
  }
  return pred.length?rmse(pred):1.0;
}

// ---------- independently measured process model from MLB direct Sprint Speed ----------
const bridge=db.prepare(`SELECT proeye_id,detail FROM mlb_bridge WHERE detail IS NOT NULL`).all();
const sprintBy=new Map();
for(const r of bridge){let d;try{d=JSON.parse(r.detail);}catch{continue;}for(const x of d.sprint_speed??[]){if(!Number.isFinite(x.sprint_speed))continue;if(!sprintBy.has(r.proeye_id))sprintBy.set(r.proeye_id,new Map());sprintBy.get(r.proeye_id).set(Number(x.year),Number(x.sprint_speed));}}
const changes=[];
for(const m of sprintBy.values())for(const [y,v] of m)if(m.has(y-1))changes.push(v-m.get(y-1));
const meanFt=changes.reduce((s,x)=>s+x,0)/changes.length;
const sdFt=Math.sqrt(changes.reduce((s,x)=>s+(x-meanFt)**2,0)/(changes.length-1));
const KMH_PER_FTS=1.09728;
const DRIFT=meanFt*KMH_PER_FTS;
const PROCESS_SD=sdFt*KMH_PER_FTS;

function propagate(x,from,to){return x+DRIFT*(to-from);}
function kalman(obs,measurementSd,targetYear){
  if(!obs.length)return null;obs=[...obs].sort((a,b)=>a.year-b.year);
  let x=obs[0].value,P=measurementSd**2,last=obs[0].year;
  for(let i=1;i<obs.length;i++){
    const o=obs[i],gap=o.year-last;
    x=propagate(x,last,o.year);P+=PROCESS_SD**2*gap;
    const R=measurementSd**2,K=P/(P+R);x=x+K*(o.value-x);P=(1-K)*P;last=o.year;
  }
  x=propagate(x,last,targetYear);P+=PROCESS_SD**2*Math.max(0,targetYear-last);
  return {value:x,sd:Math.sqrt(P)};
}

const out={latest:[],mean3:[],paMean3:[],kalman:[]};
for(let f=0;f<5;f++){
  const trDirect=direct.filter(d=>foldOf(d.player_id)!==f),teDirect=direct.filter(d=>foldOf(d.player_id)===f);
  const train=trDirect.map(d=>({...annual.get(`${d.player_id}|2025`),target:d.top_speed_kmh}));
  if(train.length<20)continue;
  const model=fit(train,10),obsRmse=innerObservationRmse(train);
  for(const d of teDirect){
    const obs=[];
    for(let y=2020;y<=2025;y++){
      const r=annual.get(`${d.player_id}|${y}`);if(!r)continue;
      // 2025 feature -> 2026 speed regression contains one-year average process drift.
      // subtract the independently measured drift to treat model output as same-year speed proxy.
      obs.push({year:y,value:model.predict(r)-DRIFT,pa:r.pa});
    }
    if(!obs.length)continue;
    const latest=obs.at(-1);out.latest.push([propagate(latest.value,latest.year,2026),d.top_speed_kmh]);
    const last3=obs.filter(o=>o.year>=2023);
    if(last3.length){
      const advanced=last3.map(o=>({...o,at2026:propagate(o.value,o.year,2026)}));
      out.mean3.push([advanced.reduce((s,o)=>s+o.at2026,0)/advanced.length,d.top_speed_kmh]);
      const w=advanced.reduce((s,o)=>s+o.pa,0);out.paMean3.push([advanced.reduce((s,o)=>s+o.at2026*o.pa,0)/w,d.top_speed_kmh]);
    }
    const k=kalman(obs,obsRmse,2026);if(k)out.kalman.push([k.value,d.top_speed_kmh]);
  }
}

console.log('# speed temporal pooling holdout');
console.log(`direct players with 2025 proxy=${direct.length}`);
console.log(`process drift=${DRIFT.toFixed(3)} km/h/year process_sd=${PROCESS_SD.toFixed(3)} km/h/year (MLB direct, n=${changes.length})`);
for(const [k,p] of Object.entries(out))console.log(`${k.padEnd(9)} n=${p.length} RMSE=${rmse(p).toFixed(3)} MAE=${mae(p).toFixed(3)} r=${pearson(p)?.toFixed(3)} rho=${spearman(p)?.toFixed(3)}`);

// 2024 sanity: proxy model is trained on all 2025->2026 direct pairs, but 2024 player-specific future stats are not used.
// This is diagnostic only; final production coefficients require the same holdout discipline to be frozen first.
const fullTrain=direct.map(d=>({...annual.get(`${d.player_id}|2025`),target:d.top_speed_kmh}));
const fullModel=fit(fullTrain,10);
// use outer-CV latest residual as a conservative observation noise estimate
const obsNoise=rmse(out.latest);
console.log(`\n# 2024 sanity latent estimate (diagnostic; observation_sd=${obsNoise.toFixed(3)}km/h)`);
for(const q of ['周東','近本','源田']){
  const id=db.prepare(`SELECT player_id,name FROM v_batting WHERE season=2024 AND name LIKE ? AND position<>'投' ORDER BY pa DESC LIMIT 1`).get(`%${q}%`);
  if(!id)continue;
  const obs=[];for(let y=2020;y<=2024;y++){const r=annual.get(`${id.player_id}|${y}`);if(r)obs.push({year:y,value:fullModel.predict(r)-DRIFT,pa:r.pa});}
  const k=kalman(obs,obsNoise,2024);
  console.log(`${id.name.replace(/　/g,' ')}: ${k?`${k.value.toFixed(2)} km/h (sd ${k.sd.toFixed(2)}, obs ${obs.length}年)`:'—'}`);
}

db.close();

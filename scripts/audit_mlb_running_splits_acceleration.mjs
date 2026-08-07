// MLB Statcast 90ft Running Splitsを使い、打席離脱と身体的な短距離加速を分けられるか監査する。
// 公式Baseball Savant CSVを実行時に読むだけで、rawファイルは保存しない。
// 2017-2025: Running Splits 9 CSV + Sprint Speed 9 CSV = 18 CSV。
//
// 目的:
//   0->5ft   : contactからの離脱/初動を強く含む
//   5->30ft  : いったん5ft進んだ後の短距離加速区間
//   30->60ft : 中盤速度
//   60->90ft : 後半速度維持
//
// 5->30ftをSprint Speed（最高速度側）と年・打席左右で説明した残差が
// 年を跨いで安定するなら、batter-box exitをかなり除いた直接的な加速特性候補になる。
// 最終走力は生成しない。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const YEARS=[2017,2018,2019,2020,2021,2022,2023,2024,2025];
const finite=Number.isFinite;
const norm=s=>(s??'').normalize('NFKC').replace(/[\s　]/g,'').toLowerCase();

function splitCsvLine(line){
  const out=[];let f='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;else if(c===','){out.push(f);f='';}else f+=c;
  }
  out.push(f);return out;
}
function csvLines(text){return text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);}
function parseSplits(text,year){
  const lines=csvLines(text);if(lines.length<2)return[];
  const h=splitCsvLine(lines[0]);const I=n=>h.indexOf(n);
  const time={};for(let ft=0;ft<=90;ft+=5)time[ft]=I(`seconds_since_hit_${String(ft).padStart(3,'0')}`);
  return lines.slice(1).map(line=>{
    const r=splitCsvLine(line);const get=ft=>{const v=Number(r[time[ft]]);return finite(v)?v:null;};
    const t={};for(let ft=0;ft<=90;ft+=5)t[ft]=get(ft);
    return {year,name:r[I('last_name, first_name')],key:norm(r[I('last_name, first_name')]),mlb_id:String(r[I('player_id')]),bats:r[I('bat_side')],t};
  }).filter(r=>r.name&&r.t[5]!=null&&r.t[30]!=null&&r.t[60]!=null&&r.t[90]!=null);
}
function parseSprint(text,year){
  const lines=csvLines(text);if(lines.length<2)return[];
  const h=splitCsvLine(lines[0]);const I=n=>h.indexOf(n);
  return lines.slice(1).map(line=>{const r=splitCsvLine(line);return {year,mlb_id:String(r[I('player_id')]),sprint:Number(r[I('sprint_speed')]),h1:Number(r[I('hp_to_1b')])};})
    .filter(r=>r.mlb_id&&finite(r.sprint));
}
function cor(pairs){
  if(pairs.length<3)return null;const mx=pairs.reduce((s,x)=>s+x[0],0)/pairs.length,my=pairs.reduce((s,x)=>s+x[1],0)/pairs.length;
  let xy=0,xx=0,yy=0;for(const [x,y] of pairs){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;
}
function solve(A,b){
  const n=A.length,M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    if(Math.abs(M[p][c])<1e-12)return null;[M[c],M[p]]=[M[p],M[c]];
    const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;
    for(let r=0;r<n;r++)if(r!==c){const m=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=m*M[c][j];}
  }return M.map(r=>r[n]);
}
function fit(rows,feature,target){
  const p=feature(rows[0]).length,A=Array.from({length:p},()=>Array(p).fill(0)),B=Array(p).fill(0);
  for(const r of rows){const x=feature(r),y=r[target];for(let i=0;i<p;i++){B[i]+=x[i]*y;for(let j=0;j<p;j++)A[i][j]+=x[i]*x[j];}}
  const beta=solve(A,B);if(!beta)return null;return r=>feature(r).reduce((s,x,i)=>s+x*beta[i],0);
}
function adjacent(rows,value){
  const by=new Map();for(const r of rows){if(!finite(r[value]))continue;const k=r.mlb_id;if(!by.has(k))by.set(k,new Map());by.get(k).set(r.year,r[value]);}
  const pairs=[];for(const m of by.values())for(const [y,v] of m)if(m.has(y+1))pairs.push([v,m.get(y+1)]);return pairs;
}
async function fetchText(url,label){const res=await fetch(url,{headers:{'user-agent':'pawapuro-pennant-gpt-handoff research audit'}});if(!res.ok)throw new Error(`${label}: HTTP ${res.status}`);return res.text();}

const all=[], sprintAll=[];
for(const year of YEARS){
  const splitUrl=`https://baseballsavant.mlb.com/running_splits?type=raw&bats=&year=${year}&position=&team=&min=5&csv=true`;
  const sprintUrl=`https://baseballsavant.mlb.com/sprint_speed_leaderboard?year=${year}&position=&team=&min=5&csv=true`;
  const [splits,sprints]=await Promise.all([fetchText(splitUrl,`splits ${year}`),fetchText(sprintUrl,`sprint ${year}`)]);
  const a=parseSplits(splits,year),b=parseSprint(sprints,year);all.push(...a);sprintAll.push(...b);
  console.log(`download ${year}: splits=${a.length} / sprint=${b.length}`);
}
console.log(`total split rows=${all.length} / sprint rows=${sprintAll.length}`);

for(const r of all){
  r.launch_0_5=r.t[5]-r.t[0];
  r.early_5_30=r.t[30]-r.t[5];
  r.mid_30_60=r.t[60]-r.t[30];
  r.late_60_90=r.t[90]-r.t[60];
  r.v_5_30=25/r.early_5_30;r.v_30_60=30/r.mid_30_60;r.v_60_90=30/r.late_60_90;
  const v510=5/(r.t[10]-r.t[5]),v2530=5/(r.t[30]-r.t[25]);r.accel_gain_5_30=v2530-v510;
}
const sprintBy=new Map(sprintAll.map(r=>[`${r.mlb_id}|${r.year}`,r]));
const full=all.map(r=>({...r,...(sprintBy.get(`${r.mlb_id}|${r.year}`)??{})})).filter(r=>finite(r.sprint));
console.log(`full MLB split+sprint matched=${full.length}`);

for(const k of ['launch_0_5','early_5_30','mid_30_60','late_60_90','accel_gain_5_30']){
  const p=adjacent(all,k);console.log(`${k.padEnd(17)} adjacent pairs=${p.length} r=${cor(p)?.toFixed(3)}`);
}
console.log('\ncorrelation with Sprint Speed (full MLB)');
for(const k of ['launch_0_5','early_5_30','mid_30_60','late_60_90','v_5_30','v_30_60','v_60_90','accel_gain_5_30']){
  const p=full.map(r=>[r[k],r.sprint]);console.log(`${k.padEnd(17)} n=${p.length} r=${cor(p)?.toFixed(3)}`);
}

const years=[...new Set(full.map(r=>r.year))].sort();
const earlyModel=fit(full.map(r=>({...r,target:r.early_5_30})),r=>[1,r.sprint,r.bats==='L'?1:0,...years.slice(1).map(y=>r.year===y?1:0)],'target');
for(const r of full)r.early_resid=r.early_5_30-earlyModel(r);
const ep=adjacent(full,'early_resid');
console.log(`\nFULL MLB early 5->30 residual after Sprint+bat side+year: pairs=${ep.length} r=${cor(ep)?.toFixed(3)}`);

const launchModel=fit(full.map(r=>({...r,target:r.launch_0_5})),r=>[1,r.bats==='L'?1:0,...years.slice(1).map(y=>r.year===y?1:0)],'target');
for(const r of full)r.launch_resid=r.launch_0_5-launchModel(r);
const lp=adjacent(full,'launch_resid');
console.log(`FULL MLB launch 0->5 residual after bat side+year: pairs=${lp.length} r=${cor(lp)?.toFixed(3)}`);
console.log(`FULL MLB launch residual vs early residual r=${cor(full.map(r=>[r.launch_resid,r.early_resid]))?.toFixed(3)}`);

const totalModel=fit(full.map(r=>({...r,target:r.t[90]})),r=>[1,r.sprint,r.bats==='L'?1:0,...years.slice(1).map(y=>r.year===y?1:0)],'target');
for(const r of full)r.total_resid=r.t[90]-totalModel(r);
console.log(`FULL MLB 90ft residual vs launch residual r=${cor(full.map(r=>[r.total_resid,r.launch_resid]))?.toFixed(3)}`);
console.log(`FULL MLB 90ft residual vs early 5->30 residual r=${cor(full.map(r=>[r.total_resid,r.early_resid]))?.toFixed(3)}`);

// NPB bridge subsetで、full-MLB式をそのまま適用できるか確認。
const bridge=db.prepare(`SELECT mlb_name FROM mlb_bridge WHERE mlb_name IS NOT NULL`).all();
const bridgeNames=new Set(bridge.map(r=>norm(r.mlb_name)));
const linked=full.filter(r=>bridgeNames.has(r.key));
console.log(`\nNPB bridge subset under FULL model n=${linked.length}`);
const bep=adjacent(linked,'early_resid'),blp=adjacent(linked,'launch_resid');
console.log(`bridge early residual adjacent pairs=${bep.length} r=${cor(bep)?.toFixed(3)}`);
console.log(`bridge launch residual adjacent pairs=${blp.length} r=${cor(blp)?.toFixed(3)}`);

console.log('\n判定:');
console.log('- 0->5より5->30が大幅に安定し、Sprintで説明した後の5->30残差も安定するなら、直接的な短距離加速ラベルとして採用候補。');
console.log('- 0->5はbatter-box exit/初動技術側に残す。');
console.log('- 次はこのfull-MLB由来のtop-speed + accelerationラベルをNPB在籍前後の選手へ橋渡しし、NPB proxyが両軸を別々に予測できるかplayer-holdoutで検証する。');
db.close();

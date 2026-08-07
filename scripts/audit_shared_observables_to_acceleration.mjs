// MLBで直接観測できる5->30ft加速を、NPB+にも共通して存在する
// Sprint Speed + home-to-first + 打席左右だけからどこまで推定できるかを検証する。
//
// 重要:
// - MLB/NPB+でSprint SpeedやH1の絶対単位・計測定義が完全一致すると仮定しない。
// - まず各リーグ/年の中で標準化し、「最高速度から期待されるよりH1が速い」という相対量で橋渡しする。
// - MLBはplayer-level 5-fold holdout。同じ選手はtrain/testを跨がない。
// - 目標の5->30ft acceleration residualも各foldのtrainだけでnuisance式を学ぶ。
// - NPB側では2026集団内の標準化から acceleration_z 候補を作るだけ。最終100段階能力にはしない。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const YEARS=[2017,2018,2019,2020,2021,2022,2023,2024,2025];
const finite=Number.isFinite;

function splitCsvLine(line){const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){out.push(f);f='';}else f+=c;}out.push(f);return out;}
const linesOf=t=>t.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);
function parseSplits(text,year){const lines=linesOf(text),h=splitCsvLine(lines[0]),I=n=>h.indexOf(n);const i5=I('seconds_since_hit_005'),i30=I('seconds_since_hit_030');return lines.slice(1).map(line=>{const r=splitCsvLine(line);return{year,player_id:String(r[I('player_id')]),bats:r[I('bat_side')],early:Number(r[i30])-Number(r[i5])};}).filter(r=>finite(r.early));}
function parseSprint(text,year){const lines=linesOf(text),h=splitCsvLine(lines[0]),I=n=>h.indexOf(n);return lines.slice(1).map(line=>{const r=splitCsvLine(line);return{year,player_id:String(r[I('player_id')]),sprint:Number(r[I('sprint_speed')]),h1:Number(r[I('hp_to_1b')])};}).filter(r=>finite(r.sprint)&&finite(r.h1));}
async function fetchText(url,label){const r=await fetch(url,{headers:{'user-agent':'pawapuro-pennant-gpt-handoff research audit'}});if(!r.ok)throw new Error(`${label}: HTTP ${r.status}`);return r.text();}
function solve(A,b){const n=A.length,M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-12)return null;[M[c],M[p]]=[M[p],M[c]];const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;for(let r=0;r<n;r++)if(r!==c){const m=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=m*M[c][j];}}return M.map(r=>r[n]);}
function fit(rows,feature,target,lambda=0){const p=feature(rows[0]).length,A=Array.from({length:p},()=>Array(p).fill(0)),B=Array(p).fill(0);for(const r of rows){const x=feature(r),y=r[target];for(let i=0;i<p;i++){B[i]+=x[i]*y;for(let j=0;j<p;j++)A[i][j]+=x[i]*x[j];}}for(let i=1;i<p;i++)A[i][i]+=lambda;const beta=solve(A,B);return beta?{beta,predict:r=>feature(r).reduce((s,x,i)=>s+x*beta[i],0)}:null;}
function meanSd(a){const v=a.filter(finite),m=v.reduce((s,x)=>s+x,0)/v.length,sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length)||1;return{m,sd,n:v.length};}
function cor(p){if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;let xy=0,xx=0,yy=0;for(const[x,y]of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;}
function rmse(p){return Math.sqrt(p.reduce((s,[x,y])=>s+(x-y)**2,0)/p.length);}
function rank(a){const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),out=Array(a.length);for(let i=0;i<s.length;){let j=i+1;while(j<s.length&&s[j][0]===s[i][0])j++;const r=(i+j-1)/2+1;for(let k=i;k<j;k++)out[s[k][1]]=r;i=j;}return out;}
function spearman(p){const rx=rank(p.map(x=>x[0])),ry=rank(p.map(x=>x[1]));return cor(rx.map((x,i)=>[x,ry[i]]));}
function foldOf(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h)%5;}

// MLB data
const splits=[],sprints=[];
for(const year of YEARS){const[a,b]=await Promise.all([
  fetchText(`https://baseballsavant.mlb.com/running_splits?type=raw&bats=&year=${year}&position=&team=&min=5&csv=true`,`splits ${year}`),
  fetchText(`https://baseballsavant.mlb.com/sprint_speed_leaderboard?year=${year}&position=&team=&min=5&csv=true`,`sprint ${year}`)]);
  splits.push(...parseSplits(a,year));sprints.push(...parseSprint(b,year));
}
const sprintBy=new Map(sprints.map(r=>[`${r.player_id}|${r.year}`,r]));
const rows=splits.map(r=>({...r,...(sprintBy.get(`${r.player_id}|${r.year}`)??{})})).filter(r=>finite(r.sprint)&&finite(r.h1));
console.log(`# MLB complete rows=${rows.length} / players=${new Set(rows.map(r=>r.player_id)).size}`);

// 5-fold player holdout. 各foldで標準化・nuisance・mappingをtrainだけから作る。
const pred=[];
for(let fold=0;fold<5;fold++){
  const train=rows.filter(r=>foldOf(r.player_id)!==fold),test=rows.filter(r=>foldOf(r.player_id)===fold);
  const years=[...new Set(train.map(r=>r.year))].sort();
  // train年ごとのSprint標準化。testも同年train母集団のmean/sdで変換。
  const stats=new Map();for(const y of years){const a=train.filter(r=>r.year===y);stats.set(y,{s:meanSd(a.map(r=>r.sprint)),h:meanSd(a.map(r=>r.h1)),e:meanSd(a.map(r=>r.early))});}
  const enrich=r=>{const st=stats.get(r.year);if(!st)return null;return{...r,sprint_z:(r.sprint-st.s.m)/st.s.sd,h1_z:(r.h1-st.h.m)/st.h.sd,early_z:(r.early-st.e.m)/st.e.sd};};
  const tr=train.map(enrich).filter(Boolean),te=test.map(enrich).filter(Boolean);
  // 目標: early_zから最高速度・打席左右・年度を除く。
  const early=fit(tr,r=>[1,r.sprint_z,r.bats==='L'?1:0,...years.slice(1).map(y=>r.year===y?1:0)],'early_z');
  // 共通観測H1: sprint・打席左右・年度を除く。
  const h1=fit(tr,r=>[1,r.sprint_z,r.bats==='L'?1:0,...years.slice(1).map(y=>r.year===y?1:0)],'h1_z');
  for(const r of tr){r.accel_target=-(r.early_z-early.predict(r));r.h1_fast=-(r.h1_z-h1.predict(r));}
  for(const r of te){r.accel_target=-(r.early_z-early.predict(r));r.h1_fast=-(r.h1_z-h1.predict(r));}
  // candidate mapping. targetは「同じtop speedでも5->30が速いほど大」。
  for(const keys of [['h1_fast'],['h1_fast','sprint_z']]){
    const key=keys.join('+');
    const feature=r=>[1,...keys.map(k=>r[k])];
    const m=fit(tr,feature,'accel_target',3);
    for(const r of te)pred.push({model:key,p:m.predict(r),y:r.accel_target,player_id:r.player_id,year:r.year});
  }
}
for(const model of [...new Set(pred.map(r=>r.model))]){const a=pred.filter(r=>r.model===model),p=a.map(r=>[r.p,r.y]);console.log(`MLB holdout ${model.padEnd(20)} n=${a.length} rmse=${rmse(p).toFixed(3)} r=${cor(p)?.toFixed(3)} rho=${spearman(p)?.toFixed(3)}`);}

// Full MLB standardized mapping to transfer in z-space.
const yearStats=new Map();for(const y of YEARS){const a=rows.filter(r=>r.year===y);yearStats.set(y,{s:meanSd(a.map(r=>r.sprint)),h:meanSd(a.map(r=>r.h1)),e:meanSd(a.map(r=>r.early))});}
const full=rows.map(r=>{const st=yearStats.get(r.year);return{...r,sprint_z:(r.sprint-st.s.m)/st.s.sd,h1_z:(r.h1-st.h.m)/st.h.sd,early_z:(r.early-st.e.m)/st.e.sd};});
const years=[...new Set(full.map(r=>r.year))].sort();
const early=fit(full,r=>[1,r.sprint_z,r.bats==='L'?1:0,...years.slice(1).map(y=>r.year===y?1:0)],'early_z');
const h1=fit(full,r=>[1,r.sprint_z,r.bats==='L'?1:0,...years.slice(1).map(y=>r.year===y?1:0)],'h1_z');
for(const r of full){r.accel_target=-(r.early_z-early.predict(r));r.h1_fast=-(r.h1_z-h1.predict(r));}
const map=fit(full,r=>[1,r.h1_fast],'accel_target',3);
console.log(`full standardized mapping accel_z ~= ${map.beta[0].toFixed(4)} + ${map.beta[1].toFixed(4)} * H1_fast_z`);

// NPB+ 2026: within-NPB standardization only. MLB absolute units are not assumed identical.
const npb=db.prepare(`SELECT player_id,name,top_speed_kmh,hp_to_1b_sec FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL AND hp_to_1b_sec IS NOT NULL`).all();
const handRows=db.prepare(`SELECT l.proeye_id,t.season,t.bats FROM nf3_team_link l JOIN nf3_team_bat t ON t.season=l.season AND t.name_norm=l.name_norm WHERE t.bats IS NOT NULL AND t.bats<>'' AND t.season<=2025`).all();
const latest=new Map();for(const r of handRows){const p=latest.get(String(r.proeye_id));if(!p||r.season>p.season)latest.set(String(r.proeye_id),r);}
const n=npb.map(r=>({...r,bats:latest.get(String(r.player_id))?.bats??null})).filter(r=>r.bats==='右'||r.bats==='左');
const ns=meanSd(n.map(r=>r.top_speed_kmh)),nh=meanSd(n.map(r=>r.hp_to_1b_sec));
for(const r of n){r.sprint_z=(r.top_speed_kmh-ns.m)/ns.sd;r.h1_z=(r.hp_to_1b_sec-nh.m)/nh.sd;}
// NPB内で H1_z ~ sprint_z + side をfitし、相対H1残差を作る。
const nh1=fit(n,r=>[1,r.sprint_z,r.bats==='左'?1:0],'h1_z');
for(const r of n){r.h1_fast=-(r.h1_z-nh1.predict(r));r.accel_z_est=map.predict(r);}
console.log(`\n# NPB+ standardized acceleration candidates n=${n.length}`);
for(const name of ['周東 佑京','源田 壮亮','矢野 雅哉','小園 海斗']){const r=n.find(x=>x.name===name);if(r)console.log(`${name}: sprint_z=${r.sprint_z.toFixed(3)} H1_fast_z=${r.h1_fast.toFixed(3)} accel_z_est=${r.accel_z_est.toFixed(3)} raw=${r.top_speed_kmh.toFixed(1)}km/h/${r.hp_to_1b_sec.toFixed(2)}s`);}
const top=[...n].sort((a,b)=>b.accel_z_est-a.accel_z_est).slice(0,10);console.log('estimated acceleration top10: '+top.map(r=>`${r.name} ${r.accel_z_est.toFixed(2)}`).join(' / '));

console.log('\n判定: MLB player-holdoutでH1_fastが5->30ft加速を十分予測できた場合のみ、NPB+2026のaccel_z_estを「直接計測から導いた加速候補」として保存可。弱ければH1は技術混在のまま隔離する。');
db.close();

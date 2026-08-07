// NPB結果proxyが、純粋な身体軸「最高速度」と「5->30ft加速」を別々に予測できるか監査する。
//
// 教師:
// - MLB Statcast Sprint Speed（最高速度側）
// - MLB 90ft Splitsの5->30ftを、Sprint Speed・左右・年度で説明した残差（加速側）
//
// NPB側:
// - 併殺回避 / UBR / 内野安打（現時点の候補。走力へ直加算しない）
// - 各年のリーグ内zへ変換し、対象年と過去2年だけをPA加重でpool
//
// 時間規律:
// - 教師はNPB対象年「以前」の最新MLB直接年だけ。最大3年前まで。
// - player-level foldで同一選手がtrain/testを跨がない。
//
// 目的は採用可否の監査であり、能力値は生成しない。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const YEARS=[2017,2018,2019,2020,2021,2022,2023,2024,2025];
const KEYS=['gdp_avoid','ubr_pa','ih_inplay'];
const finite=Number.isFinite;
const norm=s=>(s??'').normalize('NFKC').replace(/[\s　]/g,'').toLowerCase();

function splitCsvLine(line){const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){out.push(f);f='';}else f+=c;}out.push(f);return out;}
const csvLines=t=>t.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);
function parseSplits(text,year){const lines=csvLines(text),h=splitCsvLine(lines[0]),I=n=>h.indexOf(n);const ix={};for(let ft=0;ft<=30;ft+=5)ix[ft]=I(`seconds_since_hit_${String(ft).padStart(3,'0')}`);return lines.slice(1).map(line=>{const r=splitCsvLine(line),t={};for(let ft=0;ft<=30;ft+=5)t[ft]=Number(r[ix[ft]]);return{year,mlb_id:String(r[I('player_id')]),key:norm(r[I('last_name, first_name')]),bats:r[I('bat_side')],t};}).filter(r=>finite(r.t[5])&&finite(r.t[30]));}
function parseSprint(text,year){const lines=csvLines(text),h=splitCsvLine(lines[0]),I=n=>h.indexOf(n);return lines.slice(1).map(line=>{const r=splitCsvLine(line);return{year,mlb_id:String(r[I('player_id')]),sprint:Number(r[I('sprint_speed')])};}).filter(r=>finite(r.sprint));}
async function fetchText(url,label){const r=await fetch(url,{headers:{'user-agent':'pawapuro-pennant-gpt-handoff research audit'}});if(!r.ok)throw new Error(`${label}: HTTP ${r.status}`);return r.text();}
function solve(A,b){const n=A.length,M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-12)return null;[M[c],M[p]]=[M[p],M[c]];const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;for(let r=0;r<n;r++)if(r!==c){const m=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=m*M[c][j];}}return M.map(r=>r[n]);}
function ols(rows,feature,target){const p=feature(rows[0]).length,A=Array.from({length:p},()=>Array(p).fill(0)),B=Array(p).fill(0);for(const r of rows){const x=feature(r),y=r[target];for(let i=0;i<p;i++){B[i]+=x[i]*y;for(let j=0;j<p;j++)A[i][j]+=x[i]*x[j];}}const beta=solve(A,B);return beta? r=>feature(r).reduce((s,x,i)=>s+x*beta[i],0):null;}
function cor(pairs){if(pairs.length<3)return null;const mx=pairs.reduce((s,x)=>s+x[0],0)/pairs.length,my=pairs.reduce((s,x)=>s+x[1],0)/pairs.length;let xy=0,xx=0,yy=0;for(const[x,y]of pairs){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;}
function rank(a){const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),out=Array(a.length);for(let i=0;i<s.length;){let j=i+1;while(j<s.length&&s[j][0]===s[i][0])j++;const r=(i+j-1)/2+1;for(let k=i;k<j;k++)out[s[k][1]]=r;i=j;}return out;}
function spearman(p){if(p.length<3)return null;const rx=rank(p.map(x=>x[0])),ry=rank(p.map(x=>x[1]));return cor(rx.map((x,i)=>[x,ry[i]]));}

// --- MLB physical labels ---
const splits=[],sprints=[];
for(const year of YEARS){const [a,b]=await Promise.all([
  fetchText(`https://baseballsavant.mlb.com/running_splits?type=raw&bats=&year=${year}&position=&team=&min=5&csv=true`,`splits ${year}`),
  fetchText(`https://baseballsavant.mlb.com/sprint_speed_leaderboard?year=${year}&position=&team=&min=5&csv=true`,`sprint ${year}`)]);
  splits.push(...parseSplits(a,year));sprints.push(...parseSprint(b,year));
}
const sprintBy=new Map(sprints.map(r=>[`${r.mlb_id}|${r.year}`,r.sprint]));
const full=splits.map(r=>({...r,sprint:sprintBy.get(`${r.mlb_id}|${r.year}`),early_5_30:r.t[30]-r.t[5]})).filter(r=>finite(r.sprint));
const fy=[...new Set(full.map(r=>r.year))].sort();
const accelModel=ols(full.map(r=>({...r,target:r.early_5_30})),r=>[1,r.sprint,r.bats==='L'?1:0,...fy.slice(1).map(y=>r.year===y?1:0)],'target');
for(const r of full)r.accel_resid_sec=r.early_5_30-accelModel(r); // 負ほど最高速度の割に加速区間が速い

// mlb_bridge name -> proeye_id
const bridge=db.prepare(`SELECT proeye_id,mlb_name FROM mlb_bridge WHERE proeye_id IS NOT NULL AND mlb_name IS NOT NULL`).all();
const proeyeByMlbName=new Map(bridge.map(r=>[norm(r.mlb_name),String(r.proeye_id)]));
const directByProeye=new Map();
for(const r of full){const pid=proeyeByMlbName.get(r.key);if(!pid)continue;if(!directByProeye.has(pid))directByProeye.set(pid,[]);directByProeye.get(pid).push({year:r.year,sprint:r.sprint,accel:r.accel_resid_sec});}
for(const a of directByProeye.values())a.sort((x,y)=>x.year-y.year);
console.log(`# bridge players with direct physical axes=${directByProeye.size}`);

// --- NPB annual features for all players, year-standardized ---
const raw=db.prepare(`
  SELECT b.player_id,b.name,b.season,b.pa,b.ab,b.so,b.gdp,bm.ubr,m.gb_pct,t.ih
  FROM v_batting b
  LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.position<>'投' AND b.season BETWEEN 2017 AND 2025 AND b.pa>=50`).all().map(r=>{
    const ip=Math.max(1,(r.ab??0)-(r.so??0)),gb=Math.max(1,ip*((r.gb_pct??45)/100));
    return{player_id:String(r.player_id),name:r.name,season:r.season,pa:r.pa,
      gdp_avoid:-(r.gdp??0)/gb,ubr_pa:r.ubr!=null&&r.pa>0?r.ubr/r.pa:null,ih_inplay:r.ih!=null?r.ih/ip:null};
  });
const norms=new Map();
for(const y of YEARS){const a=raw.filter(r=>r.season===y),o={};for(const k of KEYS){const v=a.map(r=>r[k]).filter(finite);const m=v.reduce((s,x)=>s+x,0)/v.length,sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length)||1;o[k]={m,sd};}norms.set(y,o);}
for(const r of raw){const n=norms.get(r.season);for(const k of KEYS)r[`${k}_z`]=finite(r[k])?(r[k]-n[k].m)/n[k].sd:null;}
const annualByPlayer=new Map();for(const r of raw){if(!annualByPlayer.has(r.player_id))annualByPlayer.set(r.player_id,[]);annualByPlayer.get(r.player_id).push(r);}

function pooledFeatures(pid,season){const a=(annualByPlayer.get(pid)??[]).filter(r=>r.season>=season-2&&r.season<=season&&KEYS.every(k=>finite(r[`${k}_z`])));if(!a.length)return null;const w=a.reduce((s,r)=>s+r.pa,0);if(!(w>0))return null;return{...Object.fromEntries(KEYS.map(k=>[k,a.reduce((s,r)=>s+r[`${k}_z`]*r.pa,0)/w])),pa:w,years:a.map(r=>r.season)};}
function priorDirect(pid,season,maxGap){const a=(directByProeye.get(pid)??[]).filter(x=>x.year<=season&&season-x.year<=maxGap);return a.length?a[a.length-1]:null;}

function ridgeFit(train,keys,target,alpha){const means=keys.map(k=>train.reduce((s,r)=>s+r[k],0)/train.length),sds=keys.map((k,i)=>Math.sqrt(train.reduce((s,r)=>s+(r[k]-means[i])**2,0)/train.length)||1),ym=train.reduce((s,r)=>s+r[target],0)/train.length;const p=keys.length,A=Array.from({length:p},()=>Array(p).fill(0)),B=Array(p).fill(0);for(const r of train){const x=keys.map((k,i)=>(r[k]-means[i])/sds[i]),y=r[target]-ym;for(let i=0;i<p;i++){B[i]+=x[i]*y;for(let j=0;j<p;j++)A[i][j]+=x[i]*x[j];}}for(let i=0;i<p;i++)A[i][i]+=alpha;const beta=solve(A,B);return beta? r=>ym+beta.reduce((s,b,i)=>s+b*((r[keys[i]]-means[i])/sds[i]),0):null;}
const foldOf=id=>{let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h)%5;};
function cv(rows,keys,target,alpha){const p=[];for(let f=0;f<5;f++){const tr=rows.filter(r=>foldOf(r.player_id)!==f),te=rows.filter(r=>foldOf(r.player_id)===f);if(!tr.length||!te.length)continue;const model=ridgeFit(tr,keys,target,alpha);for(const r of te)p.push([model(r),r[target]]);}const rmse=Math.sqrt(p.reduce((s,[x,y])=>s+(x-y)**2,0)/p.length);return{n:p.length,rmse,r:cor(p),rho:spearman(p)};}

for(const gap of [0,1,2,3]){
  const sample=[];
  for(const [pid,a] of annualByPlayer){if(!directByProeye.has(pid))continue;for(const r of a){const f=pooledFeatures(pid,r.season),d=priorDirect(pid,r.season,gap);if(!f||!d)continue;sample.push({player_id:pid,name:r.name,season:r.season,direct_year:d.year,gap:r.season-d.year,...f,top_speed:d.sprint,accel:d.accel});}}
  // 同一player-seasonがannualループで重複しないようseasonキーでdedup
  const uniq=[...new Map(sample.map(r=>[`${r.player_id}|${r.season}`,r])).values()];
  console.log(`\n# direct maxGap=${gap}: player-seasons=${uniq.length} / players=${new Set(uniq.map(r=>r.player_id)).size}`);
  if(uniq.length<15)continue;
  for(const target of ['top_speed','accel']){
    let best=null;for(const alpha of [0,1,3,10,30,100]){const v=cv(uniq,KEYS,target,alpha);if(!best||v.rmse<best.rmse)best={alpha,...v};}
    console.log(`${target.padEnd(10)} best alpha=${best.alpha} n=${best.n} rmse=${best.rmse.toFixed(3)} r=${best.r?.toFixed(3)} rho=${best.rho?.toFixed(3)}`);
  }
}

// 最大3年のサンプルで特徴単独との関係も表示。
const final=[];for(const [pid,a] of annualByPlayer){if(!directByProeye.has(pid))continue;for(const r of a){const f=pooledFeatures(pid,r.season),d=priorDirect(pid,r.season,3);if(f&&d)final.push({player_id:pid,season:r.season,...f,top_speed:d.sprint,accel:d.accel});}}
const uniq=[...new Map(final.map(r=>[`${r.player_id}|${r.season}`,r])).values()];
console.log('\n# single-feature directions (maxGap=3)');
for(const k of KEYS)console.log(`${k.padEnd(10)} top r=${cor(uniq.map(r=>[r[k],r.top_speed]))?.toFixed(3)} / accel(faster=-sec) r=${cor(uniq.map(r=>[r[k],-r.accel]))?.toFixed(3)}`);

// 2024 sanity three players: top-speed modelとacceleration modelを別々に出す。合成重みはここでは決めない。
if(uniq.length>=15){
  const bestFor=target=>{let b=null;for(const alpha of [0,1,3,10,30,100]){const v=cv(uniq,KEYS,target,alpha);if(!b||v.rmse<b.rmse)b={alpha,...v};}return b;};
  const bt=bestFor('top_speed'),ba=bestFor('accel'),mt=ridgeFit(uniq,KEYS,'top_speed',bt.alpha),ma=ridgeFit(uniq,KEYS,'accel',ba.alpha);
  const ids=[['周東 佑京','21925136'],['近本 光司',db.prepare(`SELECT player_id FROM v_batting WHERE season=2024 AND name LIKE '%近本%' LIMIT 1`).get()?.player_id],['源田 壮亮','71775134']];
  const s=[];for(const[name,id]of ids){if(!id)continue;const f=pooledFeatures(String(id),2024);if(f)s.push({name,top:mt(f),accel:ma(f)});}
  console.log('\n# 2024 sanity: physical axes are NOT combined here');
  console.log('top-speed prediction: '+[...s].sort((a,b)=>b.top-a.top).map(x=>`${x.name} ${x.top.toFixed(2)}ft/s`).join(' > '));
  console.log('acceleration prediction (lower residual sec = faster for same top speed): '+[...s].sort((a,b)=>a.accel-b.accel).map(x=>`${x.name} ${x.accel.toFixed(4)}s`).join(' > '));
}

console.log('\n判定: proxyがtopとaccelerationの両軸を別々にholdout予測できるかを見る。できても最終走力への合成重みは自作エンジンの27〜30m走応答から決める。');
db.close();

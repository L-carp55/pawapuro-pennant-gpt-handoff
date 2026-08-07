// joint speed+skill factorの証拠期間を、2026直接最高速度へのplayer-holdoutだけで選ぶ。
// 3人sanityに合わせて窓を選ばない。
//
// calibration: 2023-2025 annual outcomes + 2026 NPB+ top speed
// inference windows for target 2026:
//   latest1 = 2025
//   latest2 = 2024-2025
//   latest3 = 2023-2025
//   latest4 = 2022-2025
//
// 最良windowを機械的に選び、2024 sanityでは同じ長さをtarget yearへ平行移動する。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const KEYS=['ih_inplay','ubr_pa','gdp_avoid'],NORM_YEARS=[2021,2022,2023,2024,2025],CAL_YEARS=[2023,2024,2025];
const finite=Number.isFinite;
function meanSd(a){const v=a.filter(finite),m=v.reduce((s,x)=>s+x,0)/v.length,sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))||1;return{m,sd};}
function cor(p){if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;let xy=0,xx=0,yy=0;for(const[x,y]of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;}
function rank(a){const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),o=Array(a.length);for(let i=0;i<s.length;){let j=i+1;while(j<s.length&&s[j][0]===s[i][0])j++;const r=(i+j-1)/2+1;for(let k=i;k<j;k++)o[s[k][1]]=r;i=j;}return o;}
function spearman(p){const a=rank(p.map(x=>x[0])),b=rank(p.map(x=>x[1]));return cor(a.map((x,i)=>[x,b[i]]));}
function lin(xs,ys){const mx=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,x)=>s+x,0)/ys.length;let xx=0,xy=0;for(let i=0;i<xs.length;i++){xx+=(xs[i]-mx)**2;xy+=(xs[i]-mx)*(ys[i]-my);}const slope=xx>0?xy/xx:0;return{intercept:my-slope*mx,slope};}
function foldOf(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h)%5;}
const direct=db.prepare(`SELECT player_id,name,top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all(),ds=meanSd(direct.map(r=>r.top_speed_kmh));
const speedBy=new Map(direct.map(r=>[String(r.player_id),{name:r.name,speed_z:(r.top_speed_kmh-ds.m)/ds.sd}]));
const raw=db.prepare(`SELECT b.player_id,b.name,b.season,b.pa,b.ab,b.so,b.gdp,bm.ubr,m.gb_pct,t.ih FROM v_batting b LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0 LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0 LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm WHERE b.position<>'投' AND b.season BETWEEN 2021 AND 2025 AND b.pa>=50`).all().map(r=>{const ip=Math.max(1,(r.ab??0)-(r.so??0)),gb=Math.max(1,ip*((r.gb_pct??45)/100));return{player_id:String(r.player_id),name:r.name,season:r.season,pa:r.pa,ih_inplay:r.ih!=null?r.ih/ip:null,ubr_pa:r.ubr!=null&&r.pa>0?r.ubr/r.pa:null,gdp_avoid:-(r.gdp??0)/gb};});
const norms=new Map();for(const y of NORM_YEARS){const a=raw.filter(r=>r.season===y),o={};for(const k of KEYS)o[k]=meanSd(a.map(r=>r[k]));norms.set(y,o);}for(const r of raw){const n=norms.get(r.season);for(const k of KEYS)r[`${k}_z`]=finite(r[k])?(r[k]-n[k].m)/n[k].sd:null;}
const by=new Map();for(const r of raw){if(!by.has(r.player_id))by.set(r.player_id,[]);by.get(r.player_id).push(r);}
function calibrate(ids){const cal={};for(const k of KEYS){const a=[];for(const id of ids){const s=speedBy.get(id);if(!s)continue;for(const r of by.get(id)??[])if(CAL_YEARS.includes(r.season)&&finite(r[`${k}_z`]))a.push({...r,speed_z:s.speed_z});}const m=lin(a.map(r=>r.speed_z),a.map(r=>r[`${k}_z`]));for(const r of a)r.resid=r[`${k}_z`]-(m.intercept+m.slope*r.speed_z);const rv=meanSd(a.map(r=>r.resid)).sd**2,mp=new Map();for(const r of a){if(!mp.has(r.player_id))mp.set(r.player_id,new Map());mp.get(r.player_id).set(r.season,r.resid);}const pairs=[];for(const x of mp.values())for(const[y,v]of x)if(x.has(y+1))pairs.push([v,x.get(y+1)]);const rep=Math.max(0,Math.min(.95,cor(pairs)??0));cal[k]={...m,skill_var:rv*rep,noise_var:rv*(1-rep)};}return cal;}
function aggregate(id,start,end){const rows=(by.get(id)??[]).filter(r=>r.season>=start&&r.season<=end),o={player_id:id};for(const k of KEYS){const a=rows.filter(r=>finite(r[`${k}_z`])&&r.pa>0),w=a.reduce((s,r)=>s+r.pa,0);if(!a.length||!(w>0)){o[k]=null;continue;}o[k]=a.reduce((s,r)=>s+r[`${k}_z`]*r.pa,0)/w;o[`${k}_nf`]=a.reduce((s,r)=>s+(r.pa/w)**2,0);}return o;}
function infer(o,cal){let den=1,num=0,used=0;for(const k of KEYS){if(!finite(o[k]))continue;const c=cal[k],v=Math.max(1e-6,c.skill_var+c.noise_var*(o[`${k}_nf`]??1));den+=c.slope*c.slope/v;num+=c.slope*(o[k]-c.intercept)/v;used++;}return{z:num/den,used,sd:Math.sqrt(1/den)};}
const ids=[...speedBy.keys()].filter(id=>(by.get(id)??[]).some(r=>CAL_YEARS.includes(r.season)));
const windows=[1,2,3,4],results=[];
for(const w of windows){const p=[];for(let f=0;f<5;f++){const tr=ids.filter(id=>foldOf(id)!==f),te=ids.filter(id=>foldOf(id)===f),cal=calibrate(tr);for(const id of te){const inf=infer(aggregate(id,2026-w,2025),cal),truth=speedBy.get(id)?.speed_z;if(inf.used>=2&&finite(truth))p.push([inf.z,truth]);}}const v={w,n:p.length,r:cor(p),rho:spearman(p),rmse:Math.sqrt(p.reduce((s,[x,y])=>s+(x-y)**2,0)/p.length)};results.push(v);console.log(`window=${w}y n=${v.n} r=${v.r.toFixed(3)} rho=${v.rho.toFixed(3)} rmse_z=${v.rmse.toFixed(3)}`);}
const best=[...results].sort((a,b)=>a.rmse-b.rmse)[0];console.log(`\nBEST=${best.w}y by holdout RMSE`);
const cal=calibrate(ids),target=2024,start=target-best.w+1;
const sanity=[['周東 佑京','21925136'],['近本 光司',db.prepare(`SELECT player_id FROM v_batting WHERE season=2024 AND name LIKE '%近本%' LIMIT 1`).get()?.player_id],['源田 壮亮','71775134']];
const out=[];for(const[name,id0]of sanity){if(!id0)continue;const inf=infer(aggregate(String(id0),start,target),cal);out.push({name,...inf});}out.sort((a,b)=>b.z-a.z);console.log(`2024 same ${best.w}y window (${start}-${target}): `+out.map(x=>`${x.name} z=${x.z.toFixed(3)}`).join(' > '));
console.log('sanity target（学習には使わない）: 周東 > 近本 > 源田');
db.close();

// joint speed+skill factorのskill priorを2020-2025へ広げて再較正する監査。
// 2026 NPB+ top speedは集団較正の教師にだけ使用し、2024 sanityの個人観測には2024以前しか使わない。
//
// 長期化の目的:
// 3年だけではskill残差のrepeatabilityが過小推定され、内野安打/UBR等のskill分までspeedへ戻す可能性がある。
// 一方、2026速度を2020へ固定することで身体能力の経年変化を無視する副作用もあるため、
// 最終採否はplayer-holdout性能とsanityの両方で判断する。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const YEARS=[2020,2021,2022,2023,2024,2025],KEYS=['ih_inplay','ubr_pa','gdp_avoid'];
const finite=Number.isFinite;
function meanSd(a){const v=a.filter(finite),m=v.reduce((s,x)=>s+x,0)/v.length,sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))||1;return{m,sd};}
function cor(p){if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;let xy=0,xx=0,yy=0;for(const[x,y]of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;}
function rank(a){const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),o=Array(a.length);for(let i=0;i<s.length;){let j=i+1;while(j<s.length&&s[j][0]===s[i][0])j++;const r=(i+j-1)/2+1;for(let k=i;k<j;k++)o[s[k][1]]=r;i=j;}return o;}
function spearman(p){const a=rank(p.map(x=>x[0])),b=rank(p.map(x=>x[1]));return cor(a.map((x,i)=>[x,b[i]]));}
function lin(xs,ys){const mx=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,x)=>s+x,0)/ys.length;let xx=0,xy=0;for(let i=0;i<xs.length;i++){xx+=(xs[i]-mx)**2;xy+=(xs[i]-mx)*(ys[i]-my);}const slope=xx>0?xy/xx:0;return{intercept:my-slope*mx,slope};}
function foldOf(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h)%5;}
const direct=db.prepare(`SELECT player_id,name,top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all(),ds=meanSd(direct.map(r=>r.top_speed_kmh));
const speedBy=new Map(direct.map(r=>[String(r.player_id),{name:r.name,speed_z:(r.top_speed_kmh-ds.m)/ds.sd}]));
const raw=db.prepare(`SELECT b.player_id,b.name,b.season,b.pa,b.ab,b.so,b.gdp,bm.ubr,m.gb_pct,t.ih FROM v_batting b LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0 LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0 LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm WHERE b.position<>'投' AND b.season BETWEEN 2020 AND 2025 AND b.pa>=50`).all().map(r=>{const ip=Math.max(1,(r.ab??0)-(r.so??0)),gb=Math.max(1,ip*((r.gb_pct??45)/100));return{player_id:String(r.player_id),name:r.name,season:r.season,pa:r.pa,ih_inplay:r.ih!=null?r.ih/ip:null,ubr_pa:r.ubr!=null&&r.pa>0?r.ubr/r.pa:null,gdp_avoid:-(r.gdp??0)/gb};});
const norms=new Map();for(const y of YEARS){const a=raw.filter(r=>r.season===y),o={};for(const k of KEYS)o[k]=meanSd(a.map(r=>r[k]));norms.set(y,o);}for(const r of raw){const n=norms.get(r.season);for(const k of KEYS)r[`${k}_z`]=finite(r[k])?(r[k]-n[k].m)/n[k].sd:null;}
const by=new Map();for(const r of raw){if(!by.has(r.player_id))by.set(r.player_id,[]);by.get(r.player_id).push(r);}
function calibrate(ids,calStart){const cal={};for(const k of KEYS){const a=[];for(const id of ids){const s=speedBy.get(id);if(!s)continue;for(const r of by.get(id)??[])if(r.season>=calStart&&finite(r[`${k}_z`]))a.push({...r,speed_z:s.speed_z});}const m=lin(a.map(r=>r.speed_z),a.map(r=>r[`${k}_z`]));for(const r of a)r.resid=r[`${k}_z`]-(m.intercept+m.slope*r.speed_z);const rv=meanSd(a.map(r=>r.resid)).sd**2,mp=new Map();for(const r of a){if(!mp.has(r.player_id))mp.set(r.player_id,new Map());mp.get(r.player_id).set(r.season,r.resid);}const pairs=[];for(const x of mp.values())for(const[y,v]of x)if(x.has(y+1))pairs.push([v,x.get(y+1)]);const rep=Math.max(0,Math.min(.95,cor(pairs)??0));cal[k]={...m,skill_var:rv*rep,noise_var:rv*(1-rep),repeat:rep,pairs:pairs.length,rows:a.length};}return cal;}
function aggregate(id,start,end){const rows=(by.get(id)??[]).filter(r=>r.season>=start&&r.season<=end),o={};for(const k of KEYS){const a=rows.filter(r=>finite(r[`${k}_z`])&&r.pa>0),w=a.reduce((s,r)=>s+r.pa,0);if(!a.length||!(w>0)){o[k]=null;continue;}o[k]=a.reduce((s,r)=>s+r[`${k}_z`]*r.pa,0)/w;o[`${k}_nf`]=a.reduce((s,r)=>s+(r.pa/w)**2,0);}return o;}
function infer(o,cal){let den=1,num=0,used=0;const d={};for(const k of KEYS){if(!finite(o[k]))continue;const c=cal[k],nf=o[`${k}_nf`]??1,v=Math.max(1e-6,c.skill_var+c.noise_var*nf);den+=c.slope*c.slope/v;num+=c.slope*(o[k]-c.intercept)/v;d[k]={v};used++;}const z=num/den;for(const k of KEYS){if(!d[k])continue;const c=cal[k],nf=o[`${k}_nf`]??1,res=o[k]-(c.intercept+c.slope*z),sv=c.skill_var,nv=c.noise_var*nf;d[k].skill=sv>0?res*sv/(sv+nv):0;}return{z,used,sd:Math.sqrt(1/den),detail:d};}
const ids=[...speedBy.keys()].filter(id=>(by.get(id)??[]).some(r=>r.season>=2020));
for(const calStart of [2023,2022,2021,2020]){
  for(const window of [2,3,4]){
    const p=[];for(let f=0;f<5;f++){const tr=ids.filter(id=>foldOf(id)!==f),te=ids.filter(id=>foldOf(id)===f),cal=calibrate(tr,calStart);for(const id of te){const inf=infer(aggregate(id,2026-window,2025),cal),truth=speedBy.get(id)?.speed_z;if(inf.used>=2&&finite(truth))p.push([inf.z,truth]);}}
    const rmse=Math.sqrt(p.reduce((s,[x,y])=>s+(x-y)**2,0)/p.length);console.log(`cal=${calStart}-25 window=${window}y n=${p.length} r=${cor(p)?.toFixed(3)} rho=${spearman(p)?.toFixed(3)} rmse=${rmse.toFixed(3)}`);
  }
  const c=calibrate(ids,calStart);console.log(`  priors: `+KEYS.map(k=>`${k}[load=${c[k].slope.toFixed(3)},rep=${c[k].repeat.toFixed(3)},pairs=${c[k].pairs}]`).join(' / '));
}
// 全候補からholdout RMSE最小を再計算して選ぶ
let best=null;for(const calStart of [2023,2022,2021,2020])for(const window of [2,3,4]){const p=[];for(let f=0;f<5;f++){const tr=ids.filter(id=>foldOf(id)!==f),te=ids.filter(id=>foldOf(id)===f),cal=calibrate(tr,calStart);for(const id of te){const inf=infer(aggregate(id,2026-window,2025),cal),truth=speedBy.get(id)?.speed_z;if(inf.used>=2&&finite(truth))p.push([inf.z,truth]);}}const v={calStart,window,p,rmse:Math.sqrt(p.reduce((s,[x,y])=>s+(x-y)**2,0)/p.length)};if(!best||v.rmse<best.rmse)best=v;}
console.log(`\nBEST cal=${best.calStart}-25 window=${best.window}y rmse=${best.rmse.toFixed(3)} r=${cor(best.p).toFixed(3)}`);
const cal=calibrate(ids,best.calStart),start=2024-best.window+1,sanity=[['周東 佑京','21925136'],['近本 光司',db.prepare(`SELECT player_id FROM v_batting WHERE season=2024 AND name LIKE '%近本%' LIMIT 1`).get()?.player_id],['源田 壮亮','71775134']],out=[];for(const[name,id0]of sanity){if(!id0)continue;const inf=infer(aggregate(String(id0),start,2024),cal);out.push({name,...inf});}out.sort((a,b)=>b.z-a.z);console.log(`2024 same config (${start}-2024): `+out.map(x=>`${x.name} z=${x.z.toFixed(3)}`).join(' > '));
for(const x of out)console.log(`  ${x.name} skill posterior: `+KEYS.map(k=>`${k}=${x.detail[k]?.skill?.toFixed(3)??'—'}`).join(' / '));
console.log('sanity target: 周東 > 近本 > 源田');
db.close();

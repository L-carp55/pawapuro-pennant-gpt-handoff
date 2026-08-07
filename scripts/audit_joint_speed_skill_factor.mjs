// 走力と走塁系skillを同時に分離する最小ベイズ因子モデルのplayer-holdout監査。
//
// annual outcome:
//   y_j = intercept_j + loading_j * physical_top_speed_z + stable_skill_j + annual_noise_j
//
// j = 内野安打 / UBR / 併殺回避。
// skillは項目ごとに独立prior。残差の隣接年再現性から stable_skill variance と annual_noise variance を分ける。
// 複数年を平均するとannual noiseだけが減り、stable skillは残る。この構造を使い、
// speedを「3結果の共通因子」、skillを「各結果固有残差」として同時に推定する。
//
// 盗塁・三塁打はspeed inferenceに使わない。
// 最終100段階能力は生成しない。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const NORM_YEARS=[2022,2023,2024,2025];
const CAL_YEARS=[2023,2024,2025];
const KEYS=['ih_inplay','ubr_pa','gdp_avoid'];
const finite=Number.isFinite;

function meanSd(a){const v=a.filter(finite),m=v.reduce((s,x)=>s+x,0)/v.length,sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))||1;return{m,sd,n:v.length};}
function cor(p){if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;let xy=0,xx=0,yy=0;for(const[x,y]of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;}
function rank(a){const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),out=Array(a.length);for(let i=0;i<s.length;){let j=i+1;while(j<s.length&&s[j][0]===s[i][0])j++;const r=(i+j-1)/2+1;for(let k=i;k<j;k++)out[s[k][1]]=r;i=j;}return out;}
function spearman(p){const rx=rank(p.map(x=>x[0])),ry=rank(p.map(x=>x[1]));return cor(rx.map((x,i)=>[x,ry[i]]));}
function lin(xs,ys){const mx=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,x)=>s+x,0)/ys.length;let xx=0,xy=0;for(let i=0;i<xs.length;i++){xx+=(xs[i]-mx)**2;xy+=(xs[i]-mx)*(ys[i]-my);}const slope=xx>0?xy/xx:0;return{intercept:my-slope*mx,slope};}
function foldOf(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h)%5;}

const direct=db.prepare(`SELECT player_id,name,top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all();
const directStats=meanSd(direct.map(r=>r.top_speed_kmh));
const speedBy=new Map(direct.map(r=>[String(r.player_id),{name:r.name,speed_z:(r.top_speed_kmh-directStats.m)/directStats.sd,top:r.top_speed_kmh}]));

const raw=db.prepare(`
  SELECT b.player_id,b.name,b.season,b.pa,b.ab,b.so,b.gdp,bm.ubr,m.gb_pct,t.ih
  FROM v_batting b
  LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.position<>'投' AND b.season BETWEEN 2022 AND 2025 AND b.pa>=50`).all().map(r=>{
    const ip=Math.max(1,(r.ab??0)-(r.so??0)),gb=Math.max(1,ip*((r.gb_pct??45)/100));
    return{player_id:String(r.player_id),name:r.name,season:r.season,pa:r.pa,
      ih_inplay:r.ih!=null?r.ih/ip:null,
      ubr_pa:r.ubr!=null&&r.pa>0?r.ubr/r.pa:null,
      gdp_avoid:-(r.gdp??0)/gb};
  });
const norms=new Map();for(const y of NORM_YEARS){const a=raw.filter(r=>r.season===y),o={};for(const k of KEYS)o[k]=meanSd(a.map(r=>r[k]));norms.set(y,o);}
for(const r of raw){const n=norms.get(r.season);for(const k of KEYS)r[`${k}_z`]=finite(r[k])?(r[k]-n[k].m)/n[k].sd:null;}
const byPlayer=new Map();for(const r of raw){if(!byPlayer.has(r.player_id))byPlayer.set(r.player_id,[]);byPlayer.get(r.player_id).push(r);}

function calibrate(trainIds){
  const cal={};
  for(const k of KEYS){
    const rows=[];for(const id of trainIds){const s=speedBy.get(id);if(!s)continue;for(const r of byPlayer.get(id)??[])if(CAL_YEARS.includes(r.season)&&finite(r[`${k}_z`]))rows.push({...r,speed_z:s.speed_z});}
    const m=lin(rows.map(r=>r.speed_z),rows.map(r=>r[`${k}_z`]));
    for(const r of rows)r.resid=r[`${k}_z`]-(m.intercept+m.slope*r.speed_z);
    const rv=meanSd(rows.map(r=>r.resid)).sd**2;
    const mp=new Map();for(const r of rows){if(!mp.has(r.player_id))mp.set(r.player_id,new Map());mp.get(r.player_id).set(r.season,r.resid);}
    const pairs=[];for(const x of mp.values())for(const[y,v]of x)if(x.has(y+1))pairs.push([v,x.get(y+1)]);
    const repeat=Math.max(0,Math.min(0.95,cor(pairs)??0));
    cal[k]={...m,resid_var:rv,repeat,skill_var:rv*repeat,noise_var:rv*(1-repeat),n:rows.length,pairs:pairs.length};
  }
  return cal;
}

function aggregate(id,fromYear,toYear){
  const rows=(byPlayer.get(id)??[]).filter(r=>r.season>=fromYear&&r.season<=toYear);
  const out={player_id:id,rows};
  for(const k of KEYS){const a=rows.filter(r=>finite(r[`${k}_z`])&&r.pa>0),w=a.reduce((s,r)=>s+r.pa,0);if(!a.length||!(w>0)){out[k]=null;continue;}out[k]=a.reduce((s,r)=>s+r[`${k}_z`]*r.pa,0)/w;out[`${k}_noise_factor`]=a.reduce((s,r)=>s+(r.pa/w)**2,0);out[`${k}_years`]=a.map(r=>r.season);}
  return out;
}

function infer(obs,cal){
  // prior speed_z ~ N(0,1). Marginal observation variance includes stable skill + reduced annual noise.
  let denom=1,numer=0,used=0;
  const detail={};
  for(const k of KEYS){if(!finite(obs[k]))continue;const c=cal[k],nf=obs[`${k}_noise_factor`]??1,v=Math.max(1e-6,c.skill_var+c.noise_var*nf),y=obs[k]-c.intercept;denom+=c.slope*c.slope/v;numer+=c.slope*y/v;detail[k]={variance:v,loading:c.slope,observed:obs[k]};used++;}
  const speed_z=numer/denom;
  // skill posterior after common speed is estimated.
  for(const k of KEYS){if(!detail[k])continue;const c=cal[k],nf=obs[`${k}_noise_factor`]??1,resid=obs[k]-(c.intercept+c.slope*speed_z),nv=c.noise_var*nf,sv=c.skill_var,shrink=sv>0?sv/(sv+nv):0;detail[k].skill_posterior=resid*shrink;detail[k].skill_shrink=shrink;detail[k].raw_residual=resid;}
  return{speed_z,used,detail,posterior_sd:Math.sqrt(1/denom)};
}

// player-level holdout: calibration and inference use only train players.
const ids=[...speedBy.keys()].filter(id=>(byPlayer.get(id)??[]).some(r=>CAL_YEARS.includes(r.season)&&KEYS.some(k=>finite(r[`${k}_z`]))));
const pred=[];
for(let f=0;f<5;f++){
  const train=ids.filter(id=>foldOf(id)!==f),test=ids.filter(id=>foldOf(id)===f),cal=calibrate(train);
  for(const id of test){const obs=aggregate(id,2023,2025),inf=infer(obs,cal),truth=speedBy.get(id)?.speed_z;if(inf.used>=2&&finite(truth))pred.push({id,p:inf.speed_z,y:truth,sd:inf.posterior_sd});}
}
const pp=pred.map(r=>[r.p,r.y]);
console.log(`# joint speed+skill factor player-holdout: n=${pred.length} r=${cor(pp)?.toFixed(3)} rho=${spearman(pp)?.toFixed(3)} rmse_z=${Math.sqrt(pp.reduce((s,[p,y])=>s+(p-y)**2,0)/pp.length).toFixed(3)} meanPosteriorSD=${(pred.reduce((s,r)=>s+r.sd,0)/pred.length).toFixed(3)}`);

// 全direct sampleで校正値を表示。
const cal=calibrate(ids);
for(const k of KEYS){const c=cal[k];console.log(`${k.padEnd(10)} loading=${c.slope.toFixed(3)} repeat=${c.repeat.toFixed(3)} skillVar=${c.skill_var.toFixed(3)} noiseVar=${c.noise_var.toFixed(3)} rows=${c.n} pairs=${c.pairs}`);}

// 2024 sanity: player evidenceは2022-2024だけ。calibrationは集団モデルであり本人2025/26結果をカード入力には使わない。
const sanity=[['周東 佑京','21925136'],['近本 光司',db.prepare(`SELECT player_id FROM v_batting WHERE season=2024 AND name LIKE '%近本%' LIMIT 1`).get()?.player_id],['源田 壮亮','71775134']];
const ss=[];
for(const[name,id0]of sanity){if(!id0)continue;const id=String(id0),obs=aggregate(id,2022,2024),inf=infer(obs,cal);ss.push({name,id,...inf});}
ss.sort((a,b)=>b.speed_z-a.speed_z);
console.log('\n# 2024 sanity (individual evidence <=2024)');
for(const x of ss){console.log(`${x.name}: speed_z=${x.speed_z.toFixed(3)} posteriorSD=${x.posterior_sd.toFixed(3)} used=${x.used}`);for(const k of KEYS){const d=x.detail[k];if(d)console.log(`  ${k}: obs=${d.observed.toFixed(3)} speedLoading=${d.loading.toFixed(3)} skillPost=${d.skill_posterior.toFixed(3)} shrink=${d.skill_shrink.toFixed(3)}`);}}
console.log('order: '+ss.map(x=>x.name).join(' > '));

console.log('\n判定: holdout性能とsanityを両方確認する。結果固有のskill posteriorはspeedへ戻さず、各得能候補としてのみ使う。');
db.close();

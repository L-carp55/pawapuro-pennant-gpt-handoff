// NPBの結果指標を「走力の材料」として直接足すのをやめ、
// 2026 NPB+最高走行速度をアンカーに、共通のphysical speed成分と各結果固有のskill残差へ分解できるか監査する。
//
// 対象結果:
// - 内野安打/in-play -> 内野安打skill候補
// - UBR/PA             -> 走塁skill候補
// - 併殺回避           -> GDP/一塁走skill候補
//
// 盗塁企図・盗塁成功・三塁打はspeed inferenceには使わない。
// 盗塁は専用得能、三塁打は打球/球場/走塁が混ざるため。
//
// モデル概念:
//   outcome_z = loading * direct_top_speed_z + stable_skill + annual_noise
//
// direct speedで説明した後の残差が翌年も再現するなら、それが「速さではない技術」の証拠。
// このスクリプトは能力値を生成しない。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const YEARS=[2023,2024,2025];
const KEYS=['ih_inplay','ubr_pa','gdp_avoid'];
const finite=Number.isFinite;

function meanSd(a){const v=a.filter(finite),m=v.reduce((s,x)=>s+x,0)/v.length,sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))||1;return{m,sd,n:v.length};}
function cor(p){if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;let xy=0,xx=0,yy=0;for(const[x,y]of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;}
function solve2(xs,ys){const mx=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,x)=>s+x,0)/ys.length;let xx=0,xy=0;for(let i=0;i<xs.length;i++){xx+=(xs[i]-mx)**2;xy+=(xs[i]-mx)*(ys[i]-my);}const b=xx>0?xy/xx:0;return{intercept:my-b*mx,slope:b};}
function foldOf(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h)%5;}

const direct=db.prepare(`SELECT player_id,name,top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all();
const ds=meanSd(direct.map(r=>r.top_speed_kmh));
const speedBy=new Map(direct.map(r=>[String(r.player_id),{name:r.name,speed_z:(r.top_speed_kmh-ds.m)/ds.sd,top:r.top_speed_kmh}]));

const raw=db.prepare(`
  SELECT b.player_id,b.name,b.season,b.pa,b.ab,b.so,b.gdp,bm.ubr,m.gb_pct,t.ih
  FROM v_batting b
  LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.position<>'投' AND b.season BETWEEN 2023 AND 2025 AND b.pa>=50`).all().map(r=>{
    const ip=Math.max(1,(r.ab??0)-(r.so??0)),gb=Math.max(1,ip*((r.gb_pct??45)/100));
    return{player_id:String(r.player_id),name:r.name,season:r.season,pa:r.pa,
      ih_inplay:r.ih!=null?r.ih/ip:null,
      ubr_pa:r.ubr!=null&&r.pa>0?r.ubr/r.pa:null,
      gdp_avoid:-(r.gdp??0)/gb};
  });

// outcomeのzはリーグ全体の各年分布で作る。direct sampleだけで中心を決めない。
const yearNorm=new Map();
for(const y of YEARS){const a=raw.filter(r=>r.season===y),o={};for(const k of KEYS)o[k]=meanSd(a.map(r=>r[k]));yearNorm.set(y,o);}
for(const r of raw){const n=yearNorm.get(r.season);for(const k of KEYS)r[`${k}_z`]=finite(r[k])?(r[k]-n[k].m)/n[k].sd:null;}
const labeled=raw.map(r=>({...r,...(speedBy.get(r.player_id)??{})})).filter(r=>finite(r.speed_z));
console.log(`# direct speed players=${direct.length}; labeled annual outcome rows=${labeled.length}; players=${new Set(labeled.map(r=>r.player_id)).size}`);
console.log(`direct top speed mean=${ds.m.toFixed(2)} km/h sd=${ds.sd.toFixed(2)}`);

for(const k of KEYS){
  const yk=`${k}_z`,a=labeled.filter(r=>finite(r[yk]));
  console.log(`\n## ${k}: rows=${a.length} players=${new Set(a.map(r=>r.player_id)).size}`);
  for(const y of YEARS){const b=a.filter(r=>r.season===y);console.log(`  ${y} direct speed vs outcome r=${cor(b.map(r=>[r.speed_z,r[yk]]))?.toFixed(3)}`);}

  // player-holdout slope: top speed -> outcome. 同一playerをtrain/testで分離。
  const preds=[];
  for(let f=0;f<5;f++){
    const tr=a.filter(r=>foldOf(r.player_id)!==f),te=a.filter(r=>foldOf(r.player_id)===f);
    const m=solve2(tr.map(r=>r.speed_z),tr.map(r=>r[yk]));
    for(const r of te)preds.push([m.intercept+m.slope*r.speed_z,r[yk]]);
  }
  console.log(`  player-holdout speed-only prediction r=${cor(preds)?.toFixed(3)} rmse=${Math.sqrt(preds.reduce((s,[p,y])=>s+(p-y)**2,0)/preds.length).toFixed(3)}`);

  // 全ラベルでloadingを推定し、残差をskill+noiseとする。
  const m=solve2(a.map(r=>r.speed_z),a.map(r=>r[yk]));
  for(const r of a)r[`${k}_resid`]=r[yk]-(m.intercept+m.slope*r.speed_z);
  console.log(`  loading=${m.slope.toFixed(3)} / speed explained corr=${cor(a.map(r=>[m.intercept+m.slope*r.speed_z,r[yk]]))?.toFixed(3)}`);

  // 残差の隣接年再現性。speedは同じ2026 direct anchorを全3年へ使うため、
  // physical speed driftは少し残るが、Sprint Speed自身の翌年r≈.93なので主にskill/noiseを見る監査として使う。
  const by=new Map();for(const r of a){if(!by.has(r.player_id))by.set(r.player_id,new Map());by.get(r.player_id).set(r.season,r[`${k}_resid`]);}
  const pairs=[];for(const mp of by.values())for(const[y,v]of mp)if(mp.has(y+1))pairs.push([v,mp.get(y+1)]);
  const rho=cor(pairs);console.log(`  residual adjacent-year pairs=${pairs.length} r=${rho?.toFixed(3)}`);
  // residual varianceを stable skill / annual noise に粗く分解。repeatability<0ならstable=0。
  const rs=a.map(r=>r[`${k}_resid`]);const rv=meanSd(rs).sd**2,rep=Math.max(0,rho??0),skillVar=rv*rep,noiseVar=rv*(1-rep);
  console.log(`  residual variance=${rv.toFixed(3)} -> stable_skill_var≈${skillVar.toFixed(3)} / annual_noise_var≈${noiseVar.toFixed(3)}`);

  const top=[...a].filter(r=>r.season===2025).sort((x,y)=>y[`${k}_resid`]-x[`${k}_resid`]).slice(0,5);
  const bottom=[...a].filter(r=>r.season===2025).sort((x,y)=>x[`${k}_resid`]-y[`${k}_resid`]).slice(0,5);
  console.log(`  2025 skill-residual top: ${top.map(r=>`${r.name} ${r[`${k}_resid`].toFixed(2)}`).join(' / ')}`);
  console.log(`  2025 skill-residual low: ${bottom.map(r=>`${r.name} ${r[`${k}_resid`].toFixed(2)}`).join(' / ')}`);
}

// 3 outcomeの残差同士。別々の技術なら完全には同じ方向に動かないはず。
console.log('\n## residual cross-correlations (same player-year)');
const complete=labeled.filter(r=>KEYS.every(k=>finite(r[`${k}_resid`])));
for(let i=0;i<KEYS.length;i++)for(let j=i+1;j<KEYS.length;j++){
  const a=KEYS[i],b=KEYS[j];console.log(`  ${a} vs ${b}: r=${cor(complete.map(r=>[r[`${a}_resid`],r[`${b}_resid`]]))?.toFixed(3)} n=${complete.length}`);
}

console.log('\n判定: direct top speedで説明した残差が年を跨いで再現する項目は、純粋速度ではない独立skill軸として扱う。speed inferenceへ残差を再注入しない。');
db.close();

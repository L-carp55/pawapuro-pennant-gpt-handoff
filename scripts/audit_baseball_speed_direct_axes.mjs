// 野球上の走力を「最高速度」と「一塁到達」の別観測として監査する。
// 最終能力値は作らない。50m走の単純換算や、一塁到達をそのまま走力にすることを避けるための研究用。
//
// 見ること:
// 1) NPB+最高走行速度と一塁到達時間の共通信号
// 2) 左右打席を調整しても両者が同じ軸か
// 3) MLB複数年で各観測と「一塁到達 - Sprint Speed期待値」の個人差がどれだけ安定するか
// 4) NPB+でその一塁到達残差が内野安打/UBR/盗塁等のどれに追加関係を持つか

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const finite=Number.isFinite;
const norm=s=>(s??'').normalize('NFKC').replace(/[\s　]/g,'');

function solve(A,b){
  const n=A.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    if(Math.abs(M[p][c])<1e-12)return null;
    [M[c],M[p]]=[M[p],M[c]];
    const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;
    for(let r=0;r<n;r++)if(r!==c){const m=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=m*M[c][j];}
  }
  return M.map(r=>r[n]);
}
function ols(rows, feature){
  if(!rows.length)return null;
  const p=feature(rows[0]).length,A=Array.from({length:p},()=>Array(p).fill(0)),B=Array(p).fill(0);
  for(const r of rows){const x=feature(r),y=r.y;for(let i=0;i<p;i++){B[i]+=x[i]*y;for(let j=0;j<p;j++)A[i][j]+=x[i]*x[j];}}
  const beta=solve(A,B);if(!beta)return null;
  return r=>feature(r).reduce((s,x,i)=>s+x*beta[i],0);
}
function cor(pairs){
  if(pairs.length<3)return null;
  const mx=pairs.reduce((s,x)=>s+x[0],0)/pairs.length,my=pairs.reduce((s,x)=>s+x[1],0)/pairs.length;
  let xy=0,xx=0,yy=0;for(const [x,y] of pairs){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}
  return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;
}
function adjPairs(rows,key,value){
  const by=new Map();for(const r of rows){if(!finite(r[value])||!finite(r.year))continue;const k=r[key];if(!by.has(k))by.set(k,new Map());by.get(k).set(r.year,r[value]);}
  const out=[];for(const m of by.values())for(const [y,v] of m)if(m.has(y+1))out.push([v,m.get(y+1)]);return out;
}

// ---- NPB+ direct ----
const direct=db.prepare(`SELECT player_id,name,top_speed_kmh,hp_to_1b_sec
  FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL AND hp_to_1b_sec IS NOT NULL`).all();
const handRows=db.prepare(`SELECT l.proeye_id,t.season,t.bats
  FROM nf3_team_link l JOIN nf3_team_bat t ON t.season=l.season AND t.name_norm=l.name_norm
  WHERE t.bats IS NOT NULL AND t.bats<>'' AND t.season<=2025`).all();
const latestHand=new Map();for(const r of handRows){const prev=latestHand.get(r.proeye_id);if(!prev||r.season>prev.season)latestHand.set(r.proeye_id,r);}
const npb=direct.map(r=>({...r,bats:latestHand.get(r.player_id)?.bats??null})).filter(r=>r.bats==='右'||r.bats==='左');
console.log('# baseball speed direct-axis audit');
console.log(`NPB+ direct both axes=${direct.length} / hand matched=${npb.length}`);
console.log(`raw top-speed vs home-to-first r=${cor(npb.map(r=>[r.top_speed_kmh,r.hp_to_1b_sec]))?.toFixed(3)}`);
for(const b of ['右','左']){const a=npb.filter(r=>r.bats===b);console.log(`${b}打ち n=${a.length} H1=${(a.reduce((s,r)=>s+r.hp_to_1b_sec,0)/a.length).toFixed(3)}s / top=${(a.reduce((s,r)=>s+r.top_speed_kmh,0)/a.length).toFixed(2)}km/h / r=${cor(a.map(r=>[r.top_speed_kmh,r.hp_to_1b_sec]))?.toFixed(3)}`);}

// H1 ~ top speed + left-hand dummy. residual<0 = top speedから期待されるより一塁到達が速い。
const hModelRows=npb.map(r=>({...r,y:r.hp_to_1b_sec}));
const hModel=ols(hModelRows,r=>[1,r.top_speed_kmh,r.bats==='左'?1:0]);
for(const r of npb)r.h1_resid=r.hp_to_1b_sec-hModel(r);
console.log(`hand-adjusted partial relation top vs faster-H1-residual r=${cor(npb.map(r=>[r.top_speed_kmh,-r.h1_resid]))?.toFixed(3)} (residualなので原理上ほぼ0)`);

// ---- MLB multi-year direct repeatability ----
const bridge=db.prepare(`SELECT proeye_id,npb_name,detail FROM mlb_bridge WHERE detail IS NOT NULL`).all();
const mlb=[];
for(const r of bridge){
  let j;try{j=JSON.parse(r.detail);}catch{continue;}
  for(const x of j.sprint_speed??[]){
    if(!finite(x.year)||!finite(x.sprint_speed))continue;
    mlb.push({id:r.proeye_id??r.npb_name,name:r.npb_name,year:x.year,sprint:x.sprint_speed,h1:finite(x.hp_to_1b)?x.hp_to_1b:null});
  }
}
const sprintPairs=adjPairs(mlb,'id','sprint');
const h1Pairs=adjPairs(mlb,'id','h1');
console.log(`MLB Sprint Speed adjacent-year pairs=${sprintPairs.length} r=${cor(sprintPairs)?.toFixed(3)}`);
console.log(`MLB home-to-first adjacent-year pairs=${h1Pairs.length} r=${cor(h1Pairs)?.toFixed(3)}`);

const complete=mlb.filter(r=>finite(r.h1));
const years=[...new Set(complete.map(r=>r.year))].sort();
const baseYear=years[0];
const mlbModelRows=complete.map(r=>({...r,y:r.h1}));
const mlbModel=ols(mlbModelRows,r=>[1,r.sprint,...years.slice(1).map(y=>r.year===y?1:0)]);
for(const r of complete)r.resid=r.h1-mlbModel(r);
const residPairs=adjPairs(complete,'id','resid');
console.log(`MLB H1 residual after Sprint+year: adjacent-year pairs=${residPairs.length} r=${cor(residPairs)?.toFixed(3)}`);
console.log('  residualが高く安定していても「加速力」と即断しない。打席から走りへの移行技術も混ざる。');

// ---- NPB outcomes: H1 residualは何に追加関係を持つか ----
const stats=db.prepare(`SELECT b.player_id,b.season,b.pa,b.ab,b.so,b.gdp,b.sb,b.cs,bm.ubr,m.gb_pct,t.ih
  FROM v_batting b
  LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season BETWEEN 2023 AND 2025 AND b.position<>'投'`).all();
const by=new Map();for(const r of stats){if(!by.has(r.player_id))by.set(r.player_id,[]);by.get(r.player_id).push(r);}
function feats(a){
  if(!a?.length)return null;let pa=0,ip=0,gb=0,gdp=0,ubr=0,ubrPa=0,ih=0,ihIp=0,sb=0,cs=0;
  for(const r of a){pa+=r.pa??0;const x=Math.max(0,(r.ab??0)-(r.so??0));ip+=x;gb+=x*((r.gb_pct??45)/100);gdp+=r.gdp??0;sb+=r.sb??0;cs+=r.cs??0;if(r.ubr!=null){ubr+=r.ubr;ubrPa+=r.pa??0;}if(r.ih!=null){ih+=r.ih;ihIp+=x;}}
  return {ih_ip:ihIp>0?ih/ihIp:null,gdp_avoid:gb>0?-gdp/gb:null,ubr_pa:ubrPa>0?ubr/ubrPa:null,sb_attempt:pa>0?(sb+cs)/pa:null,sb_success:sb+cs>=5?sb/(sb+cs):null};
}
const joined=npb.map(r=>({...r,...(feats(by.get(r.player_id))??{})}));
for(const k of ['ih_ip','gdp_avoid','ubr_pa','sb_attempt','sb_success']){
  const a=joined.filter(r=>finite(r[k]));
  console.log(`${k.padEnd(12)} n=${a.length} top-speed r=${cor(a.map(r=>[r.top_speed_kmh,r[k]]))?.toFixed(3)} / faster-H1-residual r=${cor(a.map(r=>[-r.h1_resid,r[k]]))?.toFixed(3)}`);
}
console.log('\n判定: top speedは共通の脚力アンカー。H1残差は安定した別個人差だが、一般走塁(UBR)や盗塁成功にはほぼ乗らない場合、走力へ丸ごと統合せず batter-box/short-accel 軸として分離して扱う。');
db.close();

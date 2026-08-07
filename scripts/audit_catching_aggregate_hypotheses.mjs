// 捕球再設計の事前監査。
// 集約済み fielding_plays だけで、以下の固定補正を正当化できるか確認する。
//   - 守備範囲が広い選手ほど難しい打球へ触るためFEが増える
//   - 守備量が多い選手ほど疲労でFEが増える
//
// 結果が弱ければ「範囲+X」「イニング+Y」の固定加点はしない。
// 生PBPのplay difficulty / workloadをevent単位で入れたexpected-errorモデルへ進む。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const norm=s=>(s??'').normalize('NFKC').replace(/[\s　]/g,'');
const POS_EN={'一':'1B','二':'2B','三':'3B','遊':'SS','左':'LF','中':'CF','右':'RF','捕':'C'};
const pearson=p=>{
  if(p.length<10)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;
  let xy=0,xx=0,yy=0;for(const [x,y] of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;
};

const fp=db.prepare(`SELECT season,fielder,pos,chances,field_errors,throw_errors,unknown_errors
  FROM fielding_plays WHERE chances>=30`).all();
const vf=db.prepare(`SELECT season,player_id,name,position,g FROM v_fielding`).all();
const bySP=new Map();
for(const r of vf){const k=`${r.season}|${r.position}`;if(!bySP.has(k))bySP.set(k,[]);bySP.get(k).push({...r,key:norm(r.name)});}

const bm=db.prepare(`SELECT l.proeye_id player_id,f.season,f.pos,f.inn,f.rngr
  FROM bm_fld f JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
  WHERE f.farm=0`).all();
const bmMap=new Map(bm.map(r=>[`${r.player_id}|${r.season}|${r.pos}`,r]));

const matched=[];
let ambiguous=0,unmatched=0;
for(const r of fp){
  const hits=(bySP.get(`${r.season}|${r.pos}`)??[]).filter(x=>x.key.startsWith(norm(r.fielder)));
  const ids=[...new Set(hits.map(x=>x.player_id))];
  if(ids.length!==1){if(ids.length>1)ambiguous++;else unmatched++;continue;}
  const playerId=ids[0],f=bmMap.get(`${playerId}|${r.season}|${POS_EN[r.pos]}`);
  if(!f || !(f.inn>0) || f.rngr==null)continue;
  matched.push({...r,playerId,inn:f.inn,rngr1000:f.rngr/f.inn*1000});
}

// year×position baseline FE probability. chance数を分母にした二項残差にする。
const cells=new Map();
for(const r of matched){const k=`${r.season}|${r.pos}`;const c=cells.get(k)??{n:0,e:0};c.n+=r.chances;c.e+=r.field_errors;cells.set(k,c);}
for(const r of matched){
  const c=cells.get(`${r.season}|${r.pos}`),p=c.e/c.n;
  r.feRate=r.field_errors/r.chances;
  r.feResid=(r.field_errors-r.chances*p)/Math.sqrt(Math.max(1e-9,r.chances*p*(1-p)));
}

// range / workloadもyear×position内zにして、年代・位置の違いを個人差と誤読しない。
for(const [k] of cells){
  const a=matched.filter(r=>`${r.season}|${r.pos}`===k);
  for(const key of ['rngr1000','inn']){
    const m=a.reduce((s,r)=>s+r[key],0)/a.length;
    const sd=Math.sqrt(a.reduce((s,r)=>s+(r[key]-m)**2,0)/a.length)||1;
    for(const r of a)r[`${key}Z`]=(r[key]-m)/sd;
  }
}

console.log('# catching aggregate hypothesis audit');
console.log(`fielding_plays candidates=${fp.length} matched-to-bm=${matched.length} ambiguous=${ambiguous} unmatched=${unmatched}`);
const allRange=matched.map(r=>[r.rngr1000Z,r.feResid]);
const allLoad=matched.map(r=>[r.innZ,r.feResid]);
console.log(`all positions: range vs FE residual r=${pearson(allRange)?.toFixed(3)??'—'} / workload vs FE residual r=${pearson(allLoad)?.toFixed(3)??'—'}`);
for(const pos of [...new Set(matched.map(r=>r.pos))].sort()){
  const a=matched.filter(r=>r.pos===pos);
  if(a.length<20)continue;
  console.log(`${pos}: n=${a.length} range r=${pearson(a.map(r=>[r.rngr1000Z,r.feResid]))?.toFixed(3)??'—'} workload r=${pearson(a.map(r=>[r.innZ,r.feResid]))?.toFixed(3)??'—'}`);
}
console.log('\n判定ルール: 集約相関が弱くても「難度/疲労が無い」とは言わない。選択効果とプレー難度を集約で失っているため。');
console.log('固定ボーナスは採らず、build_fielding_error_events.mjsで1プレー単位に戻してexpected-errorを作る。');
db.close();

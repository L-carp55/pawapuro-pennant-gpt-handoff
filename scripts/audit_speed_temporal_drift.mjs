// 複数年走力のプール方法を、恣意的なdecay係数で決めないための監査。
// MLB Statcastの年別Sprint Speedを複数年持つ選手から、lagごとの持続性と年変化を測る。
// 最終プール係数は生成しない。process drift/noiseの実測だけを出す。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const pearson=p=>{
  if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;
  let xy=0,xx=0,yy=0;for(const [x,y] of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;
};
const stat=a=>{const n=a.length,m=a.reduce((s,x)=>s+x,0)/n;const sd=Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,n-1));return{n,mean:m,sd,mae:a.reduce((s,x)=>s+Math.abs(x),0)/n};};

const rows=db.prepare(`SELECT proeye_id,detail FROM mlb_bridge WHERE detail IS NOT NULL`).all();
const obs=[];
for(const r of rows){
  let d;try{d=JSON.parse(r.detail);}catch{continue;}
  for(const x of d.sprint_speed??[])if(Number.isFinite(x.sprint_speed))obs.push({id:r.proeye_id,year:Number(x.year),v:Number(x.sprint_speed)});
}
const by=new Map();for(const x of obs){if(!by.has(x.id))by.set(x.id,new Map());by.get(x.id).set(x.year,x.v);}
console.log('# Sprint Speed temporal drift (MLB Statcast direct measurements)');
console.log(`observations=${obs.length} players=${by.size}`);
for(const lag of [1,2,3]){
  const p=[],diff=[];
  for(const m of by.values())for(const [y,v] of m){if(m.has(y-lag)){const old=m.get(y-lag);p.push([old,v]);diff.push(v-old);}}
  const s=stat(diff);
  console.log(`lag${lag}: pairs=${p.length} r=${pearson(p)?.toFixed(3)??'—'} mean_change=${s.mean.toFixed(3)}ft/s sd_change=${s.sd.toFixed(3)} mae=${s.mae.toFixed(3)}`);
}
console.log('\n解釈: 速度順位は年をまたいで強く持続するが、年変化はゼロではない。');
console.log('PAだけの単純平均ではなく、代理指標の観測誤差とこのprocess driftを使ったlatent-state推定を次に検討する。');
db.close();

// 内野肩の代替材料研究。
// 走者なしの内野ゴロについて「深い位置ほどアウト率を維持できるか」を測り、
// DELTAが公開した2017年遊撃手の遠投アウト率6人で外部答え合わせする。
//
// 重要: このスクリプトは肩力を生成しない。平均送球速度・守備位置推定が不合格だった後の
// 探索であり、外部検証n=6・年跨ぎ再現性も弱いため、採用可否を判断する監査だけを行う。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
const norm=s=>(s??'').normalize('NFKC').replace(/\s+/g,'');
const pearson=p=>{
  if(p.length<3)return null; const xs=p.map(x=>x[0]),ys=p.map(x=>x[1]);
  const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
  let xy=0,xx=0,yy=0; for(let i=0;i<xs.length;i++){const dx=xs[i]-mx,dy=ys[i]-my;xy+=dx*dy;xx+=dx*dx;yy+=dy*dy;}
  return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;
};
const quantile=(a,q)=>{const s=[...a].sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor((s.length-1)*q))];};

// DELTA / 1.02の2017年遊撃手「遠い位置から一塁でアウトにした割合」。
// PBPのfielder_nameは当時の表示名が「源田」「京田」「田中広」のような短縮形なので、
// display（外部資料のフルネーム）とeventKey（PBP側の名寄せキー）を分ける。
// 外部答え合わせ専用。モデル係数や最終肩力には使わない。
const DELTA=[
  {display:'源田壮亮',eventKey:'源田',target:80.0},
  {display:'京田陽太',eventKey:'京田',target:71.7},
  {display:'今宮健太',eventKey:'今宮',target:75.0},
  {display:'田中広輔',eventKey:'田中広',target:60.7},
  {display:'倉本寿彦',eventKey:'倉本',target:76.5},
  {display:'坂本勇人',eventKey:'坂本',target:78.6},
];

const ev=db.prepare(`SELECT season,fielder_norm,hc_y,is_out,kind
  FROM infield_grounder_events
  WHERE pos='SS' AND has_runner=0 AND kind IN ('out','infield_hit') AND hc_y IS NOT NULL`).all();
console.log('# infield arm deep-grounder audit');
console.log(`SS grounders=${ev.length}`);

function rateByFielder(rows,minN=1){
  const m=new Map();
  for(const r of rows){const k=norm(r.fielder_norm); if(!m.has(k))m.set(k,{n:0,o:0}); const v=m.get(k);v.n++;v.o+=r.is_out?1:0;}
  return new Map([...m].filter(([,v])=>v.n>=minN).map(([k,v])=>[k,{...v,rate:v.o/v.n}]));
}

for(const frac of [0.20,0.25,0.30,0.35,0.40]){
  const cut=quantile(ev.map(r=>r.hc_y),frac);
  const deep=ev.filter(r=>r.hc_y<=cut);
  const rates=rateByFielder(deep,20);
  const pairs=[];
  const show=[];
  for(const v of DELTA){
    const x=rates.get(norm(v.eventKey)); if(!x)continue;
    pairs.push([x.rate,v.target]); show.push(`${v.display}:${(x.rate*100).toFixed(1)}%(n=${x.n})`);
  }
  console.log(`deepest~${Math.round(frac*100)}% y<=${cut}: external n=${pairs.length} r=${pearson(pairs)?.toFixed(3)??'—'}  ${show.join(' / ')}`);
}

// 30%深部の単年値が「選手の持ち物」として安定するか、隣接年で確認する。
const cut30=quantile(ev.map(r=>r.hc_y),0.30);
const deep30=ev.filter(r=>r.hc_y<=cut30);
for(const minN of [10,15,20,25]){
  const byYear=new Map();
  for(const y of [...new Set(deep30.map(r=>r.season))].sort()) byYear.set(y,rateByFielder(deep30.filter(r=>r.season===y),minN));
  const pairs=[];
  for(const y of [...byYear.keys()].sort()){
    const a=byYear.get(y),b=byYear.get(y+1); if(!b)continue;
    for(const [name,x] of a){const z=b.get(name); if(z)pairs.push([x.rate,z.rate]);}
  }
  console.log(`adjacent-year deepest30 minN=${minN}: pairs=${pairs.length} r=${pearson(pairs)?.toFixed(3)??'—'}`);
}

console.log('\n判定: 深い遊撃ゴロには外部遠投評価と同方向の信号がある可能性はあるが、外部n=6かつ単年再現性が弱い。');
console.log('本番肩力へは未採用。次は捕球/持ち替え/打者走力/打球位置を統制した上で、多年の潜在肩を推定して再検証する。');
db.close();

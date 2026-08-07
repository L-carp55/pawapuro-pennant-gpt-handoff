// bm_fldの各守備得点成分が、どの守備位置で定義されているかを監査する。
// nullは「0点」ではなく「非該当/欠損」の可能性があるため、total fielding runsを作る前に分離する。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const rows = db.prepare(`
  SELECT pos,season,inn,rngr,errr,arm,dpr,framing,blocking
  FROM bm_fld WHERE farm=0 AND inn>0
`).all();
const metrics=['rngr','errr','arm','dpr','framing','blocking'];
const poses=[...new Set(rows.map(r=>r.pos))].sort();
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const fmt=x=>x==null?'—':x.toFixed(2);

console.log('# bm_fld 守備得点成分の位置別被覆');
for(const pos of poses){
  const rs=rows.filter(r=>r.pos===pos);
  console.log(`\n## ${pos}  n=${rs.length}`);
  console.log('| metric | non-null | % | mean | mean abs | min | max |');
  console.log('|---|---:|---:|---:|---:|---:|---:|');
  for(const m of metrics){
    const vals=rs.map(r=>r[m]).filter(Number.isFinite);
    const abs=vals.map(Math.abs);
    console.log(`| ${m} | ${vals.length} | ${(100*vals.length/rs.length).toFixed(1)}% | ${fmt(mean(vals))} | ${fmt(mean(abs))} | ${vals.length?Math.min(...vals).toFixed(2):'—'} | ${vals.length?Math.max(...vals).toFixed(2):'—'} |`);
  }
}

// 代表的な位置×年で、非null成分の組み合わせが一貫しているか。
console.log('\n# 非nullパターン');
const pat=new Map();
for(const r of rows){
  const k=metrics.filter(m=>Number.isFinite(r[m])).join('+') || '(none)';
  const pk=`${r.pos}|${k}`;
  pat.set(pk,(pat.get(pk)??0)+1);
}
for(const [k,n] of [...pat.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) console.log(`${k}\t${n}`);

// 非null成分を単純加算した場合のスケール。これは採用ではなく診断。
const sums=rows.map(r=>({pos:r.pos, sum:metrics.reduce((s,m)=>s+(Number.isFinite(r[m])?r[m]:0),0), count:metrics.filter(m=>Number.isFinite(r[m])).length}));
console.log('\n# 非null全成分を仮に足した場合');
for(const pos of poses){
  const xs=sums.filter(x=>x.pos===pos && x.count>0).map(x=>x.sum);
  console.log(`${pos}\tn=${xs.length}\tmean=${fmt(mean(xs))}\tmeanAbs=${fmt(mean(xs.map(Math.abs)))}\tmin=${xs.length?Math.min(...xs).toFixed(2):'—'}\tmax=${xs.length?Math.max(...xs).toFixed(2):'—'}`);
}

db.close();

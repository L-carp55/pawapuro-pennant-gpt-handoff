// 現在の appraiseCard 経路そのものの走力素点と、旧 scale_calibration の整合を監査する。
// 設定は書き換えない。KONAMI値は採否の正解ではなく、現行の旧目盛りが作られた参照分布との
// 比較にだけ使う。
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = async f => JSON.parse(await readFile(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = await J('ratings.json');
const rv = (await J('run_values.json')).values;
const runNorm = await J('running_norms.json');
const fldNorm = await J('fielding_norms.json');
const scoutingLedger = loadLedger(await J('scouting.json'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const ctx = makeContext(db, cfg);

const candidates = db.prepare(`
  SELECT DISTINCT pl.proeye_id player_id, p.name pawa_name, p.speed pawa_speed, b.name, b.pa
  FROM pawapuro_rating p
  JOIN pawapuro_link pl ON pl.name_norm=p.name_norm
  JOIN v_batting b ON b.player_id=pl.proeye_id AND b.season=2024
  WHERE b.position<>'投' AND b.pa>=150 AND p.speed IS NOT NULL
  ORDER BY b.pa DESC
`).all();

const rows=[];
for (const x of candidates) {
  const r=appraiseCard(ctx,{playerId:x.player_id,mode:'2024',cfg,rv,runNorm,fldNorm,scoutingLedger});
  if (r.error || !r.card) continue;
  const raw=r.card.calc_log?.running?.speed;
  const final=r.card.abilities?.基礎能力?.走力?.value;
  if (!Number.isFinite(raw) || !Number.isFinite(x.pawa_speed)) continue;
  rows.push({...x,raw,final});
}

const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length)};
const cor=(a,b)=>{const ma=mean(a),mb=mean(b);let xy=0,xx=0,yy=0;for(let i=0;i<a.length;i++){xy+=(a[i]-ma)*(b[i]-mb);xx+=(a[i]-ma)**2;yy+=(b[i]-mb)**2;}return xy/Math.sqrt(xx*yy)};
const raw=rows.map(x=>x.raw), pawa=rows.map(x=>x.pawa_speed);
const slope=sd(pawa)/sd(raw), intercept=mean(pawa)-slope*mean(raw);
const old=cfg.scale_calibration?.applied?.['走力'];
const rmse=(pred)=>Math.sqrt(mean(rows.map((x,i)=>(pred(x,i)-x.pawa_speed)**2)));

console.log('# current pipeline speed scale audit');
console.log(`n=${rows.length}`);
console.log(`raw mean=${mean(raw).toFixed(3)} sd=${sd(raw).toFixed(3)}`);
console.log(`reference mean=${mean(pawa).toFixed(3)} sd=${sd(pawa).toFixed(3)}`);
console.log(`correlation=${cor(raw,pawa).toFixed(4)}`);
console.log(`fit_current_pipeline slope=${slope.toFixed(6)} intercept=${intercept.toFixed(6)}`);
console.log(`old_scale slope=${old?.slope?.toFixed(6)} intercept=${old?.intercept?.toFixed(6)}`);
console.log(`rmse raw=${rmse(x=>x.raw).toFixed(3)} old_scale=${rmse(x=>(old.intercept+old.slope*x.raw)).toFixed(3)} refit=${rmse(x=>(intercept+slope*x.raw)).toFixed(3)}`);

console.log('\n# largest old-scale inflation vs raw');
for (const x of [...rows].sort((a,b)=>((old.intercept+old.slope*b.raw)-b.raw)-((old.intercept+old.slope*a.raw)-a.raw)).slice(0,15)) {
  const oldFinal=old.intercept+old.slope*x.raw;
  const refit=intercept+slope*x.raw;
  console.log(`${x.name.replace(/　/g,' ')}\traw=${x.raw.toFixed(1)}\told=${oldFinal.toFixed(1)}\trefit=${refit.toFixed(1)}\tref=${x.pawa_speed}`);
}

const g=rows.find(x=>x.name.includes('源田'));
if(g){console.log(`\nGENDA raw=${g.raw.toFixed(3)} old=${(old.intercept+old.slope*g.raw).toFixed(3)} refit=${(intercept+slope*g.raw).toFixed(3)} ref=${g.pawa_speed}`)}

db.close();

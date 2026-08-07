// 2026 NPB+最高走行速度と、再構築した追加進塁イベントの関係を監査する。
// 目的は走塁skillを作ることではなく、context-adjusted residualに残る身体走力成分を確認すること。
//
// Usage:
//   PBP_DB_PATH=/tmp/rebuilt_2026.sqlite node scripts/audit_baserunning_direct_speed_2026.mjs [OUTPUT.md]

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eventDbPath = path.resolve(process.env.PBP_DB_PATH ?? path.join(ROOT, 'data', 'pennant.db'));
const sourceDbPath = path.resolve(process.env.PENNANT_DB_PATH ?? path.join(ROOT, 'data', 'pennant.db'));
const outPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const normName = s => String(s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const finite = x => Number.isFinite(Number(x));
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
function pearson(xs, ys) {
  if (xs.length < 3 || xs.length !== ys.length) return null;
  const mx=mean(xs), my=mean(ys);
  let num=0, dx=0, dy=0;
  for (let i=0;i<xs.length;i++) { const a=xs[i]-mx,b=ys[i]-my; num+=a*b; dx+=a*a; dy+=b*b; }
  return dx>0 && dy>0 ? num/Math.sqrt(dx*dy) : null;
}
function sd(a) {
  if (a.length < 2) return null;
  const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1));
}

const edb = new DatabaseSync(eventDbPath, { readOnly: true });
const sdb = sourceDbPath === eventDbPath ? edb : new DatabaseSync(sourceDbPath, { readOnly: true });
let events;
try {
  events = edb.prepare(`SELECT season, kind, runner_norm, outs, success, hc_x, hc_y, hit_location
                        FROM baserunning_advances WHERE season=2026`).all();
} catch (e) {
  throw new Error(`baserunning_advances 2026を読めません: ${e.message}`);
}
const direct = sdb.prepare(`SELECT name, top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all();
if (sdb !== edb) sdb.close();
edb.close();
if (!events.length) throw new Error('2026 baserunning eventsが0件です');

const speedByName = new Map(direct.filter(r=>finite(r.top_speed_kmh)).map(r=>[normName(r.name), Number(r.top_speed_kmh)]));

// 文脈セル。細かい座標セルを優先し、標本不足なら粗いセルへfallbackする。
const cellStats = new Map();
function addCell(key, y) {
  const v=cellStats.get(key) ?? {n:0,s:0}; v.n++; v.s+=y; cellStats.set(key,v);
}
function coarseKey(e) { return `${e.kind}|${e.outs ?? 'x'}|${e.hit_location ?? 'x'}`; }
function fineKey(e) {
  const bx = finite(e.hc_x) ? Math.round(Number(e.hc_x)/10) : 'x';
  const by = finite(e.hc_y) ? Math.round(Number(e.hc_y)/10) : 'x';
  return `${coarseKey(e)}|${bx}|${by}`;
}
for (const e of events) {
  const y=Number(e.success); if (!(y===0||y===1)) continue;
  addCell(`F|${fineKey(e)}`, y); addCell(`C|${coarseKey(e)}`, y); addCell(`K|${e.kind}`, y);
}
function expectedFor(e) {
  const y=Number(e.success);
  for (const [prefix,key,minN] of [['F',fineKey(e),30],['C',coarseKey(e),40],['K',e.kind,2]]) {
    const v=cellStats.get(`${prefix}|${key}`);
    if (!v || v.n < minN) continue;
    // leave-one-event-out。自分自身を期待値へ混ぜない。
    if (v.n > 1) return (v.s-y)/(v.n-1);
  }
  return null;
}

const byPlayer = new Map();
for (const e of events) {
  const y=Number(e.success), exp=expectedFor(e), name=normName(e.runner_norm);
  if (!(y===0||y===1) || !finite(exp) || !name) continue;
  const x=byPlayer.get(name) ?? {n:0,sum:0,byKind:new Map()};
  const r=y-exp; x.n++; x.sum+=r;
  const k=x.byKind.get(e.kind) ?? {n:0,sum:0}; k.n++; k.sum+=r; x.byKind.set(e.kind,k);
  byPlayer.set(name,x);
}

const matched=[];
for (const [name,x] of byPlayer) {
  const speed=speedByName.get(name);
  if (!finite(speed) || x.n < 5) continue;
  matched.push({name,speed:Number(speed),n:x.n,resid:x.sum/x.n,byKind:x.byKind});
}
const speeds=matched.map(x=>x.speed), residuals=matched.map(x=>x.resid);
const overallR=pearson(speeds,residuals);
const ms=mean(speeds), ss=sd(speeds);
const zspeeds=matched.map(x=>(x.speed-ms)/ss);
const cov = matched.reduce((s,x,i)=>s+zspeeds[i]*x.resid,0);
const varz = zspeeds.reduce((s,x)=>s+x*x,0);
const slopeZ = varz>0 ? cov/varz : null;

const kinds=['1st_to_3rd','2nd_to_home','1st_to_home_on_2b'];
const kindRows=[];
for (const kind of kinds) {
  const a=[];
  for (const x of matched) {
    const k=x.byKind.get(kind); if (!k || k.n<3) continue;
    a.push({speed:x.speed,resid:k.sum/k.n});
  }
  kindRows.push({kind,n:a.length,r:pearson(a.map(x=>x.speed),a.map(x=>x.resid))});
}

const top=[...matched].sort((a,b)=>b.speed-a.speed).slice(0,12);
const fmt=x=>x==null?'—':Number(x).toFixed(3);
const lines=[
  '# 2026 追加進塁 × NPB+直接走力 監査','',
  '判定: **RESEARCH_ONLY_PHYSICAL_PLUS_SKILL_RESIDUAL**','',
  '- 追加進塁イベントは打球位置・アウト数・hit_locationの経験セルでcontext調整する。',
  '- この残差はまだ身体走力と走塁技術の両方を含む。得能値として使用しない。',
  '- NPB+最高走行速度との関係を測り、身体成分が残るかだけ確認する。','',
  `events_2026: ${events.length}`,
  `direct_speed_players: ${speedByName.size}`,
  `matched_players_n>=5: ${matched.length}`,
  `corr(top_speed, context_residual): ${fmt(overallR)}`,
  `residual slope per +1 SD top speed: ${fmt(slopeZ)}`,'',
  '| event | matched players | corr(speed,residual) |','|---|---:|---:|',
  ...kindRows.map(x=>`| ${x.kind} | ${x.n} | ${fmt(x.r)} |`),'',
  '## fastest matched examples','',
  '| player | top speed km/h | events | context residual |','|---|---:|---:|---:|',
  ...top.map(x=>`| ${x.name} | ${x.speed.toFixed(1)} | ${x.n} | ${x.resid.toFixed(3)} |`),'',
  '## interpretation','',
  '相関があっても残差を走力へ戻さない。身体走力の直接観測で説明できる部分を先に除き、その後の選手効果だけを走塁skill候補として別途検証する。',
];
const text=lines.join('\n')+'\n';
if (outPath) writeFileSync(outPath,text,'utf8');
console.log(text);

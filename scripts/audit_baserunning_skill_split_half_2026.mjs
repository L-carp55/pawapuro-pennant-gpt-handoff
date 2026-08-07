// 2026追加進塁イベントを試合単位でA/Bに分割し、
// context調整→NPB+最高走行速度成分除去後の選手残差が再現するか監査する。
// 本番得能値は作らない。split-halfの再現性が弱ければPAUSEDを維持する。
//
// Usage:
//   PBP_DB_PATH=/tmp/rebuilt2026.sqlite node scripts/audit_baserunning_skill_split_half_2026.mjs [OUTPUT.md]

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const eventDbPath=path.resolve(process.env.PBP_DB_PATH ?? path.join(ROOT,'data','pennant.db'));
const sourceDbPath=path.resolve(process.env.PENNANT_DB_PATH ?? path.join(ROOT,'data','pennant.db'));
const outPath=process.argv[2] ? path.resolve(process.argv[2]) : null;
const normName=s=>String(s??'').normalize('NFKC').replace(/[\s　]/g,'');
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1));};
function pearson(xs,ys){if(xs.length<3||xs.length!==ys.length)return null;const mx=mean(xs),my=mean(ys);let n=0,dx=0,dy=0;for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;n+=a*b;dx+=a*a;dy+=b*b;}return dx>0&&dy>0?n/Math.sqrt(dx*dy):null;}
function ranks(a){const pairs=a.map((v,i)=>({v,i})).sort((x,y)=>x.v-y.v);const out=Array(a.length);let i=0;while(i<pairs.length){let j=i+1;while(j<pairs.length&&pairs[j].v===pairs[i].v)j++;const r=(i+j-1)/2+1;for(let k=i;k<j;k++)out[pairs[k].i]=r;i=j;}return out;}
const spearman=(x,y)=>pearson(ranks(x),ranks(y));
function hashParity(s){let h=2166136261>>>0;for(const ch of String(s??'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h&1;}

const edb=new DatabaseSync(eventDbPath,{readOnly:true});
const cols=edb.prepare(`PRAGMA table_info(baserunning_advances)`).all().map(x=>x.name);
for(const c of ['game_id','date','fielder']) if(!cols.includes(c)) throw new Error(`event table missing metadata column: ${c}`);
const events=edb.prepare(`SELECT season,game_id,date,park,fielder,kind,runner_norm,outs,success,hc_x,hc_y,hit_location FROM baserunning_advances WHERE season=2026`).all();
edb.close();
const sdb=new DatabaseSync(sourceDbPath,{readOnly:true});
const direct=sdb.prepare(`SELECT name,top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all();
sdb.close();
if(!events.length)throw new Error('2026 events=0');
const speedByName=new Map(direct.filter(r=>finite(r.top_speed_kmh)).map(r=>[normName(r.name),Number(r.top_speed_kmh)]));
const allSpeeds=[...speedByName.values()], speedMean=mean(allSpeeds), speedSd=sd(allSpeeds);
const speedZ=name=>{const v=speedByName.get(name);return finite(v)&&speedSd>0?(v-speedMean)/speedSd:null;};

function bx(v){return finite(v)?Math.round(Number(v)/10):'x';}
function fielder(e){return normName(e.fielder)||'x';}
function kFine(e){return `${e.kind}|${e.outs??'x'}|${e.hit_location??'x'}|${fielder(e)}|${bx(e.hc_x)}|${bx(e.hc_y)}`;}
function kFielder(e){return `${e.kind}|${e.outs??'x'}|${e.hit_location??'x'}|${fielder(e)}`;}
function kCoord(e){return `${e.kind}|${e.outs??'x'}|${e.hit_location??'x'}|${bx(e.hc_x)}|${bx(e.hc_y)}`;}
function kCoarse(e){return `${e.kind}|${e.outs??'x'}|${e.hit_location??'x'}`;}

function halfModel(rows){
  const cells=new Map();
  const add=(key,y)=>{const v=cells.get(key)??{n:0,s:0};v.n++;v.s+=y;cells.set(key,v);};
  for(const e of rows){const y=Number(e.success);if(!(y===0||y===1))continue;add(`F|${kFine(e)}`,y);add(`D|${kFielder(e)}`,y);add(`X|${kCoord(e)}`,y);add(`C|${kCoarse(e)}`,y);add(`K|${e.kind}`,y);}
  const expected=e=>{const y=Number(e.success);for(const [p,k,minN] of [['F',kFine(e),8],['D',kFielder(e),12],['X',kCoord(e),20],['C',kCoarse(e),30],['K',e.kind,2]]){const v=cells.get(`${p}|${k}`);if(v&&v.n>=minN&&v.n>1)return(v.s-y)/(v.n-1);}return null;};
  const byPlayer=new Map();
  for(const e of rows){const name=normName(e.runner_norm), exp=expected(e), y=Number(e.success);if(!name||!finite(exp)||!(y===0||y===1))continue;const r=y-exp;const p=byPlayer.get(name)??{n:0,sum:0,byKind:new Map()};p.n++;p.sum+=r;const q=p.byKind.get(e.kind)??{n:0,sum:0};q.n++;q.sum+=r;p.byKind.set(e.kind,q);byPlayer.set(name,p);}
  const train=[];
  for(const [name,p] of byPlayer){const z=speedZ(name);if(p.n>=4&&finite(z))train.push({name,n:p.n,raw:p.sum/p.n,z});}
  const mz=mean(train.map(x=>x.z)), mr=mean(train.map(x=>x.raw));let cov=0,varz=0;for(const x of train){cov+=(x.z-mz)*(x.raw-mr);varz+=(x.z-mz)**2;}const slope=varz>0?cov/varz:0;const intercept=mr-slope*mz;
  const out=new Map();
  for(const [name,p] of byPlayer){const z=speedZ(name);if(!finite(z))continue;const raw=p.sum/p.n;out.set(name,{n:p.n,raw,adj:raw-(intercept+slope*z),z,byKind:p.byKind});}
  return {players:out,slope,intercept,trainN:train.length};
}

const halves=[events.filter(e=>hashParity(e.game_id)===0),events.filter(e=>hashParity(e.game_id)===1)];
const A=halfModel(halves[0]), B=halfModel(halves[1]);
const common=[];
for(const [name,a] of A.players){const b=B.players.get(name);const speed=speedByName.get(name);if(!b||a.n<5||b.n<5||!finite(speed))continue;common.push({name,a,b,speed:Number(speed)});}
const rawA=common.map(x=>x.a.raw),rawB=common.map(x=>x.b.raw),adjA=common.map(x=>x.a.adj),adjB=common.map(x=>x.b.adj);
const rawR=pearson(rawA,rawB),adjR=pearson(adjA,adjB),rawS=spearman(rawA,rawB),adjS=spearman(adjA,adjB);

const pooled=common.map(x=>({name:x.name,speed:x.speed,n:x.a.n+x.b.n,skill:(x.a.adj*x.a.n+x.b.adj*x.b.n)/(x.a.n+x.b.n)})).sort((a,b)=>b.skill-a.skill);
const fmt=x=>x==null?'—':Number(x).toFixed(3);
const lines=[
'# 2026 走塁skill split-half監査','',
'判定: **RESEARCH_ONLY_NOT_ABILITY_READY**','',
'- game_id hashで試合をA/Bへ完全分割。同一試合は両側へ入らない。',
'- 各半分で独立に打球位置・hit_location・outs・fielderをcontext調整する。',
'- 各半分でNPB+最高走行速度の効果を別々に推定し、その身体成分を除いた残差を比較する。',
'- 加速の直接観測がNPBには無いため、ここで得る残差を最終走塁得能とはしない。','',
`events A/B: ${halves[0].length} / ${halves[1].length}`,
`speed-model train players A/B: ${A.trainN} / ${B.trainN}`,
`speed slope A/B: ${fmt(A.slope)} / ${fmt(B.slope)}`,
`common players (>=5 events each half): ${common.length}`,
`split-half raw residual Pearson: ${fmt(rawR)}`,
`split-half speed-adjusted Pearson: ${fmt(adjR)}`,
`split-half raw residual Spearman: ${fmt(rawS)}`,
`split-half speed-adjusted Spearman: ${fmt(adjS)}`,'',
'## pooled speed-adjusted residual examples','',
'| player | speed km/h | events | residual |','|---|---:|---:|---:|',
...pooled.slice(0,10).map(x=>`| ${x.name} | ${x.speed.toFixed(1)} | ${x.n} | ${x.skill.toFixed(3)} |`),
...pooled.slice(-10).reverse().map(x=>`| ${x.name} | ${x.speed.toFixed(1)} | ${x.n} | ${x.skill.toFixed(3)} |`),'',
'## interpretation rule','',
'身体走力を除いた後のsplit-half再現性が十分でなければ、追加進塁単独から走塁得能を100段階へ広げない。速度補正で再現性が上がるか、少なくとも維持されることを確認してから次へ進む。',''];
const text=lines.join('\n');if(outPath)writeFileSync(outPath,text,'utf8');console.log(text);

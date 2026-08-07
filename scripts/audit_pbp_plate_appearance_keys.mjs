// Release PBPでplate appearanceを一意に束ねる正本キーを監査する。
// 列名を推測しない。実際のheaderから候補列を列挙し、現行
// game_id + inning + game_state_name + inning_ab_num の衝突を測る。

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const RAW = path.resolve(process.env.PBP_RAW_DIR ?? './data/raw/npb_pbp');
const files = readdirSync(RAW).filter(f => f.endsWith('_pbp.csv')).sort();
if (!files.length) throw new Error(`no *_pbp.csv in ${RAW}`);

function splitCsvLine(line) {
  const out=[]; let f='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){ if(c==='"'){ if(line[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
    else if(c==='"')q=true; else if(c===','){out.push(f);f='';} else f+=c;
  }
  out.push(f); return out;
}
const REGULAR=new Set(['1','2','26']);
const normId=s=>{const v=String(s??'').trim();return !v||v==='0'||v==='0.0'?null:v.replace(/\.0$/,'');};
const isPitch=(r,c)=>{const pn=Number(r[c.pitch]);return (Number.isFinite(pn)&&pn>0)||/^\d+球目:/.test(r[c.desc]??'');};

const candidateHeaders=new Set();
let totalKeys=0,multiBatterKeys=0,multiPitchResetKeys=0,keysWithMultipleHeaderRows=0;
let keysWithMultipleResultBatters=0;
const collisionExamples=[]; const resultExamples=[];

for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);
  const h=splitCsvLine(lines[0].replace(/^\uFEFF/,''));
  if(fn===files[0]){
    for(const x of h){
      const s=x.toLowerCase();
      if(/ab|bat|plate|index|serial|play|event|num|order|pa/.test(s))candidateHeaders.add(x);
    }
  }
  const I=n=>h.indexOf(n);
  const c={game:I('game_id'),inn:I('inning'),state:I('game_state_name'),iab:I('inning_ab_num'),batter:I('batter'),batterName:I('PlayInfo_PlayerName'),type:I('game_type_id'),pitch:I('pitch_number'),desc:I('description_jap'),bresult:I('bresult')};
  const missing=Object.entries(c).filter(([,v])=>v<0).map(([k])=>k);
  if(missing.length)throw new Error(`${fn}: missing ${missing.join(',')}`);

  const map=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i])continue;
    const r=splitCsvLine(lines[i]);if(!REGULAR.has(r[c.type]))continue;
    const key=`${r[c.game]}|${String(Number(r[c.inn])).padStart(3,'0')}|${r[c.state]}|${String(Number(r[c.iab])).padStart(4,'0')}`;
    let x=map.get(key);if(!x){x={batters:new Set(),pitchBatters:new Set(),resultBatters:new Set(),pitchNumbers:[],headers:[],firstPitch:null,lastPitch:null,rows:0};map.set(key,x);}
    x.rows++;
    const bid=normId(r[c.batter]);if(bid)x.batters.add(bid);
    if(isPitch(r,c)){
      if(bid)x.pitchBatters.add(bid);
      const pn=Number(r[c.pitch]);if(Number.isFinite(pn))x.pitchNumbers.push(pn);
      if(!x.firstPitch)x.firstPitch=r;x.lastPitch=r;
      const br=Number(r[c.bresult]);if(Number.isFinite(br)&&br!==0&&bid)x.resultBatters.add(bid);
    } else if(/^＜/.test(r[c.desc]??'')) x.headers.push((r[c.desc]??'').slice(0,100));
  }

  totalKeys+=map.size;
  for(const [k,x] of map){
    if(x.pitchBatters.size>1){
      multiBatterKeys++;
      if(collisionExamples.length<50)collisionExamples.push({fn,key:k,pitchBatters:[...x.pitchBatters],allBatters:[...x.batters],pitchNumbers:x.pitchNumbers.slice(0,30),headers:x.headers.slice(0,5),first:x.firstPitch?.[c.desc],last:x.lastPitch?.[c.desc]});
    }
    let resets=0;for(let j=1;j<x.pitchNumbers.length;j++)if(x.pitchNumbers[j]<=x.pitchNumbers[j-1])resets++;
    if(resets>0)multiPitchResetKeys++;
    if(x.headers.length>1)keysWithMultipleHeaderRows++;
    if(x.resultBatters.size>1){
      keysWithMultipleResultBatters++;
      if(resultExamples.length<30)resultExamples.push({fn,key:k,resultBatters:[...x.resultBatters],headers:x.headers.slice(0,5),first:x.firstPitch?.[c.desc],last:x.lastPitch?.[c.desc]});
    }
  }
}

console.log('# Plate appearance key audit');
console.log('candidate header columns:');
console.log([...candidateHeaders]);
console.log(`files=${files.length} currentKeys=${totalKeys}`);
console.log(`keys with >1 pitch batter=${multiBatterKeys}`);
console.log(`keys with pitch_number reset/nonincrease=${multiPitchResetKeys}`);
console.log(`keys with >1 PA-like header row=${keysWithMultipleHeaderRows}`);
console.log(`keys with >1 nonzero-bresult batter=${keysWithMultipleResultBatters}`);
console.log('\n## collision examples');for(const x of collisionExamples)console.log(JSON.stringify(x));
console.log('\n## multiple-result-batter examples');for(const x of resultExamples)console.log(JSON.stringify(x));

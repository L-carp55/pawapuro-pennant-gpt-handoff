// Release PBPで、どの列をplate appearanceの正本キー/順序に使うべきか監査する。
// 旧builder: game_id + inning + game_state_name + inning_ab_num
// 候補: game_id + at_bat_index
//
// 同一キー内に複数打者が混ざるか、at_bat_indexがゲーム内で単調か、
// 次PAのfirst pitchへ走者状態が自然につながるかを比較する。

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
const REGULAR = new Set(['1','2','26']);
const normId=s=>{const v=String(s??'').trim();return !v||v==='0'||v==='0.0'?null:v.replace(/\.0$/,'');};
const isPitch=(r,c)=>{
  const pn=Number(r[c.pitch]);
  return (Number.isFinite(pn)&&pn>0) || /^\d+球目:/.test(r[c.desc]??'');
};
const baseSig=(r,c)=>[normId(r[c.on1]),normId(r[c.on2]),normId(r[c.on3])].map(x=>x??'-').join('|');

function ensure(map,key,row,batterId){
  let x=map.get(key);
  if(!x){x={rows:0,pitches:0,batters:new Set(),firstPitch:null,lastPitch:null};map.set(key,x);}
  x.rows++;
  if(batterId)x.batters.add(batterId);
  return x;
}

let allOldKeys=0,allAtBatKeys=0,oldMulti=0,atBatMulti=0,missingAtBat=0;
let atBatNonMonotonic=0,atBatDuplicateOrder=0,games=0;
let oldTransitionComparable=0,oldTransitionBaseChanged=0;
let atTransitionComparable=0,atTransitionBaseChanged=0;
const oldExamples=[]; const atExamples=[]; const orderExamples=[];
const mismatchTarget=[];

for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);
  const h=splitCsvLine(lines[0].replace(/^\uFEFF/,''));
  const I=n=>h.indexOf(n);
  const c={
    game:I('game_id'),inn:I('inning'),state:I('game_state_name'),iab:I('inning_ab_num'),abi:I('at_bat_index'),
    batter:I('batter'),batterName:I('PlayInfo_PlayerName'),type:I('game_type_id'),pitch:I('pitch_number'),desc:I('description_jap'),
    on1:I('on_1b'),on2:I('on_2b'),on3:I('on_3b'),outs:I('outs_when_up'),
  };
  const missing=Object.entries(c).filter(([,v])=>v<0).map(([k])=>k);
  if(missing.length)throw new Error(`${fn}: missing ${missing.join(',')}`);

  const old=new Map(), abi=new Map(), byGame=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i])continue;
    const r=splitCsvLine(lines[i]);
    if(!REGULAR.has(r[c.type]))continue;
    const batterId=normId(r[c.batter]);
    const oldKey=`${r[c.game]}|${String(Number(r[c.inn])).padStart(3,'0')}|${r[c.state]}|${String(Number(r[c.iab])).padStart(4,'0')}`;
    const atRaw=r[c.abi]; const atNum=Number(atRaw);
    const atKey=Number.isFinite(atNum)?`${r[c.game]}|${String(atNum).padStart(6,'0')}`:null;
    const xo=ensure(old,oldKey,r,batterId);
    if(isPitch(r,c)){xo.pitches++;if(!xo.firstPitch)xo.firstPitch=r;xo.lastPitch=r;}
    if(atKey){
      const xa=ensure(abi,atKey,r,batterId);
      if(isPitch(r,c)){xa.pitches++;if(!xa.firstPitch)xa.firstPitch=r;xa.lastPitch=r;}
      if(!byGame.has(r[c.game]))byGame.set(r[c.game],new Map());
      const gm=byGame.get(r[c.game]);
      if(!gm.has(atNum))gm.set(atNum,new Set());
      if(batterId)gm.get(atNum).add(batterId);
    } else missingAtBat++;
  }

  allOldKeys+=old.size; allAtBatKeys+=abi.size;
  for(const [k,x] of old){if(x.batters.size>1){oldMulti++;if(oldExamples.length<20)oldExamples.push({fn,key:k,batters:[...x.batters],rows:x.rows,pitches:x.pitches});}}
  for(const [k,x] of abi){if(x.batters.size>1){atBatMulti++;if(atExamples.length<20)atExamples.push({fn,key:k,batters:[...x.batters],rows:x.rows,pitches:x.pitches});}}

  // game内at_bat_indexの重複打者・単調性。
  for(const [game,gm] of byGame){
    games++;
    const xs=[...gm.keys()].sort((a,b)=>a-b);
    for(const n of xs){if(gm.get(n).size>1)atBatDuplicateOrder++;}
    for(let j=1;j<xs.length;j++)if(xs[j]<=xs[j-1]){atBatNonMonotonic++;if(orderExamples.length<20)orderExamples.push({fn,game,prev:xs[j-1],cur:xs[j]});}
  }

  function transitionStats(map,kind){
    // key lexical sort is valid because both schemes zero-pad numeric order components.
    const ks=[...map.keys()].sort();
    for(let j=0;j<ks.length-1;j++){
      const a=map.get(ks[j]),b=map.get(ks[j+1]);
      if(!a.firstPitch||!a.lastPitch||!b.firstPitch)continue;
      // same game only; old key includes game, at-key includes game.
      if(ks[j].split('|')[0]!==ks[j+1].split('|')[0])continue;
      const d=a.lastPitch[c.desc]??'';
      if(!/ヒット|安打|二塁打|ツーベース/.test(d))continue;
      const before=baseSig(a.firstPitch,c),after=baseSig(b.firstPitch,c);
      if(kind==='old'){oldTransitionComparable++;if(before!==after)oldTransitionBaseChanged++;}
      else {atTransitionComparable++;if(before!==after)atTransitionBaseChanged++;}
      if(mismatchTarget.length<30 && /万波中正|近本光司|源田壮亮|周東佑京/.test(a.firstPitch[c.batterName]??'')){
        mismatchTarget.push({kind,fn,key:ks[j],next:ks[j+1],batter:a.firstPitch[c.batterName],before,after,desc:d.slice(0,120)});
      }
    }
  }
  transitionStats(old,'old');
  transitionStats(abi,'at_bat_index');
}

console.log('# Plate appearance key audit');
console.log(`files=${files.length} games=${games}`);
console.log(`old keys=${allOldKeys} multi-batter=${oldMulti}`);
console.log(`at_bat_index keys=${allAtBatKeys} multi-batter=${atBatMulti} missing rows=${missingAtBat}`);
console.log(`at_bat duplicate index with >1 batter=${atBatDuplicateOrder} nonmonotonic(sorted check)=${atBatNonMonotonic}`);
console.log(`old hit transitions comparable=${oldTransitionComparable} base-state-changed=${oldTransitionBaseChanged}`);
console.log(`at_bat hit transitions comparable=${atTransitionComparable} base-state-changed=${atTransitionBaseChanged}`);
console.log('\n## old-key multi-batter examples');for(const x of oldExamples)console.log(JSON.stringify(x));
console.log('\n## at_bat-index multi-batter examples');for(const x of atExamples)console.log(JSON.stringify(x));
console.log('\n## ordering examples');for(const x of orderExamples)console.log(JSON.stringify(x));
console.log('\n## selected transition examples');for(const x of mismatchTarget)console.log(JSON.stringify(x));

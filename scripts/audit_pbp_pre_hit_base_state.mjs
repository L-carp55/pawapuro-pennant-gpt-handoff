// 安打最終投球の description_jap が明示する打球直前塁状態と、PBP on_1b/on_2b/on_3bを照合する。
// builderの正本をどちらに置くべきか決めるための監査。DBは触らない。

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const RAW=path.resolve(process.env.PBP_RAW_DIR??'./data/raw/npb_pbp');
const files=readdirSync(RAW).filter(f=>f.endsWith('_pbp.csv')).sort();
if(!files.length)throw new Error(`no *_pbp.csv in ${RAW}`);

function splitCsvLine(line){const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){out.push(f);f='';}else f+=c;}out.push(f);return out;}
const REGULAR=new Set(['1','2','26']);
const normId=s=>{const v=String(s??'').trim();return !v||v==='0'||v==='0.0'?null:v.replace(/\.0$/,'');};
const sig=(r,c)=>[normId(r[c.on1])?'1':'',normId(r[c.on2])?'2':'',normId(r[c.on3])?'3':''].filter(Boolean).join(',')||'empty';
const isPitch=(r,c)=>{const pn=Number(r[c.pitch]);return(Number.isFinite(pn)&&pn>0)||/^\d+球目:/.test(r[c.desc]??'');};

const CANON=new Map([
  ['満塁','1,2,3'],['一二三塁','1,2,3'],['1,2,3塁','1,2,3'],
  ['一二塁','1,2'],['1,2塁','1,2'],['一三塁','1,3'],['1,3塁','1,3'],['二三塁','2,3'],['2,3塁','2,3'],
  ['一塁','1'],['1塁','1'],['二塁','2'],['2塁','2'],['三塁','3'],['3塁','3'],['走者なし','empty']
]);
const TOKEN='(満塁|一二三塁|一二塁|一三塁|二三塁|一塁|二塁|三塁|1,2,3塁|1,2塁|1,3塁|2,3塁|1塁|2塁|3塁|走者なし)';
function describedStart(d){
  const s=String(d??'').replace(/^\d+球目:/,'');
  const patterns=[new RegExp(`(?:^|[0-3]アウト|ランナー)${TOKEN}(?:の|から)`),new RegExp(`^${TOKEN}(?:の|から)`)];
  for(const re of patterns){const m=s.match(re);if(m)return CANON.get(m[1])??null;}
  return null;
}

let hits=0,explicit=0,sameLast=0,sameFirst=0,lastMismatch=0,firstMismatch=0;
let explicitOne=0,explicitTwo=0,explicitThree=0;
const mismatch=[];
const statePaths=new Map();
for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);const h=splitCsvLine(lines[0].replace(/^\uFEFF/,''));const I=n=>h.indexOf(n);
  const c={game:I('game_id'),inn:I('inning'),state:I('game_state_name'),iab:I('inning_ab_num'),type:I('game_type_id'),pitch:I('pitch_number'),desc:I('description_jap'),batter:I('batter'),batterName:I('PlayInfo_PlayerName'),on1:I('on_1b'),on1n:I('on_1b_name'),on2:I('on_2b'),on2n:I('on_2b_name'),on3:I('on_3b'),on3n:I('on_3b_name'),play:I('play_id'),seq:I('PlayInfo_SeqNo'),ab:I('PlayInfo_AB'),serial:I('fiveDigitSerialNumber')};
  const missing=Object.entries(c).filter(([k,v])=>['play','seq','ab','serial'].includes(k)?false:v<0).map(([k])=>k);if(missing.length)throw new Error(`${fn}: missing ${missing.join(',')}`);
  const pa=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i])continue;const r=splitCsvLine(lines[i]);if(!REGULAR.has(r[c.type]))continue;
    const key=`${r[c.game]}|${String(Number(r[c.inn])).padStart(3,'0')}|${r[c.state]}|${String(Number(r[c.iab])).padStart(4,'0')}`;
    let x=pa.get(key);if(!x){x={pitches:[]};pa.set(key,x);}if(isPitch(r,c))x.pitches.push(r);
  }
  for(const [key,x] of pa){
    if(!x.pitches.length)continue;const last=x.pitches.at(-1),d=last[c.desc]??'';
    if(!/ヒット|安打|二塁打|ツーベース/.test(d))continue;hits++;
    const ds=describedStart(d);if(ds==null)continue;explicit++;
    if(ds==='1')explicitOne++;else if(ds==='1,2'||ds==='1,3'||ds==='2,3')explicitTwo++;else if(ds==='1,2,3')explicitThree++;
    const ls=sig(last,c),fs=sig(x.pitches[0],c);if(ls===ds)sameLast++;else lastMismatch++;if(fs===ds)sameFirst++;else firstMismatch++;
    const path=x.pitches.map(r=>sig(r,c)).join('>');statePaths.set(path,(statePaths.get(path)??0)+1);
    if(ls!==ds&&mismatch.length<80)mismatch.push({fn,key,batter:last[c.batterName],described:ds,first:fs,last:ls,path,ids:{on1:last[c.on1],on1n:last[c.on1n],on2:last[c.on2],on2n:last[c.on2n],on3:last[c.on3],on3n:last[c.on3n]},meta:{play:c.play>=0?last[c.play]:null,seq:c.seq>=0?last[c.seq]:null,ab:c.ab>=0?last[c.ab]:null,serial:c.serial>=0?last[c.serial]:null},description:d.slice(0,160)});
  }
}
const pct=(n,d)=>d?`${(100*n/d).toFixed(2)}%`:'—';
console.log('# Pre-hit base-state audit');
console.log(`hit PA=${hits} explicit-start=${explicit}`);
console.log(`explicit single-base=${explicitOne} two-base=${explicitTwo} three-base=${explicitThree}`);
console.log(`description == lastPitch on_*: ${sameLast}/${explicit} (${pct(sameLast,explicit)})`);
console.log(`description == firstPitch on_*: ${sameFirst}/${explicit} (${pct(sameFirst,explicit)})`);
console.log(`last mismatch=${lastMismatch} first mismatch=${firstMismatch}`);
console.log('\n## common within-PA state paths among explicit starts');
for(const [k,n] of [...statePaths.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30))console.log(`${n}\t${k}`);
console.log('\n## lastPitch mismatches');for(const x of mismatch)console.log(JSON.stringify(x));

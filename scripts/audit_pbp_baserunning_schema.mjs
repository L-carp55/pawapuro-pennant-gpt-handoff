// Release PBPのschema/値を観測し、baserunning builderが0件になる原因を切り分ける。
// RAWはPBP_RAW_DIRで指定。DBは触らない。

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
const add=(m,k)=>m.set(k,(m.get(k)??0)+1);
const top=(m,n=20)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);
const nonempty=v=>v!=null&&v!==''&&v!=='0'&&v!=='0.0'&&v!=='nan'&&v!=='None';

const freq={type:new Map(),state:new Map(),bresult:new Map(),presult:new Map(),on1:new Map(),on2:new Map(),on3:new Map(),on1n:new Map(),on2n:new Map(),on3n:new Map()};
let rows=0, regular=0, nonemptyBresult=0, paCount=0, paWithBresult=0, paWithHitWord=0;
let paWithRunnerName=0,paWithRunnerId=0,rowsWithRunnerId=0,rowsWithRunnerName=0,adjacentSameHalf=0;
const sampleB=[]; const sampleHit=[]; const sampleRunnerName=[]; const sampleRunnerId=[];

for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);
  const h=splitCsvLine(lines[0].replace(/^\uFEFF/,''));
  const I=n=>h.indexOf(n);
  const ix={season:I('season'),game:I('game_id'),inn:I('inning'),ab:I('inning_ab_num'),type:I('game_type_id'),state:I('game_state_name'),desc:I('description_jap'),bresult:I('bresult'),presult:I('presult'),on1:I('on_1b'),on1n:I('on_1b_name'),on2:I('on_2b'),on2n:I('on_2b_name'),on3:I('on_3b'),on3n:I('on_3b_name'),batter:I('batter'),batterName:I('PlayInfo_PlayerName')};
  const pa=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i])continue; rows++;
    const r=splitCsvLine(lines[i]);
    add(freq.type,r[ix.type]); add(freq.state,r[ix.state]); add(freq.bresult,r[ix.bresult]); add(freq.presult,r[ix.presult]);
    for(const k of ['on1','on2','on3','on1n','on2n','on3n']) add(freq[k],r[ix[k]]);
    if(!new Set(['1','2','26']).has(r[ix.type]))continue; regular++;
    const hasId=[ix.on1,ix.on2,ix.on3].some(j=>j>=0&&nonempty(r[j]));
    const hasName=[ix.on1n,ix.on2n,ix.on3n].some(j=>j>=0&&nonempty(r[j]));
    if(hasId){rowsWithRunnerId++;if(sampleRunnerId.length<30)sampleRunnerId.push({fn,on1:r[ix.on1],on1n:r[ix.on1n],on2:r[ix.on2],on2n:r[ix.on2n],on3:r[ix.on3],on3n:r[ix.on3n],batter:r[ix.batter],batterName:r[ix.batterName],d:(r[ix.desc]??'').slice(0,120)});}
    if(hasName)rowsWithRunnerName++;
    const br=r[ix.bresult]??'', d=r[ix.desc]??'';
    if(br){nonemptyBresult++; if(sampleB.length<20)sampleB.push({fn,br,d:d.slice(0,120)});}
    if(/ヒット|安打|二塁打|ツーベース|三塁打|本塁打|ホームラン/.test(d) && sampleHit.length<20) sampleHit.push({fn,br,d:d.slice(0,120)});
    const key=`${r[ix.game]}|${String(Number(r[ix.inn])).padStart(3,'0')}|${r[ix.state]}|${String(Number(r[ix.ab])).padStart(4,'0')}`;
    const x=pa.get(key); if(!x)pa.set(key,{first:r,last:r}); else x.last=r;
  }
  const keys=[...pa.keys()].sort(); paCount+=keys.length;
  for(const k of keys){
    const p=pa.get(k), br=p.last[ix.bresult]??'',d=p.last[ix.desc]??'';
    if(br)paWithBresult++;
    if(/ヒット|安打|二塁打|ツーベース|三塁打|本塁打|ホームラン/.test(d))paWithHitWord++;
    const hasName=[ix.on1n,ix.on2n,ix.on3n].some(j=>j>=0&&nonempty(p.first[j]));
    const hasId=[ix.on1,ix.on2,ix.on3].some(j=>j>=0&&nonempty(p.first[j]));
    if(hasName){
      paWithRunnerName++; if(sampleRunnerName.length<20)sampleRunnerName.push({fn,key:k,on1:p.first[ix.on1],on1n:p.first[ix.on1n],on2:p.first[ix.on2],on2n:p.first[ix.on2n],on3:p.first[ix.on3],on3n:p.first[ix.on3n],br,d:d.slice(0,100)});
    }
    if(hasId)paWithRunnerId++;
  }
  for(let i=0;i<keys.length-1;i++){
    const a=keys[i].split('|'),b=keys[i+1].split('|');
    if(a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2])adjacentSameHalf++;
  }
}

console.log(`# files=${files.length} rows=${rows} regular=${regular} pa=${paCount}`);
console.log(`nonemptyBresult rows=${nonemptyBresult} paWithBresult=${paWithBresult}`);
console.log(`paWithHitWord=${paWithHitWord} adjacentSameHalf=${adjacentSameHalf}`);
console.log(`rowsWithRunnerId=${rowsWithRunnerId} rowsWithRunnerName=${rowsWithRunnerName}`);
console.log(`paWithRunnerId=${paWithRunnerId} paWithRunnerName=${paWithRunnerName}`);
console.log('\n## game_type_id'); console.log(top(freq.type,20));
console.log('\n## game_state_name'); console.log(top(freq.state,20));
console.log('\n## bresult'); console.log(top(freq.bresult,40));
console.log('\n## presult'); console.log(top(freq.presult,30));
console.log('\n## runner ID columns');
console.log('on_1b',top(freq.on1,20)); console.log('on_2b',top(freq.on2,20)); console.log('on_3b',top(freq.on3,20));
console.log('\n## runner name columns');
console.log('on_1b_name',top(freq.on1n,20)); console.log('on_2b_name',top(freq.on2n,20)); console.log('on_3b_name',top(freq.on3n,20));
console.log('\n## sample rows with runner ID'); for(const x of sampleRunnerId)console.log(JSON.stringify(x));
console.log('\n## sample nonempty bresult'); for(const x of sampleB)console.log(JSON.stringify(x));
console.log('\n## sample description hit words'); for(const x of sampleHit)console.log(JSON.stringify(x));
console.log('\n## sample PA with runner name'); for(const x of sampleRunnerName)console.log(JSON.stringify(x));

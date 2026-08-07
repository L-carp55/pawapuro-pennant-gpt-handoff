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

const freq={type:new Map(),state:new Map(),bresult:new Map(),presult:new Map(),desc:new Map()};
let rows=0, regular=0, nonemptyBresult=0, paCount=0, paWithBresult=0, paWithHitWord=0, paWithBaseRunner=0, adjacentSameHalf=0;
const sampleB=[]; const sampleHit=[]; const sampleRunner=[];

for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);
  const h=splitCsvLine(lines[0].replace(/^\uFEFF/,''));
  const I=n=>h.indexOf(n);
  const ix={season:I('season'),game:I('game_id'),inn:I('inning'),ab:I('inning_ab_num'),type:I('game_type_id'),state:I('game_state_name'),desc:I('description_jap'),bresult:I('bresult'),presult:I('presult'),on1n:I('on_1b_name'),on2n:I('on_2b_name'),on3n:I('on_3b_name')};
  const pa=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i])continue; rows++;
    const r=splitCsvLine(lines[i]);
    add(freq.type,r[ix.type]); add(freq.state,r[ix.state]); add(freq.bresult,r[ix.bresult]); add(freq.presult,r[ix.presult]);
    if(!new Set(['1','2','26']).has(r[ix.type]))continue; regular++;
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
    if(p.first[ix.on1n]||p.first[ix.on2n]||p.first[ix.on3n]){
      paWithBaseRunner++; if(sampleRunner.length<20)sampleRunner.push({fn,key:k,on1:p.first[ix.on1n],on2:p.first[ix.on2n],on3:p.first[ix.on3n],br,d:d.slice(0,100)});
    }
  }
  for(let i=0;i<keys.length-1;i++){
    const a=keys[i].split('|'),b=keys[i+1].split('|');
    if(a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2])adjacentSameHalf++;
  }
}

console.log(`# files=${files.length} rows=${rows} regular=${regular} pa=${paCount}`);
console.log(`nonemptyBresult rows=${nonemptyBresult} paWithBresult=${paWithBresult}`);
console.log(`paWithHitWord=${paWithHitWord} paWithBaseRunner=${paWithBaseRunner} adjacentSameHalf=${adjacentSameHalf}`);
console.log('\n## game_type_id'); console.log(top(freq.type,20));
console.log('\n## game_state_name'); console.log(top(freq.state,20));
console.log('\n## bresult'); console.log(top(freq.bresult,40));
console.log('\n## presult'); console.log(top(freq.presult,30));
console.log('\n## sample nonempty bresult'); for(const x of sampleB)console.log(JSON.stringify(x));
console.log('\n## sample description hit words'); for(const x of sampleHit)console.log(JSON.stringify(x));
console.log('\n## sample PA with base runner'); for(const x of sampleRunner)console.log(JSON.stringify(x));

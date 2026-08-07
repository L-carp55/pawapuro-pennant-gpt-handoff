// 安打最終行の説明文が示す開始塁とhybrid on_* stateが食い違う打席について、
// 打席内の全行（非投球イベント含む）を表示する。盗塁・暴投等の途中進塁が原因か確認する。

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { makeRunnerIdentity } from '../src/ratings/baserunning_events.mjs';

const RAW=path.resolve(process.env.PBP_RAW_DIR??'./data/raw/npb_pbp');
const files=readdirSync(RAW).filter(f=>f.endsWith('_pbp.csv')).sort();
if(!files.length)throw new Error(`no *_pbp.csv in ${RAW}`);

function splitCsvLine(line){const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){out.push(f);f='';}else f+=c;}out.push(f);return out;}
const REGULAR=new Set(['1','2','26']);
const CANON=new Map([
  ['満塁','1,2,3'],['一二三塁','1,2,3'],['1,2,3塁','1,2,3'],['一二塁','1,2'],['1,2塁','1,2'],['一三塁','1,3'],['1,3塁','1,3'],['二三塁','2,3'],['2,3塁','2,3'],['一塁','1'],['1塁','1'],['二塁','2'],['2塁','2'],['三塁','3'],['3塁','3'],['走者なし','empty']
]);
const TOKEN='(満塁|一二三塁|一二塁|一三塁|二三塁|一塁|二塁|三塁|1,2,3塁|1,2塁|1,3塁|2,3塁|1塁|2塁|3塁|走者なし)';
function describedStart(d){const s=String(d??'').replace(/^\d+球目:/,'');const ps=[new RegExp(`(?:^|[0-3]アウト|ランナー)${TOKEN}(?:の|から)`),new RegExp(`^${TOKEN}(?:の|から)`)];for(const re of ps){const m=s.match(re);if(m)return CANON.get(m[1])??null;}return null;}
const state=(r,c)=>{
  const occ=(id,name)=>makeRunnerIdentity(id,name);
  const a=[occ(r[c.on1],r[c.on1n]),occ(r[c.on2],r[c.on2n]),occ(r[c.on3],r[c.on3n])];
  return {sig:a.map((x,i)=>x?String(i+1):'').filter(Boolean).join(',')||'empty',bases:a.map(x=>x?{id:x.id,name:x.name}:null)};
};
const isPitch=(r,c)=>{const pn=Number(r[c.pitch]);return(Number.isFinite(pn)&&pn>0)||/^\d+球目:/.test(r[c.desc]??'');};

let shown=0,totalMismatch=0;
for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);const h=splitCsvLine(lines[0].replace(/^\uFEFF/,''));const I=n=>h.indexOf(n);
  const c={game:I('game_id'),inn:I('inning'),state:I('game_state_name'),iab:I('inning_ab_num'),type:I('game_type_id'),pitch:I('pitch_number'),desc:I('description_jap'),batter:I('PlayInfo_PlayerName'),on1:I('on_1b'),on1n:I('on_1b_name'),on2:I('on_2b'),on2n:I('on_2b_name'),on3:I('on_3b'),on3n:I('on_3b_name'),br:I('bresult'),pr:I('presult'),seq:I('PlayInfo_SeqNo'),play:I('play_id')};
  const pa=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i])continue;const r=splitCsvLine(lines[i]);if(!REGULAR.has(r[c.type]))continue;
    const key=`${r[c.game]}|${String(Number(r[c.inn])).padStart(3,'0')}|${r[c.state]}|${String(Number(r[c.iab])).padStart(4,'0')}`;
    let x=pa.get(key);if(!x){x=[];pa.set(key,x);}x.push(r);
  }
  for(const [key,rows] of pa){
    const pitches=rows.filter(r=>isPitch(r,c));if(!pitches.length)continue;const last=pitches.at(-1),d=last[c.desc]??'';
    if(!/ヒット|安打|二塁打|ツーベース/.test(d))continue;
    const ds=describedStart(d);if(ds==null)continue;const s=state(last,c);if(s.sig===ds)continue;
    totalMismatch++;
    if(shown>=30)continue;shown++;
    console.log(`\n=== mismatch ${shown} ${fn} ${key} batter=${last[c.batter]} described=${ds} hybrid=${s.sig} ===`);
    for(const r of rows){
      const st=state(r,c);
      console.log(JSON.stringify({
        pitch:r[c.pitch],seq:r[c.seq],play:r[c.play],bresult:r[c.br],presult:r[c.pr],
        state:st.sig,bases:st.bases,description:(r[c.desc]??'').slice(0,180)
      }));
    }
  }
}
console.log(`\n# total explicit-start/hybrid mismatches=${totalMismatch}; shown=${shown}`);

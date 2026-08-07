// 2024 raw PBPで、捕球expected-error用の失策ラベルがどれだけ拾えているか監査する。
// 広いキーワード・現regex・bresultコードを比較し、v_fielding側の総失策も重複構造ごと確認する。
// 能力値は作らない。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync,existsSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RAW=path.resolve(process.env.PBP_RAW_DIR??path.join(ROOT,'data','raw','npb_pbp'));
const DB=path.resolve(process.env.PENNANT_DB_PATH??path.join(ROOT,'data','pennant.db'));
const OUT=process.argv[2]?path.resolve(process.argv[2]):null;
const REGULAR=new Set(['1','2','26']);
const POS={1:'投',2:'捕',3:'一',4:'二',5:'三',6:'遊',7:'左',8:'中',9:'右'};
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　]/g,'');
function splitCsvLine(line){const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){out.push(f);f='';}else f+=c;}out.push(f);return out;}
const isPitch=(r,c)=>{const pn=Number(r[c.pitch]);return Number.isFinite(pn)&&pn>0||/^\d+球目:/.test(r[c.desc]??'');};
const BROAD=/エラー|失策|悪送球|後逸|落球|ファンブル|トンネル|お手玉|捕球ミス|送球ミス/;
const CURRENT=[
  /([^\s、。]+?)\(([投捕一二三遊左中右])\)の悪送球/,
  /([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*悪送球/,
  /([^\s、。]+?)\(([投捕一二三遊左中右])\)の落球/,
  /([^\s、。]+?)\(([投捕一二三遊左中右])\)の後逸/,
  /([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*後逸/,
  /([^\s、。]+?)\(([投捕一二三遊左中右])\)の(?:エラー|失策)/,
  /([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*(?:エラー|失策)/,
];
const parseCurrent=d=>CURRENT.some(re=>re.test(d));
const countMap=(m,k,n=1)=>m.set(k,(m.get(k)??0)+n);
const top=(m,n=30)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);

if(!existsSync(RAW))throw new Error(`raw PBP not found: ${RAW}`);
const files=readdirSync(RAW).filter(f=>f.startsWith('2024-')&&f.endsWith('_pbp.csv')).sort();
if(!files.length)throw new Error('2024 PBP files=0');

let regularRows=0, broadRows=0, currentRows=0, broadPa=0, tailBroadPa=0, tailCurrentPa=0;
const keywordCounts=new Map(), broadBresult=new Map(), tailBresult=new Map(), unmatchedDescriptions=new Map(), broadDescExamples=[];
const bresultAll=new Map(), bresultBroadPA=new Map();
const paRows=[];

for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);
  const hdr=splitCsvLine(lines[0].replace(/^\uFEFF/,'')),I=n=>hdr.indexOf(n);
  const c={game:I('game_id'),inn:I('inning'),ab:I('inning_ab_num'),type:I('game_type_id'),desc:I('description_jap'),pitch:I('pitch_number'),br:I('bresult'),hl:I('hit_location'),fielder:I('fielder_name')};
  for(const [k,v] of Object.entries(c))if(v<0)throw new Error(`${fn}: missing ${k}`);
  const pa=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;const r=splitCsvLine(lines[i]);if(!REGULAR.has(r[c.type]))continue;regularRows++;
    const d=String(r[c.desc]??'');const br=String(r[c.br]??'');countMap(bresultAll,br||'(blank)');
    if(BROAD.test(d)){
      broadRows++;countMap(broadBresult,br||'(blank)');
      for(const kw of ['エラー','失策','悪送球','後逸','落球','ファンブル','トンネル','お手玉','捕球ミス','送球ミス'])if(d.includes(kw))countMap(keywordCounts,kw);
      if(parseCurrent(d))currentRows++;else{countMap(unmatchedDescriptions,d.slice(0,160));if(broadDescExamples.length<100)broadDescExamples.push({fn,br,d:d.slice(0,200)});}
    }
    const key=`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`;let e=pa.get(key);if(!e){e={rows:[],lastPitchIndex:-1,lastPitch:null};pa.set(key,e);}e.rows.push(r);if(isPitch(r,c)){e.lastPitch=r;e.lastPitchIndex=e.rows.length-1;}
  }
  for(const e of pa.values()){
    if(!e.lastPitch)continue;
    const all=e.rows.map(r=>String(r[c.desc]??'')).join(' || ');
    if(BROAD.test(all)){broadPa++;countMap(bresultBroadPA,String(e.lastPitch[c.br]??'')||'(blank)');}
    const tail=e.rows.slice(Math.max(0,e.lastPitchIndex)).map(r=>String(r[c.desc]??'')).join(' || ');
    if(BROAD.test(tail)){
      tailBroadPa++;countMap(tailBresult,String(e.lastPitch[c.br]??'')||'(blank)');
      if(CURRENT.some(re=>re.test(tail)))tailCurrentPa++;
    }
    paRows.push({br:String(e.lastPitch[c.br]??''),broad:BROAD.test(all),tailBroad:BROAD.test(tail)});
  }
}

const db=new DatabaseSync(DB,{readOnly:true});
const tableCols=db.prepare(`PRAGMA table_info(v_fielding)`).all().map(r=>r.name);
const vf=db.prepare(`SELECT season,player_id,team,name,position,g,e FROM v_fielding WHERE season=2024`).all();
// Raw sum, and dedupe identical player/team/position rows. Also player max/sum diagnostics.
const rawESum=vf.reduce((s,r)=>s+(Number(r.e)||0),0);
const uniquePTP=new Map();
for(const r of vf){const k=`${r.player_id}|${r.team}|${r.position}`;if(!uniquePTP.has(k))uniquePTP.set(k,r);}
const uniquePTPESum=[...uniquePTP.values()].reduce((s,r)=>s+(Number(r.e)||0),0);
const byPlayer=new Map();
for(const r of uniquePTP.values()){const k=String(r.player_id);const p=byPlayer.get(k)??{sum:0,max:0,rows:0,name:r.name};const e=Number(r.e)||0;p.sum+=e;p.max=Math.max(p.max,e);p.rows++;byPlayer.set(k,p);}
const playerSum=[...byPlayer.values()].reduce((s,p)=>s+p.sum,0);
const playerMax=[...byPlayer.values()].reduce((s,p)=>s+p.max,0);
const posErrors=new Map();for(const r of uniquePTP.values())countMap(posErrors,r.position,Number(r.e)||0);
// Existing fielding_plays snapshot, if present.
let fp=null;
try{fp=db.prepare(`SELECT SUM(chances) chances,SUM(throw_errors) te,SUM(field_errors) fe,SUM(unknown_errors) ue FROM fielding_plays WHERE season=2024`).get();}catch{}
db.close();

const pct=(a,b)=>b?`${(a/b*100).toFixed(1)}%`:'—';
const lines=[
'# 2024 PBP失策ラベル網羅率監査','',
'判定: **RESEARCH_ONLY_LABEL_RECALL_AUDIT**','',
`regular PBP rows: ${regularRows}`,
`broad error-keyword rows: ${broadRows}`,
`current regex matched rows: ${currentRows} (${pct(currentRows,broadRows)} of broad-keyword rows)`,
`PA with broad error keyword anywhere: ${broadPa}`,
`PA with broad keyword at/after last real pitch: ${tailBroadPa}`,
`tail PA matched by current regex: ${tailCurrentPa} (${pct(tailCurrentPa,tailBroadPa)})`,'',
'## broad keyword counts','',
'| keyword | rows |','|---|---:|',...top(keywordCounts,30).map(([k,v])=>`| ${k} | ${v} |`),'',
'## bresult among broad-keyword rows','',
'| bresult | rows |','|---|---:|',...top(broadBresult,30).map(([k,v])=>`| ${k} | ${v} |`),'',
'## final-pitch bresult for PA with tail error keyword','',
'| bresult | PA |','|---|---:|',...top(tailBresult,30).map(([k,v])=>`| ${k} | ${v} |`),'',
'## current regex misses among broad keyword descriptions','',
'| count | description |','|---:|---|',...top(unmatchedDescriptions,40).map(([k,v])=>`| ${v} | ${k.replace(/\|/g,'/')} |`),'',
'## v_fielding 2024 error-total diagnostics','',
`columns: ${tableCols.join(', ')}`,
`rows: ${vf.length}`,
`raw sum E: ${rawESum}`,
`dedup player-team-position sum E: ${uniquePTPESum}`,
`player sum across positions: ${playerSum}`,
`player max across positions: ${playerMax}`,'',
'| position | E sum (dedup player-team-position) |','|---|---:|',...top(posErrors,30).map(([k,v])=>`| ${k} | ${v} |`),'',
'## existing fielding_plays snapshot','',
fp?`chances=${fp.chances} / FE=${fp.fe} / TE=${fp.te} / unknown=${fp.ue}`:'fielding_plays unavailable','',
'## interpretation','',
'- PBPの広いキーワードと現regexの差から、regexの表記漏れを特定する。',
'- bresultが失策PAで特定コードへ集中する場合、説明文regexの補助ラベルとして検討する。ただしコード意味はこの監査だけで断定しない。',
'- v_fieldingのEはFE/TE分離ではないため、PBPラベルの種類別正解には直接使わない。総数・選手年整合の外部チェックとして扱う。',''];
const text=lines.join('\n');if(OUT)writeFileSync(OUT,text,'utf8');console.log(text);

// 捕球再設計用: 守備の1プレーずつを、難易度説明変数つきで保存する。
//
// 元の build_fielding_plays.mjs は「同じPBPから分母とTE/FEを数える」点は正しいが、
// 選手×年×位置へ集約するため、打球位置・打球種・走者状況を失う。
// 今回は expected-error モデルを作るため、集約前の1プレーを残す。
//
// 目的:
//   P(field error) = f(position, location, batted-ball type, runner context,
//                      workload/rest context, season/park, ...)
//   catching evidence = actual FE - expected FE
//
// TE（悪送球）は捕球へ入れない。unknown errorも勝手にFEへ振らない。
// 生PBPが無いハンドオフrepoでは実行できない。Claude Code元環境で再生成する。
//
// 出典: Nippon Baseball Data Repository（MIT License）
// This uses data sourced from the Nippon Baseball Data Repository.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RAW=path.join(ROOT,'data','raw','npb_pbp');

function splitCsvLine(line){
  const out=[]; let f='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true; else if(c===','){out.push(f);f='';} else f+=c;
  }
  out.push(f); return out;
}
const norm=s=>(s??'').normalize('NFKC').replace(/[\s　]/g,'');
const REGULAR=new Set(['1','2','26']);
const POS={1:'投',2:'捕',3:'一',4:'二',5:'三',6:'遊',7:'左',8:'中',9:'右'};

const ERROR_PATTERNS=[
  {re:/([^\s、。]+?)\(([投捕一二三遊左中右])\)の悪送球/,kind:'throw'},
  {re:/([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*悪送球/,kind:'throw'},
  {re:/([^\s、。]+?)\(([投捕一二三遊左中右])\)の落球/,kind:'field'},
  {re:/([^\s、。]+?)\(([投捕一二三遊左中右])\)の後逸/,kind:'field'},
  {re:/([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*後逸/,kind:'field'},
  {re:/([^\s、。]+?)\(([投捕一二三遊左中右])\)の(?:エラー|失策)/,kind:'unknown'},
  {re:/([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*(?:エラー|失策)/,kind:'unknown'},
];
const ballType=d=>/バント/.test(d)?'bunt':/ゴロ/.test(d)?'grounder':/ライナー/.test(d)?'liner':/フライ/.test(d)?'fly':'other';

if(!existsSync(RAW)){console.error('1球データがありません。Claude Code元環境で実行してください');process.exit(1);}
const files=readdirSync(RAW).filter(f=>f.endsWith('_pbp.csv')).sort();
const events=[];

for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split('\n');
  const hdr=splitCsvLine(lines[0]); const I=n=>hdr.indexOf(n);
  const c={
    season:I('season'),date:I('game_date'),game:I('game_id'),inn:I('inning'),ab:I('inning_ab_num'),
    type:I('game_type_id'),park:I('stadium_name'),batter:I('PlayInfo_PlayerName'),hand:I('batter_hand'),
    hl:I('hit_location'),fielder:I('fielder_name'),hx:I('hc_x'),hy:I('hc_y'),desc:I('description_jap'),
    on1:I('on_1b'),on2:I('on_2b'),on3:I('on_3b'),
  };
  const last=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue; const r=splitCsvLine(lines[i]);
    if(!REGULAR.has(r[c.type]))continue;
    last.set(`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`,r);
  }
  for(const r of last.values()){
    const pos=POS[Number(r[c.hl])];
    if(!pos || !r[c.fielder])continue; // 分母と分子を同じ「処理野手が特定できるプレー」に限定
    const d=(r[c.desc]??'').replace(/^\d+球目:/,'');
    let err=null;
    for(const p of ERROR_PATTERNS){const m=d.match(p.re);if(m){err={kind:p.kind,fielder:norm(m[1]),pos:m[2]};break;}}
    const fielder=norm(r[c.fielder]);
    events.push({
      season:Number(r[c.season]),date:r[c.date],game_id:r[c.game],inning:r[c.inn],ab_num:r[c.ab],park:r[c.park],
      batter:r[c.batter],batter_norm:norm(r[c.batter]),bats:r[c.hand],
      fielder:r[c.fielder],fielder_norm:fielder,pos,
      hc_x:r[c.hx]?Number(r[c.hx]):null,hc_y:r[c.hy]?Number(r[c.hy]):null,hit_location:Number(r[c.hl]),
      ball_type:ballType(d),has_runner:(r[c.on1]||r[c.on2]||r[c.on3])?1:0,
      error_type:err?.kind??null,error_fielder:err?.fielder??null,error_pos:err?.pos??null,
      // 捕球モデルの目的変数。別野手の中継エラー等を現在の処理野手へ誤帰属しない。
      is_field_error:err?.kind==='field'&&err.fielder===fielder?1:0,
      is_throw_error:err?.kind==='throw'&&err.fielder===fielder?1:0,
      is_unknown_error:err?.kind==='unknown'&&err.fielder===fielder?1:0,
      description:d.slice(0,100),
    });
  }
  console.error(`  ${fn}`);
}

const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
db.exec('DROP TABLE IF EXISTS fielding_error_events');
db.exec(`CREATE TABLE fielding_error_events (
  season INTEGER,date TEXT,game_id TEXT,inning TEXT,ab_num TEXT,park TEXT,
  batter TEXT,batter_norm TEXT,bats TEXT,
  fielder TEXT,fielder_norm TEXT,pos TEXT,
  hc_x REAL,hc_y REAL,hit_location INTEGER,ball_type TEXT,has_runner INTEGER,
  error_type TEXT,error_fielder TEXT,error_pos TEXT,
  is_field_error INTEGER,is_throw_error INTEGER,is_unknown_error INTEGER,description TEXT
)`);
const ins=db.prepare(`INSERT INTO fielding_error_events VALUES (${Array(24).fill('?').join(',')})`);
db.exec('BEGIN');
for(const e of events)ins.run(e.season,e.date,e.game_id,e.inning,e.ab_num,e.park,e.batter,e.batter_norm,e.bats,
  e.fielder,e.fielder_norm,e.pos,e.hc_x,e.hc_y,e.hit_location,e.ball_type,e.has_runner,e.error_type,e.error_fielder,e.error_pos,
  e.is_field_error,e.is_throw_error,e.is_unknown_error,e.description);
db.exec('COMMIT');
db.exec('CREATE INDEX idx_fee_fielder ON fielding_error_events(fielder_norm,season,pos)');
db.exec('CREATE INDEX idx_fee_context ON fielding_error_events(season,pos,ball_type,hc_x,hc_y)');

const sum=k=>events.reduce((s,e)=>s+(e[k]??0),0);
console.log(`\nfielding_error_events ${events.length.toLocaleString()}件`);
console.log(`  FE ${sum('is_field_error')} / TE ${sum('is_throw_error')} / unknown ${sum('is_unknown_error')}`);
console.log(`  座標あり ${events.filter(e=>e.hc_x!=null&&e.hc_y!=null).length.toLocaleString()}件`);
console.log('  ※次工程で workload/rest と打球難度を作る。ここでは固定加点・能力値化しない。');
console.log('出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

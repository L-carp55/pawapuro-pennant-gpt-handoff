// 捕球再設計用: 守備の1プレーずつを、難易度説明変数つきで保存する。
//
// expected-error のために、集約前の打球文脈とFE/TEを同じPBPから作る。
// TE（悪送球）は捕球へ入れず、unknown errorも勝手にFEへ振らない。
//
// 2026-08-07安全規律:
// - 打球文脈は打席の最終「実投球」行を使う。ヘッダー/交代/牽制等を打球行にしない。
// - 失策説明は最終実投球行と、その後の同一打席non-pitch行まで読む。
//   （PBPでは悪送球・後逸が打球行の次行に書かれる場合がある。）
// - 選手identityは同じ投球時点の fielder_2_name〜fielder_9_name のフルネームを優先する。
// - 守備負荷は実投球だけを数え、current gameの最終球数を当該プレーの説明変数へ入れない。
// - raw/DB pathは環境変数で差し替え可能。PBP_DRY_RUN=1ならDBを書き換えない。
//
// 出典: Nippon Baseball Data Repository（MIT License）

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDefensiveWorkloadContexts } from '../src/ratings/fielding_workload.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RAW=process.env.PBP_RAW_DIR ? path.resolve(process.env.PBP_RAW_DIR) : path.join(ROOT,'data','raw','npb_pbp');
const DB_PATH=process.env.PBP_DB_PATH ? path.resolve(process.env.PBP_DB_PATH) : path.join(ROOT,'data','pennant.db');
const DRY_RUN=process.env.PBP_DRY_RUN==='1';

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
const isRealPitch=(r,c)=>{
  const pn=c.pitch>=0?Number(r[c.pitch]):NaN;
  if(Number.isFinite(pn)&&pn>0)return true;
  return /^\d+球目:/.test(r[c.desc]??'');
};
function parseError(description){
  const d=String(description??'').replace(/^\d+球目:/,'');
  for(const p of ERROR_PATTERNS){
    const m=d.match(p.re);
    if(m)return {kind:p.kind,fielder:norm(m[1]),pos:m[2],description:d};
  }
  return null;
}

if(!existsSync(RAW)){console.error(`1球データがありません: ${RAW}`);process.exit(1);}
const files=readdirSync(RAW).filter(f=>f.endsWith('_pbp.csv')).sort();
if(!files.length){console.error(`*_pbp.csv がありません: ${RAW}`);process.exit(1);}
const events=[];
const gameLoads=new Map();
let paWithMultipleTailErrors=0;

for(const fn of files){
  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);
  const hdr=splitCsvLine(lines[0].replace(/^\uFEFF/,'')); const I=n=>hdr.indexOf(n);
  const c={
    season:I('season'),date:I('game_date'),game:I('game_id'),inn:I('inning'),ab:I('inning_ab_num'),
    type:I('game_type_id'),park:I('stadium_name'),batter:I('PlayInfo_PlayerName'),hand:I('batter_hand'),
    pitch:I('pitch_number'),hl:I('hit_location'),fielder:I('fielder_name'),hx:I('hc_x'),hy:I('hc_y'),desc:I('description_jap'),
    bresult:I('bresult'),on1:I('on_1b'),on2:I('on_2b'),on3:I('on_3b'),
  };
  const required=['season','date','game','inn','ab','type','desc','pitch','hl','fielder','bresult'];
  const missing=required.filter(k=>c[k]<0);
  if(missing.length)throw new Error(`${fn}: 必須列がありません: ${missing.join(', ')}`);
  const defCols=[2,3,4,5,6,7,8,9]
    .map(no=>({no,idx:I(`fielder_${no}_name`),pos:POS[no]}))
    .filter(x=>x.idx>=0);
  if(!defCols.length)throw new Error(`${fn}: fielder_2_name〜fielder_9_name がありません`);
  const defByNo=new Map(defCols.map(x=>[x.no,x]));

  // PAごとに全行を保持し、文脈用の最終実投球と、その後の失策説明を分離する。
  const pa=new Map();
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const r=splitCsvLine(lines[i]);
    if(!REGULAR.has(r[c.type]))continue;
    const key=`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`;
    let e=pa.get(key);
    if(!e){e={rows:[],lastPitch:null,lastPitchIndex:-1};pa.set(key,e);}
    e.rows.push(r);

    if(!isRealPitch(r,c))continue;
    e.lastPitch=r;
    e.lastPitchIndex=e.rows.length-1;

    // 実投球だけから守備負荷を数える。
    const season=Number(r[c.season]),gameId=r[c.game];
    if(Number.isFinite(season)&&gameId){
      const gk=`${season}|${gameId}`;
      if(!gameLoads.has(gk))gameLoads.set(gk,{season,date:r[c.date],game_id:gameId,players:new Map()});
      const g=gameLoads.get(gk);
      if(!g.date&&r[c.date])g.date=r[c.date];
      for(const f of defCols){
        const nm=norm(r[f.idx]);
        if(!nm)continue;
        g.players.set(nm,(g.players.get(nm)??0)+1);
      }
    }
  }

  for(const entry of pa.values()){
    const r=entry.lastPitch;
    if(!r)continue;
    const hitNo=Number(r[c.hl]);
    const pos=POS[hitNo];
    if(!pos || !r[c.fielder])continue;

    const defCol=defByNo.get(hitNo);
    const fullFielder=defCol ? norm(r[defCol.idx]) : null;
    const shortFielder=norm(r[c.fielder]);
    const fielder=fullFielder||shortFielder;
    if(!fielder)continue;

    // 最終実投球とその後の同一PA行だけから失策を探す。打席途中の牽制悪送球等は混ぜない。
    const tail=entry.rows.slice(Math.max(0,entry.lastPitchIndex));
    const tailErrors=[];
    for(const tr of tail){const x=parseError(tr[c.desc]);if(x)tailErrors.push(x);}
    if(tailErrors.length>1)paWithMultipleTailErrors++;
    const err=tailErrors[0]??null;

    const d=(r[c.desc]??'').replace(/^\d+球目:/,'');
    // error name表記は姓/短縮名の場合があるため、責任位置を主キーにする。
    // 同一プレーで同じ守備位置に複数野手はいない。位置が違う中継/捕球エラーは当該処理野手へ帰属させない。
    const sameResponsiblePos=!!err&&err.pos===pos;
    events.push({
      season:Number(r[c.season]),date:r[c.date],game_id:r[c.game],inning:r[c.inn],ab_num:r[c.ab],park:r[c.park],
      batter:r[c.batter],batter_norm:norm(r[c.batter]),bats:r[c.hand],
      fielder:r[defCol?.idx]||r[c.fielder],fielder_norm:fielder,fielder_short:shortFielder,pos,
      hc_x:r[c.hx]?Number(r[c.hx]):null,hc_y:r[c.hy]?Number(r[c.hy]):null,hit_location:hitNo,
      bresult:r[c.bresult]!==''?Number(r[c.bresult]):null,
      ball_type:ballType(d),has_runner:(r[c.on1]||r[c.on2]||r[c.on3])?1:0,
      error_type:err?.kind??null,error_fielder:err?.fielder??null,error_pos:err?.pos??null,
      is_field_error:err?.kind==='field'&&sameResponsiblePos?1:0,
      is_throw_error:err?.kind==='throw'&&sameResponsiblePos?1:0,
      is_unknown_error:err?.kind==='unknown'&&sameResponsiblePos?1:0,
      description:d.slice(0,120),
      error_description:err?.description?.slice(0,120)??null,
    });
  }
  console.error(`  ${fn}`);
}

const workloadRows=[];
for(const g of gameLoads.values())for(const [player,pitches] of g.players){
  workloadRows.push({season:g.season,date:g.date,game_id:g.game_id,player,pitches});
}
const workload=buildDefensiveWorkloadContexts(workloadRows);
for(const e of events){
  const w=workload.get(`${e.season}|${e.game_id}|${e.fielder_norm}`)??null;
  e.prev_def_game_gap_days=w?.prev_def_game_gap_days??null;
  e.prior_def_games_7d=w?.prior_def_games_7d??null;
  e.prior_def_games_14d=w?.prior_def_games_14d??null;
  e.prior_def_pitches_7d=w?.prior_def_pitches_7d??null;
  e.prior_def_pitches_14d=w?.prior_def_pitches_14d??null;
  e.season_def_games_before=w?.season_def_games_before??null;
  e.season_def_pitches_before=w?.season_def_pitches_before??null;
}

if(!DRY_RUN){
  const db=new DatabaseSync(DB_PATH);
  db.exec('DROP TABLE IF EXISTS fielding_error_events');
  db.exec(`CREATE TABLE fielding_error_events (
    season INTEGER,date TEXT,game_id TEXT,inning TEXT,ab_num TEXT,park TEXT,
    batter TEXT,batter_norm TEXT,bats TEXT,
    fielder TEXT,fielder_norm TEXT,fielder_short TEXT,pos TEXT,
    hc_x REAL,hc_y REAL,hit_location INTEGER,bresult REAL,ball_type TEXT,has_runner INTEGER,
    error_type TEXT,error_fielder TEXT,error_pos TEXT,
    is_field_error INTEGER,is_throw_error INTEGER,is_unknown_error INTEGER,
    prev_def_game_gap_days REAL,
    prior_def_games_7d INTEGER,prior_def_games_14d INTEGER,
    prior_def_pitches_7d INTEGER,prior_def_pitches_14d INTEGER,
    season_def_games_before INTEGER,season_def_pitches_before INTEGER,
    description TEXT,error_description TEXT
  )`);
  const ins=db.prepare(`INSERT INTO fielding_error_events VALUES (${Array(34).fill('?').join(',')})`);
  db.exec('BEGIN');
  for(const e of events)ins.run(
    e.season,e.date,e.game_id,e.inning,e.ab_num,e.park,e.batter,e.batter_norm,e.bats,
    e.fielder,e.fielder_norm,e.fielder_short,e.pos,e.hc_x,e.hc_y,e.hit_location,e.bresult,e.ball_type,e.has_runner,
    e.error_type,e.error_fielder,e.error_pos,e.is_field_error,e.is_throw_error,e.is_unknown_error,
    e.prev_def_game_gap_days,e.prior_def_games_7d,e.prior_def_games_14d,e.prior_def_pitches_7d,e.prior_def_pitches_14d,
    e.season_def_games_before,e.season_def_pitches_before,e.description,e.error_description);
  db.exec('COMMIT');
  db.exec('CREATE INDEX idx_fee_fielder ON fielding_error_events(fielder_norm,season,pos)');
  db.exec('CREATE INDEX idx_fee_context ON fielding_error_events(season,pos,ball_type,hc_x,hc_y)');
  db.exec('CREATE INDEX idx_fee_game ON fielding_error_events(game_id,season)');
  db.close();
}

const sum=k=>events.reduce((s,e)=>s+(e[k]??0),0);
const workloadN=events.filter(e=>e.season_def_pitches_before!=null).length;
const fullNameN=events.filter(e=>e.fielder_norm&&e.fielder_norm!==e.fielder_short).length;
console.log(`\nfielding_error_events ${events.length.toLocaleString()}件`);
console.log(`  FE ${sum('is_field_error')} / TE ${sum('is_throw_error')} / unknown ${sum('is_unknown_error')}`);
console.log(`  座標あり ${events.filter(e=>e.hc_x!=null&&e.hc_y!=null).length.toLocaleString()}件`);
console.log(`  負荷contextあり ${workloadN.toLocaleString()}件 (${events.length?(workloadN/events.length*100).toFixed(1):'0.0'}%)`);
console.log(`  守備配置full-nameでidentity補強 ${fullNameN.toLocaleString()}件`);
console.log(`  同一PAのtailで複数失策記述 ${paWithMultipleTailErrors}件`);
console.log('  workload列は生の説明変数。固定加点はせず、expected-error較正で採否・重みを決める。');
console.log(`  mode ${DRY_RUN?'DRY_RUN':`WRITE ${DB_PATH}`}`);
console.log('出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');

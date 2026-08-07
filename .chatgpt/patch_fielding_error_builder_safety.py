from pathlib import Path
p=Path('scripts/build_fielding_error_events.mjs')
s=p.read_text(encoding='utf-8')

def repl(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new)

repl(
"""const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RAW=path.join(ROOT,'data','raw','npb_pbp');
""",
"""const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RAW=process.env.PBP_RAW_DIR ? path.resolve(process.env.PBP_RAW_DIR) : path.join(ROOT,'data','raw','npb_pbp');
const DB_PATH=process.env.PBP_DB_PATH ? path.resolve(process.env.PBP_DB_PATH) : path.join(ROOT,'data','pennant.db');
const DRY_RUN=process.env.PBP_DRY_RUN==='1';
""",
'env paths')

repl(
"""const ballType=d=>/バント/.test(d)?'bunt':/ゴロ/.test(d)?'grounder':/ライナー/.test(d)?'liner':/フライ/.test(d)?'fly':'other';
""",
"""const ballType=d=>/バント/.test(d)?'bunt':/ゴロ/.test(d)?'grounder':/ライナー/.test(d)?'liner':/フライ/.test(d)?'fly':'other';
const isRealPitch=(r,c)=>{
  const pn=c.pitch>=0?Number(r[c.pitch]):NaN;
  if(Number.isFinite(pn)&&pn>0)return true;
  return /^\d+球目:/.test(r[c.desc]??'');
};
""",
'real pitch helper')

repl(
"""  const lines=readFileSync(path.join(RAW,fn),'utf8').split('\n');
  const hdr=splitCsvLine(lines[0]); const I=n=>hdr.indexOf(n);
""",
"""  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\r?\n/);
  const hdr=splitCsvLine(lines[0].replace(/^\uFEFF/,'')); const I=n=>hdr.indexOf(n);
""",
'robust lines/header')

repl(
"""    type:I('game_type_id'),park:I('stadium_name'),batter:I('PlayInfo_PlayerName'),hand:I('batter_hand'),
    hl:I('hit_location'),fielder:I('fielder_name'),hx:I('hc_x'),hy:I('hc_y'),desc:I('description_jap'),
""",
"""    type:I('game_type_id'),park:I('stadium_name'),batter:I('PlayInfo_PlayerName'),hand:I('batter_hand'),
    pitch:I('pitch_number'),hl:I('hit_location'),fielder:I('fielder_name'),hx:I('hc_x'),hy:I('hc_y'),desc:I('description_jap'),
""",
'pitch column')

repl(
"""  const defCols=[2,3,4,5,6,7,8,9]
    .map(no=>({idx:I(`fielder_${no}_name`),pos:POS[no]}))
    .filter(x=>x.idx>=0);
  const last=new Map();
""",
"""  const required=['season','date','game','inn','ab','type','desc','pitch','hl','fielder'];
  const missing=required.filter(k=>c[k]<0);
  if(missing.length)throw new Error(`${fn}: 必須列がありません: ${missing.join(', ')}`);
  const defCols=[2,3,4,5,6,7,8,9]
    .map(no=>({idx:I(`fielder_${no}_name`),pos:POS[no]}))
    .filter(x=>x.idx>=0);
  if(!defCols.length)throw new Error(`${fn}: fielder_2_name〜fielder_9_name がありません`);
  const lastPitch=new Map();
""",
'required schema + lastPitch')

repl(
"""    if(!lines[i].trim())continue; const r=splitCsvLine(lines[i]);
    if(!REGULAR.has(r[c.type]))continue;
    last.set(`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`,r);

    // 各球の守備配置から、その試合で何球守備についていたかを数える。
    // 同一選手は1球につき1守備位置にだけ現れるため、1行=1守備球として加算できる。
""",
"""    if(!lines[i].trim())continue; const r=splitCsvLine(lines[i]);
    if(!REGULAR.has(r[c.type]))continue;
    if(!isRealPitch(r,c))continue; // ヘッダー・交代・牽制イベント等を守備球数/最終プレーへ混ぜない
    lastPitch.set(`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`,r);

    // 実投球行だけから、その試合で各野手が何球守備についていたかを数える。
    // 同一選手は1投球につき1守備位置にだけ現れるため、1実投球=1守備球として加算できる。
""",
'pitch-only rows')

repl(
"""  for(const r of last.values()){
""",
"""  for(const r of lastPitch.values()){
""",
'use lastPitch')

repl(
"""const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));
db.exec('DROP TABLE IF EXISTS fielding_error_events');
""",
"""if(!DRY_RUN){
const db=new DatabaseSync(DB_PATH);
db.exec('DROP TABLE IF EXISTS fielding_error_events');
""",
'conditional db begin')

repl(
"""console.log(`\nfielding_error_events ${events.length.toLocaleString()}件`);
""",
"""db.close();
}

console.log(`\nfielding_error_events ${events.length.toLocaleString()}件`);
""",
'conditional db end')

old="""console.log('出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();
"""
new="""console.log(`  mode ${DRY_RUN?'DRY_RUN':`WRITE ${DB_PATH}`}`);
console.log('出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
"""
repl(old,new,'remove trailing close / mode')

# The original summary helper now sits inside the conditional write block. Move it outside so dry-run can print counts.
repl(
"""const sum=k=>events.reduce((s,e)=>s+(e[k]??0),0);
db.close();
}

console.log(`\nfielding_error_events ${events.length.toLocaleString()}件`);
""",
"""db.close();
}

const sum=k=>events.reduce((s,e)=>s+(e[k]??0),0);
console.log(`\nfielding_error_events ${events.length.toLocaleString()}件`);
""",
'move dry-run summary helper')

p.write_text(s,encoding='utf-8')
print('patched fielding error builder safety')

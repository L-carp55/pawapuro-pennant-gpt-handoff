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
"""const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');\nconst RAW=path.join(ROOT,'data','raw','npb_pbp');\n""",
"""const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');\nconst RAW=process.env.PBP_RAW_DIR ? path.resolve(process.env.PBP_RAW_DIR) : path.join(ROOT,'data','raw','npb_pbp');\nconst DB_PATH=process.env.PBP_DB_PATH ? path.resolve(process.env.PBP_DB_PATH) : path.join(ROOT,'data','pennant.db');\nconst DRY_RUN=process.env.PBP_DRY_RUN==='1';\n""",
'env paths')

repl(
"""const ballType=d=>/バント/.test(d)?'bunt':/ゴロ/.test(d)?'grounder':/ライナー/.test(d)?'liner':/フライ/.test(d)?'fly':'other';\n""",
"""const ballType=d=>/バント/.test(d)?'bunt':/ゴロ/.test(d)?'grounder':/ライナー/.test(d)?'liner':/フライ/.test(d)?'fly':'other';\nconst isRealPitch=(r,c)=>{\n  const pn=c.pitch>=0?Number(r[c.pitch]):NaN;\n  if(Number.isFinite(pn)&&pn>0)return true;\n  return /^\\d+球目:/.test(r[c.desc]??'');\n};\n""",
'real pitch helper')

repl(
"""  const lines=readFileSync(path.join(RAW,fn),'utf8').split('\\n');\n  const hdr=splitCsvLine(lines[0]); const I=n=>hdr.indexOf(n);\n""",
"""  const lines=readFileSync(path.join(RAW,fn),'utf8').split(/\\r?\\n/);\n  const hdr=splitCsvLine(lines[0].replace(/^\\uFEFF/,'')); const I=n=>hdr.indexOf(n);\n""",
'robust lines/header')

repl(
"""    type:I('game_type_id'),park:I('stadium_name'),batter:I('PlayInfo_PlayerName'),hand:I('batter_hand'),\n    hl:I('hit_location'),fielder:I('fielder_name'),hx:I('hc_x'),hy:I('hc_y'),desc:I('description_jap'),\n""",
"""    type:I('game_type_id'),park:I('stadium_name'),batter:I('PlayInfo_PlayerName'),hand:I('batter_hand'),\n    pitch:I('pitch_number'),hl:I('hit_location'),fielder:I('fielder_name'),hx:I('hc_x'),hy:I('hc_y'),desc:I('description_jap'),\n""",
'pitch column')

repl(
"""  const defCols=[2,3,4,5,6,7,8,9]\n    .map(no=>({idx:I(`fielder_${no}_name`),pos:POS[no]}))\n    .filter(x=>x.idx>=0);\n  const last=new Map();\n""",
"""  const required=['season','date','game','inn','ab','type','desc','pitch','hl','fielder'];\n  const missing=required.filter(k=>c[k]<0);\n  if(missing.length)throw new Error(`${fn}: 必須列がありません: ${missing.join(', ')}`);\n  const defCols=[2,3,4,5,6,7,8,9]\n    .map(no=>({idx:I(`fielder_${no}_name`),pos:POS[no]}))\n    .filter(x=>x.idx>=0);\n  if(!defCols.length)throw new Error(`${fn}: fielder_2_name〜fielder_9_name がありません`);\n  const lastPitch=new Map();\n""",
'required schema + lastPitch')

repl(
"""    if(!lines[i].trim())continue; const r=splitCsvLine(lines[i]);\n    if(!REGULAR.has(r[c.type]))continue;\n    last.set(`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`,r);\n\n    // 各球の守備配置から、その試合で何球守備についていたかを数える。\n    // 同一選手は1球につき1守備位置にだけ現れるため、1行=1守備球として加算できる。\n""",
"""    if(!lines[i].trim())continue; const r=splitCsvLine(lines[i]);\n    if(!REGULAR.has(r[c.type]))continue;\n    if(!isRealPitch(r,c))continue; // ヘッダー・交代・牽制イベント等を守備球数/最終プレーへ混ぜない\n    lastPitch.set(`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`,r);\n\n    // 実投球行だけから、その試合で各野手が何球守備についていたかを数える。\n    // 同一選手は1投球につき1守備位置にだけ現れるため、1実投球=1守備球として加算できる。\n""",
'pitch-only rows')

repl(
"""  for(const r of last.values()){\n""",
"""  for(const r of lastPitch.values()){\n""",
'use lastPitch')

repl(
"""const db=new DatabaseSync(path.join(ROOT,'data','pennant.db'));\ndb.exec('DROP TABLE IF EXISTS fielding_error_events');\n""",
"""if(!DRY_RUN){\nconst db=new DatabaseSync(DB_PATH);\ndb.exec('DROP TABLE IF EXISTS fielding_error_events');\n""",
'conditional db begin')

repl(
"""console.log(`\\nfielding_error_events ${events.length.toLocaleString()}件`);\n""",
"""db.close();\n}\n\nconsole.log(`\\nfielding_error_events ${events.length.toLocaleString()}件`);\n""",
'conditional db end')

# Remove old trailing db.close(), exactly one should remain after stats.
old="""console.log('出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');\ndb.close();\n"""
new="""console.log(`  mode ${DRY_RUN?'DRY_RUN':`WRITE ${DB_PATH}`}`);\nconsole.log('出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');\n"""
repl(old,new,'remove trailing close / mode')

p.write_text(s,encoding='utf-8')
print('patched fielding error builder safety')

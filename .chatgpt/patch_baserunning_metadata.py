from pathlib import Path

p=Path('scripts/build_baserunning_advances.mjs')
s=p.read_text(encoding='utf-8')

def repl(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new)

repl(
"""    hx: I('hc_x'), hy: I('hc_y'), hl: I('hit_location'), park: I('stadium_name'),\n""",
"""    hx: I('hc_x'), hy: I('hc_y'), hl: I('hit_location'), park: I('stadium_name'),\n    date: I('game_date'), fielder: I('fielder_name'),\n""",
'columns')

repl(
"""  const required = ['season','game','inn','ab','type','state','desc','pitch','on1','on1n','on2','on2n','on3','on3n','outs'];\n""",
"""  const required = ['season','game','inn','ab','type','state','desc','pitch','on1','on1n','on2','on2n','on3','on3n','outs','date'];\n""",
'require date')

repl(
"""    const push = (kind, runner, success) => events.push({\n      season: Number(curLast[c.season]), park: c.park >= 0 ? curLast[c.park] : null,\n      kind,\n""",
"""    const push = (kind, runner, success) => events.push({\n      season: Number(curLast[c.season]),\n      game_id: c.game >= 0 ? curLast[c.game] : g1,\n      date: c.date >= 0 ? curLast[c.date] : null,\n      park: c.park >= 0 ? curLast[c.park] : null,\n      fielder: c.fielder >= 0 ? curLast[c.fielder] : null,\n      kind,\n""",
'event metadata')

repl(
"""  db.exec(`CREATE TABLE baserunning_advances (\n    season INTEGER, park TEXT, kind TEXT, runner_id TEXT, runner TEXT, runner_norm TEXT,\n    outs INTEGER, success INTEGER, hc_x REAL, hc_y REAL, hit_location INTEGER, description TEXT)`);\n  const ins = db.prepare(`INSERT INTO baserunning_advances VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);\n  db.exec('BEGIN');\n  for (const e of events) ins.run(e.season, e.park, e.kind, e.runner_id, e.runner, e.runner_norm,\n    e.outs, e.success, e.hc_x, e.hc_y, e.hit_location, e.description);\n""",
"""  db.exec(`CREATE TABLE baserunning_advances (\n    season INTEGER, game_id TEXT, date TEXT, park TEXT, fielder TEXT, kind TEXT,\n    runner_id TEXT, runner TEXT, runner_norm TEXT, outs INTEGER, success INTEGER,\n    hc_x REAL, hc_y REAL, hit_location INTEGER, description TEXT)`);\n  const ins = db.prepare(`INSERT INTO baserunning_advances VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);\n  db.exec('BEGIN');\n  for (const e of events) ins.run(e.season, e.game_id, e.date, e.park, e.fielder, e.kind,\n    e.runner_id, e.runner, e.runner_norm, e.outs, e.success, e.hc_x, e.hc_y, e.hit_location, e.description);\n""",
'schema metadata')

repl(
"""  db.exec(`CREATE INDEX idx_bra_id ON baserunning_advances(runner_id, season)`);\n""",
"""  db.exec(`CREATE INDEX idx_bra_id ON baserunning_advances(runner_id, season)`);\n  db.exec(`CREATE INDEX idx_bra_game ON baserunning_advances(game_id, season)`);\n  db.exec(`CREATE INDEX idx_bra_date ON baserunning_advances(date, season)`);\n""",
'indexes')

p.write_text(s,encoding='utf-8')
print('patched baserunning event metadata')

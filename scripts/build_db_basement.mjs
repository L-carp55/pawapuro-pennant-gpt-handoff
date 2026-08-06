// NPB Basement のJSONをSQLiteへ取り込む。
// 出典: NPB Basement (https://npbbasement.com/)
// 原則: 欠損は0にせずnull（Sol仕様 03 §1.3）
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data', 'raw', 'basement');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const n = v => (v === undefined || v === null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const s = v => (v === undefined || v === null || v === '' ? null : String(v));

db.exec(`
DROP TABLE IF EXISTS bm_player;
DROP TABLE IF EXISTS bm_bat;
DROP TABLE IF EXISTS bm_fld;
DROP TABLE IF EXISTS bm_pit;
DROP TABLE IF EXISTS bm_pv;
DROP TABLE IF EXISTS bm_pd;

CREATE TABLE bm_player (
  season INTEGER, farm INTEGER, player_id TEXT, team TEXT, name_ja TEXT, name_en TEXT, name_sponavi TEXT,
  war REAL, bat_war REAL, run_war REAL, fld_war REAL, pit_war REAL,
  ubr REAL, wsb REAL, dpar REAL,
  def_inn REAL, tzr REAL, rngr REAL, dpr REAL, arm REAL, errr REAL, pos_adj REAL
);
CREATE TABLE bm_bat (
  season INTEGER, farm INTEGER, player_id TEXT,
  pa INTEGER, wraa REAL, wrc_plus REAL, ops REAL, obp REAL, slg REAL, woba REAL, iso REAL,
  k_pct REAL, bb_pct REAL, babip REAL, hr_fb_pct REAL,
  gb_pct REAL, ld_pct REAL, offb_pct REAL, iffb_pct REAL
);
CREATE TABLE bm_fld (
  season INTEGER, farm INTEGER, player_id TEXT, pos TEXT,
  inn REAL, tzr REAL, rngr REAL, dpr REAL, arm REAL, errr REAL, pos_adj REAL, framing REAL, blocking REAL
);
CREATE TABLE bm_pit (
  season INTEGER, farm INTEGER, player_id TEXT, role TEXT,
  war REAL, ip REAL, tbf INTEGER, rsaa REAL, k_bb_pct REAL, k_pct REAL, bb_pct REAL, der REAL,
  gb_pct REAL, ld_pct REAL, offb_pct REAL, iffb_pct REAL, hr_fb_pct REAL, gmli REAL,
  fip REAL, xfip REAL, tra REAL, kwera REAL, siera REAL,
  fip_minus REAL, xfip_minus REAL, tra_minus REAL, kwera_minus REAL, siera_minus REAL
);
CREATE TABLE bm_pv (
  season INTEGER, farm INTEGER, player_id TEXT, pitch_type TEXT,
  grade REAL, pitches INTEGER, pitch_pct REAL, velo REAL, xpv REAL, xpv100 REAL,
  swstr_pct REAL, whiff_pct REAL, gb_pct REAL, ld_pct REAL, offb_pct REAL, iffb_pct REAL,
  xwobacon REAL, wobacon REAL, csw_pct REAL, putaway_pct REAL
);
CREATE TABLE bm_pd (
  season INTEGER, farm INTEGER, player_id TEXT, zone TEXT,
  pitches INTEGER, pitch_pct REAL, overall REAL, swing REAL, take REAL,
  swing_pct REAL, contact_pct REAL, wobacon REAL
);
CREATE INDEX idx_bmp ON bm_player(player_id, season, farm);
CREATE INDEX idx_bmp_name ON bm_player(name_ja);
`);

// プレースホルダ数はテーブル定義から取る（手で数えると必ずズレる）
function insertFor(table) {
  const cols = db.prepare(`SELECT COUNT(*) c FROM pragma_table_info(?)`).get(table).c;
  return db.prepare(`INSERT INTO ${table} VALUES (${Array(cols).fill('?').join(',')})`);
}
const st = {
  player: insertFor('bm_player'),
  bat: insertFor('bm_bat'),
  fld: insertFor('bm_fld'),
  pit: insertFor('bm_pit'),
  pv: insertFor('bm_pv'),
  pd: insertFor('bm_pd'),
};

const counts = { player: 0, bat: 0, fld: 0, pit: 0, pv: 0, pd: 0 };
const files = (await readdir(SRC)).filter(f => f.endsWith('.json')).sort();

db.exec('BEGIN');
for (const f of files) {
  const [seasonStr, farmStr] = f.replace('.json', '').split('_');
  const season = Number(seasonStr);
  const farm = farmStr === '2g' ? 1 : 0;
  const rows = JSON.parse(await readFile(path.join(SRC, f), 'utf8'));

  for (const r of rows) {
    const id = s(r.playerID);
    const S = r.Stats || {};
    const w = S.war || {};

    st.player.run(season, farm, id, s(r.team), s(r.nameJ), s(r.nameE), s(r.nameSponavi),
      n(w.WAR), n(w.batWAR), n(w.runnWAR), n(w.fldWAR), n(w.pitWAR),
      n(w.UBR), n(w.wSB), n(w.DPAR),
      n(w.DefInn_total), n(w.TZR_total), n(w.RngR_total), n(w.DPR_total), n(w.ARM_total), n(w.ErrR_total), n(w.Pos_total));
    counts.player++;

    const b = S.bat;
    if (b && Object.keys(b).length) {
      st.bat.run(season, farm, id,
        n(b.PA), n(b.wRAA), n(b['wRC+']), n(b.OPS), n(b.OBP), n(b.SLG), n(b.wOBA), n(b.ISO),
        n(b['K%']), n(b['BB%']), n(b.BABIP), n(b['HR/FB%']),
        n(b['GB%']), n(b['LD%']), n(b['OFFB%']), n(b['IFFB%']));
      counts.bat++;
    }

    for (const fl of (S.fld || [])) {
      st.fld.run(season, farm, id, s(fl.POS),
        n(fl.Inn), n(fl.TZR), n(fl.RngR), n(fl.DPR), n(fl.ARM), n(fl.ErrR),
        n(fl['Positional Adjustment'] ?? fl.Pos ?? fl.PosAdj), n(fl.Framing), n(fl.Blocking));
      counts.fld++;
    }

    for (const role of ['total', 'sp', 'rp']) {
      const p = S.pit?.[role];
      if (!p || !Object.keys(p).length) continue;
      st.pit.run(season, farm, id, role,
        n(p.WAR), n(p.IP), n(p.TBF), n(p.RSAA), n(p['K-BB%']), n(p['K%']), n(p['BB%']), n(p.DER),
        n(p['GB%']), n(p['LD%']), n(p['OFFB%']), n(p['IFFB%']), n(p['HR/FB%']), n(p.gmLI),
        n(p.FIP), n(p.xFIP), n(p.tRA), n(p.kwERA), n(p.SIERA),
        n(p['FIP-']), n(p['xFIP-']), n(p['tRA-']), n(p['kwERA-']), n(p['SIERA-']));
      counts.pit++;
    }

    for (const v of (S.pv || [])) {
      st.pv.run(season, farm, id, s(v.Type),
        n(v.Grade), n(v.Pitches), n(v['Pitch%']), n(v['Velo.']), n(v.xPV), n(v['xPV/100']),
        n(v['SwStr%']), n(v['Whiff%']), n(v['GB%']), n(v['LD%']), n(v['OFFB%']), n(v['IFFB%']),
        n(v.xwOBAcon), n(v.wOBAcon), n(v['CSW%']), n(v['Putaway%']));
      counts.pv++;
    }

    const pd = S.pd;
    if (pd && typeof pd === 'object') {
      for (const [zone, z] of Object.entries(pd)) {
        if (!z || typeof z !== 'object') continue;
        st.pd.run(season, farm, id, zone,
          n(z.Pitches), n(z['Pitch%']), n(z.Overall), n(z.Swing), n(z.Take),
          n(z['Swing%']), n(z['Contact%']), n(z.wOBAcon));
        counts.pd++;
      }
    }
  }
}
db.exec('COMMIT');

// 移籍選手はBasement側でも球団ごとに行が分かれる（例: 野村大樹2024はソ/西で2行）。
// 査定は選手×シーズン×軍で行うため、集約ビューを正とする。
// 累積量（WAR・UBR・wSB・守備指標）は合算、率は打席/イニングで加重平均する。
db.exec(`
DROP VIEW IF EXISTS v_bm_player;
DROP VIEW IF EXISTS v_bm_bat;
DROP VIEW IF EXISTS v_bm_pit;

CREATE VIEW v_bm_player AS
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY season, farm, player_id ORDER BY ABS(COALESCE(war,0)) DESC) rn
  FROM bm_player
)
SELECT season, farm, player_id,
  MAX(CASE WHEN rn=1 THEN team END) team,
  MAX(name_ja) name_ja, MAX(name_en) name_en, MAX(name_sponavi) name_sponavi,
  SUM(war) war, SUM(bat_war) bat_war, SUM(run_war) run_war, SUM(fld_war) fld_war, SUM(pit_war) pit_war,
  SUM(ubr) ubr, SUM(wsb) wsb, SUM(dpar) dpar,
  SUM(def_inn) def_inn, SUM(tzr) tzr, SUM(rngr) rngr, SUM(dpr) dpr, SUM(arm) arm, SUM(errr) errr, SUM(pos_adj) pos_adj,
  COUNT(*) src_rows
FROM ranked GROUP BY season, farm, player_id;

CREATE VIEW v_bm_bat AS
SELECT season, farm, player_id, SUM(pa) pa,
  SUM(wraa) wraa,
  SUM(wrc_plus*pa)/NULLIF(SUM(pa),0) wrc_plus,
  SUM(ops*pa)/NULLIF(SUM(pa),0) ops,
  SUM(obp*pa)/NULLIF(SUM(pa),0) obp,
  SUM(slg*pa)/NULLIF(SUM(pa),0) slg,
  SUM(woba*pa)/NULLIF(SUM(pa),0) woba,
  SUM(iso*pa)/NULLIF(SUM(pa),0) iso,
  SUM(k_pct*pa)/NULLIF(SUM(pa),0) k_pct,
  SUM(bb_pct*pa)/NULLIF(SUM(pa),0) bb_pct,
  SUM(babip*pa)/NULLIF(SUM(pa),0) babip,
  SUM(hr_fb_pct*pa)/NULLIF(SUM(pa),0) hr_fb_pct,
  SUM(gb_pct*pa)/NULLIF(SUM(pa),0) gb_pct,
  SUM(ld_pct*pa)/NULLIF(SUM(pa),0) ld_pct,
  SUM(offb_pct*pa)/NULLIF(SUM(pa),0) offb_pct,
  SUM(iffb_pct*pa)/NULLIF(SUM(pa),0) iffb_pct,
  COUNT(*) src_rows
FROM bm_bat GROUP BY season, farm, player_id;

CREATE VIEW v_bm_pit AS
SELECT season, farm, player_id, role, SUM(ip) ip, SUM(tbf) tbf,
  SUM(war) war, SUM(rsaa) rsaa,
  SUM(k_pct*tbf)/NULLIF(SUM(tbf),0) k_pct,
  SUM(bb_pct*tbf)/NULLIF(SUM(tbf),0) bb_pct,
  SUM(fip*ip)/NULLIF(SUM(ip),0) fip,
  SUM(xfip*ip)/NULLIF(SUM(ip),0) xfip,
  SUM(siera*ip)/NULLIF(SUM(ip),0) siera,
  SUM(gb_pct*tbf)/NULLIF(SUM(tbf),0) gb_pct,
  SUM(ld_pct*tbf)/NULLIF(SUM(tbf),0) ld_pct,
  SUM(offb_pct*tbf)/NULLIF(SUM(tbf),0) offb_pct,
  SUM(iffb_pct*tbf)/NULLIF(SUM(tbf),0) iffb_pct,
  SUM(hr_fb_pct*tbf)/NULLIF(SUM(tbf),0) hr_fb_pct,
  SUM(der*tbf)/NULLIF(SUM(tbf),0) der,
  COUNT(*) src_rows
FROM bm_pit GROUP BY season, farm, player_id, role;
`);

const seasons = db.prepare('SELECT MIN(season) a, MAX(season) b FROM v_bm_player').get();
const players = db.prepare('SELECT COUNT(DISTINCT player_id) n FROM v_bm_player').get();
console.log(JSON.stringify({ files: files.length, rows: counts, seasons, distinctPlayers: players.n }, null, 2));
db.close();

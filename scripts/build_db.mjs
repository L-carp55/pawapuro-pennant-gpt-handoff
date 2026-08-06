// data/raw/*.csv → SQLite (data/pennant.db)
// 原則: 欠損は0にせずnull。派生値は生データを上書きしない。
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
const DB_PATH = path.join(ROOT, 'data', 'pennant.db');

// --- CSV parse (引用符対応) ---
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1);
}

// 欠損を0にしない: 空文字はnull
const num = v => (v === '' || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
// 2025年以降のCSVは名前列がHTMLリンク（<a href=...>名前</a>）で入るためタグを剥がす
const stripHtml = v => String(v).replace(/<[^>]*>/g, '').trim();
const str = v => {
  if (v === '' || v == null) return null;
  const t = stripHtml(v);
  return t === '' ? null : t;
};

// 投球回 "46.2" = 46回2/3 → アウト数へ（NPB表記の特殊処理）
function ipToOuts(v) {
  if (v === '' || v == null) return null;
  const s = String(v);
  const m = s.match(/^(\d+)(?:\.(\d))?$/);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] ? Number(m[2]) : 0;
  if (frac > 2) return null; // .3以上はNPB表記としてありえない
  return whole * 3 + frac;
}

const SCHEMA = `
DROP TABLE IF EXISTS batting;
DROP TABLE IF EXISTS pitching;
DROP TABLE IF EXISTS fielding;

CREATE TABLE batting (
  season INTEGER, game_type TEXT, team TEXT, uniform_no TEXT, name TEXT, position TEXT,
  g INTEGER, pa INTEGER, ab INTEGER,
  avg REAL, obp REAL, slg REAL, ops REAL,
  r INTEGER, rbi INTEGER, h INTEGER, b1 INTEGER, b2 INTEGER, b3 INTEGER, hr INTEGER, tb INTEGER,
  sb INTEGER, cs INTEGER, bb INTEGER, ibb INTEGER, so INTEGER, gdp INTEGER, hbp INTEGER,
  sh INTEGER, sf INTEGER, player_id TEXT
);
CREATE TABLE pitching (
  season INTEGER, game_type TEXT, team TEXT, uniform_no TEXT, name TEXT,
  w INTEGER, l INTEGER, sv INTEGER, hld INTEGER, hp INTEGER, apps INTEGER,
  ip_text TEXT, outs INTEGER,
  win_pct REAL, era REAL, whip REAL, r9 REAL, rg REAL, h9 REAL, hr9 REAL, k9 REAL, bb9 REAL, kbb REAL,
  bf INTEGER, h INTEGER, r INTEGER, er INTEGER, hr INTEGER, so INTEGER, bb INTEGER, ibb INTEGER, hbp INTEGER,
  wp INTEGER, bk INTEGER, cg INTEGER, sho INTEGER, nbb INTEGER, gs INTEGER, gf INTEGER, player_id TEXT
);
CREATE TABLE fielding (
  season INTEGER, game_type TEXT, team TEXT, uniform_no TEXT, name TEXT, position TEXT,
  g INTEGER, fpct REAL, po INTEGER, a INTEGER, e INTEGER, dp INTEGER, pb INTEGER, player_id TEXT
);
CREATE INDEX idx_bat_pid ON batting(player_id, season);
CREATE INDEX idx_pit_pid ON pitching(player_id, season);
CREATE INDEX idx_fld_pid ON fielding(player_id, season);
`;

// シーズン途中の移籍で同一選手が球団ごとに複数行になる（年3-13人）。
// 査定は選手×シーズンで行うため、公式戦のみを合算したビューを正とする。
// 球団・名前・守備位置は最も打席/投球回の多い行のものを採る。
const VIEWS = `
DROP VIEW IF EXISTS v_batting;
DROP VIEW IF EXISTS v_pitching;
DROP VIEW IF EXISTS v_fielding;

CREATE VIEW v_batting AS
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY season, player_id ORDER BY pa DESC) rn
  FROM batting WHERE game_type='公式戦'
)
SELECT season, player_id,
  MAX(CASE WHEN rn=1 THEN team END) team,
  MAX(CASE WHEN rn=1 THEN name END) name,
  MAX(CASE WHEN rn=1 THEN position END) position,
  SUM(g) g, SUM(pa) pa, SUM(ab) ab, SUM(r) r, SUM(rbi) rbi, SUM(h) h,
  SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr, SUM(tb) tb,
  SUM(sb) sb, SUM(cs) cs, SUM(bb) bb, SUM(ibb) ibb, SUM(so) so,
  SUM(gdp) gdp, SUM(hbp) hbp, SUM(sh) sh, SUM(sf) sf,
  COUNT(*) src_rows
FROM ranked GROUP BY season, player_id;

CREATE VIEW v_pitching AS
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY season, player_id ORDER BY outs DESC) rn
  FROM pitching WHERE game_type='公式戦'
)
SELECT season, player_id,
  MAX(CASE WHEN rn=1 THEN team END) team,
  MAX(CASE WHEN rn=1 THEN name END) name,
  SUM(w) w, SUM(l) l, SUM(sv) sv, SUM(hld) hld, SUM(apps) apps,
  SUM(outs) outs, SUM(bf) bf, SUM(h) h, SUM(r) r, SUM(er) er, SUM(hr) hr,
  SUM(so) so, SUM(bb) bb, SUM(ibb) ibb, SUM(hbp) hbp, SUM(wp) wp,
  SUM(cg) cg, SUM(sho) sho, SUM(gs) gs, SUM(gf) gf,
  COUNT(*) src_rows
FROM ranked GROUP BY season, player_id;

CREATE VIEW v_fielding AS
SELECT season, player_id, position,
  MAX(team) team, MAX(name) name,
  SUM(g) g, SUM(po) po, SUM(a) a, SUM(e) e, SUM(dp) dp, SUM(pb) pb,
  CASE WHEN SUM(po)+SUM(a)+SUM(e) > 0
       THEN CAST(SUM(po)+SUM(a) AS REAL)/(SUM(po)+SUM(a)+SUM(e)) END fpct,
  COUNT(*) src_rows
FROM fielding WHERE game_type='公式戦'
GROUP BY season, player_id, position;
`;

await mkdir(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(SCHEMA);

const files = (await readdir(RAW)).filter(f => f.endsWith('.csv'));
const counts = { batting: 0, pitching: 0, fielding: 0 };
const gameTypes = new Set();

const stmts = {
  batting: db.prepare(`INSERT INTO batting VALUES (${Array(31).fill('?').join(',')})`),
  pitching: db.prepare(`INSERT INTO pitching VALUES (${Array(40).fill('?').join(',')})`),
  fielding: db.prepare(`INSERT INTO fielding VALUES (${Array(14).fill('?').join(',')})`),
};

db.exec('BEGIN');
for (const f of files.sort()) {
  const kind = f.split('_')[0];
  const rows = parseCsv(await readFile(path.join(RAW, f), 'utf8'));
  const body = rows.slice(1); // ヘッダ除去
  for (const c of body) {
    gameTypes.add(c[1]);
    if (kind === 'batting') {
      stmts.batting.run(num(c[0]), str(c[1]), str(c[2]), str(c[3]), str(c[4]), str(c[5]),
        num(c[6]), num(c[7]), num(c[8]), num(c[9]), num(c[10]), num(c[11]), num(c[12]),
        num(c[13]), num(c[14]), num(c[15]), num(c[16]), num(c[17]), num(c[18]), num(c[19]), num(c[20]),
        num(c[21]), num(c[22]), num(c[23]), num(c[24]), num(c[25]), num(c[26]), num(c[27]),
        num(c[28]), num(c[29]), str(c[30]));
      counts.batting++;
    } else if (kind === 'pitching') {
      stmts.pitching.run(num(c[0]), str(c[1]), str(c[2]), str(c[3]), str(c[4]),
        num(c[5]), num(c[6]), num(c[7]), num(c[8]), num(c[9]), num(c[10]),
        str(c[11]), ipToOuts(c[11]),
        num(c[12]), num(c[13]), num(c[14]), num(c[15]), num(c[16]), num(c[17]), num(c[18]), num(c[19]), num(c[20]), num(c[21]),
        num(c[22]), num(c[23]), num(c[24]), num(c[25]), num(c[26]), num(c[27]), num(c[28]), num(c[29]), num(c[30]),
        num(c[31]), num(c[32]), num(c[33]), num(c[34]), num(c[35]), num(c[36]), num(c[37]), str(c[38]));
      counts.pitching++;
    } else if (kind === 'fielding') {
      stmts.fielding.run(num(c[0]), str(c[1]), str(c[2]), str(c[3]), str(c[4]), str(c[5]),
        num(c[6]), num(c[7]), num(c[8]), num(c[9]), num(c[10]), num(c[11]), num(c[12]), str(c[13]));
      counts.fielding++;
    }
  }
}
db.exec('COMMIT');

db.exec(VIEWS);

const seasons = db.prepare('SELECT MIN(season) a, MAX(season) b FROM batting').get();
const players = db.prepare('SELECT COUNT(DISTINCT player_id) n FROM batting').get();
const merged = db.prepare('SELECT COUNT(*) n FROM v_batting WHERE src_rows > 1').get();
console.log(JSON.stringify({
  files: files.length, rows: counts,
  gameTypes: [...gameTypes],
  seasons, distinctBatters: players.n,
  viewRows: {
    batting: db.prepare('SELECT COUNT(*) n FROM v_batting').get().n,
    pitching: db.prepare('SELECT COUNT(*) n FROM v_pitching').get().n,
    fielding: db.prepare('SELECT COUNT(*) n FROM v_fielding').get().n,
  },
  mergedTradedPlayers: merged.n,
  db: DB_PATH,
}, null, 2));
db.close();

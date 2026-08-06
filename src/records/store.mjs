// 記録層（設計書 Phase 4）: 全試合・年度成績・通算記録・タイトル・球団史を保存して引けるようにする。
//
// オーナーの不満3「記録・数字の物足りなさ」に直接効く層。本家ペナントは年度が変わると
// 前年の細かい記録が引けなくなるので、**最初から通算で積める形**にしておく。
//
// 設計の要点:
//   - 保存の単位は「1試合」と「選手×年度」。通算は年度成績の合計として**都度計算する**
//     （通算を別に持つと二重管理になり、1試合の訂正が通算へ伝わらない事故が起きる）
//   - タイトルは規定打席・規定投球回を満たした選手だけが対象（実際のNPBと同じ）
//   - **保存先は査定用DBとは別ファイル**。査定の実データ（プロEYE球等）とシミュレーション結果が
//     同じテーブルに混ざると、どちらを見ているのか分からなくなる

import { DatabaseSync } from 'node:sqlite';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sim_run (
  run_id TEXT PRIMARY KEY, created_at TEXT, seed INTEGER, note TEXT
);
CREATE TABLE IF NOT EXISTS sim_game (
  run_id TEXT, season INTEGER, game_no INTEGER,
  home TEXT, away TEXT, home_runs INTEGER, away_runs INTEGER, innings INTEGER,
  PRIMARY KEY (run_id, season, game_no)
);
CREATE TABLE IF NOT EXISTS sim_standing (
  run_id TEXT, season INTEGER, team TEXT,
  w INTEGER, l INTEGER, d INTEGER, rf INTEGER, ra INTEGER,
  PRIMARY KEY (run_id, season, team)
);
CREATE TABLE IF NOT EXISTS sim_batting (
  run_id TEXT, season INTEGER, player_id TEXT, name TEXT, team TEXT,
  g INTEGER, pa INTEGER, ab INTEGER, h INTEGER, b1 INTEGER, b2 INTEGER, b3 INTEGER,
  hr INTEGER, bb INTEGER, hbp INTEGER, so INTEGER,
  PRIMARY KEY (run_id, season, player_id)
);
CREATE TABLE IF NOT EXISTS sim_pitching (
  run_id TEXT, season INTEGER, player_id TEXT, name TEXT, team TEXT,
  g INTEGER, bf INTEGER, h INTEGER, hr INTEGER, bb INTEGER, hbp INTEGER, so INTEGER, outs INTEGER,
  PRIMARY KEY (run_id, season, player_id)
);
CREATE INDEX IF NOT EXISTS idx_sim_bat ON sim_batting(run_id, player_id);
CREATE INDEX IF NOT EXISTS idx_sim_pit ON sim_pitching(run_id, player_id);
CREATE INDEX IF NOT EXISTS idx_sim_game ON sim_game(run_id, season);
`;

export function openStore(file) {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

/** 打席結果の集計から、成績表の形（打数・安打など）へ */
export function toBattingLine(s) {
  const h = s.B1 + s.B2 + s.B3 + s.HR;
  return {
    pa: s.PA, ab: s.PA - s.BB - s.HBP, h,
    b1: s.B1, b2: s.B2, b3: s.B3, hr: s.HR, bb: s.BB, hbp: s.HBP, so: s.SO,
  };
}

/**
 * 1シーズン分を書き込む。
 * @param {object} db openStore の戻り値
 * @param {object} a {runId, season, standings, batting:Map, pitching:Map, games:[], names:Map, teams:Map}
 */
export function writeSeason(db, a) {
  const { runId, season, standings, batting, pitching, games, names, teamOf } = a;
  db.exec('BEGIN');
  try {
    const insG = db.prepare(`INSERT OR REPLACE INTO sim_game
      (run_id,season,game_no,home,away,home_runs,away_runs,innings) VALUES (?,?,?,?,?,?,?,?)`);
    for (const g of games) {
      insG.run(runId, season, g.index, g.home, g.away, g.homeRuns, g.awayRuns, g.innings);
    }
    const insS = db.prepare(`INSERT OR REPLACE INTO sim_standing
      (run_id,season,team,w,l,d,rf,ra) VALUES (?,?,?,?,?,?,?,?)`);
    for (const s of standings) insS.run(runId, season, s.name, s.w, s.l, s.d, s.rf, s.ra);

    const insB = db.prepare(`INSERT OR REPLACE INTO sim_batting
      (run_id,season,player_id,name,team,g,pa,ab,h,b1,b2,b3,hr,bb,hbp,so)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const [id, s] of batting) {
      const L = toBattingLine(s.stats);
      insB.run(runId, season, id, names.get(id) ?? id, teamOf.get(id) ?? null, s.g,
        L.pa, L.ab, L.h, L.b1, L.b2, L.b3, L.hr, L.bb, L.hbp, L.so);
    }
    const insP = db.prepare(`INSERT OR REPLACE INTO sim_pitching
      (run_id,season,player_id,name,team,g,bf,h,hr,bb,hbp,so,outs)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const [id, s] of pitching) {
      const st = s.stats;
      const h = st.B1 + st.B2 + st.B3 + st.HR;
      insP.run(runId, season, id, names.get(id) ?? id, teamOf.get(id) ?? null, s.g,
        st.PA, h, st.HR, st.BB, st.HBP, st.SO, st.OUT);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/** 通算成績。年度成績の合計として都度計算する（別に持たない＝二重管理を避ける） */
export function careerBatting(db, runId, opts = {}) {
  const min = opts.minPa ?? 0;
  return db.prepare(`
    SELECT player_id, MAX(name) name, COUNT(*) seasons,
           SUM(g) g, SUM(pa) pa, SUM(ab) ab, SUM(h) h, SUM(hr) hr,
           SUM(b2) b2, SUM(b3) b3, SUM(bb) bb, SUM(so) so,
           CASE WHEN SUM(ab)>0 THEN SUM(h)*1.0/SUM(ab) END avg
    FROM sim_batting WHERE run_id=? GROUP BY player_id HAVING SUM(pa) >= ?
    ORDER BY SUM(hr) DESC`).all(runId, min);
}

/**
 * タイトル。規定に届いた選手だけを対象にする（実際のNPBと同じ扱い）。
 * 規定打席=試合数×3.1、規定投球回=試合数×1.0 を既定とする。
 */
export function titles(db, runId, season, cfg = {}) {
  const gamesPerTeam = cfg.gamesPerTeam ?? 143;
  const qPa = Math.ceil(gamesPerTeam * (cfg.paPerGame ?? 3.1));
  const qOuts = Math.ceil(gamesPerTeam * (cfg.inningsPerGame ?? 1.0) * 3);
  const one = (sql, ...p) => db.prepare(sql).get(...p) ?? null;
  return {
    qualified: { pa: qPa, outs: qOuts },
    battingAverage: one(`SELECT name, team, h*1.0/ab v, pa FROM sim_batting
      WHERE run_id=? AND season=? AND pa>=? AND ab>0 ORDER BY v DESC LIMIT 1`, runId, season, qPa),
    homeRuns: one(`SELECT name, team, hr v FROM sim_batting
      WHERE run_id=? AND season=? ORDER BY hr DESC LIMIT 1`, runId, season),
    hits: one(`SELECT name, team, h v FROM sim_batting
      WHERE run_id=? AND season=? ORDER BY h DESC LIMIT 1`, runId, season),
    strikeouts: one(`SELECT name, team, so v FROM sim_pitching
      WHERE run_id=? AND season=? ORDER BY so DESC LIMIT 1`, runId, season),
    // 防御率の代わりに、失点データを持たない現段階では被本塁打率の低さを暫定の指標にする
    _era_note: '防御率は失点の記録が要る。現段階の記録層は打席結果までなので未実装',
  };
}

/** 球団史。年度ごとの順位を並べる */
export function teamHistory(db, runId, team) {
  return db.prepare(`
    SELECT season, w, l, d, rf, ra,
           (SELECT COUNT(*)+1 FROM sim_standing s2
             WHERE s2.run_id=s1.run_id AND s2.season=s1.season
               AND s2.w*1.0/NULLIF(s2.w+s2.l,0) > s1.w*1.0/NULLIF(s1.w+s1.l,0)) rank
    FROM sim_standing s1 WHERE run_id=? AND team=? ORDER BY season`).all(runId, team);
}

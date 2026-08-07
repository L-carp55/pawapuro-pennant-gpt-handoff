// ピーク年度候補へ渡す、選手本人の年度別走塁・守備得点をDBから取得する。
//
// 走塁: NPB Basement UBR（runs単位）
// 守備: season_defense_runs.mjs の位置別run成分を年内全位置で合算
//
// 2019年以前はNPB Basementが無いためnullのまま。0で埋めない。

import { fieldingRunsForSeason } from './season_defense_runs.mjs';

/**
 * @returns {Map<number,{runRuns:number|null,fldRuns:number|null,fieldingDetail:object|null}>}
 */
export function loadSeasonRunFieldContributions(db, playerId) {
  const runRows = db.prepare(`
    SELECT season, MAX(ubr) ubr
    FROM v_bm_by_player
    WHERE proeye_id=? AND farm=0
    GROUP BY season
  `).all(playerId);
  const runBySeason = new Map(runRows.map(r => [r.season, Number.isFinite(r.ubr) ? r.ubr : null]));

  const fldRows = db.prepare(`
    SELECT f.season,f.pos,f.inn,f.rngr,f.errr,f.arm,f.dpr,f.framing,f.blocking
    FROM bm_fld f
    JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
    WHERE l.proeye_id=? AND f.farm=0 AND f.inn>0
    ORDER BY f.season,f.pos
  `).all(playerId);
  const fldBySeason = new Map();
  for (const r of fldRows) {
    if (!fldBySeason.has(r.season)) fldBySeason.set(r.season, []);
    fldBySeason.get(r.season).push(r);
  }

  const years = new Set([...runBySeason.keys(), ...fldBySeason.keys()]);
  const out = new Map();
  for (const season of years) {
    const detail = fieldingRunsForSeason(fldBySeason.get(season) ?? []);
    out.set(season, {
      runRuns: runBySeason.get(season) ?? null,
      fldRuns: detail?.runs ?? null,
      fieldingDetail: detail,
    });
  }
  return out;
}

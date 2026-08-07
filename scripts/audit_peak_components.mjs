// 総合ピーク再開前の年度別走塁・守備得点の被覆監査。
// DBは変更しない。
//
// 調べること:
// 1) PA>=200の選手年にUBRと守備得点がどれだけ存在するか
// 2) 守備得点を RngR+ErrR+ARM+DPR として年内全守備位置で合算できるか
// 3) 既存の未較正 POSITION_ADJUSTMENT が年度選定へどの程度影響するか

import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leagueRates, battingRuns, POSITION_ADJUSTMENT } from '../src/cards/season_score.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;

// player-seasonごとの走塁・守備を先にSQLで集約し、N+1クエリを避ける。
const all = db.prepare(`
  WITH run AS (
    SELECT proeye_id player_id, season, MAX(ubr) ubr
    FROM v_bm_by_player WHERE farm=0 GROUP BY proeye_id,season
  ), fld AS (
    SELECT l.proeye_id player_id, f.season,
      COUNT(*) fld_rows,
      MIN(CASE WHEN f.rngr IS NOT NULL AND f.errr IS NOT NULL AND f.arm IS NOT NULL AND f.dpr IS NOT NULL
        THEN 1 ELSE 0 END) fld_complete,
      SUM(CASE WHEN f.rngr IS NOT NULL AND f.errr IS NOT NULL AND f.arm IS NOT NULL AND f.dpr IS NOT NULL
        THEN f.rngr+f.errr+f.arm+f.dpr ELSE 0 END) fld_runs
    FROM bm_fld f
    JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
    WHERE f.farm=0 AND f.inn>0
    GROUP BY l.proeye_id,f.season
  )
  SELECT b.player_id,b.name,b.season,b.position,b.pa,b.ab,b.h,b.b2,b.b3,b.hr,b.bb,b.hbp,b.sb,b.cs,b.sh,b.sf,
    run.ubr, fld.fld_rows, fld.fld_complete, fld.fld_runs
  FROM v_batting b
  LEFT JOIN run ON run.player_id=b.player_id AND run.season=b.season
  LEFT JOIN fld ON fld.player_id=b.player_id AND fld.season=b.season
  WHERE b.position<>'投' AND b.pa>=200
  ORDER BY b.season,b.player_id
`).all();

const lgRows = db.prepare(`SELECT season,SUM(pa) pa,SUM(ab) ab,SUM(h) h,SUM(b2) b2,SUM(b3) b3,SUM(hr) hr,
  SUM(bb) bb,SUM(hbp) hbp,SUM(sb) sb,SUM(cs) cs,SUM(sh) sh,SUM(sf) sf
  FROM v_batting GROUP BY season`).all();
const lgMap = new Map(lgRows.map(x=>[x.season,leagueRates(x)]));

const records = all.map(b => {
  const line = { PA:b.pa, AB:b.ab, H:b.h, B2:b.b2, B3:b.b3, HR:b.hr, BB:b.bb, HBP:b.hbp,
    SB:b.sb, CS:b.cs, SH:b.sh, SF:b.sf };
  const bat = battingRuns(line, lgMap.get(b.season), rv).vsLeague;
  const posRaw = POSITION_ADJUSTMENT.values[b.position] ?? null;
  const posAdj = Number.isFinite(posRaw) ? posRaw * Math.min(1, b.pa / (143 * 3.1)) : 0;
  const fldRuns = b.fld_complete === 1 && b.fld_rows > 0 && Number.isFinite(b.fld_runs) ? b.fld_runs : null;
  return {
    ...b, bat,
    runRuns: Number.isFinite(b.ubr) ? b.ubr : null,
    fldRuns,
    posAdj,
    complete: Number.isFinite(b.ubr) && Number.isFinite(fldRuns),
  };
});

const years = [...new Set(records.map(r=>r.season))];
console.log('# 総合ピーク構成要素の被覆');
console.log('| year | PA>=200 | UBR | field complete | both | both% |');
console.log('|---:|---:|---:|---:|---:|---:|');
for (const y of years) {
  const rs = records.filter(r=>r.season===y);
  const runN = rs.filter(r=>Number.isFinite(r.runRuns)).length;
  const fldN = rs.filter(r=>Number.isFinite(r.fldRuns)).length;
  const both = rs.filter(r=>r.complete).length;
  console.log(`| ${y} | ${rs.length} | ${runN} | ${fldN} | ${both} | ${(100*both/rs.length).toFixed(1)}% |`);
}

const pre2020 = records.filter(r=>r.season<2020);
const post2020 = records.filter(r=>r.season>=2020);
console.log(`\npre2020 complete=${pre2020.filter(r=>r.complete).length}/${pre2020.length}`);
console.log(`2020+ complete=${post2020.filter(r=>r.complete).length}/${post2020.length}`);

const byPlayer = new Map();
for (const r of records.filter(r=>r.complete)) {
  if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
  byPlayer.get(r.player_id).push(r);
}
let eligiblePlayers=0, changed=0;
const examples=[];
for (const rs of byPlayer.values()) {
  if (rs.length < 2) continue;
  eligiblePlayers++;
  const noPos = [...rs].sort((a,b)=>(b.bat+b.runRuns+b.fldRuns)-(a.bat+a.runRuns+a.fldRuns))[0];
  const withPos = [...rs].sort((a,b)=>(b.bat+b.runRuns+b.fldRuns+b.posAdj)-(a.bat+a.runRuns+a.fldRuns+a.posAdj))[0];
  if (noPos.season !== withPos.season) {
    changed++;
    examples.push({name:noPos.name,noPos:noPos.season,withPos:withPos.season,
      noPosPA:noPos.pa,withPosPA:withPos.pa,noPosPos:noPos.position,withPosPos:withPos.position});
  }
}
console.log(`\n複数のcomplete seasonを持つ選手=${eligiblePlayers}`);
console.log(`未較正position adjustmentの有無でピーク年が変わる=${changed} (${eligiblePlayers? (100*changed/eligiblePlayers).toFixed(1):'0'}%)`);
console.log('\n## 変化例');
for (const e of examples.slice(0,40)) {
  console.log(`${e.name}\tnoPos=${e.noPos}(${e.noPosPos},PA${e.noPosPA})\twithPos=${e.withPos}(${e.withPosPos},PA${e.withPosPA})`);
}

const complete=records.filter(r=>r.complete);
const absMean = key => complete.length ? complete.reduce((s,r)=>s+Math.abs(r[key]),0)/complete.length : 0;
console.log('\n## complete player-seasonでの絶対値平均（点）');
console.log(`batting=${absMean('bat').toFixed(2)} run=${absMean('runRuns').toFixed(2)} field=${absMean('fldRuns').toFixed(2)} posAdj=${absMean('posAdj').toFixed(2)}`);

db.close();

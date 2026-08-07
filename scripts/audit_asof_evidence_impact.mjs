// as-of cutoff が2024カードに与える実害/修正量を監査する。
// DBは変更しない。主に (a) 本人の未来一軍成績をPriorへ入れていた人数、
// (b) 後年まで集約した送球証拠が2024カードへ入っていた人数を数える。

import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectPrior } from '../src/ratings/shrinkage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const YEAR = 2024;
const REF = cfg.environment.reference_season;

const lgStmt = db.prepare(`SELECT SUM(ab) ab,SUM(h) h,SUM(hr) hr FROM v_batting WHERE season=?`);
const ref = lgStmt.get(REF);
const refAvg = ref.h / ref.ab, refHr = ref.hr / ref.ab;
const env = season => {
  const x = lgStmt.get(season);
  if (!x?.ab) return null;
  return {
    avg: Math.pow(refAvg / (x.h / x.ab), cfg.environment.gamma_avg),
    hr: Math.pow(refHr / (x.hr / x.ab), cfg.environment.gamma_hr),
  };
};
const league = { avg: refAvg, hr: refHr };

const players = db.prepare(`
  SELECT player_id,name,ab,h,hr,pa FROM v_batting
  WHERE season=? AND position<>'投' AND ab>=30
`).all(YEAR);

const priorRows = [];
for (const p of players) {
  const hs = db.prepare(`SELECT season,ab,h,hr FROM v_batting
    WHERE player_id=? AND season BETWEEN ? AND ? AND ab>0 AND position<>'投'`)
    .all(p.player_id, YEAR - 3, YEAR + 3)
    .map(h => {
      const f = env(h.season);
      return f ? { season: h.season, ab: h.ab, isFarm: false,
        avgEnv: (h.h / h.ab) * f.avg, hrEnv: (h.hr / h.ab) * f.hr } : null;
    }).filter(Boolean);
  const oldPrior = selectPrior({ season: YEAR, ab: p.ab }, hs, league, cfg.shrinkage);
  const newPrior = selectPrior({ season: YEAR, ab: p.ab }, hs.filter(h => h.season <= YEAR), league, cfg.shrinkage);
  const future = hs.filter(h => h.season > YEAR);
  if (!future.length) continue;
  priorRows.push({
    name: p.name, ab: p.ab, futureYears: future.map(x => x.season),
    oldKind: oldPrior.kind, newKind: newPrior.kind,
    avgDiff: oldPrior.avg - newPrior.avg,
    hrDiff: oldPrior.hr - newPrior.hr,
  });
}

const abs = (a, key) => a.map(x => Math.abs(x[key])).sort((x,y)=>x-y);
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
const q = (xs,p) => xs.length ? xs[Math.min(xs.length-1,Math.floor((xs.length-1)*p))] : 0;
const avgAbs = abs(priorRows,'avgDiff');
const hrAbs = abs(priorRows,'hrDiff');
console.log('# 2024 as-of evidence impact');
console.log(`players_ab30=${players.length}`);
console.log(`players_with_future_first_team_evidence=${priorRows.length}`);
console.log(`prior AVG |diff| mean=${(mean(avgAbs)*1000).toFixed(3)}厘 p90=${(q(avgAbs,.9)*1000).toFixed(3)} max=${(q(avgAbs,1)*1000).toFixed(3)}`);
console.log(`prior HRrate |diff| mean=${(mean(hrAbs)*1000).toFixed(3)}‰ p90=${(q(hrAbs,.9)*1000).toFixed(3)} max=${(q(hrAbs,1)*1000).toFixed(3)}`);
console.log(`prior kind changed=${priorRows.filter(x=>x.oldKind!==x.newKind).length}`);
console.log('\n## prior差が大きい選手');
for (const r of [...priorRows].sort((a,b)=>Math.abs(b.avgDiff)-Math.abs(a.avgDiff)).slice(0,25)) {
  console.log(`${r.name}\tAB=${r.ab}\tfuture=${r.futureYears.join(',')}\t${r.oldKind}->${r.newKind}\tAVG Δ=${(r.avgDiff*1000).toFixed(2)}厘\tHRrate Δ=${(r.hrDiff*1000).toFixed(2)}‰`);
}

// TE送球: record.seasons末年が2024を超えるのに能力が付いている本人レコードを数える。
const te = JSON.parse(await readFile(path.join(ROOT,'outputs','derived','throw_accuracy_from_te.json'),'utf8'));
const teAbility = (te.judged ?? []).filter(x => x.ability);
const teFuture = teAbility.filter(x => Array.isArray(x.seasons) && Math.max(...x.seasons) > YEAR);
console.log(`\nTE送球 能力判定レコード=${teAbility.length}; 2024より後を含む=${teFuture.length}`);
for (const r of teFuture.slice(0,20)) console.log(`  ${r.name}/${r.pos}: ${r.ability} seasons=${r.seasons?.join('-')}`);

// 年別内訳を失った集約値はすべてmaxEvidenceSeason=2026なので2024では0件利用が正しい。
for (const [label,file] of [
  ['catcher_fielding','catcher_fielding_rating.json'],
  ['catcher_throw_accuracy','catcher_throw_accuracy.json'],
  ['infield_throw_accuracy','infield_throw_accuracy.json'],
]) {
  const j = JSON.parse(await readFile(path.join(ROOT,'outputs','derived',file),'utf8'));
  const n = Array.isArray(j.players) ? j.players.length : Array.isArray(j.judged) ? j.judged.filter(x=>x.ability).length : 0;
  console.log(`${label}: aggregate_records_or_judged=${n}; 2024 usable=0 (source max season 2026)`);
}

db.close();

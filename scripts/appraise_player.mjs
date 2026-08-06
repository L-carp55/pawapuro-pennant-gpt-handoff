// 1選手の完全な査定レポートを出す（Sol仕様 02 §15「途中式を省略しない」）。
// 使い方: node scripts/appraise_player.mjs 村上 2024
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitLogDist } from '../src/ratings/scale.mjs';
import { appraiseBatting } from '../src/ratings/from_rates.mjs';
import { selectPrior } from '../src/ratings/shrinkage.mjs';
import { speedComponents, speedRating, stealingAbility, baserunningAbility } from '../src/ratings/running.mjs';
import { appraiseAllPositions } from '../src/ratings/fielding.mjs';
import { buildMeetLedger, strikeoutAbility } from '../src/ratings/special_abilities.mjs';
import { renderPlayerReport } from '../src/ratings/report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = process.argv[2] ?? '村上';
const SEASON = Number(process.argv[3] || 2024);

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lgOf = s => {
  const r = db.prepare(`SELECT SUM(h) h,SUM(ab) ab,SUM(hr) hr FROM v_batting WHERE season=?`).get(s);
  return r?.ab ? { avg: r.h / r.ab, hr: r.hr / r.ab } : null;
};
const REF = lgOf(cfg.environment.reference_season);
const L = lgOf(SEASON);
const env = { lgAvg: L.avg, lgHrRate: L.hr, refAvg: REF.avg, refHrRate: REF.hr };
const envAvg = s => Math.pow(REF.avg / lgOf(s).avg, cfg.environment.gamma_avg);
const envHr = s => Math.pow(REF.hr / lgOf(s).hr, cfg.environment.gamma_hr);

const p = db.prepare(`
  SELECT * FROM v_batting WHERE season=? AND name LIKE ? AND position <> '投' ORDER BY pa DESC LIMIT 1`)
  .get(SEASON, `%${NAME}%`);
if (!p) { console.error(`該当なし: ${NAME} (${SEASON})`); process.exit(1); }

// 能力値スケールの基準分布
const pool = db.prepare(`SELECT so,bb,pa FROM v_batting WHERE season=? AND pa>=200 AND position<>'投'`).all(SEASON);
const dists = { contact: fitLogDist(pool.map(r => r.so / r.pa)), eye: fitLogDist(pool.map(r => r.bb / r.pa)) };

// 履歴からPriorを選ぶ
const hist = db.prepare(`
  SELECT season, ab, h, hr FROM v_batting WHERE player_id=? AND season BETWEEN ? AND ? AND ab>0`)
  .all(p.player_id, SEASON - 3, SEASON + 3)
  .filter(h => lgOf(h.season))
  .map(h => ({ season: h.season, ab: h.ab, isFarm: false, avgEnv: (h.h / h.ab) * envAvg(h.season), hrEnv: (h.hr / h.ab) * envHr(h.season) }));
const prior = selectPrior({ season: SEASON, ab: p.ab }, hist, { avg: REF.avg, hr: REF.hr }, cfg.shrinkage);

const line = { PA: p.pa, AB: p.ab, H: p.h, B2: p.b2, B3: p.b3, HR: p.hr, BB: p.bb, HBP: p.hbp, SO: p.so, SH: p.sh, SF: p.sf, GDP: p.gdp };
const bat = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true, prior });

// 走塁（NPB Basementのデータがある年のみ）
const bm = db.prepare(`
  SELECT b.ubr, b.wsb, m.gb_pct FROM v_bm_by_player b
  LEFT JOIN player_link l ON l.proeye_id=b.proeye_id AND l.season=b.season
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  WHERE b.proeye_id=? AND b.season=? AND b.farm=0`).get(p.player_id, SEASON);
let run = null;
if (bm) {
  const sc = speedComponents(line, { gbPct: bm.gb_pct }, bm.ubr, runNorm);
  run = {
    speed: speedRating(sc.score, cfg),
    stealing: stealingAbility({ SB: p.sb, CS: p.cs, PA: p.pa }, bm.wsb, sc.score, runNorm, cfg),
    baserunning: baserunningAbility(bm.ubr != null ? bm.ubr / p.pa : null, sc.score, runNorm, cfg),
    _z: sc.score,
  };
}

// 守備
const fldRows = db.prepare(`
  SELECT f.pos, f.inn, f.rngr, f.errr, f.arm, f.dpr, f.framing, f.blocking
  FROM bm_fld f JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
  WHERE l.proeye_id=? AND f.season=? AND f.farm=0 AND f.inn>0`).all(p.player_id, SEASON);
const fld = fldRows.length ? appraiseAllPositions(fldRows, run?._z ?? 0, fldNorm, cfg) : [];

// 調整台帳
const ledgers = [buildMeetLedger(bat.meet, { contextTier: 'C', infieldHitAbility: null }, cfg)];

const md = renderPlayerReport(
  { name: p.name.replace(/　/g, ' '), team: p.team, season: SEASON, line, cardType: 'peak_single_year（ピーク単年）' },
  bat, run, fld, ledgers,
  {
    contextTier: 'C',
    sources: ['プロEYE球（基礎成績）', 'NPB Basement（走塁・守備・打球）'],
    estimated: bm ? [] : ['NPB Basementのデータが無い年のため、走塁・守備は未査定'],
    unresolved: [],
  }
);

await mkdir(path.join(ROOT, 'outputs', 'reports'), { recursive: true });
const file = path.join(ROOT, 'outputs', 'reports', `${p.name.replace(/　/g, '')}_${SEASON}.md`);
await writeFile(file, md, 'utf8');
console.log(md);
console.log(`\n→ ${path.relative(ROOT, file)}`);
db.close();

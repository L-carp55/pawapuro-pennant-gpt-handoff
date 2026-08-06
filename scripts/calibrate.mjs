// 副次イベント（併殺・犠飛・犠打・失策出塁・盗塁）の発生率を、実測の年間発生数に合わせて自動調整する。
// 各パラメータは対応する実測値と1対1で結びつくため、比率補正の反復で収束する。
// 「根拠のない係数を置かない」(Sol仕様 08 §5) を、実測へのフィットで満たす。
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../src/engine/rng.mjs';
import { rateVectorFromCounts } from '../src/engine/odds.mjs';
import { playSeason } from '../src/engine/season.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const ITERATIONS = Number(process.argv[3] || 12);
const REPLICATES = 3; // 乱数ブレを均すため複数シーズンの平均で測る

const cfgPath = path.join(ROOT, 'configs', 'engine.json');
const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lg = db.prepare(`
  SELECT SUM(pa) pa, SUM(bb) bb, SUM(hbp) hbp, SUM(so) so,
         SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr,
         SUM(r) r, SUM(sb) sb, SUM(cs) cs, SUM(sh) sh, SUM(sf) sf, SUM(gdp) gdp
  FROM batting WHERE game_type='公式戦' AND season=?`).get(SEASON);
const fld = db.prepare(`SELECT SUM(e) e FROM fielding WHERE game_type='公式戦' AND season=?`).get(SEASON);

const league = rateVectorFromCounts({
  PA: lg.pa, BB: lg.bb, HBP: lg.hbp, SO: lg.so,
  B1: lg.b1, B2: lg.b2, B3: lg.b3, HR: lg.hr,
});

// 実測の年間目標値。失策のうち打者が出塁する分（ROE）はNPB統計で区別されないため、
// MLBの実績比（失策の約75%が打者出塁）を仮定する。この1点だけが推定値であり provisional。
const ROE_SHARE_OF_ERRORS = 0.75;
const targets = {
  gdp_rate: lg.gdp,
  sacfly_rate: lg.sf,
  bunt_rate: lg.sh,
  roe_rate: Math.round(fld.e * ROE_SHARE_OF_ERRORS),
  steal_attempt_rate_2nd: lg.sb + lg.cs,
};
const evKey = { gdp_rate: 'gdp', sacfly_rate: 'sf', bunt_rate: 'sh', roe_rate: 'roe', steal_attempt_rate_2nd: null };

const avg = { rates: league };
function runOnce(seed) {
  const teams = Array.from({ length: cfg.season.teams }, (_, i) => ({
    name: `T${i + 1}`,
    lineup: Array.from({ length: 9 }, (_, j) => ({ ...avg, id: `B${i}_${j}` })),
    starter: { ...avg, id: `P${i}` },
    bullpen: Array.from({ length: 6 }, (_, j) => ({ ...avg, id: `R${i}_${j}` })),
  }));
  return playSeason(teams, league, makeRng(seed), cfg);
}

function measure() {
  const acc = { sb: 0, cs: 0, gdp: 0, sf: 0, sh: 0, roe: 0, runs: 0 };
  for (let r = 0; r < REPLICATES; r++) {
    const res = runOnce(1000 + r * 7919);
    for (const k of ['sb', 'cs', 'gdp', 'sf', 'sh', 'roe']) acc[k] += res.tally[k];
    acc.runs += res.standings.reduce((a, s) => a + s.rf, 0);
  }
  for (const k of Object.keys(acc)) acc[k] /= REPLICATES;
  return acc;
}

console.log(`較正開始 (${SEASON}年 / ${ITERATIONS}反復 × ${REPLICATES}シーズン平均)\n`);
console.log('目標値:', JSON.stringify({ ...targets, 盗塁: lg.sb, 盗塁刺: lg.cs, 得点: lg.r }));

let m = measure();
for (let it = 1; it <= ITERATIONS; it++) {
  let maxErr = 0;
  for (const [param, target] of Object.entries(targets)) {
    const observed = param === 'steal_attempt_rate_2nd' ? (m.sb + m.cs) : m[evKey[param]];
    if (observed <= 0) { cfg.baserunning[param] *= 1.5; continue; }
    const ratio = target / observed;
    // 過補正を防ぐため補正幅を制限する
    const damped = Math.pow(ratio, 0.7);
    cfg.baserunning[param] = Math.min(0.95, Math.max(0.0005, cfg.baserunning[param] * damped));
    maxErr = Math.max(maxErr, Math.abs(ratio - 1));
  }
  // 三盗は二盗に連動させる（単独較正すると企図機会が少なく不安定なため）
  cfg.baserunning.steal_attempt_rate_3rd = cfg.baserunning.steal_attempt_rate_2nd * 0.4;
  m = measure();
  console.log(`  #${String(it).padStart(2)} 併殺${Math.round(m.gdp)} 犠飛${Math.round(m.sf)} 犠打${Math.round(m.sh)} 失策出塁${Math.round(m.roe)} 盗塁企図${Math.round(m.sb + m.cs)} | 得点${Math.round(m.runs)} (目標${lg.r}) 最大誤差${(maxErr * 100).toFixed(1)}%`);
  if (maxErr < 0.02) { console.log('  収束'); break; }
}

await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('\n較正後パラメータ:', JSON.stringify(cfg.baserunning, null, 2));
db.close();

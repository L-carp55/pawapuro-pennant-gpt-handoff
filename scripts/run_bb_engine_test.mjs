// 打球中間層を通したエンジンの検証。
// 直結版と同じ恒等性テスト（全員リーグ平均）を行い、分布が保たれるかを見る。
// さらに「パワーだけ違う打者」を入れて、相互作用がエンジン内でも生じるかを確認する。
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../src/engine/rng.mjs';
import { rateVectorFromCounts } from '../src/engine/odds.mjs';
import { playSeason } from '../src/engine/season.mjs';
import { calibrateToSeason } from '../src/engine/batted_ball.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const SEED = Number(process.argv[3] || 20260731);

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));
const bb = JSON.parse(await readFile(path.join(ROOT, 'outputs', 'derived', 'batted_ball_coefficients.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lgRow = db.prepare(`
  SELECT SUM(pa) pa, SUM(bb) bb, SUM(hbp) hbp, SUM(so) so,
         SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr, SUM(r) r
  FROM v_batting WHERE season=?`).get(SEASON);
const lgRates = rateVectorFromCounts({
  PA: lgRow.pa, BB: lgRow.bb, HBP: lgRow.hbp, SO: lgRow.so,
  B1: lgRow.b1, B2: lgRow.b2, B3: lgRow.b3, HR: lgRow.hr,
});

// リーグ平均の打球構成（実測）
const bbRow = db.prepare(`
  SELECT SUM(gb_pct*pa)/SUM(pa) gb, SUM(ld_pct*pa)/SUM(pa) ld,
         SUM(offb_pct*pa)/SUM(pa) offb, SUM(iffb_pct*pa)/SUM(pa) iffb,
         SUM(hr_fb_pct*pa)/SUM(pa) hrfb
  FROM v_bm_bat WHERE farm=0 AND season=? AND gb_pct IS NOT NULL`).get(SEASON);
const s = bbRow.gb + bbRow.ld + bbRow.offb + bbRow.iffb;
const lgBattedBall = { gb: bbRow.gb / s, ld: bbRow.ld / s, offb: bbRow.offb / s, iffb: bbRow.iffb / s, hrPerFly: bbRow.hrfb / 100 };

// 係数をその年のリーグ実測へ合わせる（本塁打の出やすさは年で1.7倍動くため）
const lgInplay = db.prepare(`SELECT SUM(ab) ab, SUM(so) so FROM v_batting WHERE season=?`).get(SEASON);
const inplayCount = lgInplay.ab - lgInplay.so;
const seasonCoef = calibrateToSeason(bb.coefficients, lgBattedBall, {
  b1: lgRow.b1 / inplayCount, b2: lgRow.b2 / inplayCount,
  b3: lgRow.b3 / inplayCount, hr: lgRow.hr / inplayCount,
});
console.log(`年別較正のスケール: ${Object.entries(seasonCoef._scales).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(' ')}`);

cfg.battedBall = { enabled: true, coefficients: seasonCoef };
const league = { rates: lgRates, battedBall: lgBattedBall };

function makeTeams(batterMods) {
  return Array.from({ length: cfg.season.teams }, (_, i) => ({
    name: `T${i + 1}`,
    lineup: Array.from({ length: 9 }, (_, j) => ({
      id: `B${i}_${j}`, rates: lgRates, battedBall: lgBattedBall, mods: batterMods,
    })),
    starter: { id: `P${i}`, rates: lgRates, battedBall: lgBattedBall },
    bullpen: Array.from({ length: 6 }, (_, j) => ({ id: `R${i}_${j}`, rates: lgRates, battedBall: lgBattedBall })),
  }));
}

function run(mods, seed) {
  const { standings, playerStats, games } = playSeason(makeTeams(mods), league, makeRng(seed), cfg);
  const sim = { PA: 0, BB: 0, HBP: 0, SO: 0, B1: 0, B2: 0, B3: 0, HR: 0, OUT: 0 };
  for (const [id, st] of playerStats) {
    if (id.startsWith('P:')) continue;
    for (const k of Object.keys(sim)) sim[k] += st[k];
  }
  const ab = sim.PA - sim.BB - sim.HBP;
  const h = sim.B1 + sim.B2 + sim.B3 + sim.HR;
  return {
    avg: h / ab, hr: sim.HR / sim.PA, b2: sim.B2 / sim.PA, b3: sim.B3 / sim.PA, so: sim.SO / sim.PA,
    runs: standings.reduce((a, x) => a + x.rf, 0) / (games * 2),
  };
}

console.log(`\n=== 打球中間層を通したエンジンの検証 (${SEASON}年 / seed=${SEED}) ===\n`);
const neutral = run({}, SEED);
const real = {
  avg: (lgRow.b1 + lgRow.b2 + lgRow.b3 + lgRow.hr) / (lgRow.pa - lgRow.bb - lgRow.hbp),
  hr: lgRow.hr / lgRow.pa, b2: lgRow.b2 / lgRow.pa, b3: lgRow.b3 / lgRow.pa, so: lgRow.so / lgRow.pa,
  runs: lgRow.r / (143 * cfg.season.teams),
};
console.log('恒等性（全員リーグ平均・能力調整なし）');
console.log('項目'.padEnd(16) + 'シミュ'.padStart(10) + '実測'.padStart(11) + '乖離'.padStart(9));
for (const [k, label] of [['avg', '打率'], ['so', '三振率'], ['hr', '本塁打率'], ['b2', '二塁打率'], ['b3', '三塁打率'], ['runs', '得点/試合']]) {
  const dev = (neutral[k] - real[k]) / real[k] * 100;
  console.log(label.padEnd(14) + (k === 'runs' ? neutral[k].toFixed(3) : neutral[k].toFixed(4)).padStart(11)
    + (k === 'runs' ? real[k].toFixed(3) : real[k].toFixed(4)).padStart(12) + ((dev >= 0 ? '+' : '') + dev.toFixed(1) + '%').padStart(9));
}

// 相互作用がエンジン内でも生じるか
console.log('\n相互作用の確認（打者の能力だけを変える）');
const power = run({ hrPerFly: 1.5, xbhBoost: 1.15 }, SEED);
const speed = run({ gbSingle: 1.2 }, SEED);
console.log('条件'.padEnd(16) + '打率'.padStart(9) + '本塁打率'.padStart(10) + '二塁打率'.padStart(10) + '三塁打率'.padStart(10) + '得点/試合'.padStart(10));
const row = (label, r) => console.log(label.padEnd(14) + r.avg.toFixed(4).padStart(10) + r.hr.toFixed(4).padStart(10) + r.b2.toFixed(4).padStart(10) + r.b3.toFixed(5).padStart(11) + r.runs.toFixed(3).padStart(10));
row('中立', neutral);
row('パワー↑', power);
row('走力↑', speed);

const ok1 = power.avg > neutral.avg && power.hr > neutral.hr && power.b2 > neutral.b2;
const ok2 = speed.avg > neutral.avg && Math.abs(speed.hr - neutral.hr) / neutral.hr < 0.05;
console.log(`\n${ok1 ? 'PASS' : 'FAIL'}  パワーを上げると本塁打・二塁打・打率がすべて上がる（エンジン内で相互作用が生じる）`);
console.log(`${ok2 ? 'PASS' : 'FAIL'}  走力を上げると打率は上がるが本塁打はほぼ不変（脚力がパワーへ漏れない）`);
db.close();
process.exit(ok1 && ok2 ? 0 : 1);

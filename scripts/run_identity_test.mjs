// エンジンの恒等性テスト: 全打者・全投手をリーグ平均にして1シーズン回す。
// 打撃結果の分布は定義上リーグ平均と一致するはずで、一致しなければ打席解決の実装バグ。
// その上で「得点/試合」だけがズレるなら、原因は進塁ロジック（configs/engine.json の baserunning）に特定できる。
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../src/engine/rng.mjs';
import { rateVectorFromCounts } from '../src/engine/odds.mjs';
import { playSeason } from '../src/engine/season.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const SEED = Number(process.argv[3] || 20260731);

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lg = db.prepare(`
  SELECT SUM(pa) pa, SUM(ab) ab, SUM(h) h, SUM(bb) bb, SUM(hbp) hbp, SUM(so) so,
         SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr, SUM(r) r
  FROM v_batting WHERE season=?`).get(SEASON);

const league = rateVectorFromCounts({
  PA: lg.pa, BB: lg.bb, HBP: lg.hbp, SO: lg.so,
  B1: lg.b1, B2: lg.b2, B3: lg.b3, HR: lg.hr,
});

// 全員リーグ平均
const avg = { rates: league };
const teams = Array.from({ length: cfg.season.teams }, (_, i) => ({
  name: `T${i + 1}`,
  lineup: Array.from({ length: 9 }, (_, j) => ({ ...avg, id: `B${i}_${j}` })),
  starter: { ...avg, id: `P${i}` },
  bullpen: Array.from({ length: 6 }, (_, j) => ({ ...avg, id: `R${i}_${j}` })),
}));

const rng = makeRng(SEED);
const t0 = Date.now();
const { standings, playerStats, games } = playSeason(teams, league, rng, cfg);
const elapsed = Date.now() - t0;

const sim = { PA: 0, BB: 0, HBP: 0, SO: 0, B1: 0, B2: 0, B3: 0, HR: 0, OUT: 0 };
for (const [id, s] of playerStats) {
  if (id.startsWith('P:')) continue;
  for (const k of Object.keys(sim)) sim[k] += s[k];
}
const simAB = sim.PA - sim.BB - sim.HBP;
const simH = sim.B1 + sim.B2 + sim.B3 + sim.HR;
const totalRuns = standings.reduce((a, s) => a + s.rf, 0);
const realAB = lg.pa - lg.bb - lg.hbp; // 実測も同じ定義（犠打犠飛をアウト扱い）にして揃える

const rows = [
  ['打率(H/擬似AB)', simH / simAB, lg.h / realAB],
  ['三振率(対打席)', sim.SO / sim.PA, lg.so / lg.pa],
  ['四球率(対打席)', sim.BB / sim.PA, lg.bb / lg.pa],
  ['死球率(対打席)', sim.HBP / sim.PA, lg.hbp / lg.pa],
  ['本塁打率(対打席)', sim.HR / sim.PA, lg.hr / lg.pa],
  ['二塁打率(対打席)', sim.B2 / sim.PA, lg.b2 / lg.pa],
  ['三塁打率(対打席)', sim.B3 / sim.PA, lg.b3 / lg.pa],
  ['得点/試合(1チーム)', totalRuns / (games * 2), lg.r / (143 * cfg.season.teams)],
];

const fmt = v => v < 0.01 ? v.toFixed(5) : v.toFixed(4);
console.log(`\n=== 恒等性テスト (${SEASON}年 / seed=${SEED} / ${games}試合 / ${elapsed}ms) ===`);
console.log('全打者・全投手をリーグ平均に固定。打撃分布は定義上一致するはず。\n');
console.log('項目'.padEnd(20) + 'シミュ'.padStart(11) + '実測'.padStart(12) + '乖離'.padStart(9));
for (const [name, s, r] of rows) {
  const dev = (s - r) / r * 100;
  const flag = Math.abs(dev) < 1.5 ? '' : '   <<';
  console.log(name.padEnd(18) + fmt(s).padStart(11) + fmt(r).padStart(12) + ((dev >= 0 ? '+' : '') + dev.toFixed(1) + '%').padStart(9) + flag);
}
console.log(`\n1試合平均得点(両チーム計): ${(totalRuns / games).toFixed(2)}`);
db.close();

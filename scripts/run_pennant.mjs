// 複数年のペナントを回して記録層へ積む（設計書 Phase 4 の完了判定＝「複数年回して通算記録が引ける」）。
//
// 使い方: node scripts/run_pennant.mjs [年数] [開始年] [seed]
//   例: node scripts/run_pennant.mjs 5 2024 20260805
//
// 現段階の割り切り（明示しておく）:
//   - 選手の能力は**年をまたいでも変わらない**（成長・衰えは Phase 5）。
//     したがって「10年後に誰が伸びたか」はまだ見られない。見られるのは通算の積み上がりと
//     タイトルの分布で、記録層が引ける形になっているかの確認が目的
//   - 選手の移籍も無い（Phase 6 のCPU球団頭脳で扱う）

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../src/engine/rng.mjs';
import { rateVectorFromCounts, poolBaseline } from '../src/engine/odds.mjs';
import { playSeason } from '../src/engine/season.mjs';
import { drawLineup } from '../src/engine/lineup.mjs';
import { loadEngineConfig } from '../src/engine/config.mjs';
import { openStore, writeSeason, careerBatting, titles, teamHistory } from '../src/records/store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YEARS = Number(process.argv[2] || 5);
const BASE_SEASON = Number(process.argv[3] || 2024);
const SEED = Number(process.argv[4] || 20260805);
const RUN_ID = process.env.RUN_ID ?? `run_${BASE_SEASON}_${YEARS}y_${SEED}`;

const cfg = await loadEngineConfig(ROOT);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const store = openStore(path.join(ROOT, 'data', 'pennant_sim.db'));

// --- 選手の用意（Phase 2/3で確定した作りをそのまま使う） ---
const MIN_PA = Number(process.env.MIN_PA ?? 30);
const batters = db.prepare(`
  SELECT player_id, name, team, pa, ab, h, b1, b2, b3, hr, bb, hbp, so
  FROM v_batting WHERE season=? AND pa >= ? ORDER BY team, pa DESC`).all(BASE_SEASON, MIN_PA);
const pitchers = db.prepare(`
  SELECT player_id, name, team, outs, bf, h, hr, so, bb, hbp, gs
  FROM v_pitching WHERE season=? AND outs >= 60 ORDER BY team, outs DESC`).all(BASE_SEASON);

const pitcherPA = (p) => {
  const floor = p.h + p.bb + p.hbp;
  return (p.bf != null && p.bf >= floor) ? p.bf : (p.outs + p.h + p.bb + p.hbp);
};
const lgRow = db.prepare(`
  SELECT SUM(b1) b1, SUM(b2) b2, SUM(b3) b3 FROM v_batting WHERE season=?`).get(BASE_SEASON);
const nonHr = lgRow.b1 + lgRow.b2 + lgRow.b3;
const share = { B1: lgRow.b1 / nonHr, B2: lgRow.b2 / nonHr, B3: lgRow.b3 / nonHr };
const pitcherRates = (p) => {
  const h = Math.max(p.h - p.hr, 0);
  return rateVectorFromCounts({
    PA: pitcherPA(p), BB: p.bb, HBP: p.hbp, SO: p.so,
    B1: Math.round(h * share.B1), B2: Math.round(h * share.B2), B3: Math.round(h * share.B3), HR: p.hr,
  });
};

const names = new Map(), teamOf = new Map();
const teamNames = [...new Set(batters.map(b => b.team))];
const teams = teamNames.map(tn => {
  const roster = batters.filter(b => b.team === tn).map(b => {
    names.set(b.player_id, b.name); teamOf.set(b.player_id, tn);
    return {
      id: b.player_id, name: b.name, weight: b.pa,
      rates: rateVectorFromCounts({ PA: b.pa, BB: b.bb, HBP: b.hbp, SO: b.so, B1: b.b1, B2: b.b2, B3: b.b3, HR: b.hr }),
    };
  }).filter(x => x.rates);
  const tp = pitchers.filter(p => p.team === tn);
  const mk = p => {
    names.set(p.player_id, p.name); teamOf.set(p.player_id, tn);
    return { id: p.player_id, name: p.name, rates: pitcherRates(p), weight: pitcherPA(p) };
  };
  return {
    name: tn, roster,
    starters: tp.filter(p => (p.gs ?? 0) >= 5).map(mk).filter(x => x.rates),
    relievers: tp.filter(p => (p.gs ?? 0) < 5).map(mk).filter(x => x.rates),
  };
});

const pickWeighted = (list, rand) => {
  let total = 0;
  for (const e of list) total += Math.max(e.weight, 0);
  if (!(total > 0)) return list[Math.floor(rand() * list.length)];
  let r = rand() * total;
  for (const e of list) { r -= Math.max(e.weight, 0); if (r <= 0) return e; }
  return list[list.length - 1];
};
const weightedOrder = (list, rand) => {
  const pool = list.map(e => ({ e, w: Math.max(e.weight, 0) }));
  const out = [];
  while (pool.length) {
    let total = 0;
    for (const x of pool) total += x.w;
    let idx = 0;
    if (total > 0) { let r = rand() * total; for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } } }
    out.push(pool[idx].e); pool.splice(idx, 1);
  }
  return out;
};

const baseline = poolBaseline(
  teams.flatMap(t => [...t.starters, ...t.relievers]).map(p => ({ rates: p.rates, weight: p.weight })));

store.prepare(`INSERT OR REPLACE INTO sim_run (run_id,created_at,seed,note) VALUES (?,?,?,?)`)
  .run(RUN_ID, new Date().toISOString(), SEED,
    `${BASE_SEASON}年の選手で${YEARS}年ペナント（成長・衰え・移籍なし＝Phase 5/6で実装）`);

console.log(`=== ペナント ${YEARS}年 (${BASE_SEASON}年の選手 / seed=${SEED}) ===`);
const t0 = Date.now();
for (let y = 0; y < YEARS; y++) {
  const season = BASE_SEASON + y;
  const rng = makeRng(SEED + y * 7919);
  const tfs = teams.map(t => ({
    name: t.name,
    get lineup() { return drawLineup(t.roster, rng); },
    get starter() { return pickWeighted(t.starters, rng); },
    get bullpen() { return weightedOrder(t.relievers, rng); },
  }));

  // 1試合ごとに出場（G）を数える。集計だけ受け取り、打席の生ログは受け取らない
  const bat = new Map(), pit = new Map();
  const gameRows = [];
  const acc = (map, id, stats) => {
    let e = map.get(id);
    if (!e) { e = { g: 0, stats: { PA: 0, BB: 0, HBP: 0, SO: 0, B1: 0, B2: 0, B3: 0, HR: 0, OUT: 0 } }; map.set(id, e); }
    e.g++;
    for (const k of Object.keys(e.stats)) e.stats[k] += stats[k];
  };
  const { standings } = playSeason(tfs, { rates: baseline }, rng, cfg, {
    onGame: (g) => {
      gameRows.push(g);
      for (const [id, s] of g.batting) acc(bat, id, s);
      for (const [id, s] of g.pitching) acc(pit, id, s);
    },
  });

  writeSeason(store, { runId: RUN_ID, season, standings, batting: bat, pitching: pit, games: gameRows, names, teamOf });
  const top = [...standings].sort((a, b) => (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)))[0];
  console.log(`  ${season}年 完了（${gameRows.length}試合）  優勝: ${top.name} ${top.w}勝${top.l}敗${top.d}分`);
}
console.log(`  ${Date.now() - t0}ms\n`);

// --- 完了判定: 通算記録・タイトル・球団史が引けるか ---
console.log('【通算成績 本塁打上位5人】');
for (const r of careerBatting(store, RUN_ID, { minPa: 100 }).slice(0, 5)) {
  console.log(`  ${r.name.padEnd(12)} ${r.seasons}年  ${r.g}試合 ${r.pa}打席  打率${r.avg.toFixed(3)}  ${r.hr}本  ${r.h}安打`);
}
console.log(`\n【${BASE_SEASON}年のタイトル】`);
const t = titles(store, RUN_ID, BASE_SEASON, { gamesPerTeam: cfg.season.games_per_team });
console.log(`  規定打席${t.qualified.pa}以上`);
console.log(`  首位打者: ${t.battingAverage?.name} (${t.battingAverage?.team}) .${String(Math.round(t.battingAverage?.v * 1000)).padStart(3, '0')}`);
console.log(`  本塁打王: ${t.homeRuns?.name} (${t.homeRuns?.team}) ${t.homeRuns?.v}本`);
console.log(`  最多安打: ${t.hits?.name} (${t.hits?.team}) ${t.hits?.v}本`);
console.log(`  最多奪三振: ${t.strikeouts?.name} (${t.strikeouts?.team}) ${t.strikeouts?.v}`);

const someTeam = teams[0].name;
console.log(`\n【球団史】${someTeam}`);
for (const r of teamHistory(store, RUN_ID, someTeam)) {
  console.log(`  ${r.season}年  ${r.rank}位  ${r.w}勝${r.l}敗${r.d}分  得${r.rf} 失${r.ra}`);
}
console.log(`\n保存先: data/pennant_sim.db (run_id=${RUN_ID})`);
store.close(); db.close();

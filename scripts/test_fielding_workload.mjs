import assert from 'node:assert/strict';
import { buildDefensiveWorkloadContexts } from '../src/ratings/fielding_workload.mjs';

const rows = [
  { season: 2024, date: '2024-03-29', game_id: 'g1', player: '源田 壮亮', pitches: 120 },
  { season: 2024, date: '2024-03-30', game_id: 'g2', player: '源田 壮亮', pitches: 110 },
  { season: 2024, date: '2024-04-05', game_id: 'g3', player: '源田 壮亮', pitches: 100 },
  { season: 2024, date: '2024-04-20', game_id: 'g4', player: '源田 壮亮', pitches: 90 },
  { season: 2025, date: '2025-03-28', game_id: 'g5', player: '源田 壮亮', pitches: 105 },
  { season: 2024, date: '2024-03-29', game_id: 'a1', player: '近本　光司', pitches: 95 },
];

const m = buildDefensiveWorkloadContexts(rows);
const key = (s,g,n) => `${s}|${g}|${n.replace(/[\s　]/g,'')}`;

const g1 = m.get(key(2024,'g1','源田 壮亮'));
assert.equal(g1.prev_def_game_gap_days, null);
assert.equal(g1.prior_def_games_7d, 0);
assert.equal(g1.season_def_pitches_before, 0);

const g2 = m.get(key(2024,'g2','源田 壮亮'));
assert.equal(g2.prev_def_game_gap_days, 1);
assert.equal(g2.prior_def_games_7d, 1);
assert.equal(g2.prior_def_pitches_7d, 120);
assert.equal(g2.season_def_games_before, 1);
assert.equal(g2.season_def_pitches_before, 120);

const g3 = m.get(key(2024,'g3','源田 壮亮'));
assert.equal(g3.prev_def_game_gap_days, 6);
assert.equal(g3.prior_def_games_7d, 1); // 3/30だけが7日以内。3/29は7日超
assert.equal(g3.prior_def_pitches_7d, 110);
assert.equal(g3.prior_def_games_14d, 2);
assert.equal(g3.prior_def_pitches_14d, 230);
assert.equal(g3.season_def_pitches_before, 230);

const g4 = m.get(key(2024,'g4','源田 壮亮'));
assert.equal(g4.prev_def_game_gap_days, 15);
assert.equal(g4.prior_def_games_14d, 0);
assert.equal(g4.season_def_games_before, 3);
assert.equal(g4.season_def_pitches_before, 330);

const g5 = m.get(key(2025,'g5','源田 壮亮'));
assert.equal(g5.prev_def_game_gap_days, null, 'seasonを跨いだ前年最終戦を当年の休養日数へ混ぜない');
assert.equal(g5.season_def_games_before, 0, 'season累積は年初にリセット');
assert.equal(g5.season_def_pitches_before, 0);

const a1 = m.get(key(2024,'a1','近本 光司'));
assert.equal(a1.season_def_games_before, 0, '選手ごとに独立');
assert.equal(a1.prior_def_pitches_7d, 0);

console.log('fielding workload: 20 checks passed');

import assert from 'node:assert/strict';
import { buildDefensiveWorkloadContexts } from '../src/ratings/fielding_workload.mjs';

const rows = [
  { season: 2024, date: '2024-03-29', game_id: 'g1', player: '源田 壮亮', pitches: 120 },
  { season: 2024, date: '2024-03-30', game_id: 'g2', player: '源田 壮亮', pitches: 110 },
  { season: 2024, date: '2024-04-05', game_id: 'g3', player: '源田 壮亮', pitches: 100 },
  { season: 2024, date: '2024-04-20', game_id: 'g4', player: '源田 壮亮', pitches: 90 },
  { season: 2025, date: '2025-03-28', game_id: 'g5', player: '源田 壮亮', pitches: 105 },
  { season: 2024, date: '2024-03-29', game_id: 'a1', player: '近本　光司', pitches: 95 },
  { season: 2024, date: null, game_id: 'u1', player: '日付 不明', pitches: 80 },
  { season: 2024, date: null, game_id: 'u2', player: '日付 不明', pitches: 70 },
];

const m = buildDefensiveWorkloadContexts(rows);
const key = (s,g,n) => `${s}|${g}|${n.replace(/[\s　]/g,'')}`;
let checks = 0;
const eq = (actual, expected, message) => { assert.equal(actual, expected, message); checks++; };

const g1 = m.get(key(2024,'g1','源田 壮亮'));
eq(g1.prev_def_game_gap_days, null);
eq(g1.prior_def_games_7d, 0);
eq(g1.season_def_pitches_before, 0);

const g2 = m.get(key(2024,'g2','源田 壮亮'));
eq(g2.prev_def_game_gap_days, 1);
eq(g2.prior_def_games_7d, 1);
eq(g2.prior_def_pitches_7d, 120);
eq(g2.season_def_games_before, 1);
eq(g2.season_def_pitches_before, 120);

const g3 = m.get(key(2024,'g3','源田 壮亮'));
eq(g3.prev_def_game_gap_days, 6);
eq(g3.prior_def_games_7d, 2); // 3/29はちょうど7日前、3/30は6日前。<=7日なので両方含む
eq(g3.prior_def_pitches_7d, 230);
eq(g3.prior_def_games_14d, 2);
eq(g3.prior_def_pitches_14d, 230);
eq(g3.season_def_pitches_before, 230);

const g4 = m.get(key(2024,'g4','源田 壮亮'));
eq(g4.prev_def_game_gap_days, 15);
eq(g4.prior_def_games_14d, 0);
eq(g4.season_def_games_before, 3);
eq(g4.season_def_pitches_before, 330);

const g5 = m.get(key(2025,'g5','源田 壮亮'));
eq(g5.prev_def_game_gap_days, null, 'seasonを跨いだ前年最終戦を当年の休養日数へ混ぜない');
eq(g5.season_def_games_before, 0, 'season累積は年初にリセット');
eq(g5.season_def_pitches_before, 0);

const a1 = m.get(key(2024,'a1','近本 光司'));
eq(a1.season_def_games_before, 0, '選手ごとに独立');
eq(a1.prior_def_pitches_7d, 0);

const u2 = m.get(key(2024,'u2','日付 不明'));
eq(u2.prev_def_game_gap_days, null, '日付欠損を0日休養とみなさない');
eq(u2.prior_def_games_7d, null, '日付欠損時の7日負荷を0と捏造しない');
eq(u2.prior_def_pitches_14d, null, '日付欠損時の14日負荷を0と捏造しない');
eq(u2.season_def_games_before, 1, '日付が無くてもシーズン累積試合数は保持できる');
eq(u2.season_def_pitches_before, 80, '日付が無くてもシーズン累積守備球数は保持できる');

console.log(`fielding workload: ${checks} checks passed`);

// 年度守備得点の位置別成分規律を固定する。DB不要。
import assert from 'node:assert/strict';
import {
  FIELDING_RUN_COMPONENTS_BY_POS,
  fieldingRunsForPosition,
  fieldingRunsForSeason,
} from '../src/cards/season_defense_runs.mjs';

assert.deepEqual(FIELDING_RUN_COMPONENTS_BY_POS.SS, ['rngr','errr','dpr']);
assert.deepEqual(FIELDING_RUN_COMPONENTS_BY_POS.CF, ['rngr','errr','arm']);
assert.deepEqual(FIELDING_RUN_COMPONENTS_BY_POS.C, ['errr','arm','framing','blocking']);
assert.deepEqual(FIELDING_RUN_COMPONENTS_BY_POS.DH, []);

const ss = fieldingRunsForPosition({ pos:'SS', inn:1000, rngr:3, errr:-1, dpr:2, arm:null });
assert.equal(ss.runs, 4);
assert.equal(ss.components.arm, undefined);

const cf = fieldingRunsForPosition({ pos:'CF', inn:900, rngr:4, errr:0.5, arm:-1, dpr:null });
assert.equal(cf.runs, 3.5);

const c = fieldingRunsForPosition({ pos:'C', inn:800, errr:1, arm:2, framing:3, blocking:-0.5, rngr:null });
assert.equal(c.runs, 5.5);

const dh = fieldingRunsForPosition({ pos:'DH', inn:0 });
assert.equal(dh.runs, 0);
assert.match(dh.basis, /守備機会なし/);

// 必須成分欠損を0にしない。
assert.equal(fieldingRunsForPosition({ pos:'SS', rngr:2, errr:null, dpr:1 }), null);
assert.equal(fieldingRunsForPosition({ pos:'XX', rngr:2, errr:1 }), null);

// 複数位置はrun単位なのでそのまま合算できる。
const season = fieldingRunsForSeason([
  { pos:'1B', inn:500, rngr:1, errr:2, dpr:-1 },
  { pos:'LF', inn:300, rngr:2, errr:-0.5, arm:1 },
]);
assert.equal(season.runs, 4.5);
assert.equal(season.positions.length, 2);
assert.equal(season.innings, 800);
assert.equal(season.complete, true);

// 1位置でも不完全なら年度値全体を作らない。
assert.equal(fieldingRunsForSeason([
  { pos:'1B', inn:500, rngr:1, errr:2, dpr:-1 },
  { pos:'LF', inn:300, rngr:2, errr:null, arm:1 },
]), null);
assert.equal(fieldingRunsForSeason([]), null);

console.log('season defense runs: 13 checks passed');

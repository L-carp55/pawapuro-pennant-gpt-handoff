// Phase 1 safety regression tests (2026-08-06).
// DB不要。危険な自動カード選定が「黙って打撃だけで通る」状態へ戻らないことを確認する。

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankSeasons } from '../src/cards/peak_year.mjs';
import { selectPrimeWindow } from '../src/cards/prime_composite.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;

const line = (PA = 500) => ({
  PA, AB: 450, H: 120, B2: 20, B3: 2, HR: 20,
  BB: 40, HBP: 5, SO: 100, SH: 0, SF: 5, GDP: 10, SB: 5, CS: 2,
});
const baseSeason = season => ({
  season,
  line: line(),
  lgRate: { out: 0.68, b1: 0.18, b2: 0.04, b3: 0.004, hr: 0.025, bb: 0.075, hbp: 0.01 },
  envFactors: { avg: 1, hr: 1 },
  position: 'CF',
  teamGames: 143,
});

// 1. 総合ピークは走塁・守備が無ければ必ず止まる。
assert.throws(
  () => rankSeasons([baseSeason(2023), baseSeason(2024)], rv, { mode: 'total' }),
  /総合ピーク選定を停止/,
);

// 2. 打撃ピークを明示した場合は、走守が無くても使える。
assert.equal(
  rankSeasons([baseSeason(2023), baseSeason(2024)], rv, { mode: 'batting' }).length,
  2,
);

// 3. 総合ピークに必要な値を明示すれば通る。
assert.equal(
  rankSeasons([
    { ...baseSeason(2023), runRuns: 1, fldRuns: 2 },
    { ...baseSeason(2024), runRuns: -1, fldRuns: 3 },
  ], rv, { mode: 'total' }).length,
  2,
);

// 4. 全盛期の総合窓も走守未接続なら止まる。
assert.throws(
  () => selectPrimeWindow([baseSeason(2022), baseSeason(2023), baseSeason(2024)], rv),
  /全盛期の総合窓選定を停止/,
);

// 5. 身体能力のSQLへ未来年度の上限が戻っていないことを静的に確認する。
const durable = await readFile(path.join(ROOT, 'src', 'cards', 'durable_estimate.mjs'), 'utf8');
assert.ok(!durable.includes('targetSeason + MAX_GAP'), '未来年度を含むSQL範囲が復活している');
assert.match(durable, /targetSeason - MAX_GAP, targetSeason\)/);

console.log('phase1 safety: 5 checks passed');

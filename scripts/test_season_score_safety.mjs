// 総合ピークの得点スコアに未較正ポジション補正が黙って入らないことを固定する。DB不要。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seasonScore, POSITION_ADJUSTMENT } from '../src/cards/season_score.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const line = { PA:600, AB:530, H:150, B2:30, B3:3, HR:25, BB:55, HBP:5, SH:0, SF:5, SB:10, CS:3 };
const lgRate = { b1:.16, xb2:.045, hr:.025, bb:.08, hbp:.01, sb:.015, cs:.005, outs:.66 };

const c = seasonScore({ line, lgRate, rv, runRuns:3, fldRuns:7, position:'捕' });
const dh = seasonScore({ line, lgRate, rv, runRuns:3, fldRuns:7, position:'指' });

// 既定では主位置が違っても同じ観測得点ならtotalは同じ。
assert.equal(c.total, dh.total);
assert.equal(c.parts.posAdj, 0);
assert.equal(dh.parts.posAdj, 0);
assert.equal(c.parts.positionAdjustmentApplied, false);
assert.equal(c.parts.positionAdjustmentStatus, 'disabled_uncalibrated');
assert.equal(c.total, c.batting + 3 + 7);

// 診断時だけ明示opt-inすると旧候補を再現できる。
const cDiag = seasonScore({ line, lgRate, rv, runRuns:3, fldRuns:7, position:'捕', includeProvisionalPositionAdjustment:true });
const dhDiag = seasonScore({ line, lgRate, rv, runRuns:3, fldRuns:7, position:'指', includeProvisionalPositionAdjustment:true });
assert.notEqual(cDiag.total, dhDiag.total);
assert.equal(cDiag.parts.positionAdjustmentApplied, true);
assert.equal(cDiag.parts.positionAdjustmentStatus, 'provisional_diagnostic');
assert.ok(cDiag.parts.posAdj > 0);
assert.ok(dhDiag.parts.posAdj < 0);
assert.match(POSITION_ADJUSTMENT._status, /DIAGNOSTIC_ONLY/);

console.log('season score safety: 13 checks passed');

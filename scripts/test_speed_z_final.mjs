// 走力z一本化の回帰テスト（2026-08-06）。DB不要。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFinalSpeed } from '../src/ratings/running.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));

// 単年zと複数年zが食い違う場合、カード内の共通値は複数年zになる。
const state = resolveFinalSpeed(1.5, {
  z: -0.4, weight: 1200, years: 3, seasons: [2022, 2023, 2024], isMultiYear: true,
}, { weight: 500, season: 2024 }, cfg);
assert.equal(state.zFinal, -0.4);
assert.equal(state.detail.z_single_year, 1.5);
assert.equal(state.detail.z_final, -0.4);
assert.deepEqual(state.detail.seasons, [2022, 2023, 2024]);

// 複数年推定が無ければ、単年zを全経路の共通値として使う。
const fallback = resolveFinalSpeed(0.7, null, { weight: 500, season: 2024 }, cfg);
assert.equal(fallback.zFinal, 0.7);
assert.equal(fallback.detail.isMultiYear, false);
assert.deepEqual(fallback.detail.seasons, [2024]);
assert.equal(resolveFinalSpeed(null, null, {}, cfg), null);

// パイプラインの4経路が単年sc.scoreへ戻っていないことを静的に保証する。
const pipeline = await readFile(path.join(ROOT, 'src', 'cards', 'pipeline.mjs'), 'utf8');
assert.match(pipeline, /infieldHitAbility\(gbSingleExcess, speedZFinal, cfg\)/);
assert.match(pipeline, /stealingAbility\([\s\S]*?bm\.wsb, speedZFinal, runNorm, cfg\)/);
assert.match(pipeline, /baserunningAbility\([\s\S]*?speedZFinal, runNorm, cfg/);
assert.match(pipeline, /_z: speedZFinal/);
assert.match(pipeline, /appraiseAllPositions\(fldRows, run\?\._z \?\? 0, fldNorm, cfg\)/);
assert.ok(!/infieldHitAbility\([^\n]*sc\.score/.test(pipeline));
assert.ok(!/stealingAbility\([^\n]*sc\.score/.test(pipeline));
assert.ok(!/baserunningAbility\([^\n]*sc\.score/.test(pipeline));

const schema = await readFile(path.join(ROOT, 'src', 'cards', 'card_schema.mjs'), 'utf8');
assert.match(schema, /_speed_z_final/);
assert.match(schema, /_speed_z_single_year/);

console.log('speed_z_final: 12 checks passed');

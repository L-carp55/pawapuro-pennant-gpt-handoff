// 追加進塁イベント再構築の純粋関数テスト。DB・生データ不要。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAdvanceOutcome, runnerBase, addPitchRowToPlateAppearance } from '../src/ratings/baserunning_events.mjs';

const B = (first = null, second = null, third = null) => ({ first, second, third });

assert.equal(runnerBase('R', B(null, null, 'R')), 'third');
assert.equal(runnerBase('R', B(null, 'R', null)), 'second');
assert.equal(runnerBase('R', B()), null);

// 一塁→三塁: 三塁到達=成功、二塁止まり=失敗。
assert.equal(classifyAdvanceOutcome('1st_to_3rd', 'R', B(null, null, 'R'), 0, 0), 1);
assert.equal(classifyAdvanceOutcome('1st_to_3rd', 'R', B(null, 'R', null), 0, 0), 0);
// 塁上から消えてアウト数不変なら生還=成功。
assert.equal(classifyAdvanceOutcome('1st_to_3rd', 'R', B(), 1, 1), 1);
// 消えてアウト増なら生還と走塁死を区別できないので除外。
assert.equal(classifyAdvanceOutcome('1st_to_3rd', 'R', B(), 1, 2), null);

// 二塁→本塁: 三塁止まり=失敗、消えてアウト不変=生還。
assert.equal(classifyAdvanceOutcome('2nd_to_home', 'R', B(null, null, 'R'), 0, 0), 0);
assert.equal(classifyAdvanceOutcome('2nd_to_home', 'R', B(), 0, 0), 1);
assert.equal(classifyAdvanceOutcome('2nd_to_home', 'R', B(), 0, 1), null);

// 一塁→本塁（二塁打）も同じ規律。
assert.equal(classifyAdvanceOutcome('1st_to_home_on_2b', 'R', B(null, null, 'R'), 2, 2), 0);
assert.equal(classifyAdvanceOutcome('1st_to_home_on_2b', 'R', B(), 2, 2), 1);
assert.equal(classifyAdvanceOutcome('1st_to_home_on_2b', 'R', B(), 1, 2), null);

// 非投球ヘッダーが先に来ても「最初の実投球行」を開始状態として保持する。
const m = new Map();
addPitchRowToPlateAppearance(m, 'pa', { kind: 'header', on1: null }, false);
addPitchRowToPlateAppearance(m, 'pa', { kind: 'pitch', pitch: 1, on1: 'R' }, true);
addPitchRowToPlateAppearance(m, 'pa', { kind: 'pitch', pitch: 2, on1: 'R' }, true);
addPitchRowToPlateAppearance(m, 'pa', { kind: 'substitution', on1: null }, false);
assert.equal(m.get('pa').first.kind, 'header');
assert.equal(m.get('pa').firstPitch.pitch, 1);
assert.equal(m.get('pa').firstPitch.on1, 'R');
assert.equal(m.get('pa').lastPitch.pitch, 2);
assert.equal(m.get('pa').last.kind, 'substitution');

// 旧呼び出し（isPitch省略）は互換維持。
const legacy = new Map();
addPitchRowToPlateAppearance(legacy, 'pa', { pitch: 1, on1: 'R' });
addPitchRowToPlateAppearance(legacy, 'pa', { pitch: 2, on1: null });
assert.equal(legacy.get('pa').firstPitch.pitch, 1);
assert.equal(legacy.get('pa').lastPitch.pitch, 2);

// ビルダーが非投球first/lastへ戻らないことを静的にも固定する。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builder = await readFile(path.join(ROOT, 'scripts', 'build_baserunning_advances.mjs'), 'utf8');
assert.match(builder, /addPitchRowToPlateAppearance/);
assert.match(builder, /firstPitch/);
assert.match(builder, /lastPitch/);
assert.ok(!builder.includes("const r1 = norm(cur[c.on1n])"));

console.log('baserunning event inference: 24 checks passed');

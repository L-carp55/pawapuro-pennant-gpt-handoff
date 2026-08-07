// 走塁得能の安全停止が黙って解除されないための回帰テスト。DB不要。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = JSON.parse(await readFile(path.join(ROOT, 'configs', 'model_gates.json'), 'utf8'));
assert.equal(gate.baserunning_ability.enabled, false);
assert.equal(gate.baserunning_ability.status, 'PAUSED');
assert.match(gate.baserunning_ability.reason, /循環/);
assert.ok(gate.baserunning_ability.evidence.combined_repeatability < 0.3);
assert.ok(gate.baserunning_ability.reopen_conditions.length >= 4);

const pipeline = await readFile(path.join(ROOT, 'src', 'cards', 'pipeline.mjs'), 'utf8');
assert.match(pipeline, /modelGates/);
assert.match(pipeline, /baserunningGate\?\.enabled === false \? null/);
assert.match(pipeline, /baserunningStatus/);
assert.match(pipeline, /unappraisedReasons/);

console.log('baserunning gate: 9 checks passed');

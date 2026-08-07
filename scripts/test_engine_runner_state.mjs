import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advance, emptyBases, trySteal } from '../src/engine/baserunning.mjs';
import { runnerContext } from '../src/engine/runner_context.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineCfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));
const responseCfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'baseball_running_response.json'), 'utf8'));
const cfg = engineCfg.baserunning;

const seqRng = (...answers) => ({
  chance() { return answers.length ? answers.shift() : false; },
});

const A = {
  id: 'A', name: 'Runner A',
  running: {
    physical: { topSpeedZ: 1.0, accelerationZ: 0.5 },
    skills: { stealingZ: 0.7, baserunningZ: -0.2, infieldHitZ: 0.1, gdpZ: null },
  },
};
const B = { id: 'B', name: 'Runner B' };
const C = { id: 'C', name: 'Runner C' };

// 1. legacy shape remains available.
assert.deepEqual(emptyBases(), [false, false, false]);
const legacy = advance(emptyBases(), 0, 'B1', seqRng(false), cfg);
assert.deepEqual(legacy.bases, [true, false, false], 'ctxなしは従来どおりboolean runner');

// 2. batter object is preserved on base.
let r = advance(emptyBases(), 0, 'B1', seqRng(false), cfg, { batter: A });
assert.equal(r.bases[0], A, '単打出塁でbatter identityを保持');
r = advance(r.bases, r.outs, 'B1', seqRng(false), cfg, { batter: B });
assert.equal(r.bases[0], B, '新打者が一塁');
assert.equal(r.bases[1], A, '元一塁走者が二塁へ移動してidentity保持');

// 3. force advanceでもidentityを失わない。
r = advance([A, B, false], 0, 'BB', seqRng(), cfg, { batter: C });
assert.deepEqual(r.bases, [C, A, B]);

// 4. extra-base hitでも既存runner identityを移す。
r = advance([A, false, false], 0, 'B2', seqRng(false), cfg, { batter: C });
assert.equal(r.bases[1], C);
assert.equal(r.bases[2], A);

// 5. stolen-base success moves the same player object; caught stealing removes it.
let st = trySteal([A, false, false], 0, seqRng(true, true), cfg);
assert.deepEqual(st.bases, [false, A, false]);
assert.equal(st.sb, 1); assert.equal(st.cs, 0);
st = trySteal([A, false, false], 0, seqRng(true, false), cfg);
assert.deepEqual(st.bases, [false, false, false]);
assert.equal(st.outs, 1); assert.equal(st.sb, 0); assert.equal(st.cs, 1);

// 6. physical and skill are separate engine inputs.
const ctx = runnerContext(A, responseCfg);
assert.equal(ctx.identity.id, 'A');
assert.equal(ctx.physical.status, 'COMPLETE');
assert.ok(Number.isFinite(ctx.physical.performance_z));
assert.equal(ctx.skills.stealingZ, 0.7);
assert.equal(ctx.skills.baserunningZ, -0.2);

// Missing acceleration must not silently become average acceleration.
const partial = runnerContext({
  id: 'P', running: { physical: { topSpeedZ: 1.2, accelerationZ: null } },
}, responseCfg);
assert.equal(partial.physical.status, 'PARTIAL_MISSING_PHYSICAL_AXIS');
assert.equal(partial.physical.performance_z, null);

// 7. player-specific event effects stay off until calibrated.
assert.equal(engineCfg.player_running.enabled, false);
assert.equal(engineCfg.player_running.status, 'PLUMBING_READY_EVENT_RESPONSES_UNCALIBRATED');

// 8. With the same chance stream, runner objects change identity bookkeeping only,
// not scoring/out occupancy while player-specific event responses are disabled.
function runMini(useObjects) {
  let bases = emptyBases(), outs = 0, runs = 0;
  const batters = [A, B, C, A];
  const outcomes = ['B1', 'B1', 'B2', 'OUT'];
  const answers = [false, false, false, false, false, false, false, false];
  const rng = seqRng(...answers);
  for (let i = 0; i < outcomes.length; i++) {
    const res = advance(bases, outs, outcomes[i], rng, cfg, useObjects ? { batter: batters[i] } : null);
    bases = res.bases; outs = res.outs; runs += res.runs;
  }
  return { occupied: bases.map(Boolean), outs, runs };
}
assert.deepEqual(runMini(true), runMini(false), 'plumbing導入だけではlegacy確率・結果を変えない');

console.log('engine runner state: 18 checks passed');

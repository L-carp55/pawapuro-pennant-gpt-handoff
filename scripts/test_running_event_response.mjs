import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRunningEventProbability } from '../src/engine/running_event_response.mjs';
import { advance } from '../src/engine/baserunning.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runningResponseCfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'baseball_running_response.json'), 'utf8'));
const registry = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_event_responses.json'), 'utf8'));
const engineCfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));

const runner = {
  id: 'fast-skilled',
  running: {
    physical: { topSpeedZ: 1.0, accelerationZ: 0.5 },
    skills: { baserunningZ: 0.8, stealingZ: 0.4 },
  },
};
const samePhysicalLowerSkill = {
  id: 'fast-poor-skill',
  running: {
    physical: { topSpeedZ: 1.0, accelerationZ: 0.5 },
    skills: { baserunningZ: -0.8, stealingZ: -0.4 },
  },
};

const base = 0.28;

// Production gate OFF => profileがあってもglobal probabilityそのまま。
let x = resolveRunningEventProbability({
  event: 'single_1st_to_3rd', baseProbability: base, actor: runner,
  playerRunningCfg: engineCfg.player_running,
  runningResponseCfg, eventResponseCfg: registry,
});
assert.equal(x.probability, base);
assert.equal(x.status, 'GLOBAL_FALLBACK_GATE_DISABLED');
assert.equal(x.used_player_effect, false);

// Gateだけ開けてもproduction registryは未較正なのでglobalへ戻る。
const gateOn = { ...engineCfg.player_running, enabled: true };
x = resolveRunningEventProbability({
  event: 'single_1st_to_3rd', baseProbability: base, actor: runner,
  playerRunningCfg: gateOn,
  runningResponseCfg, eventResponseCfg: registry,
});
assert.equal(x.probability, base);
assert.equal(x.status, 'GLOBAL_FALLBACK_EVENT_UNCALIBRATED');

// 以下の係数はAPI挙動だけを見るTEST-ONLY synthetic values。本番configへ保存しない。
const synthetic = {
  calibrated: true,
  model_type: 'delta_logit_from_global_base',
  events: {
    single_1st_to_3rd: {
      calibrated: true,
      skill_key: 'baserunningZ',
      physical_coef: 0.7,
      skill_coef: 0.6,
      intercept_delta_logit: 0,
    },
  },
};

const good = resolveRunningEventProbability({
  event: 'single_1st_to_3rd', baseProbability: base, actor: runner,
  playerRunningCfg: gateOn, runningResponseCfg, eventResponseCfg: synthetic,
});
const poor = resolveRunningEventProbability({
  event: 'single_1st_to_3rd', baseProbability: base, actor: samePhysicalLowerSkill,
  playerRunningCfg: gateOn, runningResponseCfg, eventResponseCfg: synthetic,
});
assert.equal(good.status, 'PLAYER_RESPONSE_APPLIED');
assert.equal(poor.status, 'PLAYER_RESPONSE_APPLIED');
assert.ok(good.probability > poor.probability, '同じphysicalでもskill差が独立に効く');
assert.ok(good.components.physical === poor.components.physical, 'physical成分はskill差で変わらない');
assert.ok(good.components.skill > poor.components.skill);

// acceleration欠損を0=平均で埋めずglobalへfallback。
const partial = {
  id: 'partial',
  running: {
    physical: { topSpeedZ: 1.5, accelerationZ: null },
    skills: { baserunningZ: 1.0 },
  },
};
x = resolveRunningEventProbability({
  event: 'single_1st_to_3rd', baseProbability: base, actor: partial,
  playerRunningCfg: gateOn, runningResponseCfg, eventResponseCfg: synthetic,
});
assert.equal(x.probability, base);
assert.equal(x.status, 'GLOBAL_FALLBACK_MISSING_PHYSICAL_AXIS');

// skill欠損も同様にglobalへfallback。
const noSkill = {
  id: 'no-skill',
  running: { physical: { topSpeedZ: 1.0, accelerationZ: 0.5 }, skills: {} },
};
x = resolveRunningEventProbability({
  event: 'single_1st_to_3rd', baseProbability: base, actor: noSkill,
  playerRunningCfg: gateOn, runningResponseCfg, eventResponseCfg: synthetic,
});
assert.equal(x.probability, base);
assert.equal(x.status, 'GLOBAL_FALLBACK_MISSING_SKILL_AXIS');

// baserunning.mjsへの配線確認。chance(p)=p>0.5 という決定的test RNGを使う。
const thresholdRng = { chance: p => p > 0.5 };
const bcfg = { ...engineCfg.baserunning, single_runner1_to_3rd: base };
const legacy = advance([runner, false, false], 0, 'B1', thresholdRng, bcfg, {
  batter: { id: 'B' },
  playerRunningCfg: engineCfg.player_running,
  runningResponseCfg,
  eventResponseCfg: registry,
});
assert.equal(legacy.bases[1], runner, 'production gate OFFではbase=.28なので一→二');

const personalized = advance([runner, false, false], 0, 'B1', thresholdRng, bcfg, {
  batter: { id: 'B' },
  playerRunningCfg: gateOn,
  runningResponseCfg,
  eventResponseCfg: synthetic,
});
assert.equal(personalized.bases[2], runner, 'synthetic calibrated response時だけ一→三へ変化');

console.log('running event response: 17 checks passed');

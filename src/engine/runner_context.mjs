// 塁上のrunner identityと、身体走行性能 / 走塁系skillを分離して読む共通層。
//
// runner object の任意schema:
//   runner.running = {
//     physical: { topSpeedZ, accelerationZ },
//     skills: { stealingZ, baserunningZ, infieldHitZ, gdpZ }
//   }
//
// 現段階では「読む」だけで、盗塁成功率や追加進塁率へ係数を掛けない。
// event responseが未較正なのにplayer-specific効果を捏造しないため。

import { physicalRunningPerformance } from './running_response.mjs';

const finite = Number.isFinite;

export function runnerIdentity(baseOccupant) {
  if (!baseOccupant || baseOccupant === true) return null;
  if (typeof baseOccupant !== 'object') return null;
  return {
    id: baseOccupant.id ?? baseOccupant.player_id ?? null,
    name: baseOccupant.name ?? null,
  };
}

export function runnerSkillProfile(baseOccupant) {
  if (!baseOccupant || baseOccupant === true || typeof baseOccupant !== 'object') return null;
  const s = baseOccupant.running?.skills;
  if (!s || typeof s !== 'object') return null;
  const out = {};
  for (const k of ['stealingZ', 'baserunningZ', 'infieldHitZ', 'gdpZ']) {
    out[k] = finite(s[k]) ? s[k] : null;
  }
  return out;
}

export function runnerPhysicalProfile(baseOccupant, runningResponseCfg = null) {
  if (!baseOccupant || baseOccupant === true || typeof baseOccupant !== 'object') return null;
  const p = baseOccupant.running?.physical;
  if (!p || typeof p !== 'object') return null;
  const topSpeedZ = finite(p.topSpeedZ) ? p.topSpeedZ : null;
  const accelerationZ = finite(p.accelerationZ) ? p.accelerationZ : null;
  if (!runningResponseCfg) {
    return {
      status: 'RAW_AXES_ONLY',
      top_speed_z: topSpeedZ,
      acceleration_z: accelerationZ,
      performance_z: null,
    };
  }
  return physicalRunningPerformance({ topSpeedZ, accelerationZ }, runningResponseCfg);
}

export function runnerContext(baseOccupant, runningResponseCfg = null) {
  if (!baseOccupant) return null;
  return {
    identity: runnerIdentity(baseOccupant),
    physical: runnerPhysicalProfile(baseOccupant, runningResponseCfg),
    skills: runnerSkillProfile(baseOccupant),
    has_player_object: baseOccupant !== true && typeof baseOccupant === 'object',
  };
}

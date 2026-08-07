// runner-specificな盗塁/追加進塁確率を解決する共通層。
//
// production係数はここに一切埋め込まない。
// event configが player-holdout 等で calibrated=true になった時だけ、
// global base probabilityへ physical performance と event-specific skill の
// delta-logitを加える。
//
// 未較正 / gate OFF / 必要axis欠損では必ずglobal base probabilityへfallbackする。

import { runnerContext } from './runner_context.mjs';

const finite = Number.isFinite;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const logit = p => Math.log(p / (1 - p));
const logistic = x => 1 / (1 + Math.exp(-x));

export function resolveRunningEventProbability({
  event,
  baseProbability,
  actor,
  playerRunningCfg = null,
  runningResponseCfg = null,
  eventResponseCfg = null,
} = {}) {
  if (!(finite(baseProbability) && baseProbability >= 0 && baseProbability <= 1)) {
    throw new Error(`invalid running event base probability: ${baseProbability}`);
  }

  const fallback = (status, context = null) => ({
    probability: baseProbability,
    status,
    event,
    context,
    used_player_effect: false,
  });

  if (playerRunningCfg?.enabled !== true) {
    return fallback('GLOBAL_FALLBACK_GATE_DISABLED');
  }

  const e = eventResponseCfg?.events?.[event];
  if (!eventResponseCfg?.calibrated || !e?.calibrated) {
    return fallback('GLOBAL_FALLBACK_EVENT_UNCALIBRATED');
  }
  if (eventResponseCfg.model_type !== 'delta_logit_from_global_base') {
    throw new Error(`unsupported running event response model: ${eventResponseCfg.model_type}`);
  }

  const context = runnerContext(actor, runningResponseCfg);
  if (!context?.has_player_object) return fallback('GLOBAL_FALLBACK_NO_RUNNER_PROFILE', context);

  const physical = context.physical?.performance_z;
  const skillKey = e.skill_key ?? null;
  const skill = skillKey ? context.skills?.[skillKey] : null;
  const physicalCoef = e.physical_coef;
  const skillCoef = e.skill_coef;
  const interceptDelta = e.intercept_delta_logit ?? 0;

  if (!finite(physicalCoef) || !finite(skillCoef) || !finite(interceptDelta)) {
    throw new Error(`calibrated running event ${event} is missing finite coefficients`);
  }
  // physical軸が必要なのに欠ける場合は平均=0で埋めない。
  if (physical == null) return fallback('GLOBAL_FALLBACK_MISSING_PHYSICAL_AXIS', context);
  // skillも同様に欠損を平均扱いしない。
  if (skillKey && skill == null) return fallback('GLOBAL_FALLBACK_MISSING_SKILL_AXIS', context);

  // 0/1 exactly はglobal eventが構造的に固定されているとみなし、そのまま返す。
  if (baseProbability === 0 || baseProbability === 1) {
    return fallback('GLOBAL_FALLBACK_DEGENERATE_BASE', context);
  }

  const delta = interceptDelta + physicalCoef * physical + skillCoef * (skill ?? 0);
  const probability = clamp(logistic(logit(baseProbability) + delta), 0, 1);
  return {
    probability,
    status: 'PLAYER_RESPONSE_APPLIED',
    event,
    context,
    used_player_effect: true,
    delta_logit: delta,
    components: {
      physical: physicalCoef * physical,
      skill: skillCoef * (skill ?? 0),
      intercept: interceptDelta,
    },
  };
}

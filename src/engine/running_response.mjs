// 野球の純粋な身体軸(top speed / short acceleration)から、
// 打席離脱を除いた5→90ft直線走performanceを返すエンジン層。
//
// 最終100段階の「走力」ではない。まず物理的な野球距離走行へ変換し、
// その後に盗塁/追加進塁/守備到達などのエンジンイベントへ接続する。
//
// 係数は configs/baseball_running_response.json の実測較正値だけを使う。
// 加速欠損を0（平均）と仮定して完全値を捏造しない。

const finite = Number.isFinite;

export function validateRunningResponseConfig(cfg) {
  if (!cfg?.calibrated) throw new Error('baseball running response is not calibrated');
  const m = cfg.model;
  if (!m || m.type !== 'linear_standardized') throw new Error('unsupported baseball running response model');
  for (const k of ['intercept','top_speed_coef','acceleration_coef']) {
    if (!finite(m[k])) throw new Error(`invalid baseball running response coefficient: ${k}`);
  }
  return true;
}

/**
 * @param {{topSpeedZ:number|null, accelerationZ:number|null}} axes
 * @returns {{status:string, performance_z:number|null, top_speed_z:number|null, acceleration_z:number|null, partial:object|null}}
 */
export function physicalRunningPerformance(axes, cfg) {
  validateRunningResponseConfig(cfg);
  const top = finite(axes?.topSpeedZ) ? axes.topSpeedZ : null;
  const accel = finite(axes?.accelerationZ) ? axes.accelerationZ : null;
  const m = cfg.model;

  if (top == null || accel == null) {
    return {
      status: 'PARTIAL_MISSING_PHYSICAL_AXIS',
      performance_z: null,
      top_speed_z: top,
      acceleration_z: accel,
      partial: top != null ? {
        top_speed_contribution: m.top_speed_coef * top,
        _note: '加速が欠損しているため完全な5→90ft走行性能にはしない',
      } : null,
    };
  }

  return {
    status: 'COMPLETE',
    performance_z: m.intercept + m.top_speed_coef * top + m.acceleration_coef * accel,
    top_speed_z: top,
    acceleration_z: accel,
    partial: null,
  };
}

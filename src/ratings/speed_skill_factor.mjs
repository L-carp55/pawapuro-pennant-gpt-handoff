// 野球上の純粋走力と、結果固有の走塁技術を同時に分離する汎用推論器。
//
// 係数は一切ここへ埋め込まない。外部較正で得た loading / stable skill variance /
// annual noise variance を引数で渡した時だけ動く。
//
// モデル（各観測 j）:
//   outcome_j = intercept_j + loading_j * physical_speed_z + stable_skill_j + annual_noise_j
//
// physical_speed_z と各 stable_skill_j を別々の潜在変数として扱う。
// outcomeの良さをそのまま速度へ足し戻さないことが、このモジュールの最重要目的。

const finite = Number.isFinite;

function assertPositive(v, label) {
  if (!(finite(v) && v >= 0)) throw new Error(`${label} must be finite and >=0`);
}

/**
 * 複数年の同一指標を、stable skillを消さず annual noiseだけ減らす形で集約する。
 *
 * @param {Array<{value:number, weight:number, season:number}>} rows
 * @returns {null|{value:number, noise_factor:number, seasons:number[], total_weight:number}}
 *
 * noise_factor = Σ(w_i / Σw)^2
 * 独立なannual noiseなら等重みn年で1/nになる。
 * stable skill varianceは後段で減らさない。
 */
export function poolAnnualOutcome(rows) {
  const a = (rows ?? []).filter(r => finite(r?.value) && finite(r?.weight) && r.weight > 0);
  if (!a.length) return null;
  const w = a.reduce((s, r) => s + r.weight, 0);
  const value = a.reduce((s, r) => s + r.value * r.weight, 0) / w;
  const noise_factor = a.reduce((s, r) => s + (r.weight / w) ** 2, 0);
  return {
    value,
    noise_factor,
    seasons: [...new Set(a.map(r => r.season).filter(finite))].sort((x, y) => x - y),
    total_weight: w,
  };
}

/**
 * @param {object} observations
 *   {metricName: {value, noise_factor, seasons, ...}}
 * @param {object} calibration
 *   {
 *     speed_prior: {mean, variance},
 *     metrics: {
 *       metricName: {intercept, loading, skill_variance, annual_noise_variance}
 *     }
 *   }
 * @returns {{speed_z:number,speed_sd:number,skills:object,used_metrics:string[],evidence:object}}
 */
export function inferSpeedAndSkills(observations, calibration) {
  if (!calibration?.metrics) throw new Error('speed-skill calibration.metrics is required');
  const priorMean = calibration.speed_prior?.mean ?? 0;
  const priorVar = calibration.speed_prior?.variance ?? 1;
  if (!(finite(priorMean) && finite(priorVar) && priorVar > 0)) {
    throw new Error('speed prior must have finite mean and positive variance');
  }

  let precision = 1 / priorVar;
  let weighted = priorMean / priorVar;
  const used = [];
  const evidence = {};

  for (const [name, obs] of Object.entries(observations ?? {})) {
    const c = calibration.metrics[name];
    if (!c || !finite(obs?.value)) continue;
    const intercept = c.intercept;
    const loading = c.loading;
    const skillVar = c.skill_variance;
    const noiseVar = c.annual_noise_variance;
    const nf = obs.noise_factor ?? 1;
    if (![intercept, loading, skillVar, noiseVar, nf].every(finite)) {
      throw new Error(`invalid calibration/observation for ${name}`);
    }
    assertPositive(skillVar, `${name}.skill_variance`);
    assertPositive(noiseVar, `${name}.annual_noise_variance`);
    if (!(nf > 0)) throw new Error(`${name}.noise_factor must be >0`);

    // stable skill varianceは複数年でも残る。annual noiseだけnoise_factorで縮む。
    const marginalVar = skillVar + noiseVar * nf;
    if (!(marginalVar > 0)) continue;
    const centered = obs.value - intercept;
    precision += (loading * loading) / marginalVar;
    weighted += (loading * centered) / marginalVar;
    used.push(name);
    evidence[name] = {
      observed: obs.value,
      noise_factor: nf,
      marginal_variance: marginalVar,
      loading,
      seasons: obs.seasons ?? null,
    };
  }

  const speedVar = 1 / precision;
  const speed = weighted * speedVar;
  const skills = {};

  for (const name of used) {
    const obs = observations[name];
    const c = calibration.metrics[name];
    const nf = obs.noise_factor ?? 1;
    const skillVar = c.skill_variance;
    const noiseVar = c.annual_noise_variance * nf;
    const residual = obs.value - (c.intercept + c.loading * speed);
    const skillShrink = skillVar > 0 ? skillVar / (skillVar + noiseVar) : 0;
    const skill = residual * skillShrink;
    // 正規-正規のskill posterior variance。
    const postVar = skillVar > 0 && noiseVar > 0
      ? 1 / (1 / skillVar + 1 / noiseVar)
      : 0;
    skills[name] = {
      z: skill,
      sd: Math.sqrt(Math.max(0, postVar)),
      raw_residual: residual,
      shrinkage: skillShrink,
      _note: 'physical speedで説明した後の結果固有残差。speedへ足し戻さない',
    };
  }

  return {
    speed_z: speed,
    speed_sd: Math.sqrt(speedVar),
    skills,
    used_metrics: used,
    evidence,
  };
}

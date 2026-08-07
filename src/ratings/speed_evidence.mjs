// 統計走力・直接計測・スカウティング走力を、同じ目盛りで統合してから
// 査定内部の共通zへ戻す。
//
// 背景（2026-08-07監査）:
// - 統計走力 run.speed は「較正前」の内部目盛り。
// - ability_sheet では最後に scale_calibration.走力 を当てて表示する。
// - NPB+/Statcast/スカウティングの値は、すでに「較正後」の最終目盛り。
// - 旧 blendDirect は較正前の統計値と較正後の直接値をそのまま平均していた。
//
// ここでは統計値を先に最終目盛りへ写し、外部証拠と統合した後、
// 逆変換で内部raw ratingとzへ戻す。これにより表示と残差計算が同じ脚力を使う。

const finite = Number.isFinite;

/** 内部raw走力 → 現在の最終（scale_calibration後）目盛り。ここではclampしない。 */
export function speedRawToFinalScale(rawRating, cfg) {
  if (!finite(rawRating)) return null;
  const c = cfg.scale_calibration?.applied?.走力;
  return c ? c.intercept + c.slope * rawRating : rawRating;
}

/** 最終目盛り → 内部raw走力。 */
export function speedFinalScaleToRaw(finalRating, cfg) {
  if (!finite(finalRating)) return null;
  const c = cfg.scale_calibration?.applied?.走力;
  if (!c) return finalRating;
  if (!finite(c.slope) || c.slope === 0) throw new Error('走力scale_calibrationのslopeが0または不正');
  return (finalRating - c.intercept) / c.slope;
}

/** 内部raw走力 ↔ z。speedRating() の逆変換。 */
export function speedRawToZ(rawRating, cfg) {
  if (!finite(rawRating)) return null;
  const s = cfg.zscore_ratings?.speed;
  if (!s || !finite(s.spread) || s.spread === 0) throw new Error('zscore_ratings.speed.spreadが0または不正');
  return (rawRating - s.center) / s.spread;
}

/** 旧blendDirectと同じ「証拠の強さ」を返す。重みの規律自体はこの修正では変えない。 */
export function directSpeedWeight(direct, cfg) {
  if (!direct) return null;
  const metric = String(direct.source ?? '').replace('NPB+アプリ ', '');
  const model = cfg.npb_plus_direct?.models?.[metric];
  const w = model?.test_r != null ? model.test_r
    : (direct.source?.includes('Statcast') ? (cfg.direct_measurement?.speed?.r ?? 0.9) * 0.8 : 0.5);
  return Math.max(0, Math.min(1, w));
}

/**
 * @param {object} statistical resolveFinalSpeed() の戻り
 * @param {object} evidence {direct, scouting}
 *   direct: buildDirectMeasurements().走力（最終目盛り）
 *   scouting: validateEntry済みの走力スカウティング（最終目盛り）
 * @returns {object|null}
 *   rating = 内部raw走力（ability_sheetでscale_calibrationを当てると final_rating になる）
 *   zFinal = 盗塁・内野安打・守備残差にも使う共通z
 */
export function reconcileSpeedEvidence(statistical, evidence = {}, cfg) {
  if (!statistical || !finite(statistical.rating) || !finite(statistical.zFinal)) return statistical ?? null;

  const statRaw = statistical.rating;
  const statFinal = speedRawToFinalScale(statRaw, cfg);
  const direct = evidence.direct && finite(evidence.direct.value) ? evidence.direct : null;
  const scouting = evidence.scouting && finite(evidence.scouting.value) ? evidence.scouting : null;

  let finalRating = statFinal;
  let decidedBy = 'statistical';
  let weight = null;
  let external = null;

  // 仕様04 §1.2の階層どおり、直接計測（第1階層）をスカウティング（第2階層）より優先する。
  // evidence_only のスカウティングは値決定に使わず、証拠束にだけ残す。
  if (direct) {
    weight = directSpeedWeight(direct, cfg);
    finalRating = statFinal * (1 - weight) + direct.value * weight;
    decidedBy = 'direct_blend';
    external = direct;
  } else if (scouting && scouting.application !== 'evidence_only') {
    finalRating = scouting.value;
    decidedBy = 'scouting';
    external = scouting;
  }

  const rawFinal = speedFinalScaleToRaw(finalRating, cfg);
  const zFinal = speedRawToZ(rawFinal, cfg);
  return {
    ...statistical,
    rating: rawFinal,
    zFinal,
    finalRating,
    evidence: {
      decided_by: decidedBy,
      statistical_raw_rating: statRaw,
      statistical_final_scale: statFinal,
      statistical_z: statistical.zFinal,
      final_scale_rating: finalRating,
      final_raw_rating: rawFinal,
      final_z: zFinal,
      external_weight: weight,
      external_source: external?.source ?? null,
      direct: direct ?? null,
      scouting: scouting ?? null,
      _note: decidedBy === 'statistical'
        ? (scouting?.application === 'evidence_only'
          ? 'スカウティングはevidence_onlyとして保持し、数値決定は統計由来の複数年走力を使用'
          : '外部証拠なし。統計由来の複数年走力を使用')
        : '統計・外部証拠を同じ最終目盛りで統合し、逆変換したzを表示・盗塁・内野安打・守備で共通利用',
    },
    detail: {
      ...statistical.detail,
      z_statistical_before_external: statistical.zFinal,
      z_final: zFinal,
      rating_statistical_raw: statRaw,
      rating_statistical_final_scale: statFinal,
      rating_final_scale: finalRating,
      external_decided_by: decidedBy,
      external_weight: weight,
      external_source: external?.source ?? null,
    },
  };
}

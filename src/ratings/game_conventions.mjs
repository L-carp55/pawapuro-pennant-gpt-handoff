// ゲーム側の約束（Sol仕様 02 §6.6）。
//
// 仕様は「2015年以降のKONAMI実装で野手のパワーGがほぼ使われない」という情報を
// **別管理せよ**と言っている。これはデータから測った能力ではなく、ゲーム側の慣習だから。
//
// したがってここでは:
//   - 査定した値（ratings.power）には一切触らない
//   - 表示用の値（ratings.power_display）を別に作る
//   - 引き上げた場合は理由を残す
// この分離を守らないと、次に較正をやり直した時に「どこまでが実測でどこからが慣習か」が消える。
//
// 適用しないもの（仕様の明記）: 歴史選手・特殊カード・投手。

/** 適用対象かどうか。仕様「歴史選手、特殊カード、投手には自動適用しない」 */
export function appliesToPowerFloor(ctx, cfg) {
  const c = cfg.game_conventions?.power_floor;
  if (!c?.enabled) return false;
  if (ctx.isPitcher) return false;
  if (ctx.isSpecialCard) return false;
  // 「現代NPB野手」の範囲。これより古い年のカードは歴史選手として除外する
  return (ctx.season ?? 0) >= c.min_season;
}

/**
 * パワーの下限を当てる（仕様§6.6）。
 * @returns {{value, floored, reason}} 査定値をそのまま返すか、下限まで引き上げるか
 */
export function applyPowerFloor(power, ctx, cfg) {
  const c = cfg.game_conventions?.power_floor;
  if (power == null || !appliesToPowerFloor(ctx, cfg)) {
    return { value: power, floored: false, reason: null };
  }
  if (power >= c.floor) return { value: power, floored: false, reason: null };
  return {
    value: c.floor,
    floored: true,
    appraised: power,
    reason: `ゲーム側の慣習による下限（${c.min_season}年以降の一軍野手にパワー${c.floor}未満を付けない）。`
      + `査定値そのものは ${power.toFixed(1)} のまま保持する`,
    _spec: '02 §6.6。KONAMI実装由来の校正情報であり、実測した能力ではない',
  };
}

/**
 * カードに表示用の値を足す。査定値は書き換えない。
 * @param {object} ratings カードの ratings
 * @param {object} ctx {season, isPitcher, isSpecialCard}
 */
export function applyGameConventions(ratings, ctx, cfg) {
  const p = applyPowerFloor(ratings.power, ctx, cfg);
  return {
    power_display: p.value,
    adjustments: p.floored
      ? [{ field: 'power', appraised: p.appraised, displayed: p.value, reason: p.reason, spec: p._spec }]
      : [],
  };
}

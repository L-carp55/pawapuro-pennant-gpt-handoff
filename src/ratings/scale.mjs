// 能力値スケールの基礎: アンカー表の双方向補間と、分布ベースの能力値変換。
// アンカーの数値は configs/ratings.json（出典=Sol査定仕様 v2.0）。ここには数値を書かない。

/** アンカー表（x昇順）から x→y を区分線形補間。範囲外は端の傾きで外挿する */
export function interp(points, x) {
  const p = points;
  if (x <= p[0][0]) {
    const [x0, y0] = p[0], [x1, y1] = p[1];
    return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
  }
  const last = p.length - 1;
  if (x >= p[last][0]) {
    const [x0, y0] = p[last - 1], [x1, y1] = p[last];
    return y1 + (x - x1) * (y1 - y0) / (x1 - x0);
  }
  for (let i = 0; i < last; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[i + 1];
    if (x >= x0 && x <= x1) return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
  }
  throw new Error(`interp failed for x=${x}`);
}

/** 逆方向（y→x）。アンカーのyは単調増加である前提 */
export function interpInverse(points, y) {
  const flipped = points.map(([a, b]) => [b, a]);
  for (let i = 1; i < flipped.length; i++) {
    if (flipped[i][0] <= flipped[i - 1][0]) {
      throw new Error(`アンカーのyが単調増加でない: ${JSON.stringify(points)}`);
    }
  }
  return interp(flipped, y);
}

export function clamp(v, cfg) {
  return Math.min(cfg.max, Math.max(cfg.min, v));
}

/**
 * 率の分布から能力値へ。対数を取ってzスコア化し、線形変換する。
 * invert=true は「率が低いほど能力が高い」（三振率など）。
 */
export function rateToRating(rate, dist, spec) {
  if (!(rate > 0)) rate = dist.floor;
  const z = (Math.log(rate) - dist.meanLog) / dist.sdLog;
  const signed = spec.invert ? -z : z;
  return spec.center + signed * spec.spread;
}

/** rateToRating の逆 */
export function ratingToRate(rating, dist, spec) {
  const signed = (rating - spec.center) / spec.spread;
  const z = spec.invert ? -signed : signed;
  return Math.exp(dist.meanLog + z * dist.sdLog);
}

/** 実データの率の配列から、対数正規の分布パラメータを作る */
export function fitLogDist(rates) {
  const vals = rates.filter(r => r > 0);
  if (!vals.length) throw new Error('分布を作る値が無い');
  const logs = vals.map(Math.log);
  const meanLog = logs.reduce((a, b) => a + b, 0) / logs.length;
  const varLog = logs.reduce((a, b) => a + (b - meanLog) ** 2, 0) / (logs.length - 1);
  return { meanLog, sdLog: Math.sqrt(varLog), n: vals.length, floor: Math.min(...vals) / 2 };
}

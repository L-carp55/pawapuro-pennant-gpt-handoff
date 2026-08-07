// 守備力の新定義を自作エンジンへ接続するための、較正済み応答曲面の補間・逆算層。
//
// 2026-08-07 オーナー判断:
//   守備範囲 = 走力で説明できる分 + 残差、ではない。
//   走力と守備力（反応・一歩目・加速・判断・ルート等）が共同で、
//   その打球をアウトにできる確率を作る。
//
// このファイルは係数を1つも仮置きしない。
// 入力は実データ/エンジン実験で較正した lookup surface のみ。
// surface が未較正・非単調・範囲外なら黙って既定値へ落とさず例外/NULLにする。
//
// surface schema:
// {
//   calibrated: true,
//   axes: {
//     difficulty: [0, ... ,1], // 大きいほど難しい
//     speed: [1,...,100],
//     fielding: [1,...,100]
//   },
//   probabilities[difficultyIndex][speedIndex][fieldingIndex] = P(out)
// }

const finite = Number.isFinite;
const EPS = 1e-9;

const ascending = a => Array.isArray(a) && a.length >= 2
  && a.every(finite) && a.every((x, i) => i === 0 || x > a[i - 1]);

export function validateFieldingResponseSurface(surface, opts = {}) {
  const requireCalibrated = opts.requireCalibrated ?? true;
  if (!surface || typeof surface !== 'object') throw new Error('fielding response surface が無い');
  if (requireCalibrated && surface.calibrated !== true) {
    throw new Error('fielding response surface は未較正。仮係数で守備力を生成しない');
  }
  const d = surface.axes?.difficulty, s = surface.axes?.speed, f = surface.axes?.fielding;
  if (!ascending(d) || !ascending(s) || !ascending(f)) {
    throw new Error('fielding response surface の3軸は2点以上・有限・狭義昇順で必要');
  }
  const p = surface.probabilities;
  if (!Array.isArray(p) || p.length !== d.length) throw new Error('difficulty次元が軸と不一致');
  for (let di = 0; di < d.length; di++) {
    if (!Array.isArray(p[di]) || p[di].length !== s.length) throw new Error(`speed次元が軸と不一致: d=${di}`);
    for (let si = 0; si < s.length; si++) {
      if (!Array.isArray(p[di][si]) || p[di][si].length !== f.length) throw new Error(`fielding次元が軸と不一致: d=${di},s=${si}`);
      for (let fi = 0; fi < f.length; fi++) {
        const v = p[di][si][fi];
        if (!finite(v) || v < 0 || v > 1) throw new Error(`アウト確率が不正: ${v}`);
        // 同じ難度・走力なら守備力が高いほど悪化してはいけない。
        if (fi > 0 && v + EPS < p[di][si][fi - 1]) {
          throw new Error(`守備力に対して非単調: d=${di},s=${si},f=${fi}`);
        }
        // 同じ難度・守備力なら走力が高いほど悪化してはいけない。
        if (si > 0 && v + EPS < p[di][si - 1][fi]) {
          throw new Error(`走力に対して非単調: d=${di},s=${si},f=${fi}`);
        }
        // difficultyは大きいほど難しいので、同じ能力なら成功率が上がってはいけない。
        if (di > 0 && v > p[di - 1][si][fi] + EPS) {
          throw new Error(`難易度に対して非単調: d=${di},s=${si},f=${fi}`);
        }
      }
    }
  }
  return true;
}

function bracket(axis, x, name) {
  if (!finite(x)) throw new Error(`${name} が有限値でない`);
  if (x < axis[0] - EPS || x > axis.at(-1) + EPS) {
    throw new RangeError(`${name}=${x} は較正範囲[${axis[0]}, ${axis.at(-1)}]外。外挿しない`);
  }
  if (x <= axis[0]) return [0, 0, 0];
  if (x >= axis.at(-1)) { const i = axis.length - 1; return [i, i, 0]; }
  let hi = 1;
  while (axis[hi] < x) hi++;
  const lo = hi - 1;
  return [lo, hi, (x - axis[lo]) / (axis[hi] - axis[lo])];
}
const mix = (a, b, t) => a + (b - a) * t;

/**
 * 較正済み3次元lookup tableを三線形補間する。
 * 係数や能力効果の形はここでは決めない。surfaceそのものが唯一の実証結果。
 */
export function fieldingOutProbability(input, surface) {
  validateFieldingResponseSurface(surface);
  const [d0, d1, td] = bracket(surface.axes.difficulty, input.difficulty, 'difficulty');
  const [s0, s1, ts] = bracket(surface.axes.speed, input.speed, 'speed');
  const [f0, f1, tf] = bracket(surface.axes.fielding, input.fielding, 'fielding');
  const P = surface.probabilities;

  const atD = di => {
    const atS = si => mix(P[di][si][f0], P[di][si][f1], tf);
    return mix(atS(s0), atS(s1), ts);
  };
  return mix(atD(d0), atD(d1), td);
}

/**
 * 現実のアウト確率・既知の走力・打球難度から、必要な守備力を逆算する。
 * targetがsurfaceで表現できない場合はnull。端へ押し込めて偽の1/100を作らない。
 */
export function invertFieldingRating({ targetProbability, difficulty, speed }, surface, opts = {}) {
  validateFieldingResponseSurface(surface);
  if (!finite(targetProbability) || targetProbability < 0 || targetProbability > 1) {
    throw new Error('targetProbabilityは0〜1');
  }
  const loAxis = surface.axes.fielding[0], hiAxis = surface.axes.fielding.at(-1);
  const pLo = fieldingOutProbability({ difficulty, speed, fielding: loAxis }, surface);
  const pHi = fieldingOutProbability({ difficulty, speed, fielding: hiAxis }, surface);
  if (targetProbability < pLo - EPS || targetProbability > pHi + EPS) return null;
  if (Math.abs(targetProbability - pLo) <= EPS) return loAxis;
  if (Math.abs(targetProbability - pHi) <= EPS) return hiAxis;

  let lo = loAxis, hi = hiAxis;
  const iterations = opts.iterations ?? 50;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const p = fieldingOutProbability({ difficulty, speed, fielding: mid }, surface);
    if (p < targetProbability) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

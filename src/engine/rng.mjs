// 種固定の擬似乱数（mulberry32）。同じ種なら常に同じシーズンが再現される。
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.pick = (probs) => {
    // probs: [[key, p], ...] 合計1想定。合計ズレは最後の要素で吸収する
    const r = next();
    let acc = 0;
    for (let i = 0; i < probs.length; i++) {
      acc += probs[i][1];
      if (r < acc) return probs[i][0];
    }
    return probs[probs.length - 1][0];
  };
  next.chance = (p) => next() < p;
  return next;
}

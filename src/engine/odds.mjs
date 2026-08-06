// 打者と投手の対戦結果を、両者のリーグ平均からの傑出度で合成する（Odds Ratio Method / log5の多項版）
// p_matchup(c) ∝ p_batter(c) * p_pitcher(c) / p_league(c)
// 出典的背景: Tango の Odds Ratio Method。野球シミュレーションでの標準手法。

export const OUTCOMES = ['BB', 'HBP', 'SO', 'B1', 'B2', 'B3', 'HR', 'OUT'];

/** 実成績の生カウントから打席あたりの結果確率ベクトルを作る */
export function rateVectorFromCounts(c) {
  const pa = c.PA;
  if (!pa || pa <= 0) return null;
  const known = c.BB + c.HBP + c.SO + c.B1 + c.B2 + c.B3 + c.HR;
  const out = pa - known; // インプレーのアウト（犠打・犠飛・併殺を含む）
  if (out < 0) return null;
  return {
    BB: c.BB / pa, HBP: c.HBP / pa, SO: c.SO / pa,
    B1: c.B1 / pa, B2: c.B2 / pa, B3: c.B3 / pa, HR: c.HR / pa,
    OUT: out / pa,
  };
}

const EPS = 1e-9;

/**
 * 対戦確率を合成する。
 * @param {object} bat 打者の確率ベクトル
 * @param {object} pit 投手の確率ベクトル
 * @param {object} lg  リーグ平均の確率ベクトル
 * @param {object} [mods] カテゴリ別の乗数（守備力などの外部要因。既定は等倍）
 */
export function combine(bat, pit, lg, mods = null) {
  const raw = {};
  let sum = 0;
  for (const c of OUTCOMES) {
    const l = Math.max(lg[c], EPS);
    let v = (Math.max(bat[c], 0) * Math.max(pit[c], 0)) / l;
    if (mods && mods[c] != null) v *= mods[c];
    raw[c] = v;
    sum += v;
  }
  if (sum <= 0) return { ...lg };
  const out = {};
  for (const c of OUTCOMES) out[c] = raw[c] / sum;
  return out;
}

/** rng.pick に渡す形へ */
export function toPickTable(probs) {
  return OUTCOMES.map(c => [c, probs[c]]);
}

/**
 * 合成の分母（基準）を、実際に登板する投手陣の使用量重み付き平均から作る。
 *
 * Odds Ratio法の p_bat * p_pit / p_lg という式で、p_lg は「その打者が対戦する母集団の平均」
 * を意味する。ここに打者側のリーグ平均を入れると、投手プールの平均がそれと一致しない分だけ
 * シミュレーション全体が系統的にずれる。
 *
 * 実測（2024年）: 出場条件を満たす投手プールの被安打率は打者リーグ平均の0.974倍
 * （四球は0.943倍）。登板機会の少ない弱い投手がプールから外れるため、プールは平均より強い。
 * この不一致を放置すると打率乖離-4.97%、揃えると-1.30%（2026-08-04実測）。
 *
 * @param {Array<{rates:object, weight:number}>} pitchers 投手と、その使用量（対戦打者数など）
 */
export function poolBaseline(pitchers) {
  const acc = {};
  for (const c of OUTCOMES) acc[c] = 0;
  let totalWeight = 0;
  for (const { rates, weight } of pitchers) {
    if (!rates || !(weight > 0)) continue;
    for (const c of OUTCOMES) acc[c] += rates[c] * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) return null;
  const out = {};
  for (const c of OUTCOMES) out[c] = acc[c] / totalWeight;
  return out;
}

/**
 * 打球中間層を通した対戦解決（Sol仕様 02 §7・§5.4、05 §6-§7）。
 *
 * 直結版 combine() との違い:
 *   直結: 打者と投手の「結果の確率」を直接合成する
 *   本版: まず三振・四死球を決め、残りのインプレーを「打球の性質」に落としてから結果へ変換する
 *
 * これにより能力どうしの相互作用が式から生じる。
 * 例: パワーは外野フライを本塁打(.089)にも二塁打(.149)にも変えるので、打率にも波及する。
 *
 * @param {object} bat 打者 {rates, battedBall:{gb,ld,offb,iffb}, mods:{hrPerFly,gbSingle,xbhBoost}}
 * @param {object} pit 投手 {rates, battedBall:{gb,ld,offb,iffb,hrPerFly}}
 * @param {object} lg  リーグ平均 {rates, battedBall}
 * @param {object} coef 打球タイプ別の結果確率
 */
export function combineViaBattedBall(bat, pit, lg, coef, inplayOutcomes) {
  // 第1段: 打席を「三振 / 四球 / 死球 / インプレー」に分ける
  const gate = combine(bat.rates, pit.rates, lg.rates);
  const inplayShare = gate.B1 + gate.B2 + gate.B3 + gate.HR + gate.OUT;
  if (!(inplayShare > 0)) return gate;

  // 第2段: インプレーの打球構成を、打者と投手の傾向から合成する
  const mix = (k) => {
    const b = bat.battedBall?.[k], p = pit.battedBall?.[k], l = lg.battedBall?.[k];
    if (b == null || p == null || l == null || l <= 0) return l ?? 0;
    return (b * p) / l; // Odds Ratio と同じ考え方
  };
  const raw = { gb: mix('gb'), ld: mix('ld'), offb: mix('offb'), iffb: mix('iffb') };
  const sum = raw.gb + raw.ld + raw.offb + raw.iffb;
  const shares = sum > 0
    ? { gb: raw.gb / sum, ld: raw.ld / sum, offb: raw.offb / sum, iffb: raw.iffb / sum }
    : lg.battedBall;

  // 第3段: 打球の性質を結果へ。能力による調整（パワー・走力）はここで効く
  const mods = { ...bat.mods };
  if (pit.battedBall?.hrPerFly != null && lg.battedBall?.hrPerFly > 0) {
    // 投手の被本塁打傾向も外野フライの本塁打率に掛かる
    mods.hrPerFly = (mods.hrPerFly ?? 1) * (pit.battedBall.hrPerFly / lg.battedBall.hrPerFly);
  }
  const o = inplayOutcomes(shares, coef, mods);

  // 第4段: インプレーの取り分を按分して打席結果へ戻す
  return {
    BB: gate.BB, HBP: gate.HBP, SO: gate.SO,
    B1: inplayShare * o.B1, B2: inplayShare * o.B2, B3: inplayShare * o.B3,
    HR: inplayShare * o.HR, OUT: inplayShare * o.OUT,
  };
}

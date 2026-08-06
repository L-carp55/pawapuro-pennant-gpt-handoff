// 打球の中間層（Sol仕様 02 §7 弾道、§5.4・05 §6 相互作用、05 §7 内野安打）
//
//   能力 ──→ 打球の性質 ──→ 打席結果
//
// この経路を通すことで、能力どうしの相互作用が「補正項を書かずに」成立する:
//   パワーが高い → 外野フライが本塁打(.089)にも二塁打(.149)にもなる → 打率にも効く
//   走力が高い   → ゴロの単打率(.297)が上がる → 打率に効き、内野安打として分離できる
//   弾道         → ゴロ/ライナー/フライの構成比そのもの
//
// 係数は実データから推定（scripts/calibrate_batted_ball.mjs、542選手シーズン）。
// 物理的にありえない組み合わせ（ゴロの本塁打など）は構造制約で0に固定してある。

/**
 * 打球タイプ別の結果確率から、打者の打席結果分布を作る。
 * @param {object} shares {gb, ld, offb, iffb} 打球タイプの構成比（合計1）
 * @param {object} coef outputs/batted_ball_coefficients.json の coefficients
 * @param {object} mods 能力による調整 {hrPerFly, gbSingle, xbhBoost}
 *   hrPerFly: 外野フライが本塁打になる率の倍率（パワー由来。実測のHR/FB%に対応）
 *   gbSingle: ゴロが単打になる率の倍率（走力由来）
 *   xbhBoost: 長打（二塁打）の倍率（パワー由来）
 */
export function inplayOutcomes(shares, coef, mods = {}) {
  const T = ['gb', 'ld', 'offb', 'iffb'];
  const s = [shares.gb, shares.ld, shares.offb, shares.iffb];
  const m = { hrPerFly: 1, gbSingle: 1, xbhBoost: 1, ...mods };

  const pick = (outcome, tIdx) => coef[outcome][tIdx];

  // 各打球タイプごとに、能力の効果を掛けてから合成する
  let b1 = 0, b2 = 0, b3 = 0, hr = 0;
  for (let i = 0; i < 4; i++) {
    const share = s[i];
    if (!(share > 0)) continue;
    const isGb = T[i] === 'gb';
    const isFly = T[i] === 'offb';

    let pHr = pick('hr', i) * (isFly ? m.hrPerFly : 1);
    let p1 = pick('b1', i) * (isGb ? m.gbSingle : 1);
    let p2 = pick('b2', i) * (isFly ? m.xbhBoost : 1);
    let p3 = pick('b3', i) * (isGb ? m.gbSingle : 1); // 三塁打の多くはゴロ由来（脚力）

    // 本塁打が増えた分はその打球タイプのアウトから引く（合計を1に保つ）
    const sum = p1 + p2 + p3 + pHr;
    if (sum > 1) { const k = 1 / sum; p1 *= k; p2 *= k; p3 *= k; pHr *= k; }

    b1 += share * p1; b2 += share * p2; b3 += share * p3; hr += share * pHr;
  }
  const out = Math.max(0, 1 - b1 - b2 - b3 - hr);
  return { B1: b1, B2: b2, B3: b3, HR: hr, OUT: out };
}

/**
 * 係数をその年のリーグ実測へ合わせる。
 *
 * 打球タイプ別の結果確率は選手間の相対関係を捉えるが、水準は年によって動く
 * （本塁打の出やすさは2019年と2024年で1.7倍違う）。
 * 全員リーグ平均で回した時にその年のリーグ実測が再現されるよう、カテゴリごとにスケールする。
 *
 * @param {object} coef 基準の係数
 * @param {object} lgShares その年のリーグ平均の打球構成 {gb,ld,offb,iffb}
 * @param {object} lgActual その年のリーグ実測（インプレー打球あたり）{b1,b2,b3,hr}
 */
export function calibrateToSeason(coef, lgShares, lgActual) {
  const s = [lgShares.gb, lgShares.ld, lgShares.offb, lgShares.iffb];
  const out = {};
  const scales = {};
  for (const o of ['b1', 'b2', 'b3', 'hr']) {
    const pred = s.reduce((a, sh, i) => a + sh * coef[o][i], 0);
    const k = pred > 0 && lgActual[o] > 0 ? lgActual[o] / pred : 1;
    scales[o] = k;
    out[o] = coef[o].map(v => v * k);
  }
  out.out = [0, 1, 2, 3].map(i => Math.max(0, 1 - out.b1[i] - out.b2[i] - out.b3[i] - out.hr[i]));
  out._scales = scales;
  return out;
}

/**
 * 弾道（1-4）から打球タイプ構成比を作る（Sol仕様 §7）。
 * 弾道が上がるほどフライ寄り、下がるほどゴロ寄り。
 * ライナー比率はミートで動かす（芯を食う頻度）。
 */
export function sharesFromTrajectory(trajectory, meetRating, cfg) {
  const t = cfg.trajectory;
  const idx = Math.min(4, Math.max(1, trajectory)) - 1;
  const base = t.shares_by_trajectory[idx];
  // ミートが高いほどライナーが増え、その分ゴロと内野フライが減る
  const ldBoost = (meetRating - t.meet_center) / t.meet_scale * t.ld_per_meet;
  const ld = Math.max(0.02, base.ld + ldBoost);
  const rest = 1 - ld;
  const restBase = base.gb + base.offb + base.iffb;
  return {
    ld,
    gb: rest * (base.gb / restBase),
    offb: rest * (base.offb / restBase),
    iffb: rest * (base.iffb / restBase),
  };
}

/** 逆算: 実測の打球タイプ構成から弾道を推定する（2020年以降のみ可能） */
export function trajectoryFromShares(shares, cfg) {
  const t = cfg.trajectory;
  // フライ比率（外野フライ＋内野フライ）とゴロ比率の差で判定
  const flyMinusGb = (shares.offb + shares.iffb) - shares.gb;
  for (let i = t.shares_by_trajectory.length - 1; i >= 0; i--) {
    const b = t.shares_by_trajectory[i];
    if (flyMinusGb >= (b.offb + b.iffb) - b.gb - t.boundary_margin) return i + 1;
  }
  return 1;
}

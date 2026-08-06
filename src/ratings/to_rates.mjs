// エンジン側: 能力値 → 打席結果の確率ベクトル
// from_rates.mjs の逆。この2つが表裏一体であることが本プロジェクトの核（設計書 §1）。
import { interpInverse, ratingToRate } from './scale.mjs';

/**
 * 能力値から打席結果の確率ベクトルを作る。
 *
 * 設計: ミートは打率を、パワーは本塁打率を、コンタクトは三振率を、選球眼は四球率を
 * それぞれ独立に決める。インプレー安打率(BABIP相当)は、打率という制約から逆算する。
 * これにより循環が生じず、from_rates との往復が保証される。
 *
 * @param {object} r 能力値 {meet, power, contact, eye}
 * @param {object} cfg configs/ratings.json
 * @param {object} dists {contact, eye} 分布パラメータ
 * @param {object} ctx {hbpRate, sacRate, hitSplit} 能力に依存しない要素
 */
/**
 * 基準年（2019年）換算の本塁打本数を、対象年の環境へ引き戻す。
 *
 * 査定側は `本数_基準 = 本数_実測 × (基準年率 / 対象年率)^gamma` で正規化しており、
 * この **gamma は「実測の本数」で決まる**（水準別gamma。強打者ほど環境に流されない）。
 * 戻す時に基準年換算の本数でgammaを引くと、査定が使ったgammaと別の値になる——
 * 2024年は基準年よりHRが出にくいので基準年換算は約1.7倍に膨らんでおり、
 * その水準でgammaを引くと小さすぎる値になって引き戻しが足りない（実測+14.4%）。
 *
 * 戻したい値がgammaの引数でもあるので、**正規化の式を数値的に逆に解く**。
 * gammaへ単調性の下限を入れた（configs `_monotonicity_adjustment`）ことで正規化が
 * 単調増加になったので、**二分探索で一意に解ける**。
 * 逐次代入でも近い値は出るが上位帯で取りこぼしが残った（35本が34.72本に戻るなど）。
 */
export function deEnvHomeRuns(hrRef, env) {
  if (!env || env.hrRatio == null) return hrRef * (env?.deEnvHr ?? 1);
  const g = env.gammaForLevel;
  if (!g) return hrRef * env.hrRatio;
  const R = 1 / env.hrRatio;                 // 基準年へ持ち上げる側の比
  const fwd = (obs) => obs * Math.pow(R, g(obs)); // 査定がやっている正規化
  // 解を挟む区間を作る。正規化は単調増加なので必ず挟める
  let lo = 0, hi = Math.max(hrRef, 1);
  for (let i = 0; i < 60 && fwd(hi) < hrRef; i++) hi *= 2;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (fwd(mid) < hrRef) lo = mid; else hi = mid;
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}

export function ratesFromRatings(r, cfg, dists, ctx, env = null) {
  // アンカー表は [観測値, 能力値] の順。エンジンは 能力値→観測値 なので interpInverse（逆方向）
  //
  // ★ここで得られる値は**基準年（2019年NPB）の環境での成績**である。
  // 査定側が `rate_env = rate_player × (rate_ref / rate_lg_year)^gamma` で正規化しているため。
  // 別の年のシーズンを回すなら、その年の環境へ引き戻さないと年代の打高打低がそのまま誤差になる
  // （2024年は2019年よりHRが出にくく、戻さないと本塁打が1.63倍出る＝2026-08-04にPhase 3で実測）。
  const targetAvg = interpInverse(cfg.meet_anchors.points, r.meet) * (env?.deEnvAvg ?? 1);
  // 本塁打の環境補正は**水準別gamma**（強打者ほど環境に流されない。2026-08-01に分位点回帰で実測）。
  // 戻しも同じ水準別gammaを使わないと、強打者を過剰に引き下げる（単一gammaで戻して-14%になった）
  const hrRef500 = interpInverse(cfg.power_anchors.points, r.power);
  const hrPer500 = deEnvHomeRuns(hrRef500, env);
  const hrPerAb = hrPer500 / cfg.ab_ref.value;

  const soRate = ratingToRate(r.contact, dists.contact, cfg.zscore_ratings.contact);
  const bbRate = ratingToRate(r.eye, dists.eye, cfg.zscore_ratings.eye);
  const hbpRate = ctx.hbpRate;
  const sacRate = ctx.sacRate ?? 0;

  // 打数の割合: PA から四球・死球・犠打犠飛を引いた残り
  const abShare = 1 - bbRate - hbpRate - sacRate;
  if (abShare <= 0) return null;

  const hrRate = hrPerAb * abShare;          // 対打席
  const hitRate = targetAvg * abShare;        // 対打席の安打率
  const inplayHit = hitRate - hrRate;         // 本塁打以外の安打
  const inplayPa = abShare - soRate - hrRate; // インプレーになる打席の割合
  if (inplayPa <= 0 || inplayHit < 0) return null;

  // 安打の内訳: 単打・二塁打・三塁打へ分配（既定はリーグ平均の比。将来は走力・パワーで動かす）
  const sp = ctx.hitSplit;
  const b2 = inplayHit * sp.B2;
  const b3 = inplayHit * sp.B3;
  const b1 = inplayHit - b2 - b3;

  const out = abShare - soRate - hrRate - inplayHit + sacRate; // 犠打犠飛はアウト扱い
  if (out < 0) return null;

  return { BB: bbRate, HBP: hbpRate, SO: soRate, B1: b1, B2: b2, B3: b3, HR: hrRate, OUT: out };
}

/** 確率ベクトルから、査定で使う観測値（打率など）を復元する */
export function observedFromRates(rates, sacRate = 0) {
  const abShare = 1 - rates.BB - rates.HBP - sacRate;
  const h = rates.B1 + rates.B2 + rates.B3 + rates.HR;
  return {
    avg: h / abShare,
    hrPerAb: rates.HR / abShare,
    soRate: rates.SO,
    bbRate: rates.BB,
    hbpRate: rates.HBP,
  };
}

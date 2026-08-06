// 査定: 実成績 → 能力値
// Sol仕様の4層分離のうち「補正成績 → 平均得能込み基準」に相当する部分。
// 環境補正・小サンプル縮小（経験ベイズ）は Phase 3b で前段に入れる。
import { interp, rateToRating, clamp } from './scale.mjs';
import { shrink } from './shrinkage.mjs';

/**
 * 年度・リーグ環境の補正（Sol仕様 02 §4 / 03 §5.2）。
 * 基準年のリーグ率と当該年のリーグ率の比を gamma 乗して掛ける。
 * env=null なら補正しない（同一年内での相対比較など）。
 */
export function applyEnvironment(rate, lgRate, refRate, gamma) {
  if (!(lgRate > 0) || !(refRate > 0)) return rate;
  return rate * Math.pow(refRate / lgRate, gamma);
}

/**
 * 本塁打の水準に応じた環境追随度（gamma）を返す。
 *
 * 実測（2006-2025の20シーズン、各年の分位点をリーグ本塁打率に回帰）:
 *   中央値 gamma=1.106 / 上位20% 1.104 / 上位10% 0.927 / 上位5% 0.626 / 上位1% 0.118
 *   上位5%と中央値の差は t=3.08 で有意。**ボールが変わっても本塁打王クラスの本数は大きく変わらない**。
 *
 * @param {number} hrPerRefAb 補正前の換算本塁打（基準打数あたり）
 */
export function gammaForLevel(hrPerRefAb, cfg) {
  const g = cfg.environment._gamma_by_level;
  if (!g?.enabled || !g.points?.length) return cfg.environment.gamma_hr;
  const pts = g.points;
  if (hrPerRefAb <= pts[0][0]) return pts[0][1];
  if (hrPerRefAb >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (hrPerRefAb >= x0 && hrPerRefAb <= x1) {
      return y0 + (hrPerRefAb - x0) * (y1 - y0) / (x1 - x0);
    }
  }
  return cfg.environment.gamma_hr;
}

/**
 * その選手が実際に立った球場の構成から、球場係数を1つに束ねる（仕様02 §4「× ParkFactor」）。
 *
 * なぜ要るか（2026-08-05、T-0103の修理）:
 *   仕様は環境補正を「年度比 × 球場 × リーグ」の掛け算と定めているのに、
 *   実装は年度比だけで、球場が丸ごと落ちていた。球場の差は年度差より大きい——
 *   実測（2023-2025、同一打者内の比）で本塁打は神宮1.99 / 甲子園0.65 / バンテリン0.64。
 *   本拠地が甲子園の打者は、同じ打力でも本塁打が3分の2になる。
 *
 * 束ね方: 打数で加重平均する。半分を係数0.65の球場で打っていれば、その分だけ効かせる。
 *   係数の無い球場（測定対象外・地方球場）は**1.0で埋めず、加重の分母からも外す**
 *   （仕様03 §1.3「欠損を0で埋めない」。1.0で埋めると「平均的な球場だった」と嘘をつくため）。
 *
 * @param {Array|null} parkRows loadSplits の park（[{park, AB, ...}]）
 * @param {object|null} factors outputs/derived/park_factors.json の hr または avg
 * @returns {null|{factor, coveredAB, totalAB, coverage, parks}}
 */
export function playerParkFactor(parkRows, factors, aliases = null) {
  if (!Array.isArray(parkRows) || !parkRows.length || !factors?.parks) return null;
  // 球場名の表記ゆれと改称を吸収する。揃えないと係数が引けず、その球場ぶんが
  // 黙って分母から落ちる（＝補正が弱く出る）。実害は2つあった（2026-08-05）:
  //   表記ゆれ … 自前の実測は「エスコンＦ」（全角F）、1球データは「エスコンF」（半角）
  //   改称    … 係数は現在の呼称、1球データは当時の呼称
  //             （柳田2020の「PayPayドーム」と係数側の「みずほPayPay」が一致せず補正が全く効かなかった）
  // 改称の対応表は configs/park_aliases.json（移転＝別の建物は混ぜない、と明記してある）。
  const key = s => String(s ?? '').replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[\s　]/g, '');
  const toCanon = new Map();
  for (const a of aliases?.aliases ?? []) {
    for (const n of [a.canonical, ...(a.also ?? [])]) toCanon.set(key(n), key(a.canonical));
  }
  const canon = s => toCanon.get(key(s)) ?? key(s);
  const table = new Map();
  for (const [k, v] of Object.entries(factors.parks)) table.set(canon(k), v);

  let wSum = 0, abSum = 0, totalAB = 0;
  const used = [], unmatched = [];
  for (const r of parkRows) {
    const ab = r.AB ?? 0;
    if (!(ab > 0)) continue;
    totalAB += ab;
    const f = table.get(canon(r.park))?.factor;
    if (!(f > 0)) {              // 係数の無い球場は分母からも外す
      unmatched.push({ park: r.park, ab });
      continue;
    }
    wSum += f * ab; abSum += ab;
    used.push({ park: r.park, ab, factor: f });
  }
  if (!(abSum > 0)) return null;
  return {
    factor: wSum / abSum,
    coveredAB: abSum, totalAB,
    coverage: abSum / totalAB,
    parks: used.sort((a, b) => b.ab - a.ab),
    // 係数が引けなかった球場（地方開催が大半。表記ゆれの取りこぼしをここで見つける）
    unmatchedParks: unmatched.sort((a, b) => b.ab - a.ab),
  };
}

/**
 * パワー入力の混合（Sol仕様 02 §6.4「本塁打だけで決めない」）。
 * 本塁打が少ない選手ほど、ISO（三塁打を二塁打扱い）由来の推定に寄せる。
 * 査定の前処理であり、核の可逆変換（能力⇔確率）の外に置く（縮小と同じ位置づけ）。
 * @returns 環境補正前の実効本塁打率（呼び出し側で環境補正をかける）
 */
export function blendedHrRate(line, cfg) {
  const { AB, B2, B3, HR } = line;
  const bl = cfg.power_iso_blend;
  if (!bl || B2 == null || B3 == null) return HR / AB;
  const iso2 = (B2 + B3 + 3 * HR) / AB; // 三塁打は脚力寄与が大きいので二塁打相当
  const isoEst = iso2 > 0 ? bl.iso_to_hr_rate.a * Math.pow(iso2, bl.iso_to_hr_rate.b) : 0;
  const w = HR / (HR + bl.K);
  return w * (HR / AB) + (1 - w) * isoEst;
}

/**
 * @param {object} line 実成績（1年分の生カウント）
 *   {PA, AB, H, B2, B3, HR, BB, HBP, SO, SH, SF}
 * @param {object} cfg configs/ratings.json
 * @param {object} dists {contact, eye} 各能力の分布パラメータ（fitLogDistの出力）
 * @param {object|null} env 環境補正の材料 {lgAvg, lgHrRate, refAvg, refHrRate}
 * @param {object} opts
 *   useIsoBlend:boolean 既定true。核の往復テストではfalseにする
 *   contextAvg:{avg, AB, tier, lgAvg}|null
 *     ミートの基準にする文脈の打率（仕様02 §5.1「対右投手×非得点圏」）。
 *     渡されたらこちらを H/AB の代わりに使う。**lgAvg も同じ文脈のものを必ず添える**
 *     ——選手側だけ対右にしてリーグ側を総合のままにすると、環境補正が
 *     「対右の打率を総合のリーグ平均で割る」形になり仕様02 §92「文脈を一致させる」を破る。
 *     縮小の重み（AB）も文脈の打数を使う。パワーは分割の長打データが揃わないので総合のまま。
 */
export function appraiseBatting(line, cfg, dists, env = null, opts = { useIsoBlend: true }) {
  const { PA, AB, H, HR, BB, HBP, SO } = line;
  if (!(PA > 0) || !(AB > 0)) return null;

  // 文脈打率を使うかどうか。使う場合は打率とリーグ平均と打数の3つを揃えて差し替える
  const ctx = opts.contextAvg;
  const useCtx = !!(ctx && ctx.avg != null && ctx.AB > 0 && ctx.lgAvg > 0);
  const avgAB = useCtx ? ctx.AB : AB;

  // --- 第1層「補正成績」: 環境補正 → 経験ベイズ縮小 ---
  let avg = useCtx ? ctx.avg : H / AB;
  let hrPerAb = opts.useIsoBlend ? blendedHrRate(line, cfg) : HR / AB;
  let gammaUsed = null;
  if (env) {
    // 打率のリーグ平均は選手側と同じ文脈のものを使う（総合の打率なら総合の平均、対右なら対右の平均）
    // ★2026-08-05 オーナー指摘で発見・修理: 文脈打率（対右投手）を使っているのに、
    //   比べる相手の片方だけが総合打率だった。
    //     対象年のリーグ平均 = 対右投手（.2465）／ 基準年(2019)のリーグ平均 = **総合**（.2521）
    //   分子と分母で母集団が違うため、環境の差が実際より小さく見積もられていた。
    //   実測（村上宗隆2024）: 正しく対右どうしで比べると 2019年.2580 / 2024年.2465 で
    //   環境差は3.79%→**4.67%**。基準打率は .222 → .226 と約4厘上がる。
    //   基準年側の文脈平均（ctx.refAvg）が取れる時はそれを使い、無ければ従来どおり総合へ落とす。
    const ctxRefAvg = useCtx && ctx.refAvg > 0 ? ctx.refAvg : env.refAvg;
    avg = applyEnvironment(avg, useCtx ? ctx.lgAvg : env.lgAvg, ctxRefAvg, cfg.environment.gamma_avg);
    // 本塁打は水準によって環境追随度が違う（強打者ほど流されない）ので、補正前の水準でgammaを選ぶ
    gammaUsed = gammaForLevel(hrPerAb * cfg.ab_ref.value, cfg);
    hrPerAb = applyEnvironment(hrPerAb, env.lgHrRate, env.refHrRate, gammaUsed);
  }

  // 球場補正（仕様02 §4「× ParkFactor」、2026-08-05 T-0103で接続）。
  // 打ちにくい球場（甲子園0.65）で打った本塁打は、その分だけ割り増して評価する。
  // リーグ平均側は全球団が全球場を回るので係数の加重平均がほぼ1になり、割る必要が無い。
  let parkApplied = null;
  if (opts.parkFactor?.factor > 0 && opts.parkFactor.coverage >= (cfg.environment?.park_min_coverage ?? 0.5)) {
    hrPerAb = hrPerAb / opts.parkFactor.factor;
    parkApplied = opts.parkFactor;
  }
  const preShrink = { avg, hrPerAb };
  let kappaUsed = null;
  if (opts.prior) {
    const sh = cfg.shrinkage;
    // ★2026-08-05 オーナー指示で全面変更:
    //   「基本的にはその年だけで査定してください。過去の実績から補正が入るのは
    //     成績が明らかに下振れたときとけがなどであまり出られなかったときだけです」
    //   「翌年再現性は一年ごとの能力を査定するのに完全に不要です」
    //
    //   従来は全選手に一律 kappa=300（翌年予測の誤差を最小にする値）を当てていたため、
    //   フル出場の選手でも本人の過去実績が4割前後混ざっていた。年度ごとの査定としては
    //   これは誤り——その年に十分出場した選手は、その年の成績がその年の能力を表す。
    //
    //   新しい形: kappa = max(0, 十分な出場とみなす打数 − その年の打数)
    //     十分に出場した（規定打席相当）→ kappa=0 → **その年の成績をそのまま使う**
    //     出場が少ない            → 不足分だけ本人の実績へ寄せる（＝けが等で出られなかった場合）
    //   閾値は恣意的に置かず実データから取った（規定打席443に到達した845人年の打数の最小値=359）。
    //
    //   ★出場量の判定は**その年の総打数(AB)**で行う。文脈打率（対右投手のみ）を使っていても
    //   「けがで出られなかったか」は総出場量の話であり、対戦相手の内訳の話ではないため。
    const fullAB = sh.full_season_ab ?? 359;
    const shortfall = Math.max(0, fullAB - AB);
    const kMeet = Math.min(sh.kappa_meet, shortfall);
    const kPower = Math.min(sh.kappa_power, shortfall);
    kappaUsed = { meet: kMeet, power: kPower, shortfall, full_season_ab: fullAB, season_ab: AB };
    // 縮小の重みは、その打率を観測した打数。文脈打率なら文脈の打数を使う
    avg = shrink(avg, avgAB, opts.prior.avg, kMeet);
    hrPerAb = shrink(hrPerAb, AB, opts.prior.hr, kPower);
  }
  const hrPer500 = hrPerAb * cfg.ab_ref.value;
  const soRate = SO / PA;
  const bbRate = BB / PA;

  // アンカー表は [観測値, 能力値] の順。査定は 観測値→能力値 なので interp（順方向）
  const meet = clamp(interp(cfg.meet_anchors.points, avg), cfg.clamp);
  const power = clamp(interp(cfg.power_anchors.points, hrPer500), cfg.clamp);
  const contact = clamp(rateToRating(soRate, dists.contact, cfg.zscore_ratings.contact), cfg.clamp);
  const eye = clamp(rateToRating(bbRate, dists.eye, cfg.zscore_ratings.eye), cfg.clamp);

  return {
    meet: round1(meet),
    power: round1(power),
    contact: round1(contact),
    eye: round1(eye),
    // 逆算の入力になった観測値（往復の検証と、二重計上チェックに使う）
    // avg/hrPer500 は環境補正後の値。raw は補正前
    observed: {
      avg, hrPer500, soRate, bbRate, hbpRate: HBP / PA, PA, AB,
      // ミートの基準にどの文脈を使ったか。null なら総合（Tier C 相当）
      avgContext: useCtx
        ? { tier: ctx.tier ?? null, AB: ctx.AB, rawAvg: ctx.avg, lgAvg: ctx.lgAvg }
        : null,
      raw: { avg: H / AB, hrPer500: (HR / AB) * cfg.ab_ref.value },
      preShrink: { avg: preShrink.avg, hrPer500: preShrink.hrPerAb * cfg.ab_ref.value },
      envApplied: !!env,
      // 球場補正を掛けたか。掛けなかった場合は理由が分かるよう null と被覆率を残す
      parkFactor: parkApplied
        ? {
          factor: parkApplied.factor, coverage: parkApplied.coverage,
          coveredAB: parkApplied.coveredAB, totalAB: parkApplied.totalAB,
          parks: parkApplied.parks,
          // 係数が引けなかった球場（地方開催が大半。表記ゆれの取りこぼしもここに出る）
          unmatchedParks: parkApplied.unmatchedParks ?? null,
        }
        : null,
      parkSkipped: (!parkApplied && opts.parkFactor)
        ? `被覆率${(opts.parkFactor.coverage * 100).toFixed(0)}%が下限未満のため未適用` : null,
      gammaUsed,
      // 縮小の実際の強さ（2026-08-05）。その年に十分出場していれば0＝その年の成績をそのまま使う
      kappaUsed,
      priorKind: opts.prior?.kind ?? null,
      priorBasis: opts.prior?.basis ?? null,
    },
  };
}

const round1 = v => Math.round(v * 10) / 10;

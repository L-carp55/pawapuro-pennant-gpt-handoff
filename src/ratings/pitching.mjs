// 投手の査定（Sol仕様 07 §6「投手モデルで必要な項目」、02 §1.2「投手は別仕様」）
//
// 仕様が定める能力対応:
//   球速     → 速度分布
//   コントロール → BB%、ゾーン%、狙った位置
//   スタミナ   → 先発投球回、球数、球威維持
//   変化量    → Pitch Tracking
//   キレ/奪三振 → Whiff、K%、球種効果
//   得能     → 文脈別・多年度縮小
//
// 実データでの裏付け（2020-2026年 n=1168）:
//   直球球速とK%の相関 r=0.545（球速は奪三振に効く）
//   直球球速とBB%の相関 r=0.175（球速と制球は別能力）
//
// 打者と同じ打球中間層（src/engine/batted_ball.mjs）に接続するため、
// 被打球性質（GB/LD/OFFB/IFFB%）も投手側の能力として保持する。

import { clamp, rateToRating } from './scale.mjs';

/**
 * 投手能力の査定。
 *
 * 役割別に扱うかどうかは指標ごとに違う（2026-07-31 実データで判別）。
 *
 * リーグ全体では 先発 BB%6.9/K%18.3、救援 BB%8.8/K%21.4 と両方に差があるが、
 * 同一選手・同一シーズンで先発と救援の両方を投げた54件を比較すると:
 *   四球率  救援−先発 = +0.36ポイント（t=0.90、有意でない）
 *   奪三振率 救援−先発 = +3.83ポイント（t=5.36、明確に有意）
 *
 * つまりリーグ全体の四球率の差は「役割の効果」ではなく
 * 「制球の悪い投手が救援に回る」という選手構成の差。制球を役割別に標準化すると、
 * 実際に制球の悪い救援投手が『平均的』と評価されてしまう。
 *   → 制球（BB%）は全投手で1つの分布
 *   → 奪三振（K%）は役割別の分布（救援であること自体の効果が実在するため）
 *
 * @param {object} line 投手成績 {IP, TBF, K_pct, BB_pct, GB_pct, HR_FB_pct, OFFB_pct, IFFB_pct, LD_pct}
 * @param {object} pitches 球種別 [{type, velo, pitchPct, swstrPct, whiffPct, cswPct}]
 * @param {object} usage 起用 {games, gamesStarted, ipPerStart}
 * @param {object} dists 役割別の分布 {sp:{kPct,bbPct,ipPerStart}, rp:{kPct,bbPct}, whiffPct}
 */
export function appraisePitching(line, pitches, usage, cfg, dists) {
  const c = cfg.pitcher;
  const isStarter = usage.gamesStarted >= c.stamina.min_starts;
  const roleKey = isStarter ? 'sp' : 'rp';
  const d = dists[roleKey] ?? dists;

  // 信頼度は役割別に測る。救援は元々投球回が少ないので、先発と同じ基準で測ると
  // 一律に中立へ潰れてしまう（仕様 02 §5.2/§6.3 の経験ベイズを役割の文脈に合わせる）
  const kappa = isStarter ? c.kappa_tbf_starter : c.kappa_tbf_reliever;
  const reliability = line.TBF != null ? line.TBF / (line.TBF + kappa) : 0;
  const shrinkToCenter = (rating, center) => rating == null ? null
    : clamp(center + (rating - center) * reliability, cfg.clamp);

  // --- 球速: 直球（FF）の平均球速をそのまま持つ。無ければ最も速い球種 ---
  // 球速は実測値そのものなので縮小しない（成績ではなく計測値）
  const ff = pitches.find(p => p.type === 'FF') ?? [...pitches].sort((a, b) => (b.velo ?? 0) - (a.velo ?? 0))[0];
  const velocity = ff?.velo ?? null;

  // --- 奪三振能力: 役割内での相対位置（救援であること自体が+3.83ポイントの効果を持つため） ---
  const strikeoutRaw = line.K_pct == null ? null
    : clamp(rateToRating(line.K_pct / 100, d.kPct, c.zscore.strikeout), cfg.clamp);
  const strikeout = shrinkToCenter(strikeoutRaw, c.zscore.strikeout.center);

  // --- コントロール: 全投手を1つの分布で測る（役割別にすると制球の悪い救援が平均的と評価されるため） ---
  const bbDist = dists.all?.bbPct ?? d.bbPct;
  const controlRaw = line.BB_pct == null ? null
    : clamp(rateToRating(line.BB_pct / 100, bbDist, c.zscore.control), cfg.clamp);
  const control = shrinkToCenter(controlRaw, c.zscore.control.center);

  // --- スタミナ: 先発は1登板あたり投球回、救援は1登板あたり投球回で別基準（仕様の「先発時スタミナ」を役割別に拡張） ---
  let stamina = null, staminaBasis = null;
  if (isStarter && usage.ipPerStart != null && d.ipPerStart) {
    const staminaRel = usage.gamesStarted / (usage.gamesStarted + c.stamina.kappa_starts);
    const raw = c.zscore.stamina.center
      + ((usage.ipPerStart - d.ipPerStart.mean) / d.ipPerStart.sd) * c.zscore.stamina.spread;
    stamina = clamp(c.zscore.stamina.center + (raw - c.zscore.stamina.center) * staminaRel, cfg.clamp);
    staminaBasis = `先発${usage.gamesStarted}試合・1登板あたり${usage.ipPerStart.toFixed(2)}回（信頼度${staminaRel.toFixed(2)}）`;
  } else {
    staminaBasis = `救援（先発${usage.gamesStarted}試合）。仕様が定めるスタミナは先発時のものなので未判定`;
  }

  // --- 変化球: 球種ごとの空振り率から変化量（1-7）へ ---
  const breaking = pitches
    .filter(p => p.type !== 'FF' && (p.pitchPct ?? 0) >= c.breaking.min_usage_pct)
    .map(p => ({
      type: p.type,
      usagePct: p.pitchPct,
      velo: p.velo,
      // 空振り率が高いほど変化量が大きい
      movement: p.whiffPct == null ? null : clampInt(
        Math.round(c.breaking.base + (p.whiffPct - dists.whiffPct.mean) / dists.whiffPct.sd * c.breaking.per_sd),
        1, 7),
      whiffPct: p.whiffPct,
    }))
    .sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0));

  // --- 被打球性質（打球中間層へ渡す） ---
  const battedBall = {
    gb: line.GB_pct != null ? line.GB_pct / 100 : null,
    ld: line.LD_pct != null ? line.LD_pct / 100 : null,
    offb: line.OFFB_pct != null ? line.OFFB_pct / 100 : null,
    iffb: line.IFFB_pct != null ? line.IFFB_pct / 100 : null,
    hrPerFly: line.HR_FB_pct != null ? line.HR_FB_pct / 100 : null,
  };

  return {
    velocity, strikeout, control, stamina, staminaBasis,
    breaking, battedBall,
    role: isStarter ? 'starter' : 'reliever',
    confidence: { ip: line.IP, tbf: line.TBF, reliability, kappa, roleKey },
    preShrink: { strikeout: strikeoutRaw, control: controlRaw },
  };
}

const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * 投手の能力から打席結果の確率ベクトルを作る（エンジン側）。
 * 打者と同じ形式に揃えることで Odds Ratio 合成に乗る。
 */
export function ratesFromPitching(p, league, cfg, dists) {
  const c = cfg.pitcher;
  const so = p.strikeout == null ? league.SO
    : ratingToRateLocal(p.strikeout, dists.kPct, c.zscore.strikeout);
  const bb = p.control == null ? league.BB
    : ratingToRateLocal(p.control, dists.bbPct, c.zscore.control);
  return { SO: so, BB: bb, HBP: league.HBP, battedBall: p.battedBall };
}

function ratingToRateLocal(rating, dist, spec) {
  const signed = (rating - spec.center) / spec.spread;
  const z = spec.invert ? -signed : signed;
  return Math.exp(dist.meanLog + z * dist.sdLog);
}

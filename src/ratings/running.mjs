// 走力・盗塁・走塁の査定（Sol仕様 04 §1-3、02 §10）
//
// 仕様の核:
//   §1.1 走力＝純粋な脚力。盗塁数・成功率そのものではない
//   §2   盗塁得能＝成功率・企図率の「純粋走力に対する残差」
//   §3   走塁得能＝盗塁とは別（追加進塁・タッチアップ・走塁死）
//
// 実データでの裏付け（scripts/calibrate_speed.mjs、500選手シーズン）:
//   三塁打率・併殺回避・UBRは互いに r=0.30〜0.40 の正相関 → 共通因子（脚力）が実在
//   走力スコアと盗塁成功率の相関は r=0.236 → 走力と盗塁技術は別物（仕様の主張を確認）

import { clamp } from './scale.mjs';

/**
 * 走力の素点（zスコア）を作る。盗塁は入れない（仕様§1.1）。
 * @param {object} line {AB, SO, B3, HR, GDP, PA}
 * @param {object} ctx {gbPct} 打球のゴロ率（無ければリーグ平均で代用）
 * @param {number|null} ubr 走塁貢献（NPB Basement）。無ければnull
 * @param {object} norm 各指標の正規化パラメータ {triple:{mean,sd}, gdpAvoid:{...}, ubr:{...}}
 */
export function speedComponents(line, ctx, ubr, norm) {
  const inplay = Math.max(1, line.AB - line.SO);
  const gbCount = Math.max(1, inplay * ((ctx.gbPct ?? norm.leagueGbPct) / 100));

  const raw = {
    // 三塁打の割合: **場内に残った長打のうち何割が三塁打か**（2026-08-01変更）。
    // 旧「インプレー打球あたりの三塁打率」より脚を測れる——
    // 翌年再現性 0.550→0.695、UBRとの相関 0.336→0.389。
    // 場外へ消えた本塁打の影響を分母から外せるため。二塁打が0の選手は判定しない。
    triple: (line.B2 + line.B3) > 0 ? line.B3 / (line.B2 + line.B3) : null,
    // 旧指標も残す（過去のカードとの比較用。査定には使わない）
    _tripleRateLegacy: line.B3 / Math.max(1, inplay - line.HR),
    // 併殺回避: ゴロあたりの併殺の少なさ（符号反転して「速いほど大きい」に揃える）
    gdpAvoid: -line.GDP / gbCount,
    // 走塁貢献: 打席あたり
    ubr: ubr != null && line.PA > 0 ? ubr / line.PA : null,
  };

  // 内野安打率（仕様04 §1.2 第3階層）。手持ちの材料で最も脚力に近い
  // （UBRとの相関0.410、三塁打率0.329より上）。2026-08-01に追加。
  // 年×打席で標準化する——左打ちは一塁に近いぶん水準が48%高いが、
  // 打席の中だけで見てもUBRとの相関は保たれるので、水準差だけを外す。
  if (ctx.infieldHits != null && ctx.bats != null && norm.infieldHit) {
    raw.infieldHit = ctx.infieldHits / inplay;
  }

  // 自作の走塁指標（2026-08-05 オーナー承認で追加）。
  // 単打で一塁から三塁へ行けたか等を、打球の位置とアウトカウントで難易度を揃えて測ったもの。
  // UBRと同じ「走塁の上手さ」を見るが、相関0.613で4割は別の情報を持ち、
  // 翌年との一致は自作0.527 > UBR0.447。だから置き換えず足す。
  // 1球データのある2020年以降のみ。無い年は null で通る（推定で埋めない）。
  //
  // SP-018是正（2026-08-13、EX-005）: 旧実装は advanceChances<20 を観測値そのもの(raw.advance)の
  // 棄却に使っていた——機会が少ないだけの選手が「情報ゼロ」扱いになっていた。
  // advanceOf()はchances>=1の時だけ非nullを返す（chances=0は数学的に未定義でnullのまま）ため、
  // 観測があれば必ず保持し、信頼度はz計算後にshrinkage(下記)で表す。20という数は
  // 閾値ではなくshrinkageのkappa（reliability=chances/(chances+20)が0.5になる点）として引き継ぐ。
  if (ctx.advance != null) {
    raw.advance = ctx.advance;
  }

  const z = {};
  for (const k of ['triple', 'gdpAvoid', 'ubr', 'advance']) {
    z[k] = raw[k] == null || !norm[k] ? null : (raw[k] - norm[k].mean) / norm[k].sd;
  }
  // SP-018是正: advanceは機会数に応じてreliability=chances/(chances+kappa)でz自体を0へ縮小する
  // （stealingAbility()と同じ経験ベイズ形。固定閾値でnull化しない）。
  if (z.advance != null) {
    const kappa = norm.advance?.shrinkage_kappa ?? norm.advance?.min_chances ?? 20;
    const chances = ctx.advanceChances ?? 0;
    const reliability = chances / (chances + kappa);
    z.advance *= reliability;
  }
  if (raw.infieldHit != null) {
    const n = norm.infieldHit;
    const cell = n.byCell?.[`${ctx.season}|${ctx.bats}`] ?? n.bySeason?.[ctx.season] ?? null;
    z.infieldHit = cell ? (raw.infieldHit - cell.mean) / cell.sd : null;
  }

  // 材料ごとに質が違うので等重みで平均しない。
  // 重みは**各材料の同時点の測定信頼性**（1シーズン内の標本誤差から算出、翌年情報を含まない）。
  // SP-015是正（2026-08-13）: 旧実装は翌年再現性（Year Y→Y+1相関）をそのままweightにしており
  // owner rule違反だった（CLAUDE.md『年度査定の目的関数』、EX-007/EX-008）。
  // 実測値・根拠は configs/running_norms.json `_componentWeights_basis`
  // / docs/audits/sp015_same_time_reliability.md 参照。旧重みは同ファイルの
  // `_componentWeightsLegacyNextYearRepeatability` にlegacy controlとして保持。
  const W = norm.componentWeights
    ?? { triple: 0.496, gdpAvoid: 0.433, infieldHit: 0.533, ubr: 0.496, advance: 0.221 };
  let sum = 0, wsum = 0;
  for (const [k, v] of Object.entries(z)) {
    if (v == null || !Number.isFinite(v)) continue;
    const w = W[k] ?? 0.5;
    sum += v * w; wsum += w;
  }
  const parts = Object.values(z).filter(v => v != null && Number.isFinite(v));
  return { raw, z, weights: W, score: wsum > 0 ? sum / wsum : null, used: parts.length };
}

/** 走力zスコア → 能力値 */
export function speedRating(score, cfg) {
  if (score == null) return null;
  const s = cfg.zscore_ratings.speed;
  return clamp(s.center + score * s.spread, cfg.clamp);
}

/**
 * 盗塁得能（仕様§2「成功率・企図率・純粋走力に対する残差」）。
 *
 * 成功率だけでは「年5回で100%」と「年40回で80%」を区別できないため、
 * 主指標に wSB（盗塁の得点貢献＝成功と失敗の回数が両方入る）を使う。
 * その上で走力で説明できる分を引き、試行数が少ない場合は信頼度で中立へ縮小する。
 *
 * @param {object} line {SB, CS, PA}
 * @param {number|null} wsb 盗塁の得点貢献（NPB Basement）。無ければ成功率で代替
 * @param {number} speedScore 走力のzスコア
 * @param {object} norm {wsbOnSpeed, sbSuccess, attempt}
 */
export function stealingAbility(line, wsb, speedScore, norm, cfg) {
  const attempts = line.SB + line.CS;
  const attemptRate = line.PA > 0 ? attempts / line.PA : 0;
  const attemptZ = norm.attempt ? (attemptRate - norm.attempt.mean) / norm.attempt.sd : null;
  const s = cfg.zscore_ratings.stealing;
  const sc = cfg.stealing;

  // 試行数ゼロは能力を付けない。走力が高いのに走らないのは「慎重」であって下手ではない（仕様§2.1）
  if (attempts === 0) {
    return {
      rating: null, attempts, attemptRate, attemptZ,
      verdict: (speedScore ?? 0) > sc.cautious_speed_threshold ? '慎重（走力はあるが企図なし）' : '判定不能',
      reason: '企図0回',
    };
  }

  let residZ = null, basis = null;
  if (wsb != null && norm.wsbOnSpeed) {
    // 主経路: 得点貢献ベース（成功率と回数の両方が入る）
    const per = wsb / Math.max(1, line.PA);
    const expected = norm.wsbOnSpeed.intercept + norm.wsbOnSpeed.slope * (speedScore ?? 0);
    residZ = (per - expected) / norm.wsbOnSpeed.sd;
    basis = 'wSB';
  } else if (attempts >= sc.min_attempts && norm.sbSuccess) {
    // 代替経路: 成功率ベース（wSBが無い年代）
    const success = line.SB / attempts;
    const expected = norm.sbSuccess.intercept + norm.sbSuccess.slope * (speedScore ?? 0);
    residZ = (success - expected) / norm.sbSuccess.sd;
    basis = '成功率';
  } else {
    return {
      rating: null, attempts, attemptRate, attemptZ,
      verdict: '判定不能', reason: `企図${attempts}回（下限${sc.min_attempts}未満・wSBなし）`,
    };
  }

  // 試行数による信頼度の縮小。少ない試行の残差は偶然を多く含むので中立へ引き戻す
  const reliability = attempts / (attempts + sc.kappa_attempts);
  const shrunk = residZ * reliability;

  return {
    rating: clamp(s.center + shrunk * s.spread, cfg.clamp),
    attempts, attemptRate, attemptZ,
    success: line.SB / attempts,
    residZ, shrunkZ: shrunk, reliability, basis,
    reason: `${basis}基準の残差z=${residZ.toFixed(2)} × 信頼度${reliability.toFixed(2)}（企図${attempts}回）`,
  };
}

/**
 * 走塁得能（仕様§3）。盗塁とは別に、追加進塁・タッチアップ等の貢献を測る。
 * UBRから走力で説明できる分を引いた残差＝走塁判断の巧拙。
 */
export function baserunningAbility(ubrPerPa, speedScore, norm, cfg, opts = {}) {
  const parts = [];

  if (ubrPerPa != null && norm.ubrOnSpeed) {
    const expected = norm.ubrOnSpeed.intercept + norm.ubrOnSpeed.slope * (speedScore ?? 0);
    // SP-015是正（2026-08-13）: 旧実装は norm.ubrOnSpeed.repeatability（翌年再現性）を
    // そのまま合成weightに使っておりowner rule違反だった。この残差の同時点信頼性は未測定のため
    // 恣意的な代替数値を作らず等重み(1)で暫定運用する（sp015監査: legacy vs equal weightの
    // 順位相関r=0.995で実務上の副作用は小さい）。.repeatabilityは削除せずdiagnostic用に保持。
    parts.push({
      name: 'ubr', z: (ubrPerPa - expected) / norm.ubrOnSpeed.sd,
      w: 1, expected,
    });
  }

  // 自作の走塁指標（一塁→三塁など）。仕様04 §3 が走塁得能の材料に名指ししている
  // 「一塁から三塁／二塁から本塁／追加進塁」そのもの（2026-08-05 オーナー指摘で追加）。
  //
  // 走力にも同じ指標を使っているが二重計上ではない——こちらは**走力で説明できる分を引いた残差**。
  // オーナーの例「走力B走塁E より 走力E走塁A の方が三塁到達が速い」は、
  // 脚が遅いのに進塁できている＝残差が大きい、として表れる。
  if (opts.advance != null && norm.advanceOnSpeed) {
    const a = norm.advanceOnSpeed;
    const expected = a.intercept + a.slope * (speedScore ?? 0);
    // SP-015是正: a.repeatability（翌年再現性）を重みに使わず等重み(1)を基準にする。
    // SP-018是正（2026-08-13、EX-005）: opts.advanceChances>=20のハードカットを撤去。
    // 機会が少ないだけで観測値ごと棄却していた分をreliability=chances/(chances+kappa)で
    // weightへ反映する経験ベイズ形へ（stealingAbility()と同じ形）。
    const kappa = norm.advance?.shrinkage_kappa ?? norm.advance?.min_chances ?? 20;
    const chances = opts.advanceChances ?? 0;
    const reliability = chances / (chances + kappa);
    parts.push({
      name: 'advance', z: (opts.advance - expected) / a.sd,
      w: 1 * reliability, expected,
    });
  }

  if (!parts.length) return null;
  let sum = 0, wsum = 0;
  for (const p of parts) { if (!Number.isFinite(p.z)) continue; sum += p.z * p.w; wsum += p.w; }
  if (!(wsum > 0)) return null;
  const residZ = sum / wsum;
  const s = cfg.zscore_ratings.baserunning;
  return {
    rating: clamp(s.center + residZ * s.spread, cfg.clamp),
    residZ, expected: parts[0].expected,
    components: parts.map(p => ({ name: p.name, z: p.z, weight: p.w })),
  };
}

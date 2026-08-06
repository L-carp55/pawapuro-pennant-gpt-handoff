// 全盛期合成カード（Sol仕様 02 §3.2）
//
// 仕様の条文:
//   - 複数年を明示的に合成する
//   - **単一年のラベルを付けない**
//   - **合成式と対象期間を公開する**
//   - 旧 `0.50 Best3 + 0.30 Best1 + 0.20 Best5` は未校正のため **REJECTED**
//
// 旧式が却下された理由は「係数0.50/0.30/0.20の根拠が無い」ことに加え、
// 好成績年だけを飛び飛びに拾うと**上振れの寄せ集め**になる点にある。
// ここでは仕様09 §4.8 の候補のうち "rolling weighted posterior" を採る:
//
//   1. 連続するN年の窓を全位置で試し、得点貢献の合計が最大の窓を選ぶ
//   2. その窓の成績を「1つの大きな標本」として合算する
//      （各年の率を基準年環境へ補正してから、打数で加重平均する）
//
// 重みは**打数のみ**。恣意的な係数はどこにも無い。連続窓なので上振れ年の寄せ集めにもならない。

import { seasonScore } from './season_score.mjs';

/**
 * 全盛期の連続窓を選ぶ。
 *
 * @param {Array} seasons [{season, line, lgRate, runRuns, fldRuns, position, teamGames, envFactors}]
 *   envFactors: {avg, hr} 当該年→基準年への補正倍率
 * @param {object} rv 得点価値
 * @param {object} opts {windowYears=3, mode='total', minPaPerYear=200}
 * @returns {{start, end, seasons, totalScore}|null}
 */
export function selectPrimeWindow(seasons, rv, opts = {}) {
  const W = opts.windowYears ?? 3;
  const mode = opts.mode ?? 'total';
  const minPa = opts.minPaPerYear ?? 200;

  const scored = seasons
    .map(s => ({ ...s, _score: seasonScore({ ...s, rv })[mode] }))
    .sort((a, b) => a.season - b.season);

  let best = null;
  for (let i = 0; i + W <= scored.length; i++) {
    const win = scored.slice(i, i + W);
    // 窓は連続した年でなければならない（間に欠落年があれば不可）
    if (win[W - 1].season - win[0].season !== W - 1) continue;
    // 各年が最低打席を満たすこと（代打専門の年を全盛期に含めない）
    if (win.some(s => s.line.PA < minPa)) continue;
    const total = win.reduce((a, s) => a + s._score, 0);
    if (!best || total > best.totalScore) {
      best = { start: win[0].season, end: win[W - 1].season, seasons: win, totalScore: total };
    }
  }
  return best;
}

/**
 * 窓内の成績を1つの標本へ合算する。
 * 各年の率を基準年環境へ補正してから、打数で重みをつけて足す。
 *
 * @param {Array} win selectPrimeWindow の seasons
 * @returns {object} 合成後の line（appraiseBatting にそのまま渡せる形）
 */
export function compositeLine(win) {
  const out = { PA: 0, AB: 0, H: 0, B2: 0, B3: 0, HR: 0, BB: 0, HBP: 0, SO: 0, SH: 0, SF: 0, GDP: 0, SB: 0, CS: 0 };
  for (const s of win) {
    const L = s.line;
    const fA = s.envFactors?.avg ?? 1;
    const fH = s.envFactors?.hr ?? 1;
    // 安打・本塁打は環境補正をかけてから合算する。他は環境差が小さいのでそのまま足す
    const hrAdj = L.HR * fH;
    const hAdj = L.H * fA;
    out.PA += L.PA; out.AB += L.AB;
    out.H += hAdj;
    out.HR += hrAdj;
    // 単打・二塁打・三塁打は「補正後の安打数」から元の構成比で割り振る（内訳の整合を保つ）
    const b1 = L.H - L.B2 - L.B3 - L.HR;
    const rest = hAdj - hrAdj;
    const restOrig = b1 + L.B2 + L.B3;
    const k = restOrig > 0 ? rest / restOrig : 0;
    out.B2 += L.B2 * k; out.B3 += L.B3 * k;
    out.BB += L.BB; out.HBP += L.HBP ?? 0; out.SO += L.SO;
    out.SH += L.SH ?? 0; out.SF += L.SF ?? 0; out.GDP += L.GDP ?? 0;
    out.SB += L.SB ?? 0; out.CS += L.CS ?? 0;
  }
  // 整数へ丸める（イベント数なので）。合算後にH=1B+2B+3B+HRが保たれるようHを再計算
  for (const k of Object.keys(out)) out[k] = Math.round(out[k]);
  const b1 = out.H - out.B2 - out.B3 - out.HR;
  if (b1 < 0) { out.H = out.B2 + out.B3 + out.HR; } // 丸め誤差で内訳が超えた場合の整合
  return out;
}

/**
 * 全盛期合成カードを作る。
 * @returns {{cardType, seasonLabel, seasonsUsed, period, formula, line, perSeason}}
 *   seasonLabel は **必ず null**（仕様「単一年のラベルを付けない」の構造的保証）
 */
export function buildPrimeCompositeCard(win, opts = {}) {
  if (!win) return null;
  const line = compositeLine(win.seasons);
  return {
    cardType: 'prime_composite',
    seasonLabel: null,
    seasonsUsed: win.seasons.map(s => s.season),
    period: `${win.start}-${win.end}`,
    // 合成式を公開する（仕様§3.2の要求）
    formula: {
      method: 'rolling_weighted_posterior',
      description: `連続${win.seasons.length}年（${win.start}-${win.end}）の成績を、各年の率を基準年環境へ補正した上で1つの標本として合算。重みは打数のみ`,
      windowSelection: `得点貢献の合計が最大になる連続窓を全位置から選択（合計 ${win.totalScore.toFixed(1)}点）`,
      rejectedAlternative: '0.50×Best3 + 0.30×Best1 + 0.20×Best5（Sol仕様02 §3.2でREJECTED。係数が未校正で、飛び飛びの好成績年を拾うと上振れの寄せ集めになるため）',
      noArbitraryCoefficients: true,
    },
    line,
    perSeason: win.seasons.map(s => ({
      season: s.season, pa: s.line.PA, hr: s.line.HR, h: s.line.H, ab: s.line.AB,
      score: Math.round(s._score * 10) / 10,
    })),
  };
}

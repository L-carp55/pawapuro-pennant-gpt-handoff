// ピーク単年カード（Sol仕様 02 §3.1）
//
// 仕様の条文:
//   - 一つの年度のみをラベルにする
//   - 周辺年度は**Priorと信頼度にのみ**使う
//   - **別年度の長所を直接合成しない**
//
// つまり「2018年の打撃と2016年の守備を混ぜる」は禁止。周辺年は経験ベイズのPriorとして
// 効くだけで、能力値そのものは選んだ1年の成績から出す。

import { seasonScore } from './season_score.mjs';

/**
 * 年度候補を評価して並べる。
 *
 * @param {Array} seasons [{season, line, lgRate, runRuns, fldRuns, position, teamGames}]
 * @param {object} rv 得点価値
 * @param {object} opts {mode:'total'|'batting'|'game', minPa:number}
 * @returns {Array} スコア降順。各要素に scores を持つ
 */
export function rankSeasons(seasons, rv, opts = {}) {
  const mode = opts.mode ?? 'total';
  const minPa = opts.minPa ?? 200;
  return seasons
    .filter(s => s.line.PA >= minPa)
    .map(s => {
      const scores = seasonScore({ ...s, rv });
      return { season: s.season, scores, score: scores[mode], line: s.line, position: s.position };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * ピーク単年カードを作る。
 *
 * @param {Array} ranked rankSeasons の出力
 * @param {object} opts {mode}
 * @returns {{cardType, seasonLabel, seasonsUsed, selection, runnersUp}}
 *   seasonsUsed は必ず1要素（他年度を混ぜないことの構造的保証）
 */
export function buildPeakYearCard(ranked, opts = {}) {
  if (!ranked.length) return null;
  const mode = opts.mode ?? 'total';
  const top = ranked[0];
  const MODE_LABEL = { total: '総合ピーク', batting: '打撃ピーク', game: '打席あたりの質' };

  return {
    cardType: 'peak_single_year',
    // 単年カードは必ず1年のラベルを持つ
    seasonLabel: top.season,
    // 能力値の算出に使う年度は選んだ1年のみ。周辺年はPriorとしてのみ効く（仕様§3.1）
    seasonsUsed: [top.season],
    selection: {
      mode,
      modeLabel: MODE_LABEL[mode] ?? mode,
      score: Math.round(top.score * 10) / 10,
      parts: top.scores.parts,
      // 選定の根拠を公開する（仕様02 §15「途中式を省略しない」）
      basis: `${MODE_LABEL[mode]}で最高の年。得点貢献 ${top.score >= 0 ? '+' : ''}${top.score.toFixed(1)}点`,
    },
    // 次点も見せる（僅差なら選定を疑えるように）
    runnersUp: ranked.slice(1, 4).map(r => ({
      season: r.season,
      score: Math.round(r.score * 10) / 10,
      gap: Math.round((top.score - r.score) * 10) / 10,
    })),
  };
}

/**
 * 選定の頑健性を見る。首位と次点の差が小さいなら「どちらでもよい」ことを示す。
 * @returns {{robust:boolean, gap:number, note:string}}
 */
export function selectionRobustness(ranked, thresholdRuns = 5) {
  if (ranked.length < 2) return { robust: true, gap: Infinity, note: '候補が1年のみ' };
  const gap = ranked[0].score - ranked[1].score;
  return {
    robust: gap >= thresholdRuns,
    gap: Math.round(gap * 10) / 10,
    note: gap >= thresholdRuns
      ? `首位が次点を${gap.toFixed(1)}点上回る`
      : `首位と次点の差が${gap.toFixed(1)}点しかない（${thresholdRuns}点未満）。${ranked[0].season}年と${ranked[1].season}年はほぼ同格`,
  };
}

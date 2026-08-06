// 経験ベイズ縮小と Prior 選択（Sol仕様 02 §5.2/§6.3/§8、03 §4.3/§5.3）
//
// 仕様の核: 少打席は「減点」ではなく「推定の不確実性が大きい」。結果をPriorへ回帰させる。
// Prior の選び方が仕様の要点（§8.2 ケガ離脱／§8.3 限定起用／§8.4 新人）。

/**
 * 縮小（03 §4.3 の実装しやすい代替形）
 *   post = (AB × observed + kappa × prior) / (AB + kappa)
 * kappa は「Prior何打数ぶんの重み」。
 */
export function shrink(observed, ab, prior, kappa) {
  if (!(ab > 0)) return prior;
  return (ab * observed + kappa * prior) / (ab + kappa);
}

/**
 * Prior を選ぶ。仕様 §8 の分類をそのまま実装する。
 *
 * @param {object} target {season, ab, teamGames}
 * @param {Array} history 同一選手の他年度 [{season, ab, avgEnv, hrEnv, isFarm}]
 * @param {object} league {avg, hr} 基準年のリーグ平均
 * @param {object} cfg configs/ratings.json の shrinkage
 * @returns {{avg, hr, kind, basis}} kind: self_recent | farm | league
 */
export function selectPrior(target, history, league, cfg) {
  const s = cfg.prior;
  // 一軍の周辺年（前後3年、当年を除く）。近い年ほど重い
  const near = history
    .filter(h => h.season !== target.season && !h.isFarm && Math.abs(h.season - target.season) <= s.window_years)
    .map(h => ({ ...h, w: h.ab * Math.pow(s.year_decay, Math.abs(h.season - target.season) - 1) }));

  const wSum = near.reduce((a, h) => a + h.w, 0);
  if (wSum >= s.min_weight_for_self) {
    const rawAvg = near.reduce((a, h) => a + h.avgEnv * h.w, 0) / wSum;
    // ★案D（2026-08-05オーナー承認）: self_recentのPriorは、周辺年の実績を平均しているが
    //   それでも**出場が少ない対象年**（今回査定する年）は本人の平均より実際に悪い
    //   （調子・経験不足・衰え）ので、縮小が系統的にリーグ打率を押し上げていた。
    //   出場量（target.ab）に応じてPriorを下げることで、後付けでなく原因に直接効かせる。
    //   打率(avg)のみに適用。本塁打(hr)には適用しない（案Dの較正は打率でのみ実施）。
    const adj = s.playing_time_adjustment;
    const avg = adj ? rawAvg + Math.min(0, adj.intercept + adj.slope * Math.log(Math.max(30, target.ab))) : rawAvg;
    return {
      avg,
      hr: near.reduce((a, h) => a + h.hrEnv * h.w, 0) / wSum,
      kind: 'self_recent',
      basis: `一軍周辺${near.length}年・重み計${Math.round(wSum)}`
        + (adj && avg !== rawAvg ? `（出場量補正 ${((avg - rawAvg) * 1000).toFixed(1)}厘）` : ''),
    };
  }

  // 一軍の実績が足りない場合、二軍成績を変換して使う（§8.4 新人・ブレイク初年度）
  const farm = history.filter(h => h.isFarm && Math.abs(h.season - target.season) <= s.window_years);
  const farmAb = farm.reduce((a, h) => a + h.ab, 0);
  if (farmAb >= s.min_farm_ab) {
    const f = s.farm_conversion;
    return {
      avg: (farm.reduce((a, h) => a + h.avgEnv * h.ab, 0) / farmAb) * f.avg,
      hr: (farm.reduce((a, h) => a + h.hrEnv * h.ab, 0) / farmAb) * f.hr,
      kind: 'farm',
      basis: `二軍${farm.length}年・${farmAb}打数（一軍換算係数 avg×${f.avg} hr×${f.hr}）`,
    };
  }

  return { avg: league.avg, hr: league.hr, kind: 'league', basis: 'リーグ平均' };
}

/**
 * 稼働率（§8.2「稼働率はケガしにくさへ」）。能力への加点には使わない。
 * @returns 0-1。1に近いほどフル稼働
 */
export function durabilityRate(pa, teamGames, cfg) {
  const perGame = cfg.durability?.pa_per_team_game ?? 3.1;
  const full = teamGames * perGame;
  return full > 0 ? Math.min(1, pa / full) : null;
}

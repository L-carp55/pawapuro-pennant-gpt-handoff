// 1シーズンの価値を測る（Sol仕様07 §8「年度選定の評価軸案」）。
//
// 仕様の要求:
//   - 打撃補正・走塁・守備・主位置・稼働を見る
//   - **WARだけで決めない**
//   - 「打撃ピーク」「総合ピーク」「パワプロとして最強の年」を区別できるようにする
//   - デフォルト推奨は「現実の総合ピーク単年」
//
// 重みは configs/run_values.json（チーム実得点からの回帰）を使う。恣意的な係数を置かない。

/**
 * 打撃の得点貢献（リーグ平均打者との差）。単位=点。
 *
 * 各イベントに得点価値を掛けて足すと「その打者が生んだ得点」になる。
 * ただし打席数が多いほど大きくなるので、同じ打席数のリーグ平均打者を引いて
 * 「平均より何点多く稼いだか」にする。これで打席数の多寡と質を両方反映できる。
 *
 * @param {object} line 実成績 {PA,AB,H,B2,B3,HR,BB,HBP,SH,SF,SB,CS}
 * @param {object} lgRate リーグの1打席あたり各イベント率 {b1,xb2,hr,bb,hbp,sb,cs,outs}
 * @param {object} rv run_values.json の values
 * @returns {{raw:number, vsLeague:number, perPa:number}}
 */
export function battingRuns(line, lgRate, rv) {
  const b1 = line.H - line.B2 - line.B3 - line.HR;
  const xb2 = line.B2 + line.B3;
  const outs = line.AB - line.H + (line.SH ?? 0) + (line.SF ?? 0) + (line.CS ?? 0);
  const raw = b1 * rv.b1 + xb2 * rv.xb2 + line.HR * rv.hr + line.BB * rv.bb
    + (line.HBP ?? 0) * rv.hbp + (line.SB ?? 0) * rv.sb + (line.CS ?? 0) * rv.cs + outs * rv.outs;

  // 同じ打席数のリーグ平均打者
  const lgRaw = line.PA * (lgRate.b1 * rv.b1 + lgRate.xb2 * rv.xb2 + lgRate.hr * rv.hr
    + lgRate.bb * rv.bb + lgRate.hbp * rv.hbp + lgRate.sb * rv.sb + lgRate.cs * rv.cs + lgRate.outs * rv.outs);

  return { raw, vsLeague: raw - lgRaw, perPa: line.PA > 0 ? (raw - lgRaw) / line.PA : 0 };
}

/** リーグの1打席あたりイベント率を集計行から作る */
export function leagueRates(agg) {
  const pa = agg.pa;
  return {
    b1: (agg.h - agg.b2 - agg.b3 - agg.hr) / pa,
    xb2: (agg.b2 + agg.b3) / pa,
    hr: agg.hr / pa,
    bb: agg.bb / pa,
    hbp: agg.hbp / pa,
    sb: agg.sb / pa,
    cs: agg.cs / pa,
    outs: (agg.ab - agg.h + agg.sh + agg.sf + agg.cs) / pa,
  };
}

/**
 * ポジションの守備的価値（点/シーズン）の旧・診断用候補。
 *
 * 2026-08-07監査で、この未較正値だけで2020+のピーク年が170人中23人(13.5%)変わり、
 * 絶対値平均6.02点と実測守備得点6.03点に匹敵した。
 * 「一般的な序列」から置いた数値を本番の総合ピークへ入れるには影響が大きすぎるため、
 * **本番既定では使用しない**。NPB実データで較正した後に再検討する。
 */
export const POSITION_ADJUSTMENT = {
  _comment: '診断用の未較正ポジション別調整。本番総合点ではデフォルト無効',
  _status: 'PROVISIONAL_DIAGNOSTIC_ONLY。NPB実データからの推定は未実施',
  _source: '野球分析で一般に使われる序列を参考にした旧候補。数値自体は本プロジェクトで未較正',
  values: { 捕: 12.5, 遊: 7.5, 二: 2.5, 三: 2.5, 中: 2.5, 右: -7.5, 左: -7.5, 一: -12.5, 指: -17.5 },
};

/**
 * シーズン総合スコア。3つの見方を同時に返す（仕様07 §8「区別できるようにする」）。
 *
 * @param {object} args
 *   line: 実成績 / lgRate: リーグ率 / rv: 得点価値
 *   runRuns: 走塁の得点貢献（UBR等）
 *   fldRuns: 守備の得点貢献（位置別の加算可能なrun成分）
 *   position: 主位置 / teamGames: チーム試合数
 *   includeProvisionalPositionAdjustment: 診断時だけtrue。本番既定=false
 * @returns {{batting, total, game, parts}}
 *   batting = 打撃ピーク（打撃の得点貢献のみ）
 *   total   = 観測総合ピーク（打撃＋走塁＋守備）。未較正の位置調整は既定で含めない
 *   game    = パワプロとして強い年（能力値が高く出る年＝打席あたりの質を重視）
 */
export function seasonScore(args) {
  const {
    line, lgRate, rv, runRuns = 0, fldRuns = 0,
    position = null, teamGames = 143,
    includeProvisionalPositionAdjustment = false,
  } = args;
  const bat = battingRuns(line, lgRate, rv);

  const posAdj = includeProvisionalPositionAdjustment
    && position && POSITION_ADJUSTMENT.values[position] != null
    ? POSITION_ADJUSTMENT.values[position] * Math.min(1, line.PA / (teamGames * 3.1))
    : 0;

  return {
    batting: bat.vsLeague,
    total: bat.vsLeague + runRuns + fldRuns + posAdj,
    // 打席あたりの質。少打席の好成績年が上位に来やすいので、単年カード選定の既定にはしない
    game: bat.perPa * 600,
    parts: {
      battingRuns: bat.vsLeague,
      runRuns,
      fldRuns,
      posAdj,
      positionAdjustmentApplied: includeProvisionalPositionAdjustment && posAdj !== 0,
      positionAdjustmentStatus: includeProvisionalPositionAdjustment ? 'provisional_diagnostic' : 'disabled_uncalibrated',
      pa: line.PA,
      perPa: bat.perPa,
    },
  };
}

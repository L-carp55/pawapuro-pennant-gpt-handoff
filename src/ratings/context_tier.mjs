// ミートの基準統計をどの文脈から取るか（Sol仕様 02 §5.1／03 §4.1）。
//
// 理想は「対右投手 かつ 非得点圏」の打率。打者の素の対応力に一番近く、
// 相手投手の左右と場面の有利不利を両方とも外した数字になるため。
//
// ただし公開データは多くの場合「対右の合計」と「得点圏の合計」しか出しておらず、
// その2つが重なった部分（対右かつ非得点圏）は分からない。
// 周辺の合計だけから重なりを一意に決めることはできない（周辺分布から同時分布は復元できない）。
//
// したがって:
//   階層A  対右×非得点圏の打数・安打が実際にある → そのまま使う
//   階層B  対右の合計だけある                     → 対右を暫定基準にする（重なりは作らない）
//   階層C  総合だけ                               → 総打率を使い、信頼度を下げる
//
// **禁止**（仕様§5.1 REJECTED）:
//   AVG_vsR − 0.30 ×(AVG_RISP − AVG_nonRISP) のような、任意の係数で交差セルを作る式。
//   この関数は交差を推定しない。無いものは無いと返す。

/** 打数がこの数に満たない文脈は「使える」と認めない（縮小より前の門） */
export const MIN_AB_FOR_TIER = { A: 100, B: 100 };

export class ContextFabricationError extends Error {}

/**
 * 文脈を選ぶ。
 *
 * @param {object} splits
 *   total:        {AB, H}                      必須
 *   vsR:          {AB, H}|null                 対右の合計
 *   vsL:          {AB, H}|null                 対左の合計
 *   risp:         {AB, H}|null                 得点圏の合計
 *   nonRisp:      {AB, H}|null                 非得点圏の合計
 *   vsR_nonRisp:  {AB, H, source}|null         交差セル（実測がある時だけ）
 * @param {object} opts {minAb}
 * @returns {{tier, AB, H, avg, basis, available, rejected}}
 */
export function selectContext(splits, opts = {}) {
  const min = { ...MIN_AB_FOR_TIER, ...(opts.minAb ?? {}) };
  const { total, vsR = null, vsL = null, risp = null, nonRisp = null, vsR_nonRisp = null } = splits;

  // 打数0は「文脈が無い」であって例外ではない（SP-098: 塩見泰隆2025は出場1・打数0）。
  // 空サンプルを握りつぶして0点にするのでもなく、打撃文脈が使えないと明示して返す。
  if (!total || !(total.AB > 0)) {
    if (opts.allowEmptyTotal === false) {
      throw new Error('総合の打数が無い（文脈選択の前提）');
    }
    return {
      tier: 'NONE', AB: 0, H: total?.H ?? 0, avg: null,
      basis: 'NO_BATTING_SAMPLE',
      available: availability(splits),
      rejected: ['対象年の総合打数が0。打撃文脈は選ばない（欠損を0点にしない）'],
    };
  }

  // 交差セルは「実測である」と申告されたものだけを受け付ける。
  // 周辺値から作った値をここへ渡すのは仕様違反なので、握りつぶさず例外にする。
  if (vsR_nonRisp) {
    if (vsR_nonRisp.source !== 'measured') {
      throw new ContextFabricationError(
        '対右×非得点圏に実測でない値が渡された（仕様02 §5.1 REJECTED）。' +
        '周辺集計から交差セルを作ってはならない。source:"measured" のみ受け付ける');
    }
    if (vsR_nonRisp.AB >= min.A) {
      return {
        tier: 'A', AB: vsR_nonRisp.AB, H: vsR_nonRisp.H, avg: vsR_nonRisp.H / vsR_nonRisp.AB,
        basis: '対右投手×非得点圏の実測',
        available: availability(splits), rejected: [],
      };
    }
  }

  if (vsR && vsR.AB >= min.B) {
    return {
      tier: 'B', AB: vsR.AB, H: vsR.H, avg: vsR.H / vsR.AB,
      basis: '対右投手の合計（非得点圏との交差は不明なので作らない）',
      available: availability(splits),
      // 何をやらなかったかを明示的に残す。後から「なぜ交差を使わなかったか」を追える
      rejected: [
        risp && nonRisp
          ? '得点圏／非得点圏の周辺値はあるが、対右との交差セルは周辺値から復元できないため使わない'
          : '得点圏の周辺値なし',
      ],
    };
  }

  return {
    tier: 'C', AB: total.AB, H: total.H, avg: total.H / total.AB,
    basis: '総合（対左右の分割が無い、または打数不足）',
    available: availability(splits),
    rejected: vsR ? [`対右の打数${vsR.AB}が下限${min.B}未満`] : ['対左右の分割なし'],
  };
}

function availability(s) {
  return {
    total: !!s.total, vsR: !!s.vsR, vsL: !!s.vsL,
    risp: !!s.risp, nonRisp: !!s.nonRisp,
    vsR_nonRisp: !!(s.vsR_nonRisp && s.vsR_nonRisp.source === 'measured'),
  };
}

/**
 * チャンス（得能）の素点（仕様05 §3）。
 * 得点圏と非得点圏の**差**で測る。打点は使わない——打点は前の打者が出塁したかに依存し、
 * 本人の力ではないため（同じ打撃でも打線の並びで打点は何倍にもなる）。
 *
 * @returns {null|{diff, rispAvg, nonRispAvg, rispAb, reliability}}
 */
export function clutchDifferential(risp, nonRisp, opts = {}) {
  const minAb = opts.minAb ?? 50;
  if (!risp?.AB || !nonRisp?.AB) return null;
  if (risp.AB < minAb) return { diff: null, rispAb: risp.AB, reason: `得点圏打数${risp.AB}が下限${minAb}未満` };
  const rispAvg = risp.H / risp.AB, nonRispAvg = nonRisp.H / nonRisp.AB;
  return {
    diff: rispAvg - nonRispAvg,
    rispAvg, nonRispAvg, rispAb: risp.AB,
    // 得点圏打数の分だけ「総合」が引っ張られている割合（05 §2の基礎能力反映で使う。
    // risp+nonRispの合計を分母にする＝この2つの表自体から来る自己完結の比率で、総合ABとの微小な不一致に依存しない）
    weight: risp.AB / (risp.AB + nonRisp.AB),
    reliability: risp.AB / (risp.AB + (opts.kappa ?? 200)),
    _note: '打点(RBI)は入力に使わない（仕様05 §3）',
  };
}

/**
 * 対左（得能）の素点（仕様05 §4）。
 * ミート差と長打差を分けて返す。ひとつの数字に潰さない。
 */
export function plattonDifferential(vsL, vsR, opts = {}) {
  const minAb = opts.minAb ?? 50;
  if (!vsL?.AB || !vsR?.AB) return null;
  if (vsL.AB < minAb) return { meetDiff: null, sluggingDiff: null, hrRateDiff: null, vsLAb: vsL.AB, reason: `対左打数${vsL.AB}が下限${minAb}未満` };
  const tb = s => (s.H - (s.B2 ?? 0) - (s.B3 ?? 0) - (s.HR ?? 0)) + 2 * (s.B2 ?? 0) + 3 * (s.B3 ?? 0) + 4 * (s.HR ?? 0);
  return {
    meetDiff: vsL.H / vsL.AB - vsR.H / vsR.AB,
    sluggingDiff: tb(vsL) / vsL.AB - tb(vsR) / vsR.AB,
    // HR率そのものの対左右差（実測、ISO変換等の係数を経由しない）。パワーの基礎能力反映に使う（仕様05 §4「HR/ISO差→対左パワー効果」）
    hrRateDiff: (vsL.HR != null && vsR.HR != null) ? (vsL.HR / vsL.AB - vsR.HR / vsR.AB) : null,
    vsLAb: vsL.AB, vsRAb: vsR.AB,
    weight: vsL.AB / (vsL.AB + vsR.AB),
    reliability: vsL.AB / (vsL.AB + (opts.kappa ?? 200)),
    _note: 'ミート差と長打差を別々に返す（仕様05 §4）',
  };
}

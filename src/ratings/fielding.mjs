// 守備力・捕球・肩力・送球・捕手能力の査定（Sol仕様 04 §4-§12、02 §11-§12）
//
// 仕様の核（守るべき分離）:
//   §4.1 守備力 ＝ 範囲・反応・一歩目・打球判断・ポジショニング・処理速度
//   §4.2 捕球   ＝ 失策・守備率・ハンドリング・捕逸
//   §4.3 送球   ＝ 速度と遠投は肩力、精度は送球得能。総失策を肩力へ入れない
//   §7   失策は捕球のみに影響。守備力には影響しない  ← 回帰テストQ4
//   §8   出場量（守備イニング）は信頼度へ。能力への自動加点はしない ← 回帰テストQ2相当
//   §9   ゴールデングラブは入力に使わない（REJECTED） ← 回帰テストQ10
//   §6   同じ現実Rangeなら俊足外野手は守備力を下げ、鈍足外野手は上げる ← 回帰テストQ5
//   §5   内野では上記の補正が小さい ← 回帰テストQ6
//
// 実データでの裏付け（scripts/calibrate_fielding.mjs、842件）:
//   走力→RngRの傾きは内野平均2.05・外野平均3.91。仕様§5/§6と整合。
//   ただし中堅は0.78と低い（俊足しか守らずばらつきが小さいため識別力が落ちる）。

import { clamp } from './scale.mjs';

/**
 * 縮小の強さ（仕様§8「出場量は信頼度へ」）。
 *
 * 守備範囲と捕球で観測の信頼度が違うので kappa を分ける。
 * 500イニング以上のレギュラーで測った翌年との相関は 守備範囲 0.385 / 捕球 0.208 で、
 * 失策の少なさは翌年をほとんど予測しない＝より強く平均へ引き戻すべき。
 * 導出は scripts/calibrate_fielding_shrinkage.mjs（旧共通値400は未校正の暫定値だった）。
 * 設定が無い場合は旧来の共通値へ落ちる。
 */
function kappaFor(cfg, kind) {
  const f = cfg.fielding;
  return (kind === 'catching' ? f.kappa_innings_catching : f.kappa_innings_range) ?? f.kappa_innings;
}

/**
 * 守備力（範囲）。RngR から走力で説明できる分を引いた残差＝守備技術。
 * これが仕様§6「同じ現実Rangeなら俊足は守備力を下げる」の実装本体。
 *
 * @param {object} fld {pos, inn, rngr}
 * @param {number|null} speedScore 走力のzスコア
 * @param {object} norm configs/fielding_norms.json
 */
export function fieldingRating(fld, speedScore, norm, cfg) {
  const p = norm.byPos[fld.pos];
  if (!p || !p.rngrOnSpeed || !(fld.inn > 0)) return null;

  const per1000 = (fld.rngr / fld.inn) * 1000;
  const expected = p.rngrOnSpeed.intercept + p.rngrOnSpeed.slope * (speedScore ?? 0);
  const residZ = (per1000 - expected) / p.rngrOnSpeed.sd;

  // 出場量は能力への加点ではなく信頼度に使う（仕様§8）
  // kappaは指標ごとに違う。守備範囲は捕球より信号が強い（レギュラーで翌年相関 0.385 vs 0.208）
  const reliability = fld.inn / (fld.inn + kappaFor(cfg, 'range'));
  const s = cfg.zscore_ratings.fielding;

  // 併殺の各段階（2026-08-05 オーナー承認で追加）。
  // 守備範囲（RngR）は「どこまで届くか」、併殺の関与は「捕ってから投げるまでの速さと確実さ」で
  // 別の側面。翌年との一致は DPS二塁0.436・DPT遊撃0.399 で、RngRの0.256より高い。
  // 重みは走力と同じ決め方＝その材料の翌年再現性。
  // DPF（最後に受ける）は0.055でほぼ再現しないので使わない（一塁手は受けるだけ）。
  const dp = norm.doublePlay;
  const parts = [{ z: residZ, w: norm.rangeWeight ?? 0.256, name: 'range' }];
  // 位置の表記が経路で違う（守備成分は SS/2B…、併殺の集計は 遊/二…）ので寄せる
  const POS_JA = { '1B': '一', '2B': '二', '3B': '三', 'SS': '遊' };
  const posJa = POS_JA[fld.pos] ?? fld.pos;
  if (dp?.byMetricPos && fld.chances >= (dp.min_chances ?? 300)) {
    for (const metric of ['DPS', 'DPT']) {
      const cell = dp.byMetricPos[`${metric}|${posJa}`];
      const count = fld[metric === 'DPS' ? 'dps' : 'dpt'];
      if (!cell || count == null || !(cell.sd > 0)) continue;
      const per1000dp = (count / fld.chances) * 1000;
      parts.push({ z: (per1000dp - cell.mean) / cell.sd, w: cell.weight, name: metric });
    }
  }
  let sum = 0, wsum = 0;
  for (const p2 of parts) { if (!Number.isFinite(p2.z)) continue; sum += p2.z * p2.w; wsum += p2.w; }
  const combinedZ = wsum > 0 ? sum / wsum : residZ;

  return {
    rating: clamp(s.center + combinedZ * reliability * s.spread, cfg.clamp),
    residZ, combinedZ, reliability, per1000, expected,
    components: parts.map(p2 => ({ name: p2.name, z: p2.z, weight: p2.w })),
    speedAdjusted: (speedScore ?? 0) !== 0,
    note: p.rngrOnSpeed.n < 20 ? 'サンプル過少' : null,
  };
}

/**
 * 捕球。失策抑止（ErrR）を見る（仕様§7「エラー数は捕球のみに影響」）。守備力には一切渡さない。
 *
 * ★捕手だけは捕逸（パスボール）で測る（2026-08-05 オーナー裁定）。
 *   仕様04 §10.1 が捕手の捕球材料に捕逸を名指ししているのに、実装は一度も読んでいなかった。
 *   調べたところ単なる取りこぼしでは済まない3点が出た（すべて実測、捕手143人年・200イニング以上）:
 *     ① 現行のErrRは捕手について**実質的に捕逸の指標**（corr -0.685。失策Eとは -0.155）。
 *        つまり併用すると同じ情報を2回数える＝二重計上
 *     ② 翌年再現性は 捕逸 +0.238 に対し ErrR +0.048。ErrRは捕手についてほぼランダムで
 *        「選手の持ち物」を測れていない
 *     ③ ErrRの出どころは2020年以降しか無く、それ以前の捕手261人年（50試合以上）は守備が丸ごと空。
 *        捕逸は2006年から20年連続で取れる
 *   → 併用でなく**差し替え**にした。捕手以外は従来どおりErrR。
 *   ★採否の正式な物差し（エンジンでのリーグ分布一致）は未実装のため、この採用は暫定。
 */
export function catchingRating(fld, norm, cfg) {
  if (fld.pos === 'C') return catcherCatchingFromPassedBall(fld, norm, cfg);

  // ★案2（2026-08-05オーナー承認）: 送球得能が確定した選手だけ、捕球の材料をFE
  // （送球以外の失策）へ差し替える。ErrRには送球の失敗も混ざっており、送球得能と
  // 同じ情報を二重に数えることになるため（開発原則「同じ情報を能力と特殊能力に二重計上しない」）。
  // 他の全選手はErrRのまま——FE単独は翌年再現性がErrRより低い(r=0.126<0.208)ため、
  // 全員に広げると精度が下がる（outputs/error_split_te_fe_20260805.md）。影響を、
  // 二重計上が実際に起きている選手だけに限定する。
  // ★fld.pos は bm_fld由来の英語表記(2B等)。norm.fe.byPosのキーはv_fielding由来の
  //   日本語表記(二等)なので、そのままでは引けない。日本語表記(fePos)を優先して使う
  const feKey = fld.fePos ?? fld.pos;
  if (fld.useFeCatching && fld.fe != null && fld.chances > 0 && norm.fe?.byPos?.[feKey]) {
    const base = norm.fe.byPos[feKey];
    const per1000fe = (fld.fe / fld.chances) * 1000;
    const z = (per1000fe - base.mean) / base.sd;
    const reliability = fld.chances / (fld.chances + (norm.fe.kappa ?? 3237));
    const s = cfg.zscore_ratings.catching;
    return {
      rating: clamp(s.center + z * reliability * s.spread, cfg.clamp),
      z, reliability, per1000: per1000fe,
      material: 'fe_only',
      normBasis: `${feKey}（FE単独・案2）`,
      _note: '送球得能が確定しているため、二重計上を避けて捕球以外の失策(FE)だけで判定',
    };
  }

  const p = norm.byPos[fld.pos];
  if (!p || !p.errr || !(fld.inn > 0) || fld.errr == null) return null;
  const per1000 = (fld.errr / fld.inn) * 1000;

  // 仕様§11「各年・各ポジションで標準化する」。
  // その年のセルがあれば使い、標本が薄くて作られていない年は全年プールへ落とす。
  // 年ごとの水準移動を吸収しないと、リーグ全体が動いた分を個人の能力差として拾ってしまう。
  const cell = fld.season != null ? norm.errrByPosSeason?.[`${fld.pos}|${fld.season}`] : null;
  const base = cell ?? p.errr;
  const z = (per1000 - base.mean) / base.sd;

  const reliability = fld.inn / (fld.inn + kappaFor(cfg, 'catching'));
  const s = cfg.zscore_ratings.catching;
  return {
    rating: clamp(s.center + z * reliability * s.spread, cfg.clamp),
    z, reliability, per1000,
    normBasis: cell ? `${fld.pos}×${fld.season}年` : `${fld.pos}（全年プール）`,
  };
}

/**
 * 捕手の捕球を捕逸（パスボール）から測る（2026-08-05 新設）。
 *
 * 単位は**1試合あたり**。捕手のイニングは2020年以降しか無く、イニングで割ると
 * 捕逸を使う最大の利点（2006年から取れる＝2019年以前の空白が埋まる）が消えるため。
 *
 * 符号: 捕逸は**少ないほど良い**ので z を反転する（ErrR は「防いだ失点」なので多いほど良く、向きが逆）。
 *
 * 信頼度: 出場量は能力への加点ではなく信頼度に使う（仕様§8）。捕手は守備イニングが無い年があるので
 * 試合数で測り、kappa も試合数の尺度に合わせる（イニングの kappa をそのまま使うと事実上ゼロになる）。
 */
function catcherCatchingFromPassedBall(fld, norm, cfg) {
  const n = norm.passedBallByCatcherSeason;
  if (!n || fld.pb == null || !(fld.g > 0)) return null;

  const perGame = fld.pb / fld.g;
  // その年のセルがあれば使い、標本が薄くて作られていない年は全年プールへ落とす（仕様§11）
  const cell = fld.season != null ? n.bySeason?.[String(fld.season)] : null;
  const base = cell ?? n.pool;
  if (!base || !(base.sd > 0)) return null;

  // 捕逸が少ないほど良いので反転
  const z = -(perGame - base.mean) / base.sd;

  const kappaG = cfg.fielding.kappa_games_catching ?? 60;
  const reliability = fld.g / (fld.g + kappaG);
  const s = cfg.zscore_ratings.catching;
  return {
    rating: clamp(s.center + z * reliability * s.spread, cfg.clamp),
    z, reliability,
    perGame, passedBalls: fld.pb, games: fld.g,
    material: 'passed_ball',
    normBasis: cell ? `捕手×${fld.season}年` : '捕手（全年プール）',
    _note: '捕手の捕球は捕逸で測る（仕様04 §10.1）。ErrRは捕手について実質的に捕逸の指標なので併用しない'
      + '（相関-0.685＝二重計上になる）。2026-08-05オーナー裁定、採否の正式な物差しは未実装のため暫定',
  };
}

/**
 * 肩力。送球による貢献（ARM）から測る。
 * 仕様§4.3「総失策を肩力へ入れない」——ErrRは使わない。
 * 外野と捕手が主対象。内野のARMは提供されないことが多い。
 */
export function armRating(fld, norm, cfg) {
  const p = norm.byPos[fld.pos];
  if (!p || !p.arm || !(p.arm.n > 0) || !(fld.inn > 0) || fld.arm == null) return null;
  const per1000 = (fld.arm / fld.inn) * 1000;
  const z = (per1000 - p.arm.mean) / p.arm.sd;
  const reliability = fld.inn / (fld.inn + kappaFor(cfg, 'range'));
  const s = cfg.zscore_ratings.arm;
  return { rating: clamp(s.center + z * reliability * s.spread, cfg.clamp), z, reliability, per1000 };
}

/**
 * 捕手能力（仕様§10、02 §12）。
 * 盗塁阻止への寄与順は 肩 > 送球 > 守備力。ただし係数は未校正のため、
 * ここでは Framing / Blocking / ARM を分離して返すに留め、合成は行わない。
 * 捕球は盗塁阻止と分離し、失策・捕逸で査定する（仕様§10.1）。
 */
export function catcherAbilities(fld, norm, cfg) {
  const p = norm.byPos['C'];
  if (!p || fld.pos !== 'C' || !(fld.inn > 0)) return null;
  const zOf = (v, st) => (v == null || !st || !(st.n > 0) || !(st.sd > 0)) ? null : (v - st.mean) / st.sd;
  const reliability = fld.inn / (fld.inn + kappaFor(cfg, 'range'));
  const s = cfg.zscore_ratings;

  const framingZ = zOf(fld.framing, p.framing);
  const blockingZ = zOf(fld.blocking, p.blocking);
  return {
    framing: framingZ == null ? null : clamp(s.framing.center + framingZ * reliability * s.framing.spread, cfg.clamp),
    blocking: blockingZ == null ? null : clamp(s.blocking.center + blockingZ * reliability * s.blocking.spread, cfg.clamp),
    reliability,
    _note: '盗塁阻止への肩/送球/守備力の寄与配分は仕様上PROVISIONAL（過去の0.55/0.30/0.15はREJECTED）。ここでは合成しない',
  };
}

const INFIELD = ['1B', '2B', '3B', 'SS'];

/**
 * 内野手の肩力（仕様§4.3の空白を埋める推定値）。
 *
 * NPB Basement は ARM を外野手と捕手にしか出しておらず、内野手は全件 null。
 * オーナー裁定（2026-08-01）＝「守れる位置から推定し、その位置を守れること自体を下限の証拠にする」。
 *
 * 実装:
 *   - 位置ごとの事前値は `configs/fielding_norms.json` の infieldArmPrior。
 *     恣意的な序列ではなく、「外野も内野も守った選手の**外野で実測されたARM**」を
 *     内野位置ごとに集計して導いた（scripts/calibrate_infield_arm.mjs）。
 *   - **下限の証拠**: 守った位置のうち最も高い事前値を採る。
 *     肩の要求が高い位置を規定イニング以上守っていれば、その水準を下回らないとみなす。
 *   - 実測ARM（外野・捕手）がある選手には使わない。実測が事前値に優先する。
 *
 * @returns {null|{rating, z, reliability, is_estimated, basis, positions}}
 */
export function inferredInfieldArm(fieldRows, norm, cfg) {
  const prior = norm.infieldArmPrior;
  if (!prior?.byPos) return null;

  const minInn = cfg.fielding.min_infield_innings_for_arm_prior;
  const eligible = fieldRows.filter(f => INFIELD.includes(f.pos) && f.inn >= minInn && prior.byPos[f.pos]);
  if (!eligible.length) return null;

  // 下限の証拠: 最も肩を要求される位置（＝事前値が最大の位置）を採る
  const best = eligible.reduce((a, b) => (prior.byPos[b.pos].z > prior.byPos[a.pos].z ? b : a));
  const z = prior.byPos[best.pos].z;

  const totalInn = eligible.reduce((a, f) => a + f.inn, 0);
  const reliability = totalInn / (totalInn + cfg.fielding.kappa_innings);
  const s = cfg.zscore_ratings.arm;

  return {
    rating: clamp(s.center + z * reliability * s.spread, cfg.clamp),
    z, reliability,
    is_estimated: true,
    basis: `守備位置からの推定（下限＝${best.pos}を${Math.round(best.inn)}イニング）`,
    estimation_method: 'infield_position_prior_from_measured_of_arm',
    positions: eligible.map(f => ({ pos: f.pos, inn: f.inn })),
  };
}

/**
 * サブポジ（仕様§12）。主位置と副位置で同じ守備力とは限らないため、
 * ポジションごとに独立に査定した結果を返す。
 *
 * 肩力は**選手の属性**であってポジションの属性ではないため、
 * 実測ARM（外野・捕手）があればそれを、無ければ内野位置からの推定値を選手単位で1つ持つ。
 */
export function appraiseAllPositions(fieldRows, speedScore, norm, cfg) {
  // 守備イニングが無くても、捕逸だけで捕球を査定できる行は残す（2026-08-05）。
  // 捕手のイニングはNPB Basementに2020年以降しか無く、それ以前を inn>0 で落とすと
  // 捕逸を2006年から使えるようにした意味が消える（実例: 小林誠司2015は捕逸3・68試合）。
  const rows = fieldRows
    .filter(f => f.inn > 0 || (f.pos === 'C' && f.pb != null && f.g > 0))
    // 並べ替えはイニングが基本。イニングが無い行は試合数で代用する（9イニング=1試合の換算）
    .sort((a, b) => (b.inn || (b.g ?? 0) * 9) - (a.inn || (a.g ?? 0) * 9));

  // 実測ARMが1つも無い選手にだけ、内野位置からの推定を当てる
  const hasMeasuredArm = rows.some(f => armRating(f, norm, cfg) != null);
  const inferredArm = hasMeasuredArm ? null : inferredInfieldArm(rows, norm, cfg);

  return rows.map((f, i) => {
    const measured = armRating(f, norm, cfg);
    return {
      pos: f.pos, inn: f.inn, isPrimary: i === 0,
      fielding: fieldingRating(f, speedScore, norm, cfg),
      catching: catchingRating(f, norm, cfg),
      arm: measured ?? (INFIELD.includes(f.pos) ? inferredArm : null),
      catcher: f.pos === 'C' ? catcherAbilities(f, norm, cfg) : null,
      // 仕様§12「ゲーム仕様上の適性値も別管理する」
      aptitude: positionAptitude(f, rows, norm, cfg),
    };
  });
}

/**
 * 守備適性（仕様§12）。能力値とは別管理する。
 *
 * 「その位置を守れるか」は能力の高低とは別の情報で、実際の起用実績から決まる。
 * 主位置＝最多イニング。副位置は起用イニングの規模で3段階に分ける。
 * 能力値へは一切加点しない（仕様§8「出場量は信頼度へ。自動加点しない」）。
 */
export function positionAptitude(fld, allRows, norm, cfg) {
  const t = cfg.fielding.aptitude_innings;
  const primary = allRows[0];
  const grade = fld.pos === primary.pos ? 'A'
    : fld.inn >= t.regular ? 'B'
      : fld.inn >= t.occasional ? 'C' : 'D';
  return {
    grade, innings: fld.inn, is_primary: fld.pos === primary.pos,
    _legend: `A=主位置 / B=常時併用(${t.regular}イニング以上) / C=時々(${t.occasional}以上) / D=わずか`,
  };
}

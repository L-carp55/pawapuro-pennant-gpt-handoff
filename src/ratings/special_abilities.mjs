// 得能（特殊能力）の査定（Sol仕様 05、02 §13）
//
// 仕様の核:
//   §1 得能は「飾り」ではなく、総成績を平常時能力へ分解するための要素
//   §2 平均得能込み基準から、当該選手の得能量との差を基礎能力へ反映
//   §5 三振（赤特を付けるなら基礎ミートを少し戻す。戻しは小さい）
//   §7 内野安打（走力・内野安打○へ分離。ただしゼロ扱いにもしない）
//   §9 金特は歴史的水準のみ。MVP・タイトル・知名度では付けない ← 回帰テストQ12
//
// 本プロジェクト固有の注記:
//   仕様§5の「三振赤特を付けたら基礎ミートを戻す」は、
//   「三振の多さがミートを押し下げている」ことへの補正だった。
//   本設計ではミートは打率から、三振率は独立のコンタクト能力から決めるため、
//   同じ情報が二重に効く構造がそもそも無い（台帳に skip として記録する）。

import { AdjustmentLedger } from './ledger.mjs';
import { applyEnvironment } from './from_rates.mjs';
import { shrink } from './shrinkage.mjs';
import { interp, clamp } from './scale.mjs';

/** 連続値の能力を表示用のランクへ（パワプロの得能ランク相当） */
export function toRank(value, thresholds) {
  for (const t of thresholds) if (value >= t.min) return t.rank;
  return thresholds[thresholds.length - 1].rank;
}

/**
 * 三振の得能（仕様§5）。
 * コンタクト能力（三振率由来）が低い選手に赤特、高い選手に青特を付ける。
 */
export function strikeoutAbility(contactRating, cfg) {
  const t = cfg.special_abilities.strikeout;
  if (contactRating <= t.red_below) return { ability: '三振', color: 'red', basis: `コンタクト${contactRating.toFixed(0)}` };
  if (contactRating >= t.blue_above) return { ability: '選球眼', color: 'blue', basis: `コンタクト${contactRating.toFixed(0)}` };
  return null;
}

/**
 * 内野安打の得能（仕様§7）。
 * ゴロの単打率のうち、走力で説明できる超過分を「内野安打○」へ分離する。
 * ただし「コンタクトしてゴロを作る能力」もあるためゼロ扱いにはしない。
 */
export function infieldHitAbility(gbSingleExcess, speedScore, cfg) {
  const t = cfg.special_abilities.infield_hit;
  if (gbSingleExcess == null || speedScore == null) return null;
  // 走力で説明できる分を超えてゴロ単打が多いか
  const bySpeed = t.speed_coefficient * speedScore;
  const residual = gbSingleExcess - bySpeed;
  if (residual >= t.threshold) {
    return { ability: '内野安打○', color: 'blue', basis: `ゴロ単打の超過${(gbSingleExcess * 100).toFixed(1)}% のうち走力説明分${(bySpeed * 100).toFixed(1)}%を除いた残差${(residual * 100).toFixed(1)}%` };
  }
  return null;
}

/**
 * 金特の判定（仕様§9）。歴史的水準のみ。
 * 「MVPだから」「タイトルを取ったから」では付けない。
 * @param {object} metrics その選手のシーズン指標
 * @param {object} historical 歴代分布 {[key]: {p995, p999, max}}
 */
export function goldSpecialAbilities(metrics, historical, cfg) {
  const out = [];
  const t = cfg.special_abilities.gold;
  for (const [key, spec] of Object.entries(t.criteria)) {
    const v = metrics[key];
    const dist = historical[key];
    if (v == null || !dist) continue;
    // 歴代上位0.5%を超えることが必要条件（仕様§9「歴代上位0.5%級」）
    if (v >= dist[t.percentile_key]) {
      out.push({
        ability: spec.name, color: 'gold', metric: key, value: v,
        threshold: dist[t.percentile_key],
        basis: `${spec.label} ${v.toFixed(3)} が歴代上位${(100 - Number(t.percentile_key.replace('p', '')) / 10).toFixed(1)}%水準（閾値${dist[t.percentile_key].toFixed(3)}）を超過`,
      });
    }
  }
  return out;
}

/**
 * 得能の素点差分を「基礎能力の baseline が通ったのと同じ経路」（環境補正→経験ベイズ縮小→アンカー変換）
 * へ通し、baseline との差を rating 単位で返す（仕様05 §2「平均得能込み基準からの差分を基礎能力へ」）。
 *
 * なぜこの形か: DeltaChance/DeltaLeft は打率・HR率という「生値」の単位で測られるが、
 * 基礎能力は生値をアンカー表で非線形変換した rating の単位。生値の差分に勝手な係数を掛けて
 * rating 単位へ変換すると係数のハードコード（禁止事項）になる。
 * 代わりに「得能ぶんを差し引いた仮想の生値」を作り、baseline と全く同じ変換関数（env補正・
 * shrink・interp）へ通せば、変換自体は既に較正済みのものを再利用するだけで済む。
 *
 * @param {object} p
 *   rawNeutral: 得能ぶんを差し引いた生値（打率 or HR率。env補正・shrinkが想定する率の単位）
 *   env: {lgRate, refRate} | null    環境補正の材料（applyEnvironmentの引数と同じ形）
 *   gamma: number                    環境追随度
 *   prior: number | null             shrink先のPrior値（avg or hr、率の単位）。null なら縮小しない
 *   kappa: number                    縮小の強さ
 *   AB: number                       縮小の分母（実打数）
 *   anchorPoints: Array              cfg.meet_anchors.points or cfg.power_anchors.points
 *   anchorScale: number              率→アンカー表のx軸単位への倍率（ミートは1、パワーはcfg.ab_ref.value。
 *                                    §6.1のhrPer500と同じ変換を経ないとinterpが想定外の範囲を読み外挿で暴れる）
 *   clampCfg: object                 cfg.clamp
 *   baselineRating: number           baseline側のrating（差分の起点）
 * @returns {number} baselineRating との差（rating単位）
 */
function neutralizedDelta({ rawNeutral, env, gamma, prior, kappa, AB, anchorPoints, anchorScale = 1, clampCfg, baselineRating }) {
  let v = rawNeutral;
  if (env) v = applyEnvironment(v, env.lgRate, env.refRate, gamma);
  if (prior != null) v = shrink(v, AB, prior, kappa);
  const neutralRating = clamp(interp(anchorPoints, v * anchorScale), clampCfg);
  return neutralRating - baselineRating;
}

/**
 * 基礎能力への反映（仕様§2「得能が平均より多い→基礎能力を下げる」）。
 * 本設計では能力ごとに独立した情報源を使うため、二重計上が起きる箇所は限られる。
 * 台帳に「調整した項目」と「検討したが不要と判断した項目」の両方を残す。
 *
 * 既知の限界（2026-08-04に実測して確認）:
 *   チャンス（得点圏で切る）と対左（投手の左右で切る）は、**同じ打席を別々の切り口で数えている**。
 *   左投手かつ得点圏の打席は両方に入るので、原理的には両方を引くと重なりぶんを二重に引きうる。
 *   厳密に分けるには「対左×得点圏」の交差セルが要るが、これはTier Aが到達できないのと同じ理由で
 *   公開データに存在しない（周辺値から作るのは仕様02 §5.1 REJECTED）。
 *   実測: 2024年200打数以上で両方が非ゼロの97人について、2つの調整幅の相関は **r=0.029**（ほぼ無相関）。
 *   重なりが効いているなら正の相関が出るはずで、出ていない＝実用上は別々の情報を捉えている。
 *   合計の調整幅も最大-5.13点に収まる。仕様05 §1が総成績を各得能の**加算**に分解している以上、
 *   この形が仕様どおりであり、交差セルが手に入るまではこれ以上分けられない。
 */
export function buildMeetLedger(baselineMeet, ctx, cfg) {
  const led = new AdjustmentLedger('meet', baselineMeet);

  // 仕様§5: 三振赤特を付けるなら基礎ミートを戻す
  led.skip('strikeout_red_delta',
    '本設計ではミートは打率から、三振率は独立のコンタクト能力から決めるため、三振の多さがミートを押し下げる構造が無い。戻す必要がない');

  const gates = cfg.special_abilities.base_reflection ?? {};

  // 仕様§5.5: 完全な対右×非得点圏を使った場合はチャンス/対左で再減点しない
  if (ctx.contextTier === 'A') {
    led.skip('chance_delta', 'Tier A（対右×非得点圏）を使用済み。チャンスは既に基準統計から除外されているため再調整しない（仕様§5.5）');
    led.skip('vs_left_delta', '同上');
  } else if (ctx.rawTotalAvg == null) {
    led.skip('chance_delta', `Tier ${ctx.contextTier}。基準となる生打率が無いため調整不能`);
    led.skip('vs_left_delta', '同上');
  } else {
    // 仕様05 §2/§3: baseline（総合）はチャンスの寄与ぶんだけ引っ張られている。
    // その分を「得点圏×非得点圏の自己完結の比率」で差し引いた生打率を作り、baselineと同じ経路へ通す。
    const clutch = ctx.clutch;
    if (!gates.meet_from_clutch?.enabled) {
      led.skip('chance_delta', '設定で反映しないことになっている（special_abilities.base_reflection.meet_from_clutch）');
    } else if (ctx.contextTier === 'B') {
      // ★2026-08-05 オーナー指摘で発見・修理（対左の二重適用と同じ型が、得点圏側にも残っていた）。
      //
      //   Tier B の基準は「対右投手の打率」。ところがこの調整は `rawTotalAvg`（総合打率）から
      //   得点圏差を引いた値を作り、それを baselineMeet（対右の打率から作った値）と比べていた。
      //   **母集団が違うものを引き算していた**。
      //
      //   実測（村上宗隆2024）: 総合打率.244 / 対右打率.217。この調整は +3.55点を加算したが、
      //   その中身は得点圏の効果ではなく **.244と.217の差(27厘)がそのまま出たもの**だった。
      //   得点圏で強い選手（村上は得点圏.273 vs 非得点圏.233）なら、仕様05 §2の意図では
      //   ミートは**下がる**はずで、符号すら合っていなかった。
      //
      //   正しく調整するには「対右投手の中での得点圏差」が要るが、公開データに交差セル
      //   （対右×得点圏）は無い。仕様02 §5.1 は周辺値からの復元をREJECTEDとしている。
      //   よって**調整しない**。対右投手の打率には得点圏の成分が残ったままになるが、
      //   母集団の違うものを引く誤りよりは、残す方が正しい。
      //   この制約は Tier A（対右×非得点圏）に到達できない限り解消しない。
      led.skip('chance_delta',
        '基準が対右投手の打率（Tier B）なので、調整には「対右投手の中での得点圏差」が要る。'
        + 'だが公開データに交差セル（対右×得点圏）が無く、総合打率ベースの得点圏差を当てると'
        + '母集団の違うものを引くことになる（実測: 村上2024で+3.55点＝得点圏の効果ではなく'
        + '総合打率と対右打率の差27厘がそのまま出ていた）。仕様02 §5.1が周辺値からの復元を'
        + '禁じているため調整せず据え置く。対右の打率には得点圏の成分が残る');
    } else if (clutch?.diff != null) {
      const rawNeutral = ctx.rawTotalAvg - clutch.weight * clutch.reliability * clutch.diff;
      const delta = neutralizedDelta({
        rawNeutral,
        env: ctx.env ? { lgRate: ctx.env.lgAvg, refRate: ctx.env.refAvg } : null,
        gamma: cfg.environment.gamma_avg,
        prior: ctx.prior?.avg ?? null,
        kappa: cfg.shrinkage.kappa_meet,
        AB: ctx.AB,
        anchorPoints: cfg.meet_anchors.points,
        clampCfg: cfg.clamp,
        baselineRating: baselineMeet,
      });
      led.add('chance_delta', delta, {
        reason: `得点圏-非得点圏差${(clutch.diff * 1000).toFixed(0)}厘（得点圏打数${clutch.rispAb}、信頼度${clutch.reliability.toFixed(2)}）ぶんを平均得能込み基準から除いた（仕様05 §2/§3）。得点圏側の実測が総合打率を占める比率${(clutch.weight * 100).toFixed(0)}%で按分`,
        informationSource: 'risp_nonrisp_split',
        provisional: true,
      });
    } else {
      led.skip('chance_delta', clutch?.reason ?? `Tier ${ctx.contextTier}。得点圏の分割データ不足のため調整なし`);
    }

    // 仕様05 §2/§4: 対左のミート差ぶんも同様に除く
    //
    // ★ただし基準が既に対右（文脈Tier B）なら引かない（2026-08-05、T-0102の修理に伴う二重適用の解消）:
    //   Tier B は「対右投手の打率」そのものを基準にしているので、対左の影響はこの時点で既に外れている。
    //   そこからさらに対左差分を引くと、同じ調整を2回かけることになる。
    //   これは 2026-08-04 の Sol Pro 白紙便（こちらの実装を見せずに独立設計させたもの）が
    //   「階層Bでは対左得能を逆算に入れてはいけない」と名指しした点で、当時は階層Bが未実装だったため
    //   「どちらの経路を採るか未決」として保留されていた（implementation_checklist A §5.1）。
    //   2026-08-05に階層Bを実装した（T-0102）ので、この分岐でその未決が閉じる。
    //   実測: 閉じる前は Tier B 129人のうち **112人** が二重に引かれており、最大7.0点動いていた。
    const platoon = ctx.platoon;
    if (ctx.contextTier === 'B') {
      led.skip('vs_left_delta',
        '基準が既に対右投手の打率（文脈Tier B）なので、対左の影響はこの時点で外れている。'
        + 'ここで対左差分を引くと二重適用になる（仕様02 §5.1の階層Bと仕様05 §4は同じ向きの処理）');
    } else if (!gates.meet_from_platoon?.enabled) {
      led.skip('vs_left_delta', '設定で反映しないことになっている（special_abilities.base_reflection.meet_from_platoon）');
    } else if (platoon?.meetDiff != null) {
      const rawNeutral = ctx.rawTotalAvg - platoon.weight * platoon.reliability * platoon.meetDiff;
      const delta = neutralizedDelta({
        rawNeutral,
        env: ctx.env ? { lgRate: ctx.env.lgAvg, refRate: ctx.env.refAvg } : null,
        gamma: cfg.environment.gamma_avg,
        prior: ctx.prior?.avg ?? null,
        kappa: cfg.shrinkage.kappa_meet,
        AB: ctx.AB,
        anchorPoints: cfg.meet_anchors.points,
        clampCfg: cfg.clamp,
        baselineRating: baselineMeet,
      });
      led.add('vs_left_delta', delta, {
        reason: `対左-対右の打率差${(platoon.meetDiff * 1000).toFixed(0)}厘（対左打数${platoon.vsLAb}、信頼度${platoon.reliability.toFixed(2)}）ぶんを平均得能込み基準から除いた（仕様05 §2/§4）。対左側が総合打率を占める比率${(platoon.weight * 100).toFixed(0)}%で按分`,
        informationSource: 'platoon_split',
        provisional: true,
      });
    } else {
      led.skip('vs_left_delta', platoon?.reason ?? `Tier ${ctx.contextTier}。対左右の分割データ不足のため調整なし`);
    }
  }

  // 仕様§5.4/05 §6: 高パワーなら同打率でもミートを下げる
  // → 打球中間層をエンジンに接続した時点で構造的に成立するため、係数での調整は行わない
  led.skip('power_interaction_delta',
    '打球中間層（外野フライは本塁打.089と同時に二塁打.149を生む）により、高パワーが打率に寄与する関係が式から導かれる。係数での上乗せは二重計上になる');

  // 仕様§7: 内野安打の走力寄与
  if (ctx.infieldHitAbility) {
    led.add('infield_hit_delta', -cfg.special_abilities.infield_hit.meet_offset, {
      reason: `内野安打○を付与するため、その分の打率寄与をミートから外す（${ctx.infieldHitAbility.basis}）`,
      informationSource: 'ground_ball_singles',
      provisional: true,
    });
  } else {
    led.skip('infield_hit_delta', '内野安打○の付与条件に達しないため、ゴロ単打はミートに含めたまま（仕様§7「ゼロ扱いにもしない」）');
  }

  return led.finalize();
}

/**
 * パワーの基礎能力への反映（仕様05 §2・§4「HR/ISO差→対左パワー効果」）。
 * チャンス（得点圏）は仕様05 §3がAVGの式のみを定めておりHR側の反映式を持たないため、
 * 対左のHR率差のみをここで扱う（ミート側の対左差分は buildMeetLedger が担当）。
 *
 * HR率の対左右差は、対左/対右の実測HR数から直接計算する（plattonDifferentialのhrRateDiff）。
 * sluggingDiff（長打差、二塁打・三塁打を含む）ではなく、HR率そのものの差を使うのは、
 * 長打差→HR率への変換に「係数のハードコード禁止」に触れる変換式が要るため。
 * したがって二塁打・三塁打の対左右差は本実装では基礎能力に反映されない（既知の限界）。
 */
export function buildPowerLedger(baselinePower, ctx, cfg) {
  const led = new AdjustmentLedger('power', baselinePower);

  const platoon = ctx.platoon;
  const gate = cfg.special_abilities.base_reflection?.power_from_platoon;
  if (!gate?.enabled) {
    led.skip('platoon_power_delta',
      '検証の結果、反映しないと決めた（configs/ratings.json special_abilities.base_reflection.power_from_platoon）。'
      + '対左右の本塁打率差は観測の92.4%が雑音で、パワプロ141人との誤差も5.15→5.55と悪化した。'
      + '対左の得能は表示側で従来どおり出る');
  } else if (ctx.rawHrPerAb == null) {
    led.skip('platoon_power_delta', 'HR率の基準値が無いため調整不能');
  } else if (platoon?.hrRateDiff != null) {
    const rawNeutral = ctx.rawHrPerAb - platoon.weight * platoon.reliability * platoon.hrRateDiff;
    const delta = neutralizedDelta({
      rawNeutral,
      env: ctx.env ? { lgRate: ctx.env.lgHrRate, refRate: ctx.env.refHrRate } : null,
      gamma: ctx.gammaUsed ?? cfg.environment.gamma_hr,
      prior: ctx.prior?.hr ?? null,
      kappa: cfg.shrinkage.kappa_power,
      AB: ctx.AB,
      anchorPoints: cfg.power_anchors.points,
      anchorScale: cfg.ab_ref.value,
      clampCfg: cfg.clamp,
      baselineRating: baselinePower,
    });
    led.add('platoon_power_delta', delta, {
      reason: `対左-対右のHR率差(実測)${(platoon.hrRateDiff * 1000).toFixed(2)}厘（対左打数${platoon.vsLAb}、信頼度${platoon.reliability.toFixed(2)}）ぶんを平均得能込み基準から除いた（仕様05 §2/§4）。対左側が総合HR率を占める比率${(platoon.weight * 100).toFixed(0)}%で按分。二塁打・三塁打の対左右差は未反映（既知の限界）`,
      informationSource: 'platoon_split',
      provisional: true,
    });
  } else {
    led.skip('platoon_power_delta', platoon?.reason ?? '対左右のHR実測データ不足のため調整なし');
  }

  return led.finalize();
}

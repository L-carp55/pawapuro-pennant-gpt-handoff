// 選手カードの能力欄を、ゲームの構成どおりに組み立てる。
//
// オーナー確定（2026-08-01）:
//   - **内部は全部100段階の連続値で持ち、表示だけランク（G〜S）へ落とす**
//     査定はもともと連続した数値で出るので、ランクへ丸めると情報が消える
//     （Cの上の方と下の方が同じになる）。試合計算も連続値の方が精度が出る。
//   - 本家に無いがデータから測れるもの（三振のしにくさ・選球眼・フレーミング・ブロッキング）は
//     **独自の基礎能力として残す**。本家の不満のひとつが「選手の違いが雑」なので、取れる違いは残す。
//
// 構成:
//   基礎能力（本家7つ）  弾道 / ミート / パワー / 走力 / 肩力 / 守備力 / 捕球
//   独自の基礎能力        三振のしにくさ / 選球眼 /（捕手）フレーミング / ブロッキング
//   ランク得能            チャンス / 対左 / 盗塁 / 走塁 / 送球 / けがしにくさ
//   守備適性              位置ごと（能力とは別管理。仕様04 §12）
//
// 守備力・捕球・肩力について:
//   ゲームでは選手に1つずつ。守れる位置の違いは「適性」で表す。
//   一方で査定は位置ごとに出る（同じ選手でも二塁と遊撃で数字が違う）ので、
//   **表の能力は主位置の値**とし、位置ごとの内訳は内部に残す。
//   肩力だけは位置に関係なく選手の属性なので、位置別に繰り返さず1つに畳む。

const clamp100 = v => (v == null || !Number.isFinite(v)) ? null : Math.max(1, Math.min(100, v));
const r1 = v => (v == null || !Number.isFinite(v)) ? null : Math.round(v * 10) / 10;

/**
 * 100段階 → ランク。境界は configs/ratings.json の rank_scale で持つ（ハードコードしない）。
 * @returns {null|string}
 */
export function toRank(value, cfg) {
  if (value == null || !Number.isFinite(value)) return null;
  for (const [rank, min] of cfg.rank_scale.thresholds) if (value >= min) return rank;
  return cfg.rank_scale.thresholds.at(-1)[0];
}

/**
 * 目盛りの較正（2026-08-01）。
 *
 * パワプロ143人を正解として突き合わせたところ、走力は**相関0.727で順序は合っている**のに
 * 中心が14.6点低く・幅が1.38倍狭かった。「リーグ平均＝50」を、再現対象の実分布を
 * 確認せずに置いていたのが原因。中心と幅だけを合わせる（順序は変えない）。
 * 較正値は configs/ratings.json の scale_calibration（scripts/calibrate_scale_vs_pawapuro.mjs が測る）。
 *
 * 相関が低い能力（守備力・捕球）は較正しない。目盛りだけ合わせても順序が違うため、
 * 誤差はむしろ増える（実測: 捕球 12.1→14.0）。
 * ※【2026-08-04 訂正】ここに「**材料の問題**」と書いていたが誤り。正しくは
 * 「仕様が第1階層に置く直接計測を使っていない状態での頭打ち」。しかも捕球については、
 * 仕様04 §4.2が名指しする**捕逸(pb)がDBに1,156行あるのに src/ で一度も読んでいない**
 * （肩力側の総当たりでは捕逸/試合が全候補中で最高相関+0.554を記録している）。
 * 「材料を総当たりして限界」という主張自体が、仕様が挙げる材料を落としたまま出されていた。
 * 詳細=configs/ratings.json の scale_calibration.not_applied.*._tier_correction_20260804、調査=T-0089。
 */
export function applyScale(value, ability, cfg) {
  if (value == null) return value;
  const c = cfg.scale_calibration?.applied?.[ability];
  return c ? c.intercept + c.slope * value : value;
}

/** 較正の出所を設定から引く。能力ごとに合わせ先も件数も違うので、刻印を定数にしない。 */
const scaleProvenance = (ability, cfg) => {
  const a = cfg.scale_calibration?.applied?.[ability];
  if (!a) return null;
  if (a._basis) return `${a._basis}${a._n ? `（n=${a._n}）` : ''}`;
  return a._n ? `中心と幅を較正済み（n=${a._n}）` : '中心と幅を較正済み';
};

/** 数値とランクを対で持つ（内部は数値・表示はランク、の実装） */
const graded = (value, cfg, extra = {}, ability = null) => {
  const raw = value;
  const v = clamp100(ability ? applyScale(value, ability, cfg) : value);
  if (v == null) return null;
  const calibrated = ability && cfg.scale_calibration?.applied?.[ability] && raw != null;
  return {
    value: r1(v), rank: toRank(v, cfg),
    // ★2026-08-14 修正: 以前は全能力へ一律に「パワプロ143人で…」と刻んでいたが、
    //   走力の applied は SP-016 で n=260 のロスター表示分布合わせへ作り直されており偽だった。
    //   出所は設定側の記録から引く（刻印を手書きの定数にしない）。
    ...(calibrated ? { uncalibrated: r1(raw), _scale: scaleProvenance(ability, cfg) } : {}),
    ...extra,
  };
};

/**
 * 能力欄を組み立てる。
 *
 * @param {object} a
 *   bat        appraiseBatting の戻り（meet/power/contact/eye）
 *   trajectory 弾道 1-4（無ければ null）
 *   run        {speed, stealing, baserunning}
 *   fld        appraiseAllPositions の戻り
 *   splits     {clutch, platoon}（無ければ null）
 *   durability 稼働率 0-1（無ければ null）
 *   powerDisplay ゲーム慣習を当てた後のパワー（仕様02 §6.6）
 */
export function buildAbilitySheet(a, cfg) {
  const {
    bat, trajectory, trajectoryEstimated = false, trajectorySource = null,
    run, fld = [], splits, durability, powerDisplay,
    arm = null, speedOverride = null, powerOverride = null, specialAbilities = {},
  } = a;

  const primary = fld.find(f => f.isPrimary) ?? null;
  // 肩力は選手の属性。守備位置ごとに繰り返さない。
  // その年の守備データが無くても、補殺は2006年から取れるので arm を直接受け取る
  const armSrc = arm ?? fld.map(f => f.arm).find(x => x && !x.is_estimated) ?? fld.map(f => f.arm).find(Boolean) ?? null;

  const base = {
    // 弾道だけ1-4の別尺度。100段階へ引き伸ばさない（意味が変わるため）
    弾道: trajectory == null ? null : (() => {
      const c = cfg.scale_calibration?.applied?.弾道;
      const v = c ? Math.max(1, Math.min(4, Math.round(c.intercept + c.slope * trajectory))) : trajectory;
      return { value: v, scale: '1-4', ...(c && v !== trajectory ? { uncalibrated: trajectory } : {}),
        // ★2026-08-05追加(T-0118): 2019年以前はNPB Basementの実測が無く、
        //   アウト内容の割合からの推定（is_estimated）に切り替わる。実測と混同しないよう明示する
        is_estimated: trajectoryEstimated, estimation_source: trajectoryEstimated ? trajectorySource : null,
        _note: '打球のゴロ／ライナー／フライの構成比から逆算（仕様02 §7）。パワプロ143人で分布を較正'
          + (trajectoryEstimated ? '。★この年は実測が無く推定値（' + trajectorySource + '）' : '') };
    })(),
    ミート: graded(bat?.meet, cfg, {}, 'ミート'),
    // 実測（NPB+のハードヒット率等）があればそれを据える（第1階層は第3階層に優先／仕様04 §1.2）
    パワー: powerOverride
      ? graded(powerOverride.value, cfg, { from_direct_measurement: true,
          statistical_value: powerOverride._statistical_rating,
          source: powerOverride._direct?.source, measured: powerOverride._direct?.measured })
      : graded(powerDisplay ?? bat?.power, cfg,
      powerDisplay != null && bat?.power != null && powerDisplay !== bat.power
        ? { appraised: r1(bat.power), _note: 'ゲーム側の下限を当てた表示値。査定値は appraised（仕様02 §6.6）' } : {},
      'パワー'),
    // スカウティング評価があればそちらを表に出す（統計値は provenance 側に残る）
    // スカウティング評価があればそちらを優先（較正は当てない＝評価はすでにパワプロの目盛り）
    走力: speedOverride
      ? graded(speedOverride.value, cfg, speedOverride._direct
          ? { from_direct_measurement: true, statistical_value: speedOverride._statistical_rating,
              source: speedOverride._direct.source, measured: speedOverride._direct.measured }
          : { from_scouting: true, statistical_value: speedOverride.statistical_value, gap: speedOverride.gap })
      : graded(run?.speed, cfg, {}, '走力'),
    肩力: graded(armSrc?.rating, cfg,
      armSrc?._reconciled?.scouting ? { from_scouting: true, statistical_value: armSrc._reconciled.statistical_value, gap: armSrc._reconciled.gap }
        : armSrc?.is_estimated ? { is_estimated: true, basis: armSrc.basis } : {}),
    守備力: graded(primary?.fielding?.rating, cfg, primary ? { position: primary.pos } : {}),
    捕球: graded(primary?.catching?.rating, cfg, primary ? { position: primary.pos } : {}),
  };

  // 本家に無いが、データから測れるので残す独自の基礎能力（オーナー確定 2026-08-01）
  const extended = {
    三振のしにくさ: graded(bat?.contact, cfg, { _note: '本家に無い独自項目。ゾーン別のコンタクト率から測る' }),
    選球眼: graded(bat?.eye, cfg, { _note: '本家に無い独自項目（プロスピにはランクである）。ボール球に手を出さない度合い' }),
    ...(primary?.catcher ? {
      フレーミング: graded(primary.catcher.framing, cfg, { _note: '捕手のみ。本家に無い独自項目' }),
      ブロッキング: graded(primary.catcher.blocking, cfg, { _note: '捕手のみ。本家に無い独自項目' }),
    } : {}),
  };

  // ランクで持つ得能。内部は100段階のまま（オーナー確定）
  const abilities = {
    チャンス: fromDifferential(splits?.clutch?.diff, splits?.clutch?.reliability, cfg, '得点圏と非得点圏の打率差', cfg.ability_scaling?.clutch),
    対左: fromDifferential(splits?.platoon?.meetDiff, splits?.platoon?.reliability, cfg, '対左と対右のミート差', cfg.ability_scaling?.platoon),
    盗塁: graded(run?.stealing?.rating, cfg),
    走塁: graded(run?.baserunning?.rating, cfg),
    // 送球（精度）。仕様04 §4.3「精度: 送球得能」。肩力（速度）で代用しない。
    // ★2026-08-05に恒久nullをやめた: 守備記録の失策は捕球失策と送球失策を分けていないが、
    //   1球データに「盗塁を許したうえで走者がさらに進塁した」記録があり、これが送球精度そのもの。
    //   ただし事象が稀（リーグ全体2.38%）なので100段階にせず得能（有無）。
    //   偶然と区別できた捕手だけに付く（45人中2人）。それ以外は従来どおり null＝未査定。
    送球: specialAbilities.throwAccuracy ?? null,
    けがしにくさ: durability == null ? null
      : graded(50 + (durability - (cfg.durability?.league_mean_rate ?? 0.5)) * (cfg.durability?.spread ?? 60), cfg,
        { rate: r1(durability * 100) / 100, _note: '規定の出場量に対してどれだけ出続けたか。能力への加点には使わない（仕様02 §8.2）' }),
    // 該当しない得能は null や空配列で置かず、キー自体を出さない（該当なし≠未査定）。
    ...(specialAbilities.strikeout
      ? { [specialAbilities.strikeout.ability]: specialAbilities.strikeout }
      : {}),
    ...(specialAbilities.infieldHit
      ? { [specialAbilities.infieldHit.ability]: specialAbilities.infieldHit }
      : {}),
    ...Object.fromEntries((specialAbilities.gold ?? []).map(x => [x.ability, x])),
  };

  return {
    _scale: '基礎能力・得能とも内部は100段階の連続値。rank は表示用の変換（オーナー確定 2026-08-01）',
    基礎能力: base,
    独自の基礎能力: extended,
    得能: abilities,
    // 守備適性は能力ではない。位置ごとに別管理（仕様04 §12）
    守備適性: fld.map(f => ({ position: f.pos, grade: f.aptitude?.grade ?? null, innings: f.inn })),
    // 位置ごとの守備の内訳（表には出ないが、サブポジで守った時の実力差を残す）
    _fielding_by_position: fld.map(f => ({
      position: f.pos, innings: f.inn, is_primary: f.isPrimary,
      守備力: r1(f.fielding?.rating), 捕球: r1(f.catching?.rating),
    })),
    // ★2026-08-05: 手書きの列挙をやめ、値が null の能力を自動で拾う形にした。
    //   以前は17項目のうち5つしか書かれておらず、**残り12項目は空欄でも未査定に出なかった**。
    //   実害: 捕手19人全員の守備力が null なのに「未査定」に現れず、欠落が黙って通っていた
    //   （原因は fielding_norms.byPos.C.rngrOnSpeed が null＝捕手に守備範囲の指標が存在しないこと。
    //    仕様04 §10.2 は捕手の守備力を「捕球からリリースまでの速さ」と定義しており、
    //    そもそも守備範囲の式を当てるのが誤り。材料の取得は別タスク）。
    //   キーが**存在しない**（捕手以外のフレーミング等）のと、キーはあるが**値が null**なのは別物として扱う。
    未査定: collectUnappraised([base, extended, abilities], primary),
  };
}

/**
 * 値が null の能力を「未査定」として集める（2026-08-05 新設）。
 *
 * なぜ自動化するか:
 *   以前はここが手書きの列挙で、17項目のうち5つしか書かれていなかった。
 *   そのため**新しく欠落が生まれても未査定に現れず、黙って通った**。
 *   実例＝捕手19人全員の守備力が null なのに、査定シートにもカードにも「未査定」と出ていなかった。
 *   列挙を足し忘れる余地を無くすため、null を機械的に拾う形へ変えた。
 *
 * 「キーが無い」と「キーはあるが null」を区別する:
 *   捕手以外にはフレーミング／ブロッキングのキーがそもそも生えない（＝その選手には該当しない）。
 *   これを未査定に混ぜると、全野手に無関係な項目が並ぶ。キーの有無で切り分ける。
 */
const UNAPPRAISED_REASONS = {
  弾道: '打球タイプのデータが無い年',
  肩力: '実測（ARM・補殺）も守備位置からの推定も作れない',
  送球: '送球エラーだけを取り出したデータが公開されていない。肩力で代用しない（仕様04 §4.3）',
  チャンス: '得点圏の分割成績が無い年',
  対左: '対左右の分割成績が無い年',
  守備力: '守備範囲（RngR）が無い',
  捕球: '失策の指標（ErrR）が無い',
  盗塁: '盗塁の企図が無いか、走塁データが無い年',
  走塁: '走塁データ（UBR）が無い年',
  けがしにくさ: '出場量の基準が作れない年',
  ミート: '打撃成績が無い',
  パワー: '打撃成績が無い',
  走力: '走塁データが無い年',
  三振のしにくさ: '打撃成績が無い',
  選球眼: '打撃成績が無い',
  フレーミング: '捕手の投球フレーミングのデータが無い年',
  ブロッキング: '捕手のブロッキングのデータが無い年',
};

export function collectUnappraised(groups, primary) {
  const out = [];
  for (const g of groups) {
    if (!g) continue;
    for (const [name, value] of Object.entries(g)) {
      if (value != null) continue;                 // 査定できている
      let reason = UNAPPRAISED_REASONS[name] ?? '材料が無い';
      // 捕手の守備力だけは原因が構造的なので、その場で理由を言い換える
      // （守備範囲の指標が捕手には存在しない。仕様は「捕球からリリースまでの速さ」と定義しており式の当て先が違う）
      if (name === '守備力' && primary?.pos === 'C') {
        reason = '捕手には守備範囲（RngR）の指標が存在しない。'
          + '仕様04 §10.2 は捕手の守備力を「捕球からリリースまでの速さ」と定めており、'
          + 'その材料（二塁送球タイム等）が未取得';
      }
      out.push(`${name}（${reason}）`);
    }
  }
  return out;
}

/**
 * 差（チャンス・対左）を100段階へ移す。
 * 差そのものは打率差なので、そのままでは能力値にならない。
 * 「平均を50、差1標準偏差ぶんで何点動くか」を設定ファイルの値で決める（恣意的な係数を埋め込まない）。
 * 信頼度が低い（打数が少ない）ぶんは50へ寄せる。
 */
function fromDifferential(diff, reliability, cfg, basis, scaling) {
  if (diff == null || !Number.isFinite(diff) || !scaling) return null;
  const rel = reliability ?? 0;
  const v = 50 + (diff / scaling.sd) * scaling.spread * rel;
  const g = graded(v, cfg);
  return g && { ...g, differential: Math.round(diff * 10000) / 10000, reliability: Math.round(rel * 1000) / 1000, basis };
}

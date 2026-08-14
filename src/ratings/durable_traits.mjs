// 身体能力は複数年で均して推定する（2026-08-01 オーナー指摘への対応）。
//
// 何が問題だったか:
//   走る速さや肩の強さは**年でほとんど変わらない身体の性質**なのに、
//   カードの対象年1年分の観測だけで査定していた。その結果、
//   西川龍馬の走力が年によって 38.9〜54.0（FからD）まで振れていた。
//   同じ選手の走力が1年で2段階も変わるはずがない＝観測のブレを能力差として出していた。
//
// 実測（scripts/内の検証）:
//   同一選手の走力zの年ごとの振れ幅は中央値0.79＝能力値で12点ぶん
//   翌年を当てる力: 単年 r=0.752 → **予測年を除く多年平均 r=0.796**
//   守備範囲 0.368→0.401 ／ 捕球 0.097→0.164 も同様に改善
//
// なぜ打撃は単年のままか:
//   カードの「年」は**その年の打撃成績**を表す（仕様02 §3.1 ピーク単年）。
//   打率や本塁打はその年の出来事だが、走る速さは年をまたいで同じもの。
//   同じ扱いにする理由がない。仕様§8.2も「本人の周辺年をPriorにする」を認めている。
//
// 重みは観測量（打席・守備イニング・試合数）。対象年を特別扱いしない
// （特別扱いすると結局その年のブレが残るため。上の実測は等しく扱った条件で取っている）。

/**
 * 複数年の観測を1つの推定へ畳む。
 *
 * ★窓は既定で対象年の**前後**（左右対称）。身体の性質を推定する目的ではこれで正しいが、
 *   対象年より後の年を使うため、**過去年の査定には後知恵が入り、時間ホールドアウトが成立しない**
 *   （2026-08-13 T-0198で発見。mode='2024' でも speed_seasons に2025が入っていた）。
 *   検証時は `maxSeason` を渡して上限を切る。**未指定なら従来どおり**＝既存の査定値は動かない。
 *
 * @param {Array<{z:number, weight:number, season:number}>} obs
 * @param {number} targetSeason
 * @param {object} opts {maxYearGap} 対象年から何年離れたものまで使うか
 *                      {maxSeason}  この年より後の観測を使わない（時間ホールドアウト用。既定=制限なし）
 * @returns {null|{z, weight, years, seasons, isMultiYear}}
 */
function weightedMean(rows) {
  const w = rows.reduce((s, o) => s + o.weight, 0);
  if (!(w > 0)) return null;
  return rows.reduce((s, o) => s + o.z * o.weight, 0) / w;
}

/**
 * SP-016 continuous historical prior（設計正本 2026-08-14）。
 * 各推定を自身の信頼性で縮小してから精度で合成する。素朴な w=PA/(PA+κ) は棄却済み。
 */
export function continuousPriorPool(obs, targetSeason, opts = {}) {
  const kappa = opts.kappa ?? 50;
  const lambda = opts.lambda ?? 0.2703;
  const cur = obs.filter(o => o.season === targetSeason);
  const hist = obs.filter(o => o.season !== targetSeason);
  const paCur = cur.reduce((s, o) => s + o.weight, 0);
  const paHist = hist.reduce((s, o) => s + o.weight, 0);
  const zCurRaw = cur.length ? weightedMean(cur) : null;
  const zHistRaw = hist.length ? weightedMean(hist) : null;
  let z = null;
  let poolReason = 'CONTINUOUS_PRIOR';
  if (zCurRaw == null && zHistRaw == null) return null;
  if (zCurRaw == null) {
    z = zHistRaw * (paHist / (paHist + kappa));
    poolReason = 'CONTINUOUS_PRIOR_HIST_ONLY';
  } else if (zHistRaw == null) {
    z = zCurRaw * (paCur / (paCur + kappa));
    poolReason = 'CONTINUOUS_PRIOR_CUR_ONLY';
  } else {
    const zCur = zCurRaw * (paCur / (paCur + kappa));
    const zHist = zHistRaw * (paHist / (paHist + kappa));
    const pc = paCur, ph = lambda * paHist;
    z = (pc + ph) > 0 ? (pc * zCur + ph * zHist) / (pc + ph) : null;
    poolReason = 'CONTINUOUS_PRIOR';
  }
  if (z == null) return null;
  return {
    z,
    weight: paCur + lambda * paHist,
    years: obs.length,
    seasons: obs.map(o => o.season).sort(),
    isMultiYear: new Set(obs.map(o => o.season)).size > 1,
    poolReason,
    currentYearWeight: paCur,
    histWeight: paHist,
    kappa,
    lambda,
    zCurRaw,
    zHistRaw,
  };
}

export function poolAcrossYears(obs, targetSeason, opts = {}) {
  const gap = opts.maxYearGap ?? 3;
  const maxSeason = opts.maxSeason ?? null;
  const minWeight = opts.minWeight ?? 0;
  let use = (obs ?? []).filter(o =>
    o && Number.isFinite(o.z) && o.weight > 0 && o.weight >= minWeight
    && Math.abs(o.season - targetSeason) <= gap
    && (maxSeason == null || o.season <= maxSeason));
  if (!use.length) return null;

  const mode = opts.poolingMode
    ?? (opts.currentYearFirst ? 'current_year_first_hard' : 'legacy_auto_pool');

  if (mode === 'continuous_prior') {
    return continuousPriorPool(use, targetSeason, opts);
  }

  // ★SP-016 control: hard current-year-first（50PA 階段）または legacy 自動多年pool。
  let poolReason = 'LEGACY_AUTO_POOL';
  if (mode === 'current_year_first_hard' || opts.currentYearFirst) {
    const cur = use.filter(o => o.season === targetSeason);
    const curW = cur.reduce((s, o) => s + o.weight, 0);
    const need = opts.sufficientWeight ?? 0;
    if (cur.length && curW >= need) { use = cur; poolReason = 'CURRENT_YEAR_SUFFICIENT'; }
    else if (cur.length) poolReason = `LOW_SAMPLE_CURRENT_YEAR(${curW}<${need})`;
    else poolReason = 'NO_CURRENT_YEAR_OBSERVATION';
  }
  const w = use.reduce((s, o) => s + o.weight, 0);
  return {
    z: use.reduce((s, o) => s + o.z * o.weight, 0) / w,
    weight: w,
    years: use.length,
    seasons: use.map(o => o.season).sort(),
    isMultiYear: use.length > 1,
    poolReason,
    currentYearWeight: use.filter(o => o.season === targetSeason).reduce((s, o) => s + o.weight, 0),
  };
}

/**
 * 肩力の材料を合成する（2026-08-01 追加）。
 *
 * ARM（送球で防いだ失点）だけでは強肩を捉えきれない——強肩ほど走者が走ってこないので
 * 機会が減り、年ごとに数字が暴れる（鈴木誠也: 2021年は右翼5位だが2020年はちょうど平均）。
 * 補殺（送球でアウトにした数）を第2の材料として足す。
 *
 * 実測: 2つの相関 r=0.402（別のものを測っている）。翌年のARMを当てる力は
 * ARMだけ0.219／補殺だけ0.263／**2つの平均0.280**。合わせた方が良い。
 * 補殺はプロEYE球にあるため2006年から取れる（ARMは2020年以降のみ）。
 *
 * @param {null|{z,weight}} arm  ARM由来（多年で畳んだもの）
 * @param {null|{z,weight}} assists 補殺由来（多年で畳んだもの）
 * @returns {null|{z, basis, components}}
 */
export function combineArmSources(arm, assists) {
  const have = [
    arm && { ...arm, name: 'ARM（送球で防いだ失点）' },
    assists && { ...assists, name: '補殺（送球でアウトにした数）' },
  ].filter(Boolean);
  if (!have.length) return null;

  // 2つの材料は互いに独立に近い（r=0.402）ので単純平均で足す。
  // 観測量で重み付けすると、単位の違う2つ（イニングと試合）を混ぜることになるため等重みにする
  const z = have.reduce((s, h) => s + h.z, 0) / have.length;
  return {
    z,
    basis: have.length === 2
      ? 'ARMと補殺の平均（2つは別のものを測っており、合わせた方が翌年を当てる）'
      : have[0].name + 'のみ',
    components: have.map(h => ({ source: h.name, z: Math.round(h.z * 1000) / 1000, years: h.years, seasons: h.seasons })),
  };
}

/**
 * 多年で畳んだzを能力値へ。信頼度は**畳んだ後の観測量**で決まるので、
 * 単年より縮小が弱くなり、その分だけ選手間の差が出る。
 */
export function traitRating(pooled, kappa, scale, clampCfg, clampFn) {
  if (!pooled || pooled.z == null) return null;
  const reliability = pooled.weight / (pooled.weight + kappa);
  return {
    rating: clampFn(scale.center + pooled.z * reliability * scale.spread, clampCfg),
    z: pooled.z, reliability,
    years: pooled.years, seasons: pooled.seasons,
    is_multi_year: pooled.isMultiYear,
  };
}

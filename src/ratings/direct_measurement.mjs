// 直接計測（仕様04 §1.2 の第1階層）を能力値へ変換して査定へ渡す。
//
// なぜ要るか:
//   走力・肩力は長らく「走塁の成果」（UBR・三塁打率など＝第3階層）だけで推定していた。
//   受け皿（ability_evidence の direct_measurement）は2026-08-01に実装済みだったが、
//   **データが入っていない状態が続いていた**（カードを開くと direct_measurement: null）。
//   これを「材料の限界」と報告していたのは誤りで、実際は未接続だった（2026-08-04 P-00gで訂正）。
//
// 何を使うか:
//   NPBとMLBの両方でプレーした選手は Statcast の実測（Sprint Speed・送球速度）を持つ。
//   これは仕様が第1階層に置く「直接計測」そのもの。対象は限られる（mlb_bridge 79人）が、
//   その範囲では最上位の証拠になる。
//
// 変換係数の出どころ（configs/ratings.json direct_measurement）:
//   実測 → 能力値の傾きは、同じ選手のパワプロ実装値（405人ラベル）に当てはめて求めた。
//   The Show の同種の変換（別ゲーム・別サンプル）とも突き合わせてある。
//   **走力は2系が一致した**（傾き 11.10 vs 13.63、r=0.945 / 0.915）ので採用。
//   **肩力は一致しなかった**（4.06 vs 1.50 と2.7倍差、しかもパワプロ側は n=6）ので採用しない。
//   ——「レンジ全体で46点ぶん」が両系で揃うのは、各ゲームが観測母集団を能力レンジへ
//   引き伸ばしているためで、傾きが一致した証拠にはならない（正規化の産物）。

/**
 * 実測値を能力値（0-100）へ変換する。
 * @param {number} measured 実測値（Sprint Speedならft/s）
 * @param {object} coef {slope, intercept, min, max}
 */
export function measurementToRating(measured, coef) {
  if (!Number.isFinite(measured) || !coef) return null;
  const raw = coef.slope * measured + coef.intercept;
  return Math.min(coef.max ?? 100, Math.max(coef.min ?? 1, raw));
}

/**
 * 実測が行われた年と査定対象年の隔たりから、証拠の階層を決める。
 *
 * MLBの実測は「その選手がMLBにいた年」のもので、NPBでの査定対象年とはずれることが多い
 * （例: 鈴木誠也の Sprint Speed は2022-2025年、NPBのピークは2019年）。
 * これを「同年度の直接計測」として信頼度0.95で扱うと、6年前の脚力を実測だと言い張ることになる。
 *
 * @param {number[]} measuredYears 実測が行われた年
 * @param {number} targetSeason 査定対象の年
 */
export function tierForYearGap(measuredYears, targetSeason) {
  if (!Array.isArray(measuredYears) || !measuredYears.length || !Number.isFinite(targetSeason)) {
    return { tier: 'direct_near_year', gap: null, note: '実測年が不明のため近接年度として扱う' };
  }
  const gap = Math.min(...measuredYears.map(y => Math.abs(y - targetSeason)));
  if (gap === 0) return { tier: 'direct_same_year', gap, note: null };
  if (gap <= 2) return { tier: 'direct_near_year', gap, note: `実測は${gap}年ずれ` };
  // 3年以上離れると加齢で脚力が変わるため、実測そのものではなく身体測定と同格まで落とす
  return {
    tier: 'scouting_document', gap,
    note: `実測だが査定年から${gap}年離れており、加齢による変化を含む。直接計測としては扱わない`,
  };
}

/** mlb_bridge.detail（JSON文字列）から実測年を取り出す */
export function measuredYearsFromDetail(detail, key) {
  if (!detail) return [];
  try {
    const d = typeof detail === 'string' ? JSON.parse(detail) : detail;
    const arr = d?.[key];
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(x => x?.year).filter(Number.isFinite))];
  } catch { return []; }
}

/**
 * 選手1人分の直接計測を、ability_evidence が受け取る形へ組み立てる。
 *
 * @param {object} row mlb_bridge の1行（sprint_speed_avg・sprint_years・detail など）
 * @param {object} cfg configs/ratings.json の direct_measurement 節
 * @param {number} [targetSeason] 査定対象の年。渡すと年の隔たりで証拠の階層を落とす
 * @returns {{走力: object|null, 肩力: object|null}}
 */
export function buildDirectMeasurements(row, cfg, targetSeason = null) {
  const out = { 走力: null, 肩力: null };
  if (!row || !cfg) return out;

  const speedCfg = cfg.speed;
  if (speedCfg?.enabled && row.sprint_speed_avg != null) {
    const value = measurementToRating(row.sprint_speed_avg, speedCfg);
    if (value != null) {
      const years = measuredYearsFromDetail(row.detail, 'sprint_speed');
      const t = tierForYearGap(years, targetSeason);
      out.走力 = {
        value: Math.round(value * 10) / 10,
        tier: t.tier,
        source: 'MLB Statcast Sprint Speed',
        measured: row.sprint_speed_avg,
        unit: 'ft/s',
        seasons: row.sprint_years ?? null,
        measured_years: years.length ? years : null,
        year_gap: t.gap,
        note: `実測${row.sprint_speed_avg.toFixed(1)} ft/s（${row.sprint_years ?? '?'}年分の平均`
          + `${years.length ? `／${Math.min(...years)}-${Math.max(...years)}年` : ''}）を`
          + `${speedCfg.slope}×実測${speedCfg.intercept >= 0 ? '+' : ''}${speedCfg.intercept} で能力値へ変換。`
          + `較正=${speedCfg.calibrated_on}${t.note ? `。${t.note}` : ''}`,
      };
    }
  }

  // 肩力は係数が独立2系で一致しなかったため既定で無効。
  // 有効化するには configs 側で enabled を立てる（その時は根拠も併せて更新すること）
  const armCfg = cfg.arm;
  if (armCfg?.enabled && row.arm_mph_avg != null) {
    const value = measurementToRating(row.arm_mph_avg, armCfg);
    if (value != null) {
      out.肩力 = {
        value: Math.round(value * 10) / 10,
        source: 'MLB Statcast Arm Strength',
        measured: row.arm_mph_avg,
        unit: 'mph',
        seasons: row.arm_years ?? null,
        note: `実測${row.arm_mph_avg.toFixed(1)} mph を能力値へ変換。較正=${armCfg.calibrated_on}`,
      };
    }
  }
  // 捕手の肩力（NPB+アプリの送球速度）。2026-08-05 オーナー裁定で有効化。
  //
  // ★守備位置で層別しないと関係が見えない材料:
  //   全体（68人）では r=0.036 だが、外野 -0.135 / 内野 +0.137 / **捕手 +0.676** と層で符号すら違う。
  //   層ごとに送球速度の水準が違う（外野134.5 vs 内野123.9 km/h）ため、混ぜると打ち消し合う。
  //   CCは当初これを層別せずに測り「送球速度は肩力に使えないと確定」と報告したが誤りだった。
  //
  // ★観測量が効く: 打席数で絞るほど相関が上がる（全14人 0.676 → 100打席以上10人 0.846 → 200打席以上4人 0.955）。
  //   関係が無いのではなく、観測量の少ない選手が薄めていただけ。したがって縮約が要る。
  const cArm = cfg.catcher_arm;
  if (cArm?.enabled && row.throw_speed_kmh != null && row.is_catcher) {
    const value = measurementToRating(row.throw_speed_kmh, cArm);
    if (value != null) {
      out.肩力 = {
        value: Math.round(value * 10) / 10,
        tier: 'direct_near_year',   // 実測2026 × 査定2024＝2年ずれ（tierForYearGapの規律と同じ扱い）
        source: 'NPB+アプリ 送球速度（平均）',
        measured: row.throw_speed_kmh,
        unit: 'km/h',
        observed_plate_appearances: row.pa_2026 ?? null,
        position_scope: '捕手のみ',
        note: `送球速度${row.throw_speed_kmh.toFixed(1)} km/h を `
          + `${cArm.slope}×実測${cArm.intercept >= 0 ? '+' : ''}${cArm.intercept} で能力値へ変換。`
          + `較正=${cArm.calibrated_on}（n=${cArm.n}、残差${cArm.residual_rmse}点）。`
          + `★暫定——採否の正式な物差し（エンジンでのリーグ分布一致）は未実装`,
      };
    }
  }

  // NPB+アプリの実測（2026年103人）を パワー・走力 へ（2026-08-05 オーナー承認、T-0107）。
  //
  // どの実測をどの能力に使うかは、2024年の査定との相関で決めた（パワプロの値では決めていない）:
  //   ハードヒット率→パワー +0.720 ／ スイング速度→パワー +0.683 ／ バレル率→パワー +0.712
  //   瞬間最高速度→走力 +0.757 ／ 一塁到達→走力 -0.746
  //   ミートはどれとも無関係（最大+0.219）＝打球の強さと当てる技術は別、で理にかなっている。
  //
  // ★弾道は入れない: 打球角度との相関は train 0.354 → **test 0.129** まで落ちた。
  //   ホールドアウトで保たれないものは採らない。
  //
  // 同じ能力に複数の実測があるときは、test での一致が高い順に**1つだけ**使う。
  // 平均すると「同じ打球の強さを別の切り口で見た値」を重ねることになり、二重に効く。
  const npbPlus = cfg.npb_plus_direct?.models;
  if (npbPlus) {
    const HOLDOUT_MIN = 0.30;          // test でこれ未満なら使わない
    // ★2026-08-06 オーナー指摘で追加。**仕様アンカーを持つ能力にはこの経路を使わない**。
    //   NPB+のモデルは scripts/calibrate_npb_plus_direct.mjs が
    //   `SELECT power ... FROM pawapuro_full` でパワプロの能力値を目標に当てはめた式なので、
    //   出てくる値は「パワプロの目盛りの上の点数」。これを混ぜると、仕様アンカー
    //   （20本→70 / 30本→80 / 46本→90、オーナー裁定済み）で作った値がパワプロの目盛りへ
    //   引き戻される。実害: 山川2024は素点88.5（オーナーが2026-07-31に89.8で妥当と裁定した水準）
    //   だったのに、この混合で78.9まで下がっていた。
    //   ★実測そのものを捨てるわけではない。捨てるのは「パワプロの目盛りへの変換式」。
    //   正しい直し方＝ハードヒット率→**本塁打率**を当てはめ、その本塁打率を power_anchors に
    //   通す（目盛りの出所を1つにする）。それまでは適用しない＝T-0147。
    //   走力・弾道にはアンカーが無く、目盛りの根拠自体がパワプロ由来（zscore_ratings の
    //   center=50/spread=15 は「パワプロの能力値分布に合わせた暫定値」と自己申告）なので、
    //   そちらは引き続き使ってよい＝出所が1つのままで矛盾しない。
    const anchored = new Set(cfg.scale_calibration?.not_applied_has_spec_anchor
      ? Object.keys(cfg.scale_calibration.not_applied_has_spec_anchor).filter(k => !k.startsWith('_'))
      : []);
    for (const ability of ['パワー', '走力']) {
      if (out[ability]) continue;      // 既に別の直接計測が入っているなら上書きしない
      if (anchored.has(ability)) continue;   // 仕様アンカーがある能力はパワプロ目盛りで上書きしない
      const cands = Object.entries(npbPlus)
        .filter(([metric, m]) => m.ability === ability
          && (m.test_r ?? 0) >= HOLDOUT_MIN
          && row[metric] != null)
        .sort((a, b) => (b[1].test_r ?? 0) - (a[1].test_r ?? 0));
      if (!cands.length) continue;
      const [metric, m] = cands[0];
      const measured = row[metric];
      const value = Math.max(1, Math.min(100, m.intercept + m.slope * measured));
      out[ability] = {
        value: Math.round(value * 10) / 10,
        tier: 'direct_near_year',      // 実測2026 × 査定年が離れる
        source: `NPB+アプリ ${metric}`,
        measured, unit: m.unit,
        note: `${metric} ${measured}${m.unit} を ${m.slope.toFixed(3)}×実測`
          + `${m.intercept >= 0 ? '+' : ''}${m.intercept.toFixed(1)} で能力値へ変換。`
          + `train r=${m.train_r}(${m.train_n}人) / test r=${m.test_r}(${m.test_n}人)。`
          + `同じ能力の候補${cands.length}件のうち test の一致が最も高いものを1つだけ使う`,
      };
    }
  }
  return out;
}

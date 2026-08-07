// 選手カードのスキーマ・信頼度・計算ログ（Sol仕様03 §2 / §7 / §8）
//
// 仕様の要求:
//   §2 選手カードスキーマ（peak_single_year では別年度の能力を混ぜてはならない）
//   §7 信頼度を5観点で内部保持する（最終能力は1つの値でも、脆さを把握するため）
//   §8 各選手の計算ログをJSON/YAMLで保存（02 §15「途中式を省略しない」）
//
// 欠損の扱いは仕様03 §1.3 に従う: 不明=null / 実際に0=0 / 推定=値+is_estimated

/** 仕様§2 の必須フィールド。欠けていたら例外を投げる */
const REQUIRED = ['player_id', 'name_ja', 'card_type', 'seasons_used', 'team', 'league', 'primary_position'];
const CARD_TYPES = ['peak_single_year', 'prime_composite'];

/**
 * 信頼度の5観点（仕様§7）。各観点を A/B/C/D で評価する。
 *   A: 直接計測・十分サンプル・完全文脈 / B: 公式集計・一部近似
 *   C: 周辺値・映像/スカウティング / D: 推定が大きい
 */
export function assessConfidence(args) {
  const { pa, contextTier, priorKind, hasTracking, hasFieldingData, provisionalCoeffs } = args;

  // サンプル: 打席数。規定打席443を基準に段階を切る
  const sample = pa >= 443 ? 'A' : pa >= 300 ? 'B' : pa >= 150 ? 'C' : 'D';

  // 出典の質: プロEYE球は公式集計の再計算なのでB。トラッキング実測があればA
  const source_quality = hasTracking ? 'A' : 'B';

  // 文脈一致: 仕様§5.1のTier。A=対右×非得点圏、B=対右のみ、C=総合のみ
  const context_match = contextTier === 'A' ? 'A' : contextTier === 'B' ? 'C' : 'D';

  // Priorの質: 本人の周辺年 > 二軍換算 > リーグ平均
  const prior_quality = priorKind === 'self_recent' ? 'A'
    : priorKind === 'farm' ? 'C'
      : priorKind === 'league' ? 'D' : 'B';

  // ゲーム内校正: 未校正の係数をいくつ使っているか
  const game_calibration = provisionalCoeffs === 0 ? 'B'
    : provisionalCoeffs <= 2 ? 'C' : 'D';

  const RANK = { A: 4, B: 3, C: 2, D: 1 };
  const parts = [sample, source_quality, context_match, prior_quality, game_calibration];
  const mean = parts.reduce((a, x) => a + RANK[x], 0) / parts.length;
  const overall = mean >= 3.5 ? 'A' : mean >= 2.5 ? 'B' : mean >= 1.75 ? 'C' : 'D';

  return {
    sample, source_quality, context_match, prior_quality, game_calibration, overall,
    _note: hasFieldingData ? null : '守備の高度指標が無い年のため、守備能力は未査定',
    _legend: 'A=直接計測・十分サンプル・完全文脈 / B=公式集計・一部近似 / C=周辺値 / D=推定が大きい',
  };
}

/**
 * 計算ログ（仕様§8）。入力から最終値までの全段を残す。
 * 「なぜこの能力値になったか」を後から完全に再現できることが目的。
 */
export function buildCalcLog(args) {
  const { line, bat, run, fld, ledgers, env, prior, cfg, contextTier, trajectoryEstimated, trajectorySource } = args;
  const o = bat?.observed ?? {};

  return {
    inputs: { ...line },
    context_tier: contextTier,
    environment: env ? {
      reference_season: cfg.environment.reference_season,
      applied: o.envApplied ?? false,
      gamma_avg: cfg.environment.gamma_avg,
      gamma_hr_used: o.gammaUsed ?? null,
      _gamma_hr_note: '本塁打のgammaは水準別（強打者ほど環境に流されない）。実測=中央値1.106/上位5%0.626/上位1%0.118',
      league_avg: env.lgAvg, league_hr_rate: env.lgHrRate,
      ref_avg: env.refAvg, ref_hr_rate: env.refHrRate,
    } : null,
    prior: prior ? { kind: prior.kind, basis: prior.basis, avg: prior.avg, hr: prior.hr } : null,
    shrinkage: {
      kappa_meet: cfg.shrinkage.kappa_meet,
      kappa_power: cfg.shrinkage.kappa_power,
      _method: 'post = (AB×観測 + kappa×Prior)/(AB+kappa)（仕様03 §4.3）',
      _note: 'kappa_meet/kappa_power は上限値。実際にこの選手へ使われた値は kappa_used を見る',
      kappa_used: o.kappaUsed ?? null,
    },
    meat: bat ? {
      // ★2026-08-05修理: 以前はここが総打率(o.raw.avg)を context_avg というキー名で記録していた。
      //   Tier B と表示されながら中身は総合、という状態を計算ログからも読み取れなかった。
      //   いまは実際に査定へ入った文脈の打率を出し、どの文脈かを併記する。
      context_avg: o.avgContext?.rawAvg ?? o.raw?.avg ?? null,
      context_tier_used: o.avgContext?.tier ?? 'C（総合）',
      context_ab: o.avgContext?.AB ?? line.AB,
      context_league_avg: o.avgContext?.lgAvg ?? env?.lgAvg ?? null,
      env_avg: o.preShrink?.avg ?? null,
      post_avg: o.avg ?? null,
      mean_ability: bat.meet,
      adjustments: ledgers?.[0]?.adjustments ?? null,
      final: ledgers?.[0]?.final ?? bat.meet,
    } : null,
    power: bat ? {
      hr_rate: line.AB > 0 ? line.HR / line.AB : null,
      hr_500paeq_raw: o.raw?.hrPer500 ?? null,
      // ★2026-08-05追加: 球場補正が計算ログに1行も残っていなかった。
      //   本塁打率をこの係数で割っており結果に効いているのに、後から「なぜこの値か」を
      //   追えない状態だった（開発原則「計算ログを全選手で保存」に反する）。
      //   park_skipped は「係数はあるが被覆率が足りず未適用」の記録。
      park: o.parkFactor ? {
        factor: o.parkFactor.factor,
        coverage: o.parkFactor.coverage,
        covered_ab: o.parkFactor.coveredAB,
        total_ab: o.parkFactor.totalAB,
        parks: o.parkFactor.parks,
        unmatched_parks: o.parkFactor.unmatchedParks ?? null,
        _note: '本塁打率をこの係数で割る。打ちやすい球場（>1）の選手ほど割り引かれる',
      } : null,
      park_skipped: o.parkSkipped ?? null,
      env: o.preShrink?.hrPer500 ?? null,
      post: o.hrPer500 ?? null,
      mean_ability: bat.power,
      _ab_ref: cfg.ab_ref.value,
      _ab_ref_note: '基準打数。2026-08-01にオーナー承認で436.25→490（規定到達者の実平均）',
      adjustments: ledgers?.[1]?.adjustments ?? null,
      final: ledgers?.[1]?.final ?? bat.power,
    } : null,
    other_batting: bat ? { contact: bat.contact, eye: bat.eye } : null,
    // 弾道の出典（2026-08-05追加、T-0118）。実測か推定かを計算ログでも追えるようにする
    trajectory: { is_estimated: !!trajectoryEstimated, source: trajectorySource ?? null },
    running: run ? {
      speed: run.speed,
      speed_display: run.speedDisplay ?? null,
      speed_evidence: run.speedEvidence ?? null,
      stealing: run.stealing?.rating ?? null, baserunning: run.baserunning?.rating ?? null,
      _speed_z_final: run._z, _speed_z_single_year: run._singleYearZ ?? null,
      // ★2026-08-05修理: 走力の複数年プール（身体能力は年でほとんど変わらないため均す仕組み）の
      //   根拠（何年ぶんを使ったか）が計算はされているのに計算ログへ渡っていなかった。
      //   肩力(arm)は既にログに出ているのに、走力だけ「複数年プールを使った証拠」が見えない状態だった
      speed_is_multi_year: run.speedDetail?.isMultiYear ?? null,
      speed_years: run.speedDetail?.years ?? null,
      speed_seasons: run.speedDetail?.seasons ?? null,
    } : null,
    fielding: fld?.length ? fld : null,
    special_abilities: ledgers?.flatMap(l => l.abilities ?? []) ?? [],
  };
}

/**
 * 選手カードを組み立てる。仕様§2のスキーマ検証つき。
 * @throws スキーマ違反（必須欠落・不正なcard_type・単年カードなのに複数年）
 */
export function buildCard(args) {
  const {
    player, cardType, seasonLabel, seasonsUsed, ratings, calcLog, confidence,
    formula = null, sources = [], estimated = [], unresolved = [], freezeCommit = null,
  } = args;

  const card = {
    player_id: player.player_id,
    name_ja: player.name_ja,
    name_en: player.name_en ?? null,
    card_type: cardType,
    // 仕様§3.1「ピーク単年カードは一つの年度のみをラベルにする」
    // 仕様§3.2「全盛期合成カードは単一年のラベルを付けない」→ null
    season_label: cardType === 'prime_composite' ? null : seasonLabel,
    seasons_used: seasonsUsed,
    team: player.team,
    league: player.league ?? null,
    team_games: player.team_games ?? null,
    primary_position: player.primary_position,
    secondary_positions: player.secondary_positions ?? [],
    bats: player.bats ?? null,
    throws: player.throws ?? null,
    source_freeze_commit: freezeCommit,

    ratings,
    // 合成カードは合成式を公開する（仕様§3.2）
    composition: formula,
    confidence,
    calc_log: calcLog,
    provenance: {
      sources,
      estimated,
      retrieved_note: 'プロEYE球（https://proeyekyuu.com）／NPB Basement（https://npbbasement.com）',
    },
    unresolved,
    generated_by: 'pawapuro-pennant appraisal v0 (2026-08-01)',
  };

  validateCard(card);
  return card;
}

/** スキーマ検証（仕様§2）。違反は握りつぶさず例外にする */
export function validateCard(card) {
  const missing = REQUIRED.filter(k => card[k] == null || (Array.isArray(card[k]) && !card[k].length));
  if (missing.length) throw new Error(`カードの必須フィールドが欠落: ${missing.join(', ')}`);

  if (!CARD_TYPES.includes(card.card_type)) {
    throw new Error(`不正な card_type: ${card.card_type}（許可: ${CARD_TYPES.join(' / ')}）`);
  }
  // 仕様§3.1: ピーク単年で別年度を混ぜてはならない
  if (card.card_type === 'peak_single_year') {
    if (card.seasons_used.length !== 1) {
      throw new Error(`peak_single_year は1年のみ使用可（実際: ${card.seasons_used.join(', ')}）`);
    }
    if (card.season_label !== card.seasons_used[0]) {
      throw new Error(`season_label(${card.season_label}) と seasons_used(${card.seasons_used[0]}) が不一致`);
    }
  }
  // 仕様§3.2: 合成カードに単一年ラベルを付けない
  if (card.card_type === 'prime_composite') {
    if (card.season_label !== null) throw new Error('prime_composite に season_label を付けてはならない');
    if (card.seasons_used.length < 2) throw new Error('prime_composite は複数年が必要');
    if (!card.composition?.description) throw new Error('prime_composite は合成式の公開が必須（仕様§3.2）');
  }
  return true;
}

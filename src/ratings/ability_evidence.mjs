// 能力値1つを「証拠の束」として持つ構造（2026-08-01、GPT回答の推奨を実装）。
//
// なぜ要るか:
//   走力を三塁打率・併殺回避・UBRの等ウェイト平均で出していたが、これらが測るのは
//   **走塁の成果**であって純粋な脚力ではない。GPTの回答も独立に同じ診断をした——
//   「等ウェイトで平均すると純粋脚力ではなく走塁結果を推定する。**目的変数が走力になっていない**」。
//
//   したがって代理指標は「能力の合成値」ではなく、**直接測定を予測する説明変数へ格下げ**する。
//   能力値は複数の証拠を段階的に統合した事後推定として持ち、どの証拠がどれだけ効いたかを残す。
//
// 証拠の優先順（GPT回答 Q3。上ほど強い）:
//   1. 同年度の直接速度計測（NPB+ スプリントスピード・最高送球速度）
//   2. 近接年度の直接計測
//   3. 信頼できる映像計測
//   4. 出典付きのスカウティング・身体測定（ドラフト時の50m走・遠投・投手球速）
//   5. 結果指標（ARM・補殺・三塁打・UBR）
//   6. 印象のみ
//
// 「根拠が固い代理指標」より「測りたい能力に近い直接測定」を優先する。
// 直接測定が無い時は、代理指標だけを平均して客観値だと断定しない。

/** 証拠の階層。数字が小さいほど強い */
export const EVIDENCE_TIERS = {
  direct_same_year: { rank: 1, label: '同年度の直接計測', confidence: 0.95 },
  direct_near_year: { rank: 2, label: '近接年度の直接計測', confidence: 0.85 },
  video_measurement: { rank: 3, label: '映像からの計測', confidence: 0.70 },
  scouting_document: { rank: 4, label: '出典付きスカウティング・身体測定', confidence: 0.60 },
  outcome_proxy: { rank: 5, label: '結果指標（成果から推定）', confidence: 0.35 },
  impression: { rank: 6, label: '印象のみ', confidence: 0.15 },
};

/**
 * 能力値1つ分の記録を組み立てる。
 *
 * @param {object} a
 *   direct     {value, source, season, note} | null  直接計測（NPB+等）
 *   prior      {value, source, basis, dated} | null  スカウティング・身体測定・オーナー評価
 *   proxies    {value, components, reliability} | null 結果指標から出した推定
 *   ability    能力名（走力・肩力など）
 * @returns {object} 6要素を持つ記録
 */
export function buildAbilityEvidence(a) {
  const { direct = null, prior = null, proxies = null, ability } = a;

  // 事後推定: 強い証拠から順に採る。同順位が複数あれば信頼度で重み付け
  const candidates = [
    // direct.tier は「実測年と査定年の隔たり」で決まる（direct_measurement.mjs tierForYearGap）。
    // 6年前のMLB実測を「同年度の直接計測」と呼ばないため、呼び出し側の指定を優先する
    direct && { tier: direct.tier ?? 'direct_same_year', value: direct.value, src: direct },
    prior && { tier: prior.tier ?? 'scouting_document', value: prior.value, src: prior },
    proxies && { tier: 'outcome_proxy', value: proxies.value, src: proxies },
  ].filter(c => c && Number.isFinite(c.value));

  if (!candidates.length) {
    return {
      ability, posterior_rating: null, confidence: 0,
      direct_measurement: null, scouting_prior: null, outcome_proxies: null,
      provenance: { decided_by: null, note: 'どの階層の証拠も無い' },
    };
  }

  candidates.sort((x, y) => EVIDENCE_TIERS[x.tier].rank - EVIDENCE_TIERS[y.tier].rank);
  const best = candidates[0];
  const tierDef = EVIDENCE_TIERS[best.tier];

  // 代理指標だけの場合は信頼度をさらに観測量で割り引く
  const conf = best.tier === 'outcome_proxy'
    ? tierDef.confidence * (proxies?.reliability ?? 1)
    : tierDef.confidence;

  return {
    ability,
    posterior_rating: Math.round(best.value * 10) / 10,
    confidence: Math.round(conf * 100) / 100,
    direct_measurement: direct,
    scouting_prior: prior,
    // 代理指標は「能力そのもの」ではなく、直接測定を予測する材料として残す
    outcome_proxies: proxies ? {
      ...proxies,
      _role: '直接測定を予測する説明変数。これ単独を能力値と断定しない（GPT回答 Q1/Q3）',
    } : null,
    provenance: {
      decided_by: best.tier,
      decided_by_label: tierDef.label,
      alternatives: candidates.slice(1).map(c => ({
        tier: c.tier, label: EVIDENCE_TIERS[c.tier].label, value: Math.round(c.value * 10) / 10,
      })),
      note: best.tier === 'outcome_proxy'
        ? '結果指標のみ。測りたい能力（純粋な脚力・肩の強さ）とは別の量を測っている点に注意'
        : null,
    },
  };
}

/**
 * 直接計測が取れたら、代理指標との写像を学習して歴史選手へ広げる——
 * その入口。いまは直接計測が無いので受け口だけ用意する。
 *
 * GPT回答 Q4の推奨: NPB+（2026-02-26 正式サービス開始）がスプリントスピード・
 * 最速一塁到達・最高送球速度を掲載している。ただし利用規約がBOT・
 * リバースエンジニアリングを禁止しており、**一括自動取得はしない**。
 * 取得方法はオーナー判断（規約照会を含む）。
 */
export const DIRECT_MEASUREMENT_STATUS = {
  available: false,
  source_candidate: 'NPB+（日本野球機構公認アプリ、2026-02-26正式サービス開始）',
  fields: ['スプリントスピード', '最速一塁到達タイム', '最高送球速度', '打球速度', '打球角度', 'バレル率'],
  coverage: '実質2025年以降。それ以前への遡及提供は未確認',
  blocker: '利用規約がBOT等による操作とリバースエンジニアリングを禁止。一括取得は行わない。'
    + '取得可否と方法はオーナー判断（NPBへの許諾照会を含む）',
  _recorded_at: '2026-08-01',
};

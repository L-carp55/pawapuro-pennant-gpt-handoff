// スカウティング評価（仕様04 §1.2 第2階層）を査定へ取り込む。
//
// なぜ必要か（2026-08-01 オーナー指摘「走力・肩力の査定がおかしい」の調査結果）:
//   仕様はデータを3階層で定めている。
//     第1階層 Sprint Speed / 50m走 / 一塁到達タイム
//     第2階層 公式スカウティング / 代走起用 / 映像計測
//     第3階層（補助）三塁打率 / 内野安打率 / 併殺回避 / UBR
//   実装は第3階層だけで作られていた。第3階層が測っているのは**走塁の成果**で、
//   仕様が求める**純粋な脚力**とは別の量。成果には「走る機会」「走らせる判断」
//   「打球の質」が混ざるため、統計の変換をどう工夫しても脚力そのものには届かない。
//
//   交絡の候補は2つとも実測で棄却した:
//     - 長打力が三塁打を汚染している → 同一選手内で本塁打率が変わっても三塁打指標は動かない（r=-0.001）
//     - 打順（役割）が機会を抑えている → 同一選手・同一年の1〜2番と3〜5番で差が出ない（t=-1.83／-1.52、符号も逆）
//
//   第1階層は日本で機械可読な形では公開されていない（2026-08-01にWeb調査。
//   名鑑の50m走は手押し計測で0.3秒程度の誤差があり自己申告）。
//   したがって現実的な経路は**第2階層＝人・外部AIによるスカウティング評価**になる。
//
// 設計の要:
//   - スカウティング値は**必ず出典と評価者を持つ**。誰がいつ何を根拠に付けたかが消えない
//   - 統計由来の値と**同じ欄に混ぜない**。どちらから来たかが常に分かる
//   - 統計と食い違った時は**両方を残す**。上書きして片方を消さない
//   - 出典の無いスカウティング値は受け付けない（[[no-fabrication]]の実装）

/** 受け付ける評価者の種別。それぞれ信頼度の既定値が違う */
export const EVALUATOR_KINDS = {
  measured: { weight: 1.00, desc: '実測値（Sprint Speed・計測イベント等）。第1階層' },
  owner: { weight: 0.90, desc: 'オーナー本人の評価。このゲームの基準はオーナーが持つ' },
  scouting_doc: { weight: 0.75, desc: '公表されたスカウティング評価・名鑑の身体データ' },
  external_ai: { weight: 0.60, desc: '外部AI（GPT等）の評価。根拠の記載を必須にする' },
  konami: { weight: 0.50, desc: 'パワプロの値。ゲーム側の慣習であって実測ではない' },
};

export class ScoutingProvenanceError extends Error {}

/**
 * スカウティング入力を1件検証して正規化する。
 * @param {object} e {player, season, ability, value, evaluator, basis, source, dated}
 * @throws {ScoutingProvenanceError} 出典・根拠が無い場合
 */
export function validateEntry(e) {
  if (!e || typeof e !== 'object') throw new ScoutingProvenanceError('入力が空');
  for (const k of ['player', 'ability', 'value', 'evaluator', 'basis']) {
    if (e[k] == null || e[k] === '') {
      throw new ScoutingProvenanceError(
        `スカウティング値には ${k} が要る（${e.player ?? '?'} の ${e.ability ?? '?'}）。` +
        '誰がどんな根拠で付けたかが残らない値は受け付けない');
    }
  }
  if (!EVALUATOR_KINDS[e.evaluator]) {
    throw new ScoutingProvenanceError(
      `評価者の種別が不正: ${e.evaluator}（使えるのは ${Object.keys(EVALUATOR_KINDS).join(' / ')}）`);
  }
  if (!(e.value >= 1 && e.value <= 100)) {
    throw new ScoutingProvenanceError(`値は1-100の範囲（${e.player} の ${e.ability} = ${e.value}）`);
  }
  const application = e.application ?? 'decision';
  if (!['decision', 'evidence_only'].includes(application)) {
    throw new ScoutingProvenanceError(`applicationが不正: ${application}（decision / evidence_only）`);
  }
  return {
    ...e,
    application,
    _weight: EVALUATOR_KINDS[e.evaluator].weight,
    _kind_desc: EVALUATOR_KINDS[e.evaluator].desc,
  };
}

/**
 * 統計由来の値とスカウティング値を突き合わせる。
 *
 * **片方で上書きしない**。両方を持ったうえで、最終的にどちらを表に出すかを決める。
 * 既定はスカウティング優先（第1-2階層が第3階層に優先する、という仕様の順序どおり）。
 * ただし統計値も必ず残し、食い違いの大きさを記録する。
 *
 * @param {number|null} statValue 統計から出した値
 * @param {object|null} scouting validateEntry を通した入力
 * @param {object} opts {preferStatistical} 統計を優先したい場合
 */
export function reconcile(statValue, scouting, opts = {}) {
  if (!scouting) {
    return {
      value: statValue, source: 'statistical', scouting: null,
      note: '第3階層（統計）のみ。純粋な脚力・肩の強さとは別の量を測っている点に注意',
    };
  }
  const gap = statValue == null ? null : Math.round((scouting.value - statValue) * 10) / 10;
  // evidence_only は値そのものをPrior候補・常識チェックとして残すが、最終能力へ全置換しない。
  const useStat = opts.preferStatistical === true || scouting.application === 'evidence_only';
  return {
    value: useStat ? statValue : scouting.value,
    source: useStat ? 'statistical' : `scouting:${scouting.evaluator}`,
    statistical_value: statValue,
    scouting_value: scouting.value,
    gap,
    scouting: {
      evaluator: scouting.evaluator, basis: scouting.basis,
      source: scouting.source ?? null, dated: scouting.dated ?? null,
      confidence: scouting._weight,
      application: scouting.application,
    },
    note: scouting.application === 'evidence_only'
      ? `スカウティング${scouting.value}はevidence_only。統計値${statValue ?? '—'}を上書きせず、Prior候補・常識チェックとして保持`
      : gap == null ? null
      : Math.abs(gap) >= 15
        ? `統計と${Math.abs(gap)}点食い違う。統計は走塁の成果、スカウティングは脚力そのものを見ており、別の量である可能性が高い`
        : `統計との差 ${gap >= 0 ? '+' : ''}${gap}点`,
  };
}

/**
 * スカウティング台帳を読み込む（configs/scouting.json）。
 * 1件でも出典を欠いていたら**その1件だけを落として続行せず、全体を止める**
 * ——静かに欠落すると「入れたつもり」が起きるため。
 */
export function loadLedger(json) {
  const entries = json?.entries ?? [];
  const out = new Map();
  const errors = [];
  for (const e of entries) {
    try {
      const v = validateEntry(e);
      out.set(`${v.player}|${v.season ?? 'any'}|${v.ability}`, v);
    } catch (err) { errors.push(err.message); }
  }
  if (errors.length) {
    throw new ScoutingProvenanceError(
      `スカウティング台帳に不備 ${errors.length}件:\n  - ` + errors.join('\n  - '));
  }
  return out;
}

/** 台帳から1件引く。年が一致するものを優先し、無ければ年指定なしの行 */
export function lookup(ledger, player, season, ability) {
  return ledger.get(`${player}|${season}|${ability}`) ?? ledger.get(`${player}|any|${ability}`) ?? null;
}

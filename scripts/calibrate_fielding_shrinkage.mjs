// 守備の縮小の強さ（kappa_innings）を実データから決める（Sol仕様 04 §8／02 §8.1）。
//
// なぜ必要か:
//   守備の縮小は kappa=400 という未校正の値のままだった。
//   一方 validate_fielding_norms.mjs の実測で、捕球（ErrR由来）は
//   **同じ選手・同じ位置・連続2年でも相関 r=0.155 しかない**と分かった。
//   これは「今年の失策の少なさが来年をほとんど予測しない」＝観測にノイズが多いということで、
//   その場合は能力値をもっと強く平均へ引き戻すべき（引き戻しが弱いと、たまたま失策が
//   少なかった年の選手に高い捕球能力を付けてしまう）。
//
// 決め方（ミート・パワーの kappa と同じ手続き）:
//   ある年の観測を kappa で縮小した推定値が、**翌年の観測**をどれだけ当てるかを測り、
//   予測の二乗誤差が最小になる kappa を採る。恣意的な値を置かない。
//
// 出力: outputs/derived/fielding_shrinkage.json ＋ configs/ratings.json の fielding.kappa_innings

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const MIN_INN = 100;

const rows = db.prepare(`
  SELECT season, player_id, pos, inn, rngr, errr
  FROM bm_fld WHERE farm=0 AND inn>=? AND pos<>'DH'`).all(MIN_INN);

/** ポジション×年ごとに、1000イニングあたりの率を標準化する（年による水準移動を吸収） */
function standardize(metric) {
  const cells = {};
  for (const r of rows) {
    const v = r[metric];
    if (v == null) continue;
    (cells[`${r.season}|${r.pos}`] ??= []).push((v / r.inn) * 1000);
  }
  const stats = {};
  for (const [k, a] of Object.entries(cells)) {
    if (a.length < 8) continue;
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / (a.length - 1));
    if (sd > 0) stats[k] = { mean, sd, n: a.length };
  }
  return rows
    .filter(r => r[metric] != null && stats[`${r.season}|${r.pos}`])
    .map(r => {
      const s = stats[`${r.season}|${r.pos}`];
      return { ...r, z: ((r[metric] / r.inn) * 1000 - s.mean) / s.sd };
    });
}

/** 連続2年・同一ポジションの組を作る */
function pairsOf(zRows) {
  const by = {};
  for (const r of zRows) (by[`${r.player_id}|${r.pos}`] ??= []).push(r);
  const out = [];
  for (const a of Object.values(by)) {
    a.sort((x, y) => x.season - y.season);
    for (let i = 1; i < a.length; i++) if (a[i].season === a[i - 1].season + 1) out.push([a[i - 1], a[i]]);
  }
  return out;
}

/**
 * kappa を1つ試す。
 * 前年の観測zを kappa で0（＝平均）へ縮小した推定値で、翌年の観測zを当てにいく。
 * 縮小の重み = inn/(inn+kappa)。kappaが大きいほど強く平均へ引き戻す。
 */
function mse(pairs, kappa) {
  let s = 0;
  for (const [a, b] of pairs) {
    const w = a.inn / (a.inn + kappa);
    s += (a.z * w - b.z) ** 2;
  }
  return s / pairs.length;
}

/**
 * 本人の周辺年をPriorにする（打撃の §8.2 と同じ考え方を守備へ）。
 * 対象年を**除いた**同一ポジションの他年を、守備イニングで重み付けして平均する。
 * 他年が無ければ null（＝リーグ平均z=0へ縮小する従来どおり）。
 */
function selfPrior(zRows, excludeSeasons, playerId, pos) {
  const others = zRows.filter(o => o.player_id === playerId && o.pos === pos && !excludeSeasons.includes(o.season));
  if (!others.length) return null;
  const w = others.reduce((s, o) => s + o.inn, 0);
  return { z: others.reduce((s, o) => s + o.z * o.inn, 0) / w, inn: w, years: others.length };
}

/**
 * 周辺年Priorを使った場合の予測誤差。
 *
 * **予測する年（b）はPriorから必ず除く**。除かないと答えを見ながら予測することになり、
 * 改善幅が見かけ上いくらでも大きくなる（最初の実装でこれを踏み、47〜53%改善という
 * 無効な数字が出た。2026-08-01）。対象年（a）も除く——aは観測として別に足すため二重計上になる。
 */
function msePrior(pairs, kappa, zRows) {
  let s = 0, used = 0;
  for (const [a, b] of pairs) {
    const p = selfPrior(zRows, [a.season, b.season], a.player_id, a.pos);
    const priorZ = p ? p.z : 0;
    if (p) used++;
    const w = a.inn / (a.inn + kappa);
    s += (a.z * w + priorZ * (1 - w) - b.z) ** 2;
  }
  return { mse: s / pairs.length, used };
}

const result = {};
for (const metric of ['errr', 'rngr']) {
  const z = standardize(metric);
  const pairs = pairsOf(z);
  if (pairs.length < 50) { result[metric] = { n_pairs: pairs.length, note: '組が少なく較正できない' }; continue; }

  // 前年z（縮小前）と翌年zの素の相関＝信号の強さの目安
  const n = pairs.length;
  const mx = pairs.reduce((a, p) => a + p[0].z, 0) / n, my = pairs.reduce((a, p) => a + p[1].z, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [a, b] of pairs) { sxy += (a.z - mx) * (b.z - my); sxx += (a.z - mx) ** 2; syy += (b.z - my) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy);

  let best = null;
  for (let k = 0; k <= 6000; k += 25) {
    const e = mse(pairs, k);
    if (!best || e < best.mse) best = { kappa: k, mse: e };
  }
  const baseline = mse(pairs, 0);            // 縮小しない場合
  const current = mse(pairs, 400);           // 現行の未校正値
  const allShrunk = pairs.reduce((s, [, b]) => s + b.z ** 2, 0) / n; // 全員を平均に置く場合

  // 周辺年をPriorにした場合（予測する年と対象年をPriorから除く）
  let bestPrior = null, havePrior = 0;
  for (let k = 0; k <= 6000; k += 25) {
    const e = msePrior(pairs, k, z);
    havePrior = e.used;
    if (!bestPrior || e.mse < bestPrior.mse) bestPrior = { kappa: k, mse: e.mse };
  }

  // 信頼度から逆算する kappa。
  // 縮小の重み inn/(inn+kappa) は「その守備イニングの観測がどれだけ信じられるか」を表すので、
  // 実測した相関 r（＝その規模の標本の信頼度）と一致させれば kappa が決まる:
  //   inn/(inn+kappa) = r  →  kappa = inn×(1-r)/r
  // 細切れ起用を混ぜると r が下がって kappa を過大にするため、**レギュラー規模の regime で測る**。
  const regRows = z.filter(x => x.inn >= 500);
  const regBy = {};
  for (const x of regRows) (regBy[`${x.player_id}|${x.pos}`] ??= []).push(x);
  const regPairs = [];
  for (const a of Object.values(regBy)) {
    a.sort((x, y) => x.season - y.season);
    for (let i = 1; i < a.length; i++) if (a[i].season === a[i - 1].season + 1) regPairs.push([a[i - 1], a[i]]);
  }
  let kappaFromReliability = null, rReg = null, meanInn = null;
  if (regPairs.length >= 30) {
    const m = regPairs.length;
    const ax = regPairs.reduce((s, p) => s + p[0].z, 0) / m, ay = regPairs.reduce((s, p) => s + p[1].z, 0) / m;
    let cxy = 0, cxx = 0, cyy = 0;
    for (const [a, b] of regPairs) { cxy += (a.z - ax) * (b.z - ay); cxx += (a.z - ax) ** 2; cyy += (b.z - ay) ** 2; }
    rReg = cxy / Math.sqrt(cxx * cyy);
    meanInn = regPairs.reduce((s, p) => s + p[0].inn, 0) / m;
    if (rReg > 0) kappaFromReliability = Math.round(meanInn * (1 - rReg) / rReg);
  }

  result[metric] = {
    n_pairs: pairs.length,
    year_to_year_correlation: r,
    regular_regime: {
      min_innings: 500, n_pairs: regPairs.length,
      correlation: rReg, mean_innings: meanInn,
      kappa_from_reliability: kappaFromReliability,
      _note: '細切れ起用を除いた regime での信頼度。ここから逆算した kappa は「縮小の下限側」',
    },
    league_mean_prior: {
      best_kappa: best.kappa,
      mse: { no_shrinkage: baseline, kappa_400_current: current, best: best.mse, everyone_at_average: allShrunk },
      improvement_vs_current: (current - best.mse) / current,
      beats_flat_average: best.mse < allShrunk,
    },
    self_prior: {
      pairs_with_other_years: havePrior,
      best_kappa: bestPrior.kappa,
      mse: bestPrior.mse,
      improvement_vs_league_mean_prior: (best.mse - bestPrior.mse) / best.mse,
      _note: '対象年と予測年を除いた本人の他年（同一ポジション）を守備イニングで加重平均したものをPriorにする（打撃の仕様02 §8.2と同じ考え方）',
    },
    self_prior_verdict: bestPrior.mse < best.mse
      ? `本人の周辺年をPriorにすると予測が ${(((best.mse - bestPrior.mse) / best.mse) * 100).toFixed(1)}% 改善する`
      : '周辺年Priorでは改善しない（守備は年ごとのブレが大きく、他年も当てにならない）。リーグ平均への縮小を続ける',
    // 採用値。2つの推定は目的が違うので幅として持ち、下限側を採る
    adopted_kappa: kappaFromReliability ?? best.kappa,
    _kappa_bounds: {
      lower: kappaFromReliability,
      upper: best.kappa,
      why_lower: '翌年予測の誤差を最小にする kappa（上限側）には、観測のブレだけでなく'
        + '**本人の実力そのものの年変化**（加齢・守備位置の慣れ・起用の変化）が混ざる。'
        + 'その分だけ縮小しすぎになるため、同じ規模の標本の信頼度から逆算した下限側を採る',
    },
  };
}

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'fielding_shrinkage.json'), JSON.stringify(result, null, 2), 'utf8');

console.log(`守備イニング${MIN_INN}以上で較正\n`);
for (const [metric, v] of Object.entries(result)) {
  const label = metric === 'errr' ? '捕球（ErrR）' : '守備範囲（RngR）';
  console.log(`## ${label}`);
  if (v.note) { console.log(`  ${v.note}（${v.n_pairs}組）\n`); continue; }
  const L = v.league_mean_prior, S = v.self_prior;
  console.log(`  連続2年の組 ${v.n_pairs} / 翌年との相関 r=${v.year_to_year_correlation.toFixed(3)}`);
  console.log(`  [リーグ平均へ縮小]   最適kappa=${L.best_kappa}  誤差${L.mse.best.toFixed(3)}`
    + `（現行400なら${L.mse.kappa_400_current.toFixed(3)} / 全員平均なら${L.mse.everyone_at_average.toFixed(3)}）`);
  console.log(`  [本人の周辺年へ縮小] 最適kappa=${S.best_kappa}  誤差${S.mse.toFixed(3)}`
    + `（他年ありの組 ${S.pairs_with_other_years}/${v.n_pairs}）`);
  const R = v.regular_regime;
  if (R.correlation != null) {
    console.log(`  [レギュラーのみ ${R.min_innings}イニング以上] 相関 r=${R.correlation.toFixed(3)}（${R.n_pairs}組、平均${Math.round(R.mean_innings)}イニング）`
      + ` → 信頼度から逆算した kappa=${R.kappa_from_reliability}`);
  }
  console.log(`  → 採用 kappa=${v.adopted_kappa}（幅 ${v._kappa_bounds.lower}〜${v._kappa_bounds.upper}、下限側を採用）`);
  console.log(`     ${v.self_prior_verdict}\n`);
}

// configs/ratings.json へ書き戻す
const cfgPath = path.join(ROOT, 'configs', 'ratings.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.fielding.kappa_innings_range = result.rngr?.adopted_kappa ?? cfg.fielding.kappa_innings;
cfg.fielding.kappa_innings_catching = result.errr?.adopted_kappa ?? cfg.fielding.kappa_innings;
cfg.fielding._kappa_basis = '2026-08-01 実測（scripts/calibrate_fielding_shrinkage.mjs）。'
  + '守備範囲と捕球で信頼度が違うため kappa を分けた。'
  + `守備範囲は500イニング以上のレギュラーで翌年相関 r=${result.rngr?.regular_regime?.correlation?.toFixed(3)}、`
  + `捕球は r=${result.errr?.regular_regime?.correlation?.toFixed(3)}。`
  + '旧値400は未校正の暫定値だった。細切れ起用を混ぜて測ると相関が下がり kappa を過大にするため、レギュラー regime で測る';
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
console.log(`configs/ratings.json を更新: kappa_innings_range=${cfg.fielding.kappa_innings_range} / kappa_innings_catching=${cfg.fielding.kappa_innings_catching}`);

db.close();

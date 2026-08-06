// 捕球のポジション別校正が妥当かを実データで確かめる（Sol仕様 04 §11）。
//
// 仕様は「同じ守備率でもポジションで難易度が違うので、ポジション×年で標準化する」と言うだけで、
// その標準化が実際に効いているかは書いていない。チェックリスト上も「妥当性検証が未実施」だった。
//
// 確かめること:
//   1. そもそもポジション間で失策の水準が違うか（違わないなら位置別に分ける意味がない）
//   2. 標準化した値が**選手の性質**を測れているか
//      → 同じ選手が2つのポジションを守った時、両方のzが揃うか（揃わなければ位置の癖を測っているだけ）
//   3. 分布が偏りすぎていないか（zスコアは左右対称を前提にする。極端に歪むと中心も幅も意味を失う）
//   4. 年による水準の移動があるか（あるなら「ポジション×年」で標準化すべきで、ポジションだけでは足りない）

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const q = (s, ...a) => db.prepare(s).all(...a);

const MIN_INN = 200;
const POS = ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'C'];

const rows = q(`
  SELECT season, player_id, pos, inn, errr
  FROM bm_fld WHERE farm=0 AND inn>=? AND errr IS NOT NULL AND pos IN (${POS.map(() => '?').join(',')})
`, MIN_INN, ...POS).map(r => ({ ...r, rate: (r.errr / r.inn) * 1000 }));

const stat = a => {
  const n = a.length, mean = a.reduce((x, y) => x + y, 0) / n;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1));
  const m3 = a.reduce((x, y) => x + (y - mean) ** 3, 0) / n;
  const m4 = a.reduce((x, y) => x + (y - mean) ** 4, 0) / n;
  return { n, mean, sd, skew: m3 / sd ** 3, kurt: m4 / sd ** 4 - 3 };
};
const pearson = (xs, ys) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxy / Math.sqrt(sxx * syy);
};

const out = { min_innings: MIN_INN, n_rows: rows.length, checks: {} };

// --- 1. ポジション間で水準が違うか ---
const byPos = {};
for (const p of POS) {
  const a = rows.filter(r => r.pos === p).map(r => r.rate);
  if (a.length >= 20) byPos[p] = stat(a);
}
const means = Object.values(byPos).map(s => s.mean);
const spread = Math.max(...means) - Math.min(...means);
const avgSd = Object.values(byPos).reduce((a, s) => a + s.sd, 0) / Object.keys(byPos).length;
out.checks.position_matters = {
  by_position: byPos,
  mean_spread: spread,
  avg_within_sd: avgSd,
  ratio: spread / avgSd,
  verdict: spread / avgSd > 0.5
    ? 'ポジション間の水準差が選手間のばらつきに対して無視できない → 位置別の標準化は必要'
    : 'ポジション間の差が小さい → 位置別に分ける効果は薄い',
};

// --- 2. 同一選手が2ポジションを守った時、zが揃うか ---
// zは「そのポジション×年」の平均・標準偏差で計算する
const key = r => `${r.season}|${r.pos}`;
const cellStats = {};
for (const r of rows) (cellStats[key(r)] ??= []).push(r.rate);
const cell = {};
for (const [k, a] of Object.entries(cellStats)) if (a.length >= 8) cell[k] = stat(a);

const withZ = rows.filter(r => cell[key(r)]).map(r => ({ ...r, z: (r.rate - cell[key(r)].mean) / cell[key(r)].sd }));
const bySeasonPlayer = {};
for (const r of withZ) (bySeasonPlayer[`${r.season}|${r.player_id}`] ??= []).push(r);

const pairs = [];
for (const a of Object.values(bySeasonPlayer)) {
  if (a.length < 2) continue;
  a.sort((x, y) => y.inn - x.inn);
  pairs.push({ z1: a[0].z, z2: a[1].z, pos1: a[0].pos, pos2: a[1].pos });
}
out.checks.within_player_consistency = pairs.length >= 15 ? {
  n_pairs: pairs.length,
  correlation: pearson(pairs.map(p => p.z1), pairs.map(p => p.z2)),
  verdict: null,
} : { n_pairs: pairs.length, verdict: '同一年に2ポジションを規定イニング守る選手が少なく、検証できない' };
if (out.checks.within_player_consistency.correlation != null) {
  const r = out.checks.within_player_consistency.correlation;
  out.checks.within_player_consistency.verdict = r > 0.3
    ? '同じ選手のzが位置をまたいで揃う → 標準化後の値は選手の性質を測れている'
    : r > 0
      ? '弱い一致にとどまる → 標準化後も位置固有の成分が残っている疑い'
      : '一致しない → 標準化した値を「選手の捕球能力」と呼ぶ根拠が乏しい';
}

// --- 2b. 対照: 同じポジションでの年またぎの一致（指標そのものの安定度） ---
// 2の相関が低くても、それが「標準化の失敗」なのか「指標がそもそも不安定」なのかは
// この対照が無いと区別できない。同じ位置・別の年で測って上限を知る。
const byPlayerPos = {};
for (const r of withZ) (byPlayerPos[`${r.player_id}|${r.pos}`] ??= []).push(r);
const yearPairs = [];
for (const a of Object.values(byPlayerPos)) {
  a.sort((x, y) => x.season - y.season);
  for (let i = 1; i < a.length; i++) if (a[i].season === a[i - 1].season + 1) yearPairs.push({ z1: a[i - 1].z, z2: a[i].z });
}
out.checks.same_position_year_to_year = yearPairs.length >= 15 ? {
  n_pairs: yearPairs.length,
  correlation: pearson(yearPairs.map(p => p.z1), yearPairs.map(p => p.z2)),
} : { n_pairs: yearPairs.length, verdict: '連続2年の組が少なく測れない' };
if (out.checks.same_position_year_to_year.correlation != null) {
  const same = out.checks.same_position_year_to_year.correlation;
  const cross = out.checks.within_player_consistency.correlation;
  out.checks.same_position_year_to_year.verdict =
    same < 0.3
      ? `同じ位置・別の年でも r=${same.toFixed(3)} しか一致しない。**指標そのものが不安定**であり、位置をまたいだ不一致(${cross?.toFixed(3)})を標準化の失敗と読むのは誤り`
      : `同じ位置なら r=${same.toFixed(3)} で一致する。位置をまたぐと ${cross?.toFixed(3)} まで落ちるなら、標準化後も位置固有の成分が残っている`;
  // 2の判定を、この対照を踏まえて上書きする
  if (same < 0.3 && cross != null) {
    out.checks.within_player_consistency.verdict =
      `位置をまたいだ一致は弱い(r=${cross.toFixed(3)})が、同じ位置・別の年でも r=${same.toFixed(3)} しかない。` +
      `指標の不安定さで説明でき、標準化の失敗とは言えない（対照 same_position_year_to_year を参照）`;
  }
}

// --- 3. 分布の歪み ---
out.checks.distribution_shape = {
  by_position: Object.fromEntries(Object.entries(byPos).map(([p, s]) => [p, { skew: s.skew, kurtosis: s.kurt }])),
  max_abs_skew: Math.max(...Object.values(byPos).map(s => Math.abs(s.skew))),
  verdict: Math.max(...Object.values(byPos).map(s => Math.abs(s.skew))) < 1
    ? '歪みは中程度以下。zスコアの前提（左右対称）から大きく外れない'
    : '歪みが大きいポジションがある。zスコアだと中心と幅の解釈がずれるため、変換を検討する',
};

// --- 4. 年による水準の移動 ---
const yearSpread = {};
for (const p of Object.keys(byPos)) {
  const ms = [...new Set(rows.map(r => r.season))].sort()
    .map(s => { const a = rows.filter(r => r.pos === p && r.season === s).map(r => r.rate); return a.length >= 8 ? stat(a).mean : null; })
    .filter(v => v != null);
  if (ms.length >= 3) yearSpread[p] = { years: ms.length, range: Math.max(...ms) - Math.min(...ms), within_sd: byPos[p].sd };
}
const worst = Object.entries(yearSpread).sort((a, b) => (b[1].range / b[1].within_sd) - (a[1].range / a[1].within_sd))[0];
out.checks.year_drift = {
  by_position: yearSpread,
  worst_position: worst?.[0],
  worst_ratio: worst ? worst[1].range / worst[1].within_sd : null,
  verdict: worst && worst[1].range / worst[1].within_sd > 0.5
    ? '年ごとの水準移動が選手間ばらつきに対して無視できない → 「ポジション×年」で標準化すべき（現行はポジションのみ＝要改修）'
    : '年による移動は小さい → ポジションのみの標準化で足りる',
};

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'fielding_norms_validation.json'), JSON.stringify(out, null, 2), 'utf8');

console.log(`守備イニング${MIN_INN}以上・${out.n_rows}行で検証\n`);
for (const [name, c] of Object.entries(out.checks)) {
  console.log(`## ${name}`);
  if (name === 'position_matters') console.log(`  位置間の平均差 ${c.mean_spread.toFixed(3)} / 選手間のばらつき ${c.avg_within_sd.toFixed(3)} = ${c.ratio.toFixed(2)}`);
  if (name === 'within_player_consistency' && c.correlation != null) console.log(`  同一選手・2位置のzの相関 r=${c.correlation.toFixed(3)}（${c.n_pairs}組）`);
  if (name === 'same_position_year_to_year' && c.correlation != null) console.log(`  同一選手・同一位置・連続2年のzの相関 r=${c.correlation.toFixed(3)}（${c.n_pairs}組）`);
  if (name === 'distribution_shape') console.log(`  歪みの最大 ${c.max_abs_skew.toFixed(2)}`);
  if (name === 'year_drift' && c.worst_ratio != null) console.log(`  最も年変動が大きい位置 ${c.worst_position}: 年ごとの平均の幅 / 選手間ばらつき = ${c.worst_ratio.toFixed(2)}`);
  console.log(`  → ${c.verdict}\n`);
}
db.close();

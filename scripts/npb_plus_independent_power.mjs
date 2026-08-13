// NPB+最高速度の「現実プレー結果に対する」独立予測力を測る。
//
// 指示（2026-08-13 GPT→Claude、次段階）:
//   現在の問題はNPB+をPowerProラベルへ回帰した値をblendしていることである可能性が高いので、
//   `NPB+最高速度 → 翌年の現実プレー結果` の独立予測力を測り、
//   既存統計材料と同じ現実結果ベースの空間へ統合できないか検証すること。
//
// つまりここでは **PowerProを一切経由しない**。
//   旧: NPB+速度 → (PowerProラベルへ回帰) → 走力点 → blend
//   新: NPB+速度 → (実プレー結果へ回帰) → 統計材料と同じ空間 → 統合可否を判定
//
// 3つを出す:
//   (1) NPB+単独の予測力（指標ごと・年ごと）
//   (2) 統計モデルに対する**増分**（偏相関。統計で説明できる分を除いてなお効くか）
//   (3) NPB+ → 統計z空間への変換式（現実結果ベース。統合するならこの形）
//
// 使い方: node scripts/npb_plus_independent_power.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const nrm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const TARGETS = [2022, 2023, 2024, 2025];
const MIN_PA = 150;
const METRICS = ['triple', 'gdpAvoid', 'infieldHit', 'advance', 'ubr'];

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const npbBy = new Map();
for (const r of db.prepare('SELECT player_id, top_speed_kmh FROM npb_plus_measurement').all()) {
  if (r.top_speed_kmh != null) npbBy.set(r.player_id, r.top_speed_kmh);
}

const outStmt = db.prepare(`
  SELECT b.player_id, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp,
         bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=? AND b.position<>'投'`);

const cor = (x, y) => {
  const n = x.length; if (n < 10) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : null;
};
// 偏相関: 統計モデルで説明できる分を除いた後、NPB+がなお効くか
const partial = (ryn, rys, rns) => {
  const d = Math.sqrt((1 - rys * rys) * (1 - rns * rns));
  return d > 0 ? (ryn - rys * rns) / d : null;
};
const fit = (x, y) => {   // 単回帰
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const slope = sxx > 0 ? sxy / sxx : 0;
  return { slope, intercept: my - slope * mx };
};

const cells = [];
const pooled = [];   // NPB+ → 統計z空間の変換を作るための全年プール
for (const Y of TARGETS) {
  const recs = [];
  for (const o of outStmt.all(Y, MIN_PA)) {
    const npb = npbBy.get(o.player_id);
    if (npb == null) continue;
    // 統計側は窓の制限なし（NPB+と同じ特権。窓の非対称で結論が反転する件の対策）
    let statZ = null;
    try {
      const card = appraiseCard(ctx, { name: o.name, mode: String(Y - 1), cfg, rv, runNorm, fldNorm }).card;
      statZ = card?.calc_log?.running?._speed_z ?? null;
    } catch { continue; }
    if (!Number.isFinite(statZ)) continue;

    const line = { PA: o.pa, AB: o.ab, SO: o.so, B2: o.b2, B3: o.b3, HR: o.hr, GDP: o.gdp };
    const adv = advanceOf(db, nrm(o.name), Y);
    const sc = speedComponents(line,
      { gbPct: o.gb_pct, infieldHits: o.ih, bats: o.bats, season: Y,
        advance: adv?.value ?? null, advanceChances: adv?.chances ?? 0 }, o.ubr, runNorm);
    recs.push({ npb, statZ, z: sc.z, score: sc.score });
    if (Number.isFinite(sc.score)) pooled.push({ npb, outcomeZ: sc.score });
  }

  for (const metric of METRICS) {
    const use = recs.filter(r => Number.isFinite(r.z?.[metric]));
    if (use.length < 10) { cells.push({ Y, metric, n: use.length }); continue; }
    const y = use.map(r => r.z[metric]);
    const s = use.map(r => r.statZ);
    const nn = use.map(r => r.npb);
    const rys = cor(s, y), ryn = cor(nn, y), rns = cor(nn, s);
    cells.push({ Y, metric, n: use.length, rys, ryn, rns, pr: partial(ryn, rys, rns) });
  }
}
db.close();

// (3) NPB+ → 実プレー結果の合成z（＝統計材料と同じ空間）への変換式
const conv = pooled.length >= 30 ? fit(pooled.map(p => p.npb), pooled.map(p => p.outcomeZ)) : null;
const convR = pooled.length >= 30 ? cor(pooled.map(p => p.npb), pooled.map(p => p.outcomeZ)) : null;

const f3 = v => v == null ? '-' : (v >= 0 ? '+' : '') + v.toFixed(3);
const wavg = (sel) => { const es = cells.filter(c => c.n >= 10 && sel(c) != null);
  const w = es.reduce((s, e) => s + e.n, 0); return w ? es.reduce((s, e) => s + sel(e) * e.n, 0) / w : null; };

const L = [];
const push = s => L.push(s);
push('# NPB+最高速度の独立予測力（PowerProを一切経由しない）\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('## 何を測ったか\n');
push('```text');
push('旧: NPB+速度 → (PowerProラベルへ回帰) → 走力点 → blend   ← 現行。これが悪化要因と判明済み');
push('新: NPB+速度 → (実プレー結果へ直接回帰) → 統計材料と同じ空間 → 統合できるか');
push('```');
push('統計側には**窓の制限を掛けていない**（NPB+と同じ特権。窓の非対称で結論が反転する件の対策）。\n');
push('## (1)(2) 指標ごと: 単独の効きと、統計モデルに対する増分\n');
push('| 指標 | 年 | n | 統計z→結果 | NPB+→結果 | **増分(偏相関)** |');
push('|---|---|---|---|---|---|');
for (const metric of METRICS) for (const c of cells.filter(c => c.metric === metric)) {
  if (c.n < 10) { push(`| ${metric} | ${c.Y} | ${c.n} | 標本不足 | | |`); continue; }
  push(`| ${metric} | ${c.Y} | ${c.n} | ${f3(c.rys)} | ${f3(c.ryn)} | **${f3(c.pr)}** |`);
}
push('');
push('## 平均（nで重み付け）\n');
push('```text');
push(`統計z → 実プレー結果        ${f3(wavg(c => c.rys))}`);
push(`NPB+  → 実プレー結果        ${f3(wavg(c => c.ryn))}`);
push(`NPB+ の増分（偏相関）       ${f3(wavg(c => c.pr))}   ← 統計で説明できる分を除いてなお効くか`);
push(`NPB+ と 統計z の相関        ${f3(wavg(c => c.rns))}   ← 高いほど「同じものを見ている」`);
push('```\n');
push('## (3) 統合するならこの形（現実結果ベースの変換）\n');
if (conv) {
  push('```text');
  push(`実プレー結果の合成z = ${conv.intercept.toFixed(4)} + ${conv.slope.toFixed(4)} × NPB+速度(km/h)`);
  push(`相関 r = ${f3(convR)}   n = ${pooled.length}（全年プール）`);
  push('```');
  push('この式は**PowerProを一切使っていない**。');
  push('現行の `npb_plus_direct.models.top_speed_kmh`（PowerProラベルへ回帰したもの）を');
  push('置き換える候補になる。ただし採用は下記の判定次第。\n');
} else push('標本が足りず変換式を作れない。\n');

const pr = wavg(c => c.pr), ryn = wavg(c => c.ryn), rys = wavg(c => c.rys);
push('## 判定\n');
if (pr != null) {
  const sign = pr > 0.05 ? '増分あり' : (pr < -0.05 ? '増分が負（足すと悪化）' : 'ほぼ増分なし');
  push(`**NPB+の増分は ${f3(pr)}（${sign}）。**\n`);
  if (pr > 0.05) {
    push('統計モデルで説明できる分を除いてもNPB+はなお効いている。');
    push('→ **現実結果ベースの空間へ変換したうえで統合する価値がある**。上の(3)の式を使う。\n');
  } else if (pr < -0.05) {
    push('統計モデルを条件にするとNPB+は逆向きに効く＝足すと悪化する。');
    push('→ **統合しない。** NPB+は走力の材料としては使わない（別の用途に取っておく）。\n');
  } else {
    push('統計モデルを条件にするとNPB+はほとんど効かない。');
    push(`NPB+と統計zの相関が ${f3(wavg(c => c.rns))} で、**両者はほぼ同じものを見ている**。`);
    push('→ **統合しても得るものが小さい。** PowerPro経由をやめても、現実結果ベースへ');
    push('　変換して足す価値は現時点では確認できない。NPB+は捨てず、別の使い道（例: 出場が');
    push('　少なく統計材料が薄い選手の補完、物理計測との突合）を検討する。\n');
  }
}
push('## 限界（この検証が答えていないこと）\n');
push('- **両側に窓の緩みがある。これは予測試験ではなく「情報が重なっているか」の試験として読む。**');
push('  統計側は mode=Y-1 でも窓が左右対称（±3年）なので、**当てる年Yのデータ自身が予測側に入る**。');
push('  NPB+側は2026年の1点で時点を持たず、絞ることができない。');
push('  したがって両方の絶対値は上振れしている。**比較として意味があるのは偏相関**');
push('  （統計で説明できる分を除いてなおNPB+が効くか）であって、単独の相関値ではない。');
push('- NPB+実測は2026年の1点で時点を持たない。過去年の結果を当てる形になるため、');
push('  **NPB+側に有利な非対称が残る**（窓を絞れない）。その条件での結果として読む');
push('- 統計材料が薄い選手（少出場・1年プール）でNPB+が効くかは、この平均では見えない。');
push('  層別が要る場合は別途測る');
push('- 0〜100の絶対目盛りは一切判定していない');

writeFileSync(path.join(ROOT, 'outputs', 'speed_npb_plus_independent_power_2026.md'), L.join('\n'), 'utf8');
const csv = ['year,metric,n,r_stat_outcome,r_npb_outcome,r_npb_stat,partial_npb'];
for (const c of cells) csv.push([c.Y, c.metric, c.n, c.rys ?? '', c.ryn ?? '', c.rns ?? '', c.pr ?? ''].join(','));
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_npb_plus_independent_power_2026.csv'), csv.join('\n'), 'utf8');

console.log(`統計z→結果 ${f3(rys)} / NPB+→結果 ${f3(ryn)} / NPB+の増分(偏相関) ${f3(pr)} / NPB+と統計zの相関 ${f3(wavg(c => c.rns))}`);
if (conv) console.log(`変換式: 合成z = ${conv.intercept.toFixed(4)} + ${conv.slope.toFixed(4)} × NPB+速度  (r=${f3(convR)}, n=${pooled.length})`);

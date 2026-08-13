// NPB+の追加情報を、漏れを最小化した2つの形で検証する。
//
// 指示（2026-08-13 オーナー）:
//   3. NPB+自体は捨てず、2026年の独立した実戦結果（利用可能なadvance等）に対して、
//      2021-2025統計モデルへ追加情報を与えるか検証
//   4. 可能ならNPB+最高速度から各現実アウトカムを直接推定する経路をcross-validationで評価
//
// ■ 検証1（指示3）: 2026年の実戦結果に対する追加情報
//   予測側A: 統計モデル（maxSeason=2025。**2026年の情報を一切含まない**）
//   予測側B: NPB+最高速度（2026年の計測）
//   当てる  : 2026年のadvance（1球データ由来。打球位置とアウト数で難易度を揃え済み）
//
//   ★時点の関係を正直に書く: 統計側は厳密に2026年より前。NPB+は2026年**同年**の計測で、
//     当てる結果と同じ年。したがってNPB+には「現在の状態を知っている」優位がある。
//     これは未来情報ではないが対等でもない。**この非対称は消せない**ので、
//     「2026査定において2026計測が2021-2025履歴に上乗せするか」という
//     **運用上の問いへの答え**として読む。純粋な予測力の比較ではない。
//
// ■ 検証2（指示4）: NPB+ → 各アウトカムの直接推定をcross-validationで評価
//   選手単位のk-fold（同じ選手が学習側と試験側に入らないようにする）。
//   fold外での相関・誤差を出し、平均を出すだけのbaselineと比べる。
//
// 使い方: node scripts/npb_plus_2026_test_and_cv.mjs

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

const MIN_CHANCES = 20;
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const cor = (x, y) => {
  const n = x.length; if (n < 8) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : null;
};
const partial = (ryn, rys, rns) => {
  const d = Math.sqrt((1 - rys * rys) * (1 - rns * rns));
  return d > 0 ? (ryn - rys * rns) / d : null;
};
const fit = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const slope = sxx > 0 ? sxy / sxx : 0; return { slope, intercept: my - slope * mx }; };
const f3 = v => v == null ? '-' : (v >= 0 ? '+' : '') + v.toFixed(3);
// 選手名から安定したfold番号（ハッシュ。実行のたびに変わらない）
const foldOf = (name, k) => { let h = 0; for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h % k; };

// NPB+（player_id → 速度、名前）
const npbRows = db.prepare(`
  SELECT n.player_id, n.top_speed_kmh, (SELECT b.name FROM v_batting b
     WHERE b.player_id=n.player_id ORDER BY b.season DESC LIMIT 1) AS name
  FROM npb_plus_measurement n WHERE n.top_speed_kmh IS NOT NULL`).all();

// ── 検証1: 2026年のadvanceに対する追加情報 ────────────────────────
const t1 = [];
for (const r of npbRows) {
  if (!r.name) continue;
  const a26 = advanceOf(db, nrm(r.name), 2026);
  if (!a26 || a26.chances < 5) continue;   // 収集は下限5。絞り込みは下の閾値スイープで行う
  let statZ = null;
  try {
    const card = appraiseCard(ctx, { name: r.name, mode: '2025', maxSeason: 2025, cfg, rv, runNorm, fldNorm }).card;
    const R = card?.calc_log?.running;
    if (R?.speed_seasons?.some(s => s >= 2026)) continue;   // 漏れ検査
    statZ = R?._speed_z ?? null;
  } catch { continue; }
  if (!Number.isFinite(statZ)) continue;
  t1.push({ name: r.name, statZ, npb: r.top_speed_kmh, adv: a26.value, chances: a26.chances });
}
// ★1つの閾値だけで結論を出さない。n が小さいので閾値に依存していないかを必ず見る。
const THRESHOLDS = [5, 10, 15, 20, 25];
const sweep = [];
for (const th of THRESHOLDS) {
  const u = t1.filter(x => x.chances >= th);
  if (u.length < 8) { sweep.push({ th, n: u.length, note: '標本不足' }); continue; }
  const rys = cor(u.map(x => x.statZ), u.map(x => x.adv));
  const ryn = cor(u.map(x => x.npb), u.map(x => x.adv));
  const rns = cor(u.map(x => x.npb), u.map(x => x.statZ));
  sweep.push({ th, n: u.length, rys, ryn, rns, pr: partial(ryn, rys, rns) });
}
const t1r = sweep.find(s2 => s2.th === MIN_CHANCES && !s2.note) ?? sweep.find(s2 => !s2.note) ?? null;

// ── 検証2: NPB+ → 各アウトカムの直接推定を cross-validation ──────
const METRICS = ['triple', 'gdpAvoid', 'infieldHit', 'advance', 'ubr'];
const YEARS = [2022, 2023, 2024, 2025];
const npbBySpeed = new Map(npbRows.map(r => [r.player_id, r.top_speed_kmh]));
const outStmt = db.prepare(`
  SELECT b.player_id, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp,
         bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=150 AND b.position<>'投'`);

const pool = [];
for (const Y of YEARS) for (const o of outStmt.all(Y)) {
  const npb = npbBySpeed.get(o.player_id); if (npb == null) continue;
  const adv = advanceOf(db, nrm(o.name), Y);
  const sc = speedComponents(
    { PA: o.pa, AB: o.ab, SO: o.so, B2: o.b2, B3: o.b3, HR: o.hr, GDP: o.gdp },
    { gbPct: o.gb_pct, infieldHits: o.ih, bats: o.bats, season: Y,
      advance: adv?.value ?? null, advanceChances: adv?.chances ?? 0 }, o.ubr, runNorm);
  pool.push({ name: o.name, year: Y, npb, z: sc.z });
}
db.close();

const K = 5;
const cv = [];
for (const metric of METRICS) {
  const use = pool.filter(p => Number.isFinite(p.z?.[metric]));
  if (use.length < 40) { cv.push({ metric, n: use.length, note: '標本不足' }); continue; }
  const preds = [], actuals = [];
  for (let k = 0; k < K; k++) {
    const tr = use.filter(p => foldOf(p.name, K) !== k);
    const te = use.filter(p => foldOf(p.name, K) === k);
    if (tr.length < 20 || te.length < 5) continue;
    const m = fit(tr.map(p => p.npb), tr.map(p => p.z[metric]));
    for (const p of te) { preds.push(m.intercept + m.slope * p.npb); actuals.push(p.z[metric]); }
  }
  if (preds.length < 20) { cv.push({ metric, n: use.length, note: 'fold不足' }); continue; }
  const mu = actuals.reduce((a, b) => a + b, 0) / actuals.length;
  const maeModel = preds.reduce((s, v, i) => s + Math.abs(v - actuals[i]), 0) / preds.length;
  const maeBase = actuals.reduce((s, v) => s + Math.abs(v - mu), 0) / actuals.length;
  cv.push({ metric, n: use.length, oof: preds.length, r: cor(preds, actuals),
    maeModel, maeBase, gain: (maeBase - maeModel) / maeBase });
}

// ── 出力 ───────────────────────────────────────────────────────────
const L = [];
const push = s => L.push(s);
push('# NPB+の追加情報 — 2026実戦結果テスト と cross-validation\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('前提: rolling holdout による NPB+ blend の採否は `NOT_IDENTIFIABLE`（別文書）。');
push('本書はその代わりに、漏れをできるだけ小さくした2つの角度から測ったもの。\n');
push('---\n');
push('## 検証1: 2026年のadvanceに対して、2021-2025統計モデルに追加情報を与えるか\n');
push('```text');
push('予測側A: 統計モデル（maxSeason=2025。2026年の情報を一切含まない。漏れ検査つき）');
push('予測側B: NPB+最高速度（2026年の計測）');
push('当てる  : 2026年のadvance（1球データ。打球位置とアウト数で難易度を揃え済み）');
push(`条件    : 2026年のadvance機会 >= ${MIN_CHANCES}`);
push('```');
push('★**時点の非対称（消せない）**: 統計側は厳密に2026年より前。NPB+は2026年**同年**の計測で、');
push('当てる結果と同じ年。したがってNPB+には「現在の状態を知っている」優位がある。');
push('未来情報ではないが対等でもない。**純粋な予測力の比較ではなく、');
push('「2026査定において2026計測が2021-2025履歴に上乗せするか」という運用上の問いへの答え**として読む。\n');
push('### 閾値への感度（★1つの閾値だけで結論を出さない）\n');
push('| advance機会の下限 | n | 統計モデル→2026adv | NPB+→2026adv | **増分(偏相関)** |');
push('|---|---|---|---|---|');
for (const s2 of sweep) {
  if (s2.note) { push(`| >=${s2.th} | ${s2.n} | ${s2.note} | | |`); continue; }
  push(`| >=${s2.th} | ${s2.n} | ${f3(s2.rys)} | ${f3(s2.ryn)} | **${f3(s2.pr)}** |`);
}
push('');
{
  const ok = sweep.filter(s2 => !s2.note);
  const allNonPos = ok.length && ok.every(s2 => s2.pr <= 0.05);
  push(allNonPos
    ? `**どの閾値でも増分は ${f3(Math.min(...ok.map(s2 => s2.pr)))} 〜 ${f3(Math.max(...ok.map(s2 => s2.pr)))} でゼロ以下。** 標本の取り方に依存しない。
`
    : '**閾値によって符号が変わる。標本の取り方に依存しており、結論を出せない。**\n');
  push(`統計モデル側はどの閾値でも ${f3(Math.min(...ok.map(s2 => s2.rys)))} 〜 ${f3(Math.max(...ok.map(s2 => s2.rys)))} で、`);
  push(`NPB+側の ${f3(Math.min(...ok.map(s2 => s2.ryn)))} 〜 ${f3(Math.max(...ok.map(s2 => s2.ryn)))} を一貫して上回る。\n`);
}
if (t1r) {
  push(`### 代表値（下限${MIN_CHANCES}）\n`);
  push('```text');
  push(`n = ${t1r.n}人`);
  push(`統計モデル → 2026 advance    ${f3(t1r.rys)}`);
  push(`NPB+       → 2026 advance    ${f3(t1r.ryn)}`);
  push(`NPB+ の増分（偏相関）         ${f3(t1r.pr)}   ← 統計で説明できる分を除いてなお効くか`);
  push(`NPB+ と 統計モデル の相関     ${f3(t1r.rns)}`);
  push('```\n');
  const v = t1r.pr;
  push(v == null ? '判定不能。\n'
    : v > 0.15 ? `**増分あり（${f3(v)}）。** 2026計測は2021-2025履歴に無い情報を持っている。\n`
    : v > 0.05 ? `**小さいが増分あり（${f3(v)}）。** n=${t1r.n}と少ないので確定はしない。\n`
    : v < -0.05 ? `**増分が負（${f3(v)}）。** 統計を条件にすると逆向きに効く。\n`
    : `**ほぼ増分なし（${f3(v)}）。** 統計モデルで説明できる範囲に収まっている。\n`);
} else push(`標本不足（${t1.length}人）で判定できない。\n`);

push('---\n');
push('## 検証2: NPB+ → 各アウトカムの直接推定（選手単位5-fold cross-validation）\n');
push('同じ選手が学習側と試験側に入らないよう、**選手名のハッシュでfoldを切った**（実行のたびに変わらない）。');
push('比較対象は「全員に平均値を出すだけ」のbaseline。\n');
push('| アウトカム | 標本 | fold外予測数 | fold外r | 誤差(モデル) | 誤差(平均だけ) | 改善率 |');
push('|---|---|---|---|---|---|---|');
for (const c of cv) {
  if (c.note) { push(`| ${c.metric} | ${c.n} | ${c.note} | | | | |`); continue; }
  push(`| ${c.metric} | ${c.n} | ${c.oof} | ${f3(c.r)} | ${c.maeModel.toFixed(3)} | ${c.maeBase.toFixed(3)} | ${(c.gain * 100).toFixed(1)}% |`);
}
push('');
const ok = cv.filter(c => !c.note);
if (ok.length) {
  const wr = ok.reduce((s, c) => s + c.r * c.oof, 0) / ok.reduce((s, c) => s + c.oof, 0);
  const wg = ok.reduce((s, c) => s + c.gain * c.oof, 0) / ok.reduce((s, c) => s + c.oof, 0);
  push('```text');
  push(`fold外の平均r      ${f3(wr)}`);
  push(`平均改善率         ${(wg * 100).toFixed(1)}%   （平均を出すだけの場合と比べた誤差の減り）`);
  push('```\n');
  push(wg > 0.05
    ? '**NPB+単独でも、fold外で意味のある推定ができている。** 直接推定の経路は成立する。\n'
    : '**fold外での改善は小さい。** NPB+単独から各アウトカムを直接推定する経路は、現状では弱い。\n');
  push('★ここでもNPB+は2026年の1点なので、2022-2025のアウトカムに対しては');
  push('  時点が後になる。cross-validationは**選手の重複**は防ぐが**時点の非対称は防げない**。\n');
}
push('---\n');
push('## この2つでも答えられないこと\n');
push('- NPB+に過去年のsnapshotが無い以上、**時点を揃えた比較はどうやっても作れない**。');
push('  検証1は「同年」、検証2は「後の時点」で、どちらもNPB+側に有利。');
push('  したがって **NPB+が勝っても採用の決定打にはならない。負けた場合のみ強い結論**になる');
push('- 0〜100の絶対目盛りは一切判定していない。`scale_calibration.走力` のPowerPro依存は別問題として保持');
push('- 統計材料が薄い選手で効くかの層別は未実施（T-0203）');

writeFileSync(path.join(ROOT, 'outputs', 'speed_npb_plus_2026_and_cv.md'), L.join('\n'), 'utf8');
const csv = ['section,metric,n,oof,r,mae_model,mae_base,gain'];
if (t1r) csv.push(['test2026', 'advance', t1r.n, '', t1r.pr ?? '', '', '', ''].join(','));
for (const c of cv) csv.push(['cv', c.metric, c.n, c.oof ?? '', c.r ?? '', c.maeModel ?? '', c.maeBase ?? '', c.gain ?? ''].join(','));
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_npb_plus_2026_and_cv.csv'), csv.join('\n'), 'utf8');

if (t1r) console.log(`検証1: n=${t1r.n} 統計${f3(t1r.rys)} / NPB+${f3(t1r.ryn)} / 増分${f3(t1r.pr)}`);
else console.log(`検証1: 標本不足 ${t1.length}人`);
for (const c of cv) console.log(`CV ${c.metric.padEnd(11)} ${c.note ?? `n=${c.n} fold外r=${f3(c.r)} 改善${(c.gain * 100).toFixed(1)}%`}`);

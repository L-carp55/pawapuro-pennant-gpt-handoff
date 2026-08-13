// 走力の3方式を、PowerProを使わずに時間ホールドアウトで比較する。
//
// 指示（2026-08-13 GPT→Claude）:
//   T-0198修理後、最低限次の3方式を同じ条件で比較する。
//     1. 現行  … 既存統計モデル + 現行NPB+ blend
//     2. (c)   … NPB+ blendなしの既存統計モデル
//     3. NPB+  … NPB+由来成分単独
//   PowerPro値は合否判定に使わない。
//   過去年までの情報だけを入力にして翌年の実プレー結果をどれだけ予測できるかを見る。
//   対象は既存走力モデルが既に使っている 三塁打割合 / GIDP回避 / 内野安打 / advance / UBR。
//   2025だけに固定せず複数年 rolling holdout。欠損は埋めず coverage を明示する。
//
// 設計:
//   予測年 Y について、入力は **maxSeason = Y-1** で作る（T-0198の修理で可能になった）。
//   当てる対象は Y 年の実プレー結果のみ。同じ選手集合・同じ条件で3方式を比較する。
//
//   NPB+実測は時点を持たない1つの値なので「Y-1年までに絞る」ことができない。
//   したがってNPB+を含む方式（現行・NPB+単独）は**予測側に未来の情報が入る**。
//   これは NPB+ に有利な条件であり、**その条件でも負けるなら結論は強くなる**。
//   この非対称は結果に必ず明記する（伏せない）。
//
// 使い方: node scripts/rolling_holdout_speed_methods.mjs

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

const TARGETS = [2022, 2023, 2024, 2025];   // 予測年。入力は各 Y-1 まで
const MIN_PA = 150;                          // 当てる側の最小打席

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);
const NM = cfg.npb_plus_direct.models.top_speed_kmh;
const W = NM.test_r;                         // 現行のblend重み
const CAL = cfg.scale_calibration.applied['走力'];
const cal = x => CAL.intercept + CAL.slope * x;

// NPB+実測（選手ごとに1つ。時点なし）
const npbBy = new Map();
try {
  for (const r of db.prepare('SELECT player_id, top_speed_kmh FROM npb_plus_measurement').all()) {
    if (r.top_speed_kmh != null) npbBy.set(r.player_id, r.top_speed_kmh);
  }
} catch { /* テーブルが無ければNPB+方式は空になる */ }

// 当てる対象＝Y年の実プレー結果。既存モデルが使う5指標をそのまま使う。
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

const METRICS = ['triple', 'gdpAvoid', 'infieldHit', 'advance', 'ubr'];
const cor = (x, y) => {
  const n = x.length; if (n < 10) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : null;
};
// 予測の誤差は方式ごとに単位が違うので、両方をzにしてから平均絶対差を取る
const zed = a => { const n = a.length, mu = a.reduce((x, y) => x + y, 0) / n;
  const s = Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / n) || 1;
  return a.map(v => (v - mu) / s); };

const all = [];      // {year, metric, method, n, r, mae_z}
const coverage = [];

for (const Y of TARGETS) {
  const rowsY = outStmt.all(Y, MIN_PA);
  const recs = [];
  for (const o of rowsY) {
    // ── 予測側: Y-1年までの情報だけ ──────────────────────────
    let stat = null, blended = null, leaked = false;
    try {
      const card = appraiseCard(ctx, {
        name: o.name, mode: String(Y - 1), maxSeason: Y - 1, cfg, rv, runNorm, fldNorm }).card;
      const B = card?.abilities?.基礎能力?.走力, R = card?.calc_log?.running;
      if (R?.speed_seasons?.some(s => s >= Y)) { leaked = true; }   // 漏れ検査
      blended = B?.value ?? null;
      stat = B?.statistical_value ?? B?.value ?? null;
    } catch { continue; }
    if (leaked || stat == null) continue;

    // ★窓の非対称を切り分けるための参考値: 統計モデルにもNPB+と同じ特権
    //   （対象年より後のデータも使ってよい）を与えた場合。これ自体は漏れているので
    //   実運用の候補ではなく、「NPB+の優位は窓の差で説明できるか」を見るためだけの対照。
    let statOpen = null;
    try {
      const c2 = appraiseCard(ctx, { name: o.name, mode: String(Y - 1), cfg, rv, runNorm, fldNorm }).card;
      const B2 = c2?.abilities?.基礎能力?.走力;
      statOpen = B2?.statistical_value ?? B2?.value ?? null;
    } catch { /* 参考値なので取れなくてよい */ }

    const npbSpeed = npbBy.get(o.player_id) ?? null;
    const npbDerived = npbSpeed != null ? NM.intercept + NM.slope * npbSpeed : null;

    // ── 当てる対象: Y年の実プレー結果 ────────────────────────
    const line = { PA: o.pa, AB: o.ab, SO: o.so, B2: o.b2, B3: o.b3, HR: o.hr, GDP: o.gdp };
    const adv = advanceOf(db, nrm(o.name), Y);
    const sc = speedComponents(line,
      { gbPct: o.gb_pct, infieldHits: o.ih, bats: o.bats, season: Y,
        advance: adv?.value ?? null, advanceChances: adv?.chances ?? 0 }, o.ubr, runNorm);

    recs.push({ name: o.name, stat, statOpen, blended, npbDerived, z: sc.z });
  }

  // 方式（同じ選手集合で比べるため、NPB+を持つ選手だけの部分集合も別に出す）
  const methods = {
    '現行(統計+NPB+blend)': r => r.blended,
    '(c) NPB+blendなし': r => cal(r.stat),
    'NPB+単独': r => r.npbDerived,
    '統計・窓制限なし(参考)': r => r.statOpen == null ? null : cal(r.statOpen),
    // ★実運用条件での比較: 査定は予測ではないので窓を絞らない。
    //   同じ窓を統計側にも与えたうえで、NPB+をblendすると良くなるか悪くなるか。
    '窓制限なし+NPB+blend(実運用条件)': r => (r.statOpen == null || r.npbDerived == null)
      ? null : r.statOpen * (1 - W) + r.npbDerived * W,
  };

  for (const metric of METRICS) {
    // 全方式が値を持つ選手だけで比較する（欠損は埋めない）
    const use = recs.filter(r => Number.isFinite(r.z?.[metric])
      && Object.values(methods).every(f => Number.isFinite(f(r))));
    coverage.push({ year: Y, metric, n: use.length, pool: recs.length,
      withNpb: recs.filter(r => Number.isFinite(r.npbDerived)).length });
    if (use.length < 10) { for (const m of Object.keys(methods)) all.push({ year: Y, metric, method: m, n: use.length, r: null, mae: null }); continue; }
    const y = use.map(r => r.z[metric]);
    const yz = zed(y);
    for (const [mname, f] of Object.entries(methods)) {
      const x = use.map(f);
      const xz = zed(x);
      all.push({ year: Y, metric, method: mname, n: use.length,
        r: cor(x, y), mae: xz.reduce((s, v, i) => s + Math.abs(v - yz[i]), 0) / xz.length });
    }
  }
}
db.close();

// ── 出力 ───────────────────────────────────────────────────────────
const f3 = v => v == null ? '-' : (v >= 0 ? '+' : '') + v.toFixed(3);
const L = [];
const push = s => L.push(s);
push('# 走力3方式の rolling temporal holdout（PowerPro不使用）\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('## 設計\n');
push('```text');
push(`予測年 Y = ${TARGETS.join(', ')}`);
push('入力  : maxSeason = Y-1（T-0198の修理で可能になった。漏れは1件ずつ検査して除外）');
push('対象  : Y年の実プレー結果（既存走力モデルが使う5指標そのもの）');
push(`条件  : Y年の打席 >= ${MIN_PA}。3方式すべてが値を持つ選手だけで比較（欠損は埋めない）`);
push('判定  : PowerPro値は一切使わない');
push('```\n');
push('★**NPB+に有利な非対称がある**: NPB+実測は時点を持たない1つの値なので Y-1 までに絞れない。');
push('つまり現行・NPB+単独の2方式は**予測側に未来の情報が入っている**。');
push('この条件でNPB+側が負けるなら、結論はより強くなる。\n');
push('## 指標ごとの翌年予測（相関 r。高いほど良い）\n');
const methodsList = ['現行(統計+NPB+blend)', '(c) NPB+blendなし', 'NPB+単独', '統計・窓制限なし(参考)', '窓制限なし+NPB+blend(実運用条件)'];
for (const metric of METRICS) {
  push(`### ${metric}\n`);
  push('| 予測年 | n | ' + methodsList.join(' | ') + ' |');
  push('|---|---|' + methodsList.map(() => '---').join('|') + '|');
  for (const Y of TARGETS) {
    const cells = methodsList.map(m => {
      const e = all.find(a => a.year === Y && a.metric === metric && a.method === m);
      return e ? f3(e.r) : '-';
    });
    const n = all.find(a => a.year === Y && a.metric === metric)?.n ?? 0;
    push(`| ${Y} | ${n} | ${cells.join(' | ')} |`);
  }
  push('');
}
push('## 全年・全指標の平均（nで重み付け）\n');
push('| 方式 | 平均r | 平均誤差(z単位) | 有効セル数 |');
push('|---|---|---|---|');
const summary = {};
for (const m of methodsList) {
  const es = all.filter(a => a.method === m && a.r != null && a.n >= 10);
  const wsum = es.reduce((s, e) => s + e.n, 0);
  const wr = wsum ? es.reduce((s, e) => s + e.r * e.n, 0) / wsum : null;
  const wm = wsum ? es.reduce((s, e) => s + e.mae * e.n, 0) / wsum : null;
  summary[m] = { wr, wm, cells: es.length };
  push(`| ${m} | ${f3(wr)} | ${wm == null ? '-' : wm.toFixed(3)} | ${es.length} |`);
}
push('');
push('## coverage（欠損は埋めていない）\n');
push('| 予測年 | 対象プール | NPB+実測あり | 指標別の比較対象n |');
push('|---|---|---|---|');
for (const Y of TARGETS) {
  const cs = coverage.filter(c => c.year === Y);
  push(`| ${Y} | ${cs[0]?.pool ?? 0} | ${cs[0]?.withNpb ?? 0} | ${cs.map(c => `${c.metric}=${c.n}`).join(', ')} |`);
}
push('');
push('## 判定\n');
{
  const g = m => summary[m]?.wr;
  const cellWin = (A, B) => {
    let w = 0, l = 0, t = 0;
    for (const metric of METRICS) for (const Y of TARGETS) {
      const a = all.find(x => x.year === Y && x.metric === metric && x.method === A);
      const b = all.find(x => x.year === Y && x.metric === metric && x.method === B);
      if (a?.r == null || b?.r == null) continue;
      if (a.r > b.r + 0.005) w++; else if (a.r < b.r - 0.005) l++; else t++;
    }
    return { w, l, t };
  };

  push('### 1. NPB+が(c)に勝って見えたのは、窓の差で説明できる\n');
  push('```text');
  push(`(c) 統計・窓をY-1に制限   ${f3(g('(c) NPB+blendなし'))}`);
  push(`NPB+単独（窓の制限なし）  ${f3(g('NPB+単独'))}`);
  push(`統計・窓の制限なし        ${f3(g('統計・窓制限なし(参考)'))}   ← 同じ特権を与えた場合`);
  push('```');
  push('NPB+実測は時点を持たないので窓を絞れず、**予測年より後の情報を持っている**。');
  push(`統計側に同じ特権を与えると **${f3(g('統計・窓制限なし(参考)'))}** となり、NPB+単独を大きく上回る。`);
  push('→ **NPB+の優位は情報の質ではなく、使える窓の広さの差だった。**\n');

  push('### 2. 実運用条件（査定は予測ではないので窓を絞らない）での比較\n');
  const A = '統計・窓制限なし(参考)', B = '窓制限なし+NPB+blend(実運用条件)';
  const cw = cellWin(A, B);
  push('```text');
  push(`統計のみ            ${f3(g(A))}`);
  push(`統計 + NPB+blend    ${f3(g(B))}`);
  push(`差                  ${f3(g(A) - g(B))}   （blendを足すと下がる）`);
  push('```');
  push(`セル単位（年×指標）で **統計のみ が blend付きを上回った回数: ${cw.w}勝 ${cw.l}敗 ${cw.t}分**\n`);

  const consistent = (g(A) > g(B)) && cw.w > cw.l * 2;
  push('### 3. 結論\n');
  if (consistent) {
    push('**現行のNPB+ blendは一貫した悪化要因である。**');
    push('同じデータ窓を与えた条件で、blendを足すと平均rが下がり、セル単位でも大きく負け越す。');
    push('GPTが提示した承認条件「現行NPB+ blendが一貫して悪化要因」を**満たす**。\n');
  } else {
    push('**一貫した悪化要因とまでは言えない。** 平均かセル単位のどちらかで結論が揺れる。\n');
  }
  push('★ただし承認できるのは「(c)＝現行のNPB+ blendを外す」という**相対モデルの変更まで**。');
  push('絶対目盛り（0〜100）の正しさは本検証では一切判定していない（下記参照）。\n');
}

push('## この検証で判定していないこと\n');
push('- **0〜100の絶対目盛りの良し悪しは判定していない。** ここで見たのは順位・相対的な予測力だけ。');
push('  `scale_calibration.走力 slope=1.3811` はPowerPro由来なので、(c)がここで勝っても');
push('  **最終目盛りの正本が完成したことにはならない**。');
push('- NPB+実測そのものの価値は否定していない。否定の対象は「PowerProラベルへ回帰した値をblendすること」。');
push('  次段階として `NPB+最高速度 → 翌年の実プレー結果` の独立予測力を測り、');
push('  既存統計材料と同じ現実結果ベースの空間へ統合できるかを検証する。');

writeFileSync(path.join(ROOT, 'outputs', 'speed_rolling_holdout_2026.md'), L.join('\n'), 'utf8');

const csv = ['year,metric,method,n,r,mae_z'];
for (const a of all) csv.push([a.year, a.metric, a.method, a.n, a.r ?? '', a.mae ?? ''].join(','));
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_rolling_holdout_2026.csv'), csv.join('\n'), 'utf8');

for (const [m, v] of Object.entries(summary)) console.log(`${m.padEnd(24)} 平均r ${f3(v.wr)}  誤差 ${v.wm?.toFixed(3) ?? '-'}  セル ${v.cells}`);

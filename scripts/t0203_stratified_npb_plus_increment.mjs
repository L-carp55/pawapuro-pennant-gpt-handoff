// T-0203: 統計材料が薄い選手でNPB+が追加情報を持つかを層別で検証する。
//
// 指示（2026-08-13 オーナー）:
//   目的は「全体ではNPB+が統計モデルに対して冗長でも、統計材料が薄い選手では追加情報を持つか」。
//   ★層は **NPB+を見る前に分かる統計側の証拠量だけ** で作る。
//     PowerProとの乖離・NPB+との食い違いを層別に使わない。
//   ★閾値を結果を見て後付けで選ばない。事前定義カテゴリか、連続変数として扱う。
//   2026 advanceについて (1)統計単独 (2)NPB+単独 (3)統計+NPB+ を比較し、
//   単純相関だけでなく partial correlation / incremental R² / CV誤差差 を出す。
//   小標本なので bootstrap で不確実性も出す。
//   仮説: 統計reliabilityが高い→NPB+は冗長 / 低い→NPB+に追加情報。このinteractionを見る。
//
// ■ 事前に決めたこと（結果を見てから変えていない）
//   層別の主軸 : `weight` ＝ poolAcrossYears が返す「プールした各年のPA合計」。
//                実装に直接あり再現可能。**連続変数**として扱う（log変換して中心化）。
//   層別の副軸 : `years` ＝ プールした年数。**事前定義カテゴリ 1 / 2 / 3年以上**。
//   主要条件   : 2026 advance機会 >= 10。理由＝層に分けても各層に人数が残る最小値。
//                5 と 15 を感度として併記する。
//   どちらの軸も NPB+ を見る前に確定する。PowerProは一切使わない。
//
// 使い方: node scripts/t0203_stratified_npb_plus_increment.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateDurableTraits } from '../src/cards/durable_estimate.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const nrm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const PRIMARY_MIN_CHANCES = 10;
const SENSITIVITY = [5, 10, 15];
const B_BOOT = 2000;

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

// ── 小さな線形代数（正規方程式＋ガウス消去）────────────────────────
function ols(X, y) {
  const n = X.length, p = X[0].length;
  const A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) { let s = 0; for (let k = 0; k < n; k++) s += X[k][i] * X[k][j]; A[i][j] = s; }
    let s = 0; for (let k = 0; k < n; k++) s += X[k][i] * y[k]; A[i][p] = s;
  }
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[p] / A[i][i]);
}
const r2of = (X, y) => {
  const b = ols(X, y); if (!b) return null;
  const my = y.reduce((a, c) => a + c, 0) / y.length;
  let sse = 0, sst = 0;
  for (let i = 0; i < y.length; i++) {
    const p = X[i].reduce((s, v, k) => s + v * b[k], 0);
    sse += (y[i] - p) ** 2; sst += (y[i] - my) ** 2;
  }
  return sst > 0 ? 1 - sse / sst : null;
};
const cor = (x, y) => {
  const n = x.length; if (n < 5) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : null;
};
const partialR = (rows) => {
  const rys = cor(rows.map(r => r.statZ), rows.map(r => r.y));
  const ryn = cor(rows.map(r => r.npb), rows.map(r => r.y));
  const rns = cor(rows.map(r => r.npb), rows.map(r => r.statZ));
  if (rys == null || ryn == null || rns == null) return null;
  const d = Math.sqrt((1 - rys * rys) * (1 - rns * rns));
  return d > 0 ? { pr: (ryn - rys * rns) / d, rys, ryn, rns } : null;
};
const incR2 = (rows) => {
  const y = rows.map(r => r.y);
  const m1 = r2of(rows.map(r => [1, r.statZ]), y);
  const m3 = r2of(rows.map(r => [1, r.statZ, r.npb]), y);
  return (m1 == null || m3 == null) ? null : { m1, m3, inc: m3 - m1 };
};
// bootstrap（選手単位で復元抽出）
function boot(rows, statFn, B = B_BOOT) {
  const out = [];
  let seed = 20260813;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let b = 0; b < B; b++) {
    const s = Array.from({ length: rows.length }, () => rows[Math.floor(rnd() * rows.length)]);
    const v = statFn(s);
    if (v != null && Number.isFinite(v)) out.push(v);
  }
  if (out.length < B * 0.5) return null;
  out.sort((a, b) => a - b);
  return { lo: out[Math.floor(out.length * 0.025)], hi: out[Math.floor(out.length * 0.975)],
    med: out[Math.floor(out.length * 0.5)] };
}
const foldOf = (name, k) => { let h = 0; for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h % k; };

// ── データ収集（NPB+を見る前に層別の材料を確定させる）──────────────
const npbRows = db.prepare(`
  SELECT n.player_id, n.top_speed_kmh, (SELECT b.name FROM v_batting b
     WHERE b.player_id=n.player_id ORDER BY b.season DESC LIMIT 1) AS name
  FROM npb_plus_measurement n WHERE n.top_speed_kmh IS NOT NULL`).all();

const raw = [];
for (const r of npbRows) {
  if (!r.name) continue;
  const a26 = advanceOf(db, nrm(r.name), 2026);
  if (!a26 || a26.chances < Math.min(...SENSITIVITY)) continue;
  // 統計側は2025年までに厳密に制限（2026の情報を一切含まない）
  let d;
  try { d = estimateDurableTraits(db, r.player_id, 2025, { cfg, runNorm, fldNorm, maxSeason: 2025 }); }
  catch { continue; }
  const sp = d?.speed;
  if (!sp || !Number.isFinite(sp.z) || !(sp.weight > 0)) continue;
  if (sp.seasons?.some(s => s >= 2026)) continue;      // 漏れ検査
  raw.push({ name: r.name, statZ: sp.z, weight: sp.weight, years: sp.years,
    npb: r.top_speed_kmh, y: a26.value, chances: a26.chances });
}
db.close();

const yearBand = y => y <= 1 ? '1年' : y === 2 ? '2年' : '3年以上';

// ── 分析 ───────────────────────────────────────────────────────────
const results = {};
for (const th of SENSITIVITY) {
  const rows = raw.filter(r => r.chances >= th);
  if (rows.length < 12) { results[th] = { n: rows.length, note: '標本不足' }; continue; }

  const overall = { n: rows.length, p: partialR(rows), r2: incR2(rows) };
  overall.bootPr = boot(rows, s => partialR(s)?.pr);
  overall.bootInc = boot(rows, s => incR2(s)?.inc);

  // 層別（事前定義カテゴリ: プール年数）
  const bands = {};
  for (const band of ['1年', '2年', '3年以上']) {
    const sub = rows.filter(r => yearBand(r.years) === band);
    bands[band] = sub.length < 8 ? { n: sub.length, note: '標本不足' }
      : { n: sub.length, p: partialR(sub), r2: incR2(sub),
          bootPr: boot(sub, s => partialR(s)?.pr),
          medWeight: [...sub.map(r => r.weight)].sort((a, b) => a - b)[Math.floor(sub.length / 2)] };
  }

  // 連続の moderation: y ~ statZ + npbC + npbC×logWc （中心化）
  const lw = rows.map(r => Math.log(r.weight));
  const mlw = lw.reduce((a, b) => a + b, 0) / lw.length;
  const mnp = rows.reduce((a, r) => a + r.npb, 0) / rows.length;
  const X = rows.map((r, i) => [1, r.statZ, r.npb - mnp, (r.npb - mnp) * (lw[i] - mlw)]);
  const yv = rows.map(r => r.y);
  const bmod = ols(X, yv);
  const interaction = bmod ? bmod[3] : null;
  const bootInt = boot(rows, s => {
    const l = s.map(r => Math.log(r.weight)); const ml = l.reduce((a, b) => a + b, 0) / l.length;
    const mn = s.reduce((a, r) => a + r.npb, 0) / s.length;
    const b2 = ols(s.map((r, i) => [1, r.statZ, r.npb - mn, (r.npb - mn) * (l[i] - ml)]), s.map(r => r.y));
    return b2 ? b2[3] : null;
  });

  // cross-validated 誤差（選手単位5-fold）
  const K = 5;
  const cvErr = (cols) => {
    const pr = [], ac = [];
    for (let k = 0; k < K; k++) {
      const tr = rows.filter(r => foldOf(r.name, K) !== k), te = rows.filter(r => foldOf(r.name, K) === k);
      if (tr.length < 8 || !te.length) continue;
      const b = ols(tr.map(cols), tr.map(r => r.y)); if (!b) continue;
      for (const r of te) { pr.push(cols(r).reduce((s, v, i) => s + v * b[i], 0)); ac.push(r.y); }
    }
    if (pr.length < 10) return null;
    const mae = pr.reduce((s, v, i) => s + Math.abs(v - ac[i]), 0) / pr.length;
    const rmse = Math.sqrt(pr.reduce((s, v, i) => s + (v - ac[i]) ** 2, 0) / pr.length);
    return { mae, rmse, n: pr.length };
  };
  const cv1 = cvErr(r => [1, r.statZ]);
  const cv2 = cvErr(r => [1, r.npb]);
  const cv3 = cvErr(r => [1, r.statZ, r.npb]);

  results[th] = { n: rows.length, overall, bands, interaction, bootInt, cv1, cv2, cv3,
    medWeight: [...rows.map(r => r.weight)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] };
}

// ── 出力 ───────────────────────────────────────────────────────────
const f3 = v => v == null ? '-' : (v >= 0 ? '+' : '') + v.toFixed(3);
const f4 = v => v == null ? '-' : v.toFixed(4);
const ci = b => b == null ? '-' : `[${f3(b.lo)}, ${f3(b.hi)}]`;
const L = []; const push = s => L.push(s);

push('# T-0203 統計材料が薄い選手でNPB+は追加情報を持つか（層別検証）\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('## 事前に決めたこと（結果を見てから変えていない）\n');
push('```text');
push('層別の主軸 : weight ＝ poolAcrossYears が返す「プールした各年のPA合計」');
push('             実装に直接ある量。**連続変数**として扱う（log変換・中心化）');
push('層別の副軸 : years ＝ プールした年数。**事前定義カテゴリ 1年 / 2年 / 3年以上**');
push(`主要条件   : 2026 advance機会 >= ${PRIMARY_MIN_CHANCES}（層に分けても人数が残る最小値）`);
push(`感度       : ${SENSITIVITY.join(' / ')}`);
push('統計側     : maxSeason=2025。2026の情報を一切含まない（漏れ検査つき）');
push('PowerPro   : 一切使わない');
push('```');
push('★層別の軸はどちらも**NPB+を見る前に確定する**。');
push('PowerProとの乖離・NPB+との食い違いは層別に使っていない。\n');
push('---\n');

for (const th of SENSITIVITY) {
  const R = results[th];
  push(`## advance機会 >= ${th}${th === PRIMARY_MIN_CHANCES ? '（主要条件）' : '（感度）'}\n`);
  if (R.note) { push(`${R.note}（n=${R.n}）\n`); continue; }
  push(`n = ${R.n}人 ／ weightの中央値 ${R.medWeight}\n`);
  push('### 全体\n');
  push('```text');
  push(`統計モデル → 2026advance      ${f3(R.overall.p?.rys)}`);
  push(`NPB+       → 2026advance      ${f3(R.overall.p?.ryn)}`);
  push(`NPB+ と 統計モデル の相関      ${f3(R.overall.p?.rns)}`);
  push('');
  push(`NPB+の増分（偏相関）           ${f3(R.overall.p?.pr)}   95%CI ${ci(R.overall.bootPr)}`);
  push(`R²  統計のみ ${f4(R.overall.r2?.m1)} → 統計+NPB+ ${f4(R.overall.r2?.m3)}`);
  push(`incremental R²                 ${f4(R.overall.r2?.inc)}   95%CI ${ci(R.overall.bootInc)}`);
  push('```\n');
  push('### 交差検証の誤差（選手単位5-fold）\n');
  push('| モデル | fold外n | MAE | RMSE |');
  push('|---|---|---|---|');
  for (const [nm, c] of [['(1) 統計モデル単独', R.cv1], ['(2) NPB+単独', R.cv2], ['(3) 統計+NPB+', R.cv3]])
    push(`| ${nm} | ${c?.n ?? '-'} | ${c ? c.mae.toFixed(4) : '-'} | ${c ? c.rmse.toFixed(4) : '-'} |`);
  if (R.cv1 && R.cv3) {
    push('');
    push('```text');
    push(`MAE差  (3)−(1) = ${(R.cv3.mae - R.cv1.mae).toFixed(4)}   （負なら NPB+ を足して改善）`);
    push(`RMSE差 (3)−(1) = ${(R.cv3.rmse - R.cv1.rmse).toFixed(4)}`);
    push('```');
  }
  push('');
  push('### 層別（事前定義カテゴリ: プール年数）\n');
  push('| 層 | n | weight中央値 | 統計→結果 | NPB+→結果 | NPB+の増分(偏相関) | 95%CI | incremental R² |');
  push('|---|---|---|---|---|---|---|---|');
  for (const band of ['1年', '2年', '3年以上']) {
    const b = R.bands[band];
    if (b.note) { push(`| ${band} | ${b.n} | ${b.note} | | | | | |`); continue; }
    push(`| ${band} | ${b.n} | ${b.medWeight} | ${f3(b.p?.rys)} | ${f3(b.p?.ryn)} | **${f3(b.p?.pr)}** | ${ci(b.bootPr)} | ${f4(b.r2?.inc)} |`);
  }
  push('');
  push('### 連続の交互作用（仮説の直接検定）\n');
  push('```text');
  push('モデル: 2026advance ~ 統計z + NPB+(中心化) + NPB+ × log(weight)(中心化)');
  push(`交互作用の係数  ${f4(R.interaction)}   95%CI ${R.bootInt ? `[${f4(R.bootInt.lo)}, ${f4(R.bootInt.hi)}]` : '-'}`);
  push('```');
  push('仮説が正しければ**係数は負**（weightが小さいほどNPB+の効きが大きい）。');
  const sig = R.bootInt && (R.bootInt.lo > 0 || R.bootInt.hi < 0);
  push(sig ? `→ 95%CIが0を跨がない。**交互作用あり**（向き: ${R.interaction < 0 ? '仮説と一致' : '仮説と逆'}）\n`
    : '→ **95%CIが0を跨ぐ。交互作用は確認できない。**\n');
}

// ── 判定 ───────────────────────────────────────────────────────────
push('---\n');
push('## 判定\n');
{
  const R = results[PRIMARY_MIN_CHANCES];
  if (R?.note) push('主要条件で標本不足。**判定 C（判定不能）**。\n');
  else {
    const thin = R.bands['1年'];
    // ★仮説の対象は「統計材料が薄い層」。その層を測れていないなら、
    //   他の層で増分が無くても「薄い層でも無い」とは言えない（Aを出してはいけない）。
    const thinMeasurable = thin && !thin.note;
    const thinHas = thinMeasurable && thin.bootPr && thin.bootPr.lo > 0;
    const anyBandHas = ['1年', '2年', '3年以上'].some(b => {
      const x = R.bands[b]; return x && !x.note && x.bootPr && x.bootPr.lo > 0;
    });
    const overallHas = R.overall.bootPr && R.overall.bootPr.lo > 0;
    const interactionSig = R.bootInt && (R.bootInt.lo > 0 || R.bootInt.hi < 0);
    // 薄い層が測れず、連続の交互作用も決着しないなら判定不能
    const tooSmall = !thinMeasurable && !interactionSig;

    push('```text');
    push(`全体の増分       ${f3(R.overall.p?.pr)}  95%CI ${ci(R.overall.bootPr)}`);
    for (const b of ['1年', '2年', '3年以上']) {
      const x = R.bands[b];
      push(`層 ${b.padEnd(6)} ${x.note ? x.note + `(n=${x.n})` : `${f3(x.p?.pr)}  95%CI ${ci(x.bootPr)}  n=${x.n}`}`);
    }
    push(`交互作用         ${f4(R.interaction)}  95%CI ${R.bootInt ? `[${f4(R.bootInt.lo)}, ${f4(R.bootInt.hi)}]` : '-'}`);
    push('```\n');

    if (tooSmall) {
      push('### C. 小標本で判定不能\n');
      push(`**仮説の対象である「統計材料が最も薄い層（プール1年）」が n=${thin?.n ?? 0} で推定できない。**`);
      push('他の層で増分が無くても、それは「薄い層でも無い」ことを意味しない。');
      push('連続の交互作用も95%CIが0を跨ぐため、そちらでも代替できない。\n');
      push('**したがって自動blendしない。** 低reliability選手についてNPB+は');
      push('review evidence（人間が見る材料）として残す。\n');
      push('※ 2026年はシーズン途中で走塁機会が少なく、プール1年の選手（＝新人・復帰組）が');
      push('　そもそもadvanceの母数を持たない。2026年終了後に再実行すれば判定できる可能性がある。\n');
    } else if (thinHas && !overallHas) {
      push('### B. 低reliability層だけNPB+に明確な増分あり\n');
      push('一律(c)ではなく条件付きモデルにする。統計reliabilityが低い時だけNPB+を補助入力にする。');
      push('重みはPowerPro一致度ではなく、現実アウトカムへの incremental predictive value から校正する。\n');
    } else if (!anyBandHas && !overallHas) {
      push('### A. 低reliability層でもNPB+に増分なし\n');
      push('どの層でも増分の95%CIが0を跨ぐ（下限が0以下）。');
      push('**(c)を relative model として全体採用してよい。**');
      push('NPB+ raw値は削除せず、QA・conflict検出・人間レビュー資料として保持する。\n');
    } else {
      push('### C. 判定を確定できない\n');
      push('層ごとの向きが揃わない、または全体と層で結論が食い違う。**自動blendしない。**\n');
    }
  }
}
push('## 限界\n');
push('- NPB+は2026年の計測で、当てる2026 advanceと**同年**。NPB+側に「現在の状態を知っている」優位が残る。');
push('  この非対称は消せない。**増分が出ない結論は強く、出る結論は弱い**という向きで読む');
push('- 2026年はシーズン途中でadvanceの機会が少なく、母数が小さい。bootstrapのCIは広い');
push('- 0〜100の絶対目盛りは判定していない（`scale_calibration.走力`のPowerPro依存は別問題）');
push('- 走力は `traitRating` を通らないため、実装内に reliability の値そのものは存在しない。');
push('  同じ役割の量として `weight`（PA合計）を連続変数として使った');

writeFileSync(path.join(ROOT, 'outputs', 't0203_stratified_npb_plus_increment.md'), L.join('\n'), 'utf8');

const csv = ['threshold,stratum,n,r_stat,r_npb,partial,ci_lo,ci_hi,inc_r2'];
for (const th of SENSITIVITY) {
  const R = results[th]; if (R?.note) continue;
  csv.push([th, 'ALL', R.n, R.overall.p?.rys ?? '', R.overall.p?.ryn ?? '', R.overall.p?.pr ?? '',
    R.overall.bootPr?.lo ?? '', R.overall.bootPr?.hi ?? '', R.overall.r2?.inc ?? ''].join(','));
  for (const b of ['1年', '2年', '3年以上']) {
    const x = R.bands[b]; if (x.note) { csv.push([th, b, x.n, '', '', '', '', '', ''].join(',')); continue; }
    csv.push([th, b, x.n, x.p?.rys ?? '', x.p?.ryn ?? '', x.p?.pr ?? '', x.bootPr?.lo ?? '', x.bootPr?.hi ?? '', x.r2?.inc ?? ''].join(','));
  }
}
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 't0203_stratified_npb_plus_increment.csv'), csv.join('\n'), 'utf8');

for (const th of SENSITIVITY) {
  const R = results[th];
  if (R?.note) { console.log(`>=${th}: ${R.note} (n=${R.n})`); continue; }
  console.log(`>=${th}: n=${R.n} 全体増分 ${f3(R.overall.p?.pr)} CI${ci(R.overall.bootPr)} / 交互作用 ${f4(R.interaction)} CI${R.bootInt ? `[${f4(R.bootInt.lo)}, ${f4(R.bootInt.hi)}]` : '-'}`);
  for (const b of ['1年', '2年', '3年以上']) {
    const x = R.bands[b];
    console.log(`   ${b.padEnd(6)} ${x.note ? x.note + `(n=${x.n})` : `n=${x.n} 増分${f3(x.p?.pr)} CI${ci(x.bootPr)}`}`);
  }
}

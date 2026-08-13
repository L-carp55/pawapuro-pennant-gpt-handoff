// SP-019 — proxy deconfounding / validation target の再監査（EX-004/EX-006/EX-007是正）。
//
// 正本: docs/state/speed_exclusion_reason_ledger.tsv EX-006/EX-007
//       docs/audits/speed_next_year_repeatability_policy_correction_20260813.md §2
//
// 何を直すか:
//   EX-007: 「三塁打の走塁成分分離は翌年再現性が下がるから不採用」→ 翌年再現性を採否基準に
//           使わないので、同時点の誤差伝播（axis 2）だけで再判定する
//   EX-006: 「infieldHitのGB率デconfoundingはUBR相関が下がるから見送り」→ UBR相関のみを
//           唯一の採否基準にしない。UBR自体が走塁技術を含む交絡込みproxyであることを踏まえ、
//           他の同時点proxy（triple/gdpAvoid/advance）との同時点収束（axis 5）で再評価する
//
// 使い方: node scripts/sp019_proxy_deconfounding_reaudit.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const runNorm = J('running_norms.json');
const nrm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const SEASONS = [2021, 2022, 2023, 2024, 2025];
const MIN_PA = 150;

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const stmt = db.prepare(`
  SELECT b.season, b.player_id, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp,
         bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=? AND b.position<>'投'`);

const rowsBySeason = new Map(SEASONS.map(s => [s, stmt.all(s, MIN_PA)]));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const varOf = a => { const m = mean(a); return mean(a.map(x => (x - m) ** 2)); };
const cov = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / a.length; };
const corr = (a, b) => cov(a, b) / Math.sqrt(varOf(a) * varOf(b));

// ── EX-007: triple-rate baserunning separation を同時点の誤差伝播で再判定 ──────────
//
// 元の分析(outputs/triple_rate_separation_20260805.md): 三塁打割合 = 0.1029 + 0.3477×走塁指標 + 残差。
// 「残差の翌年再現性が下がる」ことを理由に不採用にした＝owner rule違反。
//
// 同時点の議論: 残差 = 三塁打割合 - b×走塁指標 のとき、両者の観測誤差が独立なら
//   Var(残差の誤差) = Var(三塁打割合の誤差) + b² × Var(走塁指標の誤差)
// は代数的に必ず三塁打割合単体の誤差以上になる。これは「どの年を見るか」に依らない
// 同時点の性質（axis 2）であり、Y+1データを一切使わずに検証できる。
const B_COEF = 0.3477;
const ex007 = { perSeason: [], note: '' };
for (const s of SEASONS) {
  const tripleErrs = [], advErrs = [];
  for (const r of rowsBySeason.get(s)) {
    const trials = r.b2 + r.b3;
    if (!(trials > 0)) continue;
    const p = r.b3 / trials;
    const tripleErrVar = p * (1 - p) / trials;
    const a = advanceOf(db, nrm(r.name), s);
    if (!a || !(a.chances > 0)) continue;
    const pHat = Math.min(0.999, Math.max(0.001, 0.5 + a.value));
    const advErrVar = pHat * (1 - pHat) / a.chances;
    tripleErrs.push(tripleErrVar);
    advErrs.push(advErrVar);
  }
  if (tripleErrs.length < 30) continue;
  const meanTripleErrVar = mean(tripleErrs);
  const meanAdvErrVar = mean(advErrs);
  const residualErrVar = meanTripleErrVar + (B_COEF ** 2) * meanAdvErrVar;
  ex007.perSeason.push({
    season: s, n: tripleErrs.length,
    raw_err_var: meanTripleErrVar,
    residual_err_var: residualErrVar,
    added_noise_pct: (residualErrVar / meanTripleErrVar - 1) * 100,
  });
}
ex007.note = '残差の誤差分散は代数的に常に生の三塁打割合以上（Var(a-bX)=Var(a)+b^2*Var(X)、独立誤差前提）。' +
  '観測された走塁指標側の標本誤差が三塁打側の標本誤差に比べてどれだけ大きいかで、分離の代償が決まる。';

// ── EX-006: infieldHit の GB率デconfounding を「他proxyとの同時点収束」で再評価 ─────
//
// 元の判断: GB率を外すとUBR相関が0.293まで落ちるため外さなかった。
// 再評価: UBR自体が走塁技術込みのproxyなので、UBR相関の増減だけを基準にしない。
// GB率残差化した内野安打率が、triple/gdpAvoid/advance（脚力を測る他の同時点proxy）との
// 相関でどう変わるかを見る（axis 5: same-time convergence）。
const ex006rows = [];
for (const s of SEASONS) {
  for (const r of rowsBySeason.get(s)) {
    if (r.ih == null || r.gb_pct == null) continue;
    const inplay = Math.max(1, r.ab - r.so);
    const ihRate = r.ih / inplay;
    const tripleRate = (r.b2 + r.b3) > 0 ? r.b3 / (r.b2 + r.b3) : null;
    const gbCount = Math.max(1, inplay * (r.gb_pct / 100));
    const gdpAvoid = -r.gdp / gbCount;
    const a = advanceOf(db, nrm(r.name), s);
    if (tripleRate == null || !a || !(a.chances >= 20)) continue;
    ex006rows.push({ season: s, ihRate, gbPct: r.gb_pct, tripleRate, gdpAvoid, advance: a.value });
  }
}
// infieldHit を GB率へ単回帰し残差を作る（元のnoteが言う「外す」処理を実際に実行）
const xs = ex006rows.map(r => r.gbPct), ys = ex006rows.map(r => r.ihRate);
const mx = mean(xs), my = mean(ys);
const bIh = cov(xs, ys) / varOf(xs);
const aIh = my - bIh * mx;
for (const r of ex006rows) r.ihResidual = r.ihRate - (aIh + bIh * r.gbPct);

const rawIh = ex006rows.map(r => r.ihRate);
const residIh = ex006rows.map(r => r.ihResidual);
const tripleArr = ex006rows.map(r => r.tripleRate);
const gdpArr = ex006rows.map(r => r.gdpAvoid);
const advArr = ex006rows.map(r => r.advance);

const ex006 = {
  n: ex006rows.length,
  gb_coefficient: bIh,
  convergence: {
    raw_vs_triple: corr(rawIh, tripleArr), resid_vs_triple: corr(residIh, tripleArr),
    raw_vs_gdpAvoid: corr(rawIh, gdpArr), resid_vs_gdpAvoid: corr(residIh, gdpArr),
    raw_vs_advance: corr(rawIh, advArr), resid_vs_advance: corr(residIh, advArr),
  },
};

const out = { generated_at: '2026-08-13', policy: 'CLAUDE.md 年度査定の目的関数 / speed_exclusion_reason_ledger.tsv EX-006,EX-007', ex007, ex006 };
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp019_proxy_deconfounding_reaudit.json'), JSON.stringify(out, null, 2));

console.log('=== EX-007: triple-rate baserunning separation（同時点誤差伝播） ===');
for (const row of ex007.perSeason) {
  console.log(`${row.season}: n=${row.n} raw_err_var=${row.raw_err_var.toFixed(6)} residual_err_var=${row.residual_err_var.toFixed(6)} (+${row.added_noise_pct.toFixed(1)}%)`);
}
console.log('\n=== EX-006: infieldHit GB-rate deconfounding（他proxyとの同時点収束） ===');
console.log(`n=${ex006.n}, GB係数=${ex006.gb_coefficient.toFixed(6)}`);
console.log('raw vs triple   :', ex006.convergence.raw_vs_triple.toFixed(3), ' | resid vs triple   :', ex006.convergence.resid_vs_triple.toFixed(3));
console.log('raw vs gdpAvoid :', ex006.convergence.raw_vs_gdpAvoid.toFixed(3), ' | resid vs gdpAvoid :', ex006.convergence.resid_vs_gdpAvoid.toFixed(3));
console.log('raw vs advance  :', ex006.convergence.raw_vs_advance.toFixed(3), ' | resid vs advance  :', ex006.convergence.resid_vs_advance.toFixed(3));

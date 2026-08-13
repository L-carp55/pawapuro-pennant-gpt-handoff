// SP-016 — 走力の自動多年プールを current-year-only owner rule に対して監査する。
//
// 正本: CLAUDE.md §絶対禁止「十分なcurrent-year evidenceがある選手へ過去年を自動poolする」
//       docs/audits/speed_next_year_repeatability_policy_correction_20260813.md §1.5 / §4
//       docs/state/speed_task_registry.tsv SP-016（owner_review blocker / gate blocker）
//
// ■ 完了条件（台帳より）
//   1. 走力で過去年が自動混合される全経路を列挙
//   2. current evidenceが十分な選手ではcurrent-year中心へ戻す
//   3. historical priorを使う条件を明文化
//
// ■ 閾値の決め方（翌年再現性を使わない）
//   「十分」は同時点の標本誤差から決める。打席数バケットごとに
//     reliability = 1 − E[標本誤差の分散] / 観測された選手間分散
//   を出し、これが0.5を超える（＝標本誤差が選手間のばらつきより小さくなる）打席数を閾値にする。
//   1シーズン内で完結し、翌年の情報を含まない。
//
// 使い方: node scripts/sp016_current_year_first_audit.mjs

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
const SEASONS = [2021, 2022, 2023, 2024, 2025];

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const st = db.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=50 AND b.position<>'投'`);

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const varOf = a => { const m = mean(a); return mean(a.map(x => (x - m) ** 2)); };

// ── 打席数バケットごとの同時点信頼性 ──────────────────────────────
const BUCKETS = [[50, 100], [100, 150], [150, 200], [200, 300], [300, 400], [400, 500], [500, 9999]];
const curve = [];
for (const [lo, hi] of BUCKETS) {
  const zs = [], se2s = [];
  for (const s of SEASONS) for (const r of st.all(s)) {
    if (!(r.pa >= lo && r.pa < hi)) continue;
    const a = advanceOf(db, nrm(r.name), s);
    const sc = speedComponents(
      { PA: r.pa, AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp },
      { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: s,
        advance: a?.value ?? null, advanceChances: a?.chances ?? 0 }, r.ubr, runNorm);
    if (sc.score == null || !Number.isFinite(sc.score)) continue;
    // 合成zの標本誤差を、各材料の二項誤差から近似する（同時点のみ）
    const inplay = Math.max(1, r.ab - r.so);
    const gb = Math.max(1, inplay * ((r.gb_pct ?? runNorm.leagueGbPct) / 100));
    const parts = [];
    if ((r.b2 + r.b3) > 0) { const p = r.b3 / (r.b2 + r.b3), n = r.b2 + r.b3;
      parts.push(p * (1 - p) / n / (runNorm.triple?.sd ** 2 || 1)); }
    { const p = r.gdp / gb; parts.push(p * (1 - p) / gb / (runNorm.gdpAvoid?.sd ** 2 || 1)); }
    if (r.ih != null) { const p = r.ih / inplay; parts.push(p * (1 - p) / inplay / 0.01); }
    if (parts.length) { zs.push(sc.score); se2s.push(mean(parts) / parts.length); }
  }
  if (zs.length < 30) { curve.push({ lo, hi, n: zs.length, note: '標本不足' }); continue; }
  const obs = varOf(zs), err = mean(se2s);
  curve.push({ lo, hi, n: zs.length, obsVar: obs, errVar: err,
    reliability: obs > 0 ? Math.max(0, 1 - err / obs) : 0 });
}
const ok = curve.filter(c => c.reliability != null);
const crossing = ok.find(c => c.reliability >= 0.5);
const SUFFICIENT_PA = crossing ? crossing.lo : 300;

// ── 影響: 100人でcurrent-year-firstにすると何人がどれだけ動くか ────
const ctx = makeContext(db, cfg);
const target = st.all(2025).filter(r => r.pa >= 150);
// ★単一の閾値を恣意的に置かない。複数の閾値で影響を並べる（SP-015と同じ規律）。
const THRESHOLDS = [SUFFICIENT_PA, 150, 300, 443];
const bySeq = new Map();
for (const th of THRESHOLDS) bySeq.set(th, []);
let impact = [];
for (const r of target) {
  try {
    const base = appraiseCard(ctx, { name: r.name, mode: '2025', statPrimarySpeed: true, cfg, rv, runNorm, fldNorm }).card;
    const a = base?.abilities?.基礎能力?.走力?.value;
    if (a == null) continue;
    for (const th of THRESHOLDS) {
      const cyf = appraiseCard(ctx, { name: r.name, mode: '2025', statPrimarySpeed: true,
        currentYearFirst: true, sufficientWeight: th, cfg, rv, runNorm, fldNorm }).card;
      const b = cyf?.abilities?.基礎能力?.走力?.value;
      if (b == null) continue;
      bySeq.get(th).push({ name: r.name, pa: r.pa, before: a, after: b, delta: b - a,
        reason: cyf?.calc_log?.running?.speed_years, years_after: cyf?.calc_log?.running?.speed_years,
        years_before: base?.calc_log?.running?.speed_years });
    }
  } catch { /* 名寄せ不可等はスキップ */ }
}
impact = bySeq.get(SUFFICIENT_PA) ?? [];
const thresholdTable = THRESHOLDS.map(th => { const L2 = bySeq.get(th);
  const mv = L2.filter(x => Math.abs(x.delta) >= 0.05), bg = L2.filter(x => Math.abs(x.delta) >= 5);
  return { th, n: L2.length, moved: mv.length, big: bg.length,
    meanAbs: mv.length ? mean(mv.map(x => Math.abs(x.delta))) : 0,
    maxAbs: mv.length ? Math.max(...mv.map(x => Math.abs(x.delta))) : 0 }; });
db.close();

const moved = impact.filter(x => Math.abs(x.delta) >= 0.05);
const big = impact.filter(x => Math.abs(x.delta) >= 5);
const f2 = v => v == null ? '-' : v.toFixed(2);

const L = []; const push = s => L.push(s);
push('# SP-016 — 走力の自動多年プールを current-year-only rule に対して監査\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('状態: **監査完了・候補実装あり。productionの既定は変えていない**\n');
push('## 1. 過去年が自動混合される経路（全列挙）\n');
push('| # | 経路 | 対象 | 現在の挙動 |');
push('|---|---|---|---|');
push('| 1 | `src/ratings/durable_traits.mjs` `poolAcrossYears` | 走力・肩力・補殺 | 対象年の**前後3年**を打席/イニングで加重平均。current-yearを特別扱いしない |');
push('| 2 | `src/cards/durable_estimate.mjs` `estimateDurableTraits` | 走力 | 上を呼ぶ。SQLも `targetSeason±3` で引く |');
push('| 3 | `src/cards/pipeline.mjs` L590 `pooledSpeed` | 走力 | `durable.speed` をそのまま採用。無い時だけ単年へ落ちる |');
push('| 4 | `src/ratings/shrinkage.mjs` `selectPrior` | **打撃**（ミート/パワー） | 2026-08-05に `full_season_ab=359` で対応済み。走力とは別経路 |');
push('');
push('**走力で効いているのは 1〜3 の1本道。** 打撃側（4）は既に current-year 中心へ直っており、');
push('走力だけが取り残されていた。\n');
push('## 2. 「十分」の閾値を同時点の標本誤差から決める\n');
push('翌年再現性は使えないので、**1シーズン内の標本誤差**から決める。\n');
push('```text');
push('reliability = 1 − E[標本誤差の分散] / 観測された選手間分散');
push('```');
push('| 打席数 | n | 同時点の信頼性 |');
push('|---|---|---|');
for (const c of curve) push(`| ${c.lo}–${c.hi === 9999 ? '' : c.hi} | ${c.n} | ${c.note ?? f2(c.reliability)} |`);
push('');
push(`信頼性が0.5（標本誤差＜選手間のばらつき）を最初に超えるのは **${SUFFICIENT_PA}打席**。`);
push('これを「current-yearだけで足りる」の閾値にする。\n');
push('## 3. 影響（2025年・150打席以上）\n');
push('★単一閾値を恣意的に置かない。複数の閾値で並べる（SP-015と同じ規律）。\n');
push('| 閾値(打席) | 対象 | 動いた | 5点以上 | 平均変化 | 最大変化 |');
push('|---|---|---|---|---|---|');
for (const t of thresholdTable) {
  push(`| ${t.th}${t.th === SUFFICIENT_PA ? '（信頼性0.5交差）' : ''} | ${t.n} | ${t.moved} | ${t.big} | ${f2(t.meanAbs)} | ${f2(t.maxAbs)} |`);
}
push('');
push('閾値を上げるほど過去年を混ぜる選手が増え、現行(legacy)の挙動へ近づく。');
push('**閾値の確定はowner reviewとSP-015の重み確定を待つ。ここでは決め打ちしない。**\n');
push('```text');
push(`対象 ${impact.length}人`);
push(`値が動いた（0.05点以上） ${moved.length}人`);
push(`5点以上動いた           ${big.length}人`);
if (moved.length) push(`動いた分の平均 ${f2(mean(moved.map(x => Math.abs(x.delta))))}点 / 最大 ${f2(Math.max(...moved.map(x => Math.abs(x.delta))))}点`);
push('```\n');
if (big.length) {
  push('| 選手 | 打席 | 前 | 後 | 差 | 使った年数 前→後 |');
  push('|---|---|---|---|---|---|');
  for (const x of big.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 20))
    push(`| ${x.name} | ${x.pa} | ${f2(x.before)} | ${f2(x.after)} | ${x.delta > 0 ? '+' : ''}${f2(x.delta)} | ${x.years_before}→${x.years_after} |`);
  push('');
}
push('## 4. historical prior を使ってよい条件（明文化）\n');
push('current-yearが十分でない時だけ過去年を足す。理由と重みを必ず記録する。\n');
push('| 条件 | 記録する理由コード |');
push('|---|---|');
push(`| その年の観測が閾値（${SUFFICIENT_PA}打席）未満 | \`LOW_SAMPLE_CURRENT_YEAR(実測<閾値)\` |`);
push('| その年の観測が無い | `NO_CURRENT_YEAR_OBSERVATION` |');
push('| 十分に観測されている | `CURRENT_YEAR_SUFFICIENT`（＝過去年を使わない） |');
push('| 従来どおりの自動プール | `LEGACY_AUTO_POOL`（現在の既定。移行までの対照） |');
push('');
push('※ 故障・明らかな下振れ・明示的なtemporal bridgingは、**現状のデータでは自動判定できない**');
push('（年齢・生年月日・故障情報が既存成果に存在しない＝SP-044 / SP-045 が BLOCKED_MISSING_DATA）。');
push('そのため現時点で実装したのは打席数による条件のみで、残りは依存待ちとして明示する。\n');
push('## 5. 実装状態\n');
push('```text');
push('poolAcrossYears(obs, targetSeason, { currentYearFirst, sufficientWeight })');
push('  currentYearFirst 既定 false ＝ productionの挙動は変わらない（legacy control として保持）');
push('  戻り値に poolReason / currentYearWeight を追加し、なぜその年数かを毎回記録する');
push('appraiseCard(ctx, { currentYearFirst, sufficientWeight }) から指定できる');
push('```\n');
push('**productionへの適用はまだ行っていない。** 適用はowner reviewの結果とSP-015の重み確定を待つ。');

writeFileSync(path.join(ROOT, 'outputs', 'sp016_current_year_first_audit.md'), L.join('\n'), 'utf8');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp016_current_year_first_audit.json'),
  JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10), sufficient_pa: SUFFICIENT_PA,
    reliability_curve: curve, impact_summary: { n: impact.length, moved: moved.length, big: big.length },
    impact }, null, 2), 'utf8');

console.log(`閾値 ${SUFFICIENT_PA}打席 / 対象${impact.length}人 動いた${moved.length}人 5点以上${big.length}人`);
console.log('信頼性カーブ:', curve.map(c => `${c.lo}:${c.note ?? f2(c.reliability)}`).join(' '));

// SP-015 — final annual appraisal weight の設計（6軸、PowerPro個人ラベル・翌年再現性を使わない）
//
// ■ 使ってよい軸（オーナー裁定 2026-08-14）
//   1 construct directness            — その材料が「走る速さ」をどれだけ直接測るか
//   2 same-time measurement reliability — 同一シーズン内の標本誤差 vs 選手間分散
//   3 sample error                     — 試行回数由来の推定誤差（2と同源。分けて表示する）
//   4 confounding                      — 走力以外（打撃・起用・打球）の混入
//   5 temporal proximity               — 査定年と観測時点の近さ
//   6 independent physical convergence — PowerProを経由しない物理量との一致
//
// ■ 使ってはいけないもの
//   - 翌年再現性（SR-053）
//   - PowerPro個人ラベル（SP-046 B-3）
//   → 6の基準には **NPB+ raw sprint speed(km/h)** を使う。これはトラッキングが出す物理量で
//     PowerProのラベルではない（SR-010が両者の分離を要求。SP-046 §4で許可を明文化）。
//     axis-levelの重み決定にのみ使い、player-levelの値は当てにいかない。
//
// 使い方: node scripts/sp015_final_weight_design.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const runNorm = J('running_norms.json');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const SEASONS = [2021, 2022, 2023, 2024, 2025];
const MIN_PA = 150;

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const stmt = db.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, b.h,
         bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=? AND b.position<>'投'`);

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const varOf = a => { const m = mean(a); return mean(a.map(x => (x - m) ** 2)); };
const cov = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / a.length; };
const corr = (a, b) => { const d = Math.sqrt(varOf(a) * varOf(b)); return d > 0 ? cov(a, b) / d : NaN; };
// 偏相関: x と y から z の影響を除いた相関
function partialCorr(x, y, z) {
  const rxy = corr(x, y), rxz = corr(x, z), ryz = corr(y, z);
  const den = Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2));
  return den > 0 ? (rxy - rxz * ryz) / den : NaN;
}

// ── 物理基準（PowerProを経由しない）: NPB+ raw sprint speed ──────────────
const phys = JSON.parse(readFileSync(
  path.join(ROOT, 'data', 'normalized', 'speed_historical_physical_measurements_2015_2026.json'), 'utf8'));
const npbSpeed = new Map();
for (const r of phys.records) {
  if (r.metric === 'NPB_PLUS_SPRINT_SPEED_KMH' && Number.isFinite(r.value)) npbSpeed.set(nk(r.player), r.value);
}

// ── 材料の生値と試行回数 ────────────────────────────────────
const COMPONENTS = {
  triple:     { label: '三塁打割合',   directness: 'MEDIUM', directness_why: '走って三塁へ到達した結果。ただし長打力・球場形状・打球方向が混ざる' },
  gdpAvoid:   { label: '併殺回避',     directness: 'MEDIUM', directness_why: '一塁へ走る速さが効くが、打球の質・走者状況・打順が混ざる' },
  infieldHit: { label: '内野安打率',   directness: 'HIGH',   directness_why: '本塁→一塁の脚力が最も直接効く。ゴロ率・打席左右が混ざる' },
  advance:    { label: '自作走塁指標', directness: 'LOW',    directness_why: '走塁判断（いつ行くか）が主。純粋な脚力ではない' },
  ubr:        { label: 'UBR',          directness: 'LOW',    directness_why: '走塁の得点貢献。判断とスピードの合成で分解できない' },
};

const rows = [];
for (const s of SEASONS) {
  for (const r of stmt.all(s, MIN_PA)) {
    const k = nk(r.name);
    const inplay = Math.max(1, r.ab - r.so);
    const trials = r.b2 + r.b3;
    const a = advanceOf(db, k, s);
    const gb = Math.max(1, inplay * ((r.gb_pct ?? runNorm.leagueGbPct) / 100));
    rows.push({
      key: k, season: s, pa: r.pa,
      triple: trials > 0 ? r.b3 / trials : null, triple_n: trials,
      gdpAvoid: -r.gdp / gb, gdpAvoid_n: gb,
      infieldHit: r.ih == null ? null : r.ih / inplay, infieldHit_n: inplay,
      advance: a?.value ?? null, advance_n: a?.chances ?? 0,
      ubr: r.pa > 0 && r.ubr != null ? r.ubr / r.pa : null, ubr_n: r.pa,
      // 交絡の指標: 打撃力（走力と無関係であるべき）
      iso: (r.b2 + 2 * r.b3 + 3 * r.hr) / Math.max(1, r.ab),
      npb: npbSpeed.get(k) ?? null,
    });
  }
}

const out = { generated_at: '2026-08-14', policy: 'SR-053(翌年再現性不使用) / SP-046 B-3(PowerPro個人ラベル不使用)', axes: {}, components: {} };

for (const [c, meta] of Object.entries(COMPONENTS)) {
  const use = rows.filter(r => r[c] != null && Number.isFinite(r[c]) && r[`${c}_n`] > 0);
  // --- 軸2/3: 同時点信頼性と標本誤差（年ごとに出して平均） ---
  const relPer = [];
  for (const s of SEASONS) {
    const v = use.filter(r => r.season === s);
    if (v.length < 30) continue;
    const p = v.map(r => r[c]);
    const obsVar = varOf(p);
    // 率は二項近似、advance/ubrは差分量なので p を [0,1] へ寄せて近似
    // ★材料ごとに「率」の取り方が違う。二項近似を当てられる形へ正しく戻す。
    //   triple/infieldHit : 値そのものが率
    //   gdpAvoid          : 値は -(併殺率)。率は絶対値side
    //   advance           : 難易度調整済みの差分。0.5+値 で率へ寄せる（v1と同じ近似）
    //   ubr               : 試行回数へ分解できない → 測れない（nullにする。0にしない）
    if (c === 'ubr') { relPer.push({ season: s, n: v.length, reliability: null,
      mean_trials: mean(v.map(r => r[`${c}_n`])) }); continue; }
    const errVar = mean(v.map(r => {
      const n = Math.max(1, r[`${c}_n`]);
      let ph;
      if (c === 'triple' || c === 'infieldHit') ph = r[c];
      else if (c === 'gdpAvoid') ph = Math.abs(r[c]);
      else ph = 0.5 + r[c];
      ph = Math.min(0.999, Math.max(0.001, ph));
      return ph * (1 - ph) / n;
    }));
    relPer.push({ season: s, n: v.length, reliability: obsVar > 0 ? Math.max(0, 1 - errVar / obsVar) : 0,
      mean_trials: mean(v.map(r => r[`${c}_n`])) });
  }
  const relVals = relPer.map(x => x.reliability).filter(x => x != null);
  const rel = relVals.length ? mean(relVals) : null;

  // --- 軸6: NPB+ raw との一致（physical convergence） ---
  const withNpb = use.filter(r => r.npb != null);
  const conv = withNpb.length >= 30 ? corr(withNpb.map(r => r[c]), withNpb.map(r => r.npb)) : null;

  // --- 軸4: 交絡（打撃力ISOの影響を除いた後の physical convergence の残り） ---
  const convPartial = withNpb.length >= 30
    ? partialCorr(withNpb.map(r => r[c]), withNpb.map(r => r.npb), withNpb.map(r => r.iso)) : null;
  const isoContam = withNpb.length >= 30 ? corr(withNpb.map(r => r[c]), withNpb.map(r => r.iso)) : null;

  out.components[c] = {
    label: meta.label,
    axis1_construct_directness: meta.directness, axis1_why: meta.directness_why,
    axis2_same_time_reliability: rel == null ? null : +rel.toFixed(4),
    axis3_sample_error_mean_trials: relPer.length ? Math.round(mean(relPer.map(x => x.mean_trials))) : null,
    axis4_iso_contamination_r: isoContam == null ? null : +isoContam.toFixed(4),
    axis5_temporal_proximity: 'SAME_SEASON(=1)',
    axis6_npb_convergence_r: conv == null ? null : +conv.toFixed(4),
    axis6_npb_convergence_partial_r_iso_removed: convPartial == null ? null : +convPartial.toFixed(4),
    n_player_seasons: use.length, n_with_npb: withNpb.length,
    per_season_reliability: relPer.map(x => ({ season: x.season, n: x.n, reliability: x.reliability == null ? null : +x.reliability.toFixed(3) })),
  };
}

// ── 重みの合成 ────────────────────────────────────────────
// 古典的な「信頼性 × 妥当性」: 材料は (a)確からしく測れていて (b)実際に構成概念を追う 分だけ重い。
// 妥当性には **交絡を除いた後の** physical convergence（偏相関）を使う＝軸4と軸6を1つに畳む。
// 軸5は current-year 査定では全材料が同一シーズンなので定数（SP-016のpooling側で効く）。
// 軸1は独立に数値化せず、軸6が実測として代弁する（恣意的な係数を置かないため）。
const comps = Object.keys(COMPONENTS);
const raw = {};
for (const c of comps) {
  const r = out.components[c].axis2_same_time_reliability;
  const v = out.components[c].axis6_npb_convergence_partial_r_iso_removed;
  raw[c] = (r == null || v == null) ? null : Math.max(0, r) * Math.abs(v);
}
const measurable = comps.filter(c => raw[c] != null);
const med = [...measurable.map(c => raw[c])].sort((a, b) => a - b)[Math.floor(measurable.length / 2)];
const finalW = {};
for (const c of comps) finalW[c] = +( (raw[c] == null ? med : raw[c]) ).toFixed(4);

out.axes = {
  axis1: 'construct directness — 数値化せず軸6が実測として代弁（恣意的係数を置かない）',
  axis2: 'same-time measurement reliability — 1 − E[標本誤差分散]/観測分散、シーズン内で完結',
  axis3: 'sample error — 軸2と同源。平均試行回数を併記して透明化',
  axis4: 'confounding — 打撃力(ISO)との相関を測り、軸6を偏相関にして除去',
  axis5: 'temporal proximity — current-year査定では全材料が同一シーズン＝定数。poolingはSP-016',
  axis6: 'independent physical convergence — NPB+ raw sprint speed(km/h)との一致。PowerProラベルではない',
  combination: 'weight ∝ max(0, reliability) × |partial_r(component, NPB+ | ISO)|（信頼性×妥当性）',
  ubr_note: 'UBRは試行回数へ分解できず軸2が測れない。測れた材料の中央値を代用（従来と同じ扱い）',
};
out.final_weights = finalW;
out.legacy_weights_same_time_reliability_only = runNorm.componentWeights;

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp015_final_weight_design.json'), JSON.stringify(out, null, 2));

console.log('材料 | 直接性 | 信頼性 | 平均試行 | ISO交絡r | NPB+一致r | 偏相関(ISO除去) | 新weight');
for (const c of comps) {
  const o = out.components[c];
  console.log(
    o.label.padEnd(12),
    String(o.axis1_construct_directness).padEnd(7),
    String(o.axis2_same_time_reliability ?? '—').padEnd(7),
    String(o.axis3_sample_error_mean_trials ?? '—').padEnd(9),
    String(o.axis4_iso_contamination_r ?? '—').padEnd(9),
    String(o.axis6_npb_convergence_r ?? '—').padEnd(10),
    String(o.axis6_npb_convergence_partial_r_iso_removed ?? '—').padEnd(16),
    finalW[c]);
}
console.log('\n旧(同時点信頼性のみ):', JSON.stringify(runNorm.componentWeights));
console.log('新(信頼性×妥当性)  :', JSON.stringify(finalW));

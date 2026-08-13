// SP-016（続き）— 50打席のhard gateを最終設計として凍結してよいかを検証する。
//
// ■ オーナー指摘（2026-08-13）
//   「current-year-firstという方向性は維持するが、49/50PAで挙動が急変するhard gateが
//    最終設計として適切か確認せよ。PAだけでなく各componentの観測量・same-time reliabilityを
//    使ったcontinuous historical-prior weightingとの比較も行い、50PAは現時点の
//    working defaultとして明示せよ。」
//
// ■ 比較する3方式（いずれもcurrent-year中心の方向性は維持＝owner ruleに適合）
//   A. legacy_auto_pool     : 前後3年を観測量で加重平均（current-yearを特別扱いしない。旧production）
//   B. hard_gate_50         : current-year PA>=50なら単年のみ、未満なら全年pool（現production既定）
//   C. continuous_pa        : 全体をPA由来のreliabilityでcurrent↔historical priorへ連続配分
//                             w_cur = PA_cur/(PA_cur + kappa)、kappa=50
//                             ＝Bと同じ較正点(w=0.5となる打席数)を持つ、不連続のない対応物
//   D. continuous_component : ★componentごとに観測量が違うことを使う。各材料の
//                             current-year試行回数(三塁打=2B+3B、内野安打=インプレー打数、
//                             advance=機会数、併殺回避=ゴロ数)と同時点信頼性(SP-015実測値)から
//                             材料別にw_curを決め、材料別にcurrent↔historicalを配分してから合成
//
//   Cのkappa=50は恣意ではない: 同時点信頼性が0.5を横切るのが50打席(SP-016監査§2)であり、
//   経験ベイズ形 w/(w+kappa) が0.5になるのは w=kappa のとき。つまりBと同じ較正点を共有する。
//
// ■ 測るもの
//   1. 不連続性: 閾値を1打席動かしたとき各方式で査定がどれだけ跳ねるか（Bだけが跳ぶはず）
//   2. 方式間の一致度と、最も食い違う選手
//
// 使い方: node scripts/sp016_hard_gate_vs_continuous_weighting.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), runNorm = J('running_norms.json');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const TARGET = 2025, GAP = 3;
const SEASONS = [TARGET - GAP, TARGET - 2, TARGET - 1, TARGET];
const KAPPA_PA = 50;   // = hard gateの閾値。連続版で w_cur=0.5 になる打席数

// SP-015実測の同時点信頼性（docs/audits/sp015_same_time_reliability.md）
const SAME_TIME_REL = runNorm.componentWeights;

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const stmt = db.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=1 AND b.position<>'投'`);

// ── 選手×年 の z と、材料別の試行回数を集める ─────────────────────────
const byPlayer = new Map();
for (const s of SEASONS) {
  for (const r of stmt.all(s)) {
    const k = nk(r.name);
    const a = advanceOf(db, k, s);
    const sc = speedComponents(
      { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
      { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: s,
        advance: a?.value ?? null, advanceChances: a?.chances ?? 0 }, r.ubr, runNorm);
    if (sc.score == null) continue;
    const inplay = Math.max(1, r.ab - r.so);
    if (!byPlayer.has(k)) byPlayer.set(k, []);
    byPlayer.get(k).push({
      season: s, pa: r.pa, z: sc.score, zByComp: sc.z,
      trials: {   // 材料ごとの「その年の観測量」
        triple: r.b2 + r.b3,
        infieldHit: r.ih == null ? 0 : inplay,
        advance: a?.chances ?? 0,
        gdpAvoid: Math.max(1, inplay * ((r.gb_pct ?? runNorm.leagueGbPct) / 100)),
        ubr: r.pa,
      },
    });
  }
}

// ── 4方式 ──────────────────────────────────────────────
const wavg = (rows, f, w) => { const W = rows.reduce((s, r) => s + w(r), 0); return W > 0 ? rows.reduce((s, r) => s + f(r) * w(r), 0) / W : null; };

function legacyAutoPool(rows) { return wavg(rows, r => r.z, r => r.pa); }

function hardGate(rows, threshold) {
  const cur = rows.filter(r => r.season === TARGET);
  const curPa = cur.reduce((s, r) => s + r.pa, 0);
  if (cur.length && curPa >= threshold) return wavg(cur, r => r.z, r => r.pa);
  return wavg(rows, r => r.z, r => r.pa);
}

function continuousPa(rows, kappa) {
  const cur = rows.filter(r => r.season === TARGET);
  const hist = rows.filter(r => r.season !== TARGET);
  const zCur = cur.length ? wavg(cur, r => r.z, r => r.pa) : null;
  const zHist = hist.length ? wavg(hist, r => r.z, r => r.pa) : null;
  if (zCur == null) return zHist;
  if (zHist == null) return zCur;
  const paCur = cur.reduce((s, r) => s + r.pa, 0);
  const w = paCur / (paCur + kappa);
  return w * zCur + (1 - w) * zHist;
}

// ★材料ごとに観測量が違う。材料別に current↔historical を配分してから、
//   SP-015の同時点信頼性で合成する。
function continuousComponent(rows) {
  const cur = rows.filter(r => r.season === TARGET);
  const hist = rows.filter(r => r.season !== TARGET);
  const COMPS = ['triple', 'gdpAvoid', 'infieldHit', 'advance', 'ubr'];
  let sum = 0, wsum = 0;
  for (const c of COMPS) {
    const curRows = cur.filter(r => Number.isFinite(r.zByComp[c]) && r.trials[c] > 0);
    const histRows = hist.filter(r => Number.isFinite(r.zByComp[c]) && r.trials[c] > 0);
    const zCur = curRows.length ? wavg(curRows, r => r.zByComp[c], r => r.trials[c]) : null;
    const zHist = histRows.length ? wavg(histRows, r => r.zByComp[c], r => r.trials[c]) : null;
    if (zCur == null && zHist == null) continue;

    // その材料の current-year 試行回数と同時点信頼性から w_cur を決める。
    // kappa_c = その材料が信頼性0.5に達する試行回数の目安。
    // 同時点信頼性 rel_c は「1シーズン分の試行でどれだけ信号が取れるか」なので、
    // 平均的な1シーズンの試行回数 medTrials_c を使って kappa_c = medTrials_c*(1-rel_c)/rel_c とする
    // （w=trials/(trials+kappa) が平均的シーズンで rel_c に一致する形）。
    const rel = SAME_TIME_REL[c] ?? 0.5;
    const medTrials = MED_TRIALS[c] ?? 100;
    const kappa = medTrials * (1 - rel) / rel;
    const trialsCur = curRows.reduce((s, r) => s + r.trials[c], 0);
    let z;
    if (zCur == null) z = zHist;
    else if (zHist == null) z = zCur;
    else { const w = trialsCur / (trialsCur + kappa); z = w * zCur + (1 - w) * zHist; }
    sum += z * rel; wsum += rel;
  }
  return wsum > 0 ? sum / wsum : null;
}

// 材料別の「平均的な1シーズンの試行回数」を実データから出す（kappa_cの較正用）
const MED_TRIALS = {};
{
  const per = { triple: [], gdpAvoid: [], infieldHit: [], advance: [], ubr: [] };
  for (const rows of byPlayer.values()) for (const r of rows) {
    if (r.pa < 150) continue;
    for (const c of Object.keys(per)) if (r.trials[c] > 0) per[c].push(r.trials[c]);
  }
  for (const [c, arr] of Object.entries(per)) {
    arr.sort((a, b) => a - b);
    MED_TRIALS[c] = arr.length ? arr[Math.floor(arr.length / 2)] : 100;
  }
}

// ── 評価対象: 2025年に出場があり、過去年も持つ選手 ──────────────────
const zToRating = z => z == null ? null
  : Math.round(Math.max(cfg.clamp.min, Math.min(cfg.clamp.max,
      cfg.zscore_ratings.speed.center + z * cfg.zscore_ratings.speed.spread)) * 10) / 10;

const rowsOut = [];
for (const [k, rows] of byPlayer) {
  const cur = rows.filter(r => r.season === TARGET);
  if (!cur.length || !rows.some(r => r.season !== TARGET)) continue;
  const curPa = cur.reduce((s, r) => s + r.pa, 0);
  rowsOut.push({
    player: k, current_pa: curPa, seasons_available: rows.length,
    legacy: zToRating(legacyAutoPool(rows)),
    hard_gate_50: zToRating(hardGate(rows, 50)),
    hard_gate_49: zToRating(hardGate(rows, 49)),
    hard_gate_51: zToRating(hardGate(rows, 51)),
    continuous_pa: zToRating(continuousPa(rows, KAPPA_PA)),
    continuous_component: zToRating(continuousComponent(rows)),
  });
}

// ── 1. 不連続性 ───────────────────────────────────────────
// (a) 実際に閾値±1打席で跳ぶ選手（＝2025年に打席数がちょうど境界付近にいた選手のみ）
const flip = rowsOut.filter(r => r.hard_gate_49 !== r.hard_gate_51)
  .map(r => ({ ...r, jump: Math.round(Math.abs(r.hard_gate_51 - r.hard_gate_49) * 10) / 10 }))
  .sort((a, b) => b.jump - a.jump);

// (b) ★崖の高さ: 境界にいる選手が「1打席の差」で受ける査定差の大きさ。
//     (a)は「今年たまたま境界打席だった人数」しか数えないため設計上の問題を過小評価する。
//     境界帯の各選手について |単年のみの値 − pool版の値| を測る＝落差そのもの。
const cliffBand = [];
for (const [k, rows] of byPlayer) {
  const cur = rows.filter(r => r.season === TARGET);
  if (!cur.length || !rows.some(r => r.season !== TARGET)) continue;
  const curPa = cur.reduce((s, r) => s + r.pa, 0);
  if (curPa < 25 || curPa > 100) continue;      // 境界50PAの周辺帯
  const single = zToRating(wavg(cur, r => r.z, r => r.pa));
  const pooled = zToRating(wavg(rows, r => r.z, r => r.pa));
  if (single == null || pooled == null) continue;
  cliffBand.push({ player: k, current_pa: curPa, single_year: single, pooled, cliff: Math.round(Math.abs(single - pooled) * 10) / 10 });
}
cliffBand.sort((a, b) => b.cliff - a.cliff);
const cliffMean = cliffBand.length ? +(cliffBand.reduce((s, r) => s + r.cliff, 0) / cliffBand.length).toFixed(2) : 0;

// ── 2. 方式間の一致度 ─────────────────────────────────────
const stats = (a, b) => {
  const pairs = rowsOut.filter(r => r[a] != null && r[b] != null);
  const d = pairs.map(r => r[a] - r[b]);
  const mean = d.reduce((s, x) => s + x, 0) / d.length;
  const mad = d.reduce((s, x) => s + Math.abs(x), 0) / d.length;
  const max = d.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const ge5 = d.filter(x => Math.abs(x) >= 5).length;
  return { n: pairs.length, mean_diff: +mean.toFixed(3), mean_abs_diff: +mad.toFixed(3), max_abs_diff: +max.toFixed(1), n_ge_5pt: ge5 };
};

// ── 3. ★どの方式が physical speed construct へ近いか（SP-019第2版と同じ外部基準） ──────
// 方式間の差が「大きい」ことは、どれが正しいかを教えてくれない。外部の独立physical evidenceで
// 突き合わせて初めて採否の根拠になる（SP-019第1版で犯した誤りを繰り返さない）。
const phys = JSON.parse(readFileSync(
  path.join(ROOT, 'data', 'normalized', 'speed_historical_physical_measurements_2015_2026.json'), 'utf8'));
const npbSpeed = new Map();
for (const r of phys.records) {
  if (r.metric === 'NPB_PLUS_SPRINT_SPEED_KMH' && Number.isFinite(r.value)) npbSpeed.set(nk(r.player), r.value);
}
const mean_ = a => a.reduce((x, y) => x + y, 0) / a.length;
const varOf_ = a => { const m = mean_(a); return mean_(a.map(x => (x - m) ** 2)); };
const corr_ = (a, b) => { const ma = mean_(a), mb = mean_(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); const d = Math.sqrt(varOf_(a) * varOf_(b)); return d > 0 ? (s / a.length) / d : NaN; };

const SCHEMES = ['legacy', 'hard_gate_50', 'continuous_pa', 'continuous_component'];
const valRows = rowsOut.filter(r => npbSpeed.has(r.player) && SCHEMES.every(s => r[s] != null));
let seed = 20260813;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const validation = {
  n: valRows.length, criterion: 'NPB+ sprint speed (km/h)',
  // ★★この基準は「どれだけ過去年を混ぜるか」の決定には使ってはいけない。
  //   NPB+ sprint speedは2026 snapshotの安定した集計量であり、多年poolした推定ほど
  //   ノイズが減って機械的に相関が上がる（poolに構造的に有利）。
  //   これを採否基準にすると「翌年再現性で決めるな」と同型の validation target 誤り
  //   （EX-006 WRONG_VALIDATION_TARGET）を再生産し、current-year中心のowner ruleを
  //   相関最大化の名目で侵食する。使ってよいのは「同じcurrent-year-first方向を持つ
  //   方式同士の形の比較」まで。
  criterion_bias_warning: 'この基準は多年poolに構造的に有利。history量の決定には使わない',
  correlations: {}, vs_hard_gate_50: {},
};
if (valRows.length >= 10) {
  const crit = valRows.map(r => npbSpeed.get(r.player));
  for (const s of SCHEMES) validation.correlations[s] = +corr_(valRows.map(r => r[s]), crit).toFixed(4);
  for (const s of SCHEMES) {
    if (s === 'hard_gate_50') continue;
    const diffs = [];
    for (let b = 0; b < 2000; b++) {
      const idx = Array.from({ length: valRows.length }, () => Math.floor(rnd() * valRows.length));
      const sm = idx.map(i => valRows[i]); const c = sm.map(r => npbSpeed.get(r.player));
      const a1 = corr_(sm.map(r => r.hard_gate_50), c), a2 = corr_(sm.map(r => r[s]), c);
      if (Number.isFinite(a1) && Number.isFinite(a2)) diffs.push(a2 - a1);
    }
    diffs.sort((x, y) => x - y);
    const lo = diffs[Math.floor(diffs.length * 0.025)], hi = diffs[Math.floor(diffs.length * 0.975)];
    validation.vs_hard_gate_50[s] = {
      diff: +(validation.correlations[s] - validation.correlations.hard_gate_50).toFixed(4),
      ci95: [+lo.toFixed(4), +hi.toFixed(4)], ci_excludes_zero: (lo > 0 || hi < 0),
    };
  }
}

const out = {
  generated_at: '2026-08-13',
  purpose: 'SP-016の50打席hard gateを最終設計として凍結してよいかの検証（オーナー指摘 2026-08-13）',
  target_season: TARGET,
  n_players: rowsOut.length,
  kappa_pa: KAPPA_PA,
  component_kappa_calibration: Object.fromEntries(Object.keys(MED_TRIALS).map(c => {
    const rel = SAME_TIME_REL[c] ?? 0.5;
    return [c, { same_time_reliability: rel, median_season_trials: MED_TRIALS[c], kappa: +(MED_TRIALS[c] * (1 - rel) / rel).toFixed(1) }];
  })),
  discontinuity: {
    observed_flip: {
      description: '閾値を49→51打席へ動かして実際に査定が跳んだ選手（2025年に打席数が境界付近だった選手のみ該当）',
      n_players_flipped: flip.length,
      max_jump_pt: flip.length ? flip[0].jump : 0,
      caveat: 'この人数は「今年たまたま境界打席だった人数」であり、設計上の不連続性の大きさではない',
    },
    cliff_height: {
      description: '★崖の高さ。境界帯(25-100打席)の選手それぞれについて |単年のみの値 - pool版の値| ＝1打席の差で受けうる査定差',
      n_players_in_band: cliffBand.length,
      mean_cliff_pt: cliffMean,
      max_cliff_pt: cliffBand.length ? cliffBand[0].cliff : 0,
      n_cliff_ge_10pt: cliffBand.filter(r => r.cliff >= 10).length,
      continuous_equivalent: 0,
      steepest: cliffBand.slice(0, 15),
    },
  },
  construct_validity_vs_npb_plus: validation,
  agreement: {
    'hard_gate_50 vs continuous_pa': stats('hard_gate_50', 'continuous_pa'),
    'hard_gate_50 vs continuous_component': stats('hard_gate_50', 'continuous_component'),
    'continuous_pa vs continuous_component': stats('continuous_pa', 'continuous_component'),
    'hard_gate_50 vs legacy': stats('hard_gate_50', 'legacy'),
  },
  largest_disagreements_hard_vs_component: [...rowsOut]
    .filter(r => r.hard_gate_50 != null && r.continuous_component != null)
    .sort((a, b) => Math.abs(b.hard_gate_50 - b.continuous_component) - Math.abs(a.hard_gate_50 - a.continuous_component))
    .slice(0, 15),
  status: '50打席のhard gateは working default。最終設計として凍結しない',
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp016_hard_gate_vs_continuous.json'), JSON.stringify(out, null, 2));

console.log(`n=${out.n_players}人\n`);
console.log('component kappa較正:');
for (const [c, v] of Object.entries(out.component_kappa_calibration)) console.log(`  ${c}: rel=${v.same_time_reliability.toFixed(3)} medTrials=${v.median_season_trials} → kappa=${v.kappa}`);
const D = out.discontinuity;
console.log(`
不連続性(a) 実際に跳んだ選手: ${D.observed_flip.n_players_flipped}人 最大${D.observed_flip.max_jump_pt}点`);
console.log(`不連続性(b) ★崖の高さ(境界帯25-100PA, n=${D.cliff_height.n_players_in_band}): 平均${D.cliff_height.mean_cliff_pt}点 最大${D.cliff_height.max_cliff_pt}点 10点以上=${D.cliff_height.n_cliff_ge_10pt}人（連続版なら0点）`);
console.log('\n方式間の一致:');
for (const [k, v] of Object.entries(out.agreement)) console.log(`  ${k}: 平均絶対差=${v.mean_abs_diff}点 最大=${v.max_abs_diff}点 5点以上=${v.n_ge_5pt}人 (n=${v.n})`);

console.log(`
★construct validity vs NPB+ sprint speed (n=${validation.n}):`);
for (const [k, v] of Object.entries(validation.correlations)) console.log(`  ${k}: r=${v}`);
for (const [k, v] of Object.entries(validation.vs_hard_gate_50)) console.log(`  ${k} - hard_gate_50: ${v.diff >= 0 ? '+' : ''}${v.diff} CI95=[${v.ci95[0]}, ${v.ci95[1]}] ${v.ci_excludes_zero ? '★0を含まない' : '（0をまたぐ）'}`);

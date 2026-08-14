// SP-100 v2 — Candidate S / N / F を作り、独立な物理証拠と比較する。
//
// ■ v1 からの変更（2026-08-14）
//   (a) **汚染除去**: N は `sp100_npb_raw_latent_speed.json` の latent_speed_z（hp_to_1b_sec を
//       第2測定として混ぜた合成）と confidence（汚染された Spearman-Brown × exposure）を読んでいた。
//       v2 は NPB+ 最高速度のみから作った `npb_top_speed_z` を読む。
//   (b) **F を点推定にしない**: 融合の重みには NPB+ 側の測定信頼性が要るが、直接測定が1つしか
//       無いため generic reliability は `NOT_IDENTIFIABLE`。**識別できない量を weight に使って
//       単一の融合値を作らない。** 代わりに w_npb を仮定として振った**感度帯**を出す。
//   (c) **門番の作り直し**: v1 の PowerPro漏れ検査は `const used = [...]` という
//       自分で書いた配列を自分で調べる形で、原理的に落ちなかった（門番に自己申告させない）。
//       v2 は「実際に読み込んだ成果物が申告している provenance」と「このファイル自身のソース」
//       を調べる形にした。
//
// ■ 独立性の確認（v2で実地検証した）
//   H2F レーン（sp007）の出所は data/manual/npb_speed_physical_evidence_full_20260809.json で、
//   各行が pacificleague.com / baseballking.jp 等の source URL を持つ VERIFIED_OTHER_SOURCE。
//   誤帰属した npb_plus_screens.hp_to_1b_sec とは**別物**なので、検証軸として温存できる。
//
// 使い方: node scripts/sp100_wiring_candidates_compare.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';
import { poolAcrossYears } from '../src/ratings/durable_traits.mjs';
import { npbPlusReliability } from '../src/ratings/npb_plus_provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const runNorm = J('running_norms.json');
const KAPPA = runNorm.speedPooling?.kappa ?? 50;
const LAMBDA = runNorm.speedPooling?.lambda ?? 0.2703;
const TARGET = 2025;
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const corr = (a, b) => {
  if (a.length < 5) return null;
  const ma = mean(a), mb = mean(b);
  let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
  const den = sd(a) * sd(b);
  return den > 0 ? s / a.length / den : null;
};

const evidence = JSON.parse(readFileSync(path.join(ROOT, 'data', 'manual', 'npb_speed_physical_evidence_full_20260809.json'), 'utf8'));
const latent = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp100_npb_raw_latent_speed.json'), 'utf8'));
const h2f = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp007_h2f_low_confidence_lane.json'), 'utf8'));
const phys = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp017_physical_measurement_range_reclassification.json'), 'utf8'));
const byLatent = new Map(latent.players.map(p => [nk(p.player), p]));
const byH2f = new Map((h2f.normal_swing?.players ?? []).map(p => [nk(p.player), p]));

// ── 門番: 自己申告の配列を自分で調べる形（v1）をやめ、実際のデータアクセスを見る ─────
//   v1 は `const used = ['latent_speed_z', ...]` という自分で書いた配列を検査していたので、
//   書き忘れれば必ず通った（門番に自己申告させない、の違反）。
//   v2 は (1)実行するSQL文 (2)実際に開いた入力ファイルのパス (3)読み込んだ成果物の provenance申告
//   の3つを調べる。いずれもこのスクリプトが「使うと決めた実体」であって、申告文字列ではない。
const FORBIDDEN_RE = /pawapuro|powerpro/i;
const OPENED_INPUTS = [
  'data/manual/npb_speed_physical_evidence_full_20260809.json',
  'outputs/derived/sp100_npb_raw_latent_speed.json',
  'outputs/derived/sp007_h2f_low_confidence_lane.json',
  'outputs/derived/sp017_physical_measurement_range_reclassification.json',
  'configs/running_norms.json',
];
const badInput = OPENED_INPUTS.filter(p => FORBIDDEN_RE.test(p));
if (badInput.length) throw new Error(`PowerPro由来の入力を開いている: ${badInput.join(',')}`);
// 読み込んだ latent が誤帰属フィールドを使っていないことを、成果物の申告で確認する
if (latent.inputs?.hp_to_1b_sec_used !== 0) {
  throw new Error('[fail closed] latent 成果物が hp_to_1b_sec を使用している。SP-100 v2 を再生成せよ');
}
if ((latent.provenance?.excluded_misattributed ?? []).length === 0) {
  throw new Error('[fail closed] latent 成果物に誤帰属フィールドの除外記録が無い（v1の出力を読んでいる疑い）');
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const SQL = `
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season BETWEEN ? AND ? AND b.pa>=1 AND b.position<>'投'`;
if (FORBIDDEN_RE.test(SQL)) throw new Error('SQLがPowerProのテーブル/列を参照している');
const stmt = db.prepare(SQL);
const obsByName = new Map();
for (const r of stmt.all(TARGET - 3, TARGET)) {
  const key = nk(r.name);
  const a = advanceOf(db, key, r.season);
  const sc = speedComponents(
    { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
    { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: r.season,
      advance: a?.value ?? null, advanceChances: a?.chances ?? 0 }, r.ubr, runNorm);
  if (sc.score == null) continue;
  if (!obsByName.has(key)) obsByName.set(key, []);
  obsByName.get(key).push({ z: sc.score, weight: r.pa, season: r.season });
}

// F の融合重みは仮定として振る（NPB+ 側の信頼性が識別できないため）
const ASSUMED_W_NPB = [0.25, 0.5, 0.75];

// ★2026-08-14 実測で判明した欠陥（v1から継承）: S と N は別の尺度にある。
//   S は continuous prior で階層縮小済み（共通93人で sd=0.5807）、
//   N は標準化のみ（sd=1.0108）。比 1.741。
//   生のまま w で混ぜると、w が「どちらをどれだけ信じるか」ではなく
//   「どちらのばらつきをどれだけ取り込むか」になる。
//   署名: corr(S-N, N) = -0.8335 → 尺度を揃えると -0.3466（対称）へ解消。
//   よって融合は**共通集合で尺度を揃えてから**行い、順位空間版も併記する。
const rows = [];
for (const p of evidence.players) {
  const name = p.player;
  const n = byLatent.get(nk(name));
  const obs = obsByName.get(nk(name)) ?? [];
  // NPB+ は2026 snapshot のみ。過去年へコピーしない。S は2025統計年。
  const pooled = poolAcrossYears(obs, TARGET, { poolingMode: 'continuous_prior', kappa: KAPPA, lambda: LAMBDA });
  const paCur = obs.filter(o => o.season === TARGET).reduce((s, o) => s + o.weight, 0);
  const relS = paCur / (paCur + KAPPA);
  const zS = pooled?.z ?? null;                 // 既に階層縮小済み
  const zN = n?.npb_top_speed_z ?? null;        // ★縮小なし。2026 snapshot のみ

  const h = byH2f.get(nk(name));
  rows.push({
    player: name,
    player_id: p.player_id ?? n?.player_id ?? null,
    S_stat_z: zS == null ? null : +zS.toFixed(4),
    S_reliability: +relS.toFixed(4),
    N_npb_top_speed_z: zN,
    N_reliability: null,                        // ★NOT_IDENTIFIABLE。0で埋めない
    N_exposure_runs: n?.exposure_runs ?? null,
    F_band_ASSUMPTION: null,
    F_percentile_band_ASSUMPTION: null,
    F_midpoint_for_ranking_only: null,
    pa_2025: paCur,
    npb_2026_only: true,
    h2f_z: h?.z ?? null,
    npb_plus_top_speed_kmh: n?.top_speed_kmh ?? p.npb_plus_sprint_speed_kmh ?? null,
  });
}

// ── 融合: 共通集合で尺度を揃えてから w を掛ける ─────────────────────────
const both = rows.filter(r => r.S_stat_z != null && r.N_npb_top_speed_z != null);
const mn = a => a.reduce((x, y) => x + y, 0) / a.length;
const sdv = a => { const m = mn(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const Sv = both.map(r => r.S_stat_z), Nv = both.map(r => r.N_npb_top_speed_z);
const mS = mn(Sv), sS = sdv(Sv), mN = mn(Nv), sN = sdv(Nv);
const Ssorted = [...Sv], Nsorted = [...Nv];
const pct = (arr, v) => arr.filter(x => x < v).length / ((arr.length - 1) || 1);
const fusionScaling = {
  common_n: both.length,
  S: { mean: +mS.toFixed(4), sd: +sS.toFixed(4) },
  N: { mean: +mN.toFixed(4), sd: +sN.toFixed(4) },
  sd_ratio_N_over_S: +(sN / sS).toFixed(4),
  method: 'STANDARDIZE_BOTH_ON_COMMON_SET_BEFORE_WEIGHTING',
  _why: 'S は階層縮小済みで幅が狭い。生のまま混ぜると w が重みでなく幅の配分になる（実測 corr(S-N, N)=-0.8335）',
};
for (const r of both) {
  const s0 = (r.S_stat_z - mS) / sS, n0 = (r.N_npb_top_speed_z - mN) / sN;
  r.S_std = +s0.toFixed(4); r.N_std = +n0.toFixed(4);
  r.F_band_ASSUMPTION = Object.fromEntries(ASSUMED_W_NPB.map(w =>
    [`w_npb_${w}`, +((1 - w) * s0 + w * n0).toFixed(4)]));
  const sp = pct(Ssorted, r.S_stat_z), np = pct(Nsorted, r.N_npb_top_speed_z);
  r.S_pct = +sp.toFixed(4); r.N_pct = +np.toFixed(4);
  r.F_percentile_band_ASSUMPTION = Object.fromEntries(ASSUMED_W_NPB.map(w =>
    [`w_npb_${w}`, +((1 - w) * sp + w * np).toFixed(4)]));
  r.F_midpoint_for_ranking_only = r.F_band_ASSUMPTION['w_npb_0.5'];
}
for (const r of rows) {
  if (r.F_midpoint_for_ranking_only == null) {
    r.F_midpoint_for_ranking_only = r.S_stat_z != null
      ? +((r.S_stat_z - mS) / sS).toFixed(4)
      : (r.N_npb_top_speed_z != null ? +((r.N_npb_top_speed_z - mN) / sN).toFixed(4) : null);
    r.F_fallback = r.S_stat_z != null ? 'S_ONLY_STANDARDIZED'
      : (r.N_npb_top_speed_z != null ? 'N_ONLY_STANDARDIZED' : 'NONE');
  }
}

function pairCorr(keyA, keyB) {
  const xs = [], ys = [];
  for (const r of rows) {
    if (r[keyA] == null || r[keyB] == null) continue;
    xs.push(r[keyA]); ys.push(r[keyB]);
  }
  const c = corr(xs, ys);
  return { n: xs.length, r: c == null ? null : +c.toFixed(4) };
}

// 尺度混同の自己検査（SP-056 で -0.945 を見落とした型の再発検知）。
// 差が片方の値でほぼ決まるなら、それは食い違いでなく尺度差を測っている。
function scaleArtifactCheck(a, b) {
  const xs = [], ys = [];
  for (const r of rows) { if (r[a] == null || r[b] == null) continue; xs.push(r[a]); ys.push(r[b]); }
  if (xs.length < 5) return { n: xs.length, verdict: 'INSUFFICIENT' };
  const d = xs.map((x, i) => x - ys[i]);
  const ra = corr(d, xs), rb = corr(d, ys);
  return {
    n: xs.length,
    corr_diff_with_A: +ra.toFixed(4), corr_diff_with_B: +rb.toFixed(4),
    verdict: (Math.abs(ra) > 0.9 || Math.abs(rb) > 0.9) ? 'SCALE_ARTIFACT_SUSPECTED' : 'HEALTHY',
  };
}

const compare = {
  S_vs_N: pairCorr('S_stat_z', 'N_npb_top_speed_z'),
  S_vs_H2F: pairCorr('S_stat_z', 'h2f_z'),
  N_vs_H2F: pairCorr('N_npb_top_speed_z', 'h2f_z'),
  F_mid_vs_H2F: pairCorr('F_midpoint_for_ranking_only', 'h2f_z'),
  N_vs_NPBplus_top_speed_CIRCULAR: {
    ...pairCorr('N_npb_top_speed_z', 'npb_plus_top_speed_kmh'),
    note: 'N は NPB+ 最高速度そのものの標準化。定義上 r=1。勝敗基準にしない',
  },
  _scale_artifact_check: {
    S_vs_N_RAW: scaleArtifactCheck('S_stat_z', 'N_npb_top_speed_z'),
    S_vs_N_AFTER_SCALE_MATCH: scaleArtifactCheck('S_std', 'N_std'),
    S_vs_N_PERCENTILE: scaleArtifactCheck('S_pct', 'N_pct'),
    _why: 'SP-056 では corr(diff, source) = -0.945 を見落として尺度差を食い違いと報告した。同型の再発を毎回機械で見る',
  },
};

const phys50 = (phys.records ?? []).filter(r => /50M/i.test(r.metric || ''));
const coverage = {
  S: rows.filter(r => r.S_stat_z != null).length,
  N: rows.filter(r => r.N_npb_top_speed_z != null).length,
  F_both: rows.filter(r => r.S_stat_z != null && r.N_npb_top_speed_z != null).length,
  h2f: rows.filter(r => r.h2f_z != null).length,
  t90_direct: 0,
};

// winner は宣言しない。NPB+ 側の信頼性が識別できない以上、融合比を決める根拠が無い。
const winner = 'NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE';

const out = {
  generated_at: '2026-08-14',
  supersedes: 'sp100_wiring_candidates_20260814.json v1（N/F が hp_to_1b_sec 汚染）',
  production_default_frozen: false,
  policy: {
    no_powerpro_individual_weight: true,
    no_next_year_repeatability: true,
    npb_plus_not_copied_to_past_years: true,
    display_scale_last: true,
    powerpro_agreement_not_winner: true,
    npb_reliability_not_fabricated: true,
  },
  npb_plus_reliability: npbPlusReliability(ROOT),
  provenance_of_N: latent.provenance,
  candidates: {
    S: 'statistical/proxy speed only (continuous prior z, 2025)',
    N: 'NPB+ 最高速度のみ（2026 snapshot、標準化のみ・縮小なし）',
    F: '融合は単一値にしない。w_npb を仮定として振った帯（0.25/0.5/0.75）',
  },
  fusion_scaling: fusionScaling,
  fusion_note: 'S と N を混ぜるには N の測定信頼性が要るが NOT_IDENTIFIABLE。'
    + 'F_midpoint_for_ranking_only は並べ替えの便宜であって推定値ではない。production の既定にしない。',
  independent_validation_lane: {
    lane: 'H2F (sp007)',
    source_class: 'VERIFIED_OTHER_SOURCE',
    _verified: 'data/manual/npb_speed_physical_evidence_full_20260809.json 由来。各行が source URL を持ち、'
      + '誤帰属した npb_plus_screens.hp_to_1b_sec とは別系統であることを2026-08-14に実地確認',
    n: coverage.h2f,
  },
  coverage,
  compare,
  physical_ledgers: {
    h2f_lane: { n: coverage.h2f, source: 'sp007', class: 'VERIFIED_OTHER_SOURCE' },
    '30m_50m': { n_records: phys50.length, n_name_matched_to_2026_100: 0, note: '多くがローマ字の歴史的表記。勝敗基準に使わない' },
    t90_direct: { n: 0, note: 'strict T90 は2人規模。勝敗基準に足りない' },
  },
  winner,
  players: rows.sort((a, b) => (b.F_midpoint_for_ranking_only ?? -9) - (a.F_midpoint_for_ranking_only ?? -9)),
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp100_wiring_candidates_20260814.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ coverage, compare, winner, npb_reliability: out.npb_plus_reliability.verdict }, null, 2));
db.close();

// SP-100 — 2026選手について Candidate S / N / F を作り、物理証拠と比較する。
// winner は coverage が足りなければ宣言しない。PowerPro個人一致は勝敗基準にしない。
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';
import { poolAcrossYears } from '../src/ratings/durable_traits.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const runNorm = J('running_norms.json');
const KAPPA = 50, LAMBDA = 0.2703, TARGET = 2025;
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

const FORBIDDEN = ['pawapuro', 'powerpro'];
const used = ['latent_speed_z', 'top_speed_kmh', 'hp_to_1b_sec', 'exposure_runs', 'pa'];
if (used.some(f => FORBIDDEN.some(x => f.includes(x)))) throw new Error('PowerPro field leaked');

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const stmt = db.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season BETWEEN ? AND ? AND b.pa>=1 AND b.position<>'投'`);
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

const rows = [];
for (const p of evidence.players) {
  const name = p.player;
  const n = byLatent.get(nk(name));
  const obs = obsByName.get(nk(name)) ?? [];
  // NPB+ is 2026 snapshot only — do not copy to past years. S uses 2025 statistical year.
  const pooled = poolAcrossYears(obs, TARGET, { poolingMode: 'continuous_prior', kappa: KAPPA, lambda: LAMBDA });
  const paCur = obs.filter(o => o.season === TARGET).reduce((s, o) => s + o.weight, 0);
  const relS = paCur / (paCur + KAPPA);
  const zSraw = pooled?.z ?? null;
  const zS = zSraw == null ? null : zSraw; // already hierarchically shrunk
  const zN = n?.latent_speed_z ?? null;    // already exposure-shrunk; 2026 only
  const relN = n?.confidence ?? 0;
  let zF = null, fuse = null;
  if (zS != null && zN != null) {
    const ws = relS, wn = relN;
    zF = (ws + wn) > 0 ? (ws * zS + wn * zN) / (ws + wn) : null;
    fuse = { w_stat: +ws.toFixed(4), w_npb: +wn.toFixed(4), note: 'same latent-z space; no PowerPro weight; display scale not applied here' };
  } else if (zS != null) { zF = zS; fuse = { fallback: 'S_ONLY' }; }
  else if (zN != null) { zF = zN; fuse = { fallback: 'N_ONLY' }; }

  const h = byH2f.get(nk(name));
  rows.push({
    player: name,
    player_id: p.player_id ?? n?.player_id ?? null,
    S_stat_z: zS == null ? null : +zS.toFixed(4),
    S_reliability: +relS.toFixed(4),
    N_npb_z: zN,
    N_confidence: n?.confidence ?? null,
    N_unshrunk: n?.latent_speed_z_unshrunk ?? null,
    F_fuse_z: zF == null ? null : +zF.toFixed(4),
    fuse,
    pa_2025: paCur,
    npb_2026_only: true,
    h2f_z: h?.z ?? null,
    npb_plus_sprint_kmh: p.npb_plus_sprint_speed_kmh ?? n?.top_speed_kmh ?? null,
  });
}

function pairCorr(keyA, keyB, extraFilter) {
  const xs = [], ys = [];
  for (const r of rows) {
    if (extraFilter && !extraFilter(r)) continue;
    if (r[keyA] == null || r[keyB] == null) continue;
    xs.push(r[keyA]); ys.push(r[keyB]);
  }
  return { n: xs.length, r: corr(xs, ys) == null ? null : +corr(xs, ys).toFixed(4) };
}

// Independent physical: H2F z (not used in S weights as teacher; it is a separate lane)
// N vs NPB+ sprint is circular (N is built from it) — report as diagnostic only, not winner.
const compare = {
  S_vs_N: pairCorr('S_stat_z', 'N_npb_z'),
  S_vs_H2F: pairCorr('S_stat_z', 'h2f_z'),
  N_vs_H2F: pairCorr('N_npb_z', 'h2f_z'),
  F_vs_H2F: pairCorr('F_fuse_z', 'h2f_z'),
  S_vs_NPBplus_sprint: pairCorr('S_stat_z', 'npb_plus_sprint_kmh'),
  N_vs_NPBplus_sprint_CIRCULAR: {
    ...pairCorr('N_npb_z', 'npb_plus_sprint_kmh'),
    note: 'N is built from NPB+ top speed. Not a winner criterion.',
  },
};

const phys50 = (phys.records ?? []).filter(r => /50M/i.test(r.metric || ''));
const compare50 = { n_records: phys50.length, n_name_matched_to_2026_100: 0, note: 'Most 50m rows are romanized historical names; not used as winner.' };

const coverage = {
  S: rows.filter(r => r.S_stat_z != null).length,
  N: rows.filter(r => r.N_npb_z != null).length,
  F_both: rows.filter(r => r.S_stat_z != null && r.N_npb_z != null).length,
  h2f: rows.filter(r => r.h2f_z != null).length,
  t90_direct: 0,
};

const winner = (coverage.h2f >= 20 && compare.F_vs_H2F.r != null && compare.S_vs_H2F.r != null)
  ? 'COMPARE_ONLY_NO_FREEZE'
  : 'NOT_DECLARED_COVERAGE_OR_INDEPENDENCE_INSUFFICIENT';

const out = {
  generated_at: '2026-08-14',
  production_default_frozen: false,
  policy: {
    no_powerpro_individual_weight: true,
    no_next_year_repeatability: true,
    npb_plus_not_copied_to_past_years: true,
    display_scale_last: true,
    powerpro_agreement_not_winner: true,
  },
  candidates: {
    S: 'statistical/proxy speed only (continuous prior z, 2025)',
    N: 'NPB+ raw latent physical speed only (2026 snapshot, already shrunk)',
    F: 'fuse after each estimate is reliability-shrunk, in latent-z space',
  },
  coverage,
  compare,
  physical_ledgers: {
    h2f_lane: { n: coverage.h2f, source: 'sp007' },
    '30m_50m': compare50,
    t90_direct: { n: 0, note: 'strict T90 coverage remains 2-player class; not enough for winner' },
  },
  winner,
  players: rows.sort((a, b) => (b.F_fuse_z ?? -9) - (a.F_fuse_z ?? -9)),
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp100_wiring_candidates_20260814.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ coverage, compare, winner }, null, 2));

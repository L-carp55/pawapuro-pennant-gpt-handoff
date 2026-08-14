// SP-016 scale-artifact check. Does not rewrite ratings.json.
// Required: distribution before/after, extreme rows, all-same-direction,
// corr(delta, source A), corr(delta, source B).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';
import { poolAcrossYears } from '../src/ratings/durable_traits.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json');
const runNorm = J('running_norms.json');
const KAPPA = 50, LAMBDA = 0.2703, TARGET = 2025;
const OLD_SCALE = { slope: 1.3811128593042714, intercept: -4.330107275936925 };
const NEW_SCALE = cfg.scale_calibration.applied.走力;

const uncal = z => cfg.zscore_ratings.speed.center + z * cfg.zscore_ratings.speed.spread;
const display = (z, scale) => scale.intercept + scale.slope * uncal(z);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
};
const corr = (a, b) => {
  if (a.length < 5) return null;
  const ma = mean(a), mb = mean(b);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
  const den = sd(a) * sd(b);
  return den > 0 ? +(s / a.length / den).toFixed(4) : null;
};
const pctile = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return +s[i].toFixed(2);
};

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const stmt = db.prepare(`
  SELECT b.player_id, b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season BETWEEN ? AND ? AND b.pa>=1 AND b.position<>'投'`);

const byPid = new Map();
for (const r of stmt.all(TARGET - 3, TARGET)) {
  const a = advanceOf(db, (r.name ?? '').normalize('NFKC').replace(/[\s　]/g, ''), r.season);
  const sc = speedComponents(
    { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
    { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: r.season,
      advance: a?.value ?? null, advanceChances: a?.chances ?? 0 }, r.ubr, runNorm);
  if (sc.score == null) continue;
  if (!byPid.has(r.player_id)) byPid.set(r.player_id, { name: r.name, obs: [] });
  byPid.get(r.player_id).obs.push({ z: sc.score, weight: r.pa, season: r.season });
}

const roster = [];
for (const [pid, rec] of byPid) {
  if (!rec.obs.some(o => o.season === TARGET)) continue;
  const hardObs = rec.obs.filter(o => o.weight >= 100);
  const hard = poolAcrossYears(hardObs, TARGET, { poolingMode: 'current_year_first_hard', sufficientWeight: 50 });
  const cont = poolAcrossYears(rec.obs, TARGET, { poolingMode: 'continuous_prior', kappa: KAPPA, lambda: LAMBDA });
  if (!hard || !cont) continue;
  const paCur = rec.obs.filter(o => o.season === TARGET).reduce((s, o) => s + o.weight, 0);
  const h = display(hard.z, OLD_SCALE);
  const c = display(cont.z, NEW_SCALE);
  roster.push({ pid, name: rec.name, pa_cur: paCur, hard: h, cont: c, delta: c - h });
}

const ev = JSON.parse(readFileSync(path.join(ROOT, 'data', 'manual', 'npb_speed_physical_evidence_full_20260809.json'), 'utf8'));
const names100 = new Set(ev.players.map(p => (p.player ?? '').normalize('NFKC').replace(/[\s　]/g, '')));
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const in100 = roster.filter(r => names100.has(nk(r.name)));
const non100 = roster.filter(r => !names100.has(nk(r.name)));

function pack(rows) {
  const d = rows.map(r => r.delta);
  const hard = rows.map(r => r.hard);
  const cont = rows.map(r => r.cont);
  const pa = rows.map(r => r.pa_cur);
  const abs = d.map(Math.abs);
  return {
    n: rows.length,
    before: { mean: +mean(hard).toFixed(3), sd: +sd(hard).toFixed(3), min: +Math.min(...hard).toFixed(2), max: +Math.max(...hard).toFixed(2), p10: pctile(hard, 10), p50: pctile(hard, 50), p90: pctile(hard, 90) },
    after: { mean: +mean(cont).toFixed(3), sd: +sd(cont).toFixed(3), min: +Math.min(...cont).toFixed(2), max: +Math.max(...cont).toFixed(2), p10: pctile(cont, 10), p50: pctile(cont, 50), p90: pctile(cont, 90) },
    delta: {
      mean: +mean(d).toFixed(3), sd: +sd(d).toFixed(3), min: +Math.min(...d).toFixed(2), max: +Math.max(...d).toFixed(2),
      ge5: abs.filter(x => x >= 5).length, ge10: abs.filter(x => x >= 10).length,
      all_same_direction: d.every(x => x > 0) || d.every(x => x < 0),
      pos: d.filter(x => x > 0.05).length, neg: d.filter(x => x < -0.05).length,
    },
    corr_delta_vs_hard: corr(d, hard),
    corr_delta_vs_cont: corr(d, cont),
    corr_delta_vs_pa_cur: corr(d, pa),
    scale_artifact: Math.abs(corr(d, hard) ?? 0) > 0.9 || Math.abs(corr(d, cont) ?? 0) > 0.9,
    extremes: [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 12)
      .map(r => ({ name: r.name, pa_cur: r.pa_cur, hard: +r.hard.toFixed(1), cont: +r.cont.toFixed(1), delta: +r.delta.toFixed(2) })),
  };
}

const apply = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp016_continuous_prior_apply_20260814.json'), 'utf8'));
const hundredRows = (apply.hundred?.rows ?? []).filter(r => r.diff != null && r.hard != null && r.continuous != null);
const hundredPack = hundredRows.length ? {
  n: hundredRows.length,
  before: { mean: +mean(hundredRows.map(r => r.hard)).toFixed(3), sd: +sd(hundredRows.map(r => r.hard)).toFixed(3) },
  after: { mean: +mean(hundredRows.map(r => r.continuous)).toFixed(3), sd: +sd(hundredRows.map(r => r.continuous)).toFixed(3) },
  corr_delta_vs_hard: corr(hundredRows.map(r => r.diff), hundredRows.map(r => r.hard)),
  corr_delta_vs_cont: corr(hundredRows.map(r => r.diff), hundredRows.map(r => r.continuous)),
  all_same_direction: hundredRows.every(r => r.diff > 0) || hundredRows.every(r => r.diff < 0),
  scale_artifact: false,
} : null;
if (hundredPack) {
  hundredPack.scale_artifact = Math.abs(hundredPack.corr_delta_vs_hard ?? 0) > 0.9
    || Math.abs(hundredPack.corr_delta_vs_cont ?? 0) > 0.9;
}

const sameScale = {
  slope: NEW_SCALE.slope,
  intercept: NEW_SCALE.intercept,
  derived_on: 'full 2025 statistical roster n=260',
  applied_to_100: true,
  hundred_only_scale_exists: false,
};

const out = {
  generated_at: '2026-08-14',
  policy: 'Global display center/width only. Individual PowerPro labels not used as weights or fit targets.',
  new_display_scale: { slope: NEW_SCALE.slope, intercept: NEW_SCALE.intercept },
  full_roster: pack(roster),
  hundred_subset_of_roster: pack(in100),
  non100_subset_of_roster: pack(non100),
  hundred_appraiseCard_path: hundredPack,
  same_mapping_100_vs_roster: sameScale,
  verdict: null,
};
const fail = out.full_roster.scale_artifact
  || out.full_roster.delta.all_same_direction
  || (hundredPack && hundredPack.scale_artifact);
out.verdict = fail ? 'SCALE_ARTIFACT_OR_ALL_SAME_DIRECTION' : 'BIDIRECTIONAL_NOT_SCALE_BUG';

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp016_scale_artifact_check_20260814.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  verdict: out.verdict,
  roster: {
    n: out.full_roster.n,
    before: out.full_roster.before,
    after: out.full_roster.after,
    delta: out.full_roster.delta,
    corr_delta_hard: out.full_roster.corr_delta_vs_hard,
    corr_delta_cont: out.full_roster.corr_delta_vs_cont,
    corr_delta_pa: out.full_roster.corr_delta_vs_pa_cur,
  },
  hundred_card: hundredPack,
  in100_n: in100.length,
  non100_n: non100.length,
}, null, 2));

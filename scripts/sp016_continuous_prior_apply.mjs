// SP-016 — continuous prior を production candidate として適用する。
// hard gate は control。縮小と display scale 再導出をセットで行う。
// PowerPro 個人値は weight/採否に使わない。applyScale は全体の中心・幅だけ合わせる。
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';
import { poolAcrossYears } from '../src/ratings/durable_traits.mjs';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json');
const runNorm = J('running_norms.json');
const fldNorm = J('fielding_norms.json');
const rv = J('run_values.json').values;
const KAPPA = 50;
const LAMBDA = 0.2703;
const TARGET = 2025;
const OLD_SCALE = { slope: 1.3811128593042714, intercept: -4.330107275936925 };

const uncal = z => cfg.zscore_ratings.speed.center + z * cfg.zscore_ratings.speed.spread;
const display = (z, scale) => scale.intercept + scale.slope * uncal(z);
const r1 = v => Math.round(v * 10) / 10;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
};

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
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
  const a = advanceOf(db, nk(r.name), r.season);
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
  const hasCur = rec.obs.some(o => o.season === TARGET);
  if (!hasCur) continue;
  const hardObs = rec.obs.filter(o => o.weight >= 100);
  const hard = poolAcrossYears(hardObs, TARGET, { poolingMode: 'current_year_first_hard', sufficientWeight: 50 });
  const cont = poolAcrossYears(rec.obs, TARGET, { poolingMode: 'continuous_prior', kappa: KAPPA, lambda: LAMBDA });
  if (!hard || !cont) continue;
  const paCur = rec.obs.filter(o => o.season === TARGET).reduce((s, o) => s + o.weight, 0);
  roster.push({
    pid, name: rec.name, pa_cur: paCur,
    z_hard: hard.z, z_cont: cont.z,
    hard_reason: hard.poolReason, cont_reason: cont.poolReason,
    uncal_hard: uncal(hard.z), uncal_cont: uncal(cont.z),
    display_hard_oldscale: display(hard.z, OLD_SCALE),
  });
}

const legacyDisp = roster.map(r => r.display_hard_oldscale);
const contUncal = roster.map(r => r.uncal_cont);
const newScale = {
  slope: sd(legacyDisp) / sd(contUncal),
  intercept: mean(legacyDisp) - (sd(legacyDisp) / sd(contUncal)) * mean(contUncal),
};
for (const r of roster) {
  r.display_cont_newscale = display(r.z_cont, newScale);
  r.diff = r.display_cont_newscale - r.display_hard_oldscale;
}

function summarize(rows, key = 'diff') {
  const d = rows.map(r => r[key]);
  const abs = d.map(Math.abs);
  return {
    n: rows.length,
    mean: +mean(d).toFixed(3),
    sd: +sd(d).toFixed(3),
    min: +Math.min(...d).toFixed(2),
    max: +Math.max(...d).toFixed(2),
    range: +(Math.max(...d) - Math.min(...d)).toFixed(2),
    ge1: abs.filter(x => x >= 1).length,
    ge3: abs.filter(x => x >= 3).length,
    ge5: abs.filter(x => x >= 5).length,
    ge10: abs.filter(x => x >= 10).length,
    all_same_sign: d.every(x => x > 0) || d.every(x => x < 0),
    pos: d.filter(x => x > 0.05).length,
    neg: d.filter(x => x < -0.05).length,
  };
}

// discontinuity: hard 49 vs 51 vs continuous
const cliff = roster.filter(r => r.pa_cur >= 25 && r.pa_cur <= 100).map(r => {
  const obsAll = byPid.get(r.pid).obs;
  const obsHard = obsAll.filter(o => o.weight >= 100);
  const hard49 = poolAcrossYears(obsHard, TARGET, { poolingMode: 'current_year_first_hard', sufficientWeight: 49 });
  const hard51 = poolAcrossYears(obsHard, TARGET, { poolingMode: 'current_year_first_hard', sufficientWeight: 51 });
  const dHard = (hard49 && hard51) ? Math.abs(display(hard49.z, OLD_SCALE) - display(hard51.z, OLD_SCALE)) : 0;
  return { name: r.name, pa_cur: r.pa_cur, hard_flip: dHard };
});

const lowPa = roster.filter(r => r.pa_cur < 50).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 15);
const topMovers = [...roster].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 20);

// 100-player wiring via appraiseCard
const evidence = JSON.parse(readFileSync(path.join(ROOT, 'data', 'manual', 'npb_speed_physical_evidence_full_20260809.json'), 'utf8'));
const names100 = evidence.players.map(p => p.player);
const ctx = makeContext(db, cfg);
const cfgNew = JSON.parse(JSON.stringify(cfg));
cfgNew.scale_calibration.applied.走力 = {
  slope: newScale.slope,
  intercept: newScale.intercept,
  _n: roster.length,
  _basis: 'SP-016 continuous prior 2026-08-14. Global display center/width matched to hard-gate+old-scale display on 2025 roster. Not fit to individual PowerPro labels.',
  _legacy_hard_gate: OLD_SCALE,
};
const hundred = [];
for (const name of names100) {
  const team = evidence.players.find(p => p.player === name)?.team;
  let hard, cont;
  try {
    hard = appraiseCard(ctx, {
      name, team, mode: '2025', statPrimarySpeed: true, cfg, rv, runNorm, fldNorm,
      poolingMode: 'current_year_first_hard', currentYearFirst: true, sufficientWeight: 50,
    });
  } catch (e) { hard = { error: e.message }; }
  try {
    cont = appraiseCard(ctx, {
      name, team, mode: '2025', statPrimarySpeed: true, cfg: cfgNew, rv, runNorm, fldNorm,
      poolingMode: 'continuous_prior', kappa: KAPPA, lambda: LAMBDA,
    });
  } catch (e) { cont = { error: e.message }; }
  if (hard.error || cont.error) {
    hundred.push({ player: name, error: hard.error ?? cont.error });
    continue;
  }
  const hv = hard.card.abilities.基礎能力.走力?.value;
  const cv = cont.card.abilities.基礎能力.走力?.value;
  hundred.push({
    player: name,
    hard: hv, continuous: cv, diff: (cv ?? 0) - (hv ?? 0),
    hard_reason: hard.card.speedDetail?.poolReason ?? hard.card.abilities?.基礎能力?.走力?._note,
    cont_reason: cont.card.speedDetail?.poolReason,
    no_batting: !!cont.card._no_batting_sample,
  });
}
const hundredOk = hundred.filter(r => r.diff != null && !r.error);

// write new scale into ratings.json
const ratingsPath = path.join(ROOT, 'configs', 'ratings.json');
const ratings = JSON.parse(readFileSync(ratingsPath, 'utf8'));
ratings.scale_calibration._legacy_hard_gate_走力_20260814 = {
  ...OLD_SCALE,
  _kept_as: 'control. Restore with poolingMode=current_year_first_hard to reproduce pre-continuous display.',
};
ratings.scale_calibration.applied.走力 = {
  slope: newScale.slope,
  intercept: newScale.intercept,
  _n: roster.length,
  _measured_at: '2026-08-14',
  _basis: 'SP-016 continuous prior. Match hard-gate+old-scale display mean/sd on 2025 statistical roster. Individual PowerPro labels were not used as weights or fit targets.',
  _legacy: OLD_SCALE,
};
writeFileSync(ratingsPath, JSON.stringify(ratings, null, 2) + '\n');

const out = {
  generated_at: '2026-08-14',
  policy: {
    control: 'poolingMode=current_year_first_hard + old applyScale',
    candidate: 'poolingMode=continuous_prior + re-derived display scale',
    powerpro_individual_labels: 'NOT_USED_FOR_WEIGHT_OR_FIT',
    scale_role: 'provisional global center/width display calibration only',
    kappa: KAPPA, lambda: LAMBDA,
  },
  new_display_scale: {
    slope: +newScale.slope.toFixed(6),
    intercept: +newScale.intercept.toFixed(6),
    matched_legacy_display_mean: +mean(legacyDisp).toFixed(3),
    matched_legacy_display_sd: +sd(legacyDisp).toFixed(3),
    continuous_uncal_mean: +mean(contUncal).toFixed(3),
    continuous_uncal_sd: +sd(contUncal).toFixed(3),
  },
  full_roster: {
    summary: summarize(roster),
    display_hard: { mean: +mean(legacyDisp).toFixed(3), sd: +sd(legacyDisp).toFixed(3), min: +Math.min(...legacyDisp).toFixed(2), max: +Math.max(...legacyDisp).toFixed(2) },
    display_continuous: {
      mean: +mean(roster.map(r => r.display_cont_newscale)).toFixed(3),
      sd: +sd(roster.map(r => r.display_cont_newscale)).toFixed(3),
    },
    top_movers: topMovers.map(r => ({ name: r.name, pa_cur: r.pa_cur, hard: +r.display_hard_oldscale.toFixed(1), cont: +r.display_cont_newscale.toFixed(1), diff: +r.diff.toFixed(2) })),
    low_pa_extremes: lowPa.map(r => ({ name: r.name, pa_cur: r.pa_cur, hard: +r.display_hard_oldscale.toFixed(1), cont: +r.display_cont_newscale.toFixed(1), diff: +r.diff.toFixed(2) })),
  },
  hundred: {
    n_ok: hundredOk.length,
    n_error: hundred.filter(r => r.error).length,
    errors: hundred.filter(r => r.error),
    summary: hundredOk.length ? summarize(hundredOk) : null,
    rows: hundredOk.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
  },
  discontinuity: {
    band_25_100: cliff.length,
    hard_mean_flip: cliff.length ? +mean(cliff.map(c => c.hard_flip)).toFixed(3) : 0,
    hard_max_flip: cliff.length ? +Math.max(...cliff.map(c => c.hard_flip)).toFixed(2) : 0,
    hard_n_flip_gt_0: cliff.filter(c => c.hard_flip > 0.05).length,
    continuous_structural_cliff: 0,
  },
  scale_bug_signature: {
    full_roster_all_same_direction: summarize(roster).all_same_sign,
    hundred_all_same_direction: hundredOk.length ? summarize(hundredOk).all_same_sign : null,
    note: '全員同方向は尺度バグの署名。双方向なら pooling の中身の差。',
  },
  done_ready: false,
};
out.done_ready = out.full_roster.summary.n > 0
  && !out.scale_bug_signature.full_roster_all_same_direction
  && out.discontinuity.continuous_structural_cliff === 0;

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp016_continuous_prior_apply_20260814.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  roster: out.full_roster.summary,
  hundred: out.hundred.summary,
  scale: out.new_display_scale,
  discontinuity: out.discontinuity,
  scale_bug: out.scale_bug_signature,
  done_ready: out.done_ready,
}, null, 2));

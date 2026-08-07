// 直接計測・スカウティング走力と統計走力の「目盛り」不一致を監査する。
//
// 現状:
//   統計走力 run.speed は ability_sheet で scale_calibration.走力 を受けて表示される。
//   直接計測/スカウティング値はすでに最終目盛りなので scale_calibration を再適用しない。
//   しかし pipeline の blendDirect() は run.speed（較正前）と direct.value（較正後）を直接混ぜる。
//
// 使い方: node scripts/audit_speed_override_scale.mjs [year]
// 1) 何人にoverrideが効くか
// 2) 表示走力と残差計算のspeed_z_finalがどれだけ食い違うか
// 3) direct混合を同一目盛りで行った場合との差
// を測る。DBは変更しない。

import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YEAR = Number(process.argv[2] ?? 2024);
if (!Number.isInteger(YEAR)) throw new Error(`invalid year: ${process.argv[2]}`);
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const scoutingLedger = loadLedger(JSON.parse(await readFile(path.join(ROOT, 'configs', 'scouting.json'), 'utf8')));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const players = db.prepare(`
  SELECT player_id, name, pa FROM v_batting
  WHERE season=? AND position<>'投' AND pa>=100
  ORDER BY pa DESC
`).all(YEAR);

const cal = cfg.scale_calibration?.applied?.走力;
const zs = cfg.zscore_ratings.speed;
if (!cal || !zs) throw new Error('走力のscale_calibration / zscore_ratingsが無い');

const statisticalDisplay = raw => cal.intercept + cal.slope * raw;
const displayToInternalZ = display => ((display - cal.intercept) / cal.slope - zs.center) / zs.spread;
const directWeight = direct => {
  const metric = String(direct?.source ?? '').replace('NPB+アプリ ', '');
  const model = cfg.npb_plus_direct?.models?.[metric];
  const w = model?.test_r != null ? model.test_r
    : (direct?.source?.includes('Statcast') ? (cfg.direct_measurement?.speed?.r ?? 0.9) * 0.8 : 0.5);
  return Math.max(0, Math.min(1, w));
};

const rows = [];
for (const p of players) {
  const r = appraiseCard(ctx, {
    playerId: p.player_id, mode: String(YEAR), cfg, rv, runNorm, fldNorm, scoutingLedger,
  });
  if (r.error) continue;
  const c = r.card;
  const base = c.abilities?.基礎能力?.走力;
  const raw = c.ratings?.speed;
  const zStat = c.calc_log?.running?._speed_z_final ?? c.calc_log?.run_field_log?.running?._speed_z ?? null;
  if (!base || !Number.isFinite(raw) || !Number.isFinite(base.value) || !Number.isFinite(zStat)) continue;

  const ev = c.ability_evidence?.走力;
  const direct = ev?.direct_measurement ?? null;
  const scout = ev?.scouting_prior ?? null;
  const origin = base.from_scouting ? 'scouting' : base.from_direct_measurement ? 'direct' : 'statistical';
  const statDisplay = statisticalDisplay(raw);
  const zDisplay = displayToInternalZ(base.value);

  let correctedSameScale = null;
  if (origin === 'direct' && direct?.value != null) {
    const w = directWeight(direct);
    correctedSameScale = statDisplay * (1 - w) + direct.value * w;
  } else if (origin === 'scouting' && scout?.value != null) {
    correctedSameScale = scout.value;
  }

  rows.push({
    name: c.name_ja, pa: p.pa, origin,
    raw_stat: raw, stat_display: statDisplay, displayed: base.value,
    z_stat: zStat, z_display_equiv: zDisplay,
    display_minus_stat: base.value - statDisplay,
    z_gap: zDisplay - zStat,
    direct_value: direct?.value ?? null,
    direct_source: direct?.source ?? null,
    scouting_value: scout?.value ?? null,
    corrected_same_scale: correctedSameScale,
    unit_mix_error: correctedSameScale == null ? null : base.value - correctedSameScale,
  });
}

const overridden = rows.filter(r => r.origin !== 'statistical');
const directRows = rows.filter(r => r.origin === 'direct');
const scoutRows = rows.filter(r => r.origin === 'scouting');
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const abs = a => a.map(Math.abs).sort((x, y) => x - y);
const q = (a, p) => {
  const x = abs(a);
  return x.length ? x[Math.min(x.length - 1, Math.floor((x.length - 1) * p))] : null;
};
const fmt = x => x == null ? '—' : x.toFixed(3);

console.log(`# ${YEAR} 走力override 目盛り監査`);
console.log(`cards=${rows.length} overridden=${overridden.length} direct=${directRows.length} scouting=${scoutRows.length}`);
console.log(`override比率=${(100 * overridden.length / Math.max(1, rows.length)).toFixed(1)}%`);
console.log('');
console.log('表示走力 vs 残差計算zの等価走力:');
console.log(`  |z gap| mean=${fmt(mean(overridden.map(r => Math.abs(r.z_gap))))} p50=${fmt(q(overridden.map(r => r.z_gap), .5))} p90=${fmt(q(overridden.map(r => r.z_gap), .9))} max=${fmt(q(overridden.map(r => r.z_gap), 1))}`);
console.log(`  |表示−統計表示| mean=${fmt(mean(overridden.map(r => Math.abs(r.display_minus_stat))))} p90=${fmt(q(overridden.map(r => r.display_minus_stat), .9))} max=${fmt(q(overridden.map(r => r.display_minus_stat), 1))} points`);

if (directRows.length) {
  console.log('\n直接計測の単位混合誤差（現行表示 − 同じ最終目盛りで混ぜた値）:');
  const errs = directRows.map(r => r.unit_mix_error).filter(Number.isFinite);
  console.log(`  signed mean=${fmt(mean(errs))} abs mean=${fmt(mean(errs.map(Math.abs)))} p90=${fmt(q(errs, .9))} max=${fmt(q(errs, 1))} points`);
}

console.log('\n## override差が大きい選手');
for (const r of [...overridden].sort((a, b) => Math.abs(b.display_minus_stat) - Math.abs(a.display_minus_stat)).slice(0, 40)) {
  console.log(`${r.name}\t${r.origin}\tstatRaw=${r.raw_stat.toFixed(1)}\tstatDisplay=${r.stat_display.toFixed(1)}\tdisplay=${r.displayed.toFixed(1)}\tΔdisplay=${r.display_minus_stat >= 0 ? '+' : ''}${r.display_minus_stat.toFixed(1)}\tz ${r.z_stat.toFixed(3)} -> equiv ${r.z_display_equiv.toFixed(3)}\tunitMixErr=${r.unit_mix_error == null ? '—' : r.unit_mix_error.toFixed(1)}\t${r.direct_source ?? ''}`);
}

console.log('\n## directの単位混合誤差が大きい選手');
for (const r of [...directRows].sort((a, b) => Math.abs(b.unit_mix_error ?? 0) - Math.abs(a.unit_mix_error ?? 0)).slice(0, 40)) {
  console.log(`${r.name}\tstatDisplay=${r.stat_display.toFixed(1)}\tdirect=${r.direct_value?.toFixed(1) ?? '—'}\t現行=${r.displayed.toFixed(1)}\t同目盛り混合=${r.corrected_same_scale?.toFixed(1) ?? '—'}\t誤差=${r.unit_mix_error?.toFixed(1) ?? '—'}\t${r.direct_source ?? ''}`);
}

db.close();

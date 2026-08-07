// 有効な過去/同年の直接計測走力が、表示だけでなく共通z・守備残差まで一貫して届くか。
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);
const close = (a, b, eps = 0.11) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps, `${a} != ${b}`);

// 2024時点で過去Statcast Sprint Speedを持つ選手。NPB+2026ではない。
const r = appraiseCard(ctx, { name: '青木', mode: '2024', cfg, rv, runNorm, fldNorm });
assert.ok(!r.error, r.error);
const c = r.card;
const base = c.abilities.基礎能力.走力;
const ev = c.ratings.speed_evidence;
const calc = c.calc_log.running;

assert.equal(ev?.decided_by, 'direct_blend');
assert.match(ev?.external_source ?? '', /Statcast/);
assert.ok(c.ability_evidence.走力.direct_measurement, 'direct evidenceがカードに残っていない');
assert.equal(base.from_direct_measurement, true);

// ability欄・ratings表示・内部raw→scale の3つが同じ最終値を指す。
close(base.value, c.ratings.speed_display);
const cal = cfg.scale_calibration.applied.走力;
close(c.ratings.speed_display, cal.intercept + cal.slope * c.ratings.speed, 0.12);

// 共通zは表示値を逆変換したものと一致する。
const zs = cfg.zscore_ratings.speed;
const rawFromDisplay = (c.ratings.speed_display - cal.intercept) / cal.slope;
const zFromDisplay = (rawFromDisplay - zs.center) / zs.spread;
close(calc._speed_z_final, zFromDisplay, 0.002);
close(calc.speed_evidence.final_z, calc._speed_z_final, 0.002);

// 守備ログも同じzを使う。外野守備の無い場合はスキップしないため青木2024を選んでいる。
const field = c.calc_log.run_field_log?.fielding ?? [];
assert.ok(field.length > 0, '守備ログがない');
for (const f of field) close(f.speed_rating_fixed, calc._speed_z_final, 0.002);

// ability_evidenceのproxyとdirectは同じ最終目盛り。内部rawをproxyへ混ぜない。
const proxy = c.ability_evidence.走力.proxy_bundle;
assert.ok(proxy?.value != null);
close(proxy.value, ev.statistical_final_scale, 0.11);

// 未来NPB+は2024に漏れていない。
assert.ok(!String(ev.external_source).includes('NPB+'));

console.log('speed external integration: 17 checks passed');
db.close();

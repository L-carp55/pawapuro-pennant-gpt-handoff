// 2024の全100打席以上で、外部走力overrideが同一目盛り・同一zになっているか。
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { directSpeedWeight } from '../src/ratings/speed_evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);
const players = db.prepare(`SELECT player_id FROM v_batting WHERE season=2024 AND position<>'投' AND pa>=100`).all();
const cal = cfg.scale_calibration.applied.走力;
const zs = cfg.zscore_ratings.speed;

let directCount = 0;
let maxUnitError = 0;
let maxZGap = 0;
for (const p of players) {
  const r = appraiseCard(ctx, { playerId: p.player_id, mode: '2024', cfg, rv, runNorm, fldNorm });
  if (r.error) continue;
  const c = r.card;
  const base = c.abilities?.基礎能力?.走力;
  if (!base?.from_direct_measurement) continue;
  directCount++;

  const speedEv = c.ratings.speed_evidence;
  const direct = c.ability_evidence.走力.direct_measurement;
  assert.equal(speedEv.decided_by, 'direct_blend');
  assert.match(direct.source, /Statcast/, `${c.name_ja}: 2024に未来NPB+が漏れた`);
  const w = directSpeedWeight(direct, cfg);
  const expected = speedEv.statistical_final_scale * (1 - w) + direct.value * w;
  const unitErr = Math.abs(base.value - expected);
  maxUnitError = Math.max(maxUnitError, unitErr);
  assert.ok(unitErr <= 0.11, `${c.name_ja}: same-scale expected=${expected}, display=${base.value}`);

  const raw = (base.value - cal.intercept) / cal.slope;
  const zDisplay = (raw - zs.center) / zs.spread;
  const z = c.calc_log.running._speed_z_final;
  const zGap = Math.abs(zDisplay - z);
  maxZGap = Math.max(maxZGap, zGap);
  assert.ok(zGap <= 0.006, `${c.name_ja}: display z=${zDisplay}, calc z=${z}`);

  for (const f of c.calc_log.run_field_log?.fielding ?? []) {
    assert.ok(Math.abs(f.speed_rating_fixed - z) <= 0.006,
      `${c.name_ja}/${f.position}: fielding z=${f.speed_rating_fixed}, final z=${z}`);
  }
}

assert.ok(directCount > 0, '有効な過去Statcast走力が1人も見つからない');
console.log(`speed override population: direct=${directCount}, maxUnitError=${maxUnitError.toFixed(4)}, maxZGap=${maxZGap.toFixed(5)}`);
db.close();

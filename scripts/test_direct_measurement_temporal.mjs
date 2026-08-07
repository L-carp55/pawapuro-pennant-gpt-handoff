// 直接計測が査定対象年より未来の観測を使わないことを固定するテスト。DB不要。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  eligibleMeasurementObservations,
  averageMeasurementAtOrBefore,
  buildDirectMeasurements,
} from '../src/ratings/direct_measurement.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ratings = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const cfg = {
  ...ratings.direct_measurement,
  npb_plus_direct: ratings.npb_plus_direct,
  scale_calibration: ratings.scale_calibration,
};

const detail = JSON.stringify({
  sprint_speed: [
    { year: 2022, sprint_speed: 28.0 },
    { year: 2023, sprint_speed: 28.5 },
    { year: 2025, sprint_speed: 29.5 },
  ],
});
const row = {
  sprint_speed_avg: (28.0 + 28.5 + 29.5) / 3,
  sprint_years: 3,
  detail,
  top_speed_kmh: 34,
};

// 2023カードでは2022-2023だけ。
assert.deepEqual(
  eligibleMeasurementObservations(detail, 'sprint_speed', 2023).map(x => x.year),
  [2022, 2023],
);
assert.equal(averageMeasurementAtOrBefore(detail, 'sprint_speed', 'sprint_speed', 2023), 28.25);

// 2021カードには過去観測が無いのでnull。未来値へフォールバックしない。
assert.equal(averageMeasurementAtOrBefore(detail, 'sprint_speed', 'sprint_speed', 2021), null);

const d2023 = buildDirectMeasurements(row, cfg, 2023).走力;
assert.ok(d2023);
assert.equal(d2023.measured, 28.25);
assert.deepEqual(d2023.measured_years, [2022, 2023]);
assert.equal(d2023.year_gap, 0);

const d2021 = buildDirectMeasurements(row, cfg, 2021).走力;
assert.equal(d2021, null, '未来のStatcast平均へフォールバックしてはいけない');

// NPB+は2026年計測。2024/2025には使わない。
const npbOnly = { top_speed_kmh: 34 };
assert.equal(buildDirectMeasurements(npbOnly, cfg, 2024).走力, null);
assert.equal(buildDirectMeasurements(npbOnly, cfg, 2025).走力, null);
assert.ok(buildDirectMeasurements(npbOnly, cfg, 2026).走力);

// targetSeasonなしの探索用途では従来どおり全観測平均を使える。
const noTarget = buildDirectMeasurements(row, cfg, null).走力;
assert.ok(noTarget);
assert.ok(Math.abs(noTarget.measured - row.sprint_speed_avg) < 1e-9);

console.log('direct measurement temporal: 12 checks passed');

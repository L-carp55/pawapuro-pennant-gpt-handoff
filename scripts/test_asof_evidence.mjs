// 過去年カードへ本人の未来証拠が混ざらないことを固定するテスト。DB不要。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  recordEvidenceEndsBy, aggregateEvidenceAvailable, filterEvidenceYears,
} from '../src/ratings/evidence_time.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(recordEvidenceEndsBy({ seasons: [2014, 2019] }, 2020), true);
assert.equal(recordEvidenceEndsBy({ seasons: [2014, 2023] }, 2021), false);
assert.equal(recordEvidenceEndsBy({ seasons: [2024] }, 2024), true);
assert.equal(recordEvidenceEndsBy({ seasons: [] }, 2024), false);
assert.equal(recordEvidenceEndsBy(null, 2024), false);

assert.equal(aggregateEvidenceAvailable(2026, 2024), false);
assert.equal(aggregateEvidenceAvailable(2026, 2025), false);
assert.equal(aggregateEvidenceAvailable(2026, 2026), true);

const years = [{ season: 2020 }, { season: 2022 }, { season: 2024 }, { season: 2025 }];
assert.deepEqual(filterEvidenceYears(years, 2024).map(x => x.season), [2020, 2022, 2024]);
assert.deepEqual(filterEvidenceYears(years, 2024, 3).map(x => x.season), [2022, 2024]);

const pipeline = await readFile(path.join(ROOT, 'src', 'cards', 'pipeline.mjs'), 'utf8');
// 本人打撃Priorは対象年+3を使わない。
assert.ok(!pipeline.includes('targetSeason + 3'), '一軍Priorに未来年度が復活している');
assert.ok(!pipeline.includes('f.season > season + 3'), '二軍Priorに未来年度が復活している');
assert.match(pipeline, /targetSeason - 3, targetSeason\)/);
assert.match(pipeline, /f\.season > season\)/);

// 防御系の本人集約証拠は共通as-of helperを通す。
assert.match(pipeline, /recordEvidenceEndsBy/);
assert.match(pipeline, /aggregateEvidenceAvailable/);
assert.match(pipeline, /catcher_fielding/);
assert.match(pipeline, /catcher_throw_accuracy/);
assert.match(pipeline, /infield_throw_accuracy/);
assert.match(pipeline, /throwAccuracyEvidence/);

const gates = JSON.parse(await readFile(path.join(ROOT, 'configs', 'model_gates.json'), 'utf8'));
assert.equal(gates.asof_aggregate_evidence.catcher_fielding.max_evidence_season, 2026);
assert.equal(gates.asof_aggregate_evidence.catcher_throw_accuracy.max_evidence_season, 2026);
assert.equal(gates.asof_aggregate_evidence.infield_throw_accuracy.max_evidence_season, 2026);

console.log('as-of evidence: 23 checks passed');

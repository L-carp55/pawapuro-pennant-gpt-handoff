import assert from 'node:assert/strict';
import { buildSprint30Evidence, buildNpbPlusEvidence, buildMlbSprintEvidence } from '../src/ratings/speed_evidence.mjs';

const temporalCfg = {
  auto_apply_mean_drift: false,
  by_gap_years: {
    0: { r: 1, mean_change: 0, mae_change: 0, sd_change: 0 },
    1: { r: .93, mean_change: -.18, mae_change: .45, sd_change: .56 },
    2: { r: .90, mean_change: -.29, mae_change: .57, sd_change: .69 },
    4: { r: .90, mean_change: -.61, mae_change: .81, sd_change: .76 },
  },
};

const record = [{
  player: '近本光司', season: 2018, seconds_30m: 3.87,
  protocol_class: 'team_physical_test_protocol_unspecified', source_name: 'test',
}];

// Near-year: physical 30m remains available as Tier-D evidence.
const near = buildSprint30Evidence(record, '近本 光司', 2019, temporalCfg);
assert.equal(near.evidence.sprint_30m_sec, 3.87);
assert.equal(near.metadata.auto_t90_usable, true);
assert.equal(near.metadata.historical_only, false);

// Six-year gap: keep provenance/history but do NOT feed it to automatic T90.
const old = buildSprint30Evidence(record, '近本 光司', 2024, temporalCfg);
assert.deepEqual(old.evidence, {});
assert.equal(old.metadata.seconds_30m, 3.87);
assert.equal(old.metadata.auto_t90_usable, false);
assert.equal(old.metadata.historical_only, true);

// NPB+ 2026 -> 2024 remains near enough to be physical evidence, while fastest H->1 stays excluded.
const plus = buildNpbPlusEvidence({ season_label: '2026途中', top_speed_kmh: 35.0, hp_to_1b_sec: 3.46 }, 2024, temporalCfg);
assert.equal(plus.evidence.npb_plus_top_speed_kmh, 35.0);
assert.equal('hp_to_1b_fastest_sec' in plus.evidence, false);

// MLB detail also uses closest year-level observation rather than a detached multi-year average.
const detail = JSON.stringify({ sprint_speed: [
  { year: 2018, sprint_speed: 29.5, hp_to_1b: 4.00 },
  { year: 2022, sprint_speed: 28.3, hp_to_1b: 4.12 },
]});
const mlbNear = buildMlbSprintEvidence({ detail }, 2024, temporalCfg);
assert.equal(mlbNear.evidence.mlb_sprint_speed_ftps, 28.3);
assert.equal(mlbNear.metadata.measured_year, 2022);
const mlbOld = buildMlbSprintEvidence({ detail: JSON.stringify({ sprint_speed: [{ year: 2018, sprint_speed: 29.5 }] }) }, 2024, temporalCfg);
assert.deepEqual(mlbOld.evidence, {});
assert.equal(mlbOld.metadata.historical_only, true);

console.log('speed_evidence_temporal tests: PASS');

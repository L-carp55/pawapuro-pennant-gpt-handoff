// 統計・直接計測・スカウティング走力の共通目盛り統合テスト。DB不要。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  speedRawToFinalScale, speedFinalScaleToRaw, speedRawToZ,
  directSpeedWeight, reconcileSpeedEvidence,
} from '../src/ratings/speed_evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const cal = cfg.scale_calibration.applied.走力;
const zs = cfg.zscore_ratings.speed;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// forward/inverseは往復する。
for (const raw of [20, 50, 70, 90]) close(speedFinalScaleToRaw(speedRawToFinalScale(raw, cfg), cfg), raw);
close(speedRawToZ(zs.center, cfg), 0);
close(speedRawToZ(zs.center + zs.spread, cfg), 1);

const stat = {
  rating: 60,
  zFinal: (60 - zs.center) / zs.spread,
  detail: { z_final: (60 - zs.center) / zs.spread },
};
const statFinal = cal.intercept + cal.slope * 60;

// 外部証拠なしなら内部z/ratingは変えない。
const onlyStat = reconcileSpeedEvidence(stat, {}, cfg);
close(onlyStat.rating, 60);
close(onlyStat.zFinal, stat.zFinal);
close(onlyStat.finalRating, statFinal);
assert.equal(onlyStat.evidence.decided_by, 'statistical');

// NPB+はtest_rを重みとして、同じ「最終目盛り」の上で混ぜる。
const direct = { value: 80, source: 'NPB+アプリ top_speed_kmh' };
const w = directSpeedWeight(direct, cfg);
close(w, cfg.npb_plus_direct.models.top_speed_kmh.test_r);
const blended = reconcileSpeedEvidence(stat, { direct }, cfg);
const expectedFinal = statFinal * (1 - w) + 80 * w;
close(blended.finalRating, expectedFinal);
close(speedRawToFinalScale(blended.rating, cfg), expectedFinal);
close(blended.zFinal, speedRawToZ(blended.rating, cfg));
assert.equal(blended.evidence.decided_by, 'direct_blend');

// 旧バグ: 60（較正前）と80（較正後）を混ぜた値とは一致してはいけない。
const oldWrong = 60 * (1 - w) + 80 * w;
assert.ok(Math.abs(blended.finalRating - oldWrong) > 1, '異なる目盛りを直接混ぜる旧式へ戻っている');

// 仕様04 §1.2: 直接計測（第1階層）はdecisionスカウティング（第2階層）より優先。
const scoutingDecision = { value: 68, evaluator: 'owner', source: 'owner', application: 'decision' };
const both = reconcileSpeedEvidence(stat, { direct, scouting: scoutingDecision }, cfg);
close(both.finalRating, expectedFinal);
assert.equal(both.evidence.decided_by, 'direct_blend');
assert.equal(both.evidence.scouting.value, 68); // 採用しなくても証拠は消さない

// directが無い場合だけdecisionスカウティングを数値判断へ使える。
const scoutOnly = reconcileSpeedEvidence(stat, { scouting: scoutingDecision }, cfg);
close(scoutOnly.finalRating, 68);
close(speedRawToFinalScale(scoutOnly.rating, cfg), 68);
assert.equal(scoutOnly.evidence.decided_by, 'scouting');

// evidence_onlyは値決定に使わない。
const scoutingEvidence = { ...scoutingDecision, application: 'evidence_only' };
const evidenceOnly = reconcileSpeedEvidence(stat, { scouting: scoutingEvidence }, cfg);
close(evidenceOnly.finalRating, statFinal);
assert.equal(evidenceOnly.evidence.decided_by, 'statistical');
assert.equal(evidenceOnly.evidence.scouting.value, 68);

console.log('speed evidence: 30 checks passed');

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

// 現行裁定を維持し、スカウティングがあれば最終目盛り値を採用してzへ戻す。
const scouting = { value: 68, evaluator: 'owner', source: 'owner' };
const scout = reconcileSpeedEvidence(stat, { direct, scouting }, cfg);
close(scout.finalRating, 68);
close(speedRawToFinalScale(scout.rating, cfg), 68);
close(scout.zFinal, speedRawToZ(scout.rating, cfg));
assert.equal(scout.evidence.decided_by, 'scouting');

console.log('speed evidence: 24 checks passed');

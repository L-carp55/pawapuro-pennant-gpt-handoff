// Compare candidate T90 -> 1-100 mappings without changing production ratings.
//
// Inputs:
//   outputs/derived/speed_blind_v3_npbplus_2026.json
//   outputs/derived/speed_owner_qa_bands_20260809.json
//   configs/speed_acceleration_prior.json
//
// Owner bands are independent QA only. This script never fits coefficients to them.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalInvCdf } from '../src/ratings/speed_t90.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = async p => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));
const r6 = v => Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
const clamp = (v, lo = 1, hi = 100) => Math.max(lo, Math.min(hi, v));
const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

const source = await J('outputs/derived/speed_blind_v3_npbplus_2026.json');
const owner = await J('outputs/derived/speed_owner_qa_bands_20260809.json');
const accel = await J('configs/speed_acceleration_prior.json');
const players = (source.players ?? []).filter(x => Number.isFinite(x.top_speed_kmh)
  && Number.isFinite(x.t90_blind) && Number.isFinite(x.blind_rating));
if (!players.length) throw new Error('speed_blind_v3_npbplus_2026.json has no usable players');

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sampleSd = a => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1));
};
const quantile = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
const rank = v => v >= 90 ? 'S' : v >= 80 ? 'A' : v >= 70 ? 'B'
  : v >= 60 ? 'C' : v >= 50 ? 'D' : v >= 40 ? 'E' : v >= 20 ? 'F' : 'G';

const speeds = players.map(x => x.top_speed_kmh);
const speedMean = mean(speeds);
const speedSd = sampleSd(speeds);
const n = players.length;
const pFast = x => {
  const slower = speeds.filter(v => v < x).length;
  const equal = speeds.filter(v => v === x).length;
  return (slower + 0.5 * equal) / n;
};

const priorMean = accel.position_player_t90_prior?.mean_sec;
const priorSd = accel.position_player_t90_prior?.sd_sec;
const rows = players.map(x => ({
  ...x,
  name_norm: norm(x.name),
  v3_linear: x.blind_rating,
  sample_gaussian: clamp(50 + 15 * (x.top_speed_kmh - speedMean) / speedSd),
  sample_empirical_normal_score: clamp(50 + 15 * normalInvCdf(pFast(x.top_speed_kmh))),
  college_27_43m_prior_z: clamp(50 + 15 * (priorMean - x.t90_blind) / priorSd),
}));

const ownerMap = new Map((owner.bands ?? []).map(x => [norm(x.player), x.rating_range]));
const distanceToBand = (v, b) => v < b[0] ? b[0] - v : v > b[1] ? v - b[1] : 0;
const summary = key => {
  const values = rows.map(x => x[key]);
  const counts = Object.fromEntries('SABCDEFG'.split('').map(k => [k, 0]));
  for (const v of values) counts[rank(v)]++;
  const qas = rows.filter(x => ownerMap.has(x.name_norm)).map(x => {
    const band = ownerMap.get(x.name_norm);
    return { player: x.name_norm, rating: r6(x[key]), owner_band: band,
      distance_to_band: r6(distanceToBand(x[key], band)) };
  });
  return {
    n: values.length,
    mean: r6(mean(values)), sd_sample: r6(sampleSd(values)),
    min: r6(Math.min(...values)), p25: r6(quantile(values, .25)),
    median: r6(quantile(values, .5)), p75: r6(quantile(values, .75)),
    max: r6(Math.max(...values)), rank_counts: counts,
    owner_qa: {
      n: qas.length,
      within_band: qas.filter(x => x.distance_to_band === 0).length,
      within_band_rate: r6(qas.filter(x => x.distance_to_band === 0).length / qas.length),
      mean_distance_to_band: r6(mean(qas.map(x => x.distance_to_band))),
      max_distance_to_band: r6(Math.max(...qas.map(x => x.distance_to_band))),
    },
  };
};

const selected = rows.filter(x => ownerMap.has(x.name_norm)).map(x => {
  const band = ownerMap.get(x.name_norm);
  const values = Object.fromEntries(['v3_linear', 'sample_gaussian',
    'sample_empirical_normal_score', 'college_27_43m_prior_z'].map(k => [k, r6(x[k])]));
  return {
    player: x.name_norm, top_speed_kmh: x.top_speed_kmh, owner_band: band, ...values,
    distances_to_owner_band: Object.fromEntries(Object.entries(values)
      .map(([k, v]) => [k, r6(distanceToBand(v, band))])),
  };
});

const out = {
  status: 'SCALE_AUDIT_COMPLETE_RETAIN_V3_EVALUATION_SCALE',
  generated_at: new Date().toISOString(),
  production_rating_changed: false,
  owner_qa_used_as_training: false,
  sample: {
    n, top_speed_kmh: { mean: r6(speedMean), sd_sample: r6(speedSd),
      min: Math.min(...speeds), median: r6(quantile(speeds, .5)), max: Math.max(...speeds) },
    warning: 'NPB+収録選手は全NPB野手の無作為・完全標本ではない。sample-centered scaleをfinal referenceにしない。',
  },
  mappings: {
    v3_linear: { formula: '100-99*(T90-3.66)/(4.78-3.66)', summary: summary('v3_linear') },
    sample_gaussian_z: { formula: '50+15*(top_speed-sample_mean)/sample_sd', summary: summary('sample_gaussian') },
    sample_empirical_normal_score: { formula: 'midrank p_fast -> normalInvCdf -> 50+15z', summary: summary('sample_empirical_normal_score') },
    college_27_43m_prior_z: { formula: `50+15*(${priorMean}-T90)/${priorSd}`,
      summary: summary('college_27_43m_prior_z') },
  },
  selected_comparison: selected,
  decision: [
    '現行v3直線尺度をevaluation scaleとして維持する。',
    '99人内で平均50へ強制するscaleは、選抜バイアスとtop-speed-only誤差を目盛りへ吸収するため採用しない。',
    '経験分布scaleは有限標本端点のため、この99人ではSを表現できない。',
    'owner bandへ合わせた全体shift・S字曲線・手動threshold fitは禁止。',
    'final production scaleは完全なNPB T90 reference CDFが完成した時だけ置換する。',
  ],
};

const dest = path.join(ROOT, 'outputs', 'derived', 'speed_rating_scale_audit_20260809.json');
await writeFile(dest, JSON.stringify(out, null, 2), 'utf8');
console.log(`speed rating scale audit -> ${path.relative(ROOT, dest)}`);
for (const [k, v] of Object.entries(out.mappings)) {
  const q = v.summary.owner_qa;
  console.log(`${k}: mean=${v.summary.mean.toFixed(2)} sd=${v.summary.sd_sample.toFixed(2)} ownerQA=${q.within_band}/${q.n} meanGap=${q.mean_distance_to_band.toFixed(2)}`);
}

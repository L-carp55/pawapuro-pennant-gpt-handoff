// 金特の歴代基準を2006-2025年の実データから再生成する（仕様05 §9）。
//
// 全打者年を読み込んだうえで、少打数の1安打・1本塁打を歴代級と誤認しないよう
// configs/ratings.json の min_ab を満たす選手年を分位点の判定対象にする。
// 指標はカード側と同じ年度環境補正式を使い、KONAMI値・MVP・タイトルは一切使わない。

import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEnvironment, gammaForLevel } from '../src/ratings/from_rates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START_SEASON = 2006;
const END_SEASON = 2025;

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const goldCfg = cfg.special_abilities.gold;
if (!(goldCfg.min_ab > 0)) throw new Error('special_abilities.gold.min_ab が未設定');

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const leagueRows = db.prepare(
  'SELECT season, SUM(ab) ab, SUM(h) h, SUM(hr) hr '
  + 'FROM v_batting WHERE season BETWEEN ? AND ? GROUP BY season',
).all(START_SEASON, END_SEASON);
const leagueBySeason = new Map(leagueRows.map(r => [r.season, r]));
const ref = leagueBySeason.get(cfg.environment.reference_season);
if (!(ref?.ab > 0)) throw new Error('基準年' + cfg.environment.reference_season + 'のリーグ集計が無い');
const refAvg = ref.h / ref.ab;
const refHrRate = ref.hr / ref.ab;

const allRows = db.prepare(
  "SELECT season, player_id, name, ab, h, hr FROM v_batting "
  + "WHERE season BETWEEN ? AND ? AND position <> '投' AND ab > 0",
).all(START_SEASON, END_SEASON);

const eligible = allRows.filter(r => r.ab >= goldCfg.min_ab).map(r => {
  const lg = leagueBySeason.get(r.season);
  const rawHrPer500 = (r.hr / r.ab) * cfg.ab_ref.value;
  return {
    season: r.season,
    player_id: r.player_id,
    name: r.name,
    ab: r.ab,
    hrPer500: applyEnvironment(
      r.hr / r.ab, lg.hr / lg.ab, refHrRate, gammaForLevel(rawHrPer500, cfg),
    ) * cfg.ab_ref.value,
    avgEnv: applyEnvironment(
      r.h / r.ab, lg.h / lg.ab, refAvg, cfg.environment.gamma_avg,
    ),
  };
});

function quantile(values, p) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const at = (a.length - 1) * p;
  const lo = Math.floor(at), hi = Math.ceil(at);
  return a[lo] + (a[hi] - a[lo]) * (at - lo);
}

const out = {
  _meta: {
    source_db: 'data/pennant.db',
    source_view: 'v_batting',
    seasons: [START_SEASON, END_SEASON],
    population: '全打者年（投手登録を除く、AB>0）',
    rows_read: allRows.length,
    eligibility: 'AB >= ' + goldCfg.min_ab,
    rows_used: eligible.length,
    exclusion_reason: '少打数の1安打・1本塁打を歴代級と誤認しないため',
    metric_definition: {
      hrPer500: '(HR/AB)を年度リーグ本塁打率で環境補正し、基準打数'
        + cfg.ab_ref.value + 'へ換算。gammaは水準別',
      avgEnv: 'H/ABを年度リーグ打率で環境補正',
    },
    percentile_method: 'R-7 linear interpolation',
    generated_by: 'scripts/build_gold_historical_distribution.mjs',
  },
};

for (const key of Object.keys(goldCfg.criteria)) {
  const values = eligible.map(r => r[key]);
  const maxRow = eligible.reduce((best, r) => best == null || r[key] > best[key] ? r : best, null);
  out[key] = {
    p995: quantile(values, 0.995),
    p999: quantile(values, 0.999),
    max: maxRow?.[key] ?? null,
    n: values.length,
    max_record: maxRow ? {
      player_id: maxRow.player_id,
      name: maxRow.name,
      season: maxRow.season,
      ab: maxRow.ab,
      value: maxRow[key],
    } : null,
  };
}

db.close();
const outDir = path.join(ROOT, 'outputs', 'derived');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'gold_historical_distribution.json');
await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('金特歴代分布: 全' + allRows.length + '打者年を読取 / '
  + eligible.length + '打者年を判定対象（AB>=' + goldCfg.min_ab + '）');
for (const key of Object.keys(goldCfg.criteria)) {
  console.log('  ' + key + ': p995=' + out[key].p995.toFixed(6)
    + ' p999=' + out[key].p999.toFixed(6) + ' max=' + out[key].max.toFixed(6));
}
console.log('→ ' + path.relative(ROOT, outPath));

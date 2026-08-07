// 失効した追加進塁指標が、複数年走力推定をどれだけ動かしていたかを測る。
// 既存 baserunning_advances を「旧経路」として読むだけで、DBは変更しない。

import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext } from '../src/cards/pipeline.mjs';
import { estimateDurableTraits } from '../src/cards/durable_estimate.mjs';
import { speedRating } from '../src/ratings/running.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

// makeContextで重いVIEWをTEMP TABLEへ材料化する。返り値自体は一覧取得以外には不要。
makeContext(db, cfg);
const players = db.prepare(`
  SELECT player_id, name, pa FROM v_batting
  WHERE season=2024 AND position<>'投' AND pa>=100
  ORDER BY pa DESC
`).all();

const rows = [];
for (const p of players) {
  const without = estimateDurableTraits(db, p.player_id, 2024, {
    cfg, runNorm, fldNorm,
    modelGates: { baserunning_advance_source: { enabled: false } },
  }).speed;
  const withStale = estimateDurableTraits(db, p.player_id, 2024, {
    cfg, runNorm, fldNorm,
    modelGates: { baserunning_advance_source: { enabled: true } },
  }).speed;
  if (without?.z == null || withStale?.z == null) continue;
  const rWithout = speedRating(without.z, cfg);
  const rWith = speedRating(withStale.z, cfg);
  rows.push({
    name: p.name, pa: p.pa,
    z_without: without.z, z_with_stale: withStale.z,
    rating_without: rWithout, rating_with_stale: rWith,
    diff: rWith - rWithout,
    evidence_without: without.seasons,
    evidence_with: withStale.seasons,
  });
}

const abs = rows.map(r => Math.abs(r.diff)).sort((a, b) => a - b);
const q = p => abs.length ? abs[Math.min(abs.length - 1, Math.floor((abs.length - 1) * p))] : null;
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const signedMean = mean(rows.map(r => r.diff));
const absMean = mean(abs);
const shifted1 = rows.filter(r => Math.abs(r.diff) >= 1).length;
const shifted2 = rows.filter(r => Math.abs(r.diff) >= 2).length;
const shifted5 = rows.filter(r => Math.abs(r.diff) >= 5).length;

console.log('# 失効追加進塁 → 2024複数年走力への影響');
console.log(`players=${rows.length}`);
console.log(`signed mean=${signedMean?.toFixed(3)}`);
console.log(`absolute mean=${absMean?.toFixed(3)}`);
console.log(`abs p50=${q(0.50)?.toFixed(3)} p90=${q(0.90)?.toFixed(3)} p95=${q(0.95)?.toFixed(3)} max=${q(1)?.toFixed(3)}`);
console.log(`|diff|>=1: ${shifted1}; >=2: ${shifted2}; >=5: ${shifted5}`);

console.log('\n## 最大変動');
for (const r of [...rows].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 30)) {
  console.log(`${r.name}\tPA=${r.pa}\twithout=${r.rating_without.toFixed(2)}\twith_stale=${r.rating_with_stale.toFixed(2)}\tdiff=${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(2)}\tz ${r.z_without.toFixed(3)} -> ${r.z_with_stale.toFixed(3)}`);
}

db.close();

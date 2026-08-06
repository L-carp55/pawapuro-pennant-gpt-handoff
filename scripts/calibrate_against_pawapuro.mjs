// パワプロ405人の能力値を正解として、自作査定の変換式を較正する。
//
// なぜ（2026-08-01）:
//   走力が実感と合わない件を調べたら、**材料でなく目盛りが主犯**だった。
//   117人の突合で相関 r=0.716（順序はかなり合っている）だが、
//   中心が15点・幅が1.38倍ずれていた。「リーグ平均＝50」という自然に見える前提を、
//   再現対象の実際の分布を確認せずに置いていたのが原因。
//
// やること:
//   1. 能力ごとに 自作値 と パワプロ値 の相関・平均・標準偏差を出す
//   2. 相関が十分な能力は **線形変換（中心と幅）だけを較正**する
//   3. 相関が低い能力は材料の問題なので、較正せず「要材料見直し」と報告する
//
// 出力: outputs/derived/pawapuro_calibration.json ＋ configs/ratings.json の scale_calibration

import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] ?? 2024);
const MIN_PA = Number(process.argv[3] ?? 150);
/** 相関がこれ未満なら「材料の問題」とみなし、目盛りの較正をしない */
const MIN_R = 0.4;

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const ctx = makeContext(db, cfg);

const targets = db.prepare(`
  SELECT p.name, l.proeye_id, p.trajectory, p.meet, p.power, p.speed, p.arm, p.fielding, p.catching
  FROM pawapuro_rating p JOIN pawapuro_link l ON l.name_norm = p.name_norm
  WHERE EXISTS (SELECT 1 FROM v_batting b WHERE b.player_id = l.proeye_id AND b.season = ? AND b.pa >= ?)`)
  .all(SEASON, MIN_PA);

console.error(`対象 ${targets.length}人（${SEASON}年・${MIN_PA}打席以上）`);

const rows = [];
let done = 0;
for (const t of targets) {
  const r = appraiseCard(ctx, { playerId: t.proeye_id, mode: String(SEASON), cfg, rv, runNorm, fldNorm });
  if (!r.error) {
    const B = r.card.abilities.基礎能力;
    rows.push({
      name: t.name, pawa: t,
      mine: {
        弾道: B.弾道?.value, ミート: B.ミート?.value, パワー: B.パワー?.value, 走力: B.走力?.value,
        肩力: B.肩力?.value, 守備力: B.守備力?.value, 捕球: B.捕球?.value,
      },
    });
  }
  if (++done % 50 === 0) console.error(`  ...${done}/${targets.length}`);
}

const stat = a => {
  const n = a.length, m = a.reduce((x, y) => x + y, 0) / n;
  return { n, mean: m, sd: Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / n) };
};
const cor = (xs, ys) => {
  const n = xs.length;
  if (n < 10) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : null;
};

const KEY = { 弾道: 'trajectory', ミート: 'meet', パワー: 'power', 走力: 'speed', 肩力: 'arm', 守備力: 'fielding', 捕球: 'catching' };
const result = { season: SEASON, min_pa: MIN_PA, min_r_to_calibrate: MIN_R, n_players: rows.length, abilities: {} };

for (const [jp, en] of Object.entries(KEY)) {
  const p = rows.filter(r => r.mine[jp] != null && r.pawa[en] != null);
  if (p.length < 10) { result.abilities[jp] = { n: p.length, note: '突合できた選手が少なく較正しない' }; continue; }
  const m = p.map(r => r.mine[jp]), w = p.map(r => r.pawa[en]);
  const sm = stat(m), sw = stat(w), r = cor(m, w);

  // 中心と幅だけを合わせる（順序は変えない）。傾き＝標準偏差の比
  const slope = sw.sd / sm.sd;
  const intercept = sw.mean - slope * sm.mean;
  const after = m.map(v => intercept + slope * v);
  const rmseBefore = Math.sqrt(m.reduce((s, v, i) => s + (v - w[i]) ** 2, 0) / m.length);
  const rmseAfter = Math.sqrt(after.reduce((s, v, i) => s + (v - w[i]) ** 2, 0) / after.length);

  result.abilities[jp] = {
    n: p.length, correlation: r,
    mine: sm, pawapuro: sw,
    center_shift: sw.mean - sm.mean, width_ratio: slope,
    calibration: { slope, intercept },
    rmse: { before: rmseBefore, after: rmseAfter },
    calibrate: r != null && r >= MIN_R,
    verdict: r == null ? '判定不能'
      : r >= MIN_R
        ? `順序は合っている（r=${r.toFixed(3)}）。中心と幅を合わせれば誤差 ${rmseBefore.toFixed(1)}→${rmseAfter.toFixed(1)}`
        : `**相関が低い（r=${r.toFixed(3)}）＝材料の問題**。目盛りを合わせても順序が違うので較正しない`,
  };
}

await writeFile(path.join(ROOT, 'outputs', 'derived', 'pawapuro_calibration.json'), JSON.stringify(result, null, 2), 'utf8');

console.log(`\nパワプロ${result.n_players}人と突合（${SEASON}年・${MIN_PA}打席以上）\n`);
console.log('能力      n    相関      自作(平均/幅)    パワプロ(平均/幅)   中心ずれ  幅比   誤差(前→後)');
for (const [jp, v] of Object.entries(result.abilities)) {
  if (v.note) { console.log(`  ${jp.padEnd(5)} ${String(v.n).padStart(4)}  ${v.note}`); continue; }
  console.log(`  ${jp.padEnd(5)} ${String(v.n).padStart(4)}  ${(v.correlation >= 0 ? '+' : '') + v.correlation.toFixed(3)}   `
    + `${v.mine.mean.toFixed(1)}/${v.mine.sd.toFixed(1)}`.padEnd(14)
    + `${v.pawapuro.mean.toFixed(1)}/${v.pawapuro.sd.toFixed(1)}`.padEnd(16)
    + `${(v.center_shift >= 0 ? '+' : '') + v.center_shift.toFixed(1)}`.padStart(7)
    + `  x${v.width_ratio.toFixed(2)}`
    + `  ${v.rmse.before.toFixed(1)}→${v.rmse.after.toFixed(1)}`);
}
console.log('\n判定:');
for (const [jp, v] of Object.entries(result.abilities)) if (!v.note) console.log(`  ${jp}: ${v.verdict}`);
db.close();

// パワプロの能力値を正解として、自作査定の「目盛り」を較正する。
//
// なぜ（2026-08-01）:
//   走力が実感と合わない件の真因は**材料でなく目盛り**だった。
//   117人の突合で相関 r=0.716（順序はかなり合っている）なのに、
//   中心が15点・幅が1.38倍ずれていた。「リーグ平均＝50」を、
//   再現対象の実分布を確認せずに置いていたのが原因。
//
// 設計:
//   - カード生成器（appraiseCard）は通さない。能力の計算関数を直接呼ぶ。
//     カード生成器は1枚あたり数秒〜20秒かかることがあり、142人では終わらない
//     （原因未特定。tasks.db へ起票）。較正には能力値だけあれば足りる。
//   - 相関が十分な能力だけ、**中心と幅の線形変換**を較正する（順序は変えない）。
//   - 相関が低い能力は材料の問題なので較正せず「要材料見直し」と報告する。

import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents, speedRating } from '../src/ratings/running.mjs';
import { fieldingRating, catchingRating, armRating } from '../src/ratings/fielding.mjs';
import { trajectoryFromShares } from '../src/engine/batted_ball.mjs';
import { fitLogDist } from '../src/ratings/scale.mjs';
import { appraiseBatting } from '../src/ratings/from_rates.mjs';
import { selectPrior } from '../src/ratings/shrinkage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] ?? 2024);
const MIN_PA = Number(process.argv[3] ?? 150);
const MIN_R = 0.4;   // これ未満なら材料の問題とみなし較正しない

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// appraiseCard と同じ打撃計算を、カード生成器を介さず直接呼ぶための小道具
const lgCache = new Map();
const lgStmt = db.prepare(`SELECT SUM(pa) pa,SUM(ab) ab,SUM(h) h,SUM(b2) b2,SUM(b3) b3,SUM(hr) hr,
  SUM(bb) bb,SUM(hbp) hbp,SUM(sb) sb,SUM(cs) cs,SUM(sh) sh,SUM(sf) sf FROM v_batting WHERE season=?`);
const lgOf = s => { if (!lgCache.has(s)) lgCache.set(s, lgStmt.get(s)); return lgCache.get(s); };
const REF = lgOf(cfg.environment.reference_season);
const refAvg = REF.h / REF.ab, refHr = REF.hr / REF.ab;
const envFactorsOf = s => {
  const a = lgOf(s);
  return { avg: Math.pow(refAvg / (a.h / a.ab), cfg.environment.gamma_avg), hr: Math.pow(refHr / (a.hr / a.ab), cfg.environment.gamma_hr) };
};
const poolStmt = db.prepare(`SELECT so,bb,pa FROM v_batting WHERE season=? AND pa>=200 AND position<>'投'`);
const poolCache = new Map();
const poolOf = s => { if (!poolCache.has(s)) poolCache.set(s, poolStmt.all(s)); return poolCache.get(s); };
const dist = { contact: fitLogDist(poolOf(SEASON).map(r => r.so / r.pa)), eye: fitLogDist(poolOf(SEASON).map(r => r.bb / r.pa)) };
const L = lgOf(SEASON);
const env = { lgAvg: L.h / L.ab, lgHrRate: L.hr / L.ab, refAvg, refHrRate: refHr };
const histStmt = db.prepare(`SELECT season, ab, h, hr FROM v_batting WHERE player_id=? AND season BETWEEN ? AND ? AND ab>0`);

// 打撃・走塁・打球性質・内野安打を1本のクエリで
const bat = db.prepare(`
  SELECT p.name pawa_name, p.trajectory p_traj, p.meet p_meet, p.power p_power,
         p.speed p_speed, p.arm p_arm, p.fielding p_fld, p.catching p_catch,
         b.player_id, b.pa, b.ab, b.h, b.so, b.b2, b.b3, b.hr, b.gdp,
         bm.ubr, m.gb_pct, m.ld_pct, m.offb_pct, m.iffb_pct, t.ih, t.bats
  FROM pawapuro_rating p
  JOIN pawapuro_link pl ON pl.name_norm = p.name_norm
  JOIN v_batting b ON b.player_id = pl.proeye_id AND b.season = ? AND b.pa >= ?
  LEFT JOIN player_link l ON l.proeye_id = b.player_id AND l.season = b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id = b.player_id AND bm.season = b.season AND bm.farm = 0
  LEFT JOIN v_bm_bat m ON m.player_id = l.bm_id AND m.season = b.season AND m.farm = 0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id = b.player_id AND tl.season = b.season
  LEFT JOIN nf3_team_bat t ON t.season = tl.season AND t.name_norm = tl.name_norm
  WHERE b.position <> '投'`).all(SEASON, MIN_PA);

// 守備は主位置（最多イニング）を採る
const fldStmt = db.prepare(`
  SELECT f.pos, f.inn, f.rngr, f.errr, f.arm, f.season
  FROM bm_fld f JOIN player_link l ON l.bm_id = f.player_id AND l.season = f.season
  WHERE l.proeye_id = ? AND f.season = ? AND f.farm = 0 AND f.inn > 0
  ORDER BY f.inn DESC LIMIT 1`);

const rows = [];
for (const r of bat) {
  if (!(r.ab > 0)) continue; // 打数0は換算できない（0で埋めない）
  const sc = speedComponents(
    { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
    { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: SEASON }, r.ubr, runNorm);
  const speed = sc.score == null ? null : speedRating(sc.score, cfg);
  const f = fldStmt.get(r.player_id, SEASON);
  const traj = (r.gb_pct != null && r.offb_pct != null && r.iffb_pct != null)
    ? trajectoryFromShares({ gb: r.gb_pct / 100, ld: (r.ld_pct ?? 0) / 100, offb: r.offb_pct / 100, iffb: r.iffb_pct / 100 }, cfg)
    : null;

  // ミート・パワーは appraiseCard と同じ経路（縮小・環境補正込み）で計算する
  const line = { PA: r.pa, AB: r.ab, H: r.h, B2: r.b2, B3: r.b3, HR: r.hr, BB: r.bb, HBP: r.hbp, SO: r.so, SH: r.sh, SF: r.sf, GDP: r.gdp, SB: r.sb, CS: r.cs };
  const hist = histStmt.all(r.player_id, SEASON - 3, SEASON + 3).filter(h => lgOf(h.season)?.ab)
    .map(h => { const ef = envFactorsOf(h.season); return { season: h.season, ab: h.ab, isFarm: false, avgEnv: (h.h / h.ab) * ef.avg, hrEnv: (h.hr / h.ab) * ef.hr }; });
  const prior = selectPrior({ season: SEASON, ab: line.AB }, hist, { avg: refAvg, hr: refHr }, cfg.shrinkage);
  const bat = appraiseBatting(line, cfg, dist, env, { useIsoBlend: true, prior });

  const armVal = f ? armRating({ ...f }, fldNorm, cfg)?.rating ?? null : null;

  rows.push({
    name: r.pawa_name,
    mine: {
      走力: speed,
      守備力: f ? fieldingRating({ ...f }, sc.score ?? 0, fldNorm, cfg)?.rating ?? null : null,
      捕球: f ? catchingRating({ ...f }, fldNorm, cfg)?.rating ?? null : null,
      弾道: traj,
      ミート: bat.meet, パワー: bat.power, 肩力: armVal,
    },
    pawa: { 走力: r.p_speed, 守備力: r.p_fld, 捕球: r.p_catch, 弾道: r.p_traj, 肩力: r.p_arm, ミート: r.p_meet, パワー: r.p_power },
  });
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

const out = { season: SEASON, min_pa: MIN_PA, min_r_to_calibrate: MIN_R, n: rows.length, abilities: {} };
for (const key of ['走力', '守備力', '捕球', '弾道', 'ミート', 'パワー', '肩力']) {
  const p = rows.filter(r => r.mine[key] != null && r.pawa[key] != null);
  if (p.length < 10) { out.abilities[key] = { n: p.length, note: '突合が少なく較正しない' }; continue; }
  const m = p.map(r => r.mine[key]), w = p.map(r => r.pawa[key]);
  const sm = stat(m), sw = stat(w), r = cor(m, w);
  const slope = sw.sd / sm.sd, intercept = sw.mean - slope * sm.mean;
  const rmse = (a) => Math.sqrt(a.reduce((s, v, i) => s + (v - w[i]) ** 2, 0) / a.length);
  out.abilities[key] = {
    n: p.length, correlation: r, mine: sm, pawapuro: sw,
    center_shift: sw.mean - sm.mean, width_ratio: slope,
    calibration: { slope, intercept },
    rmse: { before: rmse(m), after: rmse(m.map(v => intercept + slope * v)) },
    calibrate: r != null && r >= MIN_R,
  };
}

await writeFile(path.join(ROOT, 'outputs', 'derived', 'pawapuro_scale_calibration.json'), JSON.stringify(out, null, 2), 'utf8');

console.log(`パワプロと突合 ${rows.length}人（${SEASON}年・${MIN_PA}打席以上）\n`);
console.log('能力     n    相関     自作(平均/幅)   パワプロ(平均/幅)  中心ずれ  幅比   誤差(前→後)');
for (const [k, v] of Object.entries(out.abilities)) {
  if (v.note) { console.log(`  ${k.padEnd(4)} ${String(v.n).padStart(4)}  ${v.note}`); continue; }
  console.log(`  ${k.padEnd(4)} ${String(v.n).padStart(4)}  ${(v.correlation >= 0 ? '+' : '') + v.correlation.toFixed(3)}  `
    + `${v.mine.mean.toFixed(1)}/${v.mine.sd.toFixed(1)}`.padEnd(14)
    + `${v.pawapuro.mean.toFixed(1)}/${v.pawapuro.sd.toFixed(1)}`.padEnd(15)
    + `${(v.center_shift >= 0 ? '+' : '') + v.center_shift.toFixed(1)}`.padStart(7)
    + `  x${v.width_ratio.toFixed(2)}`
    + `   ${v.rmse.before.toFixed(1)}→${v.rmse.after.toFixed(1)}`
    + `  ${v.calibrate ? '較正する' : '**材料の問題**'}`);
}
db.close();

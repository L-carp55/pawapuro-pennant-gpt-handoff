// 投手査定の動作確認（Sol仕様 07 §6）
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitLogDist } from '../src/ratings/scale.mjs';
import { appraisePitching } from '../src/ratings/pitching.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// 投手成績（total）＋ プロEYE球の登板・先発数
const rows = db.prepare(`
  SELECT bp.name_ja name, t.player_id, t.ip, t.tbf, t.k_pct, t.bb_pct, t.gb_pct, t.ld_pct,
         t.hr_fb_pct, t.fip, t.siera,
         pe.apps, pe.gs, pe.outs
  FROM v_bm_pit t
  JOIN v_bm_player bp ON bp.player_id=t.player_id AND bp.season=t.season AND bp.farm=t.farm
  LEFT JOIN player_link l ON l.bm_id=t.player_id AND l.season=t.season
  LEFT JOIN v_pitching pe ON pe.player_id=l.proeye_id AND pe.season=t.season
  WHERE t.farm=0 AND t.role='total' AND t.season=? AND t.ip>=30 AND t.k_pct IS NOT NULL`).all(SEASON);

const pvAll = db.prepare(`
  SELECT player_id, pitch_type, velo, pitch_pct, swstr_pct, whiff_pct, csw_pct
  FROM bm_pv WHERE farm=0 AND season=?`).all(SEASON);
const pvBy = new Map();
for (const p of pvAll) {
  if (!pvBy.has(p.player_id)) pvBy.set(p.player_id, []);
  pvBy.get(p.player_id).push({ type: p.pitch_type, velo: p.velo, pitchPct: p.pitch_pct, swstrPct: p.swstr_pct, whiffPct: p.whiff_pct, cswPct: p.csw_pct });
}

// 分布は役割別に作る（先発と救援でBB%・K%の水準が構造的に違うため）
const minStarts = cfg.pitcher.stamina.min_starts;
const isStarter = r => (r.gs ?? 0) >= minStarts;
const stat = v => { const m = v.reduce((a, b) => a + b, 0) / v.length; return { mean: m, sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1)) }; };

const roleDist = (subset) => ({
  kPct: fitLogDist(subset.map(r => r.k_pct / 100).filter(x => x > 0)),
  bbPct: fitLogDist(subset.map(r => r.bb_pct / 100).filter(x => x > 0)),
  ipPerStart: (() => {
    const v = subset.filter(r => isStarter(r) && r.outs).map(r => (r.outs / 3) / r.gs);
    return v.length >= 5 ? stat(v) : null;
  })(),
  n: subset.length,
});

const dists = {
  sp: roleDist(rows.filter(isStarter)),
  rp: roleDist(rows.filter(r => !isStarter(r))),
  // 制球は全投手を1つの分布で測る（同一選手の先発/救援比較で四球率に役割効果が無いと判明）
  all: { bbPct: fitLogDist(rows.map(r => r.bb_pct / 100).filter(x => x > 0)) },
  whiffPct: stat(pvAll.map(p => p.whiff_pct).filter(x => x != null && x > 0)),
};
console.log(`分布を役割別に作成: 先発${dists.sp.n}人 / 救援${dists.rp.n}人`);

const out = rows.map(r => {
  const pitches = pvBy.get(r.player_id) ?? [];
  const usage = {
    games: r.apps ?? 0, gamesStarted: r.gs ?? 0,
    ipPerStart: (r.gs ?? 0) > 0 && r.outs ? (r.outs / 3) / r.gs : null,
  };
  return {
    name: r.name.replace(/　/g, ' '), ip: r.ip, fip: r.fip, gs: r.gs ?? 0,
    ...appraisePitching(
      { IP: r.ip, TBF: r.tbf, K_pct: r.k_pct, BB_pct: r.bb_pct, GB_pct: r.gb_pct, LD_pct: r.ld_pct, HR_FB_pct: r.hr_fb_pct },
      pitches, usage, cfg, { ...dists, whiffPct: dists.whiffPct }),
  };
});

console.log(`\n=== ${SEASON}年 投手査定 (${out.length}人、30イニング以上) ===\n`);
console.log('選手'.padEnd(13) + 'IP'.padStart(6) + '球速'.padStart(7) + '奪三振'.padStart(7) + '制球'.padStart(6) + 'スタミナ'.padStart(8) + '  変化球（変化量）');
const fmt = v => v == null ? '  —' : v.toFixed(0).padStart(3);
const starters = out.filter(r => r.role === 'starter').sort((a, b) => (b.strikeout ?? 0) - (a.strikeout ?? 0));
console.log('\n【先発・奪三振上位】');
for (const r of starters.slice(0, 6)) {
  const br = r.breaking.slice(0, 3).map(b => `${b.type}${b.movement ?? '-'}`).join(' ');
  console.log(r.name.padEnd(13) + String(r.ip).padStart(6) + (r.velocity?.toFixed(0) ?? '—').padStart(7)
    + fmt(r.strikeout).padStart(7) + fmt(r.control).padStart(6) + fmt(r.stamina).padStart(8) + '  ' + br);
}
console.log('\n【制球上位】');
for (const r of [...starters].sort((a, b) => (b.control ?? 0) - (a.control ?? 0)).slice(0, 4)) {
  const br = r.breaking.slice(0, 3).map(b => `${b.type}${b.movement ?? '-'}`).join(' ');
  console.log(r.name.padEnd(13) + String(r.ip).padStart(6) + (r.velocity?.toFixed(0) ?? '—').padStart(7)
    + fmt(r.strikeout).padStart(7) + fmt(r.control).padStart(6) + fmt(r.stamina).padStart(8) + '  ' + br);
}
console.log('\n【救援（スタミナ未判定＝仕様の「先発時スタミナ」）】');
for (const r of out.filter(r => r.role === 'reliever').sort((a, b) => (b.strikeout ?? 0) - (a.strikeout ?? 0)).slice(0, 3)) {
  console.log(r.name.padEnd(13) + String(r.ip).padStart(6) + (r.velocity?.toFixed(0) ?? '—').padStart(7)
    + fmt(r.strikeout).padStart(7) + fmt(r.control).padStart(6) + '     —' + '  ' + r.staminaBasis);
}

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
console.log('\n分布      最小   25%   中央   75%   最大');
for (const k of ['velocity', 'strikeout', 'control', 'stamina']) {
  const v = out.map(r => r[k]).filter(x => x != null);
  if (!v.length) continue;
  console.log(k.padEnd(10) + [0, .25, .5, .75, .999].map(p => q(v, p).toFixed(1).padStart(6)).join(''));
}
db.close();

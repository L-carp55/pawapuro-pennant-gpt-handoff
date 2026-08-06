// 走力・盗塁・走塁の査定結果を確認する。
// 仕様§2.1の例示（走力A・盗塁F／走力C・盗塁B／走力A・企図なし＝慎重）が再現されるかを見る。
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents, speedRating, stealingAbility, baserunningAbility } from '../src/ratings/running.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const norm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const rows = db.prepare(`
  SELECT b.name, b.pa, b.ab, b.so, b.b3, b.hr, b.gdp, b.sb, b.cs, p.ubr, p.wsb, m.gb_pct
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_player p ON p.player_id=l.bm_id AND p.season=b.season AND p.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  WHERE b.season=? AND b.pa>=200 AND b.position<>'投'`).all(SEASON);

const out = rows.map(r => {
  const line = { AB: r.ab, SO: r.so, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa, SB: r.sb, CS: r.cs };
  const sc = speedComponents(line, { gbPct: r.gb_pct }, r.ubr, norm);
  const speed = speedRating(sc.score, cfg);
  const steal = stealingAbility(line, r.wsb, sc.score, norm, cfg);
  const base = baserunningAbility(r.ubr != null ? r.ubr / r.pa : null, sc.score, norm, cfg);
  return { name: r.name.replace(/　/g, ' '), sb: r.sb, cs: r.cs, b3: r.b3, speed, steal, base, z: sc.score };
}).filter(r => r.speed != null);

const fmt = v => v == null ? '  —' : v.toFixed(0).padStart(3);
console.log(`\n=== ${SEASON}年 走力・盗塁・走塁の査定 (${out.length}人) ===\n`);
console.log('選手'.padEnd(13) + '走力'.padStart(5) + '盗塁'.padStart(5) + '走塁'.padStart(5) + '  盗塁実績'.padEnd(12) + ' 判定');

console.log('\n【走力上位】');
for (const r of [...out].sort((a, b) => b.speed - a.speed).slice(0, 6)) {
  console.log(r.name.padEnd(13) + fmt(r.speed).padStart(5) + fmt(r.steal.rating).padStart(5) + fmt(r.base?.rating).padStart(5)
    + `  ${r.sb}盗塁${r.cs}刺`.padEnd(12) + ' ' + (r.steal.verdict ?? r.steal.reason ?? ''));
}
console.log('\n【走力の割に盗塁が上手い】');
for (const r of out.filter(r => r.steal.rating != null).sort((a, b) => (b.steal.rating - b.speed) - (a.steal.rating - a.speed)).slice(0, 4)) {
  console.log(r.name.padEnd(13) + fmt(r.speed).padStart(5) + fmt(r.steal.rating).padStart(5) + fmt(r.base?.rating).padStart(5)
    + `  ${r.sb}盗塁${r.cs}刺`.padEnd(12) + ' ' + r.steal.reason);
}
console.log('\n【走力の割に盗塁が下手】');
for (const r of out.filter(r => r.steal.rating != null).sort((a, b) => (a.steal.rating - a.speed) - (b.steal.rating - b.speed)).slice(0, 4)) {
  console.log(r.name.padEnd(13) + fmt(r.speed).padStart(5) + fmt(r.steal.rating).padStart(5) + fmt(r.base?.rating).padStart(5)
    + `  ${r.sb}盗塁${r.cs}刺`.padEnd(12) + ' ' + r.steal.reason);
}
console.log('\n【走力はあるが企図しない＝慎重（仕様§2.1）】');
const cautious = out.filter(r => r.steal.verdict?.startsWith('慎重'));
for (const r of cautious.slice(0, 4)) {
  console.log(r.name.padEnd(13) + fmt(r.speed).padStart(5) + '  —'.padStart(5) + fmt(r.base?.rating).padStart(5) + `  ${r.sb}盗塁${r.cs}刺`.padEnd(12) + ' ' + r.steal.verdict);
}
if (!cautious.length) console.log('  （該当なし）');

// 成功率だけで測った場合との比較（試行数を入れる効果の確認）
console.log('\n=== 試行数を入れる効果（成功率のみ vs wSB基準） ===');
const cmp = out.filter(r => r.steal.rating != null && (r.sb + r.cs) >= 5)
  .map(r => ({ ...r, succ: r.sb / (r.sb + r.cs), att: r.sb + r.cs }));
console.log('選手'.padEnd(13) + '企図'.padStart(5) + '成功率'.padStart(7) + '  盗塁能力  基準');
for (const r of [...cmp].sort((a, b) => b.att - a.att).slice(0, 4))
  console.log(r.name.padEnd(13) + String(r.att).padStart(5) + (r.succ * 100).toFixed(0).padStart(6) + '%' + fmt(r.steal.rating).padStart(10) + '  ' + r.steal.basis);
for (const r of [...cmp].filter(r => r.succ >= 0.9).sort((a, b) => a.att - b.att).slice(0, 3))
  console.log(r.name.padEnd(13) + String(r.att).padStart(5) + (r.succ * 100).toFixed(0).padStart(6) + '%' + fmt(r.steal.rating).padStart(10) + '  ' + r.steal.basis + ' ← 高成功率だが少試行');
db.close();

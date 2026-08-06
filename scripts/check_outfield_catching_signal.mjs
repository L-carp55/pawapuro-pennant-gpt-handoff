// 外野手の「捕球」が測れるのかを確かめる。
//
// 発端（2026-08-05）:
//   守備位置ごとに査定のズレを分解したら、外野手の捕球だけ順位の一致が -0.058＝当てずっぽうだった。
//   捕球は失策の少なさから作っているが、**外野手は年に平均2.34失策しかない**（遊撃手は8.78）。
//   14%の選手は年間0失策。これで1〜100の目盛りを作れるのか。
//
// 測り方:
//   同じ選手の**去年と今年**でどれだけ一致するか（年またぎの再現性）を見る。
//   本当に個人の技量なら来年も似た値になるはずで、雑音なら一致しない。
//   遊撃手・三塁手と並べて、事象の少なさが原因かを切り分ける。
//
// 使い方: node scripts/check_outfield_catching_signal.mjs

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

function pearson(a, b) {
  const n = a.length; if (n < 5) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; num += u * v; da += u * u; dbb += v * v; }
  return da > 0 && dbb > 0 ? num / Math.sqrt(da * dbb) : null;
}

const rows = db.prepare(`
  SELECT season, player_id, name, position pos, g, po, a, e
  FROM v_fielding WHERE season BETWEEN 2015 AND 2025 AND g >= 80 AND (po + a + e) >= 100`).all();

const byPlayer = new Map();
for (const r of rows) {
  const k = `${r.player_id}|${r.pos}`;
  if (!byPlayer.has(k)) byPlayer.set(k, new Map());
  byPlayer.get(k).set(r.season, r);
}

console.log('同じ選手の去年と今年で、失策率がどれだけ一致するか');
console.log('（本当に個人の技量なら一致する。雑音なら一致しない）\n');
console.log('位置  連続年の組  平均の機会数  平均失策  年またぎの一致');

const results = [];
for (const pos of ['外', '遊', '三', '二', '一', '捕']) {
  const xs = [], ys = [];
  let chances = 0, errs = 0, cnt = 0;
  for (const [k, seasons] of byPlayer) {
    if (!k.endsWith('|' + pos)) continue;
    for (const [s, r] of seasons) {
      const next = seasons.get(s + 1);
      if (!next) continue;
      const c1 = r.po + r.a + r.e, c2 = next.po + next.a + next.e;
      xs.push(r.e / c1); ys.push(next.e / c2);
      chances += c1; errs += r.e; cnt++;
    }
  }
  const r = pearson(xs, ys);
  results.push({ pos, n: xs.length, r });
  console.log(`  ${pos}   ${String(xs.length).padStart(6)}組   ${String(Math.round(chances / (cnt || 1))).padStart(7)}   ${(errs / (cnt || 1)).toFixed(2).padStart(6)}   ${r === null ? '判定しない' : (r >= 0 ? '+' : '') + r.toFixed(3)}`);
}

console.log('\n読み方:');
console.log('  一致が0に近い＝その年の失策数は来年の予測に使えない＝個人差ではなく巡り合わせ');
console.log('  外野手だけ極端に低いなら、原因は査定の作り方ではなく「事象が少なすぎる」こと');

// 何件あれば個人差が見えるか（二項分布のばらつきと、実際のばらつきを比べる）
console.log('\n観測のばらつきのうち、どれだけが個人差か');
for (const pos of ['外', '遊']) {
  const rates = [], ns = [];
  for (const [k, seasons] of byPlayer) {
    if (!k.endsWith('|' + pos)) continue;
    for (const r of seasons.values()) { const c = r.po + r.a + r.e; rates.push(r.e / c); ns.push(c); }
  }
  const m = rates.reduce((s, v) => s + v, 0) / rates.length;
  const observed = rates.reduce((s, v) => s + (v - m) ** 2, 0) / rates.length;   // 実際のばらつき
  const meanN = ns.reduce((s, v) => s + v, 0) / ns.length;
  const chance = m * (1 - m) / meanN;                                             // 偶然だけで出るばらつき
  const real = Math.max(0, observed - chance);
  console.log(`  ${pos}  実際 ${(observed * 1e4).toFixed(2)} ／ 偶然だけで ${(chance * 1e4).toFixed(2)} ／ 個人差 ${(real * 1e4).toFixed(2)}  （個人差の割合 ${(real / observed * 100).toFixed(0)}%）`);
}
console.log('  ※単位は失策率の分散×10000。個人差の割合が小さいほど「測っても雑音」');
db.close();

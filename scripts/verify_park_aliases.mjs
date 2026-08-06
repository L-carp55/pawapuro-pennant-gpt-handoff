// 球場の別名対応表（configs/park_aliases.json）が正しいかをデータで確かめる。
//
// なぜ要るか（2026-08-05）:
//   「同じ球場の別名」を人手で書くと、移転（＝別の建物）まで同一視してしまう危険がある。
//   実際、札幌ドームとエスコンフィールドは日本ハムの本拠地という点では続きだが、
//   建物が違うので球場係数を共有させてはいけない。
//
// 何をもって「改称」と言えるか:
//   同じ建物の呼び方が変わっただけなら、**同じ年に旧称と新称が両方現れることはない**。
//   両方現れたら、それは別々に存在する2つの球場（＝統合してはいけない）。
//   加えて、切り替わりが1度きりで、前後の年が途切れず繋がっていることを確認する。
//
// 使い方: node scripts/verify_park_aliases.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aliases = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'park_aliases.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// 主催試合が開かれた球場だけを見る（地方開催の1〜2試合を混ぜると判定が濁る）
const rows = db.prepare(`
  SELECT season, park, SUM(plate_appearances) pa FROM park_plate_appearances
  GROUP BY season, park HAVING pa >= 2000 ORDER BY season`).all();
const bySeason = new Map();
for (const r of rows) {
  if (!bySeason.has(r.season)) bySeason.set(r.season, new Map());
  bySeason.get(r.season).set(r.park, r.pa);
}

let fail = 0, checked = 0;
for (const a of aliases.aliases) {
  const names = [a.canonical, ...(a.also ?? [])];
  // その名前が本拠地として使われた年
  const years = new Map();
  for (const n of names) {
    const ys = [...bySeason].filter(([, m]) => m.has(n)).map(([s]) => s).sort();
    if (ys.length) years.set(n, ys);
  }
  if (years.size < 2) {
    console.log(`SKIP  ${a.canonical}: 手元のデータに現れる呼称が${years.size}種（判定できない）`);
    continue;
  }
  checked++;
  // 検査1: 同じ年に2つ以上の呼称が現れないか（現れたら別々の球場）
  const overlap = [];
  for (const [season, m] of bySeason) {
    const hit = names.filter(n => m.has(n));
    if (hit.length > 1) overlap.push(`${season}年に ${hit.join(' と ')}`);
  }
  // 検査2: 年が途切れず繋がっているか（同じ建物が使われ続けたか）
  const all = [...years.values()].flat().sort((x, y) => x - y);
  const gaps = [];
  for (let i = 1; i < all.length; i++) if (all[i] - all[i - 1] > 1) gaps.push(`${all[i - 1]}→${all[i]}`);

  const desc = [...years].map(([n, ys]) => `${n}(${ys[0]}-${ys[ys.length - 1]})`).join(' → ');
  if (overlap.length) {
    fail++;
    console.log(`FAIL  ${a.canonical}: ${overlap.join(' / ')} ＝ 同じ年に併存＝別の球場。統合してはいけない`);
  } else if (gaps.length) {
    console.log(`WARN  ${a.canonical}: ${desc}  年が飛んでいる（${gaps.join(', ')}）。手元のデータの範囲外なだけかを確認`);
  } else {
    console.log(`PASS  ${a.canonical}: ${desc}  併存なし・年が連続`);
  }
}

// 統合してはいけない組が、うっかり同じ別名グループに入っていないか
const NEVER = [['札幌ドーム', 'エスコンF'], ['札幌ドーム', 'エスコンＦ']];
for (const [x, y] of NEVER) {
  const g = aliases.aliases.find(a => [a.canonical, ...(a.also ?? [])].includes(x)
    && [a.canonical, ...(a.also ?? [])].includes(y));
  if (g) { fail++; console.log(`FAIL  ${x} と ${y} が同じ別名グループに入っている（移転＝別の建物）`); }
  else console.log(`PASS  ${x} と ${y} は別扱いのまま`);
}

console.log(`\n合計: ${checked}組を検査 / ${fail} FAIL`);
db.close();
process.exit(fail ? 1 : 0);

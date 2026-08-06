// 1球データから「その選手がどの球場で何打席立ったか」を作る。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//   This uses data sourced from the Nippon Baseball Data Repository.
//
// なぜ要るか（2026-08-05）:
//   球場補正（打ちやすい球場の本塁打を割り引く）には2つが対になって要る。
//     ① 球場ごとの係数    … 手元に2006-2022（Web収集）＋2023-2025（自前の実測）
//     ② その選手の球場別の内訳 … 手元は **NF3 の2023-2025年しか無い**
//   ②が無いと①だけあっても選手ごとの補正は作れない。実際、収集した2006-2022の係数は
//   当面ほとんど使えない状態だった（係数だけ揃えて相方を確認していなかった）。
//
//   1球データには試合ごとの球場名（stadium_name）と打者名（PlayInfo_PlayerName）が入っており、
//   ここから②を **2020年以降** について作れる。NF3（2023-2025）より3年広い。
//
// 数え方:
//   打席 = 同一試合・同一イニング・同一打席番号（inning_ab_num）を1つに畳む。
//   球場名は生データの表記のまま持ち、球場係数側との対応は消費側で取る
//   （表記ゆれの吸収を1か所に閉じ込めないと、名寄せの失敗が静かに起きるため）。
//
//   ★公式戦（セ・リーグ / パ・リーグ / 交流戦）だけを数える。1球データには
//   オープン戦648試合・CS・日本シリーズ・オールスター・ファームまで入っており、
//   絞らずに数えると打席が **一律に多く出る**（実測: 2024年の主な選手で+44〜+67打席）。
//   球場係数の側も公式戦で作っているので、母集団を揃えないと補正が歪む。
//
// 使い方: node scripts/build_park_plate_appearances.mjs [年...]（省略時は取得済みの全年）

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'npb_pbp');

function splitCsvLine(line) {
  const out = []; let f = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(f); f = ''; }
    else f += c;
  }
  out.push(f); return out;
}

if (!existsSync(RAW)) {
  console.error(`1球データがありません: ${path.relative(ROOT, RAW)}`);
  console.error('先に node scripts/fetch_npb_pbp.mjs <年> を実行してください');
  process.exit(1);
}

const years = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [...new Set(readdirSync(RAW).filter(f => f.endsWith('_pbp.csv')).map(f => f.slice(0, 4)))].sort();

const files = readdirSync(RAW)
  .filter(f => f.endsWith('_pbp.csv') && years.includes(f.slice(0, 4)))
  .sort();

const norm = s => (s ?? '').replace(/[\s　]/g, '');
// 公式戦のみ（1=セ・リーグ公式戦 / 2=パ・リーグ公式戦 / 26=セ・パ交流戦）
const REGULAR_SEASON = new Set(['1', '2', '26']);
// 選手×年×球場 → 打席の集合（同一打席の複数球を畳む）
const cells = new Map();
const excluded = new Map();

for (const fn of files) {
  const lines = readFileSync(path.join(RAW, fn), 'utf8').split('\n');
  const hdr = splitCsvLine(lines[0]);
  const I = n => hdr.indexOf(n);
  const iSeason = I('season'), iBatter = I('PlayInfo_PlayerName'), iPark = I('stadium_name');
  const iGame = I('game_id'), iInn = I('inning'), iAb = I('inning_ab_num');
  const iType = I('game_type_id'), iTypeName = I('game_type_name');

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = splitCsvLine(lines[i]);
    if (!REGULAR_SEASON.has(c[iType])) {
      const tn = c[iTypeName];
      if (!excluded.has(tn)) excluded.set(tn, new Set());
      excluded.get(tn).add(c[iGame]);
      continue;
    }
    const name = c[iBatter], park = c[iPark];
    if (!name || !park) continue;
    const key = `${c[iSeason]}|${norm(name)}|${park}`;
    if (!cells.has(key)) cells.set(key, { season: Number(c[iSeason]), name, park, pa: new Set() });
    cells.get(key).pa.add(`${c[iGame]}|${c[iInn]}|${c[iAb]}`);
  }
  console.error(`  ${fn} 読み込み`);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
db.exec(`DROP TABLE IF EXISTS park_plate_appearances`);
db.exec(`CREATE TABLE park_plate_appearances (
  season INTEGER, name TEXT, name_norm TEXT, park TEXT, plate_appearances INTEGER)`);
const ins = db.prepare(`INSERT INTO park_plate_appearances VALUES (?,?,?,?,?)`);
db.exec('BEGIN');
for (const v of cells.values()) ins.run(v.season, v.name, norm(v.name), v.park, v.pa.size);
db.exec('COMMIT');
db.exec(`CREATE INDEX idx_ppa ON park_plate_appearances(name_norm, season)`);

const seasons = [...new Set([...cells.values()].map(v => v.season))].sort();
const players = new Set([...cells.values()].map(v => norm(v.name))).size;
const parks = new Set([...cells.values()].map(v => v.park));
const totalPa = [...cells.values()].reduce((s, v) => s + v.pa.size, 0);

console.log(`\n球場別の打席数: ${cells.size}セル（選手×年×球場）`);
console.log(`  年: ${seasons.join(', ')}`);
console.log(`  選手 ${players}人 / 球場 ${parks.size}種 / 総打席 ${totalPa.toLocaleString()}`);
console.log(`  球場: ${[...parks].sort().join(', ')}`);
console.log(`\n除外した試合（公式戦でないもの）:`);
for (const [k, v] of [...excluded].sort((a, b) => b[1].size - a[1].size)) {
  console.log(`  ${(k || '(不明)').padEnd(32)} ${String(v.size).padStart(4)}試合`);
}

// 検算: 1人分の合計が、その年の公式の打席数と一致するか
const check = db.prepare(`
  SELECT p.name, p.season, SUM(p.plate_appearances) pa_park, b.pa pa_official
  FROM park_plate_appearances p
  JOIN v_batting b ON b.season = p.season
    AND replace(replace(b.name,' ',''),char(12288),'') = p.name_norm
  WHERE p.season = 2024
  GROUP BY p.name_norm, p.season
  HAVING pa_official >= 300`).all();
if (check.length) {
  const diffs = check.map(r => r.pa_park - r.pa_official);
  const exact = diffs.filter(d => d === 0).length;
  const within3 = diffs.filter(d => Math.abs(d) <= 3).length;
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  console.log(`\n検算（2024年・300打席以上の${check.length}人／公式の打席数との差）:`);
  console.log(`  完全一致 ${exact}人 / 誤差3以内 ${within3}人 / 平均のずれ ${mean.toFixed(2)}打席`);
  const worst = check.map(r => ({ ...r, d: r.pa_park - r.pa_official }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5);
  console.log('  ずれの大きい順:');
  for (const r of worst) {
    console.log(`    ${r.name.replace(/　/g, ' ').padEnd(12)} 球場別合計${String(r.pa_park).padStart(4)} vs 公式${String(r.pa_official).padStart(4)}  差${r.d >= 0 ? '+' : ''}${r.d}`);
  }
}
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

// 守備の1プレーずつを取り出す。**分母（処理した打球）と分子（失策）を同じデータから数える**。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//
// オーナー指示（2026-08-05）:
//   「1球ごとのデータを使えば案1を完全な状態で実現できませんか？」
//   案1＝捕球を「送球以外の失策」だけで作る（＝送球失策を捕球から外し、二重計上をなくす）。
//
// なぜ1球データなら「完全」になるか:
//   前に走者なしの内野ゴロだけで悪送球を数えた時は、**分子だけ増やして分母が対応しない**
//   という誤りを踏んだ（走者ありの悪送球を足したのに、走者ありの打球を母数に入れなかった）。
//   ここでは**同じ1球データから、その野手が処理した打球も、失策も、両方数える**ので、
//   分母と分子が必ず揃う。走者の有無・打球の種類を問わず全部拾える。
//
// 失策の分け方（1球データの表記がそのまま教えてくれる）:
//   送球の失敗 … 「◯◯(遊)の悪送球により出塁する」「◯◯(捕):悪送球」
//   捕球の失敗 … 「◯◯(左)の落球により出塁する」「◯◯(中):後逸」「◯◯(一)の後逸により出塁する」
//   種類不明   … 「エラー」とだけ書かれているもの（どちらにも入れない）
//   野選       … 失策ではないので数えない（フィルダースチョイス）
//
// 使い方: node scripts/build_fielding_plays.mjs

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

if (!existsSync(RAW)) { console.error('1球データがありません'); process.exit(1); }
const files = readdirSync(RAW).filter(f => f.endsWith('_pbp.csv')).sort();
const REGULAR = new Set(['1', '2', '26']);
const norm = s => (s ?? '').replace(/[\s　]/g, '');
// hit_location: 1=投 2=捕 3=一 4=二 5=三 6=遊 7=左 8=中 9=右
const POS = { 1: '投', 2: '捕', 3: '一', 4: '二', 5: '三', 6: '遊', 7: '左', 8: '中', 9: '右' };

// 失策の主を description から取る。「村林(遊)の悪送球」「坂本(捕):悪送球」の2書式がある
const ERROR_PATTERNS = [
  { re: /([^\s、。]+?)\(([投捕一二三遊左中右])\)の悪送球/, kind: 'throw' },
  { re: /([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*悪送球/, kind: 'throw' },
  { re: /([^\s、。]+?)\(([投捕一二三遊左中右])\)の落球/, kind: 'field' },
  { re: /([^\s、。]+?)\(([投捕一二三遊左中右])\)の後逸/, kind: 'field' },
  { re: /([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*後逸/, kind: 'field' },
  { re: /([^\s、。]+?)\(([投捕一二三遊左中右])\)の(?:エラー|失策)/, kind: 'unknown' },
  { re: /([^\s、。]+?)\(([投捕一二三遊左中右])\)[:：]\s*(?:エラー|失策)/, kind: 'unknown' },
];

const plays = [];      // 処理した打球（分母）
const errors = [];     // 失策（分子）
let noLocation = 0;

for (const fn of files) {
  const lines = readFileSync(path.join(RAW, fn), 'utf8').split('\n');
  const hdr = splitCsvLine(lines[0]);
  const I = n => hdr.indexOf(n);
  const c = {
    season: I('season'), game: I('game_id'), inn: I('inning'), ab: I('inning_ab_num'),
    type: I('game_type_id'), hl: I('hit_location'), fielder: I('fielder_name'),
    desc: I('description_jap'), park: I('stadium_name'),
  };
  const last = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = splitCsvLine(lines[i]);
    if (!REGULAR.has(r[c.type])) continue;
    last.set(`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`, r);
  }
  for (const r of last.values()) {
    const season = Number(r[c.season]);
    const d = (r[c.desc] ?? '').replace(/^\d+球目:/, '');

    // 分母: 打球を処理した野手（守備位置つき）
    const pos = POS[Number(r[c.hl])];
    if (pos && r[c.fielder]) {
      plays.push({ season, fielder: norm(r[c.fielder]), pos });
    } else if (pos) noLocation++;

    // 分子: 失策。誰のどの種類かを表記から取る
    for (const p of ERROR_PATTERNS) {
      const m = d.match(p.re);
      if (!m) continue;
      errors.push({ season, fielder: norm(m[1]), pos: m[2], kind: p.kind, description: d.slice(0, 60) });
      break;                       // 1打席に複数の失策が書かれることは稀。先に当たった1つだけ取る
    }
  }
  console.error(`  ${fn}`);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
db.exec(`DROP TABLE IF EXISTS fielding_plays`);
db.exec(`CREATE TABLE fielding_plays (season INTEGER, fielder TEXT, pos TEXT, chances INTEGER,
  throw_errors INTEGER, field_errors INTEGER, unknown_errors INTEGER)`);

const agg = new Map();
for (const p of plays) {
  const k = `${p.season}|${p.fielder}|${p.pos}`;
  if (!agg.has(k)) agg.set(k, { season: p.season, fielder: p.fielder, pos: p.pos, ch: 0, te: 0, fe: 0, ue: 0 });
  agg.get(k).ch++;
}
let orphan = 0;
for (const e of errors) {
  const k = `${e.season}|${e.fielder}|${e.pos}`;
  if (!agg.has(k)) {                 // 打球の処理者としては現れないが失策だけ記録された（中継役など）
    agg.set(k, { season: e.season, fielder: e.fielder, pos: e.pos, ch: 0, te: 0, fe: 0, ue: 0 });
    orphan++;
  }
  const v = agg.get(k);
  if (e.kind === 'throw') v.te++; else if (e.kind === 'field') v.fe++; else v.ue++;
}
const ins = db.prepare(`INSERT INTO fielding_plays VALUES (?,?,?,?,?,?,?)`);
db.exec('BEGIN');
for (const v of agg.values()) ins.run(v.season, v.fielder, v.pos, v.ch, v.te, v.fe, v.ue);
db.exec('COMMIT');
db.exec(`CREATE INDEX idx_fp ON fielding_plays(fielder, season, pos)`);

console.log(`\n処理した打球: ${plays.length.toLocaleString()}件（守備位置が無く数えられなかった ${noLocation}件）`);
console.log(`失策: ${errors.length.toLocaleString()}件`);
const byKind = {};
for (const e of errors) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
console.log(`  送球の失敗 ${byKind.throw ?? 0} / 捕球の失敗 ${byKind.field ?? 0} / 種類不明 ${byKind.unknown ?? 0}`);
console.log(`  ※打球の処理者として現れない失策 ${orphan}件（中継役など。分母0で記録）`);

console.log('\n守備位置ごとの失策率');
const byPos = new Map();
for (const v of agg.values()) {
  if (!byPos.has(v.pos)) byPos.set(v.pos, { ch: 0, te: 0, fe: 0, ue: 0 });
  const b = byPos.get(v.pos); b.ch += v.ch; b.te += v.te; b.fe += v.fe; b.ue += v.ue;
}
console.log('位置   処理した打球   送球ミス   捕球ミス   不明   送球の割合');
for (const [p, b] of [...byPos].sort((a, c) => c[1].ch - a[1].ch)) {
  const known = b.te + b.fe;
  console.log(`  ${p}  ${String(b.ch).padStart(9)}  ${String(b.te).padStart(7)}  ${String(b.fe).padStart(7)}  ${String(b.ue).padStart(5)}   ${known ? (b.te / known * 100).toFixed(1) + '%' : '—'}`);
}
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

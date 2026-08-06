// 2026年の1球データから「誰がどれだけ出て、どの守備位置か」を集計する。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//   This uses data sourced from the Nippon Baseball Data Repository.
//
// 何のためか（2026-08-05 オーナー指示「撮影対象リストから今シーズンほとんど出ていない選手を除外して」）:
//   NPB+ の実測は2026年しか出ない。撮ってもらう前に、2026年に出ていない選手を落とす必要がある。
//   さらに **2026年の守備位置**が要る——送球速度は守備位置で水準が全く違うため
//   （実測: 菊池涼介(二塁) 109.0km/h vs 名原典彦(外野) 147.1km/h）、
//   位置ごとに揃えてから肩力へ変換する。2024年から位置が変わった選手はそのままでは使えない
//   （例: 坂倉将吾は2024年=捕手だが2026年は三塁1412球・一塁499球）。
//
// 数え方:
//   打席数 = PlayInfo_PlayerName（打席に立っている選手の**名前**）で数え、同一打席の複数球を1つに畳む
//     ※ batter 列は選手ID（"1800065.0" の形）で、守備側の fielder_*_name は名前。
//        最初これを混ぜて集計し、名寄せが0件になった（2026-08-05に実データで発覚）。
//   守備 = fielder_2〜9_name にその選手が現れた球数。最多の位置を主守備位置とする
//   （投手 fielder_1 は対象外。査定対象は野手のみ）
//   なお PlayInfo_PlayerName は全角スペース区切り（"近本　光司"）、fielder_*_name は詰め（"石原貴規"）。
//   照合側で空白を除いて比べる。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'npb_pbp');
const SEASON = Number(process.argv[2] ?? 2026);

/** 引用符つきCSVの1行を列へ */
export function splitCsvLine(line) {
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

const FIELDER_POS = {
  fielder_2_name: '捕', fielder_3_name: '一', fielder_4_name: '二', fielder_5_name: '三',
  fielder_6_name: '遊', fielder_7_name: '左', fielder_8_name: '中', fielder_9_name: '右',
};

if (!existsSync(RAW)) {
  console.error(`1球データがありません: ${path.relative(ROOT, RAW)}`);
  console.error('先に node scripts/fetch_npb_pbp.mjs を実行してください');
  process.exit(1);
}

const files = readdirSync(RAW).filter(f => f.startsWith(`${SEASON}-`) && f.endsWith('_pbp.csv')).sort();
const norm = s => (s ?? '').replace(/[\s　]/g, '');
const plateApp = new Map();  // 打者名(空白除去) -> Set("game|inning|abnum")
const displayName = new Map(); // 空白除去キー -> 表示用の名前
const games = new Map();     // 打者名 -> Set(game_id)
const fieldPitches = new Map(); // 守備選手名 -> {位置: 球数}

for (const fn of files) {
  const text = readFileSync(path.join(RAW, fn), 'utf8');
  const lines = text.split('\n');
  const hdr = splitCsvLine(lines[0]);
  const iBatter = hdr.indexOf('PlayInfo_PlayerName'); // ★IDでなく名前の列
  const iGame = hdr.indexOf('game_id');
  const iInn = hdr.indexOf('inning');
  const iAb = hdr.indexOf('inning_ab_num');
  const posIdx = Object.fromEntries(Object.entries(FIELDER_POS).map(([k, v]) => [hdr.indexOf(k), v]));

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = splitCsvLine(lines[i]);
    const b = norm(c[iBatter]);
    if (b) {
      if (!plateApp.has(b)) { plateApp.set(b, new Set()); games.set(b, new Set()); displayName.set(b, c[iBatter]); }
      plateApp.get(b).add(`${c[iGame]}|${c[iInn]}|${c[iAb]}`);
      games.get(b).add(c[iGame]);
    }
    for (const [idx, pos] of Object.entries(posIdx)) {
      const nm = norm(c[idx]);
      if (!nm) continue;
      if (!displayName.has(nm)) displayName.set(nm, c[idx]);
      if (!fieldPitches.has(nm)) fieldPitches.set(nm, {});
      const m = fieldPitches.get(nm);
      m[pos] = (m[pos] ?? 0) + 1;
    }
  }
  console.error(`  ${fn} 読み込み`);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
db.exec(`DROP TABLE IF EXISTS npb_usage_2026`);
db.exec(`CREATE TABLE npb_usage_2026 (
  name TEXT PRIMARY KEY, plate_appearances INTEGER, games INTEGER,
  primary_pos TEXT, primary_pos_pitches INTEGER, pos_breakdown TEXT)`);
const ins = db.prepare(`INSERT OR REPLACE INTO npb_usage_2026 VALUES (?,?,?,?,?,?)`);

const names = new Set([...plateApp.keys(), ...fieldPitches.keys()]);
db.exec('BEGIN');
for (const nm of names) {
  const fp = fieldPitches.get(nm) ?? {};
  const entries = Object.entries(fp).sort((a, b) => b[1] - a[1]);
  ins.run(displayName.get(nm) ?? nm, plateApp.get(nm)?.size ?? 0, games.get(nm)?.size ?? 0,
    entries[0]?.[0] ?? null, entries[0]?.[1] ?? null, JSON.stringify(fp));
}
db.exec('COMMIT');

const withPA = [...plateApp.entries()].filter(([, s]) => s.size > 0);
console.log(`${SEASON}年 ${files.length}ヶ月分を集計`);
console.log(`  打席のあった選手: ${withPA.length}人 / 守備についた野手: ${fieldPitches.size}人`);
const bands = { '200打席以上': 0, '100-199': 0, '50-99': 0, '1-49': 0 };
for (const [, s] of withPA) {
  const n = s.size;
  if (n >= 200) bands['200打席以上']++;
  else if (n >= 100) bands['100-199']++;
  else if (n >= 50) bands['50-99']++;
  else bands['1-49']++;
}
console.log('  打席数の分布:', JSON.stringify(bands));
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

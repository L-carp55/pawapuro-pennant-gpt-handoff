// NPBとMLBの両方でプレーした選手（橋渡し）を見つけ、MLB実測とNPB統計を対応づける。
//
// なぜ（2026-08-01 オーナー提案）:
//   MLBはSprint Speed・Arm Strengthを実測公開しているがNPBには無い。
//   オーナー指摘「MLBとNPBではレベルに差があるので、MLBを高めに査定しないと
//   NPB選手が軒並み低くなる」。**この差は推定しない**——両方でプレーした選手を使えば、
//   同一人物で「NPB統計」と「MLB実測」が対応づき、リーグ差は式に自動的に織り込まれる。
//
// 名寄せ: MLBは "Last, First"（英字）、NPBは日本語。
//   NPB Basement が name_en を持っているのでそれを橋にする。
//   外国人選手はカタカナ↔英字なので name_en が頼り。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'mlb_statcast');

/** 引用符つきCSVを行×列へ */
export function parseCsv(t) {
  const rows = []; let f = '', row = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); if (row.some(x => x !== '')) rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}

/** "Last, First" → 突合キー（小文字・記号なし） */
const mlbKey = s => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
/** NPB Basement の name_en は "First Last" の形が多いので両方の並びを試す */
const enKeys = s => {
  const t = (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z ]/g, ' ').trim().split(/\s+/);
  if (t.length < 2) return [];
  return [t.join(''), [t.at(-1), ...t.slice(0, -1)].join('')];
};

// --- MLB側 ---
const mlb = { speed: new Map(), arm: new Map() };
for (const fn of readdirSync(RAW).filter(x => x.endsWith('.csv'))) {
  const year = Number(fn.match(/(\d{4})/)[1]);
  const rows = parseCsv(readFileSync(path.join(RAW, fn), 'utf8'));
  const hdr = rows[0];
  if (fn.startsWith('sprint_speed_')) {
    const iN = hdr.indexOf('last_name, first_name'), iV = hdr.indexOf('sprint_speed'), iH = hdr.indexOf('hp_to_1b');
    for (const r of rows.slice(1)) {
      const v = Number(r[iV]); if (!Number.isFinite(v)) continue;
      const k = mlbKey(r[iN]);
      if (!mlb.speed.has(k)) mlb.speed.set(k, { name: r[iN], obs: [] });
      mlb.speed.get(k).obs.push({ year, sprint_speed: v, hp_to_1b: Number(r[iH]) || null });
    }
  } else if (fn.startsWith('arm_')) {
    const iN = hdr.findIndex(h => /fielder_name|last_name/.test(h));
    const iV = hdr.findIndex(h => /max.*arm|arm_strength|maxeff/i.test(h));
    if (iN < 0 || iV < 0) continue;
    for (const r of rows.slice(1)) {
      const v = Number(r[iV]); if (!Number.isFinite(v)) continue;
      const k = mlbKey(r[iN]);
      if (!mlb.arm.has(k)) mlb.arm.set(k, { name: r[iN], obs: [] });
      mlb.arm.get(k).obs.push({ year, arm_mph: v });
    }
  }
}

// --- NPB側（NPB Basement の英語名を持つ選手） ---
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const npb = db.prepare(`
  SELECT DISTINCT p.name_ja, p.name_en, l.proeye_id
  FROM v_bm_player p LEFT JOIN player_link l ON l.bm_id = p.player_id AND l.season = p.season
  WHERE p.name_en IS NOT NULL AND p.name_en <> ''`).all();

const bridges = [];
for (const n of npb) {
  for (const k of enKeys(n.name_en)) {
    const s = mlb.speed.get(k), a = mlb.arm.get(k);
    if (!s && !a) continue;
    bridges.push({
      npb_name: n.name_ja, npb_name_en: n.name_en, proeye_id: n.proeye_id,
      mlb_name: (s ?? a).name,
      sprint_speed: s ? s.obs : null,
      arm: a ? a.obs : null,
    });
    break;
  }
}
const uniq = [...new Map(bridges.map(b => [b.npb_name, b])).values()];

db.exec(`DROP TABLE IF EXISTS mlb_bridge;
  CREATE TABLE mlb_bridge (npb_name TEXT, npb_name_en TEXT, proeye_id TEXT, mlb_name TEXT,
    sprint_speed_avg REAL, sprint_years INTEGER, arm_mph_avg REAL, arm_years INTEGER, detail TEXT);`);
const ins = db.prepare(`INSERT INTO mlb_bridge VALUES (?,?,?,?,?,?,?,?,?)`);
const avg = a => a?.length ? a.reduce((s, x) => s + (x.sprint_speed ?? x.arm_mph), 0) / a.length : null;
db.exec('BEGIN');
for (const b of uniq) {
  ins.run(b.npb_name, b.npb_name_en, b.proeye_id, b.mlb_name,
    avg(b.sprint_speed), b.sprint_speed?.length ?? 0,
    avg(b.arm), b.arm?.length ?? 0, JSON.stringify(b));
}
db.exec('COMMIT');

const withSpeed = uniq.filter(b => b.sprint_speed).length;
const withArm = uniq.filter(b => b.arm).length;
const withId = uniq.filter(b => b.proeye_id).length;
console.log(`MLB側: Sprint Speed ${mlb.speed.size}選手 / Arm ${mlb.arm.size}選手`);
console.log(`NPB側（英語名あり）: ${npb.length}件`);
console.log(`\n橋渡し ${uniq.length}人（Sprint Speed ${withSpeed} / Arm ${withArm} / プロEYE球ID ${withId}）`);
for (const b of uniq.slice(0, 25)) {
  console.log(`  ${b.npb_name.replace(/　/g, '').padEnd(10)} ${(b.mlb_name ?? '').padEnd(22)}`
    + (b.sprint_speed ? `速${avg(b.sprint_speed).toFixed(1)}(${b.sprint_speed.length}年)` : '速—').padEnd(16)
    + (b.arm ? `肩${avg(b.arm).toFixed(1)}mph(${b.arm.length}年)` : '肩—'));
}
if (uniq.length > 25) console.log(`  ... 他${uniq.length - 25}人`);
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'mlb_bridge.json'), JSON.stringify(uniq, null, 1), 'utf8');
db.close();

// MLB Statcast の Pop Time（捕手）をNPB選手へ橋渡しする。
//
// なぜ要るか（2026-08-04）: 仕様04 §10.2 は捕手の第1階層として
// **Pop Time・Exchange Time・送球速度**を挙げているが、実装は Framing/Blocking のzしか使っておらず、
// 記録には「日本で未公開」と書かれていた。しかし data/raw/mlb_statcast/poptime_2015〜2025.csv が
// **11年分すでに取得済み**で、列は maxeff_arm_2b_3b_sba（送球速度）／exchange_2b_3b_sba（持ち替え）／
// pop_2b_sba（二塁送球タイム）＝仕様が求めるものそのもの。
// 既存の link_mlb_bridge.mjs は 'sprint_speed_' と 'arm_' で始まるファイルしか見ておらず、
// 'poptime_' はどちらにも当たらず**丸ごと読み飛ばされていた**（2026-08-04に棚卸しで判明）。
//
// 本スクリプトは link_mlb_bridge.mjs と同じ突合方式（NPB Basementの name_en 経由）で
// poptime を mlb_catcher_bridge テーブルへ入れる。査定への接続は別途（測ってから決める）。
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'mlb_statcast');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// 引用符つきCSVの手書きパーサ（"Last, First" に","が入るため標準splitは使えない）
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}
const mlbKey = s => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
const enKeys = s => {
  const t = (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z ]/g, ' ').trim().split(/\s+/);
  if (t.length < 2) return [];
  return [t.join(''), [t.at(-1), ...t.slice(0, -1)].join('')];
};

// --- MLB側 poptime を集める ---
const pop = new Map();
let files = 0;
for (const fn of readdirSync(RAW).filter(x => x.startsWith('poptime_') && x.endsWith('.csv'))) {
  files++;
  const year = Number(fn.match(/(\d{4})/)[1]);
  const rows = parseCsv(readFileSync(path.join(RAW, fn), 'utf8'));
  const hdr = rows[0];
  const iN = hdr.indexOf('entity_name');
  const iArm = hdr.indexOf('maxeff_arm_2b_3b_sba');   // 送球速度(mph)
  const iEx = hdr.indexOf('exchange_2b_3b_sba');      // 持ち替え(秒)
  const iPop = hdr.indexOf('pop_2b_sba');             // 二塁送球タイム(秒)
  const iCnt = hdr.indexOf('pop_2b_sba_count');       // 試行数
  if (iN < 0) continue;
  for (const r of rows.slice(1)) {
    const k = mlbKey(r[iN]); if (!k) continue;
    const rec = {
      year,
      arm_mph: Number(r[iArm]) || null,
      exchange_s: Number(r[iEx]) || null,
      pop_2b_s: Number(r[iPop]) || null,
      attempts: Number(r[iCnt]) || null,
    };
    if (rec.arm_mph == null && rec.pop_2b_s == null) continue;
    if (!pop.has(k)) pop.set(k, { name: r[iN], obs: [] });
    pop.get(k).obs.push(rec);
  }
}
console.log(`poptime CSV ${files}ファイル / MLB捕手 ${pop.size}人を読み込み`);

// --- NPB側: Basementの英語名を持つ選手 ---
let npb;
try {
  npb = db.prepare(`
    SELECT DISTINCT p.name_ja, p.name_en, l.proeye_id
    FROM v_bm_player p
    JOIN player_link l ON l.bm_id = p.player_id AND l.season = p.season
    WHERE p.name_en IS NOT NULL AND p.name_en <> ''`).all();
} catch (e) {
  console.error('NPB Basementの名簿が引けません:', e.message);
  process.exit(1);
}

const matched = [];
for (const n of npb) {
  for (const k of enKeys(n.name_en)) {
    if (pop.has(k)) {
      const o = pop.get(k).obs;
      const avg = (key) => { const v = o.map(x => x[key]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      matched.push({
        npb_name: n.name_ja, npb_name_en: n.name_en, proeye_id: n.proeye_id,
        mlb_name: pop.get(k).name,
        arm_mph_avg: avg('arm_mph'), exchange_avg: avg('exchange_s'), pop2b_avg: avg('pop_2b_s'),
        years: o.length, detail: JSON.stringify({ npb_name: n.name_ja, mlb_name: pop.get(k).name, obs: o }),
      });
      break;
    }
  }
}

db.exec(`DROP TABLE IF EXISTS mlb_catcher_bridge`);
db.exec(`CREATE TABLE mlb_catcher_bridge (
  npb_name TEXT, npb_name_en TEXT, proeye_id TEXT, mlb_name TEXT,
  arm_mph_avg REAL, exchange_avg REAL, pop2b_avg REAL, years INTEGER, detail TEXT)`);
const ins = db.prepare(`INSERT INTO mlb_catcher_bridge VALUES (?,?,?,?,?,?,?,?,?)`);
db.exec('BEGIN');
for (const m of matched) ins.run(m.npb_name, m.npb_name_en, m.proeye_id, m.mlb_name,
  m.arm_mph_avg, m.exchange_avg, m.pop2b_avg, m.years, m.detail);
db.exec('COMMIT');

console.log(`橋渡しできた捕手: ${matched.length}人（NPB側IDあり ${matched.filter(m => m.proeye_id).length}人）`);
for (const m of matched) {
  console.log(`  ${m.npb_name} / ${m.mlb_name}: 送球${m.arm_mph_avg?.toFixed(1) ?? '—'}mph 持替${m.exchange_avg?.toFixed(2) ?? '—'}s 二塁送球${m.pop2b_avg?.toFixed(2) ?? '—'}s (${m.years}年)`);
}
db.close();

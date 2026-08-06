// 取得したパワプロ2024-2025の能力値を解析してDBへ入れる（正解ラベル）。
//
// 表の形: 選手名 | 弾 | ミ | パ | 走 | 肩 | 守 | 捕
// 値は100段階の数値（ランクではない）。投手の表（球速・コン・スタ）は野手と列が違うので除く。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'pawapuro');

export const normName = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');
export const normNameNoInitial = s => normName(s).replace(/^[A-Za-z]\.?/, '');

const strip = s => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** 1ページ → 野手の能力行 */
export function parseTeamPage(html, team) {
  const out = [];
  for (const chunk of html.split('<table').slice(1)) {
    const rows = chunk.split(/<tr/).slice(1)
      .map(tr => [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(m => strip(m[1])));
    if (!rows.length) continue;
    const hdr = rows[0];
    // 野手の表だけを採る（弾・ミ・パ・走・肩・守・捕が揃っている）
    const want = ['弾', 'ミ', 'パ', '走', '肩', '守', '捕'];
    const idx = want.map(w => hdr.findIndex(c => c === w));
    if (idx.some(i => i < 0)) continue;
    const nameIdx = hdr.findIndex(c => c.includes('選手名'));
    if (nameIdx < 0) continue;

    for (const r of rows.slice(1)) {
      const rawName = r[nameIdx] ?? '';
      // 「會澤翼 【背：27】」から名前だけ取る
      const name = rawName.replace(/【[^】]*】/g, '').trim();
      if (!name || name.length > 20) continue;
      const vals = idx.map(i => {
        const v = Number((r[i] ?? '').replace(/[^\d.-]/g, ''));
        return Number.isFinite(v) && v >= 1 && v <= 100 ? v : null;
      });
      // 弾道は1-4なので別扱い。他が1つもなければ行として採らない
      if (vals.slice(1).every(v => v == null)) continue;
      out.push({
        team, name, name_norm: normName(name),
        trajectory: vals[0], meet: vals[1], power: vals[2],
        speed: vals[3], arm: vals[4], fielding: vals[5], catching: vals[6],
      });
    }
  }
  return out;
}

if ((process.argv[1] ?? '').endsWith('parse_pawapuro_ratings.mjs')) {
  if (!existsSync(RAW)) { console.error('先に node scripts/fetch_pawapuro_ratings.mjs'); process.exit(1); }
  const teams = JSON.parse(readFileSync(path.join(RAW, '_teams.json'), 'utf8'));
  const byId = Object.fromEntries(teams.map(t => [String(t.id), t.team]));

  const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
  db.exec(`
    DROP TABLE IF EXISTS pawapuro_rating;
    CREATE TABLE pawapuro_rating (
      title TEXT, team TEXT, name TEXT, name_norm TEXT,
      trajectory REAL, meet REAL, power REAL, speed REAL, arm REAL, fielding REAL, catching REAL
    );
    CREATE INDEX idx_pawa ON pawapuro_rating(name_norm);
  `);
  const cols = ['title', 'team', 'name', 'name_norm', 'trajectory', 'meet', 'power', 'speed', 'arm', 'fielding', 'catching'];
  const ins = db.prepare(`INSERT INTO pawapuro_rating (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);

  let rows = 0;
  db.exec('BEGIN');
  for (const f of readdirSync(RAW).filter(x => x.endsWith('.gz'))) {
    const id = f.replace('.htm.gz', '');
    const html = gunzipSync(readFileSync(path.join(RAW, f))).toString('utf8');
    for (const r of parseTeamPage(html, byId[id] ?? id)) {
      ins.run('パワプロ2024-2025', r.team, r.name, r.name_norm,
        r.trajectory, r.meet, r.power, r.speed, r.arm, r.fielding, r.catching);
      rows++;
    }
  }
  db.exec('COMMIT');

  // プロEYE球へ名寄せ（パワプロ2024-2025 ≒ 2024シーズンの選手）
  db.exec(`DROP TABLE IF EXISTS pawapuro_link;
    CREATE TABLE pawapuro_link (name_norm TEXT PRIMARY KEY, proeye_id TEXT, proeye_name TEXT, method TEXT);`);
  const insLink = db.prepare(`INSERT OR IGNORE INTO pawapuro_link VALUES (?,?,?,?)`);
  const pe = db.prepare(`SELECT DISTINCT player_id, name FROM v_batting WHERE season BETWEEN 2022 AND 2025`).all();
  const exact = new Map(), noInit = new Map();
  for (const r of pe) {
    exact.set(normName(r.name), r);
    const k = normNameNoInitial(r.name);
    if (!noInit.has(k)) noInit.set(k, []);
    noInit.get(k).push(r);
  }
  const stat = { exact: 0, no_initial: 0, ambiguous: 0, missing: 0 };
  db.exec('BEGIN');
  for (const { name_norm } of db.prepare(`SELECT DISTINCT name_norm FROM pawapuro_rating`).all()) {
    const e = exact.get(name_norm);
    if (e) { insLink.run(name_norm, e.player_id, e.name, 'exact'); stat.exact++; continue; }
    const c = noInit.get(normNameNoInitial(name_norm));
    const uniq = c ? [...new Map(c.map(r => [r.player_id, r])).values()] : [];
    if (uniq.length === 1) { insLink.run(name_norm, uniq[0].player_id, uniq[0].name, 'no_initial'); stat.no_initial++; continue; }
    if (uniq.length > 1) stat.ambiguous++; else stat.missing++;
  }
  db.exec('COMMIT');

  const n = db.prepare(`SELECT COUNT(*) n FROM pawapuro_rating`).get().n;
  const withSpeed = db.prepare(`SELECT COUNT(*) n FROM pawapuro_rating WHERE speed IS NOT NULL`).get().n;
  const withArm = db.prepare(`SELECT COUNT(*) n FROM pawapuro_rating WHERE arm IS NOT NULL`).get().n;
  const linked = db.prepare(`SELECT COUNT(*) n FROM pawapuro_link`).get().n;
  console.log(`野手 ${n}人（走力あり ${withSpeed} / 肩力あり ${withArm}）`);
  const tot = Object.values(stat).reduce((a, b) => a + b, 0);
  console.log(`名寄せ: 完全${stat.exact} + イニシャル落とし${stat.no_initial} = ${linked}/${tot} (${(linked / tot * 100).toFixed(1)}%)`);
  console.log(`  同名で結び付けず ${stat.ambiguous} / プロEYE球側に無い ${stat.missing}`);
  db.close();
}

// 球団別打撃ページから内野安打・得点圏打率を取り出してDBへ入れる。
//
// 取れるもの（1球団1ページに全選手）:
//   内安 / 内安率  → 仕様04 §1.2 第3階層の「内野安打率」。走力の材料（未実装だった）
//   得点圏         → チャンスの補助。選手個別ページ（2023-2025）より広い年代をカバー
//   席（左右）     → 内野安打は左打ちが有利なので、補正に要る（仕様§1.2の注意書き）
//
// 欠損は0で埋めない（仕様03 §1.3）。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'nf3_team');

export const normName = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');
export const normNameNoInitial = s => normName(s).replace(/^[A-Za-z]\.?/, '');

// 列構成は年で違う（古い年には内安・得点圏が無いことがある）。
// 無い列は null を返し、0で埋めない（仕様03 §1.3）。
const strip = s => (s == null ? '' : s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
const num = s => {
  if (s == null) return null;
  const t = strip(s).replace(/[%,]/g, '');
  if (t === '' || t === '-' || t === '−') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};

/** 1ページ → 選手行の配列 */
export function parseTeamPage(html, season, team) {
  const i = html.indexOf('dmain');
  if (i < 0) return [];
  const body = html.slice(i);
  const trs = body.split(/<tr/).slice(1);
  let hdr = null;
  const out = [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(m => m[1]);
    if (!cells.length) continue;
    if (!hdr) { hdr = cells.map(strip); continue; }
    // 選手行だけを採る（合計行・見出し行を除く）
    if (!/_stat\.htm/.test(tr)) continue;
    const at = name => { const k = hdr.indexOf(name); return k < 0 ? null : cells[k]; };
    const nm = strip(at('名前') ?? '');
    if (!nm) continue;
    out.push({
      season, team,
      name: nm, name_norm: normName(nm),
      bats: strip(at('席') ?? '') || null,          // 左 / 右 / 両
      pa: num(at('打席')), ab: num(at('打数')), h: num(at('安打')),
      ih: num(at('内安')),                          // 内野安打（これが欲しかった）
      ih_pct: num(at('内安率')),
      risp_avg: num(at('得点圏')),
      so: num(at('三振')), bb: num(at('四球')),
      b2: num(at('２Ｂ')), b3: num(at('３Ｂ')), hr: num(at('本塁')),
      sb: num(at('盗塁')), cs: num(at('盗塁死')), gdp: num(at('併殺打')),
    });
  }
  return out;
}

if ((process.argv[1] ?? '').endsWith('parse_nf3_team_batting.mjs')) {
  if (!existsSync(RAW)) { console.error('先に node scripts/fetch_nf3_team_batting.mjs'); process.exit(1); }
  const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
  db.exec(`
    DROP TABLE IF EXISTS nf3_team_bat;
    CREATE TABLE nf3_team_bat (
      season INTEGER, team TEXT, name TEXT, name_norm TEXT, bats TEXT,
      pa REAL, ab REAL, h REAL, ih REAL, ih_pct REAL, risp_avg REAL,
      so REAL, bb REAL, b2 REAL, b3 REAL, hr REAL, sb REAL, cs REAL, gdp REAL
    );
    CREATE INDEX idx_nf3_team_bat ON nf3_team_bat(season, name_norm);
  `);
  const cols = ['season', 'team', 'name', 'name_norm', 'bats', 'pa', 'ab', 'h', 'ih', 'ih_pct',
    'risp_avg', 'so', 'bb', 'b2', 'b3', 'hr', 'sb', 'cs', 'gdp'];
  const ins = db.prepare(`INSERT INTO nf3_team_bat (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);

  let files = 0, rows = 0;
  db.exec('BEGIN');
  for (const f of readdirSync(RAW).filter(x => x.endsWith('.gz'))) {
    const m = f.match(/^(\d{4})_([A-Z]{1,2})\.htm\.gz$/);
    if (!m) continue;
    const html = gunzipSync(readFileSync(path.join(RAW, f))).toString('utf8');
    for (const r of parseTeamPage(html, Number(m[1]), m[2])) { ins.run(...cols.map(c => r[c] ?? null)); rows++; }
    files++;
  }
  db.exec('COMMIT');

  // プロEYE球へ名寄せ（選手個別ページと同じ方式）
  db.exec(`DROP TABLE IF EXISTS nf3_team_link;
    CREATE TABLE nf3_team_link (season INTEGER, name_norm TEXT, proeye_id TEXT, method TEXT,
      PRIMARY KEY (season, name_norm));`);
  const insLink = db.prepare(`INSERT OR IGNORE INTO nf3_team_link VALUES (?,?,?,?)`);
  const stat = { exact: 0, no_initial: 0, ambiguous: 0, missing: 0 };
  db.exec('BEGIN');
  for (const { season } of db.prepare(`SELECT DISTINCT season FROM nf3_team_bat`).all()) {
    const pe = db.prepare(`SELECT player_id, name FROM v_batting WHERE season=?`).all(season);
    const exact = new Map(), noInit = new Map();
    for (const r of pe) {
      exact.set(normName(r.name), r);
      const k = normNameNoInitial(r.name);
      if (!noInit.has(k)) noInit.set(k, []);
      noInit.get(k).push(r);
    }
    for (const { name_norm } of db.prepare(`SELECT DISTINCT name_norm FROM nf3_team_bat WHERE season=?`).all(season)) {
      const e = exact.get(name_norm);
      if (e) { insLink.run(season, name_norm, e.player_id, 'exact'); stat.exact++; continue; }
      const c = noInit.get(normNameNoInitial(name_norm));
      if (c?.length === 1) { insLink.run(season, name_norm, c[0].player_id, 'no_initial'); stat.no_initial++; continue; }
      if (c?.length > 1) stat.ambiguous++; else stat.missing++;
    }
  }
  db.exec('COMMIT');

  const yrs = db.prepare(`SELECT MIN(season) a, MAX(season) b, COUNT(DISTINCT season) n FROM nf3_team_bat`).get();
  const withIh = db.prepare(`SELECT COUNT(*) n FROM nf3_team_bat WHERE ih IS NOT NULL AND ab>=100`).get().n;
  console.log(`${files}ページ / ${rows}行  （${yrs.a}〜${yrs.b}年、${yrs.n}シーズン）`);
  console.log(`内野安打あり（100打数以上）: ${withIh}件`);
  const tot = Object.values(stat).reduce((a, b) => a + b, 0);
  console.log(`名寄せ: 完全${stat.exact} + イニシャル落とし${stat.no_initial} = ${stat.exact + stat.no_initial}/${tot}`
    + ` (${((stat.exact + stat.no_initial) / tot * 100).toFixed(1)}%) / 同名${stat.ambiguous} / 該当なし${stat.missing}`);
  db.close();
}

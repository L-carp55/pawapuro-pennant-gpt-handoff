// pawapuro_full（8作品3,229人）をプロEYE球の選手IDへ名寄せする。
//
// なぜ: 既存の pawapuro_link は Game8 の2024-2025版405人だけを対象に作られており、
//   8作品へ広げた pawapuro_full に当てると47人しか一致しない（2026-08-04実測）。
//   得能の効果を成績で層別して測るには、各作品の年の実成績と結びつける必要がある。
//
// 突合の方針:
//   baseless.org の名前は「中　野」のように**姓のみ・全角空白入り**が多い（表示幅を揃えるため）。
//   プロEYE球は「中野 拓夢」のようにフルネーム。したがって
//   **「姓が一致 かつ 同じ年に同じ球団に在籍」** で結ぶ。姓が同球団に複数いる年は**結ばない**
//   （間違った選手の成績を使うくらいなら、無いままにする＝NF3名寄せと同じ規律）。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

// baseless の球団名 → プロEYE球の球団名（表記ゆれの吸収）
const TEAM_ALIAS = {
  '読売ジャイアンツ': ['読売ジャイアンツ', '巨人'],
  '阪神タイガース': ['阪神タイガース', '阪神'],
  '横浜DeNAベイスターズ': ['横浜DeNAベイスターズ', '横浜ＤｅＮＡベイスターズ', 'DeNA', '横浜'],
  '中日ドラゴンズ': ['中日ドラゴンズ', '中日'],
  '東京ヤクルトスワローズ': ['東京ヤクルトスワローズ', 'ヤクルト'],
  '広島東洋カープ': ['広島東洋カープ', '広島'],
  '福岡ソフトバンクホークス': ['福岡ソフトバンクホークス', 'ソフトバンク'],
  'オリックス・バファローズ': ['オリックス・バファローズ', 'オリックス'],
  '千葉ロッテマリーンズ': ['千葉ロッテマリーンズ', 'ロッテ'],
  '東北楽天ゴールデンイーグルス': ['東北楽天ゴールデンイーグルス', '楽天'],
  '北海道日本ハムファイターズ': ['北海道日本ハムファイターズ', '日本ハム'],
  '埼玉西武ライオンズ': ['埼玉西武ライオンズ', '西武'],
};

const pawa = db.prepare(`SELECT rowid, work, team, name, name_norm FROM pawapuro_full`).all();

// プロEYE球の (年, 球団) → 選手一覧
const bat = db.prepare(`SELECT player_id, name, team, season FROM v_batting WHERE position <> '投' AND ab > 0`).all();
const byKey = new Map();
for (const b of bat) {
  const k = `${b.season}|${norm(b.team)}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push({ ...b, norm: norm(b.name) });
}

db.exec(`DROP TABLE IF EXISTS pawapuro_full_link`);
db.exec(`CREATE TABLE pawapuro_full_link (
  pawa_rowid INTEGER, work TEXT, team TEXT, pawa_name TEXT,
  proeye_id TEXT, proeye_name TEXT, method TEXT)`);
const ins = db.prepare(`INSERT INTO pawapuro_full_link VALUES (?,?,?,?,?,?,?)`);

let linked = 0, ambiguous = 0, notFound = 0;
const perWork = {};

db.exec('BEGIN');
for (const p of pawa) {
  const season = Number(p.work);
  const aliases = TEAM_ALIAS[p.team] ?? [p.team];
  let pool = [];
  for (const a of aliases) pool = pool.concat(byKey.get(`${season}|${norm(a)}`) ?? []);
  if (!pool.length) { notFound++; continue; }

  const key = p.name_norm;                       // 例: 「中野」
  // 姓の前方一致（プロEYE球「中野拓夢」に対し baseless「中野」）
  let hits = pool.filter(x => x.norm.startsWith(key));
  // 完全一致があればそちらを優先（外国人選手など）
  const exact = pool.filter(x => x.norm === key);
  if (exact.length) hits = exact;

  const ids = [...new Set(hits.map(h => h.player_id))];
  if (ids.length === 1) {
    ins.run(p.rowid, p.work, p.team, p.name, ids[0], hits[0].name, exact.length ? 'exact' : 'surname+team+season');
    linked++;
    perWork[p.work] = (perWork[p.work] ?? 0) + 1;
  } else if (ids.length > 1) {
    ambiguous++;                                  // 同姓が同球団に複数 → 結ばない
  } else {
    notFound++;
  }
}
db.exec('COMMIT');

console.log(`パワプロ側 ${pawa.length}人`);
console.log(`  名寄せ成功: ${linked}人（${(linked / pawa.length * 100).toFixed(1)}%）`);
console.log(`  同姓が複数で結ばず: ${ambiguous}人`);
console.log(`  実成績に見つからず: ${notFound}人（二軍のみ・移籍・登録名違いなど）`);
console.log('\n作品別の名寄せ数:');
for (const w of Object.keys(perWork).sort()) console.log(`  ${w}: ${perWork[w]}人`);
db.close();

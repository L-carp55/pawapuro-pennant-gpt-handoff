// 取得済みの MLB The Show 公式APIレスポンス（data/raw/mlb_the_show/*.json.gz）を解析してDBへ格納する。
//
// 何のために使うか:
//   The Show は「実測（Statcast）→ ゲーム能力値」の変換を既に持っている外部の参照系。
//   こちらは同じ選手について実測（mlb_bridge の sprint_speed / arm_mph）を持っているので、
//   「実測 → ゲーム能力値」という変換の実例を、自作査定とは独立に観測できる。
//
// 注意（取得時の調査で判明・_manifest.json にも記録済み）:
//   - series_year は全カードが2017を返すレガシーフィールドで年度判別に使えない。年度はドメイン（mlb24等）で見る
//   - ovr は0-99、個別attributeは0-125（強化カードが99超に達するため）。実在選手の Live シリーズは実質0-99帯
//   - 同一選手が複数の年度・シリーズに登場するので、year+series を保持して後から選べるようにする

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'mlb_the_show');

/** 野手として意味のある能力だけを取り出す（投手専用の球速・制球などは別枠） */
const ATTRS = [
  'contact_left', 'contact_right', 'power_left', 'power_right',
  'plate_vision', 'plate_discipline', 'batting_clutch', 'bunting_ability',
  'hitting_durability', 'fielding_durability', 'fielding_ability',
  'arm_strength', 'arm_accuracy', 'reaction_time', 'blocking',
  'speed', 'baserunning_ability', 'baserunning_aggression',
];

/** 「Suzuki, Seiya」形式（mlb_bridge側）と「Seiya Suzuki」形式（The Show側）を突き合わせるキー */
export const nameKey = s => (s ?? '')
  .normalize('NFKC').toLowerCase()
  .replace(/[.'`’-]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** 「姓, 名」→「名 姓」へ寄せる。どちらの並びでも同じキーになるよう、語をソートして返す */
export const nameKeySorted = s => nameKey(s).replace(/,/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

if ((process.argv[1] ?? '').endsWith('parse_mlb_the_show.mjs')) {
  const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
  db.exec(`
    DROP TABLE IF EXISTS the_show_rating;
    CREATE TABLE the_show_rating (
      edition TEXT, uuid TEXT, name TEXT, name_key TEXT,
      team TEXT, series TEXT, ovr INTEGER, display_position TEXT,
      age INTEGER, bat_hand TEXT, throw_hand TEXT, is_hitter INTEGER,
      ${ATTRS.map(a => a + ' INTEGER').join(', ')}
    );
    CREATE INDEX idx_ts_name ON the_show_rating(name_key);
    CREATE INDEX idx_ts_ed ON the_show_rating(edition, series);
  `);

  const ins = db.prepare(`INSERT INTO the_show_rating
    (edition,uuid,name,name_key,team,series,ovr,display_position,age,bat_hand,throw_hand,is_hitter,${ATTRS.join(',')})
    VALUES (${Array(12 + ATTRS.length).fill('?').join(',')})`);

  let files = 0, rows = 0;
  const byEdition = {};
  db.exec('BEGIN');
  for (const f of readdirSync(RAW)) {
    if (!f.endsWith('.json.gz')) continue;
    const edition = f.split('_')[0];
    const j = JSON.parse(gunzipSync(readFileSync(path.join(RAW, f))).toString('utf8'));
    files++;
    for (const it of j.items ?? []) {
      ins.run(edition, it.uuid, it.name, nameKeySorted(it.name), it.team, it.series,
        it.ovr ?? null, it.display_position, it.age ?? null, it.bat_hand, it.throw_hand,
        it.is_hitter ? 1 : 0, ...ATTRS.map(a => it[a] ?? null));
      rows++;
      byEdition[edition] = (byEdition[edition] ?? 0) + 1;
    }
  }
  db.exec('COMMIT');

  // ---- mlb_bridge（NPB↔MLB実測の橋渡し79人）へ名寄せ ----
  // 同名が複数いる場合は結び付けない（間違った選手の実測を使うくらいなら欠損のまま＝仕様03 §1.3）
  db.exec(`
    DROP TABLE IF EXISTS the_show_bridge;
    CREATE TABLE the_show_bridge (
      proeye_id TEXT, npb_name TEXT, mlb_name TEXT, name_key TEXT,
      editions INTEGER, ovr_avg REAL,
      ${ATTRS.map(a => a + '_avg REAL').join(', ')},
      PRIMARY KEY (proeye_id)
    );
  `);
  const insB = db.prepare(`INSERT OR IGNORE INTO the_show_bridge
    (proeye_id,npb_name,mlb_name,name_key,editions,ovr_avg,${ATTRS.map(a => a + '_avg').join(',')})
    VALUES (${Array(6 + ATTRS.length).fill('?').join(',')})`);

  const bridge = db.prepare(`SELECT proeye_id, npb_name, npb_name_en, mlb_name FROM mlb_bridge`).all();
  // Live シリーズ（実在選手の現役カード）のみを対象にする。強化カードは実測との対応が壊れるため
  const pick = db.prepare(`
    SELECT COUNT(DISTINCT edition) editions, AVG(ovr) ovr_avg,
           ${ATTRS.map(a => `AVG(${a}) ${a}_avg`).join(', ')}
    FROM the_show_rating WHERE name_key=? AND series='Live' AND is_hitter=1`);
  const ambiguous = db.prepare(`
    SELECT COUNT(DISTINCT uuid) n FROM the_show_rating WHERE name_key=? AND series='Live' AND is_hitter=1`);

  let linked = 0, missing = 0;
  db.exec('BEGIN');
  for (const b of bridge) {
    const key = nameKeySorted(b.mlb_name || b.npb_name_en);
    const r = pick.get(key);
    if (!r || r.editions === 0 || r.ovr_avg == null) { missing++; continue; }
    insB.run(b.proeye_id, b.npb_name, b.mlb_name, key, r.editions, r.ovr_avg,
      ...ATTRS.map(a => r[a + '_avg'] ?? null));
    linked++;
  }
  db.exec('COMMIT');

  console.log(JSON.stringify({ files, rows, byEdition }, null, 2));
  console.log(`\nmlb_bridge 79人との名寄せ: ${linked}人 / 見つからず ${missing}人`);
  const live = db.prepare(`SELECT COUNT(*) c FROM the_show_rating WHERE series='Live'`).get().c;
  console.log(`Live シリーズ（実在選手の現役カード）: ${live} / 全 ${rows}`);
  db.close();
}

// 取得済みのNF3選手ページ（data/raw/nf3/**.gz）を解析してDBへ格納する。
//
// 取り出す表（Sol仕様の未充足項目に対応）:
//   月別成績        → 02 §9 疲労補正の実証
//   対左右別成績    → 05 §4 対左、02 §5.1 のTier A化（AVG_vsR）
//   ランナ−別成績  → 05 §3 チャンス（得点圏−非得点圏。RBIを使わない）
//   球場別成績      → 02 §6.4 球場係数
//   Home/Visitor別  → 球場係数の交絡（本拠地偏重）の確認用
//   打撃内容一覧    → 02 §7 弾道（打球タイプ）の外部照合
//
// 欠損は0で埋めない（仕様03 §1.3）。'-' や空欄は null にする。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'nf3');

/**
 * 互換漢字・全角空白のゆれを畳む（プロEYE球との突合に使う）。
 * NFKC正規化は「朗」U+F929 のような互換漢字を通常の字へ畳む（2026-08-01に炭谷銀仁朗で検出）。
 */
export const normName = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

/**
 * 外国人選手のイニシャルを落としたキー。
 * プロEYE球は「Ｒ．マクブルーム」、NF3は「マクブルーム」と書くため、
 * イニシャルを付けたままでは一致しない（NPB Basementの突合でも同じ手当てが要った）。
 */
export const normNameNoInitial = s => normName(s).replace(/^[A-Za-z]\.?/, '');

/** 取り出す表と、DBに入れる区分名 */
const SECTIONS = {
  '月別成績': 'month',
  '対左右別成績': 'hand',
  'ランナ−別成績': 'runner',
  'ランナー別成績': 'runner',
  '球場別成績': 'park',
  'Home/Visitor別成績': 'homeaway',
  'Day/Nighter別成績': 'daynight',
  '打撃内容一覧(フライはライナー・犠飛含む)': 'battedball',
};

/** 表ヘッダの日本語 → DBの列名。ここに無い列は raw に残す */
const COL = {
  '打率': 'avg', '試合': 'g', '打席': 'pa', '打数': 'ab', '得点': 'r', '安打': 'h',
  '２Ｂ': 'b2', '2塁': 'b2', '３Ｂ': 'b3', '3塁': 'b3', '本塁': 'hr', '塁打': 'tb',
  '打点': 'rbi', '三振': 'so', '四球': 'bb', '敬遠': 'ibb', '死球': 'hbp',
  '犠打': 'sh', '犠飛': 'sf', '盗塁': 'sb', '盗塁死': 'cs', '失策': 'e',
  '出塁率': 'obp', '長打率': 'slg', 'OPS': 'ops', '内安': 'ih',
};
const NUMCOLS = ['g', 'pa', 'ab', 'r', 'h', 'b2', 'b3', 'hr', 'tb', 'rbi', 'so', 'bb', 'ibb', 'hbp', 'sh', 'sf', 'sb', 'cs', 'e', 'ih'];
const RATECOLS = ['avg', 'obp', 'slg', 'ops'];

const strip = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
const num = s => {
  const t = strip(s);
  if (t === '' || t === '-' || t === '−' || t === '—') return null;
  const v = Number(t.replace(/,/g, ''));
  return Number.isFinite(v) ? v : null;
};

/** 1つの表を {title, header[], rows[[...]]} へ */
function parseTable(tableHtml) {
  const title = tableHtml.match(/<div class="Title">([\s\S]*?)<\/div>/)?.[1];
  if (!title) return null;
  const trs = tableHtml.split(/<tr/).slice(1);
  let header = null;
  const rows = [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(m => m[1]);
    if (!cells.length) continue;
    if (header === null) { header = cells.map(strip); continue; }
    rows.push(cells);
  }
  return { title: strip(title), header, rows };
}

/**
 * 打球方向の表を取り出す（2026-08-04追加、T-0093）。
 *
 * この表だけ他と構造が違う（colspanでヘッダが2段）ので、SECTIONS の一般処理では拾えず、
 * 長らく「引っ張り率は公開されていない」と誤って記録されていた。実際は取得済みのHTMLに
 * 最初から入っていた（P-00gの在庫チェックで発覚）。
 *
 *   <caption>打球方向(安打・本塁・凡打はそれぞれに対する割合)</caption>
 *   [左方向][中方向][右方向]            ← colspan=3 ずつ
 *   51.0%(52) | 20.6%(21) | 28.4%(29)   ← 方向ごとの合計
 *   安打|本塁|凡打 ×3                    ← 内訳のヘッダ
 *   55.6%(15) | -(0) | 49.3%(37) | ...  ← 9セル
 *
 * 割合ではなく**実数**を正とする（割合は分母が「安打全体」等で変わるため）。
 */
export function parseDirection(html) {
  const m = html.match(/<caption>\s*<div class="Title">打球方向[\s\S]*?<\/table>/);
  if (!m) return null;
  const block = m[0];
  // 「51.0%<br>(52)」「 - <br>(0)」から括弧内の実数だけを順に拾う
  const counts = [...block.matchAll(/\((\d+)\)/g)].map(x => Number(x[1]));
  if (counts.length < 12) return null; // 方向合計3 + 内訳9
  const [left, center, right] = counts.slice(0, 3);
  const [lh, lhr, lo, ch, chr, co, rh, rhr, ro] = counts.slice(3, 12);
  const total = left + center + right;
  if (!(total > 0)) return null;
  return {
    total,
    left, center, right,
    detail: {
      left: { hit: lh, hr: lhr, out: lo },
      center: { hit: ch, hr: chr, out: co },
      right: { hit: rh, hr: rhr, out: ro },
    },
  };
}

/**
 * 引っ張り方向の打球割合。右打ちの打者は左方向が引っ張り、左打ちは右方向。
 * 打席が左右どちらかを渡せない時は null（勝手に右打ちと仮定しない）。
 * @param {object} dir parseDirection の戻り値
 * @param {'右'|'左'|'両'|null} batHand
 */
export function pullRate(dir, batHand) {
  if (!dir || !(dir.total > 0)) return null;
  if (batHand === '右') return dir.left / dir.total;
  if (batHand === '左') return dir.right / dir.total;
  return null; // 両打ちは打席ごとに反転するので、この表からは決められない
}

/**
 * 守備位置と投打の左右（ページ見出しの「内野手 / 右投右打」から）。
 * 引っ張り率は打席の左右が分からないと決められないので、ここで一緒に取る。
 * これも取得済みHTMLに最初から入っていた（2026-08-04、T-0093の作業中に発見）。
 */
export function parseProfile(html) {
  const m = html.match(/([^<>|/]+?)\s*\/\s*([左右])投([左右両])打/);
  if (!m) return { position: null, throwHand: null, batHand: null };
  return { position: m[1].trim(), throwHand: m[2], batHand: m[3] };
}

/** 選手ページ1枚 → {meta, sections} */
export function parsePlayerPage(html) {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  // 例: 「プロ野球 ヌルデータ置き場f3 2023年度版  広島 - 打撃成績 00 曽根海成 - 」
  const m = title.match(/(\d{4})年度版\s*(.+?)\s*-\s*打撃成績\s*(\d+)\s+(.+?)\s*-\s*$/);
  if (!m) return null;
  const meta = { season: Number(m[1]), team: m[2].trim(), uniform: m[3], name: m[4].trim(), ...parseProfile(html) };

  const body = html.slice(html.indexOf('</section>'));
  const sections = {};
  for (const chunk of body.split(/<table/).slice(1)) {
    const t = parseTable(chunk);
    if (!t) continue;
    const key = SECTIONS[t.title];
    if (!key) continue;
    const idx = {};
    t.header.forEach((h, i) => { if (COL[h]) idx[COL[h]] = i; });
    sections[key] = t.rows.map(cells => {
      const rec = { label: strip(cells[0]) };
      for (const [c, i] of Object.entries(idx)) {
        rec[c] = RATECOLS.includes(c) ? num(cells[i]) : num(cells[i]);
      }
      // 対応表に無い列は残しておく（後から使えるように）
      const extra = {};
      t.header.forEach((h, i) => { if (!COL[h] && i > 0) extra[h] = strip(cells[i] ?? ''); });
      if (Object.keys(extra).length) rec._extra = extra;
      return rec;
    });
  }
  return { meta, sections, direction: parseDirection(html) };
}

// ---------------- ここから実行 ----------------
if ((process.argv[1] ?? '').endsWith('parse_nf3.mjs')) {
  const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
  db.exec(`
    DROP TABLE IF EXISTS nf3_split;
    CREATE TABLE nf3_split (
      season INTEGER, name TEXT, name_norm TEXT, team TEXT, uniform TEXT,
      section TEXT, label TEXT,
      ${[...NUMCOLS, ...RATECOLS].map(c => c + ' REAL').join(', ')},
      extra TEXT
    );
    CREATE INDEX idx_nf3_split ON nf3_split(season, name_norm, section);

    DROP TABLE IF EXISTS nf3_direction;
    CREATE TABLE nf3_direction (
      season INTEGER, name TEXT, name_norm TEXT, team TEXT,
      position TEXT, throw_hand TEXT, bat_hand TEXT, pull_rate REAL,
      total INTEGER, left_n INTEGER, center_n INTEGER, right_n INTEGER,
      left_hit INTEGER, left_hr INTEGER, left_out INTEGER,
      center_hit INTEGER, center_hr INTEGER, center_out INTEGER,
      right_hit INTEGER, right_hr INTEGER, right_out INTEGER,
      PRIMARY KEY (season, name_norm)
    );
  `);

  const ins = db.prepare(`INSERT INTO nf3_split
    (season,name,name_norm,team,uniform,section,label,${[...NUMCOLS, ...RATECOLS].join(',')},extra)
    VALUES (?,?,?,?,?,?,?,${[...NUMCOLS, ...RATECOLS].map(() => '?').join(',')},?)`);

  // 列名を明示する（VALUES だけだと列の増減で静かに壊れる。実際に16個と書いて落とした）
  const DIR_COLS = ['season', 'name', 'name_norm', 'team',
    'position', 'throw_hand', 'bat_hand', 'pull_rate',
    'total', 'left_n', 'center_n', 'right_n',
    'left_hit', 'left_hr', 'left_out',
    'center_hit', 'center_hr', 'center_out',
    'right_hit', 'right_hr', 'right_out'];
  const insDir = db.prepare(`INSERT OR REPLACE INTO nf3_direction (${DIR_COLS.join(',')})
    VALUES (${DIR_COLS.map(() => '?').join(',')})`);

  let files = 0, rows = 0, skipped = 0, dirRows = 0;
  const bySection = {};
  for (const year of readdirSync(RAW)) {
    const dir = path.join(RAW, year);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    db.exec('BEGIN');
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.gz')) continue;
      const html = gunzipSync(readFileSync(path.join(dir, f))).toString('utf8');
      const p = parsePlayerPage(html);
      if (!p) { skipped++; continue; }
      files++;
      if (p.direction) {
        const d = p.direction;
        insDir.run(p.meta.season, p.meta.name, normName(p.meta.name), p.meta.team,
          p.meta.position, p.meta.throwHand, p.meta.batHand, pullRate(d, p.meta.batHand),
          d.total, d.left, d.center, d.right,
          d.detail.left.hit, d.detail.left.hr, d.detail.left.out,
          d.detail.center.hit, d.detail.center.hr, d.detail.center.out,
          d.detail.right.hit, d.detail.right.hr, d.detail.right.out);
        dirRows++;
      }
      for (const [section, recs] of Object.entries(p.sections)) {
        for (const r of recs) {
          ins.run(p.meta.season, p.meta.name, normName(p.meta.name), p.meta.team, p.meta.uniform,
            section, r.label,
            ...[...NUMCOLS, ...RATECOLS].map(c => r[c] ?? null),
            r._extra ? JSON.stringify(r._extra) : null);
          rows++;
          bySection[section] = (bySection[section] ?? 0) + 1;
        }
      }
    }
    db.exec('COMMIT');
  }

  // ---- プロEYE球の選手IDへ名寄せ ----
  // 完全一致 → 外国人のイニシャルを落とした一致、の順。同名が複数いる場合は**結び付けない**
  // （間違った選手の分割成績を使うくらいなら、無いままにする＝仕様03 §1.3 の欠損の扱い）
  db.exec(`
    DROP TABLE IF EXISTS nf3_link;
    CREATE TABLE nf3_link (season INTEGER, name_norm TEXT, proeye_id TEXT, proeye_name TEXT, method TEXT,
      PRIMARY KEY (season, name_norm));
  `);
  const insLink = db.prepare(`INSERT OR IGNORE INTO nf3_link VALUES (?,?,?,?,?)`);

  const seasons = db.prepare(`SELECT DISTINCT season FROM nf3_split`).all().map(r => r.season);
  const linkStat = { exact: 0, no_initial: 0, ambiguous: 0, missing: 0 };
  db.exec('BEGIN');
  for (const season of seasons) {
    const pe = db.prepare(`SELECT player_id, name FROM v_batting WHERE season=?`).all(season);
    const exact = new Map(), noInit = new Map();
    for (const r of pe) {
      exact.set(normName(r.name), r);
      const k = normNameNoInitial(r.name);
      if (!noInit.has(k)) noInit.set(k, []);
      noInit.get(k).push(r);
    }
    for (const { name_norm } of db.prepare(`SELECT DISTINCT name_norm FROM nf3_split WHERE season=?`).all(season)) {
      const e = exact.get(name_norm);
      if (e) { insLink.run(season, name_norm, e.player_id, e.name, 'exact'); linkStat.exact++; continue; }
      const c = noInit.get(normNameNoInitial(name_norm));
      if (c?.length === 1) { insLink.run(season, name_norm, c[0].player_id, c[0].name, 'no_initial'); linkStat.no_initial++; continue; }
      if (c?.length > 1) linkStat.ambiguous++; else linkStat.missing++;
    }
  }
  db.exec('COMMIT');

  console.log(JSON.stringify({ files, rows, skipped, dirRows, bySection }, null, 2));
  console.log('\n区分ごとの選手数:');
  for (const r of db.prepare(`SELECT section, COUNT(DISTINCT season||name_norm) players, COUNT(*) rows FROM nf3_split GROUP BY section ORDER BY section`).all()) {
    console.log(`  ${r.section.padEnd(11)} 選手${String(r.players).padStart(5)}  行${String(r.rows).padStart(6)}`);
  }
  const tot = Object.values(linkStat).reduce((a, b) => a + b, 0);
  console.log(`\nプロEYE球との名寄せ: 完全一致${linkStat.exact} + イニシャル落とし${linkStat.no_initial}`
    + ` = ${linkStat.exact + linkStat.no_initial}/${tot} (${((linkStat.exact + linkStat.no_initial) / tot * 100).toFixed(1)}%)`);
  console.log(`  同名が複数で結び付けず ${linkStat.ambiguous} / プロEYE球側に無い ${linkStat.missing}`);
  db.close();
}

// baseless.org の保存HTMLから、選手ごとの基礎能力7と特殊能力を取り出してDBへ入れる。
//
// HTMLの構造（実物を読んで確認。**推測で2回外したので実ブロックを逐語で確認して確定**、2026-08-04）:
//   <p id=sN>
//     <b class="nm i">中　野</b>   … class は**守備位置**（p/pr/r/rp=投手、c=捕手、i=内野、o=外野、io/oi/coi等=兼任）
//                                     ※当初「p=野手」と誤読して投手ばかり取っていた
//     <b id=bN class="cb">         … 基礎能力。c1..c7 = 弾道/ミート/パワー/走力/肩力/守備力/捕球、c8=守備位置
//       <b class="c2 w"><b></b><i class="c">63</i></b>   … i のテキストが値。class(a/b/c…)は色分けで値ではない
//     <b id=dN class="cb">         … **これは守備適性の表で、c4/c5/c7が再掲される**。b45 と d45 の両方に
//                                     マッチしてしまうため、id=bN（dでない）だけを拾う必要がある
//     <b id=baN class="ab">        … 特殊能力
//       <b class="l">  … ランク付き: <b class="P"><b>送球</b><b>A</b></b>（Pは良い、Nは普通/悪い）
//       <b class="n">  … 無印: <b class="P">カット打ち</b>（青・金） / <b class="M">…</b>（赤）
//       <b class="y">  … 起用法（能力ではない）
//   1球団70人中、野手は約33人。
//
// 注意: class="P"=プラス（青・金）、class="M"=マイナス（赤）。この区別が
// 「青得能が多い→基礎能力を下げる／赤得能が多い→上げる」（仕様05 §2）の判定に要る。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'baseless');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const TEAM_BY_CODE = {
  G: '読売ジャイアンツ', T: '阪神タイガース', BA: '横浜DeNAベイスターズ', D: '中日ドラゴンズ',
  S: '東京ヤクルトスワローズ', C: '広島東洋カープ', H: '福岡ソフトバンクホークス',
  OBU: 'オリックス・バファローズ', M: '千葉ロッテマリーンズ', E: '東北楽天ゴールデンイーグルス',
  F: '北海道日本ハムファイターズ', L: '埼玉西武ライオンズ',
};

const strip = s => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
const normName = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

db.exec(`DROP TABLE IF EXISTS pawapuro_full`);
db.exec(`CREATE TABLE pawapuro_full (
  work TEXT, team TEXT, slot INTEGER, name TEXT, name_norm TEXT,
  trajectory INTEGER, meet INTEGER, power INTEGER, speed INTEGER,
  arm INTEGER, fielding INTEGER, catching INTEGER,
  ranked_json TEXT,      -- ランク付き特殊能力 {"チャンス":"C","送球":"C"}
  plus_json TEXT,        -- 無印プラス（青・金）["カット打ち","バント○",...]
  minus_json TEXT,       -- 無印マイナス（赤）
  n_ranked INTEGER, n_plus INTEGER, n_minus INTEGER)`);
const ins = db.prepare(`INSERT INTO pawapuro_full VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

let files = 0, players = 0;
const perWork = {};

db.exec('BEGIN');
for (const fn of readdirSync(RAW).filter(f => f.endsWith('.htm.gz'))) {
  const [work, codeRaw] = fn.replace('.htm.gz', '').split('_');
  const code = codeRaw;
  const team = TEAM_BY_CODE[code];
  if (!team) continue;
  files++;
  const html = gunzipSync(readFileSync(path.join(RAW, fn))).toString('utf8');

  // 選手ブロックを id=sN で分割
  const blocks = html.split(/<p id=s(\d+)>/).slice(1);
  for (let i = 0; i < blocks.length; i += 2) {
    const slot = Number(blocks[i]);
    const body = blocks[i + 1] ?? '';

    // 名前と守備位置。class は守備位置で、p/pr/r/rp が投手（本PJの査定対象は野手のみ）
    const nm = body.match(/<b class="nm ([a-z]+)">([^<]+)<\/b>/);
    if (!nm) continue;
    const pos = nm[1];
    if (/^(p|pr|r|rp)$/.test(pos)) continue;       // 投手を除外
    const name = strip(nm[2]);
    if (!name) continue;

    // 基礎能力7: **id=bN のブロックだけ**（id=dN は守備適性の再掲なので拾わない）
    const cb = body.match(/<b id=b\d+ class="cb">([\s\S]*?)<b id=[a-z]+\d+/);
    if (!cb) continue;
    const vals = {};
    for (const m of cb[1].matchAll(/<b class="c(\d) w"><b><\/b><i[^>]*>([^<]*)<\/i>/g)) {
      const v = Number(strip(m[2]));
      if (Number.isFinite(v)) vals[Number(m[1])] = v;
    }
    const [traj, meet, power, speed, arm, fld, cat] = [1, 2, 3, 4, 5, 6, 7].map(k => vals[k] ?? null);
    if (meet == null || power == null) continue;   // 能力が読めない行は捨てる（0で埋めない）

    // 特殊能力: id=baN のブロック
    const ab = body.match(/<b id=ba\d+ class="ab">([\s\S]*)$/);
    const ranked = {}, plus = [], minus = [];
    if (ab) {
      const seg = ab[1];
      // ランク付き（class="l" の中）: <b class="P"><b>送球</b><b>A</b></b>
      // **2013年だけランクが数字**（<b>チャンス</b><b>4</b>）なので A-G と数字の両方を受ける
      // （当初 [A-G] だけにして2013の411人全員がランク付き0になっていた。2026-08-04に発見）
      const lSeg = seg.match(/<b class="l">([\s\S]*?)<b class="n">/);
      if (lSeg) {
        for (const m of lSeg[1].matchAll(/<b class="[PNM]"><b>([^<]+)<\/b><b>([A-G]|\d+)<\/b><\/b>/g)) ranked[strip(m[1])] = m[2];
      }
      // 無印（class="n" の中）: <b class="P">カット打ち</b> / <b class="M">…</b>
      const nSeg = seg.match(/<b class="n">([\s\S]*?)<b class="y">/);
      if (nSeg) {
        for (const m of nSeg[1].matchAll(/<b class="([PM])">([^<]+)<\/b>/g)) {
          (m[1] === 'P' ? plus : minus).push(strip(m[2]));
        }
      }
    }

    ins.run(work, team, slot, name, normName(name), traj, meet, power, speed, arm, fld, cat,
      JSON.stringify(ranked), JSON.stringify(plus), JSON.stringify(minus),
      Object.keys(ranked).length, plus.length, minus.length);
    players++;
    perWork[work] = (perWork[work] ?? 0) + 1;
  }
}
db.exec('COMMIT');

console.log(`${files}ファイル / 野手 ${players}人`);
console.log('作品別:');
for (const w of Object.keys(perWork).sort()) console.log(`  ${w}: ${perWork[w]}人`);

const chk = db.prepare(`SELECT
  COUNT(*) n,
  SUM(CASE WHEN n_ranked>0 THEN 1 ELSE 0 END) with_ranked,
  SUM(CASE WHEN n_plus>0 THEN 1 ELSE 0 END) with_plus,
  SUM(CASE WHEN n_minus>0 THEN 1 ELSE 0 END) with_minus,
  ROUND(AVG(n_ranked),2) avg_ranked, ROUND(AVG(n_plus),2) avg_plus, ROUND(AVG(n_minus),2) avg_minus
  FROM pawapuro_full`).get();
console.log('\n特殊能力の付き方:', JSON.stringify(chk));

console.log('\n実例（阪神2024の上位3人）:');
for (const r of db.prepare(`SELECT name,trajectory,meet,power,speed,arm,fielding,catching,ranked_json,plus_json,minus_json
  FROM pawapuro_full WHERE work='2024' AND team='阪神タイガース' ORDER BY meet DESC LIMIT 3`).all()) {
  console.log(`  ${r.name}: 弾${r.trajectory} ミ${r.meet} パ${r.power} 走${r.speed} 肩${r.arm} 守${r.fielding} 捕${r.catching}`);
  console.log(`    ランク付き: ${r.ranked_json}`);
  console.log(`    青/金: ${r.plus_json}`);
  console.log(`    赤: ${r.minus_json}`);
}
db.close();

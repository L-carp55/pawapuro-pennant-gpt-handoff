// 1球データから「盗塁がどの捕手のときに起きたか」を集める。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//   This uses data sourced from the Nippon Baseball Data Repository.
//
// なぜ要るか（2026-08-05）:
//   捕手の守備力は現在**全員null**。原因は材料不足ではなく、仕様が定義していない材料
//   （守備範囲＝RngR、捕手には存在しない）の式を当てていたこと。
//   仕様04 §10.2 は捕手の守備力を「**捕球からリリースまでの速さ、動作**」と定めており、
//   §10.3 は `CS_result ~ catcher_arm + catcher_exchange + pitcher_quick + runner_speed` の形を挙げている。
//   その材料になるのが盗塁の1件ごとの記録で、1球データにしか無い。
//
// ★盗塁阻止率をそのまま肩力にしてはいけない（仕様04 §10「阻止率をそのまま肩へ変換しない」）。
//   阻止率には (a)捕手の肩 (b)持ち替えの速さ (c)投手のクイック (d)走者の足 (e)投球コース が混ざる。
//   分離の道筋: (a)は NPB+ の送球速度が実測で取れている（別途取得済み・捕手14人）。
//   阻止率から (a) で説明できる分を引いた残差が (b)＝仕様が言う「捕球からリリースまでの速さ」に近い。
//   (c)(d) は、同じ捕手が受けた投手・走者の顔ぶれで調整する。本スクリプトはその材料を1件ずつ残す。
//
// 拾い方の要点:
//   盗塁の記述がある行には**捕手名が入っていない**（守備陣の列が空になる）。
//   同じ試合・同じイニング内で直近に観測された捕手を引き継ぐ。
//   実測（2025年5月）: 盗塁231件すべてで捕手を特定でき、取りこぼし0件。
//
// 使い方: node scripts/build_catcher_steal_events.mjs [年...]（省略時は取得済みの全年）

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'npb_pbp');

/** 引用符つきCSVの1行を列へ */
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

if (!existsSync(RAW)) {
  console.error(`1球データがありません: ${path.relative(ROOT, RAW)}`);
  console.error('先に node scripts/fetch_npb_pbp.mjs <年> を実行してください');
  process.exit(1);
}

const years = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [...new Set(readdirSync(RAW).filter(f => f.endsWith('_pbp.csv')).map(f => f.slice(0, 4)))].sort();

const files = readdirSync(RAW)
  .filter(f => f.endsWith('_pbp.csv') && years.includes(f.slice(0, 4)))
  .sort();

const events = [];
let noCatcher = 0;

for (const fn of files) {
  const lines = readFileSync(path.join(RAW, fn), 'utf8').split('\n');
  const hdr = splitCsvLine(lines[0]);
  const I = name => hdr.indexOf(name);
  const iSeason = I('season'), iGame = I('game_id'), iDate = I('game_date'), iInn = I('inning');
  const iDesc = I('description_jap'), iCatcher = I('fielder_2_name'), iPitcher = I('fielder_1_name');
  const iOn1 = I('on_1b_name'), iOn2 = I('on_2b_name'), iType = I('game_type_name');

  let lastCatcher = '', lastPitcher = '', lastKey = '';

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = splitCsvLine(lines[i]);
    const key = `${c[iGame]}|${c[iInn]}`;

    // 守備陣が入っている行で覚えておく（盗塁の行では空になる）
    if (c[iCatcher]) { lastCatcher = c[iCatcher]; lastPitcher = c[iPitcher] ?? ''; lastKey = key; }

    const d = c[iDesc] ?? '';
    if (!/盗塁/.test(d)) continue;
    // 「盗塁死」「盗塁を試みるもアウト」は阻止。それ以外の「盗塁成功」は許した
    const caught = /アウト|刺|失敗|盗塁死/.test(d);

    if (!(key === lastKey && lastCatcher)) { noCatcher++; continue; }

    // ★捕手の能力として使えるかの印を、捨てずに列で持つ（後から条件を変えられるように）。
    //   (a) 牽制で誘い出された盗塁失敗は**投手の牽制**であって捕手の送球ではない（実測143件）
    //   (b) 三盗は送球距離が違う（本塁→二塁と本塁→三塁で別物）。二盗だけが
    //       仕様04 §10.2 の Pop Time（本塁→二塁）と同じ土俵
    //
    //   ★判定の誤りを1度踏んだ（2026-08-05）: 最初は結果の塁状況（"2,3塁"・"二三塁"）を
    //     三盗の印と読んで除外したが、これは**一塁走者が二塁へ盗塁して結果2,3塁になった**
    //     二盗そのものだった。除外側の阻止率が11.6%と異常に低いことで気づいた
    //     （成功例ばかり誤除外していた）。判定は**走者の出発地**だけで行う。
    const fromPickoff = /けん制|牽制/.test(d) ? 1 : 0;
    // 「一塁走者が」始めた盗塁＝二盗。「二塁走者が」なら三盗。両方あれば重盗
    const runnerFrom1 = /一塁走者/.test(d);
    const runnerFrom2 = /二塁走者/.test(d);
    const isSecondOnly = (runnerFrom1 && !runnerFrom2) ? 1 : 0;

    events.push({
      season: Number(c[iSeason]), game_id: c[iGame], game_date: c[iDate],
      game_type: c[iType] ?? null, inning: c[iInn],
      catcher: lastCatcher, pitcher: lastPitcher || null,
      runner_1b: c[iOn1] || null, runner_2b: c[iOn2] || null,
      caught: caught ? 1 : 0,
      from_pickoff: fromPickoff,
      second_base_only: isSecondOnly,
      description: d.slice(0, 120),
    });
  }
  console.error(`  ${fn}: 累計 ${events.length}件`);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
db.exec(`DROP TABLE IF EXISTS catcher_steal_event`);
db.exec(`CREATE TABLE catcher_steal_event (
  season INTEGER, game_id TEXT, game_date TEXT, game_type TEXT, inning TEXT,
  catcher TEXT, pitcher TEXT, runner_1b TEXT, runner_2b TEXT,
  caught INTEGER, from_pickoff INTEGER, second_base_only INTEGER, description TEXT)`);
const ins = db.prepare(`INSERT INTO catcher_steal_event VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
db.exec('BEGIN');
for (const e of events) {
  ins.run(e.season, e.game_id, e.game_date, e.game_type, e.inning,
    e.catcher, e.pitcher, e.runner_1b, e.runner_2b, e.caught,
    e.from_pickoff, e.second_base_only, e.description);
}
db.exec('COMMIT');
db.exec(`CREATE INDEX idx_cse_catcher ON catcher_steal_event(catcher, season)`);

const total = events.length;
const caught = events.filter(e => e.caught).length;
const catchers = new Set(events.map(e => e.catcher)).size;
console.log(`\n盗塁の記録: ${total}件（${years.join(', ')}年）`);
console.log(`  阻止 ${caught}件 / 許した ${total - caught}件  → リーグ全体の阻止率 ${(caught / total * 100).toFixed(1)}%`);
console.log(`  捕手 ${catchers}人`);
console.log(`  捕手を特定できなかった: ${noCatcher}件`);

// 捕手の能力として使える範囲（二盗のみ・牽制由来を除く）を別に出す。
// 混ざったまま使うと、投手の牽制と三盗の送球距離差が捕手の肩に化ける
const clean = events.filter(e => e.second_base_only && !e.from_pickoff);
const cleanCaught = clean.filter(e => e.caught).length;
console.log(`
★捕手の能力に使える範囲（二盗のみ・牽制由来を除く）: ${clean.length}件`);
console.log(`  阻止率 ${(cleanCaught / clean.length * 100).toFixed(1)}%  （混ぜた場合は ${(caught / total * 100).toFixed(1)}%）`);
console.log(`  除外の内訳: 牽制由来 ${events.filter(e => e.from_pickoff).length}件 ／ 三盗・重盗 ${events.filter(e => !e.second_base_only).length}件`);
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

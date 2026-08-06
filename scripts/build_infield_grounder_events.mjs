// 内野ゴロを1件ずつ取り出す。「深い位置から一塁へ刺せるか」を測るための材料（T-0101）。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//   This uses data sourced from the Nippon Baseball Data Repository.
//
// なぜ要るか（2026-08-05）:
//   内野手の肩力は、いま「どの位置を守れるか」からの推定だけで作っている。
//   実測で答え合わせすると、自作は遊撃手5人が69.7〜72.1とほぼ横並びなのに、
//   実際の遠投成功率は60.7〜80.0%と幅があった（順位の一致 -0.10＝当てずっぽう）。
//   全員が遊撃手なら全員同じ値になる作りなので当然で、差をつける材料が要る。
//
//   1球データには打球の落ちた位置（hc_x, hc_y）と、処理した野手と、結果が入っている。
//   **同じ位置の打球を、誰がアウトにできて誰ができなかったか** を並べれば、
//   守備位置に頼らずに個人差を測れる。深い位置ほど強い送球が要るので、肩に効く。
//
// 絞り込みの理由:
//   走者なしの場面だけを使う。走者がいると、どの塁へ投げるか・併殺を狙うかで
//   難しさが変わり、打者を一塁で刺せたかだけを見られなくなる。
//   フライは送球が要らないので除く。投手・捕手が処理したものも除く（送球の距離が違う）。
//
// 交絡（この段階では分離しない。次の工程でやる）:
//   打者走者の足。足の速い打者ほど内野安打になりやすいので、そのまま集計すると
//   「足の速い打者と多く対戦した野手」が不当に低く出る。
//
// 使い方: node scripts/build_infield_grounder_events.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'npb_pbp');

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

if (!existsSync(RAW)) { console.error('1球データがありません'); process.exit(1); }
const files = readdirSync(RAW).filter(f => f.endsWith('_pbp.csv')).sort();
const REGULAR = new Set(['1', '2', '26']);
// 一・二・三・遊（投手と捕手は送球の距離が違うので除く）。
// ★守備位置の書き方が年で違う——2023年以前は「6」、2024年以降は「6.0」。
//   文字列で比べると2023年以前が丸ごと落ちる（実際に一度落として、
//   2024年以降しか出ないのを見て気づいた）。数値にしてから比べる。
const POS = { 1: '1B', 2: '2B', 3: '3B', 4: 'SS' };   // 3→1B, 4→2B, 5→3B, 6→SS
const posOf = v => POS[Number(v) - 2];                 // 3..6 を 1..4 へ寄せて引く

const norm = s => (s ?? '').replace(/[\s　]/g, '');
const events = [];
const skipped = { フライ系: 0, 走者あり: 0, 位置なし: 0, 野手なし: 0, 判定不能: 0 };

for (const fn of files) {
  const lines = readFileSync(path.join(RAW, fn), 'utf8').split('\n');
  const hdr = splitCsvLine(lines[0]);
  const I = n => hdr.indexOf(n);
  const c = {
    season: I('season'), game: I('game_id'), inn: I('inning'), ab: I('inning_ab_num'),
    type: I('game_type_id'), batter: I('PlayInfo_PlayerName'), park: I('stadium_name'),
    hx: I('hc_x'), hy: I('hc_y'), hl: I('hit_location'), fielder: I('fielder_name'),
    desc: I('description_jap'), on1: I('on_1b'), on2: I('on_2b'), on3: I('on_3b'),
    hand: I('batter_hand'), date: I('game_date'),
  };
  // 打席の最後の1球＝その打席の結果
  const last = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = splitCsvLine(lines[i]);
    if (!REGULAR.has(r[c.type])) continue;
    last.set(`${r[c.game]}|${r[c.inn]}|${r[c.ab]}`, r);
  }
  for (const r of last.values()) {
    const hasRunner = !!(r[c.on1] || r[c.on2] || r[c.on3]);
    const pos = posOf(r[c.hl]);
    if (!pos) continue;
    const d = (r[c.desc] ?? '').replace(/^\d+球目:/, '');
    // 送球の要らない打球を落とす
    if (/フライ|ライナー|ファウル|直撃|バント/.test(d)) { skipped.フライ系++; continue; }
    // ★2026-08-05修理: 失策が丸ごと抜けていた。表記が「村林(遊)の悪送球により出塁する」で
    //   「ゴロ」も「失策」も含まないため、条件に一度も引っかかっていなかった。
    //   悪送球は**送球の正確さ**そのもので、切り分けたい成分の中心。
    if (!/ゴロ|内野安打|エラー|失策|悪送球|野選|フィルダースチョイス/.test(d)) { skipped.判定不能++; continue; }
    if (!r[c.hx] || !r[c.hy]) { skipped.位置なし++; continue; }
    if (!r[c.fielder]) { skipped.野手なし++; continue; }

    // 結果を成分に分ける（オーナー指示 2026-08-05「守備力の要素を切り分ける」）:
    //   out        … 打者を一塁でアウトにした
    //   infield_hit… 間に合わなかった（守備範囲・打者の足・送球の速さ）
    //   throw_error… 悪送球で出塁させた（送球の正確さ）
    //   other_miss … エラー・野選など、上のどちらとも言い切れないもの
    const isThrowError = /悪送球/.test(d);
    const isOtherMiss = !isThrowError && /エラー|失策|野選|フィルダースチョイス/.test(d);
    const isInfieldHit = /内野安打/.test(d);
    const out = (!isThrowError && !isOtherMiss && !isInfieldHit && /ゴロ/.test(d)) ? 1 : 0;
    const kind = out ? 'out' : (isThrowError ? 'throw_error' : (isInfieldHit ? 'infield_hit' : 'other_miss'));

    // ★走者ありは除く（2026-08-05に一度足して、戻した）:
    //   総合値（アウトにできたか）は走者がいると判定が濁る——併殺を狙うのか、
    //   打者を刺すのか、どの塁へ投げるかで難しさが変わるため。
    //   一方「悪送球かどうか」は走者の有無に依らず同じ判定ができるので、**悪送球だけ**
    //   走者ありも足してみた（276→427件、1.55倍）。だがこれは誤りだった——
    //   **分子（悪送球）だけ増えて分母（その野手が処理した打球）が増えないので率が歪む**。
    //   実際、再現性は100件以上で0.156→0.084、150件以上で0.237→0.058と一貫しない動きになった。
    //   正しくやるには走者ありの全打球を分母に入れる必要があり、それは上の除外理由と衝突する。
    //   件数1.55倍のために設計を複雑にする価値は薄いと判断して戻した。
    //
    //   なお件数を増やす他の道は無い——1球データは2020年からしか公開されていない
    //   （2019年以前は取得元にHEADリクエストで404を確認済み）。
    if (hasRunner) { skipped.走者あり++; continue; }
    events.push({
      season: Number(r[c.season]), date: r[c.date], park: r[c.park],
      batter: r[c.batter], batter_norm: norm(r[c.batter]), bats: r[c.hand],
      fielder: r[c.fielder], fielder_norm: norm(r[c.fielder]), pos,
      hc_x: Number(r[c.hx]), hc_y: Number(r[c.hy]), is_out: out, kind, has_runner: hasRunner?1:0,
      description: d.slice(0, 60),
    });
  }
  console.error(`  ${fn}`);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
db.exec(`DROP TABLE IF EXISTS infield_grounder_events`);
db.exec(`CREATE TABLE infield_grounder_events (
  season INTEGER, date TEXT, park TEXT,
  batter TEXT, batter_norm TEXT, bats TEXT,
  fielder TEXT, fielder_norm TEXT, pos TEXT,
  hc_x REAL, hc_y REAL, is_out INTEGER, kind TEXT, has_runner INTEGER, description TEXT)`);
const ins = db.prepare(`INSERT INTO infield_grounder_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
db.exec('BEGIN');
for (const e of events) ins.run(e.season, e.date, e.park, e.batter, e.batter_norm, e.bats,
  e.fielder, e.fielder_norm, e.pos, e.hc_x, e.hc_y, e.is_out, e.kind, e.has_runner, e.description);
db.exec('COMMIT');
db.exec(`CREATE INDEX idx_ige_f ON infield_grounder_events(fielder_norm, season)`);
db.exec(`CREATE INDEX idx_ige_b ON infield_grounder_events(batter_norm, season)`);

console.log(`\n内野ゴロ（走者なし）: ${events.length.toLocaleString()}件`);
console.log(`  除いたもの: ${Object.entries(skipped).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(' / ')}`);
const bySeason = {};
for (const e of events) bySeason[e.season] = (bySeason[e.season] ?? 0) + 1;
console.log(`  年別: ${Object.entries(bySeason).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(' / ')}`);
const byPos = {};
for (const e of events) { byPos[e.pos] ??= { n: 0, out: 0 }; byPos[e.pos].n++; byPos[e.pos].out += e.is_out; }
console.log('  守備位置別（アウト率）:');
for (const [p, v] of Object.entries(byPos)) console.log(`    ${p}  ${String(v.n).padStart(6)}件  ${(v.out / v.n * 100).toFixed(1)}%`);
const byKind={};for(const e of events)byKind[e.kind]=(byKind[e.kind]??0)+1;
console.log('  結果の内訳: ' + Object.entries(byKind).map(([k,v])=>k+' '+v.toLocaleString()).join(' / '));
console.log(`  野手 ${new Set(events.map(e => e.fielder_norm)).size}人 / 打者 ${new Set(events.map(e => e.batter_norm)).size}人`);
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

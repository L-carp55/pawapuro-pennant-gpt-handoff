// 走塁の実測を1球データから自分で作る。「単打で一塁から三塁まで行けたか」など。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//
// オーナー指示（2026-08-05）:
//   「1球ごとのデータがあるのなら指標自体を一から作ったり、既存の指標で収集できないが
//     計算方法や計算式が公開されているものと参照して計算するのもありだと思います」
//
// なぜ走塁か:
//   仕様04 §1.2は走力の第3階層に「追加進塁率」を挙げているが、日本では公開されていない。
//   盗塁は走力と混ぜない規律があり（開発原則）、三塁打・内野安打は打撃の要素が混ざる。
//   **単打で一塁から三塁まで行けたか**は、打球の行方を揃えれば走る速さと判断だけが残る。
//   MLBでは First-to-Third% として標準的に使われている指標。
//
// 測り方:
//   打席の開始時点の走者（on_1b/on_2b/on_3b）は各打席の行に入っている。
//   **次の打席の開始時点**と見比べれば、その打席で走者がどこまで進んだかが分かる。
//   イニングが変わる・試合が終わる場合は追えないので除く。
//
// 数える型:
//   1st→3rd  … 一塁に走者、二塁三塁が空、打者が単打。その走者が三塁へ行ったか（本塁生還も成功）
//   2nd→home … 二塁に走者、三塁が空、打者が単打。その走者が生還したか
//   1st→home … 一塁に走者、打者が二塁打。その走者が生還したか
//
// 交絡（この時点では分離しない）:
//   打球の方向と深さ。右前打なら三塁は難しく、左前打なら易しい。
//   打球位置（hc_x/hc_y）を持っているので、次の工程で揃える。
//
// 使い方: node scripts/build_baserunning_advances.mjs

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
const norm = s => (s ?? '').replace(/[\s　]/g, '');
const events = [];

for (const fn of files) {
  const lines = readFileSync(path.join(RAW, fn), 'utf8').split('\n');
  const hdr = splitCsvLine(lines[0]);
  const I = n => hdr.indexOf(n);
  const c = {
    season: I('season'), game: I('game_id'), inn: I('inning'), ab: I('inning_ab_num'),
    type: I('game_type_id'), state: I('game_state_name'), desc: I('description_jap'),
    on1: I('on_1b'), on1n: I('on_1b_name'), on2: I('on_2b'), on2n: I('on_2b_name'),
    on3: I('on_3b'), on3n: I('on_3b_name'), outs: I('outs_when_up'),
    hx: I('hc_x'), hy: I('hc_y'), hl: I('hit_location'), park: I('stadium_name'),
  };
  // 打席ごとの最終行を、試合・イニング・打席番号の順に並べる
  const last = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = splitCsvLine(lines[i]);
    if (!REGULAR.has(r[c.type])) continue;
    last.set(`${r[c.game]}|${r[c.inn]}|${r[c.state]}|${String(r[c.ab]).padStart(3, '0')}`, r);
  }
  const keys = [...last.keys()].sort();
  for (let i = 0; i < keys.length - 1; i++) {
    const cur = last.get(keys[i]), nxt = last.get(keys[i + 1]);
    // 同じ試合・同じイニング・同じ攻撃（表裏）の中でだけ比べる
    const [g1, in1, st1] = keys[i].split('|'), [g2, in2, st2] = keys[i + 1].split('|');
    if (g1 !== g2 || in1 !== in2 || st1 !== st2) continue;

    const d = (cur[c.desc] ?? '').replace(/^\d+球目:/, '');
    const isSingle = /ヒット|内野安打|安打/.test(d) && !/二塁打|三塁打|本塁打|ホームラン|タイムリーツーベース/.test(d);
    const isDouble = /二塁打|ツーベース/.test(d);
    if (!isSingle && !isDouble) continue;

    const r1 = norm(cur[c.on1n]), r2 = norm(cur[c.on2n]), r3 = norm(cur[c.on3n]);
    const n1 = norm(nxt[c.on1n]), n2 = norm(nxt[c.on2n]), n3 = norm(nxt[c.on3n]);
    const stillOnBase = who => [n1, n2, n3].includes(who);

    const push = (kind, runner) => events.push({
      season: Number(cur[c.season]), park: cur[c.park], kind, runner, runner_norm: runner,
      outs: Number(cur[c.outs] ?? 0),
      hc_x: cur[c.hx] ? Number(cur[c.hx]) : null, hc_y: cur[c.hy] ? Number(cur[c.hy]) : null,
      hit_location: cur[c.hl] ? Number(cur[c.hl]) : null,
      description: d.slice(0, 60),
    });

    // 一塁走者のみ × 単打 → 三塁まで行けたか
    if (isSingle && r1 && !r2 && !r3) {
      const e = { ...{}, };
      const reached3 = (n3 === r1);
      const scored = !stillOnBase(r1);          // 塁上にいない＝生還した（アウトの可能性は下で除く）
      const stopped2 = (n2 === r1);
      if (reached3 || scored || stopped2) {
        push('1st_to_3rd', r1);
        events[events.length - 1].success = (reached3 || scored) ? 1 : 0;
      }
    }
    // 二塁走者のみ × 単打 → 生還できたか
    if (isSingle && r2 && !r3) {
      const scored = !stillOnBase(r2);
      const stopped3 = (n3 === r2);
      if (scored || stopped3) {
        push('2nd_to_home', r2);
        events[events.length - 1].success = scored ? 1 : 0;
      }
    }
    // 一塁走者 × 二塁打 → 生還できたか
    if (isDouble && r1 && !r2 && !r3) {
      const scored = !stillOnBase(r1);
      const stopped3 = (n3 === r1);
      if (scored || stopped3) {
        push('1st_to_home_on_2b', r1);
        events[events.length - 1].success = scored ? 1 : 0;
      }
    }
  }
  console.error(`  ${fn}`);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
db.exec(`DROP TABLE IF EXISTS baserunning_advances`);
db.exec(`CREATE TABLE baserunning_advances (
  season INTEGER, park TEXT, kind TEXT, runner TEXT, runner_norm TEXT,
  outs INTEGER, success INTEGER, hc_x REAL, hc_y REAL, hit_location INTEGER, description TEXT)`);
const ins = db.prepare(`INSERT INTO baserunning_advances VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
db.exec('BEGIN');
for (const e of events) ins.run(e.season, e.park, e.kind, e.runner, e.runner_norm,
  e.outs, e.success ?? 0, e.hc_x, e.hc_y, e.hit_location, e.description);
db.exec('COMMIT');
db.exec(`CREATE INDEX idx_bra ON baserunning_advances(runner_norm, season)`);

console.log(`\n走塁の機会: ${events.length.toLocaleString()}件`);
const byKind = {};
for (const e of events) {
  byKind[e.kind] ??= { n: 0, s: 0 };
  byKind[e.kind].n++; byKind[e.kind].s += (e.success ?? 0);
}
console.log('型ごとの成功率:');
const LABEL = { '1st_to_3rd': '単打で一塁→三塁', '2nd_to_home': '単打で二塁→生還', '1st_to_home_on_2b': '二塁打で一塁→生還' };
for (const [k, v] of Object.entries(byKind)) {
  console.log(`  ${(LABEL[k] ?? k).padEnd(20)} ${String(v.n).padStart(6)}件  成功 ${(v.s / v.n * 100).toFixed(1)}%`);
}
console.log(`  走者 ${new Set(events.map(e => e.runner_norm)).size}人`);
console.log('\n出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');
db.close();

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
//
// 2026-08-07 重要修正:
//   旧版は各打席の「最終投球行」の on_1b/on_2b/on_3b を打席開始状態として使っていた。
//   保存済み22,459件を説明文で監査すると、明示状態との矛盾が確認されたため旧テーブルは失効。
//   新版は必ず
//     - 現打席の first row = 打席開始状態
//     - 次打席の first row = 打球後状態
//   を使う。走者が次打席で消え、同時にアウト数も増えた場合は、生還と走塁死を
//   現データだけで一意に区別できないため、成功/失敗を捏造せず標本から除外する。
//
// 数える型:
//   1st→3rd  … 一塁に走者、二塁三塁が空、打者が単打。その走者が三塁へ行ったか（明確な生還も成功）
//   2nd→home … 二塁に走者、三塁が空、打者が単打。その走者が生還したか
//   1st→home … 一塁に走者、打者が二塁打。その走者が生還したか
//
// 交絡（この時点では分離しない）:
//   打球の方向と深さ。右前打なら三塁は難しく、左前打なら易しい。
//   打球位置（hc_x/hc_y）を持っているので、次の工程で揃える。
//
// 使い方:
//   node scripts/build_baserunning_advances.mjs
//
// 非破壊監査:
//   PBP_RAW_DIR=/tmp/npb_pbp PBP_DRY_RUN=1 node scripts/build_baserunning_advances.mjs
//
// DB差し替え（明示時のみ）:
//   PBP_DB_PATH=/tmp/pennant.db node scripts/build_baserunning_advances.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addPitchRowToPlateAppearance, classifyAdvanceOutcome } from '../src/ratings/baserunning_events.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = process.env.PBP_RAW_DIR
  ? path.resolve(process.env.PBP_RAW_DIR)
  : path.join(ROOT, 'data', 'raw', 'npb_pbp');
const DB_PATH = process.env.PBP_DB_PATH
  ? path.resolve(process.env.PBP_DB_PATH)
  : path.join(ROOT, 'data', 'pennant.db');
const DRY_RUN = process.env.PBP_DRY_RUN === '1';

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

if (!existsSync(RAW)) { console.error(`1球データがありません: ${RAW}`); process.exit(1); }
const files = readdirSync(RAW).filter(f => f.endsWith('_pbp.csv')).sort();
if (!files.length) { console.error(`*_pbp.csv がありません: ${RAW}`); process.exit(1); }
const REGULAR = new Set(['1', '2', '26']);
const norm = s => (s ?? '').replace(/[\s　]/g, '');
const events = [];
const excludedAmbiguous = { '1st_to_3rd': 0, '2nd_to_home': 0, '1st_to_home_on_2b': 0 };
const rowsBySeason = new Map();

for (const fn of files) {
  const lines = readFileSync(path.join(RAW, fn), 'utf8').split('\n');
  const hdr = splitCsvLine(lines[0].replace(/^\uFEFF/, ''));
  const I = n => hdr.indexOf(n);
  const c = {
    season: I('season'), game: I('game_id'), inn: I('inning'), ab: I('inning_ab_num'),
    type: I('game_type_id'), state: I('game_state_name'), desc: I('description_jap'),
    on1: I('on_1b'), on1n: I('on_1b_name'), on2: I('on_2b'), on2n: I('on_2b_name'),
    on3: I('on_3b'), on3n: I('on_3b_name'), outs: I('outs_when_up'),
    hx: I('hc_x'), hy: I('hc_y'), hl: I('hit_location'), park: I('stadium_name'),
  };
  const required = ['season','game','inn','ab','type','state','desc','on1n','on2n','on3n','outs'];
  const missing = required.filter(k => c[k] < 0);
  if (missing.length) {
    throw new Error(`${fn}: 必須列がありません: ${missing.join(', ')}`);
  }

  // 打席ごとに first row（開始状態）と last row（打球結果・説明文）を別々に保持する。
  const pa = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = splitCsvLine(lines[i]);
    if (!REGULAR.has(r[c.type])) continue;
    const season = Number(r[c.season]);
    if (Number.isFinite(season)) rowsBySeason.set(season, (rowsBySeason.get(season) ?? 0) + 1);
    const key = `${r[c.game]}|${String(Number(r[c.inn])).padStart(3, '0')}|${r[c.state]}|${String(Number(r[c.ab])).padStart(4, '0')}`;
    addPitchRowToPlateAppearance(pa, key, r);
  }

  const keys = [...pa.keys()].sort();
  for (let i = 0; i < keys.length - 1; i++) {
    const cur = pa.get(keys[i]), nxt = pa.get(keys[i + 1]);
    const curFirst = cur.first, curLast = cur.last, nxtFirst = nxt.first;

    // 同じ試合・同じイニング・同じ攻撃（表裏）の中でだけ比べる。
    const [g1, in1, st1] = keys[i].split('|'), [g2, in2, st2] = keys[i + 1].split('|');
    if (g1 !== g2 || in1 !== in2 || st1 !== st2) continue;

    const d = (curLast[c.desc] ?? '').replace(/^\d+球目:/, '');
    const isSingle = /ヒット|内野安打|安打/.test(d) && !/二塁打|三塁打|本塁打|ホームラン|タイムリーツーベース/.test(d);
    const isDouble = /二塁打|ツーベース/.test(d);
    if (!isSingle && !isDouble) continue;

    // ★開始走者は必ず current PA の first row から取る。
    const r1 = norm(curFirst[c.on1n]), r2 = norm(curFirst[c.on2n]), r3 = norm(curFirst[c.on3n]);
    // ★打球後の塁状態は next PA の first row から取る。
    const nextBases = {
      first: norm(nxtFirst[c.on1n]) || null,
      second: norm(nxtFirst[c.on2n]) || null,
      third: norm(nxtFirst[c.on3n]) || null,
    };
    const outsBefore = Number(curFirst[c.outs]);
    const outsAfter = Number(nxtFirst[c.outs]);

    const numericOrNull = idx => {
      if (idx < 0) return null;
      const s = curLast[idx];
      if (s == null || s === '') return null;
      const v = Number(s);
      return Number.isFinite(v) ? v : null;
    };

    const push = (kind, runner, success) => events.push({
      season: Number(curFirst[c.season]), park: c.park >= 0 ? curFirst[c.park] : null, kind, runner, runner_norm: runner,
      outs: Number.isFinite(outsBefore) ? outsBefore : null,
      success,
      hc_x: numericOrNull(c.hx),
      hc_y: numericOrNull(c.hy),
      hit_location: numericOrNull(c.hl),
      description: d.slice(0, 120),
    });

    const classifyAndPush = (kind, runner) => {
      const success = classifyAdvanceOutcome(kind, runner, nextBases, outsBefore, outsAfter);
      if (success == null) { excludedAmbiguous[kind]++; return; }
      push(kind, runner, success);
    };

    // 一塁走者のみ × 単打 → 三塁まで行けたか
    if (isSingle && r1 && !r2 && !r3) classifyAndPush('1st_to_3rd', r1);
    // 二塁走者あり・三塁空 × 単打 → 生還できたか（1塁走者の有無は問わない）
    if (isSingle && r2 && !r3) classifyAndPush('2nd_to_home', r2);
    // 一塁走者のみ × 二塁打 → 生還できたか
    if (isDouble && r1 && !r2 && !r3) classifyAndPush('1st_to_home_on_2b', r1);
  }
  console.error(`  ${fn}`);
}

if (!DRY_RUN) {
  const db = new DatabaseSync(DB_PATH);
  db.exec(`DROP TABLE IF EXISTS baserunning_advances`);
  db.exec(`CREATE TABLE baserunning_advances (
    season INTEGER, park TEXT, kind TEXT, runner TEXT, runner_norm TEXT,
    outs INTEGER, success INTEGER, hc_x REAL, hc_y REAL, hit_location INTEGER, description TEXT)`);
  const ins = db.prepare(`INSERT INTO baserunning_advances VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  for (const e of events) ins.run(e.season, e.park, e.kind, e.runner, e.runner_norm,
    e.outs, e.success, e.hc_x, e.hc_y, e.hit_location, e.description);
  db.exec('COMMIT');
  db.exec(`CREATE INDEX idx_bra ON baserunning_advances(runner_norm, season)`);
  db.close();
}

console.log(`\n走塁の確定可能な機会: ${events.length.toLocaleString()}件`);
const byKind = {};
for (const e of events) {
  byKind[e.kind] ??= { n: 0, s: 0 };
  byKind[e.kind].n++; byKind[e.kind].s += e.success;
}
console.log('型ごとの成功率:');
const LABEL = { '1st_to_3rd': '単打で一塁→三塁', '2nd_to_home': '単打で二塁→生還', '1st_to_home_on_2b': '二塁打で一塁→生還' };
for (const k of Object.keys(LABEL)) {
  const v = byKind[k] ?? { n: 0, s: 0 };
  const rate = v.n ? `${(v.s / v.n * 100).toFixed(1)}%` : '—';
  console.log(`  ${LABEL[k].padEnd(20)} ${String(v.n).padStart(6)}件  成功 ${rate}  判定不能除外 ${excludedAmbiguous[k]}`);
}
console.log(`  走者 ${new Set(events.map(e => e.runner_norm)).size}人`);
console.log(`  seasons ${[...new Set(events.map(e => e.season))].sort((a,b)=>a-b).join(', ') || 'none'}`);
console.log(`  regular-season pitch rows ${[...rowsBySeason.entries()].sort((a,b)=>a[0]-b[0]).map(([y,n])=>`${y}:${n}`).join(' / ')}`);
console.log(`  mode ${DRY_RUN ? 'DRY_RUN_NO_DB_WRITE' : `WRITE ${DB_PATH}`}`);
console.log('\n注意: 旧baserunning_advancesは再利用しない。上記生データから再構築後に較正をやり直すこと。');
console.log('出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');

// 走塁の実測を1球データから自分で作る。「単打で一塁から三塁まで行けたか」など。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//
// 2026-08-07 重要修正:
//   1) Release PBPには打席ヘッダー等の非投球行が混ざるため、first/last任意行は使わない。
//   2) 追加進塁の起点は「打席開始時」ではなく**打球が発生した最終投球の直前**の塁状態。
//      打席途中の盗塁・暴投等で走者が動くため、firstPitchを起点にすると誤分類する。
//   3) 現在は必ず
//        - 現打席の lastPitch = 安打直前の塁状態 + 打球結果
//        - 次打席の firstPitch = 打球後状態
//      を使う。
//   4) Release PBPは on_* のplayer IDが空でも on_*_name が入ることがある。
//      塁占有はID OR 名前で認識し、走者照合は「双方にIDがあればID、片側欠損なら名前」で行う。
//
// 走者が次打席で消え、同時にアウト数も増えた場合は、生還と走塁死を
// 現データだけで一意に区別できないため、成功/失敗を捏造せず標本から除外する。
//
// 数える型:
//   1st→3rd  … 打球直前に一塁走者のみ、打者が単打。その走者が三塁へ行ったか（明確な生還も成功）
//   2nd→home … 打球直前に二塁走者あり・三塁空、打者が単打。その走者が生還したか
//   1st→home … 打球直前に一塁走者のみ、打者が二塁打。その走者が生還したか
//
// 交絡（この時点では分離しない）:
//   打球の方向と深さ。右前打なら三塁は難しく、左前打なら易しい。
//   打球位置（hc_x/hc_y）を持っているので、次の工程で揃える。
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
import {
  addPitchRowToPlateAppearance,
  classifyAdvanceOutcome,
  makeRunnerIdentity,
} from '../src/ratings/baserunning_events.mjs';

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

const isRealPitch = (r, c) => {
  const pn = c.pitch >= 0 ? Number(r[c.pitch]) : NaN;
  if (Number.isFinite(pn) && pn > 0) return true;
  return /^\d+球目:/.test(r[c.desc] ?? '');
};

if (!existsSync(RAW)) { console.error(`1球データがありません: ${RAW}`); process.exit(1); }
const files = readdirSync(RAW).filter(f => f.endsWith('_pbp.csv')).sort();
if (!files.length) { console.error(`*_pbp.csv がありません: ${RAW}`); process.exit(1); }
const REGULAR = new Set(['1', '2', '26']);
const events = [];
const excludedAmbiguous = { '1st_to_3rd': 0, '2nd_to_home': 0, '1st_to_home_on_2b': 0 };
const excludedNoPitchState = { current: 0, next: 0 };
const rowsBySeason = new Map();

for (const fn of files) {
  const lines = readFileSync(path.join(RAW, fn), 'utf8').split(/\r?\n/);
  const hdr = splitCsvLine(lines[0].replace(/^\uFEFF/, ''));
  const I = n => hdr.indexOf(n);
  const c = {
    season: I('season'), game: I('game_id'), inn: I('inning'), ab: I('inning_ab_num'),
    type: I('game_type_id'), state: I('game_state_name'), desc: I('description_jap'),
    pitch: I('pitch_number'),
    on1: I('on_1b'), on1n: I('on_1b_name'), on2: I('on_2b'), on2n: I('on_2b_name'),
    on3: I('on_3b'), on3n: I('on_3b_name'), outs: I('outs_when_up'),
    hx: I('hc_x'), hy: I('hc_y'), hl: I('hit_location'), park: I('stadium_name'),
  };
  const required = ['season','game','inn','ab','type','state','desc','pitch','on1','on1n','on2','on2n','on3','on3n','outs'];
  const missing = required.filter(k => c[k] < 0);
  if (missing.length) throw new Error(`${fn}: 必須列がありません: ${missing.join(', ')}`);

  const occupant = (r, idCol, nameCol) => makeRunnerIdentity(r[idCol], r[nameCol]);

  const pa = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = splitCsvLine(lines[i]);
    if (!REGULAR.has(r[c.type])) continue;
    const season = Number(r[c.season]);
    if (Number.isFinite(season)) rowsBySeason.set(season, (rowsBySeason.get(season) ?? 0) + 1);
    const key = `${r[c.game]}|${String(Number(r[c.inn])).padStart(3, '0')}|${r[c.state]}|${String(Number(r[c.ab])).padStart(4, '0')}`;
    addPitchRowToPlateAppearance(pa, key, r, isRealPitch(r, c));
  }

  const keys = [...pa.keys()].sort();
  for (let i = 0; i < keys.length - 1; i++) {
    const cur = pa.get(keys[i]), nxt = pa.get(keys[i + 1]);

    const [g1, in1, st1] = keys[i].split('|'), [g2, in2, st2] = keys[i + 1].split('|');
    if (g1 !== g2 || in1 !== in2 || st1 !== st2) continue;

    const curLast = cur.lastPitch;
    const nxtFirst = nxt.firstPitch;
    if (!curLast) { excludedNoPitchState.current++; continue; }
    if (!nxtFirst) { excludedNoPitchState.next++; continue; }

    const d = (curLast[c.desc] ?? '').replace(/^\d+球目:/, '');
    const isSingle = /ヒット|内野安打|安打/.test(d) && !/二塁打|三塁打|本塁打|ホームラン|タイムリーツーベース/.test(d);
    const isDouble = /二塁打|ツーベース/.test(d);
    if (!isSingle && !isDouble) continue;

    const r1 = occupant(curLast, c.on1, c.on1n);
    const r2 = occupant(curLast, c.on2, c.on2n);
    const r3 = occupant(curLast, c.on3, c.on3n);
    const nextBases = {
      first: occupant(nxtFirst, c.on1, c.on1n),
      second: occupant(nxtFirst, c.on2, c.on2n),
      third: occupant(nxtFirst, c.on3, c.on3n),
    };
    const outsBefore = Number(curLast[c.outs]);
    const outsAfter = Number(nxtFirst[c.outs]);

    const numericOrNull = idx => {
      if (idx < 0) return null;
      const s = curLast[idx];
      if (s == null || s === '') return null;
      const v = Number(s);
      return Number.isFinite(v) ? v : null;
    };

    const push = (kind, runner, success) => events.push({
      season: Number(curLast[c.season]), park: c.park >= 0 ? curLast[c.park] : null,
      kind,
      runner_id: runner.id,
      runner: runner.name || runner.id,
      runner_norm: runner.name || runner.id,
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

    if (isSingle && r1 && !r2 && !r3) classifyAndPush('1st_to_3rd', r1);
    if (isSingle && r2 && !r3) classifyAndPush('2nd_to_home', r2);
    if (isDouble && r1 && !r2 && !r3) classifyAndPush('1st_to_home_on_2b', r1);
  }
  console.error(`  ${fn}`);
}

if (!DRY_RUN) {
  const db = new DatabaseSync(DB_PATH);
  db.exec(`DROP TABLE IF EXISTS baserunning_advances`);
  db.exec(`CREATE TABLE baserunning_advances (
    season INTEGER, park TEXT, kind TEXT, runner_id TEXT, runner TEXT, runner_norm TEXT,
    outs INTEGER, success INTEGER, hc_x REAL, hc_y REAL, hit_location INTEGER, description TEXT)`);
  const ins = db.prepare(`INSERT INTO baserunning_advances VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  for (const e of events) ins.run(e.season, e.park, e.kind, e.runner_id, e.runner, e.runner_norm,
    e.outs, e.success, e.hc_x, e.hc_y, e.hit_location, e.description);
  db.exec('COMMIT');
  db.exec(`CREATE INDEX idx_bra_name ON baserunning_advances(runner_norm, season)`);
  db.exec(`CREATE INDEX idx_bra_id ON baserunning_advances(runner_id, season)`);
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
const uniqueRunnerKeys = new Set(events.map(e => e.runner_id ? `id:${e.runner_id}` : `name:${e.runner_norm}`));
console.log(`  走者 ${uniqueRunnerKeys.size}人`);
console.log(`  seasons ${[...new Set(events.map(e => e.season))].sort((a,b)=>a-b).join(', ') || 'none'}`);
console.log(`  non-pitch state exclusions current=${excludedNoPitchState.current} next=${excludedNoPitchState.next}`);
console.log(`  regular-season rows ${[...rowsBySeason.entries()].sort((a,b)=>a[0]-b[0]).map(([y,n])=>`${y}:${n}`).join(' / ')}`);
console.log(`  mode ${DRY_RUN ? 'DRY_RUN_NO_DB_WRITE' : `WRITE ${DB_PATH}`}`);
console.log('\n注意: 旧baserunning_advancesは再利用しない。上記生データから再構築後に較正をやり直すこと。');
console.log('出典: This uses data sourced from the Nippon Baseball Data Repository (MIT License)');

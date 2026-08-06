// NPB+ のスクリーンショットから読み取った実測値を取り込む。
//
// 経緯（2026-08-05）:
//   当初は「送球速度だけ手入力」のシートを作ったが、オーナーの問い
//   「送球速度以外のデータはすべてあなたの手元にあるということですか？」で照合したところ、
//   NPB+ の選手ページに出ている項目のうち **10項目が手元に無かった**
//   （打球速度・飛距離・打球角度・スイング速度・ハードヒット率・バレル率・
//     ボールゾーンスイング率・瞬間最高速度・一塁到達タイム・送球速度）。
//   「いま一番悪い能力に効く1項目だけ」に絞ったのは、同じ画面に他も出ている以上、絞る理由になっていなかった。
//   オーナー提案「全項目スクショをとるのでもいいですよ」を受け、CCが画像から読み取って
//   この中間ファイル（JSONL）へ書き、本スクリプトがDBへ入れる形にした。
//
// なぜ中間ファイルを挟むか:
//   画像の読み取りはCCが行うが、読み取り結果を人が見返せる形で残さないと
//   「何をどう読んだか」が消える。JSONL に1行1選手で残し、原本の画像名も持たせる。
//
// 単位（オーナーの実画面で確認、2026-08-05 広島 矢野雅哉）:
//   打球速度・スイング速度・送球速度 = km/h ／ 飛距離 = m ／ 打球角度 = 度
//   瞬間最高速度 = km/h（★ft/s ではない。30.7 は ft/s のレンジと重なるので誤判定しやすい）
//   一塁到達 = 秒 ／ 各種率 = %
//
// 使い方:
//   1) CCが画像を読み、data/manual/npb_plus_screens.jsonl へ1行1選手で追記
//   2) node scripts/ingest_npb_plus_screens.mjs
//
// JSONL の1行の形:
//   {"name":"矢野 雅哉","team":"広島東洋カープ","season_label":"2026途中",
//    "exit_velo_max":166.7,"exit_velo_avg":132.3,"distance_max":116.1,"launch_angle_avg":-0.8,
//    "swing_speed_avg":100.4,"hard_hit_pct":11.8,"barrel_pct":2.9,"k_pct":29.3,"bb_rate":0.121,
//    "ops":0.497,"chase_pct":33.6,"sb_success":0.667,"top_speed_kmh":30.7,"hp_to_1b_sec":4.20,
//    "throw_speed_kmh":125.7,"source_images":["1000005049.png","1000005050.png"]}

import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSONL = path.join(ROOT, 'data', 'manual', 'npb_plus_screens.jsonl');

/** 数値の妥当域。範囲外は取り込まず報告する（読み取りミス・単位取り違えの検出） */
export const RANGES = {
  exit_velo_max: [120, 200], exit_velo_avg: [100, 180],
  distance_max: [50, 180], launch_angle_avg: [-30, 40],
  swing_speed_avg: [70, 140], hard_hit_pct: [0, 100], barrel_pct: [0, 60],
  k_pct: [0, 60], bb_rate: [0, 0.4], ops: [0, 1.6], chase_pct: [0, 70],
  sb_success: [0, 1], top_speed_kmh: [15, 45], hp_to_1b_sec: [3.0, 6.0],
  throw_speed_kmh: [80, 180],
};

/** 1行を検査する。範囲外・型違いを列挙して返す（黙って落とさない） */
export function validateRow(row) {
  const problems = [];
  if (!row?.name) problems.push('name が無い');
  for (const [k, [lo, hi]] of Object.entries(RANGES)) {
    const v = row?.[k];
    if (v == null) continue;
    if (!Number.isFinite(v)) { problems.push(`${k} が数値でない: ${JSON.stringify(v)}`); continue; }
    if (v < lo || v > hi) problems.push(`${k}=${v} が妥当域 ${lo}〜${hi} の外（単位の取り違えか読み取りミス）`);
  }
  return problems;
}

if ((process.argv[1] ?? '').endsWith('ingest_npb_plus_screens.mjs')) {
  if (!existsSync(JSONL)) {
    console.log(`まだ読み取り結果がありません: ${path.relative(ROOT, JSONL)}`);
    console.log('スクリーンショットを受け取ったらCCがこのファイルへ書き出します。');
    process.exit(0);
  }
  const lines = (await readFile(JSONL, 'utf8')).split('\n').map(s => s.trim()).filter(Boolean);
  const rows = [], bad = [];
  for (const [i, l] of lines.entries()) {
    let r; try { r = JSON.parse(l); } catch (e) { bad.push(`${i + 1}行目: JSONとして読めない — ${e.message}`); continue; }
    const p = validateRow(r);
    if (p.length) { bad.push(`${i + 1}行目 ${r.name ?? '?'}: ${p.join(' / ')}`); continue; }
    rows.push(r);
  }

  const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS npb_plus_measurement (
    name TEXT PRIMARY KEY, player_id TEXT, team TEXT, season_label TEXT,
    exit_velo_max REAL, exit_velo_avg REAL, distance_max REAL, launch_angle_avg REAL,
    swing_speed_avg REAL, hard_hit_pct REAL, barrel_pct REAL, chase_pct REAL,
    k_pct REAL, bb_rate REAL, ops REAL, sb_success REAL,
    top_speed_kmh REAL, hp_to_1b_sec REAL, throw_speed_kmh REAL,
    source_images TEXT, source TEXT)`);

  // 名寄せ: v_batting の名前。全角スペース差に加え、外国人選手の表記差も吸収する。
  // 名簿は「Ｎ．ソト」、NPB+の画面は「ソト」と出るため、空白除去だけでは一致しない
  // （2026-08-05、ソト・カリステで実際に取りこぼした）。
  const roster = db.prepare(`SELECT player_id, name, team, MAX(season) s FROM v_batting GROUP BY player_id`).all();
  const key = s => (s ?? '').replace(/[\s　]/g, '');
  const keyAlt = s => key(s).replace(/^[A-ZＡ-Ｚ][．.]/, '');
  const rosterMap = new Map();
  for (const r of roster) {
    rosterMap.set(key(r.name), r);
    const alt = keyAlt(r.name);
    if (alt !== key(r.name) && !rosterMap.has(alt)) rosterMap.set(alt, r);
  }

  const cols = ['name', 'player_id', 'team', 'season_label', 'exit_velo_max', 'exit_velo_avg', 'distance_max',
    'launch_angle_avg', 'swing_speed_avg', 'hard_hit_pct', 'barrel_pct', 'chase_pct', 'k_pct', 'bb_rate',
    'ops', 'sb_success', 'top_speed_kmh', 'hp_to_1b_sec', 'throw_speed_kmh', 'source_images', 'source'];
  const ins = db.prepare(`INSERT OR REPLACE INTO npb_plus_measurement (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);

  const unmatched = [];
  db.exec('BEGIN');
  for (const r of rows) {
    const m = rosterMap.get(key(r.name)) ?? rosterMap.get(keyAlt(r.name));
    if (!m) unmatched.push(r.name);
    ins.run(r.name, m?.player_id ?? null, r.team ?? m?.team ?? null, r.season_label ?? null,
      r.exit_velo_max ?? null, r.exit_velo_avg ?? null, r.distance_max ?? null, r.launch_angle_avg ?? null,
      r.swing_speed_avg ?? null, r.hard_hit_pct ?? null, r.barrel_pct ?? null, r.chase_pct ?? null,
      r.k_pct ?? null, r.bb_rate ?? null, r.ops ?? null, r.sb_success ?? null,
      r.top_speed_kmh ?? null, r.hp_to_1b_sec ?? null, r.throw_speed_kmh ?? null,
      JSON.stringify(r.source_images ?? []), 'NPB+アプリ（オーナー撮影・CC読み取り）');
  }
  db.exec('COMMIT');

  console.log(`取り込み ${rows.length}人（読み取り ${lines.length}行）`);
  const c = k => db.prepare(`SELECT COUNT(*) c FROM npb_plus_measurement WHERE ${k} IS NOT NULL`).get().c;
  console.log(`  送球速度 ${c('throw_speed_kmh')}人 / 打球速度(平均) ${c('exit_velo_avg')}人 / 打球角度 ${c('launch_angle_avg')}人`
    + ` / スイング速度 ${c('swing_speed_avg')}人 / 瞬間最高速度 ${c('top_speed_kmh')}人`);
  if (unmatched.length) console.log(`\n名簿と名前が合わなかった ${unmatched.length}人（値は保存済み・player_idがnull）: ${unmatched.join('、')}`);
  if (bad.length) console.log(`\n取り込まなかった ${bad.length}件:\n  - ${bad.join('\n  - ')}`);
  db.close();
}

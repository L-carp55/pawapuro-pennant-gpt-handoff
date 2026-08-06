// オーナーが埋めた NPB+ 入力シートを取り込む。
//
// 設計の要（既存のスカウティング台帳と同じ規律）:
//   - 統計由来の値を上書きしない。別テーブルへ入れ、食い違いの大きさを見えるようにする
//   - 空欄は「無い」であって 0 ではない。0 で埋めない（仕様03 §1.3）
//   - 単位はオーナーに書かせない。数値の大きさから km/h と mph を判別し、判別結果を記録する
//     （送球速度: km/h なら概ね 100〜160、mph なら 60〜100。スプリントは ft/s なら 22〜31、km/h なら 25〜35）
//   - 判別できない値は取り込まず、その行を報告する（黙って捨てない）

import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] ?? 2024);

// 単位はオーナーの実画面で確認済み（2026-08-05、広島 矢野雅哉のNPB+選手ページ）:
//   守備「送球速度（平均）」= 125.7 km/h（バーの目盛り 100〜160）
//   スプリント「瞬間最高速度」= 30.7 km/h（目盛り 0〜40）★ft/s ではない
//   スプリント「最速タイム（一塁到達）」= 4.20 秒
// 当初は Statcast と同じ ft/s も受ける作りにしていたが、30.7 は ft/s のレンジ（22〜31）と
// 重なるため **必ず ft/s と誤判定する**。NPB+ 由来と分かっている入力では km/h を既定にする。

/** 送球速度の単位を数値の大きさから判別する。曖昧域は null を返して取り込まない */
export function detectThrowUnit(v) {
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 100 && v <= 200) return { unit: 'km/h', kmh: v };
  if (v >= 50 && v <= 99) return { unit: 'mph', kmh: v * 1.609344 };
  return null;
}

/** 瞬間最高速度の単位判別。NPB+ は km/h（実画面で確認）。ft/s は受けない */
export function detectSprintUnit(v) {
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 20 && v <= 45) return { unit: 'km/h', ftps: v / 3.6 * 3.280840 };
  if (v >= 5 && v <= 12) return { unit: 'm/s', ftps: v * 3.280840 };
  return null;
}

/** シート本文から入力行を取り出す。ヘッダ行・区切り行・全欄空の行は落とす */
export function parseSheet(text) {
  const out = [];
  let team = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^###\s+(.+?)（/);
    if (h) { team = h[1].trim(); continue; }
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(s => s.trim());
    if (cells.length < 6) continue;
    if (cells[0] === '選手' || /^-+:?$/.test(cells[0].replace(/-/g, '-'))) continue;
    if (/^:?-+:?$/.test(cells[0])) continue;
    const [name, pos, pa, throwV, sprintV, hp1b] = cells;
    if (!name || name === '選手') continue;
    if (!throwV && !sprintV && !hp1b) continue; // 未記入はそのまま飛ばす
    const num = s => { const m = (s ?? '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
    out.push({
      team, name, pos, pa: Number(pa) || null,
      throw_raw: num(throwV), sprint_raw: num(sprintV), hp1b_raw: num(hp1b),
      throw_text: throwV, sprint_text: sprintV, hp1b_text: hp1b,
    });
  }
  return out;
}

if ((process.argv[1] ?? '').endsWith('parse_npb_plus_input.mjs')) {
  const sheetPath = path.join(ROOT, 'outputs', `npb_plus_input_${SEASON}.md`);
  const text = await readFile(sheetPath, 'utf8');
  const entries = parseSheet(text);

  if (!entries.length) {
    console.log(`${path.relative(ROOT, sheetPath)} にまだ記入がありません（空欄のみ）。`);
    process.exit(0);
  }

  const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS npb_plus_measurement (
    season INTEGER, player_id TEXT, name TEXT, team TEXT, pos TEXT,
    throw_kmh REAL, throw_unit TEXT, throw_raw REAL,
    sprint_ftps REAL, sprint_unit TEXT, sprint_raw REAL,
    hp_to_1b_sec REAL,
    source TEXT, entered_by TEXT,
    PRIMARY KEY (season, name))`);

  // 名寄せ: v_batting の同年・同名（シート生成元と同じ経路なので全角スペース差だけ吸収）
  const roster = db.prepare(`SELECT player_id, name, team, position FROM v_batting WHERE season = ?`).all(SEASON);
  const key = s => (s ?? '').replace(/[\s　]/g, '');
  const rosterMap = new Map(roster.map(r => [key(r.name), r]));

  const ins = db.prepare(`INSERT OR REPLACE INTO npb_plus_measurement VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const rejected = [], unmatched = [];
  let n = 0;
  db.exec('BEGIN');
  for (const e of entries) {
    const m = rosterMap.get(key(e.name));
    if (!m) { unmatched.push(e.name); continue; }
    const t = e.throw_raw != null ? detectThrowUnit(e.throw_raw) : null;
    const s = e.sprint_raw != null ? detectSprintUnit(e.sprint_raw) : null;
    if (e.throw_raw != null && !t) rejected.push(`${e.name} 送球「${e.throw_text}」= ${e.throw_raw}（km/h とも mph とも判別できない）`);
    if (e.sprint_raw != null && !s) rejected.push(`${e.name} スプリント「${e.sprint_text}」= ${e.sprint_raw}（単位を判別できない）`);
    if (!t && !s && e.hp1b_raw == null) continue;
    ins.run(SEASON, m.player_id, e.name, e.team ?? m.team, e.pos,
      t?.kmh ?? null, t?.unit ?? null, e.throw_raw,
      s?.ftps ?? null, s?.unit ?? null, e.sprint_raw,
      e.hp1b_raw,
      'NPB+アプリ（オーナー手入力）', 'owner');
    n++;
  }
  db.exec('COMMIT');

  console.log(`取り込み: ${n}人（記入 ${entries.length}行）`);
  const withThrow = db.prepare(`SELECT COUNT(*) c FROM npb_plus_measurement WHERE season=? AND throw_kmh IS NOT NULL`).get(SEASON).c;
  const withSprint = db.prepare(`SELECT COUNT(*) c FROM npb_plus_measurement WHERE season=? AND sprint_ftps IS NOT NULL`).get(SEASON).c;
  console.log(`  送球速度あり ${withThrow}人 / スプリントあり ${withSprint}人`);
  const units = db.prepare(`SELECT throw_unit u, COUNT(*) c FROM npb_plus_measurement WHERE season=? AND throw_unit IS NOT NULL GROUP BY throw_unit`).all(SEASON);
  if (units.length) console.log('  送球速度の単位判定:', units.map(x => `${x.u} ${x.c}人`).join(' / '));
  if (units.length > 1) console.log('  ※単位が混ざっています。シートの書き方が途中で変わっていないか確認してください');
  if (unmatched.length) console.log(`\n名前が名簿と合わなかった ${unmatched.length}件: ${unmatched.join('、')}`);
  if (rejected.length) console.log(`\n単位を判別できず取り込まなかった ${rejected.length}件:\n  - ${rejected.join('\n  - ')}`);

  const byPos = db.prepare(`SELECT pos, COUNT(*) c FROM npb_plus_measurement WHERE season=? AND throw_kmh IS NOT NULL GROUP BY pos`).all(SEASON);
  if (byPos.length) console.log('\n守備位置別:', byPos.map(x => `${x.pos} ${x.c}人`).join(' / '));
  console.log('\n次: node scripts/calibrate_npb_plus_arm.mjs で肩力への接続を較正します');
  db.close();
}

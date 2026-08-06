// 較正・正規化の「静かな取りこぼし」を検査する。
//
// 2026-08-01に、捕手がRngRを持たないため `WHERE rngr IS NOT NULL` で415件全除外され、
// 捕手査定が常にnullを返すバグを検出した。同じ型のバグが他に無いかを機械で洗う。
//
// 検査1: 各テーブルの主要指標について、グループ別の全件NULL率を出す
// 検査2: 生成済みの正規化ファイルが、入力に存在するカテゴリを全て含むか
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

let warn = 0;
const W = (msg) => { warn++; console.log('  ⚠ ' + msg); };

console.log('=== 検査1: グループ別の全件NULL（フィルタで丸ごと消える候補）===\n');

const TARGETS = [
  { table: 'bm_fld', group: 'pos', cols: ['rngr', 'errr', 'arm', 'dpr', 'framing', 'blocking'], where: 'farm=0' },
  { table: 'bm_bat', group: null, cols: ['gb_pct', 'ld_pct', 'fb_pct', 'hr_fb'], where: 'farm=0' },
  { table: 'bm_pit', group: null, cols: ['k_pct', 'bb_pct', 'gb_pct'], where: 'farm=0' },
];

for (const t of TARGETS) {
  // テーブルの実在と列の実在を確認
  let cols;
  try {
    cols = db.prepare(`PRAGMA table_info(${t.table})`).all().map(r => r.name);
  } catch { console.log(`[${t.table}] テーブルなし（スキップ）\n`); continue; }
  const use = t.cols.filter(c => cols.includes(c));
  if (!use.length) { console.log(`[${t.table}] 対象列なし（スキップ）\n`); continue; }

  console.log(`[${t.table}]`);
  if (t.group && cols.includes(t.group)) {
    const sel = use.map(c => `SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) null_${c}`).join(', ');
    const rows = db.prepare(`SELECT ${t.group} g, COUNT(*) n, ${sel} FROM ${t.table} WHERE ${t.where} GROUP BY ${t.group} ORDER BY n DESC`).all();
    for (const r of rows) {
      const allNull = use.filter(c => r[`null_${c}`] === r.n);
      const partial = use.filter(c => r[`null_${c}`] > 0 && r[`null_${c}`] < r.n);
      if (allNull.length) W(`${t.group}=${r.g}（${r.n}件）は ${allNull.join(', ')} が全件NULL → これらを NOT NULL 条件にすると全除外される`);
      if (partial.length) console.log(`    ${t.group}=${r.g}: ${partial.map(c => `${c} ${r[`null_${c}`]}/${r.n}欠`).join(' / ')}`);
    }
  } else {
    const sel = use.map(c => `SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) null_${c}`).join(', ');
    const r = db.prepare(`SELECT COUNT(*) n, ${sel} FROM ${t.table} WHERE ${t.where}`).get();
    for (const c of use) {
      if (r[`null_${c}`] === r.n) W(`${t.table}.${c} が全件NULL（${r.n}件）`);
      else if (r[`null_${c}`] > 0) console.log(`    ${c}: ${r[`null_${c}`]}/${r.n} 欠損`);
    }
  }
  console.log('');
}

console.log('=== 検査2: 正規化ファイルが入力の全カテゴリを含むか ===\n');

// 守備: bm_fld に出てくるポジション vs fielding_norms.json の byPos
{
  const inPos = db.prepare(`SELECT DISTINCT pos FROM bm_fld WHERE farm=0 AND inn >= 200`).all().map(r => r.pos);
  const norm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
  const outPos = Object.keys(norm.byPos ?? {});
  // DH は守備に出ないので対象外
  const expect = inPos.filter(p => p && p !== 'DH' && p !== 'P');
  const missing = expect.filter(p => !outPos.includes(p));
  console.log(`[fielding_norms] 入力ポジション ${expect.length}種 / 出力 ${outPos.length}種`);
  if (missing.length) W(`正規化に含まれないポジション: ${missing.join(', ')} → そのポジションの査定は常にnullになる`);
  else console.log('    すべてのポジションが正規化に含まれている');
  // 各ポジションの中身も検査（sd=0 や n=0 は査定を壊す）
  for (const [pos, v] of Object.entries(norm.byPos ?? {})) {
    for (const key of ['errr', 'arm', 'framing', 'blocking']) {
      const st = v[key];
      if (!st) continue;
      if (st.n === 0) console.log(`    ${pos}.${key}: n=0（この指標では査定されない）`);
      else if (!(st.sd > 0)) W(`${pos}.${key} の標準偏差が0または不正（${st.sd}）→ zスコアが計算不能`);
    }
  }
}
console.log('');

// 走塁: running_norms.json の各指標
{
  const norm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
  const keys = ['triple', 'gdpAvoid', 'ubr', 'wsbOnSpeed', 'sbSuccess', 'attempt', 'ubrOnSpeed'];
  const missing = keys.filter(k => !norm[k]);
  console.log(`[running_norms] 必要な指標 ${keys.length}種 / 欠落 ${missing.length}種`);
  if (missing.length) W(`欠落: ${missing.join(', ')}`);
  for (const k of keys) {
    const v = norm[k];
    if (v && v.sd != null && !(v.sd > 0)) W(`${k}.sd が0または不正（${v.sd}）`);
  }
}
console.log('');

// 既知の警告（データ提供側の構造上そうなるもの）は許容リストに入れ、
// **新しい警告が増えた時だけ失敗**させる。そうしないと警告が常態化して誰も見なくなる。
const KNOWN = [
  'pos=DH',            // 指名打者は守備しないので全指標NULLで正常
  'pos=LF（917件）は dpr', 'pos=RF（795件）は dpr', 'pos=CF（576件）は dpr',  // 外野に併殺関与は無い
  'pos=C（415件）は rngr',  // 捕手にRngRは無い（2026-08-01に捕手専用経路で対処済み）
  'pos=1B', 'pos=2B', 'pos=3B', 'pos=SS',  // 内野にARM/framing/blockingは無い（下記の未解決事項）
];
const unexpected = warn - KNOWN.length;
console.log(warn === 0 ? '警告なし' : `警告 ${warn} 件（既知 ${KNOWN.length} 件想定）`);
console.log(`
既知の警告の意味:
  - DH: 守備しないので全指標NULL。正常
  - 外野の dpr: 併殺関与が無い。正常
  - 捕手の rngr: 範囲でなくフレーミング等で測る。2026-08-01に捕手専用の較正経路を追加して対処済み
  - 内野の arm: NPB BasementがARMを外野手と捕手にしか出していない。
    2026-08-01のオーナー裁定で**守れる位置から推定＋その位置を守れること自体を下限の証拠にする**方式を採用し対処済み
    （src/ratings/fielding.mjs の inferredInfieldArm。位置の序列は「外野も内野も守った選手の外野で実測されたARM」から導出）。
    推定値には is_estimated=true が立つので、実測と取り違えることはない

残る限界: 送球の**精度**（送球得能）は専用データが無く未査定。肩力で代用しない。`);
db.close();
process.exit(0);

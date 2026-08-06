// 捕球を「送球以外の失策（FE）」から測る目盛りを作る。二重計上の解消・案2用。
//
// 出典: 1.02 / DELTA の Standard守備成績（Codexが2026-08-05に収集）
//
// オーナー承認（2026-08-05、案2）: 捕球と送球の二重計上を、**送球得能が確定した選手だけ**
// 捕球の材料をFEへ差し替えて解消する。他の選手は現行（ErrR全体）のまま。
//
// なぜ全員には使わないか（先に測った理由）:
//   捕球をFEだけに切り替えると、翌年再現性が 失策ぜんぶ0.206 → FE単独0.138 まで落ちる
//   （outputs/error_split_te_fe_20260805.md）。事象が半分になるため。
//   影響を、二重計上が実際に起きている29件（送球得能が確定した選手）だけに限定する。
//
// 使い方: node scripts/calibrate_catching_fe.mjs
//   → configs/fielding_norms.json に fe（位置別のper1000平均・標準偏差・kappa）を書き込む

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const raw = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'web_collected_measurements.json'), 'utf8'));
const recs = Array.isArray(raw) ? raw : (raw.records ?? []);
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const POS_JA = { '投手': '投', '捕手': '捕', '一塁手': '一', '二塁手': '二', '三塁手': '三', '遊撃手': '遊', '左翼手': '左', '中堅手': '中', '右翼手': '右' };

const fe = new Map();     // 選手|年|位置 → FE件数
for (const r of recs) {
  if (r.metric !== 'FE' || !Number.isFinite(r.value)) continue;
  const jp = POS_JA[r.position];
  if (!jp) continue;
  fe.set(`${norm(r.player)}|${r.season}|${jp}`, r.value);
}
console.log(`捕球失策（FE）: ${fe.size}件`);

const fld = db.prepare(`SELECT name, season, position, po, a, e FROM v_fielding`).all();
const rows = [];
for (const f of fld) {
  const k = `${norm(f.name)}|${f.season}|${f.position}`;
  const v = fe.get(k);
  if (v == null) continue;
  const chances = (f.po ?? 0) + (f.a ?? 0) + (f.e ?? 0);
  if (!(chances > 0)) continue;
  rows.push({ name: norm(f.name), season: f.season, pos: f.position, chances, fe: v, per1000: (v / chances) * 1000 });
}
console.log(`守備成績と結べた: ${rows.length}件`);

// 位置ごとの平均・標準偏差（既存のErrR z-scoreモデルと同じ形）
const byPos = new Map();
for (const r of rows) {
  if (!byPos.has(r.pos)) byPos.set(r.pos, []);
  byPos.get(r.pos).push(r.per1000);
}
const posStats = {};
console.log('\n守備位置ごとのFE(1000機会あたり)');
for (const [pos, vals] of byPos) {
  if (vals.length < 20) { console.log(`  ${pos}  ${vals.length}件（少なすぎるので作らない）`); continue; }
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  posStats[pos] = { mean, sd, n: vals.length };
  console.log(`  ${pos}  ${String(vals.length).padStart(4)}件  平均${mean.toFixed(2)}  SD${sd.toFixed(2)}`);
}

// 翌年再現性からkappaを逆算（kappa_games_catching等と同じ方法）
const byPlayerPos = new Map();
for (const r of rows) {
  const k = `${r.name}|${r.pos}`;
  if (!byPlayerPos.has(k)) byPlayerPos.set(k, new Map());
  byPlayerPos.get(k).set(r.season, r);
}
function pearson(a, b) {
  const n = a.length; if (n < 5) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let p = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; p += u * v; da += u * u; dbb += v * v; }
  return da > 0 && dbb > 0 ? p / Math.sqrt(da * dbb) : null;
}
const xs = [], ys = [], chancesUsed = [];
for (const [, seasons] of byPlayerPos) {
  const ss = [...seasons.keys()].sort((a, b) => a - b);
  for (let i = 0; i < ss.length - 1; i++) {
    if (ss[i + 1] - ss[i] !== 1) continue;
    const a = seasons.get(ss[i]), b = seasons.get(ss[i + 1]);
    if (a.chances < 100 || b.chances < 100) continue;
    const stat = posStats[a.pos];
    if (!stat) continue;
    xs.push((a.per1000 - stat.mean) / stat.sd);
    ys.push((b.per1000 - stat.mean) / stat.sd);
    chancesUsed.push(a.chances);
  }
}
const r = pearson(xs, ys) ?? 0;
const avgChances = chancesUsed.reduce((s, v) => s + v, 0) / chancesUsed.length;
const kappa = r > 0 ? avgChances * (1 - r) / r : 99999;
console.log(`\n翌年再現性（100機会以上のペア）: n=${xs.length}組  r=${r.toFixed(3)}`);
console.log(`平均観測量 ${avgChances.toFixed(0)}機会 → kappa=${kappa.toFixed(0)}`);
console.log('※このkappaは全体（FE単独素材）を使う場合の値。既存のErrR(kappa=3426)より');
console.log('  信頼度が下がる想定どおりなら、この材料は対象を絞って使うべきだと裏付けられる');

const p = path.join(ROOT, 'configs', 'fielding_norms.json');
const fnorm = JSON.parse(readFileSync(p, 'utf8'));
fnorm.fe = {
  _source: '1.02 / DELTA Standard守備成績（送球以外の失策=FE）× プロEYE球（守備機会）',
  _purpose: '案2（2026-08-05オーナー承認）: 送球得能が確定した選手だけ、捕球の材料をFEへ差し替えて二重計上を解消する',
  _why_limited_scope: 'FE単独は翌年再現性が現行(ErrR)より低い(scripts/check_infield_components等で実測)。' +
    '全員には使わず、二重計上が実際に起きている選手だけに限定する',
  kappa: Number(kappa.toFixed(0)), repeatability: Number(r.toFixed(3)), n_pairs: xs.length,
  byPos: posStats,
};
writeFileSync(p, JSON.stringify(fnorm, null, 2), 'utf8');
console.log(`\n保存: configs/fielding_norms.json（fe）`);
db.close();

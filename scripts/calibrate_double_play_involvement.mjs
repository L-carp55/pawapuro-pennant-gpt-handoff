// 併殺の各段階（DPS＝始める／DPT＝中継）を守備力の材料として使えるよう、目盛りを合わせる。
//
// 出典: 1.02 / DELTA の Standard守備成績（Codexが2026-08-05に収集）
//
// オーナー承認（2026-08-05）: 併殺の各段階を守備力へ足す。
//
// なぜ加えるか（実測）:
//   翌年との一致（守備機会300以上・位置と年の平均を引いた残差）
//     DPS 二塁 0.436 ／ DPT 遊撃 0.399  ← いま守備力に使っている RngR の 0.256 より高い
//     DPT 二塁 0.288 ／ DPS 遊撃 0.239
//     DPF 一塁 0.055 ← ほぼ再現しない（一塁手は受けるだけで技術差が出ない）。**使わない**
//   置き換えず**足す**。RngRは守備範囲、併殺は「捕ってから投げるまでの速さと確実さ」で別の側面。
//
// ★注意（先に確かめたこと）:
//   DPS+DPT+DPF は既存の「併殺数」と31%食い違う。定義が違うため
//   （既存＝関与した併殺の数／分解側＝その役割で関与した数）。**引き算で復元しようとしない**。
//
// 使い方: node scripts/calibrate_double_play_involvement.mjs
//   → configs/fielding_norms.json に doublePlay（位置ごとの平均・標準偏差・重み）を書き込む

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const raw = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'web_collected_measurements.json'), 'utf8'));
const recs = Array.isArray(raw) ? raw : (raw.records ?? []);

const MIN_CHANCES = 300;
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const POS_JA = { '一塁手': '一', '二塁手': '二', '三塁手': '三', '遊撃手': '遊' };
// 位置ごとに、その役割が実際に技量を映すもの（上の実測で再現したもの）だけを使う
const USE = { '二': ['DPS', 'DPT'], '遊': ['DPS', 'DPT'], '三': ['DPS'], '一': [] };

const vals = new Map();      // metric|season|pos|name → 回数
for (const r of recs) {
  if (!['DPS', 'DPT'].includes(r.metric)) continue;
  const p = POS_JA[r.position];
  if (!p) continue;
  vals.set(`${r.metric}|${norm(r.player)}|${r.season}|${p}`, r.value);
}

const fld = db.prepare(`SELECT name, season, position pos, po, a, e FROM v_fielding
  WHERE season BETWEEN 2019 AND 2025`).all();

function pearson(a, b) {
  const n = a.length; if (n < 5) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let p = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; p += u * v; da += u * u; dbb += v * v; }
  return da > 0 && dbb > 0 ? p / Math.sqrt(da * dbb) : null;
}

const out = {};
console.log('併殺の各段階の目盛り（守備機会300以上）\n');
console.log('役割  位置   人年   1000機会あたり平均   標準偏差   翌年との一致（＝重み）');
for (const metric of ['DPS', 'DPT']) {
  for (const pos of ['二', '遊', '三']) {
    if (!USE[pos]?.includes(metric)) continue;
    const rows = [];
    for (const f of fld) {
      if (f.pos !== pos) continue;
      const v = vals.get(`${metric}|${norm(f.name)}|${f.season}|${pos}`);
      if (v == null) continue;
      const ch = (f.po ?? 0) + (f.a ?? 0) + (f.e ?? 0);
      if (ch < MIN_CHANCES) continue;
      rows.push({ name: norm(f.name), season: f.season, per1000: v / ch * 1000 });
    }
    if (rows.length < 20) { console.log(`${metric}  ${pos}    ${rows.length}  （少なすぎるので作らない）`); continue; }
    const mean = rows.reduce((s, r) => s + r.per1000, 0) / rows.length;
    const sd = Math.sqrt(rows.reduce((s, r) => s + (r.per1000 - mean) ** 2, 0) / rows.length);
    // 翌年再現性（年ごとの平均を引いた残差で見る）
    const byYear = {};
    for (const r of rows) { (byYear[r.season] ??= { s: 0, n: 0 }); byYear[r.season].s += r.per1000; byYear[r.season].n++; }
    const m = new Map();
    for (const r of rows) m.set(`${r.name}|${r.season}`, r.per1000 - byYear[r.season].s / byYear[r.season].n);
    const xs = [], ys = [];
    for (const [k, v] of m) {
      const [n2, s] = k.split('|');
      const w = m.get(`${n2}|${Number(s) + 1}`);
      if (w != null) { xs.push(v); ys.push(w); }
    }
    const rep = pearson(xs, ys) ?? 0;
    out[`${metric}|${pos}`] = {
      mean, sd, players: rows.length, weight: Number(rep.toFixed(3)), pairs: xs.length,
    };
    console.log(`${metric}  ${pos}   ${String(rows.length).padStart(4)}   ${mean.toFixed(2).padStart(10)}   ${sd.toFixed(2).padStart(8)}   ${rep.toFixed(3)}（${xs.length}組）`);
  }
}

const p = path.join(ROOT, 'configs', 'fielding_norms.json');
const norms = JSON.parse(readFileSync(p, 'utf8'));
norms.doublePlay = {
  _source: '1.02 / DELTA Standard守備成績（DPS=併殺を始める／DPT=中継）× プロEYE球（守備機会）',
  _why: '守備力に使っているRngR（翌年一致0.256）より再現性が高い。守備範囲とは別の側面（捕ってから投げるまで）',
  _not_used: 'DPF（最後に受ける）は翌年一致0.055でほぼ再現しないため使わない。一塁手は受けるだけで技術差が出ない',
  _caution: 'DPS+DPT+DPF は既存の併殺数と31%食い違う（定義が違う）。引き算で復元しようとしない',
  _seasons: '2019-2026',
  min_chances: MIN_CHANCES,
  byMetricPos: out,
};
writeFileSync(p, JSON.stringify(norms, null, 2), 'utf8');
console.log(`\n保存: configs/fielding_norms.json（doublePlay）`);
db.close();

// Webから集めた計測値が、実際に査定へ使えるかを1指標ずつ確かめる。
//
// なぜ要るか（2026-08-05）:
//   集めただけでは査定に効かない。今日だけで「受け皿はあるのに届いていない」型を何度も踏んだ。
//   さらに、集めたものの中には **同じ名前で違うものを測っている値** が混ざる。
//   例: throw_speed に「野手の送球速度」と「投手として投げた時の球速」が同居している
//       （根尾昂 150km/h は投手としての最速。送球速度として使うと肩が過大になる）
//
// この道具がすること:
//   1. 指標ごとに、何人と名寄せできるか
//   2. 既に較正済みの能力（走力・肩力）とどれだけ一致するか＝材料として効くか
//   3. 混ざりもの・時期のずれなど、そのまま使えない理由を出す
//   採否は決めない（オーナー判断）。使える/使えない/理由 を並べるところまで。
//
// 使い方: node scripts/audit_web_collected.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'web_collected_measurements.json'), 'utf8'));
const recs = Array.isArray(raw) ? raw : (raw.records ?? []);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
// プロEYE球の選手名（打者）
const players = db.prepare(`SELECT DISTINCT player_id, name FROM v_batting`).all();
const byName = new Map(players.map(p => [norm(p.name), p]));

function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const u = xs[i] - mx, v = ys[i] - my; num += u * v; dx += u * u; dy += v * v; }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
}

// 指標ごとの棚卸し
const byMetric = new Map();
for (const r of recs) {
  if (!byMetric.has(r.metric)) byMetric.set(r.metric, []);
  byMetric.get(r.metric).push(r);
}

console.log(`Webから集めた計測値 ${recs.length}件 / ${byMetric.size}指標\n`);
console.log('指標              件数 人数 名寄せ  年の範囲     単位   注意');
console.log('─'.repeat(100));

const notes = [];
for (const [metric, rows] of [...byMetric].sort((a, b) => b[1].length - a[1].length)) {
  if (metric === 'park_factor_hr') continue;           // 球場は選手ではないので別枠
  const people = new Set(rows.map(r => norm(r.player)));
  const matched = [...people].filter(p => byName.has(p));
  const seasons = rows.map(r => r.season).filter(Number.isFinite);
  const units = [...new Set(rows.map(r => r.unit))];
  const range = seasons.length ? `${Math.min(...seasons)}-${Math.max(...seasons)}` : 'null';

  // 混ざりものの検出: 同じ指標の中で、文脈に「投手」が出るものと出ないもの
  const asPitcher = rows.filter(r => /投手|登板|球速|マウンド/.test(r.context ?? '')).length;
  const amateur = rows.filter(r => /ドラフト|高校|大学|社会人|U18|アマ/.test(r.context ?? '')).length;
  const warn = [];
  if (asPitcher > 0) warn.push(`投手としての記録が${asPitcher}件混在`);
  if (amateur > 0) warn.push(`プロ入り前の計測が${amateur}件`);
  if (units.length > 1) warn.push(`単位が${units.length}種`);

  console.log(`${metric.padEnd(28)} ${String(rows.length).padStart(3)} ${String(people.size).padStart(4)} ${String(matched.length).padStart(4)}人  ${range.padEnd(11)} ${(units[0] ?? '-').padEnd(5)} ${warn.join(' / ')}`);
  if (matched.length >= 3) notes.push({ metric, rows, matched });
}

// ---- 既に較正済みの能力と、どれだけ一致するか ---------------------------------
// 走力は Sprint Speed・一塁到達で、肩力は送球速度・補殺で較正済み。
// そこに新しい材料を重ねる価値があるかは「既存の査定値との相関」で見る。
// 相関が高い＝同じものを測っている（補強になる）／低い＝別のものを測っているか雑音。
console.log('\n\n既に較正済みの査定値との一致（材料として効くか）');
console.log('─'.repeat(100));

const { makeContext, appraiseCard } = await import('../src/cards/pipeline.mjs');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const ctx = makeContext(db, cfg);

// 査定値のキャッシュ（同じ選手を何度も査定しない）
const cache = new Map();
function rate(name, season) {
  const k = `${name}|${season}`;
  if (cache.has(k)) return cache.get(k);
  let v = null;
  try {
    const r = appraiseCard(ctx, { name, mode: String(season), cfg, rv, runNorm, fldNorm });
    v = r.error ? null : r.card.abilities?.基礎能力;
  } catch { v = null; }
  cache.set(k, v);
  return v;
}

// 指標 → 比べる能力／向き（-1は「小さいほど速い/良い」）
const TARGET = {
  '50m': { ability: '走力', sign: -1, note: 'プロ入り前の計測。査定年と時期が離れる' },
  'hp_to_1b': { ability: '走力', sign: -1, note: '一塁到達。バント時と通常打球で条件が違いうる' },
  'sprint_speed': { ability: '走力', sign: +1, note: null },
  'pop_time': { ability: '肩力', sign: -1, note: '二塁送球。捕手のみ。上位ランキング＝ベストケースの1本' },
  'long_throw': { ability: '肩力', sign: +1, note: 'プロ入り前の遠投。送球速度への換算式は未検証' },
  'throw_speed': { ability: '肩力', sign: +1, note: '投手としての球速が混在しうる' },
};

for (const { metric, rows, matched } of notes) {
  const t = TARGET[metric];
  if (!t) { console.log(`${metric.padEnd(22)} 比べる相手が未定（査定側に対応する能力が無い）`); continue; }
  // 1人1値にする（複数の計測がある人は中央値。平均だと外れ値に引っ張られる）
  const per = new Map();
  for (const r of rows) {
    const k = norm(r.player);
    if (!byName.has(k) || !Number.isFinite(r.value)) continue;
    if (!per.has(k)) per.set(k, { vals: [], seasons: [] });
    per.get(k).vals.push(r.value);
    if (Number.isFinite(r.season)) per.get(k).seasons.push(r.season);
  }
  const xs = [], ys = [], names = [];
  for (const [k, v] of per) {
    const sorted = [...v.vals].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    // 査定はその選手の直近の年で取る（プロ入り前の計測は査定年と離れるが、
    // 走る速さ・肩の強さは年でほとんど変わらないという前提は仕様04 §1が置いている）
    const p = byName.get(k);
    const last = db.prepare(`SELECT MAX(season) s FROM v_batting WHERE player_id=? AND pa>=100`).get(p.player_id)?.s;
    if (!last) continue;
    const B = rate(p.name, last);
    const got = B?.[t.ability]?.value;
    if (!Number.isFinite(got)) continue;
    xs.push(med * t.sign); ys.push(got); names.push(p.name);
  }
  const r = pearson(xs, ys);
  console.log(`${metric.padEnd(22)} ${t.ability}と比較  n=${String(xs.length).padStart(3)}  相関 ${r === null ? '  —  ' : (r >= 0 ? '+' : '') + r.toFixed(3)}   ${t.note ?? ''}`);
}

console.log('\n※相関が高い＝同じものを測っている（材料として重ねる価値がある）');
console.log('※相関が低い＝別のものを測っているか、雑音が大きい。採否はオーナー判断');
db.close();

// 走力100人表の「現行モデル」と「候補モデル（統計primary・NPB+自動blendなし）」の差分を出す。
//
// 正本22 §6-4「以前の表との差分を保存」。
// 2つのCSVを選手名で突き合わせ、査定値・raw_diff・段・原因の変化を並べる。
//
// 使い方: node scripts/diff_speed_tables.mjs <現行モデルのCSV> <候補モデルのCSV>

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) { console.error('2つのCSVを渡す'); process.exit(1); }

function parseCSV(t) {
  const rows = []; let f = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; }
      else if (ch === '\n') { f.push(c); rows.push(f); f = []; c = ''; } else if (ch !== '\r') c += ch; } }
  if (c || f.length) { f.push(c); rows.push(f); }
  return rows;
}
const objs = txt => { const r = parseCSV(txt); const H = r[0];
  return r.slice(1).filter(x => x.length > 3).map(x => Object.fromEntries(H.map((h, i) => [h, x[i]]))); };
const num = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };

const before = new Map(objs(readFileSync(beforePath, 'utf8')).map(r => [r.player, r]));
const after = objs(readFileSync(afterPath, 'utf8'));

const rows = [];
for (const a of after) {
  const b = before.get(a.player);
  if (!b) { rows.push({ player: a.player, note: '前の表に無い' }); continue; }
  rows.push({
    player: a.player, team: a.team,
    mineB: num(b.mine), mineA: num(a.mine),
    ppv: num(a.pp),
    diffB: num(b.raw_diff), diffA: num(a.raw_diff),
    tierB: num(b.tier), tierA: num(a.tier),
    causesB: b.causes ?? '', causesA: a.causes ?? '',
    staleB: b.stale ?? '', staleA: a.stale ?? '',
    confB: b.confidence ?? '', confA: a.confidence ?? '',
  });
}
const moved = rows.filter(r => r.mineA != null && r.mineB != null);
const stat = a => { const n = a.length, mu = a.reduce((x, y) => x + y, 0) / n;
  return { n, mu, sd: Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / n) }; };
const SB = stat(moved.map(r => r.mineB)), SA = stat(moved.map(r => r.mineA));
const absB = moved.filter(r => Math.abs(r.diffB ?? 0) >= 5).length;
const absA = moved.filter(r => Math.abs(r.diffA ?? 0) >= 5).length;
const f1 = v => v == null ? '-' : v.toFixed(1);
const sg = v => v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(1);

const L = []; const push = s => L.push(s);
push('# 走力100人表 — 現行モデル → 候補モデル の差分\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('候補モデル = 統計モデルprimary（NPB+の自動blendなし・較正あり）。正本22 §5-C。\n');
push('## 全体の変化\n');
push('```text');
push(`査定値の平均   ${SB.mu.toFixed(1)} → ${SA.mu.toFixed(1)}`);
push(`査定値の幅     ${SB.sd.toFixed(1)} → ${SA.sd.toFixed(1)}`);
push(`|raw_diff|>=5  ${absB}人 → ${absA}人`);
push(`n = ${moved.length}`);
push('```\n');
const up = moved.filter(r => r.mineA - r.mineB > 0).length;
const dn = moved.filter(r => r.mineA - r.mineB < 0).length;
const big = moved.filter(r => Math.abs(r.mineA - r.mineB) >= 10).length;
push(`上がった ${up}人 / 下がった ${dn}人 / 10点以上動いた ${big}人\n`);
push('## 段の移動\n');
const tierMove = {};
for (const r of moved) { const k = `${r.tierB}→${r.tierA}`; tierMove[k] = (tierMove[k] ?? 0) + 1; }
push('| 前の段 → 後の段 | 人数 |');
push('|---|---|');
for (const [k, v] of Object.entries(tierMove).sort()) push(`| ${k} | ${v} |`);
push('');
push('## 動きが大きい順（上位25人）\n');
push('| 選手 | 査定 前→後 | 変化 | PowerPro | raw_diff 前→後 | 段 前→後 | 原因(後) | stale(後) |');
push('|---|---|---|---|---|---|---|---|');
for (const r of moved.sort((a, b) => Math.abs(b.mineA - b.mineB) - Math.abs(a.mineA - a.mineB)).slice(0, 25))
  push(`| ${r.player} | ${f1(r.mineB)} → ${f1(r.mineA)} | ${sg(r.mineA - r.mineB)} | ${f1(r.ppv)} | ${sg(r.diffB)} → ${sg(r.diffA)} | ${r.tierB}→${r.tierA} | ${r.causesA || '-'} | ${r.staleA || '-'} |`);
push('');
push('## 原因分類の変化\n');
const countCause = (key) => { const c = {};
  for (const r of moved) for (const x of (r[key] || '').split('|').filter(Boolean)) c[x] = (c[x] ?? 0) + 1;
  return c; };
const cb = countCause('causesB'), ca = countCause('causesA');
push('| 原因 | 現行 | 候補 |');
push('|---|---|---|');
for (const k of new Set([...Object.keys(cb), ...Object.keys(ca)])) push(`| ${k} | ${cb[k] ?? 0} | ${ca[k] ?? 0} |`);
push('');
push('## PowerPro据え置き判定の変化\n');
const cs = (key) => { const c = {}; for (const r of moved) c[r[key] || '-'] = (c[r[key] || '-'] ?? 0) + 1; return c; };
const sb = cs('staleB'), sa = cs('staleA');
push('| 判定 | 現行 | 候補 |');
push('|---|---|---|');
for (const k of new Set([...Object.keys(sb), ...Object.keys(sa)])) push(`| ${k} | ${sb[k] ?? 0} | ${sa[k] ?? 0} |`);

writeFileSync(path.join(ROOT, 'outputs', 'speed_table_diff_current_vs_candidate.md'), L.join('\n'), 'utf8');

const csv = ['player,mine_current,mine_candidate,delta,pp,raw_diff_current,raw_diff_candidate,tier_current,tier_candidate,causes_candidate,stale_candidate'];
for (const r of moved) csv.push([r.player, r.mineB, r.mineA, (r.mineA - r.mineB).toFixed(2), r.ppv,
  r.diffB ?? '', r.diffA ?? '', r.tierB, r.tierA, `"${r.causesA}"`, r.staleA].join(','));
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_table_diff_current_vs_candidate.csv'), csv.join('\n'), 'utf8');

console.log(`n=${moved.length} 平均 ${SB.mu.toFixed(1)}→${SA.mu.toFixed(1)} 幅 ${SB.sd.toFixed(1)}→${SA.sd.toFixed(1)} |diff|>=5 ${absB}→${absA}人`);
console.log(`上がった${up} / 下がった${dn} / 10点以上動いた${big}`);

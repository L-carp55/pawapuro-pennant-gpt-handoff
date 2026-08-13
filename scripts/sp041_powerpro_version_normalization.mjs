// SP-041 — PowerProの版正規化・分布・percentile軌跡
//
// 正本: docs/state/speed_task_registry.tsv SP-041（owner_review blocker / gate blocker）
//   next_action: "Normalize same-date/version conflicts and edition distributions;
//                 build percentile/quantile trajectories."
//
// ■ なぜ要るか
//   「2018年に68、2026年も68だから据え置き」という読みは、
//   **版ごとに走力の分布そのものが動いていない**ことを前提にしている。
//   もし版間で分布がずれていれば、同じ68でもリーグ内の位置は違う。
//   したがって stale 判定（SP-042）の前に、版の正規化と percentile 軌跡が要る。
//
// ■ やること
//   1. 同一日・同一版の重複観測を数え、正規化規則を決めて適用する
//   2. 版ごとの走力分布（n / 平均 / 標準偏差 / 分位点）を出し、版間で比較可能か判定する
//   3. 各選手の履歴を「素点」と「その版内のpercentile」の2本で持つ
//
// 使い方: node scripts/sp041_powerpro_version_normalization.mjs <GPT成果物のディレクトリ>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) { console.error('GPT成果物のディレクトリを渡す'); process.exit(1); }

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

const panel = objs(readFileSync(path.join(SRC, 'pawapuro_speed_history_panel_2015_2026.csv'), 'utf8'))
  .map(r => ({ pid: r.canonical_player_id, name: r.canonical_player_name || r.player_name || r.display_name,
    work: r.work, version: r.version || r.official_version || r.archive_version || '',
    date: r.update_date || '', speed: num(r.speed) }))
  .filter(r => r.speed != null && r.pid);

// 版キー = work + version（同じ作品でもupdateで分布が動きうるため両方持つ）
const vkey = r => `${r.work}|${r.version || '-'}`;

// ── 1. 同一日・同一版の重複観測 ────────────────────────────────────
const dupMap = new Map();     // pid|vkey|date -> [speed...]
for (const r of panel) {
  const k = `${r.pid}|${vkey(r)}|${r.date}`;
  if (!dupMap.has(k)) dupMap.set(k, []);
  dupMap.get(k).push(r.speed);
}
let dupGroups = 0, dupConflict = 0, dupIdentical = 0;
for (const [, v] of dupMap) {
  if (v.length < 2) continue;
  dupGroups++;
  if (new Set(v).size === 1) dupIdentical++; else dupConflict++;
}

// 正規化規則: 同一選手・同一版・同一日の重複は
//   値が全部同じ → 1件へ畳む（情報は失われない）
//   値が違う     → **中央値**を採る（平均だと外れ値1件で動くため）。畳んだ事実を記録する
const median = a => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const normalized = [];
const collapsed = [];
for (const [k, v] of dupMap) {
  const [pid, work, version, ...rest] = [];   // 使わない（keyは下で分解）
  const parts = k.split('|');
  const date = parts.pop(); const ver = parts.pop(); const wk = parts.pop(); const id = parts.join('|');
  const speed = v.length === 1 ? v[0] : median(v);
  if (v.length > 1) collapsed.push({ pid: id, work: wk, version: ver, date, values: v, chosen: speed,
    rule: new Set(v).size === 1 ? 'IDENTICAL_COLLAPSE' : 'MEDIAN_OF_CONFLICT' });
  normalized.push({ pid: id, work: wk, version: ver, date, speed, vkey: `${wk}|${ver}` });
}

// ── 2. 版ごとの分布 ────────────────────────────────────────────────
const byV = new Map();
for (const r of normalized) { if (!byV.has(r.vkey)) byV.set(r.vkey, []); byV.get(r.vkey).push(r.speed); }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const versions = [...byV.entries()]
  .map(([k, v]) => ({ vkey: k, n: v.length, mean: mean(v), sd: sd(v),
    p10: q(v, 0.10), p50: q(v, 0.50), p90: q(v, 0.90) }))
  .filter(v => v.n >= 30)
  .sort((a, b) => a.vkey.localeCompare(b.vkey));

const meanSpread = versions.length ? Math.max(...versions.map(v => v.mean)) - Math.min(...versions.map(v => v.mean)) : 0;
const sdSpread = versions.length ? Math.max(...versions.map(v => v.sd)) - Math.min(...versions.map(v => v.sd)) : 0;

// ── 3. percentile 軌跡 ────────────────────────────────────────────
// 各観測を、その版の中でのpercentileへ変換する。素点は捨てない（両方持つ）。
const sortedByV = new Map([...byV].map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
const pctOf = (vk, s) => { const arr = sortedByV.get(vk); if (!arr || arr.length < 30) return null;
  let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < s) lo = m + 1; else hi = m; }
  return lo / arr.length; };
for (const r of normalized) r.pct = pctOf(r.vkey, r.speed);

// 選手ごとの軌跡（素点とpercentileの両方）
const byP = new Map();
for (const r of normalized) { if (!byP.has(r.pid)) byP.set(r.pid, []); byP.get(r.pid).push(r); }
const yearOf = s => { const m = String(s ?? '').match(/(20\d\d)/); return m ? +m[1] : null; };
const traj = [];
for (const [pid, rs] of byP) {
  const seq = rs.map(r => ({ y: yearOf(r.date) ?? yearOf(r.work), speed: r.speed, pct: r.pct }))
    .filter(x => x.y != null).sort((a, b) => a.y - b.y);
  if (!seq.length) continue;
  const byYear = new Map();
  for (const x of seq) byYear.set(x.y, x);      // 同年は最後の版
  const out = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, x]) => ({ y, ...x }));
  // 素点は動いていないのにpercentileが動いた＝リーグが動いた分だけ相対位置が変わった
  const rawPoints = out.filter((x, i) => i === 0 || x.speed !== out[i - 1].speed);
  const pctVals = out.map(x => x.pct).filter(v => v != null);
  traj.push({ pid, name: rs[0] ? (byP.get(pid)[0].name ?? '') : '', years: out.length,
    raw_first: out[0].speed, raw_last: out.at(-1).speed, raw_changes: rawPoints.length - 1,
    pct_first: out[0].pct, pct_last: out.at(-1).pct,
    pct_drift: (pctVals.length >= 2) ? pctVals.at(-1) - pctVals[0] : null,
    raw_flat_but_pct_moved: rawPoints.length - 1 === 0 && pctVals.length >= 2
      && Math.abs(pctVals.at(-1) - pctVals[0]) >= 0.05,
    text_raw: out.map(x => `${x.y}:${x.speed}`).join(' → '),
    text_pct: out.map(x => `${x.y}:${x.pct == null ? '-' : (x.pct * 100).toFixed(0) + '%'}`).join(' → ') });
}
const flatButMoved = traj.filter(t => t.raw_flat_but_pct_moved);

// ── 出力 ───────────────────────────────────────────────────────────
const f2 = v => v == null ? '-' : v.toFixed(2);
const L = []; const push = s => L.push(s);
push('# SP-041 — PowerPro の版正規化・分布・percentile軌跡\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('## なぜ要るか\n');
push('「2018年に68、2026年も68だから据え置き」という読みは、**版ごとに走力の分布が動いていない**');
push('ことを前提にしている。版間で分布がずれていれば、同じ68でもリーグ内の位置は違う。');
push('したがって stale 判定（SP-042）の前に、版の正規化と percentile 軌跡が要る。\n');
push('## 1. 同一日・同一版の重複観測\n');
push('```text');
push(`観測総数            ${panel.length}`);
push(`選手×版×日 の組     ${dupMap.size}`);
push(`重複していた組       ${dupGroups}`);
push(`  値が同じ（畳むだけ） ${dupIdentical}`);
push(`  値が食い違う         ${dupConflict}`);
push('```');
push('正規化規則:\n');
push('| 状況 | 規則 | 理由 |');
push('|---|---|---|');
push('| 値が全部同じ | 1件へ畳む | 情報は失われない |');
push('| 値が食い違う | **中央値**を採る | 平均だと外れ値1件で動く。畳んだ事実は記録する |');
push('');
push(`畳んだ記録は \`outputs/derived/sp041_powerpro_normalized.json\` の \`collapsed\` に全件保存（${collapsed.length}件）。\n`);
push('## 2. 版ごとの分布（n>=30の版のみ）\n');
push('```text');
push(`版の数        ${versions.length}`);
push(`平均の振れ幅  ${f2(meanSpread)}点   （版間で中心がどれだけ動くか）`);
push(`幅の振れ幅    ${f2(sdSpread)}点   （版間でばらつきがどれだけ動くか）`);
push('```');
push('| 版 | n | 平均 | 幅 | p10 | p50 | p90 |');
push('|---|---|---|---|---|---|---|');
for (const v of versions.slice(0, 30)) push(`| ${v.vkey} | ${v.n} | ${f2(v.mean)} | ${f2(v.sd)} | ${v.p10} | ${v.p50} | ${v.p90} |`);
if (versions.length > 30) push(`| … 他${versions.length - 30}版 | | | | | | |`);
push('');
push(meanSpread >= 3
  ? `**版間で中心が${f2(meanSpread)}点動いている。素点をそのまま年跨ぎで比べてはいけない。**\n`
  : `版間の中心の動きは${f2(meanSpread)}点で小さい。素点の年跨ぎ比較は概ね成立する。\n`);
push('## 3. percentile 軌跡\n');
push('各観測を「その版の中での位置（percentile）」へ変換した。**素点は捨てず両方持つ。**\n');
push('```text');
push(`軌跡を作れた選手 ${traj.length}人`);
push(`素点は一度も動いていないのに、リーグ内の位置が5ポイント以上動いた選手 ${flatButMoved.length}人`);
push('```');
if (flatButMoved.length) {
  push('この選手たちは「据え置き」だが、**リーグが動いたぶん相対的な位置は変わっている**。');
  push('SP-042 の stale 判定では、素点の据え置きだけでなくこの動きも見る必要がある。\n');
  push('| 選手 | 素点の推移 | リーグ内の位置の推移 | 位置の変化 |');
  push('|---|---|---|---|');
  for (const t of flatButMoved.sort((a, b) => Math.abs(b.pct_drift) - Math.abs(a.pct_drift)).slice(0, 25))
    push(`| ${t.name || t.pid} | ${t.text_raw} | ${t.text_pct} | ${t.pct_drift > 0 ? '+' : ''}${(t.pct_drift * 100).toFixed(0)}pt |`);
  push('');
}
push('## 4. SP-042 への申し送り\n');
push('- stale 判定は**素点の据え置き年数だけ**で決めない。percentile の動きを併せて見る');
push('- 素点据え置き かつ percentile も動いていない → 本当に評価が動いていない');
push('- 素点据え置き だが percentile が動いた → リーグ側が動いた結果で、選手の評価が古いとは限らない');
push('- 版間で中心が動く場合、年跨ぎの「何点上がった/下がった」は percentile で言い直す\n');
push('## 5. 限界\n');
push('- 版ごとの分布は**その版に載っている選手の顔ぶれ**にも依存する。');
push('  新人の大量追加や引退で分布が動いた分と、査定方針が動いた分は、この方法では分離できない');
push('- `n>=30` の版だけを対象にした。小さい版は percentile を出していない（0で埋めていない）');

writeFileSync(path.join(ROOT, 'outputs', 'sp041_powerpro_version_normalization.md'), L.join('\n'), 'utf8');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp041_powerpro_normalized.json'),
  JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10),
    counts: { observations: panel.length, groups: dupMap.size, duplicated: dupGroups,
      identical: dupIdentical, conflicting: dupConflict, versions: versions.length, trajectories: traj.length },
    normalization_rule: { identical: 'collapse', conflict: 'median' },
    collapsed, versions, trajectories: traj }, null, 2), 'utf8');

const csv = ['pid,name,years,raw_first,raw_last,raw_changes,pct_first,pct_last,pct_drift,raw_flat_but_pct_moved'];
for (const t of traj) csv.push([t.pid, `"${(t.name || '').replace(/"/g, '""')}"`, t.years, t.raw_first, t.raw_last,
  t.raw_changes, t.pct_first ?? '', t.pct_last ?? '', t.pct_drift ?? '', t.raw_flat_but_pct_moved].join(','));
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp041_powerpro_percentile_trajectories.csv'), csv.join('\n'), 'utf8');

console.log(`観測${panel.length} / 重複組${dupGroups}（食い違い${dupConflict}） / 版${versions.length}`);
console.log(`版間の中心の振れ ${f2(meanSpread)}点 / 幅の振れ ${f2(sdSpread)}点`);
console.log(`軌跡${traj.length}人 / 素点据え置きだが位置が動いた ${flatButMoved.length}人`);

// SP-052 — The Show 走力 → PowerPro 走力 の same-time mapping 方式比較（SR-025）。
//
// ■ 何をするか
//   The Show の speed（0-125スケール、Liveは実質0-99帯）から PowerPro 走力（0-100）への
//   変換を、linear / isotonic / piecewise / quantile の4方式で比較し、band別MAEを出す。
//
// ■ same-time である条件
//   The Show は edition（年）ごとに値を持つ（the_show_rating、17,476行）。
//   PowerPro も SP-041 の版正規化パネルで年ごとの値を持つ。
//   **同じ年同士でペアを作る**。年をまたいで平均した値同士を突き合わせない。
//
// ■ ホールドアウトの扱い（configs/holdout_mlb_bridge.json）
//   - test_players は原則として封印。fitに一切使わない
//   - ただし `_exposed_excluded` に載っている選手は「一度値を見てしまったので試験に使えない」
//     という既存の運用にならい train 側へ回す
//   - ★2026-08-13、本タスクの下調べで `ハイネマン` の (The Show, PowerPro) の組を
//     画面に出してしまった。恣意的な選び直しではなく露出の事実に基づき exposed へ追加する
//
// ■ 予想される結論
//   封印されたまま残る test 選手のうち The Show と PowerPro の両方を持つ人数が少ないため、
//   独立ホールドアウトによる検証は成立しない可能性が高い。その場合は
//   **leave-one-out 交差検証による方式比較まで**とし、「ホールドアウト検証済み」とは書かない。
//
// 使い方: node scripts/sp052_the_show_to_powerpro_mapping.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

// ── ホールドアウト ────────────────────────────────────────
const ho = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'holdout_mlb_bridge.json'), 'utf8'));
const EXPOSED = new Set([...(ho._exposed_excluded?.players ?? []).map(nk), nk('ハイネマン')]);
const SEALED_TEST = new Set((ho.test_players ?? []).filter(p => !EXPOSED.has(nk(p.name))).map(p => p.proeye_id));

// ── The Show: 選手×edition の speed ────────────────────────
// the_show_bridge が name_key で NPB選手へ紐づいているので、それを経由して per-edition を引く
const bridge = db.prepare(`SELECT proeye_id, npb_name, name_key FROM the_show_bridge`).all();
const showByPidYear = new Map();   // pid -> Map(year -> [speed...])
const stShow = db.prepare(`SELECT edition, speed FROM the_show_rating WHERE name_key=? AND is_hitter=1 AND speed IS NOT NULL`);
for (const b of bridge) {
  for (const r of stShow.all(b.name_key)) {
    // edition は "mlb21" / "mlb26" のような2桁年表記（4桁ではない）
    const m2 = String(r.edition).match(/(\d{2})\s*$/);
    const y = m2 ? 2000 + parseInt(m2[1], 10) : NaN;
    if (!Number.isFinite(y)) continue;
    if (!showByPidYear.has(b.proeye_id)) showByPidYear.set(b.proeye_id, new Map());
    const m = showByPidYear.get(b.proeye_id);
    if (!m.has(y)) m.set(y, []);
    m.get(y).push(r.speed);
  }
}

// ── PowerPro: SP-041 パネルの text_raw から 年→素点 を復元 ──────────
const pp = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp041_powerpro_normalized.json'), 'utf8'));
const ppByPidYear = new Map();
for (const t of pp.trajectories) {
  const pid = String(t.pid).replace(/^proeye:/, '');
  const m = new Map();
  for (const seg of String(t.text_raw ?? '').split('→')) {
    const mm = seg.trim().match(/^(\d{4}):(\d+)/);
    if (mm) m.set(parseInt(mm[1], 10), parseInt(mm[2], 10));
  }
  if (m.size) ppByPidYear.set(pid, m);
}

// ── same-time ペア作成 ────────────────────────────────────
const pairs = [];
const nameOf = new Map(bridge.map(b => [b.proeye_id, b.npb_name]));
for (const [pid, showYears] of showByPidYear) {
  const ppYears = ppByPidYear.get(pid);
  if (!ppYears) continue;
  for (const [y, speeds] of showYears) {
    if (!ppYears.has(y)) continue;                       // ★同じ年だけ
    const show = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    pairs.push({ pid, name: nameOf.get(pid), year: y, show, powerpro: ppYears.get(y),
      sealed: SEALED_TEST.has(pid) });
  }
}
const fitPairs = pairs.filter(p => !p.sealed);
const testPairs = pairs.filter(p => p.sealed);

// ── 4方式 ──────────────────────────────────────────────
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function fitLinear(rows) {
  const xs = rows.map(r => r.show), ys = rows.map(r => r.powerpro);
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const b = den > 0 ? num / den : 0, a = my - b * mx;
  return x => a + b * x;
}
// 単調回帰（PAVA）。The Showが速いほどPowerProも速い、という単調性だけを仮定する
function fitIsotonic(rows) {
  const s = [...rows].sort((p, q) => p.show - q.show);
  const blocks = s.map(r => ({ sum: r.powerpro, w: 1, x: r.show }));
  for (let i = 1; i < blocks.length;) {
    if (blocks[i - 1].sum / blocks[i - 1].w <= blocks[i].sum / blocks[i].w) { i++; continue; }
    blocks[i - 1].sum += blocks[i].sum; blocks[i - 1].w += blocks[i].w;
    blocks[i - 1].x = Math.max(blocks[i - 1].x, blocks[i].x);
    blocks.splice(i, 1); if (i > 1) i--;
  }
  const knots = blocks.map(b => ({ x: b.x, y: b.sum / b.w }));
  return x => {
    if (x <= knots[0].x) return knots[0].y;
    for (let i = 1; i < knots.length; i++) {
      if (x <= knots[i].x) {
        const t = (x - knots[i - 1].x) / Math.max(1e-9, knots[i].x - knots[i - 1].x);
        return knots[i - 1].y + t * (knots[i].y - knots[i - 1].y);
      }
    }
    return knots[knots.length - 1].y;
  };
}
// 2区間の折れ線。中央値で折る（ノットを探索して過適合させない）
function fitPiecewise(rows) {
  const xs = [...rows.map(r => r.show)].sort((a, b) => a - b);
  const knot = xs[Math.floor(xs.length / 2)];
  const lo = rows.filter(r => r.show <= knot), hi = rows.filter(r => r.show > knot);
  if (lo.length < 3 || hi.length < 3) return fitLinear(rows);
  const fLo = fitLinear(lo), fHi = fitLinear(hi);
  return x => x <= knot ? fLo(x) : fHi(x);
}
// 分位点マッピング（順位を保った分布合わせ。線形性も単調な関数形も仮定しない）
function fitQuantile(rows) {
  const sx = [...rows.map(r => r.show)].sort((a, b) => a - b);
  const sy = [...rows.map(r => r.powerpro)].sort((a, b) => a - b);
  return x => {
    let lo = 0, hi = sx.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sx[mid] < x) lo = mid + 1; else hi = mid; }
    const q = sx.length > 1 ? lo / (sx.length - 1) : 0;
    const pos = q * (sy.length - 1);
    const i = Math.floor(pos), t = pos - i;
    return i + 1 < sy.length ? sy[i] + t * (sy[i + 1] - sy[i]) : sy[sy.length - 1];
  };
}
const METHODS = { linear: fitLinear, isotonic: fitIsotonic, piecewise: fitPiecewise, quantile: fitQuantile };

// ── leave-one-out 交差検証（選手単位。同一選手の複数年が train と test に割れないようにする） ──
const pids = [...new Set(fitPairs.map(p => p.pid))];
const loo = {};
for (const [name, fit] of Object.entries(METHODS)) {
  const errs = [];
  for (const heldPid of pids) {
    const tr = fitPairs.filter(p => p.pid !== heldPid);
    const te = fitPairs.filter(p => p.pid === heldPid);
    if (tr.length < 6) continue;
    const f = fit(tr);
    for (const t of te) errs.push({ err: Math.abs(f(t.show) - t.powerpro), show: t.show });
  }
  loo[name] = { n: errs.length, mae: +mean(errs.map(e => e.err)).toFixed(3), _errs: errs };
}
// baseline: 平均値を返すだけ
{
  const errs = [];
  for (const heldPid of pids) {
    const tr = fitPairs.filter(p => p.pid !== heldPid);
    const te = fitPairs.filter(p => p.pid === heldPid);
    if (tr.length < 6) continue;
    const m = mean(tr.map(r => r.powerpro));
    for (const t of te) errs.push({ err: Math.abs(m - t.powerpro), show: t.show });
  }
  loo.baseline_mean = { n: errs.length, mae: +mean(errs.map(e => e.err)).toFixed(3), _errs: errs };
}

// ── band別MAE ─────────────────────────────────────────
const allShow = fitPairs.map(p => p.show).sort((a, b) => a - b);
const b1 = allShow[Math.floor(allShow.length / 3)], b2 = allShow[Math.floor(allShow.length * 2 / 3)];
const bandOf = x => x <= b1 ? `low(<=${b1})` : x <= b2 ? `mid(${b1}-${b2})` : `high(>${b2})`;
const byBand = {};
for (const [name, r] of Object.entries(loo)) {
  const g = {};
  for (const e of r._errs) { const b = bandOf(e.show); (g[b] = g[b] || []).push(e.err); }
  byBand[name] = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { n: v.length, mae: +mean(v).toFixed(3) }]));
  delete r._errs;
}

// ── ★時間的分離の診断（same-time が成立しうるかそのものの検査） ─────────────
// NPB→MLBへ移った選手は、The Show では MLB 在籍年、PowerPro では NPB 在籍年に
// 値を持つ。この2つは経歴上ほぼ連続しない別区間なので、same-time ペアが原理的に作れない。
const disjoint = { both_have_data: 0, has_same_year: 0, fully_disjoint: 0, examples: [] };
for (const [pid, showYears] of showByPidYear) {
  const ppYears = ppByPidYear.get(pid);
  if (!ppYears) continue;
  disjoint.both_have_data++;
  const sy = [...showYears.keys()].sort((a, b) => a - b);
  const py = [...ppYears.keys()].sort((a, b) => a - b);
  if (sy.some(y => ppYears.has(y))) disjoint.has_same_year++;
  else {
    disjoint.fully_disjoint++;
    if (disjoint.examples.length < 8) disjoint.examples.push(
      `${nameOf.get(pid)}: Show[${sy.join(',')}] PowerPro[${py[0]}-${py[py.length - 1]}]`);
  }
}

const out = {
  generated_at: '2026-08-13',
  task: 'SP-052 The Show → PowerPro same-time mapping model comparison (SR-025)',
  temporal_disjointness: {
    ...disjoint,
    interpretation: 'The Showは選手のMLB在籍年、PowerProはNPB在籍年に値を持つ。両者は経歴上ほぼ連続しない別区間のため、same-timeペアが構造的に作れない。これはデータ収集の不足ではなく母集団の性質',
  },
  same_time_rule: 'The Show の edition年 と PowerPro の版年が一致するペアのみ使用（年をまたいだ平均同士を突き合わせない）',
  pairs: { total: pairs.length, unique_players: new Set(pairs.map(p => p.pid)).size,
    fit_pairs: fitPairs.length, fit_players: pids.length,
    sealed_test_pairs: testPairs.length, sealed_test_players: new Set(testPairs.map(p => p.pid)).size },
  holdout: {
    config: 'configs/holdout_mlb_bridge.json',
    newly_exposed_this_session: ['ハイネマン'],
    newly_exposed_reason: '2026-08-13 SP-052の下調べで (The Show, PowerPro) の組を画面出力してしまったため。露出の事実に基づき train 側へ回す（既存 _exposed_excluded と同じ運用）',
    usable_for_validation: null,   // 下で判定
  },
  loo_cv_by_player: loo,
  mae_by_band: byBand,
  band_edges: { low_max: b1, mid_max: b2 },
};
out.holdout.usable_for_validation = out.pairs.sealed_test_players >= 5;
out.verdict = out.holdout.usable_for_validation
  ? 'ホールドアウト検証が可能'
  : `独立ホールドアウト検証は不成立（封印されたまま両方の値を持つ選手が ${out.pairs.sealed_test_players} 人しかいない）。方式比較は leave-one-out 交差検証までとし、「ホールドアウト検証済み」とは書かない`;

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp052_the_show_to_powerpro_mapping.json'), JSON.stringify(out, null, 2));

console.log(`★時間的分離: 両方のデータを持つ ${disjoint.both_have_data}人 中、同一年あり ${disjoint.has_same_year}人 / 完全分離 ${disjoint.fully_disjoint}人`);
disjoint.examples.slice(0, 5).forEach(e => console.log('   ' + e));
console.log(`
same-timeペア: ${out.pairs.total}件 / ${out.pairs.unique_players}人`);
console.log(`  fit: ${out.pairs.fit_pairs}件 / ${out.pairs.fit_players}人`);
console.log(`  封印test: ${out.pairs.sealed_test_pairs}件 / ${out.pairs.sealed_test_players}人`);
console.log(`\nleave-one-out CV (選手単位):`);
for (const [k, v] of Object.entries(loo)) console.log(`  ${k.padEnd(16)} MAE=${v.mae} (n=${v.n})`);
console.log(`\nband別MAE (low<=${b1} / mid / high>${b2}):`);
for (const [k, v] of Object.entries(byBand)) console.log(`  ${k.padEnd(16)}`, JSON.stringify(v));
console.log(`\n判定: ${out.verdict}`);

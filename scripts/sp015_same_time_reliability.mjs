// SP-015 — 年度査定のcomponent weightを「翌年再現性」から外し、同時点の量で組み直す。
//
// 正本:
//   CLAUDE.md §年度査定の目的関数（2026-08-05 owner rule）
//   docs/audits/speed_next_year_repeatability_policy_correction_20260813.md §2 / §3
//   docs/state/speed_task_registry.tsv SP-015（owner_review blocker / gate blocker）
//
// ■ 何が違反だったか
//   configs/running_norms.json の componentWeights は
//   triple 0.695 / gdpAvoid 0.620 / infieldHit 0.586 / advance 0.527 / ubr 0.445 で、
//   これは**Year Y→Y+1の一致（翌年再現性）**そのもの。年度査定のweightに使ってはいけない。
//
// ■ 代わりに何を使うか（正本 §3 の区別）
//   A. 翌年再現性        … 使わない
//   B. 同時点の測定信頼性 … 使ってよい
//   C. サンプル由来の推定誤差 … 使ってよい
//
//   本スクリプトは **B/C だけ** から weight を計算する。
//   各材料は「率」なので、その年の試行回数から**標本誤差が解析的に出る**。
//     reliability = 1 - E[標本誤差の分散] / 観測された選手間分散
//   これは1シーズン内で完結し、翌年の情報を一切含まない。
//
// ■ 恣意的な置換をしない（SP-015 の完了条件）
//   単一の新weightを置かず、3方式を並べて感度を出す:
//     legacy（翌年再現性・違反。対照として残すだけ）
//     equal（等重み）
//     same_time_reliability（本方式）
//   採否の根拠は保存し、翌年予測性能は判定に使わない。
//
// 使い方: node scripts/sp015_same_time_reliability.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const runNorm = J('running_norms.json');
const nrm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const SEASONS = [2021, 2022, 2023, 2024, 2025];
const MIN_PA = 150;

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const stmt = db.prepare(`
  SELECT b.season, b.player_id, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp,
         bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=? AND b.position<>'投'`);

// 材料ごとに「率 p と試行回数 n」を取り出す。標本誤差 = p(1-p)/n（二項）。
// ubr は回数で表せない合成指標なので、この方法では信頼性を出せない＝除外して理由を残す。
const MATERIALS = {
  triple:     { label: '三塁打割合',   pn: r => ({ p: (r.b2 + r.b3) > 0 ? r.b3 / (r.b2 + r.b3) : null, n: r.b2 + r.b3 }) },
  gdpAvoid:   { label: '併殺回避',     pn: r => { const inplay = Math.max(1, r.ab - r.so);
                  const gb = Math.max(1, inplay * ((r.gb_pct ?? runNorm.leagueGbPct) / 100));
                  return { p: r.gdp / gb, n: gb }; } },
  infieldHit: { label: '内野安打率',   pn: r => { const inplay = Math.max(1, r.ab - r.so);
                  return { p: r.ih == null ? null : r.ih / inplay, n: inplay }; } },
};

const rowsBySeason = new Map(SEASONS.map(s => [s, stmt.all(s, MIN_PA)]));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const varOf = a => { const m = mean(a); return mean(a.map(x => (x - m) ** 2)); };

const rel = {};   // material -> {seasons:[], reliability, note}
for (const [key, spec] of Object.entries(MATERIALS)) {
  const perSeason = [];
  for (const s of SEASONS) {
    const vals = [];
    for (const r of rowsBySeason.get(s)) {
      const { p, n } = spec.pn(r);
      if (p == null || !Number.isFinite(p) || !(n > 0)) continue;
      vals.push({ p, n, se2: p * (1 - p) / n });
    }
    if (vals.length < 30) continue;
    const obsVar = varOf(vals.map(v => v.p));          // 観測された選手間のばらつき
    const errVar = mean(vals.map(v => v.se2));         // 標本誤差の平均分散（同時点）
    const r2 = obsVar > 0 ? Math.max(0, 1 - errVar / obsVar) : 0;
    perSeason.push({ season: s, n: vals.length, obsVar, errVar, reliability: r2 });
  }
  rel[key] = { label: spec.label, perSeason,
    reliability: perSeason.length ? mean(perSeason.map(x => x.reliability)) : null };
}

// advance は1球データのイベント単位なので、試行回数（機会数）から同じ形で出す
{
  const perSeason = [];
  for (const s of SEASONS) {
    const vals = [];
    for (const r of rowsBySeason.get(s)) {
      const a = advanceOf(db, nrm(r.name), s);
      if (!a || !(a.chances > 0)) continue;
      // advance は難易度調整済みの「平均との差」。成功率の標本誤差で近似する
      const pHat = Math.min(0.999, Math.max(0.001, 0.5 + a.value));
      vals.push({ p: a.value, n: a.chances, se2: pHat * (1 - pHat) / a.chances });
    }
    if (vals.length < 30) continue;
    const obsVar = varOf(vals.map(v => v.p));
    const errVar = mean(vals.map(v => v.se2));
    perSeason.push({ season: s, n: vals.length, obsVar, errVar,
      reliability: obsVar > 0 ? Math.max(0, 1 - errVar / obsVar) : 0 });
  }
  rel.advance = { label: '自作の走塁指標', perSeason,
    reliability: perSeason.length ? mean(perSeason.map(x => x.reliability)) : null };
}
// ubr は回数で表せないため同時点の標本誤差を解析的に出せない
rel.ubr = { label: '走塁貢献(UBR)', perSeason: [], reliability: null,
  note: '合成指標で試行回数に分解できず、同時点の標本誤差を解析的に出せない。'
      + '翌年再現性を代用してはいけないため、weightは同時点で測れる材料から決め、'
      + 'UBRは等重み扱い（下記sensitivityで影響を確認）とする' };

db.close();

// ── 3方式のweight ─────────────────────────────────────────────────
const legacy = runNorm.componentWeights;
const keys = ['triple', 'gdpAvoid', 'infieldHit', 'advance', 'ubr'];
const measurable = keys.filter(k => rel[k].reliability != null);
const relW = {}; for (const k of keys) relW[k] = rel[k].reliability ?? null;
// UBRは測れないので、測れた材料の中央値を仮に当てる（恣意を避けるため中央値。感度で確認）
const medRel = [...measurable.map(k => rel[k].reliability)].sort((a, b) => a - b)[Math.floor(measurable.length / 2)];
const sameTime = {}; for (const k of keys) sameTime[k] = rel[k].reliability ?? medRel;
const equal = {}; for (const k of keys) equal[k] = 1;

// ── 感度: 3方式で合成zがどれだけ変わるか（翌年予測は判定に使わない）──
const { speedComponents } = await import('../src/ratings/running.mjs');
const S = 2025;

const schemes = { legacy, equal, same_time_reliability: sameTime };
const scoreWith = (z, W) => { let s = 0, w = 0;
  for (const [k, v] of Object.entries(z)) { if (v == null || !Number.isFinite(v)) continue;
    const wk = W[k] ?? 0.5; s += v * wk; w += wk; }
  return w > 0 ? s / w : null; };

// 2025年の選手で合成zを3方式それぞれ計算
const db3 = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const st3 = db3.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=? AND b.position<>'投'`);
const comp = [];
for (const r of st3.all(S, MIN_PA)) {
  const a = advanceOf(db3, nrm(r.name), S);
  const sc = speedComponents(
    { PA: r.pa, AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp },
    { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: S,
      advance: a?.value ?? null, advanceChances: a?.chances ?? 0 }, r.ubr, runNorm);
  const e = { name: r.name };
  for (const [nm, W] of Object.entries(schemes)) e[nm] = scoreWith(sc.z, W);
  if (Object.values(e).slice(1).every(v => v != null)) comp.push(e);
}
db3.close();

const cor = (x, y) => { const n = x.length; const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy); };
const names = Object.keys(schemes);
const pairs = [];
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const a = comp.map(c => c[names[i]]), b = comp.map(c => c[names[j]]);
  const maxAbs = Math.max(...comp.map(c => Math.abs(c[names[i]] - c[names[j]])));
  pairs.push({ a: names[i], b: names[j], r: cor(a, b), maxDiffZ: maxAbs });
}

// ── 出力 ───────────────────────────────────────────────────────────
const f3 = v => v == null ? '-' : v.toFixed(3);
const L = []; const push = s => L.push(s);
push('# SP-015 — component weight を翌年再現性から同時点の量へ組み直す\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('状態: **監査完了・置換候補を提示。productionへは未適用**\n');
push('## 0. 違反の内容\n');
push('`configs/running_norms.json` の `componentWeights` は Year Y→Y+1 の一致（翌年再現性）そのもの:\n');
push('```text');
for (const k of keys) push(`  ${k.padEnd(11)} ${legacy[k]}`);
push('```');
push('CLAUDE.md §年度査定の目的関数 が「翌年再現性をweight・採否・縮小の直接根拠に使わない」と定めるため、これは直接違反。\n');
push('## 1. 代わりに使った軸（正本 §3 の B / C のみ）\n');
push('各材料は率なので、その年の試行回数から**標本誤差が解析的に出る**。\n');
push('```text');
push('reliability = 1 − E[標本誤差の分散] / 観測された選手間分散');
push('```');
push('1シーズン内で完結し、**翌年の情報を一切含まない**。\n');
push('| 材料 | 同時点の信頼性 | 年別 | 備考 |');
push('|---|---|---|---|');
for (const k of keys) {
  const R = rel[k];
  const per = R.perSeason.map(x => `${x.season}:${x.reliability.toFixed(2)}`).join(' ');
  push(`| ${R.label} (${k}) | **${f3(R.reliability)}** | ${per || '-'} | ${R.note ?? ''} |`);
}
push('');
push('## 2. 3方式の重み（恣意的な単一置換をしない）\n');
push('| 材料 | legacy（翌年再現性・違反） | equal | same_time_reliability |');
push('|---|---|---|---|');
for (const k of keys) push(`| ${k} | ${legacy[k]} | 1 | ${f3(sameTime[k])} |`);
push('');
push(`※ UBRは合成指標で試行回数に分解できず同時点の標本誤差を出せない。翌年再現性の代用は禁止されているため、`);
push(`測れた材料の中央値 ${f3(medRel)} を暫定で当て、下の感度で影響を確認した。\n`);
push('## 3. 感度（2025年・同一選手集合で合成zを比較）\n');
push(`n = ${comp.length}人\n`);
push('| 比較 | 相関 | 最大差(z) |');
push('|---|---|---|');
for (const p of pairs) push(`| ${p.a} vs ${p.b} | ${f3(p.r)} | ${p.maxDiffZ.toFixed(3)} |`);
push('');
const legVsRel = pairs.find(p => p.a === 'legacy' && p.b === 'same_time_reliability');
push(legVsRel && legVsRel.r > 0.98
  ? `**legacy と same_time_reliability の順位はほぼ同じ（r=${f3(legVsRel.r)}）。**\n`
    + 'つまり違反していたのは**根拠の立て方**であって、出てくる順位ではない。\n'
    + '順位が変わらないからこそ、根拠だけを正しい軸へ置き換えられる。\n'
  : `legacy と same_time_reliability で順位が変わる（r=${f3(legVsRel?.r)}）。影響の大きい選手を個別に確認すること。\n`);
push('## 4. 提案\n');
push('`componentWeights` を `same_time_reliability` へ置き換える。理由は次のとおり:\n');
push('- 1シーズン内の標本誤差だけから出しており、翌年の情報を含まない（owner ruleに適合）');
push('- 各材料の「その年どれだけ確からしく測れているか」を直接表す（正本 §2 の軸2/軸3）');
push('- equalより情報量が多く、legacyと順位がほぼ同じなので移行の副作用が小さい\n');
push('**未解決として残すもの**:\n');
push('- UBRの同時点信頼性は測れていない（中央値で代用）。分解可能な形のUBRが手に入れば置き換える');
push('- 軸1（construct directness）・軸4（confounding）・軸8（direct-anchor agreement）は');
push('  本スクリプトでは数値化していない。現状は同時点信頼性のみでweightを作っており、');
push('  それらは**未反映**であることを明示する');

writeFileSync(path.join(ROOT, 'outputs', 'sp015_same_time_reliability.md'), L.join('\n'), 'utf8');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp015_same_time_reliability.json'),
  JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10),
    policy: 'CLAUDE.md 年度査定の目的関数 / speed_next_year_repeatability_policy_correction_20260813.md',
    reliability: rel, schemes, sensitivity: { n: comp.length, pairs } }, null, 2), 'utf8');

console.log('同時点の信頼性:', keys.map(k => `${k}=${f3(rel[k].reliability)}`).join(' '));
console.log('感度:', pairs.map(p => `${p.a}/${p.b} r=${f3(p.r)} max=${p.maxDiffZ.toFixed(2)}`).join(' | '));
console.log(`n=${comp.length}`);

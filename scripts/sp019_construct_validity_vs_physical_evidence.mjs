// SP-019 再監査（第2版）— raw版とdeconfounded版のどちらが physical speed construct へ近いかを
// **外部の独立physical evidence** に対して確かめる（EX-006/EX-007を再OPENした上での再判定）。
//
// ■ なぜ第1版(sp019_proxy_deconfounding_reaudit.mjs)では足りなかったか（オーナー指摘 2026-08-13）
//   EX-007: 「残差化すると測定誤差分散が増える」だけでは「分離しない」は確定しない。
//           走塁技術confoundingを除去することによる **bias低下** とのtrade-offを見ていないため。
//   EX-006: 「他の実戦proxyとの相関も低下する」だけではGB率がpure physical speed signalとは
//           確定しない。**複数proxyが共通confoundを持つ可能性**があるため
//           （三塁打・併殺回避・advanceはいずれも打球と走塁機会に依存する実戦outcome）。
//
// ■ 第2版の設計
//   実戦proxy同士の比較をやめ、**実戦outcomeに依存しない外部physical evidence**を判定基準にする。
//   bias と variance の net 効果は「外部基準との相関」に直接現れる——
//   残差化がbiasを減らすなら、ノイズが増えても外部physical基準との相関は上がるはず。
//   下がるなら、除去したものはbiasでなくsignalだったか、bias低下がノイズ増を上回らなかった。
//
//   判定基準（coverage順）:
//     1. NPB+ sprint speed (km/h)  n=100  ... トラッキング由来の最高速度。実戦outcomeでなく
//        身体そのものの速度。ただし後述の限界あり
//     2. 50m profile seconds       n≈37   ... SP-017でrange evidenceへ復元した低信頼度の実測
//     3. direct T90 (T90FT)        n≈8    ... 最も直接的だが検出力不足。参考表示のみ
//
//   相関差の不確実性はブートストラップ（選手を再標本、対応あり）で出す。
//   CIが0をまたぐなら **NOT_IDENTIFIABLE / provisional current behavior** とし、無理に決着させない。
//
// 使い方: node scripts/sp019_construct_validity_vs_physical_evidence.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const runNorm = J('running_norms.json');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const SEASONS = [2021, 2022, 2023, 2024, 2025];
const MIN_PA = 150;

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const stmt = db.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=? AND b.position<>'投'`);

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const varOf = a => { const m = mean(a); return mean(a.map(x => (x - m) ** 2)); };
const cov = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / a.length; };
const corr = (a, b) => { const d = Math.sqrt(varOf(a) * varOf(b)); return d > 0 ? cov(a, b) / d : NaN; };

// ── 外部physical evidence を読む ────────────────────────────────
const phys = JSON.parse(readFileSync(
  path.join(ROOT, 'data', 'normalized', 'speed_historical_physical_measurements_2015_2026.json'), 'utf8'));

const npbSpeed = new Map();   // 速いほど大きい（km/h）
const m50 = new Map();        // 秒。速いほど小さい → 符号反転して使う
const t90 = new Map();        // 秒。同上
for (const r of phys.records) {
  const k = nk(r.player);
  if (r.metric === 'NPB_PLUS_SPRINT_SPEED_KMH' && Number.isFinite(r.value)) npbSpeed.set(k, r.value);
  if ((r.metric === '50M_PROFILE_SECONDS' || r.metric === '50M_STANDING_START_SECONDS' || r.metric === '50m')
      && Number.isFinite(r.value)) { if (!m50.has(k)) m50.set(k, []); m50.get(k).push(r.value); }
  if (r.metric === 'T90FT_SECONDS' && Number.isFinite(r.value)) { if (!t90.has(k)) t90.set(k, []); t90.get(k).push(r.value); }
}
const medianOf = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// ── 選手ごとに実戦proxyを作る（複数年は観測量で加重平均＝推定誤差を減らすため） ──────
const acc = new Map();
for (const s of SEASONS) {
  for (const r of stmt.all(s, MIN_PA)) {
    const k = nk(r.name);
    if (!npbSpeed.has(k)) continue;             // 判定基準がある選手だけ
    const inplay = Math.max(1, r.ab - r.so);
    const trials = r.b2 + r.b3;
    const a = advanceOf(db, k, s);
    if (!(trials > 0) || r.ih == null || r.gb_pct == null || !a || !(a.chances > 0)) continue;
    const gbCount = Math.max(1, inplay * (r.gb_pct / 100));
    if (!acc.has(k)) acc.set(k, []);
    acc.get(k).push({
      season: s, w: r.pa,
      tripleRate: r.b3 / trials, tripleTrials: trials,
      ihRate: r.ih / inplay, inplay, gbPct: r.gb_pct,
      gdpAvoid: -r.gdp / gbCount,
      advance: a.value, advChances: a.chances,
    });
  }
}
const players = [];
for (const [k, rows] of acc) {
  const W = rows.reduce((s, r) => s + r.w, 0);
  const wavg = f => rows.reduce((s, r) => s + f(r) * r.w, 0) / W;
  players.push({
    key: k, seasons: rows.length, pa: W,
    tripleRate: wavg(r => r.tripleRate),
    ihRate: wavg(r => r.ihRate),
    gbPct: wavg(r => r.gbPct),
    advance: wavg(r => r.advance),
    npb: npbSpeed.get(k),
    m50: m50.has(k) ? -medianOf(m50.get(k)) : null,   // 符号反転（速いほど大きい）
    t90: t90.has(k) ? -medianOf(t90.get(k)) : null,
  });
}

// ── deconfounded版を作る（第1版と同じ残差化。回帰係数は本標本内で推定） ──────────
function residualize(rows, yKey, xKey) {
  const xs = rows.map(r => r[xKey]), ys = rows.map(r => r[yKey]);
  const b = cov(xs, ys) / varOf(xs), a = mean(ys) - b * mean(xs);
  return { b, a, values: rows.map(r => r[yKey] - (a + b * r[xKey])) };
}
const tripleResid = residualize(players, 'tripleRate', 'advance');   // EX-007: 走塁技術を引く
const ihResid = residualize(players, 'ihRate', 'gbPct');             // EX-006: ゴロ率を引く
players.forEach((p, i) => { p.tripleResid = tripleResid.values[i]; p.ihResid = ihResid.values[i]; });

// ── ブートストラップで「相関差」の不確実性を出す（対応あり＝同じ選手を再標本） ────────
// 乱数は固定シードのLCGで再現可能にする（Math.randomを使わない）
let seed = 20260813;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

function compare(rows, rawKey, residKey, critKey, B = 2000) {
  const use = rows.filter(r => r[critKey] != null && Number.isFinite(r[critKey]));
  if (use.length < 10) return { n: use.length, insufficient: true };
  const crit = use.map(r => r[critKey]);
  const rRaw = corr(use.map(r => r[rawKey]), crit);
  const rRes = corr(use.map(r => r[residKey]), crit);
  const diffs = [];
  for (let b = 0; b < B; b++) {
    const idx = Array.from({ length: use.length }, () => Math.floor(rnd() * use.length));
    const s = idx.map(i => use[i]);
    const c = s.map(r => r[critKey]);
    const a1 = corr(s.map(r => r[rawKey]), c), a2 = corr(s.map(r => r[residKey]), c);
    if (Number.isFinite(a1) && Number.isFinite(a2)) diffs.push(a2 - a1);
  }
  diffs.sort((x, y) => x - y);
  const lo = diffs[Math.floor(diffs.length * 0.025)], hi = diffs[Math.floor(diffs.length * 0.975)];
  return {
    n: use.length, r_raw: rRaw, r_residualized: rRes, diff_resid_minus_raw: rRes - rRaw,
    ci95_of_diff: [lo, hi], ci_excludes_zero: (lo > 0 || hi < 0),
  };
}

const CRITERIA = [
  { key: 'npb', label: 'NPB+ sprint speed (km/h)', tier: 'primary' },
  { key: 'm50', label: '50m実測（秒、符号反転）', tier: 'secondary_low_confidence' },
  { key: 't90', label: 'direct T90（秒、符号反転）', tier: 'tertiary_underpowered' },
];

const results = { EX_007_triple_baserunning_separation: {}, EX_006_infieldhit_gb_deconfounding: {} };
for (const c of CRITERIA) {
  results.EX_007_triple_baserunning_separation[c.key] = { criterion: c.label, tier: c.tier, ...compare(players, 'tripleRate', 'tripleResid', c.key) };
  results.EX_006_infieldhit_gb_deconfounding[c.key] = { criterion: c.label, tier: c.tier, ...compare(players, 'ihRate', 'ihResid', c.key) };
}

const out = {
  generated_at: '2026-08-13',
  supersedes: 'scripts/sp019_proxy_deconfounding_reaudit.mjs（第1版。実戦proxy同士の比較のみで共通confoundを排除できていなかった）',
  policy: 'EX-006/EX-007を再OPENした上での再判定。判定基準は実戦outcomeに依存しない外部physical evidence',
  n_players_with_ingame_proxies_and_npb: players.length,
  regression_coefficients: { triple_on_advance: tripleResid.b, infieldhit_on_gbpct: ihResid.b },
  criteria_coverage: { npb: players.filter(p => p.npb != null).length, m50: players.filter(p => p.m50 != null).length, t90: players.filter(p => p.t90 != null).length },
  known_limitations: [
    'NPB+ sprint speedは公表されたin-game トラッキング集計であり、qualified-run数が非公開・露出量に依存する。実験室測定ではない',
    'NPB+は2026 snapshot、実戦proxyは2021-2025の加重平均＝near-timeであり厳密な同時点ではない',
    '50m実測はSP-017でrange evidenceへ復元した低信頼度データ（protocol/date不明を含む）。方向の確認にのみ使う',
    'direct T90はn<10で検出力が無い。参考表示のみ',
    '残差化の回帰係数を本標本内で推定しているため、残差版にわずかな過適合が入りうる（rawに不利ではなく残差版に有利な方向のバイアス）',
  ],
  results,
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp019_construct_validity_vs_physical_evidence.json'), JSON.stringify(out, null, 2));

console.log(`players with in-game proxies + NPB+: ${players.length}`);
console.log(`coverage: npb=${out.criteria_coverage.npb} m50=${out.criteria_coverage.m50} t90=${out.criteria_coverage.t90}\n`);
for (const [ex, byCrit] of Object.entries(results)) {
  console.log(`=== ${ex} ===`);
  for (const [k, r] of Object.entries(byCrit)) {
    if (r.insufficient) { console.log(`  ${r.criterion}: n=${r.n} → 検出力不足`); continue; }
    console.log(`  ${r.criterion} (n=${r.n}): raw=${r.r_raw.toFixed(3)} resid=${r.r_residualized.toFixed(3)} diff=${r.diff_resid_minus_raw.toFixed(3)} CI95=[${r.ci95_of_diff[0].toFixed(3)}, ${r.ci95_of_diff[1].toFixed(3)}] ${r.ci_excludes_zero ? '★CIは0を含まない' : '（CIが0をまたぐ）'}`);
  }
  console.log();
}

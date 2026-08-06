// 疲労効果の実証（Sol仕様 02 §9 の PAUSED 解除条件）。
//
// なぜ今まで測れなかったか:
//   年間の合計成績しか無いと、「たくさん出た選手ほど成績が良い」としか見えない。
//   これは疲労が無いからではなく、**好調な選手ほど起用が増える**（選択効果）ため。
//   同じ列に選択効果と疲労効果が混ざっていて分離できない。
//
// 月別成績で何が変わるか:
//   同じ選手の中で「シーズン前半 vs 後半」を比べられる。選手を跨がないので、
//   「誰が多く出るか」の選択は比較から外れる。
//
// それでも残る落とし穴と、その対策:
//   (1) リーグ全体の季節変動（夏場は打高、など）を疲労と読み違える
//       → 各月の**リーグ平均を引く**。個人の値でなく偏差を見る
//   (2) 後半まで出続けた選手は「調子を落とさなかった選手」に偏る（生存バイアス）
//       → この偏りは疲労を**見えにくくする**方向に効くので、それでも下がって見えるなら
//         観測された低下は下限。逆に「下がっていない」は疲労が無い証拠にならない、と明記する
//   (3) 起用が軽い選手も重い選手も同じだけ下がるなら、それは疲労でなく別の何か
//       → **重い起用と軽い起用で低下幅を比べる**（差の差）。疲労なら重い側で大きいはず
//
// 使い方: node scripts/analyze_fatigue.mjs

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const MONTH_ORDER = ['3・4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月'];
const MIN_PA_PER_MONTH = 30;   // その月を「出ていた」と認める打席数
const MIN_MONTHS = 4;          // 前半・後半を比べるのに要る月数

const rows = db.prepare(`
  SELECT season, name_norm, name, label, pa, ab, h, b2, b3, hr, bb, hbp, sf
  FROM nf3_split WHERE section='month' AND pa >= ?`).all(MIN_PA_PER_MONTH);

if (!rows.length) {
  console.error('月別成績が入っていない。先に node scripts/parse_nf3.mjs を実行する');
  process.exit(1);
}

/** 出塁と長打をまとめた1つの指標（OPS）。打席あたりの生産を見る */
const ops = r => {
  if (!(r.ab > 0)) return null;
  const singles = r.h - (r.b2 ?? 0) - (r.b3 ?? 0) - (r.hr ?? 0);
  const tb = singles + 2 * (r.b2 ?? 0) + 3 * (r.b3 ?? 0) + 4 * (r.hr ?? 0);
  const obDen = (r.ab ?? 0) + (r.bb ?? 0) + (r.hbp ?? 0) + (r.sf ?? 0);
  if (!(obDen > 0)) return null;
  return ((r.h + (r.bb ?? 0) + (r.hbp ?? 0)) / obDen) + (tb / r.ab);
};

const data = rows.map(r => ({ ...r, ops: ops(r), mi: MONTH_ORDER.indexOf(r.label) }))
  .filter(r => r.ops != null && r.mi >= 0);

// --- (1) 各月のリーグ平均を引く（季節変動を疲労と読み違えないため） ---
const lgByMonth = {};
for (const r of data) (lgByMonth[`${r.season}|${r.mi}`] ??= []).push({ ops: r.ops, pa: r.pa });
const lgMean = {};
for (const [k, a] of Object.entries(lgByMonth)) {
  const w = a.reduce((s, x) => s + x.pa, 0);
  lgMean[k] = a.reduce((s, x) => s + x.ops * x.pa, 0) / w;
}
for (const r of data) r.dev = r.ops - lgMean[`${r.season}|${r.mi}`];

// --- (2) 選手×シーズンごとに前半・後半を作る ---
const bySeasonPlayer = {};
for (const r of data) (bySeasonPlayer[`${r.season}|${r.name_norm}`] ??= []).push(r);

const players = [];
for (const [k, a] of Object.entries(bySeasonPlayer)) {
  if (a.length < MIN_MONTHS) continue;
  a.sort((x, y) => x.mi - y.mi);
  const half = Math.floor(a.length / 2);
  const first = a.slice(0, half), second = a.slice(a.length - half);
  const wm = arr => arr.reduce((s, x) => s + x.dev * x.pa, 0) / arr.reduce((s, x) => s + x.pa, 0);
  const totalPa = a.reduce((s, x) => s + x.pa, 0);
  players.push({
    key: k, season: a[0].season, name: a[0].name, months: a.length, totalPa,
    firstHalf: wm(first), secondHalf: wm(second), change: wm(second) - wm(first),
    monthly: a.map(x => ({ month: x.label, pa: x.pa, dev: x.dev })),
  });
}

const stat = arr => {
  const n = arr.length, m = arr.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sd, se: n > 1 ? sd / Math.sqrt(n) : null };
};

const overall = stat(players.map(p => p.change));

// --- (3) 起用の重さで分けて、低下幅を比べる（差の差） ---
const sorted = [...players].sort((a, b) => b.totalPa - a.totalPa);
const cut = Math.floor(sorted.length / 3);
const heavy = sorted.slice(0, cut), light = sorted.slice(-cut);
const hs = stat(heavy.map(p => p.change)), ls = stat(light.map(p => p.change));
const did = hs.mean - ls.mean;
const didSe = Math.hypot(hs.se ?? 0, ls.se ?? 0);

// --- (4) 月ごとの平均偏差（形を見る） ---
const byMonth = {};
for (const p of players) for (const m of p.monthly) (byMonth[m.month] ??= []).push(m.dev);
const monthProfile = MONTH_ORDER.filter(m => byMonth[m]?.length >= 20)
  .map(m => ({ month: m, ...stat(byMonth[m]) }));

// --- (5) 頑健性の確認: 平均への回帰と区別する ---
// 「4か月以上・各月30打席以上」で絞ると、**前半に調子が良かった選手ほど残る**。
// その集団は前半が上振れしているので、後半に下がって見えるのは当たり前（平均への回帰）。
// 対策: **全月に出た正真正銘のレギュラー**だけを見る。この層は前半の成績ではなく
// 「そもそもレギュラーか」で選ばれているので、上振れによる選抜が入りにくい。
const fullSeason = players.filter(p => p.months >= 6 && p.totalPa >= 400);
const fs_ = stat(fullSeason.map(p => p.change));
const fsSorted = [...fullSeason].sort((a, b) => b.totalPa - a.totalPa);
const fcut = Math.floor(fsSorted.length / 2);
const fHeavy = stat(fsSorted.slice(0, fcut).map(p => p.change));
const fLight = stat(fsSorted.slice(-fcut).map(p => p.change));
const fDid = fHeavy.mean - fLight.mean;
const fDidSe = Math.hypot(fHeavy.se ?? 0, fLight.se ?? 0);

const out = {
  measured_at: '2026-08-01',
  robustness_regulars_only: {
    _why: '出場が前半の好調に左右されにくい層（全月出場・400打席以上）に絞り、平均への回帰と区別する',
    n: fullSeason.length,
    change: fs_,
    heavy: fHeavy, light: fLight,
    difference_in_differences: fDid, se: fDidSe, t: fDidSe > 0 ? fDid / fDidSe : null,
  },
  design: {
    unit: '選手×シーズン。同じ選手の中で前半と後半を比べる（選手間の選択効果を比較から外す）',
    league_adjustment: '各年・各月のリーグ平均（打席加重）を引いた偏差で比較',
    thresholds: { min_pa_per_month: MIN_PA_PER_MONTH, min_months: MIN_MONTHS },
    known_limits: [
      '後半まで出続けた選手に偏る（生存バイアス）。疲労を見えにくくする方向に効くので、観測された低下は下限',
      '「下がっていない」は疲労が無い証拠にならない（上の偏りのため）',
      '対戦相手の質・気候・怪我は分離していない',
    ],
  },
  n_player_seasons: players.length,
  overall_change: overall,
  by_usage: {
    heavy: { ...hs, mean_pa: heavy.reduce((s, p) => s + p.totalPa, 0) / (heavy.length || 1) },
    light: { ...ls, mean_pa: light.reduce((s, p) => s + p.totalPa, 0) / (light.length || 1) },
    difference_in_differences: did,
    se: didSe,
    t: didSe > 0 ? did / didSe : null,
  },
  month_profile: monthProfile,
};

const verdictParts = [];
if (overall.se && Math.abs(overall.mean / overall.se) >= 2) {
  verdictParts.push(`シーズン全体で後半のOPSは前半より ${overall.mean >= 0 ? '+' : ''}${overall.mean.toFixed(4)} `
    + `（t=${(overall.mean / overall.se).toFixed(2)}、リーグの月変動を除いた偏差）`);
} else {
  verdictParts.push(`前半と後半で差は検出できない（変化 ${overall.mean.toFixed(4)}、`
    + `t=${overall.se ? (overall.mean / overall.se).toFixed(2) : '—'}）`);
}
if (didSe > 0 && Math.abs(did / didSe) >= 2) {
  verdictParts.push(`起用の重い層は軽い層より ${did >= 0 ? '' : ''}${did.toFixed(4)} 違う（t=${(did / didSe).toFixed(2)}）`
    + `${did < 0 ? '＝重く使われた選手ほど後半に落ちる。疲労効果と整合' : '＝重く使われた選手の方が落ちない。疲労では説明できない'}`);
} else {
  verdictParts.push(`起用の重さによる差の差は検出できない（${did.toFixed(4)}、t=${didSe > 0 ? (did / didSe).toFixed(2) : '—'}）`
    + '＝この設計では疲労効果を支持する証拠は出ていない');
}
out.verdict = verdictParts;
out.spec_decision = (didSe > 0 && did / didSe <= -2)
  ? 'Sol仕様§9の PAUSED を解除できる（疲労効果を実証した）。補正の実装へ進む'
  : 'Sol仕様§9の PAUSED を維持する。実証が取れていないものを実装しない';

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'fatigue_analysis.json'), JSON.stringify(out, null, 2), 'utf8');

console.log(`選手×シーズン ${players.length}件（各月${MIN_PA_PER_MONTH}打席以上・${MIN_MONTHS}か月以上）\n`);
console.log('## 月ごとの平均（リーグ月平均からの偏差）');
for (const m of monthProfile) {
  console.log(`  ${m.month.padEnd(6)} n=${String(m.n).padStart(4)}  ${m.mean >= 0 ? '+' : ''}${m.mean.toFixed(4)} (±${m.se.toFixed(4)})`);
}
console.log(`\n## 前半 → 後半の変化`);
console.log(`  全体 ${overall.mean >= 0 ? '+' : ''}${overall.mean.toFixed(4)} (±${overall.se.toFixed(4)}, n=${overall.n})`);
console.log(`  起用が重い層（平均${Math.round(out.by_usage.heavy.mean_pa)}打席） ${hs.mean >= 0 ? '+' : ''}${hs.mean.toFixed(4)} (±${hs.se.toFixed(4)}, n=${hs.n})`);
console.log(`  起用が軽い層（平均${Math.round(out.by_usage.light.mean_pa)}打席） ${ls.mean >= 0 ? '+' : ''}${ls.mean.toFixed(4)} (±${ls.se.toFixed(4)}, n=${ls.n})`);
console.log(`  差の差 ${did >= 0 ? '+' : ''}${did.toFixed(4)} (t=${didSe > 0 ? (did / didSe).toFixed(2) : '—'})`);
console.log(`\n## 頑健性の確認（全月出場・400打席以上のレギュラーのみ n=${fullSeason.length}）`);
console.log(`  前半→後半の変化 ${fs_.mean >= 0 ? '+' : ''}${fs_.mean.toFixed(4)} (±${fs_.se?.toFixed(4)}, t=${fs_.se ? (fs_.mean / fs_.se).toFixed(2) : '—'})`);
console.log(`  重い層 ${fHeavy.mean.toFixed(4)} / 軽い層 ${fLight.mean.toFixed(4)} / 差の差 ${fDid >= 0 ? '+' : ''}${fDid.toFixed(4)} (t=${fDidSe > 0 ? (fDid / fDidSe).toFixed(2) : '—'})`);
console.log(`\n## 判定`);
for (const v of out.verdict) console.log(`  - ${v}`);
console.log(`\n## 仕様§9の扱い\n  ${out.spec_decision}`);
console.log(`\n## この設計で分からないこと`);
for (const l of out.design.known_limits) console.log(`  - ${l}`);
db.close();

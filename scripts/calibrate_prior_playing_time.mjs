// 縮小の Prior（self_recent）を出場量に応じて補正する係数を測る（案D）。
//
// オーナー承認（2026-08-05）: 案D（基準そのものを出場量で補正する）を採用。
//
// 経緯:
//   縮小はリーグ打率を系統的に押し上げていた（2021年+3.41厘・2023年+2.97厘）。
//   主因は self_recent（周辺年の本人実績を基準にする）——**少ない出場の年は、
//   本人の平均より実際に悪い**（調子が悪いから使われない・経験不足・衰え等）。
//   「観測値＝実力＋偶然のブレ」という縮小の前提が崩れている。
//
//   対策の候補は2つ:
//     案B: 縮小後にリーグ打率が戻るよう一律の比率を掛ける（後付け・定義上ぴったり0にできる）
//     案D: 基準そのものを出場量に応じて下げる（原因に効く・後付けなし）
//   実測比較（scripts/try_prior_playing_time_adjustment.mjs）で、
//   案Dは押し上げを 3.41厘→1.05厘 まで縮め、符号が年で揺れる状態にできた。
//   オーナーが両案の併用を承認したため、案Dをここで正式に較正し shrinkage.mjs へ組み込む。
//
// 何を測るか:
//   同じ選手の中で、出場が少ない年は「実際に基準として使われる値」（selectPriorの返り値）
//   よりどれだけ低いか。log(打数) に対する直線として当てる。
//
// 使い方: node scripts/calibrate_prior_playing_time.mjs
//   → configs/ratings.json の shrinkage.prior.playing_time_adjustment に書き込む

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectPrior } from '../src/ratings/shrinkage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));

const lgCache = new Map();
const lgOf = s => {
  if (!lgCache.has(s)) {
    const r = db.prepare(`SELECT SUM(h) h, SUM(ab) ab FROM v_batting WHERE season=?`).get(s);
    lgCache.set(s, { avg: r.h / r.ab, hr: 0.02 });
  }
  return lgCache.get(s);
};

const all = db.prepare(`SELECT player_id, name, season, pa, ab, h FROM v_batting
  WHERE position <> '投' AND ab >= 30 AND season BETWEEN 2006 AND 2025`).all();
const byPlayer = new Map();
for (const r of all) {
  if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
  byPlayer.get(r.player_id).push(r);
}

// ★補正は「実際に基準として使われる値」（selectPriorの返り値）との差で作る。
//   「本人のフル出場時の平均」との差で作ると、周辺年に既に少ない出場の年が混ざって
//   二重に下げてしまう（2026-08-05に一度誤り、比較対象を揃えて訂正した）。
const xs = [], ys = [], ws = [];
for (const [, seasons] of byPlayer) {
  for (const r of seasons) {
    if (r.ab >= 400) continue;                      // 補正が要るのは出場の少ない年
    const hist = seasons.filter(x => x.season !== r.season && Math.abs(x.season - r.season) <= 3 && x.ab >= 30)
      .map(x => ({ season: x.season, ab: x.ab, isFarm: false, avgEnv: x.h / x.ab, hrEnv: 0.02 }));
    const pr = selectPrior({ season: r.season, ab: r.ab }, hist, lgOf(r.season), cfg.shrinkage);
    if (pr.kind !== 'self_recent') continue;        // 補正を当てるのはこの基準の時だけ
    xs.push(Math.log(r.ab)); ys.push(r.h / r.ab - pr.avg); ws.push(r.ab);
  }
}
const W = ws.reduce((s, v) => s + v, 0);
const mx = xs.reduce((s, v, i) => s + v * ws[i], 0) / W;
const my = ys.reduce((s, v, i) => s + v * ws[i], 0) / W;
let sxy = 0, sxx = 0;
for (let i = 0; i < xs.length; i++) { sxy += ws[i] * (xs[i] - mx) * (ys[i] - my); sxx += ws[i] * (xs[i] - mx) ** 2; }
const slope = sxy / sxx, intercept = my - slope * mx;

console.log(`基準の補正式（${xs.length}人年で推定・打数加重）`);
console.log(`  差 = ${intercept.toFixed(5)} + ${slope.toFixed(5)} × log(打数)`);
for (const ab of [100, 200, 300, 400]) {
  const adj = Math.min(0, intercept + slope * Math.log(Math.max(30, ab)));
  console.log(`    ${String(ab).padStart(3)}打数 → ${(adj * 1000).toFixed(2).padStart(6)}厘`);
}

// 効果の確認（押し上げがどれだけ減るか）
const { shrink } = await import('../src/ratings/shrinkage.mjs');
const sh = cfg.shrinkage;
const adjustFn = ab => Math.min(0, intercept + slope * Math.log(Math.max(30, ab)));
console.log('\n年ごとの、縮小によるリーグ打率の押し上げ（補正あり）');
for (const season of [2019, 2021, 2023, 2024, 2025]) {
  const rows = db.prepare(`SELECT player_id, ab, h FROM v_batting
    WHERE season = ? AND position <> '投' AND ab >= 50`).all(season);
  const league = lgOf(season);
  let rawSum = 0, rawAb = 0, newSum = 0;
  for (const r of rows) {
    const hist = db.prepare(`SELECT season, ab, h FROM v_batting
      WHERE player_id = ? AND season BETWEEN ? AND ? AND season <> ? AND ab >= 30`)
      .all(r.player_id, season - 3, season + 3, season)
      .map(x => ({ season: x.season, ab: x.ab, isFarm: false, avgEnv: x.h / x.ab, hrEnv: 0.02 }));
    const prior = selectPrior({ season, ab: r.ab }, hist, league, sh);
    const observed = r.h / r.ab;
    const adjustedPrior = prior.kind === 'self_recent' ? prior.avg + adjustFn(r.ab) : prior.avg;
    const post = shrink(observed, r.ab, adjustedPrior, sh.kappa_meet);
    rawSum += r.h; rawAb += r.ab; newSum += post * r.ab;
  }
  const raw = rawSum / rawAb, newA = newSum / rawAb;
  console.log(`  ${season}  ${String(rows.length).padStart(4)}人  縮小前.${(raw * 1000).toFixed(0)}  押し上げ${((newA - raw) * 1000 >= 0 ? '+' : '') + ((newA - raw) * 1000).toFixed(2)}厘`);
}

cfg.shrinkage.prior.playing_time_adjustment = {
  _status: '案D（2026-08-05オーナー承認）。self_recentのPriorを出場量に応じて下げ、縮小がリーグ打率を押し上げる問題に対処する',
  _why: '少ない出場の年は本人の平均より実際に悪い（調子・経験不足・衰え）。基準を出場量で補正することで原因に直接効く。案B（後付けで一律に戻す）と違い個々の選手について説明が閉じる',
  _measured_on: `${xs.length}人年（2006-2025・打数加重最小二乗）`,
  _effect: '押し上げ最大3.41厘→2厘程度・符号が年で揺れる状態に縮小（案Bのようなゼロにはならない）',
  intercept, slope,
  applies_to: 'avg（打率）のみ。self_recentのPriorにだけ適用し、farm/leagueには適用しない',
  formula: 'adjustment = min(0, intercept + slope * log(max(30, ab)))　※常に0以下（下げる方向のみ）',
};
const p = path.join(ROOT, 'configs', 'ratings.json');
writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
console.log(`\n保存: configs/ratings.json（shrinkage.prior.playing_time_adjustment）`);
db.close();

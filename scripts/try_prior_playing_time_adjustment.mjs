// 縮小がリーグ打率を押し上げる問題に、案B（最後に一律で戻す）より良い手がないか試す。
//
// オーナー指示（2026-08-05）: 「もっと良い解決策がないか模索して」
//
// これまでに分かっていること:
//   押し上げの主因は **self_recent（本人の近年成績を基準にすること）**（+2.5厘前後）。
//   案A（出場の少ない選手の基準を同じ出場量のリーグ平均にする）は、
//   その層が6人・3人しかいないのでほとんど効かないと実測済み。
//   案B（縮小後のリーグ打率が縮小前に戻るよう一律の比率を掛ける）は効くが、
//   「能力値は個人の実力」という建て付けに、合計を合わせるための後付け調整が入る。
//
// ★新しい案の考え方:
//   なぜ self_recent が押し上げるのか——**少ない出場の年は、本人の平均より実際に悪い**から。
//   調子が悪いから使われない、若手が経験を積んでいる、衰えている、といった理由で、
//   「観測値＝実力＋偶然のブレ」という縮小の前提が崩れている。
//   だったら**基準そのものを出場量に応じて下げる**のが筋。後付けでなく原因に効く。
//
//   実測（同じ選手の中で、本人のフル出場時の打率と比べた差）:
//     30〜150打数 -53.1厘 ／ 150〜250 -29.1厘 ／ 250〜350 -20.1厘 ／ 350〜450 -10.1厘
//   打数が少ないほど低く、きれいに単調。
//
// この道具は**数字を出すだけ**。査定には何も書き込まない。採否はオーナー判断。
//
// 使い方: node scripts/try_prior_playing_time_adjustment.mjs

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

// ---- 1. 補正の形を実データから決める ----------------------------------------
const all = db.prepare(`SELECT player_id, season, pa, ab, h FROM v_batting
  WHERE position <> '投' AND ab >= 30 AND season BETWEEN 2006 AND 2025`).all();
const byPlayer = new Map();
for (const r of all) {
  if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
  byPlayer.get(r.player_id).push(r);
}
// ★補正は「実際に基準として使われる値」との差で作る（2026-08-05に一度誤った）。
//   最初は「本人のフル出場時の平均」との差で作ったが、査定が基準にしているのは
//   **周辺年の打数加重平均**（selectPrior の self_recent）。
//   周辺年には少ない出場の年も混ざっていて既に低めなので、フル出場時との差を当てると
//   二重に下げてしまう。実際、押し上げ+2〜3厘が押し下げ-7〜-9厘に振れた。
//   比べる2つのものを揃えるため、ここでは selectPrior が返す値そのものと比べる。
const { selectPrior: selPrior0, shrink: shrink0 } = await import('../src/ratings/shrinkage.mjs');
const { readFileSync: rf0 } = await import('node:fs');
const cfg0 = JSON.parse(rf0(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const lgCache = new Map();
const lgOf = s => {
  if (!lgCache.has(s)) {
    const r = db.prepare(`SELECT SUM(h) h, SUM(ab) ab FROM v_batting WHERE season=?`).get(s);
    lgCache.set(s, { avg: r.h / r.ab, hr: 0.02 });
  }
  return lgCache.get(s);
};

// log(打数) に対する直線として当てる（帯で刻むより滑らかで、外れ値に強い）
const xs = [], ys = [], ws = [];
for (const [pid, seasons] of byPlayer) {
  for (const r of seasons) {
    if (r.ab >= 400) continue;                      // 補正が要るのは出場の少ない年
    const hist = seasons.filter(x => x.season !== r.season && Math.abs(x.season - r.season) <= 3 && x.ab >= 30)
      .map(x => ({ season: x.season, ab: x.ab, isFarm: false, avgEnv: x.h / x.ab, hrEnv: 0.02 }));
    const pr = selPrior0({ season: r.season, ab: r.ab }, hist, lgOf(r.season), cfg0.shrinkage);
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
const adjust = ab => Math.min(0, intercept + slope * Math.log(Math.max(30, ab)));

console.log('基準の補正式（打数が少ない年ほど本人の平均から下げる）');
console.log(`  差 = ${intercept.toFixed(5)} + ${slope.toFixed(5)} × log(打数)   ${xs.length}人年で当てた`);
console.log('  打数ごとの下げ幅:');
for (const ab of [100, 200, 300, 400, 500]) {
  console.log(`    ${String(ab).padStart(3)}打数 → ${(adjust(ab) * 1000).toFixed(2).padStart(6)}厘`);
}

// ---- 2. 押し上げがどれだけ消えるかを測る -------------------------------------
// 実際の査定と同じ手順（self_recent を基準に縮小）を、補正あり・なしで通す
const { selectPrior, shrink } = await import('../src/ratings/shrinkage.mjs');
const { readFileSync } = await import('node:fs');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const sh = cfg.shrinkage;

console.log('\n年ごとの、縮小によるリーグ打率の押し上げ');
console.log('年     選手数   縮小前    補正なし（今）   補正あり（新案）');
for (const season of [2019, 2021, 2023, 2024, 2025]) {
  const rows = db.prepare(`SELECT player_id, name, ab, h, pa FROM v_batting
    WHERE season = ? AND position <> '投' AND ab >= 50`).all(season);
  const lgRow = db.prepare(`SELECT SUM(h) h, SUM(ab) ab FROM v_batting WHERE season = ?`).get(season);
  const league = { avg: lgRow.h / lgRow.ab, hr: 0.02 };

  let rawSum = 0, rawAb = 0, oldSum = 0, newSum = 0;
  for (const r of rows) {
    const hist = db.prepare(`SELECT season, ab, h FROM v_batting
      WHERE player_id = ? AND season BETWEEN ? AND ? AND season <> ? AND ab >= 30`)
      .all(r.player_id, season - 3, season + 3, season)
      .map(x => ({ season: x.season, ab: x.ab, isFarm: false, avgEnv: x.h / x.ab, hrEnv: 0.02 }));
    const prior = selectPrior({ season, ab: r.ab }, hist, league, sh);
    const observed = r.h / r.ab;
    const oldPost = shrink(observed, r.ab, prior.avg, sh.kappa_meet);
    // 新案: self_recent のときだけ、対象年の打数に応じて基準を下げる
    const adjustedPrior = prior.kind === 'self_recent' ? prior.avg + adjust(r.ab) : prior.avg;
    const newPost = shrink(observed, r.ab, adjustedPrior, sh.kappa_meet);
    rawSum += r.h; rawAb += r.ab;
    oldSum += oldPost * r.ab; newSum += newPost * r.ab;
  }
  const raw = rawSum / rawAb, oldA = oldSum / rawAb, newA = newSum / rawAb;
  console.log(`${season}  ${String(rows.length).padStart(5)}人   .${(raw * 1000).toFixed(0)}   `
    + `+${((oldA - raw) * 1000).toFixed(2)}厘        ${((newA - raw) * 1000 >= 0 ? '+' : '') + ((newA - raw) * 1000).toFixed(2)}厘`);
}
console.log('\n※押し上げが0に近いほど良い。案Bと違い、後付けで合計を合わせるのではなく');
console.log('  「少ない出場の年は本人の平均より実際に悪い」という事実を基準に反映している');
db.close();

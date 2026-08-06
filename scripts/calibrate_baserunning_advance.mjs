// 自作の走塁指標を走力の材料として使えるよう、目盛りを合わせる。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//
// オーナー承認（2026-08-05）: 走塁指標を走力査定へ組み込む。
//
// この指標は何か:
//   単打で一塁から三塁へ行けたか等の「余分に進めたか」を、
//   打球の位置とアウトカウントで難易度を揃えたうえで平均との差にしたもの。
//   `scripts/build_baserunning_advances.mjs` が作る22,459件が材料。
//
// なぜ加えるか（実測）:
//   翌年との一致 = **自作0.527**（20機会以上・197組）に対し、
//   いま走力に使っている **UBRは0.447**（325組）。自作の方が安定している。
//   UBRとの相関は0.613で、同じものを測りつつ4割は別の情報を持つ。
//   だからUBRを置き換えず**足す**。
//
// 重みの決め方は既存の設計に合わせる——**材料の重み＝その材料の翌年再現性**
//   （configs/running_norms.json の componentWeights。三塁打割合0.695・併殺回避0.620・
//    内野安打率0.586・UBR0.445 と並べる形で、走塁指標は0.527）。
//
// ★機会の下限=20（2026-08-05オーナー承認、25→20へ変更）:
//   下限を10〜40で振って翌年再現性と対象人数を比べた。20と25で精度がほぼ同じ
//   （0.527 vs 0.533）なのに対象が55人→73人（2024年）へ3割増える。15まで下げると
//   0.437へ落ちる崖があるので、そこより上で最も多く拾える20を採用。
//   周東佑京（2024年21機会）のように、出塁後すぐ盗塁するため機会が少なくなる俊足選手も
//   これで対象に入る（25だと漏れていた＝俊足の選手ほど不利という逆転があった）。
//
// 使い方: node scripts/calibrate_baserunning_advance.mjs
//   → configs/running_norms.json に advance（平均・標準偏差）と重みを書き込む

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
// ★2026-08-05オーナー承認で25→20へ変更。下限を変えて翌年再現性と対象人数を比べたところ、
//   20と25で精度がほぼ同じ（0.527 vs 0.533）なのに対象が55人→73人へ3割増える。
//   15まで下げると0.437へ落ちる崖があるので、そこより上で最も多く拾える20を採る。
//   20なら周東佑京（21機会）のような、出塁後すぐ盗塁するため機会が少なくなる俊足選手も
//   対象に入る（25だと漏れていた）。
const MIN_CHANCES = 20;          // これ未満は不安定なので査定に使わない

const ev = db.prepare(`SELECT * FROM baserunning_advances WHERE hc_x IS NOT NULL`).all();
// 打球の位置とアウトカウントで「その場面の平均的な成功率」を作る
const key = e => `${e.kind}|${Math.floor(e.hc_x / 12)},${Math.floor(e.hc_y / 12)}|${e.outs}`;
const cell = new Map();
for (const e of ev) {
  const k = key(e);
  if (!cell.has(k)) cell.set(k, { n: 0, s: 0 });
  const c = cell.get(k); c.n++; c.s += e.success;
}

// 選手×年の値
const per = new Map();
for (const e of ev) {
  const k = `${e.runner_norm}|${e.season}`;
  if (!per.has(k)) per.set(k, { n: 0, d: 0 });
  const v = per.get(k); const c = cell.get(key(e));
  v.n++; v.d += e.success - c.s / c.n;
}
const vals = [...per.values()].filter(v => v.n >= MIN_CHANCES).map(v => v.d / v.n);
const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);

function pearson(a, b) {
  const n = a.length; if (n < 5) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let p = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; p += u * v; da += u * u; dbb += v * v; }
  return da > 0 && dbb > 0 ? p / Math.sqrt(da * dbb) : null;
}
// 翌年再現性を測って重みにする（既存の材料と同じ決め方）
const xs = [], ys = [];
for (const [k, v] of per) {
  if (v.n < MIN_CHANCES) continue;
  const [name, season] = k.split('|');
  const w = per.get(`${name}|${Number(season) + 1}`);
  if (!w || w.n < MIN_CHANCES) continue;
  xs.push(v.d / v.n); ys.push(w.d / w.n);
}
const repeatability = pearson(xs, ys) ?? 0;

console.log(`走塁指標の目盛り（${MIN_CHANCES}機会以上の${vals.length}人年）`);
console.log(`  平均 ${mean.toFixed(5)} / 標準偏差 ${sd.toFixed(5)}`);
console.log(`  翌年との一致 ${repeatability.toFixed(3)}（${xs.length}組）＝これを重みにする`);

// ---- 走塁得能のための「走力に対する残差」も作る（2026-08-05 オーナー指摘）------------
// 仕様04 §3 は走塁得能の材料に「一塁から三塁／二塁から本塁／追加進塁」を名指ししている。
// この指標はまさにそれなのに、走力側にしか入れていなかった。
//
// 走力と走塁得能で同じ材料を使っても二重計上にならない理由:
//   走力     … その材料から脚の速さを推定する
//   走塁得能 … 同じ材料から**走力で説明できる分を引いた残差**を取る
//   オーナーの例「走力E走塁A」は、脚が遅いのに三塁到達が速い＝残差が大きい、として表れる。
//
// そのために「走力がこれくらいなら走塁指標はこれくらい」という直線を実データで引く。
const { speedComponents } = await import('../src/ratings/running.mjs');
const bat = db.prepare(`
  SELECT b.name, b.season, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id = b.player_id AND l.season = b.season
  JOIN v_bm_by_player bm ON bm.proeye_id = b.player_id AND bm.season = b.season AND bm.farm = 0
  LEFT JOIN v_bm_bat m ON m.player_id = l.bm_id AND m.season = b.season AND m.farm = 0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id = b.player_id AND tl.season = b.season
  LEFT JOIN nf3_team_bat t ON t.season = tl.season AND t.name_norm = tl.name_norm
  WHERE b.pa >= 250 AND b.position <> '投'`).all();
const nrm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const runNormNow = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));

const pairs = [];
for (const r of bat) {
  const v = per.get(`${nrm(r.name)}|${r.season}`);
  if (!v || v.n < MIN_CHANCES) continue;
  // ★走力は走塁指標を**入れずに**計算する（自分自身を説明変数にすると残差が消える）
  const sc = speedComponents(
    { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
    { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: r.season }, r.ubr, runNormNow);
  if (sc.score == null) continue;
  pairs.push({ name: nrm(r.name), season: r.season, speed: sc.score, adv: v.d / v.n });
}
const mSpeed = pairs.reduce((s, p2) => s + p2.speed, 0) / pairs.length;
const mAdv = pairs.reduce((s, p2) => s + p2.adv, 0) / pairs.length;
let sxy = 0, sxx = 0;
for (const p2 of pairs) { sxy += (p2.speed - mSpeed) * (p2.adv - mAdv); sxx += (p2.speed - mSpeed) ** 2; }
const slope = sxy / sxx, intercept = mAdv - slope * mSpeed;
const resid = pairs.map(p2 => p2.adv - (intercept + slope * p2.speed));
const sdResid = Math.sqrt(resid.reduce((s, v) => s + v * v, 0) / resid.length);

// 残差の翌年再現性（＝走塁得能の材料としての重み）
const rMap = new Map();
pairs.forEach((p2, i) => rMap.set(`${p2.name}|${p2.season}`, resid[i]));
const rx = [], ry = [];
for (const [k, v] of rMap) {
  const [n2, s] = k.split('|');
  const w = rMap.get(`${n2}|${Number(s) + 1}`);
  if (w != null) { rx.push(v); ry.push(w); }
}
const residRepeat = pearson(rx, ry) ?? 0;
console.log(`\n走塁得能のための「走力に対する残差」（${pairs.length}人年）`);
console.log(`  走力1あたり走塁指標が ${slope.toFixed(5)} 変わる（走力で説明できる分）`);
console.log(`  残差のばらつき ${sdResid.toFixed(5)}`);
console.log(`  残差の翌年再現性 ${residRepeat.toFixed(3)}（${rx.length}組）`);

const p = path.join(ROOT, 'configs', 'running_norms.json');
const norms = JSON.parse(readFileSync(p, 'utf8'));
norms.advanceOnSpeed = {
  slope, intercept, sd: sdResid, n: pairs.length,
  repeatability: Number(residRepeat.toFixed(3)),
  _purpose: '走塁得能＝走力で説明できる分を引いた残差（仕様04 §3）',
  _note: '走力の計算にはこの指標を入れずに求める（自分自身を説明変数にすると残差が消えるため）',
};
norms.advance = {
  mean, sd, min_chances: MIN_CHANCES, players: vals.length,
  _source: 'Nippon Baseball Data Repository (MIT License)',
  _method: '単打での一塁→三塁など「余分に進めたか」を、打球の位置とアウトカウントで難易度を揃えて平均との差にしたもの',
  _seasons: '2020-2026（1球データのある範囲）',
  _note: 'UBRとの相関0.613＝同じものを測りつつ4割は別の情報。置き換えず足す',
};
norms.componentWeights = { ...(norms.componentWeights ?? {}), advance: Number(repeatability.toFixed(3)) };
norms._componentWeights_basis = (norms._componentWeights_basis ?? '')
  + ` / advance=${repeatability.toFixed(3)}（2026-08-05実測、${xs.length}組）`;
writeFileSync(p, JSON.stringify(norms, null, 2), 'utf8');
console.log(`\n保存: configs/running_norms.json（advance と重み${repeatability.toFixed(3)}）`);
db.close();

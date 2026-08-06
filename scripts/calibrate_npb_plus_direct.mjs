// NPB+アプリの実測（打球速度・スイング速度・走る速さ等）を能力値へ変換する目盛りを作る。
//
// 出典: NPB+アプリ（2026年、オーナーがスクリーンショットで提供した103人）
//
// オーナー承認（2026-08-05）: NPB+実測を査定へ組み込む（T-0107）。
//
// どの実測がどの能力に効くか（2024年の査定103人と突合、実測済み）:
//   ハードヒット率 → パワー +0.720   バレル率 → パワー +0.712 / 弾道 +0.523
//   スイング速度   → パワー +0.683   打球角度 → 弾道 +0.506
//   瞬間最高速度   → 走力 +0.757     一塁到達 → 走力 -0.746
//   ミートはどれとも無関係（最大+0.219）＝打球の強さと当てる技術は別、で理にかなっている。
//
// ★目盛り合わせにパワプロの値を使う理由と、その限界:
//   実測値（km/h・%）を1〜100の能力値へ移すには、どこかに基準が要る。
//   既存の走力（MLB Sprint Speed）も同じ方式で、パワプロのラベルを**目盛り合わせにだけ**使い、
//   別ゲーム（The Show）と突き合わせて妥当性を確認している。
//   **採否の物差しにはしない**（2026-07-31オーナー確定）——ここで決めるのは「単位の換算」だけで、
//   どの材料を使うかは上の実測（各能力との相関）で決めている。
//
//   MLB Sprint Speed と両方持つ選手は4人しかおらず、そちらでは較正できなかった
//   （単位を揃えると同じオーダーであることは確認: NPB+が平均+0.85 ft/s 速く出る）。
//
// ホールドアウト: 名前のハッシュで train/test に分け、係数は train だけで作る。
//
// 使い方: node scripts/calibrate_npb_plus_direct.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

// 対応表: 実測 → 能力 / パワプロ側の列
const MAP = [
  { metric: 'hard_hit_pct', ability: 'パワー', pawa: 'power', unit: '%' },
  { metric: 'swing_speed_avg', ability: 'パワー', pawa: 'power', unit: 'km/h' },
  { metric: 'barrel_pct', ability: 'パワー', pawa: 'power', unit: '%' },
  { metric: 'launch_angle_avg', ability: '弾道', pawa: 'trajectory', unit: '度' },
  { metric: 'top_speed_kmh', ability: '走力', pawa: 'speed', unit: 'km/h' },
  { metric: 'hp_to_1b_sec', ability: '走力', pawa: 'speed', unit: '秒' },
];

const meas = db.prepare(`SELECT * FROM npb_plus_measurement`).all();
// パワプロは2026年の作品を使う（NPB+の実測と同じ年）。
// ★名寄せ: パワプロ側の名前は**姓だけ**（「松尾」）、NPB+はフルネーム（「松尾 汐恩」）。
//   既存の対応表（pawapuro_full_link）は2024年までしか無いので、ここで作る。
//   「パワプロの姓で始まるNPB+の名前」を探し、**一意に決まる時だけ**結ぶ。
//   複数該当（「山本」→山本泰寛／山本祐大）は取り違えるので捨て、件数を報告する。
const pawa = db.prepare(`SELECT name_norm, power, speed, trajectory, meet FROM pawapuro_full WHERE work = '2026'`).all();
const measNames = meas.map(r => ({ key: norm(r.name), row: r }));
const pm = new Map();
let ambiguous = 0, unmatched = 0;
for (const p of pawa) {
  const key = norm(p.name_norm);
  const hits = measNames.filter(m => m.key.startsWith(key));
  if (hits.length === 1) pm.set(hits[0].key, p);
  else if (hits.length > 1) ambiguous++;
  else unmatched++;
}
console.log(`名寄せ: パワプロ2026の${pawa.length}人のうち ${pm.size}人をNPB+実測と結べた`
  + `（姓が複数に当たって捨てた ${ambiguous}人 / NPB+側に居ない ${unmatched}人）\n`);

const isTest = name => (parseInt(createHash('sha256').update(norm(name)).digest('hex').slice(0, 8), 16) % 5) === 0;

function fit(pairs) {
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n, my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const r = sxy / Math.sqrt(sxx * syy);
  let mae = 0;
  for (const [x, y] of pairs) mae += Math.abs(y - (intercept + slope * x));
  return { slope, intercept, r, mae: mae / n, n };
}

const out = {};
console.log('実測 → 能力値の目盛り（trainで作り、testで確かめる）\n');
console.log('実測              能力     train           test（確かめ）');
for (const m of MAP) {
  const tr = [], te = [];
  for (const r of meas) {
    const v = r[m.metric];
    if (v == null) continue;
    const p = pm.get(norm(r.name));
    const label = p?.[m.pawa];
    if (label == null) continue;
    (isTest(r.name) ? te : tr).push([v, label]);
  }
  if (tr.length < 15) { console.log(`${m.metric.padEnd(18)}${m.ability.padEnd(8)} train ${tr.length}人（少なすぎるので作らない）`); continue; }
  const f = fit(tr);
  // test での確かめ（trainの式をそのまま当てる）
  let teMae = null, teR = null;
  if (te.length >= 5) {
    let s = 0; const px = [], py = [];
    for (const [x, y] of te) { s += Math.abs(y - (f.intercept + f.slope * x)); px.push(f.intercept + f.slope * x); py.push(y); }
    teMae = s / te.length;
    const t = fit(px.map((v, i) => [v, py[i]]));
    teR = t.r;
  }
  out[m.metric] = {
    ability: m.ability, unit: m.unit, slope: f.slope, intercept: f.intercept,
    train_r: Number(f.r.toFixed(3)), train_n: f.n, train_mae: Number(f.mae.toFixed(2)),
    test_r: teR == null ? null : Number(teR.toFixed(3)), test_n: te.length,
    test_mae: teMae == null ? null : Number(teMae.toFixed(2)),
  };
  console.log(`${m.metric.padEnd(18)}${m.ability.padEnd(8)} r=${f.r.toFixed(3)} 外し±${f.mae.toFixed(1)}(${f.n}人)   `
    + (teR == null ? '—' : `r=${teR.toFixed(3)} 外し±${teMae.toFixed(1)}(${te.length}人)`));
}

const p = path.join(ROOT, 'configs', 'ratings.json');
const cfg = JSON.parse(readFileSync(p, 'utf8'));
cfg.npb_plus_direct = {
  _source: 'NPB+アプリ 2026年（オーナー提供のスクリーンショット103人）',
  _season: 2026,
  _purpose: '実測値を能力値へ移す目盛り。どの材料を使うかは各能力との相関で決めている（下記）',
  _selection_basis: 'ハードヒット率→パワー+0.720 / 瞬間最高速度→走力+0.757 / 打球角度→弾道+0.506（2024年の査定103人と突合）',
  _label_caveat: 'パワプロの値は目盛り合わせにだけ使う。採否の物差しにはしない（2026-07-31オーナー確定）',
  _holdout: '名前のハッシュで5人に1人をtestへ。係数はtrainだけで作り、testで確かめている',
  _year_gap: '実測は2026年。査定年が離れる場合は既存の direct_measurement と同じく階層を下げる',
  models: out,
};
writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
console.log(`\n保存: configs/ratings.json（npb_plus_direct）`);
db.close();

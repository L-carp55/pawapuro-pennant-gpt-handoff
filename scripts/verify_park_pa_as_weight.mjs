// 球場補正の重みに「打席」を使ってよいかを実測で確かめる。
//
// 背景（2026-08-05）:
//   球場補正は「その選手がどの球場で何打数立ったか」で係数を加重平均している。
//   ところがこの内訳（NF3）は2023-2025の3年しか無く、2022年以前は補正できなかった。
//   1球データ（2020-2026）からは内訳を作れるが、そこから取れるのは **打席** であって
//   打数ではない（打数を出すには結果コードの対応表が要るが、公開されていない）。
//
// そこで2つを実測する:
//   検証1  同じNF3のデータで、重みを「打数」にした時と「打席」にした時で
//          球場係数がどれだけ変わるか。変わらなければ打席で代用してよい。
//   検証2  1球データから作った打席の内訳が、NF3の打席の内訳と一致するか。
//          一致すれば、1球データの内訳を2020-2022へ延長して使える。
//
// 使い方: node scripts/verify_park_pa_as_weight.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playerParkFactor } from '../src/ratings/from_rates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const factors = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'park_factors.json'), 'utf8')).hr;

// ---- 検証1: 打数を重みにした場合 vs 打席を重みにした場合 -------------------
const nf3 = db.prepare(`
  SELECT season, name_norm, label park, ab, pa FROM nf3_split
  WHERE section = 'park' AND ab > 0`).all();

const byPlayer = new Map();
for (const r of nf3) {
  const k = `${r.season}|${r.name_norm}`;
  if (!byPlayer.has(k)) byPlayer.set(k, []);
  byPlayer.get(k).push(r);
}

const diffs = [];
for (const [k, rows] of byPlayer) {
  const totalAb = rows.reduce((s, r) => s + r.ab, 0);
  if (totalAb < 100) continue;                       // 少なすぎる選手は比較の意味が薄い
  const byAb = playerParkFactor(rows.map(r => ({ park: r.park, AB: r.ab })), factors);
  const byPa = playerParkFactor(rows.map(r => ({ park: r.park, AB: r.pa })), factors);
  if (!byAb || !byPa) continue;
  diffs.push({ k, ab: byAb.factor, pa: byPa.factor, d: byPa.factor - byAb.factor });
}

const absD = diffs.map(d => Math.abs(d.d)).sort((a, b) => a - b);
const q = p => absD[Math.floor(absD.length * p)];
console.log(`検証1: 重みを打数→打席に変えた時の球場係数の変化（${diffs.length}人・年）`);
console.log(`  平均のずれ ${(diffs.reduce((s, d) => s + d.d, 0) / diffs.length).toFixed(5)}`);
console.log(`  絶対値  中央 ${q(0.5).toFixed(5)} / 90% ${q(0.9).toFixed(5)} / 最大 ${absD[absD.length - 1].toFixed(5)}`);
const worst1 = diffs.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
console.log(`  最大の人: ${worst1.k}  打数重み ${worst1.ab.toFixed(4)} → 打席重み ${worst1.pa.toFixed(4)}`);
// 係数は本塁打率の割り算に使う。1.00 に対して 0.001 のずれは本塁打30本で0.03本ぶん
console.log(`  ※係数は本塁打率を割る値。30本打つ選手で ${(30 * q(0.9)).toFixed(2)} 本ぶんの差に相当（90%点）`);

// ---- 検証2: 1球データの打席内訳 vs NF3の打席内訳 ---------------------------
const pbp = db.prepare(`
  SELECT season, name_norm, park, plate_appearances pa FROM park_plate_appearances
  WHERE season BETWEEN 2023 AND 2025`).all();
const pbpBy = new Map();
for (const r of pbp) {
  const k = `${r.season}|${r.name_norm}`;
  if (!pbpBy.has(k)) pbpBy.set(k, new Map());
  pbpBy.get(k).set(r.park, r.pa);
}

// NF3側の球場名と1球データ側の球場名の対応（表記ゆれ）
const ALIAS = new Map(Object.entries({
  'ナゴヤドーム': 'バンテリンドーム', 'メットライフ': 'ベルーナドーム',
  '楽天生命パーク': '楽天モバイル', 'みずほPayPay': 'PayPayドーム',
  'エスコンＦ': 'エスコンF',                  // 全角F と 半角F
}));
// NF3は地方球場を「Ce その他 / Pa その他」に合算している。1球データは球場名で持つので、
// 比較の時だけ同じ扱いに寄せる（どちらも係数が無く、補正の分母からは外れる）。
const HOME_PARKS = new Set(['PayPayドーム', 'ZOZOマリン', 'エスコンF', 'バンテリンドーム',
  'ベルーナドーム', 'マツダスタジアム', '京セラD大阪', '楽天モバイル', '横浜', '甲子園',
  '神宮', '東京ドーム', '札幌ドーム']);
const canon = s => {
  const a = ALIAS.get(s) ?? s;
  if (a === 'Ce その他' || a === 'Pa その他') return 'その他';
  return HOME_PARKS.has(a) ? a : 'その他';
};

let matched = 0, cellDiffs = [], factorDiffs = [];
for (const [k, rows] of byPlayer) {
  const [season] = k.split('|');
  if (Number(season) < 2023 || Number(season) > 2025) continue;
  const mine = pbpBy.get(k);
  if (!mine) continue;
  const totalAb = rows.reduce((s, r) => s + r.ab, 0);
  if (totalAb < 100) continue;
  matched++;
  // 球場ごとの打席の差
  const mineCanon = new Map();
  for (const [p2, v] of mine) mineCanon.set(canon(p2), (mineCanon.get(canon(p2)) ?? 0) + v);
  for (const r of rows) {
    const got = mineCanon.get(canon(r.park)) ?? 0;
    cellDiffs.push(got - r.pa);
  }
  // 係数そのものの差（NF3の打数重み vs 1球データの打席重み）
  const ref = playerParkFactor(rows.map(r => ({ park: canon(r.park), AB: r.ab })), factors);
  const got = playerParkFactor([...mineCanon].map(([p2, v]) => ({ park: p2, AB: v })), factors);
  if (ref && got) factorDiffs.push(got.factor - ref.factor);
}
const ac = cellDiffs.map(Math.abs).sort((a, b) => a - b);
const af = factorDiffs.map(Math.abs).sort((a, b) => a - b);
console.log(`\n検証2: 1球データの内訳 vs NF3の内訳（2023-2025、${matched}人・年）`);
console.log(`  球場ごとの打席の差: 中央 ${ac[Math.floor(ac.length / 2)]} / 90% ${ac[Math.floor(ac.length * 0.9)]} / 最大 ${ac[ac.length - 1]}`);
console.log(`  最終的な係数の差  : 中央 ${af[Math.floor(af.length / 2)].toFixed(5)} / 90% ${af[Math.floor(af.length * 0.9)].toFixed(5)} / 最大 ${af[af.length - 1].toFixed(5)}`);

// 球場名の対応が取れていないものを出す（黙って落ちるのを防ぐ）
const nf3Parks = new Set(nf3.map(r => canon(r.park)));
const pbpParks = new Set(pbp.map(r => canon(r.park)));
const onlyPbp = [...pbpParks].filter(p2 => !nf3Parks.has(p2));
const onlyNf3 = [...nf3Parks].filter(p2 => !pbpParks.has(p2));
if (onlyNf3.length) console.log(`  NF3にしか無い球場: ${onlyNf3.join(', ')}`);
if (onlyPbp.length) console.log(`  1球データにしか無い球場: ${onlyPbp.join(', ')}`);
const noFactor = [...pbpParks].filter(p2 => !(factors.parks[p2]?.factor > 0));
console.log(`  係数の無い球場（補正の分母から外れる）: ${noFactor.length}種`);
db.close();

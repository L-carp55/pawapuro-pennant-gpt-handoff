// エンジンが本塁打を多く出す原因を、乱数を挟まずに確かめる。
//
// 発端（2026-08-05）:
//   エンジン単体（査定を通さない）で回すと、本塁打が6年すべて実績より多い（+1.04〜+2.42%）。
//
// 疑い:
//   検証で使っている「目標」は、**打者の実測レートを打席数で加重平均した値**。
//   ところがエンジンは打者と投手を掛け合わせて確率を作る（bat × pit ÷ リーグ平均を正規化）。
//   掛け算は平均を取ってから掛けた値と、掛けてから平均を取った値が一致しない。
//   本塁打のように打者間・投手間のばらつきが大きい事象ほど、この差が出る。
//   だとすれば**エンジンは正しく、比べる相手（目標）の作り方が甘い**ことになる。
//
// 測り方:
//   全打者 × 全投手の組み合わせで合成し、実際の打席数・投球数の重みで平均する。
//   乱数を一切使わないので、シミュレーションのばらつきと切り離して偏りだけを見られる。
//
// 使い方: node scripts/check_combine_expectation.mjs [年...]

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rateVectorFromCounts, combine, OUTCOMES } from '../src/engine/odds.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const YEARS = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [2020, 2021, 2022, 2023, 2024, 2025];
const MIN_PA = 30;

console.log('打者と投手を掛け合わせた時、本塁打の期待値がどれだけ膨らむか（乱数なし）\n');
console.log('年     打者だけの平均  掛け合わせ後   差       打率の差   四球の差   三振の差');

for (const SEASON of YEARS) {
  const batters = db.prepare(`
    SELECT pa, ab, h, b1, b2, b3, hr, bb, hbp, so FROM v_batting
    WHERE season=? AND pa >= ?`).all(SEASON, MIN_PA);
  const pitchers = db.prepare(`
    SELECT outs, bf, h, hr, so, bb, hbp FROM v_pitching
    WHERE season=? AND outs >= 60`).all(SEASON);
  if (!batters.length || !pitchers.length) { console.log(`${SEASON}   （データ不足）`); continue; }

  const lgRow = db.prepare(`
    SELECT SUM(pa) pa, SUM(bb) bb, SUM(hbp) hbp, SUM(so) so,
           SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr
    FROM v_batting WHERE season=?`).get(SEASON);
  const league = rateVectorFromCounts({
    PA: lgRow.pa, BB: lgRow.bb, HBP: lgRow.hbp, SO: lgRow.so,
    B1: lgRow.b1, B2: lgRow.b2, B3: lgRow.b3, HR: lgRow.hr,
  });
  const nonHrHits = lgRow.b1 + lgRow.b2 + lgRow.b3;
  const share = { B1: lgRow.b1 / nonHrHits, B2: lgRow.b2 / nonHrHits, B3: lgRow.b3 / nonHrHits };
  const pitcherPA = p => {
    const floor = p.h + p.bb + p.hbp;
    return (p.bf != null && p.bf >= floor) ? p.bf : p.outs + p.h + p.bb + p.hbp;
  };

  const bVecs = [], bW = [];
  for (const b of batters) {
    const v = rateVectorFromCounts({
      PA: b.pa, BB: b.bb, HBP: b.hbp, SO: b.so, B1: b.b1, B2: b.b2, B3: b.b3, HR: b.hr,
    });
    if (v) { bVecs.push(v); bW.push(b.pa); }
  }
  const pVecs = [], pW = [];
  for (const p of pitchers) {
    const pa = pitcherPA(p);
    const hNonHr = Math.max(p.h - p.hr, 0);
    const v = rateVectorFromCounts({
      PA: pa, BB: p.bb, HBP: p.hbp, SO: p.so,
      B1: Math.round(hNonHr * share.B1), B2: Math.round(hNonHr * share.B2), B3: Math.round(hNonHr * share.B3),
      HR: p.hr,
    });
    if (v) { pVecs.push(v); pW.push(pa); }
  }

  // 打者だけの加重平均（＝いまの検証が「目標」と呼んでいるもの）
  const bwSum = bW.reduce((s, v) => s + v, 0);
  const batOnly = {};
  for (const c of OUTCOMES) batOnly[c] = bVecs.reduce((s, v, i) => s + v[c] * bW[i], 0) / bwSum;

  // 全組み合わせを、打席と対戦打者数の重みで平均する
  const pwSum = pW.reduce((s, v) => s + v, 0);
  const mixed = {};
  for (const c of OUTCOMES) mixed[c] = 0;
  let wAll = 0;
  for (let i = 0; i < bVecs.length; i++) {
    for (let j = 0; j < pVecs.length; j++) {
      const w = bW[i] * pW[j];
      const m = combine(bVecs[i], pVecs[j], league);
      for (const c of OUTCOMES) mixed[c] += m[c] * w;
      wAll += w;
    }
  }
  for (const c of OUTCOMES) mixed[c] /= wAll;

  // 打率は打数あたりなので、打数の割合に直してから比べる
  const avgOf = v => (v.B1 + v.B2 + v.B3 + v.HR) / (1 - v.BB - v.HBP);
  const rel = (a, b) => ((b - a) / a * 100);
  console.log(`${SEASON}   ${(batOnly.HR * 1000).toFixed(3).padStart(9)}‰  ${(mixed.HR * 1000).toFixed(3).padStart(9)}‰  `
    + `${(rel(batOnly.HR, mixed.HR) >= 0 ? '+' : '') + rel(batOnly.HR, mixed.HR).toFixed(2)}%   `
    + `${(rel(avgOf(batOnly), avgOf(mixed)) >= 0 ? '+' : '') + rel(avgOf(batOnly), avgOf(mixed)).toFixed(2)}%    `
    + `${(rel(batOnly.BB, mixed.BB) >= 0 ? '+' : '') + rel(batOnly.BB, mixed.BB).toFixed(2)}%    `
    + `${(rel(batOnly.SO, mixed.SO) >= 0 ? '+' : '') + rel(batOnly.SO, mixed.SO).toFixed(2)}%`);
}

// 合成の分母を何にするかで結果が変わる。エンジンは「投手プールの平均」を使っている
console.log('\n合成の分母（投手プールの平均）が、打者側のリーグ実測とどれだけ違うか');
console.log('年     打者側リーグ  投手プール   差       プールの投球回シェア');
for (const SEASON of YEARS) {
  const b = db.prepare(`SELECT SUM(pa) pa, SUM(hr) hr FROM v_batting WHERE season=?`).get(SEASON);
  const pAll = db.prepare(`SELECT SUM(outs) o FROM v_pitching WHERE season=?`).get(SEASON);
  const pPool = db.prepare(`SELECT SUM(outs) o, SUM(hr) hr, SUM(bf) bf FROM v_pitching WHERE season=? AND outs>=60`).get(SEASON);
  if (!b?.pa || !pPool?.bf) continue;
  const lgHR = b.hr / b.pa, poolHR = pPool.hr / pPool.bf;
  console.log(`${SEASON}   ${(lgHR * 1000).toFixed(3)}‰     ${(poolHR * 1000).toFixed(3)}‰   `
    + `${(((poolHR - lgHR) / lgHR) * 100 >= 0 ? '+' : '') + (((poolHR - lgHR) / lgHR) * 100).toFixed(2)}%   `
    + `${((pPool.o / pAll.o) * 100).toFixed(1)}%`);
}

console.log('\n分かったこと（2026-08-05時点）:');
console.log('  ・打者と投手を掛け合わせるだけなら、本塁打は **減る**（-1.25〜-3.48%）');
console.log('  ・分母を投手プールの平均にすると、その分（+1.2〜3.4%）戻る');
console.log('  ・両方を足してもエンジンで出ている超過（+1.04〜+2.42%）には届かない');
console.log('  → **原因の一部しか説明できていない。残りは未特定**。');
console.log('     候補: 打順の並べ方（打席数の多い順に並べるので強打者が上位に固定される）、');
console.log('           先発と救援の起用の再現度。ただしどちらも実際に測ってはいない。');
db.close();

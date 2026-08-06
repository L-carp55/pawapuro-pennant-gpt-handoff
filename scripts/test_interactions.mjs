// 能力間の相互作用が「補正項なしで」成立するかを検証する。
// オーナーの問い（2026-07-31）:
//   「パワーはミートとも関係していたり、二塁打はミート・走力とも関係しているみたいなのもあった。
//     そのあたりも後ですべて考慮されるのでしょうか？」
//
// Sol仕様の該当箇所:
//   02 §5.4 / 05 §6  同打率でも高パワーならミートを下げる（＝パワーは打率に効く）
//   02 §6.4          二塁打・三塁打の脚力寄与をパワーへ過剰に入れない
//   05 §7            内野安打は走力・内野安打○へ分離（ただしゼロ扱いにもしない）
//   02 §7            弾道は打球タイプで決める
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inplayOutcomes, sharesFromTrajectory, trajectoryFromShares } from '../src/engine/batted_ball.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const bb = JSON.parse(await readFile(path.join(ROOT, 'outputs', 'derived', 'batted_ball_coefficients.json'), 'utf8'));
const coef = bb.coefficients;

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '\n        ' + detail : ''}`); ok ? pass++ : fail++; };

const shares = sharesFromTrajectory(3, 50, cfg);
const inplayAvg = o => (o.B1 + o.B2 + o.B3 + o.HR); // インプレー打球あたりの安打率

// --- 相互作用1: パワーは打率にも効く（仕様02 §5.4 / 05 §6） ---
{
  const low = inplayOutcomes(shares, coef, { hrPerFly: 0.6, xbhBoost: 0.85 });
  const high = inplayOutcomes(shares, coef, { hrPerFly: 1.6, xbhBoost: 1.15 });
  check('パワーを上げると本塁打だけでなくインプレー安打率も上がる',
    high.HR > low.HR && inplayAvg(high) > inplayAvg(low),
    `本塁打 ${(low.HR * 100).toFixed(1)}%→${(high.HR * 100).toFixed(1)}% / 二塁打 ${(low.B2 * 100).toFixed(1)}%→${(high.B2 * 100).toFixed(1)}% / インプレー安打率 ${(inplayAvg(low) * 100).toFixed(1)}%→${(inplayAvg(high) * 100).toFixed(1)}%\n        → 同じ打率なら高パワーの選手はミートが低いはず、が式から導かれる（仕様§5.4）`);
}

// --- 相互作用2: 走力はゴロの単打と三塁打に効く（仕様05 §7、02 §6.4） ---
{
  const slow = inplayOutcomes(shares, coef, { gbSingle: 0.85 });
  const fast = inplayOutcomes(shares, coef, { gbSingle: 1.15 });
  check('走力を上げると単打と三塁打が増え、本塁打は変わらない',
    fast.B1 > slow.B1 && fast.B3 > slow.B3 && Math.abs(fast.HR - slow.HR) < 1e-9,
    `単打 ${(slow.B1 * 100).toFixed(1)}%→${(fast.B1 * 100).toFixed(1)}% / 三塁打 ${(slow.B3 * 100).toFixed(2)}%→${(fast.B3 * 100).toFixed(2)}% / 本塁打 ${(slow.HR * 100).toFixed(2)}%（不変）\n        → 脚力が本塁打（＝パワー）へ漏れない（仕様§6.4「2B/3Bの脚力寄与をパワーへ過剰に入れない」）`);
}

// --- 相互作用3: 二塁打はパワー由来、三塁打は脚力由来に分かれる ---
{
  const base = inplayOutcomes(shares, coef, {});
  const pw = inplayOutcomes(shares, coef, { xbhBoost: 1.3 });
  const sp = inplayOutcomes(shares, coef, { gbSingle: 1.3 });
  check('二塁打はパワーで、三塁打は走力で動く（別々の経路）',
    pw.B2 > base.B2 && Math.abs(pw.B3 - base.B3) < 1e-9 && sp.B3 > base.B3 && Math.abs(sp.B2 - base.B2) < 1e-9,
    `パワー↑: 二塁打${(base.B2 * 100).toFixed(1)}→${(pw.B2 * 100).toFixed(1)}% 三塁打不変 / 走力↑: 三塁打${(base.B3 * 100).toFixed(2)}→${(sp.B3 * 100).toFixed(2)}% 二塁打不変`);
}

// --- 相互作用4: ミートはライナーを増やし、打率を押し上げる（仕様02 §7） ---
{
  const lowMeet = sharesFromTrajectory(3, 35, cfg);
  const highMeet = sharesFromTrajectory(3, 75, cfg);
  const a = inplayOutcomes(lowMeet, coef, {}), b = inplayOutcomes(highMeet, coef, {});
  check('ミートを上げるとライナーが増え、インプレー安打率が上がる',
    highMeet.ld > lowMeet.ld && inplayAvg(b) > inplayAvg(a),
    `ライナー率 ${(lowMeet.ld * 100).toFixed(1)}%→${(highMeet.ld * 100).toFixed(1)}% / インプレー安打率 ${(inplayAvg(a) * 100).toFixed(1)}%→${(inplayAvg(b) * 100).toFixed(1)}%`);
}

// --- 弾道: 上げるほどフライが増え本塁打が出やすく、ゴロ由来の安打が減る ---
{
  console.log('\n--- 弾道別の打席結果（能力は中立、インプレー打球あたり） ---');
  console.log('弾道  ゴロ%  ライナー%  外野フライ%   単打%  二塁打%  三塁打%  本塁打%  安打率');
  for (let t = 1; t <= 4; t++) {
    const s = sharesFromTrajectory(t, 50, cfg);
    const o = inplayOutcomes(s, coef, {});
    console.log(String(t).padStart(3) + (s.gb * 100).toFixed(1).padStart(7) + (s.ld * 100).toFixed(1).padStart(10) + (s.offb * 100).toFixed(1).padStart(12)
      + (o.B1 * 100).toFixed(1).padStart(8) + (o.B2 * 100).toFixed(1).padStart(9) + (o.B3 * 100).toFixed(2).padStart(9) + (o.HR * 100).toFixed(2).padStart(9) + (inplayAvg(o) * 100).toFixed(1).padStart(8));
  }
  const t1 = inplayOutcomes(sharesFromTrajectory(1, 50, cfg), coef, {});
  const t4 = inplayOutcomes(sharesFromTrajectory(4, 50, cfg), coef, {});
  check('弾道を上げると本塁打・二塁打が増え、三塁打（ゴロ由来）が減る',
    t4.HR > t1.HR && t4.B2 > t1.B2 && t4.B3 < t1.B3);
}

// --- 弾道の逆算（2020年以降は実測の打球構成から弾道が決まる） ---
{
  const ok = [1, 2, 3, 4].every(t => trajectoryFromShares(cfg.trajectory.shares_by_trajectory[t - 1], cfg) === t);
  check('実測の打球構成から弾道を逆算して元に戻る', ok,
    [1, 2, 3, 4].map(t => `${t}→${trajectoryFromShares(cfg.trajectory.shares_by_trajectory[t - 1], cfg)}`).join(' '));
}

console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);

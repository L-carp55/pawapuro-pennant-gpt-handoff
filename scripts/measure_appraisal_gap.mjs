// 査定とパワプロ実装値の差を、能力ごと・守備位置ごとに分解して測る。
//
// これは何のための道具か（2026-08-05）:
//   パワプロの値は**採否の物差しではない**（2026-07-31 オーナー確定でKONAMI比較は参考チェックへ格下げ）。
//   ここでは「どこを見るべきか」を指す**検出器**として使う。査定シートと同じ位置づけ。
//
// この道具が実際に見つけたこと（2026-08-05）:
//   (1) 系統ずれ（自作の平均 − パワプロの平均）は、**目盛り合わせの有無だけでほぼ説明された**。
//       修理前は 肩力 -15.0 ／ 守備力 -7.3 ／ 捕球 -3.8 で「査定が甘い」ように見えたが、
//       原因は目盛りの基準を決めていなかったこと（自作は「リーグ平均=50」、パワプロの肩力の平均は65.9）。
//       目盛りを合わせた後は 肩力 +1.7 ／ 守備力 -0.2 ／ 捕球 +0.1 まで縮んだ。
//   (2) **本当の弱点は順位の一致のほう**。守備位置ごとに分けると、平均では見えない穴が出る:
//       内野手の肩力  -0.043 ＝ 当てずっぽう（内野手には送球の実測が無く、守れる位置からの推定のみ。T-0101）
//       外野手の捕球  -0.058 ＝ 当てずっぽう
//       捕手の守備力  +0.047 ＝ 当てずっぽう（ただし14人と少ない）
//       一方で 捕手の肩力 0.621 ／ 内野手の捕球 0.490 は効いている。
//   ★注意: 位置別の分解は2026-08-05まで**出力行を書き忘れており、群の見出しだけが空で並んでいた**
//     （守備位置も渡しておらず全員が undefined 群に落ちていた）。上の数字は修理後の実測。
//
// 使い方: node scripts/measure_appraisal_gap.mjs [年] [最低打席]

import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = process.cwd();
const SEASON = 2024, MIN_PA = 150;
const cfg = JSON.parse(await readFile(path.join(ROOT,'configs','ratings.json'),'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT,'configs','run_values.json'),'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT,'configs','running_norms.json'),'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT,'configs','fielding_norms.json'),'utf8'));
const scoutingLedger = loadLedger(JSON.parse(await readFile(path.join(ROOT,'configs','scouting.json'),'utf8')));
const db = new DatabaseSync(path.join(ROOT,'data','pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const rows = db.prepare(`
  SELECT p.arm p_arm, p.fielding p_fld, p.catching p_catch, p.speed p_speed,
         p.meet p_meet, p.power p_power, p.trajectory p_traj,
         b.player_id, b.name, b.position, b.pa
  FROM pawapuro_rating p
  JOIN pawapuro_link pl ON pl.name_norm = p.name_norm
  JOIN v_batting b ON b.player_id = pl.proeye_id AND b.season = ? AND b.pa >= ?
  WHERE b.position <> '投'`).all(SEASON, MIN_PA);

const out = [];
for (const r of rows) {
  const res = appraiseCard(ctx, { name: r.name, mode: String(SEASON), cfg, rv, runNorm, fldNorm, scoutingLedger });
  if (res.error) continue;
  const B = res.card.abilities.基礎能力;
  out.push({
    // ★2026-08-05修理: 守備位置を入れ忘れており、位置別の分解が全部 undefined 群に落ちていた
    _pos: r.position, _name: r.name,
    走力: [B.走力?.value, r.p_speed], ミート: [B.ミート?.value, r.p_meet], パワー: [B.パワー?.value, r.p_power],
    弾道: [B.弾道?.value, r.p_traj], 肩力: [B.肩力?.value, r.p_arm],
    守備力: [B.守備力?.value, r.p_fld], 捕球: [B.捕球?.value, r.p_catch],
  });
}
console.log('評価:', out.length, '人\n');

const CAL = { 走力:'較正済', ミート:'較正済', パワー:'較正済', 弾道:'較正済', 肩力:'**未較正**', 守備力:'**未較正**', 捕球:'**未較正**' };
console.log('能力    較正      n   平均誤差  系統ずれ  順位相関   自作平均 パワプロ平均');
for (const ab of ['走力','ミート','パワー','弾道','肩力','守備力','捕球']) {
  const pairs = out.map(o=>o[ab]).filter(([m,p])=>Number.isFinite(m)&&Number.isFinite(p));
  if (pairs.length < 3) { console.log(ab, '足りず'); continue; }
  const d = pairs.map(([m,p])=>m-p);
  const mae = d.reduce((s,v)=>s+Math.abs(v),0)/d.length;
  const bias = d.reduce((s,v)=>s+v,0)/d.length;
  const a = pairs.map(x=>x[0]), b = pairs.map(x=>x[1]);
  const n=a.length, ma=a.reduce((p,c)=>p+c,0)/n, mb=b.reduce((p,c)=>p+c,0)/n;
  let num=0,da=0,dbb=0; for(let i=0;i<n;i++){const u=a[i]-ma,v=b[i]-mb;num+=u*v;da+=u*u;dbb+=v*v;}
  const r = da>0&&dbb>0?num/Math.sqrt(da*dbb):null;
  console.log(`${ab.padEnd(4)} ${CAL[ab].padEnd(10)} ${String(n).padStart(3)}   ${mae.toFixed(1).padStart(5)}   ${(bias>=0?'+':'')}${bias.toFixed(1).padStart(5)}   ${r?.toFixed(3) ?? '—'}    ${ma.toFixed(1).padStart(5)}    ${mb.toFixed(1).padStart(5)}`);
}

// 守備位置別の分解（肩力・守備力・捕球）。どの群で崩れているかを特定する
const POSGRP = { '捕':'捕手', '一':'内野', '二':'内野', '三':'内野', '遊':'内野', '左':'外野', '中':'外野', '右':'外野' };
const byGrp = {};
for (const o of out) { const g = POSGRP[o._pos] ?? o._pos; (byGrp[g] ??= []).push(o); }
for (const ab of ['肩力','守備力','捕球']) {
  console.log();
  console.log(`【${ab}】 守備位置別`);
  console.log('群       n   平均誤差  系統ずれ  順位相関   自作平均 パワプロ平均');
  for (const [g, arr] of Object.entries(byGrp)) {
    const pairs = arr.map(o=>o[ab]).filter(([m,p])=>Number.isFinite(m)&&Number.isFinite(p));
    if (pairs.length < 3) { console.log(`${String(g).padEnd(6)} ${String(pairs.length).padStart(3)}   （3人未満のため出さない）`); continue; }
    const d = pairs.map(([m,p])=>m-p);
    const mae = d.reduce((s,v)=>s+Math.abs(v),0)/d.length;
    const bias = d.reduce((s,v)=>s+v,0)/d.length;
    const a = pairs.map(x=>x[0]), b = pairs.map(x=>x[1]);
    const n=a.length, ma=a.reduce((p,c)=>p+c,0)/n, mb=b.reduce((p,c)=>p+c,0)/n;
    let num=0,da=0,dbb=0; for(let i=0;i<n;i++){const u=a[i]-ma,v=b[i]-mb;num+=u*v;da+=u*u;dbb+=v*v;}
    const r = da>0&&dbb>0?num/Math.sqrt(da*dbb):null;
    // ★2026-08-05修理: ここに出力行が無く、計算だけして何も表示していなかった
    //   （群の見出しだけが3つ空で並び、「守備位置別に分解した」と読める状態だった）
    console.log(`${String(g).padEnd(6)} ${String(n).padStart(3)}   ${mae.toFixed(1).padStart(5)}   ${(bias>=0?'+':'')}${bias.toFixed(1).padStart(5)}   ${r?.toFixed(3) ?? '  —  '}    ${ma.toFixed(1).padStart(5)}    ${mb.toFixed(1).padStart(5)}`);
  }
}
db.close();

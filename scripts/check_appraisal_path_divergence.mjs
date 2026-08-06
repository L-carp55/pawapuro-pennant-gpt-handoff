// 査定の経路が2つあり、値が食い違っていないかを確かめる。
//
// 発見（2026-08-05）:
//   査定には2つの入り口がある。
//     A. カード査定  src/cards/pipeline.mjs の appraiseCard（選手カード・査定シートに出る値）
//     B. シーズン査定 scripts/appraise_season.mjs（**エンジンの検証に入る値**）
//   Bは appraiseBatting を直接呼んでおり、Aが渡している材料の一部を渡していない。
//   実際、球場補正の設定を切ってもBの出力が1人も変わらなかった（＝Bでは一度も効いていない）。
//
//   問題は「どちらが正しいか」ではなく、**同じ選手に2つの値が存在すること**。
//   エンジンの分布合わせ（Phase 2/3）はBで判定しているので、Aで直した改善は判定に入らない。
//
// この道具がすること: 同じ選手・同じ年で A と B を並べ、どれだけ違うかを出す。
//
// 使い方: node scripts/check_appraisal_path_divergence.mjs [年]

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2021);
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const scoutingLedger = loadLedger(J('scouting.json'));

const seasonPath = path.join(ROOT, 'outputs', `appraisal_${SEASON}.json`);
if (!existsSync(seasonPath)) {
  console.error(`先に node scripts/appraise_season.mjs ${SEASON} を実行してください`);
  process.exit(1);
}
const raw = JSON.parse(readFileSync(seasonPath, 'utf8'));
const seasonRows = Array.isArray(raw) ? raw : (raw.players ?? raw.batters ?? []);

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const rows = [];
for (const s of seasonRows) {
  const r = appraiseCard(ctx, { name: s.name, mode: String(SEASON), cfg, rv, runNorm, fldNorm, scoutingLedger });
  if (r.error) continue;
  const B = r.card.abilities?.基礎能力;
  const cardMeet = B?.ミート?.value, cardPower = B?.パワー?.value;
  if (!Number.isFinite(cardMeet) || !Number.isFinite(cardPower)) continue;
  const pk = r.card.calc_log?.power?.park;
  const tier = r.card.calc_log?.context_tier;
  rows.push({
    name: s.name, pa: s.pa,
    seasonMeet: s.meet, cardMeet, dMeet: cardMeet - s.meet,
    seasonPower: s.power, cardPower, dPower: cardPower - s.power,
    park: pk ? pk.factor : null, tier,
  });
}

const stat = key => {
  const d = rows.map(r => r[key]).filter(Number.isFinite);
  const mae = d.reduce((s, v) => s + Math.abs(v), 0) / d.length;
  const bias = d.reduce((s, v) => s + v, 0) / d.length;
  const sorted = d.map(Math.abs).sort((a, b) => a - b);
  return { mae, bias, p90: sorted[Math.floor(sorted.length * 0.9)], max: sorted[sorted.length - 1], n: d.length };
};

console.log(`${SEASON}年 ${rows.length}人 — 2つの査定経路の食い違い\n`);
console.log('能力    平均のずれ  平均の差  90%点  最大');
for (const [label, key] of [['ミート', 'dMeet'], ['パワー', 'dPower']]) {
  const s = stat(key);
  console.log(`${label.padEnd(5)} ${s.mae.toFixed(2).padStart(8)}点 ${(s.bias >= 0 ? '+' : '') + s.bias.toFixed(2).padStart(7)}点 ${s.p90.toFixed(1).padStart(6)} ${s.max.toFixed(1).padStart(6)}`);
}
console.log('※カード査定 − シーズン査定。0なら同じ値');

// 差が大きい人が、球場補正や文脈打率の対象かどうか
console.log('\n差が大きい順（上位12人）');
console.log('選手           打席  シーズン  カード   差    球場係数  文脈');
for (const r of [...rows].sort((a, b) => Math.abs(b.dPower) - Math.abs(a.dPower)).slice(0, 12)) {
  console.log(`${r.name.replace(/　/g, ' ').padEnd(12)} ${String(r.pa).padStart(4)}  ${r.seasonPower.toFixed(1).padStart(6)}  ${r.cardPower.toFixed(1).padStart(6)} ${(r.dPower >= 0 ? '+' : '') + r.dPower.toFixed(1).padStart(6)}  ${r.park ? r.park.toFixed(3).padStart(7) : '   なし'}  ${r.tier ?? '-'}`);
}


// 打席数で層別する（少ない人は縮小の扱いの違い、多い人は球場補正の違いが出るはず）
console.log('\n打席数で層別');
console.log('打席        人数  ミートのずれ        パワーのずれ        球場補正が効いた人');
const bands = [[0, 150], [150, 300], [300, 450], [450, 9999]];
for (const [lo, hi] of bands) {
  const sub = rows.filter(r => r.pa >= lo && r.pa < hi);
  if (!sub.length) continue;
  const m = k => sub.reduce((s, r) => s + Math.abs(r[k]), 0) / sub.length;
  const bias = k => sub.reduce((s, r) => s + r[k], 0) / sub.length;
  const pk = sub.filter(r => r.park != null);
  const avgPk = pk.length ? pk.reduce((s, r) => s + r.park, 0) / pk.length : null;
  const label = `${lo}-${hi > 9000 ? '' : hi}`;
  console.log(`${label.padEnd(10)} ${String(sub.length).padStart(4)}  `
    + `${m('dMeet').toFixed(2).padStart(5)}点(平均${(bias('dMeet') >= 0 ? '+' : '') + bias('dMeet').toFixed(1)})  `
    + `${m('dPower').toFixed(2).padStart(5)}点(平均${(bias('dPower') >= 0 ? '+' : '') + bias('dPower').toFixed(1)})  `
    + `${pk.length}人 係数${avgPk ? avgPk.toFixed(3) : '—'}`);
}
console.log('※少打席で「カードが高い」なら縮小の扱いの違い、多打席で「カードが低い」なら球場補正');
db.close();

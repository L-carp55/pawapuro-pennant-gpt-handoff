// チャンス・対左・けがしにくさを100段階へ移すときの幅を実データから測る。
//
// 「得点圏の打率が非得点圏より0.04高い」は、それだけでは能力値にならない。
// 何点ぶんの違いなのかを決める必要がある。恣意的に決めず、**選手間のばらつき（標準偏差）**を
// 物差しにする——1標準偏差ぶん違えば、能力値も1標準偏差ぶん（＝15点）動く、という揃え方。
// これは三振のしにくさ・選球眼で既に使っている zscore_ratings と同じ考え方。
//
// 出力: configs/ratings.json の ability_scaling / durability の実測値

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const cfgPath = path.join(ROOT, 'configs', 'ratings.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

const MIN_AB = 100; // 分割成績の最小打数（少数の偶然を分布へ混ぜない）

const stat = a => {
  const n = a.length, mean = a.reduce((x, y) => x + y, 0) / n;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd };
};

// --- チャンス: 得点圏 − 非得点圏の打率差 ---
const runnerRows = db.prepare(`
  SELECT season, name_norm, label, ab, h FROM nf3_split WHERE section='runner' AND ab>0`).all();
const byPlayer = {};
for (const r of runnerRows) (byPlayer[`${r.season}|${r.name_norm}`] ??= []).push(r);

const clutchDiffs = [];
for (const a of Object.values(byPlayer)) {
  const risp = a.find(r => r.label === '得点圏');
  const non = a.filter(r => ['無し', '1塁'].includes(r.label));
  if (!risp || risp.ab < MIN_AB || !non.length) continue;
  const nAb = non.reduce((s, r) => s + r.ab, 0), nH = non.reduce((s, r) => s + r.h, 0);
  if (nAb < MIN_AB) continue;
  clutchDiffs.push(risp.h / risp.ab - nH / nAb);
}

// --- 対左: 対左 − 対右のミート差 ---
const handRows = db.prepare(`
  SELECT season, name_norm, label, ab, h FROM nf3_split WHERE section='hand' AND ab>0`).all();
const handBy = {};
for (const r of handRows) (handBy[`${r.season}|${r.name_norm}`] ??= {})[r.label] = r;

const platoonDiffs = [];
for (const o of Object.values(handBy)) {
  const L = o['対左投手'], R = o['対右投手'];
  if (!L || !R || L.ab < MIN_AB || R.ab < MIN_AB) continue;
  platoonDiffs.push(L.h / L.ab - R.h / R.ab);
}

// --- けがしにくさ: 稼働率（打席 ÷ チーム試合×1試合あたり打席） ---
const perGame = cfg.durability?.pa_per_team_game ?? 3.1;
const durRows = db.prepare(`
  SELECT pa FROM v_batting WHERE position<>'投' AND pa>=100 AND season BETWEEN 2015 AND 2025`).all();
const rates = durRows.map(r => Math.min(1, r.pa / (143 * perGame)));

const clutch = stat(clutchDiffs), platoon = stat(platoonDiffs), dur = stat(rates);
const spread = cfg.zscore_ratings.contact.spread; // 既存の他能力と同じ幅（1標準偏差＝15点）

cfg.rank_scale = {
  _comment: '100段階の能力値をG〜Sのランクへ変換する境目。これは測るものではなくゲーム側の表記の約束',
  _basis: 'パワプロの一般的な区分（S=90以上／A=80台／B=70台／C=60台／D=50台／E=40台／F=20-39／G=19以下）',
  thresholds: [['S', 90], ['A', 80], ['B', 70], ['C', 60], ['D', 50], ['E', 40], ['F', 20], ['G', 1]],
};

cfg.ability_scaling = {
  _comment: '差（打率差など）を100段階へ移すときの物差し。選手間の標準偏差1つぶんで spread 点動かす',
  _measured_at: '2026-08-01',
  _source: `NF3 2023-2025、分割成績の打数${MIN_AB}以上`,
  clutch: { sd: clutch.sd, spread, n: clutch.n, mean: clutch.mean, _basis: '得点圏−非得点圏の打率差の選手間ばらつき' },
  platoon: { sd: platoon.sd, spread, n: platoon.n, mean: platoon.mean, _basis: '対左−対右のミート差の選手間ばらつき' },
};

cfg.durability = {
  ...(cfg.durability ?? {}),
  league_mean_rate: dur.mean,
  spread: spread / dur.sd,
  _measured_at: '2026-08-01',
  _basis: `2015-2025・100打席以上の${dur.n}件。稼働率の平均${dur.mean.toFixed(3)}・標準偏差${dur.sd.toFixed(3)}。`
    + '標準偏差1つぶんで能力値が' + spread + '点動くよう幅を決めた',
};

writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

console.log('得能を100段階へ移す物差し（実測）\n');
console.log(`チャンス（得点圏−非得点圏の打率差）  n=${clutch.n}  平均${clutch.mean.toFixed(4)}  標準偏差${clutch.sd.toFixed(4)}`);
console.log(`  → 打率差 +${clutch.sd.toFixed(3)} でちょうど ${spread} 点上がる（信頼度が満点の場合）`);
console.log(`対左（対左−対右のミート差）        n=${platoon.n}  平均${platoon.mean.toFixed(4)}  標準偏差${platoon.sd.toFixed(4)}`);
console.log(`  → 打率差 +${platoon.sd.toFixed(3)} でちょうど ${spread} 点上がる`);
console.log(`けがしにくさ（稼働率）              n=${dur.n}  平均${dur.mean.toFixed(3)}  標準偏差${dur.sd.toFixed(3)}`);
console.log(`\nランクの境目: ${cfg.rank_scale.thresholds.map(([r, m]) => r + '≥' + m).join(' / ')}`);
db.close();

// 外野手の補殺率を肩力の材料に加えるための正規化パラメータを作る。
//
// なぜ補殺を足すか（2026-08-01 オーナー指摘「鈴木の肩力がDなのはおかしい」の調査結果）:
//   NPB Basement の ARM は「送球で防いだ失点」＝実際に起きた事象の価値。
//   強肩の選手は**走者が走ってこない**ので機会そのものが減り、年ごとに数字が暴れる。
//   実例: 鈴木誠也の ARM は 2021年 4.99（右翼99人中5位）だが 2020年は 0.01（ちょうど平均）。同じ肩なのに。
//   補殺（送球でアウトにした数）で見ると 2017年 z=2.73 / 2018年 1.21 / 2020年 1.39 / 2021年 2.35 と一貫して上位。
//
// 実測（scripts内で検証済み）:
//   ARMと補殺の相関 r=0.402（関係はあるが別のものを測っている）
//   翌年のARMを当てる: ARMだけ 0.219 / 補殺だけ 0.263 / **2つの平均 0.280**
//   → 合わせた方が良い。
//   さらに補殺はプロEYE球にあるため **2006年から取れる**（ARMは2020年以降のみ）。
//   カープ黄金期・WBC世代のカードで肩力が空欄だった問題も同時に解ける。

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const MIN_G = 60; // 補殺率を信じるのに要る出場試合数

// 守備位置は プロEYE球の粗い区分（投/捕/一/二/三/遊/外）。肩の材料になるのは外野と捕手
const GROUPS = { '外': 'OF', '捕': 'C' };

const rows = db.prepare(`
  SELECT season, player_id, name, position, g, a, po
  FROM v_fielding WHERE position IN ('外','捕') AND g >= ?`).all(MIN_G);

const cells = {};
for (const r of rows) {
  const grp = GROUPS[r.position];
  (cells[`${grp}|${r.season}`] ??= []).push(r.a / r.g);
}

const norms = {};
for (const [k, a] of Object.entries(cells)) {
  if (a.length < 8) continue;
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / (a.length - 1));
  if (sd > 0) norms[k] = { mean, sd, n: a.length };
}

const path_ = path.join(ROOT, 'configs', 'fielding_norms.json');
const cfg = JSON.parse(readFileSync(path_, 'utf8'));
cfg.assistsByGroupSeason = {
  _comment: '外野手・捕手の補殺率（1試合あたり）の年ごとの平均と標準偏差。肩力の第2の材料',
  _why: 'ARMは「走者が走ってきた時にどれだけ刺したか」なので、強肩ほど機会が減って数字が暴れる。'
    + '補殺は事象そのものの数で、ARMとの相関は0.402＝別のものを測っている。'
    + '翌年予測は ARMだけ0.219／補殺だけ0.263／2つの平均0.280 で、合わせた方が良い',
  _coverage: 'プロEYE球の守備データなので2006年から取れる（ARMは2020年以降のみ）',
  _min_games: MIN_G,
  _measured_at: '2026-08-01',
  byGroupSeason: norms,
};
writeFileSync(path_, JSON.stringify(cfg, null, 2), 'utf8');

const years = [...new Set(Object.keys(norms).map(k => Number(k.split('|')[1])))].sort();
console.log(`補殺率の正規化パラメータ: ${Object.keys(norms).length}セル（${years[0]}〜${years.at(-1)}年）`);
for (const g of ['OF', 'C']) {
  const ks = Object.keys(norms).filter(k => k.startsWith(g + '|'));
  const mean = ks.reduce((s, k) => s + norms[k].mean, 0) / ks.length;
  console.log(`  ${g === 'OF' ? '外野' : '捕手'}: ${ks.length}年  1試合あたり補殺の平均 ${mean.toFixed(3)}`);
}
db.close();

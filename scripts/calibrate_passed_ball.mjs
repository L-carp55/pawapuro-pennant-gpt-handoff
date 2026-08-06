// 捕手の捕球を「捕逸（パスボール）」で測るための正規化パラメータを作る。
//
// なぜ差し替えるのか（2026-08-05、オーナー裁定）:
//   仕様04 §10.1 は捕手の捕球材料に「捕逸」を名指ししているのに、実装は一度も読んでいなかった
//   （DBに1,156人年あるのに src/ から参照ゼロ）。調べたところ、単なる取りこぼし以上の問題があった。
//
//   実測1: **現行のErrRは捕手について「失策の指標」ではなく実質的に捕逸の指標**だった。
//     corr(ErrR/1000inn, PB/1000inn) = -0.685  ／ corr(ErrR/1000inn, 失策E/1000inn) = -0.155
//     （捕手143人年・200イニング以上）。つまり両方を足すと同じ情報を2回数える＝二重計上。
//
//   実測2: **捕逸の方が「選手の持ち物」として安定している**。連続年ペア55件（400イニング以上）で
//     翌年再現性は PB +0.238 に対し ErrR +0.048。現行材料は捕手についてほぼランダム。
//
//   実測3: **被覆が段違い**。ErrRの出どころ（NPB Basement）は2020年以降しか無く、
//     2020年より前の捕手261人年（50試合以上）は守備が丸ごと空だった。捕逸は2006年から20年連続で取れる。
//     WBC2017・カープ黄金期といった検証題材はすべてこの空白域に入る。
//
//   → オーナー裁定（2026-08-05）: **捕手だけ ErrR → 捕逸へ差し替える**（併用はしない＝二重計上を避ける）。
//
// 単位について:
//   捕手のイニングは2020年以降しか無い（bm_fld）。捕逸は2006年から取れるので、
//   **1試合あたり**で作る。イニングで割る方が精密だが、それでは2019年以前が使えず被覆の利点が消える。
//
// 年ごとに標準化する理由:
//   リーグ全体の捕逸の水準は年で動く（実測 0.0287〜0.0435 /試合）。
//   年の水準移動を吸収しないと、リーグが動いた分を個人の能力差として拾ってしまう（仕様§11）。
//
// 使い方: node scripts/calibrate_passed_ball.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const MIN_G = 20;  // これ未満は率が暴れるので正規化の母集団に入れない（査定側は信頼度で絞る）

const rows = db.prepare(`
  SELECT season, player_id, name, g, pb
  FROM v_fielding
  WHERE position='捕' AND pb IS NOT NULL AND g >= ?`).all(MIN_G);

const samples = {};
for (const r of rows) (samples[r.season] ??= []).push(r.pb / r.g);

const bySeason = {};
for (const [season, a] of Object.entries(samples)) {
  if (a.length < 8) continue;                       // 標本が薄い年はセルを作らない（全年プールへ落とす）
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / (a.length - 1));
  if (sd > 0) bySeason[season] = { mean, sd, n: a.length };
}

// 全年プール（セルの無い年のフォールバック）
const all = rows.map(r => r.pb / r.g);
const poolMean = all.reduce((x, y) => x + y, 0) / all.length;
const poolSd = Math.sqrt(all.reduce((x, y) => x + (y - poolMean) ** 2, 0) / (all.length - 1));

const p = path.join(ROOT, 'configs', 'fielding_norms.json');
const cfg = JSON.parse(readFileSync(p, 'utf8'));
cfg.passedBallByCatcherSeason = {
  _comment: '捕手の捕逸（1試合あたり）の年ごとの平均と標準偏差。捕手の捕球はこれで測る（ErrRは使わない）',
  _why: '仕様04 §10.1が捕手の捕球材料に捕逸を名指ししている。'
    + '現行のErrRは捕手について実質的に捕逸の指標で（corr -0.685、失策Eとは -0.155）、'
    + '両方使うと二重計上になる。しかも翌年再現性は捕逸+0.238に対しErrR+0.048で、ErrRはほぼランダム。'
    + '被覆も捕逸が2006年から、ErrRは2020年から（2019年以前の捕手261人年が丸ごと空だった）',
  _unit: '1試合あたり（捕手のイニングは2020年以降しか無いため。イニングで割ると2019年以前が使えず被覆の利点が消える）',
  _direction: '捕逸は少ないほど良い。査定側でzの符号を反転させる',
  _min_games: MIN_G,
  _measured_at: '2026-08-05',
  _owner_ruling: '2026-08-05 オーナー裁定「捕手だけErrR→捕逸へ差し替え」。'
    + '★採否の正式な物差し（エンジンでのリーグ分布一致）は未実装のため、これは暫定',
  pool: { mean: poolMean, sd: poolSd, n: all.length },
  bySeason: bySeason,
};
writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');

const years = Object.keys(bySeason).map(Number).sort();
console.log(`捕逸の正規化パラメータ: ${years.length}年分（${years[0]}〜${years.at(-1)}）／対象 ${rows.length}人年`);
console.log(`  全年プール: 平均 ${poolMean.toFixed(4)} / 試合  sd ${poolSd.toFixed(4)}`);
console.log(`  年の振れ幅: ${Math.min(...years.map(y => bySeason[y].mean)).toFixed(4)} 〜 ${Math.max(...years.map(y => bySeason[y].mean)).toFixed(4)}`);
db.close();

// 球場係数を実データから測る（Sol仕様 02 §6.4 の補助指標のうち PF）。
//
// 何のためか: 同じ打者でも、本塁打の出やすい球場を本拠地にしていると本塁打が増える。
//   その分を能力と読み違えないための係数。
//
// 素朴なやり方の問題:
//   球場ごとの本塁打率をそのまま比べると、**その球場に多く出る打者の顔ぶれ**が混ざる。
//   本拠地の球場では自軍の打者が半分の打席を占めるので、強打者の多いチームの本拠地が
//   「本塁打の出る球場」に見えてしまう（打者の質と球場の質が同じ列に入る）。
//
// 対策（同一打者内の比較）:
//   **同じ打者が、ある球場と他の球場でどれだけ違ったか**を見る。打者を跨がないので顔ぶれの差が消える。
//   打者ごとに「その球場での率 ÷ その打者の他球場での率」を出し、打席で重み付けして球場ごとに平均する。

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const MIN_AB_AT_PARK = 30;   // その球場での最小打数
const MIN_AB_ELSEWHERE = 150; // 比較対象（他球場）の最小打数

const rows = db.prepare(`
  SELECT season, name_norm, label park, ab, h, b2, b3, hr
  FROM nf3_split WHERE section='park' AND ab > 0`).all();

if (!rows.length) { console.error('球場別成績が無い。先に node scripts/parse_nf3.mjs'); process.exit(1); }

const bySeasonPlayer = {};
for (const r of rows) (bySeasonPlayer[`${r.season}|${r.name_norm}`] ??= []).push(r);

/** metric ごとに、球場の比を集める */
const METRICS = {
  hr: { label: '本塁打', num: r => r.hr, den: r => r.ab },
  avg: { label: '打率', num: r => r.h, den: r => r.ab },
  xbh: { label: '長打（2B+3B+HR）', num: r => (r.b2 ?? 0) + (r.b3 ?? 0) + (r.hr ?? 0), den: r => r.ab },
};

const collected = {};
for (const key of Object.keys(METRICS)) collected[key] = {};

for (const arr of Object.values(bySeasonPlayer)) {
  const totalAb = arr.reduce((s, r) => s + r.ab, 0);
  for (const r of arr) {
    if (r.ab < MIN_AB_AT_PARK) continue;
    const others = arr.filter(o => o.park !== r.park);
    const otherAb = others.reduce((s, o) => s + o.ab, 0);
    if (otherAb < MIN_AB_ELSEWHERE) continue;
    for (const [key, m] of Object.entries(METRICS)) {
      const here = m.num(r) / m.den(r);
      const elseNum = others.reduce((s, o) => s + m.num(o), 0);
      const elseDen = others.reduce((s, o) => s + m.den(o), 0);
      // 比を選手ごとに作らず、**合計を持ち回る**。
      // 選手ごとの比にすると、その球場で本塁打0の選手（比が0、対数が取れない）を
      // 捨てることになり、係数が上へ偏る。合計なら0の選手も分母として残る。
      (collected[key][r.park] ??= []).push({
        hereNum: m.num(r), hereDen: m.den(r),
        elseNum, elseDen, ab: r.ab, totalAb,
        _unused_here_rate: here,
      });
    }
  }
}

const result = {};
for (const [key, m] of Object.entries(METRICS)) {
  const parks = {};
  for (const [park, a] of Object.entries(collected[key])) {
    if (a.length < 20) continue;
    const hn = a.reduce((s, x) => s + x.hereNum, 0), hd = a.reduce((s, x) => s + x.hereDen, 0);
    const en = a.reduce((s, x) => s + x.elseNum, 0), ed = a.reduce((s, x) => s + x.elseDen, 0);
    if (!(hd > 0) || !(ed > 0) || !(en > 0)) continue;
    const here = hn / hd, away = en / ed;
    // 二項の誤差から比の誤差を近似（率どうしの比なので相対誤差を足し合わせる）
    const relSe = Math.sqrt((here > 0 ? (1 - here) / (hn || 1) : 0) + (1 - away) / (en || 1));
    parks[park] = {
      _raw_ratio: here / away, n_player_seasons: a.length, ab: hd,
      here_rate: here, elsewhere_rate: away, _rel_se: relSe,
    };
  }
  // 全球場の（打数で重み付けした）平均が1になるよう基準化する。
  // こうしないと「どこも平均より上」という辻褄の合わない係数になる
  const totalAb = Object.values(parks).reduce((s, v) => s + v.ab, 0);
  const center = Object.values(parks).reduce((s, v) => s + Math.log(v._raw_ratio) * v.ab, 0) / (totalAb || 1);
  for (const v of Object.values(parks)) {
    v.factor = v._raw_ratio / Math.exp(center);
    v.se = v.factor * v._rel_se;
  }
  result[key] = {
    label: m.label, parks,
    _method: '同じ選手集団の合計で比を取る（その球場の率 ÷ 同じ選手たちの他球場での率）。'
      + '選手ごとの比にすると本塁打0の選手を捨てることになり係数が上へ偏るため',
    _centering: '打数で重み付けした全球場平均が1になるよう基準化',
  };
}

const out = {
  measured_at: '2026-08-01',
  method: '同一打者内の比（その球場での率 ÷ 同じ打者の他球場での率）を打数で加重平均する。'
    + '球場ごとの生の率を比べると、その球場に多く出る打者の顔ぶれが混ざるため',
  source: 'NF3 球場別成績 2023-2025',
  thresholds: { min_ab_at_park: MIN_AB_AT_PARK, min_ab_elsewhere: MIN_AB_ELSEWHERE, min_player_seasons: 20 },
  caveats: [
    '本拠地の球場は自軍打者の打席が多く、「他球場」の中身が球団ごとに違う（対戦相手の偏り）',
    '3年分なので、年による球場改修・ボールの変更は分けられていない',
    '打者の左右による球場相性は分けていない',
  ],
  ...result,
};

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'park_factors.json'), JSON.stringify(out, null, 2), 'utf8');

console.log(`球場係数（NF3 2023-2025・同一打者内の比）\n`);
for (const [key, r] of Object.entries(result)) {
  const sorted = Object.entries(r.parks).sort((a, b) => b[1].factor - a[1].factor);
  console.log(`## ${r.label}`);
  for (const [park, v] of sorted) {
    const bar = v.factor >= 1 ? '＋' : '−';
    console.log(`  ${park.padEnd(10)} ${v.factor.toFixed(3)} ${bar} (±${v.se.toFixed(3)}, ${v.n_player_seasons}人季/${v.ab}打数)`);
  }
  console.log();
}
db.close();

// 内野安打率を走力の材料に加えるための正規化パラメータを作る（仕様04 §1.2 第3階層）。
//
// なぜ足すか（2026-08-01 実測）:
//   仕様の第3階層に「内野安打率」が挙がっているのに実装から漏れていた。
//   測ってみると、**手持ちの材料の中で最も脚力に近い**:
//     UBRとの相関   内野安打率 0.410 ／ 三塁打割合 0.385 ／ 三塁打率 0.329
//     翌年再現性     内野安打率 0.655 ／ 三塁打割合 0.689 ／ 三塁打率 0.541
//   内野ゴロを安打にできるのは足が速いからで、三塁打より直接的（三塁打は長打力・
//   球場・打球方向が混ざる、と仕様§1.2自身が警告している）。
//
// 交絡の扱い（仕様§1.2は「内野安打には左打ち、ゴロ率、打球傾向が混ざる」と警告）:
//   - **左打ち: 外す**。実測で左3.52% / 右2.38% と水準が48%違う。
//     ただし打席の中だけで見てもUBRとの相関は保たれる（左0.414 / 右0.317 / 全体0.410）ので、
//     左打ち有利は**水準を上げるだけで相関は作っていない**。水準差だけを外せばよい。
//   - **ゴロ率: 外さない**。外すとUBRとの相関が0.293まで落ちる。ゴロが多いこと自体が
//     「足を使う打者」の性質と絡んでおり、長打力と三塁打の関係と同じで交絡ではなく実体を含む。
//     既知の未除去交絡として記録に残す。
//
// 出力: configs/running_norms.json の infieldHit

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const MIN_AB = 200;

const rows = db.prepare(`
  SELECT season, bats, ab, so, ih FROM nf3_team_bat
  WHERE ab >= ? AND ih IS NOT NULL`).all(MIN_AB)
  .map(r => ({ ...r, rate: r.ih / Math.max(1, r.ab - (r.so ?? 0)) }));

// 年×打席のセルで標準化する（リーグ水準の年変動と左打ち有利を同時に外す）
const cells = {};
for (const r of rows) (cells[`${r.season}|${r.bats || '?'}`] ??= []).push(r.rate);

const byCell = {};
for (const [k, a] of Object.entries(cells)) {
  if (a.length < 8) continue;
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / (a.length - 1));
  if (sd > 0) byCell[k] = { mean, sd, n: a.length };
}

// 打席が取れない選手のための、年だけのセル
const bySeason = {};
for (const y of [...new Set(rows.map(r => r.season))]) {
  const a = rows.filter(r => r.season === y).map(r => r.rate);
  if (a.length < 8) continue;
  const mean = a.reduce((x, y2) => x + y2, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y2) => x + (y2 - mean) ** 2, 0) / (a.length - 1));
  if (sd > 0) bySeason[y] = { mean, sd, n: a.length };
}

const p = path.join(ROOT, 'configs', 'running_norms.json');
const cfg = JSON.parse(readFileSync(p, 'utf8'));
cfg.infieldHit = {
  _comment: '内野安打率（三振を除いたインプレー打数あたり）の正規化。走力の材料（仕様04 §1.2 第3階層）',
  _why: '手持ちの材料で最も脚力に近い。UBRとの相関0.410（三塁打率0.329・三塁打割合0.385より上）、翌年再現性0.655',
  _adjustment: '年×打席（左右）で標準化する。左打ちは一塁に近いぶん有利で水準が48%高い（左3.52%/右2.38%）が、'
    + '打席の中だけで見てもUBRとの相関は保たれる（左0.414/右0.317）ので、水準差だけを外す',
  _known_unremoved_confound: 'ゴロ率。外すとUBRとの相関が0.293まで落ちるため外していない。'
    + 'ゴロが多いこと自体が「足を使う打者」の性質と絡んでおり、交絡と実体が分離できない',
  _source: `NF3 球団別打撃ページ 2005-2025（${MIN_AB}打数以上 ${rows.length}件）`,
  _measured_at: '2026-08-01',
  min_ab: MIN_AB,
  byCell, bySeason,
};
writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');

console.log(`内野安打率の正規化: 年×打席 ${Object.keys(byCell).length}セル / 年のみ ${Object.keys(bySeason).length}セル`);
console.log(`対象 ${rows.length}件（${MIN_AB}打数以上、2005-2025）`);
for (const b of ['右', '左', '両']) {
  const a = rows.filter(r => r.bats === b);
  if (a.length < 30) continue;
  console.log(`  ${b}打ち n=${String(a.length).padStart(4)}  平均 ${(a.reduce((s, r) => s + r.rate, 0) / a.length * 100).toFixed(2)}%`);
}
db.close();

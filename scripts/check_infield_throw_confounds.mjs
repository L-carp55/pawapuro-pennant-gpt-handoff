// 内野手の送球指標（T-0101）が、本当に肩を測れているかを確かめる。
//
// 疑い（2026-08-05、作った直後に自分で気づいた）:
//   この指標は「同じ場所の打球をアウトにできた割合」の平均からの差で作っている。
//   ところが**守備範囲の広い選手ほど、難しい打球に届いてしまう**。届いた上でアウトに
//   できなければマイナスが付く。つまり「範囲が広いほど損をする」構造になっていないか。
//   実際、強肩で知られる今宮健太が下位に出ており、そのまま肩として使うのは危うい。
//
// 3つの角度から確かめる:
//   1. 守備範囲の指標（RngR）と負の相関があるか → あれば交絡している
//   2. DELTAが実測した遊撃手の遠投成功率と一致するか → 唯一の外部の答え合わせ
//   3. 深い打球だけに絞ると肩に寄るはずだが、実際に順位が変わるか
//
// ★4つ目の検査を後から追加して、結論が変わった（2026-08-05）:
//   「同じ選手の去年と今年で再現するか」を測ったら **相関 0.007**（92組）だった。
//   現行の守備範囲指標（RngR）は同じ測り方で 0.256。つまりこの指標は年単位では雑音。
//   原因は件数——走者なしのゴロは1人年60〜150件で、アウト率が91〜95%なので失敗は年5〜10件しかない。
//
//   件数を増やして測り直すと、上がる兆しはある:
//     前半3年 vs 後半3年（各100件以上・25人） 0.091
//     同（各200件以上・9人）                  0.634  ← ただしn=9で確定できない
//     同（各300件以上）                        該当者0人
//
//   **現時点では守備力の材料として採用できない**（T-0112の判断材料）。
//   件数を増やす道はある: いま除いている「走者あり」97,153件を、状況を説明変数に入れて使う。
//   その時は、どの塁へ投げるか・併殺を狙うかで難しさが変わる点を扱う必要がある。
//
// 使い方: node scripts/check_infield_throw_confounds.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const j = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'infield_throw_rating.json'), 'utf8'));
const deep = new Map(j.deep.map(d => [d.fielder, d]));
const all = new Map(j.all.map(d => [d.fielder, d]));

function pearson(a, b) {
  const n = a.length; if (n < 4) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; num += u * v; da += u * u; dbb += v * v; }
  return da > 0 && dbb > 0 ? num / Math.sqrt(da * dbb) : null;
}

// ---- 1. 守備範囲との交絡 ---------------------------------------------------
// 1球データの野手名は姓だけ（「今宮」）。守備指標の側はフルネームなので、
// 姓が一意に決まる人だけを使う（同姓が複数いたら捨てる＝取り違えを起こさない）
const fld = db.prepare(`
  SELECT b.name, SUM(m.rngr) rngr, SUM(m.def_inn) inn
  FROM v_bm_by_player m JOIN v_batting b ON b.player_id = m.proeye_id AND b.season = m.season
  WHERE m.season BETWEEN 2020 AND 2026 AND m.rngr IS NOT NULL
  GROUP BY b.player_id HAVING inn >= 1500`).all();
const surname = new Map();
for (const r of fld) {
  const s = r.name.replace(/[\s　].*$/, '');
  if (!surname.has(s)) surname.set(s, []);
  surname.get(s).push(r);
}

const pairs = [];
for (const [s, list] of surname) {
  if (list.length !== 1) continue;                 // 同姓が複数＝取り違えるので使わない
  const d = deep.get(s) ?? deep.get(s.normalize('NFKC'));
  if (!d || d.n < 80) continue;
  pairs.push({ name: s, effect: d.effect, rngr: list[0].rngr, inn: list[0].inn, n: d.n });
}
const r1 = pearson(pairs.map(p => p.effect), pairs.map(p => p.rngr));
console.log('1. 守備範囲（RngR）との関係');
console.log(`   n=${pairs.length}  相関 ${r1 === null ? '—' : (r1 >= 0 ? '+' : '') + r1.toFixed(3)}`);
console.log('   ※強い負の相関が出たら「範囲が広い人ほど損をする」構造＝肩の指標として使えない');
if (pairs.length >= 6) {
  const sorted = [...pairs].sort((a, b) => b.rngr - a.rngr);
  console.log('   範囲が広い上位5人:', sorted.slice(0, 5).map(p => `${p.name}(${p.effect >= 0 ? '+' : ''}${p.effect.toFixed(2)})`).join(' '));
  console.log('   範囲が狭い下位5人:', sorted.slice(-5).map(p => `${p.name}(${p.effect >= 0 ? '+' : ''}${p.effect.toFixed(2)})`).join(' '));
}

// ---- 2. DELTAの実測との突合 ------------------------------------------------
const raw = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'web_collected_measurements.json'), 'utf8'));
const recs = Array.isArray(raw) ? raw : (raw.records ?? []);
const delta = new Map();
for (const r of recs) {
  if (r.metric !== 'long_throw_out_rate' || r.season !== 2017 || !/表3/.test(r.context ?? '')) continue;
  delta.set(r.player.replace(/[\s　]/g, '').slice(0, 2), r.value);   // 姓（2文字）で寄せる
}
console.log('\n2. DELTAが実測した遠投成功率（2017年の遊撃手）との突合');
const dp = [];
for (const [s, v] of delta) {
  const d = deep.get(s);
  if (!d) { console.log(`   ${s}: この指標に出てこない`); continue; }
  dp.push({ name: s, delta: v, effect: d.effect, n: d.n });
}
for (const p of dp.sort((a, b) => b.delta - a.delta)) {
  console.log(`   ${p.name.padEnd(4)} DELTA ${p.delta.toFixed(1)}%  ／ この指標 ${(p.effect >= 0 ? '+' : '') + p.effect.toFixed(3)} (${p.n}件)`);
}
const r2 = pearson(dp.map(p => p.delta), dp.map(p => p.effect));
console.log(`   n=${dp.length}  相関 ${r2 === null ? '判定しない（4人未満）' : (r2 >= 0 ? '+' : '') + r2.toFixed(3)}`);
console.log('   ※計測は2017年、この指標は2020-2026年。年がずれている');

// ---- 3. 深い打球だけに絞ると順位が変わるか ---------------------------------
const both = j.deep.filter(d => d.n >= 80 && all.has(d.fielder))
  .map(d => ({ name: d.name, deep: d.effect, all: all.get(d.fielder).effect }));
const r3 = pearson(both.map(b => b.deep), both.map(b => b.all));
console.log('\n3. 全打球版と深い打球版の一致');
console.log(`   n=${both.length}  相関 ${r3 === null ? '—' : (r3 >= 0 ? '+' : '') + r3.toFixed(3)}`);
console.log('   ※1.0に近い＝絞っても同じものを測っている（＝肩に寄せられていない）');
db.close();

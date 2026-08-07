// 追加進塁イベントの success ラベル監査。
// build_baserunning_advances.mjs は「次打席で塁上から消えた」を生還扱いするため、
// 走塁死が success=1 に混ざっていないかを、保存済み description から検査する。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

const rows = db.prepare(`
  SELECT season, kind, runner_norm, outs, success, hc_x, hc_y, hit_location, description
  FROM baserunning_advances
  ORDER BY season, kind, runner_norm
`).all();

const OUT_RE = /アウト|刺|タッチ|憤死|走塁死|本塁死|三塁死|二塁死|併殺/;
const SCORE_RE = /生還|ホームイン|得点|本塁へ|ホームへ/;

const pct = (n, d) => d ? `${(100 * n / d).toFixed(2)}%` : '—';
const byKind = new Map();
for (const r of rows) {
  if (!byKind.has(r.kind)) byKind.set(r.kind, { n: 0, s: 0, outText: 0, successOutText: 0, scoreText: 0 });
  const x = byKind.get(r.kind);
  x.n++;
  x.s += r.success ?? 0;
  const d = r.description ?? '';
  if (OUT_RE.test(d)) x.outText++;
  if (r.success === 1 && OUT_RE.test(d)) x.successOutText++;
  if (SCORE_RE.test(d)) x.scoreText++;
}

console.log(`# 追加進塁 success ラベル監査`);
console.log(`total=${rows.length}`);
console.log('');
console.log('| kind | events | success | success% | out-word | success+out-word | score-word |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const [kind, x] of byKind) {
  console.log(`| ${kind} | ${x.n} | ${x.s} | ${pct(x.s, x.n)} | ${x.outText} | ${x.successOutText} | ${x.scoreText} |`);
}

const suspicious = rows.filter(r => r.success === 1 && OUT_RE.test(r.description ?? ''));
console.log(`\nsuccess=1 かつアウト系語を含む: ${suspicious.length} / ${rows.filter(r => r.success === 1).length}`);
console.log('\n## suspicious examples');
for (const r of suspicious.slice(0, 80)) {
  console.log(`${r.season}\t${r.kind}\t${r.runner_norm}\touts=${r.outs}\tloc=${r.hit_location ?? ''}\t${r.description ?? ''}`);
}

const outAny = rows.filter(r => OUT_RE.test(r.description ?? ''));
console.log(`\nアウト系語を含む全イベント: ${outAny.length}`);
if (outAny.length) {
  const s = outAny.reduce((a, r) => a + (r.success ?? 0), 0);
  console.log(`そのうち success=1: ${s} (${pct(s, outAny.length)})`);
}

console.log('\n## descriptions containing out-word regardless of label');
for (const r of outAny.slice(0, 80)) {
  console.log(`${r.success}\t${r.season}\t${r.kind}\t${r.runner_norm}\t${r.description ?? ''}`);
}

db.close();

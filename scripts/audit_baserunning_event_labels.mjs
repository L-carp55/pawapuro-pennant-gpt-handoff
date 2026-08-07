// 追加進塁イベントの success ラベル監査。
// 保存済み description に明示された「打席開始時の塁状況」と「打球後の塁状況」を使い、
// baserunning_advances の kind / success と整合するかを検査する。

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

const pct = (n, d) => d ? `${(100 * n / d).toFixed(2)}%` : '—';
const BASE = '(満塁|1,2,3塁|1,2塁|1,3塁|2,3塁|1塁|2塁|3塁)';
const BASE_RE = new RegExp(BASE, 'g');
const START_PATTERNS = [
  new RegExp(`ランナー${BASE}から`),
  new RegExp(`[012]アウト${BASE}から`),
  new RegExp(`[012]アウト${BASE}の[^ ]{0,16}から`),
];

function startBase(d) {
  const s = String(d ?? '');
  for (const re of START_PATTERNS) {
    const m = s.match(re);
    if (m) return { base: m[1], endIndex: (m.index ?? 0) + m[0].length };
  }
  return null;
}

function endBase(d, startInfo) {
  if (!startInfo) return null;
  const tail = String(d ?? '').slice(startInfo.endIndex);
  const xs = [...tail.matchAll(BASE_RE)];
  return xs.length ? xs.at(-1)[1] : null;
}

const allowedStarts = {
  // builder は r1 && !r2 && !r3 を要求
  '1st_to_3rd': new Set(['1塁']),
  // builder は r1 && !r2 && !r3 を要求
  '1st_to_home_on_2b': new Set(['1塁']),
  // builder は r2 && !r3。1塁走者はいてもよい
  '2nd_to_home': new Set(['2塁', '1,2塁']),
};

// 開始状態が説明文と一致すると仮定したとき、終了塁だけで明確に判定できるケース。
function impliedSuccess(kind, start, end) {
  if (!start || !end) return null;
  if (kind === '1st_to_3rd' && start === '1塁') {
    if (end === '1,3塁') return 1;
    if (end === '1,2塁') return 0;
    if (end === '1塁') return 1;
    return null;
  }
  if (kind === '1st_to_home_on_2b' && start === '1塁') {
    if (end === '2塁') return 1;
    if (end === '2,3塁') return 0;
    return null;
  }
  if (kind === '2nd_to_home') {
    if (start === '2塁') {
      if (end === '1塁') return 1;
      if (end === '1,3塁') return 0;
      return null;
    }
    if (start === '1,2塁') {
      if (end === '満塁' || end === '1,2,3塁') return 0;
      if (end === '1,2塁') return 1;
      return null;
    }
  }
  return null;
}

const byKind = new Map();
const badStart = [];
const outcomeContradictions = [];
let parseableStart = 0;
let parseableOutcome = 0;

for (const r of rows) {
  const d = r.description ?? '';
  const sInfo = startBase(d);
  const st = sInfo?.base ?? null;
  const en = endBase(d, sInfo);
  if (!byKind.has(r.kind)) byKind.set(r.kind, { n: 0, success: 0, parseStart: 0, badStart: 0, parseOutcome: 0, contradiction: 0 });
  const x = byKind.get(r.kind);
  x.n++;
  x.success += r.success ?? 0;

  if (st) {
    parseableStart++; x.parseStart++;
    const ok = allowedStarts[r.kind]?.has(st) ?? true;
    if (!ok) {
      x.badStart++; badStart.push({ ...r, st, en });
    }
  }

  const implied = impliedSuccess(r.kind, st, en);
  if (implied != null) {
    parseableOutcome++; x.parseOutcome++;
    if (implied !== r.success) {
      x.contradiction++; outcomeContradictions.push({ ...r, st, en, implied });
    }
  }
}

console.log('# 追加進塁イベント 状態整合監査（開始塁を明示文だけから判定）');
console.log(`total=${rows.length}`);
console.log(`開始塁を明示文から読めた: ${parseableStart} (${pct(parseableStart, rows.length)})`);
console.log(`開始塁の明確な不一致: ${badStart.length} (${pct(badStart.length, parseableStart)})`);
console.log(`終了塁からsuccessを明確に再判定できた: ${parseableOutcome} (${pct(parseableOutcome, rows.length)})`);
console.log(`そのうち保存successと矛盾: ${outcomeContradictions.length} (${pct(outcomeContradictions.length, parseableOutcome)})`);

console.log('\n| kind | events | success% | parsed start | bad start | parsed outcome | contradiction |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const [kind, x] of byKind) {
  console.log(`| ${kind} | ${x.n} | ${pct(x.success, x.n)} | ${x.parseStart} | ${x.badStart} (${pct(x.badStart, x.parseStart)}) | ${x.parseOutcome} | ${x.contradiction} (${pct(x.contradiction, x.parseOutcome)}) |`);
}

console.log('\n## 開始塁が kind と矛盾する例');
for (const r of badStart.slice(0, 60)) {
  console.log(`${r.season}\t${r.kind}\t${r.runner_norm}\tstart=${r.st}\tend=${r.en ?? '—'}\tsuccess=${r.success}\t${r.description}`);
}

console.log('\n## 終了塁から見た success 矛盾の例');
for (const r of outcomeContradictions.slice(0, 60)) {
  console.log(`${r.season}\t${r.kind}\t${r.runner_norm}\tstart=${r.st}\tend=${r.en}\tsaved=${r.success}\timplied=${r.implied}\t${r.description}`);
}

db.close();

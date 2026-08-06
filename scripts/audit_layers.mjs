// データ層の点検（Sol仕様 03 §1.2）。
//   1. すべての成果物が定義済みの層に入っているか（層の外に置き去りが無いか）
//   2. 生データが取込後に書き換えられていないか（指紋との照合）
//   3. 層の取り違え書き込みが関門で止まるか
//
// 使い方: node scripts/audit_layers.mjs            点検する
//         node scripts/audit_layers.mjs --seal     生データの指紋を作り直す

import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYERS, classify, assertWritable, writeRawManifest, verifyRaw, MANIFEST_PATH, isDocument } from '../src/data_layers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEAL = process.argv.includes('--seal');

if (SEAL) {
  const m = writeRawManifest(ROOT);
  console.log(`生データの指紋を作成: ${m.file_count}ファイル / ${(m.total_bytes / 1e6).toFixed(1)}MB → ${MANIFEST_PATH}`);
}

let issues = 0;

// --- 1. 層の割り当て ---
console.log('## 層ごとの中身\n');
for (const [name, def] of Object.entries(LAYERS)) {
  const counts = def.dirs.map(d => {
    const abs = path.join(ROOT, d);
    if (!existsSync(abs)) return `${d}: なし`;
    if (statSync(abs).isFile()) return `${d}: 1ファイル`;
    const n = countFiles(abs);
    return `${d}: ${n}ファイル`;
  });
  console.log(`- **${name}** — ${def.desc}`);
  console.log(`  ${counts.join(' / ')}`);
}

function countFiles(dir) {
  let n = 0;
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

// --- 2. 層の外に置かれた成果物 ---
console.log('\n## 層の外に置かれたファイル\n');
const strays = [];
for (const top of ['outputs']) {
  const abs = path.join(ROOT, top);
  if (!existsSync(abs)) continue;
  for (const e of readdirSync(abs)) {
    const rel = `${top}/${e}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) {
      if (!classify(rel + '/x')) strays.push(rel + '/');
    } else if (!classify(rel) && !isDocument(rel)) strays.push(rel);
  }
}
if (strays.length) {
  console.log(`${strays.length}件。レポート類は層の対象外でよいが、係数・カードがここにあると層分けが崩れる:`);
  for (const s of strays) console.log(`  - ${s}`);
} else {
  console.log('なし');
}

// --- 3. 生データの指紋照合 ---
console.log('\n## 生データが書き換えられていないか\n');
const v = verifyRaw(ROOT);
if (!v.ok && v.reason) {
  console.log(`未検査: ${v.reason}（\`node scripts/audit_layers.mjs --seal\` で作成）`);
} else if (v.ok) {
  console.log(`一致（指紋の作成 ${v.generated_at}）${v.added.length ? ` / 新規追加 ${v.added.length}件（許容）` : ''}`);
} else {
  issues++;
  console.log(`**ずれあり** — 変更 ${v.changed.length}件 / 欠落 ${v.missing.length}件`);
  for (const f of v.changed.slice(0, 10)) console.log(`  変更: ${f}`);
  for (const f of v.missing.slice(0, 10)) console.log(`  欠落: ${f}`);
}

// --- 4. 関門が効くか ---
console.log('\n## 層の取り違え書き込みが止まるか\n');
const cases = [
  ['data/raw/batting_2024.csv', 'derived', '生データへ派生値を書こうとする'],
  ['outputs/cards/x.json', 'derived', 'カードを派生値として書こうとする'],
  ['outputs/なにか.json', 'derived', '層の定義に無い場所へ書こうとする'],
];
for (const [rel, layer, desc] of cases) {
  let msg = null;
  try { assertWritable(rel, layer); } catch (e) { msg = e.message; }
  if (msg) console.log(`  止まる: ${desc}\n    → ${msg.slice(0, 90)}`);
  else { issues++; console.log(`  **止まらない**: ${desc}（${rel} を ${layer} として書けてしまう）`); }
}

console.log(`\n判定: ${issues ? `**要対処 ${issues}件**` : '問題なし'}`);
process.exit(issues ? 1 : 0);

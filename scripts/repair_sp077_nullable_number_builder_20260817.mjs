import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(ROOT, 'scripts/build_sp077_construct_complete_owner_review_queue_20260817.mjs');
const oldLine = "const nullableNumber = v => Number.isFinite(Number(v)) ? Number(v) : null;";
const newLine = "const nullableNumber = v => (v === null || v === undefined || v === '') ? null : (Number.isFinite(Number(v)) ? Number(v) : null);";
const text = fs.readFileSync(target, 'utf8');
if (text.includes(oldLine)) {
  const next = text.replace(oldLine, newLine);
  if (next === text) throw new Error('nullableNumber repair did not modify source');
  fs.writeFileSync(target, next);
  console.log(JSON.stringify({ repaired: true, target: path.relative(ROOT, target), rule: 'null/undefined/empty remain null; only actual numeric values are converted' }));
} else if (text.includes(newLine)) {
  console.log(JSON.stringify({ repaired: false, already_fixed: true, target: path.relative(ROOT, target) }));
} else {
  throw new Error('builder nullableNumber implementation drifted; refuse an unreviewed textual patch');
}

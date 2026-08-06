// 独自査定を凍結する（Sol仕様 05 §10.1）。KONAMI比較の前に必ず1回通す。
// 使い方: node scripts/freeze_appraisal.mjs ["メモ"]
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFreeze, verifyFreeze } from '../src/compare/freeze.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const note = process.argv[2] ?? null;

let gitCommit = null;
try { gitCommit = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* リポ外でも凍結はできる */ }

const { record, file } = createFreeze(ROOT, { note, gitCommit });
console.log(`凍結しました`);
console.log(`  ID(root SHA256): ${record.root_sha256}`);
console.log(`  日時: ${record.frozen_at}`);
console.log(`  対象: ${record.file_count}ファイル（うちカード ${record.card_count}枚）`);
console.log(`  git: ${record.git_commit ?? '(未取得)'}`);
if (note) console.log(`  メモ: ${note}`);
console.log(`  → ${path.relative(ROOT, file)}`);

const v = verifyFreeze(ROOT);
console.log(`\n検証: ${v.ok ? '一致（凍結直後なので当然）' : 'ずれあり ' + JSON.stringify(v)}`);

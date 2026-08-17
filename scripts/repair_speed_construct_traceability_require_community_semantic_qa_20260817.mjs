// Exact bounded repair: make Community semantic propagation QA mandatory in
// the global construct-traceability gate. Refuse broad rewrites if expected
// snippets have drifted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'scripts/qa_speed_construct_traceability_20260817.mjs');
let text = fs.readFileSync(TARGET, 'utf8');

function replaceOnce(oldText, newText, label) {
  if (text.includes(newText)) return false;
  const first = text.indexOf(oldText);
  if (first < 0 || text.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`${label}: expected exactly one repair target`);
  }
  text = text.replace(oldText, newText);
  return true;
}

let changed = false;
changed = replaceOnce(
  "const QUEUE_QA = 'outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json';\nconst LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';",
  "const QUEUE_QA = 'outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json';\nconst COMMUNITY_QA = 'outputs/derived/qa_sp077_community_semantic_propagation_20260817.json';\nconst LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';",
  'constant') || changed;
changed = replaceOnce(
  'let contract, requirements, tasks, lock, queue, queueQa, ledger;',
  'let contract, requirements, tasks, lock, queue, queueQa, communityQa, ledger;',
  'declaration') || changed;
changed = replaceOnce(
  '  queueQa = readJson(QUEUE_QA);\n  ledger = readJson(LEDGER);',
  '  queueQa = readJson(QUEUE_QA);\n  communityQa = readJson(COMMUNITY_QA);\n  ledger = readJson(LEDGER);',
  'load') || changed;
changed = replaceOnce(
  "if (Number(queueQa?.coverage?.players ?? NaN) !== 100) err('construct-complete independent QA does not cover exactly 100 players');\n\nconst unresolved = contract.filter(row => row.required_for_owner_review === '1' && row.current_resolution === 'UNRESOLVED');",
  "if (Number(queueQa?.coverage?.players ?? NaN) !== 100) err('construct-complete independent QA does not cover exactly 100 players');\n\n// Structural lane existence is insufficient. The 2026-08-17 regression proved\n// that a Community lane object can exist while canonical physical/technique/\n// rating rows disappear because of field-name drift. Require source-derived\n// record-id/category/content exact propagation before owner review can unlock.\nif (communityQa?.status !== 'PASS') err(`Community semantic propagation QA status is ${communityQa?.status ?? 'MISSING'}, expected PASS`);\nif (Number(communityQa?.checks_failed ?? NaN) !== 0) err(`Community semantic propagation QA has ${communityQa?.checks_failed ?? 'unknown'} failures`);\nif (Number(communityQa?.checks_passed ?? NaN) !== Number(communityQa?.checks_total ?? NaN)) err('Community semantic propagation QA passed/total mismatch');\nif (!(Number(communityQa?.source?.active_rows ?? 0) > 0)) err('Community semantic propagation QA has no active source rows');\nif (!(Number(communityQa?.source?.active_players ?? 0) > 0)) err('Community semantic propagation QA has no active source players');\n\nconst unresolved = contract.filter(row => row.required_for_owner_review === '1' && row.current_resolution === 'UNRESOLVED');",
  'semantic checks') || changed;

if (!changed) {
  console.log(JSON.stringify({ repaired: false, already_current: true }));
  process.exit(0);
}
fs.writeFileSync(TARGET, text, 'utf8');
console.log(JSON.stringify({ repaired: true, target: path.relative(ROOT, TARGET), mandatory_gate: 'Community semantic record-id propagation QA' }));

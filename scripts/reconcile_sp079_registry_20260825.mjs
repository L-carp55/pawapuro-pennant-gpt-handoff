import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(ROOT, 'docs/state/speed_task_registry.tsv');
const registryText = fs.readFileSync(registryPath, 'utf8').replace(/^\uFEFF/, '').trimEnd();
const lines = registryText.split(/\r?\n/);
const header = lines[0].split('\t');
const rows = lines.slice(1).filter(Boolean).map((line, index) => {
  const cells = line.split('\t');
  if (cells.length !== header.length) throw new Error(`registry row ${index + 2} has ${cells.length} cells; expected ${header.length}`);
  return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
});
const byId = new Map(rows.map(row => [row.task_id, row]));
const requireTask = id => {
  const row = byId.get(id);
  if (!row) throw new Error(`missing registry task ${id}`);
  return row;
};
const appendUnique = (value, additions) => {
  const current = value ? value.split(';').filter(Boolean) : [];
  for (const addition of additions) if (!current.includes(addition)) current.push(addition);
  return current.join(';');
};

const sp104 = requireTask('SP-104');
sp104.status = 'DONE_VALIDATED';
sp104.next_action_or_blocker = [
  'EVIDENCE_STATUS=DONE_VALIDATED; browser independent review accepts SP-104 as DONE_VALIDATED_READY_FOR_SP079_WITH_BOUNDED_EXTERNAL_NPBPLUS_H2F.',
  'The remaining current NPB+ fastest-H2F per-player surface is preserved as BLOCKED_EXTERNAL_CURRENT_VALUE_SURFACE; old local hp_to_1b_sec remains fail-closed/quarantined.',
  'Reference docs/audits/sp104_browser_independent_review_20260825.md and docs/state/speed_sp104_readiness_override_20260825.json.',
  'owner_verdict_count=0; do not write SP-078, run SP-080/SP-081, or start shoulder.'
].join(' ');
sp104.artifacts = appendUnique(sp104.artifacts, [
  'docs/audits/sp104_browser_independent_review_20260825.md',
  'docs/state/speed_sp104_readiness_override_20260825.json'
]);

const sp079 = requireTask('SP-079');
sp079.status = 'PARTIAL';
const dependencies = new Set((sp079.depends_on || '').split(',').filter(Boolean));
for (const dependency of ['SP-103', 'SP-104']) dependencies.add(dependency);
sp079.depends_on = [...dependencies].join(',');
sp079.next_action_or_blocker = [
  'EVIDENCE_STATUS=IN_PROGRESS; SP-079 is executing the separately authorized final practical 100-player reappraisal from docs/tasks/CODEX_SP079_EXECUTION_20260825.md.',
  'SP-103/SP-104 prerequisites are satisfied under the accepted browser override; owner_verdict_count=0 remains locked.',
  'Do not run SP-080/SP-081 or start shoulder; close only after the required all-100 final-value ablation, independent red-team QA, and audit are complete.'
].join(' ');

const sp103 = requireTask('SP-103');
sp103.next_action_or_blocker = [
  'EVIDENCE_STATUS=DONE_VALIDATED; completeness inventory remains accepted and the SP-104 browser review/override provides effective readiness for SP-079 with bounded external current-H2F missingness.',
  'Preserve the 71-row universe and all negative findings; owner_verdict_count=0; SP-079 is separately executing; do not run SP-080/SP-081 or shoulder.'
].join(' ');

for (const id of ['SP-080', 'SP-081']) {
  const row = requireTask(id);
  if (row.status !== 'NOT_STARTED') throw new Error(`${id} unexpectedly changed before SP-079 execution: ${row.status}`);
}
const shoulder = requireTask('SP-082');
if (shoulder.status !== 'BLOCKED_DEPENDENCY') throw new Error(`SP-082 unexpectedly changed before SP-079 execution: ${shoulder.status}`);

const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs/derived/sp078_owner_verdict_ledger_20260816.json'), 'utf8'));
const ownerCount = ledger.owner_verdict_count ?? ledger.verdict_count ?? (Array.isArray(ledger.events) ? ledger.events.length : null);
if (ownerCount !== 0) throw new Error(`owner verdict count is not 0: ${ownerCount}`);

const out = [header.join('\t'), ...rows.map(row => header.map(key => row[key] ?? '').join('\t'))].join('\n') + '\n';
fs.writeFileSync(registryPath, out);
console.log(JSON.stringify({
  registry: 'docs/state/speed_task_registry.tsv',
  SP103: sp103.status,
  SP104: sp104.status,
  SP079: sp079.status,
  SP079_depends_on: sp079.depends_on,
  SP080: requireTask('SP-080').status,
  SP081: requireTask('SP-081').status,
  shoulder: shoulder.status,
  owner_verdict_count: ownerCount
}, null, 2));

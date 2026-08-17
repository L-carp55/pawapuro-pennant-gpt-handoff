// Repair the SP-077 exclusion/dependency gate semantics.
// An open exclusion blocks SP-077 only when one of the exclusion's STILL-OPEN
// corrective tasks is an explicit SP-077 dependency. A closed dependency task
// merely appearing in the exclusion history must not pull unrelated open tasks
// into SP-077's dependency contract.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'scripts/qa_speed_task_registry.mjs');
const before = fs.readFileSync(TARGET, 'utf8');
const old = `const finalQueueDependencyIds = new Set(finalQueue ? list(finalQueue.depends_on) : []);\nconst finalQueueTaskBlocks = ownerBlocks.filter(t => finalQueueDependencyIds.has(t.task_id));\nconst finalQueueExclusionBlocks = ownerExclusionBlocks.filter(x =>\n  list(x.task_ids).some(taskId => finalQueueDependencyIds.has(taskId))\n);`;
const replacement = `const finalQueueDependencyIds = new Set(finalQueue ? list(finalQueue.depends_on) : []);\nconst finalQueueTaskBlocks = ownerBlocks.filter(t => finalQueueDependencyIds.has(t.task_id));\n// Only an OPEN corrective task can make an OPEN exclusion a dependency blocker.\n// Regression case: EX-004 contains closed SP-019 plus open SP-060/061/062.\n// SP-019 is a declared SP-077 dependency, but because SP-019 is closed, the\n// unrelated open tasks must remain global-Speed-Gate work instead of silently\n// redefining the bounded SP-077 queue contract.\nconst openCorrectiveTaskIds = x => list(x.task_ids).filter(taskId =>\n  byId.has(taskId) && !CLOSED.has(byId.get(taskId).status)\n);\nconst finalQueueExclusionBlocks = ownerExclusionBlocks.filter(x =>\n  openCorrectiveTaskIds(x).some(taskId => finalQueueDependencyIds.has(taskId))\n);`;
if (before.includes(replacement)) {
  console.log(JSON.stringify({ repaired: false, already_current: true }));
  process.exit(0);
}
if (!before.includes(old)) throw new Error('expected SP-077 exclusion gate snippet not found; refuse broad source rewrite');
const after = before.replace(old, replacement);
fs.writeFileSync(TARGET, after, 'utf8');
console.log(JSON.stringify({ repaired: true, target: 'scripts/qa_speed_task_registry.mjs' }));
